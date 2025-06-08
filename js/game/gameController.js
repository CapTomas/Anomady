// js/game/gameController.js
/**
 * @file Central orchestrator for the game flow. Manages transitions between
 * landing page and game view, starting new games, processing player actions,
 * and changing themes.
 */
import * as state from '../core/state.js';
import * as apiService from '../core/apiService.js'; // Used for fetching shards in _setupNewGameEnvironment
import * as themeService from '../services/themeService.js';
import * as aiService from '../services/aiService.js';
import * as localizationService from '../services/localizationService.js';
import * as authService from '../services/authService.js';
import * as dom from '../ui/domElements.js';
import * as uiUtils from '../ui/uiUtils.js';
import * as storyLogManager from '../ui/storyLogManager.js';
import { showLoadingIndicator, removeLoadingIndicator } from '../ui/storyLogManager.js';
import * as suggestedActionsManager from '../ui/suggestedActionsManager.js';
import * as dashboardManager from '../ui/dashboardManager.js';
import * as modalManager from '../ui/modalManager.js';
import * as landingPageManager from '../ui/landingPageManager.js';
import * as worldShardsModalManager from '../ui/worldShardsModalManager.js';
import { log, LOG_LEVEL_INFO, LOG_LEVEL_ERROR, LOG_LEVEL_WARN, LOG_LEVEL_DEBUG } from '../core/logger.js';
import { XP_LEVELS, MAX_PLAYER_LEVEL, BOON_DEFINITIONS } from '../core/config.js';
import * as characterPanelManager from '../ui/characterPanelManager.js';
import { getThemeTraits } from '../services/themeService.js';

let _deferredInitialActionText = null;
// Module-level state for managing multi-step boon selections
let _boonSelectionContext = {
    step: 'none', // 'none', 'primary', 'secondary_attribute', 'secondary_trait'
};
// Dependencies to be injected by app.js
let _userThemeControlsManagerRef = null;
/**
 * Loads the UserThemeProgress for the current user and theme, or initializes a default one.
 * @param {string} themeId - The ID of the theme.
 * @private
 */
async function _loadOrCreateUserThemeProgress(themeId) {
    const currentUser = state.getCurrentUser();
    let progressData;
    if (currentUser && currentUser.token) {
        try {
            log(LOG_LEVEL_DEBUG, `Fetching UserThemeProgress for user ${currentUser.email}, theme ${themeId}.`);
            const response = await apiService.fetchUserThemeProgress(currentUser.token, themeId);
            progressData = response.userThemeProgress; // Assumes API returns this structure
            if (!progressData || progressData.userId !== currentUser.id) { // Basic validation if API returns "default" for new
                log(LOG_LEVEL_WARN, `No progress found or mismatch for user ${currentUser.email}, theme ${themeId}. Initializing default.`);
                progressData = {
                    userId: currentUser.id,
                    themeId: themeId,
                    level: 1,
                    currentXP: 0,
                    maxIntegrityBonus: 0,
                    maxWillpowerBonus: 0,
                    aptitudeBonus: 0,
                    resilienceBonus: 0,
                    acquiredTraitKeys: [],
                };
            }
        } catch (error) {
            log(LOG_LEVEL_ERROR, `Error fetching UserThemeProgress for ${themeId}, user ${currentUser.email}. Initializing default. Error:`, error.message);
            progressData = { // Default structure on error
                userId: currentUser.id,
                themeId: themeId,
                level: 1,
                currentXP: 0,
                maxIntegrityBonus: 0,
                maxWillpowerBonus: 0,
                aptitudeBonus: 0,
                resilienceBonus: 0,
                acquiredTraitKeys: [],
            };
        }
    } else {
        log(LOG_LEVEL_INFO, `No user logged in. Initializing default UserThemeProgress for theme ${themeId}.`);
        progressData = { // Default for anonymous or uninitialized
            level: 1,
            currentXP: 0,
            maxIntegrityBonus: 0,
            maxWillpowerBonus: 0,
            aptitudeBonus: 0,
            resilienceBonus: 0,
            acquiredTraitKeys: [],
        };
    }
    state.setCurrentUserThemeProgress(progressData);
    log(LOG_LEVEL_DEBUG, `UserThemeProgress set in state for theme ${themeId}:`, progressData);
}
/**
 * Initializes current run stats (Integrity, Willpower) based on effective maximums.
 * @private
 */
async function _initializeCurrentRunStats() {
    const maxIntegrity = state.getEffectiveMaxIntegrity();
    const maxWillpower = state.getEffectiveMaxWillpower();
    state.setCurrentRunStats({
        currentIntegrity: maxIntegrity,
        currentWillpower: maxWillpower,
        strainLevel: 1,
        conditions: [],
    });
    log(LOG_LEVEL_DEBUG, `Current run stats initialized: IG ${maxIntegrity}, WP ${maxWillpower}, Strain 1`);
}
/**
 * Handles XP gain and checks for level-ups.
 * If a level-up occurs, it sets the boon selection pending state and triggers boon choice presentation.
 * @param {number} xpAwarded - The amount of XP awarded this turn.
 * @private
 */
async function _handleExperienceAndLevelUp(xpAwarded) {
    if (xpAwarded <= 0) return;
    const currentUserThemeProgress = state.getCurrentUserThemeProgress();
    if (!currentUserThemeProgress) {
        log(LOG_LEVEL_ERROR, "Cannot process XP: currentUserThemeProgress is null.");
        return;
    }
    currentUserThemeProgress.currentXP += xpAwarded;
    characterPanelManager.animateXpGain(xpAwarded);
    let currentLevel = currentUserThemeProgress.level;
    if (currentLevel >= MAX_PLAYER_LEVEL) {
        log(LOG_LEVEL_INFO, `Player already at max level (${MAX_PLAYER_LEVEL}). Current XP: ${currentUserThemeProgress.currentXP}`);
    } else {
        let xpForNextLevel = XP_LEVELS[currentLevel];
        if (currentUserThemeProgress.currentXP >= xpForNextLevel) {
            state.setLastAiSuggestedActions(state.getCurrentSuggestedActions());
            state.setIsBoonSelectionPending(true);
            storyLogManager.addMessageToLog(
                localizationService.getUIText("system_level_up", { NEW_LEVEL: currentLevel + 1 }),
                "system-emphasized"
            );
            log(LOG_LEVEL_INFO, `Level up condition met for level ${currentLevel + 1}. Boon selection pending.`);
            state.setCurrentUserThemeProgress(currentUserThemeProgress);
            await authService.saveCurrentGameState();
            _presentPrimaryBoonChoices();
        }
    }
    state.setCurrentUserThemeProgress(currentUserThemeProgress);
    characterPanelManager.updateCharacterPanel();
}
/**
 * Presents the primary Boon selection choices to the player.
 * @private
 */
