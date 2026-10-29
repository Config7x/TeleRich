# TeleRich × RasaRichBot — capability matrix

Working document for the merge. TeleRich is the base project and keeps its own
repository, design and bot. RasaRichBot is a reference only: its behaviour is
studied and re-implemented here, never copied wholesale.

Legend: **have** = implemented in TeleRich · **ported** = taken from Rasa and
re-implemented · **gap** = exists in Rasa, not yet in TeleRich.

## Bot commands

| Capability | TeleRich | Rasa | Action |
| --- | --- | --- | --- |
| `/start`, `/help`, menus | have | have | keep TeleRich menu |
| `/ai` writing | have (multi-provider) | have | keep TeleRich |
| `/emoji` packs | ported | have | done: `/emoji <link>`, 30 packs |
| `/key` `<apikey>` | have | n/a | keep |
| `/aitest` | have | n/a | keep |
| `/dest` delivery target | have | n/a | keep |
| `/join` forced join | have | n/a | keep |
| `/stats`, `/admin`, `/broadcast` | have | n/a | keep |
| `/buttons`, `/table`, `/media` demos | partial (library) | have | gap: quick demo posts |
| `/updates`, `/guide`, `/about` | have | have | keep |

## Mini App

| Capability | TeleRich | Rasa | Action |
| --- | --- | --- | --- |
| Visual block builder | have (86 blocks) | have | keep, polish UX |
| Live preview | have | have | keep |
| Templates | have (13) | have | port more presets |
| Premium emoji engine | ported | have | done |
| AI composer | have | have | keep |
| Carousel / slideshow | have (`slideshow` block) | have | verify parity |
| Live auto-updating post | have (`live` block) | have (`live_render`) | verify parity |
| Table builder | have | have | verify parity |
| Community / landing templates | gap | have | port next |
| Interactive API (edit sent post) | gap | have | port next |
| Navigation drawer | ported (fixed) | n/a | done |
| Theme skins | have (3) | n/a | new |

## Next build order

1. Community and landing post presets (Rasa `community_render`, `landing_render`).
2. Interactive edit API: edit an already sent post from the Mini App.
3. `/buttons`, `/table`, `/media` demo commands inside the bot.
4. Parity audit of `slideshow` and `live` between the two renderers.
