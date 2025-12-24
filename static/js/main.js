import './api-error-handler.js';
import { initializeScene, animate, loadModelToScene, placedObjects } from './scene.js';
import { setupSSE, loadTownFromDjango } from './network.js';
import { setupKeyboardControls } from './controls.js';
import { showNotification, initUI } from './ui.js';
import { initPhysicsWasm } from './utils/physics_wasm.js';
import { applyCategoryStatuses, createStatusLegend } from './category_status.js';

// Wait for Go WASM module to be ready
async function waitForWasm() {
    // Poll for WASM functions to be available
    for (let i = 0; i < 50; i++) {
        if (typeof window.wasmUpdateSpatialGrid === 'function') {
            await initPhysicsWasm();
            return true;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.warn("WASM module did not load in time, continuing without WASM optimization");
    return false;
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
    // Wait for Go WASM module to load
    await waitForWasm();

    // Initialize the scene
    initializeScene();
    animate();

    // Wire up keyboard listeners
    setupKeyboardControls();
    initUI();

    // Joystick will be initialized when entering drive mode (see ui.js)

    // Auto-load town data if town_id is present
    if (window.currentTownId) {
        console.log(`Auto-loading town ${window.currentTownId} from Django...`);
        try {
            const result = await loadTownFromDjango(window.currentTownId);
            console.log("Town loaded:", result);

            // Update town name display
            const townNameDisplay = document.getElementById('town-name-display');
            const townNameInput = document.getElementById('town-name-input');
            if (result.town_info && result.town_info.name) {
                if (townNameDisplay) townNameDisplay.textContent = result.town_info.name;
                if (townNameInput) townNameInput.value = result.town_info.name;
            }

            // Load scene objects if layout_data exists
            if (result.data && Array.isArray(result.data) && result.data.length > 0) {
                console.log(`Loading ${result.data.length} objects into scene...`);
                for (const item of result.data) {
                    try {
                        const obj = await loadModelToScene(item.category, item.modelName);
                        if (obj) {
                            if (item.position && Array.isArray(item.position)) {
                                obj.position.fromArray(item.position);
                            }
                            if (item.rotation && Array.isArray(item.rotation)) {
                                obj.rotation.set(item.rotation[0], item.rotation[1], item.rotation[2]);
                            }
                            if (item.scale && Array.isArray(item.scale)) {
                                obj.scale.fromArray(item.scale);
                            }
                        }
                    } catch (err) {
                        console.error(`Error loading model ${item.category}/${item.modelName}:`, err);
                    }
                }
                showNotification(`Town "${result.town_info.name}" loaded successfully`, 'success');
            } else {
                showNotification(`Town "${result.town_info.name}" loaded (no saved layout)`, 'info');
            }
            if (result.town_info && result.town_info.category_statuses) {
                console.log(`Applying ${result.town_info.category_statuses.length} category statuses...`);
                applyCategoryStatuses(result.town_info.category_statuses, placedObjects);

                // Create and display status legend
                const legend = createStatusLegend(result.town_info.category_statuses);
                document.body.appendChild(legend);

                showNotification('Category statuses applied', 'success');
            }
        } catch (error) {
            console.error("Error auto-loading town:", error);
            showNotification("Error loading town data", "error");
        }
    }

    // Connect SSE after scene is initialized
    setTimeout(() => {
        setupSSE().catch(error => {
            console.error("Error setting up SSE:", error);
            showNotification("Error setting up multiplayer connection", "error");
        });
    }, 0);
}

// Start the application
init();
