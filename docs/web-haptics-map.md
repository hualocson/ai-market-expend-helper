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

| Area                   | File                                      | Interaction                                 | Haptic method     | Status  | Notes                                                                               |
| ---------------------- | ----------------------------------------- | ------------------------------------------- | ----------------- | ------- | ----------------------------------------------------------------------------------- |
| Manual expense form    | `src/components/ManualExpenseForm.tsx`    | Submit succeeds and success toast appears   | `success()`       | planned | Trigger after the create or caller-owned submit promise resolves.                   |
| Manual expense form    | `src/components/ManualExpenseForm.tsx`    | Submit fails and error toast appears        | `error()`         | planned | Trigger in the same catch path that shows the error toast.                          |
| Manual expense form    | `src/components/ManualExpenseForm.tsx`    | Quick/advanced mode changes                 | `selection()`     | planned | Trigger only when the mode actually changes.                                        |
| AI expense chat        | `src/components/AIExpenseChat.tsx`        | Parse returns a full expense result         | `success()`       | planned | Trigger when the assistant success bubble replaces pending state.                   |
| AI expense chat        | `src/components/AIExpenseChat.tsx`        | Parse returns fallback prefill              | `warning()`       | planned | Fallback is not a hard error, but it needs user attention.                          |
| AI expense chat        | `src/components/AIExpenseChat.tsx`        | Parse request fails                         | `error()`         | planned | Trigger when the visible error assistant message is set.                            |
| Budget picker          | `src/components/BudgetPickerSheet.tsx`    | Budget row or no-budget row is selected     | `selection()`     | planned | Trigger before or alongside closing the sheet.                                      |
| Budget transfer drawer | `src/components/BudgetTransferDrawer.tsx` | Transfer succeeds and success toast appears | `success()`       | planned | Trigger after mutation resolves.                                                    |
| Budget transfer drawer | `src/components/BudgetTransferDrawer.tsx` | Transfer fails and error toast appears      | `error()`         | planned | Trigger in the same catch path as the error toast.                                  |
| Pull to refresh        | `src/components/PullToRefresh.tsx`        | Pull crosses the refresh threshold          | `impact("light")` | planned | Trigger once per gesture when the threshold is first crossed, not every move event. |

## Rules

- Haptics must supplement visible UI feedback.
- Do not add haptics to every button or every tap.
- Async result haptics fire when the result state is visible.
- Selection haptics are for discrete value changes only.
- Update this file whenever a call site is implemented, deferred, removed, or retuned.
