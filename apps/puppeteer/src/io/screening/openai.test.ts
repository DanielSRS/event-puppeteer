import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIImageScreener } from './openai.ts';

const webp = new Uint8Array([82, 73, 70, 70]);

/** An omni-moderation answer for one image, shaped as OpenAI's moderation guide shows it. */
const ANSWER = {
  id: 'modr-1',
  model: 'omni-moderation-latest',
  results: [{
    flagged: true,
    categories: {},
    category_scores: {
      sexual: 0.2, 'sexual/minors': 0, harassment: 0, 'harassment/threatening': 0, hate: 0, 'hate/threatening': 0,
      illicit: 0, 'illicit/violent': 0, 'self-harm': 0.1, 'self-harm/intent': 0.5, 'self-harm/instructions': 0,
      violence: 0.3, 'violence/graphic': 0.7
    },
    category_applied_input_types: {
      sexual: ['image'], 'sexual/minors': [], harassment: [], 'harassment/threatening': [], hate: [], 'hate/threatening': [],
      illicit: [], 'illicit/violent': [], 'self-harm': ['image'], 'self-harm/intent': ['image'], 'self-harm/instructions': ['image'],
      violence: ['image'], 'violence/graphic': ['image']
    }
  }]
};

function fetchAnswering(body: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { calls, fakeFetch };
}

test('OpenAI image screener', async (t) => {
  await t.test('posts the Image as a data URL to omni-moderation', async () => {
    const { calls, fakeFetch } = fetchAnswering(ANSWER);

    await new OpenAIImageScreener('sk-1', fakeFetch).screen(webp);

    assert.equal(calls[0]?.url, 'https://api.openai.com/v1/moderations');
    assert.equal(calls[0]?.init.method, 'POST');
    const headers = calls[0]?.init.headers as Record<string, string>;
    assert.equal(headers.authorization, 'Bearer sk-1');
    assert.equal(headers['content-type'], 'application/json');
    assert.deepEqual(JSON.parse(calls[0]?.init.body as string), {
      model: 'omni-moderation-latest',
      input: [{ type: 'image_url', image_url: { url: 'data:image/webp;base64,UklGRg==' } }]
    });
  });

  await t.test('maps the image categories onto Screening categories, ignoring text-only ones', async () => {
    const { fakeFetch } = fetchAnswering(ANSWER);

    const result = await new OpenAIImageScreener('k', fakeFetch).screen(webp);

    assert.deepEqual(result, { ok: true, value: { nudity: 0.2, gore: 0.7, violence: 0.5 } });
  });

  await t.test('leaves out a category whose score did not come from the image', async () => {
    const textOnly = structuredClone(ANSWER);
    const result0 = textOnly.results[0];
    assert.ok(result0);
    result0.category_applied_input_types['violence/graphic'] = [];
    const { fakeFetch } = fetchAnswering(textOnly);

    const result = await new OpenAIImageScreener('k', fakeFetch).screen(webp);

    assert.deepEqual(result, { ok: true, value: { nudity: 0.2, violence: 0.5 } });
  });

  await t.test('an OpenAI failure is a value naming the reason', async () => {
    const refused = fetchAnswering({ error: { message: 'Incorrect API key provided' } }, 401);
    assert.deepEqual(await new OpenAIImageScreener('bad', refused.fakeFetch).screen(webp), {
      ok: false, error: 'OpenAI answered 401: Incorrect API key provided'
    });

    const down = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    assert.deepEqual(await new OpenAIImageScreener('k', down).screen(webp), { ok: false, error: 'OpenAI unreachable: fetch failed' });
  });
});
