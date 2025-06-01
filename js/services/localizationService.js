// js/services/localizationService.js
/**
 * @file Handles UI text retrieval using globalTextData and theme-specific texts.
 * Manages application and narrative language settings.
 */

import {
    getCurrentAppLanguage,
    setCurrentAppLanguage as setStateAppLanguage,
    getCurrentNarrativeLanguage,
    setCurrentNarrativeLanguage as setStateNarrativeLanguage,
    getCurrentTheme
} from '../core/state.js';
import { globalTextData } from '../data/globalTexts.js';
import { getThemeUITexts as getThemeSpecificTexts } from './themeService.js';
import { log, LOG_LEVEL_INFO, LOG_LEVEL_WARN, LOG_LEVEL_DEBUG } from '../core/logger.js';
import { DEFAULT_LANGUAGE } from '../core/config.js';

/**
 * Retrieves UI text based on key, language, and context.
 * @param {string} key - The localization key.
 * @param {object} [replacements={}] - An object of placeholder-value pairs for interpolation.
 * @param {object} [options={}] - Optional parameters.
 * @param {string|null} [options.explicitThemeContext=null] - Specific theme ID to use for lookup, overrides current theme.
 * @param {string|null} [options.viewContext=null] - Hint for view context, e.g., 'landing', 'game'.
 * @returns {string} The localized and interpolated string, or the key itself if not found.
 */
export function getUIText(key, replacements = {}, options = {}) {
    const { explicitThemeContext = null, viewContext = null } = options;
    const lang = getCurrentAppLanguage();
    let text;

    // 1. Try theme-specific text if a theme context is active or explicitly provided
    const themeForLookup = explicitThemeContext || getCurrentTheme();
    if (themeForLookup) {
        const themeTexts = getThemeSpecificTexts(themeForLookup, lang); // themeService handles its own lang fallback (e.g., to 'en')
        if (themeTexts && typeof themeTexts[key] === 'string') {
            text = themeTexts[key];
        }
    }

    // 2. If not found in theme, try global texts.
    if (text === undefined) {
        if (viewContext === 'landing' && globalTextData.landing) {
            if (globalTextData.landing[lang]?.[key] !== undefined) {
                text = globalTextData.landing[lang][key];
            } else if (globalTextData.landing[DEFAULT_LANGUAGE]?.[key] !== undefined) {
                text = globalTextData.landing[DEFAULT_LANGUAGE][key];
                if (lang !== DEFAULT_LANGUAGE) {
                     log(LOG_LEVEL_DEBUG, `Key '${key}' (landing context) not found for lang '${lang}', used default app lang '${DEFAULT_LANGUAGE}'.`);
                }
            }
        }

        // If still not found (or not a landing context, or key not in landing section), try general global texts
        if (text === undefined && globalTextData.global) {
            if (globalTextData.global[lang]?.[key] !== undefined) {
                text = globalTextData.global[lang][key];
            } else if (globalTextData.global[DEFAULT_LANGUAGE]?.[key] !== undefined) {
                text = globalTextData.global[DEFAULT_LANGUAGE][key];
                 if (lang !== DEFAULT_LANGUAGE) {
                    log(LOG_LEVEL_DEBUG, `Key '${key}' (global context) not found for lang '${lang}', used default app lang '${DEFAULT_LANGUAGE}'.`);
                }
            }
        }
    }

    // 3. Final fallback to the key itself if no text found
    if (text === undefined) {
        log(LOG_LEVEL_WARN, `Localization key '${key}' not found for lang '${lang}' in any context.`);
        text = key;
    }

    // Apply replacements
    if (typeof text === 'string') {
        let resultText = text;
        for (const placeholder in replacements) {
            if (Object.prototype.hasOwnProperty.call(replacements, placeholder)) {
                 resultText = resultText.replace(new RegExp(`{${placeholder}}`, "g"), replacements[placeholder]);
            }
        }
        return resultText;
    } else {
        // This case should ideally not be reached if key fallback works, but good for safety.
        log(LOG_LEVEL_WARN, `Retrieved non-string or undefined text for key '${key}' in lang '${lang}'. Returning key itself.`);
        return String(key);
    }
}

/**
 * Gets the current application language from the state.
 * @returns {string} The current application language code.
 */
export function getApplicationLanguage() {
    return getCurrentAppLanguage();
}

/**
 * Sets the application language in the state.
 * UI updates triggered by this change are expected to be handled by a UI manager (e.g., languageManager.js).
 * @param {string} lang - The new application language code (e.g., 'en', 'cs').
 */
export function setApplicationLanguage(lang) {
    // Basic validation could be added here if there's a predefined list of supported app languages
    // For now, assume lang is valid.
    setStateAppLanguage(lang);
    log(LOG_LEVEL_INFO, `Application language set to: ${lang} via localizationService.`);
}

/**
 * Gets the current narrative language from the state.
 * @returns {string} The current narrative language code.
 */
export function getNarrativeLanguage() {
    return getCurrentNarrativeLanguage();
}

/**
 * Sets the narrative language in the state.
 * UI updates or game logic changes (like AI prompt regeneration)
 * triggered by this change are expected to be handled by relevant managers/services.
 * @param {string} lang - The new narrative language code (e.g., 'en', 'cs').
 */
export function setNarrativeLanguage(lang) {
    // Basic validation could be added here
    setStateNarrativeLanguage(lang);
    log(LOG_LEVEL_INFO, `Narrative language set to: ${lang} via localizationService.`);
}
