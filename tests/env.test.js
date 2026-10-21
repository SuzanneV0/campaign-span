// Demo environment links (assets/env.js): the admin console builds them and the demo reads them back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const window = {};
vm.runInNewContext(readFileSync(new URL('../assets/env.js', import.meta.url), 'utf8'),
  { window, btoa, atob, escape, unescape, location: { href: 'https://example.test/demo.html' } });
const E = window.CSEnv;
// Objects made inside the sandbox have its prototypes; copy them out before deep comparisons.
const plain = (v) => JSON.parse(JSON.stringify(v));

test('normalize fills in defaults for missing or junk input', () => {
  assert.deepEqual(E.normalize(null), E.DEFAULT);
  assert.deepEqual(E.normalize('nope'), E.DEFAULT);
  const out = E.normalize({ industry: 'mining', color: 'red', data: 'lots', channels: ['myspace'], people: [{ name: 'X', dept: 'Legal' }] });
  assert.equal(out.industry, E.DEFAULT.industry);
  assert.equal(out.color, E.DEFAULT.color);
  assert.equal(out.data, E.DEFAULT.data);
  assert.deepEqual(out.channels, E.DEFAULT.channels);
  assert.deepEqual(out.people, E.DEFAULT.people);
});

test('normalize keeps valid values and trims long ones', () => {
  const out = E.normalize({ company: '  ' + 'A'.repeat(80), industry: 'saas', color: '#00aaff', channels: ['tiktok', 'email'],
    people: [{ name: ' Ana ', dept: 'Sales' }], notify: { Sales: 'axe' }, banner: 'B'.repeat(200), excel: false });
  assert.equal(out.company.length, 60);
  assert.equal(out.industry, 'saas');
  assert.equal(out.color, '#00aaff');
  assert.deepEqual(plain(out.channels), ['tiktok', 'email']);
  assert.deepEqual(plain(out.people), [{ name: 'Ana', dept: 'Sales' }]);
  assert.equal(out.notify.Sales, 'ae');
  assert.equal(out.banner.length, 140);
  assert.equal(out.excel, false);
});

test('links round-trip, including non-ASCII text, and are URL-safe', () => {
  const cfg = E.normalize({ company: 'Café Ünïcode ✨', banner: 'Bienvenue à l’équipe' });
  const code = E.encode(cfg);
  assert.match(code, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(E.normalize(E.decode(code)), cfg);
  assert.equal(E.fromUrl('https://x.test/demo.html?a=1&env=' + code + '#top'), code);
  assert.equal(E.fromUrl('https://x.test/demo.html'), null);
});

test('the standard demo has three brands on the Business plan', () => {
  const d = E.normalize(null);
  assert.equal(d.plan, 'business');
  assert.deepEqual(plain(d.brands.map((b) => b.name)), ['Northwind Café', 'Northwind Foundation']);
});

test('links made before brands existed stay single-brand', () => {
  const old = E.normalize({ company: 'Maple & Pine', industry: 'saas' });
  assert.deepEqual(plain(old.brands), []);
  assert.equal(old.plan, 'business');
});

test('brands are cleaned up and capped by the plan', () => {
  const brands = [
    { name: '  Second  ', industry: 'food', color: '#112233', channels: ['tiktok', 'myspace'] },
    { name: 'Third', industry: 'mining', color: 'teal', channels: [] },
    { name: '' },
    'junk',
  ];
  const team = E.normalize({ plan: 'team', industry: 'saas', color: '#00aaff', channels: ['x', 'email'], brands });
  assert.deepEqual(plain(team.brands), [{ name: 'Second', industry: 'food', color: '#112233', channels: ['tiktok'] }], 'Team includes 2 brands, so only one extra');

  const biz = E.normalize({ plan: 'business', industry: 'saas', color: '#00aaff', channels: ['x', 'email'], brands });
  assert.deepEqual(plain(biz.brands[1]), { name: 'Third', industry: 'saas', color: '#00aaff', channels: ['x', 'email'] }, 'bad values fall back to the company’s');

  assert.deepEqual(plain(E.normalize({ plan: 'starter', brands }).brands), []);
  assert.equal(E.normalize({ plan: 'free' }).plan, 'business');
  const many = Array.from({ length: 20 }, (_, i) => ({ name: 'Brand ' + i }));
  assert.equal(E.normalize({ plan: 'enterprise', brands: many }).brands.length, 9, 'demo links hold at most 10 brands');
});

test('brands survive the link round trip', () => {
  const cfg = E.normalize({ company: 'Acme', plan: 'enterprise', brands: [{ name: 'Acmé Kids', industry: 'apparel', color: '#abcdef', channels: ['instagram'] }] });
  assert.deepEqual(plain(E.normalize(E.decode(E.encode(cfg)))), plain(cfg));
  assert.equal(cfg.brands[0].name, 'Acmé Kids');
});
