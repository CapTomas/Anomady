// Wait for the DOM to be fully loaded before initializing the application
document.addEventListener("DOMContentLoaded", () => {
  // API Key for Gemini (fetched from localStorage or user prompt)
  let GEMINI_API_KEY = "";

  // Default application settings
  const DEFAULT_LANGUAGE = "cs"; // Default UI and narrative language
  const DEFAULT_THEME_ID = "scifi"; // Default theme if none is selected
  const UPDATE_HIGHLIGHT_DURATION = 5000; // Duration for UI update highlights (ms)

  // localStorage keys for persisting application state and preferences
  const CURRENT_THEME_STORAGE_KEY = "anomadyCurrentTheme";
  const GAME_STATE_STORAGE_KEY_PREFIX = "anomadyGameState_"; // Prefix for theme-specific game states
  const MODEL_PREFERENCE_STORAGE_KEY = "anomadyModelPreference";
  const LANGUAGE_PREFERENCE_STORAGE_KEY = "preferredAppLanguage";
  const NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY =
    "preferredNarrativeLanguage";
  const PLAYING_THEMES_STORAGE_KEY = "anomadyPlayingThemes"; // Themes currently being played or recently played
  const LIKED_THEMES_STORAGE_KEY = "anomadyLikedThemes"; // Themes liked by the user
  const LANDING_SELECTED_GRID_THEME_KEY = "anomadyLandingSelectedGridTheme"; // Theme selected on landing page grid

  // AI Model identifiers
  const PAID_MODEL_NAME = "gemini-2.5-flash-preview-04-17"; // Identifier for the preferred/paid model
  const FREE_MODEL_NAME = "gemini-1.5-flash-latest"; // Identifier for the standard/free model (currently same as paid)
  let currentModelName =
    localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY) || FREE_MODEL_NAME;

  // Core application state variables
  let currentTheme = localStorage.getItem(CURRENT_THEME_STORAGE_KEY) || null; // Active game theme
  let currentAppLanguage =
    localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY) || DEFAULT_LANGUAGE; // Current UI language
  let currentNarrativeLanguage =
    localStorage.getItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY) ||
    currentAppLanguage; // Current language for AI narrative

  // Dynamically loaded theme data
  let ALL_THEMES_CONFIG = {}; // Stores all theme configurations { themeId: configObject }
  let themeTextData = {}; // Stores UI text data { themeId: { lang: { key: value } } }
  let PROMPT_URLS_BY_THEME = {}; // Stores prompt file URLs { themeId: { promptName: url } }
  let NARRATIVE_LANG_PROMPT_PARTS_BY_THEME = {}; // Stores narrative lang instructions { themeId: { lang: text } }

  let gamePrompts = {}; // Stores loaded prompt texts, keyed by theme and prompt name
  let currentPromptType = "initial"; // Type of system prompt to use (e.g., 'initial', 'default', 'combat_engaged')
  let gameHistory = []; // Array of conversation turns with the AI
  let playerIdentifier = ""; // User's chosen name or identifier in the game
  let isInitialGameLoad = true; // Flag indicating if this is the first load of a game session
  let lastKnownDashboardUpdates = {}; // Cache of the last AI-provided dashboard values
  let lastKnownGameStateIndicators = {}; // Cache of the last AI-provided game state flags
  let currentModalResolve = null; // To handle Promises for prompt/confirm
  let currentSuggestedActions = []; // Cache of the last AI-provided suggested actions
  let currentPanelStates = {}; // Cache of panel open/closed states { panelId: boolean

  // User's theme lists
  let playingThemes = []; // Themes the user has active sessions for
  let likedThemes = []; // Themes the user has marked as liked
  let currentLandingGridSelection = null; // Theme ID selected in the landing page grid

  // DOM Element References
  const appRoot = document.getElementById("app-root"); // Main application container
  const applicationLogoElement = document.getElementById("application-logo"); // App logo in the header
  const playingThemesContainer = document.getElementById(
    "playing-themes-container"
  ); // Container for playing theme icons
  const likedThemesSeparator = document.getElementById(
    "liked-themes-separator"
  ); // Separator between playing/liked themes
  const likedThemesContainer = document.getElementById(
    "liked-themes-container"
  ); // Container for liked theme icons

  // UI indicators and global controls
  const systemStatusIndicator = document.getElementById(
    "system-status-indicator"
  ); // Displays system status (online, error, etc.)
  const gmSpecificActivityIndicator = document.getElementById(
    "gm-activity-indicator"
  ); // Shows when AI is processing
  const languageToggleButton = document.getElementById(
    "language-toggle-button"
  ); // Button to switch app language
  const newGameButton = document.getElementById("new-game-button"); // Button to start a new game session
  const modelToggleButton = document.getElementById("model-toggle-button"); // Button to switch AI model

  // Main layout panels
  const mainLayout = document.getElementById("main-layout");
  const leftPanel = document.getElementById("left-panel"); // Left informational panel
  const rightPanel = document.getElementById("right-panel"); // Right informational panel
  const centerColumn = document.getElementById("center-column"); // Center column for story and input

  // Landing page specific elements
  const themeGridContainer = document.getElementById("theme-grid-container"); // Grid for theme selection
  const landingThemeDescriptionContainer = document.getElementById(
    "landing-theme-description-container"
  ); // Panel for theme lore on landing page
  const landingThemeLoreText = document.getElementById(
    "landing-theme-lore-text"
  ); // Text area for theme lore
  const landingThemeDetailsContainer = document.getElementById(
    "landing-theme-details-container"
  ); // Panel for theme details on landing page
  const landingThemeInfoContent = document.getElementById(
    "landing-theme-info-content"
  ); // Content area for theme details
  const landingThemeActions = document.getElementById("landing-theme-actions"); // Container for action buttons (choose/like theme)

  // Custom Modal Elements
  const customModalOverlay = document.getElementById("custom-modal-overlay");
  const customModalElement = document.getElementById("custom-modal");
  const customModalTitle = document.getElementById("custom-modal-title");
  const customModalMessage = document.getElementById("custom-modal-message");
  const customModalInputContainer = document.getElementById(
    "custom-modal-input-container"
  );
  const customModalInput = document.getElementById("custom-modal-input");
  const customModalActions = document.getElementById("custom-modal-actions");

  // Game view specific elements
  const storyLog = document.getElementById("story-log"); // Container for narrative messages
  const storyLogViewport = document.getElementById("story-log-viewport"); // Scrollable viewport for story log
  const suggestedActionsWrapper = document.getElementById(
    "suggested-actions-wrapper"
  ); // Container for AI-suggested actions
  const playerInputControlPanel = document.getElementById(
    "player-input-control-panel"
  ); // Panel containing input fields
  const nameInputSection = document.getElementById("name-input-section"); // Section for player identifier input
  const playerIdentifierInputEl = document.getElementById(
    "player-identifier-input"
  ); // Input field for player's name/identifier
  const startGameButton = document.getElementById("start-game-button"); // Button to initiate the game after entering identifier
  const actionInputSection = document.getElementById("action-input-section"); // Section for player action input
  const playerActionInput = document.getElementById("player-action-input"); // Textarea for player's game actions
  const sendActionButton = document.getElementById("send-action-button"); // Button to submit player's action

  // Story log auto-scroll control
  let userHasManuallyScrolledLog = false; // Flag to manage auto-scrolling behavior
  const AUTOSCROLL_THRESHOLD = 40; // Pixel threshold to re-enable auto-scroll

  /**
   * Fetches and parses a JSON file.
   * @param {string} filePath - Path to the JSON file.
   * @returns {Promise<object>} Parsed JSON object.
   */
  async function fetchJSON(filePath) {
    try {
      const response = await fetch(filePath);
      if (!response.ok) {
        throw new Error(
          `HTTP error ${response.status} for ${filePath}: ${response.statusText}`
        );
      }
      return await response.json();
    } catch (error) {
      console.error(`Error fetching JSON ${filePath}:`, error);
      throw error; // Re-throw to be handled by caller
    }
  }

  /**
   * Loads the configuration for a single theme.
   * @param {string} themeId - The ID of the theme.
   * @param {string} themePath - Base path to the theme's directory.
   */
  async function loadThemeConfig(themeId, themePath) {
    const configFilePath = `${themePath}config.json`;
    try {
      const configData = await fetchJSON(configFilePath);
      ALL_THEMES_CONFIG[themeId] = configData;
    } catch (error) {
      console.error(
        `Failed to load config for theme ${themeId} from ${configFilePath}`
      );
      // Error handled by caller (ensureThemeDataLoaded)
    }
  }

  /**
   * Loads the UI text data for a single theme.
   * @param {string} themeId - The ID of the theme.
   * @param {string} themePath - Base path to the theme's directory.
   */
  async function loadThemeTexts(themeId, themePath) {
    const textsFilePath = `${themePath}texts.json`;
    try {
      const texts = await fetchJSON(textsFilePath);
      themeTextData[themeId] = texts;
    } catch (error) {
      console.error(
        `Failed to load texts for theme ${themeId} from ${textsFilePath}`
      );
    }
  }

  /**
   * Loads the prompt configurations (URLs and narrative parts) for a single theme.
   * @param {string} themeId - The ID of the theme.
   * @param {string} themePath - Base path to the theme's directory.
   */
  async function loadThemePromptsConfig(themeId, themePath) {
    const promptsConfigFilePath = `${themePath}prompts-config.json`;
    try {
      const promptsConfig = await fetchJSON(promptsConfigFilePath);
      PROMPT_URLS_BY_THEME[themeId] = promptsConfig.PROMPT_URLS || {};
      NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[themeId] =
        promptsConfig.NARRATIVE_LANG_PROMPT_PARTS || {};
    } catch (error) {
      console.error(
        `Failed to load prompts config for theme ${themeId} from ${promptsConfigFilePath}`
      );
    }
  }

  /**
   * Ensures all necessary data for a theme (config, texts, prompts config) is loaded.
   * @param {string} themeId - The ID of the theme.
   * @returns {Promise<boolean>} True if all data loaded successfully, false otherwise.
   */
  async function ensureThemeDataLoaded(themeId) {
    const themeManifestEntry = THEMES_MANIFEST.find((t) => t.id === themeId);
    if (!themeManifestEntry) {
      console.error(`Theme ${themeId} not found in THEMES_MANIFEST.`);
      return false;
    }
    const themePath = themeManifestEntry.path;
    let success = true;

    try {
      if (!ALL_THEMES_CONFIG[themeId]) {
        await loadThemeConfig(themeId, themePath);
        if (!ALL_THEMES_CONFIG[themeId]) success = false;
      }
      if (success && !themeTextData[themeId]) {
        // Only load if config loaded
        await loadThemeTexts(themeId, themePath);
        if (!themeTextData[themeId]) success = false;
      }
      if (
        success &&
        (!PROMPT_URLS_BY_THEME[themeId] ||
          !NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[themeId])
      ) {
        await loadThemePromptsConfig(themeId, themePath);
        if (!PROMPT_URLS_BY_THEME[themeId]) success = false;
      }
    } catch (error) {
      // Catch errors from fetchJSON re-throws
      console.error(`Error ensuring data for theme ${themeId}:`, error);
      success = false;
    }
    return success;
  }

  function getUIText(key, replacements = {}, explicitThemeContext = null) {
    let text;
    const onLandingPage = document.body.classList.contains(
      "landing-page-active"
    );
    const lang = currentAppLanguage;

    // 1. Try landing page specific texts from globalTextData.landing
    if (onLandingPage && globalTextData.landing?.[lang]?.[key]) {
      text = globalTextData.landing[lang][key];
    } else if (
      onLandingPage &&
      globalTextData.landing?.en?.[key] &&
      !globalTextData.landing?.[lang]?.[key]
    ) {
      text = globalTextData.landing.en[key]; // Fallback to English for landing
    }

    // 2. If not found on landing, or not on landing, try explicit theme context from themeTextData
    if (!text && explicitThemeContext && themeTextData[explicitThemeContext]) {
      text =
        themeTextData[explicitThemeContext]?.[lang]?.[key] ||
        themeTextData[explicitThemeContext]?.en?.[key]; // Fallback to English for explicit theme
    }

    // 3. If not found yet, try current game theme context from themeTextData
    if (!text && currentTheme && themeTextData[currentTheme]) {
      text =
        themeTextData[currentTheme]?.[lang]?.[key] ||
        themeTextData[currentTheme]?.en?.[key]; // Fallback to English for current theme
    }

    // 4. If still not found, try the globalTextData.global section
    if (!text && globalTextData.global) {
      text =
        globalTextData.global[lang]?.[key] || globalTextData.global.en?.[key]; // Fallback to English for global
    }

    // 5. Fallback to default theme's UI text (from themeTextData) if it was a game-specific context and text still not found
    if (
      !text &&
      !onLandingPage &&
      !explicitThemeContext &&
      currentTheme !== DEFAULT_THEME_ID &&
      themeTextData[DEFAULT_THEME_ID]
    ) {
      const themeForUI = DEFAULT_THEME_ID;
      text =
        themeTextData[themeForUI]?.[lang]?.[key] ||
        themeTextData[themeForUI]?.en?.[key];
    }

    text = text || key; // Use key as ultimate fallback if no translation found

    // Apply replacements
    for (const placeholder in replacements) {
      text = text.replace(
        new RegExp(`{${placeholder}}`, "g"),
        replacements[placeholder]
      );
    }
    return text;
  }

  /**
   * Sets up the Gemini API key, prompting the user if not found in localStorage.
   * @returns {boolean} True if API key is successfully set, false otherwise.
   */
  async function setupApiKey() {
    // Make function async
    GEMINI_API_KEY = localStorage.getItem("userGeminiApiKey");
    if (!GEMINI_API_KEY) {
      const apiKeyInput = await showCustomModal({
        // await the promise
        type: "prompt",
        titleKey: "prompt_enter_api_key_title",
        messageKey: "prompt_enter_api_key",
        confirmTextKey: "modal_confirm_button",
        cancelTextKey: "modal_cancel_button",
        inputPlaceholderKey: "placeholder_api_key_input",
      });

      if (apiKeyInput && apiKeyInput.trim() !== "") {
        GEMINI_API_KEY = apiKeyInput.trim();
        localStorage.setItem("userGeminiApiKey", GEMINI_API_KEY);
      } else if (apiKeyInput !== null) {
        GEMINI_API_KEY = "";
        await showCustomModal({
          type: "alert",
          titleKey: "alert_title_error",
          messageKey: "alert_api_key_required",
        });
      } else {
        GEMINI_API_KEY = "";
      }
    }

    if (!GEMINI_API_KEY) {
      const errorMsg = getUIText("error_critical_no_api_key");
      const statusErrorMsg = getUIText("status_error");

      addMessageToLog(errorMsg, "system");
      console.error(errorMsg);
      if (systemStatusIndicator) {
        systemStatusIndicator.textContent = statusErrorMsg;
        systemStatusIndicator.className = "status-indicator status-danger";
      }
      [
        startGameButton,
        playerIdentifierInputEl,
        playerActionInput,
        sendActionButton,
      ].forEach((el) => {
        if (el) el.disabled = true;
      });
      if (themeGridContainer) themeGridContainer.style.pointerEvents = "none";
      return false;
    }
    if (themeGridContainer) themeGridContainer.style.pointerEvents = "auto";
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
      lastSuggestedActions: currentSuggestedActions,
      panelStates: currentPanelStates,
    };
    try {
      localStorage.setItem(gameStateKey, JSON.stringify(gameState));
    } catch (e) {
      console.error("Error saving game state:", e);
      addMessageToLog(getUIText("error_saving_progress"), "system-error");
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
    if (
      !savedState.playerIdentifier ||
      !savedState.gameHistory ||
      savedState.gameHistory.length === 0
    ) {
      clearGameStateInternal(themeIdToLoad); // Clear potentially corrupt state
      return false;
    }

    playerIdentifier = savedState.playerIdentifier;
    gameHistory = savedState.gameHistory;
    lastKnownDashboardUpdates = savedState.lastDashboardUpdates || {};
    lastKnownGameStateIndicators = savedState.lastGameStateIndicators || {};
    currentPromptType = savedState.currentPromptType || "default";
    currentNarrativeLanguage =
      savedState.currentNarrativeLanguage || currentAppLanguage;
    currentSuggestedActions = savedState.lastSuggestedActions || []; // Load suggested actions
    currentPanelStates = savedState.panelStates || {}; // Load panel states

    if (storyLog) storyLog.innerHTML = "";
    gameHistory.forEach((turn) => {
      if (turn.role === "user") {
        addMessageToLog(turn.parts[0].text, "player");
      } else if (turn.role === "model") {
        try {
          const modelResponse = JSON.parse(turn.parts[0].text);
          addMessageToLog(modelResponse.narrative, "gm");
          // Suggested actions from history are not re-applied here, only the last set.
        } catch (e) {
          console.error(
            "Error parsing model response from history:",
            e,
            turn.parts[0].text
          );
          addMessageToLog(getUIText("error_reconstruct_story"), "system");
        }
      }
    });

    updateDashboard(lastKnownDashboardUpdates, false);
    handleGameStateIndicators(lastKnownGameStateIndicators, false); // Pass false as it's not initial boot of THIS session turn

    // The display of suggested actions will be handled by the calling function
    // (initializeApp or changeThemeAndStart) after the UI is fully visible.

    const themeConfig = ALL_THEMES_CONFIG[themeIdToLoad];
    if (themeConfig && themeConfig.dashboard_config) {
      const dashboardConfig = themeConfig.dashboard_config;
      const playerIdentifierConfigKey = (dashboardConfig.left_panel || [])
        .flatMap((p) => p.items)
        .find(
          (item) => item.id === "name" || item.id === "character_name"
        )?.id;

      if (playerIdentifierConfigKey) {
        const playerIdentifierConfig = findItemConfigById(
          dashboardConfig,
          playerIdentifierConfigKey
        );
        if (playerIdentifierConfig) {
          const el = document.getElementById(
            `info-${playerIdentifierConfig.id}`
          );
          if (el) el.textContent = playerIdentifier;
        }
      }
    }

    isInitialGameLoad = false;
    return true;
  } catch (e) {
    console.error(`Error loading game state for ${themeIdToLoad}:`, e);
    clearGameStateInternal(themeIdToLoad); // Clear potentially corrupt state in memory
    localStorage.removeItem(gameStateKey); // Remove corrupt state from storage
    return false;
  }
}

  /**
   * Clears in-memory game state variables, typically for the current theme.
   * @param {string} themeIdToClear - The ID of the theme whose state is being cleared in memory.
   */
  function clearGameStateInternal(themeIdToClear) {
    if (themeIdToClear === currentTheme) {
      // Only clear if it's the active theme
      gameHistory = [];
      playerIdentifier = "";
      currentPromptType = "initial";
      isInitialGameLoad = true;
      lastKnownDashboardUpdates = {};
      lastKnownGameStateIndicators = {};
      currentSuggestedActions = [];
      currentPanelStates = {};
      if (storyLog) storyLog.innerHTML = "";
      clearSuggestedActions(); // This clears the DOM
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
  async function fetchPrompt(promptName, themeId, isCritical = false) {
    // Added isCritical parameter
    if (
      !PROMPT_URLS_BY_THEME[themeId] ||
      !PROMPT_URLS_BY_THEME[themeId][promptName]
    ) {
      const errorMsg = `Error: Prompt URL for "${promptName}" in theme "${themeId}" not found in configuration.`;
      console.error(errorMsg);
      return isCritical
        ? `CRITICAL_ERROR: ${errorMsg}`
        : `NON_CRITICAL_ERROR: ${errorMsg}`;
    }
    const promptUrl = PROMPT_URLS_BY_THEME[themeId][promptName];
    try {
      const response = await fetch(promptUrl);
      if (!response.ok) {
        if (response.status === 404 && !isCritical) {
          console.warn(
            `Optional prompt file not found (404): ${themeId}/${promptName} at ${promptUrl}. Will fallback if needed.`
          );
          return `FILE_NOT_FOUND_NON_CRITICAL: ${themeId}/${promptName}`;
        }
        throw new Error(
          `HTTP error ${response.status} for ${themeId}/${promptName}: ${response.statusText}`
        );
      }
      return await response.text();
    } catch (error) {
      console.error(
        `Error fetching prompt ${themeId}/${promptName} from ${promptUrl}:`,
        error
      );
      const errorPrefix = isCritical
        ? "CRITICAL_ERROR:"
        : "NON_CRITICAL_ERROR:";
      return `${errorPrefix} Prompt "${themeId}/${promptName}" load failed. ${error.message}`;
    }
  }

  /**
   * Loads all prompt files for a specified theme and stores them in `gamePrompts`.
   * @param {string} themeId - The ID of the theme for which to load prompts.
   * @returns {Promise<boolean>} True if all prompts loaded successfully, false otherwise.
   */
  async function loadAllPromptsForTheme(themeId) {
    const themeConfig = ALL_THEMES_CONFIG[themeId]; // This is now loaded dynamically
    if (!themeConfig || !PROMPT_URLS_BY_THEME[themeId]) {
      // PROMPT_URLS_BY_THEME also loaded dynamically
      addMessageToLog(
        getUIText("error_no_prompts_for_theme", { THEME: themeId }),
        "system"
      );
      return false;
    }

    if (!gamePrompts[themeId]) gamePrompts[themeId] = {};

    const promptNames = Object.keys(PROMPT_URLS_BY_THEME[themeId]);
    const loadingPromises = promptNames.map((name) => {
      const isCritical = name === "master_initial" || name === "master_default";
      return fetchPrompt(name, themeId, isCritical).then((text) => {
        if (!text.startsWith("CRITICAL_ERROR:")) {
          gamePrompts[themeId][name] = text;
        } else {
          gamePrompts[themeId][name] = text;
        }
      });
    });

    try {
      await Promise.all(loadingPromises);
      for (const name of promptNames) {
        const isCriticalPrompt =
          name === "master_initial" || name === "master_default";
        if (
          isCriticalPrompt &&
          gamePrompts[themeId][name]?.startsWith("CRITICAL_ERROR:")
        ) {
          throw new Error(
            `Critical prompt load failure: ${gamePrompts[themeId][name]}. Theme "${themeId}" cannot be loaded.`
          );
        }
      }
      console.log(`Successfully processed prompts for theme: ${themeId}`);
      return true;
    } catch (error) {
      console.error(`Error during prompt loading for ${themeId}:`, error);
      if (systemStatusIndicator) {
        systemStatusIndicator.textContent = getUIText("status_error");
        systemStatusIndicator.className = "status-indicator status-danger";
      }
      [startGameButton, playerIdentifierInputEl].forEach((el) => {
        if (el) el.disabled = true;
      });
      addMessageToLog(
        getUIText("error_load_prompts_critical", { THEME: themeId }),
        "system-error"
      );
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
    const themeConfig = ALL_THEMES_CONFIG[currentTheme];
    if (!currentTheme || !themeConfig || !themeConfig.dashboard_config) {
      return `{"narrative": "SYSTEM ERROR: Active theme or its configuration (including dashboard) is missing for prompt generation.", "dashboard_updates": {}, "suggested_actions": [], "game_state_indicators": {}}`;
    }
    const dashboardLayoutConfig = themeConfig.dashboard_config;

    const isValidPromptText = (text) =>
      text &&
      !text.startsWith("FILE_NOT_FOUND_NON_CRITICAL:") &&
      !text.startsWith("NON_CRITICAL_ERROR:") &&
      !text.startsWith("CRITICAL_ERROR:") &&
      !text.startsWith("Error:");

    let basePromptKey = promptTypeToUse;
    let basePromptText = gamePrompts[currentTheme]?.[basePromptKey];

    if (!isValidPromptText(basePromptText)) {
      if (promptTypeToUse !== "initial" && promptTypeToUse !== "default") {
        basePromptKey = "default";
        basePromptText = gamePrompts[currentTheme]?.[basePromptKey];
      }
    }

    if (!isValidPromptText(basePromptText)) {
      if (promptTypeToUse === "initial" || basePromptKey === "initial") {
        basePromptKey = "master_initial";
      } else {
        basePromptKey = "master_default";
      }
      basePromptText = gamePrompts[currentTheme]?.[basePromptKey];
    }

    if (!isValidPromptText(basePromptText)) {
      console.warn(
        `Prompt "${promptTypeToUse}" (and potential fallbacks like "${basePromptKey}") not found or invalid for theme "${currentTheme}". Attempting default theme fallback.`
      );
      const ultimateFallbackKey =
        promptTypeToUse === "initial" ||
        basePromptKey === "master_initial" ||
        basePromptKey === "initial"
          ? "master_initial"
          : "master_default";

      // Ensure default theme prompts are loaded if not already
      if (
        !gamePrompts[DEFAULT_THEME_ID] ||
        !gamePrompts[DEFAULT_THEME_ID][ultimateFallbackKey]
      ) {
        // This case should ideally be handled by pre-loading default theme prompts
        // in initializeApp or ensureThemeDataLoaded. For safety, log an error.
        console.error(
          `CRITICAL FALLBACK FAILURE: Default theme (${DEFAULT_THEME_ID}) prompts not available for ${ultimateFallbackKey}.`
        );
        return `{"narrative": "SYSTEM ERROR: Core prompt files for default theme are critically missing. Cannot generate AI instructions.", "dashboard_updates": {}, "suggested_actions": ["Restart Game", "Contact Support"], "game_state_indicators": {"activity_status": "Error", "combat_engaged": false, "comms_channel_active": false}}`;
      }
      basePromptText = gamePrompts[DEFAULT_THEME_ID]?.[ultimateFallbackKey];

      if (isValidPromptText(basePromptText)) {
        console.warn(
          `Used default theme's "${ultimateFallbackKey}" prompt for current theme "${currentTheme}".`
        );
        basePromptKey = ultimateFallbackKey;
      } else {
        console.error(
          `CRITICAL PROMPT FAILURE: Neither "${promptTypeToUse}" nor any fallback (including default theme's "${ultimateFallbackKey}") could be loaded for theme "${currentTheme}". Prompt content: ${basePromptText}`
        );
        return `{"narrative": "SYSTEM ERROR: Core prompt files are critically missing or invalid. Cannot generate AI instructions.", "dashboard_updates": {}, "suggested_actions": ["Restart Game", "Contact Support"], "game_state_indicators": {"activity_status": "Error", "combat_engaged": false, "comms_channel_active": false}}`;
      }
    }

    if (!isValidPromptText(basePromptText)) {
      console.error(
        `Failed to load a critical prompt template: ${basePromptKey} for theme ${currentTheme}. Content was: ${basePromptText}`
      );
      return `{"narrative": "SYSTEM ERROR: Prompt template ${basePromptKey} missing or failed to load for ${currentTheme}.", "dashboard_updates": {}, "suggested_actions": ["Check panel.", "Change theme."], "game_state_indicators": {"activity_status": "Error", "combat_engaged": false, "comms_channel_active": false}}`;
    }

    let generatedDashboardDescription = "";
    const dashboardItems = [
      ...(dashboardLayoutConfig.left_panel || []).flatMap((p) => p.items),
      ...(dashboardLayoutConfig.right_panel || []).flatMap((p) => p.items),
    ];
    dashboardItems.forEach((item) => {
      let description = `// "${item.id}": "string (${
        item.short_description || "No description available."
      }`;
      if (item.must_translate) {
        description += ` This value MUST be in ${currentNarrativeLanguage.toUpperCase()}.`;
      } else {
        description += ` This value does NOT require translation from English.`;
      }
      if (item.type === "meter" && item.status_text_id) {
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
      generatedDashboardDescription = generatedDashboardDescription.slice(
        0,
        -2
      );
    }

    let generatedGameStateIndicators = "";
    if (
      dashboardLayoutConfig.game_state_indicators &&
      Array.isArray(dashboardLayoutConfig.game_state_indicators)
    ) {
      dashboardLayoutConfig.game_state_indicators.forEach((indicator) => {
        let description = `"${indicator.id}": "boolean (${
          indicator.short_description || "No description."
        }`;
        if (indicator.default_value_key) {
          description += ` Default UI text key for conceptual status: '${indicator.default_value_key}'.`;
        } else if (indicator.default_value !== undefined) {
          description += ` Default value: ${indicator.default_value}.`;
        }
        description += `)",\n`;
        generatedGameStateIndicators += description;
      });
      if (!generatedGameStateIndicators.includes('"activity_status"')) {
        // Ensure activity_status is always described for AI
        const activityStatusDesc =
          themeConfig.id === "grim_warden" &&
          dashboardItems.find((item) => item.id === "activity_status")
            ? dashboardItems.find((item) => item.id === "activity_status")
                .short_description
            : "MUST match dashboard_updates.directive_status if provided. If not, it reflects the ongoing primary activity described in the narrative, IN THE NARRATIVE LANGUAGE. E.g., if narrative describes fighting, this should be the NARRATIVE LANGUAGE equivalent of 'Fighting'.";
        generatedGameStateIndicators += `"activity_status": "string (${activityStatusDesc})",\n`;
      }
      if (generatedGameStateIndicators.endsWith(",\n")) {
        generatedGameStateIndicators = generatedGameStateIndicators.slice(
          0,
          -2
        );
      }
    } else {
      // Fallback if dashboard_config.game_state_indicators is missing
      const activityStatusDesc =
        themeConfig.id === "grim_warden" &&
        dashboardItems.find((item) => item.id === "activity_status")
          ? dashboardItems.find((item) => item.id === "activity_status")
              .short_description
          : "MUST match dashboard_updates.directive_status if provided. If not, it reflects the ongoing primary activity described in the narrative, IN THE NARRATIVE LANGUAGE.";
      generatedGameStateIndicators = `"activity_status": "string (${activityStatusDesc})",\n`;
      generatedGameStateIndicators += `"combat_engaged": "boolean (Set to true IF combat begins THIS turn. Otherwise, maintain previous state unless explicitly changing based on narrative events like escape or victory.)",\n`;
      generatedGameStateIndicators += `"comms_channel_active": "boolean (Set to true if a direct communication channel is now active as a result of this turn's events, false if it closed, or maintain previous state if unchanged.)"`;
    }

    const instructionKeyNamePart = basePromptKey;
    let themeSpecificInstructions = "";
    if (instructionKeyNamePart) {
      const themeInstructionTextKey = `theme_instructions_${instructionKeyNamePart}_${currentTheme}`;
      const fetchedInstruction = getUIText(
        themeInstructionTextKey,
        {},
        currentTheme
      );

      if (
        fetchedInstruction !== themeInstructionTextKey &&
        fetchedInstruction.trim() !== ""
      ) {
        themeSpecificInstructions = fetchedInstruction;
      } else {
        themeSpecificInstructions =
          "No specific instructions provided for this context.";
      }

      const helperPlaceholderRegex = /{{HELPER_RANDOM_LINE:([a-zA-Z0-9_]+)}}/g;
      let match;
      while (
        (match = helperPlaceholderRegex.exec(themeSpecificInstructions)) !==
        null
      ) {
        const fullPlaceholder = match[0];
        const helperKey = match[1];

        let helperFileContent = null;
        const langSpecificHelperKey = `${helperKey}_${currentNarrativeLanguage}`;
        const fallbackHelperKey = `${helperKey}_en`;

        if (
          gamePrompts[currentTheme] &&
          isValidPromptText(gamePrompts[currentTheme][langSpecificHelperKey])
        ) {
          helperFileContent = gamePrompts[currentTheme][langSpecificHelperKey];
        } else if (
          gamePrompts[currentTheme] &&
          isValidPromptText(gamePrompts[currentTheme][fallbackHelperKey])
        ) {
          helperFileContent = gamePrompts[currentTheme][fallbackHelperKey];
        } else if (
          gamePrompts[DEFAULT_THEME_ID] &&
          isValidPromptText(
            gamePrompts[DEFAULT_THEME_ID][langSpecificHelperKey]
          )
        ) {
          // Fallback to default theme's helper
          helperFileContent =
            gamePrompts[DEFAULT_THEME_ID][langSpecificHelperKey];
        } else if (
          gamePrompts[DEFAULT_THEME_ID] &&
          isValidPromptText(gamePrompts[DEFAULT_THEME_ID][fallbackHelperKey])
        ) {
          // Fallback to default theme's English helper
          helperFileContent = gamePrompts[DEFAULT_THEME_ID][fallbackHelperKey];
        }

        let replacementText = `(dynamic value for ${helperKey} not found)`;
        if (helperFileContent) {
          const lines = helperFileContent
            .split("\n")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          if (lines.length > 0) {
            replacementText = lines[Math.floor(Math.random() * lines.length)];
          } else {
            replacementText = `(no valid lines in ${helperKey} helper file)`;
          }
        }
        themeSpecificInstructions = themeSpecificInstructions.replace(
          fullPlaceholder,
          replacementText
        );
        helperPlaceholderRegex.lastIndex = 0;
      }
    }

    const narrativeLangInstruction =
      NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[currentTheme]?.[
        currentNarrativeLanguage
      ] ||
      NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[DEFAULT_THEME_ID]?.[
        currentNarrativeLanguage
      ] ||
      NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[DEFAULT_THEME_ID]?.[
        DEFAULT_LANGUAGE
      ] || // Assuming DEFAULT_LANGUAGE is cs or en
      `The narrative must be in ${currentNarrativeLanguage.toUpperCase()}.`;

    let processedPromptText = basePromptText;

    processedPromptText = processedPromptText.replace(
      /\$\{narrativeLanguageInstruction\}/g,
      narrativeLangInstruction
    );
    processedPromptText = processedPromptText.replace(
      /\$\{currentNameForPrompt\}/g,
      currentPlayerIdentifierParam || getUIText("unknown")
    );
    processedPromptText = processedPromptText.replace(
      /\$\{currentPlayerIdentifier\}/g,
      currentPlayerIdentifierParam || getUIText("unknown")
    );
    processedPromptText = processedPromptText.replace(
      /\$\{currentNarrativeLanguage\.toUpperCase\(\)\}/g,
      currentNarrativeLanguage.toUpperCase()
    );

    processedPromptText = processedPromptText.replace(
      /\$\{theme_name\}/g,
      getUIText(themeConfig.name_key, {}, currentTheme)
    );
    processedPromptText = processedPromptText.replace(
      /\$\{theme_lore\}/g,
      getUIText(themeConfig.lore_key, {}, currentTheme)
    );
    processedPromptText = processedPromptText.replace(
      /\$\{theme_category\}/g,
      getUIText(
        themeConfig.category_key || `theme_category_${currentTheme}`,
        {},
        currentTheme
      )
    );
    processedPromptText = processedPromptText.replace(
      /\$\{theme_style\}/g,
      getUIText(
        themeConfig.style_key || `theme_style_${currentTheme}`,
        {},
        currentTheme
      )
    );
    processedPromptText = processedPromptText.replace(
      /\$\{theme_tone\}/g,
      getUIText(themeConfig.tone_key, {}, currentTheme)
    );
    processedPromptText = processedPromptText.replace(
      /\$\{theme_inspiration\}/g,
      getUIText(themeConfig.inspiration_key, {}, currentTheme)
    );
    processedPromptText = processedPromptText.replace(
      /\$\{theme_concept\}/g,
      getUIText(themeConfig.concept_key, {}, currentTheme)
    );

    processedPromptText = processedPromptText.replace(
      /\$\{theme_specific_instructions\}/g,
      themeSpecificInstructions
    );

    processedPromptText = processedPromptText.replace(
      /\$\{generated_dashboard_description\}/g,
      generatedDashboardDescription
    );
    processedPromptText = processedPromptText.replace(
      /\$\{generated_game_state_indicators\}/g,
      generatedGameStateIndicators
    );

    if (promptTypeToUse === "initial" || basePromptKey === "master_initial") {
      if (
        gamePrompts[currentTheme]?.starts &&
        isValidPromptText(gamePrompts[currentTheme].starts)
      ) {
        const allStarts = gamePrompts[currentTheme].starts
          .split("\n")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        const selectedStarts =
          allStarts.length > 0
            ? [...allStarts].sort(() => 0.5 - Math.random()).slice(0, 3)
            : [];
        ["startIdea1", "startIdea2", "startIdea3"].forEach((placeholder, i) => {
          processedPromptText = processedPromptText.replace(
            new RegExp(`\\$\\{${placeholder}\\}`, "g"),
            selectedStarts[i] ||
              `Generic ${getUIText(
                themeConfig.name_key,
                {},
                currentTheme
              )} scenario ${i + 1}`
          );
        });
      }

      let assetNamesContent = null;
      const assetKey = `asset_names_${currentNarrativeLanguage}`;
      const entityKey = `entity_names_${currentNarrativeLanguage}`;
      const fallbackAssetKey = "asset_names_en";
      const fallbackEntityKey = "entity_names_en";

      if (
        themeConfig.naming_convention === "entity" &&
        gamePrompts[currentTheme]?.[entityKey] &&
        isValidPromptText(gamePrompts[currentTheme][entityKey])
      ) {
        assetNamesContent = gamePrompts[currentTheme][entityKey];
      } else if (
        themeConfig.naming_convention === "asset" &&
        gamePrompts[currentTheme]?.[assetKey] &&
        isValidPromptText(gamePrompts[currentTheme][assetKey])
      ) {
        assetNamesContent = gamePrompts[currentTheme][assetKey];
      } else {
        // Fallback checks
        if (
          gamePrompts[currentTheme]?.[assetKey] &&
          isValidPromptText(gamePrompts[currentTheme][assetKey])
        )
          assetNamesContent = gamePrompts[currentTheme][assetKey];
        else if (
          gamePrompts[currentTheme]?.[entityKey] &&
          isValidPromptText(gamePrompts[currentTheme][entityKey])
        )
          assetNamesContent = gamePrompts[currentTheme][entityKey];
        else if (
          gamePrompts[currentTheme]?.[fallbackAssetKey] &&
          isValidPromptText(gamePrompts[currentTheme][fallbackAssetKey])
        )
          assetNamesContent = gamePrompts[currentTheme][fallbackAssetKey];
        else if (
          gamePrompts[currentTheme]?.[fallbackEntityKey] &&
          isValidPromptText(gamePrompts[currentTheme][fallbackEntityKey])
        )
          assetNamesContent = gamePrompts[currentTheme][fallbackEntityKey];
      }

      if (assetNamesContent) {
        const allAssets = assetNamesContent
          .split("\n")
          .map((n) => n.trim())
          .filter((n) => n.length > 0);
        const selectedAssets =
          allAssets.length > 0
            ? [...allAssets].sort(() => 0.5 - Math.random()).slice(0, 3)
            : [];
        [
          "suggestedName1",
          "suggestedName2",
          "suggestedName3",
          "suggestedItemName1",
          "suggestedItemName2",
          "suggestedItemName3",
          "suggestedLocationName1",
          "suggestedLocationName2",
          "suggestedLocationName3",
        ].forEach((ph, iMod) => {
          const i = iMod % 3;
          processedPromptText = processedPromptText.replace(
            new RegExp(`\\$\\{${ph}\\}`, "g"),
            selectedAssets[i] ||
              `Invented${ph
                .replace("suggested", "")
                .replace(/Name\d/, "Name")}${i + 1}`
          );
        });
        if (
          themeConfig.naming_convention === "asset" ||
          currentTheme === "scifi"
        ) {
          // Keep scifi ship name logic
          [
            "suggestedShipName1",
            "suggestedShipName2",
            "suggestedShipName3",
          ].forEach((ph, iMod) => {
            const i = iMod % 3;
            processedPromptText = processedPromptText.replace(
              new RegExp(`\\$\\{${ph}\\}`, "g"),
              selectedAssets[i] || `DefaultAssetName${i + 1}`
            );
          });
        }
      } else {
        [
          "suggestedName1",
          "suggestedName2",
          "suggestedName3",
          "suggestedShipName1",
          "suggestedShipName2",
          "suggestedShipName3",
          "suggestedItemName1",
          "suggestedItemName2",
          "suggestedItemName3",
          "suggestedLocationName1",
          "suggestedLocationName2",
          "suggestedLocationName3",
        ].forEach((ph, i) => {
          processedPromptText = processedPromptText.replace(
            new RegExp(`\\$\\{${ph}\\}`, "g"),
            `InventedPlaceholder${i + 1}`
          );
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
    if (gmSpecificActivityIndicator)
      gmSpecificActivityIndicator.style.display = isProcessing
        ? "inline-flex"
        : "none";
    if (systemStatusIndicator)
      systemStatusIndicator.style.display = isProcessing
        ? "none"
        : "inline-flex"; // Hide system status during GM activity

    if (playerActionInput) playerActionInput.disabled = isProcessing;
    if (sendActionButton) sendActionButton.disabled = isProcessing;
    document
      .querySelectorAll("#suggested-actions-wrapper .ui-button")
      .forEach((btn) => (btn.disabled = isProcessing));

    if (
      !isProcessing &&
      actionInputSection?.style.display !== "none" &&
      playerActionInput &&
      document.body.contains(playerActionInput)
    ) {
      playerActionInput.focus();
    }
  }

  /**
   * Briefly highlights a UI element to indicate an update.
   * If the element is a container (.info-item or .info-item-meter),
   * it attempts to highlight its main value display child (.value or .value-overlay).
   * If the element is already a value display child, it highlights itself.
   * @param {HTMLElement} element - The DOM element to highlight or the container of the value to highlight.
   */
  function highlightElementUpdate(element) {
    if (!element) return;
    let textValueElement = null;
    if (
      element.classList.contains("value") ||
      element.classList.contains("value-overlay")
    ) {
      textValueElement = element;
    } else if (
      element.classList.contains("info-item") ||
      element.classList.contains("info-item-meter")
    ) {
      textValueElement = element.querySelector(".value, .value-overlay");
    }
    if (textValueElement) {
      textValueElement.classList.add("value-updated");
      setTimeout(() => {
        if (document.body.contains(textValueElement)) {
          textValueElement.classList.remove("value-updated");
        }
      }, UPDATE_HIGHLIGHT_DURATION);
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
    if (
      sender === "player" &&
      gameHistory.length > 0 &&
      gameHistory[0].role === "user" &&
      text === gameHistory[0].parts[0].text &&
      text.startsWith(`My identifier is`)
    ) {
      return;
    }
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message", `${sender}-message`);
    const processedText = text.replace(
      /_([^_]+)_|\*([^*]+)\*/g,
      (match, p1, p2) => `<em>${p1 || p2}</em>`
    );
    const paragraphs = processedText
      .split(/\n\s*\n/)
      .filter((p) => p.trim() !== "");
    if (paragraphs.length === 0 && processedText.trim() !== "") {
      paragraphs.push(processedText.trim());
    }
    paragraphs.forEach((para) => {
      const pElement = document.createElement("p");
      pElement.innerHTML = para.replace(/\n/g, "<br>");
      msgDiv.appendChild(pElement);
    });
    const viewport = storyLog.parentElement;
    let shouldScroll = false;
    if (viewport && storyLogViewport.style.display !== "none") {
      if (!userHasManuallyScrolledLog) {
        shouldScroll = true;
      } else {
        if (
          viewport.scrollHeight - viewport.clientHeight <=
          viewport.scrollTop + AUTOSCROLL_THRESHOLD
        ) {
          shouldScroll = true;
          userHasManuallyScrolledLog = false;
        }
      }
    }
    storyLog.appendChild(msgDiv);
    if (shouldScroll && viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }

  /**
   * Displays AI-suggested actions as clickable buttons.
   * @param {string[]} actions - An array of action strings.
   */
  function displaySuggestedActions(actions) {
    if (
      !suggestedActionsWrapper ||
      suggestedActionsWrapper.style.display === "none"
    ) {
      currentSuggestedActions =
        actions && Array.isArray(actions) ? actions.slice(0, 3) : []; // Still store even if not visible
      return;
    }

    suggestedActionsWrapper.innerHTML = ""; // Clear previous suggestions
    currentSuggestedActions = []; // Reset before populating

    if (actions && Array.isArray(actions) && actions.length > 0) {
      actions.slice(0, 3).forEach((actionTxt) => {
        // Display up to 3 suggestions
        if (typeof actionTxt === "string" && actionTxt.trim() !== "") {
          const btn = document.createElement("button");
          btn.classList.add("ui-button");
          btn.textContent = actionTxt;
          btn.addEventListener("click", () => {
            if (playerActionInput) {
              playerActionInput.value = actionTxt; // Populate input field
              playerActionInput.focus();
              playerActionInput.dispatchEvent(
                new Event("input", { bubbles: true })
              ); // Trigger auto-grow
              autoGrowTextarea(playerActionInput);
            }
          });
          suggestedActionsWrapper.appendChild(btn);
          currentSuggestedActions.push(actionTxt); // Store the displayed action
        }
      });
    }
  }

  /**
   * Clears any displayed suggested actions.
   */
  function clearSuggestedActions() {
    if (suggestedActionsWrapper) suggestedActionsWrapper.innerHTML = "";
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

    if (!barEl) {
      if (textEl && newPctStr !== undefined && newPctStr !== null) {
        const na = getUIText("not_available_short"),
          unk = getUIText("unknown");
        const newContent =
          newPctStr === "---" ||
          newPctStr === na ||
          String(newPctStr).toLowerCase() === unk.toLowerCase()
            ? newPctStr
            : `${parseInt(newPctStr, 10)}%`;
        if (textEl.textContent !== newContent) {
          textEl.textContent = newContent;
          updatedOccurred = true;
        }
      }
      return updatedOccurred;
    }

    let finalPct = -1;
    if (newPctStr !== undefined && newPctStr !== null) {
      let parsedPct = parseInt(newPctStr, 10);
      if (!isNaN(parsedPct)) {
        finalPct = Math.max(0, Math.min(100, parsedPct));
      } else {
        const na = getUIText("not_available_short"),
          unk = getUIText("unknown");
        if (
          textEl &&
          (newPctStr === "---" ||
            newPctStr === na ||
            String(newPctStr).toLowerCase() === unk.toLowerCase())
        ) {
          if (textEl.textContent !== newPctStr) {
            textEl.textContent = newPctStr;
            updatedOccurred = true;
          }
          if (barEl.style.width !== "0%") {
            barEl.style.width = "0%";
            updatedOccurred = true;
          }
          const oldClasses = Array.from(barEl.classList).filter((c) =>
            c.startsWith("meter-")
          );
          if (oldClasses.length > 0) updatedOccurred = true;
          oldClasses.forEach((c) => barEl.classList.remove(c));
          return updatedOccurred;
        }
        finalPct =
          meterType === "shields" ||
          meterType === "enemy_shields" ||
          meterType === "mana"
            ? 0
            : 100;
      }
    } else {
      if (textEl) {
        const match = textEl.textContent.match(/(\d+)%/);
        if (match) finalPct = parseInt(match[1], 10);
      }
      if (finalPct === -1) {
        const placeholderMatch = initialPlaceholder
          ? initialPlaceholder.match(/(\d+)%/)
          : null;
        finalPct = placeholderMatch
          ? parseInt(placeholderMatch[1], 10)
          : meterType === "shields" ||
            meterType === "enemy_shields" ||
            meterType === "mana"
          ? 0
          : 100;
      }
    }
    finalPct = Math.max(0, Math.min(100, finalPct));

    let finalStatusTxt = null;
    if (meterType === "shields" || meterType === "enemy_shields") {
      if (newStatusText !== undefined && newStatusText !== null) {
        finalStatusTxt = newStatusText;
      } else {
        let currentDomStatus = null;
        if (textEl) {
          const match = textEl.textContent.match(/^(.*?):\s*(\d+)%/);
          if (match && match[1]) currentDomStatus = match[1].trim();
        }
        finalStatusTxt =
          currentDomStatus ||
          (finalPct > 0 ? getUIText("online") : getUIText("offline"));
      }
      if (finalPct === 0) finalStatusTxt = getUIText("offline");
      else if (
        finalStatusTxt &&
        finalStatusTxt.toLowerCase() === getUIText("offline").toLowerCase()
      )
        finalStatusTxt = getUIText("online");
    } else if (
      (meterType === "mana" || meterType === "stamina") &&
      newStatusText !== undefined &&
      newStatusText !== null
    ) {
      finalStatusTxt = newStatusText;
    }

    let newDisplayText = "";
    if (meterType === "shields" || meterType === "enemy_shields") {
      newDisplayText = `${
        finalStatusTxt || getUIText("unknown")
      }: ${finalPct}%`;
    } else if (
      (meterType === "mana" || meterType === "stamina") &&
      finalStatusTxt &&
      finalStatusTxt.toLowerCase() !== getUIText("unknown").toLowerCase()
    ) {
      newDisplayText = `${finalStatusTxt}: ${finalPct}%`;
    } else {
      newDisplayText = `${finalPct}%`;
    }

    let newBarClasses = [];
    const isOffline =
      (meterType === "shields" || meterType === "enemy_shields") &&
      finalStatusTxt &&
      finalStatusTxt.toLowerCase() === getUIText("offline").toLowerCase();
    if (isOffline) {
      newBarClasses.push("meter-offline");
    } else {
      if (finalPct === 0 && !isOffline) newBarClasses.push("meter-critical");
      else if (finalPct > 0 && finalPct <= 10)
        newBarClasses.push("meter-critical");
      else if (finalPct > 10 && finalPct <= 25) newBarClasses.push("meter-low");
      else if (finalPct > 25 && finalPct <= 50)
        newBarClasses.push("meter-medium");
      else {
        newBarClasses.push("meter-full");
        if (meterType === "shields" || meterType === "enemy_shields")
          newBarClasses.push("meter-ok-shield");
        else if (meterType === "fuel") newBarClasses.push("meter-ok-fuel");
        else if (meterType === "stamina")
          newBarClasses.push("meter-ok-stamina");
        else if (meterType === "mana") newBarClasses.push("meter-ok-mana");
      }
    }

    if (textEl && textEl.textContent !== newDisplayText) {
      textEl.textContent = newDisplayText;
      updatedOccurred = true;
    }
    if (barEl.style.width !== `${finalPct}%`) {
      barEl.style.width = `${finalPct}%`;
      updatedOccurred = true;
    }

    const existingClasses = Array.from(barEl.classList).filter((cls) =>
      cls.startsWith("meter-")
    );
    let classesDiffer =
      newBarClasses.length !== existingClasses.length ||
      !newBarClasses.every((cls) => existingClasses.includes(cls));
    if (classesDiffer) {
      existingClasses.forEach((cls) => {
        if (cls !== "meter-bar") barEl.classList.remove(cls);
      });
      if (!barEl.classList.contains("meter-bar"))
        barEl.classList.add("meter-bar");
      newBarClasses.forEach((cls) => {
        if (cls && cls.trim() !== "" && cls !== "meter-bar")
          barEl.classList.add(cls);
      });
      updatedOccurred = true;
    } else if (!barEl.classList.contains("meter-bar")) {
      barEl.classList.add("meter-bar");
    }

    if (highlight && updatedOccurred) {
      const containerToHighlight = textEl
        ? textEl.closest(".info-item, .info-item-meter")
        : barEl.closest(".info-item, .info-item-meter");
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
    for (const panelSideKey of ["left_panel", "right_panel"]) {
      if (dashboardConfig[panelSideKey]) {
        for (const panelConfig of dashboardConfig[panelSideKey]) {
          if (
            panelConfig.items &&
            panelConfig.items.some((item) => item.id === itemId)
          ) {
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
    if (
      !updatesFromAI ||
      Object.keys(updatesFromAI).length === 0 ||
      !currentTheme
    )
      return;

    const currentThemeFullConfig = ALL_THEMES_CONFIG[currentTheme];
    if (!currentThemeFullConfig || !currentThemeFullConfig.dashboard_config) {
      console.error(
        "Dashboard configuration missing for current theme:",
        currentTheme
      );
      return;
    }
    const themeCfg = currentThemeFullConfig.dashboard_config;

    const allItems = [
      ...(themeCfg.left_panel || []).flatMap((b) => b.items),
      ...(themeCfg.right_panel || []).flatMap((b) => b.items),
    ];
    const itemConfigsMap = new Map(allItems.map((i) => [i.id, i]));

    for (const key in updatesFromAI) {
      if (Object.prototype.hasOwnProperty.call(updatesFromAI, key)) {
        const value = updatesFromAI[key];
        let itemCfg = itemConfigsMap.get(key);
        let actualUpdateOccurred = false;

        if (key === "name" || key === "character_name") {
          const playerIdentifierItemId = (themeCfg.left_panel || [])
            .flatMap((p) => p.items)
            .find((i) => i.id === "name" || i.id === "character_name")?.id;
          if (key === playerIdentifierItemId) {
            itemCfg = itemConfigsMap.get(playerIdentifierItemId);
            playerIdentifier = String(value);
          } else if (!itemCfg) {
            itemCfg = itemConfigsMap.get(playerIdentifierItemId);
            if (itemCfg) playerIdentifier = String(value);
          }
        }

        if (!itemCfg) continue;

        const valueElement = document.getElementById(`info-${itemCfg.id}`);
        const meterBarElement = document.getElementById(`meter-${itemCfg.id}`);

        if (itemCfg.type === "meter") {
          if (valueElement || meterBarElement) {
            actualUpdateOccurred = setMeter(
              meterBarElement,
              valueElement,
              String(value),
              itemCfg.meter_type,
              {
                highlight: highlightChanges,
                newStatusText: itemCfg.status_text_id
                  ? updatesFromAI[itemCfg.status_text_id]
                  : undefined,
              }
            );
          }
        } else if (itemCfg.type === "status_text") {
          if (valueElement) {
            const newStatusText = String(value);
            let statusClass = "status-info";
            const lowerValue = newStatusText.toLowerCase();

            if (itemCfg.id === "alertLevel" || itemCfg.id === "alert_level") {
              if (
                lowerValue.includes(
                  getUIText(
                    "alert_level_danger_val",
                    {},
                    currentTheme
                  ).toLowerCase()
                )
              )
                statusClass = "status-danger";
              else if (
                lowerValue.includes(
                  getUIText(
                    "alert_level_wary_val",
                    {},
                    currentTheme
                  ).toLowerCase()
                ) ||
                lowerValue.includes(
                  getUIText(
                    "alert_level_yellow_val",
                    {},
                    currentTheme
                  ).toLowerCase()
                )
              )
                statusClass = "status-warning";
              else if (
                lowerValue.includes(
                  getUIText(
                    "alert_level_calm_val",
                    {},
                    currentTheme
                  ).toLowerCase()
                ) ||
                lowerValue.includes(
                  getUIText(
                    "alert_level_green_val",
                    {},
                    currentTheme
                  ).toLowerCase()
                )
              )
                statusClass = "status-ok";
            } else if (itemCfg.id === "threat_level") {
              // For grim_warden
              if (
                lowerValue.includes(
                  getUIText(
                    "threat_level_danger_val",
                    {},
                    currentTheme
                  ).toLowerCase()
                )
              )
                statusClass = "status-danger";
              else if (
                lowerValue.includes(
                  getUIText(
                    "threat_level_wary_val",
                    {},
                    currentTheme
                  ).toLowerCase()
                )
              )
                statusClass = "status-warning";
              else if (
                lowerValue.includes(
                  getUIText(
                    "threat_level_calm_val",
                    {},
                    currentTheme
                  ).toLowerCase()
                )
              )
                statusClass = "status-ok";
            }
            if (
              valueElement.textContent !== newStatusText ||
              !valueElement.className.includes(statusClass)
            ) {
              valueElement.textContent = newStatusText;
              valueElement.className = `value ${statusClass}`;
              if (highlightChanges) highlightElementUpdate(valueElement);
              actualUpdateOccurred = true;
            }
          }
        } else {
          if (valueElement) {
            const suffix = itemCfg.suffix || "";
            const newValueText = `${value}${suffix}`;
            if (valueElement.textContent !== newValueText) {
              valueElement.textContent = newValueText;
              if (highlightChanges) highlightElementUpdate(valueElement);
              actualUpdateOccurred = true;
            }
          }
        }

        if (actualUpdateOccurred) {
          const parentPanelConfig = getParentPanelConfig(itemCfg.id, themeCfg);
          if (parentPanelConfig && parentPanelConfig.type === "collapsible") {
            const panelElement = document.getElementById(parentPanelConfig.id);
            if (
              panelElement &&
              !panelElement.classList.contains("is-expanded")
            ) {
              animatePanelBox(parentPanelConfig.id, true, false);
            }
          }
        }
      }
    }
    lastKnownDashboardUpdates = {
      ...lastKnownDashboardUpdates,
      ...updatesFromAI,
    };
  }

  /**
   * Initializes dashboard elements with their default texts and values based on theme config.
   */
  function initializeDashboardDefaultTexts() {
    if (!currentTheme) return;
    const currentThemeFullConfig = ALL_THEMES_CONFIG[currentTheme];
    if (!currentThemeFullConfig || !currentThemeFullConfig.dashboard_config) {
      console.error(
        "Dashboard configuration missing for current theme for default texts:",
        currentTheme
      );
      return;
    }
    const themeCfg = currentThemeFullConfig.dashboard_config;

    ["left_panel", "right_panel"].forEach((sideKey) => {
      if (!themeCfg[sideKey]) return;
      themeCfg[sideKey].forEach((boxCfg) => {
        boxCfg.items.forEach((itemCfg) => {
          const valueEl = document.getElementById(`info-${itemCfg.id}`);
          const meterBarEl = document.getElementById(`meter-${itemCfg.id}`);
          const defaultValue =
            itemCfg.default_value !== undefined
              ? String(itemCfg.default_value)
              : getUIText(itemCfg.default_value_key, {}, currentTheme);

          if (itemCfg.type === "meter") {
            if (valueEl || meterBarEl) {
              const defaultStatus = itemCfg.default_status_key
                ? getUIText(itemCfg.default_status_key, {}, currentTheme)
                : getUIText("offline");
              setMeter(meterBarEl, valueEl, defaultValue, itemCfg.meter_type, {
                highlight: false,
                newStatusText: defaultStatus,
                initialPlaceholder: `${defaultStatus}: ${defaultValue}%`,
              });
            }
          } else if (itemCfg.type === "status_text") {
            if (valueEl) {
              const displayDefault = getUIText(
                itemCfg.default_value_key,
                {},
                currentTheme
              );
              const statusValueDefault = itemCfg.default_status_key
                ? getUIText(itemCfg.default_status_key, {}, currentTheme)
                : displayDefault;
              valueEl.textContent = displayDefault;
              let statusClass = "status-info";
              const lowerValue = statusValueDefault.toLowerCase();
              if (itemCfg.id === "alertLevel" || itemCfg.id === "alert_level") {
                if (
                  lowerValue.includes(
                    getUIText(
                      "alert_level_danger_val",
                      {},
                      currentTheme
                    ).toLowerCase()
                  )
                )
                  statusClass = "status-danger";
                else if (
                  lowerValue.includes(
                    getUIText(
                      "alert_level_wary_val",
                      {},
                      currentTheme
                    ).toLowerCase()
                  ) ||
                  lowerValue.includes(
                    getUIText(
                      "alert_level_yellow_val",
                      {},
                      currentTheme
                    ).toLowerCase()
                  )
                )
                  statusClass = "status-warning";
                else if (
                  lowerValue.includes(
                    getUIText(
                      "alert_level_calm_val",
                      {},
                      currentTheme
                    ).toLowerCase()
                  ) ||
                  lowerValue.includes(
                    getUIText(
                      "alert_level_green_val",
                      {},
                      currentTheme
                    ).toLowerCase()
                  )
                )
                  statusClass = "status-ok";
              } else if (itemCfg.id === "threat_level") {
                // For grim_warden
                if (
                  lowerValue.includes(
                    getUIText(
                      "threat_level_danger_val",
                      {},
                      currentTheme
                    ).toLowerCase()
                  )
                )
                  statusClass = "status-danger";
                else if (
                  lowerValue.includes(
                    getUIText(
                      "threat_level_wary_val",
                      {},
                      currentTheme
                    ).toLowerCase()
                  )
                )
                  statusClass = "status-warning";
                else if (
                  lowerValue.includes(
                    getUIText(
                      "threat_level_calm_val",
                      {},
                      currentTheme
                    ).toLowerCase()
                  )
                )
                  statusClass = "status-ok";
              }
              valueEl.className = `value ${statusClass}`;
            }
          } else {
            if (valueEl) {
              const suffix = itemCfg.suffix || "";
              valueEl.textContent = `${defaultValue}${suffix}`;
            }
          }
        });
      });
    });

    const playerIdentifierItemId = (themeCfg.left_panel || [])
      .flatMap((p) => p.items)
      .find((item) => item.id === "name" || item.id === "character_name")?.id;

    if (playerIdentifierItemId) {
      const idCfg = findItemConfigById(themeCfg, playerIdentifierItemId);
      if (idCfg) {
        const el = document.getElementById(`info-${idCfg.id}`);
        if (el)
          el.textContent =
            playerIdentifier ||
            getUIText(idCfg.default_value_key, {}, currentTheme);
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
    for (const sideKey of ["left_panel", "right_panel"]) {
      if (!themeDashCfg[sideKey]) continue;
      for (const boxCfg of themeDashCfg[sideKey]) {
        const foundItem = boxCfg.items.find((i) => i.id === itemId);
        if (foundItem) return foundItem;
      }
    }
    return null;
  }

  /**
   * Finds a specific panel's configuration within the theme's dashboard structure.
   * @param {object} dashboardConfig - The dashboard configuration for the current theme.
   * @param {string} panelId - The ID of the panel box to find.
   * @returns {object|null} The panel configuration object or null if not found.
   */
  function findPanelConfigById(dashboardConfig, panelId) {
    if (!dashboardConfig) return null;
    for (const sideKey of ["left_panel", "right_panel"]) {
      if (dashboardConfig[sideKey]) {
        const foundPanel = dashboardConfig[sideKey].find(
          (p) => p.id === panelId
        );
        if (foundPanel) return foundPanel;
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
    textarea.style.height = "auto";
    let newHeight = textarea.scrollHeight;
    const maxHeight =
      parseInt(window.getComputedStyle(textarea).maxHeight, 10) || Infinity;
    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      textarea.style.overflowY = "auto";
    } else {
      textarea.style.overflowY = "hidden";
    }
    textarea.style.height = newHeight + "px";
  }

  /**
   * Animates the expansion or collapse of a panel box.
   * @param {string} boxId - The ID of the panel box element.
   * @param {boolean} shouldExpand - True to expand, false to collapse.
   * @param {boolean} manageVisibility - True if the panel's display property should be managed (for initially hidden panels).
   */
  function animatePanelBox(
    boxId,
    shouldExpand,
    manageVisibility = false,
    isRestoringState = false
  ) {
    const box = document.getElementById(boxId);
    if (!box) return;
    const header = box.querySelector(".panel-box-header");
    const content = box.querySelector(".panel-box-content");
    if (!header || !content) return;

    // const isCurrentlyExpanded = box.classList.contains('is-expanded'); // Not strictly needed here

    if (shouldExpand) {
      // If managing visibility and box is hidden, make it visible before animation
      if (box.style.display === "none" && manageVisibility) {
        box.style.opacity = "0"; // Start transparent for fade-in
        box.style.display = "flex";
      } else if (box.style.display === "none") {
        // Just make it visible if not managing opacity
        box.style.display = "flex";
      }

      // Use requestAnimationFrame to ensure style changes are applied before transition starts
      requestAnimationFrame(() => {
        box.classList.add("is-expanded");
        if (manageVisibility) box.style.opacity = "1"; // Fade in
        header.setAttribute("aria-expanded", "true");
        content.setAttribute("aria-hidden", "false");
      });
    } else {
      // Collapse
      box.classList.remove("is-expanded");
      header.setAttribute("aria-expanded", "false");
      content.setAttribute("aria-hidden", "true");

      if (manageVisibility) {
        box.style.opacity = "0"; // Start fade-out
        // Get transition duration from CSS to hide element after transition
        const transitionDuration =
          parseFloat(
            getComputedStyle(content).transitionDuration.replace("s", "")
          ) * 1000 || 300;

        const onHideTransitionEnd = (event) => {
          // Ensure we're reacting to the correct element's transition
          if (event.target === content || event.target === box) {
            if (!box.classList.contains("is-expanded")) {
              // Double-check it's still meant to be hidden
              box.style.display = "none";
              content.style.display = ""; // Reset content display (might be set by CSS)
            }
            content.removeEventListener("transitionend", onHideTransitionEnd);
            box.removeEventListener("transitionend", onHideTransitionEnd);
          }
        };
        content.addEventListener("transitionend", onHideTransitionEnd);
        box.addEventListener("transitionend", onHideTransitionEnd); // Listen on box too as opacity might transition on it

        // Fallback timeout in case transitionend doesn't fire
        setTimeout(() => {
          if (
            !box.classList.contains("is-expanded") &&
            box.style.opacity === "0"
          ) {
            box.style.display = "none";
            content.style.display = "";
          }
        }, transitionDuration + 100); // Add a small buffer
      } else {
        // If not managing visibility, panel just collapses but remains in layout
      }
    }
    // Update panel state if not restoring from saved state
    if (!isRestoringState) {
      currentPanelStates[boxId] = shouldExpand;
      // No need to call saveGameState() here, it will be called at appropriate times (e.g., after AI turn)
    }
  }

/**
 * Initializes collapsible panel boxes for a given theme, setting up click/keyboard listeners.
 * Panel states are restored from `currentPanelStates` if available, otherwise defaults are used.
 * @param {string} themeIdForPanels - The ID of the theme whose panels are being initialized.
 */
function initializeCollapsiblePanelBoxes(themeIdForPanels) {
  const themeFullConfig = ALL_THEMES_CONFIG[themeIdForPanels];
  if (!themeFullConfig || !themeFullConfig.dashboard_config) {
    console.error(
      "Dashboard configuration missing for theme for panel boxes:",
      themeIdForPanels
    );
    return;
  }
  const themeCfg = themeFullConfig.dashboard_config;

  const allPanelConfigs = [
    ...(themeCfg.left_panel || []),
    ...(themeCfg.right_panel || []),
  ];

  // Check if panel states might have been loaded (i.e., currentPanelStates has entries)
  const hasLoadedPanelStates = Object.keys(currentPanelStates).length > 0;

  allPanelConfigs.forEach((boxCfg) => {
    const boxElement = document.getElementById(boxCfg.id);
    if (!boxElement) return;

    // Ensure header element exists and re-attach listeners to a fresh clone
    // to prevent multiple bindings if this function were ever called >1 time on same elements.
    let headerElement = boxElement.querySelector(".panel-box-header");
    if (!headerElement) return;

    const newHeaderElement = headerElement.cloneNode(true);
    headerElement.parentNode.replaceChild(newHeaderElement, headerElement);
    headerElement = newHeaderElement; // Work with the clone

    if (
      boxCfg.type === "collapsible" ||
      boxCfg.type === "hidden_until_active"
    ) {
      headerElement.addEventListener("click", () => {
        if (
          boxElement.style.display !== "none" || // Allow click if visible
          boxCfg.type === "collapsible" // Collapsible always clickable
        ) {
          animatePanelBox(
            boxCfg.id,
            !boxElement.classList.contains("is-expanded"),
            boxCfg.type === "hidden_until_active",
            false // User interaction, not restoring from saved state definition
          );
        }
      });
      headerElement.setAttribute("tabindex", "0");
      headerElement.addEventListener("keydown", (e) => {
        if (
          (e.key === "Enter" || e.key === " ") &&
          (boxElement.style.display !== "none" ||
            boxCfg.type === "collapsible")
        ) {
          e.preventDefault();
          animatePanelBox(
            boxCfg.id,
            !boxElement.classList.contains("is-expanded"),
            boxCfg.type === "hidden_until_active",
            false // User interaction
          );
        }
      });
    }

    let initialExpandState;
    let isRestoringThisPanelState = false;

    if (hasLoadedPanelStates && currentPanelStates[boxCfg.id] !== undefined) {
      // A saved state exists for this panel
      initialExpandState = currentPanelStates[boxCfg.id];
      isRestoringThisPanelState = true;
    } else {
      // No saved state for this panel, or no saved states at all (new game)
      // Use theme config default.
      isRestoringThisPanelState = false;
      if (boxCfg.type === "hidden_until_active") {
        initialExpandState = false; // Default for hidden_until_active is collapsed
      } else {
        initialExpandState = boxCfg.initial_expanded || false; // Default for collapsible
      }
    }

    if (boxCfg.type === "static") {
      // Static panels are always expanded and not part of savable currentPanelStates
      boxElement.style.display = "flex"; // Ensure visible
      boxElement.style.opacity = "1";
      animatePanelBox(boxCfg.id, true, false, false); // isRestoringState = false as it's not from currentPanelStates
    } else if (boxCfg.type === "hidden_until_active") {
      // initialExpandState is from currentPanelStates if restoring, otherwise false.
      // animatePanelBox handles display:none/flex and opacity via manageVisibility=true.
      animatePanelBox(boxCfg.id, initialExpandState, true, isRestoringThisPanelState);
    } else { // Collapsible
      boxElement.style.display = "flex"; // Ensure visible if not managed by animatePanelBox's manageVisibility
      boxElement.style.opacity = "1";
      const delay = boxCfg.boot_delay || 0;
      setTimeout(
        () => animatePanelBox(boxCfg.id, initialExpandState, false, isRestoringThisPanelState),
        delay
      );
    }
  });
}

  /**
   * Updates the text and ARIA attributes of the AI model toggle button.
   */
  function updateModelToggleButtonText() {
    if (!modelToggleButton) return;
    const isPaidModel = currentModelName === PAID_MODEL_NAME;
    const textKey = isPaidModel
      ? "button_toggle_to_free"
      : "button_toggle_to_paid";
    const ariaKey = isPaidModel
      ? "aria_label_current_model_paid"
      : "aria_label_current_model_free";
    modelToggleButton.textContent = getUIText(textKey, {
      MODEL_NAME: currentModelName,
    });
    const ariaLabel = getUIText(ariaKey, { MODEL_NAME: currentModelName });
    modelToggleButton.setAttribute("aria-label", ariaLabel);
    modelToggleButton.title = ariaLabel;
  }

  /**
   * Saves the lists of playing and liked themes to localStorage.
   */
  function saveThemeListsToStorage() {
    localStorage.setItem(
      PLAYING_THEMES_STORAGE_KEY,
      JSON.stringify(playingThemes)
    );
    localStorage.setItem(LIKED_THEMES_STORAGE_KEY, JSON.stringify(likedThemes));
  }

  /**
   * Loads the lists of playing and liked themes from localStorage.
   */
  function loadThemeListsFromStorage() {
    playingThemes = JSON.parse(
      localStorage.getItem(PLAYING_THEMES_STORAGE_KEY) || "[]"
    );
    likedThemes = JSON.parse(
      localStorage.getItem(LIKED_THEMES_STORAGE_KEY) || "[]"
    );
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
  if (!isThemePlaying(themeId)) { // Only add if not already present
    playingThemes.push(themeId);   // Add to the end to maintain order of addition
    saveThemeListsToStorage();
    updateTopbarThemeIcons(); // Update UI after any change
  }
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
      if (!currentTheme && currentLandingGridSelection === themeId) {
        const likeButton = document.getElementById("like-theme-button");
        if (likeButton) {
          likeButton.innerHTML = `<img src="images/app/icon_heart_filled.svg" alt="${getUIText(
            "aria_label_unlike_theme"
          )}" class="like-icon">`;
          likeButton.setAttribute(
            "aria-label",
            getUIText("aria_label_unlike_theme")
          );
          likeButton.title = likeButton.getAttribute("aria-label");
          likeButton.classList.add("liked");
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
      if (!currentTheme && currentLandingGridSelection === themeId) {
        const likeButton = document.getElementById("like-theme-button");
        if (likeButton) {
          likeButton.innerHTML = `<img src="images/app/icon_heart_empty.svg" alt="${getUIText(
            "aria_label_like_theme"
          )}" class="like-icon">`;
          likeButton.setAttribute(
            "aria-label",
            getUIText("aria_label_like_theme")
          );
          likeButton.title = likeButton.getAttribute("aria-label");
          likeButton.classList.remove("liked");
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
      if (!wasPlaying) {
        likedThemes.splice(likedIndex, 1);
      }
    }
    saveThemeListsToStorage();
    updateTopbarThemeIcons();
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

    const isCurrentlyPlaying = isThemePlaying(themeId);
    const button = document.createElement("button");
    button.classList.add("theme-button");
    if (isCurrentlyPlaying && themeId === currentTheme) {
      button.classList.add("active");
    }
    button.dataset.theme = themeId;
    const themeNameText = getUIText(themeConfig.name_key, {}, themeId);
    let statusText = "";
    if (isCurrentlyPlaying) {
      statusText = getUIText("theme_icon_alt_text_playing");
    } else if (type === "liked") {
      statusText = getUIText("theme_icon_alt_text_liked");
    }
    button.title = `${themeNameText}${statusText ? ` (${statusText})` : ""}`;
    const img = document.createElement("img");
    img.src = themeConfig.icon; // Path from config.json
    img.alt = button.title;
    button.appendChild(img);
    const closeBtn = document.createElement("button");
    closeBtn.classList.add("theme-button-close");
    closeBtn.innerHTML = "×";
    closeBtn.title = getUIText("close_theme_button_aria_label", {
      THEME_NAME: themeNameText,
    });
    closeBtn.setAttribute("aria-label", closeBtn.title);
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      handleCloseTopbarIcon(themeId);
    });
    button.appendChild(closeBtn);
    button.addEventListener("click", () => handleTopbarThemeIconClick(themeId));
    return button;
  }

  /**
   * Updates the theme icons displayed in the top bar based on `playingThemes` and `likedThemes`.
   */
  function updateTopbarThemeIcons() {
    if (
      !playingThemesContainer ||
      !likedThemesContainer ||
      !likedThemesSeparator
    )
      return;
    playingThemesContainer.innerHTML = "";
    likedThemesContainer.innerHTML = "";
    playingThemes.forEach((themeId) => {
      if (ALL_THEMES_CONFIG[themeId]) {
        // Ensure theme config is loaded
        const icon = createThemeTopbarIcon(themeId, "playing");
        if (icon) {
          icon.dataset.type = "playing";
          playingThemesContainer.appendChild(icon);
        }
      }
    });
    likedThemes.forEach((themeId) => {
      if (ALL_THEMES_CONFIG[themeId] && !isThemePlaying(themeId)) {
        const icon = createThemeTopbarIcon(themeId, "liked");
        if (icon) {
          icon.dataset.type = "liked";
          likedThemesContainer.appendChild(icon);
        }
      }
    });
    const showSeparator =
      (playingThemesContainer.children.length > 0 &&
        likedThemesContainer.children.length > 0) ||
      (playingThemesContainer.children.length === 0 &&
        likedThemesContainer.children.length > 0);
    likedThemesSeparator.style.display = showSeparator ? "block" : "none";
  }

  /**
   * Handles clicks on theme icons in the top bar (switches to that theme).
   * @param {string} themeId - The ID of the clicked theme.
   */
  async function handleTopbarThemeIconClick(themeId) {
    // Make async for changeThemeAndStart
    const themeIsCurrentlyActiveInView = currentTheme === themeId;
    if (isThemePlaying(themeId)) {
      if (!themeIsCurrentlyActiveInView) {
        await changeThemeAndStart(themeId, false);
      }
    } else if (isThemeLiked(themeId)) {
      await changeThemeAndStart(themeId, false);
    }
  }

  /**
   * Toggles the AI model between free and paid (or other configured types).
   */
  function toggleModelType() {
    currentModelName =
      currentModelName === PAID_MODEL_NAME ? FREE_MODEL_NAME : PAID_MODEL_NAME;
    localStorage.setItem(MODEL_PREFERENCE_STORAGE_KEY, currentModelName);
    updateModelToggleButtonText();
    const msgKey =
      currentModelName === PAID_MODEL_NAME
        ? "system_model_set_paid"
        : "system_model_set_free";
    addMessageToLog(
      getUIText(msgKey, { MODEL_NAME: currentModelName }),
      "system"
    );
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

    const onLandingPage = document.body.classList.contains(
      "landing-page-active"
    );
    document.body.className = "";
    if (onLandingPage) {
      document.body.classList.add("landing-page-active");
      document.body.classList.add(`theme-landing`);
    } else if (currentTheme && ALL_THEMES_CONFIG[currentTheme]) {
      document.body.classList.add(`theme-${currentTheme}`);
    } else if (ALL_THEMES_CONFIG[DEFAULT_THEME_ID]) {
      document.body.classList.add(`theme-${DEFAULT_THEME_ID}`);
    }

    if (languageToggleButton) {
      const otherLangKeyForButtonText =
        currentAppLanguage === "en"
          ? globalTextData.landing?.cs?.toggle_language || "Česky"
          : globalTextData.landing?.en?.toggle_language || "English";
      languageToggleButton.textContent = otherLangKeyForButtonText;
      const ariaToggleKey = `toggle_language_aria`;
      languageToggleButton.setAttribute("aria-label", getUIText(ariaToggleKey));
      languageToggleButton.title = getUIText(ariaToggleKey);
    }

    if (newGameButton) {
      newGameButton.textContent = getUIText("button_new_game");
      newGameButton.title = getUIText("aria_label_new_game");
      newGameButton.setAttribute(
        "aria-label",
        getUIText("aria_label_new_game")
      );
    }
    if (modelToggleButton)
      modelToggleButton.title = getUIText("aria_label_toggle_model_generic");
    if (systemStatusIndicator)
      systemStatusIndicator.textContent = getUIText(
        systemStatusIndicator.dataset.langKey || "system_status_online_short"
      );
    if (gmSpecificActivityIndicator)
      gmSpecificActivityIndicator.textContent = getUIText(
        gmSpecificActivityIndicator.dataset.langKey || "system_processing_short"
      );

    if (!onLandingPage && currentTheme && ALL_THEMES_CONFIG[currentTheme]) {
      const currentThemeFullCfg = ALL_THEMES_CONFIG[currentTheme];
      if (currentThemeFullCfg.dashboard_config) {
        const dashboardCfg = currentThemeFullCfg.dashboard_config;
        ["left_panel", "right_panel"].forEach((sideKey) => {
          if (!dashboardCfg[sideKey]) return;
          dashboardCfg[sideKey].forEach((boxCfg) => {
            const titleEl = document.querySelector(
              `#${boxCfg.id} .panel-box-title`
            );
            if (titleEl)
              titleEl.textContent = getUIText(
                boxCfg.title_key,
                {},
                currentTheme
              );
            boxCfg.items.forEach((itemCfg) => {
              const labelEl = document.querySelector(
                `#info-item-container-${itemCfg.id} .label`
              );
              if (labelEl)
                labelEl.textContent = getUIText(
                  itemCfg.label_key,
                  {},
                  currentTheme
                );
            });
          });
        });
      }
      initializeDashboardDefaultTexts();
    } else if (onLandingPage) {
      renderThemeGrid(); // Re-render grid to update theme names if language changed
      if (currentLandingGridSelection && themeGridContainer) {
        const selectedBtn = themeGridContainer.querySelector(
          `.theme-grid-icon[data-theme="${currentLandingGridSelection}"]`
        );
        if (selectedBtn) selectedBtn.classList.add("active");
      }
    }

    if (playerIdentifierInputEl)
      playerIdentifierInputEl.placeholder = getUIText("placeholder_name_login");
    if (startGameButton)
      startGameButton.textContent = getUIText("button_access_systems");
    if (playerActionInput)
      playerActionInput.placeholder = getUIText("placeholder_command");
    if (sendActionButton)
      sendActionButton.textContent = getUIText("button_execute_command");

    updateModelToggleButtonText();
    updateTopbarThemeIcons();

    if (
      onLandingPage &&
      currentLandingGridSelection &&
      ALL_THEMES_CONFIG[currentLandingGridSelection]
    ) {
      updateLandingPagePanels(currentLandingGridSelection, false);
    } else if (onLandingPage) {
      if (landingThemeLoreText)
        landingThemeLoreText.textContent = getUIText(
          "landing_select_theme_prompt_lore"
        );
      if (landingThemeInfoContent)
        landingThemeInfoContent.innerHTML = `<p>${getUIText(
          "landing_select_theme_prompt_details"
        )}</p>`;
      const descTitle =
        landingThemeDescriptionContainer?.querySelector(".panel-box-title");
      if (descTitle)
        descTitle.textContent = getUIText("landing_theme_description_title");
      const detailsTitle =
        landingThemeDetailsContainer?.querySelector(".panel-box-title");
      if (detailsTitle)
        detailsTitle.textContent = getUIText("landing_theme_info_title");
    }
  }

  /**
   * Toggles the application language and narrative language together.
   */
  function toggleAppLanguage() {
    const newLang = currentAppLanguage === "en" ? "cs" : "en";
    currentNarrativeLanguage = newLang;
    localStorage.setItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY, newLang);
    setAppLanguageAndThemeUI(newLang, currentTheme || DEFAULT_THEME_ID);
    const langChangeMsgKey =
      newLang === "en" ? "system_lang_set_en" : "system_lang_set_cs";
    if (
      currentTheme &&
      storyLogViewport &&
      storyLogViewport.style.display !== "none"
    ) {
      addMessageToLog(getUIText(langChangeMsgKey), "system");
    } else {
      console.log(getUIText(langChangeMsgKey));
    }
    if (currentTheme) saveGameState();
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
    if (!currentThemeFullCfg || !currentThemeFullCfg.dashboard_config) {
      console.error(
        "Dashboard configuration missing for theme for game state indicators:",
        currentTheme
      );
      return;
    }
    const themeDashCfg = currentThemeFullCfg.dashboard_config;

    lastKnownGameStateIndicators = {
      ...lastKnownGameStateIndicators,
      ...indicators,
    };
    const themePanels = [
      ...(themeDashCfg.left_panel || []),
      ...(themeDashCfg.right_panel || []),
    ];
    themePanels.forEach((boxCfg) => {
      if (boxCfg.type === "hidden_until_active" && boxCfg.indicator_key) {
        const boxEl = document.getElementById(boxCfg.id);
        if (!boxEl) return;
        const shouldShow = indicators[boxCfg.indicator_key] === true;
        const isShowing =
          boxEl.style.display !== "none" &&
          parseFloat(boxEl.style.opacity || "0") > 0;
        if (shouldShow && !isShowing) {
          const delay =
            isInitialBoot && boxCfg.boot_delay ? boxCfg.boot_delay : 0;
          setTimeout(() => animatePanelBox(boxCfg.id, true, true), delay);
        } else if (!shouldShow && isShowing) {
          animatePanelBox(boxCfg.id, false, true);
        }
      }
    });

    let newPromptType = "default";
    let specificPromptFoundForActiveIndicator = false;

    if (
      themeDashCfg.game_state_indicators &&
      Array.isArray(themeDashCfg.game_state_indicators)
    ) {
      for (const indicatorConfig of themeDashCfg.game_state_indicators) {
        const indicatorId = indicatorConfig.id;
        if (indicators[indicatorId] === true) {
          if (
            PROMPT_URLS_BY_THEME[currentTheme]?.[indicatorId] &&
            gamePrompts[currentTheme]?.[indicatorId] &&
            !gamePrompts[currentTheme][indicatorId].startsWith("Error:")
          ) {
            newPromptType = indicatorId;
            specificPromptFoundForActiveIndicator = true;
            break;
          }
        }
      }
    }

    if (currentPromptType !== newPromptType) {
      currentPromptType = newPromptType;
      console.log(`Switched to prompt type: ${currentPromptType}`);
    }
  }

  /**
   * Calls the Gemini API with the current game history and system prompt.
   * @param {object[]} currentTurnHistory - The history of conversation turns for this API call.
   * @returns {Promise<string|null>} The narrative text from AI, or null on failure.
   */
  async function callGeminiAPI(currentTurnHistory) {
    if (!GEMINI_API_KEY) {
      addMessageToLog(getUIText("error_critical_no_api_key"), "system");
      if (systemStatusIndicator) {
        systemStatusIndicator.textContent = getUIText("status_error");
        systemStatusIndicator.className = "status-indicator status-danger";
      }
      setGMActivity(false);
      return null;
    }

    setGMActivity(true);
    clearSuggestedActions();

    const activePromptType =
      isInitialGameLoad ||
      (currentTurnHistory.length === 1 &&
        gameHistory[0].role === "user" &&
        gameHistory[0].parts[0].text.includes("ready to start the game"))
        ? "initial"
        : currentPromptType;

    const systemPromptText = getSystemPrompt(
      playerIdentifier,
      activePromptType
    );

    console.log("----- BEGIN SYSTEM PROMPT -----");
    console.log(`Using prompt type: ${activePromptType}`);
    console.log(systemPromptText);
    console.log("----- END SYSTEM PROMPT -----");

    if (systemPromptText.startsWith('{"narrative": "SYSTEM ERROR:')) {
      try {
        const errorResponse = JSON.parse(systemPromptText);
        addMessageToLog(errorResponse.narrative, "system");
        if (errorResponse.suggested_actions)
          displaySuggestedActions(errorResponse.suggested_actions);
      } catch (e) {
        addMessageToLog(systemPromptText, "system-error");
        console.error(
          "Failed to parse system error JSON from getSystemPrompt:",
          e,
          systemPromptText
        );
      }
      setGMActivity(false);
      return null;
    }

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${currentModelName}:generateContent?key=${GEMINI_API_KEY}`;
    const generationConfig = {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
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
      systemInstruction: { parts: [{ text: systemPromptText }] },
    };

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const responseData = await response.json();

      if (!response.ok) {
        let errorDetails =
          responseData.error?.message || `API Error ${response.status}`;
        if (responseData.error?.details)
          errorDetails += ` Details: ${JSON.stringify(
            responseData.error.details
          )}`;
        throw new Error(errorDetails);
      }

      if (
        responseData.candidates &&
        responseData.candidates[0]?.content?.parts?.[0]?.text
      ) {
        let jsonStringFromAI = responseData.candidates[0].content.parts[0].text;
        try {
          const parsedAIResponse = JSON.parse(jsonStringFromAI);
          if (
            typeof parsedAIResponse.narrative !== "string" ||
            typeof parsedAIResponse.dashboard_updates !== "object" ||
            !Array.isArray(parsedAIResponse.suggested_actions) ||
            typeof parsedAIResponse.game_state_indicators !== "object"
          ) {
            throw new Error(
              "Invalid JSON structure from AI. Missing required fields."
            );
          }
          gameHistory.push({
            role: "model",
            parts: [{ text: JSON.stringify(parsedAIResponse) }],
          });
          updateDashboard(parsedAIResponse.dashboard_updates);
          displaySuggestedActions(parsedAIResponse.suggested_actions);
          handleGameStateIndicators(
            parsedAIResponse.game_state_indicators,
            isInitialGameLoad
          );
          if (isInitialGameLoad) isInitialGameLoad = false;
          saveGameState();
          if (systemStatusIndicator) {
            systemStatusIndicator.textContent = getUIText(
              "system_status_online_short"
            );
            systemStatusIndicator.className = "status-indicator status-ok";
          }
          return parsedAIResponse.narrative;
        } catch (e) {
          throw new Error(
            `Invalid JSON received from AI: ${
              e.message
            }. Raw string (first 500 chars): ${jsonStringFromAI.substring(
              0,
              500
            )}...`
          );
        }
      } else if (responseData.promptFeedback?.blockReason) {
        const blockDetails =
          responseData.promptFeedback.safetyRatings
            ?.map((r) => `${r.category}: ${r.probability}`)
            .join(", ") || "No details provided.";
        throw new Error(
          `Content blocked by API: ${responseData.promptFeedback.blockReason}. Safety Ratings: ${blockDetails}`
        );
      } else {
        throw new Error("No valid candidate or text found in AI response.");
      }
    } catch (error) {
      console.error("Gemini API call failed:", error);
      addMessageToLog(
        getUIText("error_api_call_failed", { ERROR_MSG: error.message }),
        "system"
      );
      if (systemStatusIndicator) {
        systemStatusIndicator.textContent = getUIText("status_error");
        systemStatusIndicator.className = "status-indicator status-danger";
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
    const enteredIdentifier = playerIdentifierInputEl
      ? playerIdentifierInputEl.value.trim()
      : "";
    if (!enteredIdentifier) {
      await showCustomModal({
        type: "alert",
        titleKey: "alert_title_notice",
        messageKey: "alert_identifier_required",
      });
      if (playerIdentifierInputEl) playerIdentifierInputEl.focus();
      return;
    }

    playerIdentifier = enteredIdentifier;
    isInitialGameLoad = true;
    currentPromptType = "initial";

    if (nameInputSection) nameInputSection.style.display = "none";
    if (actionInputSection) actionInputSection.style.display = "flex";
    if (storyLogViewport) {
      storyLogViewport.style.opacity = "1";
      storyLogViewport.style.transform = "translateY(0) scale(1)";
    }
    if (playerActionInput) {
      playerActionInput.value = "";
      playerActionInput.dispatchEvent(new Event("input", { bubbles: true }));
      autoGrowTextarea(playerActionInput);
      playerActionInput.focus();
    }

    const themeConfig = ALL_THEMES_CONFIG[currentTheme];
    let idKeyForDashboard = "name";
    if (themeConfig && themeConfig.dashboard_config) {
      const dashboardConfig = themeConfig.dashboard_config;
      const foundIdItem = (dashboardConfig?.left_panel || [])
        .flatMap((p) => p.items)
        .find((item) => item.id === "name" || item.id === "character_name");
      if (foundIdItem) {
        idKeyForDashboard = foundIdItem.id;
      }
    }
    updateDashboard({ [idKeyForDashboard]: playerIdentifier }, false);
    addMessageToLog(
      getUIText("connecting", { PLAYER_ID: playerIdentifier }),
      "system"
    );
    gameHistory = [
      {
        role: "user",
        parts: [
          {
            text: `My identifier is ${playerIdentifier}. I am ready to start the game in ${getUIText(
              themeConfig?.name_key || "unknown_theme",
              {},
              currentTheme
            )} theme.`,
          },
        ],
      },
    ];
    saveGameState();
    clearSuggestedActions();
    const narrative = await callGeminiAPI(gameHistory);
    if (narrative) {
      addMessageToLog(narrative, "gm");
    } else {
      if (nameInputSection) nameInputSection.style.display = "flex";
      if (actionInputSection) actionInputSection.style.display = "none";
      addMessageToLog(getUIText("error_session_init_failed"), "system");
    }
  }

  /**
   * Sends the player's typed action to the AI.
   */
  async function sendPlayerAction() {
    const actionText = playerActionInput ? playerActionInput.value.trim() : "";
    if (!actionText) {
      if (playerActionInput) playerActionInput.focus();
      return;
    }
    addMessageToLog(actionText, "player");
    if (playerActionInput) {
      playerActionInput.value = "";
      playerActionInput.dispatchEvent(new Event("input", { bubbles: true }));
      autoGrowTextarea(playerActionInput);
    }
    clearSuggestedActions();
    gameHistory.push({ role: "user", parts: [{ text: actionText }] });
    const narrative = await callGeminiAPI(gameHistory);
    if (narrative) {
      addMessageToLog(narrative, "gm");
    }
  }

  /**
   * Initiates a new game session, prompting for confirmation.
   * Uses current theme or landing page selection if no game is active.
   */
  async function startNewGameSession() {
    if (!currentTheme && !currentLandingGridSelection) {
      await showCustomModal({
        type: "alert",
        titleKey: "alert_title_notice",
        messageKey: "alert_select_theme_first",
      });
      return;
    }
    const themeToStartNewGameIn = currentTheme || currentLandingGridSelection;
    if (!themeToStartNewGameIn || !ALL_THEMES_CONFIG[themeToStartNewGameIn]) {
      await showCustomModal({
        type: "alert",
        titleKey: "alert_title_error",
        messageKey: "alert_select_theme_first", // Or a more specific "theme data missing"
      });
      return;
    }

    const themeConfig = ALL_THEMES_CONFIG[themeToStartNewGameIn];
    const themeName = getUIText(
      themeConfig.name_key,
      {},
      themeToStartNewGameIn
    );
    const confirmKey = `confirm_new_game_theme_${themeToStartNewGameIn}`;
    let messageToDisplayKey =
      themeTextData[themeToStartNewGameIn]?.[currentAppLanguage]?.[
        confirmKey
      ] || themeTextData[themeToStartNewGameIn]?.en?.[confirmKey]
        ? confirmKey
        : "confirm_new_game_generic";

    const userConfirmed = await showCustomModal({
      type: "confirm",
      titleKey: "confirm_new_game_title",
      messageKey: messageToDisplayKey,
      replacements: { THEME_NAME: themeName },
      confirmTextKey: "modal_yes_button",
      cancelTextKey: "modal_no_button",
      explicitThemeContext:
        messageToDisplayKey === confirmKey ? themeToStartNewGameIn : null,
    });

    if (userConfirmed) {
      addMessageToLog(
        getUIText("system_new_game_initiated", { THEME_NAME: themeName }),
        "system"
      );
      await changeThemeAndStart(themeToStartNewGameIn, true);
    }
  }

  /**
   * Generates the HTML for dashboard panels (left and right) based on a theme's configuration.
   * @param {string} themeId - The ID of the theme for which to generate panels.
   */
  function generatePanelsForTheme(themeId) {
    const themeFullConfig = ALL_THEMES_CONFIG[themeId];
    if (
      !themeFullConfig ||
      !themeFullConfig.dashboard_config ||
      !leftPanel ||
      !rightPanel
    ) {
      if (
        leftPanel &&
        rightPanel &&
        themeFullConfig &&
        !themeFullConfig.dashboard_config
      ) {
        console.error(`Dashboard config not found for theme: ${themeId}`);
        leftPanel.innerHTML = `<p>${getUIText(
          "error_dashboard_config_missing"
        )}</p>`;
        rightPanel.innerHTML = "";
      }
      return;
    }
    const config = themeFullConfig.dashboard_config;

    leftPanel.innerHTML = "";
    rightPanel.innerHTML = "";
    if (landingThemeDescriptionContainer)
      landingThemeDescriptionContainer.style.display = "none";
    if (landingThemeDetailsContainer)
      landingThemeDetailsContainer.style.display = "none";

    const createSidePanels = (sideContainerElement, panelConfigs) => {
      if (!panelConfigs) return;
      panelConfigs.forEach((panelConfig) => {
        const panelBox = document.createElement("div");
        panelBox.id = panelConfig.id;
        panelBox.classList.add("panel-box");
        panelBox.style.display = "flex";
        panelBox.style.flexDirection = "column";
        if (
          panelConfig.type === "collapsible" ||
          panelConfig.type === "hidden_until_active"
        ) {
          panelBox.classList.add("collapsible");
        }
        const header = document.createElement("div");
        header.classList.add("panel-box-header");
        const title = document.createElement("h3");
        title.classList.add("panel-box-title");
        title.textContent = getUIText(panelConfig.title_key, {}, themeId); // Use themeId for context
        header.appendChild(title);
        panelBox.appendChild(header);
        const content = document.createElement("div");
        content.classList.add("panel-box-content");
        panelConfig.items.forEach((item) => {
          const itemContainer = document.createElement("div");
          itemContainer.id = `info-item-container-${item.id}`;
          itemContainer.classList.add(
            item.type === "meter" ? "info-item-meter" : "info-item"
          );
          if (
            item.type === "text_long" ||
            [
              "objective",
              "current_quest",
              "location",
              "environment",
              "sensorConditions",
              "omen_details",
              "current_location_desc",
              "ambient_conditions",
              "blight_intensity",
            ].includes(item.id)
          ) {
            itemContainer.classList.add("full-width");
          }
          const label = document.createElement("span");
          label.classList.add("label");
          label.textContent = getUIText(item.label_key, {}, themeId); // Use themeId for context
          itemContainer.appendChild(label);
          if (item.type === "meter") {
            const meterContainer = document.createElement("div");
            meterContainer.classList.add("meter-bar-container");
            const meterBar = document.createElement("div");
            meterBar.id = `meter-${item.id}`;
            meterBar.classList.add("meter-bar");
            meterContainer.appendChild(meterBar);
            itemContainer.appendChild(meterContainer);
            const valueOverlay = document.createElement("span");
            valueOverlay.id = `info-${item.id}`;
            valueOverlay.classList.add("value-overlay");
            itemContainer.appendChild(valueOverlay);
          } else {
            const valueSpan = document.createElement("span");
            valueSpan.id = `info-${item.id}`;
            valueSpan.classList.add("value");
            if (item.type === "text_long")
              valueSpan.classList.add("objective-text");
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

    const dataLoaded = await ensureThemeDataLoaded(newThemeId);
    if (!dataLoaded) {
      await showCustomModal({
        type: "alert",
        titleKey: "alert_title_error",
        messageKey: "error_theme_data_load_failed",
        replacements: { THEME_ID: newThemeId },
      });
      if (oldThemeId && ALL_THEMES_CONFIG[oldThemeId]) {
        currentTheme = oldThemeId;
        localStorage.setItem(CURRENT_THEME_STORAGE_KEY, currentTheme);
      } else {
        switchToLandingView();
      }
      return;
    }
    if (
      newThemeId !== DEFAULT_THEME_ID &&
      (!ALL_THEMES_CONFIG[DEFAULT_THEME_ID] ||
        !themeTextData[DEFAULT_THEME_ID] ||
        !PROMPT_URLS_BY_THEME[DEFAULT_THEME_ID])
    ) {
      await ensureThemeDataLoaded(DEFAULT_THEME_ID); // Ensure default theme's full data is loaded for fallbacks
    }

    const themeWasAlreadyPlaying = isThemePlaying(newThemeId);

    if (oldThemeId === newThemeId && !forceNewGame) {
      if (storyLogViewport && storyLogViewport.style.display === "none") {
        switchToGameView(newThemeId); // Makes suggestedActionsWrapper visible
        displaySuggestedActions(currentSuggestedActions); // Display them now
        if (
          playerActionInput &&
          actionInputSection &&
          actionInputSection.style.display !== "none" &&
          document.body.contains(playerActionInput)
        ) {
          playerActionInput.focus();
        }
      }
      // If already current theme and in game view, and not forcing new game, do nothing further.
      // Order in playingThemes is not affected here.
      return;
    }

    currentTheme = newThemeId;
    localStorage.setItem(CURRENT_THEME_STORAGE_KEY, currentTheme);

    // Add to playingThemes list only if it's a new game action for this theme,
    // or if it wasn't in the playing list before this specific action.
    // addPlayingTheme itself now handles adding to the end only if not present.
    if (forceNewGame || !themeWasAlreadyPlaying) {
        addPlayingTheme(newThemeId);
    }
    // If !forceNewGame && themeWasAlreadyPlaying, we are just switching view to an existing session,
    // so no need to call addPlayingTheme as its order is already established.

    clearGameStateInternal(currentTheme); // Clears currentPanelStates & currentSuggestedActions in memory
    if (forceNewGame) {
      localStorage.removeItem(GAME_STATE_STORAGE_KEY_PREFIX + currentTheme);
    }

    switchToGameView(currentTheme); // Makes suggestedActionsWrapper visible
    generatePanelsForTheme(currentTheme);
    setAppLanguageAndThemeUI(currentAppLanguage, currentTheme); // This calls initializeDashboardDefaultTexts

    const promptsLoadedSuccessfully = await loadAllPromptsForTheme(
      currentTheme
    );
    if (!promptsLoadedSuccessfully) {
      addMessageToLog(
        getUIText("error_load_prompts_critical", { THEME: currentTheme }),
        "system-error"
      );
      if (startGameButton) startGameButton.disabled = true;
      switchToLandingView();
      return;
    }
    if (startGameButton) startGameButton.disabled = false;
    updateTopbarThemeIcons(); // Called after potential addPlayingTheme

    if (!forceNewGame && loadGameState(currentTheme)) { // loadGameState populates currentSuggestedActions
      isInitialGameLoad = false;

      initializeCollapsiblePanelBoxes(currentTheme);
      displaySuggestedActions(currentSuggestedActions); // Display them now that wrapper is visible

      if (nameInputSection) nameInputSection.style.display = "none";
      if (actionInputSection) actionInputSection.style.display = "flex";
      if (playerActionInput && document.body.contains(playerActionInput))
        playerActionInput.focus();

      const themeDisplayName = ALL_THEMES_CONFIG[currentTheme]
        ? getUIText(ALL_THEMES_CONFIG[currentTheme].name_key, {}, currentTheme)
        : currentTheme;
      addMessageToLog(
        getUIText("system_session_resumed", {
          PLAYER_ID: playerIdentifier,
          THEME_NAME: themeDisplayName,
        }),
        "system"
      );
      if (systemStatusIndicator) {
        systemStatusIndicator.textContent = getUIText(
          "system_status_online_short"
        );
        systemStatusIndicator.className = "status-indicator status-ok";
      }
    } else {
      isInitialGameLoad = true;
      currentPromptType = "initial";
      currentPanelStates = {};
      currentSuggestedActions = []; // Ensure it's empty for new game or failed load

      initializeCollapsiblePanelBoxes(currentTheme);
      displaySuggestedActions(currentSuggestedActions); // Clears the display

      if (storyLog) storyLog.innerHTML = "";
      if (nameInputSection) nameInputSection.style.display = "flex";
      if (actionInputSection) actionInputSection.style.display = "none";
      if (playerIdentifierInputEl) {
        playerIdentifierInputEl.value = "";
        playerIdentifierInputEl.placeholder = getUIText(
          "placeholder_name_login"
        );
        if (document.body.contains(playerIdentifierInputEl))
          playerIdentifierInputEl.focus();
      }
      if (systemStatusIndicator) {
        systemStatusIndicator.textContent = getUIText("standby");
        systemStatusIndicator.className = "status-indicator status-warning";
      }
      const newThemeDisplayName = ALL_THEMES_CONFIG[newThemeId]
        ? getUIText(ALL_THEMES_CONFIG[newThemeId].name_key, {}, newThemeId)
        : newThemeId;
      if (oldThemeId !== newThemeId) {
        addMessageToLog(
          getUIText("system_theme_set_generic", {
            THEME_NAME: newThemeDisplayName,
          }),
          "system"
        );
      }
      if (forceNewGame) {
        addMessageToLog(
          getUIText("system_new_game_initiated", {
            THEME_NAME: newThemeDisplayName,
          }),
          "system"
        );
      }
    }
    if (startGameButton)
      startGameButton.textContent = getUIText("button_access_systems");
  }

  /**
   * Initializes click and keyboard listeners for a specific panel's header, typically for landing page panels.
   * @param {HTMLElement} panelContainerElement - The container element holding the panel box.
   */
  function initializeSpecificPanelHeader(panelContainerElement) {
    if (!panelContainerElement) {
      console.error(`Panel container element not found for click listener.`);
      return;
    }
    const box = panelContainerElement.querySelector(".panel-box");
    const header = box ? box.querySelector(".panel-box-header") : null;
    if (box && header) {
      if (!box.id) {
        box.id = `${panelContainerElement.id}-box`;
      }
      const newHeader = header.cloneNode(true);
      header.parentNode.replaceChild(newHeader, header);
      newHeader.addEventListener("click", () => {
        animatePanelBox(box.id, !box.classList.contains("is-expanded"), false);
      });
      newHeader.setAttribute("tabindex", "0");
      newHeader.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          animatePanelBox(
            box.id,
            !box.classList.contains("is-expanded"),
            false
          );
        }
      });
    }
  }

  /**
   * Switches the UI to the landing page view (theme selection).
   */
  function switchToLandingView() {
    currentTheme = null;
    localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
    playerIdentifier = "";
    gameHistory = [];
    document.body.classList.add("landing-page-active");
    document.body.classList.remove(
      ...Array.from(document.body.classList).filter(
        (cn) => cn.startsWith("theme-") && cn !== "theme-landing"
      )
    );
    if (!document.body.classList.contains("theme-landing"))
      document.body.classList.add("theme-landing");
    if (storyLogViewport) storyLogViewport.style.display = "none";
    if (suggestedActionsWrapper) suggestedActionsWrapper.style.display = "none";
    if (playerInputControlPanel) playerInputControlPanel.style.display = "none";
    if (nameInputSection) nameInputSection.style.display = "none";
    if (actionInputSection) actionInputSection.style.display = "none";
    if (leftPanel) {
      Array.from(leftPanel.children)
        .filter((el) => el.id !== "landing-theme-description-container")
        .forEach((el) => el.remove());
    }
    if (rightPanel) {
      Array.from(rightPanel.children)
        .filter((el) => el.id !== "landing-theme-details-container")
        .forEach((el) => el.remove());
    }
    if (themeGridContainer) themeGridContainer.style.display = "grid";
    if (landingThemeDescriptionContainer) {
      landingThemeDescriptionContainer.style.display = "flex";
      if (leftPanel && !leftPanel.contains(landingThemeDescriptionContainer)) {
        leftPanel.appendChild(landingThemeDescriptionContainer);
      }
    }
    if (landingThemeDetailsContainer) {
      landingThemeDetailsContainer.style.display = "flex";
      if (rightPanel && !rightPanel.contains(landingThemeDetailsContainer)) {
        rightPanel.appendChild(landingThemeDetailsContainer);
      }
    }
    if (landingThemeLoreText)
      landingThemeLoreText.textContent = getUIText(
        "landing_select_theme_prompt_lore"
      );
    if (landingThemeInfoContent)
      landingThemeInfoContent.innerHTML = `<p>${getUIText(
        "landing_select_theme_prompt_details"
      )}</p>`;
    if (landingThemeActions) {
      landingThemeActions.style.display = "none";
      landingThemeActions.innerHTML = "";
    }
    const descTitle =
      landingThemeDescriptionContainer?.querySelector(".panel-box-title");
    if (descTitle)
      descTitle.textContent = getUIText("landing_theme_description_title");
    const detailsTitle =
      landingThemeDetailsContainer?.querySelector(".panel-box-title");
    if (detailsTitle)
      detailsTitle.textContent = getUIText("landing_theme_info_title");
    const lorePanelBox =
      landingThemeDescriptionContainer?.querySelector(".panel-box");
    if (lorePanelBox) {
      if (!lorePanelBox.id) lorePanelBox.id = "landing-lore-panel-box";
      animatePanelBox(lorePanelBox.id, true, false);
      initializeSpecificPanelHeader(landingThemeDescriptionContainer);
    }
    const detailsPanelBox =
      landingThemeDetailsContainer?.querySelector(".panel-box");
    if (detailsPanelBox) {
      if (!detailsPanelBox.id) detailsPanelBox.id = "landing-details-panel-box";
      animatePanelBox(detailsPanelBox.id, true, false);
      initializeSpecificPanelHeader(landingThemeDetailsContainer);
    }
    currentLandingGridSelection = localStorage.getItem(
      LANDING_SELECTED_GRID_THEME_KEY
    );
    renderThemeGrid(); // Requires ALL_THEMES_CONFIG to be populated
    if (
      currentLandingGridSelection &&
      ALL_THEMES_CONFIG[currentLandingGridSelection]
    ) {
      updateLandingPagePanels(currentLandingGridSelection, false);
      const selectedBtn = themeGridContainer?.querySelector(
        `.theme-grid-icon[data-theme="${currentLandingGridSelection}"]`
      );
      if (selectedBtn) selectedBtn.classList.add("active");
    }
    if (systemStatusIndicator) {
      systemStatusIndicator.textContent = getUIText("standby");
      systemStatusIndicator.className = "status-indicator status-warning";
    }
    updateTopbarThemeIcons();
    setAppLanguageAndThemeUI(currentAppLanguage, DEFAULT_THEME_ID);
  }

  /**
   * Switches the UI to the main game view for a specific theme.
   * @param {string} themeId - The ID of the theme to display the game view for.
   */
  function switchToGameView(themeId) {
    document.body.classList.remove("landing-page-active", "theme-landing");
    document.body.classList.remove(
      ...Array.from(document.body.classList).filter(
        (cn) => cn.startsWith("theme-") && cn !== `theme-${themeId}`
      )
    );
    if (!document.body.classList.contains(`theme-${themeId}`))
      document.body.classList.add(`theme-${themeId}`);
    if (themeGridContainer) themeGridContainer.style.display = "none";
    if (landingThemeDescriptionContainer)
      landingThemeDescriptionContainer.style.display = "none";
    if (landingThemeDetailsContainer)
      landingThemeDetailsContainer.style.display = "none";
    if (storyLogViewport) storyLogViewport.style.display = "block";
    if (suggestedActionsWrapper) suggestedActionsWrapper.style.display = "flex";
    if (playerInputControlPanel)
      playerInputControlPanel.style.display = "block";
    if (storyLogViewport) {
      storyLogViewport.classList.remove("spawn-animation");
      requestAnimationFrame(() => {
        storyLogViewport.style.opacity = "0";
        storyLogViewport.style.transform = "translateY(20px) scale(0.98)";
        storyLogViewport.classList.add("spawn-animation");
      });
    }
  }

  /**
   * Renders the theme selection grid on the landing page.
   */
  function renderThemeGrid() {
    if (!themeGridContainer) return;
    themeGridContainer.innerHTML = "";
    // Iterate over THEMES_MANIFEST to find available themes
    THEMES_MANIFEST.forEach((themeMeta) => {
      const themeConfig = ALL_THEMES_CONFIG[themeMeta.id];
      if (!themeConfig || !themeTextData[themeMeta.id]) {
        // Ensure config and texts are loaded
        console.warn(
          `Theme config or text data for ${themeMeta.id} not loaded. Skipping grid item.`
        );
        return;
      }

      const button = document.createElement("button");
      button.classList.add("theme-grid-icon");
      button.dataset.theme = themeConfig.id;

      // Get the full theme name for title and img alt fallback
      const themeFullName = getUIText(
        themeConfig.name_key,
        {},
        themeConfig.id
      );
      button.title = themeFullName; // Tooltip shows the full name

      const img = document.createElement("img");
      img.src = themeConfig.icon; // Path from config.json
      const altTextKey = `theme_icon_alt_text_default_${themeConfig.id}`;
      img.alt = getUIText(altTextKey, {}, themeConfig.id) || themeFullName; // Fallback to full name

      const nameSpan = document.createElement("span");
      nameSpan.classList.add("theme-grid-icon-name");
      // Get the short theme name for display on the grid icon itself
      const themeShortName = getUIText(
        themeConfig.name_short_key || themeConfig.name_key, // Use short_key, fallback to name_key
        {},
        themeConfig.id
      );
      nameSpan.textContent = themeShortName; // Visible text is short name

      button.appendChild(img);
      button.appendChild(nameSpan);
      button.addEventListener("click", () =>
        handleThemeGridIconClick(themeConfig.id)
      );
      themeGridContainer.appendChild(button);
    });
  }

  /**
   * Handles clicks on a theme icon in the landing page grid.
   * @param {string} themeId - The ID of the clicked theme.
   */
  function handleThemeGridIconClick(themeId) {
    currentLandingGridSelection = themeId;
    localStorage.setItem(LANDING_SELECTED_GRID_THEME_KEY, themeId);
    themeGridContainer
      .querySelectorAll(".theme-grid-icon.active")
      .forEach((btn) => btn.classList.remove("active"));
    const clickedBtn = themeGridContainer.querySelector(
      `.theme-grid-icon[data-theme="${themeId}"]`
    );
    if (clickedBtn) clickedBtn.classList.add("active");
    updateLandingPagePanels(themeId, true);
  }

  /**
   * Updates the content of the landing page's theme description and details panels.
   * @param {string} themeId - The ID of the theme to display information for.
   * @param {boolean} animate - Whether to animate panel expansion.
   */
  function updateLandingPagePanels(themeId, animate = true) {
    const themeConfig = ALL_THEMES_CONFIG[themeId];
    if (
      !themeConfig ||
      !landingThemeLoreText ||
      !landingThemeInfoContent ||
      !landingThemeDescriptionContainer ||
      !landingThemeDetailsContainer
    )
      return;

    // Update panel titles (they are generic, but good to ensure they are set)
    const descPanelContainer = document.getElementById(
      "landing-theme-description-container"
    );
    const descTitle = descPanelContainer
      ? descPanelContainer.querySelector(".panel-box-title")
      : null;
    if (descTitle)
      descTitle.textContent = getUIText("landing_theme_description_title"); // Generic title

    const detailsPanelContainer = document.getElementById(
      "landing-theme-details-container"
    );
    const detailsTitle = detailsPanelContainer
      ? detailsPanelContainer.querySelector(".panel-box-title")
      : null;
    if (detailsTitle)
      detailsTitle.textContent = getUIText("landing_theme_info_title"); // Generic title

    // Set lore text, using themeId for context
    landingThemeLoreText.textContent = getUIText(
      themeConfig.lore_key,
      {},
      themeId
    );
    if (animate) {
      // Optionally animate lore panel expansion
      const lorePanelBox =
        landingThemeDescriptionContainer.querySelector(".panel-box");
      if (lorePanelBox && lorePanelBox.id)
        animatePanelBox(lorePanelBox.id, true, false);
    }

    // Use name_long_key for the briefing panel, fallback to name_key
    const themeDisplayNameInBriefing = getUIText(
      themeConfig.name_long_key || themeConfig.name_key,
      {},
      themeId
    );

    // Set name, inspiration, tone, and concept text using themeId for context
    landingThemeInfoContent.innerHTML = `
            <p><strong>${getUIText(
              "landing_theme_name_label"
            )}:</strong> <span id="landing-selected-theme-name">${themeDisplayNameInBriefing}</span></p>
            <p><strong>${getUIText(
              "landing_theme_inspiration_label"
            )}:</strong> <span id="landing-selected-theme-inspiration">${getUIText(
      themeConfig.inspiration_key,
      {},
      themeId
    )}</span></p>
            <p><strong>${getUIText(
              "landing_theme_tone_label"
            )}:</strong> <span id="landing-selected-theme-tone">${getUIText(
      themeConfig.tone_key,
      {},
      themeId
    )}</span></p>
            <p><strong>${getUIText(
              "landing_theme_concept_label"
            )}:</strong> <span id="landing-selected-theme-concept">${getUIText(
      themeConfig.concept_key,
      {},
      themeId
    )}</span></p>
        `;

    renderLandingPageActionButtons(themeId); // Create "Choose" and "Like" buttons
    if (landingThemeActions) landingThemeActions.style.display = "flex"; // Show action buttons

    if (animate) {
      // Optionally animate details panel expansion
      const detailsPanelBox =
        landingThemeDetailsContainer.querySelector(".panel-box");
      if (detailsPanelBox && detailsPanelBox.id)
        animatePanelBox(detailsPanelBox.id, true, false);
    }
  }

  /**
   * Renders the "Choose this theme" and "Like" buttons on the landing page for a selected theme.
   * @param {string} themeId - The ID of the currently selected theme.
   */
  function renderLandingPageActionButtons(themeId) {
    if (!landingThemeActions) return;
    landingThemeActions.innerHTML = "";
    const themeConfig = ALL_THEMES_CONFIG[themeId];
    if (!themeConfig) return;

    const chooseButton = document.createElement("button");
    chooseButton.id = "choose-theme-button";
    chooseButton.classList.add("ui-button");
    if (themeConfig.playable) {
      chooseButton.classList.add("primary");
      chooseButton.textContent = getUIText("landing_choose_theme_button");
      chooseButton.addEventListener("click", () =>
        handleChooseThisThemeClick(themeId)
      );
      chooseButton.disabled = false;
    } else {
      chooseButton.classList.add("disabled");
      chooseButton.textContent = getUIText("coming_soon_button");
      chooseButton.disabled = true;
    }

    const likeButton = document.createElement("button");
    likeButton.id = "like-theme-button";
    likeButton.classList.add("ui-button", "icon-button", "like-theme-button");
    if (themeConfig.playable) {
      const isCurrentlyLiked = isThemeLiked(themeId);
      const likeTextKey = isCurrentlyLiked
        ? "aria_label_unlike_theme"
        : "aria_label_like_theme";
      const likeText = getUIText(likeTextKey);
      likeButton.innerHTML = `<img src="${
        isCurrentlyLiked
          ? "images/app/icon_heart_filled.svg"
          : "images/app/icon_heart_empty.svg"
      }" alt="${likeText}" class="like-icon">`;
      likeButton.setAttribute("aria-label", likeText);
      likeButton.title = likeText;
      if (isCurrentlyLiked) likeButton.classList.add("liked");
      likeButton.addEventListener("click", () =>
        handleLikeThemeClick(themeId, likeButton)
      );
      likeButton.disabled = false;
    } else {
      likeButton.innerHTML = `<img src="images/app/icon_heart_disabled.svg" alt="${getUIText(
        "aria_label_like_theme"
      )}" class="like-icon">`;
      likeButton.setAttribute("aria-label", getUIText("aria_label_like_theme"));
      likeButton.title = getUIText("coming_soon_button");
      likeButton.classList.add("disabled");
      likeButton.disabled = true;
    }
    landingThemeActions.appendChild(chooseButton);
    landingThemeActions.appendChild(likeButton);
  }

  /**
   * Handles the "Choose this theme" button click on the landing page.
   * @param {string} themeId - The ID of the theme chosen.
   */
  async function handleChooseThisThemeClick(themeId) {
    // Made async
    await changeThemeAndStart(themeId, false);
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
      removeLikedTheme(themeId);
    } else {
      addLikedTheme(themeId);
    }
  }

  /**
   * Hides the custom modal.
   */
  function hideCustomModal() {
    if (customModalOverlay) {
      customModalOverlay.classList.remove("active");
      if (customModalInput) customModalInput.value = "";
      if (customModalInputContainer)
        customModalInputContainer.style.display = "none";
    }
  }

  /**
   * Shows a custom modal.
   * @param {object} options - Configuration for the modal.
   * @returns {Promise<string|boolean|null>} - Resolves with input value for 'prompt', etc.
   */
  function showCustomModal(options) {
    return new Promise((resolve) => {
      currentModalResolve = resolve;
      const {
        type = "alert",
        titleKey,
        messageKey,
        replacements = {},
        confirmTextKey,
        cancelTextKey,
        inputPlaceholderKey,
        defaultValue = "",
        explicitThemeContext = null,
      } = options;

      if (
        !customModalOverlay ||
        !customModalTitle ||
        !customModalMessage ||
        !customModalActions
      ) {
        console.error("Custom modal elements not found!");
        currentModalResolve(
          type === "prompt" ? null : type === "confirm" ? false : null
        );
        return;
      }

      // Use explicitThemeContext for modal text if provided
      const modalThemeContext = explicitThemeContext || currentTheme;

      customModalTitle.textContent = getUIText(
        titleKey || `modal_default_title_${type}`,
        replacements,
        modalThemeContext
      );
      customModalMessage.innerHTML = getUIText(
        messageKey,
        replacements,
        modalThemeContext
      ).replace(/\n/g, "<br>");
      customModalActions.innerHTML = "";

      if (type === "prompt") {
        if (customModalInputContainer && customModalInput) {
          customModalInputContainer.style.display = "block";
          customModalInput.value = defaultValue;
          customModalInput.placeholder = inputPlaceholderKey
            ? getUIText(inputPlaceholderKey, {}, modalThemeContext)
            : "";
          setTimeout(() => customModalInput.focus(), 50);
        } else {
          console.error("Modal input elements not found for prompt type.");
          customModalInputContainer.style.display = "none";
        }
      } else {
        if (customModalInputContainer)
          customModalInputContainer.style.display = "none";
      }

      const confirmBtn = document.createElement("button");
      confirmBtn.classList.add("ui-button", "primary");
      let defaultConfirmKey = "modal_ok_button";
      if (type === "confirm") defaultConfirmKey = "modal_yes_button";
      if (type === "prompt") defaultConfirmKey = "modal_confirm_button";
      confirmBtn.textContent = getUIText(
        confirmTextKey || defaultConfirmKey,
        {},
        modalThemeContext
      );
      confirmBtn.addEventListener("click", () => {
        if (type === "prompt") {
          currentModalResolve(customModalInput.value);
        } else if (type === "confirm") {
          currentModalResolve(true);
        } else {
          currentModalResolve(null);
        }
        hideCustomModal();
      });
      customModalActions.appendChild(confirmBtn);

      if (type === "confirm" || type === "prompt") {
        const cancelBtn = document.createElement("button");
        cancelBtn.classList.add("ui-button");
        cancelBtn.textContent = getUIText(
          cancelTextKey || "modal_cancel_button",
          {},
          modalThemeContext
        );
        cancelBtn.addEventListener("click", () => {
          currentModalResolve(type === "prompt" ? null : false);
          hideCustomModal();
        });
        customModalActions.appendChild(cancelBtn);
      }
      customModalOverlay.classList.add("active");
    });
  }

  /**
   * Main application initialization function. Sets up API key, loads preferences,
   * and determines whether to show landing page or resume a game.
   */
  async function initializeApp() {
    if (
      typeof THEMES_MANIFEST === "undefined" ||
      THEMES_MANIFEST.length === 0
    ) {
      console.error(
        "CRITICAL: THEMES_MANIFEST is not loaded or is empty. Application cannot proceed."
      );
      if (customModalOverlay && customModalTitle && customModalMessage) {
        await showCustomModal({
          type: "alert",
          titleKey: "alert_title_error",
          messageKey: "error_critical_manifest_missing",
        });
      } else {
        alert("CRITICAL: Theme manifest missing. Application cannot start.");
      }
      [
        startGameButton,
        playerIdentifierInputEl,
        playerActionInput,
        sendActionButton,
        newGameButton,
        modelToggleButton,
        languageToggleButton,
      ].forEach((el) => {
        if (el) el.disabled = true;
      });
      if (themeGridContainer)
        themeGridContainer.innerHTML =
          '<p style="color:red; text-align:center;">Error: Theme manifest failed to load.</p>';
      if (systemStatusIndicator) {
        systemStatusIndicator.textContent = getUIText("status_error");
        systemStatusIndicator.className = "status-indicator status-danger";
      }
      return;
    }

    const themeLoadPromises = THEMES_MANIFEST.map(async (themeMeta) => {
      const themePath = themeMeta.path;
      if (!ALL_THEMES_CONFIG[themeMeta.id]) {
        await loadThemeConfig(themeMeta.id, themePath);
      }
      if (ALL_THEMES_CONFIG[themeMeta.id] && !themeTextData[themeMeta.id]) {
        await loadThemeTexts(themeMeta.id, themePath);
      }
      if (themeMeta.id === DEFAULT_THEME_ID) {
        if (
          !PROMPT_URLS_BY_THEME[themeMeta.id] ||
          !NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[themeMeta.id]
        ) {
          await loadThemePromptsConfig(themeMeta.id, themePath);
        }
      }
    });

    try {
      await Promise.all(themeLoadPromises);
    } catch (error) {
      console.error("Error loading initial theme data:", error);
      await showCustomModal({
        type: "alert",
        titleKey: "alert_title_error",
        messageKey: "error_initial_theme_data_load_failed",
      });
    }

    loadThemeListsFromStorage();
    currentTheme = localStorage.getItem(CURRENT_THEME_STORAGE_KEY) || null;
    currentAppLanguage =
      localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY) || DEFAULT_LANGUAGE;
    currentNarrativeLanguage =
      localStorage.getItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY) ||
      currentAppLanguage;
    currentModelName =
      localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY) || FREE_MODEL_NAME;
    updateModelToggleButtonText();

    const apiKeyIsSetup = await setupApiKey();
    if (!apiKeyIsSetup) {
      const defaultThemeAvailableForLanding =
        DEFAULT_THEME_ID &&
        ALL_THEMES_CONFIG[DEFAULT_THEME_ID] &&
        themeTextData[DEFAULT_THEME_ID];
      if (
        THEMES_MANIFEST &&
        THEMES_MANIFEST.length > 0 &&
        defaultThemeAvailableForLanding
      ) {
        switchToLandingView();
      } else {
        console.error(
          "Cannot switch to landing view, critical theme data (incl. default) missing."
        );
        if (systemStatusIndicator) {
          systemStatusIndicator.textContent = "Setup Error";
          systemStatusIndicator.className = "status-indicator status-danger";
        }
      }
      return;
    }

    let gameToResume = null;
    let successfullyLoadedStateForResume = false;

    if (
      currentTheme &&
      ALL_THEMES_CONFIG[currentTheme] &&
      isThemePlaying(currentTheme)
    ) {
      const tempPlayerId = playerIdentifier;
      const tempGameHistory = [...gameHistory];

      const resumeDataLoaded = await ensureThemeDataLoaded(currentTheme);
      if (!resumeDataLoaded) {
        console.error(
          `Failed to load necessary data for resuming theme ${currentTheme}.`
        );
        removePlayingTheme(currentTheme, false);
        clearGameState(currentTheme);
        currentTheme = null;
        localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
        currentSuggestedActions = []; // Ensure reset
      } else {
        if (await loadAllPromptsForTheme(currentTheme)) {
          if (loadGameState(currentTheme)) { // Populates currentSuggestedActions
            gameToResume = currentTheme;
            successfullyLoadedStateForResume = true;
          } else {
            removePlayingTheme(currentTheme, false);
            clearGameState(currentTheme);
            currentTheme = null;
            localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
            playerIdentifier = tempPlayerId;
            gameHistory = tempGameHistory;
            currentPanelStates = {};
            currentSuggestedActions = []; // Ensure reset
          }
        } else {
          addMessageToLog(
            getUIText("error_resume_failed_prompts", { THEME: currentTheme }),
            "system-error"
          );
          removePlayingTheme(currentTheme, false);
          clearGameState(currentTheme);
          currentTheme = null;
          localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
          playerIdentifier = tempPlayerId;
          gameHistory = tempGameHistory;
          currentPanelStates = {};
          currentSuggestedActions = []; // Ensure reset
        }
      }
    } else if (currentTheme) {
      currentTheme = null;
      localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
      currentPanelStates = {};
      currentSuggestedActions = []; // Ensure reset
    }


    if (gameToResume && successfullyLoadedStateForResume) {
      switchToGameView(currentTheme); // Makes suggestedActionsWrapper visible
      generatePanelsForTheme(currentTheme);
      setAppLanguageAndThemeUI(currentAppLanguage, currentTheme);

      updateDashboard(lastKnownDashboardUpdates, false);
      handleGameStateIndicators(lastKnownGameStateIndicators, true);

      initializeCollapsiblePanelBoxes(currentTheme);
      displaySuggestedActions(currentSuggestedActions); // Display them now

      if (nameInputSection) nameInputSection.style.display = "none";
      if (actionInputSection) actionInputSection.style.display = "flex";
      if (playerActionInput && document.body.contains(playerActionInput)) {
        playerActionInput.focus();
      }
      const themeDisplayName = ALL_THEMES_CONFIG[currentTheme]
        ? getUIText(ALL_THEMES_CONFIG[currentTheme].name_key, {}, currentTheme)
        : currentTheme;
      addMessageToLog(
        getUIText("system_session_resumed", {
          PLAYER_ID: playerIdentifier,
          THEME_NAME: themeDisplayName,
        }),
        "system"
      );

      if (systemStatusIndicator) {
        systemStatusIndicator.textContent = getUIText(
          "system_status_online_short"
        );
        systemStatusIndicator.className = "status-indicator status-ok";
      }
      isInitialGameLoad = false;
    } else {
      currentSuggestedActions = []; // Ensure reset for landing view
      switchToLandingView(); // Will eventually call displaySuggestedActions([])
    }
    updateTopbarThemeIcons();
    if (playerActionInput) autoGrowTextarea(playerActionInput);
  }

  // Event Listeners
  if (applicationLogoElement)
    applicationLogoElement.addEventListener("click", switchToLandingView);
  if (languageToggleButton)
    languageToggleButton.addEventListener("click", toggleAppLanguage);
  if (newGameButton) {
    newGameButton.addEventListener("click", () => {
      startNewGameSession().catch((err) => {
        console.error("Error during New Game operation:", err);
      });
    });
  }
  if (modelToggleButton)
    modelToggleButton.addEventListener("click", toggleModelType);
  if (startGameButton) {
    startGameButton.addEventListener("click", () => {
      startGameAfterIdentifier().catch((err) => {
        console.error(
          "Error during startGameAfterIdentifier (button click):",
          err
        );
      });
    });
  }
  if (playerIdentifierInputEl) {
    playerIdentifierInputEl.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        startGameAfterIdentifier().catch((err) => {
          console.error(
            "Error during startGameAfterIdentifier (Enter key):",
            err
          );
        });
      }
    });
  }
  if (sendActionButton) {
    sendActionButton.addEventListener("click", () => {
      sendPlayerAction().catch((err) => {
        console.error("Error during sendPlayerAction (button click):", err);
      });
    });
  }
  if (playerActionInput) {
    playerActionInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendPlayerAction().catch((err) => {
          console.error("Error during sendPlayerAction (Enter key):", err);
        });
      }
    });
    playerActionInput.addEventListener("input", () =>
      autoGrowTextarea(playerActionInput)
    );
  }
  if (storyLogViewport) {
    storyLogViewport.addEventListener("scroll", () => {
      if (
        storyLogViewport.scrollHeight - storyLogViewport.clientHeight >
        storyLogViewport.scrollTop + AUTOSCROLL_THRESHOLD
      ) {
        userHasManuallyScrolledLog = true;
      }
    });
  }

  initializeApp();
});
