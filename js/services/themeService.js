// js/services/themeService.js
/**
 * @file Manages loading, caching, and accessing all theme-specific data
 * (configurations, UI texts, prompt files and their specific parts).
 */
import { THEMES_MANIFEST } from '../data/themesManifest.js';
import { log, LOG_LEVEL_INFO, LOG_LEVEL_ERROR, LOG_LEVEL_WARN, LOG_LEVEL_DEBUG } from '../core/logger.js';
import { DEFAULT_LANGUAGE } from '../core/config.js';

// Internal state for storing theme data
const _ALL_THEMES_CONFIG = {};
const _themeTextData = {}; // Stores parsed texts.json for each theme
const _PROMPT_URLS_BY_THEME = {}; // Stores prompt URLs from prompts-config.json
const _NARRATIVE_LANG_PROMPT_PARTS_BY_THEME = {}; // Stores narrative lang parts from prompts-config.json
const _gamePrompts = {}; // Cache for fetched prompt file contents: _gamePrompts[themeId][promptName] = content
const _themeTraits = {}; // Cache for parsed traits: _themeTraits[themeId] = [{key, name, description}]
const _themeItemData = {}; // Cache for parsed item data: _themeItemData[themeId][itemType] = [itemObject, ...]

/**
 * Fetches and parses a JSON file.
 * @param {string} filePath - The path to the JSON file.
 * @returns {Promise<object|null>} The parsed JSON object or null on error.
 * @private
 */
async function _fetchJSON(filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            log(LOG_LEVEL_ERROR, `HTTP error ${response.status} for ${filePath}: ${response.statusText}`);
            return null;
        }
        return await response.json();
    } catch (error) {
        log(LOG_LEVEL_ERROR, `Error fetching or parsing JSON ${filePath}:`, error);
        return null;
    }
}

/**
 * Fetches a text file.
 * @param {string} filePath - The path to the text file.
 * @returns {Promise<string|null>} The text content or null on error.
 * @private
 */
async function _fetchText(filePath) {
    try {
        const response = await fetch(filePath);
        if (!response.ok) {
            log(LOG_LEVEL_WARN, `Text file not found or error fetching ${filePath} (Status: ${response.status}). This may be acceptable for optional helper prompts.`);
            // Return a specific marker for "not found" that can be checked by callers,
            // especially for non-critical files like helpers.
            return response.status === 404 ? `HELPER_FILE_NOT_FOUND:${filePath}` : null;
        }
        return await response.text();
    } catch (error) {
        log(LOG_LEVEL_ERROR, `Error fetching text file ${filePath}:`, error);
        return null;
    }
}

/**
 * Loads initial manifest data for all themes: configs, UI texts, and prompt configurations.
 * This function is typically called once at application startup.
 * @returns {Promise<boolean>} True if all essential data for all themes loaded successfully, false otherwise.
 */
export async function loadInitialThemeManifestData() {
    log(LOG_LEVEL_INFO, 'Loading initial theme manifest data...');
    let allSuccess = true;
    if (!THEMES_MANIFEST || THEMES_MANIFEST.length === 0) {
        log(LOG_LEVEL_ERROR, 'THEMES_MANIFEST is empty or not defined. Cannot load theme data.');
        return false;
    }
    for (const themeMeta of THEMES_MANIFEST) {
        // For initial load, we might only want to process playable themes or all of them.
        // The original app.js didn't distinguish, so processing all.
        const themeId = themeMeta.id;
        const themePath = themeMeta.path;

        // Load config.json
        if (!_ALL_THEMES_CONFIG[themeId]) {
            const config = await _fetchJSON(`${themePath}config.json`);
            if (config) {
                _ALL_THEMES_CONFIG[themeId] = config;
            } else {
                log(LOG_LEVEL_ERROR, `Failed to load config.json for theme: ${themeId}`);
                if (themeMeta.playable) allSuccess = false; // Only critical for playable themes
            }
        }

        // Load texts.json
        if (!_themeTextData[themeId]) {
            const texts = await _fetchJSON(`${themePath}texts.json`);
            if (texts) {
                _themeTextData[themeId] = texts;
            } else {
                log(LOG_LEVEL_ERROR, `Failed to load texts.json for theme: ${themeId}`);
                 if (themeMeta.playable) allSuccess = false;
            }
        }

        // Load prompts-config.json
        if (!_PROMPT_URLS_BY_THEME[themeId] || !_NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[themeId]) {
            const promptsConfig = await _fetchJSON(`${themePath}prompts-config.json`);
            if (promptsConfig) {
                _PROMPT_URLS_BY_THEME[themeId] = promptsConfig.PROMPT_URLS || {};
                _NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[themeId] = promptsConfig.NARRATIVE_LANG_PROMPT_PARTS || {};
            } else {
                log(LOG_LEVEL_WARN, `Failed to load prompts-config.json for theme: ${themeId}. Prompt functionality may be limited.`);
                // Not critical for `allSuccess` unless specific themes absolutely require it.
            }
        }
    }

    if (allSuccess) {
        log(LOG_LEVEL_INFO, 'Initial theme manifest data loaded successfully.');
    } else {
        log(LOG_LEVEL_WARN, 'Some initial theme manifest data failed to load. Check logs for details.');
    }
    return allSuccess;
}

