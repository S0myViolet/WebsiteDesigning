// The website renderer: seven structurally different layout variants, each
// with two hero treatments (A/B), business-specific feature sections, and a
// per-business design system (curated Google-Fonts pairing with system
// fallbacks, density, dividers, motion). Output is a complete HTML document
// with all CSS inline and one tiny static reveal script; the only network
// request is the optional font stylesheet (font-display swap, graceful
// fallback offline). Every interpolated string is escaped.

import type {
  BrandIdentityJson,
  BrandLogoAsset,
  DesignBriefJson,
  DesignSystemJson,
  FeatureSection,
  LayoutType,
  VisualStyleJson,
  WebsiteCopyJson,
} from "@/lib/types";
import { normalizePhone, whatsappLink } from "@/lib/utils";
import {
  resolveFontPairing,
  type FontPairing,
} from "@/lib/website-builder/fonts";
import type { HeroVariant } from "@/lib/website-builder/uniqueness";

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
  /** Deeper design system (typography pairing, density, dividers, motion) */
  system?: DesignSystemJson | null;
  layout: LayoutType;
  heroVariant?: HeroVariant;
  /** Extracted logo / brand identity (logo used at high/medium confidence) */
  brand?: BrandIdentityJson | null;
}

/** The real logo asset, only when confident it belongs to the business. */
export function usableLogoAsset(
  brand?: BrandIdentityJson | null
): BrandLogoAsset | null {
  if (!brand?.logo || !brand.logo_found) return null;
  return brand.logo_confidence === "high" || brand.logo_confidence === "medium"
    ? brand.logo
    : null;
}

/** Logo + name lockup. Opaque crops sit in a small white plaque. */
function brandMark(
  name: string,
  logo: BrandLogoAsset,
  opts?: { onDark?: boolean; nameClass?: string }
): string {
  const plaque = !logo.transparent || (opts?.onDark && !logo.darkSafe);
  return `<span class="brand-mark"><img class="brand-logo${plaque ? " plaque" : ""}" src="${logo.dataUrl}" alt="${escapeHtml(name)} logo" /><span class="${opts?.nameClass ?? "brand-mark-name"}">${escapeHtml(name)}</span></span>`;
}

/** Layouts whose renderers already ship a real top nav (logo goes there). */
const NAV_LAYOUTS: LayoutType[] = ["premium-service", "premium-professional"];

const NOTE_SHORT = "Concept draft";
const NOTE_LONG =
  "Design concept generated from the public Google profile — not the live website";
const DISCLAIMER =
  "This is a website concept draft prepared from publicly available Google Maps profile data. It is not the official website of this business and is not published on its behalf.";

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
  headingWeight: number;
  headingTracking: string;
  bodyFont: string;
  radius: string;
  /** vertical section padding in px */
  space: number;
  /** divider treatment between sections */
  divider: "hairline" | "motif" | "angled" | "none";
  /** motif glyph used by dividers/ornaments */
  motifGlyph: string;
  /** reveal-on-scroll animations enabled */
  motion: boolean;
  font: FontPairing;
}

const SERIF_STACK = 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';

const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

/** Motif glyphs per layout — small, restrained ornaments. */
const LAYOUT_MOTIFS: Record<LayoutType, string> = {
  "premium-service": "✳",
  "local-practical": "▸",
  hospitality: "✦",
  "wellness-clinic": "○",
  "creative-portfolio": "—",
  "premium-professional": "§",
  "simple-landing": "·",
};

function deriveTokens(
  style: VisualStyleJson | null,
  system: DesignSystemJson | null | undefined,
  layout: LayoutType
): Tokens {
  const fallbacks: Record<LayoutType, Partial<Tokens>> = {
    "premium-service": { primary: "#8a6d4b", secondary: "#2b2320", accent: "#c9a36a", background: "#faf7f2", surface: "#ffffff", text: "#28211c" },
    "local-practical": { primary: "#b45309", secondary: "#1f2937", accent: "#f59e0b", background: "#f8fafc", surface: "#ffffff", text: "#111827" },
    hospitality: { primary: "#9a3412", secondary: "#3f2212", accent: "#d97706", background: "#fdf8f0", surface: "#ffffff", text: "#2a1c10" },
    "wellness-clinic": { primary: "#0e7490", secondary: "#164e63", accent: "#14b8a6", background: "#f7fafb", surface: "#ffffff", text: "#0f2530" },
    "creative-portfolio": { primary: "#111111", secondary: "#4b4b4b", accent: "#e11d48", background: "#fafafa", surface: "#ffffff", text: "#111111" },
    "premium-professional": { primary: "#1e3a5f", secondary: "#0f1f33", accent: "#b08d57", background: "#f7f8fa", surface: "#ffffff", text: "#16222f" },
    "simple-landing": { primary: "#1d4ed8", secondary: "#1e3a5f", accent: "#f59e0b", background: "#f8fafc", surface: "#ffffff", text: "#111827" },
  };
  const fb = fallbacks[layout];
  const p = style?.color_palette;

  const font = resolveFontPairing(
    system?.typography_system.font_pairing,
    layout
  );

  const radiusSource = `${system?.corner_radius_style ?? ""} ${style?.button_style ?? ""}`;
  const radius = /pill/i.test(radiusSource)
    ? "999px"
    : /sharp|square/i.test(radiusSource)
      ? "3px"
      : "10px";

  const density = `${system?.visual_density ?? ""} ${style?.section_spacing ?? ""}`;
  const space = /dense|compact/i.test(density)
    ? 60
    : /airy|generous/i.test(density)
      ? 100
      : 80;

  const dividerSource = system?.section_divider_style ?? "";
  const divider: Tokens["divider"] = /motif/i.test(dividerSource)
    ? "motif"
    : /angle|diagonal/i.test(dividerSource)
      ? "angled"
      : /none/i.test(dividerSource)
        ? "none"
        : "hairline";

  const motion = !/none|still|static/i.test(system?.motion_style ?? "");

  const text = safeHex(p?.text, fb.text!);
  return {
    primary: safeHex(p?.primary, fb.primary!),
    secondary: safeHex(p?.secondary, fb.secondary!),
    accent: safeHex(p?.accent, fb.accent!),
    background: safeHex(p?.background, fb.background!),
    surface: safeHex(p?.surface, fb.surface!),
    text,
    muted: withAlpha(text, "99"),
    border: withAlpha(text, "17"),
    headingFont: `${font.headingFamily}, ${font.headingFallback}`,
    headingWeight: font.headingWeight,
    headingTracking: font.headingTracking,
    bodyFont: `${font.bodyFamily}, ${font.bodyFallback}`,
    radius,
    space,
    divider,
    motifGlyph: LAYOUT_MOTIFS[layout],
    motion,
    font,
  };
}

// ---------------------------------------------------------------------------
// Shared link + block builders
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

/** "Open today" line from the weekday descriptions, if derivable. */
function todayLine(business: PreviewBusiness): string | null {
  if (business.openingHours.length === 0) return null;
  const day = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const line = business.openingHours.find((h) => h.startsWith(day));
  return line ?? null;
}

/**
 * Compliance notice, composed like a professional proof tag rather than a
 * warning strip: a slim dark ribbon on top (static, scrolls away) plus the
 * full disclaimer sentence in the footer bar.
 */
function draftNote(): string {
  return `<div class="draft-note" role="note"><div class="inner"><b>${escapeHtml(NOTE_SHORT)}</b><span>${escapeHtml(NOTE_LONG)}</span></div></div>`;
}

/**
 * Asymmetric section header with an oversized outlined index numeral — the
 * editorial device that breaks uniform section stacking.
 */
function sectionHead(
  index: number,
  kicker: string,
  title: string,
  headingId: string,
  intro?: string
): string {
  return `<div class="sec-head">
    <div><p class="kicker">${escapeHtml(kicker)}</p><p class="ghost" aria-hidden="true">${String(index).padStart(2, "0")}</p></div>
    <div><h2 id="${headingId}">${escapeHtml(title)}</h2>${intro ? `<p class="intro">${escapeHtml(intro)}</p>` : ""}</div>
  </div>`;
}

/** Motif divider between sections (only when the design system asks for it). */
function motifDivider(t: Tokens): string {
  if (t.divider !== "motif") return "";
  return `<div class="divider" aria-hidden="true"><span class="g">${escapeHtml(`${t.motifGlyph} ${t.motifGlyph} ${t.motifGlyph}`)}</span></div>`;
}

/**
 * The showcase list (signature menu / practice index / treatments / work).
 * Starts from highlight_items and tops up from services so a thin AI response
 * (1-2 highlights) never produces a sparse-looking hero section.
 */
function mergedHighlights(
  copy: WebsiteCopyJson,
  min: number,
  max: number
): { title: string; description: string }[] {
  const items = [...(copy.highlight_items ?? [])];
  if (items.length < min) {
    const seen = new Set(items.map((i) => i.title.trim().toLowerCase()));
    for (const s of copy.services) {
      if (items.length >= min) break;
      if (!seen.has(s.title.trim().toLowerCase())) {
        items.push(s);
        seen.add(s.title.trim().toLowerCase());
      }
    }
  }
  return items.slice(0, max);
}

function ctaButtons(
  links: Links,
  copy: WebsiteCopyJson,
  opts: { primaryLabel?: string; secondaryLabel?: string; micro?: string } = {}
): string {
  const primaryHref = links.wa ?? links.tel ?? "#contact";
  const primaryLabel = opts.primaryLabel ?? copy.cta_text ?? "Contact us";
  const secondary = links.wa && links.tel
    ? `<a class="btn btn-outline" href="${escapeHtml(links.tel)}" aria-label="Call by phone">${escapeHtml(
        opts.secondaryLabel ?? "Call us"
      )}</a>`
    : "";
  const micro = opts.micro
    ? `<p class="micro">${escapeHtml(opts.micro)}</p>`
    : "";
  return `<div class="cta-wrap"><div class="btn-row">
    <a class="btn btn-primary" href="${escapeHtml(primaryHref)}" aria-label="${links.wa ? "Contact on WhatsApp" : "Contact"}">${escapeHtml(primaryLabel)}<span class="arr" aria-hidden="true">→</span></a>
    ${secondary}
  </div>${micro}</div>`;
}

/** Sticky bottom contact bar on mobile — one of the "premium detail" touches. */
function stickyMobileCta(links: Links, copy: WebsiteCopyJson): string {
  if (!links.tel && !links.wa) return "";
  return `<div class="sticky-cta" role="complementary" aria-label="Quick contact">
    ${links.tel ? `<a href="${escapeHtml(links.tel)}" class="s-call" aria-label="Call now">Call</a>` : ""}
    ${links.wa ? `<a href="${escapeHtml(links.wa)}" class="s-wa" aria-label="Message on WhatsApp">${escapeHtml(copy.cta_text || "WhatsApp")}</a>` : ""}
  </div>`;
}

/** Thin band of review themes — trust signals grounded in real praise. */
function reviewStrip(copy: WebsiteCopyJson, brief: DesignBriefJson | null): string {
  const themes = (brief?.review_based_strengths?.length
    ? brief.review_based_strengths
    : copy.why_choose_us
  ).slice(0, 3);
  if (themes.length === 0) return "";
  return `<div class="review-strip reveal" aria-label="What reviewers mention">
    <div class="container inner">
      <span class="rs-label">From the reviews</span>
      ${themes.map((t) => `<span class="rs-item">${escapeHtml(t)}</span>`).join('<span class="rs-dot" aria-hidden="true">•</span>')}
    </div>
  </div>`;
}

