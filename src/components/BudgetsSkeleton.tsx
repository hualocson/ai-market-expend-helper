import { Skeleton } from "@/components/ui/skeleton";

const BudgetsSkeleton = () => {
  return (
    <div className="relative mx-auto flex max-w-md flex-col gap-4 px-4 pt-6 sm:px-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-9 rounded-full" />
      </div>
      <Skeleton className="h-24 w-full rounded-3xl" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
};

export default BudgetsSkeleton;
