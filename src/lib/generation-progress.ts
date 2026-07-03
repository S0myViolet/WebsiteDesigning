// In-memory progress for the quality-gated generation loop, so the UI can
// poll "attempt 2 of 5" style status while the (long) POST is in flight.
// Stored on globalThis because Next.js compiles each route into its own
// module graph — a plain module-level Map would not be shared between the
// generate route (writer) and the progress route (reader).

export interface GenerationProgress {
  stage: string;
  attempt: number;
  maxAttempts: number;
  bestScore: number | null;
  startedAt: number;
}

const store: Map<string, GenerationProgress> = ((
  globalThis as unknown as { __generationProgress?: Map<string, GenerationProgress> }
).__generationProgress ??= new Map());

export function setGenerationProgress(
  businessId: string,
  update: Partial<Omit<GenerationProgress, "startedAt">> & { stage: string }
): void {
  const current = store.get(businessId);
  store.set(businessId, {
    attempt: update.attempt ?? current?.attempt ?? 1,
    maxAttempts: update.maxAttempts ?? current?.maxAttempts ?? 1,
    bestScore: update.bestScore ?? current?.bestScore ?? null,
    stage: update.stage,
    startedAt: current?.startedAt ?? Date.now(),
  });
}

export function getGenerationProgress(businessId: string): GenerationProgress | null {
  const progress = store.get(businessId);
  if (!progress) return null;
  // Stale entries (e.g. a crashed run) should not show as forever-generating.
  if (Date.now() - progress.startedAt > 15 * 60 * 1000) {
    store.delete(businessId);
    return null;
  }
  return progress;
}

export function clearGenerationProgress(businessId: string): void {
  store.delete(businessId);
}
