// AI drafting + premium emoji packs.
// Keys live per Telegram user in KV (ai:<uid>); an owner-level fallback
// (env.AI_KEY + env.AI_PROVIDER) makes the feature work out of the box.
export const PROVIDERS = {
  xai:      { label: 'xAI Grok',   base: 'https://api.x.ai/v1',          model: 'grok-4-fast',            keyUrl: 'console.x.ai' },
  openrouter:{ label: 'OpenRouter',base: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini',      keyUrl: 'openrouter.ai/keys' },
  groq:     { label: 'Groq',       base: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', keyUrl: 'console.groq.com/keys' },
  deepseek: { label: 'DeepSeek',   base: 'https://api.deepseek.com/v1',  model: 'deepseek-chat',          keyUrl: 'platform.deepseek.com' },
};

const SYSTEM = `You are TeleRich's post writer for a Telegram channel.
Return ONLY the post body as Telegram rich HTML: <b>, <i>, <u>, <s>, <code>, <pre>, <blockquote>, <a href>, <h1>-<h4>, <ul>, <ol>, <li>, <aside>, <details>, <summary>, <table>, <tr>, <td>, <tg-emoji emoji-id="ID">char</tg-emoji>.
No <html>, <body>, <script>, no markdown fences, no explanations. Keep lines short. Hard limit 3200 characters.`;

export async function aiConfig(env, uid) {
  const saved = (await env.RICHKV.get('ai:' + uid, 'json')) || {};
  const provider = saved.provider || env.AI_PROVIDER || 'xai';
  const meta = PROVIDERS[provider] || PROVIDERS.xai;
  return {
    provider,
    model: saved.model || meta.model,
    hasKey: Boolean(saved.key || env.AI_KEY),
    ownKey: Boolean(saved.key),
    providers: Object.entries(PROVIDERS).map(([id, p]) => ({ id, label: p.label, model: p.model, keyUrl: p.keyUrl })),
  };
}

export async function aiSave(env, uid, body) {
  const provider = String(body.provider || '').trim();
  if (!PROVIDERS[provider]) throw Object.assign(new Error('Unknown provider.'), { status: 400 });
  const rec = { provider, model: String(body.model || PROVIDERS[provider].model).slice(0, 80) };
  if (typeof body.key === 'string' && body.key.trim()) rec.key = body.key.trim().slice(0, 200);
  else { const prev = await env.RICHKV.get('ai:' + uid, 'json'); if (prev?.key) rec.key = prev.key; }
  await env.RICHKV.put('ai:' + uid, JSON.stringify(rec));
  return { saved: true, provider: rec.provider, model: rec.model, hasKey: Boolean(rec.key || env.AI_KEY) };
}

async function chat(env, uid, messages, maxTokens = 1400) {
  const saved = (await env.RICHKV.get('ai:' + uid, 'json')) || {};
  const provider = saved.provider || env.AI_PROVIDER || 'xai';
  const meta = PROVIDERS[provider] || PROVIDERS.xai;
  const key = saved.key || env.AI_KEY;
  if (!key) throw Object.assign(new Error('No AI key yet. Add one in Settings → AI.'), { status: 400 });
  const res = await fetch(meta.base + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({ model: saved.model || meta.model, messages, max_tokens: maxTokens, temperature: 0.8 }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body?.error?.message || `AI provider error ${res.status}`), { status: 400 });
  const text = body?.choices?.[0]?.message?.content || '';
  if (!text.trim()) throw Object.assign(new Error('The model returned an empty answer.'), { status: 400 });
  return text.trim();
}

export async function aiGenerate(env, uid, body) {
  const prompt = String(body.prompt || '').trim().slice(0, 2000);
  if (!prompt) throw Object.assign(new Error('Describe what the post should say.'), { status: 400 });
  const lang = body.lang === 'en' ? 'English' : 'Persian (فارسی)';
  const tone = String(body.tone || 'professional').slice(0, 40);
  const raw = await chat(env, uid, [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `Write in ${lang}, tone: ${tone}.\nBrief: ${prompt}` },
  ]);
  return { html: stripFences(raw) };
}

export async function aiTest(env, uid) {
  const raw = await chat(env, uid, [{ role: 'user', content: 'Reply with the single word: ready' }], 12);
  return { reply: raw.slice(0, 40) };
}

function stripFences(text) {
  return text.replace(/^\s*```(?:html)?\s*/i, '').replace(/```\s*$/, '').trim().slice(0, 3200);
}

/* ── premium emoji packs ─────────────────────────────────────────────── */
const MAX_PACKS = 12;

export async function emojiPacks(env, uid) {
  const packs = (await env.RICHKV.get('emo:' + uid, 'json')) || [];
  return { packs, total: packs.reduce((n, p) => n + p.emojis.length, 0) };
}

export async function emojiAddPack(env, uid, body, telegram) {
  const name = String(body.pack || '').trim().replace(/^https?:\/\/t\.me\/addemoji\//, '').replace(/^\/?addemoji\//, '');
  if (!/^[A-Za-z0-9_]{3,64}$/.test(name)) throw Object.assign(new Error('Pack name looks wrong.'), { status: 400 });
  const packs = (await env.RICHKV.get('emo:' + uid, 'json')) || [];
  if (packs.some((p) => p.name === name)) return { packs, added: false };
  if (packs.length >= MAX_PACKS) throw Object.assign(new Error(`Up to ${MAX_PACKS} packs. Remove one first.`), { status: 400 });
  const set = await telegram(env, 'getStickerSet', { name });
  const emojis = (set.stickers || [])
    .filter((s) => s.custom_emoji_id)
    .map((s) => ({ id: s.custom_emoji_id, char: s.emoji || '✨' }));
  if (!emojis.length) throw Object.assign(new Error('That set has no custom emoji.'), { status: 400 });
  packs.push({ name, title: set.title || name, emojis: emojis.slice(0, 200) });
  await env.RICHKV.put('emo:' + uid, JSON.stringify(packs));
  return { packs, added: true, count: emojis.length };
}

export async function emojiRemovePack(env, uid, body) {
  const name = String(body.pack || '');
  const packs = ((await env.RICHKV.get('emo:' + uid, 'json')) || []).filter((p) => p.name !== name);
  await env.RICHKV.put('emo:' + uid, JSON.stringify(packs));
  return { packs };
}

export const emojiTag = (id, char) => `<tg-emoji emoji-id="${String(id).replace(/\D/g, '')}">${char || '✨'}</tg-emoji>`;
