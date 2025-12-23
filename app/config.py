"""Configuration management for Town Builder application."""
import os
from typing import Optional
from pydantic_settings import BaseSettings
from pydantic import ConfigDict
import dotenv

# Load environment variables
dotenv.load_dotenv()


class Settings(BaseSettings):
    """Application settings."""

    model_config = ConfigDict(extra='allow')

    # Server settings
    app_title: str = "Town Builder API"
    app_description: str = "Interactive 3D town building application with real-time collaboration"
    app_version: str = "1.0.0"
    environment: str = os.getenv('ENVIRONMENT', 'development')

    # JWT Authentication
    jwt_secret_key: str = os.getenv('JWT_SECRET_KEY', '')
    jwt_algorithm: str = os.getenv('JWT_ALGORITHM', 'HS256')
    disable_jwt_auth: bool = os.getenv('DISABLE_JWT_AUTH', '').lower() == 'true'

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

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        # Parse allowed_api_domains from environment variable (using ALLOWED_DOMAINS to avoid Pydantic auto-mapping)
        allowed_domains_env = os.getenv('ALLOWED_DOMAINS', 'localhost,127.0.0.1')
        self.allowed_api_domains = [domain.strip() for domain in allowed_domains_env.split(',')]

        # Fail fast if JWT_SECRET_KEY is not set and JWT auth is enabled
        if not self.disable_jwt_auth and not self.jwt_secret_key:
            raise ValueError(
                "JWT_SECRET_KEY environment variable must be set when JWT authentication is enabled. "
                "Set JWT_SECRET_KEY to a secure random string or set DISABLE_JWT_AUTH=true for development."
            )


# Global settings instance
settings = Settings()
