// js/core/state.js
/**
 * @file Manages the central, in-memory application state.
 * Provides explicit getter/setter functions for state variables.
 */
import { getThemeConfig } from '../services/themeService.js';
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

// --- History Management ---
let _gameHistory = []; // Represents the history received from the server plus any new turns in the current session.
let _unsavedHistoryDelta = []; // Tracks only the new turns since the last successful save.

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
let _dashboardItemMeta = {}; // Stores UI-specific metadata for dashboard items, e.g., { itemId: { hasRecentUpdate: true } }
let _currentUserThemeProgress = null; // Stores the UserThemeProgress object for the current theme
let _landingSelectedThemeProgress = null;
let _currentRunStats = { // Ephemeral stats for the current game run
    currentIntegrity: 0,
    currentWillpower: 0,
    strainLevel: 1,
    conditions: [],
};
let _currentInventory = [];
let _equippedItems = {}; // e.g., { weapon: itemObject, armor: itemObject }
let _lastAiSuggestedActions = null;
let _isBoonSelectionPending = false;
let _isInitialTraitSelectionPending = false;

// --- Getters and Setters ---
export const getCurrentUserThemeProgress = () => _currentUserThemeProgress;
export const setCurrentUserThemeProgress = (progress) => {
    _currentUserThemeProgress = progress;
};
export const getCurrentRunStats = () => _currentRunStats;
export const setCurrentRunStats = (stats) => {
    _currentRunStats = { ..._currentRunStats, ...stats };
};
export const updateCurrentRunStat = (statName, value) => {
    if (Object.prototype.hasOwnProperty.call(_currentRunStats, statName)) {
        _currentRunStats[statName] = value;
    } else {
        // console.warn(`Attempted to update unknown run stat: ${statName}`);
        // For future flexibility, allow adding new stats dynamically if needed,
        // though primary stats like currentIntegrity/Willpower should be predefined.
        _currentRunStats[statName] = value;
    }
};
export const getCurrentInventory = () => _currentInventory;
export const setCurrentInventory = (inventory) => {
    _currentInventory = Array.isArray(inventory) ? inventory : [];
};

export const getEquippedItems = () => _equippedItems;
export const setEquippedItems = (items) => {
    _equippedItems = typeof items === 'object' && items !== null && !Array.isArray(items) ? items : {};
};
export const getIsBoonSelectionPending = () => _isBoonSelectionPending;
export const setIsBoonSelectionPending = (isPending) => {
    _isBoonSelectionPending = !!isPending;
};

// --- Player Progression Getters ---
export const getPlayerLevel = () => _currentUserThemeProgress ? _currentUserThemeProgress.level : 1;
export const getEffectiveMaxIntegrity = () => {
    const baseIntegrity = getThemeConfig(getCurrentTheme())?.base_attributes?.integrity || 100;
    const bonusIntegrity = _currentUserThemeProgress?.maxIntegrityBonus || 0;
    return baseIntegrity + bonusIntegrity;
};
export const getEffectiveMaxWillpower = () => {
    const baseWillpower = getThemeConfig(getCurrentTheme())?.base_attributes?.willpower || 50;
    const bonusWillpower = _currentUserThemeProgress?.maxWillpowerBonus || 0;
    return baseWillpower + bonusWillpower;
};
export const getEffectiveAptitude = () => {
    const baseAptitude = getThemeConfig(getCurrentTheme())?.base_attributes?.aptitude || 50;
    const bonusAptitude = _currentUserThemeProgress?.aptitudeBonus || 0;
    return baseAptitude + bonusAptitude;
};
export const getEffectiveResilience = () => {
    const baseResilience = getThemeConfig(getCurrentTheme())?.base_attributes?.resilience || 50;
    const bonusResilience = _currentUserThemeProgress?.resilienceBonus || 0;
    return baseResilience + bonusResilience;
};
export const getAcquiredTraitKeys = () => {
    // Ensure it always returns an array, even if null/undefined in raw progress object.
    return Array.isArray(_currentUserThemeProgress?.acquiredTraitKeys) ? _currentUserThemeProgress.acquiredTraitKeys : [];
};
export const getCurrentStrainLevel = () => _currentRunStats.strainLevel || 1;
export const getActiveConditions = () => _currentRunStats.conditions || [];
export const getLandingSelectedThemeProgress = () => _landingSelectedThemeProgress;
export const setLandingSelectedThemeProgress = (progress) => {
    _landingSelectedThemeProgress = progress;
};
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

