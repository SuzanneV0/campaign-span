// The admin console's data API. Every request must come from a signed-in admin (see _lib.js).
//   GET  /api/admin                 → { me, envs, log, defaults, waitlist }
//   GET  /api/admin?action=health   → { count, ms }
//   POST /api/admin { action: 'save', envs, deletes, defaults? } → { ok, stale }
//        envs holds only the changed environments. One whose stored copy is newer than the one sent
//        (another admin saved it since) is left alone and listed in `stale`. Omit defaults to leave them.
//   POST /api/admin { action: 'log', msg }
//   POST /api/admin { action: 'waitlist-remove', email }
import { database, requireAdmin } from './_lib.js';

const json = (v) => JSON.stringify(v ?? null);
const parse = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const me = await requireAdmin(req, res);
  if (!me) return;

  try {
    const db = await database();

    if (req.method === 'GET' && req.query.action === 'health') {
      const t0 = Date.now();
      const { rows } = await db.execute('SELECT COUNT(*) AS n FROM admin_environments');
      return res.status(200).json({ count: Number(rows[0].n), ms: Date.now() - t0 });
    }

    if (req.method === 'GET') {
      const [envs, log, defaults, waitlist] = await db.batch([
        'SELECT * FROM admin_environments ORDER BY updated_at DESC',
        'SELECT at, msg, actor FROM admin_log ORDER BY at DESC LIMIT 60',
        "SELECT value FROM admin_settings WHERE key = 'defaults'",
        'SELECT email, name, company, dept, team_size, created_at FROM waitlist ORDER BY created_at DESC LIMIT 5000',
      ], 'read');
      return res.status(200).json({
        me,
        envs: envs.rows.map((r) => ({ ...r, cfg: parse(r.cfg, {}), steps: parse(r.steps, {}), opened: Number(r.opened) })),
        log: log.rows.map((r) => ({ at: r.at, msg: r.msg, actor: r.actor })),
        defaults: defaults.rows[0] ? parse(defaults.rows[0].value, null) : null,
        waitlist: waitlist.rows.map((r) => ({ email: r.email, name: r.name, company: r.company, dept: r.dept, teamSize: r.team_size, at: r.created_at })),
      });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const body = typeof req.body === 'string' ? parse(req.body, {}) : req.body || {};

    if (body.action === 'log') {
      await db.execute({ sql: 'INSERT INTO admin_log (msg, actor) VALUES (?, ?)', args: [String(body.msg || '').slice(0, 500), me] });
      return res.status(200).json({ ok: true });
    }

    if (body.action === 'waitlist-remove') {
      await db.execute({ sql: 'DELETE FROM waitlist WHERE email = ?', args: [String(body.email || '').toLowerCase()] });
      return res.status(200).json({ ok: true });
    }

    if (body.action === 'save') {
      const envs = Array.isArray(body.envs) ? body.envs.slice(0, 500) : [];
      const deletes = Array.isArray(body.deletes) ? body.deletes.map(String).slice(0, 500) : [];
      const stale = [];
      if (envs.length) {
        const { rows } = await db.execute({
          sql: `SELECT id, updated_at FROM admin_environments WHERE id IN (${envs.map(() => '?').join(', ')})`,
          args: envs.map((e) => String(e.id)),
        });
        const stored = new Map(rows.map((r) => [r.id, r.updated_at]));
        for (const e of envs) if (stored.has(String(e.id)) && stored.get(String(e.id)) > String(e.updated_at)) stale.push(String(e.id));
      }
      const statements = [
        ...envs.filter((e) => !stale.includes(String(e.id))).map((e) => ({
          sql: `INSERT INTO admin_environments (id, name, cfg, follow_up, notes, steps, opened, created_at, updated_at, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (id) DO UPDATE SET name = excluded.name, cfg = excluded.cfg, follow_up = excluded.follow_up,
                  notes = excluded.notes, steps = excluded.steps, opened = excluded.opened, updated_at = excluded.updated_at
                WHERE excluded.updated_at >= admin_environments.updated_at`,
          args: [String(e.id), String(e.name || '').slice(0, 120), json(e.cfg), e.follow_up || null, String(e.notes || ''),
                 json(e.steps || {}), Number(e.opened) || 0, String(e.created_at), String(e.updated_at), me],
        })),
        ...deletes.map((id) => ({ sql: 'DELETE FROM admin_environments WHERE id = ?', args: [id] })),
        !('defaults' in body) ? null
          : body.defaults
          ? { sql: `INSERT INTO admin_settings (key, value) VALUES ('defaults', ?)
                    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
              args: [json(body.defaults)] }
          : { sql: "DELETE FROM admin_settings WHERE key = 'defaults'", args: [] },
      ].filter(Boolean);
      if (statements.length) await db.batch(statements, 'write');
      return res.status(200).json({ ok: true, stale });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('Admin API error:', error);
    return res.status(500).json({ error: 'The admin database couldn’t be reached. Try again in a moment.' });
  }
}
