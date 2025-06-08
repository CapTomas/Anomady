// js/ui/characterPanelManager.js
/**
 * @file Manages the dynamic generation, display, and updates of the character progression panel.
 * This includes character name, level, core attributes (Integrity, Willpower, etc.), and the XP bar.
 */
import * as dom from './domElements.js';
import * as state from '../core/state.js';
import * as apiService from '../core/apiService.js';
import { getUIText } from '../services/localizationService.js';
import { XP_LEVELS, MAX_PLAYER_LEVEL } from '../core/config.js';
import { log, LOG_LEVEL_DEBUG, LOG_LEVEL_INFO, LOG_LEVEL_WARN, LOG_LEVEL_ERROR } from '../core/logger.js';
import { attachTooltip, hideCurrentTooltip } from './tooltipManager.js';
import * as modalManager from './modalManager.js';
import { getThemeConfig, getThemeTraits } from '../services/themeService.js';
import * as uiUtils from './uiUtils.js';

// Dependencies injected at init
let _gameControllerRef = null;

// Destructure relevant DOM elements
const {
    characterProgressionPanel,
    charPanelIdentifier,
    charPanelLevel,
    xpBarContainer,
    xpBarFill,
    xpBarText
} = dom;

/**
 * Creates the static DOM structure for the character panel.
 * This is called once during initialization.
 * @private
 */
function _createBasePanelStructure() {
    if (!characterProgressionPanel) return;
    characterProgressionPanel.innerHTML = `
        <div class="character-info-left">
            <div id="cp-item-strain" class="attribute-item">
                <div id="char-panel-strain-icon" class="attribute-value status-icon"></div>
            </div>
            <div class="char-panel-identity-block">
                <span id="char-panel-identifier" data-lang-key="char_panel_placeholder_name">Character</span>
                <span id="char-panel-level" data-lang-key="char_panel_placeholder_level">Level 1</span>
            </div>
        </div>
        <div id="character-attributes-grid" class="character-attributes-grid">
            <!-- Attribute items will be dynamically inserted here -->
        </div>
        <div class="character-info-right">
            <!-- Icon buttons will be dynamically inserted here -->
        </div>
    `;

    const strainIcon = document.getElementById('char-panel-strain-icon');
    if (strainIcon) {
        strainIcon.addEventListener('click', _showStrainDetailsModal);
    }
}

/**
 * Dynamically builds the character attributes grid based on the theme's top_panel config.
 * @param {string} themeId The ID of the current theme.
 */
export function buildCharacterPanel(themeId) {
    const themeConfig = getThemeConfig(themeId);
    const grid = document.getElementById('character-attributes-grid');
    const rightContainer = dom.characterProgressionPanel.querySelector('.character-info-right');

    if (!grid || !rightContainer) {
        log(LOG_LEVEL_ERROR, "Character panel grid or right container not found. Cannot build panel.");
        return;
    }

    grid.innerHTML = '';
    rightContainer.innerHTML = '';

    const topPanelConfig = themeConfig?.dashboard_config?.top_panel || [];

    topPanelConfig.forEach(itemConfig => {
        if (itemConfig.id === 'strain_level') return; // Strain is handled separately in the left container

        const itemContainer = document.createElement('div');
        itemContainer.id = `cp-item-${itemConfig.id}`;
        itemContainer.className = 'attribute-item';

        const label = document.createElement('span');
        label.className = 'attribute-label';
        label.textContent = getUIText(itemConfig.label_key);
        itemContainer.appendChild(label);

        if (itemConfig.type === 'meter') {
            const meterContainer = document.createElement('div');
            meterContainer.className = 'attribute-meter-container';
            const meterBar = document.createElement('div');
            meterBar.id = `char-panel-${itemConfig.id}-meter`;
            meterBar.className = 'attribute-meter-bar';
            meterContainer.appendChild(meterBar);
            itemContainer.appendChild(meterContainer);

            const valueDisplay = document.createElement('span');
            valueDisplay.id = `char-panel-${itemConfig.id}-value`;
            valueDisplay.className = 'attribute-value';
            itemContainer.appendChild(valueDisplay);
        } else if (itemConfig.type === 'number') {
            const valueDisplay = document.createElement('span');
            valueDisplay.id = `char-panel-${itemConfig.id}-value`;
            valueDisplay.className = 'attribute-value';
            itemContainer.appendChild(valueDisplay);
        }

        if (itemConfig.tooltip_key) {
            const tooltipIcon = document.createElement('span');
            tooltipIcon.className = 'info-tooltip-trigger';
            tooltipIcon.setAttribute('role', 'button');
            tooltipIcon.setAttribute('tabindex', '0');
            attachTooltip(tooltipIcon, itemConfig.tooltip_key, {}, { explicitThemeContext: themeId, viewContext: 'game' });
            itemContainer.appendChild(tooltipIcon);
        }
        grid.appendChild(itemContainer);
    });

    _createIconButtons(rightContainer);
}


