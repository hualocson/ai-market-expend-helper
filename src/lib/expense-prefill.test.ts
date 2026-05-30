import { describe, expect, it, vi } from "vitest";

import {
  EXPENSE_PREFILL_EVENT,
  type ExpensePrefillPayload,
  dispatchExpensePrefill,
} from "./expense-prefill";

describe("dispatchExpensePrefill", () => {
  it("dispatches an event carrying the optional date and receipt_scan source", () => {
    const handler = vi.fn();
    window.addEventListener(EXPENSE_PREFILL_EVENT, handler);

    const payload: ExpensePrefillPayload = {
      amount: 85000,
      note: "Circle K",
      category: "Food",
      date: "12/04/2026",
      source: "receipt_scan",
    };
    dispatchExpensePrefill(payload);

    window.removeEventListener(EXPENSE_PREFILL_EVENT, handler);
    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock
      .calls[0][0] as CustomEvent<ExpensePrefillPayload>;
    expect(event.detail).toEqual(payload);
  });
});
