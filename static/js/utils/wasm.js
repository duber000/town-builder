/**
 * WASM initialization utilities
 */

/**
 * Wait for Go WASM calcDistance function to be available
 * @returns {Promise<void>} Resolves when WASM is ready
 */
async function initWasm() {
    while (typeof calcDistance !== 'function') {
        await new Promise(r => setTimeout(r, 50));
    }
}

export const wasmReady = initWasm();
