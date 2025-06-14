/**
 * @file Manages the UI for AI model selection and triggers updates to user preferences.
 */

// --- IMPORTS ---
import { modelToggleButton, storyLogViewport } from './domElements.js';
import {
  getCurrentModelName,
  setCurrentModelName,
  getCurrentUser,
  getCurrentTheme,
} from '../core/state.js';
import { PAID_MODEL_NAME, FREE_MODEL_NAME } from '../core/config.js';
import { log, LOG_LEVEL_INFO, LOG_LEVEL_ERROR, LOG_LEVEL_DEBUG, LOG_LEVEL_WARN } from '../core/logger.js';
import * as authService from '../services/authService.js';
import { getUIText } from '../services/localizationService.js';
import { attachTooltip } from './tooltipManager.js';

// --- MODULE-LEVEL STATE ---

let _storyLogManagerRef = null;

// --- INITIALIZATION ---

/**
 * Initializes the ModelToggleManager with optional dependencies.
 * @param {object} [dependencies={}] - Optional dependencies.
 * @param {object} [dependencies.storyLogManager] - Reference to storyLogManager for in-game messages.
 */
export function initModelToggleManager(dependencies = {}) {
  if (dependencies.storyLogManager) {
    _storyLogManagerRef = dependencies.storyLogManager;
  }
  updateModelToggleButtonAppearance();
}

// --- PUBLIC API ---

/**
 * Updates the appearance (text and ARIA attributes) of the AI model toggle button
 * based on the currently selected model in the application state.
 */
export function updateModelToggleButtonAppearance() {
  if (!modelToggleButton) {
    log(LOG_LEVEL_WARN, 'Model toggle button not found in DOM. Cannot update appearance.');
    return;
  }

  const currentModel = getCurrentModelName();
  const isPaidModelCurrentlySelected = currentModel === PAID_MODEL_NAME;

  const buttonTextKey = isPaidModelCurrentlySelected ? 'button_toggle_to_free' : 'button_toggle_to_paid';
  const ariaLabelKey = isPaidModelCurrentlySelected ? 'aria_label_current_model_paid' : 'aria_label_current_model_free';

  const replacements = { MODEL_NAME: currentModel };
  const buttonText = getUIText(buttonTextKey, replacements);
  const ariaLabelText = getUIText(ariaLabelKey, replacements);

  modelToggleButton.textContent = buttonText;
  modelToggleButton.setAttribute('aria-label', ariaLabelText);
  modelToggleButton.removeAttribute('title'); // Let attachTooltip handle the title/tooltip.
  attachTooltip(modelToggleButton, ariaLabelKey, replacements);

  log(LOG_LEVEL_DEBUG, `Model toggle button appearance updated. Current model: ${currentModel}`);
}

/**
 * Handles the click event on the AI model toggle button.
 * It switches the model, updates user preferences (if logged in),
 * and refreshes the button's appearance.
 */
export async function handleModelToggle() {
  if (!modelToggleButton || modelToggleButton.disabled) {
    log(LOG_LEVEL_DEBUG, 'Model toggle button is not available or disabled.');
    return;
  }

  const currentModel = getCurrentModelName();
  const newModelName = currentModel === PAID_MODEL_NAME ? FREE_MODEL_NAME : PAID_MODEL_NAME;

  log(LOG_LEVEL_INFO, `User toggled AI model from ${currentModel} to ${newModelName}.`);

  // Update state immediately. This also persists to localStorage via the state setter.
  setCurrentModelName(newModelName);

  const currentUser = getCurrentUser();
  if (currentUser?.token) {
    try {
      log(LOG_LEVEL_DEBUG, `Updating backend model preference for user ${currentUser.email} to ${newModelName}.`);
      await authService.updateUserPreferences({ preferred_model_name: newModelName });
      log(LOG_LEVEL_INFO, 'Backend model preference updated successfully.');
    } catch (error) {
      log(LOG_LEVEL_ERROR, 'Failed to update backend model preference:', error.message);
      // Optional: Show an error message to the user via a modal.
      // For now, the local state change has already occurred, so we optimistically proceed.
      if (_storyLogManagerRef && getCurrentTheme() && storyLogViewport && storyLogViewport.style.display !== 'none') {
        _storyLogManagerRef.addMessageToLog(
          getUIText('error_api_call_failed', { ERROR_MSG: 'Could not save model preference to server.' }),
          'system system-error',
        );
      }
    }
  }

  // Reflect the change in the UI.
  updateModelToggleButtonAppearance();

  // Add a system message to the story log if a game is active.
  if (_storyLogManagerRef && getCurrentTheme() && storyLogViewport && storyLogViewport.style.display !== 'none') {
    const messageKey = newModelName === PAID_MODEL_NAME ? 'system_model_set_paid' : 'system_model_set_free';
    _storyLogManagerRef.addMessageToLog(getUIText(messageKey, { MODEL_NAME: newModelName }), 'system');
  }
}
