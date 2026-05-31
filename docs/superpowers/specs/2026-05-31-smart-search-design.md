# Smart Search — Design Spec

**Date:** 2026-05-31
**Status:** Approved (pending implementation plan)
**Feature:** Natural-language search that filters the existing expense list, e.g. `"find all coffee expenses this month without budget"`.

---

## 1. Summary

Add a natural-language search to the home expense list. The user types a free-form query; an LLM (via the existing OpenRouter pipeline) translates it into a **structured, editable filter**; that filter drives the existing infinite expense-list query. The AI is an enhancement layer — the underlying search is a structured filter the user can see and correct.

**This is not GraphQL and adds no new dependency.** It reuses the existing `callOpenRouterJson` engine (`src/lib/ai/core/openrouter.ts`) plus new predicates on the existing expense-list query.

### Scope of effort

Roughly **70% backend filter extension, 30% AI/UI**. The OpenRouter engine already exists; the real work is extending the expense-list query with new predicates and building the search UI.

---

## 2. Decisions (locked during brainstorming)

| # | Decision | Choice |
|---|---|---|
| 1 | Surface | Filters the **existing home list** in place (not a separate search screen). |
| 2 | Flow | **Two-step**: NL → validated filter → editable chips → applied to list. |
| 3 | Time/amount scope | **Full date range + amount range** (`dateFrom`/`dateTo`, `amountMin`/`amountMax`). |
| 4 | Categories | **Multiple** categories. |
| 5 | Budget filtering | Filter by budget; user references **budget names** in NL, LLM resolves to **`budgetIds`** (parse-expense pattern). |
| 6 | Parse failure | **Graceful fallback** to plain text search (`q` = raw input). |
| 7 | Offline | **Disable search** entirely (no offline AI; no offline text-search path). |
| 8 | Filter state | **Local `useState`** in a new home-page wrapper component; passed to `ExpenseList` as props. |
| 9 | Engine | Reuse `callOpenRouterJson` + `json_schema` response format + Zod validation + free-model fallback chain. |

### Notable simplification

Because time uses explicit `dateFrom`/`dateTo`, the search DSL **drops `month`/`recentDays`** — the LLM resolves "this month" / "April" / "yesterday" to a concrete date range. One time mechanism instead of three. The existing default list (no params) is unchanged; only the search path uses the new range.

---

## 3. Architecture

```
src/app/page.tsx
  └─ <ExpenseSearch>                    [NEW] client wrapper, owns filter state (useState)
       ├─ <SearchInput>                 [NEW] text field + submit; disabled offline
       ├─ <SearchFilterChips>           [NEW] editable/removable chips for active filter
       └─ <ExpenseList {...filter} />   [EXTEND] already accepts param props
```

```
search input ─submit─▶ POST /api/ai/parse-search ─▶ callOpenRouterJson + Zod DSL
   ▲                                                   │
   │ disabled offline                                  ▼  SearchFilter
   │                                   { dateFrom?, dateTo?, categories[]?,
chips (editable) ◀── render ───────────  budgetIds[]?, hasBudget?, amountMin?, amountMax?, q? }
   │                                                   │
   └─ feed filter ──▶ ExpenseList (extended params) ──▶ GET /api/expenses ──▶ extended Drizzle where
```

Each unit has one responsibility and is testable in isolation:
- `parse-search.ts` — NL → filter only.
- translator + `getExpenseList` — filter → rows only.
- `ExpenseSearch` — state ownership + wiring only.

### New files
- `src/lib/ai/search-contract.ts` — Zod DSL, request/response types, json_schema.
- `src/lib/ai/parse-search.ts` — system prompt + `callOpenRouterJson`.
- `src/app/api/ai/parse-search/route.ts` — clone of `parse-expense/route.ts` shape.
- `src/lib/mutations/use-parse-search.ts` — mutation hook (component → route).
- `src/components/ExpenseSearch.tsx`, `SearchInput.tsx`, `SearchFilterChips.tsx`.

### Extended files
- `src/lib/expenses/list-model.ts` — extend `ExpenseListQueryParams`.
- `src/lib/services/expenses.ts` — new predicates in the `where`.
- `src/lib/api/read-route-params.ts` — parse new query params.
- `src/components/ExpenseList.tsx` — accept + forward new params.

---

## 4. The Filter DSL contract

One schema agreed by three layers (LLM output, route input, query translator):

```ts
SearchFilter = {
  dateFrom?: string       // YYYY-MM-DD — LLM resolves "this month"/"April"/"yesterday"
  dateTo?:   string       // YYYY-MM-DD
  categories?: Category[]  // inArray(expenses.category, …)
  budgetIds?:  number[]    // inArray(expenseBudgets.budgetId, …) — names→ids by LLM
  hasBudget?:  boolean     // isNull / isNotNull(expenseBudgets.budgetId)
  amountMin?:  number      // gte(expenses.amount, …)  VND; expands "50k"→50000
  amountMax?:  number      // lte(expenses.amount, …)
  q?:          string      // leftover free text → existing unaccent full-text search
}
```

**Request to `/api/ai/parse-search`** (mirrors `parse-expense` so the model can resolve budget names):
```ts
{ input: string, todayMonth: string /* YYYY-MM */, budgets: { id, name, category }[] }
```

**Response:**
```ts
| { status: "success",  originalInput, filter: SearchFilter }
| { status: "fallback", originalInput, reason, prefill: { q?: string } }
```

