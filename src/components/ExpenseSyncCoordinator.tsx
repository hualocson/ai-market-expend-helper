"use client";

import { useEffect } from "react";

import type { ExpenseListResult } from "@/lib/expenses/list-model";
import { queries } from "@/lib/queries";
import { seedExpenseListResultInSyncStorage } from "@/lib/sync/expenses/coordinator";
import { requestExpenseSync } from "@/lib/sync/expenses/scheduler";
import {
  type InfiniteData,
  type QueryClient,
  useQueryClient,
} from "@tanstack/react-query";

const HOME_EXPENSE_LIST_PARAMS = { limit: 30 };

const seedHydratedHomeExpenseList = async (queryClient: QueryClient) => {
  const data = queryClient.getQueryData<
    InfiniteData<ExpenseListResult, number>
  >(queries.expenses.list(HOME_EXPENSE_LIST_PARAMS).queryKey);
  const firstPage = data?.pages[0];
  if (!firstPage) {
    return;
  }

  await seedExpenseListResultInSyncStorage(firstPage);
};

const ExpenseSyncCoordinator = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;
    const requestSyncIfActive = () => {
      if (active) {
        void requestExpenseSync(queryClient);
      }
    };

    const runBootstrapSync = async () => {
      try {
        await seedHydratedHomeExpenseList(queryClient);
      } catch {
        // Normal sync still owns reconciliation and should run even if bootstrap seeding fails.
      }
      requestSyncIfActive();
    };

    void runBootstrapSync();

    window.addEventListener("online", requestSyncIfActive);
    window.addEventListener("focus", requestSyncIfActive);

    return () => {
      active = false;
      window.removeEventListener("online", requestSyncIfActive);
      window.removeEventListener("focus", requestSyncIfActive);
    };
  }, [queryClient]);

  return null;
};

export default ExpenseSyncCoordinator;
