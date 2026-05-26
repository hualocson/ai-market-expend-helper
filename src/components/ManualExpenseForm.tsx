"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import dayjs from "@/configs/date";
import { Category, PaidBy } from "@/enums";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import type { BudgetColorId } from "@/lib/budget-appearance";
import { groupBudgetOptions, pickDefaultBudget } from "@/lib/budget-options";
import { useCreateExpenseMutation } from "@/lib/mutations";
import { queries } from "@/lib/queries";
import type { QuickAddMode } from "@/lib/quick-add-mode";
import { cn, formatVnd, parseVndInput } from "@/lib/utils";
import { getWeekRange } from "@/lib/week";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  DollarSign,
  Loader2,
  NotebookPen,
  RotateCcw,
  Tag,
  UserRound,
  Wallet,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import { useSettingsStore } from "@/components/providers/StoreProvider";

import BudgetPickerSheet from "./BudgetPickerSheet";
import ExpenseItemIcon from "./ExpenseItemIcon";
import VndSymbol from "./VndSymbol";
import { Button } from "./ui/button";
import DatePicker from "./ui/date-picker";
import { Input } from "./ui/input";
import {
  SheetClose as Close,
  SheetContent as Content,
  SheetDescription as Description,
  SheetFooter as Footer,
  SheetHeader as Header,
  Sheet as Root,
  SheetTitle as Title,
  SheetTrigger as Trigger,
} from "./ui/sheet";
import { Textarea } from "./ui/textarea";
import { WheelPicker, WheelPickerWrapper } from "./ui/wheel-picker";

const defaultExpense: TExpense = {
  date: dayjs().format("DD/MM/YYYY"),
  amount: 0,
  note: "",
  category: Category.FOOD,
};

const getSuggestionsList = (amount: number) => {
  return Array.from({ length: 3 })
    .map((_, index) => amount * 10 ** (index + 1))
    .filter((s) => s > 0);
};

const paidByOptions = [PaidBy.CUBI, PaidBy.EMBE, PaidBy.OTHER];
const paidByWheelOptions = paidByOptions.map((option) => ({
  value: option,
  label: option,
}));
const categoryOptions = Object.values(Category);

export type ManualExpenseFormHandle = {
  submit: () => void;
};

export type ManualExpenseFormState = {
  canSubmit: boolean;
  loading: boolean;
  mode: QuickAddMode;
};

type ManualExpenseFormProps = {
  initialExpense?:
    | (TExpense & {
        paidBy?: string;
        budgetId?: number | null;
        budgetName?: string | null;
        budgetIcon?: string | null;
        budgetColor?: BudgetColorId | null;
      })
    | null;
  onSubmit?: (
    payload: TExpense & {
      paidBy: PaidBy;
      budgetId?: number | null;
      budgetName?: string | null;
      budgetIcon?: string | null;
      budgetColor?: BudgetColorId | null;
    }
  ) => Promise<void>;
  submitLabel?: string;
  loadingLabel?: string;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
  showSubmitButton?: boolean;
  onStateChange?: (state: ManualExpenseFormState) => void;
  prefillExpense?: Partial<
    Pick<TExpense, "amount" | "note" | "category">
  > | null;
  showBudgetSelect?: boolean;
  isSheetOpen?: boolean;
  initialMode?: QuickAddMode;
  autoSelectDefaultBudget?: boolean;
};

const buildExpense = (initialExpense?: TExpense | null) => {
  if (!initialExpense) {
    return defaultExpense;
  }

  return {
    ...defaultExpense,
    ...initialExpense,
  };
};

const ManualExpenseForm = forwardRef<
  ManualExpenseFormHandle,
  ManualExpenseFormProps