### Resolution & collision rules (enforced in prompt + translator, not the schema)
- `budgetIds` **wins over** `hasBudget` — can't be "no budget" and "these budgets" at once.
- LLM picks `budgetIds` only from the provided budget list; never invents ids. Translator guards with an allowed-id set (drops unknown ids).
- **Budget-name-first disambiguation:** a noun like "coffee" matches a budget before a category (the `Category` enum is coarse — `Food`, `Entertainment`, … — with no "Coffee").
- Vietnamese with/without diacritics and common shorthand (cf = coffee, xang = fuel) — reuse parse-expense prompt wording.
- Empty filter `{}` = show all (valid).
- `q` carries only the **unmatched remainder**, so it doesn't double-filter what chips already cover.

---

## 5. Data flow & states

**Happy path (online):**
1. User submits `"coffee this month without budget"`.
2. `ExpenseSearch` → `useParseSearch` → `POST /api/ai/parse-search` with `{ input, todayMonth, budgets }`.
3. Route validates (Zod), calls `parseSearchWithOpenRouter` → `callOpenRouterJson` with the DSL json_schema + free-model fallback.
4. Returns `{ status: "success", filter }`; `setFilter(filter)`.
5. Chips render from `filter`; `ExpenseList` gets the filter as props → new query key → infinite query refetches `GET /api/expenses?dateFrom=…&categories=…&hasBudget=false`.

**Chip editing:** removing/toggling a chip mutates local `filter` → list refetches. No AI. This is the correction path.

**Loading:** input spinner while parsing (free models 1–4s); list keeps prior results until the new filter resolves.

**Empty result:** valid parse, zero rows → existing `"No expenses match your search."` empty state.

**Clear:** resets `filter` to `{}` → default list.

---

## 6. Backend query extension

Predicates appended to `getExpenseList`'s existing `whereParts` (after `isDeleted = false`):

| Filter field | Drizzle predicate |
|---|---|
| `dateFrom`/`dateTo` | `gte(expenses.date, dateFrom)`, `lte(expenses.date, dateTo)` — **replaces** `month`/`recentDays` range when present |
| `categories` | `inArray(expenses.category, categories)` |
| `budgetIds` | `inArray(expenseBudgets.budgetId, budgetIds)` |
| `hasBudget === false` | `isNull(expenseBudgets.budgetId)` |
| `hasBudget === true` | `isNotNull(expenseBudgets.budgetId)` |
| `amountMin`/`amountMax` | `gte` / `lte` on `expenses.amount` |
| `q` | unchanged — existing unaccent full-text search |

- **Precedence:** if `dateFrom`/`dateTo` present → use them; else keep current `month`/`recentDays` behavior (backward compatible).
- `budgetIds` ignores `hasBudget` if both arrive.
- Pagination/grouping untouched — only `where` conditions added.
- `read-route-params.ts` validates each new param (date format, positive ints, enum membership) and rejects bad input with existing `INVALID_PARAMS`.

---

## 7. Error handling & offline

- **Offline** (`navigator.onLine` false): `SearchInput` disabled, hint "Search needs a connection." No request fires.
- **AI parse failure** (network/garbled/schema mismatch): `callOpenRouterJson` → `{ ok: false }` → route returns `{ status: "fallback", prefill: { q: rawInput } }` → `setFilter({ q: rawInput })` → plain unaccent text search. Never a dead end.
- **Partial parse:** validated fields applied; unfilled stay undefined. A `[text: "…"]` chip signals a raw-text fallback.
- **Invalid budget id from LLM:** translator drops ids not in the allowed set.
- **Empty input:** submit is a no-op.

---

## 8. Testing

Per `.agents/rules/tanstack-query.md` §8 and existing `parse-expense` tests:

- **`search-contract.test.ts`** — valid/invalid filter parsing, collision normalization.
- **`parse-search.test.ts`** — mock `fetchFn`; success, fallback reasons, invalid-budget-id guard, name→id resolution.
- **`route.test.ts`** — payload validation, success + fallback shapes, missing API key.
- **`expenses.test.ts` (extend)** — each new predicate, date range overrides month, `budgetIds` beats `hasBudget`, combined filters.
- **`read-route-params`** — new param parsing + rejection of bad values.
- **Mutation hook** — calls route, surfaces fallback.
- **`ExpenseSearch`** — real `QueryClientProvider`, seeded; submit→chips→list params, chip removal, offline-disabled, fallback chip. Apply `ios-input-focus` rule for chip pointer handling; `make-interfaces-feel-better` for chip polish.

---

## 9. Out of scope (YAGNI / deferred)

- Separate search screen / route.
- Offline AI or offline text-search.
- Saved searches / search history.
- Sorting controls ("biggest first") — order stays `date desc`.
- Global/persisted filter state (Zustand, URL) — local state is sufficient for a home-page filter.

---

## 10. Key files referenced

- Engine: `src/lib/ai/core/openrouter.ts` (`callOpenRouterJson`)
- Pattern precedent: `src/lib/ai/parse-expense.ts`, `parse-expense-contract.ts`, `src/app/api/ai/parse-expense/route.ts`
- Query to extend: `src/lib/services/expenses.ts` (`getExpenseList`), `src/lib/expenses/list-model.ts`, `src/lib/api/read-route-params.ts`
- List UI: `src/components/ExpenseList.tsx` (already accepts param props), `src/app/page.tsx`
- Enum: `src/enums/index.ts` (`Category`)
