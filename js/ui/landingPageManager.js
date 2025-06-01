// js/ui/landingPageManager.js
/**
 * @file Handles all UI logic specific to the theme selection/landing page.
 */
import {
    appRoot, // appRoot is still used for some checks, but class manipulation goes to document.body
    themeGridContainer,
    landingThemeDescriptionContainer,
    landingThemeLoreText,
    landingThemeDetailsContainer,
    landingThemeInfoContent,
    landingThemeActions,
    leftPanel,
    rightPanel,
    storyLogViewport,
    suggestedActionsWrapper,
    playerInputControlPanel,
    nameInputSection,
    actionInputSection,
    leftPanelScrollIndicatorUp,
    leftPanelScrollIndicatorDown,
    rightPanelScrollIndicatorUp,
    rightPanelScrollIndicatorDown,
    systemStatusIndicator
} from './domElements.js';
import {
    getCurrentLandingGridSelection,
    setCurrentLandingGridSelection,
    setCurrentTheme as setStateCurrentTheme,
    getPlayingThemes, // Not directly used for modification, but for context
    getLikedThemes,   // Used by renderLandingPageActionButtons for like status
    setShapedThemeData,
    getShapedThemeData,
    getCurrentUser
} from '../core/state.js';
import { getThemeConfig } from '../services/themeService.js';
import { getUIText } from '../services/localizationService.js';
import * as apiService from '../core/apiService.js';
import { THEMES_MANIFEST } from '../data/themesManifest.js';
import { log, LOG_LEVEL_INFO, LOG_LEVEL_ERROR, LOG_LEVEL_WARN, LOG_LEVEL_DEBUG } from '../core/logger.js';
import { formatDynamicText, setGMActivityIndicator } from './uiUtils.js';
import { animatePanelExpansion } from './dashboardManager.js';

// Dependencies to be injected by app.js or a higher-level orchestrator
let _gameControllerRef = null;
let _userThemeControlsManagerRef = null; // For like button logic and top bar updates

/**
 * Initializes the landing page manager with references to other modules.
 * @param {object} gameController - Reference to gameController.
 * @param {object} userThemeControlsManager - Reference to userThemeControlsManager.
 */
export function initLandingPageManager(gameController, userThemeControlsManager) {
    _gameControllerRef = gameController;
    _userThemeControlsManagerRef = userThemeControlsManager;
    log(LOG_LEVEL_INFO, "LandingPageManager initialized with GCRef:", !!_gameControllerRef, "UTCRef:", !!_userThemeControlsManagerRef);
}

/**
 * Fetches the summary of themes with World Shards and updates the UI.
 */
export async function fetchShapedWorldStatusAndUpdateGrid() {
    log(LOG_LEVEL_INFO, "Fetching shaped world status and updating grid...");
    const currentUser = getCurrentUser();
    const newShapedData = new Map();

    if (currentUser && currentUser.token) {
        try {
            const response = await apiService.fetchShapedThemesSummary(currentUser.token);
            if (response && response.shapedThemes && Array.isArray(response.shapedThemes)) {
                response.shapedThemes.forEach(summary => {
                    newShapedData.set(summary.themeId, {
                        hasShards: summary.hasShards === true, // Ensure boolean
                        activeShardCount: summary.activeShardCount || 0
                    });
                });
            } else {
                log(LOG_LEVEL_WARN, "Unexpected response structure from shaped-themes-summary. Defaulting themes to not shaped.", response);
            }
        } catch (error) {
            log(LOG_LEVEL_ERROR, `Error fetching shaped themes summary:`, error.message, error.code);
        }
    } else {
        log(LOG_LEVEL_INFO, "User not logged in, shaped world status will default to 'not shaped'.");
    }

    // Ensure all manifest themes have an entry, defaulting if not found from API
    THEMES_MANIFEST.filter(tm => tm.playable).forEach(themeMeta => {
        if (!newShapedData.has(themeMeta.id)) {
            newShapedData.set(themeMeta.id, { hasShards: false, activeShardCount: 0 });
        }
    });

    setShapedThemeData(newShapedData);
    log(LOG_LEVEL_DEBUG, "Shaped theme data updated in state:", Object.fromEntries(newShapedData));

    await renderThemeGrid(); // Re-render grid with new shard indicators
    const currentSelection = getCurrentLandingGridSelection();
    if (currentSelection && document.body.classList.contains('landing-page-active')) {
        // Ensure the selected item's panel details are updated
        updateLandingPagePanelsWithThemeInfo(currentSelection, false);
        // And re-apply .active class to the grid button
        const selectedBtn = themeGridContainer?.querySelector(`.theme-grid-icon[data-theme="${currentSelection}"]`);
        if (selectedBtn) selectedBtn.classList.add("active");
    }
}

