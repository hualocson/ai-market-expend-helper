import { create } from "zustand";

import type { TQuickExpenseDrawerInitialExpense } from "@/components/QuickExpenseDrawer";
import type { AIQuickEntryReviewReason } from "@/components/ai-quick-entry/real-parse";
import type { QuickEntry } from "@/components/ai-quick-entry/types";

const createEntryId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

type SavedQuickEntryExpense = NonNullable<QuickEntry["savedExpense"]>;

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

      return {
        entries: state.entries.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                status: "saved",
                reviewDraft: undefined,
                savedExpense,
                errorReason: undefined,
              }
            : entry
        ),
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
  clearEntries: () => set({ entries: [] }),
}));
