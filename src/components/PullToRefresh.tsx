"use client";

import type { PropsWithChildren } from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { RefreshCw } from "lucide-react";

const PULL_THRESHOLD = 50; // Pixels to pull before triggering refresh
const MAX_PULL_DISTANCE = 80; // Maximum pull distance for visual feedback

/**
 * Pull-to-refresh component for mobile devices
 * Triggers a full page reload when user pulls down from the top
 */
export function PullToRefresh({ children }: PropsWithChildren) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const touchStartY = useRef(0);
  const canPull = useRef(false);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);

  // Detect if device is mobile/touch-enabled
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

  // Sync state to refs
  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
  }, [isRefreshing]);

  useEffect(() => {
    if (!isMobile) {
      return;
    }

    const handleTouchStart = (e: TouchEvent) => {
      // Check if a drawer is open
      const isDrawerOpen = document.querySelector(
        '[data-vaul-drawer][data-state="open"]'
      );
      if (isDrawerOpen) {
        canPull.current = false;
        return;
      }

      // Check if touch is on a child scrollable element (not root)
      const target = e.target as HTMLElement;
      let element = target;
      while (
        element &&
        element !== document.body &&
        element !== document.documentElement
      ) {
        const style = window.getComputedStyle(element);
        const overflowY = style.overflowY;
        const isScrollable =
          overflowY === "auto" ||
          overflowY === "scroll" ||
          overflowY === "overlay";

        if (isScrollable && element.scrollHeight > element.clientHeight) {
          // Touch is on a scrollable child element, skip pull-to-refresh
          canPull.current = false;
          return;
        }

        element = element.parentElement as HTMLElement;
      }

      // Only allow pull-to-refresh when at the top of the HTML/root scroll
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      canPull.current = scrollTop === 0;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!canPull.current || isRefreshingRef.current) {
        return;
      }

      const touchY = e.touches[0].clientY;
      const pullDist = touchY - touchStartY.current;

      // Only track downward pulls
      if (pullDist > 0) {
        // Prevent default browser pull-to-refresh if it exists
        if (pullDist > 10 && e.cancelable) {
          e.preventDefault();
        }

        // Apply resistance to pull distance
        const resistance = 0.3;
        const distance = Math.min(pullDist * resistance, MAX_PULL_DISTANCE);
        setIsReleasing(false);
        setPullDistance(distance);
      }
    };

    const handleTouchEnd = () => {
      if (!canPull.current || isRefreshingRef.current) {
        setIsReleasing(true);
        setPullDistance(0);
        return;
      }

      // Trigger refresh if threshold is met
      if (pullDistanceRef.current >= PULL_THRESHOLD) {
        setIsRefreshing(true);
        // Full page reload
        window.location.reload();
      } else {
        // Animate back to start
        setIsReleasing(true);
        setPullDistance(0);
      }

      canPull.current = false;
    };

    const handleTouchCancel = () => {
      // Reset state on gesture interruption (e.g., incoming call, notification)
      canPull.current = false;
      setIsReleasing(true);
      setPullDistance(0);
    };

    document.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
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
  }, [isMobile]);

  if (!isMobile) {
    return <>{children}</>;
  }

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const rotation = progress * 360;
  const opacity = Math.min(progress, 0.8);
  const scale = 0.5 + progress * 0.5;

  return (
    <>
      <div
        className={cn(
          "pointer-events-none fixed top-0 left-1/2 z-999999 flex items-center justify-center",
          {
            "transition-all duration-300 ease-out": isReleasing,
          }
        )}
        style={{
          transform: `translateX(-50%) translateY(${pullDistance}px)`,
          left: "50%",
          opacity: opacity,
        }}
      >
        <div
          className={cn(
            "bg-background flex h-10 w-10 items-center justify-center rounded-full shadow-lg backdrop-blur-md",
            {
              "ease-drawer transition-all duration-300": isReleasing,
            }
          )}
          style={{
            transform: `scale(${scale}) rotate(${rotation}deg)`,
          }}
        >
          <RefreshCw
            className={cn("text-primary", { "animate-spin": isRefreshing })}
            size={24}
          />
        </div>
      </div>
      {children}
    </>
  );
}
