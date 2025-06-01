// js/ui/dashboardManager.js
/**
 * @file Responsible for generating, rendering, and updating all dynamic dashboard panels
 * and their items (meters, status levels, text values).
 * Also handles panel expansion/collapse logic and scroll indicators.
 */
import {
    leftPanel,
    rightPanel,
    leftPanelScrollIndicatorUp,
    leftPanelScrollIndicatorDown,
    rightPanelScrollIndicatorUp,
    rightPanelScrollIndicatorDown
} from './domElements.js';
import { getThemeConfig } from '../services/themeService.js';
import { getUIText } from '../services/localizationService.js';
import { highlightElementUpdate } from './uiUtils.js';
import {
    getPanelState,
    setPanelState,
    getCurrentTheme,
    getLastKnownDashboardUpdates,
    getLastKnownGameStateIndicators // Added for completeness, though not directly used in this file's primary functions
} from '../core/state.js';
import { SCROLL_INDICATOR_TOLERANCE } from '../core/config.js';
import { log, LOG_LEVEL_INFO, LOG_LEVEL_ERROR, LOG_LEVEL_WARN, LOG_LEVEL_DEBUG } from '../core/logger.js';

// --- Internal State for Scroll Indicators ---
const _outOfViewTrackedElements = {
    left: { up: new Set(), down: new Set() },
    right: { up: new Set(), down: new Set() }
};

// --- Panel Generation ---
/**
 * Creates a single dashboard item element.
 * @param {object} itemConfig - Configuration for the item.
 * @param {string} themeId - Current theme ID for localization.
 * @returns {HTMLElement} The created item container element.
 * @private
 */
function _createPanelItemElement(itemConfig, themeId) {
    const itemContainer = document.createElement("div");
    itemContainer.id = `info-item-container-${itemConfig.id}`;
    itemContainer.classList.add(itemConfig.type === "meter" ? "info-item-meter" : "info-item");

    const commonFullWidthIds = [
        "objective", "current_quest", "location", "environment", "sensorConditions",
        "omen_details", "current_location_desc", "ambient_conditions", "blight_intensity",
        "case_primary_enigma", "flux_event_description", "active_disturbance_sensation",
        "current_attire_description"
    ];

    if (itemConfig.type === "text_long" || commonFullWidthIds.includes(itemConfig.id)) {
        itemContainer.classList.add("full-width");
    }

    const label = document.createElement("span");
    label.classList.add("label");
    label.textContent = getUIText(itemConfig.label_key, {}, { explicitThemeContext: themeId, viewContext: 'game' });
    itemContainer.appendChild(label);

    if (itemConfig.type === "meter") {
        const meterContainer = document.createElement("div");
        meterContainer.classList.add("meter-bar-container");
        const meterBar = document.createElement("div");
        meterBar.id = `meter-${itemConfig.id}`;
        meterBar.classList.add("meter-bar");
        meterContainer.appendChild(meterBar);
        itemContainer.appendChild(meterContainer);

        const valueOverlay = document.createElement("span");
        valueOverlay.id = `info-${itemConfig.id}`;
        valueOverlay.classList.add("value-overlay");
        itemContainer.appendChild(valueOverlay);
    } else { // text, text_long, status_level, status_text
        const valueSpan = document.createElement("span");
        valueSpan.id = `info-${itemConfig.id}`;
        valueSpan.classList.add("value");
        if (itemConfig.type === "text_long") {
            valueSpan.classList.add("objective-text"); // For potential specific styling
        }
        itemContainer.appendChild(valueSpan);
    }
    return itemContainer;
}

/**
 * Generates and renders dashboard panels for the given theme.
 * @param {string} themeId - The ID of the theme to generate panels for.
 */
