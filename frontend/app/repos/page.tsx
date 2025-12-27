'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ConnectedRepo {
  repoFullName: string;
  documentTitle: string;
  documentId: string;
  connectedAt: string;
  lastUpdated?: string;
  lastSyncedAt?: string;
  confidence?: number;
  autoSyncEnabled?: boolean;
}

interface SyncStatus {
  isRunning: boolean;
  connectedRepos: number;
  syncInterval: number;
  lastSyncTimes: Record<string, number>;
}

function ReposContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [repos, setRepos] = useState<ConnectedRepo[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [togglingAutoSync, setTogglingAutoSync] = useState<string | null>(null);

  useEffect(() => {
    const session = searchParams.get('session') || localStorage.getItem('gitcraft-session');
    if (session) {
      setSessionId(session);
      localStorage.setItem('gitcraft-session', session);
      loadUserAndRepos(session);
      loadSyncStatus();
    } else {
      router.push('/');
    }
  }, [searchParams, router]);

  const loadUserAndRepos = async (session: string) => {
    try {
      // Load user info
      const userResponse = await fetch(`${API_URL}/auth/session/${session}`);
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(userData.user);
      }

      // Load connected repos
      const reposResponse = await fetch(`${API_URL}/sync/connected?sessionId=${session}`);
      if (reposResponse.ok) {
        const data = await reposResponse.json();
        console.log('Repos page - loaded connected repos:', data.repositories);
        setRepos(data.repositories || []);
      } else {
        console.error('Failed to load repos:', reposResponse.status);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/sync/sync-status`);
      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data);
      }
    } catch (error) {
      console.error('Error loading sync status:', error);
    }
  };

  const handleDisconnect = async (repoFullName: string) => {
    if (!sessionId) return;

    const confirmed = window.confirm(
      `Are you sure you want to disconnect "${repoFullName}"?\n\nThis will:\n- Remove it from continuous sync\n- Stop automatic updates`
    );

    if (!confirmed) return;

    // Ask if they want to delete the Craft document too
    const deleteCraftDoc = window.confirm(
      `Also delete the Craft document?\n\nClick "OK" to delete the document from Craft\nClick "Cancel" to keep the document`
    );

    setDisconnecting(repoFullName);

    try {
      const response = await fetch(
        `${API_URL}/sync/disconnect/${encodeURIComponent(repoFullName)}?sessionId=${sessionId}&deleteCraftDoc=${deleteCraftDoc}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        const data = await response.json();
        // Remove from local state
        setRepos(repos.filter(r => r.repoFullName !== repoFullName));

        // Show success message
        const craftMsg = data.craftDocDeleted ? ' and Craft document deleted' : '';
        alert(`Successfully disconnected ${repoFullName}${craftMsg}`);
      } else {
        const error = await response.json();
        alert(`Failed to disconnect: ${error.message}`);
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setDisconnecting(null);
    }
  };

  const handleDisconnectAll = async () => {
    if (!sessionId) return;

    const confirmed = window.confirm(
      `⚠️ DISCONNECT ALL REPOSITORIES?\n\nThis will:\n- Disconnect GitHub authentication\n- Remove all ${repos.length} connected repositories\n- Stop all automatic syncing\n\n(Your Craft documents will remain)\n\nAre you sure?`
    );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `${API_URL}/auth/disconnect/${sessionId}`,
        { method: 'POST' }
      );

      if (response.ok) {
        localStorage.removeItem('gitcraft-session');
        alert('✅ Successfully disconnected from GitHub');
        router.push('/');
      } else {
        const error = await response.json();
        alert(`❌ Failed to disconnect: ${error.message}`);
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  const getLastSyncTime = (repoFullName: string) => {
    if (!syncStatus?.lastSyncTimes?.[repoFullName]) return 'Never';

    const lastSync = syncStatus.lastSyncTimes[repoFullName];
    const now = Date.now();
    const diffMinutes = Math.floor((now - lastSync) / 60000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const handleSyncNow = async (repoFullName: string) => {
    if (!sessionId) return;

    setSyncing(repoFullName);
    try {
      const [owner, repo] = repoFullName.split('/');
      const response = await fetch(`${API_URL}/sync/trigger/${owner}/${repo}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      if (response.ok) {
        loadSyncStatus();
      } else {
        const error = await response.json();
        alert(`❌ Sync failed: ${error.message}`);
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setSyncing(null);
    }
  };

  const handleToggleAutoSync = async (repoFullName: string, currentEnabled: boolean) => {
    if (!sessionId) return;

    setTogglingAutoSync(repoFullName);
    try {
      const response = await fetch(`${API_URL}/sync/auto-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          repoFullName,
          enabled: !currentEnabled
        })
      });

      if (response.ok) {
        // Update local state
        setRepos(repos.map(r =>
          r.repoFullName === repoFullName
            ? { ...r, autoSyncEnabled: !currentEnabled }
            : r
        ));
      } else {
        const error = await response.json();
        alert(`❌ Failed to toggle auto-sync: ${error.message}`);
      }
    } catch (error: any) {
      alert(`❌ Error: ${error.message}`);
    } finally {
      setTogglingAutoSync(null);
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
            <motion.div
              whileHover={{ scale: 1.05 }}
              onClick={() => router.push('/')}
              className="flex items-center space-x-3 cursor-pointer"
            >
              <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <span className="text-xl">🧠</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">GitCraft</h1>
                <p className="text-xs text-slate-500">Connected Repositories</p>
              </div>
            </motion.div>

            <div className="flex items-center gap-3">
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

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push(`/connect?session=${sessionId}`)}
                className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm rounded-xl font-medium hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/20"
              >
                + Add Repository
              </motion.button>
            </div>
          </div>
        </div>
      </motion.header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Sync Status Banner */}
        {syncStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-800/50"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${syncStatus.isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
                  <span className="text-white font-medium">Auto-Sync: {syncStatus.isRunning ? 'Active' : 'Inactive'}</span>
                </div>
                <div className="h-4 w-px bg-slate-700"></div>
                <span className="text-slate-400 text-sm">
                  Checking every {Math.floor(syncStatus.syncInterval / 60000)} minutes
                </span>
              </div>
              <div className="text-slate-400 text-sm">
                {syncStatus.connectedRepos} {syncStatus.connectedRepos === 1 ? 'repository' : 'repositories'} monitored
              </div>
            </div>
          </motion.div>
        )}

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-800/50 p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📦</span>
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Connected</h3>
            </div>
            <p className="text-3xl font-bold text-white">{repos.length}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-800/50 p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">📚</span>
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Documents</h3>
            </div>
            <p className="text-3xl font-bold text-white">{repos.length}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-800/50 p-5"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🔄</span>
              <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider">Auto-Updates</h3>
            </div>
            <p className="text-3xl font-bold text-white">{syncStatus?.isRunning ? 'ON' : 'OFF'}</p>
          </motion.div>
        </div>

        {/* Repositories List */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Your Repositories</h2>
            {repos.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleDisconnectAll}
                className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl font-medium hover:bg-red-500/20 transition-all"
              >
                Disconnect All
              </motion.button>
            )}
          </div>

          {repos.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-800/50 p-12 text-center"
            >
              <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl opacity-50">📭</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">No repositories connected</h3>
              <p className="text-slate-400 mb-6">Connect your first repository to get started with living documentation</p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push(`/connect?session=${sessionId}`)}
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-cyan-600 transition-all shadow-lg shadow-blue-500/20"
              >
                Connect Repository
              </motion.button>
            </motion.div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {repos.map((repo, index) => (
                  <motion.div
                    key={repo.repoFullName}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ y: -4 }}
                    className="bg-slate-900/50 backdrop-blur-xl rounded-2xl border border-slate-800/50 p-5 hover:border-blue-500/50 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-semibold text-sm truncate group-hover:text-blue-400 transition-colors mb-1">
                          {repo.repoFullName}
                        </h4>
                        <p className="text-xs text-slate-500 truncate">{repo.documentTitle}</p>
                      </div>
                      <div className="w-8 h-8 bg-green-500/20 text-green-400 rounded-lg flex items-center justify-center flex-shrink-0 ml-2">
                        <span className="text-xs">✓</span>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Connected</span>
                        <span className="text-slate-300 font-medium">
                          {new Date(repo.connectedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Last Sync</span>
                        <span className="text-slate-300 font-medium">
                          {getLastSyncTime(repo.repoFullName)}
                        </span>
                      </div>
                      {repo.lastUpdated && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Last Updated</span>
                          <span className="text-slate-300 font-medium">
                            {new Date(repo.lastUpdated).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Sync Controls */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-800 mb-3">
                      <button
                        onClick={() => handleToggleAutoSync(repo.repoFullName, repo.autoSyncEnabled !== false)}
                        disabled={togglingAutoSync === repo.repoFullName}
                        className={`flex items-center gap-2 text-xs font-medium transition-all ${repo.autoSyncEnabled !== false
                            ? 'text-green-400'
                            : 'text-slate-500'
                          }`}
                      >
                        <div className={`w-8 h-4 rounded-full relative transition-all ${repo.autoSyncEnabled !== false
                            ? 'bg-green-500/30'
                            : 'bg-slate-700'
                          }`}>
                          <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${repo.autoSyncEnabled !== false
                              ? 'bg-green-400 left-4'
                              : 'bg-slate-500 left-0.5'
                            }`} />
                        </div>
                        Auto-sync
                      </button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleSyncNow(repo.repoFullName)}
                        disabled={syncing === repo.repoFullName}
                        className="px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs rounded-lg font-medium hover:bg-cyan-500/20 transition-all disabled:opacity-50"
                      >
                        {syncing === repo.repoFullName ? 'Syncing...' : 'Sync Now'}
                      </motion.button>
                    </div>

                    <div className="flex gap-2">
                      <motion.a
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        href="https://www.craft.do"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-3 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs rounded-lg font-medium hover:bg-blue-500/20 transition-all text-center"
                      >
                        Open in Craft →
                      </motion.a>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleDisconnect(repo.repoFullName)}
                        disabled={disconnecting === repo.repoFullName}
                        className="px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg font-medium hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {disconnecting === repo.repoFullName ? '...' : 'Disconnect'}
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>


      </main>
    </div>
  );
}

export default function ReposPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="w-16 h-16 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    }>
      <ReposContent />
    </Suspense>
  );
}

