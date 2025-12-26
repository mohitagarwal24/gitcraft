'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ConnectedRepo {
  repo: string;
  documentTitle: string;
  connectedAt: string;
  confidence: number;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [repo, setRepo] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [craftMcpUrl, setCraftMcpUrl] = useState('');
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connectedRepos, setConnectedRepos] = useState<ConnectedRepo[]>([]);

  useEffect(() => {
    const repoParam = searchParams.get('repo');
    const sessionParam = searchParams.get('session');
    const craftParam = searchParams.get('craft');

    loadConnectedRepos();

    if (repoParam && sessionParam && craftParam) {
      setRepo(repoParam);
      setSessionId(sessionParam);
      setCraftMcpUrl(decodeURIComponent(craftParam));
      loadStatus(repoParam, sessionParam, decodeURIComponent(craftParam));
    } else {
      setLoading(false);
    }
  }, [searchParams, router]);

  const loadConnectedRepos = () => {
    try {
      const stored = localStorage.getItem('gitcraft-connected-repos');
      if (stored) {
        setConnectedRepos(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load connected repos:', e);
    }
  };

  const loadStatus = async (repoName: string, session: string, craftUrl: string) => {
    try {
      const [owner, repoShort] = repoName.split('/');
      const response = await fetch(
        `${API_URL}/sync/status/${owner}/${repoShort}?sessionId=${session}&craftMcpUrl=${encodeURIComponent(craftUrl)}`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.state) {
          setStatus(data.state);
        }
      } else {
        console.warn('Status endpoint returned non-OK:', response.status);
        // Set default status
        setStatus({
          repoName,
          lastSync: new Date().toISOString(),
          confidence: 0.5,
          connected: true
        });
      }
    } catch (error) {
      console.error('Error loading status:', error);
      // Set default status on error
      setStatus({
        repoName,
        lastSync: new Date().toISOString(),
        confidence: 0.5,
        connected: true
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const [owner, repoShort] = repo.split('/');
      const response = await fetch(`${API_URL}/sync/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          owner,
          repo: repoShort,
          craftMcpUrl,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`✅ Sync complete! Processed ${data.processed} new PRs.`);
        await loadStatus(repo, sessionId, craftMcpUrl);
      } else {
        throw new Error('Sync failed');
      }
    } catch (error: any) {
      alert(`❌ Sync failed: ${error.message}`);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-2 border-slate-700 border-t-blue-500 rounded-full"
        />
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
            <a href="/" className="flex items-center space-x-2 cursor-pointer">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20"
              >
                <span className="text-xl">🧠</span>
              </motion.div>
              <div>
                <h1 className="text-base font-bold text-white">GitCraft</h1>
              </div>
            </a>
            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push(`/repos?session=${sessionId}`)}
                className="px-4 py-2 bg-slate-800/50 backdrop-blur-sm text-slate-300 text-sm rounded-xl hover:bg-slate-700/50 hover:text-white transition-all border border-slate-700/50 font-medium"
              >
                My Repos
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push(`/connect?session=${sessionId}`)}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm rounded-xl font-medium hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/20"
              >
                + New Repo
              </motion.button>
            </div>
          </div>
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Banner */}
        <AnimatePresence>
          {repo && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 backdrop-blur-xl border border-green-500/20 rounded-3xl p-6 mb-8"
            >
              <div className="flex items-start gap-4">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-14 h-14 bg-green-500/20 rounded-2xl flex items-center justify-center shrink-0"
                >
                  <span className="text-3xl">✓</span>
                </motion.div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-white mb-2">
                    Documentation Created Successfully!
                  </h2>
                  <p className="text-slate-300 text-sm mb-4">
                    Your Engineering Brain is live in Craft
                  </p>
                  <motion.a
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    href="https://www.craft.do"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm rounded-xl font-medium hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg shadow-green-500/20"
                  >
                    Open in Craft
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </motion.a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats */}
            {repo && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid sm:grid-cols-3 gap-4"
              >
                <InfoCard title="Repository" value={repo.split('/')[1] || repo} icon="📦" delay={0} />
                <InfoCard title="Last Sync" value={status?.lastSync ? new Date(status.lastSync).toLocaleDateString() : 'Just now'} icon="🔄" delay={0.1} />
                <InfoCard title="Confidence" value={status?.confidence ? `${Math.round(status.confidence * 100)}%` : 'N/A'} icon="🎯" delay={0.2} />
              </motion.div>
            )}





            {/* Manual Sync */}
            {repo && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-800/50 p-6"
              >
                <h3 className="text-lg font-bold text-white mb-3">🔄 Manual Sync</h3>
                <p className="text-slate-400 text-sm mb-4">
                  Check for updates manually
                </p>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleManualSync}
                  disabled={syncing}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  {syncing ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                      />
                      <span>Syncing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>Sync Now</span>
                    </>
                  )}
                </motion.button>
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-800/50 overflow-hidden sticky top-24"
            >
              <div className="p-5 border-b border-slate-800/50 bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
                <h3 className="text-base font-bold text-white">Connected Repos</h3>
                <p className="text-xs text-slate-400 mt-1">With Engineering Brain</p>
              </div>

              <div className="p-4 max-h-[500px] overflow-y-auto">
                {connectedRepos.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-3xl opacity-50">📭</span>
                    </div>
                    <p className="text-slate-500 text-sm mb-4">No repos yet</p>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => router.push('/')}
                      className="px-4 py-2 bg-slate-800/50 text-slate-300 rounded-xl text-sm hover:bg-slate-700/50 hover:text-white transition-all"
                    >
                      Connect a repo
                    </motion.button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {connectedRepos.map((connRepo, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + index * 0.1 }}
                        whileHover={{ scale: 1.02 }}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${connRepo.repo === repo
                          ? 'bg-blue-500/10 border-blue-500/50'
                          : 'bg-slate-800/30 border-slate-800/50 hover:border-slate-700/50'
                          }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-white text-sm font-semibold truncate flex-1">{connRepo.repo}</p>
                          <span className={`px-2 py-1 text-xs rounded-lg font-semibold ${connRepo.repo === repo
                            ? 'bg-blue-500 text-white'
                            : 'bg-green-500/20 text-green-400'
                            }`}>
                            {connRepo.repo === repo ? 'Active' : `${connRepo.confidence}%`}
                          </span>
                        </div>
                        <p className="text-slate-500 text-xs">{new Date(connRepo.connectedAt).toLocaleDateString()}</p>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}

function InfoCard({ title, value, icon, delay }: { title: string; value: string; icon: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -2 }}
      className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-800/50 p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</h4>
      </div>
      <p className="text-base font-bold text-white truncate">{value}</p>
    </motion.div>
  );
}

function DocItem({ emoji, title, description, delay }: { emoji: string; title: string; description: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 + delay }}
      whileHover={{ x: 5 }}
      className="flex items-start gap-3 p-4 bg-slate-800/30 rounded-2xl border border-slate-800/50 hover:border-blue-500/50 transition-all group"
    >
      <div className="w-10 h-10 bg-slate-800/50 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
        <span className="text-lg">{emoji}</span>
      </div>
      <div>
        <h4 className="font-semibold text-white text-sm group-hover:text-blue-400 transition-colors">{title}</h4>
        <p className="text-xs text-slate-400 mt-1">{description}</p>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="w-16 h-16 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}



