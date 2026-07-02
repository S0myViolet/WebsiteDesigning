// The website renderer: six structurally different layout variants, each
// driven by the per-business visual style (colors, typography, spacing,
// button shape) from the design step. Output is a COMPLETE self-contained
// HTML document (all CSS inline, no CDN/network dependencies) with a
// permanent draft disclaimer. Every interpolated string is escaped.

import type {
  DesignBriefJson,
  LayoutType,
  VisualStyleJson,
  WebsiteCopyJson,
} from "@/lib/types";
import { normalizePhone, whatsappLink } from "@/lib/utils";

export interface PreviewBusiness {
  name: string;
  category: string;
  area: string | null;
  address: string | null;
  phone: string | null;
  googleMapsUrl: string | null;
  openingHours: string[];
  rating: number | null;
  reviewCount: number;
}

export interface RenderContext {
  business: PreviewBusiness;
  copy: WebsiteCopyJson;
  brief: DesignBriefJson | null;
  style: VisualStyleJson | null;
  layout: LayoutType;
}

const DISCLAIMER =
  "DRAFT WEBSITE CONCEPT — generated from public Google Maps data; not the official website of this business";

// ---------------------------------------------------------------------------
// Escaping & sanitising
// ---------------------------------------------------------------------------

export function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHex(value: string | null | undefined, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const raw = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw.split("").map((c) => c + c).join("")}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  return fallback;
}

function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

