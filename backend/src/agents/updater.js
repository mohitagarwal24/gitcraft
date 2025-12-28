import GitHubIntegration from '../integrations/github.js';
import CraftIntegration from '../integrations/craft.js';
import CraftAdvancedIntegration from '../integrations/craft-advanced.js';
import LLMIntegration from '../integrations/llm.js';

class DocumentationUpdater {
  constructor(githubToken, craftMcpUrl) {
    this.github = new GitHubIntegration(githubToken);
    this.craft = new CraftIntegration(craftMcpUrl);
    this.craftAdvanced = new CraftAdvancedIntegration(craftMcpUrl);
    this.llm = new LLMIntegration();
  }

  /**
   * Process repository update from PR merge
   */
  async processUpdate(updateData) {
    const { owner, repo, prNumber, branch } = updateData;

    try {
      console.log(`🔄 Processing update for ${owner}/${repo} PR#${prNumber}...`);

      // Step 1: Get PR details
      console.log('📥 Fetching PR details...');
      const prData = await this.getPRData(owner, repo, prNumber);

      // Step 2: Analyze changes with LLM
      console.log('🤖 Analyzing changes...');
      const analysis = await this.llm.analyzePRChanges(prData);

      // Step 3: Get current documentation state
      console.log('📖 Loading current documentation...');
      const state = await this.getDocumentationState(`${owner}/${repo}`);

      // Step 4: Create snapshot
      console.log('📸 Creating documentation snapshot...');
      await this.createSnapshot(state, prNumber);

      // Step 5: Update documentation
      console.log('✍️  Updating documentation...');
      await this.updateDocumentation(state, analysis, prData);

      // Step 6: Update state
      console.log('💾 Updating state...');
      await this.updateState(state, prNumber);

      console.log('✅ Update complete!');

      return {
        success: true,
        prNumber,
        analysis,
        message: 'Documentation updated successfully'
      };
    } catch (error) {
      console.error('❌ Update failed:', error);
      throw error;
    }
  }

  /**
   * Process repository update from PR merge using collections API
   * @param {Object} updateData - { owner, repo, prNumber, documentId, collectionIds }
   */
  async processUpdateWithCollections(updateData) {
    const { owner, repo, prNumber, documentId, collectionIds } = updateData;

    if (!collectionIds && !documentId) {
      console.log('⚠️  No document or collection IDs provided, skipping updates');
      return { success: false, message: 'No document or collection IDs' };
    }

    try {
      console.log(`🔄 Processing PR#${prNumber} for ${owner}/${repo} (collections)...`);

      // Step 1: Get PR details
      console.log('📥 Fetching PR details...');
      const prData = await this.getPRData(owner, repo, prNumber);

      // Step 2: Analyze changes with LLM
      console.log('🤖 Analyzing changes...');
      const analysis = await this.llm.analyzePRChanges(prData);

      // Step 3: Update collections based on analysis
      console.log('📝 Updating collections...');

      // Always add doc history entry for major changes
      if (collectionIds.docHistory) {
        await this.craftAdvanced.addDocHistoryEntry(collectionIds.docHistory, {
          event: `PR #${prNumber} Merged: ${prData.title}`,
          description: analysis.summary || prData.title,
          prNumber: prNumber,
          confidence: `${Math.round((analysis.confidence || 0.5) * 100)}%`
        });
      }

      // Add release note only for MAJOR changes (major features, breaking changes, etc.)
      const isMajorChange = analysis.impactLevel === 'major' ||
        analysis.breakingChanges === true ||
        (analysis.changeType === 'feature' && analysis.publicAPIChanges);

      if (collectionIds?.releaseNotes && isMajorChange) {
        const version = this.calculateVersion(analysis.impactLevel);
        await this.craftAdvanced.addReleaseNote(collectionIds.releaseNotes, {
          version,
          title: prData.title,
          summary: analysis.summary,
          prNumber: prNumber,
          changes: (analysis.documentationUpdates || []).join('; ')
        });
        console.log('  ✓ Release note added (major change)');
      }

      // Add ADR only if architecture change detected
      if (collectionIds.adrs && analysis.requiresADR) {
        const adrNumber = Date.now(); // Simple unique ID
        await this.craftAdvanced.addADREntry(collectionIds.adrs, {
          adrId: `ADR-${String(adrNumber).slice(-4)}`,
          title: `PR#${prNumber}: ${analysis.keyDecisions?.[0] || prData.title}`,
          status: 'Accepted',
          context: analysis.technicalDetails || prData.body,
          decision: analysis.summary,
          consequences: {
            positive: analysis.documentationUpdates || [],
            negative: [],
            risks: analysis.securityImplications !== 'None' ? [analysis.securityImplications] : []
          },
          confidence: Math.round((analysis.confidence || 0.5) * 100)
        });
      }

      // Add follow-up tasks if any
      if (collectionIds.engineeringTasks && analysis.followUpTasks?.length > 0) {
        await this.craftAdvanced.addTasks(collectionIds.engineeringTasks,
          analysis.followUpTasks.map(task => ({
            task: task,
            priority: 'Medium',
            category: `From PR#${prNumber}`,
            reasoning: 'Generated from PR analysis'
          }))
        );
      }

      // Update main document - always update for all merged PRs
      // Every merged PR is significant enough to document
      const shouldUpdateDoc = true;

      console.log(`  📊 PR Document update check: documentId=${documentId}, shouldUpdate=${shouldUpdateDoc}, impactLevel=${analysis.impactLevel}, changeType=${analysis.changeType}`);

      if (documentId && shouldUpdateDoc) {
        await this.updateMainDocumentSections(documentId, prNumber, analysis);
      }

      console.log('✅ Collection update complete!');

      return {
        success: true,
        prNumber,
        analysis,
        message: 'Collections updated successfully'
      };
    } catch (error) {
      console.error('❌ Collection update failed:', error);
      throw error;
    }
  }

