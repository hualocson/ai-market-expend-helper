import {
  DEFAULT_BUDGET_COLOR,
  DEFAULT_BUDGET_ICON,
} from "@/lib/budget-appearance";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PATCH as patchInternalBudget } from "./internal/budgets/[id]/route";
import {
  GET as getInternalBudgets,
  POST as postInternalBudget,
} from "./internal/budgets/route";

const mocks = vi.hoisted(() => ({
  createBudget: vi.fn(),
  getBudgetOverview: vi.fn(),
  getWeeklyBudgetReport: vi.fn(),
  updateBudget: vi.fn(),
}));

vi.mock("@/db/budget-queries", () => ({
  createBudget: mocks.createBudget,
  getBudgetOverview: mocks.getBudgetOverview,
  getWeeklyBudgetReport: mocks.getWeeklyBudgetReport,
  updateBudget: mocks.updateBudget,
}));

const INTERNAL_TOKEN = "test-internal-token";

const internalJsonRequest = (
  url: string,
  payload: unknown,
  method: "POST" | "PATCH" = "POST"
) =>
  new Request(url, {
    method,
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json",
      "x-internal-token": INTERNAL_TOKEN,
    },
  });

const internalRequest = (url: string) =>
  new Request(url, {
    headers: { "x-internal-token": INTERNAL_TOKEN },
  });

beforeEach(() => {
  vi.stubEnv("INTERNAL_API_TOKEN", INTERNAL_TOKEN);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  Object.values(mocks).forEach((mock) => mock.mockReset());
});

describe("internal budget routes", () => {
  it("returns raw budget overview payloads for authorized internal reads", async () => {
    const payload = {
      summary: {
        totalBudget: 1000000,
        totalSpent: 250000,
        totalRemaining: 750000,
        budgetCount: 1,
      },
      budgets: [
        {
          id: 10,
          name: "Groceries",
          icon: "🛒",
          color: "emerald",
          amount: 1000000,
          spent: 250000,
          remaining: 750000,
          period: "month",
          periodStartDate: "2026-05-01",
          periodEndDate: "2026-05-31",
        },
      ],
    };
    mocks.getBudgetOverview.mockResolvedValue(payload);

    const response = await getInternalBudgets(
      internalRequest("http://localhost/api/internal/budgets")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(payload);
  });

  it("creates a budget with internal appearance fields", async () => {
    const payload = {
      name: "Groceries",
      icon: "🛒",
      color: "emerald",
      amount: 1000000,
      period: "month",
      periodStartDate: "2026-05-01",
      periodEndDate: null,
    };
    const created = { id: 10, ...payload };
    mocks.createBudget.mockResolvedValue(created);

    const response = await postInternalBudget(
      internalJsonRequest("http://localhost/api/internal/budgets", payload)
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(created);
    expect(mocks.createBudget).toHaveBeenCalledWith(payload);
  });

  it("defaults omitted internal budget appearance fields", async () => {
    const payload = {
      name: "Groceries",
      amount: 1000000,
      period: "month",
      periodStartDate: "2026-05-01",
      periodEndDate: null,
    };
    const expectedPayload = {
      ...payload,
      icon: DEFAULT_BUDGET_ICON,
      color: DEFAULT_BUDGET_COLOR,
    };
    const created = { id: 10, ...expectedPayload };
    mocks.createBudget.mockResolvedValue(created);

    const response = await postInternalBudget(
      internalJsonRequest("http://localhost/api/internal/budgets", payload)
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(created);
    expect(mocks.createBudget).toHaveBeenCalledWith(expectedPayload);
  });

  it("rejects invalid internal budget appearance fields", async () => {
    const response = await postInternalBudget(
      internalJsonRequest("http://localhost/api/internal/budgets", {
        name: "Groceries",
        icon: "🛒",
        color: "custom-purple",
        amount: 1000000,
        period: "month",
        periodStartDate: "2026-05-01",
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid payload",
    });
    expect(mocks.createBudget).not.toHaveBeenCalled();
  });

  it("updates internal budget appearance fields", async () => {
    const payload = {
      icon: "🍜",
      color: "rose",
    };
    const updated = {
      id: 10,
      name: "Dining",
      amount: 900000,
      period: "month",
      periodStartDate: "2026-05-01",
      periodEndDate: "2026-05-31",
      ...payload,
    };
    mocks.updateBudget.mockResolvedValue(updated);

    const response = await patchInternalBudget(
      internalJsonRequest(
        "http://localhost/api/internal/budgets/10",
        payload,
        "PATCH"
      ),
      { params: { id: "10" } }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(updated);
    expect(mocks.updateBudget).toHaveBeenCalledWith(10, payload);
  });
});
