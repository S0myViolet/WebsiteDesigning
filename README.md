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

### 5. Website generation
- Generates grounded website copy (headline, about, services, "why choose us", paraphrased testimonials, contact section, SEO title/meta, suggested domain names, color palette, font recommendation, WhatsApp message, booking form fields) from the analysis — with banned-phrase sanitization.
- Renders a self-contained single-file HTML preview viewable directly in the dashboard, clearly labeled as a draft.
- Builds a complete Next.js project (multi-file) and packages it as a ZIP download via JSZip.
- Regeneration is idempotent: calling generate again replaces the stored draft.

### 6. Dashboard
- Sortable, filterable leads table (category, area, website status, lead status, min reviews/rating/score, free-text search) with pagination.
- Business detail view: profile data, reviews, keyword chips, score breakdown, analysis results, website preview, and lead actions.
- Lead pipeline: NEW → SAVED → CONTACTED / REJECTED with notes and contacted-at timestamps (never downgrades CONTACTED/REJECTED back to SAVED).
- Settings page for API keys (masked in the UI), default filters, website style, and AI model.
- Optional email/password login protecting the whole app.

### 7. Exports
- CSV export of the current filtered lead list (configurable columns), served as `dubai-leads-<yyyy-mm-dd>.csv`.
- ZIP export of any generated website's Next.js source code.

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
│       └── website-builder/
│           ├── preview-html.ts    # Single-file HTML draft preview
│           ├── template.ts        # Generated Next.js project files
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
| `GeneratedWebsite` | Generated draft site (1:1 with Business) | `homepageCopy`, `seoTitle`, `seoDescription`, `suggestedDomainNames`*, `colorPalette`*, `fontRecommendation`, `generatedCode`* (file map), `previewHtml`, `rawJson`* |
| `LeadStatus` | CRM-lite pipeline (1:1 with Business) | `status` (`NEW`/`SAVED`/`CONTACTED`/`REJECTED`), `notes`, `contactedAt` |
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
| POST | `/api/businesses/[id]/generate-website` | `{}` | `{website: WebsiteDto}` — requires an analysis (auto-runs it if missing); generates copy JSON, preview HTML, and Next.js project files; calling again regenerates |
| GET | `/api/businesses/[id]/website-preview` | — | `text/html` (stored `previewHtml`); `404` JSON if not generated |
| GET | `/api/businesses/[id]/export-code` | — | `application/zip` download of the generated Next.js project; `404` if not generated |
| POST | `/api/businesses/[id]/save-lead` | — | `{lead: LeadStatusDto}` — upserts to `SAVED` (never downgrades `CONTACTED`/`REJECTED`) |
| POST | `/api/businesses/[id]/update-status` | `{status: "NEW"\|"SAVED"\|"CONTACTED"\|"REJECTED", notes?}` | `{lead: LeadStatusDto}` — sets `contactedAt` when transitioning to `CONTACTED` |
| GET | `/api/export/csv` | same filters as `/api/businesses`, no paging | `text/csv` attachment `dubai-leads-<yyyy-mm-dd>.csv` |
| GET | `/api/settings` | — | Masked `AppSettings` (API keys shown as `abcd…wxyz`) |
| PUT | `/api/settings` | `Partial<AppSettings>` | Masked settings. Masked/empty API-key values in the body are ignored so saving the form never wipes real keys |

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

   Optional: `SEARCH_API_KEY` + `SEARCH_ENGINE_ID` (Custom Search website verification), `ADMIN_EMAIL` + `ADMIN_PASSWORD` + `AUTH_SECRET` (login), `NEXT_PUBLIC_APP_URL`. Keys can also be entered later on the in-app Settings page.

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
   1. On the dashboard, pick a category (e.g. *Salons*) and one or more areas (e.g. *Dubai Marina*, *Jumeirah*), adjust min reviews/rating if you like, and click **Search**. The run summary shows how many places were found, qualified, saved, and why others were skipped.
   2. Open a business from the leads table to see its profile, review sample, keywords, and score breakdown.
   3. Click **Analyze** to run the AI review analysis (summary, services, praise/complaints, SEO keywords, positioning).
   4. Click **Generate website** to produce the draft copy and site.
   5. Click **Preview** to view the generated single-page draft in the browser.
   6. Click **Download ZIP** to get the full Next.js project for that site.
   7. Back on the dashboard, use **Export CSV** to download the current filtered lead list.

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
- **Banned superlatives**: phrases like "number one in Dubai", "award-winning", "certified experts", "best in the UAE", "guaranteed results", "government approved" are prohibited in prompts *and* stripped/replaced by a post-generation sanitizer unless they literally appear in the source data.
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
