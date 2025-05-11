import { camera } from './scene.js';

let keysPressed = {};

export function setupKeyboardControls() {
    document.addEventListener('keydown', function(event) {
        keysPressed[event.key.toLowerCase()] = true;
    });

    document.addEventListener('keyup', function(event) {
        keysPressed[event.key.toLowerCase()] = false;
    });
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
