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
