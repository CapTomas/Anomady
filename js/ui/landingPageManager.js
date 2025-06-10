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
    getCurrentUser,
    setLandingSelectedThemeProgress,
    getLandingSelectedThemeProgress
} from '../core/state.js';
import { getThemeConfig } from '../services/themeService.js';
import { MIN_LEVEL_FOR_STORE } from '../core/config.js';
import { getUIText } from '../services/localizationService.js';
import * as apiService from '../core/apiService.js';
import { THEMES_MANIFEST } from '../data/themesManifest.js';
import { log, LOG_LEVEL_INFO, LOG_LEVEL_ERROR, LOG_LEVEL_WARN, LOG_LEVEL_DEBUG } from '../core/logger.js';
import { formatDynamicText, setGMActivityIndicator } from './uiUtils.js';
import { attachTooltip } from './tooltipManager.js';
import { animatePanelExpansion } from './dashboardManager.js';

// Dependencies to be injected by app.js or a higher-level orchestrator
let _gameControllerRef = null;
let _userThemeControlsManagerRef = null; // For like button logic and top bar updates

/**
 * Fetches all necessary data (progress, traits) for a selected theme on the landing page.
 * @param {string} themeId - The ID of the theme to fetch data for.
 * @private
 */
async function _prepareDataForLandingThemeSelection(themeId) {
    // Fetch UserThemeProgress
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.token) {
        try {
            const progressData = await apiService.fetchUserThemeProgress(currentUser.token, themeId);
            setLandingSelectedThemeProgress(progressData.userThemeProgress);
            log(LOG_LEVEL_DEBUG, `Fetched and set landing theme progress for: ${themeId}`);
        } catch (error) {
            log(LOG_LEVEL_WARN, `Could not fetch theme progress for landing selection ${themeId}. Defaulting.`, error);
            setLandingSelectedThemeProgress(null);
        }
    } else {
        setLandingSelectedThemeProgress(null);
    }
    // Pre-fetch traits data so the progress modal has it ready.
    try {
        await themeService.fetchAndCachePromptFile(themeId, 'traits');
        log(LOG_LEVEL_DEBUG, `Pre-fetched traits for landing theme: ${themeId}`);
    } catch (error) {
        log(LOG_LEVEL_WARN, `Could not pre-fetch traits for landing selection ${themeId}.`, error);
        // This is not critical, the modal will just show no traits if this fails.
    }
}

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
 * This also handles pre-fetching character progress if a theme is already selected on load.
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

    // Check for a pre-selected theme and fetch its progress before rendering panels
    const currentSelection = getCurrentLandingGridSelection();
    if (currentSelection) {
        await _prepareDataForLandingThemeSelection(currentSelection);
    }

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
    if (_userThemeControlsManagerRef && typeof _userThemeControlsManagerRef.updateTopbarThemeIcons === 'function') {
        _userThemeControlsManagerRef.updateTopbarThemeIcons();
    } else {
        log(LOG_LEVEL_WARN, "UserThemeControlsManager or updateTopbarThemeIcons not available. Top bar icons might not reflect current state.");
    }

    await fetchShapedWorldStatusAndUpdateGrid();
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
        const themeFullNameKey = themeConfig.name_key;
        const themeFullNameText = getUIText(themeFullNameKey, {}, { explicitThemeContext: themeConfig.id, viewContext: 'landing' });
        button.setAttribute("aria-label", themeFullNameText);
        button.removeAttribute('title');

        const img = document.createElement("img");
        img.src = themeConfig.icon;
        const altTextKey = themeConfig.icon_alt_text_key || `theme_icon_alt_text_default_${themeConfig.id}`;
        img.alt = getUIText(altTextKey, {}, { explicitThemeContext: themeConfig.id, viewContext: 'landing' }) || themeFullName;

        const nameSpan = document.createElement("span");
        nameSpan.classList.add("theme-grid-icon-name");
        const themeShortNameKey = themeConfig.name_short_key || themeConfig.name_key;
        nameSpan.textContent = getUIText(themeShortNameKey, {}, { explicitThemeContext: themeConfig.id, viewContext: 'landing' });

        const themeStatus = shapedData.get(themeConfig.id);
        const hasAnyShards = themeStatus && themeStatus.hasShards;
        if (hasAnyShards) {
            button.classList.add("theme-grid-icon-shaped");
            const shardIndicator = document.createElement("div");
            shardIndicator.classList.add("shard-indicator-overlay");
            const shardTooltipKey = "tooltip_shaped_world";
            attachTooltip(shardIndicator, shardTooltipKey, { ACTIVE_SHARDS: themeStatus.activeShardCount }, { viewContext: 'landing' });
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
    landingThemeActions.style.flexDirection = 'column';
    landingThemeActions.style.gap = 'var(--spacing-sm)';
    const themeConfig = getThemeConfig(themeId);
    const themeManifestEntry = THEMES_MANIFEST.find(t => t.id === themeId);
    if (!themeConfig || !themeManifestEntry) {
        log(LOG_LEVEL_ERROR, `Cannot render landing actions: Config or manifest entry missing for ${themeId}.`);
        return;
    }
    const isThemePlayed = getPlayingThemes().includes(themeId);
    const currentUser = getCurrentUser();
    const progressData = getLandingSelectedThemeProgress();
    // --- Top Row: Continue & Character Progress ---
    if (isThemePlayed && themeManifestEntry.playable) {
        const topActionRow = document.createElement('div');
        topActionRow.className = 'landing-actions-row';
        // Continue Button
        const continueButton = document.createElement("button");
        continueButton.id = "continue-theme-button";
        continueButton.classList.add("ui-button", "primary");
        continueButton.style.flexGrow = '1';
        continueButton.textContent = getUIText("button_continue_game", {}, { explicitThemeContext: themeId, viewContext: 'landing' });
        continueButton.addEventListener("click", () => {
            if (_gameControllerRef && typeof _gameControllerRef.changeActiveTheme === 'function') {
                _gameControllerRef.changeActiveTheme(themeId, false);
            }
        });
        topActionRow.appendChild(continueButton);
        // Character Progress Button
        const characterProgressButton = document.createElement("button");
        characterProgressButton.id = "character-progress-button";
        characterProgressButton.classList.add("ui-button", "icon-button", "character-progress-button");
        // Check for *any* progress to determine the icon style.
        const hasProgress = currentUser && progressData && (progressData.currentXP > 0 || progressData.level > 1 || (progressData.acquiredTraitKeys && progressData.acquiredTraitKeys.length > 0));
        const progressIconSrc = hasProgress ? "images/app/icon_character.svg" : "images/app/icon_character.svg";
        const progressTooltipKey = "tooltip_character_progress"; // Tooltip is now always the same.
        const progressAltText = getUIText(progressTooltipKey, {}, { viewContext: 'landing' });
        characterProgressButton.innerHTML = `<img src="${progressIconSrc}" alt="${progressAltText}" class="character-icon">`;
        characterProgressButton.setAttribute("aria-label", progressAltText);
        attachTooltip(characterProgressButton, progressTooltipKey, {}, { viewContext: 'landing' });
        // Enable the button if the user is logged in and progress data is available, regardless of whether it's a new character.
        if (currentUser && progressData) {
            characterProgressButton.disabled = false;
            characterProgressButton.addEventListener("click", () => {
                if (_gameControllerRef && typeof _gameControllerRef.showCharacterProgressModal === 'function') {
                    _gameControllerRef.showCharacterProgressModal(themeId);
                }
            });
        } else {
            characterProgressButton.disabled = true;
            characterProgressButton.classList.add("disabled");
        }
        topActionRow.appendChild(characterProgressButton);
        landingThemeActions.appendChild(topActionRow);
    }
    // --- Bottom Row: New Game, Like, Store, Shards ---
    const standardActionsRow = document.createElement('div');
    standardActionsRow.className = 'landing-actions-row';
    // "New Game" button
    const newGameButton = document.createElement("button");
    newGameButton.id = "choose-theme-button";
    newGameButton.classList.add("ui-button");
    if (!isThemePlayed) {
        newGameButton.classList.add("primary");
    }
    if (themeManifestEntry.playable) {
        const newGameButtonTextKey = themeConfig.new_game_button_text_key || "landing_choose_theme_button";
        newGameButton.textContent = getUIText(newGameButtonTextKey, {}, { explicitThemeContext: themeId, viewContext: 'landing' });
        newGameButton.addEventListener("click", () => {
            if (_gameControllerRef && typeof _gameControllerRef.initiateNewGameSessionFlow === 'function') {
                _gameControllerRef.initiateNewGameSessionFlow(themeId);
            }
        });
    } else {
        newGameButton.textContent = getUIText("coming_soon_button", {}, { viewContext: 'landing' });
        newGameButton.disabled = true;
        newGameButton.classList.add("disabled");
    }
    standardActionsRow.appendChild(newGameButton);
    // "Like" button
    if (_userThemeControlsManagerRef) {
        const likeButton = document.createElement("button");
        likeButton.id = "like-theme-button";
        likeButton.classList.add("ui-button", "icon-button", "like-theme-button");
        if (themeManifestEntry.playable) {
            const isCurrentlyLiked = getLikedThemes().includes(themeId);
            const likeIconSrc = isCurrentlyLiked ? "images/app/icon_heart_filled.svg" : "images/app/icon_heart_empty.svg";
            const likeAltTextKey = isCurrentlyLiked ? "aria_label_unlike_theme" : "aria_label_like_theme";
            const likeAltText = getUIText(likeAltTextKey, {}, { viewContext: 'landing' });
            likeButton.innerHTML = `<img src="${likeIconSrc}" alt="${likeAltText}" class="like-icon">`;
            likeButton.setAttribute("aria-label", likeAltText);
            attachTooltip(likeButton, likeAltTextKey, {}, { viewContext: 'landing' });
            if (isCurrentlyLiked) likeButton.classList.add("liked");
            likeButton.addEventListener("click", () => {
                 _userThemeControlsManagerRef.handleLikeThemeOnLandingClick(themeId, likeButton);
            });
            likeButton.disabled = false;
        } else {
            likeButton.innerHTML = `<img src="images/app/icon_heart_disabled.svg" alt="${getUIText("aria_label_like_theme", {}, { viewContext: 'landing' })}" class="like-icon">`;
            likeButton.setAttribute("aria-label", getUIText("aria_label_like_theme", {}, { viewContext: 'landing' }));
            attachTooltip(likeButton, "coming_soon_button", {}, { viewContext: 'landing' });
            likeButton.classList.add("disabled");
            likeButton.disabled = true;
        }
        standardActionsRow.appendChild(likeButton);
    }
    // NEW "Store" button
    const storeButton = document.createElement("button");
    storeButton.id = "store-button";
    storeButton.classList.add("ui-button", "icon-button", "store-button");
    const canAccessStore = currentUser && progressData && progressData.level >= MIN_LEVEL_FOR_STORE;
    const storeIconSrc = canAccessStore ? "images/app/icon_store.svg" : "images/app/icon_store.svg";
    const storeTooltipKey = canAccessStore ? "tooltip_store_button" : "tooltip_store_locked_level";
    const storeAltText = getUIText(storeTooltipKey, { MIN_LEVEL: MIN_LEVEL_FOR_STORE }, { viewContext: 'landing' });
    storeButton.innerHTML = `<img src="${storeIconSrc}" alt="${storeAltText}" class="store-icon">`;
    storeButton.setAttribute("aria-label", storeAltText);
    attachTooltip(storeButton, storeTooltipKey, { MIN_LEVEL: MIN_LEVEL_FOR_STORE }, { viewContext: 'landing' });
    if (themeManifestEntry.playable && canAccessStore && _gameControllerRef && typeof _gameControllerRef.showStoreModal === 'function') {
        storeButton.addEventListener("click", () => _gameControllerRef.showStoreModal(themeId));
    } else {
        storeButton.disabled = true;
        storeButton.classList.add("disabled");
    }
    standardActionsRow.appendChild(storeButton);
    // "Configure Shards" icon button
    const themeStatus = getShapedThemeData().get(themeId);
    const configureShardsIconButton = document.createElement("button");
    configureShardsIconButton.id = "configure-shards-icon-button";
    configureShardsIconButton.classList.add("ui-button", "icon-button", "configure-shards-button");
    let shardIconSrc = "images/app/icon_world_shard.svg";
    let shardTooltipKey = "tooltip_no_fragments_to_configure";
    let canConfigureShards = false;
    if (currentUser && themeStatus && themeStatus.hasShards) {
        shardIconSrc = "images/app/icon_world_shard.svg";
        shardTooltipKey = "tooltip_configure_fragments";
        canConfigureShards = true;
    }
    const shardAltText = getUIText(shardTooltipKey, {}, { viewContext: 'landing' });
    configureShardsIconButton.innerHTML = `<img src="${shardIconSrc}" alt="${shardAltText}" class="shard-icon">`;
    configureShardsIconButton.setAttribute("aria-label", shardAltText);
    attachTooltip(configureShardsIconButton, shardTooltipKey, {}, { viewContext: 'landing' });
    if (themeManifestEntry.playable && canConfigureShards && _gameControllerRef && typeof _gameControllerRef.showConfigureShardsModal === 'function') {
        configureShardsIconButton.addEventListener("click", () => _gameControllerRef.showConfigureShardsModal(themeId));
    } else {
        configureShardsIconButton.disabled = true;
        configureShardsIconButton.classList.add("disabled");
    }
    standardActionsRow.appendChild(configureShardsIconButton);
    landingThemeActions.appendChild(standardActionsRow);
}

/**
 * Handles the selection of a theme from the grid.
 * Updates the "active" state in the grid, fetches character progress, and refreshes the side panel content.
 * @param {string} themeId - The ID of the selected theme.
 * @param {boolean} [animatePanel=true] - Whether to animate panel expansion.
 */
export async function handleThemeGridSelection(themeId, animatePanel = true) {
    setCurrentLandingGridSelection(themeId);

    // Fetch all necessary data for the newly selected theme
    await _prepareDataForLandingThemeSelection(themeId);

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
