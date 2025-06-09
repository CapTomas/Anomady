// js/core/config.js

/**
 * @file Stores all application-level constants and default settings.
 */

// --- API Endpoints ---
export const PROXY_API_URL = '/api/v1/gemini/generate';

// --- Default Application Settings ---
export const DEFAULT_LANGUAGE = "cs";
export const DEFAULT_THEME_ID = "grim_warden";

// --- UI Constants ---
export const UPDATE_HIGHLIGHT_DURATION = 5000; // ms
export const SCROLL_INDICATOR_TOLERANCE = 2; // px, tolerance for scroll indicators to appear/disappear
export const AUTOSCROLL_THRESHOLD = 40; // px, threshold for auto-scrolling story log

// --- localStorage Keys ---
// For user session and authentication
export const JWT_STORAGE_KEY = "anomadyAuthToken";

// For user preferences (persisted locally if not logged in, or as fallback)
export const MODEL_PREFERENCE_STORAGE_KEY = "anomadyModelPreference";
export const LANGUAGE_PREFERENCE_STORAGE_KEY = "preferredAppLanguage";
export const NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY = "preferredNarrativeLanguage";

// For application state / UI persistence
export const CURRENT_THEME_STORAGE_KEY = "anomadyCurrentTheme";
export const LANDING_SELECTED_GRID_THEME_KEY = "anomadyLandingSelectedGridTheme";
export const LOG_LEVEL_STORAGE_KEY = "anomadyLogLevel"; // For client-side logger level

// --- AI Model Configuration ---
export const PAID_MODEL_NAME = "gemini-1.5-pro-latest";
export const FREE_MODEL_NAME = "gemini-1.5-flash-latest";

// --- Player Progression Constants ---
// XP needed to reach the level *index + 1*.
export const XP_LEVELS = [
    0,    // Level 1
    100,  // Level 2
    250,  // Level 3 (100 + 150)
    450,  // Level 4 (250 + 200)
    700,  // Level 5 (450 + 250)
    1000, // Level 6 (700 + 300)
    1350, // Level 7 (1000 + 350)
    1750, // Level 8 (1350 + 400)
    2200, // Level 9 (1750 + 450)
    2700, // Level 10 (2200 + 500)
];
export const MAX_PLAYER_LEVEL = XP_LEVELS.length;

// This will likely be a more complex structure, possibly per-theme or global with theme overrides.
export const BOON_DEFINITIONS = {
    MAX_INTEGRITY_INCREASE: { value: 10, descriptionKey: "boon_desc_max_integrity" },
    MAX_WILLPOWER_INCREASE: { value: 5, descriptionKey: "boon_desc_max_willpower" },
    APTITUDE_INCREASE: { value: 1, descriptionKey: "boon_desc_aptitude_increase" },
    RESILIENCE_INCREASE: { value: 1, descriptionKey: "boon_desc_resilience_increase" },
};
export const MIN_LEVEL_FOR_STORE = 3;
// --- Game Logic Constants ---
export const RECENT_INTERACTION_WINDOW_SIZE = 10; // Number of recent turns to consider for certain operations or display
export const MAX_PLAYER_ACTION_INPUT_LENGTH = 600;
