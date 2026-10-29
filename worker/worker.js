// Tele Rich 7x Studio — Telegram Bot API 10.3 (private deployment)
// Secrets: BOT_TOKEN, ADMIN_KEY, WEBHOOK_SECRET. Optional: ADMINS_ID="123,456".
import html, { guides, releases } from './index.js';
import telegramWebAppJs from './tg-web-app-content.js';

const encoder = new TextEncoder();
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const admins = env => String(env.ADMINS_ID || '').split(/[\s,]+/).filter(Boolean);
const allowed = (env, id) => !admins(env).length || admins(env).includes(String(id));
const result = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
async function equal(a, b) {
  const hash = async s => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(s)));
  const [aa, bb] = await Promise.all([hash(a), hash(b)]);
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}
async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', typeof key === 'string' ? encoder.encode(key) : key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, encoder.encode(data));
}
const safeText = v => String(v ?? '')
  .replace(/[\ud800-\udbff](?![\udc00-\udfff])/g, '\u2573')
  .replace(/(?<![\ud800-\udbff])[\udc00-\udfff]/g, '\u2573')
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

import { premiumOff, premiumMap, premiumMarkup, premiumText, stripPremium, markPremiumDead, resetPremiumCache } from './premium.js';
import { decorateMarkup } from './board.js';
import { premiumize as emojiPremiumize, mergeMaps as emojiMergeMaps, SEED_PACKS } from './emoji_engine.js';
import { PROVIDERS, aiConfig, aiSave, aiGenerate, aiTest, emojiPacks, emojiAddPack, emojiRemovePack } from './ai.js';

async function telegram(env, method, data = {}) {
  if (!env.BOT_TOKEN) throw fail('BOT_TOKEN is not configured on the Worker.', 503);
  const send = payload => fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  let outbound = data;
  if (outbound.reply_markup) outbound.reply_markup = decorateMarkup(outbound.reply_markup);
  const emojiMap = premiumOff(env) ? null : await premiumMap(env);
  if (emojiMap) {
    if (outbound.reply_markup) outbound.reply_markup = premiumMarkup(outbound.reply_markup, emojiMap);
    if (outbound.text) outbound.text = premiumText(outbound.text, emojiMap);
    if (outbound.caption) outbound.caption = premiumText(outbound.caption, emojiMap);
    if (outbound.rich_message?.html) outbound.rich_message = { ...outbound.rich_message, html: premiumText(outbound.rich_message.html, emojiMap) };
  }
  let response = await send(outbound);
  let body = await response.json();
  // Premium emoji are rejected on accounts without Premium: fall back to plain once.
  if (!body.ok && /emoji|CUSTOM_EMOJI|BUTTON_/i.test(body.description || '') && !premiumOff(env)) {
    console.error('PREMIUM-FALLBACK', method, body.description);
    markPremiumDead();
    outbound = stripPremium(outbound);
    response = await send(outbound);
    body = await response.json();
  }
  // Telegram rejects lone-surrogate text with a UTF-8 error; log the culprit and retry sanitized.
  if (!body.ok && /encoded in UTF-8/.test(body.description || '') && data.reply_markup) {
    console.error('UTF8-DUMP', method, JSON.stringify(data.reply_markup));
    const fix = JSON.parse(JSON.stringify(data), (k, v) => ((k === 'text' || k === 'callback_data') && typeof v === 'string') ? safeText(v) : v);
    response = await send(fix);
    body = await response.json();
  }
  if (!body.ok) throw fail(body.description || 'Telegram request failed.', body.error_code >= 500 ? 502 : 400);
  return body.result;
}
async function authenticate(request, env) {
  const token = request.headers.get('Authorization') || '';
  if (env.ADMIN_KEY && token.startsWith('Bearer ') && await equal(token.slice(7), env.ADMIN_KEY)) return { operator: true };
  const raw = request.headers.get('X-Telegram-Init-Data');
  if (!raw) throw fail('Open this app from your Telegram bot, or connect using ADMIN_KEY.', 401);
  const params = new URLSearchParams(raw);
  const signature = params.get('hash') || '';
  params.delete('hash');
  params.sort();
  const check = [...params.entries()].map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = await hmac('WebAppData', env.BOT_TOKEN);
  const computed = [...new Uint8Array(await hmac(secret, check))].map(v => v.toString(16).padStart(2, '0')).join('');
  if (!await equal(computed, signature)) throw fail('Invalid Telegram session signature.', 401);
  const age = Date.now() / 1000 - Number(params.get('auth_date'));
  if (!Number.isFinite(age) || age < -30 || age > 86400) throw fail('Your Telegram session expired. Reopen the Mini App.', 401);
  const user = JSON.parse(params.get('user') || '{}');
  if (!Number.isSafeInteger(user.id)) throw fail('No Telegram user in session.', 401);
  if (!allowed(env, user.id)) throw fail('This bot is restricted to its configured administrators.', 403);
  return { operator: false, user };
}
const destKey = (uid) => 'dest:' + uid;
async function readDest(env, uid) { try { return (await env.RICHKV.get(destKey(uid), 'json')) || null; } catch (e) { return null; } }
async function writeDest(env, uid, rec) {
  if (rec) await env.RICHKV.put(destKey(uid), JSON.stringify(rec));
  else await env.RICHKV.delete(destKey(uid));
  return rec;
}
const destLabel = (d) => (d ? `${d.title || d.id} · ${d.type === 'private' ? 'DM' : d.type}` : '—');

async function authorizeChat(env, identity, chatId) {
  if (!chatId) throw fail('A chat ID is required. Send /start to your bot first.');
  const chat = await telegram(env, 'getChat', { chat_id: chatId });
  if (identity.operator) {
    if (chat.type === 'channel' || chat.type === 'supergroup' || chat.type === 'group') {
      const me = await telegram(env, 'getMe');
      const member = await telegram(env, 'getChatMember', { chat_id: chat.id, user_id: me.id });
      if (!['administrator', 'creator'].includes(member.status)) throw fail('Add the bot as a chat administrator before publishing.', 403);
      if (chat.type === 'channel' && member.status !== 'creator' && !member.can_post_messages) throw fail('The bot needs Post messages permission.', 403);
    }
    return chat;
  }
  if (chat.type === 'private') {
    if (String(chat.id) !== String(identity.user.id)) throw fail('You may only send to your own private chat.', 403);
    return chat;
  }
  const me = await telegram(env, 'getMe');
  const [user, bot] = await Promise.all([
    telegram(env, 'getChatMember', { chat_id: chat.id, user_id: identity.user.id }),
    telegram(env, 'getChatMember', { chat_id: chat.id, user_id: me.id })
  ]);
  if (!['administrator', 'creator'].includes(user.status)) throw fail('You must be an administrator of the destination.', 403);
  if (!['administrator', 'creator'].includes(bot.status)) throw fail('The bot must be an administrator of the destination.', 403);
  if (chat.type === 'channel' && bot.status !== 'creator' && !bot.can_post_messages) throw fail('The bot needs Post messages permission.', 403);
  return chat;
}
const FOOTER_HTML = '🎒 این پیام با <a href="https://t.me/Rich7xbot">TeleRich</a> ساخته شده';
const FOOTER_MD = '🎒 این پیام با [TeleRich](https://t.me/Rich7xbot) ساخته شده';
const withFooter = rich => {
  if (!rich || typeof rich !== 'object') return rich;
  if (rich.html !== undefined) return String(rich.html).includes('Rich7xbot') ? rich : { ...rich, html: rich.html + '\n\n' + FOOTER_HTML };
  if (rich.markdown !== undefined) return String(rich.markdown).includes('Rich7xbot') ? rich : { ...rich, markdown: rich.markdown + '\n\n' + FOOTER_MD };
  return rich;
};
function validateRich(rich) {
  if (!rich || typeof rich !== 'object') throw fail('rich_message is required.');
  const keys = ['html', 'markdown', 'blocks'].filter(k => rich[k] !== undefined);
  if (keys.length !== 1) throw fail('Use exactly one of html, markdown or blocks.');
  if (keys[0] !== 'blocks' && (typeof rich[keys[0]] !== 'string' || !rich[keys[0]].trim() || rich[keys[0]].length > 32768)) throw fail('Message must contain 1–32,768 characters.');
  if (keys[0] === 'blocks' && !Array.isArray(rich.blocks)) throw fail('blocks must be an array.');
  return rich;
}
const copyFields = (source, names) => Object.fromEntries(names.filter(k => source[k] !== undefined).map(k => [k, source[k]]));

async function webApi(request, env, url) {
  if (url.pathname === '/api/meta' && request.method === 'GET') {
    return { ok: true, providers: Object.entries(PROVIDERS).map(([id, p]) => ({ id, label: p.label, model: p.model, keyUrl: p.keyUrl })) };
  }
  if (request.method !== 'POST') throw fail('POST required.', 405);
  if (Number(request.headers.get('content-length') || 0) > 524288) throw fail('Request too large.', 413);
  const identity = await authenticate(request, env);
  const raw = await request.text();
  if (raw.length > 524288) throw fail('Request too large.', 413);
  let data;
  try { data = JSON.parse(raw || '{}'); } catch { throw fail('Invalid JSON.'); }
  const action = url.pathname.slice(5);
  if (action === 'connect') return telegram(env, 'getMe');
  if (action === 'ai') {
    const uid = identity.user.id;
    const op = data.op || 'config';
    if (op === 'config') return aiConfig(env, uid);
    if (op === 'save') return aiSave(env, uid, data);
    if (op === 'test') return aiTest(env, uid);
    if (op === 'generate') return aiGenerate(env, uid, data);
    throw fail('Unknown AI action.', 404);
  }
  if (action === 'emoji') {
    const uid = identity.user.id;
    const op = data.op || 'list';
    if (op === 'list') return { ...(await emojiPacks(env, uid)), seed: SEED_PACKS };
    if (op === 'seed') return { seed: SEED_PACKS };
    if (op === 'preview') {
      const packs = (await env.RICHKV.get('emo:' + uid, 'json')) || [];
      return { html: emojiPremiumize(String(data.html || ''), emojiMergeMaps(packs)) };
    }
    if (op === 'add') return emojiAddPack(env, uid, data, telegram);
    if (op === 'remove') return emojiRemovePack(env, uid, data);
    throw fail('Unknown emoji action.', 404);
  }
  if (action === 'webhook') {
    if (!identity.operator) throw fail('Only the operator may change the webhook.', 403);
    if (!env.WEBHOOK_SECRET) throw fail('Set WEBHOOK_SECRET first.');
    const webhook = await telegram(env, 'setWebhook', { url: `${url.origin.split('?')[0]}/webhook`, secret_token: env.WEBHOOK_SECRET, allowed_updates: ['message', 'callback_query', 'my_chat_member', 'stopped_message_generation'] });
    const commands = await telegram(env, 'setMyCommands', { commands: [
      { command: 'start', description: 'Open TeleRich · باز کردن تله‌ریچ' },
      { command: 'guide', description: 'Rich text guide · راهنمای متن ریچ' },
      { command: 'html', description: 'Blocks & layout guide · راهنمای بلوک‌ها' },
      { command: 'media', description: 'Media guide · راهنمای مدیا' },
      { command: 'buttons', description: 'Rich buttons example · نمونه دکمه ریچ' },
      { command: 'table', description: 'Table example · نمونه جدول' },
      { command: 'demo', description: 'Full feature demo · دموی کامل' },
      { command: 'updates', description: 'Bot API 10.3 changes · تازه‌های نسخه' },
      { command: 'webapp', description: 'Open the studio · باز کردن استودیو' },
      { command: 'post', description: 'Channel studio · پست‌ساز کانال' },
      { command: 'ref', description: 'سهمیه و دعوت دوستان · your quota & invite link' },
      { command: 'stats', description: 'Bot report (owner) · گزارش ربات' },
      { command: 'admin', description: 'Manage users (owner) · مدیریت کاربران' },
      { command: 'whoami', description: 'Your numeric ID · شناسه عددی شما' },
      { command: 'about', description: 'Credits · درباره' },
    ] });
    return { webhook, commands };
  }
  if (!['send', 'edit', 'delete', 'channel', 'dest', 'draft', 'editEphemeralMessageText', 'editEphemeralMessageCaption', 'editEphemeralMessageReplyMarkup', 'deleteEphemeralMessage'].includes(action)) throw fail('Unknown API route.', 404);
  const chatId = data.chat_id || identity.user?.id;
  const chat = await authorizeChat(env, identity, chatId);
  if (action === 'channel') return { id: chat.id, title: chat.title, type: chat.type };
  if (action === 'dest') {
    const uid = identity.user?.id;
    if (!uid) throw fail('Open the studio from the bot to manage the destination.', 403);
    const op = data.op || 'get';
    if (op === 'clear') return { dest: await writeDest(env, uid, null) };
    if (op === 'set') {
      const target = await authorizeChat(env, identity, data.chat_id);
      const rec = { id: target.id, title: target.title || target.username || String(target.id), type: target.type, username: target.username || '' };
      await writeDest(env, uid, rec);
      return { dest: rec };
    }
    return { dest: await readDest(env, uid) };
  }
  if (action === 'send') {
    const uid = identity.user?.id;
    const chargeable = chat.type !== 'private'; // renders to your own bot chat are free
    if (uid && !identity.operator && chargeable) {
      const q = await quotaStatus(env, uid);
      if (!q.ok) {
        const me = await telegram(env, 'getMe');
        throw fail(q.blocked
          ? '⛔ دسترسی شما به ساخت پیام توسط مدیر ربات محدود شده است.'
          : `سهمیه‌ی ساخت پیام رایگان تمام شد (${q.used}/${q.limit}). با دعوت دوستان سهمیه بگیر؛ هر زیرمجموعه‌ی تأییدشده +${refBonus(env)} پیام:\nhttps://t.me/${me.username}?start=ref_${uid}`, 402);
      }
    }
    const fields = copyFields(data, ['disable_notification', 'protect_content', 'ephemeral_message_parameters', 'reply_markup', 'reply_parameters', 'message_thread_id']);
    if (fields.ephemeral_message_parameters && chat.type === 'channel') throw fail('Ephemeral messages are not supported in channels. Use a group.');
    const sent = await telegram(env, 'sendRichMessage', { ...fields, chat_id: chat.id, rich_message: withFooter(validateRich(data.rich_message)) });
    if (uid && !identity.operator && chargeable) await addUsed(env, uid);
    await bumpStats(env, { sends: 1, channel: chat.type === 'channel' ? 1 : 0 });
    return sent;
  }
  if (action === 'draft') return telegram(env, 'sendRichMessageDraft', { ...copyFields(data, ['draft_id', 'can_stop', 'keep_on_stop', 'message_thread_id']), chat_id: chat.id, rich_message: withFooter(validateRich(data.rich_message)) });
  if (action === 'edit') {
    if (!Number.isSafeInteger(data.message_id)) throw fail('A valid message_id is required.');
    return telegram(env, 'editMessageText', { chat_id: chat.id, message_id: data.message_id, rich_message: withFooter(validateRich(data.rich_message)), ...copyFields(data, ['reply_markup']) });
  }
  if (action === 'delete') {
    if (!Number.isSafeInteger(data.message_id)) throw fail('A valid message_id is required.');
    return telegram(env, 'deleteMessage', { chat_id: chat.id, message_id: data.message_id });
  }
  const fields = copyFields(data, ['receiver_user_id', 'ephemeral_message_id', 'rich_message', 'text', 'parse_mode', 'caption', 'caption_entities', 'show_caption_above_media', 'reply_markup']);
  if (!Number.isSafeInteger(fields.receiver_user_id) || !Number.isSafeInteger(fields.ephemeral_message_id)) throw fail('receiver_user_id and ephemeral_message_id are required.');
  if (!identity.operator && fields.receiver_user_id !== identity.user.id) throw fail('Cannot modify another user’s ephemeral messages.', 403);
  if (fields.rich_message) validateRich(fields.rich_message);
  return telegram(env, action, { ...fields, chat_id: chat.id });
}

