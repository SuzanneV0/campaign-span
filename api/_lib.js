// Shared helpers for the site's API (Vercel Functions): the admin console and the waitlist. Files starting with "_" aren't routes.
//
// Settings (Vercel → Settings → Environment Variables):
//   TURSO_DATABASE_URL, TURSO_AUTH_TOKEN   the admin database
//   CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY the Clerk app that admins sign in with
//   ADMIN_EMAILS                          comma-separated emails allowed into the console
import { createClient } from '@libsql/client';
import { createClerkClient, verifyToken } from '@clerk/backend';

let db = null;
let schemaReady = null;

// Created on first use, so a fresh database needs no setup step.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS admin_environments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) <= 120),
  cfg TEXT NOT NULL,
  follow_up TEXT,
  notes TEXT NOT NULL DEFAULT '',
  steps TEXT NOT NULL DEFAULT '{}',
  opened INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT
);
CREATE TABLE IF NOT EXISTS admin_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  msg TEXT NOT NULL CHECK (length(msg) <= 500),
  actor TEXT
);
CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS waitlist (
  email TEXT PRIMARY KEY CHECK (length(email) <= 254),
  name TEXT NOT NULL DEFAULT '' CHECK (length(name) <= 80),
  company TEXT NOT NULL DEFAULT '' CHECK (length(company) <= 80),
  dept TEXT NOT NULL DEFAULT '',
  team_size TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);`;

export async function database() {
  if (!db) {
    if (!process.env.TURSO_DATABASE_URL) throw new Error('TURSO_DATABASE_URL is not set');
    db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  }
  if (!schemaReady) schemaReady = db.executeMultiple(SCHEMA).catch((e) => { schemaReady = null; throw e; });
  await schemaReady;
  return db;
}

const clerk = () => createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

/**
 * Returns the signed-in admin's email, or sends a 401/403 and returns null.
 * The browser sends its Clerk session token; we verify it, look up the user's verified emails
 * and check them against ADMIN_EMAILS.
 */
export async function requireAdmin(req, res) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) { res.status(401).json({ error: 'Please sign in.' }); return null; }

  let userId;
  try {
    ({ sub: userId } = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY }));
  } catch {
    res.status(401).json({ error: 'Your session has expired. Sign in again.' });
    return null;
  }

  const allowed = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const user = await clerk().users.getUser(userId);
  const email = user.emailAddresses
    .filter((e) => e.verification?.status === 'verified')
    .map((e) => e.emailAddress.toLowerCase())
    .find((e) => allowed.includes(e));

  if (!email) {
    const primary = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress || '';
    res.status(403).json({ error: 'no-admin-access', email: primary });
    return null;
  }
  return email;
}
