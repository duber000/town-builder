/**
 * 3D model loading utilities
 */
import * as THREE from '../three.module.js';
import { GLTFLoader } from '../three/examples/jsm/loaders/GLTFLoader.js';
import { updateBoundingBox } from './collision.js';

const MODELS_BASE_URL = '/static/models';

/**
 * Load a 3D model and add it to the scene
 * @param {THREE.Scene} scene - Three.js scene
 * @param {Array<THREE.Object3D>} placedObjects - Array to track placed objects
 * @param {Array<THREE.Object3D>} movingCars - Array to track moving cars
 * @param {string} category - Model category (e.g., "buildings", "vehicles")
 * @param {string} modelName - Model filename
 * @param {THREE.Vector3} [position] - Optional position to place the model
 * @returns {Promise<THREE.Object3D>} The loaded model
 */
export async function loadModel(scene, placedObjects, movingCars, category, modelName, position) {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        const url = `${MODELS_BASE_URL}/${category}/${modelName}`;

        loader.load(url, gltf => {
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

            resolve(gltf.scene);
        }, undefined, err => {
            reject(err);
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
