import * as THREE from './three.module.js';
import { GLTFLoader } from './three/examples/jsm/loaders/GLTFLoader.js'; // Corrected path
import { updateControls } from './controls.js';
import { getCurrentMode } from './ui.js';
import { showNotification } from './ui.js';

const MODELS_BASE_URL = '/static/models';

export let scene, camera, renderer, controls, groundPlane, placementIndicator, placedObjects = [], movingCars = [];

// Placeholder for model details to be placed. UI should set this.
window.pendingPlacementModelDetails = null;
// window.drivingCar is now declared and managed in ui.js

export function initScene() {
    if (!scene) {
        // Create scene
        scene = new THREE.Scene();
        // Create a rectangle as the background
        const backgroundGeometry = new THREE.PlaneGeometry(20, 20);
        const backgroundMaterial = new THREE.MeshBasicMaterial({ color: 0x87CEEB }); // Sky blue
        const backgroundMesh = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
        backgroundMesh.rotation.x = -Math.PI / 2; // Rotate to lay flat
        scene.add(backgroundMesh);

    // Create camera
    }
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(10, 10, 10);
    camera.lookAt(0, 0, 0);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Add ground plane
    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    const planeMaterial = new THREE.MeshStandardMaterial({ color: 0x2E8B57 }); // Dark green
    groundPlane = new THREE.Mesh(planeGeometry, planeMaterial);
    groundPlane.rotation.x = -Math.PI / 2;
    scene.add(groundPlane);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);

    // Event listeners
    window.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('click', onCanvasClick);
    renderer.domElement.addEventListener('mousemove', handleMouseMove); // Added mousemove listener

    // Initialize placement indicator
    const indicatorGeometry = new THREE.CircleGeometry(0.5, 32); // Example: a circle with radius 0.5
    const indicatorMaterial = new THREE.MeshBasicMaterial({ color: 0xffea00, transparent: true, opacity: 0.5 });
    placementIndicator = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    placementIndicator.rotation.x = -Math.PI / 2; // Rotate to lay flat on the ground
    placementIndicator.visible = false; // Initially hidden
    scene.add(placementIndicator);

    // Initialize other components...
}

