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
    oneOf: [
      {
        type: "object",
        additionalProperties: false,
        required: ["status", "budgetId", "confidence", "reason"],
        properties: {
          status: { type: "string", const: "success" },
          budgetId: { type: "integer", minimum: 1 },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          reason: { type: "string", minLength: 1, maxLength: 180 },
        },
      },
      {
        type: "object",
        additionalProperties: false,
        required: ["status", "reason"],
        properties: {
          status: { type: "string", const: "no_match" },
          reason: { type: "string", minLength: 1, maxLength: 180 },
        },
      },
    ],
  },
};

const SYSTEM_PROMPT = `
You choose the best budget for one expense note.

Rules:
- Choose only from the provided budget ids.
- Never invent a budget id or budget name.
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
  apiKey?: string;
  fetchFn?: typeof fetch;
};

export class MissingOpenRouterApiKeyError extends Error {
  constructor() {
    super("Missing OPENROUTER_API_KEY");
    this.name = "MissingOpenRouterApiKeyError";
  }
}

const tokenizeText = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter(Boolean);

const containsTokenSequence = (tokens: string[], phraseTokens: string[]) => {
  if (phraseTokens.length === 0 || phraseTokens.length > tokens.length) {
    return false;
  }

  return tokens.some((_, index) =>
    phraseTokens.every((token, phraseIndex) => {
      return tokens[index + phraseIndex] === token;
    })
  );
};

const hasDeterministicNameLength = (tokens: string[]) =>
  tokens.join("").length > 1;

const findDeterministicMatch = (
  note: string,
  budgets: SuggestBudgetCandidate[]
): SuggestBudgetResponse | null => {
  const noteTokens = tokenizeText(note);
  const matches = budgets.filter((budget) => {
    const budgetNameTokens = tokenizeText(budget.name);
    if (!hasDeterministicNameLength(budgetNameTokens)) {
      return false;
    }

    return containsTokenSequence(noteTokens, budgetNameTokens);
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

  if (!apiKey) {
    throw new MissingOpenRouterApiKeyError();
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
