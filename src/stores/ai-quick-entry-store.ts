import { create } from "zustand";

import type { TQuickExpenseDrawerInitialExpense } from "@/components/QuickExpenseDrawer";
import type { AIQuickEntryReviewReason } from "@/components/ai-quick-entry/real-parse";
import type { QuickEntry } from "@/components/ai-quick-entry/types";

const createEntryId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const MAX_SAVED_QUICK_ENTRY_PREVIEW_ENTRIES = 9;

type SavedQuickEntryExpense = NonNullable<QuickEntry["savedExpense"]>;

const pruneSavedEntries = (entries: QuickEntry[]) => {
  const savedEntries = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.status === "saved");

  if (savedEntries.length <= MAX_SAVED_QUICK_ENTRY_PREVIEW_ENTRIES) {
    return entries;
  }

  const keptSavedIds = new Set(
    savedEntries
      .sort(
        (left, right) =>
          right.entry.createdAt - left.entry.createdAt ||
          right.index - left.index
      )
      .slice(0, MAX_SAVED_QUICK_ENTRY_PREVIEW_ENTRIES)
      .map(({ entry }) => entry.id)
  );

  return entries.filter(
    (entry) => entry.status !== "saved" || keptSavedIds.has(entry.id)
  );
};

type AIQuickEntryState = {
  open: boolean;
  entries: QuickEntry[];
  setOpen: (value: boolean) => void;
  enqueueEntry: (input: string) => QuickEntry;
  markEntryParsing: (id: string) => void;
  markEntrySaving: (
    id: string,
    reviewDraft: TQuickExpenseDrawerInitialExpense
  ) => void;
  markEntrySaved: (id: string, savedExpense: SavedQuickEntryExpense) => void;
  markEntryForReview: (
    id: string,
    reviewDraft: TQuickExpenseDrawerInitialExpense,
    errorReason: AIQuickEntryReviewReason
  ) => void;
  clearSavedEntries: () => void;
  clearEntries: () => void;
};

export const useAIQuickEntryStore = create<AIQuickEntryState>((set) => ({
  open: false,
  entries: [],
  setOpen: (value) => set({ open: value }),
  enqueueEntry: (input) => {
    const entry: QuickEntry = {
      id: createEntryId(),
      input,
      status: "parsing",
      createdAt: Date.now(),
    };

    set((state) => ({ entries: [...state.entries, entry] }));

    return entry;
  },
  markEntryParsing: (id) =>
    set((state) => {
      const entryExists = state.entries.some((entry) => entry.id === id);

      if (!entryExists) {
        return state;
      }

      return {
        entries: state.entries.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                status: "parsing",
                reviewDraft: undefined,
                savedExpense: undefined,
                errorReason: undefined,
              }
            : entry
        ),
      };
    }),
  markEntrySaving: (id, reviewDraft) =>
    set((state) => {
      const entryExists = state.entries.some((entry) => entry.id === id);

      if (!entryExists) {
        return state;
      }

      return {
        entries: state.entries.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                status: "saving",
                reviewDraft,
                savedExpense: undefined,
                errorReason: undefined,
              }
            : entry
        ),
      };
    }),
  markEntrySaved: (id, savedExpense) =>
    set((state) => {
      const entryExists = state.entries.some((entry) => entry.id === id);

      if (!entryExists) {
        return state;
      }

      const entries = state.entries.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: "saved" as const,
              reviewDraft: undefined,
              savedExpense,
              errorReason: undefined,
            }
          : entry
      );

      return {
        entries: pruneSavedEntries(entries),
      };
    }),
  markEntryForReview: (id, reviewDraft, errorReason) =>
    set((state) => {
      const entryExists = state.entries.some((entry) => entry.id === id);

      if (!entryExists) {
        return state;
      }

      return {
        entries: state.entries.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                status: "needsReview",
                reviewDraft,
                savedExpense: undefined,
                errorReason,
              }
            : entry
        ),
      };
    }),
  clearSavedEntries: () =>
    set((state) => ({
      entries: state.entries.filter((entry) => entry.status !== "saved"),
    })),
  clearEntries: () => set({ entries: [] }),
}));
