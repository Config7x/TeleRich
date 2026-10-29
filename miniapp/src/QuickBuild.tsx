import { useMemo, useState, useRef } from 'react';
import { Zap, Sparkles, ArrowLeft, ArrowRight, Check, Loader2, Type, ListOrdered, Link2, Eye } from 'lucide-react';
import { RichPreview } from './Renderer';

/* Quick build: pick a shape, fill three or four fields, hand it to the studio.
   Everything it writes is plain Telegram HTML, so the studio stays the source of
   truth and the user can keep editing after the hand-over. */

type Kind = {
  key: string; label: [string, string]; hint: [string, string]; emoji: string;
  fields: ('title' | 'desc' | 'items' | 'before' | 'after' | 'quote' | 'buttonLabel' | 'buttonUrl')[];
};

const KINDS: Kind[] = [
  { key: 'sale', label: ['Offer and discount', 'پیشنهاد و تخفیف'], hint: ['Price, what is included, buy button', 'قیمت، موارد شامل و دکمهٔ خرید'], emoji: '🎁', fields: ['title', 'desc', 'before', 'after', 'items', 'buttonLabel', 'buttonUrl'] },
  { key: 'news', label: ['News and notice', 'خبر و اطلاعیه'], hint: ['Headline, summary, key points', 'تیتر، خلاصه و نکته‌های مهم'], emoji: '📣', fields: ['title', 'desc', 'items', 'quote', 'buttonLabel', 'buttonUrl'] },
  { key: 'guide', label: ['Step by step', 'آموزش گام‌به‌گام'], hint: ['Numbered steps and one tip', 'مراحل شماره‌دار و یک نکته'], emoji: '🧭', fields: ['title', 'desc', 'items', 'buttonLabel', 'buttonUrl'] },
  { key: 'pricing', label: ['Price list', 'لیست قیمت'], hint: ['Plan table and an order button', 'جدول پلن‌ها و دکمهٔ سفارش'], emoji: '💳', fields: ['title', 'desc', 'items', 'buttonLabel', 'buttonUrl'] },
  { key: 'invite', label: ['Channel invite', 'دعوت به کانال'], hint: ['Short message with a join button', 'یک پیام کوتاه با دکمهٔ عضویت'], emoji: '📌', fields: ['title', 'desc', 'buttonLabel', 'buttonUrl'] },
  { key: 'update', label: ['Product update', 'آپدیت محصول'], hint: ['Version, changes, download', 'نسخه، تغییرها و دکمهٔ دریافت'], emoji: '🚀', fields: ['title', 'desc', 'items', 'buttonLabel', 'buttonUrl'] },
  { key: 'blank', label: ['From scratch', 'از صفر'], hint: ['Just a text and a button', 'فقط یک متن و دکمه'], emoji: '✨', fields: ['title', 'desc', 'buttonLabel', 'buttonUrl'] },
];

const LABELS: Record<string, [string, string]> = {
  title: ['Title', 'تیتر'],
  desc: ['One line of description', 'یک خط توضیح'],
  items: ['One item per line', 'هر خط یک مورد'],
  before: ['Price before', 'قیمت قبلی'],
  after: ['Price now', 'قیمت با تخفیف'],
  quote: ['A quoted line (optional)', 'جملهٔ نقل‌شده (اختیاری)'],
  buttonLabel: ['Button label', 'متن دکمه'],
  buttonUrl: ['Button link', 'لینک دکمه'],
};

const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lines = (s: string) => (s || '').split('\n').map(x => x.trim()).filter(Boolean);

