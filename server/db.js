// server/db.js
import { PrismaClient } from '@prisma/client';
import logger from './utils/logger.js'; // Assuming your logger is in utils

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
  logger.info('Prisma Client initialized for production.');
} else {
  // In development, use a global variable to preserve the PrismaClient instance
  // across HMR (Hot Module Replacement) reloads.
  // This prevents too many connections to the database.
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'], // More detailed logging for dev
    });
    logger.info('New Prisma Client initialized for development.');
  }
  prisma = global.__prisma;
  logger.info('Using existing Prisma Client instance for development.');
}

export default prisma;
