"""Routes for town snapshots and versioning."""
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import SnapshotCreate, SnapshotListResponse, SnapshotInfo
from app.services.auth import get_current_user
from app.services.snapshots import snapshot_manager
from app.services.storage import get_town_data, set_town_data
from app.services.events import broadcast_sse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/snapshots", tags=["Snapshots"])


@router.post("")
async def create_snapshot(
    request_data: SnapshotCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create a new snapshot of the current town state.

    Args:
        request_data: Snapshot creation request
        current_user: Authenticated user

    Returns:
        Snapshot ID and metadata

    Example:
        POST /api/snapshots
        {
            "name": "Before major changes",
            "description": "Backup before redesigning downtown area"
        }
    """
    try:
        town_data = await get_town_data()

        snapshot_id = await snapshot_manager.create_snapshot(
            town_data=town_data,
            name=request_data.name,
            description=request_data.description
        )

        metadata = await snapshot_manager.get_snapshot_metadata(snapshot_id)

        return {
            "status": "success",
            "message": "Snapshot created",
            "snapshot": metadata
        }

    except Exception as e:
        logger.error(f"Create snapshot error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=SnapshotListResponse)
async def list_snapshots(
    current_user: dict = Depends(get_current_user)
):
    """List all available snapshots.

    Args:
        current_user: Authenticated user

    Returns:
        List of snapshot metadata

    Example:
        GET /api/snapshots
    """
    try:
        snapshots = await snapshot_manager.list_snapshots()

        return SnapshotListResponse(
            status="success",
            snapshots=[SnapshotInfo(**snapshot) for snapshot in snapshots]
        )

    except Exception as e:
        logger.error(f"List snapshots error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{snapshot_id}")
async def get_snapshot(
    snapshot_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get snapshot data by ID.

    Args:
        snapshot_id: ID of the snapshot
        current_user: Authenticated user

    Returns:
        Snapshot data

    Example:
        GET /api/snapshots/abc-123-def-456
    """
    try:
        snapshot_data = await snapshot_manager.get_snapshot(snapshot_id)

        if not snapshot_data:
            raise HTTPException(status_code=404, detail="Snapshot not found")

        metadata = await snapshot_manager.get_snapshot_metadata(snapshot_id)

        return {
            "status": "success",
            "snapshot": metadata,
            "data": snapshot_data
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get snapshot error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{snapshot_id}/restore")
async def restore_snapshot(
    snapshot_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Restore town to a snapshot state.

    Args:
        snapshot_id: ID of the snapshot to restore
        current_user: Authenticated user

    Returns:
        Success status and restored data

    Example:
        POST /api/snapshots/abc-123-def-456/restore
    """
    try:
        snapshot_data = await snapshot_manager.get_snapshot(snapshot_id)

        if not snapshot_data:
            raise HTTPException(status_code=404, detail="Snapshot not found")

        # Set the town data to the snapshot state
        await set_town_data(snapshot_data)

        # Broadcast the change
        await broadcast_sse({'type': 'full', 'town': snapshot_data})

        metadata = await snapshot_manager.get_snapshot_metadata(snapshot_id)

        logger.info(f"Restored snapshot: {snapshot_id}")

        return {
            "status": "success",
            "message": f"Restored to snapshot: {metadata.get('name')}",
            "snapshot": metadata
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Restore snapshot error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{snapshot_id}")
async def delete_snapshot(
    snapshot_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a snapshot.

    Args:
        snapshot_id: ID of the snapshot to delete
        current_user: Authenticated user

    Returns:
        Success status

    Example:
        DELETE /api/snapshots/abc-123-def-456
    """
    try:
        success = await snapshot_manager.delete_snapshot(snapshot_id)

        if not success:
            raise HTTPException(status_code=404, detail="Snapshot not found")

        return {
            "status": "success",
            "message": "Snapshot deleted"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete snapshot error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