function withAlpha(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

// ---------------------------------------------------------------------------
// Design tokens derived from the visual style
// ---------------------------------------------------------------------------

interface Tokens {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  headingFont: string;
  bodyFont: string;
  radius: string;
  /** vertical section padding in px */
  space: number;
}

const SANS_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const SERIF_STACK =
  'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';

function deriveTokens(style: VisualStyleJson | null, layout: LayoutType): Tokens {
  const fallbacks: Record<LayoutType, Partial<Tokens>> = {
    "premium-service": { primary: "#8a6d4b", secondary: "#2b2320", accent: "#c9a36a", background: "#faf7f2", surface: "#ffffff", text: "#28211c" },
    "local-practical": { primary: "#b45309", secondary: "#1f2937", accent: "#f59e0b", background: "#f8fafc", surface: "#ffffff", text: "#111827" },
    hospitality: { primary: "#9a3412", secondary: "#3f2212", accent: "#d97706", background: "#fdf8f0", surface: "#ffffff", text: "#2a1c10" },
    "wellness-clinic": { primary: "#0e7490", secondary: "#164e63", accent: "#14b8a6", background: "#f7fafb", surface: "#ffffff", text: "#0f2530" },
    "creative-portfolio": { primary: "#111111", secondary: "#4b4b4b", accent: "#e11d48", background: "#fafafa", surface: "#ffffff", text: "#111111" },
    "simple-landing": { primary: "#1d4ed8", secondary: "#1e3a5f", accent: "#f59e0b", background: "#f8fafc", surface: "#ffffff", text: "#111827" },
  };
  const fb = fallbacks[layout];
  const p = style?.color_palette;

  const headingIsSerif = style
    ? /serif/i.test(style.typography.heading_style) && !/sans/i.test(style.typography.heading_style)
    : layout === "premium-service" || layout === "hospitality";

  const buttonStyle = style?.button_style ?? "";
  const radius = /pill/i.test(buttonStyle)
    ? "999px"
    : /sharp|square/i.test(buttonStyle)
      ? "4px"
      : "10px";

  const spacing = style?.section_spacing ?? "";
  const space = /generous/i.test(spacing) ? 96 : /compact/i.test(spacing) ? 52 : 72;

  const text = safeHex(p?.text, fb.text!);
  return {
    primary: safeHex(p?.primary, fb.primary!),
    secondary: safeHex(p?.secondary, fb.secondary!),
    accent: safeHex(p?.accent, fb.accent!),
    background: safeHex(p?.background, fb.background!),
    surface: safeHex(p?.surface, fb.surface!),
    text,
    muted: withAlpha(text, "99"),
    border: withAlpha(text, "1a"),
    headingFont: headingIsSerif ? SERIF_STACK : SANS_STACK,
    bodyFont: SANS_STACK,
    radius,
    space,
  };
}

// ---------------------------------------------------------------------------
// Shared link + section builders
// ---------------------------------------------------------------------------

interface Links {
  tel: string | null;
  wa: string | null;
  maps: string | null;
  mapEmbed: string;
  phoneDisplay: string | null;
}

function deriveLinks(business: PreviewBusiness, copy: WebsiteCopyJson): Links {
  const phone = business.phone ? normalizePhone(business.phone) : "";
  const mapQuery = encodeURIComponent(
    [business.name, business.address].filter(Boolean).join(" ")
  );
  return {
    tel: phone ? `tel:${phone}` : null,
    wa: business.phone
      ? whatsappLink(business.phone, copy.whatsapp_message || `Hi ${business.name}`)
      : null,
    maps: safeHttpUrl(business.googleMapsUrl),
    mapEmbed: `https://www.google.com/maps?q=${mapQuery}&output=embed`,
    phoneDisplay: business.phone,
  };
}

function draftBanner(): string {
  return `<div class="draft-banner" role="note">${escapeHtml(DISCLAIMER)}</div>`;
}

function ctaButtons(
  links: Links,
  copy: WebsiteCopyJson,
  opts: { primaryLabel?: string; secondaryLabel?: string } = {}
): string {
  const primaryHref = links.wa ?? links.tel ?? "#contact";
  const primaryLabel = opts.primaryLabel ?? copy.cta_text ?? "Contact us";
  const secondary = links.wa && links.tel
    ? `<a class="btn btn-outline" href="${escapeHtml(links.tel)}" aria-label="Call by phone">${escapeHtml(
        opts.secondaryLabel ?? "Call us"
      )}</a>`
    : "";
  return `<div class="btn-row">
    <a class="btn btn-primary" href="${escapeHtml(primaryHref)}" aria-label="${links.wa ? "Contact on WhatsApp" : "Contact"}">${escapeHtml(primaryLabel)}</a>
    ${secondary}
  </div>`;
}

function hoursList(business: PreviewBusiness): string {
  if (business.openingHours.length === 0) {
    return `<p class="muted">Contact us for current opening hours.</p>`;
  }
  return `<ul class="hours-list">${business.openingHours
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("")}</ul>`;
}

function mapBlock(business: PreviewBusiness, links: Links): string {
  return `
  <div class="map-block">
    ${
      business.address
        ? `<p class="muted">${escapeHtml(business.address)}</p>`
        : `<p class="muted">Located in ${escapeHtml(business.area ?? "Dubai")}.</p>`
    }
    ${
      links.maps
        ? `<p><a href="${escapeHtml(links.maps)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(business.name)} on Google Maps">View on Google Maps →</a></p>`
        : ""
    }
    <div class="map-frame"><iframe src="${escapeHtml(links.mapEmbed)}" title="Map showing the location of ${escapeHtml(business.name)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>
  </div>`;
}

function demoForm(copy: WebsiteCopyJson, heading: string): string {
  const fields = (copy.booking_form_fields ?? []).slice(0, 6);
  if (fields.length === 0) return "";
  const controls = fields
    .map((label, i) => {
      const id = `form-field-${i}`;
      const isLong = /message|detail|request|note/i.test(label);
      const control = isLong
        ? `<textarea id="${id}" rows="3" placeholder="${escapeHtml(label)}"></textarea>`
        : `<input id="${id}" type="text" placeholder="${escapeHtml(label)}" />`;
      return `<div class="form-field"><label for="${id}">${escapeHtml(label)}</label>${control}</div>`;
    })
    .join("");
  return `<form class="demo-form" aria-label="Demo form" onsubmit="return false;">
    <h3>${escapeHtml(heading)}</h3>
    ${controls}
    <button type="submit" disabled>Demo form — not yet active</button>
  </form>`;
}

function testimonialsBlock(copy: WebsiteCopyJson, variant: "cards" | "quotes"): string {
  const items = (copy.testimonials ?? []).slice(0, 4);
  if (items.length === 0) return "";
  if (variant === "quotes") {
    return `<div class="quotes">${items
      .map(
        (t) =>
          `<blockquote class="pull-quote"><span aria-hidden="true">&ldquo;</span>${escapeHtml(t)}</blockquote>`
      )
      .join("")}</div>`;
  }
  return `<div class="t-grid">${items
    .map(
      (t) =>
        `<blockquote class="t-card"><span class="qmark" aria-hidden="true">&ldquo;</span><p>${escapeHtml(t)}</p></blockquote>`
    )
    .join("")}</div>`;
}

function faqBlock(copy: WebsiteCopyJson): string {
  const items = (copy.faq ?? []).slice(0, 5);
  if (items.length === 0) return "";
  return `<section class="section" id="faq" aria-labelledby="faq-h">
    <div class="container narrow">
      <h2 id="faq-h">Common questions</h2>
      ${items
        .map(
          (f) => `<details class="faq-item"><summary>${escapeHtml(f.question)}</summary><p>${escapeHtml(f.answer)}</p></details>`
        )
        .join("")}
    </div>
  </section>`;
}

function siteFooter(business: PreviewBusiness): string {
  const areaSuffix = business.area ? ` · ${escapeHtml(business.area)}` : "";
  return `<footer class="site-footer">
    <div class="container">
      <p class="brand">${escapeHtml(business.name)}${areaSuffix}</p>
      <p class="small">${escapeHtml(DISCLAIMER)}</p>
    </div>
  </footer>`;
}

// ---------------------------------------------------------------------------
// Base CSS shared by every variant (tokens injected)
// ---------------------------------------------------------------------------

function baseCss(t: Tokens): string {
  return `
  :root { --primary:${t.primary}; --secondary:${t.secondary}; --accent:${t.accent}; --bg:${t.background}; --surface:${t.surface}; --text:${t.text}; }
  * { box-sizing:border-box; margin:0; padding:0; }
  html { scroll-behavior:smooth; }
  body { font-family:${t.bodyFont}; background:var(--bg); color:var(--text); line-height:1.65; -webkit-font-smoothing:antialiased; }
  img, iframe { max-width:100%; }
  a { color:var(--primary); }
  h1,h2,h3 { font-family:${t.headingFont}; line-height:1.15; color:var(--text); }
  h2 { font-size:clamp(26px,3.2vw,34px); margin-bottom:12px; }
  .container { max-width:1100px; margin:0 auto; padding:0 22px; }
  .container.narrow { max-width:760px; }
  .section { padding:${t.space}px 0; }
  .muted { color:${t.muted}; }
  .small { font-size:13px; color:${t.muted}; }
  .kicker { font-size:12px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; color:var(--primary); }
  .draft-banner { position:fixed; inset:0 0 auto 0; z-index:60; background:#fbbf24; color:#451a03; padding:6px 16px; text-align:center; font-size:11px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; box-shadow:0 1px 4px rgba(0,0,0,.15); }
  .btn-row { display:flex; flex-wrap:wrap; gap:14px; }
  .btn { display:inline-block; padding:13px 28px; border-radius:${t.radius}; font-weight:600; font-size:16px; text-decoration:none; transition:opacity .15s ease, background-color .15s ease; }
  .btn-primary { background:var(--primary); color:#fff; box-shadow:0 6px 18px ${withAlpha(t.primary, "40")}; }
  .btn-primary:hover { opacity:.9; }
  .btn-outline { border:2px solid var(--primary); color:var(--primary); background:transparent; }
  .btn-outline:hover { background:${withAlpha(t.primary, "0d")}; }
  .hours-list { list-style:none; }
  .hours-list li { padding:9px 0; font-size:14.5px; border-bottom:1px solid ${t.border}; }
  .hours-list li:last-child { border-bottom:0; }
  .map-frame { border:1px solid ${t.border}; border-radius:14px; overflow:hidden; margin-top:16px; }
  .map-frame iframe { display:block; width:100%; height:280px; border:0; }
  .t-grid { display:grid; gap:20px; margin-top:26px; }
  @media(min-width:760px){ .t-grid { grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); } }
  .t-card { background:var(--surface); border:1px solid ${t.border}; border-radius:14px; padding:24px; font-size:14.5px; color:${t.muted}; }
  .t-card .qmark { display:block; font-family:${SERIF_STACK}; font-size:34px; line-height:1; color:var(--primary); }
  .t-card p { margin-top:6px; }
  .pull-quote { font-family:${t.headingFont}; font-size:clamp(19px,2.4vw,24px); line-height:1.5; color:var(--text); max-width:720px; margin:26px auto 0; text-align:center; }
  .pull-quote span { color:var(--primary); font-size:1.4em; }
  .demo-form { background:var(--surface); border:1px solid ${t.border}; border-radius:16px; padding:26px; }
  .demo-form h3 { margin-bottom:6px; }
  .form-field { margin-top:14px; }
  .form-field label { display:block; font-size:13.5px; font-weight:600; margin-bottom:5px; }
  .form-field input, .form-field textarea { width:100%; border:1px solid ${t.border}; border-radius:8px; padding:10px 12px; font-size:14px; font-family:inherit; background:var(--bg); }
  .form-field input:focus, .form-field textarea:focus { outline:2px solid var(--primary); outline-offset:1px; }
  .demo-form button { margin-top:20px; width:100%; padding:13px; border:0; border-radius:${t.radius}; background:${withAlpha(t.text, "1f")}; color:${t.muted}; font-weight:600; cursor:not-allowed; }
  .faq-item { background:var(--surface); border:1px solid ${t.border}; border-radius:12px; padding:16px 20px; margin-top:12px; }
  .faq-item summary { font-weight:600; cursor:pointer; }
  .faq-item p { margin-top:10px; font-size:14.5px; color:${t.muted}; }
  .site-footer { border-top:1px solid ${t.border}; background:var(--surface); padding:38px 0; text-align:center; }
  .site-footer .brand { font-weight:600; }
  .site-footer .small { max-width:640px; margin:10px auto 0; }
  .top-nav { position:sticky; top:26px; z-index:50; background:${withAlpha(t.surface, "f2")}; backdrop-filter:blur(8px); border-bottom:1px solid ${t.border}; }
  .top-nav .inner { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:14px 22px; max-width:1100px; margin:0 auto; }
  .top-nav .name { font-family:${t.headingFont}; font-weight:700; font-size:17px; color:var(--text); text-decoration:none; }
  .top-nav .btn { padding:9px 18px; font-size:14px; }
  body { padding-top:26px; }
  `;
}

// ---------------------------------------------------------------------------
// Variant 1 — Premium service business (editorial, refined)
// ---------------------------------------------------------------------------

function renderPremiumService(ctx: RenderContext, t: Tokens, links: Links): { css: string; body: string } {
  const { business, copy } = ctx;
  const monogram = escapeHtml(business.name.trim().charAt(0).toUpperCase() || "•");
  const signatures = (copy.highlight_items?.length ? copy.highlight_items : copy.services).slice(0, 4);

  const css = `
  .hero-split { display:grid; gap:40px; align-items:center; padding:${t.space + 20}px 0 ${t.space}px; }
  @media(min-width:860px){ .hero-split { grid-template-columns:1.15fr .85fr; } }
  .hero-split h1 { font-size:clamp(34px,4.6vw,54px); letter-spacing:-.01em; margin:16px 0 18px; }
  .hero-split .sub { font-size:18px; color:${t.muted}; max-width:520px; margin-bottom:28px; }
  .mono-panel { aspect-ratio:4/5; border-radius:18px; background:linear-gradient(160deg, ${withAlpha(t.primary, "26")}, ${withAlpha(t.accent, "1f")} 60%, ${withAlpha(t.secondary, "14")}); display:flex; align-items:center; justify-content:center; }
  .mono-panel span { font-family:${SERIF_STACK}; font-size:clamp(90px,12vw,150px); color:${withAlpha(t.primary, "66")}; }
  .sig-list { margin-top:28px; }
  .sig-item { display:grid; grid-template-columns:64px 1fr; gap:20px; padding:26px 0; border-top:1px solid ${t.border}; }
  .sig-item:last-child { border-bottom:1px solid ${t.border}; }
  .sig-item .num { font-family:${SERIF_STACK}; font-size:26px; color:var(--primary); }
  .sig-item h3 { font-size:20px; margin-bottom:6px; }
  .sig-item p { color:${t.muted}; font-size:15px; max-width:640px; }
  .about-band { background:var(--surface); border-block:1px solid ${t.border}; }
  .about-band .cols { display:grid; gap:34px; }
  @media(min-width:860px){ .about-band .cols { grid-template-columns:1fr 1fr; } }
  .why-list { list-style:none; margin-top:8px; }
  .why-list li { padding:10px 0 10px 26px; position:relative; color:${t.muted}; }
  .why-list li::before { content:"—"; position:absolute; left:0; color:var(--accent); }
  .visit-band { background:${withAlpha(t.primary, "0a")}; }
  .visit-cols { display:grid; gap:34px; margin-top:10px; }
  @media(min-width:860px){ .visit-cols { grid-template-columns:1fr 1fr; } }
  `;

  const body = `
  <nav class="top-nav" aria-label="Main">
    <div class="inner">
      <a class="name" href="#top">${escapeHtml(business.name)}</a>
      ${links.tel ? `<a class="btn btn-primary" href="${escapeHtml(links.wa ?? links.tel)}">${escapeHtml(copy.cta_text || "Book")}</a>` : ""}
    </div>
  </nav>
  <header id="top" class="container hero-split">
    <div>
      <p class="kicker">${escapeHtml(business.category)}${business.area ? ` · ${escapeHtml(business.area)}` : ""}</p>
      <h1>${escapeHtml(copy.headline)}</h1>
      <p class="sub">${escapeHtml(copy.subheadline)}</p>
      ${ctaButtons(links, copy)}
    </div>
    <div class="mono-panel" role="img" aria-label="Decorative brand panel"><span>${monogram}</span></div>
  </header>
  <main>
    <section class="section" id="signature" aria-labelledby="sig-h">
      <div class="container">
        <p class="kicker">Signature</p>
        <h2 id="sig-h">What clients come here for</h2>
        <div class="sig-list">
          ${signatures
            .map(
              (s, i) => `<div class="sig-item"><span class="num">0${i + 1}</span><div><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.description)}</p></div></div>`
            )
            .join("")}
        </div>
      </div>
    </section>
    <section class="section about-band" id="about" aria-labelledby="about-h">
      <div class="container cols">
        <div>
          <p class="kicker">About</p>
          <h2 id="about-h">About ${escapeHtml(business.name)}</h2>
          <p class="muted" style="white-space:pre-line">${escapeHtml(copy.about_section)}</p>
        </div>
        <div>
          <h3 style="margin-bottom:6px">Why clients choose us</h3>
          <ul class="why-list">${copy.why_choose_us.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>
        </div>
      </div>
    </section>
    <section class="section" id="reviews" aria-labelledby="rev-h">
      <div class="container" style="text-align:center">
        <p class="kicker">What clients say</p>
        <h2 id="rev-h" class="sr-only" style="position:absolute;left:-9999px">Review highlights</h2>
        ${testimonialsBlock(copy, "quotes")}
      </div>
    </section>
    <section class="section visit-band" id="visit" aria-labelledby="visit-h">
      <div class="container">
        <p class="kicker">Visit</p>
        <h2 id="visit-h">Hours &amp; location</h2>
        <div class="visit-cols">
          <div>${hoursList(business)}</div>
          ${mapBlock(business, links)}
        </div>
      </div>
    </section>
    <section class="section" id="contact" aria-labelledby="contact-h">
      <div class="container" style="max-width:680px; text-align:center">
        <h2 id="contact-h">${escapeHtml(copy.cta_text || "Get in touch")}</h2>
        <p class="muted" style="margin-bottom:24px">${escapeHtml(copy.contact_section)}</p>
        <div style="display:flex; justify-content:center">${ctaButtons(links, copy, { secondaryLabel: links.phoneDisplay ?? "Call us" })}</div>
      </div>
    </section>
  </main>`;
  return { css, body };
}

