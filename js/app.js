// Wait for the DOM to be fully loaded before initializing the application
document.addEventListener('DOMContentLoaded', () => {
    // API Key for Gemini (fetched from localStorage or user prompt)
    let GEMINI_API_KEY = "";

    // Default application settings
    const DEFAULT_LANGUAGE = 'cs'; // Default UI and narrative language
    const DEFAULT_THEME_ID = 'scifi'; // Default theme if none is selected
    const UPDATE_HIGHLIGHT_DURATION = 5000; // Duration for UI update highlights (ms)

    // localStorage keys for persisting application state and preferences
    const CURRENT_THEME_STORAGE_KEY = 'anomaliaCurrentTheme';
    const GAME_STATE_STORAGE_KEY_PREFIX = 'anomaliaGameState_'; // Prefix for theme-specific game states
    const MODEL_PREFERENCE_STORAGE_KEY = 'anomaliaModelPreference';
    const LANGUAGE_PREFERENCE_STORAGE_KEY = 'preferredAppLanguage';
    const NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY = 'preferredNarrativeLanguage';
    const PLAYING_THEMES_STORAGE_KEY = 'anomaliaPlayingThemes'; // Themes currently being played or recently played
    const LIKED_THEMES_STORAGE_KEY = 'anomaliaLikedThemes'; // Themes liked by the user
    const LANDING_SELECTED_GRID_THEME_KEY = 'anomaliaLandingSelectedGridTheme'; // Theme selected on landing page grid

    // AI Model identifiers
    const PAID_MODEL_NAME = "gemini-1.5-flash-latest"; // Identifier for the preferred/paid model
    const FREE_MODEL_NAME = "gemini-1.5-flash-latest"; // Identifier for the standard/free model (currently same as paid)
    let currentModelName = localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY) || FREE_MODEL_NAME;

    // Core application state variables
    let currentTheme = localStorage.getItem(CURRENT_THEME_STORAGE_KEY) || null; // Active game theme
    let currentAppLanguage = localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY) || DEFAULT_LANGUAGE; // Current UI language
    let currentNarrativeLanguage = localStorage.getItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY) || currentAppLanguage; // Current language for AI narrative
    let gamePrompts = {}; // Stores loaded prompt texts, keyed by theme and prompt name
    let currentPromptType = 'initial'; // Type of system prompt to use (e.g., 'initial', 'default', 'combat')
    let gameHistory = []; // Array of conversation turns with the AI
    let playerIdentifier = ''; // User's chosen name or callsign in the game
    let isInitialGameLoad = true; // Flag indicating if this is the first load of a game session
    let lastKnownDashboardUpdates = {}; // Cache of the last AI-provided dashboard values
    let lastKnownGameStateIndicators = {}; // Cache of the last AI-provided game state flags

    // User's theme lists
    let playingThemes = []; // Themes the user has active sessions for
    let likedThemes = []; // Themes the user has marked as liked
    let currentLandingGridSelection = null; // Theme ID selected in the landing page grid

    // Configuration for all available themes
    const ALL_THEMES_CONFIG = {
        scifi: {
            id: 'scifi',
            name_key: 'theme_name_scifi', // i18n key for theme name
            icon: 'images/icon_scifi.svg', // Path to theme icon
            lore_key: 'theme_lore_scifi', // i18n key for theme lore
            setting_key: 'theme_setting_scifi', // i18n key for theme setting description
            details_key: 'theme_details_scifi', // i18n key for theme details
            dashboard_config_ref: 'scifi' // Reference to dashboard layout configuration
        },
        fantasy: {
            id: 'fantasy',
            name_key: 'theme_name_fantasy',
            icon: 'images/icon_fantasy.svg',
            lore_key: 'theme_lore_fantasy',
            setting_key: 'theme_setting_fantasy',
            details_key: 'theme_details_fantasy',
            dashboard_config_ref: 'fantasy'
        }
        // Add more themes here
    };

    // Paths to prompt files, organized by theme and prompt type
    const PROMPT_URLS_BY_THEME = {
        scifi: {
            initial: 'prompts/scifi/initial.txt',
            default: 'prompts/scifi/default.txt',
            combat: 'prompts/scifi/combat.txt',
            starts: 'prompts/scifi/helpers/starts.txt',
            asset_names_en: 'prompts/scifi/helpers/ship_names_en.txt',
            asset_names_cs: 'prompts/scifi/helpers/ship_names_cs.txt'
        },
        fantasy: {
            initial: 'prompts/fantasy/initial.txt',
            default: 'prompts/fantasy/default.txt',
            combat: 'prompts/fantasy/combat.txt',
            starts: 'prompts/fantasy/helpers/start_scenarios.txt',
            entity_names_en: 'prompts/fantasy/helpers/character_names_en.txt',
            entity_names_cs: 'prompts/fantasy/helpers/character_names_cs.txt'
        }
    };

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

    // Game view specific elements
    const storyLog = document.getElementById('story-log'); // Container for narrative messages
    const storyLogViewport = document.getElementById('story-log-viewport'); // Scrollable viewport for story log
    const suggestedActionsWrapper = document.getElementById('suggested-actions-wrapper'); // Container for AI-suggested actions
    const playerInputControlPanel = document.getElementById('player-input-control-panel'); // Panel containing input fields
    const nameInputSection = document.getElementById('name-input-section'); // Section for player identifier input
    const playerIdentifierInputEl = document.getElementById('player-identifier-input'); // Input field for player's name/callsign
    const startGameButton = document.getElementById('start-game-button'); // Button to initiate the game after entering identifier
    const actionInputSection = document.getElementById('action-input-section'); // Section for player action input
    const playerActionInput = document.getElementById('player-action-input'); // Textarea for player's game actions
    const sendActionButton = document.getElementById('send-action-button'); // Button to submit player's action

    // Story log auto-scroll control
    let userHasManuallyScrolledLog = false; // Flag to manage auto-scrolling behavior
    const AUTOSCROLL_THRESHOLD = 40; // Pixel threshold to re-enable auto-scroll

    /**
     * Retrieves localized UI text based on a key, current language, and theme context.
     * @param {string} key - The i18n key for the text.
     * @param {object} replacements - Optional placeholder replacements (e.g., { "NAME": "John" }).
     * @param {string|null} explicitThemeContext - Optional theme ID to force UI text from a specific theme.
     * @returns {string} The localized text or the key itself if not found.
     */
    function getUIText(key, replacements = {}, explicitThemeContext = null) {
        let text;
        const onLandingPage = document.body.classList.contains('landing-page-active');

        // Prioritize explicit theme context if provided
        if (explicitThemeContext) {
            text = uiTextData[explicitThemeContext]?.[currentAppLanguage]?.[key] ||
                uiTextData[explicitThemeContext]?.en?.[key];
        } else if (onLandingPage && uiTextData.landing) {
            // Use landing page specific texts if on landing page
            text = uiTextData.landing[currentAppLanguage]?.[key] ||
                uiTextData.landing.en?.[key];
        }

        // Fallback to current theme or default theme if text not found
        if (!text) {
            const themeForUI = currentTheme || DEFAULT_THEME_ID;
            text = uiTextData[themeForUI]?.[currentAppLanguage]?.[key] ||
                uiTextData[themeForUI]?.en?.[key];
        }

        text = text || key; // Use key as fallback if no translation found

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
    function setupApiKey() {
        GEMINI_API_KEY = localStorage.getItem('userGeminiApiKey');
        if (!GEMINI_API_KEY) {
            GEMINI_API_KEY = prompt(getUIText('prompt_enter_api_key', { "DEFAULT_VALUE": "" }), "");
            if (GEMINI_API_KEY && GEMINI_API_KEY.trim() !== "") {
                localStorage.setItem('userGeminiApiKey', GEMINI_API_KEY);
            } else {
                GEMINI_API_KEY = ""; // Ensure it's an empty string if user cancels or enters nothing
                alert(getUIText('alert_api_key_required'));
            }
        }

        if (!GEMINI_API_KEY) {
            const errorMsg = uiTextData[DEFAULT_THEME_ID]?.[currentAppLanguage]?.error_critical_no_api_key || "CRITICAL: Gemini API Key not provided.";
            const statusErrorMsg = uiTextData[DEFAULT_THEME_ID]?.[currentAppLanguage]?.status_error || "Error";
            addMessageToLog(errorMsg, 'system');
            console.error(errorMsg);
            if (systemStatusIndicator) {
                systemStatusIndicator.textContent = statusErrorMsg;
                systemStatusIndicator.className = 'status-indicator status-danger';
            }
            // Disable critical UI elements if no API key
            [startGameButton, playerIdentifierInputEl, playerActionInput, sendActionButton].forEach(el => {
                if (el) el.disabled = true;
            });
            if (themeGridContainer) themeGridContainer.style.pointerEvents = 'none'; // Disable theme grid interaction
            return false;
        }
        if (themeGridContainer) themeGridContainer.style.pointerEvents = 'auto'; // Re-enable if key is present
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
            // Basic validation of saved state
            if (!savedState.playerIdentifier || !savedState.gameHistory || savedState.gameHistory.length === 0) {
                clearGameStateInternal(themeIdToLoad); // Clear invalid state
                return false;
            }

            // Apply loaded state
            playerIdentifier = savedState.playerIdentifier;
            gameHistory = savedState.gameHistory;
            lastKnownDashboardUpdates = savedState.lastDashboardUpdates || {};
            lastKnownGameStateIndicators = savedState.lastGameStateIndicators || {};
            currentPromptType = savedState.currentPromptType || 'default';
            currentNarrativeLanguage = savedState.currentNarrativeLanguage || currentAppLanguage;

            // Reconstruct story log
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

            // Restore UI elements
            updateDashboard(lastKnownDashboardUpdates, false); // false to not highlight on load
            handleGameStateIndicators(lastKnownGameStateIndicators, false);

            // Update player identifier on dashboard
            const themeConfig = ALL_THEMES_CONFIG[themeIdToLoad];
            if (themeConfig) {
                const dashboardConfig = THEME_DASHBOARD_CONFIGS[themeConfig.dashboard_config_ref];
                const playerIdentifierConfigKey = themeIdToLoad === 'scifi' ? 'callsign' : 'character_name';
                const playerIdentifierConfig = findItemConfigById(dashboardConfig, playerIdentifierConfigKey);
                if (playerIdentifierConfig) {
                    const el = document.getElementById(`info-${playerIdentifierConfig.id}`);
                    if (el) el.textContent = playerIdentifier;
                }
            }

            isInitialGameLoad = false; // Game is being resumed, not a fresh start
            return true;
        } catch (e) {
            console.error(`Error loading game state for ${themeIdToLoad}:`, e);
            clearGameStateInternal(themeIdToLoad); // Clear corrupted state
            localStorage.removeItem(gameStateKey); // Remove corrupted item from storage
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
    async function fetchPrompt(promptName, themeId) {
        const themePrompts = PROMPT_URLS_BY_THEME[themeId];
        if (!themePrompts || !themePrompts[promptName]) {
            console.error(`Prompt "${promptName}" for theme "${themeId}" not found in configuration.`);
            return `Error: Prompt "${promptName}" for theme "${themeId}" not found.`;
        }
        try {
            const response = await fetch(themePrompts[promptName]);
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status} for ${themeId}/${promptName}: ${response.statusText}`);
            }
            return await response.text();
        } catch (error) {
            console.error(`Error fetching prompt ${themeId}/${promptName}:`, error);
            addMessageToLog(getUIText('error_load_prompt_file', { THEME: themeId, PROMPT_NAME: promptName }), 'system');
            return `Error: Prompt "${themeId}/${promptName}" load failed. ${error.message}`;
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

        if (!gamePrompts[themeId]) gamePrompts[themeId] = {}; // Initialize if not present

        const promptNames = Object.keys(PROMPT_URLS_BY_THEME[themeId]);
        const loadingPromises = promptNames.map(name =>
            fetchPrompt(name, themeId).then(text => gamePrompts[themeId][name] = text)
        );

        try {
            await Promise.all(loadingPromises);
            // Check if any prompt failed to load (will start with "Error:")
            for (const name of promptNames) {
                if (gamePrompts[themeId][name]?.startsWith("Error:")) {
                    throw new Error(`Prompt load failure: ${themeId}/${name}. Check console for details.`);
                }
            }
            return true;
        } catch (error) {
            console.error(`Critical error loading one or more prompts for ${themeId}:`, error);
            if (systemStatusIndicator) {
                systemStatusIndicator.textContent = getUIText('status_error');
                systemStatusIndicator.className = 'status-indicator status-danger';
            }
            // Disable game start if prompts fail
            [startGameButton, playerIdentifierInputEl].forEach(el => { if (el) el.disabled = true; });
            return false;
        }
    }

    /**
     * Constructs the system prompt for the AI based on current game state, theme, and player.
     * @param {string} currentPlayerIdentifierParam - The player's identifier.
     * @param {string} promptTypeToUse - The type of prompt needed ('initial', 'default', 'combat').
     * @returns {string} The fully constructed system prompt (JSON string) or an error JSON.
     */
    const getSystemPrompt = (currentPlayerIdentifierParam, promptTypeToUse) => {
        if (!currentTheme) {
            return `{"narrative": "SYSTEM ERROR: No active theme for prompt generation.", "dashboard_updates": {}, "suggested_actions": [], "game_state_indicators": {}}`;
        }

        const narrativeLangInstruction = NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[currentTheme]?.[currentNarrativeLanguage] || NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[DEFAULT_THEME_ID]?.[DEFAULT_LANGUAGE];
        let basePromptText = gamePrompts[currentTheme]?.[promptTypeToUse] || gamePrompts[currentTheme]?.default;

        if (!basePromptText || basePromptText.startsWith("Error:")) {
            return `{"narrative": "SYSTEM ERROR: Prompt data missing or failed to load for ${currentTheme}/${promptTypeToUse}.", "dashboard_updates": {}, "suggested_actions": ["Check panel.", "Change theme."], "game_state_indicators": {"activity_status": "Error", "combat_engaged": false, "comms_channel_active": false}}`;
        }

        // Replace common placeholders
        basePromptText = basePromptText.replace(/\$\{narrativeLanguageInstruction\}/g, narrativeLangInstruction);
        basePromptText = basePromptText.replace(/\$\{currentCallsignForPrompt\}/g, currentPlayerIdentifierParam || getUIText('unknown'));
        basePromptText = basePromptText.replace(/\$\{currentPlayerIdentifier\}/g, currentPlayerIdentifierParam || getUIText('unknown'));
        basePromptText = basePromptText.replace(/\$\{currentNarrativeLanguage\.toUpperCase\(\)\}/g, currentNarrativeLanguage.toUpperCase());

        // Special handling for initial prompt (e.g., inject random start scenarios, names)
        if (promptTypeToUse === 'initial' && gamePrompts[currentTheme]) {
            // Inject starting ideas
            if (gamePrompts[currentTheme].starts) {
                const allStarts = gamePrompts[currentTheme].starts.split('\n').map(s => s.trim()).filter(s => s.length > 0);
                const selectedStarts = allStarts.length > 0 ? [...allStarts].sort(() => 0.5 - Math.random()).slice(0, 3) : [];
                ['startIdea1', 'startIdea2', 'startIdea3'].forEach((placeholder, i) => {
                    basePromptText = basePromptText.replace(new RegExp(`\\$\\{${placeholder}\\}`, 'g'), selectedStarts[i] || `Generic ${currentTheme} scenario ${i + 1}`);
                });
            }

            // Inject suggested asset/entity names based on theme and language
            let assetNamesContent = null;
            const assetKey = currentTheme === 'scifi' ? `asset_names_${currentNarrativeLanguage}` : `entity_names_${currentNarrativeLanguage}`;
            const fallbackAssetKey = currentTheme === 'scifi' ? 'asset_names_en' : 'entity_names_en';

            assetNamesContent = gamePrompts[currentTheme][assetKey] || gamePrompts[currentTheme][fallbackAssetKey];

            if (assetNamesContent) {
                const allAssets = assetNamesContent.split('\n').map(n => n.trim()).filter(n => n.length > 0);
                const selectedAssets = allAssets.length > 0 ? [...allAssets].sort(() => 0.5 - Math.random()).slice(0, 3) : [];
                // Handles both generic names and scifi-specific ship names placeholders
                ['suggestedName1', 'suggestedName2', 'suggestedName3', 'suggestedShipName1', 'suggestedShipName2', 'suggestedShipName3'].forEach((ph, iMod) => {
                    const i = iMod % 3; // Use modulo for asset selection to cycle through selectedAssets
                    basePromptText = basePromptText.replace(new RegExp(`\\$\\{${ph}\\}`, 'g'), selectedAssets[i] || `Default${ph.includes('Ship') ? 'Asset' : ''}Name${i + 1}`);
                });
            } else {
                // Fallback if no asset name files are found
                ['suggestedName1', 'suggestedName2', 'suggestedName3'].forEach((ph, i) => basePromptText = basePromptText.replace(new RegExp(`\\$\\{${ph}\\}`, 'g'), `InventedName${i + 1}`));
                ['suggestedShipName1', 'suggestedShipName2', 'suggestedShipName3'].forEach((ph, i) => basePromptText = basePromptText.replace(new RegExp(`\\$\\{${ph}\\}`, 'g'), `InventedAssetName${i + 1}`));
            }
        }

        // Language-specific dynamic text replacement
        const onlineOfflineText = currentNarrativeLanguage.toUpperCase() === 'EN' ? "'Online' or 'Offline'" : `'${getUIText('online')}' or '${getUIText('offline')}'`;
        basePromptText = basePromptText.replace(/\$\{currentNarrativeLanguage\.toUpperCase\(\) === 'EN' \? "'Online' or 'Offline'" : "'Připojeno' or 'Odpojeno'"\}/g, onlineOfflineText);

        return basePromptText;
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

        // Create a map of all item configurations for quick lookup
        const allItems = [...(themeCfg.left_panel || []).flatMap(b => b.items), ...(themeCfg.right_panel || []).flatMap(b => b.items)];
        const itemConfigsMap = new Map(allItems.map(i => [i.id, i]));

        for (const key in updatesFromAI) {
            if (Object.prototype.hasOwnProperty.call(updatesFromAI, key)) {
                const value = updatesFromAI[key];
                let itemCfg = itemConfigsMap.get(key);
                let actualUpdateOccurred = false;

                // Handle theme-specific aliases (e.g., callsign vs character_name)
                if (!itemCfg && key === 'callsign' && currentTheme === 'fantasy') {
                    itemCfg = itemConfigsMap.get('character_name');
                    if (itemCfg) playerIdentifier = String(value); // Update playerIdentifier if it's this item
                } else if (key === 'callsign' || key === 'character_name') {
                    playerIdentifier = String(value); // Update global playerIdentifier
                }
                if (!itemCfg) continue; // Skip if no config found for this key

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
                        let statusClass = 'status-info'; // Default class
                        const lowerValue = newStatusText.toLowerCase();
                        // Special styling for alert levels
                        if (itemCfg.id === 'alertLevel' || itemCfg.id === 'alert_level') {
                            if (lowerValue.includes(getUIText('alert_level_danger_val', {}, currentTheme).toLowerCase())) statusClass = 'status-danger';
                            else if (lowerValue.includes(getUIText('alert_level_wary_val', {}, currentTheme).toLowerCase()) || lowerValue.includes(getUIText('alert_level_yellow_val', {}, currentTheme).toLowerCase())) statusClass = 'status-warning';
                            else if (lowerValue.includes(getUIText('alert_level_calm_val', {}, currentTheme).toLowerCase()) || lowerValue.includes(getUIText('alert_level_green_val', {}, currentTheme).toLowerCase())) statusClass = 'status-ok';
                        }
                        if (valueElement.textContent !== newStatusText || !valueElement.className.includes(statusClass)) {
                            valueElement.textContent = newStatusText;
                            valueElement.className = `value ${statusClass}`; // Apply new class
                            if (highlightChanges) highlightElementUpdate(valueElement);
                            actualUpdateOccurred = true;
                        }
                    }
                } else { // Plain text update
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

                // If an update occurred and the item is in a collapsible panel, expand the panel
                if (actualUpdateOccurred) {
                    const parentPanelConfig = getParentPanelConfig(key, themeCfg);
                    if (parentPanelConfig && parentPanelConfig.type === 'collapsible') {
                        const panelElement = document.getElementById(parentPanelConfig.id);
                        if (panelElement && !panelElement.classList.contains('is-expanded')) {
                            animatePanelBox(parentPanelConfig.id, true, false); // Expand, don't manage visibility (already visible)
                        }
                    }
                }
            }
        }
        // Merge new updates into the last known state
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
                    // Get default value from config or i18n key
                    const defaultValue = itemCfg.default_value !== undefined ? String(itemCfg.default_value) : getUIText(itemCfg.default_value_key);

                    if (itemCfg.type === 'meter') {
                        if (valueEl || meterBarEl) {
                            const defaultStatus = itemCfg.default_status_key ? getUIText(itemCfg.default_status_key) : getUIText('offline');
                            setMeter(meterBarEl, valueEl, defaultValue, itemCfg.meter_type, {
                                highlight: false,
                                newStatusText: defaultStatus,
                                initialPlaceholder: `${defaultStatus}: ${defaultValue}%` // Used by setMeter if value is null
                            });
                        }
                    } else if (itemCfg.type === 'status_text') {
                        if (valueEl) {
                            const displayDefault = getUIText(itemCfg.default_value_key);
                            const statusValueDefault = itemCfg.default_status_key ? getUIText(itemCfg.default_status_key) : displayDefault;
                            valueEl.textContent = displayDefault;
                            let statusClass = 'status-info';
                            const lowerValue = statusValueDefault.toLowerCase();
                            // Apply alert level classes based on default status
                            if (itemCfg.id === 'alertLevel' || itemCfg.id === 'alert_level') {
                                if (lowerValue.includes(getUIText('alert_level_danger_val', {}, currentTheme).toLowerCase())) statusClass = 'status-danger';
                                else if (lowerValue.includes(getUIText('alert_level_wary_val', {}, currentTheme).toLowerCase()) || lowerValue.includes(getUIText('alert_level_yellow_val', {}, currentTheme).toLowerCase())) statusClass = 'status-warning';
                                else if (lowerValue.includes(getUIText('alert_level_calm_val', {}, currentTheme).toLowerCase()) || lowerValue.includes(getUIText('alert_level_green_val', {}, currentTheme).toLowerCase())) statusClass = 'status-ok';
                            }
                            valueEl.className = `value ${statusClass}`;
                        }
                    } else { // Plain text
                        if (valueEl) {
                            const suffix = itemCfg.suffix || '';
                            valueEl.textContent = `${defaultValue}${suffix}`;
                        }
                    }
                });
            });
        });

        // Set player identifier specifically
        const idKey = currentTheme === 'scifi' ? 'callsign' : 'character_name';
        const idCfg = findItemConfigById(themeCfg, idKey);
        if (idCfg) {
            const el = document.getElementById(`info-${idCfg.id}`);
            if (el) el.textContent = playerIdentifier || getUIText(idCfg.default_value_key);
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
                    likeButton.innerHTML = `<img src="images/icon_heart_filled.svg" alt="${getUIText('aria_label_unlike_theme')}" class="like-icon">`;
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
                    likeButton.innerHTML = `<img src="images/icon_heart_empty.svg" alt="${getUIText('aria_label_like_theme')}" class="like-icon">`;
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
        if (document.documentElement) document.documentElement.lang = lang; // Set lang attribute on <html>

        const onLandingPage = document.body.classList.contains('landing-page-active');

        // Update body classes for global styling (theme, landing page state)
        document.body.className = ''; // Clear existing classes
        if (onLandingPage) {
            document.body.classList.add('landing-page-active');
            document.body.classList.add(`theme-landing`); // Generic landing theme
        } else if (currentTheme) { // currentTheme is the globally active game theme
            document.body.classList.add(`theme-${currentTheme}`);
        } else {
            document.body.classList.add(`theme-${DEFAULT_THEME_ID}`); // Fallback
        }

        // Update language toggle button text and ARIA
        if (languageToggleButton) {
            const otherLangKeyForButtonText = currentAppLanguage === 'en' ?
                (uiTextData.landing?.cs?.toggle_language || "Česky") :
                (uiTextData.landing?.en?.toggle_language || "English");
            languageToggleButton.textContent = otherLangKeyForButtonText;
            const ariaToggleKey = `aria_label_toggle_language`;
            languageToggleButton.setAttribute('aria-label', getUIText(ariaToggleKey));
            languageToggleButton.title = getUIText(ariaToggleKey);
        }

        // Update other global buttons
        if (newGameButton) {
            newGameButton.textContent = getUIText('button_new_game');
            newGameButton.title = getUIText('aria_label_new_game');
            newGameButton.setAttribute('aria-label', getUIText('aria_label_new_game'));
        }
        if (modelToggleButton) modelToggleButton.title = getUIText('aria_label_toggle_model_generic'); // Generic title, specific text updated by its own function

        // Update status indicators
        if (systemStatusIndicator) systemStatusIndicator.textContent = getUIText(systemStatusIndicator.dataset.langKey || 'system_status_online_short');
        if (gmSpecificActivityIndicator) gmSpecificActivityIndicator.textContent = getUIText(gmSpecificActivityIndicator.dataset.langKey || 'system_processing_short');

        // Update dashboard panel titles and item labels if in game view
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
            initializeDashboardDefaultTexts(); // Re-initialize with new language
        } else if (onLandingPage) {
            renderThemeGrid(); // Re-render grid with new language
            // Re-select active grid item if any
            if (currentLandingGridSelection && themeGridContainer) {
                const selectedBtn = themeGridContainer.querySelector(`.theme-grid-icon[data-theme="${currentLandingGridSelection}"]`);
                if (selectedBtn) selectedBtn.classList.add('active');
            }
        }

        // Update input placeholders and button texts
        if (playerIdentifierInputEl) playerIdentifierInputEl.placeholder = getUIText('placeholder_callsign_login');
        if (startGameButton) startGameButton.textContent = getUIText('button_access_systems');
        if (playerActionInput) playerActionInput.placeholder = getUIText('placeholder_command');
        if (sendActionButton) sendActionButton.textContent = getUIText('button_execute_command');

        updateModelToggleButtonText(); // Ensure model button text is correct
        updateTopbarThemeIcons(); // Refresh top bar icons with new language

        // Update landing page panel content if on landing page
        if (onLandingPage && currentLandingGridSelection) {
            updateLandingPagePanels(currentLandingGridSelection, false); // false = no animation
        } else if (onLandingPage) { // Default text if no theme selected on landing
            landingThemeLoreText.textContent = getUIText('landing_select_theme_prompt_lore');
            landingThemeInfoContent.innerHTML = `<p>${getUIText('landing_select_theme_prompt_details')}</p>`;
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
     * Handles game state indicators from the AI, like showing/hiding conditional panels.
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
                    const delay = isInitialBoot && boxCfg.boot_delay ? boxCfg.boot_delay : 0; // Apply boot delay on initial load
                    setTimeout(() => animatePanelBox(boxCfg.id, true, true), delay); // Expand and make visible
                } else if (!shouldShow && isShowing) {
                    animatePanelBox(boxCfg.id, false, true); // Collapse and hide
                }
            }
        });

        // Update current prompt type based on combat indicator
        if (indicators.combat_engaged === true && currentPromptType !== 'combat') {
            currentPromptType = 'combat';
        } else if (indicators.combat_engaged === false && currentPromptType === 'combat') {
            currentPromptType = 'default';
        }
    }

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

        const systemPrompt = getSystemPrompt(playerIdentifier, activePromptType);
        // Handle errors from prompt generation (e.g., missing prompt files)
        if (systemPrompt.startsWith('{"narrative": "SYSTEM ERROR:')) {
            try {
                const errorResponse = JSON.parse(systemPrompt);
                addMessageToLog(errorResponse.narrative, 'system');
                if (errorResponse.suggested_actions) displaySuggestedActions(errorResponse.suggested_actions);
            } catch (e) { /* If parsing error JSON fails, do nothing specific */ }
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
        const safetySettings = [ // Configure safety settings to be less restrictive
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ];
        const payload = {
            contents: currentTurnHistory,
            generationConfig: generationConfig,
            safetySettings: safetySettings,
            systemInstruction: { parts: [{ text: systemPrompt }] }
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
                    // Validate structure of AI's JSON response
                    if (typeof parsedAIResponse.narrative !== 'string' ||
                        typeof parsedAIResponse.dashboard_updates !== 'object' ||
                        !Array.isArray(parsedAIResponse.suggested_actions) ||
                        typeof parsedAIResponse.game_state_indicators !== 'object') {
                        throw new Error("Invalid JSON structure from AI. Missing required fields.");
                    }

                    // Add AI response to game history (as stringified JSON for faithful storage)
                    gameHistory.push({ role: "model", parts: [{ text: JSON.stringify(parsedAIResponse) }] });

                    // Update UI based on AI response
                    updateDashboard(parsedAIResponse.dashboard_updates);
                    displaySuggestedActions(parsedAIResponse.suggested_actions);
                    handleGameStateIndicators(parsedAIResponse.game_state_indicators, isInitialGameLoad);

                    if (isInitialGameLoad) isInitialGameLoad = false; // No longer initial load after first successful AI call
                    saveGameState(); // Persist game state

                    if (systemStatusIndicator) { // Update system status to online
                        systemStatusIndicator.textContent = getUIText('system_status_online_short');
                        systemStatusIndicator.className = 'status-indicator status-ok';
                    }
                    return parsedAIResponse.narrative; // Return only the narrative part for display
                } catch (e) {
                    throw new Error(`Invalid JSON received from AI: ${e.message}. Raw string (first 500 chars): ${jsonStringFromAI.substring(0, 500)}...`);
                }
            } else if (responseData.promptFeedback?.blockReason) { // Handle content blocking by API
                const blockDetails = responseData.promptFeedback.safetyRatings?.map(r => `${r.category}: ${r.probability}`).join(', ') || "No details provided.";
                throw new Error(`Content blocked by API: ${responseData.promptFeedback.blockReason}. Safety Ratings: ${blockDetails}`);
            } else {
                throw new Error("No valid candidate or text found in AI response.");
            }
        } catch (error) {
            console.error("Gemini API call failed:", error);
            addMessageToLog(getUIText('error_api_call_failed', { ERROR_MSG: error.message }), 'system');
            if (systemStatusIndicator) { // Update status to error
                systemStatusIndicator.textContent = getUIText('status_error');
                systemStatusIndicator.className = 'status-indicator status-danger';
            }
            return null;
        } finally {
            setGMActivity(false); // Indicate processing finished
        }
    }

    /**
     * Starts the game session after the player enters their identifier.
     */
    async function startGameAfterIdentifier() {
        const enteredIdentifier = playerIdentifierInputEl ? playerIdentifierInputEl.value.trim() : "";
        if (!enteredIdentifier) {
            alert(getUIText('alert_identifier_required'));
            if (playerIdentifierInputEl) playerIdentifierInputEl.focus();
            return;
        }

        playerIdentifier = enteredIdentifier;
        isInitialGameLoad = true; // This is the start of a new session flow
        currentPromptType = 'initial'; // Use initial prompt for the very first AI interaction

        // Switch UI from name input to action input
        if (nameInputSection) nameInputSection.style.display = 'none';
        if (actionInputSection) actionInputSection.style.display = 'flex';

        // Animate story log appearance if it was hidden
        if (storyLogViewport && storyLogViewport.classList.contains('spawn-animation')) {
            // Animation already handled or will be by switchToGameView
        } else if (storyLogViewport) {
            storyLogViewport.style.opacity = '1';
            storyLogViewport.style.transform = 'translateY(0) scale(1)';
        }

        if (playerActionInput) { // Prepare action input field
            playerActionInput.value = '';
            playerActionInput.dispatchEvent(new Event('input', { bubbles: true })); // For auto-grow
            autoGrowTextarea(playerActionInput);
            playerActionInput.focus();
        }

        // Update dashboard with player identifier
        const idKey = currentTheme === 'scifi' ? 'callsign' : 'character_name';
        updateDashboard({ [idKey]: playerIdentifier }, false); // No highlight for this initial set

        addMessageToLog(getUIText('connecting', { PLAYER_ID: playerIdentifier }), 'system');

        // Create initial game history entry for the AI
        gameHistory = [{
            role: "user",
            parts: [{ text: `My identifier is ${playerIdentifier}. I am ready to start the game in ${currentTheme} theme.` }]
        }];
        saveGameState(); // Save this initial state

        clearSuggestedActions();
        const narrative = await callGeminiAPI(gameHistory); // Make the first call to AI

        if (narrative) {
            addMessageToLog(narrative, 'gm'); // Display AI's opening narrative
        } else {
            // If initial AI call fails, revert to name input
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
    function startNewGameSession() {
        if (!currentTheme && !currentLandingGridSelection) {
            alert(getUIText('alert_select_theme_first'));
            return;
        }
        const themeToStartNewGameIn = currentTheme || currentLandingGridSelection;
        if (!themeToStartNewGameIn) return; // Should not happen if above check passes

        const themeName = getUIText(ALL_THEMES_CONFIG[themeToStartNewGameIn].name_key);
        // Use a theme-specific confirmation key if available, else generic
        const confirmKey = `confirm_new_game_theme_${themeToStartNewGameIn}`;
        const confirmMsg = getUIText(confirmKey, { THEME_NAME: themeName }) ||
            getUIText('confirm_new_game_generic', { THEME_NAME: themeName });

        if (confirm(confirmMsg)) {
            addMessageToLog(getUIText('system_new_game_initiated', { THEME_NAME: themeName }), 'system');
            changeThemeAndStart(themeToStartNewGameIn, true); // true = force new game
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

        // If trying to switch to the same theme without forcing new game, just ensure game view is active
        if (oldThemeId === newThemeId && !forceNewGame) {
            if (storyLogViewport && storyLogViewport.style.display === 'none') { // If game view not active
                switchToGameView(newThemeId);
                if (playerActionInput && actionInputSection && actionInputSection.style.display !== 'none') {
                    playerActionInput.focus();
                }
            }
            return;
        }

        // Update current theme context
        currentTheme = newThemeId;
        localStorage.setItem(CURRENT_THEME_STORAGE_KEY, currentTheme);
        addPlayingTheme(currentTheme); // Mark as actively playing

        // Clear or prepare game state
        clearGameStateInternal(currentTheme); // Clear in-memory state for the new theme
        if (forceNewGame) {
            localStorage.removeItem(GAME_STATE_STORAGE_KEY_PREFIX + currentTheme); // Remove saved state if forcing new
        }

        switchToGameView(currentTheme); // Transition UI to game layout

        // Set up theme-specific UI
        generatePanelsForTheme(currentTheme);
        setAppLanguageAndThemeUI(currentAppLanguage, currentTheme); // Update texts for new theme context
        initializeDashboardDefaultTexts();
        initializeCollapsiblePanelBoxes(currentTheme);

        // Load prompts for the new theme
        const promptsLoadedSuccessfully = await loadAllPromptsForTheme(currentTheme);
        if (!promptsLoadedSuccessfully) {
            addMessageToLog(getUIText('error_load_prompts_critical', { THEME: currentTheme }), 'system-error');
            if (startGameButton) startGameButton.disabled = true;
            switchToLandingView(); // Fallback to landing if prompts fail
            return;
        }
        if (startGameButton) startGameButton.disabled = false;

        updateTopbarThemeIcons(); // Reflect theme change in top bar

        // Attempt to load saved game state if not forcing new
        if (!forceNewGame && loadGameState(currentTheme)) {
            isInitialGameLoad = false; // Resuming a game

            // UI setup for resumed game
            if (nameInputSection) nameInputSection.style.display = 'none';
            if (actionInputSection) actionInputSection.style.display = 'flex';
            if (playerActionInput) playerActionInput.focus();

            addMessageToLog(getUIText('system_session_resumed', { PLAYER_ID: playerIdentifier, THEME_NAME: getUIText(ALL_THEMES_CONFIG[currentTheme].name_key) }), 'system');
            if (systemStatusIndicator) { // Set status to online
                systemStatusIndicator.textContent = getUIText('system_status_online_short');
                systemStatusIndicator.className = 'status-indicator status-ok';
            }
        } else { // Starting fresh (or load failed)
            isInitialGameLoad = true;
            currentPromptType = 'initial';
            if (storyLog) storyLog.innerHTML = ''; // Clear story log
            clearSuggestedActions();

            // UI setup for new game (identifier input)
            if (nameInputSection) nameInputSection.style.display = 'flex';
            if (actionInputSection) actionInputSection.style.display = 'none';
            if (playerIdentifierInputEl) {
                playerIdentifierInputEl.value = '';
                playerIdentifierInputEl.placeholder = getUIText('placeholder_callsign_login');
                playerIdentifierInputEl.focus();
            }

            if (systemStatusIndicator) { // Set status to standby
                systemStatusIndicator.textContent = getUIText('standby');
                systemStatusIndicator.className = 'status-indicator status-warning';
            }
            if (oldThemeId !== newThemeId) { // Log theme change if it occurred
                addMessageToLog(getUIText('system_theme_set_generic', { THEME_NAME: getUIText(ALL_THEMES_CONFIG[newThemeId].name_key) }), 'system');
            }
            if (forceNewGame) { // Log new game initiation
                addMessageToLog(getUIText('system_new_game_initiated', { THEME_NAME: getUIText(ALL_THEMES_CONFIG[currentTheme].name_key) }), 'system');
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
            const themeDisplayNameOnGrid = getUIText(theme.name_key); // Localized name
            button.title = themeDisplayNameOnGrid; // Tooltip

            const img = document.createElement('img');
            img.src = theme.icon;
            const altTextKey = `theme_icon_alt_text_default_${theme.id}`; // Specific alt text key
            img.alt = getUIText(altTextKey) || themeDisplayNameOnGrid; // Fallback to display name

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
        if (descTitle) descTitle.textContent = getUIText('landing_theme_description_title');

        const detailsPanelContainer = document.getElementById('landing-theme-details-container');
        const detailsTitle = detailsPanelContainer ? detailsPanelContainer.querySelector('.panel-box-title') : null;
        if (detailsTitle) detailsTitle.textContent = getUIText('landing_theme_info_title');

        // Set lore text
        landingThemeLoreText.textContent = getUIText(themeConfig.lore_key);
        if (animate) { // Optionally animate lore panel expansion
            const lorePanelBox = landingThemeDescriptionContainer.querySelector('.panel-box');
            if (lorePanelBox && lorePanelBox.id) animatePanelBox(lorePanelBox.id, true, false);
        }

        // Set setting and details text
        landingThemeInfoContent.innerHTML = `
            <p><strong>${getUIText('landing_theme_setting_label')}:</strong> <span id="landing-selected-theme-setting">${getUIText(themeConfig.setting_key)}</span></p>
            <p><strong>${getUIText('landing_theme_details_label')}:</strong> <span id="landing-selected-theme-details-text">${getUIText(themeConfig.details_key)}</span></p>
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
    function renderLandingPageActionButtons(themeId) {
        if (!landingThemeActions) return;
        landingThemeActions.innerHTML = ''; // Clear previous buttons

        // "Choose this theme" button
        const chooseButton = document.createElement('button');
        chooseButton.id = 'choose-theme-button';
        chooseButton.classList.add('ui-button', 'primary');
        chooseButton.textContent = getUIText('landing_choose_theme_button');
        chooseButton.addEventListener('click', () => handleChooseThisThemeClick(themeId));

        // "Like/Unlike" button
        const likeButton = document.createElement('button');
        likeButton.id = 'like-theme-button';
        likeButton.classList.add('ui-button', 'icon-button', 'like-theme-button');
        const isCurrentlyLiked = isThemeLiked(themeId);
        const likeTextKey = isCurrentlyLiked ? 'aria_label_unlike_theme' : 'aria_label_like_theme';
        const likeText = getUIText(likeTextKey);
        likeButton.innerHTML = `<img src="${isCurrentlyLiked ? 'images/icon_heart_filled.svg' : 'images/icon_heart_empty.svg'}" alt="${likeText}" class="like-icon">`;
        likeButton.setAttribute('aria-label', likeText);
        likeButton.title = likeText; // Tooltip
        if (isCurrentlyLiked) likeButton.classList.add('liked'); // Style if liked

        likeButton.addEventListener('click', () => handleLikeThemeClick(themeId, likeButton)); // Pass button for direct update

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
     * Main application initialization function. Sets up API key, loads preferences,
     * and determines whether to show landing page or resume a game.
     */
    async function initializeApp() {
        loadThemeListsFromStorage(); // Load user's playing/liked themes

        // Load preferences from localStorage or use defaults
        currentTheme = localStorage.getItem(CURRENT_THEME_STORAGE_KEY) || null;
        currentAppLanguage = localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY) || DEFAULT_LANGUAGE;
        currentNarrativeLanguage = localStorage.getItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY) || currentAppLanguage;
        currentModelName = localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY) || FREE_MODEL_NAME;

        updateModelToggleButtonText();

        // Critical: Setup API key. If fails, app remains on landing page with limited functionality.
        if (!setupApiKey()) {
            switchToLandingView(); // Ensure landing view is shown
            setAppLanguageAndThemeUI(currentAppLanguage, DEFAULT_THEME_ID); // Set basic UI texts
            return; // Stop further initialization
        }

        let gameToResume = null;
        let successfullyLoadedStateForResume = false;

        // Check if there's a current theme set and if it's in the "playing" list (valid session)
        if (currentTheme && isThemePlaying(currentTheme)) {
            // Temporarily store potentially unsaved player ID and history in case load fails
            const tempPlayerId = playerIdentifier;
            const tempGameHistory = [...gameHistory];
            playerIdentifier = ''; // Clear before attempting load
            gameHistory = [];

            if (await loadAllPromptsForTheme(currentTheme)) { // Prompts must load to resume
                if (loadGameState(currentTheme)) { // Attempt to load saved state
                    gameToResume = currentTheme;
                    successfullyLoadedStateForResume = true;
                } else {
                    // Load failed: remove from playing themes, clear currentTheme, restore temp state
                    removePlayingTheme(currentTheme, false); // false = don't move to liked, it was a failed session
                    currentTheme = null;
                    localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
                    playerIdentifier = tempPlayerId; // Restore previous in-memory values if any
                    gameHistory = tempGameHistory;
                }
            } else {
                // Prompts failed to load: treat as session failure
                removePlayingTheme(currentTheme, false);
                currentTheme = null;
                localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
                playerIdentifier = tempPlayerId;
                gameHistory = tempGameHistory;
                addMessageToLog(getUIText('error_resume_failed_prompts', { THEME: currentTheme }), 'system-error');
            }
        } else if (currentTheme) {
            // If currentTheme was set but not in playingThemes, it's an invalid/stale reference
            currentTheme = null;
            localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
        }

        if (gameToResume && successfullyLoadedStateForResume) {
            currentTheme = gameToResume; // Confirm the theme to resume

            switchToGameView(currentTheme); // Show game UI

            generatePanelsForTheme(currentTheme); // Create dashboard panels
            setAppLanguageAndThemeUI(currentAppLanguage, currentTheme); // Set texts and styles
            initializeDashboardDefaultTexts(); // Set default values for dashboard items

            // Restore dynamic dashboard values and game state indicators
            updateDashboard(lastKnownDashboardUpdates, false); // false = no highlight on resume
            handleGameStateIndicators(lastKnownGameStateIndicators, true); // true = it's an initial boot for these indicators

            initializeCollapsiblePanelBoxes(currentTheme); // Setup panel interactivity

            // Configure UI for resumed game (action input visible)
            if (nameInputSection) nameInputSection.style.display = 'none';
            if (actionInputSection) actionInputSection.style.display = 'flex';
            if (playerActionInput && document.body.contains(playerActionInput)) {
                playerActionInput.focus();
            }

            addMessageToLog(getUIText('system_session_resumed', { PLAYER_ID: playerIdentifier, THEME_NAME: getUIText(ALL_THEMES_CONFIG[currentTheme].name_key) }), 'system');
            if (systemStatusIndicator) {
                systemStatusIndicator.textContent = getUIText('system_status_online_short');
                systemStatusIndicator.className = 'status-indicator status-ok';
            }
            isInitialGameLoad = false; // Game is being resumed
        } else {
            // No game to resume, or resume failed: switch to landing page
            switchToLandingView();
        }

        updateTopbarThemeIcons(); // Update top bar icons based on loaded lists
        if (playerActionInput) autoGrowTextarea(playerActionInput); // Initial size adjustment for action input
    }

    // Event Listeners for global controls
    if (applicationLogoElement) applicationLogoElement.addEventListener('click', switchToLandingView);
    if (languageToggleButton) languageToggleButton.addEventListener('click', toggleAppLanguage);
    if (newGameButton) newGameButton.addEventListener('click', startNewGameSession);
    if (modelToggleButton) modelToggleButton.addEventListener('click', toggleModelType);

    // Event Listeners for game start controls
    if (startGameButton) startGameButton.addEventListener('click', startGameAfterIdentifier);
    if (playerIdentifierInputEl) {
        playerIdentifierInputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') startGameAfterIdentifier();
        });
    }

    // Event Listeners for player action input
    if (sendActionButton) sendActionButton.addEventListener('click', sendPlayerAction);
    if (playerActionInput) {
        playerActionInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { // Enter to send, Shift+Enter for newline
                e.preventDefault(); // Prevent default newline on Enter
                sendPlayerAction();
            }
        });
        playerActionInput.addEventListener('input', () => autoGrowTextarea(playerActionInput)); // Auto-resize on input
    }

    // Event listener for story log scroll (to manage auto-scroll behavior)
    if (storyLogViewport) {
        storyLogViewport.addEventListener('scroll', () => {
            // If scrolled up significantly from the bottom, user has manually scrolled
            if (storyLogViewport.scrollHeight - storyLogViewport.clientHeight > storyLogViewport.scrollTop + AUTOSCROLL_THRESHOLD) {
                userHasManuallyScrolledLog = true;
            }
        });
    }

    // Initialize the application
    initializeApp();
});