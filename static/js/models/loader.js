/**
 * 3D model loading utilities
 * Enhanced with r181 features:
 * - Loader abort support for better UX
 * - Improved error handling
 * - LRU cache for model geometry (reduces redundant loads)
 * - Bloom filter for fast existence checks (reduces failed load attempts)
 */
import * as THREE from '../three.module.js';
import { GLTFLoader } from '../three/examples/jsm/loaders/GLTFLoader.js';
import { updateBoundingBox } from './collision.js';
import { updateSpatialGrid, isPhysicsWasmReady } from '../utils/physics_wasm.js';
import { LRUCache, BloomFilter } from '../utils/data_structures.js';

const MODELS_BASE_URL = '/static/models';

// Track active loaders for abort functionality (new in three.js r179)
const activeLoaders = new Map();

// LRU cache for loaded models (limit to 50 models to save memory)
// Each entry stores the cloned scene from GLTF
const modelCache = new LRUCache(50);

// Bloom filter for model existence (reduces failed load attempts)
// Tracks models that have been successfully loaded
const modelExistsFilter = new BloomFilter(200, 0.01); // 200 expected models, 1% false positive rate

// Bloom filter for known non-existent models (reduces retry attempts)
const modelNotFoundFilter = new BloomFilter(100, 0.01);

/**
 * Load a 3D model and add it to the scene
 * Enhanced with abort support to cancel pending loads when rapidly switching models
 * Now includes LRU caching and Bloom filter optimization
 *
 * @param {THREE.Scene} scene - Three.js scene
 * @param {Array<THREE.Object3D>} placedObjects - Array to track placed objects
 * @param {Array<THREE.Object3D>} movingCars - Array to track moving cars
 * @param {string} category - Model category (e.g., "buildings", "vehicles")
 * @param {string} modelName - Model filename
 * @param {THREE.Vector3} [position] - Optional position to place the model
 * @param {Object} [options] - Loading options
 * @param {string} [options.loaderId] - Unique ID for this load operation (for abort support)
 * @param {boolean} [options.bypassCache] - If true, bypass LRU cache and force reload
 * @returns {Promise<THREE.Object3D>} The loaded model
 */
export async function loadModel(scene, placedObjects, movingCars, category, modelName, position, options = {}) {
    return new Promise((resolve, reject) => {
        const url = `${MODELS_BASE_URL}/${category}/${modelName}`;
        const cacheKey = `${category}/${modelName}`;
        const loaderId = options.loaderId || `${category}-${modelName}-${Date.now()}`;

        // Bloom filter: Quick check if model definitely doesn't exist
        if (modelNotFoundFilter.has(cacheKey)) {
            reject(new Error(`Model ${cacheKey} is known to not exist (Bloom filter)`));
            return;
        }

        // LRU Cache: Check if model is already loaded
        if (!options.bypassCache && modelCache.has(cacheKey)) {
            const cachedModel = modelCache.get(cacheKey);

            // Clone the cached model to create a new instance
            const modelInstance = cachedModel.clone();
            modelInstance.userData = { category, modelName };

            if (position) {
                modelInstance.position.copy(position);
            }

            // Initialize bounding box for the object
            updateBoundingBox(modelInstance);

            scene.add(modelInstance);
            placedObjects.push(modelInstance);

            // If it's a vehicle, configure it as a moving car
            if (modelInstance.userData.category === 'vehicles') {
                configureVehicle(modelInstance, movingCars);
            }

            // Update WASM spatial grid with new object
            if (isPhysicsWasmReady()) {
                updateSpatialGrid(placedObjects);
            }

            resolve(modelInstance);
            return;
        }

        // Cache miss or bypass - load from server
        const loader = new GLTFLoader();

        // Store loader reference for potential abort
        activeLoaders.set(loaderId, loader);

        loader.load(url, gltf => {
            // Remove loader from active tracking
            activeLoaders.delete(loaderId);

            // Cache the loaded model for future use
            modelCache.set(cacheKey, gltf.scene.clone());

            // Add to existence bloom filter
            modelExistsFilter.add(cacheKey);

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
                // Add to not-found bloom filter to avoid retrying
                if (err.message && (err.message.includes('404') || err.message.includes('Not Found'))) {
                    modelNotFoundFilter.add(cacheKey);
                }
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

/**
 * Get model cache statistics
 * Useful for monitoring cache performance
 *
 * @returns {Object} Cache statistics
 */
export function getCacheStats() {
    return {
        lruCache: modelCache.getStats(),
        existsBloomFilter: modelExistsFilter.getStats(),
        notFoundBloomFilter: modelNotFoundFilter.getStats()
    };
}

/**
 * Clear the model cache
 * Useful for freeing memory or forcing fresh loads
 *
 * @param {boolean} [clearBloomFilters=false] - Also clear bloom filters
 */
export function clearModelCache(clearBloomFilters = false) {
    modelCache.clear();

    if (clearBloomFilters) {
        modelExistsFilter.clear();
        modelNotFoundFilter.clear();
    }
}

/**
 * Preload a model into cache without adding to scene
 * Useful for preloading commonly used models
 *
 * @param {string} category - Model category
 * @param {string} modelName - Model filename
 * @returns {Promise<void>}
 */
export async function preloadModel(category, modelName) {
    const cacheKey = `${category}/${modelName}`;

    // Already cached
    if (modelCache.has(cacheKey)) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        const url = `${MODELS_BASE_URL}/${category}/${modelName}`;

        loader.load(url, gltf => {
            modelCache.set(cacheKey, gltf.scene.clone());
            modelExistsFilter.add(cacheKey);
            resolve();
        }, undefined, err => {
            if (err.message && (err.message.includes('404') || err.message.includes('Not Found'))) {
                modelNotFoundFilter.add(cacheKey);
            }
            reject(err);
        });
    });
}
