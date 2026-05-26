import React from "react";

import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DeferredRecoveryWork from "./DeferredRecoveryWork";

type DynamicLoader = () => Promise<{ default: React.ComponentType }>;
type DynamicOptions = { ssr?: boolean };

const dynamicSsrOptions = vi.hoisted((): Array<boolean | undefined> => []);

vi.mock("next/dynamic", async () => {
  const ReactActual = await vi.importActual<typeof import("react")>("react");

  return {
    default: (loader: DynamicLoader, options?: DynamicOptions) => {
      dynamicSsrOptions.push(options?.ssr);

      return function MockDynamicComponent() {
        const [LoadedComponent, setLoadedComponent] =
          ReactActual.useState<React.ComponentType | null>(null);

        ReactActual.useEffect(() => {
          let mounted = true;

          void loader().then((mod) => {
            if (mounted) {
              setLoadedComponent(() => mod.default);
            }
          });

          return () => {
            mounted = false;
          };
        }, []);

        return LoadedComponent ? <LoadedComponent /> : null;
      };
    },
  };
});

vi.mock("@/components/QuickExpenseMutationCoordinator", () => ({
  default: function MockQuickExpenseMutationCoordinator() {
    return <div data-testid="quick-expense-mutation-coordinator" />;
  },
}));

vi.mock("@/components/QuickExpenseRecoverySheetHost", () => ({
  default: function MockQuickExpenseRecoverySheetHost() {
    return <div data-testid="quick-expense-recovery-sheet-host" />;
  },
}));

describe("DeferredRecoveryWork", () => {
  afterEach(() => {
    dynamicSsrOptions.length = 0;
    vi.useRealTimers();
  });

  it("defers recovery-only root work until after the startup delay", async () => {
    vi.useFakeTimers();

    render(<DeferredRecoveryWork />);

    expect(
      screen.queryByTestId("quick-expense-mutation-coordinator")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("quick-expense-recovery-sheet-host")
    ).not.toBeInTheDocument();
    expect(dynamicSsrOptions).toEqual([false, false]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(
      screen.getByTestId("quick-expense-mutation-coordinator")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("quick-expense-recovery-sheet-host")
    ).toBeInTheDocument();
  });

  it("clears the startup delay when unmounted before recovery work starts", async () => {
    vi.useFakeTimers();

    const { unmount } = render(<DeferredRecoveryWork />);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(
      screen.queryByTestId("quick-expense-mutation-coordinator")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("quick-expense-recovery-sheet-host")
    ).not.toBeInTheDocument();
  });
});
