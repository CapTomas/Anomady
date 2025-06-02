// js/services/authService.js
/**
 * @file Manages the user authentication lifecycle, session status, and user profile data.
 * Interacts with apiService.js for backend calls and state.js to update currentUser.
 * Coordinates with ui/authUiManager.js (indirectly, via gameController or app.js).
 */
import * as apiService from '../core/apiService.js';
import {
    setCurrentUser,
    getCurrentUser,
    setCurrentAppLanguage,
    getCurrentAppLanguage,
    setCurrentNarrativeLanguage,
    setCurrentModelName,
    clearVolatileGameState,
    setCurrentTheme,
    setPlayingThemes,
    setLikedThemes,
    setShapedThemeData,
    setCurrentLandingGridSelection,
    getCurrentTheme as getStateCurrentTheme,
    getPlayerIdentifier,
    getGameHistory,
    getLastKnownDashboardUpdates,
    getLastKnownGameStateIndicators,
    getCurrentPromptType as getStateCurrentPromptType,
    getCurrentNarrativeLanguage as getStateCurrentNarrativeLanguage,
    getCurrentSuggestedActions,
    getCurrentPanelStates,
    getCurrentModelName as getStateCurrentModelName,
    getCurrentTurnUnlockData,
    setCurrentTurnUnlockData,
    getDashboardItemMeta,
} from '../core/state.js';
import {
    JWT_STORAGE_KEY,
    DEFAULT_LANGUAGE,
    FREE_MODEL_NAME,
    LANGUAGE_PREFERENCE_STORAGE_KEY,
    NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY,
    MODEL_PREFERENCE_STORAGE_KEY,
    CURRENT_THEME_STORAGE_KEY,
    LANDING_SELECTED_GRID_THEME_KEY
} from '../core/config.js';
import { log, LOG_LEVEL_INFO, LOG_LEVEL_ERROR, LOG_LEVEL_WARN, LOG_LEVEL_DEBUG } from '../core/logger.js';
import { getUIText } from './localizationService.js'; // For error messages potentially

/**
 * Handles the user registration process.
 * @param {string} email - User's email.
 * @param {string} password - User's password.
 * @param {object} [preferences={}] - Initial user preferences.
 * @returns {Promise<object>} The API response (user data and message).
 * @throws {Error} If registration fails.
 */
export async function handleRegistration(email, password, preferences = {}) {
    log(LOG_LEVEL_INFO, `Attempting registration for email: ${email}`);
    try {
        const response = await apiService.registerUser(email, password, preferences);
        log(LOG_LEVEL_INFO, `Registration successful for ${email}:`, response.message);
        return response; // Includes message and user object (without token yet)
    } catch (error) {
        log(LOG_LEVEL_ERROR, `Registration failed for ${email}:`, error.message, error.code);
        throw error; // Re-throw for UI handling
    }
}

/**
 * Handles the user login process.
 * @param {string} email - User's email.
 * @param {string} password - User's password.
 * @returns {Promise<object>} User data including token.
 * @throws {Error} If login fails.
 */
export async function handleLogin(email, password) {
    log(LOG_LEVEL_INFO, `Attempting login for email: ${email}`);
    try {
        const response = await apiService.loginUser(email, password);
        const { token, user: userData } = response;
        if (token && userData) {
            const previousUser = getCurrentUser();
            if (!previousUser) {
                log(LOG_LEVEL_INFO, "User was anonymous before login. Clearing any volatile anonymous game state.");
                clearVolatileGameState();
                setCurrentTheme(null);
            }

            localStorage.setItem(JWT_STORAGE_KEY, token);
            setCurrentUser({ ...userData, token });
            log(LOG_LEVEL_INFO, `Login successful for ${userData.email}. Token stored. User state updated.`);

            await loadUserPreferences(true);
            setPlayingThemes([]);
            setLikedThemes([]);
            return userData;
        } else {
            throw new Error("Login response missing token or user data.");
        }
    } catch (error) {
        log(LOG_LEVEL_ERROR, `Login failed for ${email}:`, error.message, error.code);
        throw error;
    }
}

/**
 * Handles user logout.
 */
