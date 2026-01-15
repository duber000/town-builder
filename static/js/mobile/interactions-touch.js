// Touch-based object interactions for mobile
// Handles placing, editing, and deleting objects with touch gestures

import { isTouchDevice } from '../utils/device-detect.js';
import { haptics } from '../utils/haptics.js';

class TouchInteractions {
  constructor() {
    this.enabled = false;
    this.canvas = null;
    this.scene = null;
    this.camera = null;
    this.raycaster = null;

    // Current mode ('place', 'edit', 'delete', 'drive')
    this.mode = 'place';

    // Touch state for object manipulation
    this.touchStartPos = { x: 0, y: 0 };
    this.touchCurrentPos = { x: 0, y: 0 };
    this.isTouching = false;
    this.touchStartTime = 0;

    // Selected object for editing
    this.selectedObject = null;
    this.objectInitialPosition = null;
    this.objectInitialRotation = null;

    // Two-finger gesture state for rotation/scale
    this.initialTwoFingerDistance = 0;
    this.initialTwoFingerAngle = 0;
    this.isTwoFingerGesture = false;

    // Callbacks
    this.onPlaceObject = null;
    this.onSelectObject = null;
    this.onMoveObject = null;
    this.onRotateObject = null;
    this.onDeleteObject = null;

    console.log('TouchInteractions initialized');
  }

  /**
   * Initialize touch interactions
   * @param {HTMLCanvasElement} canvas
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   * @param {THREE.Raycaster} raycaster
   */
  init(canvas, scene, camera, raycaster) {
    if (!isTouchDevice()) {
      console.log('Touch not supported');
      return;
    }

    this.canvas = canvas;
    this.scene = scene;
    this.camera = camera;
    this.raycaster = raycaster;

    this.setupEventListeners();
    this.enabled = true;

    console.log('Touch interactions enabled');
  }

