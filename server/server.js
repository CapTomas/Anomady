// server/server.js

// 1. Core Module Imports
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';

// 2. Custom Utility Imports
import logger from './utils/logger.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import { protect } from './middleware/authMiddleware.js'

// 3. ESM __dirname and __filename Setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 4. Load Environment Variables
dotenv.config();

// 5. Express Application Setup
const app = express();
const PORT = process.env.PORT || 3000;

// 6. Security & Core Middlewares
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for SPA compatibility
  crossOriginEmbedderPolicy: false
}));

// CORS Configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || false
    : true, // Allow all origins in development
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// HTTP Request Logging
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) }
  }));
} else {
  app.use(morgan('dev'));
}

// Rate limiting for API endpoints
const rateLimit = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: { message: 'Too many requests, please try again later.' } },
  standardHeaders: true,
  legacyHeaders: false,
};

// Simple in-memory rate limiter (replace with Redis in production)
const requestCounts = new Map();
const rateLimitMiddleware = (req, res, next) => {
  if (!req.path.startsWith('/api')) return next();

  const clientId = req.ip;
  const now = Date.now();
  const windowStart = now - rateLimit.windowMs;

  // Clean old entries
  for (const [ip, requests] of requestCounts.entries()) {
    requestCounts.set(ip, requests.filter(time => time > windowStart));
    if (requestCounts.get(ip).length === 0) {
      requestCounts.delete(ip);
    }
  }

  const clientRequests = requestCounts.get(clientId) || [];

  if (clientRequests.length >= rateLimit.max) {
    logger.warn(`Rate limit exceeded for IP: ${clientId}`);
    return res.status(429).json(rateLimit.message);
  }

  clientRequests.push(now);
  requestCounts.set(clientId, clientRequests);
  next();
};

app.use(rateLimitMiddleware);

// 7. Static Asset Serving with cache headers
app.use(express.static(path.join(__dirname, '..'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
  etag: true,
  lastModified: true
}));

// 8. API Routes
logger.info('Setting up API routes...');

// Health check endpoint
app.get('/api/health', (req, res) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  };

  logger.debug('Health check requested');
  res.status(200).json(healthCheck);
});

// Test API Route
app.get('/api/test', (req, res) => {
  logger.debug('GET /api/test hit');
  res.json({
    message: 'Anomady Backend API is responding!',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Input validation middleware for Gemini endpoint
const validateGeminiRequest = (req, res, next) => {
  const { contents } = req.body;

  if (!contents) {
    logger.warn('Missing "contents" in request body for /api/v1/gemini/generate');
    return res.status(400).json({
      error: {
        message: 'Missing "contents" in request body',
        code: 'MISSING_CONTENTS'
      }
    });
  }

  if (!Array.isArray(contents)) {
    logger.warn('Invalid "contents" format - must be array');
    return res.status(400).json({
      error: {
        message: '"contents" must be an array',
        code: 'INVALID_CONTENTS_FORMAT'
      }
    });
  }

  next();
};

// Gemini API Proxy Endpoint
app.post('/api/v1/gemini/generate', protect, validateGeminiRequest, async (req, res)=> {
  logger.info(`POST /api/v1/gemini/generate - Request from IP: ${req.ip}`);

  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    logger.error('GEMINI_API_KEY is not set in environment variables.');
    return res.status(500).json({
      error: {
        message: 'API key not configured on server. Cannot connect to AI service.',
        code: 'MISSING_API_KEY'
      }
    });
  }

  const { contents, generationConfig, safetySettings, systemInstruction, modelName } = req.body;
  const effectiveModelName = modelName || 'gemini-1.5-flash-latest';
  const GOOGLE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModelName}:generateContent?key=${geminiApiKey}`;

  // Sanitize and prepare payload
  const payload = {
    contents,
    ...(generationConfig && { generationConfig }),
    ...(safetySettings && { safetySettings }),
    ...(systemInstruction && { systemInstruction })
  };

  logger.debug(`Proxying request to Gemini. Model: ${effectiveModelName}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout

    const fetchOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Anomady-Server/1.0'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    };

    const googleResponse = await fetch(GOOGLE_API_URL, fetchOptions);
    clearTimeout(timeoutId);

    logger.debug(`Gemini API response status: ${googleResponse.status}`);

    const responseText = await googleResponse.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      logger.error('Failed to parse Gemini JSON response:', {
        rawText: responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''),
        parseError: parseError.message
      });
      return res.status(502).json({
        error: {
          message: 'Invalid JSON response from AI service.',
          code: 'INVALID_RESPONSE_FORMAT'
        }
      });
    }

    if (!googleResponse.ok) {
      logger.error(`Error from Gemini API (Status: ${googleResponse.status}):`, responseData);

      // Map common Gemini errors to user-friendly messages
      const errorMessage = responseData?.error?.message || 'Unknown error from AI service';
      const mappedError = mapGeminiError(googleResponse.status, errorMessage);

      return res.status(googleResponse.status).json({
        error: {
          message: mappedError,
          code: responseData?.error?.code || 'EXTERNAL_API_ERROR',
          details: process.env.NODE_ENV !== 'production' ? responseData : undefined
        }
      });
    }

    // Validate response structure
    if (!responseData.candidates || !Array.isArray(responseData.candidates)) {
      logger.warn('Unexpected Gemini response structure:', responseData);
      return res.status(502).json({
        error: {
          message: 'Unexpected response format from AI service.',
          code: 'INVALID_RESPONSE_STRUCTURE'
        }
      });
    }

    logger.info(`Successfully processed request for model ${effectiveModelName}`);
    res.status(200).json(responseData);

  } catch (error) {
    logger.error('Error calling Gemini API:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });

    if (error.name === 'AbortError') {
      return res.status(504).json({
        error: {
          message: 'Request to AI service timed out.',
          code: 'REQUEST_TIMEOUT'
        }
      });
    }

    res.status(500).json({
      error: {
        message: 'Failed to call external AI service.',
        code: 'EXTERNAL_API_ERROR'
      }
    });
  }
});

