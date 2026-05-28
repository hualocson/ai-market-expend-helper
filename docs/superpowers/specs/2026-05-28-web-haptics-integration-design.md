# Web Haptics Integration Design

Date: 2026-05-28
Status: Approved for planning

## Goal

Add reusable web haptics support without making every interaction vibrate.

The feature should provide a small generic event API for explicit call sites. Components decide when feedback is meaningful, while the shared module standardizes package usage, type names, and future tuning.

This design includes:

- installing `web-haptics` with Bun
- adding a reusable app hook for generic haptic events
- wiring an initial set of high-signal explicit call sites
- tracking planned and completed call sites in a Markdown map

This design does not include:

- automatic haptics on every button
- shared `HapticButton` or wrapper components
- persisted haptic preferences
- custom vibration patterns beyond the library presets
- server-side haptic code

## Current Context

The project is a Next.js 15 App Router app with React 19, TanStack Query, Zustand, Tailwind v4, shadcn-style UI primitives, and Vitest.

Interactive UI already lives in client components such as:

- `src/components/ManualExpenseForm.tsx`
- `src/components/AIExpenseChat.tsx`
- `src/components/BudgetPickerSheet.tsx`
- `src/components/BudgetTransferDrawer.tsx`
- `src/components/PullToRefresh.tsx`

The project rules require client behavior to stay in leaf client components. The haptics library exposes React support through `web-haptics/react`, so any hook that uses it must be a client module.

The project-local skill at `.agents/skills/web-haptics/SKILL.md` defines the integration constraints:

- install with `bun add web-haptics`
- use `useWebHaptics()` from `web-haptics/react`
- haptics should supplement visible UI state
- do not trigger feedback for every tap
- trigger async success or error only when the result arrives
- use selection feedback only for discrete selection changes

## Approved Approach

Use a generic event API implemented as a reusable client hook.

The hook should expose app-level methods that map directly to the library presets:

```ts
type AppHapticImpact = "light" | "medium" | "heavy";
type AppHapticType =
  | "success"
  | "warning"
  | "error"
  | "selection"
  | AppHapticImpact;

type AppHaptics = {
  success: () => void;
  warning: () => void;
  error: () => void;
  selection: () => void;
  impact: (level?: AppHapticImpact) => void;
  trigger: (type?: AppHapticType) => void;
};
```

The exact exported type names may change during implementation, but the API shape should stay generic. It must not expose domain-specific methods such as `expenseSaved()` or `transferFailed()`.

Call sites should import the hook and trigger feedback explicitly at meaningful moments.

## Alternatives Considered

### Generic Event API

Expose `success()`, `warning()`, `error()`, `selection()`, and `impact()` from one hook.

This is the approved approach. It keeps call sites readable, avoids raw preset strings scattered through the codebase, and preserves explicit ownership at each interaction.

### Raw Library Hook Everywhere

Each component imports `useWebHaptics()` and calls `trigger("success")` or similar directly.

This has the fewest lines, but it makes later tuning harder and spreads library-specific strings across the UI.

### Shared Haptic Components

Create wrappers such as `HapticButton` or `HapticToggle`.

This may be useful later for a narrowly defined interaction family, but it is not the first pass. It risks adding haptics to routine taps and conflicts with the explicit-call-site direction.

## Architecture

### Package

Install the dependency with:

```bash
bun add web-haptics
```

This should update `package.json` and `bun.lock`.

### Reusable Hook

Add a client hook under `src/hooks/`, likely:

- `src/hooks/useAppHaptics.ts`

Responsibilities:

- import `useWebHaptics` from `web-haptics/react`
- expose a generic event API
- centralize allowed preset names and TypeScript types
- avoid feature-specific naming
- leave unsupported platforms to the library no-op behavior

The hook should be small. It does not need feature detection, custom try/catch handling, local storage, or provider state.

### Call-Site Ownership

Each component remains responsible for deciding whether the current event deserves feedback.

Guidelines:

- Use `success()` when a user-triggered async operation visually succeeds.
- Use `error()` when an operation visibly fails or validation blocks progress.
- Use `warning()` only before or during cautionary/destructive states.
- Use `selection()` for discrete changes such as picker rows, tabs, mode switches, and wheel detents.
- Use `impact("light")` for threshold crossings or subtle physical interactions.
- Use `impact("medium")` for standard direct actions when selection or result feedback is not a better fit.
- Avoid `impact("heavy")` unless the UI has a major state transition.

Async flows must trigger haptics when the final visual state changes, not when the request starts.

### Tracking Map

Maintain a Markdown call-site map at:

- `docs/web-haptics-map.md`

The map should track each candidate integration with:

- area
- file
- interaction
- haptic method
- status
- notes

The map is documentation, not executable config. It should be updated as call sites are implemented or intentionally deferred.

## Initial Call-Site Targets

The first implementation pass should prefer high-signal mobile moments:

- Manual expense submit success and error in `src/components/ManualExpenseForm.tsx`
- AI parse success, fallback, and error in `src/components/AIExpenseChat.tsx`
- Budget picker row selection in `src/components/BudgetPickerSheet.tsx`
- Quick/advanced mode switching in `src/components/ManualExpenseForm.tsx`
- Budget transfer success and error in `src/components/BudgetTransferDrawer.tsx`
- Pull-to-refresh threshold crossing in `src/components/PullToRefresh.tsx`

These call sites are still subject to implementation review. If a call site proves noisy or visually unclear, defer it in the map instead of forcing haptics into it.

## Error Handling

No new user-facing error handling is needed for haptics.

The library uses the Web Vibration API and silently no-ops on unsupported platforms. The app should rely on that behavior. Haptic calls should never block form submits, query updates, drawer closing, navigation, or recovery behavior.

If a call site already handles a domain error with toast or inline UI, haptics can supplement that same visible state change with `error()`.

## Testing

The hook should have focused unit coverage if it contains logic beyond direct passthrough methods. Since the browser vibration behavior is platform-dependent, tests should verify app-level mapping and call-site behavior, not actual device vibration.

Recommended coverage:

- hook or helper maps `success()` to the success preset
- hook or helper maps `impact("light")`, `impact("medium")`, and `impact("heavy")` correctly
- call-site tests assert haptic methods fire on result transitions where practical
- existing mutation and recovery tests continue to pass after call-site changes

Avoid broad build validation for this change. Per project rules, use targeted checks for modified `.ts` and `.tsx` files:

- `rtk bunx prettier --write <modified-files>`
- `rtk bunx prettier --check <modified-files>`
- `rtk bunx eslint <modified-files>`
- focused Vitest tests for touched components or hooks

## Acceptance Criteria

- `web-haptics` is installed with Bun.
- A reusable generic hook exists under `src/hooks/`.
- No domain-specific haptic method names are introduced.
- Initial explicit call sites are implemented or marked deferred in `docs/web-haptics-map.md`.
- Haptics are paired with visible UI feedback.
- Routine buttons do not receive automatic haptics.
- Targeted formatter, ESLint, and relevant tests pass for modified implementation files.
