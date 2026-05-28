"use client";

import React, { memo, useCallback, useEffect, useMemo, useState } from "react";

import dayjs from "@/configs/date";
import { useAppHaptics } from "@/hooks/useAppHaptics";
import { groupTransferCandidates } from "@/lib/budget-transfer-groups";
import { useTransferBudgetMutation } from "@/lib/mutations";
import { queries } from "@/lib/queries";
import { cn, formatVnd, formatVndSigned, parseVndInput } from "@/lib/utils";
import type { BudgetListItem } from "@/types/budget-weekly";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDown,
  Check,
  Loader2,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerNested,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";

import BudgetBadge from "@/components/BudgetBadge";
import VndSymbol from "@/components/VndSymbol";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination: BudgetListItem;
};

const formatCandidatePeriodRange = (b: BudgetListItem): string => {
  const start = dayjs(b.periodStartDate);
  if (b.period === "month") {
    return start.format("MMM YYYY");
  }
  const end =
    b.period === "custom" && b.periodEndDate
      ? dayjs(b.periodEndDate)
      : start.add(6, "day");
  return `${start.format("MMM D")} – ${end.format("MMM D")}`;
};

// Vietnamese-aware search normalizer. `đ`/`Đ` is a single codepoint that NFD
// does NOT decompose, so we map it explicitly. All other Latin diacritics are
// handled by NFD + the Diacritic property.
const normalizeForSearch = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

type SourceBudgetRowProps = {
  budget: BudgetListItem;
  selected: boolean;
  showPeriod: boolean;
  onSelect: (id: number) => void;
};

// Memoized so picking a row only re-renders the two rows whose `selected`
// changed — not the whole list. Critical inside vaul's blurred DrawerContent,
// where any descendant repaint forces Safari to recompute the backdrop blur
// for the entire drawer area.
const SourceBudgetRow = memo(function SourceBudgetRow({
  budget,
  selected,
  showPeriod,
  onSelect,
}: SourceBudgetRowProps) {
  const disabled = budget.remaining <= 0;
  const isPristine = budget.spent === 0;
  const handleClick = useCallback(
    () => onSelect(budget.id),
    [onSelect, budget.id]
  );

  return (
    <Button
      type="button"
      variant="ghost"
      disabled={disabled}
      aria-disabled={disabled}
      onClick={handleClick}
      className={cn(
        "border-border/30 bg-card/40 h-auto min-h-13 w-full justify-between rounded-xl border px-3 text-left",
        // iOS Safari holds :hover after a tap until the next tap elsewhere.
        // We must override the ghost variant's hover/active bgs in BOTH light
        // and dark modes — `dark:hover:bg-accent/50` carries an extra `.dark`
        // ancestor in its selector and outranks a plain `hover:bg-muted/60`,
        // so the selected row would visually flash to accent-green after tap.
        // Also disable bg/transform transitions so selection flips instantly
        // instead of crossfading inside the drawer.
        "touch-manipulation transition-none active:scale-100",
        selected
          ? "bg-muted/60 hover:bg-muted/60 dark:hover:bg-muted/60 active:bg-muted/60"
          : "hover:bg-card/55 dark:hover:bg-card/55 active:bg-card/55",
        disabled && "opacity-60"
      )}
    >
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.5">
          <BudgetBadge
            icon={budget.icon}
            color={budget.color}
            name={budget.name}
            className="max-w-full border-0 bg-transparent px-0 py-0"
          />
          {selected ? (
            <Check className="text-success h-4 w-4 shrink-0" />
          ) : null}
        </span>
        {showPeriod ? (
          <span className="text-muted-foreground text-[10px] tabular-nums">
            {formatCandidatePeriodRange(budget)}
          </span>
        ) : null}
      </span>
      <span className="ml-2 flex shrink-0 flex-col items-end">
        {disabled ? (
          <span className="text-muted-foreground text-[10px]">
            no cap to pull
          </span>
        ) : isPristine ? (
          <span className="text-foreground text-xs font-semibold tabular-nums">
            {formatVnd(budget.amount)}
          </span>
        ) : (
          <>
            <span
              className={cn(
                "text-xs font-semibold tabular-nums",
                budget.remaining < 0 ? "text-destructive" : "text-success"
              )}
            >
              {formatVndSigned(budget.remaining)}
            </span>
            <span className="text-muted-foreground text-[10px] tabular-nums">
              of {formatVnd(budget.amount)}
            </span>
          </>
        )}
      </span>
    </Button>
  );
});

