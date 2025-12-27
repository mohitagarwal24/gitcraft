import { pgTable, text, timestamp, integer, jsonb, serial } from 'drizzle-orm/pg-core';

/**
 * Sessions table
 * Stores user authentication sessions
 */
export const sessions = pgTable('sessions', {
    id: text('id').primaryKey(),
    accessToken: text('access_token').notNull(),
    user: jsonb('user').notNull(), // {id, login, name, email}
    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
});

/**
 * Repositories table
 * Stores connected repository configurations
 */
export const repositories = pgTable('repositories', {
    id: text('id').primaryKey(), // repoFullName as ID
    githubToken: text('github_token').notNull(),
    craftMcpUrl: text('craft_mcp_url').notNull(),
    documentId: text('document_id'),
    documentTitle: text('document_title'),
    sessionId: text('session_id').notNull(),
    user: jsonb('user').notNull(), // {id, login, name, email}
    connectedAt: timestamp('connected_at').defaultNow().notNull(),
    lastUpdated: timestamp('last_updated').defaultNow().notNull(),
    collectionIds: jsonb('collection_ids'), // {docHistory, releaseNotes, adrs, engineeringTasks}
    lastProcessedPR: integer('last_processed_pr'), // Last PR number processed
    lastSyncedAt: timestamp('last_synced_at'), // Last successful sync timestamp
    confidence: real('confidence'), // AI analysis confidence (0-1)
});

/**
 * Sync history table (optional - for tracking)
 * Stores history of documentation updates
 */
export const syncHistory = pgTable('sync_history', {
    id: serial('id').primaryKey(),
    repoId: text('repo_id').notNull().references(() => repositories.id),
    prNumber: integer('pr_number'),
    commitSha: text('commit_sha'),
    syncType: text('sync_type').notNull(), // 'pr' | 'commit' | 'manual'
    isSignificant: integer('is_significant').notNull(), // 0 or 1 (boolean)
    changeType: text('change_type'), // 'feature' | 'bugfix' | etc
    summary: text('summary'),
    syncedAt: timestamp('synced_at').defaultNow().notNull(),
});
