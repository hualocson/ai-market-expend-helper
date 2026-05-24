"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";

import { formatVnd } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { motion as m } from "motion/react";
import { useReducedMotion } from "motion/react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import SpendingHeatmapChart from "@/components/SpendingHeatmapChart";
import VndSymbol from "@/components/VndSymbol";

const COUNTER_DURATION_MS = 500;

const easeOutCubic = (progress: number) => {
  return 1 - Math.pow(1 - progress, 3);
};

const AnimatedVndAmount = ({ amount }: { amount: number }) => {
  const shouldReduceMotion = useReducedMotion();
  const displayedAmountRef = useRef(0);
  const [displayedAmount, setDisplayedAmount] = useState(0);

  useEffect(() => {
    if (shouldReduceMotion) {
      displayedAmountRef.current = amount;
      setDisplayedAmount(amount);
      return;
    }

    const startAmount = displayedAmountRef.current;
    const delta = amount - startAmount;

    if (delta === 0) {
      setDisplayedAmount(amount);
      return;
    }

    let animationFrame = 0;
    let startedAt: number | null = null;

    const tick = (timestamp: number) => {
      startedAt ??= timestamp;

      const progress = Math.min(
        (timestamp - startedAt) / COUNTER_DURATION_MS,
        1
      );
      const nextAmount = Math.round(
        startAmount + delta * easeOutCubic(progress)
      );

      displayedAmountRef.current = nextAmount;
      setDisplayedAmount(nextAmount);

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(tick);
      } else {
        displayedAmountRef.current = amount;
        setDisplayedAmount(amount);
      }
    };

    animationFrame = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [amount, shouldReduceMotion]);

  return <span aria-hidden="true">{formatVnd(displayedAmount)}</span>;
};

type SpendingDashboardHeaderClientProps = {
  activeMonth: string;
  payerOptions: string[];
  totalsByPayer: Record<string, { total: number; totals: number[] }>;
};

const SpendingDashboardHeaderClient = ({
  activeMonth,
  payerOptions,
  totalsByPayer,
}: SpendingDashboardHeaderClientProps) => {
  const initialPayer = payerOptions[0] ?? "All";
  const [activePayer, setActivePayer] = useState(initialPayer);
  const activeTotals =
    totalsByPayer[activePayer] ?? totalsByPayer[initialPayer];
  const activeTotal = activeTotals?.total ?? 0;

  return (
    <>
      <div className="spending-header-gradient fixed top-0 right-0 left-0 z-30 flex w-dvw flex-col items-start gap-3 px-4 py-6">
        <m.p
          initial={{ opacity: 0, y: 10, filter: "blur(10px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          aria-label={`${formatVnd(activeTotal)} Vietnamese dong`}
          className="text-foreground flex max-w-full items-center gap-2 font-mono text-[clamp(2.65rem,12vw,4.75rem)] leading-none font-semibold tracking-[-0.08em] whitespace-nowrap tabular-nums"
        >
          <AnimatedVndAmount amount={activeTotal} />
          <VndSymbol />
        </m.p>

        <div className="flex items-center gap-2">
          <m.div
            initial={{ opacity: 0, x: -10, filter: "blur(10px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.3, ease: "easeInOut", delay: 0.2 }}
          >
            <Select value={activePayer} onValueChange={setActivePayer}>
              <SelectTrigger
                aria-label="Select expense payer"
                className="bg-surface-3/85 border-border/70 hover:bg-secondary focus-visible:border-ring/40 focus-visible:ring-ring/30 h-8 min-w-20 rounded-full px-3 text-xs font-semibold shadow-none transition"
              >
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border rounded-2xl shadow-xl">
                {payerOptions.map((payer) => (
                  <SelectItem key={payer} value={payer}>
                    {payer}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </m.div>

          <m.div
            initial={{ opacity: 0, x: -10, filter: "blur(10px)" }}
            animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.3, ease: "easeInOut", delay: 0.25 }}
          >
            <Link
              href="/ai"
              aria-label="Open Spendly AI expense chat"
              className="bg-primary/15 text-primary ring-primary/25 hover:bg-primary/20 focus-visible:ring-ring/40 flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold shadow-none ring-1 transition-[background-color,scale] duration-200 ease-out outline-none focus-visible:ring-2 active:scale-[0.96]"
            >
              <Sparkles aria-hidden="true" className="size-3.5" />
              <span>Spendly AI</span>
            </Link>
          </m.div>
        </div>
      </div>

      <m.div
        initial={{ opacity: 0, filter: "blur(10px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.3, ease: "easeInOut", delay: 0.3 }}
        className="border-border/45 bg-surface-2/65 mt-28 rounded-[28px] border p-3.5 shadow-sm backdrop-blur-sm"
      >
        <SpendingHeatmapChart
          activeMonth={activeMonth}
          totals={activeTotals?.totals ?? []}
        />
      </m.div>
    </>
  );
};

export default SpendingDashboardHeaderClient;
