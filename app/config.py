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
    jwt_secret_key: str = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-this-in-production')
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

    class Config:
        case_sensitive = False


# Global settings instance
settings = Settings()
