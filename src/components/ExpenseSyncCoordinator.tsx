"use client";

import { useEffect, useRef } from "react";

import { syncExpensesNow } from "@/lib/sync/expenses/coordinator";
import { useQueryClient } from "@tanstack/react-query";

const ExpenseSyncCoordinator = () => {
  const queryClient = useQueryClient();
  const syncPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    const runSync = () => {
      if (syncPromiseRef.current) {
        return;
      }

      const syncPromise = syncExpensesNow(queryClient)
        .catch((error: unknown) => {
          console.error("Failed to sync expenses:", error);
        })
        .finally(() => {
          if (syncPromiseRef.current === syncPromise) {
            syncPromiseRef.current = null;
          }
        });
      syncPromiseRef.current = syncPromise;
    };

    runSync();

    const handleOnline = () => runSync();
    const handleFocus = () => runSync();

    window.addEventListener("online", handleOnline);
    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("focus", handleFocus);
    };
  }, [queryClient]);

  return null;
};

export default ExpenseSyncCoordinator;
