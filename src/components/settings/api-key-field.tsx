"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Password input for an API key. Shows the masked stored value as the
 * placeholder and a configured/not-set badge. Leaving it blank keeps the
 * current key.
 */
export function ApiKeyField({
  id,
  label,
  configured,
  maskedValue,
  value,
  onChange,
  helpText,
  pendingClear,
  onClear,
}: {
  id: string;
  label: string;
  configured: boolean;
  maskedValue: string;
  value: string;
  onChange: (value: string) => void;
  helpText?: string;
  /** True when the stored key is marked for removal on save. */
  pendingClear?: boolean;
  /** Marks the stored override for removal (sent as "" on save). */
  onClear?: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Badge
          variant={pendingClear ? "warning" : configured ? "success" : "outline"}
          className={configured || pendingClear ? undefined : "text-muted-foreground"}
        >
          {pendingClear ? "Will be cleared on save" : configured ? "Configured" : "Not set"}
        </Badge>
        {configured && onClear && !pendingClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-destructive"
          >
            Clear stored key
          </button>
        )}
      </div>
      <Input
        id={id}
        type="password"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={
          configured && maskedValue ? maskedValue : "Enter key"
        }
      />
      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
