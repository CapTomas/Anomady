// js/core/apiService.js
/**
 * @file Handles all communication with the backend API.
 * Encapsulates fetch logic, error handling, and token management for API calls.
 */
import { log, LOG_LEVEL_ERROR, LOG_LEVEL_DEBUG, LOG_LEVEL_WARN, LOG_LEVEL_INFO }
from './logger.js';
import { PROXY_API_URL }
from './config.js';

// --- Generic API Call Helper ---
/**
 * A generic helper function to make API calls.
 * @param {string} endpoint - The API endpoint (e.g., '/api/v1/auth/login').
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE).
 * @param {object|null} body - The request body for POST/PUT requests.
 * @param {string|null} token - Optional JWT token for authenticated requests.
 * @returns {Promise<object>} The JSON response from the API.
 * @throws {Error} If the API call fails or returns an error status.
 */
async function _callApi(endpoint, method = 'GET', body = null, token = null) {
    const headers = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        method,
        headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
        config.body = JSON.stringify(body);
    }

    log(LOG_LEVEL_DEBUG, `Calling API: ${method} ${endpoint}`, body ? `with body (keys: ${Object.keys(body).join(', ')})` : 'without body');

    try {
        const response = await fetch(endpoint, config);

        if (response.status === 204 && (method === 'DELETE' || method === 'PUT')) {
            log(LOG_LEVEL_INFO, `API call ${method} ${endpoint} successful with 204 No Content.`);
            return {
                success: true,
                status: response.status
            }; // Consistent return for 204
        }

        const responseData = await response.json();

        if (!response.ok) {
            const errorMessage = responseData.error?.message || `API Error: ${response.statusText} (Status: ${response.status})`;
            const errorCode = responseData.error?.code || `HTTP_${response.status}`;
            log(LOG_LEVEL_WARN, `API Error (${response.status} ${errorCode}) for ${method} ${endpoint}: ${errorMessage}`, responseData.error?.details || responseData);
            const error = new Error(errorMessage);
            error.status = response.status;
            error.code = errorCode;
            error.details = responseData.error?.details || responseData; // Attach full error details if available
            throw error;
        }
        log(LOG_LEVEL_DEBUG, `API call ${method} ${endpoint} successful. Status: ${response.status}.`);
        return responseData;
    } catch (error) {
        // If it's an error we constructed from a non-ok response, re-throw it
        if (error.status) {
            throw error;
        }
        // Otherwise, it's likely a network error or fetch/JSON parsing issue
        log(LOG_LEVEL_ERROR, `Network or unexpected error in _callApi for ${method} ${endpoint}:`, error.message, error);
        const networkError = new Error(`Network error or server unavailable: ${error.message}`);
        networkError.isNetworkError = true;
        networkError.code = 'NETWORK_ERROR';
        throw networkError;
    }
}

// --- Authentication Endpoints ---
export const registerUser = (email, password, preferences = {}) => {
    return _callApi('/api/v1/auth/register', 'POST', {
        email,
        password,
        username: preferences.username,
        story_preference: preferences.storyPreference,
        newsletter_opt_in: preferences.newsletterOptIn,
        preferred_app_language: preferences.appLanguage,
        preferred_narrative_language: preferences.narrativeLanguage,
        preferred_model_name: preferences.modelName
    });
};

export const loginUser = (email, password) => {
    return _callApi('/api/v1/auth/login', 'POST', {
        email,
        password
    });
};

export const fetchCurrentUser = (token) => {
    return _callApi('/api/v1/auth/me', 'GET', null, token);
};

export const resendConfirmationEmail = (token) => {
    return _callApi('/api/v1/auth/resend-confirmation-email', 'POST', null, token);
};

export const publicResendConfirmationEmail = (email) => {
    return _callApi('/api/v1/auth/public-resend-confirmation', 'POST', {
        email
    });
};

export const requestPasswordReset = (email) => {
    return _callApi('/api/v1/auth/forgot-password', 'POST', {
        email
    });
};

