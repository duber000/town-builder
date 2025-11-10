/**
 * Collision detection utilities for 3D objects
 * Optimized with Go 1.24 WASM spatial grid
 */
import * as THREE from '../three.module.js';
import {
    checkCollision as wasmCheckCollision,
    isPhysicsWasmReady
} from '../utils/physics_wasm.js';

/**
 * Check if a position/object collides with any placed objects
 * Uses WASM spatial grid for O(n log n) performance when available
 * @param {THREE.Box3} boundingBox - Bounding box to check
 * @param {Array<THREE.Object3D>} placedObjects - Array of placed objects
 * @param {THREE.Object3D} [excludeObject] - Object to exclude from collision check
 * @returns {boolean} True if collision detected
 */
export function checkCollision(boundingBox, placedObjects, excludeObject = null) {
    // Try WASM-accelerated collision detection first
    if (isPhysicsWasmReady() && excludeObject) {
        const collisions = wasmCheckCollision(excludeObject);
        if (collisions && collisions.length > 0) {
            // Filter out road segments
            for (const id of collisions) {
                const obj = placedObjects.find(o => o.id === id);
                if (obj && obj.userData.modelName && !obj.userData.modelName.includes('road_')) {
                    return true;
                }
            }
            return false;
        }
    }

    // Fallback to JavaScript O(n) collision detection
    return checkCollisionJS(boundingBox, placedObjects, excludeObject);
}

/**
 * JavaScript fallback collision detection
 * @private
 */
function checkCollisionJS(boundingBox, placedObjects, excludeObject = null) {
    for (const otherObject of placedObjects) {
        if (otherObject === excludeObject) continue;

        // Skip collision check if the other object is a road segment
        if (otherObject.userData.modelName && otherObject.userData.modelName.includes('road_')) {
            continue;
        }

        if (!otherObject.userData.boundingBox) {
            otherObject.userData.boundingBox = new THREE.Box3().setFromObject(otherObject);
        }

        if (boundingBox.intersectsBox(otherObject.userData.boundingBox)) {
            return true;
        }
    }
    return false;
}

/**
 * Initialize or update bounding box for an object
 * @param {THREE.Object3D} object - Object to update
 */
export function updateBoundingBox(object) {
    if (!object.userData.boundingBox) {
        object.userData.boundingBox = new THREE.Box3();
    }
    object.userData.boundingBox.setFromObject(object);
}
