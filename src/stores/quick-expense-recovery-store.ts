import { Category, PaidBy } from "@/enums";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

export const QUICK_EXPENSE_RECOVERY_TTL_MS = 30 * 60 * 1000;

export type TQuickExpensePayload = {
  date: string;
  amount: number;
  note: string;
  category: Category;
  paidBy: PaidBy;
  budgetId: number | null;
};

export type TQuickExpenseDraft = TQuickExpensePayload;

export type TQuickExpenseRecoveryStatus = "queued" | "running" | "failed";

export type TQuickExpenseRecoveryEntry = {
  operationId: string;
  mode: "create" | "edit";
  transactionId?: number;
  draft: TQuickExpenseDraft;
  payload: TQuickExpensePayload;
  toastId?: string | number;
  status: TQuickExpenseRecoveryStatus;
  createdAt: number;
};

export type TQuickExpenseRecoveryPersistedState = {
  entries: TQuickExpenseRecoveryEntry[];
  activeRecoveryOperationId: string | null;
};

export type TQuickExpenseRecoveryState = TQuickExpenseRecoveryPersistedState & {
  enqueue: (entry: TQuickExpenseRecoveryEntry) => void;
  markRunning: (operationId: string) => void;
  attachToastId: (
    operationId: string,
    toastId: TQuickExpenseRecoveryEntry["toastId"]
  ) => void;
  markFailed: (operationId: string) => void;
  clear: (operationId: string) => void;
  setActiveRecovery: (operationId: string | null) => void;
  pruneExpired: (now?: number) => void;
  getQueuedEntries: () => TQuickExpenseRecoveryEntry[];
};

const defaultPersistedState: TQuickExpenseRecoveryPersistedState = {
  entries: [],
  activeRecoveryOperationId: null,
};

const createQuickExpenseRecoveryState = (
  set: (
    partial:
      | Partial<TQuickExpenseRecoveryState>
      | ((state: TQuickExpenseRecoveryState) => Partial<TQuickExpenseRecoveryState>)
  ) => void,
  get: () => TQuickExpenseRecoveryState,
  initState: TQuickExpenseRecoveryPersistedState = defaultPersistedState
): TQuickExpenseRecoveryState => ({
  ...initState,
  enqueue: (entry) =>
    set((state) => ({
      entries: [...state.entries, entry],
    })),
  markRunning: (operationId) =>
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.operationId === operationId && entry.status === "queued"
          ? { ...entry, status: "running" }
          : entry
      ),
    })),
  attachToastId: (operationId, toastId) =>
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.operationId === operationId ? { ...entry, toastId } : entry
      ),
    })),
  markFailed: (operationId) =>
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.operationId === operationId ? { ...entry, status: "failed" } : entry
      ),
    })),
  clear: (operationId) =>
    set((state) => ({
      entries: state.entries.filter((entry) => entry.operationId !== operationId),
      activeRecoveryOperationId:
        state.activeRecoveryOperationId === operationId
          ? null
          : state.activeRecoveryOperationId,
    })),
  setActiveRecovery: (operationId) =>
    set({
      activeRecoveryOperationId: operationId,
    }),
  pruneExpired: (now = Date.now()) =>
    set((state) => {
      const entries = state.entries.filter(
        (entry) => now - entry.createdAt <= QUICK_EXPENSE_RECOVERY_TTL_MS
      );
      const activeEntryExists = entries.some(
        (entry) => entry.operationId === state.activeRecoveryOperationId
      );

      return {
        entries,
        activeRecoveryOperationId: activeEntryExists
          ? state.activeRecoveryOperationId
          : null,
      };
    }),
  getQueuedEntries: () =>
    get().entries.filter((entry) => entry.status === "queued"),
});

export const getPersistableQuickExpenseRecoveryState = (
  state: TQuickExpenseRecoveryState
): TQuickExpenseRecoveryPersistedState => ({
  entries: state.entries.map((entry) => ({
    ...entry,
    toastId: undefined,
  })),
  activeRecoveryOperationId: state.activeRecoveryOperationId,
});

export const createQuickExpenseRecoveryStore = (
  initState: TQuickExpenseRecoveryPersistedState = defaultPersistedState
) =>
  createStore<TQuickExpenseRecoveryState>()((set, get) =>
    createQuickExpenseRecoveryState(set, get, initState)
  );

export const useQuickExpenseRecoveryStore = create<TQuickExpenseRecoveryState>()(
  persist(
    (set, get) => createQuickExpenseRecoveryState(set, get),
    {
      name: "quick-expense-recovery",
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      partialize: getPersistableQuickExpenseRecoveryState,
    }
  )
);
