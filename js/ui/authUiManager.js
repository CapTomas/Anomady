// js/ui/authUiManager.js
/**
 * @file Handles UI changes directly related to the user's authentication state
 * (e.g., visibility of login/logout/profile buttons, email confirmation messages, password reset page display).
 */
import {
    loginButton,
    userProfileButton,
    // Import other DOM elements if directly manipulated by this manager,
    // though most direct DOM manipulation for modals will be via modalManager
    themeGridContainer,
    storyLogViewport,
    playerInputControlPanel,
    suggestedActionsWrapper,
    leftPanel,
    rightPanel,
    appRoot,
    applicationHeader
} from './domElements.js';
import * as state from '../core/state.js';
import { getUIText } from '../services/localizationService.js';
import { log, LOG_LEVEL_INFO, LOG_LEVEL_DEBUG, LOG_LEVEL_ERROR, LOG_LEVEL_WARN } from '../core/logger.js';
// Dependencies injected via initAuthUiManager
let _authService = null;
let _modalManager = null;
let _gameControllerRef = null; // For actions like switching to landing view on logout
/**
 * Initializes the AuthUiManager with necessary dependencies.
 * @param {object} dependencies - Object containing references to other modules.
 * @param {object} dependencies.authService - Reference to authService.
 * @param {object} dependencies.modalManager - Reference to modalManager.
 * @param {object} [dependencies.gameController] - Optional reference to gameController.
 */
export function initAuthUiManager(dependencies) {
    if (!dependencies.authService || !dependencies.modalManager) {
        log(LOG_LEVEL_ERROR, "AuthUiManager initialization failed: Missing required dependencies (authService, modalManager).");
        return;
    }
    _authService = dependencies.authService;
    _modalManager = dependencies.modalManager;
    _gameControllerRef = dependencies.gameController;
    log(LOG_LEVEL_INFO, "AuthUiManager initialized.");
}

/**
 * Updates the main authentication-related UI elements based on the current user's login status.
 */
export function updateAuthUIState() {
    const currentUser = state.getCurrentUser();
    const isLoggedIn = !!currentUser;
    if (loginButton) loginButton.style.display = isLoggedIn ? "none" : "inline-flex";
    if (userProfileButton) userProfileButton.style.display = isLoggedIn ? "inline-flex" : "none";
    log(LOG_LEVEL_DEBUG, `Auth UI updated. User is ${isLoggedIn ? 'logged in' : 'logged out'}.`);
}

/**
 * Shows an authentication modal (login or register).
 * @param {'login'|'register'} [initialMode='login'] - The mode to open the modal in.
 */
