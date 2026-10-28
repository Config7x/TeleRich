// Block library: every layout the studio can produce, declared once.
// Each entry is data + a renderer, so the composer can build a form for it
// automatically and the preview/export path stays a single source of truth.

export type Field = {
  k: string;
  label: string;
  type: 'text' | 'area' | 'lines' | 'grid' | 'num' | 'select' | 'color';
  ph?: string;
  hint?: string;
  options?: string[];
};

export type Kind = {
  key: string;
  title: string;
  cats: string[];
  icon: string;
  hint: string;
  fields: Field[];
  def: Record<string, string>;
  render: (v: Record<string, string>) => string;
};

export const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const attr = (s: unknown) => esc(s).replace(/"/g, '&quot;');
export const rowsOf = (s: string) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
export const gridOf = (s: string) => rowsOf(s).map((r) => r.split('|').map((c) => c.trim()));

const marks = (s: string) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/==(.+?)==/g, '<mark>$1</mark>')
    .replace(/__(.+?)__/g, '<i>$1</i>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>');

const btn = (label: string, type: string, val: string, style = 'primary') =>
  type === 'copy'
    ? `<tg-button type="copy_text" style="${style}" text="${attr(val)}">${esc(label)}</tg-button>`
    : `<tg-button type="url" style="${style}" url="${attr(val)}">${esc(label)}</tg-button>`;

const row = (inner: string) => `<tg-button-row align="center">${inner}</tg-button-row>`;

const table = (head: string[], body: string[][], flags = 'striped compact') => {
  const tr = (cells: string[], tag: string) =>
    `<tr>${cells.map((c) => `<${tag}>${marks(c)}</${tag}>`).join('')}</tr>`;
  const h = head.filter((c) => c !== '').length ? tr(head, 'th') : '';
  return `<table ${flags}>${h}${body.map((r) => tr(r, 'td')).join('')}</table>`;
};

const bullet = (items: string[], ordered = false) => {
  const tag = ordered ? 'ol' : 'ul';
  return `<${tag}>${items.map((i) => `<li>${marks(i)}</li>`).join('')}</${tag}>`;
};

const btnFields = (): Field[] => [
  { k: 'btns', label: 'دکمه‌ها', type: 'lines', ph: 'متن | لینک | success', hint: 'هر خط: عنوان دکمه | آدرس یا متن کپی | رنگ (success/primary/danger)', },
];

const renderBtns = (v: Record<string, string>, style = 'primary') =>
  row(
    rowsOf(v.btns || '')
      .map((line) => {
        const [label = 'دکمه', target = 'https://t.me/Config7x', st = style] = line.split('|').map((x) => x.trim());
        const copy = !/^https?:\/\//i.test(target);
        return btn(label, copy ? 'copy' : 'url', target, st);
      })
      .join(''),
  );

export const KINDS: Kind[] = [];
const add = (k: Kind) => KINDS.push(k);

/* ── متن و چیدمان ─────────────────────────────────────────────── */
add({ key: 'text', title: 'متن', cats: ['رایج', 'متن'], icon: '📝', hint: 'پاراگراف ساده',
  fields: [{ k: 'text', label: 'متن', type: 'area', ph: 'متن خود را بنویسید — **بولد** ==هایلایت==' }],
  def: { text: 'اینجا متن شماست.' },
  render: (v) => `<p>${marks(v.text || '')}</p>` });

add({ key: 'heading', title: 'عنوان', cats: ['رایج', 'متن'], icon: '🔠', hint: 'تیتر بخش',
  fields: [{ k: 'text', label: 'عنوان', type: 'text' }, { k: 'level', label: 'سطح', type: 'select', options: ['1', '2', '3'] }],
  def: { text: 'عنوان بخش', level: '2' },
  render: (v) => `<h${v.level || '2'}>${marks(v.text || '')}</h${v.level || '2'}>` });

add({ key: 'media', title: 'تصویر', cats: ['رایج', 'رسانه'], icon: '🖼', hint: 'عکس یا ویدیو از گالری',
  fields: [{ k: 'url', label: 'آدرس تصویر', type: 'text', ph: 'https://…' }, { k: 'caption', label: 'زیرنویس', type: 'text' }],
  def: { url: 'https://picsum.photos/seed/telerich/900/500', caption: 'توضیح تصویر' },
  render: (v) => (v.url ? `<img src="${attr(v.url)}" />` : '') + (v.caption ? `\n<p><i>${marks(v.caption)}</i></p>` : '') });

add({ key: 'audio', title: 'آهنگ', cats: ['رایج', 'رسانه'], icon: '🎵', hint: 'فایل صوتی قابل پخش',
  fields: [{ k: 'title', label: 'نام قطعه', type: 'text' }, { k: 'performer', label: 'خواننده', type: 'text' }, { k: 'url', label: 'لینک', type: 'text' }],
  def: { title: 'نام قطعه', performer: 'خواننده', url: 'https://t.me/Config7x' },
  render: (v) => `<blockquote>🎵 <b>${esc(v.title || '')}</b>\n${esc(v.performer || '')}<cite>${attr(v.url || '')}</cite></blockquote>` });

add({ key: 'slideshow', title: 'اسلایدشو', cats: ['رسانه'], icon: '🎞', hint: 'چند عکس پشت سر هم',
  fields: [{ k: 'list', label: 'آدرس تصاویر', type: 'lines', ph: 'هر خط یک آدرس' }, { k: 'caption', label: 'زیرنویس', type: 'text' }],
  def: { list: 'https://picsum.photos/seed/s1/900/500\nhttps://picsum.photos/seed/s2/900/500', caption: 'اسلایدشو' },
  render: (v) => rowsOf(v.list || '').map((u) => `<img src="${attr(u)}" />`).join('\n') + (v.caption ? `\n<p><i>${esc(v.caption)}</i></p>` : '') });

add({ key: 'collage', title: 'کلاژ', cats: ['رسانه'], icon: '🧩', hint: 'چند عکس کنار هم',
  fields: [{ k: 'list', label: 'آدرس تصاویر', type: 'lines' }, { k: 'caption', label: 'زیرنویس', type: 'text' }],
  def: { list: 'https://picsum.photos/seed/c1/600/400\nhttps://picsum.photos/seed/c2/600/400', caption: 'کلاژ تصاویر' },
  render: (v) => table([''], rowsOf(v.list || '').map((u, i) => [`<img src="${attr(u)}" />`, `${i + 1}`]), 'compact') + (v.caption ? `\n<p><i>${esc(v.caption)}</i></p>` : '') });

