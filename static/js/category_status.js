/**
 * Town Category Status Visualization System
 *
 * This module handles the visualization of town category statuses using a color gradient system.
 *
 * Color Gradient System (7 levels):
 * 0 - Unknown (Light Grey #999999): No data/Not tracked
 * 1 - Absent (Medium Grey #666666): Missing entirely
 * 2 - Crisis (Dark Red #8B0000): Present but severely degraded/harmful
 * 3 - Poor (Dark Brown/Maroon #4A1A1A): Present but very problematic
 * 4 - Fair (Red-Orange #CC4400): Present, needs improvement
 * 5 - Good (Orange #FF8C00): Decent, on the right track
 * 6 - Excellent (Gold #FFD700): Thriving, exemplary
 */

// Status level color mapping
export const STATUS_COLORS = {
    0: 0x999999,  // Unknown - Light Grey
    1: 0x666666,  // Absent - Medium Grey
    2: 0x8B0000,  // Crisis - Dark Red
    3: 0x4A1A1A,  // Poor - Dark Brown/Maroon
    4: 0xCC4400,  // Fair - Red-Orange
    5: 0xFF8C00,  // Good - Orange
    6: 0xFFD700   // Excellent - Gold
};

// Status level display names
export const STATUS_NAMES = {
    0: 'Unknown',
    1: 'Absent',
    2: 'Crisis',
    3: 'Poor',
    4: 'Fair',
    5: 'Good',
    6: 'Excellent'
};

/**
 * Category to 3D model mapping
 * Maps town category names to the 3D models that should represent them
 */
export const CATEGORY_MODEL_MAPPING = {
    // 1. Clean water, air and land
    'Clean water, air and land': {
        models: [
            { category: 'props', name: 'watertower.gltf' },
            { category: 'trees', name: 'tree_A.gltf' },
            { category: 'trees', name: 'tree_B.gltf' },
            { category: 'park', name: 'park_base_decorated_trees.gltf' }
        ],
        priority: 1
    },

    // 2. Access to stores/markets
    'Access to a store or market that sells fruits and vegetables': {
        models: [
            { category: 'buildings', name: 'building_E.gltf' },
            { category: 'buildings', name: 'building_G.gltf' }
        ],
        priority: 2
    },

    // 3. Library access
    'Access to a library': {
        models: [
            { category: 'buildings', name: 'building_B.gltf' },
            { category: 'buildings', name: 'building_F.gltf' }
        ],
        priority: 3
    },

    // 4. Good schools
    'Good schools': {
        models: [
            { category: 'buildings', name: 'building_A.gltf' },
            { category: 'buildings', name: 'building_D.gltf' }
        ],
        priority: 4
    },

    // 5. Low crime / Safety
    'Low crime': {
        models: [
            { category: 'vehicles', name: 'car_police.gltf' },
            { category: 'props', name: 'streetlight.gltf' },
            { category: 'props', name: 'firehydrant.gltf' }
        ],
        priority: 5
    },

    // 6. Green spaces / Recreation
    'Access to Green spaces/recreation': {
        models: [
            { category: 'park', name: 'park_base.gltf' },
            { category: 'park', name: 'park_base_decorated_bushes.gltf' },
            { category: 'trees', name: 'tree_C.gltf' },
            { category: 'trees', name: 'tree_D.gltf' },
            { category: 'buildings', name: 'bench.gltf' }
        ],
        priority: 6
    },

    // 7. Employment
    'Local or remote employment': {
        models: [
            { category: 'buildings', name: 'building_C.gltf' },
            { category: 'buildings', name: 'building_H.gltf' }
        ],
        priority: 7
    },

    // 8. Affordable housing
    'Affordable Housing': {
        models: [
            { category: 'buildings', name: 'house.gltf' },
            { category: 'buildings', name: 'building_A.gltf' },
            { category: 'buildings', name: 'building_B.gltf' }
        ],
        priority: 8
    },

    // 9. Reliable transportation
    'Reliable Transportation': {
        models: [
            { category: 'street', name: 'road_straight.gltf' },
            { category: 'street', name: 'road_junction.gltf' },
            { category: 'vehicles', name: 'car_taxi.gltf' },
            { category: 'props', name: 'trafficlight_A.gltf' }
        ],
        priority: 9
    },

    // 10. Healthcare access
    'Access to Healthcare': {
        models: [
            { category: 'buildings', name: 'medical_facility.gltf' }
        ],
        priority: 10
    }
};

/**
 * Apply status color to a 3D object
 * @param {THREE.Object3D} object3D - The 3D object to color
 * @param {number} statusLevel - Status level (0-6)
 * @param {number} intensity - Emissive intensity (0-1), default 0.3
 */