/**
 * Creates the icon buttons for Lore, Inventory, and Traits.
 * @param {HTMLElement} container - The container to append the buttons to.
 * @private
 */
function _createIconButtons(container) {
    if (!container) return;

    const buttons = [
        { id: 'lore', icon: 'icon_lore.svg', tooltipKey: 'tooltip_lore_button', handler: _showLoreModal },
        { id: 'inventory', icon: 'icon_inventory.svg', tooltipKey: 'tooltip_inventory_button', handler: _showInventoryModal },
        { id: 'traits', icon: 'icon_traits.svg', tooltipKey: 'tooltip_traits_button', handler: _showTraitsModal }
    ];

    buttons.forEach(btnInfo => {
        const button = document.createElement('button');
        button.id = `char-panel-${btnInfo.id}-button`;
        button.className = 'ui-button icon-button';
        button.innerHTML = `<img src="images/app/${btnInfo.icon}" alt="${btnInfo.id}">`;
        attachTooltip(button, btnInfo.tooltipKey);
        button.addEventListener('click', btnInfo.handler);
        container.appendChild(button);
    });
}

/**
 * Shows a modal with details about the character's current strain level.
 * @private
 */
function _showStrainDetailsModal() {
    const themeId = state.getCurrentTheme();
    const themeConfig = getThemeConfig(themeId);
    if (!themeConfig) return;
    const strainLevel = state.getCurrentStrainLevel();
    const strainItemConfig = themeConfig.dashboard_config?.top_panel?.find(item => item.id === 'strain_level');

    if (!strainItemConfig) return;
    const levelConfig = strainItemConfig.level_mappings?.[String(strainLevel)];
    if (!levelConfig) return;

    const titleKey = "modal_title_strain_status";
    const messageText = getUIText(levelConfig.display_text_key, {}, { explicitThemeContext: themeId, viewContext: 'game' });
    const tooltipText = getUIText(strainItemConfig.tooltip_key, {}, { explicitThemeContext: themeId, viewContext: 'game' });

    modalManager.showCustomModal({
        type: 'alert',
        titleKey: titleKey,
        htmlContent: `<p><strong>${messageText}</strong></p><p>${tooltipText}</p>`,
    });
}

/**
 * Initializes the CharacterPanelManager.
 * @param {object} [dependencies={}] - Optional dependencies.
 */
export function initCharacterPanelManager(dependencies = {}) {
    _gameControllerRef = dependencies.gameController;
    _createBasePanelStructure();
    showCharacterPanel(false);
    showXPBar(false);
    log(LOG_LEVEL_INFO, "CharacterPanelManager initialized. Panel and XP bar hidden.");
}


/**
 * Shows a modal displaying the character's persistent progress for a specific theme.
 * Includes stats, traits, and a 'Reset Character' option.
 * @param {string} themeId - The ID of the theme for which to show progress.
 */
