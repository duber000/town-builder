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

// Configuration constants
const MODELS_BASE_URL = '/static/models';
const MODEL_CACHE_SIZE = 50; // Maximum number of models to cache
const MODEL_EXISTS_BLOOM_SIZE = 200; // Expected number of existing models
const MODEL_NOT_FOUND_BLOOM_SIZE = 100; // Expected number of 404 models
const BLOOM_FALSE_POSITIVE_RATE = 0.01; // 1% false positive rate

// Track active loaders for abort functionality (new in three.js r179)
const activeLoaders = new Map();

/**
 * Disposal callback for LRU cache eviction
 * Properly disposes of THREE.js resources when models are evicted from cache
 * @param {string} key - Cache key (category/modelName)
 * @param {THREE.Object3D} scene - THREE.js scene to dispose
 */
function disposeModelScene(key, scene) {
    if (!scene || typeof scene.traverse !== 'function') {
        return;
    }

    // Traverse the scene and dispose of all geometries, materials, and textures
    scene.traverse(obj => {
        // Dispose geometry
        if (obj.geometry) {
            obj.geometry.dispose();
        }

        // Dispose materials
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(material => disposeMaterial(material));
            } else {
                disposeMaterial(obj.material);
            }
        }
    });

    console.log(`LRU cache evicted and disposed model: ${key}`);
}

/**
 * Dispose a single THREE.js material and its textures
 * @param {THREE.Material} material - Material to dispose
 */
function disposeMaterial(material) {
    // Dispose all texture properties
    const textureProperties = ['map', 'lightMap', 'bumpMap', 'normalMap', 'specularMap',
                               'envMap', 'alphaMap', 'aoMap', 'displacementMap',
                               'emissiveMap', 'gradientMap', 'metalnessMap', 'roughnessMap'];

    textureProperties.forEach(prop => {
        if (material[prop] && material[prop].dispose) {
            material[prop].dispose();
        }
    });

    // Dispose the material itself
    material.dispose();
}

// LRU cache for loaded models (limit to MODEL_CACHE_SIZE to save memory)
// Each entry stores the ORIGINAL scene from GLTF (not cloned)
// Cloning happens only when creating instances to avoid double-clone overhead
// Note: Geometries and materials are shared between instances (THREE.js default behavior)
// Now includes disposal callback to prevent memory leaks when evicting models
const modelCache = new LRUCache(MODEL_CACHE_SIZE, disposeModelScene);

// Bloom filter for model existence (reduces failed load attempts)
// Tracks models that have been successfully loaded
const modelExistsFilter = new BloomFilter(MODEL_EXISTS_BLOOM_SIZE, BLOOM_FALSE_POSITIVE_RATE);

// Bloom filter for known non-existent models (reduces retry attempts)
const modelNotFoundFilter = new BloomFilter(MODEL_NOT_FOUND_BLOOM_SIZE, BLOOM_FALSE_POSITIVE_RATE);

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

        // Bloom filter: Use as hint only, not hard rejection
        // False positives (1% rate) could incorrectly block valid models
        // Instead, we log a warning and attempt the load anyway
        if (modelNotFoundFilter.has(cacheKey)) {
            console.warn(`Model ${cacheKey} may not exist (bloom filter hint), attempting load anyway...`);
        }

        // LRU Cache: Check if model is already loaded
        if (!options.bypassCache && modelCache.has(cacheKey)) {
            const cachedScene = modelCache.get(cacheKey);

            // Clone the cached scene to create a new instance
            // THREE.js clone() shares geometries and materials by default (memory efficient)
            const modelInstance = cachedScene.clone();
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

            // Cache the ORIGINAL scene for reuse
            // Store a clean copy in cache, use a clone for this instance
            modelCache.set(cacheKey, gltf.scene);

            // Add to existence bloom filter
            modelExistsFilter.add(cacheKey);

            // Clone for this instance to avoid modifying the cached version
            // THREE.js clone() shares geometries/materials (memory efficient)
            const modelInstance = gltf.scene.clone();
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
        }, undefined, err => {
            // Remove loader from active tracking
            activeLoaders.delete(loaderId);

            // Distinguish between user abort and actual error
            if (err.message && err.message.includes('abort')) {
                // User intentionally aborted - this is not an error condition
                reject(new Error('ABORTED'));
            } else {
                // Add to not-found bloom filter to reduce retry attempts
                // Note: Bloom filter is used as a hint only, not a hard rejection
                if (err.message && (err.message.includes('404') || err.message.includes('Not Found'))) {
                    modelNotFoundFilter.add(cacheKey);
                    // Provide user-friendly error message
                    reject(new Error(`Model not found: ${category}/${modelName}`));
                } else {
                    // Other error types (network, parsing, etc.)
                    reject(new Error(`Failed to load model ${category}/${modelName}: ${err.message}`));
                }
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

    // Bloom filter hint (not a hard rejection)
    if (modelNotFoundFilter.has(cacheKey)) {
        console.warn(`Preload: Model ${cacheKey} may not exist (bloom filter hint), attempting anyway...`);
    }

    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        const url = `${MODELS_BASE_URL}/${category}/${modelName}`;

        loader.load(url, gltf => {
            // Cache the original scene (not cloned)
            modelCache.set(cacheKey, gltf.scene);
            modelExistsFilter.add(cacheKey);
            resolve();
        }, undefined, err => {
            // Add to bloom filter hint (not a hard rejection for future attempts)
            if (err.message && (err.message.includes('404') || err.message.includes('Not Found'))) {
                modelNotFoundFilter.add(cacheKey);
                reject(new Error(`Model not found: ${category}/${modelName}`));
            } else {
                reject(new Error(`Failed to preload model ${category}/${modelName}: ${err.message}`));
            }
        });
    });
}
