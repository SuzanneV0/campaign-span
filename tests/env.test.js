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
