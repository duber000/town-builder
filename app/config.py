"""Configuration management for Town Builder application."""
import os
from typing import Optional
from pydantic_settings import BaseSettings
import dotenv

# Load environment variables
dotenv.load_dotenv()


class Settings(BaseSettings):
    """Application settings."""

    # Server settings
    app_title: str = "Town Builder API"
    app_description: str = "Interactive 3D town building application with real-time collaboration"
    app_version: str = "1.0.0"
    environment: str = os.getenv('ENVIRONMENT', 'development')

    # JWT Authentication
    jwt_secret_key: str = os.getenv('JWT_SECRET_KEY', '')
    jwt_algorithm: str = os.getenv('JWT_ALGORITHM', 'HS256')
    disable_jwt_auth: bool = os.getenv('DISABLE_JWT_AUTH', '').lower() == 'true'

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Fail fast if JWT_SECRET_KEY is not set and JWT auth is enabled
        if not self.disable_jwt_auth and not self.jwt_secret_key:
            raise ValueError(
                "JWT_SECRET_KEY environment variable must be set when JWT authentication is enabled. "
                "Set JWT_SECRET_KEY to a secure random string or set DISABLE_JWT_AUTH=true for development."
            )

    # External API (Django)
    api_url: str = os.getenv('TOWN_API_URL', 'http://localhost:8000/api/towns/')
    api_token: Optional[str] = os.getenv('TOWN_API_JWT_TOKEN')

    # Redis
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    pubsub_channel: str = "town_events"

    # Paths
    models_path: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static', 'models')
    static_path: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'static')
    templates_path: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'templates')
    data_path: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')

    # Allowed origins for CORS (comma-separated)
    allowed_origins: str = os.getenv('ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:5001,http://127.0.0.1:5001')

    # Allowed API URL patterns for SSRF prevention
    allowed_api_domains: list = ['localhost', '127.0.0.1', 'api.yourdomain.com']

    class Config:
        case_sensitive = False


# Global settings instance
settings = Settings()
