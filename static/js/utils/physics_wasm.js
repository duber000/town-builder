/**
 * Physics WASM Integration
 *
 * Provides high-performance spatial partitioning and collision detection
 * using Go 1.24+ WASM with Swiss Tables and other optimizations.
 *
 * Features:
 * - Spatial grid for O(k) collision detection (vs O(n²))
 * - Batch collision checking
 * - Fast nearest-object search
 * - Radius-based queries
 * - Circular buffer for performance metrics (sliding window)
 *
 * Go 1.24 Performance Improvements (enabled by default):
 * - Swiss Tables: 30% faster map access, 35% faster assignment, 10-60% faster iteration
 * - SpinbitMutex: Enhanced mutex performance
 * - Better stack allocation for small slices (reduced heap pressure)
 * - Improved small object allocation
 */

import { CircularBuffer } from './data_structures.js';

let physicsWasmReady = false;
let physicsWasmEnabled = false;

/**
 * Check if physics WASM module is loaded and ready
 */
export function isPhysicsWasmReady() {
    return physicsWasmReady;
}

/**
 * Validate that a WASM function exists and is callable
 * @param {string} funcName - Name of the WASM function to check
 * @returns {boolean} True if function is available
 */
function validateWasmFunction(funcName) {
    return typeof window[funcName] === 'function';
}

/**
 * Initialize physics WASM module
 * Falls back gracefully if module isn't available
 */
export async function initPhysicsWasm() {
    try {
        // Check if required WASM functions are available
        const requiredFunctions = [
            'wasmUpdateSpatialGrid',
            'wasmCheckCollision',
            'wasmBatchCheckCollisions',
            'wasmFindNearestObject',
            'wasmFindObjectsInRadius',
            'wasmGetGridStats'
        ];

        const allFunctionsAvailable = requiredFunctions.every(validateWasmFunction);

        if (allFunctionsAvailable) {
            physicsWasmReady = true;
            physicsWasmEnabled = true;
            console.log('✓ Physics WASM module ready (Go 1.24+ with Swiss Tables)');

            // Log grid stats for debugging
            try {
                const stats = window.wasmGetGridStats();
                console.log('  Spatial grid initialized:', stats);
            } catch (err) {
                console.warn('  Could not retrieve initial grid stats:', err.message);
            }

            return true;
        } else {
            const missingFunctions = requiredFunctions.filter(fn => !validateWasmFunction(fn));
            console.log('Physics WASM not fully loaded, using JavaScript fallback');
            console.log('  Missing functions:', missingFunctions.join(', '));
            physicsWasmReady = false;
            physicsWasmEnabled = false;
            return false;
        }
    } catch (error) {
        console.warn('Physics WASM initialization failed:', error);
        physicsWasmReady = false;
        physicsWasmEnabled = false;
        return false;
    }
}

/**
 * Serialize THREE.js object to WASM-compatible format
 */
function serializeObject(object, index) {
    const bbox = object.userData.boundingBox;

    if (!bbox) {
        // Create bounding box if it doesn't exist
        const box = new THREE.Box3().setFromObject(object);
        object.userData.boundingBox = box;
    }

    const box = object.userData.boundingBox;
    const position = object.position;

    return {
        id: object.id || index,
        x: position.x,
        y: position.z, // Use Z for 2D spatial grid
        bbox: {
            minX: position.x + box.min.x,
            minY: position.z + box.min.z,
            maxX: position.x + box.max.x,
            maxY: position.z + box.max.z,
        },
        category: object.userData.category || 'unknown'
    };
}

/**
 * Update spatial grid with current scene objects
 * Call this when objects are added, removed, or moved significantly
 *
 * @param {Array<THREE.Object3D>} objects - Array of scene objects
 * @returns {boolean} Success status
 */
export function updateSpatialGrid(objects) {
    if (!physicsWasmEnabled) {
        return false;
    }

    // Validate WASM function exists
    if (!validateWasmFunction('wasmUpdateSpatialGrid')) {
        console.error('wasmUpdateSpatialGrid function not available');
        physicsWasmEnabled = false;
        return false;
    }

    try {
        const serialized = objects.map((obj, idx) => serializeObject(obj, idx));
        const result = window.wasmUpdateSpatialGrid(serialized);

        // Validate result
        if (result === undefined || result === null) {
            console.error('wasmUpdateSpatialGrid returned invalid result');
            return false;
        }

        return result;
    } catch (error) {
        console.error('Error updating spatial grid:', error);
        console.error('  Stack:', error.stack);
        // Disable WASM on crash to prevent repeated errors
        physicsWasmEnabled = false;
        return false;
    }
}