export function generatePanelsForTheme(themeId) {
    const themeConfigFull = getThemeConfig(themeId);
    if (!themeConfigFull || !themeConfigFull.dashboard_config) {
        log(LOG_LEVEL_ERROR, `Dashboard config not found for theme: ${themeId}. Cannot generate panels.`);
        // Clear existing game-specific panels if config is missing
        [leftPanel, rightPanel].forEach(panelContainer => {
            if (panelContainer) {
                 Array.from(panelContainer.querySelectorAll('.panel-box'))
                    .filter(box => !box.closest('#landing-theme-description-container') && !box.closest('#landing-theme-details-container'))
                    .forEach(el => el.remove());
            }
        });
        return;
    }

    const dashboardConfig = themeConfigFull.dashboard_config;

    const setupSide = (panelContainer, panelConfigs) => {
        if (!panelContainer || !panelConfigs) return;

        // Remove existing game panels, but not landing page panels
        Array.from(panelContainer.querySelectorAll('.panel-box'))
            .filter(box => !box.closest('#landing-theme-description-container') && !box.closest('#landing-theme-details-container'))
            .forEach(el => el.remove());

        // Clear scroll tracking for this side
        const panelSideStr = panelContainer === leftPanel ? 'left' : 'right';
        _outOfViewTrackedElements[panelSideStr].up.clear();
        _outOfViewTrackedElements[panelSideStr].down.clear();

        const scrollIndicatorDown = panelContainer.querySelector('.scroll-indicator-down');

        panelConfigs.forEach(panelConfig => {
            const panelBox = document.createElement("div");
            panelBox.id = panelConfig.id;
            panelBox.classList.add("panel-box");
            panelBox.style.display = "flex"; // Ensure it's flex for proper layout
            panelBox.style.flexDirection = "column";

            if (panelConfig.type === "collapsible" || panelConfig.type === "hidden_until_active") {
                panelBox.classList.add("collapsible");
            }

            const header = document.createElement("div");
            header.classList.add("panel-box-header");
            const title = document.createElement("h3");
            title.classList.add("panel-box-title");
            title.textContent = getUIText(panelConfig.title_key, {}, { explicitThemeContext: themeId, viewContext: 'game' });
            header.appendChild(title);
            panelBox.appendChild(header);

            const content = document.createElement("div");
            content.classList.add("panel-box-content");
            panelConfig.items.forEach(itemConfig => {
                content.appendChild(_createPanelItemElement(itemConfig, themeId));
            });
            panelBox.appendChild(content);

            if (scrollIndicatorDown) {
                panelContainer.insertBefore(panelBox, scrollIndicatorDown);
            } else {
                panelContainer.appendChild(panelBox);
            }
        });
    };

    setupSide(leftPanel, dashboardConfig.left_panel);
    setupSide(rightPanel, dashboardConfig.right_panel);

    log(LOG_LEVEL_INFO, `Dashboard panels generated for theme: ${themeId}`);
    initializeDashboardDefaultTexts(themeId);
    initializeCollapsiblePanelBoxes(themeId); // This will also handle initial expansion states
}


/**
 * Sets initial default values for all dashboard items of a theme.
 * @param {string} themeId - The ID of the theme.
 * @private
 */
function initializeDashboardDefaultTexts(themeId) {
    const themeConfigFull = getThemeConfig(themeId);
    if (!themeConfigFull || !themeConfigFull.dashboard_config) return;

    const dashboardConfig = themeConfigFull.dashboard_config;
    const allItemConfigs = [
        ...(dashboardConfig.left_panel || []),
        ...(dashboardConfig.right_panel || [])
    ].flatMap(panel => panel.items);

    allItemConfigs.forEach(itemConfig => {
        const valueElement = document.getElementById(`info-${itemConfig.id}`);
        const meterBarElement = document.getElementById(`meter-${itemConfig.id}`);

        let defaultValueText = itemConfig.default_value !== undefined ?
            String(itemConfig.default_value) :
            (itemConfig.default_value_key ? getUIText(itemConfig.default_value_key, {}, { explicitThemeContext: themeId, viewContext: 'game' }) : getUIText("unknown"));

        if (itemConfig.type === "meter") {
            if (valueElement || meterBarElement) {
                const defaultStatusText = itemConfig.default_status_key ? getUIText(itemConfig.default_status_key, {}, { explicitThemeContext: themeId, viewContext: 'game' }) : undefined;
                setMeterValue(meterBarElement, valueElement, defaultValueText, itemConfig, false, defaultStatusText);
            }
        } else if (itemConfig.type === "status_level") {
            if (valueElement && itemConfig.level_mappings) {
                const defaultAiValue = itemConfig.default_ai_value !== undefined ? String(itemConfig.default_ai_value) : "1";
                updateStatusLevelDisplay(valueElement, defaultAiValue, itemConfig.level_mappings, themeId, false);
            }
        } else if (itemConfig.type === "text" || itemConfig.type === "text_long") {
            if (valueElement) {
                const suffix = itemConfig.suffix || "";
                valueElement.textContent = `${defaultValueText}${suffix}`;
            }
        } else if (itemConfig.type === "status_text" && valueElement) {
             if (valueElement) { // For status_text, the value IS the text
                valueElement.textContent = defaultValueText;
            }
        }
    });
    log(LOG_LEVEL_DEBUG, `Default texts initialized for dashboard of theme: ${themeId}`);
}

// --- Panel Interaction ---

/**
 * Initializes collapsible panel box behavior (click/keydown on headers).
 * @param {string} themeId - The ID of the theme whose panels are being initialized.
 */
