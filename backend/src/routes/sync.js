import express from 'express';
const router = express.Router();
import RepositoryAnalyzer from '../agents/analyzer.js';
import DocumentationUpdater from '../agents/updater.js';
import GitHubIntegration from '../integrations/github.js';


/**
 * Initial repository analysis and documentation generation
 */
router.post('/analyze', async (req, res) => {
  try {
    const { sessionId, owner, repo, branch, craftMcpUrl } = req.body;

    // Validate inputs
    if (!sessionId || !owner || !repo || !craftMcpUrl) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId, owner, repo, craftMcpUrl'
      });
    }

    // Get session
    const sessionStore = req.app.locals.sessionStore;
    const session = await sessionStore.get(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Check if repository is already connected with existing documentation
    const repoStore = req.app.locals.repoStore;
    const existingRepo = repoStore.get(`${owner}/${repo}`);

    if (existingRepo && existingRepo.documentId) {
      console.log(`📄 Repository ${owner}/${repo} already has documentation`);
      return res.json({
        success: true,
        alreadyExists: true,
        message: 'Repository already has documentation in Craft',
        craftDocument: {
          id: existingRepo.documentId,
          title: existingRepo.documentTitle
        },
        connectionInfo: {
          repo: `${owner}/${repo}`,
          documentId: existingRepo.documentId,
          documentTitle: existingRepo.documentTitle,
          connectedAt: existingRepo.connectedAt
        }
      });
    }

    console.log(`🚀 Starting analysis for ${owner}/${repo}...`);

    // Create analyzer
    const analyzer = new RepositoryAnalyzer(
      session.accessToken,
      craftMcpUrl
    );

    // Run analysis
    const result = await analyzer.analyzeAndGenerate(
      owner,
      repo,
      branch || 'main'
    );

    // Register repository in persistent store
    // Note: repoStore was already accessed above for the existence check
    const syncService = req.app.locals.syncService;

    await repoStore.set(`${owner}/${repo}`, {
      githubToken: session.accessToken,
      craftMcpUrl,
      documentId: result.craftDocument?.documentId,
      documentTitle: result.craftDocument?.documentTitle,
      sessionId,
      user: session.user
    });

    // Add to continuous sync if service is running
    if (syncService) {
      syncService.addRepository(`${owner}/${repo}`, {
        githubToken: session.accessToken,
        craftMcpUrl
      });
    }

    res.json({
      success: true,
      message: result.message || 'Repository analyzed and documentation created',
      craftDocument: {
        id: result.craftDocument?.documentId,
        title: result.craftDocument?.documentTitle
      },
      analysis: {
        repoName: result.analysis?.repoName,
        confidence: Math.round((result.analysis?.confidence || 0) * 100),
        techStack: result.analysis?.techStack
      },
      connectionInfo: result.connectionInfo
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: 'Analysis failed',
      message: error.message
    });
  }
});

/**
 * Manual sync - check for new PRs and update docs
 */
