# Compliance & Ethics

Dubai Lead Gen is a lead-qualification and sales-demo tool. It is designed to be usable in a compliant way, but **you are responsible for how you operate it**. Read this document before using the tool with real businesses, and re-read the linked Google policies before any production or commercial use.

---

## 1. Google Maps Platform / ToS compliance

**Official APIs only — no scraping.**

- All Google Maps data enters the system through the official **Places API (New)** endpoints (`places:searchText` and Place Details) using an API key you provision, with explicit field masks (`X-Goog-FieldMask`). Optional website verification uses the official **Custom Search JSON API**.
- The tool never scrapes Google Maps, Google Search result pages, or business websites, and it must not be modified to do so. Scraping Google surfaces violates the Google Maps Platform Terms of Service and the Google Terms of Service.

**Attribution.**

- Data shown in the dashboard originates from Google Maps. Where Places content is displayed, Google's attribution requirements apply; the dashboard links each business back to its Google Maps listing (`googleMapsUrl`).
- Google-sourced content (reviews, ratings, editorial summaries) must **never** be republished on generated websites or any public surface. In this app it is used only internally, and testimonials in generated copy are paraphrased themes, never quoted reviews.

**Caching / storage rules.**

- Per Google's Places policies, **place IDs may be stored indefinitely**. This app relies on `placeId` as the stable identifier for upserts.
- Most other Places content (names, addresses, ratings, reviews, photos metadata, raw payloads in `rawPlaceData`) is subject to caching restrictions. This app stores it as **short-lived working data** for internal lead qualification in a private dashboard — not for republication, resale, or building a competing database.
- Before production use: implement a data-refresh or purge policy (e.g. re-fetch or delete Places-derived fields after your permitted retention window), and confirm your usage against the current policies:
  - Google Maps Platform Terms of Service: https://cloud.google.com/maps-platform/terms
  - Places API policies: https://developers.google.com/maps/documentation/places/web-service/policies
  - Custom Search JSON API ToS: https://developers.google.com/custom-search/v1/overview

**Cost and quota discipline.**

- Field masks are chosen to control SKU billing; keep them minimal if you modify `src/lib/google-places.ts`. Set quotas and budget alerts in the Google Cloud console. Respect rate limits; do not raise concurrency to work around 429s.

## 2. Data handling

- **Public business data only.** The tool processes information businesses chose to publish on their Google Maps profiles (name, address, phone, hours, rating, review sample). It does not collect private or non-public personal data.
- **Business photos** are fetched only through the official Places Photo API and analyzed in-memory by an AI vision pass to extract design cues (palette, lighting, vibe) for the generated draft. The photos themselves are never stored on disk, never embedded in generated websites, and never republished anywhere.
- **Reviewer names** are part of the API's review payload and are stored in the local `Review.reviewerName` column for context, but they are **never published**: generated websites and exported CSVs must not include reviewer names, and generated testimonials are anonymous paraphrases. Treat reviewer names as personal data — do not export or share them.
- **Local database is sensitive.** The SQLite file (or Postgres database) contains business contact details, review text, and possibly API keys saved via the Settings page. Protect it like a secret: do not commit it, restrict access, enable the app's login for any non-local deployment.
- **Deletion on request.** If a business owner (or a reviewer) asks you to remove their data, delete the corresponding `Business` row — cascading deletes remove its reviews, analysis, generated website, and lead status. Also delete any exported CSVs or ZIPs containing that business. Honor such requests promptly; under UAE Federal Decree-Law No. 45 of 2021 (Personal Data Protection Law) and similar regimes, data subjects can have deletion rights.
- **Retention.** Keep leads only as long as you are actively working them. Periodically purge rejected/stale leads and refresh Places-derived data (see caching rules above).

## 3. Generated-website rules

