"use client";

import { useMemo, useState } from "react";

import { formatVnd } from "@/lib/utils";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import SpendingTrendChart from "@/components/SpendingTrendChart";

import SiriOrb from "./ui/siri-orb";

type SpendingDashboardHeaderClientProps = {
  activeMonthLabel: string;
  payerOptions: string[];
  totalsByPayer: Record<string, { total: number; totals: number[] }>;
};

const SpendingDashboardHeaderClient = ({
  activeMonthLabel,
  payerOptions,
  totalsByPayer,
}: SpendingDashboardHeaderClientProps) => {
  const initialPayer = payerOptions[0] ?? "All";
  const [activePayer, setActivePayer] = useState(initialPayer);

  const activeTotals = useMemo(() => {
    return totalsByPayer[activePayer] ?? totalsByPayer[initialPayer];
  }, [activePayer, initialPayer, totalsByPayer]);

  const subtitle =
    activePayer === "All"
      ? `Spent in ${activeMonthLabel}`
      : `Spent by ${activePayer} in ${activeMonthLabel}`;

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <SiriOrb size="40px" className="shrink-0" />
          <p className="text-[32px] font-semibold tracking-tight text-white">
            {formatVnd(activeTotals?.total ?? 0)} VND
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-slate-400">{subtitle}</p>
          <Select value={activePayer} onValueChange={setActivePayer}>
            <SelectTrigger className="h-10 w-32 focus-visible:border-0 focus-visible:border-transparent focus-visible:ring-0">
              <SelectValue placeholder="Select payer" />
            </SelectTrigger>
            <SelectContent>
              {payerOptions.map((payer) => (
                <SelectItem key={payer} value={payer}>
                  {payer}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[28px] bg-white/5 p-4 shadow-[0_25px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(78,241,255,0.22),transparent_55%),radial-gradient(circle_at_80%_0%,rgba(58,242,162,0.12),transparent_50%)]" />
        <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(58,242,162,0.25),transparent_60%)] blur-2xl" />

        <div className="relative">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-300">
              Spending trend
            </p>
            <span className="text-xs text-slate-500">This month</span>
          </div>

          <div className="mt-4">
            <SpendingTrendChart totals={activeTotals?.totals ?? []} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default SpendingDashboardHeaderClient;
