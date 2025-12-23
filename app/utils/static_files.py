"""Utility functions for serving static files with correct MIME types."""
import os

from fastapi import HTTPException
from fastapi.responses import FileResponse


async def serve_js_files(file_path: str):
    """Serve JavaScript files with correct MIME type.

    Args:
        file_path: Path to the JS file (relative to static/js/)

    Returns:
        FileResponse with application/javascript MIME type
    """
    file_full_path = os.path.join("static", "js", file_path)
    if not os.path.exists(file_full_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(file_full_path, media_type="application/javascript")


async def serve_wasm_files(file_path: str):
    """Serve WASM files with correct MIME type.

    Args:
        file_path: Path to the WASM file (relative to static/wasm/)

    Returns:
        FileResponse with appropriate MIME type
    """
    file_full_path = os.path.join("static", "wasm", file_path)
    if not os.path.exists(file_full_path):
        raise HTTPException(status_code=404, detail="File not found")

    # Determine correct MIME type based on file extension
    if file_path.endswith('.js'):
        media_type = "application/javascript"
    elif file_path.endswith('.wasm'):
        media_type = "application/wasm"
    elif file_path.endswith('.d.ts'):
        media_type = "text/plain"
    else:
        media_type = "application/octet-stream"

    return FileResponse(file_full_path, media_type=media_type)
