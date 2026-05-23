"use client";

import { queries } from "@/lib/queries";
import { useQuery } from "@tanstack/react-query";

import SpendingDashboardHeaderClient from "@/components/SpendingDashboardHeaderClient";

type SpendingDashboardHeaderProps = {
  selectedMonth?: string;
};

const SpendingDashboardHeader = ({
  selectedMonth,
}: SpendingDashboardHeaderProps) => {
  const { data: summary } = useQuery(
    queries.dashboard.monthlySummary(selectedMonth)
  );

  if (!summary) {
    return null;
  }

  return (
    <SpendingDashboardHeaderClient
      activeMonth={summary.activeMonth}
      payerOptions={summary.payerOptions}
      totalsByPayer={summary.totalsByPayer}
    />
  );
};

export default SpendingDashboardHeader;
