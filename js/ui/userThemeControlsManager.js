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
    if (isCurrentlyActiveGameTheme && type === 'playing') {
        button.classList.add("active");
    }
    button.dataset.theme = themeId;
    button.dataset.interactionType = type;

    const themeNameText = getUIText(themeConfig.name_key, {}, { explicitThemeContext: themeId });
    let statusText = "";
    if (type === "playing") statusText = getUIText("theme_icon_alt_text_playing");
    else if (type === "liked") statusText = getUIText("theme_icon_alt_text_liked");
    button.title = `${themeNameText}${statusText ? ` (${statusText})` : ""}`;
    button.setAttribute("aria-label", button.title);

    const img = document.createElement("img");
    img.src = themeConfig.icon;
    img.alt = ""; // Decorative, title on button is sufficient

    button.appendChild(img);

    const closeBtn = document.createElement("button");
    closeBtn.classList.add("theme-button-close");
    closeBtn.innerHTML = "×";
    closeBtn.title = getUIText("close_theme_button_aria_label", { THEME_NAME: themeNameText });
    closeBtn.setAttribute("aria-label", closeBtn.title);
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
 * Removes it from "playing" and "liked" lists.
 * @param {string} themeId - The ID of the theme to close.
 * @param {'playing'|'liked'} interactionType - The type of icon that was closed.
 */
export async function handleCloseThemeIconClick(themeId, interactionType) {
    log(LOG_LEVEL_INFO, `Close icon clicked for theme ${themeId} (type: ${interactionType})`);
    const wasCurrentlyPlayingGame = getStateCurrentTheme() === themeId;

    const payload = { is_playing: false, is_liked: false }; // Assume we remove from both

    // Optimistically update local state
    const newPlaying = getPlayingThemes().filter(id => id !== themeId);
    setPlayingThemes(newPlaying);
    const newLiked = getLikedThemes().filter(id => id !== themeId);
    setLikedThemes(newLiked);

    const apiSuccess = await _updateThemeInteractionOnBackend(themeId, payload);

    if (!apiSuccess) {
        // Revert state if API failed (complex, as it involves two lists)
        // For simplicity now, we'll leave the optimistic update, but log error.
        // A robust solution might re-fetch interactions or use a more complex revert.
        log(LOG_LEVEL_ERROR, `API update failed on closing ${themeId}. Local state might be temporarily inconsistent with backend.`);
    }

    updateTopbarThemeIcons(); // Update UI immediately

    if (wasCurrentlyPlayingGame) {
        log(LOG_LEVEL_INFO, `Closed active game theme ${themeId}. Switching to landing view.`);
        if (_gameControllerRef && typeof _gameControllerRef.switchToLanding === 'function') {
            await _gameControllerRef.switchToLanding();
        } else {
            log(LOG_LEVEL_ERROR, "GameController or switchToLanding method not available for redirect.");
        }
    } else if (document.body.classList.contains('landing-page-active') && getCurrentLandingGridSelection() === themeId) {
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
