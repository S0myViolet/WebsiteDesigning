// Backward-compatible entry point for the draft-website renderer. The actual
// rendering now lives in layouts.ts (six layout variants driven by the design
// brief and visual style); this wrapper keeps the original buildPreviewHtml
// signature working for callers that have no brief/style (e.g. seed/demo
// flows) by selecting a sensible layout from the business category.

import type {
  DesignBriefJson,
  LayoutType,
  VisualStyleJson,
  WebsiteCopyJson,
} from "@/lib/types";
import {
  renderWebsite,
  type PreviewBusiness,
  type RenderContext,
} from "@/lib/website-builder/layouts";
import { selectLayout } from "@/lib/website-builder/layout-select";

export interface PreviewInput {
  business: PreviewBusiness;
  copy: WebsiteCopyJson;
  /** Optional pipeline artifacts — when present the preview is fully styled */
  brief?: DesignBriefJson | null;
  style?: VisualStyleJson | null;
  layout?: LayoutType;
}

export function buildPreviewHtml(input: PreviewInput): string {
  const layout =
    input.layout ??
    selectLayout({
      category: input.business.category,
      briefRecommendation: input.brief?.recommended_layout_type ?? null,
      storedReviewCount: 1, // legacy callers have no stored-review info
      hasPhone: Boolean(input.business.phone),
      hasHours: input.business.openingHours.length > 0,
      hasEditorialSummary: true,
    });

  const ctx: RenderContext = {
    business: input.business,
    copy: input.copy,
    brief: input.brief ?? null,
    style: input.style ?? null,
    layout,
  };
  return renderWebsite(ctx);
}
