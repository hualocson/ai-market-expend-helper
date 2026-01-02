"use client";

import { useEffect, useState } from "react";

import { appendToGoogleSheet } from "@/app/actions/sheet-actions";
import dayjs from "@/configs/date";
import { Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "./ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "./ui/drawer";
import { WheelPicker, WheelPickerWrapper } from "./ui/wheel-picker";

const paidByOptions = ["Cubi", "Embe", "Other"];
const paidByWheelOptions = paidByOptions.map((option) => ({
  value: option,
  label: option,
}));

interface ConfirmAddDrawerProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  data: TExpense;
  defaultPaidBy?: string;
}

const ConfirmAddDrawer: React.FC<ConfirmAddDrawerProps> = ({
  open,
  setOpen,
  data,
  defaultPaidBy,
}) => {
  const [finalData, setFinalData] = useState<
    TExpense & {
      by: string;
    }
  >({
    ...data,
    by: defaultPaidBy || paidByOptions[0],
  });

  useEffect(() => {
    setFinalData({
      ...data,
      by: defaultPaidBy || paidByOptions[0],
    });
  }, [data, defaultPaidBy]);

  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const payload = {
        ...finalData,
        by: finalData.by?.trim() || paidByOptions[0],
      };
      await appendToGoogleSheet(payload);
      setOpen(false);
      toast.success("Expense added successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to add expense");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent className="mx-auto w-full max-w-md">
        <DrawerHeader className="pb-4 text-center">
          <DrawerTitle className="text-foreground text-xl font-semibold">
            Confirm Expense
          </DrawerTitle>
          <DrawerDescription className="text-muted-foreground">
            Review details before adding to your sheet
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-6 pb-6">
          {/* Expense Summary */}
          <div className="bg-muted mb-6 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-foreground font-medium">
                  {finalData.category}
                </p>
                <p className="text-muted-foreground text-sm">
                  {finalData.note || "No note"}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Paid by {finalData.by || "Me"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-foreground text-lg font-semibold">
                  {finalData.amount.toLocaleString()} VND
                </p>
                <p className="text-muted-foreground text-sm">
                  {dayjs(data.date, "DD/MM/YYYY").format("DD/MM/YYYY")}
                </p>
              </div>
            </div>
          </div>

          {/* Paid By */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <UserRound className="text-muted-foreground h-4 w-4" />
              <label className="text-foreground text-sm font-medium">
                Paid by
              </label>
            </div>
            <div className="relative">
              <WheelPickerWrapper className="w-full">
                <WheelPicker
                  value={finalData.by}
                  onValueChange={(value) =>
                    setFinalData((prev) => ({ ...prev, by: value }))
                  }
                  options={paidByWheelOptions}
                  infinite
                  visibleCount={3 * 4}
                  dragSensitivity={5}
                />
              </WheelPickerWrapper>
            </div>
          </div>
        </div>

        <DrawerFooter className="px-6 pb-10">
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-12 rounded-xl font-medium"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              "Add Expense"
            )}
          </Button>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="border-border text-foreground hover:bg-muted h-12 rounded-xl"
          >
            Cancel
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default ConfirmAddDrawer;
