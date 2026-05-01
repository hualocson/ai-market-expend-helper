# Budget Amount Transfer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a user to increase one budget's `amount` by pulling cap from another budget in a single atomic operation, exposed through a dedicated drawer reachable from both the budget detail drawer and the edit drawer.

**Architecture:** One new Server Action (`transferBudgetAmount`) wraps a Drizzle transaction that decrements the source `budgets.amount` and increments the destination's. A new client component `<BudgetTransferDrawer />` drives the UI; `BudgetWeeklyBudgetsClient` opens it from two entry points and invalidates the existing TanStack Query caches on success. No schema migration. No history.

**Tech Stack:** Next.js 15 App Router · React 19 · Drizzle ORM (Postgres) · Zod · TanStack Query · shadcn/ui (Drawer/Input/Button) · Sonner · Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-05-01-budget-amount-transfer-design.md`

---

## File Structure

| File | Responsibility | Status |
|---|---|---|
| `src/app/actions/budget-weekly-actions.ts` | Add `transferBudgetAmount` Server Action and its Zod schema | Modify |
| `src/app/actions/budget-weekly-actions.transfer.test.ts` | Unit tests for `transferBudgetAmount` (schema + transaction call shape, with `db` mocked) | Create |
| `src/components/BudgetTransferDrawer.tsx` | Drawer UI: destination summary, source picker, amount input, preview, warning banner, submit | Create |
| `src/components/BudgetTransferDrawer.test.tsx` | RTL tests for picker/validation/warning/submit | Create |
| `src/components/BudgetWeeklyBudgetsClient.tsx` | Add transfer state; render drawer; add detail-drawer button + edit-drawer link | Modify |

The Drawer is its own file because it has self-contained state (source picker, amount, submit) that doesn't belong in the already-large `BudgetWeeklyBudgetsClient`.

---

## Task 1: Add `transferBudgetAmount` Server Action with Zod schema

**Files:**
- Modify: `src/app/actions/budget-weekly-actions.ts`
- Create: `src/app/actions/budget-weekly-actions.transfer.test.ts`

### Step 1.1: Write the failing schema test

- [ ] Create `src/app/actions/budget-weekly-actions.transfer.test.ts` with this content:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const updateMock = vi.fn(() => ({ set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) }));
const selectMock = vi.fn();
const transactionMock = vi.fn();

vi.mock("@/db", () => ({
  db: {
    transaction: (cb: (tx: unknown) => Promise<unknown>) => transactionMock(cb),
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { transferBudgetAmount } from "./budget-weekly-actions";

describe("transferBudgetAmount — input validation", () => {
  beforeEach(() => {
    transactionMock.mockReset();
    transactionMock.mockImplementation(async () => undefined);
  });

  it("rejects when fromBudgetId equals toBudgetId", async () => {
    await expect(
      transferBudgetAmount({ fromBudgetId: 1, toBudgetId: 1, amount: 100 })
    ).rejects.toThrow(/different/i);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("rejects non-positive amount", async () => {
    await expect(
      transferBudgetAmount({ fromBudgetId: 1, toBudgetId: 2, amount: 0 })
    ).rejects.toThrow();
    await expect(
      transferBudgetAmount({ fromBudgetId: 1, toBudgetId: 2, amount: -5 })
    ).rejects.toThrow();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("rejects non-integer ids", async () => {
    await expect(
      transferBudgetAmount({ fromBudgetId: 1.5, toBudgetId: 2, amount: 100 })
    ).rejects.toThrow();
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
```

### Step 1.2: Run the test to verify it fails

- [ ] Run: `bunx vitest run src/app/actions/budget-weekly-actions.transfer.test.ts`
- [ ] Expected: FAIL — `transferBudgetAmount is not a function` (or import error).

### Step 1.3: Implement `transferBudgetAmount` (schema + transaction)

- [ ] Edit `src/app/actions/budget-weekly-actions.ts`. At the top, add imports (merge with existing imports, do not duplicate):

```ts
import { db } from "@/db";
import { budgets } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
```

- [ ] Append at the end of the file:

