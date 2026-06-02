import React from "react";

import type { InferredMerchantSummary } from "@/lib/reports/monthly-insights";
import { formatVnd } from "@/lib/utils";
import { Store } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

import VndSymbol from "@/components/VndSymbol";
import InsightCardTitle from "@/components/report/InsightCardTitle";

type TopMerchantsCardProps = {
  merchants: InferredMerchantSummary[];
};

const TopMerchantsCard = ({ merchants }: TopMerchantsCardProps) => {
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-4 pb-0">
        <InsightCardTitle icon={Store}>
          Top merchants from notes
        </InsightCardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {merchants.length ? (
          <div className="flex flex-col gap-2">
            {merchants.map((merchant) => (
              <div
                key={merchant.key}
                className="bg-muted/20 flex min-h-16 flex-col items-start gap-3 rounded-2xl px-3 py-3 sm:flex-row sm:justify-between"
              >
                <div className="max-w-full min-w-0">
                  <div className="text-foreground truncate text-sm font-medium">
                    {merchant.label}
                  </div>
                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <span>{merchant.count} expenses</span>
                    {merchant.topCategory ? (
                      <span>{merchant.topCategory}</span>
                    ) : null}
                    {merchant.topPaidBy ? (
                      <span>{merchant.topPaidBy}</span>
                    ) : null}
                  </div>
                  {merchant.representativeNotes.length ? (
                    <div className="text-muted-foreground mt-2 line-clamp-1 text-xs">
                      {merchant.representativeNotes[0]}
                    </div>
                  ) : null}
                </div>
                <div className="text-foreground flex max-w-full flex-wrap items-center gap-x-1 gap-y-1 text-sm font-semibold break-all tabular-nums sm:justify-end sm:text-right">
                  {formatVnd(merchant.total)}
                  <VndSymbol className="size-3.5" aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-muted-foreground bg-muted/30 rounded-2xl px-3 py-4 text-sm">
            No merchant groups found for this month.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TopMerchantsCard;
