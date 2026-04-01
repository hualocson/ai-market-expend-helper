# Idle Mascot Dialog Companion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the existing `IdleMascot` companion in dialog surfaces (Sheet/Drawer) using a reusable slot component, without adding success-state behavior.

**Architecture:** Add one shared UI wrapper (`DialogCompanionSlot`) that renders `IdleMascot` with stable sizing and decorative semantics, then wire that wrapper into each in-scope dialog header. Keep save flows unchanged and validate with targeted component tests.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, shadcn/ui Sheet/Drawer/Dialog primitives, Vitest + Testing Library.

---

## File Structure and Responsibilities

### Create

- `src/components/mascots/DialogCompanionSlot.tsx`
- `src/components/mascots/DialogCompanionSlot.test.tsx`
- `src/components/ExpenseEntryDrawer.mascot.test.tsx`
- `src/components/ExpenseListItem.mascot.test.tsx`
- `src/components/BudgetWeeklyTransactionsClient.mascot.test.tsx`
- `src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx`

### Modify

- `src/components/ExpenseEntryDrawer.tsx`
- `src/components/ExpenseListItem.tsx`
- `src/components/BudgetWeeklyTransactionsClient.tsx`
- `src/components/BudgetWeeklyBudgetsClient.tsx`

### Existing source-of-truth mascot

- `src/components/mascots/IdleMascot.tsx`

---

### Task 1: Create Reusable `DialogCompanionSlot`

**Files:**
- Create: `src/components/mascots/DialogCompanionSlot.tsx`
- Create: `src/components/mascots/DialogCompanionSlot.test.tsx`
- Uses: `src/components/mascots/IdleMascot.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/mascots/DialogCompanionSlot.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DialogCompanionSlot from "./DialogCompanionSlot";

describe("DialogCompanionSlot", () => {
  it("renders IdleMascot as decorative content", () => {
    render(<DialogCompanionSlot />);

    const slot = screen.getByTestId("dialog-companion-slot");
    const mascot = screen.getByTestId("idle-mascot");

    expect(slot).toBeInTheDocument();
    expect(mascot).toBeInTheDocument();
    expect(mascot).toHaveAttribute("aria-hidden", "true");
  });

  it("applies custom classes", () => {
    render(
      <DialogCompanionSlot
        className="ring-1"
        mascotClassName="opacity-80"
      />
    );

    expect(screen.getByTestId("dialog-companion-slot")).toHaveClass("ring-1");
    expect(screen.getByTestId("idle-mascot")).toHaveClass("opacity-80");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test -- src/components/mascots/DialogCompanionSlot.test.tsx
```

Expected: FAIL with module-not-found error for `./DialogCompanionSlot`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/mascots/DialogCompanionSlot.tsx
import { cn } from "@/lib/utils";

import IdleMascot from "./IdleMascot";

type DialogCompanionSlotProps = {
  className?: string;
  mascotClassName?: string;
};

const DialogCompanionSlot = ({
  className,
  mascotClassName,
}: DialogCompanionSlotProps) => {
  return (
    <div
      data-testid="dialog-companion-slot"
      className={cn(
        "mx-auto mb-1 flex h-20 w-20 items-center justify-center",
        className
      )}
    >
      <IdleMascot
        data-testid="idle-mascot"
        aria-hidden="true"
        focusable="false"
        className={cn("h-full w-full", mascotClassName)}
      />
    </div>
  );
};

export default DialogCompanionSlot;
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test -- src/components/mascots/DialogCompanionSlot.test.tsx
```

Expected: PASS, 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/components/mascots/DialogCompanionSlot.tsx src/components/mascots/DialogCompanionSlot.test.tsx
git commit -m "feat: add reusable idle mascot dialog companion slot"
```

---

### Task 2: Integrate Companion Into `ExpenseEntryDrawer`

**Files:**
- Modify: `src/components/ExpenseEntryDrawer.tsx`
- Create: `src/components/ExpenseEntryDrawer.mascot.test.tsx`

