// Premium emoji: real pack map -> text spans, inline buttons and reply keyboard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { premiumButtons, premiumMarkup, premiumText, stripPremium, premiumMap, resetPremiumCache } from '../worker/premium.js';

const map = new Map([
  ['🛸', '111'],
  ['🍉', '222'],
  ['🍉\uFE0F', '222'],
  ['🚀', '333'],
  ['✨', '444'],
]);

test('a button label becomes an icon and loses the character', () => {
  const [button] = premiumButtons([{ text: '🚀 دمو', callback_data: 'demo' }], map);
  assert.equal(button.icon_custom_emoji_id, '333');
  assert.equal(button.text, 'دمو');
  assert.equal(button.callback_data, 'demo');
});

test('every button in a row is decorated, not just the first', () => {
  const row = premiumButtons(
    [{ text: '🍉 سهمیه', callback_data: 'q' }, { text: '🎯 مقصد', callback_data: 'd' }, { text: 'بی‌ایموجی', callback_data: 'n' }],
    map
  );
  assert.equal(row[0].icon_custom_emoji_id, '222');
  assert.equal(row[1].icon_custom_emoji_id, undefined); // unknown emoji stays plain
  assert.equal(row[1].text, '🎯 مقصد'); // untouched, never stripped blindly
  assert.equal(row[2].text, 'بی‌ایموجی');
});

test('an emoji in the middle of a label still becomes the icon', () => {
  const [button] = premiumButtons([{ text: 'ساخت 🛸 پست', callback_data: 'x' }], map);
  assert.equal(button.icon_custom_emoji_id, '111');
  assert.equal(button.text, 'ساخت پست');
});

test('a label that is only an emoji keeps its character', () => {
  const [button] = premiumButtons([{ text: '🍉' }], map);
  assert.equal(button.icon_custom_emoji_id, '222');
  assert.equal(button.text, '🍉');
});

test('VS16 variants resolve to the same id', () => {
  const [button] = premiumButtons([{ text: '🍉\uFE0F کپی' }], map);
  assert.equal(button.icon_custom_emoji_id, '222');
});

test('reply keyboard rows are decorated too', () => {
  const markup = premiumMarkup(
    { keyboard: [[{ text: '✨ ساخت پست' }, { text: '🍉 سهمیه' }]], resize_keyboard: true, is_persistent: true },
    map
  );
  assert.equal(markup.keyboard[0][0].icon_custom_emoji_id, '444');
  assert.equal(markup.keyboard[0][0].text, 'ساخت پست');
  assert.equal(markup.keyboard[0][1].icon_custom_emoji_id, '222');
  assert.equal(markup.resize_keyboard, true);
});

test('inline and reply keyboards are both handled in one markup', () => {
  const markup = premiumMarkup(
    { inline_keyboard: [[{ text: '🚀 دمو', callback_data: 'a' }]], keyboard: [[{ text: '🍉 سهمیه' }]] },
    map
  );
  assert.equal(markup.inline_keyboard[0][0].icon_custom_emoji_id, '333');
  assert.equal(markup.keyboard[0][0].icon_custom_emoji_id, '222');
});

test('without a pack map nothing is touched', () => {
  const markup = { inline_keyboard: [[{ text: '🚀 دمو', callback_data: 'a' }]] };
  assert.deepEqual(premiumMarkup(markup, null), markup);
  assert.deepEqual(premiumButtons([{ text: '🚀 دمو' }], null), [{ text: '🚀 دمو' }]);
  assert.equal(premiumText('🚀 دمو', null), '🚀 دمو');
});

test('an existing icon is never overwritten', () => {
  const [button] = premiumButtons([{ text: '🍉 سهمیه', icon_custom_emoji_id: '999' }], map);
  assert.equal(button.icon_custom_emoji_id, '999');
});

test('text gets tg-emoji spans but code and pre stay byte-identical', () => {
  const html = '🍉 متن <code>🍉</code> <pre>🚀</pre>';
  const out = premiumText(html, map);
  assert.equal(out, '<tg-emoji emoji-id="222">🍉</tg-emoji> متن <code>🍉</code> <pre>🚀</pre>');
});

test('unknown emoji in text is left alone', () => {
  assert.equal(premiumText('🎯 مقصد', map), '🎯 مقصد');
});

test('stripPremium removes icons and spans for the plain retry', () => {
  const payload = {
    text: '<tg-emoji emoji-id="222">🍉</tg-emoji> پست',
    reply_markup: { inline_keyboard: [[{ text: 'دمو', icon_custom_emoji_id: '333' }]], keyboard: [[{ text: 'سهمیه', icon_custom_emoji_id: '222' }]] },
  };
  const plain = stripPremium(payload);
  assert.equal(plain.text, '🍉 پست');
  assert.equal(plain.reply_markup.inline_keyboard[0][0].icon_custom_emoji_id, undefined);
  assert.equal(plain.reply_markup.keyboard[0][0].icon_custom_emoji_id, undefined);
});

test('the map is built from the stored packs with all VS16 variants', async () => {
  const env = {
    ADMINS_ID: '42',
    RICHKV: { get: async () => [{ emojis: [{ id: '777', char: '🍉' }, { id: '888', char: '🛸' }] }] },
  };
  const built = await premiumMap(env);
  assert.equal(built.get('🍉'), '777');
  assert.equal(built.get('🍉\uFE0F'), '777');
  assert.equal(built.get('🛸'), '888');
});

test('no packs means no map, so sends stay plain instead of failing', async () => {
  resetPremiumCache();
  const env = { ADMINS_ID: '42', RICHKV: { get: async () => [] } };
  assert.equal(await premiumMap(env), null);
});
