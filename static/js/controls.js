import { camera, renderer, placedObjects } from './scene.js'; // Added placedObjects
import * as THREE from './three.module.js'; // Added for Vector3 and Spherical
import { showNotification, getCurrentMode } from './ui.js'; // Import showNotification and getCurrentMode

let keysPressed = {};
let isRightMouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;
const ORBIT_TARGET = new THREE.Vector3(0, 0, 0); // Point to orbit around

export function setupKeyboardControls() {
    // Keyboard listeners
    document.addEventListener('keydown', function(event) {
        keysPressed[event.key.toLowerCase()] = true;
    });

    document.addEventListener('keyup', function(event) {
        keysPressed[event.key.toLowerCase()] = false;
    });

    // Mouse wheel listener
    document.addEventListener('wheel', handleMouseWheel, { passive: false });

    // Mouse listeners for panning
    if (renderer && renderer.domElement) {
        renderer.domElement.addEventListener('mousedown', function(event) {
            if (event.button === 2) { // Right mouse button
                isRightMouseDown = true;
                lastMouseX = event.clientX;
                lastMouseY = event.clientY;
                event.preventDefault(); // Prevent text selection/other default actions
            }
        });

        renderer.domElement.addEventListener('mousemove', function(event) {
            // Disable orbit controls if driving a car or if camera is not available
            if (!isRightMouseDown || !camera || window.drivingCar) {
                return;
            }
            event.preventDefault();

            const deltaX = event.clientX - lastMouseX;
            const deltaY = event.clientY - lastMouseY;

            lastMouseX = event.clientX;
            lastMouseY = event.clientY;

            const orbitSpeed = 0.005; // Adjust for sensitivity

            // Orbiting logic using Spherical Coordinates
            const offset = new THREE.Vector3().subVectors(camera.position, ORBIT_TARGET);
            const spherical = new THREE.Spherical().setFromVector3(offset);

            spherical.theta -= deltaX * orbitSpeed; // Azimuthal angle (horizontal)
            spherical.phi -= deltaY * orbitSpeed;   // Polar angle (vertical)

            // Clamp polar angle to prevent flipping over
            spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi));

            offset.setFromSpherical(spherical);
            camera.position.copy(ORBIT_TARGET).add(offset);
            camera.lookAt(ORBIT_TARGET);
        });

        renderer.domElement.addEventListener('contextmenu', function(event) {
            event.preventDefault(); // Prevent context menu on right click
        });
    }

    // Mouse up listener on document to catch mouse up even if outside canvas
    document.addEventListener('mouseup', function(event) {
        if (event.button === 2) { // Right mouse button
            isRightMouseDown = false;
        }
    });
}

function handleMouseWheel(event) {
    // The model selection panel has the ID 'model-container' in index.html
    const modelPanel = document.getElementById('model-container');

    if (modelPanel && modelPanel.contains(event.target)) {
        // If the mouse is over the model panel, allow default scroll behavior
        // Do not preventDefault and do not zoom.
        return;
    }

    event.preventDefault(); // Prevent default page scroll for camera zoom

    const zoomSpeed = 0.1; // Reduced for more gradual zoom
    let newFov = camera.fov - event.deltaY * zoomSpeed;

    // Clamp FOV to a reasonable range (e.g., 10 to 120 degrees)
    newFov = Math.max(10, Math.min(120, newFov));

    if (camera.fov !== newFov) {
        camera.fov = newFov;
        camera.updateProjectionMatrix();
    }
}

