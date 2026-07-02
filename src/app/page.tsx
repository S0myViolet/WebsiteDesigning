import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  Building2,
  Globe,
  LayoutTemplate,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import { prisma } from "@/lib/db";
import type { WebsiteStatus } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface StatCard {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}

export default async function OverviewPage() {
  const [
    totalBusinesses,
    noWebsiteCount,
    analyzedCount,
    generatedCount,
    savedLeadsCount,
    topOpportunities,
  ] = await Promise.all([
    prisma.business.count(),
    prisma.business.count({
      where: { websiteStatus: { in: ["NO_WEBSITE_LISTED", "LIKELY_MISSING"] } },
    }),
    prisma.analysis.count(),
    prisma.generatedWebsite.count(),
    prisma.leadStatus.count({ where: { status: { not: "NEW" } } }),
    prisma.business.findMany({
      where: { opportunityScore: { not: null } },
      orderBy: { opportunityScore: "desc" },
      take: 10,
    }),
  ]);

  const stats: StatCard[] = [
    { label: "Total businesses", value: totalBusinesses, icon: Building2 },
    { label: "No website listed", value: noWebsiteCount, icon: Globe },
    { label: "Analyzed", value: analyzedCount, icon: Sparkles },
    { label: "Websites generated", value: generatedCount, icon: LayoutTemplate },
    { label: "Saved leads", value: savedLeadsCount, icon: Bookmark },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Dubai businesses with strong Google Maps profiles but no website.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/search" className={cn(buttonVariants({ size: "sm" }))}>
            <Search className="h-4 w-4" />
            Search businesses
          </Link>
          <Link
            href="/businesses"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Building2 className="h-4 w-4" />
            View all
          </Link>
          <Link
            href="/settings"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </p>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
                  {stat.value.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {totalBusinesses === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Search className="h-5 w-5 text-muted-foreground" />
            </span>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">Run your first search</h2>
              <p className="max-w-md text-sm text-muted-foreground">
                No businesses in the database yet. Search Google Places for a
                category and Dubai areas to discover businesses without a
                website.
              </p>
            </div>
            <Link href="/search" className={cn(buttonVariants())}>
              <Search className="h-4 w-4" />
              Search businesses
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1.5">
              <CardTitle>Top opportunities</CardTitle>
              <CardDescription>
                Highest-scored businesses across all searches.
              </CardDescription>
            </div>
            <Link
              href="/businesses"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {topOpportunities.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                No scored businesses yet. Run a search or analyze existing
                businesses to compute opportunity scores.
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
                    <TableHead>Score</TableHead>
                    <TableHead>Website status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topOpportunities.map((b) => (
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
                        <ScoreBadge score={b.opportunityScore} />
                      </TableCell>
                      <TableCell>
                        <WebsiteStatusBadge
                          status={b.websiteStatus as WebsiteStatus}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
