import { describe, expect, it, vi } from "vitest";

import { parseSearchRequest } from "./parse-search";

describe("parseSearchRequest", () => {
  it("POSTs to /api/ai/parse-search and unwraps the response", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            status: "success",
            originalInput: "x",
            filter: { hasBudget: false },
          },
        }),
        { status: 200 }
      )
    );

    const result = await parseSearchRequest({
      input: "coffee no budget",
      todayMonth: "2026-05",
      budgets: [],
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/ai/parse-search",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.status).toBe("success");
    fetchSpy.mockRestore();
  });
});
