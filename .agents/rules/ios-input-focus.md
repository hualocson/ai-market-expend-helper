# iOS Input Focus Rules

- On iOS Safari/WebKit, tapping non-text controls while an amount, note, search, or similar text input is focused can blur the input and dismiss the software keyboard before the control action completes.
- For inline action controls that should work while preserving the active text input, cancel the pointer-down default action with `onPointerDown={(event) => event.preventDefault()}` and keep the command in `onClick` unless the interaction requires custom pointer handling.
- Apply this narrowly to controls that are part of the active input workflow, such as suggestion chips and category chips. Do not add it globally to every button because normal focus behavior, form controls, and accessibility interactions may depend on default pointer handling.
