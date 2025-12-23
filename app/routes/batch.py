"""Routes for batch operations on town data."""
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import (
    BatchOperationRequest,
    BatchOperationResponse,
    BatchOperationResult
)
from app.services.auth import get_current_user
from app.services.batch_operations import batch_operations_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/batch", tags=["Batch Operations"])


@router.post("/operations", response_model=BatchOperationResponse)
async def execute_batch_operations(
    request_data: BatchOperationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Execute multiple operations in a single request.

    This endpoint allows executing multiple create, update, delete, or edit
    operations atomically. If any operation fails, all changes are rolled back.

    Args:
        request_data: Batch operation request with list of operations
        current_user: Authenticated user

    Returns:
        Batch operation response with results for each operation

    Example:
        POST /api/batch/operations
        {
            "operations": [
                {
                    "op": "create",
                    "category": "buildings",
                    "data": {
                        "position": {"x": 10, "y": 0, "z": 5},
                        "rotation": {"x": 0, "y": 0, "z": 0},
                        "scale": {"x": 1, "y": 1, "z": 1}
                    }
                },
                {
                    "op": "delete",
                    "category": "vehicles",
                    "id": "abc-123"
                },
                {
                    "op": "delete",
                    "category": "props",
                    "position": {"x": 5, "y": 0, "z": 3}
                }
            ],
            "validate": true
        }
    """
    try:
        operations = [op.model_dump() for op in request_data.operations]
        results, successful, failed = batch_operations_manager.execute_operations(
            operations,
            request_data.validate
        )

        return BatchOperationResponse(
            status="success" if failed == 0 else "partial",
            results=[BatchOperationResult(**r) for r in results],
            successful=successful,
            failed=failed
        )

    except Exception as e:
        logger.error(f"Batch operations error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
