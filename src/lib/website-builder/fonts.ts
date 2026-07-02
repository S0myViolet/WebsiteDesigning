// Curated typography pairings. Each pairing loads from Google Fonts with
// font-display:swap and degrades to a carefully chosen system stack, so the
// preview renders acceptably offline and beautifully online. The visual-style
// AI step picks a pairing key; layouts fall back per industry.

import type { FontPairingKey, LayoutType } from "@/lib/types";

export interface FontPairing {
  key: FontPairingKey;
  label: string;
  /** Google Fonts css2 href (self-limiting: 2 families, few weights) */
  importHref: string;
  headingFamily: string;
  headingFallback: string;
  headingWeight: number;
  /** Letter-spacing for large display headings */
  headingTracking: string;
  bodyFamily: string;
  bodyFallback: string;
  /** True when the heading face has a usable italic for editorial accents */
  hasDisplayItalic: boolean;
}

const SERIF_FALLBACK = 'Georgia, "Times New Roman", serif';
const SANS_FALLBACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

export const FONT_PAIRINGS: Record<FontPairingKey, FontPairing> = {
  "editorial-luxury": {
    key: "editorial-luxury",
    label: "Fraunces + Inter",
    importHref:
      "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,560;1,9..144,480&family=Inter:wght@400;600&display=swap",
    headingFamily: '"Fraunces"',
    headingFallback: SERIF_FALLBACK,
    headingWeight: 560,
    headingTracking: "-0.015em",
    bodyFamily: '"Inter"',
    bodyFallback: SANS_FALLBACK,
    hasDisplayItalic: true,
  },
  "classic-authority": {
    key: "classic-authority",
    label: "Source Serif 4 + Public Sans",
    importHref:
      "https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,600&family=Public+Sans:wght@400;600&display=swap",
    headingFamily: '"Source Serif 4"',
    headingFallback: SERIF_FALLBACK,
    headingWeight: 600,
    headingTracking: "-0.01em",
    bodyFamily: '"Public Sans"',
    bodyFallback: SANS_FALLBACK,
    hasDisplayItalic: false,
  },
  "warm-hospitality": {
    key: "warm-hospitality",
    label: "Lora + Karla",
    importHref:
      "https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,600;1,500&family=Karla:wght@400;600&display=swap",
    headingFamily: '"Lora"',
    headingFallback: SERIF_FALLBACK,
    headingWeight: 600,
    headingTracking: "-0.008em",
    bodyFamily: '"Karla"',
    bodyFallback: SANS_FALLBACK,
    hasDisplayItalic: true,
  },
  "bold-practical": {
    key: "bold-practical",
    label: "Archivo + Inter",
    importHref:
      "https://fonts.googleapis.com/css2?family=Archivo:wght@700;800&family=Inter:wght@400;600&display=swap",
    headingFamily: '"Archivo"',
    headingFallback: SANS_FALLBACK,
    headingWeight: 800,
    headingTracking: "-0.02em",
    bodyFamily: '"Inter"',
    bodyFallback: SANS_FALLBACK,
    hasDisplayItalic: false,
  },
  "calm-humanist": {
    key: "calm-humanist",
    label: "Manrope + Inter",
    importHref:
      "https://fonts.googleapis.com/css2?family=Manrope:wght@600;700&family=Inter:wght@400;500&display=swap",
    headingFamily: '"Manrope"',
    headingFallback: SANS_FALLBACK,
    headingWeight: 700,
    headingTracking: "-0.018em",
    bodyFamily: '"Inter"',
    bodyFallback: SANS_FALLBACK,
    hasDisplayItalic: false,
  },
  "modern-creative": {
    key: "modern-creative",
    label: "Space Grotesk + Inter",
    importHref:
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500&display=swap",
    headingFamily: '"Space Grotesk"',
    headingFallback: SANS_FALLBACK,
    headingWeight: 700,
    headingTracking: "-0.025em",
    bodyFamily: '"Inter"',
    bodyFallback: SANS_FALLBACK,
    hasDisplayItalic: false,
  },
  "friendly-compact": {
    key: "friendly-compact",
    label: "Plus Jakarta Sans",
    importHref:
      "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&display=swap",
    headingFamily: '"Plus Jakarta Sans"',
    headingFallback: SANS_FALLBACK,
    headingWeight: 800,
    headingTracking: "-0.02em",
    bodyFamily: '"Plus Jakarta Sans"',
    bodyFallback: SANS_FALLBACK,
    hasDisplayItalic: false,
  },
};

/** Industry defaults when the AI does not pick a valid pairing. */
export const LAYOUT_FONT_DEFAULTS: Record<LayoutType, FontPairingKey> = {
  "premium-service": "editorial-luxury",
  "local-practical": "bold-practical",
  hospitality: "warm-hospitality",
  "wellness-clinic": "calm-humanist",
  "creative-portfolio": "modern-creative",
  "premium-professional": "classic-authority",
  "simple-landing": "friendly-compact",
};

export function isFontPairingKey(value: unknown): value is FontPairingKey {
  return typeof value === "string" && value in FONT_PAIRINGS;
}

export function resolveFontPairing(
  requested: string | null | undefined,
  layout: LayoutType
): FontPairing {
  if (isFontPairingKey(requested)) return FONT_PAIRINGS[requested];
  return FONT_PAIRINGS[LAYOUT_FONT_DEFAULTS[layout]];
}
