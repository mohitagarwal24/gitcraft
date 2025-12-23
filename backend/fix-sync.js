#!/usr/bin/env node

/**
 * Quick script to update sync.js to use SessionStore
 * Run with: node fix-sync.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const syncPath = join(process.cwd(), 'src/routes/sync.js');
let content = readFileSync(syncPath, 'utf-8');

// Replace CommonJS imports with ES modules
content = content.replace(/const express = require\('express'\);/, "import express from 'express';");
content = content.replace(/const RepositoryAnalyzer = require\('\.\.\/agents\/analyzer'\);/, "import RepositoryAnalyzer from '../agents/analyzer.js';");
content = content.replace(/const DocumentationUpdater = require\('\.\.\/agents\/updater'\);/, "import DocumentationUpdater from '../agents/updater.js';");
content = content.replace(/const GitHubIntegration = require\('\.\.\/integrations\/github'\);/, "import GitHubIntegration from '../integrations/github.js';");
content = content.replace(/const authRouter = require\('\.\/auth'\);/, "");

// Replace all authRouter.sessions.get with sessionStore.get
content = content.replace(/const session = authRouter\.sessions\.get\(sessionId\);/g,
    `const sessionStore = req.app.locals.sessionStore;\n    const session = await sessionStore.get(sessionId);`);

// Replace module.exports with export default
content = content.replace(/module\.exports = router;/, 'export default router;');

// Write back
writeFileSync(syncPath, content, 'utf-8');
console.log('✅ sync.js updated successfully');
