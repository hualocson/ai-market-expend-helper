import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { type OpenRouterJsonSchema, callOpenRouterJson } from "./openrouter";

const suggestionSchema = z.object({
  status: z.literal("success"),
  budgetId: z.number(),
});

const jsonSchema: OpenRouterJsonSchema = {
  name: "budget_suggestion",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["status", "budgetId"],
    properties: {
      status: { type: "string", enum: ["success"] },
      budgetId: { type: "number" },
    },
  },
};

const createResponse = (content: unknown, ok = true) =>
  ({
    ok,
    json: vi.fn().mockResolvedValue({
      choices: [{ message: { content } }],
    }),
  }) as unknown as Response;

describe("callOpenRouterJson", () => {
  it("posts a structured-output chat completion and parses valid JSON", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        createResponse(JSON.stringify({ status: "success", budgetId: 7 }))
      );

    const result = await callOpenRouterJson({
      apiKey: "test-key",
      model: "test/model",
      messages: [{ role: "user", content: "coffee" }],
      jsonSchema,
      schema: suggestionSchema,
      fetchFn,
    });

    expect(result).toEqual({
      ok: true,
      value: { status: "success", budgetId: 7 },
    });
    expect(fetchFn).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
        body: expect.any(String),
      })
    );
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toMatchObject({
      model: "test/model",
      messages: [{ role: "user", content: "coffee" }],
      response_format: {
        type: "json_schema",
        json_schema: jsonSchema,
      },
    });
  });

  it("returns request_failed when fetch rejects or response is not ok", async () => {
    await expect(
      callOpenRouterJson({
        apiKey: "test-key",
        model: "test/model",
        messages: [{ role: "user", content: "coffee" }],
        jsonSchema,
        schema: suggestionSchema,
        fetchFn: vi.fn().mockRejectedValue(new Error("network down")),
      })
    ).resolves.toEqual({ ok: false, reason: "request_failed" });

    await expect(
      callOpenRouterJson({
        apiKey: "test-key",
        model: "test/model",
        messages: [{ role: "user", content: "coffee" }],
        jsonSchema,
        schema: suggestionSchema,
        fetchFn: vi.fn().mockResolvedValue(createResponse("{}", false)),
      })
    ).resolves.toEqual({ ok: false, reason: "request_failed" });
  });

  it("returns invalid_response for empty, non-string, or invalid JSON content", async () => {
    for (const content of ["", { status: "success" }, "not json"]) {
      await expect(
        callOpenRouterJson({
          apiKey: "test-key",
          model: "test/model",
          messages: [{ role: "user", content: "coffee" }],
          jsonSchema,
          schema: suggestionSchema,
          fetchFn: vi.fn().mockResolvedValue(createResponse(content)),
        })
      ).resolves.toEqual({ ok: false, reason: "invalid_response" });
    }
  });

  it("returns schema_mismatch when parsed JSON does not match the schema", async () => {
    await expect(
      callOpenRouterJson({
        apiKey: "test-key",
        model: "test/model",
        messages: [{ role: "user", content: "coffee" }],
        jsonSchema,
        schema: suggestionSchema,
        fetchFn: vi
          .fn()
          .mockResolvedValue(
            createResponse(JSON.stringify({ status: "success" }))
          ),
      })
    ).resolves.toEqual({ ok: false, reason: "schema_mismatch" });
  });
});
