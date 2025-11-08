"""Storage service for town data using Redis with in-memory fallback."""
import json
import logging
from typing import Dict, Any

import redis

from app.config import settings

logger = logging.getLogger(__name__)

# Default town data structure
DEFAULT_TOWN_DATA = {
    "buildings": [],
    "terrain": [],
    "roads": [],
    "props": []
}

# Redis client
redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)

# In-memory town data storage (fallback)
_town_data_storage = DEFAULT_TOWN_DATA.copy()


def get_town_data() -> Dict[str, Any]:
    """Get town data from Redis with fallback to in-memory storage.

    Returns:
        Dictionary containing town data (buildings, terrain, roads, props)
    """
    try:
        data = redis_client.get("town_data")
        if data:
            return json.loads(data)
    except Exception as e:
        logger.warning(f"Redis get failed, using in-memory storage: {e}")

    # Fallback to in-memory storage
    return _town_data_storage.copy()


def set_town_data(data: Dict[str, Any]) -> None:
    """Set town data in both Redis and in-memory storage.

    Args:
        data: Dictionary containing town data to store
    """
    global _town_data_storage
    _town_data_storage = data.copy() if isinstance(data, dict) else data

    try:
        redis_client.set("town_data", json.dumps(data))
    except Exception as e:
        logger.warning(f"Redis set failed, data saved to memory only: {e}")


def get_redis_client() -> redis.Redis:
    """Get the Redis client instance.

    Returns:
        Redis client instance
    """
    return redis_client
