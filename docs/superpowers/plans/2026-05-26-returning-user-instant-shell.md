# Returning User Instant Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make returning visits show a dark Spendly-shaped shell immediately while preserving the current `/` server prefetch, TanStack Query hydration, IndexedDB Expense sync, and service-worker correctness boundaries.

**Architecture:** Add an inert root-level shell that paints before the provider-heavy app subtree is ready. Store only presentation-safe shell hints, currently last-known formatted total text, in `localStorage`; do not persist or infer theme because the project is dark-mode only. Keep `/` server-prefetch behavior unchanged, make the route loading fallback CSS-only, reduce first-screen blur-filter motion, and defer only root work that is not required for first paint or sync bootstrap.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind v4 global CSS, TanStack Query, Zustand, Serwist, Vitest, Testing Library.

---

## File Structure

- Create `src/lib/instant-shell/snapshot.ts` for storage key, parser, serializer, and safe browser read/write helpers. It must not store theme.
- Create `src/lib/instant-shell/snapshot.test.ts` for parser and browser storage behavior.
- Create `src/app/instant-shell-script.ts` for the tiny inline pre-hydration script string.
- Create `src/app/instant-shell-script.test.ts` for script behavior in jsdom.
- Create `src/components/InstantAppShell.tsx` for server-rendered inert shell markup.
- Create `src/components/InstantAppShell.test.tsx` for inert/accessibility checks.
- Create `src/components/InstantShellBridge.tsx` for marking the document hydrated after React mounts.
- Create `src/components/InstantShellBridge.test.tsx` for hydration attribute behavior.
- Create `src/components/DeferredRecoveryWork.tsx` for idle-loading recovery-only root work.
- Modify `src/app/layout.tsx` to mount the script, inert shell, shell bridge, and deferred recovery host while keeping `ExpenseSyncCoordinator` eager.
- Modify `src/app/loading.tsx` to remove client-only Motion code and render a CSS-only shell fallback.
- Modify `src/app/globals.css` to style the inert shell and hide it after hydration.
- Modify `src/components/SpendingDashboardHeaderClient.tsx` to persist last-known formatted total text and remove startup blur filters.
- Modify `src/components/SpendingDashboardHeaderClient.test.tsx` to verify shell snapshot writes.
- Modify `src/components/ExpenseList.tsx` to remove startup blur-filter motion.
- Create `src/components/startup-motion.test.ts` for a focused source-level guard against reintroducing first-screen blur filters.

Do not modify `src/app/page.tsx`, `src/lib/queries/expenses.ts`, `src/components/ExpenseSyncCoordinator.tsx`, or `src/app/sw.ts` except for tests if an existing test needs a harmless update. The current server-prefetch, IndexedDB-only browser read, sync bootstrap, and `NetworkOnly` service-worker boundaries are intentionally preserved.

## Task 1: Add Shell Snapshot Storage

**Files:**
- Create: `src/lib/instant-shell/snapshot.ts`
- Create: `src/lib/instant-shell/snapshot.test.ts`

- [ ] **Step 1: Write failing snapshot tests**

Create `src/lib/instant-shell/snapshot.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";

import {
  INSTANT_SHELL_SNAPSHOT_KEY,
  parseInstantShellSnapshot,
  readInstantShellSnapshot,
  writeInstantShellSnapshot,
} from "./snapshot";

describe("instant shell snapshot", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("accepts a valid display-only snapshot", () => {
    expect(
      parseInstantShellSnapshot({
        totalText: "1.250.000",
        updatedAt: 1779786000000,
      })
    ).toEqual({
      totalText: "1.250.000",
      updatedAt: 1779786000000,
    });
  });

  it("rejects theme persistence", () => {
    expect(
      parseInstantShellSnapshot({
        theme: "light",
        totalText: "1.250.000",
        updatedAt: 1779786000000,
      })
    ).toBeNull();
  });

  it("rejects invalid shapes", () => {
    expect(parseInstantShellSnapshot(null)).toBeNull();
    expect(parseInstantShellSnapshot({ totalText: 1250000 })).toBeNull();
    expect(parseInstantShellSnapshot({ totalText: "1", updatedAt: "now" })).toBeNull();
  });

  it("reads and writes the browser snapshot safely", () => {
    writeInstantShellSnapshot({ totalText: "900.000", updatedAt: 1779786000000 });

    expect(localStorage.getItem(INSTANT_SHELL_SNAPSHOT_KEY)).toBe(
      JSON.stringify({ totalText: "900.000", updatedAt: 1779786000000 })
    );
    expect(readInstantShellSnapshot()).toEqual({
      totalText: "900.000",
      updatedAt: 1779786000000,
    });
  });

  it("returns null for corrupt storage", () => {
    localStorage.setItem(INSTANT_SHELL_SNAPSHOT_KEY, "{not-json");

    expect(readInstantShellSnapshot()).toBeNull();
  });
});
```

