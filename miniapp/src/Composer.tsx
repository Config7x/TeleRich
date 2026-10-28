import { useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, Check, ChevronDown, Copy, Layers, Plus, Sparkles, Trash2, Wand2, X, Eye, Send,
} from 'lucide-react';
import { RichPreview, detectRtl } from './Renderer';
import { KINDS, CATS, KIND_MAP, countIn } from './library';
import {
  Block, templates, newBlock, newArt, blocksToHtml, uid, TgButton,
} from './blocks';
import './composer.css';

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const save = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or private mode */
  }
};

const labels: Record<Block['kind'], string> = {
  art: 'کتابخانه',
  heading: 'تیتر',
  text: 'متن',
  quote: 'نقل‌قول',
  aside: 'جمله برجسته',
  list: 'فهرست',
  table: 'جدول',
  buttons: 'دکمه‌ها',
  image: 'عکس',
  divider: 'جداکننده',
  details: 'بخش بازشو',
  spoiler: 'متن مخفی',
  time: 'ساعت زنده',
  math: 'فرمول',
};

const icons: Record<Block['kind'], string> = {
  art: '◈',
  heading: 'H',
  text: '¶',
  quote: '❝',
  aside: '✦',
  list: '≡',
  table: '▦',
  buttons: '⬒',
  image: '🖼',
  divider: '—',
  details: '⌄',
  spoiler: '◍',
  time: '🕒',
  math: '∑',
};

type Props = { lang: 'en' | 'fa'; onApply: (html: string) => void };

