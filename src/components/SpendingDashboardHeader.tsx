import { getDashboardMonthlySummary } from "@/lib/services/dashboard";

import SpendingDashboardHeaderClient from "@/components/SpendingDashboardHeaderClient";

type SpendingDashboardHeaderProps = {
  selectedMonth?: string;
};

const SpendingDashboardHeader = async ({
  selectedMonth,
}: SpendingDashboardHeaderProps) => {
  const summary = await getDashboardMonthlySummary(selectedMonth);

  return (
    <SpendingDashboardHeaderClient
      activeMonth={summary.activeMonth}
      payerOptions={summary.payerOptions}
      totalsByPayer={summary.totalsByPayer}
    />
  );
};

export default SpendingDashboardHeader;