  /**
   * Generate markdown content for major document updates
   */
  generateDocumentUpdateSection(prNumber, analysis) {
    const date = new Date().toISOString().split('T')[0];
    const sections = [];

    // Header
    sections.push(`\n---\n## 📝 Update: PR #${prNumber} (${date})\n`);

    // Summary
    if (analysis.summary) {
      sections.push(`**Summary:** ${analysis.summary}\n`);
    }

    // New technologies
    if (analysis.newTechnologies?.length > 0) {
      sections.push(`### New Technologies\n${analysis.newTechnologies.map(t => `- ${t}`).join('\n')}\n`);
    }

    // Architecture changes
    if (analysis.architectureChanges) {
      sections.push(`### Architecture Changes\n${analysis.architectureChanges}\n`);
    }

    // Breaking changes
    if (analysis.breakingChanges) {
      sections.push(`### ⚠️ Breaking Changes\n${typeof analysis.breakingChanges === 'string' ? analysis.breakingChanges : 'See PR for details'}\n`);
    }

    // Documentation updates
    if (analysis.documentationUpdates?.length > 0) {
      sections.push(`### Documentation Updates\n${analysis.documentationUpdates.map(u => `- ${u}`).join('\n')}\n`);
    }

    // Only return if we have meaningful content beyond header
    return sections.length > 1 ? sections.join('\n') : null;
  }

