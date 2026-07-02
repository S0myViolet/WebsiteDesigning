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
}: {
  id: string;
  label: string;
  configured: boolean;
  maskedValue: string;
  value: string;
  onChange: (value: string) => void;
  helpText?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Badge
          variant={configured ? "success" : "outline"}
          className={configured ? undefined : "text-muted-foreground"}
        >
          {configured ? "Configured" : "Not set"}
        </Badge>
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
