import { initScene } from './scene.js';
import { setupSSE } from './network.js';
import { setupKeyboardControls } from './controls.js';
import { showNotification } from './ui.js';

function init() {
    // Initialize the scene
    initScene();

    // Prompt for name and connect SSE after scene is initialized
    setTimeout(() => {
        setupSSE().catch(error => {
            console.error("Error setting up SSE:", error);
            showNotification("Error setting up multiplayer connection", "error");
        });
    }, 0);
}

// Start the application
init();
