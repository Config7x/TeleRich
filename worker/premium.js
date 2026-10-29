// Premium-emoji helpers: buttons carry icon_custom_emoji_id and text carries
// <tg-emoji>. Both need a Premium-owned bot, so every mark has a plain fallback:
// Telegram answers 400 without Premium and the caller strips and resends.
export const EMOJI_IDS = {
  '✨': '5339209399120465044', '🎨': '5337079048097002546', '🧩': '4981190958369474742',
  '📖': '5422439311196834318', '🖼': '4981420507191575973', '🚀': '4981420507191575973',
  '🎁': '5307891786088227313', '🌐': '5339209399120465044', 'ℹ️': '5422439311196834318',
  '📈': '4981474026779051847', '🔘': '5337079048097002546', '👋': '5339209399120465044',
  '📣': '4981420507191575973', '🛰': '4981474026779051847', '📚': '5422439311196834318',
  '🆕': '4981420507191575973', '🏠': '5339209399120465044', '💎': '5307891786088227313',
};
export const premiumOff = (env) => env.PREMIUM_EMOJI === '0';
export function iconFor(text) {
  const hit = Object.keys(EMOJI_IDS).find((e) => text && text.startsWith(e));
  return hit ? EMOJI_IDS[hit] : null;
}
export function premiumMarkup(markup) {
  if (!markup || !markup.inline_keyboard) return markup;
  return { ...markup, inline_keyboard: markup.inline_keyboard.map((row) => row.map((b) => {
    const id = b.icon_custom_emoji_id ? null : iconFor(b.text);
    return id ? { ...b, icon_custom_emoji_id: id } : b;
  })) };
}
export function premiumText(text) {
  if (typeof text !== 'string') return text;
  // Never touch code/pre or already-premium spans.
  const parts = text.split(/(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<tg-emoji[\s\S]*?<\/tg-emoji>)/g);
  return parts.map((chunk, i) => {
    if (i % 2 === 1) return chunk;
    let out = chunk;
    for (const [emo, id] of Object.entries(EMOJI_IDS)) {
      out = out.split(emo).join(`<tg-emoji emoji-id="${id}">${emo}</tg-emoji>`);
    }
    return out;
  }).join('');
}
export function stripPremium(data) {
  const clone = JSON.parse(JSON.stringify(data));
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') {
      delete v.icon_custom_emoji_id;
      for (const k of Object.keys(v)) v[k] = walk(v[k]);
    }
    return v;
  };
  walk(clone);
  const clean = (t) => typeof t === 'string' ? t.replace(/<tg-emoji emoji-id="\d+">([\s\S]*?)<\/tg-emoji>/g, '$1') : t;
  if (clone.text) clone.text = clean(clone.text);
  if (clone.caption) clone.caption = clean(clone.caption);
  return clone;
}
