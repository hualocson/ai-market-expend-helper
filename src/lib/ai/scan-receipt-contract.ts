import { Category } from "@/enums";

export type ScanReceiptRequest = {
  imageBase64: string;
};

export type ScanReceiptSuccessResponse = {
  status: "success";
  receipt: {
    merchant?: string;
    date: string;
    total: number;
    category: Category;
  };
};

export type ScanReceiptFallbackResponse = {
  status: "fallback";
  prefill: {
    amount?: number;
    note?: string;
  };
  reason:
    | "request_failed"
    | "invalid_json"
    | "schema_mismatch"
    | "empty_response";
};

export type ScanReceiptResponse =
  | ScanReceiptSuccessResponse
  | ScanReceiptFallbackResponse;
