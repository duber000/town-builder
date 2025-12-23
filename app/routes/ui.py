"""UI routes for serving the web interface."""
import logging
import os

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.templating import Jinja2Templates

from app.config import settings
from app.services.model_loader import get_available_models
from app.services.model_display_names import get_model_display_name

logger = logging.getLogger(__name__)

router = APIRouter(tags=["UI"])

# Setup templates
templates = Jinja2Templates(directory=settings.templates_path)


@router.get("/")
async def index(request: Request, town_id: int = None):
    """Render the main town builder interface.

    Args:
        request: FastAPI request object
        town_id: Optional town ID from URL parameter (e.g., ?town_id=123)
    """
    models = get_available_models()
    logger.info(f"Rendering index with {sum(len(models[cat]) for cat in models)} models")
    logger.info(f"Town ID from URL: {town_id}")

    # Add display names for models
    # Create a custom filter for Jinja2 template
    templates.env.filters['get_display_name'] = get_model_display_name

    return templates.TemplateResponse("index.html", {
        "request": request,
        "models": models,
        "town_id": town_id
    })


@router.get("/healthz")
async def healthz():
    """Liveness probe endpoint.

    Returns OK if the application is running.
    This endpoint should remain simple and always return 200 unless the app crashes.
    """
    return JSONResponse(content={"status": "ok"}, status_code=200)


@router.get("/readyz")
async def readyz():
    """Readiness probe endpoint.

    Checks if the application and its dependencies are ready to serve traffic.
    Returns 200 if ready, 503 if not ready (e.g., Redis unavailable).
    """
    from app.services.storage import get_redis_client

    health_status = {
        "status": "ok",
        "checks": {}
    }
    all_ready = True

    # Check Redis connection
    try:
        redis_client = get_redis_client()
        redis_client.ping()
        health_status["checks"]["redis"] = "ok"
    except Exception as e:
        logger.warning(f"Redis health check failed: {e}")
        health_status["checks"]["redis"] = f"error: {str(e)}"
        health_status["status"] = "degraded"
        # Don't fail readiness if Redis is down - app can work with in-memory fallback
        # all_ready = False  # Uncomment to fail readiness when Redis is down

    status_code = 200 if all_ready else 503
    return JSONResponse(content=health_status, status_code=status_code)


@router.get("/favicon.ico")
async def favicon():
    """Serve favicon or return 404."""
    favicon_path = "static/favicon.ico"
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path)
    else:
        raise HTTPException(status_code=404, detail="Favicon not found")
