import { saveSceneToServer, loadSceneFromServer } from './network.js';
import { loadModel, scene, placedObjects, renderer, groundPlane, disposeObject, movingCars } from './scene.js'; // Added movingCars
import { getActiveLoaderCount } from './models/loader.js'; // Import loader count tracker

let currentMode = 'place';
window.selectedObject = null; // For edit mode
window.drivingCar = null; // The car object currently being driven

// Loading indicator element
let loadingIndicator = null;

export function getCurrentMode() { return currentMode; }

export function setCurrentMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-button').forEach(b => {
        b.classList.remove('active');
        if (b.dataset.mode === mode) {
            b.classList.add('active');
        }
    });

    const joystickContainer = document.getElementById('joystick-container');
    const exitDrivingBtn = document.getElementById('exit-driving-btn');
    const modelContainer = document.getElementById('model-container');

    // Default UI states
    if (joystickContainer) joystickContainer.style.display = 'none';
    if (exitDrivingBtn) exitDrivingBtn.style.display = 'none';
    if (modelContainer) modelContainer.style.display = 'block'; // Show model list by default

    if (mode === 'drive') {
        if (window.drivingCar) { // Actively driving a car
            if (joystickContainer) joystickContainer.style.display = 'block'; // Or 'flex'
            if (exitDrivingBtn) exitDrivingBtn.style.display = 'block';
            if (modelContainer) modelContainer.style.display = 'none';
            showNotification(`Driving ${window.drivingCar.userData.modelName || 'car'}. Use WASD/Arrows.`, 'info');
        } else { // Entered drive mode, waiting for car selection
            if (joystickContainer) joystickContainer.style.display = 'none';
            if (exitDrivingBtn) exitDrivingBtn.style.display = 'none'; // Keep hidden until car selected
            if (modelContainer) modelContainer.style.display = 'block'; // Or 'none' if you prefer
            showNotification('Drive Mode: Click on a car in the scene to drive it.', 'info');
        }
    } else { // Not in drive mode
        if (modelContainer) modelContainer.style.display = 'block';
        window.drivingCar = null; // Ensure drivingCar is cleared if mode changes from drive
    }


    // If switching away from place mode (or to a mode that isn't 'place'),
    // clear pending model details and hide placement indicator.
    if (mode !== 'place') {
        window.pendingPlacementModelDetails = null;
        const pi = scene ? scene.getObjectByName("placementIndicator") : null;
        if (pi) pi.visible = false;
    }
    // If mode IS 'place', handleMouseMove in scene.js will manage placementIndicator visibility.

    // Only show generic mode notification if not handled by specific drive mode logic above
    if (!(mode === 'drive')) {
        showNotification(`Mode: ${mode}`, 'info');
    }
}

// Call this function when a car is selected to drive
export function activateDriveModeUI(carObject) {
    window.drivingCar = carObject;
    setCurrentMode('drive'); // This will re-evaluate UI based on window.drivingCar
}

// Call this function to stop driving
export function deactivateDriveModeUI() {
    window.drivingCar = null;
    setCurrentMode('place'); // Or your preferred default mode
}

export function showNotification(message, type = 'info') {
    // Create Bootstrap toast
    const toastContainer = document.getElementById('toast-container') || createToastContainer();

    const toast = document.createElement('div');
    toast.className = 'toast align-items-center border-0';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.setAttribute('aria-atomic', 'true');

    // Set color based on type using Bootstrap classes
    if (type === 'success') {
        toast.classList.add('text-bg-success');
    } else if (type === 'error') {
        toast.classList.add('text-bg-danger');
    } else {
        toast.classList.add('text-bg-primary');
    }

    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;

    toastContainer.appendChild(toast);

    // Initialize and show Bootstrap toast
    const bsToast = new bootstrap.Toast(toast, {
        autohide: true,
        delay: 3000
    });
    bsToast.show();

    // Remove from DOM after hidden
    toast.addEventListener('hidden.bs.toast', () => {
        toast.remove();
    });
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container position-fixed bottom-0 start-50 translate-middle-x p-3';
    container.style.zIndex = '2000';
    document.body.appendChild(container);
    return container;
}

/**
 * Create and initialize the loading indicator
 * Uses r179 loader tracking for accurate state
 */
function createLoadingIndicator() {
    if (loadingIndicator) return loadingIndicator;

    const indicator = document.createElement('div');
    indicator.id = 'loading-indicator';
    indicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: rgba(0, 123, 255, 0.95);
        color: white;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 3000;
        display: none;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        backdrop-filter: blur(10px);
        animation: pulse 1.5s ease-in-out infinite;
    `;

    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
        }
    `;
    document.head.appendChild(style);

    const spinner = document.createElement('span');
    spinner.textContent = '⏳ ';
    spinner.style.marginRight = '8px';

    const text = document.createElement('span');
    text.id = 'loading-text';
    text.textContent = 'Loading models...';

    indicator.appendChild(spinner);
    indicator.appendChild(text);
    document.body.appendChild(indicator);

    loadingIndicator = indicator;
    return indicator;
}

/**
 * Update loading indicator based on active loaders
 * Should be called periodically in animation loop
 */
export function updateLoadingIndicator() {
    const count = getActiveLoaderCount();
    const indicator = loadingIndicator || createLoadingIndicator();
    const text = document.getElementById('loading-text');

    if (count > 0) {
        indicator.style.display = 'block';
        if (text) {
            text.textContent = count === 1
                ? 'Loading 1 model...'
                : `Loading ${count} models...`;
        }
    } else {
        indicator.style.display = 'none';
    }
}