```ts
const transferBudgetSchema = z
  .object({
    fromBudgetId: z.number().int().positive(),
    toBudgetId: z.number().int().positive(),
    amount: z.number().int().positive(),
  })
  .refine((d) => d.fromBudgetId !== d.toBudgetId, {
    message: "Source and destination must be different budgets",
  });

export type TransferBudgetInput = z.infer<typeof transferBudgetSchema>;

export async function transferBudgetAmount(input: TransferBudgetInput) {
  const parsed = transferBudgetSchema.parse(input);

  try {
    await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(budgets)
        .where(inArray(budgets.id, [parsed.fromBudgetId, parsed.toBudgetId]));

      const source = rows.find((r) => r.id === parsed.fromBudgetId);
      const dest = rows.find((r) => r.id === parsed.toBudgetId);

      if (!source || !dest) {
        throw new Error("Budget not found");
      }
      if (parsed.amount > source.amount) {
        throw new Error("Source has insufficient cap");
      }

      await tx
        .update(budgets)
        .set({ amount: source.amount - parsed.amount })
        .where(eq(budgets.id, parsed.fromBudgetId));

      await tx
        .update(budgets)
        .set({ amount: dest.amount + parsed.amount })
        .where(eq(budgets.id, parsed.toBudgetId));
    });

    revalidatePath("/budgets");
  } catch (error) {
    console.error("Error transferring budget amount:", error);
    if (error instanceof Error && (
      error.message === "Source has insufficient cap" ||
      error.message === "Budget not found"
    )) {
      throw error;
    }
    throw new Error("Failed to transfer budget amount");
  }
}
```

### Step 1.4: Run the validation tests to verify they pass

- [ ] Run: `bunx vitest run src/app/actions/budget-weekly-actions.transfer.test.ts`
- [ ] Expected: 3 passing tests.

### Step 1.5: Add a transaction-shape test

- [ ] Append to `src/app/actions/budget-weekly-actions.transfer.test.ts`:

```ts
describe("transferBudgetAmount — transaction behavior", () => {
  beforeEach(() => {
    transactionMock.mockReset();
  });

  it("debits source and credits destination by the transferred amount", async () => {
    const updates: Array<{ amount: number }> = [];

    transactionMock.mockImplementation(async (cb) => {
      const tx = {
        select: () => ({
          from: () => ({
            where: () =>
              Promise.resolve([
                { id: 1, amount: 100_000 },
                { id: 2, amount: 50_000 },
              ]),
          }),
        }),
        update: () => ({
          set: (patch: { amount: number }) => {
            updates.push(patch);
            return { where: () => Promise.resolve(undefined) };
          },
        }),
      };
      await cb(tx);
    });

    await transferBudgetAmount({ fromBudgetId: 1, toBudgetId: 2, amount: 30_000 });

    expect(updates).toEqual([{ amount: 70_000 }, { amount: 80_000 }]);
  });

  it("throws 'Source has insufficient cap' when amount exceeds source.amount", async () => {
    transactionMock.mockImplementation(async (cb) => {
      const tx = {
        select: () => ({
          from: () => ({
            where: () =>
              Promise.resolve([
                { id: 1, amount: 10_000 },
                { id: 2, amount: 50_000 },
              ]),
          }),
        }),
        update: () => ({
          set: () => ({ where: () => Promise.resolve(undefined) }),
        }),
      };
      await cb(tx);
    });

    await expect(
      transferBudgetAmount({ fromBudgetId: 1, toBudgetId: 2, amount: 30_000 })
    ).rejects.toThrow("Source has insufficient cap");
  });

  it("throws 'Budget not found' when one of the budgets is missing", async () => {
    transactionMock.mockImplementation(async (cb) => {
      const tx = {
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([{ id: 1, amount: 100_000 }]),
          }),
        }),
        update: () => ({
          set: () => ({ where: () => Promise.resolve(undefined) }),
        }),
      };
      await cb(tx);
    });

    await expect(
      transferBudgetAmount({ fromBudgetId: 1, toBudgetId: 2, amount: 30_000 })
    ).rejects.toThrow("Budget not found");
  });
});
```

### Step 1.6: Run all action tests

