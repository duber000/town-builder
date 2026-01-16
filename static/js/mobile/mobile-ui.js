// Mobile UI management for Town Builder
// Handles bottom sheet, FAB, and mobile-specific UI interactions

import { isMobile, isTouchDevice, getViewportCategory } from '../utils/device-detect.js';
import { haptics } from '../utils/haptics.js';

class MobileUI {
  constructor() {
    this.toolbar = null;
    this.fab = null;
    this.backdrop = null;
    this.isToolbarOpen = false;
    this.isMobileDevice = isMobile();
    this.isTouchSupported = isTouchDevice();
    this.touchStartY = 0;
    this.isDragging = false;

    // Store bound event handlers for cleanup
    this.boundHandlers = {
      fabClick: null,
      backdropClick: null,
      touchStart: null,
      touchMove: null,
      touchEnd: null,
      orientationChange: null,
      resize: null
    };
  }

  /**
   * Initialize mobile UI components
   */
  init() {
    if (!this.isMobileDevice) {
      console.log('Desktop mode - mobile UI disabled');
      return;
    }

    console.log('Initializing mobile UI...');

    this.toolbar = document.getElementById('toolbar');
    this.createFAB();
    this.createBackdrop();
    this.setupToolbarGestures();
    this.setupOrientationHandler();

    // Hide user list on mobile
    const userList = document.getElementById('user-list');
    if (userList) {
      userList.style.display = 'none';
    }

    console.log('Mobile UI initialized');
  }

  /**
   * Create Floating Action Button (FAB)
   */
  createFAB() {
    // Create FAB if it doesn't exist
    let fab = document.getElementById('mobile-fab');
    if (!fab) {
      fab = document.createElement('button');
      fab.id = 'mobile-fab';
      fab.className = 'fab btn btn-primary';
      fab.innerHTML = '<i class="bi bi-list"></i>';
      fab.setAttribute('aria-label', 'Toggle menu');
      document.body.appendChild(fab);
    }

    this.fab = fab;

    // FAB click handler - store bound function
    this.boundHandlers.fabClick = () => {
      this.toggleToolbar();
      haptics.light();
    };
    this.fab.addEventListener('click', this.boundHandlers.fabClick);

    console.log('FAB created');
  }

  /**
   * Create backdrop overlay for bottom sheet
   */
  createBackdrop() {
    let backdrop = document.getElementById('mobile-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'mobile-backdrop';
      backdrop.className = 'mobile-backdrop';
      document.body.appendChild(backdrop);
    }

    this.backdrop = backdrop;

    // Backdrop click closes toolbar - store bound function
    this.boundHandlers.backdropClick = () => {
      this.closeToolbar();
      haptics.light();
    };
    this.backdrop.addEventListener('click', this.boundHandlers.backdropClick);

    console.log('Backdrop created');
  }

  /**
   * Setup touch gestures for bottom sheet dragging
   */
  setupToolbarGestures() {
    if (!this.toolbar) return;

    // Create a draggable header area (title + drag handle)
    const cardBody = this.toolbar.querySelector('.card-body');
    const cardTitle = this.toolbar.querySelector('.card-title');
    const modelContainer = this.toolbar.querySelector('#model-container');

    if (!cardBody || !cardTitle) return;

    // Touch start - begin drag (only on title area, not model container)
    this.boundHandlers.touchStart = (e) => {
      // Don't drag if touching the scrollable model container
      if (modelContainer && modelContainer.contains(e.target)) {
        this.isDragging = false;
        return;
      }

      // Don't drag if touching mode buttons or bottom section controls
      const target = e.target;
      if (target.closest('.mode-buttons') ||
          target.closest('.toolbar-bottom-section') ||
          target.closest('button') ||
          target.closest('input') ||
          target.closest('select')) {
        this.isDragging = false;
        return;
      }

      const touch = e.touches[0];
      this.touchStartY = touch.clientY;
      this.isDragging = true;
    };

    // Touch move - drag toolbar
    this.boundHandlers.touchMove = (e) => {
      if (!this.isDragging) return;

      const touch = e.touches[0];
      const deltaY = touch.clientY - this.touchStartY;

      // Only allow dragging down when toolbar is open
      if (this.isToolbarOpen && deltaY > 0) {
        const newTransform = Math.min(deltaY, this.toolbar.offsetHeight - 60);
        this.toolbar.style.transform = `translateY(${newTransform}px)`;
      }
      // Allow dragging up when toolbar is closed
      else if (!this.isToolbarOpen && deltaY < 0) {
        const currentOffset = this.toolbar.offsetHeight - 60;
        const newTransform = Math.max(0, currentOffset + deltaY);
        this.toolbar.style.transform = `translateY(${newTransform}px)`;
      }
    };

    // Touch end - snap to open/closed
    this.boundHandlers.touchEnd = (e) => {
      if (!this.isDragging) return;

      const touch = e.changedTouches[0];
      const deltaY = touch.clientY - this.touchStartY;
      const threshold = 50;

      if (this.isToolbarOpen && deltaY > threshold) {
        this.closeToolbar();
      } else if (!this.isToolbarOpen && deltaY < -threshold) {
        this.openToolbar();
      } else {
        // Snap back to current state
        if (this.isToolbarOpen) {
          this.toolbar.style.transform = 'translateY(0)';
        } else {
          this.toolbar.style.transform = `translateY(calc(100% - var(--bottom-sheet-peek)))`;
        }
      }

      this.isDragging = false;
    };

    this.toolbar.addEventListener('touchstart', this.boundHandlers.touchStart, { passive: true });
    this.toolbar.addEventListener('touchmove', this.boundHandlers.touchMove, { passive: true });
    this.toolbar.addEventListener('touchend', this.boundHandlers.touchEnd, { passive: true });
  }

