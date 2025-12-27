import axios from 'axios';

/**
 * Craft MCP Integration
 * Creates real documents in Craft using the MCP protocol
 * 
 * Available tools (discovered from MCP):
 * - documents_create: Create documents
 * - markdown_add: Add markdown content
 * - blocks_add: Add blocks
 * - folders_create: Create folders
 * 
 * IMPORTANT: Craft MCP returns SSE format responses
 */
class CraftIntegration {
  constructor(mcpUrl) {
    this.mcpUrl = mcpUrl;
    this.requestId = 1;
    this.tools = null;
    this.initialized = false;

    // Craft MCP requires Accept header with BOTH json and event-stream
    this.client = axios.create({
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      }
    });

    console.log(`\n🔗 Craft MCP: ${mcpUrl}\n`);
  }

  /**
   * Parse SSE (Server-Sent Events) response from Craft MCP
   * Format: "event: message\ndata: {...json...}"
   */
  parseSSEResponse(responseData) {
    if (typeof responseData !== 'string') {
      return responseData;
    }

    const lines = responseData.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.substring(6);
        try {
          return JSON.parse(jsonStr);
        } catch (e) {
          console.error('Failed to parse SSE data:', e.message);
        }
      }
    }

    // Try parsing as plain JSON
    try {
      return JSON.parse(responseData);
    } catch (e) {
      return { raw: responseData };
    }
  }

  /**
   * Make MCP request to Craft
   */
  async mcpCall(method, params = {}) {
    const requestBody = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method,
      params
    };

    console.log(`📡 MCP [${method}]`);

    try {
      const response = await this.client.post(this.mcpUrl, requestBody);

      // Parse SSE response
      const parsed = this.parseSSEResponse(response.data);

      if (parsed.error) {
        throw new Error(parsed.error.message || JSON.stringify(parsed.error));
      }

      return parsed.result || parsed;
    } catch (error) {
      if (error.response) {
        const parsed = this.parseSSEResponse(error.response.data);
        console.error(`❌ MCP Error (${error.response.status}):`, parsed);
        throw new Error(`MCP Error: ${parsed?.error?.message || error.response.status}`);
      }
      throw error;
    }
  }

  /**
   * Call an MCP tool
   */
  async callTool(toolName, args = {}) {
    console.log(`🔧 Tool: ${toolName}`);

    const result = await this.mcpCall('tools/call', {
      name: toolName,
      arguments: args
    });

    // Handle tool response content
    if (result?.content) {
      for (const item of result.content) {
        if (item.type === 'text') {
          try {
            return JSON.parse(item.text);
          } catch {
            return item.text;
          }
        }
      }
    }

    return result;
  }

  /**
   * Initialize - discover available tools
   */
  async initialize() {
    if (this.initialized) return true;

    try {
      console.log('🔌 Connecting to Craft MCP...\n');

      const result = await this.mcpCall('tools/list', {});
      this.tools = result?.tools || [];

      console.log(`✅ Connected! Found ${this.tools.length} tools\n`);

      // Log key tools we'll use
      const keyTools = ['documents_create', 'markdown_add', 'blocks_add', 'folders_create'];
      for (const name of keyTools) {
        const tool = this.tools.find(t => t.name === name);
        if (tool) {
          console.log(`   ✓ ${tool.name}`);
        }
      }
      console.log('');

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('❌ Craft MCP connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Test connection
   */
  async testConnection() {
    try {
      await this.initialize();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create the Engineering Brain document structure
   */
  async createEngineeringBrainStructure(repoName) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📚 Creating Engineering Brain for: ${repoName}`);
    console.log(`${'='.repeat(60)}\n`);

    await this.initialize();

    const cleanRepoName = repoName.replace('/', '-');
    const docTitle = `${cleanRepoName}-docs`;

    // Step 1: Create the main document
    console.log(`\n📄 Creating document: ${docTitle}\n`);

    let documentId;

    try {
      const createResult = await this.callTool('documents_create', {
        documents: [{
          title: docTitle,
          location: 'root'  // Create at root level
        }]
      });

      console.log('Create result:', JSON.stringify(createResult, null, 2));

      // Extract document ID from result
      if (createResult?.documents?.[0]?.id) {
        documentId = createResult.documents[0].id;
      } else if (createResult?.id) {
        documentId = createResult.id;
      } else if (typeof createResult === 'string') {
        documentId = createResult;
      }

      console.log(`✅ Document created with ID: ${documentId}`);
    } catch (error) {
      console.error('Failed to create document:', error.message);
      throw error;
    }

    if (!documentId) {
      throw new Error('Failed to get document ID from creation response');
    }

    // Step 2: Add the Engineering Brain content using markdown
    console.log(`\n📝 Adding Engineering Brain content...\n`);

    const content = this.buildEngineeringBrainMarkdown(repoName);

    try {
      // markdown_add requires: { markdown: string, position: { pageId: string, position: "start"|"end" } }
      const addResult = await this.callTool('markdown_add', {
        markdown: content,
        position: {
          pageId: documentId,
          position: 'end'
        }
      });

      console.log('✅ Content added successfully!');
      console.log('Add result:', JSON.stringify(addResult, null, 2));
    } catch (error) {
      console.error('❌ Failed to add content:', error.message);

      // Try alternative: blocks_add
      console.log('🔄 Trying blocks_add as fallback...');
      try {
        await this.callTool('blocks_add', {
          blocks: [{
            type: 'textBlock',
            content: [{ text: content }]
          }],
          position: {
            pageId: documentId,
            position: 'end'
          }
        });
        console.log('✅ Content added via blocks_add');
      } catch (e2) {
        console.error('❌ blocks_add also failed:', e2.message);
        throw new Error(`Could not add content to document: ${error.message}`);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ SUCCESS! Document "${docTitle}" created in Craft`);
    console.log(`${'='.repeat(60)}\n`);

    return {
      success: true,
      documentId,
      documentTitle: docTitle,
      repoName
    };
  }

  /**
   * Create Engineering Brain WITH actual AI analysis results
   * This is the main method that should be used after AI analysis
   */
  async createEngineeringBrainWithAnalysis(repoName, analysis) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📚 Creating Engineering Brain with AI Results`);
    console.log(`${'='.repeat(60)}\n`);

    await this.initialize();

    const cleanRepoName = repoName.replace('/', '-');
    const docTitle = `${cleanRepoName}-docs`;

    // Build document with ACTUAL AI results
    const content = this.buildEngineeringBrainWithResults(repoName, analysis);

    console.log(`📄 Creating document: ${docTitle}`);

    let documentId;

    try {
      const createResult = await this.callTool('documents_create', {
        documents: [{
          title: docTitle,
          location: 'root'
        }]
      });

      if (createResult?.documents?.[0]?.id) {
        documentId = createResult.documents[0].id;
      }

      console.log(`✅ Document created with ID: ${documentId}`);
    } catch (error) {
      console.error('Failed to create document:', error.message);
      throw error;
    }

    if (!documentId) {
      throw new Error('Failed to get document ID');
    }

    console.log(`📝 Adding AI-analyzed content...`);

    try {
      await this.callTool('markdown_add', {
        markdown: content,
        position: {
          pageId: documentId,
          position: 'end'
        }
      });

      console.log('✅ Content added with AI analysis!');
    } catch (error) {
      console.error('❌ Failed to add content:', error.message);
      throw error;
    }

    return {
      success: true,
      documentId,
      documentTitle: docTitle,
      repoName
    };
  }

  /**
   * Build Engineering Brain WITH actual AI analysis results
   */
  buildEngineeringBrainWithResults(repoName, analysis) {
    const date = new Date().toISOString().split('T')[0];
    const confidence = Math.round((analysis.confidence || 0) * 100);
    const projectName = repoName.split('/')[1] || repoName;

    // Extract actual data from analysis
    const purpose = analysis.projectPurpose || 'No description available';
    const pattern = analysis.architecture?.pattern || 'Unknown';
    const frameworks = analysis.architecture?.frameworks?.join(', ') || 'Not detected';
    const archDesc = analysis.architecture?.description || 'Analysis pending';
    const techStack = analysis.techStack || [];
    const modules = analysis.coreModules || [];
    const interfaces = analysis.publicInterfaces || [];
    const questions = analysis.openQuestions || [];

    return `# 🧠 ${projectName} - Engineering Brain

<callout>
📊 **AI Analysis Complete** • Confidence: **${confidence}%** • ${date}
</callout>

---

## 📘 Technical Specification

### Project Overview

${purpose}

### Architecture

| Aspect | Details |
|--------|---------|
| **Pattern** | ${pattern} |
| **Frameworks** | ${frameworks} |
| **Confidence** | ${confidence}% |

${archDesc}

### Technology Stack

${techStack.length > 0 ? techStack.map(t => `✅ ${t}`).join('\n') : '🔄 *Analyzing technologies...*'}

---

## 📦 Core Modules

${modules.length > 0 ? modules.map(m => `
### ${m.name}

${m.description}

**Confidence:** ${Math.round((m.confidence || 0.5) * 100)}%
`).join('\n---\n') : '*No modules identified yet*'}

---

## 🔌 Public Interfaces

${interfaces.length > 0 ? interfaces.map(i => `
### ${i.type}

${i.description}
`).join('\n') : '*Analyzing interfaces...*'}

---

## 🧾 Release Notes

### v0.1.0 – AI Analysis Complete (${date})

<callout>
🎉 **Repository Connected!**
</callout>

**Summary:**
- 📦 ${modules.length} modules identified
- 🛠️ ${techStack.length} technologies detected  
- ❓ ${questions.length} open questions
- 📊 ${confidence}% confidence

**Key Finding:**
${purpose.substring(0, 300)}${purpose.length > 300 ? '...' : ''}

---

## 📐 ADR-000: Architecture Overview

| Field | Value |
|-------|-------|
| **Status** | Proposed (AI-Inferred) |
| **Date** | ${date} |
| **Confidence** | ${confidence}% |

### Context

This ${pattern !== 'Unknown' ? pattern + ' application' : 'repository'} has been analyzed by GitCraft AI.

### Architecture Decision

${archDesc}

### Consequences

✅ **Positive:** Immediate documentation baseline

⚠️ **Negative:** May require manual refinement

ℹ️ **Neutral:** Updates automatically with code changes

---

## ❓ Open Questions

${questions.length > 0 ? questions.map(q => `- [ ] ${q}`).join('\n') : '- [ ] Review and validate this documentation'}

---

## 📌 Engineering Tasks

### 🔴 High Priority

- [ ] Review AI-generated technical specification
- [ ] Validate architecture analysis
- [ ] Document missing APIs

### 🟡 Medium Priority

- [ ] Add deployment documentation
- [ ] Create onboarding guide
- [ ] Document environment setup

### 🟢 Low Priority

- [ ] Add code examples
- [ ] Create video walkthroughs

---

## 📁 History

| Date | Version | Change | Confidence |
|------|---------|--------|------------|
| ${date} | v0.1.0 | Initial AI Analysis | ${confidence}% |

---

<callout>
🤖 **GitCraft** - Living Documentation • Updated: ${new Date().toISOString()}
</callout>
`;
  }

  /**
   * Build the Engineering Brain markdown content (template only)
   */
  buildEngineeringBrainMarkdown(repoName) {
    const date = new Date().toISOString().split('T')[0];

    return `# 🧠 Engineering Brain

> Auto-generated documentation for **${repoName}**
> Created by GitCraft on ${date}

---

## 📘 Technical Specification

### Overview
*Analysis in progress...*

This section will contain:
- Project purpose and goals
- Key features and capabilities
- Target users and use cases

### Architecture
*Analyzing repository structure...*

- **Pattern**: To be determined
- **Frameworks**: Detecting...
- **Key Components**: Mapping...

### Modules
*Identifying core modules...*

| Module | Purpose | Status |
|--------|---------|--------|
| TBD | TBD | 🔄 Analyzing |

### APIs
*Documenting public interfaces...*

- REST endpoints
- GraphQL schemas
- SDK methods

### Open Questions
- [ ] Review generated architecture analysis
- [ ] Validate module descriptions
- [ ] Document undocumented APIs
- [ ] Add deployment diagrams

---

## 🧾 Release Notes

### v0.0.0 – Initial Analysis (${date})

**🎉 Repository Connected to GitCraft**

- ✅ Initial documentation structure created
- ✅ Repository analysis initiated
- ✅ Engineering Brain activated

**What's Next:**
- Automatic updates on PR merges
- Architecture documentation
- API documentation

---

## 📐 ADRs (Architectural Decision Records)

### ADR-000: Initial Architecture Understanding

**Status:** Proposed (Inferred from code)
**Date:** ${date}
**Author:** GitCraft AI

#### Context
This repository has been connected to GitCraft for automated documentation.
The initial architecture is being analyzed from the codebase.

#### Decision
Document the inferred architecture as a baseline, to be refined with each PR.

#### Consequences
- **Positive:** Immediate documentation baseline
- **Negative:** May require manual refinement
- **Neutral:** Will improve with each code change

---

## 📌 Engineering Tasks

### High Priority
- [ ] Review AI-generated technical specification
- [ ] Validate architecture analysis
- [ ] Add missing API documentation

### Medium Priority
- [ ] Document deployment procedures
- [ ] Add onboarding guide for new developers
- [ ] Create troubleshooting guide

### Low Priority
- [ ] Add code examples
- [ ] Create video walkthroughs
- [ ] Set up documentation versioning

---

## 📁 _doc_history

### Change Log

| Date | PR | Change | Author |
|------|-----|--------|--------|
| ${date} | - | Initial creation | GitCraft |

### Snapshots
*Automatic snapshots will be created before each documentation update.*

---

*Generated by [GitCraft](https://github.com/gitcraft) - Living Engineering Documentation*
*Last updated: ${new Date().toISOString()}*
`;
  }

  /**
   * Get available tools (for debugging)
   */
  async getAvailableTools() {
    await this.initialize();
    return this.tools;
  }

  /**
   * List all documents in the space
   */
  async listDocuments() {
    await this.initialize();
    try {
      const result = await this.callTool('documents_list', {});
      return result?.documents || [];
    } catch (error) {
      console.error('Error listing documents:', error.message);
      return [];
    }
  }

  /**
   * Find a document by title
   */
  async findDocumentByTitle(title) {
    try {
      const documents = await this.listDocuments();
      return documents.find(doc =>
        doc.title?.toLowerCase().includes(title.toLowerCase())
      );
    } catch (error) {
      console.error('Error finding document:', error.message);
      return null;
    }
  }

  /**
   * Get document content by ID
   */
  async getDocument(documentId) {
    await this.initialize();
    try {
      const result = await this.callTool('blocks_get', {
        id: documentId,
        format: 'markdown'
      });
      return result;
    } catch (error) {
      console.error('Error getting document:', error.message);
      return null;
    }
  }

  /**
   * Update document content
   */
  async updateDocument(documentId, content) {
    // Guard: don't call Craft API with invalid document ID
    if (!documentId) {
      console.warn('⚠️  updateDocument called with null/undefined documentId - skipping');
      return null;
    }

    await this.initialize();
    try {
      // First clear existing content, then add new
      const result = await this.callTool('markdown_add', {
        markdown: content,
        position: {
          pageId: documentId,
          position: 'end'
        }
      });
      return result;
    } catch (error) {
      console.error('Error updating document:', error.message);
      return null;
    }
  }
}

export default CraftIntegration;
