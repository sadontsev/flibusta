import { getRow, query, getRows } from '../database/connection';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { 
  ExtendedRequest, 
  SessionUser, 
  AnonymousUser, 
  FavoritesResponse,
  ProgressResponse 
} from '../types';

class SessionService {
  
  /**
   * Initialize session for new user
   */
  async initializeSession(req: ExtendedRequest): Promise<SessionUser> {
    try {
      // If user is already authenticated, return their info
      if (req.session.user_uuid) {
        const user = await this.getSessionUser(req);
        if (user) return user;
      }

      // Create anonymous session if none exists
      if (!req.session.anonymous_uuid) {
        const anonymousUser = await this.createAnonymousUser();
        req.session.anonymous_uuid = anonymousUser.user_uuid;
        req.session.anonymous_name = anonymousUser.name;
        return anonymousUser;
      }

      // Return existing anonymous user
      return {
        user_uuid: req.session.anonymous_uuid,
        name: req.session.anonymous_name || 'Guest',
        type: 'anonymous'
      };
    } catch (error) {
      logger.error('Error initializing session:', error);
      throw error;
    }
  }

  /**
   * Create anonymous user
   */
  async createAnonymousUser(name?: string | null): Promise<AnonymousUser> {
    try {
      if (!name) {
        const timestamp = Date.now();
        name = `Guest_${timestamp}`;
      }

      const userUuid = uuidv4();
      
      // Create entry in fav_users for favorites functionality
      await query(`
        INSERT INTO fav_users (user_uuid, name) VALUES ($1, $2)
      `, [userUuid, name]);

      return {
        user_uuid: userUuid,
        name: name,
        type: 'anonymous'
      };
    } catch (error) {
      logger.error('Error creating anonymous user:', error);
      throw error;
    }
  }

  /**
   * Get current session user
   */
  async getSessionUser(req: ExtendedRequest): Promise<SessionUser | null> {
    try {
      // Check for authenticated user first
      if (req.session.user_uuid) {
        const user = await getRow(`
          SELECT user_uuid, username, email, role, is_active, display_name, avatar_url
          FROM users WHERE user_uuid = $1 AND is_active = true
        `, [req.session.user_uuid]);

        if (user) {
          return {
            ...user,
            type: 'registered'
          };
        }
      }

      // Fall back to anonymous user
      if (req.session.anonymous_uuid) {
        return {
          user_uuid: req.session.anonymous_uuid,
          name: req.session.anonymous_name || 'Guest',
          type: 'anonymous'
        };
      }

      return null;
    } catch (error) {
      logger.error('Error getting session user:', error);
      return null;
    }
  }

  /**
   * Add book to favorites
   */
  async addToFavorites(userUuid: string, bookId: string | number): Promise<{ success: boolean }> {
    try {
      await query(`
        INSERT INTO fav (user_uuid, bookid) 
        VALUES ($1, $2) 
        ON CONFLICT DO NOTHING
      `, [userUuid, bookId]);

      return { success: true };
    } catch (error) {
      logger.error('Error adding to favorites:', error);
      throw error;
    }
  }

  /**
   * Remove book from favorites
   */
  async removeFromFavorites(userUuid: string, bookId: string | number): Promise<{ success: boolean; removed: boolean }> {
    try {
      const result = await query(`
        DELETE FROM fav WHERE user_uuid = $1 AND bookid = $2
      `, [userUuid, bookId]);

      return { success: true, removed: (result.rowCount || 0) > 0 };
    } catch (error) {
      logger.error('Error removing from favorites:', error);
      throw error;
    }
  }

