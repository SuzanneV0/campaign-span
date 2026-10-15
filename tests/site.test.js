// Every page's local links, scripts and styles point at files that exist, and every script parses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const pages = readdirSync(root).filter((f) => f.endsWith('.html'));
const isLocal = (u) => u && !/^(https?:|mailto:|tel:|data:|javascript:|#)/i.test(u) && !u.startsWith('//');

for (const page of pages) {
  test(`${page}: local links and assets exist`, () => {
    const html = readFileSync(new URL(page, root), 'utf8');
    const refs = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1]).filter(isLocal);
    const missing = refs.map((u) => u.split(/[?#]/)[0]).filter((p) => p && !existsSync(new URL(p, root)));
    assert.deepEqual(missing, []);
  });
}

test('pages linked from the shared header and footer exist', () => {
  const js = readFileSync(new URL('assets/site.js', root), 'utf8');
  const missing = [...new Set(js.match(/[a-z-]+\.html/g))].filter((p) => !existsSync(new URL(p, root)));
  assert.deepEqual(missing, []);
});

for (const file of readdirSync(new URL('assets/', root)).filter((f) => f.endsWith('.js'))) {
  test(`assets/${file} parses`, () => {
    assert.doesNotThrow(() => new vm.Script(readFileSync(new URL('assets/' + file, root), 'utf8'), { filename: file }));
  });
}
