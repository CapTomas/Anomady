// js/core/state.js

/**
 * @file Manages the central, in-memory application state.
 * Provides explicit getter/setter functions for state variables.
 */

import {
    DEFAULT_LANGUAGE,
    FREE_MODEL_NAME,
    CURRENT_THEME_STORAGE_KEY,
    MODEL_PREFERENCE_STORAGE_KEY,
    LANGUAGE_PREFERENCE_STORAGE_KEY,
    NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY,
    LANDING_SELECTED_GRID_THEME_KEY
} from './config.js';

let _currentTheme = localStorage.getItem(CURRENT_THEME_STORAGE_KEY) || null;
let _currentAppLanguage = localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY) || DEFAULT_LANGUAGE;
let _currentNarrativeLanguage = localStorage.getItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY) || _currentAppLanguage;
let _currentUser = null; // User object including token
let _gameHistory = [];
let _playerIdentifier = "";
let _currentPromptType = "initial";
let _lastKnownDashboardUpdates = {};
let _lastKnownGameStateIndicators = {};
let _currentSuggestedActions = [];
let _currentPanelStates = {}; // e.g., { "panel-id": true (expanded) }
let _currentModelName = localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY) || FREE_MODEL_NAME;
let _playingThemes = []; // Array of theme IDs
let _likedThemes = []; // Array of theme IDs
let _shapedThemeData = new Map(); // Map<themeId, { hasShards: boolean, activeShardCount: number }>
let _lastKnownCumulativePlayerSummary = "";
let _lastKnownEvolvedWorldLore = "";
let _currentLandingGridSelection = localStorage.getItem(LANDING_SELECTED_GRID_THEME_KEY) || null;
let _isInitialGameLoad = true;
let _currentAiPlaceholder = ""; // Placeholder text for AI input
let _currentTurnUnlockData = null; // Data for a world shard unlocked in the current turn
let _currentNewGameSettings = null; // Stores settings for a new game, e.g., { useEvolvedWorld: boolean }

// --- Getters and Setters ---

export const getCurrentTheme = () => _currentTheme;
export const setCurrentTheme = (themeId) => {
    _currentTheme = themeId;
    if (themeId) {
        localStorage.setItem(CURRENT_THEME_STORAGE_KEY, themeId);
    } else {
        localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
    }
};

export const getCurrentAppLanguage = () => _currentAppLanguage;
export const setCurrentAppLanguage = (lang) => {
    _currentAppLanguage = lang;
    localStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, lang);
};

export const getCurrentNarrativeLanguage = () => _currentNarrativeLanguage;
export const setCurrentNarrativeLanguage = (lang) => {
    _currentNarrativeLanguage = lang;
    localStorage.setItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY, lang);
};

export const getCurrentUser = () => _currentUser;
export const setCurrentUser = (user) => {
    _currentUser = user; // User object should contain the token
};

export const getGameHistory = () => _gameHistory;
export const setGameHistory = (history) => {
    _gameHistory = Array.isArray(history) ? history : [];
};
export const addTurnToGameHistory = (turn) => {
    _gameHistory.push(turn);
};
export const clearGameHistory = () => {
    _gameHistory = [];
};

export const getPlayerIdentifier = () => _playerIdentifier;
export const setPlayerIdentifier = (identifier) => {
    _playerIdentifier = identifier;
};

export const getCurrentPromptType = () => _currentPromptType;
export const setCurrentPromptType = (type) => {
    _currentPromptType = type;
};

export const getLastKnownDashboardUpdates = () => _lastKnownDashboardUpdates;
export const setLastKnownDashboardUpdates = (updates) => {
    _lastKnownDashboardUpdates = typeof updates === 'object' && updates !== null ? updates : {};
};

export const getLastKnownGameStateIndicators = () => _lastKnownGameStateIndicators;
export const setLastKnownGameStateIndicators = (indicators) => {
    _lastKnownGameStateIndicators = typeof indicators === 'object' && indicators !== null ? indicators : {};
};

