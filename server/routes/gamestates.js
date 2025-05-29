// server/routes/gamestates.js
import express from 'express';
import prisma from '../db.js';
import logger from '../utils/logger.js';
import { protect } from '../middleware/authMiddleware.js';
// Potentially import ALL_THEMES_CONFIG if needed for theme_version_id or other lookups
// import { ALL_THEMES_CONFIG } from '../path-to-your-theme-configs-if-loaded-server-side';

const router = express.Router();

// --- GameState Validation Middleware ---
const validateGameStatePayload = (req, res, next) => {
  const {
    theme_id,
    player_identifier,
    game_history,
    last_dashboard_updates,
    last_game_state_indicators,
    current_prompt_type,
    current_narrative_language,
    last_suggested_actions,
    panel_states,
  } = req.body;

  const errors = [];

  if (!theme_id || typeof theme_id !== 'string' || theme_id.trim() === '') {
    errors.push('theme_id is required and must be a non-empty string.');
  }
  if (!player_identifier || typeof player_identifier !== 'string' || player_identifier.trim() === '') {
    errors.push('player_identifier is required and must be a non-empty string.');
  }
  if (typeof game_history === 'undefined' || !Array.isArray(game_history)) {
    errors.push('game_history is required and must be an array.');
  }
  if (typeof last_dashboard_updates === 'undefined' || typeof last_dashboard_updates !== 'object' || last_dashboard_updates === null) {
    errors.push('last_dashboard_updates is required and must be an object.');
  }
  if (typeof last_game_state_indicators === 'undefined' || typeof last_game_state_indicators !== 'object' || last_game_state_indicators === null) {
    errors.push('last_game_state_indicators is required and must be an object.');
  }
  if (!current_prompt_type || typeof current_prompt_type !== 'string' || current_prompt_type.trim() === '') {
    errors.push('current_prompt_type is required and must be a non-empty string.');
  }
  if (!current_narrative_language || typeof current_narrative_language !== 'string' || current_narrative_language.trim() === '') {
    errors.push('current_narrative_language is required and must be a non-empty string.');
  }
  if (typeof last_suggested_actions === 'undefined' || !Array.isArray(last_suggested_actions)) {
    errors.push('last_suggested_actions is required and must be an array.');
  }
  if (typeof panel_states === 'undefined' || typeof panel_states !== 'object' || panel_states === null) {
    errors.push('panel_states is required and must be an object.');
  }

  // Add more specific validations for the contents of arrays/objects if deemed necessary
  // For example, game_history should contain objects with 'role' and 'parts'
  if (game_history && Array.isArray(game_history)) {
    for (const turn of game_history) {
      if (typeof turn !== 'object' || turn === null || !turn.role || !turn.parts || !Array.isArray(turn.parts)) {
        errors.push('Each item in game_history must be an object with "role" and "parts" (array).');
        break;
      }
    }
  }


  if (errors.length > 0) {
    logger.warn(`GameState payload validation failed for user ${req.user?.id}:`, errors);
    return res.status(400).json({ error: { message: 'Invalid game state payload.', code: 'INVALID_PAYLOAD', details: errors } });
  }

  next();
};

/**
 * @route   POST /api/v1/gamestates
 * @desc    Create or Update a game state for the authenticated user and theme.
 *          Also updates the associated UserThemeInteraction.
 * @access  Private
 */
router.post('/', protect, validateGameStatePayload, async (req, res) => {
  const {
    theme_id,
    player_identifier,
    game_history,
    game_history_summary,
    last_dashboard_updates,
    last_game_state_indicators,
    current_prompt_type,
    current_narrative_language,
    last_suggested_actions,
    panel_states,
  } = req.body;

  const userId = req.user.id;
  const modelNameUsed = req.user.preferred_model_name || FREE_MODEL_NAME; // Default if not set

  // Data for GameState upsert
  const gameStatePayload = {
    player_identifier,
    game_history,
    last_dashboard_updates,
    last_game_state_indicators,
    current_prompt_type,
    current_narrative_language,
    last_suggested_actions,
    panel_states,
    model_name_used: modelNameUsed,
  };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const upsertedGameState = await tx.gameState.upsert({
        where: {
          userId_theme_id: { userId, theme_id },
        },
        update: gameStatePayload,
        create: {
          userId,
          theme_id,
          ...gameStatePayload,
        },
      });

      const upsertedInteraction = await tx.userThemeInteraction.upsert({
        where: {
          userId_theme_id: { userId, theme_id },
        },
        create: {
          userId,
          theme_id,
          is_playing: true,
          last_played_at: upsertedGameState.updated_at,
          is_liked: false,
        },
        update: {
          is_playing: true,
          last_played_at: upsertedGameState.updated_at,
        },
      });

      return { gameState: upsertedGameState, interaction: upsertedInteraction };
    });

    logger.info(`GameState & UserThemeInteraction for user ${userId}, theme ${theme_id} saved/updated successfully.`);
    res.status(200).json({ message: 'Game state saved.', gameState: result.gameState });

  } catch (error) {
    logger.error(`Transaction error saving game state for user ${userId}, theme ${theme_id}:`, error);
    res.status(500).json({ error: { message: 'Failed to save game state due to a server error.', code: 'GAME_STATE_SAVE_TRANSACTION_ERROR' } });
  }
});

