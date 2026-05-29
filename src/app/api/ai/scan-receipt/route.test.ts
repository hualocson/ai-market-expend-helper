import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const { scanReceiptWithOpenRouter } = vi.hoisted(() => ({
  scanReceiptWithOpenRouter: vi.fn(),
}));

vi.mock("@/lib/ai/scan-receipt", () => ({ scanReceiptWithOpenRouter }));

const request = (body: unknown) =>
  new Request("http://localhost/api/ai/scan-receipt", {
    method: "POST",
    body: JSON.stringify(body),
  });

describe("POST /api/ai/scan-receipt", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    scanReceiptWithOpenRouter.mockReset();
    delete process.env.OPENROUTER_API_KEY;
  });

  it("returns 400 when imageBase64 is missing", async () => {
    const response = await POST(request({}));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: { code: "INVALID_PAYLOAD", message: "Invalid payload" },
    });
  });

  it("returns 400 when imageBase64 is not a non-empty string", async () => {
    const response = await POST(request({ imageBase64: "" }));
    expect(response.status).toBe(400);
  });

  it("returns 500 when OPENROUTER_API_KEY is missing", async () => {
    const response = await POST(
      request({ imageBase64: "data:image/jpeg;base64,AAAA" })
    );
    expect(response.status).toBe(500);
  });

  it("returns 200 with the service result when valid", async () => {
    process.env.OPENROUTER_API_KEY = "k";
    scanReceiptWithOpenRouter.mockResolvedValue({
      status: "success",
      receipt: {
        merchant: "Shop",
        date: "12/04/2026",
        total: 1000,
        category: "Food",
      },
    });

    const response = await POST(
      request({ imageBase64: "data:image/jpeg;base64,AAAA" })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        status: "success",
        receipt: {
          merchant: "Shop",
          date: "12/04/2026",
          total: 1000,
          category: "Food",
        },
      },
    });
    expect(scanReceiptWithOpenRouter).toHaveBeenCalledWith({
      imageBase64: "data:image/jpeg;base64,AAAA",
      apiKey: "k",
    });
  });

  it("returns 200 with a fallback body unchanged", async () => {
    process.env.OPENROUTER_API_KEY = "k";
    scanReceiptWithOpenRouter.mockResolvedValue({
      status: "fallback",
      reason: "request_failed",
      prefill: {},
    });

    const response = await POST(
      request({ imageBase64: "data:image/jpeg;base64,AAAA" })
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { status: "fallback", reason: "request_failed", prefill: {} },
    });
  });
});
