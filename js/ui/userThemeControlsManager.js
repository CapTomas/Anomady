// js/ui/userThemeControlsManager.js
/**
 * @file Manages UI elements related to "playing" and "liked" themes,
 * primarily the top bar icons and interaction logic for liking/unliking themes,
 * and setting themes as currently playing.
 */
import {
    playingThemesContainer,
    likedThemesContainer,
    likedThemesSeparator,
} from './domElements.js';
import {
    getPlayingThemes,
    setPlayingThemes,
    getLikedThemes,
    setLikedThemes,
    getCurrentTheme as getStateCurrentTheme,
    getCurrentUser,
    getCurrentLandingGridSelection,
} from '../core/state.js';
import { getThemeConfig } from '../services/themeService.js';
import { getUIText } from '../services/localizationService.js';
import * as apiService from '../core/apiService.js';
import { log, LOG_LEVEL_INFO, LOG_LEVEL_ERROR, LOG_LEVEL_DEBUG, LOG_LEVEL_WARN } from '../core/logger.js';
import { attachTooltip } from './tooltipManager.js';

// Dependencies to be injected by app.js or a higher-level orchestrator
let _gameControllerRef = null;
let _landingPageManagerRef = null;

/**
 * Initializes the UserThemeControlsManager with references to other modules.
 * @param {object} gameController - Reference to gameController.
 * @param {object} landingPageManager - Reference to landingPageManager.
 */
export function initUserThemeControlsManager(gameController, landingPageManager) {
    _gameControllerRef = gameController;
    _landingPageManagerRef = landingPageManager;
    log(LOG_LEVEL_INFO, "UserThemeControlsManager initialized.");
}

/**
 * Helper function to update a theme interaction on the backend.
 * @param {string} themeId - The ID of the theme.
 * @param {object} interactionPayload - e.g., { is_playing: true } or { is_liked: false }
 * @returns {Promise<boolean>} True if backend update was successful or not needed, false on API error.
 * @private
 */
async function _updateThemeInteractionOnBackend(themeId, interactionPayload) {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.token) {
        log(LOG_LEVEL_DEBUG, "User not logged in. Skipping backend update for theme interaction.");
        return true; // Not an error, just skipped
    }
    try {
        log(LOG_LEVEL_DEBUG, `Updating backend theme interaction for theme ${themeId}:`, interactionPayload);
        await apiService.updateThemeInteraction(currentUser.token, themeId, interactionPayload);
        log(LOG_LEVEL_INFO, `Theme interaction for ${themeId} updated successfully on backend.`);
        return true;
    } catch (error) {
        log(LOG_LEVEL_ERROR, `Failed to update theme interaction for ${themeId} on backend:`, error.message, error.code);
        // Error display should be handled by the calling function if needed (e.g., generic modal)
        return false;
    }
}

/**
 * Creates a theme icon button element for the top bar.
 * @param {string} themeId - The ID of the theme.
 * @param {'playing'|'liked'} type - The type of interaction this icon represents.
 * @returns {HTMLElement|null} The button element or null if theme config is missing.
 * @private
 */
