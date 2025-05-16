import { showNotification, updateOnlineUsersList } from './ui.js';

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
