"use client";

import type { TBudget } from "@/db/schema";
import type { CreateExpenseInput } from "@/db/type";
import { ApiResponseError, unwrapApiResponse } from "@/lib/api/api-response";
import { queries } from "@/lib/queries";
import type {
  TransferBudgetInput,
  TransferBudgetResult,
} from "@/lib/services/budget-transfer";
import {
  createLocalExpense,
  deleteLocalExpense,
  updateLocalExpense,
} from "@/lib/sync/expenses/actions";
import { requestExpenseSync } from "@/lib/sync/expenses/scheduler";
import { expenseSyncStore } from "@/lib/sync/expenses/store";
import type { LocalExpense } from "@/lib/sync/expenses/types";
import type {
  BudgetCreateInput,
  BudgetUpdateInput,
  ExpenseBudgetInput,
} from "@/types/budget-weekly";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

type UpdateExpenseVariables = {
  id: number;
  input: CreateExpenseInput;
};

type DeleteExpenseVariables =
  | number
  | {
      id: number;
      clientId?: string | null;
    };

type UpdateBudgetVariables = {
  id: number;
  input: BudgetUpdateInput;
};

const jsonHeaders = {
  "Content-Type": "application/json",
};

const readJsonError = async (response: Response, fallback: string) => {
  const payload = await response.json().catch(() => null);

  try {
    unwrapApiResponse<never>(payload, response.status);
  } catch (error) {
    if (error instanceof ApiResponseError) {
      return error.message;
    }
  }

  return fallback;
};

const fetchJsonMutation = async <TResponse, TInput>(
  input: RequestInfo | URL,
  {
    method,
    body,
    fallbackError,
  }: {
    method: "POST" | "PATCH" | "DELETE";
    body?: TInput;
    fallbackError: string;
  }
): Promise<TResponse> => {
  const response = await fetch(input, {
    method,
    headers: typeof body === "undefined" ? undefined : jsonHeaders,
    body: typeof body === "undefined" ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readJsonError(response, fallbackError));
  }

  return unwrapApiResponse<TResponse>(await response.json(), response.status);
};

const invalidateExpenseMutationQueries = async (queryClient: QueryClient) => {
  await queryClient.invalidateQueries({ queryKey: queries.expenses._def });
  await queryClient.invalidateQueries({ queryKey: queries.dashboard._def });
  await queryClient.invalidateQueries({ queryKey: queries.reports._def });
  await queryClient.invalidateQueries({
    queryKey: queries.budgets.overview.queryKey,
  });
  await queryClient.invalidateQueries({
    queryKey: queries.budgetWeekly.options._def,
  });
};

const requestExpenseSyncAfterLocalWrite = (queryClient: QueryClient) => {
  void requestExpenseSync(queryClient);
};

const requestExpenseSyncAfterBudgetMetadataChange = (
  queryClient: QueryClient,
  input: BudgetUpdateInput
) => {
  if (
    typeof input.name === "string" ||
    typeof input.icon === "string" ||
    typeof input.color === "string"
  ) {
    void requestExpenseSync(queryClient);
  }
};

const invalidateBudgetMutationQueries = async (queryClient: QueryClient) => {
  await queryClient.invalidateQueries({ queryKey: queries.budgets._def });
  await queryClient.invalidateQueries({ queryKey: queries.budgetWeekly._def });
};

const invalidateBudgetUpdateMutationQueries = async (
  queryClient: QueryClient
) => {
  await invalidateBudgetMutationQueries(queryClient);
  await queryClient.invalidateQueries({ queryKey: queries.expenses._def });
  await queryClient.invalidateQueries({ queryKey: queries.reports._def });
};

const invalidateBudgetDeleteMutationQueries = async (
  queryClient: QueryClient,
  deletedBudgetId: number
) => {
  await queryClient.cancelQueries({
    queryKey: queries.budgets.transactions(deletedBudgetId).queryKey,
  });
  await queryClient.invalidateQueries({
    queryKey: queries.budgets.overview.queryKey,
  });
  await queryClient.invalidateQueries({
    queryKey: queries.budgets.transferCandidates._def,
  });
  await queryClient.invalidateQueries({ queryKey: queries.budgetWeekly._def });
  await queryClient.invalidateQueries({ queryKey: queries.expenses._def });
  await queryClient.invalidateQueries({ queryKey: queries.reports._def });
};

const invalidateTransactionBudgetMutationQueries = async (
  queryClient: QueryClient
) => {
  await queryClient.invalidateQueries({ queryKey: queries.budgets._def });
  await queryClient.invalidateQueries({ queryKey: queries.budgetWeekly._def });
  await queryClient.invalidateQueries({ queryKey: queries.expenses._def });
  await queryClient.invalidateQueries({ queryKey: queries.reports._def });
};

const invalidateTransferBudgetMutationQueries = async (
  queryClient: QueryClient
) => {
  await queryClient.invalidateQueries({ queryKey: queries.budgets._def });
  await queryClient.invalidateQueries({ queryKey: queries.budgetWeekly._def });
  await queryClient.invalidateQueries({
    queryKey: queries.budgets.transferCandidates._def,
  });
};

const mapTransferError = (message: string): TransferBudgetResult | null => {
  if (message === "Insufficient source budget amount") {
    return { ok: false, code: "INSUFFICIENT_CAP" };
  }
  if (message === "Budget not found") {
    return { ok: false, code: "NOT_FOUND" };
  }
  return null;
};

const buildServerExpenseClientId = (serverId: number) => `server-${serverId}`;

const findExpenseClientIdByServerId = (serverId: number) =>
  Object.values(expenseSyncStore.getState().expensesByClientId).find(
    (expense) => expense.serverId === serverId
  )?.clientId;

