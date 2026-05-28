# Mobile Lag And Quick Expense Sheet Design

## Goal

Make the app feel responsive on iPhone 13-class devices by reducing mobile main-thread pressure during page transitions and quick expense sheet open. The first user-visible target is tapping the bottom-nav add button and getting the quick expense note input focused without a perceptible delay.

## Production Findings

Testing against `https://ai-market-expend-helper-jade.vercel.app/` with a 390x844 viewport at 3x device scale showed:

- Quick expense tap-to-input took about 241 ms.
- Sheet open produced long tasks of about 250 ms and 104 ms.
- The home page had about 38,008 DOM nodes before the sheet opened.
- The home page had about 2,794 buttons before the sheet opened.
- The browser snapshot exposed more than 3,800 interactive refs, mostly from expense rows and hidden duplicate/edit/delete controls.
- Home to report navigation changed the URL at about 198 ms but the report heading appeared at about 1,130 ms, with a 158 ms long task.

The visible symptom is delayed sheet open, but the larger issue is that the home route keeps too much interactive UI mounted. The quick sheet is paying part of that cost because it opens over a very large live page.

## Chosen Approach

Fix mobile pressure in this order:

1. Reduce home expense list DOM and interactive-action cost.
2. Optimize the quick expense sheet open path.
3. Audit route/page motion and blur work that runs during mobile transitions.

This is intentionally broader than only editing `QuickExpenseSheet.tsx`, because production measurements show the page behind the sheet is the main amplifier.

## Expense List Design

Expense rows should not mount all secondary actions and delete dialogs for every item by default.

Each row should keep the visible tappable/editable row lightweight. Duplicate, edit, and delete action controls should mount only for the active/open row or through one shared row-action surface. Delete confirmation should be owned by a single active confirmation instance instead of every row rendering its own dialog tree.

Day links in long lists should avoid unnecessary route prefetch pressure. For large repeated lists, use `prefetch={false}` on per-day links unless there is a focused intent-based replacement. Bottom-nav links can keep normal Next.js prefetch behavior because they are few and high intent.

The list should keep existing behavior:

- Tapping a row opens edit.
- Swiping or equivalent row action affordance exposes duplicate/edit/delete for that row.
- Opening one row closes any previously open row.
- Duplicate still dispatches quick expense prefill.
- Delete still uses the existing delete mutation and toast behavior.

## Quick Expense Sheet Design

The add button should remain mounted in the bottom nav, but the expensive sheet body should be split from the trigger path where practical. On tap, the user should see the sheet and focused note input before non-critical work runs.

Budget options are useful but not required for first paint. Keep the budget query enabled when the sheet is open, but avoid doing extra synchronous work before the first visible frame. If needed, defer non-critical budget derivation and AI-suggestion setup until after the initial open frame.

The sheet should preserve current core behavior:

- Create and edit modes still work.
- Recovery drafts still reopen correctly.
- Date and paid-by nested sheets still preserve input focus according to the iOS focus rules.
- Submit still uses existing mutation hooks and recovery boundaries.
- No Server Actions are added.

Animations should prefer simple transform/opacity on mobile. Remove blur/filter/layout animation from the first sheet frame if measurements show it contributes to long tasks. Visual polish is secondary to tap-to-input latency for this path.

## Route Transition Design

Page transitions should avoid animating many child sections on mobile routes that already render heavy content. Keep route-level motion subtle and bounded. Do not add view transitions or new page animation systems for this fix.

The route transition target is that bottom-nav route changes do not keep the old heavy page doing avoidable work while the new page is becoming interactive.

## Data Ownership

- App-owned reads remain TanStack Query query factories plus REST route handlers.
- App-owned writes remain mutation hooks from `src/lib/mutations`.
- Do not add or use Server Actions.
- Do not move optimistic mutation, outbox, or recovery ownership into UI components.
- Keep persisted recovery semantics from `LEARNINGS.md` unchanged.

## Testing Strategy

Focused tests should cover:

- Expense rows do not render per-row hidden duplicate/edit/delete controls for every row at rest.
- Opening a row mounts or reveals only that row's actions.
- Opening a second row closes the first row's action state.
- Delete confirmation is not duplicated per list item.
- Duplicate action still dispatches the quick expense prefill event.
- Quick expense sheet still opens and focuses the note input.
- Quick expense recovery and submit behavior remain covered by existing tests.

Manual verification should use `agent-browser` on mobile viewport for:

- Production-like home screen node/button counts.
- Quick expense tap-to-input timing.
- Long task count during sheet open.
- Home to report transition timing.

After editing `.ts` or `.tsx` files, run the project-required scoped checks:

```txt
rtk bunx prettier --write <modified-files>
rtk bunx prettier --check <modified-files>
rtk bunx eslint <modified-files>
```

Do not run `npm run build` for this scoped validation.

## Success Criteria

- The home page no longer mounts thousands of hidden row action buttons.
- Quick expense sheet tap-to-input on production-like mobile viewport is materially lower than the measured 241 ms baseline.
- Sheet open does not produce 250 ms-class long tasks in the tested mobile viewport.
- Home to report transition is not blocked by the home page's repeated row action DOM.
- Existing create, edit, duplicate, delete, recovery, and sync behavior remains intact.

## References

- Next.js prefetching docs: large lists may need `prefetch={false}` or intent-based prefetching to avoid resource pressure.
- Radix Dialog docs: dialog portal/content mounting can be controlled if later needed for pre-warming.
- Motion layout docs: layout animations use transforms, but repeated layout animation still needs measurement and should stay bounded on large lists.

## Open Questions

None. The target device is iPhone 13/mobile Safari/PWA, and the approved first implementation target is the heavy home expense list and hidden row actions before deeper quick sheet tuning.
