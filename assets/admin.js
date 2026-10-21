/* Campaign Span — admin console.
   Builds custom demo and onboarding environments, tracks onboarding, runs health checks.
   Admins sign in with Clerk. Data lives in a Turso database behind /api/admin (Vercel Functions), which checks
   the Clerk session and the ADMIN_EMAILS list on every request, so the browser never touches the database. */
(function () {
  'use strict';

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function when(ts) { return new Date(ts).toLocaleString('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  function day(d) { return d ? new Date(d + 'T00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  var E = window.CSEnv;
  var STEPS = [
    'Kickoff call held', 'Social and email channels connected', 'Team invited', 'Department roles assigned',
    'Notification channels set (app, email, Slack)', 'Existing content calendar imported', 'First production project created',
    'First report exported for stakeholders', 'Handed over to customer success'
  ];
  var PURPOSE = { sales: 'Sales demo', onboarding: 'Client onboarding' };
  var DATA_LABEL = { full: 'Full history', light: 'Light', empty: 'Empty' };

  // ---------- Clerk + admin API ----------
  var clerk = null;
  function api(method, body, query) {
    return clerk.session.getToken().then(function (token) {
      return fetch('/api/admin' + (query || ''), {
        method: method,
        headers: Object.assign({ Authorization: 'Bearer ' + token }, body ? { 'Content-Type': 'application/json' } : {}),
        body: body ? JSON.stringify(body) : undefined
      });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) { var e = new Error(data.error || ('Request failed (' + r.status + ')')); e.status = r.status; e.data = data; throw e; }
        return data;
      });
    });
  }
  var me = null; // signed-in admin's email

  // ---------- storage ----------
  var store = { envs: [], log: [], defaults: null, waitlist: [] };
  var storageOk = true;
  try { localStorage.setItem('cs-check', '1'); localStorage.removeItem('cs-check'); } catch (e) { storageOk = false; }
  var pendingDeletes = [], saveTimer = null, saving = Promise.resolve();
  // What the server last confirmed, so a save only sends what changed and can't overwrite
  // another admin's edits to environments this admin didn't touch.
  var synced = {}, syncedDefaults = 'null';

  function toRow(e) {
    return { id: e.id, name: e.name, cfg: e.cfg, follow_up: e.followUp || null, notes: e.notes || '', steps: e.steps || {}, opened: e.opened || 0,
      created_at: new Date(e.created || Date.now()).toISOString(), updated_at: new Date(e.updated || Date.now()).toISOString() };
  }
  function fromRow(r) {
    return { id: r.id, name: r.name, cfg: E.normalize(r.cfg), followUp: r.follow_up || '', notes: r.notes || '', steps: r.steps || {}, opened: r.opened || 0,
      created: Date.parse(r.created_at), updated: Date.parse(r.updated_at) };
  }
  function load() {
    return api('GET').then(function (data) {
      me = data.me;
      store.envs = data.envs.map(fromRow);
      store.log = data.log.map(function (l) { return { at: Date.parse(l.at), msg: l.msg, actor: l.actor }; });
      store.defaults = data.defaults;
      store.waitlist = data.waitlist || [];
      synced = {};
      data.envs.forEach(function (r, i) { synced[r.id] = JSON.stringify(toRow(store.envs[i])); });
      syncedDefaults = JSON.stringify(store.defaults);
    });
  }
  // Writes are batched: every change calls save(), which sends the changed environments shortly after.
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 250); }
  function flush() {
    if (!me) return;
    var rows = store.envs.map(toRow).filter(function (r) { return synced[r.id] !== JSON.stringify(r); });
    var deletes = pendingDeletes.splice(0);
    var defaults = JSON.stringify(store.defaults);
    if (!rows.length && !deletes.length && defaults === syncedDefaults) return saving;
    var body = { action: 'save', envs: rows, deletes: deletes };
    if (defaults !== syncedDefaults) body.defaults = store.defaults;
    saving = api('POST', body).then(function (res) {
      rows.forEach(function (r) { synced[r.id] = JSON.stringify(r); });
      deletes.forEach(function (id) { delete synced[id]; });
      syncedDefaults = defaults;
      if (res.stale && res.stale.length) {
        toast('Another admin changed this too', 'Their newer version was kept. Reload to see it.');
      }
    }).catch(function (err) {
      pendingDeletes.push.apply(pendingDeletes, deletes);
      toast('Couldn\u2019t save changes', err.message + ' Check your connection and try again.');
    });
    return saving;
  }
  function log(msg) {
    store.log.unshift({ at: Date.now(), msg: msg, actor: me });
    store.log = store.log.slice(0, 60);
    if (me) api('POST', { action: 'log', msg: String(msg).slice(0, 500) }).catch(function () {});
    save();
  }
  function defaults() { return E.normalize(store.defaults || E.DEFAULT); }
  function logLine(l) { return '<div><time>' + when(l.at) + '</time><span>' + esc(l.msg) + (l.actor ? ' <small class="muted">\u00b7 ' + esc(l.actor) + '</small>' : '') + '</span></div>'; }

  function envById(id) { return store.envs.find(function (e) { return e.id === id; }); }
  function linkFor(cfg) { return new URL('demo.html?env=' + E.encode(cfg), location.href).href; }
  function progress(env) { var s = env.steps || {}; return STEPS.filter(function (_, i) { return s[i]; }).length / STEPS.length; }

  // ---------- toast ----------
  function toast(msg, sub) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = esc(msg) + (sub ? '<small>' + esc(sub) + '</small>' : '');
    $('#toasts').appendChild(el);
    setTimeout(function () { el.remove(); }, 4200);
  }
  function copy(text, what) {
    function done() { toast((what || 'Link') + ' copied'); }
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() {
      var t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); done(); } catch (e) { prompt('Copy this link:', text); }
      t.remove();
    }
  }
  function download(name, text, type) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  // ---------- views ----------
  var view = $('#view');
  var TITLES = { overview: 'Overview', environments: 'Demo environments', onboarding: 'Client onboarding', waitlist: 'Waitlist', troubleshoot: 'Troubleshooting', service: 'Service settings' };
  var current = 'overview';

  function render() {
    $('#view-title').textContent = TITLES[current];
    $$('.app-nav a').forEach(function (a) { if (a.dataset.view === current) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    ({ overview: renderOverview, environments: renderEnvs, onboarding: renderOnboarding, waitlist: renderWaitlist, troubleshoot: renderTroubleshoot, service: renderService })[current]();
  }

  function envActions(env) {
    return '<div class="row-actions">' +
      '<a class="btn btn-primary" href="' + esc(linkFor(env.cfg)) + '" target="_blank" rel="noopener" data-opened="' + env.id + '">Open</a>' +
      '<button class="btn btn-ghost" type="button" data-copy="' + env.id + '">Copy link</button>' +
      '<button class="btn btn-ghost" type="button" data-edit="' + env.id + '">Edit</button>' +
      '<button class="btn btn-ghost" type="button" data-dup="' + env.id + '">Duplicate</button>' +
      '<button class="btn btn-ghost danger-text" type="button" data-del="' + env.id + '">Delete</button></div>';
  }

  function renderOverview() {
    var sales = store.envs.filter(function (e) { return e.cfg.purpose === 'sales'; });
    var onb = store.envs.filter(function (e) { return e.cfg.purpose === 'onboarding'; });
    var avg = onb.length ? onb.reduce(function (s, e) { return s + progress(e); }, 0) / onb.length : 0;
    var due = store.envs.filter(function (e) { return e.followUp && e.followUp <= today(); });
    var h = '<div class="kpi-row">' +
      '<div class="kpi-tile"><small>Environments</small><strong>' + store.envs.length + '</strong></div>' +
      '<div class="kpi-tile"><small>Sales demos</small><strong>' + sales.length + '</strong></div>' +
      '<div class="kpi-tile"><small>Clients onboarding</small><strong>' + onb.length + '</strong></div>' +
      '<div class="kpi-tile"><small>Avg. onboarding progress</small><strong>' + Math.round(avg * 100) + '%</strong></div>' +
      '</div><div class="panels">';
    h += '<div class="panel"><h3>Quick actions</h3><p class="sub">Common jobs for sales and customer success.</p><div class="link-list">' +
      '<a href="#" data-quick="sales">New sales demo<small>Full sample history, all channels</small></a>' +
      '<a href="#" data-quick="onboarding">New client onboarding workspace<small>Empty calendar, onboarding checklist</small></a>' +
      '<a href="demo.html" target="_blank" rel="noopener">Open the standard demo<small>Northwind Apparel</small></a>' +
      '<a href="#troubleshoot">Run health checks<small>Pages, scripts, CDNs, browser</small></a></div></div>';
    h += '<div class="panel"><h3>Needs attention</h3><p class="sub">Follow-up dates that have arrived.</p>' +
      (due.length ? '<div class="link-list">' + due.map(function (e) {
        return '<a href="#" data-edit="' + e.id + '">' + esc(e.name) + '<small>Follow up ' + day(e.followUp) + '</small></a>';
      }).join('') + '</div>' : '<p class="empty">Nothing due. Nice.</p>') + '</div>';
    h += '<div class="panel" style="grid-column:1/-1"><h3>Recent activity</h3><p class="sub">Changes by everyone with admin access.</p>' +
      (store.log.length ? '<div class="log">' + store.log.slice(0, 10).map(logLine).join('') + '</div>' : '<p class="empty">No activity yet. Create your first environment to get started.</p>') +
      '</div></div>';
    view.innerHTML = h;
    $$('[data-quick]').forEach(function (a) {
      a.addEventListener('click', function (e) { e.preventDefault(); openEditor(null, a.dataset.quick); });
    });
  }

  function renderEnvs() {
    var h = '<div class="toolbar"><input type="search" id="env-q" placeholder="Search environments…" aria-label="Search environments" style="width:240px">' +
      '<span class="spacer"></span>' +
      '<label class="btn btn-ghost btn-sm upload-label">Import JSON<input type="file" id="env-import" accept="application/json,.json"></label>' +
      '<button class="btn btn-ghost btn-sm" type="button" id="env-export"' + (store.envs.length ? '' : ' disabled') + '>Export all</button></div>';
    if (!store.envs.length) {
      h += '<div class="panel"><p class="empty">No environments yet.<br>Create a tailored demo for a prospect, or an empty workspace to onboard a new client.</p>' +
        '<div class="btn-row" style="justify-content:center"><button class="btn btn-primary btn-sm" type="button" data-quick="sales">New sales demo</button><button class="btn btn-ghost btn-sm" type="button" data-quick="onboarding">New onboarding workspace</button></div></div>';
    } else {
      h += '<div class="table-wrap"><table class="data-table" id="env-table"><thead><tr><th>Environment</th><th>Purpose</th><th>Industry</th><th>Data</th><th class="num">Channels</th><th class="num">Team</th><th>Follow up</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
        store.envs.slice().sort(function (a, b) { return b.updated - a.updated; }).map(function (e) {
          return '<tr data-row="' + esc((e.name + ' ' + e.cfg.company).toLowerCase()) + '"><td class="env-name"><span class="dot" style="background:' + esc(e.cfg.color) + '"></span>' + esc(e.name) + '<small>' + esc(e.cfg.company) + ' · updated ' + when(e.updated) + (e.opened ? ' · opened ' + e.opened + '×' : '') + '</small></td>' +
            '<td><span class="tag ' + (e.cfg.purpose === 'onboarding' ? 'ok' : '') + '">' + PURPOSE[e.cfg.purpose] + '</span></td>' +
            '<td>' + esc(E.INDUSTRIES[e.cfg.industry].label) + '</td><td>' + DATA_LABEL[e.cfg.data] + '</td>' +
            '<td class="num">' + e.cfg.channels.length + '</td><td class="num">' + e.cfg.people.length + '</td>' +
            '<td>' + (e.followUp ? '<span class="tag ' + (e.followUp <= today() ? 'warn' : 'neutral') + '">' + day(e.followUp) + '</span>' : '<span class="muted">—</span>') + '</td>' +
            '<td>' + envActions(e) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    view.innerHTML = h;
    var q = $('#env-q');
    q.addEventListener('input', function () {
      var v = q.value.toLowerCase();
      $$('#env-table tbody tr').forEach(function (tr) { tr.hidden = v && tr.dataset.row.indexOf(v) === -1; });
    });
    $('#env-export').addEventListener('click', function () {
      download('campaign-span-environments-' + today() + '.json', JSON.stringify({ app: 'campaign-span-admin', v: 1, exported: new Date().toISOString(), envs: store.envs }, null, 2));
      log('Exported ' + store.envs.length + ' environments');
    });
    $('#env-import').addEventListener('change', function (ev) {
      var f = ev.target.files[0]; if (!f) return;
      f.text().then(function (txt) {
        var data = JSON.parse(txt);
        var list = Array.isArray(data) ? data : data.envs;
        if (!Array.isArray(list)) throw new Error('No environments found in that file.');
        var added = 0, updated = 0;
        list.forEach(function (raw) {
          if (!raw || !raw.cfg) return;
          var env = { id: raw.id || uid(), name: String(raw.name || raw.cfg.company || 'Imported environment').slice(0, 80), cfg: E.normalize(raw.cfg),
            created: raw.created || Date.now(), updated: Date.now(), followUp: raw.followUp || '', notes: String(raw.notes || ''), steps: raw.steps || {}, opened: raw.opened || 0 };
          var i = store.envs.findIndex(function (e) { return e.id === env.id; });
          if (i === -1) { store.envs.push(env); added++; } else { store.envs[i] = env; updated++; }
        });
        log('Imported environments (' + added + ' new, ' + updated + ' updated)');
        toast('Import complete', added + ' added, ' + updated + ' updated');
        render();
      }).catch(function (err) { toast('Couldn’t import that file', err.message); });
    });
  }

  function renderOnboarding() {
    var list = store.envs.filter(function (e) { return e.cfg.purpose === 'onboarding'; });
    if (!list.length) {
      view.innerHTML = '<div class="panel"><p class="empty">No clients onboarding yet.<br>An onboarding workspace starts with an empty calendar and your client’s team, ready for them to fill in.</p>' +
        '<div class="btn-row" style="justify-content:center"><button class="btn btn-primary btn-sm" type="button" data-quick="onboarding">New onboarding workspace</button></div></div>';
      return;
    }
    view.innerHTML = '<div class="panels" style="margin-top:0">' + list.map(function (e) {
      var pr = progress(e), s = e.steps || {};
      return '<div class="panel"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap"><div class="env-name"><span class="dot" style="background:' + esc(e.cfg.color) + '"></span>' + esc(e.cfg.company) +
        '<small>' + esc(e.name) + ' · ' + e.cfg.people.length + ' people' + (e.followUp ? ' · follow up ' + day(e.followUp) : '') + '</small></div><strong>' + Math.round(pr * 100) + '%</strong></div>' +
        '<div class="progress" style="margin-top:10px" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pr * 100) + '" aria-label="Onboarding progress for ' + esc(e.cfg.company) + '"><span style="width:' + (pr * 100) + '%"></span></div>' +
        '<div class="steps">' + STEPS.map(function (st, i) {
          return '<label><input type="checkbox" data-step="' + e.id + ':' + i + '"' + (s[i] ? ' checked' : '') + '><span>' + esc(st) + '</span></label>';
        }).join('') + '</div>' +
        (e.notes ? '<p class="muted" style="font-size:.86rem;margin:12px 0 0;white-space:pre-wrap">' + esc(e.notes) + '</p>' : '') +
        '<div style="margin-top:14px">' + envActions(e) + '</div></div>';
    }).join('') + '</div>';
    $$('[data-step]').forEach(function (c) {
      c.addEventListener('change', function () {
        var parts = c.dataset.step.split(':'), env = envById(parts[0]);
        env.steps = env.steps || {}; env.steps[parts[1]] = c.checked; env.updated = Date.now();
        log((c.checked ? 'Completed' : 'Reopened') + ' "' + STEPS[+parts[1]] + '" for ' + env.cfg.company);
        if (progress(env) === 1) toast(env.cfg.company + ' is fully onboarded');
        render();
      });
    });
  }

  // ---------- troubleshooting ----------
  var PAGES = ['index.html', 'features.html', 'roles.html', 'integrations.html', 'pricing.html', 'demo.html', 'login.html',
    'about.html', 'terms.html', 'privacy.html', 'cookies.html', 'legal.html'];
  var ASSETS = ['assets/styles.css', 'assets/site.js', 'assets/env.js', 'assets/demo.js', 'assets/demo.css', 'assets/favicon.svg'];

  // Sign-ups from the public waitlist form (login.html → /api/waitlist)
  function csvCell(v) { v = String(v == null ? '' : v); return /^[=+\-@]/.test(v) ? "'" + v : v; }
  function renderWaitlist() {
    var list = store.waitlist;
    var week = list.filter(function (w) { return Date.now() - Date.parse(w.at) < 7 * 864e5; }).length;
    var h = '<div class="kpi-row">' +
      '<div class="kpi-tile"><small>On the waitlist</small><strong>' + list.length + '</strong></div>' +
      '<div class="kpi-tile"><small>Joined this week</small><strong>' + week + '</strong></div></div>' +
      '<div class="toolbar"><input type="search" id="wl-q" placeholder="Search the waitlist…" aria-label="Search the waitlist" style="width:240px">' +
      '<span class="spacer"></span><button class="btn btn-ghost btn-sm" type="button" id="wl-export"' + (list.length ? '' : ' disabled') + '>Export CSV</button></div>';
    if (!list.length) {
      h += '<div class="panel"><p class="empty">No one has joined yet.<br>Sign-ups from the <a href="login.html" target="_blank" rel="noopener">waitlist page</a> show up here.</p></div>';
    } else {
      h += '<div class="table-wrap"><table class="data-table" id="wl-table"><thead><tr><th>Person</th><th>Company</th><th>Department</th><th>Team size</th><th>Joined</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
        list.map(function (w) {
          return '<tr data-row="' + esc((w.name + ' ' + w.email + ' ' + w.company).toLowerCase()) + '"><td class="env-name">' + esc(w.name || '—') + '<small>' + esc(w.email) + '</small></td>' +
            '<td>' + esc(w.company || '—') + '</td><td>' + esc(w.dept || '—') + '</td><td>' + esc(w.teamSize || '—') + '</td><td>' + when(Date.parse(w.at)) + '</td>' +
            '<td><div class="row-actions"><button class="btn btn-ghost danger-text" type="button" data-wl-del="' + esc(w.email) + '">Remove</button></div></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    view.innerHTML = h;
    var q = $('#wl-q');
    q.addEventListener('input', function () {
      var v = q.value.toLowerCase();
      $$('#wl-table tbody tr').forEach(function (tr) { tr.hidden = v && tr.dataset.row.indexOf(v) === -1; });
    });
    $('#wl-export').addEventListener('click', function () {
      var rows = [['Email', 'Name', 'Company', 'Department', 'Team size', 'Joined']].concat(list.map(function (w) { return [w.email, w.name, w.company, w.dept, w.teamSize, w.at]; }));
      download('campaign-span-waitlist-' + today() + '.csv', rows.map(function (r) {
        return r.map(function (c) { return '"' + csvCell(c).replace(/"/g, '""') + '"'; }).join(',');
      }).join('\r\n'), 'text/csv');
      log('Exported the waitlist (' + list.length + ' people)');
    });
    $$('[data-wl-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        var email = b.dataset.wlDel;
        if (!confirm('Remove ' + email + ' from the waitlist? This can\u2019t be undone.')) return;
        api('POST', { action: 'waitlist-remove', email: email }).then(function () {
          store.waitlist = store.waitlist.filter(function (w) { return w.email !== email; });
          log('Removed a person from the waitlist');
          renderWaitlist();
        }, function (err) { toast('Couldn\u2019t remove them', err.message); });
      });
    });
  }

  function renderTroubleshoot() {
    view.innerHTML = '<div class="panels" style="margin-top:0">' +
      '<div class="panel" style="grid-column:1/-1"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><div><h3>Health checks</h3><p class="sub" style="margin:0">Checks the live site, the scripts it depends on, and what this browser supports.</p></div>' +
      '<button class="btn btn-primary btn-sm" type="button" id="run-checks">Run checks</button></div><div class="checks" id="checks" style="margin-top:14px"><p class="empty">Press Run checks to start.</p></div></div>' +
      '<div class="panel"><h3>Inspect a demo link</h3><p class="sub">Paste a link a client or colleague sent you to see exactly what it contains, or why it won’t load.</p>' +
      '<textarea id="inspect-in" rows="3" placeholder="https://www.campaignspan.com/demo.html?env=…" aria-label="Demo link to inspect"></textarea>' +
      '<div class="btn-row" style="margin-top:10px"><button class="btn btn-ghost btn-sm" type="button" id="inspect-go">Inspect</button></div><div id="inspect-out"></div></div>' +
      '<div class="panel"><h3>This browser</h3><p class="sub">Useful when a client reports a problem: ask them to open this page and send you these details.</p><pre class="code" id="env-info"></pre>' +
      '<div class="btn-row" style="margin-top:10px"><button class="btn btn-ghost btn-sm" type="button" id="copy-info">Copy details</button></div></div>' +
      '<div class="panel" style="grid-column:1/-1"><h3>Your session</h3><p class="sub">Signed in as <strong>' + esc(me) + '</strong>. Sign out when you\u2019re done on a shared computer.</p>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-sign-out>Sign out</button></div></div>';

    var info = {
      'Browser': navigator.userAgent,
      'Viewport': window.innerWidth + ' × ' + window.innerHeight + ' @' + (window.devicePixelRatio || 1) + 'x',
      'Colour scheme': (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark (system)' : 'light (system)')),
      'Language': navigator.language,
      'Online': navigator.onLine ? 'yes' : 'no',
      'Cookies enabled': navigator.cookieEnabled ? 'yes' : 'no',
      'Local storage': storageOk ? 'available' : 'blocked',
      'Saved environments': store.envs.length,
      'Signed in as': me,
      'Page': location.href.split('#')[0]
    };
    var text = Object.keys(info).map(function (k) { return k + ': ' + info[k]; }).join('\n');
    $('#env-info').textContent = text;
    $('#copy-info').addEventListener('click', function () { copy(text, 'Details'); });
    $('#run-checks').addEventListener('click', runChecks);
    $('#inspect-go').addEventListener('click', inspect);
  }

  function inspect() {
    var out = $('#inspect-out'), val = $('#inspect-in').value.trim();
    if (!val) { out.innerHTML = '<p class="field-error" style="margin-top:10px">Paste a link first.</p>'; return; }
    var raw = E.fromUrl(val) || (/^[A-Za-z0-9_-]+$/.test(val) ? val : null);
    if (!raw) { out.innerHTML = '<p class="notice" style="margin-top:10px">This link has no environment in it, so it opens the standard Northwind Apparel demo.</p>'; return; }
    var parsed;
    try { parsed = E.decode(raw); }
    catch (e) { out.innerHTML = '<p class="field-error" style="margin-top:10px">The environment in this link is damaged (it was probably cut off when it was copied or pasted). The demo will fall back to the standard workspace. Send a fresh link from the Demo environments page.</p>'; return; }
    var norm = E.normalize(parsed), notes = [];
    ['company', 'industry', 'purpose', 'color', 'data', 'banner', 'excel'].forEach(function (k) {
      if (parsed[k] !== undefined && JSON.stringify(parsed[k]) !== JSON.stringify(norm[k])) notes.push(k + ' was invalid and fell back to "' + norm[k] + '"');
      if (parsed[k] === undefined) notes.push(k + ' missing, using default');
    });
    if (Array.isArray(parsed.people) && parsed.people.length !== norm.people.length) notes.push((parsed.people.length - norm.people.length) + ' team member(s) were invalid and skipped');
    var match = store.envs.find(function (e) { return E.encode(e.cfg) === E.encode(norm); });
    out.innerHTML = '<p class="notice ok" style="margin-top:10px"><strong>Valid link.</strong> Opens <strong>' + esc(norm.company) + '</strong> (' + PURPOSE[norm.purpose] + ', ' + esc(E.INDUSTRIES[norm.industry].label) + ', ' + DATA_LABEL[norm.data].toLowerCase() + ' data, ' + norm.people.length + ' people, ' + norm.channels.length + ' channels).' +
      (match ? ' Matches your saved environment “' + esc(match.name) + '”.' : '') + '</p>' +
      (notes.length ? '<ul class="muted" style="font-size:.85rem;margin:8px 0 0;padding-left:18px">' + notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>' : '') +
      '<pre class="code">' + esc(JSON.stringify(norm, null, 2)) + '</pre>' +
      '<div class="btn-row" style="margin-top:10px"><a class="btn btn-ghost btn-sm" href="' + esc(linkFor(norm)) + '" target="_blank" rel="noopener">Open it</a>' +
      (match ? '' : '<button class="btn btn-ghost btn-sm" type="button" id="inspect-save">Save as environment</button>') + '</div>';
    var sv = $('#inspect-save');
    if (sv) sv.addEventListener('click', function () {
      var env = { id: uid(), name: norm.company + ' (from link)', cfg: norm, created: Date.now(), updated: Date.now(), followUp: '', notes: '', steps: {}, opened: 0 };
      store.envs.push(env); log('Saved "' + env.name + '" from a pasted link'); toast('Saved'); inspect();
    });
  }

  function runChecks() {
    var box = $('#checks'), btn = $('#run-checks');
    btn.disabled = true;
    var checks = [];
    function add(name, fn) { checks.push({ name: name, fn: fn }); }
    function fetchStatus(url, opts) {
      var ctl = window.AbortController ? new AbortController() : null;
      var t = setTimeout(function () { if (ctl) ctl.abort(); }, 8000);
      return fetch(url, Object.assign({ cache: 'no-store', signal: ctl && ctl.signal }, opts || {})).then(function (r) { clearTimeout(t); return r; });
    }

    add('Site pages', function () {
      return Promise.all(PAGES.map(function (p) { return fetchStatus(p, { method: 'HEAD' }).then(function (r) { return [p, r.status]; }, function () { return [p, 0]; }); }))
        .then(function (res) {
          var bad = res.filter(function (r) { return r[1] !== 200; });
          return bad.length ? ['fail', bad.length + ' of ' + res.length + ' pages failed: ' + bad.map(function (b) { return b[0] + ' (' + (b[1] || 'no response') + ')'; }).join(', ')] : ['pass', 'All ' + res.length + ' pages respond'];
        });
    });
    add('Site scripts and styles', function () {
      return Promise.all(ASSETS.map(function (p) { return fetchStatus(p, { method: 'HEAD' }).then(function (r) { return [p, r.status]; }, function () { return [p, 0]; }); }))
        .then(function (res) {
          var bad = res.filter(function (r) { return r[1] !== 200; });
          return bad.length ? ['fail', 'Missing: ' + bad.map(function (b) { return b[0]; }).join(', ')] : ['pass', 'All ' + res.length + ' files load'];
        });
    });
    add('Admin database (Turso)', function () {
      return api('GET', null, '?action=health').then(function (r) {
        return ['pass', 'Connected in ' + r.ms + ' ms. ' + r.count + ' environment(s) stored'];
      }, function (err) { return ['fail', 'Couldn\u2019t reach the admin database: ' + err.message]; });
    });
    add('Excel export library (cdnjs)', function () {
      return fetchStatus('https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js', { method: 'HEAD' })
        .then(function (r) { return r.ok ? ['pass', 'Reachable. Excel exports work'] : ['fail', 'Responded ' + r.status + '. Excel export falls back to CSV']; },
          function () { return ['warn', 'Not reachable from this network. Excel export falls back to CSV (often a firewall or ad blocker)']; });
    });
    add('Web fonts (Google Fonts)', function () {
      return fetchStatus('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400&display=swap')
        .then(function (r) { return r.ok ? ['pass', 'Reachable'] : ['warn', 'Responded ' + r.status + '. Pages use the system font instead']; },
          function () { return ['warn', 'Not reachable. Pages fall back to the system font, nothing breaks']; });
    });
    add('Demo link encoding', function () {
      var cfg = E.clone(E.DEFAULT); cfg.company = 'Test Café Ünïcödé 日本'; cfg.people = [{ name: 'José Müller', dept: 'Sales' }];
      var back = E.normalize(E.decode(E.encode(cfg)));
      var ok = back.company === cfg.company && back.people[0].name === 'José Müller';
      return Promise.resolve(ok ? ['pass', 'Links survive accents and non-Latin names'] : ['fail', 'Round trip changed the data']);
    });
    add('Saved environment links', function () {
      if (!store.envs.length) return Promise.resolve(['pass', 'No saved environments to check']);
      var long = store.envs.filter(function (e) { return linkFor(e.cfg).length > 2000; });
      var bad = store.envs.filter(function (e) { try { E.decode(E.encode(e.cfg)); return false; } catch (x) { return true; } });
      if (bad.length) return Promise.resolve(['fail', bad.length + ' environment(s) can’t be encoded: ' + bad.map(function (e) { return e.name; }).join(', ')]);
      if (long.length) return Promise.resolve(['warn', long.length + ' link(s) are over 2,000 characters, which some email apps truncate. Trim the team list or banner: ' + long.map(function (e) { return e.name; }).join(', ')]);
      return Promise.resolve(['pass', 'All ' + store.envs.length + ' links are valid and a safe length']);
    });
    add('Browser storage', function () {
      try { localStorage.setItem('cs-check', '1'); localStorage.removeItem('cs-check'); return Promise.resolve(['pass', 'Available. Theme and panel sizes are remembered']); }
      catch (e) { return Promise.resolve(['warn', 'Blocked (private mode or strict settings). Everything works, but nothing is remembered']); }
    });
    add('Browser features', function () {
      var missing = [];
      if (typeof HTMLDialogElement === 'undefined') missing.push('dialogs');
      if (!(window.CSS && CSS.supports('color', 'color-mix(in srgb, red 50%, blue)'))) missing.push('colour mixing');
      if (!(window.CSS && CSS.supports('selector(:has(*))'))) missing.push(':has() selector');
      if (!('draggable' in document.createElement('span'))) missing.push('drag and drop');
      if (!window.PointerEvent) missing.push('pointer events');
      return Promise.resolve(missing.length ? ['warn', 'Missing: ' + missing.join(', ') + '. Ask the user to update their browser'] : ['pass', 'Everything the app uses is supported']);
    });
    add('Connection', function () {
      return Promise.resolve(navigator.onLine ? ['pass', 'Online'] : ['fail', 'This browser reports it is offline']);
    });

    box.innerHTML = checks.map(function (c, i) { return '<div class="check-row" id="chk-' + i + '"><span class="status wait">Running</span><div><strong>' + esc(c.name) + '</strong><small>Checking…</small></div></div>'; }).join('');
    var results = [];
    Promise.all(checks.map(function (c, i) {
      return c.fn().catch(function (e) { return ['fail', 'Check crashed: ' + (e && e.message)]; }).then(function (r) {
        results[i] = r;
        var row = $('#chk-' + i);
        row.querySelector('.status').className = 'status ' + r[0];
        row.querySelector('.status').textContent = { pass: 'Pass', warn: 'Warning', fail: 'Failed' }[r[0]];
        row.querySelector('small').textContent = r[1];
      });
    })).then(function () {
      btn.disabled = false;
      var f = results.filter(function (r) { return r[0] === 'fail'; }).length, w = results.filter(function (r) { return r[0] === 'warn'; }).length;
      log('Ran health checks: ' + (f ? f + ' failed, ' : '') + (w ? w + ' warnings, ' : '') + (results.length - f - w) + ' passed');
      toast(f ? f + ' check(s) failed' : w ? 'Checks passed with ' + w + ' warning(s)' : 'All checks passed');
    });
  }

  // ---------- service settings ----------
  function renderService() {
    var d = defaults();
    var h = '<div class="panels" style="margin-top:0">' +
      '<div class="panel"><h3>Defaults for new environments</h3><p class="sub">Every new environment starts from these settings.</p><form id="defaults-form">' +
      '<div class="field"><label for="d-industry">Industry</label><select id="d-industry">' + Object.keys(E.INDUSTRIES).map(function (k) { return '<option value="' + k + '"' + (k === d.industry ? ' selected' : '') + '>' + esc(E.INDUSTRIES[k].label) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>Channels</label><div class="check-grid">' + Object.keys(E.CHANNELS).map(function (c) { return '<label><input type="checkbox" name="d-ch" value="' + c + '"' + (d.channels.indexOf(c) !== -1 ? ' checked' : '') + '>' + E.CHANNELS[c] + '</label>'; }).join('') + '</div></div>' +
      '<div class="field"><label for="d-banner">Demo banner message</label><input type="text" id="d-banner" maxlength="140" value="' + esc(d.banner) + '" placeholder="Leave blank for the standard message"></div>' +
      '<label class="switch" style="margin-bottom:16px"><input type="checkbox" id="d-excel"' + (d.excel ? ' checked' : '') + '> Allow Excel export in demos</label>' +
      '<div class="btn-row"><button class="btn btn-primary btn-sm" type="submit">Save defaults</button><button class="btn btn-ghost btn-sm" type="button" id="d-reset">Reset to standard</button></div></form></div>' +
      '<div class="panel"><h3>Manage the service</h3><p class="sub">Where the live site, code and domain are managed.</p><div class="link-list">' +
      '<a href="https://www.campaignspan.com" target="_blank" rel="noopener">Live site<small>www.campaignspan.com</small></a>' +
      '<a href="https://vercel.com/suzanne-v0/campaign-span" target="_blank" rel="noopener">Hosting and deployments<small>Vercel</small></a>' +
      '<a href="https://github.com/SuzanneV0/campaign-span" target="_blank" rel="noopener">Source code<small>GitHub</small></a>' +
      '<a href="https://hpanel.hostinger.com/domain/campaignspan.com/dns" target="_blank" rel="noopener">Domain and DNS<small>Hostinger</small></a>' +
      '<a href="mailto:hello@campaignspan.com">Support inbox<small>hello@campaignspan.com</small></a></div></div>' +
      '<div class="panel" style="grid-column:1/-1"><h3>Activity log</h3><p class="sub">Everything changed by admins, newest first.</p>' +
      (store.log.length ? '<div class="log">' + store.log.map(logLine).join('') + '</div>' : '<p class="empty">No activity yet.</p>') +
      '<div class="btn-row" style="margin-top:12px"><button class="btn btn-ghost btn-sm" type="button" id="log-export"' + (store.log.length ? '' : ' disabled') + '>Download log (CSV)</button></div></div></div>';
    view.innerHTML = h;
    $('#defaults-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var ch = $$('input[name=d-ch]:checked').map(function (c) { return c.value; });
      if (!ch.length) { toast('Pick at least one channel'); return; }
      var nd = E.normalize(Object.assign(defaults(), { industry: $('#d-industry').value, channels: ch, banner: $('#d-banner').value.trim(), excel: $('#d-excel').checked }));
      store.defaults = { industry: nd.industry, channels: nd.channels, banner: nd.banner, excel: nd.excel };
      log('Updated defaults for new environments'); toast('Defaults saved');
    });
    $('#d-reset').addEventListener('click', function () { store.defaults = null; log('Reset defaults to standard'); render(); toast('Defaults reset'); });
    $('#log-export').addEventListener('click', function () {
      var csv = 'Time,Admin,Change\r\n' + store.log.map(function (l) { return new Date(l.at).toISOString() + ',"' + String(l.actor || '').replace(/"/g, '""') + '","' + l.msg.replace(/"/g, '""') + '"'; }).join('\r\n');
      download('campaign-span-admin-log-' + today() + '.csv', '﻿' + csv, 'text/csv;charset=utf-8');
    });
  }

  // ---------- environment editor ----------
  var dlg = $('#env-dialog'), form = $('#env-form'), editing = null;

  function teamRow(p) {
    return '<div class="team-row"><input type="text" name="t-name" value="' + esc(p.name) + '" placeholder="Full name" aria-label="Team member name" maxlength="40">' +
      '<select name="t-dept" aria-label="Department">' + E.DEPTS.map(function (d) { return '<option' + (d === p.dept ? ' selected' : '') + '>' + d + '</option>'; }).join('') + '</select>' +
      '<button type="button" class="icon-btn" data-remove-row aria-label="Remove team member">✕</button></div>';
  }

  function openEditor(id, preset) {
    editing = id ? envById(id) : null;
    var cfg = editing ? E.normalize(editing.cfg) : defaults();
    if (!editing && preset) {
      cfg.purpose = preset;
      cfg.data = preset === 'onboarding' ? 'empty' : 'full';
      if (preset === 'onboarding') cfg.people = [{ name: '', dept: 'Marketing' }];
    }
    var meta = editing || { name: '', followUp: '', notes: '' };
    $('#env-dialog-title').textContent = editing ? 'Edit environment' : (cfg.purpose === 'onboarding' ? 'New onboarding workspace' : 'New sales demo');
    var radio = function (name, val, label, cur) { return '<label><input type="radio" name="' + name + '" value="' + val + '"' + (val === cur ? ' checked' : '') + '>' + label + '</label>'; };
    $('#env-form-body').innerHTML =
      '<div class="form-grid">' +
      '<div class="field"><label for="f-company">Client company name</label><input type="text" id="f-company" maxlength="60" value="' + esc(editing ? cfg.company : (preset ? '' : cfg.company)) + '" placeholder="e.g. Maple & Pine Outfitters" required><span class="hint">Shown as the workspace name in the demo.</span></div>' +
      '<div class="field"><label for="f-name">Internal name</label><input type="text" id="f-name" maxlength="80" value="' + esc(meta.name) + '" placeholder="e.g. Maple & Pine, discovery call Oct 9"><span class="hint">Only you see this. Defaults to the company name.</span></div>' +
      '</div>' +
      '<div class="form-grid">' +
      '<div class="field"><label>Purpose</label><div class="seg">' + radio('f-purpose', 'sales', 'Sales demo', cfg.purpose) + radio('f-purpose', 'onboarding', 'Client onboarding', cfg.purpose) + '</div></div>' +
      '<div class="field"><label>Sample data</label><div class="seg">' + radio('f-data', 'full', 'Full history', cfg.data) + radio('f-data', 'light', 'Light', cfg.data) + radio('f-data', 'empty', 'Empty', cfg.data) + '</div></div>' +
      '</div>' +
      '<div class="form-grid">' +
      '<div class="field"><label for="f-industry">Industry</label><select id="f-industry">' + Object.keys(E.INDUSTRIES).map(function (k) { return '<option value="' + k + '"' + (k === cfg.industry ? ' selected' : '') + '>' + esc(E.INDUSTRIES[k].label) + '</option>'; }).join('') + '</select><span class="hint">Sets post titles, the production project and sample files.</span></div>' +
      '<div class="field"><label for="f-color">Workspace colour</label><div style="display:flex;gap:10px;align-items:center"><input type="color" id="f-color" value="' + esc(cfg.color) + '"><span class="hint">Use the client’s brand colour.</span></div></div>' +
      '</div>' +
      '<div class="form-section"><h3>Channels</h3><p class="sub">Only these appear in the calendar, analytics and filters.</p><div class="check-grid" id="f-channels">' +
      Object.keys(E.CHANNELS).map(function (c) { return '<label><input type="checkbox" name="f-ch" value="' + c + '"' + (cfg.channels.indexOf(c) !== -1 ? ' checked' : '') + '>' + E.CHANNELS[c] + '</label>'; }).join('') +
      '</div><p class="field-error" id="err-ch" hidden>Pick at least one channel.</p></div>' +
      '<div class="form-section"><h3>Team</h3><p class="sub">Use the client’s real team so they see their own names on the board and in notifications.</p><div class="team-rows" id="f-team">' +
      cfg.people.map(teamRow).join('') + '</div><button type="button" class="btn btn-ghost btn-sm" id="add-person" style="margin-top:10px">+ Add person</button><p class="field-error" id="err-team" hidden>Add at least one team member with a name.</p></div>' +
      '<div class="form-section"><h3>Notification defaults</h3><p class="sub">Where each department hears about new projects and deadline changes.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Department</th><th>App</th><th>Email</th><th>Slack</th></tr></thead><tbody>' +
      E.DEPTS.map(function (d) {
        var v = cfg.notify[d] || '';
        return '<tr><td>' + d + '</td>' + [['a', 'app'], ['e', 'email'], ['s', 'Slack']].map(function (k) {
          return '<td><label class="switch"><input type="checkbox" name="f-notify" data-dept="' + d + '" value="' + k[0] + '"' + (v.indexOf(k[0]) !== -1 ? ' checked' : '') + ' aria-label="' + d + ' ' + k[1] + '"></label></td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div></div>' +
      '<div class="form-section"><h3>Presentation</h3><div class="field"><label for="f-banner">Banner message</label><input type="text" id="f-banner" maxlength="140" value="' + esc(cfg.banner) + '" placeholder="e.g. Welcome, Maple & Pine team! This is your workspace preview."><span class="hint">Replaces the demo-mode notice at the top. Leave blank for the standard message.</span></div>' +
      '<label class="switch"><input type="checkbox" id="f-excel"' + (cfg.excel ? ' checked' : '') + '> Allow Excel export</label></div>' +
      '<div class="form-section"><h3>Internal tracking</h3><div class="form-grid"><div class="field"><label for="f-follow">Follow-up date</label><input type="date" id="f-follow" value="' + esc(meta.followUp || '') + '"><span class="hint">Shows under Needs attention on the overview.</span></div></div>' +
      '<div class="field"><label for="f-notes">Notes</label><textarea id="f-notes" rows="3" placeholder="Goals, contacts, what to show…">' + esc(meta.notes || '') + '</textarea><span class="hint">Notes stay in the admin console and are never put in the link.</span></div></div>';

    $('#add-person').addEventListener('click', function () {
      $('#f-team').insertAdjacentHTML('beforeend', teamRow({ name: '', dept: 'Social' }));
      var rows = $$('#f-team .team-row'); rows[rows.length - 1].querySelector('input').focus(); updateSize();
    });
    $('#f-team').addEventListener('click', function (e) {
      var b = e.target.closest('[data-remove-row]');
      if (b && $$('#f-team .team-row').length > 1) { b.closest('.team-row').remove(); updateSize(); }
    });
    // Switching to onboarding suggests an empty calendar
    $$('input[name=f-purpose]').forEach(function (r) {
      r.addEventListener('change', function () {
        var target = r.value === 'onboarding' ? 'empty' : 'full';
        var radioEl = $('input[name=f-data][value=' + target + ']'); if (radioEl) radioEl.checked = true;
        updateSize();
      });
    });
    updateSize();
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    $('#f-company').focus();
  }

  function readForm() {
    var notify = {};
    E.DEPTS.forEach(function (d) { notify[d] = ''; });
    $$('input[name=f-notify]:checked').forEach(function (c) { notify[c.dataset.dept] += c.value; });
    return {
      v: 1,
      company: $('#f-company').value.trim(),
      industry: $('#f-industry').value,
      purpose: ($('input[name=f-purpose]:checked') || {}).value || 'sales',
      color: $('#f-color').value,
      data: ($('input[name=f-data]:checked') || {}).value || 'full',
      channels: $$('input[name=f-ch]:checked').map(function (c) { return c.value; }),
      people: $$('#f-team .team-row').map(function (r) { return { name: r.querySelector('input').value.trim(), dept: r.querySelector('select').value }; }).filter(function (p) { return p.name; }),
      notify: notify,
      banner: $('#f-banner').value.trim(),
      excel: $('#f-excel').checked
    };
  }
  function updateSize() {
    if (!$('#f-company')) return;
    var len = linkFor(readForm()).length;
    $('#env-link-size').textContent = 'Link length: ' + len.toLocaleString() + ' characters' + (len > 2000 ? ' (long, some email apps may cut it off)' : '');
  }

  form.addEventListener('input', updateSize);
  form.addEventListener('change', updateSize);
  $$('[data-close]', dlg).forEach(function (b) { b.addEventListener('click', function () { dlg.close(); }); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var action = e.submitter ? e.submitter.value : 'save';
    var raw = readForm(), ok = true;
    $('#f-company').classList.toggle('input-invalid', !raw.company);
    if (!raw.company) ok = false;
    $('#err-ch').hidden = !!raw.channels.length; if (!raw.channels.length) ok = false;
    $('#err-team').hidden = !!raw.people.length; if (!raw.people.length) ok = false;
    if (!ok) { toast('Check the highlighted fields'); (raw.company ? (raw.channels.length ? $('#f-team input') : $('#f-channels input')) : $('#f-company')).focus(); return; }
    var cfg = E.normalize(raw);
    var name = $('#f-name').value.trim() || cfg.company;
    var now = Date.now(), env;
    if (editing) {
      env = editing;
      Object.assign(env, { name: name, cfg: cfg, updated: now, followUp: $('#f-follow').value, notes: $('#f-notes').value.trim() });
      log('Edited "' + name + '"');
    } else {
      env = { id: uid(), name: name, cfg: cfg, created: now, updated: now, followUp: $('#f-follow').value, notes: $('#f-notes').value.trim(), steps: {}, opened: 0 };
      store.envs.push(env);
      log('Created ' + PURPOSE[cfg.purpose].toLowerCase() + ' "' + name + '"');
    }
    save();
    dlg.close();
    if (action === 'open') { env.opened = (env.opened || 0) + 1; save(); window.open(linkFor(cfg), '_blank', 'noopener'); }
    toast(editing ? 'Environment updated' : 'Environment created', action === 'open' ? 'Opened in a new tab' : 'Use Copy link to share it');
    current = cfg.purpose === 'onboarding' && !editing ? 'onboarding' : (current === 'overview' ? 'environments' : current);
    if (location.hash !== '#' + current) location.hash = current; else render();
  });

  // ---------- shared row actions ----------
  view.addEventListener('click', function (e) {
    var t = e.target.closest('[data-copy],[data-edit],[data-dup],[data-del],[data-opened],[data-quick]');
    if (!t) return;
    if (t.dataset.quick) { e.preventDefault(); openEditor(null, t.dataset.quick); return; }
    var env = envById(t.dataset.copy || t.dataset.edit || t.dataset.dup || t.dataset.del || t.dataset.opened);
    if (!env) return;
    if (t.dataset.opened) { env.opened = (env.opened || 0) + 1; save(); return; }
    e.preventDefault();
    if (t.dataset.copy) { copy(linkFor(env.cfg)); log('Copied link for "' + env.name + '"'); }
    else if (t.dataset.edit) openEditor(env.id);
    else if (t.dataset.dup) {
      var c = { id: uid(), name: env.name + ' (copy)', cfg: E.clone(env.cfg), created: Date.now(), updated: Date.now(), followUp: env.followUp, notes: env.notes, steps: {}, opened: 0 };
      store.envs.push(c); log('Duplicated "' + env.name + '"'); render();
    } else if (t.dataset.del) {
      if (!confirm('Delete "' + env.name + '" for all admins? Links you already sent will keep working.')) return;
      store.envs = store.envs.filter(function (x) { return x !== env; });
      pendingDeletes.push(env.id);
      log('Deleted "' + env.name + '"'); toast('Deleted'); render();
    }
  });
  $('#new-env').addEventListener('click', function () { openEditor(null, 'sales'); });

  // ---------- routing ----------
  function route() {
    var v = location.hash.replace('#', '');
    current = TITLES[v] ? v : 'overview';
    render();
  }
  window.addEventListener('hashchange', function () { if (me) route(); });

  // ---------- sign-in (Clerk) ----------
  var screens = ['auth-loading', 'clerk-sign-in', 'denied'];
  function show(which) {
    var signedIn = which === 'app';
    $('#auth-screen').hidden = signedIn;
    $('#main').hidden = !signedIn;
    $('#who').hidden = $('#sign-out').hidden = !signedIn;
    screens.forEach(function (id) { $('#' + id).hidden = id !== which; });
    if (which !== 'clerk-sign-in') authError($('#login-error'), '');
  }
  function authError(el, msg) { el.textContent = msg; el.hidden = !msg; }

  var handledUser = null, signInMounted = false;
  function handleUser(user) {
    if (!user) {
      me = null; handledUser = null; store = { envs: [], log: [], defaults: null }; view.innerHTML = '';
      show('clerk-sign-in');
      if (!signInMounted) { clerk.mountSignIn($('#clerk-sign-in'), {
          forceRedirectUrl: location.href,
          // Sign-in only: an unknown Google account isn't turned into a new account, and there's no sign-up link.
          transferable: false,
          withSignUp: false,
          appearance: { elements: { footerAction: { display: 'none' } } }
        }); signInMounted = true; }
      return;
    }
    if (handledUser === user.id) return;
    handledUser = user.id;
    if (signInMounted) { clerk.unmountSignIn($('#clerk-sign-in')); signInMounted = false; }
    show('auth-loading');
    load().then(function () {
      $('#who').textContent = me;
      show('app'); route();
    }).catch(function (err) {
      handledUser = null;
      if (err.status === 403) { $('#denied-email').textContent = (err.data && err.data.email) || ''; show('denied'); return; }
      show('clerk-sign-in');
      authError($('#login-error'), err.message);
    });
  }
  function signOut() { clerk.signOut(); }
  document.addEventListener('click', function (e) { if (e.target.closest('[data-sign-out]')) signOut(); });

  function loadScript(src, attrs) {
    return new Promise(function (resolve, reject) {
      var el = document.createElement('script');
      el.src = src; el.crossOrigin = 'anonymous'; el.async = true;
      Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
      el.onload = resolve; el.onerror = function () { reject(new Error('load')); };
      document.head.appendChild(el);
    });
  }
  function signInUnavailable() {
    show('clerk-sign-in');
    authError($('#login-error'), 'The sign-in service didn\u2019t load. Check your connection or ad blocker, then reload.');
  }

  show('auth-loading');
  // The publishable key comes from Vercel's settings; Clerk's Frontend API host is encoded inside it.
  fetch('/api/config').then(function (r) { return r.json(); }).then(function (cfg) {
    var key = cfg.clerkPublishableKey;
    if (!key) throw new Error('missing key');
    var fapi = atob(key.split('_').pop()).replace(/\$$/, '');
    return loadScript('https://' + fapi + '/npm/@clerk/ui@1/dist/ui.browser.js')
      .then(function () { return loadScript('https://' + fapi + '/npm/@clerk/clerk-js@6/dist/clerk.browser.js', { 'data-clerk-publishable-key': key }); })
      .then(function () { return window.Clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } }); });
  }).then(function () {
    clerk = window.Clerk;
    clerk.addListener(function (state) { handleUser(state.user || null); });
    handleUser(clerk.user || null);
  }).catch(signInUnavailable);
})();
