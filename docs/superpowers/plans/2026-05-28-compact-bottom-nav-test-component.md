# Compact Bottom Nav Test Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new Linear-inspired compact bottom nav on `/dev/bottom-nav` for mobile review without replacing the production `BottomNav.tsx`.

**Architecture:** Add a focused client component that owns only prototype nav state, active route detection, and the existing quick-expense trigger. Add a route-scoped preview page with fake list content behind the dock. Hide the existing production nav and remove global shell padding only for `/dev/bottom-nav` so review is not polluted by duplicate bottom UI.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind v4, Lucide React, Vitest, Testing Library.

---

## File Structure

- Create `src/components/CompactBottomNavPreview.tsx`
  - Client component for the new prototype nav.
  - Owns expand/collapse state.
  - Uses `next/link`, `usePathname`, `useAppHaptics`, and `QuickExpenseDrawer`.
- Create `src/components/CompactBottomNavPreview.test.tsx`
  - Unit tests for collapsed state, expand behavior, active links, and haptics.
- Create `src/app/dev/bottom-nav/page.tsx`
  - Server route that renders a mobile-first preview surface and the prototype nav.
- Modify `src/components/BottomNav.tsx`
  - Add `/dev/bottom-nav` to `HIDDEN_PATHS` so the production nav is hidden only on the prototype route.
- Modify `src/components/AppMain.tsx`
  - Add `/dev/bottom-nav` to `FULL_BLEED_PATHS` so the prototype route can control its own bottom spacing.

---

### Task 1: Add Failing Component Tests

**Files:**
- Create: `src/components/CompactBottomNavPreview.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CompactBottomNavPreview from "./CompactBottomNavPreview";

const { hapticsMock, pathnameState } = vi.hoisted(() => ({
  hapticsMock: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    selection: vi.fn(),
    impact: vi.fn(),
    trigger: vi.fn(),
  },
  pathnameState: {
    value: "/",
  },
}));

vi.mock("@/hooks/useAppHaptics", () => ({
  useAppHaptics: () => hapticsMock,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
}));

vi.mock("@/components/QuickExpenseDrawer", () => ({
  default: ({
    onTriggerClick,
  }: {
    compact?: boolean;
    onTriggerClick?: () => void;
  }) => (
    <button type="button" onClick={onTriggerClick}>
      Add expense
    </button>
  ),
}));

const originalGlobalReact = (globalThis as unknown as Record<string, unknown>)
  .React;

beforeEach(() => {
  (globalThis as unknown as Record<string, unknown>).React = React;
  pathnameState.value = "/";
  hapticsMock.success.mockReset();
  hapticsMock.warning.mockReset();
  hapticsMock.error.mockReset();
  hapticsMock.selection.mockReset();
  hapticsMock.impact.mockReset();
  hapticsMock.trigger.mockReset();
});

afterEach(() => {
  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
    return;
  }
  (globalThis as unknown as Record<string, unknown>).React =
    originalGlobalReact;
});

describe("CompactBottomNavPreview", () => {
  it("renders collapsed primary controls and the add expense trigger", () => {
    render(<CompactBottomNavPreview />);

    expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /budgets/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /expand navigation/i })
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("link", { name: /reports/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /settings/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add expense/i })
    ).toBeInTheDocument();
  });

  it("expands and collapses the secondary report and settings controls", async () => {
    const user = userEvent.setup();

    render(<CompactBottomNavPreview />);

    const expandButton = screen.getByRole("button", {
      name: /expand navigation/i,
    });

    await user.click(expandButton);

    expect(
      screen.getByRole("button", { name: /collapse navigation/i })
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /reports/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /collapse navigation/i })
    );

    expect(
      screen.getByRole("button", { name: /expand navigation/i })
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("link", { name: /reports/i })
    ).not.toBeInTheDocument();
  });

  it("marks the active route with aria-current", async () => {
    const user = userEvent.setup();
    pathnameState.value = "/report/day/2026-05-28";

    render(<CompactBottomNavPreview />);

    await user.click(screen.getByRole("button", { name: /expand navigation/i }));

    expect(screen.getByRole("link", { name: /reports/i })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: /home/i })).not.toHaveAttribute(
      "aria-current"
    );
  });

  it("triggers medium impact haptics when add expense is clicked", async () => {
    const user = userEvent.setup();

    render(<CompactBottomNavPreview />);

    await user.click(screen.getByRole("button", { name: /add expense/i }));

    expect(hapticsMock.impact).toHaveBeenCalledTimes(1);
    expect(hapticsMock.impact).toHaveBeenCalledWith("medium");
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails because the component does not exist**

Run:

```bash
rtk bun run test src/components/CompactBottomNavPreview.test.tsx
```

Expected: FAIL with an import/module error for `./CompactBottomNavPreview`.

---

### Task 2: Implement `CompactBottomNavPreview`

**Files:**
- Create: `src/components/CompactBottomNavPreview.tsx`
- Test: `src/components/CompactBottomNavPreview.test.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useId, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAppHaptics } from "@/hooks/useAppHaptics";
import { cn } from "@/lib/utils";
import { BarChart3, ChevronUp, Cog, Home, Wallet } from "lucide-react";