export function showAuthModal(initialMode = 'login') {
    log(LOG_LEVEL_DEBUG, `Showing auth modal in '${initialMode}' mode.`);
    let currentAuthMode = initialMode;

    const renderAndDisplayForm = () => {
        const isLogin = currentAuthMode === 'login';
        const titleKey = isLogin ? "modal_title_login" : "modal_title_register";
        const confirmTextKey = isLogin ? "button_login" : "button_register";
        const formFields = [
            { id: "authEmail", labelKey: "label_email", type: "email", placeholderKey: "placeholder_email", required: true },
            { id: "authPassword", labelKey: "label_password", type: "password", placeholderKey: isLogin ? "placeholder_password" : "placeholder_password_register", required: true }
        ];

        const linksContainer = document.createElement('div');
        linksContainer.className = 'auth-modal-links';

        if (isLogin) {
            const forgotPasswordLink = document.createElement('a');
            forgotPasswordLink.href = '#';
            forgotPasswordLink.textContent = getUIText("button_forgot_password");
            forgotPasswordLink.className = 'forgot-password-link';
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                _modalManager.hideCustomModal();
                showForgotPasswordRequestModal();
            });
            linksContainer.appendChild(forgotPasswordLink);
        }

        const switchAuthModeLink = document.createElement('a');
        switchAuthModeLink.href = '#';
        const switchLinkTextKey = isLogin ? "modal_switch_to_register" : "modal_switch_to_login";
        switchAuthModeLink.textContent = getUIText(switchLinkTextKey);
        switchAuthModeLink.className = 'switch-auth-mode-link';
        switchAuthModeLink.addEventListener('click', (e) => {
            e.preventDefault();
            currentAuthMode = isLogin ? 'register' : 'login';
            _modalManager.hideCustomModal(); // Close current before re-rendering
            renderAndDisplayForm(); // Re-render with the new mode
        });
        linksContainer.appendChild(switchAuthModeLink);

        _modalManager.showCustomModal({
            type: "form",
            titleKey: titleKey,
            formFields: formFields,
            htmlContent: linksContainer,
            confirmTextKey: confirmTextKey,
            onSubmit: async (formData) => {
                const { authEmail, authPassword } = formData;
                try {
                    if (isLogin) {
                        const userData = await _authService.handleLogin(authEmail, authPassword);
                        // handleLogin in authService updates state and local storage
                        updateAuthUIState(); // Reflect logged-in state immediately
                        // Caller (app.js) will handle further UI changes like loading user themes/games
                        return { success: true, data: userData }; // Modal will close
                    } else { // register
                        const defaultPreferences = {
                            appLanguage: state.getCurrentAppLanguage(),
                            narrativeLanguage: state.getCurrentNarrativeLanguage(),
                            modelName: state.getCurrentModelName()
                        };
                        const registrationData = await _authService.handleRegistration(authEmail, authPassword, defaultPreferences);
                        return { success: true, actionAfterClose: 'showRegistrationSuccessAlert', data: registrationData };
                    }
                } catch (error) {
                    if (error.code === "EMAIL_NOT_CONFIRMED") {
                        _modalManager.hideCustomModal();
                        showEmailNotConfirmedModal(error.data?.email || authEmail);
                        // Signal that this flow is handled and modal shouldn't show generic error
                        const handledError = new Error("Email not confirmed, specific modal shown.");
                        handledError.handledByCaller = true; // Custom flag for showCustomModal's error handling
                        throw handledError;
                    }
                    throw error; // Re-throw for modalManager to display error within the form
                }
            },
        }).then(result => {
            // This .then is after showCustomModal's promise resolves
            if (result && result.success && result.actionAfterClose === 'showRegistrationSuccessAlert') {
                const registeredEmail = result.data?.user?.email || '';
                _modalManager.showCustomModal({
                    type: "alert",
                    titleKey: "alert_registration_success_title",
                    messageKey: "alert_registration_success_check_email_message",
                    replacements: { USER_EMAIL: registeredEmail },
                });
            } else if (result && result.success && currentAuthMode === 'login') {
                // Login success: modal closed, UI updated by updateAuthUIState earlier.
                // Further actions like fetching themes will be triggered by app.js or gameController.
                log(LOG_LEVEL_INFO, "Login successful through modal.");
            }
        }).catch(error => {
            if (error && error.handledByCaller) {
                log(LOG_LEVEL_DEBUG, "Auth modal submission flow diverted (e.g., email not confirmed).");
            } else {
                log(LOG_LEVEL_ERROR, "Error from showAuthModal promise chain:", error);
                // Errors from onSubmit are usually displayed within the modal by modalManager's form handling
            }
        });
    };
    renderAndDisplayForm(); // Initial call
}

// Make showLoginModal an alias or specific entry if needed, for now showAuthModal covers it.
export const showLoginModal = () => showAuthModal('login');

/**
 * Displays the user profile modal.
 */