  /**
   * Intelligently update main document sections based on change type
   */
  async updateMainDocumentSections(documentId, prNumber, analysis) {
    console.log('  📝 Updating main document sections...');
    console.log(`     documentId: ${documentId}`);
    console.log(`     prNumber: ${prNumber}`);
    console.log(`     newTechnologies: ${JSON.stringify(analysis.newTechnologies)}`);
    console.log(`     architectureChanges: ${!!analysis.architectureChanges}`);
    console.log(`     publicAPIChanges: ${!!analysis.publicAPIChanges}`);
    console.log(`     breakingChanges: ${analysis.breakingChanges}`);

    try {
      let updatedSomething = false;

      // 1. If new technologies detected, update Tech Stack section
      if (analysis.newTechnologies?.length > 0) {
        const techSection = `## Tech Stack\n\n**Updated from PR #${prNumber}**\n\n${analysis.newTechnologies.map(t => `- ${t}`).join('\n')}\n`;
        await this.craftAdvanced.updateMainDocument(documentId, {
          sectionToUpdate: 'Tech Stack',
          deletePattern: '## Tech Stack',
          newContent: techSection,
          appendIfNotFound: true
        });
        console.log('  ✓ Updated Tech Stack section');
        updatedSomething = true;
      }

      // 2. If architecture changes, update Architecture section
      if (analysis.architectureChanges) {
        const archSection = `## Architecture\n\n**Updated from PR #${prNumber}**\n\n${analysis.architectureChanges}\n`;
        await this.craftAdvanced.regenerateDocumentSection(documentId, 'Architecture', archSection);
        console.log('  ✓ Updated Architecture section');
      }

      // 3. If API changes, update API Documentation section
      if (analysis.publicAPIChanges) {
        const apiSection = `## API Changes (PR #${prNumber})\n\n${JSON.stringify(analysis.publicAPIChanges, null, 2)}\n`;
        await this.craftAdvanced.updateMainDocument(documentId, {
          newContent: apiSection,
          appendIfNotFound: true
        });
        console.log('  ✓ Added API changes section');
      }

      // 4. If breaking changes, add a warning section
      if (analysis.breakingChanges) {
        const breakingSection = `\n---\n\n## ⚠️ Breaking Changes (PR #${prNumber})\n\n${typeof analysis.breakingChanges === 'string' ? analysis.breakingChanges : 'See PR for details'}\n`;
        await this.craftAdvanced.updateMainDocument(documentId, {
          newContent: breakingSection,
          appendIfNotFound: true
        });
        console.log('  ✓ Added breaking changes warning');
      }

      // 5. Always add an update log entry
      const updateLog = `\n---\n\n### 📝 Update: PR #${prNumber} (${new Date().toISOString().split('T')[0]})\n\n**Summary:** ${analysis.summary || 'No summary'}\n`;
      await this.craftAdvanced.updateMainDocument(documentId, {
        newContent: updateLog,
        appendIfNotFound: true
      });

      console.log('  ✓ Main document sections updated');
      return true;
    } catch (error) {
      console.error('  ❌ Failed to update main document sections:', error.message);
      return false;
    }
  }

  /**
   * Generate markdown content for commit-based updates
   */
  generateCommitUpdateSection(commits, significance) {
    const date = new Date().toISOString().split('T')[0];
    const latestSha = commits[0]?.sha?.substring(0, 7) || 'unknown';
    const sections = [];

    // Header
    sections.push(`\n---\n## 📝 Update: Commits (${date})\n`);
    sections.push(`**Latest Commit:** ${latestSha}\n`);

    // Summary
    if (significance.summary) {
      sections.push(`**Summary:** ${significance.summary}\n`);
    }

    // Commit messages
    if (commits.length > 0) {
      const commitList = commits.slice(0, 5).map(c =>
        `- \`${c.sha.substring(0, 7)}\` ${c.message.split('\n')[0]}`
      ).join('\n');
      sections.push(`### Commits\n${commitList}\n`);
    }

    // Impact
    if (significance.impactLevel) {
      sections.push(`**Impact Level:** ${significance.impactLevel}\n`);
    }

    return sections.length > 2 ? sections.join('\n') : null;
  }

