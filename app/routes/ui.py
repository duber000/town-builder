"""UI routes for serving the web interface."""
import logging
import os

from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.templating import Jinja2Templates

from app.config import settings
from app.services.model_loader import get_available_models

logger = logging.getLogger(__name__)

router = APIRouter(tags=["UI"])

# Setup templates
templates = Jinja2Templates(directory=settings.templates_path)


@router.get("/")
async def index(request: Request):
    """Render the main town builder interface."""
    models = get_available_models()
    logger.info(f"Rendering index with {sum(len(models[cat]) for cat in models)} models")
    return templates.TemplateResponse("index.html", {"request": request, "models": models})


@router.get("/healthz")
async def healthz():
    """Liveness probe endpoint."""
    return JSONResponse(content="OK", status_code=200)


@router.get("/readyz")
async def readyz():
    """Readiness probe endpoint."""
    return JSONResponse(content="OK", status_code=200)


@router.get("/favicon.ico")
async def favicon():
    """Serve favicon or return 404."""
    favicon_path = "static/favicon.ico"
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path)
    else:
        raise HTTPException(status_code=404, detail="Favicon not found")