async function _presentPrimaryBoonChoices() {
    _boonSelectionContext.step = 'primary';
    const headerText = localizationService.getUIText("system_boon_selection_prompt");
    const boonChoices = [
        {
            text: localizationService.getUIText(BOON_DEFINITIONS.MAX_INTEGRITY_INCREASE.descriptionKey, { VALUE: BOON_DEFINITIONS.MAX_INTEGRITY_INCREASE.value }),
            isBoonChoice: true,
            boonId: 'PRIMARY_MAX_IG'
        },
        {
            text: localizationService.getUIText('boon_primary_choose_attribute'),
            isBoonChoice: true,
            boonId: 'PRIMARY_ATTR_ENH'
        },
        {
            text: localizationService.getUIText('boon_primary_choose_trait'),
            isBoonChoice: true,
            boonId: 'PRIMARY_NEW_TRAIT'
        }
    ];
    suggestedActionsManager.displaySuggestedActions(boonChoices, { headerText });
    if (dom.playerActionInput) {
        dom.playerActionInput.placeholder = localizationService.getUIText("placeholder_boon_selection");
        state.setCurrentAiPlaceholder(dom.playerActionInput.placeholder);
    }
    uiUtils.setGMActivityIndicator(false);
    uiUtils.setPlayerInputEnabled(false); // Prevent typing during boon choice
}
/**
 * Presents the secondary Boon selection choices (attributes or traits).
 * @param {'attribute'|'trait'} type - The type of secondary choice to present.
 * @private
 */
function _presentSecondaryBoonChoices(type) {
    const themeId = state.getCurrentTheme();
    const lang = state.getCurrentAppLanguage();
    let secondaryChoices = [];
    if (type === 'attribute') {
        _boonSelectionContext.step = 'secondary_attribute';
        secondaryChoices.push({
            text: localizationService.getUIText('boon_desc_aptitude_increase', { VALUE: 4 }),
            isBoonChoice: true,
            boonId: 'SECONDARY_APTITUDE'
        });
        secondaryChoices.push({
            text: localizationService.getUIText('boon_desc_resilience_increase', { VALUE: 4 }),
            isBoonChoice: true,
            boonId: 'SECONDARY_RESILIENCE'
        });
    } else if (type === 'trait') {
        _boonSelectionContext.step = 'secondary_trait';
        const allThemeTraits = getThemeTraits(themeId);
        const acquiredTraitKeys = state.getAcquiredTraitKeys();
        if (!allThemeTraits) {
            log(LOG_LEVEL_ERROR, `Cannot offer trait boon: No traits defined for theme ${themeId}.`);
            storyLogManager.addMessageToLog("SYSTEM ERROR: Trait definitions for this theme are missing. Please choose another Boon.", "system-error");
            _presentPrimaryBoonChoices();
            return;
        }
        const availableTraitKeys = Object.keys(allThemeTraits).filter(key => !acquiredTraitKeys.includes(key));
        if (availableTraitKeys.length === 0) {
            storyLogManager.addMessageToLog("No new traits available. Please choose another Boon.", "system-error");
            _presentPrimaryBoonChoices(); // Go back to primary choices
            return;
        }
        const traitsToOffer = availableTraitKeys.sort(() => 0.5 - Math.random()).slice(0, 3);
        traitsToOffer.forEach(traitKey => {
            const traitData = allThemeTraits[traitKey];
            if (traitData && (traitData[lang] || traitData['en'])) {
                const localizedTrait = traitData[lang] || traitData['en'];
                const name = localizedTrait.name;
                const description = localizedTrait.description;
                secondaryChoices.push({
                    text: `${name}: ${description}`, // Full text for matching
                    displayText: name, // For button text
                    descriptionForTooltip: description, // For tooltip
                    isBoonChoice: true,
                    boonId: `TRAIT_${traitKey.toUpperCase()}`
                });
            }
        });
    }
    suggestedActionsManager.displaySuggestedActions(secondaryChoices);
    uiUtils.setPlayerInputEnabled(false); // Prevent typing during boon choice

}
/**
 * Finalizes the boon application by calling the API and updating the UI.
 * @param {object} payload - The boon payload for the API.
 * @param {string} boonDisplayText - The display text of the chosen boon for logging.
 * @private
 */
async function _applyBoonAndFinalize(payload, boonDisplayText) {
    uiUtils.setGMActivityIndicator(true);
    storyLogManager.showLoadingIndicator();
    try {
        const currentUser = state.getCurrentUser();
        const themeId = state.getCurrentTheme();
        if (!currentUser || !currentUser.token || !themeId) {
            throw new Error("User or theme context lost during Boon finalization.");
        }
        const response = await apiService.applyBoonSelection(currentUser.token, themeId, payload);
        state.setCurrentUserThemeProgress(response.userThemeProgress);
        state.setIsBoonSelectionPending(false);
        _boonSelectionContext.step = 'none';
        _initializeCurrentRunStats();
        characterPanelManager.updateCharacterPanel();
        const restoredActions = state.getLastAiSuggestedActions();
        state.setCurrentSuggestedActions(restoredActions || []);
        suggestedActionsManager.displaySuggestedActions(state.getCurrentSuggestedActions());
        uiUtils.setPlayerInputEnabled(true);
        if (dom.playerActionInput) {
            dom.playerActionInput.placeholder = state.getCurrentAiPlaceholder() || localizationService.getUIText("placeholder_command");
            dom.playerActionInput.focus();
        }
        await authService.saveCurrentGameState();
    } catch (error) {
        log(LOG_LEVEL_ERROR, "Error applying Boon:", error);
        storyLogManager.addMessageToLog(localizationService.getUIText("error_api_call_failed", { ERROR_MSG: error.message || "Failed to apply Boon." }), "system system-error");
        _presentPrimaryBoonChoices();
    } finally {
        uiUtils.setGMActivityIndicator(false);
        storyLogManager.removeLoadingIndicator();
    }
}
/**
 * Handles the player's Boon selection.
 * @param {string} boonId - The ID of the selected Boon (e.g., "PRIMARY_MAX_IG").
 * @param {string} boonDisplayText - The display text of the boon, for logging.
 * @private
 */