- [ ] Run: `bunx vitest run src/app/actions/budget-weekly-actions.transfer.test.ts`
- [ ] Expected: 6 passing tests.

### Step 1.7: Type-check the touched file

- [ ] Run: `bunx tsc --noEmit`
- [ ] Expected: no errors. (If errors appear in unrelated files, ignore them; only the action file should be relevant.)

### Step 1.8: Commit

- [ ] Run:

```bash
git add src/app/actions/budget-weekly-actions.ts src/app/actions/budget-weekly-actions.transfer.test.ts
git commit -m "feat(budgets): add transferBudgetAmount server action

Atomic Drizzle transaction that moves cap between two budgets.
Zod-validated input, returns void, throws on insufficient cap or
missing budget. Surfaces specific error messages so the UI can
show them; revalidates /budgets on success."
```

---

## Task 2: Build `<BudgetTransferDrawer />`

**Files:**
- Create: `src/components/BudgetTransferDrawer.tsx`
- Create: `src/components/BudgetTransferDrawer.test.tsx`

### Step 2.1: Write the failing component tests

- [ ] Create `src/components/BudgetTransferDrawer.test.tsx`:

```tsx
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import BudgetTransferDrawer from "./BudgetTransferDrawer";
import type { BudgetListItem } from "@/types/budget-weekly";

const transferMock = vi.fn();

vi.mock("@/app/actions/budget-weekly-actions", () => ({
  transferBudgetAmount: (...args: unknown[]) => transferMock(...args),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const makeBudget = (overrides: Partial<BudgetListItem> = {}): BudgetListItem => ({
  id: 1,
  name: "Groceries",
  amount: 100_000,
  spent: 0,
  remaining: 100_000,
  period: "week",
  periodStartDate: "2026-04-27",
  periodEndDate: null,
  ...overrides,
});

beforeEach(() => {
  transferMock.mockReset();
});

describe("BudgetTransferDrawer", () => {
  it("disables submit until a source is picked and amount is valid", async () => {
    const user = userEvent.setup();
    const destination = makeBudget({ id: 1, name: "Groceries", amount: 100_000 });
    const source = makeBudget({ id: 2, name: "Dining", amount: 200_000 });

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={destination}
        budgets={[destination, source]}
      />
    );

    const submit = screen.getByRole("button", { name: /move funds/i });
    expect(submit).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /select source budget/i }));
    await user.click(screen.getByRole("button", { name: /Dining/i }));

    expect(submit).toBeDisabled();

    const input = screen.getByLabelText(/amount/i);
    await user.type(input, "30000");

    expect(submit).not.toBeDisabled();
  });

  it("excludes the destination from the source picker", async () => {
    const user = userEvent.setup();
    const destination = makeBudget({ id: 1, name: "Groceries" });
    const source = makeBudget({ id: 2, name: "Dining" });

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={destination}
        budgets={[destination, source]}
      />
    );

    await user.click(screen.getByRole("button", { name: /select source budget/i }));

    const list = screen.getByRole("list", { name: /source budgets/i });
    expect(within(list).queryByText(/Groceries/i)).toBeNull();
    expect(within(list).getByText(/Dining/i)).toBeInTheDocument();
  });

  it("renders zero-cap source as disabled", async () => {
    const user = userEvent.setup();
    const destination = makeBudget({ id: 1 });
    const empty = makeBudget({ id: 2, name: "Empty", amount: 0, remaining: 0 });

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={destination}
        budgets={[destination, empty]}
      />
    );

    await user.click(screen.getByRole("button", { name: /select source budget/i }));
    expect(screen.getByRole("button", { name: /Empty/i })).toBeDisabled();
  });

  it("shows warning banner and flips submit label when source goes below spent", async () => {
    const user = userEvent.setup();
    const destination = makeBudget({ id: 1 });
    const source = makeBudget({ id: 2, name: "Travel", amount: 100_000, spent: 80_000, remaining: 20_000 });

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={destination}
        budgets={[destination, source]}
      />
    );

    await user.click(screen.getByRole("button", { name: /select source budget/i }));
    await user.click(screen.getByRole("button", { name: /Travel/i }));
    await user.type(screen.getByLabelText(/amount/i), "50000");

    expect(screen.getByText(/will go .* over budget/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /move funds anyway/i })).toBeInTheDocument();
  });

  it("shows empty state when no other budgets exist", () => {
    const destination = makeBudget({ id: 1 });
    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={destination}
        budgets={[destination]}
      />
    );
    expect(screen.getByText(/no other budgets to pull from/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /move funds/i })).toBeNull();
  });

  it("disables submit when amount exceeds source.amount", async () => {
    const user = userEvent.setup();
    const destination = makeBudget({ id: 1 });
    const source = makeBudget({ id: 2, name: "Snacks", amount: 20_000 });

    render(
      <BudgetTransferDrawer
        open
        onOpenChange={() => {}}
        destination={destination}
        budgets={[destination, source]}
      />
    );

    await user.click(screen.getByRole("button", { name: /select source budget/i }));
    await user.click(screen.getByRole("button", { name: /Snacks/i }));
    await user.type(screen.getByLabelText(/amount/i), "30000");

    expect(screen.getByRole("button", { name: /move funds/i })).toBeDisabled();
    expect(screen.getByText(/cannot move more than/i)).toBeInTheDocument();
  });
});
```

