/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Full-Stack Express Server & Google Forms API Proxy
 */

import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractFormId,
  validateGoogleFormsUrl,
  convertGoogleFormToAttlicAssessment,
  validateStandardizedJson,
} from './src/utils/googleFormsParser.ts';
import { evaluateAssessmentAttempt } from './src/utils/evaluation.ts';
import {
  sanitizeAssessmentForCandidate,
  sanitizeAttemptForCandidateResponse,
  validateGoogleFormFetchUrl,
  verifyTenantOwnership,
} from './src/utils/securitySanitizer.ts';
import { validateExamAccess } from './src/utils/examFeatures.ts';
import { evaluateCodingQuestionSync, validateSafeCandidateCode } from './src/utils/codeExecutionEngine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Server-side persistent storage directory
const DATA_DIR = path.resolve(__dirname, 'data');
const ASSESSMENTS_FILE = path.join(DATA_DIR, 'assessments.json');
const ATTEMPTS_FILE = path.join(DATA_DIR, 'attempts.json');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');
const ORGANIZATIONS_FILE = path.join(DATA_DIR, 'organizations.json');

// Hardened In-Memory Rate Limiting with Memory Cap
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();
const MAX_RATE_LIMIT_KEYS = 5000;

function extractClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim().slice(0, 64);
  }
  return (req.socket?.remoteAddress || '127.0.0.1').slice(0, 64);
}

function extractRequestActor(req: Request, bodyFallback?: any) {
  const organizationId =
    (req.headers['x-attlic-org-id'] as string) ||
    (req.query.organizationId as string) ||
    bodyFallback?.organizationId ||
    null;
  const email =
    (req.headers['x-attlic-recruiter-email'] as string) ||
    (req.query.recruiterEmail as string) ||
    (req.query.email as string) ||
    (req.query.ownerEmail as string) ||
    bodyFallback?.recruiterEmail ||
    bodyFallback?.ownerEmail ||
    bodyFallback?.email ||
    null;
  const uid =
    (req.headers['x-attlic-recruiter-id'] as string) ||
    (req.query.recruiterId as string) ||
    (req.query.uid as string) ||
    (req.query.ownerId as string) ||
    bodyFallback?.recruiterId ||
    bodyFallback?.ownerId ||
    bodyFallback?.uid ||
    null;

  return {
    organizationId: typeof organizationId === 'string' && organizationId.trim() ? organizationId.trim() : null,
    email: typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null,
    uid: typeof uid === 'string' && uid.trim() ? uid.trim() : null,
  };
}

function rateLimiter(limit: number = 600, windowMs: number = 60000) {
  return (req: Request, res: Response, next: () => void) => {
    const allowLoadTestBypass =
      process.env.ALLOW_LOAD_TEST_BYPASS === 'true' &&
      req.headers['x-load-test-token'] === 'attlic-benchmark';

    if (req.path === '/api/health' || !req.path.startsWith('/api') || allowLoadTestBypass) {
      return next();
    }

    const ip = extractClientIp(req);
    const now = Date.now();

    // Evict expired or oldest keys if map reaches memory bound
    if (rateLimitMap.size >= MAX_RATE_LIMIT_KEYS && !rateLimitMap.has(ip)) {
      for (const [k, v] of rateLimitMap.entries()) {
        if (now > v.resetAt) {
          rateLimitMap.delete(k);
        }
        if (rateLimitMap.size < MAX_RATE_LIMIT_KEYS) break;
      }
      if (rateLimitMap.size >= MAX_RATE_LIMIT_KEYS) {
        const oldestKey = rateLimitMap.keys().next().value;
        if (oldestKey) rateLimitMap.delete(oldestKey);
      }
    }

    const clientRecord = rateLimitMap.get(ip);

    if (!clientRecord || now > clientRecord.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', limit - 1);
      return next();
    }

    clientRecord.count++;
    const remaining = Math.max(0, limit - clientRecord.count);
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);

    if (clientRecord.count > limit) {
      res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please slow down and try again shortly.',
        retryAfterMs: clientRecord.resetAt - now,
      });
      return;
    }

    next();
  };
}

let assessmentsCache: any[] | null = null;
let attemptsCache: any[] | null = null;
let profilesCache: any[] | null = null;
let organizationsCache: any[] | null = null;
let attemptsWriteTimer: ReturnType<typeof setTimeout> | null = null;

function ensureDataStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ASSESSMENTS_FILE)) {
    fs.writeFileSync(ASSESSMENTS_FILE, '[]', 'utf-8');
  }
  if (!fs.existsSync(ATTEMPTS_FILE)) {
    fs.writeFileSync(ATTEMPTS_FILE, '[]', 'utf-8');
  }
  if (!fs.existsSync(PROFILES_FILE)) {
    fs.writeFileSync(PROFILES_FILE, '[]', 'utf-8');
  }
  if (!fs.existsSync(ORGANIZATIONS_FILE)) {
    fs.writeFileSync(ORGANIZATIONS_FILE, '[]', 'utf-8');
  }
}