/**
 * Check collisions for a single object
 * Uses spatial grid for O(k) complexity where k = nearby objects
 *
 * @param {THREE.Object3D} object - Object to check collisions for
 * @returns {Array<number>} Array of colliding object IDs, or null if WASM unavailable
 */
export function checkCollision(object) {
    if (!physicsWasmEnabled) {
        return null; // Caller should fall back to JavaScript implementation
    }

    // Validate WASM function exists
    if (!validateWasmFunction('wasmCheckCollision')) {
        console.error('wasmCheckCollision function not available');
        physicsWasmEnabled = false;
        return null;
    }

    try {
        const bbox = object.userData.boundingBox;
        if (!bbox) {
            return [];
        }

        const position = object.position;
        const bboxData = {
            minX: position.x + bbox.min.x,
            minY: position.z + bbox.min.z,
            maxX: position.x + bbox.max.x,
            maxY: position.z + bbox.max.z,
        };

        const collisions = window.wasmCheckCollision(object.id, bboxData);

        // Validate result is an array
        if (!Array.isArray(collisions)) {
            console.error('wasmCheckCollision returned non-array result');
            return [];
        }

        return collisions;
    } catch (error) {
        console.error('Error checking collision:', error);
        console.error('  Stack:', error.stack);
        physicsWasmEnabled = false;
        return [];
    }
}

/**
 * Batch check collisions for multiple objects
 * More efficient than calling checkCollision multiple times
 *
 * @param {Array<THREE.Object3D>} objects - Objects to check
 * @returns {Array<{id: number, collisions: Array<number>}>} Collision results, or null if WASM unavailable
 */
export function batchCheckCollisions(objects) {
    if (!physicsWasmEnabled) {
        return null;
    }

    // Validate WASM function exists
    if (!validateWasmFunction('wasmBatchCheckCollisions')) {
        console.error('wasmBatchCheckCollisions function not available');
        physicsWasmEnabled = false;
        return null;
    }

    try {
        const checks = objects.map(obj => {
            const bbox = obj.userData.boundingBox;
            const position = obj.position;

            return {
                id: obj.id,
                bbox: {
                    minX: position.x + bbox.min.x,
                    minY: position.z + bbox.min.z,
                    maxX: position.x + bbox.max.x,
                    maxY: position.z + bbox.max.z,
                }
            };
        });

        const results = window.wasmBatchCheckCollisions(checks);

        // Validate result is an array
        if (!Array.isArray(results)) {
            console.error('wasmBatchCheckCollisions returned non-array result');
            return null;
        }

        return results;
    } catch (error) {
        console.error('Error in batch collision check:', error);
        console.error('  Stack:', error.stack);
        physicsWasmEnabled = false;
        return null;
    }
}

/**
 * Find nearest object of a specific category
 * Uses Go 1.24 fast map iteration
 *
 * @param {number} x - X position
 * @param {number} z - Z position (Y in WASM 2D grid)
 * @param {string} category - Object category to search for
 * @param {number} maxDistance - Maximum search distance
 * @returns {{id: number, distance: number} | null} Nearest object or null
 */
export function findNearestObject(x, z, category, maxDistance = Infinity) {
    if (!physicsWasmEnabled) {
        return null;
    }

    // Validate WASM function exists
    if (!validateWasmFunction('wasmFindNearestObject')) {
        console.error('wasmFindNearestObject function not available');
        physicsWasmEnabled = false;
        return null;
    }

    try {
        const result = window.wasmFindNearestObject(x, z, category, maxDistance);

        // Result can be null (valid - no object found) or an object
        if (result !== null && typeof result !== 'object') {
            console.error('wasmFindNearestObject returned invalid result type');
            return null;
        }

        return result;
    } catch (error) {
        console.error('Error finding nearest object:', error);
        console.error('  Stack:', error.stack);
        physicsWasmEnabled = false;
        return null;
    }
}

/**
 * Find all objects within a radius
 * Uses spatial grid for efficient area queries
 *
 * @param {number} x - X position
 * @param {number} z - Z position (Y in WASM 2D grid)
 * @param {number} radius - Search radius
 * @param {string} category - Optional category filter
 * @returns {Array<{id: number, distance: number}>} Objects within radius, or null if WASM unavailable
 */
