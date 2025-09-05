"use client";

import { useEffect, useState } from "react";

import { appendToGoogleSheet } from "@/app/actions/sheet-actions";
import { cn } from "@/lib/utils";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { CircleCheck, Loader2, StarIcon, WormIcon } from "lucide-react";
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
    icon: <StarIcon className="text-muted-foreground mb-2.5" />,
  },
  {
    value: "",
    label: "Embe",
    description: "Embe tra",
    icon: <WormIcon className="text-muted-foreground mb-2.5" />,
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
      toast.success("Expense added successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to add expense");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent className="mx-auto w-full max-w-md px-4">
        <DrawerHeader>
          <DrawerTitle>Confirm Add Expense</DrawerTitle>
          <DrawerDescription>{JSON.stringify(finalData)}</DrawerDescription>
        </DrawerHeader>
        <RadioGroup.Root
          defaultValue={finalData.by}
          onValueChange={(value) =>
            setFinalData((prev) => ({ ...prev, by: value }))
          }
          className="grid w-full grid-cols-2 gap-3"
        >
          {options.map((option) => (
            <RadioGroup.Item
              key={option.value}
              value={option.value}
              className={cn(
                "group ring-border relative rounded px-3 py-2 text-start ring-[1px]",
                "data-[state=checked]:ring-2 data-[state=checked]:ring-blue-500"
              )}
            >
              <CircleCheck className="text-primary absolute top-0 right-0 h-6 w-6 translate-x-1/2 -translate-y-1/2 fill-blue-500 stroke-white group-data-[state=unchecked]:hidden" />
              {option.icon}
              <span className="font-semibold tracking-tight">
                {option.label}
              </span>
              <p className="text-xs">{option.description}</p>
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>

        <DrawerFooter className="mx-auto w-full max-w-md px-0">
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : "Submit"}
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default ConfirmAddDrawer;