const ensureLocalExpenseForUpdate = (
  serverId: number,
  input: CreateExpenseInput
) => {
  if (
    input.clientId &&
    expenseSyncStore.getState().expensesByClientId[input.clientId]
  ) {
    return input.clientId;
  }

  const existingClientId = findExpenseClientIdByServerId(serverId);
  if (existingClientId) {
    return existingClientId;
  }

  const clientId = input.clientId ?? buildServerExpenseClientId(serverId);
  const now = new Date().toISOString();
  const expense: LocalExpense = {
    entity: "expenses",
    clientId,
    serverId,
    date: input.date,
    amount: input.amount,
    note: input.note?.trim() ?? "",
    category: input.category,
    paidBy: input.paidBy,
    budgetId: input.budgetId ?? null,
    budgetName: input.budgetName ?? null,
    budgetIcon: input.budgetIcon ?? null,
    budgetColor: input.budgetColor ?? null,
    syncStatus: "synced",
    lastError: null,
    updatedAt: now,
    serverUpdatedAt: null,
  };

  expenseSyncStore.getState().upsertExpense(expense);

  return clientId;
};

const normalizeDeleteExpenseVariables = (variables: DeleteExpenseVariables) => {
  if (typeof variables === "number") {
    return { id: variables, clientId: null };
  }

  return variables;
};

const ensureLocalExpenseForDelete = (variables: DeleteExpenseVariables) => {
  const { id: serverId, clientId: providedClientId } =
    normalizeDeleteExpenseVariables(variables);
  if (providedClientId) {
    return providedClientId;
  }

  const existingClientId = findExpenseClientIdByServerId(serverId);
  if (existingClientId) {
    return existingClientId;
  }

  const clientId = buildServerExpenseClientId(serverId);
  const now = new Date().toISOString();
  const expense: LocalExpense = {
    entity: "expenses",
    clientId,
    serverId,
    date: "",
    amount: 0,
    note: "",
    category: "",
    paidBy: "",
    budgetId: null,
    budgetName: null,
    budgetIcon: null,
    budgetColor: null,
    syncStatus: "synced",
    lastError: null,
    updatedAt: now,
    serverUpdatedAt: null,
  };

  expenseSyncStore.getState().upsertExpense(expense);

  return clientId;
};

const postBudgetTransfer = async (
  input: TransferBudgetInput
): Promise<TransferBudgetResult> => {
  const response = await fetch("/api/budgets/transfer", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const message = await readJsonError(
      response,
      "Failed to transfer budget amount"
    );
    const result = mapTransferError(message);
    if (result) {
      return result;
    }
    throw new Error(message);
  }

  return unwrapApiResponse<TransferBudgetResult>(
    await response.json(),
    response.status
  );
};

export const useCreateExpenseMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateExpenseInput) =>
      createLocalExpense(expenseSyncStore, input),
    onSuccess: async () => {
      await invalidateExpenseMutationQueries(queryClient);
      requestExpenseSyncAfterLocalWrite(queryClient);
    },
  });
};

export const useUpdateExpenseMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: UpdateExpenseVariables) =>
      updateLocalExpense(
        expenseSyncStore,
        ensureLocalExpenseForUpdate(id, input),
        input
      ),
    onSuccess: async () => {
      await invalidateExpenseMutationQueries(queryClient);
      requestExpenseSyncAfterLocalWrite(queryClient);
    },
  });
};

export const useDeleteExpenseMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: DeleteExpenseVariables) =>
      deleteLocalExpense(
        expenseSyncStore,
        ensureLocalExpenseForDelete(variables)
      ),
    onSuccess: async () => {
      await invalidateExpenseMutationQueries(queryClient);
      requestExpenseSyncAfterLocalWrite(queryClient);
    },
  });
};

export const useCreateBudgetMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BudgetCreateInput) =>
      fetchJsonMutation<TBudget, BudgetCreateInput>("/api/weekly-budgets", {
        method: "POST",
        body: input,
        fallbackError: "Failed to create budget",
      }),
    onSuccess: () => invalidateBudgetMutationQueries(queryClient),
  });
};

export const useUpdateBudgetMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: UpdateBudgetVariables) =>
      fetchJsonMutation<TBudget, BudgetUpdateInput>(
        `/api/weekly-budgets/${id}`,
        {
          method: "PATCH",
          body: input,
          fallbackError: "Failed to update budget",
        }
      ),
    onSuccess: async (_updated, variables) => {
      await invalidateBudgetUpdateMutationQueries(queryClient);
      requestExpenseSyncAfterBudgetMetadataChange(queryClient, variables.input);
    },
  });
};

export const useDeleteBudgetMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetchJsonMutation<TBudget, undefined>(`/api/weekly-budgets/${id}`, {
        method: "DELETE",
        fallbackError: "Failed to delete budget",
      }),
    onSuccess: async (_deleted, id) => {
      await invalidateBudgetDeleteMutationQueries(queryClient, id);
      void requestExpenseSync(queryClient);
    },
  });
};

export const useAssignTransactionBudgetMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ExpenseBudgetInput) =>
      fetchJsonMutation<ExpenseBudgetInput, ExpenseBudgetInput>(
        "/api/transaction-budget",
        {
          method: "POST",
          body: input,
          fallbackError: "Failed to update transaction budget",
        }
      ),
    onSuccess: () => invalidateTransactionBudgetMutationQueries(queryClient),
  });
};

export const useTransferBudgetMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postBudgetTransfer,
    onSuccess: async (result) => {
      if (result.ok) {
        await invalidateTransferBudgetMutationQueries(queryClient);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: queries.budgets._def });
    },
  });
};