export async function showCharacterProgressModal(themeId) {
    const themeConfig = getThemeConfig(themeId);
    const progress = state.getLandingSelectedThemeProgress();
    const currentUser = state.getCurrentUser();

    if (!themeConfig || !progress || !currentUser) {
        log(LOG_LEVEL_ERROR, "Could not show character progress modal. Missing themeConfig, progress data, or user.");
        return;
    }

    const allThemeTraits = getThemeTraits(themeId);
    const lang = state.getCurrentAppLanguage();
    const themeDisplayName = getUIText(themeConfig.name_key, {}, { explicitThemeContext: themeId });

    const content = document.createElement('div');
    content.className = 'character-progress-modal-content';

    // Build the stats list
    const statsList = document.createElement('dl');
    statsList.className = 'progress-stats-list';
    const createStatItem = (labelKey, value) => {
        const dt = document.createElement('dt');
        dt.textContent = getUIText(labelKey);
        const dd = document.createElement('dd');
        dd.textContent = value;
        statsList.appendChild(dt);
        statsList.appendChild(dd);
    };

    const xpForNextLevel = progress.level < XP_LEVELS.length ? XP_LEVELS[progress.level] : 'MAX';
    createStatItem('label_char_progress_level', progress.level || 1);
    createStatItem('label_char_progress_xp', `${progress.currentXP || 0} / ${xpForNextLevel}`);
    createStatItem('label_char_progress_integrity', `${themeConfig.base_attributes.integrity} (+${progress.maxIntegrityBonus || 0})`);
    createStatItem('label_char_progress_willpower', `${themeConfig.base_attributes.willpower} (+${progress.maxWillpowerBonus || 0})`);
    createStatItem('label_char_progress_aptitude', `${themeConfig.base_attributes.aptitude} (+${progress.aptitudeBonus || 0})`);
    createStatItem('label_char_progress_resilience', `${themeConfig.base_attributes.resilience} (+${progress.resilienceBonus || 0})`);
    content.appendChild(statsList);

    // Build the traits list
    const traitsSection = document.createElement('div');
    traitsSection.className = 'progress-traits-section';
    const traitsTitle = document.createElement('h4');
    traitsTitle.textContent = getUIText('label_char_progress_traits');
    traitsSection.appendChild(traitsTitle);

    const acquiredTraits = Array.isArray(progress.acquiredTraitKeys) ? progress.acquiredTraitKeys : [];
    if (acquiredTraits.length > 0 && allThemeTraits) {
        const list = document.createElement('ul');
        list.className = 'traits-list';
        acquiredTraits.forEach(traitKey => {
            const traitDefinition = allThemeTraits[traitKey];
            if (traitDefinition) {
                const localizedTrait = traitDefinition[lang] || traitDefinition['en'];
                if(localizedTrait) {
                    const listItem = document.createElement('li');
                    listItem.className = 'trait-item';
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'trait-name';
                    nameSpan.textContent = localizedTrait.name;
                    const descSpan = document.createElement('span');
                    descSpan.className = 'trait-description';
                    descSpan.textContent = localizedTrait.description;
                    listItem.appendChild(nameSpan);
                    listItem.appendChild(descSpan);
                    list.appendChild(listItem);
                }
            } else {
                log(LOG_LEVEL_WARN, `Data for acquired trait key '${traitKey}' not found in theme's parsed traits during progress modal display.`);
            }
        });
        traitsSection.appendChild(list);
    } else {
        const noTraitsP = document.createElement('p');
        noTraitsP.textContent = getUIText('label_char_progress_no_traits');
        traitsSection.appendChild(noTraitsP);
    }
    content.appendChild(traitsSection);

    // Danger Zone for Reset Button
    const dangerZone = document.createElement('div');
    dangerZone.className = 'danger-zone';
    const dangerTitle = document.createElement('h4');
    dangerTitle.className = 'danger-zone-title';
    dangerTitle.textContent = getUIText('title_danger_zone');
    const resetButton = document.createElement('button');
    resetButton.className = 'ui-button danger';
    resetButton.textContent = getUIText('button_reset_character');
    attachTooltip(resetButton, 'tooltip_reset_character');
    resetButton.addEventListener('click', () => {
        if (_gameControllerRef) {
            _gameControllerRef.initiateCharacterResetFlow(themeId);
        }
    });
    dangerZone.appendChild(dangerTitle);
    dangerZone.appendChild(resetButton);
    content.appendChild(dangerZone);

    modalManager.showCustomModal({
        type: 'custom',
        titleKey: 'modal_title_character_progress',
        replacements: { THEME_NAME: themeDisplayName },
        htmlContent: content,
        customActions: [{ textKey: 'modal_ok_button', className: 'ui-button primary', onClick: () => modalManager.hideCustomModal() }]
    });
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
        xpBarContainer.style.display = show ? 'flex' : 'none';
        log(LOG_LEVEL_DEBUG, `XP bar display set to: ${show ? 'flex' : 'none'}`);
    } else {
        log(LOG_LEVEL_WARN, "XP bar container DOM element not found.");
    }
}

