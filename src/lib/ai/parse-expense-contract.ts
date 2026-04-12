import { Category } from "@/enums";

export type ParseExpenseRequest = {
  input: string;
};

export type ParseExpenseSuccessResponse = {
  status: "success";
  originalInput: string;
  expense: {
    date: string;
    amount: number;
    note: string;
    category: Category;
  };
};

export type ParseExpenseFallbackResponse = {
  status: "fallback";
  originalInput: string;
  prefill: {
    note?: string;
    amount?: number;
  };
  reason:
    | "invalid_json"
    | "schema_mismatch"
    | "empty_response"
    | "request_failed";
};

export type ParseExpenseResponse =
  | ParseExpenseSuccessResponse
  | ParseExpenseFallbackResponse;