async function _handleBoonSelection(boonId, boonDisplayText) {
    log(LOG_LEVEL_INFO, `Handling boon selection (Step: ${_boonSelectionContext.step}) for choice: ${boonId}`);
    const step = _boonSelectionContext.step;
    if (step === 'primary') {
        switch (boonId) {
            case 'PRIMARY_MAX_IG':
                await _applyBoonAndFinalize({
                    boonType: "MAX_ATTRIBUTE_INCREASE",
                    targetAttribute: "maxIntegrityBonus",
                    value: BOON_DEFINITIONS.MAX_INTEGRITY_INCREASE.value
                }, boonDisplayText);
                break;
            case 'PRIMARY_ATTR_ENH':
                _presentSecondaryBoonChoices('attribute');
                break;
            case 'PRIMARY_NEW_TRAIT':
                _presentSecondaryBoonChoices('trait');
                break;
            default:
                log(LOG_LEVEL_WARN, `Invalid primary boon ID: ${boonId}`);
                break;
        }
    } else if (step === 'secondary_attribute') {
        let payload;
        if (boonId === 'SECONDARY_APTITUDE') {
            payload = { boonType: "ATTRIBUTE_ENHANCEMENT", targetAttribute: "aptitudeBonus", value: 4 };
        } else if (boonId === 'SECONDARY_RESILIENCE') {
            payload = { boonType: "ATTRIBUTE_ENHANCEMENT", targetAttribute: "resilienceBonus", value: 4 };
        }
        if (payload) {
            await _applyBoonAndFinalize(payload, boonDisplayText);
        }
    } else if (step === 'secondary_trait') {
        if (boonId.startsWith('TRAIT_')) {
            const traitKey = boonId.replace('TRAIT_', '').toLowerCase();
            const payload = { boonType: "NEW_TRAIT", value: traitKey };
            // For logging, we only want the name, not the full description
            const traitName = boonDisplayText.split(':')[0];
            await _applyBoonAndFinalize(payload, traitName);
        }
    }
}
/**
 * Presents the initial trait selection choices to a new character.
 * @private
 */
function _presentInitialTraitChoices() {
    const headerText = localizationService.getUIText("system_initial_trait_selection_prompt");
    const themeId = state.getCurrentTheme();
    const lang = state.getCurrentAppLanguage();
    const allTraits = getThemeTraits(themeId);
    if (!allTraits) {
        log(LOG_LEVEL_ERROR, `No traits found for theme ${themeId}. Skipping initial trait selection.`);
        processPlayerAction(_deferredInitialActionText, true);
        return;
    }
    const traitKeys = Object.keys(allTraits);
    const traitsToOffer = traitKeys.sort(() => 0.5 - Math.random()).slice(0, 3);
    const traitChoices = traitsToOffer.map(key => {
        const traitData = allTraits[key][lang] || allTraits[key]['en'];
        const name = traitData.name;
        const description = traitData.description;
        return {
            text: `${name}: ${description}`, // Full text for matching
            displayText: name, // For button text
            descriptionForTooltip: description, // For tooltip
            isTraitChoice: true,
            traitKey: key
        };
    });
    suggestedActionsManager.displaySuggestedActions(traitChoices, { headerText });
    if (dom.playerActionInput) {
        dom.playerActionInput.placeholder = localizationService.getUIText("placeholder_boon_selection");
        state.setCurrentAiPlaceholder(dom.playerActionInput.placeholder);
    }
    uiUtils.setGMActivityIndicator(false);
    uiUtils.setPlayerInputEnabled(false); // Prevent typing during trait choice
}
/**
 * Handles the player's initial trait selection and starts the game.
 * @param {string} traitKey - The key of the selected trait.
 * @private
 */
async function _handleInitialTraitSelection(traitKey) {
    uiUtils.setGMActivityIndicator(true);
    storyLogManager.showLoadingIndicator();
    const progress = state.getCurrentUserThemeProgress();
    if (progress) {
        progress.acquiredTraitKeys = [traitKey];
        state.setCurrentUserThemeProgress(progress);
    } else {
        log(LOG_LEVEL_ERROR, "Cannot set initial trait: UserThemeProgress is not initialized.");
        uiUtils.setGMActivityIndicator(false);
        storyLogManager.removeLoadingIndicator();
        return;
    }
    state.setIsInitialTraitSelectionPending(false);
    uiUtils.setPlayerInputEnabled(true);
    log(LOG_LEVEL_INFO, `Initial trait '${traitKey}' selected. Proceeding to start game narrative.`);
    if (_deferredInitialActionText) {
        await processPlayerAction(_deferredInitialActionText, true);
        _deferredInitialActionText = null; // Clear after use
    } else {
        log(LOG_LEVEL_ERROR, "Deferred initial action text was missing after trait selection.");
        uiUtils.setGMActivityIndicator(false);
        storyLogManager.removeLoadingIndicator();
    }
}
/**
 * Initializes the GameController with necessary dependencies.
 * @param {object} dependencies - Object containing references to other modules.
 * @param {object} dependencies.userThemeControlsManager - Reference to userThemeControlsManager.
 */
export function initGameController(dependencies) {
    if (dependencies.userThemeControlsManager) {
        _userThemeControlsManagerRef = dependencies.userThemeControlsManager;
    } else {
        log(LOG_LEVEL_WARN, "GameController initialized without userThemeControlsManager dependency.");
    }
    log(LOG_LEVEL_INFO, "GameController initialized.");
}
/**
 * Internal helper to set up UI for a new game after theme selection and world type choice.
 * This function prepares the environment for the player to enter their identifier.
 * @param {string} themeId - The ID of the theme to start.
 * @private
 */
