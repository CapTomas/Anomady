// js/ui/languageManager.js
/**
 * @file Manages the UI for language selection and triggers updates
 * to application and narrative language settings.
 */

import {
    languageToggleButton,
    playerIdentifierInput,
    playerActionInput,
    sendActionButton,
    startGameButton,
    newGameButton,
    systemStatusIndicator,
    gmSpecificActivityIndicator,
    // For landing page updates
    themeGridContainer,
    landingThemeDescriptionContainer,
    landingThemeLoreText,
    landingThemeDetailsContainer,
    landingThemeInfoContent,
    // For game view dynamic content elements that might need re-translation
    // More specific elements are handled by their respective managers re-rendering
} from './domElements.js';
import {
    getCurrentAppLanguage,
    getCurrentNarrativeLanguage,
    getCurrentTheme,
    getCurrentLandingGridSelection,
    getCurrentUser,
    getCurrentAiPlaceholder,
} from '../core/state.js';
import { DEFAULT_LANGUAGE } from '../core/config.js';
import {
    getUIText,
    setApplicationLanguage,
    setNarrativeLanguage,
} from '../services/localizationService.js';
import * as authService from '../services/authService.js';
import * // For model toggle button text update
    as modelToggleManager from './modelToggleManager.js';
import { log, LOG_LEVEL_INFO, LOG_LEVEL_ERROR, LOG_LEVEL_DEBUG } from '../core/logger.js';
import { attachTooltip } from './tooltipManager.js';

// Dependencies to be injected by app.js or a higher-level orchestrator
let _storyLogManagerRef = null;
let _landingPageManagerRef = null;
let _dashboardManagerRef = null;

/**
 * Initializes the LanguageManager with optional dependencies.
 * @param {object} [dependencies={}] - Optional dependencies.
 * @param {object} [dependencies.storyLogManager] - Reference to storyLogManager.
 * @param {object} [dependencies.landingPageManager] - Reference to landingPageManager.
 * @param {object} [dependencies.dashboardManager] - Reference to dashboardManager.
 */
export function initLanguageManager(dependencies = {}) {
    if (dependencies.storyLogManager) _storyLogManagerRef = dependencies.storyLogManager;
    if (dependencies.landingPageManager) _landingPageManagerRef = dependencies.landingPageManager;
    if (dependencies.dashboardManager) _dashboardManagerRef = dependencies.dashboardManager;

    // Initial setup of the button appearance
    updateLanguageToggleButtonAppearance();
    // Apply initial translations based on loaded language
    log(LOG_LEVEL_INFO, "LanguageManager initialized (translations will be applied by app.js).");
}

/**
 * Updates the appearance (text and ARIA attributes) of the main language toggle button.
 * The button text shows the language it will switch TO.
 */
export function updateLanguageToggleButtonAppearance() {
    if (!languageToggleButton) {
        log(LOG_LEVEL_DEBUG, "Language toggle button not found in DOM. Cannot update appearance.");
        return;
    }
    const currentLang = getCurrentAppLanguage();
    // Determine the "other" language. Assuming only 'en' and 'cs' for now.
    const otherLang = currentLang === 'en' ? 'cs' : 'en';

    // Get the name of the "other" language in the current application language.
    // globalTextData.landing.cs.toggle_language = "English"
    // globalTextData.landing.en.toggle_language = "Česky"
    const buttonText = getUIText('toggle_language', {}, { viewContext: 'landing', explicitLangForTextItself: otherLang });

    languageToggleButton.textContent = buttonText;
    const ariaLabelKey = "toggle_language_aria";
    const ariaLabelText = getUIText(ariaLabelKey, {}, { viewContext: 'global' });
    languageToggleButton.setAttribute("aria-label", ariaLabelText);
    attachTooltip(languageToggleButton, ariaLabelKey, {}, { viewContext: 'global' });

    log(LOG_LEVEL_DEBUG, `Language toggle button appearance updated. Current app lang: ${currentLang}, button shows: ${buttonText}`);
}

/**
 * Handles the click event on the main language toggle button.
 * Switches both application and narrative languages, updates preferences, and refreshes UI.
 */
