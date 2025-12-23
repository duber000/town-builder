/**
 * Model placement utilities
 */
import * as THREE from '../three.module.js';
import { checkCollision } from './collision.js';
import { getMouseCoordinates } from '../utils/raycaster.js';

/**
 * Create a placement indicator
 * @param {THREE.Scene} scene - Three.js scene
 * @returns {THREE.Mesh} Placement indicator mesh
 */
export function createPlacementIndicator(scene) {
    const indicatorGeometry = new THREE.CircleGeometry(0.5, 32);
    const indicatorMaterial = new THREE.MeshBasicMaterial({
        color: 0xffea00,
        transparent: true,
        opacity: 0.5
    });
    const placementIndicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    placementIndicator.rotation.x = -Math.PI / 2; // Rotate to lay flat on the ground
    placementIndicator.visible = false;
    scene.add(placementIndicator);
    return placementIndicator;
}

/**
 * Update placement indicator position and check for collisions
 * @param {MouseEvent} event - Mouse event
 * @param {THREE.Mesh} placementIndicator - Placement indicator mesh
 * @param {THREE.Mesh} groundPlane - Ground plane mesh
 * @param {THREE.Camera} camera - Three.js camera
 * @param {HTMLElement} canvasElement - Canvas element
 * @param {Array<THREE.Object3D>} placedObjects - Array of placed objects
 */
export function updatePlacementIndicator(event, placementIndicator, groundPlane, camera, canvasElement, placedObjects) {
    if (!groundPlane) {
        placementIndicator.visible = false;
        return;
    }

    const mouse = getMouseCoordinates(event, canvasElement);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(groundPlane);

    if (intersects.length > 0) {
        placementIndicator.position.copy(intersects[0].point);
        placementIndicator.position.y += 0.01; // Slightly above ground to avoid z-fighting
        placementIndicator.visible = true;

        // Check for collisions
        const pendingObjectGeometry = placementIndicator.geometry;
        if (!pendingObjectGeometry.boundingBox) {
            pendingObjectGeometry.computeBoundingBox();
        }
        const pendingObjectBox = pendingObjectGeometry.boundingBox.clone();
        pendingObjectBox.applyMatrix4(placementIndicator.matrixWorld);

        const collision = checkCollision(pendingObjectBox, placedObjects);

        // Update indicator color based on collision
        if (collision) {
            placementIndicator.material.color.setHex(0xff0000); // Red for collision
        } else {
            placementIndicator.material.color.setHex(0xffea00); // Yellow for no collision
        }
    } else {
        placementIndicator.visible = false;
    }
}

/**
 * Check if placement is valid (no collisions)
 * @param {THREE.Mesh} placementIndicator - Placement indicator mesh
 * @param {Array<THREE.Object3D>} placedObjects - Array of placed objects
 * @returns {boolean} True if placement is valid
 */
export function isPlacementValid(placementIndicator, placedObjects) {
    const pendingObjectGeometry = placementIndicator.geometry;
    if (!pendingObjectGeometry.boundingBox) {
        pendingObjectGeometry.computeBoundingBox();
    }
    const pendingObjectBox = pendingObjectGeometry.boundingBox.clone();
    pendingObjectBox.applyMatrix4(placementIndicator.matrixWorld);

    return !checkCollision(pendingObjectBox, placedObjects);
}
