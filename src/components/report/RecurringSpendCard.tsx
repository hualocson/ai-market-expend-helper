import React from "react";

import type { RecurringSpendCandidate } from "@/lib/reports/monthly-insights";
import { formatVnd } from "@/lib/utils";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import VndSymbol from "@/components/VndSymbol";

type RecurringSpendCardProps = {
  recurringSpend: RecurringSpendCandidate[];
};

const cadenceLabel = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
  "near-monthly": "Near monthly",
} satisfies Record<RecurringSpendCandidate["cadence"], string>;

const RecurringSpendCard = ({ recurringSpend }: RecurringSpendCardProps) => {
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-4 pb-0">
        <CardTitle className="text-base text-balance">
          Recurring spend
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {recurringSpend.length ? (
          <div className="flex flex-col gap-2">
            {recurringSpend.map((item) => (
              <div
                key={item.key}
                className="bg-muted/20 flex min-h-16 items-start justify-between gap-3 rounded-2xl px-3 py-3"
              >
                <div className="min-w-0">
                  <div className="text-foreground truncate text-sm font-medium">
                    {item.label}
                  </div>
                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span>{cadenceLabel[item.cadence]}</span>
                    <span>{item.matchedExpenseIds.length} matches</span>
                    <span>{item.confidence} confidence</span>
                  </div>
                  <div className="text-muted-foreground mt-2 line-clamp-1 text-xs">
                    {item.evidenceDates.join(" / ")}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-foreground flex items-center gap-1 text-sm font-semibold tabular-nums">
                    {formatVnd(item.selectedMonthImpact)}
                    <VndSymbol className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1 text-xs tabular-nums">
                    avg {formatVnd(item.averageAmount)}
                    <VndSymbol className="size-3" aria-hidden="true" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground bg-muted/30 rounded-2xl px-3 py-4 text-sm">
            No recurring patterns detected yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecurringSpendCard;
