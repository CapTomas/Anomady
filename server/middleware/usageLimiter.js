/**
 * @file Middleware for enforcing API usage limits based on user tier.
 * It handles both registered users (DB-based) and anonymous users (IP-based, in-memory).
 */
import prisma from '../db.js';
import logger from '../utils/logger.js';
import { USER_TIERS } from '../config.js';

// In-memory store for anonymous user usage, keyed by IP address.
const anonymousUsage = new Map();

/**
 * Checks if a user's API call is within their tier's limits.
 * Attaches an `incrementUsage` function to the request object to be called on successful API response.
 * The `incrementUsage` function will return the new usage counts.
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 */
export const limitApiUsage = async (req, res, next) => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const ip = req.ip;

  const { modelName } = req.body;
  const user = req.user;

  if (user) {
    // --- Registered User Logic ---
    const tier = USER_TIERS[user.tier] || USER_TIERS.free;
    const currentHourly = user.lastHourlyReset < oneHourAgo ? 0 : user.hourlyApiCalls;
    const currentDaily = user.lastDailyReset < twentyFourHoursAgo ? 0 : user.dailyApiCalls;

    // Validate Model
    if (!tier.allowedModels.includes(modelName)) {
      logger.warn(`User ${user.id} (Tier: ${user.tier}) tried to use disallowed model: ${modelName}.`);
      return res.status(403).json({
        error: {
          message: `Your current tier does not permit the use of the '${modelName}' model.`,
          code: 'MODEL_NOT_ALLOWED_FOR_TIER',
        },
      });
    }

    // Validate Limits
    if (currentHourly >= tier.hourlyLimit || currentDaily >= tier.dailyLimit) {
      logger.warn(`API limit exceeded for user ${user.id}. Hourly: ${currentHourly}/${tier.hourlyLimit}, Daily: ${currentDaily}/${tier.dailyLimit}`);
      return res.status(429).json({
        error: { message: 'You have exceeded your API call limit for this period.', code: 'API_LIMIT_EXCEEDED' },
      });
    }

    req.incrementUsage = async () => {
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          hourlyApiCalls: user.lastHourlyReset < oneHourAgo ? 1 : { increment: 1 },
          dailyApiCalls: user.lastDailyReset < twentyFourHoursAgo ? 1 : { increment: 1 },
          lastHourlyReset: user.lastHourlyReset < oneHourAgo ? now : undefined,
          lastDailyReset: user.lastDailyReset < twentyFourHoursAgo ? now : undefined,
        },
      });
      return {
        hourly: { count: updatedUser.hourlyApiCalls, limit: tier.hourlyLimit },
        daily: { count: updatedUser.dailyApiCalls, limit: tier.dailyLimit },
      };
    };

  } else {
    // --- Anonymous User Logic ---
    const tier = USER_TIERS.anonymous;
    let anonRecord = anonymousUsage.get(ip);
    // Initialize or reset the anonymous user's record.
    if (!anonRecord) {
      // First time seeing this IP, create a fresh record.
      anonRecord = { hourlyApiCalls: 0, dailyApiCalls: 0, lastHourlyReset: now, lastDailyReset: now };
    } else {
      // Existing record, check if individual counters need resetting.
      if (anonRecord.lastHourlyReset < oneHourAgo) {
        anonRecord.hourlyApiCalls = 0;
        anonRecord.lastHourlyReset = now;
      }
      if (anonRecord.lastDailyReset < twentyFourHoursAgo) {
        anonRecord.dailyApiCalls = 0;
        anonRecord.lastDailyReset = now;
      }
    }
    anonymousUsage.set(ip, anonRecord);

    // Validate Model
    if (!tier.allowedModels.includes(modelName)) {
      logger.warn(`Anonymous IP ${ip} tried to use disallowed model: ${modelName}.`);
      return res.status(403).json({
        error: {
          message: `Anonymous users cannot use the '${modelName}' model. Please log in.`,
          code: 'MODEL_NOT_ALLOWED_FOR_ANON',
        },
      });
    }

    // Validate Limits
    if (anonRecord.hourlyApiCalls >= tier.hourlyLimit || anonRecord.dailyApiCalls >= tier.dailyLimit) {
      logger.warn(`API limit exceeded for anonymous IP ${ip}. Hourly: ${anonRecord.hourlyApiCalls}/${tier.hourlyLimit}, Daily: ${anonRecord.dailyApiCalls}/${tier.dailyLimit}`);
      return res.status(429).json({
        error: { message: 'You have exceeded your API call limit for this period.', code: 'API_LIMIT_EXCEEDED' },
      });
    }

    req.incrementUsage = async () => {
      const recordToUpdate = anonymousUsage.get(ip);
      recordToUpdate.hourlyApiCalls++;
      recordToUpdate.dailyApiCalls++;
      anonymousUsage.set(ip, recordToUpdate);
      return {
          hourly: { count: recordToUpdate.hourlyApiCalls, limit: tier.hourlyLimit },
          daily: { count: recordToUpdate.dailyApiCalls, limit: tier.dailyLimit },
      };
    };
  }

  next();
};
