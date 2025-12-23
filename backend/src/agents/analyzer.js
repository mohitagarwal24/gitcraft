import GitHubIntegration from '../integrations/github.js';
import CraftAdvancedIntegration from '../integrations/craft-advanced.js';
import LLMIntegration from '../integrations/llm.js';

class RepositoryAnalyzer {
  constructor(githubToken, craftMcpUrl) {
    this.github = new GitHubIntegration(githubToken);
    this.craft = new CraftAdvancedIntegration(craftMcpUrl);
    this.llm = new LLMIntegration();
  }

  /**
   * Main analysis pipeline
   * FIXED: Now runs AI analysis FIRST, then creates Craft doc with actual results
   */
  async analyzeAndGenerate(owner, repo, branch = 'main') {
    const repoFullName = `${owner}/${repo}`;
    
    console.log('\n' + '='.repeat(60));
    console.log(`🚀 GitCraft Analysis: ${repoFullName}`);
    console.log('='.repeat(60));

    try {
      // Step 1: Gather repository data FIRST
      console.log('\n📊 Step 1: Gathering repository data...');
      let repoData;
      try {
        repoData = await this.gatherRepositoryData(owner, repo, branch);
        console.log(`✅ Fetched ${repoData.fileTree?.length || 0} files`);
      } catch (ghError) {
        console.warn('⚠️ Could not fetch full repo data:', ghError.message);
        repoData = { repoName: repoFullName, owner, repo, branch };
      }

      // Step 2: Run AI Analysis BEFORE creating Craft doc
      console.log('\n🤖 Step 2: Running AI Analysis...');
      let analysis = this.createFallbackAnalysis(repoData);
      
      try {
        const aiAnalysis = await this.llm.analyzeRepository(repoData);
        analysis = { ...analysis, ...aiAnalysis };
        console.log(`✅ AI analysis complete (confidence: ${Math.round(analysis.confidence * 100)}%)`);
      } catch (llmError) {
        console.warn('⚠️ AI analysis failed, using basic analysis:', llmError.message);
      }

      // Step 3: Create Craft document WITH comprehensive AI results
      console.log('\n📝 Step 3: Creating comprehensive Engineering Brain in Craft...');
      const craftResult = await this.craft.createEngineeringBrain(repoFullName, analysis);
      
      if (!craftResult.success) {
        throw new Error('Failed to create document in Craft');
      }
      
      if (craftResult.updated) {
        console.log(`\n✅ Document "${craftResult.documentTitle}" updated in Craft!`);
      } else {
        console.log(`\n✅ Document "${craftResult.documentTitle}" created in Craft!`);
      }

      // Save connection info for tracking
      const connectionInfo = {
        repo: repoFullName,
        documentId: craftResult.documentId,
        documentTitle: craftResult.documentTitle,
        connectedAt: new Date().toISOString(),
        confidence: Math.round(analysis.confidence * 100)
      };

      console.log('\n' + '='.repeat(60));
      console.log('✅ SUCCESS! Engineering Brain created in Craft');
      console.log('='.repeat(60));
      console.log(`\n📄 Document: ${craftResult.documentTitle}`);
      console.log(`📊 Repository: ${repoFullName}`);
      console.log(`🤖 AI Confidence: ${Math.round(analysis.confidence * 100)}%`);
      console.log('');
      
      return {
        success: true,
        analysis,
        craftDocument: craftResult,
        connectionInfo,
        message: `Engineering Brain "${craftResult.documentTitle}" created in Craft!`
      };
    } catch (error) {
      console.error('\n' + '='.repeat(60));
      console.error('❌ FAILED:', error.message);
      console.error('='.repeat(60));
      throw error;
    }
  }

  /**
   * Create a basic analysis when LLM is unavailable
   */
  createFallbackAnalysis(repoData) {
    const languages = Object.keys(repoData.languages || {});
    return {
      repoName: repoData.repoName,
      projectPurpose: repoData.description || 'No description available',
      confidence: 0.3,
      architecture: {
        pattern: 'Unknown',
        frameworks: languages,
        description: 'Analysis requires AI provider configuration'
      },
      coreModules: [],
      publicInterfaces: [],
      techStack: languages,
      openQuestions: [
        'Configure GOOGLE_API_KEY to enable AI-powered analysis',
        'Review repository structure manually'
      ],
      analyzedAt: new Date().toISOString()
    };
  }

