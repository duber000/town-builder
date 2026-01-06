"""Storage service for town data using Redis with in-memory fallback."""
import json
import logging
from typing import Dict, Any, Optional

from redis.asyncio import Redis as AsyncRedis

from app.config import settings

logger = logging.getLogger(__name__)

# Default town data structure
DEFAULT_TOWN_DATA = {
    "buildings": [],
    "terrain": [],
    "roads": [],
    "props": []
}

# Async Redis client
redis_client: Optional[AsyncRedis] = None

# In-memory town data storage (fallback)
_town_data_storage = DEFAULT_TOWN_DATA.copy()


async def initialize_redis() -> None:
    """Initialize the async Redis client."""
    global redis_client
    try:
        redis_client = await AsyncRedis.from_url(settings.redis_url, decode_responses=True)
        logger.info("Redis client initialized successfully")
    except Exception as e:
        logger.warning(f"Redis initialization failed, using in-memory storage: {e}")


async def close_redis() -> None:
    """Close the async Redis client."""
    global redis_client
    if redis_client:
        await redis_client.aclose()
        logger.info("Redis client closed")


async def get_town_data() -> Dict[str, Any]:
    """Get town data from Redis with fallback to in-memory storage.

    Returns:
        Dictionary containing town data (buildings, terrain, roads, props)
    """
    if redis_client:
        try:
            data = await redis_client.get("town_data")
            if data:
                return json.loads(data)
        except Exception as e:
            logger.warning(f"Redis get failed, using in-memory storage: {e}")

    # Fallback to in-memory storage
    return _town_data_storage.copy()


async def set_town_data(data: Dict[str, Any]) -> None:
    """Set town data in both Redis and in-memory storage.

    Args:
        data: Dictionary containing town data to store
    """
    global _town_data_storage
    _town_data_storage = data.copy() if isinstance(data, dict) else data

    if redis_client:
        try:
            await redis_client.set("town_data", json.dumps(data))
        except Exception as e:
            logger.warning(f"Redis set failed, data saved to memory only: {e}")


def get_redis_client() -> Optional[AsyncRedis]:
    """Get the Redis client instance.

    Returns:
        Async Redis client instance
    """
    return redis_client
