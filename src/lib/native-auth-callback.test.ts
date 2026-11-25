import { describe, expect, it } from "vitest";
import {
  NATIVE_AUTH_REDIRECT_URL,
  parseNativeAuthCallback,
} from "./native-auth-callback.ts";

describe("parseNativeAuthCallback", () => {
  it("extracts a PKCE authorization code", () => {
    expect(
      parseNativeAuthCallback(`${NATIVE_AUTH_REDIRECT_URL}?code=oauth-code`),
    ).toEqual({ type: "code", code: "oauth-code" });
  });

  it("supports implicit-flow tokens returned in the URL fragment", () => {
    expect(
      parseNativeAuthCallback(
        `${NATIVE_AUTH_REDIRECT_URL}#access_token=access&refresh_token=refresh`,
      ),
    ).toEqual({
      type: "session",
      accessToken: "access",
      refreshToken: "refresh",
    });
  });

  it("returns provider errors and identifies callbacks without credentials", () => {
    expect(
      parseNativeAuthCallback(
        `${NATIVE_AUTH_REDIRECT_URL}?error=access_denied&error_description=Cancelled`,
      ),
    ).toEqual({ type: "error", message: "Cancelled" });
    expect(parseNativeAuthCallback(NATIVE_AUTH_REDIRECT_URL)).toEqual({
      type: "missing",
    });
  });

  it("ignores URLs outside the app auth callback", () => {
    expect(parseNativeAuthCallback("https://example.com/auth-callback")).toBeNull();
  });
});
