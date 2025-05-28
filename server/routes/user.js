// server/routes/user.js
import express from 'express';
import prisma from '../db.js';
import logger from '../utils/logger.js';
import bcrypt from 'bcryptjs';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
const SALT_ROUNDS = 10;

// --- Preference Endpoints ---

/**
 * @route   GET /api/v1/users/me/preferences
 * @desc    Fetch current user's preferences
 * @access  Private (requires token)
 */
router.get('/me/preferences', protect, async (req, res) => {
  try {
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

/**
 * @route   PUT /api/v1/users/me/preferences
 * @desc    Update current user's preferences
 * @access  Private (requires token)
 */
router.put('/me/preferences', protect, async (req, res) => {
  const { preferred_app_language, preferred_narrative_language, preferred_model_name } = req.body;
  const userId = req.user.id;

  const allowedLanguages = ['en', 'cs'];
  const baseAllowedModels = ['gemini-1.5-flash-latest', 'gemini-1.5-pro-latest'];
  const allowedModels = [...new Set([
    ...baseAllowedModels,
    process.env.FREE_MODEL_NAME,
    process.env.PAID_MODEL_NAME
  ].filter(Boolean))]; // Filter out undefined/null and ensure uniqueness

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
    if (!allowedModels.includes(preferred_model_name)) {
      return res.status(400).json({ error: { message: `Invalid preferred_model_name. Allowed models: ${allowedModels.join(', ')}`, code: 'INVALID_PREFERENCE_VALUE' }});
    }
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
      select: {
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
      user: updatedUser
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
  const userId = req.user.id;

  if (!currentPassword || !newPassword) {
    logger.warn(`Password change attempt for user ID ${userId} with missing fields.`);
    return res.status(400).json({
      error: {
        message: 'Current password and new password are required.',
        code: 'MISSING_PASSWORD_FIELDS'
      }
    });
  }

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
    const userWithPassword = await prisma.user.findUnique({
      where: { id: userId },
      select: { password_hash: true }
    });

    if (!userWithPassword) {
      logger.error(`User ID ${userId} not found in DB during password change, though authenticated.`);
      return res.status(404).json({ error: { message: 'User not found.', code: 'USER_NOT_FOUND' } });
    }

    const isMatch = await bcrypt.compare(currentPassword, userWithPassword.password_hash);

    if (!isMatch) {
      logger.info(`Password change attempt for user ID ${userId} with incorrect current password.`);
      return res.status(401).json({
        error: {
          message: 'Incorrect current password.',
          code: 'INVALID_CURRENT_PASSWORD'
        }
      });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    logger.debug(`New password hashed for user ID: ${userId}`);

    await prisma.user.update({
      where: { id: userId },
      data: { password_hash: hashedNewPassword },
    });

    logger.info(`Password changed successfully for user: ${req.user.email} (ID: ${userId})`);

    res.status(200).json({
      message: 'Password changed successfully.'
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
