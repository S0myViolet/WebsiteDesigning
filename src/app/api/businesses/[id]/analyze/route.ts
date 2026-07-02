import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  BUSINESS_LIST_INCLUDE,
  errorResponse,
  runAnalysis,
  toAnalysisDto,
  toBusinessListItem,
} from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { analysisRow } = await runAnalysis(params.id);

    const business = await prisma.business.findUnique({
      where: { id: params.id },
      include: BUSINESS_LIST_INCLUDE,
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    return NextResponse.json({
      analysis: toAnalysisDto(analysisRow),
      business: toBusinessListItem(business),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