- [ ] **Step 1: Write the failing integration test**

```tsx
// src/components/ExpenseEntryDrawer.mascot.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ExpenseEntryDrawer from "./ExpenseEntryDrawer";

vi.mock("@/components/ManualExpenseForm", () => ({
  default: () => <div data-testid="manual-expense-form" />,
}));

vi.mock("@/components/ui/sheet", () => {
  const Wrap = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    Sheet: Wrap,
    SheetTrigger: Wrap,
    SheetContent: Wrap,
    SheetHeader: Wrap,
    SheetTitle: Wrap,
    SheetDescription: Wrap,
    SheetFooter: Wrap,
  };
});

describe("ExpenseEntryDrawer mascot", () => {
  it("renders idle mascot companion inside sheet header", () => {
    render(<ExpenseEntryDrawer />);

    expect(screen.getByTestId("dialog-companion-slot")).toBeInTheDocument();
    expect(screen.getByTestId("idle-mascot")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test -- src/components/ExpenseEntryDrawer.mascot.test.tsx
```

Expected: FAIL because `dialog-companion-slot` is not rendered yet.

- [ ] **Step 3: Add component integration**

```tsx
// src/components/ExpenseEntryDrawer.tsx (imports)
import DialogCompanionSlot from "@/components/mascots/DialogCompanionSlot";

// src/components/ExpenseEntryDrawer.tsx (inside <SheetHeader>)
<SheetHeader className="text-left">
  <DialogCompanionSlot />
  <SheetTitle>Add a new expense</SheetTitle>
  <SheetDescription>
    Use AI or the quick form to add a new entry.
  </SheetDescription>
</SheetHeader>
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test -- src/components/ExpenseEntryDrawer.mascot.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ExpenseEntryDrawer.tsx src/components/ExpenseEntryDrawer.mascot.test.tsx
git commit -m "feat: show idle mascot in expense entry drawer header"
```

---

### Task 3: Integrate Companion Into `ExpenseListItem` Edit Sheet

**Files:**
- Modify: `src/components/ExpenseListItem.tsx`
- Create: `src/components/ExpenseListItem.mascot.test.tsx`

- [ ] **Step 1: Write the failing integration test**

```tsx
// src/components/ExpenseListItem.mascot.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ExpenseListItem from "./ExpenseListItem";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/actions/expense-actions", () => ({
  deleteExpenseEntry: vi.fn(),
  updateExpenseEntry: vi.fn(),
}));

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock("@/components/ManualExpenseForm", () => ({
  default: () => <div data-testid="manual-expense-form" />,
}));

vi.mock("@/components/ui/sheet", () => {
  const Wrap = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    Sheet: Wrap,
    SheetContent: Wrap,
    SheetHeader: Wrap,
    SheetTitle: Wrap,
    SheetDescription: Wrap,
    SheetFooter: Wrap,
  };
});

vi.mock("@/components/ui/dialog", () => {
  const Wrap = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Wrap,
    DialogContent: Wrap,
    DialogHeader: Wrap,
    DialogTitle: Wrap,
    DialogDescription: Wrap,
    DialogFooter: Wrap,
  };
});

describe("ExpenseListItem mascot", () => {
  it("renders idle mascot companion in edit sheet header", () => {
    render(
      <ExpenseListItem
        expense={{
          id: 1,
          date: "2026-04-01",
          amount: 120000,
          note: "Lunch",
          category: "FOOD",
          paidBy: "Loc",
          budgetId: null,
          budgetName: null,
        }}
      />
    );

    expect(screen.getByTestId("dialog-companion-slot")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
npm run test -- src/components/ExpenseListItem.mascot.test.tsx
```

Expected: FAIL because companion slot is not in `ExpenseListItem` sheet header yet.

- [ ] **Step 3: Add component integration**