Run:

```bash
rtk bunx vitest run src/lib/instant-shell/snapshot.test.ts
```

Expected: FAIL because `src/lib/instant-shell/snapshot.ts` does not exist.

- [ ] **Step 2: Implement the snapshot helper**

Create `src/lib/instant-shell/snapshot.ts`:

```ts
export const INSTANT_SHELL_SNAPSHOT_KEY = "spendly:instant-shell:v1";

export type InstantShellSnapshot = {
  totalText: string | null;
  updatedAt: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseInstantShellSnapshot = (
  value: unknown
): InstantShellSnapshot | null => {
  if (!isRecord(value)) {
    return null;
  }

  if ("theme" in value) {
    return null;
  }

  if (
    value.totalText !== null &&
    typeof value.totalText !== "string"
  ) {
    return null;
  }

  if (typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt)) {
    return null;
  }

  return {
    totalText: value.totalText,
    updatedAt: value.updatedAt,
  };
};

export const readInstantShellSnapshot = (): InstantShellSnapshot | null => {
  if (typeof localStorage === "undefined") {
    return null;
  }

  try {
    return parseInstantShellSnapshot(
      JSON.parse(localStorage.getItem(INSTANT_SHELL_SNAPSHOT_KEY) ?? "null")
    );
  } catch {
    return null;
  }
};

export const writeInstantShellSnapshot = (
  snapshot: InstantShellSnapshot
): void => {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    localStorage.setItem(
      INSTANT_SHELL_SNAPSHOT_KEY,
      JSON.stringify(snapshot)
    );
  } catch {
    // Storage can be blocked. The shell hint is optional.
  }
};
```

- [ ] **Step 3: Verify Task 1**

Run:

```bash
rtk bunx vitest run src/lib/instant-shell/snapshot.test.ts
rtk bunx prettier --write src/lib/instant-shell/snapshot.ts src/lib/instant-shell/snapshot.test.ts
rtk bunx prettier --check src/lib/instant-shell/snapshot.ts src/lib/instant-shell/snapshot.test.ts
rtk bunx eslint src/lib/instant-shell/snapshot.ts src/lib/instant-shell/snapshot.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit Task 1**

```bash
rtk git add src/lib/instant-shell/snapshot.ts src/lib/instant-shell/snapshot.test.ts
rtk git commit -m "feat: add instant shell snapshot helper"
```

## Task 2: Add Pre-Hydration Script And Inert Shell

**Files:**
- Create: `src/app/instant-shell-script.ts`
- Create: `src/app/instant-shell-script.test.ts`
- Create: `src/components/InstantAppShell.tsx`
- Create: `src/components/InstantAppShell.test.tsx`
- Create: `src/components/InstantShellBridge.tsx`
- Create: `src/components/InstantShellBridge.test.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Write failing script tests**

Create `src/app/instant-shell-script.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";

import { INSTANT_SHELL_SNAPSHOT_KEY } from "@/lib/instant-shell/snapshot";
import { instantShellScript } from "./instant-shell-script";

const runScript = () => {
  Function(instantShellScript)();
};

describe("instantShellScript", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-instant-shell-ready");
    document.documentElement.style.removeProperty("--instant-shell-total");
  });

  it("marks the shell ready without stored hints", () => {
    runScript();

    expect(document.documentElement).toHaveAttribute(
      "data-instant-shell-ready",
      "true"
    );
    expect(
      document.documentElement.style.getPropertyValue("--instant-shell-total")
    ).toBe("");
  });

  it("applies a stored formatted total as a CSS custom property", () => {
    localStorage.setItem(
      INSTANT_SHELL_SNAPSHOT_KEY,
      JSON.stringify({ totalText: "1.250.000", updatedAt: 1779786000000 })
    );

    runScript();

    expect(
      document.documentElement.style.getPropertyValue("--instant-shell-total")
    ).toBe('"1.250.000"');
  });

  it("ignores snapshots that try to persist theme", () => {
    localStorage.setItem(
      INSTANT_SHELL_SNAPSHOT_KEY,
      JSON.stringify({
        theme: "light",
        totalText: "1.250.000",
        updatedAt: 1779786000000,
      })
    );

    runScript();

    expect(
      document.documentElement.style.getPropertyValue("--instant-shell-total")
    ).toBe("");
  });
});
```

