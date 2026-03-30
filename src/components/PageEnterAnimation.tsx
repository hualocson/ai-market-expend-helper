"use client";

import type { PropsWithChildren } from "react";

import type { Variants } from "motion/react";
import { motion, useReducedMotion } from "motion/react";

interface PageEnterAnimationProps extends PropsWithChildren {
  className?: string;
}

interface PageEnterSectionProps extends PropsWithChildren {
  className?: string;
}

const pageContainerVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.42,
      ease: [0.22, 1, 0.36, 1],
      when: "beforeChildren",
      delayChildren: 0.06,
      staggerChildren: 0.08,
    },
  },
};

const sectionVariants: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 280,
      damping: 26,
      mass: 0.7,
    },
  },
};

export default function PageEnterAnimation({
  children,
  className,
}: PageEnterAnimationProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      animate="visible"
      className={className}
      initial={shouldReduceMotion ? false : "hidden"}
      variants={pageContainerVariants}
    >
      {children}
    </motion.div>
  );
}

export function PageEnterSection({ children, className }: PageEnterSectionProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      transition={shouldReduceMotion ? { duration: 0 } : undefined}
      variants={sectionVariants}
    >
      {children}
    </motion.div>
  );
}