export function initializeCollapsiblePanelBoxes(themeId) {
    const themeConfigFull = getThemeConfig(themeId);
    if (!themeConfigFull || !themeConfigFull.dashboard_config) {
        log(LOG_LEVEL_WARN, `Dashboard config missing for theme ${themeId}. Cannot initialize panel boxes.`);
        return;
    }
    const dashboardConfig = themeConfigFull.dashboard_config;
    const allPanelConfigs = [...(dashboardConfig.left_panel || []), ...(dashboardConfig.right_panel || [])];

    allPanelConfigs.forEach(panelConfig => {
        const panelBox = document.getElementById(panelConfig.id);
        if (!panelBox) {
            log(LOG_LEVEL_DEBUG, `Panel box element with ID ${panelConfig.id} not found in DOM for theme ${themeId}.`);
            return;
        }

        let header = panelBox.querySelector(".panel-box-header");
        if (!header) {
            log(LOG_LEVEL_DEBUG, `Header not found in panel box ${panelConfig.id}.`);
            return;
        }
        // Re-attach event listeners by cloning and replacing header if it's already initialized
        const newHeader = header.cloneNode(true);
        header.parentNode.replaceChild(newHeader, header);
        header = newHeader;

        if (panelConfig.type === "collapsible" || panelConfig.type === "hidden_until_active") {
            header.addEventListener("click", () => {
                if (panelBox.style.display !== "none" || panelConfig.type === "collapsible") { // Ensure visible for hidden_until_active
                    animatePanelExpansion(panelConfig.id, !panelBox.classList.contains("is-expanded"), panelConfig.type === "hidden_until_active");
                }
            });
            header.setAttribute("tabindex", "0"); // For accessibility
            header.addEventListener("keydown", (e) => {
                if ((e.key === "Enter" || e.key === " ") && (panelBox.style.display !== "none" || panelConfig.type === "collapsible")) {
                    e.preventDefault();
                    animatePanelExpansion(panelConfig.id, !panelBox.classList.contains("is-expanded"), panelConfig.type === "hidden_until_active");
                }
            });
        }

        // Determine initial expansion state: from saved state or config default
        let initialExpandState = getPanelState(panelConfig.id); // From state.js
        let isRestoringThisPanelState = initialExpandState !== undefined;

        if (initialExpandState === undefined) { // Not in saved state, use config default
            initialExpandState = panelConfig.type === "hidden_until_active" ? false : (panelConfig.initial_expanded || false);
            isRestoringThisPanelState = false; // Not "restoring" if it's from config default
        }


        if (panelConfig.type === "static") { // Always expanded, not collapsible
            panelBox.style.display = "flex"; panelBox.style.opacity = "1";
            animatePanelExpansion(panelConfig.id, true, false, true); // true for shouldExpand, true for isRestoringState (to avoid panel state save)
        } else if (panelConfig.type === "hidden_until_active") {
            const contentEl = panelBox.querySelector('.panel-box-content');
            // Initial visual setup based on initialExpandState for hidden_until_active
            if (initialExpandState) {
                panelBox.classList.add("is-expanded");
                if (contentEl) {
                    contentEl.style.maxHeight = contentEl.scrollHeight + "px"; contentEl.style.opacity = '1';
                    contentEl.style.paddingTop = ''; contentEl.style.paddingBottom = '';
                }
                header.setAttribute("aria-expanded", "true");
                if (contentEl) contentEl.setAttribute("aria-hidden", "false");
            } else {
                panelBox.classList.remove("is-expanded");
                 if(contentEl) {
                    contentEl.style.maxHeight = '0'; contentEl.style.opacity = '0';
                    contentEl.style.paddingTop = '0'; contentEl.style.paddingBottom = '0';
                 }
                header.setAttribute("aria-expanded", "false");
                if (contentEl) contentEl.setAttribute("aria-hidden", "true");
            }

            // Determine visibility based on indicator_key from game state
            const gameStateIndicators = getLastKnownGameStateIndicators(); // From state.js
            const indicatorKey = panelConfig.indicator_key;
            let shouldBeVisible = false;
            if (indicatorKey && gameStateIndicators && gameStateIndicators[indicatorKey] === true) {
                 shouldBeVisible = true;
            }

            if (shouldBeVisible) {
                 panelBox.style.display = "flex";
                 panelBox.style.opacity = "1";
                 // If it should be visible AND expanded, call animate (handles already expanded case gracefully)
                 if (initialExpandState) {
                     animatePanelExpansion(panelConfig.id, true, true, isRestoringThisPanelState);
                 }
            } else {
                 panelBox.style.display = "none";
                 panelBox.style.opacity = "0";
            }
        } else { // Standard collapsible
            panelBox.style.display = "flex"; panelBox.style.opacity = "1";
            const delay = panelConfig.boot_delay && !isRestoringThisPanelState ? panelConfig.boot_delay : 0;
            setTimeout(() => {
                animatePanelExpansion(panelConfig.id, initialExpandState, false, isRestoringThisPanelState);
            }, delay);
        }
    });
    log(LOG_LEVEL_INFO, `Collapsible panel boxes initialized for theme: ${themeId}`);
    // Initial scroll indicator update after panels are set up
    requestAnimationFrame(() => {
        if (leftPanel) updateScrollIndicators('left');
        if (rightPanel) updateScrollIndicators('right');
    });
}

