// server/server.js

// 1. Import necessary modules using ESM syntax
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import cors from 'cors'; // <<< Import cors

// ESM equivalent for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Load environment variables
dotenv.config();

// 3. Create an Express application instance
const app = express();

// MIDDLEWARE
app.use(cors()); // <<< Enable CORS for all routes
app.use(express.json());
// Example of more specific CORS options:
// const corsOptions = {
//   origin: 'https://your-anomady-frontend-domain.com', // Allow only your specific frontend domain
//   methods: ['GET', 'POST'], // Allow only specific HTTP methods
//   allowedHeaders: ['Content-Type', 'Authorization'], // Allow specific headers
// };
// app.use(cors(corsOptions));

// 4. Define the port
const PORT = process.env.PORT || 3000;

// 5. Configure Static Asset Serving (paths remain the same logic)
app.use(express.static(path.join(__dirname, '..')));

// 6. Basic API route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Anomady Backend API is responding!' });
});

// NEW: Gemini API Proxy Endpoint
app.post('/api/v1/gemini/generate', async (req, res) => {
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    console.error('[AnomadyBE] GEMINI_API_KEY is not set in environment variables.');
    return res.status(500).json({ /* ... */ });
  }

  const { contents, generationConfig, safetySettings, systemInstruction, modelName } = req.body;

  if (!contents) {
    return res.status(400).json({ error: { message: 'Missing "contents" in request body' } });
  }

  // 1. DEFINE effectiveModelName FIRST
  const effectiveModelName = modelName || 'gemini-1.5-flash-latest';

  // 2. THEN use it to construct GOOGLE_API_URL
  const GOOGLE_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${effectiveModelName}:generateContent?key=${geminiApiKey}`;

  const payload = {
    contents,
    generationConfig,
    safetySettings,
    systemInstruction,
  };

  console.log('[AnomadyBE] Proxying request to Gemini with model:', effectiveModelName);
  console.log('[AnomadyBE] Target URL:', GOOGLE_API_URL);

  try {
    const googleResponse = await fetch(GOOGLE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      timeout: 15000 // Add a timeout (e.g., 15 seconds in milliseconds)
    });
    console.log(`[AnomadyBE] Received status from Gemini: ${googleResponse.status}`);

    const responseText = await googleResponse.text(); // Get raw text first for debugging
    console.log('[AnomadyBE] Raw response text from Gemini:', responseText);

    let responseData;
    try {
        responseData = JSON.parse(responseText); // Now try to parse
    } catch (parseError) {
        console.error('[AnomadyBE] Failed to parse Gemini JSON response:', parseError);
        console.error('[AnomadyBE] Raw text that failed to parse:', responseText);
        return res.status(500).json({ error: { message: 'Invalid JSON response from AI service.' } });
    }

    if (!googleResponse.ok) {
      console.error('[AnomadyBE] Error from Gemini API (parsed):', responseData);
      return res.status(googleResponse.status).json(responseData);
    }

    console.log('[AnomadyBE] Successfully received and parsed response from Gemini.');
    res.status(200).json(responseData);
  } catch (error) {
    // ...
  }
});

// 7. Fallback for Single Page Applications (SPA) - Serve index.html
//    This MUST be placed AFTER specific API routes and static file serving.
app.get((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    const acceptsHtml = req.accepts('html');
    const isLikelyAsset = /\.(js|css|json|ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|map)$/i.test(req.path);

    if (acceptsHtml && !isLikelyAsset) {
      return res.sendFile(path.join(__dirname, '..', 'index.html'));
    }
  }
  next();
});


// 8. Start the server
app.listen(PORT, () => {
  console.log(`[AnomadyBE] Server listening on http://localhost:${PORT}`);
  console.log(`[AnomadyBE] Frontend should be accessible at http://localhost:${PORT}`);
});
