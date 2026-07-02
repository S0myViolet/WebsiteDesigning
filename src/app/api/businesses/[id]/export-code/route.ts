import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildZipArchive } from "@/lib/website-builder/zip";
import { parseJsonField } from "@/lib/types";
import { errorResponse } from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "business";
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const business = await prisma.business.findUnique({
      where: { id: params.id },
      include: { website: true },
    });
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const files = parseJsonField<Record<string, string> | null>(
      business.website?.generatedCode,
      null
    );
    if (!files || Object.keys(files).length === 0) {
      return NextResponse.json(
        { error: "Website code not generated yet" },
        { status: 404 }
      );
    }

    const bytes = await buildZipArchive(files);
    const filename = `${slugify(business.name)}-website-draft.zip`;

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
