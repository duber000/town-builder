"""Service for discovering and loading 3D models from the file system."""
import logging
import os
from typing import Dict, List

from app.config import settings

logger = logging.getLogger(__name__)


def get_available_models() -> Dict[str, List[str]]:
    """Scan the models directory and return available models by category.
    
    For buildings category, filters out models with '_withoutBase' suffix to avoid duplicates.

    Returns:
        Dictionary mapping category names to lists of model filenames

    Example:
        {
            "buildings": ["house.glb", "office.gltf"],
            "vehicles": ["car.glb", "truck.glb"],
            "trees": ["oak.glb", "pine.glb"]
        }
    """
    models = {}
    try:
        # Scan all subdirectories in the models folder
        for category in os.listdir(settings.models_path):
            category_path = os.path.join(settings.models_path, category)
            if os.path.isdir(category_path):
                models[category] = []
                for model_file in os.listdir(category_path):
                    if model_file.endswith('.gltf') or model_file.endswith('.glb'):
                        # For buildings category, filter out models with '_withoutBase' suffix
                        if category == 'buildings' and '_withoutBase' in model_file:
                            logger.debug(f"Skipping building model without base: {category}/{model_file}")
                            continue
                        
                        models[category].append(model_file)
                        logger.debug(f"Found model: {category}/{model_file}")

        logger.info(f"Loaded {sum(len(models[cat]) for cat in models)} models from {len(models)} categories")
    except Exception as e:
        logger.error(f"Error loading models: {e}")
    return models
