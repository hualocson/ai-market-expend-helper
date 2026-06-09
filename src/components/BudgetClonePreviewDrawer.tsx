"use client";

import React from "react";

import { cn, formatVnd } from "@/lib/utils";
import type { BudgetClonePeriod, BudgetListItem } from "@/types/budget-weekly";
import { CopyPlus, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import BudgetBadge from "@/components/BudgetBadge";
import ExpenseItemIcon from "@/components/ExpenseItemIcon";

export type BudgetClonePreview = {
  period: BudgetClonePeriod;
  sourceStartDate: string;
  sourceLabel: string;
  targetLabel: string;
  targetNavigationKey: string;
  targetToastLabel: "next week" | "next month";
  budgets: BudgetListItem[];
  existingBudgetNames: Set<string>;
};

type BudgetClonePreviewDrawerProps = {
  preview: BudgetClonePreview | null;
  isPending: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export const normalizeClonePreviewName = (name: string) =>
  name.trim().toLowerCase();

const BudgetClonePreviewDrawer = ({
  preview,
  isPending,
  onOpenChange,
  onCancel,
  onConfirm,
}: BudgetClonePreviewDrawerProps) => {
  const cloneCount =
    preview?.budgets.filter(
      (budget) =>
        !preview.existingBudgetNames.has(normalizeClonePreviewName(budget.name))
    ).length ?? 0;
  const skippedCount = (preview?.budgets.length ?? 0) - cloneCount;

  return (
    <Drawer open={Boolean(preview)} onOpenChange={onOpenChange}>
      {preview ? (
        <DrawerContent className="max-h-[90svh] rounded-t-3xl! border-t-0!">
          <div className="px-4 pb-4">
            <DrawerHeader className="w-fit justify-start px-0 text-left">
              <DrawerTitle className="text-xl">
                Preview budget clone
              </DrawerTitle>
              <DrawerDescription className="sr-only">
                Review the budgets before cloning from {preview.sourceLabel} to{" "}
                {preview.targetLabel}.
              </DrawerDescription>
            </DrawerHeader>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/45 rounded-2xl px-3 py-2.5">
                <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  From
                </p>
                <p className="text-foreground mt-1 text-sm font-semibold">
                  {preview.sourceLabel}
                </p>
              </div>
              <div className="bg-muted/45 rounded-2xl px-3 py-2.5">
                <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                  To
                </p>
                <p className="text-foreground mt-1 text-sm font-semibold">
                  {preview.targetLabel}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs">
              <span className="border-success/35 bg-success/10 text-success rounded-full border px-2 py-0.5 font-medium">
                {cloneCount} to clone
              </span>
              {skippedCount > 0 ? (
                <span className="border-warning/40 bg-warning/15 text-warning rounded-full border px-2 py-0.5 font-medium">
                  {skippedCount} already exists
                </span>
              ) : null}
            </div>
          </div>

          <div className="no-scrollbar space-y-2 overflow-y-auto px-4 py-4">
            {preview.budgets.map((budget) => {
              const alreadyExists = preview.existingBudgetNames.has(
                normalizeClonePreviewName(budget.name)
              );

              return (
                <div
                  key={budget.id}
                  className="border-border/45 bg-card/60 rounded-2xl border px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <BudgetBadge
                        icon={budget.icon}
                        color={budget.color}
                        name={budget.name}
                        className="max-w-[72%] px-2 py-1"
                        nameClassName="text-sm font-semibold"
                      />
                      <ExpenseItemIcon
                        category={budget.category}
                        size="sm"
                        className="shrink-0"
                      />
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                        alreadyExists
                          ? "border-warning/40 bg-warning/15 text-warning"
                          : "border-success/35 bg-success/10 text-success"
                      )}
                    >
                      {alreadyExists ? "Already exists" : "Will clone"}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1.5 text-xs tabular-nums">
                    {formatVnd(budget.amount)}
                  </p>
                </div>
              );
            })}
          </div>

          <DrawerFooter className="gap-2 px-5 py-4">
            <Button type="button" onClick={onConfirm} disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CopyPlus className="h-4 w-4" />
              )}
              Confirm clone
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={isPending}
            >
              Cancel
            </Button>
          </DrawerFooter>
        </DrawerContent>
      ) : null}
    </Drawer>
  );
};

export default BudgetClonePreviewDrawer;