/**
 * Switches the UI to the landing page view.
 * Clears game-specific elements and displays landing page elements.
 */
export async function switchToLandingView() {
    log(LOG_LEVEL_INFO, "Switching to landing page view.");
    setStateCurrentTheme(null);

    // --- FIX APPLIED HERE ---
    document.body.className = ""; // Clear all existing classes from body
    document.body.classList.add("landing-page-active", "theme-landing"); // Set exactly what's needed
    // --- END FIX ---

    if (storyLogViewport) storyLogViewport.style.display = "none";
    if (suggestedActionsWrapper) suggestedActionsWrapper.style.display = "none";
    if (playerInputControlPanel) playerInputControlPanel.style.display = "none";
    if (nameInputSection) nameInputSection.style.display = "none";
    if (actionInputSection) actionInputSection.style.display = "none";

    [leftPanel, rightPanel].forEach(panelContainer => {
        if (panelContainer) {
            Array.from(panelContainer.querySelectorAll('.panel-box'))
                .filter(box => !box.closest('#landing-theme-description-container') && !box.closest('#landing-theme-details-container'))
                .forEach(el => el.remove());
        }
    });

    [leftPanelScrollIndicatorUp, leftPanelScrollIndicatorDown, rightPanelScrollIndicatorUp, rightPanelScrollIndicatorDown].forEach(indicator => {
        if (indicator) indicator.style.display = 'none';
    });

    if (themeGridContainer) themeGridContainer.style.display = "grid";

    if (landingThemeDescriptionContainer) {
        landingThemeDescriptionContainer.style.display = "flex";
        const descTitle = landingThemeDescriptionContainer.querySelector(".panel-box-title");
        if (descTitle) descTitle.textContent = getUIText("landing_theme_description_title", {}, { viewContext: 'landing' });
        const lorePanelBox = landingThemeDescriptionContainer.querySelector(".panel-box");
        if (lorePanelBox) {
            if (!lorePanelBox.id) lorePanelBox.id = "landing-lore-panel-box";
            animatePanelExpansion(lorePanelBox.id, true, false, true);
        }
    }
    if (landingThemeDetailsContainer) {
        landingThemeDetailsContainer.style.display = "flex";
        const detailsTitle = landingThemeDetailsContainer.querySelector(".panel-box-title");
        if (detailsTitle) detailsTitle.textContent = getUIText("landing_theme_info_title", {}, { viewContext: 'landing' });
        const detailsPanelBox = landingThemeDetailsContainer.querySelector(".panel-box");
        if (detailsPanelBox) {
            if (!detailsPanelBox.id) detailsPanelBox.id = "landing-details-panel-box";
            animatePanelExpansion(detailsPanelBox.id, true, false, true);
        }
    }

    if (landingThemeLoreText) landingThemeLoreText.innerHTML = `<p>${getUIText("landing_select_theme_prompt_lore", {}, { viewContext: 'landing' })}</p>`;
    if (landingThemeInfoContent) landingThemeInfoContent.innerHTML = `<p>${getUIText("landing_select_theme_prompt_details", {}, { viewContext: 'landing' })}</p>`;
    if (landingThemeActions) landingThemeActions.style.display = "none";

    if (systemStatusIndicator) {
        systemStatusIndicator.textContent = getUIText("standby", {}, { viewContext: 'landing' });
        systemStatusIndicator.className = "status-indicator status-ok";
    }
    setGMActivityIndicator(false);

    // Fetch user theme interactions (playing/liked) AND then fetch shaped world status
    if (_userThemeControlsManagerRef && typeof _userThemeControlsManagerRef.loadUserThemeInteractions === 'function') {
        await _userThemeControlsManagerRef.loadUserThemeInteractions();
    } else {
        log(LOG_LEVEL_WARN, "UserThemeControlsManager or loadUserThemeInteractions not available. Top bar and like states may not be fresh.");
    }

    await fetchShapedWorldStatusAndUpdateGrid(); // This will call renderThemeGrid and update panels

    // After grid is rendered, if there's a saved selection, ensure it's visually marked
    const savedSelection = getCurrentLandingGridSelection();
    if (savedSelection && themeGridContainer) {
        const selectedBtn = themeGridContainer.querySelector(`.theme-grid-icon[data-theme="${savedSelection}"]`);
        if (selectedBtn) selectedBtn.classList.add("active");
    }
}

