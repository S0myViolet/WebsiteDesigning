// Response shapes returned by the API routes and consumed by the dashboard UI.
import type {
  AnalysisJson,
  BusinessListItem,
  CreativeDirectionJson,
  DesignBriefJson,
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
  /** The design concept invented for this business */
  creativeDirection: CreativeDirectionJson | null;
  /** Structural-uniqueness comparison against other generated sites */
  uniquenessNotes: UniquenessNotes | null;
  updatedAt: string;
}

export interface LeadStatusDto {
  status: LeadStatusValue;
  notes: string | null;
  contactedAt: string | null;
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
