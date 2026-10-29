// The "همه‌ی امکانات" map: every capability the two projects have, grouped so
// nothing is buried. Each item names an action id that App.tsx resolves to a
// page, a modal or the bot itself.

export type HubAction =
  | { to: 'page'; page: string }
  | { to: 'modal'; modal: string }
  | { to: 'link'; url: string };

export type HubItem = {
  title: [string, string];
  desc: [string, string];
  badge?: [string, string];
  act: HubAction;
};

export type HubGroup = {
  key: string;
  title: [string, string];
  subtitle: [string, string];
  emoji: string;
  accent: string;
  items: HubItem[];
};

export const BOT_URL = 'https://t.me/rich7xapp';

export const HUB: HubGroup[] = [
  {
    key: 'build',
    title: ['Build & design', 'ساخت و طراحی'],
    subtitle: ['From an idea to a finished post, no code', 'از ایده تا پست آماده، بدون کد'],
    emoji: '🎨',
    accent: '#34d399',
    items: [
      { title: ['Quick build', 'ساخت سریع'], desc: ['Seven ready layouts, three steps', 'هفت قالب آماده، سه قدم'], badge: ['New', 'تازه'], act: { to: 'page', page: 'easy' } },
      { title: ['Visual composer', 'کامپوزر بصری'], desc: ['86 blocks: title, table, button, media', '۸۶ بلوک: تیتر، جدول، دکمه، مدیا'], act: { to: 'page', page: 'compose' } },
      { title: ['Message studio', 'استودیوی پیام'], desc: ['Full editor with send and edit', 'ادیتور کامل با ارسال و ویرایش'], act: { to: 'page', page: 'studio' } },
      { title: ['Template library', 'کتابخانه الگوها'], desc: ['Start from a finished structure', 'شروع از یک ساختار آماده'], act: { to: 'page', page: 'templates' } },
      { title: ['Rich buttons', 'دکمه‌های ریچ'], desc: ['Colour, copy-text and inline rows', 'دکمه‌ی رنگی، کپی‌متن و اینلاین'], act: { to: 'modal', modal: 'button' } },
      { title: ['Tables and data', 'جدول و داده'], desc: ['Build a table without writing tags', 'ساخت جدول بدون نوشتن تگ'], act: { to: 'modal', modal: 'table' } },
      { title: ['Media and gallery', 'مدیا و گالری'], desc: ['Photo, video and carousel', 'عکس، ویدیو و کاروسل'], act: { to: 'modal', modal: 'media' } },
      { title: ['Formula and formatting', 'فرمول و قالب‌بندی'], desc: ['Math, captions, spoilers', 'ریاضی، زیرنویس، اسپویلر'], act: { to: 'modal', modal: 'formatting' } },
    ],
  },
  {
    key: 'ai',
    title: ['Artificial intelligence', 'هوش مصنوعی'],
    subtitle: ['Gemini, Grok and more with your own key', 'گمنای، گروک و بیشتر با کلید خودت'],
    emoji: '✦',
    accent: '#a78bfa',
    items: [
      { title: ['Write a post with AI', 'ساخت پست با AI'], desc: ['Give a topic, get title, body and bullets', 'موضوع بده، تیتر و متن و نکته‌ها ساخته می‌شود'], badge: ['New', 'تازه'], act: { to: 'modal', modal: 'ai' } },
      { title: ['Improve the copy', 'بهبود متن'], desc: ['Rewrite what you already wrote', 'بازنویسی روان‌تر همان متن'], act: { to: 'page', page: 'easy' } },
      { title: ['Premium emoji', 'ایموجی پریمیوم'], desc: ['Animated emoji from Telegram packs', 'ایموجی متحرک از پک‌های تلگرام'], act: { to: 'modal', modal: 'emoji' } },
      { title: ['Key settings', 'تنظیمات کلید'], desc: ['Provider, key and a live test', 'سرویس‌دهنده، کلید و تست'], act: { to: 'page', page: 'settings' } },
    ],
  },
  {
    key: 'publish',
    title: ['Publishing and growth', 'انتشار و رشد'],
    subtitle: ['Get the message to the right audience', 'رساندن پیام به مخاطب درست'],
    emoji: '🚀',
    accent: '#38bdf8',
    items: [
      { title: ['My channels', 'کانال‌های من'], desc: ['Add and pick the destination', 'افزودن و انتخاب مقصد ارسال'], act: { to: 'page', page: 'channels' } },
      { title: ['Saved drafts', 'پیش‌نویس‌ها'], desc: ['Keep it and come back later', 'ذخیره و بازگشت به ایده‌ها'], act: { to: 'page', page: 'drafts' } },
      { title: ['Send and edit', 'ارسال و ویرایش'], desc: ['Silent, protected, ephemeral', 'ارسال بی‌صدا، محافظت از محتوا، پیام موقت'], act: { to: 'page', page: 'studio' } },
      { title: ['Broadcast and stats', 'برادکست و آمار'], desc: ['/broadcast and /stats in the bot', 'دستورهای /broadcast و /stats'], act: { to: 'page', page: 'guide' } },
      { title: ['Invite and quota', 'دعوت و سهمیه'], desc: ['Referral link and extra quota', 'لینک رفرال و افزایش سهمیه'], act: { to: 'page', page: 'settings' } },
    ],
  },
  {
    key: 'admin',
    title: ['Admin', 'پنل مدیریت'],
    subtitle: ['Bot settings and forced join', 'تنظیمات ربات و جوین اجباری'],
    emoji: '⚙️',
    accent: '#8b96a1',
    items: [
      { title: ['Admin panel', 'پنل ادمین'], desc: ['/admin for quota and users', 'دستور /admin برای سهمیه و کاربران'], act: { to: 'link', url: BOT_URL } },
      { title: ['Forced join', 'جوین اجباری'], desc: ['Entry channel and membership check', 'کانال ورودی و شرط عضویت'], act: { to: 'link', url: BOT_URL } },
      { title: ['Bulk message', 'پیام همگانی'], desc: ['/broadcast to every user', 'ارسال به همه‌ی کاربران با /broadcast'], act: { to: 'link', url: BOT_URL } },
      { title: ['Reports', 'آمار و گزارش'], desc: ['Users, sends and channels', 'کاربر، ارسال و کانال'], act: { to: 'link', url: BOT_URL } },
    ],
  },
];