export default function Composer({ lang, onApply }: Props) {
  const fa = lang === 'fa';
  const t = (en: string, faText: string) => (fa ? faText : en);
  const [blocks, setBlocks] = useState<Block[]>(() => read<Block[]>('tr-blocks', templates[0].build()));
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('رایج');
  const shown = useMemo(() => {
    const needle = q.trim();
    const base = needle
      ? KINDS.filter((k) => (k.title + ' ' + k.hint + ' ' + k.cats.join(' ')).includes(needle))
      : KINDS.filter((k) => k.cats.includes(cat));
    return base.slice(0, 120);
  }, [q, cat]);

  const html = useMemo(() => blocksToHtml(blocks), [blocks]);
  const addArt = (key: string) => add(newArt(key));

  const commit = (next: Block[]) => {
    setBlocks(next);
    save('tr-blocks', next);
  };

  const update = (id: string, patch: Record<string, unknown>) =>
    commit(blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));

  const move = (id: string, dir: -1 | 1) => {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };

  const duplicate = (id: string) => {
    const i = blocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    const clone = JSON.parse(JSON.stringify(blocks[i])) as Block;
    const next = [...blocks];
    next.splice(i + 1, 0, { ...clone, id: uid() });
    commit(next);
  };

  const remove = (id: string) => commit(blocks.filter((b) => b.id !== id));

  const add = (blockOrKind: Block | Block['kind']) => {
    const block = typeof blockOrKind === 'string' ? newBlock(blockOrKind) : blockOrKind;
    commit([...blocks, block]);
    setOpenId(block.id);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="cmp" dir={fa ? 'rtl' : 'ltr'}>
      <header className="cmp-hero">
        <div className="cmp-hero-copy">
          <span className="cmp-eyebrow"><Sparkles size={13} /> {t('NO CODE, JUST TAPS', 'بدون کد، فقط با لمس')}</span>
          <h2>{t('Build your post by tapping', 'پستت را با لمس بساز')}</h2>
          <p>{t('Pick a block, fill the fields, watch it appear. No tags, no formatting rules.', 'بلوک را انتخاب کن، فیلدها را پر کن، همان لحظه در پیش‌نمایش ببین. بدون تگ و بدون فرمت دستی.')}</p>
        </div>
        <div className="cmp-chips">
          <span className="cmp-step"><b>۱</b> {t('Add blocks', 'بلوک بچین')}</span>
          <span className="cmp-step"><b>۲</b> {t('Preview', 'پیش‌نمایش')}</span>
          <span className="cmp-step"><b>۳</b> {t('Send', 'ارسال')}</span>
        </div>
      </header>

      <section className="cmp-templates">
        <div className="cmp-strip-head">
          <strong>{t('Start from a template', 'از یک قالب شروع کن')}</strong>
          <span>{t('One tap, fully editable', 'یک لمس، کاملاً قابل ویرایش')}</span>
        </div>
        <div className="cmp-strip">
          {templates.map((tpl) => (
            <button
              key={tpl.id}
              className="cmp-tpl"
              onClick={() => {
                commit(tpl.build());
                setOpenId(null);
              }}
            >
              <span className="cmp-tpl-icon">{tpl.icon}</span>
              <span>{tpl.name}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="cmp-grid">
        <div className="cmp-editor">
          <div className="cmp-lib">
            <div className="cmp-lib-head">
              <span className="cmp-lib-title">
                <Layers size={15} /> {t('Block library', 'کتابخانهٔ بلوک‌ها')}
                <small>{KINDS.length}</small>
              </span>
              <input
                className="cmp-lib-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('Search blocks…', 'جست‌وجو میان بلوک‌ها…')}
              />
            </div>
            <div className="cmp-lib-cats">
              {CATS.map((cat) => (
                <button
                  key={cat}
                  className={'cmp-chip' + (cat === cat ? ' on' : '')}
                  onClick={() => setCat(cat)}
                >
                  {cat} <small>{countIn(cat)}</small>
                </button>
              ))}
            </div>
            <div className="cmp-lib-grid">
              {shown.map((k) => (
                <button key={k.key} className="cmp-lib-item" onClick={() => addArt(k.key)} title={k.hint}>
                  <span className="cmp-lib-icon">{k.icon}</span>
                  <b>{k.title}</b>
                  <small>{k.hint}</small>
                  <Plus size={12} className="cmp-plus" />
                </button>
              ))}
              {shown.length === 0 && <p className="cmp-lib-none">{t('No block matches that search.', 'بلوکی با این جست‌وجو پیدا نشد.')}</p>}
            </div>
          </div>

          {blocks.length === 0 && (
            <div className="cmp-empty">
              <Wand2 size={26} />
              <p>{t('Empty canvas. Tap a block above to start.', 'بوم خالی است. یکی از بلوک‌های بالا را بزن.')}</p>
            </div>
          )}

          <div className="cmp-blocks">
            {blocks.map((block, i) => {
              const open = openId === block.id;
              return (
                <article key={block.id} className={'cmp-block' + (open ? ' open' : '')}>
                  <header onClick={() => setOpenId(open ? null : block.id)}>
                    <span className="cmp-block-icon">{icons[block.kind]}</span>
                    <span className="cmp-block-name">{labels[block.kind]}</span>
                    <span className="cmp-block-peek">{previewLine(block)}</span>
                    <span className="cmp-block-tools" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => move(block.id, -1)} disabled={i === 0} aria-label="up"><ArrowUp size={14} /></button>
                      <button onClick={() => move(block.id, 1)} disabled={i === blocks.length - 1} aria-label="down"><ArrowDown size={14} /></button>
                      <button onClick={() => duplicate(block.id)} aria-label="duplicate"><Copy size={13} /></button>
                      <button className="danger" onClick={() => remove(block.id)} aria-label="delete"><Trash2 size={13} /></button>
                    </span>
                    <ChevronDown size={16} className="cmp-caret" />
                  </header>
                  {open && <div className="cmp-fields">{renderFields(block, update, t)}</div>}
                </article>
              );
            })}
          </div>
        </div>

        <aside className={'cmp-preview' + (showPreview ? '' : ' hidden')}>
          <div className="cmp-preview-head">
            <span><Eye size={14} /> {t('Live preview', 'پیش‌نمایش زنده')}</span>
            <button onClick={() => setShowPreview(false)} aria-label="hide preview"><X size={14} /></button>
          </div>
          <div className="cmp-phone" dir={detectRtl(html) ? 'rtl' : 'ltr'}>
            <RichPreview source={html} onAction={() => undefined} />
          </div>
          <div className="cmp-preview-foot">{html.length.toLocaleString()} / 32,768 {t('characters', 'نویسه')}</div>
        </aside>
        {!showPreview && (
          <button className="cmp-show-preview" onClick={() => setShowPreview(true)}>
            <Eye size={14} /> {t('Show preview', 'نمایش پیش‌نمایش')}
          </button>
        )}
      </div>

      <div className="cmp-actions">
        <button className="cmp-apply" onClick={() => onApply(html)}>
          <Send size={16} /> {t('Use this post & send', 'استفاده و ارسال پست')}
        </button>
        <button className="cmp-ghost" onClick={copyCode}>
          {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? t('Copied', 'کپی شد') : t('Copy HTML', 'کپی HTML')}
        </button>
        <button className="cmp-ghost" onClick={() => commit([])}>{t('Clear', 'پاک کردن')}</button>
      </div>
    </div>
  );
}

function previewLine(block: Block): string {
  switch (block.kind) {
    case 'heading':
    case 'text':
    case 'aside':
    case 'spoiler':
    case 'details':
      return (block as any).text?.slice(0, 46) || '';
    case 'quote':
      return (block as any).text?.slice(0, 46) || '';
    case 'list':
      return (block as any).text?.split('\n')[0]?.slice(0, 40) || '';
    case 'table':
      return `${(block as any).rows.length} × ${(block as any).rows[0]?.length || 0}`;
    case 'buttons':
      return (block as any).rows.flat().map((b: TgButton) => b.label).join(' · ').slice(0, 42);
    case 'image':
      return (block as any).url || 'لینک عکس بده';
    case 'time':
      return (block as any).label || '';
    case 'math':
      return (block as any).latex || '';
    default:
      return '';
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="cmp-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function renderFields(
  block: Block,
  update: (id: string, patch: Record<string, unknown>) => void,
  t: (en: string, fa: string) => string,
) {
  const set = (patch: Record<string, unknown>) => update(block.id, patch);

  if (block.kind === 'art') {
    const kind = KIND_MAP[block.art];
    if (!kind) return null;
    const val = (k: string) => block.v[k] ?? kind.def[k] ?? '';
    const setField = (k: string, value: string) => set({ v: { ...block.v, [k]: value } });
    return (
      <div className="cmp-art">
        <p className="cmp-art-hint">{kind.icon} <b>{kind.title}</b> — {kind.hint}</p>
        {kind.fields.map((f) => (
          <label key={f.k} className="cmp-field">
            <span>{f.label}</span>
            {f.type === 'area' || f.type === 'lines' || f.type === 'grid' ? (
              <textarea
                rows={f.type === 'area' ? 3 : 4}
                value={val(f.k)}
                placeholder={f.ph}
                onChange={(e) => setField(f.k, e.target.value)}
              />
            ) : f.type === 'select' ? (
              <select value={val(f.k)} onChange={(e) => setField(f.k, e.target.value)}>
                {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                value={val(f.k)}
                placeholder={f.ph}
                inputMode={f.type === 'num' ? 'numeric' : undefined}
                onChange={(e) => setField(f.k, e.target.value)}
              />
            )}
            {f.hint && <small>{f.hint}</small>}
          </label>
        ))}
      </div>
    );
  }


  switch (block.kind) {
    case 'heading':
      return (
        <>
          <Field label={t('Text', 'متن تیتر')}>
            <input value={block.text} onChange={(e) => set({ text: e.target.value })} />
          </Field>
          <Field label={t('Size', 'اندازه')}>
            <div className="cmp-seg">
              {[1, 2, 3].map((lvl) => (
                <button key={lvl} className={block.level === lvl ? 'on' : ''} onClick={() => set({ level: lvl })}>
                  {lvl === 1 ? 'بزرگ' : lvl === 2 ? 'متوسط' : 'کوچک'}
                </button>
              ))}
            </div>
          </Field>
        </>
      );

    case 'text':
      return (
        <>
          <Field label={t('Text', 'متن')}>
            <textarea rows={3} value={block.text} onChange={(e) => set({ text: e.target.value })} />
          </Field>
          <Field label={t('Style', 'استایل')}>
            <div className="cmp-seg">
              {[
                ['normal', 'ساده'],
                ['bold', 'بولد'],
                ['italic', 'ایتالیک'],
                ['mark', 'هایلایت'],
              ].map(([k, label]) => (
                <button key={k} className={block.style === k ? 'on' : ''} onClick={() => set({ style: k })}>
                  {label}
                </button>
              ))}
            </div>
          </Field>
        </>
      );

    case 'quote':
      return (
        <>
          <Field label={t('Quote text', 'متن نقل‌قول')}>
            <textarea rows={3} value={block.text} onChange={(e) => set({ text: e.target.value })} />
          </Field>
          <Field label={t('Caption under it (optional)', 'زیرنویس (اختیاری)')}>
            <input value={block.by} onChange={(e) => set({ by: e.target.value })} placeholder={t('e.g. Tap to copy', 'مثل: برای کپی بزن')} />
          </Field>
          <label className="cmp-check">
            <input type="checkbox" checked={block.expandable} onChange={(e) => set({ expandable: e.target.checked })} />
            {t('Collapsed until tapped', 'تا وقتی ضربه نزنی باز نشود')}
          </label>
        </>
      );

    case 'aside':
    case 'spoiler':
      return (
        <Field label={t('Text', 'متن')}>
          <textarea rows={2} value={block.text} onChange={(e) => set({ text: e.target.value })} />
        </Field>
      );

    case 'list':
      return (
        <>
          <Field label={t('One item per line', 'هر مورد در یک خط')}>
            <textarea rows={4} value={block.text} onChange={(e) => set({ text: e.target.value })} />
          </Field>
          <div className="cmp-inline">
            <label className="cmp-check">
              <input type="checkbox" checked={block.ordered} onChange={(e) => set({ ordered: e.target.checked })} />
              {t('Numbered', 'شماره‌دار')}
            </label>
            <label className="cmp-check">
              <input type="checkbox" checked={block.task} onChange={(e) => set({ task: e.target.checked })} />
              {t('Checkboxes', 'تیک‌باکس')}
            </label>
          </div>
        </>
      );

    case 'table':
      return (
        <>
          <div className="cmp-table">
            {block.rows.map((row, ri) => (
              <div className="cmp-table-row" key={ri}>
                {row.map((cell, ci) => (
                  <input
                    key={ci}
                    value={cell}
                    onChange={(e) => {
                      const rows = block.rows.map((r) => [...r]);
                      rows[ri][ci] = e.target.value;
                      set({ rows });
                    }}
                  />
                ))}
                <button
                  onClick={() => set({ rows: block.rows.filter((_, k) => k !== ri) })}
                  disabled={block.rows.length <= 1}
                  aria-label="remove row"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
          <div className="cmp-inline">
            <button className="cmp-mini" onClick={() => set({ rows: [...block.rows, block.rows[0].map(() => '')] })}>
              + {t('Row', 'ردیف')}
            </button>
            <button className="cmp-mini" onClick={() => set({ rows: block.rows.map((r) => [...r, '']) })}>
              + {t('Column', 'ستون')}
            </button>
          </div>
          <div className="cmp-inline">
            <label className="cmp-check">
              <input type="checkbox" checked={block.header} onChange={(e) => set({ header: e.target.checked })} />
              {t('Header row', 'ردیف عنوان')}
            </label>
            <label className="cmp-check">
              <input type="checkbox" checked={block.striped} onChange={(e) => set({ striped: e.target.checked })} />
              {t('Striped', 'راهراه')}
            </label>
            <label className="cmp-check">
              <input type="checkbox" checked={block.bordered} onChange={(e) => set({ bordered: e.target.checked })} />
              {t('Borders', 'حاشیه')}
            </label>
          </div>
        </>
      );

    case 'buttons':
      return (
        <>
          {block.rows.map((row, ri) => (
            <div className="cmp-btnrow" key={ri}>
              {row.map((btn, ci) => (
                <div className="cmp-btn" key={btn.id}>
                  <input
                    placeholder={t('Label', 'متن دکمه')}
                    value={btn.label}
                    onChange={(e) => {
                      const rows = block.rows.map((r) => r.map((x) => ({ ...x })));
                      rows[ri][ci].label = e.target.value;
                      set({ rows });
                    }}
                  />
                  <select
                    value={btn.type}
                    onChange={(e) => {
                      const rows = block.rows.map((r) => r.map((x) => ({ ...x })));
                      rows[ri][ci].type = e.target.value as TgButton['type'];
                      set({ rows });
                    }}
                  >
                    <option value="url">{t('Opens a link', 'باز کردن لینک')}</option>
                    <option value="copy_text">{t('Copies text', 'کپی متن')}</option>
                  </select>
                  <select
                    value={btn.style}
                    onChange={(e) => {
                      const rows = block.rows.map((r) => r.map((x) => ({ ...x })));
                      rows[ri][ci].style = e.target.value as TgButton['style'];
                      set({ rows });
                    }}
                  >
                    <option value="success">{t('Green', 'سبز')}</option>
                    <option value="primary">{t('Blue', 'آبی')}</option>
                    <option value="danger">{t('Red', 'قرمز')}</option>
                  </select>
                  <input
                    dir="ltr"
                    placeholder={btn.type === 'url' ? 'https://t.me/…' : t('text to copy', 'متنی که کپی می‌شود')}
                    value={btn.type === 'url' ? btn.url || '' : btn.text || ''}
                    onChange={(e) => {
                      const rows = block.rows.map((r) => r.map((x) => ({ ...x })));
                      if (btn.type === 'url') rows[ri][ci].url = e.target.value;
                      else rows[ri][ci].text = e.target.value;
                      set({ rows });
                    }}
                  />
                  <button className="cmp-x" onClick={() => set({ rows: block.rows.map((r, k) => (k === ri ? r.filter((_, c) => c !== ci) : r)).filter((r) => r.length) })} aria-label="remove button">
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button
                className="cmp-mini"
                onClick={() =>
                  set({ rows: block.rows.map((r, k) => (k === ri ? [...r, { id: uid(), label: 'دکمه', type: 'url', style: 'primary', url: 'https://t.me/Config7x' }] : r)) })
                }
              >
                + {t('Button', 'دکمه')}
              </button>
            </div>
          ))}
          <button
            className="cmp-mini"
            onClick={() => set({ rows: [...block.rows, [{ id: uid(), label: 'دکمه', type: 'url', style: 'primary', url: 'https://t.me/Config7x' }]] })}
          >
            + {t('New row', 'ردیف جدید')}
          </button>
        </>
      );

    case 'image':
      return (
        <>
          <Field label={t('Image link (https)', 'لینک عکس (https)')}>
            <input dir="ltr" value={block.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://…/photo.jpg" />
          </Field>
          <Field label={t('Caption (optional)', 'کپشن (اختیاری)')}>
            <input value={block.caption} onChange={(e) => set({ caption: e.target.value })} />
          </Field>
        </>
      );

    case 'details':
      return (
        <>
          <Field label={t('Title', 'عنوان')}>
            <input value={block.summary} onChange={(e) => set({ summary: e.target.value })} />
          </Field>
          <Field label={t('Hidden content', 'محتوای داخلش')}>
            <textarea rows={3} value={block.text} onChange={(e) => set({ text: e.target.value })} />
          </Field>
        </>
      );

    case 'time':
      return (
        <>
          <Field label={t('Label', 'متن')}>
            <input value={block.label} onChange={(e) => set({ label: e.target.value })} />
          </Field>
          <Field label={t('Moment', 'زمان')}>
            <div className="cmp-inline">
              <button className="cmp-mini" onClick={() => set({ unix: String(Math.floor(Date.now() / 1000)) })}>
                {t('Now', 'همین حالا')}
              </button>
              <button className="cmp-mini" onClick={() => set({ unix: String(Math.floor(Date.now() / 1000) + 3600) })}>
                {t('In 1 hour', 'یک ساعت بعد')}
              </button>
              <button className="cmp-mini" onClick={() => set({ unix: String(Math.floor(Date.now() / 1000) + 86400) })}>
                {t('Tomorrow', 'فردا')}
              </button>
            </div>
          </Field>
        </>
      );

    case 'math':
      return (
        <Field label={t('Formula (LaTeX)', 'فرمول (LaTeX)')}>
          <input dir="ltr" value={block.latex} onChange={(e) => set({ latex: e.target.value })} />
        </Field>
      );

    default:
      return null;
  }
}
