import { eq, and, lt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sessions } from '../db/schema.js';

/**
 * Session Store with PostgreSQL
 * Manages user authentication sessions with database persistence
 */
class SessionStore {
    constructor() {
        this.dbEnabled = !!db;
        this.memoryStore = new Map(); // Fallback for development

        if (!this.dbEnabled) {
            console.warn('⚠️  Database not configured. Using in-memory session store (sessions will be lost on restart)');
        }
    }

    /**
     * Create a new session
     */
    async create(sessionId, sessionData) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        const session = {
            id: sessionId,
            accessToken: sessionData.accessToken,
            user: sessionData.user,
            createdAt: new Date(),
            expiresAt,
            lastActivityAt: new Date(),
        };

        if (this.dbEnabled) {
            try {
                await db.insert(sessions).values(session);
                console.log(`✅ Session created in database: ${sessionId}`);
            } catch (error) {
                console.error('Error creating session in database:', error);
                // Fallback to memory
                this.memoryStore.set(sessionId, session);
            }
        } else {
            this.memoryStore.set(sessionId, session);
        }

        return session;
    }

    /**
     * Get session by ID
     */
    async get(sessionId) {
        if (this.dbEnabled) {
            try {
                const result = await db
                    .select()
                    .from(sessions)
                    .where(eq(sessions.id, sessionId))
                    .limit(1);

                if (result.length === 0) {
                    return null;
                }

                const session = result[0];

                // Check if expired
                if (new Date() > new Date(session.expiresAt)) {
                    await this.delete(sessionId);
                    return null;
                }

                // Update last activity
                await this.updateActivity(sessionId);

                return session;
            } catch (error) {
                console.error('Error getting session from database:', error);
                return this.memoryStore.get(sessionId) || null;
            }
        } else {
            const session = this.memoryStore.get(sessionId);
            if (!session) return null;

            // Check if expired
            if (new Date() > new Date(session.expiresAt)) {
                this.memoryStore.delete(sessionId);
                return null;
            }

            return session;
        }
    }

    /**
     * Update last activity timestamp
     */
    async updateActivity(sessionId) {
        if (this.dbEnabled) {
            try {
                await db
                    .update(sessions)
                    .set({ lastActivityAt: new Date() })
                    .where(eq(sessions.id, sessionId));
            } catch (error) {
                console.error('Error updating session activity:', error);
            }
        } else {
            const session = this.memoryStore.get(sessionId);
            if (session) {
                session.lastActivityAt = new Date();
            }
        }
    }

    /**
     * Delete session
     */
    async delete(sessionId) {
        if (this.dbEnabled) {
            try {
                await db.delete(sessions).where(eq(sessions.id, sessionId));
                console.log(`✅ Session deleted from database: ${sessionId}`);
            } catch (error) {
                console.error('Error deleting session from database:', error);
            }
        }

        this.memoryStore.delete(sessionId);
    }

    /**
     * Delete all sessions for a user
     */
    async deleteByUser(userId) {
        if (this.dbEnabled) {
            try {
                // Note: This requires a custom query since user is JSONB
                await db.execute(sql`
          DELETE FROM sessions 
          WHERE user->>'id' = ${userId.toString()}
        `);
            } catch (error) {
                console.error('Error deleting user sessions:', error);
            }
        }

        // Clean memory store
        for (const [sessionId, session] of this.memoryStore.entries()) {
            if (session.user.id === userId) {
                this.memoryStore.delete(sessionId);
            }
        }
    }

    /**
     * Clean up expired sessions
     */
    async cleanup() {
        const now = new Date();

        if (this.dbEnabled) {
            try {
                const result = await db
                    .delete(sessions)
                    .where(lt(sessions.expiresAt, now));

                console.log(`🧹 Cleaned up expired sessions from database`);
            } catch (error) {
                console.error('Error cleaning up sessions:', error);
            }
        }

        // Clean memory store
        for (const [sessionId, session] of this.memoryStore.entries()) {
            if (new Date(session.expiresAt) < now) {
                this.memoryStore.delete(sessionId);
            }
        }
    }

    /**
     * Get session count
     */
    async count() {
        if (this.dbEnabled) {
            try {
                const result = await db.select().from(sessions);
                return result.length;
            } catch (error) {
                console.error('Error counting sessions:', error);
                return this.memoryStore.size;
            }
        }

        return this.memoryStore.size;
    }

    /**
     * Check if session exists
     */
    async has(sessionId) {
        const session = await this.get(sessionId);
        return session !== null;
    }
}

export default SessionStore;