function _createThemeTopbarIconElement(themeId, type) {
    const themeConfig = getThemeConfig(themeId);
    if (!themeConfig) {
        log(LOG_LEVEL_WARN, `Cannot create top bar icon for theme ${themeId}: config not found.`);
        return null;
    }
    const isCurrentlyActiveGameTheme = getStateCurrentTheme() === themeId;
    const button = document.createElement("button");
    button.classList.add("theme-button");
    if (isCurrentlyActiveGameTheme) {
            button.classList.add("active");
        }
    button.dataset.theme = themeId;
    button.dataset.interactionType = type;

    const themeNameText = getUIText(themeConfig.name_key, {}, { explicitThemeContext: themeId });
    let ariaLabelValue = themeNameText; // Default aria-label
    let tooltipKeyForAttach;
    let tooltipReplacementsForAttach = {};
    let statusTextForAriaDisplay = "";

    if (type === "playing") {
        statusTextForAriaDisplay = getUIText("theme_icon_alt_text_playing");
        tooltipKeyForAttach = themeConfig.name_key; // Tooltip shows theme name
    } else if (type === "liked") {
        statusTextForAriaDisplay = getUIText("theme_icon_alt_text_liked");
        tooltipKeyForAttach = themeConfig.name_key; // Tooltip also shows theme name
    }

    if (statusTextForAriaDisplay) {
        ariaLabelValue = `${themeNameText} (${statusTextForAriaDisplay})`;
    }

    button.setAttribute("aria-label", ariaLabelValue);
    if (tooltipKeyForAttach) {
        attachTooltip(button, tooltipKeyForAttach, tooltipReplacementsForAttach, { explicitThemeContext: themeId });
    }

    const img = document.createElement("img");
    img.src = themeConfig.icon;
    img.alt = ""; // Decorative, title on button is sufficient

    button.appendChild(img);

    const closeBtn = document.createElement("button");
    closeBtn.classList.add("theme-button-close");
    closeBtn.innerHTML = "×";
    const closeButtonAriaLabelKey = "close_theme_button_aria_label";
    const closeButtonAriaLabelText = getUIText(closeButtonAriaLabelKey, { THEME_NAME: themeNameText });
    closeBtn.setAttribute("aria-label", closeButtonAriaLabelText);
    closeBtn.removeAttribute('title');
    closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleCloseThemeIconClick(themeId, type);
    });
    button.appendChild(closeBtn);

    button.addEventListener("click", () => handleThemeIconClick(themeId));
    return button;
}

/**
 * Updates the theme icons displayed in the top bar based on current state.
 */
export function updateTopbarThemeIcons() {
    if (!playingThemesContainer || !likedThemesContainer || !likedThemesSeparator) {
        log(LOG_LEVEL_WARN, "Top bar theme containers not found. Cannot update icons.");
        return;
    }
    playingThemesContainer.innerHTML = "";
    likedThemesContainer.innerHTML = "";

    const playing = getPlayingThemes();
    const liked = getLikedThemes();

    playing.forEach(themeId => {
        const icon = _createThemeTopbarIconElement(themeId, "playing");
        if (icon) playingThemesContainer.appendChild(icon);
    });

    liked.forEach(themeId => {
        if (!playing.includes(themeId)) { // Only show in liked if not already in playing
            const icon = _createThemeTopbarIconElement(themeId, "liked");
            if (icon) likedThemesContainer.appendChild(icon);
        }
    });

    const hasPlaying = playingThemesContainer.children.length > 0;
    const hasLikedOnly = likedThemesContainer.children.length > 0;
    likedThemesSeparator.style.display = (hasPlaying && hasLikedOnly) ? "block" : "none";

    log(LOG_LEVEL_DEBUG, "Top bar theme icons updated.");
}

/**
 * Handles clicks on theme icons in the top bar. Switches to the selected theme.
 * @param {string} themeId - The ID of the theme clicked.
 */
export async function handleThemeIconClick(themeId) {
    log(LOG_LEVEL_INFO, `Top bar theme icon clicked: ${themeId}`);
    if (!_gameControllerRef || typeof _gameControllerRef.changeActiveTheme !== 'function') {
        log(LOG_LEVEL_ERROR, "GameController reference or changeActiveTheme method not available.");
        return;
    }
    try {
        // The changeActiveTheme method will determine if it's a new game or resume.
        await _gameControllerRef.changeActiveTheme(themeId, false); // false for forceNewGame
    } catch (error) {
        log(LOG_LEVEL_ERROR, `Error changing active theme to ${themeId} from top bar:`, error);
        // Consider showing a user-facing error modal here
    }
}

/**
 * Handles clicking the "Like" button on the landing page for a specific theme.
 * @param {string} themeId - The ID of the theme to like/unlike.
 * @param {HTMLElement} likeButtonElement - The like button element itself, for direct UI update.
 */
