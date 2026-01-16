// Haptic feedback utilities for mobile devices
// Provides tactile feedback for user interactions

/**
 * Check if haptic feedback is supported
 * @returns {boolean} True if haptics are supported
 */
export function isHapticSupported() {
  return 'vibrate' in navigator;
}

/**
 * Trigger a light haptic feedback (e.g., for selection)
 */
export function lightHaptic() {
  if (isHapticSupported()) {
    navigator.vibrate(10);
  }
}

/**
 * Trigger a medium haptic feedback (e.g., for actions)
 */
export function mediumHaptic() {
  if (isHapticSupported()) {
    navigator.vibrate(20);
  }
}

/**
 * Trigger a heavy haptic feedback (e.g., for errors or collisions)
 */
export function heavyHaptic() {
  if (isHapticSupported()) {
    navigator.vibrate(50);
  }
}

/**
 * Trigger a success haptic pattern
 */
export function successHaptic() {
  if (isHapticSupported()) {
    navigator.vibrate([10, 50, 10]);
  }
}

/**
 * Trigger an error haptic pattern
 */
export function errorHaptic() {
  if (isHapticSupported()) {
    navigator.vibrate([50, 100, 50, 100, 50]);
  }
}

/**
 * Trigger a warning haptic pattern
 */
export function warningHaptic() {
  if (isHapticSupported()) {
    navigator.vibrate([30, 50, 30]);
  }
}

/**
 * Trigger a selection change haptic (very subtle)
 */
export function selectionHaptic() {
  if (isHapticSupported()) {
    navigator.vibrate(5);
  }
}

/**
 * Trigger a custom haptic pattern
 * @param {number|number[]} pattern Vibration duration(s) in milliseconds
 */
export function customHaptic(pattern) {
  if (isHapticSupported()) {
    navigator.vibrate(pattern);
  }
}

/**
 * Cancel any ongoing vibration
 */
export function cancelHaptic() {
  if (isHapticSupported()) {
    navigator.vibrate(0);
  }
}

// Settings for haptic feedback (can be toggled by user)
let hapticsEnabled = true;

/**
 * Enable haptic feedback
 */
export function enableHaptics() {
  hapticsEnabled = true;
  localStorage.setItem('hapticsEnabled', 'true');
}

/**
 * Disable haptic feedback
 */
export function disableHaptics() {
  hapticsEnabled = false;
  localStorage.setItem('hapticsEnabled', 'false');
  cancelHaptic();
}

/**
 * Check if haptics are enabled by user preference
 * @returns {boolean} True if enabled
 */
export function areHapticsEnabled() {
  return hapticsEnabled;
}

/**
 * Toggle haptic feedback on/off
 * @returns {boolean} New state
 */
export function toggleHaptics() {
  if (hapticsEnabled) {
    disableHaptics();
  } else {
    enableHaptics();
    lightHaptic(); // Give feedback that it's enabled
  }
  return hapticsEnabled;
}

// Load user preference from localStorage
const storedPreference = localStorage.getItem('hapticsEnabled');
if (storedPreference !== null) {
  hapticsEnabled = storedPreference === 'true';
}

// Wrapper functions that respect user preference
export const haptics = {
  light: () => hapticsEnabled && lightHaptic(),
  medium: () => hapticsEnabled && mediumHaptic(),
  heavy: () => hapticsEnabled && heavyHaptic(),
  success: () => hapticsEnabled && successHaptic(),
  error: () => hapticsEnabled && errorHaptic(),
  warning: () => hapticsEnabled && warningHaptic(),
  selection: () => hapticsEnabled && selectionHaptic(),
  custom: (pattern) => hapticsEnabled && customHaptic(pattern)
};

console.log('Haptics:', {
  supported: isHapticSupported(),
  enabled: areHapticsEnabled()
});
