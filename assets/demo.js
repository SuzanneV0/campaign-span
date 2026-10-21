/* Campaign Span — interactive demo (all data is in memory and resets on reload) */
(function () {
  'use strict';

  // ---------- helpers ----------
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function nice(s, long) { return parse(s).toLocaleDateString('en-US', long ? { weekday: 'short', month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric' }); }
  function niceTime(t) { if (!t) return ''; var h = +t.slice(0, 2), m = t.slice(3); return ((h % 12) || 12) + (m === '00' ? '' : ':' + m) + (h < 12 ? 'a' : 'p'); }
  function niceTimeLong(t) { var hh = +t.slice(0, 2); return ((hh % 12) || 12) + ':' + t.slice(3, 5) + (hh < 12 ? ' AM' : ' PM'); }
  function fmtNum(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n)); }
  function pct(x, dp) { return (x * 100).toFixed(dp == null ? 1 : dp) + '%'; }
  var TODAY = iso(new Date());

  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  // ---------- environment ----------
  // A custom environment (built in admin.html) arrives as ?env=...; otherwise the standard demo loads.
  var ENV_ERROR = null;
  var ENV = (function () {
    var raw = CSEnv.fromUrl();
    if (!raw) return CSEnv.normalize(null);
    try { return CSEnv.normalize(CSEnv.decode(raw)); }
    catch (e) { ENV_ERROR = 'This demo link is damaged, so the standard demo loaded instead.'; return CSEnv.normalize(null); }
  })();
  var IND; // the active brand's industry preset (see useBrand)

  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h; }
  var rand; // reseeded per brand so each brand's sample data is stable
  function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

  // ---------- reference data ----------
  var CHANNELS = CSEnv.CHANNELS;
  // The active brand's connected channels, and the rest of its data, are swapped in by useBrand()
  var ENABLED, SOCIAL, WEIGHTS, MONEY_CHANNELS;
  var DEPTS = CSEnv.DEPTS;
  var STATUSES = [['idea', 'Ideas'], ['brief', 'Briefing'], ['production', 'In production'], ['review', 'Review'], ['scheduled', 'Scheduled'], ['published', 'Published']];
  var STATUS_LABEL = {}; STATUSES.forEach(function (s) { STATUS_LABEL[s[0]] = s[1]; });

  var AV_COLORS = ['#B02E78', '#B8561A', '#0B7C77', '#820263', '#6B4FA0', '#0A66A8', '#2E294E', '#1E7A4C'];
  var people = ENV.people.map(function (p, i) { return { id: 'p' + i, name: p.name, dept: p.dept, color: AV_COLORS[i % AV_COLORS.length] }; });
  function person(id) { return people.find(function (p) { return p.id === id; }); }
  function initials(p) { return p.name.split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase(); }
  function avatar(p) { return '<span class="avatar" style="--av:' + p.color + '" title="' + esc(p.name) + '">' + esc(initials(p)) + '</span>'; }

  // People with access to a brand (the active one by default)
  function members(b) { b = b || B; return people.filter(function (p) { return b.access[p.id]; }); }
  // Role letters used by seed data → the first matching person on the active brand
  function inDept(d, nth) { var list = members().filter(function (p) { return p.dept === d; }); return list[nth || 0] || list[0]; }
  function role(r) {
    var p = { S: inDept('Social'), M: inDept('Marketing'), P: inDept('Production'), P2: inDept('Production', 1), B: inDept('Brand services'), X: inDept('Sales') }[r];
    return (p || members()[0] || people[0]).id;
  }

  // ---------- seed posts ----------
  // [typical reach, typical engagement rate] — email uses audience size and open rate
  var BASE = {
    instagram: [9000, .058], tiktok: [14000, .084], youtube: [6000, .047], x: [3000, .021], facebook: [4000, .026],
    threads: [2200, .041], bluesky: [1200, .045], linkedin: [2800, .032], pinterest: [3500, .019], email: [12000, .41]
  };
  var ALL_WEIGHTS = [['instagram', 8], ['tiktok', 3], ['youtube', 1], ['x', 3], ['facebook', 3], ['threads', 2], ['bluesky', 1], ['linkedin', 2], ['pinterest', 2], ['email', 3]];
  var OWNER = {
    instagram: ['S', 'd:Social'], tiktok: ['S', 'd:Social'], youtube: ['P', 'd:Production'], x: ['S'], facebook: ['S'],
    threads: ['S'], bluesky: ['B'], linkedin: ['X', 'd:Sales'], pinterest: ['B', 'd:Brand services'], email: ['M', 'd:Marketing']
  };
  function tagsFor(list) { return list.map(function (t) { return t.indexOf('d:') === 0 ? t : role(t); }).filter(function (t, i, a) { return a.indexOf(t) === i; }); }
  var TIMES = ['09:00', '11:30', '12:00', '15:00', '17:30', '19:00'];
  function weightedChannel() {
    var total = WEIGHTS.reduce(function (s, w) { return s + w[1]; }, 0), r = rand() * total;
    for (var i = 0; i < WEIGHTS.length; i++) { r -= WEIGHTS[i][1]; if (r <= 0) return WEIGHTS[i][0]; }
    return WEIGHTS[0][0];
  }

  var nextId = 1;
  var posts; // the active brand's calendar
  function seedPosts(data) {
    var posts = [];
    if (data === 'empty') return posts;
    var light = data === 'light';
    for (var off = light ? -35 : -70; off <= -1; off++) {
      var day = addDays(TODAY, off), dow = parse(day).getDay();
      var n = (dow === 0 || dow === 6) ? (rand() < .4 ? 1 : 0) : (rand() < .55 ? 1 : 2);
      if (light && rand() < .5) n = 0;
      for (var k = 0; k < n; k++) {
        var ch = weightedChannel(), b = BASE[ch];
        var reach = Math.round(b[0] * (0.6 + rand() * 0.8) * (1 + (off + 70) / 300));
        var rate = b[1] * (0.75 + rand() * 0.5) * (dow === 4 ? 1.3 : dow === 1 ? 0.85 : 1);
        posts.push({
          id: nextId++, title: pick(IND.titles[ch]), channel: ch, date: day, time: pick(TIMES),
          status: 'published', tags: tagsFor(OWNER[ch]), notes: '',
          reach: reach, engagements: Math.round(reach * rate)
        });
      }
    }
    // [days from today, time, channel, status, tags]; titles come from the industry preset
    var plan = [
      [0, '11:30', 'instagram', 'scheduled', ['S', 'd:Social']],
      [1, '09:00', 'email', 'review', ['M', 'd:Brand services']],
      [2, '17:30', 'tiktok', 'production', ['S', 'P']],
      [6, '12:00', 'youtube', 'production', ['P', 'P2', 'd:Production']],
      [7, '11:30', 'instagram', 'production', ['S', 'd:Social']],
      [7, '15:00', 'threads', 'brief', ['S']],
      [8, '09:00', 'email', 'brief', ['M', 'd:Marketing']],
      [9, '12:00', 'x', 'brief', ['X', 'd:Sales']],
      [10, '15:00', 'facebook', 'idea', ['S']],
      [11, '09:00', 'linkedin', 'brief', ['X', 'd:Sales']],
      [13, '19:00', 'pinterest', 'idea', ['B', 'd:Brand services']],
      [14, '11:30', 'instagram', 'idea', ['S', 'd:Production']],
      [15, '09:00', 'email', 'idea', ['M', 'd:Marketing']],
      [20, '17:30', 'tiktok', 'idea', ['S']],
      [21, '12:00', 'bluesky', 'idea', ['B']],
      [24, '11:30', 'instagram', 'idea', ['S', 'd:Social']]
    ];
    plan.forEach(function (f, i) {
      if (light && i >= 8) return;
      var c = ENABLED.indexOf(f[2]) !== -1 ? f[2] : (SOCIAL[i % Math.max(1, SOCIAL.length)] || ENABLED[0]);
      posts.push({ id: nextId++, date: addDays(TODAY, f[0]), time: f[1], channel: c, title: IND.future[i], status: f[3], tags: tagsFor(f[4]), notes: '' });
    });
    return posts;
  }

  // ---------- monetization ----------
  // Platforms that pay creators directly. Amounts are estimates in USD, the currency these programs pay out in.
  var MONETIZATION = {
    youtube: { rpm: 4.5, share: .9, mix: { ads: .75, subs: .15, tips: .10, bonus: 0 }, programs: 'AdSense ads, channel memberships, Super Thanks' },
    facebook: { rpm: 1.2, share: .6, mix: { ads: .70, subs: .15, tips: .15, bonus: 0 }, programs: 'In-stream ads, subscriptions, Stars' },
    instagram: { rpm: .35, share: .4, mix: { ads: 0, subs: .35, tips: .25, bonus: .40 }, programs: 'Subscriptions, gifts, bonuses' },
    tiktok: { rpm: .6, share: .5, mix: { ads: 0, subs: .10, tips: .30, bonus: .60 }, programs: 'Creator Rewards Program, LIVE gifts, subscriptions' },
    x: { rpm: .25, share: .6, mix: { ads: .70, subs: .30, tips: 0, bonus: 0 }, programs: 'Creator ad revenue sharing, subscriptions' }
  };
  var REV_SOURCES = [['ads', 'Ad revenue'], ['subs', 'Subscriptions & memberships'], ['tips', 'Tips & gifts'], ['bonus', 'Bonuses & creator programs']];
  function seedRevenue(posts) {
    var revRand = rng(hash(B.name + ':revenue') || 7);
    posts.forEach(function (p) {
      var m = MONETIZATION[p.channel];
      if (!m || p.status !== 'published' || !p.reach) return;
      p.monetized = revRand() < m.share;
      if (!p.monetized) return;
      var total = p.reach / 1000 * m.rpm * (0.6 + revRand() * 0.8);
      p.revenue = {};
      REV_SOURCES.forEach(function (src) { p.revenue[src[0]] = Math.round(total * m.mix[src[0]] * 100) / 100; });
    });
  }
  function revTotal(p) { return p.revenue ? REV_SOURCES.reduce(function (t, src) { return t + p.revenue[src[0]]; }, 0) : 0; }
  function money(n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  // Per-channel totals for published posts in [from, to)
  function monetization(from, to) {
    var rows = MONEY_CHANNELS.map(function (c) {
      var r = { channel: c, posts: 0, monetized: 0, views: 0, revenue: 0, src: { ads: 0, subs: 0, tips: 0, bonus: 0 } };
      posts.forEach(function (p) {
        if (p.channel !== c || p.status !== 'published' || !p.reach || p.date < from || p.date >= to) return;
        r.posts++;
        if (!p.revenue) return;
        r.monetized++; r.views += p.reach; r.revenue += revTotal(p);
        REV_SOURCES.forEach(function (src) { r.src[src[0]] += p.revenue[src[0]]; });
      });
      r.rpm = r.views ? r.revenue / r.views * 1000 : 0;
      return r;
    });
    var total = rows.reduce(function (t, r) { t.revenue += r.revenue; t.views += r.views; t.monetized += r.monetized; return t; }, { revenue: 0, views: 0, monetized: 0 });
    total.rpm = total.views ? total.revenue / total.views * 1000 : 0;
    return { rows: rows, total: total };
  }

  // ---------- state ----------
  var state = {
    view: 'calendar',
    brand: 'b0',
    viewer: null, // a person id when "Viewing as" a specific person; null for the workspace admin
    role: 'all',
    calMonth: TODAY.slice(0, 8) + '01',
    calChannel: 'all',
    selDay: TODAY,
    prodTab: 'brief',
    fileFolder: 'All',
    fileQuery: '',
    deptSettings: {},
    notifications: []
  };
  DEPTS.forEach(function (d) {
    var s = ENV.notify[d] || '';
    state.deptSettings[d] = { app: s.indexOf('a') !== -1, email: s.indexOf('e') !== -1, slack: s.indexOf('s') !== -1 };
  });

  // ---------- production ----------
  var project, files; // the active brand's production project and files
  function crewName(r) { var p = person(role(r)); return p ? p.name : 'TBD'; }
  function toMin(t) { return (+t.slice(0, 2)) * 60 + (+t.slice(3, 5)); }
  function fromMin(n) { n = Math.max(0, Math.min(23 * 60 + 59, n)); return pad(Math.floor(n / 60)) + ':' + pad(n % 60); }
  var CREW_TITLE = { P: 'Director of photography', P2: 'Camera operator', B: 'Wardrobe and brand lead', S: 'Social and BTS', M: 'Producer', X: 'Client liaison' };
  var csId = 1;
  function hoursBetween(call, wrap) { return Math.round((toMin(wrap) - toMin(call)) / 60 * 100) / 100; } // 10.25, 7.5, 9
  function personActivities(id) {
    return project.schedule.filter(function (r) { return id && r.owner === id; }).sort(function (a, b) { return a.time.localeCompare(b.time); });
  }
  // Sample production project, call sheet and files for the active brand
  function seedProduction(seeded) {
    var P = IND.project;
    var project = {
      name: P.name,
      shootDate: addDays(TODAY, 4),
      brief: P.brief,
      goals: P.goals.slice(),
      audience: P.audience,
      deliverables: seeded ? [IND.future[3], IND.future[4], IND.future[2], IND.future[6]] : [],
      logistics: [
        ['Location', P.location],
        ['Call / wrap', niceTime(P.schedule[0][0]) + ' – ' + niceTime(P.schedule[P.schedule.length - 1][0])],
        ['Crew', crewName('P') + ' (DP), ' + crewName('P2') + ' (camera), 1 gaffer, 1 stylist'],
        ['Talent', P.talent],
        ['Budget', P.budget]
      ],
      schedule: seeded ? P.schedule.map(function (r) { return { time: r[0], item: r[1], owner: r[2] ? role(r[2]) : '' }; }) : [],
      equipment: seeded ? CSEnv.clone(CSEnv.KIT) : []
    };

    // Everyone working the shoot day: in-house team (from the schedule) plus outside crew and talent
    project.callSheet = !seeded ? [] : (function () {
      var start = toMin(P.schedule[0][0]), end = toMin(P.schedule[P.schedule.length - 1][0]);
      var out = [], seen = {};
      function addInternal(r, call, wrap) {
        var id = role(r); if (seen[id]) return; seen[id] = 1;
        out.push({ id: csId++, personId: id, name: person(id).name, role: CREW_TITLE[r], type: 'Crew', call: fromMin(call), wrap: fromMin(wrap), status: 'Confirmed' });
      }
      addInternal('M', start - 30, end + 30); // producer opens and closes the day
      P.schedule.forEach(function (r) {
        if (!r[2]) return;
        addInternal(r[2], r[2] === 'P' ? start : toMin(r[0]) - 30, r[2] === 'P' ? end + 30 : end);
      });
      (P.callSheet || []).forEach(function (c) {
        out.push({ id: csId++, personId: '', name: c[0], role: c[1], type: c[2], call: c[3], wrap: c[4], status: c[5] || 'Confirmed' });
      });
      return out;
    })();

    var firstWord = B.name.split(/\s+/)[0];
    var files = !seeded ? [] : [
      { name: P.name + ' – Creative brief.pdf', folder: 'Briefs', size: 1.2e6, owner: role('M'), updated: addDays(TODAY, -6) },
      { name: 'Shot list v3.xlsx', folder: 'Briefs', size: 84e3, owner: role('P'), updated: addDays(TODAY, -2) },
      { name: 'Call sheet.pdf', folder: 'Briefs', size: 310e3, owner: role('P'), updated: addDays(TODAY, -1) },
      { name: 'Moodboard.png', folder: 'Brand assets', size: 6.4e6, owner: role('B'), updated: addDays(TODAY, -9) },
      { name: firstWord + ' logo pack.zip', folder: 'Brand assets', size: 18.2e6, owner: role('B'), updated: addDays(TODAY, -40) },
      { name: 'Brand guidelines 2026.pdf', folder: 'Brand assets', size: 9.8e6, owner: role('B'), updated: addDays(TODAY, -60) },
      { name: 'Last launch selects.zip', folder: 'Finals', size: 412e6, owner: role('P2'), updated: addDays(TODAY, -120) },
      { name: 'Newsletter #40 – final.html', folder: 'Finals', size: 46e3, owner: role('M'), updated: addDays(TODAY, -7) },
      { name: 'Teaser_v2_vertical.mp4', folder: 'Raw footage', size: 286e6, owner: role('P'), updated: addDays(TODAY, -3) },
      { name: 'Release forms.pdf', folder: 'Contracts', size: 2.1e6, owner: role('M'), updated: addDays(TODAY, -5) }
    ];
    return { project: project, files: files };
  }
  var FOLDERS = ['All', 'Briefs', 'Brand assets', 'Raw footage', 'Finals', 'Contracts'];
  function fmtSize(b) { return b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b >= 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB'; }

  // ---------- tags & notifications ----------
  function tagLabel(t) { return t.indexOf('d:') === 0 ? '#' + t.slice(2) : '@' + (person(t) ? person(t).name : t); }
  function tagDepts(tags) {
    var set = {};
    tags.forEach(function (t) {
      if (t.indexOf('d:') === 0) set[t.slice(2)] = 1;
      else if (person(t)) set[person(t).dept] = 1;
    });
    return Object.keys(set);
  }
  function viaFor(depts) {
    var on = { app: 0, email: 0, slack: 0 };
    depts.forEach(function (d) { var s = state.deptSettings[d]; if (s) Object.keys(on).forEach(function (k) { if (s[k]) on[k] = 1; }); });
    var out = [];
    if (on.app) out.push('App'); if (on.email) out.push('Email'); if (on.slack) out.push('Slack');
    return out.join(' · ') || 'No channels enabled';
  }
  function notify(title, detail, tags, silent, brandId) {
    var depts = tagDepts(tags);
    var n = { id: Date.now() + Math.random(), at: new Date(), brand: brandId || B.id, title: title, detail: detail, who: tags.map(tagLabel).join(', '), depts: depts, via: viaFor(depts), unread: true };
    state.notifications.unshift(n);
    renderBell();
    if (!silent) toast(title, 'Notified ' + n.who + ' via ' + n.via);
  }
  function visibleNotifs() {
    return state.notifications.filter(function (n) {
      var b = brandById(n.brand);
      if (state.viewer && !(b && b.access[state.viewer])) return false;
      return state.role === 'all' || n.depts.indexOf(state.role) !== -1;
    });
  }

  // A few starting notifications for the active brand
  function seedNotifs() {
    var seed = [
      ['New project: ' + project.name, 'Created by ' + person(role('M')).name, [role('M'), 'd:Production', 'd:Social']],
      ['You were assigned: ' + IND.future[4], 'Due ' + nice(addDays(TODAY, 7)), [role('S')]],
      ['Ready for brand review: ' + IND.future[1], 'Publishes ' + nice(addDays(TODAY, 1)), ['d:Brand services']],
      ['Deadline moved: ' + IND.future[3], nice(addDays(TODAY, 5)) + ' → ' + nice(addDays(TODAY, 6)), [role('P'), 'd:Production', 'd:Social']]
    ];
    seed.forEach(function (s, i) {
      notify(s[0], s[1], s[2], true);
      state.notifications[0].at = new Date(Date.now() - (seed.length - i) * 3.6e6 * 5 - brands.length * 2.4e6);
    });
  }


  // ---------- brands ----------
  // One workspace, several brands. Each brand has its own calendar, production project, files, connected
  // accounts and analytics. People belong to the workspace and get a role on each brand they can access.
  var PLAN = CSEnv.PLANS[ENV.plan];
  var ROLE_LABEL = CSEnv.BRAND_ROLES;
  var brands = [], B = null;
  function brandById(id) { return brands.find(function (b) { return b.id === id; }); }

  // Swap the active brand's data into the variables the views read
  function useBrand(b) {
    B = b;
    IND = CSEnv.INDUSTRIES[b.industry];
    ENABLED = b.channels;
    SOCIAL = ENABLED.filter(function (c) { return c !== 'email'; });
    WEIGHTS = ALL_WEIGHTS.filter(function (w) { return ENABLED.indexOf(w[0]) !== -1; });
    MONEY_CHANNELS = ENABLED.filter(function (c) { return MONETIZATION[c]; });
    posts = b.posts; project = b.project; files = b.files;
  }
  // Run fn with another brand active, then switch back
  function withBrand(b, fn) { var prev = B; useBrand(b); try { return fn(); } finally { if (prev) useBrand(prev); } }

  // Sample access: everyone is on the first brand; each extra brand gets part of the team, with one brand lead
  function sampleAccess(i) {
    var access = {}, list = i === 0 ? people : people.filter(function (p, k) { return (k + i) % 3 !== 0; });
    if (!list.length) list = people.slice(0, 1);
    list.forEach(function (p) { access[p.id] = 'editor'; });
    var lead = list.find(function (p) { return p.dept === 'Marketing'; }) || list[0];
    access[lead.id] = 'lead';
    if (i > 0 && list.length >= 3) access[list[list.length - 1].id] = 'viewer';
    return access;
  }
  function addBrand(def, data, access) {
    var b = { id: 'b' + brands.length, name: def.name, industry: def.industry, color: def.color, channels: def.channels.slice(), access: access, posts: [], project: null, files: [] };
    brands.push(b);
    withBrand(b, function () {
      rand = rng(hash(b.name + b.industry) || 20261002);
      b.posts = posts = seedPosts(data);
      seedRevenue(posts);
      var pr = seedProduction(data !== 'empty');
      b.project = project = pr.project; b.files = files = pr.files;
      if (data !== 'empty') seedNotifs();
    });
    return b;
  }

  // What the current viewer can do. The workspace admin ("all") manages every brand.
  function roleOn(b) { return state.viewer ? b.access[state.viewer] || null : 'admin'; }
  function myBrands() { return brands.filter(roleOn); }
  function canEdit(b) { var r = roleOn(b || B); return r === 'admin' || r === 'lead' || r === 'editor'; }
  function canManage(b) { var r = roleOn(b || B); return r === 'admin' || r === 'lead'; }
  function isAdmin() { return !state.viewer; }
  function brandLimitText() { return PLAN.brands === Infinity ? 'Unlimited brands on ' + PLAN.label : brands.length + ' of ' + PLAN.brands + ' brands on ' + PLAN.label; }

  function switchBrand(id, quiet) {
    var b = brandById(id);
    if (!b || !roleOn(b)) return;
    state.brand = b.id;
    useBrand(b);
    if (state.calChannel !== 'all' && ENABLED.indexOf(state.calChannel) === -1) state.calChannel = 'all';
    state.fileFolder = 'All'; state.fileQuery = '';
    renderBrandPicker();
    if (!quiet) render();
  }
  // Keep the active brand one the viewer can open
  function ensureBrand() {
    var mine = myBrands();
    if (mine.length && !roleOn(B)) switchBrand(mine[0].id, true);
    renderBrandPicker();
  }
  function renderBrandPicker() {
    var mine = myBrands(), sel = $('#brand-select');
    sel.innerHTML = mine.length ? mine.map(function (b) { return '<option value="' + b.id + '"' + (b === B ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('') : '<option>No brands yet</option>';
    sel.disabled = mine.length < 2;
    var r = mine.length ? roleOn(B) : null;
    $('.ws-name small').textContent = (ENV.purpose === 'onboarding' ? 'Onboarding workspace' : 'Demo workspace') + (brands.length > 1 ? ' \u00b7 ' + brands.length + ' brands' : '');
    $('#brand-note').textContent = !mine.length ? 'Not assigned to any brand yet.' : r === 'admin' ? brandLimitText() + '.' : 'Your role here: ' + ROLE_LABEL[r] + '.';
  }

  // The company is the first brand; the demo settings can add more
  [{ name: ENV.company, industry: ENV.industry, color: ENV.color, channels: ENV.channels }].concat(ENV.brands).forEach(function (def, i) {
    addBrand(def, ENV.data, sampleAccess(i));
  });
  useBrand(brands[0]);

  // ---------- toast & tooltip ----------
  function toast(msg, sub) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = esc(msg) + (sub ? '<small>' + esc(sub) + '</small>' : '');
    $('#toasts').appendChild(el);
    setTimeout(function () { el.remove(); }, 4200);
  }
  var tip = $('#tip');
  function showTip(target, x, y) {
    tip.innerHTML = target.getAttribute('data-tip');
    tip.hidden = false;
    var r = tip.getBoundingClientRect();
    var left = Math.min(window.innerWidth - r.width - 8, Math.max(8, x + 12));
    var top = y - r.height - 12; if (top < 8) top = y + 16;
    tip.style.left = left + 'px'; tip.style.top = top + 'px';
  }
  document.addEventListener('pointermove', function (e) {
    var t = e.target.closest && e.target.closest('[data-tip]');
    if (t) showTip(t, e.clientX, e.clientY); else tip.hidden = true;
  });
  document.addEventListener('focusin', function (e) {
    var t = e.target.closest && e.target.closest('[data-tip]');
    if (t) { var r = t.getBoundingClientRect(); showTip(t, r.left + r.width / 2, r.top); } else tip.hidden = true;
  });
  document.addEventListener('focusout', function () { tip.hidden = true; });

  // ---------- filters ----------
  function inRole(p) {
    if (state.role === 'all') return true;
    return tagDepts(p.tags).indexOf(state.role) !== -1;
  }
  function chipHtml(p, extra) {
    return '<button type="button" class="chip c-' + p.channel + (extra || '') + '" draggable="true" data-id="' + p.id + '" title="' + esc(CHANNELS[p.channel] + ' · ' + p.title + ' · ' + STATUS_LABEL[p.status]) + '">' +
      '<span class="tm">' + niceTime(p.time) + '</span>' + esc(p.title) + '</button>';
  }

  function gapRuns(days) {
    days = days || 28;
    var runs = [], cur = null;
    for (var i = 0; i < days; i++) {
      var d = addDays(TODAY, i);
      var empty = !posts.some(function (p) { return p.date === d; });
      if (empty) { if (!cur) cur = [d, d]; else cur[1] = d; }
      else if (cur) { runs.push(cur); cur = null; }
    }
    if (cur) runs.push(cur);
    return runs.filter(function (r) { return parse(r[1]) - parse(r[0]) >= 86400000; });
  }

  // ---------- views ----------
  var view = $('#view');
  var TITLES_BY_VIEW = { brands: 'All brands', calendar: 'Calendar', board: 'Board', analytics: 'Analytics', production: 'Production', files: 'Files', team: 'Team' };

  function render() {
    // Brands and Team cover the whole workspace; every other view shows the active brand
    var brandView = state.view !== 'brands' && state.view !== 'team';
    var hasBrand = myBrands().length > 0;
    $('#view-title').textContent = TITLES_BY_VIEW[state.view];
    var vb = $('#view-brand');
    vb.hidden = !brandView || !hasBrand;
    vb.innerHTML = '<i style="--bc:' + esc(B.color) + '"></i>' + esc(B.name);
    $('#new-entry').hidden = !brandView || !hasBrand || !canEdit();
    $('.menu-wrap').hidden = !brandView || !hasBrand;
    $$('.app-nav a').forEach(function (a) {
      if (a.dataset.view === state.view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (brandView && !hasBrand) {
      view.innerHTML = '<div class="panel"><p class="empty">' + esc(person(state.viewer).name) + ' isn\u2019t assigned to any brand yet.<br>A workspace admin can add them in Team \u2192 Brand access.</p></div>';
      return;
    }
    ({ brands: renderBrands, calendar: renderCalendar, board: renderBoard, analytics: renderAnalytics, production: renderProduction, files: renderFiles, team: renderTeam })[state.view]();
    if (brandView && !canEdit()) lockView();
  }

  // Viewers can look, filter and export, but not change anything
  function lockView() {
    $$('#view form, #view .add-btn, #view [data-add], #view .upload-label, #view [data-cs-remove], #view [data-cs-addperson], #view [data-reco]').forEach(function (el) { el.hidden = true; });
    $$('#view input, #view select, #view textarea').forEach(function (el) { if (!el.hasAttribute('data-ro-ok')) el.disabled = true; });
    $$('#view [draggable]').forEach(function (el) { el.setAttribute('draggable', 'false'); });
    view.insertAdjacentHTML('afterbegin', '<div class="notice ro-note">You have <strong>view-only</strong> access to ' + esc(B.name) + '. Ask a brand lead or workspace admin if you need to make changes.</div>');
  }

  // All brands: one place to see and manage every brand you can access
  function brandStats(b) {
    return withBrand(b, function () {
      var from = addDays(TODAY, -30), cur = analyze(from, TODAY);
      return {
        planned: posts.filter(function (p) { return p.date >= TODAY && p.date <= addDays(TODAY, 13); }).length,
        gaps: gapRuns(14).length,
        notReady: posts.filter(function (p) { return p.date >= TODAY && p.date <= addDays(TODAY, 3) && p.status !== 'scheduled' && p.status !== 'published'; }).length,
        posts: cur.posts, reach: cur.reach, er: cur.er,
        revenue: MONEY_CHANNELS.length ? monetization(from, TODAY).total.revenue : null
      };
    });
  }
  function renderBrands() {
    var mine = myBrands(), stats = {};
    mine.forEach(function (b) { stats[b.id] = brandStats(b); });
    var h = '<p class="muted" style="margin:0 0 14px;font-size:.92rem">' + (isAdmin()
      ? 'Every brand in the ' + esc(ENV.company) + ' workspace. Each has its own calendar, production, connected accounts and reporting. ' + esc(brandLimitText()) + '.'
      : 'The brands ' + esc(person(state.viewer).name) + ' can access, and their role on each.') + '</p>';
    if (!mine.length) h += '<div class="panel"><p class="empty">Not assigned to any brand yet.</p></div>';
    h += '<div class="brand-grid">' + mine.map(function (b) {
      var st = stats[b.id], r = roleOn(b), team = members(b);
      var flags = (st.gaps ? '<span class="tag warn">' + st.gaps + ' gap' + (st.gaps > 1 ? 's' : '') + ' in the next 2 weeks</span>' : '<span class="tag ok">No gaps in the next 2 weeks</span>') +
        (st.notReady ? ' <span class="tag warn">' + st.notReady + ' not ready to publish</span>' : '');
      var editing = state.editAccounts === b.id;
      return '<div class="panel brand-card" style="--bc:' + esc(b.color) + '">' +
        '<div class="bc-head"><span class="ws-dot" style="background:' + esc(b.color) + ';width:28px;height:28px;border-radius:8px"></span><div><h3>' + esc(b.name) + '</h3><small>' + esc(CSEnv.INDUSTRIES[b.industry].label) + '</small></div>' +
        '<span class="tag ' + (r === 'viewer' ? 'neutral' : '') + '">' + (r === 'admin' ? 'Admin' : ROLE_LABEL[r]) + '</span></div>' +
        '<div class="bc-stats"><div><small>Planned, 14 days</small><strong>' + st.planned + '</strong></div><div><small>Reach, 30 days</small><strong>' + fmtNum(st.reach) + '</strong></div><div><small>Engagement</small><strong>' + pct(st.er) + '</strong></div></div>' +
        '<div>' + flags + '</div>' +
        '<div class="bc-accounts"><small>Connected accounts</small>' + (editing
          ? '<div class="bc-edit">' + Object.keys(CHANNELS).map(function (c) { return '<label><input type="checkbox" data-acc="' + b.id + ':' + c + '"' + (b.channels.indexOf(c) !== -1 ? ' checked' : '') + '>' + CHANNELS[c] + '</label>'; }).join('') + '</div>'
          : b.channels.map(function (c) { return '<span class="chip c-' + c + '">' + CHANNELS[c] + '</span>'; }).join('')) +
        (canManage(b) ? '<button class="btn btn-ghost btn-sm" type="button" data-acc-edit="' + b.id + '">' + (editing ? 'Done' : 'Manage') + '</button>' : '') + '</div>' +
        '<div class="bc-foot"><span class="avatars">' + team.slice(0, 6).map(avatar).join('') + (team.length > 6 ? '<span class="muted" style="font-size:.8rem;margin-left:6px">+' + (team.length - 6) + '</span>' : '') + '</span>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-go="' + b.id + ':analytics">Analytics</button>' +
        '<button class="btn btn-primary btn-sm" type="button" data-go="' + b.id + ':calendar">Open calendar</button></div></div>';
    }).join('') + '</div>';

    if (mine.length > 1) {
      h += '<div class="panel" style="margin-top:16px"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start"><div><h3>Compare brands</h3><p class="sub" style="margin-bottom:0">Last 30 days of results and the next 2 weeks of each calendar.</p></div>' +
        '<button class="btn btn-ghost btn-sm" type="button" id="brands-export">Download comparison (.csv)</button></div>' +
        '<div class="table-wrap" style="margin-top:12px"><table class="data-table"><thead><tr><th>Brand</th><th class="num">Planned, 14 days</th><th class="num">Gaps</th><th class="num">Posts, 30 days</th><th class="num">Social reach</th><th class="num">Engagement rate</th><th class="num">Est. revenue</th></tr></thead><tbody>' +
        mine.map(function (b) {
          var st = stats[b.id];
          return '<tr><td><i class="brand-dot" style="--bc:' + esc(b.color) + ';margin-right:8px"></i><strong>' + esc(b.name) + '</strong></td><td class="num">' + st.planned + '</td><td class="num">' + st.gaps + '</td><td class="num">' + st.posts + '</td>' +
            '<td class="num">' + st.reach.toLocaleString() + '</td><td class="num">' + pct(st.er) + '</td><td class="num">' + (st.revenue == null ? '\u2014' : money(st.revenue)) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }

    if (isAdmin()) {
      var full = brands.length >= PLAN.brands;
      h += '<div class="panel" style="margin-top:16px"><h3>Add a brand</h3><p class="sub">' + esc(brandLimitText()) + '. A new brand starts with an empty calendar. Assign people to it in Team.</p>' +
        (full ? '<div class="notice">Your ' + PLAN.label + ' plan includes ' + PLAN.brands + ' brand' + (PLAN.brands === 1 ? '' : 's') + ', and ' + (PLAN.brands === 1 ? 'it\u2019s' : 'all are') + ' in use. <a href="pricing.html">Compare plans</a> to add more.</div>'
          : '<form class="add-brand" id="brand-form"><input type="text" id="nb-name" placeholder="Brand name" maxlength="60" required aria-label="Brand name">' +
            '<select id="nb-industry" aria-label="Industry">' + Object.keys(CSEnv.INDUSTRIES).map(function (k) { return '<option value="' + k + '">' + esc(CSEnv.INDUSTRIES[k].label) + '</option>'; }).join('') + '</select>' +
            '<input type="color" id="nb-color" value="#B8561A" aria-label="Brand colour"><button class="btn btn-primary btn-sm" type="submit">Add brand</button></form>') + '</div>';
    }
    view.innerHTML = h;

    $$('[data-go]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var parts = btn.dataset.go.split(':');
        switchBrand(parts[0], true);
        location.hash = parts[1];
      });
    });
    $$('[data-acc-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () { state.editAccounts = state.editAccounts === btn.dataset.accEdit ? null : btn.dataset.accEdit; render(); });
    });
    $$('[data-acc]').forEach(function (box) {
      box.addEventListener('change', function () {
        var parts = box.dataset.acc.split(':'), b = brandById(parts[0]), c = parts[1];
        if (!box.checked && b.channels.length === 1) { box.checked = true; toast('Keep at least one account connected', b.name + ' needs a channel to plan content for.'); return; }
        b.channels = Object.keys(CHANNELS).filter(function (k) { return k === c ? box.checked : b.channels.indexOf(k) !== -1; });
        if (b === B) useBrand(b);
        notify(CHANNELS[c] + (box.checked ? ' connected to ' : ' disconnected from ') + b.name, box.checked ? 'Results start syncing within a day.' : 'Past results stay in reports. New posts can\u2019t be scheduled there.', ['d:Social', 'd:Marketing'], false, b.id);
      });
    });
    var be = $('#brands-export');
    if (be) be.addEventListener('click', function () {
      var lines = ['# ' + ENV.company + ' brand comparison, ' + addDays(TODAY, -30) + ' to ' + addDays(TODAY, -1),
        ['Brand', 'Industry', 'Planned (next 14 days)', 'Gaps (next 14 days)', 'Posts (last 30 days)', 'Social reach', 'Engagement rate', 'Est. revenue (USD)', 'Connected accounts', 'People'].join(',')]
        .concat(mine.map(function (b) {
          var st = stats[b.id];
          return [b.name, CSEnv.INDUSTRIES[b.industry].label, st.planned, st.gaps, st.posts, st.reach, (st.er * 100).toFixed(2) + '%', st.revenue == null ? '' : st.revenue.toFixed(2),
            b.channels.map(function (c) { return CHANNELS[c]; }).join('; '), members(b).length].map(csvCell).join(',');
        }));
      download(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'campaign-span-brands-' + TODAY + '.csv');
      toast('Brand comparison downloaded', mine.length + ' brands');
    });
    var bf = $('#brand-form');
    if (bf) bf.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#nb-name').value.trim();
      if (!name) { $('#nb-name').focus(); return; }
      if (brands.some(function (b) { return b.name.toLowerCase() === name.toLowerCase(); })) { toast('There\u2019s already a brand called ' + name); return; }
      var lead = people.find(function (p) { return p.dept === 'Marketing'; }) || people[0], access = {};
      access[lead.id] = 'lead';
      var b = addBrand({ name: name, industry: $('#nb-industry').value, color: $('#nb-color').value, channels: ['instagram', 'email'] }, 'empty', access);
      notify('New brand: ' + b.name, lead.name + ' is brand lead. Connect its accounts and add people in Team.', [lead.id], false, b.id);
      renderBrandPicker(); render();
    });
  }

  // Calendar
  function renderCalendar() {
    var m = parse(state.calMonth), year = m.getFullYear(), mon = m.getMonth();
    var startOffset = (new Date(year, mon, 1).getDay() + 6) % 7;
    var dim = new Date(year, mon + 1, 0).getDate();
    var cells = Math.ceil((startOffset + dim) / 7) * 7;
    var gaps = {};
    gapRuns().forEach(function (r) { for (var d = r[0]; d <= r[1]; d = addDays(d, 1)) gaps[d] = 1; });

    var opts = '<option value="all">All channels</option>' + ENABLED.map(function (c) {
      return '<option value="' + c + '"' + (state.calChannel === c ? ' selected' : '') + '>' + CHANNELS[c] + '</option>';
    }).join('');

    var h = '<div class="toolbar">' +
      '<button class="icon-btn" type="button" data-cal="-1" aria-label="Previous month">‹</button>' +
      '<button class="icon-btn" type="button" data-cal="1" aria-label="Next month">›</button>' +
      '<h2>' + m.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + '</h2>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-cal="0">Today</button>' +
      '<span class="spacer"></span>' +
      '<span class="legend-note"><span class="legend-swatch"></span>Gap: 2+ days with nothing planned</span>' +
      '<label class="sr-only" for="cal-channel">Channel</label><select id="cal-channel" aria-label="Filter by channel" data-ro-ok>' + opts + '</select>' +
      '</div>';
    if (state.role !== 'all') h += '<p class="muted" style="font-size:.85rem;margin:-4px 0 10px">Showing entries tagged to <strong>' + esc(state.role) + '</strong>. Other entries are dimmed.</p>';
    h += '<div class="cal" id="cal">';
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(function (d) { h += '<div class="cal-dow">' + d + '</div>'; });
    for (var i = 0; i < cells; i++) {
      var date = new Date(year, mon, 1 - startOffset + i), s = iso(date);
      var dayPosts = posts.filter(function (p) { return p.date === s && (state.calChannel === 'all' || p.channel === state.calChannel); })
        .sort(function (a, b) { return (a.time || '').localeCompare(b.time || ''); });
      var cls = 'cal-day' + (date.getMonth() !== mon ? ' out' : '') + (s === TODAY ? ' today' : '') + (gaps[s] ? ' gap' : '');
      h += '<div class="' + cls + '" data-date="' + s + '">' +
        '<div class="cal-day-head"><span class="cal-num">' + date.getDate() + '</span>' +
        '<button type="button" class="add-btn" data-add="' + s + '" aria-label="Add entry on ' + nice(s, true) + '">+</button></div>' +
        dayPosts.map(function (p) { return chipHtml(p, inRole(p) ? '' : ' dim'); }).join('') +
        '</div>';
    }
    h += '</div>';

    // Day agenda (handy on phones, where entries show as color bars)
    var sel = posts.filter(function (p) { return p.date === state.selDay; }).sort(function (a, b) { return (a.time || '').localeCompare(b.time || ''); });
    h += '<div class="panel" style="margin-top:16px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">' +
      '<h3 style="margin:0">' + nice(state.selDay, true) + (state.selDay === TODAY ? ' · Today' : '') + '</h3>' +
      '<button class="btn btn-ghost btn-sm" type="button" data-add="' + state.selDay + '">+ Add entry</button></div>' +
      (sel.length ? '<div style="display:grid;gap:8px;margin-top:12px">' + sel.map(function (p) {
        return '<button type="button" class="kcard" data-open="' + p.id + '" style="cursor:pointer"><div class="row"><span class="chip c-' + p.channel + '">' + CHANNELS[p.channel] + '</span><span>' + niceTime(p.time) + ' · ' + STATUS_LABEL[p.status] + '</span></div>' +
          '<span class="t">' + esc(p.title) + '</span><div class="tags">' + p.tags.map(function (t) { return '<span class="tag">' + esc(tagLabel(t)) + '</span>'; }).join('') + '</div></button>';
      }).join('') + '</div>' : '<p class="muted" style="margin:10px 0 0;font-size:.9rem">Nothing planned for this day.</p>') +
      '</div>';
    view.innerHTML = h;

    $('#cal-channel').addEventListener('change', function (e) { state.calChannel = e.target.value; render(); });
    $$('[data-cal]').forEach(function (b) {
      b.addEventListener('click', function () {
        var dir = +b.dataset.cal;
        if (dir === 0) { state.calMonth = TODAY.slice(0, 8) + '01'; state.selDay = TODAY; }
        else { var d = parse(state.calMonth); d.setMonth(d.getMonth() + dir); state.calMonth = iso(d); }
        render();
      });
    });
    $$('.cal-day').forEach(function (cell) {
      cell.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        state.selDay = cell.dataset.date; render();
      });
    });
    wireDrag('.cal-day .chip', '.cal-day', function (id, cell) { movePost(id, cell.dataset.date); });
  }

  function movePost(id, date) {
    var p = posts.find(function (x) { return x.id === id; });
    if (!p || p.date === date) return;
    var old = p.date; p.date = date;
    notify('Deadline changed: ' + p.title, nice(old) + ' → ' + nice(date), p.tags);
    render();
  }

  // Generic HTML5 drag-and-drop
  function wireDrag(itemSel, zoneSel, onDrop) {
    var dragId = null;
    $$(itemSel).forEach(function (el) {
      el.addEventListener('dragstart', function (e) {
        if (!canEdit()) { e.preventDefault(); return; }
        dragId = +el.dataset.id; el.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', String(dragId)); } catch (err) {}
      });
      el.addEventListener('dragend', function () { el.classList.remove('dragging'); $$('.drop').forEach(function (z) { z.classList.remove('drop'); }); });
    });
    $$(zoneSel).forEach(function (z) {
      z.addEventListener('dragover', function (e) { if (dragId == null) return; e.preventDefault(); z.classList.add('drop'); });
      z.addEventListener('dragleave', function (e) { if (!z.contains(e.relatedTarget)) z.classList.remove('drop'); });
      z.addEventListener('drop', function (e) { e.preventDefault(); z.classList.remove('drop'); if (dragId != null) onDrop(dragId, z); dragId = null; });
    });
  }

  // Board
  function renderBoard() {
    var h = '<div class="toolbar"><p class="muted" style="margin:0;font-size:.9rem">Drag cards between columns. Calendar entries update instantly and tagged people are notified.</p></div><div class="board">';
    STATUSES.forEach(function (s) {
      var list = posts.filter(function (p) { return p.status === s[0] && inRole(p); });
      var more = 0;
      if (s[0] === 'published') {
        list.sort(function (a, b) { return b.date.localeCompare(a.date); });
        more = Math.max(0, list.length - 5); list = list.slice(0, 5);
      } else list.sort(function (a, b) { return a.date.localeCompare(b.date); });
      h += '<div class="col" data-status="' + s[0] + '"><div class="col-head">' + s[1] + '<span>' + (list.length + more) + '</span></div>';
      list.forEach(function (p) {
        var ppl = p.tags.filter(function (t) { return t.indexOf('d:') !== 0; }).map(person).filter(Boolean);
        var depts = p.tags.filter(function (t) { return t.indexOf('d:') === 0; });
        var days = Math.round((parse(p.date) - parse(TODAY)) / 86400000);
        var due = p.status === 'published' ? '<span>' + nice(p.date) + '</span>' :
          days < 0 ? '<span class="tag danger">Overdue</span>' : days <= 2 ? '<span class="tag warn">' + (days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : 'In 2 days') + '</span>' : '<span>' + nice(p.date) + '</span>';
        h += '<button type="button" class="kcard" draggable="true" data-id="' + p.id + '" data-open="' + p.id + '">' +
          '<span class="t">' + esc(p.title) + '</span>' +
          '<span class="chip c-' + p.channel + '" style="align-self:flex-start">' + CHANNELS[p.channel] + '</span>' +
          (depts.length ? '<span class="tags">' + depts.map(function (t) { return '<span class="tag">' + esc(tagLabel(t)) + '</span>'; }).join('') + '</span>' : '') +
          '<span class="row">' + due + '<span class="avatars">' + ppl.map(avatar).join('') + '</span></span></button>';
      });
      if (more) h += '<div class="col-more">+' + more + ' more in Analytics</div>';
      h += '</div>';
    });
    view.innerHTML = h + '</div>';
    wireDrag('.kcard[draggable]', '.col', function (id, col) {
      var p = posts.find(function (x) { return x.id === id; });
      if (!p || p.status === col.dataset.status) return;
      var from = STATUS_LABEL[p.status]; p.status = col.dataset.status;
      notify(p.title + ' moved to ' + STATUS_LABEL[p.status], from + ' → ' + STATUS_LABEL[p.status], p.tags);
      render();
    });
  }

  // Analytics
  function analyze(from, to) {
    var list = posts.filter(function (p) { return p.status === 'published' && p.date >= from && p.date < to && p.reach; });
    var by = {};
    Object.keys(CHANNELS).forEach(function (c) { by[c] = { channel: c, posts: 0, reach: 0, eng: 0 }; });
    list.forEach(function (p) { var b = by[p.channel]; b.posts++; b.reach += p.reach; b.eng += p.engagements; });
    var social = SOCIAL.map(function (c) { return by[c]; });
    var sReach = social.reduce(function (s, b) { return s + b.reach; }, 0);
    var sEng = social.reduce(function (s, b) { return s + b.eng; }, 0);
    var sPosts = social.reduce(function (s, b) { return s + b.posts; }, 0);
    return {
      list: list, by: by, posts: list.length, socialPosts: sPosts, reach: sReach, eng: sEng,
      er: sReach ? sEng / sReach : 0,
      openRate: by.email.reach ? by.email.eng / by.email.reach : 0
    };
  }

  function recommendations(cur) {
    var recs = [];
    gapRuns(21).slice(0, 2).forEach(function (r) {
      var len = Math.round((parse(r[1]) - parse(r[0])) / 86400000) + 1;
      recs.push({ kind: 'warn', title: len + '-day gap: ' + nice(r[0]) + (r[0] !== r[1] ? '–' + nice(r[1]) : ''), text: 'Nothing is planned on any channel. Fill at least one day to keep your audience warm.', action: 'add', date: r[0], label: 'Add entry' });
    });
    var social = SOCIAL.map(function (c) { return cur.by[c]; }).filter(function (b) { return b.posts >= 3; });
    if (social.length && cur.eng) {
      social.forEach(function (b) { b.ratio = (b.eng / cur.eng) / (b.posts / cur.socialPosts); });
      var best = social.slice().sort(function (a, b) { return b.ratio - a.ratio; })[0];
      var worst = social.slice().sort(function (a, b) { return a.ratio - b.ratio; })[0];
      recs.push({ kind: 'up', title: CHANNELS[best.channel] + ' punches above its weight', text: pct(best.eng / cur.eng, 0) + ' of engagement from only ' + pct(best.posts / cur.socialPosts, 0) + ' of posts. Add 1–2 more ' + CHANNELS[best.channel] + ' posts a week.', action: 'add', channel: best.channel, label: 'Plan one' });
      if (worst !== best) recs.push({ kind: 'warn', title: CHANNELS[worst.channel] + ' is under-performing', text: pct(worst.posts / cur.socialPosts, 0) + ' of posts but ' + pct(worst.eng / cur.eng, 0) + ' of engagement. Repurpose top ' + CHANNELS[best.channel] + ' content here or cut back.' });
    }
    var wd = [0, 0, 0, 0, 0, 0, 0].map(function () { return { r: 0, e: 0, n: 0 }; });
    cur.list.forEach(function (p) { if (p.channel === 'email') return; var w = wd[parse(p.date).getDay()]; w.r += p.reach; w.e += p.engagements; w.n++; });
    var bestDay = -1, bestEr = 0;
    wd.forEach(function (w, i) { if (w.n >= 3 && w.e / w.r > bestEr) { bestEr = w.e / w.r; bestDay = i; } });
    if (bestDay >= 0) {
      var dn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][bestDay];
      recs.push({ kind: 'time', title: dn + 's are your best day', text: dn + ' posts average ' + pct(bestEr) + ' engagement vs ' + pct(cur.er) + ' overall. Move your most important posts there.' });
    }
    var horizon = addDays(TODAY, 14);
    var quiet = SOCIAL.filter(function (c) {
      return cur.by[c].posts > 0 && !posts.some(function (p) { return p.channel === c && p.date >= TODAY && p.date <= horizon; });
    });
    if (quiet.length) recs.push({ kind: 'warn', title: quiet.map(function (c) { return CHANNELS[c]; }).join(', ') + (quiet.length > 1 ? ' have' : ' has') + ' nothing scheduled', text: 'Active in the last 30 days, but nothing is planned for the next two weeks.', action: 'add', channel: quiet[0], label: 'Plan one' });
    var soon = addDays(TODAY, 3);
    var stuck = posts.filter(function (p) { return (p.status === 'review' || p.status === 'production' || p.status === 'brief' || p.status === 'idea') && p.date >= TODAY && p.date <= soon; });
    if (stuck.length) recs.push({ kind: 'warn', title: stuck.length + ' ' + (stuck.length === 1 ? 'entry isn’t' : 'entries aren’t') + ' ready to publish', text: stuck.map(function (p) { return p.title + ' (' + STATUS_LABEL[p.status] + ', ' + nice(p.date) + ')'; }).join('; ') + '.', action: 'board', label: 'Open board' });
    return recs;
  }

  var ICONS = {
    warn: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 6v5M10 14h.01"/><circle cx="10" cy="10" r="8"/></svg>',
    up: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14l5-5 3 3 6-6"/><path d="M13 6h4v4"/></svg>',
    time: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10" cy="10" r="7.5"/><path d="M10 6v4l3 2"/></svg>'
  };

  function delta(cur, prev, isPct) {
    if (!prev) return '';
    var d = isPct ? (cur - prev) * 100 : (cur - prev) / prev * 100;
    var up = d >= 0;
    return '<span class="d ' + (up ? 'up' : 'down') + '">' + (up ? '▲ ' : '▼ ') + Math.abs(d).toFixed(1) + (isPct ? ' pts' : '%') + ' vs prior 30 days</span>';
  }

  function renderAnalytics() {
    var from = addDays(TODAY, -30), cur = analyze(from, TODAY), prev = analyze(addDays(TODAY, -60), from);
    var recs = recommendations(cur);
    var noData = !cur.posts && !prev.posts;
    var h = '<div class="connected"><small>Connected:</small>' + ENABLED.map(function (c) {
      return '<span class="chip c-' + c + '">' + CHANNELS[c] + (c === 'email' ? ' (Klaviyo)' : '') + '</span>';
    }).join('') + '</div>';
    if (noData) h += '<div class="notice" style="margin-bottom:14px">No published posts yet. Results appear here once connected channels start publishing, usually within a day.</div>';

    h += '<div class="kpi-row">' +
      '<div class="kpi-tile"><small>Posts published</small><strong>' + cur.posts + '</strong>' + delta(cur.posts, prev.posts) + '</div>' +
      '<div class="kpi-tile"><small>Social reach</small><strong>' + fmtNum(cur.reach) + '</strong>' + delta(cur.reach, prev.reach) + '</div>' +
      '<div class="kpi-tile"><small>Engagement rate</small><strong>' + pct(cur.er) + '</strong>' + delta(cur.er, prev.er, true) + '</div>' +
      '<div class="kpi-tile"><small>Email open rate</small><strong>' + pct(cur.openRate, 0) + '</strong>' + delta(cur.openRate, prev.openRate, true) + '</div>' +
      '</div>';

    h += '<div class="panels">';
    // Recommendations
    h += '<div class="panel reco-list" style="grid-column:1/-1"><h3>Recommendations &amp; gaps</h3><p class="sub">Based on your last 30 days of results and the next 3 weeks of your calendar.</p>' +
      (recs.length ? recs.map(function (r, i) {
        return '<div class="reco"><span class="ico ' + (r.kind === 'warn' ? 'warn' : r.kind === 'up' ? 'ok' : '') + '">' + ICONS[r.kind] + '</span><p><b>' + esc(r.title) + '</b>' + esc(r.text) + '</p>' +
          (r.action ? '<button type="button" class="btn btn-ghost btn-sm" data-reco="' + i + '">' + esc(r.label) + '</button>' : '') + '</div>';
      }).join('') : '<p class="empty">No gaps found. Nice work.</p>') + '</div>';

    // Engagement by channel
    var rows = SOCIAL.map(function (c) { return cur.by[c]; }).filter(function (b) { return b.posts; })
      .sort(function (a, b) { return b.eng / b.reach - a.eng / a.reach; });
    var max = Math.max.apply(null, rows.map(function (b) { return b.eng / b.reach; }).concat([0.01]));
    h += '<div class="panel"><h3>Engagement rate by channel</h3><p class="sub">Engagements ÷ reach, last 30 days</p><div class="hbar">' +
      rows.map(function (b) {
        var er = b.eng / b.reach;
        var t = '<b>' + CHANNELS[b.channel] + '</b>' + pct(er) + ' engagement<br>' + b.posts + ' posts · ' + fmtNum(b.reach) + ' reach';
        return '<span class="lbl">' + CHANNELS[b.channel] + '</span><span class="track" tabindex="0" data-tip="' + esc(t) + '" aria-label="' + CHANNELS[b.channel] + ' ' + pct(er) + '"><span class="fill" style="width:' + (er / max * 100) + '%"></span></span><span class="val">' + pct(er) + '</span>';
      }).join('') + '</div></div>';

    // Weekly reach, last 8 weeks
    var weeks = [];
    for (var w = 7; w >= 0; w--) {
      var ws = addDays(TODAY, -7 * (w + 1)), we = addDays(TODAY, -7 * w);
      var a = analyze(ws, we);
      weeks.push({ start: ws, reach: a.reach, posts: a.socialPosts });
    }
    var wmax = Math.max.apply(null, weeks.map(function (x) { return x.reach; }).concat([1]));
    h += '<div class="panel"><h3>Weekly social reach</h3><p class="sub">Last 8 weeks</p><div class="vbars">' +
      weeks.map(function (x) {
        var t = '<b>Week of ' + nice(x.start) + '</b>' + fmtNum(x.reach) + ' reach · ' + x.posts + ' posts';
        return '<span class="vb" tabindex="0" data-tip="' + esc(t) + '" aria-label="Week of ' + nice(x.start) + ': ' + fmtNum(x.reach) + ' reach"><span class="fill" style="height:' + (x.reach / wmax * 100) + '%"></span></span>';
      }).join('') + '</div><div class="vlabels">' + weeks.map(function (x) { return '<span>' + nice(x.start) + '</span>'; }).join('') + '</div>' +
      '<p class="chart-note">Peak week: ' + fmtNum(wmax) + ' reach. Hover or focus a bar for details.</p></div>';

    // Channel table
    h += '<div class="panel" style="grid-column:1/-1"><h3>Channel mix</h3><p class="sub">Is effort going where results are?</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Channel</th><th class="num">Posts</th><th class="num">Share of posts</th><th class="num">Share of engagement</th><th class="num">Reach</th><th class="num">Eng. / open rate</th></tr></thead><tbody>' +
      ENABLED.map(function (c) {
        var b = cur.by[c]; if (!b.posts) return '';
        var isEmail = c === 'email';
        return '<tr><td><span class="chip c-' + c + '">' + CHANNELS[c] + '</span></td><td class="num">' + b.posts + '</td>' +
          '<td class="num">' + (isEmail ? '—' : pct(b.posts / cur.socialPosts, 0)) + '</td>' +
          '<td class="num">' + (isEmail ? '—' : pct(b.eng / cur.eng, 0)) + '</td>' +
          '<td class="num">' + b.reach.toLocaleString() + '</td><td class="num">' + pct(b.eng / b.reach) + (isEmail ? ' open' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="btn-row" style="margin-top:14px"><button class="btn btn-primary btn-sm" type="button" data-export="xlsx">Export Excel report</button><button class="btn btn-ghost btn-sm" type="button" data-export="csv">Export CSV</button></div></div>';
    if (MONEY_CHANNELS.length) {
      var mon = monetization(from, TODAY), monPrev = monetization(addDays(TODAY, -60), from);
      h += '<div class="panel" style="grid-column:1/-1"><h3>Monetization</h3><p class="sub">Estimated creator earnings from connected platforms, last 30 days (USD). Platforms report revenue 1\u20133 days late and may revise it.</p>' +
        '<div class="kpi-row" style="margin-bottom:14px"><div class="kpi-tile"><small>Est. revenue</small><strong>' + money(mon.total.revenue) + '</strong>' + delta(mon.total.revenue, monPrev.total.revenue) + '</div>' +
        '<div class="kpi-tile"><small>Blended RPM</small><strong>' + money(mon.total.rpm) + '</strong><span class="d">per 1,000 monetized views</span></div>' +
        '<div class="kpi-tile"><small>Monetized posts</small><strong>' + mon.total.monetized + '</strong></div></div>' +
        '<div class="table-wrap"><table class="data-table"><thead><tr><th>Channel</th><th>Programs</th><th class="num">Monetized posts</th><th class="num">Est. revenue</th><th class="num">RPM</th></tr></thead><tbody>' +
        mon.rows.map(function (r) {
          return '<tr><td><span class="chip c-' + r.channel + '">' + CHANNELS[r.channel] + '</span></td><td class="muted">' + esc(MONETIZATION[r.channel].programs) + '</td><td class="num">' + r.monetized + ' of ' + r.posts + '</td><td class="num">' + money(r.revenue) + '</td><td class="num">' + (r.views ? money(r.rpm) : '\u2014') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="btn-row" style="margin-top:14px"><button class="btn btn-ghost btn-sm" type="button" data-export="csv-money">Export monetization CSV</button></div></div>';
    }
    h += '</div>';
    view.innerHTML = h;

    $$('[data-reco]').forEach(function (b) {
      b.addEventListener('click', function () {
        var r = recs[+b.dataset.reco];
        if (r.action === 'board') { location.hash = 'board'; return; }
        var date = r.date || (gapRuns(21)[0] || [addDays(TODAY, 1)])[0];
        openEntry(null, { date: date, channel: r.channel });
      });
    });
    $$('#view [data-export]').forEach(function (b) { if (b.dataset.export === 'xlsx' && !ENV.excel) b.hidden = true; wireExportButton(b); });
  }

  // Production
  function renderProduction() {
    var days = Math.round((parse(project.shootDate) - parse(TODAY)) / 86400000);
    var packed = project.equipment.filter(function (e) { return e.status === 'Packed'; }).length;
    var h = '<div class="proj-head"><h2>' + esc(project.name) + '</h2>' +
      '<span class="tag">Shoot ' + nice(project.shootDate, true) + (days >= 0 ? ' · in ' + days + ' days' : '') + '</span>' +
      '<span class="tag ' + (packed === project.equipment.length ? 'ok' : 'warn') + '">Gear ' + packed + '/' + project.equipment.length + ' packed</span>' +
      '<span class="avatars">' + [role('P'), role('P2'), role('B'), role('S')].filter(function (id, i, a) { return a.indexOf(id) === i; }).map(function (id) { return avatar(person(id)); }).join('') + '</span></div>';
    var tabs = [['brief', 'Brief & goals'], ['logistics', 'Logistics'], ['schedule', 'Production schedule'], ['callsheet', 'Call sheet'], ['equipment', 'Equipment']];
    h += '<div class="tabs" role="tablist">' + tabs.map(function (t) {
      return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (state.prodTab === t[0]) + '">' + t[1] + '</button>';
    }).join('') + '</div><div class="panel">';

    if (state.prodTab === 'brief') {
      h += '<h3>Project brief</h3><p>' + esc(project.brief) + '</p>' +
        '<h3 style="margin-top:18px">Goals</h3><ul class="check-list" style="margin-top:8px">' + project.goals.map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') + '</ul>' +
        '<h3 style="margin-top:18px">Audience</h3><p>' + esc(project.audience) + '</p>' +
        '<h3 style="margin-top:18px">Deliverables</h3><p class="sub">Linked to calendar entries. Status updates live.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Deliverable</th><th>Channel</th><th>Publish</th><th>Status</th></tr></thead><tbody>' +
        (project.deliverables.length ? '' : '<tr><td colspan="4" class="empty">No deliverables linked yet. Link calendar entries to this project as you plan them.</td></tr>') +
        project.deliverables.map(function (title) {
          var p = posts.find(function (x) { return x.title === title; });
          if (!p) return '<tr><td>' + esc(title) + '</td><td colspan="3" class="muted">Removed from calendar</td></tr>';
          return '<tr><td><a href="#" data-open="' + p.id + '">' + esc(p.title) + '</a></td><td><span class="chip c-' + p.channel + '">' + CHANNELS[p.channel] + '</span></td><td>' + nice(p.date) + '</td><td><span class="tag neutral">' + STATUS_LABEL[p.status] + '</span></td></tr>';
        }).join('') + '</tbody></table></div>';
    } else if (state.prodTab === 'logistics') {
      h += '<h3>Logistics</h3><dl class="dl" style="margin-top:12px">' + [['Shoot date', nice(project.shootDate, true)]].concat(project.logistics).map(function (r) {
        return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>';
      }).join('') + '</dl>';
    } else if (state.prodTab === 'schedule') {
      var sorted = project.schedule.slice().sort(function (a, b) { return a.time.localeCompare(b.time); });
      h += '<h3>Shoot day schedule · ' + nice(project.shootDate, true) + '</h3><div class="table-wrap" style="margin-top:12px"><table class="data-table"><thead><tr><th>Time</th><th>Activity</th><th>Owner</th></tr></thead><tbody>' +
        (sorted.length ? '' : '<tr><td colspan="3" class="empty">Nothing scheduled yet. Add the first activity below.</td></tr>') +
        sorted.map(function (r) {
          var p = person(r.owner);
          return '<tr><td><strong>' + niceTime(r.time) + '</strong></td><td>' + esc(r.item) + '</td><td>' + (p ? avatar(p) + ' ' + esc(p.name) : '<span class="muted">—</span>') + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<form class="inline-form" id="sched-form"><input type="time" id="s-time" required aria-label="Time" value="16:30"><input type="text" id="s-item" placeholder="Add an activity…" required aria-label="Activity">' +
        '<select id="s-owner" aria-label="Owner"><option value="">No owner</option>' + members().map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + '</option>'; }).join('') + '</select>' +
        '<button class="btn btn-primary btn-sm" type="submit">Add</button></form>';
    } else if (state.prodTab === 'callsheet') {
      var cs = project.callSheet.slice().sort(function (a, b) { return a.call.localeCompare(b.call) || a.name.localeCompare(b.name); });
      var active = cs.filter(function (c) { return c.status !== 'Cancelled'; });
      var crewCalls = active.filter(function (c) { return c.type === 'Crew'; }).map(function (c) { return c.call; }).sort();
      var lastWrap = active.map(function (c) { return c.wrap; }).sort().pop();
      var loc = (project.logistics.find(function (r) { return r[0] === 'Location'; }) || [])[1];
      var missing = members().filter(function (pp) {
        return personActivities(pp.id).length && !project.callSheet.some(function (c) { return c.personId === pp.id; });
      });
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap"><div><h3>Call sheet \u00b7 ' + nice(project.shootDate, true) + '</h3>' +
        '<p class="sub" style="margin-bottom:0">Everyone working the shoot day, when they\u2019re expected and what they\u2019re doing. Scheduled activities come from the production schedule.</p></div>' +
        '<button class="btn btn-ghost btn-sm" type="button" id="cs-export"' + (cs.length ? '' : ' disabled') + '>Download call sheet (.csv)</button></div>' +
        '<div class="kpi-row" style="margin:14px 0">' +
        '<div class="kpi-tile"><small>Location</small><strong style="font-size:1rem;line-height:1.35">' + esc(loc || 'TBD') + '</strong></div>' +
        '<div class="kpi-tile"><small>General crew call</small><strong>' + (crewCalls.length ? niceTime(crewCalls[0]) : '\u2014') + '</strong></div>' +
        '<div class="kpi-tile"><small>Estimated wrap</small><strong>' + (lastWrap ? niceTime(lastWrap) : '\u2014') + '</strong></div>' +
        '<div class="kpi-tile"><small>On set</small><strong>' + active.length + '</strong><span class="d">' + active.filter(function (c) { return c.type === 'Crew'; }).length + ' crew \u00b7 ' + active.filter(function (c) { return c.type === 'Talent'; }).length + ' talent</span></div></div>' +
        (missing.length ? '<div class="notice" style="margin-bottom:12px">' + missing.map(function (pp) { return '<strong>' + esc(pp.name) + '</strong>'; }).join(', ') +
          (missing.length === 1 ? ' has' : ' have') + ' activities on the schedule but ' + (missing.length === 1 ? 'isn\u2019t' : 'aren\u2019t') + ' on the call sheet. ' +
          missing.map(function (pp) { return '<button class="btn btn-ghost btn-sm" type="button" data-cs-addperson="' + pp.id + '">Add ' + esc(pp.name.split(' ')[0]) + '</button>'; }).join(' ') + '</div>' : '') +
        '<div class="table-wrap"><table class="data-table call-sheet"><thead><tr><th>Name and role</th><th>Type</th><th>Call</th><th>Scheduled</th><th>Wrap</th><th class="num">Hours</th><th>Status</th><th><span class="sr-only">Remove</span></th></tr></thead><tbody>' +
        (cs.length ? '' : '<tr><td colspan="8" class="empty">Nobody on the call sheet yet. Add your crew and talent below.</td></tr>') +
        cs.map(function (c) {
          var pp = person(c.personId), acts = personActivities(c.personId);
          var hrs = hoursBetween(c.call, c.wrap);
          return '<tr class="' + (c.status === 'Cancelled' ? 'cs-cancelled' : '') + '"><td>' + (pp ? avatar(pp) + ' ' : '') + '<strong>' + esc(c.name) + '</strong><small class="cs-role">' + esc(c.role) + '</small></td>' +
            '<td><span class="tag ' + (c.type === 'Talent' ? '' : 'neutral') + '">' + esc(c.type) + '</span></td>' +
            '<td><input type="time" data-cs-time="' + c.id + ':call" value="' + c.call + '" aria-label="Call time for ' + esc(c.name) + '"></td>' +
            '<td class="cs-acts">' + (acts.length ? acts.map(function (a) { return '<span><b>' + niceTime(a.time) + '</b> ' + esc(a.item) + '</span>'; }).join('') : '<span class="muted">On set from call to wrap</span>') + '</td>' +
            '<td><input type="time" data-cs-time="' + c.id + ':wrap" value="' + c.wrap + '" aria-label="Wrap time for ' + esc(c.name) + '"></td>' +
            '<td class="num">' + (hrs > 0 ? hrs + ' h' : '\u2014') + '</td>' +
            '<td><select data-cs-status="' + c.id + '" aria-label="Status for ' + esc(c.name) + '">' + ['Confirmed', 'Pending', 'Cancelled'].map(function (st) { return '<option' + (st === c.status ? ' selected' : '') + '>' + st + '</option>'; }).join('') + '</select></td>' +
            '<td><button class="icon-btn" type="button" data-cs-remove="' + c.id + '" aria-label="Remove ' + esc(c.name) + ' from the call sheet">\u2715</button></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<form class="inline-form" id="cs-form"><input type="text" id="cs-name" placeholder="Name" required aria-label="Name" list="cs-people"><datalist id="cs-people">' + members().map(function (pp) { return '<option value="' + esc(pp.name) + '">'; }).join('') + '</datalist>' +
        '<input type="text" id="cs-role" placeholder="Role (e.g. Gaffer)" aria-label="Role">' +
        '<select id="cs-type" aria-label="Type"><option>Crew</option><option>Talent</option><option>Client</option></select>' +
        '<input type="time" id="cs-call" value="' + (crewCalls[0] || '09:00') + '" aria-label="Call time"><input type="time" id="cs-wrap" value="' + (lastWrap || '17:00') + '" aria-label="Wrap time">' +
        '<button class="btn btn-primary btn-sm" type="submit">Add to call sheet</button></form>';
    } else {
      h += '<h3>Equipment list</h3><p class="sub">Update status as gear is pulled, packed and checked out.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Item</th><th class="num">Qty</th><th>Status</th></tr></thead><tbody>' +
        (project.equipment.length ? '' : '<tr><td colspan="3" class="empty">No equipment yet. Add items below.</td></tr>') +
        project.equipment.map(function (e, i) {
          return '<tr><td>' + esc(e.name) + '</td><td class="num">' + e.qty + '</td><td><select data-eq="' + i + '" aria-label="Status for ' + esc(e.name) + '">' +
            ['Needed', 'Checked out', 'Packed', 'Returned'].map(function (s) { return '<option' + (s === e.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<form class="inline-form" id="eq-form"><input type="text" id="e-name" placeholder="Add equipment…" required aria-label="Equipment name"><input type="text" id="e-qty" inputmode="numeric" value="1" aria-label="Quantity" style="flex:0 0 70px"><button class="btn btn-primary btn-sm" type="submit">Add</button></form>';
    }
    view.innerHTML = h + '</div>';

    $$('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { state.prodTab = b.dataset.tab; render(); }); });
    var sf = $('#sched-form');
    if (sf) sf.addEventListener('submit', function (e) {
      e.preventDefault();
      var item = $('#s-item').value.trim(); if (!item) return;
      project.schedule.push({ time: $('#s-time').value || '12:00', item: item, owner: $('#s-owner').value });
      notify('Production schedule updated', item + ' at ' + niceTime($('#s-time').value || '12:00'), ['d:Production']);
      render();
    });
    // Call sheet editing
    function csById(id) { return project.callSheet.find(function (c) { return c.id === +id; }); }
    function csTags(c) { return c.personId ? [c.personId, 'd:Production'] : ['d:Production']; }
    $$('[data-cs-time]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        var parts = inp.dataset.csTime.split(':'), c = csById(parts[0]), field = parts[1];
        if (!inp.value) { inp.value = c[field]; return; }
        var call = field === 'call' ? inp.value : c.call, wrap = field === 'wrap' ? inp.value : c.wrap;
        if (toMin(wrap) <= toMin(call)) { toast('Wrap must be after call time', c.name + ' was not changed.'); inp.value = c[field]; return; }
        var old = c[field]; c[field] = inp.value;
        notify((field === 'call' ? 'Call time' : 'Wrap time') + ' changed: ' + c.name, niceTime(old) + ' \u2192 ' + niceTime(inp.value) + ' on ' + nice(project.shootDate), csTags(c));
        render();
      });
    });
    $$('[data-cs-status]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var c = csById(sel.dataset.csStatus); c.status = sel.value;
        if (sel.value === 'Cancelled') notify(c.name + ' cancelled for ' + nice(project.shootDate), c.role, csTags(c));
        render();
      });
    });
    $$('[data-cs-remove]').forEach(function (b) {
      b.addEventListener('click', function () {
        var c = csById(b.dataset.csRemove);
        project.callSheet = project.callSheet.filter(function (x) { return x !== c; });
        toast('Removed ' + c.name + ' from the call sheet'); render();
      });
    });
    $$('[data-cs-addperson]').forEach(function (b) {
      b.addEventListener('click', function () {
        var pp = person(b.dataset.csAddperson), acts = personActivities(pp.id);
        project.callSheet.push({ id: csId++, personId: pp.id, name: pp.name, role: pp.dept, type: 'Crew', status: 'Confirmed',
          call: fromMin(toMin(acts[0].time) - 30), wrap: fromMin(toMin(acts[acts.length - 1].time) + 60) });
        notify('Added to call sheet: ' + pp.name, 'Call ' + niceTime(fromMin(toMin(acts[0].time) - 30)) + ' on ' + nice(project.shootDate), [pp.id, 'd:Production']);
        render();
      });
    });
    var csf = $('#cs-form');
    if (csf) csf.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#cs-name').value.trim(), call = $('#cs-call').value, wrap = $('#cs-wrap').value;
      if (!name) { $('#cs-name').focus(); return; }
      if (!call || !wrap || toMin(wrap) <= toMin(call)) { toast('Wrap must be after call time'); return; }
      var match = members().find(function (pp) { return pp.name.toLowerCase() === name.toLowerCase(); });
      project.callSheet.push({ id: csId++, personId: match ? match.id : '', name: match ? match.name : name, role: $('#cs-role').value.trim() || (match ? match.dept : 'Crew'),
        type: $('#cs-type').value, call: call, wrap: wrap, status: 'Confirmed' });
      notify('Added to call sheet: ' + name, 'Call ' + niceTime(call) + ', wrap ' + niceTime(wrap) + ' on ' + nice(project.shootDate), match ? [match.id, 'd:Production'] : ['d:Production']);
      render();
    });
    var cse = $('#cs-export');
    if (cse) cse.addEventListener('click', function () {
      var rows = project.callSheet.slice().sort(function (a, b) { return a.call.localeCompare(b.call); });
      var lines = ['# ' + project.name + ' call sheet, ' + project.shootDate,
        ['Name', 'Role', 'Type', 'Status', 'Call', 'Wrap', 'Hours', 'Scheduled activities'].join(',')]
        .concat(rows.map(function (c) {
          return [c.name, c.role, c.type, c.status, niceTimeLong(c.call), niceTimeLong(c.wrap), hoursBetween(c.call, c.wrap),
            personActivities(c.personId).map(function (a) { return niceTimeLong(a.time) + ' ' + a.item; }).join('; ')].map(csvCell).join(',');
        }));
      download(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'call-sheet-' + project.shootDate + '.csv');
      toast('Call sheet downloaded', rows.length + ' people');
    });

    $$('[data-eq]').forEach(function (s) {
      s.addEventListener('change', function () { project.equipment[+s.dataset.eq].status = s.value; render(); });
    });
    var ef = $('#eq-form');
    if (ef) ef.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#e-name').value.trim(); if (!name) return;
      project.equipment.push({ name: name, qty: Math.max(1, parseInt($('#e-qty').value, 10) || 1), status: 'Needed' });
      render();
    });
  }

  // Files
  var EXT_COLOR = { pdf: '#C93C3C', png: '#0B7C77', jpg: '#0B7C77', mp4: '#6B4FA0', mov: '#6B4FA0', zip: '#5E5C70', xlsx: '#1E7A4C', csv: '#1E7A4C', html: '#B8561A', docx: '#2D5FD3' };
  function renderFiles() {
    var q = state.fileQuery.toLowerCase();
    var list = files.filter(function (f) {
      return (state.fileFolder === 'All' || f.folder === state.fileFolder) && (!q || f.name.toLowerCase().indexOf(q) !== -1);
    }).sort(function (a, b) { return b.updated.localeCompare(a.updated); });
    var h = '<div class="toolbar"><div class="pill-nav" style="margin:0">' + FOLDERS.map(function (f) {
      return '<button type="button" data-folder="' + esc(f) + '" aria-pressed="' + (state.fileFolder === f) + '">' + esc(f) + '</button>';
    }).join('') + '</div><span class="spacer"></span>' +
      '<input type="search" id="file-q" placeholder="Search files…" aria-label="Search files" value="' + esc(state.fileQuery) + '" style="width:200px" data-ro-ok>' +
      '<label class="btn btn-primary btn-sm upload-label">Upload<input type="file" id="file-up" multiple></label></div>' +
      '<p class="muted" style="font-size:.84rem;margin:0 0 10px">Project: ' + esc(project.name) + '. In demo mode, uploads stay in your browser and are never sent anywhere.</p>' +
      '<div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Folder</th><th class="num">Size</th><th>Owner</th><th>Updated</th></tr></thead><tbody>' +
      (list.length ? list.map(function (f) {
        var ext = (f.name.split('.').pop() || '').toLowerCase(), p = person(f.owner);
        return '<tr><td><span class="file-ico" style="background:' + (EXT_COLOR[ext] || '#5E5C70') + '">' + esc(ext.slice(0, 4).toUpperCase()) + '</span>' + esc(f.name) + '</td><td>' + esc(f.folder) + '</td><td class="num">' + fmtSize(f.size) + '</td><td>' + (p ? avatar(p) : '') + '</td><td>' + nice(f.updated) + '</td></tr>';
      }).join('') : '<tr><td colspan="5" class="empty">No files match.</td></tr>') + '</tbody></table></div>';
    view.innerHTML = h;
    $$('[data-folder]').forEach(function (b) { b.addEventListener('click', function () { state.fileFolder = b.dataset.folder; render(); }); });
    var qi = $('#file-q');
    qi.addEventListener('input', function () {
      state.fileQuery = qi.value; var pos = qi.selectionStart; render();
      var n = $('#file-q'); n.focus(); n.setSelectionRange(pos, pos);
    });
    $('#file-up').addEventListener('change', function (e) {
      var added = Array.prototype.slice.call(e.target.files);
      added.forEach(function (f) {
        files.push({ name: f.name, folder: state.fileFolder === 'All' ? 'Briefs' : state.fileFolder, size: f.size, owner: role('M'), updated: TODAY });
      });
      if (added.length) notify(added.length + ' file' + (added.length > 1 ? 's' : '') + ' added to ' + project.name, added.map(function (f) { return f.name; }).join(', '), ['d:Production']);
      render();
    });
  }

  // Team
  function renderTeam() {
    var admin = isAdmin();
    var cols = admin ? brands : myBrands(); // people only see the brands they can open
    var h = (admin ? '' : '<div class="notice ro-note">Only workspace admins can change departments and notifications. Brand leads can change who has access to their brand.</div>') +
      '<div class="panel" style="margin-bottom:16px"><h3>Brand access</h3><p class="sub">Choose which brands each person can open and what they can do there. Brand leads manage the brand and its people, editors plan and edit content, and viewers can look and export reports.</p>' +
      '<div class="table-wrap"><table class="data-table access-table"><thead><tr><th>Person</th>' + cols.map(function (b) { return '<th><i class="brand-dot" style="--bc:' + esc(b.color) + '"></i>' + esc(b.name) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      people.map(function (p) {
        return '<tr><td>' + avatar(p) + ' ' + esc(p.name) + '<small>' + esc(p.dept) + '</small></td>' + cols.map(function (b) {
          var r = b.access[p.id] || '';
          return '<td><select data-access="' + b.id + ':' + p.id + '" aria-label="' + esc(p.name + ' on ' + b.name) + '"' + (canManage(b) ? '' : ' disabled') + '>' +
            '<option value=""' + (r ? '' : ' selected') + '>No access</option>' + Object.keys(ROLE_LABEL).map(function (k) { return '<option value="' + k + '"' + (r === k ? ' selected' : '') + '>' + ROLE_LABEL[k] + '</option>'; }).join('') + '</select></td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div></div>' +
      '<div class="panels" style="margin-top:0">' +
      '<div class="panel"><h3>People &amp; department roles</h3><p class="sub">A department role decides which department notifications each person receives.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Name</th><th>Department role</th></tr></thead><tbody>' +
      people.map(function (p) {
        return '<tr><td>' + avatar(p) + ' ' + esc(p.name) + '</td><td><select data-person="' + p.id + '" aria-label="Department for ' + esc(p.name) + '"' + (admin ? '' : ' disabled') + '>' +
          DEPTS.map(function (d) { return '<option' + (d === p.dept ? ' selected' : '') + '>' + d + '</option>'; }).join('') + '</select></td></tr>';
      }).join('') + '</tbody></table></div></div>' +
      '<div class="panel"><h3>Department notifications</h3><p class="sub">Choose where each department hears about new projects, deadline changes and assignments.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Department</th><th class="num">Members</th><th>App</th><th>Email</th><th>Slack</th></tr></thead><tbody>' +
      DEPTS.map(function (d) {
        var s = state.deptSettings[d], count = people.filter(function (p) { return p.dept === d; }).length;
        return '<tr><td><strong>' + d + '</strong></td><td class="num">' + count + '</td>' + ['app', 'email', 'slack'].map(function (k) {
          return '<td><label class="switch"><input type="checkbox" data-dept="' + d + '" data-ch="' + k + '"' + (s[k] ? ' checked' : '') + (admin ? '' : ' disabled') + ' aria-label="' + d + ' ' + k + ' notifications"></label></td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div><p class="chart-note">Slack posts to each department’s channel, e.g. #team-production.</p></div></div>';
    view.innerHTML = h;
    $$('[data-person]').forEach(function (s) {
      s.addEventListener('change', function () {
        var p = person(s.dataset.person), old = p.dept; p.dept = s.value;
        if (state.viewer === p.id) state.role = p.dept;
        notify(p.name + ' joined ' + p.dept, 'Moved from ' + old + '. Now receives ' + p.dept + ' notifications.', [p.id, 'd:' + old]);
        fillViewerOptions(); render();
      });
    });
    $$('[data-dept]').forEach(function (c) {
      c.addEventListener('change', function () { state.deptSettings[c.dataset.dept][c.dataset.ch] = c.checked; });
    });
    $$('[data-access]').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var parts = sel.dataset.access.split(':'), b = brandById(parts[0]), p = person(parts[1]);
        var old = b.access[p.id] || '', now = sel.value;
        if (old === now) return;
        if (old === 'lead' && now !== 'lead' && !people.some(function (x) { return x !== p && b.access[x.id] === 'lead'; })) {
          sel.value = old; toast('Every brand needs a brand lead', 'Make someone else lead of ' + b.name + ' first.'); return;
        }
        if (now) b.access[p.id] = now; else delete b.access[p.id];
        if (!old) notify('Added to ' + b.name, p.name + ' is now ' + ROLE_LABEL[now].toLowerCase() + ' on ' + b.name + '.', [p.id], false, b.id);
        else if (!now) notify('Removed from ' + b.name, p.name + ' no longer has access to ' + b.name + '.', [p.id], false, b.id);
        else notify('Role changed on ' + b.name, p.name + ': ' + ROLE_LABEL[old] + ' \u2192 ' + ROLE_LABEL[now], [p.id], false, b.id);
        ensureBrand(); renderBell(); render();
      });
    });
  }

  // ---------- entry dialog ----------
  var dlg = $('#entry-dialog'), form = $('#entry-form'), editing = null;
  $('#f-status').innerHTML = STATUSES.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + '</option>'; }).join('');
  function fillTagChecks() {
    $('#f-people').innerHTML = members().map(function (p) { return '<label><input type="checkbox" name="tag" value="' + p.id + '">' + esc(p.name) + '</label>'; }).join('');
    $('#f-depts').innerHTML = DEPTS.map(function (d) { return '<label><input type="checkbox" name="tag" value="d:' + d + '">#' + d + '</label>'; }).join('');
  }
  function openEntry(id, preset) {
    fillTagChecks();
    var p = id != null ? posts.find(function (x) { return x.id === id; }) : null;
    editing = p;
    preset = preset || {};
    var ro = !canEdit();
    // This brand's connected channels, plus a disconnected one an existing entry still uses
    var chans = ENABLED.concat(p && ENABLED.indexOf(p.channel) === -1 ? [p.channel] : []);
    $('#f-channel').innerHTML = chans.map(function (c) { return '<option value="' + c + '">' + CHANNELS[c] + '</option>'; }).join('');
    $('#entry-dialog-title').textContent = ro ? 'Calendar entry \u00b7 ' + B.name : (p ? 'Edit calendar entry' : 'New calendar entry') + ' \u00b7 ' + B.name;
    $('#f-title').value = p ? p.title : '';
    $('#f-channel').value = p ? p.channel : (preset.channel || (state.calChannel !== 'all' ? state.calChannel : ENABLED[0]));
    $('#f-status').value = p ? p.status : 'idea';
    $('#f-date').value = p ? p.date : (preset.date || state.selDay || TODAY);
    $('#f-time').value = p ? (p.time || '') : '11:30';
    $('#f-notes').value = p ? p.notes : '';
    var tags = p ? p.tags : (state.role !== 'all' ? ['d:' + state.role] : []);
    $$('input[name=tag]').forEach(function (c) { c.checked = tags.indexOf(c.value) !== -1; });
    $('#f-error').hidden = true; $('.tag-field').classList.remove('invalid');
    $('#f-delete').hidden = !p || ro;
    $('#f-save').hidden = ro;
    $$('#entry-form input, #entry-form select, #entry-form textarea').forEach(function (el) { el.disabled = ro; });
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    $('#f-title').focus();
  }
  function closeEntry() { if (dlg.open) dlg.close(); editing = null; }
  $$('[data-close]', dlg).forEach(function (b) { b.addEventListener('click', closeEntry); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) closeEntry(); });
  dlg.addEventListener('change', function (e) {
    if (e.target.name === 'tag' && $$('input[name=tag]:checked').length) { $('#f-error').hidden = true; $('.tag-field').classList.remove('invalid'); }
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!canEdit()) return;
    var title = $('#f-title').value.trim(), date = $('#f-date').value;
    var tags = $$('input[name=tag]:checked').map(function (c) { return c.value; });
    var err = '';
    if (!title) err = 'Add a title.';
    else if (!date) err = 'Pick a publish date.';
    else if (!tags.length) err = 'Tag at least one person or department. Every entry needs an owner so nothing gets missed.';
    if (err) {
      $('#f-error').textContent = err; $('#f-error').hidden = false;
      if (!tags.length && title && date) $('.tag-field').classList.add('invalid');
      return;
    }
    var data = { title: title, channel: $('#f-channel').value, status: $('#f-status').value, date: date, time: $('#f-time').value, tags: tags, notes: $('#f-notes').value };
    if (editing) {
      var p = editing, oldDate = p.date, oldStatus = p.status;
      var newTags = tags.filter(function (t) { return p.tags.indexOf(t) === -1; });
      Object.assign(p, data);
      if (oldDate !== date) notify('Deadline changed: ' + title, nice(oldDate) + ' → ' + nice(date), tags);
      else if (oldStatus !== data.status) notify(title + ' moved to ' + STATUS_LABEL[data.status], STATUS_LABEL[oldStatus] + ' → ' + STATUS_LABEL[data.status], tags);
      else if (newTags.length) notify('You were tagged: ' + title, 'Publishes ' + nice(date), newTags);
      else toast('Saved ' + title);
    } else {
      posts.push(Object.assign({ id: nextId++ }, data));
      notify('New entry: ' + title, CHANNELS[data.channel] + ' · ' + nice(date, true), tags);
    }
    state.selDay = date;
    var d = parse(date); state.calMonth = iso(new Date(d.getFullYear(), d.getMonth(), 1));
    closeEntry(); render();
  });
  $('#f-delete').addEventListener('click', function () {
    if (!editing) return;
    var p = editing;
    if (!confirm('Delete “' + p.title + '”?')) return;
    posts = B.posts = posts.filter(function (x) { return x !== p; });
    notify('Entry removed: ' + p.title, 'Was planned for ' + nice(p.date), p.tags);
    closeEntry(); render();
  });

  // ---------- global wiring ----------
  view.addEventListener('click', function (e) {
    var add = e.target.closest('[data-add]');
    if (add) { openEntry(null, { date: add.dataset.add }); return; }
    var open = e.target.closest('[data-open], .chip[data-id]');
    if (open) { e.preventDefault(); openEntry(+(open.dataset.open || open.dataset.id)); }
  });
  $('#new-entry').addEventListener('click', function () { openEntry(null); });

  function fillViewerOptions() {
    $('#role-people').innerHTML = people.map(function (p) { return '<option value="u:' + p.id + '"' + (state.viewer === p.id ? ' selected' : '') + '>' + esc(p.name) + ' (' + esc(p.dept) + ')</option>'; }).join('');
  }
  $('#role-select').addEventListener('change', function (e) {
    var v = e.target.value;
    if (v.indexOf('u:') === 0) { state.viewer = v.slice(2); state.role = person(state.viewer).dept; }
    else { state.viewer = null; state.role = v; }
    ensureBrand(); renderBell(); renderNotifs(); render();
    if (state.viewer) {
      var mine = myBrands(), p = person(state.viewer);
      toast('Viewing as ' + p.name, mine.length ? mine.map(function (b) { return b.name + ' (' + ROLE_LABEL[b.access[p.id]] + ')'; }).join(', ') : 'Not assigned to any brand yet.');
    } else toast('Viewing as ' + (state.role === 'all' ? 'workspace admin' : state.role), state.role === 'all' ? 'Showing every brand and department.' : 'Notifications and entries are filtered to ' + state.role + '.');
  });

  function renderBell() {
    var n = visibleNotifs().filter(function (x) { return x.unread; }).length;
    var b = $('#bell-count'); b.textContent = n; b.hidden = !n;
    $('#bell').setAttribute('aria-label', 'Notifications' + (n ? ', ' + n + ' unread' : ''));
    if (!$('#notif-panel').hidden) renderNotifs();
  }
  function ago(d) {
    var s = (Date.now() - d) / 1000;
    return s < 60 ? 'just now' : s < 3600 ? Math.round(s / 60) + 'm ago' : s < 86400 ? Math.round(s / 3600) + 'h ago' : Math.round(s / 86400) + 'd ago';
  }
  function renderNotifs() {
    var list = visibleNotifs();
    $('#notif-list').innerHTML = list.length ? list.map(function (n) {
      var b = brandById(n.brand);
      return '<div class="notif' + (n.unread ? ' unread' : '') + '">' + (brands.length > 1 && b ? '<span class="nb"><i class="brand-dot" style="--bc:' + esc(b.color) + '"></i>' + esc(b.name) + '</span>' : '') + '<b>' + esc(n.title) + '</b><span>' + esc(n.detail) + '</span><small>' + esc(n.who) + ' · ' + ago(n.at) + '</small><span class="via">Sent via ' + esc(n.via) + '</span></div>';
    }).join('') : '<p class="empty">No notifications for ' + esc(state.viewer ? person(state.viewer).name : state.role === 'all' ? 'admins' : state.role) + ' yet.</p>';
  }
  // Notifications panel: docks beside the content on wide screens; drag its left edge (or use arrow keys) to resize
  var notifPanel = $('#notif-panel'), appEl = $('.app'), notifHandle = $('#notif-resize');
  var NOTIF_MIN = 260, NOTIF_DEFAULT = 360, NOTIF_KEY = 'cs-notif-w';
  var dockQuery = window.matchMedia('(min-width: 1100px)');
  function notifMax() { return Math.max(NOTIF_MIN, Math.min(640, window.innerWidth - (dockQuery.matches ? 620 : 24))); }
  function setNotifWidth(w, save) {
    w = Math.round(Math.min(notifMax(), Math.max(NOTIF_MIN, w)));
    appEl.style.setProperty('--notif-w', w + 'px');
    notifHandle.setAttribute('aria-valuenow', w);
    notifHandle.setAttribute('aria-valuemax', notifMax());
    if (save) { try { localStorage.setItem(NOTIF_KEY, String(w)); } catch (e) {} }
  }
  function setNotifOpen(open) {
    notifPanel.hidden = !open;
    appEl.classList.toggle('notif-open', open);
    $('#bell').setAttribute('aria-expanded', String(open));
    if (open) renderNotifs();
  }
  (function () {
    var saved = NOTIF_DEFAULT;
    try { saved = parseInt(localStorage.getItem(NOTIF_KEY), 10) || NOTIF_DEFAULT; } catch (e) {}
    setNotifWidth(saved);
  })();
  window.addEventListener('resize', function () { setNotifWidth(parseInt(notifHandle.getAttribute('aria-valuenow'), 10) || NOTIF_DEFAULT); });
  notifHandle.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    notifHandle.setPointerCapture(e.pointerId);
    appEl.classList.add('resizing');
    var right = notifPanel.getBoundingClientRect().right;
    function move(ev) { setNotifWidth(right - ev.clientX); }
    function up(ev) {
      setNotifWidth(right - ev.clientX, true);
      appEl.classList.remove('resizing');
      notifHandle.removeEventListener('pointermove', move);
      notifHandle.removeEventListener('pointerup', up);
      notifHandle.removeEventListener('pointercancel', up);
    }
    notifHandle.addEventListener('pointermove', move);
    notifHandle.addEventListener('pointerup', up);
    notifHandle.addEventListener('pointercancel', up);
  });
  notifHandle.addEventListener('keydown', function (e) {
    var w = parseInt(notifHandle.getAttribute('aria-valuenow'), 10) || NOTIF_DEFAULT;
    var next = { ArrowLeft: w + 24, ArrowRight: w - 24, Home: NOTIF_MIN, End: notifMax() }[e.key];
    if (next != null) { e.preventDefault(); setNotifWidth(next, true); }
  });
  notifHandle.addEventListener('dblclick', function () { setNotifWidth(NOTIF_DEFAULT, true); });
  $('#notif-close').addEventListener('click', function () { setNotifOpen(false); $('#bell').focus(); });
  $('#bell').addEventListener('click', function () { setNotifOpen(notifPanel.hidden); });
  $('#mark-read').addEventListener('click', function () {
    visibleNotifs().forEach(function (n) { n.unread = false; }); renderBell(); renderNotifs();
  });

  // Export menu
  var exportBtn = $('#export-btn'), exportMenu = $('#export-menu');
  exportBtn.addEventListener('click', function (e) {
    e.stopPropagation(); exportMenu.hidden = !exportMenu.hidden; exportBtn.setAttribute('aria-expanded', !exportMenu.hidden);
  });
  document.addEventListener('click', function (e) {
    if (!exportMenu.hidden && !exportMenu.contains(e.target)) { exportMenu.hidden = true; exportBtn.setAttribute('aria-expanded', 'false'); }
    // When docked the panel sits beside the content, so clicks elsewhere leave it open
    if (!notifPanel.hidden && !dockQuery.matches && !notifPanel.contains(e.target) && !e.target.closest('#bell')) setNotifOpen(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { exportMenu.hidden = true; if (!notifPanel.hidden) setNotifOpen(false); }
  });
  function wireExportButton(b) {
    b.addEventListener('click', function () {
      exportMenu.hidden = true;
      if (b.dataset.export === 'csv') exportCsv(); else if (b.dataset.export === 'csv-money') exportMoneyCsv(); else exportXlsx();
    });
  }
  $$('#export-menu [data-export]').forEach(wireExportButton);

  // ---------- exports ----------
  function download(blob, name) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function postRows() {
    return posts.slice().sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); }).map(function (p) {
      return {
        date: p.date, time: p.time || '', channel: CHANNELS[p.channel], title: p.title, status: STATUS_LABEL[p.status],
        tags: p.tags.map(tagLabel).join(', '), reach: p.reach || '', engagements: p.engagements || '',
        rate: p.reach ? p.engagements / p.reach : '',
        // Monetization: blank for channels without payouts or posts not yet published
        monetized: p.revenue ? 'Yes' : (MONETIZATION[p.channel] && p.status === 'published' && p.reach ? 'No' : ''),
        revenue: p.revenue ? revTotal(p) : '', rpm: p.revenue ? revTotal(p) / p.reach * 1000 : '',
        src: p.revenue || null
      };
    });
  }
  function slug(name) { return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'brand'; }
  function csvCell(v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function exportMoneyCsv() {
    if (!MONEY_CHANNELS.length) { toast('No monetized channels connected', 'Connect YouTube, Facebook, Instagram, TikTok or X to report revenue.'); return; }
    var from = addDays(TODAY, -30), mon = monetization(from, TODAY);
    var head = ['Channel', 'Programs', 'Published posts', 'Monetized posts', 'Monetized views', 'Est. revenue (USD)', 'RPM (USD)']
      .concat(REV_SOURCES.map(function (src) { return src[1] + ' (USD)'; }));
    var lines = ['# ' + B.name + ' monetization, ' + from + ' to ' + addDays(TODAY, -1) + '. Estimates in USD; platforms may revise figures.', head.join(',')]
      .concat(mon.rows.map(function (r) {
        return [CHANNELS[r.channel], MONETIZATION[r.channel].programs, r.posts, r.monetized, r.views, r.revenue.toFixed(2), r.views ? r.rpm.toFixed(2) : '']
          .concat(REV_SOURCES.map(function (src) { return r.src[src[0]].toFixed(2); })).map(csvCell).join(',');
      }))
      .concat([['Total', '', mon.rows.reduce(function (t, r) { return t + r.posts; }, 0), mon.total.monetized, mon.total.views, mon.total.revenue.toFixed(2), mon.total.views ? mon.total.rpm.toFixed(2) : '']
        .concat(REV_SOURCES.map(function (src) { return mon.rows.reduce(function (t, r) { return t + r.src[src[0]]; }, 0).toFixed(2); })).map(csvCell).join(',')]);
    download(new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'campaign-span-' + slug(B.name) + '-monetization-' + TODAY + '.csv');
    toast('Monetization CSV exported', money(mon.total.revenue) + ' estimated across ' + mon.rows.length + ' channel' + (mon.rows.length === 1 ? '' : 's'));
  }
  function exportCsv() {
    var head = ['Date', 'Time', 'Channel', 'Title', 'Status', 'Tagged', 'Reach', 'Engagements', 'Engagement / open rate',
      'Monetized', 'Est. revenue (USD)', 'RPM (USD)'].concat(REV_SOURCES.map(function (src) { return src[1] + ' (USD)'; }));
    var lines = [head.join(',')].concat(postRows().map(function (r) {
      return [r.date, r.time, r.channel, r.title, r.status, r.tags, r.reach, r.engagements, r.rate === '' ? '' : (r.rate * 100).toFixed(2) + '%',
        r.monetized, r.revenue === '' ? '' : r.revenue.toFixed(2), r.rpm === '' ? '' : r.rpm.toFixed(2)]
        .concat(REV_SOURCES.map(function (src) { return r.src ? r.src[src[0]].toFixed(2) : ''; })).map(csvCell).join(',');
    }));
    download(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), 'campaign-span-' + slug(B.name) + '-calendar-' + TODAY + '.csv');
    toast('CSV exported', posts.length + ' calendar entries');
  }
  function loadScript(src) {
    return new Promise(function (res, rej) {
      if (window.ExcelJS) return res();
      var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }
  function exportXlsx() {
    toast('Building Excel report…');
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js').then(function () {
      var from = addDays(TODAY, -30), cur = analyze(from, TODAY), recs = recommendations(cur), mon = monetization(from, TODAY);
      var USD = '"$"#,##0.00';
      var wb = new window.ExcelJS.Workbook();
      wb.creator = 'Campaign Span'; wb.created = new Date();
      var BRAND = 'FFD90368', ZEBRA = 'FFF4EEEC', BORDER = { bottom: { style: 'thin', color: { argb: 'FFE3E0D8' } } };
      function header(row) {
        row.height = 22;
        row.eachCell(function (c) {
          c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND } };
          c.alignment = { vertical: 'middle' };
        });
      }
      function zebra(ws, start) {
        for (var r = start; r <= ws.rowCount; r++) {
          ws.getRow(r).eachCell({ includeEmpty: true }, function (c) {
            c.border = BORDER;
            if ((r - start) % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
          });
        }
      }
      function title(ws, text, span) {
        ws.mergeCells('A1:' + span + '1');
        var t = ws.getCell('A1'); t.value = text; t.font = { bold: true, size: 16, color: { argb: 'FF820263' } };
        ws.getRow(1).height = 28;
        var s = ws.getCell('A2'); s.value = B.name + ' · ' + nice(from) + ' – ' + nice(addDays(TODAY, -1)) + ' · Generated ' + new Date().toLocaleString('en-US');
        s.font = { italic: true, color: { argb: 'FF5E5C70' } };
      }

      // Summary
      var s = wb.addWorksheet('Summary', { views: [{ showGridLines: false }] });
      s.columns = [{ width: 38 }, { width: 22 }];
      title(s, 'Content Performance Report', 'B');
      s.addRow([]);
      header(s.addRow(['Metric', 'Last 30 days']));
      [['Posts published', cur.posts, '0'], ['Social reach', cur.reach, '#,##0'], ['Social engagements', cur.eng, '#,##0'],
       ['Engagement rate', cur.er, '0.0%'], ['Email open rate', cur.openRate, '0.0%'],
       ['Entries planned (next 30 days)', posts.filter(function (p) { return p.date >= TODAY && p.date <= addDays(TODAY, 30); }).length, '0']
      ].concat(MONEY_CHANNELS.length ? [['Est. creator revenue (USD)', Math.round(mon.total.revenue * 100) / 100, USD], ['Monetized posts', mon.total.monetized, '0']] : []).forEach(function (r) { var row = s.addRow([r[0], r[1]]); row.getCell(2).numFmt = r[2]; row.getCell(2).alignment = { horizontal: 'right' }; });
      zebra(s, 5);
      s.addRow([]);
      var rh = s.addRow(['Recommendations & gaps']); rh.font = { bold: true, size: 13, color: { argb: 'FF820263' } };
      recs.forEach(function (r) {
        var row = s.addRow([r.title, r.text]);
        row.getCell(1).font = { bold: true };
        row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
        row.getCell(1).alignment = { wrapText: true, vertical: 'top' };
        row.height = 48;
      });
      s.getColumn(2).width = 70;

      // By channel
      var c = wb.addWorksheet('By channel', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
      c.columns = [{ width: 16 }, { width: 10 }, { width: 14 }, { width: 16 }, { width: 18 }, { width: 20 }];
      title(c, 'Performance by channel', 'F');
      c.addRow([]);
      header(c.addRow(['Channel', 'Posts', 'Reach', 'Engagements', 'Share of posts', 'Eng. / open rate']));
      Object.keys(CHANNELS).forEach(function (k) {
        var b = cur.by[k]; if (!b.posts) return;
        var row = c.addRow([CHANNELS[k], b.posts, b.reach, b.eng, k === 'email' ? null : b.posts / cur.socialPosts, b.eng / b.reach]);
        row.getCell(3).numFmt = '#,##0'; row.getCell(4).numFmt = '#,##0'; row.getCell(5).numFmt = '0%'; row.getCell(6).numFmt = '0.0%';
      });
      zebra(c, 5);
      c.autoFilter = { from: 'A4', to: 'F4' };

      // Monetization
      var m = wb.addWorksheet('Monetization', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
      m.columns = [{ width: 14 }, { width: 44 }, { width: 11 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 13 }, { width: 16 }, { width: 13 }, { width: 16 }];
      title(m, 'Monetization (estimated, USD)', 'K');
      var note = m.getCell('A3');
      note.value = 'Estimated creator earnings reported by connected platforms. Platforms report revenue 1\u20133 days late and may revise it. RPM = revenue per 1,000 monetized views.';
      note.font = { italic: true, size: 9, color: { argb: 'FF5E5C70' } };
      if (!MONEY_CHANNELS.length) {
        m.addRow(['No monetized channels are connected. Connect YouTube, Facebook, Instagram, TikTok or X to report revenue.']);
      } else {
        header(m.addRow(['Channel', 'Programs', 'Published', 'Monetized', 'Mon. views', 'Est. revenue', 'RPM'].concat(REV_SOURCES.map(function (src) { return src[1]; }))));
        var firstRow = m.rowCount + 1;
        mon.rows.forEach(function (r) {
          var row = m.addRow([CHANNELS[r.channel], MONETIZATION[r.channel].programs, r.posts, r.monetized, r.views,
            Math.round(r.revenue * 100) / 100, r.views ? r.rpm : null].concat(REV_SOURCES.map(function (src) { return Math.round(r.src[src[0]] * 100) / 100; })));
          row.getCell(5).numFmt = '#,##0';
          [6, 7, 8, 9, 10, 11].forEach(function (i) { row.getCell(i).numFmt = USD; });
        });
        var lastRow = m.rowCount;
        zebra(m, firstRow);
        // Totals use live formulas so edits in Excel stay consistent
        // Cached results let previewers that don't calculate (email, Quick Look) still show the totals
        var colTotal = function (key) { return mon.rows.reduce(function (t, r) { return t + (key in r.src ? r.src[key] : r[key]); }, 0); };
        var sum = function (col, key) { return { formula: 'SUM(' + col + firstRow + ':' + col + lastRow + ')', result: Math.round(colTotal(key) * 100) / 100 }; };
        var tot = m.addRow(['Total', '', sum('C', 'posts'), sum('D', 'monetized'), sum('E', 'views'), sum('F', 'revenue'),
          { formula: 'IF(E' + (lastRow + 1) + '=0,"",F' + (lastRow + 1) + '/E' + (lastRow + 1) + '*1000)', result: mon.total.views ? mon.total.rpm : '' },
          sum('H', 'ads'), sum('I', 'subs'), sum('J', 'tips'), sum('K', 'bonus')]);
        tot.font = { bold: true };
        tot.eachCell(function (cell) { cell.border = { top: { style: 'thin', color: { argb: 'FF2E294E' } } }; });
        tot.getCell(5).numFmt = '#,##0';
        [6, 7, 8, 9, 10, 11].forEach(function (i) { tot.getCell(i).numFmt = USD; });
        m.getColumn(2).alignment = { wrapText: true, vertical: 'top' };

        var earners = posts.filter(function (x) { return x.revenue && x.date >= from && x.date < TODAY; })
          .sort(function (a, b) { return revTotal(b) - revTotal(a); }).slice(0, 10);
        if (earners.length) {
          m.addRow([]);
          var th = m.addRow(['Top earning posts']); th.font = { bold: true, size: 13, color: { argb: 'FF820263' } };
          header(m.addRow(['Date', 'Title', 'Channel', 'Mon. views', 'Est. revenue', 'RPM', 'Top source']));
          var topStart = m.rowCount + 1;
          earners.forEach(function (x) {
            var top = REV_SOURCES.slice().sort(function (a, b) { return x.revenue[b[0]] - x.revenue[a[0]]; })[0];
            var row = m.addRow([parse(x.date), x.title, CHANNELS[x.channel], x.reach, Math.round(revTotal(x) * 100) / 100, revTotal(x) / x.reach * 1000, top[1]]);
            row.getCell(1).numFmt = 'mmm d, yyyy'; row.getCell(4).numFmt = '#,##0'; row.getCell(5).numFmt = USD; row.getCell(6).numFmt = USD;
            row.getCell(7).alignment = { wrapText: true, vertical: 'top' };
          });
          zebra(m, topStart);
        }
      }

      // Posts
      var p = wb.addWorksheet('Calendar', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
      p.columns = [{ width: 12 }, { width: 8 }, { width: 12 }, { width: 32 }, { width: 14 }, { width: 40 }, { width: 11 }, { width: 13 }, { width: 12 }, { width: 11 }, { width: 14 }, { width: 10 }];
      title(p, 'Content calendar & results', 'L');
      p.addRow([]);
      header(p.addRow(['Date', 'Time', 'Channel', 'Title', 'Status', 'Tagged', 'Reach', 'Engagements', 'Rate', 'Monetized', 'Est. revenue', 'RPM']));
      postRows().forEach(function (r) {
        var row = p.addRow([parse(r.date), r.time, r.channel, r.title, r.status, r.tags, r.reach || null, r.engagements || null, r.rate === '' ? null : r.rate,
          r.monetized || null, r.revenue === '' ? null : Math.round(r.revenue * 100) / 100, r.rpm === '' ? null : r.rpm]);
        row.getCell(1).numFmt = 'mmm d, yyyy'; row.getCell(7).numFmt = '#,##0'; row.getCell(8).numFmt = '#,##0'; row.getCell(9).numFmt = '0.0%';
        row.getCell(11).numFmt = USD; row.getCell(12).numFmt = USD;
      });
      zebra(p, 5);
      p.autoFilter = { from: 'A4', to: 'L4' };

      return wb.xlsx.writeBuffer();
    }).then(function (buf) {
      download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'campaign-span-' + slug(B.name) + '-report-' + TODAY + '.xlsx');
      toast('Excel report exported', 'Summary, By channel, Monetization and Calendar sheets');
    }).catch(function () {
      toast('Couldn’t load the Excel builder', 'Exporting CSV instead.');
      exportCsv();
    });
  }

  // ---------- environment branding ----------
  (function () {
    $('.ws-name strong').textContent = ENV.company;
    $('.ws-dot').style.background = ENV.color;
    if (CSEnv.fromUrl()) document.title = ENV.company + ' · Campaign Span demo';
    if (ENV.banner) $('.demo-banner span').textContent = ENV.banner;
    if (!ENV.excel) $$('[data-export="xlsx"]').forEach(function (b) { b.hidden = true; });
    if (ENV_ERROR) setTimeout(function () { toast(ENV_ERROR); }, 300);
  })();

  // ---------- routing ----------
  function route() {
    var v = location.hash.replace('#', '');
    state.view = TITLES_BY_VIEW[v] ? v : 'calendar';
    if (!dockQuery.matches && !notifPanel.hidden) setNotifOpen(false);
    render();
  }
  window.addEventListener('hashchange', route);
  $('#brand-select').addEventListener('change', function (e) { switchBrand(e.target.value); });
  fillViewerOptions();
  renderBrandPicker();
  route();
  renderBell();
})();
