/**
 * @file Manages the UI for AI model selection and triggers updates to user preferences based on their tier.
 */
// --- IMPORTS ---
import { modelToggleButton, storyLogViewport } from './domElements.js';
import {
  getCurrentModelName,
  setCurrentModelName,
  getCurrentUser,
  getCurrentTheme,
  getCurrentUserApiUsage,
} from '../core/state.js';
import { PRO_MODEL_NAME, FREE_MODEL_NAME, ULTRA_MODEL_NAME } from '../core/config.js';
import { log, LOG_LEVEL_INFO, LOG_LEVEL_ERROR, LOG_LEVEL_DEBUG, LOG_LEVEL_WARN } from '../core/logger.js';
import * as authService from '../services/authService.js';
import { getUIText } from '../services/localizationService.js';
import { attachTooltip } from './tooltipManager.js';

// --- MODULE-LEVEL STATE ---
let _storyLogManagerRef = null;
const LOW_API_CALL_THRESHOLD = 10;

// --- PRIVATE HELPERS ---
/**
 * Determines the best available model for a user based on their tier.
 * @param {string} userTier - The user's tier ('free', 'tier1', etc.).
 * @returns {{model: string, nameKey: string}} The best model and its localization key.
 * @private
 */
function _getBestAvailableModelForTier(userTier) {
  if (userTier === 'tier1' || userTier === 'tier2') {
    return { model: ULTRA_MODEL_NAME, nameKey: 'option_model_ultra' };
  }
  // Default for 'free' tier and any other case
  return { model: PRO_MODEL_NAME, nameKey: 'option_model_pro' };
}

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
 * Updates the appearance of the AI model toggle button based on the user's tier, current selection, and API usage.
 * For anonymous users, it shows a disabled button with a login prompt.
 * For logged-in users, it shows an active button to toggle between models.
 */
export function updateModelToggleButtonAppearance() {
  if (!modelToggleButton) {
    log(LOG_LEVEL_WARN, 'Model toggle button not found in DOM. Cannot update appearance.');
    return;
  }
  const currentUser = getCurrentUser();
  modelToggleButton.style.display = 'inline-flex';
  if (!currentUser) {
    // --- Anonymous User Logic ---
    modelToggleButton.disabled = true;
    const proModelShortName = getUIText('option_model_pro');
    modelToggleButton.textContent = proModelShortName; // Show what they're missing
    const baseTooltipText = getUIText('tooltip_model_toggle_anon_base');
    let tooltipText = baseTooltipText;
    const apiUsage = getCurrentUserApiUsage();
    if (apiUsage) {
      tooltipText = getUIText('tooltip_model_toggle_usage_anon', {
        BASE_TEXT: baseTooltipText,
        DAILY_COUNT: apiUsage.daily.count,
        DAILY_LIMIT: apiUsage.daily.limit,
        HOURLY_COUNT: apiUsage.hourly.count,
        HOURLY_LIMIT: apiUsage.hourly.limit,
      });
    }
    modelToggleButton.setAttribute('aria-label', baseTooltipText);
    attachTooltip(modelToggleButton, null, {}, { rawText: tooltipText });
    log(LOG_LEVEL_DEBUG, 'Anonymous user, showing disabled model toggle button with login prompt.');
    return;
  }
  // --- Logged-In User Logic ---
  const userTier = currentUser.tier || 'free';
  const { model: bestAvailableModel, nameKey: bestModelNameKey } = _getBestAvailableModelForTier(userTier);
  const currentModel = getCurrentModelName();
  const isUsingFreeModel = currentModel === FREE_MODEL_NAME;
  const targetModelName = isUsingFreeModel ? bestAvailableModel : FREE_MODEL_NAME;
  const targetModelShortNameKey = isUsingFreeModel ? bestModelNameKey : 'option_model_free';
  const targetModelShortName = getUIText(targetModelShortNameKey);
  const currentModelShortNameKey = isUsingFreeModel ? 'option_model_free' : bestModelNameKey;
  const currentModelShortName = getUIText(currentModelShortNameKey);
  let buttonText;
  let remainingDailyCalls = Infinity;
  let ariaLabel = getUIText('aria_label_toggle_to_model', { CURRENT_MODEL: currentModelShortName, TARGET_MODEL: targetModelShortName });
  let tooltipText = ariaLabel;
  const apiUsage = getCurrentUserApiUsage();
  if (apiUsage) {
    const dailyLimit = apiUsage.daily.limit;
    const dailyCount = apiUsage.daily.count;
    remainingDailyCalls = dailyLimit - dailyCount;
    tooltipText = getUIText('tooltip_model_toggle_usage', {
      DAILY_COUNT: dailyCount,
      DAILY_LIMIT: dailyLimit,
      HOURLY_COUNT: apiUsage.hourly.count,
      HOURLY_LIMIT: apiUsage.hourly.limit,
      ARIA_LABEL: ariaLabel,
    });
    if (remainingDailyCalls <= LOW_API_CALL_THRESHOLD && remainingDailyCalls > 0) {
      buttonText = getUIText('button_toggle_to_model_with_count', {
        MODEL_NAME: targetModelShortName,
        REMAINING_CALLS: remainingDailyCalls,
      });
    } else {
      buttonText = getUIText('button_toggle_to_model', { MODEL_NAME: targetModelShortName });
    }
  } else {
    buttonText = getUIText('button_toggle_to_model', { MODEL_NAME: targetModelShortName });
  }
  modelToggleButton.textContent = buttonText;
  modelToggleButton.setAttribute('aria-label', ariaLabel);
  attachTooltip(modelToggleButton, null, {}, { rawText: tooltipText });
  // Disable button if limits are exceeded
  if (remainingDailyCalls <= 0) {
    modelToggleButton.disabled = true;
  } else {
    modelToggleButton.disabled = false;
  }
  log(LOG_LEVEL_DEBUG, `Model toggle button updated. Current: ${currentModel}, Tier: ${userTier}. Offers switch to ${targetModelName}. Daily calls left: ${remainingDailyCalls}`);
}

