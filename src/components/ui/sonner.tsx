"use client";

import React from "react";

import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Info,
  LoaderCircle,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const TOAST_MOBILE_OFFSET = {
  top: "calc(env(safe-area-inset-top) + 12px)",
  right: "12px",
  bottom: "12px",
  left: "12px",
} satisfies ToasterProps["mobileOffset"];

const TOAST_CLASS_NAMES: NonNullable<
  NonNullable<ToasterProps["toastOptions"]>["classNames"]
> = {
  toast:
    "pointer-events-auto !max-w-[calc(100vw-24px)] !min-h-[42px] !w-fit !rounded-3xl glass-border !py-2 !text-[13px] !font-medium !leading-tight !text-popover-foreground !-translate-x-1/2 !left-1/2",
  title: "truncate text-[13px] !min-w-[calc(55vw)] font-medium leading-tight",
  description: "hidden",
  content: "min-w-0",
  icon: "shrink-0 text-[var(--toast-accent,var(--muted-foreground))] [&>svg]:size-4",
  actionButton:
    "relative !ml-4 ring min-h-8 !rounded-full !bg-white/10 !px-3 text-xs font-semibold !ring-0 !text-foreground transition-[background-color,transform] duration-150 ease-out before:absolute before:-inset-1 active:scale-[0.96]",
  success: "[--toast-accent:var(--success)]",
  error: "[--toast-accent:var(--destructive)]",
  warning: "[--toast-accent:var(--warning)]",
  info: "[--toast-accent:var(--info)]",
  loading: "[--toast-accent:var(--info)]",
};

const TOAST_ICONS: ToasterProps["icons"] = {
  success: <CheckCircle2 aria-hidden="true" />,
  error: <CircleAlert aria-hidden="true" />,
  warning: <AlertTriangle aria-hidden="true" />,
  info: <Info aria-hidden="true" />,
  loading: <LoaderCircle aria-hidden="true" className="animate-spin" />,
};

const Toaster = ({ toastOptions, style, ...props }: ToasterProps) => {
  const { theme = "dark" } = useTheme();

  return (
    <Sonner
      position="top-center"
      richColors={false}
      expand={false}
      visibleToasts={3}
      closeButton={false}
      duration={3000}
      mobileOffset={TOAST_MOBILE_OFFSET}
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={TOAST_ICONS}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "transparent",
          "--border-radius": "24px",
          "--width": "fit-content",
          ...style,
        } as React.CSSProperties
      }
      toastOptions={{
        closeButton: false,
        ...toastOptions,
        classNames: {
          ...TOAST_CLASS_NAMES,
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
