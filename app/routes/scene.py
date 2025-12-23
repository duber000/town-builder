"""Routes for scene description and analysis."""
import logging

from fastapi import APIRouter, Depends

from app.services.auth import get_current_user
from app.services.storage import get_town_data
from app.services.scene_description import generate_scene_description

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scene", tags=["Scene"])


@router.get("/description")
async def get_scene_description(
    current_user: dict = Depends(get_current_user)
):
    """Get a comprehensive description of the current scene.

    Returns a natural language description along with detailed analysis
    of all objects, categories, and scene bounds.

    Args:
        current_user: Authenticated user

    Returns:
        Dictionary with description and analysis data
    """
    town_data = get_town_data()
    result = generate_scene_description(town_data)

    logger.info(f"Scene description requested by {current_user.get('username', 'unknown')}")

    return {
        "status": "success",
        "data": result
    }


@router.get("/stats")
async def get_scene_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get quick statistics about the scene.

    Args:
        current_user: Authenticated user

    Returns:
        Dictionary with scene statistics
    """
    town_data = get_town_data()

    # Count objects in each category
    stats = {
        "town_name": town_data.get('townName', 'Unnamed Town'),
        "buildings": len(town_data.get('buildings', [])),
        "vehicles": len(town_data.get('vehicles', [])),
        "trees": len(town_data.get('trees', [])),
        "props": len(town_data.get('props', [])),
        "street": len(town_data.get('street', [])),
        "park": len(town_data.get('park', [])),
        "terrain": len(town_data.get('terrain', [])),
        "roads": len(town_data.get('roads', []))
    }

    # Calculate total
    stats['total'] = sum([
        stats['buildings'],
        stats['vehicles'],
        stats['trees'],
        stats['props'],
        stats['street'],
        stats['park'],
        stats['terrain'],
        stats['roads']
    ])

    logger.info(f"Scene stats requested: {stats['total']} total objects")

    return {
        "status": "success",
        "data": stats
    }
