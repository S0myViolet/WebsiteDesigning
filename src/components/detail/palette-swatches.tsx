import * as React from "react";
import { cn } from "@/lib/utils";

export interface PaletteColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}

/** Color palette swatches; optionally shows labels + hex codes next to each. */
export function PaletteSwatches({
  palette,
  showHex = false,
  className,
}: {
  palette: PaletteColors;
  showHex?: boolean;
  className?: string;
}) {
  const entries: Array<[string, string]> = [
    ["Primary", palette.primary],
    ["Secondary", palette.secondary],
    ["Accent", palette.accent],
    ["Background", palette.background],
  ];
  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-2", className)}>
      {entries.map(([label, color]) => (
        <div key={label} className="flex items-center gap-2">
          <span
            className="h-6 w-6 shrink-0 rounded-md border border-border shadow-sm"
            style={{ backgroundColor: color }}
            title={`${label}: ${color}`}
            aria-label={`${label} color ${color}`}
          />
          {showHex && (
            <span className="text-xs text-muted-foreground">
              {label}{" "}
              <code className="font-mono text-foreground">{color}</code>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
