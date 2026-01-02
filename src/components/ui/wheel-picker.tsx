"use client";

import "@ncdai/react-wheel-picker/style.css";

import * as WheelPickerPrimitive from "@ncdai/react-wheel-picker";

import { cn } from "@/lib/utils";

type WheelPickerValue = WheelPickerPrimitive.WheelPickerValue;
type WheelPickerOption<T extends WheelPickerValue = string> =
  WheelPickerPrimitive.WheelPickerOption<T>;
type WheelPickerClassNames = WheelPickerPrimitive.WheelPickerClassNames;

function WheelPickerWrapper({
  className,
  ...props
}: React.ComponentProps<typeof WheelPickerPrimitive.WheelPickerWrapper>) {
  return (
    <WheelPickerPrimitive.WheelPickerWrapper
      className={cn(
        "w-full rounded-2xl border border-border bg-background/70 px-1 shadow-sm",
        "*:data-rwp:first:*:data-rwp-highlight-wrapper:rounded-s-xl",
        "*:data-rwp:last:*:data-rwp-highlight-wrapper:rounded-e-xl",
        className
      )}
      {...props}
    />
  );
}

function WheelPicker<T extends WheelPickerValue = string>({
  classNames,
  ...props
}: WheelPickerPrimitive.WheelPickerProps<T>) {
  return (
    <WheelPickerPrimitive.WheelPicker
      classNames={{
        optionItem: "text-muted-foreground",
        highlightWrapper: "bg-muted text-foreground",
        ...classNames,
      }}
      {...props}
    />
  );
}

export { WheelPicker, WheelPickerWrapper };
export type { WheelPickerClassNames, WheelPickerOption };
