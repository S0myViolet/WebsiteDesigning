"use client";

import * as React from "react";
import { AlertCircle, Download } from "lucide-react";
import { CATEGORIES, DUBAI_AREAS, LEAD_STATUS_VALUES } from "@/lib/constants";
import {
  WEBSITE_STATUS_LABELS,
  type WebsiteStatus,
} from "@/lib/types";
import type { ApiError, BusinessListResponse } from "@/lib/api-types";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { BusinessTable } from "@/components/businesses/business-table";

const WEBSITE_STATUS_OPTIONS = Object.keys(
  WEBSITE_STATUS_LABELS
) as WebsiteStatus[];

const LEAD_STATUS_LABELS: Record<(typeof LEAD_STATUS_VALUES)[number], string> =
  {
    NEW: "New",
    SAVED: "Saved",
    CONTACTED: "Contacted",
    WON: "Won",
    REJECTED: "Rejected",
  };

const PAGE_SIZE = 25;

export default function BusinessesPage() {
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [area, setArea] = React.useState("");
  const [websiteStatus, setWebsiteStatus] = React.useState("");
  const [leadStatus, setLeadStatus] = React.useState("");
  const [minReviews, setMinReviews] = React.useState("");
  const [minRating, setMinRating] = React.useState("");
  const [minScore, setMinScore] = React.useState("");

  const [page, setPage] = React.useState(1);
  const [data, setData] = React.useState<BusinessListResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const backgroundRefetchRef = React.useRef(false);

  // Debounce the free-text search (~400ms) and reset paging when it settles.
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [search]);

  /** Query string with the current filters only (used for CSV export too). */
  const filterQuery = React.useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (category) params.set("category", category);
    if (area) params.set("area", area);
    if (websiteStatus) params.set("websiteStatus", websiteStatus);
    if (leadStatus) params.set("leadStatus", leadStatus);
    if (minReviews.trim()) params.set("minReviews", minReviews.trim());
    if (minRating.trim()) params.set("minRating", minRating.trim());
    if (minScore.trim()) params.set("minScore", minScore.trim());
    return params.toString();
  }, [
    debouncedSearch,
    category,
    area,
    websiteStatus,
    leadStatus,
    minReviews,
    minRating,
    minScore,
  ]);

  React.useEffect(() => {
    const background = backgroundRefetchRef.current;
    backgroundRefetchRef.current = false;
    if (!background) setLoading(true);

    let cancelled = false;
    const params = new URLSearchParams(filterQuery);
    params.set("sortBy", "score");
    params.set("sortDir", "desc");
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));

    fetch(`/api/businesses?${params.toString()}`)
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as
          | BusinessListResponse
          | ApiError
          | null;
        if (cancelled) return;
        if (!res.ok || !json || "error" in json) {
          setError(
            (json && "error" in json && json.error) ||
              `Failed to load businesses (HTTP ${res.status}).`
          );
        } else {
          setError(null);
          setData(json);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Network error while loading businesses.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filterQuery, page, refreshKey]);

  const refetch = React.useCallback(() => {
    backgroundRefetchRef.current = true;
    setRefreshKey((k) => k + 1);
  }, []);

  /** Wraps a filter setter so changing it resets to page 1. */
  function filterSetter(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setPage(1);
    };
  }

  const setCategoryFilter = filterSetter(setCategory);
  const setAreaFilter = filterSetter(setArea);
  const setWebsiteStatusFilter = filterSetter(setWebsiteStatus);
  const setLeadStatusFilter = filterSetter(setLeadStatus);
  const setMinReviewsFilter = filterSetter(setMinReviews);
  const setMinRatingFilter = filterSetter(setMinRating);
  const setMinScoreFilter = filterSetter(setMinScore);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Businesses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All discovered businesses, sorted by opportunity score. Filter,
          analyze, and generate website drafts.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="filter-search">Search</Label>
              <Input
                id="filter-search"
                placeholder="Business name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-category">Category</Label>
              <Select
                id="filter-category"
                value={category}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="">All</option>
                {CATEGORIES.map((c) => (
                  <option key={c.label} value={c.label}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-area">Area</Label>
              <Select
                id="filter-area"
                value={area}
                onChange={(e) => setAreaFilter(e.target.value)}
              >
                <option value="">All</option>
                {DUBAI_AREAS.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-website">Website status</Label>
              <Select
                id="filter-website"
                value={websiteStatus}
                onChange={(e) => setWebsiteStatusFilter(e.target.value)}
              >
                <option value="">All</option>
                {WEBSITE_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {WEBSITE_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-lead">Lead status</Label>
              <Select
                id="filter-lead"
                value={leadStatus}
                onChange={(e) => setLeadStatusFilter(e.target.value)}
              >
                <option value="">All</option>
                {LEAD_STATUS_VALUES.map((status) => (
                  <option key={status} value={status}>
                    {LEAD_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-min-reviews">Min reviews</Label>
              <Input
                id="filter-min-reviews"
                type="number"
                min={0}
                placeholder="e.g. 50"
                value={minReviews}
                onChange={(e) => setMinReviewsFilter(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-min-rating">Min rating</Label>
              <Input
                id="filter-min-rating"
                type="number"
                min={0}
                max={5}
                step={0.1}
                placeholder="e.g. 4.0"
                value={minRating}
                onChange={(e) => setMinRatingFilter(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="filter-min-score">Min score</Label>
              <Input
                id="filter-min-score"
                type="number"
                min={0}
                max={100}
                placeholder="e.g. 60"
                value={minScore}
                onChange={(e) => setMinScoreFilter(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <a
              href={`/api/export/csv${filterQuery ? `?${filterQuery}` : ""}`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </a>
          </div>
        </CardContent>
      </Card>

      {error && (
        <p
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <BusinessTable
        businesses={data?.businesses ?? []}
        total={data?.total ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        loading={loading}
        onPageChange={setPage}
        onRefetch={refetch}
      />
    </div>
  );
}