/**
 * Handles the click event on the AI model toggle button.
 * It switches the model between free and the user's best available, and updates preferences.
 */
export async function handleModelToggle() {
  if (!modelToggleButton || modelToggleButton.disabled) {
    log(LOG_LEVEL_DEBUG, 'Model toggle button is not available or disabled.');
    return;
  }

  const currentUser = getCurrentUser();
  if (!currentUser) {
    log(LOG_LEVEL_WARN, 'Model toggle attempted by anonymous user. This should not happen.');
    return;
  }

  const userTier = currentUser.tier || 'free';
  const { model: bestAvailableModel, nameKey: bestModelNameKey } = _getBestAvailableModelForTier(userTier);
  const currentModel = getCurrentModelName();
  const newModelName = (currentModel === FREE_MODEL_NAME) ? bestAvailableModel : FREE_MODEL_NAME;

  log(LOG_LEVEL_INFO, `User toggled AI model from ${currentModel} to ${newModelName}.`);

  // Update state immediately. This also persists to localStorage via the state setter.
  setCurrentModelName(newModelName);

  try {
    log(LOG_LEVEL_DEBUG, `Updating backend model preference for user ${currentUser.email} to ${newModelName}.`);
    await authService.updateUserPreferences({ preferred_model_name: newModelName });
    log(LOG_LEVEL_INFO, 'Backend model preference updated successfully.');
  } catch (error) {
    log(LOG_LEVEL_ERROR, 'Failed to update backend model preference:', error.message);
    if (_storyLogManagerRef && getCurrentTheme() && storyLogViewport && storyLogViewport.style.display !== 'none') {
      _storyLogManagerRef.addMessageToLog(
        getUIText('error_api_call_failed', { ERROR_MSG: 'Could not save model preference to server.' }),
        'system system-error',
      );
    }
  }

  // Reflect the change in the UI.
  updateModelToggleButtonAppearance();

  // Add a system message to the story log if a game is active.
  if (_storyLogManagerRef && getCurrentTheme() && storyLogViewport && storyLogViewport.style.display !== 'none') {
    const newModelShortNameKey = (newModelName === FREE_MODEL_NAME) ? 'option_model_free' : bestModelNameKey;
    const newModelShortName = getUIText(newModelShortNameKey);
    _storyLogManagerRef.addMessageToLog(getUIText('system_model_switched', { MODEL_NAME: newModelShortName }), 'system');
  }
}
