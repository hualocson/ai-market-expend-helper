import React from "react";

import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import InstantShellBridge from "./InstantShellBridge";

describe("InstantShellBridge", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-instant-shell-hydrated");
  });

  it("marks the instant shell hydrated after mount", async () => {
    render(<InstantShellBridge />);

    await waitFor(() =>
      expect(document.documentElement.dataset.instantShellHydrated).toBe("true")
    );
  });
});
