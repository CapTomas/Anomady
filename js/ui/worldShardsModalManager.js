// js/ui/worldShardsModalManager.js
/**
 * @file Manages the UI modal for configuring World Shards (listing shards,
 * toggling active status, shattering shards, resetting world).
 */

import * as apiService from '../core/apiService.js';
import { getCurrentUser, getCurrentTheme } from '../core/state.js'; // getCurrentTheme might be useful if called from game view
import { getUIText } from '../services/localizationService.js';
import { showCustomModal, hideCustomModal, displayModalError } from './modalManager.js';
import { getThemeConfig } from '../services/themeService.js'; // To get theme display name
import { log, LOG_LEVEL_INFO, LOG_LEVEL_ERROR, LOG_LEVEL_DEBUG } from '../core/logger.js';
import { attachTooltip } from './tooltipManager.js';

// Dependencies to be injected if this manager needs to trigger updates elsewhere
let _landingPageManagerRef = null;
let _userThemeControlsManagerRef = null; // For top bar icons if they reflect shard status

/**
 * Initializes the WorldShardsModalManager with optional dependencies.
 * @param {object} [dependencies={}] - Optional dependencies.
 * @param {object} [dependencies.landingPageManager] - Reference to landingPageManager for UI updates.
 * @param {object} [dependencies.userThemeControlsManager] - Reference for top bar icon updates.
 */
export function initWorldShardsModalManager(dependencies = {}) {
    if (dependencies.landingPageManager) _landingPageManagerRef = dependencies.landingPageManager;
    if (dependencies.userThemeControlsManager) _userThemeControlsManagerRef = dependencies.userThemeControlsManager;
}

/**
 * Fetches and displays the modal for configuring World Shards for a specific theme.
 * @param {string} themeId - The ID of the theme whose shards are to be configured.
 */
