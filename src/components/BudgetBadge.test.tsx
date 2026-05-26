import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import BudgetBadge from "./BudgetBadge";

describe("BudgetBadge", () => {
  it("renders budget icon and name", () => {
    render(<BudgetBadge icon="🍜" color="rose" name="Meals" />);

    expect(screen.getByText("🍜")).toBeInTheDocument();
    expect(screen.getByText("Meals")).toBeInTheDocument();
    expect(screen.getByLabelText("Budget: Meals")).toBeInTheDocument();
  });

  it("uses fallback appearance for missing icon and color", () => {
    render(<BudgetBadge icon={null} color={null} name="Budget assigned" />);

    expect(screen.getByText("💰")).toBeInTheDocument();
    expect(screen.getByText("Budget assigned")).toBeInTheDocument();
  });

  it("can render icon-only for dense controls", () => {
    render(<BudgetBadge icon="🛒" color="emerald" name="Groceries" iconOnly />);

    expect(screen.getByText("🛒")).toBeInTheDocument();
    expect(screen.queryByText("Groceries")).not.toBeInTheDocument();
  });
});