### Step 2.2: Run the failing test

- [ ] Run: `bunx vitest run src/components/BudgetTransferDrawer.test.tsx`
- [ ] Expected: FAIL — module not found.

### Step 2.3: Create the component

- [ ] Create `src/components/BudgetTransferDrawer.tsx`:

```tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowDown, Check, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { transferBudgetAmount } from "@/app/actions/budget-weekly-actions";
import {
  budgetOverviewQueryKey,
  budgetTransactionsQueryKey,
} from "@/lib/queries/budgets";
import { cn, formatVnd, formatVndSigned, parseVndInput } from "@/lib/utils";
import type { BudgetListItem } from "@/types/budget-weekly";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: BudgetListItem;
  budgets: BudgetListItem[];
};

const formatPeriod = (b: BudgetListItem) => {
  if (b.period === "week") return "Weekly";
  if (b.period === "month") return "Monthly";
  return "Custom";
};

const BudgetTransferDrawer = ({
  open,
  onOpenChange,
  destination,
  budgets,
}: Props) => {
  const queryClient = useQueryClient();
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [amount, setAmount] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setSourceId(null);
      setAmount(0);
      setPickerOpen(false);
      setIsSaving(false);
    }
  }, [open]);

  const candidateSources = useMemo(
    () => budgets.filter((b) => b.id !== destination.id),
    [budgets, destination.id]
  );

  const source = useMemo(
    () => candidateSources.find((b) => b.id === sourceId) ?? null,
    [candidateSources, sourceId]
  );

  const exceedsCap = source !== null && amount > source.amount;
  const goesOverSpent =
    source !== null &&
    amount > 0 &&
    !exceedsCap &&
    source.amount - amount < source.spent;

  const overBy = goesOverSpent && source ? source.spent - (source.amount - amount) : 0;

  const canSubmit =
    source !== null && amount > 0 && !exceedsCap && !isSaving;

  const submitLabel = goesOverSpent ? "Move funds anyway" : "Move funds";

  const handleSubmit = async () => {
    if (!canSubmit || !source) return;
    try {
      setIsSaving(true);
      await transferBudgetAmount({
        fromBudgetId: source.id,
        toBudgetId: destination.id,
        amount,
      });
      toast.success("Funds moved.");
      await queryClient.invalidateQueries({ queryKey: budgetOverviewQueryKey });
      await queryClient.invalidateQueries({
        queryKey: budgetTransactionsQueryKey(destination.id),
      });
      await queryClient.invalidateQueries({
        queryKey: budgetTransactionsQueryKey(source.id),
      });
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "Source has insufficient cap") {
        toast.error("That budget no longer has enough to move. Try a smaller amount.");
        await queryClient.invalidateQueries({ queryKey: budgetOverviewQueryKey });
      } else if (message === "Budget not found") {
        toast.error("Source budget no longer exists.");
        await queryClient.invalidateQueries({ queryKey: budgetOverviewQueryKey });
      } else {
        toast.error("Failed to move funds.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="rounded-t-3xl! border-t-0!">
        <DrawerHeader className="gap-1 pb-2">
          <DrawerTitle>Move funds to "{destination.name}"</DrawerTitle>
          <DrawerDescription>
            Pull cap from another budget into this one
          </DrawerDescription>
        </DrawerHeader>

        <div className="no-scrollbar flex max-h-[65svh] flex-col gap-4 overflow-x-hidden overflow-y-auto px-4 pb-4">
          {candidateSources.length === 0 ? (
            <div className="border-border/55 bg-card/40 rounded-2xl border border-dashed px-4 py-5 text-center">
              <p className="text-foreground text-sm font-semibold">
                No other budgets to pull from yet.
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Create another budget first, then come back to move funds.
              </p>
            </div>
          ) : (
            <>
              <div className="border-border/45 bg-card/70 rounded-2xl border px-4 py-3">
                <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                  Destination
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-foreground text-sm font-semibold">
                    {destination.name}
                  </p>
                  <p className="text-foreground text-sm font-semibold">
                    {formatVnd(destination.amount)}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-foreground text-sm font-medium">
                  From
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  aria-label="Select source budget"
                  onClick={() => setPickerOpen((v) => !v)}
                  className="mt-2 h-11 w-full justify-between rounded-xl"
                >
                  <span className="truncate">
                    {source ? source.name : "Select source budget"}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {source ? formatVnd(source.amount) : ""}
                  </span>
                </Button>

                {pickerOpen ? (
                  <ul
                    aria-label="Source budgets"
                    className="border-border/45 bg-card/40 mt-2 max-h-60 space-y-1 overflow-y-auto rounded-xl border p-1"
                  >
                    {candidateSources.map((b) => {
                      const disabled = b.amount === 0;
                      const selected = b.id === sourceId;
                      return (
                        <li key={b.id}>
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={disabled}
                            aria-label={b.name}
                            onClick={() => {
                              setSourceId(b.id);
                              setPickerOpen(false);
                            }}
                            className={cn(
                              "h-11 w-full justify-between rounded-lg px-3 text-left",
                              selected && "bg-muted/60"
                            )}
                          >
                            <span className="flex min-w-0 flex-col">
                              <span className="text-foreground truncate text-sm font-medium">
                                {b.name}
                              </span>
                              <span className="text-muted-foreground text-[11px]">
                                {formatPeriod(b)} · {formatVnd(b.remaining)} left
                              </span>
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="text-foreground text-xs font-semibold">
                                {formatVnd(b.amount)}
                              </span>
                              {selected ? (
                                <Check className="h-4 w-4 text-success" />
                              ) : null}
                            </span>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="transfer-amount-input"
                  className="text-foreground text-sm font-medium"
                >
                  Amount
                </label>
                <div className="relative mt-2">
                  <Input
                    id="transfer-amount-input"
                    type="text"
                    inputMode="numeric"
                    value={amount ? formatVnd(amount) : ""}
                    onChange={(e) => setAmount(parseVndInput(e.target.value))}
                    placeholder="0"
                    className="h-11 pr-14 text-right text-lg font-semibold"
                  />
                  <span className="text-muted-foreground absolute top-1/2 right-4 -translate-y-1/2 text-xs font-medium">
                    VND
                  </span>
                </div>
                {exceedsCap && source ? (
                  <p className="text-destructive mt-2 text-[11px]">
                    Cannot move more than {formatVnd(source.amount)} from {source.name}.
                  </p>
                ) : null}
              </div>

              {source && amount > 0 && !exceedsCap ? (
                <div className="border-border/45 bg-card/70 rounded-2xl border px-4 py-3">
                  <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                    After transfer
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">{source.name}</p>
                      <p
                        className={cn(
                          "mt-1 text-sm font-semibold",
                          source.amount - amount < source.spent
                            ? "text-destructive"
                            : "text-foreground"
                        )}
                      >
                        {formatVnd(source.amount - amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{destination.name}</p>
                      <p className="text-foreground mt-1 text-sm font-semibold">
                        {formatVnd(destination.amount + amount)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {goesOverSpent && source ? (
                <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>
                    {source.name} will go {formatVnd(overBy)} over budget.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>

        {candidateSources.length > 0 ? (
          <DrawerFooter className="border-border/45 gap-2 border-t">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="h-11 rounded-2xl"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
              {isSaving ? "Moving..." : submitLabel}
            </Button>
          </DrawerFooter>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
};

export default BudgetTransferDrawer;
```

