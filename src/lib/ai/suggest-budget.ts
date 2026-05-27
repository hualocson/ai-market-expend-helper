import { callOpenRouterJson } from "./core/openrouter";
import type { OpenRouterJsonSchema } from "./core/openrouter";
import {
  type SuggestBudgetCandidate,
  type SuggestBudgetResponse,
  suggestBudgetModelResponseSchema,
} from "./suggest-budget-contract";

const MODEL = "openai/gpt-oss-20b:free";

const MODEL_JSON_SCHEMA: OpenRouterJsonSchema = {
  name: "suggest_budget",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["status"],
    properties: {
      status: { type: "string", enum: ["success", "no_match"] },
      budgetId: { type: "integer" },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      reason: { type: "string" },
    },
  },
};

const SYSTEM_PROMPT = `
You choose the best budget for one expense note.

Rules:
- Choose only from the provided budget ids.
- Return no_match when the note is ambiguous.
- Prefer semantic fit over remaining amount.
- Use budget name as the primary signal.
- Use period and remaining amount only as supporting context.
- Keep reason short.
- Return only JSON matching the schema.
`.trim();

type SuggestBudgetArgs = {
  note: string;
  budgets: SuggestBudgetCandidate[];
  apiKey: string;
  fetchFn?: typeof fetch;
};

const normalizeText = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const findDeterministicMatch = (
  note: string,
  budgets: SuggestBudgetCandidate[]
): SuggestBudgetResponse | null => {
  const normalizedNote = normalizeText(note);
  const matches = budgets.filter((budget) => {
    const normalizedName = normalizeText(budget.name);
    return normalizedName.length > 1 && normalizedNote.includes(normalizedName);
  });

  if (matches.length !== 1) {
    return null;
  }

  const [match] = matches;
  return {
    status: "success",
    budgetId: match.id,
    confidence: "high",
    reason: `The note contains the budget name ${match.name}.`,
  };
};

const buildUserPrompt = (note: string, budgets: SuggestBudgetCandidate[]) =>
  JSON.stringify({
    note,
    budgets: budgets.map((budget) => ({
      id: budget.id,
      name: budget.name,
      amount: budget.amount,
      spent: budget.spent,
      remaining: budget.remaining,
      period: budget.period,
      periodStartDate: budget.periodStartDate,
      periodEndDate: budget.periodEndDate,
    })),
  });

const validateCandidateResult = (
  result: SuggestBudgetResponse,
  budgets: SuggestBudgetCandidate[]
): SuggestBudgetResponse => {
  if (result.status !== "success") {
    return result;
  }

  if (!budgets.some((budget) => budget.id === result.budgetId)) {
    return { status: "fallback", reason: "schema_mismatch" };
  }

  return result;
};

export const suggestBudget = async ({
  note,
  budgets,
  apiKey,
  fetchFn,
}: SuggestBudgetArgs): Promise<SuggestBudgetResponse> => {
  const trimmedNote = note.trim();

  if (trimmedNote.length === 0) {
    return {
      status: "no_match",
      reason: "Enter a note to suggest a budget.",
    };
  }

  if (budgets.length === 0) {
    return {
      status: "no_match",
      reason: "No budgets are available for this expense.",
    };
  }

  const deterministic = findDeterministicMatch(trimmedNote, budgets);
  if (deterministic) {
    return deterministic;
  }

  const providerResult = await callOpenRouterJson({
    apiKey,
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(trimmedNote, budgets) },
    ],
    jsonSchema: MODEL_JSON_SCHEMA,
    schema: suggestBudgetModelResponseSchema,
    fetchFn,
  });

  if (!providerResult.ok) {
    return {
      status: "fallback",
      reason: providerResult.reason,
    };
  }

  return validateCandidateResult(providerResult.value, budgets);
};
