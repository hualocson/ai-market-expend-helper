"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { ArrowUpIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type JumpToTopButtonProps = {
  className?: string;
  threshold?: number;
  targetId?: string;
  targetSelector?: string;
  label?: string;
};

const DEFAULT_THRESHOLD = 50;

const resolveScrollTarget = (
  targetId?: string,
  targetSelector?: string
): HTMLElement | null => {
  if (typeof document === "undefined") {
    return null;
  }

  if (targetId) {
    return document.getElementById(targetId);
  }

  if (targetSelector) {
    return document.querySelector(targetSelector);
  }

  return null;
};

const getScrollTop = (target: HTMLElement | Window) => {
  if ("scrollY" in target) {
    return target.scrollY || document.documentElement.scrollTop;
  }

  return target.scrollTop;
};

const scrollToTop = (target: HTMLElement | Window) => {
  if ("scrollTo" in target) {
    target.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    (target as HTMLElement).scrollTop = 0;
  }
};

const JumpToTopButton = ({
  className,
  threshold = DEFAULT_THRESHOLD,
  targetId,
  targetSelector,
  label = "Jump to top",
}: JumpToTopButtonProps) => {
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const targetElement = resolveScrollTarget(targetId, targetSelector);
    const target = targetElement ?? window;

    const handleScroll = () => {
      setIsVisible(getScrollTop(target) > threshold);
    };

    handleScroll();

    if (target === window) {
      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => window.removeEventListener("scroll", handleScroll);
    }

    target.addEventListener("scroll", handleScroll, { passive: true });
    return () => target.removeEventListener("scroll", handleScroll);
  }, [targetId, targetSelector, threshold]);

  const handleClick = () => {
    const targetElement = resolveScrollTarget(targetId, targetSelector);
    const target = targetElement ?? window;
    scrollToTop(target);
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      aria-label={label}
      onClick={handleClick}
      className={cn(
        "active:bg-secondary/90 fixed right-5 bottom-[120px] z-40 rounded-full shadow-lg transition-all duration-200 active:scale-[0.97]",
        isVisible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0",
        className
      )}
    >
      <ArrowUpIcon />
    </Button>
  );
};

export default JumpToTopButton;
