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
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="bg-surface-3 border-border/70 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <SiriOrb size="40px" className="shrink-0" />
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
                Main account
              </p>
              <p className="text-foreground/75 truncate text-sm">{subtitle}</p>
            </div>
          </div>

          <Select value={activePayer} onValueChange={setActivePayer}>
            <SelectTrigger className="bg-surface-3 border-border/70 hover:bg-secondary focus-visible:border-ring/40 focus-visible:ring-ring/30 h-11 min-w-30 rounded-full px-4 text-sm font-medium shadow-none transition">
              <SelectValue placeholder="Select payer" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border rounded-2xl shadow-xl">
              {payerOptions.map((payer) => (
                <SelectItem key={payer} value={payer}>
                  {payer}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="ds-glass relative flex items-end justify-between gap-4 overflow-hidden rounded-[28px] border px-4 py-4">
          <span
            aria-hidden="true"
            className="bg-primary/18 pointer-events-none absolute -top-6 -right-8 h-24 w-24 rounded-full blur-2xl"
          />
          <div className="relative z-10 min-w-0">
            <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
              Total spent
            </p>
            <p className="text-foreground font-mono text-[32px] font-semibold tracking-tight tabular-nums">
              {formatVnd(activeTotals?.total ?? 0)} VND
            </p>
          </div>
          <span className="relative z-10 rounded-full border border-[color-mix(in_srgb,var(--accent)_42%,transparent)] bg-[color-mix(in_srgb,var(--accent)_26%,transparent)] px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-[color-mix(in_srgb,var(--accent)_90%,white)] uppercase">
            Live
          </span>
        </div>

        <div className="ds-glass rounded-[28px] border p-4">
          <div className="flex items-center justify-between">
            <p className="text-foreground/80 text-xs font-semibold">
              Spending trend
            </p>
            <span className="text-muted-foreground bg-surface-3 border-border/70 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.2em] uppercase">
              This month
            </span>
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
