# attlic - Architecture & System Design Documentation

## 1. System Overview & Technology Stack
**attlic** is an enterprise-grade university campus placement and institutional recruitment examination platform. It allows hiring teams and universities to design custom online tests, import Google Forms schemas effortlessly, customize candidate examination themes via a real-time Appearance Studio, enforce browser proctoring (tab-switch tracking and full-screen enforcement), and authoritatively evaluate submissions with server-side scoring.

### Technology Stack
- **Frontend Core**: React 19 SPA, TypeScript, Vite 8, Tailwind CSS v4.
- **Backend Core**: Full-Stack Node.js Express server (`server.ts`) hosting custom REST endpoints and Vite middleware.
- **Database & Persistence**:
  - **Cloud Firestore**: Real-time scalable document database (`users`, `organizations`, `organizationMembers`, `assessments`, `attempts`).
  - **Disk Persistence Store**: High-performance local JSON datastore (`data/assessments.json`, `data/attempts.json`) for seamless zero-downtime offline continuity.
- **Authentication**: Firebase Authentication (Google OAuth + Email/Password with Password Reset).
- **Security & Proctoring**: In-memory rate limiting, server-authoritative timer, answer-key scrubbed candidate API responses, fullscreen locking, and tab-focus telemetry.
- **Testing Engine**: Built-in `node:test` test runner and custom concurrency benchmark suite.

---

## 2. Architecture Diagram

```
                              [ Candidate Browser ]
                                      │
                   ┌──────────────────┴──────────────────┐
                   ▼                                     ▼
        Candidate Portal (`/`)                 Exam Hall (`/runner`)
                   │                                     │
                   │ (Fetch sanitized test)              │ (Submit answers)
                   │                                     │
                   ▼                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   attlic Full-Stack Server (Express)                   │
│                                                                        │
│  [ Rate Limiter Middleware ] ─── Token bucket protection (600 req/min) │
│  [ Security Sanitizer ] ──────── Strips correct answers & explanations │
│  [ Evaluation Engine ] ───────── Server-authoritative scoring & marks  │
│  [ Google Forms Extractor ] ──── Public link extraction & converter    │
└────────────────────────────────────────────────────────────────────────┘
                   │                                     │
        ┌──────────┴──────────┐               ┌──────────┴──────────┐
        ▼                     ▼               ▼                     ▼
 [ Cloud Firestore ]  [ Disk Store ]   [ Recruiter Console ] [ Live Monitor ]
  - /users             - data/          - Dashboard Views    - Real-time
  - /organizations       assessments    - Assessment Editor    telemetry &
  - /assessments         attempts       - Appearance Studio    scorecards
  - /attempts          - Backups
```

---

## 3. Project Directory Structure

```
├── .aistudio/                 # AI Studio metadata & artifact storage
├── data/                      # Disk persistence store
│   ├── assessments.json       # Persisted assessments database
│   ├── attempts.json          # Persisted candidate exam submissions
│   └── backups/               # Point-in-time snapshot directory
├── docs/                      # Production audit documentation
│   ├── ARCHITECTURE.md        # System architecture and file tree
│   ├── SECURITY_AUDIT.md      # Security review, rules, and answer protection
│   ├── API_DOCUMENTATION.md   # Complete REST API reference
│   ├── SETUP_AND_DEPLOYMENT.md# GCP, Firebase, OAuth, and Cloud Run setup
│   ├── BACKUP_AND_DISASTER_RECOVERY.md # Backup, restore, and DR runbook
│   ├── SCALABILITY_BENCHMARK_REPORT.md # Concurrency benchmark results
│   └── PRODUCTION_CHECKLIST.md# Production deployment readiness checklist
├── scripts/                   # System automation scripts
│   ├── backup.ts              # Automated point-in-time backup snapshot engine
│   ├── restore.ts             # Verified point-in-time database restoration engine
│   └── load_test.ts           # Concurrency benchmark suite (100, 250, 500)
├── src/
│   ├── components/
│   │   ├── candidate/
│   │   │   └── CandidateTestRunner.tsx  # Exam hall, proctoring & appearance
│   │   ├── common/
│   │   │   ├── BrandLogo.tsx            # attlic visual identity
│   │   │   ├── Footer.tsx               # Global footer with legal links
│   │   │   └── Navbar.tsx               # Responsive top navigation
│   │   ├── dashboard/
│   │   │   ├── AnalyticsView.tsx        # Statistical distributions & charts
│   │   │   ├── CandidatesView.tsx       # Submissions & candidate records
│   │   │   ├── CreateAssessmentView.tsx # Quick-create & manual modal
│   │   │   ├── ImportGoogleFormView.tsx # Simple Google Forms importer
│   │   │   ├── MyAssessmentsView.tsx    # Assessment cards & publish toggle
│   │   │   ├── OrganizationView.tsx     # Multi-tenant organization manager
│   │   │   ├── OverviewView.tsx         # Executive metrics & activities
│   │   │   ├── RecruiterProfileModal.tsx# Profile details & organization editor
│   │   │   ├── SettingsView.tsx         # Security thresholds & global configs
│   │   │   └── Sidebar.tsx              # Recruiter navigation menu
│   │   └── editor/
│   │       ├── AppearanceStudio.tsx     # Live candidate preview & theme studio
│   │       └── AssessmentEditor.tsx     # 3-part layout, questions, scoring & rules
│   ├── context/
│   │   ├── AssessmentContext.tsx        # Assessment state, cache & storage sync
│   │   └── AuthContext.tsx              # Recruiter authentication & roles
│   ├── pages/
│   │   ├── AboutPage.tsx                # Platform overview & institutional use
│   │   ├── CandidatePortalPage.tsx      # Test code verification & candidate info
│   │   ├── ForgotPasswordPage.tsx       # Password recovery flow
│   │   ├── LandingPage.tsx              # Institutional landing showcase
│   │   ├── PrivacyPage.tsx              # GDPR compliance & PII isolation policy
│   │   ├── RecruiterDashboardPage.tsx   # Recruiter workspace container
│   │   ├── RecruiterLoginPage.tsx       # Production console login
│   │   ├── RecruiterRegisterPage.tsx    # Organization onboarding
│   │   └── TermsPage.tsx                # Academic integrity & examination terms
│   ├── services/
│   │   ├── firebase.ts                  # Firebase SDK initialization
│   │   ├── firestoreService.ts          # Firestore collections interface
│   │   ├── googleAuth.ts                # Google Workspace OAuth client
│   │   └── mockData.ts                  # Clean initial state
│   ├── types/
│   │   └── index.ts                     # Comprehensive TypeScript interfaces
│   └── utils/
│       ├── appearanceDefaults.ts        # Theme presets & design token scales
│       ├── evaluation.ts                # Pure grading engine & scoring logic
│       ├── evaluation.test.ts           # Evaluation unit tests
│       ├── googleFormsParser.ts         # Google Forms URL & HTML extractor
│       └── googleFormsParser.test.ts    # Forms parser unit tests
├── tests/
│   └── attlic.test.ts                   # 12 core automated unit & security tests
├── firebase-applet-config.json          # Provisioned Firebase configuration
├── firebase-blueprint.json              # Data models & collection schemas
├── firestore.rules                      # Deployed hardened Firestore rules
├── index.html                           # App entry point with attlic SEO tags
├── metadata.json                        # Applet metadata & permissions
├── package.json                         # Dependencies & npm scripts
├── server.ts                            # Full-stack Express server
├── tsconfig.json                        # Strict TypeScript configuration
└── vite.config.ts                       # Vite bundling configuration
```
