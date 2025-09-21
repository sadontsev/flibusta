import express from 'express';
import SessionService from '../services/SessionService';
import { requireUser } from '../middleware/sessionMiddleware';
import logger from '../utils/logger';
import { ExtendedRequest, RegisteredUser } from '../types';

const router = express.Router();

/**
 * Get current user session info
 */
router.get('/me', (req: ExtendedRequest, res: express.Response): void => {
  try {
    if (!req.user) {
      res.json({
        user: null,
        authenticated: false
      });
      return;
    }

    res.json({
      user: {
        user_uuid: req.user.user_uuid,
        name: req.user.type === 'registered' ? (req.user as RegisteredUser).username : req.user.name,
        username: req.user.type === 'registered' ? (req.user as RegisteredUser).username : undefined,
        email: req.user.type === 'registered' ? (req.user as RegisteredUser).email : undefined,
        type: req.user.type,
        role: req.user.type === 'registered' ? (req.user as RegisteredUser).role : undefined,
        display_name: req.user.type === 'registered' ? (req.user as RegisteredUser).display_name : undefined
      },
      authenticated: req.user.type === 'registered'
    });
  } catch (error) {
    logger.error('Error getting user session:', error);
    res.status(500).json({ error: 'Failed to get session info' });
  }
});

/**
 * Update anonymous user name
 */
router.put('/name', requireUser, async (req: ExtendedRequest, res: express.Response): Promise<void> => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim().length === 0) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    if (req.user?.type === 'anonymous') {
      await SessionService.updateAnonymousUserName(req.user.user_uuid, name.trim());
      req.session.anonymous_name = name.trim();
      
      res.json({ 
        success: true, 
        name: name.trim(),
        message: 'Name updated successfully'
      });
    } else {
      res.status(400).json({ error: 'Cannot update name for registered users' });
    }
  } catch (error) {
    logger.error('Error updating user name:', error);
    res.status(500).json({ error: 'Failed to update name' });
  }
});

/**
 * Get user favorites
 */
router.get('/favorites', requireUser, async (req: ExtendedRequest, res: express.Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 0;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const result = await SessionService.getUserFavorites(req.user!.user_uuid, page, limit);
    res.json(result);
  } catch (error) {
    logger.error('Error getting user favorites:', error);
    res.status(500).json({ error: 'Failed to get favorites' });
  }
});

/**
 * Get user reading progress
 */
router.get('/progress', requireUser, async (req: ExtendedRequest, res: express.Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 0;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const result = await SessionService.getUserProgress(req.user!.user_uuid, page, limit);
    res.json(result);
  } catch (error) {
    logger.error('Error getting user progress:', error);
    res.status(500).json({ error: 'Failed to get reading progress' });
  }
});

/**
 * Get user statistics
 */
router.get('/stats', requireUser, async (req: ExtendedRequest, res: express.Response): Promise<void> => {
  try {
    const stats = await SessionService.getUserStats(req.user!.user_uuid);
    res.json(stats);
  } catch (error) {
    logger.error('Error getting user stats:', error);
    res.status(500).json({ error: 'Failed to get user statistics' });
  }
});

/**
 * Create new anonymous session (for testing)
 */
router.post('/anonymous', async (req: ExtendedRequest, res: express.Response): Promise<void> => {
  try {
    const { name } = req.body;
    const anonymousUser = await SessionService.createAnonymousUser(name);
    
    req.session.anonymous_uuid = anonymousUser.user_uuid;
    req.session.anonymous_name = anonymousUser.name;
    req.user = anonymousUser;
    
    res.json({
      success: true,
      user: anonymousUser,
      message: 'Anonymous session created'
    });
  } catch (error) {
    logger.error('Error creating anonymous session:', error);
    res.status(500).json({ error: 'Failed to create anonymous session' });
  }
});

/**
 * Add book to favorites
 */
router.post('/favorites/:bookId', requireUser, async (req: ExtendedRequest, res: express.Response): Promise<void> => {
  try {
    const bookId = parseInt(req.params.bookId || '0');
    
    if (!bookId || bookId <= 0) {
      res.status(400).json({ error: 'Invalid book ID' });
      return;
    }

    await SessionService.addToFavorites(req.user!.user_uuid, bookId);
    res.json({ success: true, message: 'Book added to favorites' });
  } catch (error) {
    logger.error('Error adding to favorites:', error);
    res.status(500).json({ error: 'Failed to add to favorites' });
  }
});

/**
 * Remove book from favorites
 */