Run:

```bash
rtk bunx vitest run src/app/instant-shell-script.test.ts
```

Expected: FAIL because `src/app/instant-shell-script.ts` does not exist.

- [ ] **Step 2: Implement the script string**

Create `src/app/instant-shell-script.ts`:

```ts
import { INSTANT_SHELL_SNAPSHOT_KEY } from "@/lib/instant-shell/snapshot";

const escapeCssString = `
const escapeCssString = (value) =>
  value.replace(/\\\\/g, "\\\\\\\\").replace(/"/g, "\\\\\"");
`;

export const instantShellScript = `
(() => {
  try {
    ${escapeCssString}
    const root = document.documentElement;
    const raw = localStorage.getItem("${INSTANT_SHELL_SNAPSHOT_KEY}");
    const snapshot = raw ? JSON.parse(raw) : null;
    root.dataset.instantShellReady = "true";
    if (
      snapshot &&
      typeof snapshot === "object" &&
      !Array.isArray(snapshot) &&
      !("theme" in snapshot) &&
      typeof snapshot.totalText === "string" &&
      typeof snapshot.updatedAt === "number"
    ) {
      root.style.setProperty(
        "--instant-shell-total",
        '"' + escapeCssString(snapshot.totalText) + '"'
      );
    }
  } catch {
    document.documentElement.dataset.instantShellReady = "true";
  }
})();
`;
```

- [ ] **Step 3: Write failing inert shell component tests**

Create `src/components/InstantAppShell.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import InstantAppShell from "./InstantAppShell";

describe("InstantAppShell", () => {
  it("renders an inert Spendly shell", () => {
    render(<InstantAppShell />);

    const shell = screen.getByTestId("instant-app-shell");
    expect(shell).toHaveAttribute("aria-hidden", "true");
    expect(shell.querySelector("a,button,input,select,textarea")).toBeNull();
    expect(screen.getByTestId("instant-shell-total")).toBeInTheDocument();
    expect(screen.getAllByTestId("instant-shell-row")).toHaveLength(3);
  });
});
```

Run:

```bash
rtk bunx vitest run src/components/InstantAppShell.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 4: Implement the inert shell component**

Create `src/components/InstantAppShell.tsx`:

```tsx
export default function InstantAppShell() {
  return (
    <div
      id="instant-app-shell"
      data-testid="instant-app-shell"
      aria-hidden="true"
    >
      <div className="instant-app-shell__header">
        <div
          data-testid="instant-shell-total"
          className="instant-app-shell__total"
        />
        <div className="instant-app-shell__chips">
          <span />
          <span />
        </div>
      </div>
      <div className="instant-app-shell__heatmap" />
      <div className="instant-app-shell__rows">
        <span data-testid="instant-shell-row" />
        <span data-testid="instant-shell-row" />
        <span data-testid="instant-shell-row" />
      </div>
      <div className="instant-app-shell__bottom" />
    </div>
  );
}
```

- [ ] **Step 5: Write failing bridge tests**

Create `src/components/InstantShellBridge.test.tsx`:

```tsx
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import InstantShellBridge from "./InstantShellBridge";

describe("InstantShellBridge", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-instant-shell-hydrated");
  });

  it("marks the instant shell hydrated after mount", async () => {
    render(<InstantShellBridge />);

    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute(
        "data-instant-shell-hydrated",
        "true"
      )
    );
  });
});
```

Run:

```bash
rtk bunx vitest run src/components/InstantShellBridge.test.tsx
```

Expected: FAIL because the bridge does not exist.

- [ ] **Step 6: Implement the shell bridge**

Create `src/components/InstantShellBridge.tsx`:

```tsx
"use client";

import { useEffect } from "react";

export default function InstantShellBridge() {
  useEffect(() => {
    document.documentElement.dataset.instantShellHydrated = "true";
  }, []);

  return null;
}
```

- [ ] **Step 7: Add shell CSS**

Append to `src/app/globals.css`:

```css
#instant-app-shell {
  position: fixed;
  inset: 0;
  z-index: 0;
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: 18px;
  max-width: 28rem;
  margin-inline: auto;
  padding: calc(env(safe-area-inset-top) + 24px) 16px
    calc(env(safe-area-inset-bottom) + 24px);
  color: var(--foreground);
  background: var(--background);
  pointer-events: none;
}

html[data-instant-shell-hydrated="true"] #instant-app-shell {
  display: none;
}

