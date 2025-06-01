// js/ui/domElements.js
/**
 * @file Exports references to all frequently used DOM elements.
 * This allows other UI modules to import them, ensuring that DOM queries
 * are centralized and efficiently managed.
 */

export const appRoot = document.getElementById("app-root");
export const applicationHeader = document.getElementById("application-header");
export const applicationLogo = document.getElementById("application-logo");

// Theme selection and display in header
export const themeSelector = document.getElementById("theme-selector");
export const playingThemesContainer = document.getElementById("playing-themes-container");
export const likedThemesSeparator = document.getElementById("liked-themes-separator");
export const likedThemesContainer = document.getElementById("liked-themes-container");

// Top bar elements
export const systemStatusIndicator = document.getElementById("system-status-indicator");
export const gmSpecificActivityIndicator = document.getElementById("gm-activity-indicator"); // Renamed from gm-activity-indicator in HTML
export const userProfileButton = document.getElementById("user-profile-button");
export const loginButton = document.getElementById("login-button");
// registerButton and logoutButton are typically managed by authUiManager during modal/profile display, not global consts here.
export const newGameButton = document.getElementById("new-game-button");
export const modelToggleButton = document.getElementById("model-toggle-button");
export const languageToggleButton = document.getElementById("language-toggle-button");

// Main layout panels
export const leftPanel = document.getElementById("left-panel");
export const rightPanel = document.getElementById("right-panel");

// Scroll indicators for side panels
export const leftPanelScrollIndicatorUp = document.getElementById("left-panel-scroll-indicator-up");
export const leftPanelScrollIndicatorDown = document.getElementById("left-panel-scroll-indicator-down");
export const rightPanelScrollIndicatorUp = document.getElementById("right-panel-scroll-indicator-up");
export const rightPanelScrollIndicatorDown = document.getElementById("right-panel-scroll-indicator-down");

// Landing page specific containers
export const landingThemeDescriptionContainer = document.getElementById("landing-theme-description-container");
export const landingThemeLoreText = document.getElementById("landing-theme-lore-text");
export const landingThemeDetailsContainer = document.getElementById("landing-theme-details-container");
export const landingThemeInfoContent = document.getElementById("landing-theme-info-content");
export const landingThemeActions = document.getElementById("landing-theme-actions");
export const themeGridContainer = document.getElementById("theme-grid-container");

// Game view specific elements
export const storyLogViewport = document.getElementById("story-log-viewport");
export const storyLog = document.getElementById("story-log");
export const suggestedActionsWrapper = document.getElementById("suggested-actions-wrapper");

// Player input area
export const playerInputControlPanel = document.getElementById("player-input-control-panel");
export const nameInputSection = document.getElementById("name-input-section");
export const playerIdentifierInput = document.getElementById("player-identifier-input");
export const startGameButton = document.getElementById("start-game-button");
export const actionInputSection = document.getElementById("action-input-section");
export const playerActionInput = document.getElementById("player-action-input");
export const sendActionButton = document.getElementById("send-action-button");

// Footer
export const applicationFooter = document.getElementById("application-footer");

// Modal elements
export const customModalOverlay = document.getElementById("custom-modal-overlay");
export const customModal = document.getElementById("custom-modal"); // Changed from customModalElement to match ID
export const customModalTitle = document.getElementById("custom-modal-title");
export const customModalMessage = document.getElementById("custom-modal-message");
export const customModalInputContainer = document.getElementById("custom-modal-input-container");
export const customModalInput = document.getElementById("custom-modal-input");
export const customModalActions = document.getElementById("custom-modal-actions");
// Note: customModalFormContainer is created dynamically by modalManager.js if needed for forms.
