import { Category, PaidBy } from "@/enums";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAIQuickEntryStore } from "./ai-quick-entry-store";

const reviewDraft = {
  date: "30/05/2026",
  amount: 35000,
  note: "Cà phê",
  category: Category.FOOD,
  paidBy: PaidBy.CUBI,
  budgetId: null,
  budgetName: null,
  budgetIcon: null,
  budgetColor: null,
};

const savedExpense = {
  ...reviewDraft,
  id: 101,
  clientId: "client-1",
  syncStatus: "pending" as const,
};

afterEach(() => {
  const store = useAIQuickEntryStore.getState();
  store.setOpen(false);
  store.clearEntries();
  vi.restoreAllMocks();
});

describe("useAIQuickEntryStore", () => {
  it("defaults to closed with no entries", () => {
    expect(useAIQuickEntryStore.getState().open).toBe(false);
    expect(useAIQuickEntryStore.getState().entries).toEqual([]);
  });

  it("opens and closes via setOpen without clearing entries", () => {
    const store = useAIQuickEntryStore.getState();
    const entry = store.enqueueEntry("cf 35k");

    store.setOpen(true);
    store.setOpen(false);

    expect(useAIQuickEntryStore.getState().open).toBe(false);
    expect(useAIQuickEntryStore.getState().entries).toMatchObject([
      { id: entry.id, input: "cf 35k", status: "parsing" },
    ]);
  });

  it("enqueues parsing entries with stable runtime fields", () => {
    const before = Date.now();
    const entry = useAIQuickEntryStore.getState().enqueueEntry("tea 20k");

    expect(entry).toMatchObject({
      input: "tea 20k",
      status: "parsing",
    });
    expect(entry.id).toEqual(expect.any(String));
    expect(entry.createdAt).toBeGreaterThanOrEqual(before);
    expect(useAIQuickEntryStore.getState().entries).toEqual([entry]);
  });

  it("moves only the targeted entry through parsing, saving, saved, and review", () => {
    const store = useAIQuickEntryStore.getState();
    const first = store.enqueueEntry("first");
    const second = store.enqueueEntry("second");

    store.markEntrySaving(first.id, reviewDraft);
    expect(useAIQuickEntryStore.getState().entries).toMatchObject([
      { id: first.id, status: "saving", reviewDraft },
      { id: second.id, status: "parsing" },
    ]);

    store.markEntrySaving(second.id, reviewDraft);
    store.markEntryParsing(second.id);
    expect(useAIQuickEntryStore.getState().entries).toMatchObject([
      { id: first.id, status: "saving", reviewDraft },
      { id: second.id, status: "parsing" },
    ]);

    store.markEntrySaved(first.id, savedExpense);
    expect(useAIQuickEntryStore.getState().entries).toMatchObject([
      { id: first.id, status: "saved", savedExpense },
      { id: second.id, status: "parsing" },
    ]);

    store.markEntryForReview(second.id, reviewDraft, "no_budget_match");
    expect(useAIQuickEntryStore.getState().entries).toMatchObject([
      { id: first.id, status: "saved", savedExpense },
      {
        id: second.id,
        status: "needsReview",
        reviewDraft,
        errorReason: "no_budget_match",
      },
    ]);
  });

  it("keeps only the newest 9 saved entries while preserving active and review entries", () => {
    const store = useAIQuickEntryStore.getState();
    const savedIds: string[] = [];

    for (let index = 1; index <= 11; index += 1) {
      vi.spyOn(Date, "now").mockReturnValueOnce(index);
      const entry = store.enqueueEntry(`saved ${index}`);
      store.markEntrySaved(entry.id, {
        ...savedExpense,
        id: index,
        note: `saved ${index}`,
      });
      savedIds.push(entry.id);
    }

    const activeEntry = store.enqueueEntry("still parsing");
    const reviewEntry = store.enqueueEntry("needs review");
    store.markEntryForReview(reviewEntry.id, reviewDraft, "no_budget_match");

    const entries = useAIQuickEntryStore.getState().entries;
    expect(entries.map((entry) => entry.id)).toEqual([
      ...savedIds.slice(2),
      activeEntry.id,
      reviewEntry.id,
    ]);
    expect(entries.filter((entry) => entry.status === "saved")).toHaveLength(9);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: activeEntry.id, status: "parsing" }),
        expect.objectContaining({
          id: reviewEntry.id,
          status: "needsReview",
        }),
      ])
    );
  });

  it("clears saved entries without removing active or review entries", () => {
    const store = useAIQuickEntryStore.getState();
    const savedEntry = store.enqueueEntry("saved");
    const activeEntry = store.enqueueEntry("still parsing");
    const reviewEntry = store.enqueueEntry("needs review");

    store.markEntrySaved(savedEntry.id, savedExpense);
    store.markEntryForReview(reviewEntry.id, reviewDraft, "no_budget_match");
    store.clearSavedEntries();

    expect(useAIQuickEntryStore.getState().entries).toMatchObject([
      { id: activeEntry.id, status: "parsing" },
      {
        id: reviewEntry.id,
        status: "needsReview",
        reviewDraft,
        errorReason: "no_budget_match",
      },
    ]);
  });

  it("ignores transitions for missing entries", () => {
    const store = useAIQuickEntryStore.getState();

    store.markEntryParsing("missing");
    store.markEntrySaving("missing", reviewDraft);
    store.markEntrySaved("missing", savedExpense);
    store.markEntryForReview("missing", reviewDraft, "parse_error");

    expect(useAIQuickEntryStore.getState().entries).toEqual([]);
  });

  it("does not notify subscribers when missing-entry transitions have existing entries", () => {
    const store = useAIQuickEntryStore.getState();
    store.enqueueEntry("existing");
    const entriesBefore = useAIQuickEntryStore.getState().entries;
    let notifications = 0;
    const unsubscribe = useAIQuickEntryStore.subscribe(() => {
      notifications += 1;
    });

    store.markEntryParsing("missing");
    store.markEntrySaving("missing", reviewDraft);
    store.markEntrySaved("missing", savedExpense);
    store.markEntryForReview("missing", reviewDraft, "parse_error");
    unsubscribe();

    expect(notifications).toBe(0);
    expect(useAIQuickEntryStore.getState().entries).toBe(entriesBefore);
  });

  it("clears entries only when clearEntries is called", () => {
    const store = useAIQuickEntryStore.getState();
    store.enqueueEntry("cf 35k");

    store.clearEntries();

    expect(useAIQuickEntryStore.getState().entries).toEqual([]);
  });
});
