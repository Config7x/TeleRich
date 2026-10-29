// Every bot button gets a colour and a leading emoji, exactly once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decorateMarkup, buttonLook } from '../worker/board.js';

test('navigation is blue, creation is green, destruction is red', () => {
  assert.deepEqual(buttonLook({ text: 'منو', callback_data: 'home:fa' }), [null, '🏠']);
  assert.deepEqual(buttonLook({ text: 'قالب‌ها', callback_data: 'tpl:fa:config' }), ['success', '🗂']);
  assert.deepEqual(buttonLook({ text: 'حذف کانال', callback_data: 'destclear:fa' }), ['danger', '🗑']);
});

test('admin quota buttons follow their own action, not the panel', () => {
  assert.equal(buttonLook({ text: '+10', callback_data: 'admx:fa:77:plus:0' })[0], 'success');
  assert.equal(buttonLook({ text: '-10', callback_data: 'admx:fa:77:minus:0' })[0], 'danger');
  assert.equal(buttonLook({ text: 'reset', callback_data: 'admx:fa:77:reset:0' })[0], 'danger');
});

test('a plain label gets an icon, an icon label is left alone', () => {
  const kb = decorateMarkup({ inline_keyboard: [[{ text: 'سهمیه', callback_data: 'quota:fa' }, { text: '⬅️', callback_data: 'admp:fa:0' }]] });
  assert.equal(kb.inline_keyboard[0][0].text, '🎁 سهمیه');
  assert.equal(kb.inline_keyboard[0][1].text, '⬅️');
  assert.equal(kb.inline_keyboard[0][0].style, 'success');
  assert.equal(kb.inline_keyboard[0][1].style, undefined);
});

test('an existing style is never overwritten', () => {
  const kb = decorateMarkup({ inline_keyboard: [[{ text: 'خرید', callback_data: 'x', style: 'danger' }]] });
  assert.equal(kb.inline_keyboard[0][0].style, 'danger');
});

test('reply keyboard buttons get icons but no style (Telegram does not allow it)', () => {
  const kb = decorateMarkup({ keyboard: [[{ text: 'راهنما' }, { text: '🎨 قالب‌ها' }]], resize_keyboard: true });
  assert.equal(kb.keyboard[0][0].text, '🎓 راهنما');
  assert.equal(kb.keyboard[0][0].style, undefined);
  assert.equal(kb.keyboard[0][1].text, '🎨 قالب‌ها');
});

test('a studio mini app button is blue with a spark', () => {
  const kb = decorateMarkup({ inline_keyboard: [[{ text: 'Open studio', web_app: { url: 'https://x' } }]] });
  assert.equal(kb.inline_keyboard[0][0].style, 'primary');
  assert.equal(kb.inline_keyboard[0][0].text, '🎨 Open studio');
});

test('the menu puts the primary action first and the language row last', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../worker/worker.js', import.meta.url), 'utf8');
  const menu = src.slice(src.indexOf('function menu('), src.indexOf('// Persistent bottom keyboard'));
  const order = [...menu.matchAll(/text: fa \? '([^']+)'/g)].map((m) => m[1]);
  assert.match(order[0], /استودیو/);
  assert.match(order[order.length - 1], /English|فارسی/);
  assert.ok(order.indexOf('🎨 قالب‌ها') < order.indexOf('🎁 سهمیه'));
});

test('admin settings sit above the language row, not above everything', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../worker/worker.js', import.meta.url), 'utf8');
  assert.match(src, /kb\.inline_keyboard\.splice\(Math\.max\(0, kb\.inline_keyboard\.length - 1\)/);
  assert.ok(!/kb\.inline_keyboard\.unshift\(\[\{ text: lang === 'fa' \? '⚙️ تنظیمات ربات'/.test(src));
});

test('a row never shows two coloured buttons', () => {
  const kb = decorateMarkup({
    inline_keyboard: [[
      { text: 'قالب‌ها', callback_data: 'templates:fa' },   // success
      { text: 'سهمیه', callback_data: 'quota:fa' },         // success, must go neutral
    ]],
  });
  assert.equal(kb.inline_keyboard[0][0].style, 'success');
  assert.equal(kb.inline_keyboard[0][1].style, undefined);
});

test('danger outranks success inside one row', () => {
  const kb = decorateMarkup({ inline_keyboard: [[{ text: 'خرید', callback_data: 'quota:fa' }, { text: 'حذف', callback_data: 'destclear:fa' }]] });
  const [green, red] = kb.inline_keyboard[0];
  assert.equal(red.style, 'danger');
  assert.equal(green.style, undefined);
});

test('navigation rows stay neutral, so the board is not a wall of blue', () => {
  const kb = decorateMarkup({ inline_keyboard: [[
    { text: 'بلوک‌ها', callback_data: 'list:fa:Blocks:0' },
    { text: 'متن ریچ', callback_data: 'list:fa:Rich text:0' },
  ], [{ text: 'راهنما', callback_data: 'guide:fa' }, { text: 'درباره', callback_data: 'about:fa' }]] });
  for (const row of kb.inline_keyboard) for (const b of row) assert.equal(b.style, undefined);
  assert.equal(kb.inline_keyboard[1][0].text, '🎓 راهنما');
});
