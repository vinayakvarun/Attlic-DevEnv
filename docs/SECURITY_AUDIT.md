# attlic - Comprehensive Security & Examination Integrity Audit

## Executive Summary
This document records the production security and integrity evaluation conducted for **attlic**. The audit covered Authentication, Authorization, Database Security, Examination Integrity, API Protection, and Candidate PII Isolation.

---

## 1. Authentication Security
- **Firebase Authentication**: Integrated with Google OAuth and Email/Password authentication.
- **Protected Recruiter Console**: The Recruiter Dashboard route validates active recruiter session state before rendering sensitive organization views.
- **Session Management**: Firebase client SDK maintains token state with secure HTTPS cookies and local persistence.
- **Password Reset**: Automated self-service email flow via `sendPasswordResetEmail` in `src/pages/ForgotPasswordPage.tsx`.
- **Sandbox Elimination**: All temporary mock login buttons and hardcoded tenant accounts have been stripped from `src/pages/RecruiterLoginPage.tsx`. Only genuine authenticated recruiters can access management consoles.

---

## 2. Authorization & Multi-Tenancy (RBAC / ABAC)
- **Organization Isolation**: Every assessment and candidate attempt is tagged with an immutable `organizationId`.
- **Recruiter Scoping**: Recruiters can only query and manage assessments belonging to their authorized organization ID or created under their authenticated recruiter UID.
- **Candidate Restrictions**: Candidates have zero access to the recruiter dashboard, editor, analytics, or other candidates' attempts.

---

## 3. Database Security & Deployed Firestore Rules
The Firestore security rules in `firestore.rules` have been reviewed and hardened according to the 8 Pillars of Firebase Security:
1. **Recruiter Profile Isolation (`/users/{userId}`)**: Restricted so that users can only read and write their own profile document (`request.auth.uid == userId`).
2. **Organization Integrity (`/organizations/{orgId}`)**: Updates and deletes require authenticated ownership (`resource.data.ownerId == request.auth.uid`).
3. **Assessment Integrity (`/assessments/{assessmentId}`)**: Write operations (`create`, `update`, `delete`) require recruiter authentication.
4. **Candidate Access Control (`/attempts/{attemptId}`)**: Candidates can submit and update their own answers, read their individual receipt by attempt ID, while listing attempts is restricted to authorized recruiter reporting.
5. **Default Deny Rule**: All undeclared paths are strictly denied via `match /{document=**} { allow read, write: if false; }`.
6. **Deployment**: Deployed directly to Firebase Firestore via the `fax.DeployRules` RPC action.

---

## 4. Examination Integrity & Answer Protection
- **No Leaked Answer Keys**: The public candidate endpoint (`GET /api/assessments/code/:code`) sanitizes all questions before transmission. Correct answer arrays (`correctAnswers`, `correctOptionIds`), option correctness flags (`isCorrect: true`), and answer explanations are completely stripped.
- **Server-Authoritative Scoring**: Submissions are evaluated authoritatively on the backend (`POST /api/assessments/code/:code/submit`) against the true stored assessment answer keys.
- **Wall-Clock Accurate Timers**: Exam deadlines are recorded as absolute timestamps (`deadlineMs = startTimeMs + totalDurationMs`). On page reloads or tab re-opening, the remaining time is calculated against wall-clock time, preventing candidates from extending or pausing time.
- **Duplicate Submission Prevention**: The backend and frontend verify that a candidate email has not previously submitted an attempt for the given assessment code, returning `409 Conflict` if duplicate submissions are attempted.
- **Proctoring Telemetry**: Tab switches and focus loss events are captured by browser visibility listeners. Fullscreen mode (F11) is strictly enforced with a fullscreen lock overlay if the candidate exits fullscreen during an assessment.
- **Offline & Refresh Recovery**: Active candidate responses are debounced to `localStorage` under isolated session keys, with automatic online/offline status indicators and sync upon reconnection.

---

## 5. API Security & Rate Limiting
- **Rate Limiting**: An in-memory sliding window rate limiter protects backend endpoints against brute-force code guessing and denial-of-service (default limit: 600–1000 req/min per IP with standard `X-RateLimit-*` headers).
- **Request Payload Sanitization**: Max JSON payload limit set to 10MB to prevent memory exhaustion attacks.
- **Zero Exposed Private Secrets**: No service account keys or private OAuth secrets are present in client code or Git repository. Client configuration uses standard public Firebase Web SDK keys.
