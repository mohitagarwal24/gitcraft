import express from 'express';
import { authLimiter } from '../middleware/security.js';
import logger from '../utils/logger.js';

const router = express.Router();

// Temporary state storage for OAuth flow (can be in-memory since it's short-lived)
const oauthStates = new Map();

/**
 * Initiate GitHub OAuth flow
 */
router.get('/github', authLimiter, (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  // Always use https in production (reverse proxies like Render/Railway may report http)
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
  const redirectUri = `${protocol}://${req.get('host')}/auth/github/callback`;
  const scope = 'repo,read:user';
  const state = generateRandomState();

  // Store state for verification (short-lived, 5 minutes)
  oauthStates.set(state, { createdAt: Date.now() });

  // Clean old states
  setTimeout(() => oauthStates.delete(state), 5 * 60 * 1000);

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;

  res.redirect(githubAuthUrl);
});

/**
 * GitHub OAuth callback
 */
router.get('/github/callback', async (req, res) => {
  const { code, state } = req.query;
  const sessionStore = req.app.locals.sessionStore;

  // Verify state
  if (!oauthStates.has(state)) {
    logger.warn('Invalid OAuth state parameter');
    return res.status(400).json({ error: 'Invalid state parameter' });
  }

  oauthStates.delete(state);

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.NODE_ENV === 'production' ? 'https' : req.protocol}://${req.get('host')}/auth/github/callback`
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error_description || 'OAuth failed');
    }

    const accessToken = tokenData.access_token;

    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    const userData = await userResponse.json();

    // Create session using SessionStore
    const sessionId = generateRandomState();
    await sessionStore.create(sessionId, {
      accessToken,
      user: {
        id: userData.id,
        login: userData.login,
        name: userData.name,
        email: userData.email
      }
    });

    logger.info(`User authenticated: ${userData.login} (${sessionId})`);

    // Redirect to frontend with session
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/connect?session=${sessionId}`);
  } catch (error) {
    logger.error('OAuth callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * Get session info
 */
router.get('/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const sessionStore = req.app.locals.sessionStore;

  const session = await sessionStore.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json({
    user: session.user,
    createdAt: session.createdAt,
    accessToken: session.accessToken // Include access token for frontend
  });
});

/**
 * Logout
 */
router.post('/logout/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const sessionStore = req.app.locals.sessionStore;

  await sessionStore.delete(sessionId);
  logger.info(`User logged out: ${sessionId}`);

  res.json({ success: true });
});

/**
 * Disconnect GitHub (logout and remove all connected repos)
 */
router.post('/disconnect/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionStore = req.app.locals.sessionStore;
    const session = await sessionStore.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get all repos connected with this session's token
    const repoStore = req.app?.locals?.repoStore;
    const syncService = req.app?.locals?.syncService;

    if (repoStore) {
      const userRepos = repoStore.getAll().filter(
        repo => repo.githubToken === session.accessToken
      );

      // Remove each repo from sync and store
      for (const repo of userRepos) {
        if (syncService) {
          syncService.removeRepository(repo.repoFullName);
        }
        await repoStore.delete(repo.repoFullName);
      }

      logger.info(`Disconnected ${userRepos.length} repositories for user ${session.user.login}`);
    }

    // Delete session
    await sessionStore.delete(sessionId);

    res.json({
      success: true,
      message: 'GitHub disconnected successfully',
      removedRepos: repoStore ? repoStore.getAll().filter(repo => repo.githubToken === session.accessToken).length : 0
    });
  } catch (error) {
    logger.error('Error disconnecting GitHub:', error);
    res.status(500).json({
      error: 'Failed to disconnect GitHub',
      message: error.message
    });
  }
});

/**
 * Generate random state for OAuth
 */
function generateRandomState() {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}

export default router;
