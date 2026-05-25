import { describe, expect, it } from "vitest";

import { apiError, apiSuccess } from "./route-response";

describe("apiSuccess", () => {
  it("returns a JSON success response with status and meta", async () => {
    const response = apiSuccess({ id: 1 }, { status: 201 }, { total: 1 });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { id: 1 },
      meta: { total: 1 },
    });
  });
});

describe("apiError", () => {
  it("returns a JSON error response with status and details", async () => {
    const response = apiError("INVALID_PAYLOAD", "Invalid payload", 400, {
      field: "date",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "Invalid payload",
        details: { field: "date" },
      },
    });
  });
});
