# Dubai Lead Gen

Dubai Lead Gen finds Dubai businesses that already have a strong Google Maps presence — high ratings, lots of reviews, complete profiles — but **no website**. It discovers them through the official Google Places API (New), verifies the missing-website signal, analyzes their customer reviews with AI to understand what they do and what customers love, scores each lead with a transparent 0–100 opportunity rubric, and then generates a tailored draft website (live HTML preview plus a downloadable Next.js project) you can use as a sales demo when pitching web design services to the business owner. Everything runs from a single dashboard: search, filter, analyze, generate, preview, export.

> Generated sites are **drafts for sales demos only** — see [Website copy safety rules](#website-copy-safety-rules) and [docs/COMPLIANCE.md](docs/COMPLIANCE.md) before using this tool with real businesses.

---

## Features

### 1. Business discovery
- Search by category (Restaurants, Salons, Clinics, Gyms, Car garages, Law firms, and 12 more from `src/lib/constants.ts`) across 19 predefined Dubai areas (Downtown, Marina, Jumeirah, Deira, Al Quoz, JLT, ...).
- Uses Google Places API (New) Text Search with location bias per area, plus Place Details with strict field masks.
- Quality filters: minimum review count (default 50), minimum rating (default 4.0), optional multi-page fetching per area.
- Automatically skips government offices, embassies, schools and other excluded place types, non-operational businesses, and (optionally) well-known chains/franchises via a name heuristic.
- Upserts businesses and their reviews into the local database with a per-run summary (found / qualified / saved / updated / skipped, with skip reasons).

### 2. Website detection
- `websiteUri` from the Google Maps listing is the primary signal: no URI means `NO_WEBSITE_LISTED`.
- Social/aggregator links (Instagram, Facebook, Linktree, Zomato, Talabat, TripAdvisor, ...) do not count as a real website.
- Optional verification step via Google Custom Search JSON API (Programmable Search Engine): searches for the business name + area + phone and classifies the result as `LIKELY_MISSING`, `POSSIBLY_EXISTS`, `WEBSITE_FOUND`, or `NEEDS_MANUAL_REVIEW`, with human-readable evidence for each decision.

### 3. AI review analysis
- Sends the stored review sample, editorial summary, and profile data to OpenAI (default `gpt-4o-mini`, configurable) with a strict, grounded prompt.
- Produces structured JSON: business summary, main services, target customers, customer praise and complaints, tone, website positioning, recommended site sections, SEO keywords, local SEO phrases, and a suggested CTA.
- Deterministic keyword extraction from review text (stopword-filtered, recurring terms only) runs independently of the AI.

### 4. Opportunity scoring
- Deterministic, transparent 0–100 score computed server-side — same input, same score, with an itemized factor breakdown stored per business. See the [scoring rubric](#opportunity-scoring-rubric).
- Recomputed on every search, website verification, and analysis run.

### 5. Website generation (agency-grade pipeline)
Each website is produced by a multi-step pipeline so different businesses get visibly different, tailored sites — not one template with swapped text:
1. **Collect business data** (profile, reviews, keywords).
2. **Optional public research** (`src/lib/research.ts`) — compliant Custom Search snippets from directories, social profiles, news and articles; every source name/URL is stored.
3. **Review analysis** (existing AI analysis, auto-run when missing).
4. **Creative direction + design brief + design system** (`src/lib/ai/design-brief.ts`) — one structured AI pass produces: a creative concept pitched like an agency director (visual story, signature motif, section rhythm, CTA personality, "why this won't feel generic"); a brand-strategy brief (identity, persona, trust signals, per-claim confidence notes — "unknown" claims are blocked from the copy); a design system (curated font pairing, visual density, section dividers, corner style, motion); and a 6-color visual style (hex-validated with a contrast guard).
5. **Typography** (`src/lib/website-builder/fonts.ts`) — seven curated Google-Fonts pairings (Fraunces, Source Serif 4, Lora, Archivo, Manrope, Space Grotesk, Plus Jakarta Sans) loaded with `display:swap` and curated system-stack fallbacks, so a salon, a garage, and a law firm read in genuinely different typographic voices.
6. **Layout selection** (`src/lib/website-builder/layout-select.ts`) — seven variants chosen from the business profile, never randomly: editorial luxury, bold local service, warm hospitality, calm clinical, portfolio showcase, premium professional, compact conversion landing (used automatically when data is thin). Each layout ships two hero treatments.
7. **Copywriting** (`src/lib/ai/website-copy.ts`) — direction-driven, layout-aware copy with a hard blocklist of generic AI phrases, business-specific feature sections (checklists, what-to-expect steps, first-visit reassurance, menu/practice highlights, perfect-for, service area), and a weak-headline detector with an anchor-based rescue (no site ships with a "Professional … Services" hero).
8. **Rendering** (`src/lib/website-builder/layouts.ts`) — editorial composition per layout: asymmetric section heads with ghost numerals, motif dividers, arrow CTAs, floating info/hours cards, review-theme strips, sticky mobile call bar, reveal-on-scroll (reduced-motion aware), framed pages and roman numerals for professional firms, and an elegant "Concept draft" notice (slim dark ribbon + footer disclaimer — no warning banner).
9. **Design audit + uniqueness gate** (`src/lib/ai/quality-review.ts`, `uniqueness.ts`) — an AI creative-director audit scored 0–100 across ten taste dimensions combined with deterministic scans; drafts under **90** get up to two automatic improvement passes. A structural-signature check (layout + hero variant + palette family + section mix) flips the hero treatment when two businesses would receive the same site.
10. **Save** — copy, creative direction, design system, brief, style, layout, quality report, uniqueness notes, preview HTML, and export code are all persisted.

The generator page doubles as a sales-demo tool: quality score with audit checks, creative direction, design system, palette, per-claim confidence badges, research sources, uniqueness notes, a layout picker, and one-click "regenerate design / rewrite copy / change style".

### 6. Dashboard
- Sortable, filterable leads table (category, area, website status, lead status, min reviews/rating/score, free-text search) with pagination.
- Business detail view: profile data, reviews, keyword chips, score breakdown, analysis results, website preview, and lead actions.
- Lead pipeline: NEW → SAVED → CONTACTED → WON / REJECTED with notes and contacted-at timestamps (never downgrades CONTACTED/REJECTED back to SAVED).
- Settings page for API keys (masked in the UI), default filters, website style, and AI model.
- Optional email/password login protecting the whole app.

### 7. Demo links & client handoff
- **Publish demo link**: one click deploys the draft preview to an unguessable `*.netlify.app` URL (random suffix, `noindex`, draft-labeled) you can share privately with the owner — with a prefilled WhatsApp message to the business's own number. Republishing updates the same URL. Requires a free Netlify personal access token (`NETLIFY_TOKEN` or Settings).
- **Handoff checklist** (on WON leads): deposit received, photos received, content approved by owner, client domain, live URL, notes.
- **Production export**: once the owner has approved the content and a domain is set, a second ZIP export produces the unlabeled production site — draft ribbon and disclaimer removed, search indexing enabled, the client's domain as canonical URL, plus a `DEPLOY.md` walking through Cloudflare Registrar (domain at cost) + Cloudflare Pages (free hosting) and the free-transfer promise to put in the client agreement. Gated server-side: the route refuses unless the lead is WON with `contentApproved` and a valid domain.

### 8. Exports
- CSV export of the current filtered lead list (configurable columns), served as `dubai-leads-<yyyy-mm-dd>.csv`.
- ZIP export of any generated website's Next.js source code (draft-labeled), plus the gated production ZIP above.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS (shadcn-style design tokens), lucide-react icons |
| Database | Prisma ORM — SQLite by default, PostgreSQL-compatible schema |
| AI | OpenAI API (`gpt-4o-mini` default; `gpt-4o`, `gpt-4.1-mini`, `gpt-4.1` selectable) |
| Discovery | Google Places API (New): Text Search + Place Details |
| Verification (optional) | Google Custom Search JSON API (Programmable Search Engine) |
| Tables / forms | @tanstack/react-table, react-hook-form, zod |
| Packaging | JSZip (Next.js project export) |
| Auth | Signed HMAC-SHA256 session cookie (Web Crypto, Edge-middleware compatible) |

---

## Project structure

```
.
├── prisma/
│   ├── schema.prisma              # 6 models (SQLite default, Postgres-compatible)
│   └── seed.ts                    # Fictional demo businesses (no API keys needed)
├── src/
│   ├── middleware.ts              # Session-cookie auth gate (skipped when auth disabled)
│   ├── app/
│   │   ├── layout.tsx             # Root layout (system font stack, theme tokens)
│   │   ├── page.tsx               # Dashboard: search + leads table
│   │   ├── businesses/[id]/page.tsx  # Business detail: reviews, analysis, website
│   │   ├── settings/page.tsx      # API keys + defaults
│   │   ├── login/page.tsx         # Email/password login (when auth enabled)
│   │   ├── globals.css
│   │   └── api/
│   │       ├── auth/login/route.ts
│   │       ├── auth/logout/route.ts
│   │       ├── auth/me/route.ts
│   │       ├── search-businesses/route.ts
│   │       ├── businesses/route.ts
│   │       ├── businesses/[id]/route.ts
│   │       ├── businesses/[id]/analyze/route.ts
│   │       ├── businesses/[id]/verify-website/route.ts
│   │       ├── businesses/[id]/generate-website/route.ts
│   │       ├── businesses/[id]/website-preview/route.ts
│   │       ├── businesses/[id]/export-code/route.ts
│   │       ├── businesses/[id]/publish-demo/route.ts
│   │       ├── businesses/[id]/handoff/route.ts
│   │       ├── businesses/[id]/export-production/route.ts
│   │       ├── businesses/[id]/save-lead/route.ts
│   │       ├── businesses/[id]/update-status/route.ts
│   │       ├── export/csv/route.ts
│   │       └── settings/route.ts
│   ├── components/
│   │   ├── ui/                    # button, card, input, select, table, dialog, badge, ...
│   │   └── dashboard/             # star-rating, status badges, table & detail widgets
│   └── lib/
│       ├── types.ts               # Shared domain types + parseJsonField
│       ├── api-types.ts           # API response DTOs
│       ├── constants.ts           # Dubai areas, categories, chains, intent keywords
│       ├── db.ts                  # Prisma client singleton
│       ├── auth.ts                # HMAC session tokens, authEnabled()
│       ├── settings.ts            # defaults <- env <- DB overrides, maskSettings
│       ├── google-places.ts       # Places API (New) Text Search + Details w/ field masks
│       ├── website-detection.ts   # websiteUri + optional Custom Search verification
│       ├── keywords.ts            # Deterministic review keyword extraction
│       ├── scoring.ts             # Deterministic 0-100 opportunity score
│       ├── serializers.ts         # DB rows -> DTOs
│       ├── csv.ts                 # CSV export
│       ├── utils.ts               # cn, toJsonField, phone/WhatsApp helpers
│       ├── ai/
│       │   ├── openai-client.ts
│       │   ├── copy-rules.ts      # Grounding prompt rules + banned-phrase sanitizer
│       │   ├── analysis.ts        # Review analysis (AnalysisJson)
│       │   └── website-copy.ts    # Website copy generation (WebsiteCopyJson)
│       ├── deploy/
│       │   └── netlify.ts         # Demo-link publishing (Netlify API, ZIP deploy)
│       └── website-builder/
│           ├── preview-html.ts    # Single-file HTML draft preview
│           ├── template.ts        # Generated Next.js project files (draft + production modes)
│           └── zip.ts             # JSZip packaging
├── .env.example
├── package.json
└── tailwind.config.ts
```

---

## Database schema

JSON-ish payloads are stored as **JSON-encoded String columns** so the same schema runs on SQLite and PostgreSQL. Read them with `parseJsonField` (`src/lib/types.ts`) and write with `toJsonField` (`src/lib/utils.ts`).

| Model | Purpose | Key columns |
| --- | --- | --- |
| `Business` | One row per discovered place | `placeId` (unique), `name`, `category`, `area`, `phone`, `rating`, `reviewCount`, `websiteUrl`, `websiteStatus`, `googleMapsUrl`, `openingHours`*, `photosJson`*, `keywordsJson`*, `rawPlaceData`*, `lat`/`lng`, `isLikelyChain`, `opportunityScore`, `scoreBreakdown`* |
| `Review` | Review sample per business (max 5 from the API) | `businessId`, `reviewText`, `reviewRating`, `reviewDate`, `reviewerName` |
| `Analysis` | AI review analysis (1:1 with Business) | `businessSummary`, `strengths`*, `weaknesses`*, `services`*, `seoKeywords`*, `localSeoPhrases`*, `tone`, `suggestedCta`, `recommendedSections`*, `opportunityScore`, `scoreBreakdown`*, `rawJson`* |
| `GeneratedWebsite` | Generated draft site (1:1 with Business) | `homepageCopy`, `seoTitle`, `seoDescription`, `suggestedDomainNames`*, `colorPalette`*, `fontRecommendation`, `generatedCode`* (file map), `previewHtml`, `rawJson`*, `demoUrl`/`demoSiteId`/`demoDeployedAt` |
| `LeadStatus` | CRM-lite pipeline (1:1 with Business) | `status` (`NEW`/`SAVED`/`CONTACTED`/`WON`/`REJECTED`), `notes`, `contactedAt`, `handoffJson`* (delivery checklist) |
| `Setting` | Single row (`id=1`) of settings overrides | `json`* (Partial\<AppSettings\> merged over env + defaults) |

\* JSON-encoded string column.

---

## API reference

All error responses are JSON `{ "error": string }` with an appropriate status code. Response shapes live in `src/lib/api-types.ts`.

| Method | Route | Body / query | Returns |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | `{email, password}` | `{ok: true}` + httpOnly session cookie; `401 {error}` on bad credentials; `400 {error}` if auth is disabled |
| POST | `/api/auth/logout` | — | `{ok: true}`, clears the cookie |
| GET | `/api/auth/me` | — | `{authEnabled: boolean, email: string \| null}` |
| POST | `/api/search-businesses` | `{category, areas[], minReviews?, minRating?, includeChains?, maxPagesPerArea?}` | `SearchBusinessesResponse` — runs Places discovery, upserts businesses + reviews, computes keywords and the deterministic score, sets `websiteStatus` |
| GET | `/api/businesses` | `?category=&area=&minReviews=&minRating=&websiteStatus=&leadStatus=&minScore=&search=&sortBy=&sortDir=&page=&pageSize=` | `BusinessListResponse`. `sortBy` in `score \| reviewCount \| rating \| name \| createdAt` (default `score` desc); `page` default 1, `pageSize` default 25 (max 100) |
| GET | `/api/businesses/[id]` | — | `{business: BusinessDetail}` |
| POST | `/api/businesses/[id]/analyze` | — | `{analysis: AnalysisDto, business: BusinessListItem}` — runs AI review analysis, recomputes the score, upserts the `Analysis` row |
| POST | `/api/businesses/[id]/verify-website` | — | `VerifyWebsiteResponse` — runs website detection, updates `websiteStatus` (+ `websiteUrl` if found) |
| POST | `/api/businesses/[id]/generate-website` | `{mode?: "full"\|"copy"\|"style"}` | `{website: WebsiteDto, research: ResearchResult}` — runs the full 10-step pipeline (`full`, default), rewrites copy only (`copy`), or regenerates brief/style/layout keeping the copy (`style`). Auto-runs the analysis if missing |
| GET | `/api/businesses/[id]/website-preview` | — | `text/html` (stored `previewHtml`); `404` JSON if not generated |
| GET | `/api/businesses/[id]/export-code` | — | `application/zip` download of the generated Next.js project (draft-labeled); `404` if not generated |
| POST | `/api/businesses/[id]/publish-demo` | — | `{website: WebsiteDto, whatsappUrl: string \| null}` — deploys the preview HTML to an unguessable Netlify URL (`demoUrl`); republish updates the same site. `400` without a Netlify token or generated preview |
| POST | `/api/businesses/[id]/handoff` | `Partial<HandoffChecklist>` | `{lead: LeadStatusDto}` — merges the client-delivery checklist and marks the lead `WON` |
| GET | `/api/businesses/[id]/export-production` | — | `application/zip` production site (no draft labels, indexable, canonical = client domain, includes `DEPLOY.md`). `403` unless the lead is `WON` with `contentApproved`; `400` without a valid domain |
| POST | `/api/businesses/[id]/save-lead` | — | `{lead: LeadStatusDto}` — upserts to `SAVED` (never downgrades `CONTACTED`/`REJECTED`) |
| POST | `/api/businesses/[id]/update-status` | `{status: "NEW"\|"SAVED"\|"CONTACTED"\|"WON"\|"REJECTED", notes?}` | `{lead: LeadStatusDto}` — sets `contactedAt` when transitioning to `CONTACTED` |
| GET | `/api/export/csv` | same filters as `/api/businesses`, no paging | `text/csv` attachment `dubai-leads-<yyyy-mm-dd>.csv` |
| GET | `/api/settings` | — | Masked `AppSettings` (API keys shown as `abcd…wxyz`) |
| PUT | `/api/settings` | `Partial<AppSettings>` | Masked settings. Masked API-key values (placeholder bullets) are ignored so a round-tripped form never wipes real keys; an explicit empty string clears the stored key override (env fallback applies) |

---

## Local setup

1. **Install dependencies**

   ```bash
   npm install
   ```

   (`postinstall` runs `prisma generate` automatically.)

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Fill in at minimum:
   - `GOOGLE_MAPS_API_KEY` — a Google Maps Platform key with **Places API (New)** enabled.
   - `OPENAI_API_KEY` — for review analysis and website copy generation.

   Optional: `SEARCH_API_KEY` + `SEARCH_ENGINE_ID` (Custom Search website verification), `NETLIFY_TOKEN` (the Publish-demo-link button — free personal access token from Netlify → User settings → Applications), `ADMIN_EMAIL` + `ADMIN_PASSWORD` + `AUTH_SECRET` (login), `NEXT_PUBLIC_APP_URL`. Keys can also be entered later on the in-app Settings page.

3. **Create the database** (SQLite file, zero setup)

   ```bash
   npx prisma db push
   ```

4. **(Optional) Seed fictional demo data** — explore the dashboard without any API keys. All seeded businesses and reviews are invented and clearly marked `(Sample)`.

   ```bash
   npm run db:seed
   ```

5. **Start the dev server**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000.

6. **Run your first search**
   1. Go to the **Search** page (left sidebar), pick a category (e.g. *Salons*) and one or more areas (e.g. *Dubai Marina*, *Jumeirah*), adjust min reviews/rating if you like, and click **Search**. The form is pre-filled from your saved defaults on the Settings page. The run summary shows how many places were found, qualified, saved, and why others were skipped.
   2. Open a business from the results (or the **Businesses** table) to see its profile, review sample, keywords, and score breakdown.
   3. Click **Analyze** to run the AI review analysis (summary, services, praise/complaints, SEO keywords, positioning).
   4. Click **Generate website** to produce the draft copy and site.
   5. Click **Preview** to view the generated single-page draft in the browser.
   6. Click **Download ZIP** to get the full Next.js project for that site.
   7. Back on the dashboard, use **Export CSV** to download the current filtered lead list.

7. **Pitch → win → deliver** (once a lead looks good)
   1. On the generate page, click **Publish demo link** to push the draft to a private unguessable URL, then share it with the owner (the WhatsApp button prefills a message to the business's own number).
   2. When they say yes, set the lead to **Won** on the business detail page and work through the **Client handoff** checklist: deposit, photos, content approval, domain.
   3. With content approved and a domain saved, **Production export** unlocks — a clean ZIP (no draft labels, indexable, their domain as canonical) with a `DEPLOY.md` guide for Cloudflare Registrar + Pages.

### Authentication

Auth is a minimal single-admin email/password login:

- Set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `AUTH_SECRET` (a long random string used to sign session cookies) in `.env` to enable it. The middleware then requires a valid signed session cookie (`dlg_session`, HMAC-SHA256, 7-day TTL) for all pages and API routes.
- If `ADMIN_EMAIL`/`ADMIN_PASSWORD` are **unset, auth is disabled** and the dashboard is open — convenient for local development, never for deployment.

### Switching to PostgreSQL & deploying to Vercel

SQLite is great locally but not suitable for serverless deploys. To use PostgreSQL (e.g. [Neon](https://neon.tech) or [Supabase](https://supabase.com)):

1. In `prisma/schema.prisma`, change the datasource provider:

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. Set `DATABASE_URL` to your Postgres connection string, e.g. `postgresql://user:password@host:5432/dubai_leadgen`.
3. Run `npx prisma db push` (or create a proper migration). No model changes are needed — JSON payloads are plain strings by design.

Deploy to Vercel: import the repo, then set these environment variables in the Vercel project:

| Variable | Required |
| --- | --- |
| `DATABASE_URL` | Yes (Postgres connection string) |
| `GOOGLE_MAPS_API_KEY` | Yes |
| `OPENAI_API_KEY` | Yes |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `AUTH_SECRET` | Strongly recommended (enables login) |
| `NEXT_PUBLIC_APP_URL` | Recommended (your deployed URL) |
| `SEARCH_API_KEY`, `SEARCH_ENGINE_ID` | Optional (website verification) |

---

## Opportunity scoring rubric

The score is **deterministic** (`src/lib/scoring.ts`) — no AI involved — and every business stores its factor breakdown. Total is clamped to 0–100.

| Factor | Condition | Points |
| --- | --- | --- |
| Website status | `NO_WEBSITE_LISTED` | +25 |
| | `LIKELY_MISSING` | +20 |
| | `POSSIBLY_EXISTS` / `NEEDS_MANUAL_REVIEW` | +10 |
| | `UNKNOWN` | +5 |
| | `WEBSITE_FOUND` | +0 |
| Review volume | > 100 reviews | +15 |
| | 50–100 reviews | +8 |
| Rating strength | > 4.5 | +10 |
| | 4.0–4.5 | +5 |
| Clear service description | Editorial summary present, or > 600 chars of review text | +10 |
| High-value category | Category where customers book/inquire online (salons, clinics, gyms, garages, law firms, ...) | +15 |
| Booking/pricing intent in reviews | 2+ distinct intent keywords ("book", "appointment", "price", "menu", "whatsapp", ...) | +10 |
| Contactability | Phone number **and** opening hours present | +5 |
| Local SEO potential | 5+ recurring keywords extracted from reviews | +10 |
| Photos available | 3+ photos on the profile | +5 |

Tiers: **80+** very high opportunity, **60–79** good, **40–59** medium, **< 40** low.

---

## Google Maps Platform notes & compliance

This tool uses **official Google APIs only — no scraping**:

- **Places API (New)** Text Search (`places:searchText`) and Place Details, both called with explicit `X-Goog-FieldMask` headers so only the needed fields are requested.
- **Review sample**: the Places API returns **at most 5 reviews per place**. The AI analysis is explicitly designed to work from this sample — it summarizes themes from a small, Google-curated review set, not the full review history.
- **No-website signal**: the `websiteUri` field is the primary signal. When it is absent the business is marked `NO_WEBSITE_LISTED`; optional verification via the Google Custom Search JSON API can upgrade/downgrade this to `LIKELY_MISSING`, `POSSIBLY_EXISTS`, or `WEBSITE_FOUND`. Social-media and aggregator links are not treated as real websites.
- **Caching restrictions**: Google's Places API policies allow **place IDs to be stored indefinitely**, but restrict caching of most other Places content. This app stores place details, reviews, and photos metadata locally as **short-lived working data for lead qualification** (an internal, non-public dashboard). Review the [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies) and Google Maps Platform Terms of Service and adapt retention (e.g. periodic refresh/purge) before any production or commercial use. See [docs/COMPLIANCE.md](docs/COMPLIANCE.md).
- **Pricing / SKU awareness**: Text Search and Place Details are billed per request, and the SKU tier depends on which fields the field mask requests (fields like `reviews` and `photos` land in higher-priced tiers). The field masks in `src/lib/google-places.ts` are deliberately minimal — the search mask requests only ID/name/rating/website-level fields, and the details call (which requests reviews and photos metadata) runs once per qualified place. Each additional `maxPagesPerArea` page is another billed Text Search request; keep it at 1 unless you need depth. Set budget alerts and API quotas in the Google Cloud console.
- **Rate limiting / backoff**: the client waits before requesting next-page tokens (they take a moment to activate), limits Place Details concurrency (4 at a time), and records per-area errors in the run summary instead of failing the whole run. If you hit quota errors (HTTP 429), lower concurrency, reduce areas per run, and re-run later — results are upserted, so repeat runs are safe.

---

## Website copy safety rules

Every AI call that produces customer-facing text embeds strict grounding rules (`src/lib/ai/copy-rules.ts`), and a sanitizer runs over the output:

- **Grounded copy only**: everything is based on the provided reviews, editorial summary, category, and location. No invented prices, staff names, awards, certifications, licenses, or years in business.
- **Banned superlatives**: phrases like "number one in Dubai", "award-winning", "certified experts", "best in the UAE", "guaranteed results", "government approved" are prohibited in prompts, and a post-generation sanitizer unconditionally replaces any that slip through with neutral wording ("well-known locally", "experienced team", "trusted by customers").
- **Paraphrased testimonials**: recurring review themes are summarized in the site's own words — full review text is never quoted verbatim and reviewer names are never used on generated sites.
- **Draft labeling**: every preview and generated site is labeled as a draft/demo. Nothing produced here should be published or presented as a business's official website without the owner's approval.

---

## Future improvements

- **Better website verification** — fetch and inspect candidate URLs (name/phone match on the page), confidence scores, scheduled re-verification.
- **More website templates** — multiple layouts per style (restaurant menu-first, clinic booking-first, portfolio-style), RTL/Arabic support.
- **CRM pipeline upgrades** — kanban view, reminders/follow-up dates, activity log per lead.
- **Bulk generation** — analyze + generate drafts for a whole filtered list in one queued run.
- **Outreach email/WhatsApp drafts** — AI-written first-touch messages, strictly off by default and always manually sent (see [docs/COMPLIANCE.md](docs/COMPLIANCE.md)).
- **One-click deploy** — push a generated draft to a preview host (Vercel deploy hook) behind a noindex flag.
- **Screenshots** — auto-capture preview thumbnails for the leads table and pitch decks.
- **Competitor comparison** — show nearby same-category businesses that *do* have websites to strengthen the pitch.
- **Deeper SEO** — per-area keyword volume hints, structured data (LocalBusiness JSON-LD) in generated sites, sitemap/robots generation.
