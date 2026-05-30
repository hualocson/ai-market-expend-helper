import dayjs from "@/configs/date";
import { Category } from "@/enums";

import type {
  ScanReceiptFallbackResponse,
  ScanReceiptResponse,
} from "./scan-receipt-contract";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "nvidia/nemotron-nano-12b-v2-vl:free";
const CATEGORY_VALUES = Object.values(Category);
const DATE_PATTERN = /^\d{2}\/\d{2}\/\d{4}$/;

type FallbackReason = ScanReceiptFallbackResponse["reason"];

const SYSTEM_PROMPT = `
You read a single store receipt from an image and extract one expense summary.

Rules:
- Return only one JSON object, no prose.
- Output fields: merchant, date, total, category.
- merchant is the store name as a short string (may be empty if unknown).
- date must be DD/MM/YYYY (the receipt's purchase date).
- total must be the receipt grand total as a positive number, no currency symbols or separators.
- category must be exactly one of: ${CATEGORY_VALUES.join(", ")}.
`.trim();

const USER_PROMPT = "Extract the expense summary from this receipt image.";

const readContent = (content: unknown) =>
  typeof content === "string" ? content.trim() : null;

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
    CATEGORY_VALUES.find((category) => category.toLowerCase() === normalized) ??
    null
  );
};

const normalizeDate = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (DATE_PATTERN.test(raw) && dayjs(raw, "DD/MM/YYYY", true).isValid()) {
    return raw;
  }
  return dayjs().format("DD/MM/YYYY");
};

const fallback = (reason: FallbackReason): ScanReceiptResponse => ({
  status: "fallback",
  reason,
  prefill: {},
});

type ScanReceiptArgs = {
  imageBase64: string;
  apiKey: string;
  fetchFn?: typeof fetch;
};

export const scanReceiptWithOpenRouter = async ({
  imageBase64,
  apiKey,
  fetchFn = fetch,
}: ScanReceiptArgs): Promise<ScanReceiptResponse> => {
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
          {
            role: "user",
            content: [
              { type: "text", text: USER_PROMPT },
              { type: "image_url", image_url: { url: imageBase64 } },
            ],
          },
        ],
      }),
    });
  } catch {
    return fallback("request_failed");
  }

  if (!response.ok) {
    return fallback("request_failed");
  }

  let payload: { choices?: Array<{ message?: { content?: unknown } }> };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    return fallback("request_failed");
  }

  const content = readContent(payload.choices?.[0]?.message?.content);
  if (!content) {
    return fallback("empty_response");
  }

  const jsonBlock = extractJsonObject(content);
  if (!jsonBlock) {
    return fallback("invalid_json");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonBlock);
  } catch {
    return fallback("invalid_json");
  }

  const receipt = parsed as {
    merchant?: unknown;
    date?: unknown;
    total?: unknown;
    category?: unknown;
  };

  const category = normalizeCategory(receipt.category);
  const total = Number(receipt.total);
  const merchant = String(receipt.merchant ?? "").trim();

  if (!category || !Number.isFinite(total) || total <= 0) {
    return fallback("schema_mismatch");
  }

  return {
    status: "success",
    receipt: {
      merchant: merchant.length > 0 ? merchant : undefined,
      date: normalizeDate(receipt.date),
      total,
      category,
    },
  };
};
