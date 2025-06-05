// js/ui/characterPanelManager.js
/**
 * @file Manages the display and updates of the character progression panel.
 * This includes character name, level, core attributes (Integrity, Willpower, Aptitude, Resilience),
 * and the XP bar.
 */

import * as dom from './domElements.js';
import * as state from '../core/state.js';
import { getUIText } from '../services/localizationService.js';
import { XP_LEVELS } from '../core/config.js'; // For XP bar calculation
import { log, LOG_LEVEL_DEBUG, LOG_LEVEL_INFO, LOG_LEVEL_WARN } from '../core/logger.js';

// Destructure DOM elements for character panel and XP bar
const {
    characterProgressionPanel,
    charPanelIdentifier,
    charPanelLevel,
    charPanelIntegrityMeter,
    charPanelIntegrityValue,
    charPanelWillpowerMeter,
    charPanelWillpowerValue,
    charPanelAptitudeValue,
    charPanelResilienceValue,
    xpBarContainer,
    xpBarFill,
    xpBarText
} = dom;

/**
 * Initializes the CharacterPanelManager.
 * Ensures the panel and XP bar are initially hidden.
 */
export function initCharacterPanelManager() {
    showCharacterPanel(false); // Initially hidden
    showXPBar(false); // Initially hidden
    log(LOG_LEVEL_INFO, "CharacterPanelManager initialized. Panel and XP bar hidden.");
}

/**
 * Shows or hides the character progression panel.
 * @param {boolean} show - True to show, false to hide.
 */
export function showCharacterPanel(show) {
    if (characterProgressionPanel) {
        characterProgressionPanel.style.display = show ? 'flex' : 'none';
        log(LOG_LEVEL_DEBUG, `Character panel display set to: ${show ? 'flex' : 'none'}`);
    } else {
        log(LOG_LEVEL_WARN, "Character progression panel DOM element not found.");
    }
}

/**
 * Shows or hides the XP bar.
 * @param {boolean} show - True to show, false to hide.
 */
export function showXPBar(show) {
    if (xpBarContainer) {
        xpBarContainer.style.display = show ? 'block' : 'none'; // 'block' or 'flex' depending on styling
        log(LOG_LEVEL_DEBUG, `XP bar display set to: ${show ? 'block' : 'none'}`);
    } else {
        log(LOG_LEVEL_WARN, "XP bar container DOM element not found.");
    }
}

/**
 * Updates the character progression panel and XP bar with the latest data from the state.
 */
