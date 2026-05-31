"use client";

import React, { type FormEvent, useState } from "react";

import { cn } from "@/lib/utils";
import { Loader2, Search } from "lucide-react";

type SearchInputProps = {
  onSubmit: (value: string) => void;
  isLoading: boolean;
  disabled: boolean;
  className?: string;
};

const SearchInput = ({
  onSubmit,
  isLoading,
  disabled,
  className,
}: SearchInputProps) => {
  const [value, setValue] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = value.trim();
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
        type="search"
        inputMode="search"
        enterKeyHint="search"
        value={value}
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        placeholder={
          disabled ? "Search needs a connection" : "Search expenses…"
        }
        className="bg-card border-border focus:border-primary w-full rounded-2xl border py-2.5 pr-10 pl-9 text-sm transition outline-none disabled:opacity-60"
      />
      {isLoading ? (
        <Loader2 className="text-muted-foreground absolute right-3 h-4 w-4 animate-spin" />
      ) : null}
    </form>
  );
};

export default SearchInput;
