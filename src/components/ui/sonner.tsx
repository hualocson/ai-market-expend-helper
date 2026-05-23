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
    "pointer-events-auto relative !left-auto !right-0 !min-h-[42px] !w-fit !max-w-[calc(100vw-24px)] !rounded-xl !border !border-[color-mix(in_srgb,var(--border)_76%,transparent)] !bg-popover !px-3 !py-2 !text-[13px] !font-medium !leading-tight !text-popover-foreground !shadow-[0_16px_36px_rgb(0_0_0_/_34%)] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-0.5 before:rounded-r-full before:bg-[var(--toast-accent,var(--border))]",
  title: "truncate text-[13px] font-medium leading-tight",
  description: "hidden",
  content: "min-w-0",
  icon: "shrink-0 text-[var(--toast-accent,var(--muted-foreground))] [&>svg]:size-4",
  actionButton:
    "relative ml-2 min-h-8 rounded-full bg-foreground/10 px-2.5 text-xs font-semibold text-foreground transition-[background-color,transform] duration-150 ease-out before:absolute before:-inset-1 active:scale-[0.96]",
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
      position="top-right"
      richColors={false}
      expand={false}
      visibleToasts={1}
      closeButton={false}
      duration={3000}
      mobileOffset={TOAST_MOBILE_OFFSET}
      theme={theme as ToasterProps["theme"]}
      className="toaster group max-[600px]:!w-[calc(100%-24px)]"
      icons={TOAST_ICONS}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border":
            "color-mix(in srgb, var(--border) 76%, transparent)",
          "--border-radius": "12px",
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
