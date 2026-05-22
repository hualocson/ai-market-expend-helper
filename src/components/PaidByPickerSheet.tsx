"use client";

import React from "react";

import { PaidBy } from "@/enums";
import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type TPaidByPickerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: PaidBy;
  onChange: (next: PaidBy) => void;
};

const PAID_BY_OPTIONS: PaidBy[] = [PaidBy.CUBI, PaidBy.EMBE, PaidBy.OTHER];

const PaidByPickerSheet = ({
  open,
  onOpenChange,
  value,
  onChange,
}: TPaidByPickerSheetProps) => {
  const handleSelect = (next: PaidBy) => {
    onChange(next);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle>Paid by</SheetTitle>
        </SheetHeader>
        <div className="space-y-2 px-4 pb-4 sm:px-6">
          {PAID_BY_OPTIONS.map((option) => {
            const isActive = option === value;
            return (
              <button
                key={option}
                type="button"
                onClick={() => handleSelect(option)}
                aria-pressed={isActive}
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-sm font-medium transition",
                  isActive
                    ? "border-success/40 bg-success/10"
                    : "border-border bg-card/80 hover:bg-card"
                )}
              >
                <span>{option}</span>
                {isActive ? <CheckIcon className="text-success h-4 w-4" /> : null}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PaidByPickerSheet;
