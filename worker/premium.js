// Premium-emoji layer.
//
// Two rules learned the hard way:
//   1. Only IDs harvested by THIS bot are usable. Invented or copied IDs make
//      Telegram answer 400 and every message falls back to plain emoji, which
//      looks exactly like "premium emoji are broken".
//   2. Premium emoji need a Premium owner. When Telegram refuses, the caller
//      strips the marks and resends plain, so a post never disappears.
//
// Everything is driven by the real pack registry in RICHKV (`emo:<owner>`,
// filled by /emoji <t.me/addemoji/...> via getStickerSet).

const TTL = 60_000;
let CACHE = { at: 0, key: '', map: null };
let DEAD_UNTIL = 0; // set after Telegram refuses the marks, so we stop retrying every send

export const premiumOff = (env) => env.PREMIUM_EMOJI === '0' || Date.now() < DEAD_UNTIL;

export function markPremiumDead(ms = 10 * 60_000) {
  DEAD_UNTIL = Date.now() + ms;
  CACHE = { at: 0, key: '', map: null };
}

export function resetPremiumCache() {
  CACHE = { at: 0, key: '', map: null };
}

// Whose packs drive the icons: an explicit owner, else the quota-exempt owner id.
// ADMINS_ID cannot be used blindly — the same value restricts the bot to admins.
const ownerOf = (env) => String(env.EMOJI_OWNER || env.ADMINS_ID || env.QUOTA_EXEMPT || '').split(/[,\s]+/).filter(Boolean)[0] || '';

/** Map of emoji char (all VS16 variants) → custom_emoji_id, from the owner's packs. */
export async function premiumMap(env) {
  const owner = ownerOf(env);
  if (!owner || !env.RICHKV) return null;
  const key = 'emo:' + owner;
  if (CACHE.map && CACHE.key === key && Date.now() - CACHE.at < TTL) return CACHE.map;
  let packs = [];
  try {
    packs = (await env.RICHKV.get(key, 'json')) || [];
  } catch {
    packs = [];
  }
  const map = new Map();
  for (const pack of packs) {
    for (const item of pack?.emojis || []) {
      if (!item || !item.id || !item.char) continue;
      const id = String(item.id).replace(/\D/g, '');
      if (!id) continue;
      const bare = String(item.char).replace(/\uFE0F/g, '');
      for (const variant of [bare, bare + '\uFE0F', String(item.char)]) {
        if (!map.has(variant)) map.set(variant, id);
      }
    }
  }
  CACHE = { at: Date.now(), key, map: map.size ? map : null };
  return CACHE.map;
}

const RUN = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/u;
const RUN_ALL = new RegExp(RUN.source, 'gu');
const bare = (s) => String(s).replace(/\uFE0F/g, '');

/** First emoji in a label that we have a real ID for. */
function iconIn(text, map) {
  if (!map || typeof text !== 'string') return null;
  RUN_ALL.lastIndex = 0;
  let match;
  while ((match = RUN_ALL.exec(text))) {
    const raw = match[0];
    const id = map.get(raw) || map.get(bare(raw)) || map.get(bare(raw) + '\uFE0F');
    if (id) return { id, raw, at: match.index, len: raw.length };
  }
  return null;
}

/** Every button in a row gets its emoji as icon_custom_emoji_id, char removed from the label. */
export function premiumButtons(buttons, map) {
  if (!Array.isArray(buttons) || !map) return buttons;
  return buttons.map((button) => {
    if (!button || typeof button.text !== 'string' || button.icon_custom_emoji_id) return button;
    const hit = iconIn(button.text, map);
    if (!hit) return button;
    const rest = (button.text.slice(0, hit.at) + button.text.slice(hit.at + hit.len)).replace(/\s{2,}/g, ' ').trim();
    // A label that is only an emoji keeps its character; otherwise the icon replaces it.
    return rest ? { ...button, text: rest, icon_custom_emoji_id: hit.id } : { ...button, icon_custom_emoji_id: hit.id };
  });
}

/** Inline keyboards and the persistent reply keyboard alike. */
export function premiumMarkup(markup, map) {
  if (!markup || !map) return markup;
  const out = { ...markup };
  if (Array.isArray(markup.inline_keyboard)) out.inline_keyboard = markup.inline_keyboard.map((row) => premiumButtons(row, map));
  if (Array.isArray(markup.keyboard)) out.keyboard = markup.keyboard.map((row) => premiumButtons(row, map));
  return out;
}

/** Wrap known emoji in <tg-emoji>, never inside code/pre or an existing tg-emoji span. */
export function premiumText(text, map) {
  if (typeof text !== 'string' || !text || !map) return text;
  const parts = text.split(/(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<tg-emoji[\s\S]*?<\/tg-emoji>)/g);
  return parts
    .map((chunk, i) => {
      if (i % 2 === 1) return chunk;
      return chunk.replace(RUN_ALL, (raw) => {
        const id = map.get(raw) || map.get(bare(raw)) || map.get(bare(raw) + '\uFE0F');
        return id ? `<tg-emoji emoji-id="${id}">${raw}</tg-emoji>` : raw;
      });
    })
    .join('');
}

/** Remove every premium mark so the plain version can be resent after a 400. */
export function stripPremium(data) {
  const clone = JSON.parse(JSON.stringify(data));
  const walk = (value) => {
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') {
      delete value.icon_custom_emoji_id;
      delete value.style;
      for (const key of Object.keys(value)) value[key] = walk(value[key]);
    }
    return value;
  };
  walk(clone);
  const clean = (t) => (typeof t === 'string' ? t.replace(/<tg-emoji emoji-id="\d+">([\s\S]*?)<\/tg-emoji>/g, '$1') : t);
  if (clone.text) clone.text = clean(clone.text);
  if (clone.caption) clone.caption = clean(clone.caption);
  if (clone.rich_message?.html) clone.rich_message = { ...clone.rich_message, html: clean(clone.rich_message.html) };
  return clone;
}
