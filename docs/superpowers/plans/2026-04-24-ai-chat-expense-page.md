# AI Chat Expense Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated `/ai` chat-style page for the existing OpenRouter expense quick-add flow.

**Architecture:** Add one focused client component, `AIExpenseChat`, that owns chat messages, composer state, and calls to `POST /api/ai/parse-expense`. Add a small App Router page at `/ai` that provides the page shell and renders the chat component. Reuse existing `AIExpensePreviewCard`, `ManualExpenseForm`, and `ParseExpenseResponse` contracts.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library, existing shadcn-style UI primitives, existing AI parse API route

---

## File Structure

**Create**
- `src/components/AIExpenseChat.tsx`: client chat UI, message timeline, composer, fetch orchestration, result rendering
- `src/components/AIExpenseChat.test.tsx`: component behavior tests for welcome, success, fallback, and error states
- `src/app/ai/page.tsx`: `/ai` route shell and page-level layout
- `src/app/ai/page.test.tsx`: route smoke test that verifies the shell renders the chat component

**Modify**
- None

**Do Not Touch**
- `src/components/AIInput.tsx`: keep the existing input component unchanged
- `src/components/BottomNav.tsx`: no nav entry in this iteration
- `src/app/page.tsx`: do not crowd the dashboard

### Task 1: Lock the chat behavior with failing tests

**Files:**
- Create: `src/components/AIExpenseChat.test.tsx`
- Test target: `src/components/AIExpenseChat.tsx`

- [ ] **Step 1: Write the failing chat component test file**

Create `src/components/AIExpenseChat.test.tsx` with this complete content:

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Category } from "@/enums";

import AIExpenseChat from "./AIExpenseChat";

vi.mock("./ManualExpenseForm", () => ({
  default: ({
    initialMode,
    initialExpense,
    prefillExpense,
  }: {
    initialMode?: string;
    initialExpense?: TExpense | null;
    prefillExpense?: Partial<Pick<TExpense, "amount" | "note" | "category">> | null;
  }) => (
    <div
      data-testid="manual-expense-form"
      data-initial-mode={initialMode}
      data-initial-expense={
        typeof initialExpense !== "undefined"
          ? JSON.stringify(initialExpense)
          : undefined
      }
      data-prefill-expense={
        typeof prefillExpense !== "undefined"
          ? JSON.stringify(prefillExpense)
          : undefined
      }
    />
  ),
}));

const createJsonResponse = (
  body: unknown,
  init: ResponseInit = { status: 200 }
) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

const expectParseExpenseRequest = (input: string) => {
  expect(globalThis.fetch).toHaveBeenCalledTimes(1);

  const [endpoint, init] = vi.mocked(globalThis.fetch).mock.calls[0] ?? [];

  expect(endpoint).toBe("/api/ai/parse-expense");
  expect(init).toMatchObject({
    method: "POST",
  });
  expect(JSON.parse(String(init?.body))).toMatchObject({
    input,
  });
};

const originalGlobalReact = globalThis.React;

beforeEach(() => {
  globalThis.React = React;
});

afterEach(() => {
  if (typeof originalGlobalReact === "undefined") {
    Reflect.deleteProperty(globalThis, "React");
  } else {
    globalThis.React = originalGlobalReact;
  }

  vi.restoreAllMocks();
});