- **Always a draft.** Every generated preview and exported project is a *demonstration* labeled as a draft. It exists so a business owner can see what their website could look like.
- **Never publish without approval.** Do not deploy, host publicly, or index a generated site — and never present it as the business's official website — without the owner's explicit approval. Publishing a site that impersonates a business you do not represent may constitute impersonation/passing-off and violates this tool's intended use.
- **Demo links stay drafts.** The "Publish demo link" button deploys the draft-labeled preview to an unguessable URL (random suffix, not linked from anywhere, `noindex`) so it can be shown privately to the business owner during a pitch. The concept-draft ribbon and full disclaimer remain on the page. Do not post demo links publicly, list them in directories, or point a real domain at them. Delete the demo site once the pitch concludes (won or lost).
- **Production export is approval-gated by design.** The unlabeled production ZIP (draft ribbon and disclaimer removed, search indexing enabled) can only be exported after the lead is marked **Won** and the handoff checklist records **"Content approved by owner"** plus the client's domain. Only tick that box after the owner has actually reviewed and approved the content — the checkbox is your record of that approval. Deploy production sites only for clients who have engaged you.
- **Domain ownership.** If you register the client's domain in your own registrar account (the recommended Cloudflare Registrar flow), put in writing that the domain is registered on the client's behalf and transfers to them free of charge on request. Do not hold client domains hostage.
- **No fabricated claims.** Mirrored from the copy rules enforced in `src/lib/ai/copy-rules.ts`:
  - No invented facts: prices, staff names, awards, certifications, licenses, years in business, ownership claims.
  - Everything grounded in the provided data (reviews, editorial summary, category, location); if a detail is not in the source data, it is not stated.
  - Safe attribution wording ("Popular with customers for...", "Customers often mention...", "Located in...").
  - No unsupported superlatives or credential claims: "number one in Dubai", "award-winning", "certified experts", "best in the UAE", "guaranteed results", "government approved", "licensed experts" — banned unless literally present in source data, and stripped by the sanitizer regardless.
  - Review themes are paraphrased; no verbatim review quotes, no reviewer names.
- **Owner corrections win.** If the owner engages, replace AI-derived copy with facts they provide and confirm anything sensitive (licenses, medical/legal claims) before any real launch — especially for regulated categories (clinics, dental, law firms), which have their own advertising rules in the UAE.

## 4. Outreach rules

- **NO automated contact.** This tool does not send emails, WhatsApp messages, SMS, or calls, and must not be wired up to do so in bulk. It only *prepares materials* (lead lists, scores, draft sites, a suggested WhatsApp message) for a human to use in manual, one-to-one outreach.
- **Human review before every contact.** Check the business still exists, actually lacks a website, and is an appropriate fit before reaching out. Personalize; never blast.
- **UAE-specific note.** Respect UAE rules on telemarketing and unsolicited communications, including the TDRA/TRA regulations on marketing calls and messages (permitted calling hours, do-not-call expectations, sender registration for SMS) and the UAE Personal Data Protection Law. Unsolicited bulk WhatsApp/SMS marketing can lead to number bans and regulatory penalties. When in doubt, prefer a single polite phone call or an in-person visit during business hours.
- **Honest pitching.** Introduce yourself truthfully, say how you found them (their public Google Maps profile), present the draft as *your* work made from public information, and stop contacting anyone who declines.

## 5. Acceptable use checklist

Before each campaign, confirm every item:

- [ ] All Google data was obtained through the official APIs with my own key — no scraping anywhere in my workflow.
- [ ] I am using this data internally for lead qualification only, not republishing or reselling it.
- [ ] I have reviewed the current Google Maps Platform ToS and Places policies and my retention practice matches them.
- [ ] Reviewer names are never exported, published, or shown on generated sites.
- [ ] Every generated site is labeled a draft and will not be published without the business owner's approval.
- [ ] Demo links are shared privately with the business owner only, and deleted after the pitch.
- [ ] I only exported a production (unlabeled) site after the owner reviewed and approved its content, and I have a written record of that approval.
- [ ] Any client domain registered in my account is covered by a written free-transfer promise.
- [ ] Generated copy contains no fabricated facts, prices, credentials, or superlatives.
- [ ] All outreach is manual, one-to-one, honest about who I am and how I found the business.
- [ ] My outreach complies with UAE telemarketing and data-protection rules (timing, consent, opt-out).
- [ ] I stop contact immediately when asked, and delete a business's data on request.
- [ ] API keys and the database are kept secret; the app login is enabled on any shared deployment.

If you cannot check every box, do not run the campaign.
