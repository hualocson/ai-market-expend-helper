"use client";

import { useCallback, useState } from "react";

import Link from "next/link";

import dayjs from "@/configs/date";
import { queries } from "@/lib/queries";
import { cn, formatVnd, formatVndSigned } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftIcon,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import CategorySpendPieChart from "@/components/CategorySpendPieChart";
import ExpenseEditSheetHost from "@/components/ExpenseEditSheetHost";
import ExpenseListItem, {
  type ExpenseListItemData,
} from "@/components/ExpenseListItem";
import PageEnterAnimation, {
  PageEnterSection,
} from "@/components/PageEnterAnimation";
import VndSymbol from "@/components/VndSymbol";

type DailyReportContentProps = {
  date: string;
};

const DailyReportContent = ({ date }: DailyReportContentProps) => {
  const { data: report } = useQuery(queries.reports.daily(date));
  const [editingExpense, setEditingExpense] =
    useState<ExpenseListItemData | null>(null);
  const handleEditExpense = useCallback((expense: ExpenseListItemData) => {
    setEditingExpense(expense);
  }, []);
  const handleEditOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setEditingExpense(null);
    }
  }, []);

  if (!report) {
    return null;
  }

  const activeDate = dayjs(report.activeDate);
  const paceTone =
    report.paceStatus === "Over pace"
      ? "text-destructive"
      : report.paceStatus === "On pace"
        ? "text-success"
        : "text-muted-foreground";

  return (
    <PageEnterAnimation className="relative mx-auto flex h-[calc(100svh-100px-env(safe-area-inset-bottom))] max-w-lg flex-col gap-4 px-4 pt-6 pb-6 sm:px-6">
      <div className="bg-success/15 pointer-events-none absolute -top-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full blur-3xl" />
      <div className="bg-accent/20 pointer-events-none absolute top-24 right-6 h-24 w-24 rounded-full blur-2xl" />

      <PageEnterSection>
        <div className="relative z-10 flex shrink-0 items-center gap-2">
          <Link href="/">
            <Button variant="ghost" size="icon" className="active:scale-[0.97]">
              <ArrowLeftIcon />
            </Button>
          </Link>
          <div>
            <h1 className="text-foreground text-lg font-semibold sm:text-xl">
              Daily report
            </h1>
            <p className="text-muted-foreground text-sm">
              {activeDate.format("dddd, DD MMM YYYY")}
            </p>
          </div>
        </div>
      </PageEnterSection>

      <div className="no-scrollbar flex grow flex-col gap-4 overflow-y-auto">
        <PageEnterSection>
          <div className="bg-card/80 border-border/70 rounded-3xl border p-4 shadow-[0_16px_40px_-24px_color-mix(in_srgb,var(--background)_72%,transparent)] sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-muted-foreground text-xs font-semibold tracking-[0.26em] uppercase">
                  Spent today
                </p>
                <p className="text-foreground text-3xl font-semibold">
                  -{formatVnd(report.totalSpentToday)} <VndSymbol />
                </p>
                <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span>{report.dailyExpenses.length} transactions</span>
                  <span className="bg-muted/70 border-border/70 rounded-full border px-2 py-0.5 text-[11px] font-semibold">
                    Day {report.dayIndex} of 7
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-muted/60 border-border/70 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-3 py-3">
              <div>
                <p className="text-muted-foreground text-[11px] font-semibold tracking-[0.24em] uppercase">
                  Week range
                </p>
                <p className="text-foreground text-sm font-semibold">
                  {report.weekLabel}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold",
                  report.paceStatus === "Over pace"
                    ? "border-destructive/40 bg-destructive/15 text-destructive-foreground"
                    : report.paceStatus === "On pace"
                      ? "border-success/40 bg-success/15 text-success-foreground"
                      : "border-border/70 bg-muted/60 text-muted-foreground"
                )}
              >
                {report.paceStatus}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="bg-muted/60 border-border/70 rounded-2xl border px-3 py-3">
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Daily target
                </div>
                <p className="text-foreground mt-2 text-sm font-semibold">
                  {report.hasWeeklyBudget ? (
                    <>
                      {formatVnd(Math.round(report.dailyTarget))} <VndSymbol />
                    </>
                  ) : (
                    "Set weekly budget"
                  )}
                </p>
              </div>
              <div className="bg-muted/60 border-border/70 rounded-2xl border px-3 py-3">
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <ChartNoAxesCombined className="h-3.5 w-3.5" />
                  Week so far
                </div>
                <p className="text-foreground mt-2 text-sm font-semibold">
                  {formatVnd(report.weekSpentToDate)} <VndSymbol />
                </p>
              </div>
              <div className="bg-muted/60 border-border/70 col-span-2 rounded-2xl border px-3 py-3 sm:col-span-1">
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  <ClipboardList className="h-3.5 w-3.5" />
                  Today remaining
                </div>
                <p
                  className={cn(
                    "mt-2 text-sm font-semibold",
                    report.dailyRemaining < 0
                      ? "text-destructive"
                      : "text-success"
                  )}
                >
                  {report.hasWeeklyBudget ? (
                    <>
                      {formatVndSigned(Math.round(report.dailyRemaining))}{" "}
                      <VndSymbol />
                    </>
                  ) : (
                    "-"
                  )}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Weekly pace</span>
                <span className={cn("font-semibold", paceTone)}>
                  {report.paceStatus}
                </span>
              </div>
              <div className="bg-muted/70 h-2 w-full rounded-full">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width]",
                    report.paceStatus === "Over pace"
                      ? "bg-destructive"
                      : "bg-success"
                  )}
                  style={{ width: `${report.paceProgress * 100}%` }}
                />
              </div>
              <div className="text-muted-foreground flex items-center justify-between text-[11px]">
                <span>
                  {report.hasWeeklyBudget ? (
                    <>
                      Week budget {formatVnd(report.weeklyBudgetTotal)}{" "}
                      <VndSymbol />
                    </>
                  ) : (
                    "Add a weekly budget to unlock pace tracking."
                  )}
                </span>
                {report.hasWeeklyBudget ? (
                  <span>
                    Expected {formatVnd(Math.round(report.expectedSpendToDate))}{" "}
                    <VndSymbol />
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </PageEnterSection>

        <PageEnterSection>
          <CategorySpendPieChart
            totals={report.dailyCategoryTotals}
            monthLabel={`${activeDate.format("DD MMM YYYY")}`}
          />
        </PageEnterSection>

        <PageEnterSection>
          <div className="bg-card/80 border-border/70 rounded-3xl border px-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-foreground text-base font-semibold">
                  Today transactions
                </h2>
                <p className="text-muted-foreground text-xs">
                  {report.dailyExpenses.length
                    ? `${report.dailyExpenses.length} items on ${activeDate.format("DD MMM")}`
                    : "No expenses for this date"}
                </p>
              </div>
              <span className="text-muted-foreground text-xs">
                {report.weekStartKey} to {report.weekEndKey}
              </span>
            </div>
            <div className="mt-3 flex flex-col gap-3">
              {report.dailyExpenses.length ? (
                report.dailyExpenses.map((expense) => (
                  <ExpenseListItem
                    key={expense.id}
                    expense={expense}
                    onEditExpense={handleEditExpense}
                  />
                ))
              ) : (
                <div className="text-muted-foreground py-6 text-center text-sm">
                  Add an expense to start your daily report.
                </div>
              )}
            </div>
          </div>
        </PageEnterSection>
      </div>
      <ExpenseEditSheetHost
        expense={editingExpense}
        open={Boolean(editingExpense)}
        onOpenChange={handleEditOpenChange}
      />
    </PageEnterAnimation>
  );
};

export default DailyReportContent;