// ---------------------------------------------------------------------------
// Variant 2 — Local practical business (bold, call/quote-first)
// ---------------------------------------------------------------------------

function renderLocalPractical(ctx: RenderContext, t: Tokens, links: Links): { css: string; body: string } {
  const { business, copy } = ctx;
  const jobs = (copy.highlight_items?.length ? copy.highlight_items : copy.services).slice(0, 4);

  const css = `
  .phone-strip { background:var(--secondary); color:#fff; }
  .phone-strip .inner { max-width:1100px; margin:0 auto; padding:10px 22px; display:flex; justify-content:space-between; align-items:center; gap:12px; font-size:14px; }
  .phone-strip a { color:#fff; font-weight:700; text-decoration:none; }
  .hero-práct { padding:${t.space}px 0; }
  .hero-grid { display:grid; gap:36px; align-items:start; }
  @media(min-width:860px){ .hero-grid { grid-template-columns:1.2fr .8fr; } }
  .hero-grid h1 { font-size:clamp(30px,4.2vw,46px); letter-spacing:-.01em; margin:14px 0 14px; }
  .hero-grid .sub { font-size:17px; color:${t.muted}; margin-bottom:20px; }
  .job-ticks { list-style:none; margin:0 0 26px; }
  .job-ticks li { padding:8px 0 8px 32px; position:relative; font-weight:600; }
  .job-ticks li::before { content:"✓"; position:absolute; left:0; top:8px; width:22px; height:22px; border-radius:6px; background:var(--primary); color:#fff; font-size:13px; font-weight:700; display:flex; align-items:center; justify-content:center; }
  .hours-card { background:var(--surface); border:1px solid ${t.border}; border-radius:14px; padding:24px; }
  .hours-card h3 { margin-bottom:8px; }
  .svc-rows { margin-top:24px; display:grid; gap:14px; }
  .svc-row { background:var(--surface); border:1px solid ${t.border}; border-left:5px solid var(--primary); border-radius:10px; padding:18px 22px; }
  .svc-row h3 { font-size:17px; margin-bottom:4px; }
  .svc-row p { font-size:14.5px; color:${t.muted}; }
  .why-strip { background:${withAlpha(t.primary, "0d")}; }
  .why-strip .items { display:grid; gap:18px; margin-top:20px; }
  @media(min-width:760px){ .why-strip .items { grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); } }
  .why-strip .item { font-size:15px; font-weight:600; padding-left:30px; position:relative; }
  .why-strip .item::before { content:"✓"; position:absolute; left:0; color:var(--primary); font-weight:800; }
  .quote-banner { background:var(--secondary); color:#fff; }
  .quote-banner h2 { color:#fff; }
  .quote-banner .muted { color:${withAlpha("#ffffff", "b3")}; }
  .quote-cols { display:grid; gap:34px; margin-top:10px; }
  @media(min-width:860px){ .quote-cols { grid-template-columns:1fr 1fr; } }
  `;

  const body = `
  ${
    links.tel
      ? `<div class="phone-strip"><div class="inner"><span>${escapeHtml(business.area ? `${business.category} · ${business.area}` : business.category)}</span><a href="${escapeHtml(links.tel)}" aria-label="Call now">📞 ${escapeHtml(links.phoneDisplay ?? "Call now")}</a></div></div>`
      : ""
  }
  <header class="container hero-práct">
    <div class="hero-grid">
      <div>
        <p class="kicker">${escapeHtml(business.category)}${business.area ? ` in ${escapeHtml(business.area)}` : ""}</p>
        <h1>${escapeHtml(copy.headline)}</h1>
        <p class="sub">${escapeHtml(copy.subheadline)}</p>
        <ul class="job-ticks">${jobs.map((j) => `<li>${escapeHtml(j.title)}</li>`).join("")}</ul>
        ${ctaButtons(links, copy, { secondaryLabel: "Call us" })}
      </div>
      <aside class="hours-card">
        <h3>Opening hours</h3>
        ${hoursList(business)}
      </aside>
    </div>
  </header>
  <main>
    <section class="section" id="services" aria-labelledby="svc-h" style="padding-top:0">
      <div class="container">
        <h2 id="svc-h">What we do</h2>
        <div class="svc-rows">
          ${copy.services.map((s) => `<div class="svc-row"><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.description)}</p></div>`).join("")}
        </div>
      </div>
    </section>
    <section class="section why-strip" id="why" aria-labelledby="why-h">
      <div class="container">
        <h2 id="why-h">Why customers come back</h2>
        <div class="items">${copy.why_choose_us.map((w) => `<div class="item">${escapeHtml(w)}</div>`).join("")}</div>
        ${testimonialsBlock(copy, "cards")}
      </div>
    </section>
    ${faqBlock(copy)}
    <section class="section quote-banner" id="contact" aria-labelledby="q-h">
      <div class="container quote-cols">
        <div>
          <h2 id="q-h">${escapeHtml(copy.cta_text || "Get a quote")}</h2>
          <p class="muted" style="margin-bottom:22px">${escapeHtml(copy.contact_section)}</p>
          ${ctaButtons(links, copy, { secondaryLabel: links.phoneDisplay ?? "Call us" })}
        </div>
        ${demoForm(copy, "Request a quote")}
      </div>
    </section>
    <section class="section" id="location" aria-labelledby="loc-h">
      <div class="container">
        <h2 id="loc-h">Find us</h2>
        ${mapBlock(business, links)}
      </div>
    </section>
  </main>`;
  return { css, body };
}

