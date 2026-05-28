"use client";

import { queries } from "@/lib/queries";
import { useSuspenseQuery } from "@tanstack/react-query";

import SpendingDashboardHeaderClient from "@/components/SpendingDashboardHeaderClient";

type SpendingDashboardHeaderProps = {
  selectedMonth?: string;
};

const SpendingDashboardHeader = ({
  selectedMonth,
}: SpendingDashboardHeaderProps) => {
  const { data: summary } = useSuspenseQuery(
    queries.dashboard.monthlySummary(selectedMonth)
  );

  return (
    <SpendingDashboardHeaderClient
      activeMonth={summary.activeMonth}
      payerOptions={summary.payerOptions}
      totalsByPayer={summary.totalsByPayer}
    />
  );
};

export default SpendingDashboardHeader;
