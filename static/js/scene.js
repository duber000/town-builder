/**
 * Main scene orchestrator - coordinates all scene components
 * Enhanced with r181 features:
 * - Timer class for frame-independent physics
 */
import { wasmReady } from './utils/wasm.js';
import * as THREE from './three.module.js';
import { updateControls } from './controls.js';
import { getCurrentMode, showNotification, activateDriveModeUI, deactivateDriveModeUI, updateLoadingIndicator, updateContextHelp } from './ui.js';
import { initScene, setupResizeListener } from './scene/scene.js';
import { loadModel, abortAllLoaders } from './models/loader.js';
import { createPlacementIndicator, updatePlacementIndicator, isPlacementValid } from './models/placement.js';
import { updateMovingCars, updateDrivingCamera } from './physics/car.js';
import { disposeObject } from './utils/disposal.js';
import { getMouseCoordinates, findRootObject } from './utils/raycaster.js';
import { updateSpatialGrid, isPhysicsWasmReady } from './utils/physics_wasm.js';
import { animateCursors, cleanupInactiveCursors } from './collaborative-cursors.js';
import { sendCursorUpdate } from './network.js';

// Scene state
export let scene, camera, renderer, groundPlane, placementIndicator;
export let placedObjects = [];
export let movingCars = [];

// Animation timing (Timer moved to core in r179)
const timer = new THREE.Timer();

// Spatial grid update tracking
let frameCounter = 0;
const SPATIAL_GRID_UPDATE_INTERVAL = 10; // Update every 10 frames

// Cursor tracking
let lastCursorUpdate = 0;
const CURSOR_UPDATE_INTERVAL = 100; // Send cursor updates every 100ms
let lastMousePosition = { x: 0, y: 0 };
let cursorWorldPosition = new THREE.Vector3();
let cursorCleanupCounter = 0;
const CURSOR_CLEANUP_INTERVAL = 300; // Cleanup inactive cursors every 5 seconds (300 frames at 60fps)

// Frustum culling (sliding window optimization for viewport rendering)
const frustum = new THREE.Frustum();
const frustumMatrix = new THREE.Matrix4();
let enableFrustumCulling = true; // Can be toggled for debugging
let visibleObjects = [];
let culledObjectCount = 0;

// Initialize scene on module load
export function initializeScene() {
    const container = document.getElementById('canvas-container');
    const sceneComponents = initScene(container);

    scene = sceneComponents.scene;
    camera = sceneComponents.camera;
    renderer = sceneComponents.renderer;
    groundPlane = sceneComponents.groundPlane;

    // Create placement indicator
    placementIndicator = createPlacementIndicator(scene);

    // Setup event listeners
    setupResizeListener(camera, renderer);
    renderer.domElement.addEventListener('click', onCanvasClick);
    renderer.domElement.addEventListener('mousemove', handleMouseMove);

    // Setup pending placement model (used by UI)
    window.pendingPlacementModelDetails = null;
}

/**
 * Handle mouse movement for placement indicator and cursor tracking
 */
function handleMouseMove(event) {
    const mode = getCurrentMode();
    
    // Update placement indicator
    if (mode !== 'place' || !groundPlane) {
        if (placementIndicator) placementIndicator.visible = false;
    } else {
        updatePlacementIndicator(
            event,
            placementIndicator,
            groundPlane,
            camera,
            renderer.domElement,
            placedObjects
        );
    }
    
    // Track cursor position for collaborative cursors
    lastMousePosition.x = event.clientX;
    lastMousePosition.y = event.clientY;
    
    // Send cursor updates (throttled)
    const now = Date.now();
    if (now - lastCursorUpdate >= CURSOR_UPDATE_INTERVAL) {
        sendCursorPositionUpdate(event);
        lastCursorUpdate = now;
    }
}

/**
 * Send cursor position update to server
 */
