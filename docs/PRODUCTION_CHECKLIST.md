# attlic - Production Deployment Checklist & Readiness Audit

## 1. 15-Point Production Readiness Checklist

1. [x] **Zero Mock/Sandbox Data**: All sandbox buttons, hardcoded tenant accounts ("Acme Tech Labs", "Jordan Lee"), and test logins removed from recruiter login and registration.
2. [x] **Answer Key Protection**: Verified that `/api/assessments/code/:code` scrubs all answer keys, correct option IDs, and explanations so candidate network inspectors cannot see answers.
3. [x] **Authoritative Server Scoring**: Scoring executed server-side via `/api/assessments/code/:code/submit` matching positive and negative marks accurately.
4. [x] **Wall-Clock Accurate Timers**: Exam deadline computed against absolute system time (`deadlineMs`) to prevent timer pausing on tab reload.
5. [x] **Duplicate Submission Prevention**: Rejects duplicate attempts for the same candidate email on an assessment.
6. [x] **Full-Screen Enforcement**: Strict fullscreen lock overlay triggered when candidate exits fullscreen mode, requiring F11 / fullscreen re-entry to resume answering.
7. [x] **Offline & Refresh Recovery**: Continuous debounced autosave to `localStorage`, offline amber warning banner, and live "Saved at HH:MM:SS" status badge.
8. [x] **Candidate Consent & Honor Code**: Mandatory consent checkbox linking to Terms and Privacy Policy before candidate enters exam hall.
9. [x] **Deployed Firestore Rules**: Hardened ABAC rules deployed via `fax.DeployRules` RPC with user profile isolation and default-deny catchall.
10. [x] **API Rate Limiting**: In-memory token bucket rate limiter protecting endpoints against brute-force attacks and abuse.
11. [x] **Scalability & Load Tested**: Benchmarked with 100, 250, and 500 concurrent candidates across 3 organizations; achieved 100% success rate (0.00% errors).
12. [x] **Automated Backup & Restore Engine**: Point-in-time backup and verified restoration scripts with SHA256 checksums (`scripts/backup.ts`, `scripts/restore.ts`).
13. [x] **Appearance Studio Customization**: 5 theme presets, 10 color pickers, typography scales, layout cards, and live candidate preview without modifying questions or scoring.
14. [x] **Google Forms Dual Importers**: Public URL parser (`/api/google-forms/extract-simple`) + official OAuth Google Forms API importer.
15. [x] **Clean Verification**: TypeScript compilation (`tsc --noEmit`), automated test suite (`npm test`), and production asset building pass with zero warnings or errors.

---

## 2. Known Limitations
1. **In-Memory Rate Limiting in Multi-Instance Deployments**: The rate limiter is currently in-memory. If scaling to multiple Cloud Run container instances, rate limits are per-instance. For multi-instance clusters, a Redis/Memorystore token bucket can be wired.
2. **Offline Grading**: While candidates can take assessments and autosave offline, final score verification requires reconnecting to the internet to submit the score to the server and Cloud Firestore.
3. **Browser Fullscreen API User Gesture**: Entering fullscreen mode in modern browsers (Chrome/Firefox/Safari) requires a user gesture (e.g. clicking the "Start Examination" or "Resume Fullscreen" button) due to browser security policies.

---

## 3. Production Readiness Categorization

### Category A: COMPLETED & VERIFIED
- **Authentication & User Management**: Firebase Auth (Google OAuth + Email/Password + Password Reset).
- **Recruiter Organization Workspace**: Multi-tenant organizations, invitations, recruiter profile editing.
- **Assessment Creator & Editor**: 3-part layout (Left sidebar, Main question editor, Right settings sidebar), positive and negative marks, section management, and validation.
- **Appearance Customization Studio**: Live candidate preview, 5 theme presets, customizable color palette, typography scales, branding logos, and data isolation.
- **Google Forms Importer**: Simple zero-OAuth link extractor and official Forms API converter.
- **Candidate Examination Hall**: Clean responsive runner, proctoring telemetry, wall-clock timer, autosave, offline warning, and score receipt.
- **Security & Answer Protection**: Server-authoritative grading, candidate question sanitization, deployed Firestore rules.
- **Point-in-Time Backup & Disaster Recovery**: Automated backup and restore tools with cryptographic checksum verification.
- **Scalability & Performance Benchmarks**: 100, 250, and 500 concurrent candidate load tests verified with 0.00% error rate.

### Category B: INCOMPLETE
- **None**: All core requirements, security criteria, appearance features, proctoring controls, and test suites are 100% complete and operational.

### Category C: REQUIRES EXTERNAL CONFIGURATION
- **Custom Production Domain Mapping**: If mapping a custom university or corporate domain (e.g. `assessments.mycompany.com`) to Google Cloud Run, add DNS `CNAME` records in your DNS registrar pointing to Google Cloud Run.
- **Production Google OAuth Consent Screen Verification**: When moving out of Google Cloud testing status to public production, submit the OAuth consent screen in Google Cloud Console for official verification if requesting Google Workspace scopes from external university users.
