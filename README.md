# Campaign Span — marketing site

Static marketing website and interactive demo for **Campaign Span**, a content marketing app with a team content calendar, kanban boards, connected analytics and recommendations, production planning, and Excel/CSV reporting.

## Current status and scope

**This repository contains a marketing website and interactive product demo, not a complete production SaaS application.** The demo uses sample data in the browser and resets on reload. Public product log-in/sign-up forms are not connected to a backend; the separate admin console has its own authenticated API and storage.

Pricing, testimonial-style quotes, and product imagery include placeholders. See the launch checklist below for details.

**[Explore the live site and demo](https://campaign-span.vercel.app)**

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

**Sign-in and storage** use Clerk and Turso, through a small API in `api/` that runs as Vercel Functions:

- Admins sign in with Clerk (the sign-in box on `admin.html`). The page asks `/api/config` for the Clerk publishable key, which is public by design.
- `/api/admin` checks the Clerk session on every request and only lets in users with a verified email listed in the `ADMIN_EMAILS` setting; everyone else sees "no admin access". The browser never talks to the database directly.
- Environments, onboarding progress, settings and the activity log live in the `admin_environments`, `admin_settings` and `admin_log` tables in Turso, shared by all admins. The tables are created automatically on first use.

Settings (Vercel → Settings → Environment Variables): `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `ADMIN_EMAILS` (comma-separated).

To add an admin: add their email to `ADMIN_EMAILS` and redeploy. They sign in with that email through Clerk.

## Run locally

Any static file server works for the marketing site and demo:

```bash
npx http-server . -p 5180 -c-1
```

Then open http://localhost:5180. The admin console also needs its API, so run it with `npx vercel dev` (after `npm install`) and the settings above in `.env.local`.

## Placeholders to replace before launch

- Pricing tiers and amounts in `pricing.html`
- Testimonial-style quotes in `roles.html`
- Log in / Sign up forms aren't connected to any backend yet
- "Screenshots" are HTML mockups; swap them for real product captures when the app exists
