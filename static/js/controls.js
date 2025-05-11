let keysPressed = {};

export function setupKeyboardControls() {
    document.addEventListener('keydown', function(event) {
        keysPressed[event.key.toLowerCase()] = true;
    });

    document.addEventListener('keyup', function(event) {
        keysPressed[event.key.toLowerCase()] = false;
    });
}

// Other control-related functions...