router.post('/manual', async (req, res) => {
  try {
    const { sessionId, owner, repo, craftMcpUrl } = req.body;

    // Validate inputs
    if (!sessionId || !owner || !repo || !craftMcpUrl) {
      return res.status(400).json({
        error: 'Missing required fields: sessionId, owner, repo, craftMcpUrl'
      });
    }

    // Get session
    const sessionStore = req.app.locals.sessionStore;
    const session = await sessionStore.get(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    console.log(`🔄 Manual sync for ${owner}/${repo}...`);

    // Create updater
    const updater = new DocumentationUpdater(
      session.accessToken,
      craftMcpUrl
    );

    // Check for updates
    const result = await updater.checkForUpdates(owner, repo);

    res.json({
      success: true,
      message: `Processed ${result.processed} new PRs`,
      processed: result.processed,
      prs: result.prs
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({
      error: 'Sync failed',
      message: error.message
    });
  }
});

/**
 * Get repository list
 */
router.get('/repositories', async (req, res) => {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    // Get session
    const sessionStore = req.app.locals.sessionStore;
    const session = await sessionStore.get(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Get repositories
    const github = new GitHubIntegration(session.accessToken);
    const repos = await github.listRepositories();

    res.json({
      success: true,
      repositories: repos
    });
  } catch (error) {
    console.error('Error fetching repositories:', error);
    res.status(500).json({
      error: 'Failed to fetch repositories',
      message: error.message
    });
  }
});

/**
 * Get sync status
 */
router.get('/status/:owner/:repo', async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const { sessionId, craftMcpUrl } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    // Get session
    const sessionStore = req.app.locals.sessionStore;
    const session = await sessionStore.get(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const repoFullName = `${owner}/${repo}`;

    // Check if repo is in store
    const repoStore = req.app.locals.repoStore;
    const repoConfig = repoStore ? repoStore.get(repoFullName) : null;

    // Default state
    let state = {
      repoName: repoFullName,
      lastProcessedPR: null,
      lastSync: repoConfig?.lastUpdated || new Date().toISOString(),
      branch: 'main',
      confidence: 0.5,
      connected: !!repoConfig,
      documentId: repoConfig?.documentId,
      documentTitle: repoConfig?.documentTitle
    };

    res.json({
      success: true,
      state
    });
  } catch (error) {
    console.error('Error fetching status:', error);
    // Always return 200 with error info in response
    res.status(200).json({
      success: true,
      state: {
        repoName: `${req.params.owner}/${req.params.repo}`,
        lastProcessedPR: null,
        lastSync: null,
        branch: 'main',
        confidence: 0,
        connected: false,
        error: error.message
      }
    });
  }
});

/**
 * Test Craft MCP connection
 */
router.post('/test-craft', async (req, res) => {
  try {
    const { craftMcpUrl } = req.body;

    if (!craftMcpUrl) {
      return res.status(400).json({ error: 'Missing craftMcpUrl' });
    }

    console.log(`\n🧪 Testing Craft MCP connection to: ${craftMcpUrl}`);

    const CraftIntegration = require('../integrations/craft');
    const craft = new CraftIntegration(craftMcpUrl);

    const isConnected = await craft.testConnection();

    res.json({
      success: isConnected,
      message: isConnected
        ? 'Craft MCP connection successful'
        : 'Craft MCP connection failed - files will be generated locally',
      tools: craft.availableTools?.map(t => t.name) || [],
      mcpUrl: craftMcpUrl,
      fallbackMode: !isConnected
    });
  } catch (error) {
    console.error('Craft connection test error:', error);
    res.json({
      success: false,
      message: `Connection test failed: ${error.message}`,
      mcpUrl: req.body.craftMcpUrl,
      fallbackMode: true,
      hint: 'Documents will be generated as local files instead'
    });
  }
});

/**
 * Debug MCP - get detailed information
 * Craft MCP requires Accept: application/json, text/event-stream
 * Response is in SSE format: "event: message\ndata: {...json...}"
 */
router.post('/debug-mcp', async (req, res) => {
  try {
    const { craftMcpUrl } = req.body;

    if (!craftMcpUrl) {
      return res.status(400).json({ error: 'Missing craftMcpUrl' });
    }

    const axios = require('axios');

    // Parse SSE response
    function parseSSE(data) {
      if (typeof data !== 'string') return data;
      const lines = data.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            return JSON.parse(line.substring(6));
          } catch (e) { }
        }
      }
      try { return JSON.parse(data); } catch (e) { return { raw: data }; }
    }

    const results = {
      url: craftMcpUrl,
      tests: []
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    };

    // Test 1: tools/list
    try {
      const response = await axios.post(craftMcpUrl, {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      }, { timeout: 15000, headers });

      const parsed = parseSSE(response.data);
      const tools = parsed?.result?.tools || [];

      results.tests.push({
        name: 'tools/list',
        success: true,
        toolCount: tools.length,
        tools: tools.map(t => t.name)
      });
    } catch (error) {
      results.tests.push({
        name: 'tools/list',
        success: false,
        error: error.response?.data || error.message,
        status: error.response?.status
      });
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({
      error: 'Debug failed',
      message: error.message
    });
  }
});

/**
 * Get all connected repositories
 */
router.get('/connected', async (req, res) => {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    // Get session
    const sessionStore = req.app.locals.sessionStore;
    const session = await sessionStore.get(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Get repos from store
    const repoStore = req.app.locals.repoStore;
    const allRepos = repoStore.getAll();

    // Filter by user's GitHub token (only show user's repos)
    const userRepos = allRepos.filter(repo => repo.githubToken === session.accessToken);

    res.json({
      success: true,
      repositories: userRepos.map(repo => ({
        repoFullName: repo.repoFullName,
        documentTitle: repo.documentTitle,
        documentId: repo.documentId,
        connectedAt: repo.connectedAt,
        lastUpdated: repo.lastUpdated
      }))
    });
  } catch (error) {
    console.error('Error fetching connected repositories:', error);
    res.status(500).json({
      error: 'Failed to fetch connected repositories',
      message: error.message
    });
  }
});

/**
 * Disconnect (remove) a repository
 */
router.delete('/disconnect/:repoFullName', async (req, res) => {
  try {
    const { repoFullName } = req.params;
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    // Get session
    const sessionStore = req.app.locals.sessionStore;
    const session = await sessionStore.get(sessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    // Get repo from store
    const repoStore = req.app.locals.repoStore;
    const repo = repoStore.get(decodeURIComponent(repoFullName));

    if (!repo) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    // Verify ownership
    if (repo.githubToken !== session.accessToken) {
      return res.status(403).json({ error: 'Not authorized to disconnect this repository' });
    }

    // Remove from sync service
    const syncService = req.app.locals.syncService;
    if (syncService) {
      syncService.removeRepository(decodeURIComponent(repoFullName));
    }

    // Remove from store
    await repoStore.delete(decodeURIComponent(repoFullName));

    console.log(`✅ Disconnected repository: ${repoFullName}`);

    res.json({
      success: true,
      message: `Repository ${repoFullName} disconnected`
    });
  } catch (error) {
    console.error('Error disconnecting repository:', error);
    res.status(500).json({
      error: 'Failed to disconnect repository',
      message: error.message
    });
  }
});

/**
 * Get sync service status
 */
router.get('/sync-status', (req, res) => {
  const syncService = req.app.locals.syncService;
  const repoStore = req.app.locals.repoStore;

  if (!syncService) {
    return res.json({
      isRunning: false,
      connectedRepos: repoStore.size,
      message: 'Sync service not initialized'
    });
  }

  res.json(syncService.getStatus());
});

export default router;

