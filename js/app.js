// Wait for the DOM to be fully loaded before initializing the application
document.addEventListener('DOMContentLoaded', () => {
    // API Key for Gemini (fetched from localStorage or user prompt)
    let GEMINI_API_KEY = "";

    // Default application settings
    const DEFAULT_LANGUAGE = 'cs'; // Default UI and narrative language
    const DEFAULT_THEME_ID = 'scifi'; // Default theme if none is selected
    const UPDATE_HIGHLIGHT_DURATION = 5000; // Duration for UI update highlights (ms)

    // localStorage keys for persisting application state and preferences
    const CURRENT_THEME_STORAGE_KEY = 'anomadyCurrentTheme';
    const GAME_STATE_STORAGE_KEY_PREFIX = 'anomadyGameState_'; // Prefix for theme-specific game states
    const MODEL_PREFERENCE_STORAGE_KEY = 'anomadyModelPreference';
    const LANGUAGE_PREFERENCE_STORAGE_KEY = 'preferredAppLanguage';
    const NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY = 'preferredNarrativeLanguage';
    const PLAYING_THEMES_STORAGE_KEY = 'anomadyPlayingThemes'; // Themes currently being played or recently played
    const LIKED_THEMES_STORAGE_KEY = 'anomadyLikedThemes'; // Themes liked by the user
    const LANDING_SELECTED_GRID_THEME_KEY = 'anomadyLandingSelectedGridTheme'; // Theme selected on landing page grid

    // AI Model identifiers
    const PAID_MODEL_NAME = "gemini-2.5-flash-preview-04-17"; // Identifier for the preferred/paid model
    const FREE_MODEL_NAME = "gemini-1.5-flash-latest"; // Identifier for the standard/free model (currently same as paid)
    let currentModelName = localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY) || FREE_MODEL_NAME;

    // Core application state variables
    let currentTheme = localStorage.getItem(CURRENT_THEME_STORAGE_KEY) || null; // Active game theme
    let currentAppLanguage = localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY) || DEFAULT_LANGUAGE; // Current UI language
    let currentNarrativeLanguage = localStorage.getItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY) || currentAppLanguage; // Current language for AI narrative
    let gamePrompts = {}; // Stores loaded prompt texts, keyed by theme and prompt name
    let currentPromptType = 'initial'; // Type of system prompt to use (e.g., 'initial', 'default', 'combat_engaged')
    let gameHistory = []; // Array of conversation turns with the AI
    let playerIdentifier = ''; // User's chosen name or identifier in the game
    let isInitialGameLoad = true; // Flag indicating if this is the first load of a game session
    let lastKnownDashboardUpdates = {}; // Cache of the last AI-provided dashboard values
    let lastKnownGameStateIndicators = {}; // Cache of the last AI-provided game state flags
    let currentModalResolve = null; // To handle Promises for prompt/confirm


    // User's theme lists
    let playingThemes = []; // Themes the user has active sessions for
    let likedThemes = []; // Themes the user has marked as liked
    let currentLandingGridSelection = null; // Theme ID selected in the landing page grid

    // DOM Element References
    const appRoot = document.getElementById('app-root'); // Main application container
    const applicationLogoElement = document.getElementById('application-logo'); // App logo in the header
    const playingThemesContainer = document.getElementById('playing-themes-container'); // Container for playing theme icons
    const likedThemesSeparator = document.getElementById('liked-themes-separator'); // Separator between playing/liked themes
    const likedThemesContainer = document.getElementById('liked-themes-container'); // Container for liked theme icons

    // UI indicators and global controls
    const systemStatusIndicator = document.getElementById('system-status-indicator'); // Displays system status (online, error, etc.)
    const gmSpecificActivityIndicator = document.getElementById('gm-activity-indicator'); // Shows when AI is processing
    const languageToggleButton = document.getElementById('language-toggle-button'); // Button to switch app language
    const newGameButton = document.getElementById('new-game-button'); // Button to start a new game session
    const modelToggleButton = document.getElementById('model-toggle-button'); // Button to switch AI model

    // Main layout panels
    const mainLayout = document.getElementById('main-layout');
    const leftPanel = document.getElementById('left-panel'); // Left informational panel
    const rightPanel = document.getElementById('right-panel'); // Right informational panel
    const centerColumn = document.getElementById('center-column'); // Center column for story and input

    // Landing page specific elements
    const themeGridContainer = document.getElementById('theme-grid-container'); // Grid for theme selection
    const landingThemeDescriptionContainer = document.getElementById('landing-theme-description-container'); // Panel for theme lore on landing page
    const landingThemeLoreText = document.getElementById('landing-theme-lore-text'); // Text area for theme lore
    const landingThemeDetailsContainer = document.getElementById('landing-theme-details-container'); // Panel for theme details on landing page
    const landingThemeInfoContent = document.getElementById('landing-theme-info-content'); // Content area for theme details
    const landingThemeActions = document.getElementById('landing-theme-actions'); // Container for action buttons (choose/like theme)

    // Custom Modal Elements
    const customModalOverlay = document.getElementById('custom-modal-overlay');
    const customModalElement = document.getElementById('custom-modal');
    const customModalTitle = document.getElementById('custom-modal-title');
    const customModalMessage = document.getElementById('custom-modal-message');
    const customModalInputContainer = document.getElementById('custom-modal-input-container');
    const customModalInput = document.getElementById('custom-modal-input');
    const customModalActions = document.getElementById('custom-modal-actions');

    // Game view specific elements
    const storyLog = document.getElementById('story-log'); // Container for narrative messages
    const storyLogViewport = document.getElementById('story-log-viewport'); // Scrollable viewport for story log
    const suggestedActionsWrapper = document.getElementById('suggested-actions-wrapper'); // Container for AI-suggested actions
    const playerInputControlPanel = document.getElementById('player-input-control-panel'); // Panel containing input fields
    const nameInputSection = document.getElementById('name-input-section'); // Section for player identifier input
    const playerIdentifierInputEl = document.getElementById('player-identifier-input'); // Input field for player's name/identifier
    const startGameButton = document.getElementById('start-game-button'); // Button to initiate the game after entering identifier
    const actionInputSection = document.getElementById('action-input-section'); // Section for player action input
    const playerActionInput = document.getElementById('player-action-input'); // Textarea for player's game actions
    const sendActionButton = document.getElementById('send-action-button'); // Button to submit player's action

    // Story log auto-scroll control
    let userHasManuallyScrolledLog = false; // Flag to manage auto-scrolling behavior
    const AUTOSCROLL_THRESHOLD = 40; // Pixel threshold to re-enable auto-scroll
    function getUIText(key, replacements = {}, explicitThemeContext = null) {
        let text;
        const onLandingPage = document.body.classList.contains('landing-page-active');
        const lang = currentAppLanguage;

        // 1. Try landing page specific texts from globalTextData.landing
        if (onLandingPage && globalTextData.landing?.[lang]?.[key]) {
            text = globalTextData.landing[lang][key];
        } else if (onLandingPage && globalTextData.landing?.en?.[key] && !globalTextData.landing?.[lang]?.[key]) {
            text = globalTextData.landing.en[key]; // Fallback to English for landing
        }

        // 2. If not found on landing, or not on landing, try explicit theme context from themeTextData
        if (!text && explicitThemeContext && themeTextData[explicitThemeContext]) {
            text = themeTextData[explicitThemeContext]?.[lang]?.[key] ||
                   themeTextData[explicitThemeContext]?.en?.[key]; // Fallback to English for explicit theme
        }

        // 3. If not found yet, try current game theme context from themeTextData
        if (!text && currentTheme && themeTextData[currentTheme]) {
            text = themeTextData[currentTheme]?.[lang]?.[key] ||
                   themeTextData[currentTheme]?.en?.[key]; // Fallback to English for current theme
        }
        
        // 4. If still not found, try the globalTextData.global section
        if (!text && globalTextData.global) {
            text = globalTextData.global[lang]?.[key] ||
                   globalTextData.global.en?.[key]; // Fallback to English for global
        }

        // 5. Fallback to default theme's UI text (from themeTextData) if it was a game-specific context and text still not found
        if (!text && !onLandingPage && !explicitThemeContext && currentTheme !== DEFAULT_THEME_ID && themeTextData[DEFAULT_THEME_ID]) {
             const themeForUI = DEFAULT_THEME_ID;
             text = themeTextData[themeForUI]?.[lang]?.[key] ||
                    themeTextData[themeForUI]?.en?.[key];
        }
        
        text = text || key; // Use key as ultimate fallback if no translation found

        // Apply replacements
        for (const placeholder in replacements) {
            text = text.replace(new RegExp(`{${placeholder}}`, 'g'), replacements[placeholder]);
        }
        return text;
    }

    /**
     * Sets up the Gemini API key, prompting the user if not found in localStorage.
     * @returns {boolean} True if API key is successfully set, false otherwise.
     */
    async function setupApiKey() { // Make function async
        GEMINI_API_KEY = localStorage.getItem('userGeminiApiKey');
        if (!GEMINI_API_KEY) {
            const apiKeyInput = await showCustomModal({ // await the promise
                type: 'prompt',
                titleKey: 'prompt_enter_api_key_title', 
                messageKey: 'prompt_enter_api_key',
                confirmTextKey: 'modal_confirm_button',
                cancelTextKey: 'modal_cancel_button',
                inputPlaceholderKey: 'placeholder_api_key_input' 
            });

            if (apiKeyInput && apiKeyInput.trim() !== "") {
                GEMINI_API_KEY = apiKeyInput.trim();
                localStorage.setItem('userGeminiApiKey', GEMINI_API_KEY);
            } else if (apiKeyInput !== null) { 
                GEMINI_API_KEY = ""; 
                await showCustomModal({ 
                    type: 'alert',
                    titleKey: 'alert_title_error', 
                    messageKey: 'alert_api_key_required'
                });
            } else { 
                 GEMINI_API_KEY = ""; 
            }
        }

        if (!GEMINI_API_KEY) {
            const errorMsg = getUIText('error_critical_no_api_key'); 
            const statusErrorMsg = getUIText('status_error'); 
            
            addMessageToLog(errorMsg, 'system'); 
            console.error(errorMsg);
            if (systemStatusIndicator) {
                systemStatusIndicator.textContent = statusErrorMsg;
                systemStatusIndicator.className = 'status-indicator status-danger';
            }
            [startGameButton, playerIdentifierInputEl, playerActionInput, sendActionButton].forEach(el => {
                if (el) el.disabled = true;
            });
            if (themeGridContainer) themeGridContainer.style.pointerEvents = 'none';
            return false;
        }
        if (themeGridContainer) themeGridContainer.style.pointerEvents = 'auto';
        return true;
    }

    /**
     * Saves the current game state (history, dashboard, etc.) to localStorage for the active theme.
     */
    function saveGameState() {
        if (!playerIdentifier || !currentTheme) return; // Do not save if essential info is missing

        const gameStateKey = GAME_STATE_STORAGE_KEY_PREFIX + currentTheme;
        const gameState = {
            playerIdentifier: playerIdentifier,
            gameHistory: gameHistory,
            lastDashboardUpdates: lastKnownDashboardUpdates,
            lastGameStateIndicators: lastKnownGameStateIndicators,
            currentPromptType: currentPromptType,
            currentNarrativeLanguage: currentNarrativeLanguage,
        };
        try {
            localStorage.setItem(gameStateKey, JSON.stringify(gameState));
        } catch (e) {
            console.error("Error saving game state:", e);
            addMessageToLog(getUIText('error_saving_progress'), 'system-error');
        }
    }

    /**
     * Loads game state from localStorage for a given theme ID.
     * @param {string} themeIdToLoad - The ID of the theme whose state needs to be loaded.
     * @returns {boolean} True if state was successfully loaded and applied, false otherwise.
     */
    function loadGameState(themeIdToLoad) {
        const gameStateKey = GAME_STATE_STORAGE_KEY_PREFIX + themeIdToLoad;
        try {
            const savedStateString = localStorage.getItem(gameStateKey);
            if (!savedStateString) return false; // No saved state found

            const savedState = JSON.parse(savedStateString);
            if (!savedState.playerIdentifier || !savedState.gameHistory || savedState.gameHistory.length === 0) {
                clearGameStateInternal(themeIdToLoad); 
                return false;
            }

            playerIdentifier = savedState.playerIdentifier;
            gameHistory = savedState.gameHistory;
            lastKnownDashboardUpdates = savedState.lastDashboardUpdates || {};
            lastKnownGameStateIndicators = savedState.lastGameStateIndicators || {};
            currentPromptType = savedState.currentPromptType || 'default'; // Default to 'default' if resuming
            currentNarrativeLanguage = savedState.currentNarrativeLanguage || currentAppLanguage;

            if (storyLog) storyLog.innerHTML = '';
            gameHistory.forEach(turn => {
                if (turn.role === 'user') {
                    addMessageToLog(turn.parts[0].text, 'player');
                } else if (turn.role === 'model') {
                    try {
                        const modelResponse = JSON.parse(turn.parts[0].text);
                        addMessageToLog(modelResponse.narrative, 'gm');
                    } catch (e) {
                        console.error("Error parsing model response from history:", e, turn.parts[0].text);
                        addMessageToLog(getUIText('error_reconstruct_story'), 'system');
                    }
                }
            });

            updateDashboard(lastKnownDashboardUpdates, false);
            handleGameStateIndicators(lastKnownGameStateIndicators, false);

            const themeConfig = ALL_THEMES_CONFIG[themeIdToLoad];
            if (themeConfig) {
                const dashboardConfig = THEME_DASHBOARD_CONFIGS[themeConfig.dashboard_config_ref];
                // Use the 'id' from the config which is 'name' for scifi, 'character_name' for fantasy
                const playerIdentifierConfigKey = (dashboardConfig.left_panel || [])
                    .flatMap(p => p.items)
                    .find(item => item.id === 'name' || item.id === 'character_name')?.id;

                if (playerIdentifierConfigKey) {
                    const playerIdentifierConfig = findItemConfigById(dashboardConfig, playerIdentifierConfigKey);
                    if (playerIdentifierConfig) {
                        const el = document.getElementById(`info-${playerIdentifierConfig.id}`);
                        if (el) el.textContent = playerIdentifier;
                    }
                }
            }

            isInitialGameLoad = false; 
            return true;
        } catch (e) {
            console.error(`Error loading game state for ${themeIdToLoad}:`, e);
            clearGameStateInternal(themeIdToLoad); 
            localStorage.removeItem(gameStateKey); 
            return false;
        }
    }

    /**
     * Clears in-memory game state variables, typically for the current theme.
     * @param {string} themeIdToClear - The ID of the theme whose state is being cleared in memory.
     */
    function clearGameStateInternal(themeIdToClear) {
        if (themeIdToClear === currentTheme) { // Only clear if it's the active theme
            gameHistory = [];
            playerIdentifier = '';
            currentPromptType = 'initial';
            isInitialGameLoad = true;
            lastKnownDashboardUpdates = {};
            lastKnownGameStateIndicators = {};
            if (storyLog) storyLog.innerHTML = '';
            clearSuggestedActions();
        }
    }

    /**
     * Clears game state from localStorage and in-memory for a specific theme.
     * @param {string} themeIdToClear - The ID of the theme to clear.
     */
    function clearGameState(themeIdToClear) {
        localStorage.removeItem(GAME_STATE_STORAGE_KEY_PREFIX + themeIdToClear);
        clearGameStateInternal(themeIdToClear); // Also clear in-memory state if it's the current theme
    }

    /**
     * Fetches a specific prompt text file for a given theme.
     * @param {string} promptName - The name of the prompt (e.g., 'initial', 'combat').
     * @param {string} themeId - The ID of the theme.
     * @returns {Promise<string>} A promise that resolves to the prompt text or an error message.
     */
    async function fetchPrompt(promptName, themeId, isCritical = false) { // Added isCritical parameter
        const themePrompts = PROMPT_URLS_BY_THEME[themeId];
        if (!themePrompts || !themePrompts[promptName]) {
            const errorMsg = `Error: Prompt URL for "${promptName}" in theme "${themeId}" not found in configuration.`;
            console.error(errorMsg);
            // Return error string that loadAllPromptsForTheme can check
            return isCritical ? `CRITICAL_ERROR: ${errorMsg}` : `NON_CRITICAL_ERROR: ${errorMsg}`;
        }
        try {
            const response = await fetch(themePrompts[promptName]);
            if (!response.ok) {
                // For 404 errors on non-critical prompts, we don't want to throw and stop everything.
                // We'll return a specific string that loadAllPromptsForTheme can interpret.
                if (response.status === 404 && !isCritical) {
                    console.warn(`Optional prompt file not found (404): ${themeId}/${promptName} at ${themePrompts[promptName]}. Will fallback if needed.`);
                    return `FILE_NOT_FOUND_NON_CRITICAL: ${themeId}/${promptName}`;
                }
                throw new Error(`HTTP error ${response.status} for ${themeId}/${promptName}: ${response.statusText}`);
            }
            return await response.text();
        } catch (error) {
            console.error(`Error fetching prompt ${themeId}/${promptName}:`, error);
            const errorPrefix = isCritical ? "CRITICAL_ERROR:" : "NON_CRITICAL_ERROR:";
            // addMessageToLog is not always appropriate here as it might be called before UI is fully ready for logs
            // Consider a more robust logging or error handling if this becomes an issue during initial load.
            return `${errorPrefix} Prompt "${themeId}/${promptName}" load failed. ${error.message}`;
        }
    }

    /**
     * Loads all prompt files for a specified theme and stores them in `gamePrompts`.
     * @param {string} themeId - The ID of the theme for which to load prompts.
     * @returns {Promise<boolean>} True if all prompts loaded successfully, false otherwise.
     */
    async function loadAllPromptsForTheme(themeId) {
        const themeConfig = ALL_THEMES_CONFIG[themeId];
        if (!themeConfig || !PROMPT_URLS_BY_THEME[themeId]) {
            addMessageToLog(getUIText('error_no_prompts_for_theme', { THEME: themeId }), 'system');
            return false;
        }

        if (!gamePrompts[themeId]) gamePrompts[themeId] = {};

        const promptNames = Object.keys(PROMPT_URLS_BY_THEME[themeId]);
        const loadingPromises = promptNames.map(name => {
            // Define which prompts are critical
            const isCritical = (name === 'master_initial' || name === 'master_default');
            return fetchPrompt(name, themeId, isCritical).then(text => {
                // Only store successfully fetched texts or non-critical errors that indicate absence
                if (!text.startsWith("CRITICAL_ERROR:")) {
                    gamePrompts[themeId][name] = text; // Store text, or "FILE_NOT_FOUND_NON_CRITICAL:..."
                } else {
                    // For critical errors, store the error to be caught below
                    gamePrompts[themeId][name] = text;
                }
            });
        });

        try {
            await Promise.all(loadingPromises);

            // Check if any CRITICAL prompt failed to load
            for (const name of promptNames) {
                const isCriticalPrompt = (name === 'master_initial' || name === 'master_default');
                if (isCriticalPrompt && gamePrompts[themeId][name]?.startsWith("CRITICAL_ERROR:")) {
                    throw new Error(`Critical prompt load failure: ${gamePrompts[themeId][name]}. Theme "${themeId}" cannot be loaded.`);
                }
                // Non-critical errors (like FILE_NOT_FOUND_NON_CRITICAL) are tolerated and logged by fetchPrompt.
                // The gamePrompts[themeId][name] will hold the "FILE_NOT_FOUND_NON_CRITICAL:..." string.
                // getSystemPrompt will then know this specific prompt is missing and use its fallback logic.
            }
            console.log(`Successfully processed prompts for theme: ${themeId}`);
            return true;
        } catch (error) {
            console.error(`Error during prompt loading for ${themeId}:`, error);
            // This catch block now primarily handles critical prompt failures.
            if (systemStatusIndicator) {
                systemStatusIndicator.textContent = getUIText('status_error');
                systemStatusIndicator.className = 'status-indicator status-danger';
            }
            [startGameButton, playerIdentifierInputEl].forEach(el => { if (el) el.disabled = true; });
            // Add a message to the log about the critical failure
            addMessageToLog(getUIText('error_load_prompts_critical', { THEME: themeId }), 'system-error');
            return false;
        }
    }

    /**
     * Constructs the system prompt for the AI based on current game state, theme, and player.
     * @param {string} currentPlayerIdentifierParam - The player's identifier.
     * @param {string} promptTypeToUse - The type of prompt needed ('initial', 'default', 'combat_engaged', etc.).
     * @returns {string} The fully constructed system prompt (JSON string) or an error JSON.
     */
    const getSystemPrompt = (currentPlayerIdentifierParam, promptTypeToUse) => {
        if (!currentTheme || !ALL_THEMES_CONFIG[currentTheme] || !THEME_DASHBOARD_CONFIGS[ALL_THEMES_CONFIG[currentTheme].dashboard_config_ref]) {
            return `{"narrative": "SYSTEM ERROR: Active theme or its configuration is missing for prompt generation.", "dashboard_updates": {}, "suggested_actions": [], "game_state_indicators": {}}`;
        }

        const themeConfig = ALL_THEMES_CONFIG[currentTheme];
        const dashboardLayoutConfig = THEME_DASHBOARD_CONFIGS[themeConfig.dashboard_config_ref];

        // --- Determine which base prompt text to use ---
        let basePromptKey = promptTypeToUse; // e.g., "initial", "default", "combat_engaged"
        let basePromptText = gamePrompts[currentTheme]?.[basePromptKey];

        // Helper function to check if a prompt text is valid (not an error/not found marker)
        const isValidPromptText = (text) => text && 
                                            !text.startsWith("FILE_NOT_FOUND_NON_CRITICAL:") &&
                                            !text.startsWith("NON_CRITICAL_ERROR:") &&
                                            !text.startsWith("CRITICAL_ERROR:") &&
                                            !text.startsWith("Error:");


        // 1. Try the specific promptTypeToUse for the current theme
        if (!isValidPromptText(basePromptText)) {
            // 2. If specific not valid, and it's not 'initial' or 'default' already, try current theme's 'default'
            if (promptTypeToUse !== 'initial' && promptTypeToUse !== 'default') {
                basePromptKey = 'default'; // Fallback to "default" for specific triggers like "combat_engaged" if their own file is missing
                basePromptText = gamePrompts[currentTheme]?.[basePromptKey];
            }
        }

        // 3. If current theme's 'initial' or 'default' (or their alias) is not valid, try current theme's 'master_initial' or 'master_default'
        if (!isValidPromptText(basePromptText)) {
            if (promptTypeToUse === 'initial' || basePromptKey === 'initial') { 
                basePromptKey = 'master_initial';
            } else { // For 'default' or any other trigger that fell through
                basePromptKey = 'master_default';
            }
            basePromptText = gamePrompts[currentTheme]?.[basePromptKey];
        }
        
        // 4. Final fallback: If even current theme's master prompts are not valid, try the DEFAULT_THEME_ID's master prompts
        if (!isValidPromptText(basePromptText)) {
            console.warn(`Prompt "${promptTypeToUse}" (and potential fallbacks like "${basePromptKey}") not found or invalid for theme "${currentTheme}". Attempting default theme fallback.`);
            const ultimateFallbackKey = (promptTypeToUse === 'initial' || basePromptKey === 'master_initial' || basePromptKey === 'initial') 
                                        ? 'master_initial' 
                                        : 'master_default';
            basePromptText = gamePrompts[DEFAULT_THEME_ID]?.[ultimateFallbackKey];
            
            if (isValidPromptText(basePromptText)) {
                 console.warn(`Used default theme's "${ultimateFallbackKey}" prompt for current theme "${currentTheme}".`);
                 basePromptKey = ultimateFallbackKey; // Update basePromptKey to reflect the actual prompt used
            } else {
                console.error(`CRITICAL PROMPT FAILURE: Neither "${promptTypeToUse}" nor any fallback (including default theme's "${ultimateFallbackKey}") could be loaded for theme "${currentTheme}". Prompt content: ${basePromptText}`);
                return `{"narrative": "SYSTEM ERROR: Core prompt files are critically missing or invalid. Cannot generate AI instructions.", "dashboard_updates": {}, "suggested_actions": ["Restart Game", "Contact Support"], "game_state_indicators": {"activity_status": "Error", "combat_engaged": false, "comms_channel_active": false}}`;
            }
        }

        if (!isValidPromptText(basePromptText)) {
             console.error(`Failed to load a critical prompt template: ${basePromptKey} for theme ${currentTheme}. Content was: ${basePromptText}`);
             return `{"narrative": "SYSTEM ERROR: Prompt template ${basePromptKey} missing or failed to load for ${currentTheme}.", "dashboard_updates": {}, "suggested_actions": ["Check panel.", "Change theme."], "game_state_indicators": {"activity_status": "Error", "combat_engaged": false, "comms_channel_active": false}}`;
        }

        // --- Dynamic Content Generation ---
        // 1. Dashboard Description
        let generatedDashboardDescription = "";
        const dashboardItems = [...(dashboardLayoutConfig.left_panel || []).flatMap(p => p.items), ...(dashboardLayoutConfig.right_panel || []).flatMap(p => p.items)];
        dashboardItems.forEach(item => {
            let description = `// "${item.id}": "string (${item.short_description || 'No description available.'}`;
            if (item.must_translate) {
                description += ` This value MUST be in ${currentNarrativeLanguage.toUpperCase()}.`;
            } else {
                description += ` This value does NOT require translation from English.`;
            }
            if (item.type === 'meter' && item.status_text_id) {
                 description += ` Associated status text field is '${item.status_text_id}'.`;
            }
            if (item.default_value_key) {
                description += ` Default UI text key: '${item.default_value_key}'.`;
            } else if (item.default_value !== undefined) {
                description += ` Default value: '${item.default_value}'.`;
            }
            description += `)",\n`;
            generatedDashboardDescription += description;
        });
        if (generatedDashboardDescription.endsWith(",\n")) {
            generatedDashboardDescription = generatedDashboardDescription.slice(0, -2);
        }
        
        // 2. Game State Indicators Description
        let generatedGameStateIndicators = "";
        if (dashboardLayoutConfig.game_state_indicators && Array.isArray(dashboardLayoutConfig.game_state_indicators)) {
            dashboardLayoutConfig.game_state_indicators.forEach(indicator => {
                let description = `"${indicator.id}": "boolean (${indicator.short_description || 'No description.'}`;
                if (indicator.default_value_key) {
                     description += ` Default UI text key for conceptual status: '${indicator.default_value_key}'.`;
                } else if (indicator.default_value !== undefined) { 
                     description += ` Default value: ${indicator.default_value}.`;
                }
                description += `)",\n`;
                generatedGameStateIndicators += description;
            });
            if (!generatedGameStateIndicators.includes('"activity_status"')) { 
                generatedGameStateIndicators += `"activity_status": "string (MUST match dashboard_updates.directive_status if provided. If not, it reflects the ongoing primary activity described in the narrative, IN THE NARRATIVE LANGUAGE. E.g., if narrative describes fighting, this should be the NARRATIVE LANGUAGE equivalent of 'Fighting'.)",\n`;
            }
            if (generatedGameStateIndicators.endsWith(",\n")) {
                generatedGameStateIndicators = generatedGameStateIndicators.slice(0, -2);
            }
        } else {
            generatedGameStateIndicators = `"activity_status": "string (MUST match dashboard_updates.directive_status if provided. If not, it reflects the ongoing primary activity described in the narrative, IN THE NARRATIVE LANGUAGE.)",\n`;
            generatedGameStateIndicators += `"combat_engaged": "boolean (Set to true IF combat begins THIS turn. Otherwise, maintain previous state unless explicitly changing based on narrative events like escape or victory.)",\n`;
            generatedGameStateIndicators += `"comms_channel_active": "boolean (Set to true if a direct communication channel is now active as a result of this turn's events, false if it closed, or maintain previous state if unchanged.)"`;
        }

        // --- Fetch theme-specific instructions for this prompt type ---
        const instructionKeyNamePart = basePromptKey; // Corrected: basePromptKey is already the stem like "master_initial" or "combat_engaged"
        let themeSpecificInstructions = ""; 
        if (instructionKeyNamePart) {
            const themeInstructionTextKey = `theme_instructions_${instructionKeyNamePart}_${currentTheme}`;
            const fetchedInstruction = getUIText(themeInstructionTextKey, {}, currentTheme);
            if (fetchedInstruction !== themeInstructionTextKey && fetchedInstruction.trim() !== "") {
                themeSpecificInstructions = fetchedInstruction;
            } else {
                // console.log(`No specific instruction found for key: ${themeInstructionTextKey}, using empty string.`);
                themeSpecificInstructions = "No specific instructions provided for this context."; // Default if no specific instruction is found or key itself is returned
            }
        }


        // --- Placeholder Replacements ---
        const narrativeLangInstruction = NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[currentTheme]?.[currentNarrativeLanguage] ||
                                     NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[DEFAULT_THEME_ID]?.[currentNarrativeLanguage] ||
                                     NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[DEFAULT_THEME_ID]?.[DEFAULT_LANGUAGE] ||
                                     `The narrative must be in ${currentNarrativeLanguage.toUpperCase()}.`; 

        let processedPromptText = basePromptText; 

        processedPromptText = processedPromptText.replace(/\$\{narrativeLanguageInstruction\}/g, narrativeLangInstruction);
        processedPromptText = processedPromptText.replace(/\$\{currentNameForPrompt\}/g, currentPlayerIdentifierParam || getUIText('unknown'));
        processedPromptText = processedPromptText.replace(/\$\{currentPlayerIdentifier\}/g, currentPlayerIdentifierParam || getUIText('unknown'));
        processedPromptText = processedPromptText.replace(/\$\{currentNarrativeLanguage\.toUpperCase\(\)\}/g, currentNarrativeLanguage.toUpperCase());

        processedPromptText = processedPromptText.replace(/\$\{theme_name\}/g, getUIText(themeConfig.name_key, {}, currentTheme));
        processedPromptText = processedPromptText.replace(/\$\{theme_lore\}/g, getUIText(themeConfig.lore_key, {}, currentTheme));
        processedPromptText = processedPromptText.replace(/\$\{theme_category\}/g, getUIText(themeConfig.category_key || `theme_category_${currentTheme}`, {}, currentTheme));
        processedPromptText = processedPromptText.replace(/\$\{theme_style\}/g, getUIText(themeConfig.style_key || `theme_style_${currentTheme}`, {}, currentTheme));
        processedPromptText = processedPromptText.replace(/\$\{theme_inspiration\}/g, getUIText(themeConfig.inspiration_key, {}, currentTheme));
        processedPromptText = processedPromptText.replace(/\$\{theme_concept\}/g, getUIText(themeConfig.concept_key, {}, currentTheme));
        
        processedPromptText = processedPromptText.replace(/\$\{theme_specific_instructions\}/g, themeSpecificInstructions); 
        
        processedPromptText = processedPromptText.replace(/\$\{generated_dashboard_description\}/g, generatedDashboardDescription);
        processedPromptText = processedPromptText.replace(/\$\{generated_game_state_indicators\}/g, generatedGameStateIndicators);

        if (promptTypeToUse === 'initial' || basePromptKey === 'master_initial') {
            if (gamePrompts[currentTheme]?.starts) {
                const allStarts = gamePrompts[currentTheme].starts.split('\n').map(s => s.trim()).filter(s => s.length > 0);
                const selectedStarts = allStarts.length > 0 ? [...allStarts].sort(() => 0.5 - Math.random()).slice(0, 3) : [];
                ['startIdea1', 'startIdea2', 'startIdea3'].forEach((placeholder, i) => {
                    processedPromptText = processedPromptText.replace(new RegExp(`\\$\\{${placeholder}\\}`, 'g'), selectedStarts[i] || `Generic ${currentTheme} scenario ${i + 1}`);
                });
            }

            let assetNamesContent = null;
            const assetKey = `asset_names_${currentNarrativeLanguage}`; 
            const entityKey = `entity_names_${currentNarrativeLanguage}`; 
            const fallbackAssetKey = 'asset_names_en';
            const fallbackEntityKey = 'entity_names_en';

            if (themeConfig.naming_convention === 'entity' && gamePrompts[currentTheme]?.[entityKey] && isValidPromptText(gamePrompts[currentTheme][entityKey])) {
                assetNamesContent = gamePrompts[currentTheme][entityKey];
            } else if (themeConfig.naming_convention === 'asset' && gamePrompts[currentTheme]?.[assetKey] && isValidPromptText(gamePrompts[currentTheme][assetKey])) {
                 assetNamesContent = gamePrompts[currentTheme][assetKey];
            } else { 
                if (gamePrompts[currentTheme]?.[assetKey] && isValidPromptText(gamePrompts[currentTheme][assetKey])) assetNamesContent = gamePrompts[currentTheme][assetKey];
                else if (gamePrompts[currentTheme]?.[entityKey] && isValidPromptText(gamePrompts[currentTheme][entityKey])) assetNamesContent = gamePrompts[currentTheme][entityKey];
                else if (gamePrompts[currentTheme]?.[fallbackAssetKey] && isValidPromptText(gamePrompts[currentTheme][fallbackAssetKey])) assetNamesContent = gamePrompts[currentTheme][fallbackAssetKey];
                else if (gamePrompts[currentTheme]?.[fallbackEntityKey] && isValidPromptText(gamePrompts[currentTheme][fallbackEntityKey])) assetNamesContent = gamePrompts[currentTheme][fallbackEntityKey];
            }
            
            if (assetNamesContent) {
                const allAssets = assetNamesContent.split('\n').map(n => n.trim()).filter(n => n.length > 0);
                const selectedAssets = allAssets.length > 0 ? [...allAssets].sort(() => 0.5 - Math.random()).slice(0, 3) : [];
                ['suggestedName1', 'suggestedName2', 'suggestedName3', 
                 'suggestedItemName1', 'suggestedItemName2', 'suggestedItemName3', 
                 'suggestedLocationName1', 'suggestedLocationName2', 'suggestedLocationName3'].forEach((ph, iMod) => {
                    const i = iMod % 3;
                    processedPromptText = processedPromptText.replace(new RegExp(`\\$\\{${ph}\\}`, 'g'), selectedAssets[i] || `Invented${ph.replace('suggested','').replace(/Name\d/,'Name')}${i + 1}`);
                });
                 if (themeConfig.naming_convention === 'asset' || currentTheme === 'scifi') { 
                    ['suggestedShipName1', 'suggestedShipName2', 'suggestedShipName3'].forEach((ph, iMod) => {
                       const i = iMod % 3;
                       processedPromptText = processedPromptText.replace(new RegExp(`\\$\\{${ph}\\}`, 'g'), selectedAssets[i] || `DefaultAssetName${i + 1}`);
                    });
                }
            } else {
                 ['suggestedName1', 'suggestedName2', 'suggestedName3', 'suggestedShipName1', 'suggestedShipName2', 'suggestedShipName3',
                  'suggestedItemName1', 'suggestedItemName2', 'suggestedItemName3', 
                  'suggestedLocationName1', 'suggestedLocationName2', 'suggestedLocationName3'].forEach((ph, i) => {
                     processedPromptText = processedPromptText.replace(new RegExp(`\\$\\{${ph}\\}`, 'g'), `InventedPlaceholder${i + 1}`);
                 });
            }
        }
        
        return processedPromptText;
    };

    /**
     * Toggles UI elements to indicate AI processing status.
     * @param {boolean} isProcessing - True if AI is currently processing, false otherwise.
     */
    function setGMActivity(isProcessing) {
        if (gmSpecificActivityIndicator) gmSpecificActivityIndicator.style.display = isProcessing ? 'inline-flex' : 'none';
        if (systemStatusIndicator) systemStatusIndicator.style.display = isProcessing ? 'none' : 'inline-flex'; // Hide system status during GM activity

        // Disable input fields and buttons during processing
        if (playerActionInput) playerActionInput.disabled = isProcessing;
        if (sendActionButton) sendActionButton.disabled = isProcessing;
        document.querySelectorAll('#suggested-actions-wrapper .ui-button').forEach(btn => btn.disabled = isProcessing);

        // Focus input field when processing ends, if applicable
        if (!isProcessing && actionInputSection?.style.display !== 'none' && playerActionInput && document.body.contains(playerActionInput)) {
            playerActionInput.focus();
        }
    }

    /**
     * Briefly highlights a UI element to indicate an update.
     * @param {HTMLElement} element - The DOM element (or its child) to highlight.
     */
    function highlightElementUpdate(element) {
        if (!element) return;
        const target = element.closest('.info-item, .info-item-meter'); // Find the parent container to highlight
        if (target) {
            target.classList.add('value-updated');
            setTimeout(() => target.classList.remove('value-updated'), UPDATE_HIGHLIGHT_DURATION);
        }
    }

    /**
     * Adds a message to the story log.
     * @param {string} text - The message text.
     * @param {string} sender - The sender type ('player', 'gm', 'system', 'system-error').
     */
    function addMessageToLog(text, sender) {
        if (!storyLog) {
            console.log(`Message (${sender}): ${text} (storyLog element not found)`);
            return;
        }
        // Avoid logging duplicate initial player identifier messages
        if (sender === 'player' && gameHistory.length > 0 && gameHistory[0].role === 'user' &&
            text === gameHistory[0].parts[0].text && text.startsWith(`My identifier is`)) {
            return;
        }

        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', `${sender}-message`);

        // Basic markdown-like formatting for italics (_text_ or *text*)
        const processedText = text.replace(/_([^_]+)_|\*([^*]+)\*/g, (match, p1, p2) => `<em>${p1 || p2}</em>`);

        // Split text into paragraphs based on double newlines, preserving single newlines as <br>
        const paragraphs = processedText.split(/\n\s*\n/).filter(p => p.trim() !== '');
        if (paragraphs.length === 0 && processedText.trim() !== '') {
            // Handle case where text has no double newlines but is not empty
            paragraphs.push(processedText.trim());
        }

        paragraphs.forEach(para => {
            const pElement = document.createElement('p');
            pElement.innerHTML = para.replace(/\n/g, '<br>'); // Convert single newlines to <br>
            msgDiv.appendChild(pElement);
        });

        // Auto-scroll logic
        const viewport = storyLog.parentElement; // storyLogViewport
        let shouldScroll = false;
        if (viewport && storyLogViewport.style.display !== 'none') { // Check if viewport is visible
            if (!userHasManuallyScrolledLog) {
                shouldScroll = true;
            } else {
                // If user scrolled up, only auto-scroll if they are close to the bottom
                if (viewport.scrollHeight - viewport.clientHeight <= viewport.scrollTop + AUTOSCROLL_THRESHOLD) {
                    shouldScroll = true;
                    userHasManuallyScrolledLog = false; // Reset manual scroll flag
                }
            }
        }

        storyLog.appendChild(msgDiv);

        if (shouldScroll && viewport) {
            viewport.scrollTop = viewport.scrollHeight; // Scroll to the bottom
        }
    }

    /**
     * Displays AI-suggested actions as clickable buttons.
     * @param {string[]} actions - An array of action strings.
     */
    function displaySuggestedActions(actions) {
        if (!suggestedActionsWrapper || suggestedActionsWrapper.style.display === 'none') return;

        suggestedActionsWrapper.innerHTML = ''; // Clear previous suggestions
        if (actions && Array.isArray(actions) && actions.length > 0) {
            actions.slice(0, 3).forEach(actionTxt => { // Display up to 3 suggestions
                if (typeof actionTxt === 'string' && actionTxt.trim() !== '') {
                    const btn = document.createElement('button');
                    btn.classList.add('ui-button');
                    btn.textContent = actionTxt;
                    btn.addEventListener('click', () => {
                        if (playerActionInput) {
                            playerActionInput.value = actionTxt; // Populate input field
                            playerActionInput.focus();
                            playerActionInput.dispatchEvent(new Event('input', { bubbles: true })); // Trigger auto-grow
                            autoGrowTextarea(playerActionInput);
                        }
                    });
                    suggestedActionsWrapper.appendChild(btn);
                }
            });
        }
    }

    /**
     * Clears any displayed suggested actions.
     */
    function clearSuggestedActions() {
        if (suggestedActionsWrapper) suggestedActionsWrapper.innerHTML = '';
    }

    /**
     * Updates a UI meter element (progress bar and text).
     * @param {HTMLElement|null} barEl - The meter bar element.
     * @param {HTMLElement|null} textEl - The text element displaying meter value/status.
     * @param {string|number|null} newPctStr - The new percentage value (as string or number) or status text like "---".
     * @param {string} meterType - Type of meter (e.g., 'shields', 'fuel', 'mana') for specific styling/logic.
     * @param {object} opts - Options: highlight (boolean), newStatusText (string), initialPlaceholder (string).
     * @returns {boolean} True if an update was made to the DOM, false otherwise.
     */
    const setMeter = (barEl, textEl, newPctStr, meterType, opts = {}) => {
        const { highlight = true, newStatusText, initialPlaceholder } = opts;
        let updatedOccurred = false;

        // Handle text-only meters (no bar element)
        if (!barEl) {
            if (textEl && newPctStr !== undefined && newPctStr !== null) {
                const na = getUIText('not_available_short'), unk = getUIText('unknown');
                // Format percentage or display status text
                const newContent = (newPctStr === "---" || newPctStr === na || String(newPctStr).toLowerCase() === unk.toLowerCase())
                    ? newPctStr
                    : `${parseInt(newPctStr, 10)}%`;
                if (textEl.textContent !== newContent) {
                    textEl.textContent = newContent;
                    updatedOccurred = true;
                }
            }
            return updatedOccurred;
        }

        let finalPct = -1; // Parsed percentage
        if (newPctStr !== undefined && newPctStr !== null) {
            let parsedPct = parseInt(newPctStr, 10);
            if (!isNaN(parsedPct)) {
                finalPct = Math.max(0, Math.min(100, parsedPct)); // Clamp between 0-100
            } else {
                // Handle non-numeric status texts like "---", "N/A", "Unknown"
                const na = getUIText('not_available_short'), unk = getUIText('unknown');
                if (textEl && (newPctStr === "---" || newPctStr === na || String(newPctStr).toLowerCase() === unk.toLowerCase())) {
                    if (textEl.textContent !== newPctStr) { textEl.textContent = newPctStr; updatedOccurred = true; }
                    if (barEl.style.width !== '0%') { barEl.style.width = '0%'; updatedOccurred = true; }
                    // Clear existing meter classes
                    const oldClasses = Array.from(barEl.classList).filter(c => c.startsWith('meter-'));
                    if (oldClasses.length > 0) updatedOccurred = true;
                    oldClasses.forEach(c => barEl.classList.remove(c));
                    return updatedOccurred;
                }
                // Default percentage if input is invalid (e.g., 0 for depleting, 100 for refilling)
                finalPct = (meterType === 'shields' || meterType === 'enemy_shields' || meterType === 'mana') ? 0 : 100;
            }
        } else {
            // If newPctStr is null, try to parse from existing text or use initial placeholder
            if (textEl) { const match = textEl.textContent.match(/(\d+)%/); if (match) finalPct = parseInt(match[1], 10); }
            if (finalPct === -1) { // Still not determined
                const placeholderMatch = initialPlaceholder ? initialPlaceholder.match(/(\d+)%/) : null;
                finalPct = placeholderMatch ? parseInt(placeholderMatch[1], 10) : ((meterType === 'shields' || meterType === 'enemy_shields' || meterType === 'mana') ? 0 : 100);
            }
        }
        finalPct = Math.max(0, Math.min(100, finalPct)); // Ensure clamped

        // Determine status text (e.g., Online/Offline for shields)
        let finalStatusTxt = null;
        if (meterType === 'shields' || meterType === 'enemy_shields') {
            if (newStatusText !== undefined && newStatusText !== null) {
                finalStatusTxt = newStatusText;
            } else {
                // Try to parse current status from DOM if not provided
                let currentDomStatus = null;
                if (textEl) { const match = textEl.textContent.match(/^(.*?):\s*(\d+)%/); if (match && match[1]) currentDomStatus = match[1].trim(); }
                finalStatusTxt = currentDomStatus || (finalPct > 0 ? getUIText('online') : getUIText('offline'));
            }
            if (finalPct === 0) finalStatusTxt = getUIText('offline'); // Force offline if 0%
            else if (finalStatusTxt && finalStatusTxt.toLowerCase() === getUIText('offline').toLowerCase()) finalStatusTxt = getUIText('online'); // Force online if >0% and was offline
        } else if ((meterType === 'mana' || meterType === 'stamina') && newStatusText !== undefined && newStatusText !== null) {
            finalStatusTxt = newStatusText;
        }

        // Construct the final display text
        let newDisplayText = '';
        if (meterType === 'shields' || meterType === 'enemy_shields') {
            newDisplayText = `${finalStatusTxt || getUIText('unknown')}: ${finalPct}%`;
        } else if ((meterType === 'mana' || meterType === 'stamina') && finalStatusTxt && finalStatusTxt.toLowerCase() !== getUIText('unknown').toLowerCase()) {
            newDisplayText = `${finalStatusTxt}: ${finalPct}%`;
        } else {
            newDisplayText = `${finalPct}%`;
        }

        // Determine CSS classes for the meter bar based on value and type
        let newBarClasses = [];
        const isOffline = (meterType === 'shields' || meterType === 'enemy_shields') && finalStatusTxt && finalStatusTxt.toLowerCase() === getUIText('offline').toLowerCase();
        if (isOffline) {
            newBarClasses.push('meter-offline');
        } else {
            if (finalPct === 0 && !isOffline) newBarClasses.push('meter-critical'); // 0% but not explicitly offline
            else if (finalPct > 0 && finalPct <= 10) newBarClasses.push('meter-critical');
            else if (finalPct > 10 && finalPct <= 25) newBarClasses.push('meter-low');
            else if (finalPct > 25 && finalPct <= 50) newBarClasses.push('meter-medium');
            else { // Above 50%
                newBarClasses.push('meter-full'); // General full class
                // Type-specific 'ok' classes
                if (meterType === 'shields' || meterType === 'enemy_shields') newBarClasses.push('meter-ok-shield');
                else if (meterType === 'fuel') newBarClasses.push('meter-ok-fuel');
                else if (meterType === 'stamina') newBarClasses.push('meter-ok-stamina');
                else if (meterType === 'mana') newBarClasses.push('meter-ok-mana');
            }
        }

        // Apply updates to DOM
        if (textEl && textEl.textContent !== newDisplayText) { textEl.textContent = newDisplayText; updatedOccurred = true; }
        if (barEl.style.width !== `${finalPct}%`) { barEl.style.width = `${finalPct}%`; updatedOccurred = true; }

        // Update bar classes if they changed
        const existingClasses = Array.from(barEl.classList).filter(cls => cls.startsWith('meter-'));
        let classesDiffer = newBarClasses.length !== existingClasses.length || !newBarClasses.every(cls => existingClasses.includes(cls));
        if (classesDiffer) {
            existingClasses.forEach(cls => { if (cls !== 'meter-bar') barEl.classList.remove(cls); }); // Remove old state classes
            if (!barEl.classList.contains('meter-bar')) barEl.classList.add('meter-bar'); // Ensure base class
            newBarClasses.forEach(cls => { if (cls && cls.trim() !== '' && cls !== 'meter-bar') barEl.classList.add(cls); }); // Add new state classes
            updatedOccurred = true;
        } else if (!barEl.classList.contains('meter-bar')) { // Ensure base class even if no state change
            barEl.classList.add('meter-bar');
        }

        if (highlight && updatedOccurred) {
            const containerToHighlight = textEl ? textEl.closest('.info-item, .info-item-meter') : barEl.closest('.info-item, .info-item-meter');
            if (containerToHighlight) highlightElementUpdate(containerToHighlight);
        }
        return updatedOccurred;
    };

    /**
     * Finds the parent panel configuration for a given dashboard item ID.
     * @param {string} itemId - The ID of the dashboard item.
     * @param {object} dashboardConfig - The dashboard configuration object for the current theme.
     * @returns {object|null} The panel configuration object or null if not found.
     */
    function getParentPanelConfig(itemId, dashboardConfig) {
        if (!dashboardConfig) return null;
        for (const panelSideKey of ['left_panel', 'right_panel']) {
            if (dashboardConfig[panelSideKey]) {
                for (const panelConfig of dashboardConfig[panelSideKey]) {
                    if (panelConfig.items && panelConfig.items.some(item => item.id === itemId)) {
                        return panelConfig;
                    }
                }
            }
        }
        return null;
    }

    /**
     * Updates the dashboard UI elements based on data from the AI.
     * @param {object} updatesFromAI - An object where keys are item IDs and values are new values.
     * @param {boolean} highlightChanges - Whether to visually highlight updated elements.
     */
    function updateDashboard(updatesFromAI, highlightChanges = true) {
        if (!updatesFromAI || Object.keys(updatesFromAI).length === 0 || !currentTheme) return;

        const currentThemeFullConfig = ALL_THEMES_CONFIG[currentTheme];
        if (!currentThemeFullConfig) return;
        const themeCfg = THEME_DASHBOARD_CONFIGS[currentThemeFullConfig.dashboard_config_ref];
        if (!themeCfg) return;

        const allItems = [...(themeCfg.left_panel || []).flatMap(b => b.items), ...(themeCfg.right_panel || []).flatMap(b => b.items)];
        const itemConfigsMap = new Map(allItems.map(i => [i.id, i]));

        for (const key in updatesFromAI) {
            if (Object.prototype.hasOwnProperty.call(updatesFromAI, key)) {
                const value = updatesFromAI[key];
                let itemCfg = itemConfigsMap.get(key);
                let actualUpdateOccurred = false;

                // Handle player identifier update specifically
                if (key === 'name' || key === 'character_name') {
                    // Ensure we're updating the correct item ID based on current theme config
                    const playerIdentifierItemId = (themeCfg.left_panel || []).flatMap(p => p.items)
                        .find(i => i.id === 'name' || i.id === 'character_name')?.id;
                    if (key === playerIdentifierItemId) {
                        itemCfg = itemConfigsMap.get(playerIdentifierItemId);
                        playerIdentifier = String(value); // Update global playerIdentifier
                    } else if (!itemCfg) { // If key is 'name' but theme uses 'character_name' or vice-versa, find the correct config
                         itemCfg = itemConfigsMap.get(playerIdentifierItemId);
                         if (itemCfg) playerIdentifier = String(value);
                    }
                }
                
                if (!itemCfg) continue; 

                const valueElement = document.getElementById(`info-${itemCfg.id}`);
                const meterBarElement = document.getElementById(`meter-${itemCfg.id}`);

                if (itemCfg.type === 'meter') {
                    if (valueElement || meterBarElement) {
                        actualUpdateOccurred = setMeter(meterBarElement, valueElement, String(value), itemCfg.meter_type, {
                            highlight: highlightChanges,
                            newStatusText: itemCfg.status_text_id ? updatesFromAI[itemCfg.status_text_id] : undefined
                        });
                    }
                } else if (itemCfg.type === 'status_text') {
                    if (valueElement) {
                        const newStatusText = String(value);
                        let statusClass = 'status-info'; 
                        const lowerValue = newStatusText.toLowerCase();
                        
                        if (itemCfg.id === 'alertLevel' || itemCfg.id === 'alert_level') { // alert_level for fantasy
                            if (lowerValue.includes(getUIText('alert_level_danger_val', {}, currentTheme).toLowerCase())) statusClass = 'status-danger';
                            else if (lowerValue.includes(getUIText('alert_level_wary_val', {}, currentTheme).toLowerCase()) || lowerValue.includes(getUIText('alert_level_yellow_val', {}, currentTheme).toLowerCase())) statusClass = 'status-warning';
                            else if (lowerValue.includes(getUIText('alert_level_calm_val', {}, currentTheme).toLowerCase()) || lowerValue.includes(getUIText('alert_level_green_val', {}, currentTheme).toLowerCase())) statusClass = 'status-ok';
                        }
                        if (valueElement.textContent !== newStatusText || !valueElement.className.includes(statusClass)) {
                            valueElement.textContent = newStatusText;
                            valueElement.className = `value ${statusClass}`; 
                            if (highlightChanges) highlightElementUpdate(valueElement);
                            actualUpdateOccurred = true;
                        }
                    }
                } else { 
                    if (valueElement) {
                        const suffix = itemCfg.suffix || '';
                        const newValueText = `${value}${suffix}`;
                        if (valueElement.textContent !== newValueText) {
                            valueElement.textContent = newValueText;
                            if (highlightChanges) highlightElementUpdate(valueElement);
                            actualUpdateOccurred = true;
                        }
                    }
                }

                if (actualUpdateOccurred) {
                    const parentPanelConfig = getParentPanelConfig(itemCfg.id, themeCfg); // Use itemCfg.id
                    if (parentPanelConfig && parentPanelConfig.type === 'collapsible') {
                        const panelElement = document.getElementById(parentPanelConfig.id);
                        if (panelElement && !panelElement.classList.contains('is-expanded')) {
                            animatePanelBox(parentPanelConfig.id, true, false); 
                        }
                    }
                }
            }
        }
        lastKnownDashboardUpdates = { ...lastKnownDashboardUpdates, ...updatesFromAI };
    }

    /**
     * Initializes dashboard elements with their default texts and values based on theme config.
     */
    function initializeDashboardDefaultTexts() {
        if (!currentTheme) return;
        const currentThemeFullConfig = ALL_THEMES_CONFIG[currentTheme];
        if (!currentThemeFullConfig) return;
        const themeCfg = THEME_DASHBOARD_CONFIGS[currentThemeFullConfig.dashboard_config_ref];
        if (!themeCfg) return;

        ['left_panel', 'right_panel'].forEach(sideKey => {
            if (!themeCfg[sideKey]) return;
            themeCfg[sideKey].forEach(boxCfg => {
                boxCfg.items.forEach(itemCfg => {
                    const valueEl = document.getElementById(`info-${itemCfg.id}`);
                    const meterBarEl = document.getElementById(`meter-${itemCfg.id}`);
                    const defaultValue = itemCfg.default_value !== undefined ? String(itemCfg.default_value) : getUIText(itemCfg.default_value_key);

                    if (itemCfg.type === 'meter') {
                        if (valueEl || meterBarEl) {
                            const defaultStatus = itemCfg.default_status_key ? getUIText(itemCfg.default_status_key) : getUIText('offline');
                            setMeter(meterBarEl, valueEl, defaultValue, itemCfg.meter_type, {
                                highlight: false,
                                newStatusText: defaultStatus,
                                initialPlaceholder: `${defaultStatus}: ${defaultValue}%`
                            });
                        }
                    } else if (itemCfg.type === 'status_text') {
                        if (valueEl) {
                            const displayDefault = getUIText(itemCfg.default_value_key);
                            const statusValueDefault = itemCfg.default_status_key ? getUIText(itemCfg.default_status_key) : displayDefault;
                            valueEl.textContent = displayDefault;
                            let statusClass = 'status-info';
                            const lowerValue = statusValueDefault.toLowerCase();
                            if (itemCfg.id === 'alertLevel' || itemCfg.id === 'alert_level') { // alert_level for fantasy
                                if (lowerValue.includes(getUIText('alert_level_danger_val', {}, currentTheme).toLowerCase())) statusClass = 'status-danger';
                                else if (lowerValue.includes(getUIText('alert_level_wary_val', {}, currentTheme).toLowerCase()) || lowerValue.includes(getUIText('alert_level_yellow_val', {}, currentTheme).toLowerCase())) statusClass = 'status-warning';
                                else if (lowerValue.includes(getUIText('alert_level_calm_val', {}, currentTheme).toLowerCase()) || lowerValue.includes(getUIText('alert_level_green_val', {}, currentTheme).toLowerCase())) statusClass = 'status-ok';
                            }
                            valueEl.className = `value ${statusClass}`;
                        }
                    } else { 
                        if (valueEl) {
                            const suffix = itemCfg.suffix || '';
                            valueEl.textContent = `${defaultValue}${suffix}`;
                        }
                    }
                });
            });
        });

        // Set player identifier specifically using its configured ID ('name' or 'character_name')
        const playerIdentifierItemId = (themeCfg.left_panel || []).flatMap(p => p.items)
            .find(item => item.id === 'name' || item.id === 'character_name')?.id;
        
        if (playerIdentifierItemId) {
            const idCfg = findItemConfigById(themeCfg, playerIdentifierItemId);
            if (idCfg) {
                const el = document.getElementById(`info-${idCfg.id}`);
                if (el) el.textContent = playerIdentifier || getUIText(idCfg.default_value_key);
            }
        }
    }

    /**
     * Finds a specific item's configuration within the theme's dashboard structure.
     * @param {object} themeDashCfg - The dashboard configuration for the current theme.
     * @param {string} itemId - The ID of the item to find.
     * @returns {object|null} The item configuration object or null if not found.
     */
    function findItemConfigById(themeDashCfg, itemId) {
        if (!themeDashCfg) return null;
        for (const sideKey of ['left_panel', 'right_panel']) {
            if (!themeDashCfg[sideKey]) continue;
            for (const boxCfg of themeDashCfg[sideKey]) {
                const foundItem = boxCfg.items.find(i => i.id === itemId);
                if (foundItem) return foundItem;
            }
        }
        return null;
    }

    /**
     * Automatically adjusts the height of a textarea to fit its content.
     * @param {HTMLTextAreaElement} textarea - The textarea element.
     */
    function autoGrowTextarea(textarea) {
        if (!textarea) return;
        textarea.style.height = 'auto'; // Reset height to shrink if needed
        let newHeight = textarea.scrollHeight;
        const maxHeight = parseInt(window.getComputedStyle(textarea).maxHeight, 10) || Infinity;

        if (newHeight > maxHeight) {
            newHeight = maxHeight;
            textarea.style.overflowY = 'auto'; // Enable scrollbar if max height reached
        } else {
            textarea.style.overflowY = 'hidden'; // Hide scrollbar if within max height
        }
        textarea.style.height = newHeight + 'px';
    }

    /**
     * Animates the expansion or collapse of a panel box.
     * @param {string} boxId - The ID of the panel box element.
     * @param {boolean} shouldExpand - True to expand, false to collapse.
     * @param {boolean} manageVisibility - True if the panel's display property should be managed (for initially hidden panels).
     */
    function animatePanelBox(boxId, shouldExpand, manageVisibility = false) {
        const box = document.getElementById(boxId); if (!box) return;
        const header = box.querySelector('.panel-box-header');
        const content = box.querySelector('.panel-box-content');
        if (!header || !content) return;

        // const isCurrentlyExpanded = box.classList.contains('is-expanded'); // Not strictly needed here

        if (shouldExpand) {
            // If managing visibility and box is hidden, make it visible before animation
            if (box.style.display === 'none' && manageVisibility) {
                box.style.opacity = '0'; // Start transparent for fade-in
                box.style.display = 'flex';
            } else if (box.style.display === 'none') { // Just make it visible if not managing opacity
                box.style.display = 'flex';
            }

            // Use requestAnimationFrame to ensure style changes are applied before transition starts
            requestAnimationFrame(() => {
                box.classList.add('is-expanded');
                if (manageVisibility) box.style.opacity = '1'; // Fade in
                header.setAttribute('aria-expanded', 'true');
                content.setAttribute('aria-hidden', 'false');
            });
        } else { // Collapse
            box.classList.remove('is-expanded');
            header.setAttribute('aria-expanded', 'false');
            content.setAttribute('aria-hidden', 'true');

            if (manageVisibility) {
                box.style.opacity = '0'; // Start fade-out
                // Get transition duration from CSS to hide element after transition
                const transitionDuration = parseFloat(getComputedStyle(content).transitionDuration.replace('s', '')) * 1000 || 300;

                const onHideTransitionEnd = (event) => {
                    // Ensure we're reacting to the correct element's transition
                    if (event.target === content || event.target === box) {
                        if (!box.classList.contains('is-expanded')) { // Double-check it's still meant to be hidden
                            box.style.display = 'none';
                            content.style.display = ''; // Reset content display (might be set by CSS)
                        }
                        content.removeEventListener('transitionend', onHideTransitionEnd);
                        box.removeEventListener('transitionend', onHideTransitionEnd);
                    }
                };
                content.addEventListener('transitionend', onHideTransitionEnd);
                box.addEventListener('transitionend', onHideTransitionEnd); // Listen on box too as opacity might transition on it

                // Fallback timeout in case transitionend doesn't fire
                setTimeout(() => {
                    if (!box.classList.contains('is-expanded') && box.style.opacity === '0') {
                        box.style.display = 'none';
                        content.style.display = '';
                    }
                }, transitionDuration + 100); // Add a small buffer
            } else {
                // If not managing visibility, panel just collapses but remains in layout
            }
        }
    }

    /**
     * Initializes collapsible panel boxes for a given theme, setting up click/keyboard listeners.
     * @param {string} themeIdForPanels - The ID of the theme whose panels are being initialized.
     */
    function initializeCollapsiblePanelBoxes(themeIdForPanels) {
        const themeFullConfig = ALL_THEMES_CONFIG[themeIdForPanels];
        if (!themeFullConfig) return;
        const themeCfg = THEME_DASHBOARD_CONFIGS[themeFullConfig.dashboard_config_ref];
        if (!themeCfg) return;

        const allPanelConfigs = [...(themeCfg.left_panel || []), ...(themeCfg.right_panel || [])];
        allPanelConfigs.forEach(boxCfg => {
            const boxElement = document.getElementById(boxCfg.id); if (!boxElement) return;
            const headerElement = boxElement.querySelector('.panel-box-header');
            if (!headerElement) return;

            // Add listeners for collapsible or initially hidden panels
            if (boxCfg.type === 'collapsible' || boxCfg.type === 'hidden_until_active') {
                headerElement.addEventListener('click', () => {
                    // Only toggle if visible (collapsible) or if it's a 'hidden_until_active' type
                    if (boxElement.style.display !== 'none' || boxCfg.type === 'collapsible') {
                        animatePanelBox(boxCfg.id, !boxElement.classList.contains('is-expanded'), boxCfg.type === 'hidden_until_active');
                    }
                });
                headerElement.setAttribute('tabindex', '0'); // Make focusable
                headerElement.addEventListener('keydown', (e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && (boxElement.style.display !== 'none' || boxCfg.type === 'collapsible')) {
                        e.preventDefault();
                        animatePanelBox(boxCfg.id, !boxElement.classList.contains('is-expanded'), boxCfg.type === 'hidden_until_active');
                    }
                });
            }

            // Set initial state based on panel type
            if (boxCfg.type === 'static') {
                boxElement.style.display = 'flex'; boxElement.style.opacity = '1';
                animatePanelBox(boxCfg.id, true, false); // Always expanded, no visibility management
            } else if (boxCfg.type === 'hidden_until_active') {
                boxElement.style.display = 'none'; boxElement.style.opacity = '0';
                animatePanelBox(boxCfg.id, false, true); // Initially collapsed and hidden
            } else { // Default collapsible
                boxElement.style.display = 'flex'; boxElement.style.opacity = '1';
                const delay = boxCfg.boot_delay || 0; // Optional boot delay for animation
                setTimeout(() => animatePanelBox(boxCfg.id, boxCfg.initial_expanded || false, false), delay);
            }
        });
    }

    /**
     * Updates the text and ARIA attributes of the AI model toggle button.
     */
    function updateModelToggleButtonText() {
        if (!modelToggleButton) return;
        const isPaidModel = currentModelName === PAID_MODEL_NAME;
        const textKey = isPaidModel ? "button_toggle_to_free" : "button_toggle_to_paid";
        const ariaKey = isPaidModel ? "aria_label_current_model_paid" : "aria_label_current_model_free";

        modelToggleButton.textContent = getUIText(textKey, { MODEL_NAME: currentModelName });
        const ariaLabel = getUIText(ariaKey, { MODEL_NAME: currentModelName });
        modelToggleButton.setAttribute('aria-label', ariaLabel);
        modelToggleButton.title = ariaLabel; // Tooltip
    }

    /**
     * Saves the lists of playing and liked themes to localStorage.
     */
    function saveThemeListsToStorage() {
        localStorage.setItem(PLAYING_THEMES_STORAGE_KEY, JSON.stringify(playingThemes));
        localStorage.setItem(LIKED_THEMES_STORAGE_KEY, JSON.stringify(likedThemes));
    }

    /**
     * Loads the lists of playing and liked themes from localStorage.
     */
    function loadThemeListsFromStorage() {
        playingThemes = JSON.parse(localStorage.getItem(PLAYING_THEMES_STORAGE_KEY) || '[]');
        likedThemes = JSON.parse(localStorage.getItem(LIKED_THEMES_STORAGE_KEY) || '[]');
    }

    /** Checks if a theme is in the 'playing' list. */
    function isThemePlaying(themeId) {
        return playingThemes.includes(themeId);
    }

    /** Checks if a theme is in the 'liked' list. */
    function isThemeLiked(themeId) {
        return likedThemes.includes(themeId);
    }

    /**
     * Adds a theme to the 'playing' list (moves to front if already present).
     * @param {string} themeId - The ID of the theme to add.
     */
    function addPlayingTheme(themeId) {
        if (!isThemePlaying(themeId)) {
            // Remove if present to move to front (most recently played)
            const currentIndex = playingThemes.indexOf(themeId);
            if (currentIndex > -1) {
                playingThemes.splice(currentIndex, 1);
            }
            playingThemes.unshift(themeId); // Add to the beginning
        }
        saveThemeListsToStorage();
        updateTopbarThemeIcons();
    }

    /**
     * Adds a theme to the 'liked' list.
     * @param {string} themeId - The ID of the theme to like.
     */
    function addLikedTheme(themeId) {
        if (!isThemeLiked(themeId)) {
            likedThemes.push(themeId);
            saveThemeListsToStorage();
            updateTopbarThemeIcons();

            // Update like button on landing page if this theme is selected
            if (!currentTheme && currentLandingGridSelection === themeId) {
                const likeButton = document.getElementById('like-theme-button');
                if (likeButton) {
                    likeButton.innerHTML = `<img src="images/app/icon_heart_filled.svg" alt="${getUIText('aria_label_unlike_theme')}" class="like-icon">`;
                    likeButton.setAttribute('aria-label', getUIText('aria_label_unlike_theme'));
                    likeButton.title = likeButton.getAttribute('aria-label');
                    likeButton.classList.add('liked');
                }
            }
        }
    }

    /**
     * Removes a theme from the 'playing' list. Optionally moves it to 'liked' if not already liked.
     * @param {string} themeId - The ID of the theme to remove.
     * @param {boolean} moveToLiked - If true, add to liked list if not already there.
     */
    function removePlayingTheme(themeId, moveToLiked = true) {
        const index = playingThemes.indexOf(themeId);
        if (index > -1) {
            playingThemes.splice(index, 1);
            if (moveToLiked && !isThemeLiked(themeId)) {
                likedThemes.push(themeId);
            }
            saveThemeListsToStorage();
            updateTopbarThemeIcons();
        }
    }

    /**
     * Removes a theme from the 'liked' list.
     * @param {string} themeId - The ID of the theme to unlike.
     */
    function removeLikedTheme(themeId) {
        const index = likedThemes.indexOf(themeId);
        if (index > -1) {
            likedThemes.splice(index, 1);
            saveThemeListsToStorage();
            updateTopbarThemeIcons();

            // Update like button on landing page if this theme is selected
            if (!currentTheme && currentLandingGridSelection === themeId) {
                const likeButton = document.getElementById('like-theme-button');
                if (likeButton) {
                    likeButton.innerHTML = `<img src="images/app/icon_heart_empty.svg" alt="${getUIText('aria_label_like_theme')}" class="like-icon">`;
                    likeButton.setAttribute('aria-label', getUIText('aria_label_like_theme'));
                    likeButton.title = likeButton.getAttribute('aria-label');
                    likeButton.classList.remove('liked');
                }
            }
        }
    }

    /**
     * Handles closing a theme via its top bar icon (removes from playing/liked lists).
     * @param {string} themeId - The ID of the theme being closed.
     */
    function handleCloseTopbarIcon(themeId) {
        let wasPlaying = false;
        const playingIndex = playingThemes.indexOf(themeId);
        if (playingIndex > -1) {
            playingThemes.splice(playingIndex, 1);
            wasPlaying = true;
        }

        const likedIndex = likedThemes.indexOf(themeId);
        if (likedIndex > -1) {
            // If it was a 'playing' theme that was closed, it remains 'liked'.
            // If it was *only* a 'liked' theme icon (not in playingThemes), then remove from 'liked'.
            if (!wasPlaying) { // Only remove from liked if it wasn't a playing session
                likedThemes.splice(likedIndex, 1);
            }
        }

        saveThemeListsToStorage();
        updateTopbarThemeIcons();

        // If the currently active game theme was closed, switch to landing page
        if (wasPlaying && currentTheme === themeId) {
            currentTheme = null;
            localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
            switchToLandingView();
        }
    }

    /**
     * Creates a theme icon button for the top bar.
     * @param {string} themeId - The ID of the theme.
     * @param {string} type - 'playing' or 'liked'.
     * @returns {HTMLButtonElement|null} The created button element or null if theme config not found.
     */
    function createThemeTopbarIcon(themeId, type) {
        const themeConfig = ALL_THEMES_CONFIG[themeId];
        if (!themeConfig) return null;

        const isCurrentlyPlaying = isThemePlaying(themeId); // This is slightly misnamed, should be isListedAsPlaying
        // const isCurrentlyLiked = isThemeLiked(themeId); // Already known by `type` mostly

        const button = document.createElement('button');
        button.classList.add('theme-button');

        // Highlight if it's the *active* game theme
        if (isCurrentlyPlaying && themeId === currentTheme) {
            button.classList.add('active');
        }
        button.dataset.theme = themeId; // Store theme ID for event handling

        const themeNameText = getUIText(themeConfig.name_key, {}, themeId);

        // Set tooltip based on status
        let statusText = "";
        if (isCurrentlyPlaying) { // More accurately, if it's in the 'playingThemes' list
            statusText = getUIText('theme_icon_alt_text_playing');
        } else if (type === 'liked') { // Only show 'liked' status if it's not also 'playing'
            statusText = getUIText('theme_icon_alt_text_liked');
        }
        button.title = `${themeNameText}${statusText ? ` (${statusText})` : ''}`;

        const img = document.createElement('img');
        img.src = themeConfig.icon;
        img.alt = button.title; // Alt text for accessibility
        button.appendChild(img);

        // Add a close button to the icon
        const closeBtn = document.createElement('button');
        closeBtn.classList.add('theme-button-close');
        closeBtn.innerHTML = '×'; // Simple close symbol
        closeBtn.title = getUIText('close_theme_button_aria_label', { THEME_NAME: themeNameText });
        closeBtn.setAttribute('aria-label', closeBtn.title);
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the main button's click event
            handleCloseTopbarIcon(themeId);
        });
        button.appendChild(closeBtn);

        button.addEventListener('click', () => handleTopbarThemeIconClick(themeId));
        return button;
    }

    /**
     * Updates the theme icons displayed in the top bar based on `playingThemes` and `likedThemes`.
     */
    function updateTopbarThemeIcons() {
        if (!playingThemesContainer || !likedThemesContainer || !likedThemesSeparator) return;

        playingThemesContainer.innerHTML = ''; // Clear existing icons
        likedThemesContainer.innerHTML = '';

        // Add icons for 'playing' themes
        playingThemes.forEach(themeId => {
            const icon = createThemeTopbarIcon(themeId, 'playing');
            if (icon) {
                icon.dataset.type = 'playing'; // Mark as playing type for potential styling/logic
                playingThemesContainer.appendChild(icon);
            }
        });

        // Add icons for 'liked' themes that are not currently 'playing'
        likedThemes.forEach(themeId => {
            if (!isThemePlaying(themeId)) { // Avoid duplicates if a theme is both playing and liked
                const icon = createThemeTopbarIcon(themeId, 'liked');
                if (icon) {
                    icon.dataset.type = 'liked';
                    likedThemesContainer.appendChild(icon);
                }
            }
        });

        // Show separator if there are icons in both lists or only in liked list
        const showSeparator = (playingThemesContainer.children.length > 0 && likedThemesContainer.children.length > 0) ||
            (playingThemesContainer.children.length === 0 && likedThemesContainer.children.length > 0);
        likedThemesSeparator.style.display = showSeparator ? 'block' : 'none';
    }

    /**
     * Handles clicks on theme icons in the top bar (switches to that theme).
     * @param {string} themeId - The ID of the clicked theme.
     */
    function handleTopbarThemeIconClick(themeId) {
        const themeIsCurrentlyActiveInView = (currentTheme === themeId);

        if (isThemePlaying(themeId)) {
            // If it's a "playing" theme but not the one active in view, switch to it
            if (!themeIsCurrentlyActiveInView) {
                changeThemeAndStart(themeId, false); // false = don't force new game, try to resume
            }
        } else if (isThemeLiked(themeId)) {
            // If it's a "liked" theme (and not "playing"), start it
            changeThemeAndStart(themeId, false);
        }
    }

    /**
     * Toggles the AI model between free and paid (or other configured types).
     */
    function toggleModelType() {
        currentModelName = (currentModelName === PAID_MODEL_NAME) ? FREE_MODEL_NAME : PAID_MODEL_NAME;
        localStorage.setItem(MODEL_PREFERENCE_STORAGE_KEY, currentModelName);
        updateModelToggleButtonText();
        const msgKey = (currentModelName === PAID_MODEL_NAME) ? "system_model_set_paid" : "system_model_set_free";
        addMessageToLog(getUIText(msgKey, { MODEL_NAME: currentModelName }), 'system');
    }

    /**
     * Sets the application language and updates all relevant UI text and theme-specific elements.
     * @param {string} lang - The new language code (e.g., 'en', 'cs').
     * @param {string|null} themeIdForUIContextIfGameActive - The current theme ID if a game is active, for context.
     */
    function setAppLanguageAndThemeUI(lang, themeIdForUIContextIfGameActive) {
        currentAppLanguage = lang;
        localStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, lang);
        if (document.documentElement) document.documentElement.lang = lang; 

        const onLandingPage = document.body.classList.contains('landing-page-active');

        document.body.className = ''; 
        if (onLandingPage) {
            document.body.classList.add('landing-page-active');
            document.body.classList.add(`theme-landing`); 
        } else if (currentTheme) { 
            document.body.classList.add(`theme-${currentTheme}`);
        } else {
            document.body.classList.add(`theme-${DEFAULT_THEME_ID}`); 
        }

        if (languageToggleButton) {
            const otherLangKeyForButtonText = currentAppLanguage === 'en' ?
                (globalTextData.landing?.cs?.toggle_language || "Česky") : 
                (globalTextData.landing?.en?.toggle_language || "English"); 
            languageToggleButton.textContent = otherLangKeyForButtonText;
            const ariaToggleKey = `toggle_language_aria`; 
            languageToggleButton.setAttribute('aria-label', getUIText(ariaToggleKey));
            languageToggleButton.title = getUIText(ariaToggleKey);
        }

        if (newGameButton) {
            newGameButton.textContent = getUIText('button_new_game');
            newGameButton.title = getUIText('aria_label_new_game');
            newGameButton.setAttribute('aria-label', getUIText('aria_label_new_game'));
        }
        if (modelToggleButton) modelToggleButton.title = getUIText('aria_label_toggle_model_generic'); 

        if (systemStatusIndicator) systemStatusIndicator.textContent = getUIText(systemStatusIndicator.dataset.langKey || 'system_status_online_short');
        if (gmSpecificActivityIndicator) gmSpecificActivityIndicator.textContent = getUIText(gmSpecificActivityIndicator.dataset.langKey || 'system_processing_short');

        if (!onLandingPage && currentTheme) {
            const currentThemeFullCfg = ALL_THEMES_CONFIG[currentTheme];
            if (currentThemeFullCfg) {
                const dashboardCfgRef = currentThemeFullCfg.dashboard_config_ref;
                const dashboardCfg = THEME_DASHBOARD_CONFIGS[dashboardCfgRef];
                if (dashboardCfg) {
                    ['left_panel', 'right_panel'].forEach(sideKey => {
                        if (!dashboardCfg[sideKey]) return;
                        dashboardCfg[sideKey].forEach(boxCfg => {
                            const titleEl = document.querySelector(`#${boxCfg.id} .panel-box-title`);
                            if (titleEl) titleEl.textContent = getUIText(boxCfg.title_key, {}, currentTheme);
                            boxCfg.items.forEach(itemCfg => {
                                const labelEl = document.querySelector(`#info-item-container-${itemCfg.id} .label`);
                                if (labelEl) labelEl.textContent = getUIText(itemCfg.label_key, {}, currentTheme);
                            });
                        });
                    });
                }
            }
            initializeDashboardDefaultTexts(); 
        } else if (onLandingPage) {
            renderThemeGrid(); 
            if (currentLandingGridSelection && themeGridContainer) {
                const selectedBtn = themeGridContainer.querySelector(`.theme-grid-icon[data-theme="${currentLandingGridSelection}"]`);
                if (selectedBtn) selectedBtn.classList.add('active');
            }
        }

        if (playerIdentifierInputEl) playerIdentifierInputEl.placeholder = getUIText('placeholder_name_login'); // Updated key
        if (startGameButton) startGameButton.textContent = getUIText('button_access_systems');
        if (playerActionInput) playerActionInput.placeholder = getUIText('placeholder_command');
        if (sendActionButton) sendActionButton.textContent = getUIText('button_execute_command');

        updateModelToggleButtonText(); 
        updateTopbarThemeIcons(); 

        if (onLandingPage && currentLandingGridSelection) {
            updateLandingPagePanels(currentLandingGridSelection, false); 
        } else if (onLandingPage) { 
            if(landingThemeLoreText) landingThemeLoreText.value = getUIText('landing_select_theme_prompt_lore'); 
            if(landingThemeInfoContent) landingThemeInfoContent.innerHTML = `<p>${getUIText('landing_select_theme_prompt_details')}</p>`;
            const descTitle = landingThemeDescriptionContainer.querySelector('.panel-box-title');
            if (descTitle) descTitle.textContent = getUIText('landing_theme_description_title');
            const detailsTitle = landingThemeDetailsContainer.querySelector('.panel-box-title');
            if (detailsTitle) detailsTitle.textContent = getUIText('landing_theme_info_title');
        }
    }

    /**
     * Toggles the application language and narrative language together.
     */
    function toggleAppLanguage() {
        const newLang = currentAppLanguage === 'en' ? 'cs' : 'en';
        // Also update narrative language preference to match UI language by default on toggle
        currentNarrativeLanguage = newLang;
        localStorage.setItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY, newLang);

        setAppLanguageAndThemeUI(newLang, currentTheme || DEFAULT_THEME_ID);

        const langChangeMsgKey = newLang === 'en' ? "system_lang_set_en" : "system_lang_set_cs";
        // Log language change if in game view, otherwise console log
        if (currentTheme && storyLogViewport && storyLogViewport.style.display !== 'none') {
            addMessageToLog(getUIText(langChangeMsgKey), 'system');
        } else {
            console.log(getUIText(langChangeMsgKey)); // Log to console if not in game
        }

        if (currentTheme) saveGameState(); // Save state as narrative language might have changed
    }

    /**
     * Handles game state indicators from the AI, like showing/hiding conditional panels
     * and potentially switching to specialized prompts (e.g., combat_engaged).
     * @param {object} indicators - Object with indicator keys and boolean values (e.g., { "combat_engaged": true }).
     * @param {boolean} isInitialBoot - True if this is part of the initial game/session load.
     */
    function handleGameStateIndicators(indicators, isInitialBoot = false) {
        if (!indicators || !currentTheme) return;
        const currentThemeFullCfg = ALL_THEMES_CONFIG[currentTheme];
        if (!currentThemeFullCfg) return;
        const themeDashCfg = THEME_DASHBOARD_CONFIGS[currentThemeFullCfg.dashboard_config_ref];
        if (!themeDashCfg) return;

        // Update cache of indicators
        lastKnownGameStateIndicators = { ...lastKnownGameStateIndicators, ...indicators };

        // Iterate through panel configurations to find 'hidden_until_active' types
        const themePanels = [...(themeDashCfg.left_panel || []), ...(themeDashCfg.right_panel || [])];
        themePanels.forEach(boxCfg => {
            if (boxCfg.type === 'hidden_until_active' && boxCfg.indicator_key) {
                const boxEl = document.getElementById(boxCfg.id); if (!boxEl) return;
                const shouldShow = indicators[boxCfg.indicator_key] === true;
                const isShowing = boxEl.style.display !== 'none' && parseFloat(boxEl.style.opacity || '0') > 0;

                if (shouldShow && !isShowing) {
                    const delay = isInitialBoot && boxCfg.boot_delay ? boxCfg.boot_delay : 0;
                    setTimeout(() => animatePanelBox(boxCfg.id, true, true), delay);
                } else if (!shouldShow && isShowing) {
                    animatePanelBox(boxCfg.id, false, true);
                }
            }
        });

        // Update currentPromptType based on active indicators defined in themeDashCfg.game_state_indicators
        let newPromptType = 'default'; // Default state if no specific indicator-driven prompt is active
        let specificPromptFoundForActiveIndicator = false;

        if (themeDashCfg.game_state_indicators && Array.isArray(themeDashCfg.game_state_indicators)) {
            // Sort indicators by a potential 'priority' field if you need to define precedence,
            // otherwise, it will take the first one it finds that is true and has a prompt.
            // For now, we'll just iterate in defined order.
            for (const indicatorConfig of themeDashCfg.game_state_indicators) {
                const indicatorId = indicatorConfig.id;

                // Check if this indicator is true in the AI's response
                if (indicators[indicatorId] === true) {
                    // Check if a specific prompt file exists and is loaded for this indicatorId
                    if (PROMPT_URLS_BY_THEME[currentTheme]?.[indicatorId] &&
                        gamePrompts[currentTheme]?.[indicatorId] &&
                        !gamePrompts[currentTheme][indicatorId].startsWith("Error:")) {
                        
                        newPromptType = indicatorId;
                        specificPromptFoundForActiveIndicator = true;
                        break; // Found an active indicator with a specific prompt, use it.
                    }
                }
            }
        }

        // If no specific prompt was found for any *active* indicator,
        // but we were previously in a specific state (e.g., combat_engaged was true, now it's false),
        // we should revert to 'default'. The 'newPromptType' is already 'default' in this case.

        if (currentPromptType !== newPromptType) {
            currentPromptType = newPromptType;
            console.log(`Switched to prompt type: ${currentPromptType}`);
            // If switching *away* from 'initial' (e.g., after the first turn),
            // ensure isInitialGameLoad is false. This is usually handled in callGeminiAPI,
            // but good to be mindful of state transitions.
            if (currentPromptType !== 'initial' && isInitialGameLoad) {
                // isInitialGameLoad = false; // This might be too aggressive here,
                                           // callGeminiAPI is a better place for this flag.
            }
        }
    }

    /**
     * Calls the Gemini API with the current game history and system prompt.
     * @param {object[]} currentTurnHistory - The history of conversation turns for this API call.
     * @returns {Promise<string|null>} The narrative text from AI, or null on failure.
     */
