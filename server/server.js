// server/server.js

// 1. Import necessary modules
const express = require('express');
const dotenv = require('dotenv');
const path = require('path');

// 2. Load environment variables
dotenv.config();

// 3. Create an Express application instance
const app = express();

// 4. Define the port
const PORT = process.env.PORT || 3000;

// 5. Configure Static Asset Serving
//    This line serves static files from the project root (one level up from 'server/')
app.use(express.static(path.join(__dirname, '..')));

// 6. Basic API route (we'll add the Gemini proxy later)
app.get('/api/test', (req, res) => {
  res.json({ message: 'Anomady Backend API is responding!' });
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