function menu(lang, origin) {
  const fa = lang === 'fa';
  return { inline_keyboard: [
    [{ text: fa ? '✨ باز کردن استودیو' : '✨ Open the studio', web_app: { url: origin }, style: 'primary' }],
    [{ text: fa ? '🎨 قالب‌ها' : '🎨 Templates', callback_data: `templates:${lang}` }, { text: fa ? '🚀 دمو' : '🚀 Demo', callback_data: `demo:${lang}:0` }],
    [{ text: fa ? '🧩 بلوک‌ها' : '🧩 Blocks', callback_data: `list:${lang}:Blocks:0` }, { text: fa ? '📖 متن ریچ' : '📖 Rich text', callback_data: `list:${lang}:Rich text:0` }],
    [{ text: fa ? '🖼 مدیا' : '🖼 Media', callback_data: `list:${lang}:Media:0` }, { text: fa ? '🎯 مقصد ارسال' : '🎯 Destination', callback_data: `dest:${lang}` }],
    [{ text: fa ? '🎁 سهمیه' : '🎁 Quota', callback_data: `quota:${lang}` }, { text: fa ? 'ℹ️ درباره' : 'ℹ️ About', callback_data: `about:${lang}` }],
    [{ text: fa ? '🌐 English' : '🌐 فارسی', callback_data: `home:${fa ? 'en' : 'fa'}` }]
  ] };
}

// Persistent bottom keyboard: the four things people actually do, one tap away.
function replyBoard(lang, origin) {
  const fa = lang === 'fa';
  return { keyboard: [
    [{ text: fa ? '✨ ساخت پست' : '✨ Create a post', web_app: { url: origin } }, { text: fa ? '🎨 قالب‌ها' : '🎨 Templates' }],
    [{ text: fa ? '🎁 سهمیه' : '🎁 Quota' }, { text: fa ? '📚 راهنما' : '📚 Guides' }],
  ], resize_keyboard: true, is_persistent: true, input_field_placeholder: fa ? 'یک گزینه را بزن…' : 'Tap an option…' };
}

const foot = (lang, origin, extra) => {
  const fa = lang === 'fa';
  const row = [{ text: fa ? '🏠 منو' : '🏠 Menu', callback_data: `home:${lang}` }];
  extra && extra.length && row.push(...extra);
  return { inline_keyboard: [row, [{ text: fa ? '✨ باز کردن استودیو' : '✨ Open studio', web_app: { url: origin }, style: 'primary' }]] };
};

const TEMPLATES = [
  { id: 'config', fa: 'پست کانفیگ', en: 'Config post', icon: '🛰', desc: 'بلوک کد کپی‌شو + دکمه‌های کپی و کانال' },
  { id: 'levels', fa: 'پست چندحالته', en: 'Multi-level post', icon: '📚', desc: 'خلاصه، جزئیات بازشو و سؤال‌های متداول' },
  { id: 'slides', fa: 'اسلایدشو', en: 'Slideshow', icon: '🎞', desc: 'چند عکس پشت‌سرهم با دکمه' },
  { id: 'livepoll', fa: 'نظرسنجی زنده', en: 'Live poll', icon: '📊', desc: 'نظرسنجی با تصویر و دکمه اشتراک' },
  { id: 'notice', fa: 'اطلاعیه', en: 'Announcement', icon: '📣', desc: 'تیتر، متن و دکمهٔ لینک' },
  { id: 'guide', fa: 'آموزش گام‌به‌گام', en: 'Step-by-step guide', icon: '🧭', desc: 'مراحل شماره‌دار و بخش بازشو' },
  { id: 'offer', fa: 'پیشنهاد فروش', en: 'Sales offer', icon: '🛍', desc: 'قیمت، مزیت‌ها و دکمه خرید' },
  { id: 'account', fa: 'معرفی پروفایل', en: 'Account profile', icon: '👤', desc: 'کارت پروفایل با کپی یوزر و پسورد' },
  { id: 'welcome', fa: 'خوش‌آمد کانال', en: 'Channel welcome', icon: '👋', desc: 'تیتر، مزیت‌ها و دکمهٔ شروع' },
  { id: 'report', fa: 'گزارش با جدول', en: 'Report with table', icon: '📈', desc: 'کارت آمار، جدول و نمودار' },
  { id: 'buttonset', fa: 'همهٔ دکمه‌ها', en: 'Every button', icon: '🔘', desc: 'سه نوع اکشن با سه رنگ' },
  { id: 'mediapost', fa: 'پست مدیا', en: 'Media post', icon: '🖼', desc: 'اسلایدشو، کپشن و دکمه' },
  { id: 'scratch', fa: 'از صفر', en: 'From scratch', icon: '📝', desc: 'بوم خالی برای شروع آزاد' },
];

async function templatesPanel(env, chatId, lang, origin, messageId) {
  const fa = lang === 'fa';
  const text = `<b>${fa ? '🎨 قالب‌های آماده' : '🎨 Ready templates'}</b>\n\n` +
    (fa ? 'یکی را انتخاب کن؛ داخل استودیو باز می‌شود، آمادهٔ ویرایش و ارسال. هیچ کدی لازم نیست.' : 'Pick one: it opens in the studio, ready to edit and send. No code needed.') +
    '\n\n' + TEMPLATES.map((t) => `${t.icon} <b>${fa ? t.fa : t.en}</b> — ${t.desc}`).join('\n');
  const rows = [];
  for (let i = 0; i < TEMPLATES.length; i += 2) {
    rows.push(TEMPLATES.slice(i, i + 2).map((t) => ({ text: `${t.icon} ${fa ? t.fa : t.en}`, callback_data: `tpl:${lang}:${t.id}` })));
  }
  rows.push([{ text: fa ? '✨ باز کردن استودیو' : '✨ Open studio', web_app: { url: origin }, style: 'primary' }]);
  rows.push([{ text: fa ? '🏠 منو' : '🏠 Menu', callback_data: `home:${lang}` }]);
  return plain(env, chatId, text, { inline_keyboard: rows }, messageId);
}




async function settingsPanel(env, chatId, lang, origin, messageId) {
  const fa = lang === 'fa';
  const d = await readDest(env, chatId);
  const jl = await joinList(env);
  const text = `<b>${fa ? '⚙️ تنظیمات ربات' : '⚙️ Bot settings'}</b>\n\n` +
    `${fa ? '🎯 مقصد ارسال' : '🎯 Destination'}: <b>${d ? destLabel(d) : (fa ? 'انتخاب نشده' : 'not set')}</b>\n` +
    `${fa ? '🔒 عضویت اجباری' : '🔒 Forced join'}: <b>${jl.length ? jl.map((t) => t.title || t.id).join(' + ') : (fa ? 'خاموش' : 'off')}</b>`;
  return plain(env, chatId, text, { inline_keyboard: [
    [{ text: fa ? '✨ باز کردن استودیو' : '✨ Open the studio', web_app: { url: origin }, style: 'primary' }],
    [{ text: fa ? '🎯 مقصد ارسال' : '🎯 Destination', callback_data: `dest:${lang}` }, { text: fa ? '🔒 عضویت اجباری' : '🔒 Forced join', callback_data: `join:${lang}` }],
    [{ text: fa ? '🤖 هوش مصنوعی' : '🤖 AI', callback_data: `aiset:${lang}` }, { text: fa ? '👥 کاربران' : '👥 Users', callback_data: `users:${lang}` }],
    [{ text: fa ? '🏠 منو' : '🏠 Menu', callback_data: `home:${lang}` }]
  ] }, messageId);
}
async function aiPanel(env, chatId, lang, origin, messageId) {
  const fa = lang === 'fa';
  const cfg = await aiConfig(env, String(chatId));
  const rows = cfg.providers.map((p) => `• <code>${p.id}</code> — ${p.label} (${p.model})`).join('\n');
  const text = `<b>${fa ? '🤖 هوش مصنوعی' : '🤖 AI'}</b>\n\n` +
    `${fa ? 'سرویس' : 'Service'}: <code>${cfg.provider}</code>\n${fa ? 'مدل' : 'Model'}: <code>${cfg.model}</code>\n` +
    `${fa ? 'کلید' : 'Key'}: ${cfg.hasKey ? '✅' : '⛔'}\n\n${rows}\n\n` +
    (fa ? 'ثبت کلید:\n<code>/key gemini AIza...</code>\nآزمایش: <code>/aitest</code>\nتغییر مدل: <code>/model gemini-2.5-flash</code>'
        : 'Save a key:\n<code>/key gemini AIza...</code>\nTest: <code>/aitest</code>\nModel: <code>/model gemini-2.5-flash</code>');
  return plain(env, chatId, text, { inline_keyboard: [[{ text: fa ? '✨ باز کردن استودیو' : '✨ Open the studio', web_app: { url: origin }, style: 'primary' }], [{ text: fa ? '⚙️ تنظیمات' : '⚙️ Settings', callback_data: `settings:${lang}` }, { text: fa ? '🏠 منو' : '🏠 Menu', callback_data: `home:${lang}` }]] }, messageId);
}


