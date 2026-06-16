import { getQueryClient } from "@/lib/get-query-client";
import { queries } from "@/lib/queries";
import { getMonthlyReport } from "@/lib/services/reports";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import MonthlyReportContent from "@/components/MonthlyReportContent";

interface ReportPageProps {
  searchParams: Promise<{
    month?: string;
  }>;
}

export default async function ReportPage({ searchParams }: ReportPageProps) {
  const { month } = await searchParams;
  const selectedMonth = typeof month === "string" ? month : undefined;
  const queryClient = getQueryClient();

  void queryClient.prefetchQuery({
    queryKey: queries.reports.monthly(selectedMonth).queryKey,
    queryFn: () => getMonthlyReport(selectedMonth),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MonthlyReportContent selectedMonth={selectedMonth} />
    </HydrationBoundary>
  );
}