/**
 * Animates the expansion or collapse of a panel box and updates scroll tracking.
 * @param {string} panelBoxId - The ID of the panel box element.
 * @param {boolean} shouldExpand - True to expand, false to collapse.
 * @param {boolean} [manageVisibilityViaDisplay=false] - For hidden_until_active, also set display:none.
 * @param {boolean} [isRestoringState=false] - True if this is part of restoring saved panel states.
 */
export function animatePanelExpansion(panelBoxId, shouldExpand, manageVisibilityViaDisplay = false, isRestoringState = false) {
    const box = document.getElementById(panelBoxId);
    if (!box) return;

    const header = box.querySelector(".panel-box-header");
    const content = box.querySelector(".panel-box-content");
    if (!header || !content) return;

    const wasExpanded = box.classList.contains("is-expanded");

    if (shouldExpand) {
        if (manageVisibilityViaDisplay && box.style.display === "none") {
            box.style.opacity = "0"; // Start transparent if managing display
            box.style.display = "flex";
        }
        // Use requestAnimationFrame to ensure previous style changes (like display:flex) are applied
        requestAnimationFrame(() => {
            box.classList.add("is-expanded");
            if (manageVisibilityViaDisplay) box.style.opacity = "1"; // Fade in
            header.setAttribute("aria-expanded", "true");
            content.setAttribute("aria-hidden", "false");
            content.style.maxHeight = content.scrollHeight + "px";
            content.style.opacity = "1";
            content.style.paddingTop = ''; // Reset to CSS default
            content.style.paddingBottom = ''; // Reset to CSS default

            // If expanding and not restoring state, remove recent update indicator from header
            if (!isRestoringState && !wasExpanded && header.classList.contains('has-recent-update')) {
                header.classList.remove('has-recent-update');
            }
            // If expanding and not restoring state, remove indicators from items within this panel
            if (!isRestoringState && !wasExpanded) {
                 const infoItems = box.querySelectorAll('.info-item.has-recent-update, .info-item-meter.has-recent-update');
                 infoItems.forEach(itemContainer => itemContainer.classList.remove('has-recent-update'));
            }

            const panelSide = leftPanel && leftPanel.contains(box) ? 'left' : (rightPanel && rightPanel.contains(box) ? 'right' : null);
            if (panelSide) _checkAndTrackElementVisibility(box, panelSide);
        });
    } else { // Collapse
        box.classList.remove("is-expanded");
        header.setAttribute("aria-expanded", "false");
        content.setAttribute("aria-hidden", "true");
        content.style.maxHeight = "0";
        content.style.opacity = "0";
        content.style.paddingTop = '0'; // Collapse padding
        content.style.paddingBottom = '0'; // Collapse padding

        if (manageVisibilityViaDisplay) {
            // Wait for transition to finish before setting display:none
            const onTransitionEnd = (event) => {
                if (event.target === content && !box.classList.contains("is-expanded")) { // Check if it's still collapsed
                    box.style.display = "none";
                    content.removeEventListener("transitionend", onTransitionEnd);
                }
            };
            content.addEventListener("transitionend", onTransitionEnd);
            // Fallback timeout in case transitionend doesn't fire as expected
            const duration = parseFloat(getComputedStyle(content).transitionDuration) * 1000 || 300;
            setTimeout(() => {
                 if (!box.classList.contains("is-expanded")) box.style.display = "none";
            }, duration + 50); // Slightly longer than transition
        }

        const panelSide = leftPanel && leftPanel.contains(box) ? 'left' : (rightPanel && rightPanel.contains(box) ? 'right' : null);
        if (panelSide) _checkAndTrackElementVisibility(box, panelSide);
    }
    // Update panel state in global state unless just restoring
    if (!isRestoringState) {
        setPanelState(panelBoxId, shouldExpand);
    }
}

// --- Dashboard Item Updates ---

/**
 * Updates a specific dashboard item's display.
 * @param {string} itemId - The ID of the dashboard item.
 * @param {string|number} newValue - The new value for the item.
 * @param {boolean} [highlight=true] - Whether to visually highlight the update.
 */
