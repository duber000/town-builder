import { camera, renderer, placedObjects } from './scene.js'; // Added placedObjects
import * as THREE from './three.module.js'; // Added for Vector3 and Spherical
import { showNotification } from './ui.js'; // Import showNotification

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

// Update controls on each frame based on keysPressed
export function updateControls() {
    const moveSpeed = 0.15; // Adjusted speed for car
    const carRotateSpeed = 0.04; // Rotation speed for the car
    const cameraRotateSpeed = 0.02; // Original camera rotation speed

    if (window.drivingCar) {
        const car = window.drivingCar;
        let carMoved = false;
        let attemptedMoveVector = new THREE.Vector3();

        // Update car's bounding box before movement checks
        if (!car.userData.boundingBox) {
            car.userData.boundingBox = new THREE.Box3();
        }
        car.userData.boundingBox.setFromObject(car);


        // Car controls (W,A,S,D and Arrow Keys)
        if (keysPressed['w'] || keysPressed['arrowup']) {
            const forward = new THREE.Vector3(0, 0, 1);
            forward.applyQuaternion(car.quaternion);
            attemptedMoveVector.add(forward.multiplyScalar(moveSpeed));
            carMoved = true;
        }
        if (keysPressed['s'] || keysPressed['arrowdown']) {
            const backward = new THREE.Vector3(0, 0, -1);
            backward.applyQuaternion(car.quaternion);
            attemptedMoveVector.add(backward.multiplyScalar(moveSpeed * 0.7));
            carMoved = true;
        }

        if (carMoved) {
            const potentialPosition = car.position.clone().add(attemptedMoveVector);
            const potentialBoundingBox = car.userData.boundingBox.clone();
            potentialBoundingBox.translate(attemptedMoveVector); // Translate by the movement vector

            let collisionDetected = false;
            for (const otherObject of placedObjects) {
                if (otherObject === car) continue;

                if (!otherObject.userData.boundingBox) {
                    otherObject.userData.boundingBox = new THREE.Box3().setFromObject(otherObject);
                }

                if (potentialBoundingBox.intersectsBox(otherObject.userData.boundingBox)) {
                    collisionDetected = true;
                    showNotification("Bonk!", "error"); // Optional: notify player
                    break;
                }
            }

            if (!collisionDetected) {
                car.position.copy(potentialPosition);
            }
        }

        // Rotation is allowed even if movement is blocked
        if (keysPressed['a'] || keysPressed['arrowleft']) {
            car.rotation.y += carRotateSpeed;
        }
        if (keysPressed['d'] || keysPressed['arrowright']) {
            car.rotation.y -= carRotateSpeed;
        }
        // The camera is handled by the animate loop in scene.js when drivingCar is active

    } else {
        // Default camera controls when not driving a car
        if (keysPressed['w']) camera.translateZ(-moveSpeed);
        if (keysPressed['s']) camera.translateZ(moveSpeed);
        if (keysPressed['a']) camera.translateX(-moveSpeed);
        if (keysPressed['d']) camera.translateX(moveSpeed);
        // Rotate view (only if not right-click orbiting)
        if (!isRightMouseDown) {
            if (keysPressed['arrowleft']) camera.rotation.y += cameraRotateSpeed;
            if (keysPressed['arrowright']) camera.rotation.y -= cameraRotateSpeed;
        }
    }
}

// Other control-related functions...
