// CSV export for the businesses table (GET /api/export/csv).
// RFC 4180 formatting with a UTF-8 BOM so Excel opens the file correctly.

import { WEBSITE_STATUS_LABELS } from "@/lib/types";
import type { BusinessListItem } from "@/lib/types";

type CellValue = string | number | boolean | null | undefined;
type ColumnAccessor = (row: BusinessListItem) => CellValue;

/** Default export columns (matches DEFAULT_SETTINGS.exportColumns). */
const DEFAULT_COLUMNS: string[] = [
  "name",
  "category",
  "area",
  "address",
  "phone",
  "rating",
  "reviewCount",
  "websiteStatus",
  "opportunityScore",
  "googleMapsUrl",
  "businessSummary",
  "leadStatus",
];

/** Known column ids mapped to value accessors; unknown ids are ignored. */
const COLUMN_ACCESSORS: Record<string, ColumnAccessor | undefined> = {
  id: (row) => row.id,
  placeId: (row) => row.placeId,
  name: (row) => row.name,
  category: (row) => row.category,
  area: (row) => row.area,
  address: (row) => row.address,
  phone: (row) => row.phone,
  rating: (row) => row.rating,
  reviewCount: (row) => row.reviewCount,
  websiteUrl: (row) => row.websiteUrl,
  websiteStatus: (row) => WEBSITE_STATUS_LABELS[row.websiteStatus] ?? row.websiteStatus,
  googleMapsUrl: (row) => row.googleMapsUrl,
  opportunityScore: (row) => row.opportunityScore,
  businessSummary: (row) => row.businessSummary,
  leadStatus: (row) => row.leadStatus,
  leadNotes: (row) => row.leadNotes,
  hasAnalysis: (row) => row.hasAnalysis,
  hasWebsite: (row) => row.hasWebsite,
  createdAt: (row) => row.createdAt,
};

/**
 * Escape a single CSV field per RFC 4180: fields containing a comma, double
 * quote, or newline are wrapped in double quotes with inner quotes doubled.
 */
function escapeCsvField(value: CellValue): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Serialize businesses to a CSV string. `columns` selects and orders the
 * columns by id (unknown ids are silently ignored); when omitted, the default
 * export column set is used. Lines are CRLF-joined and the result is prefixed
 * with a UTF-8 BOM so Excel detects the encoding.
 */
export function businessesToCsv(rows: BusinessListItem[], columns?: string[]): string {
  const requested = columns && columns.length > 0 ? columns : DEFAULT_COLUMNS;
  const active = requested.flatMap((id) => {
    const accessor = COLUMN_ACCESSORS[id];
    return accessor ? [{ id, accessor }] : [];
  });

  const header = active.map((column) => escapeCsvField(column.id)).join(",");
  const lines = rows.map((row) =>
    active.map((column) => escapeCsvField(column.accessor(row))).join(",")
  );

  return "\uFEFF" + [header, ...lines].join("\r\n");
}
