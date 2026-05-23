# Compact Mobile Toast UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved compact, minimalist, top-positioned mobile toast UI using Sonner without changing mutation ownership.

**Architecture:** Centralize the toast visual policy in `src/components/ui/sonner.tsx` so the root layout only mounts `<Toaster />`. Keep all existing `toast.success/error/loading` call sites intact. Update `QuickExpenseMutationCoordinator` only to give recovery error toasts a longer duration while preserving its existing toast-id replacement and `Reopen` recovery action.

**Tech Stack:** Next.js App Router, React 19, Sonner 2.0.7, next-themes, lucide-react, Tailwind v4, Vitest, Testing Library.

---

## File Structure

- Modify `src/components/ui/sonner.tsx`
  - Own all app-wide Sonner defaults: position, safe-area mobile offsets, visible toast count, compact class names, icons, durations, no rich colors, no close button.
  - Keep the wrapper as a small client component.
- Create `src/components/ui/sonner.test.tsx`
  - Mock Sonner and `next-themes`.
  - Assert the wrapper passes the compact app defaults and class names to Sonner.
- Modify `src/app/layout.tsx`
  - Replace the verbose root `<Toaster ... />` prop block with `<Toaster />`.
  - Do not move provider order.
- Modify `src/components/QuickExpenseMutationCoordinator.tsx`
  - Add a recovery error toast duration constant.
  - Pass `duration` only on recovery error toasts.
  - Do not move mutation execution or toast lifecycle into mutation hooks.
- Modify `src/components/QuickExpenseMutationCoordinator.test.tsx`
  - Assert recovery error toasts include the longer duration while preserving `id` and `Reopen`.

## Task 1: Lock The Toaster Wrapper Contract With Tests

**Files:**
- Create: `src/components/ui/sonner.test.tsx`

- [ ] **Step 1: Create the failing wrapper contract test**

Create `src/components/ui/sonner.test.tsx` with this content:

```tsx
import { render } from "@testing-library/react";
import type { ToasterProps } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "./sonner";

const sonnerMock = vi.hoisted(() => vi.fn());

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark" }),
}));

vi.mock("sonner", () => ({
  Toaster: (props: unknown) => {
    sonnerMock(props);
    return null;
  },
}));

describe("Toaster", () => {
  beforeEach(() => {
    sonnerMock.mockClear();
  });

  it("uses compact mobile-first app defaults", () => {
    render(<Toaster />);

    const props = sonnerMock.mock.calls[0]?.[0] as ToasterProps;
    const style = props.style as Record<string, string>;

    expect(props.theme).toBe("dark");
    expect(props.position).toBe("top-right");
    expect(props.richColors).toBe(false);
    expect(props.expand).toBe(false);
    expect(props.visibleToasts).toBe(1);
    expect(props.closeButton).toBe(false);
    expect(props.duration).toBe(3000);
    expect(props.mobileOffset).toEqual({
      top: "calc(env(safe-area-inset-top) + 12px)",
      right: "12px",
      bottom: "12px",
      left: "12px",
    });
    expect(style["--normal-bg"]).toBe("var(--popover)");
    expect(style["--normal-text"]).toBe("var(--popover-foreground)");
    expect(style["--normal-border"]).toBe(
      "color-mix(in srgb, var(--border) 76%, transparent)"
    );
    expect(style["--width"]).toBe("fit-content");
    expect(style["--border-radius"]).toBe("12px");
  });

  it("passes compact toast, title, icon, action, and variant classes", () => {
    render(<Toaster />);

    const props = sonnerMock.mock.calls[0]?.[0] as ToasterProps;
    const classNames = props.toastOptions?.classNames;

    expect(classNames?.toast).toEqual(expect.stringContaining("!min-h-[42px]"));
    expect(classNames?.toast).toEqual(expect.stringContaining("!w-fit"));
    expect(classNames?.toast).toEqual(
      expect.stringContaining("!max-w-[calc(100vw-24px)]")
    );
    expect(classNames?.toast).toEqual(expect.stringContaining("before:w-0.5"));
    expect(classNames?.description).toBe("hidden");
    expect(classNames?.title).toEqual(expect.stringContaining("truncate"));
    expect(classNames?.icon).toEqual(expect.stringContaining("[&>svg]:size-4"));
    expect(classNames?.actionButton).toEqual(
      expect.stringContaining("min-h-8")
    );
    expect(classNames?.success).toBe("[--toast-accent:var(--success)]");
    expect(classNames?.error).toBe("[--toast-accent:var(--destructive)]");
    expect(classNames?.warning).toBe("[--toast-accent:var(--warning)]");
    expect(classNames?.info).toBe("[--toast-accent:var(--info)]");
    expect(classNames?.loading).toBe("[--toast-accent:var(--info)]");
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
bun run test src/components/ui/sonner.test.tsx
```

Expected: FAIL because `src/components/ui/sonner.tsx` does not yet pass compact defaults such as `visibleToasts={1}`, `richColors={false}`, `mobileOffset`, `--width: fit-content`, or the compact class names.