### Step 2.4: Run the component tests

- [ ] Run: `bunx vitest run src/components/BudgetTransferDrawer.test.tsx`
- [ ] Expected: 6 passing tests.
- [ ] If any test fails because the picker `<Button>` text concatenates name + amount, adjust the test selector to use a regex like `/^Dining/`. Re-run.

### Step 2.5: Type-check

- [ ] Run: `bunx tsc --noEmit`
- [ ] Expected: no errors in the new files.

### Step 2.6: Commit

- [ ] Run:

```bash
git add src/components/BudgetTransferDrawer.tsx src/components/BudgetTransferDrawer.test.tsx
git commit -m "feat(budgets): add BudgetTransferDrawer component

Drawer with destination summary, source picker (disables zero-cap rows
and the destination itself), amount input, after-transfer preview,
and a warning banner when the source would drop below its spent total.
Submit label flips to 'Move funds anyway' for the warned case."
```

---

## Task 3: Wire entry points into `BudgetWeeklyBudgetsClient`

**Files:**
- Modify: `src/components/BudgetWeeklyBudgetsClient.tsx`

### Step 3.1: Add transfer state and import

- [ ] Open `src/components/BudgetWeeklyBudgetsClient.tsx`. Add to the imports block:

```tsx
import BudgetTransferDrawer from "@/components/BudgetTransferDrawer";
```