```tsx
// src/components/ExpenseListItem.tsx (imports)
import DialogCompanionSlot from "@/components/mascots/DialogCompanionSlot";

// src/components/ExpenseListItem.tsx (inside edit <SheetHeader>)
<SheetHeader className="text-left">
  <DialogCompanionSlot />
  <SheetTitle>Edit expense</SheetTitle>
  <SheetDescription>
    Update the details for this entry.
  </SheetDescription>
</SheetHeader>
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
npm run test -- src/components/ExpenseListItem.mascot.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ExpenseListItem.tsx src/components/ExpenseListItem.mascot.test.tsx
git commit -m "feat: add idle mascot companion to expense edit sheet"
```

---

### Task 4: Integrate Companion Into Budget Drawers

**Files:**
- Modify: `src/components/BudgetWeeklyTransactionsClient.tsx`
- Modify: `src/components/BudgetWeeklyBudgetsClient.tsx`
- Create: `src/components/BudgetWeeklyTransactionsClient.mascot.test.tsx`
- Create: `src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx`

- [ ] **Step 1: Write failing tests for both budget drawer integrations**

```tsx
// src/components/BudgetWeeklyTransactionsClient.mascot.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BudgetWeeklyTransactionsClient from "./BudgetWeeklyTransactionsClient";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/components/ui/drawer", () => {
  const Wrap = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    Drawer: Wrap,
    DrawerContent: Wrap,
    DrawerHeader: Wrap,
    DrawerTitle: Wrap,
    DrawerDescription: Wrap,
    DrawerFooter: Wrap,
  };
});

describe("BudgetWeeklyTransactionsClient mascot", () => {
  it("renders idle mascot in assign drawer header", () => {
    render(
      <BudgetWeeklyTransactionsClient
        budgets={[{ id: 1, name: "Food" }]}
        transactions={[]}
      />
    );

    expect(screen.getByTestId("dialog-companion-slot")).toBeInTheDocument();
  });
});
```

```tsx
// src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BudgetWeeklyBudgetsClient from "./BudgetWeeklyBudgetsClient";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
    removeQueries: vi.fn(),
  }),
  useQuery: () => ({
    data: { budgets: [] },
    error: null,
    isError: false,
    isPending: false,
    refetch: vi.fn(),
  }),
  useInfiniteQuery: () => ({
    data: undefined,
    isPending: false,
    isFetching: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    fetchNextPage: vi.fn(),
    error: null,
  }),
}));

vi.mock("@/components/ui/drawer", () => {
  const Wrap = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    Drawer: Wrap,
    DrawerContent: Wrap,
    DrawerHeader: Wrap,
    DrawerTitle: Wrap,
    DrawerDescription: Wrap,
    DrawerFooter: Wrap,
  };
});

vi.mock("@/components/ui/dialog", () => {
  const Wrap = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Wrap,
    DialogContent: Wrap,
    DialogHeader: Wrap,
    DialogTitle: Wrap,
    DialogDescription: Wrap,
    DialogFooter: Wrap,
  };
});

describe("BudgetWeeklyBudgetsClient mascot", () => {
  it("renders idle mascot in create/edit drawer header", () => {
    render(<BudgetWeeklyBudgetsClient weekStartDate="2026-03-30" />);

    expect(screen.getByTestId("dialog-companion-slot")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
npm run test -- src/components/BudgetWeeklyTransactionsClient.mascot.test.tsx src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx
```

Expected: FAIL because `DialogCompanionSlot` is not yet rendered in those drawer headers.

- [ ] **Step 3: Add component integrations**

```tsx
// src/components/BudgetWeeklyTransactionsClient.tsx (imports)
import DialogCompanionSlot from "@/components/mascots/DialogCompanionSlot";

// src/components/BudgetWeeklyTransactionsClient.tsx (inside assign <DrawerHeader>)
<DrawerHeader className="gap-2">
  <DialogCompanionSlot />
  <DrawerTitle>Assign budget</DrawerTitle>
  <DrawerDescription asChild>{/* existing description content */}</DrawerDescription>
</DrawerHeader>
```