/**
 * Switches the UI to the main game view for a specific theme.
 * (This is called by gameController or when resuming a game).
 * @param {string} themeId - The ID of the theme to switch to.
 */
export function switchToGameView(themeId) {
    // --- FIX APPLIED HERE ---
    document.body.className = ""; // Clear all existing classes from body
    document.body.classList.add(`theme-${themeId}`); // Set exactly what's needed for game view
    // --- END FIX ---

    if (themeGridContainer) themeGridContainer.style.display = "none";
    if (landingThemeDescriptionContainer) landingThemeDescriptionContainer.style.display = "none";
    if (landingThemeDetailsContainer) landingThemeDetailsContainer.style.display = "none";

    if (storyLogViewport) storyLogViewport.style.display = "block";
    if (suggestedActionsWrapper) suggestedActionsWrapper.style.display = "flex";
    if (playerInputControlPanel) playerInputControlPanel.style.display = "block";
    // Start/name input section vs action input section is handled by gameController based on game state
}

/**
 * Renders the theme selection grid on the landing page.
 */
export async function renderThemeGrid() {
    if (!themeGridContainer) {
        log(LOG_LEVEL_WARN, "Theme grid container not found. Cannot render theme grid.");
        return;
    }
    themeGridContainer.innerHTML = "";
    const shapedData = getShapedThemeData();

    THEMES_MANIFEST.forEach(themeMeta => {
        const themeConfig = getThemeConfig(themeMeta.id);
        if (!themeConfig || !themeMeta.playable) { // Only render playable themes in the grid
            return;
        }

        const button = document.createElement("button");
        button.classList.add("theme-grid-icon");
        button.dataset.theme = themeConfig.id;

        const themeFullName = getUIText(themeConfig.name_key, {}, { explicitThemeContext: themeConfig.id, viewContext: 'landing' });
        button.title = themeFullName;
        button.setAttribute("aria-label", themeFullName);

        const img = document.createElement("img");
        img.src = themeConfig.icon;
        const altTextKey = themeConfig.icon_alt_text_key || `theme_icon_alt_text_default_${themeConfig.id}`;
        img.alt = getUIText(altTextKey, {}, { explicitThemeContext: themeConfig.id, viewContext: 'landing' }) || themeFullName;

        const nameSpan = document.createElement("span");
        nameSpan.classList.add("theme-grid-icon-name");
        const themeShortNameKey = themeConfig.name_short_key || themeConfig.name_key;
        nameSpan.textContent = getUIText(themeShortNameKey, {}, { explicitThemeContext: themeConfig.id, viewContext: 'landing' });

        const themeStatus = shapedData.get(themeConfig.id);
        const isShaped = themeStatus && themeStatus.hasShards && themeStatus.activeShardCount > 0;

        if (isShaped) {
            button.classList.add("theme-grid-icon-shaped");
            const shardIndicator = document.createElement("div");
            shardIndicator.classList.add("shard-indicator-overlay");
            shardIndicator.title = getUIText("tooltip_shaped_world", { ACTIVE_SHARDS: themeStatus.activeShardCount }, { viewContext: 'landing' });
            button.appendChild(shardIndicator);
        }

        button.appendChild(img);
        button.appendChild(nameSpan);
        button.addEventListener("click", () => handleThemeGridSelection(themeConfig.id));
        themeGridContainer.appendChild(button);
    });
    log(LOG_LEVEL_DEBUG, "Theme grid rendered.");
}

/**
 * Updates the landing page's side panels with information for the selected theme.
 * @param {string} themeId - The ID of the selected theme.
 * @param {boolean} [animateExpansion=true] - Whether to animate panel expansion.
 */
