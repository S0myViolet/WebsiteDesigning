"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  LayoutTemplate,
  Palette,
  RefreshCw,
  Wand2,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SimpleDialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { QualityScoreBadge } from "@/components/generate/quality-badge";
import {
  CreativeDirectionCard,
  DesignBriefCard,
  DesignSystemCard,
  QualityReviewCard,
  SeoCard,
  SourcesCard,
  UniquenessCard,
  VisualStyleCard,
} from "@/components/generate/insight-cards";
import { cn } from "@/lib/utils";
import { LAYOUT_TYPES, LAYOUT_TYPE_LABELS, type LayoutType } from "@/lib/types";
import type { BusinessDetail } from "@/lib/api-types";

type GenerateMode = "full" | "copy" | "style";
/** A user-triggered pipeline action: a regenerate mode or a layout switch. */
type PipelineAction = GenerateMode | "layout";

const MODE_LOADING_LABELS: Record<PipelineAction, string> = {
  full: "Rethinking strategy…",
  copy: "Rewriting copy…",
  style: "Restyling…",
  layout: "Switching layout…",
};

const CONFIRM_COPY: Record<
  GenerateMode,
  { title: string; body: string; action: string }
> = {
  full: {
    title: "Regenerate the full design?",
    body: "Re-runs research, strategy, copy and design — overwrites the current draft.",
    action: "Regenerate design",
  },
  copy: {
    title: "Rewrite the copy?",
    body: "Keeps the current design brief, visual style and layout, and rewrites only the website copy. The current copy is overwritten.",
    action: "Rewrite copy",
  },
  style: {
    title: "Change the visual style?",
    body: "Keeps the current copy, and regenerates the design brief, visual style and layout. The current design is overwritten.",
    action: "Change style",
  },
};

/** Steps narrated while a full generation runs (no real progress feed). */
const PIPELINE_STEPS = [
  "Researching public mentions",
  "Analyzing customer reviews",
  "Writing the design brief",
  "Selecting the layout",
  "Writing agency-grade copy",
  "Designing the visual style",
  "Running the quality gate",
];

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;
  return data?.error || `Request failed (${res.status})`;
}

function InlineError({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-1.5 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {message}
    </p>
  );
}

/** Narrated pipeline progress shown while the first generation runs. */
function StepNarration({ stepIndex }: { stepIndex: number }) {
  return (
    <ol className="space-y-2 text-sm">
      {PIPELINE_STEPS.map((step, i) => {
        const done = i < stepIndex;
        const current = i === stepIndex;
        return (
          <li
            key={step}
            className={cn(
              "flex items-center gap-2.5",
              done && "text-muted-foreground",
              current && "font-medium",
              !done && !current && "text-muted-foreground/60"
            )}
          >
            {done ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : current ? (
              <Spinner size="sm" className="text-primary" />
            ) : (
              <span
                aria-hidden="true"
                className="mx-1 h-2 w-2 shrink-0 rounded-full bg-border"
              />
            )}
            {step}
            {current && <span aria-hidden="true">…</span>}
          </li>
        );
      })}
    </ol>
  );
}