/**
 * @route   GET /api/v1/gamestates/:themeId
 * @desc    Get the game state for the authenticated user and a specific theme.
 * @access  Private
 */
router.get('/:themeId', protect, async (req, res) => {
  const userId = req.user.id;
  const { themeId } = req.params;

  if (!themeId || typeof themeId !== 'string' || themeId.trim() === '') {
    return res.status(400).json({ error: { message: 'Valid themeId parameter is required.', code: 'INVALID_THEMEID_PARAM' } });
  }

  try {
    const gameState = await prisma.gameState.findUnique({
      where: {
        userId_theme_id: {
          userId: userId,
          theme_id: themeId,
        },
      },
    });

    if (!gameState) {
      logger.info(`No game state found for user ${userId}, theme ${themeId}.`);
      return res.status(404).json({ error: { message: 'Game state not found for this theme.', code: 'GAME_STATE_NOT_FOUND' } });
    }

    logger.info(`GameState retrieved for user ${userId}, theme ${themeId}.`);
    res.status(200).json(gameState);

  } catch (error) {
    logger.error(`Error retrieving game state for user ${userId}, theme ${themeId}:`, error);
    res.status(500).json({ error: { message: 'Failed to retrieve game state.', code: 'GAME_STATE_RETRIEVAL_ERROR' } });
  }
});

/**
 * @route   DELETE /api/v1/gamestates/:themeId
 * @desc    Delete the game state for the authenticated user and a specific theme.
 *          This will set `is_playing` to false in UserThemeInteraction but keep the record.
 * @access  Private
 */
router.delete('/:themeId', protect, async (req, res) => {
  const userId = req.user.id;
  const { themeId } = req.params;

  if (!themeId || typeof themeId !== 'string' || themeId.trim() === '') {
    return res.status(400).json({ error: { message: 'Valid themeId parameter is required.', code: 'INVALID_THEMEID_PARAM' } });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingGameState = await tx.gameState.findUnique({
        where: {
          userId_theme_id: { userId, theme_id: themeId },
        },
        select: { id: true }
      });

      if (!existingGameState) {
        const notFoundError = new Error('GameState not found');
        notFoundError.code = 'P2025';
        throw notFoundError;
      }

      await tx.gameState.delete({
        where: {
          userId_theme_id: {
            userId: userId,
            theme_id: themeId,
          },
        },
      });

      await tx.userThemeInteraction.updateMany({
        where: {
          userId: userId,
          theme_id: themeId,
        },
        data: {
          is_playing: false,
        },
      });
      return { success: true };
    });

    if (result.success) {
        logger.info(`GameState deleted for user ${userId}, theme ${themeId}, and UserThemeInteraction updated.`);
        res.status(200).json({ message: 'Game state deleted successfully.' });
    }

  } catch (error) {
    if (error.code === 'P2025') {
        logger.info(`Attempt to delete non-existent game state for user ${userId}, theme ${themeId}.`);
        return res.status(404).json({ error: { message: 'Game state not found, nothing to delete.', code: 'GAME_STATE_NOT_FOUND_FOR_DELETE' } });
    }
    logger.error(`Transaction error deleting game state for user ${userId}, theme ${themeId}:`, error);
    res.status(500).json({ error: { message: 'Failed to delete game state.', code: 'GAME_STATE_DELETE_TRANSACTION_ERROR' } });
  }
});


export default router;
