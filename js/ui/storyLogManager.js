// js/ui/storyLogManager.js
/**
 * @file Manages all operations related to the story log display,
 * including adding messages and handling scroll behavior.
 */
import { storyLog, storyLogViewport } from './domElements.js';
import { formatDynamicText } from './uiUtils.js'; // For text formatting like italics
import { AUTOSCROLL_THRESHOLD } from '../core/config.js';
import { log, LOG_LEVEL_DEBUG, LOG_LEVEL_INFO, LOG_LEVEL_WARN } from '../core/logger.js';
import { addTurnToGameHistory as stateAddTurnToGameHistory } from '../core/state.js';
import { getCurrentUser, getPlayerIdentifier } from '../core/state.js';

let userHasManuallyScrolledLog = false;

/**
 * Adds a message to the story log.
 * @param {string} text - The message text.
 * @param {string} senderTypes - A space-separated string of sender types (e.g., "gm", "player system-emphasized").
 *                               Core types are "gm", "player", "system". Additional classes can be added.
 */
export function addMessageToLog(text, senderTypes) {
    if (!storyLog) {
        log(LOG_LEVEL_WARN, `Story log element not found. Message not added: (${senderTypes}) "${text.substring(0, 50)}..."`);
        return;
    }

    const currentUser = getCurrentUser();
    const currentPlayerId = currentUser ? currentUser.email : getPlayerIdentifier();

    // Prevent logging the initial "My identifier is..." message from anonymous users
    // if it's the very first message in history.
    // This check might need refinement based on actual game flow for anonymous vs logged-in.
    if (senderTypes.includes("player") &&
        storyLog.children.length === 0 && // Check if log is empty
        text.startsWith(`My identifier is ${currentPlayerId}`)) {
        log(LOG_LEVEL_DEBUG, "Skipping initial player identifier message in log.");
        return;
    }

    const msgDiv = document.createElement("div");
    msgDiv.classList.add("message");

    const typesArray = senderTypes.split(" ").filter(t => t.trim() !== "");
    typesArray.forEach(type => {
        msgDiv.classList.add(`${type}-message`); // Add specific class like "gm-message"
        if (type !== "gm" && type !== "player" && type !== "system") {
            // For additional styling classes like "system-emphasized", "system-error"
            msgDiv.classList.add(type);
        }
    });

    // Format text (e.g., italics, bold) and handle multiline paragraphs
    const formattedHtml = formatDynamicText(text); // Handles _italic_, *bold* etc.
    const paragraphs = formattedHtml.split(/\n\s*\n/).filter(p => p.trim() !== "");

    if (paragraphs.length === 0 && formattedHtml.trim() !== "") {
        // Handle single line messages or those without double line breaks
        const pElement = document.createElement("p");
        pElement.innerHTML = formattedHtml.replace(/\n/g, "<br>"); // Convert single newlines to <br>
        msgDiv.appendChild(pElement);
    } else {
        paragraphs.forEach(paraHtml => {
            const pElement = document.createElement("p");
            pElement.innerHTML = paraHtml.replace(/\n/g, "<br>"); // Convert single newlines within paragraphs
            msgDiv.appendChild(pElement);
        });
    }

    const viewport = storyLogViewport; // Use the direct reference
    let shouldScroll = false;

    if (viewport && viewport.style.display !== "none") {
        if (!userHasManuallyScrolledLog) {
            shouldScroll = true;
        } else {
            // Check if user is close to the bottom
            if (viewport.scrollHeight - viewport.clientHeight <= viewport.scrollTop + AUTOSCROLL_THRESHOLD) {
                shouldScroll = true;
                userHasManuallyScrolledLog = false; // Reset if scrolling to bottom again
            }
        }
    }

    storyLog.appendChild(msgDiv);

    if (shouldScroll && viewport) {
        // Ensure the new message is fully rendered before scrolling
        requestAnimationFrame(() => {
            viewport.scrollTop = viewport.scrollHeight;
        });
    }
}

/**
 * Initializes scroll handling for the story log viewport.
 * Detects manual scrolling to pause auto-scrolling.
 */
export function initStoryLogScrollHandling() {
    if (!storyLogViewport) {
        log(LOG_LEVEL_WARN, "Story log viewport element not found. Cannot initialize scroll handling.");
        return;
    }

    let scrollTimeout;
    storyLogViewport.addEventListener("scroll", () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            // If the user has scrolled up and is not near the bottom
            if (storyLogViewport.scrollHeight - storyLogViewport.clientHeight > storyLogViewport.scrollTop + AUTOSCROLL_THRESHOLD) {
                if (!userHasManuallyScrolledLog) {
                    log(LOG_LEVEL_DEBUG, "User manually scrolled story log up.");
                    userHasManuallyScrolledLog = true;
                }
            } else {
                // If user scrolls back to the bottom, re-enable auto-scroll
                if (userHasManuallyScrolledLog) {
                    log(LOG_LEVEL_DEBUG, "User scrolled story log to bottom. Re-enabling auto-scroll.");
                    userHasManuallyScrolledLog = false;
                }
            }
        }, 150); // Debounce scroll event
    }, { passive: true });

    log(LOG_LEVEL_INFO, "Story log scroll handling initialized.");
}

/**
 * Resets the manual scroll flag, typically when a new game starts or view changes.
 */
export function resetManualScrollFlag() {
    userHasManuallyScrolledLog = false;
}

/**
 * Clears the story log's DOM content and resets manual scroll tracking.
 * This is intended to be called when a new game starts or the view is completely reset.
 */
export function clearStoryLogDOM() {
    if (storyLog) {
        storyLog.innerHTML = "";
        log(LOG_LEVEL_INFO, "Story log DOM content cleared.");
    } else {
        log(LOG_LEVEL_WARN, "Story log element not found, cannot clear DOM content.");
    }
    resetManualScrollFlag();
}

const LOADING_INDICATOR_ID = "story-log-loading-indicator";

/**
 * Shows a loading indicator in the story log.
 * Removes any existing indicator before adding a new one.
 */
export function showLoadingIndicator() {
    if (!storyLog || !storyLogViewport) {
        log(LOG_LEVEL_WARN, "Story log or viewport element not found. Cannot show loading indicator.");
        return;
    }

    removeLoadingIndicator(); // Ensure no duplicates

    const indicatorDiv = document.createElement("div");
    indicatorDiv.id = LOADING_INDICATOR_ID;
    indicatorDiv.classList.add("loading-indicator-message");

    const dotsContainer = document.createElement("div");
    dotsContainer.classList.add("dots-container");

    for (let i = 0; i < 3; i++) {
        const dotSpan = document.createElement("span");
        dotSpan.classList.add("dot");
        dotsContainer.appendChild(dotSpan);
    }

    indicatorDiv.appendChild(dotsContainer);
    storyLog.appendChild(indicatorDiv);

    // Scroll to the bottom to make the indicator visible
    // Use requestAnimationFrame to ensure the element is rendered before scrolling
    requestAnimationFrame(() => {
        storyLogViewport.scrollTop = storyLogViewport.scrollHeight;
    });
    log(LOG_LEVEL_DEBUG, "Loading indicator shown in story log.");
}

/**
 * Removes the loading indicator from the story log, if present.
 */
export function removeLoadingIndicator() {
    const existingIndicator = document.getElementById(LOADING_INDICATOR_ID);
    if (existingIndicator && storyLog && storyLog.contains(existingIndicator)) {
        storyLog.removeChild(existingIndicator);
        log(LOG_LEVEL_DEBUG, "Loading indicator removed from story log.");
    }
}