export default function QuickBuild({lang, generate, onApply, onEmoji}:{
  lang: 'en' | 'fa';
  generate: (topic: string, kind: string) => Promise<string>;
  onApply: (html: string) => void;
  onEmoji: () => void;
}){
  const fa = lang === 'fa';
  const T = (en: string, p: string) => (fa ? p : en);
  const [step, setStep] = useState(0);
  const [kindKey, setKindKey] = useState('sale');
  const [data, setData] = useState<Record<string, Record<string, string>>>({});
  const [topic, setTopic] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [aiHtml, setAiHtml] = useState('');
  const area = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const kind = KINDS.find(k => k.key === kindKey) || KINDS[0];
  const v = data[kindKey] || {};
  const set = (f: string, val: string) => setData(d => ({ ...d, [kindKey]: { ...(d[kindKey] || {}), [f]: val } }));

  const html = useMemo(() => {
    if (aiHtml) return aiHtml;
    const title = v.title || (fa ? 'عنوان پست' : 'Your title');
    const out: string[] = [`<b>${esc(title)}</b>`];
    if (v.desc) out.push(esc(v.desc));
    if (kind.fields.includes('before') || kind.fields.includes('after')) {
      out.push(`<blockquote>${T('Price before', 'قیمت قبلی')}: <b>${esc(v.before || '—')}</b>\n${T('Price now', 'قیمت با تخفیف')}: <b>${esc(v.after || '—')}</b></blockquote>`);
    }
    const items = lines(v.items || '');
    if (items.length) {
      out.push(items.map((x, i) => (kindKey === 'guide' ? `${i + 1}. ${esc(x)}` : kindKey === 'pricing' ? `• ${esc(x)}` : `• ${esc(x)}`)).join('\n'));
    }
    if (v.quote) out.push(`<blockquote>${esc(v.quote)}</blockquote>`);
    if (v.buttonLabel) {
      const url = /^https?:\/\//i.test(v.buttonUrl || '') ? v.buttonUrl : 'https://t.me/rich7xapp';
      out.push(`<tg-button-row align="center">\n  <button url="${esc(url)}" style="success">${esc(v.buttonLabel)}</button>\n</tg-button-row>`);
    }
    return out.join('\n\n');
  }, [v, kindKey, aiHtml, fa]);

  const wrap = (f: string, open: string, close: string) => {
    const el = area.current[f];
    const text = (v[f] || '');
    if (!el) { set(f, text + open + close); return; }
    const a = el.selectionStart ?? text.length, b = el.selectionEnd ?? a;
    const picked = text.slice(a, b) || (fa ? 'متن' : 'text');
    set(f, text.slice(0, a) + open + picked + close + text.slice(b));
    requestAnimationFrame(() => { el.focus(); const p = a + open.length + picked.length; el.setSelectionRange(p, p); });
  };

  async function ask() {
    if (!topic.trim()) { setMsg(T('Write the topic first.', 'اول موضوع را بنویس.')); return; }
    setBusy(true); setMsg('');
    try {
      const made = await generate(topic.trim(), kind.label[fa ? 1 : 0]);
      setAiHtml(made); setStep(2);
      setMsg(T('Draft ready. Fix anything you like, then hand it to the studio.', 'پیش‌نویس آماده شد. هر چه خواستی تغییر بده، بعد به استودیو بفرست.'));
    } catch (e: any) { setMsg(String(e.message || e)); } finally { setBusy(false); }
  }

  return <div className="qb" dir={fa ? 'rtl' : 'ltr'}>
    <header className="qb-head">
      <span className="qb-eyebrow"><Zap size={13}/>{T('Quick build · no code', 'ساخت سریع · بدون کد')}</span>
      <h2>{T('A finished post in three steps', 'در سه قدم یک پست حرفه‌ای بساز')}</h2>
      <p>{T('Pick the shape, write the topic, we handle the tags and the buttons.', 'نوع پست را انتخاب کن، موضوع را بنویس؛ تگ و دکمه‌ها با ما.')}</p>
      <ol className="qb-steps">{[T('Post type', 'نوع پست'), T('Writing', 'نوشتن'), T('Deliver', 'تحویل')].map((s, i) =>
        <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''} onClick={() => setStep(i)}>{i < step ? <Check size={12}/> : <em>{i + 1}</em>}{s}</li>)}
      </ol>
    </header>

    {step === 0 && <div className="qb-kinds">{KINDS.map(k =>
      <button key={k.key} className={'qb-kind ' + (kindKey === k.key ? 'on' : '')} onClick={() => { setKindKey(k.key); setAiHtml(''); setStep(1); }}>
        <span>{k.emoji}</span><strong>{k.label[fa ? 1 : 0]}</strong><small>{k.hint[fa ? 1 : 0]}</small>
      </button>)}
    </div>}

    {step === 1 && <div className="qb-form">
      <div className="qb-tools">
        <button className="text-button" onClick={() => wrap('desc', '<b>', '</b>')}><Type size={13}/>{T('Bold', 'بولد')}</button>
        <button className="text-button" onClick={() => wrap('desc', '<i>', '</i>')}><Type size={13}/>{T('Italic', 'ایتالیک')}</button>
        <button className="text-button" onClick={() => wrap('desc', '<blockquote>', '</blockquote>')}><ListOrdered size={13}/>{T('Highlight', 'هایلایت')}</button>
        <button className="text-button" onClick={onEmoji}><Sparkles size={13}/>{T('Premium emoji', 'ایموجی پریمیوم')}</button>
      </div>
      {kind.fields.map(f => <label key={f} className="qb-field">
        <span>{LABELS[f][fa ? 1 : 0]}</span>
        {f === 'desc' || f === 'items' || f === 'quote'
          ? <textarea ref={(el) => { area.current[f] = el; }} rows={f === 'desc' ? 2 : 4} value={v[f] || ''} onChange={e => { set(f, e.target.value); setAiHtml(''); }} placeholder={f === 'items' ? T('Unlimited traffic\nThree devices\n24h support', 'حجم نامحدود\nسه دستگاه هم‌زمان\nپشتیبانی ۲۴ ساعته') : ''}/>
          : <input dir={f === 'buttonUrl' ? 'ltr' : undefined} value={v[f] || ''} onChange={e => { set(f, e.target.value); setAiHtml(''); }} placeholder={f === 'buttonUrl' ? 'https://t.me/rich7xapp' : f === 'before' ? T('390,000', '۳۹۰٬۰۰۰ تومان') : f === 'after' ? T('249,000', '۲۴۹٬۰۰۰ تومان') : f === 'buttonLabel' ? T('Get it now', 'همین حالا بگیر') : ''}/>}
      </label>)}
      <div className="qb-ai">
        <label className="qb-field"><span><Sparkles size={13}/>{T('Or let AI write it', 'یا بگذار AI بنویسد')}</span>
          <input value={topic} onChange={e => setTopic(e.target.value)} placeholder={T('e.g. 40% off the three-month plan until Friday', 'مثلاً: تخفیف ۴۰٪ اشتراک سه‌ماهه تا جمعه')}/>
        </label>
        <button className="button primary" onClick={ask} disabled={busy}>{busy ? <Loader2 size={15} className="spin"/> : <Sparkles size={15}/>}{T('Write it for me', 'برایش بنویس')}</button>
      </div>
      {msg && <p className="qb-note">{msg}</p>}
      <div className="qb-actions">
        <button className="button subtle" onClick={() => setStep(0)}><ArrowRight size={15}/>{T('Back', 'مرحله قبل')}</button>
        <button className="button secondary" onClick={() => setStep(2)}><Eye size={15}/>{T('Preview', 'پیش‌نمایش')}</button>
      </div>
    </div>}

    {step === 2 && <div className="qb-final">
      <div className="qb-preview"><RichPreview source={html} mode="html" rtl={fa ? 'rtl' : 'ltr'}/></div>
      <div className="qb-meta">{html.length} {T('characters of 32,768', 'نویسه از ۳۲٬۷۶۸')}</div>
      {msg && <p className="qb-note">{msg}</p>}
      <div className="qb-actions">
        <button className="button subtle" onClick={() => { setStep(1); setAiHtml(''); }}><ArrowRight size={15}/>{T('Edit content', 'ویرایش محتوا')}</button>
        <button className="button primary" onClick={() => onApply(html)}><ArrowLeft size={15}/>{T('Send to the studio', 'تحویل به استودیو و ارسال')}</button>
      </div>
    </div>}
  </div>;
}
