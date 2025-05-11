export function setupSSE() {
    // Setup SSE connection and event handling
    return new Promise((resolve, reject) => {
        const evtSource = new EventSource('/events?name=' + encodeURIComponent(myName));
        evtSource.onopen = () => resolve(evtSource);
        evtSource.onerror = (err) => reject(err);
        evtSource.onmessage = function(event) {
            // Handle incoming messages
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
