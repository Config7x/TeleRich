// AI + premium-emoji backend: provider config, key storage, pack parsing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { aiConfig, aiSave, emojiAddPack, emojiPacks, emojiRemovePack, PROVIDERS, emojiTag } from '../worker/ai.js';

function fakeEnv(initial = {}) {
  const store = new Map(Object.entries(initial));
  return { RICHKV: { get: async (k) => store.get(k) ? JSON.parse(store.get(k)) : null,
                     put: async (k, v) => store.set(k, v) }, _store: store };
}
const telegramStub = async () => ({ title: 'TelePack', stickers: [
  { custom_emoji_id: '5368324170671202286', emoji: '👍' },
  { custom_emoji_id: '5339209399120465044', emoji: '✨' },
  { file_id: 'plain', emoji: '🙂' },
] });

test('every provider has a base url and default model', () => {
  for (const [id, p] of Object.entries(PROVIDERS)) {
    assert.ok(p.base.startsWith('https://'), id);
    assert.ok(p.model, id);
  }
});

test('config reports no key until one is saved', async () => {
  const env = fakeEnv();
  const before = await aiConfig(env, 42);
  assert.equal(before.hasKey, false);
  assert.equal(before.provider, 'xai');
  await aiSave(env, 42, { provider: 'groq', key: 'k-123', model: 'llama-3.3-70b-versatile' });
  const after = await aiConfig(env, 42);
  assert.equal(after.hasKey, true);
  assert.equal(after.provider, 'groq');
  assert.equal(after.ownKey, true);
});

test('saving without a key keeps the stored one', async () => {
  const env = fakeEnv();
  await aiSave(env, 7, { provider: 'xai', key: 'secret' });
  await aiSave(env, 7, { provider: 'openrouter' });
  const cfg = await aiConfig(env, 7);
  assert.equal(cfg.hasKey, true);
  assert.equal(cfg.provider, 'openrouter');
});

test('unknown provider is rejected', async () => {
  await assert.rejects(() => aiSave(fakeEnv(), 1, { provider: 'nope', key: 'x' }), /Unknown provider/);
});

test('a pack keeps only custom emoji and normalises the short name', async () => {
  const env = fakeEnv();
  const r = await emojiAddPack(env, 5, { pack: 'https://t.me/addemoji/TeleRichPack' }, telegramStub);
  assert.equal(r.count, 2);
  const list = await emojiPacks(env, 5);
  assert.equal(list.packs[0].name, 'TeleRichPack');
  assert.equal(list.total, 2);
  assert.equal(list.packs[0].emojis[0].id, '5368324170671202286');
});

test('adding the same pack twice does not duplicate it', async () => {
  const env = fakeEnv();
  await emojiAddPack(env, 5, { pack: 'TeleRichPack' }, telegramStub);
  const again = await emojiAddPack(env, 5, { pack: 'TeleRichPack' }, telegramStub);
  assert.equal(again.added, false);
  assert.equal(again.packs.length, 1);
});

test('removing a pack leaves the rest intact', async () => {
  const env = fakeEnv();
  await emojiAddPack(env, 5, { pack: 'One' }, telegramStub);
  await emojiAddPack(env, 5, { pack: 'Two' }, telegramStub);
  const r = await emojiRemovePack(env, 5, { pack: 'One' });
  assert.equal(r.packs.length, 1);
  assert.equal(r.packs[0].name, 'Two');
});

test('emoji tags are built with a numeric id only', () => {
  assert.equal(emojiTag('5368324170671202286', '👍'), '<tg-emoji emoji-id="5368324170671202286">👍</tg-emoji>');
  assert.equal(emojiTag('12ab34', '✨'), '<tg-emoji emoji-id="1234">✨</tg-emoji>');
});
