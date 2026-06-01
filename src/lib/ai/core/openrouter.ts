import type { z } from "zod";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export const OPENROUTER_PRIMARY_MODEL = "google/gemma-4-31b-it:free";

// Ordered free OpenRouter model candidates shared by expense parsing, expense
// search parsing, and budget suggestions. OpenRouter routes the `models` array
// in order and falls back to the next when a model is unavailable, errors, or is
// rate-limited (429).
export const OPENROUTER_MODELS = [
  OPENROUTER_PRIMARY_MODEL,
  // "qwen/qwen3-next-80b-a3b-instruct:free",
  "openai/gpt-oss-120b:free",
];

// Build the routing list for a request: the caller's primary first, then the
// remaining shared candidates (deduped).
export const withFallbackModels = (primary: string): string[] => [
  primary,
  ...OPENROUTER_MODELS.filter((model) => model !== primary),
];

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type OpenRouterJsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OpenRouterJsonFailureReason =
  | "request_failed"
  | "invalid_response"
  | "schema_mismatch";

export type OpenRouterJsonResult<T> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      reason: OpenRouterJsonFailureReason;
    };

type CallOpenRouterJsonArgs<TSchema extends z.ZodType> = {
  apiKey: string;
  model: string;
  messages: OpenRouterMessage[];
  jsonSchema: OpenRouterJsonSchema;
  schema: TSchema;
  fetchFn?: typeof fetch;
};

const debugOpenRouterFailure = (
  message: string,
  details: Record<string, unknown>
) => {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  console.warn(`[openrouter] ${message}`, details);
};

const readContent = (content: unknown) => {
  if (typeof content !== "string") {
    return null;
  }

  const trimmed = content.trim();
  return trimmed.length > 0 ? trimmed : null;
};

type OpenRouterResponsePayload = {
  choices?: Array<{ message?: { content?: unknown } }>;
};

const isOpenRouterResponsePayload = (
  payload: unknown
): payload is OpenRouterResponsePayload =>
  typeof payload === "object" && payload !== null;

export const callOpenRouterJson = async <TSchema extends z.ZodType>({
  apiKey,
  model,
  messages,
  jsonSchema,
  schema,
  fetchFn = fetch,
}: CallOpenRouterJsonArgs<TSchema>): Promise<
  OpenRouterJsonResult<z.infer<TSchema>>
> => {
  let response: Response;
  const models = withFallbackModels(model);

  try {
    response = await fetchFn(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        models,
        messages,
        response_format: {
          type: "json_schema",
          json_schema: jsonSchema,
        },
      }),
    });
  } catch (error) {
    debugOpenRouterFailure("fetch threw", {
      model,
      models,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, reason: "request_failed" };
  }

  if (!response.ok) {
    let bodySnippet = "";
    try {
      bodySnippet = (await response.text()).slice(0, 500);
    } catch {
      bodySnippet = "(failed to read response body)";
    }

    debugOpenRouterFailure("non-ok response", {
      model,
      models,
      status: response.status,
      statusText: response.statusText,
      bodySnippet,
    });
    return { ok: false, reason: "request_failed" };
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return { ok: false, reason: "invalid_response" };
  }

  if (!isOpenRouterResponsePayload(payload)) {
    return { ok: false, reason: "invalid_response" };
  }

  const content = readContent(payload.choices?.[0]?.message?.content);
  if (!content) {
    return { ok: false, reason: "invalid_response" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, reason: "invalid_response" };
  }

  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    return { ok: false, reason: "schema_mismatch" };
  }

  return { ok: true, value: validated.data };
};