  /**
   * Setup orientation change handler
   */
  setupOrientationHandler() {
    this.boundHandlers.orientationChange = () => {
      setTimeout(() => {
        console.log('Orientation changed:', getViewportCategory());
        // Reset toolbar position
        if (this.isToolbarOpen) {
          this.toolbar.style.transform = 'translateY(0)';
        }
      }, 100);
    };

    this.boundHandlers.resize = () => {
      // Check if switched from mobile to desktop
      const wasMobile = this.isMobileDevice;
      this.isMobileDevice = isMobile();

      if (wasMobile && !this.isMobileDevice) {
        // Switched to desktop - cleanup mobile UI
        this.cleanup();
      } else if (!wasMobile && this.isMobileDevice) {
        // Switched to mobile - reinitialize
        this.init();
      }
    };

    window.addEventListener('orientationchange', this.boundHandlers.orientationChange);
    window.addEventListener('resize', this.boundHandlers.resize);
  }

  /**
   * Toggle toolbar open/closed
   */
  toggleToolbar() {
    if (this.isToolbarOpen) {
      this.closeToolbar();
    } else {
      this.openToolbar();
    }
  }

  /**
   * Open the toolbar
   */
  openToolbar() {
    if (!this.toolbar || !this.backdrop) return;

    this.toolbar.classList.add('open');
    this.backdrop.classList.add('show');
    this.isToolbarOpen = true;

    // Update FAB icon
    if (this.fab) {
      this.fab.querySelector('i').className = 'bi bi-x-lg';
    }

    haptics.light();
    console.log('Toolbar opened');
  }

  /**
   * Close the toolbar
   */
  closeToolbar() {
    if (!this.toolbar || !this.backdrop) return;

    this.toolbar.classList.remove('open');
    this.backdrop.classList.remove('show');
    this.isToolbarOpen = false;

    // Reset transform
    this.toolbar.style.transform = '';

    // Update FAB icon
    if (this.fab) {
      this.fab.querySelector('i').className = 'bi bi-list';
    }

    haptics.light();
    console.log('Toolbar closed');
  }

  /**
   * Show camera mode indicator
   * @param {string} mode - Camera mode (e.g., 'Camera Control', 'Interact Mode')
   */
  showCameraModeIndicator(mode) {
    let indicator = document.getElementById('camera-mode-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'camera-mode-indicator';
      indicator.className = 'camera-mode-indicator bg-primary text-white';
      document.body.appendChild(indicator);
    }

    indicator.textContent = mode;
    indicator.classList.add('show');

    // Auto-hide after 2 seconds
    setTimeout(() => {
      indicator.classList.remove('show');
    }, 2000);
  }

  /**
   * Cleanup mobile UI and remove all event listeners
   */
  cleanup() {
    // Remove FAB event listeners
    if (this.fab && this.boundHandlers.fabClick) {
      this.fab.removeEventListener('click', this.boundHandlers.fabClick);
      this.fab.remove();
      this.fab = null;
    }

    // Remove backdrop event listeners
    if (this.backdrop && this.boundHandlers.backdropClick) {
      this.backdrop.removeEventListener('click', this.boundHandlers.backdropClick);
      this.backdrop.remove();
      this.backdrop = null;
    }

    // Remove toolbar gesture listeners
    if (this.toolbar) {
      if (this.boundHandlers.touchStart) {
        this.toolbar.removeEventListener('touchstart', this.boundHandlers.touchStart);
      }
      if (this.boundHandlers.touchMove) {
        this.toolbar.removeEventListener('touchmove', this.boundHandlers.touchMove);
      }
      if (this.boundHandlers.touchEnd) {
        this.toolbar.removeEventListener('touchend', this.boundHandlers.touchEnd);
      }
      this.toolbar.classList.remove('open');
      this.toolbar.style.transform = '';
    }

    // Remove window event listeners
    if (this.boundHandlers.orientationChange) {
      window.removeEventListener('orientationchange', this.boundHandlers.orientationChange);
    }
    if (this.boundHandlers.resize) {
      window.removeEventListener('resize', this.boundHandlers.resize);
    }

    // Clear bound handlers
    this.boundHandlers = {
      fabClick: null,
      backdropClick: null,
      touchStart: null,
      touchMove: null,
      touchEnd: null,
      orientationChange: null,
      resize: null
    };

    console.log('Mobile UI cleaned up');
  }

  /**
   * Destroy the mobile UI instance (alias for cleanup)
   */
  destroy() {
    this.cleanup();
  }

  /**
   * Check if mobile UI is active
   * @returns {boolean}
   */
  isActive() {
    return this.isMobileDevice;
  }

  /**
   * Check if toolbar is open
   * @returns {boolean}
   */
  isOpen() {
    return this.isToolbarOpen;
  }
}

// Create singleton instance
const mobileUI = new MobileUI();

export default mobileUI;
export { mobileUI };