describe("AIExpenseChat", () => {
  it("renders the welcome message and example prompts", () => {
    render(<AIExpenseChat />);

    expect(
      screen.getByRole("region", { name: /ai expense conversation/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/tell me what you spent/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /lunch with team 120k today/i })
    ).toBeInTheDocument();
  });

  it("submits a message and renders a preview card for a successful parse", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      createJsonResponse({
        status: "success",
        originalInput: "Lunch with team 120k today",
        expense: {
          date: "24/04/2026",
          amount: 120000,
          note: "Lunch with team",
          category: Category.FOOD,
        },
      })
    );

    render(<AIExpenseChat />);

    await user.type(
      screen.getByLabelText(/message spendly ai/i),
      "Lunch with team 120k today"
    );
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expectParseExpenseRequest("Lunch with team 120k today");
    expect(screen.getByText("Lunch with team 120k today")).toBeInTheDocument();
    expect(
      await screen.findByText(/review ai suggestion/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId("manual-expense-form")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /continue to form/i }));

    const form = await screen.findByTestId("manual-expense-form");
    const initialExpense = JSON.parse(
      form.getAttribute("data-initial-expense") ?? "null"
    ) as TExpense;

    expect(initialExpense).toMatchObject({
      date: "24/04/2026",
      amount: 120000,
      note: "Lunch with team",
      category: Category.FOOD,
    });
  });

  it("renders the manual form inline for fallback responses", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      createJsonResponse({
        status: "fallback",
        originalInput: "Taxi 45k home",
        reason: "schema_mismatch",
        prefill: {
          note: "Taxi 45k home",
          amount: 45000,
        },
      })
    );

    render(<AIExpenseChat />);

    await user.type(screen.getByLabelText(/message spendly ai/i), "Taxi 45k home");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expectParseExpenseRequest("Taxi 45k home");

    const form = await screen.findByTestId("manual-expense-form");
    const prefillExpense = JSON.parse(
      form.getAttribute("data-prefill-expense") ?? "null"
    ) as Record<string, unknown>;

    expect(form).toHaveAttribute("data-initial-mode", "quick");
    expect(prefillExpense).toMatchObject({
      note: "Taxi 45k home",
      amount: 45000,
    });
    expect(screen.queryByText(/review ai suggestion/i)).not.toBeInTheDocument();
  });

  it("renders a retryable assistant error for non-ok responses", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      createJsonResponse(
        { error: "Missing OPENROUTER_API_KEY" },
        { status: 500 }
      )
    );

    render(<AIExpenseChat />);

    await user.type(screen.getByLabelText(/message spendly ai/i), "Dinner");
    await user.click(screen.getByRole("button", { name: /send message/i }));

    expectParseExpenseRequest("Dinner");
    expect(
      await screen.findByText(/could not parse that expense/i)
    ).toBeInTheDocument();
    expect(screen.queryByTestId("manual-expense-form")).not.toBeInTheDocument();
  });

  it("uses an example prompt as composer text", async () => {
    const user = userEvent.setup();

    render(<AIExpenseChat />);

    await user.click(
      screen.getByRole("button", { name: /groceries 450k yesterday/i })
    );

    expect(screen.getByLabelText(/message spendly ai/i)).toHaveValue(
      "Groceries 450k yesterday"
    );
  });
});
```

- [ ] **Step 2: Run the chat test to verify it fails**

Run:

```bash
npm run test -- src/components/AIExpenseChat.test.tsx
```

Expected: FAIL with an import error because `src/components/AIExpenseChat.tsx` does not exist.

- [ ] **Step 3: Commit the failing chat tests**

```bash
git add src/components/AIExpenseChat.test.tsx
git commit -m "test: cover AI expense chat flow"
```

### Task 2: Implement the chat client component

**Files:**
- Create: `src/components/AIExpenseChat.tsx`
- Test: `src/components/AIExpenseChat.test.tsx`

- [ ] **Step 1: Create the chat component**

Create `src/components/AIExpenseChat.tsx` with this complete content:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

import type { ParseExpenseResponse } from "@/lib/ai/parse-expense-contract";
import { cn } from "@/lib/utils";
import {
  Bot,
  Loader2,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
} from "lucide-react";

import AIExpensePreviewCard from "./AIExpensePreviewCard";
import ManualExpenseForm from "./ManualExpenseForm";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

type FallbackPrefill = Partial<Pick<TExpense, "amount" | "note" | "category">>;

type ChatMessage =
  | {
      id: string;
      role: "assistant";
      kind: "welcome";
    }
  | {
      id: string;
      role: "user";
      kind: "text";
      text: string;
    }
  | {
      id: string;
      role: "assistant";
      kind: "pending";
    }
  | {
      id: string;
      role: "assistant";
      kind: "success";
      expense: TExpense;
      showForm: boolean;
    }
  | {
      id: string;
      role: "assistant";
      kind: "fallback";
      prefill: FallbackPrefill;
    }
  | {
      id: string;
      role: "assistant";
      kind: "error";
      text: string;
    };

const examples = [
  "Lunch with team 120k today",
  "Groceries 450k yesterday",
  "Coffee 45k this morning",
];

const retryableErrorMessage =
  "Could not parse that expense. Try a shorter message or open the manual form.";

const createMessageId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const initialMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    kind: "welcome",
  },
];

const AIExpenseChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    timelineRef.current?.scrollTo({
      top: timelineRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const maxHeight = 132;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [input]);

  const replaceMessage = (
    messageId: string,
    nextMessage: ChatMessage
  ) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? nextMessage : message
      )
    );
  };

  const handleSubmit = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || loading) {
      return;
    }

    const pendingId = createMessageId();
    setMessages((current) => [
      ...current,
      {
        id: createMessageId(),
        role: "user",
        kind: "text",
        text: trimmedInput,
      },
      {
        id: pendingId,
        role: "assistant",
        kind: "pending",
      },
    ]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/parse-expense", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: trimmedInput }),
      });

      if (!response.ok) {
        throw new Error(`Parse request failed with status ${response.status}`);
      }

      const payload = (await response.json()) as ParseExpenseResponse;

      if (payload.status === "success") {
        replaceMessage(pendingId, {
          id: pendingId,
          role: "assistant",
          kind: "success",
          expense: payload.expense,
          showForm: false,
        });
        return;
      }

      replaceMessage(pendingId, {
        id: pendingId,
        role: "assistant",
        kind: "fallback",
        prefill: payload.prefill,
      });
    } catch (error) {
      console.error(error);
      replaceMessage(pendingId, {
        id: pendingId,
        role: "assistant",
        kind: "error",
        text: retryableErrorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  const showSuccessForm = (messageId: string) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId && message.kind === "success"
          ? { ...message, showForm: true }
          : message
      )
    );
  };

  const dismissSuccess = (messageId: string) => {
    setMessages((current) =>
      current.filter((message) => message.id !== messageId)
    );
  };

  return (
    <section className="relative flex min-h-[calc(100svh-172px)] flex-col overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-[#f8f3e8] shadow-[0_28px_90px_rgba(24,45,32,0.18)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(46,125,82,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(195,132,56,0.18),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-x-6 top-5 h-px bg-gradient-to-r from-transparent via-emerald-900/20 to-transparent" />

      <div
        ref={timelineRef}
        role="region"
        aria-label="AI expense conversation"
        className="relative z-10 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-5 pb-4"
      >
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onContinue={() => showSuccessForm(message.id)}
            onDismiss={() => dismissSuccess(message.id)}
          />
        ))}
      </div>

      <div className="relative z-10 border-t border-emerald-950/10 bg-[#fffaf0]/88 p-3 backdrop-blur-xl">
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setInput(example);
                textareaRef.current?.focus();
              }}
              className="shrink-0 rounded-full border border-emerald-900/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-emerald-950/70 shadow-sm transition hover:-translate-y-0.5 hover:bg-white"
            >
              {example}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-2 rounded-[1.35rem] border border-emerald-950/10 bg-white/85 p-2 shadow-[0_16px_42px_rgba(24,45,32,0.12)]">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-950 text-[#f8f3e8]">
            <MessageCircle className="h-4 w-4" />
          </div>
          <Textarea
            ref={textareaRef}
            aria-label="Message Spendly AI"
            placeholder="Tell Spendly AI what you spent..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="max-h-[132px] min-h-10 resize-none border-0 bg-transparent px-0 py-2 text-[15px] shadow-none focus-visible:ring-0"
          />
          <Button
            type="button"
            aria-label="Send message"
            size="icon"
            disabled={loading || input.trim().length === 0}
            onClick={() => void handleSubmit()}
            className="size-10 shrink-0 rounded-2xl bg-emerald-950 text-[#f8f3e8] hover:bg-emerald-900"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </section>
  );
};

type MessageBubbleProps = {
  message: ChatMessage;
  onContinue: () => void;
  onDismiss: () => void;
};

const MessageBubble = ({
  message,
  onContinue,
  onDismiss,
}: MessageBubbleProps) => {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[88%] rounded-[1.4rem] px-4 py-3 text-sm shadow-sm",
          isUser
            ? "rounded-br-md bg-emerald-950 text-[#fffaf0]"
            : "rounded-bl-md border border-emerald-950/10 bg-white/78 text-emerald-950 backdrop-blur"
        )}
      >
        {message.kind === "welcome" ? <WelcomeMessage /> : null}
        {message.kind === "text" ? <p>{message.text}</p> : null}
        {message.kind === "pending" ? <PendingMessage /> : null}
        {message.kind === "success" ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 font-medium">
              <Sparkles className="h-4 w-4 text-emerald-700" />
              I found an expense draft.
            </p>
            {message.showForm ? (
              <ManualExpenseForm initialExpense={message.expense} />
            ) : (
              <AIExpensePreviewCard
                expense={message.expense}
                onContinue={onContinue}
                onDismiss={onDismiss}
              />
            )}
          </div>
        ) : null}
        {message.kind === "fallback" ? (
          <div className="space-y-3">
            <p className="font-medium">
              I need a little help. I filled in what I could.
            </p>
            <ManualExpenseForm
              initialMode="quick"
              prefillExpense={message.prefill}
            />
          </div>
        ) : null}
        {message.kind === "error" ? (
          <p className="flex items-start gap-2 text-destructive">
            <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{message.text}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
};

const WelcomeMessage = () => (
  <div className="space-y-2">
    <p className="flex items-center gap-2 font-semibold">
      <Bot className="h-4 w-4 text-emerald-700" />
      Tell me what you spent.
    </p>
    <p className="text-emerald-950/68">
      I will turn short notes into an expense draft you can review before
      saving.
    </p>
  </div>
);

const PendingMessage = () => (
  <p className="flex items-center gap-2 text-emerald-950/70">
    <Loader2 className="h-4 w-4 animate-spin" />
    Reading the expense details...
  </p>
);

export default AIExpenseChat;
```

