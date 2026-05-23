# Mobile Toast UI Refinement Design

## Context

The app uses Sonner `^2.0.7` for toast notifications. The project wrapper is `src/components/ui/sonner.tsx`, and the single root `<Toaster />` is mounted in `src/app/layout.tsx`.

The current root configuration is:

- `position="top-right"`
- `richColors`
- `toastOptions.classNames.toast = "group-[.toaster]:pointer-events-auto"`

Most call sites invoke Sonner directly with `toast.success`, `toast.error`, or `toast.loading`. The important lifecycle exception is `src/components/QuickExpenseMutationCoordinator.tsx`, which owns quick-expense background submit toasts and recovery actions. `LEARNINGS.md` requires that this coordinator keep ownership of loading/success/error toast lifecycle and failed-draft recovery. Toast IDs are presentation handles and must not be persisted.

The app has fixed bottom UI: `ProgressiveBlur`, `BottomNav`, and the centered quick-add button. Moving mobile toasts to the bottom would match common snackbar guidance, but it creates collision risk with the app's primary mobile navigation. The approved direction is to keep top placement and refine it for mobile.

## Research Summary

Useful external guidance:

- Sonner supports `position`, `offset`, `mobileOffset`, `visibleToasts`, `toastOptions`, icons, and per-toast actions. `mobileOffset` applies below `600px`.
- Material/MUI snackbar guidance treats snackbars as temporary, non-critical process feedback and recommends sufficient reading time.
- VA and Wise mobile snackbar guidance emphasize one visible snackbar, concise copy, bottom-nav avoidance when bottom-placed, and using actions only when meaningful.
- WCAG status message guidance requires status feedback to be programmatically determinable without moving focus. Non-urgent success/info feedback should be polite; important errors can use alert semantics carefully.

Sources:

- Sonner Toaster docs: https://sonner.emilkowal.ski/toaster
- Sonner Styling docs: https://sonner.emilkowal.ski/styling
- MUI Snackbar docs: https://mui.com/material-ui/react-snackbar/
- VA Snackbar guidance: https://dev-design.va.gov/4867/components/snackbar
- Wise Snackbar guidance: https://www.wise.design/components/snackbar
- WCAG status messages: https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html

## Approved Approach

Refine the existing top toast model instead of moving to a bottom snackbar.

This keeps feedback clear of the bottom nav and quick-add affordance while still improving mobile fit, visual quality, stacking behavior, and action-toast treatment.

Rejected alternatives:

- Bottom snackbar above navigation: better thumb-zone placement, but fragile around `BottomNav`, `ProgressiveBlur`, quick-add, and sheet flows.
- Persistent recovery toast for all errors: too heavy as a default. Persistent/action toasts should be reserved for recoverable background-submit failures or similar repair flows.

## UX Design

### Placement

Keep the default root placement as top-right for desktop and top/full-width mobile through Sonner's responsive behavior.

Add explicit mobile offsets:

- Top: `calc(env(safe-area-inset-top) + 12px)`
- Left/right: `16px`

This makes top toasts notch-aware and avoids relying on Sonner's plain `16px` mobile default.

Desktop can keep the existing top-right placement with the default or a small app-token offset.

### Stacking

On mobile, show at most one visible toast by default. This aligns with mobile snackbar guidance and avoids covering the top of dense finance screens.

The quick-expense coordinator already replaces loading toasts with success/error using the stored toast ID. Preserve that behavior so one operation does not produce a loading stack followed by a completion stack.

If Sonner's `visibleToasts` is global rather than breakpoint-aware in the current version, prefer a conservative global `visibleToasts={1}` unless desktop review shows that desktop workflows need more than one visible toast.

### Visual Style

Use the app's elevated surface tokens rather than Sonner's loud rich-color blocks as the main visual base.

The target toast should feel like a compact, elevated app surface:

- Background: `var(--popover)`
- Text: `var(--popover-foreground)`
- Border: `var(--border)` with subtle semantic tint
- Radius: about the app's `--radius` scale, compact enough for a utility UI
- Shadow: app shadow token or close equivalent
- Typography: compact 13-14px title, optional short description
- Icon: semantic icon for success, error, loading, warning, info

Do not rely on red/green background color alone. Use icon, text, and a small semantic accent.

### Copy

Success toasts should stay short:

- `Expense added`
- `Expense updated`
- `Budget saved`
- `Funds moved`

Error toasts can be slightly longer when needed, but should still describe the state plainly:

- `Expense not saved`
- `Budget not deleted`
- `Source budget no longer exists`

Avoid generic punctuation-heavy or verbose copy. Do not add secondary descriptions unless the toast has an action or the message would otherwise be ambiguous.

### Actions

Use at most one action in a toast.

Keep action toasts reserved for recovery flows:

- Quick-expense failed background submit: `Reopen`
- Future undo/retry flows: `Undo` or `Try again` only when the same action is still available elsewhere or recoverable through state

Action toasts should live longer than plain success toasts. If Sonner supports per-toast duration at call sites, set a longer duration for recovery errors in `QuickExpenseMutationCoordinator`. Do not make all errors persistent by default.

### Accessibility

Keep focus where it is. Toasts should not steal focus.

The implementation should rely on Sonner's live-region behavior unless testing shows a gap. The design expectation is:

- Success/info/loading feedback should behave as non-disruptive status feedback.
- Important errors can be assertive, but repeated assertive errors should be avoided.
- Interactive action buttons must remain keyboard reachable.
- Toast text and action labels must meet contrast requirements in light and dark themes.

## Implementation Boundaries

Primary files likely in scope:

- `src/app/layout.tsx`: update root `<Toaster />` props such as `mobileOffset`, `visibleToasts`, `richColors`, and `toastOptions`.
- `src/components/ui/sonner.tsx`: centralize class names, CSS variables, icons, or app-specific Sonner defaults if needed.
- `src/components/QuickExpenseMutationCoordinator.tsx`: only adjust recovery-toast duration/action presentation if needed. Do not move mutation lifecycle ownership.

Files likely out of scope:

- TanStack mutation hooks in `src/lib/mutations`: they should continue owning REST calls, optimistic cache behavior, rollback, and invalidation, not presentation toasts.
- Zustand recovery persistence shape except where tests already cover toast ID behavior. Do not persist toast IDs.
- Individual feature components unless copy changes are deliberately included.

## Testing And Verification

Targeted validation should avoid `npm run build`.

Recommended checks:

- Component tests already covering coordinator toast lifecycle should still pass.
- Add or adjust focused tests only if a code change alters coordinator duration/action options or root Toaster behavior is wrapped in testable logic.
- Manual mobile verification in a browser viewport around 390px wide:
  - Top toast clears the safe area.
  - Toast does not overlap primary page controls.
  - Only one mobile toast is visible during quick expense loading-to-success replacement.
  - Error toast with `Reopen` remains actionable and reopens the failed draft.
  - Light and dark themes keep readable contrast.

## Rollout

Ship as a direct app-wide refinement. No feature flag is needed because the change is centralized, visually scoped, and preserves the existing toast API and mutation lifecycle.

If mobile review shows top placement hides route-level headers or controls, revisit bottom placement with a measured bottom offset above `BottomNav` and `env(safe-area-inset-bottom)`.
