// Device detection utilities for mobile/tablet/desktop detection
// Helps optimize UI and interactions based on device capabilities

/**
 * Detects if the current device is a mobile device based on user agent and screen size
 * Prioritizes user agent and touch capability to avoid false positives on resized desktop browsers
 * @returns {boolean} True if device is mobile
 */
export function isMobile() {
  // Check user agent first (most reliable)
  const userAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // If user agent indicates mobile, return true
  if (userAgent) {
    return true;
  }

  // For non-mobile user agents, only consider it mobile if:
  // 1. Has touch support AND
  // 2. Small screen AND
  // 3. Has limited touch points (to exclude touch-enabled desktops)
  const hasTouch = isTouchDevice();
  const screenSize = window.innerWidth <= 768;
  const maxTouchPoints = navigator.maxTouchPoints || 0;

  // Touch-enabled desktops often have >5 touch points, mobile typically ≤5
  // Also check for narrow screen
  return hasTouch && screenSize && maxTouchPoints > 0 && maxTouchPoints <= 5;
}

/**
 * Detects if the current device is a tablet
 * @returns {boolean} True if device is tablet
 */
export function isTablet() {
  const userAgent = /iPad|Android/i.test(navigator.userAgent);
  const screenSize = window.innerWidth > 768 && window.innerWidth <= 1024;
  return userAgent && screenSize;
}

/**
 * Detects if the device supports touch events
 * @returns {boolean} True if touch is supported
 */
export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
}

/**
 * Gets the current viewport size category
 * @returns {string} 'mobile', 'tablet', or 'desktop'
 */
export function getViewportCategory() {
  const width = window.innerWidth;
  if (width <= 576) return 'mobile';
  if (width <= 992) return 'tablet';
  return 'desktop';
}

/**
 * Checks if the device is in portrait orientation
 * @returns {boolean} True if portrait
 */
export function isPortrait() {
  return window.innerHeight > window.innerWidth;
}

/**
 * Checks if the device is in landscape orientation
 * @returns {boolean} True if landscape
 */
export function isLandscape() {
  return window.innerWidth > window.innerHeight;
}

/**
 * Gets device pixel ratio for high DPI displays
 * @returns {number} Device pixel ratio
 */
export function getPixelRatio() {
  return window.devicePixelRatio || 1;
}

/**
 * Estimates if the device is low-end based on hardware concurrency
 * @returns {boolean} True if likely low-end device
 */
export function isLowEndDevice() {
  // Check hardware concurrency (CPU cores)
  const cores = navigator.hardwareConcurrency || 2;

  // Check memory if available (Chrome/Edge)
  const memory = navigator.deviceMemory || 4;

  return cores <= 2 || memory <= 2;
}

/**
 * Listens for orientation changes
 * @param {Function} callback Function to call when orientation changes
 * @returns {Function} Cleanup function to remove listener
 */
export function onOrientationChange(callback) {
  const handler = () => {
    callback({
      isPortrait: isPortrait(),
      isLandscape: isLandscape(),
      width: window.innerWidth,
      height: window.innerHeight
    });
  };

  window.addEventListener('orientationchange', handler);
  window.addEventListener('resize', handler);

  // Return cleanup function
  return () => {
    window.removeEventListener('orientationchange', handler);
    window.removeEventListener('resize', handler);
  };
}

/**
 * Detects iOS devices specifically
 * @returns {boolean} True if iOS device
 */
export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

/**
 * Detects Android devices specifically
 * @returns {boolean} True if Android device
 */
export function isAndroid() {
  return /Android/.test(navigator.userAgent);
}

/**
 * Gets safe area insets for devices with notches
 * @returns {Object} Safe area insets {top, right, bottom, left}
 */
export function getSafeAreaInsets() {
  const style = getComputedStyle(document.documentElement);

  return {
    top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0'),
    right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0'),
    bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom') || '0'),
    left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0')
  };
}

// Auto-detect and log device info on import (for debugging)
console.log('Device Info:', {
  isMobile: isMobile(),
  isTablet: isTablet(),
  isTouchDevice: isTouchDevice(),
  viewport: getViewportCategory(),
  orientation: isPortrait() ? 'portrait' : 'landscape',
  pixelRatio: getPixelRatio(),
  isLowEnd: isLowEndDevice()
});
