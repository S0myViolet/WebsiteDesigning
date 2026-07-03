import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { brandIdentityFromUpload, emptyBrandIdentity } from "@/lib/ai/logo-detection";
import { errorResponse } from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ~2MB of base64 (≈1.5MB image) — logos should be far smaller.
const MAX_DATA_URL_LENGTH = 2_000_000;

const bodySchema = z.object({
  dataUrl: z
    .string()
    .max(MAX_DATA_URL_LENGTH, "Image too large (max ~1.5MB)")
    .regex(/^data:image\/(png|jpeg|webp);base64,/, "Expected a PNG/JPEG/WEBP data URL"),
});

/**
 * Manual logo override: upload a real logo (e.g. supplied by the owner after
 * a pitch). Stored as a high-confidence "uploaded" brand identity — automatic
 * extraction never overwrites it. Regenerate the website to apply it.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: `Invalid upload: ${issue?.message ?? "bad body"}` },
        { status: 400 }
      );
    }
    const business = await prisma.business.findUnique({ where: { id: params.id } });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const identity = await brandIdentityFromUpload(parsed.data.dataUrl, business.name);
    await prisma.business.update({
      where: { id: business.id },
      data: { brandIdentityJson: JSON.stringify(identity) },
    });
    return NextResponse.json({ brandIdentity: identity });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Remove the logo: the site falls back to a text wordmark. The cleared state
 * is remembered (marked manually removed) so a rerun doesn't resurrect it
 * unless the user runs a fresh full generation.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const business = await prisma.business.findUnique({ where: { id: params.id } });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }
    const identity = emptyBrandIdentity(0, "Logo manually removed — using the text wordmark.");
    identity.logo_source_type = "uploaded"; // manual state: auto-extraction won't overwrite
    await prisma.business.update({
      where: { id: business.id },
      data: { brandIdentityJson: JSON.stringify(identity) },
    });
    return NextResponse.json({ brandIdentity: identity });
  } catch (err) {
    return errorResponse(err);
  }
}
