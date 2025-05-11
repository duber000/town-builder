import { showNotification, updateOnlineUsersList } from './ui.js';

export function setupSSE() {
    // Setup SSE connection and event handling
    return new Promise((resolve, reject) => {
        const evtSource = new EventSource('/events?name=' + encodeURIComponent(myName));
        evtSource.onopen = () => resolve(evtSource);
        evtSource.onerror = (err) => reject(err);
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
