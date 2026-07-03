// Generates a complete, runnable Next.js 14 + Tailwind project for a business
// as a Record<filePath, fileContent>. The result is stored JSON-encoded in
// GeneratedWebsite.generatedCode and zipped for download via zip.ts.
//
// The export mirrors the seven in-dashboard preview variants (layouts.ts): the
// layout type picks a structurally different page component, and the visual
// style + design system (6-color palette, curated Google-Fonts pairing,
// corner radius, visual density) are derived into typed style tokens that are
// wired into the exported Tailwind theme and globals.css.
//
// Safety model: every generated source file is a fixed string with NO user
// text interpolated into JSX/TSX literals. All business data and AI copy is
// injected exclusively through the typed SITE object in src/config/site.ts,
// serialized with JSON.stringify, so the components are fully data-driven and
// immune to injection through business names, reviews, or AI output. The
// Google rating / review count is intentionally never included in the export
// (Maps content policy).

import type {
  DesignSystemJson,
  FeatureSection,
  LayoutType,
  VisualStyleJson,
} from "@/lib/types";
import { LAYOUT_TYPE_LABELS } from "@/lib/types";
import type { PreviewInput } from "./preview-html";
import { selectLayout } from "./layout-select";
import { resolveFontPairing, type FontPairing } from "./fonts";
import { normalizePhone, whatsappLink } from "@/lib/utils";

// Compliance notice, composed like a professional proof tag rather than a
// warning strip (mirrors layouts.ts): a slim static ribbon on top plus the
// full disclaimer sentence in the footer bar.
const NOTE_SHORT = "Concept draft";
const NOTE_LONG =
  "Design concept generated from the public Google profile — not the live website";
const DISCLAIMER =
  "This is a website concept draft prepared from publicly available Google Maps profile data. It is not the official website of this business and is not published on its behalf.";

// ---------------------------------------------------------------------------
// Style tokens derived from the per-business VisualStyleJson
// ---------------------------------------------------------------------------

type ButtonRadius = "999px" | "3px" | "10px";
type SectionSpacing = "compact" | "comfortable" | "generous";

interface StyleColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
}

interface StyleTokens {
  colors: StyleColors;
  /** Curated Google-Fonts pairing (family, fallback, weight, tracking). */
  font: FontPairing;
  buttonRadius: ButtonRadius;
  sectionSpacing: SectionSpacing;
}

/** Per-layout color fallbacks — kept in sync with layouts.ts. */
const LAYOUT_COLOR_FALLBACKS: Record<LayoutType, StyleColors> = {
  "premium-service": {
    primary: "#8a6d4b",
    secondary: "#2b2320",
    accent: "#c9a36a",
    background: "#faf7f2",
    surface: "#ffffff",
    text: "#28211c",
  },
  "local-practical": {
    primary: "#b45309",
    secondary: "#1f2937",
    accent: "#f59e0b",
    background: "#f8fafc",
    surface: "#ffffff",
    text: "#111827",
  },
  hospitality: {
    primary: "#9a3412",
    secondary: "#3f2212",
    accent: "#d97706",
    background: "#fdf8f0",
    surface: "#ffffff",
    text: "#2a1c10",
  },
  "wellness-clinic": {
    primary: "#0e7490",
    secondary: "#164e63",
    accent: "#14b8a6",
    background: "#f7fafb",
    surface: "#ffffff",
    text: "#0f2530",
  },
  "creative-portfolio": {
    primary: "#111111",
    secondary: "#4b4b4b",
    accent: "#e11d48",
    background: "#fafafa",
    surface: "#ffffff",
    text: "#111111",
  },
  "premium-professional": {
    primary: "#1e3a5f",
    secondary: "#0f1f33",
    accent: "#b08d57",
    background: "#f7f8fa",
    surface: "#ffffff",
    text: "#16222f",
  },
  "simple-landing": {
    primary: "#1d4ed8",
    secondary: "#1e3a5f",
    accent: "#f59e0b",
    background: "#f8fafc",
    surface: "#ffffff",
    text: "#111827",
  },
};

/** Mirrors the preview's 60/80/100px vertical section rhythm. */
const SECTION_SPACING_REM: Record<SectionSpacing, string> = {
  compact: "3.75rem",
  comfortable: "5rem",
  generous: "6.25rem",
};

/** Full CSS heading stack from the curated pairing (family + fallback). */
function headingStack(font: FontPairing): string {
  return `${font.headingFamily}, ${font.headingFallback}`;
}

/** Full CSS body stack from the curated pairing (family + fallback). */
function bodyStack(font: FontPairing): string {
  return `${font.bodyFamily}, ${font.bodyFallback}`;
}

/** Normalize an AI-provided color to #rrggbb, with a fallback. */
function safeHex(value: string | null | undefined, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const raw = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw
      .split("")
      .map((c) => c + c)
      .join("")}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw) || /^[0-9a-fA-F]{8}$/.test(raw)) {
    return `#${raw.slice(0, 6).toLowerCase()}`;
  }
  return fallback;
}

function deriveStyleTokens(
  style: VisualStyleJson | null | undefined,
  system: DesignSystemJson | null | undefined,
  layout: LayoutType
): StyleTokens {
  const fb = LAYOUT_COLOR_FALLBACKS[layout];
  const palette = style?.color_palette;

  // Curated Google-Fonts pairing — same resolution as the preview renderer.
  const font = resolveFontPairing(
    system?.typography_system.font_pairing,
    layout
  );

  // Same regex knobs as layouts.ts deriveTokens.
  const radiusSource = `${system?.corner_radius_style ?? ""} ${style?.button_style ?? ""}`;
  const buttonRadius: ButtonRadius = /pill/i.test(radiusSource)
    ? "999px"
    : /sharp|square/i.test(radiusSource)
      ? "3px"
      : "10px";

  const density = `${system?.visual_density ?? ""} ${style?.section_spacing ?? ""}`;
  const sectionSpacing: SectionSpacing = /dense|compact/i.test(density)
    ? "compact"
    : /airy|generous/i.test(density)
      ? "generous"
      : "comfortable";

  return {
    colors: {
      primary: safeHex(palette?.primary, fb.primary),
      secondary: safeHex(palette?.secondary, fb.secondary),
      accent: safeHex(palette?.accent, fb.accent),
      background: safeHex(palette?.background, fb.background),
      surface: safeHex(palette?.surface, fb.surface),
      text: safeHex(palette?.text, fb.text),
    },
    font,
    buttonRadius,
    sectionSpacing,
  };
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** npm-safe package name from a business name. */
function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
  return slug || "draft-website";
}

/** Only allow http(s) URLs into generated hrefs. */
function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

