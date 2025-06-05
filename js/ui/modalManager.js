// js/ui/modalManager.js
/**
 * @file Provides a generic system for displaying various types of modals
 * (alert, confirm, prompt, form). Implements specific modal views for
 * authentication, password changes, confirmations, etc.
 */
import {
    customModalOverlay,
    customModal,
    customModalTitle,
    customModalMessage,
    customModalInputContainer,
    customModalInput,
    customModalActions
} from './domElements.js';
import { getUIText } from '../services/localizationService.js';
import { log, LOG_LEVEL_ERROR, LOG_LEVEL_WARN, LOG_LEVEL_DEBUG } from '../core/logger.js';
import { getCurrentTheme } from '../core/state.js'; // To pass theme context for localization

let _activeOverlayClickListener = null;
let currentModalResolve = null;
const customModalFormContainer = document.createElement('div'); // Dynamically added/removed
customModalFormContainer.id = 'custom-modal-form-container';

/**
 * Hides the currently active custom modal.
 * This is typically called by modal action buttons or externally if needed.
 */
export function hideCustomModal() {
    if (customModalOverlay) {
        // 1. Clear all dynamic content from the modal structure first.
        if (customModalTitle) customModalTitle.textContent = "";
        if (customModalMessage) customModalMessage.innerHTML = ""; // Clears message, and form/input containers if they are children
        if (customModalActions) customModalActions.innerHTML = "";

        // Explicitly reset standalone prompt input value
        if (customModalInput) customModalInput.value = "";

        // Ensure input container and form container are handled if they were not children of customModalMessage
        if (customModalInputContainer && customModalInputContainer.style.display !== "none") {
            if (!customModalMessage || !customModalMessage.contains(customModalInputContainer)) {
                customModalInputContainer.style.display = "none";
            }
        }
        if (customModalFormContainer && customModalFormContainer.innerHTML !== "") {
            if (!customModalMessage || !customModalMessage.contains(customModalFormContainer)) {
                 customModalFormContainer.innerHTML = "";
            }
        }
        // Clear any persistent error messages that might have been added to customModalMessage
        const errorDisplay = customModalMessage ? customModalMessage.querySelector('.modal-error-display') : null;
        if (errorDisplay) errorDisplay.remove();


        // 2. Remove the overlay click listener.
        if (_activeOverlayClickListener) {
            customModalOverlay.removeEventListener('click', _activeOverlayClickListener);
            _activeOverlayClickListener = null;
        }

        // 3. Now that the modal is visually empty and listeners are cleaned, start the fade-out.
        customModalOverlay.classList.remove("active");

        log(LOG_LEVEL_DEBUG, "Custom modal content cleared, event listener removed, and fade-out initiated.");
    }
    // 4. Clear any pending promise resolver.
    currentModalResolve = null;
}

/**
 * Displays an error message within the modal's message area or a specified container.
 * @param {string} messageText - The error message to display.
 * @param {HTMLElement} [containerElement=customModalMessage] - The container to append the error to.
 */
export function displayModalError(messageText, containerElement = customModalMessage) {
    if (!containerElement) {
        log(LOG_LEVEL_WARN, "displayModalError: containerElement is null or undefined for message:", messageText);
        return;
    }

    // Remove any existing error messages from this specific container
    const existingError = containerElement.querySelector('.modal-error-display');
    if (existingError) existingError.remove();

    const errorDisplay = document.createElement('p');
    errorDisplay.className = 'modal-error-display'; // For specific styling
    errorDisplay.style.color = 'var(--color-meter-critical)'; // Default error color
    errorDisplay.style.marginTop = 'var(--spacing-sm)';
    errorDisplay.style.marginBottom = 'var(--spacing-sm)';
    errorDisplay.textContent = messageText;

    // Prepend error if it's in the main message area, otherwise append
    if (containerElement === customModalMessage) {
        containerElement.insertBefore(errorDisplay, containerElement.firstChild);
    } else {
        containerElement.appendChild(errorDisplay);
    }
}


