"""Proxy routes for forwarding requests to external Django Towns API."""
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
import httpx

from app.services.auth import get_current_user
from app.services.django_client import proxy_request

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/proxy/towns", tags=["Proxy"])


async def _handle_proxy_request(request: Request, method: str, path: str = "", data: dict = None):
    """Helper function to handle proxy requests.

    Args:
        request: FastAPI request object
        method: HTTP method (GET, POST, PUT, PATCH, DELETE)
        path: API path segment
        data: Request body data (for POST/PUT/PATCH)

    Returns:
        JSONResponse with proxied response
    """
    # Copy request headers (excluding some that shouldn't be forwarded)
    headers = {
        key: value for key, value in request.headers.items()
        if key.lower() not in ['host', 'content-length']
    }

    try:
        resp = await proxy_request(
            method=method,
            path=path,
            headers=headers,
            params=dict(request.query_params),
            data=data
        )

        logger.debug(f"Response status: {resp.status_code}")
        return JSONResponse(
            content=resp.json() if resp.headers.get('content-type', '').startswith('application/json') else resp.text,
            status_code=resp.status_code,
            headers={
                k: v for k, v in resp.headers.items()
                if k.lower() not in ['content-length', 'transfer-encoding', 'connection', 'content-encoding']
            }
        )
    except httpx.TimeoutException:
        logger.error(f"Timeout proxying request")
        raise HTTPException(status_code=504, detail="Request to upstream service timed out")
    except httpx.ConnectError:
        logger.error(f"Connection error proxying request")
        raise HTTPException(status_code=503, detail="Could not connect to upstream service")
    except Exception as e:
        logger.error(f"Error proxying request: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{path:path}")
async def proxy_towns_get(request: Request, path: str = "", current_user: dict = Depends(get_current_user)):
    """Proxy GET requests to the external towns API."""
    return await _handle_proxy_request(request, 'GET', path)


@router.post("/{path:path}")
async def proxy_towns_post(request: Request, data: dict, path: str = "", current_user: dict = Depends(get_current_user)):
    """Proxy POST requests to the external towns API."""
    return await _handle_proxy_request(request, 'POST', path, data)


@router.put("/{path:path}")
async def proxy_towns_put(request: Request, data: dict, path: str = "", current_user: dict = Depends(get_current_user)):
    """Proxy PUT requests to the external towns API."""
    return await _handle_proxy_request(request, 'PUT', path, data)


@router.patch("/{path:path}")
async def proxy_towns_patch(request: Request, data: dict, path: str = "", current_user: dict = Depends(get_current_user)):
    """Proxy PATCH requests to the external towns API."""
    return await _handle_proxy_request(request, 'PATCH', path, data)


@router.delete("/{path:path}")
async def proxy_towns_delete(request: Request, path: str = "", current_user: dict = Depends(get_current_user)):
    """Proxy DELETE requests to the external towns API."""
    return await _handle_proxy_request(request, 'DELETE', path)


@router.get("")
async def proxy_towns_get_root(request: Request, current_user: dict = Depends(get_current_user)):
    """Proxy GET requests to the external towns API root."""
    return await _handle_proxy_request(request, 'GET', "")


@router.post("")
async def proxy_towns_post_root(request: Request, data: dict, current_user: dict = Depends(get_current_user)):
    """Proxy POST requests to the external towns API root."""
    return await _handle_proxy_request(request, 'POST', "", data)
