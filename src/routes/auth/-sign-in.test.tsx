import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { navigate, signInWithOAuth, signInWithPassword, signUp } = vi.hoisted(
  () => ({
    navigate: vi.fn(),
    signInWithOAuth: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
  }),
);

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: () => ReactNode }) => ({
    options,
  }),
  Link: ({
    children,
    to,
  }: {
    children: ReactNode;
    to: string;
  }) => <a href={to}>{children}</a>,
  useNavigate: () => navigate,
}));

vi.mock("@/lib/supabase.ts", () => ({
  hasSupabaseConfig: true,
  supabase: {
    auth: { signInWithOAuth, signInWithPassword, signUp },
  },
}));

import { SignInPage } from "./sign-in.tsx";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("email authentication on SignInPage", () => {
  it("creates an account and tells users to confirm their email", async () => {
    const user = userEvent.setup();
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    render(<SignInPage />);

    await user.click(screen.getByRole("button", { name: "Create an account" }));
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(signUp).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "password123",
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Check your email for a confirmation link",
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("signs in with email and password and navigates to the app", async () => {
    const user = userEvent.setup();
    signInWithPassword.mockResolvedValue({ error: null });
    render(<SignInPage />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in with email" }));

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
      });
    });
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });

  it("shows Supabase authentication errors", async () => {
    signInWithPassword.mockResolvedValue({
      error: new Error("Invalid login credentials"),
    });
    render(<SignInPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in with email" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid login credentials",
    );
  });
});