- [ ] **Step 3: Commit the failing test**

```bash
git add src/components/ui/sonner.test.tsx
git commit -m "test: lock compact toast defaults"
```

## Task 2: Implement Compact Toaster Defaults

**Files:**
- Modify: `src/components/ui/sonner.tsx`
- Modify: `src/app/layout.tsx`
- Test: `src/components/ui/sonner.test.tsx`

- [ ] **Step 1: Replace `src/components/ui/sonner.tsx` with centralized defaults**

Replace the file with:

```tsx
"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Info,
  LoaderCircle,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const TOAST_MOBILE_OFFSET = {
  top: "calc(env(safe-area-inset-top) + 12px)",
  right: "12px",
  bottom: "12px",
  left: "12px",
} satisfies ToasterProps["mobileOffset"];

const TOAST_CLASS_NAMES: NonNullable<
  NonNullable<ToasterProps["toastOptions"]>["classNames"]
> = {
  toast:
    "pointer-events-auto relative !left-auto !right-0 !min-h-[42px] !w-fit !max-w-[calc(100vw-24px)] !rounded-xl !border !border-[color-mix(in_srgb,var(--border)_76%,transparent)] !bg-popover !px-3 !py-2 !text-[13px] !font-medium !leading-tight !text-popover-foreground !shadow-[0_16px_36px_rgb(0_0_0_/_34%)] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-r-full before:bg-[var(--toast-accent,var(--border))]",
  title: "truncate text-[13px] font-medium leading-tight",
  description: "hidden",
  content: "min-w-0",
  icon: "shrink-0 text-[var(--toast-accent,var(--muted-foreground))] [&>svg]:size-4",
  actionButton:
    "relative ml-2 min-h-8 rounded-full bg-foreground/10 px-2.5 text-xs font-semibold text-foreground transition-[background-color,transform] duration-150 ease-out before:absolute before:-inset-1 active:scale-[0.96]",
  success: "[--toast-accent:var(--success)]",
  error: "[--toast-accent:var(--destructive)]",
  warning: "[--toast-accent:var(--warning)]",
  info: "[--toast-accent:var(--info)]",
  loading: "[--toast-accent:var(--info)]",
};

const TOAST_ICONS: ToasterProps["icons"] = {
  success: <CheckCircle2 aria-hidden="true" />,
  error: <CircleAlert aria-hidden="true" />,
  warning: <AlertTriangle aria-hidden="true" />,
  info: <Info aria-hidden="true" />,
  loading: <LoaderCircle aria-hidden="true" className="animate-spin" />,
};

const Toaster = ({ toastOptions, style, ...props }: ToasterProps) => {
  const { theme = "dark" } = useTheme();

  return (
    <Sonner
      position="top-right"
      richColors={false}
      expand={false}
      visibleToasts={1}
      closeButton={false}
      duration={3000}
      mobileOffset={TOAST_MOBILE_OFFSET}
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={TOAST_ICONS}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border":
            "color-mix(in srgb, var(--border) 76%, transparent)",
          "--border-radius": "12px",
          "--width": "fit-content",
          ...style,
        } as React.CSSProperties
      }
      toastOptions={{
        closeButton: false,
        ...toastOptions,
        classNames: {
          ...TOAST_CLASS_NAMES,
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
```

- [ ] **Step 2: Simplify the root layout Toaster mount**

In `src/app/layout.tsx`, replace lines equivalent to:

```tsx
          <Toaster
            position="top-right"
            richColors
            toastOptions={{
              classNames: {
                toast: "group-[.toaster]:pointer-events-auto",
              },
            }}
          />
```

with:

```tsx
          <Toaster />
```

Do not move `Toaster` out of `ReactQueryProvider`. Do not move `ThemeProvider`, `QuickExpenseMutationCoordinator`, `QuickExpenseRecoverySheetHost`, `ProgressiveBlur`, or `BottomNav`.

- [ ] **Step 3: Run the wrapper test and verify it passes**

Run:

```bash
bun run test src/components/ui/sonner.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Check formatting and TypeScript for the touched wrapper**

Run:

```bash
bunx tsc --noEmit --pretty false
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit the compact wrapper implementation**

```bash
git add src/components/ui/sonner.tsx src/app/layout.tsx src/components/ui/sonner.test.tsx
git commit -m "feat: centralize compact toast styling"
```

## Task 3: Add Recovery Toast Duration

**Files:**
- Modify: `src/components/QuickExpenseMutationCoordinator.test.tsx`
- Modify: `src/components/QuickExpenseMutationCoordinator.tsx`

- [ ] **Step 1: Update coordinator tests to require recovery duration**

In `src/components/QuickExpenseMutationCoordinator.test.tsx`, update each recovery error expectation to include `duration: 9000`.

For the test `"marks failed operations and wires Reopen to the recovery entry"`, change the object containing block to:

```tsx
        expect.objectContaining({
          id: "loading-toast",
          duration: 9000,
          action: expect.objectContaining({ label: "Reopen" }),
        })
```