// --- History Management Functions ---
export const getGameHistory = () => _gameHistory;
export const setGameHistory = (history) => {
    _gameHistory = Array.isArray(history) ? history : [];
    _unsavedHistoryDelta = []; // Reset delta when history is explicitly set (e.g., on game load)
};
export const addTurnToGameHistory = (turn) => {
    _gameHistory.push(turn);
    _unsavedHistoryDelta.push(turn);
};
export const clearGameHistory = () => {
    _gameHistory = [];
    _unsavedHistoryDelta = [];
};
export const getUnsavedHistoryDelta = () => _unsavedHistoryDelta;
export const clearUnsavedHistoryDelta = () => {
    _unsavedHistoryDelta = [];
};
// --- End History Management ---

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
    if (typeof updates === 'object' && updates !== null) {
        _lastKnownDashboardUpdates = { ..._lastKnownDashboardUpdates, ...updates };
    } else {
        _lastKnownDashboardUpdates = {};
    }
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
export const getDashboardItemMeta = () => _dashboardItemMeta;
export const setDashboardItemMeta = (meta) => {
    _dashboardItemMeta = typeof meta === 'object' && meta !== null ? meta : {};
};
export const updateDashboardItemMetaEntry = (itemId, itemMeta) => {
    if (typeof itemMeta === 'object' && itemMeta !== null) {
        _dashboardItemMeta[itemId] = { ..._dashboardItemMeta[itemId], ...itemMeta };
    } else if (itemMeta === null) { // Allows deleting an entry
        delete _dashboardItemMeta[itemId];
    }
};
export const clearDashboardItemMeta = () => {
    _dashboardItemMeta = {};
};
export const resetAllDashboardItemRecentUpdates = () => {
    for (const itemId in _dashboardItemMeta) {
        if (Object.prototype.hasOwnProperty.call(_dashboardItemMeta, itemId) && _dashboardItemMeta[itemId]) {
            _dashboardItemMeta[itemId].hasRecentUpdate = false;
        }
    }
};
export const getLastAiSuggestedActions = () => _lastAiSuggestedActions;
export const setLastAiSuggestedActions = (actions) => {
    _lastAiSuggestedActions = Array.isArray(actions) ? actions : null;
};
export const clearLastAiSuggestedActions = () => {
    _lastAiSuggestedActions = null;
};
export const getIsInitialTraitSelectionPending = () => _isInitialTraitSelectionPending;
export const setIsInitialTraitSelectionPending = (isPending) => {
    _isInitialTraitSelectionPending = !!isPending;
};
/**
 * Clears all non-persistent game-specific state variables.
 * User preferences and auth state are not cleared here.
 */
/**
 * Clears all non-persistent game-specific state variables.
 * User preferences and auth state are not cleared here.
 */
export const clearVolatileGameState = () => {
    _gameHistory = [];
    _unsavedHistoryDelta = [];
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
    _lastKnownEvolvedWorldLore = "";
    _lastAiSuggestedActions = null;
    _currentUserThemeProgress = null;
    _currentRunStats = {
        currentIntegrity: 0,
        currentWillpower: 0,
        strainLevel: 1,
        conditions: [],
    };
    _isBoonSelectionPending = false;
    _isInitialTraitSelectionPending = false;
    _currentInventory = [];
    _equippedItems = {};
    clearCurrentNewGameSettings();
    _dashboardItemMeta = {};
};
