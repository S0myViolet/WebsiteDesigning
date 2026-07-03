import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { publishDemo } from "@/lib/deploy/netlify";
import { errorResponse, toWebsiteDto } from "@/lib/serializers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Build a wa.me link to the business's own number with a short pitch. */
function whatsappShareUrl(phone: string | null, businessName: string, demoUrl: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, "");
  if (digits.length < 8) return null;
  const text =
    `Hi! I put together a website concept for ${businessName} — ` +
    `you can see the draft here: ${demoUrl}\n\n` +
    `It's just a first idea based on your public Google profile. ` +
    `Happy to adjust anything or walk you through it.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export async function POST(
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
    if (!business.website?.previewHtml) {
      return NextResponse.json(
        { error: "Generate the website first — there is no preview to publish yet." },
        { status: 400 }
      );
    }

    const settings = await getSettings();
    if (!settings.netlifyToken) {
      return NextResponse.json(
        {
          error:
            "No Netlify token configured. Create a free account at netlify.com, then add a personal access token in Settings (or NETLIFY_TOKEN in .env).",
        },
        { status: 400 }
      );
    }

    const { url, siteId } = await publishDemo({
      html: business.website.previewHtml,
      businessName: business.name,
      token: settings.netlifyToken,
      siteId: business.website.demoSiteId,
    });

    const updated = await prisma.generatedWebsite.update({
      where: { businessId: business.id },
      data: { demoUrl: url, demoSiteId: siteId, demoDeployedAt: new Date() },
    });

    return NextResponse.json({
      website: toWebsiteDto(updated),
      whatsappUrl: whatsappShareUrl(business.phone, business.name, url),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
