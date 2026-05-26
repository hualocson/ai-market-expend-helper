import dayjs from "@/configs/date";
import { Category, PaidBy } from "@/enums";
import {
  type BudgetColorId,
  normalizeBudgetColor,
  normalizeBudgetIcon,
} from "@/lib/budget-appearance";
import type {
  ExpenseOutboxOperation,
  LocalExpense,
} from "@/lib/sync/expenses/types";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

export const QUICK_EXPENSE_RECOVERY_TTL_MS = 30 * 60 * 1000;

export type TQuickExpensePayload = {
  clientId?: string;
  date: string;
  amount: number;
  note: string;
  category: Category;
  paidBy: PaidBy;
  budgetId: number | null;
  budgetName: string | null;
  budgetIcon?: string | null;
  budgetColor?: BudgetColorId | null;
};

export type TQuickExpenseDraft = TQuickExpensePayload;

export type TQuickExpenseRecoveryStatus = "failed";

export type TQuickExpenseRecoveryEntry = {
  operationId: string;
  mode: "create" | "edit" | "delete";
  clientId: string;
  serverId: number | null;
  transactionId?: number;
  draft: TQuickExpenseDraft;
  payload: TQuickExpensePayload;
  toastId?: string | number;
  notifiedAt?: number;
  status: TQuickExpenseRecoveryStatus;
  lastError: string;
  createdAt: number;
};

export type TQuickExpenseRecoveryPersistedState = {
  activeRecoveryOperationId: string | null;
  dismissedErrorsByOperationId: Record<string, string>;
};

export type TQuickExpenseRecoveryState = TQuickExpenseRecoveryPersistedState & {
  entries: Record<string, TQuickExpenseRecoveryEntry>;
  syncFailedOutboxEntries: (
    operations: ExpenseOutboxOperation[],
    now?: number
  ) => void;
  markNotified: (
    operationId: string,
    toastId?: TQuickExpenseRecoveryEntry["toastId"],
    now?: number
  ) => void;
  clear: (operationId: string) => void;
  setActiveRecovery: (operationId: string | null) => void;
  pruneExpired: (now?: number) => void;
  getUnnotifiedFailedEntries: () => TQuickExpenseRecoveryEntry[];
};

