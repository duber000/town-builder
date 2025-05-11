export function setupSSE() {
    // Setup SSE connection and event handling
    const evtSource = new EventSource('/events?name=' + encodeURIComponent(myName));
    evtSource.onmessage = function(event) {
        // Handle incoming messages
    };
}

// Other network-related functions...
