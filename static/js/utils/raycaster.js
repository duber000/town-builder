/**
 * Raycasting utilities for 3D object interaction
 */
import * as THREE from '../three.module.js';

/**
 * Get mouse coordinates in normalized device coordinates (-1 to +1)
 * @param {MouseEvent} event - Mouse event
 * @param {HTMLElement} element - Canvas element
 * @returns {THREE.Vector2} Normalized mouse coordinates
 */
export function getMouseCoordinates(event, element) {
    const rect = element.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    return mouse;
}

/**
 * Find the root object in the scene hierarchy
 * @param {THREE.Object3D} obj - Child object
 * @param {Array<THREE.Object3D>} placedObjects - Array of placed objects
 * @returns {THREE.Object3D} Root object
 */
export function findRootObject(obj, placedObjects) {
    while (obj.parent && !placedObjects.includes(obj)) {
        obj = obj.parent;
    }
    return obj;
}
