'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function HomeContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    setMounted(true);
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
    
    // Check if user has a session
    const session = localStorage.getItem('gitcraft-session');
    if (session) {
      setHasSession(true);
    }
  }, [searchParams]);

  const handleConnect = () => {
    window.location.href = `${API_URL}/auth/github`;
  };

  if (!mounted) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden relative">
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute top-1/4 -left-48 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute bottom-1/4 -right-48 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl"
        />
      </div>

      {/* Header */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative border-b border-slate-800/50 bg-slate-900/30 backdrop-blur-xl sticky top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              className="flex items-center space-x-2"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <span className="text-xl">🧠</span>
              </div>
              <div>
                <h1 className="text-base font-bold text-white">GitCraft</h1>
              </div>
            </motion.div>
            <div className="flex items-center gap-2">
              {hasSession && (
                <motion.a
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  href={`/repos?session=${localStorage.getItem('gitcraft-session')}`}
                  className="px-4 py-2 bg-slate-800/50 backdrop-blur-sm text-slate-300 text-sm rounded-xl hover:bg-slate-700/50 hover:text-white transition-all border border-slate-700/50 font-medium"
                >
                  My Repos
                </motion.a>
              )}
              <motion.a
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-slate-800/50 backdrop-blur-sm rounded-2xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all border border-slate-700/50"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </motion.a>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          {/* Badge */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 mb-8 px-4 py-2 bg-slate-800/50 backdrop-blur-sm rounded-full border border-slate-700/50"
          >
            <motion.span 
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="relative flex h-2 w-2"
            >
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </motion.span>
            <span className="text-slate-300 text-sm font-medium">Craft Winter Challenge 2025</span>
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-6xl md:text-7xl lg:text-8xl font-bold mb-6 leading-[1.1] tracking-tight"
          >
            <span className="text-white">Living</span>{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400">
              engineering
            </span>
            <br />
            <span className="text-white">documentation</span>
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xl text-slate-400 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            AI-powered documentation that analyzes your codebase and creates 
            self-updating Engineering Brain in Craft
          </motion.p>

          {error && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-8 max-w-xl mx-auto p-4 bg-red-500/10 border border-red-500/20 rounded-2xl backdrop-blur-sm"
            >
              <p className="text-red-400 text-sm">{error}</p>
            </motion.div>
          )}

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleConnect}
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-base font-semibold rounded-2xl hover:from-blue-600 hover:to-cyan-600 transition-all shadow-2xl shadow-blue-500/25"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            Connect GitHub
          </motion.button>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-4 text-slate-500 text-sm"
          >
            Free • No credit card required
          </motion.p>
        </div>

        {/* Demo Preview */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-20 relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 blur-3xl rounded-3xl"></div>
          <div className="relative bg-slate-900/50 backdrop-blur-xl rounded-3xl border border-slate-800/50 p-6 max-w-3xl mx-auto shadow-2xl">
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-800/50">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                <div className="w-3 h-3 rounded-full bg-slate-700"></div>
              </div>
              <span className="ml-4 text-slate-500 text-sm font-mono">your-project-docs</span>
            </div>
            <div className="font-mono text-sm text-slate-400 space-y-2 leading-relaxed">
              <motion.p 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
                className="text-blue-400"
              >
                ## 🧠 Engineering Brain
              </motion.p>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>├── 📘 Technical Specification</motion.p>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>│   ├── Overview</motion.p>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.0 }}>│   ├── Architecture</motion.p>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>│   └── Modules</motion.p>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>├── 🧾 Release Notes</motion.p>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}>├── 📐 ADRs</motion.p>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>├── 📌 Engineering Tasks</motion.p>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}>└── 📁 _doc_history</motion.p>
            </div>
          </div>
        </motion.div>

        {/* Features Grid */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-24 grid md:grid-cols-3 gap-6"
        >
          {[
            { icon: '⚡', title: 'Instant Analysis', description: 'AI analyzes codebase in seconds', delay: 0 },
            { icon: '🔄', title: 'Auto-Updates', description: 'Updates with every PR merge', delay: 0.1 },
            { icon: '🧠', title: 'Smart Structure', description: 'Organized specs, ADRs, tasks', delay: 0.2 },
            { icon: '🤖', title: 'AI-Powered', description: 'Infers architecture patterns', delay: 0.3 },
            { icon: '📊', title: 'Confidence Scores', description: 'Know what\'s certain vs inferred', delay: 0.4 },
            { icon: '✨', title: 'Craft Native', description: 'Beautiful docs in workspace', delay: 0.5 },
          ].map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 + feature.delay }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="bg-slate-900/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-800/50 hover:border-blue-500/50 transition-all group"
            >
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl flex items-center justify-center mb-4 text-2xl group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h4 className="text-base font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">{feature.title}</h4>
              <p className="text-sm text-slate-400 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.5 }}
          className="mt-24 text-center bg-gradient-to-r from-slate-900/50 to-slate-800/50 backdrop-blur-xl rounded-3xl p-12 border border-slate-800/50"
        >
          <h3 className="text-3xl font-bold text-white mb-3">
            Transform your documentation
          </h3>
          <p className="text-slate-400 mb-8">
            Engineering documentation that stays current
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleConnect}
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-base font-semibold rounded-2xl hover:from-blue-600 hover:to-cyan-600 transition-all shadow-2xl shadow-blue-500/25"
          >
            Get Started →
          </motion.button>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.footer 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
        className="relative border-t border-slate-800/50 mt-24"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-slate-500 text-sm">
            Built for <a href="https://www.craft.do/imagine" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">Craft Winter Challenge 2025</a>
          </p>
        </div>
      </motion.footer>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="w-16 h-16 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
