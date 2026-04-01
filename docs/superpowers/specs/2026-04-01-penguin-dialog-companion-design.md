# Penguin Dialog Companion Design (Current State)

- Date: 2026-04-01
- Product: Spendly
- Status: Updated to match current implementation

## 1. Objective

Document the current mascot behavior in dialog surfaces.

Current behavior:

1. Show a penguin companion in `idle` state only.
2. Use existing `IdleMascot` component for rendering.
3. Keep mascot decorative and consistent across Sheet/Drawer layouts.

## 2. Source of Truth

The mascot display component is:

- `src/components/mascots/IdleMascot.tsx`

This spec treats `IdleMascot` as the only approved mascot renderer for now.

## 3. Scope

### In scope (current)

- Display `IdleMascot` in dialog contexts (`Sheet`/`Drawer`) where companion is shown.
- Keep one static pose (`idle`).
- Ensure layout remains stable and mobile-friendly.
- Preserve existing save flow behavior (no delay added for mascot transitions).

### Out of scope (future phase)

- Success pose/state switching.
- Timed pose transitions (for example 1.5s success hold).
- Additional states (`warning`, `error`, `offline`, `processing`).
- Replacing toasts or other textual feedback.

## 4. UX Behavior Contract (Current)

1. When companion is visible in a dialog, it is always `idle`.
2. Save success does not change mascot pose in current phase.
3. Closing/reopening dialog shows the same `idle` mascot.
4. Mascot remains supplementary visual feedback, not semantic status.

## 5. Component Architecture

### 5.1 Mascot component

`IdleMascot`

- Path: `src/components/mascots/IdleMascot.tsx`
- Type: SVG React component (`SVGProps<SVGSVGElement>`)
- Responsibility: render the static penguin visual

### 5.2 Companion slot wrapper (recommended)

`DialogCompanionSlot` (optional wrapper, if not already added)

- Provides consistent size, alignment, and spacing in headers
- Prevents content shift
- Keeps companion usage uniform across Sheet/Drawer surfaces

## 6. Integration Map (Current Codebase)

Primary dialog surfaces where idle companion may be shown:

1. `src/components/ExpenseEntryDrawer.tsx`
2. `src/components/ExpenseListItem.tsx` (edit sheet)
3. `src/components/BudgetWeeklyBudgetsClient.tsx` (create/edit drawer)
4. `src/components/BudgetWeeklyTransactionsClient.tsx` (assign drawer)

All in-scope integrations should use `IdleMascot` directly or through a shared companion slot wrapper.

## 7. Visual and Motion Spec (Current)

### 7.1 Visual direction

- Mascot: penguin only (no orb)
- Component: `IdleMascot`
- Style: minimal, rounded, UI-native, aligned with Spendly dark/lime surfaces

### 7.2 Motion

- No state-driven animation required in this phase.
- If any ambient animation is applied externally, it must remain subtle and respect `prefers-reduced-motion`.

### 7.3 Placement

- Place mascot in a consistent header companion area inside Sheet/Drawer content.
- Use fixed frame size to avoid layout shift.

## 8. Accessibility and Feedback

1. Mascot is decorative (`aria-hidden="true"`).
2. Existing success/error toasts remain primary semantic feedback.
3. Do not rely on mascot for critical state communication.

## 9. Testing Strategy (Current)

### Component checks

1. `IdleMascot` renders without runtime errors.
2. Sizing via props works in dialog container constraints.

### Integration checks

1. Companion appears in intended Sheet/Drawer surfaces.
2. Save actions do not break or delay due to mascot rendering.
3. Dialog open/close cycles keep mascot stable.

### Manual checks

1. Mobile viewport layout remains clean.
2. No overlap with dialog controls/title/actions.
3. No orb visuals appear in companion placements.

## 10. Risks and Mitigations

1. Risk: inconsistent mascot placement across dialogs
- Mitigation: use a shared slot wrapper and shared size tokens

2. Risk: future success-state rollout conflicting with static baseline
- Mitigation: keep this spec as baseline and create a separate phase-2 extension spec

## 11. Acceptance Criteria (Current)

1. Companion rendering uses `IdleMascot` component.
2. Only idle pose is displayed.
3. No success-pose switching behavior exists in this phase.
4. Save flows and toast behavior remain unchanged.
5. No orb visuals are used where mascot companion is rendered.

## 12. Next Phase Note

When you are ready for action-reactive mascot behavior, create phase 2 on top of this baseline:

1. add `success` pose asset/component
2. define transition timing
3. wire save-success state changes
4. add targeted interaction tests
