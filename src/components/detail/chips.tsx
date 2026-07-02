import * as React from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Wrapping row of small Badge chips, with an optional empty-state message. */
export function ChipList({
  items,
  variant = "secondary",
  emptyText,
  className,
}: {
  items: string[];
  variant?: BadgeProps["variant"];
  emptyText?: string;
  className?: string;
}) {
  if (items.length === 0) {
    return emptyText ? (
      <p className="text-sm text-muted-foreground">{emptyText}</p>
    ) : null;
  }
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((item, index) => (
        <Badge
          key={`${item}-${index}`}
          variant={variant}
          className="font-normal"
        >
          {item}
        </Badge>
      ))}
    </div>
  );
}
