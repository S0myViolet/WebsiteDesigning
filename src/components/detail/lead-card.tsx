"use client";

import * as React from "react";
import { Check, PackageCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { LEAD_STATUS_VALUES } from "@/lib/constants";
import type { LeadStatusDto } from "@/lib/api-types";
import {
  EMPTY_HANDOFF,
  type HandoffChecklist,
  type LeadStatusValue,
} from "@/lib/types";

const STATUS_LABELS: Record<LeadStatusValue, string> = {
  NEW: "New",
  SAVED: "Saved",
  CONTACTED: "Contacted",
  WON: "Won",
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

/**
 * Lead status editor: status select + notes, saved via POST update-status.
 * Once the saved lead is WON it also shows the client-handoff checklist,
 * saved via POST handoff, plus the gated production-export download.
 */
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

  // Client handoff (shown once the lead is WON)
  const [handoff, setHandoff] = React.useState<HandoffChecklist>(
    lead?.handoff ?? EMPTY_HANDOFF
  );
  const [handoffSaving, setHandoffSaving] = React.useState(false);
  const [handoffSaved, setHandoffSaved] = React.useState(false);
  const [handoffError, setHandoffError] = React.useState<string | null>(null);

  const leadStatus = lead?.status ?? null;
  const leadNotes = lead?.notes ?? null;
  const leadHandoff = lead?.handoff ?? null;
  React.useEffect(() => {
    setStatus(leadStatus ?? "NEW");
    setNotes(leadNotes ?? "");
  }, [leadStatus, leadNotes]);
  React.useEffect(() => {
    setHandoff(leadHandoff ?? EMPTY_HANDOFF);
  }, [leadHandoff]);

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

  async function handleSaveHandoff() {
    setHandoffSaving(true);
    setHandoffError(null);
    setHandoffSaved(false);
    try {
      const res = await fetch(`/api/businesses/${businessId}/handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          depositReceived: handoff.depositReceived,
          photosReceived: handoff.photosReceived,
          contentApproved: handoff.contentApproved,
          domain: handoff.domain.trim(),
          liveUrl: handoff.liveUrl.trim(),
          notes: handoff.notes,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        lead?: LeadStatusDto;
        error?: string;
      } | null;
      if (!res.ok || !data?.lead) {
        setHandoffError(data?.error || `Request failed (${res.status})`);
        return;
      }
      setHandoffSaved(true);
      onSaved?.(data.lead);
      window.setTimeout(() => setHandoffSaved(false), 2500);
    } catch {
      setHandoffError("Network error — could not save the handoff.");
    } finally {
      setHandoffSaving(false);
    }
  }

  // Production export unlocks from the last-saved handoff, not local edits.
  const exportUnlocked = Boolean(
    leadHandoff?.contentApproved && leadHandoff.domain.trim() !== ""
  );

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

        {leadStatus === "WON" && (
          <div className="space-y-4 border-t border-border pt-4">
            <div>
              <p className="text-sm font-medium">Client handoff</p>
              <p className="text-xs text-muted-foreground">
                Delivery checklist for the won client.
              </p>
            </div>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={handoff.depositReceived}
                  onChange={(event) =>
                    setHandoff((h) => ({
                      ...h,
                      depositReceived: event.target.checked,
                    }))
                  }
                />
                Deposit received
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={handoff.photosReceived}
                  onChange={(event) =>
                    setHandoff((h) => ({
                      ...h,
                      photosReceived: event.target.checked,
                    }))
                  }
                />
                Photos received
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={handoff.contentApproved}
                  onChange={(event) =>
                    setHandoff((h) => ({
                      ...h,
                      contentApproved: event.target.checked,
                    }))
                  }
                />
                Content approved by owner
              </label>
              <p className="pl-6 text-xs text-muted-foreground">
                Gates the final production export below.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="handoff-domain">Domain</Label>
              <Input
                id="handoff-domain"
                value={handoff.domain}
                onChange={(event) =>
                  setHandoff((h) => ({ ...h, domain: event.target.value }))
                }
                placeholder="e.g. bandungdubai.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="handoff-live-url">Live URL (optional)</Label>
              <Input
                id="handoff-live-url"
                value={handoff.liveUrl}
                onChange={(event) =>
                  setHandoff((h) => ({ ...h, liveUrl: event.target.value }))
                }
                placeholder="https://…"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="handoff-notes">Handoff notes</Label>
              <Textarea
                id="handoff-notes"
                value={handoff.notes}
                onChange={(event) =>
                  setHandoff((h) => ({ ...h, notes: event.target.value }))
                }
                placeholder="Delivery details, hosting, invoicing…"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={handleSaveHandoff}
                disabled={handoffSaving}
              >
                {handoffSaving ? (
                  <Spinner size="sm" className="text-primary-foreground" />
                ) : null}
                {handoffSaving ? "Saving…" : "Save handoff"}
              </Button>
              {handoffSaved && (
                <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="h-4 w-4" /> Saved
                </span>
              )}
            </div>
            {handoffError && (
              <p className="text-sm text-destructive">{handoffError}</p>
            )}
            <div className="space-y-1.5 border-t border-border pt-4">
              {exportUnlocked ? (
                <a
                  href={`/api/businesses/${businessId}/export-production`}
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                  })}
                >
                  <PackageCheck />
                  Production export
                </a>
              ) : (
                <>
                  <Button variant="outline" size="sm" disabled>
                    <PackageCheck />
                    Production export
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Save the handoff with content approved + a domain to
                    unlock.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
