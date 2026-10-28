// Guards the visual composer: every block must produce balanced rich HTML and
// the shipped templates must survive a round trip through the generator.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const ts = readFileSync('miniapp/src/blocks.ts', 'utf8');
const { code } = transformSync(ts, { loader: 'ts', format: 'cjs' });
const mod = { exports: {} };
new Function('module', 'exports', code)(mod, mod.exports);
const { blocksToHtml, templates, palette } = mod.exports;

const balanced = (html, tag) =>
  (html.match(new RegExp(`<${tag}\\b`, 'g')) || []).length ===
  (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;

test('palette exposes the documented block kinds', () => {
  const kinds = palette.map(p => p.kind);
  for (const kind of ['heading', 'text', 'quote', 'list', 'table', 'buttons', 'image', 'details', 'spoiler', 'time', 'math']) {
    assert.ok(kinds.includes(kind), `missing block kind: ${kind}`);
  }
});

test('every template renders balanced, non-empty HTML', () => {
  for (const tpl of templates) {
    const html = blocksToHtml(tpl.build());
    assert.ok(html.trim().length > 40, `${tpl.name} rendered nothing`);
    for (const tag of ['blockquote', 'table', 'ul', 'ol', 'details', 'tg-button-row', 'p']) {
      assert.ok(balanced(html, tag), `${tpl.name}: unbalanced <${tag}>`);
    }
    assert.equal((html.match(/<script/i) || []).length, 0, 'templates must not emit scripts');
  }
});

test('button rows carry type, style and payload', () => {
  const html = blocksToHtml([{ id: 'b1', kind: 'buttons', rows: [[
    { label: 'Copy', type: 'copy_text', text: 'vless://demo', style: 'success' },
    { label: 'Channel', type: 'url', url: 'https://t.me/Config7x', style: 'primary' },
  ]] }]);
  assert.match(html, /<tg-button[^>]*type="copy_text"[^>]*style="success"/);
  assert.match(html, /<tg-button[^>]*type="url"[^>]*url="https:\/\/t\.me\/Config7x"/);
  assert.equal((html.match(/<tg-button /g) || []).length, 2);
  assert.equal((html.match(/<\/tg-button>/g) || []).length, 2);
});

test('user text is escaped instead of injected', () => {
  const html = blocksToHtml([{ id: 't1', kind: 'text', text: '<img src=x onerror=alert(1)>', style: 'plain' }]);
  assert.ok(!/<img/i.test(html), 'raw html must be escaped');
  assert.match(html, /&lt;img/);
});

test('tables honour header and row count', () => {
  const html = blocksToHtml([{ id: 'tb', kind: 'table', header: true, rows: [['a', 'b'], ['1', '2'], ['3', '4']], striped: true }]);
  assert.equal((html.match(/<tr>/g) || []).length, 3);
  assert.equal((html.match(/<th>/g) || []).length, 2);
  assert.equal((html.match(/<td>/g) || []).length, 4);
  assert.match(html, /<table[^>]*striped/);
});
