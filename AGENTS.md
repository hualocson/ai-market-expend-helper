# AGENTS Notes

- Before editing, read the relevant project rules in `.agents/rules/`.
- Before changing optimistic mutations, background submits, persisted recovery state, or mutation lifecycle ownership, read `LEARNINGS.md`.
- For app-owned data reads/writes, do not add or use Server Actions. Use REST API routes plus TanStack Query query factories and mutation hooks.
- Do not run `npm run build` to validate each individual code change.
- Use targeted checks relevant to the modified scope instead.
- After editing any `.ts` or `.tsx` file, always run formatter and ESLint checks for the modified file scope:
  - Format: `rtk bunx prettier --write <modified-files>`
  - Check formatting: `rtk bunx prettier --check <modified-files>`
  - ESLint: `rtk bunx eslint <modified-files>`
