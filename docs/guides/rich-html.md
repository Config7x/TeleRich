# مرجع متن ریچ · Rich text reference

TeleRich هر دو ورودی **Markdown** و **HTML** را می‌پذیرد. اگر پیام تگ HTML داشته باشد، به‌عنوان HTML پردازش می‌شود؛ وگرنه Markdown.

## تگ‌های پشتیبانی‌شده

| تگ | نتیجه | نمونه |
|---|---|---|
| `<b>` | بولد | `<b>مهم</b>` |
| `<i>` | ایتالیک | `<i>تأکید</i>` |
| `<u>` | زیرخط | `<u>لینک‌دار</u>` |
| `<s>` | خط‌خورده | `<s>قیمت قبلی</s>` |
| `<tg-spoiler>` | اسپویلر | `<tg-spoiler>جواب</tg-spoiler>` |
| `<mark>` | هایلایت | `<mark>تخفیف</mark>` |
| `<code>` | کد تک‌خطی | `<code>vless://…</code>` |
| `<pre>` | بلوک کد | `<pre>line1\nline2</pre>` |
| `<blockquote>` | بلاک‌کوت | `<blockquote>نقل</blockquote>` |
| `<blockquote expandable>` | بلاک‌کوت بازشونده | برای متن بلند |
| `<aside>` | جملهٔ برجسته | `<aside>نکته</aside>` |
| `<details><summary>` | بخش بازشو | `<details><summary><b>عنوان</b></summary>متن</details>` |
| `<a href>` | لینک | `<a href="https://t.me/Config7x">کانال</a>` |
| `<tg-time>` | ساعت زنده | `<tg-time unix="1893456000" format="wDT">زمان</tg-time>` |
| `<tg-math>` | فرمول | `<tg-math>e^{i\pi}+1=0</tg-math>` |

## بلاک‌کوت تودرتو (الگوی کانفیگ)

```html
<blockquote><blockquote><code>vless://…</code></blockquote><cite>روی کانفیگ بزن تا کپی شود</cite></blockquote>
```

قاعدهٔ طلایی: تگ‌ها باید متوازن باشند. اگر `<b>` باز می‌کنید، `</b>` ببندید؛ تست‌های پروژه همین را برای همهٔ بلوک‌ها بررسی می‌کنند.
