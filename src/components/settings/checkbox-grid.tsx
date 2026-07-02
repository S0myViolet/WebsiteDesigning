"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/** Grid of labeled checkboxes with optional select-all / clear shortcuts. */
export function CheckboxGrid({
  options,
  selected,
  onChange,
  withSelectAll = false,
  gridClassName,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  withSelectAll?: boolean;
  gridClassName?: string;
}) {
  function toggle(option: string, checked: boolean) {
    onChange(
      checked
        ? [...selected, option]
        : selected.filter((item) => item !== option)
    );
  }

  return (
    <div className="space-y-2">
      {withSelectAll && (
        <div className="flex gap-3 text-xs">
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={() => onChange([...options])}
          >
            Select all
          </button>
          <button
            type="button"
            className="font-medium text-muted-foreground hover:underline"
            onClick={() => onChange([])}
          >
            Clear
          </button>
        </div>
      )}
      <div
        className={cn(
          "grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3",
          gridClassName
        )}
      >
        {options.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-2 text-sm"
          >
            <Checkbox
              checked={selected.includes(option)}
              onChange={(event) => toggle(option, event.target.checked)}
            />
            <span className="truncate" title={option}>
              {option}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
