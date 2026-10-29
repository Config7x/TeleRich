// Every bot button gets a colour and a leading emoji, exactly once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decorateMarkup, buttonLook } from '../worker/board.js';

test('navigation is blue, creation is green, destruction is red', () => {
  assert.deepEqual(buttonLook({ text: 'منو', callback_data: 'home:fa' }), ['primary', '🏡']);
  assert.deepEqual(buttonLook({ text: 'قالب‌ها', callback_data: 'tpl:fa:config' }), ['success', '🎀']);
  assert.deepEqual(buttonLook({ text: 'حذف کانال', callback_data: 'destclear:fa' }), ['danger', '🚫']);
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
  assert.equal(kb.inline_keyboard[0][1].style, 'primary');
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
  assert.equal(kb.inline_keyboard[0][0].text, '✨ Open studio');
});
