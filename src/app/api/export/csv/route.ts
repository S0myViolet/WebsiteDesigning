import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { businessesToCsv } from "@/lib/csv";
import {
  applyWebsiteVisibilityDefault,
  BUSINESS_LIST_INCLUDE,
  buildBusinessOrderBy,
  buildBusinessWhere,
  businessFiltersSchema,
  errorResponse,
  queryToObject,
  toBusinessListItem,
} from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const parsed = businessFiltersSchema.safeParse(
      queryToObject(req.nextUrl.searchParams)
    );
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: `Invalid query: ${issue?.path.join(".") || "params"} — ${issue?.message || "invalid"}` },
        { status: 400 }
      );
    }

    const { sortBy, sortDir, ...filters } = parsed.data;
    const settings = await getSettings();
    const rows = await prisma.business.findMany({
      where: applyWebsiteVisibilityDefault(
        buildBusinessWhere(filters),
        filters,
        settings.includeUncertainWebsites
      ),
      orderBy: buildBusinessOrderBy(sortBy, sortDir),
      include: BUSINESS_LIST_INCLUDE,
    });
    const csv = businessesToCsv(rows.map(toBusinessListItem), settings.exportColumns);

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="dubai-leads-${date}.csv"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