For the test `"shows error and marks failed when the loading toast id is missing"`, change the object containing block to:

```tsx
        expect.objectContaining({
          id: undefined,
          duration: 9000,
          action: expect.objectContaining({ label: "Reopen" }),
        })
```

For the test `"marks edit entries without a transaction id failed and wires Reopen"`, change the object containing block to:

```tsx
        expect.objectContaining({
          id: "loading-toast",
          duration: 9000,
          action: expect.objectContaining({ label: "Reopen" }),
        })
```

- [ ] **Step 2: Run the coordinator test and verify it fails**

Run:

```bash
bun run test src/components/QuickExpenseMutationCoordinator.test.tsx
```

Expected: FAIL because `toast.error` options do not yet include `duration: 9000`.

- [ ] **Step 3: Implement the recovery duration**

In `src/components/QuickExpenseMutationCoordinator.tsx`, add this constant near `getErrorMessage`:

```tsx
const RECOVERY_TOAST_DURATION_MS = 9000;
```

Then update the `toast.error` options in the `.catch(...)` block to:

```tsx
            {
              id: latest?.toastId,
              duration: RECOVERY_TOAST_DURATION_MS,
              action: {
                label: "Reopen",
                onClick: () => setActiveRecovery(operationId),
              },
            }
```

Do not change the loading toast, success toast, recovery store, mutation hooks, or query invalidation.

- [ ] **Step 4: Run the coordinator test and verify it passes**

Run:

```bash
bun run test src/components/QuickExpenseMutationCoordinator.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit the recovery duration change**

```bash
git add src/components/QuickExpenseMutationCoordinator.tsx src/components/QuickExpenseMutationCoordinator.test.tsx
git commit -m "feat: extend recovery toast duration"
```

## Task 4: Targeted Verification And Mobile Review

**Files:**
- Verify: `src/components/ui/sonner.tsx`
- Verify: `src/app/layout.tsx`
- Verify: `src/components/QuickExpenseMutationCoordinator.tsx`
- Verify: `src/components/QuickExpenseMutationCoordinator.test.tsx`
- Verify: `src/components/ui/sonner.test.tsx`

- [ ] **Step 1: Run the focused automated checks**

Run:

```bash
bun run test src/components/ui/sonner.test.tsx src/components/QuickExpenseMutationCoordinator.test.tsx
```

Expected: PASS.

Run:

```bash
bunx tsc --noEmit --pretty false
```

Expected: PASS.

- [ ] **Step 2: Start the dev server for visual review**

Run:

```bash
bun run dev
```

Expected: Next.js starts and prints a local URL, usually `http://localhost:3000`.

- [ ] **Step 3: Verify the mobile toast manually**

Open the app in a mobile viewport around `390px` wide.

Trigger a quick expense create flow from the bottom nav and verify:

- Loading toast appears at the top, clears the safe area, and does not overlap bottom nav.
- Success toast replaces the loading toast instead of stacking.
- Routine success toast is one line and roughly `40-44px` tall.
- Toast has no description and no close button.
- Toast uses popover surface plus a small semantic icon/accent, not a filled green/red block.

Trigger a failed quick expense background submit with this browser-only flow:

1. Open the quick expense sheet.
2. Fill a valid draft.
3. Open browser devtools and set the Network panel to Offline.
4. Submit the draft.
5. Return the Network panel to Online after the error toast appears.

Verify:

- Error toast replaces the loading toast instead of stacking.
- Error toast has one text line plus the inline `Reopen` action.
- Error toast remains around `44-48px` tall.
- `Reopen` restores the failed draft.

- [ ] **Step 4: Stop the dev server**

Stop the dev server with `Ctrl-C`.

- [ ] **Step 5: Commit any final visual polish**

Only run this step if manual review required small class adjustments:

```bash
git add src/components/ui/sonner.tsx src/app/layout.tsx src/components/QuickExpenseMutationCoordinator.tsx src/components/QuickExpenseMutationCoordinator.test.tsx src/components/ui/sonner.test.tsx
git commit -m "fix: polish compact toast mobile display"
```

If manual review required no changes, skip this commit.

## Self-Review

Spec coverage:

- Top placement and safe-area mobile offset: Task 2.
- Minimal compact UI, no descriptions, no close button: Task 1 and Task 2.
- One visible toast and no expandable stack: Task 1 and Task 2.
- Surface plus small semantic accent instead of rich filled colors: Task 1 and Task 2.
- Recovery action duration and coordinator ownership: Task 3.
- Targeted tests and manual mobile review: Task 4.

Placeholder scan:

- No placeholder tasks remain.
- Every code-changing step includes exact code or exact replacement text.
- Every automated check includes an exact command and expected result.

Type consistency:

- `ToasterProps`, `mobileOffset`, `toastOptions.classNames`, and `icons` match Sonner 2.0.7 types.
- `duration` is passed through Sonner `toast.error` options, matching `ExternalToast`.
- No mutation hook or recovery store type changes are introduced.
