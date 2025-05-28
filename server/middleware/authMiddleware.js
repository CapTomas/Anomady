// server/middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';
import prisma from '../db.js'; // We'll need this to potentially fetch fresh user data

const protect = async (req, res, next) => {
  let token;

  // 1. Check for token in Authorization header (Bearer token)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header (e.g., "Bearer <token>" -> "<token>")
      token = req.headers.authorization.split(' ')[1];

      // 2. Verify the token
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        logger.error('JWT_SECRET is not defined. Cannot verify token.');
        // Do not expose "JWT_SECRET not defined" to client in production
        return res.status(500).json({ error: { message: 'Server authentication configuration error.', code: 'AUTH_CONFIG_ERROR' }});
      }

      const decoded = jwt.verify(token, jwtSecret);

      // 3. Attach user to request object
      // We'll fetch the user from DB to ensure it's fresh and not deleted/disabled since token issuance.
      // We select only non-sensitive fields.
      const user = await prisma.user.findUnique({
        where: { id: decoded.user.id },
        select: {
            id: true,
            email: true,
            preferred_app_language: true,
            preferred_narrative_language: true,
            preferred_model_name: true,
            created_at: true,
            email_confirmed: true,
            updated_at: true
        }
      });

      if (!user) {
        logger.warn(`Authenticated user ID ${decoded.user.id} not found in DB.`);
        return res.status(401).json({ error: { message: 'Not authorized, user not found.', code: 'USER_NOT_FOUND' }});
      }

      req.user = user; // Attach the fetched, sanitized user object
      logger.debug(`User authenticated: ${req.user.email} (ID: ${req.user.id}) for path: ${req.path}`);
      next(); // Proceed to the next middleware or route handler

    } catch (error) {
      logger.error('Token verification failed:', { message: error.message, tokenUsed: token ? 'yes' : 'no' });
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: { message: 'Not authorized, token failed verification.', code: 'TOKEN_INVALID' }});
      }
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: { message: 'Not authorized, token expired.', code: 'TOKEN_EXPIRED' }});
      }
      // For other errors during token processing
      return res.status(401).json({ error: { message: 'Not authorized, token error.', code: 'TOKEN_PROCESSING_ERROR' }});
    }
  }

  if (!token) {
    logger.info(`No token found in request to ${req.path}`);
    return res.status(401).json({ error: { message: 'Not authorized, no token provided.', code: 'NO_TOKEN' }});
  }
};

export { protect };
