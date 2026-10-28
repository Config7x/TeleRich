// The worker bundle must exist, inline the studio and expose its data arrays.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const path = 'worker/index.js';

test('worker bundle is generated', () => {
  assert.ok(existsSync(path), 'run `npm run build` first');
  const src = readFileSync(path, 'utf8');
  assert.ok(src.length > 500_000, 'bundle looks too small');
  assert.match(src, /export const guides = \[/);
  assert.match(src, /export const releases = \[/);
  assert.match(src, /export default "/);
});

test('studio html is self-contained and bridge is self-hosted', () => {
  const src = readFileSync(path, 'utf8');
  assert.ok(src.includes('/telegram-web-app.js'), 'telegram bridge must be self-hosted');
  assert.ok(!src.includes('src="https://telegram.org/js/telegram-web-app.js"'), 'no remote bridge allowed');
  assert.ok(src.includes('cmp-palette'), 'visual composer markup missing from bundle');
});
