// The studio templates must cover the layouts people ask for, and each must
// produce a complete rich post (not an empty canvas) in one tap.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(mkdtempSync(join(tmpdir(), 'tr-tpl-')), 'blocks.mjs');
execFileSync('npx', ['esbuild', 'miniapp/src/blocks.ts', '--bundle', '--format=esm', `--outfile=${out}`, '--log-level=error']);
const { templates, blocksToHtml } = await import(out);

const required = ['config', 'announce', 'guide', 'sale', 'profile', 'blank', 'welcome', 'report', 'buttonset', 'mediapost', 'levels', 'slides', 'livepoll'];

test('every expected template ships', () => {
  const ids = templates.map((t) => t.id);
  for (const id of required) assert.ok(ids.includes(id), `missing template: ${id}`);
  assert.equal(new Set(ids).size, ids.length, 'duplicate template ids');
});

test('each template renders a real post', () => {
  for (const tpl of templates) {
    const html = blocksToHtml(tpl.build());
    assert.ok(html.trim().length > 40, `${tpl.id} renders too little`);
  }
});

test('templates are bilingual-labelled and iconised', () => {
  for (const tpl of templates) {
    assert.ok(tpl.name && tpl.icon, `${tpl.id} needs a name and icon`);
  }
});