.instant-app-shell__header {
  display: grid;
  gap: 14px;
}

.instant-app-shell__total {
  height: 4.75rem;
  font: 700 4.25rem/1 var(--font-geist-mono);
  letter-spacing: 0;
}

.instant-app-shell__total::before {
  content: var(--instant-shell-total, "0");
}

.instant-app-shell__chips {
  display: flex;
  gap: 8px;
}

.instant-app-shell__chips span {
  width: 72px;
  height: 32px;
  border-radius: 999px;
  background: var(--surface-3);
}

.instant-app-shell__heatmap,
.instant-app-shell__rows span {
  border: 1px solid var(--border);
  background: var(--surface-2);
  box-shadow: var(--shadow-sm);
}

.instant-app-shell__heatmap {
  height: 126px;
  border-radius: 28px;
}

.instant-app-shell__rows {
  display: grid;
  align-content: start;
  gap: 12px;
}

.instant-app-shell__rows span {
  height: 68px;
  border-radius: 18px;
}

.instant-app-shell__bottom {
  height: calc(72px + env(safe-area-inset-bottom));
}
```

- [ ] **Step 8: Verify Task 2**

Run:

```bash
rtk bunx vitest run src/app/instant-shell-script.test.ts src/components/InstantAppShell.test.tsx src/components/InstantShellBridge.test.tsx
rtk bunx prettier --write src/app/instant-shell-script.ts src/app/instant-shell-script.test.ts src/components/InstantAppShell.tsx src/components/InstantAppShell.test.tsx src/components/InstantShellBridge.tsx src/components/InstantShellBridge.test.tsx src/app/globals.css
rtk bunx prettier --check src/app/instant-shell-script.ts src/app/instant-shell-script.test.ts src/components/InstantAppShell.tsx src/components/InstantAppShell.test.tsx src/components/InstantShellBridge.tsx src/components/InstantShellBridge.test.tsx src/app/globals.css
rtk bunx eslint src/app/instant-shell-script.ts src/app/instant-shell-script.test.ts src/components/InstantAppShell.tsx src/components/InstantAppShell.test.tsx src/components/InstantShellBridge.tsx src/components/InstantShellBridge.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit Task 2**

```bash
rtk git add src/app/instant-shell-script.ts src/app/instant-shell-script.test.ts src/components/InstantAppShell.tsx src/components/InstantAppShell.test.tsx src/components/InstantShellBridge.tsx src/components/InstantShellBridge.test.tsx src/app/globals.css
rtk git commit -m "feat: add pre-hydration instant shell"
```

## Task 3: Mount The Shell Without Changing Home Prefetch

**Files:**
- Modify: `src/app/layout.tsx`
- Test: `src/app/page.test.tsx`

- [ ] **Step 1: Add a regression assertion for unchanged home prefetch**

Update `src/app/page.test.tsx` by extending the existing test after the current `expect(getExpenseListMock).toHaveBeenCalledWith({ limit: 30, offset: 0 });` assertion:

```tsx
expect(prefetchQueryMock.mock.calls[0]?.[0]).toEqual(
  expect.objectContaining({
    queryKey: expect.arrayContaining(["dashboard", "monthlySummary"]),
  })
);
expect(prefetchInfiniteQueryMock.mock.calls[0]?.[0]).toEqual(
  expect.objectContaining({
    queryKey: expect.arrayContaining(["expenses", "list"]),
    initialPageParam: 0,
  })
);
```

Run:

```bash
rtk bunx vitest run src/app/page.test.tsx
```

Expected: PASS before layout changes. This locks the "do not change `/` server prefetch" requirement.

- [ ] **Step 2: Mount the shell in root layout**

Modify `src/app/layout.tsx` imports:

```tsx
import Script from "next/script";

import { instantShellScript } from "@/app/instant-shell-script";
import InstantAppShell from "@/components/InstantAppShell";
import InstantShellBridge from "@/components/InstantShellBridge";
```

Render these immediately inside `<body>` before `<ReactQueryProvider>`:

```tsx
<Script
  id="spendly-instant-shell"
  strategy="beforeInteractive"
  dangerouslySetInnerHTML={{ __html: instantShellScript }}
/>
<InstantAppShell />
<InstantShellBridge />
```

Do not move `ExpenseSyncCoordinator` out of its eager position under `ReactQueryProvider`.

- [ ] **Step 3: Verify Task 3**

Run:

```bash
rtk bunx vitest run src/app/page.test.tsx src/components/InstantAppShell.test.tsx src/components/InstantShellBridge.test.tsx
rtk bunx prettier --write src/app/layout.tsx src/app/page.test.tsx
rtk bunx prettier --check src/app/layout.tsx src/app/page.test.tsx
rtk bunx eslint src/app/layout.tsx src/app/page.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit Task 3**

```bash
rtk git add src/app/layout.tsx src/app/page.test.tsx
rtk git commit -m "feat: mount instant shell in root layout"
```

## Task 4: Persist Last-Known Total Text From Live Dashboard Data

**Files:**
- Modify: `src/components/SpendingDashboardHeaderClient.tsx`
- Modify: `src/components/SpendingDashboardHeaderClient.test.tsx`

- [ ] **Step 1: Write a failing snapshot write test**

Add this import to `src/components/SpendingDashboardHeaderClient.test.tsx`:

```tsx
import { INSTANT_SHELL_SNAPSHOT_KEY } from "@/lib/instant-shell/snapshot";
```

Update the Vitest import:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
```

Add `beforeEach` near the existing setup:

```tsx
beforeEach(() => {
  localStorage.clear();
});
```

Add this test inside `describe("SpendingDashboardHeaderClient", () => { ... })`:

```tsx
it("persists the formatted total for the instant shell", () => {
  globalThis.React = React;

  render(
    <SpendingDashboardHeaderClient
      activeMonth="2026-03"
      payerOptions={["All"]}
      totalsByPayer={{
        All: { total: 1_250_000, totals: [1_250_000] },
      }}
    />
  );

  expect(JSON.parse(localStorage.getItem(INSTANT_SHELL_SNAPSHOT_KEY) ?? "{}")).toEqual(
    {
      totalText: "1.250.000",
      updatedAt: expect.any(Number),
    }
  );
});
```

Run:

```bash
rtk bunx vitest run src/components/SpendingDashboardHeaderClient.test.tsx -t "persists the formatted total"
```

Expected: FAIL because the component does not write the snapshot yet.

- [ ] **Step 2: Implement dashboard snapshot writing**

Modify `src/components/SpendingDashboardHeaderClient.tsx` imports:

```tsx
import { useEffect, useState } from "react";

import { writeInstantShellSnapshot } from "@/lib/instant-shell/snapshot";
```

Add after `const activeTotal = activeTotals?.total ?? 0;`:

```tsx
useEffect(() => {
  writeInstantShellSnapshot({
    totalText: formatVnd(activeTotal),
    updatedAt: Date.now(),
  });
}, [activeTotal]);
```

Keep this write display-only. Do not store theme, payer options, heatmap values, raw dashboard totals, or Expense rows.

- [ ] **Step 3: Verify Task 4**

Run:

```bash
rtk bunx vitest run src/components/SpendingDashboardHeaderClient.test.tsx src/lib/instant-shell/snapshot.test.ts
rtk bunx prettier --write src/components/SpendingDashboardHeaderClient.tsx src/components/SpendingDashboardHeaderClient.test.tsx
rtk bunx prettier --check src/components/SpendingDashboardHeaderClient.tsx src/components/SpendingDashboardHeaderClient.test.tsx
rtk bunx eslint src/components/SpendingDashboardHeaderClient.tsx src/components/SpendingDashboardHeaderClient.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit Task 4**

```bash
rtk git add src/components/SpendingDashboardHeaderClient.tsx src/components/SpendingDashboardHeaderClient.test.tsx
rtk git commit -m "feat: persist instant shell total hint"
```

## Task 5: Replace Client Motion Loading With CSS-Only Loading

**Files:**
- Modify: `src/app/loading.tsx`
- Create: `src/app/loading.test.tsx`

- [ ] **Step 1: Write failing loading tests**

Create `src/app/loading.test.tsx`:

```tsx
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Loading from "./loading";

describe("Loading", () => {
  it("renders the inert shell fallback", () => {
    render(<Loading />);

    expect(screen.getByTestId("instant-app-shell")).toBeInTheDocument();
  });

  it("does not import motion/react", () => {
    const source = readFileSync(join(process.cwd(), "src/app/loading.tsx"), "utf8");

    expect(source).not.toContain('"use client"');
    expect(source).not.toContain("motion/react");
  });
});
```

Run:

```bash
rtk bunx vitest run src/app/loading.test.tsx
```

Expected: FAIL because the current loading file is a client component and imports `motion/react`.

- [ ] **Step 2: Replace loading implementation**

Replace `src/app/loading.tsx` with:

```tsx
import InstantAppShell from "@/components/InstantAppShell";

