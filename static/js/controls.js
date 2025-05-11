import { camera } from './scene.js';

let keysPressed = {};

export function setupKeyboardControls() {
    document.addEventListener('keydown', function(event) {
        keysPressed[event.key.toLowerCase()] = true;
    });

    document.addEventListener('keyup', function(event) {
        keysPressed[event.key.toLowerCase()] = false;
    });

    document.addEventListener('wheel', handleMouseWheel, { passive: false });
}

function handleMouseWheel(event) {
    event.preventDefault(); // Prevent default page scroll

    const zoomSpeed = 0.5;
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
    const moveSpeed = 0.2;
    const rotateSpeed = 0.02;
    // Move forward/back
    if (keysPressed['w']) camera.translateZ(-moveSpeed);
    if (keysPressed['s']) camera.translateZ(moveSpeed);
    // Strafe left/right
    if (keysPressed['a']) camera.translateX(-moveSpeed);
    if (keysPressed['d']) camera.translateX(moveSpeed);
    // Rotate view
    if (keysPressed['arrowleft']) camera.rotation.y += rotateSpeed;
    if (keysPressed['arrowright']) camera.rotation.y -= rotateSpeed;
}

// Other control-related functions...
