"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  Clock,
  Download,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  Phone,
  Sparkles,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { StarRating } from "@/components/dashboard/star-rating";
import {
  LeadStatusBadge,
  ScoreBadge,
  WebsiteStatusBadge,
} from "@/components/dashboard/status-badges";
import { AnalysisCard } from "@/components/detail/analysis-card";
import { ChipList } from "@/components/detail/chips";
import { LeadCard } from "@/components/detail/lead-card";
import { PaletteSwatches } from "@/components/detail/palette-swatches";
import type {
  BusinessDetail,
  LeadStatusDto,
  VerifyWebsiteResponse,
} from "@/lib/api-types";
import {
  OPPORTUNITY_TIER_LABELS,
  opportunityTier,
} from "@/lib/types";
import { cn, normalizePhone, safeHttpUrl } from "@/lib/utils";

const TIER_TEXT_CLASSES: Record<ReturnType<typeof opportunityTier>, string> = {
  "very-high": "text-emerald-600 dark:text-emerald-400",
  good: "text-blue-600 dark:text-blue-400",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-muted-foreground",
};

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;
  return data?.error || `Request failed (${res.status})`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function BusinessDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

  const [business, setBusiness] = React.useState<BusinessDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [verifyEvidence, setVerifyEvidence] = React.useState<string[]>([]);

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

  async function handleAnalyze() {
    setAnalyzing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/businesses/${id}/analyze`, {
        method: "POST",
      });
      if (!res.ok) {
        setActionError(await readError(res));
        return;
      }
      await fetchDetail();
    } catch {
      setActionError("Network error — could not run the analysis.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleVerify() {
    setVerifying(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/businesses/${id}/verify-website`, {
        method: "POST",
      });
      if (!res.ok) {
        setActionError(await readError(res));
        return;
      }
      const data = (await res.json()) as VerifyWebsiteResponse;
      setVerifyEvidence(data.evidence);
      await fetchDetail();
    } catch {
      setActionError("Network error — could not verify the website.");
    } finally {
      setVerifying(false);
    }
  }

  async function handleGenerate() {
    // A draft already exists: open the generate page without overwriting it.
    if (business?.website) {
      router.push(`/businesses/${id}/generate`);
      return;
    }
    setGenerating(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/businesses/${id}/generate-website`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        setActionError(await readError(res));
        setGenerating(false);
        return;
      }
      router.push(`/businesses/${id}/generate`);
    } catch {
      setActionError("Network error — could not generate the website.");
      setGenerating(false);
    }
  }

  function handleLeadSaved(lead: LeadStatusDto) {
    setBusiness((prev) =>
      prev
        ? { ...prev, lead, leadStatus: lead.status, leadNotes: lead.notes }
        : prev
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="space-y-3">
          <Skeleton className="h-8 w-96" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-6 md:col-span-2">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
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
            <p className="font-medium">
              {loadError || "Business not found."}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void fetchDetail()}>
                Try again
              </Button>
              <Link
                href="/businesses"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Back to businesses
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const score = business.opportunityScore;
  const tier = score !== null ? opportunityTier(score) : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {business.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{business.category}</Badge>
            {business.area && <Badge variant="outline">{business.area}</Badge>}
            <WebsiteStatusBadge status={business.websiteStatus} />
            <ScoreBadge score={business.opportunityScore} />
            <LeadStatusBadge status={business.leadStatus} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleAnalyze}
            disabled={analyzing || generating}
          >
            {analyzing ? <Spinner size="sm" /> : <Sparkles />}
            {analyzing ? "Analyzing…" : "Analyze reviews"}
          </Button>
          <Button
            variant="outline"
            onClick={handleVerify}
            disabled={verifying || generating}
          >
            {verifying ? <Spinner size="sm" /> : <Globe />}
            {verifying ? "Verifying…" : "Verify website"}
          </Button>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <Spinner size="sm" className="text-primary-foreground" />
            ) : (
              <Wand2 />
            )}
            {generating
              ? "Generating copy and code…"
              : business.website
                ? "Open website draft"
                : "Generate website"}
          </Button>
          {safeHttpUrl(business.googleMapsUrl) && (
            <a
              href={safeHttpUrl(business.googleMapsUrl)!}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline" })}
            >
              <ExternalLink />
              Open in Google Maps
            </a>
          )}
        </div>
      </div>

      {actionError && (
        <p className="flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {actionError}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {/* LEFT — 2 columns */}
        <div className="space-y-6 md:col-span-2">
          {/* Profile */}
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Google Maps listing details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{business.address || "No address on file"}</span>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                {business.phone ? (
                  <a
                    href={`tel:${normalizePhone(business.phone)}`}
                    className="text-primary hover:underline"
                  >
                    {business.phone}
                  </a>
                ) : (
                  <span className="text-muted-foreground">No phone listed</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <StarRating
                  rating={business.rating}
                  count={business.reviewCount}
                />
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <ImageIcon className="h-4 w-4" />
                  {business.photosCount.toLocaleString()} photo
                  {business.photosCount === 1 ? "" : "s"}
                </span>
                {business.isLikelyChain && (
                  <Badge variant="warning">Likely chain / franchise</Badge>
                )}
              </div>
              {business.openingHours.length > 0 && (
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <ul className="space-y-0.5 text-muted-foreground">
                    {business.openingHours.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
              {business.editorialSummary && (
                <p className="border-t border-border pt-3 italic text-muted-foreground">
                  {business.editorialSummary}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Review keywords */}
          <Card>
            <CardHeader>
              <CardTitle>Review keywords</CardTitle>
              <CardDescription>
                Most frequent terms in customer reviews
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChipList
                items={business.keywords.map(
                  (k) => `${k.keyword} ×${k.count}`
                )}
                emptyText="No keywords extracted yet — they are computed when reviews are fetched."
              />
            </CardContent>
          </Card>

          {/* Reviews */}
          <Card>
            <CardHeader>
              <CardTitle>Reviews</CardTitle>
              <CardDescription>
                {business.reviews.length} stored from Google Maps
              </CardDescription>
            </CardHeader>
            <CardContent>
              {business.reviews.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <MessageSquare className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No reviews stored for this business yet. Reviews are saved
                    when the business is discovered via Search.
                  </p>
                </div>
              ) : (
                <ul className="max-h-96 space-y-4 overflow-y-auto pr-2">
                  {business.reviews.map((review) => (
                    <li
                      key={review.id}
                      className="rounded-md border border-border p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <StarRating rating={review.reviewRating} />
                        {review.reviewDate && (
                          <span className="text-xs text-muted-foreground">
                            {formatDate(review.reviewDate)}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm leading-relaxed">
                        {review.reviewText}
                      </p>
                      {review.reviewerName && (
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          — {review.reviewerName}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* AI analysis */}
          <AnalysisCard
            analysis={business.analysis}
            analyzing={analyzing}
            onRun={handleAnalyze}
          />
        </div>

        {/* RIGHT — 1 column */}
        <div className="space-y-6">
          {/* Opportunity */}
          <Card>
            <CardHeader>
              <CardTitle>Opportunity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {score === null || tier === null ? (
                <p className="text-sm text-muted-foreground">
                  Not scored yet — the score is computed during search,
                  verification and analysis.
                </p>
              ) : (
                <>
                  <div>
                    <p
                      className={cn(
                        "text-5xl font-bold tabular-nums",
                        TIER_TEXT_CLASSES[tier]
                      )}
                    >
                      {score}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-sm font-medium",
                        TIER_TEXT_CLASSES[tier]
                      )}
                    >
                      {OPPORTUNITY_TIER_LABELS[tier]}
                    </p>
                  </div>
                  {business.scoreBreakdown &&
                    business.scoreBreakdown.factors.length > 0 && (
                      <ul className="space-y-1.5 border-t border-border pt-3 text-sm">
                        {business.scoreBreakdown.factors.map((factor) => (
                          <li
                            key={factor.label}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="text-muted-foreground">
                              {factor.label}
                            </span>
                            <span className="font-medium tabular-nums">
                              {factor.points > 0
                                ? `+${factor.points}`
                                : factor.points}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Website status */}
          <Card>
            <CardHeader>
              <CardTitle>Website status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <WebsiteStatusBadge status={business.websiteStatus} />
              {business.websiteUrl &&
                (safeHttpUrl(business.websiteUrl) ? (
                  <a
                    href={safeHttpUrl(business.websiteUrl)!}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-1.5 break-all text-primary hover:underline"
                  >
                    <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
                    {business.websiteUrl}
                  </a>
                ) : (
                  <p className="break-all text-muted-foreground">
                    {business.websiteUrl}
                  </p>
                ))}
              {verifyEvidence.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Verification evidence
                  </p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                    {verifyEvidence.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleVerify}
                disabled={verifying}
              >
                {verifying ? <Spinner size="sm" /> : <Globe />}
                {verifying ? "Verifying…" : "Verify"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Verification checks the Google listing and uses the optional
                Custom Search API when configured in Settings.
              </p>
            </CardContent>
          </Card>

          {/* Lead */}
          <LeadCard
            businessId={business.id}
            lead={business.lead}
            onSaved={handleLeadSaved}
          />

          {/* Generated website */}
          <Card>
            <CardHeader>
              <CardTitle>Generated website</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {business.website ? (
                <>
                  {business.website.seoTitle && (
                    <p className="font-medium">{business.website.seoTitle}</p>
                  )}
                  <ChipList
                    items={business.website.suggestedDomainNames}
                    variant="outline"
                  />
                  {business.website.colorPalette && (
                    <PaletteSwatches palette={business.website.colorPalette} />
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a
                      href={`/preview/${business.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      <ExternalLink />
                      Open preview
                    </a>
                    <a
                      href={`/api/businesses/${business.id}/export-code`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      <Download />
                      Download code
                    </a>
                    <Link
                      href={`/businesses/${business.id}/generate`}
                      className={buttonVariants({
                        variant: "ghost",
                        size: "sm",
                      })}
                    >
                      Edit / regenerate
                    </Link>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground">
                  No website generated yet. Use “Generate website” above to
                  create a draft grounded in this business’s reviews.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
