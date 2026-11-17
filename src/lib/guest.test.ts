import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getGuestToken } from "./guest.ts";

const originalRandomUUID = Object.getOwnPropertyDescriptor(
  window.crypto,
  "randomUUID",
);

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  if (originalRandomUUID) {
    Object.defineProperty(window.crypto, "randomUUID", originalRandomUUID);
  } else {
    Reflect.deleteProperty(window.crypto, "randomUUID");
  }
  window.localStorage.clear();
});

describe("guest token creation", () => {
  it("uses secure random values when randomUUID is unavailable", () => {
    Object.defineProperty(window.crypto, "randomUUID", {
      configurable: true,
      value: undefined,
    });

    const token = getGuestToken();

    expect(token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(window.localStorage.getItem("astrid-guest-token")).toBe(token);
  });

  it("reuses a valid guest token for the current browser", () => {
    window.localStorage.setItem(
      "astrid-guest-token",
      "123e4567-e89b-42d3-a456-426614174000",
    );

    expect(getGuestToken()).toBe(
      "123e4567-e89b-42d3-a456-426614174000",
    );
  });
});