// ---------------------------------------------------------------------------
// Variant 3 — Hospitality (warm, menu-forward, visit-focused)
// ---------------------------------------------------------------------------

function renderHospitality(ctx: RenderContext, t: Tokens, links: Links): { css: string; body: string } {
  const { business, copy } = ctx;
  const menu = (copy.highlight_items?.length ? copy.highlight_items : copy.services).slice(0, 6);

  const css = `
  .hero-hosp { text-align:center; padding:${t.space + 24}px 0 ${t.space}px; background:radial-gradient(80% 90% at 50% 0%, ${withAlpha(t.primary, "17")} 0%, var(--bg) 75%); }
  .hero-hosp h1 { font-size:clamp(34px,5vw,56px); margin:18px auto 14px; max-width:760px; }
  .hero-hosp .sub { font-size:18px; color:${t.muted}; max-width:560px; margin:0 auto 26px; }
  .hero-hosp .btn-row { justify-content:center; }
  .orn { color:var(--accent); font-size:20px; letter-spacing:.6em; margin-top:16px; }
  .menu-list { max-width:760px; margin:26px auto 0; }
  .menu-item { padding:18px 0; border-bottom:1px dashed ${withAlpha(t.text, "33")}; }
  .menu-item:last-child { border-bottom:0; }
  .menu-item .row { display:flex; align-items:baseline; gap:10px; }
  .menu-item h3 { font-size:19px; white-space:nowrap; }
  .menu-item .leader { flex:1; border-bottom:2px dotted ${withAlpha(t.text, "40")}; transform:translateY(-4px); }
  .menu-item p { font-size:14.5px; color:${t.muted}; margin-top:5px; }
  .menu-band { background:var(--surface); border-block:1px solid ${t.border}; }
  .visit-grid { display:grid; gap:30px; margin-top:14px; }
  @media(min-width:860px){ .visit-grid { grid-template-columns:1fr 1.1fr; } }
  .visit-card { background:var(--surface); border:1px solid ${t.border}; border-radius:16px; padding:26px; }
  .about-hosp { text-align:center; }
  .about-hosp p { max-width:680px; margin:0 auto; }
  .cta-hosp { text-align:center; background:linear-gradient(150deg, ${withAlpha(t.primary, "14")}, ${withAlpha(t.accent, "0f")}); }
  .cta-hosp .btn-row { justify-content:center; }
  `;

  const body = `
  <header class="hero-hosp">
    <div class="container">
      <p class="kicker">${escapeHtml(business.category)}${business.area ? ` · ${escapeHtml(business.area)}` : ""}</p>
      <h1>${escapeHtml(copy.headline)}</h1>
      <p class="sub">${escapeHtml(copy.subheadline)}</p>
      ${ctaButtons(links, copy, { secondaryLabel: "Call us" })}
      <p class="orn" aria-hidden="true">✦ ✦ ✦</p>
    </div>
  </header>
  <main>
    <section class="section menu-band" id="menu" aria-labelledby="menu-h">
      <div class="container" style="text-align:center">
        <p class="kicker">From the reviews</p>
        <h2 id="menu-h">What people order again</h2>
        <div class="menu-list" style="text-align:left">
          ${menu
            .map(
              (m) => `<div class="menu-item"><div class="row"><h3>${escapeHtml(m.title)}</h3><span class="leader" aria-hidden="true"></span></div><p>${escapeHtml(m.description)}</p></div>`
            )
            .join("")}
        </div>
      </div>
    </section>
    <section class="section about-hosp" id="about" aria-labelledby="ab-h">
      <div class="container">
        <p class="kicker">Our place</p>
        <h2 id="ab-h">About ${escapeHtml(business.name)}</h2>
        <p class="muted" style="white-space:pre-line">${escapeHtml(copy.about_section)}</p>
        ${testimonialsBlock(copy, "cards")}
      </div>
    </section>
    <section class="section" id="visit" aria-labelledby="visit-h" style="padding-top:0">
      <div class="container">
        <h2 id="visit-h">Visit us</h2>
        <div class="visit-grid">
          <div class="visit-card"><h3 style="margin-bottom:8px">Opening hours</h3>${hoursList(business)}</div>
          ${mapBlock(business, links)}
        </div>
      </div>
    </section>
    <section class="section cta-hosp" id="contact" aria-labelledby="cta-h">
      <div class="container">
        <h2 id="cta-h">${escapeHtml(copy.cta_text || "Reserve a table")}</h2>
        <p class="muted" style="max-width:560px; margin:0 auto 24px">${escapeHtml(copy.contact_section)}</p>
        ${ctaButtons(links, copy, { secondaryLabel: links.phoneDisplay ?? "Call us" })}
      </div>
    </section>
  </main>`;
  return { css, body };
}

