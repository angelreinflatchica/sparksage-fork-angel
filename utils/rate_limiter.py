from __future__ import annotations

import time
import asyncio
from collections import defaultdict
import config # Import config to access rate limit settings
import db # Import db to potentially store/retrieve rate limit configurations or state if needed later for persistence

class TokenBucket:
    def __init__(self, capacity: int, refill_rate: float):
        self.capacity = capacity
        self.refill_rate = refill_rate  # tokens per second
        self.tokens = float(capacity) # Ensure tokens is float for accurate refill calculation
        self.last_refill_time = time.monotonic()

    def _refill(self):
        now = time.monotonic()
        time_elapsed = now - self.last_refill_time
        tokens_to_add = time_elapsed * self.refill_rate
        self.tokens = min(self.capacity, self.tokens + tokens_to_add)
        self.last_refill_time = now

    def consume(self, num_tokens: float = 1.0) -> tuple[bool, float | None]:
        """
        Attempts to consume tokens.
        Returns (success, time_until_next_token_available_seconds).
        """
        self._refill()
        if self.tokens >= num_tokens:
            self.tokens -= num_tokens
            return True, None
        else:
            needed = num_tokens - self.tokens
            if self.refill_rate > 0:
                time_needed = needed / self.refill_rate
            else: # Avoid division by zero if refill_rate is 0 (e.g., limit is 0)
                time_needed = float('inf')
            return False, time_needed

class RateLimiter:
    def __init__(self, user_limit_per_minute: int, guild_limit_per_minute: int):
        self.user_limit_per_minute = user_limit_per_minute
        self.guild_limit_per_minute = guild_limit_per_minute

        # Convert limits to tokens per second
        self.user_refill_rate = user_limit_per_minute / 60.0 if user_limit_per_minute > 0 else 0.0
        self.guild_refill_rate = guild_limit_per_minute / 60.0 if guild_limit_per_minute > 0 else 0.0

        # Buckets stored in memory. For production, consider persistence.
        # Using defaultdict for easier bucket creation.
        self.user_buckets: dict[str, TokenBucket] = {}
        self.guild_buckets: dict[str, TokenBucket] = {}

    def _get_or_create_user_bucket(self, user_id: str) -> TokenBucket:
        if user_id not in self.user_buckets:
            # Capacity is the limit itself, refill rate is derived from limit per minute
            self.user_buckets[user_id] = TokenBucket(self.user_limit_per_minute, self.user_refill_rate)
        return self.user_buckets[user_id]

    def _get_or_create_guild_bucket(self, guild_id: str) -> TokenBucket:
        if guild_id not in self.guild_buckets:
            self.guild_buckets[guild_id] = TokenBucket(self.guild_limit_per_minute, self.guild_refill_rate)
        return self.guild_buckets[guild_id]

    async def is_rate_limited(self, identifier: str, is_guild: bool = False) -> tuple[bool, float | None]:
        """
        Checks if an identifier (user_id or guild_id) is rate limited.
        Returns (is_limited, time_until_available_seconds).
        """
        if is_guild:
            if self.guild_limit_per_minute <= 0: # No limit for guilds
                return False, None
            bucket = self._get_or_create_guild_bucket(identifier)
        else:
            if self.user_limit_per_minute <= 0: # No limit for users
                return False, None
            bucket = self._get_or_create_user_bucket(identifier)
        
        success, time_needed = bucket.consume()
        return not success, time_needed

    async def get_remaining_quota(self, identifier: str, is_guild: bool = False) -> float | None:
        """ Returns remaining tokens (approximate). None if no limit. """
        if is_guild:
            if self.guild_limit_per_minute <= 0:
                return None
            bucket = self._get_or_create_guild_bucket(identifier)
        else:
            if self.user_limit_per_minute <= 0:
                return None
            bucket = self._get_or_create_user_bucket(identifier)

        bucket._refill() # Ensure tokens are up-to-date before reporting
        return bucket.tokens

# --- Global instance ---
# This instance will be created and configured when the bot starts or config is reloaded.
# We use a placeholder and initialize it properly later.
limiter: RateLimiter | None = None

async def initialize_limiter_from_config():
    """Initializes or re-initializes the global limiter instance based on current config."""
    global limiter
    
    # Read limits from config, providing defaults if not set
    # It's important that config is loaded before this is called.
    user_limit = getattr(config, "RATE_LIMIT_USER", 5) # Default to 5 requests/min for users
    guild_limit = getattr(config, "RATE_LIMIT_GUILD", 20) # Default to 20 requests/min for guilds

    # Ensure they are integers, default to 0 if invalid or negative
    try:
        user_limit = max(0, int(user_limit))
    except (ValueError, TypeError):
        user_limit = 0
        print(f"WARNING: Invalid RATE_LIMIT_USER config: '{user_limit}'. Defaulting to 0 (unlimited).")

    try:
        guild_limit = max(0, int(guild_limit))
    except (ValueError, TypeError):
        guild_limit = 0
        print(f"WARNING: Invalid RATE_LIMIT_GUILD config: '{guild_limit}'. Defaulting to 0 (unlimited).")

    limiter = RateLimiter(
        user_limit_per_minute=user_limit,
        guild_limit_per_minute=guild_limit
    )
    print(f"Rate limiter initialized. User Limit: {user_limit}/min, Guild Limit: {guild_limit}/min.")

# This function will be called from bot.py's setup or on_ready event.
# For now, we leave the global 'limiter' as None and handle initialization later.
