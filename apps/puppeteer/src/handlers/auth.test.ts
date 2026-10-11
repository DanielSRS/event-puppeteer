import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHandler, loginHandler, meHandler, verifyEmailHandler, resendVerificationHandler, requestPasswordResetHandler, resetPasswordHandler } from './auth.ts';
import { removeUserHandler } from './users.ts';
import { createInMemoryIO } from '../io/in-memory.ts';
import { organizationOf } from '../types/user.ts';
import { registerVerified, verificationTokenFor } from '../test-support.ts';

async function setup() {
  const io = await createInMemoryIO();
  const org = await io.orgRepo.create({ name: 'Org', slug: 'org', shadowBanThreshold: 5, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  return { io, orgId: org.id };
}

const body = { firstName: 'José', lastName: 'Silva', email: 'jose@test.com', password: 'password123' };

test('Auth Handlers', async (t) => {
  await t.test('register user places them in correct org with Member role', async () => {
    const { io, orgId } = await setup();
    const { user } = await registerHandler(body, orgId, io);

    assert.equal(user.role, 'Member');
    assert.equal(organizationOf(user), orgId);
    assert.equal(user.normalizedName, 'jose silva');
  });

  await t.test('register sends a verification email with a link to the API', async () => {
    const { io, orgId } = await setup();
    await registerHandler(body, orgId, io);

    assert.equal(io.emailSender.sent.length, 1);
    const [message] = io.emailSender.sent;
    assert.equal(message?.to.email, body.email);
    assert.match(message?.text ?? '', /http:\/\/localhost:8080\/auth\/verify-email\?token=/);
    assert.match(message?.html ?? '', /José Silva/);
  });

  await t.test('login is blocked until the email is verified', async () => {
    const { io, orgId } = await setup();
    await registerHandler(body, orgId, io);

    await assert.rejects(loginHandler({ email: body.email, password: body.password }, io), /EMAIL_NOT_VERIFIED/);

    assert.deepEqual(await verifyEmailHandler(verificationTokenFor(io, body.email), io), { verified: true });
    const session = await loginHandler({ email: body.email, password: body.password }, io);
    assert.ok(session.token);
  });

  await t.test('an invalid verification token verifies nothing', async () => {
    const { io, orgId } = await setup();
    await registerHandler(body, orgId, io);

    assert.deepEqual(await verifyEmailHandler('not-a-token', io), { verified: false });
    await assert.rejects(loginHandler({ email: body.email, password: body.password }, io), /EMAIL_NOT_VERIFIED/);
  });

  await t.test('resending sends a new link only to unverified accounts', async () => {
    const { io, orgId } = await setup();
    await registerHandler(body, orgId, io);

    assert.deepEqual(await resendVerificationHandler({ email: body.email }, io), { success: true });
    assert.equal(io.emailSender.sent.length, 2);

    // Unknown address: same answer, nothing sent
    assert.deepEqual(await resendVerificationHandler({ email: 'nobody@test.com' }, io), { success: true });
    assert.equal(io.emailSender.sent.length, 2);

    await verifyEmailHandler(verificationTokenFor(io, body.email), io);
    await resendVerificationHandler({ email: body.email }, io);
    assert.equal(io.emailSender.sent.length, 2);
  });

  await t.test('registering into an unknown Organization fails before creating anything', async () => {
    const { io } = await setup();
    await assert.rejects(registerHandler(body, 'default-org', io), /ORGANIZATION_NOT_FOUND/);
    assert.equal(await io.userRepo.getByEmail(body.email), null);
    assert.equal(io.emailSender.sent.length, 0);
  });

  await t.test('password shorter than 8 characters is rejected', async () => {
    const { io, orgId } = await setup();
    await assert.rejects(registerHandler({ ...body, password: '1234567' }, orgId, io), /SIGNUP_FAILED/);
  });

  await t.test('login with wrong credentials fails', async () => {
    const { io, orgId } = await setup();
    await registerVerified(body, orgId, io);

    await assert.rejects(loginHandler({ email: body.email, password: 'wrong-password' }, io), /INVALID_CREDENTIALS/);
  });

  await t.test('meHandler returns current user', async () => {
    const { io, orgId } = await setup();
    const { token, user } = await registerVerified(body, orgId, io);

    const req = new Request('http://localhost/', { headers: { authorization: `Bearer ${token}` } });
    const me = await meHandler(req, io);
    assert.equal(me.id, user.id);
  });

  /** Token of the latest password-reset email sent to `email` (the link points at the frontend). */
  const resetTokenFor = (io: Awaited<ReturnType<typeof createInMemoryIO>>, email: string) => {
    const message = io.emailSender.sent.findLast(m => m.to.email === email && m.subject === 'Redefinir sua senha');
    const link = message?.text.match(/http:\/\/localhost:3000\/redefinir-senha\?token=(\S+)/);
    if (!link) throw new Error(`No password reset email for ${email}`);
    return decodeURIComponent(link[1]!);
  };

  await t.test('a forgotten password is reset through the emailed link; old password and sessions stop working', async () => {
    const { io, orgId } = await setup();
    const { token: oldSession } = await registerVerified(body, orgId, io);

    assert.deepEqual(await requestPasswordResetHandler({ email: body.email }, io), { success: true });
    const token = resetTokenFor(io, body.email);

    assert.deepEqual(await resetPasswordHandler({ token, password: 'new-password-1' }, io), { success: true });
    await assert.rejects(loginHandler({ email: body.email, password: body.password }, io), /INVALID_CREDENTIALS/);
    assert.ok((await loginHandler({ email: body.email, password: 'new-password-1' }, io)).token);
    await assert.rejects(meHandler(new Request('http://localhost/', { headers: { authorization: `Bearer ${oldSession}` } }), io), /UNAUTHORIZED/);

    await assert.rejects(resetPasswordHandler({ token, password: 'another-pass-2' }, io), /INVALID_RESET_TOKEN/);
  });

  await t.test('asking to reset an unknown email answers the same and sends nothing', async () => {
    const { io } = await setup();
    assert.deepEqual(await requestPasswordResetHandler({ email: 'nobody@test.com' }, io), { success: true });
    assert.equal(io.emailSender.sent.length, 0);
  });

  await t.test('an invalid reset token changes nothing', async () => {
    const { io, orgId } = await setup();
    await registerVerified(body, orgId, io);
    await assert.rejects(resetPasswordHandler({ token: 'not-a-token', password: 'new-password-1' }, io), /INVALID_RESET_TOKEN/);
    assert.ok((await loginHandler({ email: body.email, password: body.password }, io)).token);
  });

  await t.test('a removed account gets no reset email and cannot log in again through a reset', async () => {
    const { io, orgId } = await setup();
    const { user } = await registerVerified(body, orgId, io);
    const admin = await registerVerified({ firstName: 'Ana', lastName: 'Admin', email: 'ana@test.com', password: 'password123' }, orgId, io);
    await io.userRepo.update(admin.user.id, { role: 'Admin' });

    await requestPasswordResetHandler({ email: body.email }, io);
    const tokenBeforeRemoval = resetTokenFor(io, body.email);
    await removeUserHandler(new Request('http://localhost/', { headers: { authorization: `Bearer ${admin.token}` } }), orgId, user.id, io);

    const sentBefore = io.emailSender.sent.length;
    assert.deepEqual(await requestPasswordResetHandler({ email: body.email }, io), { success: true });
    assert.equal(io.emailSender.sent.length, sentBefore);

    await assert.rejects(resetPasswordHandler({ token: tokenBeforeRemoval, password: 'new-password-1' }, io), /INVALID_RESET_TOKEN/);
    await assert.rejects(loginHandler({ email: body.email, password: 'new-password-1' }, io), /INVALID_CREDENTIALS/);
  });
});