async function _setupNewGameEnvironment(themeId) {
    log(LOG_LEVEL_INFO, `Setting up new game environment for theme: ${themeId}. Player will be prompted for identifier.`);
    state.setCurrentTheme(themeId);
    const dataLoaded = await themeService.ensureThemeDataLoaded(themeId);
    if (!dataLoaded) {
        log(LOG_LEVEL_ERROR, `Critical data for theme ${themeId} failed to load for new game.`);
        modalManager.showCustomModal({type: "alert", titleKey: "alert_title_error", messageKey: "error_theme_data_load_failed", replacements: { THEME_ID: themeId }});
        await switchToLanding();
        return;
    }
    // Preload all necessary text files
    await themeService.getAllPromptsForTheme(themeId);
    await themeService.ensureThemeDataLoaded("master");
    await themeService.getAllPromptsForTheme("master");
    // This will fetch and cache traits.json if it's in the config
    await themeService.fetchAndCachePromptFile(themeId, 'traits');
    state.clearVolatileGameState();
    state.setIsInitialGameLoad(true);
    state.setCurrentPromptType("initial");
    log(LOG_LEVEL_DEBUG, "Clearing UI components for new game environment...");
    storyLogManager.clearStoryLogDOM();
    suggestedActionsManager.clearSuggestedActions();
    dashboardManager.resetDashboardUI(themeId);
    await _loadOrCreateUserThemeProgress(themeId);
    _initializeCurrentRunStats();
    characterPanelManager.updateCharacterPanel();
    characterPanelManager.showCharacterPanel(true);
    characterPanelManager.showXPBar(true);
    landingPageManager.switchToGameView(themeId);
    if (_userThemeControlsManagerRef && typeof _userThemeControlsManagerRef.setThemeAsPlaying === 'function') {
        await _userThemeControlsManagerRef.setThemeAsPlaying(themeId);
    } else {
        log(LOG_LEVEL_WARN, "UserThemeControlsManager not available in _setupNewGameEnvironment. Cannot set theme as playing.");
    }
    state.setPlayerIdentifier("");
    if (dom.nameInputSection) dom.nameInputSection.style.display = "flex";
    if (dom.actionInputSection) dom.actionInputSection.style.display = "none";
    if (dom.playerIdentifierInput) {
        dom.playerIdentifierInput.value = "";
        dom.playerIdentifierInput.placeholder = localizationService.getUIText("placeholder_name_login");
        dom.playerIdentifierInput.focus();
    }
    storyLogManager.addMessageToLog(localizationService.getUIText("alert_identifier_required"), "system");
    log(LOG_LEVEL_INFO, `UI configured for new game in theme ${themeId}. Awaiting player identifier input.`);
}
/**
 * Handles player identifier submission for anonymous users.
 * @param {string} identifier - The player's chosen identifier.
 */
export async function handleIdentifierSubmission(identifier) {
    log(LOG_LEVEL_INFO, `Player identifier submitted: ${identifier}`);
    if (!identifier || identifier.trim() === "") {
        storyLogManager.addMessageToLog(localizationService.getUIText("alert_identifier_required"), "system system-error");
        if (dom.playerIdentifierInput) dom.playerIdentifierInput.focus();
        return;
    }
    state.setPlayerIdentifier(identifier);
    if (dom.nameInputSection) dom.nameInputSection.style.display = "none";
    if (dom.actionInputSection) dom.actionInputSection.style.display = "flex";
    if (dom.playerActionInput) {
        dom.playerActionInput.placeholder = localizationService.getUIText("placeholder_command");
        state.setCurrentAiPlaceholder(dom.playerActionInput.placeholder);
        dom.playerActionInput.value = "";
        dom.playerActionInput.dispatchEvent(new Event("input", { bubbles: true }));
        dom.playerActionInput.focus();
    }
    const currentThemeId = state.getCurrentTheme();
    const themeDisplayName = currentThemeId
        ? (themeService.getThemeConfig(currentThemeId)?.name_key
            ? localizationService.getUIText(themeService.getThemeConfig(currentThemeId).name_key, {}, { explicitThemeContext: currentThemeId })
            : currentThemeId)
        : "Unknown Theme";
    const newGameSettings = state.getCurrentNewGameSettings();
    const useEvolvedWorld = newGameSettings ? newGameSettings.useEvolvedWorld : false;
    _deferredInitialActionText = `Start game as "${identifier}". Theme: ${themeDisplayName}. Evolved World: ${useEvolvedWorld}.`;
    state.clearCurrentNewGameSettings();
    const progress = state.getCurrentUserThemeProgress();
    if (progress && progress.level === 1 && progress.currentXP === 0 && progress.acquiredTraitKeys.length === 0) {
        state.setIsInitialTraitSelectionPending(true);
        _presentInitialTraitChoices();
    } else {
        await processPlayerAction(_deferredInitialActionText, true);
        _deferredInitialActionText = null;
    }
}
/**
 * Initializes a new game session after user confirmation and world type choice.
 * @param {string} themeId - The ID of the theme to start.
 * @param {boolean} [skipConfirmation=false] - If true, skips the confirmation dialog for overwriting an existing game.
 */
export async function initiateNewGameSessionFlow(themeId, skipConfirmation = false) {
    log(LOG_LEVEL_INFO, `Initiating new game session flow for theme: ${themeId}. Skip confirmation: ${skipConfirmation}`);
    const currentUser = state.getCurrentUser();
    const themeConfig = themeService.getThemeConfig(themeId);
    const themeDisplayName = themeConfig?.name_key
        ? localizationService.getUIText(themeConfig.name_key, {}, { explicitThemeContext: themeId })
        : themeId;
    let needsConfirmation = false;
    if (!skipConfirmation) {
        if (currentUser && state.getPlayingThemes().includes(themeId)) {
            needsConfirmation = true;
        } else if (!currentUser && state.getCurrentTheme() === themeId && state.getGameHistory().length > 0) {
            needsConfirmation = true;
        }
    }

    if (needsConfirmation) {
        const themeSpecificMessageKey = `confirm_new_game_message_${themeId.toLowerCase()}`;
        let messageKeyToUse = themeSpecificMessageKey;
        const testThemeMessage = localizationService.getUIText(themeSpecificMessageKey, { THEME_NAME: themeDisplayName }, { explicitThemeContext: themeId });
        if (testThemeMessage === themeSpecificMessageKey) {
             messageKeyToUse = "confirm_new_game_message_theme";
        }
        const confirmed = await modalManager.showGenericConfirmModal({
            titleKey: "confirm_new_game_title_theme",
            messageKey: messageKeyToUse,
            replacements: { THEME_NAME: themeDisplayName },
            explicitThemeContext: themeId
        });
        if (!confirmed) {
            log(LOG_LEVEL_INFO, "User cancelled starting new game.");
            return;
        }
        log(LOG_LEVEL_INFO, "User confirmed starting new game. Proceeding to delete old state if any.");
    }
    if (currentUser && currentUser.token) {
        try {
            log(LOG_LEVEL_DEBUG, `New game flow for logged-in user. Attempting to delete any existing game state for theme ${themeId}.`);
            await apiService.deleteGameState(currentUser.token, themeId);
            log(LOG_LEVEL_INFO, `Existing game state for theme ${themeId} (if any) deleted from backend.`);
        } catch (error) {
            if (error.status === 404 && error.code === 'GAME_STATE_NOT_FOUND_FOR_DELETE') {
                log(LOG_LEVEL_INFO, `No existing game state found on backend for theme ${themeId} to delete. Proceeding with new game.`);
            } else {
                log(LOG_LEVEL_WARN, `Could not delete existing game state for theme ${themeId} on backend. Proceeding with new game, but an old save might persist:`, error.message);
            }
        }
    }
    const themeStatus = currentUser ? state.getShapedThemeData().get(themeId) : null;
    let useEvolvedWorld = false;
    if (currentUser && themeStatus && themeStatus.hasShards && themeStatus.activeShardCount > 0) {
        log(LOG_LEVEL_INFO, `User has ${themeStatus.activeShardCount} active shards for theme ${themeId}. Setting up Evolved World.`);
        useEvolvedWorld = true;
    } else {
        log(LOG_LEVEL_INFO, `No active shards for theme ${themeId}, or user not logged in/no shards. Setting up Original World.`);
        useEvolvedWorld = false;
    }
    state.setCurrentNewGameSettings({ useEvolvedWorld });
    await _setupNewGameEnvironment(themeId);
}
/**
 * Resumes an existing game session for the given theme.
 * If no saved game is found, it initiates a new game flow.
 * @param {string} themeId - The ID of the theme to resume.
 */