import QuickExpenseDrawer from "@/components/QuickExpenseDrawer";

type TCompactNavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  isActive: (pathname: string) => boolean;
};

const primaryItems: TCompactNavItem[] = [
  {
    href: "/",
    label: "Home",
    icon: Home,
    isActive: (pathname) => pathname === "/",
  },
  {
    href: "/budgets",
    label: "Budgets",
    icon: Wallet,
    isActive: (pathname) => pathname.startsWith("/budgets"),
  },
];

const secondaryItems: TCompactNavItem[] = [
  {
    href: "/report",
    label: "Reports",
    icon: BarChart3,
    isActive: (pathname) => pathname.startsWith("/report"),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Cog,
    isActive: (pathname) => pathname.startsWith("/settings"),
  },
];

const baseButtonClassName =
  "focus-visible:ring-ring/40 grid h-[52px] w-[72px] shrink-0 place-items-center rounded-full text-foreground transition-[transform,background-color,box-shadow,opacity] duration-200 ease-out active:scale-[0.96] focus-visible:ring-2 focus-visible:outline-none";

const CompactBottomNavPreview = () => {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();
  const haptics = useAppHaptics();
  const secondaryId = useId();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)]"
    >
      <div className="flex w-full max-w-[390px] items-end justify-between gap-4">
        <div
          className={cn(
            "relative grid w-[236px] items-end overflow-hidden rounded-[34px] border border-white/25 bg-[linear-gradient(180deg,color-mix(in_srgb,#ffffff_9%,transparent),color-mix(in_srgb,#ffffff_2%,transparent)),color-mix(in_srgb,var(--surface-3)_78%,transparent)] p-1.5 shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_20%,transparent),0_20px_46px_color-mix(in_srgb,#000000_58%,transparent)] backdrop-blur-2xl transition-[min-height,gap] duration-200 ease-out",
            expanded ? "min-h-[116px] gap-1.5" : "min-h-16 gap-0"
          )}
          data-expanded={expanded}
        >
          <div
            aria-hidden={!expanded}
            id={secondaryId}
            className={cn(
              "grid grid-cols-2 justify-end gap-1 transition-[max-height,opacity,transform] duration-200 ease-out",
              expanded
                ? "max-h-12 translate-y-0 opacity-100"
                : "pointer-events-none max-h-0 translate-y-2 opacity-0"
            )}
          >
            {expanded
              ? secondaryItems.map((item) => {
                  const Icon = item.icon;
                  const active = item.isActive(pathname);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-label={item.label}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        baseButtonClassName,
                        "h-[46px] opacity-85",
                        active
                          ? "bg-white/12 shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_13%,transparent),0_8px_18px_color-mix(in_srgb,#000000_22%,transparent)]"
                          : "hover:bg-white/8"
                      )}
                    >
                      <Icon className="size-5" />
                      <span className="sr-only">{item.label}</span>
                    </Link>
                  );
                })
              : null}
          </div>

          <div className="grid grid-cols-3 gap-1">
            {primaryItems.map((item) => {
              const Icon = item.icon;
              const active = item.isActive(pathname);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    baseButtonClassName,
                    active
                      ? "bg-white/12 shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_13%,transparent),0_8px_18px_color-mix(in_srgb,#000000_22%,transparent)]"
                      : "hover:bg-white/8"
                  )}
                >
                  <Icon className="size-7" />
                  <span className="sr-only">{item.label}</span>
                </Link>
              );
            })}

            <button
              type="button"
              aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
              aria-expanded={expanded}
              aria-controls={secondaryId}
              onClick={() => setExpanded((value) => !value)}
              className={cn(baseButtonClassName, "hover:bg-white/8")}
            >
              <ChevronUp
                className={cn(
                  "size-7 transition-transform duration-200 ease-out",
                  expanded && "rotate-180"
                )}
              />
            </button>
          </div>
        </div>

        <div className="grid size-16 shrink-0 place-items-center rounded-full border border-white/25 bg-[linear-gradient(180deg,color-mix(in_srgb,#ffffff_9%,transparent),color-mix(in_srgb,#ffffff_2%,transparent)),color-mix(in_srgb,var(--surface-3)_78%,transparent)] p-1 shadow-[inset_0_1px_0_color-mix(in_srgb,#ffffff_20%,transparent),0_20px_46px_color-mix(in_srgb,#000000_58%,transparent)] backdrop-blur-2xl [&_[data-slot=button]]:size-14 [&_[data-slot=button]]:rounded-full">
          <QuickExpenseDrawer
            compact
            onTriggerClick={() => haptics.impact("medium")}
          />
        </div>
      </div>
    </nav>
  );
};

