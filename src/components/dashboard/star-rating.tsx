import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

function StarRow({ className }: { className?: string }) {
  return (
    <span className={cn("flex", className)} aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className="h-3.5 w-3.5 shrink-0 fill-current" />
      ))}
    </span>
  );
}

/**
 * Compact star rating: 5 stars with fractional fill, the numeric rating,
 * and an optional review count. Renders a muted dash when rating is null.
 */
export function StarRating({
  rating,
  count,
  className,
}: {
  rating: number | null;
  count?: number;
  className?: string;
}) {
  if (rating === null) {
    return (
      <span className={cn("text-sm text-muted-foreground", className)}>
        &mdash;
      </span>
    );
  }

  const clamped = Math.max(0, Math.min(5, rating));
  const fillPercent = (clamped / 5) * 100;
  const label =
    `Rated ${clamped.toFixed(1)} out of 5` +
    (typeof count === "number" ? ` from ${count.toLocaleString()} reviews` : "");

  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      role="img"
      aria-label={label}
      title={label}
    >
      <span className="relative inline-flex shrink-0">
        <StarRow className="text-muted-foreground/40" />
        <span
          className="absolute inset-y-0 left-0 overflow-hidden text-amber-500"
          style={{ width: `${fillPercent}%` }}
        >
          <StarRow />
        </span>
      </span>
      <span className="text-sm font-medium tabular-nums text-foreground">
        {clamped.toFixed(1)}
      </span>
      {typeof count === "number" && (
        <span className="text-xs tabular-nums text-muted-foreground">
          ({count.toLocaleString()})
        </span>
      )}
    </span>
  );
}
