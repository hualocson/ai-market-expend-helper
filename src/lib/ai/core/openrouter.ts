import type { z } from "zod";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

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

const readContent = (content: unknown) => {
  if (typeof content !== "string") {
    return null;
  }

  const trimmed = content.trim();
  return trimmed.length > 0 ? trimmed : null;
};

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

  try {
    response = await fetchFn(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        response_format: {
          type: "json_schema",
          json_schema: jsonSchema,
        },
      }),
    });
  } catch {
    return { ok: false, reason: "request_failed" };
  }

  if (!response.ok) {
    return { ok: false, reason: "request_failed" };
  }

  let payload: {
    choices?: Array<{ message?: { content?: unknown } }>;
  };

  try {
    payload = (await response.json()) as typeof payload;
  } catch {
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
