// js/ui/uiUtils.js
/**
 * @file Provides general, reusable UI utility functions.
 */

import { UPDATE_HIGHLIGHT_DURATION } from '../core/config.js';
import {
    gmSpecificActivityIndicator, // Corrected: This ID is from the provided HTML structure for gm-activity-indicator
    systemStatusIndicator,
    playerActionInput,
    sendActionButton,
    actionInputSection, // Used to check if input area is visible
    // Note: suggestedActionsWrapper is not directly manipulated here for disabling,
    // individual buttons inside it are.
} from './domElements.js';
import { MAX_PLAYER_ACTION_INPUT_LENGTH } from '../core/config.js';
import { playerActionCharCounter } from './domElements.js';
import { updateDashboardItemMetaEntry } from '../core/state.js';
import { log, LOG_LEVEL_DEBUG } from '../core/logger.js';

/**
 * Briefly highlights a UI element that has been updated and adds a persistent
 * 'has-recent-update' class to its container for dot indicators.
 * Updates the central state for dashboard item metadata.
 * @param {HTMLElement} element - The element (or its value part) that was updated.
 */
export function highlightElementUpdate(element) {
    if (!element) return;
    let textValueElement = null;
    let containerElement = null;
    let itemId = null; // To store the actual item ID

    // Determine the container and the specific text element being updated
    if (element.classList.contains("value") || element.classList.contains("value-overlay")) {
        textValueElement = element;
        containerElement = element.closest('.info-item, .info-item-meter');
        // Extract itemId if containerElement is found
        if (containerElement && containerElement.id && containerElement.id.startsWith('info-item-container-')) {
            itemId = containerElement.id.substring('info-item-container-'.length);
        }
    } else if (element.classList.contains("info-item") || element.classList.contains("info-item-meter")) {
        // This case means the element passed is the container itself
        containerElement = element;
        textValueElement = element.querySelector(".value, .value-overlay");
        // Extract itemId
        if (containerElement.id && containerElement.id.startsWith('info-item-container-')) {
            itemId = containerElement.id.substring('info-item-container-'.length);
        }
    }

    if (containerElement && itemId) {
        const alreadyHasDot = containerElement.classList.contains('has-recent-update');
        // Add the class for the visual dot indicator if not already present
        if (!alreadyHasDot) {
            containerElement.classList.add('has-recent-update');
            // Update the central state to reflect this change
            updateDashboardItemMetaEntry(itemId, { hasRecentUpdate: true });
            log(LOG_LEVEL_DEBUG, `Item ${itemId} marked with has-recent-update (dot visible) and state updated.`);
        }
    }

    // Handle the temporary visual flash on the text value itself
    if (textValueElement) {
        textValueElement.classList.add("value-updated");
        setTimeout(() => {
            if (document.body.contains(textValueElement)) { // Check if element still exists
                textValueElement.classList.remove("value-updated");
            }
        }, UPDATE_HIGHLIGHT_DURATION);
    }
}

/**
 * Briefly highlights a UI element to indicate an update, using a flash effect.
 * Differentiates between text elements (color flash via CSS) and icons (brightness flash via JS).
 * @param {HTMLElement} element - The DOM element to flash.
 */
export function flashElement(element) {
    if (!element) return;

    if (element.classList.contains('status-icon')) {
        // For icons, which are colored via background-color, we use a filter animation.
        if (typeof element.animate === 'function') {
            element.animate([
                { filter: 'brightness(1.85)', offset: 0 },
                { filter: 'brightness(1.85)', offset: 0.15 },
                { filter: 'brightness(1)', offset: 1 }
            ], {
                duration: UPDATE_HIGHLIGHT_DURATION,
                easing: 'ease-out'
            });
        }
    } else {
        // For text elements, use the existing CSS animation by adding a class.
        element.classList.add("value-updated");
        setTimeout(() => {
            if (document.body.contains(element)) {
                element.classList.remove("value-updated");
            }
        }, UPDATE_HIGHLIGHT_DURATION);
    }
}

/**
 * Automatically adjusts the height of a textarea to fit its content,
 * up to a CSS-defined max-height.
 * @param {HTMLTextAreaElement} textareaElement - The textarea element to auto-grow.
 */
export function autoGrowTextarea(textareaElement) {
    if (!textareaElement || typeof textareaElement.scrollHeight === 'undefined') return;

    textareaElement.style.height = "auto"; // Temporarily shrink to get accurate scrollHeight
    let newHeight = textareaElement.scrollHeight;
    const maxHeightStyle = window.getComputedStyle(textareaElement).maxHeight;
    const maxHeight = maxHeightStyle && maxHeightStyle !== 'none' ? parseInt(maxHeightStyle, 10) : Infinity;

    if (newHeight > maxHeight) {
        newHeight = maxHeight;
        textareaElement.style.overflowY = "auto";
    } else {
        textareaElement.style.overflowY = "hidden";
    }
    textareaElement.style.height = newHeight + "px";
}

