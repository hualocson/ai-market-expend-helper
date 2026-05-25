"use client";

import React, { useEffect, useState } from "react";

import dayjs from "@/configs/date";
import { CheckIcon } from "lucide-react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import DatePicker from "@/components/ui/date-picker";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export type TDatePickerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (nextDate: string) => void;
  onCloseAutoFocus?: React.ComponentProps<
    typeof SheetContent
  >["onCloseAutoFocus"];
  onRestoreFocusRequest?: () => void;
};

const DATE_FORMAT = "DD/MM/YYYY";

const resolveDate = (value: string) => {
  const parsed = dayjs(value, DATE_FORMAT, true);
  return parsed.isValid() ? parsed.toDate() : dayjs().toDate();
};

const DatePickerSheet = ({
  open,
  onOpenChange,
  value,
  onChange,
  onCloseAutoFocus,
  onRestoreFocusRequest,
}: TDatePickerSheetProps) => {
  const [pendingDate, setPendingDate] = useState<Date>(() =>
    resolveDate(value)
  );

  useEffect(() => {
    if (open) {
      setPendingDate(resolveDate(value));
    }
  }, [open, value]);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setPendingDate(resolveDate(value));
    }
    onOpenChange(next);
  };

  const handleDone = () => {
    onChange(dayjs(pendingDate).format(DATE_FORMAT));
    flushSync(() => {
      onOpenChange(false);
    });
    onRestoreFocusRequest?.();
  };

  const handleOverlayPointerDown: React.PointerEventHandler<HTMLDivElement> = (
    event
  ) => {
    event.preventDefault();
    event.stopPropagation();
    flushSync(() => {
      onOpenChange(false);
    });
    onRestoreFocusRequest?.();
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="rounded-t-3xl"
        onCloseAutoFocus={onCloseAutoFocus}
        onOverlayPointerDown={handleOverlayPointerDown}
      >
        <SheetHeader className="text-left">
          <SheetTitle>Date</SheetTitle>
          <SheetDescription>Pick the expense date.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4 sm:px-6">
          <DatePicker
            value={pendingDate}
            onChange={(date) => {
              if (date) {
                setPendingDate(date);
              }
            }}
          />
        </div>
        <SheetFooter className="border-t">
          <Button
            type="button"
            onClick={handleDone}
            className="h-10 w-full rounded-xl text-base font-medium"
          >
            <CheckIcon className="h-4 w-4" />
            Done
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default DatePickerSheet;
