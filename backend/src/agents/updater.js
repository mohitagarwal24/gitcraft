import GitHubIntegration from '../integrations/github.js';
import CraftIntegration from '../integrations/craft.js';
import LLMIntegration from '../integrations/llm.js';

class DocumentationUpdater {
  constructor(githubToken, craftMcpUrl) {
    this.github = new GitHubIntegration(githubToken);
    this.craft = new CraftIntegration(craftMcpUrl);
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
   */
  async checkForUpdates(owner, repo, branch = 'main') {
    try {
      const state = await this.getDocumentationState(`${owner}/${repo}`);
      const lastPR = state.lastProcessedPR || 0;
      const lastSync = state.lastSync;

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
          await this.processUpdate({
            owner,
            repo,
            prNumber: pr.number,
            branch: pr.baseBranch
          });
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

        if (directCommits.length > 0) {
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

            await this.processCommitUpdate({
              owner,
              repo,
              commits: directCommits.slice(0, 10),
              commitDetails,
              significance,
              branch
            });

            commitCount = directCommits.length;
            processedCommits.push(...directCommits.slice(0, 10).map(c => c.sha.substring(0, 7)));
          } else {
            console.log(`  ⏭️  Commits are trivial, skipping update`);
          }
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
        commitCount
      };
    } catch (error) {
      console.error('Error checking for updates:', error);
      throw error;
    }
  }
}

export default DocumentationUpdater;