/**
 * Ensures all necessary data (config, texts, prompts config) for a specific theme is loaded.
 * @param {string} themeId - The ID of the theme.
 * @returns {Promise<boolean>} True if data is loaded or was already loaded, false on critical load failure.
 */
export async function ensureThemeDataLoaded(themeId) {
    const themeManifestEntry = THEMES_MANIFEST.find((t) => t.id === themeId);
    if (!themeManifestEntry) {
        log(LOG_LEVEL_ERROR, `Theme ${themeId} not found in manifest.`);
        return false;
    }
    const themePath = themeManifestEntry.path;
    let success = true;

    try {
        if (!_ALL_THEMES_CONFIG[themeId]) {
            log(LOG_LEVEL_DEBUG, `Config for theme ${themeId} not yet loaded. Fetching...`);
            const config = await _fetchJSON(`${themePath}config.json`);
            if (config) _ALL_THEMES_CONFIG[themeId] = config; else success = false;
        }
        if (success && !_themeTextData[themeId]) {
            log(LOG_LEVEL_DEBUG, `Texts for theme ${themeId} not yet loaded. Fetching...`);
            const texts = await _fetchJSON(`${themePath}texts.json`);
            if (texts) _themeTextData[themeId] = texts; else success = false;
        }
        if (success && (!_PROMPT_URLS_BY_THEME[themeId] || !_NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[themeId])) {
            log(LOG_LEVEL_DEBUG, `Prompts config for theme ${themeId} not yet loaded. Fetching...`);
            const promptsConfig = await _fetchJSON(`${themePath}prompts-config.json`);
            if (promptsConfig) {
                _PROMPT_URLS_BY_THEME[themeId] = promptsConfig.PROMPT_URLS || {};
                _NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[themeId] = promptsConfig.NARRATIVE_LANG_PROMPT_PARTS || {};
            } else {
                log(LOG_LEVEL_WARN, `prompts-config.json for theme ${themeId} failed to load. Prompt functionality may be limited.`);
            }
        }
    } catch (error) {
        log(LOG_LEVEL_ERROR, `Error ensuring data for theme ${themeId}:`, error);
        success = false;
    }

    if (!success) {
        log(LOG_LEVEL_ERROR, `Failed to ensure all data for theme ${themeId}.`);
    }
    return success;
}

/**
 * Gets the configuration object for a given theme.
 * @param {string} themeId - The ID of the theme.
 * @returns {object|null} The theme's configuration object, or null if not found/loaded.
 */
export function getThemeConfig(themeId) {
    if (!_ALL_THEMES_CONFIG[themeId]) {
        log(LOG_LEVEL_WARN, `Theme config for ${themeId} requested but not loaded. Call ensureThemeDataLoaded first.`);
    }
    return _ALL_THEMES_CONFIG[themeId] || null;
}

/**
 * Gets the UI text data object for a given theme and language.
 * @param {string} themeId - The ID of the theme.
 * @param {string} lang - The desired language code (e.g., 'en', 'cs').
 * @returns {object|null} The language-specific text object, or English fallback, or null if theme texts not loaded.
 */
