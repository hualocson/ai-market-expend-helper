import type {
  ParseSearchResponse,
  SearchBudget,
} from "@/lib/ai/search-contract";

import { fetchJson } from "./http";

type ParseSearchInput = {
  input: string;
  todayDate: string;
  todayMonth: string;
  budgets: SearchBudget[];
};

export const parseSearchRequest = (
  body: ParseSearchInput
): Promise<ParseSearchResponse> =>
  fetchJson<ParseSearchResponse>("/api/ai/parse-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
