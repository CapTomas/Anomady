// js/ui/tooltipManager.js
/**
 * @file Manages the display and behavior of custom tooltips.
 */
import { getUIText } from '../services/localizationService.js';
import { log, LOG_LEVEL_DEBUG } from '../core/logger.js';
import { getCurrentTheme } from '../core/state.js';

let tooltipElement;
const TOOLTIP_OFFSET_Y = 10; // px offset from the element vertically
const TOOLTIP_OFFSET_X = 0; // px offset from the element horizontally
const FADE_DURATION = 150; // ms for fade in/out
const SHOW_DELAY = 100; // ms, delay before showing tooltip on mouseenter to prevent fly-by triggering
const HIDE_DELAY = 75; // ms, delay before starting to hide the tooltip on mouseleave

let currentHoverTarget = null; // The element currently being hovered, for which a tooltip might be shown
let currentFocusTarget = null; // The element currently focused, for which a tooltip might be shown

let showTimeoutId = null;
let hideTimeoutId = null;
let animationCleanupTimeoutId = null;


/**
 * Creates the tooltip DOM element and appends it to the body.
 * @private
 */
function _createTooltipElement() {
    tooltipElement = document.createElement('div');
    tooltipElement.id = 'custom-tooltip';
    tooltipElement.style.position = 'absolute';
    tooltipElement.style.zIndex = '1001';
    tooltipElement.style.backgroundColor = 'var(--color-bg-input-area, #252525)';
    tooltipElement.style.color = 'var(--color-text-primary, #d1d1d6)';
    tooltipElement.style.padding = 'var(--spacing-xs, 4px) var(--spacing-sm, 8px)';
    tooltipElement.style.borderRadius = 'var(--radius-md, 12px)';
    tooltipElement.style.fontSize = 'var(--font-size-xs, 0.75rem)';
    tooltipElement.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3)';
    tooltipElement.style.opacity = '0';
    tooltipElement.style.visibility = 'hidden';
    tooltipElement.style.transition = `opacity ${FADE_DURATION}ms ease-out, visibility 0s linear ${FADE_DURATION}ms`;
    tooltipElement.style.pointerEvents = 'none';
    tooltipElement.style.maxWidth = '800px';
    tooltipElement.style.textAlign = 'center';
    document.body.appendChild(tooltipElement);
    log(LOG_LEVEL_DEBUG, "Custom tooltip element created and appended to body.");
}

/**
 * Shows the tooltip UI with the specified text near the target element.
 * @param {HTMLElement} targetElement - The element to show the tooltip for.
 * @param {string} textKey - The localization key for the tooltip text.
 * @param {object} textReplacements - Replacements for the text key.
 * @param {object} textOptions - Options for getUIText.
 * @private
 */
function _displayTooltipUI(targetElement, textKey, textReplacements, textOptions) {
    if (!tooltipElement) {
        _createTooltipElement();
    }
    if (!tooltipElement || !targetElement) return;

    clearTimeout(animationCleanupTimeoutId); // Cancel any pending animation cleanup

    const explicitThemeContext = textOptions.explicitThemeContext || getCurrentTheme();
    tooltipElement.textContent = getUIText(textKey, textReplacements, { ...textOptions, explicitThemeContext });

    // Temporarily make visible to measure dimensions for accurate positioning
    tooltipElement.style.visibility = 'hidden'; // Keep it hidden but layout-affecting
    tooltipElement.style.opacity = '0';       // Ensure it's transparent
    tooltipElement.style.display = 'block'; // Ensure it takes space for measurement

    const currentTooltipWidth = tooltipElement.offsetWidth;
    const currentTooltipHeight = tooltipElement.offsetHeight;

    tooltipElement.style.display = ''; // Reset display property

    const targetRect = targetElement.getBoundingClientRect();
    let top = targetRect.bottom + window.scrollY + TOOLTIP_OFFSET_Y;
    let left = targetRect.left + window.scrollX + (targetRect.width / 2) - (currentTooltipWidth / 2) + TOOLTIP_OFFSET_X;

    // Adjust if tooltip goes off screen (right edge)
    if (left + currentTooltipWidth > window.innerWidth - TOOLTIP_OFFSET_Y) {
        left = window.innerWidth - currentTooltipWidth - TOOLTIP_OFFSET_Y;
    }
    // Adjust if tooltip goes off screen (left edge)
    if (left < TOOLTIP_OFFSET_Y) {
        left = TOOLTIP_OFFSET_Y;
    }
  // Top is initially calculated for bottom placement:
    const overflowsViewportBottom = (top + currentTooltipHeight) > (window.innerHeight + window.scrollY - TOOLTIP_OFFSET_Y);

    const hasClearSpaceAbove = (targetRect.top - (currentTooltipHeight + TOOLTIP_OFFSET_Y * 2)) > 0;

    if (overflowsViewportBottom && hasClearSpaceAbove) {
        top = targetRect.top + window.scrollY - currentTooltipHeight - TOOLTIP_OFFSET_Y;
    } else if (overflowsViewportBottom) {
        top = (window.innerHeight + window.scrollY) - currentTooltipHeight - TOOLTIP_OFFSET_Y;
    }
    if (top < window.scrollY + TOOLTIP_OFFSET_Y) {
        top = window.scrollY + TOOLTIP_OFFSET_Y;
    }

    tooltipElement.style.left = `${left}px`;
    tooltipElement.style.top = `${top}px`;
    tooltipElement.style.visibility = 'visible';
    tooltipElement.style.opacity = '1';
    tooltipElement.style.transition = `opacity ${FADE_DURATION}ms ease-out, visibility 0s linear 0s`;
}

