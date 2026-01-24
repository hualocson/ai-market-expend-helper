"use client";

import { useEffect, useState } from "react";

export function useKeyboardOffset() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!window.visualViewport) {
      return;
    }

    const handler = () => {
      const vv = window.visualViewport!;
      const keyboard = window.innerHeight - vv.height - vv.offsetTop;
      setOffset(Math.max(0, keyboard));
    };

    window.visualViewport.addEventListener("resize", handler);
    window.visualViewport.addEventListener("scroll", handler);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handler);
        window.visualViewport.removeEventListener("scroll", handler);
      }
    };
  }, []);

  return offset;
}
