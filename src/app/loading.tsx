"use client";

import { useEffect, useRef } from "react";

import type { Variants } from "motion/react";
import { MotionConfig, motion, useReducedMotion } from "motion/react";

import Logo from "@/components/Logo";

const shellVariants: Variants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.32,
      ease: [0.22, 1, 0.36, 1],
      when: "beforeChildren",
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: {
      duration: 0.22,
      ease: [0.4, 0, 1, 1],
      when: "afterChildren",
    },
  },
};

const logoVariants: Variants = {
  initial: { opacity: 0, scale: 0.84, y: 10, rotate: -6 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    rotate: 0,
    transition: { type: "spring", stiffness: 330, damping: 26, mass: 0.8 },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    y: -12,
    rotate: 6,
    transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
  },
};

export default function Loading() {
  const shouldReduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    return () => {
      if (shouldReduceMotion) {
        return;
      }

      const root = rootRef.current;
      if (!root || typeof document === "undefined") {
        return;
      }

      const bounds = root.getBoundingClientRect();
      const clone = root.cloneNode(true) as HTMLElement;
      clone.style.position = "fixed";
      clone.style.top = `${bounds.top}px`;
      clone.style.left = `${bounds.left}px`;
      clone.style.width = `${bounds.width}px`;
      clone.style.height = `${bounds.height}px`;
      clone.style.margin = "0";
      clone.style.pointerEvents = "none";
      clone.style.zIndex = "9999";
      clone.style.transformOrigin = "50% 50%";
      document.body.appendChild(clone);

      const exitAnimation = clone.animate(
        [
          { opacity: 1, transform: "scale(1) translateY(0px)" },
          { opacity: 0, transform: "scale(0.88) translateY(-12px)" },
        ],
        {
          duration: 220,
          easing: "cubic-bezier(0.4, 0, 1, 1)",
          fill: "forwards",
        }
      );

      exitAnimation.onfinish = () => clone.remove();
      exitAnimation.oncancel = () => clone.remove();
    };
  }, [shouldReduceMotion]);

  return (
    <MotionConfig reducedMotion="user">
      <motion.main
        ref={rootRef}
        className="relative flex min-h-svh items-center justify-center px-6 pb-[calc(100px+env(safe-area-inset-bottom)-12px)]"
        initial={shouldReduceMotion ? { opacity: 0 } : "initial"}
        animate={shouldReduceMotion ? { opacity: 1 } : "animate"}
        variants={shellVariants}
      >
        <motion.span
          aria-hidden
          className="from-primary/30 via-secondary/30 to-primary/30 pointer-events-none absolute h-32 w-32 rounded-full bg-linear-to-r blur-2xl"
          initial={{ opacity: 0.25, scale: 0.92 }}
          animate={
            shouldReduceMotion
              ? { opacity: 0.35 }
              : {
                  opacity: [0.2, 0.45, 0.2],
                  scale: [0.95, 1.1, 0.95],
                  transition: {
                    duration: 1.7,
                    ease: "easeInOut",
                    repeat: Infinity,
                  },
                }
          }
        />
        <motion.span
          className="from-primary to-secondary relative inline-flex rounded-full bg-linear-to-r p-0.5"
          variants={logoVariants}
        >
          <Logo className="rounded-full" />
        </motion.span>
      </motion.main>
    </MotionConfig>
  );
}
