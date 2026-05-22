import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";

vi.mock("../state/AuthContext", () => ({
  useAuth: () => ({
    login: vi.fn()
  })
}));

vi.mock("../state/I18nContext", () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}));

describe("LoginPage", () => {
  it("does not render a required email field when creating an account", async () => {
    render(<LoginPage />);

    await userEvent.click(screen.getByRole("button", { name: "login.createAccount" }));

    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });
});
