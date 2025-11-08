/**
 * Collision detection utilities for 3D objects
 */
import * as THREE from '../three.module.js';

/**
 * Check if a position/object collides with any placed objects
 * @param {THREE.Box3} boundingBox - Bounding box to check
 * @param {Array<THREE.Object3D>} placedObjects - Array of placed objects
 * @param {THREE.Object3D} [excludeObject] - Object to exclude from collision check
 * @returns {boolean} True if collision detected
 */
export function checkCollision(boundingBox, placedObjects, excludeObject = null) {
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
