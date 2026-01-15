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

    // FAB click handler
    this.fab.addEventListener('click', () => {
      this.toggleToolbar();
      haptics.light();
    });

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

    // Backdrop click closes toolbar
    this.backdrop.addEventListener('click', () => {
      this.closeToolbar();
      haptics.light();
    });

    console.log('Backdrop created');
  }

  /**
   * Setup touch gestures for bottom sheet dragging
   */
  setupToolbarGestures() {
    if (!this.toolbar) return;

    // Touch start - begin drag
    this.toolbar.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      this.touchStartY = touch.clientY;
      this.isDragging = true;
    }, { passive: true });

    // Touch move - drag toolbar
    this.toolbar.addEventListener('touchmove', (e) => {
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
    }, { passive: true });

    // Touch end - snap to open/closed
    this.toolbar.addEventListener('touchend', (e) => {
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
    }, { passive: true });
  }

  /**
   * Setup orientation change handler
   */
  setupOrientationHandler() {
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        console.log('Orientation changed:', getViewportCategory());
        // Reset toolbar position
        if (this.isToolbarOpen) {
          this.toolbar.style.transform = 'translateY(0)';
        }
      }, 100);
    });

    window.addEventListener('resize', () => {
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
    });
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
   * Cleanup mobile UI
   */
  cleanup() {
    if (this.fab) {
      this.fab.remove();
      this.fab = null;
    }

    if (this.backdrop) {
      this.backdrop.remove();
      this.backdrop = null;
    }

    if (this.toolbar) {
      this.toolbar.classList.remove('open');
      this.toolbar.style.transform = '';
    }

    console.log('Mobile UI cleaned up');
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
