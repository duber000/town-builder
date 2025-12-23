"""Snapshot service for town versioning and save points."""
import json
import logging
import time
import uuid
from typing import Dict, List, Any, Optional

from app.config import settings
from app.services.storage import get_redis_client

logger = logging.getLogger(__name__)

# Max snapshots to keep per town
MAX_SNAPSHOTS = 50


class SnapshotManager:
    """Manages town snapshots for versioning and save points."""

    def __init__(self):
        self.redis_client = get_redis_client()
        self.snapshots_key = "town_snapshots"
        self.snapshot_data_prefix = "town_snapshot:"

    def create_snapshot(
        self,
        town_data: Dict[str, Any],
        name: Optional[str] = None,
        description: Optional[str] = None
    ) -> str:
        """Create a new snapshot.

        Args:
            town_data: Current town data to snapshot
            name: Optional name for the snapshot
            description: Optional description

        Returns:
            ID of the created snapshot
        """
        snapshot_id = str(uuid.uuid4())
        timestamp = time.time()

        # Count total objects
        size = sum(
            len(town_data.get(category, []))
            for category in ["buildings", "terrain", "roads", "props", "vehicles", "trees", "park"]
        )

        # Snapshot metadata
        metadata = {
            "id": snapshot_id,
            "name": name or f"Snapshot {time.strftime('%Y-%m-%d %H:%M:%S')}",
            "description": description,
            "timestamp": timestamp,
            "size": size
        }

        try:
            # Store snapshot data
            data_key = f"{self.snapshot_data_prefix}{snapshot_id}"
            self.redis_client.set(data_key, json.dumps(town_data))

            # Add metadata to snapshots list
            self.redis_client.rpush(self.snapshots_key, json.dumps(metadata))

            # Trim to max snapshots
            snapshots_length = self.redis_client.llen(self.snapshots_key)
            if snapshots_length > MAX_SNAPSHOTS:
                # Get oldest snapshot to delete its data
                oldest = self.redis_client.lindex(self.snapshots_key, 0)
                if oldest:
                    oldest_data = json.loads(oldest)
                    old_data_key = f"{self.snapshot_data_prefix}{oldest_data['id']}"
                    self.redis_client.delete(old_data_key)

                # Trim the list
                self.redis_client.ltrim(self.snapshots_key, -MAX_SNAPSHOTS, -1)

            logger.info(f"Created snapshot: {snapshot_id} ({name})")
            return snapshot_id

        except Exception as e:
            logger.error(f"Failed to create snapshot: {e}")
            raise

    def list_snapshots(self) -> List[Dict[str, Any]]:
        """List all available snapshots.

        Returns:
            List of snapshot metadata (newest first)
        """
        try:
            entries = self.redis_client.lrange(self.snapshots_key, 0, -1)
            snapshots = [json.loads(entry) for entry in entries]
            snapshots.reverse()  # Newest first
            return snapshots

        except Exception as e:
            logger.error(f"Failed to list snapshots: {e}")
            return []

    def get_snapshot(self, snapshot_id: str) -> Optional[Dict[str, Any]]:
        """Get snapshot data by ID.

        Args:
            snapshot_id: ID of the snapshot to retrieve

        Returns:
            Snapshot data or None if not found
        """
        try:
            data_key = f"{self.snapshot_data_prefix}{snapshot_id}"
            data = self.redis_client.get(data_key)

            if data:
                return json.loads(data)

            return None

        except Exception as e:
            logger.error(f"Failed to get snapshot {snapshot_id}: {e}")
            return None

    def delete_snapshot(self, snapshot_id: str) -> bool:
        """Delete a snapshot.

        Args:
            snapshot_id: ID of the snapshot to delete

        Returns:
            True if deleted, False if not found
        """
        try:
            # Delete snapshot data
            data_key = f"{self.snapshot_data_prefix}{snapshot_id}"
            self.redis_client.delete(data_key)

            # Remove from metadata list
            entries = self.redis_client.lrange(self.snapshots_key, 0, -1)
            new_entries = []

            for entry in entries:
                metadata = json.loads(entry)
                if metadata["id"] != snapshot_id:
                    new_entries.append(entry)

            # Replace the list
            self.redis_client.delete(self.snapshots_key)
            if new_entries:
                self.redis_client.rpush(self.snapshots_key, *new_entries)

            logger.info(f"Deleted snapshot: {snapshot_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete snapshot {snapshot_id}: {e}")
            return False

    def get_snapshot_metadata(self, snapshot_id: str) -> Optional[Dict[str, Any]]:
        """Get snapshot metadata by ID.

        Args:
            snapshot_id: ID of the snapshot

        Returns:
            Snapshot metadata or None if not found
        """
        try:
            entries = self.redis_client.lrange(self.snapshots_key, 0, -1)

            for entry in entries:
                metadata = json.loads(entry)
                if metadata["id"] == snapshot_id:
                    return metadata

            return None

        except Exception as e:
            logger.error(f"Failed to get snapshot metadata {snapshot_id}: {e}")
            return None


# Global snapshot manager instance
snapshot_manager = SnapshotManager()