export function handleLogout() {
    log(LOG_LEVEL_INFO, `User logging out: ${getCurrentUser()?.email || 'Unknown User'}`);
    localStorage.removeItem(JWT_STORAGE_KEY);
    setCurrentUser(null);
    // Reset to default/localStorage preferences for anonymous state
    const anonAppLang = localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY) || DEFAULT_LANGUAGE;
    const anonNarrLang = localStorage.getItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY) || anonAppLang;
    const anonModel = localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY) || FREE_MODEL_NAME;
    setCurrentAppLanguage(anonAppLang);
    setCurrentNarrativeLanguage(anonNarrLang);
    setCurrentModelName(anonModel);
    // Clear game-related local storage and state that should not persist across users/logout
    localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
    localStorage.removeItem(LANDING_SELECTED_GRID_THEME_KEY);
    setCurrentTheme(null);
    setCurrentLandingGridSelection(null);
    clearVolatileGameState();
    // Reset theme interactions to empty for anonymous state
    setPlayingThemes([]);
    setLikedThemes([]);
    setShapedThemeData(new Map());
    log(LOG_LEVEL_INFO, "User logged out. Local session cleared. Anonymous preferences applied.");
}

/**
 * Checks authentication status on application load.
 * If a token exists, verifies it and updates user state.
 * @returns {Promise<boolean>} True if user is authenticated, false otherwise.
 */
export async function checkAuthStatusOnLoad() {
    const token = localStorage.getItem(JWT_STORAGE_KEY);
    if (token) {
        log(LOG_LEVEL_INFO, "Token found. Verifying session...");
        try {
            const response = await apiService.fetchCurrentUser(token);
            const userData = response.user;
            setCurrentUser({ ...userData, token });
            log(LOG_LEVEL_INFO, `Session verified for ${userData.email}.`);
            await loadUserPreferences(true); // Ensure preferences are loaded and applied
            return true;
        } catch (error) {
            log(LOG_LEVEL_WARN, "Token verification failed or token expired. Logging out.", error.message);
            handleLogout(); // Clear invalid token and reset state
            return false;
        }
    } else {
        log(LOG_LEVEL_INFO, "No token found. User is not authenticated.");
        // Ensure anonymous preferences are set correctly
        const anonAppLang = localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY) || DEFAULT_LANGUAGE;
        const anonNarrLang = localStorage.getItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY) || anonAppLang;
        const anonModel = localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY) || FREE_MODEL_NAME;
        setCurrentAppLanguage(anonAppLang);
        setCurrentNarrativeLanguage(anonNarrLang);
        setCurrentModelName(anonModel);
        return false;
    }
}

/**
 * Loads user preferences. If logged in, fetches from backend.
 * Otherwise, loads from localStorage or defaults.
 * @param {boolean} [isUserLoggedIn=false] - Flag indicating if the user is confirmed logged in.
 */
export async function loadUserPreferences(isUserLoggedIn = false) {
    const currentUser = getCurrentUser();
    if (isUserLoggedIn && currentUser && currentUser.token) {
        log(LOG_LEVEL_INFO, `Fetching preferences for logged-in user: ${currentUser.email}`);
        try {
            const prefs = await apiService.fetchUserPreferences(currentUser.token);
            setCurrentAppLanguage(prefs.preferred_app_language || DEFAULT_LANGUAGE);
            setCurrentNarrativeLanguage(prefs.preferred_narrative_language || getCurrentAppLanguage());
            setCurrentModelName(prefs.preferred_model_name || FREE_MODEL_NAME);
            // Update currentUser object in state with these potentially new/updated preferences
            setCurrentUser({
                ...currentUser,
                preferred_app_language: getCurrentAppLanguage(),
                preferred_narrative_language: getStateCurrentNarrativeLanguage(),
                preferred_model_name: getStateCurrentModelName(),
            });
            log(LOG_LEVEL_INFO, "User preferences loaded from backend and applied to state.");
        } catch (error) {
            log(LOG_LEVEL_ERROR, "Failed to fetch user preferences from backend. Using local/defaults.", error.message);
            // Fallback to local storage if API fails
            setCurrentAppLanguage(localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY) || DEFAULT_LANGUAGE);
            setCurrentNarrativeLanguage(localStorage.getItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY) || getCurrentAppLanguage());
            setCurrentModelName(localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY) || FREE_MODEL_NAME);
        }
    } else {
        log(LOG_LEVEL_INFO, "Loading preferences for anonymous user or fallback.");
        setCurrentAppLanguage(localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY) || DEFAULT_LANGUAGE);
        setCurrentNarrativeLanguage(localStorage.getItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY) || getCurrentAppLanguage());
        setCurrentModelName(localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY) || FREE_MODEL_NAME);
    }
}

