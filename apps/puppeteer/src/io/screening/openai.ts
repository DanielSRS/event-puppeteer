import { z } from 'zod';
import type { ImageScreener, ScreeningFailure } from '../index.ts';
import type { ScreeningCategory, ScreeningScores } from '../../types/image.ts';
import { err, ok, type Result } from '../../utils/result.ts';

const ENDPOINT = 'https://api.openai.com/v1/moderations';

/**
 * Which OpenAI categories feed which Screening category. OpenAI's hate, harassment and
 * illicit categories only read text, so they say nothing about a picture.
 */
const MAPPING: Partial<Record<string, ScreeningCategory>> = {
  sexual: 'nudity',
  violence: 'violence',
  'self-harm': 'violence',
  'self-harm/intent': 'violence',
  'self-harm/instructions': 'violence',
  'violence/graphic': 'gore'
};

const answerSchema = z.object({
  results: z.array(z.object({
    category_scores: z.record(z.number()),
    category_applied_input_types: z.record(z.array(z.string()))
  })).length(1)
});

const failureSchema = z.object({ error: z.object({ message: z.string() }) });

/**
 * Screens Images with OpenAI's free omni-moderation model
 * (https://developers.openai.com/api/docs/guides/moderation). It is Screening's second
 * opinion: it covers nudity, violence (self-harm included) and gore, and only scores that
 * OpenAI says came from the image are used.
 */
export class OpenAIImageScreener implements ImageScreener {
  constructor(
    private apiKey: string,
    private fetchImpl: typeof fetch = fetch
  ) {}

  async screen(webp: Uint8Array<ArrayBuffer>): Promise<Result<ScreeningScores, ScreeningFailure>> {
    let response: Response;
    let body: unknown;
    try {
      response = await this.fetchImpl(ENDPOINT, {
        method: 'POST',
        headers: { authorization: `Bearer ${this.apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'omni-moderation-latest',
          input: [{ type: 'image_url', image_url: { url: `data:image/webp;base64,${Buffer.from(webp).toString('base64')}` } }]
        })
      });
      body = await response.json();
    } catch (error) {
      return err({ reason: `OpenAI unreachable: ${error instanceof Error ? error.message : String(error)}`, partialScores: {} });
    }

    const answer = answerSchema.safeParse(body);
    if (!response.ok || !answer.success) {
      const failure = failureSchema.safeParse(body);
      const detail = failure.success
        ? failure.data.error.message
        : `unexpected answer (${answer.success ? 'none' : answer.error.issues.map(issue => `${issue.path.join('.') || '(root)'} (${issue.message})`).join(', ')})`;
      return err({ reason: `OpenAI answered ${response.status}: ${detail}`, partialScores: {} });
    }

    const [result] = answer.data.results;
    if (!result) return err({ reason: 'OpenAI answered without a result', partialScores: {} });
    const scores: ScreeningScores = {};
    for (const [openAICategory, score] of Object.entries(result.category_scores)) {
      const category = MAPPING[openAICategory];
      if (category === undefined || !result.category_applied_input_types[openAICategory]?.includes('image')) continue;
      const current = scores[category];
      scores[category] = current === undefined ? score : Math.max(current, score);
    }
    return ok(scores);
  }
}
