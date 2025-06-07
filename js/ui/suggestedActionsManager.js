// js/ui/suggestedActionsManager.js
/**
 * @file Manages the display and interaction of AI-suggested action buttons.
 */
import { suggestedActionsWrapper, playerActionInput } from './domElements.js';
import { setCurrentSuggestedActions } from '../core/state.js';
import { autoGrowTextarea } from './uiUtils.js';
import { handleMullOverShardAction } from '../services/aiService.js';
import { log, LOG_LEVEL_DEBUG, LOG_LEVEL_WARN, LOG_LEVEL_ERROR } from '../core/logger.js';
import { attachTooltip, hideCurrentTooltip } from './tooltipManager.js';
let _gameControllerRef = null;

/**
 * Initializes the SuggestedActionsManager with optional dependencies.
 * @param {object} [dependencies={}] - Optional dependencies.
 * @param {object} [dependencies.gameController] - Reference to gameController.
 */
export function initSuggestedActionsManager(dependencies = {}) {
    if (dependencies.gameController) {
        _gameControllerRef = dependencies.gameController;
    }
    log(LOG_LEVEL_DEBUG, "SuggestedActionsManager initialized.");
}

const MAX_SUGGESTED_ACTIONS = 3; // Consistent with prompt file requests (2-3 actions)

/**
 * Displays AI-suggested actions as clickable buttons.
 * @param {Array<string|object>} actions - An array of action strings or action objects.
 *                                         Action objects for "Mull Over Shard" should have:
 *                                         `text` (string, button label),
 *                                         `isTemporaryMullOver: true`,
 *                                         `shardData` (object, the shard details).
 */
export function displaySuggestedActions(actions) {
    if (!suggestedActionsWrapper) {
        log(LOG_LEVEL_WARN, "Suggested actions wrapper element not found. Cannot display actions.");
        // Still update state even if UI element is missing, so game logic is consistent
        setCurrentSuggestedActions(actions && Array.isArray(actions) ? actions.slice(0, MAX_SUGGESTED_ACTIONS) : []);
        return;
    }
    suggestedActionsWrapper.innerHTML = ""; // Clear previous actions
    let validActionsToStore = [];
    if (actions && Array.isArray(actions) && actions.length > 0) {
        actions.slice(0, MAX_SUGGESTED_ACTIONS).forEach(actionObjOrString => {
            let actionText; // The full text for processing (e.g., "Trait Name: Description")
            let buttonDisplayText; // The text to show on the button (e.g., "Trait Name")
            let tooltipText; // Text for the hover title attribute
            let isMullOver = false;
            let isBoonOrTrait = false;
            let shardDataForMullOver = null;

            if (typeof actionObjOrString === 'string') {
                actionText = actionObjOrString;
                buttonDisplayText = actionText;
            } else if (typeof actionObjOrString === 'object' && actionObjOrString.text) {
                actionText = actionObjOrString.text;
                buttonDisplayText = actionObjOrString.displayText || actionText;
                tooltipText = actionObjOrString.descriptionForTooltip || null;
                isMullOver = actionObjOrString.isTemporaryMullOver === true;
                shardDataForMullOver = actionObjOrString.shardDataForMullOver || actionObjOrString.shardData || null;
                isBoonOrTrait = actionObjOrString.isBoonChoice === true || actionObjOrString.isTraitChoice === true;
            } else {
                log(LOG_LEVEL_WARN, "Invalid action format in suggested actions array:", actionObjOrString);
                return; // Skip this invalid action
            }

            if (actionText && actionText.trim() !== "") {
                const btn = document.createElement("button");
                btn.classList.add("ui-button");

                if (isMullOver) btn.classList.add("mull-over-action");
                if (isBoonOrTrait) btn.classList.add("boon-action");

                btn.textContent = buttonDisplayText;
                btn.removeAttribute('title'); // Ensure no native tooltip interferes

                if (tooltipText) {
                    attachTooltip(btn, null, {}, { rawText: tooltipText });
                }

                btn.addEventListener("click", () => {
                    hideCurrentTooltip(); // Hide any active tooltip immediately on click
                    if (isBoonOrTrait) {
                        if (_gameControllerRef && typeof _gameControllerRef.processPlayerAction === 'function') {
                            _gameControllerRef.processPlayerAction(actionText); // Pass the full text for matching
                        } else {
                            log(LOG_LEVEL_ERROR, "GameController not available in SuggestedActionsManager to process Boon/Trait choice. Falling back to input population.");
                            if (playerActionInput) {
                                playerActionInput.value = actionText;
                                playerActionInput.focus();
                                playerActionInput.dispatchEvent(new Event("input", { bubbles: true }));
                                autoGrowTextarea(playerActionInput);
                            }
                        }
                    } else if (isMullOver && shardDataForMullOver) {
                        log(LOG_LEVEL_DEBUG, "Mull Over Shard action clicked:", shardDataForMullOver.title);
                        handleMullOverShardAction(shardDataForMullOver)
                            .catch(err => {
                                log(LOG_LEVEL_ERROR, "Error handling Mull Over Shard action from suggestedActionsManager:", err);
                            });
                    } else {
                        if (playerActionInput) {
                            playerActionInput.value = actionText;
                            playerActionInput.focus();
                            playerActionInput.dispatchEvent(new Event("input", { bubbles: true }));
                            autoGrowTextarea(playerActionInput);
                        } else {
                            log(LOG_LEVEL_WARN, "Player action input element not found for suggested action.");
                        }
                    }
                });
                suggestedActionsWrapper.appendChild(btn);
                validActionsToStore.push(actionObjOrString);
            }
        });
    }
    setCurrentSuggestedActions(validActionsToStore);
    log(LOG_LEVEL_DEBUG, `Displayed ${validActionsToStore.length} suggested actions.`);
}

/**
 * Clears any displayed suggested actions from the UI and state.
 */
export function clearSuggestedActions() {
    if (suggestedActionsWrapper) {
        suggestedActionsWrapper.innerHTML = "";
    }
    setCurrentSuggestedActions([]);
    log(LOG_LEVEL_DEBUG, "Suggested actions cleared.");
}