function hoursList(business: PreviewBusiness): string {
  if (business.openingHours.length === 0) {
    return `<p class="muted">Contact us for current opening hours.</p>`;
  }
  return `<ul class="hours-list">${business.openingHours
    .map((line) => {
      const idx = line.indexOf(":");
      const day = idx > 0 ? line.slice(0, idx) : line;
      const time = idx > 0 ? line.slice(idx + 1).trim() : "";
      return `<li><span>${escapeHtml(day)}</span><span class="hl-time">${escapeHtml(time)}</span></li>`;
    })
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
        ? `<p class="map-link"><a href="${escapeHtml(links.maps)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(business.name)} on Google Maps">Open in Google Maps</a></p>`
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
        (t, i) =>
          `<blockquote class="pull-quote reveal" style="transition-delay:${i * 80}ms"><span aria-hidden="true">&ldquo;</span>${escapeHtml(t)}</blockquote>`
      )
      .join("")}</div>`;
  }
  return `<div class="t-grid">${items
    .map(
      (t, i) =>
        `<blockquote class="t-card reveal" style="transition-delay:${i * 80}ms"><span class="qmark" aria-hidden="true">&ldquo;</span><p>${escapeHtml(t)}</p></blockquote>`
    )
    .join("")}</div>`;
}

function faqBlock(copy: WebsiteCopyJson): string {
  const items = (copy.faq ?? []).slice(0, 5);
  if (items.length === 0) return "";
  return `<section class="section" id="faq" aria-labelledby="faq-h">
    <div class="container narrow">
      <p class="kicker">Questions</p>
      <h2 id="faq-h">Common questions</h2>
      ${items
        .map(
          (f) => `<details class="faq-item reveal"><summary>${escapeHtml(f.question)}</summary><p>${escapeHtml(f.answer)}</p></details>`
        )
        .join("")}
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Business-specific feature sections (checklist / steps / reassurance / ...)
// ---------------------------------------------------------------------------

function featureChecklist(s: FeatureSection): string {
  return `<section class="section feat feat-checklist" aria-label="${escapeHtml(s.title)}">
    <div class="container">
      <div class="feat-panel reveal">
        <div class="feat-head"><p class="kicker">Included</p><h2>${escapeHtml(s.title)}</h2>
        ${s.intro ? `<p class="muted">${escapeHtml(s.intro)}</p>` : ""}</div>
        <ul class="check-grid">
          ${s.items.map((i) => `<li><span class="tick" aria-hidden="true">✓</span><div><b>${escapeHtml(i.title)}</b>${i.description ? `<p>${escapeHtml(i.description)}</p>` : ""}</div></li>`).join("")}
        </ul>
      </div>
    </div>
  </section>`;
}

function featureSteps(s: FeatureSection): string {
  return `<section class="section feat feat-steps" aria-label="${escapeHtml(s.title)}">
    <div class="container">
      <p class="kicker">How it works</p>
      <h2>${escapeHtml(s.title)}</h2>
      ${s.intro ? `<p class="muted feat-intro">${escapeHtml(s.intro)}</p>` : ""}
      <ol class="steps">
        ${s.items.map((i, n) => `<li class="reveal" style="transition-delay:${n * 90}ms"><span class="step-num" aria-hidden="true">${n + 1}</span><div><b>${escapeHtml(i.title)}</b>${i.description ? `<p>${escapeHtml(i.description)}</p>` : ""}</div></li>`).join("")}
      </ol>
    </div>
  </section>`;
}

function featureReassurance(s: FeatureSection): string {
  return `<section class="section feat feat-reassure" aria-label="${escapeHtml(s.title)}">
    <div class="container narrow">
      <div class="reassure-panel reveal">
        <p class="kicker">Good to know</p>
        <h2>${escapeHtml(s.title)}</h2>
        ${s.intro ? `<p class="reassure-intro">${escapeHtml(s.intro)}</p>` : ""}
        <div class="reassure-items">
          ${s.items.map((i) => `<div class="r-item"><b>${escapeHtml(i.title)}</b>${i.description ? `<p>${escapeHtml(i.description)}</p>` : ""}</div>`).join("")}
        </div>
      </div>
    </div>
  </section>`;
}

function featurePerfectFor(s: FeatureSection): string {
  return `<section class="section feat feat-perfect" aria-label="${escapeHtml(s.title)}">
    <div class="container">
      <p class="kicker">Come here for</p>
      <h2>${escapeHtml(s.title)}</h2>
      ${s.intro ? `<p class="muted feat-intro">${escapeHtml(s.intro)}</p>` : ""}
      <div class="perfect-grid">
        ${s.items.map((i, n) => `<div class="p-card reveal" style="transition-delay:${n * 70}ms"><b>${escapeHtml(i.title)}</b>${i.description ? `<p>${escapeHtml(i.description)}</p>` : ""}</div>`).join("")}
      </div>
    </div>
  </section>`;
}

function featureHighlights(s: FeatureSection): string {
  return `<section class="section feat feat-highlights" aria-label="${escapeHtml(s.title)}">
    <div class="container">
      <p class="kicker">Highlights</p>
      <h2>${escapeHtml(s.title)}</h2>
      ${s.intro ? `<p class="muted feat-intro">${escapeHtml(s.intro)}</p>` : ""}
      <div class="hl-list">
        ${s.items.map((i, n) => `<div class="hl-row reveal" style="transition-delay:${n * 60}ms"><div class="hl-t"><b>${escapeHtml(i.title)}</b><span class="leader" aria-hidden="true"></span></div>${i.description ? `<p>${escapeHtml(i.description)}</p>` : ""}</div>`).join("")}
      </div>
    </div>
  </section>`;
}

function featureServiceArea(s: FeatureSection, business: PreviewBusiness): string {
  return `<section class="section feat feat-area" aria-label="${escapeHtml(s.title)}">
    <div class="container">
      <div class="area-grid">
        <div>
          <p class="kicker">Where we work</p>
          <h2>${escapeHtml(s.title)}</h2>
          ${s.intro ? `<p class="muted feat-intro">${escapeHtml(s.intro)}</p>` : ""}
          <div class="area-chips">
            ${s.items.map((i) => `<span class="chip" title="${escapeHtml(i.description)}">${escapeHtml(i.title)}</span>`).join("")}
          </div>
        </div>
        <div class="area-note reveal">
          <b>Based in ${escapeHtml(business.area ?? "Dubai")}</b>
          <p class="muted">${escapeHtml(business.address ?? "Contact us for directions.")}</p>
        </div>
      </div>
    </div>
  </section>`;
}

function renderFeatureSections(
  copy: WebsiteCopyJson,
  business: PreviewBusiness,
  opts: { skipHighlights?: boolean } = {}
): string {
  let sections = (copy.feature_sections ?? []).slice(0, 3);
  // Layouts that already give highlight_items a hero treatment (signature
  // menu / practice index / treatments) must not repeat the same dotted-list
  // pattern as a feature section right below it.
  if (opts.skipHighlights && (copy.highlight_items?.length ?? 0) > 0) {
    sections = sections.filter((s) => s.type !== "highlights");
  }
  return sections
    .map((s) => {
      switch (s.type) {
        case "checklist":
          return featureChecklist(s);
        case "steps":
          return featureSteps(s);
        case "reassurance":
          return featureReassurance(s);
        case "perfect-for":
          return featurePerfectFor(s);
        case "service-area":
          return featureServiceArea(s, business);
        case "highlights":
        default:
          return featureHighlights(s);
      }
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Premium multi-column footer
// ---------------------------------------------------------------------------

function siteFooter(
  business: PreviewBusiness,
  links: Links,
  copy: WebsiteCopyJson,
  logo: BrandLogoAsset | null = null
): string {
  const areaSuffix = business.area ? ` · ${escapeHtml(business.area)}` : "";
  const today = todayLine(business);
  const footLogo = logo
    ? `<img class="brand-logo foot-logo${logo.transparent ? "" : " plaque"}" src="${logo.dataUrl}" alt="${escapeHtml(business.name)} logo" />`
    : "";
  return `<footer class="site-footer">
    <div class="container foot-grid">
      <div>
        ${footLogo}<p class="brand">${escapeHtml(business.name)}</p>
        <p class="muted">${escapeHtml(business.category)}${areaSuffix}</p>
        ${copy.seo_meta_description ? `<p class="foot-desc">${escapeHtml(copy.seo_meta_description)}</p>` : ""}
      </div>
      <div>
        <p class="foot-h">Contact</p>
        ${links.phoneDisplay && links.tel ? `<p><a href="${escapeHtml(links.tel)}">${escapeHtml(links.phoneDisplay)}</a></p>` : ""}
        ${links.wa ? `<p><a href="${escapeHtml(links.wa)}">WhatsApp</a></p>` : ""}
        ${links.maps ? `<p><a href="${escapeHtml(links.maps)}" target="_blank" rel="noopener noreferrer">Google Maps</a></p>` : ""}
      </div>
      <div>
        <p class="foot-h">Visit</p>
        ${business.address ? `<p class="muted">${escapeHtml(business.address)}</p>` : ""}
        ${today ? `<p class="muted">${escapeHtml(today)}</p>` : ""}
      </div>
    </div>
    <div class="foot-bar"><div class="container"><p class="small">${escapeHtml(DISCLAIMER)}</p></div></div>
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
  body { font-family:${t.bodyFont}; background:var(--bg); color:var(--text); line-height:1.68; font-size:16px; -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }
  img, iframe { max-width:100%; }
  a { color:var(--primary); text-decoration-thickness:1px; text-underline-offset:3px; }
  h1,h2,h3 { font-family:${t.headingFont}; line-height:1.12; color:var(--text); font-weight:${t.headingWeight}; letter-spacing:${t.headingTracking}; }
  h2 { font-size:clamp(28px,3.6vw,42px); margin-bottom:14px; }
  .container { max-width:1140px; margin:0 auto; padding:0 24px; }
  .container.narrow { max-width:780px; }
  .section { padding:${t.space}px 0; position:relative; }
  .muted { color:${t.muted}; }
  .small { font-size:13px; color:${t.muted}; }
  .micro { font-size:12.5px; color:${t.muted}; margin-top:10px; letter-spacing:.01em; }
  .kicker { font-size:11.5px; font-weight:700; letter-spacing:.22em; text-transform:uppercase; color:var(--primary); margin-bottom:12px; display:flex; align-items:center; gap:12px; font-family:${t.bodyFont}; }
  .kicker::after { content:""; height:1px; width:44px; background:${withAlpha(t.primary, "59")}; }

  /* Real extracted brand logo (high/medium confidence only). Opaque crops
     sit in a small white plaque so any photo background reads as intentional. */
  .brand-mark { display:inline-flex; align-items:center; gap:12px; min-width:0; }
  .brand-logo { height:40px; width:auto; max-width:190px; object-fit:contain; display:block; }
  .brand-logo.plaque { background:#fff; padding:5px 9px; border-radius:9px; box-shadow:0 1px 5px rgba(0,0,0,.10); }
  .brand-mark-name, .nav-brand-name { font-family:${t.headingFont}; font-weight:700; font-size:17px; color:inherit; }
  .brand-bar { background:var(--bg); border-bottom:1px solid ${t.border}; }
  .brand-bar .inner { max-width:1140px; margin:0 auto; padding:12px 24px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
  .brand-bar-cta { font-size:14px; font-weight:650; color:var(--primary); text-decoration:none; white-space:nowrap; }
  .brand-bar-cta:hover { text-decoration:underline; }
  .foot-logo { height:34px; margin-bottom:10px; }

  /* Concept-draft notice: compliant but composed — a professional proof tag,
     not a warning banner. Static ribbon on top + repeated in the footer. */
  .draft-note { background:var(--secondary); color:${withAlpha("#ffffff", "b3")}; font-size:11px; letter-spacing:.14em; text-transform:uppercase; }
  .draft-note .inner { max-width:1140px; margin:0 auto; padding:8px 24px; display:flex; justify-content:space-between; gap:14px; align-items:center; }
  .draft-note b { color:#fff; font-weight:600; letter-spacing:.18em; }
  .draft-note span { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

  /* Asymmetric section header: kicker + oversized ghost index left, title +
     intro right. The editorial move that kills flat section stacking. */
  .sec-head { display:grid; gap:10px 48px; align-items:end; margin-bottom:34px; }
  @media(min-width:880px){ .sec-head { grid-template-columns:minmax(150px,.42fr) 1fr; } }
  .sec-head .ghost { font-family:${t.headingFont}; font-size:clamp(64px,8vw,110px); line-height:.8; font-weight:${t.headingWeight}; color:transparent; -webkit-text-stroke:1.5px ${withAlpha(t.text, "2b")}; user-select:none; }
  .sec-head h2 { margin-bottom:6px; }
  .sec-head .intro { color:${t.muted}; max-width:560px; font-size:15.5px; }

  .divider { display:flex; align-items:center; gap:18px; max-width:1140px; margin:0 auto; padding:0 24px; color:${withAlpha(t.primary, "8c")}; }
  .divider::before, .divider::after { content:""; flex:1; height:1px; background:${t.border}; }
  .divider .g { font-size:13px; letter-spacing:.4em; }

  .btn-row { display:flex; flex-wrap:wrap; gap:14px; }
  .btn { display:inline-flex; align-items:center; gap:10px; padding:14px 28px; border-radius:${t.radius}; font-weight:600; font-size:15.5px; text-decoration:none; transition:transform .18s ease, box-shadow .18s ease, opacity .18s ease, background-color .18s ease; }
  .btn .arr { display:inline-block; transition:transform .18s ease; font-family:${t.bodyFont}; }
  .btn:hover { transform:translateY(-2px); }
  .btn:hover .arr { transform:translateX(4px); }
  .btn-primary { background:var(--primary); color:#fff; box-shadow:0 8px 22px ${withAlpha(t.primary, "38")}; }
  .btn-primary:hover { box-shadow:0 12px 28px ${withAlpha(t.primary, "4d")}; }
  .btn-outline { border:1.5px solid ${withAlpha(t.text, "40")}; color:var(--text); background:transparent; }
  .btn-outline:hover { border-color:var(--text); background:${withAlpha(t.text, "08")}; }

  .review-strip { background:var(--surface); border-block:1px solid ${t.border}; }
  .review-strip .inner { display:flex; flex-wrap:wrap; align-items:baseline; gap:10px 22px; padding-block:18px; }
  .rs-label { font-size:11px; font-weight:700; letter-spacing:.18em; text-transform:uppercase; color:var(--primary); margin-right:4px; }
  .rs-item { color:${t.muted}; font-family:${t.headingFont}; font-size:15.5px; font-style:${t.font.hasDisplayItalic ? "italic" : "normal"}; }
  .rs-dot { color:${withAlpha(t.primary, "66")}; }

  .hours-list { list-style:none; }
  .hours-list li { display:flex; justify-content:space-between; gap:18px; padding:9px 0; font-size:14.5px; border-bottom:1px solid ${t.border}; }
  .hours-list li:last-child { border-bottom:0; }
  .hours-list .hl-time { color:${t.muted}; white-space:nowrap; }
  .map-frame { border:1px solid ${t.border}; border-radius:16px; overflow:hidden; margin-top:16px; box-shadow:0 10px 30px ${withAlpha(t.text, "0f")}; }
  .map-frame iframe { display:block; width:100%; height:300px; border:0; }
  .map-link a { font-weight:600; }

  .t-grid { display:grid; gap:22px; margin-top:28px; }
  @media(min-width:760px){ .t-grid { grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); } }
  .t-card { background:var(--surface); border:1px solid ${t.border}; border-radius:16px; padding:26px; font-size:14.5px; color:${t.muted}; transition:transform .2s ease, box-shadow .2s ease; }
  .t-card:hover { transform:translateY(-3px); box-shadow:0 14px 30px ${withAlpha(t.text, "12")}; }
  .t-card .qmark { display:block; font-family:${SERIF_STACK}; font-size:36px; line-height:1; color:var(--primary); }
  .t-card p { margin-top:6px; }
  .quotes { margin-top:26px; display:grid; gap:22px; }
  .pull-quote { font-family:${t.headingFont}; font-size:clamp(19px,2.3vw,25px); line-height:1.5; color:var(--text); max-width:740px; margin:0 auto; text-align:center; }
  .pull-quote span { color:var(--primary); font-size:1.35em; }

  .demo-form { background:var(--surface); border:1px solid ${t.border}; border-radius:18px; padding:28px; box-shadow:0 18px 44px ${withAlpha(t.text, "14")}; }
  .demo-form h3 { margin-bottom:4px; font-size:19px; }
  .form-field { margin-top:14px; }
  .form-field label { display:block; font-size:13px; font-weight:600; margin-bottom:5px; }
  .form-field input, .form-field textarea { width:100%; border:1px solid ${withAlpha(t.text, "26")}; border-radius:9px; padding:11px 13px; font-size:14px; font-family:inherit; background:var(--bg); transition:border-color .15s ease; }
  .form-field input:focus, .form-field textarea:focus { outline:2px solid var(--primary); outline-offset:1px; }
  .demo-form button { margin-top:22px; width:100%; padding:13px; border:0; border-radius:${t.radius}; background:${withAlpha(t.text, "1c")}; color:${t.muted}; font-weight:600; cursor:not-allowed; }

  .faq-item { background:var(--surface); border:1px solid ${t.border}; border-radius:14px; padding:17px 22px; margin-top:12px; transition:border-color .15s ease; }
  .faq-item:hover { border-color:${withAlpha(t.primary, "59")}; }
  .faq-item summary { font-weight:600; cursor:pointer; }
  .faq-item p { margin-top:10px; font-size:14.5px; color:${t.muted}; }

  /* Feature sections */
  .feat-intro { max-width:640px; margin-bottom:8px; }
  .feat-panel { background:var(--surface); border:1px solid ${t.border}; border-radius:20px; padding:38px; box-shadow:0 16px 44px ${withAlpha(t.text, "0d")}; }
  .feat-head { max-width:640px; margin-bottom:22px; }
  .check-grid { list-style:none; display:grid; gap:16px 30px; }
  @media(min-width:760px){ .check-grid { grid-template-columns:1fr 1fr; } }
  .check-grid li { display:flex; gap:13px; align-items:flex-start; }
  .check-grid .tick { flex:none; width:24px; height:24px; border-radius:8px; background:${withAlpha(t.primary, "17")}; color:var(--primary); font-size:13px; font-weight:800; display:flex; align-items:center; justify-content:center; margin-top:2px; }
  .check-grid b { font-size:15px; }
  .check-grid p { font-size:13.5px; color:${t.muted}; margin-top:2px; }
  .steps { list-style:none; margin-top:26px; display:grid; gap:0; position:relative; }
  .steps li { display:flex; gap:20px; padding:18px 0; position:relative; }
  .steps li::before { content:""; position:absolute; left:17px; top:54px; bottom:-6px; width:2px; background:${withAlpha(t.primary, "26")}; }
  .steps li:last-child::before { display:none; }
  .step-num { flex:none; width:36px; height:36px; border-radius:999px; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:15px; box-shadow:0 6px 14px ${withAlpha(t.primary, "40")}; }
  .steps b { font-size:16.5px; }
  .steps p { font-size:14.5px; color:${t.muted}; margin-top:3px; max-width:560px; }
  .reassure-panel { background:linear-gradient(160deg, ${withAlpha(t.primary, "0f")}, ${withAlpha(t.accent, "0a")}); border:1px solid ${withAlpha(t.primary, "21")}; border-radius:22px; padding:40px; }
  .reassure-intro { font-family:${t.headingFont}; font-size:clamp(17px,2vw,21px); color:var(--text); margin:6px 0 20px; }
  .reassure-items { display:grid; gap:16px; }
  @media(min-width:700px){ .reassure-items { grid-template-columns:1fr 1fr; } }
  .r-item b { font-size:15px; }
  .r-item p { font-size:13.5px; color:${t.muted}; margin-top:3px; }
  .perfect-grid { display:grid; gap:16px; margin-top:26px; }
  @media(min-width:700px){ .perfect-grid { grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); } }
  .p-card { background:var(--surface); border:1px solid ${t.border}; border-left:4px solid var(--accent); border-radius:12px; padding:20px 22px; transition:transform .18s ease, box-shadow .18s ease; }
  .p-card:hover { transform:translateY(-3px); box-shadow:0 12px 26px ${withAlpha(t.text, "10")}; }
  .p-card b { font-size:15.5px; }
  .p-card p { font-size:13.5px; color:${t.muted}; margin-top:4px; }
  .hl-list { margin-top:26px; max-width:820px; }
  .hl-row { padding:17px 0; border-bottom:1px dashed ${withAlpha(t.text, "2e")}; }
  .hl-row:last-child { border-bottom:0; }
  .hl-t { display:flex; align-items:baseline; gap:12px; }
  .hl-t b { font-family:${t.headingFont}; font-size:18.5px; white-space:nowrap; }
  .hl-t .leader { flex:1; border-bottom:2px dotted ${withAlpha(t.text, "38")}; transform:translateY(-4px); }
  .hl-row p { font-size:14px; color:${t.muted}; margin-top:4px; max-width:640px; }
  .area-grid { display:grid; gap:32px; align-items:start; }
  @media(min-width:820px){ .area-grid { grid-template-columns:1.2fr .8fr; } }
  .area-chips { display:flex; flex-wrap:wrap; gap:10px; margin-top:18px; }
  .chip { border:1.5px solid ${withAlpha(t.primary, "4d")}; color:var(--text); border-radius:999px; padding:8px 18px; font-size:13.5px; font-weight:600; background:var(--surface); }
  .area-note { background:var(--surface); border:1px solid ${t.border}; border-radius:16px; padding:26px; }
  .area-note p { margin-top:6px; font-size:14px; }

  /* Footer */
  .site-footer { border-top:1px solid ${t.border}; background:var(--surface); margin-top:20px; }
  .foot-grid { display:grid; gap:34px; padding:52px 24px 40px; }
  @media(min-width:820px){ .foot-grid { grid-template-columns:1.4fr 1fr 1fr; } }
  .site-footer .brand { font-family:${t.headingFont}; font-weight:700; font-size:19px; }
  .foot-desc { font-size:13.5px; color:${t.muted}; margin-top:10px; max-width:380px; }
  .foot-h { font-size:12px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:${t.muted}; margin-bottom:10px; }
  .site-footer p { font-size:14px; margin-top:4px; }
  .foot-bar { border-top:1px solid ${t.border}; padding:14px 0; }
  .foot-bar .small { text-align:center; }

  /* Sticky mobile CTA */
  .sticky-cta { position:fixed; bottom:0; left:0; right:0; z-index:60; display:none; gap:1px; box-shadow:0 -6px 24px rgba(0,0,0,.16); }
  .sticky-cta a { flex:1; text-align:center; padding:15px 10px; font-weight:700; font-size:15px; text-decoration:none; color:#fff; }
  .sticky-cta .s-call { background:var(--secondary); }
  .sticky-cta .s-wa { background:var(--primary); }
  @media(max-width:759px){ .sticky-cta { display:flex; } body { padding-bottom:64px; } }

  /* Reveal-on-scroll (JS adds .js to <html>; falls back to visible without JS) */
  .js .reveal { opacity:0; transform:translateY(16px); transition:opacity .6s ease, transform .6s ease; }
  .js .reveal.in { opacity:1; transform:none; }
  @media (prefers-reduced-motion: reduce) {
    .js .reveal { opacity:1; transform:none; transition:none; }
    html { scroll-behavior:auto; }
    .btn:hover, .t-card:hover, .p-card:hover { transform:none; }
  }
  `;
}

/** Static, no-interpolation reveal script (safe by construction). */
const REVEAL_SCRIPT = `<script>
document.documentElement.classList.add("js");
(function () {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
    return;
  }
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) { entry.target.classList.add("in"); io.unobserve(entry.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px" });
  document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
})();
</script>`;

// ---------------------------------------------------------------------------
// Variant 1 — Editorial luxury (premium-service)
// ---------------------------------------------------------------------------

function renderPremiumService(ctx: RenderContext, t: Tokens, links: Links): { css: string; body: string } {
  const navLogo = usableLogoAsset(ctx.brand);
  const { business, copy, brief } = ctx;
  const hv = ctx.heroVariant ?? "a";
  const monogram = escapeHtml(business.name.trim().charAt(0).toUpperCase() || "•");
  const signatures = mergedHighlights(copy, 3, 4);
  const today = todayLine(business);

  const css = `
  .top-nav { position:sticky; top:0; z-index:50; background:${withAlpha(t.background, "f0")}; backdrop-filter:blur(10px); border-bottom:1px solid ${t.border}; }
  .top-nav .inner { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:15px 24px; max-width:1140px; margin:0 auto; }
  .top-nav .name { font-family:${t.headingFont}; font-weight:700; font-size:18px; color:var(--text); text-decoration:none; letter-spacing:.01em; }
  .top-nav .nav-links { display:none; gap:26px; font-size:14px; }
  .top-nav .nav-links a { color:${t.muted}; text-decoration:none; font-weight:500; }
  .top-nav .nav-links a:hover { color:var(--text); }
  @media(min-width:860px){ .top-nav .nav-links { display:flex; } }
  .top-nav .btn { padding:10px 20px; font-size:14px; }

  .hero-split { display:grid; gap:44px; align-items:center; padding:${t.space + 12}px 0 ${t.space}px; }
  @media(min-width:880px){ .hero-split { grid-template-columns:1.1fr .9fr; } }
  .hero-split h1 { font-size:clamp(36px,4.8vw,58px); letter-spacing:-.02em; margin:18px 0 20px; }
  .hero-split h1 em { font-style:italic; color:var(--primary); }
  .hero-split .sub { font-size:19px; color:${t.muted}; max-width:520px; margin-bottom:30px; ${t.font.hasDisplayItalic ? `font-family:${t.headingFont}; font-style:italic; font-weight:480;` : ""} }
  .panel-stack { position:relative; aspect-ratio:4/5; }
  .panel-stack .p1 { position:absolute; inset:0 10% 12% 0; border-radius:22px; background:linear-gradient(160deg, ${withAlpha(t.primary, "2b")}, ${withAlpha(t.accent, "1f")} 65%, ${withAlpha(t.secondary, "14")}); display:flex; align-items:center; justify-content:center; }
  .panel-stack .p1 span { font-family:${t.headingFont}; font-style:${t.font.hasDisplayItalic ? "italic" : "normal"}; font-size:clamp(96px,11vw,150px); color:${withAlpha(t.primary, "59")}; }
  .panel-stack .p2 { position:absolute; right:0; bottom:0; width:56%; border-radius:18px; background:var(--surface); border:1px solid ${t.border}; box-shadow:0 24px 60px ${withAlpha(t.text, "1a")}; padding:20px 22px; }
  .panel-stack .p2 .k { font-size:11px; font-weight:700; letter-spacing:.13em; text-transform:uppercase; color:var(--primary); }
  .panel-stack .p2 p { font-size:13.5px; color:${t.muted}; margin-top:6px; }
  .hero-editorial { padding:${t.space + 20}px 0 ${Math.round(t.space * 0.8)}px; border-bottom:1px solid ${t.border}; }
  .hero-editorial h1 { font-size:clamp(40px,6vw,72px); letter-spacing:-.025em; max-width:900px; margin:20px 0 22px; }
  .hero-editorial h1 em { font-style:italic; color:var(--primary); }
  .hero-editorial .sub { font-size:20px; color:${t.muted}; max-width:600px; margin-bottom:30px; ${t.font.hasDisplayItalic ? `font-family:${t.headingFont}; font-style:italic; font-weight:480;` : ""} }
  .hero-editorial .info-float { margin-top:44px; display:grid; gap:1px; background:${t.border}; border:1px solid ${t.border}; border-radius:18px; overflow:hidden; }
  @media(min-width:760px){ .hero-editorial .info-float { grid-template-columns:1fr 1fr 1fr; } }
  .hero-editorial .info-float > div { background:var(--surface); padding:18px 22px; }
  .hero-editorial .if-k { font-size:11px; font-weight:700; letter-spacing:.13em; text-transform:uppercase; color:var(--primary); }
  .hero-editorial .if-v { font-size:14.5px; margin-top:5px; color:${t.muted}; }

  .sig-list { margin-top:30px; }
  .sig-item { display:grid; grid-template-columns:70px 1fr; gap:22px; padding:30px 0; border-top:1px solid ${t.border}; transition:background-color .2s ease; }
  .sig-item:hover { background:${withAlpha(t.primary, "05")}; }
  .sig-item:last-child { border-bottom:1px solid ${t.border}; }
  .sig-item .num { font-family:${t.headingFont}; font-size:28px; font-style:${t.font.hasDisplayItalic ? "italic" : "normal"}; color:${withAlpha(t.primary, "8c")}; }
  .sig-item h3 { font-size:21px; margin-bottom:6px; }
  .sig-item p { color:${t.muted}; font-size:15px; max-width:660px; }
  .about-band { background:var(--surface); border-block:1px solid ${t.border}; }
  .about-band .cols { display:grid; gap:38px; }
  @media(min-width:880px){ .about-band .cols { grid-template-columns:1.1fr .9fr; } }
  .why-list { list-style:none; margin-top:10px; }
  .why-list li { padding:11px 0 11px 28px; position:relative; color:${t.muted}; border-bottom:1px solid ${t.border}; }
  .why-list li:last-child { border-bottom:0; }
  .why-list li::before { content:"—"; position:absolute; left:0; color:var(--accent); }
  .visit-band { background:${withAlpha(t.primary, "08")}; }
  .visit-cols { display:grid; gap:36px; margin-top:12px; }
  @media(min-width:880px){ .visit-cols { grid-template-columns:.9fr 1.1fr; } }
  .hours-card { background:var(--surface); border:1px solid ${t.border}; border-radius:18px; padding:28px; }
  `;

  const heroA = `
  <header id="top" class="container hero-split">
    <div class="reveal in">
      <p class="kicker">${escapeHtml(business.category)}${business.area ? ` · ${escapeHtml(business.area)}` : ""}</p>
      <h1>${escapeHtml(copy.headline)}</h1>
      <p class="sub">${escapeHtml(copy.subheadline)}</p>
      ${ctaButtons(links, copy, { micro: today ? `Open today · ${today.split(": ")[1] ?? ""}` : undefined })}
    </div>
    <div class="panel-stack" aria-hidden="true">
      <div class="p1"><span>${monogram}</span></div>
      <div class="p2"><p class="k">${escapeHtml(business.area ?? "Dubai")}</p><p>${escapeHtml(brief?.local_seo_angle || copy.seo_meta_description || business.category)}</p></div>
    </div>
  </header>`;

  const heroB = `
  <header id="top" class="hero-editorial">
    <div class="container">
      <p class="kicker">${escapeHtml(business.category)}${business.area ? ` · ${escapeHtml(business.area)}` : ""}</p>
      <h1>${escapeHtml(copy.headline)}</h1>
      <p class="sub">${escapeHtml(copy.subheadline)}</p>
      ${ctaButtons(links, copy)}
      <div class="info-float reveal in">
        <div><p class="if-k">Located</p><p class="if-v">${escapeHtml(business.address ?? business.area ?? "Dubai")}</p></div>
        <div><p class="if-k">Hours</p><p class="if-v">${escapeHtml(today ?? "See opening hours below")}</p></div>
        <div><p class="if-k">Contact</p><p class="if-v">${escapeHtml(links.phoneDisplay ?? "WhatsApp & phone")}</p></div>
      </div>
    </div>
  </header>`;

  const body = `
  <nav class="top-nav" aria-label="Main">
    <div class="inner">
      <a class="name" href="#top">${navLogo ? brandMark(business.name, navLogo, { nameClass: "nav-brand-name" }) : escapeHtml(business.name)}</a>
      <div class="nav-links">
        <a href="#signature">Services</a><a href="#about">About</a><a href="#visit">Visit</a>
      </div>
      ${links.tel || links.wa ? `<a class="btn btn-primary" href="${escapeHtml(links.wa ?? links.tel ?? "#contact")}">${escapeHtml(copy.cta_text || "Book")}</a>` : ""}
    </div>
  </nav>
  ${hv === "a" ? heroA : heroB}
  ${reviewStrip(copy, brief)}
  <main>
    <section class="section" id="signature" aria-labelledby="sig-h">
      <div class="container">
        ${sectionHead(1, "Signature", "What clients come here for", "sig-h", brief?.local_seo_angle || undefined)}
        <div class="sig-list">
          ${signatures.map((s, i) => `<div class="sig-item reveal" style="transition-delay:${i * 70}ms"><span class="num">0${i + 1}</span><div><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.description)}</p></div></div>`).join("")}
        </div>
      </div>
    </section>
    ${renderFeatureSections(copy, business, { skipHighlights: true })}
    <section class="section about-band" id="about" aria-labelledby="about-h">
      <div class="container cols">
        <div class="reveal">
          <p class="kicker">About</p>
          <h2 id="about-h">About ${escapeHtml(business.name)}</h2>
          <p class="muted" style="white-space:pre-line">${escapeHtml(copy.about_section)}</p>
        </div>
        <div class="reveal">
          <h3 style="margin-bottom:6px">Why clients choose us</h3>
          <ul class="why-list">${copy.why_choose_us.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>
        </div>
      </div>
    </section>
    <section class="section" id="reviews" aria-label="Review highlights">
      <div class="container" style="text-align:center">
        <p class="kicker" style="justify-content:center">What clients say</p>
        ${testimonialsBlock(copy, "quotes")}
      </div>
    </section>
    <section class="section visit-band" id="visit" aria-labelledby="visit-h">
      <div class="container">
        <p class="kicker">Visit</p>
        <h2 id="visit-h">Hours &amp; location</h2>
        <div class="visit-cols">
          <div class="hours-card reveal">${hoursList(business)}</div>
          <div class="reveal">${mapBlock(business, links)}</div>
        </div>
      </div>
    </section>
    <section class="section" id="contact" aria-labelledby="contact-h">
      <div class="container" style="max-width:680px; text-align:center">
        <h2 id="contact-h">${escapeHtml(copy.cta_text || "Get in touch")}</h2>
        <p class="muted" style="margin-bottom:26px">${escapeHtml(copy.contact_section)}</p>
        <div style="display:flex; justify-content:center">${ctaButtons(links, copy, { secondaryLabel: links.phoneDisplay ?? "Call us", micro: "Replies usually come fastest on WhatsApp." })}</div>
      </div>
    </section>
  </main>`;
  return { css, body };
}

// ---------------------------------------------------------------------------
// Variant 2 — Bold local service (local-practical)
// ---------------------------------------------------------------------------

function renderLocalPractical(ctx: RenderContext, t: Tokens, links: Links): { css: string; body: string } {
  const { business, copy, brief } = ctx;
  const hv = ctx.heroVariant ?? "a";
  const jobs = mergedHighlights(copy, 3, 4);

  const css = `
  .phone-strip { background:var(--secondary); color:#fff; }
  .phone-strip .inner { max-width:1140px; margin:0 auto; padding:11px 24px; display:flex; justify-content:space-between; align-items:center; gap:12px; font-size:14px; }
  .phone-strip a { color:#fff; font-weight:700; text-decoration:none; }
  .phone-strip a:hover { text-decoration:underline; }
  .hero-dark { background:var(--secondary); color:#fff; position:relative; overflow:hidden; padding:${t.space}px 0 ${t.space + 26}px; clip-path:polygon(0 0, 100% 0, 100% calc(100% - 42px), 0 100%); }
  .hero-dark::after { content:""; position:absolute; right:-140px; top:-70px; width:420px; height:420px; border-radius:999px; background:${withAlpha(t.primary, "38")}; filter:blur(8px); }
  .hero-dark .grid { display:grid; gap:38px; align-items:start; position:relative; z-index:1; }
  @media(min-width:880px){ .hero-dark .grid { grid-template-columns:1.25fr .75fr; } }
  .hero-dark h1 { color:#fff; font-size:clamp(32px,4.6vw,52px); letter-spacing:-.02em; margin:14px 0 14px; }
  .hero-dark .sub { font-size:17px; color:${withAlpha("#ffffff", "b8")}; margin-bottom:22px; max-width:540px; }
  .hero-dark .kicker { color:var(--accent); }
  .hero-dark .kicker::after { background:${withAlpha("#ffffff", "40")}; }
  .hero-dark .micro { color:${withAlpha("#ffffff", "8c")}; }
  .badge-row { display:flex; flex-wrap:wrap; gap:10px; margin-bottom:26px; }
  .badge { background:${withAlpha("#ffffff", "14")}; border:1px solid ${withAlpha("#ffffff", "26")}; color:#fff; border-radius:8px; padding:7px 14px; font-size:13px; font-weight:600; }
  .hero-light { padding:${t.space}px 0; }
  .hero-light .grid { display:grid; gap:38px; align-items:start; }
  @media(min-width:880px){ .hero-light .grid { grid-template-columns:1.25fr .75fr; } }
  .hero-light h1 { font-size:clamp(32px,4.6vw,50px); letter-spacing:-.02em; margin:14px 0 14px; }
  .hero-light .sub { font-size:17px; color:${t.muted}; margin-bottom:22px; }
  .job-ticks { list-style:none; margin:0 0 28px; }
  .job-ticks li { padding:9px 0 9px 34px; position:relative; font-weight:600; font-size:15.5px; }
  .hero-dark .job-ticks li { color:#fff; }
  .job-ticks li::before { content:"✓"; position:absolute; left:0; top:9px; width:23px; height:23px; border-radius:7px; background:var(--accent); color:var(--secondary); font-size:13px; font-weight:800; display:flex; align-items:center; justify-content:center; }
  .hours-aside { background:var(--surface); border:1px solid ${t.border}; border-radius:16px; padding:26px; box-shadow:0 20px 48px ${withAlpha(t.text, "1c")}; color:var(--text); }
  .hours-aside h3 { margin-bottom:8px; font-size:18px; }
  .hours-aside .today { background:${withAlpha(t.primary, "12")}; border-radius:10px; padding:10px 14px; font-size:13.5px; font-weight:600; color:var(--primary); margin-bottom:12px; }
  .svc-rows { margin-top:26px; display:grid; gap:14px; }
  .svc-row { background:var(--surface); border:1px solid ${t.border}; border-left:5px solid var(--primary); border-radius:12px; padding:20px 24px 20px 20px; display:grid; grid-template-columns:52px 1fr; gap:16px; align-items:start; transition:transform .18s ease, box-shadow .18s ease; }
  .svc-row .svc-i { font-family:${t.headingFont}; font-weight:${t.headingWeight}; font-size:22px; color:${withAlpha(t.primary, "73")}; padding-top:2px; }
  .svc-row:hover { transform:translateX(4px); box-shadow:0 10px 26px ${withAlpha(t.text, "12")}; }
  .svc-row h3 { font-size:17.5px; margin-bottom:4px; }
  .svc-row p { font-size:14.5px; color:${t.muted}; }
  .quote-banner { background:var(--secondary); color:#fff; }
  .quote-banner h2, .quote-banner h3 { color:#fff; }
  .quote-banner .muted { color:${withAlpha("#ffffff", "b3")}; }
  .quote-banner .micro { color:${withAlpha("#ffffff", "8c")}; }
  .quote-cols { display:grid; gap:36px; margin-top:10px; }
  @media(min-width:880px){ .quote-cols { grid-template-columns:1fr 1fr; } }
  .quote-banner .demo-form { background:${withAlpha("#ffffff", "0f")}; border-color:${withAlpha("#ffffff", "21")}; box-shadow:none; }
  .quote-banner .demo-form h3 { color:#fff; }
  .quote-banner .demo-form label { color:${withAlpha("#ffffff", "cc")}; }
  .quote-banner .demo-form input, .quote-banner .demo-form textarea { background:${withAlpha("#ffffff", "14")}; border-color:${withAlpha("#ffffff", "30")}; color:#fff; }
  .quote-banner .demo-form button { background:${withAlpha("#ffffff", "24")}; color:${withAlpha("#ffffff", "8c")}; }
  `;

  const hoursAside = `
  <aside class="hours-aside reveal in">
    <h3>Opening hours</h3>
    ${todayLine(business) ? `<p class="today">Today · ${escapeHtml(todayLine(business)!.split(": ")[1] ?? "")}</p>` : ""}
    ${hoursList(business)}
  </aside>`;

  const heroInner = `
    <div>
      <p class="kicker">${escapeHtml(business.category)}${business.area ? ` in ${escapeHtml(business.area)}` : ""}</p>
      <h1>${escapeHtml(copy.headline)}</h1>
      <p class="sub">${escapeHtml(copy.subheadline)}</p>
      <div class="badge-row">${copy.services.slice(0, 4).map((s) => `<span class="badge">${escapeHtml(s.title)}</span>`).join("")}</div>
      <ul class="job-ticks">${jobs.map((j) => `<li>${escapeHtml(j.title)}</li>`).join("")}</ul>
      ${ctaButtons(links, copy, { secondaryLabel: "Call us", micro: "Send a photo of the problem on WhatsApp for a faster answer." })}
    </div>
    ${hoursAside}`;

  const heroA = `<header class="hero-dark"><div class="container grid">${heroInner}</div></header>`;
  const heroB = `<header class="hero-light"><div class="container grid">${heroInner}</div></header>`;

  const body = `
  ${links.tel ? `<div class="phone-strip"><div class="inner"><span>${escapeHtml(business.area ? `${business.category} · ${business.area}` : business.category)}</span><a href="${escapeHtml(links.tel)}" aria-label="Call now">${escapeHtml(links.phoneDisplay ?? "Call now")}</a></div></div>` : ""}
  ${hv === "a" ? heroA : heroB}
  ${reviewStrip(copy, brief)}
  <main>
    <section class="section" id="services" aria-labelledby="svc-h">
      <div class="container">
        ${sectionHead(1, "Services", "What we do", "svc-h")}
        <div class="svc-rows">
          ${copy.services.map((s, i) => `<div class="svc-row reveal" style="transition-delay:${i * 60}ms"><span class="svc-i" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><div><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.description)}</p></div></div>`).join("")}
        </div>
      </div>
    </section>
    ${renderFeatureSections(copy, business)}
    <section class="section" id="why" aria-labelledby="why-h" style="padding-top:0">
      <div class="container">
        <p class="kicker">Track record</p>
        <h2 id="why-h">Why customers come back</h2>
        ${testimonialsBlock(copy, "cards")}
      </div>
    </section>
    ${faqBlock(copy)}
    <section class="section quote-banner" id="contact" aria-labelledby="q-h">
      <div class="container quote-cols">
        <div>
          <h2 id="q-h">${escapeHtml(copy.cta_text || "Get a quote")}</h2>
          <p class="muted" style="margin-bottom:24px">${escapeHtml(copy.contact_section)}</p>
          ${ctaButtons(links, copy, { secondaryLabel: links.phoneDisplay ?? "Call us" })}
        </div>
        ${demoForm(copy, "Request a quote")}
      </div>
    </section>
    <section class="section" id="location" aria-labelledby="loc-h">
      <div class="container">
        <p class="kicker">Find us</p>
        <h2 id="loc-h">Location</h2>
        ${mapBlock(business, links)}
      </div>
    </section>
  </main>`;
  return { css, body };
}

// ---------------------------------------------------------------------------
// Variant 3 — Warm hospitality
// ---------------------------------------------------------------------------

function renderHospitality(ctx: RenderContext, t: Tokens, links: Links): { css: string; body: string } {
  const { business, copy, brief } = ctx;
  const hv = ctx.heroVariant ?? "a";
  const menu = mergedHighlights(copy, 4, 6);
  const today = todayLine(business);

  const css = `
  .hero-hosp { text-align:center; padding:${t.space + 28}px 0 ${Math.round(t.space * 1.1)}px; background:radial-gradient(90% 100% at 50% 0%, ${withAlpha(t.primary, "1c")} 0%, var(--bg) 78%); position:relative; }
  .hero-hosp h1 { font-size:clamp(36px,5.4vw,62px); margin:20px auto 16px; max-width:800px; letter-spacing:-.015em; }
  .hero-hosp .sub { font-size:19px; color:${t.muted}; max-width:560px; margin:0 auto 28px; ${t.font.hasDisplayItalic ? `font-family:${t.headingFont}; font-style:italic;` : ""} }
  .hero-hosp .btn-row, .hero-hosp .cta-wrap .btn-row { justify-content:center; }
  .hero-hosp .micro { text-align:center; }
  .orn { color:var(--accent); font-size:18px; letter-spacing:.7em; margin-top:20px; }
  .float-open { display:inline-flex; align-items:center; gap:10px; margin-top:30px; background:var(--surface); border:1px solid ${t.border}; box-shadow:0 14px 36px ${withAlpha(t.text, "14")}; border-radius:999px; padding:11px 22px; font-size:14px; font-weight:600; }
  .float-open .dot { width:9px; height:9px; border-radius:999px; background:#16a34a; }
  .hero-board { padding:${t.space}px 0; }
  .hero-board .grid { display:grid; gap:40px; align-items:center; }
  @media(min-width:900px){ .hero-board .grid { grid-template-columns:1.05fr .95fr; } }
  .hero-board h1 { font-size:clamp(34px,4.8vw,54px); letter-spacing:-.015em; margin:18px 0 16px; }
  .hero-board .sub { font-size:19px; color:${t.muted}; margin-bottom:28px; max-width:520px; ${t.font.hasDisplayItalic ? `font-family:${t.headingFont}; font-style:italic;` : ""} }
  .menu-board { background:var(--surface); border:1px solid ${t.border}; border-radius:20px; box-shadow:0 24px 56px ${withAlpha(t.text, "14")}; padding:32px; transform:rotate(.6deg); }
  .menu-board .mb-k { text-align:center; font-size:11px; font-weight:700; letter-spacing:.22em; text-transform:uppercase; color:var(--primary); }
  .menu-board .mb-orn { text-align:center; color:var(--accent); letter-spacing:.5em; font-size:13px; margin:6px 0 14px; }
  .menu-board .mb-item { display:flex; align-items:baseline; gap:10px; padding:9px 0; }
  .menu-board .mb-item b { font-family:${t.headingFont}; font-size:16.5px; white-space:nowrap; }
  .menu-board .mb-item .leader { flex:1; border-bottom:2px dotted ${withAlpha(t.text, "40")}; transform:translateY(-3px); }
  .menu-band { background:var(--surface); border-block:1px solid ${t.border}; }
  .visit-grid { display:grid; gap:32px; margin-top:16px; }
  @media(min-width:880px){ .visit-grid { grid-template-columns:.9fr 1.1fr; } }
  .visit-card { background:var(--surface); border:1px solid ${t.border}; border-radius:18px; padding:28px; }
  .about-hosp { text-align:center; }
  .about-hosp .about-line { font-family:${t.headingFont}; font-size:clamp(20px,2.6vw,27px); line-height:1.5; max-width:760px; margin:16px auto 0; }
  .cta-hosp { text-align:center; background:linear-gradient(160deg, ${withAlpha(t.primary, "17")}, ${withAlpha(t.accent, "0f")}); border-top:1px solid ${t.border}; }
  .cta-hosp .btn-row { justify-content:center; }
  .cta-hosp .micro { text-align:center; }
  `;

  const heroA = `
  <header class="hero-hosp">
    <div class="container">
      <p class="kicker" style="justify-content:center">${escapeHtml(business.category)}${business.area ? ` · ${escapeHtml(business.area)}` : ""}</p>
      <h1>${escapeHtml(copy.headline)}</h1>
      <p class="sub">${escapeHtml(copy.subheadline)}</p>
      ${ctaButtons(links, copy, { secondaryLabel: "Call us" })}
      <p class="orn" aria-hidden="true">✦ ✦ ✦</p>
      ${today ? `<div class="float-open reveal in"><span class="dot" aria-hidden="true"></span>${escapeHtml(today)}</div>` : ""}
    </div>
  </header>`;

  const heroB = `
  <header class="hero-board">
    <div class="container grid">
      <div>
        <p class="kicker">${escapeHtml(business.category)}${business.area ? ` · ${escapeHtml(business.area)}` : ""}</p>
        <h1>${escapeHtml(copy.headline)}</h1>
        <p class="sub">${escapeHtml(copy.subheadline)}</p>
        ${ctaButtons(links, copy, { secondaryLabel: "Call us", micro: today ? `Open today · ${today.split(": ")[1] ?? ""}` : undefined })}
      </div>
      <div class="menu-board reveal in" aria-label="Menu preview">
        <p class="mb-k">${escapeHtml(business.name)}</p>
        <p class="mb-orn" aria-hidden="true">✦ ✦ ✦</p>
        ${menu.slice(0, 5).map((m) => `<div class="mb-item"><b>${escapeHtml(m.title)}</b><span class="leader" aria-hidden="true"></span></div>`).join("")}
      </div>
    </div>
  </header>`;

  const body = `
  ${hv === "a" ? heroA : heroB}
  ${reviewStrip(copy, brief)}
  <main>
    <section class="section menu-band" id="menu" aria-labelledby="menu-h">
      <div class="container">
        ${sectionHead(1, "From the reviews", "What people order again", "menu-h")}
        <div class="hl-list">
          ${menu.map((m, i) => `<div class="hl-row reveal" style="transition-delay:${i * 60}ms"><div class="hl-t"><b>${escapeHtml(m.title)}</b><span class="leader" aria-hidden="true"></span></div><p>${escapeHtml(m.description)}</p></div>`).join("")}
        </div>
      </div>
    </section>
    ${renderFeatureSections(copy, business, { skipHighlights: true })}
    ${motifDivider(t)}
    <section class="section about-hosp" id="about" aria-labelledby="ab-h">
      <div class="container">
        <p class="kicker" style="justify-content:center">Our place</p>
        <h2 id="ab-h">About ${escapeHtml(business.name)}</h2>
        <p class="about-line reveal">${escapeHtml(copy.about_section.split("\n")[0] ?? "")}</p>
        ${copy.about_section.includes("\n") ? `<p class="muted reveal" style="max-width:680px;margin:18px auto 0">${escapeHtml(copy.about_section.split("\n").slice(1).join(" ").trim())}</p>` : ""}
        ${testimonialsBlock(copy, "cards")}
      </div>
    </section>
    <section class="section" id="visit" aria-labelledby="visit-h" style="padding-top:0">
      <div class="container">
        <p class="kicker">Visit us</p>
        <h2 id="visit-h">Find your table</h2>
        <div class="visit-grid">
          <div class="visit-card reveal"><h3 style="margin-bottom:8px">Opening hours</h3>${hoursList(business)}</div>
          <div class="reveal">${mapBlock(business, links)}</div>
        </div>
      </div>
    </section>
    <section class="section cta-hosp" id="contact" aria-labelledby="cta-h">
      <div class="container">
        <h2 id="cta-h">${escapeHtml(copy.cta_text || "Visit us today")}</h2>
        <p class="muted" style="max-width:560px; margin:0 auto 26px">${escapeHtml(copy.contact_section)}</p>
        ${ctaButtons(links, copy, { secondaryLabel: links.phoneDisplay ?? "Call us", micro: "Walk-ins welcome — message ahead for groups." })}
      </div>
    </section>
  </main>`;
  return { css, body };
}

// ---------------------------------------------------------------------------
// Variant 4 — Calm clinical (wellness-clinic)
// ---------------------------------------------------------------------------

function renderWellnessClinic(ctx: RenderContext, t: Tokens, links: Links): { css: string; body: string } {
  const { business, copy, brief } = ctx;
  const hv = ctx.heroVariant ?? "a";
  const treatments = mergedHighlights(copy, 4, 6);
  const trust = (brief?.trust_signals?.length ? brief.trust_signals : copy.why_choose_us).slice(0, 4);

  const css = `
  .hero-well { padding:${t.space}px 0; background:linear-gradient(175deg, ${withAlpha(t.primary, "0c")} 0%, var(--bg) 55%); }
  .hero-well .grid { display:grid; gap:40px; align-items:start; }
  @media(min-width:920px){ .hero-well .grid { grid-template-columns:1.1fr .9fr; } }
  .hero-well h1 { font-size:clamp(32px,4.4vw,48px); margin:16px 0 16px; letter-spacing:-.018em; }
  .hero-well .sub { font-size:17px; color:${t.muted}; max-width:520px; margin-bottom:26px; }
  .hero-calm { text-align:center; padding:${t.space + 16}px 0 ${Math.round(t.space * 0.7)}px; background:linear-gradient(175deg, ${withAlpha(t.primary, "0e")} 0%, var(--bg) 60%); }
  .hero-calm h1 { font-size:clamp(32px,4.6vw,50px); margin:16px auto; max-width:760px; letter-spacing:-.018em; }
  .hero-calm .sub { font-size:17px; color:${t.muted}; max-width:560px; margin:0 auto 26px; }
  .hero-calm .btn-row { justify-content:center; }
  .hero-calm .micro { text-align:center; }
  .trust-strip { display:grid; gap:14px; margin-top:36px; }
  @media(min-width:760px){ .trust-strip { grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); } }
  .trust-item { background:var(--surface); border:1px solid ${t.border}; border-radius:14px; padding:15px 18px; font-size:14px; font-weight:600; display:flex; gap:11px; align-items:flex-start; transition:border-color .15s ease; }
  .trust-item:hover { border-color:${withAlpha(t.primary, "59")}; }
  .trust-item::before { content:"✓"; color:var(--primary); font-weight:800; }
  .treat-grid { display:grid; gap:22px; margin-top:28px; }
  @media(min-width:760px){ .treat-grid { grid-template-columns:1fr 1fr; } }
  .treat-card { background:var(--surface); border:1px solid ${t.border}; border-radius:18px; padding:28px; transition:transform .18s ease, box-shadow .18s ease; position:relative; overflow:hidden; }
  .treat-card::before { content:""; position:absolute; left:0; top:0; bottom:0; width:4px; background:linear-gradient(var(--primary), var(--accent)); opacity:.7; }
  .treat-card:hover { transform:translateY(-3px); box-shadow:0 16px 36px ${withAlpha(t.text, "10")}; }
  .treat-card h3 { font-size:18.5px; margin-bottom:6px; }
  .treat-card p { font-size:14.5px; color:${t.muted}; }
  .calm-band { background:${withAlpha(t.primary, "08")}; border-block:1px solid ${t.border}; }
  .split { display:grid; gap:34px; margin-top:14px; }
  @media(min-width:880px){ .split { grid-template-columns:1fr 1fr; } }
  `;

  const heroA = `
  <header class="hero-well">
    <div class="container grid">
      <div>
        <p class="kicker">${escapeHtml(business.category)}${business.area ? ` · ${escapeHtml(business.area)}` : ""}</p>
        <h1>${escapeHtml(copy.headline)}</h1>
        <p class="sub">${escapeHtml(copy.subheadline)}</p>
        ${ctaButtons(links, copy, { secondaryLabel: "Call the clinic", micro: "No account needed — book by WhatsApp or phone." })}
        <div class="trust-strip">${trust.map((s, i) => `<div class="trust-item reveal in" style="transition-delay:${i * 70}ms">${escapeHtml(s)}</div>`).join("")}</div>
      </div>
      <div class="reveal in">${demoForm(copy, copy.cta_text || "Request an appointment")}</div>
    </div>
  </header>`;

  const heroB = `
  <header class="hero-calm">
    <div class="container">
      <p class="kicker" style="justify-content:center">${escapeHtml(business.category)}${business.area ? ` · ${escapeHtml(business.area)}` : ""}</p>
      <h1>${escapeHtml(copy.headline)}</h1>
      <p class="sub">${escapeHtml(copy.subheadline)}</p>
      ${ctaButtons(links, copy, { secondaryLabel: "Call the clinic", micro: "No account needed — book by WhatsApp or phone." })}
      <div class="trust-strip" style="max-width:920px;margin-inline:auto">${trust.map((s, i) => `<div class="trust-item reveal in" style="transition-delay:${i * 70}ms">${escapeHtml(s)}</div>`).join("")}</div>
    </div>
  </header>`;

  const body = `
  ${hv === "a" ? heroA : heroB}
  ${reviewStrip(copy, brief)}
  <main>
    <section class="section calm-band" id="treatments" aria-labelledby="tr-h">
      <div class="container">
        ${sectionHead(1, "Care", "Treatments & services", "tr-h")}
        <div class="treat-grid">
          ${treatments.map((s, i) => `<div class="treat-card reveal" style="transition-delay:${i * 60}ms"><h3>${escapeHtml(s.title)}</h3><p>${escapeHtml(s.description)}</p></div>`).join("")}
        </div>
      </div>
    </section>
    ${renderFeatureSections(copy, business, { skipHighlights: true })}
    <section class="section" id="about" aria-labelledby="ab-h">
      <div class="container split">
        <div class="reveal">
          <p class="kicker">About</p>
          <h2 id="ab-h">About ${escapeHtml(business.name)}</h2>
          <p class="muted" style="white-space:pre-line">${escapeHtml(copy.about_section)}</p>
        </div>
        <div class="reveal">
          <h3 style="margin-bottom:8px">What patients &amp; visitors say</h3>
          ${testimonialsBlock(copy, "cards")}
        </div>
      </div>
    </section>
    ${faqBlock(copy)}
    <section class="section calm-band" id="visit" aria-labelledby="visit-h">
      <div class="container split">
        <div class="reveal"><h2 id="visit-h">Hours</h2>${hoursList(business)}</div>
        <div class="reveal"><h2>Location</h2>${mapBlock(business, links)}</div>
      </div>
    </section>
    <section class="section" id="contact" aria-labelledby="c-h">
      <div class="container" style="max-width:640px; text-align:center">
        <h2 id="c-h">${escapeHtml(copy.cta_text || "Book a visit")}</h2>
        <p class="muted" style="margin-bottom:24px">${escapeHtml(copy.contact_section)}</p>
        <div style="display:flex; justify-content:center">${ctaButtons(links, copy, { secondaryLabel: links.phoneDisplay ?? "Call us" })}</div>
      </div>
    </section>
  </main>`;
  return { css, body };
}

// ---------------------------------------------------------------------------
// Variant 5 — Portfolio showcase (creative-portfolio)
// ---------------------------------------------------------------------------

function renderCreativePortfolio(ctx: RenderContext, t: Tokens, links: Links): { css: string; body: string } {
  const { business, copy, brief } = ctx;
  const hv = ctx.heroVariant ?? "a";
  const projects = mergedHighlights(copy, 3, 4);

  const css = `
  .hero-crea { padding:${t.space + 28}px 0 ${t.space}px; }
  .hero-crea h1 { font-size:clamp(42px,7.4vw,84px); line-height:1; letter-spacing:-.03em; max-width:960px; margin:20px 0 24px; }
  .hero-crea .rule { width:72px; height:6px; background:var(--accent); }
  .hero-crea .sub { font-size:18px; color:${t.muted}; max-width:560px; margin-bottom:30px; }
  .hero-mosaic { padding:${t.space}px 0; }
  .hero-mosaic .grid { display:grid; gap:40px; align-items:center; }
  @media(min-width:920px){ .hero-mosaic .grid { grid-template-columns:1.05fr .95fr; } }
  .hero-mosaic h1 { font-size:clamp(36px,5.4vw,62px); line-height:1.03; letter-spacing:-.025em; margin:18px 0 20px; }
  .mosaic { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  .mosaic div { border-radius:14px; aspect-ratio:1; display:flex; align-items:flex-end; padding:14px; }
  .mosaic span { font-size:11.5px; font-weight:700; letter-spacing:.1em; color:#fff; text-transform:uppercase; text-shadow:0 1px 4px rgba(0,0,0,.35); }
  .mosaic div:nth-child(2) { transform:translateY(18px); }
  .mosaic div:nth-child(3) { transform:translateY(-8px); }
  .work-row { display:grid; gap:30px; align-items:center; padding:${Math.round(t.space * 0.62)}px 0; border-top:1px solid ${t.border}; }
  @media(min-width:880px){ .work-row { grid-template-columns:1fr 1fr; } .work-row:nth-child(even) > .panel { order:2; } }
  .work-row .panel { aspect-ratio:16/10; border-radius:16px; display:flex; align-items:flex-end; padding:20px; transition:transform .25s ease; }
  .work-row .panel:hover { transform:scale(1.015); }
  .work-row .panel span { font-size:13px; font-weight:700; letter-spacing:.1em; color:#fff; text-transform:uppercase; text-shadow:0 1px 4px rgba(0,0,0,.35); }
  .work-row .num { font-size:13px; font-weight:700; color:${t.muted}; letter-spacing:.16em; }
  .work-row h3 { font-size:clamp(23px,2.7vw,32px); margin:8px 0; letter-spacing:-.015em; }
  .work-row p { color:${t.muted}; max-width:480px; }
  .chip-row { display:flex; flex-wrap:wrap; gap:10px; margin-top:22px; }
  .chip-dark { border:1.5px solid var(--text); border-radius:999px; padding:8px 18px; font-size:13.5px; font-weight:600; transition:background-color .15s ease, color .15s ease; }
  .chip-dark:hover { background:var(--text); color:var(--bg); }
  .big-cta { background:var(--text); color:var(--bg); }
  .big-cta h2 { color:var(--bg); font-size:clamp(34px,5.4vw,60px); letter-spacing:-.025em; }
  .big-cta .muted { color:${withAlpha("#ffffff", "99")}; }
  .big-cta .micro { color:${withAlpha("#ffffff", "73")}; }
  .big-cta .btn-primary { background:var(--accent); }
  .big-cta .btn-outline { border-color:var(--bg); color:var(--bg); }
  `;

  const panelColors = [
    `linear-gradient(135deg, ${withAlpha(t.primary, "e6")}, ${withAlpha(t.secondary, "cc")})`,
    `linear-gradient(135deg, ${withAlpha(t.accent, "d9")}, ${withAlpha(t.primary, "b3")})`,
    `linear-gradient(135deg, ${withAlpha(t.secondary, "e6")}, ${withAlpha(t.accent, "99")})`,
    `linear-gradient(135deg, ${withAlpha(t.primary, "cc")}, ${withAlpha(t.accent, "cc")})`,
  ];

  const heroA = `
  <header class="container hero-crea">
    <p class="kicker">${escapeHtml(business.name)} — ${escapeHtml(business.category)}${business.area ? `, ${escapeHtml(business.area)}` : ""}</p>
    <h1>${escapeHtml(copy.headline)}</h1>
    <div class="rule" aria-hidden="true"></div>
    <p class="sub" style="margin-top:24px">${escapeHtml(copy.subheadline)}</p>
    ${ctaButtons(links, copy)}
    <div class="chip-row">${copy.services.slice(0, 6).map((s) => `<span class="chip-dark">${escapeHtml(s.title)}</span>`).join("")}</div>
  </header>`;

  const heroB = `
  <header class="hero-mosaic">
    <div class="container grid">
      <div>
        <p class="kicker">${escapeHtml(business.name)} — ${escapeHtml(business.category)}${business.area ? `, ${escapeHtml(business.area)}` : ""}</p>
        <h1>${escapeHtml(copy.headline)}</h1>
        <p class="sub">${escapeHtml(copy.subheadline)}</p>
        ${ctaButtons(links, copy)}
      </div>
      <div class="mosaic" aria-hidden="true">
        ${projects.slice(0, 4).map((p, i) => `<div style="background:${panelColors[i % panelColors.length]}"><span>${escapeHtml(p.title)}</span></div>`).join("")}
      </div>
    </div>
  </header>`;

  const body = `
  ${hv === "a" ? heroA : heroB}
  ${reviewStrip(copy, brief)}
  <main>
    <section class="section" id="work" aria-labelledby="work-h" style="padding-top:${Math.round(t.space * 0.6)}px">
      <div class="container">
        ${sectionHead(1, "What we make", "Selected work & specialties", "work-h")}
        ${projects.map((p, i) => `<div class="work-row"><div class="panel reveal" style="background:${panelColors[i % panelColors.length]}" role="img" aria-label="Placeholder panel for ${escapeHtml(p.title)}"><span>${escapeHtml(p.title)}</span></div><div class="reveal"><p class="num">0${i + 1}</p><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.description)}</p></div></div>`).join("")}
      </div>
    </section>
    ${renderFeatureSections(copy, business, { skipHighlights: true })}
    <section class="section" id="about" aria-labelledby="ab-h" style="border-top:1px solid ${t.border}">
      <div class="container" style="max-width:780px">
        <p class="kicker">Studio</p>
        <h2 id="ab-h">About ${escapeHtml(business.name)}</h2>
        <p class="muted" style="white-space:pre-line">${escapeHtml(copy.about_section)}</p>
        ${testimonialsBlock(copy, "quotes")}
      </div>
    </section>
    <section class="section big-cta" id="contact" aria-labelledby="cta-h">
      <div class="container">
        <h2 id="cta-h">${escapeHtml(copy.cta_text || "Start a project")}</h2>
        <p class="muted" style="max-width:560px; margin:16px 0 28px">${escapeHtml(copy.contact_section)}</p>
        ${ctaButtons(links, copy, { secondaryLabel: links.phoneDisplay ?? "Call us", micro: "Share reference photos on WhatsApp to start the conversation." })}
      </div>
    </section>
    <section class="section" id="visit" aria-labelledby="visit-h">
      <div class="container">
        <p class="kicker">Studio location</p>
        <h2 id="visit-h">Find the studio</h2>
        ${mapBlock(business, links)}
        <div style="margin-top:22px; max-width:520px">${hoursList(business)}</div>
      </div>
    </section>
  </main>`;
  return { css, body };
}

// ---------------------------------------------------------------------------
// Variant 6 — Premium professional (law, real estate, consulting)
// ---------------------------------------------------------------------------

function renderPremiumProfessional(ctx: RenderContext, t: Tokens, links: Links): { css: string; body: string } {
  const navLogo = usableLogoAsset(ctx.brand);
  const { business, copy, brief } = ctx;
  const hv = ctx.heroVariant ?? "a";
  const areas = mergedHighlights(copy, 3, 5);

  const css = `
  body::after { content:""; position:fixed; inset:10px; border:1px solid ${withAlpha(t.secondary, "30")}; pointer-events:none; z-index:65; }
  @media(max-width:759px){ body::after { display:none; } }
  .pro-nav { background:var(--secondary); }
  .pro-nav .inner { max-width:1140px; margin:0 auto; padding:16px 24px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
  .pro-nav .name { color:#fff; font-family:${t.headingFont}; font-weight:700; font-size:18px; text-decoration:none; letter-spacing:.02em; }
  .pro-nav .btn { padding:10px 22px; font-size:14px; background:var(--accent); color:var(--secondary); box-shadow:none; border-radius:${t.radius}; }
  .hero-pro { background:var(--secondary); color:#fff; padding:${t.space + 8}px 0 ${t.space + 16}px; }
  .hero-pro .grid { display:grid; gap:46px; align-items:center; }
  @media(min-width:920px){ .hero-pro .grid { grid-template-columns:1.15fr .85fr; } }
  .hero-pro h1 { color:#fff; font-size:clamp(34px,4.8vw,56px); letter-spacing:-.02em; margin:18px 0 18px; }
  .hero-pro .sub { font-size:17.5px; color:${withAlpha("#ffffff", "b3")}; max-width:560px; margin-bottom:28px; }
  .hero-pro .kicker { color:var(--accent); }
  .hero-pro .kicker::after { background:${withAlpha("#ffffff", "38")}; }
  .hero-pro .micro { color:${withAlpha("#ffffff", "80")}; }
  .hero-pro .btn-primary { background:var(--accent); color:var(--secondary); box-shadow:0 8px 22px rgba(0,0,0,.3); }
  .hero-pro .btn-outline { border-color:${withAlpha("#ffffff", "59")}; color:#fff; }
  .index-list { border-left:1px solid ${withAlpha("#ffffff", "26")}; padding-left:28px; display:grid; gap:0; }
  .index-list a { display:flex; gap:16px; align-items:baseline; padding:13px 0; color:#fff; text-decoration:none; border-bottom:1px solid ${withAlpha("#ffffff", "14")}; transition:padding-left .18s ease; }
  .index-list a:hover { padding-left:8px; }
  .index-list a:last-child { border-bottom:0; }
  .index-list .n { font-size:12.5px; color:var(--accent); font-weight:700; letter-spacing:.1em; }
  .index-list .t { font-family:${t.headingFont}; font-size:17px; }
  .hero-pro-light { padding:${t.space}px 0; border-bottom:4px solid var(--secondary); }
  .hero-pro-light .grid { display:grid; gap:44px; align-items:center; }
  @media(min-width:920px){ .hero-pro-light .grid { grid-template-columns:1.15fr .85fr; } }
  .hero-pro-light h1 { font-size:clamp(34px,4.8vw,56px); letter-spacing:-.02em; margin:18px 0 18px; }
  .hero-pro-light .sub { font-size:17.5px; color:${t.muted}; max-width:560px; margin-bottom:28px; }
  .side-panel { background:var(--secondary); color:#fff; border-radius:18px; padding:32px; }
  .side-panel .k { color:var(--accent); font-size:11px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; }
  .side-panel .row { padding:12px 0; border-bottom:1px solid ${withAlpha("#ffffff", "1a")}; font-size:14.5px; }
  .side-panel .row:last-child { border-bottom:0; }
  .practice-rows { margin-top:28px; display:grid; gap:0; border-top:1px solid ${t.border}; }
  .practice-row { display:grid; grid-template-columns:64px 1fr; gap:22px; padding:26px 0; border-bottom:1px solid ${t.border}; transition:background-color .18s ease; }
  .practice-row:hover { background:${withAlpha(t.primary, "06")}; }
  .practice-row .num { font-size:13px; font-weight:700; color:var(--accent); letter-spacing:.12em; padding-top:5px; }
  .practice-row h3 { font-size:20px; margin-bottom:5px; }
  .practice-row p { color:${t.muted}; font-size:14.5px; max-width:640px; }
  .consult-band { background:var(--secondary); color:#fff; }
  .consult-band h2 { color:#fff; }
  .consult-band .muted { color:${withAlpha("#ffffff", "a6")}; }
  .consult-band .micro { color:${withAlpha("#ffffff", "80")}; }
  .consult-band .btn-primary { background:var(--accent); color:var(--secondary); }
  .consult-band .btn-outline { border-color:${withAlpha("#ffffff", "59")}; color:#fff; }
  .consult-cols { display:grid; gap:36px; margin-top:10px; }
  @media(min-width:880px){ .consult-cols { grid-template-columns:1fr 1fr; } }
  .consult-band .demo-form { background:${withAlpha("#ffffff", "0d")}; border-color:${withAlpha("#ffffff", "21")}; box-shadow:none; }
  .consult-band .demo-form h3 { color:#fff; }
  .consult-band .demo-form label { color:${withAlpha("#ffffff", "cc")}; }
  .consult-band .demo-form input, .consult-band .demo-form textarea { background:${withAlpha("#ffffff", "12")}; border-color:${withAlpha("#ffffff", "30")}; color:#fff; }
  .consult-band .demo-form button { background:${withAlpha("#ffffff", "24")}; color:${withAlpha("#ffffff", "8c")}; }
  `;

  const heroA = `
  <header class="hero-pro">
    <div class="container grid">
      <div>
        <p class="kicker">${escapeHtml(business.category)}${business.area ? ` · ${escapeHtml(business.area)}` : ""}</p>
        <h1>${escapeHtml(copy.headline)}</h1>
        <p class="sub">${escapeHtml(copy.subheadline)}</p>
        ${ctaButtons(links, copy, { secondaryLabel: "Call the office", micro: "Enquiries are confidential." })}
      </div>
      <nav class="index-list reveal in" aria-label="Practice areas">
        ${areas.map((a, i) => `<a href="#practice"><span class="n">${ROMAN[i] ?? i + 1}</span><span class="t">${escapeHtml(a.title)}</span></a>`).join("")}
      </nav>
    </div>
  </header>`;

  const heroB = `
  <header class="hero-pro-light">
    <div class="container grid">
      <div>
        <p class="kicker">${escapeHtml(business.category)}${business.area ? ` · ${escapeHtml(business.area)}` : ""}</p>
        <h1>${escapeHtml(copy.headline)}</h1>
        <p class="sub">${escapeHtml(copy.subheadline)}</p>
        ${ctaButtons(links, copy, { secondaryLabel: "Call the office", micro: "Enquiries are confidential." })}
      </div>
      <div class="side-panel reveal in">
        <p class="k">At a glance</p>
        <div class="row">${escapeHtml(business.category)} · ${escapeHtml(business.area ?? "Dubai")}</div>
        ${business.address ? `<div class="row">${escapeHtml(business.address)}</div>` : ""}
        ${todayLine(business) ? `<div class="row">${escapeHtml(todayLine(business)!)}</div>` : ""}
        ${links.phoneDisplay ? `<div class="row">${escapeHtml(links.phoneDisplay)}</div>` : ""}
      </div>
    </div>
  </header>`;

  const body = `
  <nav class="pro-nav" aria-label="Main">
    <div class="inner">
      <a class="name" href="#top">${navLogo ? brandMark(business.name, navLogo, { onDark: true, nameClass: "nav-brand-name" }) : escapeHtml(business.name)}</a>
      ${links.tel || links.wa ? `<a class="btn" href="${escapeHtml(links.wa ?? links.tel ?? "#contact")}">${escapeHtml(copy.cta_text || "Request a consultation")}</a>` : ""}
    </div>
  </nav>
  ${hv === "a" ? heroA : heroB}
  ${reviewStrip(copy, brief)}
  <main id="top">
    <section class="section" id="practice" aria-labelledby="pr-h">
      <div class="container">
        ${sectionHead(1, "Practice", "Areas of work", "pr-h")}
        <div class="practice-rows">
          ${areas.map((a, i) => `<div class="practice-row reveal" style="transition-delay:${i * 60}ms"><span class="num">${ROMAN[i] ?? i + 1}</span><div><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.description)}</p></div></div>`).join("")}
        </div>
      </div>
    </section>
    ${renderFeatureSections(copy, business, { skipHighlights: true })}
    <section class="section" id="about" aria-labelledby="ab-h" style="padding-top:0">
      <div class="container" style="max-width:780px">
        <p class="kicker">The firm</p>
        <h2 id="ab-h">About ${escapeHtml(business.name)}</h2>
        <p class="muted" style="white-space:pre-line">${escapeHtml(copy.about_section)}</p>
        ${testimonialsBlock(copy, "quotes")}
      </div>
    </section>
    ${faqBlock(copy)}
    <section class="section consult-band" id="contact" aria-labelledby="c-h">
      <div class="container consult-cols">
        <div>
          <h2 id="c-h">${escapeHtml(copy.cta_text || "Request a consultation")}</h2>
          <p class="muted" style="margin-bottom:24px">${escapeHtml(copy.contact_section)}</p>
          ${ctaButtons(links, copy, { secondaryLabel: links.phoneDisplay ?? "Call us" })}
        </div>
        ${demoForm(copy, "Request a consultation")}
      </div>
    </section>
    <section class="section" id="visit" aria-labelledby="v-h">
      <div class="container">
        <p class="kicker">Office</p>
        <h2 id="v-h">Location &amp; hours</h2>
        <div class="area-grid">
          <div>${mapBlock(business, links)}</div>
          <div class="area-note">${hoursList(business)}</div>
        </div>
      </div>
    </section>
  </main>`;
  return { css, body };
}

// ---------------------------------------------------------------------------
// Variant 7 — Compact conversion landing (simple-landing)
// ---------------------------------------------------------------------------

function renderSimpleLanding(ctx: RenderContext, t: Tokens, links: Links): { css: string; body: string } {
  const { business, copy } = ctx;
  const initial = escapeHtml(business.name.trim().charAt(0).toUpperCase() || "•");

  const css = `
  .landing { max-width:680px; margin:0 auto; padding:0 22px; }
  .hero-simple { text-align:center; padding:${Math.round(t.space * 0.9)}px 0 ${Math.round(t.space * 0.55)}px; }
  .brand-mark { width:64px; height:64px; border-radius:20px; margin:0 auto 18px; background:linear-gradient(150deg, var(--primary), ${withAlpha(t.accent, "cc")}); color:#fff; display:flex; align-items:center; justify-content:center; font-family:${t.headingFont}; font-size:30px; font-weight:700; box-shadow:0 12px 30px ${withAlpha(t.primary, "40")}; }
  .hero-simple h1 { font-size:clamp(28px,4.4vw,40px); margin:12px 0 12px; letter-spacing:-.015em; }
  .hero-simple .sub { color:${t.muted}; margin-bottom:26px; }
  .big-actions { display:grid; gap:12px; }
  .big-actions a { display:flex; align-items:center; justify-content:center; gap:10px; padding:17px; border-radius:${t.radius}; font-weight:700; font-size:16.5px; text-decoration:none; transition:transform .16s ease, box-shadow .16s ease; }
  .big-actions a:hover { transform:translateY(-2px); }
  .act-call { background:var(--primary); color:#fff; box-shadow:0 8px 22px ${withAlpha(t.primary, "40")}; }
  .act-wa { background:#16a34a; color:#fff; box-shadow:0 8px 22px rgba(22,163,74,.35); }
  .act-map { border:2px solid var(--text); color:var(--text); }
  .landing .section { padding:${Math.round(t.space * 0.55)}px 0; border-top:1px solid ${t.border}; }
  .svc-simple { list-style:none; margin-top:14px; background:var(--surface); border:1px solid ${t.border}; border-radius:16px; overflow:hidden; }
  .svc-simple li { padding:15px 20px 15px 46px; position:relative; border-bottom:1px solid ${t.border}; }
  .svc-simple li:last-child { border-bottom:0; }
  .svc-simple li::before { content:"✓"; position:absolute; left:18px; top:16px; color:var(--primary); font-weight:800; }
  .svc-simple b { display:block; font-size:15.5px; }
  .svc-simple span { font-size:13.5px; color:${t.muted}; }
  `;

  const body = `
  <div class="landing">
    <header class="hero-simple">
      <div class="brand-mark" aria-hidden="true">${initial}</div>
      <p class="kicker" style="justify-content:center">${escapeHtml(business.category)}${business.area ? ` · ${escapeHtml(business.area)}` : ""}</p>
      <h1>${escapeHtml(copy.headline || business.name)}</h1>
      <p class="sub">${escapeHtml(copy.subheadline)}</p>
      <div class="big-actions">
        ${links.tel ? `<a class="act-call" href="${escapeHtml(links.tel)}">Call ${escapeHtml(links.phoneDisplay ?? "us")}</a>` : ""}
        ${links.wa ? `<a class="act-wa" href="${escapeHtml(links.wa)}">${escapeHtml(copy.cta_text || "WhatsApp us")}</a>` : ""}
        ${links.maps ? `<a class="act-map" href="${escapeHtml(links.maps)}" target="_blank" rel="noopener noreferrer">Get directions</a>` : ""}
      </div>
      ${todayLine(business) ? `<p class="micro" style="text-align:center">${escapeHtml(todayLine(business)!)}</p>` : ""}
    </header>
    <main>
      <section class="section" id="about" aria-labelledby="ab-h">
        <p class="kicker">About</p>
        <h2 id="ab-h">About ${escapeHtml(business.name)}</h2>
        <p class="muted" style="white-space:pre-line">${escapeHtml(copy.about_section)}</p>
      </section>
      <section class="section" id="services" aria-labelledby="svc-h">
        <p class="kicker">Services</p>
        <h2 id="svc-h">What we offer</h2>
        <ul class="svc-simple">
          ${copy.services.slice(0, 5).map((s) => `<li><b>${escapeHtml(s.title)}</b><span>${escapeHtml(s.description)}</span></li>`).join("")}
        </ul>
      </section>
      ${copy.testimonials.length ? `<section class="section" id="reviews" aria-labelledby="rev-h"><p class="kicker">Reviews</p><h2 id="rev-h">What customers say</h2>${testimonialsBlock(copy, "cards")}</section>` : ""}
      ${renderFeatureSections(copy, business)}
      <section class="section" id="hours" aria-labelledby="h-h">
        <p class="kicker">Hours</p>
        <h2 id="h-h">Opening hours</h2>
        ${hoursList(business)}
      </section>
      <section class="section" id="visit" aria-labelledby="v-h">
        <p class="kicker">Location</p>
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
  "premium-professional": renderPremiumProfessional,
  "simple-landing": renderSimpleLanding,
};

/** Render the complete draft-website HTML for a business. */
export function renderWebsite(ctx: RenderContext): string {
  const tokens = deriveTokens(ctx.style, ctx.system ?? null, ctx.layout);
  const links = deriveLinks(ctx.business, ctx.copy);
  const { css, body } = RENDERERS[ctx.layout](ctx, tokens, links);

  // Real extracted logo: nav layouts render it inside their own top nav; the
  // others get a slim brand bar above the hero, styled from the page tokens.
  const logo = usableLogoAsset(ctx.brand);
  const brandBar =
    logo && !NAV_LAYOUTS.includes(ctx.layout)
      ? `<div class="brand-bar"><div class="inner">${brandMark(ctx.business.name, logo)}${
          links.wa || links.tel
            ? `<a class="brand-bar-cta" href="${escapeHtml(links.wa ?? links.tel ?? "#contact")}">${escapeHtml(ctx.copy.cta_text || "Contact us")}</a>`
            : ""
        }</div></div>`
      : "";

  // Fonts load with display:swap and degrade to curated system stacks, so the
  // page renders fine offline and gains its real typographic voice online.
  const fontLinks = `<link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="${escapeHtml(tokens.font.importHref)}" />`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(ctx.copy.seo_title || ctx.business.name)}</title>
  <meta name="description" content="${escapeHtml(ctx.copy.seo_meta_description || "")}" />
  <meta name="robots" content="noindex, nofollow" />
  ${fontLinks}
  <style>${baseCss(tokens)}
${css}</style>
</head>
<body>
${draftNote()}
${brandBar}
${body}
${siteFooter(ctx.business, links, ctx.copy, logo)}
${stickyMobileCta(links, ctx.copy)}
${tokens.motion ? REVEAL_SCRIPT : ""}
</body>
</html>`;
}