/**
 * Shows a custom modal and returns a Promise that resolves with the user's interaction.
 * @param {object} options - Configuration for the modal.
 * @param {'alert'|'confirm'|'prompt'|'form'|'custom'} [options.type='alert'] - Type of modal.
 * @param {string} options.titleKey - Localization key for the modal title.
 * @param {string} [options.messageKey] - Localization key for a static message.
 * @param {string|HTMLElement} [options.htmlContent] - Raw HTML string or HTMLElement to inject into message area.
 * @param {Array<object>} [options.formFields] - Array of field configs for 'form' type.
 *   Each field: { id, labelKey, type, placeholderKey, required, value (initial) }
 * @param {object} [options.replacements={}] - Replacements for titleKey/messageKey.
 * @param {string} [options.confirmTextKey] - Localization key for confirm button.
 * @param {string} [options.cancelTextKey] - Localization key for cancel button.
 * @param {string} [options.inputPlaceholderKey] - Placeholder for 'prompt' type.
 * @param {string} [options.defaultValue=''] - Default value for 'prompt' type.
 * @param {string|null} [options.explicitThemeContext=null] - Theme context for localization.
 * @param {Function} [options.onSubmit] - Async callback for 'form' type. Receives formData.
 *   Should return Promise<{ success: boolean, error?: Error, keepOpen?: boolean, actionAfterClose?: string, data?: any }>.
 *   If onSubmit throws, it's caught and displayed. If it returns { keepOpen: true }, modal stays.
 * @param {Array<object>} [options.customActions] - Custom buttons: { textKey, className, onClick(buttonElement): void|Promise<void> }
 * @returns {Promise<any>} Resolves with input value (prompt), boolean (confirm/form success without data),
 *                         form data (form success with data), or null (alert/cancel).
 */