async function joinPanel(env, chatId, lang, origin, messageId) {
  const fa = lang === 'fa';
  const list = await joinList(env);
  const me = await telegram(env, 'getMe');
  const checked = [];
  for (const t of list) {
    let reachable = true;
    try { const m = await telegram(env, 'getChatMember', { chat_id: t.id, user_id: me.id }); reachable = !['left', 'kicked'].includes(m.status); }
    catch (e) { reachable = false; }
    checked.push({ ...t, reachable });
  }
  const text = `<b>${fa ? '🔒 عضویت اجباری' : '🔒 Forced join'}</b>\n\n` +
    (fa ? 'کاربر تا وقتی در همهٔ این‌ها عضو نشود نمی‌تواند از ربات استفاده کند.' : 'Users must join all of these before the bot works.') +
    '\n\n' + (checked.length ? checked.map((t) => `• ${t.type === 'group' || t.type === 'supergroup' ? '👥' : '📡'} <b>${t.title || t.id}</b> · <code>${t.id}</code>${t.reachable ? '' : (fa ? ' ⚠️ ربات عضو نیست' : ' ⚠️ bot not a member')}`).join('\n') : (fa ? '<i>هیچ مقصدی تنظیم نشده</i>' : '<i>none set</i>')) +
    `\n\n${fa ? 'افزودن:' : 'Add:'}\n` +
    (fa ? '• یک پیام از گروه یا کانال را به ربات <b>فوروارد</b> کن و دکمهٔ «جوین اجباری» را بزن.\n• یا بنویس <code>/join @username</code> یا <code>/join -100…</code>' : '• <b>Forward</b> a message from it and tap “Forced join”.\n• Or send <code>/join @username</code>') +
    `\n\n${fa ? 'ربات باید در گروه عضو باشد (مدیر بودن لازم نیست).' : 'The bot must be a member of the group.'}`;
  const rows = [];
  list.forEach((t, i) => rows.push([{ text: `${fa ? '🗑 حذف' : '🗑 Remove'} ${t.title || t.id}`, callback_data: `joinrm:${lang}:${i}`, style: 'danger' }]));
  rows.push([{ text: fa ? '✨ باز کردن استودیو' : '✨ Open the studio', web_app: { url: origin }, style: 'primary' }]);
  rows.push([{ text: fa ? '🏠 منو' : '🏠 Menu', callback_data: `home:${lang}` }]);
  return plain(env, chatId, text, { inline_keyboard: rows }, messageId);
}

async function destPanel(env, chatId, lang, origin, messageId) {
  const fa = lang === 'fa';
  const uid = chatId;
  const d = await readDest(env, uid);
  const text = `<b>${fa ? '🎯 مقصد ارسال' : '🎯 Delivery destination'}</b>\n\n` +
    (fa ? 'پستی که می‌سازی به این مقصد می‌رود. می‌تواند کانال باشد یا گروه.' : 'Posts you build go here. It can be a channel or a group.') +
    `\n\n${fa ? 'مقصد فعلی' : 'Current'}: <b>${d ? destLabel(d) : (fa ? 'انتخاب نشده — هر بار می‌پرسد' : 'not set — asked every time')}</b>` +
    (d ? `\n<code>${d.id}</code>` : '') +
    `\n\n${fa ? 'چطور تنظیم کنم؟' : 'How to set it?'}\n` +
    (fa ? '• یک پیام از گروه یا کانال به همین ربات <b>فوروارد</b> کن — خودش تشخیص می‌دهد.\n• یا بنویس <code>/dest @username</code> یا <code>/dest -100…</code>' : '• <b>Forward</b> any message from the group or channel here and I pick it up.\n• Or send <code>/dest @username</code> / <code>/dest -100…</code>') +
    `\n\n${fa ? 'ربات باید در گروه عضو و مدیر باشد (مجوز ارسال پیام).' : 'The bot must be an admin in that chat with Post messages permission.'}`;
  const rows = [];
  rows.push([{ text: fa ? '✨ باز کردن استودیو' : '✨ Open the studio', web_app: { url: origin }, style: 'primary' }]);
  rows.push([{ text: fa ? '🏠 منو' : '🏠 Menu', callback_data: `home:${lang}` }]);
  if (d) rows.push([{ text: fa ? '🗑 پاک کردن مقصد' : '🗑 Clear destination', callback_data: `destclear:${lang}`, style: 'danger' }]);
  return plain(env, chatId, text, { inline_keyboard: rows }, messageId);
}

async function aboutPanel(env, chatId, lang, origin, messageId) {
  const fa = lang === 'fa';
  const text = `<b>TeleRich 7x</b>\n\n${fa ? 'استودیوی ساخت پست ریچ تلگرام — روی Cloudflare Workers.\n\n' : 'Telegram rich post studio — on Cloudflare Workers.\n\n'}` +
    '<a href="https://t.me/Rich7xbot">@Rich7xbot</a> · <a href="https://t.me/Config7x">@Config7x</a>' +
    (fa ? '\n\nدستورها: /start /post /ref /about /whoami' : '\n\nCommands: /start /post /ref /about /whoami');
  return plain(env, chatId, text, { inline_keyboard: [
    [{ text: fa ? '✨ باز کردن استودیو' : '✨ Open the studio', web_app: { url: origin }, style: 'primary' }],
    [{ text: fa ? '🆕 تازه‌های Bot API 10.3' : '🆕 Bot API 10.3 changes', callback_data: `updates:${lang}` }],
    [{ text: fa ? '🏠 منو' : '🏠 Menu', callback_data: `home:${lang}` }],
  ] }, messageId);
}

const back = (lang, origin) => ({ inline_keyboard: [[{ text: lang === 'fa' ? '← بازگشت به منو' : '← Back to menu', callback_data: `home:${lang}` }, { text: lang === 'fa' ? 'باز کردن استودیو' : 'Open studio', web_app: { url: origin }, style: 'primary' }]] });
async function plain(env, chatId, text, markup, messageId) {
  return telegram(env, messageId ? 'editMessageText' : 'sendMessage', { chat_id: chatId, ...(messageId ? { message_id: messageId } : {}), text, parse_mode: 'HTML', reply_markup: markup, link_preview_options: { is_disabled: true } });
}
async function home(env, chatId, lang, origin, messageId) {
  const en = '<b>✨ TeleRich · Rich Message Studio</b>\n\nSend HTML or Markdown to render a rich message with Bot API 10.3.\n\nExplore individual guides, code examples and live demos. Open the studio for button styles, row layout, media and channel publishing.\n\n/start — menu\n/help — guides\n/post — channel studio\n/ref — quota & invites\n/about — credits';
  const fa = '<b>✨ TeleRich · استودیوی پیام ریچ</b>\n\nمتن HTML یا Markdown بفرستید تا با Bot API 10.3 به پیام ریچ تبدیل شود.\n\nراهنمای هر قابلیت، نمونه کد و دموی زنده در دسترس است. برای تنظیم رنگ و ردیف دکمه، مدیا و ارسال به کانال، استودیو را باز کنید.\n\n/start — منو\n/help — راهنما\n/post — پست‌ساز\n/ref — سهمیه و دعوت\n/about — درباره';
  const text = lang === 'fa' ? fa : en;
  const kb = menu(lang, origin);
  if (await quotaExempt(env, chatId)) kb.inline_keyboard.splice(Math.max(0, kb.inline_keyboard.length - 1), 0, [{ text: lang === 'fa' ? '⚙️ تنظیمات ربات' : '⚙️ Bot settings', callback_data: `settings:${lang}` }]);
  return plain(env, chatId, text, kb, messageId);
}
function reconstruct(message) {
  const text = message.text || message.caption || '';
  const entities = message.entities || message.caption_entities || [];
  if (!entities.length) return { [/<\/?[a-z][\s\S]*?>/i.test(text) ? 'html' : 'markdown']: text };
  const starts = new Map(), ends = new Map();
  const tags = { bold: ['<b>', '</b>'], italic: ['<i>', '</i>'], underline: ['<u>', '</u>'], strikethrough: ['<s>', '</s>'], spoiler: ['<tg-spoiler>', '</tg-spoiler>'], code: ['<code>', '</code>'], pre: ['<pre><code>', '</code></pre>'], blockquote: ['<blockquote>', '</blockquote>'], expandable_blockquote: ['<blockquote expandable>', '</blockquote>'] };
  for (const e of [...entities].sort((a, b) => a.offset - b.offset || b.length - a.length)) {
    let pair = tags[e.type];
    if (e.type === 'text_link') pair = [`<a href="${escape(e.url)}">`, '</a>'];
    if (e.type === 'text_mention') pair = [`<a href="tg://user?id=${e.user.id}">`, '</a>'];
    if (e.type === 'custom_emoji') pair = [`<tg-emoji emoji-id="${escape(e.custom_emoji_id)}">`, '</tg-emoji>'];
    if (!pair) continue;
    starts.set(e.offset, (starts.get(e.offset) || '') + pair[0]);
    ends.set(e.offset + e.length, pair[1] + (ends.get(e.offset + e.length) || ''));
  }
  let output = '';
  for (let i = 0; i <= text.length; i++) output += (ends.get(i) || '') + (starts.get(i) || '') + (i < text.length ? escape(text[i]) : '');
  return { html: output };
}
function guideIndexByName(name) { return guides.findIndex(g => g.name === name); }
async function sendList(env, chatId, lang, group, offset, origin, messageId) {
  const list = guides.map((g, i) => ({ ...g, i })).filter(g => g.group === group);
  offset = Math.max(0, offset || 0);
  const slice = list.slice(offset, offset + 8);
  const keyboard = slice.map(g => [{ text: lang === 'fa' ? `${g.fa} · ${g.name}` : g.name, callback_data: `guide:${lang}:${g.i}` }]);
  const nav = [];
  if (offset > 0) nav.push({ text: '←', callback_data: `list:${lang}:${group}:${offset - 8}`, style: 'danger' });
  if (offset + 8 < list.length) nav.push({ text: '→', callback_data: `list:${lang}:${group}:${offset + 8}`, style: 'primary' });
  if (nav.length) keyboard.push(nav);
  keyboard.push(back(lang, origin).inline_keyboard[0]);
  return plain(env, chatId, `<b>${escape(group)} · Bot API 10.3</b>\n\n${lang === 'fa' ? 'برای توضیح و نمونه، یک قابلیت انتخاب کنید.' : 'Choose a feature for its explanation and example.'}`, { inline_keyboard: keyboard }, messageId);
}
async function sendGuide(env, chatId, lang, index, origin, messageId) {
  const guide = guides[index];
  if (!guide) return;
  const text = `<b>${escape(guide.name)}</b>\n\n${escape(lang === 'fa' ? guide.descriptionFa : guide.description)}\n\n<pre>${escape(guide.code)}</pre>\n\n<a href="https://core.telegram.org/bots/api#${guide.name.toLowerCase()}">Telegram API reference</a>`;
  return plain(env, chatId, text, { inline_keyboard: [[{ text: lang === 'fa' ? '▶ نمایش نمونه رندرشده' : '▶ Render this example', callback_data: `render:${lang}:${index}`, style: 'success' }], ...back(lang, origin).inline_keyboard] }, messageId);
}
async function sendDemo(env, chatId, lang, offset, origin, messageId) {
  offset = Math.max(0, offset || 0);
  const examples = guides.slice(offset, offset + 5);
  const nav = [];
  if (offset > 0) nav.push({ text: lang === 'fa' ? '← بخش قبل' : '← Previous section', callback_data: `demo:${lang}:${Math.max(0, offset - 5)}`, style: 'danger' });
  if (offset + 5 < guides.length) nav.push({ text: lang === 'fa' ? 'بخش بعد →' : 'Next section →', callback_data: `demo:${lang}:${offset + 5}`, style: 'primary' });
  const rich_message = { markdown: examples.map(g => `## ${g.name}\n\n${g.code}`).join('\n\n') };
  const reply_markup = { inline_keyboard: [...(nav.length ? [nav] : []), ...back(lang, origin).inline_keyboard] };
  // Bot API 10.2+: editMessageText accepts rich_message, so paging through the demo edits
  // the same message instead of sending a new one each time next/back is pressed.
  return telegram(env, messageId ? 'editMessageText' : 'sendRichMessage', { chat_id: chatId, ...(messageId ? { message_id: messageId } : {}), rich_message, reply_markup });
}
async function sendUpdates(env, chatId, lang, origin, messageId) {
  const release = releases[0];
  const text = `<b>Bot API ${release.version} · ${release.date}</b>\n\n` + release.items.map(item => `<b>${escape(item[0])}</b>\n${escape(item[lang === 'fa' ? 2 : 1])}`).join('\n\n') + '\n\n<a href="https://core.telegram.org/bots/api#august-24-2026">Official changelog</a>';
  return plain(env, chatId, text, back(lang, origin), messageId);
}
async function sendWebapp(env, chatId, lang, origin) {
  return plain(env, chatId, lang === 'fa' ? '✨ استودیوی پیام و پست‌ساز را باز کنید.' : '✨ Open the message & channel studio.', { inline_keyboard: [[{ text: lang === 'fa' ? '✨ باز کردن استودیو' : '✨ Open studio', web_app: { url: origin }, style: 'primary' }], back(lang, origin).inline_keyboard[0]] });
}
async function sendWhoami(env, chatId, lang, origin, user) {
  const restricted = admins(env).length > 0;
  const isAdmin = !restricted || admins(env).includes(String(user.id));
  const text = lang === 'fa'
    ? `<b>شناسه عددی شما</b>\n<code>${user.id}</code>\n\n${restricted ? (isAdmin ? '✅ شما در فهرست ADMINS_ID هستید.' : '⛔ شما در فهرست ADMINS_ID نیستید و به استودیو دسترسی ندارید.') : 'ℹ️ ADMINS_ID تنظیم نشده؛ استفاده از ربات برای همه آزاد است.'}`
    : `<b>Your numeric ID</b>\n<code>${user.id}</code>\n\n${restricted ? (isAdmin ? '✅ You are listed in ADMINS_ID.' : '⛔ You are not listed in ADMINS_ID and cannot use the studio.') : 'ℹ️ ADMINS_ID is not set; anyone may use this bot.'}`;
  return plain(env, chatId, text, back(lang, origin));
}



