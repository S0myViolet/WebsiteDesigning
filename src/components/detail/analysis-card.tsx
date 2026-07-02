"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ChipList } from "@/components/detail/chips";
import type { AnalysisDto } from "@/lib/api-types";

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

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

/**
 * AI review analysis card: explainer + run button when no analysis exists,
 * otherwise the full structured analysis with a re-run action.
 */
export function AnalysisCard({
  analysis,
  analyzing,
  onRun,
}: {
  analysis: AnalysisDto | null;
  analyzing: boolean;
  onRun: () => void;
}) {
  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI analysis</CardTitle>
          <CardDescription>No analysis has been run yet</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Run an AI analysis of the stored reviews to summarize the business,
            surface customer praise and complaints, suggest website positioning,
            tone and SEO keywords, and refine the opportunity score. Requires an
            OpenAI API key configured in Settings.
          </p>
          <Button onClick={onRun} disabled={analyzing}>
            {analyzing ? (
              <>
                <Spinner size="sm" className="text-primary-foreground" />
                Analyzing reviews…
              </>
            ) : (
              <>
                <Sparkles />
                Run analysis
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <CardTitle>AI analysis</CardTitle>
          <CardDescription>
            Updated {formatDate(analysis.updatedAt)}
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onRun} disabled={analyzing}>
          {analyzing ? <Spinner size="sm" /> : <RefreshCw />}
          {analyzing ? "Re-running…" : "Re-run"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <p className="leading-relaxed">{analysis.businessSummary}</p>

        {analysis.recommendedPositioning && (
          <div className="rounded-md border-l-4 border-primary bg-primary/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Recommended positioning
            </p>
            <p className="mt-1 leading-relaxed">
              {analysis.recommendedPositioning}
            </p>
          </div>
        )}

        {analysis.tone && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tone
            </span>
            <Badge variant="secondary" className="font-normal">
              {analysis.tone}
            </Badge>
          </div>
        )}

        {analysis.targetCustomers.length > 0 && (
          <Section title="Target customers">
            <ChipList items={analysis.targetCustomers} />
          </Section>
        )}

        {analysis.services.length > 0 && (
          <Section title="Main services">
            <ul className="list-disc space-y-1 pl-5">
              {analysis.services.map((service) => (
                <li key={service}>{service}</li>
              ))}
            </ul>
          </Section>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Section title="Strengths">
            {analysis.strengths.length === 0 ? (
              <p className="text-muted-foreground">None extracted.</p>
            ) : (
              <ul className="space-y-1.5">
                {analysis.strengths.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Weaknesses">
            {analysis.weaknesses.length === 0 ? (
              <p className="text-muted-foreground">None extracted.</p>
            ) : (
              <ul className="space-y-1.5">
                {analysis.weaknesses.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {analysis.seoKeywords.length > 0 && (
          <Section title="SEO keywords">
            <ChipList items={analysis.seoKeywords} variant="outline" />
          </Section>
        )}

        {analysis.localSeoPhrases.length > 0 && (
          <Section title="Local SEO phrases">
            <ChipList items={analysis.localSeoPhrases} variant="outline" />
          </Section>
        )}

        {analysis.suggestedCta && (
          <Section title="Suggested call to action">
            <Badge>{analysis.suggestedCta}</Badge>
          </Section>
        )}

        {analysis.opportunityReasoning && (
          <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
            {analysis.opportunityReasoning}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
