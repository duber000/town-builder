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
            evtSource.onmessage = function(event) {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'onlineUsers') {
                        updateOnlineUsersList(msg.payload);
                    } else {
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
                    showNotification(`Connection lost, retrying in ${retryDelay/1000}s`, 'error');
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

 export async function saveSceneToServer(sceneData) {
     const response = await fetch('/api/town/save', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(sceneData)
     });
     if (!response.ok) {
         throw new Error('Failed to save scene: ' + response.statusText);
     }
     return response.json();
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
