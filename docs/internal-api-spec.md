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
- `category` (required, string)
- `paidBy` (required, enum): `Cubi | Embe | Other`
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

Date range:

```bash
curl "http://localhost:3000/api/internal/transactions?from=2026-03-01&to=2026-03-07&limit=100" \
  -H "Authorization: Bearer $INTERNAL_API_TOKEN"
```