export async function showUserProfileModal() {
    const currentUser = state.getCurrentUser();
    if (!currentUser) {
        log(LOG_LEVEL_WARN, "showUserProfileModal called but no user is logged in.");
        return;
    }

    const profileContent = document.createElement('div');
    profileContent.className = 'profile-modal-content'; // For specific styling

    const dl = document.createElement('dl');
    // Email
    const dtEmail = document.createElement('dt');
    dtEmail.textContent = getUIText("label_profile_email");
    const ddEmail = document.createElement('dd');
    ddEmail.appendChild(document.createTextNode(currentUser.email + " "));
    const emailStatusSpan = document.createElement('span');
    emailStatusSpan.className = 'email-status';
    if (currentUser.email_confirmed) {
        emailStatusSpan.textContent = `(${getUIText("profile_email_confirmed_status")})`;
        emailStatusSpan.classList.add('confirmed');
    } else {
        emailStatusSpan.textContent = `(${getUIText("profile_email_unconfirmed_status")})`;
        emailStatusSpan.classList.add('unconfirmed');
        const resendLink = document.createElement('a');
        resendLink.href = '#';
        resendLink.textContent = getUIText("button_resend_confirmation_email");
        resendLink.className = 'resend-confirmation-link';
        resendLink.style.marginLeft = 'var(--spacing-xs)';
        resendLink.addEventListener('click', async (e) => {
            e.preventDefault();
            resendLink.textContent = getUIText("system_processing_short");
            resendLink.style.pointerEvents = 'none';
            try {
                await _authService.handleResendConfirmation();
                _modalManager.hideCustomModal(); // Close profile modal
                _modalManager.showCustomModal({ // Show success alert
                    type: "alert",
                    titleKey: "alert_confirmation_email_resent_title",
                    messageKey: "alert_confirmation_email_resent_message"
                });
            } catch (error) {
                _modalManager.displayModalError(error.message || getUIText("error_api_call_failed", { ERROR_MSG: "Failed to resend." }), profileContent);
                resendLink.textContent = getUIText("button_resend_confirmation_email");
                resendLink.style.pointerEvents = 'auto';
            }
        });
        ddEmail.appendChild(document.createTextNode(" - "));
        ddEmail.appendChild(resendLink);
    }
    ddEmail.appendChild(emailStatusSpan);
    dl.appendChild(dtEmail); dl.appendChild(ddEmail);

    // Joined Date
    if (currentUser.created_at) {
        const dtJoined = document.createElement('dt');
        dtJoined.textContent = getUIText("label_profile_joined_date");
        const ddJoined = document.createElement('dd');
        try {
            ddJoined.textContent = new Date(currentUser.created_at).toLocaleDateString(state.getCurrentAppLanguage(), {
                year: 'numeric', month: 'long', day: 'numeric'
            });
        } catch (e) { ddJoined.textContent = new Date(currentUser.created_at).toISOString().split('T')[0]; }
        dl.appendChild(dtJoined); dl.appendChild(ddJoined);
    }
    profileContent.appendChild(dl);

    // Preferences Section
    const prefsTitle = document.createElement('h4');
    prefsTitle.textContent = getUIText("label_profile_preferences_title");
    prefsTitle.className = 'profile-section-title'; // Add class for styling
    profileContent.appendChild(prefsTitle);

    const prefsList = document.createElement('div');
    prefsList.className = 'profile-preferences-list';
    const createPrefItem = (labelKey, value) => {
        const item = document.createElement('div');
        item.className = 'preference-item';
        item.innerHTML = `<span class="pref-label">${getUIText(labelKey)}</span><span class="pref-value">${value}</span>`;
        return item;
    };
    prefsList.appendChild(createPrefItem("label_profile_app_language", state.getCurrentAppLanguage().toUpperCase()));
    prefsList.appendChild(createPrefItem("label_profile_narrative_language", state.getCurrentNarrativeLanguage().toUpperCase()));
    prefsList.appendChild(createPrefItem("label_profile_model_preference", state.getCurrentModelName().includes('pro') ? 'Pro' : 'Flash'));
    profileContent.appendChild(prefsList);

    profileContent.appendChild(document.createElement('hr'));

    // Change Password Button
    const changePasswordContainer = document.createElement('div');
    changePasswordContainer.className = 'change-password-button-container';
    const changePasswordButton = document.createElement('button');
    changePasswordButton.className = 'ui-button';
    changePasswordButton.textContent = getUIText("button_profile_change_password");
    changePasswordButton.addEventListener('click', () => {
        _modalManager.hideCustomModal(); // Close profile modal first
        showChangePasswordModal();
    });
    changePasswordContainer.appendChild(changePasswordButton);
    profileContent.appendChild(changePasswordContainer);

    _modalManager.showCustomModal({
        type: "custom", // Use 'custom' to signify we are providing full HTML content
        titleKey: "modal_title_user_profile",
        htmlContent: profileContent, // Pass the constructed div
        customActions: [
            {
                textKey: "button_profile_logout",
                className: "ui-button primary logout-button", // Ensure 'logout-button' class for distinct styling
                onClick: async () => {
                    _authService.handleLogout();
                    _modalManager.hideCustomModal();
                    updateAuthUIState();
                    if (_gameControllerRef) {
                        await _gameControllerRef.switchToLanding(); // Ensure UI reflects logout
                    }
                }
            },
            {
                textKey: "modal_cancel_button", // Or "modal_ok_button" if just "Close"
                className: "ui-button",
                onClick: () => {
                    _modalManager.hideCustomModal();
                }
            }
        ]
    });
}

