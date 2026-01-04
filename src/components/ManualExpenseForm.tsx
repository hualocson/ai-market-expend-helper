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

import { createExpenseEntry } from "@/app/actions/expense-actions";
import dayjs from "@/configs/date";
import { Category } from "@/enums";
import { formatVnd, parseVndInput } from "@/lib/utils";
import {
  Calendar,
  DollarSign,
  Loader2,
  NotebookPen,
  RotateCcw,
  Tag,
  UserRound,
  XIcon,
} from "lucide-react";
import { toast } from "sonner";

import ExpenseItemIcon from "./ExpenseItemIcon";
import { Button } from "./ui/button";
import DatePicker from "./ui/date-picker";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { WheelPicker, WheelPickerWrapper } from "./ui/wheel-picker";

const defaultExpense: TExpense = {
  date: dayjs().format("DD/MM/YYYY"),
  amount: 0,
  note: "",
  category: Category.FOOD,
};

const paidByOptions = ["Cubi", "Embe", "Other"];
const paidByWheelOptions = paidByOptions.map((option) => ({
  value: option,
  label: option,
}));
const categoryWheelOptions = Object.values(Category).map((category) => ({
  value: category,
  label: (
    <div className="flex items-center gap-2">
      <ExpenseItemIcon category={category as Category} size="sm" />
      <span className="text-sm font-medium">{category}</span>
    </div>
  ),
}));

export type ManualExpenseFormHandle = {
  submit: () => void;
};

export type ManualExpenseFormState = {
  canSubmit: boolean;
  loading: boolean;
};

type ManualExpenseFormProps = {
  initialExpense?: (TExpense & { paidBy?: string }) | null;
  onSubmit?: (payload: TExpense & { paidBy: string }) => Promise<void>;
  submitLabel?: string;
  loadingLabel?: string;
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
  showSubmitButton?: boolean;
  onStateChange?: (state: ManualExpenseFormState) => void;
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
    },
    ref
  ) => {
    const [expense, setExpense] = useState<TExpense>(() =>
      buildExpense(initialExpense)
    );
    const [paidBy, setPaidBy] = useState(paidByOptions[0]);
    const [loading, setLoading] = useState(false);

    const noteRef = useRef<HTMLTextAreaElement>(null);
    const amountRef = useRef<HTMLInputElement>(null);

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
        return;
      }

      setExpense(buildExpense(initialExpense));
      if (initialExpense?.paidBy) {
        const fallback = paidByOptions[paidByOptions.length - 1];
        setPaidBy(
          paidByOptions.includes(initialExpense.paidBy)
            ? initialExpense.paidBy
            : fallback
        );
      } else {
        setPaidBy(paidByOptions[0]);
      }
    }, [initialExpense]);

    const canSubmit = useMemo(() => {
      return Boolean(expense.amount > 0 && expense.date && expense.category);
    }, [expense.amount, expense.category, expense.date]);

    const handleSubmit = useCallback(async () => {
      if (!canSubmit || loading) {
        return;
      }

      try {
        setLoading(true);
        const payload = {
          ...expense,
          paidBy: paidBy?.trim() || paidByOptions[0],
        };
        const submitAction = onSubmit ?? createExpenseEntry;
        await submitAction(payload);
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
      onStateChange?.({ canSubmit, loading });
    }, [canSubmit, loading, onStateChange]);

    const handleExpenseChange = (
      field: keyof TExpense,
      value: string | number
    ) => {
      setExpense((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

    return (
      <>
        <div className="space-y-5">
          <div className="relative space-y-2">
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
                  size="sm"
                  className="absolute top-1/2 left-2 -translate-y-1/2"
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
                className="h-10 rounded-xl pr-12 text-right text-lg font-semibold"
                placeholder="0"
                onFocus={() => amountRef.current?.select()}
              />
              <span className="text-muted-foreground absolute top-1/2 right-4 -translate-y-1/2 text-xs">
                VND
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                <Calendar className="text-muted-foreground h-4 w-4" />
                Date
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  handleExpenseChange("date", dayjs().format("DD/MM/YYYY"))
                }
              >
                <RotateCcw className="h-4 w-4" />
                Today
              </Button>
            </div>
            <DatePicker
              value={dayjs(expense.date, "DD/MM/YYYY").toDate()}
              onChange={(date) =>
                handleExpenseChange(
                  "date",
                  date ? dayjs(date).format("DD/MM/YYYY") : ""
                )
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                <Tag className="text-muted-foreground h-4 w-4" />
                Category
              </label>
              <WheelPickerWrapper className="w-full">
                <WheelPicker
                  value={expense.category}
                  onValueChange={(value) =>
                    handleExpenseChange("category", value)
                  }
                  options={categoryWheelOptions}
                  visibleCount={3 * 4}
                  infinite
                  dragSensitivity={5}
                />
              </WheelPickerWrapper>
            </div>
            <div className="space-y-2">
              <label className="text-foreground flex items-center gap-2 text-sm font-medium">
                <UserRound className="text-muted-foreground h-4 w-4" />
                Paid by
              </label>
              <WheelPickerWrapper className="w-full">
                <WheelPicker
                  value={paidBy}
                  onValueChange={setPaidBy}
                  options={paidByWheelOptions}
                  infinite
                  visibleCount={3 * 4}
                  dragSensitivity={5}
                />
              </WheelPickerWrapper>
            </div>
          </div>

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
      </>
    );
  }
);

ManualExpenseForm.displayName = "ManualExpenseForm";

export default ManualExpenseForm;
