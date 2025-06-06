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
function _initializeCurrentRunStats() {
    const maxIntegrity = state.getEffectiveMaxIntegrity();
    const maxWillpower = state.getEffectiveMaxWillpower();

    state.setCurrentRunStats({
        currentIntegrity: maxIntegrity,
        currentWillpower: maxWillpower,
        // Strain will be added in Phase 3, e.g., currentStrainLevel: 1 (for "Calm")
    });
    log(LOG_LEVEL_DEBUG, `Current run stats initialized: IG ${maxIntegrity}, WP ${maxWillpower}`);
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
        // XP can accumulate beyond max level, no explicit capping here.
    } else {
        let xpForNextLevel = XP_LEVELS[currentLevel]; // XP needed to reach level (currentLevel + 1)
        // Check if current XP meets or exceeds the threshold for the *next* level.
        // Note: XP_LEVELS[currentLevel] is the total XP needed to *reach* level (currentLevel + 1).
        // A level up occurs if currentXP >= XP_LEVELS[currentLevel] (which is XP_LEVELS[nextLevel - 1])
        // AND the player is not yet at that next level.
        // Example: Level 1 (0 XP). Needs 100 for Level 2. XP_LEVELS[1] = 100.
        // If currentXP is 100, currentLevel is 1, xpForNextLevel (XP_LEVELS[1]) is 100.
        // 100 >= 100, so level up to 2.
        if (currentUserThemeProgress.currentXP >= xpForNextLevel) {
            // A level up condition is met.
            // The actual level increment will happen on the backend after boon selection.
            // Store the original suggested actions before overwriting them with boon choices.
            state.setLastAiSuggestedActions(state.getCurrentSuggestedActions());
            // Now, mark that a boon selection is pending.
            state.setIsBoonSelectionPending(true);
            storyLogManager.addMessageToLog(
                localizationService.getUIText("system_level_up", { NEW_LEVEL: currentLevel + 1 }), // Show the target level
                "system-emphasized"
            );
            log(LOG_LEVEL_INFO, `Level up condition met for level ${currentLevel + 1}. Boon selection pending.`);
            // Save game state *before* presenting boon choices to persist the pending state.
            log(LOG_LEVEL_DEBUG, "Saving game state due to level up condition met, before Boon selection.");
            state.setCurrentUserThemeProgress(currentUserThemeProgress); // Ensure currentXP is updated in state before save
            await authService.saveCurrentGameState(); // This will save currentXP and isBoonSelectionPending
            _presentBoonChoices(); // Present choices for the new level
        }
    }
    // Update local state with new XP. Level remains unchanged here; backend handles level increment.
    state.setCurrentUserThemeProgress(currentUserThemeProgress);
    characterPanelManager.updateCharacterPanel(); // Update UI
}

/**
 * Presents Boon selection choices to the player.
 * For Phase 2, this focuses on Max Attribute Increases.
 * @private
 */
function _presentBoonChoices() {
    storyLogManager.addMessageToLog(localizationService.getUIText("system_boon_selection_prompt"), "system");

    const boonChoices = [];
    // Example Boons for Phase 2: Max Attribute Increases
    boonChoices.push({
        text: localizationService.getUIText(BOON_DEFINITIONS.MAX_INTEGRITY_INCREASE.descriptionKey, { VALUE: BOON_DEFINITIONS.MAX_INTEGRITY_INCREASE.value }),
        id: "BOON_MAX_IG" // Identifier for processing
    });
    boonChoices.push({
        text: localizationService.getUIText(BOON_DEFINITIONS.MAX_WILLPOWER_INCREASE.descriptionKey, { VALUE: BOON_DEFINITIONS.MAX_WILLPOWER_INCREASE.value }),
        id: "BOON_MAX_WP"
    });
    // In Phase 3, we'd add more choices here, e.g., "Choose Attribute Enhancement", "Choose New Trait"
    // and then have sub-choices. For now, direct attribute boons.

    // Convert to simple strings for suggestedActionsManager if it only takes strings
    // Or, if suggestedActionsManager can take objects:
    const suggestedActionsObjects = boonChoices.map(choice => ({
        text: choice.text,
        isBoonChoice: true, // Custom flag
        boonId: choice.id   // ID to identify the boon
    }));

    suggestedActionsManager.displaySuggestedActions(suggestedActionsObjects);

    if (dom.playerActionInput) {
        dom.playerActionInput.placeholder = localizationService.getUIText("placeholder_boon_selection");
        state.setCurrentAiPlaceholder(dom.playerActionInput.placeholder); // Update stateful placeholder
    }
     uiUtils.setGMActivityIndicator(false); // Ensure player can interact
}

