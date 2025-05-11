import { camera, renderer } from './scene.js'; // Added renderer

let keysPressed = {};
let isRightMouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;

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
            if (!isRightMouseDown || !camera) {
                return;
            }
            event.preventDefault();

            const deltaX = event.clientX - lastMouseX;
            const deltaY = event.clientY - lastMouseY;

            lastMouseX = event.clientX;
            lastMouseY = event.clientY;

            const panSpeed = 0.01; // Adjust this value for sensitivity
            // Note: We use camera.translateX and camera.translateY to move relative to camera's orientation
            camera.translateX(-deltaX * panSpeed);
            camera.translateY(deltaY * panSpeed);
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