export function updateDashboardItem(itemId, newValue, highlight = true) {
    const currentThemeId = getCurrentTheme();
    if (!currentThemeId) return;

    const themeConfigFull = getThemeConfig(currentThemeId);
    if (!themeConfigFull || !themeConfigFull.dashboard_config) return;

    const allItemConfigs = [...(themeConfigFull.dashboard_config.left_panel || []), ...(themeConfigFull.dashboard_config.right_panel || [])]
        .flatMap(panel => panel.items);
    const itemConfig = allItemConfigs.find(item => item.id === itemId);

    if (!itemConfig) {
        log(LOG_LEVEL_WARN, `Dashboard item config not found for ID: ${itemId}`);
        return;
    }

    const valueElement = document.getElementById(`info-${itemId}`);
    const meterBarElement = document.getElementById(`meter-${itemId}`);
    const itemContainer = document.getElementById(`info-item-container-${itemId}`); // The parent div of label & value/meter

    if (itemConfig.type === "meter") {
        if (valueElement || meterBarElement) { // One of them must exist for a meter
            const statusTextId = itemConfig.status_text_id;
            // Get the status text from the last known complete dashboard updates,
            // as the `newValue` here is only for the meter's percentage.
            const newStatusText = statusTextId ? getLastKnownDashboardUpdates()[statusTextId] : undefined;
            setMeterValue(meterBarElement, valueElement, String(newValue), itemConfig, highlight, newStatusText);
        }
    } else if (itemConfig.type === "status_level") {
        if (valueElement && itemConfig.level_mappings) {
            updateStatusLevelDisplay(valueElement, String(newValue), itemConfig.level_mappings, currentThemeId, highlight);
        }
    } else if (itemConfig.type === "text" || itemConfig.type === "text_long") {
        if (valueElement) {
            const suffix = itemConfig.suffix || "";
            const newText = `${newValue}${suffix}`;
            if (valueElement.textContent !== newText) {
                valueElement.textContent = newText;
                if (highlight && itemContainer) highlightElementUpdate(itemContainer);
            }
        }
    } else if (itemConfig.type === "status_text" && valueElement) { // Handle direct status_text updates
         if (valueElement.textContent !== String(newValue)) {
            valueElement.textContent = String(newValue);
            // For status_text, the highlight is usually managed by its associated meter.
            // However, if it's updated independently, highlight its container.
            if (highlight && itemContainer && !itemConfig.meter_type) { // Avoid double highlight if meter is also updating
                 highlightElementUpdate(itemContainer);
            }
        }
    }

    // If an item inside a collapsed panel is updated, mark the panel header
    if (itemContainer) {
        const parentPanelBox = itemContainer.closest('.panel-box.collapsible');
        if (parentPanelBox && !parentPanelBox.classList.contains('is-expanded') && highlight) {
            const header = parentPanelBox.querySelector('.panel-box-header');
            if (header && !header.classList.contains('has-recent-update')) { // Avoid adding class multiple times
                header.classList.add('has-recent-update');
            }
        }
        // Check and update scroll indicator if item is now out of view
        const panelSide = leftPanel.contains(itemContainer) ? 'left' : (rightPanel.contains(itemContainer) ? 'right' : null);
        if (panelSide) _checkAndTrackElementVisibility(itemContainer, panelSide);
    }
}
/**
 * Orchestrates updates for all dashboard items based on AI response.
 * @param {object} updatesFromAI - Object containing key-value pairs of dashboard updates.
 * @param {boolean} [highlightChanges=true] - Whether to highlight updated items.
 */
export function updateDashboard(updatesFromAI, highlightChanges = true) {
    const currentThemeId = getCurrentTheme();
    if (!updatesFromAI || Object.keys(updatesFromAI).length === 0 || !currentThemeId) {
        log(LOG_LEVEL_DEBUG, "dashboardManager.updateDashboard called with no updates, or no current theme.");
        return;
    }
    log(LOG_LEVEL_DEBUG, "dashboardManager.updateDashboard: Bulk updating dashboard with:", updatesFromAI);
    for (const key in updatesFromAI) {
        if (Object.prototype.hasOwnProperty.call(updatesFromAI, key)) {
            const value = updatesFromAI[key];
            // updateDashboardItem will find the item config and apply the update.
            updateDashboardItem(key, value, highlightChanges);
        }
    }
}
/**
 * Sets the value and appearance of a meter bar and its associated text.
 * @param {HTMLElement|null} barEl - The meter bar element.
 * @param {HTMLElement|null} textEl - The text element displaying the meter's value/status.
 * @param {string} newPctStr - The new percentage value as a string.
 * @param {object} itemConfig - The configuration object for this meter item.
 * @param {boolean} [highlight=true] - Whether to highlight the update.
 * @param {string} [explicitStatusText] - Explicit status text for meters that have it (e.g., conceptual_cohesion).
 */
