# Create Multiple Expenses In One Open Session — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in, persisted "Keep open" toggle to the add-expense drawer so saving commits one expense and resets the form for the next entry without closing.

**Architecture:** A persisted `keepDrawerOpen` flag lives in the settings zustand store. The pure-create flow of `QuickExpenseDrawer` reads it; when on, `handleSubmit` resets the draft in place (carrying over date & paidBy) and refocuses the note input instead of closing. A new shadcn `Switch` primitive renders the toggle next to the close button. Edit and recovery flows are untouched.

**Tech Stack:** Next.js 15 / React 19, zustand (+ persist middleware), `@radix-ui/react-switch`, shadcn/ui, Tailwind v4, Vitest + Testing Library.

**Reference spec:** `docs/superpowers/specs/2026-05-29-multi-expense-add-sheet-design.md`

---

## File Structure

- **Modify** `src/stores/settings-store.ts` — add `keepDrawerOpen` state + `setKeepDrawerOpen` action.
- **Create** `src/stores/settings-store.test.ts` — covers the new flag default + setter.
- **Create** `src/components/ui/switch.tsx` — shadcn Switch primitive over `@radix-ui/react-switch`.
- **Modify** `src/components/QuickExpenseDrawer.tsx` — store reads, `buildNextEntryDraft` helper, keep-open branch in `handleSubmit`, toggle control in the top bar.
- **Modify** `src/components/QuickExpenseDrawer.test.tsx` — clear localStorage per test; add keep-open behavior + toggle-visibility tests.

---

## Task 1: Settings store `keepDrawerOpen` flag

**Files:**
- Modify: `src/stores/settings-store.ts`
- Test: `src/stores/settings-store.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `src/stores/settings-store.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";

import { createSettingsStore, defaultInitState } from "./settings-store";