- [ ] Find the block of `useState` declarations near the top of the component (around `setSheetOpen` / `setDetailOpen` / `setConfirmOpen`). Add directly after `setConfirmOpen`:

```tsx
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferDestination, setTransferDestination] =
    useState<BudgetListItem | null>(null);

  const openTransfer = (budget: BudgetListItem) => {
    setTransferDestination(budget);
    setTransferOpen(true);
  };
```

### Step 3.2: Add the detail-drawer entry point

- [ ] In the same file, find the detail `DrawerFooter` (currently contains the `Edit budget` button followed by the `Delete budget` button). Insert a new ghost button **between** them:

```tsx
            <Button
              type="button"
              variant="ghost"
              className="bg-muted/40 h-11 rounded-2xl"
              onClick={() => {
                if (!detailBudget) return;
                setDetailOpen(false);
                openTransfer(detailBudget);
              }}
            >
              <ArrowDown className="h-4 w-4" />
              Move funds
            </Button>
```

- [ ] Add `ArrowDown` to the existing `lucide-react` import line (replace the current line so the import stays single, alphabetized — keep the other icons):

Find:
```tsx
import {
  AlertCircle,
  ArrowLeftIcon,
  Loader2,
  Plus,
  SaveIcon,
  Trash2,
} from "lucide-react";
```

Replace with:
```tsx
import {
  AlertCircle,
  ArrowDown,
  ArrowLeftIcon,
  Loader2,
  Plus,
  SaveIcon,
  Trash2,
} from "lucide-react";
```

### Step 3.3: Add the edit-drawer entry point

- [ ] In the same file, locate the Amount field block in the edit drawer (the `<div>` containing the `Input` with `id="budget-amount-input"`). Directly **after** the `<p className="text-muted-foreground mt-2 text-[11px]">Use the total amount you plan to spend in this period.</p>` line, insert:

```tsx
              {activeBudget ? (
                <button
                  type="button"
                  className="text-primary mt-2 text-[11px] font-medium underline-offset-2 hover:underline"
                  onClick={() => {
                    if (!activeBudget) return;
                    setSheetOpen(false);
                    openTransfer(activeBudget);
                  }}
                >
                  Move from another budget →
                </button>
              ) : null}
```