export function getThemeUITexts(themeId, lang) {
    if (!_themeTextData[themeId]) {
        log(LOG_LEVEL_WARN, `Theme texts for ${themeId} requested but not loaded. Call ensureThemeDataLoaded first.`);
        return null;
    }
    const themeLocaleData = _themeTextData[themeId];
    if (themeLocaleData && themeLocaleData[lang]) {
        return themeLocaleData[lang];
    }
    if (themeLocaleData && themeLocaleData[DEFAULT_LANGUAGE]) {
        log(LOG_LEVEL_DEBUG, `Language '${lang}' not found for theme '${themeId}', falling back to '${DEFAULT_LANGUAGE}'.`);
        return themeLocaleData[DEFAULT_LANGUAGE];
    }
    log(LOG_LEVEL_WARN, `No texts found for theme '${themeId}' in language '${lang}' or fallback '${DEFAULT_LANGUAGE}'.`);
    return null;
}

/**
 * Gets the URL for a specific prompt file of a theme.
 * @param {string} themeId - The ID of the theme.
 * @param {string} promptName - The name of the prompt (key in prompts-config.json).
 * @returns {string|null} The URL string, or null if not found/loaded.
 */
export function getThemePromptUrl(themeId, promptName) {
    if (!_PROMPT_URLS_BY_THEME[themeId]) {
        log(LOG_LEVEL_WARN, `Prompt URLs for theme ${themeId} not loaded. Call ensureThemeDataLoaded first.`);
        return null;
    }
    return _PROMPT_URLS_BY_THEME[themeId]?.[promptName] || null;
}

/**
 * Gets the narrative language-specific prompt part for a theme and language.
 * @param {string} themeId - The ID of the theme.
 * @param {string} lang - The desired language code.
 * @returns {string} The narrative language prompt part string, or a generic fallback.
 */
export function getThemeNarrativeLangPromptPart(themeId, lang) {
    if (!_NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[themeId]) {
        log(LOG_LEVEL_WARN, `Narrative language prompt parts for theme ${themeId} not loaded. Call ensureThemeDataLoaded first.`);
        return `Narrative must be in ${lang.toUpperCase()}.`; // Generic fallback
    }
    const langParts = _NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[themeId];
    return langParts?.[lang] || langParts?.[DEFAULT_LANGUAGE] || `Narrative must be in ${lang.toUpperCase()}.`;
}

/**
 * Gets the equipment slot configuration for a given theme.
 * @param {string} themeId - The ID of the theme.
 * @returns {object|null} The theme's equipment_slots object, or null if not found/loaded.
 */
export function getThemeEquipmentSlots(themeId) {
    const config = getThemeConfig(themeId);
    return config?.equipment_slots || null;
}

/**
 * Fetches and caches item data for a specific theme and item type (e.g., 'weapon').
 * @param {string} themeId - The ID of the theme.
 * @param {string} itemType - The type of items to fetch (e.g., 'weapon', 'elixir').
 * @returns {Promise<Array|null>} A promise that resolves to an array of item objects, or null on failure.
 */
export async function fetchAndCacheItemData(themeId, itemType) {
    if (!_themeItemData[themeId]) {
        _themeItemData[themeId] = {};
    }
    // Check cache first
    if (_themeItemData[themeId][itemType]) {
        log(LOG_LEVEL_DEBUG, `Item data for ${themeId}/${itemType} found in cache.`);
        return _themeItemData[themeId][itemType];
    }
    const themeManifestEntry = THEMES_MANIFEST.find((t) => t.id === themeId);
    if (!themeManifestEntry) {
        log(LOG_LEVEL_ERROR, `Theme ${themeId} not found in manifest. Cannot fetch item data.`);
        return null;
    }
    const itemDataPath = `${themeManifestEntry.path}data/${itemType}_items.json`;
    log(LOG_LEVEL_INFO, `Fetching item data file: ${itemDataPath}`);
    const itemData = await _fetchJSON(itemDataPath);
    if (itemData !== null) {
        _themeItemData[themeId][itemType] = itemData;
        log(LOG_LEVEL_DEBUG, `Item data for ${themeId}/${itemType} fetched and cached.`);
    } else {
        log(LOG_LEVEL_WARN, `Failed to fetch or no item data found for ${themeId}/${itemType} from ${itemDataPath}. This might be normal if the theme has no such items.`);
        _themeItemData[themeId][itemType] = []; // Cache as empty array to prevent re-fetching
    }
    return _themeItemData[themeId][itemType];
}

