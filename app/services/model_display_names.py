"""Model display name mappings.

This module provides descriptive, user-friendly names for building models
instead of generic letter-based names (Building_A, Building_B, etc.).
"""

# Mapping from model filename to descriptive display name
MODEL_DISPLAY_NAMES = {
    # School/Education
    "building_A.gltf": "Elementary School",
    "building_D.gltf": "High School",
    "building_B.gltf": "Public Library",
    "building_F.gltf": "Library Branch",

    # Commercial/Retail
    "building_E.gltf": "Market/Grocery Store",
    "building_G.gltf": "Convenience Store",

    # Employment/Office
    "building_C.gltf": "Warehouse/Storage",
    "building_H.gltf": "Corporate Office Building",

    # Other Structures
    "house.gltf": "Residential Housing",
    "medical_facility.gltf": "Hospital/Health Center",
    "bench.gltf": "Park Seating",
}


def get_model_display_name(model_filename: str) -> str:
    """Get the descriptive display name for a model file.

    Args:
        model_filename: Model filename (e.g., "building_A.gltf", "house.gltf")

    Returns:
        Descriptive display name if found, otherwise a formatted version of the filename

    Examples:
        >>> get_model_display_name("building_A.gltf")
        'Elementary School'
        >>> get_model_display_name("building_B.gltf")
        'Public Library'
        >>> get_model_display_name("unknown_model.gltf")
        'Unknown Model'
    """
    # First check if we have a specific mapping
    if model_filename in MODEL_DISPLAY_NAMES:
        return MODEL_DISPLAY_NAMES[model_filename]

    # Fallback: convert filename to friendly name
    # Remove file extension
    name = model_filename.replace('.glb', '').replace('.gltf', '')
    # Replace underscores with spaces and title case
    name = name.replace('_', ' ').title()
    return name
