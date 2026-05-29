# Receipt OCR Scan — Design

Date: 2026-05-29
Status: Approved pending user review

## Goal

Let the user photograph a receipt and turn it into a single expense draft, captured into
the existing add-expense flow. This captures cash and detail-heavy spending that plain
manual entry tends to skip, while reusing the app's proven expense-creation surface.

Scope is deliberately narrow: **one receipt → one total expense**. Line-item splitting is
explicitly deferred to a follow-up (see Non-Goals).

## Decisions (locked during brainstorming)

- **Vision model:** `nvidia/nemotron-nano-12b-v2-vl:free` on OpenRouter (document-intelligence
  tuned, free tier). Graceful fallback to manual entry on any failure — no secondary model in v1.
- **Receipt → expense mapping:** single total expense (merchant → note, receipt total → amount,
  receipt date, one best-guess category). No line items in v1.
- **Entry point:** a dedicated scan button in `BottomNav`, positioned immediately before the
  QuickExpense FAB.
- **Confirm/save surface:** the existing **`QuickExpenseDrawer`** (the current, non-stale entry
  component). Receipt OCR does NOT render its own confirm/edit form. It dispatches the existing
  `EXPENSE_PREFILL_EVENT`, which the `BottomNav`-mounted `QuickExpenseDrawer` already listens for
  and opens itself prefilled. `ManualExpenseForm` is stale and is NOT used.
- **OCR client pattern:** mirror the resilient `parse-expense.ts` approach (raw `fetch`, manual
  JSON extraction, structured fallback) — NOT the strict `callOpenRouterJson`/`response_format`
  path, because free vision models cannot be relied on to honor JSON-schema response formatting.
  Consequence: **core `src/lib/ai/core/openrouter.ts` is not modified.**

## Non-Goals (v1)

- Line-item splitting into multiple expenses (deferred follow-up).
- A secondary/fallback vision model chain.
- Bank/receipt storage or attaching the image to the saved expense.
- Inferring `paidBy` from the receipt (receipts don't reveal it; the drawer's default applies).

## Architecture & Data Flow

```
BottomNav  →  [ scan button (NEW) ] [ QuickExpense FAB (existing) ]
                     │ tap
                     ▼
ReceiptScanDrawer (NEW)
   • <input type="file" accept="image/*" capture="environment">  (camera or library)
   • client-side compress (canvas, longest edge ≤ 1280px, JPEG ~0.7) → base64 data URL
   • POST /api/ai/scan-receipt { imageBase64 }
   • shows progress (PixelLoader) + error/retry state
                     │ OCR result
                     ▼
   success → dispatchExpensePrefill({
                amount: total, note: merchant ?? "", category, date?, source: "receipt_scan"
             }) → close ReceiptScanDrawer
   fallback → dispatchExpensePrefill({ amount?: salvaged, note?: salvaged, category: default,
                source: "receipt_scan" }) → close   (drawer opens for manual completion)
                     │
                     ▼
Existing QuickExpenseDrawer (mounted in BottomNav) catches EXPENSE_PREFILL_EVENT,
opens prefilled, and owns review / edit / budget suggestion / paidBy / date /
optimistic write / offline sync / save.
```

The LLM only **reads** the receipt. There is no arithmetic or detection done by the model.

## Components & Files

### New

- `src/lib/ai/scan-receipt-contract.ts` — request/response types.
- `src/lib/ai/scan-receipt.ts` — OCR service. Mirrors `parse-expense.ts`: builds a multimodal
  OpenRouter request (message `content` array of `{type:"text"}` + `{type:"image_url", image_url:{url}}`),
  parses JSON from the response text, validates, returns success or a structured fallback.
- `src/app/api/ai/scan-receipt/route.ts` — mirrors `parse-expense/route.ts`: parses body, validates
  the image payload, reads `OPENROUTER_API_KEY`, calls the service, returns via `apiSuccess`/`apiError`.
- `src/components/ReceiptScanDrawer.tsx` — capture + compress + progress + error/retry UI. On a
  result, dispatches the prefill and closes. No confirm form of its own.

### Edited

