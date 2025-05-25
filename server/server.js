// server/server.js

// 1. Core Module Imports
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch'; // node-fetch v3 is ESM native
import cors from 'cors';
import morgan from 'morgan';

// 2. Custom Utility Imports
import logger from './utils/logger.js'; // Import our custom logger

// 3. ESM __dirname and __filename Setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 4. Load Environment Variables (dotenv.config() is also called in logger.js, but good to have here too for PORT etc.)
dotenv.config();

// 5. Express Application Setup
const app = express();
const PORT = process.env.PORT || 3000;

// 6. Core Middlewares
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Parse JSON request bodies

// HTTP Request Logging Middleware (Morgan)
// We can use a stream to pipe morgan logs through our custom logger if we want unified formatting,
// but for simplicity and to leverage morgan's predefined formats, logging directly is fine.
// 'dev' format is good for development: concise, color-coded.
// 'combined' is a standard Apache combined log format, good for production.
// if (process.env.NODE_ENV === 'production') {
//   app.use(morgan('combined'));
// } else {
//   app.use(morgan('tiny'));
// }

// 7. Static Asset Serving
// Serve files from the project root (one level up from 'server/')
app.use(express.static(path.join(__dirname, '..')));

// 8. API Routes
logger.info('Setting up API routes...');

// Test API Route
app.get('/api/test', (req, res) => {
  logger.debug('GET /api/test hit');
  res.json({ message: 'Anomady Backend API is responding!' });
});

// Gemini API Proxy Endpoint
app.post('/api/v1/gemini/generate', async (req, res) => {
  logger.info(`POST /api/v1/gemini/generate - Received request`);
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    logger.error('GEMINI_API_KEY is not set in environment variables.');
    return res.status(500).json({
      error: {
        message: 'API key not configured on server. Cannot connect to AI service.'
      }
    });
  }

  const { contents, generationConfig, safetySettings, systemInstruction, modelName } = req.body;

  if (!contents) {
    logger.warn('Missing "contents" in request body for /api/v1/gemini/generate');
    return res.status(400).json({ error: { message: 'Missing "contents" in request body' } });
  }

  const effectiveModelName = modelName || 'gemini-1.5-flash-latest'; // Default if not provided
  const GOOGLE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModelName}:generateContent?key=${geminiApiKey}`;

  const payload = {
    contents,
    generationConfig,
    safetySettings,
    systemInstruction,
  };

  logger.debug(`Proxying request to Gemini. Model: ${effectiveModelName}, Target URL: ${GOOGLE_API_URL}`);
  // logger.debug('Payload to Gemini:', payload); // Uncomment for very verbose debugging of payload

  try {
    const fetchOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 30000, // Increased timeout to 30 seconds
    };

    const googleResponse = await fetch(GOOGLE_API_URL, fetchOptions);
    logger.debug(`Gemini API response status: ${googleResponse.status}`);

    const responseText = await googleResponse.text(); // Get raw text for robust parsing/debugging

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      logger.error('Failed to parse Gemini JSON response. Raw text:', responseText, 'Parse error:', parseError.message);
      return res.status(500).json({ error: { message: 'Invalid JSON response from AI service.' } });
    }

    if (!googleResponse.ok) {
      logger.error(`Error from Gemini API (Status: ${googleResponse.status}). Parsed error:`, responseData);
      return res.status(googleResponse.status).json(responseData); // Forward Gemini's error
    }

    logger.info(`Successfully proxied request for model ${effectiveModelName}.`);
    res.status(200).json(responseData);

  } catch (error) {
    logger.error('Error calling Gemini API via proxy:', error.message, error.stack ? error.stack : '');
    if (error.type === 'request-timeout') { // node-fetch specific timeout error
        return res.status(504).json({ error: { message: 'Request to AI service timed out.' }});
    }
    res.status(500).json({
      error: {
        message: 'Failed to call external AI service: ' + error.message
      }
    });
  }
});

// 9. SPA Fallback Route
// Serves index.html for non-API GET requests that haven't been handled by static serving.
app.get((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    const acceptsHtml = req.accepts('html');
    const isLikelyAsset = /\.(js|css|json|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|map)$/i.test(req.path);

    if (acceptsHtml && !isLikelyAsset) {
      logger.debug(`SPA Fallback: Serving index.html for ${req.path}`);
      return res.sendFile(path.join(__dirname, '..', 'index.html'));
    }
  }
  next(); // Pass to next error handler if not serving index.html
});

// 10. Centralized Error Handling (Optional but good practice)
// This catches errors from `next(err)` or unhandled errors in synchronous route handlers.
// Asynchronous errors in routes need to be caught and passed to `next()` or handled in a try-catch.
// Our async route above uses try-catch, so this is more for other potential errors.
app.use((err, req, res, next) => {
  logger.error('Unhandled application error:', err.message, err.stack ? err.stack : '');
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
    },
  });
});


// 11. Start Server
app.listen(PORT, () => {
  logger.info(`Server listening on http://localhost:${PORT}`);
  logger.info(`Frontend accessible at http://localhost:${PORT}`);
  logger.info(`Current application log level: ${logger.getLogLevel()}`);
  if (process.env.NODE_ENV !== 'production') {
    logger.warn('Server is running in development mode.');
  }
});
