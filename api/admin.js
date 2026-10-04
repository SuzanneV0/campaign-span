// The admin console's data API. Every request must come from a signed-in admin (see _lib.js).
//   GET  /api/admin                 → { me, envs, log, defaults }
//   GET  /api/admin?action=health   → { count, ms }
//   POST /api/admin { action: 'save', envs, deletes, defaults }
//   POST /api/admin { action: 'log', msg }
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
      const [envs, log, defaults] = await db.batch([
        'SELECT * FROM admin_environments ORDER BY updated_at DESC',
        'SELECT at, msg, actor FROM admin_log ORDER BY at DESC LIMIT 60',
        "SELECT value FROM admin_settings WHERE key = 'defaults'",
      ], 'read');
      return res.status(200).json({
        me,
        envs: envs.rows.map((r) => ({ ...r, cfg: parse(r.cfg, {}), steps: parse(r.steps, {}), opened: Number(r.opened) })),
        log: log.rows.map((r) => ({ at: r.at, msg: r.msg, actor: r.actor })),
        defaults: defaults.rows[0] ? parse(defaults.rows[0].value, null) : null,
      });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const body = typeof req.body === 'string' ? parse(req.body, {}) : req.body || {};

    if (body.action === 'log') {
      await db.execute({ sql: 'INSERT INTO admin_log (msg, actor) VALUES (?, ?)', args: [String(body.msg || '').slice(0, 500), me] });
      return res.status(200).json({ ok: true });
    }

    if (body.action === 'save') {
      const envs = Array.isArray(body.envs) ? body.envs.slice(0, 500) : [];
      const deletes = Array.isArray(body.deletes) ? body.deletes.map(String).slice(0, 500) : [];
      const statements = [
        ...envs.map((e) => ({
          sql: `INSERT INTO admin_environments (id, name, cfg, follow_up, notes, steps, opened, created_at, updated_at, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (id) DO UPDATE SET name = excluded.name, cfg = excluded.cfg, follow_up = excluded.follow_up,
                  notes = excluded.notes, steps = excluded.steps, opened = excluded.opened, updated_at = excluded.updated_at`,
          args: [String(e.id), String(e.name || '').slice(0, 120), json(e.cfg), e.follow_up || null, String(e.notes || ''),
                 json(e.steps || {}), Number(e.opened) || 0, String(e.created_at), String(e.updated_at), me],
        })),
        ...deletes.map((id) => ({ sql: 'DELETE FROM admin_environments WHERE id = ?', args: [id] })),
        body.defaults
          ? { sql: `INSERT INTO admin_settings (key, value) VALUES ('defaults', ?)
                    ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
              args: [json(body.defaults)] }
          : { sql: "DELETE FROM admin_settings WHERE key = 'defaults'", args: [] },
      ];
      await db.batch(statements, 'write');
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error('Admin API error:', error);
    return res.status(500).json({ error: 'The admin database couldn’t be reached. Try again in a moment.' });
  }
}