  /**
   * Process commit updates using collections (new approach)
   * Adds doc history and relevant collection entries based on commit analysis
   */
  async processCommitWithCollections(updateData) {
    const { owner, repo, commits, commitDetails, significance, collectionIds } = updateData;

    console.log(`🔄 Processing commit update with collections for ${owner}/${repo}...`);

    try {
      // Create a summary of commits
      const commitSummary = commits.slice(0, 5).map(c => c.message.split('\n')[0]).join('; ');
      const latestCommitSha = commits[0].sha.substring(0, 7);

      // Add doc history entry
      if (collectionIds.docHistory) {
        await this.craftAdvanced.addDocHistoryEntry(collectionIds.docHistory, {
          event: `Commits: ${latestCommitSha}`,
          description: commitSummary,
          prNumber: 0,
          confidence: `${Math.round((significance.confidence || 0.7) * 100)}%`
        });
        console.log(`  ✓ Added doc history for commits`);
      }

      // Add release note for major commits
      if (collectionIds.releaseNotes && significance.impactLevel === 'major') {
        await this.craftAdvanced.addReleaseNote(collectionIds.releaseNotes, {
          title: `${commitSummary.substring(0, 50)}...`,
          version: 'HEAD',
          summary: significance.summary || commitSummary,
          prNumber: 0,
          changes: commitDetails.files?.slice(0, 10).map(f => f.filename).join(', ') || 'Various files'
        });
        console.log(`  ✓ Added release note for major commits`);
      }

      // Add follow-up tasks if significance suggests them
      if (collectionIds.engineeringTasks && significance.suggestedTasks?.length > 0) {
        await this.craftAdvanced.addTasks(collectionIds.engineeringTasks,
          significance.suggestedTasks.map(task => ({
            task: task,
            priority: 'Medium',
            category: 'From Commit Analysis',
            reasoning: 'Generated from commit analysis'
          }))
        );
        console.log(`  ✓ Added ${significance.suggestedTasks.length} task(s)`);
      }

      // Update main document for commits - always update since we already filtered for significance
      // The commit analysis marks isSignificant=true to get here, so we should update the doc
      const shouldUpdateCommitDoc = true; // Already filtered for significance earlier

      console.log(`  📊 Commit doc update check: documentId=${updateData.documentId}, shouldUpdate=${shouldUpdateCommitDoc}, significance=${JSON.stringify({ impactLevel: significance.impactLevel, isSignificant: significance.isSignificant, summary: significance.summary?.substring(0, 50) })}`);

      if (updateData.documentId && shouldUpdateCommitDoc) {
        const updateContent = this.generateCommitUpdateSection(commits, significance);
        if (updateContent) {
          await this.craftAdvanced.updateMainDocumentContent(updateData.documentId, updateContent);
          console.log('  ✓ Main document updated with commit changes');
        }
      }

      console.log('✅ Commit collection update complete!');
      return { success: true, commits: commits.length };
    } catch (error) {
      console.error('❌ Commit collection update failed:', error);
      throw error;
    }
  }

  /**
   * Get PR data including files changed and full discussion
   */
  async getPRData(owner, repo, prNumber) {
    try {
      // Get PR with full discussion (comments, reviews)
      const prDetails = await this.github.getPRWithDiscussion(owner, repo, prNumber);

      // Get PR files
      const files = await this.github.getPRFiles(owner, repo, prNumber);

      return {
        number: prNumber,
        title: prDetails.title,
        body: prDetails.body,
        author: prDetails.author,
        mergedAt: prDetails.mergedAt,
        files,
        discussion: prDetails.comments.discussion,
        codeReviews: prDetails.comments.codeReviews,
        reviews: prDetails.reviews,
        additions: prDetails.additions,
        deletions: prDetails.deletions
      };
    } catch (error) {
      console.error('Error getting PR data:', error);
      throw error;
    }
  }

  /**
   * Get current documentation state
   */
  async getDocumentationState(repoName) {
    try {
      // Find state document
      const stateDoc = await this.craft.findDocumentByTitle(`_agent_state - ${repoName}`);

      if (!stateDoc) {
        // Return default state if not found
        console.log('📝 No existing state found, returning defaults');
        return {
          repoName,
          lastProcessedPR: null,
          lastSync: null,
          branch: 'main',
          documentIds: {},
          analysis: { confidence: 0 }
        };
      }

      const stateContent = await this.craft.getDocument(stateDoc.uri);

      // Handle case where document content is not available
      if (!stateContent || !stateContent.contents || !stateContent.contents[0]) {
        return {
          repoName,
          lastProcessedPR: null,
          lastSync: null,
          branch: 'main',
          documentIds: {},
          analysis: { confidence: 0 },
          stateDocId: stateDoc.uri
        };
      }

      const state = JSON.parse(stateContent.contents[0].text);

      return {
        ...state,
        stateDocId: stateDoc.uri
      };
    } catch (error) {
      console.error('Error getting documentation state:', error.message);
      // Return default state on error
      return {
        repoName,
        lastProcessedPR: null,
        lastSync: null,
        branch: 'main',
        documentIds: {},
        analysis: { confidence: 0 }
      };
    }
  }

