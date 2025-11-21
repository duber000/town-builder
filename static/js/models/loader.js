/**
 * 3D model loading utilities
 * Enhanced with r181 features:
 * - Loader abort support for better UX
 * - Improved error handling
 */
import * as THREE from '../three.module.js';
import { GLTFLoader } from '../three/examples/jsm/loaders/GLTFLoader.js';
import { updateBoundingBox } from './collision.js';
import { updateSpatialGrid, isPhysicsWasmReady } from '../utils/physics_wasm.js';

const MODELS_BASE_URL = '/static/models';

// Track active loaders for abort functionality (new in three.js r179)
const activeLoaders = new Map();

/**
 * Load a 3D model and add it to the scene
 * Enhanced with abort support to cancel pending loads when rapidly switching models
 *
 * @param {THREE.Scene} scene - Three.js scene
 * @param {Array<THREE.Object3D>} placedObjects - Array to track placed objects
 * @param {Array<THREE.Object3D>} movingCars - Array to track moving cars
 * @param {string} category - Model category (e.g., "buildings", "vehicles")
 * @param {string} modelName - Model filename
 * @param {THREE.Vector3} [position] - Optional position to place the model
 * @param {Object} [options] - Loading options
 * @param {string} [options.loaderId] - Unique ID for this load operation (for abort support)
 * @returns {Promise<THREE.Object3D>} The loaded model
 */
export async function loadModel(scene, placedObjects, movingCars, category, modelName, position, options = {}) {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        const url = `${MODELS_BASE_URL}/${category}/${modelName}`;
        const loaderId = options.loaderId || `${category}-${modelName}-${Date.now()}`;

        // Store loader reference for potential abort
        activeLoaders.set(loaderId, loader);

        loader.load(url, gltf => {
            // Remove loader from active tracking
            activeLoaders.delete(loaderId);

            gltf.scene.userData = { category, modelName };

            if (position) {
                gltf.scene.position.copy(position);
            }

            // Initialize bounding box for the object
            updateBoundingBox(gltf.scene);

            scene.add(gltf.scene);
            placedObjects.push(gltf.scene);

            // If it's a vehicle, configure it as a moving car
            if (gltf.scene.userData.category === 'vehicles') {
                configureVehicle(gltf.scene, movingCars);
            }

            // Update WASM spatial grid with new object
            if (isPhysicsWasmReady()) {
                updateSpatialGrid(placedObjects);
            }

            resolve(gltf.scene);
        }, undefined, err => {
            // Remove loader from active tracking
            activeLoaders.delete(loaderId);

            // Distinguish between user abort and actual error
            if (err.message && err.message.includes('abort')) {
                // User intentionally aborted - this is not an error condition
                reject(new Error('ABORTED'));
            } else {
                reject(err);
            }
        });
    });
}

/**
 * Configure a vehicle object with movement properties
 * @param {THREE.Object3D} vehicle - The vehicle object
 * @param {Array<THREE.Object3D>} movingCars - Array to track moving cars
 */
function configureVehicle(vehicle, movingCars) {
    vehicle.userData.defaultSpeed = 0.05;
    vehicle.userData.currentSpeed = vehicle.userData.defaultSpeed;

    // Specific behavior for police car
    if (vehicle.userData.modelName === 'car_police.gltf') {
        vehicle.userData.behavior = 'chase';
        vehicle.userData.targetType = 'car_hatchback.gltf';
        vehicle.userData.maxChaseSpeed = 0.12;
        vehicle.userData.acceleration = 0.0005;
        vehicle.userData.turnSpeedFactor = 0.03;
        vehicle.userData.tailingDistance = 6;
    } else {
        // Generic vehicle settings
        vehicle.userData.maxChaseSpeed = vehicle.userData.defaultSpeed;
        vehicle.userData.acceleration = 0.0005;
        vehicle.userData.turnSpeedFactor = 0.05;
        vehicle.userData.tailingDistance = 0;
    }

    // Ensure bounding box is updated after position change
    updateBoundingBox(vehicle);
    movingCars.push(vehicle);
}

/**
 * Abort a specific loader operation
 * Utilizes the new abort() method introduced in three.js r179
 *
 * @param {string} loaderId - The ID of the loader to abort
 * @returns {boolean} True if loader was found and aborted, false otherwise
 */
export function abortLoader(loaderId) {
    const loader = activeLoaders.get(loaderId);
    if (loader && typeof loader.abort === 'function') {
        loader.abort();
        activeLoaders.delete(loaderId);
        return true;
    }
    return false;
}

/**
 * Abort all active loader operations
 * Useful when clearing the scene or switching modes
 *
 * @returns {number} Number of loaders aborted
 */
export function abortAllLoaders() {
    let count = 0;
    activeLoaders.forEach((loader, loaderId) => {
        if (typeof loader.abort === 'function') {
            loader.abort();
            count++;
        }
    });
    activeLoaders.clear();
    return count;
}

/**
 * Get the number of active loader operations
 * Useful for showing loading indicators
 *
 * @returns {number} Number of active loaders
 */
export function getActiveLoaderCount() {
    return activeLoaders.size;
}
