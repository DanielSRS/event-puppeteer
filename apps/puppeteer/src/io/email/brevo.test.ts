import test from 'node:test';
import assert from 'node:assert/strict';
import { BrevoEmailSender } from './brevo.ts';

const message = { to: { email: 'jose@test.com', name: 'José' }, subject: 'Oi', html: '<p>Oi</p>', text: 'Oi' };

test('Brevo email sender', async (t) => {
  await t.test('posts the transactional email in Brevo\'s format', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ messageId: '<1@relay>' }), { status: 201 });
    }) as unknown as typeof fetch;

    await new BrevoEmailSender('key-123', { email: 'no-reply@app.com', name: 'App' }, fakeFetch).send(message);

    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, 'https://api.brevo.com/v3/smtp/email');
    assert.equal(calls[0]?.init.method, 'POST');
    assert.equal((calls[0]?.init.headers as Record<string, string>)['api-key'], 'key-123');
    assert.deepEqual(JSON.parse(calls[0]?.init.body as string), {
      sender: { email: 'no-reply@app.com', name: 'App' },
      to: [{ email: 'jose@test.com', name: 'José' }],
      subject: 'Oi',
      htmlContent: '<p>Oi</p>',
      textContent: 'Oi'
    });
  });

  await t.test('fails loudly when Brevo rejects the request', async () => {
    const fakeFetch = (async () => new Response('{"code":"unauthorized"}', { status: 401 })) as unknown as typeof fetch;
    const sender = new BrevoEmailSender('bad-key', { email: 'no-reply@app.com', name: 'App' }, fakeFetch);
    await assert.rejects(sender.send(message), /EMAIL_DELIVERY_FAILED: Brevo answered 401/);
  });

  const accountFetch = (senders: object[], domains: object[]) => (async (url: string) => {
    if (url.endsWith('/v3/senders')) return new Response(JSON.stringify({ senders }), { status: 200 });
    if (url.endsWith('/v3/senders/domains')) return new Response(JSON.stringify({ domains }), { status: 200 });
    return new Response('{}', { status: 404 });
  }) as unknown as typeof fetch;

  await t.test('sender check passes for an active sender', async () => {
    const sender = new BrevoEmailSender('k', { email: 'me@gmail.com', name: 'App' }, accountFetch([{ email: 'me@gmail.com', active: true }], []));
    assert.equal(await sender.checkSender(), null);
  });

  await t.test('sender check passes for any address on an authenticated domain', async () => {
    const sender = new BrevoEmailSender('k', { email: 'no-reply@uefs.br', name: 'App' }, accountFetch([], [{ domain_name: 'uefs.br', authenticated: true }]));
    assert.equal(await sender.checkSender(), null);
  });

  await t.test('sender check warns when Brevo would reject the sender', async () => {
    // Brevo accepts the API call (201) and only rejects delivery afterwards, so this is the only early signal
    const sender = new BrevoEmailSender('k', { email: 'no-reply@app.vercel.app', name: 'App' },
      accountFetch([{ email: 'me@gmail.com', active: true }], [{ domain_name: 'app.vercel.app', authenticated: false }]));
    assert.match(await sender.checkSender() ?? '', /no-reply@app\.vercel\.app.*me@gmail\.com/s);
  });
});