const BudgetTransferDrawer = ({ open, onOpenChange, destination }: Props) => {
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [amount, setAmount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const transferBudgetMutation = useTransferBudgetMutation();
  const haptics = useAppHaptics();

  const handleSelectSource = useCallback((id: number) => setSourceId(id), []);

  const candidatesQuery = useQuery({
    ...queries.budgets.transferCandidates(destination.id),
    enabled: open,
  });

  const candidates = useMemo(
    () => candidatesQuery.data ?? [],
    [candidatesQuery.data]
  );

  useEffect(() => {
    if (open) {
      setSourceId(null);
      setAmount(0);
      setIsSaving(false);
      setSearchQuery("");
    }
  }, [open]);

  const groups = useMemo(
    () => groupTransferCandidates(candidates, new Date()),
    [candidates]
  );

  const trimmedQuery = searchQuery.trim();
  const visibleGroups = useMemo(() => {
    if (!trimmedQuery) {
      return groups;
    }
    const needle = normalizeForSearch(trimmedQuery);
    return groups
      .map((group) => ({
        ...group,
        candidates: group.candidates.filter((b) => {
          if (normalizeForSearch(b.name).includes(needle)) {
            return true;
          }
          if (group.key.kind === "earlier") {
            return normalizeForSearch(formatCandidatePeriodRange(b)).includes(
              needle
            );
          }
          return false;
        }),
      }))
      .filter((group) => group.candidates.length > 0);
  }, [groups, trimmedQuery]);

  const hasNoMatches = trimmedQuery.length > 0 && visibleGroups.length === 0;

  const allDisabled =
    candidates.length > 0 && candidates.every((b) => b.remaining <= 0);

  const source = useMemo(
    () => candidates.find((b) => b.id === sourceId) ?? null,
    [candidates, sourceId]
  );

  // Transfer moves cap (amount), not headroom (remaining), so the hard cap is
  // source.amount; pulling past remaining is allowed with a "goes over budget" warning.
  const exceedsCap = source !== null && amount > source.amount;
  const goesOverSpent =
    source !== null &&
    amount > 0 &&
    !exceedsCap &&
    source.amount - amount < source.spent;
  const overBy =
    goesOverSpent && source ? source.spent - (source.amount - amount) : 0;

  const canSubmit = source !== null && amount > 0 && !exceedsCap && !isSaving;
  const submitLabel = goesOverSpent ? "Move funds anyway" : "Move funds";

  const handleSubmit = async () => {
    if (!canSubmit || !source) {
      return;
    }
    try {
      setIsSaving(true);
      const result = await transferBudgetMutation.mutateAsync({
        fromBudgetId: source.id,
        toBudgetId: destination.id,
        amount,
      });

      if (result.ok) {
        toast.success("Funds moved.");
        haptics.success();
        onOpenChange(false);
        return;
      }

      switch (result.code) {
        case "INSUFFICIENT_CAP":
          toast.error(
            "That budget no longer has enough to move. Try a smaller amount."
          );
          break;
        case "NOT_FOUND":
          toast.error("Source budget no longer exists.");
          break;
        default: {
          const _exhaustive: never = result.code;
          void _exhaustive;
          toast.error("Failed to move funds.");
        }
      }
      haptics.error();
    } catch (error) {
      console.error(error);
      toast.error("Failed to move funds.");
      haptics.error();
    } finally {
      setIsSaving(false);
    }
  };

  // Keep outer drawer visible during fetch errors so the nested retry UI is reachable.
  const hasNoCandidates =
    !candidatesQuery.isLoading &&
    !candidatesQuery.isError &&
    candidates.length === 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent className="rounded-t-3xl! border-t-0!">
        <DrawerHeader className="gap-1 pb-2">
          <DrawerTitle>
            Move funds to &quot;{destination.name}&quot;
          </DrawerTitle>
          <DrawerDescription>
            Pull cap from another budget into this one
          </DrawerDescription>
        </DrawerHeader>

        <div className="no-scrollbar flex max-h-[65svh] flex-col gap-4 overflow-x-hidden overflow-y-auto px-4 pb-4">
          {hasNoCandidates ? (
            <div className="border-border/55 bg-card/40 rounded-2xl border border-dashed px-4 py-5 text-center">
              <p className="text-foreground text-sm font-semibold">
                No other budgets to pull from yet.
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Create another budget first, then come back to move funds.
              </p>
            </div>
          ) : (
            <>
              <div className="border-border/45 bg-card/70 rounded-2xl border px-4 py-3">
                <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                  Destination
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <BudgetBadge
                    icon={destination.icon}
                    color={destination.color}
                    name={destination.name}
                    className="max-w-full border-0 bg-transparent px-0 py-0"
                  />
                  <p className="text-foreground text-sm font-semibold tabular-nums">
                    {formatVnd(destination.amount)}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-foreground text-sm font-medium">
                  From
                </label>
                <DrawerNested>
                  <DrawerTrigger asChild>
                    <Button
                      type="button"
                      variant="secondary"
                      aria-label="Select source budget"
                      className="mt-2 h-11 w-full justify-between rounded-xl"
                    >
                      <span className="truncate">
                        {source ? source.name : "Select source budget"}
                      </span>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {source ? formatVnd(source.amount) : ""}
                      </span>
                    </Button>
                  </DrawerTrigger>
                  <DrawerContent
                    className={cn(
                      "rounded-t-3xl! border-t-0!",
                      // Override the default ds-glass-strong blur on this nested
                      // drawer: stacking a second backdrop-filter over the parent
                      // drawer is what makes iPhone Safari flicker when parent
                      // state changes (the parent's content bleeds through and
                      // forces a blur repaint on every row tap).
                      "[backdrop-filter:none]! [background:var(--card)]!"
                    )}
                  >
                    <DrawerHeader className="gap-1 pb-2">
                      <DrawerTitle>Select source budget</DrawerTitle>
                      <DrawerDescription>
                        Pull cap from one of these into &quot;{destination.name}
                        &quot;.
                      </DrawerDescription>
                    </DrawerHeader>

                    <div className="space-y-2 px-4 pb-2">
                      <div
                        data-testid="budget-transfer-nested-destination"
                        className="border-border/45 bg-card/95 rounded-2xl border px-4 py-3"
                      >
                        <BudgetBadge
                          icon={destination.icon}
                          color={destination.color}
                          name={destination.name}
                          className="max-w-full border-0 bg-transparent px-0 py-0"
                        />
                        <p className="text-muted-foreground mt-0.5 text-[11px] tabular-nums">
                          Filling · {formatVnd(destination.amount)}
                        </p>
                      </div>

                      <div className="relative">
                        <Search
                          aria-hidden
                          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                        />
                        <Input
                          type="text"
                          inputMode="search"
                          enterKeyHint="search"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          aria-label="Search source budgets"
                          placeholder="Search budgets"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="h-11 rounded-xl pr-10 pl-9 text-base"
                        />
                        {searchQuery ? (
                          <button
                            type="button"
                            aria-label="Clear search"
                            onClick={() => setSearchQuery("")}
                            className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="no-scrollbar max-h-[55svh] overflow-y-auto px-4 pb-4">
                      {candidatesQuery.isLoading ? (
                        <div
                          data-testid="budget-transfer-candidates-skeleton"
                          className="space-y-2 pt-1"
                        >
                          {Array.from({ length: 4 }).map((_, idx) => (
                            <div
                              key={idx}
                              className="bg-muted/40 h-13 animate-pulse rounded-lg"
                            />
                          ))}
                        </div>
                      ) : candidatesQuery.isError ? (
                        <div className="border-destructive/40 bg-destructive/10 flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5">
                          <p className="text-destructive text-xs font-medium">
                            Failed to load budgets.
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => candidatesQuery.refetch()}
                          >
                            <RefreshCcw className="h-3.5 w-3.5" />
                            Retry
                          </Button>
                        </div>
                      ) : allDisabled ? (
                        <div className="border-border/55 bg-card/40 rounded-2xl border border-dashed px-4 py-5 text-center">
                          <p className="text-foreground text-sm font-semibold">
                            No budget has cap to spare right now.
                          </p>
                          <p className="text-muted-foreground mt-1 text-xs">
                            Try again after another budget recovers some
                            headroom.
                          </p>
                        </div>
                      ) : hasNoMatches ? (
                        <div className="border-border/55 bg-card/40 rounded-2xl border border-dashed px-4 py-5 text-center">
                          <p className="text-foreground text-sm font-semibold">
                            No budgets match &quot;{trimmedQuery}&quot;.
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setSearchQuery("")}
                            className="mt-2"
                          >
                            Clear
                          </Button>
                        </div>
                      ) : (
                        <ul aria-label="Source budgets" className="space-y-1">
                          {visibleGroups.map((group) => {
                            // EARLIER is a catch-all without a date range in its header,
                            // so rows in it carry their own period range to disambiguate.
                            const showPeriodInRow =
                              group.key.kind === "earlier";
                            return (
                              <li key={group.key.kind}>
                                <p
                                  data-testid="budget-transfer-group-label"
                                  className="text-foreground/70 px-1 pt-3 pb-1 text-[11px] font-semibold tracking-wide uppercase"
                                >
                                  {group.label}
                                </p>
                                <ul className="space-y-1">
                                  {group.candidates.map((b) => (
                                    <li key={b.id}>
                                      <SourceBudgetRow
                                        budget={b}
                                        selected={b.id === sourceId}
                                        showPeriod={showPeriodInRow}
                                        onSelect={handleSelectSource}
                                      />
                                    </li>
                                  ))}
                                </ul>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <DrawerFooter className="border-border/45 gap-2 border-t">
                      <DrawerClose asChild>
                        <Button
                          type="button"
                          disabled={sourceId === null}
                          className="h-11 rounded-2xl"
                        >
                          <Check className="h-4 w-4" />
                          {source ? `Use "${source.name}"` : "Select a budget"}
                        </Button>
                      </DrawerClose>
                    </DrawerFooter>
                  </DrawerContent>
                </DrawerNested>
              </div>

              <div>
                <label
                  htmlFor="transfer-amount-input"
                  className="text-foreground text-sm font-medium"
                >
                  Amount
                </label>
                <div className="relative mt-2">
                  <Input
                    id="transfer-amount-input"
                    type="text"
                    inputMode="numeric"
                    value={amount ? formatVnd(amount) : ""}
                    onChange={(e) => setAmount(parseVndInput(e.target.value))}
                    placeholder="0"
                    className="h-11 pr-14 text-right text-lg font-semibold tabular-nums"
                  />
                  <span className="text-muted-foreground absolute top-1/2 right-4 -translate-y-1/2 text-xs font-medium">
                    <VndSymbol />
                  </span>
                </div>
                {exceedsCap && source ? (
                  <p className="text-destructive mt-2 text-[11px]">
                    Cannot move more than {formatVnd(source.amount)} from{" "}
                    {source.name}.
                  </p>
                ) : null}
              </div>

              {source && amount > 0 && !exceedsCap ? (
                <div className="border-border/45 bg-card/70 rounded-2xl border px-4 py-3">
                  <p className="text-muted-foreground text-[10px] tracking-wide uppercase">
                    After transfer
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">{source.name}</p>
                      <p
                        className={cn(
                          "mt-1 text-sm font-semibold tabular-nums",
                          source.amount - amount < source.spent
                            ? "text-destructive"
                            : "text-foreground"
                        )}
                      >
                        {formatVnd(source.amount - amount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">
                        {destination.name}
                      </p>
                      <p className="text-foreground mt-1 text-sm font-semibold tabular-nums">
                        {formatVnd(destination.amount + amount)}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {goesOverSpent && source ? (
                <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p>
                    {source.name} will go {formatVnd(overBy)} over budget.
                  </p>
                </div>
              ) : null}
            </>
          )}
        </div>

        {!hasNoCandidates ? (
          <DrawerFooter className="border-border/45 gap-2 border-t">
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="h-11 rounded-2xl"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
              {isSaving ? "Moving..." : submitLabel}
            </Button>
          </DrawerFooter>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
};

export default BudgetTransferDrawer;
