# iOS Search Drawer — Design Spec

**Date:** 2026-06-01
**Status:** Approved design
**Feature:** Convert the home smart-search UI into an iOS-style full-screen search drawer.

## Summary

Replace the current inline home search input with a small search pill that sits just above the bottom navigation on the Home page only. Tapping the pill opens a full-screen bottom drawer, matching the `QuickExpenseDrawer` full-screen pattern. The search input stays fixed above the iOS keyboard with a close button on its right. Filter chips and filtered expense results render above the input.

The drawer is a temporary search mode. Closing it hides the drawer and returns Home to the normal unfiltered expense list, but the drawer remembers the latest query, structured filters, and filtered result state for the next open.

## Goals

- Show a compact Home-only search pill above the fixed bottom nav.
- Open a full-screen drawer that feels like the existing `QuickExpenseDrawer`.
- Keep the search input pinned above the keyboard.
- Put the close button on the right side of the search input row.
- Show structured filter chips above the input.
- Show filtered expense results inside the drawer above the chips/input.
- Submit AI natural-language parsing only when the user presses Return/Search.
- Preserve drawer search state across close/reopen while keeping Home unfiltered when the drawer is closed.

## Non-Goals

- No global search on Budget, Report, or Settings tabs.
- No live AI parsing while typing.
- No new API route or search backend.
- No persisted search state across page reloads.
- No `q` text chip; raw text belongs in the input.

## Architecture

`ExpenseSearch` remains the Home search owner, but changes from an inline wrapper into a Home-local search mode:

```txt
src/app/page.tsx
  └─ <ExpenseSearch>
       ├─ normal Home <ExpenseList />              // unfiltered while drawer is closed
       ├─ fixed search pill                        // Home only, above bottom nav
       └─ full-screen search <Drawer>
            ├─ filtered <ExpenseList />            // uses drawer filter
            ├─ <SearchFilterChips />               // structured filters only
            └─ search bar row
                 ├─ <SearchInput />
                 └─ close button
```

The drawer reuses the same mechanics as `QuickExpenseDrawer`:

- `Drawer` with `direction="bottom"`, `modal`, `repositionInputs={false}`, and `autoFocus={false}`.
- `DrawerContent` with `h-dvh`, `rounded-none`, no height cap, and no indicator.
- `useKeyboardOffset()` to position the bottom search bar above the keyboard.
- Narrow `onPointerDown={(event) => event.preventDefault()}` on close/search/chip controls that must not blur the active input.

The existing `ExpenseList` remains the result renderer. Add a compact/search-drawer presentation prop only for drawer-specific spacing, bottom padding, or scroll behavior; keep query and row rendering logic shared.

## State Model

`ExpenseSearch` owns local state:

```ts
type SearchDrawerState = {
  open: boolean;
  inputValue: string;
  filter: SearchFilter;
};
```

When the drawer is closed:

- Home renders the normal unfiltered `ExpenseList`.
- The search pill remains visible above the bottom nav.
- `inputValue` and `filter` remain in memory for the next drawer open.

When the drawer is open:

- The drawer `ExpenseList` receives `filter` fields.
- `inputValue` is displayed in the search input.
- Structured chips are rendered from `filter` excluding `q`.

## Search Flow

1. User taps the Home search pill.
2. Drawer opens and focuses the search input.
3. User types a natural-language query.
4. Pressing Return/Search submits the trimmed input.
5. `parseSearchRequest()` runs once with the existing AI parse route.
6. Success updates structured fields in `filter`.
7. Fallback sets `filter.q` to the raw input.
8. Drawer results update through the existing `ExpenseList` query props.

No AI request fires while typing. Empty input is a no-op.

## Filter Display Rules

- `q` is shown only in the input.
- Filter chips show only structured fields: date range, categories, budgets, budget presence, and amount range.
- If fallback produces only `{ q }`, the chip row is empty and the typed text remains in the input.
- Removing a chip clears only that structured filter field and updates drawer results without another AI parse.
- Editing the input changes the displayed text; submitting it again updates `q` and structured filters from the new parse result.

## Close Behavior

The close button sits on the right side of the bottom search row. Closing the drawer:

- hides the drawer,
- keeps `inputValue` and `filter` in `ExpenseSearch`,
- returns Home to the normal unfiltered list,
- does not clear chips or input state for the next drawer open.

This makes close mean "exit search mode", not "clear search".

## Offline And Error Handling

- Offline: the drawer can open, but submitting search is disabled with the existing offline disabled state.
- Empty input: do nothing.
- AI parse failure: keep the user's text in the input, set `filter.q`, render plain text results, and show no raw-text chip.
- Invalid/unknown structured fields remain handled by the existing smart-search contract and parser guards.

## Interaction Details

- The search pill is fixed above the bottom nav and only rendered by the Home search component.
- The drawer input focuses on open and is refocused after submit unless the drawer has closed.
- The bottom search row is fixed with `bottom: calc(keyboardOffset + spacing)`.
- The result list scrolls independently above the bottom search controls.
- Active chips sit immediately above the search input and stay visible while the keyboard is open.
- The close button uses an icon-only affordance, matching the project preference for familiar symbols over text buttons.

## Testing

Add or update focused React Testing Library coverage:

- `ExpenseSearch` renders the Home search pill and normal unfiltered Home list by default.
- Tapping the pill opens the full-screen drawer and focuses the input.
- Submitting calls `parseSearchRequest()` once and passes parsed filters to the drawer `ExpenseList`.
- Closing hides the drawer and renders the Home list unfiltered.
- Reopening restores the latest input, structured chips, and filtered drawer list.
- `q` text appears in the input and not as a filter chip.
- Removing structured chips updates drawer list props without another AI call.
- Offline and empty-submit behavior remain covered.

After implementation, run project-required checks for modified `.ts` and `.tsx` files:

```sh
rtk bunx prettier --write <modified-files>
rtk bunx prettier --check <modified-files>
rtk bunx eslint <modified-files>
```

## Key Files

- `src/components/search/ExpenseSearch.tsx`
- `src/components/search/SearchInput.tsx`
- `src/components/search/SearchFilterChips.tsx`
- `src/components/search/filter-chips.ts`
- `src/components/ExpenseList.tsx`
- `src/components/QuickExpenseDrawer.tsx`
- `src/hooks/useKeyboardOffset.ts`
- `src/app/page.tsx`