export function setMeterValue(barEl, textEl, newPctStr, itemConfig, highlight = true, explicitStatusText = undefined) {
    let updatedOccurred = false;
    const meterType = itemConfig.meter_type; // e.g., "health", "shields", "conceptual_cohesion"

    if (!barEl && !textEl) return; // Nothing to update

    let finalPct = 0;
    let newContentForTextEl = ""; // Initialize

    const parsedPct = parseInt(newPctStr, 10);

    if (!isNaN(parsedPct)) {
        finalPct = Math.max(0, Math.min(100, parsedPct));
    } else {
        // Handle non-numeric strings like "---", "N/A", "Unknown"
        const naText = getUIText("not_available_short");
        const unknownText = getUIText("unknown");
        if (newPctStr === "---" || newPctStr === naText || String(newPctStr).toLowerCase() === unknownText.toLowerCase()) {
            newContentForTextEl = newPctStr; // Use the special string directly
            // finalPct remains 0, bar will be empty
        } else {
            // Default for unparsable strings that aren't special markers
            finalPct = (meterType === "shields" || meterType === "conceptual_cohesion" || meterType === "monster_defense" || meterType === "mana") ? 0 : 100;
        }
    }

    // Determine status text for display (e.g., "Online: 75%", "Wounded: 50%")
    let statusTextToUse = explicitStatusText;
    if (itemConfig.status_text_id && explicitStatusText === undefined) {
        // If explicitStatusText is not provided, try to get it from last known dashboard updates
        statusTextToUse = getLastKnownDashboardUpdates()[itemConfig.status_text_id];
    }


    // Construct the display text
    if (meterType === "shields" || meterType === "conceptual_cohesion" || meterType === "monster_defense" || meterType === "monster_health") {
        const statusForDisplay = statusTextToUse || (finalPct > 0 ? getUIText("online") : getUIText("offline"));
        newContentForTextEl = `${statusForDisplay}: ${finalPct}%`;
        // Ensure "Offline" status if percentage is 0, unless statusText already indicates something like "Destroyed"
        if (finalPct === 0 && statusForDisplay.toLowerCase() !== getUIText("offline").toLowerCase() && statusForDisplay.toLowerCase() !== (getUIText(itemConfig.default_status_key, {}, {explicitThemeContext: getCurrentTheme()}) || '').toLowerCase()) {
             newContentForTextEl = `${getUIText("offline")}: ${finalPct}%`;
        }
    } else if ((meterType === "mana" || meterType === "stamina") && statusTextToUse) {
        newContentForTextEl = `${statusTextToUse}: ${finalPct}%`;
    } else { // Default to just percentage if no specific status text logic
        newContentForTextEl = (newContentForTextEl === "" && !isNaN(parsedPct)) ? `${finalPct}%` : newContentForTextEl || `${finalPct}%`;
    }


    if (textEl && textEl.textContent !== newContentForTextEl) {
        textEl.textContent = newContentForTextEl;
        updatedOccurred = true;
    }

    if (barEl) {
        if (barEl.style.width !== `${finalPct}%`) {
            barEl.style.width = `${finalPct}%`;
            updatedOccurred = true;
        }

        // Update bar classes for color coding
        const currentClasses = Array.from(barEl.classList).filter(cls => cls.startsWith("meter-") && cls !== "meter-bar");
        let newBarClasses = [];

        const isOfflineStatus = (meterType === "shields" || meterType === "conceptual_cohesion" || meterType === "monster_defense") &&
                          (statusTextToUse && statusTextToUse.toLowerCase() === getUIText("offline").toLowerCase());

        if (isOfflineStatus || newContentForTextEl === getUIText("not_available_short") || newContentForTextEl === getUIText("unknown") || newContentForTextEl === "---") {
            newBarClasses.push("meter-offline");
        } else {
            if (finalPct <= 10) newBarClasses.push("meter-critical");
            else if (finalPct <= 25) newBarClasses.push("meter-low");
            else if (finalPct <= 50) newBarClasses.push("meter-medium");
            else {
                newBarClasses.push("meter-full");
                // Add specific "ok" state classes if needed for certain meter types
                if (meterType === "health") newBarClasses.push("meter-ok-health"); // Example
                else if (meterType === "shields" || itemConfig.meter_type === "enemy_shields") newBarClasses.push("meter-ok-shield");
                else if (meterType === "fuel") newBarClasses.push("meter-ok-fuel");
                else if (meterType === "stamina") newBarClasses.push("meter-ok-stamina");
                else if (meterType === "mana") newBarClasses.push("meter-ok-mana");
            }
        }

        let classesChanged = newBarClasses.length !== currentClasses.length || !newBarClasses.every(cls => currentClasses.includes(cls));
        if (classesChanged) {
            currentClasses.forEach(cls => barEl.classList.remove(cls));
            newBarClasses.forEach(cls => barEl.classList.add(cls));
            updatedOccurred = true;
        }
        if (!barEl.classList.contains("meter-bar")) barEl.classList.add("meter-bar"); // Ensure base class
    }

    if (updatedOccurred && highlight) {
        const container = textEl ? textEl.closest(".info-item, .info-item-meter") : (barEl ? barEl.closest(".info-item, .info-item-meter") : null);
        if (container) highlightElementUpdate(container);
    }
}


