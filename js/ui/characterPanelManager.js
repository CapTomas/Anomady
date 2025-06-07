// js/ui/characterPanelManager.js
/**
 * @file Manages the display and updates of the character progression panel.
 * This includes character name, level, core attributes (Integrity, Willpower, Aptitude, Resilience),
 * and the XP bar.
 */
import * as dom from './domElements.js';
import * as state from '../core/state.js';
import { getUIText } from '../services/localizationService.js';
import { XP_LEVELS, MAX_PLAYER_LEVEL } from '../core/config.js'; // For XP bar calculation
import { log, LOG_LEVEL_DEBUG, LOG_LEVEL_INFO, LOG_LEVEL_WARN } from '../core/logger.js';
import { attachTooltip } from './tooltipManager.js';
import * as modalManager from './modalManager.js';
import { getThemeConfig } from '../services/themeService.js';

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
 * Shows a modal with the character's acquired traits.
 * @private
 */
function _showTraitsModal() {
    const themeId = state.getCurrentTheme();
    const traits = state.getAcquiredTraitKeys();

    const titleKey = "modal_title_acquired_traits";
    const content = document.createElement('div');
    content.className = 'traits-modal-content';

    if (traits && traits.length > 0) {
        const list = document.createElement('ul');
        list.className = 'traits-list';
        traits.forEach(traitKey => {
            const traitName = getUIText(`trait_name_${traitKey}`, {}, { explicitThemeContext: themeId, viewContext: 'game' });
            const traitDesc = getUIText(`trait_desc_${traitKey}`, {}, { explicitThemeContext: themeId, viewContext: 'game' });

            const listItem = document.createElement('li');
            listItem.className = 'trait-item';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'trait-name';
            nameSpan.textContent = traitName;

            const descSpan = document.createElement('span');
            descSpan.className = 'trait-description';
            descSpan.textContent = traitDesc;

            listItem.appendChild(nameSpan);
            listItem.appendChild(descSpan);
            list.appendChild(listItem);
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
 * Creates the icon buttons for Inventory and Traits.
 * @private
 */
function _createIconButtons() {
    const rightContainer = dom.characterProgressionPanel.querySelector('.character-info-right');
    if (!rightContainer) return;

    rightContainer.innerHTML = ''; // Clear it first

    // Inventory Button
    const inventoryButton = document.createElement('button');
    inventoryButton.id = 'char-panel-inventory-button';
    inventoryButton.className = 'ui-button icon-button';
    inventoryButton.innerHTML = `<img src="images/app/icon_inventory.svg" alt="Inventory">`;
    attachTooltip(inventoryButton, "tooltip_inventory_button");
    inventoryButton.addEventListener('click', _showInventoryModal);
    rightContainer.appendChild(inventoryButton);

    // Traits Button
    const traitsButton = document.createElement('button');
    traitsButton.id = 'char-panel-traits-button';
    traitsButton.className = 'ui-button icon-button';
    traitsButton.innerHTML = `<img src="images/app/icon_traits.svg" alt="Traits">`;
    attachTooltip(traitsButton, "tooltip_traits_button");
    traitsButton.addEventListener('click', _showTraitsModal);
    rightContainer.appendChild(traitsButton);
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
    const strainItemConfig = themeConfig.dashboard_config.left_panel.flatMap(p => p.items).find(item => item.id === 'strain_level');
    const levelConfig = strainItemConfig?.level_mappings?.[String(strainLevel)];

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
 * Creates the static DOM structure for advanced panel elements (Strain).
 * This should be called only once during initialization.
 * @private
 */
function _createAdvancedPanelElements() {
    if (!characterProgressionPanel) return;
    const leftContainer = characterProgressionPanel.querySelector('.character-info-left');

    if (leftContainer && !document.getElementById('cp-item-strain')) {
        const strainItem = document.createElement('div');
        strainItem.id = 'cp-item-strain';
        strainItem.className = 'attribute-item';
        // Use a div for the status icon, which we will style with a mask
        strainItem.innerHTML = `<div id="char-panel-strain-icon" class="attribute-value status-icon"></div>`;

        // This element will be moved by initCharacterPanelManager
        leftContainer.appendChild(strainItem);
    }

    _createIconButtons();

    log(LOG_LEVEL_DEBUG, "Advanced character panel elements created.");
}


/**
 * Creates the static tooltip trigger icons within the character panel.
 * This should be called only once during initialization.
 * @private
 */
function _setupCharacterPanelTooltips() {
    if (!characterProgressionPanel) return;
    // Exclude 'strain' as its tooltip is handled dynamically by updateCharacterPanel
    const attributeContainers = {
        integrity: characterProgressionPanel.querySelector('#cp-item-integrity'),
        willpower: characterProgressionPanel.querySelector('#cp-item-willpower'),
        aptitude: characterProgressionPanel.querySelector('#cp-item-aptitude'),
        resilience: characterProgressionPanel.querySelector('#cp-item-resilience'),
    };
    for (const attr in attributeContainers) {
        const container = attributeContainers[attr];
        if (container) {
            const oldIcon = container.querySelector('.info-tooltip-trigger');
            if (oldIcon) oldIcon.remove();
            const tooltipIcon = document.createElement('span');
            tooltipIcon.className = 'info-tooltip-trigger';
            tooltipIcon.setAttribute('role', 'button');
            tooltipIcon.setAttribute('tabindex', '0');
            container.appendChild(tooltipIcon);
        }
    }
    log(LOG_LEVEL_DEBUG, "Character panel tooltip triggers created.");
}

/**
 * Initializes the CharacterPanelManager.
 * Ensures the panel and XP bar are initially hidden, restructures the DOM for the new layout,
 * and creates tooltip triggers.
 */
export function initCharacterPanelManager() {
    _createAdvancedPanelElements();

    // Restructure the DOM for the new flex layout
    const leftContainer = dom.characterProgressionPanel?.querySelector('.character-info-left');
    const strainItem = document.getElementById('cp-item-strain');

    if (leftContainer && dom.charPanelIdentifier && dom.charPanelLevel) {
        const identityBlock = document.createElement('div');
        identityBlock.className = 'char-panel-identity-block';

        // Move existing elements into the new wrapper
        identityBlock.appendChild(dom.charPanelIdentifier);
        identityBlock.appendChild(dom.charPanelLevel);
        leftContainer.appendChild(identityBlock);

        // Prepend the strain item to appear first
        if (strainItem) {
            leftContainer.prepend(strainItem);
        }
    }

    // Add click listener to the strain icon
    const strainIcon = document.getElementById('char-panel-strain-icon');
    if (strainIcon) {
        strainIcon.addEventListener('click', _showStrainDetailsModal);
    }

    _setupCharacterPanelTooltips();
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
 * Animates the XP bar and text to show experience gain.
 * Creates a floating text popup for the amount gained and flashes the XP bar text.
 * @param {number} xpGained - The amount of experience points gained.
 */
export function animateXpGain(xpGained) {
    if (!xpBarContainer || !xpBarText || xpGained <= 0) {
        return;
    }
    // 1. Create and animate the floating XP number popup
    const popup = document.createElement('div');
    popup.className = 'xp-gain-popup';
    popup.textContent = `+${xpGained} XP`;
    document.body.appendChild(popup);
    const textRect = xpBarText.getBoundingClientRect();
    // Position popup in the middle of the xp-bar-text element to start its animation from there
    popup.style.left = `${textRect.left}px`;
    popup.style.top = `${textRect.top}px`;
    // Remove the popup after its animation finishes (3s from CSS)
    setTimeout(() => {
        if (document.body.contains(popup)) {
            document.body.removeChild(popup);
        }
    }, 3000);
    // 2. Flash the XP bar text
    xpBarText.classList.add('updated');
    // Remove the class after the animation finishes (3s from CSS)
    setTimeout(() => {
        if (document.body.contains(xpBarText)) {
            xpBarText.classList.remove('updated');
        }
    }, 3000);
}

/**
 * Updates the character progression panel and XP bar with the latest data from the state.
 */
export function updateCharacterPanel() {
    if (!characterProgressionPanel) {
        log(LOG_LEVEL_WARN, "Character panel DOM element not found, skipping update.");
        return;
    }
    if (characterProgressionPanel.style.display === 'none') {
        log(LOG_LEVEL_DEBUG, "Character panel is hidden, skipping DOM update.");
        return;
    }
    const playerIdentifier = state.getPlayerIdentifier() || getUIText(charPanelIdentifier?.dataset.langKey || "char_panel_placeholder_name");
    const userProgress = state.getCurrentUserThemeProgress();
    const runStats = state.getCurrentRunStats();
    const themeId = state.getCurrentTheme();
    const themeConfig = themeId ? getThemeConfig(themeId) : null;
    const level = userProgress ? userProgress.level : 1;
    const currentXP = userProgress ? userProgress.currentXP : 0;
    const maxIntegrity = state.getEffectiveMaxIntegrity();
    const currentIntegrity = runStats.currentIntegrity !== undefined ? runStats.currentIntegrity : maxIntegrity;
    const maxWillpower = state.getEffectiveMaxWillpower();
    const currentWillpower = runStats.currentWillpower !== undefined ? runStats.currentWillpower : maxWillpower;
    const aptitude = state.getEffectiveAptitude();
    const resilience = state.getEffectiveResilience();
    const strainLevel = state.getCurrentStrainLevel();
    if (charPanelIdentifier) charPanelIdentifier.textContent = playerIdentifier;
    if (charPanelLevel) charPanelLevel.textContent = `${getUIText("char_panel_label_level")} ${level}`;
    if (charPanelIntegrityValue) charPanelIntegrityValue.textContent = `${currentIntegrity}/${maxIntegrity}`;
    if (charPanelIntegrityMeter) {
        const integrityPercentage = maxIntegrity > 0 ? (currentIntegrity / maxIntegrity) * 100 : 0;
        charPanelIntegrityMeter.style.width = `${Math.max(0, Math.min(100, integrityPercentage))}%`;
        charPanelIntegrityMeter.className = 'attribute-meter-bar';
        if (integrityPercentage <= 25) charPanelIntegrityMeter.classList.add('meter-low');
        else if (integrityPercentage <= 50) charPanelIntegrityMeter.classList.add('meter-medium');
        else charPanelIntegrityMeter.classList.add('meter-full');
        charPanelIntegrityMeter.style.backgroundColor = '';
        if (integrityPercentage > 50) charPanelIntegrityMeter.classList.add('integrity-full');
    }
    if (charPanelWillpowerValue) charPanelWillpowerValue.textContent = `${currentWillpower}/${maxWillpower}`;
    if (charPanelWillpowerMeter) {
        const willpowerPercentage = maxWillpower > 0 ? (currentWillpower / maxWillpower) * 100 : 0;
        charPanelWillpowerMeter.style.width = `${Math.max(0, Math.min(100, willpowerPercentage))}%`;
        charPanelWillpowerMeter.className = 'attribute-meter-bar';
        if (willpowerPercentage <= 25) charPanelWillpowerMeter.classList.add('meter-low');
        else if (willpowerPercentage <= 50) charPanelWillpowerMeter.classList.add('meter-medium');
        else charPanelWillpowerMeter.classList.add('meter-full');
        charPanelWillpowerMeter.style.backgroundColor = '';
        if (willpowerPercentage > 50) charPanelWillpowerMeter.classList.add('willpower-full');
    }
    if (charPanelAptitudeValue) charPanelAptitudeValue.textContent = String(aptitude);
    if (charPanelResilienceValue) charPanelResilienceValue.textContent = String(resilience);
    const strainIconEl = document.getElementById('char-panel-strain-icon');
    if (strainIconEl && themeConfig) {
        const strainItemConfig = themeConfig?.dashboard_config?.left_panel?.flatMap(p => p.items).find(item => item.id === 'strain_level');
        if (strainItemConfig && strainItemConfig.type === 'status_icon' && strainItemConfig.level_mappings) {
            const levelConfig = strainItemConfig.level_mappings[String(strainLevel)];
            if (levelConfig) {
                strainIconEl.style.webkitMaskImage = `url(${levelConfig.icon_path})`;
                strainIconEl.style.maskImage = `url(${levelConfig.icon_path})`;
                const tooltipText = getUIText(levelConfig.display_text_key, {}, { explicitThemeContext: themeId });
                strainIconEl.setAttribute('aria-label', tooltipText);
                attachTooltip(strainIconEl, levelConfig.display_text_key, {}, { explicitThemeContext: themeId });
                const newClass = levelConfig.css_class || 'status-info';

                // Create a copy of the class list to iterate over, as we are modifying it.
                for (const className of [...strainIconEl.classList]) {
                    // Remove any status color class that is not the correct new one.
                    // This specifically excludes 'status-icon' to prevent it from being removed.
                    if (className.startsWith('status-') && className !== 'status-icon' && className !== newClass) {
                        strainIconEl.classList.remove(className);
                    }
                }
                // Add the new class if it's not already present.
                if (!strainIconEl.classList.contains(newClass)) {
                    strainIconEl.classList.add(newClass);
                }
            }
        }
    }
    if (xpBarContainer && xpBarFill && xpBarText) {
        const xpForCurrentLevel = XP_LEVELS[level - 1] || 0;
        const xpForNextLevel = (level < XP_LEVELS.length) ? XP_LEVELS[level] : currentXP;
        const xpIntoCurrentLevel = currentXP - xpForCurrentLevel;
        const xpNeededForThisLevel = xpForNextLevel - xpForCurrentLevel;
        let xpPercentage = 0;
        if (level >= XP_LEVELS.length) {
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
    const themeId = state.getCurrentTheme();
    const themeConfig = themeId ? getThemeConfig(themeId) : null;
    const attributeTooltips = themeConfig?.attribute_tooltips || {};
    const labelMappings = {
        "integrity": {
            labelEl: dom.characterProgressionPanel?.querySelector('#cp-item-integrity .attribute-label'),
            iconEl: dom.characterProgressionPanel?.querySelector('#cp-item-integrity .info-tooltip-trigger'),
            textKey: "char_panel_label_integrity",
            tooltipKey: attributeTooltips.integrity
        },
        "willpower": {
            labelEl: dom.characterProgressionPanel?.querySelector('#cp-item-willpower .attribute-label'),
            iconEl: dom.characterProgressionPanel?.querySelector('#cp-item-willpower .info-tooltip-trigger'),
            textKey: "char_panel_label_willpower",
            tooltipKey: attributeTooltips.willpower
        },
        "aptitude": {
            labelEl: dom.characterProgressionPanel?.querySelector('#cp-item-aptitude .attribute-label'),
            iconEl: dom.characterProgressionPanel?.querySelector('#cp-item-aptitude .info-tooltip-trigger'),
            textKey: "char_panel_label_aptitude",
            tooltipKey: attributeTooltips.aptitude
        },
        "resilience": {
            labelEl: dom.characterProgressionPanel?.querySelector('#cp-item-resilience .attribute-label'),
            iconEl: dom.characterProgressionPanel?.querySelector('#cp-item-resilience .info-tooltip-trigger'),
            textKey: "char_panel_label_resilience",
            tooltipKey: attributeTooltips.resilience
        }
    };
    for (const attr in labelMappings) {
        const mapping = labelMappings[attr];
        if (mapping.labelEl) {
            mapping.labelEl.textContent = getUIText(mapping.textKey);
        }
        if (mapping.iconEl && mapping.tooltipKey && themeId) {
            attachTooltip(mapping.iconEl, mapping.tooltipKey, {}, { explicitThemeContext: themeId, viewContext: 'game' });
        }
    }

    // Note: Strain item no longer has a text label to translate.
    // Its tooltip is updated dynamically in updateCharacterPanel.

    const inventoryButton = document.getElementById('char-panel-inventory-button');
    if (inventoryButton) {
        attachTooltip(inventoryButton, "tooltip_inventory_button");
    }
    const traitsButton = document.getElementById('char-panel-traits-button');
    if (traitsButton) {
        attachTooltip(traitsButton, "tooltip_traits_button");
    }

    if (dom.charPanelLevel) {
         const level = state.getCurrentUserThemeProgress() ? state.getCurrentUserThemeProgress().level : 1;
         dom.charPanelLevel.textContent = `${getUIText("char_panel_label_level")} ${level}`;
    }
    if (dom.charPanelIdentifier) {
        const playerIdentifier = state.getPlayerIdentifier();
        if (!playerIdentifier) {
            dom.charPanelIdentifier.textContent = getUIText(dom.charPanelIdentifier.dataset.langKey || "char_panel_placeholder_name");
        }
    }
    log(LOG_LEVEL_DEBUG, "Character panel labels and tooltips re-translated.");
    updateCharacterPanel();
}