export function updateLandingPagePanelsWithThemeInfo(themeId, animateExpansion = true) {
    const themeConfig = getThemeConfig(themeId);
    if (!themeConfig || !landingThemeLoreText || !landingThemeInfoContent || !landingThemeDescriptionContainer || !landingThemeDetailsContainer) {
        log(LOG_LEVEL_WARN, `Cannot update landing page panels: Missing config for ${themeId} or DOM elements.`);
        return;
    }

    const descTitle = landingThemeDescriptionContainer.querySelector(".panel-box-title");
    if (descTitle) descTitle.textContent = getUIText("landing_theme_description_title", {}, { viewContext: 'landing' });
    const detailsTitle = landingThemeDetailsContainer.querySelector(".panel-box-title");
    if (detailsTitle) detailsTitle.textContent = getUIText("landing_theme_info_title", {}, { viewContext: 'landing' });

    const loreText = getUIText(themeConfig.lore_key, {}, { explicitThemeContext: themeId, viewContext: 'landing' });
    landingThemeLoreText.innerHTML = `<p>${formatDynamicText(loreText)}</p>`;

    if (animateExpansion) {
        const lorePanelBox = landingThemeDescriptionContainer.querySelector(".panel-box");
        if (lorePanelBox && lorePanelBox.id) animatePanelExpansion(lorePanelBox.id, true, false);
    }

    const themeDisplayName = getUIText(themeConfig.name_long_key || themeConfig.name_key, {}, { explicitThemeContext: themeId, viewContext: 'landing' });
    const inspirationText = getUIText(themeConfig.inspiration_key, {}, { explicitThemeContext: themeId, viewContext: 'landing' });
    const toneText = getUIText(themeConfig.tone_key, {}, { explicitThemeContext: themeId, viewContext: 'landing' });
    const conceptText = getUIText(themeConfig.concept_key, {}, { explicitThemeContext: themeId, viewContext: 'landing' });

    landingThemeInfoContent.innerHTML = `
        <p><strong>${getUIText("landing_theme_name_label", {}, { viewContext: 'landing' })}:</strong> <span id="landing-selected-theme-name">${themeDisplayName}</span></p>
        <p><strong>${getUIText("landing_theme_inspiration_label", {}, { viewContext: 'landing' })}:</strong> <span id="landing-selected-theme-inspiration">${formatDynamicText(inspirationText)}</span></p>
        <p><strong>${getUIText("landing_theme_tone_label", {}, { viewContext: 'landing' })}:</strong> <span id="landing-selected-theme-tone">${formatDynamicText(toneText)}</span></p>
        <p><strong>${getUIText("landing_theme_concept_label", {}, { viewContext: 'landing' })}:</strong> <span id="landing-selected-theme-concept">${formatDynamicText(conceptText)}</span></p>
    `;

    renderLandingPageActionButtons(themeId);
    if (landingThemeActions) landingThemeActions.style.display = "flex";

    if (animateExpansion) {
        const detailsPanelBox = landingThemeDetailsContainer.querySelector(".panel-box");
        if (detailsPanelBox && detailsPanelBox.id) animatePanelExpansion(detailsPanelBox.id, true, false);
    }
    log(LOG_LEVEL_DEBUG, `Landing page panels updated for theme: ${themeId}`);
}

/**
 * Renders the action buttons (Choose, Like, Configure Shards) for the selected theme on the landing page.
 * @param {string} themeId - The ID of the selected theme.
 */
