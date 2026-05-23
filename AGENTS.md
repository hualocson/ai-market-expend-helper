# AGENTS Notes

- Before editing, read the relevant project rules in `.agents/rules/`.
- For app-owned data reads/writes, do not add or use Server Actions. Use REST API routes plus TanStack Query query factories and mutation hooks.
- Do not run `npm run build` to validate each individual code change.
- Use targeted checks relevant to the modified scope instead.