function handleMouseMove(event) {
    const mode = getCurrentMode();
    if (mode !== 'place' || !groundPlane) {
        if (placementIndicator) placementIndicator.visible = false;
        return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(groundPlane); // Intersect only with the ground

    if (intersects.length > 0) {
        placementIndicator.position.copy(intersects[0].point);
        placementIndicator.position.y += 0.01; // Slightly above ground to avoid z-fighting
        placementIndicator.visible = true;
    } else {
        placementIndicator.visible = false;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

export function animate() {
    requestAnimationFrame(animate);
    updateControls(); // Handles keyboard input for car/camera

    const groundBoundary = groundPlane.geometry.parameters.width / 2; // e.g., 10 for a 20x20 plane

    // Animate moving cars
    const tempRotationObject = new THREE.Object3D(); // Helper for quaternion calculation

    for (let i = 0; i < movingCars.length; i++) {
        const car = movingCars[i];
        if (window.drivingCar === car) {
            continue; // Skip auto-movement if this car is being driven by the player
        }

        // Decrement teleport cooldown for chasing cars
        if (car.userData.behavior === 'chase' && car.userData.teleportCooldownFrames && car.userData.teleportCooldownFrames > 0) {
            car.userData.teleportCooldownFrames--;
            if (car.userData.teleportCooldownFrames === 0) {
                car.userData.isTeleportedRecently = false;
            }
        }

        // Ensure speed and behavior properties are initialized
        if (car.userData.defaultSpeed === undefined) car.userData.defaultSpeed = 0.05;
        if (car.userData.currentSpeed === undefined) car.userData.currentSpeed = car.userData.defaultSpeed;
        if (car.userData.acceleration === undefined) car.userData.acceleration = 0.0005;
        if (car.userData.turnSpeedFactor === undefined) car.userData.turnSpeedFactor = 0.03;
        if (car.userData.maxChaseSpeed === undefined) car.userData.maxChaseSpeed = car.userData.defaultSpeed; // Default for non-chasers
        if (car.userData.tailingDistance === undefined) car.userData.tailingDistance = 6; // Default for chasers


        let moveDirection = new THREE.Vector3(0, 0, 1); // Default forward
        let actualSpeedThisFrame = car.userData.currentSpeed;

        if (car.userData.behavior === 'chase' && car.userData.targetType) {
            let nearestTarget = null;
            let minDistanceSq = Infinity;

            // Find the nearest target
            for (const potentialTarget of placedObjects) {
                // Check if potentialTarget is the correct model type and not the chaser itself
                // Ensure targetType check uses .gltf
                if (potentialTarget.userData.modelName === car.userData.targetType && potentialTarget !== car) {
                    const distanceSq = car.position.distanceToSquared(potentialTarget.position);
                    if (distanceSq < minDistanceSq) {
                        minDistanceSq = distanceSq;
                        nearestTarget = potentialTarget;
                    }
                }
            }

            if (nearestTarget) {
                const distanceToTarget = car.position.distanceTo(nearestTarget.position);

                // Smooth Turning
                tempRotationObject.position.copy(car.position);
                tempRotationObject.lookAt(nearestTarget.position);
                // tempRotationObject.rotateY(Math.PI); // Removed: Adjust for model's forward axis (+Z) - lookAt handles +Z to target
                
                const targetQuaternion = tempRotationObject.quaternion;
                car.quaternion.slerp(targetQuaternion, car.userData.turnSpeedFactor);

                // Speed Control & Acceleration
                if (distanceToTarget > car.userData.tailingDistance) {
                    car.userData.currentSpeed = Math.min(
                        car.userData.maxChaseSpeed,
                        car.userData.currentSpeed + car.userData.acceleration
                    );
                } else {
                    // Within tailing distance, try to match target speed or slow down
                    let targetSpeed = nearestTarget.userData.currentSpeed !== undefined ? nearestTarget.userData.currentSpeed : car.userData.defaultSpeed;
                    car.userData.currentSpeed = Math.min(car.userData.currentSpeed, targetSpeed);
                    if (distanceToTarget < car.userData.tailingDistance * 0.5) {
                         car.userData.currentSpeed = Math.max(0, car.userData.currentSpeed - car.userData.acceleration * 3); // Brake harder
                    } else {
                         car.userData.currentSpeed = Math.max(car.userData.defaultSpeed * 0.5, car.userData.currentSpeed - car.userData.acceleration);
                    }
                }
                actualSpeedThisFrame = car.userData.currentSpeed;
                moveDirection.set(0, 0, 1).applyQuaternion(car.quaternion);

            } else {
                // No target found, gradually slow down to default speed
                if (car.userData.currentSpeed > car.userData.defaultSpeed) {
                    car.userData.currentSpeed = Math.max(car.userData.defaultSpeed, car.userData.currentSpeed - car.userData.acceleration * 2);
                } else if (car.userData.currentSpeed < car.userData.defaultSpeed) {
                    car.userData.currentSpeed = Math.min(car.userData.defaultSpeed, car.userData.currentSpeed + car.userData.acceleration);
                }
                actualSpeedThisFrame = car.userData.currentSpeed;
                moveDirection.set(0, 0, 1).applyQuaternion(car.quaternion);
            }
        } else {
            // Default straight movement for non-chasers
            actualSpeedThisFrame = car.userData.currentSpeed;
            moveDirection.set(0, 0, 1).applyQuaternion(car.quaternion);
        }
        
        const potentialPosition = car.position.clone().add(moveDirection.clone().multiplyScalar(actualSpeedThisFrame));
        // Boundary check BEFORE object collision check for chasing cars to prevent going off map
        // For chasing cars, if they are about to go out of bounds (and not recently teleported),
        // clamp their potential position to the boundary, re-orient them towards the center, and apply brakes.
        // They will still attempt to move to the clamped position.
        if (car.userData.behavior === 'chase' && !(car.userData.isTeleportedRecently && car.userData.teleportCooldownFrames > 0) ) {
            let isClamped = false;
            if (potentialPosition.x > groundBoundary) { potentialPosition.x = groundBoundary; isClamped = true; }
            else if (potentialPosition.x < -groundBoundary) { potentialPosition.x = -groundBoundary; isClamped = true; }

            if (potentialPosition.z > groundBoundary) { potentialPosition.z = groundBoundary; isClamped = true; }
            else if (potentialPosition.z < -groundBoundary) { potentialPosition.z = -groundBoundary; isClamped = true; }

            if (isClamped) {
                // Re-orient towards the center of the map if about to go off-edge
                const centerOfMap = new THREE.Vector3(0, car.position.y, 0); // Keep current Y
                
                tempRotationObject.position.copy(car.position);
                tempRotationObject.lookAt(centerOfMap);
                // tempRotationObject.rotateY(Math.PI); // Removed: Adjust for model's forward axis (+Z) - lookAt handles +Z to target
                car.quaternion.slerp(tempRotationObject.quaternion, car.userData.turnSpeedFactor * 2); // Turn faster

                car.userData.currentSpeed = Math.max(0, car.userData.currentSpeed - car.userData.acceleration * 5); // Brake
            }
        }
        
        // Update car's bounding box for current position before checking potential
        if (!car.userData.boundingBox) {
            car.userData.boundingBox = new THREE.Box3();
        }
        car.userData.boundingBox.setFromObject(car); // Update to current world space

        const potentialBoundingBox = car.userData.boundingBox.clone();
        potentialBoundingBox.translate(potentialPosition.clone().sub(car.position));

        let collisionDetected = false;
        for (const otherObject of placedObjects) {
            if (otherObject === car) continue; // Don't collide with self

            // Skip collision check if the other object is a road segment
            if (otherObject.userData.modelName && otherObject.userData.modelName.includes('road_')) {
                continue;
            }

            if (!otherObject.userData.boundingBox) { // Ensure other object has a bounding box
                otherObject.userData.boundingBox = new THREE.Box3().setFromObject(otherObject);
            }

            if (potentialBoundingBox.intersectsBox(otherObject.userData.boundingBox)) {
                collisionDetected = true;
                break;
            }
        }

        let attemptedMoveSuccessful = true;
        if (collisionDetected) {
            // Collision detected with a non-police, non-road object.
            if (car.userData.behavior === 'chase') {
                // For a chasing car, if it collides with something (e.g., its target, a building),
                // prevent it from moving into the object this frame.
                // The existing chase logic (slerp towards target) will continue to adjust its orientation.
                // This allows it to "slide" along or turn away from an obstacle if its target is offset,
                // rather than making a large random turn that could disrupt other nearby chasers.
                attemptedMoveSuccessful = false;
                // Optional: Consider adding a more pronounced braking effect here if simple stopping isn't enough,
                // e.g., car.userData.currentSpeed = Math.max(0, car.userData.currentSpeed - car.userData.acceleration * 5);
                // However, the tailingDistance logic already handles braking when close to the target.
            } else {
                // Original collision response for non-chasing cars.
                if (car.userData.currentSpeed > 0) { // Only apply random turn if car was trying to move
                    // This is a large random turn.
                    car.rotation.y += Math.PI / 2 * (Math.random() > 0.5 ? 1 : -1) + Math.PI;
                }
                attemptedMoveSuccessful = false; // Don't move, whether it turned or was already stopped.
            }
        }

        if (attemptedMoveSuccessful) {
            // No collision was detected that should stop movement (or the collision was
            // between two police cars, which is ignored by the logic that sets collisionDetected).
            // Move the car to the potentialPosition (which might have been clamped by boundary check earlier).
            car.position.copy(potentialPosition);
        } else {
            // If the car could not move to its potential position due to a collision, stop it.
            car.userData.currentSpeed = 0;
        }


        // Boundary checks and looping (fallback teleportation)
        let wasTeleportedThisFrame = false;
        if (car.position.x > groundBoundary) { car.position.x = -groundBoundary; wasTeleportedThisFrame = true; }
        if (car.position.x < -groundBoundary) { car.position.x = groundBoundary; wasTeleportedThisFrame = true; }
        if (car.position.z > groundBoundary) { car.position.z = -groundBoundary; wasTeleportedThisFrame = true; }
        if (car.position.z < -groundBoundary) { car.position.z = groundBoundary; wasTeleportedThisFrame = true; }

        if (wasTeleportedThisFrame && car.userData.behavior === 'chase') {
            car.userData.isTeleportedRecently = true;
            car.userData.teleportCooldownFrames = 30; // Cooldown for 30 frames (approx 0.5s at 60fps)
        }
    }

    if (window.drivingCar) {
        const car = window.drivingCar;
        // Third-person camera: position behind and slightly above the car
        const offset = new THREE.Vector3(0, 2.5, -6); // Adjust Y for height, Z for distance
        const cameraTargetPosition = new THREE.Vector3();
        
        // Apply car's world rotation and position to the offset
        cameraTargetPosition.copy(offset);
        cameraTargetPosition.applyMatrix4(car.matrixWorld); // Transforms offset to world space relative to car

        // Smoothly interpolate camera position
        camera.position.lerp(cameraTargetPosition, 0.1); // Adjust 0.1 for camera follow speed

        // Camera looks at a point slightly in front of the car's center for better view
        const lookAtTarget = new THREE.Vector3();
        car.getWorldPosition(lookAtTarget); // Get car's world position
        lookAtTarget.y += 1.0; // Look slightly above the car's origin

        camera.lookAt(lookAtTarget);
    }
    // TODO: update any other animations here
    renderer.render(scene, camera);
}

export async function loadModel(category, modelName, position) {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        const url = `${MODELS_BASE_URL}/${category}/${modelName}`;
        loader.load(url, gltf => {
            gltf.scene.userData = { category, modelName };
            if (position) {
                gltf.scene.position.copy(position);
            }
            
            // Initialize bounding box for the object
            gltf.scene.userData.boundingBox = new THREE.Box3().setFromObject(gltf.scene);
            
            scene.add(gltf.scene);
            placedObjects.push(gltf.scene);

            // If it's a vehicle, make it a moving car
            if (gltf.scene.userData.category === 'vehicles') {
                gltf.scene.userData.defaultSpeed = 0.05; // Default speed
                gltf.scene.userData.currentSpeed = gltf.scene.userData.defaultSpeed;
                
                // Specific behavior for car_police
                if (gltf.scene.userData.modelName === 'car_police.gltf') {
                    gltf.scene.userData.behavior = 'chase';
                    gltf.scene.userData.targetType = 'car_hatchback.gltf'; // Target hatchback
                    gltf.scene.userData.maxChaseSpeed = 0.12;
                    gltf.scene.userData.acceleration = 0.0005;
                    gltf.scene.userData.turnSpeedFactor = 0.03; // Smaller is slower/smoother turn
                    gltf.scene.userData.tailingDistance = 6;    // Units to keep behind target
                } else { // For other vehicles, ensure these are set if not police
                    gltf.scene.userData.maxChaseSpeed = gltf.scene.userData.defaultSpeed;
                    gltf.scene.userData.acceleration = 0.0005; // Generic acceleration
                    gltf.scene.userData.turnSpeedFactor = 0.05; // Generic turn speed
                    gltf.scene.userData.tailingDistance = 0;    // Not applicable
                }

                // Ensure its bounding box is updated after potential position change
                gltf.scene.userData.boundingBox.setFromObject(gltf.scene);
                movingCars.push(gltf.scene);
            }

            resolve(gltf.scene);
        }, undefined, err => {
            reject(err);
        });
    });
}

function findRootObject(obj) {
    while (obj.parent && !placedObjects.includes(obj)) {
        obj = obj.parent;
    }
    return obj;
}

function onCanvasClick(event) {
    const mode = getCurrentMode();
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    if (mode === 'drive' && !window.drivingCar) { // In drive mode, but no car selected yet
        const intersects = raycaster.intersectObjects(placedObjects, true);
        if (intersects.length > 0) {
            const selectedObject = findRootObject(intersects[0].object);
            // IMPORTANT: Ensure your vehicle models have `userData.category === 'vehicles'`
            if (selectedObject.userData && selectedObject.userData.category === 'vehicles') {
                activateDriveModeUI(selectedObject); // activateDriveModeUI is in ui.js
            } else {
                showNotification('This is not a drivable vehicle. Select a vehicle model.', 'error');
            }
        }
    } else if (mode === 'place') {
        if (placementIndicator && placementIndicator.visible && window.pendingPlacementModelDetails) {
            const { category, modelName } = window.pendingPlacementModelDetails;
            loadModel(category, modelName, placementIndicator.position)
                .then(() => {
                    showNotification(`Placed ${modelName}`, 'success');
                })
                .catch(err => {
                    console.error("Error placing model:", err);
                    showNotification('Error placing model', 'error');
                });
        }
    } else if (mode === 'delete' || mode === 'edit') {
        const intersects = raycaster.intersectObjects(placedObjects, true);
        if (intersects.length > 0) {
            const selected = findRootObject(intersects[0].object);
            if (mode === 'delete') {
                if (window.drivingCar === selected) { // If deleting the car being driven
                    deactivateDriveModeUI();
                }
                disposeObject(selected);
                scene.remove(selected);
                const placedIdx = placedObjects.indexOf(selected);
                if (placedIdx > -1) placedObjects.splice(placedIdx, 1);
                
                const movingCarIdx = movingCars.indexOf(selected);
                if (movingCarIdx > -1) movingCars.splice(movingCarIdx, 1);
                
                showNotification('Object deleted', 'success');
            } else if (mode === 'edit') {
                window.selectedObject = selected;
                showNotification(`Selected for edit: ${selected.userData.modelName}`, 'info');
                // TODO: display edit UI
            }
        }
    }
}

// Import UI functions for drive mode
import { activateDriveModeUI, deactivateDriveModeUI } from './ui.js';

export function disposeObject(object) {
    object.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat.dispose());
            } else {
                child.material.dispose();
            }
        }
    });
}

// Other scene-related functions...
