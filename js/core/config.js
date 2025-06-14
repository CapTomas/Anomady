/**
 * @file Stores all application-level constants and default settings.
 * This file centralizes configuration values to ensure consistency and ease of maintenance.
 */

// --- API ---
export const PROXY_API_URL = '/api/v1/gemini/generate';

// --- Application Defaults ---
export const DEFAULT_LANGUAGE = 'cs';
export const DEFAULT_THEME_ID = 'grim_warden';

// --- UI Constants ---
export const UPDATE_HIGHLIGHT_DURATION = 5000; // ms
export const SCROLL_INDICATOR_TOLERANCE = 2; // px
export const AUTOSCROLL_THRESHOLD = 40; // px

// --- LocalStorage Keys ---
export const JWT_STORAGE_KEY = 'anomadyAuthToken';
export const MODEL_PREFERENCE_STORAGE_KEY = 'anomadyModelPreference';
export const LANGUAGE_PREFERENCE_STORAGE_KEY = 'preferredAppLanguage';
export const NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY = 'preferredNarrativeLanguage';
export const CURRENT_THEME_STORAGE_KEY = 'anomadyCurrentTheme';
export const LANDING_SELECTED_GRID_THEME_KEY = 'anomadyLandingSelectedGridTheme';
export const LOG_LEVEL_STORAGE_KEY = 'anomadyLogLevel';

// --- AI Model Configuration ---
export const PAID_MODEL_NAME = 'gemini-1.5-pro-latest';
export const FREE_MODEL_NAME = 'gemini-1.5-flash-latest';

// --- Player Progression ---
/**
 * Defines the total cumulative XP required to reach each level.
 * The index corresponds to the target level (e.g., XP_LEVELS[1] is XP for level 2).
 * Level 1 requires 0 XP.
 * @type {number[]}
 */
export const XP_LEVELS = [
  0, // Level 1
  100, // Level 2
  250, // Level 3
  450, // Level 4
  700, // Level 5
  1000, // Level 6
  1350, // Level 7
  1750, // Level 8
  2200, // Level 9
  2700, // Level 10
];

/** The maximum attainable player level. */
export const MAX_PLAYER_LEVEL = XP_LEVELS.length;

/**
 * Defines the available boons (level-up rewards).
 * `value` is the numerical bonus, and `descriptionKey` points to a localization string.
 */
export const BOON_DEFINITIONS = {
  MAX_INTEGRITY_INCREASE: { value: 10, descriptionKey: 'boon_desc_max_integrity' },
  MAX_WILLPOWER_INCREASE: { value: 5, descriptionKey: 'boon_desc_max_willpower' },
  APTITUDE_INCREASE: { value: 1, descriptionKey: 'boon_desc_aptitude_increase' },
  RESILIENCE_INCREASE: { value: 1, descriptionKey: 'boon_desc_resilience_increase' },
};

/** The minimum player level required to access the theme-specific store. */
export const MIN_LEVEL_FOR_STORE = 3;

// --- Game Logic ---
/** The number of recent turns to include in the AI prompt context window. */
export const RECENT_INTERACTION_WINDOW_SIZE = 10;
/** The maximum character length for an anonymous user's action input. */
export const ANONYMOUS_PLAYER_ACTION_INPUT_LENGTH = 200;
/** The maximum character length for a logged-in user's action input. */
export const LOGGED_IN_PLAYER_ACTION_INPUT_LENGTH = 600;
