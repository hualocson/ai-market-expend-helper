import { Category } from "@/enums";
import { describe, expect, it, vi } from "vitest";

import { scanReceiptWithOpenRouter } from "./scan-receipt";

const createOpenRouterResponse = (content: unknown, ok = true) =>
  ({
    ok,
    json: vi.fn().mockResolvedValue({
      choices: [{ message: { content } }],
    }),
  }) as unknown as Response;

const IMAGE = "data:image/jpeg;base64,AAAA";

describe("scanReceiptWithOpenRouter", () => {
  it("returns success for valid receipt JSON", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      createOpenRouterResponse(
        JSON.stringify({
          merchant: "Circle K",
          date: "12/04/2026",
          total: 85000,
          category: "Food",
        })
      )
    );

    await expect(
      scanReceiptWithOpenRouter({ imageBase64: IMAGE, apiKey: "k", fetchFn })
    ).resolves.toEqual({
      status: "success",
      receipt: {
        merchant: "Circle K",
        date: "12/04/2026",
        total: 85000,
        category: Category.FOOD,
      },
    });
  });

  it("sends a multimodal message containing the image url", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        createOpenRouterResponse(
          JSON.stringify({ date: "12/04/2026", total: 1000, category: "Food" })
        )
      );

    await scanReceiptWithOpenRouter({
      imageBase64: IMAGE,
      apiKey: "k",
      fetchFn,
    });

    const body = JSON.parse(
      (fetchFn.mock.calls[0][1] as RequestInit).body as string
    );
    const userMessage = body.messages.find(
      (m: { role: string }) => m.role === "user"
    );
    expect(Array.isArray(userMessage.content)).toBe(true);
    expect(userMessage.content).toContainEqual({
      type: "image_url",
      image_url: { url: IMAGE },
    });
  });

  it("defaults an unreadable date to today (DD/MM/YYYY)", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        createOpenRouterResponse(
          JSON.stringify({ date: "garbage", total: 1000, category: "Food" })
        )
      );

    const result = await scanReceiptWithOpenRouter({
      imageBase64: IMAGE,
      apiKey: "k",
      fetchFn,
    });

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.receipt.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    }
  });

  it("returns schema_mismatch fallback when total is missing or <= 0", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        createOpenRouterResponse(
          JSON.stringify({ date: "12/04/2026", total: 0, category: "Food" })
        )
      );

    await expect(
      scanReceiptWithOpenRouter({ imageBase64: IMAGE, apiKey: "k", fetchFn })
    ).resolves.toEqual({
      status: "fallback",
      reason: "schema_mismatch",
      prefill: {},
    });
  });

  it("returns invalid_json fallback when content is not JSON", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(createOpenRouterResponse("no json here"));

    const result = await scanReceiptWithOpenRouter({
      imageBase64: IMAGE,
      apiKey: "k",
      fetchFn,
    });
    expect(result).toEqual({
      status: "fallback",
      reason: "invalid_json",
      prefill: {},
    });
  });

  it("returns empty_response fallback when content is empty", async () => {
    const fetchFn = vi.fn().mockResolvedValue(createOpenRouterResponse(""));

    const result = await scanReceiptWithOpenRouter({
      imageBase64: IMAGE,
      apiKey: "k",
      fetchFn,
    });
    expect(result).toEqual({
      status: "fallback",
      reason: "empty_response",
      prefill: {},
    });
  });

  it("returns request_failed fallback when fetch rejects", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("network"));

    const result = await scanReceiptWithOpenRouter({
      imageBase64: IMAGE,
      apiKey: "k",
      fetchFn,
    });
    expect(result).toEqual({
      status: "fallback",
      reason: "request_failed",
      prefill: {},
    });
  });

  it("returns request_failed fallback when response not ok", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(createOpenRouterResponse("{}", false));

    const result = await scanReceiptWithOpenRouter({
      imageBase64: IMAGE,
      apiKey: "k",
      fetchFn,
    });
    expect(result).toEqual({
      status: "fallback",
      reason: "request_failed",
      prefill: {},
    });
  });
});
