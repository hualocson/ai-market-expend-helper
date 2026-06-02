# AGENTS Notes

- Before editing, read the relevant project rules in `.agents/rules/`.
- Branch names must always start with the `dev-` prefix (e.g. `dev-polish-budgets-page`). When creating a new branch off `main`, use this prefix.
- Before changing optimistic mutations, background submits, persisted recovery state, or mutation lifecycle ownership, read `LEARNINGS.md`.
- For app-owned data reads/writes, do not add or use Server Actions. Use REST API routes plus TanStack Query query factories and mutation hooks.
- The project is dark-mode only. Do not add light-mode support, theme switching, or persisted theme selection unless explicitly requested.
- Prioritize UI design, layout, and interaction quality for mobile iPhone 13/14 viewports. Desktop views only need to remain functional and coherent; do not spend extra effort optimizing desktop unless explicitly requested.
- For UI icons and visual symbols, prefer an existing `lucide-react` icon instead of raw text or Unicode symbols when a suitable icon exists.
- For Vietnamese dong currency labels, use `src/components/VndSymbol.tsx` instead of raw `VND`, `đ`, or similar text/symbols.
- Do not run `npm run build` to validate each individual code change.
- Use targeted checks relevant to the modified scope instead.
- Before pushing changes to GitHub, run `npm run build`.
- Use `npm` only for `npm run build`; use `bun` or `bunx` for all other package commands.
- After editing any `.ts` or `.tsx` file, always run formatter and ESLint checks for the modified file scope:
  - Format: `rtk bunx prettier --write <modified-files>`
  - Check formatting: `rtk bunx prettier --check <modified-files>`
  - ESLint: `rtk bunx eslint <modified-files>`
