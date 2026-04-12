import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Category } from "@/enums";

import AIInput from "./AIInput";

vi.mock("./ManualExpenseForm", () => ({
  default: ({
    initialExpense,
    prefillExpense,
    isSheetOpen,
  }: {
    initialExpense?: TExpense | null;
    prefillExpense?: Partial<Pick<TExpense, "amount" | "note" | "category">> | null;
    isSheetOpen?: boolean;
  }) => (
    <div
      data-testid="manual-expense-form"
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
      data-sheet-open={
        typeof isSheetOpen !== "undefined" ? String(isSheetOpen) : undefined
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

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
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

describe("AIInput", () => {
  it("shows a loading spinner while the parse request is in flight", async () => {
    const user = userEvent.setup();
    const request = createDeferred<Response>();

    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(request.promise);

    render(<AIInput />);

    await user.type(
      screen.getByLabelText(/expense input/i),
      "Lunch with team 120k today"
    );
    await user.click(screen.getByRole("button", { name: /parse expense/i }));

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("ai-input-loading")).toBeVisible();
    expect(screen.queryByTestId("manual-expense-form")).not.toBeInTheDocument();
  });

  it("shows a preview card before opening the manual form on success", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      createJsonResponse({
        status: "success",
        originalInput: "Lunch with team 120k today",
        expense: {
          date: "12/04/2026",
          amount: 120000,
          note: "Lunch with team",
          category: Category.FOOD,
        },
      })
    );

    render(<AIInput />);

    await user.type(
      screen.getByLabelText(/expense input/i),
      "Lunch with team 120k today"
    );
    await user.click(screen.getByRole("button", { name: /parse expense/i }));

    expect(
      await screen.findByText(/review ai suggestion/i)
    ).toBeVisible();
    expect(screen.queryByTestId("manual-expense-form")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /continue to form/i })
    ).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /continue to form/i }));

    const form = await screen.findByTestId("manual-expense-form");
    const initialExpense = JSON.parse(
      form.getAttribute("data-initial-expense") ?? "null"
    ) as TExpense;

    expect(initialExpense).toMatchObject({
      date: "12/04/2026",
      amount: 120000,
      note: "Lunch with team",
      category: Category.FOOD,
    });
  });

  it("opens the manual form directly for fallback responses", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      createJsonResponse({
        status: "fallback",
        originalInput: "Taxi 45k home",
        reason: "schema_mismatch",
        prefill: {
          note: "Taxi home",
          amount: 45000,
        },
      })
    );

    render(<AIInput />);

    await user.type(screen.getByLabelText(/expense input/i), "Taxi 45k home");
    await user.click(screen.getByRole("button", { name: /parse expense/i }));

    const form = await screen.findByTestId("manual-expense-form");
    expect(screen.queryByText(/review ai suggestion/i)).not.toBeInTheDocument();

    const prefillExpense = JSON.parse(
      form.getAttribute("data-prefill-expense") ??
        form.getAttribute("data-initial-expense") ??
        "null"
    ) as Record<string, unknown>;

    expect(prefillExpense).toMatchObject({
      note: "Taxi home",
      amount: 45000,
    });
  });

  it("shows a retryable error for non-ok responses and keeps the form closed", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      createJsonResponse(
        { error: "Failed to parse expense" },
        { status: 500 }
      )
    );

    render(<AIInput />);

    await user.type(
      screen.getByLabelText(/expense input/i),
      "Unclear transaction"
    );
    await user.click(screen.getByRole("button", { name: /parse expense/i }));

    expect(
      await screen.findByText(
        /could not parse expense right now\. please try again\./i
      )
    ).toBeVisible();
    expect(screen.queryByTestId("manual-expense-form")).not.toBeInTheDocument();
    expect(screen.queryByText(/review ai suggestion/i)).not.toBeInTheDocument();
  });
});