// Helper function to map Gemini errors to user-friendly messages
function mapGeminiError(status, message) {
  const errorMappings = {
    400: 'Invalid request format or parameters.',
    401: 'Authentication failed with AI service.',
    403: 'Access denied or quota exceeded.',
    429: 'Too many requests to AI service. Please try again later.',
    500: 'AI service is temporarily unavailable.',
    503: 'AI service is currently under maintenance.'
  };

  return errorMappings[status] || message || 'Unknown error occurred.';
}

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);

// 9. SPA Fallback Route
// Serves index.html for non-API GET requests that haven't been handled by static serving.
app.get((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    const acceptsHtml = req.accepts('html');
    const isLikelyAsset = /\.(js|css|json|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|map|txt|xml)$/i.test(req.path);

    if (acceptsHtml && !isLikelyAsset) {
      logger.debug(`SPA Fallback: Serving index.html for ${req.path}`);
      return res.sendFile(path.join(__dirname, '..', 'index.html'), (err) => {
        if (err) {
          logger.error('Error serving index.html:', err.message);
          res.status(404).json({ error: { message: 'Page not found.' } });
        }
      });
    }
  }
  next(); // Pass to next error handler if not serving index.html
});

// 10. 404 Handler for unmatched routes
app.use((req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: {
      message: 'Route not found.',
      code: 'ROUTE_NOT_FOUND',
      path: req.path,
      method: req.method
    }
  });
});

// 11. Centralized Error Handling
app.use((err, req, res, next) => {
  logger.error('Unhandled application error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip
  });

  res.status(err.status || 500).json({
    error: {
      message: process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : err.message,
      code: err.code || 'INTERNAL_SERVER_ERROR'
    }
  });
});

// 12. Graceful Shutdown Handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.fatal('Uncaught Exception:', error);
  process.exit(1);
});

// 13. Start Server
const server = app.listen(PORT, () => {
  logger.info(`🚀 Server listening on http://localhost:${PORT}`);
  logger.info(`📱 Frontend accessible at http://localhost:${PORT}`);
  logger.info(`📊 Log level: ${logger.getLogLevel()}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

  if (process.env.NODE_ENV !== 'production') {
    logger.warn('⚠️  Server is running in development mode.');
  }
});

// Handle server startup errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.fatal(`❌ Port ${PORT} is already in use`);
  } else {
    logger.fatal('❌ Server startup error:', error);
  }
  process.exit(1);
});

export default app;
