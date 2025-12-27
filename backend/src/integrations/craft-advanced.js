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
   * Extract collection ID from various API response formats
   */
  extractCollectionId(result) {
    // Pattern 1: { collectionBlockId: ... } - Craft MCP response format
    if (result?.collectionBlockId) return result.collectionBlockId;
    // Pattern 2: { collections: [{ id: ... }] }
    if (result?.collections?.[0]?.id) return result.collections[0].id;
    // Pattern 3: { id: ... }
    if (result?.id) return result.id;
    // Pattern 4: Array response [{ id: ... }]
    if (Array.isArray(result) && result[0]?.id) return result[0].id;
    // Pattern 5: { result: { id: ... } }
    if (result?.result?.id) return result.result.id;
    // Pattern 6: { collection: { id: ... } }
    if (result?.collection?.id) return result.collection.id;
    // Pattern 7: Direct string ID
    if (typeof result === 'string') return result;

    return null;
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
   * Check if document exists in ACTIVE space (not trash)
   * Uses documents_search which typically excludes trashed documents
   * Falls back to documents_list if search fails
   * @throws Error if check fails - no assumptions, fail loudly
   */
  async documentExists(repoName) {
    const cleanRepoName = repoName.replace('/', '-');
    const docTitle = `${cleanRepoName}-docs`;

    await this.initialize();

    // Try documents_search first - this usually excludes trashed documents
    try {
      console.log(`🔍 Searching for document "${docTitle}"...`);
      const searchResult = await this.callTool('documents_search', {
        query: docTitle
      });

      const searchDocs = searchResult?.documents || searchResult?.results || [];

      if (Array.isArray(searchDocs)) {
        const existing = searchDocs.find(doc => {
          const title = doc.title || doc.name || '';
          return title.toLowerCase() === docTitle.toLowerCase();
        });

        if (existing) {
          console.log(`📄 Document "${docTitle}" found via search (ID: ${existing.id})`);
          return {
            exists: true,
            documentId: existing.id,
            documentTitle: docTitle
          };
        }
      }

      console.log(`📄 Document "${docTitle}" not found via search`);
      return { exists: false };
    } catch (searchError) {
      console.warn(`⚠️  documents_search failed: ${searchError.message}, falling back to documents_list`);
    }

    // Fallback to documents_list if search fails
    const result = await this.callTool('documents_list', {});
    const documents = result?.documents || [];

    console.log(`🔍 Checking for document "${docTitle}" among ${documents.length} documents`);

    if (!Array.isArray(documents)) {
      throw new Error(`documents_list returned invalid format: ${JSON.stringify(result)}`);
    }

    const existing = documents.find(doc => {
      const title = doc.title || doc.name || '';
      return title.toLowerCase() === docTitle.toLowerCase();
    });

    if (existing) {
      console.log(`📄 Document "${docTitle}" found (ID: ${existing.id})`);
      return {
        exists: true,
        documentId: existing.id,
        documentTitle: docTitle
      };
    }

    console.log(`📄 Document "${docTitle}" does not exist`);
    return { exists: false };
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
    const adrsCollectionId = await this.createADRCollection(documentId, analysis);

    // Step 6: Create Engineering Tasks Collection
    console.log(`\n📌 Creating Engineering Tasks collection...`);
    const tasksCollectionId = await this.createEngineeringTasksCollection(documentId, analysis);

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
        releaseNotes: releaseNotesCollectionId,
        adrs: adrsCollectionId,
        engineeringTasks: tasksCollectionId,
        docHistory: docHistoryCollectionId
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

## Document Sections

- 📘 Technical Specification
- 🧾 Release Notes
- 📐 Architecture Decisions (ADRs)
- 📌 Engineering Tasks
- 📁 Documentation History

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
    console.log('  Creating release_notes collection...');

    const date = new Date().toISOString().split('T')[0];
    const confidence = Math.round((analysis.confidence || 0) * 100);
    const modules = analysis.coreModules || [];
    const techStack = Object.values(analysis.technicalStack || {}).flat();

    // Define schema matching Craft API format
    const schema = {
      key: 'release_notes',
      name: 'Release Notes',
      contentPropDetails: {
        key: 'title',
        name: 'Title'
      },
      properties: [
        { key: 'version', name: 'Version', type: 'text' },
        { key: 'date', name: 'Date', type: 'date' },
        { key: 'summary', name: 'Summary', type: 'text' },
        { key: 'pr_number', name: 'PR Number', type: 'number' },
        { key: 'changes', name: 'Changes', type: 'text' }
      ]
    };

    // Create collection with schema and position
    const collectionResult = await this.callTool('collections_create', {
      name: 'Release Notes',
      schema: schema,
      position: { pageId: parentId, position: 'end' }
    });

    // Log the actual response to understand its format
    console.log('  collections_create raw response:', JSON.stringify(collectionResult, null, 2));

    const collectionId = this.extractCollectionId(collectionResult);

    if (!collectionId) {
      throw new Error(`Failed to create release_notes collection - could not extract ID from response: ${JSON.stringify(collectionResult)}`);
    }

    console.log(`  ✓ Release Notes collection created (ID: ${collectionId})`);

    // Add initial release - using title + properties format per API
    const initialChanges = `Initial AI-powered analysis completed. ${modules.length} modules, ${techStack.length} technologies, ${confidence}% confidence`;

    const addResult = await this.callTool('collectionItems_add', {
      collectionBlockId: collectionId,
      items: [{
        title: 'Initial Analysis',
        properties: {
          version: 'v0.1.0',
          date: date,
          summary: 'Repository connected to GitCraft and baseline documentation established',
          pr_number: 0,
          changes: initialChanges
        }
      }]
    });

    console.log('  collectionItems_add response:', JSON.stringify(addResult, null, 2));
    console.log('  ✓ Initial release note added');
    return collectionId;
  }



  /**
   * Create ADRs as a collection
   */
  async createADRCollection(parentId, analysis) {
    console.log('  Creating adrs collection...');

    const adr = analysis.initialADR || {};

    // Define schema matching Craft API format
    const schema = {
      key: 'adrs',
      name: 'Architecture Decision Records',
      contentPropDetails: {
        key: 'title',
        name: 'Title'
      },
      properties: [
        { key: 'adr_id', name: 'ADR ID', type: 'text' },
        { key: 'status', name: 'Status', type: 'text' },
        { key: 'date', name: 'Date', type: 'date' },
        { key: 'context', name: 'Context', type: 'text' },
        { key: 'decision', name: 'Decision', type: 'text' },
        { key: 'consequences', name: 'Consequences', type: 'text' },
        { key: 'confidence', name: 'Confidence', type: 'number' }
      ]
    };

    // Create collection with schema and position
    const collectionResult = await this.callTool('collections_create', {
      name: 'Architecture Decision Records',
      schema: schema,
      position: { pageId: parentId, position: 'end' }
    });

    const collectionId = this.extractCollectionId(collectionResult);

    if (!collectionId) {
      throw new Error(`Failed to create adrs collection - could not extract ID from response: ${JSON.stringify(collectionResult)}`);
    }

    console.log(`  ✓ ADRs collection created (ID: ${collectionId})`);

    // Add initial ADR entry using title + properties format
    await this.callTool('collectionItems_add', {
      collectionBlockId: collectionId,
      items: [{
        title: adr.title || 'Initial Architecture',
        properties: {
          adr_id: 'ADR-001',
          status: 'Proposed (AI-Inferred)',
          date: new Date().toISOString().split('T')[0],
          context: adr.context || 'Initial architecture analyzed from codebase structure.',
          decision: adr.decision || `System follows ${analysis.architecture?.pattern || 'Unknown'} architecture pattern.`,
          consequences: JSON.stringify(adr.consequences || { positive: [], negative: [], risks: [] }),
          confidence: Math.round((analysis.architecture?.confidence || 0.5) * 100)
        }
      }]
    });

    console.log('  ✓ Initial ADR entry added');
    return collectionId;
  }

  /**
   * Create Engineering Tasks as a collection
   */
  async createEngineeringTasksCollection(parentId, analysis) {
    console.log('  Creating engineering_tasks collection...');

    const tasks = analysis.engineeringTasks || [];
    const openQuestions = analysis.openQuestions || [];

    // Define schema matching Craft API format
    const schema = {
      key: 'engineering_tasks',
      name: 'Engineering Tasks',
      contentPropDetails: {
        key: 'title',
        name: 'Task'
      },
      properties: [
        { key: 'priority', name: 'Priority', type: 'text' },
        { key: 'category', name: 'Category', type: 'text' },
        { key: 'reasoning', name: 'Reasoning', type: 'text' },
        { key: 'status', name: 'Status', type: 'text' },
        { key: 'created_at', name: 'Created At', type: 'date' }
      ]
    };

    // Create collection with schema and position
    const collectionResult = await this.callTool('collections_create', {
      name: 'Engineering Tasks',
      schema: schema,
      position: { pageId: parentId, position: 'end' }
    });

    const collectionId = this.extractCollectionId(collectionResult);

    if (!collectionId) {
      throw new Error(`Failed to create engineering_tasks collection - could not extract ID from response: ${JSON.stringify(collectionResult)}`);
    }

    console.log(`  ✓ Engineering Tasks collection created (ID: ${collectionId})`);

    // Add default tasks if none from analysis
    const tasksToAdd = tasks.length > 0 ? tasks : [
      { task: 'Review AI-generated documentation', priority: 'High', category: 'Documentation', reasoning: 'Validate accuracy of auto-generated content' },
      { task: 'Validate architecture analysis', priority: 'High', category: 'Architecture', reasoning: 'Ensure system structure is correctly identified' },
      { task: 'Add deployment documentation', priority: 'Medium', category: 'DevOps', reasoning: 'Help new developers set up the project' }
    ];

    // Add task entries using title + properties format
    await this.callTool('collectionItems_add', {
      collectionBlockId: collectionId,
      items: tasksToAdd.map(task => ({
        title: task.task,
        properties: {
          priority: task.priority || 'Medium',
          category: task.category || 'General',
          reasoning: task.reasoning || '',
          status: 'Todo',
          created_at: new Date().toISOString().split('T')[0]
        }
      }))
    });

    console.log(`  ✓ ${tasksToAdd.length} task entries added`);

    // Add open questions as separate tasks
    if (openQuestions.length > 0) {
      await this.callTool('collectionItems_add', {
        collectionBlockId: collectionId,
        items: openQuestions.map(q => ({
          title: q,
          properties: {
            priority: 'Medium',
            category: 'Open Question',
            reasoning: 'Needs clarification',
            status: 'Todo',
            created_at: new Date().toISOString().split('T')[0]
          }
        }))
      });
      console.log(`  ✓ ${openQuestions.length} open questions added`);
    }

    return collectionId;
  }

  /**
   * Create Doc History collection
   */
  async createDocHistoryCollection(parentId) {
    console.log('  Creating doc_history collection...');

    // Define schema matching Craft API format
    const schema = {
      key: 'doc_history',
      name: 'Documentation History',
      contentPropDetails: {
        key: 'title',
        name: 'Event'
      },
      properties: [
        { key: 'date', name: 'Date', type: 'date' },
        { key: 'description', name: 'Description', type: 'text' },
        { key: 'pr_number', name: 'PR Number', type: 'number' },
        { key: 'confidence', name: 'Confidence', type: 'text' }
      ]
    };

    // Create collection with schema and position
    const collectionResult = await this.callTool('collections_create', {
      name: 'Documentation History',
      schema: schema,
      position: { pageId: parentId, position: 'end' }
    });

    const collectionId = this.extractCollectionId(collectionResult);

    if (!collectionId) {
      throw new Error(`Failed to create doc_history collection - could not extract ID from response: ${JSON.stringify(collectionResult)}`);
    }

    console.log(`  ✓ Doc History collection created (ID: ${collectionId})`);

    // Add initial entry using title + properties format
    await this.callTool('collectionItems_add', {
      collectionBlockId: collectionId,
      items: [{
        title: 'Initial Creation',
        properties: {
          date: new Date().toISOString().split('T')[0],
          description: 'Engineering Brain created by GitCraft AI',
          pr_number: 0,
          confidence: 'N/A'
        }
      }]
    });

    console.log('  ✓ Initial history entry added');
    return collectionId;
  }



  /**
   * Delete a document from Craft
   * @throws Error if deletion fails
   */
  async deleteDocument(repoName) {
    const cleanRepoName = repoName.replace('/', '-');
    const docTitle = `${cleanRepoName}-docs`;

    await this.initialize();

    // First find the document
    const existenceCheck = await this.documentExists(repoName);

    if (!existenceCheck.exists) {
      console.log(`📄 Document "${docTitle}" does not exist - nothing to delete`);
      return { deleted: false, reason: 'Document not found' };
    }

    console.log(`🗑️  Deleting document "${docTitle}" (ID: ${existenceCheck.documentId})...`);

    try {
      await this.callTool('documents_delete', {
        documentIds: [existenceCheck.documentId]
      });

      console.log(`✅ Document "${docTitle}" deleted successfully`);
      return { deleted: true, documentId: existenceCheck.documentId };
    } catch (error) {
      console.error(`❌ Failed to delete document: ${error.message}`);
      throw new Error(`Failed to delete Craft document: ${error.message}`);
    }
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

  // ============================================================
  // COLLECTION UPDATE METHODS - For PR/Commit Updates
  // ============================================================

  /**
   * Add a release note entry to existing collection
   */
  async addReleaseNote(collectionBlockId, data) {
    await this.initialize();
    const { version, title, summary, prNumber, changes } = data;

    try {
      await this.callTool('collectionItems_add', {
        collectionBlockId,
        items: [{
          title: title || `Release ${version}`,
          properties: {
            version: version,
            date: new Date().toISOString().split('T')[0],
            summary: summary,
            pr_number: prNumber || 0,
            changes: changes || ''
          }
        }]
      });
      console.log(`  ✓ Added release note: ${title}`);
      return true;
    } catch (error) {
      console.error('Failed to add release note:', error.message);
      return false;
    }
  }

  /**
   * Add an ADR entry to existing collection
   */
  async addADREntry(collectionBlockId, data) {
    await this.initialize();
    const { adrId, title, status, context, decision, consequences, confidence } = data;

    try {
      await this.callTool('collectionItems_add', {
        collectionBlockId,
        items: [{
          title: title,
          properties: {
            adr_id: adrId,
            status: status || 'Proposed',
            date: new Date().toISOString().split('T')[0],
            context: context,
            decision: decision,
            consequences: typeof consequences === 'string' ? consequences : JSON.stringify(consequences),
            confidence: confidence || 0
          }
        }]
      });
      console.log(`  ✓ Added ADR: ${title}`);
      return true;
    } catch (error) {
      console.error('Failed to add ADR:', error.message);
      return false;
    }
  }

  /**
   * Add tasks to existing engineering tasks collection
   */
  async addTasks(collectionBlockId, tasks) {
    await this.initialize();

    try {
      await this.callTool('collectionItems_add', {
        collectionBlockId,
        items: tasks.map(task => ({
          title: task.task || task.title,
          properties: {
            priority: task.priority || 'Medium',
            category: task.category || 'General',
            reasoning: task.reasoning || '',
            status: task.status || 'Todo',
            created_at: new Date().toISOString().split('T')[0]
          }
        }))
      });
      console.log(`  ✓ Added ${tasks.length} task(s)`);
      return true;
    } catch (error) {
      console.error('Failed to add tasks:', error.message);
      return false;
    }
  }

  /**
   * Add doc history entry to existing collection
   */
  async addDocHistoryEntry(collectionBlockId, data) {
    await this.initialize();
    const { event, description, prNumber, confidence } = data;

    try {
      await this.callTool('collectionItems_add', {
        collectionBlockId,
        items: [{
          title: event,
          properties: {
            date: new Date().toISOString().split('T')[0],
            description: description,
            pr_number: prNumber || 0,
            confidence: confidence || 'N/A'
          }
        }]
      });
      console.log(`  ✓ Added doc history: ${event}`);
      return true;
    } catch (error) {
      console.error('Failed to add doc history:', error.message);
      return false;
    }
  }

  /**
   * Update main document content (for major changes like tech stack)
   */
  async updateMainDocumentContent(documentId, newContent) {
    await this.initialize();

    try {
      // Add new content block
      await this.callTool('markdown_add', {
        pageId: documentId,
        markdown: newContent,
        position: 'end'
      });
      console.log('  ✓ Main document updated');
      return true;
    } catch (error) {
      console.error('Failed to update main document:', error.message);
      return false;
    }
  }
}

export default CraftAdvancedIntegration;


