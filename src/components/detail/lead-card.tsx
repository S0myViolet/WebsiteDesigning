"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { LEAD_STATUS_VALUES } from "@/lib/constants";
import type { LeadStatusDto } from "@/lib/api-types";
import type { LeadStatusValue } from "@/lib/types";

const STATUS_LABELS: Record<LeadStatusValue, string> = {
  NEW: "New",
  SAVED: "Saved",
  CONTACTED: "Contacted",
  REJECTED: "Rejected",
};

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

/** Lead status editor: status select + notes, saved via POST update-status. */
export function LeadCard({
  businessId,
  lead,
  onSaved,
}: {
  businessId: string;
  lead: LeadStatusDto | null;
  onSaved?: (lead: LeadStatusDto) => void;
}) {
  const [status, setStatus] = React.useState<LeadStatusValue>(
    lead?.status ?? "NEW"
  );
  const [notes, setNotes] = React.useState(lead?.notes ?? "");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const leadStatus = lead?.status ?? null;
  const leadNotes = lead?.notes ?? null;
  React.useEffect(() => {
    setStatus(leadStatus ?? "NEW");
    setNotes(leadNotes ?? "");
  }, [leadStatus, leadNotes]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/businesses/${businessId}/update-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          notes: notes.trim() === "" ? null : notes,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        lead?: LeadStatusDto;
        error?: string;
      } | null;
      if (!res.ok || !data?.lead) {
        setError(data?.error || `Request failed (${res.status})`);
        return;
      }
      setSaved(true);
      onSaved?.(data.lead);
      window.setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Network error — could not save the lead status.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead</CardTitle>
        <CardDescription>Track outreach for this business</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="lead-status">Status</Label>
          <Select
            id="lead-status"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as LeadStatusValue)
            }
          >
            {LEAD_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lead-notes">Notes</Label>
          <Textarea
            id="lead-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Outreach notes, contact person, follow-up date…"
            rows={4}
          />
        </div>
        {lead?.contactedAt && (
          <p className="text-xs text-muted-foreground">
            Contacted on {formatDate(lead.contactedAt)}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Spinner size="sm" className="text-primary-foreground" />
            ) : null}
            {saving ? "Saving…" : "Save"}
          </Button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" /> Saved
            </span>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
