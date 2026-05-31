import { callOpenRouterJson } from "./core/openrouter";
import type { OpenRouterJsonFailureReason } from "./core/openrouter";
import {
  SEARCH_FILTER_JSON_SCHEMA,
  searchFilterSchema,
} from "./search-contract";
import type {
  ParseSearchFallbackReason,
  ParseSearchResponse,
  SearchBudget,
  SearchFilter,
} from "./search-contract";

const MODEL = "google/gemma-4-31b-it:free";

const SYSTEM_PROMPT = `
You translate a short natural-language expense search into a JSON filter.

Return ONLY one JSON object with any of these optional fields:
- dateFrom, dateTo: YYYY-MM-DD inclusive bounds. Resolve relative time
  ("this month", "April", "last month", "yesterday", "15-20 May") to a concrete
  range using the provided current month. Omit when no time is mentioned.
- categories: array of allowed category values only.
- budgetIds: array of ids chosen ONLY from the provided budget list. Match a
  noun to a BUDGET by name first (with or without Vietnamese diacritics, and
  common shorthand: cf = coffee, xang = fuel, grab = transport/food). Use a
  category only when no budget matches. Never invent an id.
- hasBudget: true for "has budget", false for "without budget" / "no budget".
  Do NOT set hasBudget if you set budgetIds.
- amountMin, amountMax: whole VND. Expand shorthand: "50k" = 50000, "1.2tr" = 1200000.
- q: leftover free text that no other field captured. Do not duplicate text
  already represented by another field.

Omit any field you are unsure about. Return {} if nothing is clear.
`.trim();

const buildUserContent = (
  input: string,
  budgets: SearchBudget[],
  todayMonth: string
) => {
  const budgetLines = budgets.length
    ? budgets
        .map(
          (budget) =>
            `- id ${budget.id}: ${budget.name} (category: ${budget.category})`
        )
        .join("\n")
    : "(no budgets available)";
  return `Current month is ${todayMonth}.\n\nQuery: ${input}\n\nBudgets:\n${budgetLines}`;
};

const mapFailureReason = (
  reason: OpenRouterJsonFailureReason
): ParseSearchFallbackReason =>
  reason === "request_failed"
    ? "request_failed"
    : reason === "schema_mismatch"
      ? "schema_mismatch"
      : "invalid_response";

const normalizeFilter = (
  filter: SearchFilter,
  budgets: SearchBudget[]
): SearchFilter => {
  const allowedIds = new Set(budgets.map((budget) => budget.id));
  const budgetIds = filter.budgetIds?.filter((id) => allowedIds.has(id));
  const normalized: SearchFilter = { ...filter };

  if (budgetIds && budgetIds.length > 0) {
    normalized.budgetIds = budgetIds;
    delete normalized.hasBudget; // collision rule: budgetIds wins
  } else {
    delete normalized.budgetIds;
  }
  return normalized;
};

type ParseSearchArgs = {
  input: string;
  todayMonth: string;
  budgets: SearchBudget[];
  apiKey: string;
  fetchFn?: typeof fetch;
};

export const parseSearchWithOpenRouter = async ({
  input,
  todayMonth,
  budgets,
  apiKey,
  fetchFn,
}: ParseSearchArgs): Promise<ParseSearchResponse> => {
  const result = await callOpenRouterJson({
    apiKey,
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserContent(input, budgets, todayMonth) },
    ],
    jsonSchema: SEARCH_FILTER_JSON_SCHEMA,
    schema: searchFilterSchema,
    fetchFn,
  });

  if (!result.ok) {
    return {
      status: "fallback",
      originalInput: input,
      reason: mapFailureReason(result.reason),
      prefill: { q: input },
    };
  }

  return {
    status: "success",
    originalInput: input,
    filter: normalizeFilter(result.value, budgets),
  };
};