export async function handleLikeThemeOnLandingClick(themeId, likeButtonElement) {
    const isCurrentlyLiked = getLikedThemes().includes(themeId);
    log(LOG_LEVEL_INFO, `Like button clicked on landing for theme ${themeId}. Currently liked: ${isCurrentlyLiked}`);

    if (isCurrentlyLiked) {
        const newLikedThemes = getLikedThemes().filter(id => id !== themeId);
        setLikedThemes(newLikedThemes);
    } else {
        const newLikedThemes = [...getLikedThemes(), themeId];
        setLikedThemes(newLikedThemes);
    }

    const apiSuccess = await _updateThemeInteractionOnBackend(themeId, { is_liked: !isCurrentlyLiked });

    if (!apiSuccess) {
        // Revert optimistic state update if API call failed
        if (isCurrentlyLiked) { // Was liked, tried to unlike, failed -> add back
            setLikedThemes([...getLikedThemes(), themeId]);
        } else { // Was not liked, tried to like, failed -> remove
            setLikedThemes(getLikedThemes().filter(id => id !== themeId));
        }
        // Optionally show an error message to the user
    }

    updateTopbarThemeIcons(); // Update top bar regardless of API success (reflects optimistic state)

    // Re-render landing page action buttons to reflect the new like state
    if (_landingPageManagerRef && typeof _landingPageManagerRef.renderLandingPageActionButtons === 'function' &&
        document.body.classList.contains('landing-page-active') && getCurrentLandingGridSelection() === themeId) {
        _landingPageManagerRef.renderLandingPageActionButtons(themeId);
    }
    log(LOG_LEVEL_DEBUG, `Theme ${themeId} like status toggled. New state: ${!isCurrentlyLiked}. API success: ${apiSuccess}`);
}


/**
 * Handles closing a theme via its top bar icon's close button.
 * Removes it from "playing" and "liked" lists based on the icon type.
 * @param {string} themeId - The ID of the theme to close.
 * @param {'playing'|'liked'} interactionType - The type of icon that was closed.
 */
export async function handleCloseThemeIconClick(themeId, interactionType) {
    log(LOG_LEVEL_INFO, `Close icon clicked for theme ${themeId} (type: ${interactionType})`);
    const wasCurrentlyPlayingGame = getStateCurrentTheme() === themeId;
    let payload = {};
    let apiSuccess = true; // Assume success for optimistic updates if no API call needed / user not logged in

    if (interactionType === "playing") {
        // Remove from playing list, keep liked status
        const playing = getPlayingThemes();
        if (playing.includes(themeId)) {
            setPlayingThemes(playing.filter(id => id !== themeId));
        }
        payload = { is_playing: false };
        // is_liked status is intentionally not sent to preserve it
    } else if (interactionType === "liked") {
        // Remove from liked list
        const liked = getLikedThemes();
        if (liked.includes(themeId)) {
            setLikedThemes(liked.filter(id => id !== themeId));
        }
        payload = { is_liked: false };
        // is_playing status is intentionally not sent (should be false anyway for a purely liked icon)
    } else {
        log(LOG_LEVEL_WARN, `Unknown interactionType '${interactionType}' in handleCloseThemeIconClick for theme ${themeId}. No action taken.`);
        return; // Should not happen with current UI
    }

    // Update backend if user is logged in
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.token) {
        apiSuccess = await _updateThemeInteractionOnBackend(themeId, payload);
        if (!apiSuccess) {
            log(LOG_LEVEL_ERROR, `API update failed on closing ${themeId}. Local state might be temporarily inconsistent with backend.`);
            // Revert optimistic UI changes if API fails.
            // This is complex because we'd need to know the original state of both playing and liked.
            // For now, we'll rely on a full refresh from loadUserThemeInteractions() if critical.
            // Simple revert for the specific list modified:
            if (interactionType === "playing" && !getPlayingThemes().includes(themeId)) {
                setPlayingThemes([...getPlayingThemes(), themeId]);
            } else if (interactionType === "liked" && !getLikedThemes().includes(themeId)) {
                setLikedThemes([...getLikedThemes(), themeId]);
            }
        }
    }

    updateTopbarThemeIcons(); // Update UI immediately based on (potentially optimistic) local state

    if (wasCurrentlyPlayingGame && interactionType === "playing") {
        // Only switch to landing if the *active game* was closed.
        // If a non-active "playing" icon was closed (e.g., from a multi-session feature not yet implemented),
        // or a "liked" icon was closed, it shouldn't force a switch from the current game.
        log(LOG_LEVEL_INFO, `Closed active game theme ${themeId}. Switching to landing view.`);
        if (_gameControllerRef && typeof _gameControllerRef.switchToLanding === 'function') {
            await _gameControllerRef.switchToLanding();
        } else {
            log(LOG_LEVEL_ERROR, "GameController or switchToLanding method not available for redirect.");
        }
    } else if (document.body.classList.contains('landing-page-active') && getCurrentLandingGridSelection() === themeId) {
        // If on landing page and the closed theme was the selected one, refresh its action buttons
        if (_landingPageManagerRef && typeof _landingPageManagerRef.renderLandingPageActionButtons === 'function') {
            _landingPageManagerRef.renderLandingPageActionButtons(themeId);
        }
    }
}

