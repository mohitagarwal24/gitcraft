import express from 'express';
import crypto from 'crypto';
import GitHubIntegration from '../integrations/github.js';
import LLMIntegration from '../integrations/llm.js';
import DocumentationUpdater from '../agents/updater.js';

const router = express.Router();

/**
 * Helper to get repo config from persistent store
 */
function getRepoConfig(repoStore, repoFullName) {
  const repo = repoStore.get(repoFullName);
  if (!repo) return null;
  return {
    githubToken: repo.githubToken,
    craftMcpUrl: repo.craftMcpUrl,
  };
}

/**
 * GitHub webhook handler
 */
router.post('/github', async (req, res) => {
  try {
    // Verify webhook signature
    const signature = req.headers['x-hub-signature-256'];
    const payload = req.body;

    if (!verifySignature(payload, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.headers['x-github-event'];
    const data = JSON.parse(payload.toString());

    console.log(`📨 Received GitHub webhook: ${event}`);

    // Get repoStore from app.locals
    const repoStore = req.app.locals.repoStore;

    // Handle pull request events
    if (event === 'pull_request') {
      await handlePullRequestEvent(data, repoStore);
    }

    // Handle push events (direct commits to main/master)
    if (event === 'push') {
      await handlePushEvent(data, repoStore);
    }

    res.status(200).json({ success: true, event });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Handle pull request events
 */
async function handlePullRequestEvent(data, repoStore) {
  const { action, pull_request, repository } = data;

  // Only process merged PRs
  if (action !== 'closed' || !pull_request.merged) {
    console.log(`  ℹ️  Ignoring PR event: ${action}, merged: ${pull_request.merged}`);
    return;
  }

  const repoFullName = repository.full_name;
  const [owner, repo] = repoFullName.split('/');

  console.log(`  ✅ Processing merged PR #${pull_request.number} for ${repoFullName}`);

  // Get repository configuration from persistent store
  const config = getRepoConfig(repoStore, repoFullName);
  if (!config) {
    console.warn(`  ⚠️  No configuration found for ${repoFullName} - repository may not be connected`);
    return;
  }

  try {
    // Process the update
    const updater = new DocumentationUpdater(
      config.githubToken,
      config.craftMcpUrl
    );

    await updater.processUpdate({
      owner,
      repo,
      prNumber: pull_request.number,
      branch: pull_request.base.ref
    });

    console.log(`  ✅ Documentation updated for PR #${pull_request.number}`);
  } catch (error) {
    console.error(`  ❌ Failed to update documentation:`, error);
  }
}

/**
 * Handle push events (direct commits to main/master)
 */
async function handlePushEvent(data, repoStore) {
  const { repository, ref, commits } = data;

  // Only process pushes to main/master branch
  if (!ref.endsWith('/main') && !ref.endsWith('/master')) {
    console.log(`  ℹ️  Ignoring push to ${ref} (not main/master)`);
    return;
  }

  // Skip if no commits (e.g., branch deletion)
  if (!commits || commits.length === 0) {
    console.log(`  ℹ️  Ignoring push event: no commits`);
    return;
  }

  const repoFullName = repository.full_name;
  const [owner, repo] = repoFullName.split('/');
  const branchName = ref.split('/').pop();

  console.log(`  📤 Processing push to ${repoFullName}:${branchName} (${commits.length} commits)`);

  // Get repository configuration from persistent store
  const config = getRepoConfig(repoStore, repoFullName);
  if (!config) {
    console.warn(`  ⚠️  No configuration found for ${repoFullName} - repository may not be connected`);
    return;
  }

  try {
    // Get commit details with file changes
    const github = new GitHubIntegration(config.githubToken);

    // Get detailed commit info for the latest commit
    const latestCommit = commits[commits.length - 1];
    const commitDetails = await github.getCommit(owner, repo, latestCommit.id);

    // Analyze significance
    const llm = new LLMIntegration();

    const significance = await llm.analyzeCommitSignificance(
      commits.map(c => ({
        sha: c.id,
        message: c.message,
        author: c.author?.username || c.author?.name || 'unknown'
      })),
      commitDetails.files || []
    );

    console.log(`  🤖 Significance analysis: ${significance.isSignificant ? '✅ SIGNIFICANT' : '⏭️  TRIVIAL'}`);
    console.log(`     Reasoning: ${significance.reasoning}`);

    if (!significance.isSignificant) {
      console.log(`  ⏭️  Skipping documentation update for trivial changes`);
      return;
    }

    // Process the update
    const updater = new DocumentationUpdater(
      config.githubToken,
      config.craftMcpUrl
    );

    await updater.processCommitUpdate({
      owner,
      repo,
      commits,
      commitDetails,
      significance,
      branch: branchName
    });

    console.log(`  ✅ Documentation updated for commits`);
  } catch (error) {
    console.error(`  ❌ Failed to process push event:`, error);
  }
}

/**
 * Verify GitHub webhook signature
 */
function verifySignature(payload, signature) {
  if (!signature) {
    return false;
  }

  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('⚠️  GITHUB_WEBHOOK_SECRET not set, skipping signature verification');
    return true; // Allow in development
  }

  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    );
  } catch (error) {
    return false;
  }
}

/**
 * Register repository for webhook updates
 * Note: This is now just for explicit webhook registration
 * The main repo config is stored via the /sync/analyze endpoint
 */
router.post('/register', async (req, res) => {
  const { repoFullName, githubToken, craftMcpUrl } = req.body;

  if (!repoFullName || !githubToken || !craftMcpUrl) {
    return res.status(400).json({
      error: 'Missing required fields: repoFullName, githubToken, craftMcpUrl'
    });
  }

  const repoStore = req.app.locals.repoStore;

  // Add or update repo in persistent store
  await repoStore.set(repoFullName, {
    githubToken,
    craftMcpUrl,
  });

  console.log(`✅ Registered webhook for ${repoFullName}`);

  res.json({
    success: true,
    message: `Webhook registered for ${repoFullName}`,
    webhookUrl: `${req.protocol}://${req.get('host')}/webhook/github`
  });
});

/**
 * Unregister repository
 */
router.delete('/register/:repoFullName', async (req, res) => {
  const { repoFullName } = req.params;
  const repoStore = req.app.locals.repoStore;

  const deleted = await repoStore.delete(decodeURIComponent(repoFullName));

  if (deleted) {
    res.json({ success: true, message: `Webhook unregistered for ${repoFullName}` });
  } else {
    res.status(404).json({ error: 'Repository not found' });
  }
});

/**
 * List registered repositories
 */
router.get('/registered', (req, res) => {
  const repoStore = req.app.locals.repoStore;
  const repos = repoStore.getAll().map(repo => ({
    name: repo.repoFullName || repo.id,
    registeredAt: repo.connectedAt
  }));

  res.json({ repos });
});

export default router;
