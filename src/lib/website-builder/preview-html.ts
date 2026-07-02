// Self-contained single-file HTML preview of a generated draft website.
// The output is stored in GeneratedWebsite.previewHtml and rendered in an
// iframe inside the dashboard. Everything interpolated from business data or
// AI copy is escaped via escapeHtml; palette hexes are sanitized separately
// because they are injected into an inline <script> (Tailwind CDN config).

import type { WebsiteCopyJson } from "@/lib/types";
import { normalizePhone, whatsappLink } from "@/lib/utils";

export interface PreviewInput {
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
  copy: WebsiteCopyJson;
}

const DISCLAIMER =
  "DRAFT WEBSITE CONCEPT — generated from public Google Maps data; not the official website of this business";

/** Escape a value for safe interpolation into HTML text or attributes. */
function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Normalize an AI-provided color to a #RRGGBB hex, falling back when the
 * value is not a plain hex color. Prevents script/style injection through
 * the palette (these values are placed inside an inline <script> tag).
 */
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

/** Append a hex alpha channel to a #RRGGBB color (for soft gradients). */
function withAlpha(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

/** Only allow http(s) URLs into href attributes. */
function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

export function buildPreviewHtml(input: PreviewInput): string {
  const { business, copy } = input;

  const primary = safeHex(copy.color_palette?.primary, "#0f766e");
  const secondary = safeHex(copy.color_palette?.secondary, "#134e4a");
  const accent = safeHex(copy.color_palette?.accent, "#f59e0b");
  const background = safeHex(copy.color_palette?.background, "#fafaf9");

  const phone = business.phone ? normalizePhone(business.phone) : "";
  const telHref = phone ? `tel:${phone}` : null;
  const waHref = business.phone
    ? whatsappLink(business.phone, copy.whatsapp_message || `Hi ${business.name}!`)
    : null;
  const primaryCtaHref = waHref ?? telHref ?? "#contact";

  const mapsUrl = safeHttpUrl(business.googleMapsUrl);
  const mapQuery = encodeURIComponent(
    [business.name, business.address].filter(Boolean).join(" ")
  );
  const mapEmbedSrc = `https://www.google.com/maps?q=${mapQuery}&output=embed`;

  const services = asArray(copy.services);
  const whyUs = asArray(copy.why_choose_us);
  const testimonials = asArray(copy.testimonials);
  const hours = asArray(business.openingHours);
  const formFields = asArray(copy.booking_form_fields);
  const imageIdeas = asArray(copy.image_recommendations);

  const name = escapeHtml(business.name);
  const areaSuffix = business.area ? ` · ${escapeHtml(business.area)}` : "";

  const ratingLine =
    business.rating !== null
      ? `<p class="mt-4 text-sm font-medium text-gray-600">
          <span aria-hidden="true">★</span> Rated ${escapeHtml(
            business.rating.toFixed(1)
          )} from ${escapeHtml(business.reviewCount)} Google reviews</p>`
      : "";

  const heroButtons = `
    <div class="mt-8 flex flex-wrap items-center justify-center gap-4">
      <a href="${escapeHtml(primaryCtaHref)}"
         class="rounded-lg bg-primary px-7 py-3 text-base font-semibold text-white shadow-lg transition hover:opacity-90"
         aria-label="${waHref ? "Contact us on WhatsApp" : "Contact us"}">${escapeHtml(
           copy.cta_text || "Contact us"
         )}</a>
      ${
        telHref
          ? `<a href="${escapeHtml(telHref)}"
         class="rounded-lg border-2 border-primary bg-white/80 px-7 py-3 text-base font-semibold text-primary transition hover:bg-white"
         aria-label="Call ${name} by phone">Call us</a>`
          : ""
      }
    </div>`;

  const imagePlaceholders = imageIdeas
    .slice(0, 3)
    .map(
      (idea) => `
        <figure class="flex flex-col gap-2">
          <div class="aspect-video w-full rounded-lg"
               style="background: linear-gradient(135deg, ${withAlpha(primary, "59")}, ${withAlpha(accent, "40")});"
               role="img" aria-label="Image placeholder: ${escapeHtml(idea)}"></div>
          <figcaption class="text-xs text-gray-500">Suggested image: ${escapeHtml(idea)}</figcaption>
        </figure>`
    )
    .join("\n");

  const servicesCards = services
    .map(
      (service) => `
        <div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 class="text-lg font-semibold text-gray-900">${escapeHtml(service.title)}</h3>
          <p class="mt-2 text-sm leading-relaxed text-gray-600">${escapeHtml(service.description)}</p>
        </div>`
    )
    .join("\n");

  const whyUsItems = whyUs
    .map(
      (reason) => `
        <li class="flex items-start gap-3">
          <span class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white" aria-hidden="true">✓</span>
          <span class="text-gray-700">${escapeHtml(reason)}</span>
        </li>`
    )
    .join("\n");

  const testimonialCards = testimonials
    .map(
      (quote) => `
        <blockquote class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <span class="text-4xl font-serif leading-none text-primary" aria-hidden="true">&ldquo;</span>
          <p class="mt-2 text-sm leading-relaxed text-gray-700">${escapeHtml(quote)}</p>
        </blockquote>`
    )
    .join("\n");

  const hoursRows =
    hours.length > 0
      ? hours
          .map(
            (line) =>
              `<li class="flex justify-between gap-6 border-b border-gray-100 py-2 text-sm text-gray-700 last:border-b-0">${escapeHtml(line)}</li>`
          )
          .join("\n")
      : `<li class="py-2 text-sm text-gray-600">Contact us for current opening hours.</li>`;

  const formFieldsHtml = formFields
    .map((label, index) => {
      const id = `booking-field-${index}`;
      const isLong = /message|detail|request|note/i.test(label);
      const control = isLong
        ? `<textarea id="${id}" rows="3" placeholder="${escapeHtml(label)}"
              class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"></textarea>`
        : `<input id="${id}" type="text" placeholder="${escapeHtml(label)}"
              class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary" />`;
      return `
        <div class="flex flex-col gap-1">
          <label for="${id}" class="text-sm font-medium text-gray-700">${escapeHtml(label)}</label>
          ${control}
        </div>`;
    })
    .join("\n");

  const contactButtons = `
    <div class="flex flex-wrap gap-4">
      ${
        waHref
          ? `<a href="${escapeHtml(waHref)}"
           class="rounded-lg bg-primary px-6 py-3 font-semibold text-white shadow transition hover:opacity-90"
           aria-label="Message ${name} on WhatsApp">WhatsApp us</a>`
          : ""
      }
      ${
        telHref
          ? `<a href="${escapeHtml(telHref)}"
           class="rounded-lg border-2 border-primary px-6 py-3 font-semibold text-primary transition hover:bg-primary/5"
           aria-label="Call ${name} by phone">${escapeHtml(business.phone ?? "Call us")}</a>`
          : ""
      }
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(copy.seo_title || business.name)}</title>
  <meta name="description" content="${escapeHtml(copy.seo_meta_description || "")}" />
  <meta name="robots" content="noindex, nofollow" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: "${primary}",
            secondary: "${secondary}",
            accent: "${accent}",
            surface: "${background}"
          }
        }
      }
    };
  </script>
  <style>
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
        "Helvetica Neue", Arial, sans-serif;
      background-color: ${background};
    }
  </style>
</head>
<body class="text-gray-900 antialiased">

  <!-- Always-visible draft disclaimer banner -->
  <div class="fixed inset-x-0 top-0 z-50 bg-amber-400 px-4 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-amber-950 shadow" role="note">
    ${escapeHtml(DISCLAIMER)}
  </div>

  <!-- Hero -->
  <header class="px-4 pb-16 pt-24 md:pb-24 md:pt-28"
          style="background: linear-gradient(150deg, ${withAlpha(primary, "2e")} 0%, ${withAlpha(secondary, "1a")} 45%, ${background} 100%);">
    <div class="mx-auto max-w-6xl text-center">
      <p class="text-sm font-semibold uppercase tracking-widest text-primary">${escapeHtml(
        business.category
      )}${areaSuffix}</p>
      <h1 class="mt-4 text-4xl font-bold leading-tight tracking-tight text-gray-900 md:text-5xl">${escapeHtml(
        copy.headline || business.name
      )}</h1>
      <p class="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-600">${escapeHtml(
        copy.subheadline
      )}</p>
      ${ratingLine}
      ${heroButtons}
    </div>
  </header>

  <main>
    <!-- About -->
    <section id="about" class="px-4 py-16" aria-labelledby="about-heading">
      <div class="mx-auto max-w-6xl">
        <h2 id="about-heading" class="text-3xl font-bold text-gray-900">About ${name}</h2>
        <p class="mt-5 max-w-3xl text-base leading-relaxed text-gray-700">${escapeHtml(
          copy.about_section
        )}</p>
        ${
          imagePlaceholders
            ? `<div class="mt-10 grid gap-6 sm:grid-cols-2 md:grid-cols-3">${imagePlaceholders}</div>`
            : ""
        }
      </div>
    </section>

    <!-- Services -->
    <section id="services" class="px-4 py-16" style="background-color: ${withAlpha(primary, "0d")};" aria-labelledby="services-heading">
      <div class="mx-auto max-w-6xl">
        <h2 id="services-heading" class="text-3xl font-bold text-gray-900">Our services</h2>
        <div class="mt-8 grid gap-6 md:grid-cols-3">
          ${servicesCards}
        </div>
      </div>
    </section>

    <!-- Why choose us -->
    <section id="why-us" class="px-4 py-16" aria-labelledby="why-us-heading">
      <div class="mx-auto max-w-6xl">
        <h2 id="why-us-heading" class="text-3xl font-bold text-gray-900">Why choose us</h2>
        <ul class="mt-8 grid gap-4 md:grid-cols-2">
          ${whyUsItems}
        </ul>
      </div>
    </section>

    <!-- Testimonials -->
    <section id="testimonials" class="px-4 py-16" style="background-color: ${withAlpha(secondary, "0d")};" aria-labelledby="testimonials-heading">
      <div class="mx-auto max-w-6xl">
        <h2 id="testimonials-heading" class="text-3xl font-bold text-gray-900">What customers say</h2>
        <div class="mt-8 grid gap-6 md:grid-cols-3">
          ${testimonialCards}
        </div>
      </div>
    </section>

    <!-- Opening hours -->
    <section id="hours" class="px-4 py-16" aria-labelledby="hours-heading">
      <div class="mx-auto max-w-6xl">
        <h2 id="hours-heading" class="text-3xl font-bold text-gray-900">Opening hours</h2>
        <ul class="mt-6 max-w-xl rounded-lg border border-gray-200 bg-white px-6 py-4 shadow-sm">
          ${hoursRows}
        </ul>
      </div>
    </section>

    <!-- Location -->
    <section id="location" class="px-4 py-16" aria-labelledby="location-heading">
      <div class="mx-auto max-w-6xl">
        <h2 id="location-heading" class="text-3xl font-bold text-gray-900">Find us</h2>
        <div class="mt-6 grid gap-8 md:grid-cols-2">
          <div>
            ${
              business.address
                ? `<p class="text-base leading-relaxed text-gray-700">${escapeHtml(business.address)}</p>`
                : `<p class="text-base text-gray-600">Located in ${escapeHtml(business.area ?? "Dubai")}.</p>`
            }
            ${
              mapsUrl
                ? `<a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener noreferrer"
                 class="mt-4 inline-block font-semibold text-primary underline underline-offset-4"
                 aria-label="Open ${name} on Google Maps">View on Google Maps</a>`
                : ""
            }
          </div>
          <div class="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
            <iframe src="${escapeHtml(mapEmbedSrc)}" title="Map showing the location of ${name}"
                    class="h-72 w-full" style="border:0" loading="lazy"
                    referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
          </div>
        </div>
      </div>
    </section>

    <!-- Contact / CTA -->
    <section id="contact" class="px-4 py-16"
             style="background: linear-gradient(150deg, ${withAlpha(primary, "1f")} 0%, ${withAlpha(accent, "14")} 100%);"
             aria-labelledby="contact-heading">
      <div class="mx-auto grid max-w-6xl gap-10 md:grid-cols-2">
        <div>
          <h2 id="contact-heading" class="text-3xl font-bold text-gray-900">Get in touch</h2>
          <p class="mt-4 max-w-xl text-base leading-relaxed text-gray-700">${escapeHtml(
            copy.contact_section
          )}</p>
          <div class="mt-8">
            ${contactButtons}
          </div>
        </div>
        <form class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm" aria-label="Demo booking form" onsubmit="return false;">
          <h3 class="text-lg font-semibold text-gray-900">Request a booking</h3>
          <div class="mt-4 flex flex-col gap-4">
            ${formFieldsHtml}
          </div>
          <button type="submit" disabled
                  class="mt-6 w-full cursor-not-allowed rounded-lg bg-gray-300 px-6 py-3 font-semibold text-gray-600">
            Demo form
          </button>
          <p class="mt-2 text-center text-xs text-gray-500">This form is a non-functional demo.</p>
        </form>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="border-t border-gray-200 bg-white px-4 py-10">
    <div class="mx-auto max-w-6xl text-center">
      <p class="text-base font-semibold text-gray-900">${name}${areaSuffix}</p>
      <p class="mx-auto mt-3 max-w-2xl text-xs leading-relaxed text-gray-500">${escapeHtml(
        DISCLAIMER
      )}</p>
    </div>
  </footer>

</body>
</html>`;
}
