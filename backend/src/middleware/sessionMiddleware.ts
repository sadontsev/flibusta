import SessionService from '../services/SessionService';
import logger from '../utils/logger';
import { Response, NextFunction } from 'express';
import { ExtendedRequest, RegisteredUser } from '../types';

/**
 * Initialize session for all requests
 */
const initializeSession = async (req: ExtendedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Initialize session if not already done
    if (!req.session.initialized) {
      const user = await SessionService.initializeSession(req);
      req.session.initialized = true;
      req.user = user;
      
      logger.debug('Session initialized for user:', {
        user_uuid: user.user_uuid,
        name: user.type === 'registered' ? (user as RegisteredUser).username : user.name,
        type: user.type
      });
    } else {
      // Get existing session user
      const sessionUser = await SessionService.getSessionUser(req);
      if (sessionUser) {
        req.user = sessionUser;
      } else {
        // Fallback to anonymous user if session user not found
        req.user = {
          user_uuid: '',
          name: 'Guest',
          type: 'anonymous'
        };
      }
    }

    next();
  } catch (error) {
    logger.error('Error in session middleware:', error);
    // Continue with anonymous session
    req.user = {
      user_uuid: '',
      name: 'Guest',
      type: 'anonymous'
    };
    next();
  }
};

/**
 * Require authenticated user (registered or anonymous)
 */
const requireUser = (req: ExtendedRequest, res: Response, next: NextFunction): void => {
  if (!req.user || !req.user.user_uuid) {
    res.status(401).json({
      error: 'Session required',
      code: 'SESSION_REQUIRED'
    });
    return;
  }
  next();
};

/**
 * Require registered user only
 */
const requireRegisteredUser = (req: ExtendedRequest, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.type !== 'registered') {
    res.status(401).json({
      error: 'Registered user required',
      code: 'REGISTRATION_REQUIRED'
    });
    return;
  }
  next();
};

/**
 * Add user info to response locals for templates
 */
const addUserToLocals = (req: ExtendedRequest, res: Response, next: NextFunction): void => {
  res.locals.user = req.user;
  res.locals.isAuthenticated = req.user && req.user.type === 'registered';
  res.locals.isAnonymous = req.user && req.user.type === 'anonymous';
  next();
};

export {
  initializeSession,
  requireUser,
  requireRegisteredUser,
  addUserToLocals
};