- `src/components/BottomNav.tsx` — add the scan button in the right-side cluster, before the
  QuickExpense FAB; mount/control `ReceiptScanDrawer`. Reuse existing haptics.
- `src/lib/expense-prefill.ts` — add optional `date?: string` to `ExpensePrefillPayload` (DD/MM/YYYY).
- `src/components/QuickExpenseDrawer.tsx` — in the `EXPENSE_PREFILL_EVENT` handler, apply
  `detail.date` when present (via the existing `formatDraftDate` normalization).
- `src/lib/quick-add-mode.ts` — add `"receipt_scan"` to `QuickAddSource` so the drawer resolves to
  "quick" mode when prefilled from a scan.

## Contracts

```ts
// scan-receipt-contract.ts
export type ScanReceiptRequest = {
  imageBase64: string; // data URL or raw base64; route validates
};

export type ScanReceiptSuccessResponse = {
  status: "success";
  receipt: {
    merchant?: string;   // → expense note
    date: string;        // DD/MM/YYYY; today if unreadable
    total: number;       // VND, positive
    category: Category;  // one of the 8-value enum
  };
};

export type ScanReceiptFallbackResponse = {
  status: "fallback";
  prefill: { amount?: number; note?: string };
  reason:
    | "request_failed"
    | "invalid_json"
    | "schema_mismatch"
    | "empty_response";
};

export type ScanReceiptResponse =
  | ScanReceiptSuccessResponse
  | ScanReceiptFallbackResponse;
```

## Validation Rules (service)

- `date` must match `DD/MM/YYYY`; otherwise default to today.
- `total` must be a finite number > 0; otherwise → fallback (`schema_mismatch`).
- `category` normalized against the 8-value `Category` enum (case-insensitive); unknown → fallback.
- `merchant` optional; trimmed; empty allowed (note can be blank, drawer handles it).
- Request validation (matching parse-expense semantics): a structurally invalid body (not an
  object, or `imageBase64` missing / not a non-empty string) → **400 `INVALID_PAYLOAD`** before the
  service is called. Missing `OPENROUTER_API_KEY` → 500. Recoverable model failures (bad/empty/
  unparseable model output, network/429) → **200** with a `status: "fallback"` body so the client
  degrades gracefully.

## Image Handling

- Client compresses before upload: draw to canvas, longest edge ≤ 1280px, export JPEG quality ~0.7.
- Reject non-image files and absurdly large inputs client-side with a friendly message.
- Send as a base64 data URL in JSON (consistent with existing JSON route bodies).

## Error Handling & Fallback

- Any non-success OCR outcome → dispatch a prefill with whatever was salvaged (often nothing beyond
  a default category) and open the drawer for manual completion — never a dead-end.
- Free-tier specifics: HTTP 429 / network error → `request_failed` fallback + a brief toast.
- The progress UI must clearly indicate the (potentially multi-second) free-tier latency.

## Testing

Match existing patterns (`parse-expense.test.ts`, `parse-expense/route.test.ts`,
`QuickExpenseDrawer.test.tsx`, `BottomNav.test.tsx`):

- `scan-receipt.test.ts` — success; each fallback reason; date defaulting; category normalization;
  multimodal request body shape (image_url present), with mocked `fetch`.
- `scan-receipt/route.test.ts` — invalid body → 400; missing key → 500; success shape → 200;
  recoverable failure → 200 fallback.
- `ReceiptScanDrawer.test.tsx` — capture triggers POST; success dispatches `EXPENSE_PREFILL_EVENT`
  with mapped fields; fallback still dispatches + closes; error/retry renders.
- `BottomNav.test.tsx` — scan button renders before the FAB and opens the scan drawer.
- Small unit coverage for the `expense-prefill` date field and `quick-add-mode` new source.

## Risks / Open Questions

- Free vision model reliability/latency is the main risk; mitigated by graceful fallback + clear
  progress UI. If accuracy proves too low in practice, revisit the model choice (Gemma 4 31B, or a
  cheap paid Gemini Flash) as a follow-up — out of scope for this spec.
- Receipt date is preserved via the new optional `date` in the prefill payload; if a receipt date is
  unreadable, today is used.
