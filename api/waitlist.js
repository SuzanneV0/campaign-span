// Public early-access waitlist. Anyone can join; only admins can read it (see admin.js).
//   POST /api/waitlist { name, email, company, dept, teamSize, website } → { ok }
// `website` is a honeypot: people never see it, so a filled-in value means a bot.
// The reply is the same whether or not the email was already on the list, so it can't be used to check who signed up.
import { createHash } from 'node:crypto';
import { database } from './_lib.js';

export const DEPTS = ['Production', 'Social media', 'Brand services', 'Sales', 'Marketing', 'Other'];
export const TEAM_SIZES = ['1–5', '6–25', '26–100', '100+'];
// Safeguards on a public endpoint that writes to the database: signups per address per hour, and a ceiling on the list.
const MAX_PER_IP_PER_HOUR = 10;
const MAX_WAITLIST_ROWS = Number(process.env.WAITLIST_MAX_ROWS) || 10000;
const HOUR_MS = 60 * 60 * 1000;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body || {};
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (body.website) return res.status(200).json({ ok: true });

  const email = clean(body.email, 254).toLowerCase();
  if (!EMAIL.test(email)) return res.status(400).json({ error: 'Enter a valid work email.' });
  const entry = [
    email,
    clean(body.name, 80),
    clean(body.company, 80),
    DEPTS.includes(body.dept) ? body.dept : '',
    TEAM_SIZES.includes(body.teamSize) ? body.teamSize : '',
  ];

  const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 32);

  try {
    const db = await database();
    const now = Date.now();
    const [, allowed] = await db.batch([
      { sql: 'DELETE FROM waitlist_attempts WHERE at < ?', args: [now - HOUR_MS] },
      { sql: `INSERT INTO waitlist_attempts (ip_hash, at)
              SELECT ?, ? WHERE (SELECT COUNT(*) FROM waitlist_attempts WHERE ip_hash = ?) < ?`, args: [ipHash, now, ipHash, MAX_PER_IP_PER_HOUR] },
    ], 'write');
    if (!allowed.rowsAffected) return res.status(429).json({ error: 'Too many requests. Try again later.' });
    const total = Number((await db.execute('SELECT COUNT(*) FROM waitlist')).rows[0][0]);
    if (total >= MAX_WAITLIST_ROWS) return res.status(503).json({ error: 'The waitlist is full right now. Please check back later.' });
    await db.execute({ sql: 'INSERT INTO waitlist (email, name, company, dept, team_size) VALUES (?, ?, ?, ?, ?) ON CONFLICT (email) DO NOTHING', args: entry });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Waitlist error:', error);
    return res.status(500).json({ error: 'We couldn’t save that just now. Try again in a moment.' });
  }
}
