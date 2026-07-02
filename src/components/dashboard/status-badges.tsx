import * as React from "react";
import { badgeVariants } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  OPPORTUNITY_TIER_LABELS,
  WEBSITE_STATUS_LABELS,
  opportunityTier,
  type LeadStatusValue,
  type WebsiteStatus,
} from "@/lib/types";

/** Soft badge tones (light bg / dark text, with dark-mode variants). */
const TONES = {
  green:
    "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
  blue: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300",
  amber:
    "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  red: "border-transparent bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300",
  gray: "border-transparent bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-300",
} as const;

const WEBSITE_STATUS_TONES: Record<WebsiteStatus, string> = {
  NO_WEBSITE_LISTED: TONES.green,
  LIKELY_MISSING: TONES.green,
  NEEDS_MANUAL_REVIEW: TONES.amber,
  POSSIBLY_EXISTS: TONES.amber,
  WEBSITE_FOUND: TONES.red,
  UNKNOWN: TONES.gray,
};

export function WebsiteStatusBadge({
  status,
  className,
}: {
  status: WebsiteStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        badgeVariants({ variant: "outline" }),
        "whitespace-nowrap",
        WEBSITE_STATUS_TONES[status],
        className
      )}
    >
      {WEBSITE_STATUS_LABELS[status]}
    </span>
  );
}

const TIER_TONES: Record<ReturnType<typeof opportunityTier>, string> = {
  "very-high": TONES.green,
  good: TONES.blue,
  medium: TONES.amber,
  low: TONES.gray,
};

export function ScoreBadge({
  score,
  className,
}: {
  score: number | null;
  className?: string;
}) {
  if (score === null) {
    return (
      <span
        className={cn(
          badgeVariants({ variant: "outline" }),
          "text-muted-foreground",
          className
        )}
        title="Not scored yet"
      >
        &mdash;
      </span>
    );
  }
  const tier = opportunityTier(score);
  return (
    <span
      title={`${score} — ${OPPORTUNITY_TIER_LABELS[tier]}`}
      className={cn(
        badgeVariants({ variant: "outline" }),
        "tabular-nums",
        TIER_TONES[tier],
        className
      )}
    >
      {score}
    </span>
  );
}

const LEAD_STATUS_META: Record<LeadStatusValue, { label: string; tone: string }> = {
  NEW: { label: "New", tone: TONES.gray },
  SAVED: { label: "Saved", tone: TONES.blue },
  CONTACTED: { label: "Contacted", tone: TONES.green },
  REJECTED: { label: "Rejected", tone: TONES.red },
};

export function LeadStatusBadge({
  status,
  className,
}: {
  status: LeadStatusValue | null;
  className?: string;
}) {
  if (status === null) {
    return (
      <span
        className={cn(
          badgeVariants({ variant: "outline" }),
          "text-muted-foreground",
          className
        )}
        title="No lead status"
      >
        &mdash;
      </span>
    );
  }
  const meta = LEAD_STATUS_META[status];
  return (
    <span
      className={cn(
        badgeVariants({ variant: "outline" }),
        "whitespace-nowrap",
        meta.tone,
        className
      )}
    >
      {meta.label}
    </span>
  );
}
