// js/app.js
/**
 * @file Main application entry point. Initializes core services, loads essential data,
 * checks authentication status, sets up global event listeners, and kicks off
 * the initial UI rendering (either landing page or resuming a game).
 */

// --- Core Application Logic & Services ---
import * as state from './core/state.js';
import { log, LOG_LEVEL_INFO, LOG_LEVEL_ERROR, LOG_LEVEL_WARN, LOG_LEVEL_DEBUG, setLogLevel as setCoreLogLevel } from './core/logger.js';
// apiService is used by other services, not directly by app.js typically

// --- Business Logic Services ---
import * as themeService from './services/themeService.js';
import * as localizationService from './services/localizationService.js';
import * as authService from './services/authService.js';
// aiService is primarily used by gameController

// --- UI Management ---
import * as dom from './ui/domElements.js';
import * as uiUtils from './ui/uiUtils.js';
import * as storyLogManager from './ui/storyLogManager.js';
import * as modalManager from './ui/modalManager.js';
import * as landingPageManager from './ui/landingPageManager.js';
import * as userThemeControlsManager from './ui/userThemeControlsManager.js';
import * as authUiManager from './ui/authUiManager.js';
import * as modelToggleManager from './ui/modelToggleManager.js';
import * as languageManager from './ui/languageManager.js';
import * as dashboardManager from './ui/dashboardManager.js'; // For languageManager dependency
import * as worldShardsModalManager from './ui/worldShardsModalManager.js';


// --- Game Orchestration ---
import * as gameController from './game/gameController.js';

// --- Static Data ---
import { THEMES_MANIFEST } from './data/themesManifest.js'; // Loaded by themeService
import { globalTextData }  from './data/globalTexts.js';   // Loaded by localizationService

// --- Config Values ---
import { LOG_LEVEL_STORAGE_KEY, DEFAULT_LANGUAGE } from './core/config.js';


/**
 * Handles URL changes or initial application load to determine view.
 */
async function handleUrlChangeOrInitialLoad() {
    log(LOG_LEVEL_INFO, "Handling URL change or initial load.");
    const currentPath = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);
    const actionParam = urlParams.get('action');
    const tokenParam = urlParams.get('token'); // For password reset
    const statusParam = urlParams.get('status'); // For email confirmation

    // 1. Handle special auth-related pages first
    if (currentPath.endsWith('/email-confirmation-status') && statusParam) {
        log(LOG_LEVEL_DEBUG, `Displaying email confirmation status: ${statusParam}`);
        authUiManager.displayEmailConfirmationStatusPage(statusParam);
        history.replaceState(null, '', '/'); // Clean URL
        return;
    }

    if (currentPath.endsWith('/reset-password') && tokenParam) {
        log(LOG_LEVEL_DEBUG, `Displaying password reset page for token: ${tokenParam.substring(0,10)}...`);
        authUiManager.displayPasswordResetPage(tokenParam, authService.handleResetPassword);
         // URL will be cleaned by authUiManager or modalManager if submission is successful
        return;
    }

    // 2. Handle 'showLogin' action from URL
    if (actionParam === 'showLogin' && !state.getCurrentUser()) {
        log(LOG_LEVEL_INFO, "Action 'showLogin' detected in URL, user not logged in. Opening login modal.");
        // authUiManager will handle showing the modal via authService and modalManager
        authUiManager.showLoginModal();
        // Clean the URL parameter
        const newUrl = window.location.pathname; // Base path without query params
        history.replaceState(null, '', newUrl);
        // switchToLanding will be called implicitly if login is successful or cancelled from modal
        // For now, ensure landing view basics are up if we just showed login
        if (!state.getCurrentTheme()) { // If no game was active
            await gameController.switchToLanding();
        }
        return;
    } else if (actionParam === 'showLogin' && state.getCurrentUser()) {
        log(LOG_LEVEL_INFO, "Action 'showLogin' detected, but user is already logged in. Cleaning URL.");
        const newUrl = window.location.pathname;
        history.replaceState(null, '', newUrl);
    }


    // 3. Attempt to resume an existing game session
    const themeToResume = state.getCurrentTheme(); // This would be set by checkAuthStatusOnLoad if user had a theme active
    const playingThemes = state.getPlayingThemes();

    if (themeToResume && playingThemes.includes(themeToResume)) {
        log(LOG_LEVEL_INFO, `Attempting to resume game for theme: ${themeToResume}`);
        // Ensure theme data is loaded before trying to resume
        const dataLoaded = await themeService.ensureThemeDataLoaded(themeToResume);
        if (dataLoaded) {
            await themeService.getAllPromptsForTheme(themeToResume); // Load all prompts for the theme
            await gameController.resumeGameSession(themeToResume);
        } else {
            log(LOG_LEVEL_ERROR, `Failed to load data for theme ${themeToResume}. Switching to landing page.`);
            await gameController.switchToLanding();
        }
    } else {
        // 4. Default to landing page if no special action and no game to resume
        log(LOG_LEVEL_INFO, "No specific action or game to resume. Switching to landing page.");
        await gameController.switchToLanding();
    }
}