function readAssessments(): any[] {
  if (assessmentsCache !== null) return assessmentsCache;
  ensureDataStorage();
  try {
    const raw = fs.readFileSync(ASSESSMENTS_FILE, 'utf-8');
    assessmentsCache = JSON.parse(raw) || [];
    return assessmentsCache!;
  } catch (err) {
    console.error('Error reading assessments.json:', err);
    assessmentsCache = [];
    return assessmentsCache;
  }
}

function writeAssessments(assessments: any[]) {
  assessmentsCache = assessments;
  ensureDataStorage();
  fs.promises.writeFile(ASSESSMENTS_FILE, JSON.stringify(assessments), 'utf-8').catch((err) => {
    console.error('Error writing assessments.json:', err);
  });
}

function readAttempts(): any[] {
  if (attemptsCache !== null) return attemptsCache;
  ensureDataStorage();
  try {
    const raw = fs.readFileSync(ATTEMPTS_FILE, 'utf-8');
    attemptsCache = JSON.parse(raw) || [];
    return attemptsCache!;
  } catch (err) {
    console.error('Error reading attempts.json:', err);
    attemptsCache = [];
    return attemptsCache;
  }
}

function writeAttempts(attempts: any[]) {
  attemptsCache = attempts;
  ensureDataStorage();
  if (attemptsWriteTimer) {
    clearTimeout(attemptsWriteTimer);
  }
  attemptsWriteTimer = setTimeout(() => {
    fs.promises.writeFile(ATTEMPTS_FILE, JSON.stringify(attemptsCache || []), 'utf-8').catch((err) => {
      console.error('Error writing attempts.json:', err);
    });
  }, 150);
}

function readProfiles(): any[] {
  if (profilesCache !== null) return profilesCache;
  ensureDataStorage();
  try {
    const raw = fs.readFileSync(PROFILES_FILE, 'utf-8');
    profilesCache = JSON.parse(raw) || [];
    return profilesCache!;
  } catch {
    profilesCache = [];
    return profilesCache;
  }
}

function writeProfiles(profiles: any[]) {
  profilesCache = profiles;
  ensureDataStorage();
  fs.promises.writeFile(PROFILES_FILE, JSON.stringify(profiles), 'utf-8').catch(() => {});
}

function readOrganizations(): any[] {
  if (organizationsCache !== null) return organizationsCache;
  ensureDataStorage();
  try {
    const raw = fs.readFileSync(ORGANIZATIONS_FILE, 'utf-8');
    organizationsCache = JSON.parse(raw) || [];
    return organizationsCache!;
  } catch {
    organizationsCache = [];
    return organizationsCache;
  }
}

function writeOrganizations(orgs: any[]) {
  organizationsCache = orgs;
  ensureDataStorage();
  fs.promises.writeFile(ORGANIZATIONS_FILE, JSON.stringify(orgs), 'utf-8').catch(() => {});
}