- [ ] **Step 2: Run the chat tests**

Run:

```bash
npm run test -- src/components/AIExpenseChat.test.tsx
```

Expected: PASS with 5 tests green.

- [ ] **Step 3: Commit the chat component**

```bash
git add src/components/AIExpenseChat.tsx src/components/AIExpenseChat.test.tsx
git commit -m "feat: add AI expense chat component"
```

### Task 3: Add the `/ai` route shell

**Files:**
- Create: `src/app/ai/page.test.tsx`
- Create: `src/app/ai/page.tsx`
- Test target: `src/app/ai/page.tsx`

- [ ] **Step 1: Write the failing route smoke test**

Create `src/app/ai/page.test.tsx` with this complete content:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AIChatPage from "./page";

vi.mock("@/components/AIExpenseChat", () => ({
  default: () => <div data-testid="ai-expense-chat" />,
}));

describe("/ai page", () => {
  it("renders the AI chat page shell", () => {
    render(<AIChatPage />);

    expect(
      screen.getByRole("heading", { name: /ai expense chat/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/chat your spending into shape/i)).toBeInTheDocument();
    expect(screen.getByTestId("ai-expense-chat")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the route test to verify it fails**

Run:

```bash
npm run test -- src/app/ai/page.test.tsx
```

Expected: FAIL with an import error because `src/app/ai/page.tsx` does not exist.

- [ ] **Step 3: Create the route page**

Create `src/app/ai/page.tsx` with this complete content:

```tsx
import AIExpenseChat from "@/components/AIExpenseChat";

const AIChatPage = () => {
  return (
    <main className="relative mx-auto flex min-h-svh max-w-md flex-col px-4 pt-6 pb-28 sm:px-6 sm:pt-8">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(145deg,#fbf5e8_0%,#eef6ec_48%,#f7ead7_100%)]" />
      <div className="mb-5 space-y-2">
        <p className="text-xs font-semibold tracking-[0.28em] text-emerald-900/60 uppercase">
          Spendly AI
        </p>
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">
          AI expense chat
        </h1>
        <p className="text-muted-foreground text-sm leading-6">
          Chat your spending into shape. Send one expense at a time, review the
          draft, then finish it in the regular form.
        </p>
      </div>

      <AIExpenseChat />
    </main>
  );
};

export default AIChatPage;
```

- [ ] **Step 4: Run the route smoke test**

Run:

```bash
npm run test -- src/app/ai/page.test.tsx
```

Expected: PASS with 1 test green.

- [ ] **Step 5: Commit the route shell**

```bash
git add src/app/ai/page.tsx src/app/ai/page.test.tsx
git commit -m "feat: add AI chat page"
```

### Task 4: Run focused verification and review scope

**Files:**
- Test: `src/components/AIExpenseChat.test.tsx`
- Test: `src/app/ai/page.test.tsx`
- Test: `src/app/api/ai/parse-expense/route.test.ts`
- Test: `src/lib/ai/parse-expense.test.ts`

- [ ] **Step 1: Run the new page and chat tests together**

Run:

```bash
npm run test -- src/components/AIExpenseChat.test.tsx src/app/ai/page.test.tsx
```

Expected: PASS with 6 tests green.

- [ ] **Step 2: Run the AI feature slice tests**

Run:

```bash
npm run test -- src/components/AIExpenseChat.test.tsx src/app/ai/page.test.tsx src/components/AIInput.test.tsx src/app/api/ai/parse-expense/route.test.ts src/lib/ai/parse-expense.test.ts
```

Expected: PASS. Do not run `npm run build` for this validation because `AGENTS.md` says to use targeted checks relevant to the modified scope.

- [ ] **Step 3: Review final scope**

Run:

```bash
git diff --stat -- src/components/AIExpenseChat.tsx src/components/AIExpenseChat.test.tsx src/app/ai/page.tsx src/app/ai/page.test.tsx
```

Expected:
- Only the new chat component, its test, the `/ai` page, and its test are present in this feature diff.
- No changes to `src/components/BottomNav.tsx`.
- No changes to `src/app/page.tsx`.
- No direct database write path added outside `ManualExpenseForm`.

- [ ] **Step 4: Commit test-only adjustments if verification required any**

If verification required edits to tests after the route and component commits, run:

```bash
git add src/components/AIExpenseChat.test.tsx src/app/ai/page.test.tsx
git commit -m "test: finalize AI chat page coverage"
```

If there are no changes after verification, skip this commit.
