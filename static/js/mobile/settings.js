// Mobile settings panel
// Allows users to configure mobile-specific settings

import { isMobile, isLowEndDevice } from '../utils/device-detect.js';
import { haptics, toggleHaptics, areHapticsEnabled } from '../utils/haptics.js';
import { tutorial } from './tutorial.js';

class MobileSettings {
  constructor() {
    this.panel = null;
    this.isOpen = false;

    // Settings
    this.settings = {
      graphicsQuality: 'auto',
      touchSensitivity: 1.0,
      hapticsEnabled: true,
      showTouchIndicators: true,
      autoCloseToolbar: true
    };

    this.storageKey = 'townBuilderMobileSettings';
    this.loadSettings();
  }

  /**
   * Initialize mobile settings
   */
  init() {
    if (!isMobile()) {
      console.log('Not mobile - settings panel not needed');
      return;
    }

    this.createPanel();
    console.log('Mobile settings initialized');
  }

  /**
   * Create settings panel DOM
   */
  createPanel() {
    if (this.panel) return;

    const panel = document.createElement('div');
    panel.className = 'mobile-settings';
    panel.innerHTML = `
      <div class="mobile-settings-header">
        <div class="mobile-settings-title">
          <i class="bi bi-gear-fill me-2"></i>Mobile Settings
        </div>
        <button class="btn btn-sm btn-close mobile-settings-close" aria-label="Close"></button>
      </div>

      <div class="mobile-settings-content">
        <!-- Graphics Quality -->
        <div class="mobile-setting-item">
          <div class="mobile-setting-label">Graphics Quality</div>
          <div class="mobile-setting-description">Adjust rendering quality for better performance</div>
          <select class="form-select" id="graphics-quality-select">
            <option value="auto">Auto</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <!-- Touch Sensitivity -->
        <div class="mobile-setting-item">
          <div class="mobile-setting-label">Touch Sensitivity</div>
          <div class="mobile-setting-description">Adjust how responsive touch controls are</div>
          <input type="range" class="form-range" id="touch-sensitivity-slider"
                 min="0.5" max="2" step="0.1" value="1.0">
          <div class="d-flex justify-content-between">
            <small>Less Sensitive</small>
            <small>More Sensitive</small>
          </div>
        </div>

        <!-- Haptic Feedback -->
        <div class="mobile-setting-item">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <div class="mobile-setting-label">Haptic Feedback</div>
              <div class="mobile-setting-description">Vibrate on interactions</div>
            </div>
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" id="haptics-toggle"
                     style="width: 48px; height: 24px;">
            </div>
          </div>
        </div>

        <!-- Touch Indicators -->
        <div class="mobile-setting-item">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <div class="mobile-setting-label">Show Touch Indicators</div>
              <div class="mobile-setting-description">Visual feedback for touch points</div>
            </div>
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" id="touch-indicators-toggle"
                     style="width: 48px; height: 24px;">
            </div>
          </div>
        </div>

        <!-- Auto-Close Toolbar -->
        <div class="mobile-setting-item">
          <div class="d-flex justify-content-between align-items-center">
            <div>
              <div class="mobile-setting-label">Auto-Close Toolbar</div>
              <div class="mobile-setting-description">Close toolbar after selecting a model</div>
            </div>
            <div class="form-check form-switch">
              <input class="form-check-input" type="checkbox" id="auto-close-toggle"
                     style="width: 48px; height: 24px;">
            </div>
          </div>
        </div>

        <!-- Tutorial -->
        <div class="mobile-setting-item">
          <button class="btn btn-outline-primary w-100" id="show-tutorial-btn">
            <i class="bi bi-info-circle me-2"></i>Show Tutorial Again
          </button>
        </div>

        <!-- Device Info -->
        <div class="mobile-setting-item border-top pt-3">
          <div class="mobile-setting-label">Device Information</div>
          <div class="mobile-setting-description">
            <small class="d-block">Screen: <span id="device-screen"></span></small>
            <small class="d-block">Pixel Ratio: <span id="device-pixel-ratio"></span></small>
            <small class="d-block">Touch Support: <span id="device-touch"></span></small>
            <small class="d-block">Performance: <span id="device-performance"></span></small>
          </div>
        </div>

        <!-- Reset Settings -->
        <div class="mobile-setting-item">
          <button class="btn btn-outline-danger w-100" id="reset-settings-btn">
            <i class="bi bi-arrow-counterclockwise me-2"></i>Reset to Defaults
          </button>
        </div>
      </div>
    `;

    this.panel = panel;
    document.body.appendChild(panel);

    this.setupEventListeners();
    this.updateUI();
    this.updateDeviceInfo();
  }

