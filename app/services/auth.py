"""Authentication service for JWT token verification."""
import logging
from datetime import datetime, timedelta
from typing import Dict

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from app.config import settings

logger = logging.getLogger(__name__)

# Security scheme
security = HTTPBearer()


def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, any]:
    """Verify JWT token and return user info.

    Args:
        credentials: HTTP bearer credentials containing the JWT token

    Returns:
        Dictionary with username and payload

    Raises:
        HTTPException: If token is invalid or missing required fields
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return {"username": username, "payload": payload}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, any]:
    """Get current user from JWT token, with development bypass option.

    Args:
        credentials: HTTP bearer credentials containing the JWT token

    Returns:
        Dictionary with username and payload

    Raises:
        HTTPException: If token is invalid (unless dev mode is enabled)
    """
    # Check if JWT authentication is disabled for development
    if settings.disable_jwt_auth:
        logger.warning("JWT authentication is DISABLED - development mode only!")
        return {"username": "dev-user", "payload": {"sub": "dev-user"}}

    return verify_token(credentials)


def create_access_token(username: str, expires_hours: int = 24) -> Dict[str, any]:
    """Generate a JWT token for development/testing.

    Args:
        username: Username to encode in the token
        expires_hours: Number of hours until token expires (default: 24)

    Returns:
        Dictionary with access_token, token_type, expires_in, and username

    Raises:
        HTTPException: If called in production environment
    """
    if settings.environment.lower() == 'production':
        raise HTTPException(status_code=404, detail="Not found")

    # Create token with expiration
    expire = datetime.utcnow() + timedelta(hours=expires_hours)
    to_encode = {"sub": username, "exp": expire}
    encoded_jwt = jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)

    return {
        "access_token": encoded_jwt,
        "token_type": "bearer",
        "expires_in": expires_hours * 3600,
        "username": username
    }
