import { showNotification, updateOnlineUsersList } from './ui.js';
import { loadModel, scene, placedObjects, movingCars } from './scene.js';
import { updateCursor } from './collaborative-cursors.js';

export function setupSSE() {
    // Setup SSE connection with automatic reconnection and backoff
    let retryDelay = 1000;
    const maxDelay = 30000;
    return new Promise((resolve, reject) => {
        function connect(isInitial = false) {
            const evtSource = new EventSource('/events?name=' + encodeURIComponent(myName));
            evtSource.onopen = () => {
                retryDelay = 1000;
                if (isInitial) {
                    resolve(evtSource);
                } else {
                    showNotification('Reconnected to multiplayer server', 'success');
                }
            };
            evtSource.onmessage = function (event) {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'users') { // Changed 'onlineUsers' to 'users'
                        updateOnlineUsersList(msg.users); // Changed msg.payload to msg.users
                    } else if (msg.type === 'full' && msg.town) {
                        // Handle full town updates - render new buildings
                        loadTownData(msg.town);
                        showNotification('Town updated', 'success');
                    } else if (msg.type === 'cursor') {
                        // Handle cursor position updates from other users
                        if (msg.username && msg.username !== myName) {
                            updateCursor(scene, msg.username, msg.position, msg.camera_position);
                        }
                    } else {
                        // Pass the whole message to showNotification for more context if needed
                        // For now, keeping it simple as before, but logging the full message might be useful for debugging other events
                        // console.log("Received SSE message:", msg); 
                        showNotification(`Event: ${msg.type}`, 'info');
                    }
                } catch (err) {
                    console.error('Failed to handle SSE message', err);
                }
            };
            evtSource.onerror = (err) => {
                evtSource.close();
                if (isInitial) {
                    reject(err);
                } else {
                    showNotification(`Connection lost, retrying in ${retryDelay / 1000}s`, 'error');
                    setTimeout(() => {
                        retryDelay = Math.min(maxDelay, retryDelay * 2);
                        connect(false);
                    }, retryDelay);
                }
            };
        }
        connect(true);
    });
}

// Load town data from SSE updates and render new buildings
async function loadTownData(townData) {
    try {
        // Get current object IDs to avoid duplicates
        const existingIds = new Set();
        placedObjects.forEach(obj => {
            if (obj.userData.id) {
                existingIds.add(obj.userData.id);
            }
        });

        // Process each category of objects
        const categories = ['buildings', 'terrain', 'roads', 'props'];
        
        for (const category of categories) {
            const objects = townData[category] || [];
            
            for (const obj of objects) {
                // Skip if object already exists
                if (obj.id && existingIds.has(obj.id)) {
                    continue;
                }
                
                // Load the model if it has the required properties
                if (obj.model && obj.position) {
                    try {
                        const position = {
                            x: obj.position.x || 0,
                            y: obj.position.y || 0,
                            z: obj.position.z || 0
                        };
                        
                        const loadedModel = await loadModel(category, obj.model, position);
                        
                        // Set the ID and other properties
                        if (obj.id) {
                            loadedModel.userData.id = obj.id;
                        }
                        
                        // Apply rotation if specified
                        if (obj.rotation) {
                            loadedModel.rotation.set(
                                obj.rotation.x || 0,
                                obj.rotation.y || 0,
                                obj.rotation.z || 0
                            );
                        }
                        
                        // Apply scale if specified
                        if (obj.scale) {
                            loadedModel.scale.set(
                                obj.scale.x || 1,
                                obj.scale.y || 1,
                                obj.scale.z || 1
                            );
                        }
                        
                        console.log(`Loaded ${category} model: ${obj.model} at position`, position);
                    } catch (err) {
                        console.error(`Failed to load ${category} model ${obj.model}:`, err);
                    }
                }
            }
        }
    } catch (err) {
        console.error('Error loading town data:', err);
        showNotification('Error loading town data', 'error');
    }
}

// Other network-related functions...

export async function saveSceneToServer(payloadFromUI) { // Argument changed
    // The payloadFromUI is now expected to be fully formed by ui.js
    // No re-wrapping needed here.
    const response = await fetch('/api/town/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadFromUI) // Send the payload directly
    });
    if (!response.ok) {
        throw new Error('Failed to save scene: ' + response.statusText);
    }
    const result = await response.json();
    // Persist returned town_id for future updates
    if (result.town_id) {
        window.currentTownId = result.town_id;
    }
    return result;
}

export async function loadSceneFromServer() {
    const response = await fetch('/api/town/load', {
        method: 'POST'
    });
    if (!response.ok) {
        throw new Error('Failed to load scene: ' + response.statusText);
    }
    return response.json();
}

export async function loadTownFromDjango(townId) {
    const response = await fetch(`/api/town/load-from-django/${townId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) {
        let errorMessage = response.statusText;
        try {
            const errorData = await response.json();
            if (errorData.detail) {
                errorMessage = typeof errorData.detail === 'string'
                    ? errorData.detail
                    : (errorData.detail.message || JSON.stringify(errorData.detail));
            }
        } catch (e) {
            // If we can't parse the error response, use statusText
        }
        throw new Error('Failed to load town from Django: ' + errorMessage);
    }
    const result = await response.json();
    // Update current town info
    if (result.town_info) {
        window.currentTownId = result.town_info.id;
        window.currentTownName = result.town_info.name;
        window.currentTownDescription = result.town_info.description;
        window.currentTownLatitude = result.town_info.latitude;
        window.currentTownLongitude = result.town_info.longitude;
    }
    return result;
}

/**
 * Send cursor position update to server
 * @param {string} username - Current user's name
 * @param {Object} position - {x, y, z} world position where cursor is pointing
 * @param {Object} cameraPosition - {x, y, z} camera position
 */
export async function sendCursorUpdate(username, position, cameraPosition) {
    try {
        await fetch('/api/cursor/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                position: { x: position.x, y: position.y, z: position.z },
                camera_position: { x: cameraPosition.x, y: cameraPosition.y, z: cameraPosition.z }
            })
        });
    } catch (err) {
        // Silently fail - cursor updates are non-critical
        console.debug('Failed to send cursor update:', err);
    }
}
