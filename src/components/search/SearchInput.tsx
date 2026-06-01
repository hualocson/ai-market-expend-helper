"use client";

import React, {
  type ChangeEvent,
  type FormEvent,
  forwardRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import { Loader2, Search, X } from "lucide-react";

type SearchInputProps = {
  onSubmit: (value: string) => void;
  isLoading: boolean;
  disabled: boolean;
  "aria-label"?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
};

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      onSubmit,
      isLoading,
      disabled,
      "aria-label": ariaLabel,
      value,
      onValueChange,
      onClear,
      placeholder,
      className,
      inputClassName,
    },
    ref
  ) => {
    const [internalValue, setInternalValue] = useState("");
    const currentValue = value ?? internalValue;

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = event.target.value;
      if (value === undefined) {
        setInternalValue(nextValue);
      }
      onValueChange?.(nextValue);
    };

    const handleClear = () => {
      if (value === undefined) {
        setInternalValue("");
      }
      onValueChange?.("");
      onClear?.();
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = currentValue.trim();
      if (!trimmed || disabled || isLoading) {
        return;
      }
      onSubmit(trimmed);
    };

    return (
      <form
        onSubmit={handleSubmit}
        className={cn("relative flex items-center", className)}
      >
        <Search className="text-muted-foreground pointer-events-none absolute left-4 h-4 w-4" />
        <input
          ref={ref}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          aria-label={ariaLabel}
          value={currentValue}
          disabled={disabled}
          onChange={handleChange}
          placeholder={
            placeholder ??
            (disabled ? "Search needs a connection" : "Search expenses…")
          }
          className={cn(
            "text-foreground placeholder:text-muted-foreground/80 glass-border bg-surface-3/80 w-full rounded-[28px] border-0 py-3 pr-12 pl-10 text-base outline-none disabled:opacity-60",
            inputClassName
          )}
        />
        {isLoading ? (
          <Loader2 className="text-muted-foreground absolute right-4 h-4 w-4 animate-spin" />
        ) : currentValue ? (
          <button
            type="button"
            aria-label="Clear search"
            onPointerDown={(event) => event.preventDefault()}
            onClick={handleClear}
            className="text-muted-foreground hover:text-foreground absolute right-2 grid size-8 place-items-center rounded-full transition-colors"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </form>
    );
  }
);

SearchInput.displayName = "SearchInput";

export default SearchInput;