export async function handleLanguageToggle() {
    if (!languageToggleButton || languageToggleButton.disabled) {
        log(LOG_LEVEL_DEBUG, "Language toggle button is not available or disabled.");
        return;
    }

    const currentLang = getCurrentAppLanguage();
    const newLang = currentLang === 'en' ? 'cs' : 'en';

    log(LOG_LEVEL_INFO, `User toggled language from ${currentLang} to ${newLang}.`);

    // Update state via localizationService
    setApplicationLanguage(newLang);
    setNarrativeLanguage(newLang); // Synchronize narrative language

    const currentUser = getCurrentUser();
    if (currentUser && currentUser.token) {
        try {
            log(LOG_LEVEL_DEBUG, `Updating backend language preferences for user ${currentUser.email} to ${newLang}.`);
            await authService.updateUserPreferences({
                preferred_app_language: newLang,
                preferred_narrative_language: newLang,
            });
            log(LOG_LEVEL_INFO, "Backend language preferences updated successfully.");
        } catch (error) {
            log(LOG_LEVEL_ERROR, "Failed to update backend language preferences:", error.message);
            if (_storyLogManagerRef && getCurrentTheme()) { // Check if game is active
                _storyLogManagerRef.addMessageToLog(getUIText("error_api_call_failed", { ERROR_MSG: "Could not save language preference to server." }), "system-error");
            }
        }
    }

    applyGlobalUITranslations(); // Refresh all UI text

    // Log the language change to the story log if a game is active
    if (_storyLogManagerRef && getCurrentTheme()) {
        const messageKey = newLang === "en" ? "system_lang_set_en" : "system_lang_set_cs";
        _storyLogManagerRef.addMessageToLog(getUIText(messageKey), "system");
    }

    // If a game is active, save its state as narrative language change might affect future AI calls.
    // GameController would typically orchestrate saving.
    // For now, this implies gameController needs to be aware of this action or this manager needs to trigger it.
    // Let's assume gameController will handle saving if it sees a narrative language change.
}

/**
 * Applies translations to all UI elements with data-lang-key attributes,
 * and updates elements whose content is language-dependent but not directly tagged.
 */