  /**
   * Get user favorites with pagination
   */
  async getUserFavorites(userUuid: string, page: number = 0, limit: number = 20): Promise<FavoritesResponse> {
    try {
      const offset = page * limit;
      
      const favorites = await getRows(`
        SELECT f.bookid, f.id as fav_id,
               b.title, b.year, b.lang, b.filetype, b.filesize,
               array_agg(DISTINCT an.lastname || COALESCE(' ' || an.firstname, '')) FILTER (WHERE an.lastname IS NOT NULL) as authors,
               array_agg(DISTINCT g.genredesc) FILTER (WHERE g.genredesc IS NOT NULL) as genres
        FROM fav f
        JOIN libbook b ON f.bookid = b.bookid
        LEFT JOIN libavtor av ON b.bookid = av.bookid
        LEFT JOIN libavtorname an ON av.avtorid = an.avtorid
        LEFT JOIN libgenre lg ON b.bookid = lg.bookid
        LEFT JOIN libgenrelist g ON lg.genreid = g.genreid
        WHERE f.user_uuid = $1 AND b.deleted = '0'
        GROUP BY f.bookid, f.id, b.title, b.year, b.lang, b.filetype, b.filesize
        ORDER BY f.id DESC
        LIMIT $2 OFFSET $3
      `, [userUuid, limit, offset]);

      // Get total count
      const countResult = await getRow(`
        SELECT COUNT(*) as total
        FROM fav f
        JOIN libbook b ON f.bookid = b.bookid
        WHERE f.user_uuid = $1 AND b.deleted = '0'
      `, [userUuid]);

      return {
        favorites: favorites,
        pagination: {
          page,
          limit,
          total: parseInt(countResult.total),
          totalPages: Math.ceil(countResult.total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting user favorites:', error);
      throw error;
    }
  }

  /**
   * Save reading progress
   */
  async saveProgress(userUuid: string, bookId: string | number, position: number | null): Promise<{ success: boolean }> {
    try {
      if (position === 0 || position === null) {
        // Remove progress if position is 0
        await query(`
          DELETE FROM progress WHERE user_uuid = $1 AND bookid = $2
        `, [userUuid, bookId]);
      } else {
        // Save or update progress
        await query(`
          INSERT INTO progress (user_uuid, bookid, pos) 
          VALUES ($1, $2, $3) 
          ON CONFLICT(user_uuid, bookid) 
          DO UPDATE SET pos = $3
        `, [userUuid, bookId, position]);
      }

      return { success: true };
    } catch (error) {
      logger.error('Error saving progress:', error);
      throw error;
    }
  }

  /**
   * Get reading progress for a book
   */
  async getProgress(userUuid: string, bookId: string | number): Promise<number> {
    try {
      const result = await getRow(`
        SELECT pos FROM progress WHERE user_uuid = $1 AND bookid = $2
      `, [userUuid, bookId]);

      return result ? parseFloat(result.pos) : 0;
    } catch (error) {
      logger.error('Error getting progress:', error);
      return 0;
    }
  }

  /**
   * Get user's reading progress with book details
   */
  async getUserProgress(userUuid: string, page: number = 0, limit: number = 20): Promise<ProgressResponse> {
    try {
      const offset = page * limit;
      
      const progress = await getRows(`
        SELECT p.bookid, p.pos,
               b.title, b.year, b.lang, b.filetype,
               array_agg(DISTINCT an.lastname || COALESCE(' ' || an.firstname, '')) FILTER (WHERE an.lastname IS NOT NULL) as authors
        FROM progress p
        JOIN libbook b ON p.bookid = b.bookid
        LEFT JOIN libavtor av ON b.bookid = av.bookid
        LEFT JOIN libavtorname an ON av.avtorid = an.avtorid
        WHERE p.user_uuid = $1 AND b.deleted = '0'
        GROUP BY p.bookid, p.pos, b.title, b.year, b.lang, b.filetype
        ORDER BY p.pos DESC
        LIMIT $2 OFFSET $3
      `, [userUuid, limit, offset]);

      // Get total count
      const countResult = await getRow(`
        SELECT COUNT(*) as total
        FROM progress p
        JOIN libbook b ON p.bookid = b.bookid
        WHERE p.user_uuid = $1 AND b.deleted = '0'
      `, [userUuid]);

      return {
        progress: progress,
        pagination: {
          page,
          limit,
          total: parseInt(countResult.total),
          totalPages: Math.ceil(countResult.total / limit)
        }
      };
    } catch (error) {
      logger.error('Error getting user progress:', error);
      throw error;
    }
  }

  /**
   * Check if book is in user's favorites
   */
  async isBookFavorited(userUuid: string, bookId: string | number): Promise<boolean> {
    try {
      const result = await getRow(`
        SELECT 1 FROM fav WHERE user_uuid = $1 AND bookid = $2
      `, [userUuid, bookId]);

      return !!result;
    } catch (error) {
      logger.error('Error checking if book is favorited:', error);
      return false;
    }
  }

  /**
   * Get user session statistics
   */
  async getUserStats(userUuid: string): Promise<any> {
    try {
      const stats = await getRow(`
        SELECT 
          (SELECT COUNT(*) FROM fav WHERE user_uuid = $1) as favorite_count,
          (SELECT COUNT(*) FROM progress WHERE user_uuid = $1) as books_in_progress,
          (SELECT AVG(pos) FROM progress WHERE user_uuid = $1) as avg_reading_progress
      `, [userUuid]);

      return stats;
    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw error;
    }
  }

  /**
   * Clean up expired anonymous sessions
   */
  async cleanupExpiredSessions(): Promise<{ cleaned: number }> {
    try {
      // Remove anonymous users that haven't been accessed in 30 days
      // and have no favorites or progress
      const result = await query(`
        DELETE FROM fav_users 
        WHERE user_uuid IN (
          SELECT fu.user_uuid 
          FROM fav_users fu
          LEFT JOIN fav f ON fu.user_uuid = f.user_uuid
          LEFT JOIN progress p ON fu.user_uuid = p.user_uuid
          WHERE f.user_uuid IS NULL 
            AND p.user_uuid IS NULL
            AND fu.user_uuid NOT IN (SELECT user_uuid FROM users)
        )
      `);

      logger.info(`Cleaned up ${result.rowCount || 0} expired anonymous sessions`);
      return { cleaned: result.rowCount || 0 };
    } catch (error) {
      logger.error('Error cleaning up expired sessions:', error);
      throw error;
    }
  }

  /**
   * Migrate anonymous user data to registered user
   */
  async migrateAnonymousToRegistered(anonymousUuid: string, registeredUuid: string): Promise<{ success: boolean }> {
    try {
      // Transfer favorites
      await query(`
        UPDATE fav SET user_uuid = $1 
        WHERE user_uuid = $2
      `, [registeredUuid, anonymousUuid]);

      // Transfer progress
      await query(`
        UPDATE progress SET user_uuid = $1 
        WHERE user_uuid = $2
      `, [registeredUuid, anonymousUuid]);

      // Remove anonymous user entry
      await query(`
        DELETE FROM fav_users WHERE user_uuid = $1
      `, [anonymousUuid]);

      return { success: true };
    } catch (error) {
      logger.error('Error migrating anonymous user data:', error);
      throw error;
    }
  }

  /**
   * Update anonymous user name
   */
  async updateAnonymousUserName(userUuid: string, newName: string): Promise<{ success: boolean }> {
    try {
      await query(`
        UPDATE fav_users SET name = $1 WHERE user_uuid = $2
      `, [newName, userUuid]);

      return { success: true };
    } catch (error) {
      logger.error('Error updating anonymous user name:', error);
      throw error;
    }
  }
}

export default new SessionService();