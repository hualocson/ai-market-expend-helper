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
  entries: Record<string, TQuickExpenseRecoveryEntry>;
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
  entries: {},
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
      entries: {
        ...state.entries,
        [entry.operationId]: entry,
      },
    })),
  markRunning: (operationId) =>
    set((state) => {
      const entry = state.entries[operationId];

      if (!entry || entry.status !== "queued") {
        return {};
      }

      return {
        entries: {
          ...state.entries,
          [operationId]: {
            ...entry,
            status: "running",
          },
        },
      };
    }),
  attachToastId: (operationId, toastId) =>
    set((state) => {
      const entry = state.entries[operationId];

      if (!entry) {
        return {};
      }

      return {
        entries: {
          ...state.entries,
          [operationId]: {
            ...entry,
            toastId,
          },
        },
      };
    }),
  markFailed: (operationId) =>
    set((state) => {
      const entry = state.entries[operationId];

      if (!entry) {
        return {};
      }

      return {
        entries: {
          ...state.entries,
          [operationId]: {
            ...entry,
            status: "failed",
          },
        },
      };
    }),
  clear: (operationId) =>
    set((state) => {
      const { [operationId]: _entry, ...entries } = state.entries;

      return {
        entries,
        activeRecoveryOperationId:
          state.activeRecoveryOperationId === operationId
            ? null
            : state.activeRecoveryOperationId,
      };
    }),
  setActiveRecovery: (operationId) =>
    set({
      activeRecoveryOperationId: operationId,
    }),
  pruneExpired: (now = Date.now()) =>
    set((state) => {
      const entries = Object.fromEntries(
        Object.entries(state.entries).filter(
          ([, entry]) => now - entry.createdAt <= QUICK_EXPENSE_RECOVERY_TTL_MS
        )
      );
      const activeEntryExists =
        state.activeRecoveryOperationId !== null &&
        state.activeRecoveryOperationId in entries;

      return {
        entries,
        activeRecoveryOperationId: activeEntryExists
          ? state.activeRecoveryOperationId
          : null,
      };
    }),
  getQueuedEntries: () =>
    Object.values(get().entries).filter((entry) => entry.status === "queued"),
});

export const getPersistableQuickExpenseRecoveryState = (
  state: TQuickExpenseRecoveryState
): TQuickExpenseRecoveryPersistedState => ({
  entries: Object.fromEntries(
    Object.entries(state.entries).map(
      ([operationId, { toastId: _toastId, status, ...entry }]) => [
        operationId,
        {
          ...entry,
          status: status === "running" ? "queued" : status,
        },
      ]
    )
  ),
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