export default CompactBottomNavPreview;
```

- [ ] **Step 2: Run the component test**

Run:

```bash
rtk bun run test src/components/CompactBottomNavPreview.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Commit the component and test**

```bash
rtk git add src/components/CompactBottomNavPreview.tsx src/components/CompactBottomNavPreview.test.tsx
rtk git commit -m "feat(nav): add compact bottom nav preview"
```

---

### Task 3: Add the `/dev/bottom-nav` Preview Page

**Files:**
- Create: `src/app/dev/bottom-nav/page.tsx`
- Test manually through browser on `http://localhost:3000/dev/bottom-nav`

- [ ] **Step 1: Create the route page**

```tsx
import CompactBottomNavPreview from "@/components/CompactBottomNavPreview";

const previewRows = [
  "Build new payment reconciliation workflow",
  "Update checkout logic to dynamically prefer recent budgets",
  'New "Contact Us" Button in Blue',
  "Update the Read Me",
  "blue contact us button",
  "Remove ! in Read.Me",
  "Issue with automatic case status update",
  "Weekly grocery budget review",
];

const BottomNavPreviewPage = () => {
  return (
    <main className="relative mx-auto min-h-svh w-full max-w-[430px] overflow-hidden bg-background text-foreground">
      <section className="px-5 pt-8 pb-36">
        <p className="text-muted-foreground text-xs font-semibold">
          Bottom nav test
        </p>
        <h1 className="mt-2 max-w-[280px] text-[28px] leading-[1.05] font-semibold tracking-normal">
          Compact grouped navigation
        </h1>

        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <div className="bg-surface-2 h-24 rounded-[18px] border border-white/7" />
          <div className="bg-surface-2 h-24 rounded-[18px] border border-white/7" />
        </div>

        <div className="mt-5 grid gap-0">
          {previewRows.map((row, index) => (
            <div
              key={row}
              className="grid min-h-[76px] grid-cols-[34px_minmax(0,1fr)_34px] items-center border-b border-white/5"
            >
              <span className="relative size-5 rounded-full border-[3px] border-warning">
                <span className="bg-warning absolute top-0.5 left-1.5 h-2 w-0.5 rotate-[85deg] rounded-full" />
              </span>
              <span className="truncate text-lg font-semibold text-foreground/92">
                {row}
              </span>
              {index % 3 === 0 ? (
                <span className="grid size-8 place-items-center rounded-full bg-success text-xs font-bold text-success-foreground">
                  SI
                </span>
              ) : (
                <span aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </section>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed right-0 bottom-0 left-0 h-44 bg-[radial-gradient(ellipse_at_50%_70%,color-mix(in_srgb,#ffffff_12%,transparent),transparent_28%),linear-gradient(transparent,color-mix(in_srgb,var(--background)_96%,transparent)_56%)]"
      />
      <CompactBottomNavPreview />
    </main>
  );
};

export default BottomNavPreviewPage;
```

