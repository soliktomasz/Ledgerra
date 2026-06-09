import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountForm, type AccountFormValues } from "./AccountForm";

const values: AccountFormValues = {
  name: "",
  type: "Checking",
  currencyCode: "PLN",
  openingBalance: "0",
  institutionName: "",
  accountNumberMasked: "",
  iconKind: "Bank",
  excludeFromBudget: false,
  excludeFromNetWorth: false
};

describe("AccountForm", () => {
  afterEach(() => cleanup());

  it("offers Mortgage without renaming existing Credit type", () => {
    render(
      <AccountForm
        mode="create"
        values={values}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toContain("Credit");
    expect(options).toContain("Mortgage");
  });

  it("shows separate budget and net worth exclusion toggles", () => {
    render(
      <AccountForm
        mode="create"
        values={values}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole("checkbox", { name: /Exclude from budget/i })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Exclude from net worth/i })).toBeInTheDocument();
  });
});
