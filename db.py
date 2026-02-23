from __future__ import annotations

import os
import json
import aiosqlite

DATABASE_PATH = os.getenv("DATABASE_PATH", "sparksage.db")

_db: aiosqlite.Connection | None = None


async def get_db() -> aiosqlite.Connection:
    """Return the shared database connection, creating it if needed."""
    global _db
    if _db is None:
        _db = await aiosqlite.connect(DATABASE_PATH)
        _db.row_factory = aiosqlite.Row
        await _db.execute("PRAGMA journal_mode=WAL")
        await _db.execute("PRAGMA foreign_keys=ON")
    return _db


async def init_db():
    """Create tables if they don't exist."""
    db = await get_db()
    await db.executescript(
        """
        CREATE TABLE IF NOT EXISTS config (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS conversations (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id TEXT    NOT NULL,
            role       TEXT    NOT NULL,
            content    TEXT    NOT NULL,
            provider   TEXT,
            created_at TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_conv_channel ON conversations(channel_id);

        CREATE TABLE IF NOT EXISTS sessions (
            token      TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            expires_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS wizard_state (
            id           INTEGER PRIMARY KEY CHECK (id = 1),
            completed    INTEGER NOT NULL DEFAULT 0,
            current_step INTEGER NOT NULL DEFAULT 0,
            data         TEXT    NOT NULL DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS faqs (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id       TEXT NOT NULL,
            question       TEXT NOT NULL,
            answer         TEXT NOT NULL,
            match_keywords TEXT NOT NULL,
            times_used     INTEGER DEFAULT 0,
            created_by     TEXT,
            created_at     TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS command_permissions (
            command_name TEXT NOT NULL,
            guild_id     TEXT NOT NULL,
            role_id      TEXT NOT NULL,
            PRIMARY KEY (command_name, guild_id, role_id)
        );

        CREATE TABLE IF NOT EXISTS channel_prompts (
            channel_id TEXT PRIMARY KEY,
            guild_id   TEXT NOT NULL,
            system_prompt TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS channel_providers (
            channel_id TEXT PRIMARY KEY,
            guild_id   TEXT NOT NULL,
            provider   TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS moderation_stats (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id    TEXT NOT NULL,
            channel_id  TEXT NOT NULL,
            user_id     TEXT NOT NULL,
            message_id  TEXT NOT NULL,
            content     TEXT NOT NULL,
            reason      TEXT NOT NULL,
            severity    TEXT NOT NULL,
            status      TEXT DEFAULT 'pending', -- pending, dismissed, deleted, warned
            created_at  TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS analytics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,     -- 'command', 'mention', 'faq', 'moderation'
            guild_id TEXT,
            channel_id TEXT,
            user_id TEXT,
            provider TEXT,
            tokens_used INTEGER,
            latency_ms INTEGER,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS plugins (
            id          TEXT PRIMARY KEY, -- The folder name/slug
            name        TEXT NOT NULL,
            version     TEXT,
            author      TEXT,
            description TEXT,
            enabled     INTEGER DEFAULT 0,
            created_at  TEXT DEFAULT (datetime('now'))
        );

        INSERT OR IGNORE INTO wizard_state (id) VALUES (1);
        """
    )
    await db.commit()


# --- Config helpers ---


async def get_config(key: str, default: str | None = None) -> str | None:
    """Get a config value from the database."""
    db = await get_db()
    cursor = await db.execute("SELECT value FROM config WHERE key = ?", (key,))
    row = await cursor.fetchone()
    return row["value"] if row else default


async def get_all_config() -> dict[str, str]:
    """Return all config key-value pairs."""
    db = await get_db()
    cursor = await db.execute("SELECT key, value FROM config")
    rows = await cursor.fetchall()
    return {row["key"]: row["value"] for row in rows}


