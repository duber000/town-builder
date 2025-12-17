/**
 * Collaborative Cursors - Show other users' cursor positions in 3D space
 */
import * as THREE from './three.module.js';

// Store active cursors: {username: cursorObject}
const activeCursors = new Map();

// Color palette for different users (bright, distinguishable colors)
const userColors = [
    0xff4444, // Red
    0x44ff44, // Green
    0x4444ff, // Blue
    0xffff44, // Yellow
    0xff44ff, // Magenta
    0x44ffff, // Cyan
    0xff8844, // Orange
    0x88ff44, // Lime
    0x8844ff, // Purple
    0xff4488, // Pink
];

let colorIndex = 0;
const userColorMap = new Map(); // {username: color}

/**
 * Create a 3D cursor indicator (cone pointing down)
 * @param {string} username - User's name
 * @param {number} color - Hex color for the cursor
 * @returns {THREE.Group} - Cursor group with cone and label
 */
function createCursorIndicator(username, color) {
    const group = new THREE.Group();
    
    // Create cone geometry (pointing down)
    const coneGeometry = new THREE.ConeGeometry(0.3, 1.5, 8);
    const coneMaterial = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 0.5,
        transparent: true,
        opacity: 0.8
    });
    const cone = new THREE.Mesh(coneGeometry, coneMaterial);
    cone.rotation.x = 0; // Point down (default orientation)
    cone.position.y = 0.75; // Raise it a bit so tip touches ground
    
    // Add pulsing animation effect
    cone.userData.pulsePhase = Math.random() * Math.PI * 2;
    
    group.add(cone);
    
    // Create label sprite for username
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    // Draw label background
    context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw username text
    context.font = 'bold 32px Arial';
    context.fillStyle = '#ffffff';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(username, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(2, 0.5, 1);
    sprite.position.y = 2.5; // Position above the cone
    
    group.add(sprite);
    
    // Store references for animation
    group.userData.cone = cone;
    group.userData.sprite = sprite;
    group.userData.username = username;
    
    return group;
}

/**
 * Get or assign a color for a user
 * @param {string} username
 * @returns {number} Hex color
 */
function getUserColor(username) {
    if (!userColorMap.has(username)) {
        const color = userColors[colorIndex % userColors.length];
        userColorMap.set(username, color);
        colorIndex++;
        return color;
    }
    return userColorMap.get(username);
}

/**
 * Update or create a cursor for a user
 * @param {THREE.Scene} scene - Three.js scene
 * @param {string} username - User's name
 * @param {Object} position - {x, y, z} world position
 * @param {Object} cameraPosition - {x, y, z} camera position
 */
export function updateCursor(scene, username, position, cameraPosition) {
    let cursor = activeCursors.get(username);
    
    if (!cursor) {
        // Create new cursor indicator
        const color = getUserColor(username);
        cursor = createCursorIndicator(username, color);
        activeCursors.set(username, cursor);
        scene.add(cursor);
    }
    
    // Update cursor position
    cursor.position.set(position.x, position.y, position.z);
    
    // Store camera position for potential future use
    cursor.userData.cameraPosition = cameraPosition;
    
    // Update last seen timestamp
    cursor.userData.lastSeen = Date.now();
}

/**
 * Remove a cursor for a user
 * @param {THREE.Scene} scene - Three.js scene
 * @param {string} username - User's name
 */
export function removeCursor(scene, username) {
    const cursor = activeCursors.get(username);
    if (cursor) {
        scene.remove(cursor);
        
        // Dispose of geometries and materials
        cursor.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (obj.material.map) obj.material.map.dispose();
                obj.material.dispose();
            }
        });
        
        activeCursors.delete(username);
    }
}

/**
 * Remove inactive cursors (not updated in 5 seconds)
 * @param {THREE.Scene} scene - Three.js scene
 */
export function cleanupInactiveCursors(scene) {
    const now = Date.now();
    const timeout = 5000; // 5 seconds
    
    for (const [username, cursor] of activeCursors.entries()) {
        if (now - cursor.userData.lastSeen > timeout) {
            removeCursor(scene, username);
        }
    }
}

/**
 * Animate all active cursors (pulsing effect)
 * Call this in your animation loop
 * @param {number} deltaTime - Time since last frame
 */
export function animateCursors(deltaTime) {
    for (const cursor of activeCursors.values()) {
        const cone = cursor.userData.cone;
        if (cone) {
            // Pulsing opacity animation
            cone.userData.pulsePhase += deltaTime * 3;
            const pulse = Math.sin(cone.userData.pulsePhase) * 0.15 + 0.85;
            cone.material.opacity = pulse * 0.8;
            
            // Slight bobbing animation
            cone.position.y = 0.75 + Math.sin(cone.userData.pulsePhase * 0.5) * 0.1;
        }
    }
}

/**
 * Get all active cursor usernames
 * @returns {Array<string>} Array of usernames
 */
export function getActiveCursorUsers() {
    return Array.from(activeCursors.keys());
}

/**
 * Clear all cursors
 * @param {THREE.Scene} scene - Three.js scene
 */
export function clearAllCursors(scene) {
    for (const username of activeCursors.keys()) {
        removeCursor(scene, username);
    }
}
