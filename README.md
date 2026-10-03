# Campaign Span — marketing site

Static marketing website and interactive demo for **Campaign Span**, a content marketing app with a team content calendar, kanban boards, connected analytics and recommendations, production planning, and Excel/CSV reporting.

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
| About us | `about.html` |
| Terms of service, Privacy policy, Cookie policy, Legal notice | `terms.html`, `privacy.html`, `cookies.html`, `legal.html` |
| Admin console (not linked from the site, `noindex`) | `admin.html` |

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

## Admin console

`admin.html` + `assets/admin.js` is an internal tool for sales and customer success:

- **Demo environments**: build a tailored demo (company, industry, brand colour, channels, the client's own team, notification defaults, banner, sample-data level) and share it as a link. The whole configuration travels inside the link (`demo.html?env=…`, defined in `assets/env.js`), so it works on any device with no server.
- **Client onboarding**: empty workspaces with a 9-step onboarding checklist and progress tracking.
- **Troubleshooting**: live health checks (pages, scripts, CDNs, browser support), a demo-link inspector, and browser details to collect from clients.
- **Service settings**: defaults for new environments, links to hosting/code/DNS, and an activity log.

**Sign-in and storage** use Supabase (project `campaign-span`, region `ca-central-1`):

- Admins sign in with email and password. Only emails in the `admin_users` table get in; everyone else sees "no admin access".
- Environments, onboarding progress, settings and the activity log live in `admin_environments`, `admin_settings` and `admin_log`, shared by all admins.
- Row-level security on every table calls `is_admin()`, which requires a signed-in user whose confirmed email is on the allowlist. The publishable key in `assets/admin.js` is public by design.

To add an admin: in Supabase, add a user under Authentication → Users, then run
`insert into public.admin_users (email) values ('person@example.com');`

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
