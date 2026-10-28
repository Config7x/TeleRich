// Visual block model → Bot API 10.3 rich HTML.
// The whole point: a user never types a tag. Each block is a few plain fields,
// and this file is the only place that knows how a block becomes HTML.

export type ButtonStyle = 'success' | 'primary' | 'danger';
export type ButtonType = 'url' | 'copy_text';

export interface TgButton {
  id: string;
  label: string;
  type: ButtonType;
  style: ButtonStyle;
  url?: string;
  text?: string;
}

export type Block =
  | { id: string; kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { id: string; kind: 'text'; text: string; style: 'normal' | 'bold' | 'italic' | 'mark' }
  | { id: string; kind: 'quote'; text: string; by: string; expandable: boolean }
  | { id: string; kind: 'aside'; text: string }
  | { id: string; kind: 'list'; text: string; ordered: boolean; task: boolean }
  | { id: string; kind: 'table'; rows: string[][]; header: boolean; striped: boolean; bordered: boolean }
  | { id: string; kind: 'buttons'; rows: TgButton[][] }
  | { id: string; kind: 'image'; url: string; caption: string }
  | { id: string; kind: 'divider' }
  | { id: string; kind: 'details'; summary: string; text: string }
  | { id: string; kind: 'spoiler'; text: string }
  | { id: string; kind: 'time'; unix: string; format: string; label: string }
  | { id: string; kind: 'math'; latex: string };

export const uid = () => Math.random().toString(36).slice(2, 9);

const esc = (s: string) =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const attr = (s: string) => esc(s).replace(/"/g, '&quot;');

// Text is plain by default; a few friendly marks are still accepted so power users
// are not blocked: **bold**, *italic*, ==mark==
function inline(s: string): string {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/==([^=]+)==/g, '<mark>$1</mark>')
    .replace(/(^|\s)\*([^*]+)\*/g, '$1<i>$2</i>');
}

function wrapStyle(text: string, style: string): string {
  const body = inline(text);
  if (style === 'bold') return `<b>${body}</b>`;
  if (style === 'italic') return `<i>${body}</i>`;
  if (style === 'mark') return `<mark>${body}</mark>`;
  return body;
}

function buttonHtml(b: TgButton): string {
  const style = b.style ? ` style="${attr(b.style)}"` : '';
  if (b.type === 'copy_text') {
    return `<tg-button type="copy_text"${style} text="${attr(b.text || '')}">${esc(b.label)}</tg-button>`;
  }
  return `<tg-button type="url"${style} url="${attr(b.url || '')}">${esc(b.label)}</tg-button>`;
}

export function blockToHtml(b: Block): string {
  switch (b.kind) {
    case 'heading':
      return `<h${b.level}>${inline(b.text)}</h${b.level}>`;
    case 'text':
      return `<p>${wrapStyle(b.text, b.style)}</p>`;
    case 'quote': {
      const body = inline(b.text);
      const cite = b.by ? `<cite>${inline(b.by)}</cite>` : '';
      return `<blockquote${b.expandable ? ' expandable' : ''}>${body}${cite}</blockquote>`;
    }
    case 'aside':
      return `<aside>${inline(b.text)}</aside>`;
    case 'list': {
      const lines = String(b.text || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const items = lines
        .map((l) => (b.task ? `<li><input type="checkbox" checked>${inline(l)}</li>` : `<li>${inline(l)}</li>`))
        .join('');
      return b.ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
    }
    case 'table': {
      const rows = b.rows.filter((r) => r.some((c) => String(c || '').trim() !== ''));
      if (!rows.length) return '';
      const flags = [b.bordered ? 'bordered' : '', b.striped ? 'striped' : '', 'compact'].filter(Boolean).join(' ');
      const html = rows
        .map((row, ri) => {
          const tag = b.header && ri === 0 ? 'th' : 'td';
          return `<tr>${row.map((c) => `<${tag}>${inline(c)}</${tag}>`).join('')}</tr>`;
        })
        .join('');
      return `<table${flags ? ' ' + flags : ''}>${html}</table>`;
    }
    case 'buttons': {
      const rows = b.rows.filter((r) => r.length);
      if (!rows.length) return '';
      return rows
        .map((row) => `<tg-button-row align="center">${row.map(buttonHtml).join('')}</tg-button-row>`)
        .join('\n');
    }
    case 'image':
      if (!b.url) return '';
      return `<img src="${attr(b.url)}" />${b.caption ? `\n<p><i>${inline(b.caption)}</i></p>` : ''}`;
    case 'divider':
      return '<hr/>';
    case 'details':
      return `<details><summary><b>${inline(b.summary || 'توضیح')}</b></summary>${inline(b.text)}</details>`;
    case 'spoiler':
      return `<tg-spoiler>${inline(b.text)}</tg-spoiler>`;
    case 'time':
      return `<tg-time unix="${attr(b.unix || String(Math.floor(Date.now() / 1000)))}" format="${attr(b.format || 'wDT')}">${inline(b.label || 'زمان')}</tg-time>`;
    case 'math':
      return `<tg-math>${esc(b.latex)}</tg-math>`;
    default:
      return '';
  }
}

export function blocksToHtml(blocks: Block[]): string {
  return blocks
    .map(blockToHtml)
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

export function newBlock(kind: Block['kind']): Block {
  const id = uid();
  switch (kind) {
    case 'heading': return { id, kind, level: 2, text: 'تیتر بخش' };
    case 'text': return { id, kind, text: 'متن پیام را اینجا بنویس.', style: 'normal' };
    case 'quote': return { id, kind, text: 'نقل‌قول یا نکته‌ی مهم', by: '', expandable: false };
    case 'aside': return { id, kind, text: 'جمله‌ی برجسته' };
    case 'list': return { id, kind, text: 'مورد اول\nمورد دوم\nمورد سوم', ordered: false, task: false };
    case 'table': return { id, kind, rows: [['عنوان', 'مقدار'], ['ردیف', 'داده']], header: true, striped: true, bordered: true };
    case 'buttons': return { id, kind, rows: [[{ id: uid(), label: 'کانال ما', type: 'url', style: 'primary', url: 'https://t.me/Config7x' }]] };
    case 'image': return { id, kind, url: '', caption: '' };
    case 'divider': return { id, kind };
    case 'details': return { id, kind, summary: 'بیشتر بخوانید', text: 'توضیح کامل اینجا' };
    case 'spoiler': return { id, kind, text: 'متن مخفی — ضربه بزن' };
    case 'time': return { id, kind, unix: String(Math.floor(Date.now() / 1000)), format: 'wDT', label: 'زمان' };
    case 'math': return { id, kind, latex: 'E = mc^2' };
    default: return { id, kind: 'text', text: 'متن', style: 'normal' };
  }
}

export const palette: { kind: Block['kind']; label: string; hint: string }[] = [
  { kind: 'heading', label: 'تیتر', hint: 'سرخط بخش' },
  { kind: 'text', label: 'متن', hint: 'پاراگراف ساده' },
  { kind: 'quote', label: 'نقل‌قول', hint: 'باکس متنی' },
  { kind: 'aside', label: 'برجسته', hint: 'جمله‌ی شاخص' },
  { kind: 'list', label: 'فهرست', hint: 'بولت / تیک‌باکس' },
  { kind: 'table', label: 'جدول', hint: 'ردیف و ستون' },
  { kind: 'buttons', label: 'دکمه‌ها', hint: 'دکمه رنگی' },
  { kind: 'image', label: 'عکس', hint: 'لینک تصویر' },
  { kind: 'details', label: 'بازشو', hint: 'جزئیات تاشو' },
  { kind: 'spoiler', label: 'مخفی', hint: 'اسپویلر' },
  { kind: 'time', label: 'ساعت', hint: 'زمان زنده' },
  { kind: 'math', label: 'فرمول', hint: 'ریاضی' },
  { kind: 'divider', label: 'جداکننده', hint: 'خط فاصله' },
];

// Ready-made layouts so a first-time user can publish in two taps.
export interface Template {
  id: string;
  name: string;
  icon: string;
  build: () => Block[];
}

const b = newBlock;

export const templates: Template[] = [
  {
    id: 'config',
    name: 'پست کانفیگ',
    icon: '🛰',
    build: () => [
      { ...(b('heading') as any), level: 1, text: '🌐 کانفیگ جدید' },
      { ...(b('text') as any), text: '🔋 سرعت بالا · 🛡 اتصال پایدار' },
      { ...(b('quote') as any), text: 'اسم کانفیگ\nvless://...', by: 'روی کانفیگ بزن تا کپی شود', expandable: false },
      {
        id: uid(), kind: 'buttons', rows: [[
          { id: uid(), label: '📋 کپی کانفیگ', type: 'copy_text', style: 'success', text: 'vless://...' },
          { id: uid(), label: '📥 کانفیگ بیشتر', type: 'url', style: 'primary', url: 'https://t.me/Config7x' },
        ]],
      },
    ],
  },
  {
    id: 'announce',
    name: 'اطلاعیه',
    icon: '📣',
    build: () => [
      { ...(b('heading') as any), level: 1, text: '📣 اطلاعیه مهم' },
      { ...(b('quote') as any), text: 'خلاصه‌ی خبر در یک یا دو خط.' },
      { ...(b('list') as any), text: 'مورد اول\nمورد دوم' },
      { id: uid(), kind: 'buttons', rows: [[{ id: uid(), label: 'اطلاعات بیشتر', type: 'url', style: 'primary', url: 'https://t.me/Config7x' }]] },
    ],
  },
  {
    id: 'guide',
    name: 'آموزش قدم‌به‌قدم',
    icon: '🧭',
    build: () => [
      { ...(b('heading') as any), level: 1, text: '🧭 راهنمای اتصال' },
      { ...(b('list') as any), ordered: true, text: 'اپ را نصب کن\nکانفیگ را کپی کن\nوارد کن و وصل شو' },
      { ...(b('details') as any), summary: 'اگر وصل نشد؟', text: 'یک کانفیگ دیگر امتحان کن یا با پشتیبانی تماس بگیر.' },
    ],
  },
  {
    id: 'sale',
    name: 'پیشنهاد فروش',
    icon: '🛒',
    build: () => [
      { ...(b('heading') as any), level: 1, text: '🛒 پلن ویژه' },
      { ...(b('table') as any), rows: [['پلن', 'حجم', 'قیمت'], ['برنزی', '۳۰ گیگ', '۴۹ تومان'], ['طلایی', '۱۰۰ گیگ', '۹۹ تومان']] },
      { id: uid(), kind: 'buttons', rows: [[{ id: uid(), label: '🛍 خرید', type: 'url', style: 'success', url: 'https://t.me/Rich7xbot' }]] },
    ],
  },
  {
    id: 'profile',
    name: 'معرفی پروفایل',
    icon: '👤',
    build: () => [
      { ...(b('heading') as any), level: 1, text: '👤 اکانت‌های آماده' },
      { ...(b('quote') as any), text: '👤 username\n🔑 password', by: 'روی هر خط بزن تا کپی شود' },
      { ...(b('buttons') as any), rows: [[
        { id: uid(), label: '👤 کپی یوزر', type: 'copy_text', style: 'success', text: 'username' },
        { id: uid(), label: '🔑 کپی پسورد', type: 'copy_text', style: 'danger', text: 'password' },
      ]] },
    ],
  },
  {
    id: 'blank',
    name: 'از صفر',
    icon: '✧',
    build: () => [b('heading'), b('text')],
  },
];