/**
 * Animates the XP bar and text to show experience gain.
 * @param {number} xpGained - The amount of experience points gained.
 */
export function animateXpGain(xpGained) {
    if (!xpBarContainer || !xpBarText || xpGained <= 0) {
        return;
    }
    const popup = document.createElement('div');
    popup.className = 'xp-gain-popup';
    popup.textContent = `+${xpGained} XP`;
    document.body.appendChild(popup);
    const textRect = xpBarText.getBoundingClientRect();
    popup.style.left = `${textRect.left + (textRect.width / 2)}px`;
    popup.style.top = `${textRect.top}px`;
    setTimeout(() => {
        if (document.body.contains(popup)) {
            document.body.removeChild(popup);
        }
    }, 3000);
    xpBarText.classList.add('updated');
    setTimeout(() => {
        if (document.body.contains(xpBarText)) {
            xpBarText.classList.remove('updated');
        }
    }, 3000);
}

/**
 * Updates the character progression panel and XP bar with the latest data from the state.
 * @param {object} [updates] - Optional object with new values to apply. If not provided, uses current state.
 */
export function updateCharacterPanel(updates = {}) {
    if (!characterProgressionPanel || characterProgressionPanel.style.display === 'none') {
        return;
    }

    const themeId = state.getCurrentTheme();
    if (!themeId) return;

    const themeConfig = getThemeConfig(themeId);
    const topPanelConfig = themeConfig?.dashboard_config?.top_panel || [];

    // Update Identity block
    const playerIdentifier = state.getPlayerIdentifier() || getUIText('char_panel_placeholder_name');
    const level = state.getPlayerLevel();
    const idEl = document.getElementById('char-panel-identifier');
    const levelEl = document.getElementById('char-panel-level');
    if (idEl) idEl.textContent = playerIdentifier;
    if (levelEl) levelEl.textContent = `${getUIText("char_panel_label_level")} ${level}`;

    // Update dynamic attributes
    const runStats = state.getCurrentRunStats();
    topPanelConfig.forEach(itemConfig => {
        let itemValue;

        // Special handling for Aptitude and Resilience which are calculated, not stored in runStats
        if (itemConfig.id === 'aptitude') {
            itemValue = state.getEffectiveAptitude();
        } else if (itemConfig.id === 'resilience') {
            itemValue = state.getEffectiveResilience();
        } else if (itemConfig.maps_to_run_stat) {
            // For other stats like integrity, willpower, strain, get them from runStats
            itemValue = runStats[itemConfig.maps_to_run_stat];
        }

        if (itemValue === undefined) return;

        const valueEl = document.getElementById(`char-panel-${itemConfig.id}-value`);
        const meterEl = document.getElementById(`char-panel-${itemConfig.id}-meter`);

        if (itemConfig.type === 'meter') {
            let maxVal;
            if (itemConfig.id === 'integrity') maxVal = state.getEffectiveMaxIntegrity();
            else if (itemConfig.id === 'willpower') maxVal = state.getEffectiveMaxWillpower();
            else maxVal = 100; // Fallback for other meters if any

            const percentage = maxVal > 0 ? (itemValue / maxVal) * 100 : 0;
            if (valueEl) valueEl.textContent = `${itemValue}/${maxVal}`;
            if (meterEl) {
                meterEl.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
                meterEl.className = 'attribute-meter-bar'; // Reset classes
                if (percentage <= 25) meterEl.classList.add('meter-low');
                else if (percentage <= 50) meterEl.classList.add('meter-medium');
                else meterEl.classList.add('meter-full');
                if (percentage > 50) {
                    if (itemConfig.meter_type === 'health') meterEl.classList.add('integrity-full');
                    if (itemConfig.meter_type === 'stamina') meterEl.classList.add('willpower-full');
                }
            }
        } else if (itemConfig.type === 'number') {
            if (valueEl) valueEl.textContent = String(itemValue);
        } else if (itemConfig.type === 'status_icon') {
            const iconEl = document.getElementById('char-panel-strain-icon');
            const levelConfig = itemConfig.level_mappings?.[String(itemValue)];
            if (iconEl && levelConfig) {
                iconEl.style.webkitMaskImage = `url(${levelConfig.icon_path})`;
                iconEl.style.maskImage = `url(${levelConfig.icon_path})`;
                const newClass = levelConfig.css_class || 'status-info';
                iconEl.className = 'attribute-value status-icon ' + newClass; // Reset and set
                const tooltipText = getUIText(levelConfig.display_text_key, {}, { explicitThemeContext: themeId });
                attachTooltip(iconEl, null, {}, { rawText: tooltipText });
            }
        }
    });

    // Update XP Bar
    const userProgress = state.getCurrentUserThemeProgress();
    if (xpBarContainer && xpBarFill && xpBarText && userProgress) {
        const currentXP = userProgress.currentXP;
        const xpForCurrentLevel = XP_LEVELS[level - 1] || 0;
        const xpForNextLevel = (level < MAX_PLAYER_LEVEL) ? XP_LEVELS[level] : currentXP;
        const xpIntoCurrentLevel = currentXP - xpForCurrentLevel;
        const xpNeededForThisLevel = xpForNextLevel - xpForCurrentLevel;
        const xpPercentage = (level >= MAX_PLAYER_LEVEL || xpNeededForThisLevel <= 0) ? 100 : (xpIntoCurrentLevel / xpNeededForThisLevel) * 100;

        xpBarFill.style.width = `${Math.max(0, Math.min(100, xpPercentage))}%`;
        xpBarText.textContent = (level >= MAX_PLAYER_LEVEL)
            ? getUIText("xp_bar_max_level")
            : `${getUIText("xp_bar_label_xp")} ${currentXP}/${xpForNextLevel}`;
    }
}


