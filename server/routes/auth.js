// server/routes/auth.js
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../db.js';
import logger from '../utils/logger.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();
const SALT_ROUNDS = 10; // For bcrypt password hashing


/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', async (req, res) => {
  const { email, password, preferred_app_language, preferred_narrative_language, preferred_model_name } = req.body;

  // 1. Basic Input Validation
  if (!email || !password) {
    logger.warn('Registration attempt with missing email or password.');
    return res.status(400).json({
      error: {
        message: 'Email and password are required.',
        code: 'MISSING_CREDENTIALS'
      }
    });
  }

  // Validate email format (simple regex, consider a more robust library for production)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    logger.warn(`Registration attempt with invalid email format: ${email}`);
    return res.status(400).json({
      error: {
        message: 'Invalid email format.',
        code: 'INVALID_EMAIL_FORMAT'
      }
    });
  }

  // Validate password strength (example: min 8 characters)
  if (password.length < 8) {
    logger.warn(`Registration attempt with weak password for email: ${email}`);
    return res.status(400).json({
      error: {
        message: 'Password must be at least 8 characters long.',
        code: 'WEAK_PASSWORD'
      }
    });
  }

  try {
    // 2. Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }, // Store and check emails in lowercase
    });

    if (existingUser) {
      logger.info(`Registration attempt for existing email: ${email}`);
      return res.status(409).json({ // 409 Conflict
        error: {
          message: 'User with this email already exists.',
          code: 'USER_ALREADY_EXISTS'
        }
      });
    }

    // 3. Hash the password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    logger.debug(`Password hashed for email: ${email}`);

    // 4. Create the new user in the database
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(), // Store email in lowercase
        password_hash: hashedPassword,
        preferred_app_language: preferred_app_language || 'en', // Default if not provided
        preferred_narrative_language: preferred_narrative_language || 'en', // Default if not provided
        preferred_model_name: preferred_model_name || 'gemini-1.5-flash-latest', // Default if not provided
      },
    });

    logger.info(`User registered successfully: ${newUser.email} (ID: ${newUser.id})`);

    // 5. Respond (excluding sensitive data)
    // For registration, we usually don't immediately log them in or send a JWT.
    // We just confirm registration. Login will be a separate step.
    res.status(201).json({
      message: 'User registered successfully. Please log in.',
      user: {
        id: newUser.id,
        email: newUser.email,
        preferred_app_language: newUser.preferred_app_language,
        preferred_narrative_language: newUser.preferred_narrative_language,
        preferred_model_name: newUser.preferred_model_name,
        created_at: newUser.created_at,
      },
    });

  } catch (error) {
    logger.error('Error during user registration:', {
      message: error.message,
      stack: error.stack,
      email: email // Log which email caused the error
    });
    res.status(500).json({
      error: {
        message: 'Server error during registration. Please try again later.',
        code: 'INTERNAL_SERVER_ERROR'
      }
    });
  }
});

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user & get token
 * @access  Public
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // 1. Basic Input Validation
  if (!email || !password) {
    logger.warn('Login attempt with missing email or password.');
    return res.status(400).json({
      error: {
        message: 'Email and password are required.',
        code: 'MISSING_CREDENTIALS'
      }
    });
  }

  try {
    // 2. Find the user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      logger.info(`Login attempt for non-existent email: ${email}`);
      return res.status(401).json({ // 401 Unauthorized
        error: {
          message: 'Invalid credentials.', // Keep messages generic for security
          code: 'INVALID_CREDENTIALS'
        }
      });
    }

    // 3. Compare the provided password with the stored hash
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      logger.info(`Login attempt with incorrect password for email: ${email}`);
      return res.status(401).json({ // 401 Unauthorized
        error: {
          message: 'Invalid credentials.',
          code: 'INVALID_CREDENTIALS'
        }
      });
    }

    // 4. User matched, create JWT payload
    const payload = {
      user: {
        id: user.id,
        email: user.email,
        // You can add other non-sensitive info here if needed for the token,
        // but keep it minimal. User preferences will be fetched separately.
      },
    };

    // 5. Sign the token
    const jwtSecret = process.env.JWT_SECRET;
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1d';

    if (!jwtSecret) {
        logger.error('JWT_SECRET is not defined in environment variables.');
        return res.status(500).json({
            error: {
                message: 'Server configuration error for authentication.',
                code: 'JWT_CONFIG_ERROR'
            }
        });
    }

    jwt.sign(
      payload,
      jwtSecret,
      { expiresIn: jwtExpiresIn },
      (err, token) => {
        if (err) {
            logger.error('Error signing JWT:', err);
            return res.status(500).json({
                error: {
                    message: 'Server error during login. Could not generate token.',
                    code: 'TOKEN_SIGN_ERROR'
                }
            });
        }

        logger.info(`User logged in successfully: ${user.email} (ID: ${user.id})`);
        res.status(200).json({
          message: 'Login successful.',
          token,
          user: { // Return some user info for the frontend to use immediately
            id: user.id,
            email: user.email,
            preferred_app_language: user.preferred_app_language,
            preferred_narrative_language: user.preferred_narrative_language,
            preferred_model_name: user.preferred_model_name,
          }
        });
      }
    );

  } catch (error) {
    logger.error('Error during user login:', {
        message: error.message,
        stack: error.stack,
        email: email
    });
    res.status(500).json({
        error: {
            message: 'Server error during login. Please try again later.',
            code: 'INTERNAL_SERVER_ERROR'
        }
    });
  }
});


/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current logged-in user's data
 * @access  Private (requires token)
 */
router.get('/me', protect, async (req, res) => {
  if (!req.user) {
    logger.error('/me route accessed without req.user, though protect middleware should have caught it.');
    return res.status(401).json({ error: { message: 'Not authorized.', code: 'UNEXPECTED_AUTH_FAILURE' }});
  }

  logger.info(`User data requested for /me by: ${req.user.email} (ID: ${req.user.id})`);
  res.status(200).json({
    message: "Current user data fetched successfully.",
    user: req.user // req.user is already sanitized by the 'protect' middleware
  });
});

// Export the router
export default router;