/** Single-line, markdown-safe text for README interpolation. */
function safeReadmeText(value: string): string {
  return value.replace(/[`\r\n]+/g, " ").trim();
}

/**
 * Normalize a client domain ("bandungdubai.com", "https://x.ae/") into a
 * canonical https origin. Returns null when the value isn't a plausible
 * hostname — callers should treat that as "no production domain".
 */
function canonicalOrigin(domain: string): string | null {
  const host = domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[/?#].*$/, "");
  const label = "[a-z0-9]([a-z0-9-]*[a-z0-9])?";
  if (!new RegExp(`^${label}(\\.${label})+$`).test(host)) return null;
  return `https://${host}`;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function buildNextJsProject(input: PreviewInput): Record<string, string> {
  const { business, copy } = input;

  // Production hand-off mode: only reachable through the gated final-export
  // route (lead WON + owner approved the content). Drops the draft ribbon and
  // disclaimer, enables indexing, and points the canonical URL at the domain.
  const siteUrl = input.production ? canonicalOrigin(input.production.domain) : null;
  const production = Boolean(input.production && siteUrl);

  const layout: LayoutType =
    input.layout ??
    selectLayout({
      category: business.category,
      briefRecommendation: input.brief?.recommended_layout_type ?? null,
      storedReviewCount: 1, // legacy callers have no stored-review info
      hasPhone: Boolean(business.phone),
      hasHours: business.openingHours.length > 0,
      hasEditorialSummary: true,
    });

  const tokens = deriveStyleTokens(
    input.style ?? null,
    input.system ?? null,
    layout
  );

  const phone = business.phone ? normalizePhone(business.phone) : "";
  const telUrl = phone ? `tel:${phone}` : null;
  const whatsappUrl = business.phone
    ? whatsappLink(business.phone, copy.whatsapp_message || `Hi ${business.name}!`)
    : null;
  const mapQuery = encodeURIComponent(
    [business.name, business.address].filter(Boolean).join(" ")
  );

  const trustSignals = asArray(
    input.brief?.trust_signals?.length
      ? input.brief.trust_signals
      : copy.why_choose_us
  ).slice(0, 6);

  const site: SiteConfigData = {
    layout,
    business: {
      name: business.name,
      category: business.category,
      area: business.area,
      address: business.address,
      phone: business.phone,
      googleMapsUrl: safeHttpUrl(business.googleMapsUrl),
      openingHours: asArray(business.openingHours),
      // NOTE: Google rating/reviewCount deliberately excluded (Maps policy).
    },
    copy: {
      websiteName: copy.website_name || business.name,
      headline: copy.headline || business.name,
      subheadline: copy.subheadline ?? "",
      ctaText: copy.cta_text || "Contact us",
      about: copy.about_section ?? "",
      services: asArray(copy.services),
      highlightItems: asArray(copy.highlight_items),
      faq: asArray(copy.faq),
      whyChooseUs: asArray(copy.why_choose_us),
      trustSignals,
      testimonials: asArray(copy.testimonials),
      contactSection: copy.contact_section ?? "",
      seoTitle: copy.seo_title || business.name,
      seoMetaDescription: copy.seo_meta_description ?? "",
      whatsappMessage: copy.whatsapp_message ?? "",
      bookingFormFields: asArray(copy.booking_form_fields),
      imageRecommendations: asArray(copy.image_recommendations),
      featureSections: asArray(copy.feature_sections).slice(0, 3),
    },
    style: {
      colors: tokens.colors,
      fontPairing: tokens.font.label,
      buttonRadius: tokens.buttonRadius,
      sectionSpacing: tokens.sectionSpacing,
    },
    links: {
      whatsappUrl,
      telUrl,
      mapsUrl: safeHttpUrl(business.googleMapsUrl),
      mapEmbedUrl: `https://www.google.com/maps?q=${mapQuery}&output=embed`,
    },
    // Empty strings in production mode: DraftBanner is omitted from the
    // project and SiteFooter hides the disclaimer bar when it's blank.
    draftNotice: production
      ? { short: "", long: "" }
      : { short: NOTE_SHORT, long: NOTE_LONG },
    disclaimer: production ? "" : DISCLAIMER,
  };

  const layoutModule = LAYOUT_MODULES[layout];

  const files: Record<string, string> = {
    "package.json": buildPackageJson(business.name, production),
    "next.config.mjs": NEXT_CONFIG,
    "tsconfig.json": TSCONFIG,
    "postcss.config.js": POSTCSS_CONFIG,
    "tailwind.config.ts": buildTailwindConfig(tokens),
    "README.md": production
      ? buildProductionReadme(business.name, layout, tokens, input.style ?? null)
      : buildReadme(business.name, layout, tokens, input.style ?? null),
    "src/app/globals.css": buildGlobalsCss(tokens),
    "src/app/layout.tsx": buildLayoutTsx(tokens.font, siteUrl),
    "src/app/page.tsx": buildPageTsx(layoutModule, production),
    "src/config/site.ts": buildSiteConfig(site),
    "src/components/SiteFooter.tsx": SITE_FOOTER_TSX,
    "src/components/Shared.tsx": SHARED_TSX,
    [layoutModule.file]: layoutModule.source,
  };
  if (production && siteUrl) {
    files["DEPLOY.md"] = buildDeployGuide(business.name, siteUrl);
  } else {
    files["src/components/DraftBanner.tsx"] = DRAFT_BANNER_TSX;
  }
  return files;
}

// ---------------------------------------------------------------------------
// Data-driven files (business data injected via JSON.stringify only)
// ---------------------------------------------------------------------------

function buildPackageJson(businessName: string, production: boolean): string {
  const pkg = {
    name: slugify(businessName),
    version: production ? "1.0.0" : "0.1.0",
    private: true,
    description: production
      ? `Website for ${safeReadmeText(businessName)}. Content approved by the business owner.`
      : "Draft website concept generated from public Google Maps data. Not for publication without the business owner's approval.",
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
    },
    dependencies: {
      next: "^14.2.15",
      react: "^18.3.1",
      "react-dom": "^18.3.1",
    },
    devDependencies: {
      "@types/node": "^20.16.11",
      "@types/react": "^18.3.11",
      "@types/react-dom": "^18.3.1",
      autoprefixer: "^10.4.20",
      postcss: "^8.4.47",
      tailwindcss: "^3.4.14",
      typescript: "^5.6.3",
    },
  };
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

function buildTailwindConfig(tokens: StyleTokens): string {
  return `import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: ${JSON.stringify(tokens.colors.primary)},
        secondary: ${JSON.stringify(tokens.colors.secondary)},
        accent: ${JSON.stringify(tokens.colors.accent)},
        background: ${JSON.stringify(tokens.colors.background)},
        surface: ${JSON.stringify(tokens.colors.surface)},
        text: ${JSON.stringify(tokens.colors.text)},
      },
      // Curated pairing: ${tokens.font.label} (Google Fonts + system fallback)
      fontFamily: {
        heading: [${JSON.stringify(headingStack(tokens.font))}],
        body: [${JSON.stringify(bodyStack(tokens.font))}],
      },
      fontWeight: {
        heading: ${JSON.stringify(String(tokens.font.headingWeight))},
      },
      letterSpacing: {
        heading: ${JSON.stringify(tokens.font.headingTracking)},
      },
      borderRadius: {
        btn: ${JSON.stringify(tokens.buttonRadius)},
      },
      spacing: {
        section: ${JSON.stringify(SECTION_SPACING_REM[tokens.sectionSpacing])},
      },
    },
  },
  plugins: [],
};

export default config;
`;
}

function buildGlobalsCss(tokens: StyleTokens): string {
  const font = tokens.font;
  return `@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  scroll-behavior: smooth;
}

body {
  font-family: ${bodyStack(font)};
}

/*
 * Headings follow the curated font pairing (${font.label}). The Google Fonts
 * stylesheet only loads weight ${font.headingWeight} for the heading face, so
 * the pairing's weight and tracking stay authoritative over utility classes
 * (font-bold would otherwise request an unloaded weight).
 */
h1,
h2,
h3 {
  font-family: ${headingStack(font)};
  font-weight: ${font.headingWeight} !important;
  letter-spacing: ${font.headingTracking} !important;
  line-height: 1.12;
}
`;
}

interface SiteConfigData {
  layout: LayoutType;
  business: {
    name: string;
    category: string;
    area: string | null;
    address: string | null;
    phone: string | null;
    googleMapsUrl: string | null;
    openingHours: string[];
  };
  copy: {
    websiteName: string;
    headline: string;
    subheadline: string;
    ctaText: string;
    about: string;
    services: { title: string; description: string }[];
    highlightItems: { title: string; description: string }[];
    faq: { question: string; answer: string }[];
    whyChooseUs: string[];
    trustSignals: string[];
    testimonials: string[];
    contactSection: string;
    seoTitle: string;
    seoMetaDescription: string;
    whatsappMessage: string;
    bookingFormFields: string[];
    imageRecommendations: string[];
    featureSections: FeatureSection[];
  };
  style: {
    colors: StyleColors;
    /** Curated Google-Fonts pairing label, e.g. "Fraunces + Inter". */
    fontPairing: string;
    buttonRadius: ButtonRadius;
    sectionSpacing: SectionSpacing;
  };
  links: {
    whatsappUrl: string | null;
    telUrl: string | null;
    mapsUrl: string | null;
    mapEmbedUrl: string;
  };
  /** Slim top-ribbon notice: short label + one-line note. */
  draftNotice: { short: string; long: string };
  disclaimer: string;
}

function buildSiteConfig(site: SiteConfigData): string {
  return `// Auto-generated site configuration.
// ALL page content is driven by this object — edit values here to update the
// site. Generated from the business's public Google Maps profile data.
// The Google star rating / review count is intentionally NOT included.

export type SiteLayout =
  | "premium-service"
  | "local-practical"
  | "hospitality"
  | "wellness-clinic"
  | "creative-portfolio"
  | "premium-professional"
  | "simple-landing";

export interface SiteService {
  title: string;
  description: string;
}

export interface SiteFaqItem {
  question: string;
  answer: string;
}

export type SiteFeatureSectionType =
  | "checklist"
  | "steps"
  | "reassurance"
  | "perfect-for"
  | "highlights"
  | "service-area";

/** Business-specific feature section rendered by the shared FeatureSections component. */
export interface SiteFeatureSection {
  type: SiteFeatureSectionType;
  title: string;
  intro: string;
  items: SiteService[];
}

export interface SiteConfig {
  /** Layout variant this export was generated for. */
  layout: SiteLayout;
  business: {
    name: string;
    category: string;
    area: string | null;
    address: string | null;
    phone: string | null;
    googleMapsUrl: string | null;
    openingHours: string[];
  };
  copy: {
    websiteName: string;
    headline: string;
    subheadline: string;
    ctaText: string;
    about: string;
    services: SiteService[];
    /** Menu highlights / signature services / treatments / projects. */
    highlightItems: SiteService[];
    faq: SiteFaqItem[];
    whyChooseUs: string[];
    trustSignals: string[];
    testimonials: string[];
    contactSection: string;
    seoTitle: string;
    seoMetaDescription: string;
    whatsappMessage: string;
    bookingFormFields: string[];
    /** Photo ideas for replacing the gradient placeholder panels. */
    imageRecommendations: string[];
    /** Business-specific feature sections (checklist, steps, reassurance...). */
    featureSections: SiteFeatureSection[];
  };
  /** Style tokens derived from the AI design system (wired into Tailwind). */
  style: {
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      surface: string;
      text: string;
    };
    /** Curated Google-Fonts pairing label, e.g. "Fraunces + Inter". */
    fontPairing: string;
    buttonRadius: "999px" | "3px" | "10px";
    sectionSpacing: "compact" | "comfortable" | "generous";
  };
  links: {
    whatsappUrl: string | null;
    telUrl: string | null;
    mapsUrl: string | null;
    mapEmbedUrl: string;
  };
  /** Slim top-ribbon concept notice (empty strings in the production export). */
  draftNotice: { short: string; long: string };
  /** Disclaimer sentence in the footer bar (empty = hidden, production export). */
  disclaimer: string;
}

export const SITE: SiteConfig = ${JSON.stringify(site, null, 2)};
`;
}

function buildReadme(
  businessName: string,
  layout: LayoutType,
  tokens: StyleTokens,
  style: VisualStyleJson | null
): string {
  const safeName = safeReadmeText(businessName);
  const layoutLabel = LAYOUT_TYPE_LABELS[layout];
  const styleName = style ? safeReadmeText(style.style_name) : "";
  const c = tokens.colors;
  return `# Draft website concept — ${safeName}

> **DRAFT — NOT FOR PUBLICATION**
>
> This website was **auto-generated from the public Google Maps profile data**
> of "${safeName}" as a **demo for the business owner**. It is **not** the
> official website of this business and **must not be published or deployed
> without the business owner's explicit approval**. Review all content
> (testimonials, opening hours, contact details) with the owner before any use.

## Getting started

\`\`\`bash
npm install
npm run dev
\`\`\`

Then open http://localhost:3000.

## Production build

\`\`\`bash
npm run build
npm run start
\`\`\`

## Layout & style

| Token | Value |
| --- | --- |
| Layout variant | \`${layout}\` (${layoutLabel}) |${styleName ? `\n| Style name | ${styleName} |` : ""}
| Colors | primary \`${c.primary}\` · secondary \`${c.secondary}\` · accent \`${c.accent}\` · background \`${c.background}\` · surface \`${c.surface}\` · text \`${c.text}\` |
| Font pairing | ${tokens.font.label} (Google Fonts with system fallback) |
| Button radius | \`${tokens.buttonRadius}\` |
| Section spacing | ${tokens.sectionSpacing} |

The colors, font pairing (\`font-heading\` / \`font-body\`), button radius
(\`rounded-btn\`) and section padding (\`py-section\`) are wired into
\`tailwind.config.ts\` and \`src/app/globals.css\`.

## Editing content

All text, contact links, and style tokens live in a single typed config
object: \`src/config/site.ts\`. The components in \`src/components/\` are fully
data-driven from that file, so most changes only require editing \`SITE\`.

## Replacing the placeholder panels

The page uses **gradient placeholder panels** instead of photos (no stock
images are bundled). Replace them with real photos of the business — see
\`SITE.copy.imageRecommendations\` in \`src/config/site.ts\` for suggested
shots. Put images in \`public/\` and swap the gradient \`<div>\`s for
\`next/image\` components.

## Notes

- The booking/quote form is a **non-functional demo** (submit is disabled).
- The map is embedded via a keyless Google Maps embed URL.
- Fonts load from Google Fonts with \`font-display: swap\` and degrade to
  system font stacks when offline.
- Testimonials are paraphrased from public reviews and shown without
  reviewer names; the Google star rating / review count is intentionally
  not displayed.
- A slim concept-draft ribbon is rendered at the top of every page and the
  full disclaimer appears in the footer bar; remove \`DraftBanner\` and the
  footer disclaimer only after the business owner approves the site.
`;
}

/**
 * README for the approved production export: no draft warnings (the export is
 * gated on the owner's content approval), plus a pointer to DEPLOY.md.
 */
function buildProductionReadme(
  businessName: string,
  layout: LayoutType,
  tokens: StyleTokens,
  style: VisualStyleJson | null
): string {
  const safeName = safeReadmeText(businessName);
  const layoutLabel = LAYOUT_TYPE_LABELS[layout];
  const styleName = style ? safeReadmeText(style.style_name) : "";
  const c = tokens.colors;
  return `# ${safeName} — website

Production build of the website for **${safeName}**. Content was reviewed and
approved by the business owner before this export was generated.

See **DEPLOY.md** for the step-by-step guide to putting this live on the
client's domain (Cloudflare Pages + Cloudflare Registrar).

## Getting started

\`\`\`bash
npm install
npm run dev
\`\`\`

Then open http://localhost:3000.

## Production build

\`\`\`bash
npm run build
npm run start
\`\`\`

## Layout & style

| Token | Value |
| --- | --- |
| Layout variant | \`${layout}\` (${layoutLabel}) |${styleName ? `\n| Style name | ${styleName} |` : ""}
| Colors | primary \`${c.primary}\` · secondary \`${c.secondary}\` · accent \`${c.accent}\` · background \`${c.background}\` · surface \`${c.surface}\` · text \`${c.text}\` |
| Font pairing | ${tokens.font.label} (Google Fonts with system fallback) |
| Button radius | \`${tokens.buttonRadius}\` |
| Section spacing | ${tokens.sectionSpacing} |

## Editing content

All text, contact links, and style tokens live in a single typed config
object: \`src/config/site.ts\`. The components in \`src/components/\` are fully
data-driven from that file, so most changes only require editing \`SITE\`.

## Before going live — final checklist

- Replace the **gradient placeholder panels** with real photos of the business
  (\`SITE.copy.imageRecommendations\` lists suggested shots). Put images in
  \`public/\` and swap the gradient \`<div>\`s for \`next/image\` components.
- The booking/quote form is a **non-functional demo** (submit is disabled) —
  wire it to a form service or remove it.
- Re-confirm phone number, address, and opening hours with the owner.
- Testimonials are paraphrased from public reviews; confirm the owner is
  happy with each one (or replace them with quotes the owner provides).
`;
}

/**
 * Cloudflare deploy guide bundled only with the production export. Documents
 * the agreed domain model: domain bought at cost via Cloudflare Registrar,
 * managed for the client, with a standing free-transfer promise.
 */
function buildDeployGuide(businessName: string, siteUrl: string): string {
  const safeName = safeReadmeText(businessName);
  const host = siteUrl.replace(/^https:\/\//, "");
  return `# Deploying ${safeName} to ${host}

This site is a static-friendly Next.js app. The recommended (free) setup is
**Cloudflare Pages** for hosting and **Cloudflare Registrar** for the domain.

## 1. Buy the domain (Cloudflare Registrar)

1. Sign in at https://dash.cloudflare.com → **Domain Registration → Register domain**.
2. Search for \`${host}\` and buy it. Cloudflare sells at wholesale cost
   (roughly AED 40/year for a .com) with WHOIS privacy included.
3. Keep the domain in your Cloudflare account — you manage it for the client
   as part of their annual care plan.

> **Client ownership promise:** the domain is registered for the client and
> transfers to them free of charge whenever they ask. Put that in writing in
> your agreement — it removes the "but do I own it?" objection.

## 2. Create the Pages project

1. In the Cloudflare dashboard: **Workers & Pages → Create → Pages**.
2. Either connect a Git repository containing this folder, or use
   **Direct Upload** with the build output:

\`\`\`bash
npm install
npx next build
\`\`\`

3. Build settings when connecting Git: framework preset **Next.js**,
   build command \`npx next build\`.

## 3. Attach the custom domain

1. In the Pages project: **Custom domains → Set up a custom domain**.
2. Enter \`${host}\`. Because the domain is already on Cloudflare, the DNS
   record is created automatically and HTTPS is issued within minutes.
3. Add the \`www.\` variant too and redirect it to the apex (Pages offers
   this in the same flow).

## 4. After it's live

- Verify ${siteUrl} loads with a valid certificate.
- Submit the site at https://search.google.com/search-console (URL-prefix
  property, DNS verification is automatic on Cloudflare).
- Update the business's Google Maps profile with the new website URL —
  that link is the main way customers will find the site.
- Optional: professional email on the domain via Zoho Mail's free tier or
  Cloudflare Email Routing (forwarding to the owner's existing inbox).

## Costs

| Item | Cost |
| --- | --- |
| Cloudflare Pages hosting | Free (commercial use allowed) |
| Domain (.com via Cloudflare Registrar) | ~AED 40/year at cost |
| HTTPS certificate | Free (automatic) |
`;
}

// ---------------------------------------------------------------------------
// Static project files (no interpolated user data)
// ---------------------------------------------------------------------------

const NEXT_CONFIG = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
`;

const TSCONFIG = `${JSON.stringify(
  {
    compilerOptions: {
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
      paths: { "@/*": ["./src/*"] },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  },
  null,
  2
)}\n`;

const POSTCSS_CONFIG = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

/**
 * layout.tsx with the curated Google Fonts pairing wired in via preconnect +
 * stylesheet links. The href comes from the fixed FONT_PAIRINGS table (never
 * from business data or AI output).
 */
function buildLayoutTsx(font: FontPairing, siteUrl: string | null): string {
  const header = siteUrl
    ? ""
    : `/*
 * DRAFT WEBSITE CONCEPT — generated from public Google Maps profile data as a
 * demo for the business owner. Not the official website of this business.
 * Do NOT publish without the business owner's explicit approval.
 */
`;
  // Draft exports are noindexed; the approved production export is indexable
  // with the client's domain as canonical URL.
  const metadataExtras = siteUrl
    ? `  metadataBase: new URL(${JSON.stringify(siteUrl)}),
  alternates: { canonical: "/" },
  openGraph: {
    title: SITE.copy.seoTitle,
    description: SITE.copy.seoMetaDescription,
    url: "/",
    siteName: SITE.copy.websiteName,
    type: "website",
  },`
    : `  robots: { index: false, follow: false },`;
  return `${header}import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SITE } from "@/config/site";
import "./globals.css";

export const metadata: Metadata = {
  title: SITE.copy.seoTitle,
  description: SITE.copy.seoMetaDescription,
${metadataExtras}
};

// Curated font pairing (${font.label}), loaded with font-display: swap;
// the system fallback stacks in tailwind.config.ts keep the page legible
// while fonts load (or offline).
const FONT_STYLESHEET_HREF =
  ${JSON.stringify(font.importHref)};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link rel="stylesheet" href={FONT_STYLESHEET_HREF} />
      </head>
      <body className="bg-background font-body text-text antialiased">
        {children}
      </body>
    </html>
  );
}
`;
}

const DRAFT_BANNER_TSX = `// Slim static concept ribbon (scrolls away with the page) — a professional
// proof tag rather than a warning strip. The full disclaimer sentence is
// rendered in the footer bottom bar by SiteFooter.
import { SITE } from "@/config/site";

export function DraftBanner() {
  return (
    <div
      role="note"
      className="bg-secondary text-[11px] uppercase tracking-[0.14em] text-white/70"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-2">
        <b className="shrink-0 font-semibold tracking-[0.18em] text-white">
          {SITE.draftNotice.short}
        </b>
        <span className="truncate">{SITE.draftNotice.long}</span>
      </div>
    </div>
  );
}
`;

const SITE_FOOTER_TSX = `// Premium multi-column footer: brand | contact links | visit details, plus
// the draft-disclaimer bar (hidden when SITE.disclaimer is empty — i.e. in
// the approved production export). Fully data-driven from SITE.
import { SITE } from "@/config/site";

export function SiteFooter() {
  const { business, copy, links } = SITE;
  const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const todayHours =
    business.openingHours.find((line) => line.startsWith(weekday)) ?? null;
  const linkClass = "font-semibold text-primary underline-offset-4 hover:underline";
  return (
    <footer className="border-t border-text/10 bg-surface">
      <div className="mx-auto grid max-w-6xl gap-9 px-5 py-12 md:grid-cols-3">
        <div>
          <p className="font-heading text-lg font-bold">{business.name}</p>
          <p className="mt-1 text-sm text-text/60">
            {business.category}
            {business.area ? " \\u00B7 " + business.area : ""}
          </p>
          {copy.seoMetaDescription ? (
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-text/60">
              {copy.seoMetaDescription}
            </p>
          ) : null}
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-text/50">
            Contact
          </p>
          <div className="mt-3 space-y-2 text-sm">
            {business.phone && links.telUrl ? (
              <p>
                <a href={links.telUrl} aria-label="Call us by phone" className={linkClass}>
                  {business.phone}
                </a>
              </p>
            ) : null}
            {links.whatsappUrl ? (
              <p>
                <a
                  href={links.whatsappUrl}
                  aria-label="Message us on WhatsApp"
                  className={linkClass}
                >
                  WhatsApp
                </a>
              </p>
            ) : null}
            {links.mapsUrl ? (
              <p>
                <a
                  href={links.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open our profile on Google Maps"
                  className={linkClass}
                >
                  Google Maps
                </a>
              </p>
            ) : null}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-text/50">
            Visit
          </p>
          <div className="mt-3 space-y-2 text-sm leading-relaxed text-text/60">
            {business.address ? <p>{business.address}</p> : null}
            {todayHours ? <p>{todayHours}</p> : null}
          </div>
        </div>
      </div>
      {SITE.disclaimer ? (
        <div className="border-t border-text/10 bg-background">
          <p className="mx-auto max-w-6xl px-5 py-4 text-xs leading-relaxed text-text/60">
            {SITE.disclaimer}
          </p>
        </div>
      ) : null}
    </footer>
  );
}
`;

const SHARED_TSX = `// Shared, fully data-driven building blocks used by the layout page
// component. All content comes from SITE (src/config/site.ts).
import type { SiteFeatureSection } from "@/config/site";
import { SITE } from "@/config/site";

export function CtaButtons({
  secondaryLabel = "Call us",
  center = false,
  onDark = false,
}: {
  secondaryLabel?: string;
  center?: boolean;
  onDark?: boolean;
}) {
  const { copy, links } = SITE;
  const primaryHref = links.whatsappUrl ?? links.telUrl ?? "#contact";
  const primaryClass = onDark ? "bg-accent" : "bg-primary";
  const secondaryClass = onDark
    ? "border-white/80 text-white hover:bg-white/10"
    : "border-primary text-primary hover:bg-primary/5";
  return (
    <div className={"flex flex-wrap gap-4" + (center ? " justify-center" : "")}>
      <a
        href={primaryHref}
        aria-label={links.whatsappUrl ? "Contact us on WhatsApp" : "Contact us"}
        className={
          "group inline-flex items-center gap-2.5 rounded-btn px-7 py-3 text-base font-semibold text-white shadow-lg transition hover:opacity-90 " +
          primaryClass
        }
      >
        {copy.ctaText}
        <span
          aria-hidden="true"
          className="inline-block transition-transform duration-200 group-hover:translate-x-1"
        >
          {"\\u2192"}
        </span>
      </a>
      {links.whatsappUrl && links.telUrl ? (
        <a
          href={links.telUrl}
          aria-label="Call us by phone"
          className={
            "rounded-btn border-2 px-7 py-3 text-base font-semibold transition " +
            secondaryClass
          }
        >
          {secondaryLabel}
        </a>
      ) : null}
    </div>
  );
}

/**
 * Asymmetric section header with an oversized outlined index numeral — the
 * editorial device that breaks uniform section stacking (mirrors the
 * preview's .sec-head treatment). The numeral is drawn with a transparent
 * fill and a text-stroke in the current text color at low opacity.
 */
export function SectionHead({
  index,
  kicker,
  title,
  intro,
  headingId,
}: {
  index: number;
  kicker: string;
  title: string;
  intro?: string;
  headingId: string;
}) {
  const numeral = String(index).padStart(2, "0");
  return (
    <div className="mb-9 grid items-end gap-x-12 gap-y-3 md:grid-cols-[minmax(150px,0.42fr)_1fr]">
      <div>
        <p className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
          {kicker}
          <span aria-hidden="true" className="h-px w-11 bg-primary/40" />
        </p>
        <p
          aria-hidden="true"
          className="select-none font-heading leading-[0.8] text-text/20"
          style={{
            fontSize: "clamp(64px, 8vw, 110px)",
            WebkitTextStrokeWidth: "1.5px",
            WebkitTextFillColor: "transparent",
          }}
        >
          {numeral}
        </p>
      </div>
      <div>
        <h2 id={headingId} className="text-3xl font-bold">
          {title}
        </h2>
        {intro ? (
          <p className="mt-2 max-w-xl leading-relaxed text-text/60">{intro}</p>
        ) : null}
      </div>
    </div>
  );
}

export function HoursList() {
  const hours = SITE.business.openingHours;
  if (hours.length === 0) {
    return <p className="text-sm text-text/60">Contact us for current opening hours.</p>;
  }
  return (
    <ul>
      {hours.map((line) => (
        <li key={line} className="border-b border-text/10 py-2 text-sm last:border-b-0">
          {line}
        </li>
      ))}
    </ul>
  );
}

export function MapEmbed() {
  const { business, links } = SITE;
  return (
    <div>
      {business.address ? (
        <p className="text-sm leading-relaxed text-text/70">{business.address}</p>
      ) : (
        <p className="text-sm text-text/70">Located in {business.area ?? "Dubai"}.</p>
      )}
      {links.mapsUrl ? (
        <a
          href={links.mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={"Open " + business.name + " on Google Maps"}
          className="mt-2 inline-block text-sm font-semibold text-primary underline underline-offset-4"
        >
          View on Google Maps
        </a>
      ) : null}
      <div className="mt-4 overflow-hidden rounded-xl border border-text/10">
        <iframe
          src={links.mapEmbedUrl}
          title={"Map showing the location of " + business.name}
          className="h-72 w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
    </div>
  );
}

export function TestimonialCards() {
  const quotes = SITE.copy.testimonials.slice(0, 4);
  if (quotes.length === 0) return null;
  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2">
      {quotes.map((quote) => (
        <blockquote key={quote} className="rounded-xl border border-text/10 bg-surface p-6">
          <span aria-hidden="true" className="font-heading text-3xl leading-none text-primary">
            {"\\u201C"}
          </span>
          <p className="mt-1 text-sm leading-relaxed text-text/70">{quote}</p>
        </blockquote>
      ))}
    </div>
  );
}

export function PullQuotes() {
  const quotes = SITE.copy.testimonials.slice(0, 3);
  if (quotes.length === 0) return null;
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {quotes.map((quote) => (
        <blockquote
          key={quote}
          className="text-center font-heading text-xl leading-relaxed md:text-2xl"
        >
          <span aria-hidden="true" className="text-primary">
            {"\\u201C"}
          </span>
          {quote}
        </blockquote>
      ))}
    </div>
  );
}

export function Faq() {
  const items = SITE.copy.faq.slice(0, 5);
  if (items.length === 0) return null;
  return (
    <section id="faq" aria-labelledby="faq-heading" className="px-5 py-section">
      <div className="mx-auto max-w-3xl">
        <h2 id="faq-heading" className="text-3xl font-bold">
          Common questions
        </h2>
        <div className="mt-6 space-y-3">
          {items.map((item) => (
            <details
              key={item.question}
              className="rounded-xl border border-text/10 bg-surface px-5 py-4"
            >
              <summary className="cursor-pointer font-semibold">{item.question}</summary>
              <p className="mt-3 text-sm leading-relaxed text-text/70">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function DemoForm({ heading }: { heading: string }) {
  const fields = SITE.copy.bookingFormFields.slice(0, 6);
  if (fields.length === 0) return null;
  const inputClass =
    "w-full rounded-md border border-text/20 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";
  return (
    <form
      aria-label="Demo booking form"
      className="rounded-xl border border-text/10 bg-surface p-6 shadow-sm"
    >
      <p className="text-lg font-bold">{heading}</p>
      <div className="mt-4 flex flex-col gap-4">
        {fields.map((label, index) => {
          const id = "demo-field-" + index;
          const isLong = /message|detail|request|note/i.test(label);
          return (
            <div key={id} className="flex flex-col gap-1">
              <label htmlFor={id} className="text-sm font-medium">
                {label}
              </label>
              {isLong ? (
                <textarea id={id} rows={3} placeholder={label} className={inputClass} />
              ) : (
                <input id={id} type="text" placeholder={label} className={inputClass} />
              )}
            </div>
          );
        })}
      </div>
      <button
        type="submit"
        disabled
        className="mt-6 w-full cursor-not-allowed rounded-btn bg-text/15 px-6 py-3 font-semibold text-text/60"
      >
        Demo form (not yet active)
      </button>
      <p className="mt-2 text-center text-xs text-text/50">
        This form is a non-functional demo.
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Business-specific feature sections (shared across all layouts)
// ---------------------------------------------------------------------------

function FeatureKicker({ label }: { label: string }) {
  return (
    <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{label}</p>
  );
}

function FeatureChecklist({
  section,
  headingId,
}: {
  section: SiteFeatureSection;
  headingId: string;
}) {
  return (
    <section aria-labelledby={headingId} className="px-5 py-section">
      <div className="mx-auto max-w-6xl rounded-2xl border border-text/10 bg-surface p-8 shadow-sm md:p-10">
        <FeatureKicker label="Included" />
        <h2 id={headingId} className="mt-2 text-3xl font-bold">
          {section.title}
        </h2>
        {section.intro ? (
          <p className="mt-3 max-w-2xl leading-relaxed text-text/70">{section.intro}</p>
        ) : null}
        <ul className="mt-7 grid gap-5 sm:grid-cols-2">
          {section.items.map((item) => (
            <li key={item.title} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
              >
                {"\\u2713"}
              </span>
              <span>
                <span className="block font-semibold">{item.title}</span>
                {item.description ? (
                  <span className="text-sm leading-relaxed text-text/60">
                    {item.description}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FeatureSteps({
  section,
  headingId,
}: {
  section: SiteFeatureSection;
  headingId: string;
}) {
  return (
    <section aria-labelledby={headingId} className="px-5 py-section">
      <div className="mx-auto max-w-3xl">
        <FeatureKicker label="How it works" />
        <h2 id={headingId} className="mt-2 text-3xl font-bold">
          {section.title}
        </h2>
        {section.intro ? (
          <p className="mt-3 leading-relaxed text-text/70">{section.intro}</p>
        ) : null}
        <ol className="ml-4 mt-9">
          {section.items.map((item, index) => (
            <li
              key={item.title}
              className="relative border-l-2 border-primary/25 pb-8 pl-8 last:border-transparent last:pb-0"
            >
              <span
                aria-hidden="true"
                className="absolute -left-4 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white"
              >
                {index + 1}
              </span>
              <h3 className="pt-0.5 text-lg font-semibold">{item.title}</h3>
              {item.description ? (
                <p className="mt-1 text-sm leading-relaxed text-text/70">
                  {item.description}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FeatureReassurance({
  section,
  headingId,
}: {
  section: SiteFeatureSection;
  headingId: string;
}) {
  return (
    <section aria-labelledby={headingId} className="px-5 py-section">
      <div className="mx-auto max-w-3xl rounded-2xl border border-text/10 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-8 md:p-10">
        <FeatureKicker label="Good to know" />
        <h2 id={headingId} className="mt-2 text-3xl font-bold">
          {section.title}
        </h2>
        {section.intro ? (
          <p className="mt-3 text-lg font-semibold leading-relaxed">{section.intro}</p>
        ) : null}
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {section.items.map((item) => (
            <div key={item.title}>
              <p className="font-semibold">{item.title}</p>
              {item.description ? (
                <p className="mt-1 text-sm leading-relaxed text-text/70">
                  {item.description}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturePerfectFor({
  section,
  headingId,
}: {
  section: SiteFeatureSection;
  headingId: string;
}) {
  return (
    <section aria-labelledby={headingId} className="px-5 py-section">
      <div className="mx-auto max-w-6xl">
        <FeatureKicker label="Come here for" />
        <h2 id={headingId} className="mt-2 text-3xl font-bold">
          {section.title}
        </h2>
        {section.intro ? (
          <p className="mt-3 max-w-2xl leading-relaxed text-text/70">{section.intro}</p>
        ) : null}
        <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {section.items.map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-text/10 border-t-4 border-t-accent bg-surface p-6"
            >
              <p className="font-semibold">{item.title}</p>
              {item.description ? (
                <p className="mt-1.5 text-sm leading-relaxed text-text/70">
                  {item.description}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureHighlights({
  section,
  headingId,
}: {
  section: SiteFeatureSection;
  headingId: string;
}) {
  return (
    <section aria-labelledby={headingId} className="px-5 py-section">
      <div className="mx-auto max-w-3xl">
        <FeatureKicker label="Highlights" />
        <h2 id={headingId} className="mt-2 text-3xl font-bold">
          {section.title}
        </h2>
        {section.intro ? (
          <p className="mt-3 leading-relaxed text-text/70">{section.intro}</p>
        ) : null}
        <div className="mt-6">
          {section.items.map((item) => (
            <div
              key={item.title}
              className="border-b border-text/10 py-4 last:border-b-0"
            >
              <div className="flex items-baseline gap-3">
                <h3 className="whitespace-nowrap text-lg font-semibold">{item.title}</h3>
                <span
                  aria-hidden="true"
                  className="-translate-y-1 flex-1 border-b-2 border-dotted border-text/30"
                />
              </div>
              {item.description ? (
                <p className="mt-1 text-sm leading-relaxed text-text/70">
                  {item.description}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureServiceArea({
  section,
  headingId,
}: {
  section: SiteFeatureSection;
  headingId: string;
}) {
  const { business } = SITE;
  return (
    <section aria-labelledby={headingId} className="px-5 py-section">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <FeatureKicker label="Where we work" />
          <h2 id={headingId} className="mt-2 text-3xl font-bold">
            {section.title}
          </h2>
          {section.intro ? (
            <p className="mt-3 max-w-xl leading-relaxed text-text/70">{section.intro}</p>
          ) : null}
          <div className="mt-6 flex flex-wrap gap-2.5">
            {section.items.map((item) => (
              <span
                key={item.title}
                title={item.description}
                className="rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm font-semibold"
              >
                {item.title}
              </span>
            ))}
          </div>
        </div>
        <div className="self-start rounded-xl border border-text/10 bg-surface p-6">
          <p className="font-semibold">Based in {business.area ?? "Dubai"}</p>
          <p className="mt-1 text-sm leading-relaxed text-text/60">
            {business.address ?? "Contact us for directions."}
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * Renders SITE.copy.featureSections (max 3) with a treatment per type.
 * Placed after the services/menu/work section in every layout.
 */
export function FeatureSections() {
  const sections = SITE.copy.featureSections.slice(0, 3);
  if (sections.length === 0) return null;
  return (
    <>
      {sections.map((section, index) => {
        const key = section.type + "-" + index;
        const headingId = "feature-heading-" + index;
        switch (section.type) {
          case "checklist":
            return <FeatureChecklist key={key} section={section} headingId={headingId} />;
          case "steps":
            return <FeatureSteps key={key} section={section} headingId={headingId} />;
          case "reassurance":
            return (
              <FeatureReassurance key={key} section={section} headingId={headingId} />
            );
          case "perfect-for":
            return (
              <FeaturePerfectFor key={key} section={section} headingId={headingId} />
            );
          case "service-area":
            return (
              <FeatureServiceArea key={key} section={section} headingId={headingId} />
            );
          case "highlights":
          default:
            return (
              <FeatureHighlights key={key} section={section} headingId={headingId} />
            );
        }
      })}
    </>
  );
}

/**
 * Sticky mobile contact bar: fixed to the bottom on small screens only.
 * The spacer div keeps page content from being hidden behind the bar.
 */
export function StickyContactBar() {
  const { links } = SITE;
  if (!links.telUrl && !links.whatsappUrl) return null;
  return (
    <>
      <div aria-hidden="true" className="h-16 md:hidden" />
      <div
        role="complementary"
        aria-label="Quick contact"
        className="fixed inset-x-0 bottom-0 z-50 flex border-t border-text/10 bg-surface shadow-[0_-4px_16px_rgba(0,0,0,0.12)] md:hidden"
      >
        {links.telUrl ? (
          <a
            href={links.telUrl}
            aria-label="Call now"
            className="flex flex-1 items-center justify-center bg-secondary py-4 text-base font-bold text-white"
          >
            Call
          </a>
        ) : null}
        {links.whatsappUrl ? (
          <a
            href={links.whatsappUrl}
            aria-label="Message on WhatsApp"
            className="flex flex-1 items-center justify-center bg-[#16a34a] py-4 text-base font-bold text-white"
          >
            WhatsApp
          </a>
        ) : null}
      </div>
    </>
  );
}
`;

// ---------------------------------------------------------------------------
// Layout page components (one per LayoutType; only the selected one is
// included in the export, and src/app/page.tsx composes it)
// ---------------------------------------------------------------------------

const PREMIUM_SERVICE_TSX = `// Premium service layout: sticky top nav, split hero with a decorative
// monogram panel, numbered signature list, editorial bands, pull quotes.
import {
  CtaButtons,
  FeatureSections,
  HoursList,
  MapEmbed,
  PullQuotes,
  SectionHead,
} from "@/components/Shared";
import { SITE } from "@/config/site";

export function PremiumServicePage() {
  const { business, copy, links } = SITE;
  const signatures = (
    copy.highlightItems.length > 0 ? copy.highlightItems : copy.services
  ).slice(0, 4);
  const monogram = (business.name.trim().charAt(0) || "\\u2022").toUpperCase();
  return (
    <>
      <nav
        aria-label="Main"
        className="sticky top-0 z-40 border-b border-text/10 bg-surface/90 backdrop-blur"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <a href="#top" className="font-heading text-lg font-bold">
            {business.name}
          </a>
          <a
            href={links.whatsappUrl ?? links.telUrl ?? "#contact"}
            aria-label={links.whatsappUrl ? "Contact us on WhatsApp" : "Contact us"}
            className="group inline-flex items-center gap-2 rounded-btn bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {copy.ctaText}
            <span
              aria-hidden="true"
              className="inline-block transition-transform duration-200 group-hover:translate-x-1"
            >
              {"\\u2192"}
            </span>
          </a>
        </div>
      </nav>
      <header
        id="top"
        className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-section md:grid-cols-[1.15fr_0.85fr]"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
            {business.category}
            {business.area ? " \\u00B7 " + business.area : ""}
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            {copy.headline}
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-text/70">
            {copy.subheadline}
          </p>
          <div className="mt-8">
            <CtaButtons />
          </div>
        </div>
        <div
          role="img"
          aria-label="Decorative brand panel (replace with a real photo)"
          className="flex aspect-[4/5] items-center justify-center rounded-2xl bg-gradient-to-br from-primary/25 via-accent/15 to-secondary/10"
        >
          <span aria-hidden="true" className="font-heading text-8xl text-primary/50 md:text-9xl">
            {monogram}
          </span>
        </div>
      </header>
      <main>
        <section id="signature" aria-labelledby="signature-heading" className="px-5 py-section">
          <div className="mx-auto max-w-6xl">
            <SectionHead
              index={1}
              kicker="Signature"
              title="What clients come here for"
              headingId="signature-heading"
            />
            <div className="divide-y divide-text/10 border-y border-text/10">
              {signatures.map((item, index) => (
                <div key={item.title} className="grid grid-cols-[56px_1fr] gap-5 py-6">
                  <span aria-hidden="true" className="font-heading text-2xl text-primary">
                    {"0" + (index + 1)}
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold">{item.title}</h3>
                    <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-text/70">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <FeatureSections />
        <section
          id="about"
          aria-labelledby="about-heading"
          className="border-y border-text/10 bg-surface px-5 py-section"
        >
          <div className="mx-auto grid max-w-6xl gap-9 md:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">About</p>
              <h2 id="about-heading" className="mt-2 text-3xl font-bold">
                About {business.name}
              </h2>
              <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-text/70">
                {copy.about}
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold">Why clients choose us</h3>
              <ul className="mt-4 space-y-3">
                {copy.whyChooseUs.map((reason) => (
                  <li key={reason} className="flex gap-3 text-text/70">
                    <span aria-hidden="true" className="text-accent">
                      {"\\u2014"}
                    </span>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
        <section id="reviews" aria-labelledby="reviews-heading" className="px-5 py-section">
          <div className="mx-auto max-w-6xl">
            <h2
              id="reviews-heading"
              className="text-center text-xs font-bold uppercase tracking-[0.16em] text-primary"
            >
              What clients say
            </h2>
            <div className="mt-8">
              <PullQuotes />
            </div>
          </div>
        </section>
        <section id="visit" aria-labelledby="visit-heading" className="bg-primary/5 px-5 py-section">
          <div className="mx-auto max-w-6xl">
            <h2 id="visit-heading" className="text-3xl font-bold">
              Hours and location
            </h2>
            <div className="mt-8 grid gap-9 md:grid-cols-2">
              <div>
                <HoursList />
              </div>
              <MapEmbed />
            </div>
          </div>
        </section>
        <section id="contact" aria-labelledby="contact-heading" className="px-5 py-section">
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="contact-heading" className="text-3xl font-bold">
              {copy.ctaText}
            </h2>
            <p className="mt-4 leading-relaxed text-text/70">{copy.contactSection}</p>
            <div className="mt-8 flex justify-center">
              <CtaButtons secondaryLabel={business.phone ?? "Call us"} center />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
`;

const LOCAL_PRACTICAL_TSX = `// Local practical layout: dark phone strip, checkmark job list with an hours
// card aside, accent-bordered service rows, tick strip, FAQ, dark quote band.
import {
  CtaButtons,
  DemoForm,
  Faq,
  FeatureSections,
  HoursList,
  MapEmbed,
  SectionHead,
  TestimonialCards,
} from "@/components/Shared";
import { SITE } from "@/config/site";

export function LocalPracticalPage() {
  const { business, copy, links } = SITE;
  const jobs = (
    copy.highlightItems.length > 0 ? copy.highlightItems : copy.services
  ).slice(0, 4);
  return (
    <>
      {links.telUrl ? (
        <div className="bg-secondary text-white">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-2.5 text-sm">
            <span>
              {business.category}
              {business.area ? " \\u00B7 " + business.area : ""}
            </span>
            <a
              href={links.telUrl}
              aria-label="Call us now"
              className="font-bold underline underline-offset-4"
            >
              {business.phone ?? "Call now"}
            </a>
          </div>
        </div>
      ) : null}
      <header className="mx-auto grid max-w-6xl items-start gap-9 px-5 py-section md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
            {business.category}
            {business.area ? " in " + business.area : ""}
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            {copy.headline}
          </h1>
          <p className="mt-3 text-lg leading-relaxed text-text/70">{copy.subheadline}</p>
          <ul className="mb-7 mt-5 space-y-2.5">
            {jobs.map((job) => (
              <li key={job.title} className="flex items-start gap-3 font-semibold">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-white"
                >
                  {"\\u2713"}
                </span>
                {job.title}
              </li>
            ))}
          </ul>
          <CtaButtons />
        </div>
        <aside className="rounded-xl border border-text/10 bg-surface p-6 shadow-sm">
          <h2 className="mb-2 text-lg font-bold">Opening hours</h2>
          <HoursList />
        </aside>
      </header>
      <main>
        <section id="services" aria-labelledby="services-heading" className="px-5 pb-section">
          <div className="mx-auto max-w-6xl">
            <SectionHead
              index={1}
              kicker="Services"
              title="What we do"
              headingId="services-heading"
            />
            <div className="grid gap-4">
              {copy.services.map((service) => (
                <div
                  key={service.title}
                  className="rounded-lg border border-l-4 border-text/10 border-l-primary bg-surface px-6 py-4"
                >
                  <h3 className="text-lg font-semibold">{service.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-text/70">
                    {service.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <FeatureSections />
        <section id="why" aria-labelledby="why-heading" className="bg-primary/5 px-5 py-section">
          <div className="mx-auto max-w-6xl">
            <h2 id="why-heading" className="text-3xl font-bold">
              Why customers come back
            </h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {copy.whyChooseUs.map((reason) => (
                <li key={reason} className="flex items-start gap-2.5 font-semibold">
                  <span aria-hidden="true" className="font-bold text-primary">
                    {"\\u2713"}
                  </span>
                  {reason}
                </li>
              ))}
            </ul>
            <TestimonialCards />
          </div>
        </section>
        <Faq />
        <section
          id="contact"
          aria-labelledby="contact-heading"
          className="bg-secondary px-5 py-section text-white"
        >
          <div className="mx-auto grid max-w-6xl gap-9 md:grid-cols-2">
            <div>
              <h2 id="contact-heading" className="text-3xl font-bold text-white">
                {copy.ctaText}
              </h2>
              <p className="mt-4 leading-relaxed text-white/75">{copy.contactSection}</p>
              <div className="mt-7">
                <CtaButtons secondaryLabel={business.phone ?? "Call us"} onDark />
              </div>
            </div>
            <DemoForm heading="Request a quote" />
          </div>
        </section>
        <section id="location" aria-labelledby="location-heading" className="px-5 py-section">
          <div className="mx-auto max-w-6xl">
            <h2 id="location-heading" className="text-3xl font-bold">
              Find us
            </h2>
            <div className="mt-6">
              <MapEmbed />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
`;

const HOSPITALITY_TSX = `// Hospitality layout: centered hero with kicker and ornament divider, menu
// highlights with dotted leaders, visit-us split, warm gradient CTA band.
import {
  CtaButtons,
  FeatureSections,
  HoursList,
  MapEmbed,
  SectionHead,
  TestimonialCards,
} from "@/components/Shared";
import { SITE } from "@/config/site";

export function HospitalityPage() {
  const { business, copy } = SITE;
  const menu = (
    copy.highlightItems.length > 0 ? copy.highlightItems : copy.services
  ).slice(0, 6);
  return (
    <>
      <header className="bg-gradient-to-b from-primary/10 to-background px-5 py-section text-center">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
            {business.category}
            {business.area ? " \\u00B7 " + business.area : ""}
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight md:text-6xl">{copy.headline}</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-text/70">
            {copy.subheadline}
          </p>
          <div className="mt-8 flex justify-center">
            <CtaButtons center />
          </div>
          <p aria-hidden="true" className="mt-6 tracking-[0.6em] text-accent">
            {"\\u2726 \\u2726 \\u2726"}
          </p>
        </div>
      </header>
      <main>
        <section
          id="menu"
          aria-labelledby="menu-heading"
          className="border-y border-text/10 bg-surface px-5 py-section"
        >
          <div className="mx-auto max-w-3xl">
            <SectionHead
              index={1}
              kicker="From the reviews"
              title="What people order again"
              headingId="menu-heading"
            />
            <div>
              {menu.map((item) => (
                <div
                  key={item.title}
                  className="border-b border-dashed border-text/20 py-4 last:border-b-0"
                >
                  <div className="flex items-baseline gap-3">
                    <h3 className="whitespace-nowrap text-lg font-semibold">{item.title}</h3>
                    <span
                      aria-hidden="true"
                      className="-translate-y-1 flex-1 border-b-2 border-dotted border-text/30"
                    />
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-text/70">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <FeatureSections />
        <section id="about" aria-labelledby="about-heading" className="px-5 py-section text-center">
          <div className="mx-auto max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Our place</p>
            <h2 id="about-heading" className="mt-2 text-3xl font-bold">
              About {business.name}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl whitespace-pre-line text-base leading-relaxed text-text/70">
              {copy.about}
            </p>
            <div className="text-left">
              <TestimonialCards />
            </div>
          </div>
        </section>
        <section id="visit" aria-labelledby="visit-heading" className="px-5 pb-section">
          <div className="mx-auto max-w-6xl">
            <h2 id="visit-heading" className="text-3xl font-bold">
              Visit us
            </h2>
            <div className="mt-6 grid gap-8 md:grid-cols-2">
              <div className="rounded-xl border border-text/10 bg-surface p-6">
                <h3 className="mb-2 text-lg font-semibold">Opening hours</h3>
                <HoursList />
              </div>
              <MapEmbed />
            </div>
          </div>
        </section>
        <section
          id="contact"
          aria-labelledby="contact-heading"
          className="bg-gradient-to-br from-primary/15 to-accent/10 px-5 py-section text-center"
        >
          <div className="mx-auto max-w-2xl">
            <h2 id="contact-heading" className="text-3xl font-bold">
              {copy.ctaText}
            </h2>
            <p className="mx-auto mt-4 max-w-xl leading-relaxed text-text/70">
              {copy.contactSection}
            </p>
            <div className="mt-8 flex justify-center">
              <CtaButtons secondaryLabel={business.phone ?? "Call us"} center />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
`;

const WELLNESS_CLINIC_TSX = `// Wellness & clinic layout: hero with a demo booking form card, trust strip,
// 2-column treatment grid, FAQ, calm hours/location band.
import {
  CtaButtons,
  DemoForm,
  Faq,
  FeatureSections,
  HoursList,
  MapEmbed,
  SectionHead,
  TestimonialCards,
} from "@/components/Shared";
import { SITE } from "@/config/site";

export function WellnessClinicPage() {
  const { business, copy } = SITE;
  const treatments = (
    copy.highlightItems.length > 0 ? copy.highlightItems : copy.services
  ).slice(0, 6);
  const trust = copy.trustSignals.slice(0, 4);
  return (
    <>
      <header className="mx-auto grid max-w-6xl items-start gap-10 px-5 py-section md:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
            {business.category}
            {business.area ? " \\u00B7 " + business.area : ""}
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            {copy.headline}
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-text/70">
            {copy.subheadline}
          </p>
          <div className="mt-7">
            <CtaButtons secondaryLabel="Call the clinic" />
          </div>
          <ul className="mt-9 grid gap-3 sm:grid-cols-2">
            {trust.map((signal) => (
              <li
                key={signal}
                className="flex items-start gap-2.5 rounded-lg border border-text/10 bg-surface px-4 py-3 text-sm font-semibold"
              >
                <span aria-hidden="true" className="font-bold text-primary">
                  {"\\u2713"}
                </span>
                {signal}
              </li>
            ))}
          </ul>
        </div>
        <DemoForm heading={copy.ctaText} />
      </header>
      <main>
        <section
          id="treatments"
          aria-labelledby="treatments-heading"
          className="bg-primary/5 px-5 py-section"
        >
          <div className="mx-auto max-w-6xl">
            <SectionHead
              index={1}
              kicker="Care"
              title="Treatments and services"
              headingId="treatments-heading"
            />
            <div className="grid gap-5 md:grid-cols-2">
              {treatments.map((treatment) => (
                <div key={treatment.title} className="rounded-xl border border-text/10 bg-surface p-6">
                  <h3 className="text-lg font-semibold">{treatment.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-text/70">
                    {treatment.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
        <FeatureSections />
        <section id="about" aria-labelledby="about-heading" className="px-5 py-section">
          <div className="mx-auto grid max-w-6xl gap-9 md:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">About</p>
              <h2 id="about-heading" className="mt-2 text-3xl font-bold">
                About {business.name}
              </h2>
              <p className="mt-4 whitespace-pre-line text-base leading-relaxed text-text/70">
                {copy.about}
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold">What patients and visitors say</h3>
              <TestimonialCards />
            </div>
          </div>
        </section>
        <Faq />
        <section id="visit" aria-labelledby="visit-heading" className="bg-primary/5 px-5 py-section">
          <div className="mx-auto grid max-w-6xl gap-9 md:grid-cols-2">
            <div>
              <h2 id="visit-heading" className="text-3xl font-bold">
                Hours
              </h2>
              <div className="mt-5">
                <HoursList />
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold">Location</h2>
              <div className="mt-5">
                <MapEmbed />
              </div>
            </div>
          </div>
        </section>
        <section id="contact" aria-labelledby="contact-heading" className="px-5 py-section">
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="contact-heading" className="text-3xl font-bold">
              {copy.ctaText}
            </h2>
            <p className="mt-4 leading-relaxed text-text/70">{copy.contactSection}</p>
            <div className="mt-8 flex justify-center">
              <CtaButtons secondaryLabel={business.phone ?? "Call us"} center />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
`;

const CREATIVE_PORTFOLIO_TSX = `// Creative portfolio layout: oversized display headline with an accent rule
// and service chips, alternating gradient work rows, full-bleed dark CTA.
import {
  CtaButtons,
  FeatureSections,
  HoursList,
  MapEmbed,
  PullQuotes,
  SectionHead,
} from "@/components/Shared";
import { SITE } from "@/config/site";

const PANEL_CLASSES = [
  "bg-gradient-to-br from-primary to-secondary",
  "bg-gradient-to-br from-accent to-primary",
  "bg-gradient-to-br from-secondary to-accent",
  "bg-gradient-to-br from-primary to-accent",
];

export function CreativePortfolioPage() {
  const { business, copy } = SITE;
  const projects = (
    copy.highlightItems.length > 0 ? copy.highlightItems : copy.services
  ).slice(0, 4);
  return (
    <>
      <header className="mx-auto max-w-6xl px-5 py-section">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-text/60">
          {business.name}
          {" \\u2014 " + business.category}
          {business.area ? ", " + business.area : ""}
        </p>
        <h1 className="mt-5 max-w-4xl text-5xl font-bold leading-[1.05] tracking-tighter md:text-7xl">
          {copy.headline}
        </h1>
        <div aria-hidden="true" className="mt-6 h-1.5 w-16 bg-accent" />
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-text/70">{copy.subheadline}</p>
        <div className="mt-8">
          <CtaButtons />
        </div>
        <div className="mt-6 flex flex-wrap gap-2.5">
          {copy.services.slice(0, 6).map((service) => (
            <span
              key={service.title}
              className="rounded-full border border-text/70 px-4 py-1.5 text-sm font-semibold"
            >
              {service.title}
            </span>
          ))}
        </div>
      </header>
      <main>
        <section id="work" aria-labelledby="work-heading" className="px-5 pb-section">
          <div className="mx-auto max-w-6xl">
            <SectionHead
              index={1}
              kicker="What we make"
              title="Selected work and specialties"
              headingId="work-heading"
            />
            <div>
              {projects.map((project, index) => (
                <div
                  key={project.title}
                  className="grid items-center gap-7 border-t border-text/10 py-10 md:grid-cols-2"
                >
                  <div
                    role="img"
                    aria-label={
                      "Placeholder panel for " + project.title + " (replace with a real photo)"
                    }
                    className={
                      "flex aspect-[16/10] items-end rounded-xl p-5 " +
                      PANEL_CLASSES[index % PANEL_CLASSES.length] +
                      (index % 2 === 1 ? " md:order-2" : "")
                    }
                  >
                    <span className="text-xs font-bold uppercase tracking-widest text-white drop-shadow">
                      {project.title}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold tracking-tight md:text-3xl">
                      {project.title}
                    </h3>
                    <p className="mt-2 max-w-md leading-relaxed text-text/70">
                      {project.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <FeatureSections />
        <section
          id="about"
          aria-labelledby="about-heading"
          className="border-t border-text/10 px-5 py-section"
        >
          <div className="mx-auto max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Studio</p>
            <h2 id="about-heading" className="mt-2 text-3xl font-bold">
              About {business.name}
            </h2>
            <p className="mt-4 whitespace-pre-line leading-relaxed text-text/70">{copy.about}</p>
            <div className="mt-9">
              <PullQuotes />
            </div>
          </div>
        </section>
        <section
          id="contact"
          aria-labelledby="contact-heading"
          className="bg-text px-5 py-section text-background"
        >
          <div className="mx-auto max-w-6xl">
            <h2
              id="contact-heading"
              className="text-4xl font-bold tracking-tight text-background md:text-5xl"
            >
              {copy.ctaText}
            </h2>
            <p className="mt-4 max-w-xl leading-relaxed text-background/70">
              {copy.contactSection}
            </p>
            <div className="mt-8">
              <CtaButtons secondaryLabel={business.phone ?? "Call us"} onDark />
            </div>
          </div>
        </section>
        <section id="visit" aria-labelledby="visit-heading" className="px-5 py-section">
          <div className="mx-auto max-w-6xl">
            <h2 id="visit-heading" className="text-3xl font-bold">
              Find the studio
            </h2>
            <div className="mt-6 grid gap-9 md:grid-cols-2">
              <MapEmbed />
              <div>
                <h3 className="mb-2 text-lg font-semibold">Studio hours</h3>
                <HoursList />
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
`;

const PREMIUM_PROFESSIONAL_TSX = `// Premium professional layout (law firms, real estate, consultants): dark
// top nav with an accent consultation CTA, dark hero with a numbered
// practice-area index, review-themes strip, numbered practice rows, FAQ,
// dark consultation band with a demo form, then location and hours.
import {
  CtaButtons,
  DemoForm,
  Faq,
  FeatureSections,
  HoursList,
  MapEmbed,
  PullQuotes,
  SectionHead,
} from "@/components/Shared";
import { SITE } from "@/config/site";

export function PremiumProfessionalPage() {
  const { business, copy, links } = SITE;
  const areas = (
    copy.highlightItems.length > 0 ? copy.highlightItems : copy.services
  ).slice(0, 5);
  const themes = copy.whyChooseUs.slice(0, 3);
  return (
    <>
      <nav aria-label="Main" className="bg-secondary">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <a href="#top" className="font-heading text-lg font-bold tracking-wide text-white">
            {business.name}
          </a>
          <a
            href={links.whatsappUrl ?? links.telUrl ?? "#contact"}
            aria-label={links.whatsappUrl ? "Contact us on WhatsApp" : "Contact us"}
            className="group inline-flex items-center gap-2 rounded-btn bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {copy.ctaText}
            <span
              aria-hidden="true"
              className="inline-block transition-transform duration-200 group-hover:translate-x-1"
            >
              {"\\u2192"}
            </span>
          </a>
        </div>
      </nav>
      <header id="top" className="bg-secondary px-5 py-section text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-11 md:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
              {business.category}
              {business.area ? " \\u00B7 " + business.area : ""}
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-white md:text-5xl">
              {copy.headline}
            </h1>
            <p className="mt-4 max-w-lg text-lg leading-relaxed text-white/70">
              {copy.subheadline}
            </p>
            <div className="mt-8">
              <CtaButtons secondaryLabel="Call the office" onDark />
            </div>
            <p className="mt-3 text-xs text-white/50">Enquiries are confidential.</p>
          </div>
          <nav aria-label="Practice areas" className="border-l border-white/20 pl-7">
            {areas.map((area, index) => (
              <a
                key={area.title}
                href="#practice"
                className="flex items-baseline gap-4 border-b border-white/10 py-3.5 text-white transition-all last:border-b-0 hover:pl-2"
              >
                <span
                  aria-hidden="true"
                  className="text-xs font-bold tracking-widest text-accent"
                >
                  {"0" + (index + 1)}
                </span>
                <span className="font-heading text-lg">{area.title}</span>
              </a>
            ))}
          </nav>
        </div>
      </header>
      {themes.length > 0 ? (
        <div aria-label="What reviewers mention" className="border-b border-text/10 bg-surface">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-4 text-sm">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
              From the reviews
            </span>
            {themes.map((theme, index) => (
              <span key={theme} className="flex items-center gap-4 font-medium text-text/70">
                {index > 0 ? (
                  <span aria-hidden="true" className="text-primary/40">
                    {"\\u2022"}
                  </span>
                ) : null}
                {theme}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <main>
        <section id="practice" aria-labelledby="practice-heading" className="px-5 py-section">
          <div className="mx-auto max-w-6xl">
            <SectionHead
              index={1}
              kicker="Practice"
              title="Areas of work"
              headingId="practice-heading"
            />
            <div className="divide-y divide-text/10 border-y border-text/10">
              {areas.map((area, index) => (
                <div key={area.title} className="grid grid-cols-[56px_1fr] gap-5 py-6">
                  <span
                    aria-hidden="true"
                    className="pt-1.5 text-xs font-bold tracking-widest text-accent"
                  >
                    {"0" + (index + 1)}
                  </span>
                  <div>
                    <h3 className="text-xl font-semibold">{area.title}</h3>
                    <p className="mt-1 max-w-2xl text-[15px] leading-relaxed text-text/70">
                      {area.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <FeatureSections />
        <section id="about" aria-labelledby="about-heading" className="px-5 py-section">
          <div className="mx-auto max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">The firm</p>
            <h2 id="about-heading" className="mt-2 text-3xl font-bold">
              About {business.name}
            </h2>
            <p className="mt-4 whitespace-pre-line leading-relaxed text-text/70">{copy.about}</p>
            <div className="mt-9">
              <PullQuotes />
            </div>
          </div>
        </section>
        <Faq />
        <section
          id="contact"
          aria-labelledby="contact-heading"
          className="bg-secondary px-5 py-section text-white"
        >
          <div className="mx-auto grid max-w-6xl gap-9 md:grid-cols-2">
            <div>
              <h2 id="contact-heading" className="text-3xl font-bold text-white">
                {copy.ctaText}
              </h2>
              <p className="mt-4 leading-relaxed text-white/70">{copy.contactSection}</p>
              <div className="mt-7">
                <CtaButtons secondaryLabel={business.phone ?? "Call us"} onDark />
              </div>
            </div>
            <DemoForm heading="Request a consultation" />
          </div>
        </section>
        <section id="visit" aria-labelledby="visit-heading" className="px-5 py-section">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Office</p>
            <h2 id="visit-heading" className="mt-2 text-3xl font-bold">
              Location and hours
            </h2>
            <div className="mt-7 grid gap-9 md:grid-cols-2">
              <MapEmbed />
              <div className="self-start rounded-xl border border-text/10 bg-surface p-6">
                <h3 className="mb-2 text-lg font-semibold">Office hours</h3>
                <HoursList />
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
`;

const SIMPLE_LANDING_TSX = `// Simple local landing layout: narrow single column, giant contact actions,
// short about, tick service list, hours, and a map.
import {
  FeatureSections,
  HoursList,
  MapEmbed,
  TestimonialCards,
} from "@/components/Shared";
import { SITE } from "@/config/site";

export function SimpleLandingPage() {
  const { business, copy, links } = SITE;
  return (
    <div className="mx-auto max-w-xl px-5">
      <header className="py-section text-center">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
          {business.category}
          {business.area ? " \\u00B7 " + business.area : ""}
        </p>
        <h1 className="mt-3 text-3xl font-bold leading-tight md:text-4xl">{copy.headline}</h1>
        <p className="mt-3 leading-relaxed text-text/70">{copy.subheadline}</p>
        <div className="mt-7 grid gap-3">
          {links.telUrl ? (
            <a
              href={links.telUrl}
              aria-label="Call us by phone"
              className="block rounded-btn bg-primary px-6 py-4 text-center text-lg font-bold text-white shadow-lg transition hover:opacity-90"
            >
              Call {business.phone ?? "us"}
            </a>
          ) : null}
          {links.whatsappUrl ? (
            <a
              href={links.whatsappUrl}
              aria-label="Message us on WhatsApp"
              className="group flex items-center justify-center gap-2.5 rounded-btn bg-[#16a34a] px-6 py-4 text-center text-lg font-bold text-white transition hover:opacity-90"
            >
              {copy.ctaText}
              <span
                aria-hidden="true"
                className="inline-block transition-transform duration-200 group-hover:translate-x-1"
              >
                {"\\u2192"}
              </span>
            </a>
          ) : null}
          {links.mapsUrl ? (
            <a
              href={links.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Get directions on Google Maps"
              className="block rounded-btn border-2 border-text px-6 py-4 text-center text-lg font-bold transition hover:bg-text/5"
            >
              Get directions
            </a>
          ) : null}
        </div>
      </header>
      <main>
        <section id="about" aria-labelledby="about-heading" className="border-t border-text/10 py-10">
          <h2 id="about-heading" className="text-2xl font-bold">
            About {business.name}
          </h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-text/70">
            {copy.about}
          </p>
        </section>
        <section
          id="services"
          aria-labelledby="services-heading"
          className="border-t border-text/10 py-10"
        >
          <h2 id="services-heading" className="text-2xl font-bold">
            Services
          </h2>
          <ul className="mt-4">
            {copy.services.slice(0, 5).map((service) => (
              <li
                key={service.title}
                className="flex items-start gap-3 border-b border-text/10 py-3 last:border-b-0"
              >
                <span aria-hidden="true" className="font-bold text-primary">
                  {"\\u2713"}
                </span>
                <span>
                  <span className="block font-semibold">{service.title}</span>
                  <span className="text-sm text-text/60">{service.description}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
        {copy.testimonials.length > 0 ? (
          <section
            id="reviews"
            aria-labelledby="reviews-heading"
            className="border-t border-text/10 py-10"
          >
            <h2 id="reviews-heading" className="text-2xl font-bold">
              What customers say
            </h2>
            <TestimonialCards />
          </section>
        ) : null}
        <FeatureSections />
        <section id="hours" aria-labelledby="hours-heading" className="border-t border-text/10 py-10">
          <h2 id="hours-heading" className="text-2xl font-bold">
            Opening hours
          </h2>
          <div className="mt-3">
            <HoursList />
          </div>
        </section>
        <section id="visit" aria-labelledby="visit-heading" className="border-t border-text/10 py-10">
          <h2 id="visit-heading" className="text-2xl font-bold">
            Find us
          </h2>
          <div className="mt-3">
            <MapEmbed />
          </div>
        </section>
      </main>
    </div>
  );
}
`;

interface LayoutModule {
  /** Project-relative path of the layout component file. */
  file: string;
  /** Exported component name. */
  component: string;
  /** Import specifier used by page.tsx. */
  importPath: string;
  /** File contents. */
  source: string;
}

const LAYOUT_MODULES: Record<LayoutType, LayoutModule> = {
  "premium-service": {
    file: "src/components/layouts/PremiumService.tsx",
    component: "PremiumServicePage",
    importPath: "@/components/layouts/PremiumService",
    source: PREMIUM_SERVICE_TSX,
  },
  "local-practical": {
    file: "src/components/layouts/LocalPractical.tsx",
    component: "LocalPracticalPage",
    importPath: "@/components/layouts/LocalPractical",
    source: LOCAL_PRACTICAL_TSX,
  },
  hospitality: {
    file: "src/components/layouts/Hospitality.tsx",
    component: "HospitalityPage",
    importPath: "@/components/layouts/Hospitality",
    source: HOSPITALITY_TSX,
  },
  "wellness-clinic": {
    file: "src/components/layouts/WellnessClinic.tsx",
    component: "WellnessClinicPage",
    importPath: "@/components/layouts/WellnessClinic",
    source: WELLNESS_CLINIC_TSX,
  },
  "creative-portfolio": {
    file: "src/components/layouts/CreativePortfolio.tsx",
    component: "CreativePortfolioPage",
    importPath: "@/components/layouts/CreativePortfolio",
    source: CREATIVE_PORTFOLIO_TSX,
  },
  "premium-professional": {
    file: "src/components/layouts/PremiumProfessional.tsx",
    component: "PremiumProfessionalPage",
    importPath: "@/components/layouts/PremiumProfessional",
    source: PREMIUM_PROFESSIONAL_TSX,
  },
  "simple-landing": {
    file: "src/components/layouts/SimpleLanding.tsx",
    component: "SimpleLandingPage",
    importPath: "@/components/layouts/SimpleLanding",
    source: SIMPLE_LANDING_TSX,
  },
};

/**
 * page.tsx: static concept-draft ribbon + the selected layout page + shared
 * footer (with the full disclaimer bar) + the mobile sticky contact bar
 * (renders null when no phone links exist).
 */
function buildPageTsx(mod: LayoutModule, production: boolean): string {
  const bannerImport = production
    ? ""
    : `import { DraftBanner } from "@/components/DraftBanner";\n`;
  const banner = production ? "" : `      <DraftBanner />\n`;
  return `${bannerImport}import { StickyContactBar } from "@/components/Shared";
import { SiteFooter } from "@/components/SiteFooter";
import { ${mod.component} } from "${mod.importPath}";

export default function HomePage() {
  return (
    <>
${banner}      <${mod.component} />
      <SiteFooter />
      <StickyContactBar />
    </>
  );
}
`;
}
