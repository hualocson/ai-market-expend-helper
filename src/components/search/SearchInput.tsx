"use client";

import React, {
  type ChangeEvent,
  type FormEvent,
  forwardRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";
import { Loader2, Search } from "lucide-react";

type SearchInputProps = {
  onSubmit: (value: string) => void;
  isLoading: boolean;
  disabled: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
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
      value,
      onValueChange,
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
        <Search className="text-muted-foreground pointer-events-none absolute left-3 h-4 w-4" />
        <input
          ref={ref}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          value={currentValue}
          disabled={disabled}
          onChange={handleChange}
          placeholder={
            placeholder ??
            (disabled ? "Search needs a connection" : "Search expenses…")
          }
          className={cn(
            "bg-card border-border focus:border-primary w-full rounded-2xl border py-2.5 pr-10 pl-9 text-sm transition outline-none disabled:opacity-60",
            inputClassName
          )}
        />
        {isLoading ? (
          <Loader2 className="text-muted-foreground absolute right-3 h-4 w-4 animate-spin" />
        ) : null}
      </form>
    );
  }
);

SearchInput.displayName = "SearchInput";

export default SearchInput;