  /**
   * Create documentation snapshot
   * Note: Snapshots are logged but not stored in Craft (no createSnapshot method available)
   */
  async createSnapshot(state, prNumber) {
    try {
      const documents = {};

      // Get current content of all documents
      if (state.documentIds) {
        for (const [key, docId] of Object.entries(state.documentIds)) {
          try {
            const doc = await this.craft.getDocument(docId);
            if (doc?.contents?.[0]?.text) {
              documents[key] = doc.contents[0].text;
            }
          } catch (error) {
            // Document may not exist, skip silently
          }
        }
      }

      // Log snapshot creation (Craft MCP doesn't have a snapshot API)
      console.log(`  ✓ Snapshot recorded for ${prNumber || 'update'} (${Object.keys(documents).length} docs)`);
    } catch (error) {
      // Don't fail the entire update if snapshot fails
      console.warn('Snapshot skipped:', error.message);
    }
  }

  /**
   * Update documentation based on analysis
   */
  async updateDocumentation(state, analysis, prData) {
    try {
      // Update Release Notes
      if (state.documentIds?.releaseNotes) {
        await this.updateReleaseNotes(
          state.documentIds.releaseNotes,
          analysis,
          prData
        );
        console.log('  ✓ Release notes updated');
      }

      // Update Technical Spec if modules affected
      if (state.documentIds?.techSpec && analysis.affectedModules?.length > 0) {
        await this.updateTechSpecForChanges(
          state.documentIds.techSpec,
          analysis,
          prData
        );
        console.log('  ✓ Technical specification updated');
      }

      // Create ADR if needed
      if (analysis.requiresADR) {
        await this.createADRForPR(analysis, prData);
        console.log('  ✓ ADR created');
      }

      // Update tasks
      if (state.documentIds?.tasks && analysis.followUpTasks?.length > 0) {
        await this.addFollowUpTasks(
          state.documentIds.tasks,
          analysis.followUpTasks,
          prData
        );
        console.log('  ✓ Tasks updated');
      }
    } catch (error) {
      console.error('Error updating documentation:', error);
      throw error;
    }
  }

  /**
   * Update release notes with new entry
   */
  async updateReleaseNotes(docId, analysis, prData) {
    const version = this.calculateVersion(analysis.impactLevel);
    const date = new Date().toISOString().split('T')[0];

    await this.craft.appendReleaseNotes(docId, {
      version,
      title: prData.title,
      description: analysis.summary,
      prNumber: prData.number,
      changes: analysis.documentationUpdates || [analysis.summary]
    });
  }

  /**
   * Calculate semantic version based on impact
   */
  calculateVersion(impactLevel) {
    // This is simplified - in production, you'd track actual versions
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    switch (impactLevel) {
      case 'major':
        return `v${year}.${month}.0`;
      case 'minor':
        return `v${year}.${month}.${day}`;
      case 'patch':
      default:
        return `v${year}.${month}.${day}-patch`;
    }
  }

  /**
   * Update technical specification for changes
   */
  async updateTechSpecForChanges(docId, analysis, prData) {
    try {
      const currentDoc = await this.craft.getDocument(docId);
      const currentContent = currentDoc.contents[0].text;

      // Add update section
      const updateSection = `

---

## Recent Updates

### ${new Date().toISOString().split('T')[0]} - PR #${prData.number}: ${prData.title}

**Impact**: ${analysis.impactLevel}
**Affected Modules**: ${analysis.affectedModules.join(', ')}

${analysis.summary}

${analysis.publicAPIChanges ? '⚠️ **Public API Changes**: Yes' : ''}

**Documentation Updates**:
${analysis.documentationUpdates.map(u => `- ${u}`).join('\n')}
`;

      const updatedContent = currentContent + updateSection;
      await this.craft.updateDocument(docId, updatedContent);
    } catch (error) {
      console.error('Error updating tech spec:', error);
      throw error;
    }
  }

  /**
   * Create ADR for significant changes
   */
  async createADRForPR(analysis, prData) {
    try {
      const adrNumber = String(Date.now()).slice(-3); // Simple numbering
      const adrTitle = `ADR-${adrNumber}: ${prData.title}`;

      const adrContent = await this.llm.generateADR(prData, analysis);

      await this.craft.createADR(adrTitle, adrContent);
    } catch (error) {
      console.error('Error creating ADR:', error);
      // Don't fail the entire update
    }
  }

