"use client";

import { useEffect, useRef, useState } from "react";

import { Loader2, Plus, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

import ExpenseEntry from "@/components/ExpenseEntry";
import { type ManualExpenseFormHandle } from "@/components/ManualExpenseForm";

const ExpenseEntryDrawer = () => {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [formState, setFormState] = useState({
    canSubmit: false,
    loading: false,
  });
  const formRef = useRef<ManualExpenseFormHandle>(null);
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const isTrackingSwipe = useRef(false);
  const swipeTriggered = useRef(false);
  const submitLabel = "Add Expense";
  const loadingLabel = "Adding...";

  useEffect(() => {
    const checkMobile = () => {
      const hasTouchScreen =
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        ((navigator as Navigator & { msMaxTouchPoints?: number })
          .msMaxTouchPoints ?? 0) > 0;
      const isMobileWidth = window.innerWidth < 768;
      setIsMobile(hasTouchScreen && isMobileWidth);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!isMobile || open) {
      return;
    }

    const SWIPE_OPEN_THRESHOLD = 70;

    const handleTouchStart = (event: TouchEvent) => {
      const isDrawerOpen = document.querySelector(
        '[data-vaul-drawer][data-state="open"]'
      );
      if (isDrawerOpen) {
        isTrackingSwipe.current = false;
        return;
      }

      const target = event.target as HTMLElement;
      if (target.closest("[data-expense-list-item]")) {
        isTrackingSwipe.current = false;
        return;
      }
      let element = target;
      while (
        element &&
        element !== document.body &&
        element !== document.documentElement
      ) {
        const style = window.getComputedStyle(element);
        const overflowX = style.overflowX;
        const isScrollable =
          overflowX === "auto" ||
          overflowX === "scroll" ||
          overflowX === "overlay";

        if (isScrollable && element.scrollWidth > element.clientWidth) {
          isTrackingSwipe.current = false;
          return;
        }

        element = element.parentElement as HTMLElement;
      }

      swipeTriggered.current = false;
      isTrackingSwipe.current = true;
      swipeStartX.current = event.touches[0].clientX;
      swipeStartY.current = event.touches[0].clientY;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!isTrackingSwipe.current || swipeTriggered.current) {
        return;
      }

      const touchX = event.touches[0].clientX;
      const touchY = event.touches[0].clientY;
      const deltaX = touchX - swipeStartX.current;
      const deltaY = touchY - swipeStartY.current;

      if (deltaX < -SWIPE_OPEN_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY)) {
        swipeTriggered.current = true;
        setOpen(true);
      }
    };

    const handleTouchEnd = () => {
      isTrackingSwipe.current = false;
    };

    const handleTouchCancel = () => {
      isTrackingSwipe.current = false;
    };

    document.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    document.addEventListener("touchmove", handleTouchMove, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    document.addEventListener("touchcancel", handleTouchCancel, {
      passive: true,
    });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, [isMobile, open]);

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      direction="right"
      dismissible={false}
    >
      <DrawerTrigger asChild>
        <Button className="w-full sm:w-auto">
          <Plus className="h-4 w-4" />
          Add expense
        </Button>
      </DrawerTrigger>
      <DrawerContent className="backdrop-blur data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:max-w-[min(100svw,680px)]!">
        <DrawerHeader className="text-left">
          <DrawerTitle>Add a new expense</DrawerTitle>
          <DrawerDescription>
            Use AI or the quick form to add a new entry.
          </DrawerDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 rounded-full"
            onClick={() => setOpen(false)}
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </DrawerHeader>
        <div className="no-scrollbar scroll-fade-y flex-1 overflow-y-auto px-2 pb-4">
          <ExpenseEntry
            formRef={formRef}
            showSubmitButton={false}
            onStateChange={setFormState}
          />
        </div>
        <DrawerFooter className="border-t">
          <Button
            onClick={() => formRef.current?.submit()}
            disabled={!formState.canSubmit || formState.loading}
            className="h-10 w-full rounded-xl text-base font-medium"
          >
            {formState.loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {loadingLabel}
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default ExpenseEntryDrawer;