export function showCustomModal(options) {
    return new Promise((resolve) => {
        currentModalResolve = resolve; // Store resolve for button handlers
        const {
            type = 'alert', titleKey, messageKey, htmlContent, formFields,
            replacements = {}, confirmTextKey, cancelTextKey,
            inputPlaceholderKey, defaultValue = '', explicitThemeContext = null,
            onSubmit, customActions
        } = options;
        if (!customModalOverlay || !customModalTitle || !customModalMessage || !customModalActions) {
            log(LOG_LEVEL_ERROR, "Custom modal core DOM elements not found! Cannot display modal.");
            if (currentModalResolve) currentModalResolve(type === 'prompt' ? null : (type === 'confirm' || type === 'form') ? false : null);
            return;
        }

        const modalThemeContext = explicitThemeContext || getCurrentTheme();
        let confirmBtnRef = null; // A reference to the confirm button that the handler can use

        // Determine the default confirm button text key based on modal type
        let defaultConfirmKey = "modal_ok_button";
        if (type === "confirm" || type === "form") defaultConfirmKey = "modal_confirm_button";
        else if (type === "prompt") defaultConfirmKey = "modal_confirm_button"; // "OK" or "Submit"

        // This handler contains all the logic for confirming the modal, so it can be called by a button click or an Enter key press.
        const handleConfirm = async () => {
            let modalShouldClose = true;
            let resolveValue;
            if (type === "form" || (formFields && formFields.length > 0)) {
                const formData = {};
                let firstInvalidField = null;
                let isValid = true;
                // Clear previous form errors
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
                            displayModalError(getUIText("alert_invalid_email_format"), inputElement.parentElement);
                        }
                    }
                });
                if (!isValid) {
                    if (firstInvalidField) firstInvalidField.focus();
                    log(LOG_LEVEL_WARN, "Modal form validation failed.");
                    if (!customModalFormContainer.querySelector('.modal-error-display[data-general-error="true"]')) { // Avoid duplicate general errors
                       const generalErrorContainer = customModalFormContainer.closest('.modal-box').querySelector('.modal-message') || customModalFormContainer;
                       displayModalError(getUIText("alert_fill_required_fields"), generalErrorContainer);
                    }
                    return; // Don't proceed
                }
                if (onSubmit) {
                    try {
                        if (confirmBtnRef) {
                            confirmBtnRef.disabled = true;
                            confirmBtnRef.textContent = getUIText("system_processing_short"); // Loading state
                        }
                        const resultFromOnSubmit = await onSubmit(formData);
                        if (typeof resultFromOnSubmit === 'object' && resultFromOnSubmit !== null) {
                            resolveValue = resultFromOnSubmit;
                            if (resultFromOnSubmit.keepOpen === true) {
                                modalShouldClose = false;
                            }
                        } else { // For simpler onSubmit that just returns true/false or data
                            resolveValue = { success: resultFromOnSubmit !== false, data: resultFromOnSubmit };
                        }
                    } catch (error) {
                        log(LOG_LEVEL_ERROR, "Error in modal onSubmit:", error);
                        displayModalError(error.message || getUIText("error_api_call_failed", { ERROR_MSG: "Operation failed" }), customModalFormContainer);
                        modalShouldClose = false; // Keep open on error from onSubmit
                        resolveValue = { success: false, error: error };
                    } finally {
                        if (confirmBtnRef && document.body.contains(confirmBtnRef)) { // Check if button is still in DOM
                            confirmBtnRef.disabled = false;
                            confirmBtnRef.textContent = getUIText(confirmTextKey || defaultConfirmKey, {}, { explicitThemeContext: modalThemeContext });
                        }
                    }
                } else {
                    resolveValue = formData; // Resolve with form data if no onSubmit
                }
            } else if (type === "prompt" && customModalInput) {
                resolveValue = customModalInput.value;
            } else if (type === "confirm") {
                resolveValue = true;
            } else { // alert
                resolveValue = null;
            }
            if (currentModalResolve) {
                currentModalResolve(resolveValue);
            }
            if (modalShouldClose) {
                hideCustomModal();
            }
        };

        customModalTitle.textContent = getUIText(titleKey || `modal_default_title_${type}`, replacements, { explicitThemeContext: modalThemeContext });
        // Clear previous content
        customModalMessage.innerHTML = "";
        customModalFormContainer.innerHTML = "";
        if (customModalInputContainer) customModalInputContainer.style.display = "none";

        if (messageKey) {
            const staticMessageP = document.createElement('p');
            staticMessageP.innerHTML = getUIText(messageKey, replacements, { explicitThemeContext: modalThemeContext }).replace(/\n/g, "<br>");
            customModalMessage.appendChild(staticMessageP);
        }
        if (htmlContent) {
            if (typeof htmlContent === 'string') {
                customModalMessage.insertAdjacentHTML('beforeend', htmlContent);
            } else if (htmlContent instanceof HTMLElement) {
                customModalMessage.appendChild(htmlContent);
            }
        }

        if (type === "form" || (formFields && formFields.length > 0)) {
            customModalMessage.appendChild(customModalFormContainer); // Add form container
            formFields.forEach(field => {
                const fieldGroup = document.createElement('div');
                fieldGroup.classList.add('modal-form-group');
                const label = document.createElement('label');
                label.htmlFor = field.id;
                label.textContent = getUIText(field.labelKey, {}, { explicitThemeContext: modalThemeContext });
                fieldGroup.appendChild(label);
                const input = document.createElement('input');
                input.type = field.type || 'text';
                input.id = field.id;
                input.name = field.id; // Important for form data collection
                if (field.placeholderKey) input.placeholder = getUIText(field.placeholderKey, {}, { explicitThemeContext: modalThemeContext });
                if (field.value) input.value = field.value;
                if (field.required) input.required = true;
                input.classList.add('modal-input');
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleConfirm();
                    }
                });
                fieldGroup.appendChild(input);
                customModalFormContainer.appendChild(fieldGroup);
            });
        } else if (type === "prompt") {
            if (customModalInputContainer && customModalInput) {
                customModalInputContainer.style.display = "block";
                customModalMessage.appendChild(customModalInputContainer);
                customModalInput.value = defaultValue;
                customModalInput.placeholder = inputPlaceholderKey ? getUIText(inputPlaceholderKey, {}, { explicitThemeContext: modalThemeContext }) : "";
                customModalInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        handleConfirm();
                    }
                });
            }
        }

        customModalActions.innerHTML = ""; // Clear previous actions
        if (customActions && Array.isArray(customActions) && customActions.length > 0) {
            customActions.forEach(actionConfig => {
                const btn = document.createElement("button");
                btn.className = actionConfig.className || "ui-button";
                btn.textContent = getUIText(actionConfig.textKey, {}, { explicitThemeContext: modalThemeContext });
                btn.addEventListener("click", async () => { // Make listener async if onClick can be
                    if (actionConfig.onClick) {
                        try {
                            await actionConfig.onClick(btn); // Allow onClick to be async
                        } catch(e) {
                            log(LOG_LEVEL_ERROR, `Error in custom action button's onClick for ${actionConfig.textKey}:`, e);
                            displayModalError(e.message || "An unexpected error occurred in the action.");
                        }
                    }
                });
                customModalActions.appendChild(btn);
            });
        } else {
            // Default button logic
            const confirmBtn = document.createElement("button");
            confirmBtn.classList.add("ui-button", "primary");
            confirmBtn.textContent = getUIText(confirmTextKey || defaultConfirmKey, {}, { explicitThemeContext: modalThemeContext });
            confirmBtnRef = confirmBtn; // Assign the created button to the reference
            confirmBtn.addEventListener("click", handleConfirm);
            customModalActions.appendChild(confirmBtn);

            if (type === "confirm" || type === "prompt" || type === "form" || (formFields && formFields.length > 0)) {
                const cancelBtn = document.createElement("button");
                cancelBtn.classList.add("ui-button");
                cancelBtn.textContent = getUIText(cancelTextKey || "modal_cancel_button", {}, { explicitThemeContext: modalThemeContext });
                cancelBtn.addEventListener("click", () => {
                    if (currentModalResolve) currentModalResolve(type === 'prompt' ? null : (type === 'form' ? null : false));
                    hideCustomModal();
                });
                customModalActions.appendChild(cancelBtn);
            }
        }

        customModalOverlay.classList.add("active");
        // Add click listener to overlay for "click outside to close"
        if (_activeOverlayClickListener) { // Remove any old listener first
            customModalOverlay.removeEventListener('click', _activeOverlayClickListener);
        }
        _activeOverlayClickListener = (event) => {
            if (event.target === customModalOverlay) {
                log(LOG_LEVEL_DEBUG, "Modal overlay clicked, attempting to close modal.");
                if (currentModalResolve) {
                    currentModalResolve(null);
                }
                hideCustomModal();
            }
        };
        customModalOverlay.addEventListener('click', _activeOverlayClickListener);

        // Focus logic
        if ((type === "form" || (formFields && formFields.length > 0)) && customModalFormContainer.querySelector('input:not([type=hidden])')) {
            setTimeout(() => {
                const firstInput = customModalFormContainer.querySelector('input:not([type=hidden])');
                if (firstInput && document.body.contains(firstInput)) firstInput.focus();
            }, 50);
        } else if (type === "prompt" && customModalInput) {
            setTimeout(() => {
                if(document.body.contains(customModalInput)) customModalInput.focus();
            }, 50);
        } else if (customModalActions.firstChild && typeof customModalActions.firstChild.focus === 'function') {
             setTimeout(() => {
                if(document.body.contains(customModalActions.firstChild)) customModalActions.firstChild.focus();
             }, 50); // Focus first button as fallback
        }
    });
}