// Other UI-related functions...

export function initUI() {
    // Model-item clicks
    document.querySelectorAll('.model-item').forEach(elem => {
        elem.addEventListener('click', onModelItemClick);
    });
    // Clear, save, load buttons
    document.getElementById('clear-scene').addEventListener('click', onClearScene);
    document.getElementById('save-scene').addEventListener('click', onSaveScene);
    document.getElementById('load-scene').addEventListener('click', onLoadScene);
    // Town name display/input
    const display = document.getElementById('town-name-display');
    const input = document.getElementById('town-name-input');
    display.addEventListener('click', () => {
        display.style.display = 'none';
        input.style.display = 'block';
        input.focus();
    });
    input.addEventListener('blur', onTownNameChange);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        }
    });
    // Color pickers
    document.getElementById('skyColorPicker').addEventListener('input', e => setSkyColor(e.target.value));
    document.getElementById('groundColorPicker').addEventListener('input', e => setGroundColor(e.target.value));

    // Mode button handling
    document.querySelectorAll('.mode-button').forEach(btn =>
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.mode-button').forEach(b => b.classList.remove('active'));
            const mode = e.target.dataset.mode;
            // e.target.classList.add('active'); // setCurrentMode will handle this
            // currentMode = mode; // setCurrentMode will handle this
            setCurrentMode(mode); // Use the new function
        })
    );

    // Listener for Exit Driving Mode button
    const exitDrivingBtn = document.getElementById('exit-driving-btn');
    if (exitDrivingBtn) {
        exitDrivingBtn.addEventListener('click', () => {
            deactivateDriveModeUI();
        });
    }
}

// Handler stubs
function onModelItemClick(event) {
    event.preventDefault(); // Prevent default anchor behavior
    const target = event.currentTarget; // Use currentTarget to get the element with the event listener
    const category = target.dataset.category;
    const modelName = target.dataset.model;

    window.pendingPlacementModelDetails = { category, modelName };
    setCurrentMode('place'); // Switch to place mode
    showNotification(`Click on the ground to place ${modelName}`, 'info');
    // The actual model loading will now happen in scene.js's onCanvasClick when in 'place' mode
}

async function onClearScene() {
    if (window.confirm("Are you sure you want to clear the entire scene? This action cannot be undone.")) {
        placedObjects.forEach(obj => {
            disposeObject(obj);
            scene.remove(obj);
        });
        placedObjects.length = 0;
        movingCars.length = 0; // Also clear the movingCars array
        showNotification('Scene cleared', 'success');
    } else {
        showNotification('Clear scene cancelled', 'info');
    }
}

async function onSaveScene() {
    try {
        const sceneDataArray = placedObjects.map(obj => ({
            category: obj.userData.category,
            modelName: obj.userData.modelName,
            position: obj.position.toArray(),
            rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
            scale: obj.scale.toArray()
        }));

        const townNameDisplay = document.getElementById('town-name-display');
        const currentTownName = townNameDisplay ? townNameDisplay.textContent : "Unnamed Town";

        // Construct the payload for app.py, including all relevant Django fields
        const payloadForAppPy = {
            data: sceneDataArray, // For layout_data
            town_id: window.currentTownId || null,
            townName: currentTownName, // For Django's 'name' field, or search by name

            // Add other Django fields. Assumes these are available in global scope or UI.
            // If not available, they will be sent as null.
            latitude: window.currentTownLatitude || null,
            longitude: window.currentTownLongitude || null,
            description: window.currentTownDescription || null,
            population: window.currentTownPopulation || null,
            area: window.currentTownArea || null,
            established_date: window.currentTownEstablishedDate || null, // Expected format "YYYY-MM-DD"
            place_type: window.currentTownPlaceType || null,
            full_address: window.currentTownFullAddress || null,
            town_image: window.currentTownImage || null, // Expected as URL string or similar
        };
        
        // filename is optional for local save in app.py, can be added if needed:
        // payloadForAppPy.filename = "my_town.json";

        await saveSceneToServer(payloadForAppPy); // Pass the fully constructed payload
        showNotification('Scene saved successfully', 'success');
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

async function onLoadScene() {
    try {
        const loadedData = await loadSceneFromServer();
        await onClearScene();
        for (const item of loadedData) {
            const obj = await loadModel(item.category, item.modelName);
            obj.position.fromArray(item.position);
            obj.rotation.set(item.rotation[0], item.rotation[1], item.rotation[2]);
            obj.scale.fromArray(item.scale);
        }
        showNotification('Scene loaded successfully', 'success');
    } catch (err) {
        showNotification(err.message, 'error');
    }
}

async function onTownNameChange() {
    const input = document.getElementById('town-name-input');
    const newName = input.value.trim() || 'Unnamed Town';
    window.currentTownName = newName;
    // Update display
    const display = document.getElementById('town-name-display');
    if (display) {
        display.textContent = newName;
        display.style.display = 'block';
        input.style.display = 'none';
    }
    await onSaveScene(); // Automatically save the scene when the town name changes
}

function setSkyColor(color) {
    renderer.setClearColor(color);
}

function setGroundColor(color) {
    groundPlane.material.color.set(color);
}

export function updateOnlineUsersList(users) {
    const ul = document.getElementById('user-list-ul');
    ul.innerHTML = '';
    users.forEach(u => {
        const li = document.createElement('li');
        li.className = 'py-1';
        li.innerHTML = `<i class="bi bi-person-circle me-2 text-primary"></i>${u}`;
        ul.appendChild(li);
    });
}