/**
 * Updates the display of a status level item (e.g., threat level, blight exposure).
 * @param {HTMLElement} valueElement - The element displaying the status text.
 * @param {string} newValue - The new level value (e.g., "1", "2", "high", "low").
 * @param {object} levelMappingsConfig - The theme's config for level_mappings for this item.
 * @param {string} themeId - The current theme ID for localization.
 * @param {boolean} [highlight=true] - Whether to visually highlight the update.
 */
export function updateStatusLevelDisplay(valueElement, newValue, levelMappingsConfig, themeId, highlight = true) {
    if (!valueElement || !levelMappingsConfig) return;

    const levelConfig = levelMappingsConfig[String(newValue)]; // Ensure newValue is string for key lookup

    if (levelConfig && levelConfig.display_text_key) {
        const newDisplayText = getUIText(levelConfig.display_text_key, {}, { explicitThemeContext: themeId, viewContext: 'game' });
        const newCssClass = levelConfig.css_class || "status-info"; // Default CSS class

        if (valueElement.textContent !== newDisplayText || !valueElement.classList.contains(newCssClass)) {
            valueElement.textContent = newDisplayText;
            // Remove all potential old status classes before adding the new one
            Object.values(levelMappingsConfig).forEach(mapping => {
                if (mapping.css_class) valueElement.classList.remove(mapping.css_class);
            });
            valueElement.classList.add(newCssClass);

            if (highlight) {
                const itemContainer = valueElement.closest(".info-item, .info-item-meter");
                if (itemContainer) highlightElementUpdate(itemContainer);
            }
        }
    } else {
        // Fallback if mapping is not found
        valueElement.textContent = getUIText("unknown");
        Object.values(levelMappingsConfig).forEach(mapping => {
            if (mapping.css_class) valueElement.classList.remove(mapping.css_class);
        });
        valueElement.classList.add("status-info");
        log(LOG_LEVEL_WARN, `Status level mapping not found for value "${newValue}" in theme "${themeId}".`);
    }
}

// --- Scroll Indicators ---

/**
 * Checks if an element is out of view within its sidebar and updates tracking.
 * @param {HTMLElement} elementToCheck - The dashboard element (panel box or item container).
 * @param {'left' | 'right'} panelSide - Which sidebar the element belongs to.
 * @private
 */
function _checkAndTrackElementVisibility(elementToCheck, panelSide) {
    if (!elementToCheck || !elementToCheck.id) return;

    const parentSidebar = panelSide === 'left' ? leftPanel : rightPanel;
    if (!parentSidebar || !parentSidebar.contains(elementToCheck)) return; // Element not in the specified sidebar

    // If the element is a panel box and it's collapsed, it's not "visually out of view" for scrolling purposes
    // unless the header itself is out of view.
    // For items *within* a collapsed panel, they are not considered for scroll indicators.
    if (elementToCheck.classList.contains('panel-box') && !elementToCheck.classList.contains('is-expanded')) {
        let changed = false;
        // If it was previously tracked as out of view (e.g. it was expanded and scrolled), remove it.
        if (_outOfViewTrackedElements[panelSide].up.delete(elementToCheck.id)) changed = true;
        if (_outOfViewTrackedElements[panelSide].down.delete(elementToCheck.id)) changed = true;
        if (changed) updateScrollIndicators(panelSide);
        return;
    }

    requestAnimationFrame(() => { // Ensure layout is stable
        const sidebarRect = parentSidebar.getBoundingClientRect();
        const elRect = elementToCheck.getBoundingClientRect();
        let changedInTracking = false;

        // Check if element is scrolled out of view upwards
        const isOutOfViewUpwards = elRect.top < sidebarRect.top - SCROLL_INDICATOR_TOLERANCE;
        if (isOutOfViewUpwards) {
            if (!_outOfViewTrackedElements[panelSide].up.has(elementToCheck.id)) {
                _outOfViewTrackedElements[panelSide].up.add(elementToCheck.id);
                changedInTracking = true;
            }
        } else {
            if (_outOfViewTrackedElements[panelSide].up.delete(elementToCheck.id)) {
                changedInTracking = true;
            }
        }

        // Check if element is scrolled out of view downwards
        const isOutOfViewDownwards = elRect.bottom > sidebarRect.bottom + SCROLL_INDICATOR_TOLERANCE;
        if (isOutOfViewDownwards) {
            if (!_outOfViewTrackedElements[panelSide].down.has(elementToCheck.id)) {
                _outOfViewTrackedElements[panelSide].down.add(elementToCheck.id);
                changedInTracking = true;
            }
        } else {
            if (_outOfViewTrackedElements[panelSide].down.delete(elementToCheck.id)) {
                changedInTracking = true;
            }
        }

        if (changedInTracking) {
            updateScrollIndicators(panelSide);
        }
    });
}


/**
 * Updates the visibility of scroll indicators for a given panel side.
 * @param {'left' | 'right'} panelSide - The side of the panel.
 */
