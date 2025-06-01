// js/core/logger.js

/**
 * @file Centralized client-side logging utility.
 */

import { LOG_LEVEL_STORAGE_KEY } from './config.js';

export const LOG_LEVEL_DEBUG = "debug";
export const LOG_LEVEL_INFO = "info";
export const LOG_LEVEL_WARN = "warning";
export const LOG_LEVEL_ERROR = "error";
export const LOG_LEVEL_SILENT = "silent"; // No logs

const LOG_LEVEL_HIERARCHY = {
  [LOG_LEVEL_DEBUG]: 0,
  [LOG_LEVEL_INFO]: 1,
  [LOG_LEVEL_WARN]: 2,
  [LOG_LEVEL_ERROR]: 3,
  [LOG_LEVEL_SILENT]: 4,
};

let currentLogLevel = localStorage.getItem(LOG_LEVEL_STORAGE_KEY) || LOG_LEVEL_INFO;
const APP_NAME_PREFIX = '[AnomadyFE]';

/**
 * Formats a log message with a timestamp, app prefix, level, and the message content.
 * @param {string} level - The log level (e.g., 'INFO', 'ERROR').
 * @param {...any} messages - The messages to log. Objects will be stringified.
 * @returns {Array} The formatted log arguments for console methods.
 */
function formatMessage(level, ...messages) {
  const timestamp = new Date().toISOString();
  const processedMessages = messages.map(msg =>
    (typeof msg === 'object' ? JSON.stringify(msg, null, 2) : String(msg))
  );
  return [`${timestamp} ${APP_NAME_PREFIX} [${level.toUpperCase()}]`, ...processedMessages];
}

/**
 * Logs messages to the console based on the current log level.
 * @param {string} level - The log level (e.g., 'debug', 'info').
 * @param {...any} messages - The messages to log.
 */
export function log(level, ...messages) {
  const levelIndex = LOG_LEVEL_HIERARCHY[level];
  const currentLevelIndex = LOG_LEVEL_HIERARCHY[currentLogLevel];

  if (levelIndex === undefined) {
    console.error(...formatMessage(LOG_LEVEL_ERROR, `Unknown log level: ${level}`), ...messages);
    return;
  }

  if (currentLogLevel === LOG_LEVEL_SILENT || levelIndex < currentLevelIndex) {
    return; // Suppress log
  }

  const formattedMessages = formatMessage(level, ...messages);

  switch (level) {
    case LOG_LEVEL_DEBUG:
      console.debug(...formattedMessages);
      break;
    case LOG_LEVEL_INFO:
      console.info(...formattedMessages);
      break;
    case LOG_LEVEL_WARN:
      console.warn(...formattedMessages);
      break;
    case LOG_LEVEL_ERROR:
      console.error(...formattedMessages);
      break;
    default:
      console.log(...formattedMessages); // Fallback for unknown valid levels
  }
}

/**
 * Sets the application's client-side log level.
 * @param {string} newLevel - The new log level to set. Must be one of LOG_LEVEL constants.
 */
export function setLogLevel(newLevel) {
  if (LOG_LEVEL_HIERARCHY[newLevel] !== undefined) {
    currentLogLevel = newLevel;
    localStorage.setItem(LOG_LEVEL_STORAGE_KEY, newLevel);
    log(LOG_LEVEL_INFO, `Log level set to ${newLevel.toUpperCase()}`);
  } else {
    log(LOG_LEVEL_ERROR, `Invalid log level: ${newLevel}. Valid levels are: ${Object.keys(LOG_LEVEL_HIERARCHY).join(", ")}`);
  }
}

/**
 * Gets the current client-side log level.
 * @returns {string} The current log level.
 */
export function getLogLevel() {
    return currentLogLevel;
}
