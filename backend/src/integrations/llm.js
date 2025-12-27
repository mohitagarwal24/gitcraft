import { Anthropic } from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

class LLMIntegration {
  constructor() {
    this.provider = process.env.LLM_PROVIDER || 'google'; // Default to Gemini

    // Initialize based on provider
    if (this.provider === 'anthropic') {
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY is required when using Claude');
      }
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
      this.model = 'claude-3-5-sonnet-20241022';
    } else if (this.provider === 'google') {
      if (!process.env.GOOGLE_API_KEY) {
        throw new Error('GOOGLE_API_KEY is required when using Gemini. Get one free at https://makersuite.google.com/app/apikey');
      }
      this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      this.model = 'gemini-2.5-flash-lite'; // Use stable model
    }

    console.log(`🤖 LLM Provider: ${this.provider} (Model: ${this.model})`);
  }

  /**
   * Analyze repository structure and generate insights
   */
  async analyzeRepository(repoData) {
    const prompt = this.buildRepositoryAnalysisPrompt(repoData);

    try {
      let response;

      if (this.provider === 'anthropic') {
        response = await this.analyzeWithClaude(prompt);
      } else if (this.provider === 'google') {
        response = await this.analyzeWithGemini(prompt);
      } else {
        throw new Error(`Unsupported LLM provider: ${this.provider}`);
      }

      return this.parseAnalysisResponse(response, repoData);
    } catch (error) {
      console.error('Error analyzing repository:', error);
      throw new Error(`LLM analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze with Claude
   */
  async analyzeWithClaude(prompt) {
    const message = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 4096,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    return message.content[0].text;
  }

  /**
   * Analyze with Gemini
   */
  async analyzeWithGemini(prompt) {
    try {
      const model = this.gemini.getGenerativeModel({
        model: this.model,
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
        }
      });

      console.log('🔮 Sending request to Gemini...');
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      console.log(`✅ Gemini response received (${text.length} characters)`);
      return text;
    } catch (error) {
      console.error('❌ Gemini API error:', error.message);
      if (error.message.includes('API key')) {
        throw new Error('Invalid GOOGLE_API_KEY. Get a free key at: https://makersuite.google.com/app/apikey');
      }
      throw error;
    }
  }

  /**
   * Build analysis prompt for repository
   */
  buildRepositoryAnalysisPrompt(repoData) {
    const { repoName, readme, packageConfig, fileTree, languages } = repoData;

    return `You are an expert software architect analyzing a codebase to generate comprehensive, production-quality technical documentation.

**Repository**: ${repoName}

**Primary Language**: ${languages ? Object.keys(languages)[0] : 'Unknown'}

**Languages Distribution**:
${languages ? Object.entries(languages).map(([lang, bytes]) => `- ${lang}: ${Math.round(bytes / 1024)}KB`).join('\n') : 'No data'}

**File Structure** (top-level):
${this.formatFileTree(fileTree)}

**README Content**:
${readme || 'No README found'}

**Package Configuration**:
${this.formatPackageConfig(packageConfig)}

**Your Task**: Create a comprehensive technical analysis that will be used to generate professional engineering documentation in Craft CMS.

**Required Output Format** (JSON only, no markdown):

{
  "overview": {
    "projectName": "Project name extracted from repo/package.json",
    "tagline": "One sentence describing what this does",
    "description": "2-3 paragraphs explaining the project purpose, target users, and key value proposition",
    "problemStatement": "What problem does this solve?",
    "confidence": 0.0-1.0
  },
  "scope": {
    "inScope": ["Feature 1", "Feature 2", "Feature 3"],
    "outOfScope": ["What this doesn't do"],
    "futureConsiderations": ["Potential future features"]
  },
  "architecture": {
    "pattern": "MVC/Microservices/Monolith/Layered/Event-Driven/etc",
    "description": "Detailed 2-3 paragraph explanation of the architecture",
    "layers": [
      {
        "name": "Layer name (e.g., Presentation, Business Logic, Data)",
        "purpose": "What this layer does",
        "technologies": ["Tech1", "Tech2"]
      }
    ],
    "dataFlow": "Explain how data flows through the system",
    "diagrams": {
      "suggested": "Describe what kind of diagram would help (e.g., sequence diagram for auth flow)"
    },
    "frameworks": ["Framework1", "Framework2"],
    "confidence": 0.0-1.0
  },
  "keyConceptsAndTerminology": [
    {
      "term": "Important term or concept",
      "definition": "Clear explanation of what it means in this codebase"
    }
  ],
  "coreModules": [
    {
      "name": "Module/Component name",
      "purpose": "What it does",
      "responsibilities": ["Responsibility 1", "Responsibility 2"],
      "location": "Path in repo",
      "dependencies": ["Other modules it depends on"],
      "interfaces": "What interfaces it exposes",
      "keyFiles": ["important-file.js", "another-file.js"],
      "confidence": 0.0-1.0
    }
  ],
  "publicAPIs": [
    {
      "type": "REST/GraphQL/gRPC/CLI/SDK/etc",
      "baseUrl": "URL if applicable",
      "authentication": "Auth method (API key, OAuth, etc) or 'None'",
      "endpoints": [
        {
          "method": "GET/POST/etc",
          "path": "/api/path",
          "purpose": "What this endpoint does",
          "parameters": "Brief description of parameters",
          "response": "Brief description of response"
        }
      ],
      "available": "Yes/No/Partially",
      "confidence": 0.0-1.0
    }
  ],
  "internalInterfaces": [
    {
      "name": "Interface/Protocol name",
      "type": "Event bus/Message queue/Database/etc",
      "purpose": "What it's used for",
      "components": ["Component1", "Component2"]
    }
  ],
  "technicalStack": {
    "frontend": ["Technology1", "Technology2"],
    "backend": ["Technology1", "Technology2"],
    "database": ["Database1", "Database2"],
    "infrastructure": ["Docker", "K8s", "etc"],
    "tooling": ["Testing framework", "Build tool", "etc"]
  },
  "securityConsiderations": [
    "Security practice 1",
    "Security practice 2",
    "Identified vulnerability or concern"
  ],
  "performanceCharacteristics": {
    "scalability": "How it scales",
    "bottlenecks": ["Potential bottleneck 1"],
    "optimizations": ["Optimization in place 1"]
  },
  "openQuestions": [
    "What needs clarification or documentation",
    "Missing or unclear aspects"
  ],
  "initialADR": {
    "title": "Initial Architecture Decision",
    "context": "Why this architecture was likely chosen",
    "decision": "What architectural approach is being used",
    "consequences": {
      "positive": ["Benefit 1", "Benefit 2"],
      "negative": ["Trade-off 1", "Trade-off 2"],
      "risks": ["Risk 1"]
    }
  },
  "engineeringTasks": [
    {
      "category": "Documentation/Testing/Refactoring/etc",
      "priority": "High/Medium/Low",
      "task": "Specific task description",
      "reasoning": "Why this task is needed"
    }
  ],
  "confidence": 0.0-1.0
}

**Critical Instructions**:
1. Be COMPREHENSIVE - this is professional engineering documentation
2. Use actual findings from the codebase structure and README
3. Mark confidence scores honestly (0.0-1.0):
   - 0.8-1.0: Certain (found in README/obvious from structure)
   - 0.5-0.79: Likely (inferred from patterns)
   - 0.0-0.49: Uncertain (guessing based on limited info)
4. If something isn't determinable, say so explicitly in openQuestions
5. For APIs: If no REST/GraphQL endpoints are obvious, set available: "No" or "Unknown"
6. **ENGINEERING TASKS RULES**:
   - Generate ONLY 3-5 high-priority, actionable tasks
   - AVOID generic tasks like "add tests", "improve documentation", "add error handling"
   - Focus on SPECIFIC, NON-OBVIOUS improvements based on actual code analysis
   - Each task should be implementable in 1-2 hours
   - Prioritize security, performance, and architecture issues
7. Think like a senior engineer reviewing this codebase

**Output**: ONLY valid JSON, no markdown, no explanations, no additional text.`;
  }

  /**
   * Format file tree for prompt
   */
  formatFileTree(fileTree) {
    if (!fileTree || fileTree.length === 0) {
      return 'No file tree available';
    }

    // Group by top-level directories
    const topLevel = {};
    fileTree.forEach(file => {
      const parts = file.path.split('/');
      const topDir = parts[0];
      if (!topLevel[topDir]) {
        topLevel[topDir] = 0;
      }
      topLevel[topDir]++;
    });

    return Object.entries(topLevel)
      .slice(0, 20) // Limit to avoid token overflow
      .map(([dir, count]) => `- ${dir}/ (${count} files)`)
      .join('\n');
  }

  /**
   * Format package configuration for prompt
   */
  formatPackageConfig(packageConfig) {
    if (!packageConfig) {
      return 'No package configuration found';
    }

    const configs = [];

    if (packageConfig.packageJson) {
      try {
        const pkg = JSON.parse(packageConfig.packageJson);
        configs.push(`**package.json**:
- Name: ${pkg.name || 'N/A'}
- Version: ${pkg.version || 'N/A'}
- Dependencies: ${Object.keys(pkg.dependencies || {}).slice(0, 10).join(', ')}
- Scripts: ${Object.keys(pkg.scripts || {}).join(', ')}`);
      } catch (e) {
        configs.push('**package.json**: (parsing error)');
      }
    }

    if (packageConfig.requirementsTxt) {
      const lines = packageConfig.requirementsTxt.split('\n').filter(l => l.trim());
      configs.push(`**requirements.txt**: ${lines.slice(0, 10).join(', ')}`);
    }

    if (packageConfig.goMod) {
      configs.push(`**go.mod**: Present`);
    }

    if (packageConfig.cargoToml) {
      configs.push(`**Cargo.toml**: Present`);
    }

    return configs.join('\n') || 'No package configuration found';
  }

  /**
   * Repair common JSON issues from LLM responses
   */
  repairJSON(jsonStr) {
    // Remove trailing commas before } or ]
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

    // Fix unescaped newlines in strings
    jsonStr = jsonStr.replace(/([^\\])\\n/g, '$1\\\\n');

    // Fix truncated arrays - close them properly
    const openBrackets = (jsonStr.match(/\[/g) || []).length;
    const closeBrackets = (jsonStr.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
      // Try to find where the array was truncated and close it
      const diff = openBrackets - closeBrackets;
      for (let i = 0; i < diff; i++) {
        // Find last incomplete array element and truncate, then close
        jsonStr = jsonStr.replace(/,\s*"[^"]*$/, '');
        jsonStr += ']';
      }
    }

    // Fix truncated objects
    const openBraces = (jsonStr.match(/\{/g) || []).length;
    const closeBraces = (jsonStr.match(/\}/g) || []).length;
    if (openBraces > closeBraces) {
      const diff = openBraces - closeBraces;
      for (let i = 0; i < diff; i++) {
        jsonStr += '}';
      }
    }

    // Remove any trailing text after the last }
    const lastBrace = jsonStr.lastIndexOf('}');
    if (lastBrace !== -1) {
      jsonStr = jsonStr.substring(0, lastBrace + 1);
    }

    return jsonStr;
  }

  /**
   * Parse LLM response
   */
  parseAnalysisResponse(response, repoData) {
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      // Try to repair common JSON issues from LLM
      let jsonStr = jsonMatch[0];
      jsonStr = this.repairJSON(jsonStr);

      const analysis = JSON.parse(jsonStr);

      // Add metadata
      analysis.repoName = repoData.repoName;
      analysis.analyzedAt = new Date().toISOString();

      // Ensure all required fields exist (with new comprehensive structure)
      analysis.overview = analysis.overview || {
        projectName: repoData.repoName,
        tagline: 'No description available',
        description: 'Analysis pending',
        problemStatement: 'Not determined',
        confidence: 0.3
      };

      analysis.scope = analysis.scope || {
        inScope: [],
        outOfScope: [],
        futureConsiderations: []
      };

      analysis.architecture = analysis.architecture || {
        pattern: 'Unknown',
        description: 'Analysis required',
        layers: [],
        dataFlow: 'Not determined',
        frameworks: [],
        confidence: 0.3
      };

      analysis.keyConceptsAndTerminology = analysis.keyConceptsAndTerminology || [];
      analysis.coreModules = analysis.coreModules || [];
      analysis.publicAPIs = analysis.publicAPIs || [];
      analysis.internalInterfaces = analysis.internalInterfaces || [];

      analysis.technicalStack = analysis.technicalStack || {
        frontend: [],
        backend: [],
        database: [],
        infrastructure: [],
        tooling: []
      };

      analysis.securityConsiderations = analysis.securityConsiderations || [];
      analysis.performanceCharacteristics = analysis.performanceCharacteristics || {
        scalability: 'Not analyzed',
        bottlenecks: [],
        optimizations: []
      };

      analysis.openQuestions = analysis.openQuestions || [];
      analysis.initialADR = analysis.initialADR || {
        title: 'Initial Architecture',
        context: 'Analysis pending',
        decision: 'Not determined',
        consequences: { positive: [], negative: [], risks: [] }
      };

      analysis.engineeringTasks = analysis.engineeringTasks || [];
      analysis.confidence = analysis.confidence || 0.5;

      // Keep legacy fields for backward compatibility
      analysis.projectPurpose = analysis.overview?.description || analysis.projectPurpose;
      analysis.techStack = Object.values(analysis.technicalStack || {}).flat();

      return analysis;
    } catch (error) {
      console.error('Error parsing LLM response:', error);
      console.error('Response snippet:', response?.substring(0, 500));

      // Return fallback analysis
      return {
        repoName: repoData.repoName,
        overview: {
          projectName: repoData.repoName,
          tagline: 'Analysis failed',
          description: 'Analysis failed - manual review required',
          problemStatement: 'Unknown',
          confidence: 0
        },
        scope: { inScope: [], outOfScope: [], futureConsiderations: [] },
        architecture: {
          pattern: 'Unknown',
          description: 'Analysis failed',
          layers: [],
          dataFlow: 'Unknown',
          frameworks: [],
          confidence: 0
        },
        keyConceptsAndTerminology: [],
        coreModules: [],
        publicAPIs: [],
        internalInterfaces: [],
        technicalStack: { frontend: [], backend: [], database: [], infrastructure: [], tooling: [] },
        securityConsiderations: [],
        performanceCharacteristics: { scalability: 'Unknown', bottlenecks: [], optimizations: [] },
        openQuestions: ['Initial analysis failed - please review manually'],
        initialADR: {
          title: 'Analysis Failed',
          context: 'Automated analysis encountered an error',
          decision: 'Manual review required',
          consequences: { positive: [], negative: [], risks: ['No automated documentation available'] }
        },
        engineeringTasks: [
          { category: 'Documentation', priority: 'High', task: 'Manually review and document codebase', reasoning: 'Automated analysis failed' }
        ],
        confidence: 0,
        analyzedAt: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * Analyze PR changes and determine impact (with discussion context)
   */
  async analyzePRChanges(prData) {
    // Format discussion for context
    const discussionSummary = (prData.discussion || []).slice(0, 5).map(c =>
      `@${c.author}: ${c.body.substring(0, 200)}`
    ).join('\n');

    const reviewsSummary = (prData.reviews || []).map(r =>
      `@${r.author} [${r.state}]: ${r.body?.substring(0, 150) || 'No comment'}`
    ).join('\n');

    const prompt = `You are analyzing a merged pull request to determine its impact on documentation. Use ALL available context including code changes, PR description, and team discussion.

**PR #${prData.number}: ${prData.title}**

**Author**: @${prData.author}

**PR Description**:
${prData.body || 'No description provided'}

**Statistics**:
- Files changed: ${prData.files?.length || 0}
- Additions: +${prData.additions || 0}
- Deletions: -${prData.deletions || 0}

**Changed Files**:
${(prData.files || []).map(f => `- ${f.filename} (+${f.additions || 0} -${f.deletions || 0})`).join('\n')}

**Team Discussion** (${(prData.discussion || []).length} comments):
${discussionSummary || 'No discussion comments'}

**Code Reviews** (${(prData.reviews || []).length} reviews):
${reviewsSummary || 'No formal reviews'}

**Sample Code Changes**:
${(prData.files || []).slice(0, 3).map(f => f.patch).join('\n---\n').substring(0, 2500)}

**Your Task**: Analyze this PR comprehensively and provide a detailed assessment for documentation updates.

**Required Output** (JSON only):

{
  "changeType": "feature/bugfix/refactor/docs/test/security/performance/architecture",
  "impactLevel": "major/minor/patch",
  "affectedModules": ["List of affected modules/components based on files changed"],
  "publicAPIChanges": true/false,
  "breakingChanges": true/false,
  "requiresADR": true/false,
  "summary": "2-3 sentence summary of what changed and why (use context from discussion)",
  "technicalDetails": "More detailed explanation of the technical changes",
  "userImpact": "How does this affect end users?",
  "documentationUpdates": [
    "Specific doc update needed 1",
    "Specific doc update needed 2"
  ],
  "followUpTasks": [
    "Specific action item 1",
    "Specific action item 2"
  ],
  "securityImplications": "Any security considerations or 'None'",
  "performanceImpact": "Expected performance impact or 'None'",
  "keyDecisions": [
    "Important decision made during PR review (from discussion)"
  ],
  "confidence": 0.0-1.0
}

**Instructions**:
1. Use information from BOTH code changes AND discussion/reviews
2. If discussion mentions architectural decisions, capture them
3. Identify breaking changes explicitly
4. Be specific about which modules/components are affected
5. Consider security and performance implications
6. Mark confidence based on clarity of changes

Respond ONLY with valid JSON, no markdown, no explanations.`;

    try {
      let response;

      if (this.provider === 'anthropic') {
        const message = await this.anthropic.messages.create({
          model: this.model,
          max_tokens: 2048,
          temperature: 0.3,
          messages: [{
            role: 'user',
            content: prompt
          }]
        });
        response = message.content[0].text;
      } else if (this.provider === 'google') {
        const model = this.gemini.getGenerativeModel({
          model: this.model,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          }
        });
        const result = await model.generateContent(prompt);
        const geminiResponse = await result.response;
        response = geminiResponse.text();
      }

      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error analyzing PR changes:', error);
      return {
        changeType: 'unknown',
        impactLevel: 'minor',
        affectedModules: [],
        publicAPIChanges: false,
        requiresADR: false,
        summary: 'Analysis failed',
        documentationUpdates: [],
        followUpTasks: []
      };
    }
  }

  /**
   * Generate semantic diff explanation
   */
  async generateSemanticDiff(beforeContent, afterContent, context) {
    const prompt = `Generate a human-readable explanation of documentation changes.

**Context**: ${context}

**Before**:
${beforeContent.substring(0, 1000)}

**After**:
${afterContent.substring(0, 1000)}

Provide a concise explanation (2-3 sentences) of:
1. What changed
2. Why it matters
3. What users/developers need to know

Keep it clear and non-technical.`;

    try {
      let response;

      if (this.provider === 'anthropic') {
        const message = await this.anthropic.messages.create({
          model: this.model,
          max_tokens: 512,
          temperature: 0.5,
          messages: [{
            role: 'user',
            content: prompt
          }]
        });
        return message.content[0].text;
      } else if (this.provider === 'google') {
        const model = this.gemini.getGenerativeModel({
          model: this.model,
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 512,
          }
        });
        const result = await model.generateContent(prompt);
        const geminiResponse = await result.response;
        return geminiResponse.text();
      }
    } catch (error) {
      console.error('Error generating semantic diff:', error);
      return 'Documentation updated based on recent code changes.';
    }
  }

  /**
   * Generate ADR content
   */
  async generateADR(prData, analysis) {
    const prompt = `Generate an Architectural Decision Record (ADR) for this change.

**PR**: #${prData.number} - ${prData.title}
**Description**: ${prData.body || 'No description'}
**Impact**: ${analysis.impactLevel}
**Affected Modules**: ${analysis.affectedModules.join(', ')}

Create an ADR following this structure:

# ADR-XXX: [Title]

## Status
Accepted

## Context
[Why this decision was made]

## Decision
[What was decided]

## Consequences
**Positive:**
- [Benefit 1]

**Negative:**
- [Drawback 1]

**Risks:**
- [Risk 1]

Keep it concise and focused on architectural significance.`;

    try {
      let response;

      if (this.provider === 'anthropic') {
        const message = await this.anthropic.messages.create({
          model: this.model,
          max_tokens: 1024,
          temperature: 0.4,
          messages: [{
            role: 'user',
            content: prompt
          }]
        });
        return message.content[0].text;
      } else if (this.provider === 'google') {
        const model = this.gemini.getGenerativeModel({
          model: this.model,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 1024,
          }
        });
        const result = await model.generateContent(prompt);
        const geminiResponse = await result.response;
        return geminiResponse.text();
      }
    } catch (error) {
      console.error('Error generating ADR:', error);
      return `# ADR: ${prData.title}\n\nADR generation failed. Please create manually.`;
    }
  }
  /**
   * Analyze commit significance to determine if documentation update is needed
   */
  async analyzeCommitSignificance(commits, files) {
    const prompt = `You are analyzing direct commits to determine if they warrant documentation updates.

**Commits** (${commits.length} total):
${commits.slice(0, 5).map(c => `- ${c.sha.substring(0, 7)}: ${c.message} (by @${c.author})`).join('\n')}

**Changed Files** (${files.length} total):
${files.slice(0, 20).map(f => `- ${f.filename} (+${f.additions || 0} -${f.deletions || 0})`).join('\n')}

**Sample Changes**:
${files.slice(0, 3).map(f => f.patch).join('\n---\n').substring(0, 2000)}

**Your Task**: Determine if these changes are significant enough to update documentation.

**Trivial changes that DON'T need doc updates**:
- README typo fixes
- Comment updates
- Formatting/linting changes
- Configuration tweaks (unless they affect deployment/setup)
- Test file updates (unless they reveal new features)
- Minor bug fixes that don't change behavior

**Significant changes that DO need doc updates**:
- New features or functionality
- API changes (breaking or non-breaking)
- Architecture changes
- New dependencies or tech stack changes
- Security fixes
- Performance improvements
- Configuration changes affecting users

**Required Output** (JSON only):
{
  "isSignificant": true/false,
  "reasoning": "Brief explanation of why this is/isn't significant",
  "changeType": "feature/bugfix/refactor/docs/config/test/trivial",
  "affectedModules": ["module1", "module2"],
  "confidence": 0.0-1.0
}

Respond ONLY with valid JSON, no markdown, no explanations.`;

    try {
      let response;

      if (this.provider === 'anthropic') {
        const message = await this.anthropic.messages.create({
          model: this.model,
          max_tokens: 512,
          temperature: 0.3,
          messages: [{
            role: 'user',
            content: prompt
          }]
        });
        response = message.content[0].text;
      } else if (this.provider === 'google') {
        const model = this.gemini.getGenerativeModel({
          model: this.model,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 512,
          }
        });
        const result = await model.generateContent(prompt);
        const geminiResponse = await result.response;
        response = geminiResponse.text();
      }

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Error analyzing commit significance:', error);
      // Default to significant to avoid missing important changes
      return {
        isSignificant: true,
        reasoning: 'Analysis failed - treating as significant to be safe',
        changeType: 'unknown',
        affectedModules: [],
        confidence: 0.3
      };
    }
  }
}

export default LLMIntegration;
