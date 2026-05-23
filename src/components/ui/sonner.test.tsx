import React from "react";
import { render } from "@testing-library/react";
import type { ToasterProps } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "./sonner";

const sonnerMock = vi.hoisted(() => vi.fn());

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark" }),
}));

vi.mock("sonner", () => ({
  Toaster: (props: unknown) => {
    sonnerMock(props);
    return null;
  },
}));

describe("Toaster", () => {
  beforeEach(() => {
    sonnerMock.mockClear();
  });

  it("uses compact mobile-first app defaults", () => {
    render(<Toaster />);

    expect(sonnerMock).toHaveBeenCalledTimes(1);
    const props = sonnerMock.mock.calls[0]?.[0] as ToasterProps;
    const style = props.style as Record<string, string>;

    expect(props.theme).toBe("dark");
    expect(props.position).toBe("top-right");
    expect(props.richColors).toBe(false);
    expect(props.expand).toBe(false);
    expect(props.visibleToasts).toBe(1);
    expect(props.closeButton).toBe(false);
    expect(props.duration).toBe(3000);
    expect(props.className).toEqual(
      expect.stringContaining("max-[600px]:!w-[calc(100%-24px)]")
    );
    expect(props.mobileOffset).toEqual({
      top: "calc(env(safe-area-inset-top) + 12px)",
      right: "12px",
      bottom: "12px",
      left: "12px",
    });
    expect(style["--normal-bg"]).toBe("var(--popover)");
    expect(style["--normal-text"]).toBe("var(--popover-foreground)");
    expect(style["--normal-border"]).toBe(
      "color-mix(in srgb, var(--border) 76%, transparent)"
    );
    expect(style["--width"]).toBe("fit-content");
    expect(style["--border-radius"]).toBe("12px");
  });

  it("passes compact toast, title, icon, action, and variant classes", () => {
    render(<Toaster />);

    expect(sonnerMock).toHaveBeenCalledTimes(1);
    const props = sonnerMock.mock.calls[0]?.[0] as ToasterProps;
    const classNames = props.toastOptions?.classNames;

    expect(classNames?.toast).toEqual(expect.stringContaining("!min-h-[42px]"));
    expect(classNames?.toast).toEqual(expect.stringContaining("!w-fit"));
    expect(classNames?.toast).toEqual(
      expect.stringContaining("!max-w-[calc(100vw-24px)]")
    );
    expect(classNames?.toast).toEqual(expect.stringContaining("before:w-0.5"));
    expect(classNames?.description).toBe("hidden");
    expect(classNames?.title).toEqual(expect.stringContaining("truncate"));
    expect(classNames?.icon).toEqual(expect.stringContaining("[&>svg]:size-4"));
    expect(classNames?.actionButton).toEqual(
      expect.stringContaining("min-h-8")
    );
    expect(classNames?.success).toBe("[--toast-accent:var(--success)]");
    expect(classNames?.error).toBe("[--toast-accent:var(--destructive)]");
    expect(classNames?.warning).toBe("[--toast-accent:var(--warning)]");
    expect(classNames?.info).toBe("[--toast-accent:var(--info)]");
    expect(classNames?.loading).toBe("[--toast-accent:var(--info)]");
  });

  it("merges caller style and toast option overrides", () => {
    render(
      <Toaster
        id="app-toast"
        position="bottom-center"
        style={{ "--width": "18rem" } as React.CSSProperties}
        toastOptions={{
          classNames: {
            title: "custom-title",
          },
        }}
      />
    );

    expect(sonnerMock).toHaveBeenCalledTimes(1);
    const props = sonnerMock.mock.calls[0]?.[0] as ToasterProps;
    const style = props.style as Record<string, string>;
    const classNames = props.toastOptions?.classNames;

    expect(props.id).toBe("app-toast");
    expect(props.position).toBe("bottom-center");
    expect(style["--normal-bg"]).toBe("var(--popover)");
    expect(style["--width"]).toBe("18rem");
    expect(classNames?.toast).toEqual(expect.stringContaining("!min-h-[42px]"));
    expect(classNames?.title).toBe("custom-title");
  });
});
