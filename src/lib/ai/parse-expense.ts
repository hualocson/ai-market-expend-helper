import {
  OPENROUTER_PRIMARY_MODEL,
  withFallbackModels,
} from "./core/openrouter";
import type {
  ParseExpenseBudget,
  ParseExpenseConfidence,
  ParseExpenseFallbackResponse,
  ParseExpenseResponse,
} from "./parse-expense-contract";
import {
  PARSE_EXPENSE_DATE_PATTERN,
  PARSE_EXPENSE_MIN_AMOUNT,
} from "./parse-expense-contract";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// Primary model shared with search parsing; OpenRouter falls back through the
// shared OPENROUTER_MODELS chain if this one is rate-limited or errors.
const MODEL = OPENROUTER_PRIMARY_MODEL;

type FallbackReason = ParseExpenseFallbackResponse["reason"];

const SYSTEM_PROMPT = `
You extract a single expense draft from short natural-language text and pick the best-matching budget.

Budget name is the primary signal for budget matching; category is only secondary context.
Prefer the budget whose name matches the text or common shorthand. Use category
only as supporting context or a tie-breaker, not as the main match.

Rules:
- Return only one JSON object.
- Output fields: date, amount, note, budgetId, confidence, reason.
- date must be DD/MM/YYYY.
- If the text states or implies a date — including relative dates such as "yesterday", "hôm qua", "thứ 3 tuần trước" — resolve it to DD/MM/YYYY relative to today.
- If the text mentions no date at all, return date as null. Do not guess a date.
- amount is Vietnamese dong (VND): a whole number, minimum 1000. Expand shorthand: "35k" = 35000, "1.2tr" = 1200000.
- note must be a short, natural Vietnamese phrase. Normalize shorthand, e.g. "cf sua da" -> "Cà phê sữa đá".
- budgetId must be exactly one of the provided budget ids, or null when none plausibly matches. Never invent an id.
- Match using the budget name first. Category is only secondary context. Match Vietnamese with or without diacritics, and common shorthand (cf = coffee, xang = fuel, grab = transport or food).
- confidence is "high" only when amount, note, and a non-null budgetId are all confidently determined; a missing date does not lower confidence because today is used by default. Otherwise "medium" or "low".
- reason is a short explanation of the budget match.
`.trim();

const buildUserContent = (
  input: string,
  budgets: ParseExpenseBudget[],
  today: string
) => {
  const budgetLines = budgets.length
    ? budgets
        .map(
          (budget) =>
            `- id ${budget.id}: ${budget.name} (category: ${budget.category})`
        )
        .join("\n")
    : "(no budgets available)";

  return `Today is ${today}.\n\nText: ${input}\n\nBudgets:\n${budgetLines}`;
};

const extractJsonObject = (value: string) => {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    return null;
  }
  return value.slice(start, end + 1);
};

const readContent = (content: unknown) =>
  typeof content === "string" ? content.trim() : null;

const shapeFallbackNote = (originalInput: string) => {
  const note = originalInput.trim();
  return note.length > 0 ? note : undefined;
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
    note: shapeFallbackNote(originalInput),
    amount: extractAmountFromInput(originalInput),
  },
});

type ParseExpenseArgs = {
  input: string;
  budgets: ParseExpenseBudget[];
  today: string;
  apiKey: string;
  fetchFn?: typeof fetch;
};

const CONFIDENCE_VALUES: ReadonlyArray<ParseExpenseConfidence> = [
  "high",
  "medium",
  "low",
];

const isConfidence = (value: unknown): value is ParseExpenseConfidence =>
  CONFIDENCE_VALUES.includes(value as ParseExpenseConfidence);

export const parseExpenseWithOpenRouter = async ({
  input,
  budgets,
  today,
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
        models: withFallbackModels(MODEL),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserContent(input, budgets, today) },
        ],
      }),
    });
  } catch {
    return buildFallback(input, "request_failed");
  }

  if (!response.ok) {
    return buildFallback(input, "request_failed");
  }

  let payload: { choices?: Array<{ message?: { content?: unknown } }> };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    return buildFallback(input, "request_failed");
  }

  const content = readContent(payload.choices?.[0]?.message?.content);
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
    budgetId?: unknown;
    confidence?: unknown;
    reason?: unknown;
  };

  const amount = Number(expense.amount);
  const note = String(expense.note ?? "").trim();
  const rawDate = expense.date;
  const date =
    rawDate === null || rawDate === undefined || String(rawDate).trim() === ""
      ? today
      : String(rawDate).trim();
  const reason = String(expense.reason ?? "").trim();
  const confidence = expense.confidence;

  const allowedIds = new Set(budgets.map((budget) => budget.id));
  let budgetId: number | null;
  const rawBudgetId = expense.budgetId;
  if (rawBudgetId === null || rawBudgetId === undefined) {
    budgetId = null;
  } else if (
    typeof rawBudgetId !== "number" ||
    !Number.isInteger(rawBudgetId) ||
    !allowedIds.has(rawBudgetId)
  ) {
    return buildFallback(input, "schema_mismatch");
  } else {
    budgetId = rawBudgetId;
  }

  if (
    !PARSE_EXPENSE_DATE_PATTERN.test(date) ||
    !Number.isFinite(amount) ||
    !Number.isInteger(amount) ||
    amount < PARSE_EXPENSE_MIN_AMOUNT ||
    note.length === 0 ||
    !isConfidence(confidence)
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
      budgetId,
      confidence,
      reason: reason.length > 0 ? reason : "Matched from input.",
    },
  };
};