export default function Loading() {
  return <InstantAppShell />;
}
```

- [ ] **Step 3: Verify Task 5**

Run:

```bash
rtk bunx vitest run src/app/loading.test.tsx src/components/InstantAppShell.test.tsx
rtk bunx prettier --write src/app/loading.tsx src/app/loading.test.tsx
rtk bunx prettier --check src/app/loading.tsx src/app/loading.test.tsx
rtk bunx eslint src/app/loading.tsx src/app/loading.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit Task 5**

```bash
rtk git add src/app/loading.tsx src/app/loading.test.tsx
rtk git commit -m "feat: make route loading shell css-only"
```

## Task 6: Remove First-Screen Blur-Filter Startup Motion

**Files:**
- Modify: `src/components/SpendingDashboardHeaderClient.tsx`
- Modify: `src/components/ExpenseList.tsx`
- Create: `src/components/startup-motion.test.ts`

- [ ] **Step 1: Write a failing startup motion guard**

Create `src/components/startup-motion.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const firstScreenFiles = [
  "src/components/SpendingDashboardHeaderClient.tsx",
  "src/components/ExpenseList.tsx",
];

describe("first-screen startup motion", () => {
  it("does not use blur filters in startup motion", () => {
    for (const file of firstScreenFiles) {
      const source = readFileSync(join(process.cwd(), file), "utf8");

      expect(source, file).not.toContain('filter: "blur');
      expect(source, file).not.toContain("filter: 'blur");
    }
  });
});
```

Run:

```bash
rtk bunx vitest run src/components/startup-motion.test.ts
```

Expected: FAIL because both first-screen files currently contain blur-filter startup motion.

- [ ] **Step 2: Replace dashboard blur entrance states**

In `src/components/SpendingDashboardHeaderClient.tsx`, replace:

```tsx
initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
transition={{ duration: 0.3, ease: "easeInOut" }}
```

with:

```tsx
initial={{ opacity: 0, y: 8 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.16, ease: "easeOut" }}
```

Replace both chip/link wrapper states:

```tsx
initial={{ opacity: 0, x: -10, filter: "blur(10px)" }}
animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
transition={{ duration: 0.3, ease: "easeInOut", delay: 0.2 }}
```

with:

```tsx
initial={{ opacity: 0, x: -8 }}
animate={{ opacity: 1, x: 0 }}
transition={{ duration: 0.16, ease: "easeOut", delay: 0.08 }}
```

For the AI link wrapper, use `delay: 0.1`.

Replace the heatmap container:

```tsx
initial={{ opacity: 0, filter: "blur(10px)" }}
animate={{ opacity: 1, filter: "blur(0px)" }}
transition={{ duration: 0.3, ease: "easeInOut", delay: 0.3 }}
```

with:

```tsx
initial={{ opacity: 0, y: 8 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.16, ease: "easeOut", delay: 0.12 }}
```

- [ ] **Step 3: Replace Expense list blur entrance state**

In `src/components/ExpenseList.tsx`, replace:

```tsx
initial={{ opacity: 0, filter: "blur(10px)" }}
animate={{ opacity: 1, filter: "blur(0px)" }}
transition={{ duration: 0.3, ease: "easeInOut", delay: 0.35 }}
```

with:

```tsx
initial={{ opacity: 0, y: 8 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.16, ease: "easeOut", delay: 0.14 }}
```

- [ ] **Step 4: Verify Task 6**

Run:

```bash
rtk bunx vitest run src/components/startup-motion.test.ts src/components/SpendingDashboardHeaderClient.test.tsx src/components/ExpenseList.test.tsx
rtk bunx prettier --write src/components/startup-motion.test.ts src/components/SpendingDashboardHeaderClient.tsx src/components/ExpenseList.tsx
rtk bunx prettier --check src/components/startup-motion.test.ts src/components/SpendingDashboardHeaderClient.tsx src/components/ExpenseList.tsx
rtk bunx eslint src/components/startup-motion.test.ts src/components/SpendingDashboardHeaderClient.tsx src/components/ExpenseList.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```bash
rtk git add src/components/startup-motion.test.ts src/components/SpendingDashboardHeaderClient.tsx src/components/ExpenseList.tsx
rtk git commit -m "perf: remove first-screen blur startup motion"
```

## Task 7: Defer Recovery-Only Root Work

**Files:**
- Create: `src/components/DeferredRecoveryWork.tsx`
- Modify: `src/app/layout.tsx`
- Test: `src/components/DeferredRecoveryWork.test.tsx`

- [ ] **Step 1: Write failing deferred work tests**

Create `src/components/DeferredRecoveryWork.test.tsx`:

```tsx
import React from "react";

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import DeferredRecoveryWork from "./DeferredRecoveryWork";

