"""Server-Sent Events (SSE) service for real-time updates via Redis pub/sub."""
import json
import logging
import queue
import threading
import time
from typing import Dict, Optional, Generator

from app.config import settings
from app.services.storage import get_redis_client, get_town_data

logger = logging.getLogger(__name__)

# Track users: {name: last_seen_timestamp}
_connected_users: Dict[str, float] = {}
_connected_users_lock = threading.Lock()


def broadcast_sse(data: Dict) -> None:
    """Send data to all connected SSE clients via Redis pub/sub.

    Args:
        data: Dictionary to broadcast (will be JSON encoded)
    """
    try:
        redis_client = get_redis_client()
        msg = json.dumps(data)
        redis_client.publish(settings.pubsub_channel, msg)
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
    with _connected_users_lock:
        # Remove users not seen in the last 30 seconds
        to_remove = [name for name, ts in _connected_users.items() if now - ts > 30]
        for name in to_remove:
            if name in _connected_users:
                del _connected_users[name]
        return list(_connected_users.keys())


def event_stream(player_name: Optional[str] = None) -> Generator[str, None, None]:
    """Generate Server-Sent Events stream for a client.

    Args:
        player_name: Optional name of the player/user connecting

    Yields:
        SSE-formatted strings (e.g., "data: {...}\\n\\n")
    """
    redis_client = get_redis_client()
    q = queue.Queue()

    # Subscribe to Redis pub/sub channel
    pubsub = redis_client.pubsub()
    pubsub.subscribe(settings.pubsub_channel)

    def listen_redis():
        """Listen for messages from Redis and add them to the queue."""
        for message in pubsub.listen():
            if message['type'] == 'message':
                try:
                    q.put(f"data: {message['data']}\n\n")
                except Exception as e:
                    logger.error(f"Error putting SSE from Redis: {e}")
            elif message['type'] == 'subscribe':
                logger.info(f"Subscribed to Redis channel: {message['channel']}")

    # Start Redis listener thread
    t = threading.Thread(target=listen_redis, daemon=True)
    t.start()

    # Give the Redis listener a moment to fully initialize
    time.sleep(0.1)

    # Register user and broadcast updated user list
    if player_name:
        with _connected_users_lock:
            _connected_users[player_name] = time.time()
        broadcast_sse({'type': 'users', 'users': get_online_users()})

    try:
        # Send initial town data upon connection
        initial_town_data = get_town_data()
        yield f"data: {json.dumps({'type': 'full', 'town': initial_town_data})}\n\n"

        # Send initial user list
        yield f"data: {json.dumps({'type': 'users', 'users': get_online_users()})}\n\n"

        # Main event loop
        while True:
            try:
                # Check queue for messages from Redis
                data_to_send = q.get(timeout=10)
                yield data_to_send
            except queue.Empty:
                # Periodically update last_seen for this user
                if player_name:
                    with _connected_users_lock:
                        _connected_users[player_name] = time.time()
                    # Broadcast updated user list
                    broadcast_sse({'type': 'users', 'users': get_online_users()})
                # Send a keep-alive comment to prevent connection timeout
                yield ": keepalive\n\n"
    except GeneratorExit:
        logger.info(f"SSE client {player_name or 'Unknown'} disconnected.")
        if player_name:
            with _connected_users_lock:
                if player_name in _connected_users:
                    del _connected_users[player_name]
            # Update user list on disconnect
            broadcast_sse({'type': 'users', 'users': get_online_users()})
    finally:
        pubsub.unsubscribe(settings.pubsub_channel)
        pubsub.close()
        logger.info(f"Redis pubsub connection closed for {player_name or 'Unknown'}.")
