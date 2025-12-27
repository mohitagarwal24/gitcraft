import DocumentationUpdater from '../agents/updater.js';
import CraftAdvancedIntegration from '../integrations/craft-advanced.js';

/**
 * Continuous Sync Service
 * Monitors connected repositories and automatically syncs documentation
 * when changes are detected (PR merges, commits, etc.)
 * Also verifies Craft documents still exist and cleans up stale connections.
 */
class ContinuousSyncService {
  constructor(repoConfigStore, repoStore = null) {
    this.repoConfigStore = repoConfigStore; // Map of repoFullName -> config
    this.repoStore = repoStore; // RepositoryStore for database cleanup
    this.syncInterval = 5 * 60 * 1000; // 5 minutes
    this.isRunning = false;
    this.intervalId = null;
    this.lastSyncTimes = new Map();
  }

  /**
   * Start the continuous sync service
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  Continuous sync already running');
      return;
    }

    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                                                                ║');
    console.log('║        🔄 CONTINUOUS SYNC SERVICE STARTED                      ║');
    console.log('║                                                                ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
    console.log(`📡 Monitoring interval: ${this.syncInterval / 1000}s`);
    console.log(`📊 Connected repos: ${this.repoConfigStore.size}\n`);

    this.isRunning = true;

    // Run initial sync
    this.runSyncCycle().catch(err => {
      console.error('Initial sync cycle failed:', err);
    });

    // Set up periodic syncing
    this.intervalId = setInterval(() => {
      this.runSyncCycle().catch(err => {
        console.error('Sync cycle error:', err);
      });
    }, this.syncInterval);

    console.log('✅ Continuous sync service is now active\n');
  }

  /**
   * Stop the continuous sync service
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    console.log('\n🛑 Stopping continuous sync service...');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log('✅ Continuous sync service stopped\n');
  }

  /**
   * Run a sync cycle across all connected repositories
   */
  async runSyncCycle() {
    const startTime = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`🔄 Sync Cycle Started: ${new Date().toISOString()}`);
    console.log(`${'─'.repeat(60)}`);

    const repos = Array.from(this.repoConfigStore.entries());

