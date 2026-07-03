// Response shapes returned by the API routes and consumed by the dashboard UI.
import type {
  AnalysisJson,
  BrandIdentityJson,
  HandoffChecklist,
  BusinessListItem,
  CreativeDirectionJson,
  DesignSystemJson,
  DesignBriefJson,
  GenerationStatus,
  LayoutType,
  LeadStatusValue,
  QualityReportJson,
  ResearchResult,
  ReviewKeyword,
  ScoreBreakdown,
  SearchRunSummary,
  UniquenessNotes,
  VisualStyleJson,
  WebsiteCopyJson,
  WebsiteStatus,
} from "@/lib/types";

export interface ReviewDto {
  id: string;
  reviewText: string;
  reviewRating: number | null;
  reviewDate: string | null;
  reviewerName: string | null;
}

export interface AnalysisDto {
  businessSummary: string;
  strengths: string[];
  weaknesses: string[];
  targetCustomers: string[];
  services: string[];
  recommendedPositioning: string | null;
  seoKeywords: string[];
  localSeoPhrases: string[];
  tone: string | null;
  suggestedCta: string | null;
  recommendedSections: string[];
  opportunityScore: number;
  scoreBreakdown: ScoreBreakdown | null;
  opportunityReasoning: string | null;
  raw: AnalysisJson | null;
  updatedAt: string;
}

export interface WebsiteDto {
  seoTitle: string | null;
  seoDescription: string | null;
  suggestedDomainNames: string[];
  colorPalette: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  } | null;
  fontRecommendation: string | null;
  previewUrl: string | null;
  hasPreview: boolean;
  hasCode: boolean;
  copy: WebsiteCopyJson | null;
  /** Layout variant used to render the site */
  layoutType: LayoutType | null;
  /** Strategy document generated before the copy */
  designBrief: DesignBriefJson | null;
  /** Per-site visual design system */
  visualStyle: VisualStyleJson | null;
  /** Quality-gate score (0-100) and full report */
  qualityScore: number | null;
  qualityReport: QualityReportJson | null;
  /** Blocking-gate outcome: a draft below the bar is failed, not completed */
  generationStatus: GenerationStatus | null;
  /** Attempts used by the last quality-gated generation run */
  qualityAttempts: number | null;
  /** Best score reached across those attempts */
  bestAttemptScore: number | null;
  /** The design concept invented for this business */
  creativeDirection: CreativeDirectionJson | null;
  /** Deeper design system (typography pairing, density, dividers, motion) */
  designSystem: DesignSystemJson | null;
  /** Structural-uniqueness comparison against other generated sites */
  uniquenessNotes: UniquenessNotes | null;
  /** Public unguessable demo URL (when published) */
  demoUrl: string | null;
  demoDeployedAt: string | null;
  updatedAt: string;
}

export interface LeadStatusDto {
  status: LeadStatusValue;
  notes: string | null;
  contactedAt: string | null;
  /** Client-delivery checklist (present once a lead reaches WON) */
  handoff: HandoffChecklist | null;
  updatedAt: string;
}

export interface BusinessDetail extends BusinessListItem {
  openingHours: string[];
  editorialSummary: string | null;
  photosCount: number;
  keywords: ReviewKeyword[];
  lat: number | null;
  lng: number | null;
  isLikelyChain: boolean;
  scoreBreakdown: ScoreBreakdown | null;
  reviews: ReviewDto[];
  analysis: AnalysisDto | null;
  website: WebsiteDto | null;
  lead: LeadStatusDto | null;
  /** Compliant public-research findings (sources + snippets), when run */
  research: ResearchResult | null;
  /** Logo / brand identity extraction result (null = not scanned yet) */
  brandIdentity: BrandIdentityJson | null;
}

export interface BusinessListResponse {
  businesses: BusinessListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SearchBusinessesResponse {
  summary: SearchRunSummary;
  businesses: BusinessListItem[];
}

export interface VerifyWebsiteResponse {
  status: WebsiteStatus;
  foundUrl: string | null;
  evidence: string[];
}

export interface ApiError {
  error: string;
}