const defaultPersistedState: TQuickExpenseRecoveryPersistedState = {
  activeRecoveryOperationId: null,
  dismissedErrorsByOperationId: {},
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCategory = (value: string): value is Category =>
  (Object.values(Category) as string[]).includes(value);

const isPaidBy = (value: string): value is PaidBy =>
  (Object.values(PaidBy) as string[]).includes(value);

const isRecoverableExpense = (value: unknown): value is LocalExpense => {
  if (!isRecord(value)) {
    return false;
  }

  const hasValidBudgetAppearance =
    (typeof value.budgetIcon === "string" ||
      value.budgetIcon === null ||
      typeof value.budgetIcon === "undefined") &&
    (typeof value.budgetColor === "string" ||
      value.budgetColor === null ||
      typeof value.budgetColor === "undefined");

  return (
    value.entity === "expenses" &&
    typeof value.clientId === "string" &&
    (typeof value.serverId === "number" || value.serverId === null) &&
    typeof value.date === "string" &&
    typeof value.amount === "number" &&
    Number.isFinite(value.amount) &&
    typeof value.note === "string" &&
    typeof value.category === "string" &&
    isCategory(value.category) &&
    typeof value.paidBy === "string" &&
    isPaidBy(value.paidBy) &&
    (typeof value.budgetId === "number" || value.budgetId === null) &&
    (typeof value.budgetName === "string" || value.budgetName === null) &&
    hasValidBudgetAppearance
  );
};

const getOperationRecoveryStartedAt = (
  operation: ExpenseOutboxOperation,
  now: number
) => {
  const parsed = Date.parse(operation.lastAttemptAt ?? operation.createdAt);
  return Number.isFinite(parsed) ? parsed : now;
};

const getDismissedRecoveryKey = (entry: TQuickExpenseRecoveryEntry) =>
  `${entry.lastError}:${entry.createdAt}`;

const formatRecoveryDraftDate = (value: string) => {
  const isoDate = dayjs(value, "YYYY-MM-DD", true);
  if (isoDate.isValid()) {
    return isoDate.format("DD/MM/YYYY");
  }

  const displayDate = dayjs(value, "DD/MM/YYYY", true);
  if (displayDate.isValid()) {
    return displayDate.format("DD/MM/YYYY");
  }

  return value;
};

const getRecoveryBudgetAppearance = (
  payload: LocalExpense
): Pick<TQuickExpenseDraft, "budgetIcon" | "budgetColor"> => {
  if (payload.budgetId === null) {
    return {
      budgetIcon: null,
      budgetColor: null,
    };
  }

  return {
    budgetIcon: payload.budgetIcon
      ? normalizeBudgetIcon(payload.budgetIcon)
      : null,
    budgetColor: payload.budgetColor
      ? normalizeBudgetColor(payload.budgetColor)
      : null,
  };
};

export const quickExpenseRecoveryEntryFromOutboxOperation = (
  operation: ExpenseOutboxOperation,
  now = Date.now()
): TQuickExpenseRecoveryEntry | null => {
  if (
    operation.entity !== "expenses" ||
    operation.lastError === null ||
    !isRecoverableExpense(operation.payload)
  ) {
    return null;
  }

  const { category, paidBy } = operation.payload;
  if (!isCategory(category) || !isPaidBy(paidBy)) {
    return null;
  }
  const budgetAppearance = getRecoveryBudgetAppearance(operation.payload);

  const draft: TQuickExpenseDraft = {
    clientId: operation.clientId,
    date: formatRecoveryDraftDate(operation.payload.date),
    amount: operation.payload.amount,
    note: operation.payload.note,
    category,
    paidBy,
    budgetId: operation.payload.budgetId,
    budgetName: operation.payload.budgetName,
    budgetIcon: budgetAppearance.budgetIcon,
    budgetColor: budgetAppearance.budgetColor,
  };

  const mode =
    operation.type === "update"
      ? "edit"
      : operation.type === "delete"
        ? "delete"
        : "create";
  const serverId = operation.serverId ?? operation.payload.serverId;

  return {
    operationId: operation.operationId,
    mode,
    clientId: operation.clientId,
    serverId,
    transactionId:
      (mode === "edit" || mode === "delete") && serverId !== null
        ? serverId
        : undefined,
    draft,
    payload: draft,
    status: "failed",
    lastError: operation.lastError,
    createdAt: getOperationRecoveryStartedAt(operation, now),
  };
};

export const normalizeQuickExpenseRecoveryPersistedState = (
  state: Partial<TQuickExpenseRecoveryPersistedState>
): TQuickExpenseRecoveryPersistedState => ({
  activeRecoveryOperationId:
    typeof state.activeRecoveryOperationId === "string"
      ? state.activeRecoveryOperationId
      : null,
  dismissedErrorsByOperationId: Object.fromEntries(
    Object.entries(state.dismissedErrorsByOperationId ?? {}).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === "string" && typeof entry[1] === "string"
    )
  ),
});

const getHydratedQuickExpenseRecoveryPersistedState = (
  persistedState: unknown
): TQuickExpenseRecoveryPersistedState | null => {
  if (!isRecord(persistedState)) {
    return null;
  }

  return normalizeQuickExpenseRecoveryPersistedState({
    activeRecoveryOperationId:
      typeof persistedState.activeRecoveryOperationId === "string"
        ? persistedState.activeRecoveryOperationId
        : null,
    dismissedErrorsByOperationId: isRecord(
      persistedState.dismissedErrorsByOperationId
    )
      ? (persistedState.dismissedErrorsByOperationId as Record<string, string>)
      : {},
  });
};