- [ ] **Step 2: Run a route smoke test with the dev server**

Run:

```bash
rtk bun run dev
```

Expected: Next.js starts and prints a local URL. Keep it running for the browser check.

- [ ] **Step 3: Open the route in iPhone 13 viewport**

Run in a separate command while the dev server is still running:

```bash
rtk agent-browser set viewport 390 844 3
rtk agent-browser open http://localhost:3000/dev/bottom-nav
rtk agent-browser wait --load networkidle
rtk agent-browser snapshot -i
```

Expected snapshot includes `Home`, `Budgets`, `Expand navigation`, and `Add expense`.

- [ ] **Step 4: Commit the preview route**

```bash
rtk git add src/app/dev/bottom-nav/page.tsx
rtk git commit -m "feat(nav): add compact bottom nav preview route"
```

---

### Task 4: Hide Production Shell UI on the Preview Route

**Files:**
- Modify: `src/components/BottomNav.tsx`
- Modify: `src/components/AppMain.tsx`
- Test: `src/components/BottomNav.test.tsx`

- [ ] **Step 1: Add a failing test for hiding production `BottomNav` on `/dev/bottom-nav`**

Modify `src/components/BottomNav.test.tsx` so the mocked pathname is configurable:

```tsx
const { hapticsMock, pathnameState } = vi.hoisted(() => ({
  hapticsMock: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    selection: vi.fn(),
    impact: vi.fn(),
    trigger: vi.fn(),
  },
  pathnameState: {
    value: "/",
  },
}));
```

Replace the `next/navigation` mock with:

```tsx
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
}));
```

Add this reset in `beforeEach`:

```tsx
pathnameState.value = "/";
```

Add this test inside `describe("BottomNav", () => { ... })`:

```tsx
it("does not render on the compact bottom nav preview route", () => {
  pathnameState.value = "/dev/bottom-nav";

  render(<BottomNav />);

  expect(screen.queryByRole("navigation", { name: /primary/i })).toBeNull();
});
```

- [ ] **Step 2: Run the `BottomNav` test and verify it fails**

Run:

```bash
rtk bun run test src/components/BottomNav.test.tsx
```

Expected: FAIL because `/dev/bottom-nav` is not yet in `HIDDEN_PATHS`.

- [ ] **Step 3: Hide `BottomNav` on the preview route**

Modify `src/components/BottomNav.tsx`:

```tsx
const HIDDEN_PATHS = ["/ai", "/dev/bottom-nav"];
```

- [ ] **Step 4: Remove global bottom padding on the preview route**

Modify `src/components/AppMain.tsx`:

```tsx
const FULL_BLEED_PATHS = ["/ai", "/dev/bottom-nav"];
```

- [ ] **Step 5: Run the targeted tests**

Run:

```bash
rtk bun run test src/components/BottomNav.test.tsx src/components/CompactBottomNavPreview.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit route-scoped shell changes**

```bash
rtk git add src/components/BottomNav.tsx src/components/BottomNav.test.tsx src/components/AppMain.tsx
rtk git commit -m "feat(nav): isolate compact nav preview route"
```

---

### Task 5: Format, Lint, and Browser-Verify

**Files:**
- Check: `src/components/CompactBottomNavPreview.tsx`
- Check: `src/components/CompactBottomNavPreview.test.tsx`
- Check: `src/components/BottomNav.tsx`
- Check: `src/components/BottomNav.test.tsx`
- Check: `src/components/AppMain.tsx`
- Check: `src/app/dev/bottom-nav/page.tsx`

- [ ] **Step 1: Run Prettier write for modified TypeScript files**

```bash
rtk bunx prettier --write src/components/CompactBottomNavPreview.tsx src/components/CompactBottomNavPreview.test.tsx src/components/BottomNav.tsx src/components/BottomNav.test.tsx src/components/AppMain.tsx src/app/dev/bottom-nav/page.tsx
```

Expected: files are formatted.

- [ ] **Step 2: Run Prettier check**

```bash
rtk bunx prettier --check src/components/CompactBottomNavPreview.tsx src/components/CompactBottomNavPreview.test.tsx src/components/BottomNav.tsx src/components/BottomNav.test.tsx src/components/AppMain.tsx src/app/dev/bottom-nav/page.tsx
```

Expected: PASS.

- [ ] **Step 3: Run ESLint for modified TypeScript files**

```bash
rtk bunx eslint src/components/CompactBottomNavPreview.tsx src/components/CompactBottomNavPreview.test.tsx src/components/BottomNav.tsx src/components/BottomNav.test.tsx src/components/AppMain.tsx src/app/dev/bottom-nav/page.tsx
```

Expected: PASS.

- [ ] **Step 4: Run targeted tests**

```bash
rtk bun run test src/components/CompactBottomNavPreview.test.tsx src/components/BottomNav.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Browser-check collapsed and expanded states**

Start the app if it is not already running:

```bash
rtk bun run dev
```

In a second command:

```bash
rtk agent-browser set viewport 390 844 3
rtk agent-browser open http://localhost:3000/dev/bottom-nav
rtk agent-browser wait --load networkidle
rtk agent-browser snapshot -i
```

Expected collapsed snapshot includes:

```text
button/link "Home"
button/link "Budgets"
button "Expand navigation" [expanded=false]
button "Add expense"
```

Click expand and capture the result:

```bash
rtk agent-browser click "button[aria-label='Expand navigation']"
rtk agent-browser snapshot -i
rtk agent-browser screenshot /tmp/compact-bottom-nav-expanded.png
```

Expected expanded snapshot includes:

```text
link "Reports"
link "Settings"
button "Collapse navigation" [expanded=true]
button "Add expense"
```

Expected visual result: the left dock grows upward, the bottom edge remains anchored, and the detached add button remains aligned to the dock bottom.

- [ ] **Step 6: Commit final formatting fixes if any command changed files**

```bash
rtk git status --short
rtk git add src/components/CompactBottomNavPreview.tsx src/components/CompactBottomNavPreview.test.tsx src/components/BottomNav.tsx src/components/BottomNav.test.tsx src/components/AppMain.tsx src/app/dev/bottom-nav/page.tsx
rtk git commit -m "chore(nav): format compact nav preview"
```

Only create this commit if `git status --short` shows formatting or lint-fix changes after the earlier commits.

---

## Self-Review

- Spec coverage:
  - New test-page component: Task 2 and Task 3.
  - Left group with Home, Budgets, expand: Task 2.
  - Expanded Reports and Settings inside taller dock: Task 2.
  - Detached add expense trigger using `QuickExpenseDrawer`: Task 2.
  - Production `BottomNav.tsx` remains active on normal routes: Task 4 only hides `/dev/bottom-nav`.
  - iPhone 13/14 review: Task 5 browser verification uses `390x844`.
  - Accessibility: Task 1 tests `aria-expanded`; Task 2 uses labels, `aria-controls`, and 52px controls.
  - Targeted checks: Task 5.
- Plan hygiene scan: no unresolved markers, vague test requests, or unspecified code steps.
- Type consistency: `CompactBottomNavPreview` is the component name in tests, route, and implementation.
