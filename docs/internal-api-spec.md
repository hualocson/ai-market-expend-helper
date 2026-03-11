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

- Internal API currently validates `category` as `string` only.
- Recommended: send one of the canonical values above for consistency in UI/reporting.

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

- `date` (required, string): format `DD/MM/YYYY`
- `amount` (required, number)
- `category` (required, string): recommended values are listed in `Category list`
- `paidBy` (required, enum): values listed in `PaidBy list`
- `note` (optional, string)
- `budgetId` (optional, number or null)

### Responses

- `201`: created transaction row
- `400 { "error": "Invalid payload" }`: request body shape/type is invalid
- `400 { "error": "Failed to create transaction" }`: failed while creating

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

Fields:

- `date` (required, string): format `DD/MM/YYYY`
- `amount` (required, number)
- `category` (required, string): recommended values are listed in `Category list`
- `paidBy` (required, enum): values listed in `PaidBy list`
- `note` (optional, string)
- `budgetId` (optional, number or null)

### Responses

- `200`: updated transaction row
- `400 { "error": "Invalid transaction id" }`
- `400 { "error": "Invalid payload" }`
- `404 { "error": "Expense not found" }`
- `400 { "error": "Failed to update transaction" }`

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
  "amount": 2000000,
  "period": "month",
  "periodStartDate": "2026-03-01",
  "periodEndDate": null
}
```

Fields:

- `name` (required, string)
- `amount` (required, number)
- `period` (required, enum): `week | month | custom`
- `periodStartDate` (required, string): format `YYYY-MM-DD`
- `periodEndDate` (optional, string or null): required logically for `custom`

### Responses

- `201`: created budget row
- `400 { "error": "Invalid payload" }`
- `400 { "error": "Failed to create budget" }`

### cURL example

```bash
curl -X POST "http://localhost:3000/api/internal/budgets" \
  -H "Content-Type: application/json" \
  -H "x-internal-token: $INTERNAL_API_TOKEN" \
  -d '{
    "name":"Groceries",
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
- `amount` (number)
- `period` (`week | month | custom`)
- `periodStartDate` (string, `YYYY-MM-DD`)
- `periodEndDate` (string or null)

### Responses

- `200`: updated budget row
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
    "name":"Groceries + household"
  }'
```

## Endpoint: Delete Budget

- Method: `DELETE`
- Path: `/api/internal/budgets/:id`
- Purpose: delete a budget

### Path params

- `id` (required, positive integer)

### Responses

- `200`: deleted budget row
- `400 { "error": "Invalid budget id" }`
- `404 { "error": "Budget not found" }`
- `400 { "error": "Failed to delete budget" }`

### cURL example

```bash
curl -X DELETE "http://localhost:3000/api/internal/budgets/12" \
  -H "x-internal-token: $INTERNAL_API_TOKEN"
```