// --- Specific Modal Orchestrators ---

/**
 * Shows an authentication modal (login or register).
 * @param {'login'|'register'} [initialMode='login'] - The mode to open the modal in.
 * @param {Function} onAuthSuccess - Callback function when authentication (login/register) is successful.
 *                                   Receives user data from the API.
 */
export async function showAuthFormModal(initialMode = 'login', onAuthSuccess) {
    log(LOG_LEVEL_DEBUG, `Showing auth form modal in '${initialMode}' mode.`);
    let currentAuthMode = initialMode;

    const renderAndShow = () => {
        const isLogin = currentAuthMode === 'login';
        const titleKey = isLogin ? "modal_title_login" : "modal_title_register";
        const confirmTextKey = isLogin ? "button_login" : "button_register";
        const formFields = [
            { id: "authEmail", labelKey: "label_email", type: "email", placeholderKey: "placeholder_email", required: true },
            { id: "authPassword", labelKey: "label_password", type: "password", placeholderKey: isLogin ? "placeholder_password" : "placeholder_password_register", required: true }
        ];

        // HTML content for switching between login/register and forgot password
        const linksContainer = document.createElement('div');
        linksContainer.className = 'auth-modal-links';

        if (isLogin) {
            const forgotPasswordLink = document.createElement('a');
            forgotPasswordLink.href = '#';
            forgotPasswordLink.textContent = getUIText("button_forgot_password");
            forgotPasswordLink.className = 'forgot-password-link'; // For styling if needed
            forgotPasswordLink.addEventListener('click', (e) => {
                e.preventDefault();
                hideCustomModal(); // Close current auth modal
                showForgotPasswordRequestModal(onAuthSuccess); // Show the forgot password modal
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
            // Instead of hideCustomModal() then renderAndShow(), we might need a way to re-render content within the active modal
            // For now, simplicity dictates closing and reopening.
            hideCustomModal();
            renderAndShow();
        });
        linksContainer.appendChild(switchAuthModeLink);

        showCustomModal({
            type: "form",
            titleKey: titleKey,
            formFields: formFields,
            htmlContent: linksContainer, // Inject the links
            confirmTextKey: confirmTextKey,
            onSubmit: async (formData) => {
                const { authEmail, authPassword } = formData;
                try {
                    let result;
                    if (isLogin) {
                        result = await onAuthSuccess({ mode: 'login', email: authEmail, password: authPassword });
                    } else { // register
                        result = await onAuthSuccess({ mode: 'register', email: authEmail, password: authPassword });
                    }
                    return result; // { success: true, data: userData } or { success: true, actionAfterClose: 'showXYZ' }
                } catch (error) {
                    log(LOG_LEVEL_ERROR, `${currentAuthMode} failed from modal onSubmit:`, error.message);
                    throw error; // Re-throw to be caught by showCustomModal's internal error handling
                }
            },
        }).then(result => { // This .then is after showCustomModal's promise resolves
            if (result && result.success && result.actionAfterClose === 'showRegistrationSuccessAlert') {
                const registeredEmail = result.data?.user?.email || '';
                showCustomModal({
                    type: "alert",
                    titleKey: "alert_registration_success_title",
                    messageKey: "alert_registration_success_check_email_message",
                    replacements: { USER_EMAIL: registeredEmail },
                });
            } else if (result && result.success && currentAuthMode === 'login') {
                // Login success handled by onAuthSuccess, modal closes by default
            }
        }).catch(error => {
            // Errors from onSubmit (like validation or API errors) are usually handled within showCustomModal
            // This catch is more for unhandled issues with the modal promise itself
            log(LOG_LEVEL_ERROR, "Error from showAuthFormModal's main promise chain:", error);
        });
    };

    renderAndShow(); // Initial render
}

/**
 * Shows the "Forgot Password" request modal.
 * @param {Function} onAuthSuccess - The main auth success callback (indirectly used if reset leads to login).
 */
export async function showForgotPasswordRequestModal(onAuthSuccess) {
    await showCustomModal({
        type: "form",
        titleKey: "modal_title_forgot_password",
        formFields: [
            { id: "resetEmail", labelKey: "label_email", type: "email", placeholderKey: "placeholder_email", required: true }
        ],
        confirmTextKey: "button_send_reset_link",
        onSubmit: async (formData) => {
            const email = formData.resetEmail;
            // Directly call the authService function that calls the API
            // This relies on authService.handleForgotPassword to throw on error
            const response = await onAuthSuccess({ mode: 'forgotPassword', email: email }); // Using onAuthSuccess to trigger authService
            return { success: true, message: response.message, actionAfterClose: 'showResetRequestSentAlert' };
        }
    }).then(result => {
        if (result && result.actionAfterClose === 'showResetRequestSentAlert' && result.message) {
            showCustomModal({
                type: "alert",
                titleKey: "alert_reset_link_sent_title",
                messageText: result.message // Use message directly from API response
            });
        }
    }).catch(error => {
        // Error already displayed within the form modal by showCustomModal's onSubmit handling
        log(LOG_LEVEL_DEBUG, "Forgot password request modal onSubmit error handled, or modal cancelled.");
    });
}


/**
 * Shows a modal for changing the user's password.
 * @param {Function} onChangePasswordSubmit - Async function (currentPassword, newPassword) => Promise<response>
 */
export async function showChangePasswordFormModal(onChangePasswordSubmit) {
    log(LOG_LEVEL_DEBUG, "Showing change password form modal.");
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
            // Call the passed-in submit handler which should interact with authService
            await onChangePasswordSubmit(currentPassword, newPassword);
            return { success: true, actionAfterClose: 'showPasswordChangeSuccessAlert' };
        },
    }).then(result => {
        if (result && result.success && result.actionAfterClose === 'showPasswordChangeSuccessAlert') {
            showCustomModal({
                type: "alert",
                titleKey: "alert_password_change_success_title",
                messageKey: "alert_password_change_success_message"
            });
        }
    }).catch(error => {
        log(LOG_LEVEL_DEBUG, "Change password modal onSubmit error handled, or modal cancelled.");
    });
}