export async function resumeGameSession(themeId) {
    log(LOG_LEVEL_INFO, `Attempting to resume game session for theme: ${themeId}`);
    state.setCurrentTheme(themeId);
    const dataLoaded = await themeService.ensureThemeDataLoaded(themeId);
    if (!dataLoaded) {
        log(LOG_LEVEL_ERROR, `Critical data for theme ${themeId} failed to load for resume.`);
        await modalManager.showCustomModal({type: "alert", titleKey: "alert_title_error", messageKey: "error_theme_data_load_failed", replacements: { THEME_ID: themeId }});
        await switchToLanding();
        return;
    }
    await themeService.getAllPromptsForTheme(themeId);
    await themeService.ensureThemeDataLoaded("master");
    await themeService.getAllPromptsForTheme("master");
    await themeService.fetchAndCachePromptFile(themeId, 'traits'); // Ensure traits are loaded
    landingPageManager.switchToGameView(themeId);
    dashboardManager.generatePanelsForTheme(themeId);
    const currentUser = state.getCurrentUser();
    if (currentUser && currentUser.token) {
        try {
            const loadedData = await apiService.loadGameState(currentUser.token, themeId);
            if (loadedData.userThemeProgress) {
                state.setCurrentUserThemeProgress(loadedData.userThemeProgress);
            } else {
                await _loadOrCreateUserThemeProgress(themeId);
            }
            // Initialize run stats to max values first
            await _initializeCurrentRunStats();
            // Now, apply the loaded percentages and other stats
            const lastUpdates = loadedData.last_dashboard_updates || {};
            const statsToUpdate = { ...state.getCurrentRunStats() }; // Start with a fresh object with max values
            const maxIntegrity = state.getEffectiveMaxIntegrity();
            const maxWillpower = state.getEffectiveMaxWillpower();
            if (lastUpdates.healthPct !== undefined) {
                const pct = parseInt(lastUpdates.healthPct, 10);
                if (!isNaN(pct)) {
                    statsToUpdate.currentIntegrity = Math.min(maxIntegrity, Math.round((pct / 100) * maxIntegrity));
                }
            }
            if (lastUpdates.staminaPct !== undefined) {
                const pct = parseInt(lastUpdates.staminaPct, 10);
                if (!isNaN(pct)) {
                    statsToUpdate.currentWillpower = Math.min(maxWillpower, Math.round((pct / 100) * maxWillpower));
                }
            }
            if (lastUpdates.strain_level !== undefined) {
                const newStrain = parseInt(lastUpdates.strain_level, 10);
                if (!isNaN(newStrain)) statsToUpdate.strainLevel = newStrain;
            }
            if (lastUpdates.conditions_list !== undefined) {
                statsToUpdate.conditions = Array.isArray(lastUpdates.conditions_list) ? lastUpdates.conditions_list : [];
            }
            state.setCurrentRunStats(statsToUpdate); // Apply the fully calculated stats
            characterPanelManager.updateCharacterPanel();
            characterPanelManager.showCharacterPanel(true);
            characterPanelManager.showXPBar(true);
            if (!loadedData.player_identifier) {
                log(LOG_LEVEL_WARN, `Loaded game state for theme ${themeId} is missing player_identifier. Using user email.`);
                state.setPlayerIdentifier(currentUser.email);
            } else {
                state.setPlayerIdentifier(loadedData.player_identifier);
            }
            state.setGameHistory(loadedData.game_history || []);
            state.setLastKnownDashboardUpdates(lastUpdates);
            state.setLastKnownGameStateIndicators(loadedData.last_game_state_indicators || {});
            state.setCurrentPromptType(loadedData.current_prompt_type || "default");
            state.setCurrentNarrativeLanguage(loadedData.current_narrative_language || state.getCurrentAppLanguage());
            state.setCurrentSuggestedActions(loadedData.last_suggested_actions || []);
            state.setLastAiSuggestedActions(loadedData.actions_before_boon_selection || null);
            state.setCurrentPanelStates(loadedData.panel_states || {});
            state.setCurrentAiPlaceholder(loadedData.input_placeholder || localizationService.getUIText("placeholder_command"));
            state.setDashboardItemMeta(loadedData.dashboard_item_meta || {});
            state.setLastKnownCumulativePlayerSummary(loadedData.game_history_summary || "");
            state.setLastKnownEvolvedWorldLore(loadedData.game_history_lore || "");
            state.setIsBoonSelectionPending(loadedData.is_boon_selection_pending || false);
            storyLogManager.clearStoryLogDOM();
            state.getGameHistory().forEach(turn => {
                if (turn.role === "user") {
                    storyLogManager.renderMessage(turn.parts[0].text, "player");
                } else if (turn.role === "model") {
                    try {
                        const modelResponse = JSON.parse(turn.parts[0].text);
                        storyLogManager.renderMessage(modelResponse.narrative, "gm");
                        if (modelResponse.isDeepDive) log(LOG_LEVEL_DEBUG, "Repopulating deep dive msg.");
                    } catch (e) {
                        log(LOG_LEVEL_ERROR, "Error parsing model response from loaded history:", e, turn.parts[0].text);
                        storyLogManager.addMessageToLog(localizationService.getUIText("error_reconstruct_story"), "system system-error");
                    }
                } else if (turn.role === "system_log") {
                    storyLogManager.renderMessage(turn.parts[0].text, turn.senderTypes || "system");
                }
            });
            dashboardManager.updateDashboard(state.getLastKnownDashboardUpdates(), false);
            handleGameStateIndicatorsChange(state.getLastKnownGameStateIndicators(), true);
            dashboardManager.applyPersistedItemMeta();
            suggestedActionsManager.displaySuggestedActions(state.getCurrentSuggestedActions());
            state.setIsInitialGameLoad(false);
            if (dom.nameInputSection) dom.nameInputSection.style.display = "none";
            if (dom.actionInputSection) dom.actionInputSection.style.display = "flex";
            if (state.getIsBoonSelectionPending()) {
                log(LOG_LEVEL_INFO, "Resuming game with a pending Boon selection.");
                _presentPrimaryBoonChoices();
            } else {
                 if (dom.playerActionInput) {
                    dom.playerActionInput.placeholder = state.getCurrentAiPlaceholder();
                    dom.playerActionInput.value = "";
                    dom.playerActionInput.dispatchEvent(new Event("input", { bubbles: true }));
                    dom.playerActionInput.focus();
                }
            }
            log(LOG_LEVEL_INFO, `Session resumed for player ${state.getPlayerIdentifier()}, theme ${themeId}.`);
        } catch (error) {
            if (_userThemeControlsManagerRef) _userThemeControlsManagerRef.updateTopbarThemeIcons();
            if (error.status === 404 && (error.code === 'GAME_STATE_NOT_FOUND' || error.code === 'USER_THEME_PROGRESS_NOT_FOUND')) {
                log(LOG_LEVEL_INFO, `No game state or progress found for theme '${themeId}'. Starting new game flow without confirmation.`);
                await initiateNewGameSessionFlow(themeId, true); // Pass true to skip confirmation
            } else {
                log(LOG_LEVEL_ERROR, `Error loading game state or progress for ${themeId}:`, error.message);
                storyLogManager.addMessageToLog(localizationService.getUIText("error_api_call_failed", { ERROR_MSG: `Could not load game: ${error.message}` }), "system system-error");
                // Also skip confirmation on other load errors to avoid getting stuck in a loop.
                await initiateNewGameSessionFlow(themeId, true);
            }
        }
    } else {
        log(LOG_LEVEL_INFO, "User not logged in. Cannot load. Initiating new game flow for anonymous user.");
        await initiateNewGameSessionFlow(themeId);
    }
    characterPanelManager.updateCharacterPanel();
}
/**
 * Processes the player's action, sends it to the AI, and updates the UI.
 * @param {string} actionText - The text of the player's action.
 * @param {boolean} [isGameStartingAction=false] - True if this is the automatic "Start game as..." action.
 */
