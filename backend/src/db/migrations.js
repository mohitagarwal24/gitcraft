import { sql } from 'drizzle-orm';
import { db } from './index.js';
import { sessions, repositories, syncHistory } from './schema.js';

/**
 * Create all tables
 * Run this to initialize the database
 */
export async function createTables() {
  if (!db) {
    throw new Error('Database not configured');
  }

  console.log('Creating database tables...');

  try {
    // Create sessions table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        access_token TEXT NOT NULL,
        "user" JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        last_activity_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // Create repositories table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS repositories (
        id TEXT PRIMARY KEY,
        github_token TEXT NOT NULL,
        craft_mcp_url TEXT NOT NULL,
        document_id TEXT,
        document_title TEXT,
        session_id TEXT NOT NULL,
        "user" JSONB NOT NULL,
        connected_at TIMESTAMP DEFAULT NOW() NOT NULL,
        last_updated TIMESTAMP DEFAULT NOW() NOT NULL,
        collection_ids JSONB
      )
    `);

    // Create sync_history table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sync_history (
        id SERIAL PRIMARY KEY,
        repo_id TEXT NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        pr_number INTEGER,
        commit_sha TEXT,
        sync_type TEXT NOT NULL,
        is_significant INTEGER NOT NULL,
        change_type TEXT,
        summary TEXT,
        synced_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);

    // Create indexes for better performance
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_repositories_session_id ON repositories(session_id)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_sync_history_repo_id ON sync_history(repo_id)
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_sync_history_synced_at ON sync_history(synced_at)
    `);

    console.log('✅ Database tables created successfully');
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  }
}

/**
 * Drop all tables (use with caution!)
 */
export async function dropTables() {
  if (!db) {
    throw new Error('Database not configured');
  }

  console.log('⚠️  Dropping all tables...');

  try {
    await db.execute(sql`DROP TABLE IF EXISTS sync_history CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS repositories CASCADE`);
    await db.execute(sql`DROP TABLE IF EXISTS sessions CASCADE`);

    console.log('✅ All tables dropped');
  } catch (error) {
    console.error('❌ Error dropping tables:', error);
    throw error;
  }
}

/**
 * Migrate data from JSON files to PostgreSQL
 */
export async function migrateFromJSON() {
  const fs = await import('fs/promises');
  const path = await import('path');

  try {
    // Migrate repositories
    const reposPath = path.join(process.cwd(), 'data', 'repositories.json');
    try {
      const reposData = await fs.readFile(reposPath, 'utf-8');
      const repos = JSON.parse(reposData);

      for (const [repoFullName, repoData] of Object.entries(repos)) {
        await db.insert(repositories).values({
          id: repoFullName,
          githubToken: repoData.githubToken,
          craftMcpUrl: repoData.craftMcpUrl,
          documentId: repoData.documentId,
          documentTitle: repoData.documentTitle,
          sessionId: repoData.sessionId,
          user: repoData.user,
          connectedAt: new Date(repoData.connectedAt),
          lastUpdated: new Date(repoData.lastUpdated),
          collectionIds: repoData.collectionIds || null,
        }).onConflictDoNothing();
      }

      console.log(`✅ Migrated ${Object.keys(repos).length} repositories`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      console.log('No repositories.json found, skipping migration');
    }

    console.log('✅ Migration completed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Main execution when run as a script
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  console.log('Running database migrations...');
  createTables()
    .then(() => {
      console.log('✅ All migrations completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}
