// AI provider router: every pipeline call goes through chatJson (text → JSON)
// or visionJson (images + text → JSON). The configured model decides the
// provider — claude-* models use the Claude API (anthropic-client.ts),
// gpt-* models use OpenAI. Callers never talk to an SDK directly.
import OpenAI from "openai";
import { fetch as undiciFetch, ProxyAgent } from "undici";
import { claudeJson, isClaudeModel } from "@/lib/ai/anthropic-client";

/**
 * When HTTPS_PROXY is set (corporate proxies, sandboxed environments),
 * Next.js's bundled fetch ignores it — route OpenAI calls through the proxy
 * explicitly. Without a proxy this returns undefined and the SDK uses its
 * default fetch.
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

/**
 * Construct an OpenAI client for a single call. The key comes from resolved
 * app settings (env or DB), so no module-level client/key is kept.
 */
export function getOpenAI(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, fetch: proxyAwareFetch() });
}

export interface ChatJsonOptions {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  /** Default 3000 */
  maxTokens?: number;
  /** Default 0.4 */
  temperature?: number;
}

/**
 * Runs a JSON-producing chat call on the configured provider and parses the
 * response. Throws a descriptive Error when the response is empty or is not
 * valid JSON. Claude models ignore `temperature` (removed on Opus 4.7+).
 */
export async function chatJson<T>(opts: ChatJsonOptions): Promise<T> {
  if (isClaudeModel(opts.model)) {
    return claudeJson<T>({
      apiKey: opts.apiKey,
      model: opts.model,
      system: opts.system,
      user: opts.user,
      maxTokens: opts.maxTokens,
    });
  }
  const client = getOpenAI(opts.apiKey);
  const completion = await client.chat.completions.create({
    model: opts.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: { type: "json_object" },
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 3000,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content || content.trim().length === 0) {
    throw new Error(
      `OpenAI returned an empty response (model: ${opts.model}, finish_reason: ${
        completion.choices[0]?.finish_reason ?? "unknown"
      })`
    );
  }

  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(
      `OpenAI response was not valid JSON (model: ${opts.model}). Payload starts with: ${content.slice(0, 200)}`
    );
  }
}

export interface VisionJsonOptions {
  apiKey: string;
  model: string;
  system: string;
  text: string;
  /** Images as data URLs, appended after the text */
  imageDataUrls: string[];
  maxTokens?: number;
  /** OpenAI only (Claude ignores both) */
  temperature?: number;
  detail?: "low" | "high";
}

/**
 * Vision call returning parsed JSON, routed by model like chatJson.
 * Throws on empty/unparseable responses — callers keep their own fallbacks.
 */
export async function visionJson<T>(opts: VisionJsonOptions): Promise<T> {
  if (isClaudeModel(opts.model)) {
    return claudeJson<T>({
      apiKey: opts.apiKey,
      model: opts.model,
      system: opts.system,
      user: opts.text,
      maxTokens: opts.maxTokens,
      imageDataUrls: opts.imageDataUrls,
    });
  }
  const client = getOpenAI(opts.apiKey);
  const completion = await client.chat.completions.create({
    model: opts.model,
    response_format: { type: "json_object" },
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 1200,
    messages: [
      { role: "system", content: opts.system },
      {
        role: "user",
        content: [
          { type: "text" as const, text: opts.text },
          ...opts.imageDataUrls.map((url) => ({
            type: "image_url" as const,
            image_url: { url, detail: opts.detail ?? ("low" as const) },
          })),
        ],
      },
    ],
  });
  const content = completion.choices[0]?.message?.content;
  if (!content || content.trim().length === 0) {
    throw new Error(
      `OpenAI returned an empty vision response (model: ${opts.model})`
    );
  }
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new Error(
      `OpenAI vision response was not valid JSON (model: ${opts.model}). Payload starts with: ${content.slice(0, 200)}`
    );
  }
}