export async function processPlayerAction(actionText, isGameStartingAction = false) {
    log(LOG_LEVEL_INFO, `Processing player action: "${actionText.substring(0, 50)}..." (isGameStartingAction: ${isGameStartingAction})`);
    if (state.getIsInitialTraitSelectionPending()) {
        const traitAction = state.getCurrentSuggestedActions().find(
            action => (typeof action === 'object' && action.text === actionText && action.isTraitChoice)
        );
        if (traitAction && traitAction.traitKey) {
            await _handleInitialTraitSelection(traitAction.traitKey);
        } else {
             storyLogManager.addMessageToLog(localizationService.getUIText("error_invalid_boon_choice"), "system system-error");
            _presentInitialTraitChoices(); // Re-present choices if input was invalid
        }
        return; // Stop processing here, _handleInitialTraitSelection will trigger the next step
    }
    if (state.getIsBoonSelectionPending()) {
        const boonAction = state.getCurrentSuggestedActions().find(
            action => (typeof action === 'object' && action.text === actionText && action.isBoonChoice)
        );
        if (boonAction && boonAction.boonId) {
            await _handleBoonSelection(boonAction.boonId, boonAction.text);
        } else {
            storyLogManager.addMessageToLog(localizationService.getUIText("error_invalid_boon_choice"), "system system-error");
            if (_boonSelectionContext.step.startsWith('secondary')) {
                 _presentSecondaryBoonChoices(_boonSelectionContext.step.replace('secondary_', ''));
            } else {
                 _presentPrimaryBoonChoices();
            }
        }
        return;
    }
    let worldShardsPayloadForInitialTurn = "[]";
    if (isGameStartingAction) {
        const newGameSettings = state.getCurrentNewGameSettings();
        if (newGameSettings && newGameSettings.useEvolvedWorld) {
            const currentUser = state.getCurrentUser();
            const currentThemeId = state.getCurrentTheme();
            if (currentUser && currentUser.token && currentThemeId) {
                try {
                    const shardsResponse = await apiService.fetchWorldShards(currentUser.token, currentThemeId);
                    if (shardsResponse && shardsResponse.worldShards) {
                        const activeShards = shardsResponse.worldShards
                            .filter(shard => shard.isActiveForNewGames)
                            .map(shard => ({
                                loreFragmentKey: shard.loreFragmentKey,
                                loreFragmentTitle: shard.loreFragmentTitle,
                                loreFragmentContent: shard.loreFragmentContent,
                                unlockConditionDescription: shard.unlockConditionDescription
                            }));
                        if (activeShards.length > 0) {
                            worldShardsPayloadForInitialTurn = JSON.stringify(activeShards);
                            log(LOG_LEVEL_INFO, `Prepared ${activeShards.length} active shards for initial prompt.`);
                        }
                    }
                } catch (error) {
                    log(LOG_LEVEL_ERROR, "Failed to fetch world shards for initial turn:", error);
                }
            }
        }
    }
    if (!isGameStartingAction) {
        if (state.getGameHistory().length > 0) {
            storyLogManager.renderMessage(actionText, "player");
        }
        state.addTurnToGameHistory({ role: "user", parts: [{ text: actionText }] });
        if (dom.playerActionInput) {
            dom.playerActionInput.value = "";
            dom.playerActionInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
    }
    uiUtils.setGMActivityIndicator(true);
    suggestedActionsManager.clearSuggestedActions();
    state.resetAllDashboardItemRecentUpdates();
    dashboardManager.clearAllDashboardItemDotClasses();
    storyLogManager.showLoadingIndicator();
    try {
        const fullAiResponse = await aiService.processAiTurn(actionText, worldShardsPayloadForInitialTurn);
        storyLogManager.removeLoadingIndicator();
        if (fullAiResponse) {
            const updatesFromAI = fullAiResponse.dashboard_updates || {};
            if (updatesFromAI.conditions_update) {
                let currentConditions = state.getActiveConditions();
                const { add = [], remove = [] } = updatesFromAI.conditions_update;
                if (Array.isArray(add) && add.length > 0) {
                    currentConditions = [...new Set([...currentConditions, ...add])];
                }
                if (Array.isArray(remove) && remove.length > 0) {
                    currentConditions = currentConditions.filter(c => !remove.includes(c));
                }
                state.updateCurrentRunStat('conditions', currentConditions);
                updatesFromAI.conditions_list = currentConditions;
                delete updatesFromAI.conditions_update;
                state.setLastKnownDashboardUpdates(updatesFromAI); // Update state before UI update
            }
            storyLogManager.renderMessage(fullAiResponse.narrative, "gm");
            dashboardManager.updateDashboard(state.getLastKnownDashboardUpdates());
            characterPanelManager.updateCharacterPanel();
            suggestedActionsManager.displaySuggestedActions(state.getCurrentSuggestedActions());
            handleGameStateIndicatorsChange(state.getLastKnownGameStateIndicators());
            if (dom.playerActionInput) {
                dom.playerActionInput.placeholder = state.getCurrentAiPlaceholder() || localizationService.getUIText("placeholder_command");
            }
            if (fullAiResponse.xp_awarded > 0) {
                await _handleExperienceAndLevelUp(fullAiResponse.xp_awarded);
            }
            if (!state.getIsBoonSelectionPending()) {
                await authService.saveCurrentGameState();
            }
        } else {
             if (dom.playerActionInput && !state.getCurrentAiPlaceholder()) {
                 dom.playerActionInput.placeholder = localizationService.getUIText("placeholder_command");
            }
        }
    } catch (error) {
        storyLogManager.removeLoadingIndicator();
        log(LOG_LEVEL_ERROR, "Error during AI turn processing in gameController:", error.message, error);
        storyLogManager.addMessageToLog(localizationService.getUIText("error_api_call_failed", { ERROR_MSG: error.message }), "system system-error");
        if (dom.playerActionInput) dom.playerActionInput.placeholder = localizationService.getUIText("placeholder_command");
    } finally {
        if (!state.getIsBoonSelectionPending() && !state.getIsInitialTraitSelectionPending()) {
            uiUtils.setGMActivityIndicator(false);
        }
    }
}
/**
 * Changes the active game theme.
 * @param {string} newThemeId - The ID of the theme to switch to.
 * @param {boolean} [forceNewGame=false] - If true, forces a new game start.
 */
export async function changeActiveTheme(newThemeId, forceNewGame = false) {
    log(LOG_LEVEL_INFO, `Changing active theme to: ${newThemeId}, Force new: ${forceNewGame}`);
    const currentActiveTheme = state.getCurrentTheme();
    try {
        if (currentActiveTheme && currentActiveTheme !== newThemeId && state.getCurrentUser()) {
            log(LOG_LEVEL_DEBUG, `Saving game state for current theme: ${currentActiveTheme}`);
            await authService.saveCurrentGameState();
            log(LOG_LEVEL_DEBUG, `Save operation for ${currentActiveTheme} completed in changeActiveTheme.`);
        } else if (currentActiveTheme === newThemeId && !forceNewGame) {
            log(LOG_LEVEL_INFO, `Theme ${newThemeId} is already active and not forcing new game. Ensuring view.`);
            if (document.body.classList.contains("landing-page-active")) {
                landingPageManager.switchToGameView(newThemeId);
                dashboardManager.updateDashboard(state.getLastKnownDashboardUpdates(), false);
                suggestedActionsManager.displaySuggestedActions(state.getCurrentSuggestedActions());
                characterPanelManager.updateCharacterPanel();
                characterPanelManager.showCharacterPanel(true);
                if (dom.playerActionInput && dom.actionInputSection && dom.actionInputSection.style.display !== 'none') {
                    dom.playerActionInput.focus();
                }
            }
            if (_userThemeControlsManagerRef) _userThemeControlsManagerRef.updateTopbarThemeIcons();
            return;
        }
        log(LOG_LEVEL_DEBUG, `Proceeding to load data for new theme: ${newThemeId}`);
        const dataLoaded = await themeService.ensureThemeDataLoaded(newThemeId);
        if (!dataLoaded) {
            log(LOG_LEVEL_ERROR, `Critical data for new theme ${newThemeId} failed to load.`);
            await modalManager.showCustomModal({type: "alert", titleKey: "alert_title_error", messageKey: "error_theme_data_load_failed", replacements: { THEME_ID: newThemeId }});
            throw new Error(`Failed to load critical data for theme ${newThemeId}.`);
        }
        log(LOG_LEVEL_DEBUG, `Data loaded for ${newThemeId}. Loading prompts...`);
        await themeService.getAllPromptsForTheme(newThemeId);
        await themeService.ensureThemeDataLoaded("master");
        await themeService.getAllPromptsForTheme("master");
        log(LOG_LEVEL_DEBUG, `Prompts loaded for ${newThemeId} and master.`);
        try {
            if (forceNewGame) {
                log(LOG_LEVEL_DEBUG, `Initiating new game flow for ${newThemeId}.`);
                await initiateNewGameSessionFlow(newThemeId);
            } else {
                log(LOG_LEVEL_DEBUG, `Resuming game session for ${newThemeId}.`);
                await resumeGameSession(newThemeId);
            }
            log(LOG_LEVEL_DEBUG, `Game session setup (new/resume) completed for ${newThemeId}.`);
        } catch (sessionError) {
            log(LOG_LEVEL_ERROR, `Error during session setup (new/resume) for ${newThemeId}:`, sessionError.message, sessionError);
            throw sessionError;
        }
    } catch (error) {
        log(LOG_LEVEL_ERROR, `Error within changeActiveTheme for ${newThemeId}:`, error.message, error.code, error.details, error);
        throw error;
    } finally {
        if (_userThemeControlsManagerRef) {
            log(LOG_LEVEL_DEBUG, `changeActiveTheme finally block: Updating topbar icons. Current theme in state after logic: ${state.getCurrentTheme()}`);
            _userThemeControlsManagerRef.updateTopbarThemeIcons();
        }
        characterPanelManager.updateCharacterPanel();
        const themeActive = state.getCurrentTheme() !== null;
        characterPanelManager.showCharacterPanel(themeActive);
        characterPanelManager.showXPBar(themeActive);
        log(LOG_LEVEL_DEBUG, `changeActiveTheme finally block: Character panel updated. Visible: ${state.getCurrentTheme() !== null}`);
    }
}
/**
 * Handles changes in game state indicators received from the AI.
 * This function is responsible for updating UI based on these flags,
 * such as showing/hiding conditional panels, and determining the next prompt type.
 * @param {object} newIndicators - The new set of game state indicators.
 * @param {boolean} [isInitialBoot=false] - True if this is part of initial game load/resume.
 */
export function handleGameStateIndicatorsChange(newIndicators, isInitialBoot = false) {
    if (!newIndicators || typeof newIndicators !== 'object') {
        log(LOG_LEVEL_WARN, "handleGameStateIndicatorsChange called with invalid indicators:", newIndicators);
        return;
    }
    const currentThemeId = state.getCurrentTheme();
    if (!currentThemeId) {
        log(LOG_LEVEL_WARN, "No current theme set, cannot process game state indicators.");
        return;
    }
    log(LOG_LEVEL_DEBUG, "Handling game state indicators change:", newIndicators);
    state.setLastKnownGameStateIndicators(newIndicators); // Update state
    const themeCfgFull = themeService.getThemeConfig(currentThemeId);
    if (!themeCfgFull || !themeCfgFull.dashboard_config) {
        log(LOG_LEVEL_WARN, `Dashboard config for theme ${currentThemeId} not found. Cannot react to indicators.`);
        return;
    }
    const dashboardConfig = themeCfgFull.dashboard_config;
    const allThemePanels = [...(dashboardConfig.left_panel || []), ...(dashboardConfig.right_panel || [])];
    allThemePanels.forEach(panelCfg => {
        if (panelCfg.type === "hidden_until_active" && panelCfg.indicator_key) {
            const panelBox = document.getElementById(panelCfg.id);
            if (panelBox) {
                const shouldShow = newIndicators[panelCfg.indicator_key] === true;
                const isCurrentlyVisible = panelBox.style.display !== "none" && (parseFloat(panelBox.style.opacity || "0") > 0 || panelBox.classList.contains('is-expanded'));
                if (shouldShow && !isCurrentlyVisible) {
                    const delay = isInitialBoot && panelCfg.boot_delay ? panelCfg.boot_delay : 0;
                    setTimeout(() => dashboardManager.animatePanelExpansion(panelCfg.id, true, true, isInitialBoot), delay);
                } else if (!shouldShow && isCurrentlyVisible) {
                    dashboardManager.animatePanelExpansion(panelCfg.id, false, true, isInitialBoot);
                }
            }
        }
    });
    let newPromptTypeForAI = "default";
    let highestPriorityFound = -1;
    if (dashboardConfig.game_state_indicators && Array.isArray(dashboardConfig.game_state_indicators)) {
        for (const indicatorConfig of dashboardConfig.game_state_indicators) {
            const indicatorId = indicatorConfig.id;
            if (newIndicators[indicatorId] === true) {
                const promptText = themeService.getLoadedPromptText(currentThemeId, indicatorId);
                if (promptText && !promptText.startsWith("ERROR:") && !promptText.startsWith("HELPER_FILE_NOT_FOUND:")) {
                    const priority = indicatorConfig.priority || 0;
                    if (priority > highestPriorityFound) {
                        highestPriorityFound = priority;
                        newPromptTypeForAI = indicatorId;
                    }
                } else {
                    log(LOG_LEVEL_DEBUG, `Indicator '${indicatorId}' is true, but no valid prompt file found for it. Defaulting behavior.`);
                }
            }
        }
    }
    if (state.getCurrentPromptType() !== newPromptTypeForAI) {
        state.setCurrentPromptType(newPromptTypeForAI);
        log(LOG_LEVEL_INFO, `Switched to prompt type: ${newPromptTypeForAI} (Priority: ${highestPriorityFound > -1 ? highestPriorityFound : "default"})`);
    }
    requestAnimationFrame(() => {
        if (dom.leftPanel && !document.body.classList.contains("landing-page-active")) dashboardManager.updateScrollIndicators('left');
        if (dom.rightPanel && !document.body.classList.contains("landing-page-active")) dashboardManager.updateScrollIndicators('right');
    });
}
/**
 * Switches the UI to the landing page view.
 * Orchestrates saving the current game (if any), clearing game-specific state,
 * and then delegates to landingPageManager to handle the actual UI transition.
 */
export async function switchToLanding() {
    log(LOG_LEVEL_INFO, "Attempting to switch to landing view from game controller.");
    const currentActiveTheme = state.getCurrentTheme();
    if (currentActiveTheme && state.getCurrentUser()) {
        log(LOG_LEVEL_DEBUG, `Game was active for theme ${currentActiveTheme}. Saving state.`);
        await authService.saveCurrentGameState();
    }
    state.clearVolatileGameState();
    storyLogManager.clearStoryLogDOM();
    state.setCurrentTheme(null);
    state.setIsInitialGameLoad(true);
    state.setIsBoonSelectionPending(false);
    await landingPageManager.switchToLandingView();
    characterPanelManager.showCharacterPanel(false);
    characterPanelManager.showXPBar(false);
    if (_userThemeControlsManagerRef) {
        _userThemeControlsManagerRef.updateTopbarThemeIcons();
    }
    log(LOG_LEVEL_INFO, "Switched to landing view. Game session state cleared.");
}
/**
 * Public interface for worldShardsModalManager to call from landing page,
 * or potentially from within a game if a "Configure Shards" button is added there.
 * @param {string} themeId - The theme ID for which to show the shards modal.
 */
export function showConfigureShardsModal(themeId) {
    worldShardsModalManager.showConfigureShardsModal(themeId);
}
/**
 * Public interface for characterPanelManager to show the character progress modal.
 * @param {string} themeId - The theme ID for which to show the progress modal.
 */
export function showCharacterProgressModal(themeId) {
    characterPanelManager.showCharacterProgressModal(themeId);
}
