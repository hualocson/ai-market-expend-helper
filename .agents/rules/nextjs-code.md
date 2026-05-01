# Next.js Code Rules

Rules every agent **must** follow when creating or editing code in this repo.

Stack: Next.js 15 (App Router) · React 19 · Drizzle ORM · TanStack Query · Zustand · Tailwind v4 · shadcn/ui · Vitest.

---

## 1. Server vs Client Components

- **Default to Server Components.** Only add `"use client"` when the file uses `useState`, `useEffect`, refs, browser APIs, or event handlers.
- A `"use client"` directive must be the **first line** of the file. Never put it mid-file.
- Split aggressively: keep the data-fetching parent on the server and push interactivity to a small leaf client component.
- Never pass non-serializable values (functions, class instances, Dates with methods called) from Server → Client. Pass primitives or plain objects.

## 2. Data Fetching

- **Reads from the database go in Server Components or Server Actions** using Drizzle (`src/db`). Never call Drizzle from a client component.
- Use **TanStack Query only for client-side caches** of mutable, user-driven data. Do not duplicate a server-rendered fetch into a `useQuery`.
- Mutations: prefer **Server Actions** (`"use server"`) over hand-rolled `app/api/*/route.ts` unless the endpoint must be consumed by something other than this app.
- Always validate Server Action / route handler input with Zod (or equivalent) before touching the DB.

## 3. Routing & File Conventions

- Use the existing `src/app` structure. Keep route-specific UI co-located in the route folder.
- One responsibility per file:
  - `page.tsx` — route UI only
  - `layout.tsx` — shared shell
  - `loading.tsx` — Suspense fallback (add when a route does data fetching)
  - `error.tsx` — error boundary (must be a client component)
  - `not-found.tsx` — 404
- Route groups `(name)` for organization. Never use them just to silence a lint warning.

## 4. Components

- Reusable UI lives in `src/components/`. Route-specific UI stays beside its `page.tsx`.
- shadcn primitives go in `src/components/ui/` — do not modify generated primitives unless you need a project-wide change; wrap them instead.
- Every interactive component needs sensible `disabled` / `loading` / `error` states.
- Forms: use `useActionState` (React 19) with a Server Action. Avoid building bespoke fetch-and-setState form handlers.

## 5. State Management

- **Server state** → TanStack Query.
- **Global client state** → Zustand store in `src/stores/`. Don't lift a `useState` into Zustand unless 3+ unrelated components need it.
- **Local UI state** → `useState` / `useReducer` in the leaf component.
- Never store derived data in Zustand — derive on read.

## 6. Styling

- Tailwind v4 utility classes only. No CSS modules, no inline `style={{...}}` unless the value is dynamic and cannot be expressed in classes.
- Use `cn()` from `src/lib/utils` to compose classes; do not concatenate with template strings.
- Respect existing design tokens in `design-system/` and `src/configs/`. Don't introduce new color/spacing values without a token.

## 7. Performance

- `next/image` for every `<img>`. Set `priority` on above-the-fold images. Provide `sizes` for responsive images.
- Heavy client-only libs (charts, editors, drawers) → `dynamic(() => import(...), { ssr: false })`.
- No barrel exports (`index.ts` re-exporting many modules) on the client side — they defeat tree-shaking.

## 8. API & Server Actions

- Route handlers (`app/api/.../route.ts`) only when an external caller needs the endpoint. Otherwise use a Server Action.
- Always return typed responses; never `any`.
- Status codes: 200 OK, 201 Created, 400 validation, 401 unauth, 404 missing, 409 conflict, 500 unexpected.
- Call `revalidatePath` / `revalidateTag` after writes — never rely on the user reloading.

## 9. Caching

- Static by default. Opt into dynamic only with intent: `export const dynamic = 'force-dynamic'` or `fetch(..., { cache: 'no-store' })`.
- Tag fetches that mutations need to invalidate: `fetch(url, { next: { tags: ['expenses'] } })`.

## 10. TypeScript

- No `any`. Use `unknown` and narrow.
- Prefer `type` for unions/aliases, `interface` for object shapes that may be extended.
- Drizzle inferred types (`InferSelectModel`, `InferInsertModel`) over hand-written DB types.
- Export only what's used outside the file.

## 11. Testing

- Unit tests next to the file (`foo.test.ts`) or in `src/test/`. Run with `bun run test` (or `npm run test`).
- Test behavior, not implementation. No snapshot tests for dynamic UI.

## 12. Validation Before Claiming Done

- **Do not run `npm run build` to validate individual edits** (per `AGENTS.md`).
- Use targeted checks: `tsc --noEmit` on touched files, `vitest run <pattern>`, or open the dev server (`bun run dev`) for UI changes.
- Lint: `eslint <files>` for the modified scope.

## 13. Anti-Patterns (Do Not Do)

| ❌ Don't | ✅ Do |
|---------|------|
| `"use client"` at the top of every file | Server by default, client only at leaves |
| `useEffect` to fetch on mount | Server Component fetch or TanStack Query |
| Drizzle calls in client components | Server Action or Server Component |
| Duplicate Zustand + useQuery for the same data | Pick one source of truth |
| Hardcoded colors / spacing | Design tokens from `design-system/` |
| `any` to silence TS | Narrow with `unknown` + type guards |
| Comments explaining what code does | Self-documenting names; comment only non-obvious *why* |
| New `app/api/*` routes for internal calls | Server Action |
| Editing shadcn primitives in place | Wrap and extend |
| Skipping `revalidatePath` after a mutation | Always revalidate the affected path/tag |

## 14. When Unsure

1. Read neighboring files in the same route/folder — match their patterns.
2. Check `src/components/ui/` for an existing primitive before building a new one.
3. Ask before introducing a new dependency, a new top-level folder, or a new state-management pattern.
