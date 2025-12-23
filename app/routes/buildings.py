"""Routes for programmatic building management."""
import logging
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import (
    BuildingCreateRequest,
    BuildingUpdateRequest,
    BuildingResponse,
    Position,
    Rotation,
    Scale
)
from app.services.auth import get_current_user
from app.services.storage import get_town_data, set_town_data
from app.services.events import broadcast_sse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/buildings", tags=["Buildings"])


@router.post("", response_model=BuildingResponse, status_code=201)
async def create_building(
    request_data: BuildingCreateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new building programmatically.

    Args:
        request_data: Building creation request data
        current_user: Authenticated user

    Returns:
        BuildingResponse with created building data including ID
    """
    town_data = get_town_data()

    # Generate unique ID
    building_id = f"obj_{uuid.uuid4().hex[:8]}"

    # Set defaults for optional fields
    rotation = request_data.rotation or Rotation()
    scale = request_data.scale or Scale()

    # Create building object
    building = {
        "id": building_id,
        "model": request_data.model,
        "position": request_data.position.model_dump(),
        "rotation": rotation.model_dump(),
        "scale": scale.model_dump()
    }

    # Add to appropriate category
    category = request_data.category
    if category not in town_data:
        town_data[category] = []

    town_data[category].append(building)

    # Save to storage
    set_town_data(town_data)

    # Broadcast to all connected clients
    broadcast_sse({'type': 'full', 'town': town_data})

    logger.info(f"Created building: {building_id} ({request_data.model}) in category {category}")

    return BuildingResponse(
        id=building_id,
        model=request_data.model,
        category=category,
        position=request_data.position,
        rotation=rotation,
        scale=scale
    )


@router.get("", response_model=List[BuildingResponse])
async def list_buildings(
    category: str = None,
    current_user: dict = Depends(get_current_user)
):
    """List all buildings or filter by category.

    Args:
        category: Optional category filter (buildings, vehicles, trees, props, street, park)
        current_user: Authenticated user

    Returns:
        List of BuildingResponse objects
    """
    town_data = get_town_data()
    buildings = []

    # Determine which categories to include
    if category:
        categories = [category] if category in town_data else []
    else:
        # All possible categories
        categories = ['buildings', 'vehicles', 'trees', 'props', 'street', 'park', 'terrain', 'roads']

    # Collect all buildings from selected categories
    for cat in categories:
        if cat in town_data and isinstance(town_data[cat], list):
            for building in town_data[cat]:
                if isinstance(building, dict):
                    buildings.append(BuildingResponse(
                        id=building.get('id', ''),
                        model=building.get('model', ''),
                        category=cat,
                        position=Position(**building.get('position', {})),
                        rotation=Rotation(**building.get('rotation', {})),
                        scale=Scale(**building.get('scale', {})),
                        driver=building.get('driver')
                    ))

    logger.info(f"Listed {len(buildings)} buildings" + (f" in category {category}" if category else ""))

    return buildings


@router.get("/{building_id}", response_model=BuildingResponse)
async def get_building(
    building_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific building by ID.

    Args:
        building_id: ID of the building to retrieve
        current_user: Authenticated user

    Returns:
        BuildingResponse with building data

    Raises:
        HTTPException: If building not found
    """
    town_data = get_town_data()

    # Search all categories for the building
    for category in ['buildings', 'vehicles', 'trees', 'props', 'street', 'park', 'terrain', 'roads']:
        if category in town_data and isinstance(town_data[category], list):
            for building in town_data[category]:
                if isinstance(building, dict) and building.get('id') == building_id:
                    return BuildingResponse(
                        id=building.get('id', ''),
                        model=building.get('model', ''),
                        category=category,
                        position=Position(**building.get('position', {})),
                        rotation=Rotation(**building.get('rotation', {})),
                        scale=Scale(**building.get('scale', {})),
                        driver=building.get('driver')
                    )

    raise HTTPException(status_code=404, detail=f"Building with ID {building_id} not found")


@router.put("/{building_id}", response_model=BuildingResponse)
async def update_building(
    building_id: str,
    request_data: BuildingUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a building's properties.

    Args:
        building_id: ID of the building to update
        request_data: Building update request data
        current_user: Authenticated user

    Returns:
        BuildingResponse with updated building data

    Raises:
        HTTPException: If building not found
    """
    town_data = get_town_data()

    # Search all categories for the building
    for category in ['buildings', 'vehicles', 'trees', 'props', 'street', 'park', 'terrain', 'roads']:
        if category in town_data and isinstance(town_data[category], list):
            for i, building in enumerate(town_data[category]):
                if isinstance(building, dict) and building.get('id') == building_id:
                    # Update fields if provided
                    if request_data.position is not None:
                        town_data[category][i]['position'] = request_data.position.model_dump()
                    if request_data.rotation is not None:
                        town_data[category][i]['rotation'] = request_data.rotation.model_dump()
                    if request_data.scale is not None:
                        town_data[category][i]['scale'] = request_data.scale.model_dump()
                    if request_data.model is not None:
                        town_data[category][i]['model'] = request_data.model

                    # Handle category change (move to different category)
                    if request_data.category is not None and request_data.category != category:
                        # Remove from current category
                        building_data = town_data[category].pop(i)
                        # Add to new category
                        if request_data.category not in town_data:
                            town_data[request_data.category] = []
                        town_data[request_data.category].append(building_data)
                        category = request_data.category
                        building = building_data
                    else:
                        building = town_data[category][i]

                    # Save to storage
                    set_town_data(town_data)

                    # Broadcast to all connected clients
                    broadcast_sse({
                        'type': 'edit',
                        'category': category,
                        'id': building_id,
                        'data': building
                    })

                    logger.info(f"Updated building: {building_id}")

                    return BuildingResponse(
                        id=building.get('id', ''),
                        model=building.get('model', ''),
                        category=category,
                        position=Position(**building.get('position', {})),
                        rotation=Rotation(**building.get('rotation', {})),
                        scale=Scale(**building.get('scale', {})),
                        driver=building.get('driver')
                    )

    raise HTTPException(status_code=404, detail=f"Building with ID {building_id} not found")


@router.delete("/{building_id}")
async def delete_building(
    building_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a building by ID.

    Args:
        building_id: ID of the building to delete
        current_user: Authenticated user

    Returns:
        Success message

    Raises:
        HTTPException: If building not found
    """
    town_data = get_town_data()

    # Search all categories for the building
    for category in ['buildings', 'vehicles', 'trees', 'props', 'street', 'park', 'terrain', 'roads']:
        if category in town_data and isinstance(town_data[category], list):
            for i, building in enumerate(town_data[category]):
                if isinstance(building, dict) and building.get('id') == building_id:
                    # Remove the building
                    town_data[category].pop(i)

                    # Save to storage
                    set_town_data(town_data)

                    # Broadcast to all connected clients
                    broadcast_sse({
                        'type': 'delete',
                        'category': category,
                        'id': building_id
                    })

                    logger.info(f"Deleted building: {building_id} from category {category}")

                    return {
                        "status": "success",
                        "message": f"Building {building_id} deleted successfully"
                    }

    raise HTTPException(status_code=404, detail=f"Building with ID {building_id} not found")
