'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Type definitions
interface Repository {
  id: string;
  fullName: string;
  description?: string;
  language?: string;
  stars?: number;
  updatedAt?: string;
}

interface ConnectedRepo {
  repo: string;
  documentTitle: string;
  connectedAt: string;
  confidence: number;
}

function ConnectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [craftMcpUrl, setCraftMcpUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'loading' | 'select-repo' | 'analyzing'>('loading');
  const [searchQuery, setSearchQuery] = useState('');
  const [connectedRepos, setConnectedRepos] = useState<ConnectedRepo[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [repoStats, setRepoStats] = useState<Record<string, any>>({});
  const [serverConnectedRepos, setServerConnectedRepos] = useState<string[]>([]);

  useEffect(() => {
    const session = searchParams.get('session');
    if (session) {
      setSessionId(session);
      loadSession(session);
    } else {
      setError('No session found. Please try connecting again.');
      setStep('loading');
    }
  }, [searchParams]);

  const loadConnectedRepos = async (session: string) => {
    try {
      const response = await fetch(`${API_URL}/sync/connected?sessionId=${session}`);
      if (response.ok) {
        const data = await response.json();
        const repos = data.repositories || [];
        console.log('Loaded connected repos:', repos);
        setServerConnectedRepos(repos.map((r: any) => r.repoFullName));
        setConnectedRepos(repos.map((r: any) => ({
          repo: r.repoFullName,
          documentTitle: r.documentTitle,
          connectedAt: r.connectedAt,
          confidence: 0 // We don't have this from the endpoint
        })));

        // Load stats for each connected repo
        repos.forEach((repo: any) => {
          loadRepoStats(repo.repoFullName);
        });
      }
    } catch (e) {
      console.error('Failed to load connected repos:', e);
    }
  };

  const loadRepoStats = async (repoFullName: string) => {
    if (!sessionId) return;
    try {
      const response = await fetch(`${API_URL}/auth/session/${sessionId}`);
      if (!response.ok) {
        console.warn(`Session API returned ${response.status}`);
        return;
      }

      const data = await response.json();

      // Check if we have accessToken
      if (!data.accessToken) {
        console.warn('No access token in session data');
        return;
      }

      const token = data.accessToken;

      // Fetch repo info from GitHub API
      const repoResponse = await fetch(`https://api.github.com/repos/${repoFullName}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (repoResponse.ok) {
        const repoData = await repoResponse.json();
        setRepoStats(prev => ({
          ...prev,
          [repoFullName]: {
            stars: repoData.stargazers_count,
            language: repoData.language,
            updatedAt: repoData.pushed_at,
            openIssues: repoData.open_issues_count,
            size: repoData.size
          }
        }));
      } else {
        console.warn(`GitHub API returned ${repoResponse.status} for ${repoFullName}`);
      }
    } catch (e) {
      console.error('Failed to load repo stats:', e);
    }
  };

  const saveConnectedRepo = (connectionInfo: ConnectedRepo) => {
    try {
      const updated = [...connectedRepos.filter(r => r.repo !== connectionInfo.repo), connectionInfo];
      localStorage.setItem('gitcraft-connected-repos', JSON.stringify(updated));
      setConnectedRepos(updated);
      loadRepoStats(connectionInfo.repo);
    } catch (e) {
      console.error('Failed to save connected repo:', e);
    }
  };

  const loadSession = async (session: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/session/${session}`);
      if (!response.ok) {
        throw new Error('Session expired or invalid');
      }
      const data = await response.json();
      setUser(data.user);
      await loadRepositories(session);
      await loadConnectedRepos(session);
      setStep('select-repo');
    } catch (err: any) {
      setError(err.message);
      setStep('loading');
    }
  };

  const loadRepositories = async (session: string) => {
    try {
      const response = await fetch(`${API_URL}/sync/repositories?sessionId=${session}`);
      if (!response.ok) {
        throw new Error('Failed to load repositories');
      }
      const data = await response.json();
      setRepositories(data.repositories);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedRepo) {
      setError('Please select a repository');
      return;
    }
    if (!craftMcpUrl) {
      setError('Please enter your Craft MCP URL');
      return;
    }

    setLoading(true);
    setError(null);
    setStep('analyzing');

    try {
      const [owner, repo] = selectedRepo.split('/');

      const response = await fetch(`${API_URL}/sync/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          owner,
          repo,
          craftMcpUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Analysis failed');
      }

      const data = await response.json();

      // Save connection info
      if (data.connectionInfo) {
        saveConnectedRepo(data.connectionInfo);
      }

      // Redirect to dashboard
      router.push(`/dashboard?repo=${selectedRepo}&session=${sessionId}&craft=${encodeURIComponent(craftMcpUrl)}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
      setStep('select-repo');
    }
  };

  const filteredRepos = repositories.filter(repo =>
    repo.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isRepoConnected = (repoName: string) =>
    serverConnectedRepos.includes(repoName);

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-2 border-slate-700 border-t-blue-500 rounded-full mx-auto mb-4"
          />
          <p className="text-slate-400 text-sm">Connecting to GitHub...</p>
        </motion.div>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/50 backdrop-blur-xl rounded-3xl p-8 max-w-md border border-red-500/20"
        >
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-semibold text-white mb-3 text-center">Connection Error</h2>
          <p className="text-slate-400 mb-6 text-center text-sm">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-cyan-600 transition-all"
          >
            Try Again
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="border-b border-slate-800/50 bg-slate-900/30 backdrop-blur-xl sticky top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="w-11 h-11 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20"
              >
                <span className="text-xl">🧠</span>
              </motion.div>
              <div>
                <h1 className="text-lg font-bold text-white">GitCraft</h1>
                <p className="text-xs text-slate-500">Living Documentation</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {connectedRepos.length > 0 && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => router.push(`/repos?session=${sessionId}`)}
                  className="px-4 py-2 bg-slate-800/50 backdrop-blur-sm text-slate-300 text-sm rounded-xl hover:bg-slate-700/50 hover:text-white transition-all border border-slate-700/50 font-medium"
                >
                  My Repos ({connectedRepos.length})
                </motion.button>
              )}
              {user && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center space-x-2 bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700/50 backdrop-blur-sm"
                >
                  <div className="w-7 h-7 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {user.login[0].toUpperCase()}
                  </div>
                  <span className="text-white text-sm font-medium">{user.login}</span>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && user && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl backdrop-blur-sm"
          >
            <p className="text-red-400 text-sm">{error}</p>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {step === 'select-repo' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Selection Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-800/50 overflow-hidden shadow-2xl"
              >
                <div className="p-6 border-b border-slate-800/50 bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
                  <h2 className="text-2xl font-bold text-white mb-1">Create Engineering Brain</h2>
                  <p className="text-slate-400 text-sm">Select a repository and connect to Craft</p>
                </div>

                <div className="p-6 space-y-6">
                  {/* Dropdown for Repository Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Select Repository
                    </label>
                    <div className="relative">
                      <button
                        onClick={() => setDropdownOpen(!dropdownOpen)}
                        className="w-full px-4 py-4 bg-slate-800/50 border border-slate-700/50 rounded-xl text-left text-white hover:bg-slate-800 transition-all flex items-center justify-between group"
                      >
                        <span className="flex items-center gap-3">
                          <span className="text-xl">📦</span>
                          <span className="font-medium">
                            {selectedRepo || 'Choose a repository...'}
                          </span>
                        </span>
                        <motion.svg
                          animate={{ rotate: dropdownOpen ? 180 : 0 }}
                          className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </motion.svg>
                      </button>

                      <AnimatePresence>
                        {dropdownOpen && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="absolute z-10 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden"
                          >
                            {/* Search */}
                            <div className="p-3 border-b border-slate-700">
                              <div className="relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                  type="text"
                                  value={searchQuery}
                                  onChange={(e) => setSearchQuery(e.target.value)}
                                  placeholder="Search repositories..."
                                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                                  autoFocus
                                />
                              </div>
                            </div>

                            {/* Repository List */}
                            <div className="max-h-64 overflow-y-auto">
                              {filteredRepos.map((repo) => {
                                const connected = isRepoConnected(repo.fullName);
                                return (
                                  <motion.button
                                    key={repo.id}
                                    whileHover={{ backgroundColor: 'rgba(51, 65, 85, 0.5)' }}
                                    onClick={() => {
                                      setSelectedRepo(repo.fullName);
                                      setDropdownOpen(false);
                                      setError(null);
                                    }}
                                    className="w-full p-3 text-left hover:bg-slate-700/50 transition-colors border-b border-slate-700/30 last:border-0"
                                  >
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="font-medium text-white text-sm truncate">{repo.fullName}</span>
                                          {connected && (
                                            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-md border border-green-500/30">
                                              ✓
                                            </span>
                                          )}
                                        </div>
                                        {repo.description && (
                                          <p className="text-xs text-slate-400 line-clamp-1">{repo.description}</p>
                                        )}
                                      </div>
                                      {repo.language && (
                                        <span className="px-2 py-1 bg-slate-700/50 text-slate-300 text-xs rounded-md">
                                          {repo.language}
                                        </span>
                                      )}
                                    </div>
                                  </motion.button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Craft MCP URL */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Craft MCP URL
                    </label>
                    <input
                      type="url"
                      value={craftMcpUrl}
                      onChange={(e) => setCraftMcpUrl(e.target.value)}
                      placeholder="https://mcp.craft.do/links/..."
                      className="w-full px-4 py-4 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono transition-colors"
                    />
                    <p className="mt-2 text-xs text-slate-500">
                      Get from Craft → Imagine tab → Create MCP Connection
                    </p>
                  </div>

                  {/* Generate Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleAnalyze}
                    disabled={!selectedRepo || !craftMcpUrl || loading}
                    className="w-full px-6 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
                  >
                    {loading ? 'Generating...' : '🚀 Generate Engineering Brain'}
                  </motion.button>
                </div>
              </motion.div>

              {/* Connected Repositories */}
              {connectedRepos.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Connected Repositories
                  </h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {connectedRepos.map((repo, index) => {
                      const stats = repoStats[repo.repo];
                      return (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 * index }}
                          whileHover={{ y: -4 }}
                          className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-800/50 p-5 hover:border-blue-500/50 transition-all group"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-white font-semibold text-sm truncate group-hover:text-blue-400 transition-colors">
                                {repo.repo}
                              </h4>
                              <p className="text-xs text-slate-500 mt-1">{repo.documentTitle}</p>
                            </div>
                            <div className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-lg border border-green-500/30 font-semibold">
                              {repo.confidence}%
                            </div>
                          </div>

                          {stats && (
                            <div className="space-y-2 mb-3">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500">Language</span>
                                <span className="text-slate-300 font-medium">{stats.language || 'N/A'}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500">Stars</span>
                                <span className="text-slate-300 font-medium">⭐ {stats.stars || 0}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500">Last Push</span>
                                <span className="text-slate-300 font-medium">
                                  {stats.updatedAt ? new Date(stats.updatedAt).toLocaleDateString() : 'N/A'}
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="pt-3 border-t border-slate-800 text-xs text-slate-500">
                            Connected {new Date(repo.connectedAt).toLocaleDateString()}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {step === 'analyzing' && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-800/50 p-12 text-center max-w-2xl mx-auto"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-20 h-20 mx-auto mb-6 relative"
              >
                <div className="w-20 h-20 border-4 border-slate-800 rounded-full"></div>
                <div className="w-20 h-20 border-4 border-transparent border-t-blue-500 rounded-full absolute top-0"></div>
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-2">Creating Your Engineering Brain</h2>
              <p className="text-slate-400 mb-8">AI is analyzing your codebase...</p>

              <div className="space-y-3 max-w-md mx-auto">
                <ProgressItem text="Fetching repository" status="done" />
                <ProgressItem text="AI analysis" status="active" />
                <ProgressItem text="Generating documentation" status="pending" />
                <ProgressItem text="Creating in Craft" status="pending" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function ProgressItem({ text, status }: { text: string; status: 'done' | 'active' | 'pending' }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-center gap-3 p-4 rounded-xl transition-all ${status === 'done' ? 'bg-green-500/10 border border-green-500/20' :
        status === 'active' ? 'bg-blue-500/10 border border-blue-500/20' :
          'bg-slate-800/30 border border-slate-800/50'
        }`}
    >
      <motion.div
        animate={status === 'active' ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 1, repeat: Infinity }}
        className={`w-6 h-6 rounded-full flex items-center justify-center text-sm ${status === 'done' ? 'bg-green-500 text-white' :
          status === 'active' ? 'bg-blue-500 text-white' :
            'bg-slate-700 text-slate-500'
          }`}
      >
        {status === 'done' ? '✓' : status === 'active' ? '⏳' : '○'}
      </motion.div>
      <span className={`text-sm font-medium ${status === 'done' ? 'text-green-400' :
        status === 'active' ? 'text-blue-400' :
          'text-slate-500'
        }`}>
        {text}
      </span>
    </motion.div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="w-16 h-16 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    }>
      <ConnectContent />
    </Suspense>
  );
}
