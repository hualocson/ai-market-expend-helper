"use client";

import React from "react";

import type { SearchFilter } from "@/lib/ai/search-contract";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

import type { FilterChipField } from "./filter-chips";
import { buildFilterChips } from "./filter-chips";

type SearchFilterChipsProps = {
  filter: SearchFilter;
  onRemove: (field: FilterChipField) => void;
  className?: string;
};

const SearchFilterChips = ({
  filter,
  onRemove,
  className,
}: SearchFilterChipsProps) => {
  const chips = buildFilterChips(filter);
  if (chips.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {chips.map((chip) => (
        <span
          key={chip.field}
          className="bg-surface-3 text-foreground inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
        >
          {chip.label}
          <button
            type="button"
            aria-label={`remove ${chip.label}`}
            onPointerDown={(event) => event.preventDefault()}
            onClick={() => onRemove(chip.field)}
            className="text-muted-foreground hover:text-foreground transition"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
};

export default SearchFilterChips;