/**
 * Updates user preferences.
 * @param {object} preferencesToUpdate - Object containing preferences to update (e.g., { preferred_app_language: 'cs' }).
 * @returns {Promise<object>} The updated user object from the API.
 * @throws {Error} If update fails.
 */
export async function updateUserPreferences(preferencesToUpdate) {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.token) {
        log(LOG_LEVEL_WARN, "Cannot update preferences: User not logged in.");
        // For anonymous users, update localStorage directly and state
        if (preferencesToUpdate.preferred_app_language) {
            setCurrentAppLanguage(preferencesToUpdate.preferred_app_language);
        }
        if (preferencesToUpdate.preferred_narrative_language) {
            setCurrentNarrativeLanguage(preferencesToUpdate.preferred_narrative_language);
        }
        if (preferencesToUpdate.preferred_model_name) {
            setCurrentModelName(preferencesToUpdate.preferred_model_name);
        }
        return { // Simulate a successful local update structure
            message: "Local preferences updated.",
            user: {
                preferred_app_language: getCurrentAppLanguage(),
                preferred_narrative_language: getStateCurrentNarrativeLanguage(),
                preferred_model_name: getStateCurrentModelName(),
            }
        };
    }
    log(LOG_LEVEL_INFO, `Updating preferences for user ${currentUser.email}:`, preferencesToUpdate);
    try {
        const response = await apiService.updateUserPreferences(currentUser.token, preferencesToUpdate);
        const updatedUser = response.user;
        // Update state with new preferences from response
        setCurrentAppLanguage(updatedUser.preferred_app_language);
        setCurrentNarrativeLanguage(updatedUser.preferred_narrative_language);
        setCurrentModelName(updatedUser.preferred_model_name);
        setCurrentUser({ ...currentUser, ...updatedUser }); // Update the user object in state
        log(LOG_LEVEL_INFO, "User preferences updated successfully on backend and in state.");
        return updatedUser;
    } catch (error) {
        log(LOG_LEVEL_ERROR, `Failed to update user preferences for ${currentUser.email}:`, error.message);
        throw error;
    }
}

/**
 * Handles changing the user's password.
 * @param {string} currentPassword - The user's current password.
 * @param {string} newPassword - The new password.
 * @returns {Promise<object>} API response.
 * @throws {Error} If password change fails.
 */
export async function handleChangePassword(currentPassword, newPassword) {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.token) {
        log(LOG_LEVEL_ERROR, "Cannot change password: User not logged in.");
        throw new Error("User not authenticated.");
    }
    log(LOG_LEVEL_INFO, `Attempting password change for user ${currentUser.email}`);
    try {
        const response = await apiService.changePassword(currentUser.token, currentPassword, newPassword);
        log(LOG_LEVEL_INFO, "Password changed successfully.");
        return response;
    } catch (error) {
        log(LOG_LEVEL_ERROR, `Password change failed for ${currentUser.email}:`, error.message);
        throw error;
    }
}

/**
 * Handles resending the email confirmation for an authenticated user.
 * @returns {Promise<object>} API response.
 * @throws {Error} If resending fails.
 */
export async function handleResendConfirmation() {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.token) {
        log(LOG_LEVEL_ERROR, "Cannot resend confirmation: User not logged in.");
        throw new Error("User not authenticated.");
    }
    log(LOG_LEVEL_INFO, `Requesting to resend confirmation email for ${currentUser.email}`);
    try {
        const response = await apiService.resendConfirmationEmail(currentUser.token);
        log(LOG_LEVEL_INFO, "Confirmation email resent request successful.");
        return response;
    } catch (error) {
        log(LOG_LEVEL_ERROR, `Failed to resend confirmation for ${currentUser.email}:`, error.message);
        throw error;
    }
}

/**
 * Handles publicly requesting a resend of the confirmation email (e.g., from login form).
 * @param {string} email - The email address.
 * @returns {Promise<object>} API response.
 * @throws {Error} If request fails.
 */
