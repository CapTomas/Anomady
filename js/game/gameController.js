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
import * as suggestedActionsManager from '../ui/suggestedActionsManager.js';
import * as dashboardManager from '../ui/dashboardManager.js';
import * as modalManager from '../ui/modalManager.js';
import * as landingPageManager from '../ui/landingPageManager.js';
// authUiManager is not directly called by gameController, but by app.js/event listeners
// import * as authUiManager from '../ui/authUiManager.js';
import * as worldShardsModalManager from '../ui/worldShardsModalManager.js';
import { log, LOG_LEVEL_INFO, LOG_LEVEL_ERROR, LOG_LEVEL_WARN, LOG_LEVEL_DEBUG } from '../core/logger.js';

// Module-level variable to hold shard payload for the initial game turn
// This variable is now primarily managed and set within aiService.getSystemPrompt
// and used by aiService.processAiTurn. GameController doesn't need to manage it directly.
// let _worldShardsPayloadForInitialTurn = "[]"; // Removed from here

// Dependencies to be injected by app.js
let _userThemeControlsManagerRef = null;

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

    // 1. Set current theme and clear all volatile *data* state first
    state.setCurrentTheme(themeId);
    state.clearVolatileGameState(); // This now also clears currentNewGameSettings by default
    state.setIsInitialGameLoad(true);
    state.setCurrentPromptType("initial");

    // 2. Explicitly reset/clear the DOM elements managed by UI managers
    log(LOG_LEVEL_DEBUG, "Clearing UI components for new game environment...");
    storyLogManager.clearStoryLogDOM();
    suggestedActionsManager.clearSuggestedActions();
    dashboardManager.resetDashboardUI(themeId);

    // 3. Switch the main view to game mode (hides landing, shows game containers)
    landingPageManager.switchToGameView(themeId);

    // 4. World Shards context for initial prompt will be passed via initial player action.
    // The 'useEvolvedWorld' decision is stored in state.currentNewGameSettings by initiateNewGameSessionFlow.

    // 5. Update "playing" status for the theme
    if (_userThemeControlsManagerRef && typeof _userThemeControlsManagerRef.setThemeAsPlaying === 'function') {
        await _userThemeControlsManagerRef.setThemeAsPlaying(themeId);
    } else {
        log(LOG_LEVEL_WARN, "UserThemeControlsManager not available in _setupNewGameEnvironment. Cannot set theme as playing.");
    }

    const themeDisplayName = themeService.getThemeConfig(themeId)?.name_key
        ? localizationService.getUIText(themeService.getThemeConfig(themeId).name_key, {}, { explicitThemeContext: themeId })
        : themeId;

    // 6. Always setup UI for player identifier input.
    state.setPlayerIdentifier(""); // Ensure no old identifier is lingering
    if (dom.nameInputSection) dom.nameInputSection.style.display = "flex";
    if (dom.actionInputSection) dom.actionInputSection.style.display = "none";
    if (dom.playerIdentifierInput) {
        dom.playerIdentifierInput.value = "";
        dom.playerIdentifierInput.placeholder = localizationService.getUIText("placeholder_name_login");
        dom.playerIdentifierInput.focus();
    }
    storyLogManager.addMessageToLog(localizationService.getUIText("system_theme_set_generic", { THEME_NAME: themeDisplayName }), "system");
    storyLogManager.addMessageToLog(localizationService.getUIText("alert_identifier_required"), "system"); // Inform user
    log(LOG_LEVEL_INFO, `UI configured for new game in theme ${themeId}. Awaiting player identifier input.`);
}

/**
 * Handles player identifier submission for anonymous users.
 * @param {string} identifier - The player's chosen identifier.
 */
