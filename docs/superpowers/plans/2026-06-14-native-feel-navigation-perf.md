# Native-Feel Navigation Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make tab navigation feel instant and native — eliminate the 1-2s blank gap, show instant skeletons + a smooth transition, and stream dynamic-route data instead of blocking on it.

**Architecture:** Restore Next.js App Router route prefetch by converting the bottom-nav `<button onClick={router.push}>` to `<Link prefetch>`; give every slow route an instant skeleton fallback via per-route `loading.tsx`; animate route content with a dedicated CSS keyframe keyed on `usePathname()`; and convert the two dynamic report routes from blocking `await prefetchQuery` to non-blocking `void prefetchQuery` consumed by `useQuery` with `keepPreviousData` so they stream under their skeleton.

**Tech Stack:** Next.js 15.5 (App Router), React 19, TanStack Query v5, Tailwind v4 + `tw-animate-css`, shadcn/ui, Vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-06-14-native-feel-navigation-perf-design.md` (Tier 1 + Tier 2 scope).

---

## File Structure

**Create:**
- `src/components/ui/skeleton.tsx` — shadcn `Skeleton` primitive (does not exist yet).
- `src/components/RouteTransition.tsx` — client wrapper that animates page content on route change.
- `src/components/MonthlyReportSkeleton.tsx` — skeleton matching the monthly report layout (reused by `loading.tsx` + the content's no-data state).
- `src/components/DailyReportSkeleton.tsx` — skeleton matching the daily report layout.
- `src/components/BudgetsSkeleton.tsx` — skeleton matching the budgets layout.
- `src/app/budgets/loading.tsx`, `src/app/report/loading.tsx`, `src/app/report/day/[date]/loading.tsx` — per-route Suspense fallbacks.
- Test files alongside each.

**Modify:**
- `src/components/BottomNav.tsx` — `<button>` nav items → `<Link prefetch>`; drop `router.push`.
- `src/app/layout.tsx` — wrap `{children}` in `<RouteTransition>`.
- `src/app/globals.css` — add `route-transition` keyframe + reduced-motion rule.
- `src/app/report/page.tsx`, `src/app/report/day/[date]/page.tsx` — `await prefetchQuery` → `void prefetchQuery`.
- `src/components/MonthlyReportContent.tsx`, `src/components/DailyReportContent.tsx` — `keepPreviousData` + render skeleton instead of `return null`.

**Leave untouched:** `src/app/loading.tsx` (intentionally `null`, enforced by `src/app/loading.test.tsx`); `src/lib/get-query-client.ts` (already correct singleton + `staleTime` + pending dehydration).

**Tooling per `CLAUDE.md` after editing any `.ts`/`.tsx`:** `rtk bunx prettier --write <files>` → `rtk bunx prettier --check <files>` → `rtk bunx eslint <files>`. Use `bunx vitest run <pattern>` for tests. Do **not** run `npm run build` per-change.

---

## Task 1: BottomNav uses `<Link prefetch>` instead of `router.push`

**Files:**
- Modify: `src/components/BottomNav.tsx`
- Test: `src/components/BottomNav.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/BottomNav.test.tsx`:

```tsx
import React from "react";

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/hooks/useAppHaptics", () => ({
  useAppHaptics: () => ({ impact: vi.fn(), selection: vi.fn() }),
}));

vi.mock("@/stores/ai-quick-entry-store", () => ({
  useAIQuickEntryStore: (selector: (state: unknown) => unknown) =>
    selector({ open: false, entries: [], setOpen: vi.fn() }),
}));

vi.mock("@/components/QuickExpenseDrawer", () => ({
  default: () => <div data-testid="quick-expense-drawer" />,
}));

import BottomNav from "./BottomNav";

afterEach(() => {
  vi.clearAllMocks();
});

