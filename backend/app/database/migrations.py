def sync_database_url(database_url: str) -> str:
    if not database_url:
        return "sqlite:///:memory:"

    normalized = database_url.strip()
    normalized = normalized.replace("+asyncpg", "+psycopg").replace("+aiosqlite", "")
    if normalized.startswith("postgresql://"):
        return normalized.replace("postgresql://", "postgresql+psycopg://", 1)
    if normalized.startswith("postgres://"):
        return normalized.replace("postgres://", "postgresql+psycopg://", 1)
    return normalized
