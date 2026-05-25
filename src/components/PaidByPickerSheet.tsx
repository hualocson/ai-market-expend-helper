"use client";

import React, { useState } from "react";

import { PaidBy } from "@/enums";
import { CheckIcon } from "lucide-react";
import { flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { WheelPicker, WheelPickerWrapper } from "@/components/ui/wheel-picker";

export type TPaidByPickerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: PaidBy;
  onChange: (next: PaidBy) => void;
  onCloseAutoFocus?: React.ComponentProps<
    typeof SheetContent
  >["onCloseAutoFocus"];
  onRestoreFocusRequest?: () => void;
};

const PAID_BY_OPTIONS = [
  { value: PaidBy.CUBI, label: PaidBy.CUBI },
  { value: PaidBy.EMBE, label: PaidBy.EMBE },
  { value: PaidBy.OTHER, label: PaidBy.OTHER },
];

const PaidByPickerSheet = ({
  open,
  onOpenChange,
  value,
  onChange,
  onCloseAutoFocus,
  onRestoreFocusRequest,
}: TPaidByPickerSheetProps) => {
  const [pending, setPending] = useState<PaidBy>(value);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setPending(value);
    }
    onOpenChange(next);
  };

  const handleDone = () => {
    onChange(pending);
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
          <SheetTitle>Paid by</SheetTitle>
          <SheetDescription>Choose who paid for this expense.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4 sm:px-6">
          <WheelPickerWrapper className="w-full">
            <WheelPicker
              value={pending}
              onValueChange={(next) => setPending(next as PaidBy)}
              options={PAID_BY_OPTIONS}
              infinite
              visibleCount={3 * 4}
              dragSensitivity={5}
            />
          </WheelPickerWrapper>
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

export default PaidByPickerSheet;
