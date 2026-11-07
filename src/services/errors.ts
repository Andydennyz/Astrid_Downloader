/** Errors services throw so the UI can show a friendly message. */
export class ServiceError extends Error {
  readonly code:
    | "INVALID_URL"
    | "UNAVAILABLE"
    | "NOT_FOUND"
    | "INVALID_STATE"
    | "NETWORK";

  constructor(code: ServiceError["code"], message: string) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }
}

export function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ServiceError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