// ---------------------------------------------------------------------------
// Variant 4 — Wellness & clinic (calm, trust-first, booking-forward)
// ---------------------------------------------------------------------------

function renderWellnessClinic(ctx: RenderContext, t: Tokens, links: Links): { css: string; body: string } {
  const { business, copy, brief } = ctx;
  const treatments = (copy.highlight_items?.length ? copy.highlight_items : copy.services).slice(0, 6);
  const trust = (brief?.trust_signals?.length ? brief.trust_signals : copy.why_choose_us).slice(0, 4);

  const css = `
  .hero-well { padding:${t.space}px 0; }
  .hero-well .grid { display:grid; gap:38px; align-items:start; }
  @media(min-width:900px){ .hero-well .grid { grid-template-columns:1.15fr .85fr; } }
  .hero-well h1 { font-size:clamp(30px,4.2vw,46px); margin:14px 0 16px; letter-spacing:-.01em; }
  .hero-well .sub { font-size:17px; color:${t.muted}; max-width:520px; margin-bottom:24px; }
  .trust-strip { display:grid; gap:14px; margin-top:34px; }
  @media(min-width:760px){ .trust-strip { grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); } }
  .trust-item { background:var(--surface); border:1px solid ${t.border}; border-radius:12px; padding:14px 16px; font-size:14px; font-weight:600; display:flex; gap:10px; align-items:flex-start; }
  .trust-item::before { content:"✓"; color:var(--primary); font-weight:800; }
  .treat-grid { display:grid; gap:20px; margin-top:26px; }
  @media(min-width:760px){ .treat-grid { grid-template-columns:1fr 1fr; } }
  .treat-card { background:var(--surface); border:1px solid ${t.border}; border-radius:16px; padding:26px; }
  .treat-card h3 { font-size:18px; margin-bottom:6px; }
  .treat-card p { font-size:14.5px; color:${t.muted}; }
  .calm-band { background:${withAlpha(t.primary, "0a")}; }
  .split { display:grid; gap:32px; margin-top:12px; }
  @media(min-width:860px){ .split { grid-template-columns:1fr 1fr; } }
  `;

  const body = `
  <header class="container hero-well">
    <div class="grid">
      <div>
        <p class="kicker">${escapeHtml(business.category)}${business.area ? ` · ${escapeHtml(business.area)}` : ""}</p>
        <h1>${escapeHtml(copy.headline)}</h1>
        <p class="sub">${escapeHtml(copy.subheadline)}</p>
        ${ctaButtons(links, copy, { secondaryLabel: "Call the clinic" })}
        <div class="trust-strip">${trust.map((s) => `<div class="trust-item">${escapeHtml(s)}</div>`).join("")}</div>
      </div>
      ${demoForm(copy, copy.cta_text || "Request an appointment")}
    </div>
  </header>
  <main>
    <section class="section calm-band" id="treatments" aria-labelledby="tr-h">
      <div class="container">
        <p class="kicker">Care</p>
        <h2 id="tr-h">Treatments &amp; services</h2>
        <div class="treat-grid">
          ${treatments.map((s) => `<div class="treat-card"><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.description)}</p></div>`).join("")}
        </div>
      </div>
    </section>
    <section class="section" id="about" aria-labelledby="ab-h">
      <div class="container split">
        <div>
          <p class="kicker">About</p>
          <h2 id="ab-h">About ${escapeHtml(business.name)}</h2>
          <p class="muted" style="white-space:pre-line">${escapeHtml(copy.about_section)}</p>
        </div>
        <div>
          <h3 style="margin-bottom:8px">What patients &amp; visitors say</h3>
          ${testimonialsBlock(copy, "cards")}
        </div>
      </div>
    </section>
    ${faqBlock(copy)}
    <section class="section calm-band" id="visit" aria-labelledby="visit-h">
      <div class="container split">
        <div><h2 id="visit-h">Hours</h2>${hoursList(business)}</div>
        <div><h2>Location</h2>${mapBlock(business, links)}</div>
      </div>
    </section>
    <section class="section" id="contact" aria-labelledby="c-h">
      <div class="container" style="max-width:640px; text-align:center">
        <h2 id="c-h">${escapeHtml(copy.cta_text || "Book a visit")}</h2>
        <p class="muted" style="margin-bottom:22px">${escapeHtml(copy.contact_section)}</p>
        <div style="display:flex; justify-content:center">${ctaButtons(links, copy, { secondaryLabel: links.phoneDisplay ?? "Call us" })}</div>
      </div>
    </section>
  </main>`;
  return { css, body };
}

