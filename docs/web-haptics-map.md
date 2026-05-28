# Web Haptics Map

This map tracks explicit haptic call sites. It is documentation, not executable config.

Status values:

- `planned`: approved for implementation
- `implemented`: wired in code
- `deferred`: intentionally skipped for now
- `removed`: previously wired but removed

## API

Reusable hook target: `src/hooks/useAppHaptics.ts`

Generic methods:

- `success()`
- `warning()`
- `error()`
- `selection()`
- `impact(level?: "light" | "medium" | "heavy")`
- `trigger(type?)`

## Call Sites

| Area                   | File                                        | Interaction                                 | Haptic method       | Status      | Notes                                                                                 |
| ---------------------- | ------------------------------------------- | ------------------------------------------- | ------------------- | ----------- | ------------------------------------------------------------------------------------- |
| Manual expense form    | `src/components/ManualExpenseForm.tsx`      | Submit succeeds and success toast appears   | `success()`         | implemented | Triggered after the create or caller-owned submit promise resolves.                   |
| Manual expense form    | `src/components/ManualExpenseForm.tsx`      | Submit fails and error toast appears        | `error()`           | implemented | Triggered in the same catch path that shows the error toast.                          |
| Manual expense form    | `src/components/ManualExpenseForm.tsx`      | Quick/advanced mode changes                 | `selection()`       | implemented | Triggered only when quick mode opens advanced options.                                |
| AI expense chat        | `src/components/AIExpenseChat.tsx`          | Parse returns a full expense result         | `success()`         | implemented | Triggered when the assistant success bubble replaces pending state.                   |
| AI expense chat        | `src/components/AIExpenseChat.tsx`          | Parse returns fallback prefill              | `warning()`         | implemented | Fallback is not a hard error, but it needs user attention.                            |
| AI expense chat        | `src/components/AIExpenseChat.tsx`          | Parse request fails                         | `error()`           | implemented | Triggered when the visible error assistant message is set.                            |
| Budget picker          | `src/components/BudgetPickerSheet.tsx`      | Budget row or no-budget row is selected     | `selection()`       | implemented | Triggered before or alongside closing the sheet.                                      |
| Budget transfer drawer | `src/components/BudgetTransferDrawer.tsx`   | Transfer succeeds and success toast appears | `success()`         | implemented | Triggered after mutation resolves.                                                    |
| Budget transfer drawer | `src/components/BudgetTransferDrawer.tsx`   | Transfer fails and error toast appears      | `error()`           | implemented | Triggered in the same catch path as the error toast.                                  |
| Pull to refresh        | `src/components/PullToRefresh.tsx`          | Pull crosses the refresh threshold          | `impact("light")`   | implemented | Triggered once per gesture when the threshold is first crossed, not every move event. |
| Quick expense sheet    | `src/components/QuickExpenseSheet.tsx`      | Save or Update button is pressed            | `impact("medium")`  | implemented | Triggered only after the submit action passes local validation and dispatches.        |
| Quick expense sheet    | `src/components/QuickExpenseSheet.tsx`      | Local expense write succeeds                | `success()`         | removed     | Removed from create/update local write resolution; Save/Update press haptic remains.  |
| Quick expense sheet    | `src/components/QuickExpenseSheet.tsx`      | Local expense write fails                   | `error()`           | removed     | Removed from create/update local write rejection; Save/Update press haptic remains.   |
| Bottom navigation      | `src/components/BottomNav.tsx`              | Center add expense button is clicked        | `impact("medium")`  | implemented | Triggered only for the compact add button that opens the quick expense sheet.         |
| Haptics test page      | `src/app/haptics-test/HapticsTestPanel.tsx` | Manual preset test buttons                  | all generic methods | implemented | Route-only test surface for manually checking supported browser vibration behavior.   |

## Rules

- Haptics must supplement visible UI feedback.
- Do not add haptics to every button or every tap.
- Async result haptics fire when the result state is visible.
- Selection haptics are for discrete value changes only.
- Update this file whenever a call site is implemented, deferred, removed, or retuned.
