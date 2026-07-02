// Generates a complete, runnable Next.js 14 + Tailwind project for a business
// as a Record<filePath, fileContent>. The result is stored JSON-encoded in
// GeneratedWebsite.generatedCode and zipped for download via zip.ts.
//
// Safety model: every generated source file is a fixed string with NO user
// text interpolated into JSX/TSX literals. All business data and AI copy is
// injected exclusively through the typed SITE object in src/config/site.ts,
// serialized with JSON.stringify, so the components are fully data-driven and
// immune to injection through business names, reviews, or AI output.

import type { PreviewInput } from "./preview-html";
import { normalizePhone, whatsappLink } from "@/lib/utils";

const DISCLAIMER =
  "DRAFT WEBSITE CONCEPT — generated from public Google Maps data; not the official website of this business";

/** Normalize an AI-provided color to #RRGGBB, with a fallback. */
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

export function buildNextJsProject(input: PreviewInput): Record<string, string> {
  const { business, copy } = input;

  const colors = {
    primary: safeHex(copy.color_palette?.primary, "#0f766e"),
    secondary: safeHex(copy.color_palette?.secondary, "#134e4a"),
    accent: safeHex(copy.color_palette?.accent, "#f59e0b"),
    background: safeHex(copy.color_palette?.background, "#fafaf9"),
  };

  const phone = business.phone ? normalizePhone(business.phone) : "";
  const telUrl = phone ? `tel:${phone}` : null;
  const whatsappUrl = business.phone
    ? whatsappLink(business.phone, copy.whatsapp_message || `Hi ${business.name}!`)
    : null;
  const mapQuery = encodeURIComponent(
    [business.name, business.address].filter(Boolean).join(" ")
  );

  const site = {
    business: {
      name: business.name,
      category: business.category,
      area: business.area,
      address: business.address,
      phone: business.phone,
      googleMapsUrl: safeHttpUrl(business.googleMapsUrl),
      openingHours: asArray(business.openingHours),
      rating: business.rating,
      reviewCount: business.reviewCount,
    },
    copy: {
      websiteName: copy.website_name || business.name,
      headline: copy.headline || business.name,
      subheadline: copy.subheadline ?? "",
      ctaText: copy.cta_text || "Contact us",
      about: copy.about_section ?? "",
      services: asArray(copy.services),
      whyChooseUs: asArray(copy.why_choose_us),
      testimonials: asArray(copy.testimonials),
      contactSection: copy.contact_section ?? "",
      seoTitle: copy.seo_title || business.name,
      seoMetaDescription: copy.seo_meta_description ?? "",
      fontRecommendation: copy.font_recommendation ?? "",
      imageRecommendations: asArray(copy.image_recommendations),
      whatsappMessage: copy.whatsapp_message ?? "",
      bookingFormFields: asArray(copy.booking_form_fields),
    },
    colors,
    links: {
      whatsappUrl,
      telUrl,
      mapsUrl: safeHttpUrl(business.googleMapsUrl),
      mapEmbedUrl: `https://www.google.com/maps?q=${mapQuery}&output=embed`,
    },
    disclaimer: DISCLAIMER,
  };

  return {
    "package.json": buildPackageJson(business.name),
    "next.config.mjs": NEXT_CONFIG,
    "tsconfig.json": TSCONFIG,
    "postcss.config.js": POSTCSS_CONFIG,
    "tailwind.config.ts": buildTailwindConfig(colors),
    "README.md": buildReadme(business.name),
    "src/app/globals.css": GLOBALS_CSS,
    "src/app/layout.tsx": LAYOUT_TSX,
    "src/app/page.tsx": PAGE_TSX,
    "src/config/site.ts": buildSiteConfig(site),
    "src/components/DraftBanner.tsx": DRAFT_BANNER_TSX,
    "src/components/Hero.tsx": HERO_TSX,
    "src/components/About.tsx": ABOUT_TSX,
    "src/components/Services.tsx": SERVICES_TSX,
    "src/components/WhyUs.tsx": WHY_US_TSX,
    "src/components/Testimonials.tsx": TESTIMONIALS_TSX,
    "src/components/Hours.tsx": HOURS_TSX,
    "src/components/LocationMap.tsx": LOCATION_MAP_TSX,
    "src/components/ContactCta.tsx": CONTACT_CTA_TSX,
  };
}

