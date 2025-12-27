import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { repositories } from '../db/schema.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Repository Store with PostgreSQL
 * Manages connected repository configurations with database persistence
 */
class RepositoryStore {
  constructor(storagePath = './data/repositories.json') {
    this.storagePath = storagePath;
    this.dbEnabled = !!db;
    this.memoryStore = new Map(); // Fallback
    this.loaded = false;

    if (!this.dbEnabled) {
      console.warn('⚠️  Database not configured. Using file-based repository store');
    }
  }

  get repos() {
    return this.memoryStore;
  }

  /**
   * Initialize store - load from database or file
   */
  async initialize() {
    if (this.loaded) return;

    if (this.dbEnabled) {
      try {
        const repos = await db.select().from(repositories);
        for (const repo of repos) {
          this.memoryStore.set(repo.id, repo);
        }
        console.log(`📂 Loaded ${repos.length} repositories from database`);
        this.loaded = true;
        return;
      } catch (error) {
        console.error('Error loading from database:', error);
        console.log('Falling back to file storage...');
      }
    }

    // Fallback to file storage
    try {
      const dir = path.dirname(this.storagePath);
      await fs.mkdir(dir, { recursive: true });

      try {
        const data = await fs.readFile(this.storagePath, 'utf-8');
        const parsed = JSON.parse(data);
        this.memoryStore = new Map(Object.entries(parsed));
        console.log(`📂 Loaded ${this.memoryStore.size} repositories from file`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error('Error loading repository data:', error);
        }
      }

      this.loaded = true;
    } catch (error) {
      console.error('Failed to initialize repository store:', error);
      throw error;
    }
  }

  /**
   * Save to file (fallback only)
   */
  async saveToFile() {
    if (this.dbEnabled) return; // Don't save to file if using database

    try {
      const data = Object.fromEntries(this.memoryStore);
      await fs.writeFile(
        this.storagePath,
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Error saving repository data:', error);
      throw error;
    }
  }

  /**
   * Add or update repository
   */
  async set(repoFullName, config) {
    // Convert timestamps to Date objects for Drizzle ORM compatibility
    const connectedAt = config.connectedAt
      ? (config.connectedAt instanceof Date ? config.connectedAt : new Date(config.connectedAt))
      : new Date();
    const lastUpdated = new Date();

    // Build the database record with only valid fields
    const dbRecord = {
      id: repoFullName,
      githubToken: config.githubToken,
      craftMcpUrl: config.craftMcpUrl,
      documentId: config.documentId || null,
      documentTitle: config.documentTitle || null,
      sessionId: config.sessionId,
      user: config.user,
      connectedAt,
      lastUpdated,
      collectionIds: config.collectionIds || null,
      lastProcessedPR: config.lastProcessedPR || null,
      lastSyncedAt: config.lastSyncedAt || null,
    };

    // For memory store, keep all config props
    const enrichedConfig = {
      ...config,
      id: repoFullName,
      connectedAt,
      lastUpdated,
    };

    if (this.dbEnabled) {
      try {
        await db
          .insert(repositories)
          .values(dbRecord)
          .onConflictDoUpdate({
            target: repositories.id,
            set: {
              githubToken: dbRecord.githubToken,
              craftMcpUrl: dbRecord.craftMcpUrl,
              documentId: dbRecord.documentId,
              documentTitle: dbRecord.documentTitle,
              lastUpdated: new Date(),
              collectionIds: dbRecord.collectionIds,
              lastProcessedPR: dbRecord.lastProcessedPR,
              lastSyncedAt: dbRecord.lastSyncedAt,
            },
          });
        console.log(`✅ Repository saved to database: ${repoFullName}`);
      } catch (error) {
        console.error('Error saving repository to database:', error);
      }
    } else {
      await this.saveToFile();
    }

    this.memoryStore.set(repoFullName, enrichedConfig);
    return enrichedConfig;
  }

  /**
   * Get repository
   */
  get(repoFullName) {
    return this.memoryStore.get(repoFullName);
  }

  /**
   * Delete repository
   */
  async delete(repoFullName) {
    if (this.dbEnabled) {
      try {
        await db.delete(repositories).where(eq(repositories.id, repoFullName));
        console.log(`✅ Repository deleted from database: ${repoFullName}`);
      } catch (error) {
        console.error('Error deleting repository from database:', error);
      }
    } else {
      await this.saveToFile();
    }

    const deleted = this.memoryStore.delete(repoFullName);
    return deleted;
  }

  /**
   * Check if repository exists
   */
  has(repoFullName) {
    return this.memoryStore.has(repoFullName);
  }

  /**
   * Get all repositories
   */
  getAll() {
    return Array.from(this.memoryStore.entries()).map(([name, config]) => ({
      repoFullName: name,
      ...config,
    }));
  }

  /**
   * Get repositories by user
   */
  getByUser(githubToken) {
    return this.getAll().filter((repo) => repo.githubToken === githubToken);
  }

  /**
   * Get repository count
   */
  get size() {
    return this.memoryStore.size;
  }

  /**
   * Clear all repositories
   */
  async clear() {
    if (this.dbEnabled) {
      try {
        await db.delete(repositories);
      } catch (error) {
        console.error('Error clearing repositories:', error);
      }
    } else {
      await this.saveToFile();
    }

    this.memoryStore.clear();
  }

  /**
   * Update repository metadata
   */
  async updateMetadata(repoFullName, metadata) {
    const config = this.memoryStore.get(repoFullName);
    if (!config) {
      throw new Error(`Repository ${repoFullName} not found`);
    }

    const updated = {
      ...config,
      ...metadata,
      lastUpdated: new Date().toISOString(),
    };

    return await this.set(repoFullName, updated);
  }
}

export default RepositoryStore;