export function updateControls() {
    const cameraRotateSpeed = 0.02;
    const moveSpeed = 0.15;
    const objectMoveSpeed = 0.1; // Speed for moving objects in edit mode

    // Handle Z key zoom
    if (keysPressed['z']) {
        // Zoom in (decrease FOV)
        let newFov = camera.fov - 2; // Zoom speed for keyboard
        newFov = Math.max(10, Math.min(120, newFov));
        if (camera.fov !== newFov) {
            camera.fov = newFov;
            camera.updateProjectionMatrix();
        }
    }
    if (keysPressed['x']) {
        // Zoom out (increase FOV)
        let newFov = camera.fov + 2; // Zoom speed for keyboard
        newFov = Math.max(10, Math.min(120, newFov));
        if (camera.fov !== newFov) {
            camera.fov = newFov;
            camera.updateProjectionMatrix();
        }
    }

    // Handle edit mode - move selected object with arrow keys
    const currentMode = getCurrentMode();
    if (currentMode === 'edit' && window.selectedObject) {
        const obj = window.selectedObject;

        // Arrow keys move the object left/right/forward/back
        if (keysPressed['arrowup']) {
            obj.position.z -= objectMoveSpeed; // Move forward (negative Z)
        }
        if (keysPressed['arrowdown']) {
            obj.position.z += objectMoveSpeed; // Move back (positive Z)
        }
        if (keysPressed['arrowleft']) {
            obj.position.x -= objectMoveSpeed; // Move left (negative X)
        }
        if (keysPressed['arrowright']) {
            obj.position.x += objectMoveSpeed; // Move right (positive X)
        }

        // Q and E keys move object up and down
        if (keysPressed['q']) {
            obj.position.y += objectMoveSpeed; // Move up (positive Y)
        }
        if (keysPressed['e']) {
            obj.position.y -= objectMoveSpeed; // Move down (negative Y)
        }

        // Update bounding box if it exists
        if (obj.userData.boundingBox) {
            obj.userData.boundingBox.setFromObject(obj);
        }

        // WASD still controls camera in edit mode
        if (keysPressed['w']) camera.translateZ(-moveSpeed);
        if (keysPressed['s']) camera.translateZ(moveSpeed);
        if (keysPressed['a']) camera.translateX(-moveSpeed);
        if (keysPressed['d']) camera.translateX(moveSpeed);

        return; // Skip other controls when in edit mode with selected object
    }

    if (window.drivingCar) {
        const car = window.drivingCar;

        // Initialize collision cooldown if it doesn't exist
        if (car.userData.collisionCooldown === undefined) {
            car.userData.collisionCooldown = 0;
        }

        // Decrement cooldown each frame
        if (car.userData.collisionCooldown > 0) {
            car.userData.collisionCooldown--;
        }

        // Debug: log cooldown when it's active
        if (car.userData.collisionCooldown > 0 && car.userData.collisionCooldown % 30 === 0) {
            console.log(`Collision cooldown: ${car.userData.collisionCooldown} frames remaining`);
        }

        // --- Check if WASM module is loaded ---
        if (window.physicsWasm) {
            // --- WASM-Powered Physics ---
            const inputState = new window.physicsWasm.InputState(
                !!(keysPressed['w'] || keysPressed['arrowup']),
                !!(keysPressed['s'] || keysPressed['arrowdown']),
                !!(keysPressed['a'] || keysPressed['arrowleft']),
                !!(keysPressed['d'] || keysPressed['arrowright']),
            );

            // Initialize velocities if they don't exist
            if (car.userData.velocity_x === undefined) {
                car.userData.velocity_x = 0;
                car.userData.velocity_z = 0;
            }

            const currentState = new window.physicsWasm.CarState(
                car.position.x,
                car.position.z,
                car.rotation.y,
                car.userData.velocity_x,
                car.userData.velocity_z,
            );
            // Read old position now; the Rust call will destroy the JS wrapper
            const oldX = currentState.x;
            const oldZ = currentState.z;

            const newState = window.physicsWasm.update_car_physics(currentState, inputState);

            // Update the velocity on the JS object for the next frame
            car.userData.velocity_x = newState.velocity_x;
            car.userData.velocity_z = newState.velocity_z;

            const attemptedMoveVector = new THREE.Vector3(
                newState.x - oldX,
                0,
                newState.z - oldZ
            );

            // Collision detection remains in JS
            const potentialPosition = new THREE.Vector3(newState.x, car.position.y, newState.z);
            const potentialBoundingBox = new THREE.Box3().setFromObject(car);
            potentialBoundingBox.translate(attemptedMoveVector);

            let collisionDetected = false;
            // Determine movement direction relative to car's current orientation
            const forwardDir = new THREE.Vector3(0, 0, 1).applyQuaternion(car.quaternion);
            for (const otherObject of placedObjects) {
                if (otherObject === car || (otherObject.userData.modelName && otherObject.userData.modelName.includes('road_'))) continue;
                if (!otherObject.userData.boundingBox) otherObject.userData.boundingBox = new THREE.Box3().setFromObject(otherObject);
                if (potentialBoundingBox.intersectsBox(otherObject.userData.boundingBox)) {
                    // Only block forward motion; allow backing out
                    if (attemptedMoveVector.dot(forwardDir) > 0) {
                        collisionDetected = true;
                        // Only show notification if cooldown expired
                        if (car.userData.collisionCooldown === 0) {
                            showNotification("Bonk!", "error");
                            car.userData.collisionCooldown = 90; // ~1.5 seconds at 60 FPS
                        }
                        car.userData.velocity_x = 0;
                        car.userData.velocity_z = 0;
                    }
                    break;
                }
            }

            if (!collisionDetected) {
                car.position.copy(potentialPosition);
                car.rotation.y = newState.rotation_y;
            }

        } else {
            // --- Fallback to JavaScript Physics ---
            if (car.userData.velocity === undefined) {
                car.userData.velocity = new THREE.Vector3(0, 0, 0);
                car.userData.acceleration = 0.005;
                car.userData.maxSpeed = 0.2;
                car.userData.friction = 0.98;
                car.userData.brakePower = 0.01;
                car.userData.carRotateSpeed = 0.04;
            }

            const { acceleration, maxSpeed, friction, brakePower, carRotateSpeed } = car.userData;

            if (keysPressed['a'] || keysPressed['arrowleft']) car.rotation.y += carRotateSpeed;
            if (keysPressed['d'] || keysPressed['arrowright']) car.rotation.y -= carRotateSpeed;
            
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(car.quaternion);
            if (keysPressed['w'] || keysPressed['arrowup']) {
                car.userData.velocity.add(forward.clone().multiplyScalar(acceleration));
            }
            if (keysPressed['s'] || keysPressed['arrowdown']) {
                // Reverse acceleration when pressing backward
                car.userData.velocity.add(forward.clone().multiplyScalar(-acceleration));
            }
            
            car.userData.velocity.multiplyScalar(friction);
            if (car.userData.velocity.length() > maxSpeed) car.userData.velocity.normalize().multiplyScalar(maxSpeed);
            if (car.userData.velocity.length() < 0.001) car.userData.velocity.set(0, 0, 0);

            const attemptedMoveVector = car.userData.velocity;
            if (attemptedMoveVector.lengthSq() > 0) {
                const potentialPosition = car.position.clone().add(attemptedMoveVector);
                const potentialBoundingBox = new THREE.Box3().setFromObject(car);
                potentialBoundingBox.translate(attemptedMoveVector);

                let collisionDetected = false;
                for (const otherObject of placedObjects) {
                    if (otherObject === car || (otherObject.userData.modelName && otherObject.userData.modelName.includes('road_'))) continue;
                    if (!otherObject.userData.boundingBox) otherObject.userData.boundingBox = new THREE.Box3().setFromObject(otherObject);
                    if (potentialBoundingBox.intersectsBox(otherObject.userData.boundingBox)) {
                        collisionDetected = true;
                        // Only show notification if cooldown expired
                        if (car.userData.collisionCooldown === 0) {
                            showNotification("Bonk!", "error");
                            car.userData.collisionCooldown = 90; // ~1.5 seconds at 60 FPS
                        }
                        car.userData.velocity.set(0, 0, 0); // Stop the car
                        break;
                    }
                }
                if (!collisionDetected) {
                    car.position.copy(potentialPosition);
                }
            }
        }
    } else {
        // Default camera controls
        if (keysPressed['w']) camera.translateZ(-moveSpeed);
        if (keysPressed['s']) camera.translateZ(moveSpeed);
        if (keysPressed['a']) camera.translateX(-moveSpeed);
        if (keysPressed['d']) camera.translateX(moveSpeed);
        if (!isRightMouseDown) {
            if (keysPressed['arrowleft']) camera.rotation.y += cameraRotateSpeed;
            if (keysPressed['arrowright']) camera.rotation.y -= cameraRotateSpeed;
        }
    }
}