/**
 * Updates the static labels in the character panel based on the current language.
 * This is typically called by languageManager when the language changes.
 */
export function retranslateCharacterPanelLabels() {
    if (!characterProgressionPanel) return;

    const themeId = state.getCurrentTheme();
    if (!themeId) return;

    // Retranslate static elements
    const idEl = document.getElementById('char-panel-identifier');
    const levelEl = document.getElementById('char-panel-level');
    if (idEl && !state.getPlayerIdentifier()) idEl.textContent = getUIText('char_panel_placeholder_name');
    if (levelEl) levelEl.textContent = `${getUIText("char_panel_label_level")} ${state.getPlayerLevel()}`;

    // Retranslate dynamically generated elements and tooltips
    const themeConfig = getThemeConfig(themeId);
    const topPanelConfig = themeConfig?.dashboard_config?.top_panel || [];

    topPanelConfig.forEach(itemConfig => {
        const itemContainer = document.getElementById(`cp-item-${itemConfig.id}`);
        if (itemContainer) {
            const labelEl = itemContainer.querySelector('.attribute-label');
            if (labelEl) labelEl.textContent = getUIText(itemConfig.label_key);

            const tooltipTrigger = itemContainer.querySelector('.info-tooltip-trigger');
            if (tooltipTrigger && itemConfig.tooltip_key) {
                attachTooltip(tooltipTrigger, itemConfig.tooltip_key, {}, { explicitThemeContext: themeId, viewContext: 'game' });
            }
        }
    });

    const rightContainer = dom.characterProgressionPanel.querySelector('.character-info-right');
    if(rightContainer) {
        const loreBtn = rightContainer.querySelector('#char-panel-lore-button');
        const invBtn = rightContainer.querySelector('#char-panel-inventory-button');
        const traitsBtn = rightContainer.querySelector('#char-panel-traits-button');
        if (loreBtn) attachTooltip(loreBtn, 'tooltip_lore_button');
        if (invBtn) attachTooltip(invBtn, 'tooltip_inventory_button');
        if (traitsBtn) attachTooltip(traitsBtn, 'tooltip_traits_button');
    }

    log(LOG_LEVEL_DEBUG, "Character panel labels and tooltips re-translated.");
    updateCharacterPanel(); // Refresh values which might include translated text
}

