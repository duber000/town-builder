// Mobile integration module
// Syncs mobile modules with the main application (UI modes, settings, etc.)

import { isMobile } from '../utils/device-detect.js';
import mobileUI from './mobile-ui.js';
import touchControls from './controls-touch.js';
import touchInteractions from './interactions-touch.js';
import mobileSettings from './settings.js';
import { haptics } from '../utils/haptics.js';

class MobileIntegration {
  constructor() {
    this.isActive = false;
    this.currentMode = 'place';
  }

  /**
   * Initialize mobile integration
   */
  init() {
    if (!isMobile()) {
      console.log('Not mobile - integration not needed');
      return;
    }

    this.isActive = true;

    // Listen for mode changes
    this.setupModeChangeListener();

    // Listen for settings changes
    this.setupSettingsListeners();

    // Sync initial mode
    this.syncMode('place');

    console.log('Mobile integration initialized');
  }

  /**
   * Setup listener for UI mode changes
   */
  setupModeChangeListener() {
    // Create a custom event listener for mode changes
    // UI code should dispatch 'mode-change' events
    window.addEventListener('mode-change', (event) => {
      const { mode } = event.detail;
      this.syncMode(mode);
    });

    // Also listen for model selection
    window.addEventListener('model-selected', (event) => {
      const { category, modelName } = event.detail;
      this.handleModelSelection(category, modelName);
    });
  }

  /**
   * Setup listeners for mobile settings changes
   */
  setupSettingsListeners() {
    // Graphics quality change
    window.addEventListener('graphics-quality-change', (event) => {
      const { quality } = event.detail;
      this.applyGraphicsQuality(quality);
    });

    // Touch sensitivity change
    window.addEventListener('touch-sensitivity-change', (event) => {
      const { sensitivity } = event.detail;
      this.applyTouchSensitivity(sensitivity);
    });

    // Touch indicators change
    window.addEventListener('touch-indicators-change', (event) => {
      const { enabled } = event.detail;
      this.applyTouchIndicators(enabled);
    });
  }

  /**
   * Sync mode across all mobile modules
   * @param {string} mode - 'place', 'edit', 'delete', 'drive'
   */
  syncMode(mode) {
    this.currentMode = mode;

    // Update touch interactions mode
    if (touchInteractions.isEnabled && touchInteractions.isEnabled()) {
      touchInteractions.setMode(mode);
    }

    // Enable/disable touch controls based on mode
    if (mode === 'drive') {
      // In drive mode, disable camera touch controls
      // (driving is handled by keyboard/joystick)
      if (touchControls.isEnabled && touchControls.isEnabled()) {
        touchControls.disable();
      }
    } else {
      // In other modes, enable camera touch controls
      if (touchControls.enable) {
        touchControls.enable();
      }
    }

    // Auto-close toolbar if setting is enabled
    if (mode !== 'drive' && mobileSettings.getSetting && mobileSettings.getSetting('autoCloseToolbar')) {
      // Small delay to allow user to see selection
      setTimeout(() => {
        if (mobileUI.isOpen && mobileUI.isOpen()) {
          mobileUI.closeToolbar();
        }
      }, 300);
    }

    console.log('Mobile mode synced:', mode);
  }

  /**
   * Handle model selection on mobile
   * @param {string} category
   * @param {string} modelName
   */
  handleModelSelection(category, modelName) {
    // Store pending placement details
    window.pendingPlacementModelDetails = { category, modelName };

    // Provide haptic feedback
    haptics.light();

    // Show placement hint on mobile
    if (this.currentMode === 'place') {
      this.showPlacementHint();
    }

    console.log('Model selected:', category, modelName);
  }

  /**
   * Show placement hint notification
   */
  showPlacementHint() {
    // Create temporary hint
    let hint = document.getElementById('mobile-placement-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'mobile-placement-hint';
      hint.className = 'camera-mode-indicator bg-info text-white show';
      hint.textContent = 'Tap the ground to place';
      document.body.appendChild(hint);
    } else {
      hint.classList.add('show');
    }

    // Auto-hide after 2 seconds
    setTimeout(() => {
      hint.classList.remove('show');
    }, 2000);
  }

  /**
   * Apply graphics quality setting
   * @param {string} quality - 'low', 'medium', 'high', 'auto'
   */
  applyGraphicsQuality(quality) {
    console.log('Applying graphics quality:', quality);

    // Adjust renderer settings based on quality
    // This would be implemented in scene.js or a dedicated graphics module
    const settings = {
      low: {
        antialias: false,
        shadowMapEnabled: false,
        pixelRatio: 1
      },
      medium: {
        antialias: true,
        shadowMapEnabled: false,
        pixelRatio: Math.min(window.devicePixelRatio, 2)
      },
      high: {
        antialias: true,
        shadowMapEnabled: true,
        pixelRatio: window.devicePixelRatio
      }
    };

    const config = settings[quality] || settings.medium;

    // Emit event for renderer to handle
    window.dispatchEvent(new CustomEvent('apply-graphics-settings', {
      detail: config
    }));
  }

  /**
   * Apply touch sensitivity setting
   * @param {number} sensitivity
   */
  applyTouchSensitivity(sensitivity) {
    console.log('Applying touch sensitivity:', sensitivity);

    if (touchControls.panSpeed !== undefined) {
      touchControls.panSpeed = 0.02 * sensitivity;
      touchControls.rotateSpeed = 0.005 * sensitivity;
      touchControls.zoomSpeed = 0.01 * sensitivity;
    }
  }

  /**
   * Apply touch indicators setting
   * @param {boolean} enabled
   */
  applyTouchIndicators(enabled) {
    console.log('Touch indicators:', enabled ? 'enabled' : 'disabled');

    // This would add visual indicators for touch points
    // Could be implemented with a visual debug layer
    window.mobileShowTouchIndicators = enabled;
  }

  /**
   * Check if mobile integration is active
   * @returns {boolean}
   */
  isIntegrationActive() {
    return this.isActive;
  }

  /**
   * Get current mode
   * @returns {string}
   */
  getCurrentMode() {
    return this.currentMode;
  }
}

// Create singleton instance
const mobileIntegration = new MobileIntegration();

export default mobileIntegration;
export { mobileIntegration };
