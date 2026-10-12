import test from 'node:test';
import assert from 'node:assert/strict';
import { CombinedImageScreener } from './combined.ts';
import { InMemoryImageScreener } from './in-memory.ts';

const webp = new Uint8Array([1, 2, 3]);

function engine(scores: InMemoryImageScreener['scores'], failure: string | null = null) {
  const screener = new InMemoryImageScreener();
  screener.scores = scores;
  screener.failure = failure;
  return screener;
}

test('Combined image screener', async (t) => {
  await t.test('the most severe score of every engine wins, category by category', async () => {
    const primary = engine({ nudity: 0.1, hate: 0.9, weapons: 0.2 });
    const second = engine({ nudity: 0.6, violence: 0.4 });

    const result = await new CombinedImageScreener([primary, second]).screen(webp);

    assert.deepEqual(result, { ok: true, value: { nudity: 0.6, hate: 0.9, weapons: 0.2, violence: 0.4 } });
    assert.deepEqual(primary.screened, [webp]);
    assert.deepEqual(second.screened, [webp]);
  });

  await t.test('Screening cannot conclude when any engine fails', async () => {
    const result = await new CombinedImageScreener([engine({ nudity: 0 }), engine({}, 'OpenAI answered 500: boom')]).screen(webp);

    assert.deepEqual(result, { ok: false, error: 'OpenAI answered 500: boom' });
  });
});
