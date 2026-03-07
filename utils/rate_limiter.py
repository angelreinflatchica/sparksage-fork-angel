from __future__ import annotations

import math
import time
from threading import Lock

import config

class TokenBucket:
    def __init__(self, capacity: int, refill_rate: float):
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.tokens = float(capacity)
        self.last_refill_time = time.monotonic()

    def _refill(self):
        now = time.monotonic()
        time_elapsed = now - self.last_refill_time
        tokens_to_add = time_elapsed * self.refill_rate
        self.tokens = min(self.capacity, self.tokens + tokens_to_add)
        self.last_refill_time = now

    def consume(self, num_tokens: float = 1.0) -> tuple[bool, float | None]:
        self._refill()
        if self.tokens >= num_tokens:
            self.tokens -= num_tokens
            return True, None
        needed = num_tokens - self.tokens
        if self.refill_rate > 0:
            return False, needed / self.refill_rate
        return False, float("inf")

    def update_limit(self, capacity: int):
        self._refill()
        self.capacity = max(0, int(capacity))
        self.refill_rate = self.capacity / 60.0 if self.capacity > 0 else 0.0
        self.tokens = min(self.tokens, float(self.capacity))

    def remaining(self) -> float:
        self._refill()
        return self.tokens

class RateLimiter:
    def __init__(self):
        self.user_buckets: dict[str, TokenBucket] = {}
        self.guild_buckets: dict[str, TokenBucket] = {}
        self.user_allowed: dict[str, int] = {}
        self.user_blocked: dict[str, int] = {}
        self.guild_allowed: dict[str, int] = {}
        self.guild_blocked: dict[str, int] = {}
        self._lock = Lock()

    def _get_or_create_bucket(self, identifier: str, limit_per_minute: int, is_guild: bool) -> TokenBucket | None:
        if limit_per_minute <= 0:
            return None

        bucket_map = self.guild_buckets if is_guild else self.user_buckets
        bucket = bucket_map.get(identifier)
        if bucket is None:
            bucket = TokenBucket(limit_per_minute, limit_per_minute / 60.0)
            bucket_map[identifier] = bucket
        else:
            bucket.update_limit(limit_per_minute)
        return bucket

    async def is_rate_limited(self, identifier: str, limit_per_minute: int, is_guild: bool = False) -> tuple[bool, int | None]:
        """Return (is_limited, retry_after_seconds)."""
        with self._lock:
            bucket = self._get_or_create_bucket(identifier, int(limit_per_minute), is_guild)
            if bucket is None:
                return False, None

            allowed_map = self.guild_allowed if is_guild else self.user_allowed
            blocked_map = self.guild_blocked if is_guild else self.user_blocked

            success, retry_after = bucket.consume()
            if success:
                allowed_map[identifier] = allowed_map.get(identifier, 0) + 1
                return False, None

            blocked_map[identifier] = blocked_map.get(identifier, 0) + 1
            retry_seconds = 1
            if retry_after is not None and retry_after != float("inf"):
                retry_seconds = max(1, math.ceil(retry_after))
            return True, retry_seconds

    def _snapshot_entries(self, *, is_guild: bool, limit_per_minute: int, top_n: int = 10) -> list[dict]:
        if limit_per_minute <= 0:
            return []

        bucket_map = self.guild_buckets if is_guild else self.user_buckets
        allowed_map = self.guild_allowed if is_guild else self.user_allowed
        blocked_map = self.guild_blocked if is_guild else self.user_blocked
        entries: list[dict] = []

        for identifier, bucket in bucket_map.items():
            remaining = bucket.remaining()
            used = max(0, int(round(limit_per_minute - remaining)))
            entries.append(
                {
                    "id": identifier,
                    "remaining": round(remaining, 2),
                    "used": used,
                    "limit": limit_per_minute,
                    "allowed_count": allowed_map.get(identifier, 0),
                    "blocked_count": blocked_map.get(identifier, 0),
                }
            )

        entries.sort(key=lambda e: (e["blocked_count"], e["used"], e["allowed_count"]), reverse=True)
        return entries[:top_n]

    async def get_quota_snapshot(self, user_limit_per_minute: int, guild_limit_per_minute: int, top_n: int = 10) -> dict:
        with self._lock:
            return {
                "limits": {
                    "user_per_minute": user_limit_per_minute,
                    "guild_per_minute": guild_limit_per_minute,
                },
                "active": {
                    "user_buckets": len(self.user_buckets),
                    "guild_buckets": len(self.guild_buckets),
                },
                "users": self._snapshot_entries(is_guild=False, limit_per_minute=user_limit_per_minute, top_n=top_n),
                "guilds": self._snapshot_entries(is_guild=True, limit_per_minute=guild_limit_per_minute, top_n=top_n),
            }

# --- Global instance ---
limiter = RateLimiter()

async def initialize_limiter_from_config():
    """Backward-compatible init hook; keeps global limiter singleton alive."""
    user_limit = max(0, int(getattr(config, "RATE_LIMIT_USER", 5)))
    guild_limit = max(0, int(getattr(config, "RATE_LIMIT_GUILD", 20)))
    print(f"Rate limiter initialized. User Limit: {user_limit}/min, Guild Limit: {guild_limit}/min.")


def get_limiter() -> RateLimiter:
    return limiter
