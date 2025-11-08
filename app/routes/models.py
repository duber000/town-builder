"""Routes for 3D model discovery and metadata."""
import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from pygltflib import GLTF2

from app.config import settings
from app.services.auth import get_current_user
from app.services.model_loader import get_available_models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Models"])


@router.get("/models")
async def list_models(current_user: dict = Depends(get_current_user)):
    """API endpoint to get available models.

    Returns:
        Dictionary mapping categories to lists of model filenames
    """
    return get_available_models()


@router.get("/model/{category}/{model_name}")
async def get_model_info(
    category: str,
    model_name: str,
    info: str = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Serve the model file or its metadata.

    If ?info=1 is present, return metadata as JSON.
    Otherwise, serve the actual model file (GLTF/GLB).

    Args:
        category: Model category (e.g., "buildings", "vehicles")
        model_name: Model filename
        info: If "1", return metadata instead of file
        current_user: Authenticated user

    Returns:
        FileResponse with model file or JSON with metadata
    """
    model_path = os.path.join(settings.models_path, category, model_name)
    if not os.path.exists(model_path):
        raise HTTPException(status_code=404, detail="Model not found")

    # If ?info=1, return metadata
    if info == "1":
        try:
            gltf = GLTF2().load(model_path)
            bin_path = model_path.replace('.gltf', '.bin')
            has_bin = os.path.exists(bin_path)
            return {
                "name": model_name,
                "category": category,
                "nodes": len(gltf.nodes),
                "has_bin": has_bin
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # Otherwise, serve the file
    return FileResponse(model_path)
