/**
 * Main scene orchestrator - coordinates all scene components
 */
import { wasmReady } from './utils/wasm.js';
import * as THREE from './three.module.js';
import { updateControls } from './controls.js';
import { getCurrentMode, showNotification, activateDriveModeUI, deactivateDriveModeUI } from './ui.js';
import { initScene, setupResizeListener } from './scene/scene.js';
import { loadModel } from './models/loader.js';
import { createPlacementIndicator, updatePlacementIndicator, isPlacementValid } from './models/placement.js';
import { updateMovingCars, updateDrivingCamera } from './physics/car.js';
import { disposeObject } from './utils/disposal.js';
import { getMouseCoordinates, findRootObject } from './utils/raycaster.js';
import { updateSpatialGrid, isPhysicsWasmReady } from './utils/physics_wasm.js';

// Scene state
export let scene, camera, renderer, groundPlane, placementIndicator;
export let placedObjects = [];
export let movingCars = [];

// Spatial grid update tracking
let frameCounter = 0;
const SPATIAL_GRID_UPDATE_INTERVAL = 10; // Update every 10 frames

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
 * Handle mouse movement for placement indicator
 */
function handleMouseMove(event) {
    const mode = getCurrentMode();
    if (mode !== 'place' || !groundPlane) {
        if (placementIndicator) placementIndicator.visible = false;
        return;
    }

    updatePlacementIndicator(
        event,
        placementIndicator,
        groundPlane,
        camera,
        renderer.domElement,
        placedObjects
    );
}

/**
 * Main animation loop
 */
export async function animate() {
    await wasmReady;
    requestAnimationFrame(animate);

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

// Re-export disposeObject for backwards compatibility
export { disposeObject };