router.delete('/favorites/:bookId', requireUser, async (req: ExtendedRequest, res: express.Response): Promise<void> => {
  try {
    const bookId = parseInt(req.params.bookId || '0');
    
    if (!bookId || bookId <= 0) {
      res.status(400).json({ error: 'Invalid book ID' });
      return;
    }

    const result = await SessionService.removeFromFavorites(req.user!.user_uuid, bookId);
    res.json({ 
      success: true, 
      removed: result.removed,
      message: result.removed ? 'Book removed from favorites' : 'Book was not in favorites'
    });
  } catch (error) {
    logger.error('Error removing from favorites:', error);
    res.status(500).json({ error: 'Failed to remove from favorites' });
  }
});

/**
 * Check if book is favorited
 */
router.get('/favorites/:bookId/status', requireUser, async (req: ExtendedRequest, res: express.Response): Promise<void> => {
  try {
    const bookId = parseInt(req.params.bookId || '0');
    
    if (!bookId || bookId <= 0) {
      res.status(400).json({ error: 'Invalid book ID' });
      return;
    }

    const isFavorited = await SessionService.isBookFavorited(req.user!.user_uuid, bookId);
    res.json({ favorited: isFavorited });
  } catch (error) {
    logger.error('Error checking favorite status:', error);
    res.status(500).json({ error: 'Failed to check favorite status' });
  }
});

/**
 * Get user reading progress
 */
router.get('/progress', requireUser, async (req: ExtendedRequest, res: express.Response) => {
  try {
    const page = parseInt(req.query.page as string) || 0;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

    const result = await SessionService.getUserProgress(req.user!.user_uuid, page, limit);
    res.json(result);
  } catch (error) {
    logger.error('Error getting user progress:', error);
    res.status(500).json({ error: 'Failed to get reading progress' });
  }
});

/**
 * Save reading progress for a book
 */
router.post('/progress/:bookId', requireUser, async (req: ExtendedRequest, res: express.Response): Promise<void> => {
  try {
    const bookId = parseInt(req.params.bookId || '0');
    const { position } = req.body;
    
    if (!bookId || bookId <= 0) {
      res.status(400).json({ error: 'Invalid book ID' });
      return;
    }

    if (position === undefined || position === null) {
      res.status(400).json({ error: 'Position is required' });
      return;
    }

    const pos = parseFloat(position);
    if (isNaN(pos) || pos < 0 || pos > 100) {
      res.status(400).json({ error: 'Position must be between 0 and 100' });
      return;
    }

    await SessionService.saveProgress(req.user!.user_uuid, bookId, pos);
    res.json({ success: true, message: 'Progress saved successfully' });
  } catch (error) {
    logger.error('Error saving progress:', error);
    res.status(500).json({ error: 'Failed to save progress' });
  }
});

/**
 * Get reading progress for a specific book
 */
router.get('/progress/:bookId', requireUser, async (req: ExtendedRequest, res: express.Response): Promise<void> => {
  try {
    const bookId = parseInt(req.params.bookId || '0');
    
    if (!bookId || bookId <= 0) {
      res.status(400).json({ error: 'Invalid book ID' });
      return;
    }

    const progress = await SessionService.getProgress(req.user!.user_uuid, bookId);
    res.json({ progress });
  } catch (error) {
    logger.error('Error getting book progress:', error);
    res.status(500).json({ error: 'Failed to get progress' });
  }
});

/**
 * Get user statistics
 */
router.get('/stats', requireUser, async (req: ExtendedRequest, res: express.Response) => {
  try {
    const stats = await SessionService.getUserStats(req.user!.user_uuid);
    res.json(stats);
  } catch (error) {
    logger.error('Error getting user stats:', error);
    res.status(500).json({ error: 'Failed to get user statistics' });
  }
});

/**
 * Create new anonymous session (for testing)
 */
router.post('/anonymous', async (req: ExtendedRequest, res: express.Response) => {
  try {
    const { name } = req.body;
    const anonymousUser = await SessionService.createAnonymousUser(name);
    
    req.session.anonymous_uuid = anonymousUser.user_uuid;
    req.session.anonymous_name = anonymousUser.name;
    req.user = anonymousUser;
    
    res.json({
      success: true,
      user: anonymousUser,
      message: 'Anonymous session created'
    });
  } catch (error) {
    logger.error('Error creating anonymous session:', error);
    res.status(500).json({ error: 'Failed to create anonymous session' });
  }
});

export default router;