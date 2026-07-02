"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, Search as SearchIcon, TriangleAlert } from "lucide-react";
import { CATEGORIES, DUBAI_AREAS } from "@/lib/constants";
import type { SearchBusinessesResponse, ApiError } from "@/lib/api-types";
import type { SearchRunSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
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

const SKIPPED_LABELS: Record<keyof SearchRunSummary["skipped"], string> = {
  hasWebsite: "Has website",
  lowReviews: "Low reviews",
  lowRating: "Low rating",
  excludedType: "Excluded type",
  likelyChain: "Likely chain",
  notOperational: "Not operational",
};

function StatChip({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

export default function SearchPage() {
  const [category, setCategory] = React.useState(CATEGORIES[0]?.label ?? "");
  const [areas, setAreas] = React.useState<string[]>([]);
  const [minReviews, setMinReviews] = React.useState("50");
  const [minRating, setMinRating] = React.useState("4.0");
  const [includeChains, setIncludeChains] = React.useState(false);
  const [maxPagesPerArea, setMaxPagesPerArea] = React.useState("1");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<SearchBusinessesResponse | null>(
    null
  );

  function toggleArea(name: string, checked: boolean) {
    setAreas((prev) =>
      checked ? [...prev, name] : prev.filter((a) => a !== name)
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (areas.length === 0) {
      setError("Select at least one Dubai area to search.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/search-businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          areas,
          minReviews: Number(minReviews) || 0,
          minRating: Number(minRating) || 0,
          includeChains,
          maxPagesPerArea: Number(maxPagesPerArea) || 1,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | SearchBusinessesResponse
        | ApiError
        | null;
      if (!res.ok || !data || "error" in data) {
        setError(
          (data && "error" in data && data.error) ||
            `Search failed (HTTP ${res.status}).`
        );
        return;
      }
      setResult(data);
    } catch {
      setError("Network error while searching. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const mentionsApiKey = error ? /api\s*key/i.test(error) : false;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Search businesses
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Discover Dubai businesses on Google Places, filter for strong
          profiles without a website, and score the opportunity.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Discovery search</CardTitle>
          <CardDescription>
            Pick a category and the areas to scan. Results are saved to the
            database and scored automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.label} value={c.label}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pages">Pages per area</Label>
                <Select
                  id="pages"
                  value={maxPagesPerArea}
                  onChange={(e) => setMaxPagesPerArea(e.target.value)}
                >
                  <option value="1">1 page</option>
                  <option value="2">2 pages</option>
                  <option value="3">3 pages</option>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Each page returns up to 20 places per area — more pages find
                  more businesses but increase API cost.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Dubai areas</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setAreas(DUBAI_AREAS.map((a) => a.name))}
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setAreas([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md border border-border p-4 sm:grid-cols-3 lg:grid-cols-4">
                {DUBAI_AREAS.map((area) => (
                  <label
                    key={area.name}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={areas.includes(area.name)}
                      onChange={(e) => toggleArea(area.name, e.target.checked)}
                    />
                    <span className="truncate">{area.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {areas.length} of {DUBAI_AREAS.length} areas selected
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="minReviews">Min reviews</Label>
                <Input
                  id="minReviews"
                  type="number"
                  min={0}
                  value={minReviews}
                  onChange={(e) => setMinReviews(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minRating">Min rating</Label>
                <Input
                  id="minRating"
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={minRating}
                  onChange={(e) => setMinRating(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="includeChains">Chains</Label>
                <label
                  htmlFor="includeChains"
                  className="flex h-10 cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    id="includeChains"
                    checked={includeChains}
                    onChange={(e) => setIncludeChains(e.target.checked)}
                  />
                  Include known chains &amp; franchises
                </label>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <Spinner size="sm" className="text-primary-foreground" />
                ) : (
                  <SearchIcon className="h-4 w-4" />
                )}
                {loading ? "Searching…" : "Search Google Places"}
              </Button>
              {loading && (
                <p className="text-sm text-muted-foreground">
                  Searching Google Places — this can take a minute for many
                  areas.
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-6">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-destructive">{error}</p>
              {mentionsApiKey && (
                <p className="text-muted-foreground">
                  Add your Google Maps API key on the{" "}
                  <Link
                    href="/settings"
                    className="font-medium text-primary underline underline-offset-4"
                  >
                    Settings page
                  </Link>
                  .
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Search summary</CardTitle>
              <CardDescription>
                What was found and why places were skipped.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <StatChip label="Found" value={result.summary.totalFound} />
                <StatChip label="Qualified" value={result.summary.qualified} />
                <StatChip label="New" value={result.summary.saved} />
                <StatChip label="Updated" value={result.summary.updated} />
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  Object.keys(SKIPPED_LABELS) as Array<
                    keyof SearchRunSummary["skipped"]
                  >
                ).map((key) => (
                  <StatChip
                    key={key}
                    label={`Skipped: ${SKIPPED_LABELS[key]}`}
                    value={result.summary.skipped[key]}
                  />
                ))}
              </div>
              {result.summary.errors.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                  <p className="mb-1 flex items-center gap-2 font-medium">
                    <TriangleAlert className="h-4 w-4" />
                    Some areas reported errors
                  </p>
                  <ul className="list-inside list-disc space-y-0.5">
                    {result.summary.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
              <CardDescription>
                {result.businesses.length.toLocaleString()} qualified{" "}
                {result.businesses.length === 1 ? "business" : "businesses"}{" "}
                saved from this run.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {result.businesses.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">
                  No businesses qualified in this run. Try lowering the minimum
                  reviews/rating, adding more areas, or increasing pages per
                  area.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Area</TableHead>
                      <TableHead>Rating</TableHead>
                      <TableHead className="text-right">Reviews</TableHead>
                      <TableHead>Website status</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.businesses.map((b) => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/businesses/${b.id}`}
                            className="hover:underline"
                          >
                            {b.name}
                          </Link>
                        </TableCell>
                        <TableCell>{b.category}</TableCell>
                        <TableCell>{b.area ?? "—"}</TableCell>
                        <TableCell>
                          <StarRating rating={b.rating} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {b.reviewCount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <WebsiteStatusBadge status={b.websiteStatus} />
                        </TableCell>
                        <TableCell>
                          <ScoreBadge score={b.opportunityScore} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