/**
 * Hides the tooltip UI.
 * @private
 */
function _hideTooltipUI() {
    if (tooltipElement) {
        tooltipElement.style.opacity = '0';
        tooltipElement.style.transition = `opacity ${FADE_DURATION}ms ease-out, visibility 0s linear ${FADE_DURATION}ms`;

        clearTimeout(animationCleanupTimeoutId);
        animationCleanupTimeoutId = setTimeout(() => {
            if (tooltipElement && tooltipElement.style.opacity === '0') {
                tooltipElement.style.visibility = 'hidden';
            }
        }, FADE_DURATION);
    }
}

/**
 * Attaches custom tooltip functionality to an element.
 * The element's existing `title` attribute will be removed.
 * @param {HTMLElement} element - The element to attach the tooltip to.
 * @param {string} textKey - The localization key for the tooltip text.
 * @param {object} [textReplacements={}] - Replacements for the text key.
 * @param {object} [textOptions={}] - Options for getUIText (e.g., explicitThemeContext).
 */
export function attachTooltip(element, textKey, textReplacements = {}, textOptions = {}) {
    if (!element) {
        log(LOG_LEVEL_DEBUG, "attachTooltip: Target element is null.");
        return;
    }

    element.removeAttribute('title');

    const handleMouseEnter = () => {
        clearTimeout(hideTimeoutId); // Cancel any pending hide from a previous mouseleave
        currentHoverTarget = element;

        showTimeoutId = setTimeout(() => {
            // Only show if the mouse is still over this element (or focus hasn't taken precedence)
            if (currentHoverTarget === element && currentFocusTarget !== element) {
                _displayTooltipUI(element, textKey, textReplacements, textOptions);
            }
        }, SHOW_DELAY);
    };

    const handleMouseLeave = () => {
        clearTimeout(showTimeoutId); // Cancel any pending show for this element
        currentHoverTarget = null;

        // Only hide if focus isn't currently on this element
        if (currentFocusTarget !== element) {
            hideTimeoutId = setTimeout(() => {
                // If another element gained hover and is showing tooltip, this hide might be irrelevant
                // However, _hideTooltipUI() is generic.
                _hideTooltipUI();
            }, HIDE_DELAY);
        }
    };

    const handleFocus = () => {
        clearTimeout(hideTimeoutId); // Cancel any pending hide
        clearTimeout(showTimeoutId); // Cancel any pending show from mouse hover
        currentFocusTarget = element;
        _displayTooltipUI(element, textKey, textReplacements, textOptions); // Show immediately on focus
    };

    const handleBlur = () => {
        currentFocusTarget = null;
        // If mouse is still hovering, let mouseleave handle hiding later.
        // Otherwise, hide immediately.
        if (currentHoverTarget !== element) {
             _hideTooltipUI();
        }
    };

    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);
    element.addEventListener('focus', handleFocus);
    element.addEventListener('blur', handleBlur);
}

/**
 * Initializes the tooltip manager.
 * Call this once when the application starts.
 */
export function initTooltipManager() {
    if (!tooltipElement) {
        _createTooltipElement();
    }
    log(LOG_LEVEL_DEBUG, "TooltipManager initialized.");
}
