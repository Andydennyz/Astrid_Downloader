const GUEST_TOKEN_KEY = "astrid-guest-token";
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getGuestToken(): string | null {
  if (typeof window === "undefined") return null;

  const storedToken = window.localStorage.getItem(GUEST_TOKEN_KEY);
  if (storedToken && UUID_V4_PATTERN.test(storedToken)) return storedToken;

  const token = window.crypto.randomUUID();
  window.localStorage.setItem(GUEST_TOKEN_KEY, token);
  return token;
}
