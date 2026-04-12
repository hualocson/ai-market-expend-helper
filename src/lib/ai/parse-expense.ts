import { Category } from "@/enums";

import type { ParseExpenseResponse } from "./parse-expense-contract";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-oss-20b:free";
const CATEGORY_VALUES = Object.values(Category);
const DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/;

type FallbackReason =
  | "invalid_json"
  | "schema_mismatch"
  | "empty_response"
  | "request_failed";

const SYSTEM_PROMPT = `
You extract a single expense draft from short natural-language text.

Rules:
- Return only one JSON object.
- Output fields: date, amount, note, category.
- date must be DD/MM/YYYY.
- amount must be a positive number.
- note must be short.
- category must be exactly one of: ${CATEGORY_VALUES.join(", ")}.
`.trim();

const extractJsonObject = (value: string) => {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    return null;
  }

  return value.slice(start, end + 1);
};

const normalizeCategory = (value: unknown) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  return (
    CATEGORY_VALUES.find(
      (category) => category.toLowerCase() === normalized
    ) ?? null
  );
};

const extractAmountFromInput = (input: string) => {
  const match = input.match(/(\d+(?:\.\d+)?)(k|tr)?/i);

  if (!match) {
    return undefined;
  }

  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }

  const suffix = match[2]?.toLowerCase();
  if (suffix === "k") {
    return numeric * 1000;
  }

  if (suffix === "tr") {
    return numeric * 1000000;
  }

  return numeric;
};

const buildFallback = (
  originalInput: string,
  reason: FallbackReason
): ParseExpenseResponse => ({
  status: "fallback",
  originalInput,
  reason,
  prefill: {
    note: originalInput || undefined,
    amount: extractAmountFromInput(originalInput),
  },
});

type ParseExpenseArgs = {
  input: string;
  apiKey: string;
  fetchFn?: typeof fetch;
};

export const parseExpenseWithOpenRouter = async ({
  input,
  apiKey,
  fetchFn = fetch,
}: ParseExpenseArgs): Promise<ParseExpenseResponse> => {
  let response: Response;

  try {
    response = await fetchFn(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: input },
        ],
      }),
    });
  } catch {
    return buildFallback(input, "request_failed");
  }

  if (!response.ok) {
    return buildFallback(input, "request_failed");
  }

  let payload: {
    choices?: Array<{ message?: { content?: string } }>;
  };

  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    return buildFallback(input, "request_failed");
  }

  const content = payload.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return buildFallback(input, "empty_response");
  }

  const jsonBlock = extractJsonObject(content);
  if (!jsonBlock) {
    return buildFallback(input, "invalid_json");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonBlock);
  } catch {
    return buildFallback(input, "invalid_json");
  }

  const expense = parsed as {
    date?: unknown;
    amount?: unknown;
    note?: unknown;
    category?: unknown;
  };

  const category = normalizeCategory(expense.category);
  const amount = Number(expense.amount);
  const note = String(expense.note ?? "").trim();
  const date = String(expense.date ?? "").trim();

  if (
    !category ||
    !DATE_PATTERN.test(date) ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    note.length === 0
  ) {
    return buildFallback(input, "schema_mismatch");
  }

  return {
    status: "success",
    originalInput: input,
    expense: {
      date,
      amount,
      note,
      category,
    },
  };
};