/**
 * Shows a generic confirmation modal.
 * @param {object} options - Options for the confirmation modal.
 * @param {string} options.titleKey - Localization key for the title.
 * @param {string} options.messageKey - Localization key for the message.
 * @param {object} [options.replacements={}] - Replacements for localization.
 * @param {string} [options.confirmTextKey="modal_confirm_button"] - Confirm button text key.
 * @param {string} [options.cancelTextKey="modal_cancel_button"] - Cancel button text key.
 * @param {string|null} [options.explicitThemeContext=null] - Theme context for localization.
 * @returns {Promise<boolean>} True if confirmed, false if cancelled.
 */
export async function showGenericConfirmModal({
    titleKey,
    messageKey,
    messageText, // Allow direct text for simplicity sometimes
    replacements = {},
    confirmTextKey = "modal_confirm_button",
    cancelTextKey = "modal_cancel_button",
    explicitThemeContext = null
}) {
    log(LOG_LEVEL_DEBUG, `Showing generic confirm modal: ${titleKey} / ${messageKey || messageText}`);
    const result = await showCustomModal({
        type: "confirm",
        titleKey,
        messageKey: messageKey, // Pass key if available
        htmlContent: !messageKey && messageText ? `<p>${messageText.replace(/\n/g, "<br>")}</p>` : undefined, // Pass direct text if key isn't
        replacements,
        confirmTextKey,
        cancelTextKey,
        explicitThemeContext
    });
    return !!result; // Coerce to boolean (true for confirm, false for cancel/close)
}
