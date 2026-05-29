import React from "react";

import { Category } from "@/enums";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ReceiptScanDrawer from "./ReceiptScanDrawer";

vi.mock("@/lib/image/compress-image", () => ({
  compressImage: vi.fn().mockResolvedValue("data:image/jpeg;base64,ZZZZ"),
}));

const { dispatchExpensePrefill } = vi.hoisted(() => ({
  dispatchExpensePrefill: vi.fn(),
}));
vi.mock("@/lib/expense-prefill", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/expense-prefill")>();
  return { ...actual, dispatchExpensePrefill };
});

const selectFile = () => {
  fireEvent.click(
    screen.getByRole("button", { name: /take photo|choose|scan/i })
  );
  const input = screen.getByTestId("receipt-file-input") as HTMLInputElement;
  const file = new File(["x"], "receipt.jpg", { type: "image/jpeg" });
  fireEvent.change(input, { target: { files: [file] } });
};

const okJson = (data: unknown) =>
  ({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ success: true, data }),
  }) as unknown as Response;

describe("ReceiptScanDrawer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    dispatchExpensePrefill.mockReset();
  });

  it("dispatches a mapped prefill on OCR success and closes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        okJson({
          status: "success",
          receipt: {
            merchant: "Circle K",
            date: "12/04/2026",
            total: 85000,
            category: "Food",
          },
        })
      )
    );
    const onOpenChange = vi.fn();

    render(<ReceiptScanDrawer open onOpenChange={onOpenChange} />);
    selectFile();

    await waitFor(() =>
      expect(dispatchExpensePrefill).toHaveBeenCalledWith({
        amount: 85000,
        note: "Circle K",
        category: Category.FOOD,
        date: "12/04/2026",
        source: "receipt_scan",
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("dispatches a salvaged prefill on fallback and closes", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          okJson({ status: "fallback", reason: "schema_mismatch", prefill: {} })
        )
    );
    const onOpenChange = vi.fn();

    render(<ReceiptScanDrawer open onOpenChange={onOpenChange} />);
    selectFile();

    await waitFor(() =>
      expect(dispatchExpensePrefill).toHaveBeenCalledWith({
        amount: 0,
        note: "",
        category: Category.OTHER,
        source: "receipt_scan",
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows a retry affordance when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));

    render(<ReceiptScanDrawer open onOpenChange={vi.fn()} />);
    selectFile();

    expect(
      await screen.findByRole("button", { name: /try again|retry/i })
    ).toBeInTheDocument();
    expect(dispatchExpensePrefill).not.toHaveBeenCalled();
  });
});
