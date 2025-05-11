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
    // TODO: use keysPressed to move camera or objects based on user input
}

// Other control-related functions...
