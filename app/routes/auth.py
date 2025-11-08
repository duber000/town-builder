"""Authentication routes for JWT token management."""
from fastapi import APIRouter, Query

from app.services.auth import create_access_token

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/token")
async def create_token(username: str = "user"):
    """Generate a JWT token for development/testing. Remove in production!

    Args:
        username: Username to encode in the token (default: "user")

    Returns:
        Dictionary with access_token, token_type, expires_in, and username
    """
    return create_access_token(username)