vi.mock("next/dynamic", () => ({
  default:
    (loader: () => Promise<{ default: React.ComponentType }>) =>
    function DynamicComponent() {
      const [Component, setComponent] =
        React.useState<React.ComponentType | null>(null);

      React.useEffect(() => {
        void loader().then((mod) => setComponent(() => mod.default));
      }, []);

      return Component ? <Component /> : null;
    },
}));

vi.mock("@/components/QuickExpenseMutationCoordinator", () => ({
  default: () => <div data-testid="quick-expense-mutation-coordinator" />,
}));

vi.mock("@/components/QuickExpenseRecoverySheetHost", () => ({
  default: () => <div data-testid="quick-expense-recovery-host" />,
}));

describe("DeferredRecoveryWork", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not render recovery work before the idle delay", () => {
    render(<DeferredRecoveryWork />);

    expect(
      screen.queryByTestId("quick-expense-mutation-coordinator")
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("quick-expense-recovery-host")).not.toBeInTheDocument();
  });

  it("renders recovery work after the idle delay", async () => {
    render(<DeferredRecoveryWork />);

    await vi.advanceTimersByTimeAsync(500);

    expect(
      screen.getByTestId("quick-expense-mutation-coordinator")
    ).toBeInTheDocument();
    expect(screen.getByTestId("quick-expense-recovery-host")).toBeInTheDocument();
  });
});
```

Run:

```bash
rtk bunx vitest run src/components/DeferredRecoveryWork.test.tsx
```

Expected: FAIL because the component does not exist.

- [ ] **Step 2: Implement deferred recovery work**

Create `src/components/DeferredRecoveryWork.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const QuickExpenseMutationCoordinator = dynamic(
  () => import("@/components/QuickExpenseMutationCoordinator"),
  { ssr: false }
);
const QuickExpenseRecoverySheetHost = dynamic(
  () => import("@/components/QuickExpenseRecoverySheetHost"),
  { ssr: false }
);

export default function DeferredRecoveryWork() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setReady(true), 500);

    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <>
      <QuickExpenseMutationCoordinator />
      <QuickExpenseRecoverySheetHost />
    </>
  );
}
```

Use `setTimeout` instead of `requestIdleCallback` for the first implementation because it is predictable in tests and still defers work beyond first paint. Do not move `ExpenseSyncCoordinator` into this component.

- [ ] **Step 3: Replace direct recovery mounts in layout**

Modify `src/app/layout.tsx` imports:

```tsx
import DeferredRecoveryWork from "@/components/DeferredRecoveryWork";
```

Remove imports for:

```tsx
import QuickExpenseMutationCoordinator from "@/components/QuickExpenseMutationCoordinator";
import QuickExpenseRecoverySheetHost from "@/components/QuickExpenseRecoverySheetHost";
```

Replace:

```tsx
<QuickExpenseMutationCoordinator />
<QuickExpenseRecoverySheetHost />
```

with:

```tsx
<DeferredRecoveryWork />
```

- [ ] **Step 4: Verify Task 7**

Run:

```bash
rtk bunx vitest run src/components/DeferredRecoveryWork.test.tsx src/components/QuickExpenseMutationCoordinator.test.tsx src/components/QuickExpenseRecoverySheetHost.test.tsx
rtk bunx prettier --write src/components/DeferredRecoveryWork.tsx src/components/DeferredRecoveryWork.test.tsx src/app/layout.tsx
rtk bunx prettier --check src/components/DeferredRecoveryWork.tsx src/components/DeferredRecoveryWork.test.tsx src/app/layout.tsx
rtk bunx eslint src/components/DeferredRecoveryWork.tsx src/components/DeferredRecoveryWork.test.tsx src/app/layout.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit Task 7**

```bash
rtk git add src/components/DeferredRecoveryWork.tsx src/components/DeferredRecoveryWork.test.tsx src/app/layout.tsx
rtk git commit -m "perf: defer quick expense recovery work"
```

## Task 8: Final Verification

**Files:**
- All files modified in Tasks 1-7.

- [ ] **Step 1: Run focused test suite**

Run:

