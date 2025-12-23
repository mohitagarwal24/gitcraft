import { Octokit } from '@octokit/rest';
import crypto from 'crypto';

class GitHubIntegration {
  constructor(accessToken) {
    this.octokit = new Octokit({
      auth: accessToken
    });
  }

  /**
   * Get repository tree structure
   */
  async getRepositoryTree(owner, repo, branch = 'main') {
    try {
      const { data } = await this.octokit.git.getTree({
        owner,
        repo,
        tree_sha: branch,
        recursive: true
      });
      return data.tree;
    } catch (error) {
      console.error('Error fetching repository tree:', error);
      throw new Error(`Failed to fetch repository tree: ${error.message}`);
    }
  }

  /**
   * Get file content
   */
  async getFileContent(owner, repo, path) {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path
      });

      if (data.type === 'file') {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }
      return null;
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      console.error(`Error fetching file ${path}:`, error);
      throw error;
    }
  }

  /**
   * Get README content
   */
  async getReadme(owner, repo) {
    try {
      const { data } = await this.octokit.repos.getReadme({
        owner,
        repo
      });
      return Buffer.from(data.content, 'base64').toString('utf-8');
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get package configuration files
   */
  async getPackageConfig(owner, repo) {
    const configs = {
      packageJson: null,
      requirementsTxt: null,
      goMod: null,
      cargoToml: null,
      composerJson: null
    };

    // Try to fetch common package files
    const files = [
      { key: 'packageJson', path: 'package.json' },
      { key: 'requirementsTxt', path: 'requirements.txt' },
      { key: 'goMod', path: 'go.mod' },
      { key: 'cargoToml', path: 'Cargo.toml' },
      { key: 'composerJson', path: 'composer.json' }
    ];

    for (const file of files) {
      try {
        const content = await this.getFileContent(owner, repo, file.path);
        if (content) {
          configs[file.key] = content;
        }
      } catch (error) {
        // File doesn't exist, continue
      }
    }

    return configs;
  }

  /**
   * List user repositories
   */
  async listRepositories() {
    try {
      const { data } = await this.octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100
      });
      return data.map(repo => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        language: repo.language,
        private: repo.private,
        defaultBranch: repo.default_branch,
        updatedAt: repo.updated_at
      }));
    } catch (error) {
      console.error('Error listing repositories:', error);
      throw error;
    }
  }

  /**
   * Get pull requests
   */
  async listPullRequests(owner, repo, state = 'closed', since = null) {
    try {
      const params = {
        owner,
        repo,
        state,
        sort: 'updated',
        direction: 'desc',
        per_page: 50
      };

      const { data } = await this.octokit.pulls.list(params);

      let prs = data.filter(pr => pr.merged_at);

      if (since) {
        const sinceDate = new Date(since);
        prs = prs.filter(pr => new Date(pr.merged_at) > sinceDate);
      }

      return prs.map(pr => ({
        number: pr.number,
        title: pr.title,
        body: pr.body,
        mergedAt: pr.merged_at,
        author: pr.user.login,
        baseBranch: pr.base.ref,
        headBranch: pr.head.ref
      }));
    } catch (error) {
      console.error('Error listing pull requests:', error);
      throw error;
    }
  }

  /**
   * Get PR files/changes
   */
  async getPRFiles(owner, repo, pullNumber) {
    try {
      const { data } = await this.octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: pullNumber
      });

      return data.map(file => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch
      }));
    } catch (error) {
      console.error('Error fetching PR files:', error);
      throw error;
    }
  }

  /**
   * Get repository languages
   */
  async getLanguages(owner, repo) {
    try {
      const { data } = await this.octokit.repos.listLanguages({
        owner,
        repo
      });
      return data;
    } catch (error) {
      console.error('Error fetching languages:', error);
      throw error;
    }
  }

  /**
   * Get open issues
   */
  async getOpenIssues(owner, repo, limit = 10) {
    try {
      const { data } = await this.octokit.issues.listForRepo({
        owner,
        repo,
        state: 'open',
        per_page: limit
      });

      return data.map(issue => ({
        number: issue.number,
        title: issue.title,
        body: issue.body,
        labels: issue.labels.map(l => l.name),
        createdAt: issue.created_at
      }));
    } catch (error) {
      console.error('Error fetching issues:', error);
      throw error;
    }
  }

  /**
   * Get PR comments and discussion
   */
  async getPRComments(owner, repo, prNumber) {
    try {
      // Get issue comments (general PR discussion)
      const { data: issueComments } = await this.octokit.issues.listComments({
        owner,
        repo,
        issue_number: prNumber
      });

      // Get review comments (inline code comments)
      const { data: reviewComments } = await this.octokit.pulls.listReviewComments({
        owner,
        repo,
        pull_number: prNumber
      });

      return {
        discussion: issueComments.map(comment => ({
          author: comment.user?.login,
          body: comment.body,
          createdAt: comment.created_at
        })),
        codeReviews: reviewComments.map(comment => ({
          author: comment.user?.login,
          body: comment.body,
          path: comment.path,
          line: comment.line,
          createdAt: comment.created_at
        }))
      };
    } catch (error) {
      console.error('Error fetching PR comments:', error);
      return { discussion: [], codeReviews: [] };
    }
  }

  /**
   * Get PR reviews
   */
  async getPRReviews(owner, repo, prNumber) {
    try {
      const { data } = await this.octokit.pulls.listReviews({
        owner,
        repo,
        pull_number: prNumber
      });

      return data.map(review => ({
        author: review.user?.login,
        state: review.state, // APPROVED, CHANGES_REQUESTED, COMMENTED
        body: review.body,
        submittedAt: review.submitted_at
      }));
    } catch (error) {
      console.error('Error fetching PR reviews:', error);
      return [];
    }
  }

  /**
   * Get commit details with file changes
   */
  async getCommit(owner, repo, sha) {
    try {
      const { data } = await this.octokit.repos.getCommit({
        owner,
        repo,
        ref: sha
      });

      return {
        sha: data.sha,
        message: data.commit.message,
        author: data.commit.author.name,
        date: data.commit.author.date,
        files: (data.files || []).map(file => ({
          filename: file.filename,
          status: file.status,
          additions: file.additions,
          deletions: file.deletions,
          changes: file.changes,
          patch: file.patch
        })),
        stats: data.stats
      };
    } catch (error) {
      console.error('Error fetching commit:', error);
      throw error;
    }
  }

  /**
   * Get PR details with full discussion
   */
  async getPRWithDiscussion(owner, repo, prNumber) {
    try {
      // Get basic PR data
      const { data: pr } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: prNumber
      });

      // Get comments and reviews in parallel
      const [comments, reviews] = await Promise.all([
        this.getPRComments(owner, repo, prNumber),
        this.getPRReviews(owner, repo, prNumber)
      ]);

      return {
        number: pr.number,
        title: pr.title,
        body: pr.body,
        author: pr.user?.login,
        state: pr.state,
        merged: pr.merged,
        mergedAt: pr.merged_at,
        baseBranch: pr.base.ref,
        headBranch: pr.head.ref,
        comments,
        reviews,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changed_files
      };
    } catch (error) {
      console.error('Error fetching PR with discussion:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  static verifyWebhookSignature(payload, signature, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(digest)
    );
  }
}

export default GitHubIntegration;

