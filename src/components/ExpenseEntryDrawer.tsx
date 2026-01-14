"use client";

import { useEffect, useRef, useState } from "react";

import { Loader2, Plus, XIcon } from "lucide-react";

import { cn } from "@/lib/utils";

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

type ExpenseEntryDrawerProps = {
  compact?: boolean;
};

const ExpenseEntryDrawer = ({ compact = false }: ExpenseEntryDrawerProps) => {
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
  const closeSwipeStartX = useRef(0);
  const closeSwipeStartY = useRef(0);
  const isTrackingCloseSwipe = useRef(false);
  const closeSwipeTriggered = useRef(false);
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

      if (
        deltaX < -SWIPE_OPEN_THRESHOLD &&
        Math.abs(deltaX) > Math.abs(deltaY)
      ) {
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

  useEffect(() => {
    if (!isMobile || !open) {
      return;
    }

    const SWIPE_CLOSE_THRESHOLD = 70;

    const handleTouchStart = (event: TouchEvent) => {
      const openDrawer = document.querySelector(
        '[data-vaul-drawer][data-state="open"]'
      ) as HTMLElement | null;

      if (!openDrawer) {
        isTrackingCloseSwipe.current = false;
        return;
      }

      const target = event.target as HTMLElement;
      if (!openDrawer.contains(target)) {
        isTrackingCloseSwipe.current = false;
        return;
      }

      let element = target;
      while (element && element !== openDrawer) {
        const style = window.getComputedStyle(element);
        const overflowX = style.overflowX;
        const isScrollable =
          overflowX === "auto" ||
          overflowX === "scroll" ||
          overflowX === "overlay";

        if (isScrollable && element.scrollWidth > element.clientWidth) {
          isTrackingCloseSwipe.current = false;
          return;
        }

        element = element.parentElement as HTMLElement;
      }

      closeSwipeTriggered.current = false;
      isTrackingCloseSwipe.current = true;
      closeSwipeStartX.current = event.touches[0].clientX;
      closeSwipeStartY.current = event.touches[0].clientY;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!isTrackingCloseSwipe.current || closeSwipeTriggered.current) {
        return;
      }

      const touchX = event.touches[0].clientX;
      const touchY = event.touches[0].clientY;
      const deltaX = touchX - closeSwipeStartX.current;
      const deltaY = touchY - closeSwipeStartY.current;

      if (
        deltaX > SWIPE_CLOSE_THRESHOLD &&
        Math.abs(deltaX) > Math.abs(deltaY)
      ) {
        closeSwipeTriggered.current = true;
        setOpen(false);
      }
    };

    const handleTouchEnd = () => {
      isTrackingCloseSwipe.current = false;
    };

    const handleTouchCancel = () => {
      isTrackingCloseSwipe.current = false;
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
      autoFocus
      repositionInputs
    >
      <DrawerTrigger asChild>
        <Button
          size={compact ? "icon-lg" : "default"}
          aria-label={compact ? "Add expense" : undefined}
          className={cn(
            "rounded-full shadow-[0_25px_60px_rgba(0,0,0,0.45)] active:scale-[0.97]",
            compact && "size-12"
          )}
        >
          <Plus className={compact ? "h-5 w-5" : "h-4 w-4"} />
          {compact ? null : "Add expense"}
        </Button>
      </DrawerTrigger>
      <DrawerContent
        onInteractOutside={() => setOpen(false)}
        className="rounded-l-3xl backdrop-blur data-[vaul-drawer-direction=right]:w-[90svw] data-[vaul-drawer-direction=right]:max-w-[min(100svw,680px)]!"
      >
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
            tabIndex={-1}
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
