"use client";

import { useEffect } from "react";

import { requestExpenseSync } from "@/lib/sync/expenses/scheduler";
import { useQueryClient } from "@tanstack/react-query";

const ExpenseSyncCoordinator = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const runSync = () => {
      void requestExpenseSync(queryClient);
    };

    runSync();

    window.addEventListener("online", runSync);
    window.addEventListener("focus", runSync);

    return () => {
      window.removeEventListener("online", runSync);
      window.removeEventListener("focus", runSync);
    };
  }, [queryClient]);

  return null;
};

export default ExpenseSyncCoordinator;