  /**
   * Add follow-up tasks
   */
  async addFollowUpTasks(docId, tasks, prData) {
    try {
      const currentDoc = await this.craft.getDocument(docId);
      const currentContent = currentDoc.contents[0].text;

      const taskSection = `

## Follow-up from PR #${prData.number}

${tasks.map(task => `- [ ] ${task}`).join('\n')}

*Added: ${new Date().toISOString().split('T')[0]}*
`;

      const updatedContent = currentContent + taskSection;
      await this.craft.updateDocument(docId, updatedContent);
    } catch (error) {
      console.error('Error adding tasks:', error);
    }
  }

  /**
   * Update state document
   * Note: Only updates if a state document already exists - won't create one
   */
  async updateState(state, prNumber) {
    try {
      const updatedState = {
        ...state,
        lastProcessedPR: prNumber,
        lastSync: new Date().toISOString()
      };

      // Remove stateDocId before saving
      const { stateDocId, ...stateToSave } = updatedState;

      // Only update if we have a valid state document ID
      if (!stateDocId) {
        console.log('  ⚠️  No state document found - skipping state update to Craft');
        return;
      }

      await this.craft.updateDocument(
        stateDocId,
        JSON.stringify(stateToSave, null, 2)
      );
    } catch (error) {
      console.error('Error updating state:', error);
      // Don't fail if state update fails
    }
  }

  /**
   * Process repository update from direct commits (not PR)
   */
  async processCommitUpdate(updateData) {
    const { owner, repo, commits, commitDetails, significance, branch } = updateData;

    try {
      console.log(`🔄 Processing commit update for ${owner}/${repo}...`);

      // Create a PR-like data structure for consistency
      const commitData = {
        number: null, // No PR number for direct commits
        title: commits[commits.length - 1].message.split('\n')[0], // First line of commit message
        body: commits.map(c => `${c.sha.substring(0, 7)}: ${c.message}`).join('\n'),
        author: commits[commits.length - 1].author,
        mergedAt: new Date().toISOString(),
        files: commitDetails.files,
        additions: commitDetails.stats?.additions || 0,
        deletions: commitDetails.stats?.deletions || 0
      };

      // Use the significance analysis instead of running LLM again
      const analysis = {
        changeType: significance.changeType,
        impactLevel: 'patch', // Direct commits are usually patches
        affectedModules: significance.affectedModules,
        publicAPIChanges: false,
        breakingChanges: false,
        requiresADR: false,
        summary: significance.reasoning,
        technicalDetails: `Direct commit to ${branch}: ${commitData.title}`,
        userImpact: 'Minor update',
        documentationUpdates: [`Updated based on commit: ${commitData.title}`],
        followUpTasks: [],
        securityImplications: 'None',
        performanceImpact: 'None',
        keyDecisions: [],
        confidence: significance.confidence
      };

      // Get current documentation state
      console.log('📖 Loading current documentation...');
      const state = await this.getDocumentationState(`${owner}/${repo}`);

      // Create snapshot
      console.log('📸 Creating documentation snapshot...');
      await this.createSnapshot(state, `commit-${commits[commits.length - 1].sha.substring(0, 7)}`);

      // Update documentation
      console.log('✍️  Updating documentation...');
      await this.updateDocumentation(state, analysis, commitData);

      // Update state
      console.log('💾 Updating state...');
      await this.updateState(state, null); // No PR number for commits

      console.log('✅ Commit update complete!');

      return {
        success: true,
        commits: commits.length,
        analysis,
        message: 'Documentation updated from commits'
      };
    } catch (error) {
      console.error('❌ Commit update failed:', error);
      throw error;
    }
  }

