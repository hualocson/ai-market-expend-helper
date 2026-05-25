import type { QueryClient } from "@tanstack/react-query";

import { syncExpensesNow } from "./coordinator";

type ExpenseSyncRunner = (queryClient: QueryClient) => Promise<void>;

type ExpenseSyncSchedulerOptions = {
  syncNow?: ExpenseSyncRunner;
  onError?: (error: unknown) => void;
};

export type ExpenseSyncScheduler = {
  request: (queryClient: QueryClient) => Promise<void>;
};

const defaultOnError = (error: unknown) => {
  console.warn("Failed to sync expenses:", error);
};

export const createExpenseSyncScheduler = ({
  syncNow = syncExpensesNow,
  onError = defaultOnError,
}: ExpenseSyncSchedulerOptions = {}): ExpenseSyncScheduler => {
  let runningPromise: Promise<void> | null = null;
  let followUpRequested = false;
  let latestQueryClient: QueryClient | null = null;

  const drainQueue = async (initialQueryClient: QueryClient) => {
    latestQueryClient = initialQueryClient;

    do {
      followUpRequested = false;
      const queryClient = latestQueryClient;

      if (!queryClient) {
        return;
      }

      try {
        await syncNow(queryClient);
      } catch (error) {
        onError(error);
      }
    } while (followUpRequested);
  };

  return {
    request: (queryClient) => {
      latestQueryClient = queryClient;

      if (runningPromise) {
        followUpRequested = true;
        return runningPromise;
      }

      runningPromise = drainQueue(queryClient).finally(() => {
        runningPromise = null;
        latestQueryClient = null;
      });

      return runningPromise;
    },
  };
};

const expenseSyncScheduler = createExpenseSyncScheduler();

export const requestExpenseSync = (queryClient: QueryClient): Promise<void> =>
  expenseSyncScheduler.request(queryClient);
