"use client";

import { useEffect, useState } from "react";

import { appendToGoogleSheet } from "@/app/actions/sheet-actions";
import dayjs from "@/configs/date";
import { cn } from "@/lib/utils";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { Check, Loader2, User, Users } from "lucide-react";
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

const options = [
  {
    value: "Cubi",
    label: "Anhbe",
    description: "Anhbe tra",
    icon: <User className="h-5 w-5" />,
  },
  {
    value: "",
    label: "Embe",
    description: "Embe tra",
    icon: <Users className="h-5 w-5" />,
  },
];

interface ConfirmAddDrawerProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  data: TExpense;
}

const ConfirmAddDrawer: React.FC<ConfirmAddDrawerProps> = ({
  open,
  setOpen,
  data,
}) => {
  const [finalData, setFinalData] = useState<
    TExpense & {
      by: string;
    }
  >({
    ...data,
    by: options[0].value,
  });

  useEffect(() => {
    setFinalData({
      ...data,
      by: options[0].value,
    });
  }, [data]);

  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await appendToGoogleSheet(finalData);
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
            Choose who paid for this expense
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

          {/* Person Selection */}
          <div className="space-y-3">
            <label className="text-foreground text-sm font-medium">
              Who paid for this?
            </label>
            <RadioGroup.Root
              defaultValue={finalData.by}
              onValueChange={(value) =>
                setFinalData((prev) => ({ ...prev, by: value }))
              }
              className="grid grid-cols-2 gap-4"
            >
              {options.map((option) => (
                <RadioGroup.Item
                  key={option.value}
                  value={option.value}
                  className={cn(
                    "group border-border relative flex flex-col items-center gap-4 rounded-xl border-2 p-4 transition-all duration-200",
                    "hover:border-border hover:bg-muted/50",
                    "data-[state=checked]:border-primary data-[state=checked]:bg-primary/10"
                  )}
                >
                  <span className="bg-muted group-data-[state=checked]:bg-primary/20 flex h-10 w-10 items-center justify-center rounded-full">
                    {option.icon}
                  </span>
                  <div className="flex-1">
                    <p className="text-foreground font-medium">
                      {option.label}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {option.description}
                    </p>
                  </div>
                  <span className="absolute top-4 right-4">
                    <Check className="text-primary size-4 group-data-[state=unchecked]:hidden" />
                  </span>
                </RadioGroup.Item>
              ))}
            </RadioGroup.Root>
          </div>
        </div>

        <DrawerFooter className="px-6 pb-6">
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
