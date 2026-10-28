# نصب اختصاصی / Self-host

## ۱) پیش‌نیاز
- Node.js 18+
- حساب کلادفلر + `npx wrangler login`
- ربات ساخته‌شده در @BotFather

## ۲) نصب و بیلد

```bash
npm install
npm run build      # مینی‌اپ تک‌فایل + worker/index.js
```

## ۳) مقادیر و رازها

`wrangler.jsonc` → بخش `vars`: `FREE_LIMIT`، `REF_BONUS`، `QUOTA_EXEMPT`.

```bash
npx wrangler secret put BOT_TOKEN
npx wrangler secret put WEBHOOK_SECRET
npx wrangler secret put ADMIN_KEY
```

KV بسازید و `id` را در `wrangler.jsonc` بگذارید:

```bash
npx wrangler kv namespace create RICHKV
```

## ۴) انتشار

```bash
npx wrangler deploy
```

## ۵) اتصال ربات

در استودیو، بخش تنظیمات → کلید اپراتور را وارد کنید و «اتصال» را بزنید؛
وبهوک و دستورات ربات خودکار تنظیم می‌شوند. یا دستی:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<worker>/webhook" -d "secret_token=<WEBHOOK_SECRET>"
```

## ۶) تست

```bash
npm test
```

## دامنهٔ اختصاصی

در `wrangler.jsonc` بخش `routes` را به دامنهٔ خودتان تغییر دهید.