export async function showConfigureShardsModal(themeId) {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.token) {
        log(LOG_LEVEL_ERROR, "Cannot show configure shards modal: User not logged in.");
        // Optionally show a generic error or login prompt modal
        showCustomModal({
            type: "alert",
            titleKey: "alert_title_error",
            messageKey: "error_api_call_failed", // Generic error, or a more specific "login_required" key
            replacements: { ERROR_MSG: "You must be logged in to manage World Fragments." }
        });
        return;
    }

    const themeConfig = getThemeConfig(themeId);
    const themeDisplayName = themeConfig ? getUIText(themeConfig.name_key, {}, { explicitThemeContext: themeId }) : themeId;

    const modalContentContainer = document.createElement('div');
    modalContentContainer.className = 'configure-shards-modal-content'; // For specific styling & scrolling

    let currentShards = []; // To store fetched shards

    // Function to re-render the list of shards within the modal
    const renderShardList = () => {
        modalContentContainer.innerHTML = ''; // Clear previous content
        if (currentShards.length === 0) {
            const noShardsP = document.createElement('p');
            noShardsP.textContent = getUIText("modal_shards_none_found");
            modalContentContainer.appendChild(noShardsP);
            return;
        }

        const list = document.createElement('ul');
        list.className = 'shard-list'; // For styling
        currentShards.sort((a, b) => new Date(a.unlockedAt) - new Date(b.unlockedAt)); // Sort by unlock date

        currentShards.forEach(shard => {
            const listItem = document.createElement('li');
            listItem.className = 'shard-item';
            listItem.dataset.shardId = shard.id;

            const titleDiv = document.createElement('div');
            titleDiv.className = 'shard-title';
            titleDiv.textContent = shard.loreFragmentTitle;

            const unlockDescDiv = document.createElement('div');
            unlockDescDiv.className = 'shard-unlock-desc';
            unlockDescDiv.textContent = `(${getUIText("shard_unlock_condition_prefix")} ${shard.unlockConditionDescription})`;

            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'shard-controls';

            const toggleLabel = document.createElement('label');
            toggleLabel.className = 'shard-toggle-label';
            const toggleInput = document.createElement('input');
            toggleInput.type = 'checkbox';
            toggleInput.checked = shard.isActiveForNewGames;
            toggleInput.setAttribute('aria-label', `${getUIText("shard_active_toggle_label")} for ${shard.loreFragmentTitle}`);

            const updateVisualState = () => {
                if (!shard.isActiveForNewGames) {
                    titleDiv.style.textDecoration = 'line-through';
                    titleDiv.style.opacity = '0.6';
                } else {
                    titleDiv.style.textDecoration = 'none';
                    titleDiv.style.opacity = '1';
                }
            };
            updateVisualState(); // Initial visual state

            toggleInput.addEventListener('change', async (e) => {
                const newStatus = e.target.checked;
                try {
                    await apiService.updateWorldShardStatus(currentUser.token, shard.id, newStatus);
                    shard.isActiveForNewGames = newStatus; // Optimistic update
                    updateVisualState();
                    // After successfully updating shard status, refresh dependent UI
                    if (_landingPageManagerRef) {
                        await _landingPageManagerRef.fetchShapedWorldStatusAndUpdateGrid();
                        // If the current landing selection is this theme, refresh its action buttons
                         const currentLandingSelection = _landingPageManagerRef.getCurrentLandingSelection ? _landingPageManagerRef.getCurrentLandingSelection() : null;
                         if (currentLandingSelection === themeId) {
                            _landingPageManagerRef.renderLandingPageActionButtons(themeId);
                         }
                    }
                } catch (error) {
                    log(LOG_LEVEL_ERROR, "Failed to update shard status", error);
                    e.target.checked = !newStatus; // Revert checkbox on error
                    updateVisualState(); // Revert visual state
                    displayModalError(getUIText("error_api_call_failed", { ERROR_MSG: error.message }), modalContentContainer);
                }
            });

            toggleLabel.appendChild(toggleInput);
            toggleLabel.appendChild(document.createTextNode(` ${getUIText("shard_active_toggle_label")}`));

            const shatterButton = document.createElement('button');
            shatterButton.className = 'ui-button danger small shard-shatter-button';
            shatterButton.textContent = getUIText("button_shatter_shard");
            const shatterTooltipKey = "tooltip_shatter_shard";
            attachTooltip(shatterButton, shatterTooltipKey);
            shatterButton.addEventListener('click', async () => {
                const confirmed = await showGenericConfirmModal({
                    titleKey: "confirm_shatter_shard_title",
                    messageKey: "confirm_shatter_shard_message",
                    replacements: { SHARD_TITLE: shard.loreFragmentTitle },
                });
                if (confirmed) {
                    try {
                        await apiService.deleteWorldShard(currentUser.token, shard.id);
                        currentShards = currentShards.filter(s => s.id !== shard.id);
                        renderShardList(); // Re-render list within the modal
                        // After successfully shattering, refresh dependent UI
                        if (_landingPageManagerRef) {
                             await _landingPageManagerRef.fetchShapedWorldStatusAndUpdateGrid();
                             const currentLandingSelection = _landingPageManagerRef.getCurrentLandingSelection ? _landingPageManagerRef.getCurrentLandingSelection() : null;
                             if (currentLandingSelection === themeId) {
                                _landingPageManagerRef.renderLandingPageActionButtons(themeId);
                             }
                        }
                    } catch (error) {
                        log(LOG_LEVEL_ERROR, "Failed to shatter shard", error);
                        displayModalError(getUIText("error_api_call_failed", { ERROR_MSG: error.message }), modalContentContainer);
                    }
                }
            });

            controlsDiv.appendChild(toggleLabel);
            controlsDiv.appendChild(shatterButton);
            listItem.appendChild(titleDiv);
            listItem.appendChild(unlockDescDiv);
            listItem.appendChild(controlsDiv);
            list.appendChild(listItem);
        });
        modalContentContainer.appendChild(list);
    };

    // Handler for bulk actions (activate all, deactivate all, reset world)
    const bulkActionHandler = async (actionType) => {
        let confirmNeeded = false;
        let confirmTitleKey = "";
        let confirmMessageKey = "";
        let apiCall = async () => {};

        if (actionType === 'activateAll') {
            apiCall = async () => {
                for (const shard of currentShards) {
                    if (!shard.isActiveForNewGames) {
                        await apiService.updateWorldShardStatus(currentUser.token, shard.id, true);
                        shard.isActiveForNewGames = true; // Optimistic update
                    }
                }
            };
        } else if (actionType === 'deactivateAll') {
            apiCall = async () => {
                for (const shard of currentShards) {
                    if (shard.isActiveForNewGames) {
                        await apiService.updateWorldShardStatus(currentUser.token, shard.id, false);
                        shard.isActiveForNewGames = false; // Optimistic update
                    }
                }
            };
        } else if (actionType === 'resetAll') {
            confirmNeeded = true;
            confirmTitleKey = "confirm_reset_world_title";
            confirmMessageKey = "confirm_reset_world_message";
            apiCall = async () => {
                await apiService.resetWorldShardsForTheme(currentUser.token, themeId);
                currentShards = []; // All shards are gone
            };
        }

        if (confirmNeeded) {
            const confirmed = await showGenericConfirmModal({
                titleKey: confirmTitleKey,
                messageKey: confirmMessageKey,
                replacements: { THEME_NAME: themeDisplayName },
            });
            if (!confirmed) return;
        }

        try {
            // Show some kind of loading indicator within the modal if these operations are long
            await apiCall();
            renderShardList(); // Re-render the list after bulk action
            if (_landingPageManagerRef) {
                await _landingPageManagerRef.fetchShapedWorldStatusAndUpdateGrid();
                 const currentLandingSelection = _landingPageManagerRef.getCurrentLandingSelection ? _landingPageManagerRef.getCurrentLandingSelection() : null;
                 if (currentLandingSelection === themeId) {
                    _landingPageManagerRef.renderLandingPageActionButtons(themeId);
                 }
            }
        } catch (error) {
            log(LOG_LEVEL_ERROR, `Failed to ${actionType} shards for theme ${themeId}:`, error);
            displayModalError(getUIText("error_api_call_failed", { ERROR_MSG: error.message }), modalContentContainer);
        }
    };

    // Define custom actions for the modal footer
    const modalCustomActions = [
        { textKey: "button_activate_all_shards", className: "ui-button small", onClick: () => bulkActionHandler('activateAll') },
        { textKey: "button_deactivate_all_shards", className: "ui-button small", onClick: () => bulkActionHandler('deactivateAll') },
        { textKey: "button_reset_world_shards", className: "ui-button danger small", onClick: () => bulkActionHandler('resetAll') },
        { textKey: "modal_ok_button", className: "ui-button primary", onClick: () => hideCustomModal() }
    ];

    // Show the base modal structure
    showCustomModal({
        type: "custom", // Indicate it's a custom content modal
        titleKey: "modal_title_manage_shards",
        replacements: { THEME_NAME: themeDisplayName },
        htmlContent: modalContentContainer, // Pass the container for shard list
        customActions: modalCustomActions
    });

    // Initial fetch and render of shards
    try {
        const response = await apiService.fetchWorldShards(currentUser.token, themeId);
        currentShards = response.worldShards || [];
        renderShardList();
    } catch (error) {
        log(LOG_LEVEL_ERROR, "Failed to fetch initial shards for modal:", error);
        displayModalError(getUIText("error_api_call_failed", { ERROR_MSG: error.message }), modalContentContainer);
    }
}