export default function GenerateWebsitePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [business, setBusiness] = React.useState<BusinessDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [generatingMode, setGeneratingMode] =
    React.useState<PipelineAction | null>(null);
  const [genError, setGenError] = React.useState<string | null>(null);
  const [confirmMode, setConfirmMode] = React.useState<PipelineAction | null>(
    null
  );
  const [stepIndex, setStepIndex] = React.useState(0);
  /** Layout chosen in the picker; null = follow the website's current layout. */
  const [selectedLayout, setSelectedLayout] = React.useState<LayoutType | null>(
    null
  );

  const fetchDetail = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/businesses/${id}`, { cache: "no-store" });
      if (!res.ok) {
        setLoadError(await readError(res));
        return;
      }
      const data = (await res.json()) as { business: BusinessDetail };
      setBusiness(data.business);
      setLoadError(null);
    } catch {
      setLoadError("Network error — could not load the business.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    if (!id) return;
    setLoading(true);
    void fetchDetail();
  }, [id, fetchDetail]);

  // Advance the step narration while a full generation is running.
  React.useEffect(() => {
    if (generatingMode !== "full") {
      setStepIndex(0);
      return;
    }
    const timer = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, PIPELINE_STEPS.length - 1));
    }, 6000);
    return () => clearInterval(timer);
  }, [generatingMode]);

  const handleGenerate = React.useCallback(
    async (action: PipelineAction, layout?: LayoutType) => {
      setGeneratingMode(action);
      setGenError(null);
      try {
        const body: { mode: GenerateMode; layout?: LayoutType } =
          action === "layout"
            ? { mode: "style", layout }
            : { mode: action };
        const res = await fetch(`/api/businesses/${id}/generate-website`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          setGenError(await readError(res));
          return;
        }
        await fetchDetail();
        if (action === "layout") setSelectedLayout(null);
      } catch {
        setGenError("Network error — could not generate the website.");
      } finally {
        setGeneratingMode(null);
      }
    },
    [id, fetchDetail]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <Skeleton className="h-8 w-96" />
        <div className="grid gap-6 lg:grid-cols-5">
          <Skeleton className="h-[75vh] w-full lg:col-span-3" />
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !business) {
    return (
      <div className="mx-auto max-w-7xl">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="font-medium">{loadError || "Business not found."}</p>
            <Link
              href="/businesses"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Back to businesses
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const website = business.website;
  const copy = website?.copy ?? null;
  const generating = generatingMode !== null;
  /** Layout shown in the picker: explicit choice, else the current layout. */
  const layoutChoice: LayoutType =
    selectedLayout ?? website?.layoutType ?? LAYOUT_TYPES[0];
  const confirm =
    confirmMode === null
      ? null
      : confirmMode === "layout"
        ? {
            title: "Switch the layout?",
            body: `Regenerates the design in the ${LAYOUT_TYPE_LABELS[layoutChoice]} layout — the copy is kept.`,
            action: "Apply layout",
          }
        : CONFIRM_COPY[confirmMode];

  const headerBadges = (
    <>
      <Badge variant="secondary" className="font-normal">
        {business.category}
      </Badge>
      {business.area && (
        <Badge variant="outline" className="font-normal">
          {business.area}
        </Badge>
      )}
    </>
  );

  // ---- No generated website yet -------------------------------------------
  if (!website || !copy) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/businesses/${id}`}
            className="inline-flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight hover:underline"
          >
            <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{business.name}</span>
          </Link>
          {headerBadges}
        </div>

        <div className="flex min-h-[55vh] items-center justify-center">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle>Generate a website draft</CardTitle>
              <CardDescription>
                A full pipeline runs for {business.name} — nothing is copied
                from a template.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {generatingMode === "full" ? (
                <StepNarration stepIndex={stepIndex} />
              ) : (
                <>
                  <ol className="list-decimal space-y-1.5 pl-5 text-sm">
                    <li>Public research — compliant search for real mentions</li>
                    <li>Review analysis — what customers actually praise</li>
                    <li>Design brief — positioning, persona and strategy</li>
                    <li>Layout selection — the variant that fits the business</li>
                    <li>Agency-grade copy — grounded in verified facts</li>
                    <li>Visual style — a per-site color and type system</li>
                    <li>Quality gate — scored and checked before saving</li>
                  </ol>
                  <p className="text-xs text-muted-foreground">
                    Uses your OpenAI API key. If no review analysis exists yet,
                    it is run automatically first.
                  </p>
                </>
              )}
              <Button
                onClick={() => void handleGenerate("full")}
                disabled={generating}
                size="lg"
              >
                {generating ? (
                  <Spinner size="sm" className="text-primary-foreground" />
                ) : (
                  <Wand2 />
                )}
                {generating ? "Generating website…" : "Generate website"}
              </Button>
              {genError && <InlineError message={genError} />}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ---- Website exists ------------------------------------------------------
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Top header bar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link
            href={`/businesses/${id}`}
            className="inline-flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight hover:underline"
          >
            <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{business.name}</span>
          </Link>
          {headerBadges}
          {website.layoutType && (
            <Badge variant="outline" className="font-normal">
              {LAYOUT_TYPE_LABELS[website.layoutType]}
            </Badge>
          )}
          <QualityScoreBadge score={website.qualityScore} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setConfirmMode("full")}
            disabled={generating}
          >
            {generatingMode === "full" ? <Spinner size="sm" /> : <Wand2 />}
            {generatingMode === "full"
              ? MODE_LOADING_LABELS.full
              : "Regenerate design"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setConfirmMode("copy")}
            disabled={generating}
          >
            {generatingMode === "copy" ? <Spinner size="sm" /> : <RefreshCw />}
            {generatingMode === "copy"
              ? MODE_LOADING_LABELS.copy
              : "Rewrite copy"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setConfirmMode("style")}
            disabled={generating}
          >
            {generatingMode === "style" ? <Spinner size="sm" /> : <Palette />}
            {generatingMode === "style"
              ? MODE_LOADING_LABELS.style
              : "Change style"}
          </Button>
          <div className="flex items-center gap-2">
            <Select
              aria-label="Layout variant"
              value={layoutChoice}
              onChange={(e) =>
                setSelectedLayout(e.target.value as LayoutType)
              }
              disabled={generating}
              className="w-auto"
            >
              {LAYOUT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {LAYOUT_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
            <Button
              variant="outline"
              onClick={() => setConfirmMode("layout")}
              disabled={generating || layoutChoice === website.layoutType}
            >
              {generatingMode === "layout" ? (
                <Spinner size="sm" />
              ) : (
                <LayoutTemplate />
              )}
              {generatingMode === "layout"
                ? MODE_LOADING_LABELS.layout
                : "Apply layout"}
            </Button>
          </div>
          <Link
            href={`/preview/${id}`}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            <ExternalLink />
            Open full preview
          </Link>
          <a
            href={`/api/businesses/${id}/export-code`}
            className={buttonVariants({ variant: "default" })}
          >
            <Download />
            Download code ZIP
          </a>
        </div>
      </div>

      {genError && <InlineError message={genError} />}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* LEFT: live preview (~60%) */}
        <div className="lg:col-span-3 lg:sticky lg:top-6 lg:self-start">
          <iframe
            key={website.updatedAt}
            src={`/api/businesses/${id}/website-preview`}
            title={`Website draft preview for ${business.name}`}
            className="h-[75vh] w-full rounded-lg border border-border bg-white"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Draft preview — labeled as a concept, not the official website.
          </p>
        </div>

        {/* RIGHT: insight panel (~40%) */}
        <div className="space-y-6 lg:col-span-2">
          <CreativeDirectionCard direction={website.creativeDirection} />
          <QualityReviewCard
            score={website.qualityScore}
            report={website.qualityReport}
          />
          <UniquenessCard notes={website.uniquenessNotes} />
          <DesignBriefCard brief={website.designBrief} />
          <VisualStyleCard style={website.visualStyle} />
          <DesignSystemCard system={website.designSystem} />
          <SourcesCard
            research={business.research}
            brief={website.designBrief}
          />
          <SeoCard website={website} copy={copy} />
        </div>
      </div>

      {/* Regenerate confirmation */}
      <SimpleDialog
        open={confirmMode !== null}
        onClose={() => setConfirmMode(null)}
        title={confirm?.title}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{confirm?.body}</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmMode(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const action = confirmMode;
                setConfirmMode(null);
                if (action) {
                  void handleGenerate(
                    action,
                    action === "layout" ? layoutChoice : undefined
                  );
                }
              }}
            >
              {confirmMode === "copy" ? (
                <RefreshCw />
              ) : confirmMode === "style" ? (
                <Palette />
              ) : confirmMode === "layout" ? (
                <LayoutTemplate />
              ) : (
                <Wand2 />
              )}
              {confirm?.action}
            </Button>
          </div>
        </div>
      </SimpleDialog>
    </div>
  );
}