(The `activeBudget ? ... : null` guard hides the link in the Create flow, where there's no destination yet.)

### Step 3.4: Render the transfer drawer

- [ ] Scroll to the bottom of the component, just **before** the closing `</section>`. Insert:

```tsx
      {transferDestination ? (
        <BudgetTransferDrawer
          open={transferOpen}
          onOpenChange={(open) => {
            setTransferOpen(open);
            if (!open) {
              setTransferDestination(null);
            }
          }}
          destination={transferDestination}
          budgets={budgets}
        />
      ) : null}
```

### Step 3.5: Type-check

- [ ] Run: `bunx tsc --noEmit`
- [ ] Expected: no errors in `BudgetWeeklyBudgetsClient.tsx`.

### Step 3.6: Run the existing component test to confirm we didn't break it

- [ ] Run: `bunx vitest run src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx`
- [ ] Expected: PASS. (The existing mock for `@/app/actions/budget-weekly-actions` only spies the three older actions — that's fine because the test never opens the transfer drawer, so the new `transferBudgetAmount` import is unused at runtime there. If Vitest complains about a missing mock export, add `transferBudgetAmount: vi.fn(),` to the mock factory in that test file.)

### Step 3.7: Commit

- [ ] Run:

```bash
git add src/components/BudgetWeeklyBudgetsClient.tsx src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx
git commit -m "feat(budgets): wire move-funds entry points

Add 'Move funds' button to the detail drawer footer and a
'Move from another budget' link inside the edit drawer's amount
field. Both open the new BudgetTransferDrawer with the current
budget pre-selected as destination."
```

(If you didn't have to touch the mascot test, drop it from the `git add`.)

---

## Task 4: Manual verification on the dev server

**Files:** none.

### Step 4.1: Run the dev server

- [ ] Run: `bun run dev`
- [ ] Open `http://localhost:3000/budgets` in a browser.

### Step 4.2: Walk the happy path

- [ ] Make sure you have at least two budgets. If not, create them via the existing "Add budget" flow.
- [ ] Tap a budget card → detail drawer opens.
- [ ] Tap **Move funds** → transfer drawer opens with this budget pre-selected as destination.
- [ ] Tap **Select source budget** → list expands; verify the destination budget is **not** in the list.
- [ ] Pick a source.
- [ ] Type an amount that's safely under both `source.amount` and `source.amount - source.spent`.
- [ ] Verify the **After transfer** preview shows the new amounts on both sides.
- [ ] Tap **Move funds** → toast `Funds moved.` → drawer closes → both budget cards reflect the new amounts.

### Step 4.3: Walk the warning path

- [ ] Open a destination budget → Move funds → pick a source whose `spent > 0`.
- [ ] Type an amount such that `source.amount - amount < source.spent`.
- [ ] Verify the warning banner appears with the over-budget delta and the submit label changes to **Move funds anyway**.
- [ ] Tap it. Confirm the transfer goes through and the source's card now shows "Over budget" status.

### Step 4.4: Walk the validation path

- [ ] In the transfer drawer, type an amount **larger** than the source's `amount`. Verify:
  - submit is disabled
  - the inline `Cannot move more than … from …` error appears

### Step 4.5: Edge case — only one budget

- [ ] If you have a tenant with a single budget, open its detail drawer → Move funds. Verify the empty state message and absent submit button.

### Step 4.6: Entry point from the Edit drawer

- [ ] Open a budget detail → tap **Edit budget** → in the edit drawer, tap **Move from another budget →**. Verify the edit drawer closes and the transfer drawer opens with this budget as destination.

### Step 4.7: Stop the dev server

- [ ] `Ctrl-C` the dev server.

---

## Self-Review (already performed)

- **Spec coverage:** ✓ Server action, drawer, both entry points, validation table, error mapping, edge cases, tests for action and drawer all map to tasks above.
- **Placeholder scan:** ✓ No TBD/TODO. Every code step has full code.
- **Type consistency:** ✓ `transferBudgetAmount({ fromBudgetId, toBudgetId, amount })` consistent across action, tests, and drawer call.
- **Known divergence from spec:** the spec said "Vitest, real DB" for the action test. The codebase has no real-DB integration test setup, so this plan mocks the `@/db` module instead. This still tests Zod validation, transaction usage, ordering of updates, and error paths — losing only the actual transaction-rollback proof. Manual verification (Task 4) covers the live behavior.