async def set_config(key: str, value: str):
    """Set a config value in the database."""
    db = await get_db()
    await db.execute(
        "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )
    await db.commit()


async def set_config_bulk(data: dict[str, str]):
    """Set multiple config values at once."""
    db = await get_db()
    await db.executemany(
        "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        list(data.items()),
    )
    await db.commit()


async def sync_env_to_db():
    """Seed the DB config table from current environment / .env values."""
    import config as cfg

    env_keys = {
        "DISCORD_TOKEN": cfg.DISCORD_TOKEN or "",
        "AI_PROVIDER": cfg.AI_PROVIDER,
        "GEMINI_API_KEY": cfg.GEMINI_API_KEY or "",
        "GEMINI_MODEL": cfg.GEMINI_MODEL,
        "GROQ_API_KEY": cfg.GROQ_API_KEY or "",
        "GROQ_MODEL": cfg.GROQ_MODEL,
        "OPENROUTER_API_KEY": cfg.OPENROUTER_API_KEY or "",
        "OPENROUTER_MODEL": cfg.OPENROUTER_MODEL,
        "ANTHROPIC_API_KEY": cfg.ANTHROPIC_API_KEY or "",
        "ANTHROPIC_MODEL": cfg.ANTHROPIC_MODEL,
        "OPENAI_API_KEY": cfg.OPENAI_API_KEY or "",
        "OPENAI_MODEL": cfg.OPENAI_MODEL,
        "BOT_PREFIX": cfg.BOT_PREFIX,
        "MAX_TOKENS": str(cfg.MAX_TOKENS),
        "SYSTEM_PROMPT": cfg.SYSTEM_PROMPT,
        "ADMIN_PASSWORD": cfg.ADMIN_PASSWORD or "",
        "WELCOME_ENABLED": getattr(cfg, "WELCOME_ENABLED", "0"),
        "WELCOME_CHANNEL_ID": getattr(cfg, "WELCOME_CHANNEL_ID", ""),
        "WELCOME_MESSAGE": getattr(cfg, "WELCOME_MESSAGE", "Welcome {user} to {server}! We're glad to have you here. Check out the rules and feel free to ask me any questions."),
        "DIGEST_ENABLED": getattr(cfg, "DIGEST_ENABLED", "0"),
        "DIGEST_CHANNEL_ID": getattr(cfg, "DIGEST_CHANNEL_ID", ""),
        "DIGEST_TIME": getattr(cfg, "DIGEST_TIME", "09:00"),
        "MODERATION_ENABLED": getattr(cfg, "MODERATION_ENABLED", "0"),
        "MOD_LOG_CHANNEL_ID": getattr(cfg, "MOD_LOG_CHANNEL_ID", ""),
        "MODERATION_SENSITIVITY": getattr(cfg, "MODERATION_SENSITIVITY", "medium"),
        "TRANSLATE_AUTO_ENABLED": getattr(cfg, "TRANSLATE_AUTO_ENABLED", "0"),
        "TRANSLATE_AUTO_CHANNEL_ID": getattr(cfg, "TRANSLATE_AUTO_CHANNEL_ID", ""),
        "TRANSLATE_AUTO_TARGET": getattr(cfg, "TRANSLATE_AUTO_TARGET", "English"),
        "RATE_LIMIT_USER": str(getattr(cfg, "RATE_LIMIT_USER", "5")),
        "RATE_LIMIT_GUILD": str(getattr(cfg, "RATE_LIMIT_GUILD", "20")),
    }
    # Only insert keys that don't already exist in DB (don't overwrite user edits)
    db = await get_db()
    for key, value in env_keys.items():
        await db.execute(
            "INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)",
            (key, value),
        )
    await db.commit()


async def sync_db_to_env():
    """Write DB config back to the .env file."""
    from dotenv import dotenv_values, set_key

    env_path = os.path.join(os.path.dirname(__file__), ".env")
    all_config = await get_all_config()

    for key, value in all_config.items():
        set_key(env_path, key, value)


# --- Moderation helpers ---


async def add_mod_stat(guild_id: str, channel_id: str, user_id: str, message_id: str, content: str, reason: str, severity: str):
    """Log a flagged message to moderation stats."""
    db = await get_db()
    await db.execute(
        "INSERT INTO moderation_stats (guild_id, channel_id, user_id, message_id, content, reason, severity) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (guild_id, channel_id, user_id, message_id, content, reason, severity),
    )
    await db.commit()


async def update_mod_stat(message_id: str, status: str):
    """Update the status of a flagged message."""
    db = await get_db()
    await db.execute(
        "UPDATE moderation_stats SET status = ? WHERE message_id = ?",
        (status, message_id),
    )
    await db.commit()


# --- Analytics helpers ---


async def record_event(
    event_type: str,
    guild_id: str | None = None,
    channel_id: str | None = None,
    user_id: str | None = None,
    provider: str | None = None,
    tokens_used: int = 0,
    latency_ms: int | None = None,
):
    """Record an event in the analytics table."""
    db = await get_db()
    await db.execute(
        "INSERT INTO analytics (event_type, guild_id, channel_id, user_id, provider, tokens_used, latency_ms) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (event_type, guild_id, channel_id, user_id, provider, tokens_used, latency_ms),
    )
    await db.commit()


# --- Conversation helpers ---


async def add_message(channel_id: str, role: str, content: str, provider: str | None = None):
    """Add a message to conversation history."""
    db = await get_db()
    await db.execute(
        "INSERT INTO conversations (channel_id, role, content, provider) VALUES (?, ?, ?, ?)",
        (channel_id, role, content, provider),
    )
    await db.commit()


async def get_messages(channel_id: str, limit: int = 20) -> list[dict]:
    """Get recent messages for a channel."""
    db = await get_db()
    cursor = await db.execute(
        "SELECT role, content, provider, created_at FROM conversations WHERE channel_id = ? ORDER BY id DESC LIMIT ?",
        (channel_id, limit),
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in reversed(rows)]


async def clear_messages(channel_id: str):
    """Delete all messages for a channel."""
    db = await get_db()
    await db.execute("DELETE FROM conversations WHERE channel_id = ?", (channel_id,))
    await db.commit()


async def list_channels() -> list[dict]:
    """List all channels with message counts."""
    db = await get_db()
    cursor = await db.execute(
        """
        SELECT channel_id, COUNT(*) as message_count, MAX(created_at) as last_active
        FROM conversations
        GROUP BY channel_id
        ORDER BY last_active DESC
        """
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


# --- Wizard helpers ---


async def get_wizard_state() -> dict:
    """Get the wizard state."""
    db = await get_db()
    cursor = await db.execute("SELECT completed, current_step, data FROM wizard_state WHERE id = 1")
    row = await cursor.fetchone()
    return {
        "completed": bool(row["completed"]),
        "current_step": row["current_step"],
        "data": json.loads(row["data"]),
    }


async def set_wizard_state(completed: bool | None = None, current_step: int | None = None, data: dict | None = None):
    """Update wizard state fields."""
    db = await get_db()
    updates = []
    params = []
    if completed is not None:
        updates.append("completed = ?")
        params.append(int(completed))
    if current_step is not None:
        updates.append("current_step = ?")
        params.append(current_step)
    if data is not None:
        updates.append("data = ?")
        params.append(json.dumps(data))
    if updates:
        await db.execute(f"UPDATE wizard_state SET {', '.join(updates)} WHERE id = 1", params)
        await db.commit()


# --- Plugin helpers ---


async def get_plugins() -> list[dict]:
    """Get all plugins from the database."""
    db = await get_db()
    cursor = await db.execute("SELECT * FROM plugins")
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


async def set_plugin_state(plugin_id: str, enabled: bool):
    """Enable or disable a plugin."""
    db = await get_db()
    await db.execute(
        "UPDATE plugins SET enabled = ? WHERE id = ?",
        (int(enabled), plugin_id)
    )
    await db.commit()


async def sync_plugin(plugin_data: dict):
    """Add or update plugin metadata."""
    db = await get_db()
    await db.execute(
        """
        INSERT INTO plugins (id, name, version, author, description) 
        VALUES (?, ?, ?, ?, ?) 
        ON CONFLICT(id) DO UPDATE SET 
            name = excluded.name, 
            version = excluded.version, 
            author = excluded.author, 
            description = excluded.description
        """,
        (
            plugin_data["id"],
            plugin_data["name"],
            plugin_data.get("version"),
            plugin_data.get("author"),
            plugin_data.get("description")
        )
    )
    await db.commit()


# --- Session helpers ---


async def create_session(token: str, user_id: str, expires_at: str):
    """Store a session token."""
    db = await get_db()
    await db.execute(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
        (token, user_id, expires_at),
    )
    await db.commit()


async def validate_session(token: str) -> dict | None:
    """Validate a session token, return session data or None."""
    db = await get_db()
    cursor = await db.execute(
        "SELECT user_id, expires_at FROM sessions WHERE token = ? AND expires_at > datetime('now')",
        (token,),
    )
    row = await cursor.fetchone()
    return dict(row) if row else None


async def delete_session(token: str):
    """Delete a session."""
    db = await get_db()
    await db.execute("DELETE FROM sessions WHERE token = ?", (token,))
    await db.commit()


async def close_db():
    """Close the database connection."""
    global _db
    if _db:
        await _db.close()
        _db = None