const createQuickExpenseRecoveryState = (
  set: (
    partial:
      | Partial<TQuickExpenseRecoveryState>
      | ((
          state: TQuickExpenseRecoveryState
        ) => Partial<TQuickExpenseRecoveryState>)
  ) => void,
  get: () => TQuickExpenseRecoveryState,
  initState: TQuickExpenseRecoveryPersistedState = defaultPersistedState
): TQuickExpenseRecoveryState => ({
  entries: {},
  ...initState,
  syncFailedOutboxEntries: (operations, now = Date.now()) =>
    set((state) => {
      const incomingEntries = operations.flatMap((operation) => {
        const entry = quickExpenseRecoveryEntryFromOutboxOperation(
          operation,
          now
        );
        return entry ? [entry] : [];
      });
      const incomingOperationIds = new Set(
        incomingEntries.map((entry) => entry.operationId)
      );
      const dismissedErrorsByOperationId = Object.fromEntries(
        Object.entries(state.dismissedErrorsByOperationId).filter(
          ([operationId]) => incomingOperationIds.has(operationId)
        )
      );
      const entries = Object.fromEntries(
        incomingEntries.flatMap((entry) => {
          if (
            dismissedErrorsByOperationId[entry.operationId] ===
            getDismissedRecoveryKey(entry)
          ) {
            return [];
          }

          const existing = state.entries[entry.operationId];
          const preserveNotification =
            existing && existing.lastError === entry.lastError;

          return [
            [
              entry.operationId,
              {
                ...entry,
                ...(preserveNotification &&
                typeof existing.toastId !== "undefined"
                  ? { toastId: existing.toastId }
                  : {}),
                ...(preserveNotification &&
                typeof existing.notifiedAt !== "undefined"
                  ? { notifiedAt: existing.notifiedAt }
                  : {}),
              },
            ],
          ];
        })
      );
      const activeRecoveryOperationId =
        state.activeRecoveryOperationId &&
        state.activeRecoveryOperationId in entries
          ? state.activeRecoveryOperationId
          : null;

      return {
        entries,
        activeRecoveryOperationId,
        dismissedErrorsByOperationId,
      };
    }),
  markNotified: (operationId, toastId, now = Date.now()) =>
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
            notifiedAt: now,
          },
        },
      };
    }),
  clear: (operationId) =>
    set((state) => {
      const entry = state.entries[operationId];
      const { [operationId]: _entry, ...entries } = state.entries;

      return {
        entries,
        dismissedErrorsByOperationId: entry
          ? {
              ...state.dismissedErrorsByOperationId,
              [operationId]: getDismissedRecoveryKey(entry),
            }
          : state.dismissedErrorsByOperationId,
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
      const dismissedExpiredEntries = Object.fromEntries(
        Object.values(state.entries)
          .filter(
            (entry) => now - entry.createdAt > QUICK_EXPENSE_RECOVERY_TTL_MS
          )
          .map((entry) => [entry.operationId, getDismissedRecoveryKey(entry)])
      );
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
        dismissedErrorsByOperationId: {
          ...state.dismissedErrorsByOperationId,
          ...dismissedExpiredEntries,
        },
        activeRecoveryOperationId: activeEntryExists
          ? state.activeRecoveryOperationId
          : null,
      };
    }),
  getUnnotifiedFailedEntries: () =>
    Object.values(get().entries).filter((entry) => !entry.notifiedAt),
});

export const getPersistableQuickExpenseRecoveryState = (
  state: TQuickExpenseRecoveryState
): TQuickExpenseRecoveryPersistedState =>
  normalizeQuickExpenseRecoveryPersistedState({
    activeRecoveryOperationId: state.activeRecoveryOperationId,
    dismissedErrorsByOperationId: state.dismissedErrorsByOperationId,
  });

export const mergeQuickExpenseRecoveryPersistedState = (
  persistedState: unknown,
  currentState: TQuickExpenseRecoveryState
): TQuickExpenseRecoveryState => {
  const hydratedState =
    getHydratedQuickExpenseRecoveryPersistedState(persistedState);

  if (!hydratedState) {
    return currentState;
  }

  return {
    ...currentState,
    ...hydratedState,
    entries: {},
  };
};

export const createQuickExpenseRecoveryStore = (
  initState: TQuickExpenseRecoveryPersistedState = defaultPersistedState
) =>
  createStore<TQuickExpenseRecoveryState>()((set, get) =>
    createQuickExpenseRecoveryState(set, get, initState)
  );

export const useQuickExpenseRecoveryStore =
  create<TQuickExpenseRecoveryState>()(
    persist((set, get) => createQuickExpenseRecoveryState(set, get), {
      name: "quick-expense-recovery",
      version: 2,
      storage: createJSONStorage(() => sessionStorage),
      partialize: getPersistableQuickExpenseRecoveryState,
      merge: mergeQuickExpenseRecoveryPersistedState,
    })
  );
