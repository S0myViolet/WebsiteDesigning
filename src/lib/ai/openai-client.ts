// Thin wrapper around the OpenAI SDK for JSON-mode chat completions.
import OpenAI from "openai";
import { fetch as undiciFetch, ProxyAgent } from "undici";

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
 * Runs a chat completion in JSON mode and parses the response body.
 * Throws a descriptive Error when the response is empty or is not valid JSON.
 */
export async function chatJson<T>(opts: ChatJsonOptions): Promise<T> {
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