// ── Quota & referral system (KV-backed) ──────────────────────────────────────
const freeLimit = env => { const n = Number(env.FREE_LIMIT); return Number.isFinite(n) && n > 0 ? n : 10; };
const refBonus = env => { const n = Number(env.REF_BONUS); return Number.isFinite(n) && n > 0 ? n : 10; };
const quotaExempt = (env, id) => String(env.QUOTA_EXEMPT || '').split(/[\s,]+/).filter(Boolean).includes(String(id));
async function userRec(env, id) {
  return (await env.RICHKV?.get('u:' + id, 'json')) || { used: 0, refs: 0, pending_ref: 0, ref_done: false, bonus: 0, blocked: false };
}
const quotaOf = (env, rec) => freeLimit(env) + (rec.refs || 0) * refBonus(env) + (rec.bonus || 0);

// A referred newcomer registers its inviter once; credit is only settled after
// the newcomer is confirmed to be a member of JOIN_CHANNEL (see settleRef).
async function captureRef(env, user, payload) {
  if (!env.RICHKV || !payload) return;
  const m = /^ref_(\d{1,12})$/.exec(String(payload).trim());
  if (!m || Number(m[1]) === user.id) return;
  const rec = await userRec(env, user.id);
  if (rec.ref_done || rec.pending_ref) return;
  rec.pending_ref = Number(m[1]);
  await env.RICHKV.put('u:' + user.id, JSON.stringify(rec));
}

// Settles a pending referral once the newcomer passed the channel-membership
// gate: +REF_BONUS for the inviter, single credit, self-ref impossible.
async function settleRef(env, user) {
  if (!env.RICHKV) return;
  const rec = await userRec(env, user.id);
  if (!rec.pending_ref || rec.ref_done) return;
  if (rec.pending_ref === user.id) { rec.ref_done = true; await env.RICHKV.put('u:' + user.id, JSON.stringify(rec)); return; }
  const inv = await userRec(env, rec.pending_ref);
  inv.refs = (inv.refs || 0) + 1;
  await env.RICHKV.put('u:' + rec.pending_ref, JSON.stringify(inv));
  rec.ref_done = true;
  await env.RICHKV.put('u:' + user.id, JSON.stringify(rec));
  const limit = inv.unlimited ? '♾' : quotaOf(env, inv), bonus = refBonus(env);
  const text = `<b>\ud83c\udf81 \u06cc\u0647 \u0646\u0641\u0631 \u0628\u0627 \u0644\u06cc\u0646\u06a9 \u062f\u0639\u0648\u062a\u062a \u0628\u0647 TeleRich \u067e\u06cc\u0648\u0633\u062a \u0648 \u0639\u0636\u0648 \u06a9\u0627\u0646\u0627\u0644 \u0634\u062f!</b>\n\n\u2705 \u0632\u06cc\u0631\u0645\u062c\u0645\u0648\u0639\u0647\u0647\u0627\u06cc \u062a\u0623\u06cc\u06cc\u062f\u0634\u062f\u0647: <b>${inv.refs}</b>\n\ud83c\udf81 \u0633\u0647\u0645\u06cc\u0647\u0654 \u0633\u0627\u062e\u062a \u067e\u06cc\u0627\u0645 \u0634\u0645\u0627 \u0627\u0644\u0627\u0646: <b>${limit}</b> \u067e\u06cc\u0627\u0645\n\n/ref \u2014 \u0633\u0647\u0645\u06cc\u0647 \u0648 \u0644\u06cc\u0646\u06a9 \u062f\u0639\u0648\u062a\u062a\n\ud83c\udf1f Invite more friends to unlock more messages!`;
  try { await telegram(env, 'sendMessage', { chat_id: rec.pending_ref, text, parse_mode: 'HTML' }); } catch (e) { /* inviter may have blocked the bot */ }
}

async function quotaStatus(env, userId) {
  if (quotaExempt(env, userId) || !env.RICHKV) return { ok: true, exempt: true };
  const rec = await userRec(env, userId);
  if (rec.unlimited) return { ok: true, unlimited: true, used: rec.used || 0, limit: '♾', refs: rec.refs || 0 };
  const limit = quotaOf(env, rec);
  if (rec.blocked) return { ok: false, blocked: true, used: rec.used || 0, limit, refs: rec.refs || 0 };
  return { ok: (rec.used || 0) < limit, used: rec.used || 0, limit, refs: rec.refs || 0 };
}

async function addUsed(env, userId, n = 1) {
  if (quotaExempt(env, userId) || !env.RICHKV || !userId) return;
  const rec = await userRec(env, userId);
  rec.used = (rec.used || 0) + n;
  await env.RICHKV.put('u:' + userId, JSON.stringify(rec));
}

// ── Bot statistics (owner-only /stats report) ──
const dayKey = () => new Date().toISOString().slice(0, 10);
async function statsRec(env) { return (await env.RICHKV?.get('s:stats', 'json')) || { users: 0, sends: 0, channel: 0, day: '', today: 0, joinedToday: 0 }; }
async function bumpStats(env, patch) {
  if (!env.RICHKV) return;
  const s = await statsRec(env);
  if (s.day !== dayKey()) { s.day = dayKey(); s.today = 0; s.joinedToday = 0; }
  if (patch.sends) { s.sends = (s.sends || 0) + patch.sends; s.today = (s.today || 0) + patch.sends; }
  if (patch.channel) s.channel = (s.channel || 0) + patch.channel;
  if (patch.users) { s.users = (s.users || 0) + patch.users; s.joinedToday = (s.joinedToday || 0) + patch.users; }
  await env.RICHKV.put('s:stats', JSON.stringify(s));
}
// First sight of a Telegram user: persist a record (name, join time) once.
async function touchUser(env, user) {
  if (!env.RICHKV || !user?.id) return;
  const rec = await userRec(env, user.id);
  const uname = user.username || '';
  const nm = user.first_name || user.username || String(user.id);
  if (rec.first && rec.user === uname && rec.name === nm) return;
  if (!rec.first) await bumpStats(env, { users: 1 });
  rec.first = rec.first || Date.now();
  rec.name = nm;
  rec.user = uname;
  await env.RICHKV.put('u:' + user.id, JSON.stringify(rec));
}
async function adminList(env, chatId, lang, origin, page = 0) {
  const fa = lang === 'fa';
  if (!env.RICHKV) return plain(env, chatId, 'KV unavailable.', back(lang, origin));
  const ids = [];
  let cursor;
  do {
    const pg = await env.RICHKV.list({ prefix: 'u:', limit: 1000, cursor });
    ids.push(...pg.keys.map(k => k.name.slice(2)));
    cursor = pg.list_complete ? undefined : pg.cursor;
  } while (cursor);
  const per = 6;
  const maxPage = Math.max(0, Math.ceil(ids.length / per) - 1);
  page = Math.min(Math.max(0, page), maxPage);
  const rows = [];
  for (const id of ids.slice(page * per, page * per + per)) {
    const r = await userRec(env, id);
    const icon = r.blocked ? '⛔' : r.unlimited ? '♾' : (r.used || 0) >= quotaOf(env, r) ? '🔴' : (r.used || 0) > 0 ? '🟡' : '🟢';
    rows.push([{ text: `${icon} ${safeText((r.name || id).slice(0, 12))} · ${r.user ? '@' + String(r.user).slice(0, 16) : '🆔' + id}`, callback_data: `adm:${lang}:${id}:${page}` }]);
  }
  rows.push([
    { text: '⬅️', callback_data: `admp:${lang}:${Math.max(0, page - 1)}` },
    { text: `📄 ${page + 1}/${maxPage + 1}`, callback_data: `admp:${lang}:${page}` },
    { text: '➡️', callback_data: `admp:${lang}:${Math.min(maxPage, page + 1)}` },
  ]);
  rows.push(back(lang, origin).inline_keyboard[0]);
  const text = fa
    ? `<b>🛠 مدیریت کاربران</b>\n\n👤 مجموع: <b>${ids.length}</b> کاربر\nوضعیت‌ها: 🟢 بدون مصرف · 🟡 در حال استفاده · 🔴 سقف · ⛔ بلاک\n\nروی هر کاربر بزنید تا آمار و مدیریتش باز شود.`
    : `<b>🛠 User management</b>\n\n👤 Total: <b>${ids.length}</b> users\nStatus: 🟢 unused · 🟡 active · 🔴 capped · ⛔ blocked\n\nTap a user to open their stats and controls.`;
  return plain(env, chatId, text, { inline_keyboard: rows });
}
async function adminUser(env, chatId, lang, origin, id, page = 0) {
  const fa = lang === 'fa';
  const r = await userRec(env, id);
  const limit = quotaOf(env, r);
  const limitShown = r.unlimited ? (fa ? '♾ نامحدود' : '♾ unlimited') : limit;
  const joined = r.first ? new Date(r.first).toISOString().slice(0, 10) : (fa ? 'نامشخص' : 'unknown');

  const text = fa
    ? `<b>👤 ${escape(r.name || id)}</b>\n🆔 <code>${id}</code>${r.user ? `\n👤 <a href="https://t.me/${r.user}">@${escape(r.user)}</a>` : '\n👤 بدون آیدی کاربری'}${quotaExempt(env, id) ? ' ⭐ (مالک)' : ''}\n\n📬 پیام‌های ساخته‌شده: <b>${r.used || 0}/${limitShown}</b>\n🎁 زیرمجموعه‌های تأییدشده: <b>${r.refs || 0}</b>\n➕ سهمیه‌ی دستی: <b>${r.bonus || 0}</b>\n⛔ وضعیت: <b>${r.blocked ? 'بلاک شده' : 'فعال'}</b>\n📅 اولین استفاده: <code>${joined}</code>\n\n🔒 مدیریت سهمیه:`
    : `<b>👤 ${escape(r.name || id)}</b>\n🆔 <code>${id}</code>${r.user ? `\n👤 <a href="https://t.me/${r.user}">@${escape(r.user)}</a>` : '\n👤 no username'}${quotaExempt(env, id) ? ' ⭐ (owner)' : ''}\n\n📬 Messages built: <b>${r.used || 0}/${limitShown}</b>\n🎁 Verified referrals: <b>${r.refs || 0}</b>\n➕ Manual bonus: <b>${r.bonus || 0}</b>\n⛔ Status: <b>${r.blocked ? 'blocked' : 'active'}</b>\n📅 First seen: <code>${joined}</code>\n\n🔒 Manage quota:`;
  const kb = { inline_keyboard: [
    [
      { text: fa ? '➕ ۱۰+ سهمیه' : '➕ +10 quota', callback_data: `admx:${lang}:${id}:plus:${page}` },
      { text: fa ? '➖ ۱۰- سهمیه' : '➖ -10 quota', callback_data: `admx:${lang}:${id}:minus:${page}` },
    ],
    [
      { text: fa ? '🔢 عدد دلخواه' : '🔢 Custom amount', callback_data: `admx:${lang}:${id}:custom:${page}` },
      { text: r.unlimited ? (fa ? '♾ حذف نامحدودی' : '♾ Remove unlimited') : (fa ? '♾ نامحدود کن' : '♾ Make unlimited'), callback_data: `admx:${lang}:${id}:${r.unlimited ? 'limited' : 'unlimited'}:${page}` },
    ],
    [
      { text: fa ? '♻️ صفر کردن مصرف' : '♻️ Reset usage', callback_data: `admx:${lang}:${id}:reset:${page}` },
      { text: r.blocked ? (fa ? '✅ رفع بلاک' : '✅ Unblock') : (fa ? '⛔ بلاک کاربر' : '⛔ Block user'), callback_data: `admx:${lang}:${id}:${r.blocked ? 'unblock' : 'block'}:${page}` },
    ],
    [{ text: fa ? '⬅️ بازگشت به لیست' : '⬅️ Back to list', callback_data: `admp:${lang}:${page}` }],
  ] };
  return plain(env, chatId, text, kb);
}
async function adminAction(env, chatId, lang, origin, id, op, page) {
  const fa = lang === 'fa';
  if (op === 'custom') {
    const label = fa
      ? '🔢 عدد سهمیه را در پاسخ این پیام بفرست:\n➕ <code>50</code> یعنی ۵۰ سهمیه اضافه بشه\n➖ <code>-30</code> یعنی ۳۰ سهمیه کم بشه\n\n<code>TR:quota:' + id + ':' + lang + ':' + page + '</code>'
      : '🔢 Reply to this message with the amount:\n➕ <code>50</code> adds 50 messages\n➖ <code>-30</code> removes 30 messages\n\n<code>TR:quota:' + id + ':' + lang + ':' + page + '</code>';
    return plain(env, chatId, label, { force_reply: true, selective: true });
  }
  const rec = await userRec(env, id);
  let note = '';
  if (op === 'plus') { rec.bonus = (rec.bonus || 0) + 10; note = fa ? '✅ ۱۰ سهمیه اضافه شد.' : '✅ +10 quota added.'; }
  else if (op === 'minus') { rec.bonus = Math.max(0, (rec.bonus || 0) - 10); note = fa ? '✅ ۱۰ سهمیه کم شد.' : '✅ -10 quota.'; }
  else if (op === 'reset') { rec.used = 0; note = fa ? '✅ مصرف صفر شد.' : '✅ Usage reset.'; }
  else if (op === 'block') { rec.blocked = true; note = fa ? '⛔ کاربر بلاک شد.' : '⛔ User blocked.'; }
  else if (op === 'unblock') { rec.blocked = false; note = fa ? '✅ بلاک برداشته شد.' : '✅ User unblocked.'; }
  else if (op === 'unlimited') { rec.unlimited = true; note = fa ? '♾ سهمیه این کاربر نامحدود شد.' : '♾ User is now unlimited.'; }
  else if (op === 'limited') { rec.unlimited = false; note = fa ? '✅ حالت نامحدود برداشته شد.' : '✅ Unlimited mode removed.'; }
  await env.RICHKV.put('u:' + id, JSON.stringify(rec));
  try { await telegram(env, 'sendMessage', { chat_id: Number(id), text: note, parse_mode: 'HTML' }); } catch (e) { /* user may have blocked the bot */ }
  return adminUser(env, chatId, lang, origin, id, page);
}
const richFromText = t => { const v = String(t); return { [/<\/?[a-z][\s\S]*?>/i.test(v) ? 'html' : 'markdown']: v }; };