/**
 * Shows a modal with the character's acquired traits.
 * @private
 */
function _showTraitsModal() {
    const themeId = state.getCurrentTheme();
    if (!themeId) {
        log(LOG_LEVEL_WARN, "_showTraitsModal called without an active theme.");
        return;
    }
    const acquiredTraitKeys = state.getAcquiredTraitKeys();
    const allThemeTraits = getThemeTraits(themeId);
    const lang = state.getCurrentAppLanguage();
    const titleKey = "modal_title_acquired_traits";
    const content = document.createElement('div');
    content.className = 'traits-modal-content';

    if (acquiredTraitKeys && acquiredTraitKeys.length > 0 && allThemeTraits) {
        const list = document.createElement('ul');
        list.className = 'traits-list';
        acquiredTraitKeys.forEach(traitKey => {
            const traitDefinition = allThemeTraits[traitKey];
            if (traitDefinition) {
                const localizedTrait = traitDefinition[lang] || traitDefinition['en']; // Fallback to English
                if (localizedTrait) {
                    const listItem = document.createElement('li');
                    listItem.className = 'trait-item';
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'trait-name';
                    nameSpan.textContent = localizedTrait.name;
                    const descSpan = document.createElement('span');
                    descSpan.className = 'trait-description';
                    descSpan.textContent = localizedTrait.description;
                    listItem.appendChild(nameSpan);
                    listItem.appendChild(descSpan);
                    list.appendChild(listItem);
                } else {
                    log(LOG_LEVEL_WARN, `Localized data for trait key '${traitKey}' not found for lang '${lang}'.`);
                }
            } else {
                 log(LOG_LEVEL_WARN, `Data for acquired trait key '${traitKey}' not found in theme's parsed traits.`);
            }
        });
        content.appendChild(list);
    } else {
        const noTraitsP = document.createElement('p');
        noTraitsP.textContent = getUIText('traits_none_acquired', {}, { explicitThemeContext: themeId, viewContext: 'game' });
        content.appendChild(noTraitsP);
    }
    modalManager.showCustomModal({
        type: 'custom',
        titleKey: titleKey,
        htmlContent: content,
        customActions: [{ textKey: 'modal_ok_button', className: 'ui-button primary', onClick: () => modalManager.hideCustomModal() }]
    });
}
/**
 * Shows a placeholder modal for the inventory.
 * @private
 */
function _showInventoryModal() {
    modalManager.showCustomModal({
        type: 'alert',
        titleKey: 'modal_title_inventory',
        messageKey: 'inventory_not_implemented_message'
    });
}