/**
 * Handles the player's Boon selection.
 * @param {string} boonId - The ID of the selected Boon (e.g., "BOON_MAX_IG").
 * @param {string} boonDisplayText - The display text of the boon, for logging.
 * @private
 */
async function _handleBoonSelection(boonId, boonDisplayText) {
    log(LOG_LEVEL_INFO, `Player selected Boon: ${boonId} ("${boonDisplayText}")`);
    uiUtils.setGMActivityIndicator(true);
    storyLogManager.showLoadingIndicator();
    let boonType;
    let targetAttribute;
    let value;
    // These boon definitions should ideally come from a shared config or be more dynamically handled
    // For now, direct mapping based on Phase 2 scope.
    if (boonId === "BOON_MAX_IG") {
        boonType = "MAX_ATTRIBUTE_INCREASE";
        targetAttribute = "maxIntegrityBonus";
        value = BOON_DEFINITIONS.MAX_INTEGRITY_INCREASE.value;
    } else if (boonId === "BOON_MAX_WP") {
        boonType = "MAX_ATTRIBUTE_INCREASE";
        targetAttribute = "maxWillpowerBonus";
        value = BOON_DEFINITIONS.MAX_WILLPOWER_INCREASE.value;
    } else {
        log(LOG_LEVEL_ERROR, `Invalid Boon ID selected: ${boonId}`);
        storyLogManager.addMessageToLog(localizationService.getUIText("error_generic_action_failed", { ACTION_NAME: "Boon Selection" }), "system system-error");
        _presentBoonChoices(); // Re-present choices
        uiUtils.setGMActivityIndicator(false);
        storyLogManager.removeLoadingIndicator();
        return;
    }
    try {
        const currentUser = state.getCurrentUser();
        const themeId = state.getCurrentTheme();
        if (!currentUser || !currentUser.token || !themeId) {
            throw new Error("User or theme context lost during Boon selection.");
        }
        const response = await apiService.applyBoonSelection(currentUser.token, themeId, {
            boonType,
            targetAttribute,
            value
        });
        // The backend now increments the level and returns the fully updated progress
        state.setCurrentUserThemeProgress(response.userThemeProgress);
        state.setIsBoonSelectionPending(false); // Boon selection is now complete
        storyLogManager.addMessageToLog(
            localizationService.getUIText("system_boon_applied", { BOON_TEXT: boonDisplayText }),
            "system-emphasized"
        );
        _initializeCurrentRunStats(); // Re-initialize run stats like current IG/WP based on new max values
        characterPanelManager.updateCharacterPanel(); // Update the UI with new level and stats

        // ** FIX APPLIED HERE **
        // Explicitly restore the previous suggested actions to the main state holder.
        const restoredActions = state.getLastAiSuggestedActions();
        state.setCurrentSuggestedActions(restoredActions || []);

        // Now, display the actions from the corrected state.
        suggestedActionsManager.displaySuggestedActions(state.getCurrentSuggestedActions());

        if (dom.playerActionInput) {
            dom.playerActionInput.placeholder = state.getCurrentAiPlaceholder() || localizationService.getUIText("placeholder_command");
            dom.playerActionInput.focus();
        }
        // Save game state *after* boon application to persist the new level and attribute bonuses.
        // This save will now correctly include the restored suggested_actions.
        log(LOG_LEVEL_DEBUG, "Saving game state after successful Boon application.");
        await authService.saveCurrentGameState();
    } catch (error) {
        log(LOG_LEVEL_ERROR, "Error applying Boon:", error);
        storyLogManager.addMessageToLog(localizationService.getUIText("error_api_call_failed", { ERROR_MSG: error.message || "Failed to apply Boon." }), "system system-error");
    } finally {
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

    // --- FIX: Ensure all theme data and prompts are loaded for a new game ---
    const dataLoaded = await themeService.ensureThemeDataLoaded(themeId);
    if (!dataLoaded) {
        log(LOG_LEVEL_ERROR, `Critical data for theme ${themeId} failed to load for new game.`);
        modalManager.showCustomModal({type: "alert", titleKey: "alert_title_error", messageKey: "error_theme_data_load_failed", replacements: { THEME_ID: themeId }});
        await switchToLanding();
        return;
    }
    await themeService.getAllPromptsForTheme(themeId);
    await themeService.ensureThemeDataLoaded("master");
    await themeService.getAllPromptsForTheme("master");

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
    characterPanelManager.showCharacterPanel(true); // Make sure it's visible
    characterPanelManager.showXPBar(true); // Also show XP bar
    landingPageManager.switchToGameView(themeId);
    if (_userThemeControlsManagerRef && typeof _userThemeControlsManagerRef.setThemeAsPlaying === 'function') {
        await _userThemeControlsManagerRef.setThemeAsPlaying(themeId);
    } else {
        log(LOG_LEVEL_WARN, "UserThemeControlsManager not available in _setupNewGameEnvironment. Cannot set theme as playing.");
    }
    const themeDisplayName = themeService.getThemeConfig(themeId)?.name_key
        ? localizationService.getUIText(themeService.getThemeConfig(themeId).name_key, {}, { explicitThemeContext: themeId })
        : themeId;
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
    storyLogManager.addMessageToLog(localizationService.getUIText("connecting", { PLAYER_ID: identifier }), "system");
    const currentThemeId = state.getCurrentTheme();
    const themeDisplayName = currentThemeId
        ? (themeService.getThemeConfig(currentThemeId)?.name_key
            ? localizationService.getUIText(themeService.getThemeConfig(currentThemeId).name_key, {}, { explicitThemeContext: currentThemeId })
            : currentThemeId)
        : "Unknown Theme";
    const newGameSettings = state.getCurrentNewGameSettings();
    const useEvolvedWorld = newGameSettings ? newGameSettings.useEvolvedWorld : false;
    const initialActionText = `Start game as "${identifier}". Theme: ${themeDisplayName}. Evolved World: ${useEvolvedWorld}.`;

    // Clear the new game settings from state now that they've been used
    state.clearCurrentNewGameSettings();
    await processPlayerAction(initialActionText, true); // true for isGameStartingAction
}

/**
 * Initializes a new game session after user confirmation and world type selection.
 * @param {string} themeId - The ID of the theme to start.
 */
/**
 * Initializes a new game session after user confirmation and world type selection.
 * @param {string} themeId - The ID of the theme to start.
 */
export async function initiateNewGameSessionFlow(themeId) {
    log(LOG_LEVEL_INFO, `Initiating new game session flow for theme: ${themeId}`);
    const currentUser = state.getCurrentUser();
    const themeConfig = themeService.getThemeConfig(themeId);
    const themeDisplayName = themeConfig?.name_key
        ? localizationService.getUIText(themeConfig.name_key, {}, { explicitThemeContext: themeId })
        : themeId;

    // Determine if confirmation is needed
    let needsConfirmation = false;
    if (currentUser && state.getPlayingThemes().includes(themeId)) {
        // Logged-in user has a saved/playing state for this theme
        needsConfirmation = true;
    } else if (!currentUser && state.getCurrentTheme() === themeId && state.getGameHistory().length > 0) {
        // Anonymous user has active progress in this specific theme
        needsConfirmation = true;
    }

    if (needsConfirmation) {
        const themeSpecificMessageKey = `confirm_new_game_message_${themeId.toLowerCase()}`;
        let messageKeyToUse = themeSpecificMessageKey;

        const testThemeMessage = localizationService.getUIText(themeSpecificMessageKey, { THEME_NAME: themeDisplayName }, { explicitThemeContext: themeId });
        if (testThemeMessage === themeSpecificMessageKey) { // Key not found in theme's texts.json
             messageKeyToUse = "confirm_new_game_message_theme"; // Fallback to global
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
    landingPageManager.switchToGameView(themeId);
    dashboardManager.generatePanelsForTheme(themeId);
    const currentUser = state.getCurrentUser();
    if (currentUser && currentUser.token) {
        try {
            const loadedData = await apiService.loadGameState(currentUser.token, themeId);
            // Set UserThemeProgress first
            if (loadedData.userThemeProgress) {
                state.setCurrentUserThemeProgress(loadedData.userThemeProgress);
            } else {
                log(LOG_LEVEL_WARN, `UserThemeProgress not included in loadGameState for ${themeId}. Fetching/creating default.`);
                await _loadOrCreateUserThemeProgress(themeId); // Ensure progress is set
            }
            _initializeCurrentRunStats(); // Initialize run stats based on (potentially new) progress
            characterPanelManager.updateCharacterPanel();
            characterPanelManager.showCharacterPanel(true);
            characterPanelManager.showXPBar(true); // Also show XP bar for resumed game
            // Set GameState details
            if (!loadedData.player_identifier) {
                log(LOG_LEVEL_WARN, `Loaded game state for theme ${themeId} is missing player_identifier. Using user email.`);
                state.setPlayerIdentifier(currentUser.email);
            } else {
                state.setPlayerIdentifier(loadedData.player_identifier);
            }
            state.setGameHistory(loadedData.game_history || []);
            state.setLastKnownDashboardUpdates(loadedData.last_dashboard_updates || {});
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
            state.setIsBoonSelectionPending(loadedData.is_boon_selection_pending || false); // Load pending boon state
            // Update current run stats if they were part of the saved GameState's dashboard_updates
            // (This assumes currentIntegrity etc. might be saved within last_dashboard_updates)
            const igFromSave = loadedData.last_dashboard_updates?.currentIntegrity;
            const wpFromSave = loadedData.last_dashboard_updates?.currentWillpower;
            if (igFromSave !== undefined) state.updateCurrentRunStat('currentIntegrity', parseInt(igFromSave,10));
            if (wpFromSave !== undefined) state.updateCurrentRunStat('currentWillpower', parseInt(wpFromSave,10));
            // Phase 3: Load strain, conditions from saved state similarly
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
                _presentBoonChoices();
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
            if (error.status === 404 && (error.code === 'GAME_STATE_NOT_FOUND' || error.code === 'USER_THEME_PROGRESS_NOT_FOUND')) { // Backend returns 404 if progress also not found
                log(LOG_LEVEL_INFO, `No game state or progress found for theme '${themeId}'. Starting new game flow.`);
                await initiateNewGameSessionFlow(themeId);
            } else {
                log(LOG_LEVEL_ERROR, `Error loading game state or progress for ${themeId}:`, error.message);
                storyLogManager.addMessageToLog(localizationService.getUIText("error_api_call_failed", { ERROR_MSG: `Could not load game: ${error.message}` }), "system system-error");
                await initiateNewGameSessionFlow(themeId);
            }
        }
    } else {
        log(LOG_LEVEL_INFO, "User not logged in. Cannot load. Initiating new game flow for anonymous user.");
        await initiateNewGameSessionFlow(themeId); // This will also call _loadOrCreateUserThemeProgress
    }
    characterPanelManager.updateCharacterPanel(); // Ensure panel is updated after all data is set
}

/**
 * Processes the player's action, sends it to the AI, and updates the UI.
 * @param {string} actionText - The text of the player's action.
 * @param {boolean} [isGameStartingAction=false] - True if this is the automatic "Start game as..." action.
 */
export async function processPlayerAction(actionText, isGameStartingAction = false) {
    log(LOG_LEVEL_INFO, `Processing player action: "${actionText.substring(0, 50)}..." (isGameStartingAction: ${isGameStartingAction})`);
    if (state.getIsBoonSelectionPending()) {
        const boonAction = state.getCurrentSuggestedActions().find(
            action => (typeof action === 'string' && action === actionText) || (typeof action === 'object' && action.text === actionText && action.isBoonChoice)
        );
        if (boonAction && typeof boonAction === 'object' && boonAction.boonId) {
            await _handleBoonSelection(boonAction.boonId, boonAction.text);
        } else {
            // If the input doesn't match a boon choice, re-present.
            storyLogManager.addMessageToLog(localizationService.getUIText("error_invalid_boon_choice"), "system system-error");
            _presentBoonChoices();
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
        storyLogManager.renderMessage(actionText, "player");
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
            storyLogManager.renderMessage(fullAiResponse.narrative, "gm");
            dashboardManager.updateDashboard(state.getLastKnownDashboardUpdates()); // State is updated by aiService
            characterPanelManager.updateCharacterPanel(); // ENSURE THIS IS THE PLACEMENT
            suggestedActionsManager.displaySuggestedActions(state.getCurrentSuggestedActions());
            handleGameStateIndicatorsChange(state.getLastKnownGameStateIndicators());
            if (dom.playerActionInput) {
                dom.playerActionInput.placeholder = state.getCurrentAiPlaceholder() || localizationService.getUIText("placeholder_command");
            }
            if (fullAiResponse.xp_awarded !== undefined) {
                state.setCurrentTurnXPAwarded(fullAiResponse.xp_awarded); // Set for saveCurrentGameState
            }
            await authService.saveCurrentGameState(); // This will pick up currentTurnXPAwarded
            state.setCurrentTurnXPAwarded(0); // Reset after saving
            if (fullAiResponse.xp_awarded > 0) {
                await _handleExperienceAndLevelUp(fullAiResponse.xp_awarded);
            }
             // If boon selection was triggered by level up, subsequent actions are handled by the if block at the start.
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
        // Only set GM activity to false if no boon selection is pending.
        // If boon selection IS pending, the UI should remain responsive for that choice.
        // _presentBoonChoices itself calls setGMActivityIndicator(false).
        if (!state.getIsBoonSelectionPending()) {
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

    try { // Wrap the entire function's core logic to catch any error within it
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
            // Explicitly throw to be caught by userThemeControlsManager or higher
            throw new Error(`Failed to load critical data for theme ${newThemeId}.`);
        }
        log(LOG_LEVEL_DEBUG, `Data loaded for ${newThemeId}. Loading prompts...`);
        await themeService.getAllPromptsForTheme(newThemeId);
        await themeService.ensureThemeDataLoaded("master");
        await themeService.getAllPromptsForTheme("master");
        log(LOG_LEVEL_DEBUG, `Prompts loaded for ${newThemeId} and master.`);

        // The main try for game session flow logic
        // (This 'try' was already here, just ensuring it's clear in context)
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
            // Catch errors from initiateNewGameSessionFlow or resumeGameSession
            log(LOG_LEVEL_ERROR, `Error during session setup (new/resume) for ${newThemeId}:`, sessionError.message, sessionError);
            throw sessionError; // Re-throw to be caught by the outer try-catch or the caller
        }

    } catch (error) { // Outer catch for changeActiveTheme
        log(LOG_LEVEL_ERROR, `Error within changeActiveTheme for ${newThemeId}:`, error.message, error.code, error.details, error);
        // Re-throw the error so it's caught by userThemeControlsManager.handleThemeIconClick's catch
        // This ensures that the error caught by userThemeControlsManager is the one from here.
        throw error;
    } finally {
        // This finally block will execute even if an error is thrown and caught above.
        if (_userThemeControlsManagerRef) {
            log(LOG_LEVEL_DEBUG, `changeActiveTheme finally block: Updating topbar icons. Current theme in state after logic: ${state.getCurrentTheme()}`);
            _userThemeControlsManagerRef.updateTopbarThemeIcons();
        }
        characterPanelManager.updateCharacterPanel();
        const themeActive = state.getCurrentTheme() !== null;
        characterPanelManager.showCharacterPanel(themeActive); // Show only if a theme is active
        characterPanelManager.showXPBar(themeActive); // Sync XP bar visibility
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

    // Handle visibility of "hidden_until_active" panels
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

    // Determine the next prompt type based on active indicators and their priorities
    let newPromptTypeForAI = "default";
    let highestPriorityFound = -1;

    if (dashboardConfig.game_state_indicators && Array.isArray(dashboardConfig.game_state_indicators)) {
        for (const indicatorConfig of dashboardConfig.game_state_indicators) {
            const indicatorId = indicatorConfig.id;
            if (newIndicators[indicatorId] === true) {
                // Check if a valid prompt file exists for this indicator ID
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

    // Refresh scroll indicators as panel visibility might have changed
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
    if (currentActiveTheme && state.getCurrentUser()) { // Only save if a game was active AND user is logged in
        log(LOG_LEVEL_DEBUG, `Game was active for theme ${currentActiveTheme}. Saving state.`);
        await authService.saveCurrentGameState();
    }

    state.clearVolatileGameState(); // Clears game history, player ID, progression state etc.
    storyLogManager.clearStoryLogDOM();
    state.setCurrentTheme(null); // Important: Signals no active game
    state.setIsInitialGameLoad(true);
    state.setIsBoonSelectionPending(false); // Ensure no pending boons on landing

    await landingPageManager.switchToLandingView();
    characterPanelManager.showCharacterPanel(false); // Hide character panel on landing
    characterPanelManager.showXPBar(false); // Also hide XP bar

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
    // Delegate to the specialized manager
    worldShardsModalManager.showConfigureShardsModal(themeId);
}
