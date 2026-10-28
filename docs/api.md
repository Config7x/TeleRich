# API استودیو / Studio API

همهٔ روت‌ها `POST` هستند و بدنهٔ JSON می‌گیرند (حداکثر ۵۱۲ کیلوبایت).
احراز هویت: `initData` مینی‌اپ یا هدر `Authorization: Bearer <ADMIN_KEY>`.

| روت | کار | بدنهٔ مهم |
| --- | --- | --- |
| `/api/connect` | تست اتصال (`getMe`) | — |
| `/api/webhook` | تنظیم وبهوک و دستورات ربات (فقط اپراتور) | — |
| `/api/channel` | اطلاعات چت مقصد و نوع آن | `chat_id` |
| `/api/send` | ساخت پیام ریچ | `chat_id`، `rich_message`، `reply_markup`، `ephemeral_message_parameters` |
| `/api/draft` | پیش‌نویس پیام (استریم) | `draft_id`، `can_stop`، `keep_on_stop` |
| `/api/edit` | ویرایش پیام ارسال‌شده | `chat_id`، `message_id`، `rich_message` |
| `/api/delete` | حذف پیام | `chat_id`، `message_id` |
| `/api/editEphemeralMessageText` | ویرایش متن پیام موقت (گروه) | `receiver_user_id`، `ephemeral_message_id` |
| `/api/editEphemeralMessageCaption` | ویرایش کپشن پیام موقت | همان |
| `/api/editEphemeralMessageReplyMarkup` | تغییر دکمه‌های پیام موقت | همان |
| `/api/deleteEphemeralMessage` | حذف پیام موقت | همان |

## قواعد

- `ephemeral_message_*` در کانال پشتیبانی نمی‌شود؛ فقط گروه.
- کاربر عادی فقط پیام موقت خودش را می‌تواند تغییر دهد.
- ارسال به چت خصوصی خود ربات رایگان است؛ کانال/گروه از سهمیه کم می‌کند.
- خطاها با `{ ok: false, description }` و کد HTTP مناسب برمی‌گردند.
