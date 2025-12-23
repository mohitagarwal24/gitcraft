# GitCraft - Detailed Implementation Guide

## Table of Contents
1. [System Overview](#system-overview)
2. [Phase-by-Phase Implementation](#phase-by-phase-implementation)
3. [Technical Specifications](#technical-specifications)
4. [Integration Details](#integration-details)
5. [Deployment Guide](#deployment-guide)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Minimal Onboarding Website                      │
│              (Next.js - Single Page)                         │
│              - Landing Page                                  │
│              - "Connect GitHub Repo" Button                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   GitHub OAuth Flow                          │
│              - Authenticate User                             │
│              - Request Permissions (repo:read)               │
│              - Select Repository & Branch                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Repository Analyzer Agent                       │
│              (LLM-Powered Analysis)                          │
│              - Fetch repo structure                          │
│              - Analyze code architecture                     │
│              - Infer modules & interfaces                    │
│              - Generate initial insights                     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   Craft MCP Integration                      │
│              - Create "Engineering Brain" folder             │
│              - Generate document structure                   │
│              - Populate initial content                      │
│              - Store state for tracking                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            GitHub Webhooks / Polling System                  │
│              - Listen for PR merges                          │
│              - Detect code changes                           │
│              - Trigger update pipeline                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              Continuous Update Agent                         │
│              - Interpret changes                             │
│              - Snapshot current docs                         │
│              - Update documentation                          │
│              - Generate semantic diffs                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase-by-Phase Implementation

### PHASE 1: User Onboarding (The Entry Point)

#### 1.1 Minimal Landing Page

**File**: `frontend/app/page.tsx`

**Components**:
- Hero section with compelling headline
- "Connect GitHub Repo" CTA button
- Brief explanation of what GitCraft does
- Visual preview of generated docs

**Design Principles**:
- Clean, minimal design
- Focus on single action
- No unnecessary features
- Mobile responsive

#### 1.2 GitHub OAuth Integration

**File**: `backend/src/routes/auth.js`

**Flow**:
1. User clicks "Connect GitHub Repo"
2. Redirect to GitHub OAuth
3. Request scopes:
   - `repo:read` - Read repository data
   - `pull_request:read` - Read PR information
4. Handle OAuth callback
5. Store access token securely
6. Redirect to repository selection

**Security Considerations**:
- Use state parameter to prevent CSRF
- Store tokens encrypted
- Implement token refresh logic

#### 1.3 Repository Selection

**File**: `frontend/app/connect/page.tsx`

**Features**:
- List user's repositories
- Search/filter functionality
- Branch selection (default: main)
- Validation before proceeding

#### 1.4 Craft MCP Setup

**File**: `backend/src/integrations/craft.js`

**Process**:
1. User provides Craft MCP URL
2. Validate MCP connection
3. Test write permissions
4. Create default folder structure
5. Store connection details

---

### PHASE 2: Initial Documentation Generation (The Magic Moment)

#### 2.1 Repository Analysis Agent

**File**: `backend/src/agents/analyzer.js`

**Analysis Steps**:

1. **Fetch Repository Data**
   ```javascript
   - File tree structure
   - README.md content
   - package.json / requirements.txt / go.mod
   - Folder organization
   - Top-level files
   - Open issues (optional)
   ```

2. **LLM Analysis Prompt**
   ```
   You are a senior software engineer analyzing a codebase.
   
   Repository: {repo_name}
   Language: {detected_language}
   
   File Structure:
   {file_tree}
   
   README:
   {readme_content}
   
   Package Configuration:
   {package_config}
   
   Analyze and provide:
   1. Project Purpose (2-3 sentences)
   2. Core Modules (list with descriptions)
   3. Public Interfaces (APIs, CLIs, libraries)
   4. Inferred Architecture (patterns, frameworks)
   5. Technology Stack
   6. Open Questions / Documentation Gaps
   
   Be honest about uncertainties. Mark inferences clearly.
   ```

3. **Output Structure**
   ```javascript
   {
     projectPurpose: string,
     coreModules: Array<{name, description, confidence}>,
     publicInterfaces: Array<{type, description}>,
     architecture: {
       pattern: string,
       frameworks: string[],
       confidence: number
     },
     techStack: string[],
     openQuestions: string[]
   }
   ```

#### 2.2 Documentation Structure Generator

**File**: `backend/src/agents/structureGenerator.js`

**Generated Craft Structure**:

```
📁 Engineering Brain
│
├─ 📘 Technical Specification
│   ├─ Overview
│   ├─ Architecture
│   ├─ Core Modules
│   ├─ Public APIs
│   └─ Open Questions
│
├─ 🧾 Release Notes
│   └─ v0.0.0 – Initial Analysis (YYYY-MM-DD)
│
├─ 📐 ADRs (Architectural Decision Records)
│   └─ ADR-000-initial-architecture.md
│
├─ 📌 Engineering Tasks
│   └─ (Auto-generated from open questions)
│
└─ 📁 _doc_history
    └─ _agent_state.json
```

**Implementation**:
```javascript
async function createDocumentStructure(craftMCP, repoName, analysis) {
  // Create root folder
  const rootFolder = await craftMCP.createFolder("Engineering Brain");
  
  // Create Technical Specification
  await craftMCP.createDocument({
    folder: rootFolder,
    title: "Technical Specification",
    content: generateTechSpec(analysis)
  });
  
  // Create Release Notes
  await craftMCP.createDocument({
    folder: rootFolder,
    title: "Release Notes",
    content: generateReleaseNotes(analysis)
  });
  
  // Create ADR-000
  await craftMCP.createDocument({
    folder: rootFolder,
    title: "ADR-000-initial-architecture",
    content: generateInitialADR(analysis)
  });
  
  // Create Engineering Tasks
  await craftMCP.createDocument({
    folder: rootFolder,
    title: "Engineering Tasks",
    content: generateTasks(analysis.openQuestions)
  });
  
  // Create state tracking
  await craftMCP.createDocument({
    folder: rootFolder,
    title: "_agent_state",
    content: JSON.stringify({
      lastProcessedPR: null,
      lastSync: new Date().toISOString(),
      repoName,
      branch: "main"
    })
  });
}
```

#### 2.3 Content Generation

**Technical Specification Template**:
```markdown
# Technical Specification: {repo_name}

## Overview
{project_purpose}

*Note: This is an AI-generated analysis based on code structure. 
Confidence: {confidence_score}%*

## Architecture
**Pattern**: {architecture_pattern}
**Frameworks**: {frameworks}

{architecture_description}

## Core Modules

### {module_name}
**Purpose**: {module_description}
**Location**: {module_path}
**Confidence**: {confidence}

[Repeat for each module]

## Public Interfaces

### {interface_type}
{interface_description}

## Technology Stack
- {tech_1}
- {tech_2}
- ...

## Open Questions
- {question_1}
- {question_2}
- ...

---
*Last updated: {timestamp}*
*Generated by GitCraft*
```

**ADR-000 Template**:
```markdown
# ADR-000: Initial Architecture Understanding

## Status
Proposed (Inferred from code)

## Context
This is the initial architectural understanding based on automated 
code analysis. This ADR documents the inferred architecture and 
serves as a baseline for future decisions.

## Decision
The system appears to follow a {architecture_pattern} architecture 
with the following key components:

{components_list}

## Consequences
**Positive:**
- {positive_consequence}

**Negative:**
- {negative_consequence}

**Uncertain:**
- {uncertain_area}

## Notes
This ADR is generated automatically and should be reviewed and 
updated by the engineering team.

---
*Confidence Score: {confidence}%*
*Generated: {timestamp}*
```

---

### PHASE 3: Continuous Updates (The Living System)

#### 3.1 Change Detection

**Option A: Webhooks (Recommended)**

**File**: `backend/src/routes/webhook.js`

```javascript
app.post('/webhook/github', async (req, res) => {
  // Verify webhook signature
  const signature = req.headers['x-hub-signature-256'];
  if (!verifySignature(req.body, signature)) {
    return res.status(401).send('Invalid signature');
  }
  
  const event = req.headers['x-github-event'];
  
  if (event === 'pull_request') {
    const { action, pull_request } = req.body;
    
    if (action === 'closed' && pull_request.merged) {
      // Trigger update pipeline
      await processRepositoryUpdate({
        repo: pull_request.base.repo.full_name,
        pr: pull_request.number,
        branch: pull_request.base.ref,
        changes: pull_request.changed_files
      });
    }
  }
  
  res.status(200).send('OK');
});
```

**Option B: Polling (Fallback)**

```javascript
// Run every 5 minutes
setInterval(async () => {
  const repos = await getTrackedRepositories();
  
  for (const repo of repos) {
    const lastPR = await getLastProcessedPR(repo);
    const newPRs = await github.pulls.list({
      owner: repo.owner,
      repo: repo.name,
      state: 'closed',
      sort: 'updated',
      direction: 'desc'
    });
    
    const unprocessed = newPRs.data.filter(pr => 
      pr.merged_at && pr.number > lastPR
    );
    
    for (const pr of unprocessed) {
      await processRepositoryUpdate({
        repo: repo.full_name,
        pr: pr.number,
        branch: pr.base.ref,
        changes: await getPRChanges(pr)
      });
    }
  }
}, 5 * 60 * 1000);
```

#### 3.2 Update Pipeline

**File**: `backend/src/agents/updater.js`

**Process Flow**:

1. **Interpret Change**
   ```javascript
   async function interpretChange(pr, changes) {
     const prompt = `
     Analyze this pull request and determine its impact:
     
     PR Title: ${pr.title}
     PR Description: ${pr.body}
     
     Changed Files:
     ${changes.map(f => `- ${f.filename} (+${f.additions} -${f.deletions})`).join('\n')}
     
     Determine:
     1. Type of change (feature, bugfix, refactor, docs)
     2. Impact level (major, minor, patch)
     3. Affected modules
     4. Public API changes (yes/no)
     5. Requires ADR (yes/no)
     6. Documentation updates needed
     `;
     
     return await llm.analyze(prompt);
   }
   ```

2. **Snapshot Current Docs**
   ```javascript
   async function snapshotDocumentation(craftMCP, prNumber) {
     const timestamp = new Date().toISOString();
     const snapshotFolder = `_doc_history/${timestamp}_PR-${prNumber}`;
     
     await craftMCP.createFolder(snapshotFolder);
     
     // Copy current docs
     const docs = await craftMCP.listDocuments("Engineering Brain");
     for (const doc of docs) {
       const content = await craftMCP.getDocument(doc.id);
       await craftMCP.createDocument({
         folder: snapshotFolder,
         title: `${doc.title}.snapshot`,
         content: content
       });
     }
     
     // Create changelog
     await craftMCP.createDocument({
       folder: snapshotFolder,
       title: "CHANGELOG.md",
       content: generateChangelog(prNumber)
     });
   }
   ```

3. **Update Live Docs**
   ```javascript
   async function updateDocumentation(craftMCP, analysis, pr) {
     // Update Technical Spec
     if (analysis.affectedModules.length > 0) {
       await updateTechnicalSpec(craftMCP, analysis);
     }
     
     // Append Release Notes
     await appendReleaseNotes(craftMCP, {
       version: calculateVersion(analysis.impactLevel),
       date: new Date(),
       prNumber: pr.number,
       changes: analysis.changes
     });
     
     // Create ADR if needed
     if (analysis.requiresADR) {
       await createADR(craftMCP, analysis, pr);
     }
     
     // Add tasks
     if (analysis.followUpTasks.length > 0) {
       await addEngineeringTasks(craftMCP, analysis.followUpTasks);
     }
   }
   ```

4. **Generate Semantic Diff**
   ```javascript
   async function generateSemanticDiff(before, after, pr) {
     const prompt = `
     Generate a human-readable explanation of what changed:
     
     Before:
     ${before}
     
     After:
     ${after}
     
     PR Context:
     ${pr.title}
     ${pr.body}
     
     Explain:
     - What changed and why
     - Impact on the system
     - What users/developers need to know
     `;
     
     return await llm.generate(prompt);
   }
   ```

---

### PHASE 4: Version Control & Trust

#### 4.1 Documentation History

**Structure**:
```
_doc_history/
├─ 2025-12-18_PR-42/
│   ├─ Technical-Spec.snapshot
│   ├─ Release-Notes.snapshot
│   ├─ ADRs.snapshot
│   └─ CHANGELOG.md
├─ 2025-12-19_PR-43/
│   └─ ...
└─ index.json
```

**Index File**:
```json
{
  "snapshots": [
    {
      "timestamp": "2025-12-18T10:30:00Z",
      "prNumber": 42,
      "version": "v1.2.0",
      "changes": "Added user authentication module",
      "confidence": 0.87
    }
  ]
}
```

#### 4.2 Rollback Capability

```javascript
async function rollbackToSnapshot(craftMCP, snapshotId) {
  const snapshot = await craftMCP.getFolder(`_doc_history/${snapshotId}`);
  const docs = await craftMCP.listDocuments(snapshot.id);
  
  for (const doc of docs) {
    if (doc.title.endsWith('.snapshot')) {
      const originalTitle = doc.title.replace('.snapshot', '');
      const content = await craftMCP.getDocument(doc.id);
      
      await craftMCP.updateDocument({
        title: originalTitle,
        content: content
      });
    }
  }
}
```

#### 4.3 Confidence Scoring

```javascript
function calculateConfidenceScore(analysis) {
  let score = 1.0;
  
  // Reduce confidence for inferred information
  if (analysis.hasInferredArchitecture) score *= 0.9;
  if (analysis.hasUndocumentedModules) score *= 0.85;
  if (analysis.hasAmbiguousInterfaces) score *= 0.9;
  
  // Increase confidence with more data
  if (analysis.hasReadme) score *= 1.05;
  if (analysis.hasTests) score *= 1.1;
  if (analysis.hasDocComments) score *= 1.1;
  
  return Math.min(score, 1.0);
}
```

---

## Technical Specifications

### Craft MCP Integration

**Connection Setup**:
```javascript
const craftMCP = {
  url: process.env.CRAFT_MCP_URL,
  
  async createFolder(name, parent = null) {
    // MCP call to create folder
  },
  
  async createDocument({ folder, title, content }) {
    // MCP call to create document
  },
  
  async updateDocument(id, content) {
    // MCP call to update document
  },
  
  async getDocument(id) {
    // MCP call to get document content
  },
  
  async listDocuments(folderId) {
    // MCP call to list documents
  }
};
```

**MCP Configuration** (from Craft docs):
```json
{
  "mcpServers": {
    "gitcraft": {
      "url": "<CRAFT_MCP_URL>"
    }
  }
}
```

### GitHub API Integration

**Authentication**:
```javascript
const octokit = new Octokit({
  auth: process.env.GITHUB_ACCESS_TOKEN
});
```

**Key Operations**:
```javascript
// Get repository tree
await octokit.git.getTree({
  owner,
  repo,
  tree_sha: 'main',
  recursive: true
});

// Get file content
await octokit.repos.getContent({
  owner,
  repo,
  path: 'README.md'
});

// List pull requests
await octokit.pulls.list({
  owner,
  repo,
  state: 'closed',
  sort: 'updated'
});

// Get PR files
await octokit.pulls.listFiles({
  owner,
  repo,
  pull_number: 42
});
```

### LLM Integration

**Claude Example**:
```javascript
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function analyzeRepository(repoData) {
  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: generateAnalysisPrompt(repoData)
    }]
  });
  
  return parseAnalysisResponse(message.content);
}
```

---

## Deployment Guide

### Development Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Run locally**
   ```bash
   npm run dev
   ```

### Production Deployment

**Recommended**: Vercel (Frontend) + Railway/Render (Backend)

**Frontend (Vercel)**:
```bash
cd frontend
vercel --prod
```

**Backend (Railway)**:
```bash
cd backend
railway up
```

**Environment Variables**:
- Set all `.env` variables in deployment platform
- Use secrets management for sensitive data

### GitHub Webhook Setup

1. Go to repository Settings → Webhooks
2. Add webhook:
   - URL: `https://your-backend.com/webhook/github`
   - Content type: `application/json`
   - Secret: Your webhook secret
   - Events: Pull requests

---

## Best Practices

### Security
- Never commit API keys
- Use environment variables
- Validate all webhook signatures
- Implement rate limiting
- Encrypt stored tokens

### Performance
- Cache repository data
- Batch Craft MCP operations
- Use background jobs for long operations
- Implement request queuing

### Reliability
- Implement retry logic
- Handle API rate limits
- Log all operations
- Monitor system health

### User Experience
- Show progress indicators
- Provide clear error messages
- Allow manual sync triggers
- Display confidence scores

---

## Troubleshooting

### Common Issues

**Issue**: Craft MCP connection fails
**Solution**: Verify MCP URL and permissions

**Issue**: GitHub webhook not triggering
**Solution**: Check webhook secret and endpoint accessibility

**Issue**: LLM analysis timeout
**Solution**: Reduce context size or increase timeout

**Issue**: Documentation not updating
**Solution**: Check agent state and last processed PR

---

## Future Enhancements

1. **Multi-repo support**: Track multiple repositories
2. **Custom templates**: Allow users to define doc structure
3. **AI chat interface**: "Explain this repo to me"
4. **Onboarding docs**: Auto-generate getting started guides
5. **Diff visualization**: Visual comparison of doc versions
6. **Slack/Discord notifications**: Alert on doc updates
7. **Team collaboration**: Multiple users, permissions
8. **Analytics**: Track doc usage and engagement

---

## Resources

- [Craft MCP Documentation](https://www.craft.do/imagine/guide/mcp/mcp)
- [GitHub API Documentation](https://docs.github.com/en/rest)
- [Anthropic Claude API](https://docs.anthropic.com/)
- [OpenAI API](https://platform.openai.com/docs/)

---

**Built for Craft Winter Challenge 2025**