export function updateCharacterPanel() {
    if (!characterProgressionPanel) {
        log(LOG_LEVEL_WARN, "Character panel DOM element not found, skipping update.");
        return;
    }
    // Only update if the panel is supposed to be visible (i.e., in game view)
    if (characterProgressionPanel.style.display === 'none') {
        log(LOG_LEVEL_DEBUG, "Character panel is hidden, skipping DOM update.");
        return;
    }

    const playerIdentifier = state.getPlayerIdentifier() || getUIText(charPanelIdentifier?.dataset.langKey || "char_panel_placeholder_name");
    const userProgress = state.getCurrentUserThemeProgress();
    const runStats = state.getCurrentRunStats();

    const level = userProgress ? userProgress.level : 1;
    const currentXP = userProgress ? userProgress.currentXP : 0;

    const maxIntegrity = state.getEffectiveMaxIntegrity();
    const currentIntegrity = runStats.currentIntegrity !== undefined ? runStats.currentIntegrity : maxIntegrity;
    const maxWillpower = state.getEffectiveMaxWillpower();
    const currentWillpower = runStats.currentWillpower !== undefined ? runStats.currentWillpower : maxWillpower;
    const aptitude = state.getEffectiveAptitude();
    const resilience = state.getEffectiveResilience();

    // Update DOM elements for Character Panel
    if (charPanelIdentifier) charPanelIdentifier.textContent = playerIdentifier;
    if (charPanelLevel) charPanelLevel.textContent = `${getUIText("char_panel_label_level")} ${level}`;

    // Integrity
    if (charPanelIntegrityValue) charPanelIntegrityValue.textContent = `${currentIntegrity}/${maxIntegrity}`;
    if (charPanelIntegrityMeter) {
        const integrityPercentage = maxIntegrity > 0 ? (currentIntegrity / maxIntegrity) * 100 : 0;
        charPanelIntegrityMeter.style.width = `${Math.max(0, Math.min(100, integrityPercentage))}%`;
        charPanelIntegrityMeter.className = 'attribute-meter-bar'; // Reset
        if (integrityPercentage <= 25) charPanelIntegrityMeter.classList.add('meter-low'); // Example: red for low
        else if (integrityPercentage <= 50) charPanelIntegrityMeter.classList.add('meter-medium'); // Example: yellow for medium
        else charPanelIntegrityMeter.classList.add('meter-full'); // Example: green for full
        // Apply specific theme color for 'full' state if needed
        charPanelIntegrityMeter.style.backgroundColor = ''; // Clear direct style to use CSS
        if (integrityPercentage > 50) charPanelIntegrityMeter.classList.add('integrity-full');


    }

    // Willpower
    if (charPanelWillpowerValue) charPanelWillpowerValue.textContent = `${currentWillpower}/${maxWillpower}`;
    if (charPanelWillpowerMeter) {
        const willpowerPercentage = maxWillpower > 0 ? (currentWillpower / maxWillpower) * 100 : 0;
        charPanelWillpowerMeter.style.width = `${Math.max(0, Math.min(100, willpowerPercentage))}%`;
        charPanelWillpowerMeter.className = 'attribute-meter-bar'; // Reset
        if (willpowerPercentage <= 25) charPanelWillpowerMeter.classList.add('meter-low');
        else if (willpowerPercentage <= 50) charPanelWillpowerMeter.classList.add('meter-medium');
        else charPanelWillpowerMeter.classList.add('meter-full');
        charPanelWillpowerMeter.style.backgroundColor = '';
        if (willpowerPercentage > 50) charPanelWillpowerMeter.classList.add('willpower-full');
    }

    if (charPanelAptitudeValue) charPanelAptitudeValue.textContent = String(aptitude);
    if (charPanelResilienceValue) charPanelResilienceValue.textContent = String(resilience);

    // Update XP Bar
    if (xpBarContainer && xpBarFill && xpBarText) {
        const xpForCurrentLevel = XP_LEVELS[level - 1];
        const xpForNextLevel = (level < XP_LEVELS.length) ? XP_LEVELS[level] : currentXP; // If max level, cap at currentXP

        const xpIntoCurrentLevel = currentXP - xpForCurrentLevel;
        const xpNeededForThisLevel = xpForNextLevel - xpForCurrentLevel;

        let xpPercentage = 0;
        if (level >= XP_LEVELS.length) { // Max level reached
            xpPercentage = 100;
        } else if (xpNeededForThisLevel > 0) {
            xpPercentage = (xpIntoCurrentLevel / xpNeededForThisLevel) * 100;
        }

        xpBarFill.style.width = `${Math.max(0, Math.min(100, xpPercentage))}%`;

        if (level >= XP_LEVELS.length) {
            xpBarText.textContent = getUIText("xp_bar_max_level");
        } else {
            xpBarText.textContent = `${getUIText("xp_bar_label_xp")} ${currentXP}/${xpForNextLevel}`;
        }
    }
    log(LOG_LEVEL_DEBUG, "Character panel and XP bar updated.");
}

/**
 * Updates the static labels in the character panel based on the current language.
 * This is typically called by languageManager when the language changes.
 */
export function retranslateCharacterPanelLabels() {
    if (!characterProgressionPanel) return;

    const labelMappings = {
        "char_panel_label_integrity": dom.characterProgressionPanel?.querySelector('.attribute-label[data-lang-key="char_panel_label_integrity"]'),
        "char_panel_label_willpower": dom.characterProgressionPanel?.querySelector('.attribute-label[data-lang-key="char_panel_label_willpower"]'),
        "char_panel_label_aptitude": dom.characterProgressionPanel?.querySelector('.attribute-label[data-lang-key="char_panel_label_aptitude"]'),
        "char_panel_label_resilience": dom.characterProgressionPanel?.querySelector('.attribute-label[data-lang-key="char_panel_label_resilience"]'),
        "xp_bar_default_text": dom.xpBarText // For the "XP:" part if it's static and value is appended
    };

    for (const key in labelMappings) {
        if (labelMappings[key] && labelMappings[key].dataset.langKey === key) { // Check if element has the data-lang-key
            labelMappings[key].textContent = getUIText(key);
        }
    }
    // For elements like level that combine static text with dynamic value:
    if (dom.charPanelLevel) {
         const level = state.getCurrentUserThemeProgress() ? state.getCurrentUserThemeProgress().level : 1;
         dom.charPanelLevel.textContent = `${getUIText("char_panel_label_level")} ${level}`;
    }
    if (dom.charPanelIdentifier) {
        const playerIdentifier = state.getPlayerIdentifier();
        if (!playerIdentifier) { // Only reset placeholder if no dynamic ID is set
            dom.charPanelIdentifier.textContent = getUIText(dom.charPanelIdentifier.dataset.langKey || "char_panel_placeholder_name");
        }
    }
    log(LOG_LEVEL_DEBUG, "Character panel labels re-translated.");
    // Call updateCharacterPanel to refresh all values, ensuring they are correct after lang change
    // This is important if any value formatting depends on language.
    updateCharacterPanel();
}
