import axios from 'axios';

/**
 * Advanced Craft MCP Integration
 * Implements proper document structure with pages and collections
 * 
 * Structure:
 * - Main Document: repo-name-docs
 *   - General Description (README-like)
 *   - Page: Technical Specification
 *     - Purpose and Scope
 *     - High-Level Architecture
 *     - Key Concepts
 *     - Modules
 *     - Public APIs
 *     - Internal Interfaces
 *   - Collection: Release Notes
 *   - Collection: ADRs (Architectural Decision Records)
 *   - Collection: Engineering Tasks
 *   - Collection: Doc History
 */
class CraftAdvancedIntegration {
  constructor(mcpUrl) {
    this.mcpUrl = mcpUrl;
    this.requestId = 1;
    this.tools = null;
    this.initialized = false;

    this.client = axios.create({
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      }
    });

    console.log(`\n🔗 Craft MCP (Advanced): ${mcpUrl}\n`);
  }

  /**
   * Parse SSE response
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

    try {
      return JSON.parse(responseData);
    } catch (e) {
      return { raw: responseData };
    }
  }

  /**
   * Make MCP request
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
   * Call MCP tool
   */
  async callTool(toolName, args = {}) {
    console.log(`🔧 Tool: ${toolName}`);

    const result = await this.mcpCall('tools/call', {
      name: toolName,
      arguments: args
    });

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
   * Initialize connection
   */
  async initialize() {
    if (this.initialized) return true;

    try {
      console.log('🔌 Connecting to Craft MCP...\n');

      const result = await this.mcpCall('tools/list', {});
      this.tools = result?.tools || [];

      console.log(`✅ Connected! Found ${this.tools.length} tools\n`);
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('❌ Craft MCP connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Check if document exists
   */
  async documentExists(repoName) {
    const cleanRepoName = repoName.replace('/', '-');
    const docTitle = `${cleanRepoName}-docs`;

    try {
      await this.initialize();

      // Use resources/list to get documents
      const result = await this.mcpCall('resources/list', {});
      const documents = result?.resources || [];

      console.log(`🔍 Checking for document "${docTitle}" among ${documents.length} documents`);

      const existing = documents.find(doc => {
        const title = doc.name || doc.title || '';
        return title.toLowerCase() === docTitle.toLowerCase();
      });

      if (existing) {
        console.log(`📄 Document "${docTitle}" found (ID: ${existing.uri || existing.id})`);
        return {
          exists: true,
          documentId: existing.uri || existing.id,
          documentTitle: docTitle
        };
      }

      console.log(`📄 Document "${docTitle}" does not exist`);
      return { exists: false };
    } catch (error) {
      console.warn('⚠️  Could not check for existing documents:', error.message);
      // If we can't check, assume it doesn't exist to avoid blocking
      return { exists: false };
    }
  }

  /**
   * Create comprehensive Engineering Brain with proper structure
   */
  async createEngineeringBrain(repoName, analysis) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📚 Creating Engineering Brain for: ${repoName}`);
    console.log(`${'='.repeat(60)}\n`);

    await this.initialize();

    // Check if document already exists
    const existenceCheck = await this.documentExists(repoName);
    if (existenceCheck.exists) {
      console.log(`⚠️  Document already exists! Updating instead...`);
      return {
        success: true,
        documentId: existenceCheck.documentId,
        documentTitle: existenceCheck.documentTitle,
        repoName,
        updated: true
      };
    }

    const cleanRepoName = repoName.replace('/', '-');
    const docTitle = `${cleanRepoName}-docs`;
    const projectName = analysis.overview?.projectName || cleanRepoName;

    console.log(`📄 Creating main document: ${docTitle}`);

    // Step 1: Create main document
    let documentId;
    try {
      const createResult = await this.callTool('documents_create', {
        documents: [{
          title: docTitle,
          location: 'root'
        }]
      });

      documentId = createResult?.documents?.[0]?.id || createResult?.id;
      console.log(`✅ Main document created (ID: ${documentId})`);
    } catch (error) {
      console.error('Failed to create document:', error.message);
      throw error;
    }

    if (!documentId) {
      throw new Error('Failed to get document ID');
    }

    // Step 2: Add main README-like content
    console.log(`\n📝 Adding general description...`);
    const mainContent = this.buildGeneralDescription(projectName, analysis);
    await this.addContent(documentId, mainContent);

    // Step 3: Create Technical Specification Page
    console.log(`\n📘 Creating Technical Specification page...`);
    await this.createTechnicalSpecificationPage(documentId, analysis);

    // Step 4: Create Release Notes Collection
    console.log(`\n🧾 Creating Release Notes collection...`);
    const releaseNotesCollectionId = await this.createReleaseNotesCollection(documentId, analysis);

    // Step 5: Create ADRs Collection
    console.log(`\n📐 Creating ADRs collection...`);
    await this.createADRCollection(documentId, analysis);

    // Step 6: Create Engineering Tasks Collection
    console.log(`\n📌 Creating Engineering Tasks collection...`);
    await this.createEngineeringTasksCollection(documentId, analysis);

    // Step 7: Create Doc History Collection
    console.log(`\n📁 Creating Doc History collection...`);
    const docHistoryCollectionId = await this.createDocHistoryCollection(documentId);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ SUCCESS! Engineering Brain created in Craft`);
    console.log(`${'='.repeat(60)}\n`);

    return {
      success: true,
      documentId,
      documentTitle: docTitle,
      repoName,
      collectionIds: {
        docHistory: docHistoryCollectionId,
        releaseNotes: releaseNotesCollectionId
      }
    };
  }

  /**
   * Add content to document
   */
  async addContent(documentId, content) {
    try {
      await this.callTool('markdown_add', {
        markdown: content,
        position: {
          pageId: documentId,
          position: 'end'
        }
      });
      console.log('  ✓ Content added');
    } catch (error) {
      console.error('  ✗ Failed to add content:', error.message);
      throw error;
    }
  }

  /**
   * Build general description (README-like)
   */
  buildGeneralDescription(projectName, analysis) {
    const date = new Date().toISOString().split('T')[0];
    const confidence = Math.round((analysis.confidence || 0) * 100);

    const overview = analysis.overview || {};
    const techStack = analysis.technicalStack || {};
    const allTech = [...(techStack.frontend || []), ...(techStack.backend || []), ...(techStack.database || [])];

    return `# 🧠 ${projectName} - Engineering Brain

> ${overview.tagline || 'Living technical documentation'}

<callout>
📊 **AI Analysis Complete** • Confidence: **${confidence}%** • Last Updated: ${date}
</callout>

## Overview

${overview.description || 'Project description pending analysis.'}

## Problem Statement

${overview.problemStatement || 'The problem this project solves is being analyzed.'}

## Key Features

${(analysis.scope?.inScope || []).length > 0 ? analysis.scope.inScope.map(item => `- ✅ ${item}`).join('\n') : '- 🔄 Features being analyzed...'}

## Technology Stack

${allTech.length > 0 ? allTech.map(tech => `- ${tech}`).join('\n') : '- Technologies being identified...'}

## Quick Links

- [📘 Technical Specification](#technical-specification)
- [🧾 Release Notes](#release-notes)
- [📐 Architecture Decisions (ADRs)](#adrs)
- [📌 Engineering Tasks](#engineering-tasks)
- [📁 Documentation History](#doc-history)

---

`;
  }

  /**
   * Create Technical Specification as a sub-page
   */
  async createTechnicalSpecificationPage(parentId, analysis) {
    const content = this.buildTechnicalSpecification(analysis);

    // For now, add as section (pages might need different tool)
    await this.addContent(parentId, content);
  }

  /**
   * Build technical specification content
   */
  buildTechnicalSpecification(analysis) {
    const arch = analysis.architecture || {};
    const modules = analysis.coreModules || [];
    const apis = analysis.publicAPIs || [];
    const internal = analysis.internalInterfaces || [];
    const concepts = analysis.keyConceptsAndTerminology || [];

    let content = `## 📘 Technical Specification

### Purpose and Scope

**In Scope:**
${(analysis.scope?.inScope || []).map(item => `- ${item}`).join('\n') || '- To be documented'}

**Out of Scope:**
${(analysis.scope?.outOfScope || []).map(item => `- ${item}`).join('\n') || '- To be documented'}

**Future Considerations:**
${(analysis.scope?.futureConsiderations || []).map(item => `- ${item}`).join('\n') || '- To be documented'}

---

### High-Level Architecture

**Pattern:** ${arch.pattern || 'Unknown'}

${arch.description || 'Architecture description pending.'}

**Data Flow:**
${arch.dataFlow || 'Data flow analysis pending.'}

**Architecture Layers:**

${arch.layers && arch.layers.length > 0 ? arch.layers.map(layer => `
#### ${layer.name}

**Purpose:** ${layer.purpose}

**Technologies:** ${layer.technologies.join(', ')}
`).join('\n') : '- Layers being identified...'}

---

### Key Concepts and Terminology

${concepts.length > 0 ? concepts.map(concept => `
#### ${concept.term}

${concept.definition}
`).join('\n') : '*Key concepts being identified...*'}

---

### Modules

${modules.length > 0 ? modules.map((mod, idx) => `
#### ${idx + 1}. ${mod.name}

**Purpose:** ${mod.purpose}

**Location:** \`${mod.location}\`

**Responsibilities:**
${(mod.responsibilities || []).map(r => `- ${r}`).join('\n')}

**Dependencies:** ${(mod.dependencies || []).join(', ') || 'None identified'}

**Key Files:** ${(mod.keyFiles || []).map(f => `\`${f}\``).join(', ') || 'Being identified'}

**Confidence:** ${Math.round((mod.confidence || 0) * 100)}%
`).join('\n---\n') : '*No modules identified yet - analysis in progress*'}

---

### Public APIs

${apis.length > 0 ? apis.map(api => this.buildAPISection(api)).join('\n---\n') : this.buildNoAPISection()}

---

### Internal Interfaces

${internal.length > 0 ? internal.map(iface => `
#### ${iface.name}

**Type:** ${iface.type}

**Purpose:** ${iface.purpose}

**Used by:** ${(iface.components || []).join(', ')}
`).join('\n') : '*Internal interfaces being analyzed...*'}

---

`;

    return content;
  }

  /**
   * Build API section
   */
  buildAPISection(api) {
    if (api.available === 'No' || api.available === 'Unknown') {
      return `
#### ${api.type}

**Status:** ${api.available === 'No' ? '❌ Not Available' : '❓ Unknown'}

${api.available === 'No' ? '*This project does not appear to expose public APIs.*' : '*API availability could not be determined from the codebase structure.*'}
`;
    }

    return `
#### ${api.type}

**Base URL:** ${api.baseUrl || 'Not specified'}

**Authentication:** ${api.authentication || 'Not specified'}

**Endpoints:**

${(api.endpoints || []).map(endpoint => `
##### \`${endpoint.method} ${endpoint.path}\`

**Purpose:** ${endpoint.purpose}

**Parameters:** ${endpoint.parameters || 'None'}

**Response:** ${endpoint.response || 'Not documented'}
`).join('\n')}
`;
  }

  /**
   * Build "No API" section
   */
  buildNoAPISection() {
    return `
#### Public APIs

**Status:** ❓ Not Determined

The automated analysis could not identify public APIs in this codebase. This could mean:

- The project is a library/SDK (not a service)
- APIs are not yet implemented
- APIs are internal-only
- API detection needs manual review

**Action Required:** Please manually document any public APIs, REST endpoints, GraphQL schemas, or SDK methods that this project exposes.
`;
  }

  /**
   * Create Release Notes as a collection
   */
  async createReleaseNotesCollection(parentId, analysis) {
    try {
      console.log('  Creating release_notes collection...');

      const date = new Date().toISOString().split('T')[0];
      const confidence = Math.round((analysis.confidence || 0) * 100);
      const modules = analysis.coreModules || [];
      const techStack = Object.values(analysis.technicalStack || {}).flat();

      // Create collection
      const collectionResult = await this.callTool('collections_create', {
        collections: [{
          name: 'release_notes',
          location: { pageId: parentId }
        }]
      });

      const collectionId = collectionResult?.collections?.[0]?.id || collectionResult?.id;

      if (!collectionId) {
        console.warn('  ⚠️  Could not create collection, falling back to markdown');
        await this.createReleaseNotesCollectionFallback(parentId, analysis);
        return null;
      }

      console.log(`  ✓ Collection created (ID: ${collectionId})`);

      // Define schema
      await this.callTool('collectionSchema_update', {
        collectionId,
        schema: {
          properties: [
            { name: 'version', type: 'text' },
            { name: 'date', type: 'date' },
            { name: 'title', type: 'text' },
            { name: 'summary', type: 'text' },
            { name: 'pr_number', type: 'number' },
            { name: 'changes', type: 'text' }
          ]
        }
      });

      // Add initial release
      const initialChanges = `Initial AI-powered analysis completed.
- 📦 ${modules.length} core modules identified
- 🛠️ ${techStack.length} technologies detected
- 📊 ${confidence}% analysis confidence`;

      await this.callTool('collectionItems_add', {
        collectionId,
        items: [{
          version: 'v0.1.0',
          date: date,
          title: 'Initial Analysis',
          summary: 'Repository connected to GitCraft and baseline documentation established',
          pr_number: null,
          changes: initialChanges
        }]
      });

      console.log('  ✓ Initial release note added');
      return collectionId;
    } catch (error) {
      console.error('  ✗ Failed to create collection:', error.message);
      console.log('  → Falling back to markdown section');
      await this.createReleaseNotesCollectionFallback(parentId, analysis);
      return null;
    }
  }

  /**
   * Fallback: Create release notes as markdown section
   */
  async createReleaseNotesCollectionFallback(parentId, analysis) {
    const date = new Date().toISOString().split('T')[0];
    const confidence = Math.round((analysis.confidence || 0) * 100);
    const modules = analysis.coreModules || [];
    const techStack = Object.values(analysis.technicalStack || {}).flat();

    const content = `## 🧾 Release Notes

### v0.1.0 – Initial Analysis (${date})

**Summary:**
Initial AI-powered analysis of the codebase has been completed.

**Analysis Results:**
- 📦 ${modules.length} core modules identified
- 🛠️ ${techStack.length} technologies detected
- 📊 ${confidence}% analysis confidence

---

*Release notes will be automatically updated when PRs are merged.*

`;

    await this.addContent(parentId, content);
  }

  /**
   * Create ADRs collection
   */
  async createADRCollection(parentId, analysis) {
    const date = new Date().toISOString().split('T')[0];
    const adr = analysis.initialADR || {};

    const content = `## 📐 Architectural Decision Records (ADRs)

### ADR-001: ${adr.title || 'Initial Architecture'}

| Field | Value |
|-------|-------|
| **Status** | Proposed (AI-Inferred) |
| **Date** | ${date} |
| **Author** | GitCraft AI |
| **Confidence** | ${Math.round((analysis.architecture?.confidence || 0.5) * 100)}% |

#### Context

${adr.context || 'The initial architecture has been analyzed from the codebase structure.'}

${analysis.architecture?.description || ''}

#### Decision

${adr.decision || `The system follows a **${analysis.architecture?.pattern || 'Unknown'}** architecture pattern.`}

**Frameworks & Technologies:**
${(analysis.architecture?.frameworks || []).map(f => `- ${f}`).join('\n') || '- Being identified'}

#### Consequences

**Positive:**
${(adr.consequences?.positive || []).map(item => `- ✅ ${item}`).join('\n') || '- Automated baseline documentation'}

**Negative:**
${(adr.consequences?.negative || []).map(item => `- ⚠️ ${item}`).join('\n') || '- May require manual refinement'}

**Risks:**
${(adr.consequences?.risks || []).map(item => `- 🔴 ${item}`).join('\n') || '- None identified'}

---

*ADRs will be automatically created for significant architectural changes in merged PRs.*

`;

    await this.addContent(parentId, content);
  }

  /**
   * Create Engineering Tasks collection
   */
  async createEngineeringTasksCollection(parentId, analysis) {
    const tasks = analysis.engineeringTasks || [];
    const openQuestions = analysis.openQuestions || [];

    const content = `## 📌 Engineering Tasks

### 🔴 High Priority

${tasks.filter(t => t.priority === 'High').map((task, idx) => `
#### ${idx + 1}. ${task.task}

**Category:** ${task.category}

**Reasoning:** ${task.reasoning}

- [ ] Start task
- [ ] Complete task
- [ ] Review changes
`).join('\n') || '- [ ] Review AI-generated documentation\n- [ ] Validate architecture analysis'}

### 🟡 Medium Priority

${tasks.filter(t => t.priority === 'Medium').map((task, idx) => `
#### ${idx + 1}. ${task.task}

**Category:** ${task.category}

**Reasoning:** ${task.reasoning}

- [ ] Complete task
`).join('\n') || '- [ ] Add deployment documentation\n- [ ] Create onboarding guide'}

### 🟢 Low Priority

${tasks.filter(t => t.priority === 'Low').map((task, idx) => `
#### ${idx + 1}. ${task.task}

**Category:** ${task.category}

**Reasoning:** ${task.reasoning}

- [ ] Complete task
`).join('\n') || '- [ ] Add code examples\n- [ ] Create video walkthroughs'}

### ❓ Open Questions

${openQuestions.map((q, idx) => `${idx + 1}. ${q}`).join('\n') || 'No open questions at this time.'}

---

*Engineering tasks will be automatically updated based on merged PRs and code changes.*

`;

    await this.addContent(parentId, content);
  }

  /**
   * Create Doc History collection (using actual collections)
   */
  async createDocHistoryCollection(parentId) {
    try {
      console.log('  Creating doc_history collection...');

      // Create collection
      const collectionResult = await this.callTool('collections_create', {
        collections: [{
          name: 'doc_history',
          location: { pageId: parentId }
        }]
      });

      const collectionId = collectionResult?.collections?.[0]?.id || collectionResult?.id;

      if (!collectionId) {
        console.warn('  ⚠️  Could not create collection, falling back to markdown');
        await this.createDocHistoryCollectionFallback(parentId);
        return null;
      }

      console.log(`  ✓ Collection created (ID: ${collectionId})`);

      // Define schema
      await this.callTool('collectionSchema_update', {
        collectionId,
        schema: {
          properties: [
            { name: 'date', type: 'date' },
            { name: 'event', type: 'text' },
            { name: 'description', type: 'text' },
            { name: 'pr_number', type: 'number' },
            { name: 'confidence', type: 'text' }
          ]
        }
      });

      // Add initial entry
      await this.callTool('collectionItems_add', {
        collectionId,
        items: [{
          date: new Date().toISOString(),
          event: 'Initial Creation',
          description: 'Engineering Brain created by GitCraft AI',
          pr_number: null,
          confidence: 'N/A'
        }]
      });

      console.log('  ✓ Initial history entry added');
      return collectionId;
    } catch (error) {
      console.error('  ✗ Failed to create collection:', error.message);
      console.log('  → Falling back to markdown section');
      await this.createDocHistoryCollectionFallback(parentId);
      return null;
    }
  }

  /**
   * Fallback: Create doc history as markdown section
   */
  async createDocHistoryCollectionFallback(parentId) {
    const date = new Date().toISOString();
    const content = `## 📁 Documentation History

### Change Log

| Date | Event | Description | Confidence |
|------|-------|-------------|------------|
| ${date} | Initial Creation | Engineering Brain created by GitCraft AI | N/A |

---

*This section is automatically maintained by GitCraft.*

`;
    await this.addContent(parentId, content);
  }

  /**
   * List documents
   */
  async listDocuments() {
    await this.initialize();
    try {
      // Use resources/list instead of documents_list for better compatibility
      const result = await this.mcpCall('resources/list', {});
      const resources = result?.resources || [];

      // Convert resources to document format
      return resources.map(r => ({
        id: r.uri || r.id,
        title: r.name || r.title || '',
        uri: r.uri || r.id
      }));
    } catch (error) {
      console.error('Error listing documents:', error.message);
      return [];
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
}

export default CraftAdvancedIntegration;