// ---------------------------------------------------------------------------
// Data-driven files (business data injected via JSON.stringify only)
// ---------------------------------------------------------------------------

function buildPackageJson(businessName: string): string {
  const pkg = {
    name: slugify(businessName),
    version: "0.1.0",
    private: true,
    description:
      "Draft website concept generated from public Google Maps data. Not for publication without the business owner's approval.",
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

function buildTailwindConfig(colors: {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}): string {
  return `import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: ${JSON.stringify(colors.primary)},
        secondary: ${JSON.stringify(colors.secondary)},
        accent: ${JSON.stringify(colors.accent)},
        background: ${JSON.stringify(colors.background)},
      },
    },
  },
  plugins: [],
};

export default config;
`;
}

interface SiteConfigData {
  business: {
    name: string;
    category: string;
    area: string | null;
    address: string | null;
    phone: string | null;
    googleMapsUrl: string | null;
    openingHours: string[];
    rating: number | null;
    reviewCount: number;
  };
  copy: {
    websiteName: string;
    headline: string;
    subheadline: string;
    ctaText: string;
    about: string;
    services: { title: string; description: string }[];
    whyChooseUs: string[];
    testimonials: string[];
    contactSection: string;
    seoTitle: string;
    seoMetaDescription: string;
    fontRecommendation: string;
    imageRecommendations: string[];
    whatsappMessage: string;
    bookingFormFields: string[];
  };
  colors: { primary: string; secondary: string; accent: string; background: string };
  links: {
    whatsappUrl: string | null;
    telUrl: string | null;
    mapsUrl: string | null;
    mapEmbedUrl: string;
  };
  disclaimer: string;
}

function buildSiteConfig(site: SiteConfigData): string {
  return `// Auto-generated site configuration.
// ALL page content is driven by this object — edit values here to update the
// site. Generated from the business's public Google Maps profile data.

export interface SiteService {
  title: string;
  description: string;
}

export interface SiteConfig {
  business: {
    name: string;
    category: string;
    area: string | null;
    address: string | null;
    phone: string | null;
    googleMapsUrl: string | null;
    openingHours: string[];
    rating: number | null;
    reviewCount: number;
  };
  copy: {
    websiteName: string;
    headline: string;
    subheadline: string;
    ctaText: string;
    about: string;
    services: SiteService[];
    whyChooseUs: string[];
    testimonials: string[];
    contactSection: string;
    seoTitle: string;
    seoMetaDescription: string;
    fontRecommendation: string;
    imageRecommendations: string[];
    whatsappMessage: string;
    bookingFormFields: string[];
  };
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };
  links: {
    whatsappUrl: string | null;
    telUrl: string | null;
    mapsUrl: string | null;
    mapEmbedUrl: string;
  };
  disclaimer: string;
}

export const SITE: SiteConfig = ${JSON.stringify(site, null, 2)};
`;
}

function buildReadme(businessName: string): string {
  const safeName = businessName.replace(/[\r\n]+/g, " ").trim();
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

## Editing content

All text, colors, and contact links live in a single typed config object:
\`src/config/site.ts\`. The components in \`src/components/\` are fully
data-driven from that file, so most changes only require editing \`SITE\`.

Theme colors (primary / secondary / accent / background) are wired into
Tailwind in \`tailwind.config.ts\`.

## Notes

- The booking form is a **non-functional demo** (submit is disabled).
- The map is embedded via a keyless Google Maps embed URL.
- Fonts use a system font stack (no external font downloads).
- A fixed draft-disclaimer banner is rendered on every page; remove
  \`DraftBanner\` only after the business owner approves the site.
`;
}

// ---------------------------------------------------------------------------
// Static files (no interpolated user data)
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

const GLOBALS_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
}
`;

const LAYOUT_TSX = `/*
 * DRAFT WEBSITE CONCEPT — generated from public Google Maps profile data as a
 * demo for the business owner. Not the official website of this business.
 * Do NOT publish without the business owner's explicit approval.
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SITE } from "@/config/site";
import "./globals.css";

export const metadata: Metadata = {
  title: SITE.copy.seoTitle,
  description: SITE.copy.seoMetaDescription,
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-slate-900 antialiased">{children}</body>
    </html>
  );
}
`;

const PAGE_TSX = `import { About } from "@/components/About";
import { ContactCta } from "@/components/ContactCta";
import { DraftBanner } from "@/components/DraftBanner";
import { Hero } from "@/components/Hero";
import { Hours } from "@/components/Hours";
import { LocationMap } from "@/components/LocationMap";
import { Services } from "@/components/Services";
import { Testimonials } from "@/components/Testimonials";
import { WhyUs } from "@/components/WhyUs";
import { SITE } from "@/config/site";

export default function HomePage() {
  return (
    <>
      <DraftBanner />
      <Hero />
      <main>
        <About />
        <Services />
        <WhyUs />
        <Testimonials />
        <Hours />
        <LocationMap />
        <ContactCta />
      </main>
      <footer className="border-t border-slate-200 bg-white px-4 py-10">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-base font-semibold">
            {SITE.business.name}
            {SITE.business.area ? " \\u00B7 " + SITE.business.area : ""}
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-xs leading-relaxed text-slate-500">
            {SITE.disclaimer}
          </p>
        </div>
      </footer>
    </>
  );
}
`;

const DRAFT_BANNER_TSX = `import { SITE } from "@/config/site";

export function DraftBanner() {
  return (
    <div
      role="note"
      className="fixed inset-x-0 top-0 z-50 bg-amber-400 px-4 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-amber-950 shadow"
    >
      {SITE.disclaimer}
    </div>
  );
}
`;

const HERO_TSX = `import { SITE } from "@/config/site";

export function Hero() {
  const { business, copy, links } = SITE;
  const primaryHref = links.whatsappUrl ?? links.telUrl ?? "#contact";
  return (
    <header className="bg-gradient-to-br from-primary/20 via-background to-secondary/10 px-4 pb-16 pt-24 md:pb-24 md:pt-28">
      <div className="mx-auto max-w-6xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          {business.category}
          {business.area ? " \\u00B7 " + business.area : ""}
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
          {copy.headline}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
          {copy.subheadline}
        </p>
        {/* Google rating/review count intentionally not republished here —
            see the COMPLIANCE notes in the dashboard project. */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <a
            href={primaryHref}
            aria-label={links.whatsappUrl ? "Contact us on WhatsApp" : "Contact us"}
            className="rounded-lg bg-primary px-7 py-3 text-base font-semibold text-white shadow-lg transition hover:opacity-90"
          >
            {copy.ctaText}
          </a>
          {links.telUrl && (
            <a
              href={links.telUrl}
              aria-label="Call us by phone"
              className="rounded-lg border-2 border-primary bg-white/80 px-7 py-3 text-base font-semibold text-primary transition hover:bg-white"
            >
              Call us
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
`;

const ABOUT_TSX = `import { SITE } from "@/config/site";

export function About() {
  const { business, copy } = SITE;
  return (
    <section id="about" aria-labelledby="about-heading" className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <h2 id="about-heading" className="text-3xl font-bold">
          About {business.name}
        </h2>
        <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-700">{copy.about}</p>
        {copy.imageRecommendations.length > 0 && (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
            {copy.imageRecommendations.slice(0, 3).map((idea) => (
              <figure key={idea} className="flex flex-col gap-2">
                <div
                  role="img"
                  aria-label={"Image placeholder: " + idea}
                  className="aspect-video w-full rounded-lg bg-gradient-to-br from-primary/40 to-accent/30"
                />
                <figcaption className="text-xs text-slate-500">Suggested image: {idea}</figcaption>
              </figure>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
`;

const SERVICES_TSX = `import { SITE } from "@/config/site";

export function Services() {
  return (
    <section id="services" aria-labelledby="services-heading" className="bg-primary/5 px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <h2 id="services-heading" className="text-3xl font-bold">
          Our services
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {SITE.copy.services.map((service) => (
            <div key={service.title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold">{service.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{service.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
`;

const WHY_US_TSX = `import { SITE } from "@/config/site";

export function WhyUs() {
  return (
    <section id="why-us" aria-labelledby="why-us-heading" className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <h2 id="why-us-heading" className="text-3xl font-bold">
          Why choose us
        </h2>
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {SITE.copy.whyChooseUs.map((reason) => (
            <li key={reason} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white"
              >
                {"\\u2713"}
              </span>
              <span className="text-slate-700">{reason}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
`;

const TESTIMONIALS_TSX = `import { SITE } from "@/config/site";

export function Testimonials() {
  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-heading"
      className="bg-secondary/5 px-4 py-16"
    >
      <div className="mx-auto max-w-6xl">
        <h2 id="testimonials-heading" className="text-3xl font-bold">
          What customers say
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {SITE.copy.testimonials.map((quote) => (
            <blockquote key={quote} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <span aria-hidden="true" className="font-serif text-4xl leading-none text-primary">
                {"\\u201C"}
              </span>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{quote}</p>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
`;

const HOURS_TSX = `import { SITE } from "@/config/site";

export function Hours() {
  const hours = SITE.business.openingHours;
  return (
    <section id="hours" aria-labelledby="hours-heading" className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <h2 id="hours-heading" className="text-3xl font-bold">
          Opening hours
        </h2>
        <ul className="mt-6 max-w-xl rounded-lg border border-slate-200 bg-white px-6 py-4 shadow-sm">
          {hours.length > 0 ? (
            hours.map((line) => (
              <li
                key={line}
                className="border-b border-slate-100 py-2 text-sm text-slate-700 last:border-b-0"
              >
                {line}
              </li>
            ))
          ) : (
            <li className="py-2 text-sm text-slate-600">Contact us for current opening hours.</li>
          )}
        </ul>
      </div>
    </section>
  );
}
`;

const LOCATION_MAP_TSX = `import { SITE } from "@/config/site";

export function LocationMap() {
  const { business, links } = SITE;
  return (
    <section id="location" aria-labelledby="location-heading" className="px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <h2 id="location-heading" className="text-3xl font-bold">
          Find us
        </h2>
        <div className="mt-6 grid gap-8 md:grid-cols-2">
          <div>
            {business.address ? (
              <p className="text-base leading-relaxed text-slate-700">{business.address}</p>
            ) : (
              <p className="text-base text-slate-600">Located in {business.area ?? "Dubai"}.</p>
            )}
            {links.mapsUrl && (
              <a
                href={links.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={"Open " + business.name + " on Google Maps"}
                className="mt-4 inline-block font-semibold text-primary underline underline-offset-4"
              >
                View on Google Maps
              </a>
            )}
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm">
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
      </div>
    </section>
  );
}
`;

const CONTACT_CTA_TSX = `import { SITE } from "@/config/site";

export function ContactCta() {
  const { business, copy, links } = SITE;
  return (
    <section
      id="contact"
      aria-labelledby="contact-heading"
      className="bg-gradient-to-br from-primary/15 to-accent/10 px-4 py-16"
    >
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-2">
        <div>
          <h2 id="contact-heading" className="text-3xl font-bold">
            Get in touch
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-700">
            {copy.contactSection}
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            {links.whatsappUrl && (
              <a
                href={links.whatsappUrl}
                aria-label="Message us on WhatsApp"
                className="rounded-lg bg-primary px-6 py-3 font-semibold text-white shadow transition hover:opacity-90"
              >
                WhatsApp us
              </a>
            )}
            {links.telUrl && (
              <a
                href={links.telUrl}
                aria-label="Call us by phone"
                className="rounded-lg border-2 border-primary px-6 py-3 font-semibold text-primary transition hover:bg-primary/5"
              >
                {business.phone ?? "Call us"}
              </a>
            )}
          </div>
        </div>
        <form className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm" aria-label="Demo booking form">
          <h3 className="text-lg font-semibold">Request a booking</h3>
          <div className="mt-4 flex flex-col gap-4">
            {copy.bookingFormFields.map((label, index) => {
              const id = "booking-field-" + index;
              return (
                <div key={id} className="flex flex-col gap-1">
                  <label htmlFor={id} className="text-sm font-medium text-slate-700">
                    {label}
                  </label>
                  <input
                    id={id}
                    type="text"
                    placeholder={label}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              );
            })}
          </div>
          <button
            type="submit"
            disabled
            className="mt-6 w-full cursor-not-allowed rounded-lg bg-slate-300 px-6 py-3 font-semibold text-slate-600"
          >
            Demo form
          </button>
          <p className="mt-2 text-center text-xs text-slate-500">This form is a non-functional demo.</p>
        </form>
      </div>
    </section>
  );
}
`;
