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

// --- Game Logic Constants ---
export const RECENT_INTERACTION_WINDOW_SIZE = 10; // Number of recent turns to consider for certain operations or display
export const MAX_PLAYER_ACTION_INPUT_LENGTH = 600;