function sendCursorPositionUpdate(event) {
    if (!window.myName || !groundPlane) return;
    
    // Raycast to find cursor position in 3D world
    const mouse = getMouseCoordinates(event, renderer.domElement);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    
    const intersects = raycaster.intersectObject(groundPlane, false);
    if (intersects.length > 0) {
        const point = intersects[0].point;
        cursorWorldPosition.copy(point);
        
        // Send update to server
        sendCursorUpdate(
            window.myName,
            { x: point.x, y: point.y, z: point.z },
            { x: camera.position.x, y: camera.position.y, z: camera.position.z }
        );
    }
}

/**
 * Apply frustum culling to objects (sliding window technique)
 * Only renders objects visible in camera's view frustum
 * Returns count of culled objects
 */
function applyFrustumCulling() {
    if (!enableFrustumCulling) {
        // Ensure all objects are visible if culling is disabled
        placedObjects.forEach(obj => obj.visible = true);
        return 0;
    }

    // Update frustum from camera
    frustumMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(frustumMatrix);

    let culled = 0;
    visibleObjects.length = 0;

    // Check each object against frustum
    for (let i = 0; i < placedObjects.length; i++) {
        const obj = placedObjects[i];

        // Always render the car being driven
        if (obj === window.drivingCar) {
            obj.visible = true;
            visibleObjects.push(obj);
            continue;
        }

        // Check if object's bounding box intersects frustum
        const bbox = obj.userData.boundingBox;
        if (bbox) {
            // Create world-space bounding box
            const worldBox = new THREE.Box3(
                new THREE.Vector3(
                    obj.position.x + bbox.min.x,
                    obj.position.y + bbox.min.y,
                    obj.position.z + bbox.min.z
                ),
                new THREE.Vector3(
                    obj.position.x + bbox.max.x,
                    obj.position.y + bbox.max.y,
                    obj.position.z + bbox.max.z
                )
            );

            if (frustum.intersectsBox(worldBox)) {
                obj.visible = true;
                visibleObjects.push(obj);
            } else {
                obj.visible = false;
                culled++;
            }
        } else {
            // No bounding box - always render (safer default)
            obj.visible = true;
            visibleObjects.push(obj);
        }
    }

    return culled;
}

/**
 * Main animation loop
 * Enhanced with Timer class for consistent physics regardless of frame rate
 * Includes frustum culling for rendering optimization (sliding window)
 */
export async function animate() {
    await wasmReady;
    requestAnimationFrame(animate);

    // Update timer - provides delta time for frame-independent physics
    const deltaTime = timer.getDelta();
    const elapsedTime = timer.getElapsed();

    // Export timing info for physics updates
    window.deltaTime = deltaTime;
    window.elapsedTime = elapsedTime;

    // Update keyboard controls (for driving)
    updateControls();

    // Update moving cars
    updateMovingCars(movingCars, placedObjects, groundPlane, window.drivingCar);

    // Periodically update spatial grid for moving objects
    frameCounter++;
    if (frameCounter >= SPATIAL_GRID_UPDATE_INTERVAL && isPhysicsWasmReady()) {
        updateSpatialGrid(placedObjects);
        frameCounter = 0;
    }

    // Update camera if driving
    if (window.drivingCar) {
        updateDrivingCamera(camera, window.drivingCar);
    }

    // Animate collaborative cursors (pulsing effect)
    animateCursors(deltaTime);

    // Periodically cleanup inactive cursors
    cursorCleanupCounter++;
    if (cursorCleanupCounter >= CURSOR_CLEANUP_INTERVAL) {
        cleanupInactiveCursors(scene);
        cursorCleanupCounter = 0;
    }

    // Apply frustum culling (sliding window technique)
    // Only render objects visible in viewport
    culledObjectCount = applyFrustumCulling();

    // Update loading indicator (shows active model loads)
    updateLoadingIndicator();

    renderer.render(scene, camera);
}

/**
 * Handle canvas click events for placement, deletion, edit, and drive mode
 */
