# Add New Category - TODO

- [ ] Pick the new category label (display string), icon, and color treatment to match the existing chips + icons.
- [ ] Add the new value to `Category` in `src/enums/index.ts` in the desired order (drives UI order).
- [ ] Update `src/components/ExpenseItemIcon.tsx` with a new `case` for the category, including icon + color class.
- [ ] Ensure the manual form shows it (uses `Object.values(Category)` in `src/components/ManualExpenseForm.tsx`).
- [ ] Verify any existing data/UX flows still render (expense list, edit drawer, report chart) with the new category string.
- [ ] Add new color variable for category to `global.css`

## Rules

- Use oklch color format in tailwind v4
- Only follow task list
- Write short summary and test task after done