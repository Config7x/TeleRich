// One place that decides what every bot button looks like: a colour and a
// leading emoji. The emoji is what the premium layer turns into a real icon, so
// the set below is deliberately drawn from ONE icon pack (line icons, "Old
// Icons" by SOUICdsgn) — mixed packs looked like a sticker dump.
//
// Palette (agreed with Milad): green = create / pay / get, red = destructive,
// blue only for the one primary action of a board, everything else neutral.
// A wall of blue buttons reads as "no emphasis at all", so colour is a scarce
// resource here: at most one coloured button per row.

const ICON = /[\p{Extended_Pictographic}\u2B05\u2B06\u2B07\u27A1\u2B95]/u;

/** Buttons that are only a glyph (arrows, page counters) never get a second icon. */
function hasIcon(text) {
  const bare = String(text || '').replace(/\s+/g, '');
  return ICON.test(bare);
}

const PREFIX = [
  ['home:', [null, '🏠']],
  ['settings:', [null, '⚙']],
  ['guide:', [null, '🎓']],
  ['templates:', ['success', '🗂']],
  ['tpl:', ['success', '🗂']],
  ['demo:', [null, '▶️']],
  ['render:', [null, '📝']],
  ['updates:', [null, '🔔']],
  ['about:', [null, 'ℹ️']],
  ['quota:', ['success', '🎁']],
  ['joinadd:', ['success', '📌']],
  ['joinrm:', ['danger', '🗑']],
  ['join:', [null, '📌']],
  ['destuse:', ['success', '✅️']],
  ['destclear:', ['danger', '🗑']],
  ['dest:', [null, '🌐']],
  ['list:', [null, '📄']],
  ['users:', [null, '👥']],
  ['admp:', [null, '📄']],
  ['admx:', [null, '🔣']],
  ['adm:', [null, '🛡']],
  ['aiset:', [null, '🤖']],
  ['bcstgo:', ['success', '📤']],
  ['bcstno:', ['danger', '🚫']],
];

/** The admin-quota panel keeps a different colour per action. */
const ADMIN_ACTION = {
  plus: ['success', '➕'],
  minus: ['danger', '➖'],
  custom: [null, '🔣'],
  unl: [null, '♾'],
  limited: [null, '♾'],
  reset: ['danger', '🔄'],
  block: ['danger', '🚫'],
};

const WORDS = [
  [/(تخفیف|پیشنهاد|offer|discount|sale)/i, ['success', '🎉']],
  [/(ارسال|انتشار|send|publish)/i, ['success', '📤']],
  [/(ذخیره|save|تأیید|تایید|confirm|ok)/i, ['success', '✅️']],
  [/(خرید|پرداخت|buy|pay|checkout)/i, ['success', '💳']],
  [/(حذف|پاک|delete|remove|clear)/i, ['danger', '🗑']],
  [/(لغو|cancel|توقف|stop|خروج)/i, ['danger', '🚫']],
  [/(بازگشت|back|قبلی|prev)/i, ['primary', '◀️']],
  [/(بعدی|next)/i, ['primary', '⏩']],
  [/(راهنما|آموزش|guide|help|docs)/i, ['primary', '🎓']],
  [/(تنظیمات|settings|config)/i, ['primary', '⚙']],
  [/(کانال|channel|مقصد|dest)/i, ['primary', '🌐']],
  [/(پشتیبانی|support|contact)/i, ['primary', '📞']],
  [/(آمار|گزارش|stats|report)/i, ['primary', '📊']],
  [/(امن|security|shield)/i, ['primary', '🛡']],
  [/(تست|دمو|demo|test|نمونه)/i, ['primary', '▶️']],
  [/(ایده|idea)/i, ['primary', '💡']],
  [/(ایموجی|emoji)/i, ['primary', '🎭']],
  [/(سهمیه|quota|گیفت|gift)/i, ['success', '🎁']],
  [/(قالب|template)/i, ['success', '🗂']],
  [/(لینک|link)/i, ['primary', '🔗']],
  [/(مدیا|عکس|media|image|photo)/i, ['primary', '🖼']],
  [/(کد|code)/i, ['primary', '💻']],
  [/(جست|search|find)/i, ['primary', '🔍']],
  [/(کاربر|members|users)/i, ['primary', '👥']],
  [/(قفل|lock)/i, ['primary', '🔒']],
  [/(زبان|english|فارسی|language)/i, ['primary', '🌐']],
];

function judge(button) {
  const cb = String(button.callback_data || '');
  if (cb.startsWith('admx:')) {
    const action = cb.split(':')[3] || '';
    const hit = ADMIN_ACTION[action];
    if (hit) return hit;
  }
  for (const [prefix, look] of PREFIX) if (cb.startsWith(prefix)) return look;
  if (button.web_app) return ['primary', '🎨'];
  const text = String(button.text || '');
  for (const [re, look] of WORDS) if (re.test(text)) return look;
  if (button.url) return [null, '🔗'];
  return [null, '💬'];
}

const OURS = new WeakSet(); // buttons this module coloured, so demotion spares the author's own

function dress(button, {styled = true} = {}) {
  if (!button || typeof button !== 'object') return button;
  const out = { ...button };
  const [style, emoji] = judge(out);
  if (styled && !out.style && style) { out.style = style; OURS.add(out); }
  if (typeof out.text === 'string' && out.text.trim() && !hasIcon(out.text) && !out.icon_custom_emoji_id) {
    out.text = `${emoji} ${out.text}`;
  }
  return out;
}

const RANK = { danger: 3, success: 2, primary: 1 };

/** One colour per row: the strongest wins, the rest go neutral. */
function balance(row) {
  const coloured = row.filter((b) => b && b.style && OURS.has(b));
  if (coloured.length < 2) return row;
  coloured.sort((a, b) => (RANK[b.style] || 0) - (RANK[a.style] || 0));
  for (const extra of coloured.slice(1)) delete extra.style;
  return row;
}

/** Colour every inline button and give it an icon. Reply keyboards only get icons. */
export function decorateMarkup(markup) {
  if (!markup || typeof markup !== 'object') return markup;
  const out = { ...markup };
  if (Array.isArray(markup.inline_keyboard)) {
    out.inline_keyboard = markup.inline_keyboard.map((row) => (Array.isArray(row) ? balance(row.map((b) => dress(b, { styled: true }))) : row));
  }
  if (Array.isArray(markup.keyboard)) {
    out.keyboard = markup.keyboard.map((row) => (Array.isArray(row) ? row.map((b) => dress(b, { styled: false })) : row));
  }
  return out;
}

export const buttonLook = judge;