>(
  (
    {
      initialExpense,
      onSubmit,
      submitLabel = "Add Expense",
      loadingLabel = "Adding...",
      successMessage = "Expense added successfully!",
      errorMessage = "Failed to add expense",
      onSuccess,
      showSubmitButton = true,
      onStateChange,
      prefillExpense = null,
      showBudgetSelect = false,
      isSheetOpen = true,
      initialMode,
      autoSelectDefaultBudget = false,
    },
    ref
  ) => {
    const settingsPaidBy = useSettingsStore((state) => state.paidBy);
    const [mode, setMode] = useState<QuickAddMode>(initialMode ?? "advanced");
    const [expense, setExpense] = useState<TExpense>(() =>
      buildExpense(initialExpense)
    );
    const hasManualPaidBy = useRef(false);
    const normalizePaidBy = useCallback(
      (value?: string): PaidBy => {
        const fallback = PaidBy.OTHER;
        return (
          paidByOptions.find((option) => option === value) ??
          paidByOptions.find((option) => option === settingsPaidBy) ??
          fallback
        );
      },
      [settingsPaidBy]
    );
    const [paidBy, setPaidBy] = useState(() =>
      normalizePaidBy(initialExpense?.paidBy)
    );
    const [budgetId, setBudgetId] = useState<number | null>(
      initialExpense?.budgetId ?? null
    );
    const [budgetName, setBudgetName] = useState<string | null>(
      initialExpense?.budgetName ?? null
    );
    const [budgetIcon, setBudgetIcon] = useState<string | null>(
      initialExpense?.budgetIcon ?? null
    );
    const [budgetColor, setBudgetColor] = useState<BudgetColorId | null>(
      initialExpense?.budgetColor ?? null
    );
    const [loading, setLoading] = useState(false);
    const [dateDrawerOpen, setDateDrawerOpen] = useState(false);
    const [paidByDrawerOpen, setPaidByDrawerOpen] = useState(false);
    const [budgetDrawerOpen, setBudgetDrawerOpen] = useState(false);
    const createExpenseMutation = useCreateExpenseMutation();

    const amountRef = useRef<HTMLInputElement>(null);
    const noteRef = useRef<HTMLTextAreaElement>(null);

    const handleOnNoteKeyDown = (
      e: React.KeyboardEvent<HTMLTextAreaElement>
    ) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        amountRef.current?.select();
      }
    };

    useEffect(() => {
      if (typeof initialExpense === "undefined") {
        if (!hasManualPaidBy.current) {
          setPaidBy(normalizePaidBy());
        }
        return;
      }

      setExpense(buildExpense(initialExpense));
      setPaidBy(normalizePaidBy(initialExpense?.paidBy));
      if (showBudgetSelect) {
        setBudgetId(initialExpense?.budgetId ?? null);
        setBudgetName(initialExpense?.budgetName ?? null);
        setBudgetIcon(initialExpense?.budgetIcon ?? null);
        setBudgetColor(initialExpense?.budgetColor ?? null);
      }
      hasManualPaidBy.current = false;
    }, [initialExpense, normalizePaidBy, showBudgetSelect]);

    useEffect(() => {
      setMode(initialMode ?? "advanced");
    }, [initialMode, prefillExpense]);

    const canSubmit = useMemo(() => {
      return Boolean(expense.amount > 0);
    }, [expense.amount]);

    useEffect(() => {
      onStateChange?.({ canSubmit, loading, mode });
    }, [canSubmit, loading, mode, onStateChange]);

    useEffect(() => {
      if (!prefillExpense) {
        return;
      }

      const nextAmount = Number(prefillExpense.amount);
      const nextCategory = categoryOptions.includes(
        prefillExpense.category as Category
      )
        ? (prefillExpense.category as Category)
        : defaultExpense.category;

      setExpense((prev) => ({
        ...prev,
        amount: Number.isFinite(nextAmount) ? nextAmount : prev.amount,
        ...(typeof prefillExpense.note !== "undefined"
          ? { note: prefillExpense.note }
          : {}),
        category: nextCategory,
      }));

      requestAnimationFrame(() => {
        amountRef.current?.focus();
        amountRef.current?.select();
      });
    }, [prefillExpense]);

    const budgetTargetDate = useMemo(() => {
      if (!showBudgetSelect) {
        return null;
      }
      const parsedDate = dayjs(
        expense.date || defaultExpense.date,
        "DD/MM/YYYY",
        true
      );
      const resolvedDate = parsedDate.isValid() ? parsedDate : dayjs();
      return resolvedDate.format("YYYY-MM-DD");
    }, [expense.date, showBudgetSelect]);

    const budgetWeekStart = useMemo(() => {
      if (!budgetTargetDate) {
        return null;
      }
      const resolvedDate = dayjs(budgetTargetDate, "YYYY-MM-DD", true);
      return getWeekRange(resolvedDate).weekStartDate.format("YYYY-MM-DD");
    }, [budgetTargetDate]);

    const budgetOptionsQuery = useQuery({
      ...queries.budgetWeekly.options(
        budgetWeekStart ?? "",
        budgetTargetDate ?? undefined
      ),
      enabled: showBudgetSelect && isSheetOpen && Boolean(budgetWeekStart),
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: false,
    });
    const budgetOptions = budgetOptionsQuery.data ?? [];
    const budgetLoaded = budgetOptionsQuery.isFetched;
    const budgetGroups = useMemo(
      () => groupBudgetOptions(budgetOptions),
      [budgetOptions]
    );

    const handleSubmit = useCallback(async () => {
      if (!canSubmit || loading) {
        return;
      }

      try {
        setLoading(true);
        const selectedBudget =
          showBudgetSelect && budgetId !== null
            ? budgetOptions.find((budget) => budget.id === budgetId)
            : null;
        const payload = {
          ...defaultExpense,
          ...expense,
          date: expense.date || defaultExpense.date,
          category: expense.category || defaultExpense.category,
          paidBy,
          budgetId: showBudgetSelect ? budgetId : null,
          budgetName:
            showBudgetSelect && budgetId !== null
              ? (selectedBudget?.name ?? budgetName ?? null)
              : null,
          budgetIcon:
            showBudgetSelect && budgetId !== null
              ? (selectedBudget?.icon ?? budgetIcon ?? null)
              : null,
          budgetColor:
            showBudgetSelect && budgetId !== null
              ? (selectedBudget?.color ?? budgetColor ?? null)
              : null,
        };
        if (onSubmit) {
          await onSubmit(payload);
        } else {
          await createExpenseMutation.mutateAsync(payload);
        }
        toast.success(successMessage);
        onSuccess?.();
      } catch (error) {
        console.error(error);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    }, [
      canSubmit,
      errorMessage,
      expense,
      loading,
      onSubmit,
      onSuccess,
      paidBy,
      budgetId,
      budgetName,
      budgetIcon,
      budgetColor,
      budgetOptions,
      createExpenseMutation,
      showBudgetSelect,
      successMessage,
    ]);

    useImperativeHandle(
      ref,
      () => ({
        submit: handleSubmit,
      }),
      [handleSubmit]
    );

    useEffect(() => {
      if (!showBudgetSelect) {
        return;
      }
      if (budgetId === null || !budgetLoaded) {
        return;
      }
      if (!budgetOptions.some((budget) => budget.id === budgetId)) {
        setBudgetId(null);
        setBudgetName(null);
        setBudgetIcon(null);
        setBudgetColor(null);
      }
    }, [budgetId, budgetLoaded, budgetOptions, showBudgetSelect]);

    useEffect(() => {
      if (!autoSelectDefaultBudget || !showBudgetSelect || !budgetLoaded) {
        return;
      }
      if (budgetId !== null) {
        return;
      }
      const next = pickDefaultBudget(budgetGroups);
      if (next) {
        setBudgetId(next.id);
        setBudgetName(next.name ?? null);
        setBudgetIcon(next.icon ?? null);
        setBudgetColor(next.color ?? null);
      }
    }, [
      autoSelectDefaultBudget,
      budgetGroups,
      budgetId,
      budgetLoaded,
      showBudgetSelect,
    ]);

    const budgetLabel = useMemo(() => {
      if (!showBudgetSelect) {
        return "";
      }
      if (budgetId === null) {
        return "No budget";
      }
      const matched = budgetOptions.find((budget) => budget.id === budgetId);
      return matched?.name ?? budgetName ?? "Budget";
    }, [budgetId, budgetName, budgetOptions, showBudgetSelect]);

    const handleExpenseChange = (
      field: keyof TExpense,
      value: string | number
    ) => {
      setExpense((prev) => ({
        ...prev,
        [field]: value,
      }));
    };
    const handlePaidByChange = useCallback(
      (value: string) => {
        hasManualPaidBy.current = true;
        setPaidBy(normalizePaidBy(value));
      },
      [normalizePaidBy]
    );
    const handleBudgetChange = useCallback(
      (value: number | null) => {
        const selected = budgetOptions.find((budget) => budget.id === value);
        setBudgetId(value);
        setBudgetName(value === null ? null : (selected?.name ?? null));
        setBudgetIcon(value === null ? null : (selected?.icon ?? null));
        setBudgetColor(value === null ? null : (selected?.color ?? null));
      },
      [budgetOptions]
    );

    useEffect(() => {
      amountRef.current?.focus();
      amountRef.current?.select();
    }, []);

    const suggestionsList = useMemo(() => {
      return getSuggestionsList(Number(expense.amount));
    }, [expense.amount]);
    const keyboardOffset = useKeyboardOffset();
    const isQuickMode = mode === "quick";

    return (
      <>
        <div
          className={cn(
            "flex w-full flex-col gap-4",
            suggestionsList.length > 0 && "pb-10"
          )}
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                <DollarSign className="text-muted-foreground h-4 w-4" />
                Amount
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setExpense((prev) => ({
                    ...prev,
                    amount: prev.amount * 1000,
                  }))
                }
              >
                000
              </Button>
            </div>
            <div className="relative">
              {/* clear button */}
              {expense.amount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="absolute top-1/2 left-3 -translate-y-1/2"
                  onClick={() => {
                    handleExpenseChange("amount", 0);
                    amountRef.current?.focus();
                  }}
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              )}
              <Input
                type="text"
                inputMode="numeric"
                value={formatVnd(expense.amount)}
                onChange={(e) =>
                  handleExpenseChange("amount", parseVndInput(e.target.value))
                }
                ref={amountRef}
                className="h-16 border-0 pr-16 text-right text-3xl font-semibold tracking-tight shadow-none ring-0 transition focus-visible:ring-0"
                placeholder="0"
                onFocus={() => {
                  amountRef.current?.select();
                }}
                autoFocus
              />
              <span className="text-muted-foreground absolute top-1/2 right-5 -translate-y-1/2 text-sm font-medium">
                <VndSymbol />
              </span>
            </div>
          </div>

          <div className="relative isolate flex flex-col gap-2">
            <label className="text-foreground flex items-center gap-2 text-sm font-medium">
              <NotebookPen className="text-muted-foreground h-4 w-4" />
              Note
            </label>
            <Textarea
              ref={noteRef}
              value={expense.note}
              onChange={(e) => handleExpenseChange("note", e.target.value)}
              placeholder="Optional note about this expense"
              className="min-h-[80px] resize-none rounded-xl"
              onKeyDown={handleOnNoteKeyDown}
              tabIndex={0}
            />
            {/* reset button */}
            {expense.note && (
              <div className="absolute right-1 bottom-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    handleExpenseChange("note", "");
                    noteRef.current?.focus();
                  }}
                >
                  <XIcon className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-foreground flex items-center gap-2 text-sm font-medium">
              <Tag className="text-muted-foreground h-4 w-4" />
              Category
            </label>
            <div className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto pt-1">
              {categoryOptions.map((category) => {
                const isActive = expense.category === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleExpenseChange("category", category)}
                    aria-pressed={isActive}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition duration-300",
                      isActive
                        ? "border-foreground/20 bg-muted -translate-y-1"
                        : "bg-muted/50 hover:bg-muted border-transparent"
                    )}
                  >
                    <ExpenseItemIcon
                      category={category as Category}
                      size="sm"
                    />
                    <span>{category}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {!isQuickMode && showBudgetSelect && (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full justify-between rounded-xl"
                onClick={() => setBudgetDrawerOpen(true)}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Wallet className="text-muted-foreground h-4 w-4" />
                  Budget
                </span>
                <span className="text-muted-foreground text-xs font-medium">
                  {budgetLabel}
                </span>
              </Button>
              <BudgetPickerSheet
                open={budgetDrawerOpen}
                onOpenChange={setBudgetDrawerOpen}
                value={budgetId}
                onChange={handleBudgetChange}
                weekStart={budgetWeekStart ?? ""}
                targetDate={budgetTargetDate ?? undefined}
                isParentOpen={isSheetOpen}
              />
            </>
          )}

          {isQuickMode ? (
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full rounded-xl"
              onClick={() => setMode("advanced")}
            >
              More options
            </Button>
          ) : (
            <div className="grid w-full grid-cols-2 gap-2">
              <Root open={dateDrawerOpen} onOpenChange={setDateDrawerOpen}>
                <Trigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full justify-between rounded-xl"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Calendar className="text-muted-foreground h-4 w-4" />
                      Date
                    </span>
                    <span className="text-muted-foreground text-xs font-medium">
                      {expense.date || defaultExpense.date}
                    </span>
                  </Button>
                </Trigger>
                <Content
                  side="bottom"
                  showCloseButton={false}
                  className="rounded-t-3xl"
                >
                  <Header className="text-left">
                    <Title>Date</Title>
                    <Description>Pick the expense date.</Description>
                  </Header>
                  <div
                    className="no-scrollbar flex-1 space-y-3 overflow-y-auto px-4 pb-6 sm:px-6"
                    tabIndex={0}
                  >
                    <div className="flex items-center justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        tabIndex={-1}
                        onClick={() =>
                          handleExpenseChange(
                            "date",
                            dayjs().format("DD/MM/YYYY")
                          )
                        }
                      >
                        <RotateCcw className="h-4 w-4" />
                        Today
                      </Button>
                    </div>
                    <DatePicker
                      value={dayjs(
                        expense.date || defaultExpense.date,
                        "DD/MM/YYYY"
                      ).toDate()}
                      onChange={(date) =>
                        handleExpenseChange(
                          "date",
                          date
                            ? dayjs(date).format("DD/MM/YYYY")
                            : defaultExpense.date
                        )
                      }
                    />
                  </div>
                  <Footer className="border-t">
                    <Close asChild>
                      <Button className="h-10 w-full rounded-xl text-base font-medium">
                        Done
                      </Button>
                    </Close>
                  </Footer>
                </Content>
              </Root>

              <Root open={paidByDrawerOpen} onOpenChange={setPaidByDrawerOpen}>
                <Trigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full justify-between rounded-xl"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <UserRound className="text-muted-foreground h-4 w-4" />
                      Paid by
                    </span>
                    <span className="text-muted-foreground text-xs font-medium">
                      {paidBy}
                    </span>
                  </Button>
                </Trigger>
                <Content
                  side="bottom"
                  showCloseButton={false}
                  className="rounded-t-3xl"
                >
                  <Header className="text-left">
                    <Title>Paid by</Title>
                    <Description>Choose who paid for this expense.</Description>
                  </Header>
                  <div
                    className="no-scrollbar flex-1 overflow-y-auto px-4 pb-6 sm:px-6"
                    tabIndex={0}
                  >
                    <WheelPickerWrapper className="w-full">
                      <WheelPicker
                        value={paidBy}
                        onValueChange={handlePaidByChange}
                        options={paidByWheelOptions}
                        infinite
                        visibleCount={3 * 4}
                        dragSensitivity={5}
                      />
                    </WheelPickerWrapper>
                  </div>
                  <Footer className="border-t">
                    <Close asChild>
                      <Button className="h-10 w-full rounded-xl text-base font-medium">
                        Done
                      </Button>
                    </Close>
                  </Footer>
                </Content>
              </Root>
            </div>
          )}

          {showSubmitButton ? (
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || loading}
              className="h-10 w-full rounded-xl text-base font-medium"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {loadingLabel}
                </>
              ) : (
                submitLabel
              )}
            </Button>
          ) : null}
        </div>
        {suggestionsList.length > 0 && (
          <div
            className={cn(
              "fixed inset-x-0 bottom-[73px] z-99 ml-auto flex w-[90svw] items-center justify-start gap-2 p-2 backdrop-blur-md",
              keyboardOffset <= 0 && "hidden"
            )}
            style={{
              bottom: `calc(${keyboardOffset}px)`,
            }}
          >
            {suggestionsList.map((suggestion) => (
              <Button
                key={suggestion}
                type="button"
                variant="outline"
                onClick={() => {
                  handleExpenseChange("amount", suggestion);
                }}
              >
                {formatVnd(suggestion)}
              </Button>
            ))}
          </div>
        )}
      </>
    );
  }
);

ManualExpenseForm.displayName = "ManualExpenseForm";

export default ManualExpenseForm;
