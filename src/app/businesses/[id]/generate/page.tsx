"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Code2,
  Download,
  ExternalLink,
  FileText,
  MonitorSmartphone,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { ChipList } from "@/components/detail/chips";
import { PaletteSwatches } from "@/components/detail/palette-swatches";
import type { BusinessDetail } from "@/lib/api-types";

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;
  return data?.error || `Request failed (${res.status})`;
}

function CopySection({
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
      <CardContent className="space-y-3 text-sm">{children}</CardContent>
    </Card>
  );
}

export default function GenerateWebsitePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [business, setBusiness] = React.useState<BusinessDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [generating, setGenerating] = React.useState(false);
  const [genError, setGenError] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

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

  async function handleGenerate() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch(`/api/businesses/${id}/generate-website`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        setGenError(await readError(res));
        return;
      }
      await fetchDetail();
    } catch {
      setGenError("Network error — could not generate the website.");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <Skeleton className="h-8 w-96" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-[70vh] w-full" />
          <div className="space-y-4">
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

  // ---- No generated website yet ----------------------------------------
  if (!website || !copy) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <Link
          href={`/businesses/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {business.name}
        </Link>
        <div className="flex min-h-[55vh] items-center justify-center">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle>Generate a draft website</CardTitle>
              <CardDescription>
                Create a tailored website draft for {business.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    Website copy grounded in real review themes — hero, about,
                    services, testimonials, SEO and more.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <MonitorSmartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    A draft-labeled HTML preview you can open full screen and
                    show to the business.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Code2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    A downloadable Next.js project ZIP, ready to customize and
                    deploy.
                  </span>
                </li>
              </ul>
              <p className="text-xs text-muted-foreground">
                Uses your OpenAI API key. If no review analysis exists yet, it
                is run automatically first.
              </p>
              <Button onClick={handleGenerate} disabled={generating} size="lg">
                {generating ? (
                  <Spinner size="sm" className="text-primary-foreground" />
                ) : (
                  <Wand2 />
                )}
                {generating
                  ? "Generating copy and code…"
                  : "Generate website"}
              </Button>
              {genError && (
                <p className="flex items-start gap-1.5 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {genError}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ---- Website exists ----------------------------------------------------
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={`/businesses/${id}`}
          className="inline-flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight hover:underline"
        >
          <ArrowLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{business.name}</span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setConfirmOpen(true)}
            disabled={generating}
          >
            {generating ? <Spinner size="sm" /> : <RefreshCw />}
            {generating ? "Regenerating…" : "Regenerate copy"}
          </Button>
          <a
            href={`/preview/${id}`}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "outline" })}
          >
            <ExternalLink />
            Open full preview
          </a>
          <a
            href={`/api/businesses/${id}/export-code`}
            className={buttonVariants({ variant: "default" })}
          >
            <Download />
            Download ZIP
          </a>
        </div>
      </div>

      {genError && (
        <p className="flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {genError}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT: live preview */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <iframe
            key={website.updatedAt}
            src={`/api/businesses/${id}/website-preview`}
            title={`Website draft preview for ${business.name}`}
            className="h-[70vh] w-full rounded-lg border border-border bg-white"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Draft preview — not a live website.
          </p>
        </div>

        {/* RIGHT: copy fields */}
        <div className="space-y-4">
          <CopySection title="Hero">
            <p className="text-base font-semibold leading-snug">
              {copy.headline}
            </p>
            <p className="text-muted-foreground">{copy.subheadline}</p>
            <Badge>{copy.cta_text}</Badge>
          </CopySection>

          <CopySection title="About">
            <p className="leading-relaxed">{copy.about_section}</p>
          </CopySection>

          <CopySection title="Services">
            <ul className="space-y-3">
              {copy.services.map((service) => (
                <li key={service.title}>
                  <p className="font-medium">{service.title}</p>
                  <p className="text-muted-foreground">
                    {service.description}
                  </p>
                </li>
              ))}
            </ul>
          </CopySection>

          <CopySection title="Why choose us">
            <ul className="list-disc space-y-1 pl-5">
              {copy.why_choose_us.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CopySection>

          <CopySection
            title="Testimonials"
            description="Paraphrased review themes — not verbatim quotes"
          >
            <ul className="space-y-3">
              {copy.testimonials.map((quote) => (
                <li
                  key={quote}
                  className="rounded-md bg-muted p-3 italic leading-relaxed"
                >
                  “{quote}”
                </li>
              ))}
            </ul>
          </CopySection>

          <CopySection title="Contact section">
            <p className="leading-relaxed">{copy.contact_section}</p>
          </CopySection>

          <CopySection title="SEO">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Title{" "}
                <span className="font-normal normal-case">
                  ({copy.seo_title.length} characters)
                </span>
              </p>
              <p className="mt-1">{copy.seo_title}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Meta description{" "}
                <span className="font-normal normal-case">
                  ({copy.seo_meta_description.length} characters)
                </span>
              </p>
              <p className="mt-1">{copy.seo_meta_description}</p>
            </div>
          </CopySection>

          <CopySection title="Suggested domains">
            <ChipList
              items={copy.suggested_domain_names}
              variant="outline"
              emptyText="No domain suggestions."
            />
          </CopySection>

          <CopySection title="Color palette">
            <PaletteSwatches palette={copy.color_palette} showHex />
          </CopySection>

          <CopySection title="Font">
            <p>{copy.font_recommendation}</p>
          </CopySection>

          <CopySection title="Image recommendations">
            <ul className="list-disc space-y-1 pl-5">
              {copy.image_recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </CopySection>

          <CopySection title="WhatsApp message">
            <p className="whitespace-pre-wrap rounded-md bg-muted p-3 leading-relaxed">
              {copy.whatsapp_message}
            </p>
          </CopySection>

          <CopySection title="Booking form fields">
            <ChipList
              items={copy.booking_form_fields}
              variant="outline"
              emptyText="No booking form fields suggested."
            />
          </CopySection>
        </div>
      </div>

      {/* Regenerate confirmation */}
      <SimpleDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Regenerate website copy?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will overwrite the current draft — copy, preview and the
            downloadable code will all be regenerated from the latest review
            analysis.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                void handleGenerate();
              }}
            >
              <RefreshCw />
              Regenerate
            </Button>
          </div>
        </div>
      </SimpleDialog>
    </div>
  );
}
