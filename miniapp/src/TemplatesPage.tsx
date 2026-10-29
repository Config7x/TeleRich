import { useState, useMemo } from 'react';
import { Search, Sparkles, Wand2, X } from 'lucide-react';
import { templates, blocksToHtml, Template } from './blocks';
import './templates.css';

export interface TemplatesPageProps {
  lang: 'en' | 'fa';
  onUse: (blocks: any[]) => void;
  notify: (m: string) => void;
}

type CategoryKey = 'All' | 'Config' | 'Promo' | 'Guide' | 'Media';

export function getCategory(tpl: Template): CategoryKey {
  const id = (tpl.id || '').toLowerCase();
  const name = (tpl.name || '').toLowerCase();

  if (id.includes('config') || name.includes('کانفیگ')) {
    return 'Config';
  }

  if (
    id.includes('sale') ||
    id.includes('promo') ||
    id.includes('giveaway') ||
    id.includes('profile') ||
    id.includes('buttonset') ||
    /فروش|تخفیف|جشنواره|پلن|خرید|هدیه|قرعه|پروفایل|اکانت/i.test(name)
  ) {
    return 'Promo';
  }

  if (
    id.includes('media') ||
    id.includes('slides') ||
    id.includes('art') ||
    /مدیا|رسانه|تصویر|عکس|اسلاید/i.test(name)
  ) {
    return 'Media';
  }

  if (
    id.includes('guide') ||
    id.includes('tutorial') ||
    id.includes('faq') ||
    id.includes('changelog') ||
    id.includes('announce') ||
    id.includes('welcome') ||
    id.includes('report') ||
    id.includes('blank') ||
    id.includes('levels') ||
    id.includes('livepoll') ||
    /آموزش|راهنما|اطلاعیه|خبر|تغییرات|سوال|سؤال|پاسخ|گزارش|خوش/i.test(name)
  ) {
    return 'Guide';
  }

  return 'Guide';
}

export default function TemplatesPage({ lang, onUse, notify }: TemplatesPageProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('All');

  const categories: { key: CategoryKey; labelEn: string; labelFa: string }[] = [
    { key: 'All', labelEn: 'All', labelFa: 'همه' },
    { key: 'Config', labelEn: 'Config', labelFa: 'کانفیگ' },
    { key: 'Promo', labelEn: 'Promo', labelFa: 'پروموشن' },
    { key: 'Guide', labelEn: 'Guide', labelFa: 'راهنما' },
    { key: 'Media', labelEn: 'Media', labelFa: 'مدیا' },
  ];

  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryKey, number> = {
      All: templates.length,
      Config: 0,
      Promo: 0,
      Guide: 0,
      Media: 0,
    };

    templates.forEach((tpl) => {
      const cat = getCategory(tpl);
      counts[cat] = (counts[cat] || 0) + 1;
    });

    return counts;
  }, []);

  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const matchesCat = activeCategory === 'All' || getCategory(tpl) === activeCategory;
      const q = search.trim().toLowerCase();
      const matchesQuery =
        !q ||
        tpl.name.toLowerCase().includes(q) ||
        tpl.id.toLowerCase().includes(q);

      return matchesCat && matchesQuery;
    });
  }, [search, activeCategory]);

  const handleUseTemplate = (tpl: Template) => {
    const builtBlocks = tpl.build();
    onUse(builtBlocks);
    notify(
      lang === 'fa'
        ? `الگوی «${tpl.name}» اعمال شد`
        : `Template "${tpl.name}" applied`
    );
  };

  return (
    <div className="templates-container">
      <header className="templates-header">
        <h1 className="templates-title">
          {lang === 'fa' ? 'الگوهای آماده پست' : 'Ready-made Post Templates'}
        </h1>
        <p className="templates-subtitle">
          {lang === 'fa'
            ? 'الگوی مورد نظر خود را انتخاب کنید تا ساختار کامل آن به ویرایشگر اضافه شود.'
            : 'Select a template to quickly insert its complete block structure into your composer.'}
        </p>
      </header>

      <section className="templates-controls">
        <div className="templates-search-wrapper">
          <Search size={16} className="templates-search-icon" />
          <input
            type="text"
            className="templates-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              lang === 'fa'
                ? 'جستجوی الگو براساس نام یا عنوان...'
                : 'Search templates by name or ID...'
            }
          />
          {search && (
            <button
              style={{
                position: 'absolute',
                insetInlineEnd: 12,
                background: 'none',
                border: 'none',
                color: 'var(--muted)',
                cursor: 'pointer',
              }}
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="templates-chips" role="tablist">
          {categories.map((cat) => {
            const label = lang === 'fa' ? cat.labelFa : cat.labelEn;
            const count = categoryCounts[cat.key];
            const isActive = activeCategory === cat.key;

            return (
              <button
                key={cat.key}
                className={`template-chip ${isActive ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat.key)}
                role="tab"
                aria-selected={isActive}
              >
                <span>{label}</span>
                <span className="template-chip-count">{count}</span>
              </button>
            );
          })}
        </div>
      </section>

      {filteredTemplates.length > 0 ? (
        <div className="templates-grid">
          {filteredTemplates.map((tpl) => {
            const builtBlocks = tpl.build();
            const previewHtml = blocksToHtml(builtBlocks);
            const blockCount = builtBlocks.length;

            return (
              <article key={tpl.id} className="template-card">
                <header className="template-card-header">
                  <div className="template-icon-tile" aria-hidden="true">
                    {tpl.icon}
                  </div>
                  <div className="template-card-meta">
                    <h2 className="template-card-title">{tpl.name}</h2>
                    <span className="template-badge">
                      {blockCount} {lang === 'fa' ? 'بلاک' : 'blocks'}
                    </span>
                  </div>
                </header>

                <div className="template-thumb-box" aria-hidden="true">
                  <div
                    className="template-thumb-inner"
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                  <div className="template-thumb-overlay" />
                </div>

                <button
                  type="button"
                  className="template-use-btn"
                  onClick={() => handleUseTemplate(tpl)}
                >
                  <Wand2 size={14} />
                  <span>
                    {lang === 'fa' ? 'استفاده از الگو' : 'Use template'}
                  </span>
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="templates-empty">
          <Sparkles size={28} />
          <p>
            {lang === 'fa'
              ? 'هیچ الگویی متناسب با جستجوی شما یافت نشد.'
              : 'No templates matched your search filter.'}
          </p>
          <button
            type="button"
            className="templates-empty-reset"
            onClick={() => {
              setSearch('');
              setActiveCategory('All');
            }}
          >
            {lang === 'fa' ? 'پاک‌کردن فیلترها' : 'Reset filters'}
          </button>
        </div>
      )}
    </div>
  );
}