// ---------------------------------------------------------------------------
// Variant 5 — Creative portfolio (bold type, project-style)
// ---------------------------------------------------------------------------

function renderCreativePortfolio(ctx: RenderContext, t: Tokens, links: Links): { css: string; body: string } {
  const { business, copy } = ctx;
  const projects = (copy.highlight_items?.length ? copy.highlight_items : copy.services).slice(0, 4);

  const css = `
  .hero-crea { padding:${t.space + 24}px 0 ${t.space}px; }
  .hero-crea h1 { font-size:clamp(40px,7vw,76px); line-height:1.02; letter-spacing:-.025em; max-width:900px; margin:18px 0 22px; }
  .hero-crea .rule { width:64px; height:5px; background:var(--accent); }
  .hero-crea .sub { font-size:18px; color:${t.muted}; max-width:560px; margin-bottom:28px; }
  .work-row { display:grid; gap:28px; align-items:center; padding:${Math.round(t.space * 0.6)}px 0; border-top:1px solid ${t.border}; }
  @media(min-width:860px){ .work-row { grid-template-columns:1fr 1fr; } .work-row:nth-child(even) > .panel { order:2; } }
  .work-row .panel { aspect-ratio:16/10; border-radius:14px; display:flex; align-items:flex-end; padding:18px; }
  .work-row .panel span { font-size:13px; font-weight:700; letter-spacing:.1em; color:#fff; text-transform:uppercase; text-shadow:0 1px 4px rgba(0,0,0,.35); }
  .work-row h3 { font-size:clamp(22px,2.6vw,30px); margin-bottom:8px; letter-spacing:-.01em; }
  .work-row p { color:${t.muted}; max-width:480px; }
  .chip-row { display:flex; flex-wrap:wrap; gap:10px; margin-top:20px; }
  .chip { border:1.5px solid var(--text); border-radius:999px; padding:7px 16px; font-size:13.5px; font-weight:600; }
  .big-cta { background:var(--text); color:var(--bg); }
  .big-cta h2 { color:var(--bg); font-size:clamp(32px,5vw,54px); letter-spacing:-.02em; }
  .big-cta .muted { color:${withAlpha("#ffffff", "99")}; }
  .big-cta .btn-primary { background:var(--accent); }
  .big-cta .btn-outline { border-color:var(--bg); color:var(--bg); }
  `;

  const panelColors = [
    `linear-gradient(135deg, ${withAlpha(t.primary, "e6")}, ${withAlpha(t.secondary, "cc")})`,
    `linear-gradient(135deg, ${withAlpha(t.accent, "d9")}, ${withAlpha(t.primary, "b3")})`,
    `linear-gradient(135deg, ${withAlpha(t.secondary, "e6")}, ${withAlpha(t.accent, "99")})`,
    `linear-gradient(135deg, ${withAlpha(t.primary, "cc")}, ${withAlpha(t.accent, "cc")})`,
  ];

  const body = `
  <header class="container hero-crea">
    <p class="kicker">${escapeHtml(business.name)} — ${escapeHtml(business.category)}${business.area ? `, ${escapeHtml(business.area)}` : ""}</p>
    <h1>${escapeHtml(copy.headline)}</h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="sub" style="margin-top:22px">${escapeHtml(copy.subheadline)}</p>
    ${ctaButtons(links, copy)}
    <div class="chip-row">${copy.services.slice(0, 6).map((s) => `<span class="chip">${escapeHtml(s.title)}</span>`).join("")}</div>
  </header>
  <main>
    <section class="section" id="work" aria-labelledby="work-h" style="padding-top:0">
      <div class="container">
        <p class="kicker">What we make</p>
        <h2 id="work-h">Selected work &amp; specialties</h2>
        ${projects
          .map(
            (p, i) => `<div class="work-row"><div class="panel" style="background:${panelColors[i % panelColors.length]}" role="img" aria-label="Placeholder panel for ${escapeHtml(p.title)}"><span>${escapeHtml(p.title)}</span></div><div><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.description)}</p></div></div>`
          )
          .join("")}
      </div>
    </section>
    <section class="section" id="about" aria-labelledby="ab-h" style="border-top:1px solid ${t.border}">
      <div class="container" style="max-width:760px">
        <p class="kicker">Studio</p>
        <h2 id="ab-h">About ${escapeHtml(business.name)}</h2>
        <p class="muted" style="white-space:pre-line">${escapeHtml(copy.about_section)}</p>
        ${testimonialsBlock(copy, "quotes")}
      </div>
    </section>
    <section class="section big-cta" id="contact" aria-labelledby="cta-h">
      <div class="container">
        <h2 id="cta-h">${escapeHtml(copy.cta_text || "Start a project")}</h2>
        <p class="muted" style="max-width:560px; margin:14px 0 26px">${escapeHtml(copy.contact_section)}</p>
        ${ctaButtons(links, copy, { secondaryLabel: links.phoneDisplay ?? "Call us" })}
      </div>
    </section>
    <section class="section" id="visit" aria-labelledby="visit-h">
      <div class="container">
        <h2 id="visit-h">Find the studio</h2>
        ${mapBlock(business, links)}
        <div style="margin-top:20px">${hoursList(business)}</div>
      </div>
    </section>
  </main>`;
  return { css, body };
}

