// worker/emoji_engine.js
// Pure functions for Telegram premium emoji handling.

/**
 * Removes U+FE0F (Variation Selector 16) from a string.
 * @param {string} s
 * @returns {string}
 */
export function strip(s) {
  return String(s ?? '').replace(/\uFE0F/g, '');
}

/**
 * Returns variation strings for an emoji (bare, VS16, original).
 * @param {string} e
 * @returns {string[]}
 */
export function variants(e) {
  const str = String(e ?? '');
  const bare = strip(str);
  const vs16 = str.includes('\uFE0F') ? str : bare + '\uFE0F';
  return [...new Set([bare, vs16, str])];
}

/**
 * Harvests custom emoji entities from Telegram message entities.
 * Handles UTF-16 offsets and surrogate pairs correctly.
 * @param {string} text
 * @param {Array} entities
 * @returns {Array<{char: string, id: string}>}
 */
export function harvest(text, entities = []) {
  const str = String(text ?? '');
  const result = [];
  if (!Array.isArray(entities)) return result;

  for (const ent of entities) {
    if (ent && ent.type === 'custom_emoji' && ent.custom_emoji_id) {
      const offset = Number(ent.offset) || 0;
      const length = Number(ent.length) || 0;
      if (offset >= 0 && length > 0) {
        const char = str.slice(offset, offset + length);
        if (char) {
          result.push({ char, id: String(ent.custom_emoji_id) });
        }
      }
    }
  }
  return result;
}

/**
 * Builds a Map from the stored emoji packs structure used by worker/ai.js.
 * Structure: [{ name, title, emojis: [{ id, char }] }]
 * First pack wins for duplicate emoji.
 * @param {Array} packs
 * @returns {Map<string, string>}
 */
export function mergeMaps(packs = []) {
  const map = new Map();
  if (!Array.isArray(packs)) return map;

  for (const pack of packs) {
    if (!pack || !Array.isArray(pack.emojis)) continue;
    for (const item of pack.emojis) {
      if (!item || item.id == null || !item.char) continue;
      const id = String(item.id);
      const char = String(item.char);
      for (const v of variants(char)) {
        if (!map.has(v)) {
          map.set(v, id);
        }
      }
    }
  }
  return map;
}

/**
 * Helper to get custom emoji ID from map with VS16 tolerance.
 */
function getId(map, char) {
  if (!map) return null;
  const bare = strip(char);
  const vs16 = bare + '\uFE0F';
  if (map instanceof Map) {
    return map.get(char) ?? map.get(bare) ?? map.get(vs16) ?? null;
  }
  if (typeof map === 'object') {
    return map[char] ?? map[bare] ?? map[vs16] ?? null;
  }
  return null;
}

/**
 * Replaces plain emoji in HTML text nodes with <tg-emoji emoji-id="ID">char</tg-emoji>.
 * Ignores tags/attributes, <code>/<pre>, and existing <tg-emoji>.
 * Tolerant of VS16 variants; unknown emoji untouched.
 * @param {string} html
 * @param {Map|Object} map
 * @returns {string}
 */
export function premiumize(html, map) {
  if (!html) return '';
  const str = String(html);

  if (!map) return str;
  const isMapInstance = map instanceof Map;
  const size = isMapInstance ? map.size : Object.keys(map).length;
  if (size === 0) return str;

  const rawKeys = Array.from(isMapInstance ? map.keys() : Object.keys(map)).filter(Boolean);
  const variantSet = new Set();
  for (const k of rawKeys) {
    for (const v of variants(k)) {
      if (v) variantSet.add(v);
    }
  }

  const sortedVariants = Array.from(variantSet).sort((a, b) => b.length - a.length);
  if (sortedVariants.length === 0) return str;

  const patternStr = sortedVariants.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const emojiRegex = new RegExp(patternStr, 'gu');

  // Step 1: Protect <code> / <pre> blocks
  const blocks = [];
  let masked = str.replace(/<\s*(pre|code)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, (m) => {
    blocks.push(m);
    return `\u0000__EMOJI_ENGINE_BLOCK_${blocks.length - 1}__\u0000`;
  });

  // Step 2: Protect existing <tg-emoji> blocks
  masked = masked.replace(/<\s*tg-emoji\b[^>]*>[\s\S]*?<\/\s*tg-emoji\s*>/gi, (m) => {
    blocks.push(m);
    return `\u0000__EMOJI_ENGINE_BLOCK_${blocks.length - 1}__\u0000`;
  });

  // Step 3: Tokenize HTML into tags (<...>) and text nodes
  const parts = masked.split(/(<[^>]+>)/g);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part || part.startsWith('<')) {
      continue;
    }
    parts[i] = part.replace(emojiRegex, (match) => {
      const id = getId(map, match);
      if (id != null) {
        return `<tg-emoji emoji-id="${id}">${match}</tg-emoji>`;
      }
      return match;
    });
  }

  const resultStr = parts.join('');
  return resultStr.replace(/\u0000__EMOJI_ENGINE_BLOCK_(\d+)__\u0000/g, (_, idx) => blocks[Number(idx)]);
}

/**
 * Curated default seed of Telegram public emoji pack short names.
 */
export const SEED_PACKS = [
  'DuckEmoji',
  'PepeEmoji',
  'BlobEmoji',
  'CatEmoji',
  'DogEmoji',
  'MemesEmoji',
  'PixelEmoji',
  'CuteEmoji',
  'AnimatedEmojis',
  'TelegramEmoji'
];
