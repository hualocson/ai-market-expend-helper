import { describe, expect, it } from "vitest";

import {
  ApiResponseError,
  apiErrorBody,
  apiSuccessBody,
  isApiResponse,
  unwrapApiResponse,
} from "./api-response";

describe("apiSuccessBody", () => {
  it("wraps data and meta in a success envelope", () => {
    expect(apiSuccessBody({ id: 1 }, { page: 1, hasNextPage: false })).toEqual({
      success: true,
      data: { id: 1 },
      meta: { page: 1, hasNextPage: false },
    });
  });
});

describe("apiErrorBody", () => {
  it("wraps error details in an error envelope", () => {
    expect(
      apiErrorBody("INVALID_PAYLOAD", "Invalid payload", { path: "date" })
    ).toEqual({
      success: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "Invalid payload",
        details: { path: "date" },
      },
    });
  });
});

describe("isApiResponse", () => {
  it("accepts success and structured error envelopes", () => {
    expect(isApiResponse({ success: true, data: [] })).toBe(true);
    expect(
      isApiResponse({
        success: false,
        error: { code: "INVALID_PAYLOAD", message: "Invalid payload" },
      })
    ).toBe(true);
  });

  it("rejects legacy error payloads", () => {
    expect(isApiResponse({ error: "Invalid payload" })).toBe(false);
  });
});

describe("unwrapApiResponse", () => {
  it("returns success data", () => {
    expect(unwrapApiResponse({ success: true, data: { id: 1 } })).toEqual({
      id: 1,
    });
  });

  it("throws ApiResponseError for structured errors", () => {
    expect.assertions(6);

    try {
      unwrapApiResponse(
        apiErrorBody("INVALID_PAYLOAD", "Invalid payload", { path: "date" }),
        400
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ApiResponseError);
      expect(error).toHaveProperty("name", "ApiResponseError");
      expect(error).toHaveProperty("code", "INVALID_PAYLOAD");
      expect(error).toHaveProperty("message", "Invalid payload");
      expect(error).toHaveProperty("details", { path: "date" });
      expect(error).toHaveProperty("status", 400);
    }
  });

  it("throws Invalid API response for non-envelope payloads", () => {
    expect(() => unwrapApiResponse({ error: "legacy" }, 500)).toThrow(
      "Invalid API response"
    );
  });
});
