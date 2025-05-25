// server/utils/logger.js
import dotenv from 'dotenv';

// Load .env variables specifically for the logger, in case it's imported before server.js loads them.
// This ensures LOG_LEVEL is available immediately.
dotenv.config();

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4, // A level to turn off logging
};

const CURRENT_LOG_LEVEL_NAME = (process.env.LOG_LEVEL || 'INFO').toUpperCase();
const CURRENT_LOG_LEVEL = LOG_LEVELS[CURRENT_LOG_LEVEL_NAME] !== undefined
                          ? LOG_LEVELS[CURRENT_LOG_LEVEL_NAME]
                          : LOG_LEVELS.INFO;

const APP_NAME_PREFIX = '[AnomadyBE]';

/**
 * Formats a log message with a timestamp, app prefix, level, and the message content.
 * @param {string} level - The log level (e.g., 'INFO', 'ERROR').
 * @param {...any} messages - The messages to log. Objects will be stringified.
 * @returns {string} The formatted log message.
 */
function formatMessage(level, ...messages) {
  const timestamp = new Date().toISOString();
  const messageString = messages
    .map(msg => (typeof msg === 'object' ? JSON.stringify(msg, null, 2) : msg))
    .join(' ');
  return `${timestamp} ${APP_NAME_PREFIX} [${level.toUpperCase()}] ${messageString}`;
}

const logger = {
  debug: (...messages) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.DEBUG) {
      console.debug(formatMessage('debug', ...messages));
    }
  },
  info: (...messages) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.INFO) {
      console.info(formatMessage('info', ...messages));
    }
  },
  warn: (...messages) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.WARN) {
      console.warn(formatMessage('warn', ...messages));
    }
  },
  error: (...messages) => {
    if (CURRENT_LOG_LEVEL <= LOG_LEVELS.ERROR) {
      console.error(formatMessage('error', ...messages));
    }
  },
  // Expose current level for potential checks elsewhere, though not strictly needed for basic use
  getLogLevel: () => CURRENT_LOG_LEVEL_NAME,
};

export default logger;
