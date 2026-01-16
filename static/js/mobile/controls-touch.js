// Touch controls for camera movement on mobile devices
// Handles pan, rotate, and pinch-to-zoom gestures

import { isTouchDevice } from '../utils/device-detect.js';
import { haptics } from '../utils/haptics.js';

class TouchControls {
  constructor() {
    this.enabled = false;
    this.camera = null;
    this.canvas = null;
    this.controls = null;

    // Touch state
    this.touches = new Map();
    this.lastTouches = [];
    this.initialPinchDistance = 0;
    this.initialFov = 75;
    this.isInteractMode = false; // Toggle between camera control and object interaction

    // Camera control settings
    this.panSpeed = 0.02;
    this.rotateSpeed = 0.005;
    this.zoomSpeed = 0.01;

    // Gesture detection
    this.gestureStartTime = 0;
    this.gestureType = null; // 'pan', 'rotate', 'pinch', 'tap', 'longpress'
    this.longPressDuration = 500; // ms
    this.longPressTimer = null;
    this.tapThreshold = 10; // pixels
    this.doubleTapDelay = 300; // ms
    this.lastTapTime = 0;

    // Store bound event handlers for cleanup
    this.boundHandlers = {
      touchStart: null,
      touchMove: null,
      touchEnd: null
    };

    console.log('TouchControls initialized');
  }

  /**
   * Initialize touch controls
   * @param {THREE.Camera} camera Three.js camera
   * @param {HTMLCanvasElement} canvas Canvas element
   * @param {Object} controls Camera controls (optional)
   */
  init(camera, canvas, controls = null) {
    if (!isTouchDevice()) {
      console.log('Touch not supported - touch controls disabled');
      return;
    }

    this.camera = camera;
    this.canvas = canvas;
    this.controls = controls;
    this.initialFov = camera.fov;

    this.setupEventListeners();
    this.enabled = true;

    console.log('Touch controls enabled');
  }

  /**
   * Setup touch event listeners
   */
  setupEventListeners() {
    if (!this.canvas) return;

    // Store bound handlers
    this.boundHandlers.touchStart = this.handleTouchStart.bind(this);
    this.boundHandlers.touchMove = this.handleTouchMove.bind(this);
    this.boundHandlers.touchEnd = this.handleTouchEnd.bind(this);

    // Touch events
    this.canvas.addEventListener('touchstart', this.boundHandlers.touchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.boundHandlers.touchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.boundHandlers.touchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', this.boundHandlers.touchEnd, { passive: false });

    console.log('Touch event listeners attached');
  }

  /**
   * Handle touch start
   * @param {TouchEvent} event
   */
  handleTouchStart(event) {
    if (!this.enabled) return;

    // Store touch information
    for (let i = 0; i < event.touches.length; i++) {
      const touch = event.touches[i];
      this.touches.set(touch.identifier, {
        x: touch.clientX,
        y: touch.clientY,
        startX: touch.clientX,
        startY: touch.clientY,
        timestamp: Date.now()
      });
    }

    this.gestureStartTime = Date.now();
    const touchCount = event.touches.length;

    // Single touch - could be tap, long press, or pan
    if (touchCount === 1) {
      const touch = event.touches[0];

      // Start long press timer
      this.longPressTimer = setTimeout(() => {
        this.handleLongPress(touch);
      }, this.longPressDuration);

    }
    // Two touches - pinch to zoom or rotate
    else if (touchCount === 2) {
      event.preventDefault();

      // Cancel long press
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }

      // Calculate initial pinch distance
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      this.initialPinchDistance = this.getTouchDistance(touch1, touch2);
      this.initialFov = this.camera.fov;

      this.gestureType = 'pinch';
      haptics.light();
    }

    this.lastTouches = Array.from(event.touches);
  }

  /**
   * Handle touch move
   * @param {TouchEvent} event
   */
  handleTouchMove(event) {
    if (!this.enabled) return;

    const touchCount = event.touches.length;

    // Cancel long press on move
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    // Single touch - pan camera (if not in interact mode)
    if (touchCount === 1 && !this.isInteractMode) {
      event.preventDefault();

      const touch = event.touches[0];
      const storedTouch = this.touches.get(touch.identifier);

      if (storedTouch) {
        const deltaX = touch.clientX - storedTouch.x;
        const deltaY = touch.clientY - storedTouch.y;

        // Pan camera
        this.panCamera(deltaX, deltaY);

        // Update stored position
        storedTouch.x = touch.clientX;
        storedTouch.y = touch.clientY;

        this.gestureType = 'pan';
      }
    }
    // Two touches - pinch to zoom or rotate
    else if (touchCount === 2) {
      event.preventDefault();

      const touch1 = event.touches[0];
      const touch2 = event.touches[1];

      // Pinch to zoom
      const currentDistance = this.getTouchDistance(touch1, touch2);
      const distanceDelta = currentDistance - this.initialPinchDistance;

      this.zoomCamera(distanceDelta);

      // Optional: Two-finger rotate
      const angle = this.getTouchAngle(touch1, touch2);
      const lastTouch1 = this.lastTouches[0];
      const lastTouch2 = this.lastTouches[1];

      if (lastTouch1 && lastTouch2) {
        const lastAngle = this.getTouchAngle(lastTouch1, lastTouch2);
        const angleDelta = angle - lastAngle;

        if (Math.abs(angleDelta) > 0.01) {
          this.rotateCamera(angleDelta);
        }
      }

      this.initialPinchDistance = currentDistance;
      this.gestureType = 'pinch';
    }

    this.lastTouches = Array.from(event.touches);
  }

