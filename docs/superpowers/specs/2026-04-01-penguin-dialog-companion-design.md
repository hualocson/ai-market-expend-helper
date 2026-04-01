# Penguin Dialog Companion Design

- Date: 2026-04-01
- Product: Spendly
- Status: Approved for planning

## 1. Objective

Introduce a contextual penguin companion in Sheet/Drawer workflows so users see:

1. `idle` pose while dialog is open
2. `success` pose immediately after a successful save
3. automatic return to `idle` after 1.5 seconds

The companion is supportive UI feedback and must not replace existing save confirmations.

## 2. Context and Existing Signals

Spendly is a mobile-first AI expense tracker with strong budget pacing language and stateful guidance.

- Product metadata: AI expense tracker
- Budget states: `On track`, `Near limit`, `Over budget`
- Daily pacing states: `On pace`, `Over pace`
- Current visual language: dark surfaces, lime accents, rounded cards, subtle motion

This design keeps that tone and replaces orb-style companion visuals with a penguin character.

## 3. Scope

### In scope (v1)

- Reusable dialog companion system for `Sheet` and `Drawer`
- Two poses only: `idle` and `success`
- Trigger success pose only on successful save actions
- Success pose hold duration: 1500ms
- Integrate with save-capable dialog surfaces in the current codebase

### Out of scope (v1)

- Global always-visible mascot
- Extra states (`warning`, `error`, `offline`, `processing`)
- Full character animation system beyond minimal pose transitions
- Replacing toasts or existing textual feedback

## 4. UX Behavior Contract

1. Opening a Sheet/Drawer renders penguin in `idle` pose.
2. Submitting data keeps penguin in `idle` for v1.
3. When a save action succeeds, pose switches to `success`.
4. `success` pose is visible for exactly 1500ms.
5. After 1500ms, pose returns to `idle`.
6. If dialog closes before timer ends, timer is cleared and state resets.
7. If multiple successful saves happen quickly, the latest success restarts the 1500ms timer.

## 5. Component and State Architecture

### 5.1 New UI primitives

1. `PenguinCompanion`
- Presentational component that renders `idle` or `success` pose
- Receives `pose` prop (`idle | success`)
- Decorative by default (`aria-hidden="true"`)

2. `DialogCompanionSlot`
- Layout wrapper for stable placement inside dialog headers
- Fixed footprint to prevent layout shift on pose change
- Shared styling for both Sheet and Drawer surfaces

### 5.2 New state hook

`useDialogCompanionState`

- Exposes:
  - `pose`
  - `showSuccess()`
  - `reset()`
- Internal timer:
  - starts at `showSuccess()`
  - auto-reset to `idle` after 1500ms
  - clears on unmount/reset

### 5.3 State machine

- Initial: `idle`
- Event `SAVE_SUCCESS` -> `success`
- After 1500ms -> `idle`
- Event `DIALOG_CLOSE` -> `idle` + clear timer

## 6. Integration Map (Current Codebase)

### Primary save-capable dialog surfaces

1. `ExpenseEntryDrawer` sheet
- File: `src/components/ExpenseEntryDrawer.tsx`
- Current behavior: closes immediately via `onSuccess={() => handleOpenChange(false)}`
- Change: trigger `success` pose first, then close after 1500ms

2. `ExpenseListItem` edit sheet
- File: `src/components/ExpenseListItem.tsx`
- Current behavior: closes immediately via `onSuccess={() => setEditOpen(false)}`
- Change: trigger `success`, delay close by 1500ms

3. `BudgetWeeklyBudgetsClient` create/edit drawer
- File: `src/components/BudgetWeeklyBudgetsClient.tsx`
- Current behavior: after save mutation and cache invalidation, closes via `setSheetOpen(false)`
- Change: trigger `success`, then close after 1500ms

4. `BudgetWeeklyTransactionsClient` assign drawer
- File: `src/components/BudgetWeeklyTransactionsClient.tsx`
- Current behavior: after assign/unassign success, closes via `setAssignOpen(false)`
- Change: trigger `success`, then close after 1500ms

### Excluded dialog for v1

- Destructive confirmation dialogs (delete confirms) remain unchanged for this phase.

## 7. Visual and Motion Spec

### 7.1 Visual direction

- Mascot: penguin only (no orb)
- Style: minimal, rounded, compact, UI-native
- Tone: calm in `idle`, affirmative in `success`

### 7.2 Motion

- Idle: very subtle breathing movement allowed
- Success: quick pop + settle transition (220-300ms), then hold until timer completes
- Must respect `prefers-reduced-motion`: instant pose switch, no movement animations

### 7.3 Placement

- Place companion in header zone of Sheet/Drawer content
- Keep a consistent position across all integrated dialogs
- Use fixed size container to avoid content jump

## 8. Accessibility and Feedback

1. Companion remains decorative (`aria-hidden="true"`).
2. Existing success toasts/messages remain the primary semantic feedback.
3. Success meaning is not conveyed by color alone.
4. Keyboard/focus flow in dialogs must remain unchanged.

## 9. Error Handling

1. Failed saves do not trigger `success` pose.
2. On failed save, companion remains `idle`.
3. Timer cleanup is guaranteed on dialog close and component unmount.
4. Rapid successive success events restart the success timer deterministically.

## 10. Testing Strategy

### Unit tests

1. Hook tests for `useDialogCompanionState`
- initial `idle`
- `showSuccess()` transitions to `success`
- auto-return after 1500ms
- timer restart behavior
- cleanup on reset/unmount

2. Component tests for `PenguinCompanion`
- pose rendering for `idle` and `success`
- reduced-motion behavior (if implemented at component level)

### Integration tests (targeted)

1. `ExpenseEntryDrawer`
- open dialog -> idle visible
- submit success -> success visible
- after 1500ms -> dialog closes / idle reset next open

2. `ExpenseListItem` edit sheet
- same flow as above

3. `BudgetWeeklyBudgetsClient` drawer save
- success pose appears before close

4. `BudgetWeeklyTransactionsClient` assign drawer
- success pose appears before close

### Manual checks

1. Mobile viewport and desktop viewport parity
2. No layout shift in headers
3. `prefers-reduced-motion` verification
4. No regression to submit/close logic

## 11. Risks and Mitigations

1. Risk: delayed close could feel slow for power users
- Mitigation: keep delay fixed at 1.5s only for success, not for errors

2. Risk: inconsistent placement between dialogs
- Mitigation: centralize through `DialogCompanionSlot`

3. Risk: timer leaks on unmount
- Mitigation: hook-level cleanup and test coverage

## 12. Acceptance Criteria

1. Every in-scope Sheet/Drawer displays penguin `idle` while open.
2. Successful save always triggers visible `success` pose.
3. `success` pose lasts 1.5 seconds then resets.
4. No orb visuals are used.
5. Existing save feedback (toast/text) remains intact.
6. Reduced-motion users receive non-animated pose changes.

## 13. Planning Handoff

This spec is ready for implementation planning.
The next step is a task-level execution plan covering:

1. component/hook creation
2. phased integration by dialog
3. targeted tests and verification commands
