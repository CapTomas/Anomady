document.addEventListener("DOMContentLoaded", () => {
  // --- API Key & Endpoints (v0.4.5 and beyond) ---
  const PROXY_API_URL = '/api/v1/gemini/generate';

  // --- Default Application Settings ---
  const DEFAULT_LANGUAGE = "cs";
  const DEFAULT_THEME_ID = "grim_warden";
  const UPDATE_HIGHLIGHT_DURATION = 5000;
  const SCROLL_INDICATOR_TOLERANCE = 2;

  // --- localStorage Keys ---
  const CURRENT_THEME_STORAGE_KEY = "anomadyCurrentTheme";
  const MODEL_PREFERENCE_STORAGE_KEY = "anomadyModelPreference";
  const LANGUAGE_PREFERENCE_STORAGE_KEY = "preferredAppLanguage";
  const NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY = "preferredNarrativeLanguage";
  const LANDING_SELECTED_GRID_THEME_KEY = "anomadyLandingSelectedGridTheme";
  const LOG_LEVEL_STORAGE_KEY = "anomadyLogLevel";
  const JWT_STORAGE_KEY = "anomadyAuthToken";

  // --- Logging Configuration ---
  const LOG_LEVEL_DEBUG = "debug";
  const LOG_LEVEL_INFO = "info";
  const LOG_LEVEL_WARN = "warning";
  const LOG_LEVEL_ERROR = "error";
  const LOG_LEVELS = [LOG_LEVEL_DEBUG, LOG_LEVEL_INFO, LOG_LEVEL_WARN, LOG_LEVEL_ERROR];
  let currentLogLevel = localStorage.getItem(LOG_LEVEL_STORAGE_KEY) || LOG_LEVEL_INFO;

  // --- AI Model Configuration ---
  const PAID_MODEL_NAME = "gemini-1.5-pro-latest";
  const FREE_MODEL_NAME = "gemini-1.5-flash-latest";
  let currentModelName = localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY) || FREE_MODEL_NAME;

  // --- Core Application State ---
  let currentTheme = localStorage.getItem(CURRENT_THEME_STORAGE_KEY) || null;
  let currentAppLanguage = localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY) || DEFAULT_LANGUAGE;
  let currentNarrativeLanguage = localStorage.getItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY) || currentAppLanguage;
  let currentUser = null;

  // --- Dynamically Loaded Theme Data ---
  let ALL_THEMES_CONFIG = {};
  let themeTextData = {};
  let PROMPT_URLS_BY_THEME = {};
  let NARRATIVE_LANG_PROMPT_PARTS_BY_THEME = {};
  let gamePrompts = {};

  // --- Game State Variables ---
  let currentPromptType = "initial";
  let gameHistory = [];
  let playerIdentifier = "";
  let isInitialGameLoad = true;
  let lastKnownDashboardUpdates = {};
  let lastKnownGameStateIndicators = {};
  let currentModalResolve = null;
  let currentSuggestedActions = [];
  let currentPanelStates = {};

  // --- User Theme Lists ---
  let playingThemes = [];
  let likedThemes = [];
  let currentLandingGridSelection = null;

  // --- DOM Element References ---
  const appRoot = document.getElementById("app-root");
  const applicationLogoElement = document.getElementById("application-logo");
  const playingThemesContainer = document.getElementById("playing-themes-container");
  const likedThemesSeparator = document.getElementById("liked-themes-separator");
  const likedThemesContainer = document.getElementById("liked-themes-container");
  const systemStatusIndicator = document.getElementById("system-status-indicator");
  const gmSpecificActivityIndicator = document.getElementById("gm-activity-indicator");
  const languageToggleButton = document.getElementById("language-toggle-button");
  const newGameButton = document.getElementById("new-game-button");
  const modelToggleButton = document.getElementById("model-toggle-button");
  const loginButton = document.getElementById("login-button");
  const registerButton = document.getElementById("register-button");
  const logoutButton = document.getElementById("logout-button");
  const userProfileButton = document.getElementById("user-profile-button");
  const leftPanel = document.getElementById("left-panel");
  const rightPanel = document.getElementById("right-panel");
  const outOfViewTrackedElements = { left: { up: new Set(), down: new Set() }, right: { up: new Set(), down: new Set() } };
  let leftPanelScrollUp, leftPanelScrollDown, rightPanelScrollUp, rightPanelScrollDown;
  const themeGridContainer = document.getElementById("theme-grid-container");
  const landingThemeDescriptionContainer = document.getElementById("landing-theme-description-container");
  const landingThemeLoreText = document.getElementById("landing-theme-lore-text");
  const landingThemeDetailsContainer = document.getElementById("landing-theme-details-container");
  const landingThemeInfoContent = document.getElementById("landing-theme-info-content");
  const landingThemeActions = document.getElementById("landing-theme-actions");
  const customModalOverlay = document.getElementById("custom-modal-overlay");
  const customModalElement = document.getElementById("custom-modal");
  const customModalTitle = document.getElementById("custom-modal-title");
  const customModalMessage = document.getElementById("custom-modal-message");
  const customModalInputContainer = document.getElementById("custom-modal-input-container");
  const customModalInput = document.getElementById("custom-modal-input");
  const customModalActions = document.getElementById("custom-modal-actions");
  const customModalFormContainer = document.createElement('div');
  customModalFormContainer.id = 'custom-modal-form-container';
  const storyLog = document.getElementById("story-log");
  const storyLogViewport = document.getElementById("story-log-viewport");
  const suggestedActionsWrapper = document.getElementById("suggested-actions-wrapper");
  const playerInputControlPanel = document.getElementById("player-input-control-panel");
  const nameInputSection = document.getElementById("name-input-section");
  const playerIdentifierInputEl = document.getElementById("player-identifier-input");
  const startGameButton = document.getElementById("start-game-button");
  const actionInputSection = document.getElementById("action-input-section");
  const playerActionInput = document.getElementById("player-action-input");
  const sendActionButton = document.getElementById("send-action-button");
  let userHasManuallyScrolledLog = false;
  const AUTOSCROLL_THRESHOLD = 40;

  /**
   * Logs messages to the console based on the current log level.
   */
  function log(level, ...messages) {
    const levelIndex = LOG_LEVELS.indexOf(level);
    const currentLevelIndex = LOG_LEVELS.indexOf(currentLogLevel);
    if (levelIndex === -1) { console.error(`[AnomadyFE/UNKNOWN_LOG_LEVEL: ${level}]`, ...messages); return; }
    if (levelIndex >= currentLevelIndex) {
      const prefix = `[AnomadyFE/${level.toUpperCase()}]`;
      if (level === LOG_LEVEL_ERROR) { console.error(prefix, ...messages); }
      else { console.log(prefix, ...messages); }
    }
  }

  /**
   * Sets the application's log level.
   */
  function setLogLevel(newLevel) {
    if (LOG_LEVELS.includes(newLevel)) {
      currentLogLevel = newLevel;
      localStorage.setItem(LOG_LEVEL_STORAGE_KEY, newLevel);
      log(LOG_LEVEL_INFO, `Log level set to ${newLevel.toUpperCase()}`);
    } else {
      log(LOG_LEVEL_ERROR, `Invalid log level: ${newLevel}. Valid: ${LOG_LEVELS.join(", ")}`);
    }
  }
  window.setAnomadyLogLevel = setLogLevel;

  /**
   * Fetches and parses a JSON file.
   */
  async function fetchJSON(filePath) {
    try {
      const response = await fetch(filePath);
      if (!response.ok) { throw new Error(`HTTP error ${response.status} for ${filePath}: ${response.statusText}`); }
      return await response.json();
    } catch (error) { log(LOG_LEVEL_ERROR, `Error fetching JSON ${filePath}:`, error); throw error; }
  }

  /**
   * Loads a theme's configuration file (config.json).
   */
  async function loadThemeConfig(themeId, themePath) {
    try { ALL_THEMES_CONFIG[themeId] = await fetchJSON(`${themePath}config.json`); }
    catch (error) { log(LOG_LEVEL_ERROR, `Failed to load config for theme ${themeId} from ${themePath}config.json`); }
  }

  /**
   * Loads a theme's UI text file (texts.json).
   */
  async function loadThemeTexts(themeId, themePath) {
    try { themeTextData[themeId] = await fetchJSON(`${themePath}texts.json`); }
    catch (error) { log(LOG_LEVEL_ERROR, `Failed to load texts for theme ${themeId} from ${themePath}texts.json`); }
  }

  /**
   * Loads a theme's prompt configuration file (prompts-config.json).
   */
  async function loadThemePromptsConfig(themeId, themePath) {
    try {
      const promptsConfig = await fetchJSON(`${themePath}prompts-config.json`);
      PROMPT_URLS_BY_THEME[themeId] = promptsConfig.PROMPT_URLS || {};
      NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[themeId] = promptsConfig.NARRATIVE_LANG_PROMPT_PARTS || {};
    } catch (error) { log(LOG_LEVEL_ERROR, `Failed to load prompts config for theme ${themeId} from ${themePath}prompts-config.json`); }
  }

  /**
   * Ensures all necessary data (config, texts, prompts config) for a theme is loaded.
   */
  async function ensureThemeDataLoaded(themeId) {
    const themeManifestEntry = THEMES_MANIFEST.find((t) => t.id === themeId);
    if (!themeManifestEntry) { log(LOG_LEVEL_ERROR, `Theme ${themeId} not in manifest.`); return false; }
    const themePath = themeManifestEntry.path;
    let success = true;
    try {
      if (!ALL_THEMES_CONFIG[themeId]) { await loadThemeConfig(themeId, themePath); if (!ALL_THEMES_CONFIG[themeId]) success = false; }
      if (success && !themeTextData[themeId]) { await loadThemeTexts(themeId, themePath); if (!themeTextData[themeId]) success = false; }
      if (success && (!PROMPT_URLS_BY_THEME[themeId] || !NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[themeId])) {
        await loadThemePromptsConfig(themeId, themePath); if (!PROMPT_URLS_BY_THEME[themeId]) success = false;
      }
    } catch (error) { log(LOG_LEVEL_ERROR, `Error ensuring data for theme ${themeId}:`, error); success = false; }
    return success;
  }

  /**
   * Retrieves UI text based on key, language, and context.
   */
  function getUIText(key, replacements = {}, explicitThemeContext = null) {
    let text;
    const onLandingPage = document.body.classList.contains("landing-page-active");
    const lang = currentAppLanguage;
    if (onLandingPage && globalTextData.landing?.[lang]?.[key]) { text = globalTextData.landing[lang][key]; }
    else if (onLandingPage && globalTextData.landing?.en?.[key] && !globalTextData.landing?.[lang]?.[key]) { text = globalTextData.landing.en[key]; }
    if (!text && explicitThemeContext && themeTextData[explicitThemeContext]) { text = themeTextData[explicitThemeContext]?.[lang]?.[key] || themeTextData[explicitThemeContext]?.en?.[key]; }
    if (!text && currentTheme && themeTextData[currentTheme]) { text = themeTextData[currentTheme]?.[lang]?.[key] || themeTextData[currentTheme]?.en?.[key]; }
    if (!text && globalTextData.global) { text = globalTextData.global[lang]?.[key] || globalTextData.global.en?.[key]; }
    if (!text && !onLandingPage && !explicitThemeContext && currentTheme !== DEFAULT_THEME_ID && themeTextData[DEFAULT_THEME_ID]) {
      text = themeTextData[DEFAULT_THEME_ID]?.[lang]?.[key] || themeTextData[DEFAULT_THEME_ID]?.en?.[key];
    }
    text = text || key;
    for (const placeholder in replacements) { text = text.replace(new RegExp(`{${placeholder}}`, "g"), replacements[placeholder]); }
    return text;
  }

  /**
   * Confirms API key setup (now primarily server-side).
   */
  async function setupApiKey() {
    log(LOG_LEVEL_INFO, "API key management is primarily server-side.");
    if (themeGridContainer) themeGridContainer.style.pointerEvents = "auto";
    return true;
  }

  /**
   * Saves the current game state. If a user is logged in, it saves to the backend.
   * Otherwise, it does nothing (as localStorage persistence is being removed for game states).
   * This function is now asynchronous due to the API call.
   */
  async function saveGameState() {
    if (!currentTheme) {
      log(LOG_LEVEL_WARN, "Cannot save game state: currentTheme not set.");
      return;
    }

    if (!currentUser || !currentUser.token) {
      log(LOG_LEVEL_INFO, "User not logged in. Game state not saved to backend.");
      return;
    }

    const narrativePlayerIdentifier = playerIdentifier;

    if (!narrativePlayerIdentifier && gameHistory.length === 0) {
      log(LOG_LEVEL_INFO, "Player identifier not set and game history empty, skipping initial save for new game until identifier is set.");
      return;
    }

    log(LOG_LEVEL_INFO, `Attempting to save game state for theme '${currentTheme}' for user '${currentUser.email}'`);

    const gameStatePayload = {
      theme_id: currentTheme,
      player_identifier: narrativePlayerIdentifier || "Unnamed Protagonist",
      game_history: gameHistory,
      // game_history_summary: "", // Optional: To be implemented if needed
      last_dashboard_updates: lastKnownDashboardUpdates,
      last_game_state_indicators: lastKnownGameStateIndicators,
      current_prompt_type: currentPromptType,
      current_narrative_language: currentNarrativeLanguage,
      last_suggested_actions: currentSuggestedActions,
      panel_states: currentPanelStates,
      model_name_used: currentModelName,
    };

    try {
      // showGlobalLoadingIndicator(true, "Saving progress...");
      const response = await _callApi('/api/v1/gamestates', 'POST', gameStatePayload, currentUser.token);
      log(LOG_LEVEL_INFO, "Game state saved successfully to backend.", response);
      addMessageToLog("Progress saved to server.", "system");
      // showGlobalLoadingIndicator(false);
    } catch (error) {
      log(LOG_LEVEL_ERROR, "Error saving game state to backend:", error.message, error.code, error.details);
      addMessageToLog(getUIText("error_saving_progress") + ` (Server: ${error.message})`, "system-error");
    }
  }

  /**
   * Loads game state. If a user is logged in, it fetches from the backend.
   */
  async function loadGameState(themeIdToLoad) {
    if (!currentUser || !currentUser.token) {
      log(LOG_LEVEL_INFO, "User not logged in. Cannot load game state from backend.");
      clearGameStateInternal(themeIdToLoad);
      return false;
    }

    log(LOG_LEVEL_INFO, `Attempting to load game state for theme '${themeIdToLoad}' for user '${currentUser.email}' from backend.`);
    // showGlobalLoadingIndicator(true, "Loading game..."); // Example UI Feedback

    try {
      const loadedState = await _callApi(`/api/v1/gamestates/${themeIdToLoad}`, 'GET', null, currentUser.token);

      playerIdentifier = loadedState.player_identifier;
      gameHistory = loadedState.game_history || [];
      lastKnownDashboardUpdates = loadedState.last_dashboard_updates || {};
      lastKnownGameStateIndicators = loadedState.last_game_state_indicators || {};
      currentPromptType = loadedState.current_prompt_type || "default";
      currentNarrativeLanguage = loadedState.current_narrative_language || currentAppLanguage;
      currentSuggestedActions = loadedState.last_suggested_actions || [];
      currentPanelStates = loadedState.panel_states || {};

      if (storyLog) storyLog.innerHTML = "";
      gameHistory.forEach((turn) => {
        if (turn.role === "user") { addMessageToLog(turn.parts[0].text, "player"); }
        else if (turn.role === "model") {
          try {
            const modelResponse = JSON.parse(turn.parts[0].text); addMessageToLog(modelResponse.narrative, "gm");
          } catch (e) { log(LOG_LEVEL_ERROR, "Error parsing model response from loaded history:", e, turn.parts[0].text); addMessageToLog(getUIText("error_reconstruct_story"), "system"); }
        }
      });

      updateDashboard(lastKnownDashboardUpdates, false);
      handleGameStateIndicators(lastKnownGameStateIndicators, true);

      if (playerIdentifierInputEl) {
        playerIdentifierInputEl.value = playerIdentifier;
      }
      const themeConfig = ALL_THEMES_CONFIG[themeIdToLoad];
      if (themeConfig && themeConfig.dashboard_config) {
        const dashboardConfig = themeConfig.dashboard_config;
        const playerIdentifierConfigKey = (dashboardConfig.left_panel || []).flatMap((p) => p.items).find((item) => item.id === "name" || item.id === "character_name")?.id;
        if (playerIdentifierConfigKey) {
          const el = document.getElementById(`info-${playerIdentifierConfigKey}`);
          if (el) el.textContent = playerIdentifier;
        }
      }

      Object.keys(currentPanelStates).forEach(panelId => {
          const panelElement = document.getElementById(panelId);
          if (panelElement && panelElement.classList.contains('collapsible')) {
              const shouldBeExpanded = currentPanelStates[panelId];
              const isCurrentlyExpanded = panelElement.classList.contains('is-expanded');
              if (shouldBeExpanded !== isCurrentlyExpanded) {
                  const panelBoxConfig = findPanelBoxConfigById(themeIdToLoad, panelId);
                  if (panelBoxConfig) {
                    animatePanelBox(panelId, shouldBeExpanded, panelBoxConfig.type === 'hidden_until_active', true);
                  }
              }
          }
      });


      isInitialGameLoad = false;
      log(LOG_LEVEL_INFO, `Game state for theme '${themeIdToLoad}' loaded successfully from backend.`);
      // showGlobalLoadingIndicator(false);
      return true;

    } catch (error) {
      // showGlobalLoadingIndicator(false);
      if (error.status === 404 && error.code === 'GAME_STATE_NOT_FOUND') {
        log(LOG_LEVEL_INFO, `No game state found on backend for theme '${themeIdToLoad}'. Starting fresh.`);
        clearGameStateInternal(themeIdToLoad); // Clear any local/in-memory remnants
        // For a new game, playerIdentifier (character name) might be prompted or use a default
        isInitialGameLoad = true; // Treat as a new game start for this theme for this user
        currentPromptType = "initial";
        return false; // Signifies no existing game state was loaded
      } else {
        log(LOG_LEVEL_ERROR, `Error loading game state for theme '${themeIdToLoad}' from backend:`, error.message, error.code);
        addMessageToLog(getUIText("error_api_call_failed", { ERROR_MSG: `Could not load game: ${error.message}` }), "system-error");
        clearGameStateInternal(themeIdToLoad);
        return false;
      }
    }
  }

  /**
   * Finds a panel box's configuration by its ID within a theme's dashboard structure.
   */
  function findPanelBoxConfigById(themeId, panelBoxId) {
    const themeFullConfig = ALL_THEMES_CONFIG[themeId];
    if (!themeFullConfig || !themeFullConfig.dashboard_config) return null;
    const dashboardConfig = themeFullConfig.dashboard_config;
    for (const sideKey of ["left_panel", "right_panel"]) {
        if (dashboardConfig[sideKey]) {
            const foundPanelConfig = dashboardConfig[sideKey].find(pCfg => pCfg.id === panelBoxId);
            if (foundPanelConfig) return foundPanelConfig;
        }
    }
    return null;
  }

  /**
   * Clears in-memory game state variables for a specific theme.
   */
  async function clearGameState(themeIdToClear) {
    log(LOG_LEVEL_INFO, `Attempting to clear game state for theme '${themeIdToClear}'.`);

    if (currentUser && currentUser.token) {
      try {
        // showGlobalLoadingIndicator(true, "Clearing game data..."); // Example UI Feedback
        await _callApi(`/api/v1/gamestates/${themeIdToClear}`, 'DELETE', null, currentUser.token);
        log(LOG_LEVEL_INFO, `Game state for theme '${themeIdToClear}' successfully deleted from backend for user '${currentUser.email}'.`);
        // showGlobalLoadingIndicator(false);
      } catch (error) {
        // showGlobalLoadingIndicator(false);
        if (error.status === 404 && error.code === 'GAME_STATE_NOT_FOUND_FOR_DELETE') {
            log(LOG_LEVEL_INFO, `No game state found on backend to delete for theme '${themeIdToClear}'. Frontend will be cleared.`);
        } else {
            log(LOG_LEVEL_ERROR, `Error deleting game state for theme '${themeIdToClear}' from backend:`, error.message, error.code);
        }
      }
    } else {
      log(LOG_LEVEL_INFO, "User not logged in. Skipping backend game state deletion.");
    }

    clearGameStateInternal(themeIdToClear);
  }

  /**
   * Clears in-memory game state variables for a specific theme.
   */
  function clearGameStateInternal(themeIdToClear) {
    if (themeIdToClear === currentTheme || !currentTheme) {
      gameHistory = [];
      currentPromptType = "initial";
      isInitialGameLoad = true;
      lastKnownDashboardUpdates = {};
      lastKnownGameStateIndicators = {};
      currentSuggestedActions = [];
      currentPanelStates = {};
      if (storyLog) storyLog.innerHTML = "";
      clearSuggestedActions();
      playerIdentifier = "";
      log(LOG_LEVEL_INFO, `Internal game state cleared for theme: ${themeIdToClear}`);
    }
  }


  /**
   * Fetches a specific prompt text file for a given theme.
   */
  async function fetchPrompt(promptName, themeId, isCritical = false) {
    if (!PROMPT_URLS_BY_THEME[themeId] || !PROMPT_URLS_BY_THEME[themeId][promptName]) {
      const errorMsg = `Error: Prompt URL for "${promptName}" in theme "${themeId}" not found.`;
      log(LOG_LEVEL_ERROR, errorMsg); return isCritical ? `CRITICAL_ERROR: ${errorMsg}` : `NON_CRITICAL_ERROR: ${errorMsg}`;
    }
    const promptUrl = PROMPT_URLS_BY_THEME[themeId][promptName];
    try {
      const response = await fetch(promptUrl);
      if (!response.ok) {
        if (response.status === 404 && !isCritical) {
          log(LOG_LEVEL_INFO, `Optional prompt file not found (404): ${themeId}/${promptName} at ${promptUrl}. Will fallback if needed.`);
          return `FILE_NOT_FOUND_NON_CRITICAL: ${themeId}/${promptName}`;
        }
        throw new Error(`HTTP error ${response.status} for ${themeId}/${promptName}: ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      log(LOG_LEVEL_ERROR, `Error fetching prompt ${themeId}/${promptName} from ${promptUrl}:`, error);
      const errorPrefix = isCritical ? "CRITICAL_ERROR:" : "NON_CRITICAL_ERROR:";
      return `${errorPrefix} Prompt "${themeId}/${promptName}" load failed. ${error.message}`;
    }
  }

  /**
   * Loads all prompt files for a specified theme.
   */
  async function loadAllPromptsForTheme(themeId) {
    const themeConfig = ALL_THEMES_CONFIG[themeId];
    if (!themeConfig || !PROMPT_URLS_BY_THEME[themeId]) {
      addMessageToLog(getUIText("error_no_prompts_for_theme", { THEME: themeId }), "system");
      return false;
    }
    if (!gamePrompts[themeId]) gamePrompts[themeId] = {};
    const promptNames = Object.keys(PROMPT_URLS_BY_THEME[themeId]);
    const loadingPromises = promptNames.map((name) => {
      const isCritical = name === "master_initial" || name === "master_default";
      return fetchPrompt(name, themeId, isCritical).then((text) => {
        if (!text.startsWith("CRITICAL_ERROR:")) { gamePrompts[themeId][name] = text; }
        else { gamePrompts[themeId][name] = text; }
      });
    });
    try {
      await Promise.all(loadingPromises);
      for (const name of promptNames) {
        const isCriticalPrompt = name === "master_initial" || name === "master_default";
        if (isCriticalPrompt && gamePrompts[themeId][name]?.startsWith("CRITICAL_ERROR:")) {
          throw new Error(`Critical prompt load failure: ${gamePrompts[themeId][name]}. Theme "${themeId}" cannot be loaded.`);
        }
      }
      log(LOG_LEVEL_INFO, `Successfully processed prompts for theme: ${themeId}`); return true;
    } catch (error) {
      log(LOG_LEVEL_ERROR, `Error during prompt loading for ${themeId}:`, error);
      if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText("status_error"); systemStatusIndicator.className = "status-indicator status-danger"; }
      [startGameButton, playerIdentifierInputEl].forEach((el) => { if (el) el.disabled = true; });
      addMessageToLog(getUIText("error_load_prompts_critical", { THEME: themeId }), "system-error");
      return false;
    }
  }

  /**
   * Constructs the system prompt for the AI.
   */
  const getSystemPrompt = (currentPlayerIdentifierParam, promptTypeToUse) => {
    const themeConfig = ALL_THEMES_CONFIG[currentTheme];
    if (!currentTheme || !themeConfig || !themeConfig.dashboard_config) {
      return `{"narrative": "SYSTEM ERROR: Active theme or its configuration (including dashboard) is missing for prompt generation.", "dashboard_updates": {}, "suggested_actions": [], "game_state_indicators": {}}`;
    }
    const dashboardLayoutConfig = themeConfig.dashboard_config;
    const isValidPromptText = (text) => text && !text.startsWith("FILE_NOT_FOUND_NON_CRITICAL:") && !text.startsWith("NON_CRITICAL_ERROR:") && !text.startsWith("CRITICAL_ERROR:") && !text.startsWith("Error:");
    let basePromptKey = promptTypeToUse;
    let basePromptText = gamePrompts[currentTheme]?.[basePromptKey];
    if (!isValidPromptText(basePromptText)) {
      if (promptTypeToUse !== "initial" && promptTypeToUse !== "default") { basePromptKey = "default"; basePromptText = gamePrompts[currentTheme]?.[basePromptKey]; }
    }
    if (!isValidPromptText(basePromptText)) {
      if (promptTypeToUse === "initial" || basePromptKey === "initial") { basePromptKey = "master_initial"; } else { basePromptKey = "master_default"; }
      basePromptText = gamePrompts[currentTheme]?.[basePromptKey];
    }
    if (!isValidPromptText(basePromptText)) {
      log(LOG_LEVEL_INFO, `Prompt "${promptTypeToUse}" (and fallbacks like "${basePromptKey}") not found/invalid for "${currentTheme}". Attempting default theme fallback.`);
      const ultimateFallbackKey = (promptTypeToUse === "initial" || basePromptKey === "master_initial" || basePromptKey === "initial") ? "master_initial" : "master_default";
      if (!gamePrompts[DEFAULT_THEME_ID] || !gamePrompts[DEFAULT_THEME_ID][ultimateFallbackKey]) {
        log(LOG_LEVEL_ERROR, `CRITICAL FALLBACK FAILURE: Default theme (${DEFAULT_THEME_ID}) prompts not available for ${ultimateFallbackKey}.`);
        return `{"narrative": "SYSTEM ERROR: Core prompt files for default theme are critically missing. Cannot generate AI instructions.", "dashboard_updates": {}, "suggested_actions": ["Restart Game", "Contact Support"], "game_state_indicators": {"activity_status": "Error", "combat_engaged": false, "comms_channel_active": false}}`;
      }
      basePromptText = gamePrompts[DEFAULT_THEME_ID]?.[ultimateFallbackKey];
      if (isValidPromptText(basePromptText)) { log(LOG_LEVEL_INFO, `Used default theme's "${ultimateFallbackKey}" prompt for current theme "${currentTheme}".`); basePromptKey = ultimateFallbackKey; }
      else {
        log(LOG_LEVEL_ERROR, `CRITICAL PROMPT FAILURE: No valid prompt found (incl. default theme's "${ultimateFallbackKey}") for "${currentTheme}". Prompt content: ${basePromptText}`);
        return `{"narrative": "SYSTEM ERROR: Core prompt files are critically missing or invalid. Cannot generate AI instructions.", "dashboard_updates": {}, "suggested_actions": ["Restart Game", "Contact Support"], "game_state_indicators": {"activity_status": "Error", "combat_engaged": false, "comms_channel_active": false}}`;
      }
    }
    if (!isValidPromptText(basePromptText)) {
      log(LOG_LEVEL_ERROR, `Failed to load critical prompt template: ${basePromptKey} for theme ${currentTheme}. Content: ${basePromptText}`);
      return `{"narrative": "SYSTEM ERROR: Prompt template ${basePromptKey} missing or failed to load for ${currentTheme}.", "dashboard_updates": {}, "suggested_actions": ["Check panel.", "Change theme."], "game_state_indicators": {"activity_status": "Error", "combat_engaged": false, "comms_channel_active": false}}`;
    }
    let generatedDashboardDescription = "";
    const dashboardItems = [...(dashboardLayoutConfig.left_panel || []).flatMap(p => p.items), ...(dashboardLayoutConfig.right_panel || []).flatMap(p => p.items)];
    dashboardItems.forEach(item => {
      let description = `// "${item.id}": "string (${item.short_description || "No description available."}`;
      if (item.must_translate) { description += ` This value MUST be in ${currentNarrativeLanguage.toUpperCase()}.`; }
      else { description += ` This value does NOT require translation from English.`; }
      if (item.type === "meter" && item.status_text_id) { description += ` Associated status text field is '${item.status_text_id}'.`; }
      if (item.default_value_key) { description += ` Default UI text key: '${item.default_value_key}'.`; }
      else if (item.default_value !== undefined) { description += ` Default value: '${item.default_value}'.`; }
      description += `)",\n`; generatedDashboardDescription += description;
    });
    if (generatedDashboardDescription.endsWith(",\n")) { generatedDashboardDescription = generatedDashboardDescription.slice(0, -2); }
    let generatedGameStateIndicators = "";
    if (dashboardLayoutConfig.game_state_indicators && Array.isArray(dashboardLayoutConfig.game_state_indicators)) {
      dashboardLayoutConfig.game_state_indicators.forEach(indicator => {
        let description = `"${indicator.id}": "boolean (${indicator.short_description || "No description."}`;
        if (indicator.default_value_key) { description += ` Default UI text key for conceptual status: '${indicator.default_value_key}'.`; }
        else if (indicator.default_value !== undefined) { description += ` Default value: ${indicator.default_value}.`; }
        description += `)",\n`; generatedGameStateIndicators += description;
      });
      if (!generatedGameStateIndicators.includes('"activity_status"')) {
        const activityStatusDesc = themeConfig.id === "grim_warden" && dashboardItems.find(item => item.id === "activity_status") ? dashboardItems.find(item => item.id === "activity_status").short_description : "MUST match dashboard_updates.directive_status if provided. If not, it reflects the ongoing primary activity described in the narrative, IN THE NARRATIVE LANGUAGE. E.g., if narrative describes fighting, this should be the NARRATIVE LANGUAGE equivalent of 'Fighting'.";
        generatedGameStateIndicators += `"activity_status": "string (${activityStatusDesc})",\n`;
      }
      if (generatedGameStateIndicators.endsWith(",\n")) { generatedGameStateIndicators = generatedGameStateIndicators.slice(0, -2); }
    } else {
      const activityStatusDesc = themeConfig.id === "grim_warden" && dashboardItems.find(item => item.id === "activity_status") ? dashboardItems.find(item => item.id === "activity_status").short_description : "MUST match dashboard_updates.directive_status if provided. If not, it reflects the ongoing primary activity described in the narrative, IN THE NARRATIVE LANGUAGE.";
      generatedGameStateIndicators = `"activity_status": "string (${activityStatusDesc})",\n`;
      generatedGameStateIndicators += `"combat_engaged": "boolean (Set to true IF combat begins THIS turn. Otherwise, maintain previous state unless explicitly changing based on narrative events like escape or victory.)",\n`;
      generatedGameStateIndicators += `"comms_channel_active": "boolean (Set to true if a direct communication channel is now active as a result of this turn's events, false if it closed, or maintain previous state if unchanged.)"`;
    }
    const instructionKeyNamePart = basePromptKey;
    let themeSpecificInstructions = "";
    if (instructionKeyNamePart) {
      const themeInstructionTextKey = `theme_instructions_${instructionKeyNamePart}_${currentTheme}`;
      const fetchedInstruction = getUIText(themeInstructionTextKey, {}, currentTheme);
      if (fetchedInstruction !== themeInstructionTextKey && fetchedInstruction.trim() !== "") { themeSpecificInstructions = fetchedInstruction; }
      else { themeSpecificInstructions = "No specific instructions provided for this context."; }
      const helperPlaceholderRegex = /{{HELPER_RANDOM_LINE:([a-zA-Z0-9_]+)}}/g; let match;
      while ((match = helperPlaceholderRegex.exec(themeSpecificInstructions)) !== null) {
        const fullPlaceholder = match[0]; const helperKey = match[1];
        let helperFileContent = null;
        const langSpecificHelperKey = `${helperKey}_${currentNarrativeLanguage}`; const fallbackHelperKey = `${helperKey}_en`;
        if (gamePrompts[currentTheme] && isValidPromptText(gamePrompts[currentTheme][langSpecificHelperKey])) { helperFileContent = gamePrompts[currentTheme][langSpecificHelperKey]; }
        else if (gamePrompts[currentTheme] && isValidPromptText(gamePrompts[currentTheme][fallbackHelperKey])) { helperFileContent = gamePrompts[currentTheme][fallbackHelperKey]; }
        else if (gamePrompts[DEFAULT_THEME_ID] && isValidPromptText(gamePrompts[DEFAULT_THEME_ID][langSpecificHelperKey])) { helperFileContent = gamePrompts[DEFAULT_THEME_ID][langSpecificHelperKey]; }
        else if (gamePrompts[DEFAULT_THEME_ID] && isValidPromptText(gamePrompts[DEFAULT_THEME_ID][fallbackHelperKey])) { helperFileContent = gamePrompts[DEFAULT_THEME_ID][fallbackHelperKey]; }
        let replacementText = `(dynamic value for ${helperKey} not found)`;
        if (helperFileContent) {
          const lines = helperFileContent.split("\n").map(s => s.trim()).filter(s => s.length > 0);
          if (lines.length > 0) { replacementText = lines[Math.floor(Math.random() * lines.length)]; }
          else { replacementText = `(no valid lines in ${helperKey} helper file)`; }
        }
        themeSpecificInstructions = themeSpecificInstructions.replace(fullPlaceholder, replacementText); helperPlaceholderRegex.lastIndex = 0;
      }
    }
    const narrativeLangInstruction = NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[currentTheme]?.[currentNarrativeLanguage] || NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[DEFAULT_THEME_ID]?.[currentNarrativeLanguage] || NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[DEFAULT_THEME_ID]?.[DEFAULT_LANGUAGE] || `The narrative must be in ${currentNarrativeLanguage.toUpperCase()}.`;
    let processedPromptText = basePromptText;
    processedPromptText = processedPromptText.replace(/\$\{narrativeLanguageInstruction\}/g, narrativeLangInstruction);
    processedPromptText = processedPromptText.replace(/\$\{currentNameForPrompt\}/g, currentPlayerIdentifierParam || getUIText("unknown"));
    processedPromptText = processedPromptText.replace(/\$\{currentPlayerIdentifier\}/g, currentPlayerIdentifierParam || getUIText("unknown"));
    processedPromptText = processedPromptText.replace(/\$\{currentNarrativeLanguage\.toUpperCase\(\)\}/g, currentNarrativeLanguage.toUpperCase());
    processedPromptText = processedPromptText.replace(/\$\{theme_name\}/g, getUIText(themeConfig.name_key, {}, currentTheme));
    processedPromptText = processedPromptText.replace(/\$\{theme_lore\}/g, getUIText(themeConfig.lore_key, {}, currentTheme));
    processedPromptText = processedPromptText.replace(/\$\{theme_category\}/g, getUIText(themeConfig.category_key || `theme_category_${currentTheme}`, {}, currentTheme));
    processedPromptText = processedPromptText.replace(/\$\{theme_style\}/g, getUIText(themeConfig.style_key || `theme_style_${currentTheme}`, {}, currentTheme));
    processedPromptText = processedPromptText.replace(/\$\{theme_tone\}/g, getUIText(themeConfig.tone_key, {}, currentTheme));
    processedPromptText = processedPromptText.replace(/\$\{theme_inspiration\}/g, getUIText(themeConfig.inspiration_key, {}, currentTheme));
    processedPromptText = processedPromptText.replace(/\$\{theme_concept\}/g, getUIText(themeConfig.concept_key, {}, currentTheme));
    processedPromptText = processedPromptText.replace(/\$\{theme_specific_instructions\}/g, themeSpecificInstructions);
    processedPromptText = processedPromptText.replace(/\$\{generated_dashboard_description\}/g, generatedDashboardDescription);
    processedPromptText = processedPromptText.replace(/\$\{generated_game_state_indicators\}/g, generatedGameStateIndicators);
    if (promptTypeToUse === "initial" || basePromptKey === "master_initial") {
      if (gamePrompts[currentTheme]?.starts && isValidPromptText(gamePrompts[currentTheme].starts)) {
        const allStarts = gamePrompts[currentTheme].starts.split("\n").map(s => s.trim()).filter(s => s.length > 0);
        const selectedStarts = allStarts.length > 0 ? [...allStarts].sort(() => 0.5 - Math.random()).slice(0, 3) : [];
        ["startIdea1", "startIdea2", "startIdea3"].forEach((placeholder, i) => {
          processedPromptText = processedPromptText.replace(new RegExp(`\\$\\{${placeholder}\\}`, "g"), selectedStarts[i] || `Generic ${getUIText(themeConfig.name_key, {}, currentTheme)} scenario ${i + 1}`);
        });
      }
      let assetNamesContent = null;
      const assetKey = `asset_names_${currentNarrativeLanguage}`; const entityKey = `entity_names_${currentNarrativeLanguage}`;
      const fallbackAssetKey = "asset_names_en"; const fallbackEntityKey = "entity_names_en";
      if (themeConfig.naming_convention === "entity" && gamePrompts[currentTheme]?.[entityKey] && isValidPromptText(gamePrompts[currentTheme][entityKey])) { assetNamesContent = gamePrompts[currentTheme][entityKey]; }
      else if (themeConfig.naming_convention === "asset" && gamePrompts[currentTheme]?.[assetKey] && isValidPromptText(gamePrompts[currentTheme][assetKey])) { assetNamesContent = gamePrompts[currentTheme][assetKey]; }
      else {
        if (gamePrompts[currentTheme]?.[assetKey] && isValidPromptText(gamePrompts[currentTheme][assetKey])) assetNamesContent = gamePrompts[currentTheme][assetKey];
        else if (gamePrompts[currentTheme]?.[entityKey] && isValidPromptText(gamePrompts[currentTheme][entityKey])) assetNamesContent = gamePrompts[currentTheme][entityKey];
        else if (gamePrompts[currentTheme]?.[fallbackAssetKey] && isValidPromptText(gamePrompts[currentTheme][fallbackAssetKey])) assetNamesContent = gamePrompts[currentTheme][fallbackAssetKey];
        else if (gamePrompts[currentTheme]?.[fallbackEntityKey] && isValidPromptText(gamePrompts[currentTheme][fallbackEntityKey])) assetNamesContent = gamePrompts[currentTheme][fallbackEntityKey];
      }
      if (assetNamesContent) {
        const allAssets = assetNamesContent.split("\n").map(n => n.trim()).filter(n => n.length > 0);
        const selectedAssets = allAssets.length > 0 ? [...allAssets].sort(() => 0.5 - Math.random()).slice(0, 3) : [];
        ["suggestedName1", "suggestedName2", "suggestedName3", "suggestedItemName1", "suggestedItemName2", "suggestedItemName3", "suggestedLocationName1", "suggestedLocationName2", "suggestedLocationName3"].forEach((ph, iMod) => {
          const i = iMod % 3; processedPromptText = processedPromptText.replace(new RegExp(`\\$\\{${ph}\\}`, "g"), selectedAssets[i] || `Invented${ph.replace("suggested", "").replace(/Name\d/, "Name")}${i + 1}`);
        });
        if (themeConfig.naming_convention === "asset" || currentTheme === "grim_warden") {
          ["suggestedShipName1", "suggestedShipName2", "suggestedShipName3"].forEach((ph, iMod) => {
            const i = iMod % 3; processedPromptText = processedPromptText.replace(new RegExp(`\\$\\{${ph}\\}`, "g"), selectedAssets[i] || `DefaultAssetName${i + 1}`);
          });
        }
      } else {
        ["suggestedName1", "suggestedName2", "suggestedName3", "suggestedShipName1", "suggestedShipName2", "suggestedShipName3", "suggestedItemName1", "suggestedItemName2", "suggestedItemName3", "suggestedLocationName1", "suggestedLocationName2", "suggestedLocationName3"].forEach((ph, i) => {
          processedPromptText = processedPromptText.replace(new RegExp(`\\$\\{${ph}\\}`, "g"), `InventedPlaceholder${i + 1}`);
        });
      }
    }
    return processedPromptText;
  };

  /**
   * Helper function for making API calls to the backend.
   */
  async function _callApi(url, method = 'GET', body = null, token = null) {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      method,
      headers,
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      config.body = JSON.stringify(body);
    }

    log(LOG_LEVEL_DEBUG, `Calling API: ${method} ${url}`, body ? `with body (first 200 chars): ${JSON.stringify(body).substring(0,200)}...` : 'without body');

    // Placeholder for UI loading indicator - activate before fetch
    // showGlobalLoadingIndicator(true, `API: ${method} ${url.split('/').pop()}`);

    try {
      const response = await fetch(url, config);

      if (response.status === 204 && (method === 'DELETE' || method === 'PUT' /* if PUT might return 204 */)) {
        log(LOG_LEVEL_INFO, `API call ${method} ${url} successful with 204 No Content.`);
        // showGlobalLoadingIndicator(false);
        return { success: true, status: response.status };
      }

      const responseData = await response.json();

      if (!response.ok) {
        const errorMessage = responseData.error?.message || `API Error: ${response.status}`;
        const errorCode = responseData.error?.code || `HTTP_${response.status}`;
        log(LOG_LEVEL_WARN, `API Error (${response.status} ${errorCode}) for ${method} ${url}: ${errorMessage}`, responseData.error?.details || responseData);
        const error = new Error(errorMessage);
        error.status = response.status;
        error.code = errorCode;
        error.details = responseData.error?.details || responseData;
        throw error;
      }
      log(LOG_LEVEL_DEBUG, `API call ${method} ${url} successful. Status: ${response.status}.`);
      // showGlobalLoadingIndicator(false);
      return responseData;
    } catch (error) {
      // showGlobalLoadingIndicator(false);
      if (error.status) { // Error we constructed and threw from non-ok response
        throw error;
      }
      // Network error or fetch/JSON parsing related error before our custom error
      log(LOG_LEVEL_ERROR, `Network or unexpected error in _callApi for ${method} ${url}:`, error.message, error);
      const networkError = new Error(`Network error or server unavailable: ${error.message}`);
      networkError.isNetworkError = true;
      networkError.code = 'NETWORK_ERROR';
      throw networkError;
    }
  }

  /**
   * Toggles UI elements to indicate AI processing status.
   */
  function setGMActivity(isProcessing) {
    if (gmSpecificActivityIndicator) gmSpecificActivityIndicator.style.display = isProcessing ? "inline-flex" : "none";
    if (systemStatusIndicator) systemStatusIndicator.style.display = isProcessing ? "none" : "inline-flex";
    if (playerActionInput) playerActionInput.disabled = isProcessing;
    if (sendActionButton) sendActionButton.disabled = isProcessing;
    document.querySelectorAll("#suggested-actions-wrapper .ui-button").forEach(btn => btn.disabled = isProcessing);
    if (!isProcessing && actionInputSection?.style.display !== "none" && playerActionInput && document.body.contains(playerActionInput)) { playerActionInput.focus(); }
  }

  /**
   * Briefly highlights a UI element container and adds a persistent update class.
   */
  function highlightElementUpdate(element) {
    if (!element) return;
    let textValueElement = null; let containerForIndicatorCheck = null;
    if (element.classList.contains("value") || element.classList.contains("value-overlay")) {
      textValueElement = element; const container = element.closest('.info-item, .info-item-meter');
      if (container) { container.classList.add('has-recent-update'); containerForIndicatorCheck = container; }
    } else if (element.classList.contains("info-item") || element.classList.contains("info-item-meter")) {
      textValueElement = element.querySelector(".value, .value-overlay"); element.classList.add('has-recent-update'); containerForIndicatorCheck = element;
    }
    if (textValueElement) {
      textValueElement.classList.add("value-updated");
      setTimeout(() => { if (document.body.contains(textValueElement)) textValueElement.classList.remove("value-updated"); }, UPDATE_HIGHLIGHT_DURATION);
    }
    if (containerForIndicatorCheck) checkAndTriggerScrollIndicator(containerForIndicatorCheck);
  }

  /**
   * Adds a message to the story log.
   */
  function addMessageToLog(text, sender) {
    if (!storyLog) { log(LOG_LEVEL_DEBUG, `Message (${sender}): ${text} (storyLog element not found)`); return; }
    if (sender === "player" && gameHistory.length > 0 && gameHistory[0].role === "user" && text === gameHistory[0].parts[0].text && text.startsWith(`My identifier is`)) return;
    const msgDiv = document.createElement("div"); msgDiv.classList.add("message", `${sender}-message`);
    const processedText = text.replace(/_([^_]+)_|\*([^*]+)\*/g, (match, p1, p2) => `<em>${p1 || p2}</em>`);
    const paragraphs = processedText.split(/\n\s*\n/).filter(p => p.trim() !== "");
    if (paragraphs.length === 0 && processedText.trim() !== "") paragraphs.push(processedText.trim());
    paragraphs.forEach(para => { const pElement = document.createElement("p"); pElement.innerHTML = para.replace(/\n/g, "<br>"); msgDiv.appendChild(pElement); });
    const viewport = storyLog.parentElement; let shouldScroll = false;
    if (viewport && storyLogViewport.style.display !== "none") {
      if (!userHasManuallyScrolledLog) { shouldScroll = true; }
      else { if (viewport.scrollHeight - viewport.clientHeight <= viewport.scrollTop + AUTOSCROLL_THRESHOLD) { shouldScroll = true; userHasManuallyScrolledLog = false; } }
    }
    storyLog.appendChild(msgDiv); if (shouldScroll && viewport) viewport.scrollTop = viewport.scrollHeight;
  }

  /**
   * Displays AI-suggested actions as clickable buttons.
   */
  function displaySuggestedActions(actions) {
    if (!suggestedActionsWrapper || suggestedActionsWrapper.style.display === "none") {
      currentSuggestedActions = actions && Array.isArray(actions) ? actions.slice(0, 3) : []; return;
    }
    suggestedActionsWrapper.innerHTML = ""; currentSuggestedActions = [];
    if (actions && Array.isArray(actions) && actions.length > 0) {
      actions.slice(0, 3).forEach(actionTxt => {
        if (typeof actionTxt === "string" && actionTxt.trim() !== "") {
          const btn = document.createElement("button"); btn.classList.add("ui-button"); btn.textContent = actionTxt;
          btn.addEventListener("click", () => {
            if (playerActionInput) {
              playerActionInput.value = actionTxt; playerActionInput.focus();
              playerActionInput.dispatchEvent(new Event("input", { bubbles: true })); autoGrowTextarea(playerActionInput);
            }
          });
          suggestedActionsWrapper.appendChild(btn); currentSuggestedActions.push(actionTxt);
        }
      });
    }
  }

  /**
   * Clears any displayed suggested actions.
   */
  function clearSuggestedActions() { if (suggestedActionsWrapper) suggestedActionsWrapper.innerHTML = ""; }

  /**
   * Updates a UI meter element (progress bar and text).
   */
  const setMeter = (barEl, textEl, newPctStr, meterType, opts = {}) => {
    const { highlight = true, newStatusText, initialPlaceholder } = opts;
    let updatedOccurred = false;

    if (!barEl) {
      if (textEl && newPctStr !== undefined && newPctStr !== null) {
        const na = getUIText("not_available_short"), unk = getUIText("unknown");
        const newContent = (newPctStr === "---" || newPctStr === na || String(newPctStr).toLowerCase() === unk.toLowerCase()) ? newPctStr : `${parseInt(newPctStr, 10)}%`;
        if (textEl.textContent !== newContent) { textEl.textContent = newContent; updatedOccurred = true; }
      }
      if (updatedOccurred && highlight) { const container = textEl ? textEl.closest('.info-item, .info-item-meter') : null; if (container) { highlightElementUpdate(container); } }
      return updatedOccurred;
    }

    let finalPct = -1;
    if (newPctStr !== undefined && newPctStr !== null) {
      let parsedPct = parseInt(newPctStr, 10);
      if (!isNaN(parsedPct)) { finalPct = Math.max(0, Math.min(100, parsedPct)); }
      else {
        const na = getUIText("not_available_short"), unk = getUIText("unknown");
        if (textEl && (newPctStr === "---" || newPctStr === na || String(newPctStr).toLowerCase() === unk.toLowerCase())) {
          if (textEl.textContent !== newPctStr) { textEl.textContent = newPctStr; updatedOccurred = true; }
          if (barEl.style.width !== "0%") { barEl.style.width = "0%"; updatedOccurred = true; }
          const oldClasses = Array.from(barEl.classList).filter(c => c.startsWith("meter-"));
          if (oldClasses.length > 0) updatedOccurred = true;
          oldClasses.forEach(c => barEl.classList.remove(c));
          if (updatedOccurred && highlight) { const container = textEl.closest('.info-item, .info-item-meter') || barEl.closest('.info-item, .info-item-meter'); if (container) highlightElementUpdate(container); }
          return updatedOccurred;
        }
        finalPct = (meterType === "shields" || meterType === "enemy_shields" || meterType === "mana") ? 0 : 100;
      }
    } else {
      if (textEl) { const match = textEl.textContent.match(/(\d+)%/); if (match) finalPct = parseInt(match[1], 10); }
      if (finalPct === -1) {
        const placeholderMatch = initialPlaceholder ? initialPlaceholder.match(/(\d+)%/) : null;
        finalPct = placeholderMatch ? parseInt(placeholderMatch[1], 10) : (meterType === "shields" || meterType === "enemy_shields" || meterType === "mana") ? 0 : 100;
      }
    }
    finalPct = Math.max(0, Math.min(100, finalPct));

    let finalStatusTxt = null;
    if (meterType === "shields" || meterType === "enemy_shields") {
      if (newStatusText !== undefined && newStatusText !== null) { finalStatusTxt = newStatusText; }
      else {
        let currentDomStatus = null;
        if (textEl) { const match = textEl.textContent.match(/^(.*?):\s*(\d+)%/); if (match && match[1]) currentDomStatus = match[1].trim(); }
        finalStatusTxt = currentDomStatus || (finalPct > 0 ? getUIText("online") : getUIText("offline"));
      }
      if (finalPct === 0) finalStatusTxt = getUIText("offline");
      else if (finalStatusTxt && finalStatusTxt.toLowerCase() === getUIText("offline").toLowerCase()) finalStatusTxt = getUIText("online");
    } else if ((meterType === "mana" || meterType === "stamina") && newStatusText !== undefined && newStatusText !== null) {
      finalStatusTxt = newStatusText;
    }

    let newDisplayText = "";
    if (meterType === "shields" || meterType === "enemy_shields") { newDisplayText = `${finalStatusTxt || getUIText("unknown")}: ${finalPct}%`; }
    else if ((meterType === "mana" || meterType === "stamina") && finalStatusTxt && finalStatusTxt.toLowerCase() !== getUIText("unknown").toLowerCase()) { newDisplayText = `${finalStatusTxt}: ${finalPct}%`; }
    else { newDisplayText = `${finalPct}%`; }

    let newBarClasses = [];
    const isOffline = (meterType === "shields" || meterType === "enemy_shields") && finalStatusTxt && finalStatusTxt.toLowerCase() === getUIText("offline").toLowerCase();
    if (isOffline) { newBarClasses.push("meter-offline"); }
    else {
      if (finalPct === 0 && !isOffline) newBarClasses.push("meter-critical");
      else if (finalPct > 0 && finalPct <= 10) newBarClasses.push("meter-critical");
      else if (finalPct > 10 && finalPct <= 25) newBarClasses.push("meter-low");
      else if (finalPct > 25 && finalPct <= 50) newBarClasses.push("meter-medium");
      else {
        newBarClasses.push("meter-full");
        if (meterType === "shields" || meterType === "enemy_shields") newBarClasses.push("meter-ok-shield");
        else if (meterType === "fuel") newBarClasses.push("meter-ok-fuel");
        else if (meterType === "stamina") newBarClasses.push("meter-ok-stamina");
        else if (meterType === "mana") newBarClasses.push("meter-ok-mana");
      }
    }

    if (textEl && textEl.textContent !== newDisplayText) { textEl.textContent = newDisplayText; updatedOccurred = true; }
    if (barEl.style.width !== `${finalPct}%`) { barEl.style.width = `${finalPct}%`; updatedOccurred = true; }

    const existingClasses = Array.from(barEl.classList).filter(cls => cls.startsWith("meter-"));
    let classesDiffer = newBarClasses.length !== existingClasses.length || !newBarClasses.every(cls => existingClasses.includes(cls));
    if (classesDiffer) {
      existingClasses.forEach(cls => { if (cls !== "meter-bar") barEl.classList.remove(cls); });
      if (!barEl.classList.contains("meter-bar")) barEl.classList.add("meter-bar");
      newBarClasses.forEach(cls => { if (cls && cls.trim() !== "" && cls !== "meter-bar") barEl.classList.add(cls); });
      updatedOccurred = true;
    } else if (!barEl.classList.contains("meter-bar")) { barEl.classList.add("meter-bar"); }

    if (updatedOccurred && highlight) {
      const containerToHighlight = textEl ? textEl.closest(".info-item, .info-item-meter") : barEl.closest(".info-item, .info-item-meter");
      if (containerToHighlight) { highlightElementUpdate(containerToHighlight); }
    }
    return updatedOccurred;
  };

  /**
   * Finds the parent panel configuration for a given dashboard item ID.
   */
  function getParentPanelConfig(itemId, dashboardConfig) {
    if (!dashboardConfig) return null;
    for (const panelSideKey of ["left_panel", "right_panel"]) {
      if (dashboardConfig[panelSideKey]) {
        for (const panelConfig of dashboardConfig[panelSideKey]) {
          if (panelConfig.items && panelConfig.items.some((item) => item.id === itemId)) { return panelConfig; }
        }
      }
    }
    return null;
  }

  /**
   * Updates the dashboard UI elements based on data from the AI.
   */
  function updateDashboard(updatesFromAI, highlightChanges = true) {
    if (!updatesFromAI || Object.keys(updatesFromAI).length === 0 || !currentTheme) return;
    const currentThemeFullConfig = ALL_THEMES_CONFIG[currentTheme];
    if (!currentThemeFullConfig || !currentThemeFullConfig.dashboard_config) { log(LOG_LEVEL_ERROR, "Dashboard configuration missing for current theme:", currentTheme); return; }
    const themeCfg = currentThemeFullConfig.dashboard_config;
    const allItems = [...(themeCfg.left_panel || []).flatMap(b => b.items), ...(themeCfg.right_panel || []).flatMap(b => b.items)];
    const itemConfigsMap = new Map(allItems.map(i => [i.id, i]));

    for (const key in updatesFromAI) {
      if (Object.prototype.hasOwnProperty.call(updatesFromAI, key)) {
        const value = updatesFromAI[key];
        let itemCfg = itemConfigsMap.get(key);
        let actualUpdateOccurred = false;
        const activePlayerIdentifier = currentUser ? currentUser.email : playerIdentifier;

        if (key === "name" || key === "character_name") {
          const playerIdentifierItemId = (themeCfg.left_panel || []).flatMap(p => p.items).find(i => i.id === "name" || i.id === "character_name")?.id;
          if (key === playerIdentifierItemId) {
            itemCfg = itemConfigsMap.get(playerIdentifierItemId);

            if (itemCfg && !currentUser && activePlayerIdentifier !== String(value)) {
              playerIdentifier = String(value);
            }
          } else if (!itemCfg && playerIdentifierItemId) {
            itemCfg = itemConfigsMap.get(playerIdentifierItemId);
            if (itemCfg && !currentUser && activePlayerIdentifier !== String(value)) {
              playerIdentifier = String(value);
            }
          }
        }

        if (!itemCfg) continue;
        const valueElement = document.getElementById(`info-${itemCfg.id}`);
        const meterBarElement = document.getElementById(`meter-${itemCfg.id}`);
        const itemContainer = valueElement ? valueElement.closest(".info-item, .info-item-meter") : meterBarElement ? meterBarElement.closest(".info-item, .info-item-meter") : null;

        if (itemCfg.type === "meter") {
          if (valueElement || meterBarElement) {
            actualUpdateOccurred = setMeter(meterBarElement, valueElement, String(value), itemCfg.meter_type, { highlight: highlightChanges, newStatusText: itemCfg.status_text_id ? updatesFromAI[itemCfg.status_text_id] : undefined, });
          }
        } else if (itemCfg.type === "status_level") {
          if (valueElement && itemCfg.level_mappings) {
            const aiValueStr = String(value); const levelConfig = itemCfg.level_mappings[aiValueStr];
            if (levelConfig) {
              const newDisplayText = getUIText(levelConfig.display_text_key, {}, currentTheme); const newCssClass = levelConfig.css_class || "status-info";
              if (valueElement.textContent !== newDisplayText || !valueElement.className.includes(newCssClass)) {
                valueElement.textContent = newDisplayText; valueElement.className = `value ${newCssClass}`; if (itemContainer && highlightChanges) highlightElementUpdate(itemContainer); actualUpdateOccurred = true;
              }
            } else {
              log(LOG_LEVEL_WARN, `No level mapping for AI value "${aiValueStr}" for item "${itemCfg.id}". Using default.`);
              const defaultLevelConfig = itemCfg.level_mappings[String(itemCfg.default_ai_value || 1)] || { display_text_key: "unknown", css_class: "status-info" };
              const fallbackDisplayText = getUIText(defaultLevelConfig.display_text_key, {}, currentTheme);
              if (valueElement.textContent !== fallbackDisplayText || !valueElement.className.includes(defaultLevelConfig.css_class)) {
                valueElement.textContent = fallbackDisplayText; valueElement.className = `value ${defaultLevelConfig.css_class}`; if (itemContainer && highlightChanges) highlightElementUpdate(itemContainer); actualUpdateOccurred = true;
              }
            }
          }
        } else if (itemCfg.type === "status_text") {
          if (valueElement) {
            const newStatusText = String(value); let statusClass = itemCfg.default_css_class || "status-info";
            if (valueElement.textContent !== newStatusText || !valueElement.className.includes(statusClass)) {
              valueElement.textContent = newStatusText; valueElement.className = `value ${statusClass}`; if (itemContainer && highlightChanges) highlightElementUpdate(itemContainer); actualUpdateOccurred = true;
            }
          }
        } else {
          if (valueElement) {
            const suffix = itemCfg.suffix || "";

            const displayValue = (itemCfg.id === "name" || itemCfg.id === "character_name") && activePlayerIdentifier ? activePlayerIdentifier : value;
            const newValueText = `${displayValue}${suffix}`;
            if (valueElement.textContent !== newValueText) {
              valueElement.textContent = newValueText; if (itemContainer && highlightChanges) highlightElementUpdate(itemContainer); actualUpdateOccurred = true;
            }
          }
        }
        if (actualUpdateOccurred) {
          const parentPanelConfig = getParentPanelConfig(itemCfg.id, themeCfg);
          if (parentPanelConfig && parentPanelConfig.type === "collapsible") {
            const panelElement = document.getElementById(parentPanelConfig.id);
            if (panelElement && !panelElement.classList.contains("is-expanded")) { animatePanelBox(parentPanelConfig.id, true, false); }
          }
        }
      }
    }
    lastKnownDashboardUpdates = { ...lastKnownDashboardUpdates, ...updatesFromAI, };
  }

  /**
   * Initializes dashboard elements with their default texts and values.
   */
  function initializeDashboardDefaultTexts() {
    if (!currentTheme) return;
    const currentThemeFullConfig = ALL_THEMES_CONFIG[currentTheme];
    if (!currentThemeFullConfig || !currentThemeFullConfig.dashboard_config) { log(LOG_LEVEL_ERROR, "Dashboard config missing for default texts:", currentTheme); return; }
    const themeCfg = currentThemeFullConfig.dashboard_config;
    ["left_panel", "right_panel"].forEach(sideKey => {
      if (!themeCfg[sideKey]) return;
      themeCfg[sideKey].forEach(boxCfg => {
        boxCfg.items.forEach(itemCfg => {
          const valueEl = document.getElementById(`info-${itemCfg.id}`);
          const meterBarEl = document.getElementById(`meter-${itemCfg.id}`);
          let defaultValueText = itemCfg.default_value !== undefined ? String(itemCfg.default_value) : (itemCfg.default_value_key ? getUIText(itemCfg.default_value_key, {}, currentTheme) : getUIText("unknown"));
          if (itemCfg.type === "meter") {
            if (valueEl || meterBarEl) {
              const defaultStatus = itemCfg.default_status_key ? getUIText(itemCfg.default_status_key, {}, currentTheme) : getUIText("offline");
              setMeter(meterBarEl, valueEl, defaultValueText, itemCfg.meter_type, { highlight: false, newStatusText: defaultStatus, initialPlaceholder: `${defaultStatus}: ${defaultValueText}%`, });
            }
          } else if (itemCfg.type === "status_level") {
            if (valueEl && itemCfg.level_mappings && itemCfg.default_ai_value !== undefined) {
              const defaultAiValueStr = String(itemCfg.default_ai_value); const levelConfig = itemCfg.level_mappings[defaultAiValueStr] || itemCfg.level_mappings["1"];
              if (levelConfig) {
                const displayDefaultText = getUIText(levelConfig.display_text_key, {}, currentTheme); const cssClassDefault = levelConfig.css_class || "status-info";
                valueEl.textContent = displayDefaultText; valueEl.className = `value ${cssClassDefault}`;
              } else { valueEl.textContent = getUIText("unknown"); valueEl.className = "value status-info"; }
            } else if (valueEl) { valueEl.textContent = getUIText("unknown"); valueEl.className = "value status-info"; }
          } else if (itemCfg.type === "status_text") {
            if (valueEl) {
              const displayDefault = itemCfg.default_value_key ? getUIText(itemCfg.default_value_key, {}, currentTheme) : getUIText("unknown");
              valueEl.textContent = displayDefault; let statusClass = itemCfg.default_css_class || "status-info"; valueEl.className = `value ${statusClass}`;
            }
          } else {
            if (valueEl) { const suffix = itemCfg.suffix || ""; valueEl.textContent = `${defaultValueText}${suffix}`; }
          }
        });
      });
    });
    const playerIdentifierItemId = (themeCfg.left_panel || []).flatMap(p => p.items).find(item => item.id === "name" || item.id === "character_name")?.id;
    if (playerIdentifierItemId) {
      const idCfg = findItemConfigById(themeCfg, playerIdentifierItemId);
      if (idCfg) {
        const el = document.getElementById(`info-${idCfg.id}`);

        if (el) el.textContent = playerIdentifier || getUIText(idCfg.default_value_key, {}, currentTheme) || getUIText("unknown");
      }
    }
  }

  /**
   * Finds a specific item's configuration within the theme's dashboard structure.
   */
  function findItemConfigById(themeDashCfg, itemId) {
    if (!themeDashCfg) return null;
    for (const sideKey of ["left_panel", "right_panel"]) {
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
   */
  function autoGrowTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = "auto"; let newHeight = textarea.scrollHeight;
    const maxHeight = parseInt(window.getComputedStyle(textarea).maxHeight, 10) || Infinity;
    if (newHeight > maxHeight) { newHeight = maxHeight; textarea.style.overflowY = "auto"; }
    else { textarea.style.overflowY = "hidden"; }
    textarea.style.height = newHeight + "px";
  }

  /**
   * Updates scroll indicators for a panel.
   */
  function updateScrollIndicatorStateForPanel(panelSide, panelElement) {
    if (!panelElement || document.body.classList.contains("landing-page-active")) {
      const indicatorsToHide = panelSide === 'left' ? [leftPanelScrollUp, leftPanelScrollDown] : [rightPanelScrollUp, rightPanelScrollDown];
      indicatorsToHide.forEach(ind => { if (ind) ind.style.display = 'none'; });
      return;
    }
    const indicators = { up: panelSide === 'left' ? leftPanelScrollUp : rightPanelScrollUp, down: panelSide === 'left' ? leftPanelScrollDown : rightPanelScrollDown, };
    if (!indicators.up || !indicators.down) return;
    const sidebarRect = panelElement.getBoundingClientRect();
    let needsUpIndicator = false; let needsDownIndicator = false;
    const upTrackedIdsCopy = new Set(outOfViewTrackedElements[panelSide].up);
    for (const elementId of upTrackedIdsCopy) {
      const el = document.getElementById(elementId);
      if (el && panelElement.contains(el)) {
        const elRect = el.getBoundingClientRect();
        if (elRect.top < sidebarRect.top - SCROLL_INDICATOR_TOLERANCE) { needsUpIndicator = true; }
        else { outOfViewTrackedElements[panelSide].up.delete(elementId); }
      } else { outOfViewTrackedElements[panelSide].up.delete(elementId); }
    }
    const downTrackedIdsCopy = new Set(outOfViewTrackedElements[panelSide].down);
    for (const elementId of downTrackedIdsCopy) {
      const el = document.getElementById(elementId);
      if (el && panelElement.contains(el)) {
        const elRect = el.getBoundingClientRect();
        if (elRect.bottom > sidebarRect.bottom + SCROLL_INDICATOR_TOLERANCE) { needsDownIndicator = true; }
        else { outOfViewTrackedElements[panelSide].down.delete(elementId); }
      } else { outOfViewTrackedElements[panelSide].down.delete(elementId); }
    }
    indicators.up.style.display = needsUpIndicator ? 'flex' : 'none';
    indicators.down.style.display = needsDownIndicator ? 'flex' : 'none';
  }

  /**
   * Checks if an element is out of view in its parent sidebar and triggers scroll indicators.
   */
  function checkAndTriggerScrollIndicator(elementToCheck) {
    if (!elementToCheck || !elementToCheck.id) { return; }
    const parentSidebar = elementToCheck.closest('.panel-sidebar');
    if (!parentSidebar || (parentSidebar.id !== 'left-panel' && parentSidebar.id !== 'right-panel') || document.body.classList.contains("landing-page-active")) { return; }
    let parentPanelBox;
    if (elementToCheck.classList.contains('panel-box')) { parentPanelBox = elementToCheck; }
    else { parentPanelBox = elementToCheck.closest('.panel-box'); }
    if (!parentPanelBox || !parentPanelBox.classList.contains('is-expanded')) {
      const panelSideStr = parentSidebar.id === 'left-panel' ? 'left' : 'right';
      let changedInTracking = false;
      if (outOfViewTrackedElements[panelSideStr].up.has(elementToCheck.id)) { outOfViewTrackedElements[panelSideStr].up.delete(elementToCheck.id); changedInTracking = true; }
      if (outOfViewTrackedElements[panelSideStr].down.has(elementToCheck.id)) { outOfViewTrackedElements[panelSideStr].down.delete(elementToCheck.id); changedInTracking = true; }
      if (changedInTracking) { updateScrollIndicatorStateForPanel(panelSideStr, parentSidebar); }
      return;
    }
    requestAnimationFrame(() => {
      const panelSideStr = parentSidebar.id === 'left-panel' ? 'left' : 'right';
      const sidebarRect = parentSidebar.getBoundingClientRect(); const elRect = elementToCheck.getBoundingClientRect();
      let changedInTracking = false;
      const isOutOfViewUpwards = elRect.top < sidebarRect.top - SCROLL_INDICATOR_TOLERANCE;
      if (isOutOfViewUpwards) { if (!outOfViewTrackedElements[panelSideStr].up.has(elementToCheck.id)) { outOfViewTrackedElements[panelSideStr].up.add(elementToCheck.id); changedInTracking = true; } }
      else { if (outOfViewTrackedElements[panelSideStr].up.has(elementToCheck.id)) { outOfViewTrackedElements[panelSideStr].up.delete(elementToCheck.id); changedInTracking = true; } }
      const isOutOfViewDownwards = elRect.bottom > sidebarRect.bottom + SCROLL_INDICATOR_TOLERANCE;
      if (isOutOfViewDownwards) { if (!outOfViewTrackedElements[panelSideStr].down.has(elementToCheck.id)) { outOfViewTrackedElements[panelSideStr].down.add(elementToCheck.id); changedInTracking = true; } }
      else { if (outOfViewTrackedElements[panelSideStr].down.has(elementToCheck.id)) { outOfViewTrackedElements[panelSideStr].down.delete(elementToCheck.id); changedInTracking = true; } }
      if (changedInTracking) { updateScrollIndicatorStateForPanel(panelSideStr, parentSidebar); }
    });
  }

  /**
   * Animates the expansion or collapse of a panel box.
   */
  function animatePanelBox(boxId, shouldExpand, manageVisibility = false, isRestoringState = false) {
    const box = document.getElementById(boxId); if (!box) return;
    const header = box.querySelector(".panel-box-header"); const content = box.querySelector(".panel-box-content");
    if (!header || !content) return;
    if (shouldExpand) {
      if (box.style.display === "none" && manageVisibility) { box.style.opacity = "0"; box.style.display = "flex"; }
      else if (box.style.display === "none") { box.style.display = "flex"; }
      requestAnimationFrame(() => {
        box.classList.add("is-expanded"); if (manageVisibility) box.style.opacity = "1";
        header.setAttribute("aria-expanded", "true"); content.setAttribute("aria-hidden", "false");
        if (!isRestoringState) {
          const infoItems = box.querySelectorAll('.info-item, .info-item-meter');
          infoItems.forEach(itemContainer => {
            const itemId = itemContainer.id.replace('info-item-container-', '');
            if (Object.prototype.hasOwnProperty.call(lastKnownDashboardUpdates, itemId)) {
              const hadClass = itemContainer.classList.contains('has-recent-update');
              if (hadClass) itemContainer.classList.remove('has-recent-update');
              itemContainer.classList.add('has-recent-update');
            }
          });
        }
        checkAndTriggerScrollIndicator(box);
      });
    } else {
      box.classList.remove("is-expanded"); header.setAttribute("aria-expanded", "false"); content.setAttribute("aria-hidden", "true");
      if (manageVisibility) {
        box.style.opacity = "0";
        const transitionDuration = parseFloat(getComputedStyle(content).transitionDuration.replace("s", "")) * 1000 || 300;
        const onHideTransitionEnd = (event) => {
          if (event.target === content || event.target === box) {
            if (!box.classList.contains("is-expanded")) { box.style.display = "none"; content.style.display = ""; }
            content.removeEventListener("transitionend", onHideTransitionEnd); box.removeEventListener("transitionend", onHideTransitionEnd);
          }
        };
        content.addEventListener("transitionend", onHideTransitionEnd); box.addEventListener("transitionend", onHideTransitionEnd);
        setTimeout(() => { if (!box.classList.contains("is-expanded") && box.style.opacity === "0") { box.style.display = "none"; content.style.display = ""; } }, transitionDuration + 100);
      }
    }
    if (!isRestoringState) { currentPanelStates[boxId] = shouldExpand; }
  }

  /**
   * Initializes collapsible panel boxes for a given theme.
   */
  function initializeCollapsiblePanelBoxes(themeIdForPanels) {
    const themeFullConfig = ALL_THEMES_CONFIG[themeIdForPanels];
    if (!themeFullConfig || !themeFullConfig.dashboard_config) { log(LOG_LEVEL_ERROR, "Dashboard config missing for panel boxes:", themeIdForPanels); return; }
    const themeCfg = themeFullConfig.dashboard_config;
    const allPanelConfigs = [...(themeCfg.left_panel || []), ...(themeCfg.right_panel || [])];
    const hasLoadedPanelStates = Object.keys(currentPanelStates).length > 0;
    allPanelConfigs.forEach(boxCfg => {
      const boxElement = document.getElementById(boxCfg.id); if (!boxElement) return;
      let headerElement = boxElement.querySelector(".panel-box-header"); if (!headerElement) return;
      const newHeaderElement = headerElement.cloneNode(true); headerElement.parentNode.replaceChild(newHeaderElement, headerElement); headerElement = newHeaderElement;
      if (boxCfg.type === "collapsible" || boxCfg.type === "hidden_until_active") {
        headerElement.addEventListener("click", () => { if (boxElement.style.display !== "none" || boxCfg.type === "collapsible") { animatePanelBox(boxCfg.id, !boxElement.classList.contains("is-expanded"), boxCfg.type === "hidden_until_active", false); } });
        headerElement.setAttribute("tabindex", "0");
        headerElement.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && (boxElement.style.display !== "none" || boxCfg.type === "collapsible")) { e.preventDefault(); animatePanelBox(boxCfg.id, !boxElement.classList.contains("is-expanded"), boxCfg.type === "hidden_until_active", false); } });
      }
      let initialExpandState; let isRestoringThisPanelState = false;
      if (hasLoadedPanelStates && currentPanelStates[boxCfg.id] !== undefined) { initialExpandState = currentPanelStates[boxCfg.id]; isRestoringThisPanelState = true; }
      else { isRestoringThisPanelState = false; initialExpandState = boxCfg.type === "hidden_until_active" ? false : (boxCfg.initial_expanded || false); }
      if (boxCfg.type === "static") { boxElement.style.display = "flex"; boxElement.style.opacity = "1"; animatePanelBox(boxCfg.id, true, false, false); }
      else if (boxCfg.type === "hidden_until_active") { animatePanelBox(boxCfg.id, initialExpandState, true, isRestoringThisPanelState); }
      else { boxElement.style.display = "flex"; boxElement.style.opacity = "1"; const delay = boxCfg.boot_delay || 0; setTimeout(() => animatePanelBox(boxCfg.id, initialExpandState, false, isRestoringThisPanelState), delay); }
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
    modelToggleButton.setAttribute("aria-label", ariaLabel); modelToggleButton.title = ariaLabel;
  }

  /**
   * Loads user's theme interactions (playing/liked themes).
   * If logged in, fetches from the backend. Otherwise, initializes as empty.
   * This is now an asynchronous function.
   */
  async function loadUserThemeInteractions() {
    if (currentUser && currentUser.token) {
      log(LOG_LEVEL_INFO, `Fetching theme interactions for user ${currentUser.email} from backend.`);
      try {
        // showGlobalLoadingIndicator(true, "Loading your themes...");
        const response = await _callApi('/api/v1/themes/interactions', 'GET', null, currentUser.token);
        if (response && response.interactions) {
          playingThemes = response.interactions.playingThemeIds || [];
          likedThemes = response.interactions.likedThemeIds || [];
          log(LOG_LEVEL_INFO, "Theme interactions loaded from backend:", { playing: playingThemes.length, liked: likedThemes.length });
        } else {
          log(LOG_LEVEL_WARN, "Unexpected response structure from /api/v1/themes/interactions. Defaulting to empty lists.", response);
          playingThemes = [];
          likedThemes = [];
        }
        // showGlobalLoadingIndicator(false);
      } catch (error) {
        // showGlobalLoadingIndicator(false);
        log(LOG_LEVEL_ERROR, "Error fetching theme interactions from backend:", error.message, error.code);
        playingThemes = [];
        likedThemes = [];
      }
    } else {
      log(LOG_LEVEL_INFO, "User not logged in. Initializing theme lists as empty.");
      playingThemes = [];
      likedThemes = [];
    }
    updateTopbarThemeIcons();
    if (document.body.classList.contains("landing-page-active") && currentLandingGridSelection) {
        renderLandingPageActionButtons(currentLandingGridSelection);
    }
  }

  /**
   * Checks if a theme is in the 'playing' list.
   */
  function isThemePlaying(themeId) { return playingThemes.includes(themeId); }

  /**
   * Checks if a theme is in the 'liked' list.
   */
  function isThemeLiked(themeId) { return likedThemes.includes(themeId); }

/**
   * Helper function to update a single theme interaction (playing or liked) on the backend.
   * @param {string} themeId - The ID of the theme.
   * @param {object} interactionPayload - e.g., { is_playing: true } or { is_liked: false }
   */
  async function _updateThemeInteractionOnBackend(themeId, interactionPayload) {
    if (!currentUser || !currentUser.token) {
      log(LOG_LEVEL_INFO, "User not logged in. Skipping backend update for theme interaction.");
      return false; // Indicate backend sync was not attempted/successful
    }
    try {
      log(LOG_LEVEL_DEBUG, `Updating backend theme interaction for theme ${themeId}:`, interactionPayload);
      await _callApi(`/api/v1/themes/${themeId}/interactions`, 'POST', interactionPayload, currentUser.token);
      log(LOG_LEVEL_INFO, `Theme interaction for ${themeId} updated successfully on backend.`);
      return true;
    } catch (error) {
      log(LOG_LEVEL_ERROR, `Failed to update theme interaction for ${themeId} on backend:`, error.message, error.code);
      // Here you might want to revert the optimistic UI update if the backend call fails.
      // For now, just log the error.
      // addMessageToLog(getUIText("error_api_call_failed", { ERROR_MSG: `Could not save like/play status for ${themeId}.` }), "system-error");
      return false;
    }
  }

  /**
   * Adds a theme to the 'playing' list. Updates locally and syncs with backend if logged in.
   * @param {string} themeId - The ID of the theme to add.
   */
  async function addPlayingTheme(themeId) {
    if (!isThemePlaying(themeId)) {
      playingThemes.push(themeId);
      updateTopbarThemeIcons();

      if (currentUser && currentUser.token) {
        await _updateThemeInteractionOnBackend(themeId, { is_playing: true });
      } else {
        // Anonymous interaction - session only
        log(LOG_LEVEL_DEBUG, "Anonymous user: playing theme added to session list.");
      }
    }
  }

  async function removePlayingTheme(themeId, moveToLiked = true) {
    const index = playingThemes.indexOf(themeId);
    if (index > -1) {
      playingThemes.splice(index, 1);
      let wasMovedToLiked = false;
      if (moveToLiked && !isThemeLiked(themeId)) {
        likedThemes.push(themeId);
        wasMovedToLiked = true;
      }
      updateTopbarThemeIcons();

      if (currentUser && currentUser.token) {
        const payload = { is_playing: false };
        if (wasMovedToLiked) {
          payload.is_liked = true;
        }
        await _updateThemeInteractionOnBackend(themeId, payload);
      } else {
        // Anonymous interaction - session only
        log(LOG_LEVEL_DEBUG, "Anonymous user: playing theme removed from session list.");
      }
    }
  }

  async function addLikedTheme(themeId) {
    if (!isThemeLiked(themeId)) {
      likedThemes.push(themeId);
      updateTopbarThemeIcons();
      if (!currentTheme && currentLandingGridSelection === themeId) { /* ... UI update ... */ }

      if (currentUser && currentUser.token) {
        await _updateThemeInteractionOnBackend(themeId, { is_liked: true });
      } else {
        // Anonymous interaction - session only
        log(LOG_LEVEL_DEBUG, "Anonymous user: liked theme added to session list.");
      }
    }
  }

  async function removeLikedTheme(themeId) {
    const index = likedThemes.indexOf(themeId);
    if (index > -1) {
      likedThemes.splice(index, 1);
      updateTopbarThemeIcons();
      if (!currentTheme && currentLandingGridSelection === themeId) { /* ... UI update ... */ }

      if (currentUser && currentUser.token) {
        await _updateThemeInteractionOnBackend(themeId, { is_liked: false });
      } else {
        // Anonymous interaction - session only
        log(LOG_LEVEL_DEBUG, "Anonymous user: liked theme removed from session list.");
      }
    }
  }

  /**
   * Handles closing a theme via its top bar icon.
   */
  function handleCloseTopbarIcon(themeId) {
    let wasPlaying = false; const playingIndex = playingThemes.indexOf(themeId);
    if (playingIndex > -1) { playingThemes.splice(playingIndex, 1); wasPlaying = true; }
    const likedIndex = likedThemes.indexOf(themeId);
    if (likedIndex > -1) { if (!wasPlaying) { likedThemes.splice(likedIndex, 1); } }
    updateTopbarThemeIcons();
    if (wasPlaying && currentTheme === themeId) {
      currentTheme = null; localStorage.removeItem(CURRENT_THEME_STORAGE_KEY); switchToLandingView();
    }
  }

  /**
   * Creates a theme icon button for the top bar.
   */
  function createThemeTopbarIcon(themeId, type) {
    const themeConfig = ALL_THEMES_CONFIG[themeId]; if (!themeConfig) return null;
    const isCurrentlyPlaying = isThemePlaying(themeId);
    const button = document.createElement("button"); button.classList.add("theme-button");
    if (isCurrentlyPlaying && themeId === currentTheme) { button.classList.add("active"); }
    button.dataset.theme = themeId; const themeNameText = getUIText(themeConfig.name_key, {}, themeId);
    let statusText = "";
    if (isCurrentlyPlaying) statusText = getUIText("theme_icon_alt_text_playing");
    else if (type === "liked") statusText = getUIText("theme_icon_alt_text_liked");
    button.title = `${themeNameText}${statusText ? ` (${statusText})` : ""}`;
    const img = document.createElement("img"); img.src = themeConfig.icon; img.alt = button.title; button.appendChild(img);
    const closeBtn = document.createElement("button"); closeBtn.classList.add("theme-button-close"); closeBtn.innerHTML = "×";
    closeBtn.title = getUIText("close_theme_button_aria_label", { THEME_NAME: themeNameText });
    closeBtn.setAttribute("aria-label", closeBtn.title);
    closeBtn.addEventListener("click", (e) => { e.stopPropagation(); handleCloseTopbarIcon(themeId); });
    button.appendChild(closeBtn); button.addEventListener("click", () => handleTopbarThemeIconClick(themeId));
    return button;
  }

  /**
   * Updates the theme icons displayed in the top bar.
   */
  function updateTopbarThemeIcons() {
    if (!playingThemesContainer || !likedThemesContainer || !likedThemesSeparator) return;
    playingThemesContainer.innerHTML = ""; likedThemesContainer.innerHTML = "";
    playingThemes.forEach(themeId => {
      if (ALL_THEMES_CONFIG[themeId]) {
        const icon = createThemeTopbarIcon(themeId, "playing");
        if (icon) { icon.dataset.type = "playing"; playingThemesContainer.appendChild(icon); }
      }
    });
    likedThemes.forEach(themeId => {

      if (ALL_THEMES_CONFIG[themeId] && !isThemePlaying(themeId)) {
        const icon = createThemeTopbarIcon(themeId, "liked");
        if (icon) { icon.dataset.type = "liked"; likedThemesContainer.appendChild(icon); }
      }
    });
    const showSeparator = (playingThemesContainer.children.length > 0 && likedThemesContainer.children.length > 0) || (playingThemesContainer.children.length === 0 && likedThemesContainer.children.length > 0);
    likedThemesSeparator.style.display = showSeparator ? "block" : "none";
  }

  /**
   * Handles clicks on theme icons in the top bar.
   */
  async function handleTopbarThemeIconClick(themeId) {
    const themeIsCurrentlyActiveInView = currentTheme === themeId;
    if (isThemePlaying(themeId)) { if (!themeIsCurrentlyActiveInView) { await changeThemeAndStart(themeId, false); } }
    else if (isThemeLiked(themeId)) { await changeThemeAndStart(themeId, false); }
  }

  /**
   * Toggles the AI model between configured types.
   */
  async function toggleModelType() {
    const newModelName = currentModelName === PAID_MODEL_NAME ? FREE_MODEL_NAME : PAID_MODEL_NAME;
    currentModelName = newModelName;

    log(LOG_LEVEL_INFO, `Model toggled to: ${newModelName}`);

    if (currentUser && currentUser.token) {
      try {
        log(LOG_LEVEL_DEBUG, `Updating backend model preference for ${currentUser.email} to ${newModelName}`);
        const updatedUser = await apiUpdateUserPreferences(currentUser.token, {
          preferred_model_name: newModelName,
        });
        currentUser.preferred_model_name = updatedUser.preferred_model_name;
        log(LOG_LEVEL_INFO, "Backend model preference updated successfully.");
      } catch (error) {
        log(LOG_LEVEL_ERROR, "Failed to update backend model preference:", error);

        addMessageToLog(getUIText("error_api_call_failed", { ERROR_MSG: "Could not save model preference." }), "system-error");
      }
    } else {

      localStorage.setItem(MODEL_PREFERENCE_STORAGE_KEY, currentModelName);
    }

    updateModelToggleButtonText();
    const msgKey = newModelName === PAID_MODEL_NAME ? "system_model_set_paid" : "system_model_set_free";
    if (currentTheme && storyLogViewport && storyLogViewport.style.display !== "none") {
      addMessageToLog(getUIText(msgKey, { MODEL_NAME: newModelName }), "system");
    }
  }

  /**
   * Sets the application language and updates UI texts.
   */
  function setAppLanguageAndThemeUI(lang, themeIdForUIContextIfGameActive) {
    currentAppLanguage = lang;

    localStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, lang);

    if (document.documentElement) document.documentElement.lang = lang;
    const onLandingPage = document.body.classList.contains("landing-page-active");
    document.body.className = ""; if (onLandingPage) { document.body.classList.add("landing-page-active", "theme-landing"); }
    else if (currentTheme && ALL_THEMES_CONFIG[currentTheme]) { document.body.classList.add(`theme-${currentTheme}`); }
    else if (ALL_THEMES_CONFIG[DEFAULT_THEME_ID]) { document.body.classList.add(`theme-${DEFAULT_THEME_ID}`); }

    if (languageToggleButton) {
      const otherLangKeyForButtonText = currentAppLanguage === "en" ? (globalTextData.landing?.cs?.toggle_language || "Česky") : (globalTextData.landing?.en?.toggle_language || "English");
      languageToggleButton.textContent = otherLangKeyForButtonText;
      const ariaToggleKey = `toggle_language_aria`; languageToggleButton.setAttribute("aria-label", getUIText(ariaToggleKey)); languageToggleButton.title = getUIText(ariaToggleKey);
    }
    if (loginButton) { loginButton.textContent = getUIText("button_login"); loginButton.title = getUIText("aria_label_login"); loginButton.setAttribute("aria-label", getUIText("aria_label_login")); }
    if (registerButton) { registerButton.textContent = getUIText("button_register"); registerButton.title = getUIText("aria_label_register"); registerButton.setAttribute("aria-label", getUIText("aria_label_register")); }
    if (logoutButton) { logoutButton.textContent = getUIText("button_logout"); logoutButton.title = getUIText("aria_label_logout"); logoutButton.setAttribute("aria-label", getUIText("aria_label_logout")); }
    if (userProfileButton) { userProfileButton.textContent = getUIText("button_user_profile"); userProfileButton.title = getUIText("aria_label_user_profile"); userProfileButton.setAttribute("aria-label", getUIText("aria_label_user_profile")); }
    if (newGameButton) { newGameButton.textContent = getUIText("button_new_game"); newGameButton.title = getUIText("aria_label_new_game"); newGameButton.setAttribute("aria-label", getUIText("aria_label_new_game")); }
    if (modelToggleButton) modelToggleButton.title = getUIText("aria_label_toggle_model_generic");
    if (systemStatusIndicator) systemStatusIndicator.textContent = getUIText(systemStatusIndicator.dataset.langKey || "system_status_online_short");
    if (gmSpecificActivityIndicator) gmSpecificActivityIndicator.textContent = getUIText(gmSpecificActivityIndicator.dataset.langKey || "system_processing_short");

    if (!onLandingPage && currentTheme && ALL_THEMES_CONFIG[currentTheme]) {
      const currentThemeFullCfg = ALL_THEMES_CONFIG[currentTheme];
      if (currentThemeFullCfg.dashboard_config) {
        const dashboardCfg = currentThemeFullCfg.dashboard_config;
        ["left_panel", "right_panel"].forEach(sideKey => {
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
      initializeDashboardDefaultTexts();
    } else if (onLandingPage) {
      renderThemeGrid();
      if (currentLandingGridSelection && themeGridContainer) {
        const selectedBtn = themeGridContainer.querySelector(`.theme-grid-icon[data-theme="${currentLandingGridSelection}"]`);
        if (selectedBtn) selectedBtn.classList.add("active");
      }
    }
    if (playerIdentifierInputEl) playerIdentifierInputEl.placeholder = getUIText("placeholder_name_login");
    if (startGameButton) startGameButton.textContent = getUIText("button_access_systems");
    if (playerActionInput) playerActionInput.placeholder = getUIText("placeholder_command");
    if (sendActionButton) sendActionButton.textContent = getUIText("button_execute_command");
    updateModelToggleButtonText(); updateTopbarThemeIcons();
    if (onLandingPage && currentLandingGridSelection && ALL_THEMES_CONFIG[currentLandingGridSelection]) {
      updateLandingPagePanels(currentLandingGridSelection, false);
    } else if (onLandingPage) {
      if (landingThemeLoreText) landingThemeLoreText.textContent = getUIText("landing_select_theme_prompt_lore");
      if (landingThemeInfoContent) landingThemeInfoContent.innerHTML = `<p>${getUIText("landing_select_theme_prompt_details")}</p>`;
      const descTitle = landingThemeDescriptionContainer?.querySelector(".panel-box-title");
      if (descTitle) descTitle.textContent = getUIText("landing_theme_description_title");
      const detailsTitle = landingThemeDetailsContainer?.querySelector(".panel-box-title");
      if (detailsTitle) detailsTitle.textContent = getUIText("landing_theme_info_title");
    }
  }

  /**
   * Toggles the application language and narrative language together.
   */
  async function toggleAppLanguage() {
    const newLang = currentAppLanguage === "en" ? "cs" : "en";
    currentAppLanguage = newLang;
    currentNarrativeLanguage = newLang;

    log(LOG_LEVEL_INFO, `Language toggled to: ${newLang}`);

    if (currentUser && currentUser.token) {
      try {
        log(LOG_LEVEL_DEBUG, `Updating backend language preferences for ${currentUser.email} to ${newLang}`);
        const updatedUser = await apiUpdateUserPreferences(currentUser.token, {
          preferred_app_language: newLang,
          preferred_narrative_language: newLang,
        });

        currentUser.preferred_app_language = updatedUser.preferred_app_language;
        currentUser.preferred_narrative_language = updatedUser.preferred_narrative_language;
        log(LOG_LEVEL_INFO, "Backend language preferences updated successfully.");
      } catch (error) {
        log(LOG_LEVEL_ERROR, "Failed to update backend language preferences:", error);

        addMessageToLog(getUIText("error_api_call_failed", { ERROR_MSG: "Could not save language preference." }), "system-error");
      }
    } else {

      localStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, currentAppLanguage);
      localStorage.setItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY, currentNarrativeLanguage);
    }

    setAppLanguageAndThemeUI(currentAppLanguage, currentTheme);
    const langChangeMsgKey = newLang === "en" ? "system_lang_set_en" : "system_lang_set_cs";
    if (currentTheme && storyLogViewport && storyLogViewport.style.display !== "none") {
      addMessageToLog(getUIText(langChangeMsgKey), "system");
    } else {
      log(LOG_LEVEL_INFO, getUIText(langChangeMsgKey));
    }
    if (currentTheme) await saveGameState();
  }

  /**
   * Handles game state indicators from the AI.
   */
  function handleGameStateIndicators(indicators, isInitialBoot = false) {
    if (!indicators || !currentTheme) return;
    const currentThemeFullCfg = ALL_THEMES_CONFIG[currentTheme];
    if (!currentThemeFullCfg || !currentThemeFullCfg.dashboard_config) { log(LOG_LEVEL_ERROR, "Dashboard config missing for game state indicators:", currentTheme); return; }
    const themeDashCfg = currentThemeFullCfg.dashboard_config;
    lastKnownGameStateIndicators = { ...lastKnownGameStateIndicators, ...indicators, };
    const themePanels = [...(themeDashCfg.left_panel || []), ...(themeDashCfg.right_panel || [])];
    themePanels.forEach(boxCfg => {
      if (boxCfg.type === "hidden_until_active" && boxCfg.indicator_key) {
        const boxEl = document.getElementById(boxCfg.id); if (!boxEl) return;
        const shouldShow = indicators[boxCfg.indicator_key] === true;
        const isShowing = boxEl.style.display !== "none" && parseFloat(boxEl.style.opacity || "0") > 0;
        if (shouldShow && !isShowing) { const delay = isInitialBoot && boxCfg.boot_delay ? boxCfg.boot_delay : 0; setTimeout(() => animatePanelBox(boxCfg.id, true, true), delay); }
        else if (!shouldShow && isShowing) { animatePanelBox(boxCfg.id, false, true); }
      }
    });
    let newPromptType = "default"; let highestPriorityFound = -1;
    if (themeDashCfg.game_state_indicators && Array.isArray(themeDashCfg.game_state_indicators)) {
      for (const indicatorConfig of themeDashCfg.game_state_indicators) {
        const indicatorId = indicatorConfig.id;
        if (indicators[indicatorId] === true) {
          const promptText = gamePrompts[currentTheme]?.[indicatorId];
          const isValidPromptForIndicator = PROMPT_URLS_BY_THEME[currentTheme]?.[indicatorId] && promptText && !promptText.startsWith("Error:") && !promptText.startsWith("CRITICAL_ERROR:") && !promptText.startsWith("FILE_NOT_FOUND_NON_CRITICAL:");
          if (isValidPromptForIndicator) {
            const priority = indicatorConfig.priority || 0;
            if (priority > highestPriorityFound) { highestPriorityFound = priority; newPromptType = indicatorId; }
          }
        }
      }
    }
    if (currentPromptType !== newPromptType) { currentPromptType = newPromptType; log(LOG_LEVEL_INFO, `Switched to prompt type: ${currentPromptType} (Priority: ${highestPriorityFound > -1 ? highestPriorityFound : "default"})`); }
  }

  /**
   * Calls the backend proxy to interact with the Gemini API.
   */
  async function callGeminiAPI(currentTurnHistory) {
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

    log(LOG_LEVEL_DEBUG, "----- BEGIN SYSTEM PROMPT -----");
    log(LOG_LEVEL_DEBUG, `Using prompt type: ${activePromptType}`);

    log(LOG_LEVEL_DEBUG, "System Prompt Text (Snippet):", systemPromptText.substring(0, 300) + (systemPromptText.length > 300 ? "..." : ""));
    log(LOG_LEVEL_DEBUG, "----- END SYSTEM PROMPT -----");

    if (systemPromptText.startsWith('{"narrative": "SYSTEM ERROR:')) {
      try {
        const errorResponse = JSON.parse(systemPromptText);
        addMessageToLog(errorResponse.narrative, "system");
        if (errorResponse.suggested_actions) displaySuggestedActions(errorResponse.suggested_actions);
      } catch (e) {
        addMessageToLog(systemPromptText, "system-error");
        log(LOG_LEVEL_ERROR, "Failed to parse system error JSON from getSystemPrompt:", e, systemPromptText);
      }
      setGMActivity(false);
      return null;
    }

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
      modelName: currentModelName,
    };

    const requestHeaders = {
      "Content-Type": "application/json",
    };

    if (currentUser && currentUser.token) {
      requestHeaders["Authorization"] = `Bearer ${currentUser.token}`;
      log(LOG_LEVEL_DEBUG, "callGeminiAPI: Sending request with Authorization header.");
    } else {
      log(LOG_LEVEL_DEBUG, "callGeminiAPI: Sending request without Authorization header (no user/token).");
    }

    try {
      const response = await fetch(PROXY_API_URL, {
        method: "POST",
        headers: requestHeaders,
        body: JSON.stringify(payload),
      });
      const responseData = await response.json();

      if (!response.ok) {
        let errorDetails = responseData.error?.message || `Proxy API Error ${response.status}`;
        if (responseData.error?.details) { errorDetails += ` Details: ${JSON.stringify(responseData.error.details)}`; }
        else if (responseData.details) { errorDetails += ` Details: ${JSON.stringify(responseData.details)}`; }
        throw new Error(errorDetails);
      }

      if (responseData.candidates && responseData.candidates[0]?.content?.parts?.[0]?.text) {
        let jsonStringFromAI = responseData.candidates[0].content.parts[0].text;
        let parsedAIResponse;

        try {

          try {
            parsedAIResponse = JSON.parse(jsonStringFromAI);
          } catch (parseError) {
            log(LOG_LEVEL_ERROR, "Initial JSON.parse failed. Raw AI response (snippet):", jsonStringFromAI.substring(0, 500), "Error:", parseError.message);
            let cleanedJsonString = null;
            const markdownMatch = jsonStringFromAI.match(/```(?:json)?\s*([\s\S]*?)\s*```/s);
            if (markdownMatch && markdownMatch[1]) {
              cleanedJsonString = markdownMatch[1].trim();
              log(LOG_LEVEL_DEBUG, "Extracted JSON from markdown block:", cleanedJsonString.substring(0, 300));
            } else {
              let openChar = ''; let closeChar = ''; let startIndex = -1;
              const firstBrace = jsonStringFromAI.indexOf("{");
              const firstBracket = jsonStringFromAI.indexOf("[");
              if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) { openChar = '{'; closeChar = '}'; startIndex = firstBrace; }
              else if (firstBracket !== -1) { openChar = '['; closeChar = ']'; startIndex = firstBracket; }

              if (startIndex !== -1) {
                let balance = 0; let endIndex = -1;
                for (let i = startIndex; i < jsonStringFromAI.length; i++) {
                  if (jsonStringFromAI[i] === openChar) balance++;
                  else if (jsonStringFromAI[i] === closeChar) {
                    balance--;
                    if (balance === 0) { endIndex = i; break; }
                  }
                }
                if (endIndex !== -1) {
                  cleanedJsonString = jsonStringFromAI.substring(startIndex, endIndex + 1);
                  log(LOG_LEVEL_DEBUG, "Extracted JSON by balance counting:", cleanedJsonString.substring(0, 300));
                } else { log(LOG_LEVEL_DEBUG, "Balance counting for JSON extraction failed."); }
              } else { log(LOG_LEVEL_DEBUG, "No '{' or '[' found for balance counting extraction."); }
            }

            if (cleanedJsonString) {
              try {
                parsedAIResponse = JSON.parse(cleanedJsonString);
                log(LOG_LEVEL_INFO, "Successfully parsed JSON after cleanup. Original parse error was:", parseError.message);
              } catch (nestedParseError) {
                log(LOG_LEVEL_ERROR, "Failed to parse cleaned JSON. Cleaned (snippet):", cleanedJsonString.substring(0, 500), "Nested error:", nestedParseError.message);
                throw new Error(`Invalid JSON structure even after cleanup. Original: ${parseError.message}. Nested: ${nestedParseError.message}.`);
              }
            } else {
              log(LOG_LEVEL_ERROR, "Could not extract valid JSON after initial failure. Re-throwing original parse error.");
              throw parseError;
            }
          }

          if (
            !parsedAIResponse ||
            typeof parsedAIResponse.narrative !== "string" ||
            typeof parsedAIResponse.dashboard_updates !== "object" ||
            parsedAIResponse.dashboard_updates === null ||
            !Array.isArray(parsedAIResponse.suggested_actions)
          ) {
            log(LOG_LEVEL_ERROR, "Parsed JSON is missing required core fields (narrative, dashboard_updates, suggested_actions) or they have wrong types/are null. Parsed object:", parsedAIResponse);
            throw new Error("Invalid JSON structure from AI: missing or invalid core fields.");
          }

          let gameIndicators = parsedAIResponse.game_state_indicators;
          if (typeof gameIndicators === 'undefined') {
            log(LOG_LEVEL_WARN, "AI response was missing 'game_state_indicators'. Defaulting to {}. Full AI response (snippet):", jsonStringFromAI.substring(0, 500));
            gameIndicators = {};
          } else if (typeof gameIndicators !== 'object' || gameIndicators === null) {
            log(LOG_LEVEL_WARN, `AI response had 'game_state_indicators' of wrong type (${typeof gameIndicators}) or was null. Defaulting to {}. Value:`, gameIndicators);
            gameIndicators = {};
          }

          gameHistory.push({
            role: "model",
            parts: [{ text: JSON.stringify(parsedAIResponse) }],
          });
          updateDashboard(parsedAIResponse.dashboard_updates);
          displaySuggestedActions(parsedAIResponse.suggested_actions);
          handleGameStateIndicators(gameIndicators, isInitialGameLoad);
          if (isInitialGameLoad) isInitialGameLoad = false;
          await saveGameState();
          if (systemStatusIndicator) {
            systemStatusIndicator.textContent = getUIText("system_status_online_short");
            systemStatusIndicator.className = "status-indicator status-ok";
          }
          return parsedAIResponse.narrative;

        } catch (e) {
          log(LOG_LEVEL_ERROR, "Error processing/validating AI response object:", e.message, "Raw AI string (snippet):", jsonStringFromAI.substring(0, 500));
          addMessageToLog(getUIText("error_api_call_failed", { ERROR_MSG: "Failed to process AI response: " + e.message }), "system");
          if (systemStatusIndicator) {
            systemStatusIndicator.textContent = getUIText("status_error");
            systemStatusIndicator.className = "status-indicator status-danger";
          }
          return null;
        }
      } else if (responseData.promptFeedback?.blockReason) {
        const blockDetails =
          responseData.promptFeedback.safetyRatings
            ?.map((r) => `${r.category}: ${r.probability}`)
            .join(", ") || "No details provided.";
        throw new Error(
          `Content blocked by API via proxy: ${responseData.promptFeedback.blockReason}. Safety Ratings: ${blockDetails}`
        );
      } else {
        log(LOG_LEVEL_WARN, "Unexpected response structure from proxy (no candidates or blockReason):", responseData);
        throw new Error("No valid candidate or text found in AI response from proxy.");
      }
    } catch (error) {
      log(LOG_LEVEL_ERROR, "callGeminiAPI (proxy) failed:", error);
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
   * Starts the game session after the player enters their identifier (for anonymous play).
   */
  async function startGameAfterIdentifier() {

    if (currentUser) {

    } else {
      const enteredIdentifier = playerIdentifierInputEl ? playerIdentifierInputEl.value.trim() : "";
      if (!enteredIdentifier) {
        await showCustomModal({ type: "alert", titleKey: "alert_title_notice", messageKey: "alert_identifier_required", });
        if (playerIdentifierInputEl) playerIdentifierInputEl.focus();
        return;
      }
      playerIdentifier = enteredIdentifier;
    }

    isInitialGameLoad = true; currentPromptType = "initial";
    if (nameInputSection) nameInputSection.style.display = "none";
    if (actionInputSection) actionInputSection.style.display = "flex";
    if (storyLogViewport) { storyLogViewport.style.opacity = "1"; storyLogViewport.style.transform = "translateY(0) scale(1)"; }
    if (playerActionInput) { playerActionInput.value = ""; playerActionInput.dispatchEvent(new Event("input", { bubbles: true })); autoGrowTextarea(playerActionInput); playerActionInput.focus(); }

    const themeConfig = ALL_THEMES_CONFIG[currentTheme];
    let idKeyForDashboard = "name";
    if (themeConfig && themeConfig.dashboard_config) {
      const dashboardConfig = themeConfig.dashboard_config;
      const foundIdItem = (dashboardConfig?.left_panel || []).flatMap(p => p.items).find(item => item.id === "name" || item.id === "character_name");
      if (foundIdItem) { idKeyForDashboard = foundIdItem.id; }
    }

    updateDashboard({ [idKeyForDashboard]: playerIdentifier }, false);
    addMessageToLog(getUIText("connecting", { PLAYER_ID: playerIdentifier }), "system");
    gameHistory = [{ role: "user", parts: [{ text: `My identifier is ${playerIdentifier}. I am ready to start the game in ${getUIText(themeConfig?.name_key || "unknown_theme", {}, currentTheme)} theme.` }], }];
    await saveGameState();
    clearSuggestedActions();
    const narrative = await callGeminiAPI(gameHistory);
    if (narrative) { addMessageToLog(narrative, "gm"); }
    else {

      if (nameInputSection && !currentUser) nameInputSection.style.display = "flex";
      if (actionInputSection) actionInputSection.style.display = "none";
      addMessageToLog(getUIText("error_session_init_failed"), "system");
    }
  }

  /**
   * Sends the player's typed action to the AI.
   */
  async function sendPlayerAction() {
    const actionText = playerActionInput ? playerActionInput.value.trim() : "";
    if (!actionText) { if (playerActionInput) playerActionInput.focus(); return; }
    document.querySelectorAll('.has-recent-update').forEach(el => el.classList.remove('has-recent-update'));
    addMessageToLog(actionText, "player");
    if (playerActionInput) { playerActionInput.value = ""; playerActionInput.dispatchEvent(new Event("input", { bubbles: true })); autoGrowTextarea(playerActionInput); }
    clearSuggestedActions(); gameHistory.push({ role: "user", parts: [{ text: actionText }] });
    const narrative = await callGeminiAPI(gameHistory);
    if (narrative) { addMessageToLog(narrative, "gm"); }
  }

  /**
   * Initiates a new game session, prompting for confirmation.
   */
  async function startNewGameSession() {
    if (!currentTheme && !currentLandingGridSelection) { await showCustomModal({ type: "alert", titleKey: "alert_title_notice", messageKey: "alert_select_theme_first", }); return; }
    const themeToStartNewGameIn = currentTheme || currentLandingGridSelection;
    if (!themeToStartNewGameIn || !ALL_THEMES_CONFIG[themeToStartNewGameIn]) { await showCustomModal({ type: "alert", titleKey: "alert_title_error", messageKey: "alert_select_theme_first", }); return; }
    const themeConfig = ALL_THEMES_CONFIG[themeToStartNewGameIn];
    const themeName = getUIText(themeConfig.name_key, {}, themeToStartNewGameIn);
    const confirmKey = `confirm_new_game_theme_${themeToStartNewGameIn}`;
    let messageToDisplayKey = (themeTextData[themeToStartNewGameIn]?.[currentAppLanguage]?.[confirmKey] || themeTextData[themeToStartNewGameIn]?.en?.[confirmKey]) ? confirmKey : "confirm_new_game_generic";
    const userConfirmed = await showCustomModal({
      type: "confirm", titleKey: "confirm_new_game_title", messageKey: messageToDisplayKey,
      replacements: { THEME_NAME: themeName }, confirmTextKey: "modal_yes_button", cancelTextKey: "modal_no_button",
      explicitThemeContext: messageToDisplayKey === confirmKey ? themeToStartNewGameIn : null,
    });
    if (userConfirmed) {
      addMessageToLog(getUIText("system_new_game_initiated", { THEME_NAME: themeName }), "system");
      await changeThemeAndStart(themeToStartNewGameIn, true);
    }
  }

  /**
   * Generates the HTML for dashboard panels based on a theme's configuration.
   */
  function generatePanelsForTheme(themeId) {
    const themeFullConfig = ALL_THEMES_CONFIG[themeId];
    if (!themeFullConfig || !themeFullConfig.dashboard_config || !leftPanel || !rightPanel) {
      if (leftPanel && rightPanel && themeFullConfig && !themeFullConfig.dashboard_config) {
        log(LOG_LEVEL_ERROR, `Dashboard config not found for theme: ${themeId}`);
        Array.from(leftPanel.querySelectorAll('.panel-box:not(#landing-theme-description-container .panel-box)')).forEach(el => el.remove());
        Array.from(rightPanel.querySelectorAll('.panel-box:not(#landing-theme-details-container .panel-box)')).forEach(el => el.remove());
        const errorPLeft = document.createElement('p'); errorPLeft.textContent = getUIText("error_dashboard_config_missing");
        const lpScrollDown = leftPanel.querySelector('.scroll-indicator-down');
        if (lpScrollDown) { leftPanel.insertBefore(errorPLeft, lpScrollDown); } else { leftPanel.appendChild(errorPLeft); }
      }
      return;
    }
    const config = themeFullConfig.dashboard_config;
    [leftPanel, rightPanel].forEach(panel => {
      if (panel) {
        const panelBoxes = panel.querySelectorAll('.panel-box');
        panelBoxes.forEach(box => {
          const isLandingDescriptionBox = landingThemeDescriptionContainer && landingThemeDescriptionContainer.contains(box);
          const isLandingDetailsBox = landingThemeDetailsContainer && landingThemeDetailsContainer.contains(box);
          if (!isLandingDescriptionBox && !isLandingDetailsBox) { box.remove(); }
        });
      }
    });
    if (landingThemeDescriptionContainer) landingThemeDescriptionContainer.style.display = "none";
    if (landingThemeDetailsContainer) landingThemeDetailsContainer.style.display = "none";
    const createSidePanels = (sideContainerElement, panelConfigs) => {
      if (!panelConfigs || !sideContainerElement) return;
      const scrollIndicatorDown = sideContainerElement.querySelector('.scroll-indicator-down');
      panelConfigs.forEach(panelConfig => {
        const panelBox = document.createElement("div"); panelBox.id = panelConfig.id; panelBox.classList.add("panel-box");
        panelBox.style.display = "flex"; panelBox.style.flexDirection = "column";
        if (panelConfig.type === "collapsible" || panelConfig.type === "hidden_until_active") { panelBox.classList.add("collapsible"); }
        const header = document.createElement("div"); header.classList.add("panel-box-header");
        const title = document.createElement("h3"); title.classList.add("panel-box-title"); title.textContent = getUIText(panelConfig.title_key, {}, themeId);
        header.appendChild(title); panelBox.appendChild(header);
        const content = document.createElement("div"); content.classList.add("panel-box-content");
        panelConfig.items.forEach(item => {
          const itemContainer = document.createElement("div"); itemContainer.id = `info-item-container-${item.id}`;
          itemContainer.classList.add(item.type === "meter" ? "info-item-meter" : "info-item");
          if (item.type === "text_long" || ["objective", "current_quest", "location", "environment", "sensorConditions", "omen_details", "current_location_desc", "ambient_conditions", "blight_intensity",].includes(item.id)) { itemContainer.classList.add("full-width"); }
          const label = document.createElement("span"); label.classList.add("label"); label.textContent = getUIText(item.label_key, {}, themeId); itemContainer.appendChild(label);
          if (item.type === "meter") {
            const meterContainer = document.createElement("div"); meterContainer.classList.add("meter-bar-container");
            const meterBar = document.createElement("div"); meterBar.id = `meter-${item.id}`; meterBar.classList.add("meter-bar");
            meterContainer.appendChild(meterBar); itemContainer.appendChild(meterContainer);
            const valueOverlay = document.createElement("span"); valueOverlay.id = `info-${item.id}`; valueOverlay.classList.add("value-overlay"); itemContainer.appendChild(valueOverlay);
          } else {
            const valueSpan = document.createElement("span"); valueSpan.id = `info-${item.id}`; valueSpan.classList.add("value");
            if (item.type === "text_long") valueSpan.classList.add("objective-text"); itemContainer.appendChild(valueSpan);
          }
          content.appendChild(itemContainer);
        });
        panelBox.appendChild(content);
        if (scrollIndicatorDown) { sideContainerElement.insertBefore(panelBox, scrollIndicatorDown); }
        else { sideContainerElement.appendChild(panelBox); }
      });
    };
    createSidePanels(leftPanel, config.left_panel); createSidePanels(rightPanel, config.right_panel);
  }

  /**
   * Changes the active game theme or starts a new game.
   */
  async function changeThemeAndStart(newThemeId, forceNewGame = false) {
    const oldThemeId = currentTheme;
    const dataLoaded = await ensureThemeDataLoaded(newThemeId);
    if (!dataLoaded) {
      await showCustomModal({ type: "alert", titleKey: "alert_title_error", messageKey: "error_theme_data_load_failed", replacements: { THEME_ID: newThemeId }, });
      if (oldThemeId && ALL_THEMES_CONFIG[oldThemeId]) { currentTheme = oldThemeId; localStorage.setItem(CURRENT_THEME_STORAGE_KEY, currentTheme); }
      else { switchToLandingView(); }
      return;
    }
    if (newThemeId !== DEFAULT_THEME_ID && (!ALL_THEMES_CONFIG[DEFAULT_THEME_ID] || !themeTextData[DEFAULT_THEME_ID] || !PROMPT_URLS_BY_THEME[DEFAULT_THEME_ID])) {
      await ensureThemeDataLoaded(DEFAULT_THEME_ID);
    }

    const themeWasAlreadyPlaying = isThemePlaying(newThemeId);
    if (oldThemeId === newThemeId && !forceNewGame) {
      if (storyLogViewport && storyLogViewport.style.display === "none") {
        switchToGameView(newThemeId); displaySuggestedActions(currentSuggestedActions);
        if (playerActionInput && actionInputSection && actionInputSection.style.display !== "none" && document.body.contains(playerActionInput)) { playerActionInput.focus(); }
      }
      return;
    }

    currentTheme = newThemeId; localStorage.setItem(CURRENT_THEME_STORAGE_KEY, currentTheme);
    if (forceNewGame || !themeWasAlreadyPlaying) { addPlayingTheme(newThemeId); }
    clearGameStateInternal(currentTheme);

    switchToGameView(currentTheme); generatePanelsForTheme(currentTheme);
    setAppLanguageAndThemeUI(currentAppLanguage, currentTheme);

    const promptsLoadedSuccessfully = await loadAllPromptsForTheme(currentTheme);
    if (!promptsLoadedSuccessfully) {
      addMessageToLog(getUIText("error_load_prompts_critical", { THEME: currentTheme }), "system-error");
      if (startGameButton) startGameButton.disabled = true; switchToLandingView(); return;
    }
    if (startGameButton) startGameButton.disabled = false;
    updateTopbarThemeIcons();
    const newThemeDisplayName = ALL_THEMES_CONFIG[newThemeId] ? getUIText(ALL_THEMES_CONFIG[newThemeId].name_key, {}, newThemeId) : newThemeId;

    if (!forceNewGame && await loadGameState(currentTheme)) {
      isInitialGameLoad = false; initializeCollapsiblePanelBoxes(currentTheme); displaySuggestedActions(currentSuggestedActions);
      if (nameInputSection) nameInputSection.style.display = "none";
      if (actionInputSection) actionInputSection.style.display = "flex";
      if (playerActionInput && document.body.contains(playerActionInput)) playerActionInput.focus();

      addMessageToLog(getUIText("system_session_resumed", { PLAYER_ID: playerIdentifier, THEME_NAME: newThemeDisplayName, }), "system");
      if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText("system_status_online_short"); systemStatusIndicator.className = "status-indicator status-ok"; }
    } else {
      isInitialGameLoad = true; currentPromptType = "initial"; currentPanelStates = {}; currentSuggestedActions = [];
      initializeCollapsiblePanelBoxes(currentTheme); displaySuggestedActions(currentSuggestedActions);
      if (storyLog) storyLog.innerHTML = "";

      if (currentUser) {
        playerIdentifier = currentUser.email;
        if (nameInputSection) nameInputSection.style.display = "none";
        if (actionInputSection) actionInputSection.style.display = "flex";
        if (playerActionInput && document.body.contains(playerActionInput)) playerActionInput.focus();

        await startGameAfterIdentifier();
      } else {
        playerIdentifier = "";
        if (nameInputSection) nameInputSection.style.display = "flex";
        if (actionInputSection) actionInputSection.style.display = "none";
        if (playerIdentifierInputEl) {
          playerIdentifierInputEl.value = ""; playerIdentifierInputEl.placeholder = getUIText("placeholder_name_login");
          if (document.body.contains(playerIdentifierInputEl)) playerIdentifierInputEl.focus();
        }
      }

      if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText("standby"); systemStatusIndicator.className = "status-indicator status-warning"; }
      if (oldThemeId !== newThemeId || forceNewGame) {
        addMessageToLog(getUIText("system_theme_set_generic", { THEME_NAME: newThemeDisplayName, }), "system");
        if (forceNewGame) addMessageToLog(getUIText("system_new_game_initiated", { THEME_NAME: newThemeDisplayName, }), "system");
      }
    }
    requestAnimationFrame(() => {
      if (leftPanel && !document.body.classList.contains("landing-page-active")) updateScrollIndicatorStateForPanel('left', leftPanel);
      if (rightPanel && !document.body.classList.contains("landing-page-active")) updateScrollIndicatorStateForPanel('right', rightPanel);
    });
    if (startGameButton) startGameButton.textContent = getUIText("button_access_systems");
  }

  /**
   * Initializes click/keyboard listeners for a panel's header (specific to landing page panels).
   */
  function initializeSpecificPanelHeader(panelContainerElement) {
    if (!panelContainerElement) { log(LOG_LEVEL_ERROR, `Panel container element not found for click listener.`); return; }
    const box = panelContainerElement.querySelector(".panel-box"); const header = box ? box.querySelector(".panel-box-header") : null;
    if (box && header) {
      if (!box.id) { box.id = `${panelContainerElement.id}-box`; }
      const newHeader = header.cloneNode(true); header.parentNode.replaceChild(newHeader, header);
      newHeader.addEventListener("click", () => { animatePanelBox(box.id, !box.classList.contains("is-expanded"), false); });
      newHeader.setAttribute("tabindex", "0");
      newHeader.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); animatePanelBox(box.id, !box.classList.contains("is-expanded"), false); } });
    }
  }

  /**
   * Switches the UI to the landing page view.
   */
  function switchToLandingView() {
    log(LOG_LEVEL_INFO, "Switching to landing view.");

    const currentPath = window.location.pathname;
    const currentSearch = window.location.search;
    const currentParams = new URLSearchParams(currentSearch);
    const actionParamValue = currentParams.get('action');

    const specialPaths = ['/reset-password', '/email-confirmation-status'];
    const isOnSpecialPath = specialPaths.some(sp => currentPath.startsWith(sp));

    if (isOnSpecialPath) {

      let targetHref = '/';
      if (actionParamValue === 'showLogin') {
        targetHref = '/?action=showLogin';
      }
      log(LOG_LEVEL_DEBUG, `switchToLandingView: On special path ${currentPath}. Forcing full navigation to ${targetHref}.`);
      window.location.href = targetHref;
      return;
    }

    let targetUrl = '/';
    if (actionParamValue === 'showLogin') {
      targetUrl = '/?action=showLogin';
    }

    if (currentPath + currentSearch !== targetUrl) {
      if (!currentPath.startsWith('/api/')) {
        history.pushState(null, '', targetUrl);
        log(LOG_LEVEL_DEBUG, `switchToLandingView: URL changed to ${targetUrl} from ${currentPath + currentSearch}`);
      }
    }

    // --- Original rest of switchToLandingView logic ---
    Object.keys(outOfViewTrackedElements).forEach(side => { outOfViewTrackedElements[side].up.clear(); outOfViewTrackedElements[side].down.clear(); });
    [leftPanelScrollUp, leftPanelScrollDown, rightPanelScrollUp, rightPanelScrollDown].forEach(indicator => { if (indicator) indicator.style.display = 'none'; });
    currentTheme = null;
    localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
    document.body.classList.add("landing-page-active");
    document.body.classList.remove(...Array.from(document.body.classList).filter(cn => cn.startsWith("theme-") && cn !== "theme-landing"));
    if (!document.body.classList.contains("theme-landing")) document.body.classList.add("theme-landing");
    if (storyLogViewport) storyLogViewport.style.display = "none";
    if (suggestedActionsWrapper) suggestedActionsWrapper.style.display = "none";
    if (playerInputControlPanel) playerInputControlPanel.style.display = "none";
    if (nameInputSection) nameInputSection.style.display = "none";
    if (actionInputSection) actionInputSection.style.display = "none";
    if (leftPanel) { Array.from(leftPanel.children).filter(el => el.id !== "landing-theme-description-container" && !el.classList.contains('scroll-indicator')).forEach(el => el.remove()); }
    if (rightPanel) { Array.from(rightPanel.children).filter(el => el.id !== "landing-theme-details-container" && !el.classList.contains('scroll-indicator')).forEach(el => el.remove()); }
    if (themeGridContainer) themeGridContainer.style.display = "grid";
    if (landingThemeDescriptionContainer) {
      landingThemeDescriptionContainer.style.display = "flex";
      if (leftPanel && !leftPanel.contains(landingThemeDescriptionContainer)) {
        const scrollIndicatorDown = leftPanel.querySelector('.scroll-indicator-down');
        if (scrollIndicatorDown) { leftPanel.insertBefore(landingThemeDescriptionContainer, scrollIndicatorDown); } else { leftPanel.appendChild(landingThemeDescriptionContainer); }
      }
    }
    if (landingThemeDetailsContainer) {
      landingThemeDetailsContainer.style.display = "flex";
      if (rightPanel && !rightPanel.contains(landingThemeDetailsContainer)) {
        const scrollIndicatorDown = rightPanel.querySelector('.scroll-indicator-down');
        if (scrollIndicatorDown) { rightPanel.insertBefore(landingThemeDetailsContainer, scrollIndicatorDown); } else { rightPanel.appendChild(landingThemeDetailsContainer); }
      }
    }
    if (landingThemeLoreText) landingThemeLoreText.textContent = getUIText("landing_select_theme_prompt_lore");
    if (landingThemeInfoContent) landingThemeInfoContent.innerHTML = `<p>${getUIText("landing_select_theme_prompt_details")}</p>`;
    if (landingThemeActions) { landingThemeActions.style.display = "none"; landingThemeActions.innerHTML = ""; }
    const descTitle = landingThemeDescriptionContainer?.querySelector(".panel-box-title");
    if (descTitle) descTitle.textContent = getUIText("landing_theme_description_title");
    const detailsTitle = landingThemeDetailsContainer?.querySelector(".panel-box-title");
    if (detailsTitle) detailsTitle.textContent = getUIText("landing_theme_info_title");
    const lorePanelBox = landingThemeDescriptionContainer?.querySelector(".panel-box");
    if (lorePanelBox) { if (!lorePanelBox.id) lorePanelBox.id = "landing-lore-panel-box"; animatePanelBox(lorePanelBox.id, true, false, true); initializeSpecificPanelHeader(landingThemeDescriptionContainer); }
    const detailsPanelBox = landingThemeDetailsContainer?.querySelector(".panel-box");
    if (detailsPanelBox) { if (!detailsPanelBox.id) detailsPanelBox.id = "landing-details-panel-box"; animatePanelBox(detailsPanelBox.id, true, false, true); initializeSpecificPanelHeader(landingThemeDetailsContainer); }
    currentLandingGridSelection = localStorage.getItem(LANDING_SELECTED_GRID_THEME_KEY);
    renderThemeGrid();
    if (currentLandingGridSelection && ALL_THEMES_CONFIG[currentLandingGridSelection]) {
      updateLandingPagePanels(currentLandingGridSelection, false);
      const selectedBtn = themeGridContainer?.querySelector(`.theme-grid-icon[data-theme="${currentLandingGridSelection}"]`);
      if (selectedBtn) selectedBtn.classList.add("active");
    }
    if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText("standby"); systemStatusIndicator.className = "status-indicator status-ok"; }
    updateTopbarThemeIcons();

    setAppLanguageAndThemeUI(currentAppLanguage, null);
  }

  /**
   * Switches the UI to the main game view for a specific theme.
   */
  function switchToGameView(themeId) {
    Object.keys(outOfViewTrackedElements).forEach(side => { outOfViewTrackedElements[side].up.clear(); outOfViewTrackedElements[side].down.clear(); });
    [leftPanelScrollUp, leftPanelScrollDown, rightPanelScrollUp, rightPanelScrollDown].forEach(indicator => { if (indicator) indicator.style.display = 'none'; });
    document.body.classList.remove("landing-page-active", "theme-landing");
    document.body.classList.remove(...Array.from(document.body.classList).filter(cn => cn.startsWith("theme-") && cn !== `theme-${themeId}`));
    if (!document.body.classList.contains(`theme-${themeId}`)) document.body.classList.add(`theme-${themeId}`);
    if (themeGridContainer) themeGridContainer.style.display = "none";
    if (landingThemeDescriptionContainer) landingThemeDescriptionContainer.style.display = "none";
    if (landingThemeDetailsContainer) landingThemeDetailsContainer.style.display = "none";
    if (storyLogViewport) storyLogViewport.style.display = "block";
    if (suggestedActionsWrapper) suggestedActionsWrapper.style.display = "flex";
    if (playerInputControlPanel) playerInputControlPanel.style.display = "block";
    if (storyLogViewport) {
      storyLogViewport.classList.remove("spawn-animation");
      requestAnimationFrame(() => { storyLogViewport.style.opacity = "0"; storyLogViewport.style.transform = "translateY(20px) scale(0.98)"; storyLogViewport.classList.add("spawn-animation"); });
    }
  }

  /**
   * Renders the theme selection grid on the landing page.
   */
  function renderThemeGrid() {
    if (!themeGridContainer) return;
    themeGridContainer.innerHTML = "";
    THEMES_MANIFEST.forEach(themeMeta => {
      const themeConfig = ALL_THEMES_CONFIG[themeMeta.id];
      if (!themeConfig || !themeTextData[themeMeta.id]) { log(LOG_LEVEL_INFO, `Theme config/text data for ${themeMeta.id} not loaded. Skipping grid item.`); return; }
      const button = document.createElement("button"); button.classList.add("theme-grid-icon"); button.dataset.theme = themeConfig.id;
      const themeFullName = getUIText(themeConfig.name_key, {}, themeConfig.id); button.title = themeFullName;
      const img = document.createElement("img"); img.src = themeConfig.icon;
      const altTextKey = `theme_icon_alt_text_default_${themeConfig.id}`; img.alt = getUIText(altTextKey, {}, themeConfig.id) || themeFullName;
      const nameSpan = document.createElement("span"); nameSpan.classList.add("theme-grid-icon-name");
      const themeShortName = getUIText(themeConfig.name_short_key || themeConfig.name_key, {}, themeConfig.id); nameSpan.textContent = themeShortName;
      button.appendChild(img); button.appendChild(nameSpan);
      button.addEventListener("click", () => handleThemeGridIconClick(themeConfig.id));
      themeGridContainer.appendChild(button);
    });
  }

  /**
   * Handles clicks on a theme icon in the landing page grid.
   */
  function handleThemeGridIconClick(themeId) {
    currentLandingGridSelection = themeId; localStorage.setItem(LANDING_SELECTED_GRID_THEME_KEY, themeId);
    themeGridContainer.querySelectorAll(".theme-grid-icon.active").forEach(btn => btn.classList.remove("active"));
    const clickedBtn = themeGridContainer.querySelector(`.theme-grid-icon[data-theme="${themeId}"]`);
    if (clickedBtn) clickedBtn.classList.add("active");
    updateLandingPagePanels(themeId, true);
  }

  /**
   * Formats text with simple markdown-like syntax to HTML.
   */
  function formatDynamicText(text) {
    if (typeof text !== 'string' || !text) return '';
    return text.replace(/_([^_]+)_/g, '<em>$1</em>').replace(/\*([^*]+)\*/g, '<strong>$1</strong>').replace(/~([^~]+)~/g, '<u>$1</u>');
  }

  /**
   * Updates landing page's theme description and details panels.
   */
  function updateLandingPagePanels(themeId, animate = true) {
    const themeConfig = ALL_THEMES_CONFIG[themeId];
    if (!themeConfig || !landingThemeLoreText || !landingThemeInfoContent || !landingThemeDescriptionContainer || !landingThemeDetailsContainer) return;
    const descPanelContainer = document.getElementById("landing-theme-description-container");
    const descTitle = descPanelContainer ? descPanelContainer.querySelector(".panel-box-title") : null;
    if (descTitle) descTitle.textContent = getUIText("landing_theme_description_title");
    const detailsPanelContainer = document.getElementById("landing-theme-details-container");
    const detailsTitle = detailsPanelContainer ? detailsPanelContainer.querySelector(".panel-box-title") : null;
    if (detailsTitle) detailsTitle.textContent = getUIText("landing_theme_info_title");
    landingThemeLoreText.innerHTML = formatDynamicText(getUIText(themeConfig.lore_key, {}, themeId));
    if (animate) { const lorePanelBox = landingThemeDescriptionContainer.querySelector(".panel-box"); if (lorePanelBox && lorePanelBox.id) animatePanelBox(lorePanelBox.id, true, false); }
    const themeDisplayNameInBriefing = getUIText(themeConfig.name_long_key || themeConfig.name_key, {}, themeId);
    landingThemeInfoContent.innerHTML = `
      <p><strong>${getUIText("landing_theme_name_label")}</strong> <span id="landing-selected-theme-name">${themeDisplayNameInBriefing}</span></p>
      <p><strong>${getUIText("landing_theme_inspiration_label")}</strong> <span id="landing-selected-theme-inspiration">${formatDynamicText(getUIText(themeConfig.inspiration_key, {}, themeId))}</span></p>
      <p><strong>${getUIText("landing_theme_tone_label")}</strong> <span id="landing-selected-theme-tone">${formatDynamicText(getUIText(themeConfig.tone_key, {}, themeId))}</span></p>
      <p><strong>${getUIText("landing_theme_concept_label")}</strong> <span id="landing-selected-theme-concept">${formatDynamicText(getUIText(themeConfig.concept_key, {}, themeId))}</span></p>`;
    renderLandingPageActionButtons(themeId);
    if (landingThemeActions) landingThemeActions.style.display = "flex";
    if (animate) { const detailsPanelBox = landingThemeDetailsContainer.querySelector(".panel-box"); if (detailsPanelBox && detailsPanelBox.id) animatePanelBox(detailsPanelBox.id, true, false); }
  }

  /**
   * Renders action buttons on the landing page for a selected theme.
   */
  function renderLandingPageActionButtons(themeId) {
    if (!landingThemeActions) return;
    landingThemeActions.innerHTML = "";
    const themeConfig = ALL_THEMES_CONFIG[themeId];
    const themeManifestEntry = THEMES_MANIFEST.find(t => t.id === themeId);
    if (!themeConfig || !themeManifestEntry) return;

    const chooseButton = document.createElement("button"); chooseButton.id = "choose-theme-button"; chooseButton.classList.add("ui-button");
    if (themeManifestEntry.playable) {
      chooseButton.classList.add("primary"); chooseButton.textContent = getUIText("landing_choose_theme_button");
      chooseButton.addEventListener("click", () => handleChooseThisThemeClick(themeId)); chooseButton.disabled = false;
    } else {
      chooseButton.classList.add("disabled"); chooseButton.textContent = getUIText("coming_soon_button"); chooseButton.disabled = true;
    }
    const likeButton = document.createElement("button"); likeButton.id = "like-theme-button"; likeButton.classList.add("ui-button", "icon-button", "like-theme-button");
    if (themeManifestEntry.playable) {
      const isCurrentlyLiked = isThemeLiked(themeId);
      const likeTextKey = isCurrentlyLiked ? "aria_label_unlike_theme" : "aria_label_like_theme";
      const likeText = getUIText(likeTextKey);
      likeButton.innerHTML = `<img src="${isCurrentlyLiked ? "images/app/icon_heart_filled.svg" : "images/app/icon_heart_empty.svg"}" alt="${likeText}" class="like-icon">`;
      likeButton.setAttribute("aria-label", likeText); likeButton.title = likeText;
      if (isCurrentlyLiked) likeButton.classList.add("liked");
      likeButton.addEventListener("click", () => handleLikeThemeClick(themeId, likeButton)); likeButton.disabled = false;
    } else {
      likeButton.innerHTML = `<img src="images/app/icon_heart_disabled.svg" alt="${getUIText("aria_label_like_theme")}" class="like-icon">`;
      likeButton.setAttribute("aria-label", getUIText("aria_label_like_theme")); likeButton.title = getUIText("coming_soon_button");
      likeButton.classList.add("disabled"); likeButton.disabled = true;
    }
    landingThemeActions.appendChild(chooseButton); landingThemeActions.appendChild(likeButton);
  }

  /**
   * Handles the "Choose this theme" button click on the landing page.
   */
  async function handleChooseThisThemeClick(themeId) { await changeThemeAndStart(themeId, false); }

  /**
   * Handles the "Like/Unlike" button click on the landing page.
   */
  function handleLikeThemeClick(themeId, likeButtonElement) {
    const themeConfig = ALL_THEMES_CONFIG[themeId]; if (!themeConfig) return;
    if (isThemeLiked(themeId)) { removeLikedTheme(themeId); } else { addLikedTheme(themeId); }
  }

  /**
   * Hides the custom modal.
   */
  function hideCustomModal() {
    if (customModalOverlay) {
      customModalOverlay.classList.remove("active");
      if (customModalInput) customModalInput.value = "";
      if (customModalInputContainer) customModalInputContainer.style.display = "none";
      customModalFormContainer.innerHTML = "";

      if (customModalMessage.contains(customModalFormContainer)) {
        customModalMessage.removeChild(customModalFormContainer);
      }
      if (customModalMessage.contains(customModalInputContainer)) {
        customModalMessage.removeChild(customModalInputContainer);
      }
    }
  }

  /**
     * Shows a custom modal (alert, confirm, prompt, or form).
     */
  function showCustomModal(options) {
    return new Promise((resolve) => {
      currentModalResolve = resolve;
      const {
        type = "alert", titleKey, messageKey, htmlContent, formFields,
        replacements = {}, confirmTextKey, cancelTextKey,
        inputPlaceholderKey, defaultValue = "", explicitThemeContext = null, onSubmit,
        customActions
      } = options;

      if (!customModalOverlay || !customModalTitle || !customModalMessage || !customModalActions) {
        log(LOG_LEVEL_ERROR, "Custom modal core elements not found!");
        currentModalResolve(type === "prompt" ? null : (type === "confirm" || type === "form") ? false : null);
        return;
      }

      const modalThemeContext = explicitThemeContext || currentTheme;

      customModalTitle.textContent = getUIText(titleKey || `modal_default_title_${type}`, replacements, modalThemeContext);
      customModalMessage.innerHTML = "";
      customModalFormContainer.innerHTML = "";

      if (customModalInputContainer) customModalInputContainer.style.display = "none";

      if (messageKey) {
        const staticMessageP = document.createElement('p');
        staticMessageP.innerHTML = getUIText(messageKey, replacements, modalThemeContext).replace(/\n/g, "<br>");
        customModalMessage.appendChild(staticMessageP);
      }

      if (htmlContent) {
        if (typeof htmlContent === 'string') {

          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = htmlContent;

          while (tempDiv.firstChild) {
            customModalMessage.appendChild(tempDiv.firstChild);
          }
        } else if (htmlContent instanceof HTMLElement) {
          customModalMessage.appendChild(htmlContent);
        }
      }

      if (type === "form" || (formFields && formFields.length > 0)) {
        customModalMessage.appendChild(customModalFormContainer);
        formFields.forEach(field => {
          const fieldGroup = document.createElement('div'); fieldGroup.classList.add('modal-form-group');
          const label = document.createElement('label'); label.htmlFor = field.id; label.textContent = getUIText(field.labelKey, {}, modalThemeContext); fieldGroup.appendChild(label);
          const input = document.createElement('input'); input.type = field.type || 'text'; input.id = field.id; input.name = field.id;
          if (field.placeholderKey) input.placeholder = getUIText(field.placeholderKey, {}, modalThemeContext);
          if (field.required) input.required = true;
          input.classList.add('modal-input'); fieldGroup.appendChild(input); customModalFormContainer.appendChild(fieldGroup);
        });
      } else if (type === "prompt") {
        if (customModalInputContainer && customModalInput) {
          customModalInputContainer.style.display = "block";
          customModalMessage.appendChild(customModalInputContainer);
          customModalInput.value = defaultValue;
          customModalInput.placeholder = inputPlaceholderKey ? getUIText(inputPlaceholderKey, {}, modalThemeContext) : "";
          setTimeout(() => customModalInput.focus(), 50);
        }
      }

      customModalActions.innerHTML = "";

      if (customActions && Array.isArray(customActions) && customActions.length > 0) {
        customActions.forEach(actionConfig => {
          const btn = document.createElement("button");
          btn.className = actionConfig.className || "ui-button";
          btn.textContent = getUIText(actionConfig.textKey, {}, modalThemeContext);
          btn.addEventListener("click", () => {
            if (actionConfig.onClick) {
              actionConfig.onClick(btn);
            }
          });
          customModalActions.appendChild(btn);
        });
      } else {

        const confirmBtn = document.createElement("button");
        confirmBtn.classList.add("ui-button", "primary");
        let defaultConfirmKey = "modal_ok_button";
        if (type === "confirm" || type === "form") defaultConfirmKey = "modal_confirm_button";
        if (type === "prompt") defaultConfirmKey = "modal_confirm_button";

        confirmBtn.textContent = getUIText(confirmTextKey || defaultConfirmKey, {}, modalThemeContext);
        confirmBtn.addEventListener("click", async () => {
          let modalShouldClose = true;
          let resolveValue;

          if (type === "form" || (formFields && formFields.length > 0)) {
            const formData = {};
            let firstInvalidField = null;
            let isValid = true;
            customModalFormContainer.querySelectorAll('.modal-error-display').forEach(el => el.remove());

            formFields.forEach(field => {
              const inputElement = customModalFormContainer.querySelector(`#${field.id}`);
              if (inputElement) {
                formData[field.id] = inputElement.value;
                if (field.required && !inputElement.value.trim()) {
                  isValid = false;
                  if (!firstInvalidField) firstInvalidField = inputElement;
                }
                if (field.type === 'email' && inputElement.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inputElement.value.trim())) {
                  isValid = false;
                  if (!firstInvalidField) firstInvalidField = inputElement;
                  const emailErrorDisplay = document.createElement('p');
                  emailErrorDisplay.className = 'modal-error-display';
                  emailErrorDisplay.style.color = 'var(--color-meter-critical)';
                  emailErrorDisplay.textContent = getUIText("alert_invalid_email_format");
                  inputElement.parentElement.appendChild(emailErrorDisplay);
                }
              }
            });

            if (!isValid) {
              if (firstInvalidField) firstInvalidField.focus();
              log(LOG_LEVEL_WARN, "Modal form validation failed.");
              if (!customModalFormContainer.querySelector('.modal-error-display')) {
                const generalError = document.createElement('p');
                generalError.className = 'modal-error-display';
                generalError.style.color = 'var(--color-meter-critical)';
                generalError.textContent = getUIText("alert_fill_required_fields");
                customModalFormContainer.appendChild(generalError);
              }
              return;
            }

            if (onSubmit) {
              try {
                confirmBtn.disabled = true;
                confirmBtn.textContent = getUIText("system_processing_short");
                const resultFromOnSubmit = await onSubmit(formData);

                if (typeof resultFromOnSubmit === 'object' && resultFromOnSubmit !== null) {
                  resolveValue = resultFromOnSubmit;
                  if (resultFromOnSubmit.keepOpen === true) {
                    modalShouldClose = false;
                  }
                } else {

                  resolveValue = resultFromOnSubmit;
                }
              } catch (error) {
                log(LOG_LEVEL_ERROR, "Error in modal onSubmit:", error);

                if (error.handledByCaller) {
                  modalShouldClose = false;

                } else {

                  const errorDisplay = customModalFormContainer.querySelector('.modal-error-display') || document.createElement('p');
                  errorDisplay.className = 'modal-error-display';
                  errorDisplay.style.color = 'var(--color-meter-critical)';
                  errorDisplay.style.marginTop = 'var(--spacing-sm)';
                  errorDisplay.textContent = error.message || getUIText("error_api_call_failed", { ERROR_MSG: "Operation failed" });
                  if (!customModalFormContainer.querySelector('.modal-error-display')) customModalFormContainer.appendChild(errorDisplay);
                  modalShouldClose = false;
                }

                if (!error.handledByCaller) {
                  resolveValue = { success: false, error: error };
                } else {

                  resolveValue = { success: false, flowDiverted: true };
                }
              } finally {
                if (document.body.contains(confirmBtn)) {
                  confirmBtn.disabled = false;
                  confirmBtn.textContent = getUIText(confirmTextKey || defaultConfirmKey, {}, modalThemeContext);
                }
              }
            } else {
              resolveValue = formData;
            }
          } else if (type === "prompt" && customModalInput) {
            resolveValue = customModalInput.value;
          } else if (type === "confirm") {
            resolveValue = true;
          } else {
            resolveValue = null;
          }

          if (currentModalResolve && !(resolveValue && resolveValue.flowDiverted && modalShouldClose === false)) {
            currentModalResolve(resolveValue);
          }

          if (modalShouldClose) {
            hideCustomModal();
          }
        });
        customModalActions.appendChild(confirmBtn);

        if (type === "confirm" || type === "prompt" || type === "form" || (formFields && formFields.length > 0)) {
          const cancelBtn = document.createElement("button");
          cancelBtn.classList.add("ui-button");
          cancelBtn.textContent = getUIText(cancelTextKey || "modal_cancel_button", {}, modalThemeContext);
          cancelBtn.addEventListener("click", () => {
            if (currentModalResolve) currentModalResolve(type === "prompt" ? null : (type === "form" ? null : false));
            hideCustomModal();
          });
          customModalActions.appendChild(cancelBtn);
        }
      }

      customModalOverlay.classList.add("active");
      if ((type === "form" || (formFields && formFields.length > 0)) && customModalFormContainer.querySelector('input:not([type=hidden])')) {
        setTimeout(() => {
          const firstInput = customModalFormContainer.querySelector('input:not([type=hidden])');
          if (firstInput) firstInput.focus();
        }, 50);
      } else if (type === "prompt" && customModalInput) {
        setTimeout(() => customModalInput.focus(), 50);
      }
    });
  }

  // --- API Service Functions ---
  /**
   * Registers a new user via API.
   */
  async function apiRegisterUser(email, password) {
    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        const errorMsg = data.error?.message || `HTTP error ${response.status}`;
        log(LOG_LEVEL_WARN, `Registration API error: ${errorMsg}`, data.error?.code);
        throw new Error(errorMsg);
      }
      return data;
    } catch (error) { log(LOG_LEVEL_ERROR, 'Error in apiRegisterUser:', error); throw error; }
  }
  /**
   * Logs in an existing user via API.
   */
  async function apiLoginUser(email, password) {
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        const errorMsg = data.error?.message || `HTTP error ${response.status}`;
        log(LOG_LEVEL_WARN, `Login API error: ${errorMsg}`, data.error?.code);

        const err = new Error(errorMsg);
        err.code = data.error?.code;
        err.data = data.error;
        throw err;
      }
      return data;
    } catch (error) {

      if (!error.code) {
        log(LOG_LEVEL_ERROR, 'Network or unexpected error in apiLoginUser:', error.message);
      }

      throw error;
    }
  }

  /**
   * Displays a modal informing the user their email is not confirmed,
   * and provides an option to resend the confirmation email.
   * @param {string} unconfirmedEmail The email address that needs confirmation.
   */
  async function showEmailNotConfirmedModal(unconfirmedEmail) {
    log(LOG_LEVEL_INFO, `Showing 'Email Not Confirmed' modal for: ${unconfirmedEmail}`);

    let resendCooldownActive = false;

    const customActions = [
      {
        textKey: "button_resend_confirmation_email",
        className: "ui-button primary",
        onClick: async (clickedButtonElement) => {
          if (resendCooldownActive) return;

          resendCooldownActive = true;
          clickedButtonElement.disabled = true;
          const originalButtonText = clickedButtonElement.textContent;
          clickedButtonElement.textContent = getUIText("system_processing_short");

          const modalMessageElement = document.getElementById('custom-modal-message');

          try {
            const result = await apiPublicResendConfirmationEmail(unconfirmedEmail);
            if (modalMessageElement) {
              modalMessageElement.innerHTML = '';
              const successP = document.createElement('p');
              successP.textContent = result.message;
              successP.style.color = 'var(--color-status-ok-text)';
              modalMessageElement.appendChild(successP);
            }
            clickedButtonElement.style.display = 'none';

            const modalActionsArea = document.getElementById('custom-modal-actions');
            let closeButton = modalActionsArea ? modalActionsArea.querySelector('.ui-button:not(.primary)') : null;

            if (!closeButton && modalActionsArea) {
              closeButton = document.createElement('button');
              closeButton.className = 'ui-button';
              modalActionsArea.appendChild(closeButton);
            }
            if (closeButton) {
              closeButton.textContent = getUIText("modal_ok_button");

              if (!closeButton.onclick) {
                closeButton.onclick = () => hideCustomModal();
              }
            }

          } catch (resendError) {
            log(LOG_LEVEL_ERROR, `Failed to resend confirmation email publicly: ${resendError.message}`);
            if (modalMessageElement) {
              displayModalError(getUIText("error_api_call_failed", { ERROR_MSG: resendError.message }), modalMessageElement);
            }
            clickedButtonElement.disabled = false;
            clickedButtonElement.textContent = originalButtonText;

            setTimeout(() => {
              resendCooldownActive = false;
              if (document.body.contains(clickedButtonElement)) {
                clickedButtonElement.disabled = false;
              }
            }, 30000);
          }
        }
      },
      {
        textKey: "modal_cancel_button",
        className: "ui-button",
        onClick: () => {
          hideCustomModal();
        }
      }
    ];

    await showCustomModal({
      type: "alert",
      titleKey: "modal_title_email_not_confirmed",
      messageKey: "message_email_not_confirmed_instruction",
      replacements: { USER_EMAIL: unconfirmedEmail },
      customActions: customActions,
    });
  }

  /**
   * Fetches user preferences from the backend.
   */
  async function apiFetchUserPreferences(token) {
    try {
      const response = await fetch('/api/v1/users/me/preferences', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });
      const data = await response.json();
      if (!response.ok) {
        const errorMsg = data.error?.message || `HTTP error ${response.status}`;
        log(LOG_LEVEL_WARN, `Fetch Preferences API error: ${errorMsg}`, data.error?.code);
        throw new Error(errorMsg);
      }
      return data.preferences;
    } catch (error) {
      log(LOG_LEVEL_ERROR, 'Error in apiFetchUserPreferences:', error);
      throw error;
    }
  }

  /**
   * Updates user preferences on the backend.
   */
  async function apiUpdateUserPreferences(token, preferencesToUpdate) {
    try {
      const response = await fetch('/api/v1/users/me/preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferencesToUpdate),
      });
      const data = await response.json();
      if (!response.ok) {
        const errorMsg = data.error?.message || `HTTP error ${response.status}`;
        log(LOG_LEVEL_WARN, `Update Preferences API error: ${errorMsg}`, data.error?.code);
        throw new Error(errorMsg);
      }
      return data.user;
    } catch (error) {
      log(LOG_LEVEL_ERROR, 'Error in apiUpdateUserPreferences:', error);
      throw error;
    }
  }

  /**
   * Changes the user's password via API.
   */
  async function apiChangePassword(token, currentPassword, newPassword) {
    try {
      const response = await fetch('/api/v1/users/me/password', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        const errorMsg = data.error?.message || `HTTP error ${response.status}`;
        log(LOG_LEVEL_WARN, `Change Password API error: ${errorMsg}`, data.error?.code);
        throw new Error(errorMsg);
      }
      return data;
    } catch (error) {
      log(LOG_LEVEL_ERROR, 'Error in apiChangePassword:', error);
      throw error;
    }
  }

  /**
   * Requests the backend to resend a confirmation email.
   */
  async function apiResendConfirmationEmail(token) {
    try {
      const response = await fetch('/api/v1/auth/resend-confirmation-email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });
      const data = await response.json();
      if (!response.ok) {
        const errorMsg = data.error?.message || `HTTP error ${response.status}`;
        log(LOG_LEVEL_WARN, `Resend Confirmation API error: ${errorMsg}`, data.error?.code);
        throw new Error(errorMsg);
      }
      return data;
    } catch (error) {
      log(LOG_LEVEL_ERROR, 'Error in apiResendConfirmationEmail:', error);
      throw error;
    }
  }

  /**
   * Calls the public API to resend a confirmation email.
   * @param {string} email The email address to resend confirmation for.
   * @returns {Promise<object>} The JSON response from the server.
   */
  async function apiPublicResendConfirmationEmail(email) {
    log(LOG_LEVEL_INFO, `Requesting public resend confirmation for: ${email}`);
    try {
      const response = await fetch('/api/v1/auth/public-resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {

        const errorMsg = data.error?.message || `Public Resend API Error ${response.status}`;
        log(LOG_LEVEL_WARN, `Public Resend Confirmation API error: ${errorMsg}`, data.error?.code);
        const err = new Error(errorMsg);
        err.code = data.error?.code;
        err.data = data.error;
        throw err;
      }
      log(LOG_LEVEL_INFO, "Public resend confirmation API success:", data.message);
      return data;
    } catch (error) {
      log(LOG_LEVEL_ERROR, 'Error in apiPublicResendConfirmationEmail:', error);
      throw error;
    }
  }

  function displayModalError(messageText, containerElement) {
    if (!containerElement) {
      log(LOG_LEVEL_WARN, "displayModalError: containerElement is null or undefined.");
      return;
    }
    let errorDisplay = containerElement.querySelector('.modal-error-display');
    if (!errorDisplay) {
      errorDisplay = document.createElement('p');
      errorDisplay.className = 'modal-error-display';
      errorDisplay.style.color = 'var(--color-meter-critical)';
      errorDisplay.style.marginTop = 'var(--spacing-sm)';
      errorDisplay.style.marginBottom = 'var(--spacing-sm)';

      if (containerElement.id === 'custom-modal-message') {
        containerElement.insertBefore(errorDisplay, containerElement.firstChild);
      } else {
        containerElement.appendChild(errorDisplay);
      }
    }
    errorDisplay.textContent = messageText;
  }

  /**
   * Displays the modal for changing the user's password.
   */
  async function showChangePasswordModal() {
    if (!currentUser || !currentUser.token) {
      log(LOG_LEVEL_WARN, "showChangePasswordModal called but no user/token available.");
      return;
    }

    await showCustomModal({
      type: "form",
      titleKey: "modal_title_change_password",
      formFields: [
        { id: "currentPassword", labelKey: "label_current_password", type: "password", placeholderKey: "placeholder_current_password", required: true },
        { id: "newPassword", labelKey: "label_new_password", type: "password", placeholderKey: "placeholder_new_password", required: true },
        { id: "confirmNewPassword", labelKey: "label_confirm_new_password", type: "password", placeholderKey: "placeholder_confirm_new_password", required: true },
      ],
      confirmTextKey: "button_profile_change_password",
      onSubmit: async (formData) => {
        const { currentPassword, newPassword, confirmNewPassword } = formData;

        if (newPassword.length < 8) {
          throw new Error(getUIText("alert_new_password_too_short"));
        }
        if (newPassword !== confirmNewPassword) {
          throw new Error(getUIText("alert_passwords_do_not_match"));
        }
        if (currentPassword === newPassword) {
          throw new Error(getUIText("alert_new_password_same_as_old"));
        }

        try {
          await apiChangePassword(currentUser.token, currentPassword, newPassword);

          return { success: true, actionAfterClose: 'showPasswordChangeSuccessAlert' };
        } catch (error) {
          log(LOG_LEVEL_ERROR, "Password change failed:", error.message);
          throw error;
        }
      },
    }).then(result => {
      if (result && result.actionAfterClose === 'showPasswordChangeSuccessAlert') {
        showCustomModal({
          type: "alert",
          titleKey: "alert_password_change_success_title",
          messageKey: "alert_password_change_success_message"
        });

      }
    }).catch(error => {

      log(LOG_LEVEL_ERROR, "Error from showChangePasswordModal's promise:", error);
    });
  }

  async function showAuthModal(initialMode = 'login') {
    log(LOG_LEVEL_DEBUG, "showAuthModal: Called with mode:", initialMode);
    let currentMode = initialMode;

    const renderAndDisplayForm = () => {
      const isLogin = currentMode === 'login';
      const titleKey = isLogin ? "modal_title_login" : "modal_title_register";
      const confirmTextKey = isLogin ? "button_login" : "button_register";
      const formFields = [];

      if (isLogin) {
        formFields.push({ id: "authEmail", labelKey: "label_email", type: "email", placeholderKey: "placeholder_email", required: true });
        formFields.push({ id: "authPassword", labelKey: "label_password", type: "password", placeholderKey: "placeholder_password", required: true });
      } else {
        formFields.push({ id: "authEmail", labelKey: "label_email", type: "email", placeholderKey: "placeholder_email", required: true });
        formFields.push({ id: "authPassword", labelKey: "label_password", type: "password", placeholderKey: "placeholder_password_register", required: true });
      }

      const switchLinkContainer = document.createElement('div');
      switchLinkContainer.className = 'auth-modal-links';

      if (isLogin) {
        const forgotPasswordLink = document.createElement('a');
        forgotPasswordLink.href = '#';
        forgotPasswordLink.textContent = getUIText("button_forgot_password");
        forgotPasswordLink.className = 'forgot-password-link';
        forgotPasswordLink.addEventListener('click', (e) => {
          e.preventDefault();
          hideCustomModal();
          showForgotPasswordRequestModal();
        });
        switchLinkContainer.appendChild(forgotPasswordLink);
      }

      const switchAuthModeLink = document.createElement('a');
      switchAuthModeLink.href = '#';
      const switchLinkTextKey = isLogin ? "modal_switch_to_register" : "modal_switch_to_login";
      switchAuthModeLink.textContent = getUIText(switchLinkTextKey);
      switchAuthModeLink.className = 'switch-auth-mode-link';
      switchAuthModeLink.addEventListener('click', (e) => {
        e.preventDefault();
        currentMode = isLogin ? 'register' : 'login';
        hideCustomModal();
        renderAndDisplayForm();
      });
      switchLinkContainer.appendChild(switchAuthModeLink);

      const handleSubmitCallback = async (formData) => {
        const email = formData.authEmail;
        const password = formData.authPassword;

        if (isLogin) {
          try {
            const loginData = await apiLoginUser(email, password);
            await handleSuccessfulLogin(loginData.token, loginData.user);

            return loginData;
          } catch (error) {
            if (error.code === "EMAIL_NOT_CONFIRMED") {

              hideCustomModal();

              await showEmailNotConfirmedModal(error.data?.email || email);

              const handledError = new Error("Email not confirmed, alternate modal shown.");
              handledError.handledByCaller = true;
              throw handledError;
            }

            throw error;
          }
        } else {
          try {
            const registrationData = await apiRegisterUser(email, password);

            return { success: true, actionAfterClose: 'showRegistrationSuccessAlert', data: registrationData };
          } catch (error) {

            throw error;
          }
        }
      };

      showCustomModal({
        type: "form",
        titleKey: titleKey,
        formFields: formFields,
        htmlContent: switchLinkContainer,
        confirmTextKey: confirmTextKey,
        onSubmit: handleSubmitCallback,
      }).then(result => {
        if (result && result.actionAfterClose === 'showRegistrationSuccessAlert') {
          const registeredEmail = result.data?.user?.email || '';

          showCustomModal({
            type: "alert",
            titleKey: "alert_registration_success_title",
            messageKey: "alert_registration_success_check_email_message",
            replacements: { USER_EMAIL: registeredEmail },

          });
        }

      }).catch(error => {

        if (error && error.handledByCaller) {
          log(LOG_LEVEL_DEBUG, "Auth modal submission handled by custom flow (e.g., email not confirmed).");
        } else {
          log(LOG_LEVEL_ERROR, "Error from showAuthModal's promise chain (e.g., unhandled rejection from onSubmit or modal issue):", error);

        }
      });
    };

    renderAndDisplayForm();
  }

  async function showForgotPasswordRequestModal() {
    await showCustomModal({
      type: "form",
      titleKey: "modal_title_forgot_password",
      formFields: [
        { id: "resetEmail", labelKey: "label_email", type: "email", placeholderKey: "placeholder_email", required: true }
      ],
      confirmTextKey: "button_send_reset_link",
      onSubmit: async (formData) => {
        const email = formData.resetEmail;
        try {
          const response = await fetch('/api/v1/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.error?.message || "Failed to request password reset.");
          }

          return { success: true, message: data.message, actionAfterClose: 'showResetRequestSentAlert' };
        } catch (error) {
          log(LOG_LEVEL_ERROR, "Forgot password request failed:", error);
          throw error;
        }
      }
    }).then(result => {
      if (result && result.actionAfterClose === 'showResetRequestSentAlert' && result.message) {
        showCustomModal({
          type: "alert",
          titleKey: "alert_reset_link_sent_title",
          messageText: result.message
        });
      }
    }).catch(error => {
      log(LOG_LEVEL_ERROR, "Error from showForgotPasswordRequestModal promise:", error);

    });
  }

  /**
   * Displays the user profile modal.
   */
  async function showUserProfileModal() {
    if (!currentUser) {
      log(LOG_LEVEL_WARN, "showUserProfileModal called but no user is logged in.");
      return;
    }

    const profileContent = document.createElement('div');
    profileContent.className = 'profile-modal-content';

    const dl = document.createElement('dl');

    const dtEmail = document.createElement('dt');
    dtEmail.textContent = getUIText("label_profile_email");
    const ddEmail = document.createElement('dd');

    const emailTextNode = document.createTextNode(currentUser.email + " ");
    ddEmail.appendChild(emailTextNode);

    const emailStatusSpan = document.createElement('span');
    emailStatusSpan.className = 'email-status';

    if (currentUser.email_confirmed) {
      emailStatusSpan.textContent = `(${getUIText("profile_email_confirmed_status")})`;
      emailStatusSpan.classList.add('confirmed');
      ddEmail.appendChild(emailStatusSpan);
    } else {
      emailStatusSpan.textContent = `(${getUIText("profile_email_unconfirmed_status")})`;
      emailStatusSpan.classList.add('unconfirmed');
      ddEmail.appendChild(emailStatusSpan);

      const resendLink = document.createElement('a');
      resendLink.href = '#';
      resendLink.textContent = getUIText("button_resend_confirmation_email");
      resendLink.className = 'resend-confirmation-link';
      resendLink.style.marginLeft = '5px';

      resendLink.addEventListener('click', async (e) => {
        e.preventDefault();

        e.preventDefault();
        try {
          resendLink.textContent = getUIText("system_processing_short");
          resendLink.style.pointerEvents = 'none';
          await apiResendConfirmationEmail(currentUser.token);
          hideCustomModal();
          await showCustomModal({
            type: "alert",
            titleKey: "alert_confirmation_email_resent_title",
            messageKey: "alert_confirmation_email_resent_message"
          });
        } catch (error) {
          log(LOG_LEVEL_ERROR, "Failed to resend confirmation email:", error);
          hideCustomModal();
          await showCustomModal({
            type: "alert",
            titleKey: "alert_title_error",
            messageKey: "error_api_call_failed",
            replacements: { ERROR_MSG: error.message }
          });
        }
      });
      ddEmail.appendChild(document.createTextNode(" - "));
      ddEmail.appendChild(resendLink);
    }
    dl.appendChild(dtEmail);
    dl.appendChild(ddEmail);

    if (currentUser.created_at) {
      const dtJoined = document.createElement('dt');
      dtJoined.textContent = getUIText("label_profile_joined_date");
      const ddJoined = document.createElement('dd');
      try {
        ddJoined.textContent = new Date(currentUser.created_at).toLocaleDateString(currentAppLanguage, {
          year: 'numeric', month: 'long', day: 'numeric'
        });
      } catch (e) {
        ddJoined.textContent = new Date(currentUser.created_at).toLocaleDateString(undefined, {
          year: 'numeric', month: 'long', day: 'numeric'
        });
        log(LOG_LEVEL_WARN, "Error formatting date with currentAppLanguage, used default locale.", e);
      }
      dl.appendChild(dtJoined);
      dl.appendChild(ddJoined);
    }

    profileContent.appendChild(dl);

    const prefsTitle = document.createElement('h4');
    prefsTitle.textContent = getUIText("label_profile_preferences_title");
    prefsTitle.style.fontWeight = 'var(--font-weight-semibold)';
    prefsTitle.style.color = 'var(--color-text-secondary)';
    prefsTitle.style.fontSize = 'var(--font-size-md)';
    prefsTitle.style.marginBottom = 'var(--spacing-sm)';
    prefsTitle.style.marginTop = 'var(--spacing-lg)';
    profileContent.appendChild(prefsTitle);

    const prefsList = document.createElement('div');

    const appLangPref = document.createElement('div');
    appLangPref.className = 'preference-item';
    appLangPref.innerHTML = `
          <span class="pref-label">${getUIText("label_profile_app_language")}</span>
          <span class="pref-value">${currentAppLanguage.toUpperCase()}</span>
      `;
    prefsList.appendChild(appLangPref);

    const narrLangPref = document.createElement('div');
    narrLangPref.className = 'preference-item';
    narrLangPref.innerHTML = `
          <span class="pref-label">${getUIText("label_profile_narrative_language")}</span>
          <span class="pref-value">${currentNarrativeLanguage.toUpperCase()}</span>
      `;
    prefsList.appendChild(narrLangPref);

    const modelPref = document.createElement('div');
    modelPref.className = 'preference-item';
    modelPref.innerHTML = `
          <span class="pref-label">${getUIText("label_profile_model_preference")}</span>
          <span class="pref-value">${currentModelName === PAID_MODEL_NAME ? 'Pro' : 'Flash'}</span>
      `;
    prefsList.appendChild(modelPref);

    profileContent.appendChild(prefsList);

    const hr = document.createElement('hr');
    profileContent.appendChild(hr);

    const changePasswordContainer = document.createElement('div');
    changePasswordContainer.className = 'change-password-button-container';
    const changePasswordButton = document.createElement('button');
    changePasswordButton.className = 'ui-button';
    changePasswordButton.textContent = getUIText("button_profile_change_password");
    changePasswordButton.addEventListener('click', () => {
      hideCustomModal();
      showChangePasswordModal();
    });

    changePasswordContainer.appendChild(changePasswordButton);

    profileContent.appendChild(changePasswordContainer);

    showCustomModal({
      type: "alert",
      titleKey: "modal_title_user_profile",
      htmlContent: profileContent,
      customActions: [
        {
          textKey: "button_profile_logout",
          className: "ui-button primary logout-button",
          onClick: () => {
            handleLogout();
            hideCustomModal();
          }
        },
        {
          textKey: "modal_cancel_button",
          className: "ui-button",
          onClick: () => {
            hideCustomModal();
          }
        }
      ]
    });
  }

  /**
   * Handles successful user login.
   */
  async function handleSuccessfulLogin(token, userData) {
    log(LOG_LEVEL_INFO, "Login successful for:", userData.email);
    localStorage.setItem(JWT_STORAGE_KEY, token);

    currentUser = {
      id: userData.id,
      email: userData.email,
      token: token,
      preferred_app_language: userData.preferred_app_language,
      preferred_narrative_language: userData.preferred_narrative_language,
      preferred_model_name: userData.preferred_model_name,
      email_confirmed: userData.email_confirmed,
      created_at: userData.created_at
    };
    playerIdentifier = currentUser.email;

    updateAuthUI();

    if (currentUser.preferred_app_language) currentAppLanguage = currentUser.preferred_app_language;
    else currentAppLanguage = localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY) || DEFAULT_LANGUAGE;

    if (currentUser.preferred_narrative_language) currentNarrativeLanguage = currentUser.preferred_narrative_language;
    else currentNarrativeLanguage = localStorage.getItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY) || currentAppLanguage;

    if (currentUser.preferred_model_name) currentModelName = currentUser.preferred_model_name;
    else currentModelName = localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY) || FREE_MODEL_NAME;

    log(LOG_LEVEL_INFO, "Applied user preferences from login/session:", { appLang: currentAppLanguage, narrLang: currentNarrativeLanguage, model: currentModelName });

    setAppLanguageAndThemeUI(currentAppLanguage, currentTheme);
    updateModelToggleButtonText();

    if (currentTheme && !document.body.classList.contains("landing-page-active")) {
      const themeConfig = ALL_THEMES_CONFIG[currentTheme];
      if (themeConfig && themeConfig.dashboard_config) {
        const dashboardConfig = themeConfig.dashboard_config;
        const playerIdentifierConfigKey = (dashboardConfig.left_panel || []).flatMap(p => p.items).find(item => item.id === "name" || item.id === "character_name")?.id;
        if (playerIdentifierConfigKey) {
          const el = document.getElementById(`info-${playerIdentifierConfigKey}`);
          if (el) el.textContent = currentUser.email;
        }
      }
    }
    await loadUserThemeInteractions();

    if (currentUser && !currentUser.email_confirmed) {
      showCustomModal({
        type: "alert",
        titleKey: "email_confirmation_pending_title",
        messageKey: "email_confirmation_pending_message",
        replacements: { USER_EMAIL: currentUser.email },
        customActions: [
          {
            textKey: "button_resend_confirmation_email",
            className: "ui-button primary",
            onClick: async () => {
              try {

                await apiResendConfirmationEmail(currentUser.token);
                hideCustomModal();
                await showCustomModal({
                  type: "alert",
                  titleKey: "alert_confirmation_email_resent_title",
                  messageKey: "alert_confirmation_email_resent_message"
                });
              } catch (error) {
                hideCustomModal();
                await showCustomModal({
                  type: "alert",
                  titleKey: "alert_title_error",
                  messageKey: "error_api_call_failed",
                  replacements: { ERROR_MSG: error.message }
                });
              }
            }
          },
          {
            textKey: "modal_ok_button",
            className: "ui-button",
            onClick: () => {
              hideCustomModal();
            }
          }
        ]
      });
    }
  }

  /**
   * Handles user logout.
   */
  async function handleLogout() {
    log(LOG_LEVEL_INFO, "User logged out.");
    const previousAppLang = currentUser?.preferred_app_language || localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY) || DEFAULT_LANGUAGE;
    localStorage.removeItem(JWT_STORAGE_KEY);
    currentUser = null;
    playerIdentifier = "";

    updateAuthUI();

    loadAnonymousUserPreferences();

    if (currentAppLanguage !== previousAppLang || document.body.classList.contains("landing-page-active") || !currentTheme) {
      setAppLanguageAndThemeUI(currentAppLanguage, document.body.classList.contains("landing-page-active") ? null : currentTheme);
    }
    updateModelToggleButtonText();
    await loadUserThemeInteractions();
    if (!document.body.classList.contains("landing-page-active")) {
      switchToLandingView();
    }
  }

  /**
   * Checks URL for email confirmation status and displays appropriate message.
   * This would typically clear the main game/landing UI and show a dedicated message.
   */
  function handleEmailConfirmationStatus() {
    const urlParams = new URLSearchParams(window.location.search);
    const confirmationStatus = urlParams.get('status');
    const confirmationTokenForDebug = urlParams.get('token');

    if (window.location.pathname === '/confirm-email' && confirmationTokenForDebug) {

      displayConfirmationMessage("email_confirmation_invalid_token", "status-error", true);
      history.replaceState(null, '', window.location.pathname.split('?')[0].replace('/confirm-email', '/'));
      return true;
    }

    if (confirmationStatus) {
      let messageKey = "";
      let messageClass = "status-info";

      switch (confirmationStatus) {
        case "success":
          messageKey = "email_confirmation_success";
          messageClass = "status-success";
          break;
        case "invalid_token":
          messageKey = "email_confirmation_invalid_token";
          messageClass = "status-error";
          break;
        case "already_confirmed":
          messageKey = "email_confirmation_already_confirmed";
          messageClass = "status-info";
          break;
        case "expired_token":
          messageKey = "email_confirmation_expired_token";
          messageClass = "status-error";
          break;
        case "server_error":
          messageKey = "email_confirmation_server_error";
          messageClass = "status-error";
          break;
        default:
          log(LOG_LEVEL_WARN, "Unknown email confirmation status in URL:", confirmationStatus);

          return false;
      }

      displayConfirmationMessage(messageKey, messageClass);

      history.replaceState(null, '', window.location.pathname.split('?')[0]);
      return true;
    }
    return false;
  }

  /**
   * Helper to display the confirmation message, clearing other UI.
   */
  function displayConfirmationMessage(messageKey, messageClass = "status-info", isDirectAccessError = false) {

    if (themeGridContainer) themeGridContainer.style.display = 'none';
    if (storyLogViewport) storyLogViewport.style.display = 'none';
    if (playerInputControlPanel) playerInputControlPanel.style.display = 'none';
    if (suggestedActionsWrapper) suggestedActionsWrapper.style.display = 'none';
    if (leftPanel) leftPanel.innerHTML = '';
    if (rightPanel) rightPanel.innerHTML = '';

    const centerColumn = document.getElementById('center-column');
    if (centerColumn) {
      centerColumn.innerHTML = '';

      const container = document.createElement('div');
      container.className = 'email-confirmation-container';

      const title = document.createElement('h2');
      title.textContent = getUIText("email_confirmation_status_page_title");
      container.appendChild(title);

      const messageP = document.createElement('p');
      messageP.innerHTML = getUIText(messageKey).replace(/\n/g, "<br>");
      messageP.classList.add(messageClass);
      container.appendChild(messageP);

      const backButton = document.createElement('button');
      backButton.className = 'ui-button primary';
      backButton.textContent = getUIText(currentUser ? "button_new_game" : "button_login");
      backButton.addEventListener('click', () => {
        window.location.href = '/';
      });
      container.appendChild(backButton);

      centerColumn.appendChild(container);

      document.body.className = "theme-landing";
      appRoot.style.height = '100vh';
    }
    if (isDirectAccessError) {

    }
  }

  /**
   * Updates authentication-related UI elements.
   */
  function updateAuthUI() {
    const isLoggedIn = !!currentUser;
    if (loginButton) loginButton.style.display = isLoggedIn ? "none" : "inline-flex";
    if (userProfileButton) userProfileButton.style.display = isLoggedIn ? "inline-flex" : "none";
    if (playerIdentifierInputEl) {
      if (isLoggedIn) {
        if (nameInputSection) nameInputSection.style.display = "none";
      } else {

        if (currentTheme && !document.body.classList.contains("landing-page-active") && nameInputSection) {

        }
      }
    }
  }

  /**
   * Loads preferences for anonymous users from localStorage or defaults.
   */
  function loadAnonymousUserPreferences() {
    currentAppLanguage = localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY) || DEFAULT_LANGUAGE;
    currentNarrativeLanguage = localStorage.getItem(NARRATIVE_LANGUAGE_PREFERENCE_STORAGE_KEY) || currentAppLanguage;
    currentModelName = localStorage.getItem(MODEL_PREFERENCE_STORAGE_KEY) || FREE_MODEL_NAME;
    log(LOG_LEVEL_INFO, "Loaded anonymous user preferences:", { lang: currentAppLanguage, narrLang: currentNarrativeLanguage, model: currentModelName });
  }

  /**
   * Checks authentication status on application load.
   */
  async function checkAuthStatusOnLoad() {
    const token = localStorage.getItem(JWT_STORAGE_KEY);
    if (token) {
      log(LOG_LEVEL_INFO, "Token found in storage. Verifying with /me endpoint...");
      try {
        const response = await fetch('/api/v1/auth/me', {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();

          await handleSuccessfulLogin(token, data.user);
          log(LOG_LEVEL_INFO, "Token verified via /me, user session restored with preferences.");
        } else {
          const errorData = await response.json().catch(() => ({}));
          log(LOG_LEVEL_WARN, "Token verification failed or token expired via /me. Logging out.", response.status, errorData.error?.message);
          handleLogout();
        }
      } catch (error) {
        log(LOG_LEVEL_ERROR, "Error during initial /me token verification:", error);
        handleLogout();
      }
    } else {
      currentUser = null;
      playerIdentifier = "";
      updateAuthUI();
      loadAnonymousUserPreferences(); // Sets local state vars
      // No currentTheme means we are on landing page or just logged out
      setAppLanguageAndThemeUI(currentAppLanguage, currentTheme || null);
      updateModelToggleButtonText();
      await loadUserThemeInteractions();
    }
  }

  function handlePasswordResetPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');

    if (window.location.pathname === '/reset-password' && resetToken) {

      if (themeGridContainer) themeGridContainer.innerHTML = ''; themeGridContainer.style.display = 'none';
      if (storyLogViewport) storyLogViewport.innerHTML = ''; storyLogViewport.style.display = 'none';
      if (playerInputControlPanel) playerInputControlPanel.style.display = 'none';
      if (suggestedActionsWrapper) suggestedActionsWrapper.innerHTML = ''; suggestedActionsWrapper.style.display = 'none';
      if (leftPanel) leftPanel.innerHTML = '';
      if (rightPanel) rightPanel.innerHTML = '';
      document.body.className = "theme-landing";

      showCustomModal({
        type: "form",
        titleKey: "modal_title_reset_password",
        formFields: [
          { id: "newPassword", labelKey: "label_new_password", type: "password", placeholderKey: "placeholder_new_password", required: true },
          { id: "confirmNewPassword", labelKey: "label_confirm_new_password", type: "password", placeholderKey: "placeholder_confirm_new_password", required: true }
        ],
        confirmTextKey: "button_reset_password",

        customActions: [
          {
            textKey: "button_reset_password",
            className: "ui-button primary",
            onClick: async () => {
              const newPasswordInput = document.getElementById('newPassword');
              const confirmNewPasswordInput = document.getElementById('confirmNewPassword');
              const newPassword = newPasswordInput ? newPasswordInput.value : '';
              const confirmNewPassword = confirmNewPasswordInput ? confirmNewPasswordInput.value : '';
              const modalMessageArea = document.getElementById('custom-modal-message');

              if (modalMessageArea) {
                const existingError = modalMessageArea.querySelector('.modal-error-display');
                if (existingError) existingError.remove();
              }

              if (newPassword !== confirmNewPassword) {
                if (modalMessageArea) displayModalError(getUIText("alert_passwords_do_not_match"), modalMessageArea);
                return;
              }
              if (newPassword.length < 8) {
                if (modalMessageArea) displayModalError(getUIText("alert_new_password_too_short"), modalMessageArea);
                return;
              }

              try {
                const response = await fetch('/api/v1/auth/reset-password', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ token: resetToken, newPassword }),
                });
                const data = await response.json();
                if (!response.ok) {
                  throw new Error(data.error?.message || "Failed to reset password.");
                }

                hideCustomModal();

                await showCustomModal({
                  type: "alert",
                  titleKey: "alert_password_reset_success_title",
                  messageText: data.message,
                  customActions: [{
                    textKey: "button_login",
                    className: "ui-button primary",
                    onClick: () => {
                      console.log("Password Reset Successful Modal - Login button clicked.");
                      window.location.href = '/?action=showLogin';
                    }
                  }]
                });

              } catch (error) {
                log(LOG_LEVEL_ERROR, "Password reset submission failed:", error);
                if (modalMessageArea) displayModalError(error.message + (error.message.includes("Invalid or expired") ? " " + getUIText("text_try_request_again") : ""), modalMessageArea);

              }
            }
          }
        ],
      }).catch(error => {

        log(LOG_LEVEL_ERROR, "Error setting up reset password modal:", error);
        window.location.href = '/';
      });

      return true;
    }
    return false;
  }

  /**
   * Main application initialization function.
   */
  async function initializeApp() {
    console.log("initializeApp: Started.");
    const initialUrlParams = new URLSearchParams(window.location.search);
    console.log("initializeApp: Initial URL params:", initialUrlParams.toString());
    if (handleEmailConfirmationStatus()) {
      log(LOG_LEVEL_INFO, "Email confirmation status handled. App initialization might be altered.");
      updateAuthUI();
      setAppLanguageAndThemeUI(currentAppLanguage, null);
      updateModelToggleButtonText();
      updateTopbarThemeIcons();
      return;
    }
    if (handlePasswordResetPage()) {
      log(LOG_LEVEL_INFO, "Password reset page handled. App initialization might be altered.");
      updateAuthUI();
      setAppLanguageAndThemeUI(currentAppLanguage, null);
      updateModelToggleButtonText();
      updateTopbarThemeIcons();
      return;
    }
    if (typeof THEMES_MANIFEST === "undefined" || THEMES_MANIFEST.length === 0) {
      log(LOG_LEVEL_ERROR, "CRITICAL: THEMES_MANIFEST is not loaded or is empty.");
      await showCustomModal({ type: "alert", titleKey: "alert_title_error", messageKey: "error_critical_manifest_missing", });
      [startGameButton, playerIdentifierInputEl, playerActionInput, sendActionButton, newGameButton, modelToggleButton, languageToggleButton, loginButton, registerButton].forEach(el => { if (el) el.disabled = true; });
      if (themeGridContainer) themeGridContainer.innerHTML = '<p style="color:red; text-align:center;">Error: Theme manifest failed to load.</p>';
      if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText("status_error"); systemStatusIndicator.className = "status-indicator status-danger"; }
      return;
    }

    const themeLoadPromises = THEMES_MANIFEST.map(async (themeMeta) => {
      const themePath = themeMeta.path;
      if (!ALL_THEMES_CONFIG[themeMeta.id]) await loadThemeConfig(themeMeta.id, themePath);
      if (ALL_THEMES_CONFIG[themeMeta.id] && !themeTextData[themeMeta.id]) await loadThemeTexts(themeMeta.id, themePath);
      if (themeMeta.id === DEFAULT_THEME_ID) {
        if (!PROMPT_URLS_BY_THEME[themeMeta.id] || !NARRATIVE_LANG_PROMPT_PARTS_BY_THEME[themeMeta.id]) {
          await loadThemePromptsConfig(themeMeta.id, themePath);
        }
      }
    });
    try { await Promise.all(themeLoadPromises); }
    catch (error) {
      log(LOG_LEVEL_ERROR, "Error loading initial theme data:", error);
      await showCustomModal({ type: "alert", titleKey: "alert_title_error", messageKey: "error_initial_theme_data_load_failed", });
    }

    leftPanelScrollUp = document.getElementById('left-panel-scroll-indicator-up');
    leftPanelScrollDown = document.getElementById('left-panel-scroll-indicator-down');
    rightPanelScrollUp = document.getElementById('right-panel-scroll-indicator-up');
    rightPanelScrollDown = document.getElementById('right-panel-scroll-indicator-down');
    [leftPanelScrollUp, leftPanelScrollDown, rightPanelScrollUp, rightPanelScrollDown].forEach(ind => { if (ind) ind.style.display = 'none'; });

    const apiKeyIsSetup = await setupApiKey();
    if (!apiKeyIsSetup) {
      if (DEFAULT_THEME_ID && ALL_THEMES_CONFIG[DEFAULT_THEME_ID] && themeTextData[DEFAULT_THEME_ID]) { switchToLandingView(); }
      else { log(LOG_LEVEL_ERROR, "Cannot switch to landing, default theme data missing."); }
      return;
    }

    await checkAuthStatusOnLoad();

    let gameToResume = null;
    currentTheme = localStorage.getItem(CURRENT_THEME_STORAGE_KEY) || null;

    if (currentTheme && ALL_THEMES_CONFIG[currentTheme] && isThemePlaying(currentTheme)) {
      const resumeDataLoaded = await ensureThemeDataLoaded(currentTheme);
      if (resumeDataLoaded && await loadAllPromptsForTheme(currentTheme)) {
        if (await loadGameState(currentTheme)) {
          gameToResume = currentTheme;
        }
        else { currentTheme = null; localStorage.removeItem(CURRENT_THEME_STORAGE_KEY); }
      } else {
        addMessageToLog(getUIText("error_resume_failed_prompts", { THEME: currentTheme }), "system-error");
        currentTheme = null;
        localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
      }
    } else if (currentTheme) {
      log(LOG_LEVEL_INFO, `Theme ${currentTheme} was in localStorage but not in playing list or config missing. Clearing.`);
      currentTheme = null;
      localStorage.removeItem(CURRENT_THEME_STORAGE_KEY);
    }

    if (gameToResume) {
      switchToGameView(currentTheme);
      generatePanelsForTheme(currentTheme);

      initializeCollapsiblePanelBoxes(currentTheme);
      displaySuggestedActions(currentSuggestedActions);

      if (nameInputSection) nameInputSection.style.display = "none";
      if (actionInputSection) actionInputSection.style.display = "flex";
      if (playerActionInput && document.body.contains(playerActionInput)) playerActionInput.focus();

      const themeDisplayName = ALL_THEMES_CONFIG[currentTheme] ? getUIText(ALL_THEMES_CONFIG[currentTheme].name_key, {}, currentTheme) : currentTheme;

      addMessageToLog(getUIText("system_session_resumed", { PLAYER_ID: playerIdentifier, THEME_NAME: themeDisplayName }), "system");
      if (systemStatusIndicator) { systemStatusIndicator.textContent = getUIText("system_status_online_short"); systemStatusIndicator.className = "status-indicator status-ok"; }
      isInitialGameLoad = false;
      requestAnimationFrame(() => {
        if (leftPanel && !document.body.classList.contains("landing-page-active")) updateScrollIndicatorStateForPanel('left', leftPanel);
        if (rightPanel && !document.body.classList.contains("landing-page-active")) updateScrollIndicatorStateForPanel('right', rightPanel);
      });
    } else {
      switchToLandingView();
    }
    updateTopbarThemeIcons();
    if (playerActionInput) autoGrowTextarea(playerActionInput);
    [leftPanel, rightPanel].forEach(panel => {
      if (panel) { panel.addEventListener('scroll', () => { const panelSide = panel.id === 'left-panel' ? 'left' : 'right'; updateScrollIndicatorStateForPanel(panelSide, panel); }, { passive: true }); }
    });

    const urlParamsInit = new URLSearchParams(window.location.search);
    const actionToShow = urlParamsInit.get('action');
    console.log("initializeApp: Checking for action in URL. Action found:", actionToShow);

    if (actionToShow === 'showLogin') {
      console.log("initializeApp: 'showLogin' action detected.");
      if (!currentUser) {
        log(LOG_LEVEL_INFO, "Action 'showLogin' detected in URL, opening login modal.");
        console.log("initializeApp: No currentUser, calling showAuthModal('login').");
        showAuthModal('login');

        const newUrl = window.location.pathname;
        history.replaceState(null, '', newUrl);
        console.log("initializeApp: Cleaned URL parameter after processing showLogin.");
      } else {
        log(LOG_LEVEL_INFO, "Action 'showLogin' detected, but user is already logged in.");
        console.log("initializeApp: User already logged in, not showing login modal.");

        const newUrl = window.location.pathname;
        history.replaceState(null, '', newUrl);
        console.log("initializeApp: Cleaned URL parameter for already logged-in user.");
      }
    }

    log(LOG_LEVEL_INFO, "Application initialization complete.");
    console.log("initializeApp: Finished.");
  }

  // --- Event Listeners ---
  if (applicationLogoElement) applicationLogoElement.addEventListener("click", switchToLandingView);
  if (languageToggleButton) languageToggleButton.addEventListener("click", toggleAppLanguage);
  if (newGameButton) newGameButton.addEventListener("click", () => { startNewGameSession().catch(err => log(LOG_LEVEL_ERROR, "Err New Game:", err)); });
  if (modelToggleButton) modelToggleButton.addEventListener("click", toggleModelType);
  if (startGameButton) startGameButton.addEventListener("click", () => { startGameAfterIdentifier().catch(err => log(LOG_LEVEL_ERROR, "Err Start Ident Button:", err)); });
  if (playerIdentifierInputEl) playerIdentifierInputEl.addEventListener("keypress", (e) => { if (e.key === "Enter") { startGameAfterIdentifier().catch(err => log(LOG_LEVEL_ERROR, "Err Start Ident Enter:", err)); } });
  if (sendActionButton) sendActionButton.addEventListener("click", () => { sendPlayerAction().catch(err => log(LOG_LEVEL_ERROR, "Err Send Action Button:", err)); });
  if (playerActionInput) {
    playerActionInput.addEventListener("keypress", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendPlayerAction().catch(err => log(LOG_LEVEL_ERROR, "Err Send Action Enter:", err)); } });
    playerActionInput.addEventListener("input", () => autoGrowTextarea(playerActionInput));
  }
  if (storyLogViewport) {
    storyLogViewport.addEventListener("scroll", () => {
      if (storyLogViewport.scrollHeight - storyLogViewport.clientHeight > storyLogViewport.scrollTop + AUTOSCROLL_THRESHOLD) { userHasManuallyScrolledLog = true; }
    });
  }
  if (loginButton) loginButton.addEventListener("click", () => showAuthModal('login'));
  if (userProfileButton) userProfileButton.addEventListener("click", showUserProfileModal);

  initializeApp();
});
