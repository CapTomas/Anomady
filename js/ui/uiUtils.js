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