/**
 * Sets a theme as the "currently playing" theme in the application state and backend.
 * This is typically called by gameController when a game session for a theme starts.
 * @param {string} themeId - The ID of the theme to set as playing.
 */
export async function setThemeAsPlaying(themeId) {
    const playing = getPlayingThemes();
    if (!playing.includes(themeId)) {
        setPlayingThemes([...playing, themeId]);
    }

    // This API call ensures last_played_at is updated and is_playing: true
    // The backend should handle ensuring only one theme is_playing: true per user.
    const apiSuccess = await _updateThemeInteractionOnBackend(themeId, { is_playing: true });

    if (!apiSuccess) {
        log(LOG_LEVEL_WARN, `API call to set ${themeId} as playing failed. Local state updated optimistically.`);
        // Consider if UI should show an error or if optimistic update is acceptable.
    }
    updateTopbarThemeIcons();
    log(LOG_LEVEL_INFO, `Theme ${themeId} set as playing. API success: ${apiSuccess}`);
}

/**
 * Marks a theme as "not playing" in the application state and backend.
 * This is distinct from "closing" which also removes from liked.
 * @param {string} themeId - The ID of the theme.
 */
export async function setThemeAsNotPlaying(themeId) {
    const playing = getPlayingThemes();
    if (playing.includes(themeId)) {
        setPlayingThemes(playing.filter(id => id !== themeId));
    }

    const apiSuccess = await _updateThemeInteractionOnBackend(themeId, { is_playing: false });

    if (!apiSuccess) {
        log(LOG_LEVEL_WARN, `API call to set ${themeId} as NOT playing failed. Local state updated optimistically.`);
    }
    updateTopbarThemeIcons();
    log(LOG_LEVEL_INFO, `Theme ${themeId} set as NOT playing. API success: ${apiSuccess}`);
}

/**
 * Fetches all theme interactions (playing/liked) for the current user from the backend.
 * Updates the local state and refreshes the top bar UI.
 */
export async function loadUserThemeInteractions() {
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.token) {
        log(LOG_LEVEL_INFO, `Fetching all theme interactions for user ${currentUser.email}.`);
        try {
            const response = await apiService.fetchThemeInteractions(currentUser.token);
            if (response && response.interactions) {
                setPlayingThemes(response.interactions.playingThemeIds || []);
                setLikedThemes(response.interactions.likedThemeIds || []);
                log(LOG_LEVEL_INFO, "All theme interactions loaded from backend:", {
                    playing: getPlayingThemes().length,
                    liked: getLikedThemes().length
                });
            } else {
                log(LOG_LEVEL_WARN, "Unexpected response from fetchThemeInteractions. Defaulting to empty lists.", response);
                setPlayingThemes([]);
                setLikedThemes([]);
            }
        } catch (error) {
            log(LOG_LEVEL_ERROR, "Error fetching all theme interactions:", error.message);
            setPlayingThemes([]);
            setLikedThemes([]);
        }
    } else {
        log(LOG_LEVEL_INFO, "User not logged in. Initializing theme interaction lists as empty.");
        setPlayingThemes([]);
        setLikedThemes([]);
    }
    updateTopbarThemeIcons();
}
