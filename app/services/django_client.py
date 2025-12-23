"""Client for interacting with the external Django Towns API."""
import logging
from typing import Dict, Any, Optional

import requests

from app.config import settings
from app.utils.security import validate_api_url

logger = logging.getLogger(__name__)


def _prepare_django_payload(
    request_payload: Dict[str, Any],
    town_data_to_save: Optional[Dict[str, Any]],
    town_name_from_payload: Optional[str],
    is_update_operation: bool = False
) -> Dict[str, Any]:
    """Prepare the payload dictionary for Django API requests.

    Args:
        request_payload: The original request payload
        town_data_to_save: The town data to save (sceneData)
        town_name_from_payload: Town name from the payload root
        is_update_operation: Whether this is an update operation (affects name field handling)

    Returns:
        Dictionary formatted for Django API
    """
    current_layout_data = town_data_to_save if town_data_to_save is not None else {}
    django_payload = {"layout_data": current_layout_data}

    # Name (Django key: "name")
    # Django serializer requires 'name' for PUT requests as well.
    effective_name = town_name_from_payload
    if not effective_name and isinstance(current_layout_data, dict):
        effective_name = current_layout_data.get('townName')
        if not effective_name:
            effective_name = current_layout_data.get('name')

    if not is_update_operation:
        if effective_name is not None:
            django_payload['name'] = effective_name
        else:
            logger.warning("Name is missing for a create operation. Django will likely reject this.")

    # Propagate optional fields
    fields_to_propagate = [
        "latitude", "longitude", "description", "population",
        "area", "established_date", "place_type", "full_address", "town_image"
    ]
    for key in fields_to_propagate:
        value = request_payload.get(key)
        if value is None and isinstance(current_layout_data, dict):
            value = current_layout_data.get(key)
        if value is not None:
            django_payload[key] = value

    return django_payload


def _get_headers() -> Dict[str, str]:
    """Get headers for Django API requests.

    Returns:
        Dictionary of HTTP headers
    """
    headers = {'Content-Type': 'application/json'}
    # Only add Authorization header if api_token is not None and not empty
    if settings.api_token and settings.api_token.strip():
        headers['Authorization'] = f"Token {settings.api_token}"
    return headers


def _get_base_url() -> str:
    """Get the base URL for Django API with trailing slash.

    Returns:
        Base URL string

    Raises:
        ValueError: If the API URL is not in the allowed domains list
    """
    base_url = settings.api_url if settings.api_url.endswith('/') else settings.api_url + '/'

    # Validate URL to prevent SSRF attacks
    if not validate_api_url(base_url):
        logger.error(f"API URL '{base_url}' is not in the allowed domains list")
        raise ValueError(
            f"API URL is not allowed. Allowed domains: {settings.allowed_api_domains}"
        )

    return base_url


def search_town_by_name(town_name: str) -> Optional[int]:
    """Search for a town by name in Django API.

    Args:
        town_name: Name of the town to search for

    Returns:
        Town ID if found, None otherwise
    """
    base_url = _get_base_url()
    search_url = f"{base_url}?name={town_name}"
    headers = _get_headers()

    try:
        logger.debug(f"Searching for town by name: {search_url}")
        resp = requests.get(search_url, headers=headers, timeout=5)

        if resp.status_code == 200:
            search_data = resp.json()
            results = []
            if isinstance(search_data, list):
                results = search_data
            elif isinstance(search_data, dict) and 'results' in search_data:
                results = search_data['results']

            if len(results) > 0 and 'id' in results[0]:
                town_id = results[0]['id']
                if len(results) > 1:
                    logger.warning(
                        f"Found {len(results)} towns named '{town_name}'. "
                        f"Returning the first one (ID: {town_id})."
                    )
                else:
                    logger.info(f"Found existing town by name '{town_name}' with ID: {town_id}")
                return town_id
            else:
                logger.info(f"No town found with name '{town_name}'")
                return None
        else:
            logger.warning(f"Failed to search for town by name (status {resp.status_code})")
            return None
    except requests.exceptions.RequestException as e:
        logger.error(f"Error searching for town by name: {e}")
        return None
    except ValueError:
        logger.error("Error decoding JSON response when searching for town by name")
        return None