// ── Owner broadcast: preview, confirm, deliver to every user record ──────────
async function broadcastPrompt(env, chatId, lang, origin) {
  const fa = lang === 'fa';
  const label = fa
    ? '📣 متن پیام همگانی را در پاسخ این پیام بفرست (HTML یا Markdown).\nاول پیش‌نمایشش را می‌بینی، بعد با دکمه‌ی تأیید برای همه‌ی کاربرها ارسال می‌شود.\n\n<code>TR:bcast:0:' + lang + '</code>'
    : '📣 Reply to this message with the broadcast text (HTML or Markdown).\nYou will see a preview first, then confirm to deliver it to all users.\n\n<code>TR:bcast:0:' + lang + '</code>';
  return plain(env, chatId, label, { force_reply: true, selective: true });
}
async function broadcastPreview(env, chatId, lang, origin, text) {
  await env.RICHKV.put('bcast:' + chatId, JSON.stringify({ text: String(text), ts: Date.now() }));
  await telegram(env, 'sendRichMessage', { chat_id: chatId, rich_message: withFooter(validateRich(richFromText(text))) });
  const fa = lang === 'fa';
  return plain(env, chatId, fa ? '👀 پیش‌نمایش بالا است. ارسال برای همه‌ی کاربرها؟' : '👀 Preview above. Send it to all users?', { inline_keyboard: [
    [{ text: fa ? '✅ ارسال به همه' : '✅ Send to all', callback_data: `bcstgo:${lang}`, style: 'success' }],
    [{ text: fa ? '❌ انصراف' : '❌ Cancel', callback_data: `bcstno:${lang}`, style: 'danger' }],
  ] });
}
async function broadcastRun(env, chatId, lang, origin) {
  const fa = lang === 'fa';
  const pend = await env.RICHKV.get('bcast:' + chatId, 'json');
  if (!pend?.text) return plain(env, chatId, fa ? '⛔ پیامی در انتظار نیست؛ دوباره /broadcast بزن.' : '⛔ No pending broadcast; run /broadcast again.', back(lang, origin));
  const ids = [];
  let cursor;
  do {
    const pg = await env.RICHKV.list({ prefix: 'u:', limit: 1000, cursor });
    ids.push(...pg.keys.map(k => k.name.slice(2)));
    cursor = pg.list_complete ? undefined : pg.cursor;
  } while (cursor);
  await plain(env, chatId, fa ? `⏳ در حال ارسال به ${ids.length} کاربر...` : `⏳ Sending to ${ids.length} users...`);
  const rich = withFooter(validateRich(richFromText(pend.text)));
  let sent = 0, failed = 0, skipped = 0;
  for (const id of ids) {
    if (String(id) === String(chatId)) continue;
    const rec = await env.RICHKV.get('u:' + id, 'json') || {};
    if (rec.blocked) { skipped++; continue; }
    try { await telegram(env, 'sendRichMessage', { chat_id: Number(id), rich_message: rich }); sent++; } catch (e) { failed++; }
    await new Promise(r => setTimeout(r, 120));
  }
  await env.RICHKV.delete('bcast:' + chatId);
  await bumpStats(env, { sends: sent });
  return plain(env, chatId, fa
    ? `📣 ارسال همگانی تمام شد.\n\n✅ رسید: <b>${sent}</b>\n❌ خطا (ربات بسته بود): <b>${failed}</b>\n⛔ رد شد (بلاک‌شده): <b>${skipped}</b>`
    : `📣 Broadcast finished.\n\n✅ Delivered: <b>${sent}</b>\n❌ Failed (bot blocked): <b>${failed}</b>\n⛔ Skipped (blocked): <b>${skipped}</b>`, back(lang, origin));
}
async function statsReport(env, chatId, lang, origin) {
  const fa = lang === 'fa';
  const s = await statsRec(env);
  if (s.day !== dayKey()) { s.today = 0; s.joinedToday = 0; }
  let refs = 0, active = 0, blocked = 0, top = [];
  if (env.RICHKV) {
    const ids = [];
    let cursor;
    do {
      const page = await env.RICHKV.list({ prefix: 'u:', limit: 1000, cursor });
      ids.push(...page.keys.map(k => k.name.slice(2)));
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    const recs = [];
    for (const id of ids.slice(0, 500)) {
      const r = await env.RICHKV.get('u:' + id, 'json');
      if (r) recs.push({ id, ...r });
    }
    refs = recs.reduce((a, r) => a + (r.refs || 0), 0);
    active = recs.filter(r => (r.used || 0) > 0).length;
    blocked = recs.filter(r => !quotaExempt(env, r.id) && (r.used || 0) >= quotaOf(env, r)).length;
    top = recs.filter(r => (r.refs || 0) > 0).sort((a, b) => (b.refs || 0) - (a.refs || 0)).slice(0, 3);
  }
  let members = null;
  { const jl = await joinList(env); if (jl.length) { try { members = (await telegram(env, 'getChatMemberCount', { chat_id: jl[0].id })).count; } catch (e) {} } }
  const medal = ['🥇', '🥈', '🥉'];
  const topText = top.length
    ? top.map((r, i) => `${medal[i]} ${escape(r.name || r.id)} — ${r.refs}`).join('\n')
    : (fa ? 'هنوز دعوتی ثبت نشده.' : 'No referrals yet.');
  const text = fa
    ? `<b>📊 گزارش ربات TeleRich 7x</b>\n\n👥 کاربران: <b>${s.users}</b> (＋${s.joinedToday} امروز)\n${members != null ? `📢 اعضای کانال: <b>${members}</b>\n` : ''}📬 پیام‌های ساخته‌شده: <b>${s.sends}</b> (＋${s.today} امروز)\n🖥 پست‌های کانالی: <b>${s.channel}</b>\n\n🎁 زیرمجموعه‌های تأییدشده: <b>${refs}</b>\n🔥 کاربران فعال: <b>${active}</b> · ⛔ رسیده به سقف: <b>${blocked}</b>\n\n<b>🏆 برترین دعوت‌کننده‌ها</b>\n${topText}`
    : `<b>📊 TeleRich 7x report</b>\n\n👥 Users: <b>${s.users}</b> (＋${s.joinedToday} today)\n${members != null ? `📢 Channel members: <b>${members}</b>\n` : ''}📬 Messages built: <b>${s.sends}</b> (＋${s.today} today)\n🖥 Channel posts: <b>${s.channel}</b>\n\n🎁 Verified referrals: <b>${refs}</b>\n🔥 Active users: <b>${active}</b> · ⛔ Quota reached: <b>${blocked}</b>\n\n<b>🏆 Top referrers</b>\n${topText}`;
  return plain(env, chatId, text, back(lang, origin));
}

async function inviteKeyboard(env, userId, lang, origin) {
  const fa = lang === 'fa';
  const me = await telegram(env, 'getMe');
  const link = `https://t.me/${me.username}?start=ref_${userId}`;
  const share = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(fa ? '✨ با TeleRich 7x پیام‌های تلگرامت رو حرفه‌ای و دکمه‌دار کن!' : '✨ Craft gorgeous rich Telegram messages with TeleRich 7x!')}`;
  return { inline_keyboard: [
    [{ text: fa ? '🔗 دعوت دوستان' : '🔗 Invite friends', url: share }],
    [{ text: fa ? '📋 کپی لینک دعوت' : '📋 Copy invite link', copy_text: { text: link } }],
    [{ text: fa ? '📊 وضعیت سهمیه' : '📊 My quota', callback_data: 'quota:' + (fa ? 'fa' : 'en') }],
    [{ text: '📢 @Config7x', url: 'https://t.me/Config7x', style: 'primary' }],
    ...back(lang, origin).inline_keyboard
  ] };
}

async function quotaPanel(env, chatId, lang, origin, messageId) {
  const fa = lang === 'fa';
  if (quotaExempt(env, chatId)) {
    const text = fa
      ? `<b>\ud83d\udcca \u0633\u0647\u0645\u06cc\u0647\u0654 \u0633\u0627\u062e\u062a \u067e\u06cc\u0627\u0645</b>\n\n\ud83c\udf1f <b>\u0634\u0645\u0627 \u0645\u0627\u0644\u06a9 \u0631\u0628\u0627\u062a \u0647\u0633\u062a\u06cc\u062f \u2014 \u0633\u0647\u0645\u06cc\u0647\u0654 \u0634\u0645\u0627 \u0646\u0627\u0645\u062d\u062f\u0648\u062f \u0627\u0633\u062a \u2666\ufe0f</b>\n\n\ud83c\udf81 \u062f\u0639\u0648\u062a \u062f\u0648\u0633\u062a\u0627\u0646 \u0645\u0627\u0632\u0627\u062f \u0645\u06cc\u062f\u0647 \u06a9\u0647 \u0645\u0631\u062f\u0645 \u0631\u0627\u06cc\u06af\u0627\u0646 \u0628\u0627\u0634\u0646\u062f \u0648 \u06a9\u0627\u0646\u0627\u0644 \u0645\u0627 \u0645\u0633\u062a\u0642\u0644 \u0628\u0645\u0627\u0646\u0647.`
      : `<b>\ud83d\udcca Your message quota</b>\n\n\ud83c\udf1f <b>You own this bot \u2014 your quota is unlimited.</b>\n\n\ud83c\udf81 Inviting friends keeps the free tier running and our channel growing.`;
    const me = await telegram(env, 'getMe');
    const link = `https://t.me/${me.username}?start=ref_${chatId}`;
    const share = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(fa ? '✨ با TeleRich 7x پیام‌های تلگرامت رو حرفه‌ای و دکمه‌دار کن!' : '✨ Craft gorgeous rich Telegram messages with TeleRich 7x!')}`;
    const kb = { inline_keyboard: [
      [{ text: fa ? '🔗 دعوت دوستان' : '🔗 Invite friends', url: share }],
      [{ text: fa ? '📋 کپی لینک دعوت' : '📋 Copy invite link', copy_text: { text: link } }],
      [{ text: '📢 @Config7x', url: 'https://t.me/Config7x', style: 'primary' }],
      ...back(lang, origin).inline_keyboard
    ] };
    return plain(env, chatId, text, kb, messageId);
  }
  const rec = await userRec(env, chatId);
  const limit = rec.unlimited ? '♾' : quotaOf(env, rec), used = rec.used || 0, refs = rec.refs || 0, bonus = refBonus(env);
  const me = await telegram(env, 'getMe');
  const link = `https://t.me/${me.username}?start=ref_${chatId}`;
  const text = fa
    ? `<b>\ud83d\udcca \u0633\u0647\u0645\u06cc\u0647\u0654 \u0633\u0627\u062e\u062a \u067e\u06cc\u0627\u0645</b>\n\n\u2728 \u067e\u06cc\u0627\u0645\u0647\u0627\u06cc \u0631\u0627\u06cc\u06af\u0627\u0646: <b>${freeLimit(env)}</b>\n\ud83d\udcc9 \u0633\u0627\u062e\u062a\u0647\u0634\u062f\u0647: <b>${used}</b> \u0627\u0632 <b>${limit}</b>\n\ud83c\udf81 \u0632\u06cc\u0631\u0645\u062c\u0645\u0648\u0639\u0647\u0647\u0627\u06cc \u062a\u0623\u06cc\u06cc\u062f\u0634\u062f\u0647: <b>${refs}</b>\n\ud83d\udd17 \u0628\u0647\u0627\u06cc \u0647\u0631 \u0632\u06cc\u0631\u0645\u062c\u0645\u0648\u0639\u0647\u0654 \u062a\u0623\u06cc\u06cc\u062f\u0634\u062f\u0647: <b>+${bonus} \u067e\u06cc\u0627\u0645</b>\n\n\u0632\u06cc\u0631\u0645\u062c\u0648\u0645\u0639\u0647 \u0648\u0642\u062a\u06cc \u062a\u0623\u06cc\u06cc\u062f \u0645\u06cc\u200c\u0634\u0647 \u06a9\u0647 \u0628\u0627 \u0644\u06cc\u0646\u06a9 \u062a\u0648 \u0628\u06cc\u0627\u062f \u0648 \u0639\u0636\u0648 \u06a9\u0627\u0646\u0627\u0644 \u0645\u0627 \u0628\u0634\u0647.\n\n<b>\u0644\u06cc\u0646\u06a9 \u062f\u0639\u0648\u062a \u0634\u0645\u0627:</b>\n<code>${link}</code>`
    : `<b>\ud83d\udcca Your message quota</b>\n\n\u2728 Free messages: <b>${freeLimit(env)}</b>\n\ud83d\udcc9 Built: <b>${used}</b> of <b>${limit}</b>\n\ud83c\udf81 Verified referrals: <b>${refs}</b>\n\ud83d\udd17 Per verified referral: <b>+${bonus} messages</b>\n\nA referral counts once they join via your link and become a member of our channel.\n\n<b>Your invite link:</b>\n<code>${link}</code>`;
  const kb = await inviteKeyboard(env, chatId, lang, origin);
  return plain(env, chatId, text, kb, messageId);
}