export const getCurrentSuggestedActions = () => _currentSuggestedActions;
export const setCurrentSuggestedActions = (actions) => {
    _currentSuggestedActions = Array.isArray(actions) ? actions : [];
};

export const getCurrentPanelStates = () => _currentPanelStates;
export const setCurrentPanelStates = (states) => {
    _currentPanelStates = typeof states === 'object' && states !== null ? states : {};
};
export const getPanelState = (panelId) => _currentPanelStates[panelId];
export const setPanelState = (panelId, isExpanded) => {
    _currentPanelStates[panelId] = isExpanded;
};

export const getCurrentModelName = () => _currentModelName;
export const setCurrentModelName = (modelName) => {
    _currentModelName = modelName;
    localStorage.setItem(MODEL_PREFERENCE_STORAGE_KEY, modelName);
};

export const getPlayingThemes = () => _playingThemes;
export const setPlayingThemes = (themes) => {
    _playingThemes = Array.isArray(themes) ? themes : [];
};

export const getLikedThemes = () => _likedThemes;
export const setLikedThemes = (themes) => {
    _likedThemes = Array.isArray(themes) ? themes : [];
};

export const getShapedThemeData = () => _shapedThemeData;
export const setShapedThemeData = (data) => {
    if (data instanceof Map) {
        _shapedThemeData = data;
    } else {
        console.error("setShapedThemeData: data must be a Map.");
        _shapedThemeData = new Map();
    }
};
export const updateShapedThemeEntry = (themeId, entryData) => {
    _shapedThemeData.set(themeId, entryData);
};

export const getLastKnownCumulativePlayerSummary = () => _lastKnownCumulativePlayerSummary;
export const setLastKnownCumulativePlayerSummary = (summary) => {
    _lastKnownCumulativePlayerSummary = summary || "";
};

export const getLastKnownEvolvedWorldLore = () => _lastKnownEvolvedWorldLore;
export const setLastKnownEvolvedWorldLore = (lore) => {
    _lastKnownEvolvedWorldLore = lore || "";
};

export const getCurrentLandingGridSelection = () => _currentLandingGridSelection;
export const setCurrentLandingGridSelection = (themeId) => {
    _currentLandingGridSelection = themeId;
    if (themeId) {
        localStorage.setItem(LANDING_SELECTED_GRID_THEME_KEY, themeId);
    } else {
        localStorage.removeItem(LANDING_SELECTED_GRID_THEME_KEY);
    }
};

export const getIsInitialGameLoad = () => _isInitialGameLoad;
export const setIsInitialGameLoad = (isInitial) => {
    _isInitialGameLoad = !!isInitial;
};

export const getCurrentAiPlaceholder = () => _currentAiPlaceholder;
export const setCurrentAiPlaceholder = (placeholderText) => {
    _currentAiPlaceholder = placeholderText || "";
};

export const getCurrentTurnUnlockData = () => _currentTurnUnlockData;
export const setCurrentTurnUnlockData = (data) => {
    _currentTurnUnlockData = data;
};

export const getCurrentNewGameSettings = () => _currentNewGameSettings;
export const setCurrentNewGameSettings = (settings) => {
    _currentNewGameSettings = settings;
};
export const clearCurrentNewGameSettings = () => {
    _currentNewGameSettings = null;
};

/**
 * Clears all non-persistent game-specific state variables.
 * User preferences and auth state are not cleared here.
 */
export const clearVolatileGameState = () => {
    _gameHistory = [];
    _playerIdentifier = "";
    _currentPromptType = "initial";
    _lastKnownDashboardUpdates = {};
    _lastKnownGameStateIndicators = {};
    _currentSuggestedActions = [];

    _isInitialGameLoad = true;
    _currentAiPlaceholder = "";
    _currentTurnUnlockData = null;
    _currentPanelStates = {};
    _lastKnownCumulativePlayerSummary = "";
    clearCurrentNewGameSettings();
};
