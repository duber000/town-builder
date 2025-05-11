/**
 * API Error Handler
 * 
 * This script intercepts API responses and displays error messages
 * when API calls fail, especially for town name already exists errors.
 */

import { showNotification } from './ui.js';

// Wrap fetch to handle API errors
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    try {
        const response = await originalFetch(...args);
        if (!response.ok) {
            const errorMsg = `Error ${response.status}: ${response.statusText}`;
            showNotification(errorMsg, 'error');
        }
        return response;
    } catch (err) {
        showNotification(err.message, 'error');
        throw err;
    }
};

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', event => {
    const message = event.reason?.message || 'Unhandled promise rejection';
    showNotification(message, 'error');
});
