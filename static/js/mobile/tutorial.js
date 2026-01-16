// Gesture tutorial overlay for first-time mobile users
// Shows instructions for touch gestures and controls

import { isMobile } from '../utils/device-detect.js';
import { haptics } from '../utils/haptics.js';

class Tutorial {
  constructor() {
    this.overlay = null;
    this.isShowing = false;
    this.hasShownBefore = false;
    this.storageKey = 'townBuilderTutorialShown';
  }

  /**
   * Initialize tutorial
   */
  init() {
    if (!isMobile()) {
      console.log('Not mobile - tutorial not needed');
      return;
    }

    // Check if tutorial has been shown before
    try {
      this.hasShownBefore = localStorage.getItem(this.storageKey) === 'true';
    } catch (error) {
      console.warn('Could not read tutorial state from localStorage:', error);
      this.hasShownBefore = false; // Default to showing tutorial if can't read
    }

    // Show tutorial for first-time users
    if (!this.hasShownBefore) {
      // Delay showing tutorial by 1 second to let app load
      setTimeout(() => {
        this.show();
      }, 1000);
    }

    console.log('Tutorial initialized');
  }

  /**
   * Create tutorial overlay DOM
   */
  createOverlay() {
    if (this.overlay) return;

    const overlay = document.createElement('div');
    overlay.className = 'tutorial-overlay';
    overlay.innerHTML = `
      <div class="tutorial-content">
        <div class="tutorial-title">Welcome to Town Builder!</div>
        <div class="tutorial-subtitle">Learn the touch gestures</div>

        <div class="tutorial-steps">
          <div class="tutorial-step">
            <div class="tutorial-step-icon">👆</div>
            <div class="tutorial-step-title">Single Tap</div>
            <div class="tutorial-step-description">Place objects, select items, or delete</div>
          </div>

          <div class="tutorial-step">
            <div class="tutorial-step-icon">👆👆</div>
            <div class="tutorial-step-title">Double Tap</div>
            <div class="tutorial-step-description">Reset camera zoom</div>
          </div>

          <div class="tutorial-step">
            <div class="tutorial-step-icon">🖐️</div>
            <div class="tutorial-step-title">Long Press</div>
            <div class="tutorial-step-description">Show context options</div>
          </div>

          <div class="tutorial-step">
            <div class="tutorial-step-icon">👆↔️</div>
            <div class="tutorial-step-title">One Finger Drag</div>
            <div class="tutorial-step-description">Pan camera or drag objects</div>
          </div>

          <div class="tutorial-step">
            <div class="tutorial-step-icon">🤏</div>
            <div class="tutorial-step-title">Pinch</div>
            <div class="tutorial-step-description">Zoom in and out</div>
          </div>

          <div class="tutorial-step">
            <div class="tutorial-step-icon">🔄</div>
            <div class="tutorial-step-title">Two Finger Rotate</div>
            <div class="tutorial-step-description">Rotate selected objects or camera</div>
          </div>

          <div class="tutorial-step">
            <div class="tutorial-step-icon">☰</div>
            <div class="tutorial-step-title">Menu Button</div>
            <div class="tutorial-step-description">Tap the floating button to open the toolbar</div>
          </div>
        </div>

        <div class="tutorial-buttons">
          <button class="btn btn-outline-light" id="tutorial-skip">Skip</button>
          <button class="btn btn-primary" id="tutorial-start">Got It!</button>
        </div>

        <div class="tutorial-footer mt-3">
          <small class="text-muted">You can revisit this tutorial in Settings</small>
        </div>
      </div>
    `;

    this.overlay = overlay;
    document.body.appendChild(overlay);

    // Setup button handlers
    const skipBtn = overlay.querySelector('#tutorial-skip');
    const startBtn = overlay.querySelector('#tutorial-start');

    skipBtn.addEventListener('click', () => {
      this.hide();
      haptics.light();
    });

    startBtn.addEventListener('click', () => {
      this.hide();
      this.markAsShown();
      haptics.medium();
    });
  }

  /**
   * Show tutorial overlay
   */
  show() {
    if (!this.overlay) {
      this.createOverlay();
    }

    this.overlay.style.display = 'flex';
    this.isShowing = true;

    // Animate in
    setTimeout(() => {
      this.overlay.style.animation = 'fadeIn 0.3s ease';
    }, 10);

    console.log('Tutorial shown');
  }

  /**
   * Hide tutorial overlay
   */
  hide() {
    if (!this.overlay) return;

    this.overlay.style.animation = 'fadeOut 0.3s ease';

    setTimeout(() => {
      if (this.overlay) {
        this.overlay.style.display = 'none';
      }
      this.isShowing = false;
    }, 300);

    console.log('Tutorial hidden');
  }

  /**
   * Mark tutorial as shown with error handling
   */
  markAsShown() {
    try {
      localStorage.setItem(this.storageKey, 'true');
      this.hasShownBefore = true;
      console.log('Tutorial marked as shown');
    } catch (error) {
      // Handle quota exceeded or other localStorage errors
      console.warn('Could not save tutorial state to localStorage:', error);
      // Still mark as shown in memory even if storage fails
      this.hasShownBefore = true;
    }
  }

  /**
   * Reset tutorial (for testing or user request) with error handling
   */
  reset() {
    try {
      localStorage.removeItem(this.storageKey);
      this.hasShownBefore = false;
      console.log('Tutorial reset');
    } catch (error) {
      console.warn('Could not reset tutorial state in localStorage:', error);
      // Still reset in memory even if storage fails
      this.hasShownBefore = false;
    }
  }

  /**
   * Check if tutorial is currently showing
   * @returns {boolean}
   */
  isVisible() {
    return this.isShowing;
  }

  /**
   * Remove tutorial overlay from DOM
   */
  dispose() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    this.isShowing = false;
  }
}

// CSS for fadeOut animation (add to mobile.css or inject)
const fadeOutAnimation = `
@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}
`;

// Inject animation if not already in CSS
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = fadeOutAnimation;
  document.head.appendChild(styleSheet);
}

// Create singleton instance
const tutorial = new Tutorial();

export default tutorial;
export { tutorial };
