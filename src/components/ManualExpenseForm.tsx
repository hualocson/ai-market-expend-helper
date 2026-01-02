"use client";

import { useMemo, useState } from "react";

import dayjs from "@/configs/date";
import { Category } from "@/enums/category";
import { formatVnd, parseVndInput } from "@/lib/utils";
import {
  Calendar,
  DollarSign,
  NotebookPen,
  RotateCcw,
  Tag,
  UserRound,
} from "lucide-react";

import ConfirmAddDrawer from "./ConfirmAddDrawer";
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
  label: category,
}));

const ManualExpenseForm = () => {
  const [expense, setExpense] = useState<TExpense>(defaultExpense);
  const [paidBy, setPaidBy] = useState(paidByOptions[0]);
  const [openConfirmAddDrawer, setOpenConfirmAddDrawer] = useState(false);

  const canSubmit = useMemo(() => {
    return expense.amount > 0 && expense.date && expense.category;
  }, [expense.amount, expense.category, expense.date]);

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
        <div className="space-y-2">
          <label className="text-foreground flex items-center gap-2 text-sm font-medium">
            <DollarSign className="text-muted-foreground h-4 w-4" />
            Amount
          </label>
          <div className="relative">
            <Input
              type="text"
              inputMode="numeric"
              value={formatVnd(expense.amount)}
              onChange={(e) =>
                handleExpenseChange("amount", parseVndInput(e.target.value))
              }
              className="h-10 rounded-xl pr-12 text-right text-lg font-semibold"
              placeholder="0"
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

        <div className="space-y-2">
          <label className="text-foreground flex items-center gap-2 text-sm font-medium">
            <NotebookPen className="text-muted-foreground h-4 w-4" />
            Note
          </label>
          <Textarea
            value={expense.note}
            onChange={(e) => handleExpenseChange("note", e.target.value)}
            placeholder="Optional note about this expense"
            className="min-h-[96px] resize-none rounded-xl"
          />
        </div>

        <Button
          onClick={() => setOpenConfirmAddDrawer(true)}
          disabled={!canSubmit}
          className="h-10 w-full rounded-xl text-base font-medium"
        >
          Add to Sheet
        </Button>
      </div>

      <ConfirmAddDrawer
        open={openConfirmAddDrawer}
        setOpen={setOpenConfirmAddDrawer}
        data={expense}
        defaultPaidBy={paidBy}
      />
    </>
  );
};

export default ManualExpenseForm;
