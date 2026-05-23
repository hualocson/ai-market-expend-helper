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

- The installed Sonner version exposes `mobileOffset`, `visibleToasts`, `toastOptions`, `duration`, `icons`, `richColors`, and per-toast actions. Its built-in CSS uses a `200ms` swipe-out animation, `16px` default styled padding, `13px` text, `16px` icons, and full-width mobile toasts below `600px` unless overridden.
- Material snackbar guidance treats snackbars as temporary, non-critical process feedback. It recommends one snackbar at a time, one optional action, 48-64dp mobile height for one or two text lines, elevation, and avoiding navigation or important touch targets.
- MUI snackbar guidance frames snackbars as floating, fixed-position updates that should not block the app, recommends sufficient reading time, and notes that stacking is discouraged in Material guidance even though libraries allow it.
- VA mobile snackbar guidance emphasizes API feedback, a relevant success/error icon, and short success/error text.
- WCAG status message guidance requires status feedback to be programmatically determinable without moving focus. Non-urgent success/info feedback should be polite; important errors can use alert semantics carefully.
- UI polish guidance for this app: avoid unnecessary animation, use exact transition properties, keep enter/exit motion under 300ms, use optical alignment for icons, and prefer a restrained elevated surface over loud decorative treatment.

Sources:

- Installed Sonner types and CSS: `node_modules/sonner/dist/index.d.ts`, `node_modules/sonner/dist/styles.css`
- Material snackbar guidance: https://m2.material.io/components/snackbars
- MUI Snackbar docs: https://mui.com/material-ui/react-snackbar/
- VA Snackbar guidance: https://dev-design.va.gov/4867/components/snackbar
- WCAG status messages: https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html

## Approved Approach

Refine the existing top toast model into a compact mobile "micro toast" instead of moving to a bottom snackbar.

This keeps feedback clear of the bottom nav and quick-add affordance while still improving mobile fit, visual quality, stacking behavior, and action-toast treatment.

Rejected alternatives:

- Bottom snackbar above navigation: better thumb-zone placement, but fragile around `BottomNav`, `ProgressiveBlur`, quick-add, and sheet flows.
- Persistent recovery toast for all errors: too heavy as a default. Persistent/action toasts should be reserved for recoverable background-submit failures or similar repair flows.

## UX Design

### Placement

Keep the default root placement as top-right for desktop and top/full-width mobile through Sonner's responsive behavior.

Add explicit mobile offsets:

- Top: `calc(env(safe-area-inset-top) + 12px)`
- Left/right: `12px` on narrow phones, `16px` from larger mobile widths if this can be expressed cleanly

This makes top toasts notch-aware and avoids relying on Sonner's plain `16px` mobile default.

Desktop can keep the existing top-right placement with the default or a small app-token offset.

### Compact Mobile UI Contract

Mobile toasts should minimize screen coverage. The target is a small floating status pill, not a banner.

Default success/info/error without action:

- One visible line whenever the message fits.
- Visual height target: `40-44px`.
- Hard maximum height: one wrapped two-line toast around `56px`.
- Horizontal padding: `10-12px`.
- Gap between icon and text: `6px`.
- Icon: `14-16px`, optically centered.
- Text: `13px`, medium weight, `line-height: 1.25-1.35`.
- Description: omitted by default.
- Close button: omitted by default.
- Width: first try a content-hugging mobile override with `width: fit-content` and `max-width: calc(100vw - 24px)`. If that requires fighting Sonner's generated mobile width rule, defer width override and ship the compact height/content rules first.

Recovery/action toast:

- Still uses one text line.
- Visual height target: `44-48px`.
- Keep the action inline when the label is short, for example `Reopen`.
- If text plus action would crowd, shorten the message. Do not add a second descriptive line.

The compact contract is more important than decorative richness. A toast should never look like a card, alert panel, or notification center item.

### Stacking

Show at most one visible toast by default. This aligns with mobile snackbar guidance and avoids covering the top of dense finance screens.

The quick-expense coordinator already replaces loading toasts with success/error using the stored toast ID. Preserve that behavior so one operation does not produce a loading stack followed by a completion stack.

Use a conservative global `visibleToasts={1}`. If desktop review later proves this too restrictive, introduce a small responsive wrapper rather than letting mobile stack.

Keep `expand={false}` so hidden/back toasts do not invite expansion or create a stacked-card feel.

### Visual Style

Use the app's elevated surface tokens rather than Sonner's loud rich-color blocks as the main visual base. Disable root `richColors`; communicate status with a small icon/accent, not a filled green/red toast.

The target toast should feel like a compact, elevated app surface:

- Background: `var(--popover)`
- Text: `var(--popover-foreground)`
- Border: `color-mix(in srgb, var(--border) 76%, transparent)`
- Semantic accent: a `2px` left rail or a tiny icon color only. Do not tint the whole surface.
- Radius: `10-12px`, matching the app's radius scale while staying compact.
- Shadow: one or two soft layers, enough to lift from content without looking like a card.
- Typography: compact `13px` title only.
- Icon: semantic `14-16px` icon for success, error, loading, warning, and info.

Do not rely on red/green background color alone. Use icon, text, and a small semantic accent.

Recommended semantic accents:

- Success: `var(--success)` icon or rail.
- Error: `var(--destructive)` icon or rail.
- Warning: `var(--warning)` icon or rail.
- Info/loading: `var(--info)` or muted foreground.

Avoid:

- Full red/green backgrounds.
- Large close buttons.
- Multi-line success messages.
- Toast descriptions.
- Card-like padding.

### Copy

Success toasts should stay short:

- `Expense added`
- `Expense updated`
- `Budget saved`
- `Funds moved`

Routine error toasts should also stay short:

- `Expense not saved`
- `Budget not deleted`
- `Source budget no longer exists`

Avoid generic punctuation-heavy or verbose copy. Do not add secondary descriptions, including for recovery/action toasts.

Copy limits:

- Routine toast title: target `18-28` characters.
- Maximum title before wrapping: about `34` characters.
- Recovery toast title: still short, with the action carrying the next step.

### Actions

Use at most one action in a toast.

Keep action toasts reserved for recovery flows:

- Quick-expense failed background submit: `Reopen`
- Future undo/retry flows: `Undo` or `Try again` only when the same action is still available elsewhere or recoverable through state

Action styling should remain text-like and compact:

- Height: `32-36px` visual, with at least `40px` practical hit area when feasible.
- Padding: `8-10px` inline.
- Radius: pill.
- No filled primary button unless testing shows the action is being missed.

Action toasts should live longer than plain success toasts. Set a longer per-toast duration for recovery errors in `QuickExpenseMutationCoordinator`. Do not make all errors persistent by default.

Recommended durations:

- Loading: Sonner loading behavior, replaced through the existing toast ID.
- Success/info: `2500-3200ms`.
- Routine error without action: `4000-5000ms`.
- Recovery/action error: `8000-10000ms`.

### Accessibility

Keep focus where it is. Toasts should not steal focus.

The implementation should rely on Sonner's live-region behavior unless testing shows a gap. The design expectation is:

- Success/info/loading feedback should behave as non-disruptive status feedback.
- Important errors can be assertive, but repeated assertive errors should be avoided.
- Interactive action buttons must remain keyboard reachable.
- Toast text and action labels must meet contrast requirements in light and dark themes.
- If visual compactness conflicts with touch accessibility, keep the visual compact but extend the action hit area through padding or a pseudo-element rather than enlarging the whole toast.

### Motion

Toasts are frequent feedback. Motion should be quick and functional:

- Enter: `160-200ms`, opacity plus small `translateY`, using ease-out.
- Exit: `120-160ms`, slightly faster than enter.
- Animate only `transform`, `opacity`, and possibly `box-shadow`.
- Respect `prefers-reduced-motion`; Sonner already disables transitions in its CSS for reduced motion.
- Do not add bounce, scale-from-zero, decorative blur, or staggered stack animations.

## Implementation Boundaries

Primary files in scope:

- `src/app/layout.tsx`: update root `<Toaster />` props such as `mobileOffset`, `visibleToasts`, `expand`, `duration`, `richColors`, and `toastOptions`.
- `src/components/ui/sonner.tsx`: centralize compact class names, CSS variables, icons, or app-specific Sonner defaults.
- `src/components/QuickExpenseMutationCoordinator.tsx`: set recovery-toast duration/action presentation when implementing the longer recovery-toast duration. Do not move mutation lifecycle ownership.

Files out of scope:

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
  - Routine success toast is one line and about `40-44px` tall.
  - Toasts use no description and no close button.
  - Only one mobile toast is visible during quick expense loading-to-success replacement.
  - Error toast with `Reopen` remains compact, actionable, and reopens the failed draft.
  - Light and dark themes keep readable contrast.
  - Reduced-motion mode does not show distracting motion.

## Rollout

Ship as a direct app-wide refinement. No feature flag is needed because the change is centralized, visually scoped, and preserves the existing toast API and mutation lifecycle.

If mobile review shows top placement hides route-level headers or controls, revisit bottom placement with a measured bottom offset above `BottomNav` and `env(safe-area-inset-bottom)`.