// Located in app.js, around line 1212 in the previous version provided
    /**
     * Calls the Gemini API with the current game history and system prompt.
     * @param {object[]} currentTurnHistory - The history of conversation turns for this API call.
     * @returns {Promise<string|null>} The narrative text from AI, or null on failure.
     */
    async function callGeminiAPI(currentTurnHistory) {
        if (!GEMINI_API_KEY) { // Double-check API key
            addMessageToLog(getUIText('error_critical_no_api_key'), 'system');
            if (systemStatusIndicator) {
                systemStatusIndicator.textContent = getUIText('status_error');
                systemStatusIndicator.className = 'status-indicator status-danger';
            }
            setGMActivity(false);
            return null;
        }

        setGMActivity(true); // Indicate processing started
        clearSuggestedActions();

        // Determine appropriate prompt type for this turn
        const activePromptType = (isInitialGameLoad ||
            (currentTurnHistory.length === 1 && gameHistory[0].role === 'user' && gameHistory[0].parts[0].text.includes("ready to start the game"))) ?
            'initial' : currentPromptType;

        const systemPromptText = getSystemPrompt(playerIdentifier, activePromptType); // Renamed to systemPromptText for clarity

        // --- CONSOLE LOG FOR DEBUGGING THE SYSTEM PROMPT ---
        console.log("----- BEGIN SYSTEM PROMPT -----");
        console.log(`Using prompt type: ${activePromptType} (resolved to base key used by getSystemPrompt)`);
        console.log(systemPromptText);
        console.log("----- END SYSTEM PROMPT -----");
        // --- END CONSOLE LOG ---

        // Handle errors from prompt generation (e.g., missing prompt files or invalid JSON structure)
        if (systemPromptText.startsWith('{"narrative": "SYSTEM ERROR:')) {
            try {
                const errorResponse = JSON.parse(systemPromptText);
                addMessageToLog(errorResponse.narrative, 'system');
                if (errorResponse.suggested_actions) displaySuggestedActions(errorResponse.suggested_actions);
            } catch (e) { 
                // If parsing the error JSON itself fails, log the raw error string.
                addMessageToLog(systemPromptText, 'system-error');
                console.error("Failed to parse system error JSON from getSystemPrompt:", e, systemPromptText);
            }
            setGMActivity(false);
            return null;
        }

        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${currentModelName}:generateContent?key=${GEMINI_API_KEY}`;
        const generationConfig = {
            temperature: 0.7,
            topP: 0.95,
            maxOutputTokens: 8192,
            responseMimeType: "application/json" // Expect JSON response
        };
        const safetySettings = [ 
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ];
        const payload = {
            contents: currentTurnHistory,
            generationConfig: generationConfig,
            safetySettings: safetySettings,
            systemInstruction: { parts: [{ text: systemPromptText }] } // Use systemPromptText here
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const responseData = await response.json();

            if (!response.ok) {
                let errorDetails = responseData.error?.message || `API Error ${response.status}`;
                if (responseData.error?.details) errorDetails += ` Details: ${JSON.stringify(responseData.error.details)}`;
                throw new Error(errorDetails);
            }

            if (responseData.candidates && responseData.candidates[0]?.content?.parts?.[0]?.text) {
                let jsonStringFromAI = responseData.candidates[0].content.parts[0].text;
                try {
                    const parsedAIResponse = JSON.parse(jsonStringFromAI);
                    if (typeof parsedAIResponse.narrative !== 'string' ||
                        typeof parsedAIResponse.dashboard_updates !== 'object' ||
                        !Array.isArray(parsedAIResponse.suggested_actions) ||
                        typeof parsedAIResponse.game_state_indicators !== 'object') {
                        throw new Error("Invalid JSON structure from AI. Missing required fields.");
                    }

                    gameHistory.push({ role: "model", parts: [{ text: JSON.stringify(parsedAIResponse) }] });

                    updateDashboard(parsedAIResponse.dashboard_updates);
                    displaySuggestedActions(parsedAIResponse.suggested_actions);
                    handleGameStateIndicators(parsedAIResponse.game_state_indicators, isInitialGameLoad);

                    if (isInitialGameLoad) isInitialGameLoad = false; 
                    saveGameState(); 

                    if (systemStatusIndicator) { 
                        systemStatusIndicator.textContent = getUIText('system_status_online_short');
                        systemStatusIndicator.className = 'status-indicator status-ok';
                    }
                    return parsedAIResponse.narrative; 
                } catch (e) {
                    throw new Error(`Invalid JSON received from AI: ${e.message}. Raw string (first 500 chars): ${jsonStringFromAI.substring(0, 500)}...`);
                }
            } else if (responseData.promptFeedback?.blockReason) { 
                const blockDetails = responseData.promptFeedback.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ') || "No details provided.";
                throw new Error(`Content blocked by API: ${responseData.promptFeedback.blockReason}. Safety Ratings: ${blockDetails}`);
            } else {
                throw new Error("No valid candidate or text found in AI response.");
            }
        } catch (error) {
            console.error("Gemini API call failed:", error);
            addMessageToLog(getUIText('error_api_call_failed', { ERROR_MSG: error.message }), 'system');
            if (systemStatusIndicator) { 
                systemStatusIndicator.textContent = getUIText('status_error');
                systemStatusIndicator.className = 'status-indicator status-danger';
            }
            return null;
        } finally {
            setGMActivity(false); 
        }
    }

    /**
     * Starts the game session after the player enters their identifier.
     */
    async function startGameAfterIdentifier() { 
        const enteredIdentifier = playerIdentifierInputEl ? playerIdentifierInputEl.value.trim() : "";
        if (!enteredIdentifier) {
            await showCustomModal({ 
                type: 'alert',
                titleKey: 'alert_title_notice',
                messageKey: 'alert_identifier_required'
            });
            if (playerIdentifierInputEl) playerIdentifierInputEl.focus();
            return;
        }

        playerIdentifier = enteredIdentifier;
        isInitialGameLoad = true; 
        currentPromptType = 'initial'; 

        if (nameInputSection) nameInputSection.style.display = 'none';
        if (actionInputSection) actionInputSection.style.display = 'flex';

        if (storyLogViewport && storyLogViewport.classList.contains('spawn-animation')) {
        } else if (storyLogViewport) {
            storyLogViewport.style.opacity = '1';
            storyLogViewport.style.transform = 'translateY(0) scale(1)';
        }

        if (playerActionInput) { 
            playerActionInput.value = '';
            playerActionInput.dispatchEvent(new Event('input', { bubbles: true })); 
            autoGrowTextarea(playerActionInput);
            playerActionInput.focus();
        }

        // Determine the correct dashboard key for player identifier based on current theme
        const themeConfig = ALL_THEMES_CONFIG[currentTheme];
        let idKeyForDashboard = 'name'; // Default or common key
        if (themeConfig) {
            const dashboardConfig = THEME_DASHBOARD_CONFIGS[themeConfig.dashboard_config_ref];
            const foundIdItem = (dashboardConfig?.left_panel || [])
                .flatMap(p => p.items)
                .find(item => item.id === 'name' || item.id === 'character_name');
            if (foundIdItem) {
                idKeyForDashboard = foundIdItem.id;
            }
        }
        updateDashboard({ [idKeyForDashboard]: playerIdentifier }, false); 

        addMessageToLog(getUIText('connecting', { PLAYER_ID: playerIdentifier }), 'system');

        gameHistory = [{
            role: "user",
            parts: [{ text: `My identifier is ${playerIdentifier}. I am ready to start the game in ${currentTheme} theme.` }]
        }];
        saveGameState(); 

        clearSuggestedActions();
        const narrative = await callGeminiAPI(gameHistory); 

        if (narrative) {
            addMessageToLog(narrative, 'gm'); 
        } else {
            if (nameInputSection) nameInputSection.style.display = 'flex';
            if (actionInputSection) actionInputSection.style.display = 'none';
            addMessageToLog(getUIText('error_session_init_failed'), 'system');
        }
    }

    /**
     * Sends the player's typed action to the AI.
     */
    async function sendPlayerAction() {
        const actionText = playerActionInput ? playerActionInput.value.trim() : "";
        if (!actionText) { // Do nothing if input is empty
            if (playerActionInput) playerActionInput.focus();
            return;
        }

        addMessageToLog(actionText, 'player'); // Display player's action in log

        if (playerActionInput) { // Clear and reset input field
            playerActionInput.value = '';
            playerActionInput.dispatchEvent(new Event('input', { bubbles: true }));
            autoGrowTextarea(playerActionInput);
        }

        clearSuggestedActions();
        gameHistory.push({ role: "user", parts: [{ text: actionText }] }); // Add player action to history

        const narrative = await callGeminiAPI(gameHistory); // Get AI response
        if (narrative) {
            addMessageToLog(narrative, 'gm'); // Display AI's narrative response
        }
        // Error handling is done within callGeminiAPI
    }

    /**
     * Initiates a new game session, prompting for confirmation.
     * Uses current theme or landing page selection if no game is active.
     */
    async function startNewGameSession() { // Make function async
        if (!currentTheme && !currentLandingGridSelection) {
            await showCustomModal({ 
                type: 'alert',
                titleKey: 'alert_title_notice', 
                messageKey: 'alert_select_theme_first'
            });
            return;
        }
        const themeToStartNewGameIn = currentTheme || currentLandingGridSelection;
        if (!themeToStartNewGameIn || !ALL_THEMES_CONFIG[themeToStartNewGameIn]) {
             await showCustomModal({ 
                type: 'alert',
                titleKey: 'alert_title_error', 
                messageKey: 'alert_select_theme_first' 
            });
            return;
        }

        const themeConfig = ALL_THEMES_CONFIG[themeToStartNewGameIn];
        const themeName = getUIText(themeConfig.name_key, {}, themeToStartNewGameIn);
        
        const confirmKey = `confirm_new_game_theme_${themeToStartNewGameIn}`;
        let messageToDisplayKey = (themeTextData[themeToStartNewGameIn]?.[currentAppLanguage]?.[confirmKey] || themeTextData[themeToStartNewGameIn]?.en?.[confirmKey]) 
                                   ? confirmKey 
                                   : 'confirm_new_game_generic';

        const userConfirmed = await showCustomModal({ 
            type: 'confirm',
            titleKey: 'confirm_new_game_title', 
            messageKey: messageToDisplayKey,
            replacements: { THEME_NAME: themeName },
            confirmTextKey: 'modal_yes_button',
            cancelTextKey: 'modal_no_button',
            explicitThemeContext: (messageToDisplayKey === confirmKey) ? themeToStartNewGameIn : null 
        });

        if (userConfirmed) {
            addMessageToLog(getUIText('system_new_game_initiated', { THEME_NAME: themeName }), 'system');
            changeThemeAndStart(themeToStartNewGameIn, true); 
        }
    }

    /**
     * Generates the HTML for dashboard panels (left and right) based on a theme's configuration.
     * @param {string} themeId - The ID of the theme for which to generate panels.
     */
    function generatePanelsForTheme(themeId) {
        const themeFullConfig = ALL_THEMES_CONFIG[themeId];
        if (!themeFullConfig || !leftPanel || !rightPanel) return;

        const config = THEME_DASHBOARD_CONFIGS[themeFullConfig.dashboard_config_ref];
        if (!config) {
            console.error(`Dashboard config not found for theme reference: ${themeFullConfig.dashboard_config_ref}`);
            leftPanel.innerHTML = `<p>${getUIText('error_dashboard_config_missing')}</p>`;
            rightPanel.innerHTML = '';
            return;
        }

        // Clear existing panel content
        leftPanel.innerHTML = '';
        rightPanel.innerHTML = '';

        // Hide landing page specific panels if they were visible
        if (landingThemeDescriptionContainer) landingThemeDescriptionContainer.style.display = 'none';
        if (landingThemeDetailsContainer) landingThemeDetailsContainer.style.display = 'none';

        const createSidePanels = (sideContainerElement, panelConfigs) => {
            if (!panelConfigs) return;
            panelConfigs.forEach(panelConfig => {
                const panelBox = document.createElement('div');
                panelBox.id = panelConfig.id;
                panelBox.classList.add('panel-box');
                panelBox.style.display = 'flex'; // Default display, managed by animation/type
                panelBox.style.flexDirection = 'column';

                if (panelConfig.type === 'collapsible' || panelConfig.type === 'hidden_until_active') {
                    panelBox.classList.add('collapsible');
                }

                // Create panel header
                const header = document.createElement('div');
                header.classList.add('panel-box-header');
                const title = document.createElement('h3');
                title.classList.add('panel-box-title');
                title.textContent = getUIText(panelConfig.title_key); // Localized title
                header.appendChild(title);
                panelBox.appendChild(header);

                // Create panel content area
                const content = document.createElement('div');
                content.classList.add('panel-box-content');
                panelConfig.items.forEach(item => {
                    const itemContainer = document.createElement('div');
                    itemContainer.id = `info-item-container-${item.id}`;
                    itemContainer.classList.add(item.type === 'meter' ? 'info-item-meter' : 'info-item');
                    // Special class for full-width items
                    if (item.type === 'text_long' || ['objective', 'current_quest', 'location', 'environment', 'sensorConditions'].includes(item.id)) {
                        itemContainer.classList.add('full-width');
                    }

                    const label = document.createElement('span');
                    label.classList.add('label');
                    label.textContent = getUIText(item.label_key); // Localized label
                    itemContainer.appendChild(label);

                    // Create specific element for item type (meter or text value)
                    if (item.type === 'meter') {
                        const meterContainer = document.createElement('div');
                        meterContainer.classList.add('meter-bar-container');
                        const meterBar = document.createElement('div');
                        meterBar.id = `meter-${item.id}`; // For bar manipulation
                        meterBar.classList.add('meter-bar');
                        meterContainer.appendChild(meterBar);
                        itemContainer.appendChild(meterContainer);

                        const valueOverlay = document.createElement('span'); // For text over meter
                        valueOverlay.id = `info-${item.id}`; // For value updates
                        valueOverlay.classList.add('value-overlay');
                        itemContainer.appendChild(valueOverlay);
                    } else { // Plain text value
                        const valueSpan = document.createElement('span');
                        valueSpan.id = `info-${item.id}`; // For value updates
                        valueSpan.classList.add('value');
                        if (item.type === 'text_long') valueSpan.classList.add('objective-text'); // Special styling
                        itemContainer.appendChild(valueSpan);
                    }
                    content.appendChild(itemContainer);
                });
                panelBox.appendChild(content);
                sideContainerElement.appendChild(panelBox);
            });
        };

        createSidePanels(leftPanel, config.left_panel);
        createSidePanels(rightPanel, config.right_panel);
    }

    /**
     * Changes the active game theme or starts a new game in the specified theme.
     * @param {string} newThemeId - The ID of the theme to switch to or start.
     * @param {boolean} forceNewGame - If true, discard any existing saved state for this theme.
     */
    async function changeThemeAndStart(newThemeId, forceNewGame = false) {
        const oldThemeId = currentTheme;

        if (oldThemeId === newThemeId && !forceNewGame) {
            if (storyLogViewport && storyLogViewport.style.display === 'none') { 
                switchToGameView(newThemeId);
                if (playerActionInput && actionInputSection && actionInputSection.style.display !== 'none') {
                    playerActionInput.focus();
                }
            }
            return;
        }

        currentTheme = newThemeId;
        localStorage.setItem(CURRENT_THEME_STORAGE_KEY, currentTheme);
        addPlayingTheme(currentTheme); 

        clearGameStateInternal(currentTheme); 
        if (forceNewGame) {
            localStorage.removeItem(GAME_STATE_STORAGE_KEY_PREFIX + currentTheme); 
        }

        switchToGameView(currentTheme); 

        generatePanelsForTheme(currentTheme);
        setAppLanguageAndThemeUI(currentAppLanguage, currentTheme); 
        initializeDashboardDefaultTexts();
        initializeCollapsiblePanelBoxes(currentTheme);

        const promptsLoadedSuccessfully = await loadAllPromptsForTheme(currentTheme);
        if (!promptsLoadedSuccessfully) {
            addMessageToLog(getUIText('error_load_prompts_critical', { THEME: currentTheme }), 'system-error');
            if (startGameButton) startGameButton.disabled = true;
            switchToLandingView(); 
            return;
        }
        if (startGameButton) startGameButton.disabled = false;

        updateTopbarThemeIcons(); 

        if (!forceNewGame && loadGameState(currentTheme)) {
            isInitialGameLoad = false; 

            if (nameInputSection) nameInputSection.style.display = 'none';
            if (actionInputSection) actionInputSection.style.display = 'flex';
            if (playerActionInput) playerActionInput.focus();

            addMessageToLog(getUIText('system_session_resumed', { PLAYER_ID: playerIdentifier, THEME_NAME: getUIText(ALL_THEMES_CONFIG[currentTheme].name_key, {}, currentTheme) }), 'system');
            if (systemStatusIndicator) { 
                systemStatusIndicator.textContent = getUIText('system_status_online_short');
                systemStatusIndicator.className = 'status-indicator status-ok';
            }
        } else { 
            isInitialGameLoad = true;
            currentPromptType = 'initial';
            if (storyLog) storyLog.innerHTML = ''; 
            clearSuggestedActions();

            if (nameInputSection) nameInputSection.style.display = 'flex';
            if (actionInputSection) actionInputSection.style.display = 'none';
            if (playerIdentifierInputEl) {
                playerIdentifierInputEl.value = '';
                playerIdentifierInputEl.placeholder = getUIText('placeholder_name_login'); // Updated placeholder key
                playerIdentifierInputEl.focus();
            }

            if (systemStatusIndicator) { 
                systemStatusIndicator.textContent = getUIText('standby');
                systemStatusIndicator.className = 'status-indicator status-warning';
            }
            if (oldThemeId !== newThemeId) { 
                addMessageToLog(getUIText('system_theme_set_generic', { THEME_NAME: getUIText(ALL_THEMES_CONFIG[newThemeId].name_key, {}, newThemeId) }), 'system');
            }
            if (forceNewGame) { 
                addMessageToLog(getUIText('system_new_game_initiated', { THEME_NAME: getUIText(ALL_THEMES_CONFIG[currentTheme].name_key, {}, currentTheme) }), 'system');
            }
        }

        if (startGameButton) startGameButton.textContent = getUIText('button_access_systems');
    }

    /**
     * Initializes click and keyboard listeners for a specific panel's header, typically for landing page panels.
     * This function is used because landing page panels might be added/managed outside the main theme panel generation.
     * @param {HTMLElement} panelContainerElement - The container element holding the panel box (e.g., landingThemeDescriptionContainer).
     */
    function initializeSpecificPanelHeader(panelContainerElement) {
        if (!panelContainerElement) {
            console.error(`Panel container element not found for click listener.`);
            return;
        }
        const box = panelContainerElement.querySelector('.panel-box'); // The actual panel box
        const header = box ? box.querySelector('.panel-box-header') : null;

        if (box && header) {
            if (!box.id) { // Ensure the box has an ID for animatePanelBox
                box.id = `${panelContainerElement.id}-box`; // Generate a unique ID
            }

            // Clone and replace header to remove any existing event listeners (robustness)
            const newHeader = header.cloneNode(true);
            header.parentNode.replaceChild(newHeader, header);

            newHeader.addEventListener('click', () => {
                animatePanelBox(box.id, !box.classList.contains('is-expanded'), false); // false = don't manage display:none
            });
            newHeader.setAttribute('tabindex', '0'); // Make focusable
            newHeader.addEventListener('keydown', (e) => {
                if ((e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    animatePanelBox(box.id, !box.classList.contains('is-expanded'), false);
                }
            });
        } else {
            // console.warn(`Panel box or header not found in ${panelContainerElement.id} for listener setup.`);
        }
    }

    /**
     * Switches the UI to the landing page view (theme selection).
     */
    function switchToLandingView() {
        // Reset game-specific state
        currentTheme = null;
        localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
        playerIdentifier = '';
        gameHistory = [];

        // Update body classes for landing page
        document.body.classList.add('landing-page-active');
        document.body.classList.remove(...Array.from(document.body.classList).filter(cn => cn.startsWith('theme-') && cn !== 'theme-landing'));
        if (!document.body.classList.contains('theme-landing')) document.body.classList.add('theme-landing');

        // Hide game-specific UI elements
        if (storyLogViewport) storyLogViewport.style.display = 'none';
        if (suggestedActionsWrapper) suggestedActionsWrapper.style.display = 'none';
        if (playerInputControlPanel) playerInputControlPanel.style.display = 'none';
        if (nameInputSection) nameInputSection.style.display = 'none';
        if (actionInputSection) actionInputSection.style.display = 'none';

        // Remove game panels, show landing panels
        if (leftPanel) {
            Array.from(leftPanel.children)
                .filter(el => el.id !== 'landing-theme-description-container')
                .forEach(el => el.remove());
        }
        if (rightPanel) {
            Array.from(rightPanel.children)
                .filter(el => el.id !== 'landing-theme-details-container')
                .forEach(el => el.remove());
        }

        if (themeGridContainer) themeGridContainer.style.display = 'grid';

        // Ensure landing page panels are visible and in correct parent
        if (landingThemeDescriptionContainer) {
            landingThemeDescriptionContainer.style.display = 'flex';
            if (leftPanel && !leftPanel.contains(landingThemeDescriptionContainer)) {
                leftPanel.appendChild(landingThemeDescriptionContainer);
            }
        }
        if (landingThemeDetailsContainer) {
            landingThemeDetailsContainer.style.display = 'flex';
            if (rightPanel && !rightPanel.contains(landingThemeDetailsContainer)) {
                rightPanel.appendChild(landingThemeDetailsContainer);
            }
        }

        // Set default content for landing panels
        if (landingThemeLoreText) landingThemeLoreText.textContent = getUIText('landing_select_theme_prompt_lore');
        if (landingThemeInfoContent) landingThemeInfoContent.innerHTML = `<p>${getUIText('landing_select_theme_prompt_details')}</p>`;
        if (landingThemeActions) {
            landingThemeActions.style.display = 'none'; // Hide actions until a theme is selected
            landingThemeActions.innerHTML = '';
        }

        // Update titles of landing panels
        const descTitle = landingThemeDescriptionContainer?.querySelector('.panel-box-title');
        if (descTitle) descTitle.textContent = getUIText('landing_theme_description_title');
        const detailsTitle = landingThemeDetailsContainer?.querySelector('.panel-box-title');
        if (detailsTitle) detailsTitle.textContent = getUIText('landing_theme_info_title');

        // Initialize/animate landing page panels (ensure they are expanded)
        const lorePanelBox = landingThemeDescriptionContainer?.querySelector('.panel-box');
        if (lorePanelBox) {
            if (!lorePanelBox.id) lorePanelBox.id = 'landing-lore-panel-box';
            animatePanelBox(lorePanelBox.id, true, false);
            initializeSpecificPanelHeader(landingThemeDescriptionContainer); // Re-attach listeners
        }

        const detailsPanelBox = landingThemeDetailsContainer?.querySelector('.panel-box');
        if (detailsPanelBox) {
            if (!detailsPanelBox.id) detailsPanelBox.id = 'landing-details-panel-box';
            animatePanelBox(detailsPanelBox.id, true, false);
            initializeSpecificPanelHeader(landingThemeDetailsContainer); // Re-attach listeners
        }

        // Load and render theme grid, potentially selecting a previously chosen theme
        currentLandingGridSelection = localStorage.getItem(LANDING_SELECTED_GRID_THEME_KEY);
        renderThemeGrid();

        if (currentLandingGridSelection && ALL_THEMES_CONFIG[currentLandingGridSelection]) {
            updateLandingPagePanels(currentLandingGridSelection, false); // No animation on initial load
            const selectedBtn = themeGridContainer?.querySelector(`.theme-grid-icon[data-theme="${currentLandingGridSelection}"]`);
            if (selectedBtn) selectedBtn.classList.add('active');
        }

        if (systemStatusIndicator) { // Set status to standby
            systemStatusIndicator.textContent = getUIText('standby');
            systemStatusIndicator.className = 'status-indicator status-warning';
        }
        updateTopbarThemeIcons(); // Refresh top bar
        setAppLanguageAndThemeUI(currentAppLanguage, DEFAULT_THEME_ID); // Set UI texts for landing
    }

    /**
     * Switches the UI to the main game view for a specific theme.
     * @param {string} themeId - The ID of the theme to display the game view for.
     */
    function switchToGameView(themeId) {
        // Update body classes for game view
        document.body.classList.remove('landing-page-active', 'theme-landing');
        document.body.classList.remove(...Array.from(document.body.classList).filter(cn => cn.startsWith('theme-') && cn !== `theme-${themeId}`));
        if (!document.body.classList.contains(`theme-${themeId}`)) document.body.classList.add(`theme-${themeId}`);

        // Hide landing-specific elements
        if (themeGridContainer) themeGridContainer.style.display = 'none';
        if (landingThemeDescriptionContainer) landingThemeDescriptionContainer.style.display = 'none';
        if (landingThemeDetailsContainer) landingThemeDetailsContainer.style.display = 'none';

        // Show game-specific elements
        if (storyLogViewport) storyLogViewport.style.display = 'block';
        if (suggestedActionsWrapper) suggestedActionsWrapper.style.display = 'flex';
        if (playerInputControlPanel) playerInputControlPanel.style.display = 'block';

        // Trigger spawn animation for story log viewport
        if (storyLogViewport) {
            storyLogViewport.classList.remove('spawn-animation'); // Reset if already present
            requestAnimationFrame(() => { // Ensure class removal is processed
                storyLogViewport.style.opacity = '0'; // Start transparent and slightly offset
                storyLogViewport.style.transform = 'translateY(20px) scale(0.98)';
                storyLogViewport.classList.add('spawn-animation'); // Add class to trigger CSS animation
            });
        }
    }

    /**
     * Renders the theme selection grid on the landing page.
     */
    function renderThemeGrid() {
        if (!themeGridContainer) return;
        themeGridContainer.innerHTML = ''; // Clear existing grid items

        Object.values(ALL_THEMES_CONFIG).forEach(theme => {
            const button = document.createElement('button');
            button.classList.add('theme-grid-icon');
            button.dataset.theme = theme.id; // Store theme ID for click handling
            const themeDisplayNameOnGrid = getUIText(theme.name_key, {}, theme.id); // Localized name with theme context
            button.title = themeDisplayNameOnGrid; // Tooltip

            const img = document.createElement('img');
            img.src = theme.icon;
            const altTextKey = `theme_icon_alt_text_default_${theme.id}`; // Specific alt text key
            img.alt = getUIText(altTextKey, {}, theme.id) || themeDisplayNameOnGrid; // Fallback to display name, with theme context

            const nameSpan = document.createElement('span');
            nameSpan.classList.add('theme-grid-icon-name');
            nameSpan.textContent = themeDisplayNameOnGrid;

            button.appendChild(img);
            button.appendChild(nameSpan);

            button.addEventListener('click', () => handleThemeGridIconClick(theme.id));
            themeGridContainer.appendChild(button);
        });
    }

    /**
     * Handles clicks on a theme icon in the landing page grid.
     * @param {string} themeId - The ID of the clicked theme.
     */
    function handleThemeGridIconClick(themeId) {
        currentLandingGridSelection = themeId;
        localStorage.setItem(LANDING_SELECTED_GRID_THEME_KEY, themeId); // Persist selection

        // Update active state visual for grid icons
        themeGridContainer.querySelectorAll('.theme-grid-icon.active').forEach(btn => btn.classList.remove('active'));
        const clickedBtn = themeGridContainer.querySelector(`.theme-grid-icon[data-theme="${themeId}"]`);
        if (clickedBtn) clickedBtn.classList.add('active');

        updateLandingPagePanels(themeId, true); // Update info panels with animation
    }

    /**
     * Updates the content of the landing page's theme description and details panels.
     * @param {string} themeId - The ID of the theme to display information for.
     * @param {boolean} animate - Whether to animate panel expansion.
     */
    function updateLandingPagePanels(themeId, animate = true) {
        const themeConfig = ALL_THEMES_CONFIG[themeId];
        if (!themeConfig || !landingThemeLoreText || !landingThemeInfoContent || !landingThemeDescriptionContainer || !landingThemeDetailsContainer) return;

        // Update panel titles (they are generic, but good to ensure they are set)
        const descPanelContainer = document.getElementById('landing-theme-description-container');
        const descTitle = descPanelContainer ? descPanelContainer.querySelector('.panel-box-title') : null;
        if (descTitle) descTitle.textContent = getUIText('landing_theme_description_title'); // Generic title

        const detailsPanelContainer = document.getElementById('landing-theme-details-container');
        const detailsTitle = detailsPanelContainer ? detailsPanelContainer.querySelector('.panel-box-title') : null;
        if (detailsTitle) detailsTitle.textContent = getUIText('landing_theme_info_title'); // Generic title

        // Set lore text, using themeId for context
        landingThemeLoreText.textContent = getUIText(themeConfig.lore_key, {}, themeId);
        if (animate) { // Optionally animate lore panel expansion
            const lorePanelBox = landingThemeDescriptionContainer.querySelector('.panel-box');
            if (lorePanelBox && lorePanelBox.id) animatePanelBox(lorePanelBox.id, true, false);
        }

        // Set name, inspiration, tone, and concept text using themeId for context
        landingThemeInfoContent.innerHTML = `
            <p><strong>${getUIText('landing_theme_name_label')}:</strong> <span id="landing-selected-theme-name">${getUIText(themeConfig.name_key, {}, themeId)}</span></p>
            <p><strong>${getUIText('landing_theme_inspiration_label')}:</strong> <span id="landing-selected-theme-inspiration">${getUIText(themeConfig.inspiration_key, {}, themeId)}</span></p>
            <p><strong>${getUIText('landing_theme_tone_label')}:</strong> <span id="landing-selected-theme-tone">${getUIText(themeConfig.tone_key, {}, themeId)}</span></p>
            <p><strong>${getUIText('landing_theme_concept_label')}:</strong> <span id="landing-selected-theme-concept">${getUIText(themeConfig.concept_key, {}, themeId)}</span></p>
        `;

        renderLandingPageActionButtons(themeId); // Create "Choose" and "Like" buttons
        if (landingThemeActions) landingThemeActions.style.display = 'flex'; // Show action buttons

        if (animate) { // Optionally animate details panel expansion
            const detailsPanelBox = landingThemeDetailsContainer.querySelector('.panel-box');
            if (detailsPanelBox && detailsPanelBox.id) animatePanelBox(detailsPanelBox.id, true, false);
        }
    }

    /**
     * Renders the "Choose this theme" and "Like" buttons on the landing page for a selected theme.
     * @param {string} themeId - The ID of the currently selected theme.
     */
    /**
     * Renders the "Choose this theme" and "Like" buttons on the landing page for a selected theme.
     * @param {string} themeId - The ID of the currently selected theme.
     */
    function renderLandingPageActionButtons(themeId) {
        if (!landingThemeActions) return;
        landingThemeActions.innerHTML = ''; // Clear previous buttons

        const themeConfig = ALL_THEMES_CONFIG[themeId];
        if (!themeConfig) return; // Should not happen if themeId is valid

        // "Choose this theme" or "Coming Soon" button
        const chooseButton = document.createElement('button');
        chooseButton.id = 'choose-theme-button';
        chooseButton.classList.add('ui-button'); // Base class

        if (themeConfig.playable) {
            chooseButton.classList.add('primary');
            chooseButton.textContent = getUIText('landing_choose_theme_button');
            chooseButton.addEventListener('click', () => handleChooseThisThemeClick(themeId));
            chooseButton.disabled = false;
        } else {
            chooseButton.classList.add('disabled'); // Visually indicate disabled
            chooseButton.textContent = getUIText('coming_soon_button');
            chooseButton.disabled = true; // Make it unclickable
        }

        // "Like/Unlike" button
        const likeButton = document.createElement('button');
        likeButton.id = 'like-theme-button';
        likeButton.classList.add('ui-button', 'icon-button', 'like-theme-button');
        
        if (themeConfig.playable) {
            const isCurrentlyLiked = isThemeLiked(themeId);
            const likeTextKey = isCurrentlyLiked ? 'aria_label_unlike_theme' : 'aria_label_like_theme';
            const likeText = getUIText(likeTextKey);
            likeButton.innerHTML = `<img src="${isCurrentlyLiked ? 'images/app/icon_heart_filled.svg' : 'images/app/icon_heart_empty.svg'}" alt="${likeText}" class="like-icon">`;
            likeButton.setAttribute('aria-label', likeText);
            likeButton.title = likeText; // Tooltip
            if (isCurrentlyLiked) likeButton.classList.add('liked');
            likeButton.addEventListener('click', () => handleLikeThemeClick(themeId, likeButton));
            likeButton.disabled = false;
        } else {
            // For unplayable themes, show a disabled-like heart icon and make it unclickable
            likeButton.innerHTML = `<img src="images/app/icon_heart_disabled.svg" alt="${getUIText('aria_label_like_theme')}" class="like-icon">`; // Assuming you have/create a disabled heart icon
            likeButton.setAttribute('aria-label', getUIText('aria_label_like_theme')); // Or a specific "feature not available" aria label
            likeButton.title = getUIText('coming_soon_button'); // Tooltip indicates coming soon
            likeButton.classList.add('disabled'); // Add disabled class for styling
            likeButton.disabled = true;
        }


        landingThemeActions.appendChild(chooseButton);
        landingThemeActions.appendChild(likeButton);
    }

    /**
     * Handles the "Choose this theme" button click on the landing page.
     * @param {string} themeId - The ID of the theme chosen.
     */
    function handleChooseThisThemeClick(themeId) {
        changeThemeAndStart(themeId, false); // false = try to resume if possible, else start new
    }

    /**
     * Handles the "Like/Unlike" button click on the landing page.
     * @param {string} themeId - The ID of the theme.
     * @param {HTMLButtonElement} likeButtonElement - The like button element itself for direct UI update.
     */
    function handleLikeThemeClick(themeId, likeButtonElement) {
        const themeConfig = ALL_THEMES_CONFIG[themeId];
        if (!themeConfig) return;

        if (isThemeLiked(themeId)) {
            removeLikedTheme(themeId); // This will update the button via its internal logic if currentLandingGridSelection matches
        } else {
            addLikedTheme(themeId); // This will also update the button via its internal logic
        }
        // The button update is handled within add/removeLikedTheme if currentLandingGridSelection matches.
        // If not, the button itself isn't the one being directly manipulated, so no explicit update here is needed
        // beyond what those functions do.
    }

    /**
     * Hides the custom modal.
     */
    function hideCustomModal() {
        if (customModalOverlay) {
            customModalOverlay.classList.remove('active');
            // Clear input field after hiding
            if (customModalInput) customModalInput.value = '';
            if (customModalInputContainer) customModalInputContainer.style.display = 'none';
        }
    }

    /**
     * Shows a custom modal.
     * @param {object} options - Configuration for the modal.
     * @param {string} options.type - 'alert', 'confirm', or 'prompt'.
     * @param {string} options.titleKey - i18n key for the modal title.
     * @param {string} options.messageKey - i18n key for the modal message.
     * @param {object} [options.replacements={}] - Replacements for title/message.
     * @param {string} [options.confirmTextKey] - i18n key for confirm button. Defaults based on type.
     * @param {string} [options.cancelTextKey] - i18n key for cancel button (for 'confirm'/'prompt').
     * @param {string} [options.inputPlaceholderKey] - i18n key for prompt input placeholder.
     * @param {string} [options.defaultValue] - Default value for prompt input.
     * @returns {Promise<string|boolean|null>} - Resolves with input value for 'prompt',
     *                                           true/false for 'confirm', null for 'alert'.
     */
    function showCustomModal(options) {
        return new Promise((resolve) => {
            currentModalResolve = resolve; // Store resolve for button handlers

            const {
                type = 'alert', // 'alert', 'confirm', 'prompt'
                titleKey,
                messageKey,
                replacements = {},
                confirmTextKey,
                cancelTextKey,
                inputPlaceholderKey,
                defaultValue = ''
            } = options;

            if (!customModalOverlay || !customModalTitle || !customModalMessage || !customModalActions) {
                console.error("Custom modal elements not found!");
                currentModalResolve(type === 'prompt' ? null : (type === 'confirm' ? false : null)); // Reject or resolve with default
                return;
            }

            customModalTitle.textContent = getUIText(titleKey || `modal_default_title_${type}`, replacements);
            customModalMessage.innerHTML = getUIText(messageKey, replacements).replace(/\n/g, '<br>'); // Allow newlines in message

            customModalActions.innerHTML = ''; // Clear previous buttons

            if (type === 'prompt') {
                if (customModalInputContainer && customModalInput) {
                    customModalInputContainer.style.display = 'block';
                    customModalInput.value = defaultValue;
                    customModalInput.placeholder = inputPlaceholderKey ? getUIText(inputPlaceholderKey) : '';
                    setTimeout(() => customModalInput.focus(), 50); // Delay focus slightly for transition
                } else {
                    console.error("Modal input elements not found for prompt type.");
                    customModalInputContainer.style.display = 'none';
                }
            } else {
                if (customModalInputContainer) customModalInputContainer.style.display = 'none';
            }

            // Confirm/OK/Yes Button
            const confirmBtn = document.createElement('button');
            confirmBtn.classList.add('ui-button', 'primary');
            let defaultConfirmKey = 'modal_ok_button';
            if (type === 'confirm') defaultConfirmKey = 'modal_yes_button';
            if (type === 'prompt') defaultConfirmKey = 'modal_confirm_button';
            
            confirmBtn.textContent = getUIText(confirmTextKey || defaultConfirmKey);
            confirmBtn.addEventListener('click', () => {
                if (type === 'prompt') {
                    currentModalResolve(customModalInput.value);
                } else if (type === 'confirm') {
                    currentModalResolve(true);
                } else { // alert
                    currentModalResolve(null);
                }
                hideCustomModal();
            });
            customModalActions.appendChild(confirmBtn);

            // Cancel/No Button (for confirm and prompt)
            if (type === 'confirm' || type === 'prompt') {
                const cancelBtn = document.createElement('button');
                cancelBtn.classList.add('ui-button'); // Secondary style
                cancelBtn.textContent = getUIText(cancelTextKey || 'modal_cancel_button');
                cancelBtn.addEventListener('click', () => {
                    currentModalResolve(type === 'prompt' ? null : false); // Resolve with null for prompt cancel, false for confirm cancel
                    hideCustomModal();
                });
                customModalActions.appendChild(cancelBtn);
            }
            customModalOverlay.classList.add('active');
        });
    }

    /**
     * Main application initialization function. Sets up API key, loads preferences,
     * and determines whether to show landing page or resume a game.
     */
    async function initializeApp() { // ENSURE THIS IS ASYNC
        loadThemeListsFromStorage(); 

        currentTheme = localStorage.getItem(CURRENT_THEME_STORAGE_KEY) || null;
        currentAppLanguage = localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY) || DEFAULT_LANGUAGE;
        currentNarrativeLanguage = localStorage.getItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY) || currentAppLanguage;
        currentModelName = localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY) || FREE_MODEL_NAME;

        updateModelToggleButtonText();

        // Critical: Setup API key.
        const apiKeyIsSetup = await setupApiKey(); // AWAIT THIS CALL
        if (!apiKeyIsSetup) { 
            switchToLandingView(); 
            setAppLanguageAndThemeUI(currentAppLanguage, DEFAULT_THEME_ID); 
            return; 
        }

        let gameToResume = null;
        let successfullyLoadedStateForResume = false;

        if (currentTheme && isThemePlaying(currentTheme)) {
            const tempPlayerId = playerIdentifier;
            const tempGameHistory = [...gameHistory];
            playerIdentifier = ''; 
            gameHistory = [];

            if (await loadAllPromptsForTheme(currentTheme)) { 
                if (loadGameState(currentTheme)) { 
                    gameToResume = currentTheme;
                    successfullyLoadedStateForResume = true;
                } else {
                    removePlayingTheme(currentTheme, false); 
                    currentTheme = null;
                    localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
                    playerIdentifier = tempPlayerId; 
                    gameHistory = tempGameHistory;
                }
            } else {
                removePlayingTheme(currentTheme, false);
                currentTheme = null;
                localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
                playerIdentifier = tempPlayerId;
                gameHistory = tempGameHistory;
                addMessageToLog(getUIText('error_resume_failed_prompts', { THEME: currentTheme }), 'system-error');
            }
        } else if (currentTheme) {
            currentTheme = null;
            localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
        }

        if (gameToResume && successfullyLoadedStateForResume) {
            currentTheme = gameToResume; 

            switchToGameView(currentTheme); 

            generatePanelsForTheme(currentTheme); 
            setAppLanguageAndThemeUI(currentAppLanguage, currentTheme); 
            initializeDashboardDefaultTexts(); 

            updateDashboard(lastKnownDashboardUpdates, false); 
            handleGameStateIndicators(lastKnownGameStateIndicators, true); 

            initializeCollapsiblePanelBoxes(currentTheme); 

            if (nameInputSection) nameInputSection.style.display = 'none';
            if (actionInputSection) actionInputSection.style.display = 'flex';
            if (playerActionInput && document.body.contains(playerActionInput)) {
                playerActionInput.focus();
            }

            addMessageToLog(getUIText('system_session_resumed', { PLAYER_ID: playerIdentifier, THEME_NAME: getUIText(ALL_THEMES_CONFIG[currentTheme].name_key, {}, currentTheme) }), 'system');
            if (systemStatusIndicator) {
                systemStatusIndicator.textContent = getUIText('system_status_online_short');
                systemStatusIndicator.className = 'status-indicator status-ok';
            }
            isInitialGameLoad = false; 
        } else {
            switchToLandingView();
        }

        updateTopbarThemeIcons(); 
        if (playerActionInput) autoGrowTextarea(playerActionInput); 
    }

    // Event Listeners for global controls
    if (applicationLogoElement) applicationLogoElement.addEventListener('click', switchToLandingView);
    if (languageToggleButton) languageToggleButton.addEventListener('click', toggleAppLanguage);
    
    if (newGameButton) {
        newGameButton.addEventListener('click', () => { // Use a non-async wrapper
            startNewGameSession().catch(err => {
                 console.error("Error during New Game operation:", err);
                 // Optionally show a user-friendly error modal here if the promise rejects unexpectedly
                 // showCustomModal({ type: 'alert', titleKey: 'alert_title_error', messageKey: 'error_generic_operation_failed' });
            });
        });
    }

    if (modelToggleButton) modelToggleButton.addEventListener('click', toggleModelType);

    // Event Listeners for game start controls
    if (startGameButton) {
        startGameButton.addEventListener('click', () => { // Use a non-async wrapper
            startGameAfterIdentifier().catch(err => {
                console.error("Error during startGameAfterIdentifier (button click):", err);
            });
        });
    }
    if (playerIdentifierInputEl) {
        playerIdentifierInputEl.addEventListener('keypress', (e) => { // Keypress listener
            if (e.key === 'Enter') {
                // Call the async function and handle potential errors
                startGameAfterIdentifier().catch(err => {
                    console.error("Error during startGameAfterIdentifier (Enter key):", err);
                });
            }
        });
    }

    // Event Listeners for player action input (sendPlayerAction is also async)
    if (sendActionButton) {
        sendActionButton.addEventListener('click', () => { // Use a non-async wrapper
            sendPlayerAction().catch(err => {
                console.error("Error during sendPlayerAction (button click):", err);
            });
        });
    }
    if (playerActionInput) {
        playerActionInput.addEventListener('keypress', (e) => { // Keypress listener
            if (e.key === 'Enter' && !e.shiftKey) { 
                e.preventDefault(); 
                // Call the async function and handle potential errors
                sendPlayerAction().catch(err => {
                    console.error("Error during sendPlayerAction (Enter key):", err);
                });
            }
        });
        playerActionInput.addEventListener('input', () => autoGrowTextarea(playerActionInput)); 
    }

    // Event listener for story log scroll (to manage auto-scroll behavior)
    if (storyLogViewport) {
        storyLogViewport.addEventListener('scroll', () => {
            if (storyLogViewport.scrollHeight - storyLogViewport.clientHeight > storyLogViewport.scrollTop + AUTOSCROLL_THRESHOLD) {
                userHasManuallyScrolledLog = true;
            }
        });
    }

    // Initialize the application
    initializeApp(); // This should be the last call within the DOMContentLoaded listener
}); // This is the closing curly brace and parenthesis for the main DOMContentLoaded listener