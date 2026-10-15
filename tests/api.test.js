// The API against a throwaway local database, with Clerk stubbed out.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.TURSO_DATABASE_URL = 'file:' + join(mkdtempSync(join(tmpdir(), 'cs-api-')), 'test.db');
process.env.ADMIN_EMAILS = 'admin@example.test';

mock.module('@clerk/backend', { namedExports: {
  verifyToken: async (token) => { if (token !== 'good') throw new Error('bad token'); return { sub: 'user_1' }; },
  createClerkClient: () => ({ users: { getUser: async () => ({
    primaryEmailAddressId: 'e1', emailAddresses: [{ id: 'e1', emailAddress: 'admin@example.test', verification: { status: 'verified' } }],
  }) } }),
} });

const { default: admin } = await import('../api/admin.js');
const { default: waitlist } = await import('../api/waitlist.js');

function call(handler, { method = 'POST', body, query = {}, token = 'good' } = {}) {
  return new Promise((resolve, reject) => {
    const res = { setHeader() {}, status(c) { this.code = c; return this; }, json(v) { resolve({ code: this.code, body: v }); } };
    Promise.resolve(handler({ method, body, query, headers: token ? { authorization: 'Bearer ' + token } : {} }, res)).catch(reject);
  });
}
const env = (id, name, updated) => ({ id, name, cfg: {}, created_at: '2026-01-01T00:00:00.000Z', updated_at: updated });

test('admin API turns away requests without a valid session', async () => {
  assert.equal((await call(admin, { method: 'GET', token: '' })).code, 401);
  assert.equal((await call(admin, { method: 'GET', token: 'nope' })).code, 401);
});

test('saving an older copy of an environment keeps the newer one', async () => {
  assert.deepEqual((await call(admin, { body: { action: 'save', envs: [env('e1', 'first', '2026-10-01T00:00:00.000Z')], defaults: { a: 1 } } })).body, { ok: true, stale: [] });
  assert.deepEqual((await call(admin, { body: { action: 'save', envs: [env('e1', 'newer', '2026-10-02T00:00:00.000Z')] } })).body, { ok: true, stale: [] });
  assert.deepEqual((await call(admin, { body: { action: 'save', envs: [env('e1', 'stale', '2026-10-01T12:00:00.000Z')] } })).body, { ok: true, stale: ['e1'] });
  const { body } = await call(admin, { method: 'GET' });
  assert.equal(body.envs[0].name, 'newer');
  assert.deepEqual(body.defaults, { a: 1 }, 'a save without defaults leaves them alone');
});

test('waitlist accepts sign-ups, ignores repeats and bots, and admins can read and remove them', async () => {
  assert.equal((await call(waitlist, { method: 'GET' })).code, 405);
  assert.equal((await call(waitlist, { body: { email: 'not-an-email' } })).code, 400);
  assert.equal((await call(waitlist, { body: { name: 'Ana', email: 'Ana@Example.test', dept: 'Sales', teamSize: '6–25', company: 'Acme' } })).code, 200);
  assert.equal((await call(waitlist, { body: { name: 'Again', email: 'ana@example.test' } })).code, 200);
  assert.equal((await call(waitlist, { body: { email: 'bot@example.test', website: 'spam.example' } })).code, 200);
  assert.equal((await call(waitlist, { body: JSON.stringify({ email: 'raw@example.test', dept: 'Made up' }) })).code, 200);

  let { body } = await call(admin, { method: 'GET' });
  assert.deepEqual(body.waitlist.map((w) => w.email).sort(), ['ana@example.test', 'raw@example.test']);
  const ana = body.waitlist.find((w) => w.email === 'ana@example.test');
  assert.equal(ana.name, 'Ana', 'a repeat sign-up does not overwrite the first');
  assert.equal(ana.teamSize, '6–25');
  assert.equal(body.waitlist.find((w) => w.email === 'raw@example.test').dept, '');

  await call(admin, { body: { action: 'waitlist-remove', email: 'ANA@example.test' } });
  ({ body } = await call(admin, { method: 'GET' }));
  assert.deepEqual(body.waitlist.map((w) => w.email), ['raw@example.test']);
});