async function quotaExhausted(env, chatId, lang, origin, used, limit, blocked) {
  const fa = lang === 'fa';
  if (blocked) {
    const text = fa
      ? '<b>⛔ دسترسی شما به ساخت پیام توسط مدیر ربات محدود شده است.</b>'
      : '<b>⛔ Your access to building messages has been restricted by the bot owner.</b>';
    return plain(env, chatId, text, back(lang, origin));
  }
  const me = await telegram(env, 'getMe');
  const link = `https://t.me/${me.username}?start=ref_${chatId}`;
  const text = fa
    ? `<b>\ud83c\udf81 \u0633\u0647\u0645\u06cc\u0647\u0654 \u0631\u0627\u06cc\u06af\u0627\u0646\u062a \u062a\u0645\u0627\u0645 \u0634\u062f!</b>\n\n${used} \u067e\u06cc\u0627\u0645 \u0633\u0627\u062e\u062a\u06cc \u0648 \u0633\u0647\u0645\u06cc\u0647\u062a <b>${limit}</b> \u0628\u0648\u062f.\n\u0628\u0631\u0627\u06cc \u0633\u0627\u062e\u062a \u067e\u06cc\u0627\u0645\u0647\u0627\u06cc \u0628\u06cc\u0634\u062a\u0631\u060c \u062f\u0648\u0633\u062a\u0627\u062a \u0631\u0648 \u0628\u0627 \u0644\u06cc\u0646\u06a9 \u062f\u0639\u0648\u062a \u06a9\u0646\u060c \u0647\u0631 \u0632\u06cc\u0631\u0645\u062c\u0645\u0648\u0639\u0647\u0654 \u062a\u0623\u06cc\u06cc\u062f\u0634\u062f\u0647 <b>+${refBonus(env)} \u067e\u06cc\u0627\u0645</b> \u0645\u06cc\u062f\u0647.\n\n\ud83d\udd17 <code>${link}</code>`
    : `<b>\ud83c\udf81 Your free quota is used up!</b>\n\nYou built ${used} of <b>${limit}</b> messages.\nInvite friends with your link; every verified referral gives <b>+${refBonus(env)} messages</b>.\n\n\ud83d\udd17 <code>${link}</code>`;
  const kb = await inviteKeyboard(env, chatId, lang, origin);
  return plain(env, chatId, text, kb);
}

// ── forced join: one or many chats (channel + group) ─────────────────
// Stored as a list so the owner can require both his channel and his group.
// Falls back to the JOIN_CHANNEL env value (comma-separated) when no list is saved.
async function joinList(env) {
  try {
    const saved = await env.RICHKV.get('join:targets', 'json');
    if (Array.isArray(saved)) return saved;
  } catch (e) { /* fall through to env */ }
  const raw = String(env.JOIN_CHANNEL || '').split(/[,;\s]+/).filter(Boolean);
  return raw.map((t) => ({ id: t, title: t, type: t.startsWith('@') ? 'channel' : 'chat', username: t.startsWith('@') ? t.slice(1) : '', invite: '' }));
}
async function saveJoinList(env, list) {
  await env.RICHKV.put('join:targets', JSON.stringify(list));
  return list;
}
async function targetLink(env, t) {
  if (t.username) return 'https://t.me/' + String(t.username).replace(/^@/, '');
  if (t.invite) return t.invite;
  try {
    const chat = await telegram(env, 'getChat', { chat_id: t.id });
    if (chat.invite_link) return chat.invite_link;
    if (chat.username) return 'https://t.me/' + chat.username;
  } catch (e) { /* no public link available */ }
  return '';
}
async function isMember(env, userId) {
  // 'yes' only when the user is in every required chat
  const targets = await joinList(env);
  if (!targets.length) return 'yes';
  let unknown = false;
  for (const t of targets) {
    try {
      const member = await telegram(env, 'getChatMember', { chat_id: t.id, user_id: userId });
      if (!['creator', 'administrator', 'member', 'restricted'].includes(member.status)) return 'no';
    } catch (e) {
      // bot not in that chat, or the chat no longer exists: do not lock users out
      console.warn('join check unavailable for', t.id, e.message);
      unknown = true;
    }
  }
  return unknown ? 'unknown' : 'yes';
}

async function joinGate(env, chatId, user, origin, callback) {
  const status = await isMember(env, user.id);
  if (status !== 'no') return true;
  const fa = (user.language_code || '').startsWith('fa');
  const targets = await joinList(env);
  const rows = [];
  for (const t of targets) {
    const link = await targetLink(env, t);
    const isGroup = t.type === 'group' || t.type === 'supergroup';
    const name = t.title || t.id;
    if (link) rows.push([{ text: fa ? (isGroup ? `👥 عضویت در ${name}` : `📡 عضویت در ${name}`) : (isGroup ? `👥 Join ${name}` : `📡 Join ${name}`), url: link, style: 'primary' }]);
  }
  rows.push([{ text: fa ? '✅ عضو شدم، ادامه' : '✅ I joined, continue', callback_data: 'joincheck:' + (fa ? 'fa' : 'en') + ':0', style: 'success' }]);
  const text = fa
    ? `🔒 <b>عضویت اجباری</b>\n\nبرای استفاده از ربات باید در ${targets.length > 1 ? 'همهٔ موارد زیر' : 'مورد زیر'} عضو باشی:\n\n` +
      targets.map((t) => `• ${t.type === 'group' || t.type === 'supergroup' ? '👥' : '📡'} <b>${t.title || t.id}</b>`).join('\n') +
      '\n\nبعد از عضویت، دکمهٔ پایین را بزن.'
    : `🔒 <b>Join required</b>\n\nJoin ${targets.length > 1 ? 'all of these' : 'this chat'} first, then tap below.`;
  const kb = { inline_keyboard: rows };
  if (callback) {
    try { await telegram(env, 'answerCallbackQuery', { callback_query_id: callback.id, text: fa ? '\ud83d\udd12 \u0627\u0648\u0644 \u0639\u0636\u0648 \u06a9\u0627\u0646\u0627\u0644 \u0634\u0648' : '\ud83d\udd12 Join the channel first', show_alert: true }); } catch (e) {}
  }
  await telegram(env, 'sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', reply_markup: kb });
  return false;
}