```bash
rtk bunx vitest run src/lib/instant-shell/snapshot.test.ts src/app/instant-shell-script.test.ts src/components/InstantAppShell.test.tsx src/components/InstantShellBridge.test.tsx src/app/loading.test.tsx src/components/startup-motion.test.ts src/components/SpendingDashboardHeaderClient.test.tsx src/components/ExpenseList.test.tsx src/app/page.test.tsx src/components/ExpenseSyncCoordinator.test.tsx src/app/sw.test.ts src/components/DeferredRecoveryWork.test.tsx src/components/QuickExpenseMutationCoordinator.test.tsx src/components/QuickExpenseRecoverySheetHost.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run formatter and ESLint for modified TypeScript/TSX scope**

Run:

```bash
rtk bunx prettier --write src/lib/instant-shell/snapshot.ts src/lib/instant-shell/snapshot.test.ts src/app/instant-shell-script.ts src/app/instant-shell-script.test.ts src/components/InstantAppShell.tsx src/components/InstantAppShell.test.tsx src/components/InstantShellBridge.tsx src/components/InstantShellBridge.test.tsx src/components/DeferredRecoveryWork.tsx src/components/DeferredRecoveryWork.test.tsx src/app/layout.tsx src/app/loading.tsx src/app/loading.test.tsx src/app/page.test.tsx src/components/SpendingDashboardHeaderClient.tsx src/components/SpendingDashboardHeaderClient.test.tsx src/components/ExpenseList.tsx src/components/startup-motion.test.ts src/app/globals.css
rtk bunx prettier --check src/lib/instant-shell/snapshot.ts src/lib/instant-shell/snapshot.test.ts src/app/instant-shell-script.ts src/app/instant-shell-script.test.ts src/components/InstantAppShell.tsx src/components/InstantAppShell.test.tsx src/components/InstantShellBridge.tsx src/components/InstantShellBridge.test.tsx src/components/DeferredRecoveryWork.tsx src/components/DeferredRecoveryWork.test.tsx src/app/layout.tsx src/app/loading.tsx src/app/loading.test.tsx src/app/page.test.tsx src/components/SpendingDashboardHeaderClient.tsx src/components/SpendingDashboardHeaderClient.test.tsx src/components/ExpenseList.tsx src/components/startup-motion.test.ts src/app/globals.css
rtk bunx eslint src/lib/instant-shell/snapshot.ts src/lib/instant-shell/snapshot.test.ts src/app/instant-shell-script.ts src/app/instant-shell-script.test.ts src/components/InstantAppShell.tsx src/components/InstantAppShell.test.tsx src/components/InstantShellBridge.tsx src/components/InstantShellBridge.test.tsx src/components/DeferredRecoveryWork.tsx src/components/DeferredRecoveryWork.test.tsx src/app/layout.tsx src/app/loading.tsx src/app/loading.test.tsx src/app/page.test.tsx src/components/SpendingDashboardHeaderClient.tsx src/components/SpendingDashboardHeaderClient.test.tsx src/components/ExpenseList.tsx src/components/startup-motion.test.ts
```

Expected: PASS.

- [ ] **Step 3: Manual returning-user verification**

Run the dev server:

```bash
rtk bun run dev
```

In a browser:

1. Visit `/` once and wait for the dashboard total to render.
2. Confirm `localStorage.getItem("spendly:instant-shell:v1")` contains only `totalText` and `updatedAt`.
3. Reload `/` with network throttling.
4. Confirm the Spendly-shaped dark shell appears before the real dashboard and Expense list.
5. Confirm the real dashboard/list replace the shell without a visible layout jump.
6. Confirm a quick expense failed-draft recovery flow still opens after the deferred recovery work delay.

Expected: all checks pass.

- [ ] **Step 4: Confirm no forbidden changes**

Run:

```bash
rtk git diff main...HEAD -- src/app/page.tsx src/lib/queries/expenses.ts src/components/ExpenseSyncCoordinator.tsx src/app/sw.ts
```

Expected: no behavior changes to `/` server prefetch, Expense browser reads, sync bootstrap, or service-worker dynamic network-only boundaries. Test-only or formatting-only changes are acceptable only if they do not change those behaviors.

- [ ] **Step 5: Final commit if needed**

If any final verification fixes were required:

```bash
rtk git add <fixed-files>
rtk git commit -m "test: verify returning user instant shell"
```

If no final fixes were required, do not create an empty commit.

---

## Self-Review Notes

- The plan preserves `/` server prefetch and does not introduce route streaming.
- The shell persists display text only and does not persist theme.
- The plan keeps `ExpenseSyncCoordinator` eager.
- The service worker remains network-only for dynamic app data.
- All `.ts` and `.tsx` edits include targeted Vitest, Prettier, and ESLint commands.