export function updateScrollIndicators(panelSide) {
    const panelElement = panelSide === 'left' ? leftPanel : rightPanel;

    // If on landing page, or panel element doesn't exist, hide indicators
    if (!panelElement || document.body.classList.contains("landing-page-active")) {
        const indicatorsToHide = panelSide === 'left' ?
            [leftPanelScrollIndicatorUp, leftPanelScrollIndicatorDown] :
            [rightPanelScrollIndicatorUp, rightPanelScrollIndicatorDown];
        indicatorsToHide.forEach(ind => { if (ind) ind.style.display = 'none'; });
        return;
    }

    const upIndicator = panelSide === 'left' ? leftPanelScrollIndicatorUp : rightPanelScrollIndicatorUp;
    const downIndicator = panelSide === 'left' ? leftPanelScrollIndicatorDown : rightPanelScrollIndicatorDown;

    if (!upIndicator || !downIndicator) {
        log(LOG_LEVEL_WARN, `Scroll indicators for ${panelSide} panel not found in DOM.`);
        return;
    }

    const needsUpIndicator = _outOfViewTrackedElements[panelSide].up.size > 0;
    const needsDownIndicator = _outOfViewTrackedElements[panelSide].down.size > 0;

    upIndicator.style.display = needsUpIndicator ? 'flex' : 'none';
    downIndicator.style.display = needsDownIndicator ? 'flex' : 'none';
    log(LOG_LEVEL_DEBUG, `Scroll indicators for ${panelSide} updated: UP=${needsUpIndicator}, DOWN=${needsDownIndicator}`);
}

/**
 * Triggers a re-check of all visible items/panels in a sidebar for scroll tracking.
 * Useful after panel expansions/collapses or significant content changes.
 * @param {'left' | 'right'} panelSide - The side of the panel.
 */
export function refreshScrollTrackingForSidebar(panelSide) {
    const sidebarElement = panelSide === 'left' ? leftPanel : rightPanel;
    if (!sidebarElement) return;

    _outOfViewTrackedElements[panelSide].up.clear();
    _outOfViewTrackedElements[panelSide].down.clear();

    const panelBoxes = sidebarElement.querySelectorAll('.panel-box');
    panelBoxes.forEach(box => {
        // Only track visibility for boxes that are not part of landing page placeholders
        if (box.closest('#landing-theme-description-container') || box.closest('#landing-theme-details-container')) {
            return;
        }

        // If the box itself is visible (not display:none due to hidden_until_active logic)
        if (window.getComputedStyle(box).display !== 'none') {
            _checkAndTrackElementVisibility(box, panelSide); // Check the panel box itself
            if (box.classList.contains('is-expanded')) { // If expanded, check its items
                const items = box.querySelectorAll('.info-item, .info-item-meter');
                items.forEach(item => _checkAndTrackElementVisibility(item, panelSide));
            }
        }
    });
    updateScrollIndicators(panelSide); // Update indicators based on new tracking
}

/**
 * Resets the entire dashboard UI for a given theme.
 * This involves clearing old panels, scroll tracking, and generating/initializing new panels.
 * @param {string} themeId - The ID of the theme to set up the dashboard for.
 */
export function resetDashboardUI(themeId) {
    log(LOG_LEVEL_INFO, `Resetting dashboard UI for theme: ${themeId}`);

    // 1. Clear existing game-specific panel DOM elements
    [leftPanel, rightPanel].forEach(panelContainer => {
        if (panelContainer) {
            Array.from(panelContainer.querySelectorAll('.panel-box'))
                .filter(box => !box.closest('#landing-theme-description-container') && !box.closest('#landing-theme-details-container'))
                .forEach(el => el.remove());
            log(LOG_LEVEL_DEBUG, `Cleared game-specific panels from ${panelContainer.id}`);
        }
    });

    // 2. Reset internal scroll tracking state
    Object.keys(_outOfViewTrackedElements).forEach(side => {
        _outOfViewTrackedElements[side].up.clear();
        _outOfViewTrackedElements[side].down.clear();
    });
    updateScrollIndicators('left'); // Hide any lingering indicators
    updateScrollIndicators('right');
    log(LOG_LEVEL_DEBUG, "Dashboard scroll tracking state reset.");

    // 3. Generate the new panel structure, initialize default texts, and setup collapsible behavior.
    generatePanelsForTheme(themeId);

    log(LOG_LEVEL_INFO, `Dashboard UI reset and re-initialized for theme: ${themeId}`);
}

/**
 * Retrieves the last known raw dashboard updates for re-translation purposes or state persistence.
 * @returns {object} The last known dashboard updates object.
 */
export function getLastKnownDashboardUpdatesForTranslationsReapply() {
    // This should ideally get it from state.js to ensure consistency.
    // Assuming state.js exports getLastKnownDashboardUpdates()
    return getLastKnownDashboardUpdates();
}
