# Content Span — marketing site

Static marketing website and interactive demo for **Content Span**, a content marketing app with a team content calendar, kanban boards, connected analytics and recommendations, production planning, and Excel/CSV reporting.

## Pages

| Page | File |
|---|---|
| Home (overview, screenshots, demo CTA) | `index.html` |
| About → Product features | `features.html` |
| About → Role-specific benefits (Production, Social, Brand services, Sales, Marketing) | `roles.html` |
| Integrations | `integrations.html` |
| Pricing | `pricing.html` |
| Demo mode (interactive sample workspace) | `demo.html` |
| Log in / Sign up | `login.html` |

The header and footer for every page come from `assets/site.js`. The dark/light toggle is in the header, and the choice is remembered per browser.

## Demo mode

`demo.html` + `assets/demo.js` is a fully in-browser sample workspace. Nothing is sent to a server, and everything resets on reload.

- **Calendar**: month view, drag entries between days, gap highlighting, channel filter
- **Board**: kanban columns shared with the calendar status, drag between columns
- **Analytics**: KPIs, engagement by channel, weekly reach, channel mix, recommendations and gaps
- **Production**: brief and goals, logistics, shoot schedule, equipment list
- **Files**: project file list with folders, search and local-only upload
- **Team**: department roles and per-department App / Email / Slack notification settings
- **Required tagging**: every entry must tag a person or department; tagged people get notified
- **Export**: formatted `.xlsx` (via ExcelJS from cdnjs) and `.csv`

## Run locally

Any static file server works:

```bash
npx http-server . -p 5180 -c-1
```

Then open http://localhost:5180.

## Placeholders to replace before launch

- Pricing tiers and amounts in `pricing.html`
- Testimonial-style quotes in `roles.html`
- Log in / Sign up forms aren't connected to any backend yet
- "Screenshots" are HTML mockups; swap them for real product captures when the app exists