export function applyStatusColor(object3D, statusLevel, intensity = 0.3) {
    if (!object3D || statusLevel < 0 || statusLevel > 6) {
        console.warn('Invalid object or status level:', object3D, statusLevel);
        return;
    }

    const color = STATUS_COLORS[statusLevel];

    object3D.traverse(child => {
        if (child.isMesh) {
            // Clone the material to avoid affecting other instances
            child.material = child.material.clone();

            // Apply the color
            child.material.color.setHex(color);

            // Add emissive glow for visibility
            child.material.emissive.setHex(color);
            child.material.emissiveIntensity = intensity;

            // Ensure the material is updated
            child.material.needsUpdate = true;
        }
    });

    // Store the status level in userData for future reference
    object3D.userData.statusLevel = statusLevel;
    object3D.userData.statusColor = color;
}

/**
 * Get the status color for a given level
 * @param {number} statusLevel - Status level (0-6)
 * @returns {number} Hex color code
 */
export function getStatusColor(statusLevel) {
    return STATUS_COLORS[statusLevel] || STATUS_COLORS[0];
}

/**
 * Get the status name for a given level
 * @param {number} statusLevel - Status level (0-6)
 * @returns {string} Status name
 */
export function getStatusName(statusLevel) {
    return STATUS_NAMES[statusLevel] || STATUS_NAMES[0];
}

/**
 * Find models that should be colored for a given category
 * @param {string} categoryName - The category name
 * @param {Array<THREE.Object3D>} placedObjects - Array of placed objects in the scene
 * @returns {Array<THREE.Object3D>} Array of objects that match the category
 */
export function findModelsForCategory(categoryName, placedObjects) {
    const mapping = CATEGORY_MODEL_MAPPING[categoryName];
    if (!mapping) {
        console.warn('No model mapping found for category:', categoryName);
        return [];
    }

    const matchingObjects = [];

    placedObjects.forEach(obj => {
        const objCategory = obj.userData.category;
        const objModelName = obj.userData.modelName;

        // Check if this object matches any of the models for this category
        const matches = mapping.models.some(m =>
            m.category === objCategory && m.name === objModelName
        );

        if (matches) {
            matchingObjects.push(obj);
        }
    });

    return matchingObjects;
}

/**
 * Apply category statuses to a scene
 * @param {Array<Object>} categoryStatuses - Array of category status objects from Django API
 * @param {Array<THREE.Object3D>} placedObjects - Array of placed objects in the scene
 */
export function applyCategoryStatuses(categoryStatuses, placedObjects) {
    if (!categoryStatuses || !Array.isArray(categoryStatuses)) {
        console.warn('Invalid category statuses:', categoryStatuses);
        return;
    }

    categoryStatuses.forEach(status => {
        const { category_name, status_level } = status;

        // Find all objects that represent this category
        const objects = findModelsForCategory(category_name, placedObjects);

        // Apply the status color to each object
        objects.forEach(obj => {
            applyStatusColor(obj, status_level);
        });

        console.log(`Applied status level ${status_level} (${getStatusName(status_level)}) to ${objects.length} objects for category: ${category_name}`);
    });
}

/**
 * Remove status coloring from an object (reset to original)
 * @param {THREE.Object3D} object3D - The 3D object to reset
 */
export function removeStatusColor(object3D) {
    if (!object3D) return;

    object3D.traverse(child => {
        if (child.isMesh) {
            // Reset to white color
            child.material.color.setHex(0xffffff);
            child.material.emissive.setHex(0x000000);
            child.material.emissiveIntensity = 0;
            child.material.needsUpdate = true;
        }
    });

    // Remove status data from userData
    delete object3D.userData.statusLevel;
    delete object3D.userData.statusColor;
}

/**
 * Create a visual legend/dashboard for category statuses
 * @param {Array<Object>} categoryStatuses - Array of category status objects
 * @returns {HTMLElement} DOM element containing the legend
 */
export function createStatusLegend(categoryStatuses) {
    const legend = document.createElement('div');
    legend.id = 'category-status-legend';
    legend.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 15px;
        border-radius: 8px;
        font-family: monospace;
        font-size: 12px;
        max-width: 300px;
        z-index: 1000;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Town Category Status';
    title.style.cssText = 'margin: 0 0 10px 0; font-size: 14px; border-bottom: 1px solid #555; padding-bottom: 5px;';
    legend.appendChild(title);

    categoryStatuses.forEach(status => {
        const item = document.createElement('div');
        item.style.cssText = 'margin: 5px 0; display: flex; align-items: center;';

        const colorBox = document.createElement('span');
        colorBox.style.cssText = `
            display: inline-block;
            width: 20px;
            height: 20px;
            background: #${getStatusColor(status.status_level).toString(16).padStart(6, '0')};
            margin-right: 8px;
            border: 1px solid #fff;
        `;

        const text = document.createElement('span');
        text.textContent = `${status.category_name}: ${getStatusName(status.status_level)}`;

        item.appendChild(colorBox);
        item.appendChild(text);
        legend.appendChild(item);
    });

    return legend;
}
