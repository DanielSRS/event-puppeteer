import test from 'node:test';
import assert from 'node:assert/strict';
import { CloudinaryImageStore } from './cloudinary.ts';

/**
 * Credentials and clock of Cloudinary's own signing examples (secret `abcd`, timestamp
 * 1315060510). The expected signatures below follow the algorithms those examples verify.
 */
const credentials = { cloudName: 'demo', apiKey: '1234', apiSecret: 'abcd' };
const now = () => new Date(1315060510 * 1000);
const webp = new Uint8Array([82, 73, 70, 70]);

function fetchAnswering(body: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fakeFetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { calls, fakeFetch };
}

test('Cloudinary image store', async (t) => {
  await t.test('uploads the Image as a signed, authenticated asset named after the Image, never overwriting', async () => {
    const { calls, fakeFetch } = fetchAnswering({ public_id: 'img-1', type: 'authenticated' });

    const result = await new CloudinaryImageStore(credentials, fakeFetch, now).storeRestricted('img-1', webp);

    assert.deepEqual(result, { ok: true, value: undefined });
    assert.equal(calls[0]?.url, 'https://api.cloudinary.com/v1_1/demo/image/upload');
    assert.equal(calls[0]?.init.method, 'POST');
    const form = calls[0]?.init.body;
    assert.ok(form instanceof FormData);
    assert.equal(form.get('public_id'), 'img-1');
    assert.equal(form.get('type'), 'authenticated');
    assert.equal(form.get('overwrite'), 'false');
    assert.equal(form.get('timestamp'), '1315060510');
    assert.equal(form.get('api_key'), '1234');
    assert.equal(form.get('signature'), '90181bc9101eb79f7bb7524ad56ddf0538143ab2');
    const file = form.get('file');
    assert.ok(file instanceof Blob);
    assert.equal(file.type, 'image/webp');
  });

  await t.test('a refused upload is a value naming the reason', async () => {
    const refused = fetchAnswering({ error: { message: 'Invalid Signature' } }, 401);
    assert.deepEqual(await new CloudinaryImageStore(credentials, refused.fakeFetch, now).storeRestricted('img-1', webp), {
      ok: false, error: 'Cloudinary answered 401: Invalid Signature'
    });

    const down = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    assert.deepEqual(await new CloudinaryImageStore(credentials, down, now).storeRestricted('img-1', webp), {
      ok: false, error: 'Cloudinary unreachable: fetch failed'
    });
  });

  await t.test('the public URL is a signed delivery URL of the authenticated asset', () => {
    const store = new CloudinaryImageStore(credentials, fetch, now);
    assert.equal(store.publicUrl('img-1'), 'https://res.cloudinary.com/demo/image/authenticated/s--3SNbPvsf--/img-1.webp');
  });

  await t.test('the signed URL is a private download URL expiring an hour later', () => {
    const store = new CloudinaryImageStore(credentials, fetch, now);
    const url = new URL(store.signedUrl('img-1'));

    assert.equal(url.origin + url.pathname, 'https://api.cloudinary.com/v1_1/demo/image/download');
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      api_key: '1234',
      expires_at: '1315064110',
      format: 'webp',
      public_id: 'img-1',
      signature: 'a8d29ea5a69e47a6dbcfb5e71f9e41bcc685d571',
      timestamp: '1315060510',
      type: 'authenticated'
    });
  });
});