/**
 * Shows a modal for changing the user's password.
 */
export async function showChangePasswordModal() {
    log(LOG_LEVEL_DEBUG, "Showing change password modal.");
    _modalManager.showCustomModal({
        type: "form",
        titleKey: "modal_title_change_password",
        formFields: [
            { id: "currentPassword", labelKey: "label_current_password", type: "password", placeholderKey: "placeholder_current_password", required: true },
            { id: "newPassword", labelKey: "label_new_password", type: "password", placeholderKey: "placeholder_new_password", required: true },
            { id: "confirmNewPassword", labelKey: "label_confirm_new_password", type: "password", placeholderKey: "placeholder_confirm_new_password", required: true },
        ],
        confirmTextKey: "button_profile_change_password", // Re-using button text
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
            await _authService.handleChangePassword(currentPassword, newPassword);
            // If successful, showCustomModal's promise resolves, and .then can handle success alert
            return { success: true, actionAfterClose: 'showPasswordChangeSuccessAlert' };
        },
    }).then(result => {
        if (result && result.success && result.actionAfterClose === 'showPasswordChangeSuccessAlert') {
            _modalManager.showCustomModal({
                type: "alert",
                titleKey: "alert_password_change_success_title",
                messageKey: "alert_password_change_success_message"
            });
        }
    }).catch(error => {
        // Error already displayed in form modal by showCustomModal logic
        log(LOG_LEVEL_DEBUG, "Change password modal onSubmit error handled or modal cancelled.");
    });
}


/**
 * Displays a modal informing the user their email is not confirmed,
 * and provides an option to resend the confirmation email.
 * @param {string} unconfirmedEmail The email address that needs confirmation.
 */
export async function showEmailNotConfirmedModal(unconfirmedEmail) {
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

                try {
                    // Use public resend as user might not be fully logged in "session-wise"
                    const result = await _authService.handlePublicResendConfirmation(unconfirmedEmail);
                    // Update modal content to show success message
                    const modalMessageArea = document.getElementById('custom-modal-message');
                    if (modalMessageArea) {
                        modalMessageArea.innerHTML = ''; // Clear previous instruction
                        const successP = document.createElement('p');
                        successP.textContent = result.message; // Use message from API
                        successP.style.color = 'var(--color-status-ok-text)';
                        modalMessageArea.appendChild(successP);
                    }
                    clickedButtonElement.style.display = 'none'; // Hide resend button
                    // Ensure there's an OK/Close button, or change existing one
                    const modalActionsArea = document.getElementById('custom-modal-actions');
                    let closeButton = modalActionsArea ? modalActionsArea.querySelector('.ui-button:not(.primary)') : null;
                    if(!closeButton && modalActionsArea){ // If only primary was there, find it.
                         closeButton = modalActionsArea.querySelector('.ui-button.primary');
                    }

                    if (!closeButton && modalActionsArea) { // If no button existed, create one
                        closeButton = document.createElement('button');
                        closeButton.className = 'ui-button';
                        modalActionsArea.appendChild(closeButton);
                    }
                    if (closeButton) {
                        closeButton.textContent = getUIText("modal_ok_button");
                        if (!closeButton.onclick) { // Add click listener if it's a new/repurposed button
                            closeButton.addEventListener('click', () => _modalManager.hideCustomModal());
                        }
                    }

                } catch (resendError) {
                    log(LOG_LEVEL_ERROR, `Failed to resend confirmation email: ${resendError.message}`);
                     _modalManager.displayModalError(getUIText("error_api_call_failed", { ERROR_MSG: resendError.message || "Failed to resend email." }));
                    clickedButtonElement.disabled = false;
                    clickedButtonElement.textContent = originalButtonText;
                    setTimeout(() => {
                        resendCooldownActive = false;
                        if (document.body.contains(clickedButtonElement)) {
                            clickedButtonElement.disabled = false;
                        }
                    }, 30000); // 30-second cooldown
                }
            }
        },
        {
            textKey: "modal_cancel_button",
            className: "ui-button",
            onClick: () => {
                _modalManager.hideCustomModal();
            }
        }
    ];

    _modalManager.showCustomModal({
        type: "custom", // Using custom to allow more control over actions and message updates
        titleKey: "modal_title_email_not_confirmed",
        messageKey: "message_email_not_confirmed_instruction",
        replacements: { USER_EMAIL: unconfirmedEmail },
        customActions: customActions,
    });
}