```tsx
// src/components/BudgetWeeklyBudgetsClient.tsx (imports)
import DialogCompanionSlot from "@/components/mascots/DialogCompanionSlot";

// src/components/BudgetWeeklyBudgetsClient.tsx (inside create/edit drawer header)
<DrawerHeader className="gap-1 pb-2">
  <DialogCompanionSlot />
  <DrawerTitle>{formTitle}</DrawerTitle>
  <DrawerDescription>{formDescription}</DrawerDescription>
</DrawerHeader>
```

- [ ] **Step 4: Run tests to verify pass**

Run:
```bash
npm run test -- src/components/BudgetWeeklyTransactionsClient.mascot.test.tsx src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/BudgetWeeklyTransactionsClient.tsx src/components/BudgetWeeklyBudgetsClient.tsx src/components/BudgetWeeklyTransactionsClient.mascot.test.tsx src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx
git commit -m "feat: add idle mascot companion to budget drawers"
```

---

### Task 5: Targeted Verification and Final Cleanup

**Files:**
- Verify: all files from Tasks 1-4

- [ ] **Step 1: Run all mascot-focused tests together**

Run:
```bash
npm run test -- src/components/mascots/DialogCompanionSlot.test.tsx src/components/ExpenseEntryDrawer.mascot.test.tsx src/components/ExpenseListItem.mascot.test.tsx src/components/BudgetWeeklyTransactionsClient.mascot.test.tsx src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx
```

Expected: PASS (all tests green).

- [ ] **Step 2: Run existing nearby regression tests**

Run:
```bash
npm run test -- src/components/ManualExpenseForm.quick-mode.test.tsx src/components/SpendingDashboardHeaderClient.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Perform static orb-regression check in dialog integrations**

Run:
```bash
rg -n "SiriOrb|siri-orb" src/components/ExpenseEntryDrawer.tsx src/components/ExpenseListItem.tsx src/components/BudgetWeeklyTransactionsClient.tsx src/components/BudgetWeeklyBudgetsClient.tsx
```

Expected: no matches.

- [ ] **Step 4: Manual QA checklist**

```text
1. Open Add expense sheet -> idle mascot visible in header.
2. Open Edit expense sheet -> idle mascot visible in header.
3. Open Assign budget drawer -> idle mascot visible in header.
4. Open Create/Edit budget drawer -> idle mascot visible in header.
5. Save any form -> no pose changes (idle remains), no new delay in close behavior.
6. Mobile width and desktop width -> no header overlap/layout shift.
```

- [ ] **Step 5: Final commit**

```bash
git add src/components/ExpenseEntryDrawer.tsx src/components/ExpenseListItem.tsx src/components/BudgetWeeklyTransactionsClient.tsx src/components/BudgetWeeklyBudgetsClient.tsx src/components/mascots/DialogCompanionSlot.tsx src/components/mascots/DialogCompanionSlot.test.tsx src/components/ExpenseEntryDrawer.mascot.test.tsx src/components/ExpenseListItem.mascot.test.tsx src/components/BudgetWeeklyTransactionsClient.mascot.test.tsx src/components/BudgetWeeklyBudgetsClient.mascot.test.tsx
git commit -m "feat: add idle mascot companion to dialog surfaces"
```

---

## Spec Coverage Check

- Idle-only mascot baseline: covered by Tasks 1-4.
- Source-of-truth `IdleMascot` usage: enforced in Task 1 implementation.
- Dialog/sheet/drawer integrations: covered in Tasks 2-4.
- No success-state switching: preserved and manually validated in Task 5.
- No orb usage in companion placements: verified in Task 5.

## Placeholder Scan

- Verified no unresolved placeholder markers in this plan.

## Type and Naming Consistency

- Shared wrapper name: `DialogCompanionSlot` used consistently in all tasks.
- Mascot component name: `IdleMascot` used consistently.
- Test IDs: `dialog-companion-slot` and `idle-mascot` used consistently.
