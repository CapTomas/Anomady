import jwt from 'jsonwebtoken';
import prisma from '../db.js';
import logger from '../utils/logger.js';

/**
 * Middleware to protect routes by verifying a JWT.
 * It checks for a Bearer token in the Authorization header,
 * verifies it, and fetches the user from the database,
 * attaching the user object (excluding sensitive fields) to `req.user`.
 *
 * @async
 * @function protect
 * @param {import('express').Request} req - The Express request object.
 * @param {import('express').Response} res - The Express response object.
 * @param {import('express').NextFunction} next - The Express next middleware function.
 * @returns {Promise<void>} Resolves or calls `next()` if authorized, otherwise sends an error response.
 */
const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        logger.error('JWT_SECRET is not defined. Cannot verify token.');
        return res.status(500).json({
          error: { message: 'Server authentication configuration error.', code: 'AUTH_CONFIG_ERROR' },
        });
      }
      const decoded = jwt.verify(token, jwtSecret);
      const user = await prisma.user.findUnique({
        where: { id: decoded.user.id },
        select: {
          id: true,
          email: true,
          username: true,
          story_preference: true,
          newsletter_opt_in: true,
          preferred_app_language: true,
          preferred_narrative_language: true,
          preferred_model_name: true,
          email_confirmed: true,
          created_at: true,
          updated_at: true,
        },
      });
      if (!user) {
        logger.warn(`Authenticated user ID ${decoded.user.id} not found in DB.`);
        return res.status(401).json({ error: { message: 'Not authorized, user not found.', code: 'USER_NOT_FOUND' } });
      }
      req.user = user;
      logger.debug(`User authenticated: ${req.user.email} (ID: ${req.user.id}) for path: ${req.path}`);
      next();
    } catch (error) {
      logger.error('Token verification failed:', { message: error.message, tokenUsed: token ? 'yes' : 'no' });
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: { message: 'Not authorized, token failed verification.', code: 'TOKEN_INVALID' } });
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: { message: 'Not authorized, token expired.', code: 'TOKEN_EXPIRED' } });
      }
      return res.status(401).json({ error: { message: 'Not authorized, token error.', code: 'TOKEN_PROCESSING_ERROR' } });
    }
  }
  if (!token) {
    logger.info(`No token found in request to ${req.path}`);
    return res.status(401).json({ error: { message: 'Not authorized, no token provided.', code: 'NO_TOKEN' } });
  }
};

export { protect };