describe("BottomNav", () => {
  it("renders the primary tabs as links with hrefs (enables route prefetch)", () => {
    render(<BottomNav />);

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/"
    );
    expect(screen.getByRole("link", { name: "Budget" })).toHaveAttribute(
      "href",
      "/budgets"
    );
  });

  it("does not call useRouter (no router.push navigation)", () => {
    const source = require("node:fs").readFileSync(
      require("node:path").join(process.cwd(), "src/components/BottomNav.tsx"),
      "utf8"
    );
    expect(source).not.toContain("useRouter");
    expect(source).not.toContain("router.push");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/components/BottomNav.test.tsx`
Expected: FAIL — items render as `button`, not `link`; source still contains `useRouter`.

- [ ] **Step 3: Implement — convert nav buttons to Links**

In `src/components/BottomNav.tsx`:

Change the import on line 5 from:

```tsx
import { usePathname, useRouter } from "next/navigation";
```

to:

```tsx
import Link from "next/link";
import { usePathname } from "next/navigation";
```

Remove `const router = useRouter();` (line 86) and simplify `handleNavigate` (lines 133-137) to drop the push:

```tsx
const handleNavigate = (item: TBottomNavItem) => {
  setActiveItem(item.id);
  setExpanded(false);
};
```

Replace the expanded `menuItems` `<button>` (lines 173-190) with:

```tsx
<Link
  key={item.id}
  href={item.href}
  prefetch
  aria-label={item.label}
  aria-current={active ? "page" : undefined}
  onClick={() => handleNavigate(item)}
  className="group text-foreground focus-visible:ring-ring/40 grid h-11 w-full grid-cols-[32px_minmax(0,1fr)] items-center rounded-full text-left text-[17px] font-semibold transition-opacity duration-200 ease-out focus-visible:ring-2 focus-visible:outline-none"
>
  <span
    className={cn(
      "col-span-2 grid h-11 grid-cols-[32px_minmax(0,1fr)] items-center rounded-full px-4 transition-[transform,background-color,box-shadow] duration-200 ease-out group-hover:bg-white/10",
      active && "bg-white/8"
    )}
  >
    <Icon className="size-5" />
    <span className="truncate">{item.label}</span>
  </span>
</Link>
```

Replace the collapsed `primaryItems` `<button>` (lines 201-222) with:

```tsx
<Link
  key={item.id}
  href={item.href}
  prefetch
  aria-label={item.label}
  aria-current={active ? "page" : undefined}
  onClick={() => handleNavigate(item)}
  className={cn(baseButtonClassName, "hover:[&>span]:bg-white/15")}
>
  <span
    className={cn(
      baseIconGroupClassName,
      "h-12 w-16",
      active && "bg-white/10"
    )}
  >
    <Icon className="size-6" />
  </span>
  <span className="sr-only">{item.label}</span>
</Link>
```

Leave the "Expand navigation" button (lines 226-250) and the AI/QuickExpense buttons (lines 254-283) as `<button>` — they do not navigate.

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx vitest run src/components/BottomNav.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 5: Format, lint**

Run:
```bash
rtk bunx prettier --write src/components/BottomNav.tsx src/components/BottomNav.test.tsx
rtk bunx prettier --check src/components/BottomNav.tsx src/components/BottomNav.test.tsx
rtk bunx eslint src/components/BottomNav.tsx src/components/BottomNav.test.tsx
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/BottomNav.tsx src/components/BottomNav.test.tsx
git commit -m "perf: navigate via prefetched Link in bottom nav"
```

---

## Task 2: Skeleton primitive + budgets route loading fallback

**Files:**
- Create: `src/components/ui/skeleton.tsx`
- Create: `src/components/BudgetsSkeleton.tsx`
- Create: `src/app/budgets/loading.tsx`
- Test: `src/app/budgets/loading.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/app/budgets/loading.test.tsx`:

```tsx
import React from "react";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import Loading from "./loading";

describe("Budgets loading", () => {
  it("renders skeleton placeholders as an instant fallback", () => {
    const { container } = render(<Loading />);
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/app/budgets/loading.test.tsx`
Expected: FAIL — `./loading` module does not exist.

- [ ] **Step 3: Create the Skeleton primitive**

Create `src/components/ui/skeleton.tsx`:

```tsx
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted/60 animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
```

- [ ] **Step 4: Create the BudgetsSkeleton**

Create `src/components/BudgetsSkeleton.tsx` (mirrors the `max-w-md px-4` budgets container):

```tsx
import { Skeleton } from "@/components/ui/skeleton";

const BudgetsSkeleton = () => {
  return (
    <div className="relative mx-auto flex max-w-md flex-col gap-4 px-4 pt-6 sm:px-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
      <Skeleton className="h-24 w-full rounded-3xl" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
};

export default BudgetsSkeleton;
```

- [ ] **Step 5: Create the route loading file**

Create `src/app/budgets/loading.tsx`:

```tsx
import BudgetsSkeleton from "@/components/BudgetsSkeleton";

export default function Loading() {
  return <BudgetsSkeleton />;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bunx vitest run src/app/budgets/loading.test.tsx`
Expected: PASS.

- [ ] **Step 7: Format, lint**

Run:
```bash
rtk bunx prettier --write src/components/ui/skeleton.tsx src/components/BudgetsSkeleton.tsx src/app/budgets/loading.tsx src/app/budgets/loading.test.tsx
rtk bunx prettier --check src/components/ui/skeleton.tsx src/components/BudgetsSkeleton.tsx src/app/budgets/loading.tsx src/app/budgets/loading.test.tsx
rtk bunx eslint src/components/ui/skeleton.tsx src/components/BudgetsSkeleton.tsx src/app/budgets/loading.tsx src/app/budgets/loading.test.tsx
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui/skeleton.tsx src/components/BudgetsSkeleton.tsx src/app/budgets/loading.tsx src/app/budgets/loading.test.tsx
git commit -m "perf: add instant skeleton fallback for budgets route"
```

---

## Task 3: Route transition animation

**Files:**
- Create: `src/components/RouteTransition.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Test: `src/components/RouteTransition.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `src/components/RouteTransition.test.tsx`:

```tsx
import React from "react";

import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

vi.mock("next/navigation", () => ({
  usePathname: () => "/report",
}));

import RouteTransition from "./RouteTransition";

describe("RouteTransition", () => {
  it("wraps children in an animated container keyed by pathname", () => {
    render(
      <RouteTransition>
        <p>page content</p>
      </RouteTransition>
    );
    const child = screen.getByText("page content");
    expect(child.parentElement).toHaveClass("route-transition");
  });

  it("defines the keyframe and respects reduced motion", () => {
    const css = readFileSync(
      join(process.cwd(), "src/app/globals.css"),
      "utf8"
    );
    expect(css).toContain("@keyframes route-transition-enter");
    expect(css).toContain("prefers-reduced-motion: reduce");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bunx vitest run src/components/RouteTransition.test.tsx`
Expected: FAIL — `./RouteTransition` module does not exist.

- [ ] **Step 3: Create the RouteTransition component**

Create `src/components/RouteTransition.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";

import { usePathname } from "next/navigation";

const RouteTransition = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname();

  return (
    <div key={pathname} className="route-transition">
      {children}
    </div>
  );
};

export default RouteTransition;
```

- [ ] **Step 4: Add the keyframe to globals.css**

Append to `src/app/globals.css` (a dedicated name to avoid colliding with the existing `.animate-in` rule):

```css
@keyframes route-transition-enter {
  from {
    opacity: 0;
    transform: translateX(12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.route-transition {
  animation: route-transition-enter 220ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform, opacity;
}

@media (prefers-reduced-motion: reduce) {
  .route-transition {
    animation: none;
  }
}
```

- [ ] **Step 5: Wire into the layout**

In `src/app/layout.tsx`, add the import near the other component imports:

```tsx
import RouteTransition from "@/components/RouteTransition";
```

Change the body usage from:

```tsx
<AppMain>
  <PullToRefresh>{children}</PullToRefresh>
</AppMain>
```

to:

```tsx
<AppMain>
  <PullToRefresh>
    <RouteTransition>{children}</RouteTransition>
  </PullToRefresh>
</AppMain>
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bunx vitest run src/components/RouteTransition.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 7: Format, lint**

Run:
```bash
rtk bunx prettier --write src/components/RouteTransition.tsx src/components/RouteTransition.test.tsx src/app/layout.tsx src/app/globals.css
rtk bunx prettier --check src/components/RouteTransition.tsx src/components/RouteTransition.test.tsx src/app/layout.tsx src/app/globals.css
rtk bunx eslint src/components/RouteTransition.tsx src/components/RouteTransition.test.tsx src/app/layout.tsx
```
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/RouteTransition.tsx src/components/RouteTransition.test.tsx src/app/layout.tsx src/app/globals.css
git commit -m "feat: animate page content on route change"
```

---

## Task 4: Stream the monthly report (non-blocking + skeleton + keepPreviousData)

**Files:**
- Create: `src/components/MonthlyReportSkeleton.tsx`
- Create: `src/app/report/loading.tsx`
- Modify: `src/app/report/page.tsx`
- Modify: `src/components/MonthlyReportContent.tsx`
- Test: `src/app/report/loading.test.tsx` (create)
- Test: `src/components/MonthlyReportContent.test.tsx` (create)

- [ ] **Step 1: Write the failing tests**

Create `src/app/report/loading.test.tsx`:

```tsx
import React from "react";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import Loading from "./loading";

describe("Report loading", () => {
  it("renders skeleton placeholders as an instant fallback", () => {
    const { container } = render(<Loading />);
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0);
  });
});
```

Create `src/components/MonthlyReportContent.test.tsx`:

```tsx
import React from "react";

import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import MonthlyReportContent from "./MonthlyReportContent";

function renderWithClient(ui: React.ReactElement, client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}

describe("MonthlyReportContent", () => {
  it("shows a skeleton (not null) while there is no data yet", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { container } = renderWithClient(
      <MonthlyReportContent selectedMonth={undefined} />,
      client
    );
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0);
  });

  it("uses keepPreviousData on the monthly query", () => {
    const source = require("node:fs").readFileSync(
      require("node:path").join(
        process.cwd(),
        "src/components/MonthlyReportContent.tsx"
      ),
      "utf8"
    );
    expect(source).toContain("keepPreviousData");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run src/app/report/loading.test.tsx src/components/MonthlyReportContent.test.tsx`
Expected: FAIL — `./loading` missing; `MonthlyReportContent` returns `null` (no skeleton) and has no `keepPreviousData`.

- [ ] **Step 3: Create the MonthlyReportSkeleton**

Create `src/components/MonthlyReportSkeleton.tsx` (mirrors the `max-w-lg` report layout: header row, month tabs, two chart cards, payer card):

```tsx
import { Skeleton } from "@/components/ui/skeleton";

const MonthlyReportSkeleton = () => {
  return (
    <div className="relative mx-auto flex max-w-lg flex-col items-stretch gap-3 px-4 pt-6 sm:px-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-6 w-24" />
      </div>
      <Skeleton className="h-9 w-full rounded-full" />
      <Skeleton className="h-56 w-full rounded-3xl" />
      <Skeleton className="h-40 w-full rounded-3xl" />
    </div>
  );
};

export default MonthlyReportSkeleton;
```

- [ ] **Step 4: Create the route loading file**

Create `src/app/report/loading.tsx`:

```tsx
import MonthlyReportSkeleton from "@/components/MonthlyReportSkeleton";

export default function Loading() {
  return <MonthlyReportSkeleton />;
}
```

- [ ] **Step 5: Make the report page non-blocking**

In `src/app/report/page.tsx`, change the prefetch (lines 19-22) from `await` to `void` so the segment streams instead of blocking on the DB query:

```tsx
void queryClient.prefetchQuery({
  queryKey: queries.reports.monthly(selectedMonth).queryKey,
  queryFn: () => getMonthlyReport(selectedMonth),
});
```

(The component stays `async` for `await searchParams`. Everything else in the file is unchanged.)

- [ ] **Step 6: Add keepPreviousData + skeleton to MonthlyReportContent**

In `src/components/MonthlyReportContent.tsx`:

Change the query import (line 8) from:

```tsx
import { useQuery } from "@tanstack/react-query";
```

to:

```tsx
import { keepPreviousData, useQuery } from "@tanstack/react-query";
```

Add the skeleton import near the other component imports:

```tsx
import MonthlyReportSkeleton from "@/components/MonthlyReportSkeleton";
```

Change the query call (line 32) to:

```tsx
const { data: report } = useQuery({
  ...queries.reports.monthly(selectedMonth),
  placeholderData: keepPreviousData,
});
```

Change the no-data branch (lines 34-36) from:

```tsx
if (!report) {
  return null;
}
```

to:

```tsx
if (!report) {
  return <MonthlyReportSkeleton />;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `bunx vitest run src/app/report/loading.test.tsx src/components/MonthlyReportContent.test.tsx`
Expected: PASS.

- [ ] **Step 8: Format, lint**

Run:
```bash
rtk bunx prettier --write src/components/MonthlyReportSkeleton.tsx src/app/report/loading.tsx src/app/report/loading.test.tsx src/app/report/page.tsx src/components/MonthlyReportContent.tsx src/components/MonthlyReportContent.test.tsx
rtk bunx prettier --check src/components/MonthlyReportSkeleton.tsx src/app/report/loading.tsx src/app/report/loading.test.tsx src/app/report/page.tsx src/components/MonthlyReportContent.tsx src/components/MonthlyReportContent.test.tsx
rtk bunx eslint src/components/MonthlyReportSkeleton.tsx src/app/report/loading.tsx src/app/report/loading.test.tsx src/app/report/page.tsx src/components/MonthlyReportContent.tsx src/components/MonthlyReportContent.test.tsx
```
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/MonthlyReportSkeleton.tsx src/app/report/loading.tsx src/app/report/loading.test.tsx src/app/report/page.tsx src/components/MonthlyReportContent.tsx src/components/MonthlyReportContent.test.tsx
git commit -m "perf: stream monthly report under skeleton, keep previous data on month switch"
```

---

## Task 5: Stream the daily report (non-blocking + skeleton + keepPreviousData)

**Files:**
- Create: `src/components/DailyReportSkeleton.tsx`
- Create: `src/app/report/day/[date]/loading.tsx`
- Modify: `src/app/report/day/[date]/page.tsx`
- Modify: `src/components/DailyReportContent.tsx`
- Test: `src/app/report/day/[date]/loading.test.tsx` (create)
- Test: `src/components/DailyReportContent.test.tsx` (create)

- [ ] **Step 1: Write the failing tests**

Create `src/app/report/day/[date]/loading.test.tsx`:

```tsx
import React from "react";

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import Loading from "./loading";

describe("Daily report loading", () => {
  it("renders skeleton placeholders as an instant fallback", () => {
    const { container } = render(<Loading />);
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0);
  });
});
```

Create `src/components/DailyReportContent.test.tsx`:

```tsx
import React from "react";

import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

import DailyReportContent from "./DailyReportContent";

function renderWithClient(ui: React.ReactElement, client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
}

describe("DailyReportContent", () => {
  it("shows a skeleton (not null) while there is no data yet", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { container } = renderWithClient(
      <DailyReportContent date="2026-06-14" />,
      client
    );
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0);
  });

  it("uses keepPreviousData on the daily query", () => {
    const source = require("node:fs").readFileSync(
      require("node:path").join(
        process.cwd(),
        "src/components/DailyReportContent.tsx"
      ),
      "utf8"
    );
    expect(source).toContain("keepPreviousData");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bunx vitest run "src/app/report/day/[date]/loading.test.tsx" src/components/DailyReportContent.test.tsx`
Expected: FAIL — `./loading` missing; `DailyReportContent` returns `null` and has no `keepPreviousData`.

- [ ] **Step 3: Create the DailyReportSkeleton**

Create `src/components/DailyReportSkeleton.tsx` (mirrors the daily layout: header, summary card, chart card, transactions card):

```tsx
import { Skeleton } from "@/components/ui/skeleton";

const DailyReportSkeleton = () => {
  return (
    <div className="relative mx-auto flex max-w-lg flex-col gap-4 px-4 pt-6 pb-6 sm:px-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <Skeleton className="h-64 w-full rounded-3xl" />
      <Skeleton className="h-56 w-full rounded-3xl" />
      <Skeleton className="h-40 w-full rounded-3xl" />
    </div>
  );
};

export default DailyReportSkeleton;
```

- [ ] **Step 4: Create the route loading file**

Create `src/app/report/day/[date]/loading.tsx`:

```tsx
import DailyReportSkeleton from "@/components/DailyReportSkeleton";

export default function Loading() {
  return <DailyReportSkeleton />;
}
```

- [ ] **Step 5: Make the daily report page non-blocking**

In `src/app/report/day/[date]/page.tsx`, change the prefetch (lines 20-23) from `await` to `void`:

```tsx
void queryClient.prefetchQuery({
  queryKey: queries.reports.daily(date).queryKey,
  queryFn: () => getDailyReport(date),
});
```

(The component stays `async` for `await params`. Everything else unchanged.)

- [ ] **Step 6: Add keepPreviousData + skeleton to DailyReportContent**

In `src/components/DailyReportContent.tsx`:

Change the query import (line 10) from:

```tsx
import { useQuery } from "@tanstack/react-query";
```

to:

```tsx
import { keepPreviousData, useQuery } from "@tanstack/react-query";
```

Add the skeleton import near the other component imports:

```tsx
import DailyReportSkeleton from "@/components/DailyReportSkeleton";
```

Change the query call (line 32) to:

```tsx
const { data: report } = useQuery({
  ...queries.reports.daily(date),
  placeholderData: keepPreviousData,
});
```

Change the no-data branch (lines 44-46) from:

```tsx
if (!report) {
  return null;
}
```

to:

```tsx
if (!report) {
  return <DailyReportSkeleton />;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `bunx vitest run "src/app/report/day/[date]/loading.test.tsx" src/components/DailyReportContent.test.tsx`
Expected: PASS.

- [ ] **Step 8: Format, lint**

Run:
```bash
rtk bunx prettier --write src/components/DailyReportSkeleton.tsx "src/app/report/day/[date]/loading.tsx" "src/app/report/day/[date]/loading.test.tsx" "src/app/report/day/[date]/page.tsx" src/components/DailyReportContent.tsx src/components/DailyReportContent.test.tsx
rtk bunx prettier --check src/components/DailyReportSkeleton.tsx "src/app/report/day/[date]/loading.tsx" "src/app/report/day/[date]/loading.test.tsx" "src/app/report/day/[date]/page.tsx" src/components/DailyReportContent.tsx src/components/DailyReportContent.test.tsx
rtk bunx eslint src/components/DailyReportSkeleton.tsx "src/app/report/day/[date]/loading.tsx" "src/app/report/day/[date]/loading.test.tsx" "src/app/report/day/[date]/page.tsx" src/components/DailyReportContent.tsx src/components/DailyReportContent.test.tsx
```
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/DailyReportSkeleton.tsx "src/app/report/day/[date]/loading.tsx" "src/app/report/day/[date]/loading.test.tsx" "src/app/report/day/[date]/page.tsx" src/components/DailyReportContent.tsx src/components/DailyReportContent.test.tsx
git commit -m "perf: stream daily report under skeleton, keep previous data on date switch"
```

---

## Task 6: Verify the whole suite + measure

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `bunx vitest run`
Expected: all tests PASS, including the pre-existing `src/app/loading.test.tsx` (root loading still returns null — untouched).

- [ ] **Step 2: Production build (required before pushing per CLAUDE.md)**

Run: `npm run build`
Expected: build succeeds; no type errors.

- [ ] **Step 3: Manual trace against the success criteria**

Start a production server (`npm run start`) or use a preview deploy. In Chrome DevTools, emulate iPhone 13 viewport + Slow 4G + 4× CPU. Record a Home → Budget navigation and confirm:
- A visible response (skeleton/transition) appears in < 150 ms (was ~1-2 s).
- The budgets JS chunks + RSC are served from the prefetch cache, not downloaded after the tap.
- Switching report month/day shows the previous data (no blank flash).
- Home cold LCP ≤ 2.0 s and CLS 0 (no regression).

- [ ] **Step 4: Finish the branch**

Use superpowers:finishing-a-development-branch to decide merge / PR. Branch name must start with `dev-` (per `CLAUDE.md`). Do not push until `npm run build` passes.

---

## Notes & Risks (from the spec)

- **Tier 3 is out of scope** here: Serwist runtime caching (`cacheOnNavigation`, SWR/NetworkFirst), `dynamic()` bundle splitting of `AIQuickEntry`/charts/drawers, View Transitions API, and resolving the dead `instant-shell-script.ts` / `InstantAppShell.tsx`. These are documented follow-ups.
- **`useQuery` + `keepPreviousData`, not `useSuspenseQuery`,** is deliberate for the report routes: TanStack Query v5 `useSuspenseQuery` ignores `placeholderData`, so suspense would re-blank on every month/day switch. Home keeps `useSuspenseQuery` because it is not param-keyed.
- **Mutation/invalidation safety:** none of these tasks change mutations, but the report surfaces consume invalidated queries. If anything touches optimistic mutations or background submits, re-read `LEARNINGS.md` first (per `CLAUDE.md`).
- **RouteTransition remounts the page subtree on path change** (the `key={pathname}` trick for an enter animation). This is intended; TanStack Query's cache (`staleTime: 60s`) prevents a refetch on remount, so it does not reintroduce data lag.
```