describe("settings store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults keepDrawerOpen to false", () => {
    expect(defaultInitState.keepDrawerOpen).toBe(false);
    expect(createSettingsStore().getState().keepDrawerOpen).toBe(false);
  });

  it("setKeepDrawerOpen updates the flag", () => {
    const store = createSettingsStore();
    store.getState().setKeepDrawerOpen(true);
    expect(store.getState().keepDrawerOpen).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/stores/settings-store.test.ts`
Expected: FAIL — `keepDrawerOpen` is not a property on the store state / `defaultInitState`.

- [ ] **Step 3: Write minimal implementation**

Replace the contents of `src/stores/settings-store.ts` with:

```ts
import { PaidBy } from "@/enums";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

export type TSettingsState = {
  paidBy: string;
  keepDrawerOpen: boolean;
};

export type TSettingsActions = {
  setPaidBy: (paidBy: string) => void;
  setKeepDrawerOpen: (keepDrawerOpen: boolean) => void;
};

export type TSettingsStore = TSettingsState & TSettingsActions;

export const defaultInitState: TSettingsState = {
  paidBy: PaidBy.CUBI,
  keepDrawerOpen: false,
};

export const createSettingsStore = (
  initState: TSettingsState = defaultInitState
) => {
  return createStore<TSettingsStore>()(
    persist(
      (set) => ({
        ...initState,
        setPaidBy: (paidBy: string) => set({ paidBy }),
        setKeepDrawerOpen: (keepDrawerOpen: boolean) =>
          set({ keepDrawerOpen }),
      }),
      {
        version: 2,
        name: "settings",
      }
    )
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/stores/settings-store.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Format, lint, commit**

```bash
rtk bunx prettier --write src/stores/settings-store.ts src/stores/settings-store.test.ts
rtk bunx eslint src/stores/settings-store.ts src/stores/settings-store.test.ts
git add src/stores/settings-store.ts src/stores/settings-store.test.ts
git commit -m "feat: add persisted keepDrawerOpen setting"
```

---

## Task 2: Switch primitive

**Files:**
- Modify: `package.json` (via `bun add`)
- Create: `src/components/ui/switch.tsx`

- [ ] **Step 1: Install the radix dependency**

Run: `bun add @radix-ui/react-switch`
Expected: `@radix-ui/react-switch` added to `dependencies` in `package.json`.

- [ ] **Step 2: Create the Switch primitive**

Create `src/components/ui/switch.tsx`:

```tsx
"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import * as SwitchPrimitive from "@radix-ui/react-switch";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-colors outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "bg-background pointer-events-none block size-4 translate-x-0.5 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[1.125rem]"
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
```

- [ ] **Step 3: Typecheck the new primitive**

Run: `bunx tsc --noEmit`
Expected: no errors referencing `src/components/ui/switch.tsx`.

- [ ] **Step 4: Format, lint, commit**

```bash
rtk bunx prettier --write src/components/ui/switch.tsx
rtk bunx eslint src/components/ui/switch.tsx
git add src/components/ui/switch.tsx package.json bun.lock
git commit -m "feat: add Switch ui primitive"
```

Note: if the lockfile is named `bun.lockb`, stage that instead of `bun.lock`.

---

## Task 3: Keep-open toggle and save behavior in the drawer

**Files:**
- Modify: `src/components/QuickExpenseDrawer.tsx`
- Test: `src/components/QuickExpenseDrawer.test.tsx`

- [ ] **Step 1: Make tests isolated by clearing persisted settings**

In `src/components/QuickExpenseDrawer.test.tsx`, find the `beforeEach` block that starts with `vi.clearAllMocks();` and add a localStorage clear as the first line so a toggled `keepDrawerOpen` never leaks into later tests:

```ts
beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  Object.defineProperty(window, "matchMedia", {
```

(Only the `window.localStorage.clear();` line is new; the surrounding lines already exist.)

- [ ] **Step 2: Write the failing tests**

Append this new describe block to `src/components/QuickExpenseDrawer.test.tsx` (after the `QuickExpenseDrawer — submit` describe block, before `QuickExpenseDrawer — edit mode`):

```tsx
describe("QuickExpenseDrawer — keep open", () => {
  const openDrawer = async () => {
    const user = userEvent.setup();
    renderDrawer();
    await user.click(screen.getByRole("button", { name: /add expense/i }));
    return user;
  };

  it("shows the keep-open toggle in create mode", async () => {
    await openDrawer();
    expect(
      screen.getByRole("switch", { name: /keep open/i })
    ).toBeInTheDocument();
  });

  it("keeps the drawer open and resets the draft after saving when enabled", async () => {
    const user = await openDrawer();

    await user.click(screen.getByRole("switch", { name: /keep open/i }));

    // Change the date to a non-today value to prove it carries over.
    await user.click(screen.getByRole("button", { name: /^date:/i }));
    await user.click(
      await screen.findByRole("button", { name: /pick mocked date/i })
    );
    await user.click(screen.getByRole("button", { name: /done/i }));

    await user.type(
      screen.getByPlaceholderText(/what did you spend on/i),
      "First item"
    );
    await user.click(screen.getByPlaceholderText("0"));
    await user.keyboard("12000");
    await user.click(screen.getByRole("button", { name: /save expense/i }));

    await waitFor(() =>
      expect(mutationMocks.createMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 12000, note: "First item" })
      )
    );

    const note = screen.getByPlaceholderText(/what did you spend on/i);
    expect(note).toBeInTheDocument();
    expect(note).toHaveValue("");
    expect(screen.getByPlaceholderText("0")).toHaveValue("");
    await waitFor(() => expect(note).toHaveFocus());
    expect(
      screen.getByRole("button", { name: /date: 20\/05/i })
    ).toBeInTheDocument();
  });

  it("closes after saving when keep-open is off", async () => {
    const user = await openDrawer();

    await user.type(
      screen.getByPlaceholderText(/what did you spend on/i),
      "Single item"
    );
    await user.click(screen.getByPlaceholderText("0"));
    await user.keyboard("12000");
    await user.click(screen.getByRole("button", { name: /save expense/i }));

    await waitFor(() =>
      expect(mutationMocks.createMutateAsync).toHaveBeenCalled()
    );
    expect(
      screen.queryByPlaceholderText(/what did you spend on/i)
    ).not.toBeInTheDocument();
  });

  it("hides the keep-open toggle in edit mode", async () => {
    renderDrawer({
      mode: "edit",
      open: true,
      showTrigger: false,
      transactionId: 42,
      initialExpense: {
        date: "2026-05-20",
        amount: 150000,
        note: "Badminton court",
        category: "Badminton",
        paidBy: "Embe",
        budgetId: 2,
      },
    });

    await screen.findByPlaceholderText(/what did you spend on/i);
    expect(
      screen.queryByRole("switch", { name: /keep open/i })
    ).not.toBeInTheDocument();
  });

  it("hides the keep-open toggle in recovery mode", async () => {
    const { rerenderDrawer } = renderDrawer({
      open: false,
      showTrigger: false,
    });

    rerenderDrawer({
      open: true,
      showTrigger: false,
      recoveryOperationId: "op-1",
      recoveryDraft: {
        clientId: "expense-client-1",
        date: "20/05/2026",
        amount: 45000,
        note: "Recovered lunch",
        category: Category.FOOD,
        budgetId: null,
        budgetName: null,
        budgetIcon: null,
        budgetColor: null,
        paidBy: PaidBy.OTHER,
      },
    });

    await screen.findByPlaceholderText(/what did you spend on/i);
    expect(
      screen.queryByRole("switch", { name: /keep open/i })
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun run test src/components/QuickExpenseDrawer.test.tsx -t "keep open"`
Expected: FAIL — no `switch` role with name "keep open" exists; the keep-open save tests fail because the drawer always closes.

- [ ] **Step 4: Import the Switch primitive**

In `src/components/QuickExpenseDrawer.tsx`, add the import alongside the other `@/components/ui/*` imports (after the `Drawer` import group, near line 60):

```tsx
import { Switch } from "@/components/ui/switch";
```

- [ ] **Step 5: Add the `buildNextEntryDraft` helper**

In `src/components/QuickExpenseDrawer.tsx`, add this helper right after `cloneExpenseDraft` (just before `buildQuickExpensePayload`, around line 218):

```tsx
const buildNextEntryDraft = (previous: TExpenseDraft): TExpenseDraft => ({
  ...buildDefaultDraft(normalizePaidBy(previous.paidBy)),
  date: previous.date,
});
```

- [ ] **Step 6: Read the keep-open setting in the component**

In `src/components/QuickExpenseDrawer.tsx`, find the existing settings store read (around line 277):

```tsx
  const settingsPaidBy = useSettingsStore((state) => state.paidBy);
```

Add directly below it:

```tsx
  const keepDrawerOpen = useSettingsStore((state) => state.keepDrawerOpen);
  const setKeepDrawerOpen = useSettingsStore(
    (state) => state.setKeepDrawerOpen
  );
```

- [ ] **Step 7: Branch `handleSubmit` on keep-open**

In `src/components/QuickExpenseDrawer.tsx`, inside `handleSubmit`, find this block (around lines 451-454):

```tsx
      if (recoveryOperationId) {
        clearRecovery(recoveryOperationId);
      }
      handleOpenChange(false);
```

Replace it with:

```tsx
      if (recoveryOperationId) {
        clearRecovery(recoveryOperationId);
      }
      const keepOpen =
        !isEditMode &&
        !recoveryOperationId &&
        !recoveryDraft &&
        keepDrawerOpen;
      if (keepOpen) {
        const nextDraft = buildNextEntryDraft(submittedDraft);
        setDraft(nextDraft);
        resetSuggestionTracking(nextDraft, "none");
        noteRef.current?.focus({ preventScroll: true });
      } else {
        handleOpenChange(false);
      }
```

- [ ] **Step 8: Add the toggle to the top bar**

In `src/components/QuickExpenseDrawer.tsx`, add a derived flag near the other render-time derived values (right after `const submitLabel = ...`, around line 738):

```tsx
  const showKeepOpenToggle =
    !isEditMode && !recoveryOperationId && !recoveryDraft;
```

Then find the existing `DrawerClose` element inside `DrawerContent` (around lines 801-804):

```tsx
          <DrawerClose className="quick-expense-enter-group quick-expense-enter-delay-1 ring-offset-background absolute top-4 right-4 z-60 rounded-full p-2 opacity-70 shadow-md ring-1 ring-white/10 transition-[opacity,transform,box-shadow] duration-300 hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden active:scale-95 disabled:pointer-events-none">
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </DrawerClose>
```

Replace it with:

```tsx
          <div className="quick-expense-enter-group quick-expense-enter-delay-1 absolute top-4 right-4 z-60 flex items-center gap-2">
            {showKeepOpenToggle ? (
              <label className="bg-surface-3/60 flex items-center gap-2 rounded-full py-1.5 pr-1.5 pl-3 text-xs font-medium opacity-70 shadow-md ring-1 ring-white/10">
                <span>Keep open</span>
                <Switch
                  checked={keepDrawerOpen}
                  onCheckedChange={setKeepDrawerOpen}
                  onPointerDown={(event) => event.preventDefault()}
                  aria-label="Keep open"
                />
              </label>
            ) : null}
            <DrawerClose className="ring-offset-background rounded-full p-2 opacity-70 shadow-md ring-1 ring-white/10 transition-[opacity,transform,box-shadow] duration-300 hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden active:scale-95 disabled:pointer-events-none">
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </DrawerClose>
          </div>
```

- [ ] **Step 9: Run the keep-open tests to verify they pass**

Run: `bun run test src/components/QuickExpenseDrawer.test.tsx -t "keep open"`
Expected: PASS (5 tests).

- [ ] **Step 10: Run the full drawer + settings suites for regressions**

Run: `bun run test src/components/QuickExpenseDrawer.test.tsx src/stores/settings-store.test.ts`
Expected: PASS — all existing drawer tests (including "…and closes" and edit/recovery) still pass with the localStorage-clearing `beforeEach`.

- [ ] **Step 11: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 12: Format, lint, commit**

```bash
rtk bunx prettier --write src/components/QuickExpenseDrawer.tsx src/components/QuickExpenseDrawer.test.tsx
rtk bunx eslint src/components/QuickExpenseDrawer.tsx src/components/QuickExpenseDrawer.test.tsx
git add src/components/QuickExpenseDrawer.tsx src/components/QuickExpenseDrawer.test.tsx
git commit -m "feat: keep add-expense drawer open for multiple entries"
```

---

## Final Verification

- [ ] **Build before pushing** (per `CLAUDE.md`): `npm run build` — expected to succeed.
- [ ] Manual smoke (optional, `bun run dev`): open the add sheet, flip **Keep open** on, save an expense → drawer stays open, note/amount clear, date & paidBy persist, note refocused, success toast shows. Flip off → save closes the drawer. Edit an existing expense and trigger a recovery sheet → no toggle, both still close on save.

---

## Self-Review Notes

- **Spec coverage:** settings flag (Task 1) ✓; Switch primitive (Task 2) ✓; toggle control + placement + iOS pointer-down guard (Task 3, Step 8) ✓; keep-open save reset carrying date & paidBy + refocus (Task 3, Steps 5/7) ✓; scope limited to pure-create flow via `keepOpen`/`showKeepOpenToggle` guards ✓; tests for create on/off, edit, recovery, defaults (Tasks 1 & 3) ✓.
- **Type consistency:** `keepDrawerOpen`/`setKeepDrawerOpen` names match across store, hook reads, and JSX. `buildNextEntryDraft` returns `TExpenseDraft` consumed by `setDraft`/`resetSuggestionTracking`, matching their existing signatures. `normalizePaidBy` and `buildDefaultDraft` are pre-existing helpers reused as defined.
- **No placeholders:** every code and command step is concrete.
