// Claude (Anthropic API) implementations of the app's two AI call shapes:
// JSON-mode chat and vision-with-images. Selected automatically whenever the
// configured model is a claude-* model (see chatJson/visionJson in
// openai-client.ts, which route between providers).

import Anthropic from "@anthropic-ai/sdk";
import { fetch as undiciFetch, ProxyAgent } from "undici";

/**
 * When HTTPS_PROXY is set (corporate proxies, sandboxed environments),
 * Next.js's bundled fetch ignores it — route Anthropic calls through the
 * proxy explicitly. Without a proxy the SDK uses its default fetch.
 */
function proxyAwareFetch(): typeof fetch | undefined {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  if (!proxy) return undefined;
  const dispatcher = new ProxyAgent(proxy);
  const wrapped = (url: Parameters<typeof undiciFetch>[0], init?: RequestInit) =>
    undiciFetch(url, {
      ...(init as Parameters<typeof undiciFetch>[1]),
      dispatcher,
    });
  return wrapped as unknown as typeof fetch;
}

/** True when the configured model should be served by the Claude API. */
export function isClaudeModel(model: string): boolean {
  return /^claude-/i.test(model.trim());
}

/**
 * Adaptive thinking is supported on Claude 4.6+ / Opus 4.7+ / Sonnet 5 /
 * Fable 5; older tiers (e.g. Haiku 4.5) reject it, so we omit the thinking
 * parameter there.
 */
function supportsAdaptiveThinking(model: string): boolean {
  return /^claude-(opus-4-[678]|sonnet-5|sonnet-4-6|fable|mythos)/i.test(model);
}

export function getAnthropic(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, fetch: proxyAwareFetch() });
}

/**
 * Pick the API key matching the configured model's provider. Returns a
 * user-facing error string when the required key is missing, so API routes
 * can 400 with a message that names the right key for the selected model.
 */
export function resolveAiCredentials(settings: {
  aiModel: string;
  anthropicApiKey: string;
  openaiApiKey: string;
}): { apiKey: string; model: string; missingKeyError: string | null } {
  const model = settings.aiModel;
  if (isClaudeModel(model)) {
    return {
      apiKey: settings.anthropicApiKey,
      model,
      missingKeyError: settings.anthropicApiKey
        ? null
        : `Add your Claude (Anthropic) API key in Settings or .env — the selected AI model "${model}" uses the Claude API.`,
    };
  }
  return {
    apiKey: settings.openaiApiKey,
    model,
    missingKeyError: settings.openaiApiKey
      ? null
      : `Add your OpenAI API key in Settings or .env — the selected AI model "${model}" uses the OpenAI API.`,
  };
}

/**
 * Claude has no forced-JSON response mode for prompt-shaped JSON, so strip a
 * markdown fence if the model added one before parsing.
 */
function extractJsonPayload(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1].trim() : trimmed;
}

function textFromResponse(response: Anthropic.Message, model: string): string {
  if (response.stop_reason === "refusal") {
    throw new Error(`Claude declined the request (model: ${model}).`);
  }
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  if (!text.trim()) {
    throw new Error(
      `Claude returned an empty response (model: ${model}, stop_reason: ${response.stop_reason ?? "unknown"})`
    );
  }
  return text;
}

function parseJsonOrThrow<T>(text: string, model: string): T {
  try {
    return JSON.parse(extractJsonPayload(text)) as T;
  } catch {
    throw new Error(
      `Claude response was not valid JSON (model: ${model}). Payload starts with: ${text.slice(0, 200)}`
    );
  }
}

/** Data-URL → Anthropic image content block. */
function imageBlock(dataUrl: string): Anthropic.ImageBlockParam {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([\s\S]+)$/);
  if (!match) throw new Error("Unsupported image data URL for Claude vision call.");
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: match[1] as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
      data: match[2],
    },
  };
}

export interface ClaudeJsonOptions {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  /** Optional images (data URLs) appended after the user text */
  imageDataUrls?: string[];
}

/**
 * One JSON-producing Claude call. Adaptive thinking is enabled on models
 * that support it (thinking tokens count toward max_tokens, so the ceiling
 * gets generous headroom); sampling parameters are never sent — Opus 4.7+
 * rejects them.
 */
export async function claudeJson<T>(opts: ClaudeJsonOptions): Promise<T> {
  const client = getAnthropic(opts.apiKey);
  const content: Anthropic.ContentBlockParam[] = [
    { type: "text", text: opts.user },
    ...(opts.imageDataUrls ?? []).map(imageBlock),
  ];
  const response = await client.messages.create({
    model: opts.model,
    // Thinking shares the output budget — keep headroom above the caller's ask.
    max_tokens: Math.max(opts.maxTokens ?? 3000, 8192),
    ...(supportsAdaptiveThinking(opts.model)
      ? { thinking: { type: "adaptive" as const } }
      : {}),
    system: `${opts.system}\n\nRespond with VALID JSON ONLY — no prose, no markdown fences.`,
    messages: [{ role: "user", content }],
  });
  return parseJsonOrThrow<T>(textFromResponse(response, opts.model), opts.model);
}