/**
 * Displays a dedicated page or view for email confirmation status.
 * @param {string} status - The status of the email confirmation (e.g., 'success', 'invalid_token').
 */
export function displayEmailConfirmationStatusPage(status) {
    log(LOG_LEVEL_INFO, `Displaying email confirmation status page: ${status}`);
    // Hide main game/landing UI elements
    if (themeGridContainer) themeGridContainer.style.display = 'none';
    if (storyLogViewport) storyLogViewport.style.display = 'none';
    if (playerInputControlPanel) playerInputControlPanel.style.display = 'none';
    if (suggestedActionsWrapper) suggestedActionsWrapper.style.display = 'none';
    if (leftPanel) leftPanel.innerHTML = ''; // Clear side panels
    if (rightPanel) rightPanel.innerHTML = '';
    if (applicationHeader) applicationHeader.style.display = 'none'; // Hide full header

    const centerColumn = document.getElementById('center-column');
    if (!centerColumn) {
        log(LOG_LEVEL_ERROR, "Center column element not found for email confirmation page.");
        return;
    }
    centerColumn.innerHTML = ''; // Clear current content
    if(appRoot) appRoot.className = 'auth-page-active theme-landing'; // Apply base styling

    const container = document.createElement('div');
    container.className = 'email-confirmation-container';

    const title = document.createElement('h2');
    title.textContent = getUIText("email_confirmation_status_page_title");
    container.appendChild(title);

    let messageKey = "";
    let messageClass = "status-info"; // Default CSS class for the message
    switch (status) {
        case "success": messageKey = "email_confirmation_success"; messageClass = "status-success"; break;
        case "invalid_token": messageKey = "email_confirmation_invalid_token"; messageClass = "status-error"; break;
        case "already_confirmed": messageKey = "email_confirmation_already_confirmed"; messageClass = "status-info"; break;
        case "expired_token": messageKey = "email_confirmation_expired_token"; messageClass = "status-error"; break;
        case "server_error": messageKey = "email_confirmation_server_error"; messageClass = "status-error"; break;
        default:
            log(LOG_LEVEL_WARN, "Unknown email confirmation status for display:", status);
            messageKey = "email_confirmation_invalid_token"; messageClass = "status-error";
    }

    const messageP = document.createElement('p');
    messageP.innerHTML = getUIText(messageKey).replace(/\n/g, "<br>");
    messageP.classList.add(messageClass);
    container.appendChild(messageP);

    const backButton = document.createElement('button');
    backButton.className = 'ui-button primary';
    backButton.textContent = (status === "success" || status === "already_confirmed") ? getUIText("button_login") : getUIText("button_new_game");
    backButton.addEventListener('click', () => {
        if (status === "success" || status === "already_confirmed") {
            window.location.href = '/?action=showLogin';
        } else {
            window.location.href = '/';
        }
    });
    container.appendChild(backButton);
    centerColumn.appendChild(container);
}

