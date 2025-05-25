// server/server.js

// 1. Import necessary modules
const express = require('express');
const dotenv = require('dotenv');
// If you chose axios: const axios = require('axios');
// If you chose node-fetch (version 2.x which uses require):
// const fetch = require('node-fetch');
// For node-fetch v3+ (ESM), you'd use: import fetch from 'node-fetch';
// For simplicity with 'require', ensure you installed node-fetch@2 if not using ESM project type

// 2. Load environment variables
dotenv.config(); // This loads variables from .env into process.env

// 3. Create an Express application instance
const app = express();

// 4. Define the port
// It will try to get the port from the .env file, or default to 3000
const PORT = process.env.PORT || 3000;

// 5. Basic route (optional, just for testing the server is up)
app.get('/', (req, res) => {
  res.send('Anomady Backend Server is running!');
});

// 6. Start the server
app.listen(PORT, () => {
  console.log(`[AnomadyBE] Server listening on http://localhost:${PORT}`);
});
