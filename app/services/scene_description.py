"""Service for generating scene descriptions."""
import logging
from typing import Dict, Any, List
from collections import Counter

logger = logging.getLogger(__name__)


def get_model_name_friendly(model_filename: str) -> str:
    """Convert model filename to friendly name.

    Args:
        model_filename: Model filename (e.g., "house.glb", "oak_tree.glb")

    Returns:
        Friendly name (e.g., "house", "oak tree")
    """
    # Remove file extension
    name = model_filename.replace('.glb', '').replace('.gltf', '')
    # Replace underscores with spaces
    name = name.replace('_', ' ')
    return name


def analyze_category(category_data: List[Dict[str, Any]], category_name: str) -> Dict[str, Any]:
    """Analyze a category of objects.

    Args:
        category_data: List of objects in the category
        category_name: Name of the category

    Returns:
        Dictionary with category analysis
    """
    if not category_data or not isinstance(category_data, list):
        return {
            "count": 0,
            "models": {},
            "has_drivers": False
        }

    model_counts = Counter()
    driver_count = 0
    positions = []

    for obj in category_data:
        if not isinstance(obj, dict):
            continue

        # Count models
        model = obj.get('model', 'unknown')
        model_counts[model] += 1

        # Check for drivers (vehicles)
        if obj.get('driver'):
            driver_count += 1

        # Track positions for spatial analysis
        pos = obj.get('position', {})
        if pos:
            positions.append((
                pos.get('x', 0),
                pos.get('y', 0),
                pos.get('z', 0)
            ))

    return {
        "count": len(category_data),
        "models": dict(model_counts),
        "has_drivers": driver_count > 0,
        "driver_count": driver_count,
        "positions": positions
    }


def calculate_scene_bounds(all_positions: List[tuple]) -> Dict[str, Any]:
    """Calculate the bounds of the scene.

    Args:
        all_positions: List of (x, y, z) tuples

    Returns:
        Dictionary with min/max coordinates and dimensions
    """
    if not all_positions:
        return {
            "min": {"x": 0, "y": 0, "z": 0},
            "max": {"x": 0, "y": 0, "z": 0},
            "dimensions": {"width": 0, "height": 0, "depth": 0}
        }

    xs = [pos[0] for pos in all_positions]
    ys = [pos[1] for pos in all_positions]
    zs = [pos[2] for pos in all_positions]

    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    min_z, max_z = min(zs), max(zs)

    return {
        "min": {"x": min_x, "y": min_y, "z": min_z},
        "max": {"x": max_x, "y": max_y, "z": max_z},
        "dimensions": {
            "width": max_x - min_x,
            "height": max_y - min_y,
            "depth": max_z - min_z
        }
    }


def generate_natural_description(analysis: Dict[str, Any]) -> str:
    """Generate a natural language description of the scene.

    Args:
        analysis: Scene analysis data

    Returns:
        Natural language description
    """
    parts = []

    # Start with town name if available
    town_name = analysis.get('town_name', 'Unnamed Town')
    parts.append(f"Scene: {town_name}")

    # Total objects
    total = analysis['total_objects']
    if total == 0:
        return f"{town_name} is currently empty with no objects placed."

    parts.append(f"Total objects: {total}")

    # Buildings
    buildings = analysis['categories'].get('buildings', {})
    if buildings.get('count', 0) > 0:
        count = buildings['count']
        models = buildings['models']
        model_desc = ", ".join([f"{cnt} {get_model_name_friendly(model)}" for model, cnt in models.items()])
        parts.append(f"Buildings ({count}): {model_desc}")

    # Vehicles
    vehicles = analysis['categories'].get('vehicles', {})
    if vehicles.get('count', 0) > 0:
        count = vehicles['count']
        models = vehicles['models']
        model_desc = ", ".join([f"{cnt} {get_model_name_friendly(model)}" for model, cnt in models.items()])
        driver_info = f", {vehicles['driver_count']} in use" if vehicles.get('has_drivers') else ""
        parts.append(f"Vehicles ({count}): {model_desc}{driver_info}")

    # Trees
    trees = analysis['categories'].get('trees', {})
    if trees.get('count', 0) > 0:
        count = trees['count']
        models = trees['models']
        model_desc = ", ".join([f"{cnt} {get_model_name_friendly(model)}" for model, cnt in models.items()])
        parts.append(f"Trees ({count}): {model_desc}")

    # Props
    props = analysis['categories'].get('props', {})
    if props.get('count', 0) > 0:
        count = props['count']
        parts.append(f"Props: {count} objects")

    # Street elements
    street = analysis['categories'].get('street', {})
    if street.get('count', 0) > 0:
        count = street['count']
        parts.append(f"Street elements: {count} objects")

    # Park elements
    park = analysis['categories'].get('park', {})
    if park.get('count', 0) > 0:
        count = park['count']
        parts.append(f"Park elements: {count} objects")

    # Terrain
    terrain = analysis['categories'].get('terrain', {})
    if terrain.get('count', 0) > 0:
        count = terrain['count']
        parts.append(f"Terrain: {count} objects")

    # Roads
    roads = analysis['categories'].get('roads', {})
    if roads.get('count', 0) > 0:
        count = roads['count']
        parts.append(f"Roads: {count} segments")

    # Scene bounds
    bounds = analysis.get('bounds', {})
    dims = bounds.get('dimensions', {})
    if dims.get('width', 0) > 0 or dims.get('depth', 0) > 0:
        parts.append(f"Scene dimensions: {dims['width']:.1f} x {dims['depth']:.1f} units")

    return "\n".join(parts)


def generate_scene_description(town_data: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a comprehensive scene description.

    Args:
        town_data: Town data from storage

    Returns:
        Dictionary with scene description and analysis
    """
    logger.info("Generating scene description")

    # Categories to analyze
    categories = ['buildings', 'vehicles', 'trees', 'props', 'street', 'park', 'terrain', 'roads']

    # Analyze each category
    category_analysis = {}
    all_positions = []
    total_objects = 0

    for category in categories:
        category_data = town_data.get(category, [])
        analysis = analyze_category(category_data, category)
        category_analysis[category] = analysis
        total_objects += analysis['count']
        all_positions.extend(analysis['positions'])

    # Calculate scene bounds
    bounds = calculate_scene_bounds(all_positions)

    # Compile analysis
    analysis = {
        "town_name": town_data.get('townName', 'Unnamed Town'),
        "total_objects": total_objects,
        "categories": category_analysis,
        "bounds": bounds
    }

    # Generate natural language description
    description = generate_natural_description(analysis)

    logger.info(f"Scene description generated: {total_objects} total objects")

    return {
        "description": description,
        "analysis": analysis
    }
