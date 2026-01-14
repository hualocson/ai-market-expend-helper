"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: number;
  primaryColor?: string;
  secondaryColor?: string;
}

const Loader = ({
  size = 50,
  primaryColor = "var(--foreground)",
  secondaryColor = "var(--primary)",
  className,
  style,
  ...props
}: LoaderProps) => {
  const dotSize = Math.round(size * 0.4);
  const gapSize = Math.round(size * 0.2);
  const dotOffset = Math.round(size * 0.6);
  const dotShift = Math.round(size * 0.3);

  return (
    <div
      className={cn("loader", className)}
      style={
        {
          "--loader-size": `${size}px`,
          "--dot-size": `${dotSize}px`,
          "--dot-gap": `${gapSize}px`,
          "--dot-offset": `${dotOffset}px`,
          "--dot-shift": `${dotShift}px`,
          "--loader-primary": primaryColor,
          "--loader-secondary": secondaryColor,
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Loader };
