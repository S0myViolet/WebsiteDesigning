// Thin wrapper around the OpenAI SDK for JSON-mode chat completions.
import OpenAI from "openai";

/**
 * Construct an OpenAI client for a single call. The key comes from resolved
 * app settings (env or DB), so no module-level client/key is kept.
 */
export function getOpenAI(apiKey: string): OpenAI {
  return new OpenAI({ apiKey });
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
