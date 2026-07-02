// Self-contained single-file HTML preview of a generated draft website.
// The output is stored in GeneratedWebsite.previewHtml and rendered in an
// iframe inside the dashboard. It embeds ALL of its CSS inline (no CDN or
// network dependency) so the draft renders identically offline, in emails,
// or when saved as a file. Everything interpolated from business data or AI
// copy is escaped via escapeHtml; palette hexes are sanitized separately
// because they are injected into inline CSS.

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
 * value is not a plain hex color. Prevents style injection through the
 * palette (these values are placed inside an inline <style> tag).
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

/** Append a hex alpha channel to a #RRGGBB color (for soft tints). */
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

function buildStylesheet(palette: {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}): string {
  const { primary, secondary, accent, background } = palette;
  return `
    :root {
      --primary: ${primary};
      --secondary: ${secondary};
      --accent: ${accent};
      --bg: ${background};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
        "Helvetica Neue", Arial, sans-serif;
      background-color: var(--bg);
      color: #1c1c1c;
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }
    img, iframe { max-width: 100%; }
    a { color: var(--primary); }

    .draft-banner {
      position: fixed; inset: 0 0 auto 0; z-index: 50;
      background: #fbbf24; color: #451a03;
      padding: 6px 16px; text-align: center;
      font-size: 11px; font-weight: 700; letter-spacing: 0.05em;
      text-transform: uppercase;
      box-shadow: 0 1px 4px rgba(0,0,0,0.15);
    }

    .container { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
    .section { padding: 64px 0; }
    .section-tint-primary { background-color: ${withAlpha(primary, "0d")}; }
    .section-tint-secondary { background-color: ${withAlpha(secondary, "0d")}; }

    h1, h2, h3 { line-height: 1.2; color: #111; font-weight: 700; }
    h2 { font-size: 30px; margin-bottom: 8px; }
    .muted { color: #555; }
    .small { font-size: 13px; color: #777; }

    .hero {
      padding: 110px 0 72px;
      text-align: center;
      background: linear-gradient(150deg, ${withAlpha(primary, "2e")} 0%, ${withAlpha(secondary, "1a")} 45%, var(--bg) 100%);
    }
    .hero .kicker {
      color: var(--primary); font-weight: 700; font-size: 13px;
      text-transform: uppercase; letter-spacing: 0.14em;
    }
    .hero h1 { font-size: 42px; margin: 14px auto 0; max-width: 800px; }
    .hero .sub { font-size: 18px; color: #555; max-width: 640px; margin: 18px auto 0; }
    .hero .rating { margin-top: 16px; font-size: 14px; font-weight: 600; color: #555; }

    .btn-row { margin-top: 30px; display: flex; flex-wrap: wrap; gap: 14px; justify-content: center; }
    .btn {
      display: inline-block; padding: 13px 26px; border-radius: 10px;
      font-weight: 600; font-size: 16px; text-decoration: none;
      transition: opacity .15s ease, background-color .15s ease;
    }
    .btn-primary { background: var(--primary); color: #fff; box-shadow: 0 6px 16px ${withAlpha(primary, "40")}; }
    .btn-primary:hover { opacity: .9; }
    .btn-outline { border: 2px solid var(--primary); color: var(--primary); background: rgba(255,255,255,.8); }
    .btn-outline:hover { background: #fff; }

    .grid { display: grid; gap: 22px; margin-top: 30px; }
    @media (min-width: 720px) {
      .grid-2 { grid-template-columns: 1fr 1fr; }
      .grid-3 { grid-template-columns: repeat(3, 1fr); }
    }

    .card {
      background: #fff; border: 1px solid #e6e2dc; border-radius: 12px;
      padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .card h3 { font-size: 18px; margin-bottom: 8px; }
    .card p { font-size: 14px; color: #555; }

    .placeholder {
      aspect-ratio: 16 / 9; border-radius: 12px;
      background: linear-gradient(135deg, ${withAlpha(primary, "59")}, ${withAlpha(accent, "40")});
    }
    figure figcaption { margin-top: 8px; }

    .checklist { list-style: none; margin-top: 26px; display: grid; gap: 14px; }
    @media (min-width: 720px) { .checklist { grid-template-columns: 1fr 1fr; } }
    .checklist li { display: flex; align-items: flex-start; gap: 12px; color: #333; }
    .checklist .tick {
      flex: none; width: 24px; height: 24px; border-radius: 999px;
      background: var(--primary); color: #fff; font-size: 13px; font-weight: 700;
      display: flex; align-items: center; justify-content: center; margin-top: 2px;
    }

    blockquote.card { font-size: 14px; color: #444; }
    blockquote .quote-mark { color: var(--primary); font-size: 34px; font-family: Georgia, serif; line-height: 1; display: block; }
    blockquote p { margin-top: 6px; }

    .hours { list-style: none; margin-top: 22px; max-width: 560px;
      background: #fff; border: 1px solid #e6e2dc; border-radius: 12px; padding: 10px 22px; }
    .hours li { padding: 9px 0; font-size: 14px; color: #333; border-bottom: 1px solid #f1eee9; }
    .hours li:last-child { border-bottom: 0; }

    .map-frame { border: 1px solid #e6e2dc; border-radius: 12px; overflow: hidden; }
    .map-frame iframe { display: block; width: 100%; height: 300px; border: 0; }

    .contact {
      background: linear-gradient(150deg, ${withAlpha(primary, "1f")} 0%, ${withAlpha(accent, "14")} 100%);
    }
    .contact .btn-row { justify-content: flex-start; }

    form.card label { display: block; font-size: 14px; font-weight: 500; color: #333; margin-bottom: 4px; }
    form.card input, form.card textarea {
      width: 100%; border: 1px solid #d6d3cd; border-radius: 8px;
      padding: 9px 12px; font-size: 14px; font-family: inherit; background: #fff;
    }
    form.card input:focus, form.card textarea:focus {
      outline: 2px solid var(--primary); outline-offset: 1px; border-color: var(--primary);
    }
    .form-field { margin-top: 14px; }
    .form-submit {
      margin-top: 22px; width: 100%; padding: 13px; border: 0; border-radius: 10px;
      background: #d8d5d0; color: #666; font-weight: 600; font-size: 15px; cursor: not-allowed;
    }

    footer {
      border-top: 1px solid #e6e2dc; background: #fff;
      padding: 40px 0; text-align: center;
    }
    footer .brand { font-weight: 600; color: #111; }
    footer .small { max-width: 640px; margin: 12px auto 0; }

    @media (max-width: 719px) {
      .hero h1 { font-size: 32px; }
      h2 { font-size: 24px; }
      .section { padding: 48px 0; }
    }
  `;
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

  // Note: the Google rating/review count is deliberately NOT displayed on the
  // generated site — republishing Google ratings on third-party sites
  // conflicts with Maps content policies (see docs/COMPLIANCE.md). The
  // dashboard (internal tool) shows them instead.

  const heroButtons = `
    <div class="btn-row">
      <a href="${escapeHtml(primaryCtaHref)}" class="btn btn-primary"
         aria-label="${waHref ? "Contact us on WhatsApp" : "Contact us"}">${escapeHtml(
           copy.cta_text || "Contact us"
         )}</a>
      ${
        telHref
          ? `<a href="${escapeHtml(telHref)}" class="btn btn-outline"
         aria-label="Call ${name} by phone">Call us</a>`
          : ""
      }
    </div>`;

  const imagePlaceholders = imageIdeas
    .slice(0, 3)
    .map(
      (idea) => `
        <figure>
          <div class="placeholder" role="img" aria-label="Image placeholder: ${escapeHtml(idea)}"></div>
          <figcaption class="small">Suggested image: ${escapeHtml(idea)}</figcaption>
        </figure>`
    )
    .join("\n");

  const servicesCards = services
    .map(
      (service) => `
        <div class="card">
          <h3>${escapeHtml(service.title)}</h3>
          <p>${escapeHtml(service.description)}</p>
        </div>`
    )
    .join("\n");

  const whyUsItems = whyUs
    .map(
      (reason) => `
        <li>
          <span class="tick" aria-hidden="true">✓</span>
          <span>${escapeHtml(reason)}</span>
        </li>`
    )
    .join("\n");

  const testimonialCards = testimonials
    .map(
      (quote) => `
        <blockquote class="card">
          <span class="quote-mark" aria-hidden="true">&ldquo;</span>
          <p>${escapeHtml(quote)}</p>
        </blockquote>`
    )
    .join("\n");

  const hoursRows =
    hours.length > 0
      ? hours.map((line) => `<li>${escapeHtml(line)}</li>`).join("\n")
      : `<li>Contact us for current opening hours.</li>`;

  const formFieldsHtml = formFields
    .map((label, index) => {
      const id = `booking-field-${index}`;
      const isLong = /message|detail|request|note/i.test(label);
      const control = isLong
        ? `<textarea id="${id}" rows="3" placeholder="${escapeHtml(label)}"></textarea>`
        : `<input id="${id}" type="text" placeholder="${escapeHtml(label)}" />`;
      return `
        <div class="form-field">
          <label for="${id}">${escapeHtml(label)}</label>
          ${control}
        </div>`;
    })
    .join("\n");

  const contactButtons = `
    <div class="btn-row">
      ${
        waHref
          ? `<a href="${escapeHtml(waHref)}" class="btn btn-primary"
           aria-label="Message ${name} on WhatsApp">WhatsApp us</a>`
          : ""
      }
      ${
        telHref
          ? `<a href="${escapeHtml(telHref)}" class="btn btn-outline"
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
  <style>${buildStylesheet({ primary, secondary, accent, background })}</style>
</head>
<body>

  <!-- Always-visible draft disclaimer banner -->
  <div class="draft-banner" role="note">${escapeHtml(DISCLAIMER)}</div>

  <!-- Hero -->
  <header class="hero">
    <div class="container">
      <p class="kicker">${escapeHtml(business.category)}${areaSuffix}</p>
      <h1>${escapeHtml(copy.headline || business.name)}</h1>
      <p class="sub">${escapeHtml(copy.subheadline)}</p>
      ${heroButtons}
    </div>
  </header>

  <main>
    <!-- About -->
    <section id="about" class="section" aria-labelledby="about-heading">
      <div class="container">
        <h2 id="about-heading">About ${name}</h2>
        <p class="muted" style="max-width:760px">${escapeHtml(copy.about_section)}</p>
        ${
          imagePlaceholders
            ? `<div class="grid grid-3">${imagePlaceholders}</div>`
            : ""
        }
      </div>
    </section>

    <!-- Services -->
    <section id="services" class="section section-tint-primary" aria-labelledby="services-heading">
      <div class="container">
        <h2 id="services-heading">Our services</h2>
        <div class="grid grid-3">
          ${servicesCards}
        </div>
      </div>
    </section>

    <!-- Why choose us -->
    <section id="why-us" class="section" aria-labelledby="why-us-heading">
      <div class="container">
        <h2 id="why-us-heading">Why choose us</h2>
        <ul class="checklist">
          ${whyUsItems}
        </ul>
      </div>
    </section>

    <!-- Testimonials -->
    <section id="testimonials" class="section section-tint-secondary" aria-labelledby="testimonials-heading">
      <div class="container">
        <h2 id="testimonials-heading">What customers say</h2>
        <div class="grid grid-3">
          ${testimonialCards}
        </div>
      </div>
    </section>

    <!-- Opening hours -->
    <section id="hours" class="section" aria-labelledby="hours-heading">
      <div class="container">
        <h2 id="hours-heading">Opening hours</h2>
        <ul class="hours">
          ${hoursRows}
        </ul>
      </div>
    </section>

    <!-- Location -->
    <section id="location" class="section" aria-labelledby="location-heading">
      <div class="container">
        <h2 id="location-heading">Find us</h2>
        <div class="grid grid-2">
          <div>
            ${
              business.address
                ? `<p class="muted">${escapeHtml(business.address)}</p>`
                : `<p class="muted">Located in ${escapeHtml(business.area ?? "Dubai")}.</p>`
            }
            ${
              mapsUrl
                ? `<p style="margin-top:14px"><a href="${escapeHtml(mapsUrl)}" target="_blank" rel="noopener noreferrer"
                 aria-label="Open ${name} on Google Maps">View on Google Maps</a></p>`
                : ""
            }
          </div>
          <div class="map-frame">
            <iframe src="${escapeHtml(mapEmbedSrc)}" title="Map showing the location of ${name}"
                    loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>
          </div>
        </div>
      </div>
    </section>

    <!-- Contact / CTA -->
    <section id="contact" class="section contact" aria-labelledby="contact-heading">
      <div class="container">
        <div class="grid grid-2">
          <div>
            <h2 id="contact-heading">Get in touch</h2>
            <p class="muted" style="max-width:520px">${escapeHtml(copy.contact_section)}</p>
            ${contactButtons}
          </div>
          <form class="card" aria-label="Demo booking form" onsubmit="return false;">
            <h3>Request a booking</h3>
            ${formFieldsHtml}
            <button type="submit" class="form-submit" disabled>Demo form</button>
            <p class="small" style="text-align:center;margin-top:10px">This form is a non-functional demo.</p>
          </form>
        </div>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer>
    <div class="container">
      <p class="brand">${name}${areaSuffix}</p>
      <p class="small">${escapeHtml(DISCLAIMER)}</p>
    </div>
  </footer>

</body>
</html>`;
}
