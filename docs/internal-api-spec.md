# Internal API Spec

This document describes all current internal APIs under `/api/internal/*`.

## Environment

- Required server env var: `INTERNAL_API_TOKEN`
- If `INTERNAL_API_TOKEN` is missing, internal APIs return:
  - `500 { "error": "INTERNAL_API_TOKEN is not configured" }`

## Authentication

Every internal endpoint requires one of:

1. `x-internal-token: <INTERNAL_API_TOKEN>`
2. `Authorization: Bearer <INTERNAL_API_TOKEN>`

If token is missing or invalid:

- `401 { "error": "Missing internal token" }`
- `401 { "error": "Invalid internal token" }`

## Response Format

Internal APIs intentionally return raw domain payloads on success and `{ "error": string }` on failure. They do not use the app-owned public API response envelope.

## Reference Data: Category and PaidBy

Source of truth: `src/enums/index.ts`.

### Category list

Current canonical category values:

- `Food`
- `Shopping`
- `Housing`
- `Transport`
- `Badminton`
- `Entertainment`
- `Giving`
- `Other`

Notes:

- Transaction endpoints validate `category` as a free `string` (any non-empty value). Sending a canonical value above is recommended for consistent UI/reporting.
- Budget endpoints validate `category` strictly against the canonical list above (enum); an unlisted value returns `400 { "error": "Invalid payload" }`. Budget `category` defaults to `Other` when omitted on create.

### PaidBy list

Current allowed paidBy values:

- `Cubi`
- `Embe`
- `Other`

Notes:

- Internal API strictly validates `paidBy` against this list.

## Reference Data: Budget Period

Source of truth: `src/types/budget-weekly.ts`.

Allowed `period` values:

- `week`
- `month`
- `custom`

## Reference Data: Budget Appearance

Source of truth: `src/lib/budget-appearance.ts`.

Every budget item includes visual appearance fields:

- `icon` (string): emoji/text icon used for budget badges
- `color` (enum): fixed palette id used for budget badges

Allowed `color` values:

- `lime`
- `sky`
- `violet`
- `rose`
- `amber`
- `emerald`
- `cyan`
- `fuchsia`
- `orange`
- `teal`
- `indigo`
- `slate`

Defaults:

- `icon`: `💰`
- `color`: `lime`

Validation:

- `icon` must be a non-empty trimmed string with a maximum length of 8 JavaScript string code units.
- `color` must be one of the allowed palette ids.
- Budget create requests may omit `icon` and `color`; the route applies the defaults above.
- Budget update requests may include either field.

## Reference Data: Transaction Row

Source of truth: `expenses` table in `src/db/schema.ts`.

Create / update / delete transaction endpoints return the raw `expenses` row:

```json
{
  "id": 101,
  "clientId": null,
  "date": "2026-03-07",
  "amount": 120000,
  "note": "Lunch",
  "category": "Food",
  "paidBy": "Cubi",
  "createdAt": "2026-03-07T03:11:00.000Z",
  "updatedAt": "2026-03-07T03:11:00.000Z",
  "isDeleted": false,
  "deletedAt": null
}
```

Notes:

- The returned row does **not** include `budgetId`. Budget linkage is stored in a separate relation; send `budgetId` on create/update to set it, `null` to clear it.
- `date` is returned in `YYYY-MM-DD` form (DB `date` column), even though it is **sent** as `DD/MM/YYYY`.
- `clientId` is **always `null`** for rows created through the internal API. It is a web-app-only field (used by the browser's offline sync); internal callers neither send nor receive a meaningful value.

## Reference Data: clientId (web-only)

`clientId` is a browser-generated key used **only** by the web app's offline expense sync engine (`POST /api/expenses/sync`) to de-duplicate retried writes.

- The internal API does **not** need `clientId`. Do not send it. Rows created through the internal API always have `clientId: null`.
- If `clientId` is sent anyway, it is unnecessary on create and ignored on update (the target row is selected solely by the path `:id`).
- The public app endpoints (`POST /api/expenses`, `PATCH /api/expenses/:id`, `DELETE /api/expenses/:id`) share the same domain logic (`createExpense` / `updateExpense` / `softDeleteExpense`). Internal endpoints differ only in token auth, raw (non-enveloped) responses, and that they do not call `revalidatePath`.

## Endpoint: Create Transaction

- Method: `POST`
- Path: `/api/internal/transactions`
- Purpose: create a new transaction (expense)

### Request body

```json
{
  "date": "07/03/2026",
  "amount": 120000,
  "category": "Food",
  "paidBy": "Cubi",
  "note": "Lunch",
  "budgetId": 12
}
```

Fields:

- `date` (required, string): format `DD/MM/YYYY`. Strictly parsed by the service; an unparseable date fails with `Failed to create transaction`.
- `amount` (required, number)
- `category` (required, string): recommended values are listed in `Category list`
- `paidBy` (required, enum): values listed in `PaidBy list`
- `note` (optional, string): defaults to `""`
- `budgetId` (optional, number or null): sets budget linkage; not part of the returned row

Do not send `clientId` — it is web-only (see `clientId (web-only)`) and unnecessary here; internal rows are always created with `clientId: null`.

Unknown fields are ignored. In particular, denormalized budget fields (`budgetName`, `budgetIcon`, `budgetColor`) are accepted but dropped — only `budgetId` drives budget linkage.

### Responses

- `201`: created transaction row (see `Reference Data: Transaction Row`)
- `400 { "error": "Invalid payload" }`: request body shape/type is invalid
- `400 { "error": "Failed to create transaction" }`: failed while creating (includes an unparseable `date`)

### cURL example

```bash
curl -X POST "http://localhost:3000/api/internal/transactions" \
  -H "Content-Type: application/json" \
  -H "x-internal-token: $INTERNAL_API_TOKEN" \
  -d '{
    "date":"07/03/2026",
    "amount":120000,
    "category":"Food",
    "paidBy":"Cubi",
    "note":"Lunch",
    "budgetId":12
  }'
```

## Endpoint: List Transactions

- Method: `GET`
- Path: `/api/internal/transactions`
- Purpose: list transactions with optional date filters and limit

### Query params

- `date` (optional): exact date, format `YYYY-MM-DD`
- `from` (optional): start date (inclusive), format `YYYY-MM-DD`
- `to` (optional): end date (inclusive), format `YYYY-MM-DD`
- `q` (optional): full-text search on transaction `note` and `category`
- `limit` (optional): positive integer
  - default: `100`
  - max: `500` (higher values are clamped to 500)

Rules:

- If both `from` and `to` are provided, `from <= to` is required.
- Soft-deleted rows are excluded (`isDeleted = false`).
- Result order: `date DESC, id DESC`.

### Responses

- `200`: array of transaction rows
- `400 { "error": "Invalid date format for 'date'. Use YYYY-MM-DD" }`
- `400 { "error": "Invalid date format for 'from'. Use YYYY-MM-DD" }`
- `400 { "error": "Invalid date format for 'to'. Use YYYY-MM-DD" }`
- `400 { "error": "'from' must be less than or equal to 'to'" }`
- `400 { "error": "Invalid limit. Use a positive integer." }`
- `400 { "error": "Failed to fetch transactions" }`

### cURL examples

Exact date:

```bash
curl "http://localhost:3000/api/internal/transactions?date=2026-03-07&limit=50" \
  -H "x-internal-token: $INTERNAL_API_TOKEN"
```

Search in date range:

```bash
curl "http://localhost:3000/api/internal/transactions?from=2026-03-01&to=2026-03-07&q=lunch&limit=100" \
  -H "Authorization: Bearer $INTERNAL_API_TOKEN"
```

Date range:

```bash
curl "http://localhost:3000/api/internal/transactions?from=2026-03-01&to=2026-03-07&limit=100" \
  -H "Authorization: Bearer $INTERNAL_API_TOKEN"
```

## Endpoint: Update Transaction

- Method: `PATCH`
- Path: `/api/internal/transactions/:id`
- Purpose: update an existing transaction (expense)

### Path params

- `id` (required, positive integer)

### Request body

```json
{
  "date": "07/03/2026",
  "amount": 150000,
  "category": "Food",
  "paidBy": "Cubi",
  "note": "Dinner",
  "budgetId": 12
}
```

Fields (same schema as create — send the full payload, not a partial patch):

- `date` (required, string): format `DD/MM/YYYY`. Strictly parsed; an unparseable date fails with `Failed to update transaction`.
- `amount` (required, number)
- `category` (required, string): recommended values are listed in `Category list`
- `paidBy` (required, enum): values listed in `PaidBy list`
- `note` (optional, string): defaults to `""`
- `budgetId` (optional, number or null): re-links the budget when present; omit to leave linkage unchanged, send `null` to clear it
- Do not send `clientId` — it is web-only (see `clientId (web-only)`) and ignored on update; the target row is chosen by the path `:id`

### Responses

- `200`: updated transaction row (see `Reference Data: Transaction Row`)
- `400 { "error": "Invalid transaction id" }`
- `400 { "error": "Invalid payload" }`
- `404 { "error": "Expense not found" }`
- `400 { "error": "Failed to update transaction" }` (includes an unparseable `date`)

### cURL example

```bash
curl -X PATCH "http://localhost:3000/api/internal/transactions/12" \
  -H "Content-Type: application/json" \
  -H "x-internal-token: $INTERNAL_API_TOKEN" \
  -d '{
    "date":"07/03/2026",
    "amount":150000,
    "category":"Food",
    "paidBy":"Cubi",
    "note":"Dinner",
    "budgetId":12
  }'
```

## Endpoint: Delete Transaction

- Method: `DELETE`
- Path: `/api/internal/transactions/:id`
- Purpose: soft-delete a transaction (sets `isDeleted = true`)

### Path params

- `id` (required, positive integer)

### Responses

- `200`: deleted transaction row
- `400 { "error": "Invalid transaction id" }`
- `404 { "error": "Expense not found" }`
- `400 { "error": "Failed to delete transaction" }`

### cURL example

```bash
curl -X DELETE "http://localhost:3000/api/internal/transactions/12" \
  -H "x-internal-token: $INTERNAL_API_TOKEN"
```

## Endpoint: List Budgets

- Method: `GET`
- Path: `/api/internal/budgets`
- Purpose: list budgets (overview) or weekly budget report

### Query params

- `weekStart` (optional): format `YYYY-MM-DD`
  - when provided, returns weekly report payload
  - when omitted, returns budget overview payload
- `q` (optional): search query for weekly transactions (used only when `weekStart` is provided)

### Responses

- `200`: budget overview object or weekly budget report object
- `400 { "error": "Failed to fetch budgets" }`

Budget item shape (computed overview/report item — includes `spent`/`remaining`):

```json
{
  "id": 12,
  "name": "Groceries",
  "icon": "🛒",
  "color": "emerald",
  "category": "Food",
  "amount": 2000000,
  "spent": 650000,
  "remaining": 1350000,
  "period": "month",
  "periodStartDate": "2026-03-01",
  "periodEndDate": "2026-03-31"
}
```

Note: this computed item differs from the raw budget row returned by create/update/delete (see `Endpoint: Create Budget`), which carries `createdAt`/`updatedAt` but no `spent`/`remaining`.

### cURL examples

Budget overview:

```bash
curl "http://localhost:3000/api/internal/budgets" \
  -H "x-internal-token: $INTERNAL_API_TOKEN"
```

Weekly report:

```bash
curl "http://localhost:3000/api/internal/budgets?weekStart=2026-03-02&q=food" \
  -H "x-internal-token: $INTERNAL_API_TOKEN"
```

## Endpoint: Create Budget

- Method: `POST`
- Path: `/api/internal/budgets`
- Purpose: create a budget

### Request body

```json
{
  "name": "Groceries",
  "icon": "🛒",
  "color": "emerald",
  "category": "Food",
  "amount": 2000000,
  "period": "month",
  "periodStartDate": "2026-03-01",
  "periodEndDate": null
}
```

Fields:

- `name` (required, string)
- `icon` (optional, string): defaults to `💰`
- `color` (optional, enum): values listed in `Budget Appearance`; defaults to `lime`
- `category` (optional, enum): one of the canonical `Category` values; strictly validated; defaults to `Other`
- `amount` (required, number)
- `period` (required, enum): `week | month | custom`
- `periodStartDate` (required, string): format `YYYY-MM-DD`
- `periodEndDate` (optional, string or null): required logically for `custom`

Period dates are normalized on write (for `week`/`month` the stored range is snapped to the period bounds; a `custom` period requires `periodEndDate`).

### Responses

- `201`: created budget row — the raw `budgets` row, including `category`, `createdAt`, and `updatedAt` (no `spent`/`remaining`)
- `400 { "error": "Invalid payload" }`
- `400 { "error": "Failed to create budget" }`

### cURL example

```bash
curl -X POST "http://localhost:3000/api/internal/budgets" \
  -H "Content-Type: application/json" \
  -H "x-internal-token: $INTERNAL_API_TOKEN" \
  -d '{
    "name":"Groceries",
    "icon":"🛒",
    "color":"emerald",
    "category":"Food",
    "amount":2000000,
    "period":"month",
    "periodStartDate":"2026-03-01"
  }'
```

## Endpoint: Update Budget

- Method: `PATCH`
- Path: `/api/internal/budgets/:id`
- Purpose: update a budget

### Path params

- `id` (required, positive integer)

### Request body

Any subset of:

- `name` (string)
- `icon` (string)
- `color` (`lime | sky | violet | rose | amber | emerald | cyan | fuchsia | orange | teal | indigo | slate`)
- `category` (enum): one of the canonical `Category` values; strictly validated
- `amount` (number)
- `period` (`week | month | custom`)
- `periodStartDate` (string, `YYYY-MM-DD`)
- `periodEndDate` (string or null)

Notes:

- At least one field is required. An empty body (or a body whose keys are all unknown and stripped) returns `400 { "error": "No fields provided for update" }`.
- Changing `name`, `icon`, or `color` propagates the new budget appearance to linked expenses' denormalized metadata (their `updatedAt` is bumped so the change flows through expense sync).
- `period` / `periodStartDate` / `periodEndDate` are merged with the budget's existing period values and re-normalized; sending any one of the three triggers a re-read of the other two. A resulting `custom` period requires an end date.

### Responses

- `200`: updated budget row (raw `budgets` row, including `category`/`createdAt`/`updatedAt`)
- `400 { "error": "Invalid budget id" }`
- `400 { "error": "Invalid payload" }`
- `400 { "error": "No fields provided for update" }`
- `404 { "error": "Budget not found" }`
- `400 { "error": "Failed to update budget" }`

### cURL example

```bash
curl -X PATCH "http://localhost:3000/api/internal/budgets/12" \
  -H "Content-Type: application/json" \
  -H "x-internal-token: $INTERNAL_API_TOKEN" \
  -d '{
    "amount":2500000,
    "icon":"🏠",
    "color":"sky",
    "name":"Groceries + household"
  }'
```

## Endpoint: Delete Budget

- Method: `DELETE`
- Path: `/api/internal/budgets/:id`
- Purpose: hard-delete a budget (removed from the table — this is **not** a soft delete)

### Path params

- `id` (required, positive integer)

### Responses

- `200`: deleted budget row
- `400 { "error": "Invalid budget id" }`
- `404 { "error": "Budget not found" }`
- `400 { "error": "Failed to delete budget" }`

Notes:

- Linked expenses are touched first (their `updatedAt` is bumped so the unlink propagates through expense sync). The expense rows are **not** deleted; only their budget links are removed via the `expense_budgets` cascade.

### cURL example

```bash
curl -X DELETE "http://localhost:3000/api/internal/budgets/12" \
  -H "x-internal-token: $INTERNAL_API_TOKEN"
```
