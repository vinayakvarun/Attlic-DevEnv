/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Zero-Trust Security Sanitizer, SSRF Guard & Tenant Isolation Helpers
 */

/**
 * Strips all answer keys, accepted short-text answers, explanations, hidden coding test-case
 * inputs/outputs, and private recruiter identifiers from an assessment before sending it to
 * a candidate or storing it in a public lookup collection.
 */
export function sanitizeAssessmentForCandidate(assessment: any): any {
  if (!assessment || typeof assessment !== 'object') return null;
  const clone = JSON.parse(JSON.stringify(assessment));

  // Remove internal recruiter PII from candidate-visible payload
  delete clone.recruiterEmail;
  delete clone.recruiterId;

  if (Array.isArray(clone.sections)) {
    clone.sections = clone.sections.map((section: any) => {
      const sanitizedSection = { ...section };
      if (Array.isArray(sanitizedSection.questions)) {
        sanitizedSection.questions = sanitizedSection.questions.map((q: any) => {
          const sanitizedQ = { ...q };
          delete sanitizedQ.correctAnswers;
          delete sanitizedQ.correctOptionIds;
          delete sanitizedQ.explanation;
          delete sanitizedQ.shortTextAcceptedAnswers;

          if (Array.isArray(sanitizedQ.options)) {
            sanitizedQ.options = sanitizedQ.options.map((opt: any) => {
              const sanitizedOpt = { ...opt };
              delete sanitizedOpt.isCorrect;
              return sanitizedOpt;
            });
          }

          if (sanitizedQ.codingConfig && typeof sanitizedQ.codingConfig === 'object') {
            const cfg = { ...sanitizedQ.codingConfig };
            // Replace default starter code solution with clean boilerplate if starter code is the full solution
            if (Array.isArray(cfg.testCases)) {
              cfg.testCases = cfg.testCases.map((tc: any, idx: number) => {
                if (tc && tc.isSample) {
                  return {
                    id: tc.id || `tc_sample_${idx + 1}`,
                    input: tc.input ?? '',
                    expectedOutput: tc.expectedOutput ?? '',
                    isSample: true,
                    explanation: tc.explanation,
                    weight: tc.weight ?? 1,
                  };
                }
                // Hidden test case: never expose input or expectedOutput to client
                return {
                  id: tc?.id || `tc_hidden_${idx + 1}`,
                  input: '',
                  expectedOutput: '',
                  isSample: false,
                  isHiddenLocked: true,
                  weight: tc?.weight ?? 1,
                };
              });
            }
            sanitizedQ.codingConfig = cfg;
          }

          return sanitizedQ;
        });
      }
      return sanitizedSection;
    });
  }

  return clone;
}

/**
 * Sanitizes the CandidateAttempt returned to the candidate browser after submission.
 * - Always strips hidden test case inputs/expectedOutputs from codingResults.
 * - When `showImmediateResults === false`, masks `score`, `percentage`, and `passed` so
 *   inspecting the browser Network tab never reveals withheld exam results.
 */
export function sanitizeAttemptForCandidateResponse(
  attempt: any,
  showImmediateResults: boolean = true
): any {
  if (!attempt || typeof attempt !== 'object') return null;
  const clone = JSON.parse(JSON.stringify(attempt));

  if (clone.answers && typeof clone.answers === 'object') {
    for (const qId of Object.keys(clone.answers)) {
      const ans = clone.answers[qId];
      if (ans && Array.isArray(ans.codingResults)) {
        ans.codingResults = ans.codingResults.map((cr: any) => {
          if (cr && cr.isSample) {
            return cr;
          }
          const masked = { ...cr };
          masked.input = '';
          masked.expectedOutput = '';
          masked.actualOutput = '';
          if (!showImmediateResults) {
            delete masked.passed;
            masked.status = 'SUBMITTED';
          }
          return masked;
        });
      }
      if (!showImmediateResults && ans) {
        delete ans.passedTestCases;
      }
    }
  }

  if (!showImmediateResults) {
    clone.score = null;
    clone.percentage = null;
    clone.passed = null;
    clone.resultsWithheld = true;
  }

  return clone;
}

/**
 * Strict SSRF protection for Google Forms URL extraction.
 * Only permits HTTPS requests to official Google Forms hosts (`docs.google.com` and `forms.gle`).
 */
export function validateGoogleFormFetchUrl(rawUrl: string): {
  valid: boolean;
  normalizedUrl?: string;
  error?: string;
} {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'URL is required.' };
  }

  let candidate = rawUrl.trim();
  if (!candidate) {
    return { valid: false, error: 'URL is empty.' };
  }

  if (!candidate.startsWith('http://') && !candidate.startsWith('https://')) {
    candidate = `https://${candidate}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { valid: false, error: 'Malformed URL.' };
  }

  if (parsed.protocol !== 'https:') {
    return {
      valid: false,
      error: 'Only HTTPS Google Forms links are permitted.',
    };
  }

  const allowedHosts = new Set(['docs.google.com', 'forms.gle']);
  const hostname = parsed.hostname.toLowerCase();

  if (!allowedHosts.has(hostname)) {
    return {
      valid: false,
      error: `Untrusted hostname "${hostname}". Only docs.google.com and forms.gle are allowed.`,
    };
  }

  // Reject embedded credentials or non-standard ports
  if (parsed.username || parsed.password || (parsed.port && parsed.port !== '443')) {
    return {
      valid: false,
      error: 'URLs with credentials or non-standard ports are not allowed.',
    };
  }

  if (hostname === 'docs.google.com' && !parsed.pathname.startsWith('/forms/')) {
    return {
      valid: false,
      error: 'Google Docs URL must point to a /forms/ path.',
    };
  }

  let normalized = parsed.toString();
  if (normalized.includes('/edit')) {
    normalized = normalized.replace('/edit', '/viewform');
  }

  return { valid: true, normalizedUrl: normalized };
}

/**
 * Verifies whether a recruiter request context is authorized to access or mutate a tenant record.
 */
export function verifyTenantOwnership(
  record: { organizationId?: string; recruiterEmail?: string; recruiterId?: string; ownerId?: string; ownerEmail?: string; uid?: string; email?: string } | null | undefined,
  actor: { organizationId?: string | null; email?: string | null; uid?: string | null }
): boolean {
  if (!record || !actor) return false;
  const actorOrg = (actor.organizationId || '').trim();
  const actorEmail = (actor.email || '').trim().toLowerCase();
  const actorUid = (actor.uid || '').trim();

  if (!actorOrg && !actorEmail && !actorUid) {
    return false;
  }

  if (actorOrg && record.organizationId && record.organizationId === actorOrg) {
    return true;
  }
  if (actorEmail) {
    if (record.recruiterEmail && record.recruiterEmail.toLowerCase() === actorEmail) return true;
    if (record.ownerEmail && record.ownerEmail.toLowerCase() === actorEmail) return true;
    if (record.email && record.email.toLowerCase() === actorEmail) return true;
  }
  if (actorUid) {
    if (record.recruiterId && record.recruiterId === actorUid) return true;
    if (record.ownerId && record.ownerId === actorUid) return true;
    if (record.uid && record.uid === actorUid) return true;
  }

  return false;
}