  /**
   * Check for new PRs and process updates
   * @param {string} owner - Repository owner
   * @param {string} repo - Repository name
   * @param {string} branch - Branch to check
   * @param {Object} syncState - State from database: { lastSyncedAt, lastProcessedPR, collectionIds }
   */
  async checkForUpdates(owner, repo, branch = 'main', syncState = {}) {
    try {
      // Use passed-in state from database, fallback to Craft state for backwards compatibility
      let lastPR = syncState.lastProcessedPR;
      let lastSync = syncState.lastSyncedAt;
      const collectionIds = syncState.collectionIds;

      // If no state passed, try to get from Craft (backwards compatibility)
      if (lastPR === undefined && lastSync === undefined) {
        const state = await this.getDocumentationState(`${owner}/${repo}`);
        lastPR = state.lastProcessedPR || 0;
        lastSync = state.lastSync;
      }

      // Ensure lastPR is a number
      lastPR = lastPR || 0;

      let prCount = 0;
      let commitCount = 0;
      const processedPRs = [];
      const processedCommits = [];

      // 1. Check for new merged PRs
      console.log(`🔍 Checking for new PRs in ${owner}/${repo}...`);
      const prs = await this.github.listPullRequests(owner, repo, 'closed');
      const newPRs = prs.filter(pr => pr.number > lastPR);

      console.log(`  Found ${newPRs.length} new PRs to process`);

      for (const pr of newPRs) {
        try {
          // Use collection-based updates if collectionIds are available
          if (collectionIds) {
            await this.processUpdateWithCollections({
              owner,
              repo,
              prNumber: pr.number,
              documentId: syncState.documentId,
              collectionIds
            });
          } else {
            // Fall back to legacy markdown-based updates
            await this.processUpdate({
              owner,
              repo,
              prNumber: pr.number,
              branch: pr.baseBranch
            });
          }
          prCount++;
          processedPRs.push(pr.number);
        } catch (err) {
          console.error(`  ❌ Failed to process PR #${pr.number}:`, err.message);
        }
      }

      // 2. Check for new commits (since last sync)
      console.log(`🔍 Checking for new commits in ${owner}/${repo}...`);
      try {
        const commits = await this.github.listRecentCommits(owner, repo, branch, lastSync);

        // Filter out merge commits (usually from PRs) and only keep direct commits
        const directCommits = commits.filter(c => !c.message.startsWith('Merge '));

        if (directCommits.length > 0 && lastSync) {
          // Only process if we have a lastSync (otherwise we'd process all commits on first run)
          console.log(`  Found ${directCommits.length} new commits to process`);

          // Get commit details for significance analysis
          const latestCommit = directCommits[0];
          const commitDetails = await this.github.getCommit(owner, repo, latestCommit.sha);

          // Analyze significance
          const significance = await this.llm.analyzeCommitSignificance(
            directCommits.slice(0, 10).map(c => ({
              sha: c.sha,
              message: c.message,
              author: c.author
            })),
            commitDetails.files || []
          );

          if (significance.isSignificant) {
            console.log(`  🤖 Commits are significant, updating documentation...`);

            // Use collection-based updates if collectionIds are available (like PRs)
            if (collectionIds) {
              await this.processCommitWithCollections({
                owner,
                repo,
                commits: directCommits.slice(0, 10),
                commitDetails,
                significance,
                documentId: syncState.documentId,
                collectionIds
              });
            } else {
              // Fall back to legacy markdown-based updates
              await this.processCommitUpdate({
                owner,
                repo,
                commits: directCommits.slice(0, 10),
                commitDetails,
                significance,
                branch
              });
            }

            commitCount = directCommits.length;
            processedCommits.push(...directCommits.slice(0, 10).map(c => c.sha.substring(0, 7)));
          } else {
            console.log(`  ⏭️  Commits are trivial, skipping update`);
          }
        } else if (!lastSync) {
          console.log(`  ⏭️  First sync - skipping commit processing (will start from next sync)`);
        } else {
          console.log(`  No new commits found`);
        }
      } catch (err) {
        console.error(`  ⚠️  Error checking commits:`, err.message);
        // Continue even if commit check fails
      }

      return {
        processed: prCount + (commitCount > 0 ? 1 : 0),
        prs: processedPRs,
        commits: processedCommits,
        prCount,
        commitCount,
        // Return highest processed PR number for database update
        highestPR: processedPRs.length > 0 ? Math.max(...processedPRs) : lastPR
      };
    } catch (error) {
      console.error('Error checking for updates:', error);
      throw error;
    }
  }
}

export default DocumentationUpdater;

