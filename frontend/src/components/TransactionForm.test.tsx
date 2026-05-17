import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { apiClient } from "../api/client";
import { TransactionForm, toDateTimeLocal } from "./TransactionForm";

vi.mock("../api/client", () => ({
  apiClient: {
    createTransaction: vi.fn(),
    updateTransaction: vi.fn(),
    createCategory: vi.fn()
  }
}));

function formatLocalDateTime(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

describe("TransactionForm date values", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  test("formats existing timestamps for datetime-local inputs using local time", () => {
    const timestamp = "2026-04-10T12:00:00Z";

    expect(toDateTimeLocal(timestamp)).toBe(formatLocalDateTime(new Date(timestamp)));
  });

  test("uses local time for the default datetime-local value", () => {
    const now = new Date("2026-04-10T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    render(
      <TransactionForm
        token="token"
        accounts={[]}
        categories={[]}
        mode="create"
        onSaved={() => undefined}
      />
    );

    expect(screen.getByLabelText("Date and time")).toHaveValue(formatLocalDateTime(now));
  });

  test("submits transfer with selected savings goal id", async () => {
    vi.mocked(apiClient.createTransaction).mockResolvedValue({
      id: "t1",
      accountId: "a1",
      amount: 20,
      type: "TransferOut",
      occurredOnUtc: new Date().toISOString()
    });
    render(
      <TransactionForm
        token="token"
        accounts={[
          { id: "a1", name: "Main", type: "Checking", currencyCode: "USD", openingBalance: 0, currentBalance: 0, isActive: true, iconKind: "Bank" },
          { id: "a2", name: "Savings", type: "Savings", currencyCode: "USD", openingBalance: 0, currentBalance: 0, isActive: true, iconKind: "Piggy" }
        ]}
        categories={[]}
        savingsGoals={[{ id: "g1", name: "Trip", targetAmount: 1000, savedAmount: 0, progressPercent: 0 }]}
        mode="create"
        initialValues={{ type: "Transfer", accountId: "a1", destinationAccountId: "a2", amount: "20", occurredOnUtc: "2026-05-10T12:00", savingsGoalId: "g1" }}
        onSaved={() => undefined}
      />
    );
    fireEvent.submit(screen.getByRole("button", { name: "Save transaction" }));
    expect(apiClient.createTransaction).toHaveBeenCalledWith("token", expect.objectContaining({ savingsGoalId: "g1" }));
  });
});
