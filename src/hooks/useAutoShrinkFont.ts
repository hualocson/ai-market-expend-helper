"use client";

import { useEffect, type RefObject } from "react";

type TAutoShrinkFontOptions = {
  max?: number;
  min?: number;
  step?: number;
};

export const useAutoShrinkFont = (
  ref: RefObject<HTMLInputElement | null>,
  options: TAutoShrinkFontOptions = {}
) => {
  const { max = 16, min = 11, step = 1 } = options;

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const fit = () => {
      node.style.fontSize = `${max}px`;
      let current = max;
      while (current > min && node.scrollWidth > node.clientWidth) {
        current -= step;
        node.style.fontSize = `${current}px`;
      }
    };

    fit();
    node.addEventListener("input", fit);
    return () => node.removeEventListener("input", fit);
  }, [ref, max, min, step]);
};
