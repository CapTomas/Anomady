// server/routes/user.js
import express from 'express';
import prisma from '../db.js';
import logger from '../utils/logger.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// --- Preference Endpoints ---

// GET /api/v1/users/me/preferences - Fetch current user's preferences
router.get('/me/preferences', protect, async (req, res) => {
  try {
    // req.user is populated by the 'protect' middleware
    // It already contains the preferences we need from the selective fetch
    logger.info(`Fetching preferences for user: ${req.user.email} (ID: ${req.user.id})`);

    res.status(200).json({
      message: "Preferences fetched successfully.",
      preferences: {
        preferred_app_language: req.user.preferred_app_language,
        preferred_narrative_language: req.user.preferred_narrative_language,
        preferred_model_name: req.user.preferred_model_name,
      }
    });
  } catch (error) {
    logger.error(`Error fetching preferences for user ${req.user?.id}:`, error);
    res.status(500).json({ error: { message: 'Server error fetching preferences.', code: 'PREFERENCES_FETCH_ERROR' } });
  }
});

// PUT /api/v1/users/me/preferences - Update current user's preferences
router.put('/me/preferences', protect, async (req, res) => {
  const { preferred_app_language, preferred_narrative_language, preferred_model_name } = req.body;
  const userId = req.user.id; // From 'protect' middleware

  // Basic validation for allowed values (extend as needed)
  const allowedLanguages = ['en', 'cs']; // Example, keep in sync with your app's capabilities
  const allowedModels = ['gemini-1.5-flash-latest', 'gemini-1.5-pro-latest', /* add your PAID_MODEL_NAME if it's different from these */];
  // Make sure your actual PAID_MODEL_NAME and FREE_MODEL_NAME constants are included
  if (process.env.PAID_MODEL_NAME && !allowedModels.includes(process.env.PAID_MODEL_NAME)) {
    allowedModels.push(process.env.PAID_MODEL_NAME);
  }
   if (process.env.FREE_MODEL_NAME && !allowedModels.includes(process.env.FREE_MODEL_NAME)) {
    allowedModels.push(process.env.FREE_MODEL_NAME);
  }


  const updateData = {};

  if (preferred_app_language !== undefined) {
    if (!allowedLanguages.includes(preferred_app_language)) {
      return res.status(400).json({ error: { message: `Invalid preferred_app_language. Allowed: ${allowedLanguages.join(', ')}`, code: 'INVALID_PREFERENCE_VALUE' } });
    }
    updateData.preferred_app_language = preferred_app_language;
  }

  if (preferred_narrative_language !== undefined) {
    if (!allowedLanguages.includes(preferred_narrative_language)) {
      return res.status(400).json({ error: { message: `Invalid preferred_narrative_language. Allowed: ${allowedLanguages.join(', ')}`, code: 'INVALID_PREFERENCE_VALUE' } });
    }
    updateData.preferred_narrative_language = preferred_narrative_language;
  }

  if (preferred_model_name !== undefined) {
    // This check needs to align with the actual model names you support.
    // For now, we'll use a placeholder check.
    // TODO: Update this with actual model name validation if you have a fixed list
    if (typeof preferred_model_name !== 'string' || preferred_model_name.trim() === '') {
         return res.status(400).json({ error: { message: 'Invalid preferred_model_name.', code: 'INVALID_PREFERENCE_VALUE' } });
    }
    // A more specific check against allowed models if you have them:
    // if (!allowedModels.includes(preferred_model_name)) {
    //   return res.status(400).json({ error: { message: `Invalid preferred_model_name. Allowed models: ${allowedModels.join(', ')}`, code: 'INVALID_PREFERENCE_VALUE' }});
    // }
    updateData.preferred_model_name = preferred_model_name;
  }

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: { message: 'No preference data provided to update.', code: 'NO_PREFERENCE_DATA' } });
  }

  try {
    logger.info(`Updating preferences for user: ${req.user.email} (ID: ${userId}) with data:`, updateData);
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { // Return only the updated preferences and key identifiers
        id: true,
        email: true,
        preferred_app_language: true,
        preferred_narrative_language: true,
        preferred_model_name: true,
        updated_at: true
      }
    });

    logger.info(`Preferences updated successfully for user: ${updatedUser.email}`);
    res.status(200).json({
      message: "Preferences updated successfully.",
      user: updatedUser // Send back the updated user data (with preferences)
    });

  } catch (error) {
    logger.error(`Error updating preferences for user ${userId}:`, error);
    res.status(500).json({ error: { message: 'Server error updating preferences.', code: 'PREFERENCES_UPDATE_ERROR' } });
  }
});

export default router;
