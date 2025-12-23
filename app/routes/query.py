"""Routes for spatial queries and advanced filtering."""
import logging
from typing import Union

from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import (
    SpatialQueryRadius,
    SpatialQueryBounds,
    SpatialQueryNearest,
    QueryRequest
)
from app.services.auth import get_current_user
from app.services.query import query_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/query", tags=["Query & Spatial Search"])


@router.post("/spatial/radius")
async def spatial_query_radius(
    query: SpatialQueryRadius,
    current_user: dict = Depends(get_current_user)
):
    """Find objects within a radius from a center point.

    Args:
        query: Radius query parameters
        current_user: Authenticated user

    Returns:
        List of objects within the radius, sorted by distance

    Example:
        POST /api/query/spatial/radius
        {
            "type": "radius",
            "center": {"x": 0, "y": 0, "z": 0},
            "radius": 50,
            "category": "buildings",
            "limit": 10
        }
    """
    try:
        results = query_manager.spatial_query_radius(
            center=query.center.model_dump(),
            radius=query.radius,
            category=query.category,
            limit=query.limit
        )

        return {
            "status": "success",
            "count": len(results),
            "results": results
        }

    except Exception as e:
        logger.error(f"Spatial radius query error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/spatial/bounds")
async def spatial_query_bounds(
    query: SpatialQueryBounds,
    current_user: dict = Depends(get_current_user)
):
    """Find objects within a bounding box.

    Args:
        query: Bounds query parameters
        current_user: Authenticated user

    Returns:
        List of objects within the bounding box

    Example:
        POST /api/query/spatial/bounds
        {
            "type": "bounds",
            "min": {"x": -10, "y": 0, "z": -10},
            "max": {"x": 10, "y": 10, "z": 10},
            "category": "vehicles",
            "limit": 20
        }
    """
    try:
        results = query_manager.spatial_query_bounds(
            min_point=query.min.model_dump(),
            max_point=query.max.model_dump(),
            category=query.category,
            limit=query.limit
        )

        return {
            "status": "success",
            "count": len(results),
            "results": results
        }

    except Exception as e:
        logger.error(f"Spatial bounds query error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/spatial/nearest")
async def spatial_query_nearest(
    query: SpatialQueryNearest,
    current_user: dict = Depends(get_current_user)
):
    """Find nearest objects to a point.

    Args:
        query: Nearest query parameters
        current_user: Authenticated user

    Returns:
        List of nearest objects, sorted by distance

    Example:
        POST /api/query/spatial/nearest
        {
            "type": "nearest",
            "point": {"x": 5, "y": 0, "z": 10},
            "category": "buildings",
            "count": 3,
            "max_distance": 100
        }
    """
    try:
        results = query_manager.spatial_query_nearest(
            point=query.point.model_dump(),
            category=query.category,
            count=query.count,
            max_distance=query.max_distance
        )

        return {
            "status": "success",
            "count": len(results),
            "results": results
        }

    except Exception as e:
        logger.error(f"Spatial nearest query error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/advanced")
async def advanced_query(
    query: QueryRequest,
    current_user: dict = Depends(get_current_user)
):
    """Execute advanced query with filters and sorting.

    Args:
        query: Advanced query parameters
        current_user: Authenticated user

    Returns:
        List of matching objects

    Example:
        POST /api/query/advanced
        {
            "category": "vehicles",
            "filters": [
                {"field": "driver", "operator": "eq", "value": "police"},
                {"field": "position.x", "operator": "gt", "value": 0}
            ],
            "sort_by": "position.x",
            "sort_order": "asc",
            "limit": 10,
            "offset": 0
        }
    """
    try:
        filters = None
        if query.filters:
            filters = [f.model_dump() for f in query.filters]

        results = query_manager.advanced_query(
            category=query.category,
            filters=filters,
            sort_by=query.sort_by,
            sort_order=query.sort_order,
            limit=query.limit,
            offset=query.offset
        )

        return {
            "status": "success",
            "count": len(results),
            "results": results
        }

    except Exception as e:
        logger.error(f"Advanced query error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