    if (repos.length === 0) {
      console.log('ℹ️  No repositories connected - skipping sync cycle');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const [repoFullName, config] of repos) {
      try {
        // Check if we should sync this repo (avoid too frequent syncs)
        const lastSync = this.lastSyncTimes.get(repoFullName);
        const minTimeBetweenSyncs = 2 * 60 * 1000; // 2 minutes minimum

        if (lastSync && (Date.now() - lastSync) < minTimeBetweenSyncs) {
          console.log(`⏭️  ${repoFullName}: Skipped (synced recently)`);
          skippedCount++;
          continue;
        }

        console.log(`\n📦 Syncing: ${repoFullName}`);

        // Verify Craft document still exists
        if (config.craftMcpUrl) {
          try {
            const craft = new CraftAdvancedIntegration(config.craftMcpUrl);
            const docCheck = await craft.documentExists(repoFullName);

            if (!docCheck.exists) {
              console.log(`  🗑️  Craft document deleted - removing connection for ${repoFullName}`);
              this.repoConfigStore.delete(repoFullName);
              this.lastSyncTimes.delete(repoFullName);

              // Also remove from database if repoStore is available
              if (this.repoStore) {
                await this.repoStore.delete(repoFullName);
              }

              continue;
            }
          } catch (craftErr) {
            console.warn(`  ⚠️  Could not verify Craft doc: ${craftErr.message}`);
            // Continue with sync attempt if verification fails
          }
        }

        const [owner, repo] = repoFullName.split('/');

        // Get sync state from database
        let syncState = {};
        if (this.repoStore) {
          const repoData = this.repoStore.get(repoFullName);
          if (repoData) {
            syncState = {
              lastSyncedAt: repoData.lastSyncedAt,
              lastProcessedPR: repoData.lastProcessedPR,
              documentId: repoData.documentId,
              collectionIds: repoData.collectionIds
            };
          }
        }

        const updater = new DocumentationUpdater(
          config.githubToken,
          config.craftMcpUrl
        );

        const result = await updater.checkForUpdates(owner, repo, 'main', syncState);

        if (result.processed > 0) {
          const prMsg = result.prCount > 0 ? `${result.prCount} PR(s): ${result.prs.join(', ')}` : '';
          const commitMsg = result.commitCount > 0 ? `${result.commits.length} commit(s)` : '';
          const updateMsg = [prMsg, commitMsg].filter(Boolean).join(', ');
          console.log(`  ✅ Processed ${updateMsg || 'updates'}`);
          successCount++;
        } else {
          console.log(`  ✓ Up to date (no new changes)`);
        }

        this.lastSyncTimes.set(repoFullName, Date.now());

        // Update sync state in database
        if (this.repoStore) {
          await this.repoStore.updateMetadata(repoFullName, {
            lastSyncedAt: new Date(),
            lastProcessedPR: result.highestPR || syncState.lastProcessedPR
          });
        }

      } catch (error) {
        console.error(`  ❌ Failed to sync ${repoFullName}:`, error.message);
        errorCount++;
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📊 Sync Cycle Complete (${duration}s)`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`${'─'.repeat(60)}\n`);
  }

  /**
   * Force sync a specific repository
   */
  async forceSyncRepository(repoFullName) {
    const config = this.repoConfigStore.get(repoFullName);

    if (!config) {
      throw new Error(`Repository ${repoFullName} is not connected`);
    }

    console.log(`\n🔄 Force syncing: ${repoFullName}`);

    const [owner, repo] = repoFullName.split('/');

    const updater = new DocumentationUpdater(
      config.githubToken,
      config.craftMcpUrl
    );

    const result = await updater.checkForUpdates(owner, repo);

    this.lastSyncTimes.set(repoFullName, Date.now());

    return result;
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      connectedRepos: this.repoConfigStore.size,
      syncInterval: this.syncInterval,
      lastSyncTimes: Object.fromEntries(this.lastSyncTimes)
    };
  }

  /**
   * Add repository to monitoring
   */
  addRepository(repoFullName, config) {
    this.repoConfigStore.set(repoFullName, config);
    console.log(`➕ Added ${repoFullName} to continuous sync`);

    if (this.isRunning) {
      // Trigger immediate sync for new repo
      this.forceSyncRepository(repoFullName).catch(err => {
        console.error(`Initial sync failed for ${repoFullName}:`, err);
      });
    }
  }

  /**
   * Remove repository from monitoring
   */
  removeRepository(repoFullName) {
    const removed = this.repoConfigStore.delete(repoFullName);
    if (removed) {
      this.lastSyncTimes.delete(repoFullName);
      console.log(`➖ Removed ${repoFullName} from continuous sync`);
    }
    return removed;
  }

  /**
   * Manually sync a single repository (triggered by user)
   */
  async syncSingleRepo(repoFullName, config) {
    console.log(`\n🔄 Manual sync for ${repoFullName}...`);

    try {
      const [owner, repo] = repoFullName.split('/');

      // Get sync state from database
      let syncState = {};
      if (this.repoStore) {
        const repoData = this.repoStore.get(repoFullName);
        if (repoData) {
          syncState = {
            lastSyncedAt: repoData.lastSyncedAt,
            lastProcessedPR: repoData.lastProcessedPR,
            documentId: repoData.documentId,
            collectionIds: repoData.collectionIds
          };
        }
      }

      const updater = new DocumentationUpdater(
        config.githubToken,
        config.craftMcpUrl
      );

      const result = await updater.checkForUpdates(owner, repo, 'main', syncState);

      if (result.processed > 0) {
        console.log(`  ✅ Processed ${result.processed} update(s)`);
      } else {
        console.log(`  ✓ No new changes`);
      }

      // Update last sync time
      this.lastSyncTimes.set(repoFullName, Date.now());

      if (this.repoStore) {
        await this.repoStore.updateMetadata(repoFullName, {
          lastSyncedAt: new Date(),
          lastProcessedPR: result.highestPR || syncState.lastProcessedPR
        });
      }

      return { success: true, result };
    } catch (error) {
      console.error(`  ❌ Manual sync failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

export default ContinuousSyncService;


