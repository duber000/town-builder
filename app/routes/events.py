"""Routes for Server-Sent Events (SSE) real-time updates."""
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.services.events import event_stream

router = APIRouter(tags=["Events"])


@router.get('/events')
async def sse_events(name: str = Query(None)):
    """Server-Sent Events endpoint for real-time updates.

    Args:
        name: Optional player/user name for tracking connected users

    Returns:
        StreamingResponse with SSE event stream
    """
    def generate():
        return event_stream(name)

    return StreamingResponse(generate(), media_type='text/event-stream')