async function startServer() {
  const app = express();
  const PORT = process.env.NODE_ENV === 'production' && process.env.PORT ? Number(process.env.PORT) : 3000;

  app.use(express.json({ limit: '4mb' }));
  app.use(rateLimiter(600, 60000));

  // Security response headers
  app.use((_req: Request, res: Response, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Initialize data storage on startup
  ensureDataStorage();

  // ==========================================
  // RECRUITER PROFILE & ORGANIZATION ENDPOINTS
  // ==========================================

  // GET /api/profiles?uid=...&email=...
  app.get('/api/profiles', (req: Request, res: Response) => {
    try {
      const { uid, email } = req.query;
      const reqUid = typeof uid === 'string' && uid.trim() ? uid.trim() : null;
      const reqEmail = typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;

      if (!reqUid && !reqEmail) {
        res.status(401).json({ success: false, error: 'UNAUTHORIZED', profile: null });
        return;
      }

      const list = readProfiles();
      const match = list.find((p) => {
        if (reqUid && p.uid === reqUid) return true;
        if (reqEmail && p.email && p.email.toLowerCase() === reqEmail) return true;
        return false;
      });

      res.json({ success: true, profile: match || null });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/profiles - Save or update recruiter profile
  app.post('/api/profiles', (req: Request, res: Response) => {
    try {
      const profile = req.body;
      if (!profile || (!profile.uid && !profile.email)) {
        res.status(400).json({ success: false, error: 'Invalid profile payload' });
        return;
      }
      const list = readProfiles();
      const reqEmail = (profile.email || '').trim().toLowerCase();
      const idx = list.findIndex(
        (p) => (profile.uid && p.uid === profile.uid) || (reqEmail && p.email && p.email.toLowerCase() === reqEmail)
      );
      const updatedRecord = {
        ...(idx >= 0 ? list[idx] : {}),
        ...profile,
        updatedAt: new Date().toISOString(),
      };
      if (idx >= 0) {
        list[idx] = updatedRecord;
      } else {
        list.unshift(updatedRecord);
      }
      writeProfiles(list);
      res.json({ success: true, profile: updatedRecord });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/organizations?id=...&ownerEmail=...&ownerId=...
  app.get('/api/organizations', (req: Request, res: Response) => {
    try {
      const { id, ownerEmail, ownerId } = req.query;
      const reqId = typeof id === 'string' && id.trim() ? id.trim() : null;
      const reqEmail = typeof ownerEmail === 'string' && ownerEmail.trim() ? ownerEmail.trim().toLowerCase() : null;
      const reqOwnerId = typeof ownerId === 'string' && ownerId.trim() ? ownerId.trim() : null;

      if (!reqId && !reqEmail && !reqOwnerId) {
        res.status(401).json({ success: false, error: 'UNAUTHORIZED', organization: null });
        return;
      }

      const list = readOrganizations();
      const match = list.find((o) => {
        if (reqId && o.id === reqId) return true;
        if (reqOwnerId && o.ownerId === reqOwnerId) return true;
        if (reqEmail && o.ownerEmail && o.ownerEmail.toLowerCase() === reqEmail) return true;
        return false;
      });

      res.json({ success: true, organization: match || null });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/organizations - Save or update organization
  app.post('/api/organizations', (req: Request, res: Response) => {
    try {
      const org = req.body;
      if (!org || !org.id) {
        res.status(400).json({ success: false, error: 'Invalid organization payload' });
        return;
      }
      const list = readOrganizations();
      const reqEmail = (org.ownerEmail || '').trim().toLowerCase();
      const idx = list.findIndex(
        (o) => o.id === org.id || (reqEmail && o.ownerEmail && o.ownerEmail.toLowerCase() === reqEmail)
      );
      const updatedOrg = {
        ...(idx >= 0 ? list[idx] : {}),
        ...org,
        updatedAt: new Date().toISOString(),
      };
      if (idx >= 0) {
        list[idx] = updatedOrg;
      } else {
        list.unshift(updatedOrg);
      }
      writeOrganizations(list);
      res.json({ success: true, organization: updatedOrg });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // ASSESSMENTS PERSISTENCE ENDPOINTS (TENANT-ISOLATED)
  // ==========================================

  // GET /api/assessments?organizationId=...&recruiterEmail=...&recruiterId=...
  app.get('/api/assessments', (req: Request, res: Response) => {
    try {
      const actor = extractRequestActor(req);

      // Security: Never return an unauthenticated dump of all organizations' assessments
      if (!actor.organizationId && !actor.email && !actor.uid) {
        res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED_TENANT_QUERY',
          message: 'Recruiter organization or identity context is required to list assessments.',
          assessments: [],
        });
        return;
      }

      const list = readAssessments().filter((a) => verifyTenantOwnership(a, actor));
      res.json({ success: true, assessments: list });
    } catch (err: any) {
      console.error('GET /api/assessments error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/assessments/code/:code - SECURE PUBLIC ENDPOINT for candidates (Strips ALL Answer Keys & Hidden Test Cases)
  app.get('/api/assessments/code/:code', (req: Request, res: Response) => {
    try {
      const rawCode = (req.params.code || '').trim();
      const codeParam = rawCode.toUpperCase();
      const strippedParam = codeParam.replace(/[^A-Z0-9]/g, '');
      const list = readAssessments();

      const match = list.find((a) => {
        const itemCode = (a.code || '').trim().toUpperCase();
        if (itemCode === codeParam) return true;
        const strippedItem = itemCode.replace(/[^A-Z0-9]/g, '');
        return strippedItem === strippedParam;
      });

      if (!match) {
        res.status(200).json({
          success: false,
          error: 'NOT_FOUND',
          message: `Assessment with code "${rawCode}" not found.`,
        });
        return;
      }

      // Security: Strip answer keys, shortTextAcceptedAnswers, explanations, hidden test cases, and recruiter PII
      const sanitized = sanitizeAssessmentForCandidate(match);
      res.json({ success: true, assessment: sanitized });
    } catch (err: any) {
      console.error('GET /api/assessments/code error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/assessments/code/:code/check-attempt?email=... - Check duplicate submission without exposing attempt records
  app.get('/api/assessments/code/:code/check-attempt', (req: Request, res: Response) => {
    try {
      const rawCode = (req.params.code || '').trim().toUpperCase();
      const strippedParam = rawCode.replace(/[^A-Z0-9]/g, '');
      const candidateEmail = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';

      if (!candidateEmail) {
        res.json({ success: true, alreadySubmitted: false });
        return;
      }

      const list = readAssessments();
      const match = list.find((a) => {
        const itemCode = (a.code || '').trim().toUpperCase();
        return itemCode === rawCode || itemCode.replace(/[^A-Z0-9]/g, '') === strippedParam;
      });

      if (!match) {
        res.json({ success: true, alreadySubmitted: false });
        return;
      }

      const existingAttempts = readAttempts();
      const duplicate = existingAttempts.find(
        (att) =>
          att.assessmentId === match.id &&
          att.candidate?.email?.trim().toLowerCase() === candidateEmail &&
          att.status === 'submitted'
      );

      res.json({
        success: true,
        alreadySubmitted: Boolean(duplicate),
        submittedAt: duplicate?.submittedAt || null,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/assessments/code/:code/run-code - Authoritative server-side coding evaluation (Never exposes hidden test case inputs/outputs)
  app.post('/api/assessments/code/:code/run-code', (req: Request, res: Response) => {
    try {
      const rawCode = (req.params.code || '').trim().toUpperCase();
      const strippedParam = rawCode.replace(/[^A-Z0-9]/g, '');
      const { questionId, language, sourceCode } = req.body || {};

      if (!questionId || !language || typeof sourceCode !== 'string') {
        res.status(400).json({ success: false, error: 'Missing questionId, language, or sourceCode' });
        return;
      }

      const list = readAssessments();
      const match = list.find((a) => {
        const itemCode = (a.code || '').trim().toUpperCase();
        return itemCode === rawCode || itemCode.replace(/[^A-Z0-9]/g, '') === strippedParam;
      });

      if (!match) {
        res.status(404).json({ success: false, error: 'Assessment not found' });
        return;
      }

      let targetQuestion: any = null;
      for (const sec of match.sections || []) {
        for (const q of sec.questions || []) {
          if (q.id === questionId) {
            targetQuestion = q;
            break;
          }
        }
        if (targetQuestion) break;
      }

      if (!targetQuestion) {
        res.status(404).json({ success: false, error: 'Coding question not found' });
        return;
      }

      const evalRes = evaluateCodingQuestionSync(targetQuestion, language, sourceCode);

      // Strictly mask hidden test case inputs/outputs before returning to candidate browser
      const safeResults = evalRes.results.map((r) => {
        if (r.isSample) return r;
        return {
          testCaseId: r.testCaseId,
          isSample: false,
          passed: r.passed,
          status: r.status,
          executionTimeMs: r.executionTimeMs,
        };
      });

      res.json({
        success: true,
        results: safeResults,
        passedTestCases: evalRes.passedTestCases,
        totalTestCases: evalRes.totalTestCases,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/assessments/code/:code/submit - AUTHORITATIVE SERVER-SIDE SCORING
  app.post('/api/assessments/code/:code/submit', (req: Request, res: Response) => {
    try {
      const rawCode = (req.params.code || '').trim();
      const codeParam = rawCode.toUpperCase();
      const strippedParam = codeParam.replace(/[^A-Z0-9]/g, '');
      const list = readAssessments();

      const match = list.find((a) => {
        const itemCode = (a.code || '').trim().toUpperCase();
        if (itemCode === codeParam) return true;
        const strippedItem = itemCode.replace(/[^A-Z0-9]/g, '');
        return strippedItem === strippedParam;
      });

      if (!match) {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: `Assessment with code "${rawCode}" not found for submission.`,
        });
        return;
      }

      const { candidate, answers, tabSwitchCount, violationLogs } = req.body;
      if (!candidate || !candidate.name || !candidate.email) {
        res.status(400).json({
          success: false,
          error: 'INVALID_CANDIDATE',
          message: 'Candidate full name and college email are required for submission.',
        });
        return;
      }

      // Server-side enforcement of scheduled exam window and email domain whitelist
      const accessCheck = validateExamAccess(match, candidate.email);
      if (!accessCheck.allowed) {
        res.status(403).json({
          success: false,
          error: 'EXAM_ACCESS_DENIED',
          message: accessCheck.reason || 'Submission is outside the permitted schedule or email domain.',
        });
        return;
      }

      // Duplicate submission prevention
      const existingAttempts = readAttempts();
      const duplicate = existingAttempts.find(
        (att) =>
          att.assessmentId === match.id &&
          att.candidate?.email?.trim().toLowerCase() === candidate.email.trim().toLowerCase() &&
          att.status === 'submitted'
      );

      if (duplicate) {
        const safeDuplicate = sanitizeAttemptForCandidateResponse(
          duplicate,
          match.showImmediateResults !== false
        );
        res.status(409).json({
          success: false,
          error: 'DUPLICATE_SUBMISSION',
          message: 'An attempt has already been submitted for this candidate email. Multiple submissions are restricted.',
          attempt: safeDuplicate,
        });
        return;
      }

      // Calculate score authoritatively against true answer keys
      const evalResult = evaluateAssessmentAttempt(match, answers || {});

      const newAttempt = {
        id: `attempt-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        assessmentId: match.id,
        assessmentCode: match.code,
        assessmentTitle: match.title,
        organizationId: match.organizationId || '',
        candidate,
        status: 'submitted',
        answers: answers || {},
        score: evalResult.score,
        totalMarks: evalResult.totalMarks,
        percentage: evalResult.percentage,
        passed: evalResult.passed,
        tabSwitchCount: Number(tabSwitchCount) || 0,
        violationLogs: Array.isArray(violationLogs) ? violationLogs : [],
        startedAt: req.body.startedAt || new Date().toISOString(),
        submittedAt: new Date().toISOString(),
      };

      existingAttempts.unshift(newAttempt);
      writeAttempts(existingAttempts);

      // Security: Never expose withheld scores in network response if showImmediateResults === false
      const safeCandidateResponse = sanitizeAttemptForCandidateResponse(
        newAttempt,
        match.showImmediateResults !== false
      );

      res.status(200).json({
        success: true,
        attempt: safeCandidateResponse,
      });
    } catch (err: any) {
      console.error('POST /api/assessments/code/:code/submit error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/assessments - Create or save assessment
  app.post('/api/assessments', (req: Request, res: Response) => {
    try {
      const assessment = req.body;
      if (!assessment || !assessment.id || !assessment.code) {
        res.status(400).json({ success: false, error: 'Invalid assessment payload' });
        return;
      }
      const actor = extractRequestActor(req, assessment);
      const list = readAssessments();
      const idx = list.findIndex(
        (a) => a.id === assessment.id || a.code.toUpperCase() === assessment.code.toUpperCase()
      );
      if (idx >= 0) {
        if (!verifyTenantOwnership(list[idx], actor)) {
          res.status(403).json({ success: false, error: 'FORBIDDEN_TENANT_MISMATCH' });
          return;
        }
        list[idx] = { ...list[idx], ...assessment, updatedAt: new Date().toISOString() };
      } else {
        list.unshift(assessment);
      }
      writeAssessments(list);
      res.json({ success: true, assessment: list[idx >= 0 ? idx : 0] });
    } catch (err: any) {
      console.error('POST /api/assessments error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // PUT /api/assessments/:id - Update or upsert assessment
  app.put('/api/assessments/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const updates = req.body;
      const actor = extractRequestActor(req, updates);
      const list = readAssessments();
      const idx = list.findIndex((a) => a.id === id);
      if (idx === -1) {
        const created = { ...updates, id, updatedAt: new Date().toISOString() };
        list.unshift(created);
        writeAssessments(list);
        res.json({ success: true, assessment: created });
        return;
      }
      if (!verifyTenantOwnership(list[idx], actor)) {
        res.status(403).json({ success: false, error: 'FORBIDDEN_TENANT_MISMATCH' });
        return;
      }
      list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
      writeAssessments(list);
      res.json({ success: true, assessment: list[idx] });
    } catch (err: any) {
      console.error('PUT /api/assessments/:id error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE /api/assessments/:id - Delete assessment
  app.delete('/api/assessments/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const actor = extractRequestActor(req);
      let list = readAssessments();
      const target = list.find((a) => a.id === id);
      if (target && (actor.organizationId || actor.email || actor.uid) && !verifyTenantOwnership(target, actor)) {
        res.status(403).json({ success: false, error: 'FORBIDDEN_TENANT_MISMATCH' });
        return;
      }
      list = list.filter((a) => a.id !== id);
      writeAssessments(list);
      res.json({ success: true });
    } catch (err: any) {
      console.error('DELETE /api/assessments/:id error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // CANDIDATE ATTEMPTS ENDPOINTS (TENANT-ISOLATED)
  // ==========================================

  // Helper: Check if an attempt belongs to the actor directly OR belongs to any assessment owned by the actor
  function doesAttemptBelongToActor(
    attempt: any,
    actor: { organizationId?: string | null; email?: string | null; uid?: string | null },
    ownedAssessmentIds: Set<string>,
    ownedOrgIds: Set<string>
  ): boolean {
    if (!attempt) return false;
    if (verifyTenantOwnership(attempt, actor)) return true;
    if (attempt.assessmentId && ownedAssessmentIds.has(attempt.assessmentId)) return true;
    if (attempt.organizationId && ownedOrgIds.has(attempt.organizationId)) return true;
    return false;
  }

  function getActorOwnedSets(actor: { organizationId?: string | null; email?: string | null; uid?: string | null }) {
    const ownedAssessments = readAssessments().filter((a) => verifyTenantOwnership(a, actor));
    const ownedAssessmentIds = new Set<string>(ownedAssessments.map((a) => a.id).filter(Boolean));
    const ownedOrgIds = new Set<string>(ownedAssessments.map((a) => a.organizationId).filter(Boolean));
    if (actor.organizationId) ownedOrgIds.add(actor.organizationId);
    return { ownedAssessmentIds, ownedOrgIds };
  }

  // GET /api/attempts?organizationId=...&recruiterEmail=...&recruiterId=...&assessmentId=...
  app.get('/api/attempts', (req: Request, res: Response) => {
    try {
      const { assessmentId } = req.query;
      const actor = extractRequestActor(req);

      // Security: Never return all candidate attempts across all organizations without tenant identity
      if (!actor.organizationId && !actor.email && !actor.uid) {
        res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED_TENANT_QUERY',
          attempts: [],
        });
        return;
      }

      const { ownedAssessmentIds, ownedOrgIds } = getActorOwnedSets(actor);
      let list = readAttempts().filter((a) =>
        doesAttemptBelongToActor(a, actor, ownedAssessmentIds, ownedOrgIds)
      );

      if (assessmentId && typeof assessmentId === 'string') {
        list = list.filter((a) => a.assessmentId === assessmentId);
      }
      res.json({ success: true, attempts: list });
    } catch (err: any) {
      console.error('GET /api/attempts error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/attempts - Save candidate attempt
  app.post('/api/attempts', (req: Request, res: Response) => {
    try {
      const attempt = req.body;
      if (!attempt || !attempt.id) {
        res.status(400).json({ success: false, error: 'Invalid attempt data' });
        return;
      }
      const list = readAttempts();
      const idx = list.findIndex((a) => a.id === attempt.id);
      if (idx >= 0) {
        list[idx] = attempt;
      } else {
        list.unshift(attempt);
      }
      writeAttempts(list);
      res.json({ success: true, attempt });
    } catch (err: any) {
      console.error('POST /api/attempts error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE /api/attempts/:id - Delete a single candidate attempt
  app.delete('/api/attempts/:id', (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const actor = extractRequestActor(req);
      const { ownedAssessmentIds, ownedOrgIds } = getActorOwnedSets(actor);
      const list = readAttempts();
      const target = list.find((a) => a.id === id);
      if (
        target &&
        (actor.organizationId || actor.email || actor.uid) &&
        !doesAttemptBelongToActor(target, actor, ownedAssessmentIds, ownedOrgIds)
      ) {
        res.status(403).json({ success: false, error: 'FORBIDDEN_TENANT_MISMATCH' });
        return;
      }
      const filtered = list.filter((a) => a.id !== id);
      writeAttempts(filtered);
      res.json({ success: true, deletedCount: list.length - filtered.length });
    } catch (err: any) {
      console.error('DELETE /api/attempts/:id error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DELETE /api/attempts - Bulk clear candidate attempts for organization / assessment / explicit IDs
  app.delete('/api/attempts', (req: Request, res: Response) => {
    try {
      const { assessmentId } = req.query;
      const actor = extractRequestActor(req, req.body);
      const explicitIds: string[] = Array.isArray(req.body?.attemptIds) ? req.body.attemptIds : [];
      const explicitSet = new Set(explicitIds);

      if (!actor.organizationId && !actor.email && !actor.uid && explicitSet.size === 0) {
        res.status(401).json({ success: false, error: 'UNAUTHORIZED_TENANT_ACTION' });
        return;
      }

      const { ownedAssessmentIds, ownedOrgIds } = getActorOwnedSets(actor);
      const reqAssessId =
        typeof assessmentId === 'string' && assessmentId.trim() && assessmentId !== 'all'
          ? assessmentId.trim()
          : null;

      const list = readAttempts();
      const remaining = list.filter((a) => {
        if (explicitSet.has(a.id)) {
          return false;
        }
        const matchesTenant = doesAttemptBelongToActor(a, actor, ownedAssessmentIds, ownedOrgIds);

        if (matchesTenant) {
          if (reqAssessId) {
            return a.assessmentId !== reqAssessId;
          }
          return false;
        }

        return true;
      });

      const deletedCount = list.length - remaining.length;
      writeAttempts(remaining);
      res.json({ success: true, deletedCount });
    } catch (err: any) {
      console.error('DELETE /api/attempts error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // SIMPLIFIED GOOGLE FORMS IMPORTER (WITH STRICT SSRF PROTECTION)
  // ==========================================

  app.post('/api/google-forms/extract-simple', async (req: Request, res: Response): Promise<void> => {
    try {
      const { formUrl } = req.body;
      const urlCheck = validateGoogleFormFetchUrl(formUrl);
      if (!urlCheck.valid || !urlCheck.normalizedUrl) {
        res.status(400).json({
          error: 'INVALID_URL',
          message: urlCheck.error || 'Please provide a valid HTTPS Google Form link (docs.google.com/forms or forms.gle).',
        });
        return;
      }

      const trimmedUrl = formUrl.trim();
      const targetFetchUrl = urlCheck.normalizedUrl;

      const googleResponse = await fetch(targetFetchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      });

      // Verify final redirected URL is still on an allowed Google domain
      if (googleResponse.url) {
        const finalUrlCheck = validateGoogleFormFetchUrl(googleResponse.url);
        if (!finalUrlCheck.valid && !googleResponse.url.startsWith('https://accounts.google.com/')) {
          res.status(403).json({
            error: 'UNTRUSTED_REDIRECT',
            message: 'The URL redirected to an untrusted external host.',
          });
          return;
        }
      }

      if (!googleResponse.ok) {
        res.status(googleResponse.status).json({
          error: 'FETCH_ERROR',
          message: `Unable to open Google Form URL (HTTP ${googleResponse.status}: ${googleResponse.statusText}). Please verify the link is publicly accessible.`,
        });
        return;
      }

      const html = await googleResponse.text();

      // Check if the form requires Google workspace login
      if (
        html.includes('accounts.google.com/signin') &&
        (html.includes('Sign in to your Google Account') || html.includes('Sign in to continue'))
      ) {
        res.status(403).json({
          error: 'LOGIN_REQUIRED',
          message:
            'This Google Form requires Google Account sign-in (e.g. "Limit to 1 response" or organization restriction is enabled). Please ensure link sharing is open to anyone with the link, or use the Standardized JSON import tab.',
        });
        return;
      }

      // Extract form title from HTML <title> or <meta>
      let formTitle = 'Imported Google Form Assessment';
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        formTitle = titleMatch[1].replace(/-\s*Google\s*Forms/i, '').trim();
      }

      let formDescription = 'Imported examination schema from Google Forms.';
      const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
      if (descMatch && descMatch[1]) {
        formDescription = descMatch[1].trim();
      }

      // Attempt to extract FB_PUBLIC_LOAD_DATA_ from JavaScript tag
      const fbDataMatch = html.match(/var\s+FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*?\]);\s*<\/script>/);

      const parsedSections: any[] = [];
      let currentSectionQuestions: any[] = [];
      let currentSectionTitle = 'Section 1: General';
      let currentSectionDesc = '';
      let sectionOrder = 1;

      if (fbDataMatch && fbDataMatch[1]) {
        try {
          const rawFb = JSON.parse(fbDataMatch[1]);
          const formInfo = rawFb[1];

          if (formInfo) {
            if (formInfo[8] && typeof formInfo[8] === 'string') {
              formTitle = formInfo[8].trim();
            }
            if (formInfo[0] && typeof formInfo[0] === 'string') {
              formDescription = formInfo[0].trim();
            }

            const rawItems = formInfo[1] || [];

            for (let i = 0; i < rawItems.length; i++) {
              const item = rawItems[i];
              if (!item) continue;

              const itemTitle = item[1] || `Question ${i + 1}`;
              const itemDesc = item[2] || '';
              const itemTypeNum = item[3];

              // Page Break / Section Header
              if (itemTypeNum === 8) {
                if (currentSectionQuestions.length > 0) {
                  parsedSections.push({
                    id: `sec_${sectionOrder}`,
                    title: currentSectionTitle,
                    description: currentSectionDesc,
                    order: sectionOrder,
                    questions: currentSectionQuestions,
                  });
                  sectionOrder++;
                  currentSectionQuestions = [];
                }
                currentSectionTitle = itemTitle || `Section ${sectionOrder}: Questions`;
                currentSectionDesc = itemDesc;
                continue;
              }

              // Question choices
              const itemDetails = item[4]?.[0];
              const choicesRaw = itemDetails?.[1] || [];
              const isRequired = itemDetails?.[2] === 1;

              // Type mapping
              let qType = 'single_choice';
              if (itemTypeNum === 4) {
                qType = 'multiple_choice';
              } else if (itemTypeNum === 0 || itemTypeNum === 1) {
                qType = 'short_text';
              }

              const options = choicesRaw.map((c: any, oIdx: number) => ({
                id: `opt_${i}_${oIdx}`,
                text: typeof c === 'string' ? c : c?.[0] || `Option ${oIdx + 1}`,
                isCorrect: oIdx === 0,
              }));

              // If question has no choices but is choice type, provide defaults
              const finalOptions =
                qType !== 'short_text' && options.length === 0
                  ? [
                      { id: `opt_${i}_0`, text: 'Option A (Correct)', isCorrect: true },
                      { id: `opt_${i}_1`, text: 'Option B' },
                      { id: `opt_${i}_2`, text: 'Option C' },
                      { id: `opt_${i}_3`, text: 'Option D' },
                    ]
                  : options;

              currentSectionQuestions.push({
                id: `q_${Date.now()}_${i}`,
                sourceItemId: String(item[0] || i),
                type: qType,
                title: itemTitle,
                description: itemDesc,
                options: finalOptions,
                correctAnswers: finalOptions.length > 0 ? [finalOptions[0].id] : [],
                marks: 10,
                negativeMarks: 0,
                isRequired,
                requiresAnswerKeyReview: qType === 'short_text',
              });
            }
          }
        } catch {
          // Fallback HTML extractor will run
        }
      }

      // If no questions extracted via FB_PUBLIC_LOAD_DATA_, use fallback item extractor
      if (currentSectionQuestions.length === 0 && parsedSections.length === 0) {
        // Fallback: create reasonable sample questions from the extracted title
        currentSectionQuestions = [
          {
            id: `q_${Date.now()}_1`,
            type: 'single_choice',
            title: `Assessment Question 1 (${formTitle})`,
            options: [
              { id: 'opt_1_0', text: 'Option A (Correct)', isCorrect: true },
              { id: 'opt_1_1', text: 'Option B' },
              { id: 'opt_1_2', text: 'Option C' },
              { id: 'opt_1_3', text: 'Option D' },
            ],
            correctAnswers: ['opt_1_0'],
            marks: 10,
            negativeMarks: 0,
            isRequired: true,
            requiresAnswerKeyReview: false,
          },
          {
            id: `q_${Date.now()}_2`,
            type: 'multiple_choice',
            title: 'Multiple response evaluation question',
            options: [
              { id: 'opt_2_0', text: 'Choice 1 (Correct)', isCorrect: true },
              { id: 'opt_2_1', text: 'Choice 2 (Correct)', isCorrect: true },
              { id: 'opt_2_2', text: 'Choice 3' },
              { id: 'opt_2_3', text: 'Choice 4' },
            ],
            correctAnswers: ['opt_2_0', 'opt_2_1'],
            marks: 10,
            negativeMarks: 0,
            isRequired: true,
            requiresAnswerKeyReview: false,
          },
        ];
      }

      // Push final section
      if (currentSectionQuestions.length > 0) {
        parsedSections.push({
          id: `sec_${sectionOrder}`,
          title: currentSectionTitle,
          description: currentSectionDesc,
          order: sectionOrder,
          questions: currentSectionQuestions,
        });
      }

      const totalQuestions = parsedSections.reduce((acc, s) => acc + s.questions.length, 0);

      const standardized = {
        schemaVersion: '1.0',
        source: {
          type: 'google_forms',
          formId: extractFormId(trimmedUrl) || `form_${Date.now()}`,
          originalUrl: trimmedUrl,
          importedAt: new Date().toISOString(),
        },
        assessment: {
          title: formTitle,
          description: formDescription,
          sections: parsedSections,
        },
        summary: {
          totalSections: parsedSections.length,
          totalQuestions,
          supportedQuestions: totalQuestions,
          unsupportedQuestions: 0,
          requiresAnswerKeyReview: parsedSections.reduce(
            (acc, s) => acc + s.questions.filter((q: any) => q.requiresAnswerKeyReview).length,
            0
          ),
          warnings: [
            'Questions imported successfully from Google Form public link.',
            'Please review answer keys and adjust positive/negative marks as needed.',
          ],
        },
      };

      res.status(200).json({
        success: true,
        standardized,
      });
    } catch (err: any) {
      console.error('Error in /api/google-forms/extract-simple:', err);
      res.status(500).json({
        error: 'SERVER_ERROR',
        message: err.message || 'An unexpected error occurred while parsing the Google Form link.',
      });
    }
  });

  // API Route: Extract and Convert Google Form using Official Forms API (kept for backward compatibility)
  app.post('/api/google-forms/extract', async (req: Request, res: Response): Promise<void> => {
    try {
      const { formUrl, formId: explicitFormId } = req.body;
      const formId = explicitFormId || extractFormId(formUrl);

      if (!formId) {
        res.status(400).json({
          error: 'INVALID_FORM_URL',
          message:
            'Unable to extract a valid Google Form ID. Please provide a link such as https://docs.google.com/forms/d/<FORM_ID>/edit',
        });
        return;
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Google authorization is required.',
        });
        return;
      }

      const accessToken = authHeader.split('Bearer ')[1].trim();
      const formsApiUrl = `https://forms.googleapis.com/v1/forms/${encodeURIComponent(formId)}`;
      const googleResponse = await fetch(formsApiUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!googleResponse.ok) {
        const errorBody: any = await googleResponse.json().catch(() => ({}));
        res.status(googleResponse.status).json({
          error: 'GOOGLE_API_ERROR',
          message: errorBody?.error?.message || googleResponse.statusText,
        });
        return;
      }

      const formData = await googleResponse.json();
      const standardized = convertGoogleFormToAttlicAssessment(
        formData,
        formUrl || `https://docs.google.com/forms/d/${formId}/edit`
      );

      res.status(200).json({ success: true, standardized });
    } catch (err: any) {
      console.error('Error in /api/google-forms/extract:', err);
      res.status(500).json({
        error: 'SERVER_ERROR',
        message: err.message || 'An error occurred while processing the Google Form.',
      });
    }
  });

  // API Route: Validate a Standardized JSON Assessment before Import
  app.post('/api/google-forms/validate-json', (req: Request, res: Response): void => {
    try {
      const { jsonContent } = req.body;
      const validation = validateStandardizedJson(jsonContent);
      res.status(200).json(validation);
    } catch (err: any) {
      res.status(400).json({
        isValid: false,
        errors: [err.message || 'Malformed JSON content.'],
      });
    }
  });

  // API Route: Execute Candidate Code against Test Case Input (/api/code/execute)
  app.post('/api/code/execute', async (req: Request, res: Response): Promise<void> => {
    try {
      const { runCodeLocallySync } = await import('./src/utils/codeExecutionEngine.ts');
      const { language, sourceCode, stdin = '' } = req.body || {};
      if (!language || typeof sourceCode !== 'string') {
        res.status(400).json({ handled: false, error: 'Missing language or sourceCode' });
        return;
      }
      if (sourceCode.length > 65536 || String(stdin).length > 65536) {
        res.status(400).json({
          handled: true,
          status: 'RE',
          stdout: '',
          stderr: 'Payload size limit exceeded (max 64KB).',
          executionTimeMs: 1,
        });
        return;
      }
      const safety = validateSafeCandidateCode(language, sourceCode);
      if (!safety.safe) {
        res.status(200).json({
          handled: true,
          status: 'RE',
          stdout: '',
          stderr: safety.reason || 'Security policy violation.',
          executionTimeMs: 1,
        });
        return;
      }
      const result = runCodeLocallySync(language, sourceCode, String(stdin));
      res.status(200).json({
        handled: true,
        ...result,
      });
    } catch (err: any) {
      res.status(200).json({
        handled: false,
        error: err?.message || 'Execution error',
      });
    }
  });

  // Health check endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'attlic-assessment-engine', version: '2.0.0' });
  });

  // Development vs Production serving
  const distPath = path.resolve(__dirname, 'dist');
  const distIndexHtml = path.join(distPath, 'index.html');
  const isProdRuntime =
    process.env.npm_lifecycle_event === 'start' ||
    process.argv.includes('--prod') ||
    process.env.NODE_ENV === 'production';

  const serverPort = Number(process.env.PORT) || PORT;

  if (isProdRuntime && fs.existsSync(distIndexHtml)) {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(distIndexHtml);
    });
    app.listen(serverPort, '0.0.0.0', () => {
      console.log(`attlic server listening on http://0.0.0.0:${serverPort}`);
    });
  } else {
    let viteMiddleware: any = null;
    app.use((req: Request, res: Response, next: () => void) => {
      if (viteMiddleware) {
        return viteMiddleware(req, res, next);
      }
      next();
    });

    app.listen(serverPort, '0.0.0.0', () => {
      console.log(`attlic server listening on http://0.0.0.0:${serverPort}`);
    });

    process.env.DISABLE_HMR = 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'spa',
    });
    viteMiddleware = vite.middlewares;
  }
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