/**
 * Synchronously retrieves already loaded item definitions for a theme and item type.
 * Relies on `fetchAndCacheItemData` having been called previously.
 * @param {string} themeId - The ID of the theme.
 * @param {string} itemType - The type of items to retrieve.
 * @returns {Array|null} The cached array of item objects, or null if not loaded.
 */
export function getThemeItemDefinitions(themeId, itemType) {
    const cachedData = _themeItemData[themeId]?.[itemType];
    if (cachedData) {
        return cachedData;
    }
    log(LOG_LEVEL_WARN, `Item definitions for ${themeId}/${itemType} requested from cache but not found. Ensure it was pre-loaded.`);
    return null;
}

/**
 * Fetches the content of a specific prompt file and caches it.
 * If already cached, returns the cached content.
 * @param {string} themeId - The ID of the theme.
 * @param {string} promptName - The name of the prompt.
 * @returns {Promise<string|null>} The prompt text content, or null on error/not found.
 */
export async function fetchAndCachePromptFile(themeId, promptName) {
    if (!_gamePrompts[themeId]) {
        _gamePrompts[themeId] = {};
    }

    // Check cache first, only if it's not a "not found" marker
    if (_gamePrompts[themeId]?.[promptName] && !_gamePrompts[themeId][promptName].startsWith('HELPER_FILE_NOT_FOUND:')) {
        log(LOG_LEVEL_DEBUG, `Prompt ${themeId}/${promptName} found in cache.`);
        return _gamePrompts[themeId][promptName];
    }

    const promptUrl = getThemePromptUrl(themeId, promptName);
    if (!promptUrl) {
        log(LOG_LEVEL_WARN, `URL for prompt ${themeId}/${promptName} not found in prompts-config.`);
        _gamePrompts[themeId][promptName] = `ERROR:URL_NOT_FOUND:${themeId}/${promptName}`; // Cache error state
        return null;
    }

    log(LOG_LEVEL_INFO, `Fetching prompt file: ${promptUrl}`);
    const promptContent = await _fetchText(promptUrl);

    if (promptContent !== null) {
        _gamePrompts[themeId][promptName] = promptContent;
        if (!promptContent.startsWith('HELPER_FILE_NOT_FOUND:')) {
            log(LOG_LEVEL_DEBUG, `Prompt ${themeId}/${promptName} fetched and cached.`);
        } else {
            log(LOG_LEVEL_DEBUG, `Prompt ${themeId}/${promptName} marked as not found in cache.`);
        }
    } else {
        log(LOG_LEVEL_ERROR, `Failed to fetch prompt file for ${themeId}/${promptName} from ${promptUrl}.`);
        _gamePrompts[themeId][promptName] = `ERROR:FETCH_FAILED:${themeId}/${promptName}`; // Cache error state
    }
    return promptContent;
}

/**
 * Synchronously retrieves already loaded prompt text from the cache.
 * This function relies on `getAllPromptsForTheme` or `fetchAndCachePromptFile`
 * having been called previously to populate the cache.
 * @param {string} themeId - The ID of the theme.
 * @param {string} promptName - The name of the prompt.
 * @returns {string|null} The cached prompt text content, or null if not loaded or error.
 */
export function getLoadedPromptText(themeId, promptName) {
    const cachedPrompt = _gamePrompts[themeId]?.[promptName];

    if (cachedPrompt && !cachedPrompt.startsWith('ERROR:') && !cachedPrompt.startsWith('HELPER_FILE_NOT_FOUND:')) {
        return cachedPrompt;
    }

    if (cachedPrompt && (cachedPrompt.startsWith('ERROR:') || cachedPrompt.startsWith('HELPER_FILE_NOT_FOUND:'))) {
        log(LOG_LEVEL_DEBUG, `Requested prompt ${themeId}/${promptName} was previously marked as error/not found: ${cachedPrompt}`);
        return null; // Treat errors or "not found" markers as null for the consumer
    }

    log(LOG_LEVEL_WARN, `Prompt ${themeId}/${promptName} requested from cache but not found. Ensure it was pre-loaded.`);
    return null;
}

/**
 * Ensures all prompt files listed in a theme's configuration are fetched and cached.
 * @param {string} themeId - The ID of the theme.
 * @returns {Promise<boolean>} True if all prompts were fetched successfully or already cached, false otherwise.
 */
