import test from 'node:test';
import assert from 'node:assert/strict';
import { SightengineImageScreener } from './sightengine.ts';

const webp = new Uint8Array([82, 73, 70, 70]);

/** A Sightengine answer for one Image, shaped as its docs describe each model's output. */
const ANSWER = {
  status: 'success',
  request: { id: 'req_1', timestamp: 1, operations: 6 },
  nudity: {
    sexual_activity: 0.01, sexual_display: 0.02, erotica: 0.4, very_suggestive: 0.1, suggestive: 0.9, mildly_suggestive: 0.9,
    suggestive_classes: { bikini: 0.9 }, none: 0.05, context: { sea_lake_pool: 0.9 }
  },
  weapon: { classes: { firearm: 0.2, firearm_gesture: 0.9, firearm_toy: 0.9, knife: 0.6 }, firearm_type: { animated: 0.01 }, firearm_action: {} },
  offensive: { nazi: 0.7, asian_swastika: 0.99, confederate: 0.01, supremacist: 0.02, terrorist: 0.01, middle_finger: 0.3 },
  gore: { prob: 0.12, classes: { very_bloody: 0.1 }, type: { real: 0.5 } },
  violence: { prob: 0.25, classes: { physical_violence: 0.25, firearm_threat: 0.01, combat_sport: 0.01 } },
  text: {
    language: 'pt',
    detected_categories: ['insult'],
    detections: { insult: { severity: 'medium', details: [{ match: 'idiota', severity: 'medium' }] } }
  },
  media: { id: 'med_1', uri: 'image.webp' }
};

function fetchAnswering(body: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { calls, fakeFetch };
}

test('Sightengine image screener', async (t) => {
  await t.test("posts the Image with every model Screening needs, in Sightengine's multipart format", async () => {
    const { calls, fakeFetch } = fetchAnswering(ANSWER);

    await new SightengineImageScreener('user-1', 'secret-1', fakeFetch).screen(webp);

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, 'https://api.sightengine.com/1.0/check.json');
    assert.equal(calls[0]?.init.method, 'POST');
    const form = calls[0]?.init.body;
    assert.ok(form instanceof FormData);
    assert.equal(form.get('api_user'), 'user-1');
    assert.equal(form.get('api_secret'), 'secret-1');
    assert.equal(form.get('models'), 'nudity-2.1,weapon,offensive-2.0,gore-2.0,violence,text-content-2.0');
    assert.equal(form.get('opt_lang'), 'pt,en');
    assert.equal(form.get('text_categories'), 'sexual,insult,discriminatory,inappropriate,extremism,violence,self_harm');
    const media = form.get('media');
    assert.ok(media instanceof Blob);
    assert.equal(media.type, 'image/webp');
  });

  await t.test("maps Sightengine's classes onto the Screening categories", async () => {
    const { fakeFetch } = fetchAnswering(ANSWER);

    const result = await new SightengineImageScreener('u', 's', fakeFetch).screen(webp);

    assert.deepEqual(result, {
      ok: true,
      value: {
        nudity: 0.4,
        weapons: 0.6,
        hate: 0.7,
        offensive_gesture: 0.3,
        gore: 0.12,
        violence: 0.25,
        offensive_text: 0.65
      }
    });
  });

  await t.test('scores text with no detection as clean, and a detection without severity as high', async () => {
    const clean = fetchAnswering({ ...ANSWER, text: { language: 'pt', detected_categories: [], detections: {} } });
    const cleanResult = await new SightengineImageScreener('u', 's', clean.fakeFetch).screen(webp);
    assert.equal(cleanResult.ok && cleanResult.value.offensive_text, 0);

    const unrated = fetchAnswering({ ...ANSWER, text: { language: 'pt', detected_categories: ['extremism'], detections: { extremism: { details: [{ match: 'x' }] } } } });
    const unratedResult = await new SightengineImageScreener('u', 's', unrated.fakeFetch).screen(webp);
    assert.equal(unratedResult.ok && unratedResult.value.offensive_text, 0.95);
  });

  await t.test('a Sightengine failure is a value naming the reason', async () => {
    const refused = fetchAnswering({ status: 'failure', error: { type: 'usage_limit', code: 32, message: 'Daily usage limit reached' } }, 429);
    assert.deepEqual(await new SightengineImageScreener('u', 's', refused.fakeFetch).screen(webp), {
      ok: false, error: { reason: 'Sightengine answered 429: Daily usage limit reached', partialScores: {} }
    });

    const garbled = fetchAnswering({ status: 'success' });
    const garbledResult = await new SightengineImageScreener('u', 's', garbled.fakeFetch).screen(webp);
    assert.equal(garbledResult.ok, false);

    const down = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    assert.deepEqual(await new SightengineImageScreener('u', 's', down).screen(webp), {
      ok: false, error: { reason: 'Sightengine unreachable: fetch failed', partialScores: {} }
    });
  });
});
