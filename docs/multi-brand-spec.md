# Multi-brand workspaces: product and technical spec

Status: draft for the production app, October 2026. The interactive demo (`demo.html`) already shows this behaviour with sample data, so use it as the reference for how things should look and feel.

## Goal

One company or agency manages several brands from a single login. Each brand keeps its own content calendar, production work, connected social accounts and reporting, and nothing leaks between brands. Admins decide which people can open which brands, and what they can do on each.

## Concepts

| Term | Meaning |
|---|---|
| **Workspace** | The paying customer (a company or agency). Owns billing, the plan, the people list and departments. |
| **Brand** | A separately run brand inside a workspace. Owns its calendar, board, production projects, files, connected accounts, analytics and exports. Every workspace has at least one brand. |
| **Member** | A person in the workspace. Signs in once. Has one department role (Production, Social, Brand services, Sales, Marketing or custom), which controls department notifications. |
| **Brand role** | What a member can do on one brand: Brand lead, Editor or Viewer. A member can hold a different role on each brand, or have no access to it. |
| **Workspace admin** | A member who can manage every brand, the people list, departments, billing and the plan. Admins don't need a brand role to open a brand. |

## Permissions

| Action | Workspace admin | Brand lead | Editor | Viewer | No access |
|---|---|---|---|---|---|
| See the brand in the switcher and "All brands" | ✓ | ✓ | ✓ | ✓ | — |
| View calendar, board, production, files, analytics | ✓ | ✓ | ✓ | ✓ | — |
| Export reports (Excel, CSV) | ✓ | ✓ | ✓ | ✓ | — |
| Create, edit, move and delete entries; edit production, upload files | ✓ | ✓ | ✓ | — | — |
| Connect and disconnect the brand's accounts | ✓ | ✓ | — | — | — |
| Add people to the brand and change their brand role | ✓ | ✓ (own brand) | — | — | — |
| Rename, recolour or archive the brand | ✓ | ✓ | — | — | — |
| Create brands, change departments, notification defaults, billing and plan | ✓ | — | — | — | — |

Rules:

- Every brand must have at least one brand lead. The last lead can't be demoted or removed until someone else is made lead (the demo enforces this).
- Permissions are checked on the server for every request. The UI hides controls a person can't use, but the API is the source of truth.
- A member with no brand access can still sign in. They see an empty state explaining that an admin needs to add them to a brand.
- Removing someone from a brand revokes access straight away, including open sessions. Their past work (entries they created, files they uploaded) stays on the brand.

## Plan limits

| Plan | Brands included |
|---|---|
| Starter | 1 |
| Team | 2 |
| Business | 5 |
| Enterprise | Unlimited |

- Pricing stays per user. A person on several brands is one seat.
- At the limit, "Add brand" is replaced by an upgrade prompt that links to plan comparison.
- Downgrading below the number of brands in use is blocked until the extra brands are archived. Archived brands are read-only and don't count toward the limit.

## Data model

All brand-owned records carry a `brand_id`. Workspace-level records carry a `workspace_id`.

```text
workspaces        id, name, plan, created_at
members           id, workspace_id, user_id, name, email, department, is_admin, created_at
brands            id, workspace_id, name, industry, color, status (active | archived), created_at
brand_access      brand_id, member_id, role (lead | editor | viewer), granted_by, granted_at
                  primary key (brand_id, member_id)

-- owned by a brand
connected_accounts  id, brand_id, platform, external_account_id, handle, token_ref, status, connected_at
entries             id, brand_id, title, channel, status, publish_at, notes, created_by, ...
entry_tags          entry_id, member_id | department
projects            id, brand_id, name, shoot_date, brief, goals, audience, ...
project_schedule, call_sheet, equipment, files    (all keyed by project_id → brand_id)
metrics_daily       brand_id, connected_account_id, date, reach, engagements, revenue, ...

-- workspace level
notifications     id, workspace_id, brand_id (nullable), recipient_member_id, title, detail, read_at, created_at
department_settings  workspace_id, department, app, email, slack
```

Notes:

- `connected_accounts` belong to a brand, never to the workspace. The same Instagram account can't be connected to two brands at once, so results can't be counted twice. Enforce this with a unique index on `(platform, external_account_id)` among active accounts.
- Analytics and exports always filter by `brand_id`. The cross-brand comparison runs one aggregate query per brand the viewer can access.
- Slack routing stays per department, but each message says which brand it's about.

## Key screens and flows

1. **Brand switcher**: in the sidebar, listing only the brands the person can open, with their role underneath. The choice is remembered per person and device.
2. **All brands**: a card per brand (planned posts for the next 14 days, gaps, 30-day reach and engagement, connected accounts, team) and a comparison table with CSV export. Admins can also add brands here.
3. **Team → Brand access**: a grid of people by brands, where each cell is No access, Viewer, Editor or Brand lead. Admins can edit every column. Brand leads can edit only their own brand's column.
4. **Read-only mode**: viewers see a banner. Editing controls are hidden, dragging is off, and entries open read-only. Filters, search and exports still work.
5. **Notifications**: one feed across brands, labelled by brand, showing only brands the person can access. Department filters still apply.
6. **Exports**: file names and report headers include the brand name, for example `campaign-span-northwind-cafe-report-2026-10-21.xlsx`.

## API sketch

```text
GET    /api/brands                      brands the caller can access, with their role
POST   /api/brands                      admin; checks the plan limit
PATCH  /api/brands/:id                  admin or lead
POST   /api/brands/:id/archive          admin or lead
GET    /api/brands/:id/access           lead or admin
PUT    /api/brands/:id/access/:member   lead or admin; body { role } or { role: null }
GET    /api/brands/:id/entries ...      everything brand-owned is nested under /brands/:id
GET    /api/brands/compare?from=&to=    one row per accessible brand
```

Every `/api/brands/:id/...` handler starts with the same check: load `brand_access` for the caller (or confirm they're an admin), confirm the brand belongs to the caller's workspace, and confirm the role allows the action. Return 404, not 403, for brands in other workspaces so their existence isn't revealed.

## Moving existing customers over

- Create one brand per existing workspace, named after the workspace and using its colour. Move all entries, projects, files, accounts and metrics onto it.
- Give every existing member Editor on that brand, and make existing admins Brand lead.
- Nothing changes for single-brand customers until they add a second brand.

## Demo and admin console (already built)

- The demo's standard workspace has three brands (Northwind Apparel, Northwind Café, Northwind Foundation) on the Business plan. "Viewing as" can pick a specific person to see their brands and roles.
- The admin console's environment editor has a **Plan and brands** section, so sales can build tailored multi-brand demos. Brands travel in the demo link (`plan` and `brands` in `assets/env.js`). Links made before this change stay single-brand.

## Open questions

1. **Connected account limits.** Starter lists "3 connected social accounts". Is that per brand or per workspace?
2. **Shared content.** Should an entry be able to go out on several brands at once (cross-posting), or be copied from one brand to another?
3. **Brand-level billing.** Do agencies need invoices split by brand or client?
4. **Client access.** Should an agency be able to invite a client as a viewer on just their brand, without a paid seat?
5. **Archiving.** How long are archived brands kept, and can they be restored?
