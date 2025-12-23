# GitCraft - Living Engineering Brain

> Transform your GitHub repository into a self-updating engineering knowledge base in Craft

**Craft Winter Challenge 2025 Submission**

---

## 🎉 **NEW: Now with FREE Google Gemini Support!**

**No credit card required!** GitCraft now uses Google Gemini's generous free tier (60 requests/min, 1M token context). Get started in minutes with zero cost!

👉 **[Quick Start Guide](GET_STARTED_NOW.md)** | 📖 **[Gemini Setup](GEMINI_SETUP.md)**

---

## 🎯 The Vision

GitCraft turns any GitHub repository into a **living, self-updating documentation system** inside Craft. It analyzes your codebase, generates structured documentation, and keeps it automatically synchronized with every code change.

### The "Wow" Factor

- **Zero-effort onboarding**: Connect repo → Instant structured docs
- **Automatic structure generation**: Technical specs, ADRs, release notes, tasks
- **Self-updating**: Docs evolve with every merge
- **Full version control**: Audit trail, rollback capability, confidence scoring
- **Craft as long-term memory**: Your repo's engineering brain lives in Craft

## 🏗 Architecture

```
User → Onboarding Website → GitHub OAuth → Repo Analyzer
                                              ↓
                                         Craft MCP
                                              ↓
                                    Documentation Structure
                                              ↓
                           GitHub Webhooks/Polling → Update Agent
```

## 📦 Tech Stack

### Core
- **Backend**: Node.js with Express
- **Frontend**: Next.js (minimal onboarding UI)
- **LLM**: Claude/GPT for code analysis
- **Storage**: Craft (via MCP)
- **VCS Integration**: GitHub API + Webhooks

### Key Dependencies
- `@google/generative-ai` (Gemini - FREE tier!) or `@anthropic-ai/sdk` (Claude)
- `@octokit/rest` - GitHub API
- `express` - Backend server
- `next` - Frontend framework
- Craft MCP integration

## 🚀 Features

### Phase 1: Onboarding
- [ ] Minimal landing page
- [ ] GitHub OAuth flow
- [ ] Repository selection
- [ ] Craft MCP connection setup

### Phase 2: Initial Analysis
- [ ] Repository structure analysis
- [ ] Code architecture inference
- [ ] Auto-generated documentation structure:
  - 📘 Technical Specification
  - 🧾 Release Notes
  - 📐 ADRs (Architectural Decision Records)
  - 📌 Engineering Tasks
  - 📁 Documentation History

### Phase 3: Continuous Updates
- [ ] GitHub webhook integration
- [ ] Change detection and interpretation
- [ ] Automatic documentation updates
- [ ] Semantic diff generation

### Phase 4: Version Control
- [ ] Documentation snapshots
- [ ] Change history tracking
- [ ] Rollback capability
- [ ] Confidence scoring

## 📂 Project Structure

```
gitcraft/
├── backend/
│   ├── src/
│   │   ├── agents/
│   │   │   ├── analyzer.js       # Repository analysis
│   │   │   └── updater.js        # Continuous updates
│   │   ├── integrations/
│   │   │   ├── github.js         # GitHub API
│   │   │   ├── craft.js          # Craft MCP
│   │   │   └── llm.js            # LLM integration
│   │   ├── routes/
│   │   │   ├── auth.js           # OAuth flow
│   │   │   ├── webhook.js        # GitHub webhooks
│   │   │   └── sync.js           # Manual sync
│   │   └── server.js
│   └── package.json
├── frontend/
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── connect/page.tsx      # OAuth flow
│   │   └── dashboard/page.tsx    # Status dashboard
│   └── package.json
├── docs/
│   └── IMPLEMENTATION.md         # Detailed implementation guide
└── README.md
```

## 🔧 Setup Instructions

### Prerequisites
- Node.js 18+
- GitHub account
- Craft account with MCP enabled
- LLM API key (Gemini/Claude/OpenAI) - **Gemini has a free tier!**

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/gitcraft.git
cd gitcraft
```

2. **Install dependencies**
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

3. **Configure environment variables**
```bash
# backend/.env
GITHUB_CLIENT_ID=your_github_oauth_app_id
GITHUB_CLIENT_SECRET=your_github_oauth_secret
GITHUB_WEBHOOK_SECRET=your_webhook_secret

CRAFT_MCP_URL=your_craft_mcp_url

# Choose your LLM provider
GOOGLE_API_KEY=your_gemini_api_key      # Recommended (Free tier!)
LLM_PROVIDER=google

# OR
# ANTHROPIC_API_KEY=your_claude_api_key
# LLM_PROVIDER=anthropic

PORT=3001
```

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
```

4. **Run the application**
```bash
# Backend
cd backend
npm run dev

# Frontend (in another terminal)
cd frontend
npm run dev
```

5. **Access the application**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

## 🎮 Usage

### For Users

1. **Visit the landing page** at http://localhost:3000
2. **Click "Connect GitHub Repo"**
3. **Authorize with GitHub** and select your repository
4. **Provide Craft MCP URL** from your Craft workspace
5. **Watch the magic happen**: GitCraft analyzes your repo and creates structured documentation in Craft
6. **Automatic updates**: Every time you merge a PR, docs update automatically

### For Developers

See [IMPLEMENTATION.md](docs/IMPLEMENTATION.md) for detailed technical documentation.

## 🏆 Why This Wins

### Product Thinking
- Solves a real pain point: outdated documentation
- Seamless integration into existing workflows
- Craft becomes irreplaceable as the "source of truth"

### Technical Excellence
- Proper use of Craft MCP for document management
- Intelligent LLM-based code analysis
- Robust version control and audit trails
- Hackathon-safe scope with clear MVP

### Wow Factor
- Automatic structure generation (not just content)
- Self-updating documentation (set and forget)
- Confidence scoring (builds trust in AI)
- Full history and rollback (safety net)

## 🎯 Demo Flow (3-4 minutes)

1. Show landing page → Connect repo
2. GitHub OAuth → Select repository
3. Craft structure appears (instant wow)
4. Show generated Technical Spec, ADRs
5. Make a code change → Merge PR
6. Show automatic doc update
7. Show version history and rollback

## 📝 License

MIT

## 🙏 Acknowledgments

Built for the **Craft Winter Challenge 2025** - Using Craft's MCP to revolutionize engineering documentation.

---

**"Craft becomes the long-term memory of your GitHub repository."**

