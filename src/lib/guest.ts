const GUEST_TOKEN_KEY = "astrid-guest-token";
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createGuestToken(): string {
  const cryptoApi = window.crypto;
  if (typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  if (typeof cryptoApi.getRandomValues !== "function") {
    throw new Error("Secure random numbers are unavailable in this browser.");
  }

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

export function getGuestToken(): string | null {
  if (typeof window === "undefined") return null;

  const storedToken = window.sessionStorage.getItem(GUEST_TOKEN_KEY);
  if (storedToken && UUID_V4_PATTERN.test(storedToken)) return storedToken;

  const token = createGuestToken();
  window.sessionStorage.setItem(GUEST_TOKEN_KEY, token);
  return token;
}
