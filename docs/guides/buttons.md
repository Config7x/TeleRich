# دکمه‌های ریچ · Rich buttons

دکمه‌ها **داخل متن** می‌آیند و در همهٔ کلاینت‌ها رندر می‌شوند.

## دو نوع اکشن

```html
<!-- لینک -->
<tg-button type="url" url="https://t.me/Config7x" style="primary">کانال ما</tg-button>

<!-- کپی متن: کاربر با یک لمس کانفیگ را کپی می‌کند -->
<tg-button type="copy_text" text="vless://…" style="success">📋 کپی کانفیگ</tg-button>
```

## استایل‌ها

| استایل | رنگ | کجا |
|---|---|---|
| `success` | سبز | کپی، خرید، اقدام اصلی |
| `primary` | آبی | لینک کانال، اطلاعات بیشتر، دانلود |
| `danger` | قرمز | اشتراک‌گذاری، هشدار |

## ردیف دکمه

```html
<tg-button-row align="center">
  <tg-button type="copy_text" style="success" text="vless://…">📋 کپی</tg-button>
  <tg-button type="url" style="primary" url="https://t.me/Config7x">📥 بیشتر</tg-button>
</tg-button-row>
```

نکته: متن دکمه کوتاه بماند (زیر ۳۰ نویسه) تا در موبایل دو دکمه در یک ردیف جا شوند.