  /**
   * Handle touch end
   * @param {TouchEvent} event
   */
  handleTouchEnd(event) {
    if (!this.enabled) return;

    // Cancel long press
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    // Check for tap gesture (short touch, no movement)
    if (event.changedTouches.length === 1) {
      const touch = event.changedTouches[0];
      const storedTouch = this.touches.get(touch.identifier);

      if (storedTouch) {
        const distance = Math.sqrt(
          Math.pow(touch.clientX - storedTouch.startX, 2) +
          Math.pow(touch.clientY - storedTouch.startY, 2)
        );
        const duration = Date.now() - storedTouch.timestamp;

        // Tap detected (short duration, minimal movement)
        if (distance < this.tapThreshold && duration < 300) {
          // Check for double tap
          const timeSinceLastTap = Date.now() - this.lastTapTime;
          if (timeSinceLastTap < this.doubleTapDelay) {
            this.handleDoubleTap(touch);
          } else {
            this.handleTap(touch);
          }
          this.lastTapTime = Date.now();
        }
      }

      // Remove touch from map
      this.touches.delete(touch.identifier);
    }

    // Remove all ended touches
    for (let i = 0; i < event.changedTouches.length; i++) {
      this.touches.delete(event.changedTouches[i].identifier);
    }

    // Reset gesture type
    this.gestureType = null;
    this.lastTouches = [];
  }

  /**
   * Pan camera based on touch delta
   * @param {number} deltaX X movement
   * @param {number} deltaY Y movement
   */
  panCamera(deltaX, deltaY) {
    if (!this.camera) return;

    // Move camera in local space
    this.camera.position.x -= deltaX * this.panSpeed;
    this.camera.position.z -= deltaY * this.panSpeed;

    // Update controls target if available
    if (this.controls && this.controls.target) {
      this.controls.target.x -= deltaX * this.panSpeed;
      this.controls.target.z -= deltaY * this.panSpeed;
    }
  }

  /**
   * Zoom camera based on pinch distance
   * @param {number} delta Distance change
   */
  zoomCamera(delta) {
    if (!this.camera) return;

    // Adjust field of view
    const newFov = this.camera.fov - delta * this.zoomSpeed;
    this.camera.fov = Math.max(10, Math.min(120, newFov));
    this.camera.updateProjectionMatrix();
  }

  /**
   * Rotate camera based on two-finger rotation
   * @param {number} angle Rotation angle delta
   */
  rotateCamera(angle) {
    if (!this.camera) return;

    // Rotate camera around Y axis
    this.camera.rotation.y += angle * this.rotateSpeed;
  }

  /**
   * Handle tap gesture
   * @param {Touch} touch
   */
  handleTap(touch) {
    // Emit custom event for tap
    const event = new CustomEvent('touch-tap', {
      detail: {
        x: touch.clientX,
        y: touch.clientY
      }
    });
    this.canvas.dispatchEvent(event);

    haptics.selection();
  }

  /**
   * Handle double tap gesture
   * @param {Touch} touch
   */
  handleDoubleTap(touch) {
    // Reset camera FOV
    this.camera.fov = this.initialFov;
    this.camera.updateProjectionMatrix();

    // Emit custom event
    const event = new CustomEvent('touch-doubletap', {
      detail: {
        x: touch.clientX,
        y: touch.clientY
      }
    });
    this.canvas.dispatchEvent(event);

    haptics.medium();
    console.log('Double tap - camera reset');
  }

  /**
   * Handle long press gesture
   * @param {Touch} touch
   */
  handleLongPress(touch) {
    // Emit custom event for long press
    const event = new CustomEvent('touch-longpress', {
      detail: {
        x: touch.clientX,
        y: touch.clientY
      }
    });
    this.canvas.dispatchEvent(event);

    haptics.heavy();
    console.log('Long press detected');
  }

  /**
   * Get distance between two touches
   * @param {Touch} touch1
   * @param {Touch} touch2
   * @returns {number} Distance
   */
  getTouchDistance(touch1, touch2) {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get angle between two touches
   * @param {Touch} touch1
   * @param {Touch} touch2
   * @returns {number} Angle in radians
   */
  getTouchAngle(touch1, touch2) {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.atan2(dy, dx);
  }

  /**
   * Toggle between camera control mode and interact mode
   */
  toggleMode() {
    this.isInteractMode = !this.isInteractMode;
    console.log('Touch mode:', this.isInteractMode ? 'Interact' : 'Camera Control');
    return this.isInteractMode;
  }

  /**
   * Set interact mode
   * @param {boolean} enabled
   */
  setInteractMode(enabled) {
    this.isInteractMode = enabled;
    console.log('Touch interact mode:', enabled);
  }

  /**
   * Enable touch controls
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable touch controls
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Check if touch controls are enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Get current gesture type
   * @returns {string|null}
   */
  getCurrentGesture() {
    return this.gestureType;
  }

  /**
   * Cleanup and remove all event listeners
   */
  dispose() {
    if (this.canvas && this.boundHandlers.touchStart) {
      this.canvas.removeEventListener('touchstart', this.boundHandlers.touchStart);
      this.canvas.removeEventListener('touchmove', this.boundHandlers.touchMove);
      this.canvas.removeEventListener('touchend', this.boundHandlers.touchEnd);
      this.canvas.removeEventListener('touchcancel', this.boundHandlers.touchEnd);
    }

    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    // Clear bound handlers
    this.boundHandlers = {
      touchStart: null,
      touchMove: null,
      touchEnd: null
    };

    this.touches.clear();
    this.enabled = false;
    console.log('Touch controls disposed');
  }

  /**
   * Destroy (alias for dispose)
   */
  destroy() {
    this.dispose();
  }
}

// Create singleton instance
const touchControls = new TouchControls();

export default touchControls;
export { touchControls };
