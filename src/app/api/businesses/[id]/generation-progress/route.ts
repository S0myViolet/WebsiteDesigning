import { NextResponse } from "next/server";
import { getGenerationProgress } from "@/lib/generation-progress";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Polled by the generate page while a quality-gated generation is running. */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const progress = getGenerationProgress(params.id);
  return NextResponse.json(progress ? { active: true, ...progress } : { active: false });
}
