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
 * Main animation loop
 * Enhanced with Timer class for consistent physics regardless of frame rate
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

// Re-export disposeObject and loadModel for backwards compatibility
export { disposeObject, loadModel };