/**
 * Main application initialization function.
 */
async function initializeApp() {
    log(LOG_LEVEL_INFO, "Anomady Application initializing...");

    // 0. Set logger level from localStorage or default
    const storedLogLevel = localStorage.getItem(LOG_LEVEL_STORAGE_KEY);
    if (storedLogLevel) {
        setCoreLogLevel(storedLogLevel);
    } else {
        setCoreLogLevel(DEFAULT_LANGUAGE === 'cs' ? 'debug' : 'info'); // Example: more logs for CS default
    }

    // 1. Check for critical DOM elements
    if (!dom.appRoot || !dom.leftPanel || !dom.rightPanel || !dom.themeGridContainer || !dom.storyLogViewport) {
        log(LOG_LEVEL_ERROR, "Critical DOM elements missing. Application cannot start.");
        if (dom.appRoot) dom.appRoot.innerHTML = "<p style='color:red;text-align:center;padding:20px;'>Critical Error: Application UI cannot be initialized. Please check console.</p>";
        return;
    }

    // 2. Initialize Theme Service (loads manifest data: configs, texts, prompt configs)
    log(LOG_LEVEL_INFO, "Initializing ThemeService and loading initial manifest data...");
    const initialThemeDataLoaded = await themeService.loadInitialThemeManifestData();
    if (!initialThemeDataLoaded) {
        log(LOG_LEVEL_ERROR, "Failed to load essential theme manifest data. Application might be unstable.");
        // Potentially show a more user-friendly error in the UI here
        modalManager.showCustomModal({
            type: "alert",
            titleKey: "alert_title_error",
            messageKey: "error_initial_theme_data_load_failed"
        });
        // Application can continue but some themes might not work.
    }

    // 3. Initialize UI Managers and Game Controller with dependencies
    // Order can matter here if managers call each other during init.
    // Simple managers first.
    storyLogManager.initStoryLogScrollHandling();
    modelToggleManager.initModelToggleManager({ storyLogManager });

    // LandingPageManager and UserThemeControlsManager are interdependent for some UI updates.
    // GameController also needs UserThemeControlsManager.
    gameController.initGameController({ userThemeControlsManager });
    userThemeControlsManager.initUserThemeControlsManager(gameController, landingPageManager);
    landingPageManager.initLandingPageManager(gameController, userThemeControlsManager);

    // LanguageManager needs refs to update various parts of the UI.
    languageManager.initLanguageManager({
        storyLogManager,
        landingPageManager,
        dashboardManager // For re-translating dashboard panels
    });

    worldShardsModalManager.initWorldShardsModalManager({
        landingPageManager // For refreshing landing grid after shard changes
    });

    authUiManager.initAuthUiManager({
        authService, // For performing auth actions
        modalManager, // For showing auth forms
        gameController // For actions like switching to landing on logout
    });

    // modalManager itself doesn't have complex dependencies for its own init
    // Its functions will use localizationService.getUIText which is globally available.

    log(LOG_LEVEL_INFO, "UI Managers and Game Controller initialized.");

    // 4. Set up global event listeners
    log(LOG_LEVEL_INFO, "Setting up global event listeners...");
    if (dom.applicationLogo) dom.applicationLogo.addEventListener("click", () => gameController.switchToLanding());
    if (dom.languageToggleButton) dom.languageToggleButton.addEventListener("click", () => languageManager.handleLanguageToggle());
    if (dom.newGameButton) dom.newGameButton.addEventListener("click", async () => {
        const currentThemeId = state.getCurrentTheme() || state.getCurrentLandingGridSelection();
        if (currentThemeId) {
            await gameController.initiateNewGameSessionFlow(currentThemeId);
        } else {
            // This case should ideally not happen if landing page forces a selection or defaults
            log(LOG_LEVEL_WARN, "New Game button clicked but no current theme or landing selection available.");
            modalManager.showCustomModal({ type: "alert", titleKey: "alert_title_notice", messageKey: "alert_select_theme_first" });
        }
    });
    if (dom.modelToggleButton) dom.modelToggleButton.addEventListener("click", () => modelToggleManager.handleModelToggle());
    if (dom.loginButton) dom.loginButton.addEventListener("click", () => authUiManager.showLoginModal()); // Delegate to authUiManager
    if (dom.userProfileButton) dom.userProfileButton.addEventListener("click", () => authUiManager.showUserProfileModal());

    if (dom.startGameButton && dom.playerIdentifierInput) {
        dom.startGameButton.addEventListener("click", () => gameController.handleIdentifierSubmission(dom.playerIdentifierInput.value));
        dom.playerIdentifierInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") gameController.handleIdentifierSubmission(dom.playerIdentifierInput.value);
        });
    }
    if (dom.sendActionButton && dom.playerActionInput) {
        dom.sendActionButton.addEventListener("click", () => gameController.processPlayerAction(dom.playerActionInput.value));
        dom.playerActionInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                gameController.processPlayerAction(dom.playerActionInput.value);
            }
        });
        dom.playerActionInput.addEventListener("input", () => uiUtils.autoGrowTextarea(dom.playerActionInput));
    }

    window.addEventListener('popstate', async (event) => {
        log(LOG_LEVEL_INFO, "Popstate event detected. Re-evaluating view.", event.state);
        await handleUrlChangeOrInitialLoad();
    });
    // Scroll listener for side panels (dashboardManager now handles this internally via refreshScrollTrackingForSidebar)
    [dom.leftPanel, dom.rightPanel].forEach(panel => {
        if (panel) {
            panel.addEventListener('scroll', () => {
                const panelSide = panel.id === 'left-panel' ? 'left' : 'right';
                dashboardManager.updateScrollIndicators(panelSide);
            }, { passive: true });
        }
    });


    log(LOG_LEVEL_INFO, "Global event listeners set up.");

    // 5. Authentication and Initial UI Rendering
    log(LOG_LEVEL_INFO, "Checking authentication status...");
    await authService.checkAuthStatusOnLoad(); // Sets user state, applies stored preferences
    authUiManager.updateAuthUIState();      // Updates login/logout/profile buttons
    await userThemeControlsManager.loadUserThemeInteractions(); // Fetches playing/liked themes AFTER auth is known
    await landingPageManager.fetchShapedWorldStatusAndUpdateGrid(); // Fetches shard data AFTER auth is known

    log(LOG_LEVEL_INFO, "Determining initial view...");
    await handleUrlChangeOrInitialLoad(); // Determines landing vs. game view

    languageManager.applyGlobalUITranslations();
    log(LOG_LEVEL_INFO, "Global UI translations applied after view setup.");

    log(LOG_LEVEL_INFO, "Anomady Application initialized successfully.");
}

// --- Start the application ---
document.addEventListener("DOMContentLoaded", initializeApp);