def create_town(request_payload: Dict[str, Any], town_data: Dict[str, Any], town_name: Optional[str]) -> Dict[str, Any]:
    """Create a new town in Django API.

    Args:
        request_payload: The original request payload
        town_data: The town data to save
        town_name: Name of the town

    Returns:
        Dictionary with status, message, and town_id

    Raises:
        requests.exceptions.RequestException: If the request fails
    """
    base_url = _get_base_url()
    headers = _get_headers()
    django_payload = _prepare_django_payload(request_payload, town_data, town_name, is_update_operation=False)

    logger.debug(f"Creating town via Django API: {base_url} with payload keys: {list(django_payload.keys())}")
    resp = requests.post(base_url, headers=headers, json=django_payload, timeout=10)
    resp.raise_for_status()

    response_data = resp.json()
    town_id = response_data.get("id")
    logger.info(f"Town created in Django backend. ID: {town_id}")

    return {
        "status": "success",
        "town_id": town_id,
        "response": response_data
    }


def update_town(
    town_id: int,
    request_payload: Dict[str, Any],
    town_data: Dict[str, Any],
    town_name: Optional[str]
) -> Dict[str, Any]:
    """Update an existing town in Django API.

    Args:
        town_id: ID of the town to update
        request_payload: The original request payload
        town_data: The town data to save
        town_name: Name of the town

    Returns:
        Dictionary with status, message, and town_id

    Raises:
        requests.exceptions.RequestException: If the request fails
    """
    base_url = _get_base_url()
    url = f"{base_url}{town_id}/"
    headers = _get_headers()
    django_payload = _prepare_django_payload(request_payload, town_data, town_name, is_update_operation=True)

    logger.debug(f"Updating town (PATCH) via Django API: {url} with payload keys: {list(django_payload.keys())}")
    resp = requests.patch(url, headers=headers, json=django_payload, timeout=10)
    resp.raise_for_status()

    logger.info(f"Town layout successfully updated via PATCH to Django backend for town_id: {town_id}")

    return {
        "status": "success",
        "town_id": town_id
    }


def proxy_request(method: str, path: str, headers: Dict[str, str], params: Dict[str, Any] = None, data: Dict[str, Any] = None) -> requests.Response:
    """Proxy a request to the Django API.

    Args:
        method: HTTP method (GET, POST, PUT, PATCH, DELETE)
        path: API path (without base URL)
        headers: Request headers
        params: Query parameters
        data: Request body data

    Returns:
        Response from the Django API

    Raises:
        requests.exceptions.RequestException: If the request fails
    """
    base_url = _get_base_url()
    url = f"{base_url}{path.lstrip('/')}"

    # Add authorization if we have a token
    if settings.api_token:
        headers['Authorization'] = f"Token {settings.api_token}"

    logger.debug(f"Proxying {method} request to {url}")

    if method == 'GET':
        return requests.get(url, headers=headers, params=params, timeout=10)
    elif method == 'POST':
        logger.debug(f"POST data: {str(data)[:200] if data else 'None'}...")
        return requests.post(url, headers=headers, json=data, timeout=10)
    elif method == 'PUT':
        logger.debug(f"PUT data: {str(data)[:200] if data else 'None'}...")
        return requests.put(url, headers=headers, json=data, timeout=10)
    elif method == 'PATCH':
        logger.debug(f"PATCH data: {str(data)[:200] if data else 'None'}...")
        return requests.patch(url, headers=headers, json=data, timeout=10)
    elif method == 'DELETE':
        return requests.delete(url, headers=headers, timeout=10)
    else:
        raise ValueError(f"Unsupported HTTP method: {method}")
