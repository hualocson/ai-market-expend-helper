"use client";

import React, { useEffect, useState } from "react";

import dynamic from "next/dynamic";

const QuickExpenseMutationCoordinator = dynamic(
  () => import("@/components/QuickExpenseMutationCoordinator"),
  { ssr: false }
);
const QuickExpenseRecoverySheetHost = dynamic(
  () => import("@/components/QuickExpenseRecoverySheetHost"),
  { ssr: false }
);

export default function DeferredRecoveryWork() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setReady(true), 500);

    return () => window.clearTimeout(timeoutId);
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <>
      <QuickExpenseMutationCoordinator />
      <QuickExpenseRecoverySheetHost />
    </>
  );
}
