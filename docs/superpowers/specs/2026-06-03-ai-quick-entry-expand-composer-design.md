# AI Quick Entry Expand Composer - Design

Date: 2026-06-03
Branch: `dev-ai-quick-entry-multiline-impl`
Status: Approved for implementation planning

## Summary

Add an expanded editing state for the AI Quick Entry textarea when the current
composer text contains multiple lines. The collapsed composer stays compact for
normal single-expense entry. When multiline text is present, an expand button
appears inside the textarea at the top-right. Tapping it expands the composer
into a full-width editing surface with height capped at `80svh`, vertical
scrolling, and the send button moved inside the textarea at the bottom-right.

## Goals

- Make multiline expense review easier before sending.
- Show the expand control only when the composer contains multiple lines.
- Keep the collapsed composer compact and familiar.
- In expanded mode, give the textarea enough height for reviewing pasted lists.
- Keep send visible and reachable in expanded mode.
- Preserve existing one-line-per-expense submit behavior.
- Prioritize iPhone 13/14 viewport quality.

## Non-Goals

- No parser, API, mutation, queue, or preview behavior changes.
- No persistent expanded state after close or send.
- No desktop-specific optimization beyond staying coherent.
- No new drawer or modal for editing multiline input.

## UX

### Collapsed State

The composer keeps the existing bottom placement above the keyboard. The
textarea continues to auto-grow up to the compact cap and scroll vertically when
content exceeds that cap.

When `composer` contains at least one newline, render an expand button inside
the textarea wrapper:

- position: absolute top-right
- icon: expand/maximize
- accessible label: `Expand composer`
- use `onPointerDown={(event) => event.preventDefault()}` so tapping it does not
  blur the focused textarea on iOS
- command runs in `onClick`

The send button remains outside the textarea in collapsed mode.

### Expanded State

Expanded mode is a state of the existing composer, not a separate route or
drawer. The textarea wrapper becomes full-width within the existing mobile
column and visually owns the composer row:

- width: full available composer width
- height: `80svh`
- min height: keep the compact `min-h-12`
- max height: `80svh`
- overflow-y: auto
- resize: none
- top-right button changes to collapse/minimize
- accessible label: `Collapse composer`

The send button moves inside the textarea wrapper at the bottom-right. The
textarea content needs enough bottom padding so text does not sit underneath the
send button.

### Automatic Collapse

Collapse expanded mode when:

- the user sends expenses
- the AI Quick Entry drawer closes
- the user opens preview mode
- the composer changes back to a single line

Returning from preview should keep the composer focused and collapsed.

## Architecture

Keep the implementation focused in `src/components/AIQuickEntry.tsx`.

Add local state:

```ts
const [composerExpanded, setComposerExpanded] = useState(false);
```

Add a derived flag:

```ts
const hasMultipleComposerLines = composer.includes("\n");
```

Use the derived flag to:

- render the expand/collapse button only for multiline input
- auto-collapse when input becomes single-line
- choose collapsed vs expanded textarea classes
- choose whether the send button is outside or inside the textarea wrapper

Update the existing height effect so it respects expanded mode:

- collapsed: current `scrollHeight` clamp to `128px`
- expanded: set height to `80svh`

The submit path should keep using `splitQuickEntryComposerInput(composer)` and
the existing `enqueueEntry` / `runEntry` flow. After a successful submit trigger,
clear the composer and set `composerExpanded` to `false`.

## Components And Layout

No new standalone component is required unless the JSX becomes hard to read. A
small helper render block inside `AIQuickEntry` is enough.

Recommended structure:

```tsx
<div className={composerWrapperClassName}>
  <textarea ... />
  {hasMultipleComposerLines ? (
    <button aria-label={composerExpanded ? "Collapse composer" : "Expand composer"} />
  ) : null}
  {composerExpanded ? sendButton : null}
</div>
{composerExpanded ? null : sendButton}
```

Use `lucide-react` icons. Prefer `Maximize2` and `Minimize2` if available.

## Testing

Update `src/components/AIQuickEntry.test.tsx`:

- Expand button is hidden for single-line composer text.
- Expand button appears when composer text has multiple lines.
- Tapping expand changes the textarea to expanded height behavior and shows the
  send button inside the textarea wrapper.
- Tapping collapse returns to compact behavior.
- Sending while expanded submits the multiline entries and collapses the
  composer.
- Removing newlines while expanded auto-collapses.

Prefer assertions on accessible labels and stable test ids/classes where
necessary. Keep tests behavior-focused and avoid brittle visual snapshots.

## Validation

After implementation, run:

```bash
rtk bunx prettier --write src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
rtk bunx prettier --check src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
rtk bunx eslint src/components/AIQuickEntry.tsx src/components/AIQuickEntry.test.tsx
rtk bunx vitest run src/components/AIQuickEntry.test.tsx
```

Do not run `npm run build` for this individual change.
