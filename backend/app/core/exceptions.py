from fastapi import HTTPException, status


class AuthTokenError(RuntimeError):
    """Raised when a Supabase token cannot be validated."""


class DatabaseNotConfiguredError(RuntimeError):
    """Raised when the app is asked to access the database without a configured DSN."""


def raise_auth_error(message: str = "Authentication failed") -> None:
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=message)


def raise_db_error(message: str = "Database is not configured.") -> None:
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=message)
