"""History service for undo/redo functionality."""
import json
import logging
import time
import uuid
from typing import Dict, List, Any, Optional
from collections import deque

from app.config import settings
from app.services.storage import get_redis_client

logger = logging.getLogger(__name__)

# Max history entries to keep
MAX_HISTORY_SIZE = 100

# In-memory history storage (fallback)
_history_stack = deque(maxlen=MAX_HISTORY_SIZE)
_redo_stack = deque(maxlen=MAX_HISTORY_SIZE)


class HistoryManager:
    """Manages operation history for undo/redo functionality."""

    def __init__(self):
        self.history_key = "town_history"
        self.redo_key = "town_redo"
        self.current_index_key = "town_history_index"

    async def add_entry(
        self,
        operation: str,
        category: Optional[str] = None,
        object_id: Optional[str] = None,
        before_state: Optional[Dict[str, Any]] = None,
        after_state: Optional[Dict[str, Any]] = None
    ) -> str:
        """Add a new history entry.

        Args:
            operation: Type of operation (create, update, delete, etc.)
            category: Category of object (buildings, vehicles, etc.)
            object_id: ID of the affected object
            before_state: State before the operation
            after_state: State after the operation

        Returns:
            ID of the history entry
        """
        entry_id = str(uuid.uuid4())
        entry = {
            "id": entry_id,
            "timestamp": time.time(),
            "operation": operation,
            "category": category,
            "object_id": object_id,
            "before_state": before_state,
            "after_state": after_state
        }

        redis_client = get_redis_client()
        if redis_client:
            try:
                # Add to Redis
                await redis_client.rpush(self.history_key, json.dumps(entry))

                # Trim to max size
                history_length = await redis_client.llen(self.history_key)
                if history_length > MAX_HISTORY_SIZE:
                    await redis_client.ltrim(self.history_key, -MAX_HISTORY_SIZE, -1)

                # Clear redo stack when new action is performed
                await redis_client.delete(self.redo_key)

            except Exception as e:
                logger.warning(f"Redis history add failed, using in-memory storage: {e}")
                _history_stack.append(entry)
                _redo_stack.clear()
        else:
            _history_stack.append(entry)
            _redo_stack.clear()

        logger.info(f"Added history entry: {operation} on {category}/{object_id}")
        return entry_id

    async def get_history(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent history entries.

        Args:
            limit: Maximum number of entries to return

        Returns:
            List of history entries (newest first)
        """
        redis_client = get_redis_client()
        if redis_client:
            try:
                # Get from Redis
                entries = await redis_client.lrange(self.history_key, -limit, -1)
                history = [json.loads(entry) for entry in entries]
                history.reverse()  # Newest first
                return history

            except Exception as e:
                logger.warning(f"Redis history get failed, using in-memory storage: {e}")

        return list(reversed(list(_history_stack)[:limit]))

    async def can_undo(self) -> bool:
        """Check if undo is possible.

        Returns:
            True if there are operations to undo
        """
        redis_client = get_redis_client()
        if redis_client:
            try:
                return await redis_client.llen(self.history_key) > 0
            except Exception:
                pass

        return len(_history_stack) > 0

    async def can_redo(self) -> bool:
        """Check if redo is possible.

        Returns:
            True if there are operations to redo
        """
        redis_client = get_redis_client()
        if redis_client:
            try:
                return await redis_client.llen(self.redo_key) > 0
            except Exception:
                pass

        return len(_redo_stack) > 0

    async def get_last_entry(self) -> Optional[Dict[str, Any]]:
        """Get the last history entry without removing it.

        Returns:
            Last history entry or None
        """
        redis_client = get_redis_client()
        if redis_client:
            try:
                entry = await redis_client.lindex(self.history_key, -1)
                if entry:
                    return json.loads(entry)
            except Exception as e:
                logger.warning(f"Redis get last entry failed: {e}")

        if _history_stack:
            return _history_stack[-1]
        return None

    async def pop_last_entry(self) -> Optional[Dict[str, Any]]:
        """Remove and return the last history entry.

        Returns:
            Last history entry or None
        """
        redis_client = get_redis_client()
        if redis_client:
            try:
                entry = await redis_client.rpop(self.history_key)
                if entry:
                    return json.loads(entry)
            except Exception as e:
                logger.warning(f"Redis pop failed, using in-memory storage: {e}")

        if _history_stack:
            return _history_stack.pop()
        return None

    async def push_redo_entry(self, entry: Dict[str, Any]) -> None:
        """Add an entry to the redo stack.

        Args:
            entry: History entry to add to redo stack
        """
        redis_client = get_redis_client()
        if redis_client:
            try:
                await redis_client.rpush(self.redo_key, json.dumps(entry))

                # Trim to max size
                redo_length = await redis_client.llen(self.redo_key)
                if redo_length > MAX_HISTORY_SIZE:
                    await redis_client.ltrim(self.redo_key, -MAX_HISTORY_SIZE, -1)

            except Exception as e:
                logger.warning(f"Redis redo push failed, using in-memory storage: {e}")
                _redo_stack.append(entry)
        else:
            _redo_stack.append(entry)

    async def pop_redo_entry(self) -> Optional[Dict[str, Any]]:
        """Remove and return the last redo entry.

        Returns:
            Last redo entry or None
        """
        redis_client = get_redis_client()
        if redis_client:
            try:
                entry = await redis_client.rpop(self.redo_key)
                if entry:
                    return json.loads(entry)
            except Exception as e:
                logger.warning(f"Redis redo pop failed, using in-memory storage: {e}")

        if _redo_stack:
            return _redo_stack.pop()
        return None

    async def clear_history(self) -> None:
        """Clear all history and redo stacks."""
        redis_client = get_redis_client()
        if redis_client:
            try:
                await redis_client.delete(self.history_key)
                await redis_client.delete(self.redo_key)
            except Exception as e:
                logger.warning(f"Redis clear failed: {e}")

        _history_stack.clear()
        _redo_stack.clear()
        logger.info("History cleared")


# Global history manager instance
history_manager = HistoryManager()
