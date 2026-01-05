"""Routes for operation history and undo/redo functionality."""
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import HistoryResponse, HistoryEntry
from app.services.auth import get_current_user
from app.services.history import history_manager
from app.services.storage import get_town_data, set_town_data
from app.services.events import broadcast_sse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/history", tags=["History & Undo/Redo"])


@router.get("", response_model=HistoryResponse)
async def get_history(
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get operation history.

    Args:
        limit: Maximum number of history entries to return
        current_user: Authenticated user

    Returns:
        List of history entries with undo/redo status

    Example:
        GET /api/history?limit=20
    """
    try:
        history = await history_manager.get_history(limit)

        return HistoryResponse(
            status="success",
            history=[HistoryEntry(**entry) for entry in history],
            can_undo=await history_manager.can_undo(),
            can_redo=await history_manager.can_redo()
        )

    except Exception as e:
        logger.error(f"Get history error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/undo")
async def undo_operation(
    current_user: dict = Depends(get_current_user)
):
    """Undo the last operation.

    Args:
        current_user: Authenticated user

    Returns:
        Success status and message

    Example:
        POST /api/history/undo
    """
    try:
        if not await history_manager.can_undo():
            raise HTTPException(status_code=400, detail="Nothing to undo")

        # Get the last operation
        last_entry = await history_manager.pop_last_entry()

        if not last_entry:
            raise HTTPException(status_code=400, detail="Failed to get last operation")

        # Restore the previous state
        before_state = last_entry.get("before_state")

        if before_state is None:
            raise HTTPException(status_code=400, detail="Cannot undo: no previous state")

        # Set the town data to the before state
        await set_town_data(before_state)

        # Add to redo stack
        await history_manager.push_redo_entry(last_entry)

        # Broadcast the change
        await broadcast_sse({'type': 'full', 'town': before_state})

        logger.info(f"Undid operation: {last_entry.get('operation')}")

        return {
            "status": "success",
            "message": f"Undid {last_entry.get('operation')} operation",
            "can_undo": await history_manager.can_undo(),
            "can_redo": await history_manager.can_redo()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Undo error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/redo")
async def redo_operation(
    current_user: dict = Depends(get_current_user)
):
    """Redo the last undone operation.

    Args:
        current_user: Authenticated user

    Returns:
        Success status and message

    Example:
        POST /api/history/redo
    """
    try:
        if not await history_manager.can_redo():
            raise HTTPException(status_code=400, detail="Nothing to redo")

        # Get the last undone operation
        redo_entry = await history_manager.pop_redo_entry()

        if not redo_entry:
            raise HTTPException(status_code=400, detail="Failed to get redo operation")

        # Restore the after state
        after_state = redo_entry.get("after_state")

        if after_state is None:
            raise HTTPException(status_code=400, detail="Cannot redo: no after state")

        # Set the town data to the after state
        await set_town_data(after_state)

        # Add back to history stack
        await history_manager.add_entry(
            operation=redo_entry.get("operation"),
            category=redo_entry.get("category"),
            object_id=redo_entry.get("object_id"),
            before_state=redo_entry.get("before_state"),
            after_state=after_state
        )

        # Broadcast the change
        await broadcast_sse({'type': 'full', 'town': after_state})

        logger.info(f"Redid operation: {redo_entry.get('operation')}")

        return {
            "status": "success",
            "message": f"Redid {redo_entry.get('operation')} operation",
            "can_undo": await history_manager.can_undo(),
            "can_redo": await history_manager.can_redo()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Redo error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("")
async def clear_history(
    current_user: dict = Depends(get_current_user)
):
    """Clear all history and redo stacks.

    Args:
        current_user: Authenticated user

    Returns:
        Success status

    Example:
        DELETE /api/history
    """
    try:
        history_manager.clear_history()

        return {
            "status": "success",
            "message": "History cleared"
        }

    except Exception as e:
        logger.error(f"Clear history error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
