import { Skeleton } from "@/components/ui/skeleton";

const MonthlyReportSkeleton = () => {
  return (
    <div className="relative mx-auto flex max-w-lg flex-col items-stretch gap-3 px-4 pt-6 sm:px-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-6 w-24" />
      </div>
      <Skeleton className="h-9 w-full rounded-full" />
      <Skeleton className="h-56 w-full rounded-3xl" />
      <Skeleton className="h-40 w-full rounded-3xl" />
    </div>
  );
};

export default MonthlyReportSkeleton;
