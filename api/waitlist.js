// Public early-access waitlist. Anyone can join; only admins can read it (see admin.js).
//   POST /api/waitlist { name, email, company, dept, teamSize, website } → { ok }
// `website` is a honeypot: people never see it, so a filled-in value means a bot.
// The reply is the same whether or not the email was already on the list, so it can't be used to check who signed up.
import { database } from './_lib.js';

export const DEPTS = ['Production', 'Social media', 'Brand services', 'Sales', 'Marketing', 'Other'];
export const TEAM_SIZES = ['1–5', '6–25', '26–100', '100+'];
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

  try {
    const db = await database();
    await db.execute({ sql: 'INSERT INTO waitlist (email, name, company, dept, team_size) VALUES (?, ?, ?, ?, ?) ON CONFLICT (email) DO NOTHING', args: entry });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Waitlist error:', error);
    return res.status(500).json({ error: 'We couldn’t save that just now. Try again in a moment.' });
  }
}