add({ key: 'map', title: 'نقشه', cats: ['رسانه'], icon: '🗺', hint: 'موقعیت مکانی',
  fields: [{ k: 'title', label: 'عنوان مکان', type: 'text' }, { k: 'lat', label: 'عرض', type: 'text' }, { k: 'lon', label: 'طول', type: 'text' }],
  def: { title: 'مکان روی نقشه', lat: '35.6892', lon: '51.3890' },
  render: (v) => `<p>🗺 <b>${esc(v.title || '')}</b></p>\n${row(btn('باز کردن نقشه', 'url', `https://www.openstreetmap.org/?mlat=${attr(v.lat || '')}&mlon=${attr(v.lon || '')}#map=15/${attr(v.lat || '')}/${attr(v.lon || '')}`, 'primary'))}` });

add({ key: 'quote', title: 'نقل‌قول', cats: ['متن'], icon: '❝', hint: 'نقل‌قول ساده',
  fields: [{ k: 'text', label: 'متن', type: 'area' }],
  def: { text: 'جملۀ کوتاه و اثرگذار.' },
  render: (v) => `<blockquote>${marks(v.text || '')}</blockquote>` });

add({ key: 'quotex', title: 'نقل‌قول بازشونده', cats: ['متن'], icon: '🪗', hint: 'نقل‌قول بلند با باز و بسته شدن',
  fields: [{ k: 'text', label: 'متن', type: 'area' }, { k: 'cite', label: 'پانویس', type: 'text' }],
  def: { text: 'متن بلند که در حالت جمع‌شده فقط دو خط نشان داده می‌شود و با لمس باز می‌شود.', cite: 'برای باز کردن لمس کنید' },
  render: (v) => `<blockquote expandable>${marks(v.text || '')}${v.cite ? `<cite>${esc(v.cite)}</cite>` : ''}</blockquote>` });

add({ key: 'list', title: 'فهرست', cats: ['متن'], icon: '•', hint: 'فهرست نقطه‌ای یا شماره‌دار',
  fields: [{ k: 'items', label: 'آیتم‌ها', type: 'lines' }, { k: 'mode', label: 'شکل', type: 'select', options: ['نقطه‌ای', 'شماره‌دار'] }],
  def: { items: 'آیتم اول\nآیتم دوم\nآیتم سوم', mode: 'نقطه‌ای' },
  render: (v) => bullet(rowsOf(v.items || ''), v.mode === 'شماره‌دار') });

add({ key: 'details', title: 'بخش بازشونده', cats: ['متن'], icon: '🔽', hint: 'بخشی که با لمس باز می‌شود',
  fields: [{ k: 'summary', label: 'تیتر بخش', type: 'text' }, { k: 'text', label: 'محتوای داخل', type: 'area' }],
  def: { summary: 'جزئیات بیشتر', text: 'محتوایی که بعد از لمس نمایش داده می‌شود.' },
  render: (v) => `<details><summary><b>${esc(v.summary || 'جزئیات')}</b></summary>${marks(v.text || '')}</details>` });

add({ key: 'spoiler', title: 'اسپویلر', cats: ['متن'], icon: '🫥', hint: 'متن مخفی تا لمس شود',
  fields: [{ k: 'text', label: 'متن', type: 'area' }],
  def: { text: 'این متن تا زمانی که لمس نشود دیده نمی‌شود.' },
  render: (v) => `<tg-spoiler>${marks(v.text || '')}</tg-spoiler>` });

add({ key: 'code', title: 'کد', cats: ['متن'], icon: '💻', hint: 'کد یا دستور با کپی',
  fields: [{ k: 'text', label: 'کد', type: 'area' }, { k: 'label', label: 'متن دکمه کپی', type: 'text' }],
  def: { text: 'vless://7c730089-1791-4828-89b2-86e7e1663063@de.example:443?type=ws#@Config7x', label: '📋 کپی کد' },
  render: (v) => `<pre><code>${esc(v.text || '')}</code></pre>\n${row(btn(v.label || '📋 کپی کد', 'copy', v.text || '', 'success'))}` });

add({ key: 'banner', title: 'بنر تیتر', cats: ['متن'], icon: '🎴', hint: 'تیتر بزرگ با زیرتیتر',
  fields: [{ k: 'title', label: 'تیتر', type: 'text' }, { k: 'sub', label: 'زیرتیتر', type: 'text' }],
  def: { title: 'عنوان بزرگ', sub: 'یک زیرتیتر کوتاه و روشن' },
  render: (v) => `<h1>${marks(v.title || '')}</h1>\n<p><b>${marks(v.sub || '')}</b></p>` });

add({ key: 'sep', title: 'خط جداکننده', cats: ['متن'], icon: '➖', hint: 'جدا کردن بخش‌ها',
  fields: [{ k: 'style', label: 'شکل', type: 'select', options: ['خط', 'ستاره', 'نقطه'] }],
  def: { style: 'خط' },
  render: (v) => (v.style === 'ستاره' ? '<p>━━━━ ✦ ━━━━</p>' : v.style === 'نقطه' ? '<p>· · · · ·</p>' : '<hr/>') });

add({ key: 'table', title: 'جدول', cats: ['داده'], icon: '▦', hint: 'جدول ساده',
  fields: [{ k: 'head', label: 'سرستون‌ها', type: 'text', ph: 'نام | مقدار' }, { k: 'rows', label: 'ردیف‌ها', type: 'grid', ph: 'یک | ۱' }],
  def: { head: 'ویژگی | مقدار', rows: 'سرعت | بالا\nپایداری | عالی' },
  render: (v) => table((v.head || '').split('|').map((s) => s.trim()), gridOf(v.rows || '')) });

add({ key: 'chart', title: 'نمودار میله‌ای', cats: ['داده'], icon: '📊', hint: 'نمودار ساده با کاراکتر',
  fields: [{ k: 'rows', label: 'داده‌ها', type: 'grid', ph: 'برچسب | 70' }],
  def: { rows: 'آلمان | 80\nهلند | 65\nترکیه | 45' },
  render: (v) => bullet(gridOf(v.rows || '').map(([label = '', val = '0']) => {
    const n = Math.max(0, Math.min(10, Math.round(Number(val) / 10)));
    return `${esc(label)} ${'▰'.repeat(n)}${'▱'.repeat(10 - n)} ${esc(val)}٪`;
  })) });

add({ key: 'stats', title: 'کارت آمار', cats: ['داده'], icon: '🔢', hint: 'سه عدد کلیدی کنار هم',
  fields: [{ k: 'rows', label: 'آمار', type: 'grid', ph: 'عنوان | مقدار' }],
  def: { rows: 'پینگ | ۲۴ms\nسرعت | ۹۸Mbps\nآپتایم | ۹۹٪' },
  render: (v) => table([''], [gridOf(v.rows || '').flat().reduce<string[]>((acc, cur, i) => {
    if (i % 2 === 0) acc.push(`${esc(cur)}`);
    else acc[acc.length - 1] += ` · <b>${esc(cur)}</b>`;
    return acc;
  }, [])], 'compact') });

add({ key: 'compare', title: 'مقایسه', cats: ['داده'], icon: '⚖️', hint: 'قبل و بعد',
  fields: [{ k: 'left', label: 'ستون اول', type: 'lines' }, { k: 'right', label: 'ستون دوم', type: 'lines' }, { k: 'lh', label: 'عنوان اول', type: 'text' }, { k: 'rh', label: 'عنوان دوم', type: 'text' }],
  def: { lh: 'قبل', rh: 'بعد', left: 'کند\nناپایدار', right: 'سریع\nپایدار' },
  render: (v) => quizRowLike(v.lh || 'قبل', v.rh || 'بعد', rowsOf(v.left || ''), rowsOf(v.right || '')) });

add({ key: 'timeline', title: 'خط زمانی', cats: ['داده'], icon: '🕰', hint: 'مسیر یا تاریخچه',
  fields: [{ k: 'items', label: 'مراحل', type: 'lines', ph: 'عنوان | توضیح' }],
  def: { items: '۱۴۰۲ | شروع\n۱۴۰۳ | رشد\n۱۴۰۴ | برند' },
  render: (v) => rowsOf(v.items || '').map((l, i) => {
    const [t = '', d = ''] = l.split('|').map((x) => x.trim());
    return `<p>${i === 0 ? '┌' : '├'} <b>${esc(t)}</b> — ${marks(d)}</p>`;
  }).join('\n') });

add({ key: 'checklist', title: 'چک‌لیست', cats: ['داده'], icon: '✅', hint: 'کارهای انجام‌شده',
  fields: [{ k: 'items', label: 'آیتم‌ها', type: 'lines', ph: '☑ عنوان یا ✗ عنوان' }],
  def: { items: '☑ کانفیگ تست شد\n☑ سرعت بررسی شد\n✗ اتصال دوم' },
  render: (v) => `<ul>${rowsOf(v.items || '').map((i) => `<li><input type="checkbox"${/^(☑|✓|\[x\])/i.test(i) ? ' checked' : ''}>${marks(i.replace(/^(☑|✗|✓|\[x\]|\[\s\])\s*/i, ''))}</li>`).join('')}</ul>` });

add({ key: 'progress', title: 'نوار پیشرفت', cats: ['داده'], icon: '📈', hint: 'درصد پیشرفت',
  fields: [{ k: 'label', label: 'عنوان', type: 'text' }, { k: 'value', label: 'درصد', type: 'num' }],
  def: { label: 'پیشرفت پروژه', value: '65' },
  render: (v) => {
    const n = Math.max(0, Math.min(10, Math.round(Number(v.value || 0) / 10)));
    return `<p><b>${esc(v.label || '')}</b> ${'▰'.repeat(n)}${'▱'.repeat(10 - n)} ${esc(v.value || '0')}٪</p>`;
  } });

add({ key: 'formula', title: 'فرمول', cats: ['داده'], icon: '∑', hint: 'فرمول ریاضی',
  fields: [{ k: 'text', label: 'فرمول', type: 'text', ph: 'E = mc^2' }],
  def: { text: 'E = mc^2' },
  render: (v) => `<tg-math>${esc(v.text || '')}</tg-math>` });

function quizRowLike(lh: string, rh: string, left: string[], right: string[]) {
  const n = Math.max(left.length, right.length);
  const body: string[][] = [];
  for (let i = 0; i < n; i += 1) body.push([left[i] || '', right[i] || '']);
  return table([lh, rh], body);
}

/* ── فروش ─────────────────────────────────────────────────────── */
add({ key: 'product', title: 'کارت محصول', cats: ['فروش'], icon: '📦', hint: 'محصول با قیمت و دکمه خرید',
  fields: [{ k: 'name', label: 'نام', type: 'text' }, { k: 'price', label: 'قیمت', type: 'text' }, { k: 'desc', label: 'توضیح', type: 'area' }, { k: 'url', label: 'لینک خرید', type: 'text' }],
  def: { name: 'اشتراک یک‌ماهه', price: '۹۹٫۰۰۰ تومان', desc: 'سرعت بالا، پشتیبانی ۲۴ ساعته', url: 'https://t.me/Rich7xbot' },
  render: (v) => `<h2>📦 ${marks(v.name || '')}</h2>\n<p><b>${esc(v.price || '')}</b></p>\n<p>${marks(v.desc || '')}</p>\n${row(btn('🛍 خرید', 'url', v.url || 'https://t.me/Rich7xbot', 'success'))}` });

add({ key: 'price', title: 'جدول قیمت', cats: ['فروش'], icon: '💰', hint: 'لیست قیمت‌ها',
  fields: [{ k: 'head', label: 'سرستون‌ها', type: 'text' }, { k: 'rows', label: 'ردیف‌ها', type: 'grid' }],
  def: { head: 'پلن | مدت | قیمت', rows: 'پایه | ۱ ماه | ۹۹٫۰۰۰\nحرفه‌ای | ۳ ماه | ۲۴۹٫۰۰۰' },
  render: (v) => table((v.head || '').split('|').map((s) => s.trim()), gridOf(v.rows || '')) });

add({ key: 'plans', title: 'پلن‌ها', cats: ['فروش'], icon: '💳', hint: 'مقایسه پلن‌ها',
  fields: [{ k: 'a', label: 'پلن اول', type: 'text' }, { k: 'b', label: 'پلن دوم', type: 'text' }, { k: 'rows', label: 'ویژگی‌ها', type: 'grid', ph: 'ویژگی | ✓ | ✗' }],
  def: { a: 'پایه', b: 'حرفه‌ای', rows: 'سرعت | ✓ | ✓\nچند دستگاه | ✗ | ✓' },
  render: (v) => table([`ویژگی`, esc(v.a || ''), esc(v.b || '')], gridOf(v.rows || '')) });

add({ key: 'countdown', title: 'تایمر آفری', cats: ['فروش'], icon: '⏳', hint: 'شمارش معکوس',
  fields: [{ k: 'label', label: 'عنوان', type: 'text' }, { k: 'minutes', label: 'دقیقه بعد', type: 'num' }],
  def: { label: 'پایان تخفیف', minutes: '60' },
  render: (v) => {
    const t = Math.floor(Date.now() / 1000) + Number(v.minutes || 60) * 60;
    return `<p>⏳ <b>${esc(v.label || '')}</b> — <tg-time unix="${t}" format="wDT">پایان</tg-time></p>`;
  } });

add({ key: 'coupon', title: 'کد تخفیف', cats: ['فروش'], icon: '🎟', hint: 'کد با دکمه کپی',
  fields: [{ k: 'code', label: 'کد', type: 'text' }, { k: 'desc', label: 'توضیح', type: 'text' }],
  def: { code: 'CONFIG7X20', desc: '۲۰٪ تخفیف روی همه پلن‌ها' },
  render: (v) => `<blockquote>🎟 کد تخفیف\n<code>${esc(v.code || '')}</code><cite>${esc(v.desc || '')}</cite></blockquote>\n${row(btn('📋 کپی کد', 'copy', v.code || '', 'success'))}` });

add({ key: 'testimonial', title: 'نظر مشتری', cats: ['فروش'], icon: '💬', hint: 'نظر با ستاره',
  fields: [{ k: 'name', label: 'نام', type: 'text' }, { k: 'stars', label: 'ستاره (۱-۵)', type: 'num' }, { k: 'text', label: 'متن نظر', type: 'area' }],
  def: { name: 'کاربر', stars: '5', text: 'سرعت عالی و پشتیبانی سریع.' },
  render: (v) => `<blockquote>${marks(v.text || '')}<cite>${esc(v.name || '')} · ${'⭐'.repeat(Math.max(0, Math.min(5, Number(v.stars || 5))))}</cite></blockquote>` });

add({ key: 'faq', title: 'سؤال و جواب', cats: ['فروش'], icon: '❓', hint: 'سؤالات پرتکرار',
  fields: [{ k: 'items', label: 'پرسش‌ها', type: 'lines', ph: 'پرسش | پاسخ' }],
  def: { items: 'چطور وصل شوم؟ | راهنما را دنبال کنید\nچند دستگاه؟ | تا ۳ دستگاه' },
  render: (v) => rowsOf(v.items || '').map((l) => {
    const [q = '', a = ''] = l.split('|').map((x) => x.trim());
    return `<details><summary><b>${esc(q)}</b></summary>${marks(a)}</details>`;
  }).join('\n') });

/* ── تعامل ────────────────────────────────────────────────────── */
add({ key: 'poll', title: 'نظرسنجی', cats: ['رایج', 'تعامل'], icon: '📊', hint: 'نظرسنجی تلگرام',
  fields: [{ k: 'q', label: 'پرسش', type: 'text' }, { k: 'items', label: 'گزینه‌ها', type: 'lines' }],
  def: { q: 'کدام گزینه را می‌خواهی؟', items: 'گزینه اول\nگزینه دوم' },
  render: (v) => `<p><b>📊 ${esc(v.q || 'نظرسنجی')}</b></p>\n${bullet(rowsOf(v.items || ''))}` });

add({ key: 'quiz', title: 'کوییز', cats: ['تعامل'], icon: '🧠', hint: 'سؤال با جواب اسپویلری',
  fields: [{ k: 'q', label: 'پرسش', type: 'text' }, { k: 'a', label: 'جواب', type: 'text' }],
  def: { q: 'پایتخت آلمان کجاست؟', a: 'برلین' },
  render: (v) => `<p>🧠 <b>${esc(v.q || '')}</b></p>\n<p>جواب: <tg-spoiler>${esc(v.a || '')}</tg-spoiler></p>` });

add({ key: 'btn1', title: 'دکمه', cats: ['رایج', 'تعامل'], icon: '🔘', hint: 'یک دکمه',
  fields: [{ k: 'label', label: 'متن', type: 'text' }, { k: 'url', label: 'لینک یا متن کپی', type: 'text' }, { k: 'style', label: 'رنگ', type: 'select', options: ['primary', 'success', 'danger'] }],
  def: { label: '📥 دریافت کانفیگ', url: 'https://t.me/Config7x', style: 'primary' },
  render: (v) => row(btn(v.label || 'دکمه', /^https?:\/\//i.test(v.url || '') ? 'url' : 'copy', v.url || '', v.style || 'primary')) });

add({ key: 'buttons', title: 'گروه دکمه', cats: ['تعامل'], icon: '🎛', hint: 'چند دکمه در یک ردیف',
  fields: btnFields(),
  def: { btns: '📋 کپی کانفیگ | vless://demo | success\n📢 کانال | https://t.me/Config7x | primary' },
  render: (v) => renderBtns(v) });

add({ key: 'profile', title: 'کارت معرفی', cats: ['تعامل'], icon: '👤', hint: 'کارت یک شخص',
  fields: [{ k: 'name', label: 'نام', type: 'text' }, { k: 'role', label: 'سمت', type: 'text' }, { k: 'text', label: 'توضیح', type: 'area' }, { k: 'user', label: 'یوزرنیم', type: 'text' }],
  def: { name: 'نام', role: 'پشتیبانی', text: 'همیشه در دسترس برای سؤالات.', user: '@Config7x' },
  render: (v) => `<blockquote>👤 <b>${esc(v.name || '')}</b> · ${esc(v.role || '')}\n${marks(v.text || '')}<cite>${esc(v.user || '')}</cite></blockquote>` });

add({ key: 'news', title: 'کارت خبر', cats: ['تعامل'], icon: '📰', hint: 'خبر کوتاه با منبع',
  fields: [{ k: 'title', label: 'تیتر', type: 'text' }, { k: 'text', label: 'متن', type: 'area' }, { k: 'src', label: 'منبع', type: 'text' }],
  def: { title: 'تیتر خبر', text: 'خلاصهٔ خبر در دو خط.', src: '@Config7x' },
  render: (v) => `<h3>📰 ${marks(v.title || '')}</h3>\n<p>${marks(v.text || '')}</p>\n<p><i>منبع: ${esc(v.src || '')}</i></p>` });

/* ── پیشرفته ──────────────────────────────────────────────────── */
add({ key: 'live', title: 'زمان زنده', cats: ['پیشرفته'], icon: '⏰', hint: 'ساعت زندهٔ تلگرام',
  fields: [{ k: 'label', label: 'برچسب', type: 'text' }, { k: 'minutes', label: 'چند دقیقه بعد', type: 'num' }],
  def: { label: 'شروع', minutes: '5' },
  render: (v) => {
    const t = Math.floor(Date.now() / 1000) + Number(v.minutes || 5) * 60;
    return `<p>⏰ ${esc(v.label || '')}: <tg-time unix="${t}" format="wDt">زمان</tg-time></p>`;
  } });

add({ key: 'thinking', title: 'جعبهٔ فکر', cats: ['پیشرفته'], icon: '💭', hint: 'جمع‌بندی و نکته',
  fields: [{ k: 'text', label: 'متن', type: 'area' }],
  def: { text: 'نکته‌ای که خوب است خواننده بداند.' },
  render: (v) => `<aside>💭 ${marks(v.text || '')}</aside>` });

add({ key: 'footnote', title: 'پانوشت', cats: ['پیشرفته'], icon: '🔖', hint: 'توضیح پایین پست',
  fields: [{ k: 'text', label: 'متن', type: 'area' }],
  def: { text: '۱. توضیح تکمیلی دربارهٔ مطلب بالا.' },
  render: (v) => `<p><i>🔖 ${marks(v.text || '')}</i></p>` });

add({ key: 'tutorial', title: 'آموزش گام‌به‌گام', cats: ['پیشرفته'], icon: '📚', hint: 'مراحل شماره‌دار',
  fields: [{ k: 'items', label: 'مراحل', type: 'lines' }],
  def: { items: 'اپ را نصب کنید\nکانفیگ را کپی کنید\nوصل شوید' },
  render: (v) => bullet(rowsOf(v.items || ''), true) });

/* ── رسانه، کانال، فنی و بقیه ─────────────────────────────────── */
const mediaCard = (icon: string, head: string, title: string, sub: string, link: string, label: string) =>
  `<p>${icon} <b>${esc(head)}</b></p>\n<p>${esc(title)}\n<i>${esc(sub)}</i></p>\n${row(btn(label, /^https?:\/\//i.test(link) ? 'url' : 'copy', link, 'primary'))}`;

add({ key: 'filecard', title: 'کارت فایل', cats: ['رسانه'], icon: '📎', hint: 'فایل با حجم و لینک',
  fields: [{ k: 'name', label: 'نام فایل', type: 'text' }, { k: 'size', label: 'حجم', type: 'text' }, { k: 'url', label: 'لینک دانلود', type: 'text' }],
  def: { name: 'configs.zip', size: '۲.۴MB', url: 'https://t.me/Config7x' },
  render: (v) => mediaCard('📎', 'فایل', v.name || '', v.size || '', v.url || '', '⬇️ دانلود') });

add({ key: 'playlist', title: 'پلی‌لیست', cats: ['رسانه'], icon: '🎧', hint: 'لیست آهنگ',
  fields: [{ k: 'title', label: 'نام پلی‌لیست', type: 'text' }, { k: 'items', label: 'قطعه‌ها', type: 'lines' }],
  def: { title: 'پلی‌لیست تمرکز', items: 'قطعه اول\nقطعه دوم' },
  render: (v) => `<p>🎧 <b>${esc(v.title || 'پلی‌لیست')}</b></p>\n${bullet(rowsOf(v.items || ''), true)}` });

add({ key: 'musiccard', title: 'کارت موزیک', cats: ['رسانه'], icon: '💿', hint: 'آهنگ با پخش‌کننده',
  fields: [{ k: 'title', label: 'نام', type: 'text' }, { k: 'artist', label: 'هنرمند', type: 'text' }, { k: 'url', label: 'لینک', type: 'text' }],
  def: { title: 'نام آهنگ', artist: 'هنرمند', url: 'https://t.me/Config7x' },
  render: (v) => mediaCard('💿', 'موزیک', v.title || '', v.artist || '', v.url || '', '▶️ پخش') });

add({ key: 'podcast', title: 'اپیزود پادکست', cats: ['رسانه'], icon: '🎤', hint: 'قسمت پادکست',
  fields: [{ k: 'title', label: 'عنوان قسمت', type: 'text' }, { k: 'dur', label: 'مدت', type: 'text' }, { k: 'url', label: 'لینک', type: 'text' }],
  def: { title: 'قسمت اول', dur: '۲۴ دقیقه', url: 'https://t.me/Config7x' },
  render: (v) => mediaCard('🎤', 'پادکست', v.title || '', v.dur || '', v.url || '', '🎧 گوش دادن') });

add({ key: 'videocard', title: 'کارت ویدیو', cats: ['رسانه'], icon: '🎬', hint: 'ویدیو با مدت',
  fields: [{ k: 'title', label: 'عنوان', type: 'text' }, { k: 'dur', label: 'مدت', type: 'text' }, { k: 'url', label: 'لینک', type: 'text' }],
  def: { title: 'آموزش نصب', dur: '۳:۲۰', url: 'https://t.me/Config7x' },
  render: (v) => mediaCard('🎬', 'ویدیو', v.title || '', v.dur || '', v.url || '', '▶️ تماشا') });

add({ key: 'linkcard', title: 'کارت لینک', cats: ['رسانه'], icon: '🔗', hint: 'پیش‌نمایش لینک',
  fields: [{ k: 'title', label: 'عنوان', type: 'text' }, { k: 'desc', label: 'توضیح', type: 'text' }, { k: 'url', label: 'آدرس', type: 'text' }],
  def: { title: 'کانال ما', desc: 'کانفیگ‌های رایگان روزانه', url: 'https://t.me/Config7x' },
  render: (v) => `<p>🔗 <b>${esc(v.title || '')}</b></p>\n<p>${esc(v.desc || '')}</p>\n${row(btn('باز کردن', 'url', v.url || '', 'primary'))}` });

add({ key: 'file', title: 'فایل و سند', cats: ['رایج', 'رسانه', 'فنی'], icon: '📎', hint: 'سند با نام و حجم',
  fields: [{ k: 'name', label: 'نام', type: 'text' }, { k: 'size', label: 'حجم', type: 'text' }, { k: 'url', label: 'لینک', type: 'text' }],
  def: { name: 'guide.pdf', size: '۱.۲MB', url: 'https://t.me/Config7x' },
  render: (v) => mediaCard('📎', 'سند', v.name || '', v.size || '', v.url || '', '⬇️ دریافت') });

add({ key: 'gif', title: 'گیف', cats: ['رسانه'], icon: '🌀', hint: 'تصویر متحرک', fields: [{ k: 'url', label: 'آدرس گیف', type: 'text' }],
  def: { url: 'https://picsum.photos/seed/gif/600/400' },
  render: (v) => (v.url ? `<img src="${attr(v.url)}" />\n<p><i>گیف</i></p>` : '') });

add({ key: 'voice', title: 'ویس', cats: ['رسانه'], icon: '🎙', hint: 'پیام صوتی', fields: [{ k: 'dur', label: 'مدت', type: 'text' }, { k: 'url', label: 'لینک', type: 'text' }],
  def: { dur: '۰:۴۵', url: 'https://t.me/Config7x' },
  render: (v) => mediaCard('🎙', 'ویس', v.dur || '', 'پیام صوتی', v.url || '', '▶️ پخش') });

add({ key: 'twocol', title: 'دو ستونه', cats: ['متن'], icon: '🧱', hint: 'دو ستون کنار هم',
  fields: [{ k: 'head', label: 'سرستون‌ها', type: 'text' }, { k: 'rows', label: 'ردیف‌ها', type: 'grid' }],
  def: { head: 'مزیت | توضیح', rows: 'سرعت | بالا\nپایداری | عالی' },
  render: (v) => table((v.head || '').split('|').map((s) => s.trim()), gridOf(v.rows || '')) });

add({ key: 'callout', title: 'کادر هشدار', cats: ['متن'], icon: '⚠️', hint: 'نکتهٔ مهم', fields: [{ k: 'text', label: 'متن', type: 'area' }],
  def: { text: 'قبل از اتصال، نسخهٔ کلاینت را به‌روز کنید.' },
  render: (v) => `<blockquote>⚠️ <b>توجه</b>\n${marks(v.text || '')}</blockquote>` });

add({ key: 'steps', title: 'مرحلهٔ شماره‌دار', cats: ['متن'], icon: '🔢', hint: 'مراحل کار', fields: [{ k: 'items', label: 'مراحل', type: 'lines' }],
  def: { items: 'دانلود کلاینت\nکپی کانفیگ\nاتصال' },
  render: (v) => bullet(rowsOf(v.items || ''), true) });

add({ key: 'quoteimg', title: 'نقل‌قول با گوینده', cats: ['متن'], icon: '🗣', hint: 'نقل‌قول + نام',
  fields: [{ k: 'text', label: 'متن', type: 'area' }, { k: 'who', label: 'گوینده', type: 'text' }],
  def: { text: 'سرعت مهم است، ولی پایداری مهم‌تر.', who: 'تیم @Config7x' },
  render: (v) => `<blockquote>${marks(v.text || '')}<cite>${esc(v.who || '')}</cite></blockquote>` });

add({ key: 'quotephoto', title: 'نقل‌قول با عکس', cats: ['متن'], icon: '🖼', hint: 'نقل‌قول روی تصویر',
  fields: [{ k: 'text', label: 'متن', type: 'area' }, { k: 'who', label: 'گوینده', type: 'text' }, { k: 'url', label: 'تصویر', type: 'text' }],
  def: { text: 'جملۀ کوتاه و اثرگذار.', who: 'تیم @Config7x', url: 'https://picsum.photos/seed/q/900/500' },
  render: (v) => (v.url ? `<img src="${attr(v.url)}" />\n` : '') + `<blockquote>${marks(v.text || '')}<cite>${esc(v.who || '')}</cite></blockquote>` });

add({ key: 'tldr', title: 'خلاصهٔ بالای پست', cats: ['متن'], icon: '⚡', hint: 'چکیده در دو خط',
  fields: [{ k: 'text', label: 'خلاصه', type: 'area' }],
  def: { text: 'در این پست: کانفیگ جدید، سرعت بالا، نصب ساده.' },
  render: (v) => `<blockquote expandable>⚡ <b>خلاصه</b>\n${marks(v.text || '')}</blockquote>` });

add({ key: 'meta', title: 'نوار اطلاعات پست', cats: ['متن'], icon: '🗓', hint: 'تاریخ، نویسنده، زمان',
  fields: [{ k: 'rows', label: 'اطلاعات', type: 'grid', ph: 'برچسب | مقدار' }],
  def: { rows: 'نویسنده | تیم فنی\nتاریخ | امروز\nزمان مطالعه | ۳ دقیقه' },
  render: (v) => `<p>${gridOf(v.rows || '').map(([a = '', b2 = '']) => `${esc(a)}: <b>${esc(b2)}</b>`).join(' · ')}</p>` });

add({ key: 'linechart', title: 'نمودار خطی', cats: ['داده'], icon: '📉', hint: 'روند با کاراکتر',
  fields: [{ k: 'rows', label: 'داده', type: 'grid', ph: 'برچسب | مقدار' }],
  def: { rows: 'شنبه | 40\nیکشنبه | 60\nدوشنبه | 85' },
  render: (v) => bullet(gridOf(v.rows || '').map(([a = '', b2 = '0']) => {
    const n = Math.max(0, Math.min(12, Math.round(Number(b2) / 9)));
    return `${esc(a)} ${'▁▂▃▄▅▆▇█'.slice(0, Math.max(1, Math.min(8, n)))} ${esc(b2)}`;
  })) });

add({ key: 'pie', title: 'سهم‌بندی', cats: ['داده'], icon: '🥧', hint: 'سهم هر بخش',
  fields: [{ k: 'rows', label: 'بخش‌ها', type: 'grid', ph: 'عنوان | درصد' }],
  def: { rows: 'آلمان | 40\nهلند | 35\nسایر | 25' },
  render: (v) => bullet(gridOf(v.rows || '').map(([a = '', b2 = '0']) => `${esc(a)} — ${'■'.repeat(Math.max(1, Math.min(10, Math.round(Number(b2) / 10))))} ${esc(b2)}٪`)) });

add({ key: 'leaderboard', title: 'جدول رتبه‌بندی', cats: ['داده'], icon: '🏆', hint: 'رتبه‌ها',
  fields: [{ k: 'rows', label: 'رتبه‌ها', type: 'grid', ph: 'نام | امتیاز' }],
  def: { rows: '۱. آلمان | ۹۸\n۲. هلند | ۹۵\n۳. ترکیه | ۸۹' },
  render: (v) => table(['رتبه', 'امتیاز'], gridOf(v.rows || '')) });

add({ key: 'rating', title: 'امتیاز ستاره‌ای', cats: ['داده'], icon: '⭐', hint: 'امتیاز از ۵',
  fields: [{ k: 'label', label: 'عنوان', type: 'text' }, { k: 'stars', label: 'ستاره', type: 'num' }],
  def: { label: 'رضایت کاربران', stars: '4' },
  render: (v) => `<p>⭐ <b>${esc(v.label || '')}</b> ${'★'.repeat(Math.max(0, Math.min(5, Number(v.stars || 4))))}${'☆'.repeat(5 - Math.max(0, Math.min(5, Number(v.stars || 4))))}</p>` });

add({ key: 'calendar', title: 'برنامهٔ هفتگی', cats: ['داده'], icon: '🗓', hint: 'جدول روزها',
  fields: [{ k: 'rows', label: 'روزها', type: 'grid', ph: 'روز | برنامه' }],
  def: { rows: 'شنبه | انتشار کانفیگ\nدوشنبه | آموزش\nچهارشنبه | آفر' },
  render: (v) => table(['روز', 'برنامه'], gridOf(v.rows || '')) });

add({ key: 'rates', title: 'نرخ ارز و طلا', cats: ['داده'], icon: '💱', hint: 'جدول نرخ‌ها',
  fields: [{ k: 'rows', label: 'نرخ‌ها', type: 'grid', ph: 'عنوان | قیمت' }],
  def: { rows: 'دلار | ۹۰٫۰۰۰\nطلا | ۵٫۲۰۰٫۰۰۰' },
  render: (v) => table(['عنوان', 'قیمت'], gridOf(v.rows || '')) });

add({ key: 'order', title: 'سفارش سریع', cats: ['فروش'], icon: '🛒', hint: 'فرم کوتاه سفارش',
  fields: [{ k: 'text', label: 'توضیح', type: 'text' }, { k: 'url', label: 'لینک سفارش', type: 'text' }],
  def: { text: 'برای ثبت سفارش روی دکمه بزنید.', url: 'https://t.me/Rich7xbot' },
  render: (v) => `<p>🛒 ${marks(v.text || '')}</p>\n${row(btn('ثبت سفارش', 'url', v.url || '', 'success'))}` });

add({ key: 'invoice', title: 'فاکتور', cats: ['فروش'], icon: '🧾', hint: 'فاکتور خرید',
  fields: [{ k: 'rows', label: 'اقلام', type: 'grid', ph: 'قلم | مبلغ' }, { k: 'total', label: 'جمع', type: 'text' }],
  def: { rows: 'اشتراک ۱ ماهه | ۹۹٫۰۰۰', total: '۹۹٫۰۰۰ تومان' },
  render: (v) => `<p>🧾 <b>فاکتور</b></p>\n${table(['قلم', 'مبلغ'], gridOf(v.rows || ''))}\n<p><b>جمع: ${esc(v.total || '')}</b></p>` });

add({ key: 'trust', title: 'ضمانت و اعتماد', cats: ['فروش'], icon: '🛡', hint: 'نشان‌های اعتماد',
  fields: [{ k: 'items', label: 'نشان‌ها', type: 'lines' }],
  def: { items: 'پشتیبانی ۲۴ ساعته\nضمانت بازگشت وجه\nپرداخت امن' },
  render: (v) => bullet(rowsOf(v.items || '').map((i) => `🛡 ${i}`)) });

add({ key: 'stars', title: 'پرداخت با استار', cats: ['فروش'], icon: '⭐', hint: 'پرداخت تلگرام استارز',
  fields: [{ k: 'text', label: 'توضیح', type: 'text' }, { k: 'url', label: 'لینک', type: 'text' }],
  def: { text: 'پرداخت با استار تلگرام انجام می‌شود.', url: 'https://t.me/Rich7xbot' },
  render: (v) => `<p>⭐ ${marks(v.text || '')}</p>\n${row(btn('پرداخت با استار', 'url', v.url || '', 'success'))}` });

add({ key: 'referral', title: 'لینک دعوت', cats: ['فروش'], icon: '🤝', hint: 'کد معرف',
  fields: [{ k: 'code', label: 'کد', type: 'text' }, { k: 'text', label: 'توضیح', type: 'text' }],
  def: { code: 'REF-7X', text: 'با هر دعوت یک اعتبار هدیه بگیرید.' },
  render: (v) => `<blockquote>🤝 ${marks(v.text || '')}\n<code>${esc(v.code || '')}</code></blockquote>\n${row(btn('📋 کپی کد', 'copy', v.code || '', 'primary'))}` });

add({ key: 'stock', title: 'موجودی محدود', cats: ['فروش'], icon: '🔥', hint: 'فوریت فروش',
  fields: [{ k: 'count', label: 'تعداد', type: 'num' }, { k: 'text', label: 'توضیح', type: 'text' }],
  def: { count: '3', text: 'فقط چند ظرفیت باقی مانده' },
  render: (v) => `<p>🔥 <b>${esc(v.count || '')} ظرفیت باقی مانده</b></p>\n<p>${marks(v.text || '')}</p>` });

add({ key: 'giveaway', title: 'قرعه‌کشی', cats: ['تعامل'], icon: '🎉', hint: 'مسابقه',
  fields: [{ k: 'text', label: 'شرایط', type: 'area' }, { k: 'url', label: 'لینک', type: 'text' }],
  def: { text: 'شرایط: عضویت در کانال و ری‌اکشن.', url: 'https://t.me/Config7x' },
  render: (v) => `<p>🎉 <b>قرعه‌کشی</b></p>\n${marks(v.text || '')}\n${row(btn('شرکت می‌کنم', 'url', v.url || '', 'success'))}` });

add({ key: 'form', title: 'فرم ثبت‌نام', cats: ['تعامل'], icon: '📝', hint: 'فیلدهای فرم',
  fields: [{ k: 'items', label: 'فیلدها', type: 'lines' }, { k: 'url', label: 'لینک فرم', type: 'text' }],
  def: { items: 'نام\nشماره تماس\nتوضیح', url: 'https://t.me/Rich7xbot' },
  render: (v) => `<p>📝 <b>فرم ثبت‌نام</b></p>\n${bullet(rowsOf(v.items || '').map((i) => `▢ ${i}`))}\n${row(btn('تکمیل فرم', 'url', v.url || '', 'primary'))}` });

add({ key: 'anonq', title: 'سؤال ناشناس', cats: ['تعامل'], icon: '🙈', hint: 'پیام ناشناس',
  fields: [{ k: 'text', label: 'متن', type: 'text' }, { k: 'url', label: 'لینک', type: 'text' }],
  def: { text: 'سؤالت را ناشناس بفرست.', url: 'https://t.me/Rich7xbot' },
  render: (v) => `<p>🙈 ${marks(v.text || '')}</p>\n${row(btn('ارسال ناشناس', 'url', v.url || '', 'primary'))}` });

add({ key: 'pollimg', title: 'نظرسنجی الف/ب', cats: ['تعامل'], icon: '🅰️', hint: 'دو گزینه تصویری',
  fields: [{ k: 'a', label: 'گزینه الف', type: 'text' }, { k: 'b', label: 'گزینه ب', type: 'text' }, { k: 'url', label: 'لینک رای‌گیری', type: 'text' }],
  def: { a: 'سرعت', b: 'پایداری', url: 'https://t.me/Config7x' },
  render: (v) => row(btn(`🅰️ ${v.a || 'الف'}`, 'url', v.url || '', 'primary') + btn(`🅱️ ${v.b || 'ب'}`, 'url', v.url || '', 'success')) });

add({ key: 'share', title: 'دکمهٔ اشتراک‌گذاری', cats: ['تعامل'], icon: '📤', hint: 'دعوت به اشتراک',
  fields: [{ k: 'url', label: 'لینک', type: 'text' }],
  def: { url: 'https://t.me/Config7x' },
  render: (v) => row(btn('📤 اشتراک‌گذاری', 'url', `https://t.me/share/url?url=${encodeURIComponent(v.url || 'https://t.me/Config7x')}`, 'primary')) });

add({ key: 'reactions', title: 'راهنمای واکنش', cats: ['تعامل'], icon: '👍', hint: 'درخواست واکنش',
  fields: [{ k: 'text', label: 'متن', type: 'text' }],
  def: { text: 'اگر مفید بود، ری‌اکشن بزنید.' },
  render: (v) => `<p>👍 ${marks(v.text || '')}</p>` });

add({ key: 'brandhead', title: 'هدر برند', cats: ['کانال'], icon: '🏷', hint: 'سربرگ کانال',
  fields: [{ k: 'name', label: 'نام کانال', type: 'text' }, { k: 'tag', label: 'تگ', type: 'text' }],
  def: { name: 'Config7x', tag: 'کانفیگ رایگان روزانه' },
  render: (v) => `<h2>🏷 ${marks(v.name || '')}</h2>\n<p><i>${esc(v.tag || '')}</i></p>` });

add({ key: 'footer', title: 'امضای پایین پست', cats: ['کانال'], icon: '✍️', hint: 'امضای ثابت',
  fields: [{ k: 'lines', label: 'خطوط', type: 'lines' }],
  def: { lines: '🪅 Channel || @Config7x\n📡 Channel توزیع || @orginal_v2ray' },
  render: (v) => `<blockquote>${rowsOf(v.lines || '').map((l) => esc(l)).join('\n')}</blockquote>` });

add({ key: 'series', title: 'سری پست', cats: ['کانال'], icon: '📒', hint: 'قسمت‌های یک سری',
  fields: [{ k: 'title', label: 'عنوان سری', type: 'text' }, { k: 'part', label: 'قسمت', type: 'text' }, { k: 'url', label: 'لینک', type: 'text' }],
  def: { title: 'آموزش تلگرام', part: 'قسمت ۲ از ۵', url: 'https://t.me/Config7x' },
  render: (v) => `<p>📒 <b>${esc(v.title || '')}</b> · ${esc(v.part || '')}</p>\n${row(btn('قسمت قبلی', 'url', v.url || '', 'primary'))}` });

add({ key: 'bilingual', title: 'دو زبانه', cats: ['کانال'], icon: '🌐', hint: 'فارسی و انگلیسی',
  fields: [{ k: 'fa', label: 'فارسی', type: 'area' }, { k: 'en', label: 'English', type: 'area' }],
  def: { fa: 'متن فارسی پیام.', en: 'English version of the message.' },
  render: (v) => `<p>${marks(v.fa || '')}</p>\n<hr/>\n<p>${marks(v.en || '')}</p>` });

add({ key: 'changelog', title: 'تغییرات نسخه', cats: ['کانال'], icon: '🆕', hint: 'چه چیزی جدید است',
  fields: [{ k: 'ver', label: 'نسخه', type: 'text' }, { k: 'items', label: 'تغییرات', type: 'lines' }],
  def: { ver: 'v2.0', items: 'سازندهٔ بصری\nقالب‌های آماده\nانتشار سریع‌تر' },
  render: (v) => `<p>🆕 <b>${esc(v.ver || '')}</b></p>\n${bullet(rowsOf(v.items || '').map((i) => `+ ${i}`))}` });

add({ key: 'sources', title: 'منابع', cats: ['کانال'], icon: '📑', hint: 'فهرست منابع',
  fields: [{ k: 'items', label: 'منابع', type: 'lines' }],
  def: { items: 'منبع اول\nمنبع دوم' },
  render: (v) => `<p>📑 <b>منابع</b></p>\n${bullet(rowsOf(v.items || ''), true)}` });

add({ key: 'config', title: 'کانفیگ کپی‌شو', cats: ['فنی'], icon: '⌨️', hint: 'کانفیگ با دکمهٔ کپی',
  fields: [{ k: 'name', label: 'نام کانفیگ', type: 'text' }, { k: 'text', label: 'کانفیگ', type: 'area' }, { k: 'note', label: 'پانویس', type: 'text' }],
  def: { name: '🇩🇪@Config7x', text: 'vless://7c730089-1791-4828-89b2-86e7e1663063@de.example:443?type=ws&security=none#🇩🇪@Config7x', note: 'روی کانفیگ بزن تا کپی شود' },
  render: (v) => `<blockquote><blockquote><code>${esc(v.text || '')}</code></blockquote><cite>${esc(v.note || '')}</cite></blockquote>\n${row(btn('📋 کپی کانفیگ', 'copy', v.text || '', 'success') + btn('📥 کانفیگ بیشتر', 'url', 'https://t.me/Config7x', 'primary'))}` });

add({ key: 'downloads', title: 'جدول دانلود', cats: ['فنی'], icon: '⬇️', hint: 'لینک کلاینت‌ها',
  fields: [{ k: 'rows', label: 'ردیف‌ها', type: 'grid', ph: 'پلتفرم | لینک' }],
  def: { rows: 'اندروید | https://t.me/Config7x\nآیفون | https://t.me/Config7x\nویندوز | https://t.me/Config7x' },
  render: (v) => `<details><summary><b>📥 دانلود اپلیکیشن‌ها</b></summary>${table(['پلتفرم', 'لینک'], gridOf(v.rows || ''))}</details>` });

add({ key: 'install', title: 'مراحل نصب', cats: ['فنی'], icon: '🧭', hint: 'راهنمای نصب',
  fields: [{ k: 'items', label: 'مراحل', type: 'lines' }],
  def: { items: 'کلاینت را نصب کنید\nکانفیگ را کپی کنید\nوصل شوید' },
  render: (v) => `<details><summary><b>🧭 مراحل نصب</b></summary>${bullet(rowsOf(v.items || ''), true)}</details>` });

add({ key: 'troubleshoot', title: 'عیب‌یابی', cats: ['فنی'], icon: '🛠', hint: 'مشکلات رایج',
  fields: [{ k: 'items', label: 'موارد', type: 'lines', ph: 'مشکل | راه‌حل' }],
  def: { items: 'وصل نمی‌شود | DNS را عوض کنید\nکند است | سرور دیگر را امتحان کنید' },
  render: (v) => rowsOf(v.items || '').map((l) => {
    const [q = '', a = ''] = l.split('|').map((x) => x.trim());
    return `<details><summary><b>${esc(q)}</b></summary>${marks(a)}</details>`;
  }).join('\n') });

add({ key: 'specs', title: 'مشخصات فنی', cats: ['فنی'], icon: '📐', hint: 'جدول مشخصات',
  fields: [{ k: 'rows', label: 'مشخصات', type: 'grid', ph: 'کلید | مقدار' }],
  def: { rows: 'پروتکل | VLESS\nشبکه | WS\nامنیت | Reality' },
  render: (v) => table(['کلید', 'مقدار'], gridOf(v.rows || '')) });

add({ key: 'mirrors', title: 'لینک‌های آینه', cats: ['فنی'], icon: '🪞', hint: 'چند لینک جایگزین',
  fields: [{ k: 'rows', label: 'آینه‌ها', type: 'grid', ph: 'نام | لینک' }],
  def: { rows: 'آینه ۱ | https://t.me/Config7x\nآینه ۲ | https://t.me/orginal_v2ray' },
  render: (v) => `<p>🪞 <b>لینک‌های آینه</b></p>\n${row(gridOf(v.rows || '').map(([n = '', u = '']) => btn(n, 'url', u, 'primary')).join(''))}` });

export const CATS = ['رایج', 'متن', 'رسانه', 'داده', 'فروش', 'تعامل', 'کانال', 'فنی', 'پیشرفته'];
export const KIND_MAP: Record<string, Kind> = Object.fromEntries(KINDS.map((k) => [k.key, k]));
export const countIn = (cat: string) => KINDS.filter((k) => k.cats.includes(cat)).length;

export function renderKind(key: string, v: Record<string, string>) {
  const kind = KIND_MAP[key];
  if (!kind) return '';
  try {
    return kind.render({ ...kind.def, ...v });
  } catch {
    return '';
  }
}
