import { Response, NextFunction } from 'express';
import { getRow, query } from '../database/connection';
import logger from '../utils/logger';
import { ExtendedRequest, User, RegisteredUser } from '../types';

// Interface for user activity logging
interface ActivityData {
  user_uuid: string;
  action: string;
  details: {
    method: string;
    path: string;
    statusCode: number;
    userAgent?: string | undefined;
    ipAddress?: string | undefined;
  };
  ip_address?: string | undefined;
  user_agent?: string | undefined;
}

// Middleware to require authentication
const requireAuth = async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<Response | void> => {
  try {
    if (!req.session.user_uuid) {
      // Check if this is an API request
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      } else {
        // For web requests, redirect to login page
        const redirectUrl = `/login?redirect=${encodeURIComponent(req.originalUrl)}`;
        return res.redirect(redirectUrl);
      }
    }

    // Get user from database
    const user = await getRow(`
      SELECT user_uuid, username, email, role, is_active, display_name, avatar_url
      FROM users WHERE user_uuid = $1
    `, [req.session.user_uuid]) as User | null;

    if (!user || !user.is_active) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          error: 'User not found or inactive'
        });
      } else {
        const redirectUrl = `/login?redirect=${encodeURIComponent(req.originalUrl)}`;
        return res.redirect(redirectUrl);
      }
    }

    req.user = { ...user, type: 'registered' } as RegisteredUser;
    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    if (req.path.startsWith('/api/')) {
      return res.status(500).json({
        success: false,
        error: 'Authentication error'
      });
    } else {
      const redirectUrl = `/login?redirect=${encodeURIComponent(req.originalUrl)}`;
      return res.redirect(redirectUrl);
    }
  }
};

// Middleware for optional authentication (for backward compatibility)
const optionalAuth = async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.session.user_uuid) {
      const user = await getRow(`
        SELECT user_uuid, username, email, role, is_active, display_name, avatar_url
        FROM users WHERE user_uuid = $1
      `, [req.session.user_uuid]) as User | null;

      if (user && user.is_active) {
        req.user = { ...user, type: 'registered' } as RegisteredUser;
      }
    }
    next();
  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    next();
  }
};

// Middleware to require specific role
const requireRole = (roles: string | string[]) => {
  return (req: ExtendedRequest, res: Response, next: NextFunction): Response | void => {
    if (!req.user || req.user.type !== 'registered') {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      } else {
        const redirectUrl = `/login?redirect=${encodeURIComponent(req.originalUrl)}`;
        return res.redirect(redirectUrl);
      }
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      } else {
        // Redirect to home page with error message
        return res.redirect('/?error=insufficient_permissions');
      }
    }

    next();
  };
};

// Middleware to require superadmin role
const requireSuperAdmin = requireRole('superadmin');

// Middleware to require admin or superadmin role
const requireAdmin = requireRole(['admin', 'superadmin']);

// Log user activity
const logActivity = (action: string) => {
  return async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
    // Store original send method
    const originalSend = res.send;
    
    // Override send method to log activity
    res.send = function(data: any) {
      // Call original send first
      const result = originalSend.call(this, data);
      
      // Log activity asynchronously after response is sent
      if (req.user && req.user.type === 'registered') {
        setImmediate(() => {
          const activityData: ActivityData = {
            user_uuid: req.user!.user_uuid,
            action: action,
            details: {
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
              userAgent: req.get('User-Agent') || undefined,
              ipAddress: req.ip || req.connection?.remoteAddress || undefined
            },
            ip_address: req.ip || req.connection?.remoteAddress || undefined,
            user_agent: req.get('User-Agent') || undefined
          };

          logUserActivity(activityData).catch(err => {
            logger.error('Error logging user activity:', err);
          });
        });
      }
      
      return result;
    };
    
    next();
  };
};

async function logUserActivity(activityData: ActivityData): Promise<void> {
  try {
    await query(`
      INSERT INTO user_activity_log (user_uuid, action, details, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      activityData.user_uuid,
      activityData.action,
      JSON.stringify(activityData.details),
      activityData.ip_address,
      activityData.user_agent
    ]);
  } catch (error) {
    logger.error('Error logging user activity:', error);
  }
}

export {
  requireAuth,
  optionalAuth,
  requireRole,
  requireSuperAdmin,
  requireAdmin,
  logActivity
};
