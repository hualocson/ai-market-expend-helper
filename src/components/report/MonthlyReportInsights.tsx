import React from "react";

import type { MonthlyReportInsights as MonthlyReportInsightsData } from "@/lib/reports/monthly-insights";

import BudgetVarianceCard from "./BudgetVarianceCard";
import MonthTrendChart from "./MonthTrendChart";
import MonthlyPulseCard from "./MonthlyPulseCard";
import RecurringSpendCard from "./RecurringSpendCard";
import TopMerchantsCard from "./TopMerchantsCard";

type MonthlyReportInsightsProps = {
  insights: MonthlyReportInsightsData;
};

const MonthlyReportInsights = ({ insights }: MonthlyReportInsightsProps) => {
  return (
    <section className="flex flex-col gap-4" aria-label="Monthly insights">
      <MonthlyPulseCard pulse={insights.pulse} />
      <MonthTrendChart points={insights.monthTrend} />
      <BudgetVarianceCard budgetVariance={insights.budgetVariance} />
      <TopMerchantsCard merchants={insights.topMerchants} />
      <RecurringSpendCard recurringSpend={insights.recurringSpend} />
    </section>
  );
};

export default MonthlyReportInsights;