  /**
   * Setup event listeners for settings controls
   */
  setupEventListeners() {
    if (!this.panel) return;

    // Close button
    const closeBtn = this.panel.querySelector('.mobile-settings-close');
    closeBtn.addEventListener('click', () => {
      this.hide();
      haptics.light();
    });

    // Graphics quality
    const graphicsSelect = this.panel.querySelector('#graphics-quality-select');
    graphicsSelect.addEventListener('change', (e) => {
      this.settings.graphicsQuality = e.target.value;
      this.saveSettings();
      this.applyGraphicsQuality();
      haptics.light();
    });

    // Touch sensitivity
    const sensitivitySlider = this.panel.querySelector('#touch-sensitivity-slider');
    sensitivitySlider.addEventListener('input', (e) => {
      this.settings.touchSensitivity = parseFloat(e.target.value);
      this.saveSettings();
      this.applyTouchSensitivity();
    });

    // Haptics toggle
    const hapticsToggle = this.panel.querySelector('#haptics-toggle');
    hapticsToggle.addEventListener('change', (e) => {
      this.settings.hapticsEnabled = e.target.checked;
      toggleHaptics();
      this.saveSettings();
      if (e.target.checked) haptics.light();
    });

    // Touch indicators toggle
    const indicatorsToggle = this.panel.querySelector('#touch-indicators-toggle');
    indicatorsToggle.addEventListener('change', (e) => {
      this.settings.showTouchIndicators = e.target.checked;
      this.saveSettings();
      this.applyTouchIndicators();
      haptics.light();
    });

    // Auto-close toggle
    const autoCloseToggle = this.panel.querySelector('#auto-close-toggle');
    autoCloseToggle.addEventListener('change', (e) => {
      this.settings.autoCloseToolbar = e.target.checked;
      this.saveSettings();
      haptics.light();
    });

    // Show tutorial button
    const tutorialBtn = this.panel.querySelector('#show-tutorial-btn');
    tutorialBtn.addEventListener('click', () => {
      this.hide();
      tutorial.show();
      haptics.medium();
    });

    // Reset settings button
    const resetBtn = this.panel.querySelector('#reset-settings-btn');
    resetBtn.addEventListener('click', () => {
      if (confirm('Reset all mobile settings to defaults?')) {
        this.resetSettings();
        haptics.heavy();
      }
    });
  }

  /**
   * Update UI with current settings
   */
  updateUI() {
    if (!this.panel) return;

    const graphicsSelect = this.panel.querySelector('#graphics-quality-select');
    const sensitivitySlider = this.panel.querySelector('#touch-sensitivity-slider');
    const hapticsToggle = this.panel.querySelector('#haptics-toggle');
    const indicatorsToggle = this.panel.querySelector('#touch-indicators-toggle');
    const autoCloseToggle = this.panel.querySelector('#auto-close-toggle');

    graphicsSelect.value = this.settings.graphicsQuality;
    sensitivitySlider.value = this.settings.touchSensitivity;
    hapticsToggle.checked = this.settings.hapticsEnabled;
    indicatorsToggle.checked = this.settings.showTouchIndicators;
    autoCloseToggle.checked = this.settings.autoCloseToolbar;
  }

