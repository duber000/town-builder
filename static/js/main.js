import './api-error-handler.js';
import { initializeScene, animate } from './scene.js';
import { setupSSE } from './network.js';
import { setupKeyboardControls } from './controls.js';
import { showNotification, initUI } from './ui.js';

async function initPhysicsWasm() {
    try {
        // Load the wasm-bindgen generated module from the static/wasm directory
        const wasm = await import('/static/wasm/town_builder_physics.js');
        await wasm.default(); // Initialize the wasm module
        window.physicsWasm = wasm; // Make it globally accessible
        console.log("Physics WASM module loaded successfully.");
    } catch (e) {
        console.error("Error loading physics WASM module. Falling back to JS physics.", e);
        window.physicsWasm = null;
    }
}

// Cookie helper functions
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/; SameSite=Lax";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

let userName = getCookie("userName");
if (!userName) {
    userName = prompt("Enter your name:");
}
window.myName = userName;
setCookie("userName", userName, 30); // Remember for 30 days


async function init() {
    await initPhysicsWasm();
    // Initialize the scene
    initializeScene();
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