async function onUpdate(update, env, origin) {
  const callback = update.callback_query;
  const message = callback?.message || update.message;
  const user = callback?.from || update.message?.from;
  if (!user || !message) return;
  // /whoami is exempt: it is how an owner discovers a user's numeric ID before adding it to ADMINS_ID.
  if (!callback && message.chat.type === 'private' && (message.text || '').split(' ')[0] === '/whoami') {
    return sendWhoami(env, message.chat.id, user.language_code?.startsWith('fa') ? 'fa' : 'en', origin, user);
  }
  if (!allowed(env, user.id)) {
    if (callback) await telegram(env, 'answerCallbackQuery', { callback_query_id: callback.id, text: 'Access restricted / دسترسی محدود', show_alert: true });
    else if (message.chat.type === 'private') await plain(env, message.chat.id, 'Access restricted / دسترسی محدود');
    return;
  }
  // Interactive menus are private-chat only; a bot must not expose another user's draft to a group.
  if (message.chat.type !== 'private') return;
  const chatId = message.chat.id;
  const detectedLang = user.language_code?.startsWith('fa') ? 'fa' : 'en';
  await touchUser(env, user);
  if (!callback && (message.text || '').split(' ')[0] === '/start') await captureRef(env, user, (message.text || '').split(' ')[1]);
  if (!(await joinGate(env, chatId, user, origin, callback))) return;
  await settleRef(env, user);
  if (callback) {
    const [action, rawLang, arg, page] = (callback.data || '').split(':');
    const lang = rawLang === 'fa' ? 'fa' : 'en';
    if (action === 'joincheck') {
      const st = await isMember(env, user.id);
      if (st === 'unknown') { await telegram(env, 'answerCallbackQuery', { callback_query_id: callback.id, text: '\u26a0\ufe0f check unavailable, try again', show_alert: true }); return; }
      if (st === 'yes') {
        await telegram(env, 'answerCallbackQuery', { callback_query_id: callback.id, text: lang === 'fa' ? '\u2705 \u062e\u0648\u0634 \u0622\u0645\u062f\u06cc!' : '\u2705 Welcome!' });
        await settleRef(env, user);
        return home(env, chatId, lang, origin, message.message_id);
      }
      await telegram(env, 'answerCallbackQuery', { callback_query_id: callback.id, text: lang === 'fa' ? '\u0647\u0646\u0648\u0632 \u0639\u0636\u0648 \u06a9\u0627\u0646\u0627\u0644 \u0646\u06cc\u0633\u062a\u06cc!' : 'Still not a member!', show_alert: true });
      return;
    }
    await telegram(env, 'answerCallbackQuery', { callback_query_id: callback.id, text: ['home','list','guide','render','demo','updates','publish','edit','delete','quota','bcstgo','bcstno','templates','help','about','tpl'].includes(action) ? undefined : `Callback: ${callback.data || ''}` });
    if (action === 'quota') return quotaPanel(env, chatId, lang, origin, message.message_id);
    const parts = (callback.data || '').split(':');
    if (action === 'admp') return adminList(env, chatId, lang, origin, Number(parts[2]) || 0);
    if (action === 'adm') return adminUser(env, chatId, lang, origin, parts[2], Number(parts[3]) || 0);
    if (action === 'admx') return adminAction(env, chatId, lang, origin, parts[2], parts[3], Number(parts[4]) || 0);
    if (action === 'bcstgo') return broadcastRun(env, chatId, lang, origin);
    if (action === 'bcstno') { await env.RICHKV.delete('bcast:' + chatId); return plain(env, chatId, lang === 'fa' ? '❌ ارسال همگانی لغو شد.' : '❌ Broadcast cancelled.', back(lang, origin)); }
    if (action === 'home') return home(env, chatId, lang, origin, message.message_id);
    if (action === 'templates') return templatesPanel(env, chatId, lang, origin, message.message_id);
    if (action === 'help') return sendList(env, chatId, lang, 'Rich text', 0, origin, message.message_id);
    if (action === 'about') return aboutPanel(env, chatId, lang, origin, message.message_id);
    if (action === 'tpl') {
      await telegram(env, 'answerCallbackQuery', { callback_query_id: callback.id, text: lang === 'fa' ? 'داخل استودیو باز کن و قالب را انتخاب کن' : 'Open the studio and pick it there' });
      const tpl = TEMPLATES.find((x) => x.id === arg);
      return plain(env, chatId, `<b>${tpl ? tpl.icon + ' ' + (lang === 'fa' ? tpl.fa : tpl.en) : 'Template'}</b>\n\n` + (lang === 'fa' ? 'استودیو را باز کن، از نوار قالب‌ها همین را بزن؛ محتوای آماده روی بوم می‌نشیند.' : 'Open the studio and tap it in the template strip; the content lands on your canvas.'), { inline_keyboard: [[{ text: lang === 'fa' ? '✨ باز کردن استودیو' : '✨ Open studio', web_app: { url: origin }, style: 'primary' }], [{ text: lang === 'fa' ? '← قالب‌ها' : '← Templates', callback_data: `templates:${lang}` }, { text: lang === 'fa' ? '🏠 منو' : '🏠 Menu', callback_data: `home:${lang}` }]] }, message.message_id);
    }
    if (action === 'list') return sendList(env, chatId, lang, ['Rich text','Blocks','Media'].includes(arg) ? arg : 'Rich text', Number(page) || 0, origin, message.message_id);
    if (action === 'guide') return sendGuide(env, chatId, lang, Number(arg), origin, message.message_id);
    if (action === 'render') {
      const guide = guides[Number(arg)];
      if (guide) return telegram(env, 'sendRichMessage', { chat_id: chatId, rich_message: { markdown: guide.code }, reply_markup: back(lang, origin) });
    }
    if (action === 'demo') return sendDemo(env, chatId, lang, Number(arg) || 0, origin, message.message_id);
    if (action === 'updates') return sendUpdates(env, chatId, lang, origin, message.message_id);
    if (action === 'dest') return destPanel(env, chatId, lang, origin, message.message_id);
    if (action === 'joinadd') {
      try {
        const chat = await telegram(env, 'getChat', { chat_id: Number(arg) });
        const list = await joinList(env);
        if (!list.some((t) => String(t.id) === String(chat.id))) {
          list.push({ id: chat.id, title: chat.title || chat.username || String(chat.id), type: chat.type, username: chat.username || '', invite: chat.invite_link || '' });
          await saveJoinList(env, list);
        }
        return joinPanel(env, chatId, lang, origin, message.message_id);
      } catch (e) { return plain(env, chatId, `⛔ ${e.message}`, undefined, message.message_id); }
    }
    if (action === 'joinrm') {
      const list = await joinList(env);
      const idx = Number(arg);
      if (Number.isInteger(idx) && idx >= 0 && idx < list.length) { list.splice(idx, 1); await saveJoinList(env, list); }
      return joinPanel(env, chatId, lang, origin, message.message_id);
    }
    if (action === 'users') return adminList(env, chatId, lang, origin);
    if (action === 'settings') return settingsPanel(env, chatId, lang, origin, message.message_id);
    if (action === 'aiset') return aiPanel(env, chatId, lang, origin, message.message_id);
    if (action === 'join') return joinPanel(env, chatId, lang, origin, message.message_id);
    if (action === 'destuse') {
      try {
        const f = await telegram(env, 'getChat', { chat_id: Number(arg) });
        const rec = { id: f.id, title: f.title || f.username || String(f.id), type: f.type, username: f.username || '' };
        await writeDest(env, chatId, rec);
        const ok = lang === 'fa' ? `✅ مقصد روی <b>${rec.title}</b> تنظیم شد.` : `✅ Destination set to <b>${rec.title}</b>.`;
        return plain(env, chatId, ok, { inline_keyboard: [[{ text: lang === 'fa' ? '🎯 مقصد ارسال' : '🎯 Destination', callback_data: `dest:${lang}` }, { text: lang === 'fa' ? '🏠 منو' : '🏠 Menu', callback_data: `home:${lang}` }]] }, message.message_id);
      } catch (e) {
        return plain(env, chatId, `⛔ ${e.message}`, undefined, message.message_id);
      }
    }
    if (action === 'destclear') {
      await writeDest(env, chatId, null);
      return destPanel(env, chatId, lang, origin, message.message_id);
    }
    if (action === 'publish' && await readDest(env, chatId)) {
      const d = await readDest(env, chatId);
      const q = await quotaStatus(env, chatId);
      if (!q.ok) return quotaExhausted(env, chatId, lang, origin, q.used, q.limit, q.blocked);
      await telegram(env, 'copyMessage', { chat_id: d.id, from_chat_id: chatId, message_id: message.message_id });
      await addUsed(env, chatId);
      await bumpStats(env, { sends: 1, channel: 1 });
      const fa = lang === 'fa';
      return plain(env, chatId, fa ? `✅ پست در <b>${d.title}</b> منتشر شد.` : `✅ Published to <b>${d.title}</b>.`, { inline_keyboard: [
        [{ text: fa ? '🎯 تغییر مقصد' : '🎯 Change destination', callback_data: `dest:${lang}` }],
        [{ text: fa ? '🏠 منو' : '🏠 Menu', callback_data: `home:${lang}` }, { text: fa ? '✨ استودیو' : '✨ Studio', web_app: { url: origin }, style: 'primary' }]
      ] });
    }
    if (action === 'publish' || action === 'edit') {
      const label = action === 'publish' ? (lang === 'fa' ? 'آدرس @کانال یا شناسه -100… را در پاسخ بفرستید. شما و ربات باید مدیر باشید.' : 'Reply with the destination @channel or -100… ID. You and the bot must be administrators.') : (lang === 'fa' ? 'متن جدید HTML یا Markdown را در پاسخ بفرستید.' : 'Reply with your replacement HTML or Markdown.');
      return plain(env, chatId, `${label}\n\n<code>TR:${action}:${arg}:${lang}</code>`, { force_reply: true, selective: true });
    }
    if (action === 'delete') {
      await telegram(env, 'deleteMessage', { chat_id: chatId, message_id: Number(arg) });
      return home(env, chatId, lang, origin);
    }
    return;
  }
  if (message.forward_from_chat && message.forward_from_chat.type !== 'private' && !(message.text || '').startsWith('/')) {
    const f = message.forward_from_chat;
    const fa = detectedLang === 'fa';
    return plain(env, chatId,
      fa ? `🎯 این پیام از <b>${f.title || f.username || f.id}</b> فوروارد شده.\n\nمی‌خواهی این گروه/کانال مقصد ارسال شود؟`
         : `🎯 Forwarded from <b>${f.title || f.username || f.id}</b>.\n\nMake it your delivery destination?`,
      { inline_keyboard: [
        [{ text: fa ? '🎯 مقصد ارسال' : '🎯 Delivery destination', callback_data: `destuse:${detectedLang}:${f.id}` },
         { text: fa ? '🔒 جوین اجباری' : '🔒 Forced join', callback_data: `joinadd:${detectedLang}:${f.id}` }],
        [{ text: fa ? '🏠 انصراف' : '🏠 Cancel', callback_data: `home:${detectedLang}` }]
      ] }, origin);
  }
  const text = message.text || '';
  const command = text.split(' ')[0];
  const board = { '✨ ساخت پست': 'studio', '✨ Create a post': 'studio', '🎨 قالب‌ها': 'templates', '🎨 Templates': 'templates', '📚 راهنما': 'help', '📚 Guides': 'help', '🎁 سهمیه': 'quota', '🎁 Quota': 'quota' };
  if (board[text.trim()]) {
    const want = board[text.trim()];
    if (want === 'studio') return plain(env, chatId, detectedLang === 'fa' ? '✨ استودیو را باز کن؛ از دکمهٔ زیر شروع کن.' : '✨ Open the studio from the button below.', { inline_keyboard: [[{ text: detectedLang === 'fa' ? '✨ باز کردن استودیو' : '✨ Open studio', web_app: { url: origin }, style: 'primary' }]] });
    if (want === 'templates') return templatesPanel(env, chatId, detectedLang, origin);
    if (want === 'help') return sendList(env, chatId, detectedLang, 'Rich text', 0, origin);
    if (want === 'quota') return quotaPanel(env, chatId, detectedLang, origin);
  }
  if (command === '/start') {
    await telegram(env, 'sendMessage', { chat_id: chatId, text: detectedLang === 'fa' ? 'دکمه‌های زیر همیشه در دسترس‌اند 👇' : 'These buttons stay within reach 👇', reply_markup: replyBoard(detectedLang, origin) });
    return home(env, chatId, detectedLang, origin);
  }
  if (['/help','/post'].includes(command)) return home(env, chatId, detectedLang, origin);
  if (command === '/ref') return quotaPanel(env, chatId, detectedLang, origin);
  if (command === '/stats') return quotaExempt(env, chatId) ? statsReport(env, chatId, detectedLang, origin) : quotaPanel(env, chatId, detectedLang, origin);
  if (command === '/admin') return quotaExempt(env, chatId) ? adminList(env, chatId, detectedLang, origin) : plain(env, chatId, '<b>⛔ فقط مالک ربات.</b>', back(detectedLang, origin));
  if (command === '/broadcast') return quotaExempt(env, chatId) ? broadcastPrompt(env, chatId, detectedLang, origin) : plain(env, chatId, '<b>⛔ فقط مالک ربات.</b>', back(detectedLang, origin));
  if (command === '/key' || command === '/model' || command === '/ai') {
    if (!quotaExempt(env, chatId)) return plain(env, chatId, '<b>⛔ فقط مالک ربات</b>', origin);
    const uid = String(user?.id || chatId);
    const rest = (message.text || '').trim().slice(command.length).trim();
    const first = rest.split(/\s+/)[0] || '';
    const aliasMap = { google: 'gemini', gemini: 'gemini', xai: 'xai', grok: 'xai', openrouter: 'openrouter', groq: 'groq', deepseek: 'deepseek' };
    const named = aliasMap[first.toLowerCase()];
    try {
      if (command === '/ai') {
        const cfg = await aiConfig(env, uid);
        const rows = cfg.providers.map((p) => `\u2022 <code>${p.id}</code> — ${p.label} (${p.model})`).join('\n');
        return plain(env, chatId, `<b>🤖 هوش مصنوعی</b>\n\nسرویس: <code>${cfg.provider}</code>\nمدل: <code>${cfg.model}</code>\nکلید: ${cfg.hasKey ? '✅ ثبت شده' : '⛔ ثبت نشده'}\n\n${rows}\n\nثبت کلید:\n<code>/key gemini AIza...</code>\nمدل دیگر:\n<code>/model gemini-2.5-flash</code>`, origin);
      }
      if (command === '/model') {
        if (!rest) return plain(env, chatId, 'مثال: <code>/model gemini-2.5-flash</code>', origin);
        const saved = (await env.RICHKV.get('ai:' + uid, 'json')) || {};
        const r = await aiSave(env, uid, { provider: saved.provider || 'gemini', model: rest });
        return plain(env, chatId, `✅ مدل روی <code>${r.model}</code> تنظیم شد.`, origin);
      }
      const chosen = named || ((await env.RICHKV.get('ai:' + uid, 'json')) || {}).provider || 'gemini';
      const keyArg = named ? rest.slice(first.length).trim() : rest;
      if (!keyArg) return plain(env, chatId, 'کلید را بعد از نام سرویس بفرست:\n<code>/key gemini AIza...</code>', origin);
      const r = await aiSave(env, uid, { provider: chosen, key: keyArg });
      const warn = r.warning ? `\n\n⚠️ ${r.warning}` : '';
      return plain(env, chatId, `✅ کلید برای <b>${r.provider}</b> ثبت شد.\nمدل: <code>${r.model}</code>\n\nبرای آزمایش بنویس <code>/aitest</code>.${warn}`, origin);
    } catch (e) {
      return plain(env, chatId, `⛔ ${e.message}`, origin);
    }
  }
  if (command === '/aitest') {
    if (!quotaExempt(env, chatId)) return plain(env, chatId, '<b>⛔ فقط مالک ربات</b>', origin);
    const uid = String(user?.id || chatId);
    await plain(env, chatId, '⏳ در حال تماس با مدل…', origin);
    try { const r = await aiTest(env, uid); return plain(env, chatId, `✅ پاسخ مدل: <code>${r.reply}</code>`, origin); }
    catch (e) { return plain(env, chatId, `⛔ ${e.message}`, origin); }
  }
  if (command === '/dest') {
    const arg = (message.text || '').trim().slice(5).trim();
    const fa = detectedLang === 'fa';
    if (!arg) return destPanel(env, chatId, detectedLang, origin);
    if (arg === 'off' || arg === 'clear') { await writeDest(env, chatId, null); return destPanel(env, chatId, detectedLang, origin); }
    if (!/^(@[A-Za-z][\w]{3,}|-100\d+)$/.test(arg)) return plain(env, chatId, fa ? 'قالب درست نیست. مثال: <code>/dest @mygroup</code> یا <code>/dest -1001234567890</code>' : 'Wrong format. Example: <code>/dest @mygroup</code>', origin);
    try {
      const chat = await authorizeChat(env, { operator: false, user }, arg);
      const rec = { id: chat.id, title: chat.title || chat.username || String(chat.id), type: chat.type, username: chat.username || '' };
      await writeDest(env, chatId, rec);
      return plain(env, chatId, fa ? `✅ مقصد روی <b>${rec.title}</b> تنظیم شد.\nاز این به بعد پست‌ها همین‌جا منتشر می‌شوند.` : `✅ Destination set to <b>${rec.title}</b>.`, { inline_keyboard: [[{ text: fa ? '🏠 منو' : '🏠 Menu', callback_data: `home:${detectedLang}` }]] }, origin);
    } catch (e) {
      return plain(env, chatId, `⛔ ${e.message}`, origin);
    }
  }
  if (command === '/join') {
    const arg = (message.text || '').trim().slice(5).trim();
    const fa = detectedLang === 'fa';
    if (!arg) return joinPanel(env, chatId, detectedLang, origin);
    if (arg === 'off' || arg === 'reset') { await saveJoinList(env, []); return joinPanel(env, chatId, detectedLang, origin); }
    if (!/^(@[A-Za-z][\w]{3,}|-100\d+)$/.test(arg)) return plain(env, chatId, fa ? 'قالب درست نیست. مثال: <code>/join @mygroup</code>' : 'Wrong format.', origin);
    try {
      const chat = await telegram(env, 'getChat', { chat_id: arg });
      const list = await joinList(env);
      if (!list.some((t) => String(t.id) === String(chat.id))) {
        list.push({ id: chat.id, title: chat.title || chat.username || String(chat.id), type: chat.type, username: chat.username || '', invite: chat.invite_link || '' });
        await saveJoinList(env, list);
      }
      return joinPanel(env, chatId, detectedLang, origin);
    } catch (e) { return plain(env, chatId, `⛔ ${e.message}`, origin); }
  }
  if (command === '/emoji' || command === '/emojipack') {
    if (!(await quotaExempt(env, chatId))) return plain(env, chatId, detectedLang === 'fa' ? '🔒 این دستور برای مدیر است.' : '🔒 Owner only.', back(detectedLang, origin));
    const arg = text.replace(/^\/emoji(pack)?(@\S+)?\s*/i, '').trim();
    const fa = detectedLang === 'fa';
    if (!arg) {
      const { packs, total } = await emojiPacks(env, chatId);
      const lines = packs.length
        ? packs.map((p, i) => `${i + 1}. <b>${escape(p.title || p.name)}</b> · ${p.emojis.length}`).join('\n')
        : (fa ? 'هنوز پکی اضافه نشده.' : 'No packs yet.');
      return plain(env, chatId, (fa
        ? `✨ <b>پک‌های ایموجی پرمیوم</b>\n\n${lines}\n\n📦 ${total} ایموجی در ${packs.length} پک\n\nبرای افزودن، لینک پک را بفرست:\n<code>/emoji https://t.me/addemoji/PackName</code>`
        : `✨ <b>Premium emoji packs</b>\n\n${lines}\n\n📦 ${total} emoji in ${packs.length} packs\n\nTo add one, send its link:\n<code>/emoji https://t.me/addemoji/PackName</code>`),
        back(detectedLang, origin));
    }
    try {
      const added = await emojiAddPack(env, chatId, { pack: arg }, telegram);
      resetPremiumCache();
      const { total } = await emojiPacks(env, chatId);
      return plain(env, chatId, fa
        ? `✅ پک اضافه شد: <b>${escape(String(arg).replace(/^https?:\/\/t\.me\/addemoji\//, ''))}</b>\n\n📦 حالا ${total} ایموجی داری. از این به بعد روی متن و روی همهٔ دکمه‌ها اعمال می‌شود.`
        : `✅ Pack added: <b>${escape(String(arg).replace(/^https?:\/\/t\.me\/addemoji\//, ''))}</b>\n\n📦 ${total} emoji now. They apply to text and to every button.`,
        back(detectedLang, origin));
    } catch (error) {
      return plain(env, chatId, fa
        ? `⚠️ نشد اضافه کنم: ${escape(error.message)}\n\nلینک درست شکل <code>https://t.me/addemoji/Name</code> است و ربات باید به آن پک دسترسی داشته باشد.`
        : `⚠️ Could not add it: ${escape(error.message)}\n\nA valid link looks like <code>https://t.me/addemoji/Name</code>, and the bot must be able to see that pack.`,
        back(detectedLang, origin));
    }
  }
  if (command === '/about') return plain(env, chatId, '<b>Tele Rich 7x</b>\n\n<a href="https://t.me/Rich7xbot">@Rich7xbot</a>\n<a href="https://t.me/Config7x">@Config7x</a>', back(detectedLang, origin));
  if (command === '/whoami') return sendWhoami(env, chatId, detectedLang, origin, user);
  if (command === '/guide' || command === '/markdown') return sendList(env, chatId, detectedLang, 'Rich text', 0, origin);
  if (command === '/html') return sendList(env, chatId, detectedLang, 'Blocks', 0, origin);
  if (command === '/media') return sendList(env, chatId, detectedLang, 'Media', 0, origin);
  if (command === '/buttons') { const i = guideIndexByName('RichBlockButtons'); return i >= 0 ? sendGuide(env, chatId, detectedLang, i, origin) : sendList(env, chatId, detectedLang, 'Blocks', 0, origin); }
  if (command === '/table') { const i = guideIndexByName('RichBlockTable'); return i >= 0 ? sendGuide(env, chatId, detectedLang, i, origin) : sendList(env, chatId, detectedLang, 'Blocks', 0, origin); }
  if (command === '/demo') return sendDemo(env, chatId, detectedLang, 0, origin);
  if (command === '/updates') return sendUpdates(env, chatId, detectedLang, origin);
  if (command === '/webapp') return sendWebapp(env, chatId, detectedLang, origin);
  const reply = message.reply_to_message;
  const bcastMarker = reply?.from?.is_bot && reply.text?.match(/TR:bcast:0:(en|fa)/);
  if (bcastMarker) {
    const [, blang] = bcastMarker;
    if (!quotaExempt(env, chatId)) return plain(env, chatId, '<b>⛔ فقط مالک ربات.</b>', back(blang, origin));
    if (!text.trim()) return plain(env, chatId, blang === 'fa' ? '⛔ متنی نفرستادی؛ دوباره /broadcast بزن.' : '⛔ No text sent; run /broadcast again.', back(blang, origin));
    return broadcastPreview(env, chatId, blang, origin, text);
  }
  const quotaMarker = reply?.from?.is_bot && reply.text?.match(/TR:quota:(\d{1,12}):(en|fa):(\d+)/);
  if (quotaMarker) {
    const [, qid, qlang, qpage] = quotaMarker;
    if (!quotaExempt(env, chatId)) return plain(env, chatId, '<b>⛔ فقط مالک ربات.</b>', back(qlang, origin));
    const digits = String(text).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
    const m = /^([+-]?)\s*(\d{1,6})\s*$/.exec(digits.trim());
    if (!m) return plain(env, chatId, qlang === 'fa' ? '⛔ عدد معتبری نفرستادی؛ مثلاً <code>50</code> یا <code>-30</code> (اعداد فارسی هم قبوله).' : '⛔ Send a valid number, e.g. <code>50</code> or <code>-30</code>.', back(qlang, origin));
    const delta = Number((m[1] || '+') + m[2]);
    const rec = await userRec(env, qid);
    rec.bonus = Math.max(0, (rec.bonus || 0) + delta);
    await env.RICHKV.put('u:' + qid, JSON.stringify(rec));
    const fa2 = qlang === 'fa';
    const note = fa2
      ? (delta > 0 ? `✅ ${delta} سهمیه به حساب شما اضافه شد.` : `✅ ${Math.abs(delta)} سهمیه از حساب شما کم شد.`)
      : (delta > 0 ? `✅ Your quota was increased by ${delta} messages.` : `✅ Your quota was reduced by ${Math.abs(delta)} messages.`);
    try { await telegram(env, 'sendMessage', { chat_id: Number(qid), text: note, parse_mode: 'HTML' }); } catch (e) { /* user may have blocked the bot */ }
    return adminUser(env, chatId, qlang, origin, qid, Number(qpage) || 0);
  }
  const marker = reply?.from?.is_bot && reply.text?.match(/TR:(publish|edit):(\d+):(en|fa)/);
  if (marker) {
    const [, action, messageId, lang] = marker;
    if (action === 'publish') {
      if (!/^(@[A-Za-z][\w]{3,}|-100\d+)$/.test(text.trim())) throw fail('Reply with a valid @channel or -100… identifier.');
      const target = await authorizeChat(env, { operator: false, user }, text.trim());
      const q = await quotaStatus(env, user.id);
      if (!q.ok) return quotaExhausted(env, chatId, lang, origin, q.used, q.limit, q.blocked);
      await telegram(env, 'copyMessage', { chat_id: target.id, from_chat_id: chatId, message_id: Number(messageId) });
      await addUsed(env, user.id);
      await bumpStats(env, { sends: 1, channel: 1 });
      return plain(env, chatId, lang === 'fa' ? '✅ پست منتشر شد.' : '✅ Your post is published.', back(lang, origin));
    }
    return telegram(env, 'editMessageText', { chat_id: chatId, message_id: Number(messageId), rich_message: reconstruct(message) });
  }
  if (!text.trim()) return plain(env, chatId, detectedLang === 'fa' ? 'برای مدیا، دکمه و چیدمان پیشرفته، استودیو را باز کنید.' : 'Open the studio to add media, buttons and advanced layouts.', back(detectedLang, origin));
  // Rendering in your own bot chat is free; quota charges only real publishes (TR:publish / channels).
  const sent = await telegram(env, 'sendRichMessage', { chat_id: chatId, rich_message: withFooter(validateRich(reconstruct(message))) });
  await bumpStats(env, { sends: 1 });
  return sent;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const permitted = !env.ALLOWED_ORIGIN || origin === env.ALLOWED_ORIGIN || origin === url.origin;
    const cors = { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN ? (permitted ? origin || url.origin : url.origin) : '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Telegram-Init-Data', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' };
    if (request.method === 'OPTIONS') return new Response(null, { status: permitted ? 204 : 403, headers: cors });
    if (url.pathname === '/webhook') {
      if (request.method !== 'POST') return new Response('POST required', { status: 405 });
      const received = request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';
      if (!env.WEBHOOK_SECRET || !await equal(received, env.WEBHOOK_SECRET)) return new Response('Unauthorized', { status: 401 });
      let update;
      try { update = await request.json(); } catch { return new Response('Invalid update', { status: 400 }); }
      ctx.waitUntil(onUpdate(update, env, (env.PUBLIC_URL || url.origin) + '?v=20261105e').catch(async error => {
        // Log no tokens or source content. User-facing API errors help diagnose unsupported markup/media.
        console.error('TeleRich update error:', error.message);
        const chat = update.message?.chat || update.callback_query?.message?.chat;
        if (chat?.type === 'private') {
          try { await plain(env, chat.id, `⚠️ ${escape(error.message)}\n\n/help — menu / راهنما`); } catch { /* Telegram may be unavailable; keep webhook acknowledged. */ }
        }
      }));
      return new Response('OK');
    }
    if (request.method === 'GET' && url.pathname === '/telegram-web-app.js') {
      return new Response(telegramWebAppJs, { headers: { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=604800' } });
    }
    if (url.pathname.startsWith('/api/')) {
      if (!permitted) return result({ ok: false, description: 'Origin not allowed.' }, 403, cors);
      try { return result({ ok: true, result: await webApi(request, env, url) }, 200, cors); }
      catch (error) { console.error('TeleRich api error:', error.status || 500, error.message); return result({ ok: false, description: error.message || 'Request failed.' }, error.status || 500, cors); }
    }
    if (request.method === 'GET' && url.pathname === '/') return new Response(html, { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0', 'Pragma': 'no-cache', 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Cache-Control': 'no-cache' } });
    return new Response('Not found', { status: 404 });
  }
};