// ---------------------------------------------------------------------------
// Variant 6 — Simple local landing (phone-first, single column)
// ---------------------------------------------------------------------------

function renderSimpleLanding(ctx: RenderContext, t: Tokens, links: Links): { css: string; body: string } {
  const { business, copy } = ctx;

  const css = `
  .landing { max-width:660px; margin:0 auto; padding:0 22px; }
  .hero-simple { text-align:center; padding:${t.space}px 0 ${Math.round(t.space * 0.6)}px; }
  .hero-simple h1 { font-size:clamp(28px,4.5vw,40px); margin:14px 0 12px; }
  .hero-simple .sub { color:${t.muted}; margin-bottom:26px; }
  .big-actions { display:grid; gap:12px; }
  .big-actions a { display:block; text-align:center; padding:17px; border-radius:${t.radius}; font-weight:700; font-size:17px; text-decoration:none; }
  .act-call { background:var(--primary); color:#fff; box-shadow:0 6px 18px ${withAlpha(t.primary, "40")}; }
  .act-wa { background:#16a34a; color:#fff; }
  .act-map { border:2px solid var(--text); color:var(--text); }
  .landing .section { padding:${Math.round(t.space * 0.55)}px 0; border-top:1px solid ${t.border}; }
  .svc-simple { list-style:none; margin-top:12px; }
  .svc-simple li { padding:12px 0 12px 30px; position:relative; border-bottom:1px solid ${t.border}; }
  .svc-simple li:last-child { border-bottom:0; }
  .svc-simple li::before { content:"✓"; position:absolute; left:0; color:var(--primary); font-weight:800; }
  .svc-simple b { display:block; }
  .svc-simple span { font-size:14px; color:${t.muted}; }
  `;

  const body = `
  <div class="landing">
    <header class="hero-simple">
      <p class="kicker">${escapeHtml(business.category)}${business.area ? ` · ${escapeHtml(business.area)}` : ""}</p>
      <h1>${escapeHtml(copy.headline || business.name)}</h1>
      <p class="sub">${escapeHtml(copy.subheadline)}</p>
      <div class="big-actions">
        ${links.tel ? `<a class="act-call" href="${escapeHtml(links.tel)}">📞 Call ${escapeHtml(links.phoneDisplay ?? "us")}</a>` : ""}
        ${links.wa ? `<a class="act-wa" href="${escapeHtml(links.wa)}">💬 ${escapeHtml(copy.cta_text || "WhatsApp us")}</a>` : ""}
        ${links.maps ? `<a class="act-map" href="${escapeHtml(links.maps)}" target="_blank" rel="noopener noreferrer">📍 Get directions</a>` : ""}
      </div>
    </header>
    <main>
      <section class="section" id="about" aria-labelledby="ab-h">
        <h2 id="ab-h">About ${escapeHtml(business.name)}</h2>
        <p class="muted" style="white-space:pre-line">${escapeHtml(copy.about_section)}</p>
      </section>
      <section class="section" id="services" aria-labelledby="svc-h">
        <h2 id="svc-h">Services</h2>
        <ul class="svc-simple">
          ${copy.services.slice(0, 5).map((s) => `<li><b>${escapeHtml(s.title)}</b><span>${escapeHtml(s.description)}</span></li>`).join("")}
        </ul>
      </section>
      ${
        copy.testimonials.length
          ? `<section class="section" id="reviews" aria-labelledby="rev-h"><h2 id="rev-h">What customers say</h2>${testimonialsBlock(copy, "cards")}</section>`
          : ""
      }
      <section class="section" id="hours" aria-labelledby="h-h">
        <h2 id="h-h">Opening hours</h2>
        ${hoursList(business)}
      </section>
      <section class="section" id="visit" aria-labelledby="v-h">
        <h2 id="v-h">Find us</h2>
        ${mapBlock(business, links)}
      </section>
    </main>
  </div>`;
  return { css, body };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const RENDERERS: Record<
  LayoutType,
  (ctx: RenderContext, t: Tokens, links: Links) => { css: string; body: string }
> = {
  "premium-service": renderPremiumService,
  "local-practical": renderLocalPractical,
  hospitality: renderHospitality,
  "wellness-clinic": renderWellnessClinic,
  "creative-portfolio": renderCreativePortfolio,
  "simple-landing": renderSimpleLanding,
};

/** Render the complete self-contained draft-website HTML for a business. */
export function renderWebsite(ctx: RenderContext): string {
  const tokens = deriveTokens(ctx.style, ctx.layout);
  const links = deriveLinks(ctx.business, ctx.copy);
  const { css, body } = RENDERERS[ctx.layout](ctx, tokens, links);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(ctx.copy.seo_title || ctx.business.name)}</title>
  <meta name="description" content="${escapeHtml(ctx.copy.seo_meta_description || "")}" />
  <meta name="robots" content="noindex, nofollow" />
  <style>${baseCss(tokens)}
${css}</style>
</head>
<body>
${draftBanner()}
${body}
${siteFooter(ctx.business)}
</body>
</html>`;
}
