import * as React from "react";
import { AlertTriangle, CheckCircle2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChipList } from "@/components/detail/chips";
import { qualityTier } from "@/components/generate/quality-badge";
import { cn } from "@/lib/utils";
import {
  CLAIM_CONFIDENCE_LABELS,
  type ClaimConfidence,
  type CreativeDirectionJson,
  type DesignBriefJson,
  type DesignSystemJson,
  type QualityReportJson,
  type ResearchResult,
  type UniquenessNotes,
  type VisualStyleJson,
  type WebsiteCopyJson,
} from "@/lib/types";
import type { WebsiteDto } from "@/lib/api-types";

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

const TONES = {
  emerald:
    "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
  blue: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300",
  violet:
    "border-transparent bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300",
  amber:
    "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  red: "border-transparent bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300",
} as const;

function InsightCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">{children}</CardContent>
    </Card>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function MutedRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-muted-foreground">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 0. Creative direction
// ---------------------------------------------------------------------------

export function CreativeDirectionCard({
  direction,
}: {
  direction: CreativeDirectionJson | null;
}) {
  return (
    <InsightCard
      title="Creative direction"
      description="The design concept invented for this business"
    >
      {!direction ? (
        <p className="text-muted-foreground">
          No creative direction recorded — this draft predates the
          creative-direction step. Regenerate the design to create one.
        </p>
      ) : (
        <>
          <p className="font-medium leading-relaxed">
            {direction.creative_concept}
          </p>

          <div className="divide-y divide-border">
            <MutedRow label="Brand feel" value={direction.brand_feel} />
            <MutedRow
              label="Business character"
              value={direction.business_character}
            />
            <MutedRow label="Visual story" value={direction.visual_story} />
            <MutedRow
              label="Layout attitude"
              value={direction.layout_attitude}
            />
            <MutedRow
              label="Signature motif"
              value={direction.signature_motif}
            />
            <MutedRow label="Section rhythm" value={direction.section_rhythm} />
            <MutedRow label="CTA style" value={direction.cta_style} />
            <MutedRow
              label="Image direction"
              value={direction.image_direction}
            />
          </div>

          <p className="text-muted-foreground">
            {direction.why_this_will_not_feel_generic}
          </p>
        </>
      )}
    </InsightCard>
  );
}

// ---------------------------------------------------------------------------
// 1. Quality review
// ---------------------------------------------------------------------------

const SEVERITY_DOTS: Record<"high" | "medium" | "low", string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-gray-400",
};

function CheckRow({ pass, label }: { pass: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {pass ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
      )}
      <span className={cn(!pass && "text-red-700 dark:text-red-400")}>
        {label}
      </span>
    </div>
  );
}

