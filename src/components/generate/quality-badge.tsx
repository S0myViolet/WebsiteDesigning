import * as React from "react";
import { cn } from "@/lib/utils";

/** Soft tone classes shared by the quality badges. */
const QUALITY_TONES = {
  emerald:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  red: "bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300",
} as const;

export interface QualityTier {
  label: string;
  toneClass: string;
}

/** Map a quality-gate score (0-100) to a sales-facing tier (bar is 90). */
export function qualityTier(score: number): QualityTier {
  if (score >= 94)
    return { label: "Impressive", toneClass: QUALITY_TONES.emerald };
  if (score >= 90)
    return { label: "Client-ready", toneClass: QUALITY_TONES.blue };
  if (score >= 80)
    return { label: "Nearly there", toneClass: QUALITY_TONES.amber };
  if (score >= 65)
    return { label: "Needs polish", toneClass: QUALITY_TONES.amber };
  return { label: "Below bar", toneClass: QUALITY_TONES.red };
}

/** Big, prominent quality-score badge for the page header. */
export function QualityScoreBadge({
  score,
  className,
}: {
  score: number | null;
  className?: string;
}) {
  if (score === null) return null;
  const tier = qualityTier(score);
  return (
    <span
      title={`Quality gate score: ${score} / 100`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1 text-sm font-semibold",
        tier.toneClass,
        className
      )}
    >
      <span className="tabular-nums text-base leading-none">{score}</span>
      <span aria-hidden="true" className="opacity-50">
        ·
      </span>
      {tier.label}
    </span>
  );
}
