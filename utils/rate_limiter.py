from __future__ import annotations

import time
import asyncio
from collections import deque
from typing import Dict

class RateLimiter:
    def __init__(self):
        # Stores lists of timestamps for each key: {key: deque([ts1, ts2, ...])}
        self.user_windows: Dict[str, deque[float]] = {}
        self.guild_windows: Dict[str, deque[float]] = {}
        self.lock = asyncio.Lock()

    async def is_rate_limited(self, key: str, limit: int, window_seconds: int = 60, is_guild: bool = False) -> tuple[bool, int]:
        """
        Check if a key (user or guild ID) has exceeded the limit within the window.
        Returns (is_limited, retry_after_seconds).
        """
        if limit <= 0:
            return False, 0

        async with self.lock:
            now = time.time()
            windows = self.guild_windows if is_guild else self.user_windows
            
            if key not in windows:
                windows[key] = deque()
            
            window = windows[key]
            
            # Remove timestamps outside the current window
            while window and window[0] <= now - window_seconds:
                window.popleft()
            
            if len(window) >= limit:
                # Calculate how long until the oldest entry expires
                retry_after = int(window[0] + window_seconds - now)
                return True, max(1, retry_after)
            
            # Record this request
            window.append(now)
            return False, 0

# Global instance
limiter = RateLimiter()