/**
 * Displays a dedicated page or view for resetting the password.
 * @param {string} token - The password reset token from the URL.
 * @param {Function} onPasswordResetSubmit - Async callback from authService.handleResetPassword.
 */
export function displayPasswordResetPage(token, onPasswordResetSubmit) {
    log(LOG_LEVEL_INFO, `Displaying password reset page for token (first 10): ${token.substring(0, 10)}...`);
    if (themeGridContainer) themeGridContainer.style.display = 'none';
    if (storyLogViewport) storyLogViewport.style.display = 'none';
    // ... (hide other main UI elements as in displayEmailConfirmationStatusPage)
    if (playerInputControlPanel) playerInputControlPanel.style.display = 'none';
    if (suggestedActionsWrapper) suggestedActionsWrapper.style.display = 'none';
    if (leftPanel) leftPanel.innerHTML = '';
    if (rightPanel) rightPanel.innerHTML = '';
    if (applicationHeader) applicationHeader.style.display = 'none';


    const centerColumn = document.getElementById('center-column');
    if (!centerColumn) return;
    centerColumn.innerHTML = '';
    if(appRoot) appRoot.className = 'auth-page-active theme-landing';

    // Use modalManager to display the form, adapted for a full-page feel
    _modalManager.showCustomModal({
        type: "form",
        titleKey: "modal_title_reset_password",
        // No messageKey needed if it's a full page form directly.
        formFields: [
            { id: "newPasswordReset", labelKey: "label_new_password", type: "password", placeholderKey: "placeholder_new_password", required: true },
            { id: "confirmNewPasswordReset", labelKey: "label_confirm_new_password", type: "password", placeholderKey: "placeholder_confirm_new_password", required: true }
        ],
        confirmTextKey: "button_reset_password",
        // onSubmit is called by modalManager, which gets it from here
        onSubmit: async (formData) => {
            const newPassword = formData.newPasswordReset;
            const confirmNewPassword = formData.confirmNewPasswordReset;

            if (newPassword.length < 8) {
                throw new Error(getUIText("alert_new_password_too_short"));
            }
            if (newPassword !== confirmNewPassword) {
                throw new Error(getUIText("alert_passwords_do_not_match"));
            }
            try {
                const result = await onPasswordResetSubmit(token, newPassword); // This is authService.handleResetPassword
                // On success, modalManager will close the current modal.
                // We then show a success alert.
                return { success: true, actionAfterClose: 'showPasswordResetSuccessAlert', data: result };
            } catch (error) {
                log(LOG_LEVEL_ERROR, "Password reset submission failed via authUiManager:", error);
                 // Add specific error message for expired/invalid token
                let detailedErrorMessage = error.message;
                if (error.message.includes("Invalid or expired password reset token") || error.message.includes("Password reset token has expired")) {
                    detailedErrorMessage += ` ${getUIText("text_try_request_again")}`;
                }
                throw new Error(detailedErrorMessage); // Re-throw for modalManager to display
            }
        },
        // Make it non-cancellable or style cancel differently for full page effect
        customActions: [ /* Only the primary submit action will be generated by default form type */ ]
    }).then(result => {
        if (result && result.success && result.actionAfterClose === 'showPasswordResetSuccessAlert') {
            _modalManager.showCustomModal({
                type: "alert",
                titleKey: "alert_password_reset_success_title",
                messageText: result.data.message, // Assuming API response has { message: "..." }
                customActions: [{
                    textKey: "button_login",
                    className: "ui-button primary",
                    onClick: () => {
                        window.location.href = '/?action=showLogin';
                    }
                }]
            });
        }
    }).catch(error => {
        // This catch is for when the modal display itself fails or the promise is rejected
        // for reasons other than onSubmit error (which is handled by modalManager).
        log(LOG_LEVEL_ERROR, "Error related to password reset modal display/promise:", error);
        // If the modal fails to show, or there's an unhandled rejection, redirect to home.
        if (!document.getElementById('custom-modal-overlay')?.classList.contains('active')) {
            window.location.href = '/';
        }
    });
}
