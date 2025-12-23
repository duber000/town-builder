"""Main FastAPI application entry point."""
import logging
import mimetypes

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routes import ui, auth, models, town, proxy, events, cursor, batch, query, history, snapshots
from app.routes import ui, auth, models, town, proxy, events, cursor, buildings, scene
from app.utils.static_files import serve_js_files, serve_wasm_files

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Configure MIME types for WASM and JS files
mimetypes.add_type('application/wasm', '.wasm')
mimetypes.add_type('application/javascript', '.js')
mimetypes.add_type('text/javascript', '.js')

# Create FastAPI application
app = FastAPI(
    title=settings.app_title,
    description=settings.app_description,
    version=settings.app_version
)

# Add CORS middleware
# Parse allowed origins from settings (comma-separated string)
allowed_origins_list = [origin.strip() for origin in settings.allowed_origins.split(',') if origin.strip()]

# In development, if no origins specified, allow localhost
if not allowed_origins_list and settings.environment.lower() == 'development':
    allowed_origins_list = ["http://localhost:3000", "http://localhost:5001", "http://127.0.0.1:5001"]
    logger.warning("Using default development CORS origins. Set ALLOWED_ORIGINS in production!")

logger.info(f"CORS allowed origins: {allowed_origins_list}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom static file handlers for correct MIME types
app.get("/static/js/{file_path:path}")(serve_js_files)
app.get("/static/wasm/{file_path:path}")(serve_wasm_files)

# Mount static files (must be after custom handlers to avoid conflicts)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Include routers
app.include_router(ui.router)
app.include_router(auth.router)
app.include_router(models.router)
app.include_router(town.router)
app.include_router(buildings.router)
app.include_router(scene.router)
app.include_router(proxy.router)
app.include_router(events.router)
app.include_router(cursor.router)
# New programmatic API routers
app.include_router(batch.router)
app.include_router(query.router)
app.include_router(history.router)
app.include_router(snapshots.router)

if __name__ == '__main__':
    # This block will only run when you execute the file directly
    # For development only
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=5001, log_level="debug")
