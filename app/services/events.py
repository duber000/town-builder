"""Server-Sent Events (SSE) service for real-time updates via Redis pub/sub."""
import asyncio
import json
import logging
import time
from typing import Dict, Optional, AsyncGenerator

from app.config import settings
from app.services.storage import get_redis_client, get_town_data

logger = logging.getLogger(__name__)

# Track users: {name: last_seen_timestamp}
_connected_users: Dict[str, float] = {}


async def broadcast_sse(data: Dict) -> None:
    """Send data to all connected SSE clients via Redis pub/sub.

    Args:
        data: Dictionary to broadcast (will be JSON encoded)
    """
    try:
        redis_client = get_redis_client()
        if redis_client:
            msg = json.dumps(data)
            await redis_client.publish(settings.pubsub_channel, msg)
    except Exception as e:
        # Redis is optional for multiplayer features - log error but don't fail
        logger.warning(f"Failed to broadcast SSE event (Redis unavailable): {e}")


def get_online_users() -> list[str]:
    """Get a list of currently online user names.

    Users are considered online if they were seen in the last 30 seconds.

    Returns:
        List of online usernames
    """
    now = time.time()
    # Remove users not seen in the last 30 seconds
    to_remove = [name for name, ts in _connected_users.items() if now - ts > 30]
    for name in to_remove:
        if name in _connected_users:
            del _connected_users[name]
    return list(_connected_users.keys())


async def event_stream(player_name: Optional[str] = None) -> AsyncGenerator[str, None]:
    """Generate Server-Sent Events stream for a client.

    Args:
        player_name: Optional name of the player/user connecting

    Yields:
        SSE-formatted strings (e.g., "data: {...}\\n\\n")
    """
    redis_client = get_redis_client()

    if not redis_client:
        logger.warning("Redis client not available for SSE")
        # Send initial town data and then keep-alive
        initial_town_data = await get_town_data()
        yield f"data: {json.dumps({'type': 'full', 'town': initial_town_data})}\n\n"
        while True:
            await asyncio.sleep(10)
            yield ": keepalive\n\n"
        return

    # Subscribe to Redis pub/sub channel
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(settings.pubsub_channel)
    logger.info(f"Subscribed to Redis channel: {settings.pubsub_channel}")

    # Register user and broadcast updated user list
    if player_name:
        _connected_users[player_name] = time.time()
        await broadcast_sse({'type': 'users', 'users': get_online_users()})

    try:
        # Send initial town data upon connection
        initial_town_data = await get_town_data()
        yield f"data: {json.dumps({'type': 'full', 'town': initial_town_data})}\n\n"

        # Send initial user list
        yield f"data: {json.dumps({'type': 'users', 'users': get_online_users()})}\n\n"

        # Main event loop
        last_keepalive = time.time()
        while True:
            try:
                # Get message from Redis pubsub with timeout
                message = await asyncio.wait_for(pubsub.get_message(ignore_subscribe_messages=True), timeout=10.0)

                if message and message['type'] == 'message':
                    data = message['data']
                    if isinstance(data, bytes):
                        data = data.decode('utf-8')
                    yield f"data: {data}\n\n"

                # Update last seen timestamp periodically
                if player_name and time.time() - last_keepalive > 10:
                    _connected_users[player_name] = time.time()
                    last_keepalive = time.time()

            except asyncio.TimeoutError:
                # Periodically update last_seen for this user
                if player_name:
                    _connected_users[player_name] = time.time()
                    # Broadcast updated user list
                    await broadcast_sse({'type': 'users', 'users': get_online_users()})
                # Send a keep-alive comment to prevent connection timeout
                yield ": keepalive\n\n"
                last_keepalive = time.time()

    except asyncio.CancelledError:
        logger.info(f"SSE client {player_name or 'Unknown'} disconnected.")
        if player_name and player_name in _connected_users:
            del _connected_users[player_name]
            # Update user list on disconnect
            await broadcast_sse({'type': 'users', 'users': get_online_users()})
        raise
    finally:
        await pubsub.unsubscribe(settings.pubsub_channel)
        await pubsub.aclose()
        logger.info(f"Redis pubsub connection closed for {player_name or 'Unknown'}.")