  /**
   * Gather all repository data
   */
  async gatherRepositoryData(owner, repo, branch) {
    const repoData = {
      repoName: `${owner}/${repo}`,
      owner,
      repo,
      branch
    };

    try {
      // Get file tree
      repoData.fileTree = await this.github.getRepositoryTree(owner, repo, branch);
      console.log(`  ✓ Found ${repoData.fileTree.length} files`);
    } catch (error) {
      console.warn('  ⚠ Could not fetch file tree:', error.message);
      repoData.fileTree = [];
    }

    try {
      // Get README
      repoData.readme = await this.github.getReadme(owner, repo);
      console.log(`  ✓ README found (${repoData.readme?.length || 0} chars)`);
    } catch (error) {
      console.warn('  ⚠ No README found');
      repoData.readme = null;
    }

    try {
      // Get package configuration
      repoData.packageConfig = await this.github.getPackageConfig(owner, repo);
      console.log('  ✓ Package configuration loaded');
    } catch (error) {
      console.warn('  ⚠ Could not load package config');
      repoData.packageConfig = {};
    }

    try {
      // Get languages
      repoData.languages = await this.github.getLanguages(owner, repo);
      console.log(`  ✓ Languages: ${Object.keys(repoData.languages).join(', ')}`);
    } catch (error) {
      console.warn('  ⚠ Could not fetch languages');
      repoData.languages = {};
    }

    try {
      // Get open issues (optional)
      repoData.openIssues = await this.github.getOpenIssues(owner, repo, 5);
      console.log(`  ✓ Found ${repoData.openIssues.length} open issues`);
    } catch (error) {
      console.warn('  ⚠ Could not fetch issues');
      repoData.openIssues = [];
    }

    return repoData;
  }

  /**
   * Populate Craft documentation with analysis results
   */
  async populateDocumentation(docs, analysis) {
    try {
      // Update Technical Specification
      if (docs.techSpec) {
        await this.craft.updateTechSpec(docs.techSpec.id, analysis);
        console.log('  ✓ Technical Specification updated');
      }

      // Update Release Notes
      if (docs.releaseNotes) {
        const releaseContent = this.generateInitialReleaseNote(analysis);
        await this.craft.updateDocument(docs.releaseNotes.id, releaseContent);
        console.log('  ✓ Release Notes updated');
      }

      // Update ADR
      if (docs.adrs) {
        const adrContent = this.generateInitialADR(analysis);
        await this.craft.updateDocument(docs.adrs.id, adrContent);
        console.log('  ✓ ADR updated');
      }

      // Update Tasks
      if (docs.tasks && analysis.openQuestions?.length > 0) {
        const tasksContent = this.generateTasksList(analysis);
        await this.craft.updateDocument(docs.tasks.id, tasksContent);
        console.log('  ✓ Tasks updated');
      }

      // Update state
      if (docs.state) {
        const stateContent = JSON.stringify({
          repoName: analysis.repoName,
          lastProcessedPR: null,
          lastSync: new Date().toISOString(),
          branch: 'main',
          documentIds: {
            techSpec: docs.techSpec?.id,
            releaseNotes: docs.releaseNotes?.id,
            adrs: docs.adrs?.id,
            tasks: docs.tasks?.id
          },
          analysis: {
            confidence: analysis.confidence,
            analyzedAt: analysis.analyzedAt
          }
        }, null, 2);
        await this.craft.updateDocument(docs.state.id, stateContent);
        console.log('  ✓ State updated');
      }
    } catch (error) {
      console.error('Error populating documentation:', error);
      throw error;
    }
  }

  /**
   * Generate technical specification content
   */
  generateTechSpecContent(analysis) {
    return `# Technical Specification: ${analysis.repoName}

## Overview
${analysis.projectPurpose}

*Note: This is an AI-generated analysis based on code structure.*
*Confidence: ${Math.round(analysis.confidence * 100)}%*

## Architecture
**Pattern**: ${analysis.architecture?.pattern || 'Unknown'}
**Frameworks**: ${analysis.architecture?.frameworks?.join(', ') || 'None detected'}

${analysis.architecture?.description || 'Further analysis required'}

## Core Modules

${analysis.coreModules?.map(m => `### ${m.name}
**Purpose**: ${m.description}
**Confidence**: ${Math.round(m.confidence * 100)}%`).join('\n\n') || 'No modules identified yet'}

## Public Interfaces

${analysis.publicInterfaces?.map(iface => `### ${iface.type}
${iface.description}`).join('\n\n') || 'No public interfaces identified yet'}

## Technology Stack
${analysis.techStack?.map(tech => `- ${tech}`).join('\n') || '- Analysis in progress...'}

## Open Questions
${analysis.openQuestions?.map(q => `- ${q}`).join('\n') || '- None at this time'}

---
*Last updated: ${new Date().toISOString()}*
*Generated by GitCraft*
`;
  }

