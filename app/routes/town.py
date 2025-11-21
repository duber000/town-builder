"""Routes for town data management (CRUD operations)."""
import json
import logging
import os

from fastapi import APIRouter, Depends, HTTPException
import requests

from app.models.schemas import (
    TownUpdateRequest,
    SaveTownRequest,
    LoadTownRequest,
    DeleteModelRequest,
    EditModelRequest
)
from app.services.auth import get_current_user
from app.services.storage import get_town_data, set_town_data
from app.services.events import broadcast_sse
from app.services.django_client import (
    search_town_by_name,
    create_town,
    update_town
)
from app.utils.security import get_safe_filepath
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Town"])


@router.get("/town")
async def get_town(current_user: dict = Depends(get_current_user)):
    """Get the current town layout.

    Returns:
        Dictionary containing town data (buildings, terrain, roads, props)
    """
    return get_town_data()


@router.post("/town")
async def update_town_endpoint(
    request_data: TownUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update the town layout.

    Handles three types of updates:
    1. Town name only
    2. Driver assignment for a vehicle
    3. Full town data update

    Args:
        request_data: Town update request data
        current_user: Authenticated user

    Returns:
        Success status
    """
    data = request_data.model_dump(exclude_unset=True)
    town_data = get_town_data()

    # Update town name only
    if 'townName' in data and len(data) == 1:
        town_data['townName'] = data['townName']
        set_town_data(town_data)
        logger.info(f"Updated town name to: {data['townName']}")
        broadcast_sse({'type': 'name', 'townName': data['townName']})

    # Update driver for a vehicle/model
    elif 'driver' in data and 'id' in data and 'category' in data:
        category = data['category']
        model_id = data['id']
        driver = data['driver']
        updated = False

        for i, model in enumerate(town_data.get(category, [])):
            if model.get('id') == model_id:
                town_data[category][i]['driver'] = driver
                updated = True
                set_town_data(town_data)
                logger.info(f"Updated driver for {category} id={model_id} to {driver}")
                broadcast_sse({'type': 'driver', 'category': category, 'id': model_id, 'driver': driver})
                break

        if not updated:
            raise HTTPException(status_code=404, detail="Model not found")

    # Full town data update
    else:
        set_town_data(data)
        broadcast_sse({'type': 'full', 'town': data})

    return {"status": "success"}


@router.post("/town/save")
async def save_town(
    request_data: SaveTownRequest,
    current_user: dict = Depends(get_current_user)
):
    """Save the town layout.

    Optionally saves to a local file and updates the Django backend if town_id is provided.

    Args:
        request_data: Save town request data
        current_user: Authenticated user

    Returns:
        Status, message, and town_id
    """
    try:
        request_payload = request_data.model_dump(exclude_unset=True)
        if not request_payload:
            raise HTTPException(status_code=400, detail="Invalid JSON payload")

        filename = request_payload.get('filename', 'town_data.json')
        town_data_to_save = request_payload.get('data')
        town_id = request_payload.get('town_id')
        town_name_from_payload = request_payload.get('townName')

        if town_data_to_save is None:
            raise HTTPException(status_code=400, detail="No data provided to save")

        # Save to local file (optional)
        local_save_message = ""
        if filename:
            # Add .json extension if not present
            if not filename.endswith('.json'):
                filename += '.json'

            # Get safe filepath (prevents path traversal)
            safe_path = get_safe_filepath(filename, settings.data_path, allowed_extensions=['.json'])

            with open(safe_path, 'w') as f:
                json.dump(town_data_to_save, f, indent=2)
            logger.info(f"Town saved locally to {safe_path}")
            local_save_message = f"Town saved locally to {safe_path.name}."
        else:
            local_save_message = "Local save skipped (no filename)."

        # Save to Django backend if town_id is provided
        if town_id is not None:
            # Update existing town (PATCH)
            try:
                update_town(town_id, request_payload, town_data_to_save, town_name_from_payload)
                broadcast_sse({'type': 'full', 'town': town_data_to_save})
                return {
                    "status": "success",
                    "message": f"{local_save_message} Town updated in Django backend (ID: {town_id}).",
                    "town_id": town_id
                }
            except requests.exceptions.RequestException as e:
                logger.error(f"Error updating town layout in Django backend for town_id {town_id}: {e}")
                error_detail = str(e)
                if e.response is not None:
                    try:
                        error_detail = e.response.json()
                    except ValueError:
                        error_detail = e.response.text
                raise HTTPException(
                    status_code=500,
                    detail={
                        "status": "partial_error",
                        "message": f"{local_save_message} Failed to update in Django backend: {error_detail}"
                    }
                )
        else:
            # Create new town (POST) or update by name if found (PATCH)
            town_name_for_search = town_name_from_payload
            if not town_name_for_search and isinstance(town_data_to_save, dict):
                town_name_for_search = town_data_to_save.get('townName') or town_data_to_save.get('name')

            existing_town_id = None
            if town_name_for_search:
                existing_town_id = search_town_by_name(town_name_for_search)

            try:
                if existing_town_id:
                    # Update existing town by name
                    update_town(existing_town_id, request_payload, town_data_to_save, town_name_from_payload)
                    broadcast_sse({'type': 'full', 'town': town_data_to_save})
                    return {
                        "status": "success",
                        "message": f"{local_save_message} Town updated in Django backend (ID: {existing_town_id}).",
                        "town_id": existing_town_id
                    }
                else:
                    # Create new town
                    result = create_town(request_payload, town_data_to_save, town_name_from_payload)
                    broadcast_sse({'type': 'full', 'town': town_data_to_save})
                    return {
                        "status": "success",
                        "message": f"{local_save_message} Town created in Django backend (ID: {result['town_id']}).",
                        "town_id": result['town_id']
                    }
            except requests.exceptions.RequestException as e:
                logger.error(f"Error saving town layout in Django backend: {e}")
                error_detail = str(e)
                if getattr(e, 'response', None) is not None:
                    try:
                        error_detail = e.response.json()
                    except ValueError:
                        error_detail = e.response.text
                raise HTTPException(
                    status_code=500,
                    detail={
                        "status": "partial_error",
                        "message": f"{local_save_message} Failed to create in Django backend: {error_detail}"
                    }
                )

    except Exception as e:
        logger.error(f"Error in save_town endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail={"status": "error", "message": str(e)})


@router.post("/town/load")
async def load_town(
    request_data: LoadTownRequest,
    current_user: dict = Depends(get_current_user)
):
    """Load the town layout from a file.

    Args:
        request_data: Load town request data
        current_user: Authenticated user

    Returns:
        Status, message, and town data
    """
    try:
        filename = request_data.filename

        # Ensure the filename has .json extension
        if not filename.endswith('.json'):
            filename += '.json'

        # Get safe filepath (prevents path traversal)
        safe_path = get_safe_filepath(filename, settings.data_path, allowed_extensions=['.json'])

        # Check if the file exists
        if not safe_path.exists():
            raise HTTPException(
                status_code=404,
                detail={"status": "error", "message": f"File {safe_path.name} not found"}
            )

        # Load the town data from the file
        with open(safe_path, 'r') as f:
            town_data = json.load(f)
            set_town_data(town_data)

        logger.info(f"Town loaded from {safe_path}")
        broadcast_sse({'type': 'full', 'town': town_data})
        return {"status": "success", "message": f"Town loaded from {safe_path.name}", "data": town_data}
    except Exception as e:
        logger.error(f"Error loading town: {e}")
        raise HTTPException(status_code=500, detail={"status": "error", "message": str(e)})


@router.get("/town/load-from-django/{town_id}")
async def load_town_from_django(
    town_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Load town layout data from Django backend.

    Args:
        town_id: ID of the town to load
        current_user: Authenticated user

    Returns:
        Status, message, and town data with layout_data
    """
    try:
        # Fetch town data from Django API
        from app.config import settings
        import requests

        base_url = settings.api_url if settings.api_url.endswith('/') else settings.api_url + '/'
        url = f"{base_url}{town_id}/"

        headers = {'Content-Type': 'application/json'}
        if settings.api_token and settings.api_token.strip():
            headers['Authorization'] = f"Bearer {settings.api_token}"

        logger.info(f"Loading town from Django: {url}")
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        town_data = response.json()
        logger.info(f"Successfully loaded town {town_id} from Django: {town_data.get('name')}")

        # Extract layout_data if available
        layout_data = town_data.get('layout_data', [])

        # Store in Redis/memory for multiplayer sync
        set_town_data(layout_data if layout_data else [])
        broadcast_sse({'type': 'full', 'town': layout_data})

        return {
            "status": "success",
            "message": f"Town '{town_data.get('name')}' loaded from Django",
            "data": layout_data,
            "town_info": {
                "id": town_data.get('id'),
                "name": town_data.get('name'),
                "description": town_data.get('description'),
                "latitude": town_data.get('latitude'),
                "longitude": town_data.get('longitude')
            }
        }

    except requests.exceptions.RequestException as e:
        logger.error(f"Error loading town from Django: {e}")
        error_detail = str(e)
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_detail = e.response.json()
            except ValueError:
                error_detail = e.response.text
        raise HTTPException(
            status_code=500,
            detail={"status": "error", "message": f"Failed to load town from Django: {error_detail}"}
        )
    except Exception as e:
        logger.error(f"Unexpected error loading town: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"status": "error", "message": str(e)}
        )


@router.delete("/town/model")
async def delete_model(
    request_data: DeleteModelRequest,
    current_user: dict = Depends(get_current_user)
):
    """Delete a model from the town layout.

    Can delete by ID or by position (finds closest model).

    Args:
        request_data: Delete model request data
        current_user: Authenticated user

    Returns:
        Success status and message
    """
    model_id = request_data.id
    category = request_data.category
    position = request_data.position

    if not category or (not model_id and not position):
        raise HTTPException(status_code=400, detail={"error": "Missing required parameters"})

    town_data = get_town_data()

    # Delete by ID
    if model_id is not None:
        if category in town_data and isinstance(town_data[category], list):
            for i, model in enumerate(town_data[category]):
                if isinstance(model, dict) and model.get('id') == model_id:
                    town_data[category].pop(i)
                    set_town_data(town_data)
                    broadcast_sse({'type': 'delete', 'category': category, 'id': model_id})
                    return {"status": "success", "message": f"Deleted model with ID {model_id}"}

    # Delete by position (find closest model)
    elif position:
        closest_model_index = -1
        closest_distance = float('inf')

        if category in town_data and isinstance(town_data[category], list):
            for i, model in enumerate(town_data[category]):
                if not isinstance(model, dict):
                    continue
                model_pos = model.get('position', {})
                dx = model_pos.get('x', 0) - position.x
                dy = model_pos.get('y', 0) - position.y
                dz = model_pos.get('z', 0) - position.z

                distance = (dx*dx + dy*dy + dz*dz) ** 0.5

                if distance < closest_distance:
                    closest_distance = distance
                    closest_model_index = i

            if closest_model_index >= 0 and closest_distance < 2.0:  # Threshold for deletion
                deleted_model = town_data[category].pop(closest_model_index)
                set_town_data(town_data)
                broadcast_sse({
                    'type': 'delete',
                    'category': category,
                    'position': position.model_dump(),
                    'deleted_id': deleted_model.get('id')
                })
                return {
                    "status": "success",
                    "message": f"Deleted model at position ({position.x}, {position.y}, {position.z})"
                }

    raise HTTPException(status_code=404, detail={"error": "Model not found"})


@router.put("/town/model")
async def edit_model(
    request_data: EditModelRequest,
    current_user: dict = Depends(get_current_user)
):
    """Edit a model in the town layout (position, rotation, scale).

    Args:
        request_data: Edit model request data
        current_user: Authenticated user

    Returns:
        Success status and message
    """
    model_id = request_data.id
    category = request_data.category

    if not category or not model_id:
        raise HTTPException(status_code=400, detail={"error": "Missing required parameters"})

    town_data = get_town_data()

    if category in town_data and isinstance(town_data[category], list):
        for i, model in enumerate(town_data[category]):
            if isinstance(model, dict) and model.get('id') == model_id:
                # Update model properties
                if request_data.position is not None:
                    town_data[category][i]['position'] = request_data.position.model_dump()
                if request_data.rotation is not None:
                    town_data[category][i]['rotation'] = request_data.rotation.model_dump()
                if request_data.scale is not None:
                    town_data[category][i]['scale'] = request_data.scale.model_dump()

                set_town_data(town_data)
                broadcast_sse({
                    'type': 'edit',
                    'category': category,
                    'id': model_id,
                    'data': town_data[category][i]
                })
                return {
                    "status": "success",
                    "message": f"Updated model with ID {model_id}"
                }

    raise HTTPException(status_code=404, detail={"error": "Model not found"})


@router.get("/config")
async def get_api_config(current_user: dict = Depends(get_current_user)):
    """Get API configuration.

    Returns:
        API configuration including proxy URL and user info
    """
    return {
        "apiUrl": "/api/proxy/towns",
        "authenticated": True,
        "user": current_user.get("username")
    }
