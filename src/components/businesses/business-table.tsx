"use client";

import * as React from "react";
import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  AlertCircle,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Eye,
  Globe,
  MapPin,
  PhoneCall,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { BusinessListItem } from "@/lib/types";
import type { ApiError } from "@/lib/api-types";
import { cn, safeHttpUrl } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { StarRating } from "@/components/dashboard/star-rating";
import {
  ScoreBadge,
  WebsiteStatusBadge,
} from "@/components/dashboard/status-badges";

type RowAction = "analyze" | "generate" | "save" | "contact";

export interface BusinessTableProps {
  businesses: BusinessListItem[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  onPageChange: (page: number) => void;
  /** Called after a row action succeeds so the parent can refetch. */
  onRefetch: () => void;
}

const ICON_BUTTON_CLASS = "h-8 w-8 [&_svg]:size-4";

export function BusinessTable({
  businesses,
  total,
  page,
  pageSize,
  loading,
  onPageChange,
  onRefetch,
}: BusinessTableProps) {
  const [pending, setPending] = React.useState<{
    id: string;
    action: RowAction;
  } | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const runAction = React.useCallback(
    async (
      business: BusinessListItem,
      action: RowAction,
      path: string,
      body?: unknown
    ) => {
      setPending({ id: business.id, action });
      setActionError(null);
      try {
        const res = await fetch(`/api/businesses/${business.id}/${path}`, {
          method: "POST",
          headers:
            body !== undefined
              ? { "Content-Type": "application/json" }
              : undefined,
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as ApiError | null;
          setActionError(
            data?.error
              ? `${business.name}: ${data.error}`
              : `${business.name}: action failed (HTTP ${res.status}).`
          );
          return;
        }
        onRefetch();
      } catch {
        setActionError(`${business.name}: network error — please try again.`);
      } finally {
        setPending(null);
      }
    },
    [onRefetch]
  );

  const columns = React.useMemo<ColumnDef<BusinessListItem>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: ({ row }) => {
          const b = row.original;
          return (
            <div className="max-w-[220px]">
              <Link
                href={`/businesses/${b.id}`}
                className="block truncate font-medium hover:underline"
                title={b.name}
              >
                {b.name}
              </Link>
              {b.address && (
                <p
                  className="truncate text-xs text-muted-foreground"
                  title={b.address}
                >
                  {b.address}
                </p>
              )}
            </div>
          );
        },
      },
      {
        id: "category",
        header: "Category",
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{row.original.category}</span>
        ),
      },
      {
        id: "area",
        header: "Area",
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.area ?? "—"}
          </span>
        ),
      },
      {
        id: "rating",
        header: "Rating",
        cell: ({ row }) => (
          <StarRating
            rating={row.original.rating}
            count={row.original.reviewCount}
          />
        ),
      },
      {
        id: "reviews",
        header: () => <span className="block text-right">Reviews</span>,
        cell: ({ row }) => (
          <span className="block text-right tabular-nums">
            {row.original.reviewCount.toLocaleString()}
          </span>
        ),
      },
      {
        id: "websiteStatus",
        header: "Website status",
        cell: ({ row }) => (
          <WebsiteStatusBadge status={row.original.websiteStatus} />
        ),
      },
      {
        id: "score",
        header: "Score",
        cell: ({ row }) => <ScoreBadge score={row.original.opportunityScore} />,
      },
      {
        id: "phone",
        header: "Phone",
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {row.original.phone ?? "—"}
          </span>
        ),
      },
      {
        id: "maps",
        header: "Maps",
        cell: ({ row }) => {
          const b = row.original;
          const mapsUrl = safeHttpUrl(b.googleMapsUrl);
          if (!mapsUrl) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${b.name} on Google Maps`}
              title="Open on Google Maps"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                ICON_BUTTON_CLASS,
                "text-muted-foreground hover:text-foreground"
              )}
            >
              <MapPin className="h-4 w-4" />
            </a>
          );
        },
      },
      {
        id: "summary",
        header: "AI summary",
        cell: ({ row }) => {
          const summary = row.original.businessSummary;
          if (!summary) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <p
              className="line-clamp-2 max-w-xs text-xs text-muted-foreground"
              title={summary}
            >
              {summary}
            </p>
          );
        },
      },
      {
        id: "actions",
        header: () => <span className="block text-right">Actions</span>,
        cell: ({ row }) => {
          const b = row.original;
          const rowPending = pending?.id === b.id ? pending.action : null;
          const busy = rowPending !== null;
          const AnalyzeIcon = b.hasAnalysis ? RefreshCw : Sparkles;
          return (
            <div className="flex items-center justify-end gap-0.5">
              <Link
                href={`/businesses/${b.id}`}
                title="View details"
                aria-label={`View ${b.name}`}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  ICON_BUTTON_CLASS
                )}
              >
                <Eye className="h-4 w-4" />
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className={ICON_BUTTON_CLASS}
                title={b.hasAnalysis ? "Re-run AI analysis" : "Analyze reviews"}
                aria-label={`Analyze ${b.name}`}
                disabled={busy}
                onClick={() => runAction(b, "analyze", "analyze")}
              >
                {rowPending === "analyze" ? (
                  <Spinner size="sm" />
                ) : (
                  <AnalyzeIcon className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={ICON_BUTTON_CLASS}
                title={
                  b.hasWebsite ? "Regenerate website" : "Generate website"
                }
                aria-label={`Generate website for ${b.name}`}
                disabled={busy}
                onClick={() =>
                  runAction(b, "generate", "generate-website", {})
                }
              >
                {rowPending === "generate" ? (
                  <Spinner size="sm" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
              </Button>
              {b.hasWebsite && (
                <Link
                  href={`/preview/${b.id}`}
                  title="Preview generated website"
                  aria-label={`Preview website for ${b.name}`}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    ICON_BUTTON_CLASS
                  )}
                >
                  <Globe className="h-4 w-4" />
                </Link>
              )}
              <Button
                variant="ghost"
                size="icon"
                className={ICON_BUTTON_CLASS}
                title="Save lead"
                aria-label={`Save ${b.name} as lead`}
                disabled={busy}
                onClick={() => runAction(b, "save", "save-lead")}
              >
                {rowPending === "save" ? (
                  <Spinner size="sm" />
                ) : (
                  <Bookmark
                    className={cn(
                      "h-4 w-4",
                      b.leadStatus &&
                        b.leadStatus !== "NEW" &&
                        "fill-current text-primary"
                    )}
                  />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={ICON_BUTTON_CLASS}
                title="Mark contacted"
                aria-label={`Mark ${b.name} as contacted`}
                disabled={busy || b.leadStatus === "CONTACTED"}
                onClick={() =>
                  runAction(b, "contact", "update-status", {
                    status: "CONTACTED",
                  })
                }
              >
                {rowPending === "contact" ? (
                  <Spinner size="sm" />
                ) : (
                  <PhoneCall
                    className={cn(
                      "h-4 w-4",
                      b.leadStatus === "CONTACTED" && "text-emerald-600"
                    )}
                  />
                )}
              </Button>
            </div>
          );
        },
      },
    ],
    [pending, runAction]
  );

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  const table = useReactTable({
    data: businesses,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount,
    state: {
      pagination: { pageIndex: page - 1, pageSize },
    },
  });

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="whitespace-nowrap text-xs"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }, (_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {columns.map((col, j) => (
                    <TableCell key={col.id ?? j}>
                      <Skeleton className="h-4 w-full max-w-[140px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  No businesses match the current filters.{" "}
                  <Link
                    href="/search"
                    className="font-medium text-primary hover:underline"
                  >
                    Run a search
                  </Link>{" "}
                  to discover new leads.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2.5">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {actionError && (
        <p
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {actionError}
        </p>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString()} {total === 1 ? "business" : "businesses"}
          {total > 0 && (
            <span className="ml-2">
              · Page {page} of {pageCount}
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
