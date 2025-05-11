import './api-error-handler.js';
import { initScene, animate } from './scene.js';
import { setupSSE } from './network.js';
import { setupKeyboardControls } from './controls.js';
import { showNotification, initUI } from './ui.js';

const myName = prompt("Enter your name:");
window.myName = myName;

function init() {
    // Initialize the scene
    initScene();
    animate();
    // Wire up keyboard listeners (was inline before)
    setupKeyboardControls();
    initUI();

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
