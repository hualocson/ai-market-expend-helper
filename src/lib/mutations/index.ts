"use client";

import type { TBudget, TExpense } from "@/db/schema";
import type { CreateExpenseInput } from "@/db/type";
import {
  applyOptimisticExpenseCreate,
  applyOptimisticExpenseDelete,
  applyOptimisticExpenseUpdate,
  restoreExpenseListSnapshots,
} from "@/lib/mutations/expense-optimistic";
import { queries } from "@/lib/queries";
import type {
  TransferBudgetInput,
  TransferBudgetResult,
} from "@/lib/services/budget-transfer";
import type {
  BudgetCreateInput,
  BudgetUpdateInput,
  ExpenseBudgetInput,
} from "@/types/budget-weekly";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

type JsonErrorPayload = {
  error?: string;
};

type UpdateExpenseVariables = {
  id: number;
  input: CreateExpenseInput;
};

type UpdateBudgetVariables = {
  id: number;
  input: BudgetUpdateInput;
};

const jsonHeaders = {
  "Content-Type": "application/json",
};

const readJsonError = async (response: Response, fallback: string) => {
  const payload = (await response
    .json()
    .catch(() => null)) as JsonErrorPayload | null;
  return payload?.error ?? fallback;
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

  return (await response.json()) as TResponse;
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

const invalidateBudgetMutationQueries = async (queryClient: QueryClient) => {
  await queryClient.invalidateQueries({ queryKey: queries.budgets._def });
  await queryClient.invalidateQueries({ queryKey: queries.budgetWeekly._def });
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

  return (await response.json()) as TransferBudgetResult;
};

export const useCreateExpenseMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateExpenseInput) =>
      fetchJsonMutation<TExpense, CreateExpenseInput>("/api/expenses", {
        method: "POST",
        body: input,
        fallbackError: "Failed to create expense",
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: queries.expenses.list._def });
      return applyOptimisticExpenseCreate(queryClient, input);
    },
    onError: (_error, _input, context) => {
      restoreExpenseListSnapshots(queryClient, context);
    },
    onSettled: () => invalidateExpenseMutationQueries(queryClient),
  });
};

export const useUpdateExpenseMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: UpdateExpenseVariables) =>
      fetchJsonMutation<TExpense, CreateExpenseInput>(`/api/expenses/${id}`, {
        method: "PATCH",
        body: input,
        fallbackError: "Failed to update expense",
      }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queries.expenses.list._def });
      return applyOptimisticExpenseUpdate(queryClient, variables);
    },
    onError: (_error, _variables, context) => {
      restoreExpenseListSnapshots(queryClient, context);
    },
    onSettled: () => invalidateExpenseMutationQueries(queryClient),
  });
};

export const useDeleteExpenseMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) =>
      fetchJsonMutation<TExpense, undefined>(`/api/expenses/${id}`, {
        method: "DELETE",
        fallbackError: "Failed to delete expense",
      }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queries.expenses.list._def });
      return applyOptimisticExpenseDelete(queryClient, id);
    },
    onError: (_error, _id, context) => {
      restoreExpenseListSnapshots(queryClient, context);
    },
    onSettled: () => invalidateExpenseMutationQueries(queryClient),
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
    onSuccess: () => invalidateBudgetMutationQueries(queryClient),
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