function onCanvasClick(event) {
    const mode = getCurrentMode();
    const mouse = getMouseCoordinates(event, renderer.domElement);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    if (mode === 'drive' && !window.drivingCar) {
        handleDriveModeClick(raycaster);
    } else if (mode === 'place') {
        handlePlaceClick();
    } else if (mode === 'delete' || mode === 'edit') {
        handleDeleteOrEditClick(raycaster, mode);
    }
}

/**
 * Handle drive mode click (select a vehicle to drive)
 */
function handleDriveModeClick(raycaster) {
    const intersects = raycaster.intersectObjects(placedObjects, true);
    if (intersects.length > 0) {
        const selectedObject = findRootObject(intersects[0].object, placedObjects);
        if (selectedObject.userData && selectedObject.userData.category === 'vehicles') {
            activateDriveModeUI(selectedObject);
        } else {
            showNotification('This is not a drivable vehicle. Select a vehicle model.', 'error');
        }
    }
}

/**
 * Handle place mode click (place a model)
 */
function handlePlaceClick() {
    if (placementIndicator && placementIndicator.visible && window.pendingPlacementModelDetails) {
        if (!isPlacementValid(placementIndicator, placedObjects)) {
            showNotification('Cannot place model here, overlaps with another object.', 'error');
            return;
        }

        const { category, modelName } = window.pendingPlacementModelDetails;
        loadModel(scene, placedObjects, movingCars, category, modelName, placementIndicator.position)
            .then(() => {
                showNotification(`Placed ${modelName}`, 'success');
            })
            .catch(err => {
                console.error("Error placing model:", err);
                showNotification('Error placing model', 'error');
            });
    }
}

/**
 * Handle delete or edit mode click
 */
function handleDeleteOrEditClick(raycaster, mode) {
    const intersects = raycaster.intersectObjects(placedObjects, true);
    if (intersects.length > 0) {
        const selected = findRootObject(intersects[0].object, placedObjects);

        if (mode === 'delete') {
            handleDelete(selected);
        } else if (mode === 'edit') {
            window.selectedObject = selected;
            showNotification(`Selected for edit: ${selected.userData.modelName}`, 'info');
            updateContextHelp(); // Update help panel to show edit controls
        }
    }
}

/**
 * Handle object deletion
 */
function handleDelete(object) {
    if (window.drivingCar === object) {
        deactivateDriveModeUI();
    }

    disposeObject(object);
    scene.remove(object);

    const placedIdx = placedObjects.indexOf(object);
    if (placedIdx > -1) placedObjects.splice(placedIdx, 1);

    const movingCarIdx = movingCars.indexOf(object);
    if (movingCarIdx > -1) movingCars.splice(movingCarIdx, 1);

    // Update WASM spatial grid after deletion
    if (isPhysicsWasmReady()) {
        updateSpatialGrid(placedObjects);
    }

    showNotification('Object deleted', 'success');
}

// Export loadModel with scene context for backwards compatibility
export async function loadModelToScene(category, modelName, position) {
    return loadModel(scene, placedObjects, movingCars, category, modelName, position);
}

/**
 * Toggle frustum culling on/off
 * @param {boolean} enabled - Whether to enable frustum culling
 */
export function setFrustumCulling(enabled) {
    enableFrustumCulling = enabled;
    console.log(`Frustum culling ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Get frustum culling statistics
 * @returns {Object} Culling stats
 */
export function getFrustumCullingStats() {
    return {
        enabled: enableFrustumCulling,
        totalObjects: placedObjects.length,
        visibleObjects: visibleObjects.length,
        culledObjects: culledObjectCount,
        cullingPercentage: placedObjects.length > 0
            ? ((culledObjectCount / placedObjects.length) * 100).toFixed(1) + '%'
            : '0%'
    };
}

// Re-export disposeObject and loadModel for backwards compatibility
export { disposeObject, loadModel };
