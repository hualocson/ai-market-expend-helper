# Compact Bottom Nav Test Component Design

## Goal

Create a new bottom navigation component for review on a test page before replacing the current `BottomNav.tsx`.

The component should follow the approved Linear-style dock direction:

- Left group: a long blurred glass capsule with `Home`, `Budgets`, and an expand/collapse button.
- Expanded left group: the same capsule grows upward and reveals `Reports` and `Settings`.
- Right group: a detached circular `Add expense` trigger that opens the existing `QuickExpenseDrawer`.
- Target viewport: mobile-first, especially iPhone 13/14 dimensions around `390x844`.

The existing production `BottomNav.tsx` remains the active nav for normal app routes in this first implementation.

## Component Behavior

The new component starts collapsed.

Collapsed state:

- Shows `Home`.
- Shows `Budgets`.
- Shows an icon-only expand button with `aria-expanded="false"`.
- Shows a detached circular `Add expense` button on the right.

Expanded state:

- The left dock increases height upward, keeping the bottom edge anchored.
- `Reports` and `Settings` appear above the base row inside the same dock.
- The expand icon rotates to indicate the open state.
- The expand button updates to `aria-expanded="true"` and becomes a collapse control.

Navigation buttons should use `next/link` and keep active-state behavior consistent with the current nav:

- `/` activates Home.
- `/budgets` activates Budgets.
- `/report` activates Reports.
- `/settings` activates Settings.

The add button should render `QuickExpenseDrawer` in compact mode and keep the current medium-impact haptic trigger when opened.

## Visual Direction

The nav should use a dark floating dock style inspired by the reference image:

- A long rounded left capsule with soft blur, subtle border, and inner highlight.
- A detached circular action dock on the right.
- Large icon-only touch targets, no visible labels.
- Home active state appears as a wider soft capsule inside the left dock.
- The expanded secondary row is visually quieter than the primary row.

Use the project’s existing dark-mode tokens and Lucide icons. Do not add light-mode behavior or a new theme system.

## Test Page

Add the component to a dedicated test route so it can be reviewed without replacing the production nav.

Preferred route:

- `/dev/bottom-nav`

The test page should provide enough scroll/list content behind the dock to evaluate the bottom fade, blur, spacing, and safe-area behavior on mobile.

Because the global layout already renders the current production `BottomNav`, hide the production nav only on `/dev/bottom-nav`. This keeps the prototype review clean without replacing the production nav for normal routes.

## Accessibility

- Every icon-only control must have an `aria-label`.
- The expand button must use `aria-expanded` and `aria-controls`.
- Touch targets must remain at least `44x44`.
- Focus rings must remain visible.
- The expanded secondary row must be reachable by keyboard when visible.

## Testing

Add focused tests for the new component:

- Renders collapsed primary controls and add trigger.
- Toggles expanded state and reveals `Reports` and `Settings`.
- Updates `aria-expanded`.
- Triggers existing medium-impact haptics when the add expense button is clicked.

Run formatter and ESLint for modified `.ts` and `.tsx` files after implementation, following project instructions.

## Out of Scope

- Replacing the current production `BottomNav.tsx`.
- Changing `QuickExpenseDrawer` behavior.
- Changing persisted navigation state.
- Adding new routes beyond the test page.
- Adding desktop-specific polish beyond a coherent functional layout.
