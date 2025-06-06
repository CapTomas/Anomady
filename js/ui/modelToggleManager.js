// js/ui/modelToggleManager.js
/**
 * @file Manages the UI for AI model selection and triggers updates to user preferences.
 */

import { modelToggleButton, storyLogViewport } from './domElements.js';
import {
    getCurrentModelName,
    setCurrentModelName as setStateCurrentModelName, // Renamed for clarity within this module
    getCurrentUser,
    getCurrentTheme, // To check if a game is active for logging messages
} from '../core/state.js';
import {
    PAID_MODEL_NAME,
    FREE_MODEL_NAME,
    MODEL_PREFERENCE_STORAGE_KEY // For anonymous user fallback in authService
} from '../core/config.js';
import { getUIText } from '../services/localizationService.js';
import * as authService from '../services/authService.js'; // For updating user preferences
import { log, LOG_LEVEL_INFO, LOG_LEVEL_ERROR, LOG_LEVEL_DEBUG } from '../core/logger.js';
import { attachTooltip } from './tooltipManager.js';

// Optional dependency for logging model changes to the story log
let _storyLogManagerRef = null;

/**
 * Initializes the ModelToggleManager with optional dependencies.
 * @param {object} [dependencies={}] - Optional dependencies.
 * @param {object} [dependencies.storyLogManager] - Reference to storyLogManager for in-game messages.
 */
export function initModelToggleManager(dependencies = {}) {
    if (dependencies.storyLogManager) {
        _storyLogManagerRef = dependencies.storyLogManager;
    }
    // Initial setup of the button appearance
    updateModelToggleButtonAppearance();
}

/**
 * Updates the appearance (text and ARIA attributes) of the AI model toggle button
 * based on the currently selected model in the application state.
 */
export function updateModelToggleButtonAppearance() {
    if (!modelToggleButton) {
        log(LOG_LEVEL_WARN, "Model toggle button not found in DOM. Cannot update appearance.");
        return;
    }

    const currentModel = getCurrentModelName();
    const isPaidModelCurrentlySelected = currentModel === PAID_MODEL_NAME;

    const buttonTextKey = isPaidModelCurrentlySelected ? "button_toggle_to_free" : "button_toggle_to_paid";
    const ariaLabelKey = isPaidModelCurrentlySelected ? "aria_label_current_model_paid" : "aria_label_current_model_free";

    modelToggleButton.textContent = getUIText(buttonTextKey, { MODEL_NAME: currentModel });
    const ariaLabelText = getUIText(ariaLabelKey, { MODEL_NAME: currentModel });
    modelToggleButton.setAttribute("aria-label", ariaLabelText);
    modelToggleButton.removeAttribute('title');
    attachTooltip(modelToggleButton, ariaLabelKey, { MODEL_NAME: currentModel });

    log(LOG_LEVEL_DEBUG, `Model toggle button appearance updated. Current model: ${currentModel}`);
}

/**
 * Handles the click event on the AI model toggle button.
 * It switches the model, updates user preferences (if logged in),
 * and refreshes the button's appearance.
 */
export async function handleModelToggle() {
    if (!modelToggleButton || modelToggleButton.disabled) {
        log(LOG_LEVEL_DEBUG, "Model toggle button is not available or disabled.");
        return;
    }

    const currentModel = getCurrentModelName();
    const newModelName = currentModel === PAID_MODEL_NAME ? FREE_MODEL_NAME : PAID_MODEL_NAME;

    log(LOG_LEVEL_INFO, `User toggled AI model from ${currentModel} to ${newModelName}.`);

    // Update state immediately (this also updates localStorage via the state setter)
    setStateCurrentModelName(newModelName);

    const currentUser = getCurrentUser();
    if (currentUser && currentUser.token) {
        try {
            log(LOG_LEVEL_DEBUG, `Updating backend model preference for user ${currentUser.email} to ${newModelName}.`);
            // authService.updateUserPreferences handles updating the user object in state as well
            await authService.updateUserPreferences({ preferred_model_name: newModelName });
            log(LOG_LEVEL_INFO, "Backend model preference updated successfully.");
        } catch (error) {
            log(LOG_LEVEL_ERROR, "Failed to update backend model preference:", error.message);
            // Optionally, show an error message to the user via a modal
            // For now, just log, as the local state change has already occurred.
            if (_storyLogManagerRef && getCurrentTheme() && storyLogViewport && storyLogViewport.style.display !== 'none') {
                 _storyLogManagerRef.addMessageToLog(getUIText("error_api_call_failed", { ERROR_MSG: "Could not save model preference to server." }), "system system-error");
            }
        }
    }
    // No 'else' needed for anonymous users, as setStateCurrentModelName already saved to localStorage.

    updateModelToggleButtonAppearance(); // Reflect the change in the UI

    // Add a system message to the story log if a game is active
    if (_storyLogManagerRef && getCurrentTheme() && storyLogViewport && storyLogViewport.style.display !== 'none') {
        const messageKey = newModelName === PAID_MODEL_NAME ? "system_model_set_paid" : "system_model_set_free";
        _storyLogManagerRef.addMessageToLog(getUIText(messageKey, { MODEL_NAME: newModelName }), "system");
    }
}