export function renderLandingPageActionButtons(themeId) {
    if (!landingThemeActions) {
        log(LOG_LEVEL_WARN, "Landing theme actions container not found.");
        return;
    }
    landingThemeActions.innerHTML = "";

    const themeConfig = getThemeConfig(themeId);
    const themeManifestEntry = THEMES_MANIFEST.find(t => t.id === themeId);

    if (!themeConfig || !themeManifestEntry) {
        log(LOG_LEVEL_ERROR, `Cannot render landing actions: Config or manifest entry missing for ${themeId}.`);
        return;
    }

    const chooseButton = document.createElement("button");
    chooseButton.id = "choose-theme-button";
    chooseButton.classList.add("ui-button");
    if (themeManifestEntry.playable) {
        chooseButton.classList.add("primary");
        const chooseButtonTextKey = themeConfig.new_game_button_text_key || "landing_choose_theme_button";
        chooseButton.textContent = getUIText(chooseButtonTextKey, {}, { explicitThemeContext: themeId, viewContext: 'landing' });
        chooseButton.addEventListener("click", () => {
            if (_gameControllerRef && typeof _gameControllerRef.initiateNewGameSessionFlow === 'function') {
                _gameControllerRef.initiateNewGameSessionFlow(themeId);
            } else {
                log(LOG_LEVEL_ERROR, "GameController reference or initiateNewGameSessionFlow method not available for choose button.");
            }
        });
        chooseButton.disabled = false;
    } else {
        chooseButton.classList.add("disabled");
        chooseButton.textContent = getUIText("coming_soon_button", {}, { viewContext: 'landing' });
        chooseButton.disabled = true;
    }
    landingThemeActions.appendChild(chooseButton);

    if (_userThemeControlsManagerRef && typeof _userThemeControlsManagerRef.handleLikeThemeOnLandingClick === 'function') {
        const likeButton = document.createElement("button");
        likeButton.id = "like-theme-button"; // Ensure this ID is unique if multiple instances could exist, or handle differently
        likeButton.classList.add("ui-button", "icon-button", "like-theme-button");

        if (themeManifestEntry.playable) {
            const isCurrentlyLiked = getLikedThemes().includes(themeId);
            const likeIconSrc = isCurrentlyLiked ? "images/app/icon_heart_filled.svg" : "images/app/icon_heart_empty.svg";
            const likeAltTextKey = isCurrentlyLiked ? "aria_label_unlike_theme" : "aria_label_like_theme";
            const likeAltText = getUIText(likeAltTextKey, {}, { viewContext: 'landing' });

            likeButton.innerHTML = `<img src="${likeIconSrc}" alt="${likeAltText}" class="like-icon">`;
            likeButton.setAttribute("aria-label", likeAltText);
            likeButton.title = likeAltText;
            if (isCurrentlyLiked) likeButton.classList.add("liked");

            likeButton.addEventListener("click", () => {
                 _userThemeControlsManagerRef.handleLikeThemeOnLandingClick(themeId, likeButton);
                 // Re-render action buttons to reflect the new like state
                 renderLandingPageActionButtons(themeId);
            });
            likeButton.disabled = false;
        } else {
            likeButton.innerHTML = `<img src="images/app/icon_heart_disabled.svg" alt="${getUIText("aria_label_like_theme", {}, { viewContext: 'landing' })}" class="like-icon">`;
            likeButton.setAttribute("aria-label", getUIText("aria_label_like_theme", {}, { viewContext: 'landing' }));
            likeButton.title = getUIText("coming_soon_button", {}, { viewContext: 'landing' });
            likeButton.classList.add("disabled");
            likeButton.disabled = true;
        }
        landingThemeActions.appendChild(likeButton);
    }

    const currentUser = getCurrentUser(); // Need user for shard check
    const themeStatus = getShapedThemeData().get(themeId);

    if (currentUser && // Check if user is logged in
        _gameControllerRef &&
        typeof _gameControllerRef.showConfigureShardsModal === 'function' &&
        themeStatus && themeStatus.hasShards && themeStatus.activeShardCount > 0) {
        const configureShardsButton = document.createElement("button");
        configureShardsButton.id = "configure-shards-button";
        configureShardsButton.classList.add("ui-button");
        configureShardsButton.textContent = getUIText("button_configure_shards", {}, { viewContext: 'landing' });
        configureShardsButton.addEventListener("click", () => {
            _gameControllerRef.showConfigureShardsModal(themeId);
        });
        landingThemeActions.appendChild(configureShardsButton);
    }
}

/**
 * Handles the selection of a theme from the grid.
 * Updates the "active" state in the grid and refreshes the side panel content.
 * @param {string} themeId - The ID of the selected theme.
 * @param {boolean} [animatePanel=true] - Whether to animate panel expansion.
 */
export function handleThemeGridSelection(themeId, animatePanel = true) {
    setCurrentLandingGridSelection(themeId);
    if (themeGridContainer) {
        themeGridContainer.querySelectorAll(".theme-grid-icon.active").forEach(btn => btn.classList.remove("active"));
        const clickedBtn = themeGridContainer.querySelector(`.theme-grid-icon[data-theme="${themeId}"]`);
        if (clickedBtn) clickedBtn.classList.add("active");
    }
    updateLandingPagePanelsWithThemeInfo(themeId, animatePanel);
    log(LOG_LEVEL_INFO, `Theme selected on landing page: ${themeId}`);
}

/**
 * Gets the currently selected theme ID on the landing page grid.
 * @returns {string|null} The theme ID or null if no selection.
 */
export function getCurrentLandingSelection() {
    return getCurrentLandingGridSelection();
}
