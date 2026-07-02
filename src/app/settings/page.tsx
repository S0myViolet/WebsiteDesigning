"use client";

import * as React from "react";
import { AlertCircle, Check, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ApiKeyField } from "@/components/settings/api-key-field";
import { CheckboxGrid } from "@/components/settings/checkbox-grid";
import {
  AI_MODEL_OPTIONS,
  CATEGORIES,
  DEFAULT_SETTINGS,
  DUBAI_AREAS,
  WEBSITE_STYLE_OPTIONS,
} from "@/lib/constants";
import type { AppSettings } from "@/lib/types";

interface MaskedSettings extends AppSettings {
  hasGoogleKey: boolean;
  hasOpenaiKey: boolean;
  hasSearchKey: boolean;
}

const AREA_OPTIONS = DUBAI_AREAS.map((area) => area.name);
const CATEGORY_OPTIONS = CATEGORIES.map((category) => category.label);
const EXPORT_COLUMN_OPTIONS = DEFAULT_SETTINGS.exportColumns;

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;
  return data?.error || `Request failed (${res.status})`;
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((item) => set.has(item));
}

/** True when the value is safe to send as a new API key (not blank/masked). */
function isNewKey(value: string): boolean {
  return value.trim() !== "" && !value.includes("…");
}

export default function SettingsPage() {
  const [snapshot, setSnapshot] = React.useState<MaskedSettings | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // API keys (start empty; masked values shown as placeholders)
  const [googleKey, setGoogleKey] = React.useState("");
  const [openaiKey, setOpenaiKey] = React.useState("");
  const [searchKey, setSearchKey] = React.useState("");
  const [searchEngineId, setSearchEngineId] = React.useState("");
  // Stored keys marked for removal on save (sent as "" so the DB override is
  // cleared and getSettings falls back to the env var).
  const [clearKeys, setClearKeys] = React.useState<{
    google: boolean;
    openai: boolean;
    search: boolean;
  }>({ google: false, openai: false, search: false });

  // Discovery defaults
  const [minReviews, setMinReviews] = React.useState("50");
  const [minRating, setMinRating] = React.useState("4");
  const [includeChains, setIncludeChains] = React.useState(false);
  const [includeUncertain, setIncludeUncertain] = React.useState(false);
  const [areas, setAreas] = React.useState<string[]>([]);
  const [categories, setCategories] = React.useState<string[]>([]);

  // Generation
  const [style, setStyle] = React.useState<string>(
    DEFAULT_SETTINGS.defaultWebsiteStyle
  );
  const [model, setModel] = React.useState<string>(DEFAULT_SETTINGS.aiModel);

  // Export
  const [exportCols, setExportCols] = React.useState<string[]>([]);

  const [saving, setSaving] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<string | null>(null);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const applyLoaded = React.useCallback((data: MaskedSettings) => {
    setSnapshot(data);
    setGoogleKey("");
    setOpenaiKey("");
    setSearchKey("");
    setClearKeys({ google: false, openai: false, search: false });
    setSearchEngineId(data.searchEngineId);
    setMinReviews(String(data.minReviews));
    setMinRating(String(data.minRating));
    setIncludeChains(data.includeChains);
    setIncludeUncertain(data.includeUncertainWebsites);
    setAreas(data.defaultAreas);
    setCategories(data.defaultCategories);
    setStyle(data.defaultWebsiteStyle);
    setModel(data.aiModel);
    setExportCols(data.exportColumns);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) setLoadError(await readError(res));
          return;
        }
        const data = (await res.json()) as MaskedSettings;
        if (!cancelled) applyLoaded(data);
      } catch {
        if (!cancelled) {
          setLoadError("Network error — could not load settings.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyLoaded]);

  function buildPayload(current: MaskedSettings): Partial<AppSettings> {
    const payload: Partial<AppSettings> = {};

    // API keys — send freshly typed, non-masked values; a pending clear
    // sends "" (removes the stored override) unless a new key was typed.
    if (isNewKey(googleKey)) payload.googleMapsApiKey = googleKey.trim();
    else if (clearKeys.google) payload.googleMapsApiKey = "";
    if (isNewKey(openaiKey)) payload.openaiApiKey = openaiKey.trim();
    else if (clearKeys.openai) payload.openaiApiKey = "";
    if (isNewKey(searchKey)) payload.searchApiKey = searchKey.trim();
    else if (clearKeys.search) payload.searchApiKey = "";
    if (searchEngineId.trim() !== current.searchEngineId) {
      payload.searchEngineId = searchEngineId.trim();
    }

    const parsedMinReviews = Number.parseInt(minReviews, 10);
    if (
      Number.isFinite(parsedMinReviews) &&
      parsedMinReviews >= 0 &&
      parsedMinReviews !== current.minReviews
    ) {
      payload.minReviews = parsedMinReviews;
    }
    const parsedMinRating = Number.parseFloat(minRating);
    if (
      Number.isFinite(parsedMinRating) &&
      parsedMinRating >= 0 &&
      parsedMinRating <= 5 &&
      parsedMinRating !== current.minRating
    ) {
      payload.minRating = parsedMinRating;
    }
    if (includeChains !== current.includeChains) {
      payload.includeChains = includeChains;
    }
    if (includeUncertain !== current.includeUncertainWebsites) {
      payload.includeUncertainWebsites = includeUncertain;
    }
    if (!sameSet(areas, current.defaultAreas)) payload.defaultAreas = areas;
    if (!sameSet(categories, current.defaultCategories)) {
      payload.defaultCategories = categories;
    }
    if (style !== current.defaultWebsiteStyle) {
      payload.defaultWebsiteStyle = style;
    }
    if (model !== current.aiModel) payload.aiModel = model;
    if (!sameSet(exportCols, current.exportColumns)) {
      payload.exportColumns = exportCols;
    }
    return payload;
  }

  async function handleSave() {
    if (!snapshot) return;
    setSaveMessage(null);
    setSaveError(null);
    const payload = buildPayload(snapshot);
    if (Object.keys(payload).length === 0) {
      setSaveMessage("No changes to save.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setSaveError(await readError(res));
        return;
      }
      const data = (await res.json()) as MaskedSettings;
      applyLoaded(data);
      setSaveMessage("Settings saved.");
    } catch {
      setSaveError("Network error — could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (loadError || !snapshot) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="font-medium">
              {loadError || "Could not load settings."}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Reload
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const styleOptions = (WEBSITE_STYLE_OPTIONS as readonly string[]).includes(
    style
  )
    ? [...WEBSITE_STYLE_OPTIONS]
    : [style, ...WEBSITE_STYLE_OPTIONS];
  const modelOptions = (AI_MODEL_OPTIONS as readonly string[]).includes(model)
    ? [...AI_MODEL_OPTIONS]
    : [model, ...AI_MODEL_OPTIONS];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          API keys, discovery defaults, generation and export preferences.
        </p>
      </div>

      {/* API keys */}
      <Card>
        <CardHeader>
          <CardTitle>API keys</CardTitle>
          <CardDescription>
            Keys can also be set via <code className="font-mono">.env</code>.
            Values entered here are stored in the local database. Leave a field
            blank to keep the current key.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ApiKeyField
            id="google-maps-key"
            label="Google Maps API key"
            configured={snapshot.hasGoogleKey}
            maskedValue={snapshot.googleMapsApiKey}
            value={googleKey}
            onChange={setGoogleKey}
            helpText="Required for business discovery via the Places API."
            pendingClear={clearKeys.google}
            onClear={() => setClearKeys((c) => ({ ...c, google: true }))}
          />
          <ApiKeyField
            id="openai-key"
            label="OpenAI API key"
            configured={snapshot.hasOpenaiKey}
            maskedValue={snapshot.openaiApiKey}
            value={openaiKey}
            onChange={setOpenaiKey}
            helpText="Required for review analysis and website copy generation."
            pendingClear={clearKeys.openai}
            onClear={() => setClearKeys((c) => ({ ...c, openai: true }))}
          />
          <ApiKeyField
            id="search-key"
            label="Custom Search API key"
            configured={snapshot.hasSearchKey}
            maskedValue={snapshot.searchApiKey}
            value={searchKey}
            onChange={setSearchKey}
            helpText="Optional — improves website detection accuracy."
            pendingClear={clearKeys.search}
            onClear={() => setClearKeys((c) => ({ ...c, search: true }))}
          />
          <div className="space-y-1.5">
            <Label htmlFor="search-engine-id">Search engine ID</Label>
            <Input
              id="search-engine-id"
              value={searchEngineId}
              onChange={(event) => setSearchEngineId(event.target.value)}
              placeholder="Custom Search engine ID (cx)"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              The Programmable Search Engine ID used with the Custom Search
              key.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Discovery defaults */}
      <Card>
        <CardHeader>
          <CardTitle>Discovery defaults</CardTitle>
          <CardDescription>
            Defaults applied when running a new business search.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="min-reviews">Minimum reviews</Label>
              <Input
                id="min-reviews"
                type="number"
                min={0}
                value={minReviews}
                onChange={(event) => setMinReviews(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min-rating">Minimum rating</Label>
              <Input
                id="min-rating"
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={minRating}
                onChange={(event) => setMinRating(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={includeChains}
                onChange={(event) => setIncludeChains(event.target.checked)}
              />
              Include chains and franchises
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={includeUncertain}
                onChange={(event) =>
                  setIncludeUncertain(event.target.checked)
                }
              />
              Include uncertain website cases (possibly exists / needs manual
              review)
            </label>
          </div>
          <div className="space-y-2">
            <Label>Default areas</Label>
            <CheckboxGrid
              options={AREA_OPTIONS}
              selected={areas}
              onChange={setAreas}
              withSelectAll
            />
          </div>
          <div className="space-y-2">
            <Label>Default categories</Label>
            <CheckboxGrid
              options={CATEGORY_OPTIONS}
              selected={categories}
              onChange={setCategories}
              withSelectAll
            />
          </div>
        </CardContent>
      </Card>

      {/* Generation */}
      <Card>
        <CardHeader>
          <CardTitle>Generation</CardTitle>
          <CardDescription>
            Defaults for AI analysis and website drafts.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="website-style">Default website style</Label>
            <Select
              id="website-style"
              value={style}
              onChange={(event) => setStyle(event.target.value)}
            >
              {styleOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-model">AI model</Label>
            <Select
              id="ai-model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
            >
              {modelOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Export */}
      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>
            Columns included in the CSV export.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CheckboxGrid
            options={EXPORT_COLUMN_OPTIONS}
            selected={exportCols}
            onChange={setExportCols}
          />
        </CardContent>
      </Card>

      {/* Compliance note */}
      <Card>
        <CardHeader className="flex-row items-start gap-3 space-y-0">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="space-y-1.5">
            <CardTitle className="text-base">Compliance note</CardTitle>
            <CardDescription>
              Use this tool responsibly.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>
              Generated websites are drafts for internal review and client
              pitches — they are not published anywhere automatically.
            </li>
            <li>
              No automated outreach: contact businesses manually and
              respectfully, and honor opt-out requests.
            </li>
            <li>
              Respect the Google Maps Platform Terms of Service — use listing
              data only for lead qualification, not for republishing.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Spinner size="sm" className="text-primary-foreground" />
          ) : null}
          {saving ? "Saving…" : "Save settings"}
        </Button>
        {saveMessage && (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" /> {saveMessage}
          </span>
        )}
        {saveError && (
          <span className="inline-flex items-start gap-1 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {saveError}
          </span>
        )}
      </div>
    </div>
  );
}
