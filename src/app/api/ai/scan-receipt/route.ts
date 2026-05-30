import { scanReceiptWithOpenRouter } from "@/lib/ai/scan-receipt";
import type { ScanReceiptRequest } from "@/lib/ai/scan-receipt-contract";
import { apiError, apiSuccess } from "@/lib/api/route-response";

const invalidPayloadResponse = () =>
  apiError("INVALID_PAYLOAD", "Invalid payload", 400);

const readImage = (payload: unknown) => {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }
  const image = (payload as Partial<ScanReceiptRequest>).imageBase64;
  if (typeof image !== "string") {
    return null;
  }
  const trimmed = image.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const POST = async (request: Request) => {
  try {
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return invalidPayloadResponse();
    }

    const imageBase64 = readImage(payload);
    if (!imageBase64) {
      return invalidPayloadResponse();
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return apiError("SCAN_RECEIPT_FAILED", "Missing OPENROUTER_API_KEY", 500);
    }

    const result = await scanReceiptWithOpenRouter({ imageBase64, apiKey });
    return apiSuccess(result);
  } catch (error) {
    console.error("Failed to scan receipt with OpenRouter:", error);
    return apiError("SCAN_RECEIPT_FAILED", "Failed to scan receipt", 500);
  }
};
