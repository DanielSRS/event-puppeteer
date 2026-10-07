import test from 'node:test';
import assert from 'node:assert/strict';
import { createInMemoryDatabase } from './index.ts';
import { organization, user } from './schema.ts';

// The database itself rejects users whose role and Organization disagree,
// whatever code path writes them
test('user_role_organization check', async (t) => {
  const db = await createInMemoryDatabase();
  const now = new Date();
  await db.insert(organization).values({ id: 'org', name: 'Org', slug: 'org', createdAt: now, updatedAt: now });
  let n = 0;
  const insert = (role: string, organizationId: string | null) =>
    db.insert(user).values({ id: `u${++n}`, name: 'U', email: `u${n}@a.com`, emailVerified: false, createdAt: now, updatedAt: now, role, organizationId });
  const violatesCheck = (e: any) => /user_role_organization/.test(`${e?.message} ${e?.cause?.message}`);

  await t.test('accepts a Superadmin without Organization', async () => {
    await insert('Superadmin', null);
  });

  await t.test('accepts other roles with an Organization', async () => {
    for (const role of ['Admin', 'Moderator', 'Member']) await insert(role, 'org');
  });

  await t.test('rejects a Superadmin with an Organization', async () => {
    await assert.rejects(insert('Superadmin', 'org'), violatesCheck);
  });

  await t.test('rejects other roles without an Organization', async () => {
    for (const role of ['Admin', 'Moderator', 'Member']) await assert.rejects(insert(role, null), violatesCheck);
  });
});
