import { getQueryClient } from "@/lib/get-query-client";
import { queries } from "@/lib/queries";
import { getDailyReport } from "@/lib/services/reports";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import DailyReportContent from "@/components/DailyReportContent";

interface DailyReportPageProps {
  params: Promise<{
    date: string;
  }>;
}

export default async function DailyReportPage({
  params,
}: DailyReportPageProps) {
  const { date } = await params;
  const queryClient = getQueryClient();

  void queryClient.prefetchQuery({
    queryKey: queries.reports.daily(date).queryKey,
    queryFn: () => getDailyReport(date),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DailyReportContent date={date} />
    </HydrationBoundary>
  );
}
