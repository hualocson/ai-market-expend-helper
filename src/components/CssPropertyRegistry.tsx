"use client";

import { useEffect } from "react";

type RegisterableCss = typeof CSS & {
  registerProperty?: (definition: {
    name: string;
    syntax: string;
    inherits: boolean;
    initialValue: string;
  }) => void;
};

const scrollFadeProperties = ["--ft", "--fb", "--fl", "--fr"] as const;

const CssPropertyRegistry = () => {
  useEffect(() => {
    const registerProperty = (CSS as RegisterableCss).registerProperty;
    if (!registerProperty) {
      return;
    }

    scrollFadeProperties.forEach((name) => {
      try {
        registerProperty({
          name,
          syntax: "<length>",
          inherits: false,
          initialValue: "0px",
        });
      } catch {
        // Browsers throw when a property is already registered.
      }
    });
  }, []);

  return null;
};

export default CssPropertyRegistry;
