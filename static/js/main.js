import './api-error-handler.js';
import { initScene, animate } from './scene.js';
import { setupSSE } from './network.js';
import { setupKeyboardControls } from './controls.js';
import { showNotification, initUI } from './ui.js';

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