export async function getAllPromptsForTheme(themeId) {
    if (!_PROMPT_URLS_BY_THEME[themeId]) {
        log(LOG_LEVEL_DEBUG, `Prompt URLs for theme ${themeId} not loaded. Attempting to ensure all theme data...`);
        const dataLoaded = await ensureThemeDataLoaded(themeId);
        if (!dataLoaded || !_PROMPT_URLS_BY_THEME[themeId]) {
             log(LOG_LEVEL_ERROR, `Unable to load prompt URLs for theme ${themeId}. Cannot fetch all prompts.`);
             return false;
        }
    }
    const promptNames = Object.keys(_PROMPT_URLS_BY_THEME[themeId]);
    if (promptNames.length === 0) {
        log(LOG_LEVEL_INFO, `No prompts listed in config for theme ${themeId}.`);
        return true;
    }

    log(LOG_LEVEL_INFO, `Fetching all prompts for theme: ${themeId}`);
    const fetchPromises = promptNames.map(name => fetchAndCachePromptFile(themeId, name));

    try {
        const results = await Promise.all(fetchPromises);
        // A prompt being null means a fetch error. A prompt starting with HELPER_FILE_NOT_FOUND is acceptable for non-critical helpers.
        if (results.some(content => content === null)) {
            log(LOG_LEVEL_WARN, `Some critical prompts failed to load for theme ${themeId}. Check logs for specifics.`);
            return false;
        }
        log(LOG_LEVEL_INFO, `All prompts for theme ${themeId} processed (fetched or confirmed cached/not-found).`);
        return true;
    } catch (error) {
        log(LOG_LEVEL_ERROR, `Error during batch fetching of prompts for theme ${themeId}:`, error);
        return false;
    }
}

/**
 * Retrieves the parsed trait definitions for a given theme.
 * This function assumes the 'traits' JSON file has been loaded via `getAllPromptsForTheme`.
 * The file should be a JSON object where keys are trait IDs.
 * @param {string} themeId - The ID of the theme.
 * @returns {object|null} A dictionary of trait objects, or null if not available.
 */
export function getThemeTraits(themeId) {
    if (_themeTraits[themeId]) {
        return _themeTraits[themeId];
    }

    // Note: Prompts are cached as text, even if they are JSON. We need to parse them.
    const traitFileContent = getLoadedPromptText(themeId, 'traits');
    if (traitFileContent) {
        try {
            const parsedTraits = JSON.parse(traitFileContent);
            _themeTraits[themeId] = parsedTraits;
            log(LOG_LEVEL_DEBUG, `Parsed and cached traits for theme ${themeId}.`);
            return parsedTraits;
        } catch (e) {
            log(LOG_LEVEL_ERROR, `Failed to parse traits.json for theme ${themeId}. Content:`, traitFileContent, e);
            return null;
        }
    }

    log(LOG_LEVEL_WARN, `Trait definitions for theme '${themeId}' not found or not loaded. Ensure 'traits' is in prompts-config.json and preloaded.`);
    return null;
}


// --- Cache Clearing Utilities (mostly for development/testing) ---
export function _clearThemePromptCache(themeId = null) {
    if (themeId) {
        if (_gamePrompts[themeId]) {
            delete _gamePrompts[themeId];
            log(LOG_LEVEL_INFO, `Prompt cache cleared for theme: ${themeId}`);
        }
    } else {
        Object.keys(_gamePrompts).forEach(id => delete _gamePrompts[id]);
        log(LOG_LEVEL_INFO, 'All theme prompt caches cleared.');
    }
}

export function _clearAllThemeDataCache() {
    Object.keys(_ALL_THEMES_CONFIG).forEach(key => delete _ALL_THEMES_CONFIG[key]);
    Object.keys(_themeTextData).forEach(key => delete _themeTextData[key]);
    Object.keys(_PROMPT_URLS_BY_THEME).forEach(key => delete _PROMPT_URLS_BY_THEME[key]);
    Object.keys(_NARRATIVE_LANG_PROMPT_PARTS_BY_THEME).forEach(key => delete _NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[key]);
    Object.keys(_themeTraits).forEach(key => delete _themeTraits[key]);
    Object.keys(_themeItemData).forEach(key => delete _themeItemData[key]);
    _clearThemePromptCache(); // Clears _gamePrompts
    log(LOG_LEVEL_INFO, 'All theme data caches (configs, texts, prompt configs, prompts, traits, items) cleared.');
}