export async function handlePublicResendConfirmation(email) {
    log(LOG_LEVEL_INFO, `Requesting public resend confirmation for email: ${email}`);
    try {
        const response = await apiService.publicResendConfirmationEmail(email);
        log(LOG_LEVEL_INFO, `Public resend confirmation request for ${email} processed.`);
        return response; // Response message indicates if an email was sent or if already confirmed etc.
    } catch (error) {
        log(LOG_LEVEL_ERROR, `Public resend confirmation failed for ${email}:`, error.message);
        throw error;
    }
}

/**
 * Handles initiating the "forgot password" process.
 * @param {string} email - The user's email address.
 * @returns {Promise<object>} API response (typically a generic success message).
 * @throws {Error} If request fails.
 */
export async function handleForgotPassword(email) {
    log(LOG_LEVEL_INFO, `Initiating password reset for email: ${email}`);
    try {
        const response = await apiService.requestPasswordReset(email);
        log(LOG_LEVEL_INFO, `Password reset link request processed for ${email}.`);
        return response;
    } catch (error) {
        log(LOG_LEVEL_ERROR, `Forgot password request failed for ${email}:`, error.message);
        throw error;
    }
}

/**
 * Handles resetting the password using a token.
 * @param {string} token - The password reset token.
 * @param {string} newPassword - The new password.
 * @returns {Promise<object>} API response.
 * @throws {Error} If password reset fails.
 */
export async function handleResetPassword(token, newPassword) {
    log(LOG_LEVEL_INFO, `Attempting to reset password with token (first 10 chars): ${token.substring(0, 10)}...`);
    try {
        const response = await apiService.resetPassword(token, newPassword);
        log(LOG_LEVEL_INFO, "Password reset successful.");
        return response;
    } catch (error) {
        log(LOG_LEVEL_ERROR, `Password reset failed for token ${token.substring(0, 10)}...:`, error.message);
        throw error;
    }
}

/**
 * Saves the current game state to the backend if a user is logged in.
 * Gathers all necessary state components and constructs the payload.
 * Resets `currentTurnUnlockData` after including it in the payload.
 */
export async function saveCurrentGameState() {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.token) {
        log(LOG_LEVEL_INFO, "User not logged in. Game state not saved to backend.");
        return;
    }

    const currentThemeId = getStateCurrentTheme();
    if (!currentThemeId) {
        log(LOG_LEVEL_WARN, "Cannot save game state: currentTheme not set in state.");
        return;
    }

    const narrativePlayerIdentifier = getPlayerIdentifier();
    if (!narrativePlayerIdentifier && getGameHistory().length === 0 && getStateCurrentPromptType() === "initial") {
        log(LOG_LEVEL_INFO, "Player identifier not set and game history empty for initial prompt, skipping save until identifier is set.");
        return;
    }

    log(LOG_LEVEL_INFO, `Attempting to save game state for theme '${currentThemeId}' for user '${currentUser.email}'`);

    const turnUnlockData = getCurrentTurnUnlockData();

    const gameStatePayload = {
        theme_id: currentThemeId,
        player_identifier: narrativePlayerIdentifier || "Unnamed Protagonist", // Fallback
        game_history: getGameHistory(),
        last_dashboard_updates: getLastKnownDashboardUpdates(),
        last_game_state_indicators: getLastKnownGameStateIndicators(),
        current_prompt_type: getStateCurrentPromptType(),
        current_narrative_language: getStateCurrentNarrativeLanguage(),
        last_suggested_actions: getCurrentSuggestedActions(),
        panel_states: getCurrentPanelStates(),
        model_name_used: getStateCurrentModelName(),
        new_persistent_lore_unlock: turnUnlockData, // Include the unlock data
        dashboard_item_meta: getDashboardItemMeta(), // Added to save dashboard UI state
    };

    // Reset currentTurnUnlockData in state after it's been included in the payload
    setCurrentTurnUnlockData(null);

    try {
        const response = await apiService.saveGameState(currentUser.token, gameStatePayload);
        log(LOG_LEVEL_INFO, "Game state saved successfully to backend.", response.message || response);
    } catch (error) {
        log(LOG_LEVEL_ERROR, "Error saving game state to backend:", error.message, error.code, error.details);
        // Consider notifying the user through UI, e.g., a non-blocking toast or system message
        // storyLogManager.addMessageToLog(getUIText("error_saving_progress") + ` (Server: ${error.message})`, "system-error");
    }
}