  /**
   * Setup touch event listeners
   */
  setupEventListeners() {
    if (!this.canvas) return;

    // Listen for custom touch events from controls-touch.js
    this.canvas.addEventListener('touch-tap', this.handleTap.bind(this));
    this.canvas.addEventListener('touch-doubletap', this.handleDoubleTap.bind(this));
    this.canvas.addEventListener('touch-longpress', this.handleLongPress.bind(this));

    // Direct touch events for drag operations
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });

    console.log('Touch interaction listeners attached');
  }

  /**
   * Handle touch start
   * @param {TouchEvent} event
   */
  handleTouchStart(event) {
    if (!this.enabled || this.mode === 'drive') return;

    const touch = event.touches[0];
    this.touchStartPos = { x: touch.clientX, y: touch.clientY };
    this.touchCurrentPos = { x: touch.clientX, y: touch.clientY };
    this.isTouching = true;
    this.touchStartTime = Date.now();

    // Two-finger gesture detection for edit mode
    if (event.touches.length === 2 && this.mode === 'edit' && this.selectedObject) {
      event.preventDefault();
      this.isTwoFingerGesture = true;

      const touch1 = event.touches[0];
      const touch2 = event.touches[1];

      this.initialTwoFingerDistance = this.getTouchDistance(touch1, touch2);
      this.initialTwoFingerAngle = this.getTouchAngle(touch1, touch2);

      // Store initial object state
      if (this.selectedObject) {
        this.objectInitialRotation = this.selectedObject.rotation.y;
      }
    }
  }

  /**
   * Handle touch move
   * @param {TouchEvent} event
   */
  handleTouchMove(event) {
    if (!this.enabled || !this.isTouching) return;

    const touch = event.touches[0];
    this.touchCurrentPos = { x: touch.clientX, y: touch.clientY };

    // Edit mode - drag object
    if (this.mode === 'edit' && this.selectedObject) {
      event.preventDefault();

      // Two-finger gesture - rotate object
      if (event.touches.length === 2 && this.isTwoFingerGesture) {
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];

        // Rotation
        const currentAngle = this.getTouchAngle(touch1, touch2);
        const angleDelta = currentAngle - this.initialTwoFingerAngle;

        if (this.selectedObject && this.objectInitialRotation !== null) {
          this.selectedObject.rotation.y = this.objectInitialRotation + angleDelta;

          // Trigger callback
          if (this.onRotateObject) {
            this.onRotateObject(this.selectedObject, this.selectedObject.rotation.y);
          }
        }
      }
      // Single-finger - drag object
      else if (event.touches.length === 1) {
        this.dragObject(touch);
      }
    }
  }

  /**
   * Handle touch end
   * @param {TouchEvent} event
   */
  handleTouchEnd(event) {
    if (!this.enabled) return;

    this.isTouching = false;
    this.isTwoFingerGesture = false;
    this.initialTwoFingerDistance = 0;
    this.initialTwoFingerAngle = 0;
  }

  /**
   * Handle tap gesture
   * @param {CustomEvent} event
   */
  handleTap(event) {
    if (!this.enabled) return;

    const { x, y } = event.detail;

    switch (this.mode) {
      case 'place':
        this.placeObjectAtTouch(x, y);
        break;

      case 'edit':
        this.selectObjectAtTouch(x, y);
        break;

      case 'delete':
        this.deleteObjectAtTouch(x, y);
        break;
    }
  }

  /**
   * Handle double tap gesture
   * @param {CustomEvent} event
   */
  handleDoubleTap(event) {
    if (!this.enabled) return;

    // Double tap in edit mode deselects object
    if (this.mode === 'edit' && this.selectedObject) {
      this.deselectObject();
      haptics.light();
    }
  }

  /**
   * Handle long press gesture
   * @param {CustomEvent} event
   */
  handleLongPress(event) {
    if (!this.enabled) return;

    const { x, y } = event.detail;

    // Long press in place mode - preview and drag placement
    if (this.mode === 'place') {
      console.log('Long press - drag to place');
      haptics.heavy();
    }
    // Long press in edit mode - show context menu (future)
    else if (this.mode === 'edit') {
      console.log('Long press - context menu');
    }
  }

  /**
   * Place object at touch position
   * @param {number} x Screen X position
   * @param {number} y Screen Y position
   */
  placeObjectAtTouch(x, y) {
    if (!this.raycaster || !this.camera) return;

    // Convert touch coordinates to normalized device coordinates
    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((x - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((y - rect.top) / rect.height) * 2 + 1;

    // Raycast to find ground position
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);

    // Find intersection with ground plane (y=0)
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectionPoint = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(groundPlane, intersectionPoint);

    if (intersectionPoint) {
      // Trigger place callback
      if (this.onPlaceObject) {
        this.onPlaceObject(intersectionPoint);
        haptics.medium();
      }
    }
  }

  /**
   * Select object at touch position
   * @param {number} x Screen X position
   * @param {number} y Screen Y position
   */
  selectObjectAtTouch(x, y) {
    if (!this.raycaster || !this.camera || !this.scene) return;

    // Convert touch coordinates to normalized device coordinates
    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((x - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((y - rect.top) / rect.height) * 2 + 1;

    // Raycast to find objects
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);

    // Get all objects in scene (filter out helpers, ground, etc.)
    const selectableObjects = [];
    this.scene.traverse((object) => {
      if (object.isMesh && object.userData && object.userData.id) {
        selectableObjects.push(object);
      }
    });

    const intersects = this.raycaster.intersectObjects(selectableObjects, true);

    if (intersects.length > 0) {
      // Find the top-level object
      let object = intersects[0].object;
      while (object.parent && !object.userData.id) {
        object = object.parent;
      }

      // Select object
      this.selectObject(object);
      haptics.light();
    } else {
      // Deselect if tapping empty space
      this.deselectObject();
    }
  }

  /**
   * Delete object at touch position
   * @param {number} x Screen X position
   * @param {number} y Screen Y position
   */
  deleteObjectAtTouch(x, y) {
    if (!this.raycaster || !this.camera || !this.scene) return;

    // Convert touch coordinates to normalized device coordinates
    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((x - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((y - rect.top) / rect.height) * 2 + 1;

    // Raycast to find objects
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);

    const selectableObjects = [];
    this.scene.traverse((object) => {
      if (object.isMesh && object.userData && object.userData.id) {
        selectableObjects.push(object);
      }
    });

    const intersects = this.raycaster.intersectObjects(selectableObjects, true);

    if (intersects.length > 0) {
      let object = intersects[0].object;
      while (object.parent && !object.userData.id) {
        object = object.parent;
      }

      // Show confirmation dialog
      this.confirmDelete(object);
    }
  }

  /**
   * Drag selected object
   * @param {Touch} touch
   */
  dragObject(touch) {
    if (!this.selectedObject || !this.raycaster || !this.camera) return;

    // Convert touch coordinates to normalized device coordinates
    const rect = this.canvas.getBoundingClientRect();
    const ndcX = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

    // Raycast to ground plane
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);

    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectionPoint = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(groundPlane, intersectionPoint);

    if (intersectionPoint) {
      // Update object position (keep Y the same)
      this.selectedObject.position.x = intersectionPoint.x;
      this.selectedObject.position.z = intersectionPoint.z;

      // Trigger callback
      if (this.onMoveObject) {
        this.onMoveObject(this.selectedObject, intersectionPoint);
      }
    }
  }

  /**
   * Select an object
   * @param {THREE.Object3D} object
   */
  selectObject(object) {
    // Deselect previous object
    if (this.selectedObject) {
      this.deselectObject();
    }

    this.selectedObject = object;
    this.objectInitialPosition = object.position.clone();
    this.objectInitialRotation = object.rotation.y;

    // Visual feedback (add outline or highlight)
    // This would be handled by the scene manager

    // Trigger callback
    if (this.onSelectObject) {
      this.onSelectObject(object);
    }

    console.log('Object selected:', object.userData.id);
  }

  /**
   * Deselect current object
   */
  deselectObject() {
    if (this.selectedObject) {
      // Remove visual feedback
      this.selectedObject = null;
      this.objectInitialPosition = null;
      this.objectInitialRotation = null;

      // Trigger callback
      if (this.onSelectObject) {
        this.onSelectObject(null);
      }

      console.log('Object deselected');
    }
  }

  /**
   * Show delete confirmation dialog
   * @param {THREE.Object3D} object
   */
  confirmDelete(object) {
    // Show native confirm dialog (or custom modal in production)
    const confirmed = confirm(`Delete ${object.userData.category || 'object'}?`);

    if (confirmed && this.onDeleteObject) {
      this.onDeleteObject(object);
      haptics.heavy();
    }
  }

  /**
   * Get distance between two touches
   * @param {Touch} touch1
   * @param {Touch} touch2
   * @returns {number}
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
   * @returns {number}
   */
  getTouchAngle(touch1, touch2) {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return Math.atan2(dy, dx);
  }

  /**
   * Set current interaction mode
   * @param {string} mode 'place', 'edit', 'delete', 'drive'
   */
  setMode(mode) {
    this.mode = mode;
    console.log('Touch interaction mode:', mode);

    // Deselect object when changing modes
    if (mode !== 'edit') {
      this.deselectObject();
    }
  }

  /**
   * Set callback for placing objects
   * @param {Function} callback
   */
  onPlaceObjectCallback(callback) {
    this.onPlaceObject = callback;
  }

  /**
   * Set callback for selecting objects
   * @param {Function} callback
   */
  onSelectObjectCallback(callback) {
    this.onSelectObject = callback;
  }

  /**
   * Set callback for moving objects
   * @param {Function} callback
   */
  onMoveObjectCallback(callback) {
    this.onMoveObject = callback;
  }

  /**
   * Set callback for rotating objects
   * @param {Function} callback
   */
  onRotateObjectCallback(callback) {
    this.onRotateObject = callback;
  }

  /**
   * Set callback for deleting objects
   * @param {Function} callback
   */
  onDeleteObjectCallback(callback) {
    this.onDeleteObject = callback;
  }

  /**
   * Enable touch interactions
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable touch interactions
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Cleanup
   */
  dispose() {
    if (this.canvas) {
      this.canvas.removeEventListener('touch-tap', this.handleTap);
      this.canvas.removeEventListener('touch-doubletap', this.handleDoubleTap);
      this.canvas.removeEventListener('touch-longpress', this.handleLongPress);
      this.canvas.removeEventListener('touchstart', this.handleTouchStart);
      this.canvas.removeEventListener('touchmove', this.handleTouchMove);
      this.canvas.removeEventListener('touchend', this.handleTouchEnd);
    }

    this.deselectObject();
    this.enabled = false;
    console.log('Touch interactions disposed');
  }
}

// Create singleton instance
const touchInteractions = new TouchInteractions();

export default touchInteractions;
export { touchInteractions };
