import { z } from 'zod';
import type { ImageScreener, ScreeningFailure } from '../index.ts';
import type { ScreeningScores } from '../../types/image.ts';
import { err, ok, type Result } from '../../utils/result.ts';

const ENDPOINT = 'https://api.sightengine.com/1.0/check.json';

/** The models Screening runs. Their call cost 4 operations of the plan's quota in a real answer (`request.operations`). */
const MODELS = ['nudity-2.1', 'weapon', 'offensive-2.0', 'gore-2.0', 'violence', 'text-content-2.0'];

/** The text categories that make written text in an Image offensive. */
const TEXT_CATEGORIES = ['sexual', 'insult', 'discriminatory', 'inappropriate', 'extremism', 'violence', 'self_harm'];

/**
 * Text detections come as a severity, not a probability. Each level is given a score so the
 * Screening Policy's cut-offs apply to text as to pictures. A detection without a severity
 * counts as high: an unrated match is not assumed mild.
 */
const SEVERITY_SCORES = { low: 0.35, medium: 0.65, high: 0.95 } as const;

const severity = z.enum(['low', 'medium', 'high']);

/** The parts of Sightengine's answer that Screening reads; anything else is ignored. */
const answerSchema = z.object({
  status: z.literal('success'),
  nudity: z.object({ sexual_activity: z.number(), sexual_display: z.number(), erotica: z.number(), very_suggestive: z.number() }),
  weapon: z.object({ classes: z.object({ firearm: z.number(), knife: z.number() }) }),
  offensive: z.object({ nazi: z.number(), confederate: z.number(), supremacist: z.number(), terrorist: z.number(), middle_finger: z.number() }),
  gore: z.object({ prob: z.number() }),
  violence: z.object({ prob: z.number() }),
  text: z.object({
    /**
     * Keyed by category when something was detected. With no text detected, Sightengine
     * answers an empty array instead (seen in a real answer; the docs only show the object).
     */
    detections: z.union([
      z.record(z.object({ severity: severity.optional(), details: z.array(z.object({ severity: severity.optional() })) })),
      z.array(z.unknown()).length(0)
    ])
  })
});

const failureSchema = z.object({ error: z.object({ message: z.string() }) });

/** The fields of an answer that didn't match what Screening reads, e.g. "nudity.erotica (Required)". */
function unexpectedFields(answer: z.SafeParseReturnType<unknown, unknown>): string {
  if (answer.success) return 'none';
  return answer.error.issues.map(issue => `${issue.path.join('.') || '(root)'} (${issue.message})`).join(', ');
}

/**
 * Screens Images with Sightengine (https://sightengine.com/docs/reference).
 *
 * Category mapping:
 * - nudity: the explicit levels (sexual activity, sexual display, erotica) and very suggestive.
 *   Milder levels (swimwear, cleavage) are not nudity.
 * - weapons: firearms and knives. Toys and hand gestures are not weapons.
 * - hate: Nazi, Confederate, supremacist and terrorist symbols. Asian (religious) swastikas are not hate.
 * - offensive_gesture: the middle finger.
 * - gore and violence: each model's overall probability.
 * - offensive_text: the highest severity among text detections, in Portuguese and English.
 */
export class SightengineImageScreener implements ImageScreener {
  constructor(
    private apiUser: string,
    private apiSecret: string,
    private fetchImpl: typeof fetch = fetch
  ) {}

  async screen(webp: Uint8Array<ArrayBuffer>): Promise<Result<ScreeningScores, ScreeningFailure>> {
    const form = new FormData();
    form.set('media', new Blob([webp], { type: 'image/webp' }), 'image.webp');
    form.set('models', MODELS.join(','));
    form.set('opt_lang', 'pt,en');
    form.set('text_categories', TEXT_CATEGORIES.join(','));
    form.set('api_user', this.apiUser);
    form.set('api_secret', this.apiSecret);

    let response: Response;
    let body: unknown;
    try {
      response = await this.fetchImpl(ENDPOINT, { method: 'POST', body: form });
      body = await response.json();
    } catch (error) {
      return err({ reason: `Sightengine unreachable: ${error instanceof Error ? error.message : String(error)}`, partialScores: {} });
    }

    const answer = answerSchema.safeParse(body);
    if (!response.ok || !answer.success) {
      const failure = failureSchema.safeParse(body);
      const detail = failure.success ? failure.data.error.message : `unexpected answer (${unexpectedFields(answer)})`;
      return err({ reason: `Sightengine answered ${response.status}: ${detail}`, partialScores: {} });
    }

    const { nudity, weapon, offensive, gore, violence, text } = answer.data;
    return ok({
      nudity: Math.max(nudity.sexual_activity, nudity.sexual_display, nudity.erotica, nudity.very_suggestive),
      weapons: Math.max(weapon.classes.firearm, weapon.classes.knife),
      hate: Math.max(offensive.nazi, offensive.confederate, offensive.supremacist, offensive.terrorist),
      offensive_gesture: offensive.middle_finger,
      gore: gore.prob,
      violence: violence.prob,
      offensive_text: Array.isArray(text.detections) ? 0 : Math.max(0, ...Object.values(text.detections).map(detection => {
        const levels = [detection.severity, ...detection.details.map(d => d.severity)];
        return Math.max(...levels.map(level => level === undefined ? SEVERITY_SCORES.high : SEVERITY_SCORES[level]));
      }))
    });
  }
}
