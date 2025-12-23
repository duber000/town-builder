"""Authentication routes for JWT token management."""
from fastapi import APIRouter

router = APIRouter(prefix="/api/auth", tags=["Auth"])

# Note: The development token generation endpoint has been removed for security.
# In production, JWT tokens should be issued by your authentication service.
# For development, set DISABLE_JWT_AUTH=true in your environment variables.
