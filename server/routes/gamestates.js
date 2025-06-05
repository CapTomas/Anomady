// server/routes/gamestates.js
import express from 'express';
import prisma from '../db.js';
import logger from '../utils/logger.js';
import { protect } from '../middleware/authMiddleware.js';
import { generatePlayerSummarySnippet, evolveWorldLore } from '../utils/aiHelper.js';
import { getResolvedBaseThemeLore, getResolvedThemeName } from '../utils/themeDataManager.js';

const router = express.Router();
// --- Constants for Living Chronicle ---
const RECENT_INTERACTION_WINDOW_SIZE = 10; // For sending to main AI
const RAW_HISTORY_BUFFER_MAX_SIZE = 25;    // Max raw turns in DB before summarization
const SUMMARIZATION_CHUNK_SIZE = 15;       // Oldest turns to summarize from buffer
const FREE_MODEL_NAME = process.env.FREE_MODEL_NAME || "gemini-1.5-flash-latest";

// --- GameState Validation Middleware ---
const validateGameStatePayload = (req, res, next) => {
  const {
    theme_id, player_identifier, game_history,
    last_dashboard_updates, last_game_state_indicators, current_prompt_type,
    current_narrative_language, last_suggested_actions, panel_states,
    dashboard_item_meta, xp_awarded_this_turn, user_theme_progress, is_boon_selection_pending,
  } = req.body;
  const errors = [];
  if (!theme_id || typeof theme_id !== 'string' || theme_id.trim() === '') { errors.push('theme_id is required and must be a non-empty string.'); }
  if (!player_identifier || typeof player_identifier !== 'string' || player_identifier.trim() === '') { errors.push('player_identifier is required and must be a non-empty string.'); }
  if (typeof game_history === 'undefined' || !Array.isArray(game_history)) { errors.push('game_history is required and must be an array.'); }
  if (typeof last_dashboard_updates === 'undefined' || typeof last_dashboard_updates !== 'object' || last_dashboard_updates === null) { errors.push('last_dashboard_updates is required and must be an object.'); }
  if (typeof last_game_state_indicators === 'undefined' || typeof last_game_state_indicators !== 'object' || last_game_state_indicators === null) { errors.push('last_game_state_indicators is required and must be an object.'); }
  if (!current_prompt_type || typeof current_prompt_type !== 'string' || current_prompt_type.trim() === '') { errors.push('current_prompt_type is required and must be a non-empty string.'); }
  if (!current_narrative_language || typeof current_narrative_language !== 'string' || current_narrative_language.trim() === '') { errors.push('current_narrative_language is required and must be a non-empty string.'); }
  if (typeof last_suggested_actions === 'undefined' || !Array.isArray(last_suggested_actions)) { errors.push('last_suggested_actions is required and must be an array.'); }
  if (typeof panel_states === 'undefined' || typeof panel_states !== 'object' || panel_states === null) { errors.push('panel_states is required and must be an object.'); }
  if (req.body.dashboard_item_meta !== undefined && (typeof req.body.dashboard_item_meta !== 'object' || req.body.dashboard_item_meta === null)) { errors.push('dashboard_item_meta must be an object if provided.'); }
  if (xp_awarded_this_turn !== undefined && (typeof xp_awarded_this_turn !== 'number' || xp_awarded_this_turn < 0)) {
    errors.push('xp_awarded_this_turn must be a non-negative number if provided.');
  }
  if (user_theme_progress !== undefined) {
    if (typeof user_theme_progress !== 'object' || user_theme_progress === null) {
      errors.push('user_theme_progress must be an object if provided.');
    } else {
      if (user_theme_progress.level !== undefined && (typeof user_theme_progress.level !== 'number' || user_theme_progress.level < 1)) {
        errors.push('user_theme_progress.level must be a positive number if present.');
      }
      if (user_theme_progress.currentXP !== undefined && (typeof user_theme_progress.currentXP !== 'number' || user_theme_progress.currentXP < 0)) {
        errors.push('user_theme_progress.currentXP must be a non-negative number if present.');
      }
      if (user_theme_progress.acquiredTraitKeys !== undefined && !Array.isArray(user_theme_progress.acquiredTraitKeys)) {
        errors.push('user_theme_progress.acquiredTraitKeys must be an array if present.');
      }
      // Optional: validate other bonus fields (maxIntegrityBonus etc.) if strictness is needed
    }
  } else {
    // If user_theme_progress is not provided at all, xp_awarded_this_turn becomes critical for any XP update.
    // This path is mostly for backward compatibility or if the client specifically wants to only send XP delta.
    // However, the primary flow will now involve sending the full user_theme_progress object.
  }
  if (typeof is_boon_selection_pending === 'undefined' || typeof is_boon_selection_pending !== 'boolean') {
    errors.push('is_boon_selection_pending is required and must be a boolean.');
  }
  if (game_history && Array.isArray(game_history)) {
    for (const turn of game_history) {
      if (typeof turn !== 'object' || turn === null || !turn.role || !turn.parts || !Array.isArray(turn.parts)) {
        errors.push('Each item in game_history must be an object with "role" and "parts" (array).'); break;
      }
    }
    if (game_history.length > RAW_HISTORY_BUFFER_MAX_SIZE * 2) {
        errors.push(`game_history from client is excessively long (${game_history.length} turns). Max allowed: ${RAW_HISTORY_BUFFER_MAX_SIZE * 2}`);
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
 * @desc    Create or Update a game state. Handles Living Chronicle summarization, World Shard unlocking, and XP processing.
 * @access  Private
 */
router.post('/', protect, validateGameStatePayload, async (req, res) => {
  const {
    theme_id, player_identifier, game_history: clientSentHistory,
    last_dashboard_updates, last_game_state_indicators, current_prompt_type,
    current_narrative_language, last_suggested_actions, panel_states,
    new_persistent_lore_unlock, xp_awarded_this_turn, // xp_awarded_this_turn is kept for logging/other potential uses
    user_theme_progress: clientUserThemeProgress, // New field
    is_boon_selection_pending,
  } = req.body;
  const userId = req.user.id;
  const determinedModelName = req.user.preferred_model_name || FREE_MODEL_NAME;

  const gameStateClientPayload = {
    player_identifier, last_dashboard_updates, last_game_state_indicators,
    current_prompt_type, current_narrative_language, last_suggested_actions,
    panel_states, model_name_used: determinedModelName,
    dashboard_item_meta: req.body.dashboard_item_meta || {},
    is_boon_selection_pending, // Add the new field here
  };

  try {
    const result = await prisma.$transaction(async (tx) => {
      let existingGameState = await tx.gameState.findUnique({
        where: { userId_theme_id: { userId, theme_id } },
      });

      let finalGameHistoryForDB;
      let finalCumulativePlayerSummary = existingGameState?.game_history_summary || "";
      let finalCurrentWorldLore = existingGameState?.game_history_lore;

      if (!finalCurrentWorldLore && (!existingGameState || clientSentHistory.length <= RECENT_INTERACTION_WINDOW_SIZE)) {
          finalCurrentWorldLore = await getResolvedBaseThemeLore(theme_id, current_narrative_language);
          logger.info(`[LivingChronicle] Initializing/Resetting world lore for user ${userId}, theme ${theme_id}.`);
      }

      if (existingGameState && Array.isArray(existingGameState.game_history)) {
          if (clientSentHistory.length >= existingGameState.game_history.length || clientSentHistory.length <= RECENT_INTERACTION_WINDOW_SIZE) {
              finalGameHistoryForDB = clientSentHistory;
              if (clientSentHistory.length <= RECENT_INTERACTION_WINDOW_SIZE && existingGameState.game_history.length > clientSentHistory.length) {
                  logger.info(`[LivingChronicle] Detected potential game reset for user ${userId}, theme ${theme_id}. Resetting summary and lore.`);
                  finalCumulativePlayerSummary = "";
                  finalCurrentWorldLore = await getResolvedBaseThemeLore(theme_id, current_narrative_language);
              }
          } else {
              logger.warn(`[LivingChronicle] Client history for user ${userId}, theme ${theme_id} is shorter (${clientSentHistory.length}) than DB (${existingGameState.game_history.length}) and not a clear reset. Using client's version and resetting summary/lore.`);
              finalGameHistoryForDB = clientSentHistory;
              finalCumulativePlayerSummary = "";
              finalCurrentWorldLore = await getResolvedBaseThemeLore(theme_id, current_narrative_language);
          }
      } else {
          finalGameHistoryForDB = clientSentHistory;
          finalCumulativePlayerSummary = "";
          if (!finalCurrentWorldLore) {
            finalCurrentWorldLore = await getResolvedBaseThemeLore(theme_id, current_narrative_language);
          }
      }

      const upsertedGameState = await tx.gameState.upsert({
        where: { userId_theme_id: { userId, theme_id } },
        update: {
          ...gameStateClientPayload,
          game_history: finalGameHistoryForDB,
          game_history_summary: finalCumulativePlayerSummary,
          game_history_lore: finalCurrentWorldLore,
          dashboard_item_meta: gameStateClientPayload.dashboard_item_meta,
          is_boon_selection_pending: gameStateClientPayload.is_boon_selection_pending, // Persist this flag
        },
        create: {
          userId, theme_id, ...gameStateClientPayload,
          game_history: finalGameHistoryForDB,
          game_history_summary: finalCumulativePlayerSummary,
          game_history_lore: finalCurrentWorldLore,
          summarization_in_progress: false,
          dashboard_item_meta: gameStateClientPayload.dashboard_item_meta,
          is_boon_selection_pending: gameStateClientPayload.is_boon_selection_pending, // Persist this flag
        },
      });

      // Handle XP awarded this turn
        if (clientUserThemeProgress && typeof clientUserThemeProgress === 'object') {
        const acquiredTraitKeysForDB = Array.isArray(clientUserThemeProgress.acquiredTraitKeys)
                                         ? clientUserThemeProgress.acquiredTraitKeys
                                         : [];
        await tx.userThemeProgress.upsert({
          where: { userId_themeId: { userId: userId, themeId: theme_id } },
          create: {
            userId: userId,
            themeId: theme_id,
            level: clientUserThemeProgress.level || 1,
            currentXP: clientUserThemeProgress.currentXP || 0,
            maxIntegrityBonus: clientUserThemeProgress.maxIntegrityBonus || 0,
            maxWillpowerBonus: clientUserThemeProgress.maxWillpowerBonus || 0,
            aptitudeBonus: clientUserThemeProgress.aptitudeBonus || 0,
            resilienceBonus: clientUserThemeProgress.resilienceBonus || 0,
            acquiredTraitKeys: acquiredTraitKeysForDB,
          },
          update: {
            level: clientUserThemeProgress.level,
            currentXP: clientUserThemeProgress.currentXP,
            // Bonuses (maxIntegrityBonus, etc.) are primarily updated via the Boon endpoint.
            // acquiredTraitKeys are also primarily updated via Boons but can be persisted here if client state changes.
            acquiredTraitKeys: acquiredTraitKeysForDB,
          },
        });
        logger.info(`[UserThemeProgress] Upserted for user ${userId}, theme ${theme_id} using full client payload: Level ${clientUserThemeProgress.level}, XP ${clientUserThemeProgress.currentXP}.`);
      } else if (xp_awarded_this_turn !== undefined && typeof xp_awarded_this_turn === 'number' && xp_awarded_this_turn > 0) {
        // Fallback for older clients or if full progress object isn't sent, only increment XP.
        logger.warn(`[UserThemeProgress] clientUserThemeProgress payload missing. Using xp_awarded_this_turn (${xp_awarded_this_turn}) to increment XP only for user ${userId}, theme ${theme_id}. Level will not be updated by this save.`);
        await tx.userThemeProgress.upsert({
            where: { userId_themeId: { userId: userId, themeId: theme_id } },
            create: {
                userId: userId,
                themeId: theme_id,
                currentXP: xp_awarded_this_turn,
                level: 1, // Default level on creation
            },
            update: {
                currentXP: {
                    increment: xp_awarded_this_turn,
                },
            },
        });
      } else {
        // Ensure a default UserThemeProgress record exists if it's the very first save for this user/theme and no XP was awarded.
        const existingProgress = await tx.userThemeProgress.findUnique({
          where: { userId_themeId: { userId: userId, themeId: theme_id } }
        });
        if (!existingProgress) {
          await tx.userThemeProgress.create({
            data: {
              userId: userId,
              themeId: theme_id,
              level: 1,
              currentXP: 0,
              maxIntegrityBonus: 0,
              maxWillpowerBonus: 0,
              aptitudeBonus: 0,
              resilienceBonus: 0,
              acquiredTraitKeys: [],
            }
          });
          logger.info(`[UserThemeProgress] Initialized default progress for user ${userId}, theme ${theme_id} as no client data or XP delta was provided.`);
        }
      }

      // Handle World Shard Unlocking
      if (new_persistent_lore_unlock && typeof new_persistent_lore_unlock === 'object') {
        const { key_suggestion, title, content, unlock_condition_description } = new_persistent_lore_unlock;
        if (key_suggestion && title && content && unlock_condition_description) {
          try {
            await tx.userThemePersistedLore.create({
              data: {
                userId: userId,
                themeId: theme_id,
                loreFragmentKey: key_suggestion,
                loreFragmentTitle: title,
                loreFragmentContent: content,
                unlockConditionDescription: unlock_condition_description,
              }
            });
            logger.info(`[WorldShard] Successfully created new world shard via GameState save for user ${userId}, theme ${theme_id}, key '${key_suggestion}'`);
          } catch (shardError) {
            if (shardError.code === 'P2002') {
              logger.warn(`[WorldShard] Failed to create shard for user ${userId}, theme ${theme_id}, key '${key_suggestion}' due to unique constraint (likely duplicate key from AI). Shard not created.`);
            } else {
              logger.error(`[WorldShard] Error creating new world shard during GameState save for user ${userId}, theme ${theme_id}, key '${key_suggestion}':`, shardError);
              throw new Error(`Failed to create world shard: ${shardError.message}`);
            }
          }
        } else {
          logger.warn(`[WorldShard] Received 'new_persistent_lore_unlock' signal but required fields (key_suggestion, title, content, unlock_condition_description) were missing. User: ${userId}, Theme: ${theme_id}. Unlock data:`, new_persistent_lore_unlock);
        }
      }

      // Handle Living Chronicle Summarization
      if (
        finalGameHistoryForDB && Array.isArray(finalGameHistoryForDB) &&
        finalGameHistoryForDB.length >= RAW_HISTORY_BUFFER_MAX_SIZE &&
        !upsertedGameState.summarization_in_progress
      ) {
        await tx.gameState.update({
          where: { id: upsertedGameState.id },
          data: { summarization_in_progress: true },
        });
        const baseLoreForSummarization = await getResolvedBaseThemeLore(theme_id, current_narrative_language);
        const themeNameForSummarization = await getResolvedThemeName(theme_id, current_narrative_language);
        processSummarization(
            upsertedGameState.id, userId, theme_id,
            [...finalGameHistoryForDB],
            finalCumulativePlayerSummary,
            finalCurrentWorldLore,
            current_narrative_language,
            baseLoreForSummarization,
            themeNameForSummarization
        ).catch(err => {
            logger.error(`[LivingChronicle] Background summarization process failed catastrophically for gsID ${upsertedGameState.id}:`, err);
            prisma.gameState.update({
                where: { id: upsertedGameState.id }, data: { summarization_in_progress: false }
            }).catch(resetErr => logger.error(`[LivingChronicle] CRITICAL FALLBACK: Failed to reset summarization_in_progress for gsID ${upsertedGameState.id}:`, resetErr));
        });
      }

      const upsertedInteraction = await tx.userThemeInteraction.upsert({
        where: { userId_theme_id: { userId, theme_id } },
        create: {
          userId, theme_id, is_playing: true,
          last_played_at: upsertedGameState.updated_at, is_liked: false,
        },
        update: { is_playing: true, last_played_at: upsertedGameState.updated_at },
      });

      return {
        gameState: {
            ...upsertedGameState,
            game_history_lore: finalCurrentWorldLore,
            game_history_summary: finalCumulativePlayerSummary
        },
        interaction: upsertedInteraction
      };
    });

    logger.info(`GameState & UserThemeInteraction for user ${userId}, theme ${theme_id} saved/updated. Raw history length in DB: ${result.gameState.game_history.length}`);
    res.status(200).json({ message: 'Game state saved.', gameState: result.gameState });

  } catch (error) {
    logger.error(`Transaction error saving game state for user ${userId}, theme ${theme_id}:`, error);
    if (error.message.startsWith('Failed to create world shard:')) {
        return res.status(500).json({ error: { message: error.message, code: 'WORLD_SHARD_CREATION_FAILED_IN_TX' } });
    }
    if (error.code === 'P2002' && error.meta?.target?.includes('userId_theme_id')) { // Assuming this is for GameState unique constraint
        return res.status(409).json({ error: { message: 'Conflict saving game state, likely a concurrent update. Please try again.', code: 'GAME_STATE_SAVE_CONFLICT' } });
    }
    res.status(500).json({ error: { message: 'Failed to save game state due to a server error.', code: 'GAME_STATE_SAVE_TRANSACTION_ERROR' } });
  }
});

/**
 * Asynchronous function to process summarization and lore evolution.
 * This runs in the background and updates the database directly.
 */
async function processSummarization(gameStateId, userIdForLog, theme_id, rawHistoryForSummarization, currentSummary, currentDbLore, narrativeLanguage, baseThemeLore, themeNameForPrompt) {
    logger.info(`[LivingChronicle] Starting summarization for gsID ${gameStateId}, user ${userIdForLog}, theme ${theme_id}. History chunk size: ${SUMMARIZATION_CHUNK_SIZE}`);
    const historyChunkToProcess = rawHistoryForSummarization.slice(0, SUMMARIZATION_CHUNK_SIZE);
    const remainingRawHistoryForDB = rawHistoryForSummarization.slice(SUMMARIZATION_CHUNK_SIZE);

    let newPlayerSummarySnippet = null;
    let newEvolvedLoreText = null;

    try {
        newPlayerSummarySnippet = await generatePlayerSummarySnippet(historyChunkToProcess, narrativeLanguage);
        if (!newPlayerSummarySnippet) {
            logger.warn(`[LivingChronicle/PlayerSummary] Failed to generate snippet for gsID ${gameStateId}. Will use existing summary.`);
        }

        const validBaseThemeLore = (typeof baseThemeLore === 'string' && baseThemeLore.trim() !== '') ? baseThemeLore : `Default base lore for ${themeNameForPrompt}.`;
        const loreInputForEvolution = (typeof currentDbLore === 'string' && currentDbLore.trim() !== '') ? currentDbLore : validBaseThemeLore;

        newEvolvedLoreText = await evolveWorldLore(historyChunkToProcess, loreInputForEvolution, validBaseThemeLore, themeNameForPrompt, narrativeLanguage);
        if (!newEvolvedLoreText) {
            logger.warn(`[LivingChronicle/LoreEvolution] Failed to evolve lore for gsID ${gameStateId}. Will use existing/base lore.`);
        }

        const finalCumulativeSummaryToSave = newPlayerSummarySnippet
            ? (currentSummary ? `${currentSummary}\n\n---\n\n${newPlayerSummarySnippet}` : newPlayerSummarySnippet)
            : currentSummary;

        const finalLoreToSave = newEvolvedLoreText || currentDbLore || validBaseThemeLore;

        await prisma.gameState.update({
            where: { id: gameStateId },
            data: {
                game_history: remainingRawHistoryForDB,
                game_history_summary: finalCumulativeSummaryToSave,
                game_history_lore: finalLoreToSave,
                summarization_in_progress: false,
            },
        });
        logger.info(`[LivingChronicle] Successfully completed summarization processing for gsID ${gameStateId}. New raw history length: ${remainingRawHistoryForDB.length}`);
    } catch (error) {
        logger.error(`[LivingChronicle] Critical error during summarization DB update or AI calls for gsID ${gameStateId}:`, error);
        await prisma.gameState.update({
            where: { id: gameStateId },
            data: { summarization_in_progress: false },
        }).catch(e => logger.error(`[LivingChronicle] CRITICAL: Failed to reset summarization_in_progress for gsID ${gameStateId} after error:`, e));
    }
}

/**
 * @route   GET /api/v1/gamestates/:themeId
 * @desc    Get the game state, including evolved lore, summary, and user theme progress.
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
      where: { userId_theme_id: { userId: userId, theme_id: themeId } },
    });

    let userThemeProgress = await prisma.userThemeProgress.findUnique({
        where: {
            userId_themeId: {
                userId: userId,
                themeId: themeId
            }
        }
    });

    if (!gameState) {
      logger.info(`No game state found for user ${userId}, theme ${themeId}.`);
      const baseLore = await getResolvedBaseThemeLore(themeId, req.user.preferred_narrative_language || 'en');
      // If no game state, but progress exists, return progress. Client handles if it's a truly "new" game.
      return res.status(404).json({
        error: { message: 'Game state not found for this theme.', code: 'GAME_STATE_NOT_FOUND' },
        new_game_context: { base_lore: baseLore },
        userThemeProgress: userThemeProgress // Return progress even if no game state for a fresh start
      });
    }

    let effectiveEvolvedLore = gameState.game_history_lore;
    if (effectiveEvolvedLore === null || typeof effectiveEvolvedLore === 'undefined' || effectiveEvolvedLore.trim() === '') {
        effectiveEvolvedLore = await getResolvedBaseThemeLore(themeId, gameState.current_narrative_language);
        logger.info(`[LivingChronicle] Lore was empty/null for user ${userId}, theme ${themeId}. Using base lore.`);
    }

    const clientGameHistory = Array.isArray(gameState.game_history)
        ? gameState.game_history.slice(-RECENT_INTERACTION_WINDOW_SIZE)
        : [];

    logger.info(`GameState retrieved for user ${userId}, theme ${themeId}. Sending ${clientGameHistory.length} recent turns.`);
    res.status(200).json({
        ...gameState,
        game_history: clientGameHistory,
        game_history_lore: effectiveEvolvedLore,
        userThemeProgress: userThemeProgress // Include UserThemeProgress in the response
    });

  } catch (error) {
    logger.error(`Error retrieving game state for user ${userId}, theme ${themeId}:`, error);
    res.status(500).json({ error: { message: 'Failed to retrieve game state.', code: 'GAME_STATE_RETRIEVAL_ERROR' } });
  }
});

// --- DELETE route  ---
router.delete('/:themeId', protect, async (req, res) => {
  const userId = req.user.id;
  const { themeId } = req.params;

  if (!themeId || typeof themeId !== 'string' || themeId.trim() === '') {
    return res.status(400).json({ error: { message: 'Valid themeId parameter is required.', code: 'INVALID_THEMEID_PARAM' } });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingGameState = await tx.gameState.findUnique({
        where: { userId_theme_id: { userId, theme_id: themeId } },
        select: { id: true }
      });

      if (!existingGameState) {
        const notFoundError = new Error('GameState not found for deletion.');
        notFoundError.code = 'P2025'; // Prisma error code for record not found
        throw notFoundError;
      }

      await tx.gameState.delete({
        where: { userId_theme_id: { userId: userId, theme_id: themeId } },
      });

      // Optionally, decide if deleting game state should also delete UserThemeProgress
      // For now, let's keep UserThemeProgress, as it represents persistent character growth.
      // If UserThemeProgress should be deleted too, add:
      // await tx.userThemeProgress.deleteMany({
      //   where: { userId: userId, theme_id: themeId },
      // });

      await tx.userThemeInteraction.updateMany({
        where: { userId: userId, theme_id: themeId },
        data: { is_playing: false }, // Mark as not currently playing
      });

      return { success: true };
    });

    if (result.success) {
        logger.info(`GameState deleted for user ${userId}, theme ${themeId}, and UserThemeInteraction updated.`);
        res.status(200).json({ message: 'Game state deleted successfully.' });
    }
  } catch (error) {
    if (error.code === 'P2025') { // Record to delete not found
        logger.info(`Attempt to delete non-existent game state for user ${userId}, theme ${themeId}.`);
        return res.status(404).json({ error: { message: 'Game state not found, nothing to delete.', code: 'GAME_STATE_NOT_FOUND_FOR_DELETE' } });
    }
    logger.error(`Transaction error deleting game state for user ${userId}, theme ${themeId}:`, error);
    res.status(500).json({ error: { message: 'Failed to delete game state.', code: 'GAME_STATE_DELETE_TRANSACTION_ERROR' } });
  }
});

export default router;
