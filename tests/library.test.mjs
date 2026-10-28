// The block library is the product surface: every entry must render rich HTML
// that is non-empty, balanced and safe for user text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(mkdtempSync(join(tmpdir(), 'tr-lib-')), 'lib.mjs');
execFileSync('npx', ['esbuild', 'miniapp/src/library.ts', '--bundle', '--format=esm', `--outfile=${out}`, '--log-level=error']);
const lib = await import(out);

const balanced = (html, tag) => {
  const open = (html.match(new RegExp(`<${tag}(\\s|>)`, 'g')) || []).length;
  const close = (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
  return open === close;
};

test('library ships every documented block', () => {
  assert.equal(lib.KINDS.length, 86);
  assert.deepEqual([...new Set(lib.KINDS.map((k) => k.key))].length, 86);
  assert.ok(lib.CATS.length >= 9);
});

test('every block renders non-empty rich HTML with balanced tags', () => {
  const broken = [];
  for (const kind of lib.KINDS) {
    const html = lib.renderKind(kind.key, {});
    if (!html.trim()) { broken.push(kind.key); continue; }
    for (const tag of ['blockquote', 'details', 'table', 'tg-button-row', 'tg-button', 'tg-spoiler', 'ul', 'ol']) {
      if (!balanced(html, tag)) { broken.push(`${kind.key}:${tag}`); }
    }
  }
  assert.deepEqual(broken, []);
});

test('user text is escaped instead of injected', () => {
  const html = lib.renderKind('text', { text: '<script>alert(1)</script> & <b>hi</b>' });
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&amp;'));
});

test('inline marks survive but raw tags do not', () => {
  const html = lib.renderKind('text', { text: '**bold** ==mark== __italic__' });
  assert.ok(html.includes('<b>bold</b>'));
  assert.ok(html.includes('<mark>mark</mark>'));
  assert.ok(html.includes('<i>italic</i>'));
  const evil = lib.renderKind('text', { text: '**<img src=x onerror=1>**' });
  assert.ok(!evil.includes('<img'));
});

test('config block nests the config in a copyable blockquote', () => {
  const html = lib.renderKind('config', {});
  assert.ok(html.includes('<blockquote><blockquote><code>vless://'));
  assert.ok(html.includes('type="copy_text"'));
  assert.ok(html.includes('https://t.me/Config7x'));
});

test('every category has at least one block and a count helper', () => {
  for (const cat of lib.CATS) assert.ok(lib.countIn(cat) > 0, cat);
});
