import { Skeleton } from "@/components/ui/skeleton";

const DailyReportSkeleton = () => {
  return (
    <div className="relative mx-auto flex max-w-lg flex-col gap-4 px-4 pt-6 pb-6 sm:px-6">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <Skeleton className="h-64 w-full rounded-3xl" />
      <Skeleton className="h-56 w-full rounded-3xl" />
      <Skeleton className="h-40 w-full rounded-3xl" />
    </div>
  );
};

export default DailyReportSkeleton;