  /**
   * Generate initial release note
   */
  generateInitialReleaseNote(analysis) {
    return `# Release Notes

## v0.0.0 - Initial Analysis (${new Date().toISOString().split('T')[0]})

### 🎉 Repository Connected

**Confidence Score**: ${Math.round(analysis.confidence * 100)}%

### Analysis Summary
${analysis.projectPurpose}

### Identified Components
${analysis.coreModules?.map(m => `- **${m.name}**: ${m.description}`).join('\n') || '- Analysis in progress'}

### Technology Stack
${analysis.techStack?.map(t => `- ${t}`).join('\n') || '- Detecting...'}

### Next Steps
${analysis.openQuestions?.map(q => `- [ ] ${q}`).join('\n') || '- Review generated documentation'}

---
*Generated by GitCraft on ${new Date().toISOString()}*
`;
  }

  /**
   * Generate initial ADR
   */
  generateInitialADR(analysis) {
    return `# Architectural Decision Records (ADRs)

## ADR-000: Initial Architecture Understanding

**Status**: Proposed (Inferred from code)
**Date**: ${new Date().toISOString().split('T')[0]}
**Confidence**: ${Math.round(analysis.confidence * 100)}%

### Context
This is the initial architectural understanding based on automated code analysis of the repository. 
This ADR documents the inferred architecture and serves as a baseline for future architectural decisions.

### Decision
The system appears to follow a **${analysis.architecture.pattern || 'Unknown'}** architecture pattern.

**Key Frameworks/Technologies**:
${analysis.architecture.frameworks?.map(f => `- ${f}`).join('\n') || '- None identified'}

**Architecture Description**:
${analysis.architecture.description || 'Further analysis required'}

### Identified Components
${analysis.coreModules?.map(m => `
#### ${m.name}
- **Purpose**: ${m.description}
- **Confidence**: ${Math.round(m.confidence * 100)}%
`).join('\n') || 'No components identified yet'}

### Consequences

**Positive:**
- Automated documentation provides immediate baseline understanding
- Structure allows for incremental refinement

**Uncertain:**
${analysis.openQuestions?.map(q => `- ${q}`).join('\n') || '- None identified'}

### Notes
This ADR is automatically generated and should be reviewed and validated by the engineering team. 
As the codebase evolves, this document will be updated to reflect architectural changes.

---
*Generated by GitCraft*
*Last updated: ${new Date().toISOString()}*
`;
  }

  /**
   * Generate tasks list
   */
  generateTasksList(analysis) {
    return `# Engineering Tasks

## 📋 Open Questions & Action Items

${analysis.openQuestions?.map((q, i) => `
### ${i + 1}. ${q}
- [ ] Research and document
- [ ] Update technical specification
- [ ] Review with team
`).join('\n') || '### No open questions at this time'}

## 🔍 Documentation Review

- [ ] Validate AI-generated technical specification
- [ ] Review and update architecture diagram
- [ ] Document public API endpoints
- [ ] Add deployment procedures
- [ ] Update onboarding documentation

## 📊 Confidence Improvements

Current confidence: **${Math.round(analysis.confidence * 100)}%**

To improve documentation confidence:
${analysis.coreModules?.filter(m => m.confidence < 0.8).map(m => 
  `- [ ] Add more details about ${m.name} (current: ${Math.round(m.confidence * 100)}%)`
).join('\n') || '- [ ] Add inline code documentation'}

---
*Generated by GitCraft*
*Last updated: ${new Date().toISOString()}*
`;
  }

  /**
   * Calculate confidence score
   */
  calculateConfidenceScore(analysis, repoData) {
    let score = 0.5; // Base score

    // Increase confidence with more data
    if (repoData.readme && repoData.readme.length > 100) score += 0.1;
    if (Object.keys(repoData.packageConfig).length > 0) score += 0.1;
    if (repoData.fileTree && repoData.fileTree.length > 10) score += 0.05;
    if (analysis.coreModules && analysis.coreModules.length > 0) score += 0.1;
    if (analysis.architecture && analysis.architecture.pattern !== 'Unknown') score += 0.1;

    // Decrease confidence for uncertainties
    if (analysis.openQuestions && analysis.openQuestions.length > 5) score -= 0.1;
    if (!repoData.readme) score -= 0.15;

    return Math.max(0, Math.min(1, score));
  }
}

export default RepositoryAnalyzer;

