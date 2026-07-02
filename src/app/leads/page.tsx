"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  Pencil,
  PhoneCall,
  Users,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  LeadStatusBadge,
  ScoreBadge,
  WebsiteStatusBadge,
} from "@/components/dashboard/status-badges";
import type { BusinessListResponse } from "@/lib/api-types";
import type { BusinessListItem, LeadStatusValue } from "@/lib/types";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "ALL", label: "All" },
  { value: "SAVED", label: "Saved" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "REJECTED", label: "Rejected" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const LEAD_STATUSES: LeadStatusValue[] = ["SAVED", "CONTACTED", "REJECTED"];

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;
  return data?.error || `Request failed (${res.status})`;
}

async function fetchByStatus(
  status: LeadStatusValue
): Promise<BusinessListItem[]> {
  const url = `/api/businesses?leadStatus=${status}&sortBy=score&sortDir=desc&pageSize=100`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(await readError(res));
  }
  const data = (await res.json()) as BusinessListResponse;
  return data.businesses;
}

export default function LeadsPage() {
  const [tab, setTab] = React.useState<TabValue>("ALL");
  const [items, setItems] = React.useState<BusinessListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rowBusyId, setRowBusyId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [notesDraft, setNotesDraft] = React.useState("");

  const load = React.useCallback(async (activeTab: TabValue) => {
    setError(null);
    try {
      if (activeTab === "ALL") {
        const results = await Promise.all(
          LEAD_STATUSES.map((status) => fetchByStatus(status))
        );
        const byId = new Map<string, BusinessListItem>();
        for (const list of results) {
          for (const item of list) byId.set(item.id, item);
        }
        const merged = Array.from(byId.values()).sort(
          (a, b) => (b.opportunityScore ?? -1) - (a.opportunityScore ?? -1)
        );
        setItems(merged);
      } else {
        setItems(await fetchByStatus(activeTab));
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load leads."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    setLoading(true);
    setEditingId(null);
    void load(tab);
  }, [tab, load]);

  async function updateStatus(
    item: BusinessListItem,
    status: LeadStatusValue,
    notes?: string | null
  ) {
    setRowBusyId(item.id);
    setError(null);
    try {
      const body: { status: LeadStatusValue; notes?: string | null } = {
        status,
      };
      if (notes !== undefined) body.notes = notes;
      const res = await fetch(`/api/businesses/${item.id}/update-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      if (editingId === item.id) setEditingId(null);
      await load(tab);
    } catch {
      setError("Network error — could not update the lead.");
    } finally {
      setRowBusyId(null);
    }
  }

  function startEditNotes(item: BusinessListItem) {
    setEditingId(item.id);
    setNotesDraft(item.leadNotes ?? "");
  }

  function saveNotes(item: BusinessListItem) {
    void updateStatus(
      item,
      item.leadStatus ?? "SAVED",
      notesDraft.trim() === "" ? null : notesDraft
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Saved leads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Businesses you have saved, contacted or rejected.
        </p>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            aria-pressed={tab === t.value}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === t.value
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {loading ? (
        <Card>
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-2/3" />
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Users className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No leads here yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Save promising businesses from the businesses list to track your
              outreach here.
            </p>
            <Link
              href="/businesses"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Browse businesses
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Website</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/businesses/${item.id}`}
                      className="hover:underline"
                    >
                      {item.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.category}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.area ?? "—"}
                  </TableCell>
                  <TableCell>
                    <ScoreBadge score={item.opportunityScore} />
                  </TableCell>
                  <TableCell>
                    <WebsiteStatusBadge status={item.websiteStatus} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {item.phone ?? "—"}
                  </TableCell>
                  <TableCell>
                    <LeadStatusBadge status={item.leadStatus} />
                  </TableCell>
                  <TableCell className="max-w-[240px]">
                    {editingId === item.id ? (
                      <div className="space-y-2 py-1">
                        <Textarea
                          value={notesDraft}
                          onChange={(event) =>
                            setNotesDraft(event.target.value)
                          }
                          rows={3}
                          className="min-h-[64px] w-56"
                          placeholder="Outreach notes…"
                          aria-label={`Notes for ${item.name}`}
                        />
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => saveNotes(item)}
                            disabled={rowBusyId === item.id}
                          >
                            {rowBusyId === item.id ? (
                              <Spinner
                                size="sm"
                                className="text-primary-foreground"
                              />
                            ) : (
                              <Check />
                            )}
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span
                          className="truncate text-muted-foreground"
                          title={item.leadNotes ?? undefined}
                        >
                          {item.leadNotes || "—"}
                        </span>
                        <button
                          type="button"
                          onClick={() => startEditNotes(item)}
                          aria-label={`Edit notes for ${item.name}`}
                          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {item.leadStatus !== "CONTACTED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void updateStatus(item, "CONTACTED")}
                          disabled={rowBusyId === item.id}
                          title="Mark contacted"
                        >
                          <PhoneCall />
                          Mark contacted
                        </Button>
                      )}
                      {item.leadStatus !== "REJECTED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => void updateStatus(item, "REJECTED")}
                          disabled={rowBusyId === item.id}
                          title="Reject lead"
                        >
                          <X />
                          Reject
                        </Button>
                      )}
                      <Link
                        href={`/businesses/${item.id}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        View
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
