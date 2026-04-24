import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Category } from "@/enums";

import AIExpenseChat from "./AIExpenseChat";

vi.mock("./ManualExpenseForm", () => ({
  default: ({
    initialMode,
    initialExpense,
    prefillExpense,
  }: {
    initialMode?: string;
    initialExpense?: TExpense | null;
    prefillExpense?: Partial<Pick<TExpense, "amount" | "note" | "category">> | null;
  }) => (
    <div
      data-testid="manual-expense-form"
      data-initial-mode={initialMode}
      data-initial-expense={
        typeof initialExpense !== "undefined"
          ? JSON.stringify(initialExpense)
          : undefined
      }
      data-prefill-expense={
        typeof prefillExpense !== "undefined"
          ? JSON.stringify(prefillExpense)
          : undefined
      }
    />
  ),
}));

const createJsonResponse = (
  body: unknown,
  init: ResponseInit = { status: 200 }
) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

const expectParseExpenseRequest = (input: string) => {
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);

  const [endpoint, init] = vi.mocked(globalThis.fetch).mock.calls[0] ?? [];

  expect(endpoint).toBe("/api/ai/parse-expense");
  expect(init).toMatchObject({
    method: "POST",
  });
  expect(JSON.parse(String(init?.body))).toMatchObject({
    input,
  });
};

const expectParseExpenseRequestAtCall = (callIndex: number, input: string) => {
  const [endpoint, init] =
    vi.mocked(globalThis.fetch).mock.calls[callIndex] ?? [];

  expect(endpoint).toBe("/api/ai/parse-expense");
  expect(init).toMatchObject({
    method: "POST",
  });
  expect(JSON.parse(String(init?.body))).toMatchObject({
    input,
  });
};

const originalGlobalReact = globalThis.React;

beforeEach(() => {
  globalThis.React = React;
});

afterEach(() => {
  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
  } else {
    globalThis.React = originalGlobalReact;
  }

  vi.restoreAllMocks();
});

describe("AIExpenseChat", () => {
  it("renders the welcome message and example prompts", () => {
    render(<AIExpenseChat />);

    expect(
      screen.getByRole("region", { name: /ai expense conversation/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/tell me what you spent/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /lunch with team 120k today/i })
    ).toBeInTheDocument();
  });

  it("submits a message and renders a preview card for a successful parse", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      createJsonResponse({
        status: "success",
        originalInput: "Lunch with team 120k today",
        expense: {
          date: "24/04/2026",
          amount: 120000,
          note: "Lunch with team",
          category: Category.FOOD,
        },
      })
    );

    render(<AIExpenseChat />);

    await user.type(
      screen.getByLabelText(/message spendly ai/i),
      "Lunch with team 120k today"
    );
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expectParseExpenseRequest("Lunch with team 120k today");
    expect(screen.getByText("Lunch with team 120k today")).toBeInTheDocument();
    expect(
      await screen.findByText(/review ai suggestion/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId("manual-expense-form")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /continue to form/i }));

    const form = await screen.findByTestId("manual-expense-form");
    const initialExpense = JSON.parse(
      form.getAttribute("data-initial-expense") ?? "null"
    ) as TExpense;

    expect(initialExpense).toMatchObject({
      date: "24/04/2026",
      amount: 120000,
      note: "Lunch with team",
      category: Category.FOOD,
    });
  });

  it("renders the manual form inline for fallback responses", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      createJsonResponse({
        status: "fallback",
        originalInput: "Taxi 45k home",
        reason: "schema_mismatch",
        prefill: {
          note: "Taxi 45k home",
          amount: 45000,
        },
      })
    );

    render(<AIExpenseChat />);

    await user.type(screen.getByLabelText(/message spendly ai/i), "Taxi 45k home");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expectParseExpenseRequest("Taxi 45k home");

    const form = await screen.findByTestId("manual-expense-form");
    const prefillExpense = JSON.parse(
      form.getAttribute("data-prefill-expense") ?? "null"
    ) as Record<string, unknown>;

    expect(form).toHaveAttribute("data-initial-mode", "quick");
    expect(prefillExpense).toMatchObject({
      note: "Taxi 45k home",
      amount: 45000,
    });
    expect(screen.queryByText(/review ai suggestion/i)).not.toBeInTheDocument();
  });

  it("retries the failed input from the assistant error action", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        createJsonResponse(
          { error: "Missing OPENROUTER_API_KEY" },
          { status: 500 }
        )
      )
      .mockResolvedValueOnce(
        createJsonResponse(
          { error: "Missing OPENROUTER_API_KEY" },
          { status: 500 }
        )
      );

    render(<AIExpenseChat />);

    const composer = screen.getByLabelText(/message spendly ai/i);

    await user.type(composer, "Dinner");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expectParseExpenseRequest("Dinner");
    expect(
      await screen.findByText(/could not parse that expense/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId("manual-expense-form")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expectParseExpenseRequestAtCall(1, "Dinner");
    expect(composer).toHaveValue("");
  });

  it("dismisses the assistant preview result", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      createJsonResponse({
        status: "success",
        originalInput: "Lunch with team 120k today",
        expense: {
          date: "24/04/2026",
          amount: 120000,
          note: "Lunch with team",
          category: Category.FOOD,
        },
      })
    );

    render(<AIExpenseChat />);

    await user.type(
      screen.getByLabelText(/message spendly ai/i),
      "Lunch with team 120k today"
    );
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expect(
      await screen.findByText(/review ai suggestion/i)
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(screen.queryByText(/review ai suggestion/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("manual-expense-form")).not.toBeInTheDocument();
  });

  it("uses an example prompt as composer text", async () => {
    const user = userEvent.setup();

    render(<AIExpenseChat />);

    await user.click(
      screen.getByRole("button", { name: /groceries 450k yesterday/i })
    );

    expect(screen.getByLabelText(/message spendly ai/i)).toHaveValue(
      "Groceries 450k yesterday"
    );
  });
});