  /**
   * Update device info display
   */
  updateDeviceInfo() {
    if (!this.panel) return;

    const screenInfo = this.panel.querySelector('#device-screen');
    const pixelRatioInfo = this.panel.querySelector('#device-pixel-ratio');
    const touchInfo = this.panel.querySelector('#device-touch');
    const performanceInfo = this.panel.querySelector('#device-performance');

    screenInfo.textContent = `${window.innerWidth}x${window.innerHeight}`;
    pixelRatioInfo.textContent = window.devicePixelRatio || 1;
    touchInfo.textContent = 'ontouchstart' in window ? 'Yes' : 'No';
    performanceInfo.textContent = isLowEndDevice() ? 'Low-End' : 'Standard';
  }

  /**
   * Apply graphics quality setting
   */
  applyGraphicsQuality() {
    const quality = this.settings.graphicsQuality;
    console.log('Applying graphics quality:', quality);

    // Emit event for scene to adjust quality
    const event = new CustomEvent('graphics-quality-change', {
      detail: { quality }
    });
    window.dispatchEvent(event);
  }

  /**
   * Apply touch sensitivity setting
   */
  applyTouchSensitivity() {
    const sensitivity = this.settings.touchSensitivity;
    console.log('Applying touch sensitivity:', sensitivity);

    // Emit event for touch controls to adjust
    const event = new CustomEvent('touch-sensitivity-change', {
      detail: { sensitivity }
    });
    window.dispatchEvent(event);
  }

  /**
   * Apply touch indicators setting
   */
  applyTouchIndicators() {
    const show = this.settings.showTouchIndicators;
    console.log('Touch indicators:', show ? 'enabled' : 'disabled');

    // Emit event
    const event = new CustomEvent('touch-indicators-change', {
      detail: { enabled: show }
    });
    window.dispatchEvent(event);
  }

  /**
   * Load settings from localStorage
   */
  loadSettings() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.settings = { ...this.settings, ...JSON.parse(stored) };
      }

      // Auto-detect graphics quality if set to auto
      if (this.settings.graphicsQuality === 'auto') {
        this.settings.graphicsQuality = isLowEndDevice() ? 'low' : 'medium';
      }

      console.log('Settings loaded:', this.settings);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  /**
   * Save settings to localStorage
   */
  saveSettings() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
      console.log('Settings saved');
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  /**
   * Reset settings to defaults
   */
  resetSettings() {
    this.settings = {
      graphicsQuality: 'auto',
      touchSensitivity: 1.0,
      hapticsEnabled: true,
      showTouchIndicators: true,
      autoCloseToolbar: true
    };

    this.saveSettings();
    this.updateUI();
    this.applyGraphicsQuality();
    this.applyTouchSensitivity();
    this.applyTouchIndicators();

    console.log('Settings reset to defaults');
  }

  /**
   * Show settings panel
   */
  show() {
    if (!this.panel) {
      this.createPanel();
    }

    this.panel.classList.add('show');
    this.isOpen = true;
    this.updateDeviceInfo();

    console.log('Settings panel shown');
  }

  /**
   * Hide settings panel
   */
  hide() {
    if (!this.panel) return;

    this.panel.classList.remove('show');
    this.isOpen = false;

    console.log('Settings panel hidden');
  }

  /**
   * Toggle settings panel
   */
  toggle() {
    if (this.isOpen) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Get a specific setting value
   * @param {string} key Setting key
   * @returns {*} Setting value
   */
  getSetting(key) {
    return this.settings[key];
  }

  /**
   * Check if settings panel is open
   * @returns {boolean}
   */
  isVisible() {
    return this.isOpen;
  }

  /**
   * Cleanup
   */
  dispose() {
    if (this.panel) {
      this.panel.remove();
      this.panel = null;
    }
    this.isOpen = false;
  }
}

// Create singleton instance
const mobileSettings = new MobileSettings();

export default mobileSettings;
export { mobileSettings };