/**
 * Shows a modal with the current Evolved World Lore and any unlocked World Fragments.
 * @private
 */
async function _showLoreModal() {
    const themeId = state.getCurrentTheme();
    const currentUser = state.getCurrentUser();
    const themeConfig = getThemeConfig(themeId);
    if (!themeConfig) return;

    const themeDisplayName = getUIText(themeConfig.name_key, {}, { explicitThemeContext: themeId });
    const modalContent = document.createElement('div');
    modalContent.className = 'lore-modal-content';
    modalContent.textContent = getUIText('system_processing_short'); // Loading indicator

    modalManager.showCustomModal({
        type: 'custom',
        titleKey: 'modal_title_world_lore',
        replacements: { THEME_NAME: themeDisplayName },
        htmlContent: modalContent,
        customActions: [{ textKey: 'modal_ok_button', className: 'ui-button primary', onClick: () => modalManager.hideCustomModal() }]
    });

    try {
        const baseLore = getUIText(themeConfig.lore_key, {}, { explicitThemeContext: themeId, viewContext: 'game' });
        let shards = [];
        if (currentUser && currentUser.token) {
            const shardsResponse = await apiService.fetchWorldShards(currentUser.token, themeId);
            shards = shardsResponse.worldShards || [];
        }

        modalContent.innerHTML = ''; // Clear loading text

        // Base Lore Section
        const loreSection = document.createElement('div');
        loreSection.className = 'lore-section';
        const loreTitle = document.createElement('h4');
        loreTitle.className = 'lore-section-title';
        loreTitle.textContent = getUIText('lore_modal_base_lore_title');
        const loreText = document.createElement('p');
        loreText.className = 'lore-text-content';
        loreText.textContent = baseLore;
        loreSection.appendChild(loreTitle);
        loreSection.appendChild(loreText);
        modalContent.appendChild(loreSection);

        // World Fragments Section
        const fragmentsSection = document.createElement('div');
        fragmentsSection.className = 'lore-section';
        const fragmentsTitle = document.createElement('h4');
        fragmentsTitle.className = 'lore-section-title';
        fragmentsTitle.textContent = getUIText('lore_modal_fragments_title');
        fragmentsSection.appendChild(fragmentsTitle);

        if (shards.length > 0) {
            const list = document.createElement('ul');
            list.className = 'lore-fragments-list';
            shards.sort((a, b) => new Date(a.unlockedAt) - new Date(b.unlockedAt));
            shards.forEach(shard => {
                const listItem = document.createElement('li');
                listItem.className = 'shard-item-readonly';
                const titleDiv = document.createElement('div');
                titleDiv.className = 'shard-title';
                titleDiv.textContent = shard.loreFragmentTitle;
                if (!shard.isActiveForNewGames) {
                    titleDiv.style.opacity = '0.6';
                    const inactiveIndicator = document.createElement('span');
                    inactiveIndicator.textContent = ' (Inactive)';
                    inactiveIndicator.style.fontStyle = 'italic';
                    titleDiv.appendChild(inactiveIndicator);
                }
                const contentDiv = document.createElement('div');
                contentDiv.className = 'shard-content';
                contentDiv.textContent = shard.loreFragmentContent;
                listItem.appendChild(titleDiv);
                listItem.appendChild(contentDiv);
                list.appendChild(listItem);
            });
            fragmentsSection.appendChild(list);
        } else {
            const noFragmentsP = document.createElement('p');
            noFragmentsP.textContent = getUIText('lore_modal_no_fragments_unlocked');
            fragmentsSection.appendChild(noFragmentsP);
        }
        modalContent.appendChild(fragmentsSection);

    } catch (error) {
        log(LOG_LEVEL_ERROR, "Failed to load lore/shards for modal:", error);
        modalManager.displayModalError(getUIText("error_api_call_failed", { ERROR_MSG: error.message }), modalContent);
    }
}