/**
 * Formats text with simple markdown-like syntax to HTML.
 * Supports _italic_, *bold*, and ~underline~.
 * @param {string} text - The text to format.
 * @returns {string} The HTML formatted string.
 */
export function formatDynamicText(text) {
    if (typeof text !== 'string' || !text) return '';
    // Using more specific regex to avoid issues with multiple underscores/asterisks
    let formattedText = text;
    formattedText = formattedText.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>'); // _italic_
    formattedText = formattedText.replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, '<strong>$1</strong>'); // *bold*
    // For underline, ensure it's not part of a URL or something similar if that becomes an issue.
    // For now, simple replacement.
    formattedText = formattedText.replace(/~([^~]+)~/g, '<u>$1</u>'); // ~underline~
    return formattedText;
}

/**
 * Toggles UI elements to indicate AI processing status.
 * @param {boolean} isProcessing - True if AI is processing, false otherwise.
 */
export function setGMActivityIndicator(isProcessing) {
    if (gmSpecificActivityIndicator) {
        gmSpecificActivityIndicator.style.display = isProcessing ? "inline-flex" : "none";
    }
    if (systemStatusIndicator) {
        systemStatusIndicator.style.display = isProcessing ? "none" : "inline-flex";
    }

    if (playerActionInput) {
        playerActionInput.disabled = isProcessing;
    }
    if (sendActionButton) {
        sendActionButton.disabled = isProcessing;
    }

    // Disable/enable suggested action buttons
    const suggestedActionButtons = document.querySelectorAll("#suggested-actions-wrapper .ui-button");
    suggestedActionButtons.forEach(btn => {
        btn.disabled = isProcessing;
    });

    if (!isProcessing && actionInputSection && actionInputSection.style.display !== "none" && playerActionInput && document.body.contains(playerActionInput)) {
        playerActionInput.focus();
    }
}

/**
 * Enables or disables the main player action input area without affecting GM activity indicators.
 * Used for states where user should use suggested actions instead of typing.
 * @param {boolean} isEnabled - True to enable, false to disable.
 */
export function setPlayerInputEnabled(isEnabled) {
    const inputGroup = playerActionInput?.closest('.input-group');

    if (playerActionInput) {
        playerActionInput.disabled = !isEnabled;
    }
    if (sendActionButton) {
        sendActionButton.disabled = !isEnabled;
    }
    if (inputGroup) {
        if (isEnabled) {
            inputGroup.classList.remove('input-group-disabled');
        } else {
            inputGroup.classList.add('input-group-disabled');
        }
    }
    log(LOG_LEVEL_DEBUG, `Player action input set to enabled: ${isEnabled}`);
}

/**
 * Handles input events on the player action textarea.
 * Updates the character counter, enforces the MAX_PLAYER_ACTION_INPUT_LENGTH by truncating from the end
 * (keeping the beginning of pasted text if it exceeds the limit), and calls autoGrowTextarea.
 * The `maxlength` attribute on the textarea itself will prevent typing beyond the limit.
 * This handler primarily deals with pastes and counter updates.
 * @param {Event} event - The input event.
 */
export function handlePlayerActionInput(event) {
    const textareaElement = event.target;
    if (!textareaElement || !playerActionCharCounter) return;

    let currentValue = textareaElement.value;

    // If `maxlength` is properly set, this condition should mostly handle pastes
    // that might momentarily exceed the limit before `maxlength` truncates.
    if (currentValue.length > MAX_PLAYER_ACTION_INPUT_LENGTH) {
        textareaElement.value = currentValue.slice(0, MAX_PLAYER_ACTION_INPUT_LENGTH);
        currentValue = textareaElement.value; // Update currentValue after truncation
    }

    const currentLength = currentValue.length;
    playerActionCharCounter.textContent = `${currentLength}/${MAX_PLAYER_ACTION_INPUT_LENGTH}`;

    if (currentLength >= MAX_PLAYER_ACTION_INPUT_LENGTH) {
        playerActionCharCounter.style.color = 'var(--color-meter-critical)';
    } else if (currentLength >= MAX_PLAYER_ACTION_INPUT_LENGTH * 0.9) {
        playerActionCharCounter.style.color = 'var(--color-meter-low)';
    } else {
        playerActionCharCounter.style.color = 'var(--color-text-muted)';
    }

    autoGrowTextarea(textareaElement);
}
