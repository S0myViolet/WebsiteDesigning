import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { BusinessListResponse } from "@/lib/api-types";
import {
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

const querySchema = businessFiltersSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(req: NextRequest) {
  try {
    const parsed = querySchema.safeParse(queryToObject(req.nextUrl.searchParams));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: `Invalid query: ${issue?.path.join(".") || "params"} — ${issue?.message || "invalid"}` },
        { status: 400 }
      );
    }

    const { page, pageSize, sortBy, sortDir, ...filters } = parsed.data;
    const where = buildBusinessWhere(filters);
    const orderBy = buildBusinessOrderBy(sortBy, sortDir);

    const [rows, total] = await Promise.all([
      prisma.business.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: BUSINESS_LIST_INCLUDE,
      }),
      prisma.business.count({ where }),
    ]);

    const response: BusinessListResponse = {
      businesses: rows.map(toBusinessListItem),
      total,
      page,
      pageSize,
    };
    return NextResponse.json(response);
  } catch (err) {
    return errorResponse(err);
  }
}
