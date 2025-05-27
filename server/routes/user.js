// server/routes/user.js
import express from 'express';
import prisma from '../db.js';
import logger from '../utils/logger.js';
import bcrypt from 'bcryptjs';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
const SALT_ROUNDS = 10;

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

/**
 * @route   PUT /api/v1/users/me/password
 * @desc    Change current user's password
 * @access  Private (requires token)
 */
router.put('/me/password', protect, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id; // From 'protect' middleware

  // 1. Basic Input Validation
  if (!currentPassword || !newPassword) {
    logger.warn(`Password change attempt for user ID ${userId} with missing fields.`);
    return res.status(400).json({
      error: {
        message: 'Current password and new password are required.',
        code: 'MISSING_PASSWORD_FIELDS'
      }
    });
  }

  // Validate new password strength (example: min 8 characters)
  if (newPassword.length < 8) {
    logger.warn(`Password change attempt for user ID ${userId} with weak new password.`);
    return res.status(400).json({
      error: {
        message: 'New password must be at least 8 characters long.',
        code: 'WEAK_NEW_PASSWORD'
      }
    });
  }

  if (currentPassword === newPassword) {
    logger.warn(`Password change attempt for user ID ${userId} where new password is same as current.`);
    return res.status(400).json({
      error: {
        message: 'New password cannot be the same as the current password.',
        code: 'NEW_PASSWORD_SAME_AS_OLD'
      }
    });
  }

  try {
    // 2. Fetch the user's stored password hash
    const userWithPassword = await prisma.user.findUnique({
      where: { id: userId },
      select: { password_hash: true } // Only select the hash
    });

    if (!userWithPassword) {
      // This case should ideally not happen if 'protect' middleware worked,
      // but as a safeguard:
      logger.error(`User ID ${userId} not found in DB during password change, though authenticated.`);
      return res.status(404).json({ error: { message: 'User not found.', code: 'USER_NOT_FOUND' } });
    }

    // 3. Compare the provided current password with the stored hash
    const isMatch = await bcrypt.compare(currentPassword, userWithPassword.password_hash);

    if (!isMatch) {
      logger.info(`Password change attempt for user ID ${userId} with incorrect current password.`);
      return res.status(401).json({ // 401 Unauthorized
        error: {
          message: 'Incorrect current password.',
          code: 'INVALID_CURRENT_PASSWORD'
        }
      });
    }

    // 4. Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    logger.debug(`New password hashed for user ID: ${userId}`);

    // 5. Update the user's password in the database
    await prisma.user.update({
      where: { id: userId },
      data: { password_hash: hashedNewPassword },
    });

    logger.info(`Password changed successfully for user: ${req.user.email} (ID: ${userId})`);

    // 6. Respond
    // It's good practice to not return any sensitive data, just a success message.
    // The client should probably clear any session/token and prompt for re-login for highest security,
    // but for now, a simple success is fine.
    res.status(200).json({
      message: 'Password changed successfully.'
      // Optionally, you could send a new token here if your strategy involves re-issuing tokens on password change.
      // For simplicity, we won't do that now. The existing token remains valid until expiry.
    });

  } catch (error) {
    logger.error(`Error during password change for user ID ${userId}:`, {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      error: {
        message: 'Server error during password change. Please try again later.',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

export default router;