export function QualityReviewCard({
  score,
  report,
}: {
  score: number | null;
  report: QualityReportJson | null;
}) {
  return (
    <InsightCard
      title="Quality review"
      description="Automated quality gate run before the draft was saved"
    >
      {score === null && !report ? (
        <p className="text-muted-foreground">
          No quality report yet — regenerate the design to run the quality
          gate.
        </p>
      ) : (
        <>
          {score !== null && (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums leading-none">
                {score}
              </span>
              <span className="text-muted-foreground">/ 100</span>
              <span
                className={cn(
                  "ml-1 rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold",
                  qualityTier(score).toneClass
                )}
              >
                {qualityTier(score).label}
              </span>
            </div>
          )}

          {report && (
            <>
              <div className="space-y-1.5">
                <CheckRow
                  pass={report.feels_specific}
                  label="Feels specific to the business"
                />
                <CheckRow
                  pass={report.tone_matches_category}
                  label="Tone matches the category"
                />
                {report.hero_has_strong_idea !== undefined && (
                  <CheckRow
                    pass={report.hero_has_strong_idea}
                    label="Hero has a strong idea"
                  />
                )}
                {report.has_business_specific_features !== undefined && (
                  <CheckRow
                    pass={report.has_business_specific_features}
                    label="Business-specific features present"
                  />
                )}
              </div>

              {report.generic_phrases_found.length > 0 && (
                <Field label="Generic phrases found">
                  <div className="flex flex-wrap gap-1.5">
                    {report.generic_phrases_found.map((phrase, i) => (
                      <Badge
                        key={`${phrase}-${i}`}
                        variant="outline"
                        className={cn("font-normal", TONES.amber)}
                      >
                        {phrase}
                      </Badge>
                    ))}
                  </div>
                </Field>
              )}

              {report.unsupported_claims_found.length > 0 && (
                <Field label="Unsupported claims found">
                  <div className="flex flex-wrap gap-1.5">
                    {report.unsupported_claims_found.map((claim, i) => (
                      <Badge
                        key={`${claim}-${i}`}
                        variant="outline"
                        className={cn("font-normal", TONES.red)}
                      >
                        {claim}
                      </Badge>
                    ))}
                  </div>
                </Field>
              )}

              {report.issues.length > 0 && (
                <Field label="Issues">
                  <ul className="space-y-1.5">
                    {report.issues.map((issue, i) => (
                      <li
                        key={`${issue.area}-${i}`}
                        className="flex items-start gap-2"
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                            SEVERITY_DOTS[issue.severity]
                          )}
                          title={`${issue.severity} severity`}
                        />
                        <span>
                          <span className="font-medium">{issue.area}:</span>{" "}
                          {issue.note}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Field>
              )}

              {report.design_notes && report.design_notes.length > 0 && (
                <Field label="Designer notes">
                  <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                    {report.design_notes.map((note, i) => (
                      <li key={`${note}-${i}`}>{note}</li>
                    ))}
                  </ul>
                </Field>
              )}
            </>
          )}
        </>
      )}
    </InsightCard>
  );
}

// ---------------------------------------------------------------------------
// 1b. Uniqueness
// ---------------------------------------------------------------------------

export function UniquenessCard({ notes }: { notes: UniquenessNotes | null }) {
  return (
    <InsightCard
      title="Uniqueness"
      description="Structural comparison against other generated sites"
    >
      {!notes ? (
        <p className="text-muted-foreground">
          No uniqueness check recorded — this draft predates the uniqueness
          gate. Regenerate the design to run it.
        </p>
      ) : (
        <>
          <div>
            <Badge variant="outline" className="font-normal">
              Hero treatment {notes.heroVariant}
            </Badge>
          </div>

          <p className="text-muted-foreground">{notes.notes}</p>

          {notes.adjustments.length > 0 && (
            <Field label="Adjustments made">
              <ul className="list-disc space-y-1 pl-5 text-amber-700 dark:text-amber-400">
                {notes.adjustments.map((item, i) => (
                  <li key={`${item}-${i}`}>{item}</li>
                ))}
              </ul>
            </Field>
          )}

          {notes.collidedWith && (
            <p className="text-xs text-muted-foreground">
              Initially collided with {notes.collidedWith} — adjusted to stay
              distinct.
            </p>
          )}
        </>
      )}
    </InsightCard>
  );
}

// ---------------------------------------------------------------------------
// 2. Design brief
// ---------------------------------------------------------------------------

export function DesignBriefCard({ brief }: { brief: DesignBriefJson | null }) {
  return (
    <InsightCard
      title="Design brief"
      description="Strategy written before any copy or design"
    >
      {!brief ? (
        <p className="text-muted-foreground">
          No design brief yet — regenerate the design to create one.
        </p>
      ) : (
        <>
          <p className="leading-relaxed">{brief.business_identity}</p>

          <Field label="Customer persona">
            <p className="text-muted-foreground">{brief.customer_persona}</p>
          </Field>

          <Field label="Brand personality">
            <p className="text-muted-foreground">{brief.brand_personality}</p>
          </Field>

          <Field label="Main customer need">
            <p className="text-muted-foreground">{brief.main_customer_need}</p>
          </Field>

          <Field label="Recommended CTA">
            <Badge>{brief.recommended_cta}</Badge>
          </Field>

          <Field label="Local SEO angle">
            <p className="text-muted-foreground">{brief.local_seo_angle}</p>
          </Field>

          {brief.review_based_strengths.length > 0 && (
            <Field label="Review-based strengths">
              <div className="flex flex-wrap gap-1.5">
                {brief.review_based_strengths.map((item, i) => (
                  <Badge
                    key={`${item}-${i}`}
                    variant="outline"
                    className={cn("font-normal", TONES.emerald)}
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            </Field>
          )}

          {brief.review_based_concerns.length > 0 && (
            <Field label="Review-based concerns">
              <div className="flex flex-wrap gap-1.5">
                {brief.review_based_concerns.map((item, i) => (
                  <Badge
                    key={`${item}-${i}`}
                    variant="outline"
                    className={cn("font-normal", TONES.amber)}
                  >
                    {item}
                  </Badge>
                ))}
              </div>
            </Field>
          )}

          {brief.trust_signals.length > 0 && (
            <Field label="Trust signals">
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                {brief.trust_signals.map((item, i) => (
                  <li key={`${item}-${i}`}>{item}</li>
                ))}
              </ul>
            </Field>
          )}
        </>
      )}
    </InsightCard>
  );
}

// ---------------------------------------------------------------------------
// 3. Visual style
// ---------------------------------------------------------------------------

const PALETTE_ORDER = [
  "primary",
  "secondary",
  "accent",
  "background",
  "surface",
  "text",
] as const;

export function VisualStyleCard({ style }: { style: VisualStyleJson | null }) {
  return (
    <InsightCard
      title="Visual style"
      description="Per-site design system, not a shared template"
    >
      {!style ? (
        <p className="text-muted-foreground">
          No visual style yet — regenerate the design or change the style to
          create one.
        </p>
      ) : (
        <>
          <div>
            <p className="font-semibold">{style.style_name}</p>
            <p className="mt-1 text-muted-foreground">
              {style.design_rationale}
            </p>
          </div>

          <Field label="Palette">
            <div className="grid grid-cols-3 gap-2">
              {PALETTE_ORDER.map((key) => (
                <div key={key} className="min-w-0">
                  <span
                    className="block h-8 w-full rounded-md border border-border"
                    style={{ backgroundColor: style.color_palette[key] }}
                    title={`${key}: ${style.color_palette[key]}`}
                  />
                  <p className="mt-1 truncate text-xs font-medium capitalize">
                    {key}
                  </p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                    {style.color_palette[key]}
                  </p>
                </div>
              ))}
            </div>
          </Field>

          <Field label="Typography">
            <div className="divide-y divide-border">
              <MutedRow label="Headings" value={style.typography.heading_style} />
              <MutedRow label="Body" value={style.typography.body_style} />
            </div>
          </Field>

          <div className="divide-y divide-border">
            <MutedRow label="Buttons" value={style.button_style} />
            <MutedRow label="Section spacing" value={style.section_spacing} />
            <MutedRow label="Overall feel" value={style.overall_feel} />
          </div>
        </>
      )}
    </InsightCard>
  );
}

// ---------------------------------------------------------------------------
// 3b. Design system
// ---------------------------------------------------------------------------

/** Human-readable labels for the curated font-pairing keys. */
const FONT_PAIRING_LABELS: Record<string, string> = {
  "editorial-luxury": "Fraunces + Inter",
  "classic-authority": "Source Serif 4 + Public Sans",
  "warm-hospitality": "Lora + Karla",
  "bold-practical": "Archivo + Inter",
  "calm-humanist": "Manrope + Inter",
  "modern-creative": "Space Grotesk + Inter",
  "friendly-compact": "Plus Jakarta Sans",
};

export function DesignSystemCard({
  system,
}: {
  system: DesignSystemJson | null;
}) {
  return (
    <InsightCard
      title="Design system"
      description="Type, spacing and surface rules generated for this site"
    >
      {!system ? (
        <p className="text-muted-foreground">
          No design system recorded — regenerate the design to create one.
        </p>
      ) : (
        <>
          <div>
            <FieldLabel>Font pairing</FieldLabel>
            <p className="mt-1 font-semibold">
              {FONT_PAIRING_LABELS[system.typography_system.font_pairing] ??
                system.typography_system.font_pairing}
            </p>
          </div>

          <div className="divide-y divide-border">
            <MutedRow
              label="Headlines"
              value={system.typography_system.headline_style}
            />
            <MutedRow
              label="Subheadlines"
              value={system.typography_system.subheadline_style}
            />
            <MutedRow
              label="Body"
              value={system.typography_system.body_style}
            />
            <MutedRow
              label="Microcopy"
              value={system.typography_system.microcopy_style}
            />
            <MutedRow label="Spacing" value={system.spacing_system} />
            <MutedRow label="Visual density" value={system.visual_density} />
            <MutedRow label="Grid logic" value={system.grid_logic} />
            <MutedRow
              label="Section dividers"
              value={system.section_divider_style}
            />
            <MutedRow label="Corners" value={system.corner_radius_style} />
            <MutedRow label="Buttons" value={system.button_style} />
            <MutedRow label="Surfaces" value={system.surface_style} />
            <MutedRow label="Borders" value={system.border_style} />
            <MutedRow label="Motion" value={system.motion_style} />
          </div>
        </>
      )}
    </InsightCard>
  );
}

// ---------------------------------------------------------------------------
// 4. Sources & confidence
// ---------------------------------------------------------------------------

const CONFIDENCE_TONES: Record<ClaimConfidence, string> = {
  profile: TONES.blue,
  reviews: TONES.emerald,
  external: TONES.violet,
  inferred: TONES.amber,
  unknown: TONES.red,
};

export function SourcesCard({
  research,
  brief,
}: {
  research: ResearchResult | null;
  brief: DesignBriefJson | null;
}) {
  const notes = brief?.content_confidence_notes ?? [];
  return (
    <InsightCard
      title="Sources & confidence"
      description="What the draft is based on — confirmed vs inferred vs not claimed"
    >
      {!research && notes.length === 0 ? (
        <p className="text-muted-foreground">
          No research or confidence notes recorded for this draft yet.
        </p>
      ) : (
        <>
          {research && (
            <>
              <p className="text-muted-foreground">{research.note}</p>
              {research.sources.length > 0 && (
                <Field label="Public sources">
                  <ul className="space-y-2">
                    {research.sources.map((source, i) => (
                      <li
                        key={`${source.url}-${i}`}
                        className="flex items-start gap-2"
                      >
                        <Badge
                          variant="outline"
                          className="shrink-0 font-normal capitalize"
                        >
                          {source.sourceType}
                        </Badge>
                        {source.url.startsWith("http") ? (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-w-0 items-start gap-1 font-medium underline-offset-4 hover:underline"
                          >
                            <span className="min-w-0 break-words">
                              {source.title}
                            </span>
                            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          </a>
                        ) : (
                          <span className="min-w-0 break-words font-medium">
                            {source.title}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </Field>
              )}
            </>
          )}

          {notes.length > 0 && (
            <Field label="Claim confidence">
              <ul className="space-y-2.5">
                {notes.map((note, i) => (
                  <li key={`${note.claim}-${i}`} className="space-y-1">
                    <p className="leading-snug">{note.claim}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-normal",
                          CONFIDENCE_TONES[note.confidence]
                        )}
                      >
                        {CLAIM_CONFIDENCE_LABELS[note.confidence]}
                      </Badge>
                      {note.source && (
                        <span className="truncate text-xs text-muted-foreground">
                          {note.source}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Field>
          )}
        </>
      )}
    </InsightCard>
  );
}

// ---------------------------------------------------------------------------
// 5. SEO & domains
// ---------------------------------------------------------------------------

export function SeoCard({
  website,
  copy,
}: {
  website: WebsiteDto;
  copy: WebsiteCopyJson;
}) {
  const seoTitle = website.seoTitle ?? copy.seo_title;
  const seoDescription = website.seoDescription ?? copy.seo_meta_description;
  const domains =
    website.suggestedDomainNames.length > 0
      ? website.suggestedDomainNames
      : copy.suggested_domain_names;

  return (
    <InsightCard title="SEO & domains">
      <Field label={`SEO title (${seoTitle.length} characters)`}>
        <p>{seoTitle}</p>
      </Field>

      <Field label={`Meta description (${seoDescription.length} characters)`}>
        <p className="text-muted-foreground">{seoDescription}</p>
      </Field>

      <Field label="Suggested domains">
        <ChipList
          items={domains}
          variant="outline"
          emptyText="No domain suggestions."
        />
      </Field>

      <Field label="WhatsApp outreach message">
        <p className="whitespace-pre-wrap rounded-md bg-muted p-3 leading-relaxed">
          {copy.whatsapp_message}
        </p>
      </Field>
    </InsightCard>
  );
}