export function applyGlobalUITranslations() {
    log(LOG_LEVEL_INFO, "Applying global UI translations for language:", getCurrentAppLanguage());
    const currentLang = getCurrentAppLanguage();
    if (document.documentElement) {
        document.documentElement.lang = currentLang;
    }

    // Helper to set text content
    const setText = (element, key, replacements = {}, options = {}) => {
        if (element) {
            element.textContent = getUIText(key, replacements, options);
        }
    };

    // Helper to set attributes
    const setAttr = (element, attr, key, replacements = {}, options = {}) => {
        if (element) {
            const text = getUIText(key, replacements, options);
            element.setAttribute(attr, text);
            if (attr === 'aria-label' || attr === 'title') element.title = text; // Common to set title with aria-label
        }
    };

    // Translate all elements with data-lang-key for textContent
    document.querySelectorAll('[data-lang-key]').forEach(element => {
        const key = element.dataset.langKey;
        const viewContext = element.closest('.landing-page-active') ? 'landing' : (getCurrentTheme() ? 'game' : 'global');
        const explicitThemeContext = element.dataset.themeContext || (viewContext === 'game' ? getCurrentTheme() : null);
        setText(element, key, {}, { explicitThemeContext, viewContext });
    });

    // Translate all elements with data-lang-key-placeholder for placeholder attribute
    document.querySelectorAll('[data-lang-key-placeholder]').forEach(element => {
        const key = element.dataset.langKeyPlaceholder;
        const viewContext = element.closest('.landing-page-active') ? 'landing' : 'game';
         const explicitThemeContext = element.dataset.themeContext || (viewContext === 'game' ? getCurrentTheme() : null);
        if (element) {
            element.placeholder = getUIText(key, {}, { explicitThemeContext, viewContext });
        }
    });

    // Translate all elements with data-lang-key-aria for aria-label and title attributes
    document.querySelectorAll('[data-lang-key-aria]').forEach(element => {
        const key = element.dataset.langKeyAria;
        const viewContext = element.closest('.landing-page-active') ? 'landing' : 'global';
        const explicitThemeContext = element.dataset.themeContext || (viewContext === 'game' ? getCurrentTheme() : null);

        const ariaText = getUIText(key, {}, { explicitThemeContext, viewContext });
        element.setAttribute('aria-label', ariaText);
        element.removeAttribute('title');
        attachTooltip(element, key, {}, { explicitThemeContext, viewContext });
    });


    // Update specific UI elements that might not use data-lang-key directly or need re-rendering
    updateLanguageToggleButtonAppearance(); // Update its own text
    modelToggleManager.updateModelToggleButtonAppearance(); // Model toggle button text

    // Update status indicators
    if (systemStatusIndicator && systemStatusIndicator.dataset.langKey) {
        setText(systemStatusIndicator, systemStatusIndicator.dataset.langKey);
    }
    if (gmSpecificActivityIndicator && gmSpecificActivityIndicator.dataset.langKey) {
        setText(gmSpecificActivityIndicator, gmSpecificActivityIndicator.dataset.langKey);
    }

    // Handle context-specific UI updates
    if (document.body.classList.contains('landing-page-active')) {
        if (_landingPageManagerRef) {
            _landingPageManagerRef.renderThemeGrid(); // Theme names in grid are localized
            const selectedTheme = getCurrentLandingGridSelection();
            if (selectedTheme) {
                // Re-render panels with new language
                _landingPageManagerRef.updateLandingPagePanelsWithThemeInfo(selectedTheme, false);
                // Re-apply .active class to the grid item as renderThemeGrid recreates the buttons
                if (themeGridContainer) { // Check if themeGridContainer is available from domElements
                    const selectedBtn = themeGridContainer.querySelector(`.theme-grid-icon[data-theme="${selectedTheme}"]`);
                    if (selectedBtn) {
                        selectedBtn.classList.add("active");
                    }
                }
            } else {
                // Reset landing panel placeholder texts
                if (landingThemeLoreText) setText(landingThemeLoreText, "landing_select_theme_prompt_lore", {}, { viewContext: 'landing' });
                if (landingThemeInfoContent) landingThemeInfoContent.innerHTML = `<p>${getUIText("landing_select_theme_prompt_details", {}, { viewContext: 'landing' })}</p>`;
            }
        }
    } else if (getCurrentTheme()) { // Game view is active
        if (_dashboardManagerRef) {
             _dashboardManagerRef.generatePanelsForTheme(getCurrentTheme());
             _dashboardManagerRef.initializeCollapsiblePanelBoxes(getCurrentTheme()); // Re-apply logic for expansion state
             const lastUpdates = _dashboardManagerRef.getLastKnownDashboardUpdatesForTranslationsReapply // This function would need to exist in dashboardManager
                                 ? _dashboardManagerRef.getLastKnownDashboardUpdatesForTranslationsReapply()
                                 : {};
             Object.keys(lastUpdates).forEach(key => {
                _dashboardManagerRef.updateDashboardItem(key, lastUpdates[key], false); // Update without highlight
             });

        }
        // Update game-specific input placeholders if elements are available
        if (playerIdentifierInput && playerIdentifierInput.dataset.langKeyPlaceholder) {
            playerIdentifierInput.placeholder = getUIText(playerIdentifierInput.dataset.langKeyPlaceholder);
        }
        if (playerActionInput && playerActionInput.dataset.langKeyPlaceholder) {
            // Preserve AI-provided placeholder if it exists and is different from the default key
            const currentPlaceholder = getCurrentAiPlaceholder();
            const defaultPlaceholderKey = playerActionInput.dataset.langKeyPlaceholder;
            const defaultPlaceholderText = getUIText(defaultPlaceholderKey);
            if (currentPlaceholder && currentPlaceholder !== defaultPlaceholderText && currentPlaceholder !== getUIText(defaultPlaceholderKey, {}, { explicitLangForTextItself: currentLang === 'en' ? 'cs' : 'en' })) {
                // Keep AI placeholder if it's custom
            } else {
                 playerActionInput.placeholder = defaultPlaceholderText;
            }
        }
        if (startGameButton && startGameButton.dataset.langKey) {
            setText(startGameButton, startGameButton.dataset.langKey);
        }
        if (sendActionButton && sendActionButton.dataset.langKey) {
            setText(sendActionButton, sendActionButton.dataset.langKey);
        }
        if (newGameButton && newGameButton.dataset.langKey) {
            const themeConfig = _dashboardManagerRef && typeof _dashboardManagerRef.getThemeConfigForCurrentTheme === 'function'
                ? _dashboardManagerRef.getThemeConfigForCurrentTheme() // A helper in dashboardManager might be needed
                : null;
            const newGameTermKey = themeConfig?.new_game_button_text_key || "button_new_game";
            setText(newGameButton, newGameTermKey, {}, { explicitThemeContext: getCurrentTheme() });
        }
    }

    log(LOG_LEVEL_INFO, "Global UI translations applied.");
}