export function findObjectsInRadius(x, z, radius, category = null) {
    if (!physicsWasmEnabled) {
        return null;
    }

    // Validate WASM function exists
    if (!validateWasmFunction('wasmFindObjectsInRadius')) {
        console.error('wasmFindObjectsInRadius function not available');
        physicsWasmEnabled = false;
        return null;
    }

    try {
        const results = window.wasmFindObjectsInRadius(x, z, radius, category);

        // Validate result is an array
        if (!Array.isArray(results)) {
            console.error('wasmFindObjectsInRadius returned non-array result');
            return [];
        }

        return results;
    } catch (error) {
        console.error('Error finding objects in radius:', error);
        console.error('  Stack:', error.stack);
        physicsWasmEnabled = false;
        return [];
    }
}

/**
 * Get spatial grid statistics for debugging
 *
 * @returns {{cellCount: number, objectCount: number, avgObjectsPerCell: number, boundaryHitCount: number} | null}
 */
export function getGridStats() {
    if (!physicsWasmEnabled) {
        return null;
    }

    // Validate WASM function exists
    if (!validateWasmFunction('wasmGetGridStats')) {
        console.error('wasmGetGridStats function not available');
        physicsWasmEnabled = false;
        return null;
    }

    try {
        const stats = window.wasmGetGridStats();

        // Validate result is an object
        if (typeof stats !== 'object' || stats === null) {
            console.error('wasmGetGridStats returned invalid result');
            return null;
        }

        return stats;
    } catch (error) {
        console.error('Error getting grid stats:', error);
        console.error('  Stack:', error.stack);
        physicsWasmEnabled = false;
        return null;
    }
}

/**
 * Performance monitoring utility
 * Uses circular buffers for O(1) insertion and efficient memory usage
 */
export class PerformanceMonitor {
    constructor(capacity = 100) {
        this.metrics = {
            updateGrid: new CircularBuffer(capacity),
            checkCollision: new CircularBuffer(capacity),
            batchCollision: new CircularBuffer(capacity),
            findNearest: new CircularBuffer(capacity),
        };
    }

    /**
     * Record a performance measurement
     * O(1) operation using circular buffer
     */
    record(operation, duration) {
        if (this.metrics[operation]) {
            this.metrics[operation].push(duration);
        }
    }

    /**
     * Get statistics for an operation
     * Uses sliding window of last N measurements
     */
    getStats(operation) {
        const buffer = this.metrics[operation];
        if (!buffer || buffer.isEmpty()) {
            return null;
        }

        const data = buffer.toArray();
        const sorted = [...data].sort((a, b) => a - b);
        const avg = buffer.average();
        const median = sorted[Math.floor(sorted.length / 2)];
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        const p99 = sorted[Math.floor(sorted.length * 0.99)];

        return {
            count: buffer.getSize(),
            avg: avg.toFixed(3),
            median: median.toFixed(3),
            p95: p95.toFixed(3),
            p99: p99.toFixed(3),
            min: buffer.min().toFixed(3),
            max: buffer.max().toFixed(3),
        };
    }

    getAllStats() {
        return {
            updateGrid: this.getStats('updateGrid'),
            checkCollision: this.getStats('checkCollision'),
            batchCollision: this.getStats('batchCollision'),
            findNearest: this.getStats('findNearest'),
        };
    }

    /**
     * Clear all metrics
     */
    clear() {
        Object.values(this.metrics).forEach(buffer => buffer.clear());
    }

    /**
     * Get rolling average for an operation
     */
    getRollingAverage(operation) {
        const buffer = this.metrics[operation];
        return buffer ? buffer.average() : 0;
    }

    logStats() {
        console.log('Physics WASM Performance Stats (ms):');
        console.table(this.getAllStats());

        const gridStats = getGridStats();
        if (gridStats) {
            console.log('Spatial Grid Stats:', gridStats);
        }
    }
}

// Global performance monitor instance
export const perfMonitor = new PerformanceMonitor();

/**
 * Wrapped functions with performance monitoring
 */
export function updateSpatialGridTimed(objects) {
    const start = performance.now();
    const result = updateSpatialGrid(objects);
    const duration = performance.now() - start;
    perfMonitor.record('updateGrid', duration);
    return result;
}

export function checkCollisionTimed(object) {
    const start = performance.now();
    const result = checkCollision(object);
    const duration = performance.now() - start;
    perfMonitor.record('checkCollision', duration);
    return result;
}

export function batchCheckCollisionsTimed(objects) {
    const start = performance.now();
    const result = batchCheckCollisions(objects);
    const duration = performance.now() - start;
    perfMonitor.record('batchCollision', duration);
    return result;
}

export function findNearestObjectTimed(x, z, category, maxDistance) {
    const start = performance.now();
    const result = findNearestObject(x, z, category, maxDistance);
    const duration = performance.now() - start;
    perfMonitor.record('findNearest', duration);
    return result;
}