export const resetPassword = (token, newPassword) => {
    return _callApi('/api/v1/auth/reset-password', 'POST', {
        token,
        newPassword
    });
};

// --- User Preferences & Profile Endpoints ---
export const fetchUserPreferences = (token) => {
    return _callApi('/api/v1/users/me/preferences', 'GET', null, token);
};

export const updateUserPreferences = (token, preferencesToUpdate) => {
    return _callApi('/api/v1/users/me/preferences', 'PUT', preferencesToUpdate, token);
};

export const changePassword = (token, currentPassword, newPassword) => {
    return _callApi('/api/v1/users/me/password', 'PUT', {
        currentPassword,
        newPassword
    }, token);
};

// --- Game State Endpoints ---
export const saveGameState = (token, gameStatePayload) => {
    return _callApi('/api/v1/gamestates', 'POST', gameStatePayload, token);
};

export const loadGameState = (token, themeId) => {
    return _callApi(`/api/v1/gamestates/${themeId}`, 'GET', null, token);
};

export const deleteGameState = (token, themeId) => {
    return _callApi(`/api/v1/gamestates/${themeId}`, 'DELETE', null, token);
};

// --- Theme Interactions Endpoints ---
export const fetchThemeInteractions = (token) => {
    return _callApi('/api/v1/themes/interactions', 'GET', null, token);
};

export const updateThemeInteraction = (token, themeId, interactionPayload) => {
    return _callApi(`/api/v1/themes/${themeId}/interactions`, 'POST', interactionPayload, token);
};

// --- World Shards Endpoints ---
export const fetchWorldShards = (token, themeId) => {
    return _callApi(`/api/v1/themes/${themeId}/worldshards`, 'GET', null, token);
};

export const updateWorldShardStatus = (token, shardId, isActiveForNewGames) => {
    return _callApi(`/api/v1/worldshards/${shardId}/status`, 'PUT', {
        isActiveForNewGames
    }, token);
};

export const deleteWorldShard = (token, shardId) => {
    return _callApi(`/api/v1/worldshards/${shardId}`, 'DELETE', null, token);
};

export const resetWorldShardsForTheme = (token, themeId) => {
    return _callApi(`/api/v1/themes/${themeId}/worldshards/reset`, 'DELETE', null, token);
};

export const fetchShapedThemesSummary = (token) => {
    return _callApi('/api/v1/users/me/shaped-themes-summary', 'GET', null, token);
};
// --- User Theme Progress Endpoint ---
/**
 * Fetches the user's persistent progress for a specific theme.
 * @param {string} token - The JWT token for authentication.
 * @param {string} themeId - The ID of the theme.
 * @returns {Promise<object>} The user's theme progress data.
 */
export const fetchUserThemeProgress = (token, themeId) => {
    return _callApi(`/api/v1/users/me/themes/${themeId}/progress`, 'GET', null, token);
};

/**
 * Applies a selected Boon to the user's theme progress.
 * @param {string} token - The JWT token for authentication.
 * @param {string} themeId - The ID of the theme.
 * @param {object} boonPayload - The details of the boon to apply (e.g., { boonType: "MAX_ATTRIBUTE_INCREASE", targetAttribute: "maxIntegrityBonus", value: 10 }).
 * @returns {Promise<object>} The API response containing the updated UserThemeProgress.
 */
export const applyBoonSelection = (token, themeId, boonPayload) => {
    return _callApi(`/api/v1/users/me/themes/${themeId}/boon`, 'POST', boonPayload, token);
};

// --- AI Proxy Endpoint ---
/**
 * Calls the backend proxy for Gemini API interaction.
 * @param {object} payload - The payload to send to the Gemini API (contents, generationConfig, etc.).
 * @param {string|null} token - The JWT token for authentication. Can be null for anonymous/unauthenticated calls if allowed by backend.
 * @returns {Promise<object>} The JSON response from the AI proxy.
 */
export const callGeminiProxy = (payload, token) => {
    return _callApi(PROXY_API_URL, 'POST', payload, token);
};