export async function handleIdentifierSubmission(identifier) {
    log(LOG_LEVEL_INFO, `Player identifier submitted: ${identifier}`);
    if (!identifier || identifier.trim() === "") {
        storyLogManager.addMessageToLog(localizationService.getUIText("alert_identifier_required"), "system-error");
        if (dom.playerIdentifierInput) dom.playerIdentifierInput.focus();
        return;
    }

    state.setPlayerIdentifier(identifier);

    if (dom.nameInputSection) dom.nameInputSection.style.display = "none";
    if (dom.actionInputSection) dom.actionInputSection.style.display = "flex";

    if (dom.playerActionInput) {
        dom.playerActionInput.placeholder = localizationService.getUIText("placeholder_command");
        state.setCurrentAiPlaceholder(dom.playerActionInput.placeholder);
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
    state.addTurnToGameHistory({ role: "user", parts: [{ text: initialActionText }] });

    // Clear the new game settings from state now that they've been used
    state.clearCurrentNewGameSettings();

    await processPlayerAction(initialActionText, true); // true for isGameStartingAction
}

/**
 * Initializes a new game session after user confirmation and world type selection.
 * @param {string} themeId - The ID of the theme to start.
 */
export async function initiateNewGameSessionFlow(themeId) {
    log(LOG_LEVEL_INFO, `Initiating new game session flow for theme: ${themeId}`);
    const currentUser = state.getCurrentUser();
    const themeStatus = currentUser ? state.getShapedThemeData().get(themeId) : null;
    let useEvolvedWorld = false;

    const themeConfig = themeService.getThemeConfig(themeId);
    const themeNameForModal = themeConfig?.name_key
        ? localizationService.getUIText(themeConfig.name_key, {}, { explicitThemeContext: themeId })
        : themeId;

    // Only ask about Evolved World if user is logged in and has active shards for this theme
    if (currentUser && themeStatus && themeStatus.hasShards && themeStatus.activeShardCount > 0) {
        const choice = await modalManager.showCustomModal({
            type: "confirm",
            titleKey: "title_choose_world_type",
            messageKey: "message_choose_world_type",
            confirmTextKey: "button_evolved_world",
            cancelTextKey: "button_original_world",
            replacements: { THEME_NAME: themeNameForModal } // No explicit theme context for modal buttons
        });

        if (choice === null) { // User cancelled the modal (e.g., pressed Esc or closed it)
            log(LOG_LEVEL_INFO, "New game world type selection cancelled by user.");
            return; // Abort starting new game
        }
        useEvolvedWorld = choice; // true if "Evolved World" (confirm) was clicked, false for "Original World" (cancel)
        } else {
        log(LOG_LEVEL_INFO, `No active shards for theme ${themeId}, or user not logged in. Starting Original World by default.`);
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
        await switchToLanding(); // Use exported function
        return;
    }
    // Ensure all prompts are loaded for the theme before trying to use them
    await themeService.getAllPromptsForTheme(themeId);
    await themeService.ensureThemeDataLoaded("master"); // For master_lore_deep_dive
    await themeService.getAllPromptsForTheme("master");

    landingPageManager.switchToGameView(themeId);
    dashboardManager.generatePanelsForTheme(themeId); // Also calls initializeCollapsiblePanelBoxes

    const currentUser = state.getCurrentUser();
    if (currentUser && currentUser.token) {
        try {
            const loadedState = await apiService.loadGameState(currentUser.token, themeId);
            if (!loadedState.player_identifier) {
                log(LOG_LEVEL_WARN, `Loaded game state for theme ${themeId} is missing player_identifier. Attempting to use user email as fallback for resume.`);
                 state.setPlayerIdentifier(currentUser.email);
            } else {
                state.setPlayerIdentifier(loadedState.player_identifier);
            }            state.setGameHistory(loadedState.game_history || []);
            state.setLastKnownDashboardUpdates(loadedState.last_dashboard_updates || {});
            state.setLastKnownGameStateIndicators(loadedState.last_game_state_indicators || {});
            state.setCurrentPromptType(loadedState.current_prompt_type || "default");
            state.setCurrentNarrativeLanguage(loadedState.current_narrative_language || state.getCurrentAppLanguage());
            state.setCurrentSuggestedActions(loadedState.last_suggested_actions || []);
            state.setCurrentPanelStates(loadedState.panel_states || {});
            state.setCurrentAiPlaceholder(loadedState.input_placeholder || localizationService.getUIText("placeholder_command"));
            // For Living Chronicle features
            state.setLastKnownCumulativePlayerSummary(loadedState.game_history_summary || "");
            state.setLastKnownEvolvedWorldLore(loadedState.game_history_lore || "");

            storyLogManager.clearStoryLogDOM();
            state.getGameHistory().forEach((turn) => {
                if (turn.role === "user") {
                    storyLogManager.addMessageToLog(turn.parts[0].text, "player");
                } else if (turn.role === "model") {
                    try {
                        const modelResponse = JSON.parse(turn.parts[0].text);
                        storyLogManager.addMessageToLog(modelResponse.narrative, "gm");
                         if (modelResponse.isDeepDive) { // Check if it was a deep dive response
                             log(LOG_LEVEL_DEBUG, "Repopulating a deep dive message from history.");
                         }
                    } catch (e) {
                        log(LOG_LEVEL_ERROR, "Error parsing model response from loaded history:", e, turn.parts[0].text);
                        storyLogManager.addMessageToLog(localizationService.getUIText("error_reconstruct_story"), "system-error");
                    }
                }
            });

            dashboardManager.updateDashboard(state.getLastKnownDashboardUpdates(), false); // Apply loaded updates without highlight
            // initializeCollapsiblePanelBoxes is now part of generatePanelsForTheme
            handleGameStateIndicatorsChange(state.getLastKnownGameStateIndicators(), true); // true for isInitialBoot
            suggestedActionsManager.displaySuggestedActions(state.getCurrentSuggestedActions());

            state.setIsInitialGameLoad(false);
            log(LOG_LEVEL_INFO, `Game state for theme '${themeId}' loaded and UI restored.`);

            if (dom.nameInputSection) dom.nameInputSection.style.display = "none";
            if (dom.actionInputSection) dom.actionInputSection.style.display = "flex";
            if (dom.playerActionInput) {
                dom.playerActionInput.placeholder = state.getCurrentAiPlaceholder();
                dom.playerActionInput.focus();
            }
             const themeDisplayName = themeService.getThemeConfig(themeId)?.name_key
                ? localizationService.getUIText(themeService.getThemeConfig(themeId).name_key, {}, { explicitThemeContext: themeId })
                : themeId;
            storyLogManager.addMessageToLog(localizationService.getUIText("system_session_resumed", { PLAYER_ID: state.getPlayerIdentifier(), THEME_NAME: themeDisplayName }), "system");


        } catch (error) {
            if (_userThemeControlsManagerRef) {
                _userThemeControlsManagerRef.updateTopbarThemeIcons();
            }
            if (error.status === 404 && error.code === 'GAME_STATE_NOT_FOUND') {
                log(LOG_LEVEL_INFO, `No game state found on backend for theme '${themeId}'. Starting new game flow.`);
                await initiateNewGameSessionFlow(themeId); // This will set up a new game
            } else {
                log(LOG_LEVEL_ERROR, `Error loading game state for ${themeId}:`, error.message);
                storyLogManager.addMessageToLog(localizationService.getUIText("error_api_call_failed", { ERROR_MSG: `Could not load game: ${error.message}` }), "system-error");
                await initiateNewGameSessionFlow(themeId); // Fallback to new game on other errors
            }
        }
    } else {
        log(LOG_LEVEL_INFO, "User not logged in. Cannot load game state from backend. Initiating new game flow for anonymous user.");
        await initiateNewGameSessionFlow(themeId);
    }
}

/**
 * Processes the player's action, sends it to the AI, and updates the UI.
 * @param {string} actionText - The text of the player's action.
 * @param {boolean} [isGameStartingAction=false] - True if this is the automatic "Start game as..." action.
 */
export async function processPlayerAction(actionText, isGameStartingAction = false) {
    log(LOG_LEVEL_INFO, `Processing player action: "${actionText.substring(0,50)}..."`);

    if (!isGameStartingAction) {
        storyLogManager.addMessageToLog(actionText, "player");
        state.addTurnToGameHistory({ role: "user", parts: [{ text: actionText }] });

        if (dom.playerActionInput) {
            dom.playerActionInput.value = "";
            dom.playerActionInput.dispatchEvent(new Event("input", { bubbles: true }));
            uiUtils.autoGrowTextarea(dom.playerActionInput);
        }
    }
    // If it *is* the game starting action, game history was already updated by the caller (_setupNewGameEnvironment or handleIdentifierSubmission)

    uiUtils.setGMActivityIndicator(true);
    suggestedActionsManager.clearSuggestedActions(); // Clear previous suggestions

    try {
        // worldShardsPayloadForInitial is now handled internally by aiService.getSystemPrompt
        const narrative = await aiService.processAiTurn(actionText);

        if (narrative) {
            storyLogManager.addMessageToLog(narrative, "gm");
            // dashboardManager.updateDashboard is the function that should exist
            dashboardManager.updateDashboard(state.getLastKnownDashboardUpdates());
            suggestedActionsManager.displaySuggestedActions(state.getCurrentSuggestedActions());
            handleGameStateIndicatorsChange(state.getLastKnownGameStateIndicators()); // Pass the new indicators
            if (dom.playerActionInput) {
                dom.playerActionInput.placeholder = state.getCurrentAiPlaceholder() || localizationService.getUIText("placeholder_command");
            }
        } else {
            storyLogManager.addMessageToLog(localizationService.getUIText("error_api_call_failed", { ERROR_MSG: "AI interaction failed." }), "system-error");
        }

        // This was already done in _setupNewGameEnvironment or handleIdentifierSubmission for the initial turn.
        // For subsequent turns, isInitialGameLoad should already be false.
        if (isGameStartingAction && state.getIsInitialGameLoad()) {
            state.setIsInitialGameLoad(false);
        }

        await authService.saveCurrentGameState(); // authService now handles constructing payload
    } catch (error) {
        log(LOG_LEVEL_ERROR, "Error during AI turn processing in gameController:", error.message, error);
        storyLogManager.addMessageToLog(localizationService.getUIText("error_api_call_failed", { ERROR_MSG: error.message }), "system-error");
        if (dom.playerActionInput) dom.playerActionInput.placeholder = localizationService.getUIText("placeholder_command");
    } finally {
        uiUtils.setGMActivityIndicator(false);
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

    if (currentActiveTheme && currentActiveTheme !== newThemeId) {
        log(LOG_LEVEL_DEBUG, `Saving game state for current theme: ${currentActiveTheme}`);
        await authService.saveCurrentGameState(); // Save before switching
    } else if (currentActiveTheme === newThemeId && !forceNewGame) {
        log(LOG_LEVEL_INFO, `Theme ${newThemeId} is already active and not forcing new game. Ensuring view.`);
        if (document.body.classList.contains("landing-page-active")) { // If on landing, switch to game view
            landingPageManager.switchToGameView(newThemeId);
            dashboardManager.updateDashboard(state.getLastKnownDashboardUpdates(), false); // Restore dashboard without highlight
            suggestedActionsManager.displaySuggestedActions(state.getCurrentSuggestedActions());
            if (dom.playerActionInput && dom.actionInputSection && dom.actionInputSection.style.display !== 'none') {
                 dom.playerActionInput.focus();
            }
        }
        if (_userThemeControlsManagerRef) {
            _userThemeControlsManagerRef.updateTopbarThemeIcons();
        }
        return;
    }

    // Ensure core data (config, texts, prompt-config) for the new theme is loaded
    const dataLoaded = await themeService.ensureThemeDataLoaded(newThemeId);
    if (!dataLoaded) {
        log(LOG_LEVEL_ERROR, `Critical data for new theme ${newThemeId} failed to load.`);
        await modalManager.showCustomModal({type: "alert", titleKey: "alert_title_error", messageKey: "error_theme_data_load_failed", replacements: { THEME_ID: newThemeId }});
        // Optionally, try to revert to old theme or landing page
        return;
    }

    // Load all actual prompt files for the new theme
    await themeService.getAllPromptsForTheme(newThemeId);
    // Also ensure master prompts and default theme prompts are available if needed for fallbacks
    await themeService.ensureThemeDataLoaded("master");
    await themeService.getAllPromptsForTheme("master");
    // const DEFAULT_THEME_ID = "grim_warden"; // Make sure this is accessible or passed in
    // if (newThemeId !== DEFAULT_THEME_ID) {
    //     await themeService.ensureThemeDataLoaded(DEFAULT_THEME_ID);
    //     await themeService.getAllPromptsForTheme(DEFAULT_THEME_ID);
    // }

    // Logic for starting new or resuming will handle state.setCurrentTheme and UI updates
    try {
        if (forceNewGame) {
            await initiateNewGameSessionFlow(newThemeId); // This handles setting up new game env
        } else {
            await resumeGameSession(newThemeId); // This handles loading existing or starting new if not found
        }
    } finally {
        if (_userThemeControlsManagerRef) {
            log(LOG_LEVEL_DEBUG, `changeActiveTheme finally: Updating topbar icons. Current theme in state: ${state.getCurrentTheme()}`);
            _userThemeControlsManagerRef.updateTopbarThemeIcons();
        }
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

    if (currentActiveTheme) {
        log(LOG_LEVEL_DEBUG, `Game was active for theme ${currentActiveTheme}. Attempting to save its state.`);

        if (state.getCurrentUser()) {
            await authService.saveCurrentGameState();
        }
    }

    state.clearVolatileGameState();
    storyLogManager.clearStoryLogDOM();
    state.setCurrentTheme(null);
    state.setIsInitialGameLoad(true);
    state.setCurrentLandingGridSelection(null);
    await landingPageManager.switchToLandingView();
    if (_userThemeControlsManagerRef) {
        log(LOG_LEVEL_DEBUG, `switchToLanding: Updating topbar icons. Current theme in state: ${state.getCurrentTheme()}`);
        _userThemeControlsManagerRef.updateTopbarThemeIcons();
    }
    log(LOG_LEVEL_INFO, "Switched to landing view. Game state cleared for any previous session.");
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
