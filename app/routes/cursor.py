"""Routes for collaborative cursor updates."""
from fastapi import APIRouter
from app.models.schemas import CursorUpdate
from app.services.events import broadcast_sse

router = APIRouter(tags=["Cursor"])


@router.post('/api/cursor/update')
async def update_cursor_position(cursor_data: CursorUpdate):
    """Update cursor position for collaborative cursors.
    
    Args:
        cursor_data: Cursor position update with username, position, and camera position
        
    Returns:
        Success status
    """
    # Broadcast cursor update to all connected clients via SSE
    broadcast_sse({
        'type': 'cursor',
        'username': cursor_data.username,
        'position': {
            'x': cursor_data.position.x,
            'y': cursor_data.position.y,
            'z': cursor_data.position.z
        },
        'camera_position': {
            'x': cursor_data.camera_position.x,
            'y': cursor_data.camera_position.y,
            'z': cursor_data.camera_position.z
        }
    })
    
    return {'status': 'success', 'message': 'Cursor position updated'}
