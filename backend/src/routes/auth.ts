import express, { Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getRow, query, getRows } from '../database/connection';
import logger from '../utils/logger';
import { requireAuth, requireSuperAdmin, requireAdmin, logActivity } from '../middleware/auth';
import { 
  createTypeSafeHandler
} from '../middleware/validation';
import { 
  buildErrorResponse, 
  buildSuccessResponse 
} from '../types/api';
import { ExtendedRequest, AuthenticatedRequest } from '../types';

const router = express.Router();

// Validation middleware
const validate = (req: ExtendedRequest, res: Response, next: NextFunction): Response | void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(buildErrorResponse('Validation failed'));
  }
  next();
};

// Login user
router.post('/login', [
  body('username').isString().trim().isLength({ min: 1, max: 50 }).withMessage('Username must be between 1 and 50 characters'),
  body('password').isString().isLength({ min: 1 }).withMessage('Password is required')
], validate, async (req: ExtendedRequest, res: Response, next: NextFunction) => {
  try {
    const { username, password } = req.body;
    
    // Find user
    const user = await getRow(`
      SELECT user_uuid, username, email, password_hash, role, is_active, display_name, avatar_url
      FROM users WHERE username = $1
    `, [username]);

    if (!user || !user.is_active) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
      return;
    }

    // Update last login
    await query(`
      UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_uuid = $1
    `, [user.user_uuid]);

    // Store user in session
    req.session.user_uuid = user.user_uuid;

    // Remove password from response
    delete user.password_hash;

    logger.info('User logged in successfully', { username: user.username, role: user.role });

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

// Register new user (only superadmin can create new users)
router.post('/register', [
  body('username').isString().trim().isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters'),
  body('password').isString().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('email').optional().isEmail().withMessage('Invalid email format'),
  body('display_name').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('Display name must be between 1 and 100 characters'),
  body('role').optional().isIn(['user', 'admin']).withMessage('Invalid role')
], validate, requireSuperAdmin, async (req: ExtendedRequest, res: Response, next: NextFunction) => {
  try {
    const { username, password, email, display_name, role = 'user' } = req.body;
    
    // Check if user already exists
    const existingUser = await getRow(`
      SELECT user_uuid FROM users WHERE username = $1 OR email = $2
    `, [username, email]);

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this username or email already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create new user
    const userUuid = uuidv4();
    await query(`
      INSERT INTO users (user_uuid, username, email, password_hash, role, display_name)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [userUuid, username, email, passwordHash, role, display_name || username]);

    // Get created user
    const newUser = await getRow(`
      SELECT user_uuid, username, email, role, is_active, display_name, avatar_url, created_at
      FROM users WHERE user_uuid = $1
    `, [userUuid]);

    logger.info('New user created', { 
      username, 
      role, 
      createdBy: (req as AuthenticatedRequest).user.username 
    });

    res.status(201).json({
      success: true,
      data: newUser
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// Get current user
router.get('/me', requireAuth, async (req: ExtendedRequest, res: Response, next: NextFunction) => {
  try {
    res.json({
      success: true,
      data: (req as AuthenticatedRequest).user
    });
    return;
  } catch (error) {
    next(error);
    return;
    next(error);
  }
});

// Logout user
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({
        success: false,
        error: 'Error logging out'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
});

// Change password
router.post('/change-password', [
  body('current_password').isString().isLength({ min: 1 }).withMessage('Current password is required'),
  body('new_password').isString().isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], validate, requireAuth, async (req: ExtendedRequest, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { current_password, new_password } = req.body;
    
    // Get current user with password
    const user = await getRow(`
      SELECT password_hash FROM users WHERE user_uuid = $1
    `, [authReq.user.user_uuid]);

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(current_password, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const newPasswordHash = await bcrypt.hash(new_password, saltRounds);

    // Update password
    await query(`
      UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE user_uuid = $2
    `, [newPasswordHash, authReq.user.user_uuid]);

    logger.info('Password changed successfully', { username: authReq.user.username });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// Update user profile
router.put('/profile', [
  body('email').optional().isEmail().withMessage('Invalid email format'),
  body('display_name').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('Display name must be between 1 and 100 characters')
], validate, requireAuth, async (req: ExtendedRequest, res: Response, next: NextFunction) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { email, display_name } = req.body;
    
    // Check if email is already taken by another user
    if (email && email !== authReq.user.email) {
      const existingUser = await getRow(`
        SELECT user_uuid FROM users WHERE email = $1 AND user_uuid != $2
      `, [email, authReq.user.user_uuid]);

      if (existingUser) {
        return res.status(400).json({
          success: false,
          error: 'Email is already taken'
        });
      }
    }

    // Update user
    await query(`
      UPDATE users SET email = $1, display_name = $2, updated_at = CURRENT_TIMESTAMP WHERE user_uuid = $3
    `, [email || authReq.user.email, display_name || authReq.user.display_name, authReq.user.user_uuid]);

    // Get updated user
    const updatedUser = await getRow(`
      SELECT user_uuid, username, email, role, is_active, display_name, avatar_url
      FROM users WHERE user_uuid = $1
    `, [authReq.user.user_uuid]);

    logger.info('Profile updated', { username: authReq.user.username });

    res.json({
      success: true,
      data: updatedUser
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// Get all users (admin only)
router.get('/users', requireAuth, requireAdmin, async (req: ExtendedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(String(req.query.page || '0'));
    const limit = parseInt(String(req.query.limit || '20'));
    const search = String(req.query.search || '');
    const offset = page * limit;
    
    let whereClause = '';
    let params = [];
    
    if (search) {
      whereClause = 'WHERE username ILIKE $1 OR display_name ILIKE $1 OR email ILIKE $1';
      params.push(`%${search}%`);
    }
    
    // Get users with pagination
    const users = await getRows(`
      SELECT user_uuid, username, email, role, is_active, display_name, avatar_url, created_at, last_login
      FROM users ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);
    
    // Get total count
    const countResult = await getRow(`
      SELECT COUNT(*) as total FROM users ${whereClause}
    `, params);
    
    const total = parseInt(countResult.total);
    
    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update user (admin only)
router.put('/users/:userId', [
  body('email').optional().isEmail().withMessage('Invalid email format'),
  body('display_name').optional().isString().trim().isLength({ min: 1, max: 100 }).withMessage('Display name must be between 1 and 100 characters'),
  body('role').optional().isIn(['user', 'admin']).withMessage('Invalid role'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean')
], validate, requireAuth, requireAdmin, async (req: ExtendedRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { email, display_name, role, is_active } = req.body;
    
    // Check if user exists
    const existingUser = await getRow(`
      SELECT user_uuid, role FROM users WHERE user_uuid = $1
    `, [userId]);

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Prevent changing superadmin role
    if (existingUser.role === 'superadmin' && role && role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot change superadmin role'
      });
    }

    // Check if email is already taken
    if (email) {
      const emailUser = await getRow(`
        SELECT user_uuid FROM users WHERE email = $1 AND user_uuid != $2
      `, [email, userId]);

      if (emailUser) {
        return res.status(400).json({
          success: false,
          error: 'Email is already taken'
        });
      }
    }

    // Build update query
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      params.push(email);
    }
    if (display_name !== undefined) {
      updates.push(`display_name = $${paramIndex++}`);
      params.push(display_name);
    }
    if (role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      params.push(role);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(userId);

    await query(`
      UPDATE users SET ${updates.join(', ')} WHERE user_uuid = $${paramIndex}
    `, params);

    // Get updated user
    const updatedUser = await getRow(`
      SELECT user_uuid, username, email, role, is_active, display_name, avatar_url, created_at, last_login
      FROM users WHERE user_uuid = $1
    `, [userId]);

    logger.info('User updated', { 
      updatedBy: (req as AuthenticatedRequest).user.username, 
      updatedUser: updatedUser.username,
      changes: { email, display_name, role, is_active }
    });

    res.json({
      success: true,
      data: updatedUser
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// Delete user (admin only)
router.delete('/users/:userId', requireAuth, requireAdmin, async (req: ExtendedRequest, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists
    const existingUser = await getRow(`
      SELECT user_uuid, username, role FROM users WHERE user_uuid = $1
    `, [userId]);

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Prevent deleting superadmin
    if (existingUser.role === 'superadmin') {
      return res.status(403).json({
        success: false,
        error: 'Cannot delete superadmin'
      });
    }

    // Delete user's favorites
    await query(`
      DELETE FROM fav WHERE user_uuid = $1
    `, [userId]);

    // Delete user's reading progress
    await query(`
      DELETE FROM progress WHERE user_uuid = $1
    `, [userId]);

    // Delete user's activity log
    await query(`
      DELETE FROM user_activity_log WHERE user_uuid = $1
    `, [userId]);

    // Delete user account
    await query(`
      DELETE FROM users WHERE user_uuid = $1
    `, [userId]);

    logger.info('User deleted', { 
      deletedBy: (req as AuthenticatedRequest).user.username, 
      deletedUser: existingUser.username 
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

// Get user activity log (admin only)
router.get('/activity', requireAuth, requireAdmin, async (req: ExtendedRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(String(req.query.page || '0'));
    const limit = parseInt(String(req.query.limit || '50'));
    const user_uuid = String(req.query.user_uuid || '');
    const offset = page * limit;
    
    let whereClause = '';
    let params = [];
    
    if (user_uuid) {
      whereClause = 'WHERE ual.user_uuid = $1';
      params.push(user_uuid);
    }
    
    const activity = await getRows(`
      SELECT 
        ual.id,
        ual.user_uuid,
        u.username,
        u.display_name,
        ual.action,
        ual.details,
        ual.ip_address,
        ual.user_agent,
        ual.created_at
      FROM user_activity_log ual
      LEFT JOIN users u ON ual.user_uuid = u.user_uuid
      ${whereClause}
      ORDER BY ual.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `, [...params, limit, offset]);
    
    const countResult = await getRow(`
      SELECT COUNT(*) as total FROM user_activity_log ual ${whereClause}
    `, params);
    
    const total = parseInt(countResult.total);
    
    res.json({
      success: true,
      data: {
        activity,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
    return;
  } catch (error) {
    next(error);
    return;
  }
});

export default router;
