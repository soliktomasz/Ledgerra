import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TransactionForm, toDateTimeLocal } from "./TransactionForm";

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
});
