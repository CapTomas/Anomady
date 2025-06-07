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
        username: req.user.username,
        story_preference: req.user.story_preference,
        newsletter_opt_in: req.user.newsletter_opt_in,
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
  const { preferred_app_language, preferred_narrative_language, preferred_model_name, story_preference, newsletter_opt_in } = req.body;
  const userId = req.user.id;
  const allowedLanguages = ['en', 'cs'];
  const baseAllowedModels = ['gemini-1.5-flash-latest', 'gemini-1.5-pro-latest'];
  const allowedModels = [...new Set([
    ...baseAllowedModels,
    process.env.FREE_MODEL_NAME,
    process.env.PAID_MODEL_NAME
  ].filter(Boolean))]; // Filter out undefined/null and ensure uniqueness
  const allowedStoryPreferences = ['explorer', 'strategist', 'weaver', 'chaos', null];
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
  if (story_preference !== undefined) {
    if (!allowedStoryPreferences.includes(story_preference)) {
        return res.status(400).json({ error: { message: `Invalid story_preference.`, code: 'INVALID_PREFERENCE_VALUE' } });
    }
    updateData.story_preference = story_preference;
  }
  if (newsletter_opt_in !== undefined) {
    if (typeof newsletter_opt_in !== 'boolean') {
        return res.status(400).json({ error: { message: `Invalid newsletter_opt_in, must be boolean.`, code: 'INVALID_PREFERENCE_VALUE' } });
    }
    updateData.newsletter_opt_in = newsletter_opt_in;
  }
  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: { message: 'No preference data provided to update.', code: 'NO_PREFERENCE_DATA' } });
  }
  try {
    logger.info(`Updating preferences for user: ${req.user.email} (ID: ${userId}) with data:`, updateData);
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { // Select only necessary fields to return, avoid password_hash etc.
        id: true,
        email: true,
        username: true,
        story_preference: true,
        newsletter_opt_in: true,
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
      select: { password_hash: true } // Only select the hash
    });
    if (!userWithPassword) {
      // This case should ideally not be reached if `protect` middleware works correctly
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
/**
 * @route   GET /api/v1/users/me/shaped-themes-summary
 * @desc    Fetch a summary of themes for which the user has World Shards, including counts of active shards.
 * @access  Private
 */
router.get('/me/shaped-themes-summary', protect, async (req, res) => {
  const userId = req.user.id;
  logger.info(`Fetching shaped themes summary for user ${userId}`);
  try {
    // Get total shards per theme for this user
    const shardSummary = await prisma.userThemePersistedLore.groupBy({
      by: ['themeId'],
      where: {
        userId: userId,
      },
      _count: {
        id: true, // Count all shards for this theme
      },
    });
    // Get count of *active* shards per theme for this user
    const themesWithActiveShards = await prisma.userThemePersistedLore.groupBy({
        by: ['themeId'],
        where: {
            userId: userId,
            isActiveForNewGames: true,
        },
        _count: {
            isActiveForNewGames: true // This will count rows where isActiveForNewGames is true
        }
    });
    // Create a map for easy lookup of active shard counts
    const activeCountsMap = new Map(themesWithActiveShards.map(item => [item.themeId, item._count.isActiveForNewGames]));
    // Combine the summaries
    const result = shardSummary.map(theme => ({
      themeId: theme.themeId,
      hasShards: theme._count.id > 0,
      totalShardCount: theme._count.id,
      activeShardCount: activeCountsMap.get(theme.themeId) || 0, // Default to 0 if no active shards
    }));
    res.status(200).json({
      message: 'Shaped themes summary fetched successfully.',
      shapedThemes: result,
    });
  } catch (error) {
    logger.error(`Error fetching shaped themes summary for user ${userId}:`, error);
    res.status(500).json({ error: { message: 'Failed to fetch shaped themes summary.', code: 'SHAPED_THEMES_SUMMARY_FETCH_ERROR' } });
  }
});
/**
 * @route   GET /api/v1/users/me/themes/:themeId/progress
 * @desc    Fetch user's persistent progress for a specific theme.
 * @access  Private
 */
router.get('/me/themes/:themeId/progress', protect, async (req, res) => {
  const userId = req.user.id;
  const { themeId } = req.params;
  if (!themeId) {
    logger.warn(`User theme progress request for user ${userId} with missing themeId.`);
    return res.status(400).json({ error: { message: 'Theme ID is required.', code: 'MISSING_THEME_ID' } });
  }
  logger.info(`Fetching UserThemeProgress for user ${userId}, theme ${themeId}`);
  try {
    const userThemeProgress = await prisma.userThemeProgress.findUnique({
      where: {
        userId_themeId: { // Corrected: Use camelCase 'themeId' as part of the compound key
          userId: userId,
          themeId: themeId, // Corrected: Use camelCase 'themeId' for the field name
        },
      },
    });
    if (!userThemeProgress) {
      logger.info(`No UserThemeProgress found for user ${userId}, theme ${themeId}. Returning default initial state.`);
      // If no progress record exists, it implies a new character for this theme.
      // Return a default structure consistent with the UserThemeProgress model.
      return res.status(200).json({ // 200 is fine, client can interpret this as "new character" for this theme
        message: 'No existing progress found for this theme. Default initial progress returned.',
        userThemeProgress: {
          userId: userId,
          themeId: themeId,
          level: 1,
          currentXP: 0,
          maxIntegrityBonus: 0,
          maxWillpowerBonus: 0,
          aptitudeBonus: 0,
          resilienceBonus: 0,
          acquiredTraitKeys: [], // Ensure it's an array
        }
      });
    }
    res.status(200).json({
      message: 'User theme progress fetched successfully.',
      userThemeProgress: userThemeProgress,
    });
  } catch (error) {
    logger.error(`Error fetching UserThemeProgress for user ${userId}, theme ${themeId}:`, error);
    res.status(500).json({ error: { message: 'Failed to fetch user theme progress.', code: 'USER_THEME_PROGRESS_FETCH_ERROR' } });
  }
});
/**
 * @route   POST /api/v1/users/me/themes/:themeId/boon
 * @desc    Apply a selected Boon to the user's theme progress.
 * @access  Private
 */
router.post('/me/themes/:themeId/boon', protect, async (req, res) => {
  const userId = req.user.id;
  const { themeId } = req.params;
  const { boonType, targetAttribute, value } = req.body;
  logger.info(`Applying Boon for user ${userId}, theme ${themeId}. Payload:`, req.body);
  if (!themeId) {
    return res.status(400).json({ error: { message: 'Theme ID is required.', code: 'MISSING_THEME_ID_BOON' } });
  }
  if (!boonType || !targetAttribute || value === undefined) {
    return res.status(400).json({ error: { message: 'Boon type, target attribute, and value are required.', code: 'MISSING_BOON_PAYLOAD' } });
  }
  try {
    const userThemeProgress = await prisma.userThemeProgress.findUnique({
      where: {
        userId_themeId: { // Prisma's default naming for compound unique constraint index
          userId: userId,
          themeId: themeId,
        },
      },
    });
    if (!userThemeProgress) {
      logger.warn(`UserThemeProgress not found for user ${userId}, theme ${themeId} during Boon application.`);
      return res.status(404).json({ error: { message: 'User theme progress not found.', code: 'USER_THEME_PROGRESS_NOT_FOUND_BOON' } });
    }
    const updateData = {};
    let validBoon = false;
    if (boonType === "MAX_ATTRIBUTE_INCREASE") {
      const allowedTargets = ["maxIntegrityBonus", "maxWillpowerBonus"];
      if (allowedTargets.includes(targetAttribute) && typeof value === 'number' && value > 0) {
        updateData[targetAttribute] = (userThemeProgress[targetAttribute] || 0) + value;
        validBoon = true;
      } else {
        logger.warn(`Invalid targetAttribute or value for MAX_ATTRIBUTE_INCREASE: ${targetAttribute}, ${value}`);
      }
    }
    // Future Phase 3:
    // else if (boonType === "ATTRIBUTE_ENHANCEMENT") { ... }
    // else if (boonType === "NEW_TRAIT") { ... }
    if (!validBoon) {
      return res.status(400).json({ error: { message: 'Invalid Boon details provided.', code: 'INVALID_BOON_DETAILS' } });
    }
    const updatePayload = {
      ...updateData,
      level: {
        increment: 1,
      },
    };
    const updatedProgress = await prisma.userThemeProgress.update({
      where: {
        userId_themeId: {
          userId: userId,
          themeId: themeId,
        },
      },
      data: updatePayload,
    });
    logger.info(`Boon applied successfully for user ${userId}, theme ${themeId}. Updated progress:`, updatedProgress);
    res.status(200).json({
      message: 'Boon applied successfully.',
      userThemeProgress: updatedProgress,
    });
  } catch (error) {
    logger.error(`Error applying Boon for user ${userId}, theme ${themeId}:`, error);
    res.status(500).json({ error: { message: 'Failed to apply Boon due to a server error.', code: 'BOON_APPLICATION_ERROR' } });
  }
});
export default router;
