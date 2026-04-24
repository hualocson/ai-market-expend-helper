# AI Chat Expense Page Design

## Goal

Create a dedicated `/ai` page where users can add expenses through a chat-like interface. The page should make the AI quick-add flow visible and testable without crowding the dashboard or replacing the existing manual quick-add drawer.

## Route And Entry Point

- Add a new App Router page at `src/app/ai/page.tsx`.
- The page renders a client component for interactive chat behavior.
- Do not replace the existing bottom-nav center quick-add drawer in this iteration.
- Direct navigation to `/ai` is enough for v1; a nav entry can be added later after validating the page.

## User Experience

- The page uses a mobile-first chat layout with a fixed visual frame, a short header, a scrollable message timeline, and a sticky composer near the bottom.
- The visual direction is refined, tactile, and finance-focused: warm paper/card surfaces, ink-like text, soft green accents, and subtle layered gradients rather than a generic chat clone.
- Initial state shows an assistant welcome message and a few example prompt chips.
- When the user submits text, the chat appends a user bubble and calls `POST /api/ai/parse-expense`.
- While parsing, an assistant bubble shows an in-flight state.
- On success, the assistant bubble shows the existing AI preview flow inline.
- On fallback, the assistant bubble shows the existing manual form inline with safe prefill values.
- On request failure, the assistant bubble shows a retryable error message and keeps the user message in history.

## Component Boundaries

- `src/components/AIExpenseChat.tsx` owns chat state, message rendering, fetch orchestration, and composer behavior.
- `src/app/ai/page.tsx` owns the route shell and page metadata-level layout only.
- Reuse existing `AIExpensePreviewCard`, `ManualExpenseForm`, and `ParseExpenseResponse` contract.
- Keep the existing `AIInput` component unchanged; this page is a new experience, not a refactor of that component.

## Data Flow

- Submit trims the input and ignores empty messages.
- Add a user message immediately.
- Add a pending assistant message.
- Call `/api/ai/parse-expense` with `{ input }`.
- Replace the pending assistant message with one of:
  - `success`: parsed expense preview card.
  - `fallback`: inline quick-mode manual form with `prefillExpense`.
  - `error`: retryable message.
- Clear the composer after a valid submit.

## Accessibility

- The page has a clear `h1`.
- The message timeline uses an accessible label.
- The composer textarea has an explicit label.
- Submit is keyboard accessible and supports Enter to send, Shift+Enter for newline.
- Loading state is exposed through visible text, not animation alone.

## Testing

- Add `src/components/AIExpenseChat.test.tsx`.
- Test initial welcome/examples.
- Test successful submit appends the user message and renders the preview before manual form.
- Test fallback renders the manual form with prefill.
- Test non-ok API response renders the retryable error.
- Run targeted checks for the new test plus existing AI quick-add tests.

## Out Of Scope

- Persisting chat history.
- Adding a bottom-nav item.
- Streaming model responses.
- Writing expenses directly from the AI route.
- Changing the existing dashboard layout.
