export type NativeAuthCallback =
  | { type: "code"; code: string }
  | { type: "session"; accessToken: string; refreshToken: string }
  | { type: "error"; message: string }
  | { type: "missing" };

const NATIVE_AUTH_REDIRECT_URL = "com.mediadock.app://auth-callback";

export function parseNativeAuthCallback(
  rawUrl: string,
): NativeAuthCallback | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (
    url.protocol !== "com.mediadock.app:" ||
    url.hostname !== "auth-callback"
  ) {
    return null;
  }

  const fragment = new URLSearchParams(url.hash.slice(1));
  const getParameter = (key: string) =>
    url.searchParams.get(key) ?? fragment.get(key);
  const error = getParameter("error_description") ?? getParameter("error");
  if (error) return { type: "error", message: error };

  const code = getParameter("code");
  if (code) return { type: "code", code };

  const accessToken = getParameter("access_token");
  const refreshToken = getParameter("refresh_token");
  if (accessToken && refreshToken) {
    return { type: "session", accessToken, refreshToken };
  }
  return { type: "missing" };
}

export { NATIVE_AUTH_REDIRECT_URL };
