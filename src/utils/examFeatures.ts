/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Exam Randomization, Access Window / Domain Whitelist, & PDF Certificate Generator
 */

import { jsPDF } from 'jspdf';
import type { Assessment, CandidateAttempt, Question } from '../types/index.ts';

/**
 * Deterministic 32-bit FNV-1a hash from any string seed
 */
export function hashSeedString(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Mulberry32 deterministic PRNG returning floats in [0, 1)
 */
export function createSeededRandom(seed: string): () => number {
  let state = hashSeedString(seed || 'attlic_default_seed') || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Fisher-Yates shuffle that never mutates the input array
 */
export function deterministicShuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

/**
 * Applies per-candidate deterministic question shuffling (within each section)
 * and/or MCQ option randomization while keeping option IDs intact for 100% accurate grading.
 */
export function applyCandidateRandomization(
  assessment: Assessment,
  candidateSeed: string
): Assessment {
  const shouldShuffleQuestions = Boolean(assessment.shuffleQuestions);
  const shouldShuffleOptions = Boolean(assessment.shuffleOptions);

  if (!shouldShuffleQuestions && !shouldShuffleOptions) {
    return assessment;
  }

  const normalizedSeed = `${assessment.id || assessment.code}_${(candidateSeed || 'candidate').trim().toLowerCase()}`;

  const nextSections = assessment.sections.map((section, sIdx) => {
    const sectionRng = createSeededRandom(`${normalizedSeed}_sec_${section.id || sIdx}`);
    const baseQuestions: Question[] = shouldShuffleQuestions
      ? deterministicShuffle(section.questions, sectionRng)
      : [...section.questions];

    const processedQuestions: Question[] = baseQuestions.map((question, qIdx) => {
      if (
        shouldShuffleOptions &&
        (question.type === 'single_choice' || question.type === 'multiple_choice') &&
        Array.isArray(question.options) &&
        question.options.length > 1
      ) {
        const optionRng = createSeededRandom(
          `${normalizedSeed}_q_${question.id || qIdx}_opts`
        );
        return {
          ...question,
          options: deterministicShuffle(question.options, optionRng),
        };
      }
      return question;
    });

    return {
      ...section,
      questions: processedQuestions,
    };
  });

  return {
    ...assessment,
    sections: nextSections,
  };
}

export interface ExamAccessValidationResult {
  allowed: boolean;
  status: 'open' | 'not_started' | 'ended' | 'domain_restricted';
  reason?: string;
}

/**
 * Validates whether an assessment is currently within its scheduled window
 * and whether the candidate's email matches the recruiter's allowed email domains/whitelist.
 */
export function validateExamAccess(
  assessment: Assessment,
  candidateEmail?: string,
  now: Date = new Date()
): ExamAccessValidationResult {
  const nowMs = now.getTime();

  // 1. Check Scheduled Start Time
  if (assessment.scheduledStartAt && assessment.scheduledStartAt.trim()) {
    const startMs = Date.parse(assessment.scheduledStartAt);
    if (!Number.isNaN(startMs) && nowMs < startMs) {
      const formattedStart = new Date(startMs).toLocaleString();
      return {
        allowed: false,
        status: 'not_started',
        reason: `This assessment drive has not opened yet. Scheduled start window: ${formattedStart}.`,
      };
    }
  }

  // 2. Check Scheduled End Time
  if (assessment.scheduledEndAt && assessment.scheduledEndAt.trim()) {
    const endMs = Date.parse(assessment.scheduledEndAt);
    if (!Number.isNaN(endMs) && nowMs > endMs) {
      const formattedEnd = new Date(endMs).toLocaleString();
      return {
        allowed: false,
        status: 'ended',
        reason: `This assessment window has closed. Scheduled closing time was ${formattedEnd}.`,
      };
    }
  }

  // 3. Check Email Domain / Candidate Whitelist (only when candidateEmail is provided)
  const rawDomains = (assessment.allowedEmailDomains || [])
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);

  if (rawDomains.length > 0 && candidateEmail !== undefined) {
    const cleanEmail = candidateEmail.trim().toLowerCase();
    const emailParts = cleanEmail.split('@');
    const candidateDomain = emailParts.length === 2 ? emailParts[1] : '';

    const isAllowed = rawDomains.some((entry) => {
      if (entry.includes('@')) {
        return cleanEmail === entry;
      }
      return (
        candidateDomain === entry ||
        candidateDomain.endsWith(`.${entry}`)
      );
    });

    if (!isAllowed) {
      return {
        allowed: false,
        status: 'domain_restricted',
        reason: `Access restricted: Only candidates with authorized institutional email domains (${rawDomains
          .map((d) => (d.includes('@') ? d : `@${d}`))
          .join(', ')}) are permitted for this drive.`,
      };
    }
  }

  return {
    allowed: true,
    status: 'open',
  };
}

/**
 * Escapes HTML special characters for safe certificate rendering
 */
function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates a compact SVG/Canvas fallback verification snapshot data URL
 * when a candidate's desktop/headless device lacks physical camera hardware
 * so they can still complete registration when verified by the system.
 */
export function generateDigitalIdSnapshotDataUrl(
  candidateName: string,
  rollNumber?: string,
  email?: string
): string {
  const initials =
    (candidateName || 'Candidate')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('') || 'CA';
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const safeName = escapeHtml((candidateName || 'Verified Candidate').slice(0, 26));
  const safeRoll = escapeHtml((rollNumber || email || 'ID-VERIFIED').slice(0, 26));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="0 0 240 180">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0A0A0C"/>
        <stop offset="100%" stop-color="#141417"/>
      </linearGradient>
    </defs>
    <rect width="240" height="180" rx="12" fill="url(#bg)" stroke="#F08A43" stroke-width="2"/>
    <circle cx="120" cy="64" r="30" fill="#222226" stroke="#FFB37B" stroke-width="2"/>
    <text x="120" y="72" text-anchor="middle" fill="#FFFFFF" font-family="Ubuntu, sans-serif" font-size="22" font-weight="bold">${initials}</text>
    <text x="120" y="116" text-anchor="middle" fill="#F4F4F5" font-family="Ubuntu, sans-serif" font-size="13" font-weight="bold">${safeName}</text>
    <text x="120" y="134" text-anchor="middle" fill="#FFB37B" font-family="Ubuntu Mono, monospace" font-size="10">${safeRoll}</text>
    <rect x="20" y="146" width="200" height="20" rx="4" fill="#0A0A0C" opacity="0.9"/>
    <text x="120" y="159" text-anchor="middle" fill="#FFB37B" font-family="Ubuntu Mono, monospace" font-size="8.5">ATTLIC SNAPSHOT • ${escapeHtml(timestamp)}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Helper to determine if a hex color is light so subtle card surfaces contrast properly
 */
function isLightHexColor(hex: string): boolean {
  const clean = (hex || '').replace('#', '').trim();
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return false;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}

/**
 * Generates the official standalone HTML for the Candidate Verification Certificate & Scorecard (PDF)
 * Styled dynamically to match the current ATTLIC Black–DarkGrey + Pastel Orange & White theme
 * (or the assessment's active Appearance Studio theme palette when configured).
 */
export function generatePdfCertificateHtml(
  attempt: CandidateAttempt,
  assessment?: Assessment | null,
  options?: { hideScoresForCandidate?: boolean }
): string {
  const companyName =
    assessment?.companyName ||
    assessment?.organizationName ||
    'ATTLIC Campus Placement Partner';
  const submittedDate = new Date(
    attempt.submittedAt || attempt.startedAt || new Date().toISOString()
  ).toLocaleString();
  const verificationHash = `ATTLIC-${(attempt.id || 'VERIFIED')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-8)
    .toUpperCase()}-${attempt.assessmentCode || 'DRIVE'}`;

  const hideScores = Boolean(options?.hideScoresForCandidate);
  const snapshotUrl = attempt.candidate?.snapshotDataUrl;

  const codingAnswers = Object.values(attempt.answers || {}).filter(
    (ans) => ans.codeAnswer && ans.codeAnswer.trim().length > 0
  );

  // Resolve current theme palette (defaults to ATTLIC Black–DarkGrey + Pastel Orange & White)
  const palette = assessment?.appearance?.colors;
  const themeBg = palette?.background || '#0A0A0C';
  const themeSurface = palette?.cardBackground || '#141417';
  const themePrimary = palette?.primary || '#F08A43';
  const themeSecondary = palette?.accent || '#FFB37B';
  const themeTextPrimary = palette?.textMain || '#F4F4F5';
  const themeTextSecondary = palette?.textSecondary || '#A1A1AA';
  const isLightTheme = isLightHexColor(themeSurface);
  const themeBorder = isLightTheme ? '#E4E4E7' : '#222226';
  const themeCardBg = isLightTheme ? themeBg : '#0A0A0C';
  const themeBannerBg = isLightTheme
    ? `linear-gradient(135deg, ${themeSurface} 0%, ${themeBg} 100%)`
    : `linear-gradient(135deg, #0A0A0C 0%, ${themeSurface} 100%)`;
  const themeBannerText = isLightTheme ? themeTextPrimary : '#FFFFFF';

  const statusBadgeText = hideScores
    ? 'SUBMITTED • UNDER RECRUITER REVIEW'
    : attempt.passed
    ? 'QUALIFIED • PASSED'
    : 'COMPLETED • DID NOT CLEAR CUTOFF';

  const statusColor = hideScores
    ? themePrimary
    : attempt.passed
    ? '#10B981'
    : '#F43F5E';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ATTLIC Candidate Certificate - ${escapeHtml(attempt.candidate.name)} (${escapeHtml(attempt.assessmentCode)})</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Ubuntu+Mono:wght@400;700&family=Ubuntu:wght@400;500;700&display=swap" rel="stylesheet">
  <style>
    @font-face {
      font-family: 'Nokia';
      src: url('/fonts/NokiaKokia.ttf') format('truetype'),
           url('/NokiaKokia.ttf') format('truetype'),
           url('/fonts/nokiafc22.woff') format('woff');
      font-weight: 100 900;
      font-style: normal;
      font-display: swap;
    }
    .font-nokia {
      font-family: 'Nokia', 'Ubuntu', sans-serif !important;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @page {
      margin: 14mm;
    }
    body {
      font-family: 'Ubuntu', -apple-system, BlinkMacSystemFont, sans-serif;
      background: ${themeBg};
      color: ${themeTextPrimary};
      padding: 28px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .certificate {
      max-width: 820px;
      margin: 0 auto;
      background: ${themeSurface};
      border: 2px solid ${themePrimary};
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 18px 42px rgba(0, 0, 0, 0.45);
    }
    .banner {
      background: ${themeBannerBg};
      color: ${themeBannerText};
      padding: 26px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid ${themePrimary};
    }
    .brand-wrap {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .brand-circle {
      width: 42px;
      height: 42px;
      border-radius: 9999px;
      background: radial-gradient(circle at 30% 30%, ${themeSecondary} 0%, ${themePrimary} 60%, #141417 100%);
      border: 2px solid ${themeSecondary};
      box-shadow: 0 0 16px rgba(240, 138, 67, 0.45), inset 0 0 8px rgba(255, 255, 255, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 21px;
      font-weight: 900;
      color: #0A0A0C;
      flex-shrink: 0;
    }
    .brand {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: ${themeBannerText};
    }
    .brand span {
      color: ${themeSecondary};
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      display: block;
      margin-top: 4px;
    }
    .verif-box {
      text-align: right;
      font-family: 'Ubuntu Mono', monospace;
      font-size: 11px;
      color: ${themeTextSecondary};
    }
    .verif-box strong {
      color: ${themeSecondary};
      font-size: 13px;
      display: block;
      margin-bottom: 2px;
    }
    .body-content {
      padding: 28px 32px;
    }
    .top-grid {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      align-items: flex-start;
      padding-bottom: 22px;
      border-bottom: 1px solid ${themeBorder};
    }
    .candidate-meta {
      flex: 1;
    }
    .eyebrow {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: ${themePrimary};
      font-weight: 700;
      margin-bottom: 6px;
    }
    .candidate-name {
      font-size: 26px;
      font-weight: 700;
      color: ${themeTextPrimary};
      margin-bottom: 4px;
    }
    .drive-title {
      font-size: 14px;
      color: ${themeTextSecondary};
      margin-bottom: 14px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 18px;
      font-size: 12px;
    }
    .info-item span {
      color: ${themeTextSecondary};
      display: inline-block;
      min-width: 90px;
    }
    .info-item strong {
      color: ${themeTextPrimary};
    }
    .snapshot-frame {
      width: 175px;
      flex-shrink: 0;
      border: 2px solid ${themePrimary};
      border-radius: 12px;
      padding: 8px;
      background: ${themeCardBg};
      text-align: center;
    }
    .snapshot-frame img {
      width: 100%;
      height: 118px;
      object-fit: cover;
      border-radius: 8px;
      border: 1px solid ${themeBorder};
      background: #0A0A0C;
      display: block;
    }
    .snapshot-caption {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: ${themeTextPrimary};
      margin-top: 6px;
      letter-spacing: 0.5px;
    }
    .snapshot-sub {
      font-size: 9px;
      color: ${themeSecondary};
      font-family: 'Ubuntu Mono', monospace;
      margin-top: 2px;
    }
    .score-strip {
      margin-top: 22px;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .metric-card {
      padding: 14px;
      border-radius: 10px;
      background: ${themeCardBg};
      border: 1px solid ${themeBorder};
    }
    .metric-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: ${themeTextSecondary};
      font-weight: 700;
    }
    .metric-val {
      font-size: 20px;
      font-weight: 700;
      color: ${themeSecondary};
      font-family: 'Ubuntu Mono', monospace;
      margin-top: 4px;
    }
    .status-pill {
      display: inline-block;
      margin-top: 6px;
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
      color: #ffffff;
      background: ${statusColor};
    }
    .section-block {
      margin-top: 22px;
      padding-top: 18px;
      border-top: 1px solid ${themeBorder};
    }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: ${themeSecondary};
      margin-bottom: 10px;
    }
    .audit-box {
      padding: 12px 16px;
      border-radius: 10px;
      background: ${themeCardBg};
      border: 1px solid ${themeBorder};
      font-size: 12px;
      color: ${themeTextPrimary};
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .audit-box strong {
      color: ${themeSecondary};
    }
    .footer {
      background: ${themeCardBg};
      border-top: 1px solid ${themeBorder};
      padding: 16px 32px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: ${themeTextSecondary};
    }
    .footer strong {
      color: ${themePrimary};
    }
    @media print {
      body {
        background: ${themeBg} !important;
        color: ${themeTextPrimary} !important;
        padding: 0;
      }
      .certificate {
        background: ${themeSurface} !important;
        border: 2px solid ${themePrimary} !important;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="banner">
      <div class="brand-wrap">
        <div class="brand-circle">A</div>
        <div class="brand">
          <span class="font-nokia" style="display:inline;font-size:inherit;color:inherit;margin:0;letter-spacing:0.05em;">ATTLIC</span>
          <span>Official Assessment Verification Certificate</span>
        </div>
      </div>
      <div class="verif-box">
        <strong>${escapeHtml(verificationHash)}</strong>
        Issued: ${escapeHtml(submittedDate)}
      </div>
    </div>

    <div class="body-content">
      <div class="top-grid">
        <div class="candidate-meta">
          <div class="eyebrow">${escapeHtml(companyName)} • Drive Code: ${escapeHtml(attempt.assessmentCode)}</div>
          <div class="candidate-name">${escapeHtml(attempt.candidate.name)}</div>
          <div class="drive-title">${escapeHtml(attempt.assessmentTitle)}</div>

          <div class="info-grid">
            <div class="info-item"><span>Email:</span> <strong>${escapeHtml(attempt.candidate.email)}</strong></div>
            <div class="info-item"><span>Roll / ID:</span> <strong>${escapeHtml(attempt.candidate.rollNumber || 'N/A')}</strong></div>
            <div class="info-item"><span>Institution:</span> <strong>${escapeHtml(attempt.candidate.college || 'N/A')}</strong></div>
            <div class="info-item"><span>Branch:</span> <strong>${escapeHtml(attempt.candidate.branch || 'N/A')}</strong></div>
            ${attempt.candidate.phone ? `<div class="info-item"><span>Phone:</span> <strong>${escapeHtml(attempt.candidate.phone)}</strong></div>` : ''}
            ${attempt.candidate.cgpa ? `<div class="info-item"><span>CGPA:</span> <strong>${escapeHtml(attempt.candidate.cgpa)}</strong></div>` : ''}
          </div>

          <div style="margin-top: 12px;">
            <span class="status-pill">${escapeHtml(statusBadgeText)}</span>
          </div>
        </div>

        ${
          snapshotUrl
            ? `<div class="snapshot-frame">
                <img src="${snapshotUrl}" alt="Candidate Verification Snapshot" />
                <div class="snapshot-caption">Candidate Snapshot</div>
                <div class="snapshot-sub">✓ Identity Captured</div>
              </div>`
            : ''
        }
      </div>

      ${
        hideScores
          ? `<div class="section-block">
              <div class="section-title">Submission & Evaluation Status</div>
              <div class="audit-box">
                <span>Responses have been cryptographically locked and recorded for recruiter evaluation.</span>
                <strong>Status: SUBMITTED</strong>
              </div>
            </div>`
          : `<div class="score-strip">
              <div class="metric-card">
                <div class="metric-label">Total Score</div>
                <div class="metric-val">${attempt.score} / ${attempt.totalMarks}</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Percentage</div>
                <div class="metric-val">${attempt.percentage}%</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Questions Answered</div>
                <div class="metric-val">${
                  Object.values(attempt.answers || {}).filter(
                    (a) =>
                      (a.selectedOptionIds && a.selectedOptionIds.length > 0) ||
                      Boolean(a.textAnswer?.trim()) ||
                      Boolean(a.codeAnswer?.trim())
                  ).length
                }</div>
              </div>
              <div class="metric-card">
                <div class="metric-label">Tab Switches</div>
                <div class="metric-val">${attempt.tabSwitchCount}</div>
              </div>
            </div>`
      }

      ${
        codingAnswers.length > 0 && !hideScores
          ? `<div class="section-block">
              <div class="section-title">Coding Sandbox Evaluation Summary</div>
              <div class="audit-box">
                <span>Submitted ${codingAnswers.length} coding solution(s) (${codingAnswers
              .map((c) => (c.codingLanguage || 'python').toUpperCase())
              .join(', ')})</span>
                <strong>${codingAnswers.reduce(
                  (acc, c) => acc + (c.passedTestCases ?? 0),
                  0
                )} / ${codingAnswers.reduce(
              (acc, c) => acc + (c.totalTestCases ?? 0),
              0
            )} Test Cases Passed</strong>
              </div>
            </div>`
          : ''
      }

      <div class="section-block">
        <div class="section-title">Proctoring & Integrity Telemetry</div>
        <div class="audit-box">
          <span>${
            attempt.tabSwitchCount === 0
              ? 'Zero proctoring anomalies or unauthorized tab switches recorded during session.'
              : `${attempt.tabSwitchCount} window focus / tab switch event(s) logged during the session.`
          }</span>
          <strong>${
            snapshotUrl ? 'Webcam Snapshot Attached' : 'Proctored Session'
          }</strong>
        </div>
      </div>
    </div>

    <div class="footer">
      <div>Generated by <strong class="font-nokia">ATTLIC</strong> Assessment Platform (attlic.in)</div>
      <div>Verification ID: <strong>${escapeHtml(verificationHash)}</strong></div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Converts a 6-digit hex color string into an RGB tuple for jsPDF.
 */
function hexToRgb(hex: string | undefined, fallback: [number, number, number]): [number, number, number] {
  const clean = (hex || '').replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) return [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) return [r, g, b];
  }
  return fallback;
}

/**
 * Generates a genuine binary PDF document (Uint8Array) for the Candidate Verification
 * Certificate & Scorecard, styled to match the current ATTLIC Black–DarkGrey + Pastel Orange
 * & White theme (or the assessment's Appearance Studio theme palette when configured).
 */
export function generatePdfCertificateBytes(
  attempt: CandidateAttempt,
  assessment?: Assessment | null,
  options?: { hideScoresForCandidate?: boolean }
): Uint8Array {
  const companyName =
    assessment?.companyName ||
    assessment?.organizationName ||
    'ATTLIC Campus Placement Partner';
  const submittedDate = new Date(
    attempt.submittedAt || attempt.startedAt || new Date().toISOString()
  ).toLocaleString();
  const verificationHash = `ATTLIC-${(attempt.id || 'VERIFIED')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-8)
    .toUpperCase()}-${attempt.assessmentCode || 'DRIVE'}`;

  const hideScores = Boolean(options?.hideScoresForCandidate);
  const snapshotUrl = attempt.candidate?.snapshotDataUrl;

  const answeredCount = Object.values(attempt.answers || {}).filter(
    (a) =>
      (a.selectedOptionIds && a.selectedOptionIds.length > 0) ||
      Boolean(a.textAnswer?.trim()) ||
      Boolean(a.codeAnswer?.trim())
  ).length;

  const codingAnswers = Object.values(attempt.answers || {}).filter(
    (ans) => ans.codeAnswer && ans.codeAnswer.trim().length > 0
  );

  // Resolve current theme palette (defaults to ATTLIC Black–DarkGrey + Pastel Orange & White)
  const palette = assessment?.appearance?.colors;
  const themeBgHex = palette?.background || '#0A0A0C';
  const themeSurfaceHex = palette?.cardBackground || '#141417';
  const themePrimaryHex = palette?.primary || '#F08A43';
  const themeAccentHex = palette?.accent || '#FFB37B';
  const themeTextMainHex = palette?.textMain || '#F4F4F5';
  const themeTextSecHex = palette?.textSecondary || '#A1A1AA';
  const isLightTheme = isLightHexColor(themeSurfaceHex);

  const bgRgb = hexToRgb(themeBgHex, [10, 10, 12]);
  const surfaceRgb = hexToRgb(themeSurfaceHex, [20, 20, 23]);
  const primaryRgb = hexToRgb(themePrimaryHex, [240, 138, 67]);
  const accentRgb = hexToRgb(themeAccentHex, [255, 179, 123]);
  const textMainRgb = hexToRgb(themeTextMainHex, [244, 244, 245]);
  const textSecRgb = hexToRgb(themeTextSecHex, [161, 161, 170]);
  const borderRgb: [number, number, number] = isLightTheme ? [228, 228, 231] : [38, 38, 44];
  const cardBgRgb: [number, number, number] = isLightTheme ? bgRgb : [10, 10, 12];
  const bannerBgRgb: [number, number, number] = isLightTheme ? surfaceRgb : [10, 10, 12];

  const statusBadgeText = hideScores
    ? 'SUBMITTED  |  UNDER RECRUITER REVIEW'
    : attempt.passed
    ? 'QUALIFIED  |  PASSED'
    : 'COMPLETED  |  DID NOT CLEAR CUTOFF';

  const statusRgb: [number, number, number] = hideScores
    ? primaryRgb
    : attempt.passed
    ? [16, 185, 129]
    : [244, 63, 94];

  // A4 Portrait (210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  doc.setProperties({
    title: `ATTLIC Candidate Certificate - ${attempt.candidate?.name || 'Candidate'} (${attempt.assessmentCode || 'DRIVE'})`,
    subject: 'Official Assessment Verification Certificate & Scorecard',
    author: 'ATTLIC Assessment Platform',
    creator: 'ATTLIC',
  });

  const pageW = 210;
  const pageH = 297;

  // 1. Full-bleed themed page background
  doc.setFillColor(...bgRgb);
  doc.rect(0, 0, pageW, pageH, 'F');

  // 2. Main Certificate Card Container
  const cardX = 12;
  const cardY = 12;
  const cardW = pageW - 24;
  const cardH = pageH - 24;

  doc.setFillColor(...surfaceRgb);
  doc.setDrawColor(...primaryRgb);
  doc.setLineWidth(0.9);
  doc.roundedRect(cardX, cardY, cardW, cardH, 4, 4, 'FD');

  // 3. Header Banner
  const bannerH = 34;
  doc.setFillColor(...bannerBgRgb);
  doc.roundedRect(cardX + 0.5, cardY + 0.5, cardW - 1, bannerH, 3.5, 3.5, 'F');
  // Square off bottom corners of banner
  doc.rect(cardX + 0.5, cardY + bannerH - 5, cardW - 1, 5.5, 'F');

  // Bottom accent rule under banner
  doc.setDrawColor(...primaryRgb);
  doc.setLineWidth(1.1);
  doc.line(cardX + 0.5, cardY + bannerH, cardX + cardW - 0.5, cardY + bannerH);

  // Brand Circle Emblem ("A")
  const emblemCx = cardX + 16;
  const emblemCy = cardY + 17;
  doc.setFillColor(...primaryRgb);
  doc.setDrawColor(...accentRgb);
  doc.setLineWidth(0.7);
  doc.circle(emblemCx, emblemCy, 7.2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(10, 10, 12);
  doc.text('A', emblemCx, emblemCy + 2.1, { align: 'center' });

  // Brand Name & Certificate Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...textMainRgb);
  doc.text('ATTLIC', cardX + 27, cardY + 16.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...accentRgb);
  doc.text('OFFICIAL ASSESSMENT VERIFICATION CERTIFICATE', cardX + 27, cardY + 23);

  // Right-side Verification Hash & Date
  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...accentRgb);
  doc.text(verificationHash, cardX + cardW - 10, cardY + 15.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textSecRgb);
  doc.text(`Issued: ${submittedDate}`, cardX + cardW - 10, cardY + 22, { align: 'right' });

  // 4. Candidate Metadata & Verification Snapshot Block
  let cursorY = cardY + bannerH + 12;
  const contentX = cardX + 10;
  const contentW = cardW - 20;
  const hasSnapshot = Boolean(snapshotUrl);
  const metaMaxW = hasSnapshot ? contentW - 50 : contentW;

  // Eyebrow: Organization + Drive Code
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryRgb);
  const eyebrowText = `${companyName.toUpperCase()}  |  DRIVE CODE: ${attempt.assessmentCode || 'N/A'}`;
  const eyebrowLines = doc.splitTextToSize(eyebrowText, metaMaxW);
  doc.text(eyebrowLines, contentX, cursorY);
  cursorY += eyebrowLines.length * 4.5 + 3;

  // Candidate Full Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...textMainRgb);
  const nameLines = doc.splitTextToSize(attempt.candidate?.name || 'Candidate', metaMaxW);
  doc.text(nameLines, contentX, cursorY);
  cursorY += nameLines.length * 7.5 + 1.5;

  // Assessment Title
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(...textSecRgb);
  const titleLines = doc.splitTextToSize(attempt.assessmentTitle || 'Online Assessment', metaMaxW);
  doc.text(titleLines, contentX, cursorY);
  cursorY += titleLines.length * 5 + 5;

  // Candidate Details 2-Column Grid
  const detailItems: Array<{ label: string; value: string }> = [
    { label: 'Email', value: attempt.candidate?.email || 'N/A' },
    { label: 'Roll / ID', value: attempt.candidate?.rollNumber || 'N/A' },
    { label: 'Institution', value: attempt.candidate?.college || 'N/A' },
    { label: 'Branch', value: attempt.candidate?.branch || 'N/A' },
  ];
  if (attempt.candidate?.phone) {
    detailItems.push({ label: 'Phone', value: attempt.candidate.phone });
  }
  if (attempt.candidate?.cgpa) {
    detailItems.push({ label: 'CGPA', value: attempt.candidate.cgpa });
  }

  const colW = metaMaxW / 2 - 2;
  const detailStartY = cursorY;
  detailItems.forEach((item, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const xPos = contentX + col * (colW + 4);
    const yPos = detailStartY + row * 10;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(...textSecRgb);
    doc.text(item.label.toUpperCase(), xPos, yPos);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...textMainRgb);
    const valClipped = doc.splitTextToSize(String(item.value), colW)[0] || '';
    doc.text(valClipped, xPos, yPos + 4.2);
  });

  const detailRows = Math.ceil(detailItems.length / 2);
  cursorY = detailStartY + detailRows * 10 + 4;

  // Status Badge Pill
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const pillTextW = doc.getTextWidth(statusBadgeText);
  const pillW = Math.min(metaMaxW, pillTextW + 12);
  doc.setFillColor(...statusRgb);
  doc.roundedRect(contentX, cursorY, pillW, 8, 4, 4, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text(statusBadgeText, contentX + pillW / 2, cursorY + 5.3, { align: 'center' });

  // Candidate Verification Snapshot Frame (top-right of candidate block)
  const snapBoxW = 44;
  const snapBoxH = 44;
  const snapBoxX = cardX + cardW - 10 - snapBoxW;
  const snapBoxY = cardY + bannerH + 10;

  if (hasSnapshot && snapshotUrl) {
    doc.setFillColor(...cardBgRgb);
    doc.setDrawColor(...primaryRgb);
    doc.setLineWidth(0.6);
    doc.roundedRect(snapBoxX, snapBoxY, snapBoxW, snapBoxH, 2.5, 2.5, 'FD');

    const imgX = snapBoxX + 2.5;
    const imgY = snapBoxY + 2.5;
    const imgW = snapBoxW - 5;
    const imgH = 29;

    let imageEmbedded = false;
    if (
      snapshotUrl.startsWith('data:image/jpeg') ||
      snapshotUrl.startsWith('data:image/jpg') ||
      snapshotUrl.startsWith('data:image/png') ||
      snapshotUrl.startsWith('data:image/webp')
    ) {
      try {
        const format = snapshotUrl.startsWith('data:image/png')
          ? 'PNG'
          : snapshotUrl.startsWith('data:image/webp')
          ? 'WEBP'
          : 'JPEG';
        doc.addImage(snapshotUrl, format, imgX, imgY, imgW, imgH, undefined, 'FAST');
        imageEmbedded = true;
      } catch {
        imageEmbedded = false;
      }
    }

    if (!imageEmbedded) {
      // Crisp vector fallback avatar when snapshot is SVG or unsupported format
      doc.setFillColor(20, 20, 24);
      doc.roundedRect(imgX, imgY, imgW, imgH, 1.5, 1.5, 'F');
      const initials =
        (attempt.candidate?.name || 'CA')
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((p) => p.charAt(0).toUpperCase())
          .join('') || 'CA';
      doc.setFillColor(...surfaceRgb);
      doc.setDrawColor(...accentRgb);
      doc.setLineWidth(0.5);
      doc.circle(imgX + imgW / 2, imgY + imgH / 2, 7.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...textMainRgb);
      doc.text(initials, imgX + imgW / 2, imgY + imgH / 2 + 1.5, { align: 'center' });
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...textMainRgb);
    doc.text('CANDIDATE SNAPSHOT', snapBoxX + snapBoxW / 2, snapBoxY + 36.2, { align: 'center' });

    doc.setFont('courier', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...accentRgb);
    doc.text('IDENTITY CAPTURED', snapBoxX + snapBoxW / 2, snapBoxY + 40.5, { align: 'center' });
  }

  cursorY = Math.max(cursorY + 14, hasSnapshot ? snapBoxY + snapBoxH + 8 : cursorY + 14);

  // Divider line
  doc.setDrawColor(...borderRgb);
  doc.setLineWidth(0.35);
  doc.line(contentX, cursorY, contentX + contentW, cursorY);
  cursorY += 8;

  // 5. Scorecard Strip OR Submission Withheld Status
  if (hideScores) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...accentRgb);
    doc.text('SUBMISSION & EVALUATION STATUS', contentX, cursorY);
    cursorY += 4.5;

    doc.setFillColor(...cardBgRgb);
    doc.setDrawColor(...borderRgb);
    doc.setLineWidth(0.4);
    doc.roundedRect(contentX, cursorY, contentW, 18, 2.5, 2.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...textMainRgb);
    const withheldNote = doc.splitTextToSize(
      'Responses have been securely locked and recorded for recruiter evaluation. Final results will be communicated by the organizer.',
      contentW - 42
    );
    doc.text(withheldNote, contentX + 5, cursorY + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...accentRgb);
    doc.text('STATUS: SUBMITTED', contentX + contentW - 5, cursorY + 10.5, { align: 'right' });

    cursorY += 26;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...accentRgb);
    doc.text('OFFICIAL PERFORMANCE SCORECARD', contentX, cursorY);
    cursorY += 4.5;

    const metrics = [
      { label: 'TOTAL SCORE', value: `${attempt.score} / ${attempt.totalMarks}` },
      { label: 'PERCENTAGE', value: `${attempt.percentage}%` },
      { label: 'ANSWERED', value: `${answeredCount}` },
      { label: 'TAB SWITCHES', value: `${attempt.tabSwitchCount ?? 0}` },
    ];

    const gap = 4;
    const metricW = (contentW - gap * 3) / 4;
    const metricH = 22;

    metrics.forEach((m, idx) => {
      const mx = contentX + idx * (metricW + gap);
      doc.setFillColor(...cardBgRgb);
      doc.setDrawColor(...borderRgb);
      doc.setLineWidth(0.4);
      doc.roundedRect(mx, cursorY, metricW, metricH, 2.5, 2.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...textSecRgb);
      doc.text(m.label, mx + 4, cursorY + 7);

      doc.setFont('courier', 'bold');
      doc.setFontSize(13.5);
      doc.setTextColor(...accentRgb);
      doc.text(m.value, mx + 4, cursorY + 16.5);
    });

    cursorY += metricH + 10;
  }

  // 6. Coding Sandbox Evaluation Summary (when coding questions were attempted)
  if (codingAnswers.length > 0 && !hideScores) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...accentRgb);
    doc.text('CODING SANDBOX EVALUATION SUMMARY', contentX, cursorY);
    cursorY += 4.5;

    const totalPassed = codingAnswers.reduce((acc, c) => acc + (c.passedTestCases ?? 0), 0);
    const totalCases = codingAnswers.reduce((acc, c) => acc + (c.totalTestCases ?? 0), 0);
    const langs = codingAnswers
      .map((c) => (c.codingLanguage || 'python').toUpperCase())
      .join(', ');

    doc.setFillColor(...cardBgRgb);
    doc.setDrawColor(...borderRgb);
    doc.setLineWidth(0.4);
    doc.roundedRect(contentX, cursorY, contentW, 15, 2.5, 2.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...textMainRgb);
    doc.text(
      `Submitted ${codingAnswers.length} coding solution(s) (${langs})`,
      contentX + 5,
      cursorY + 9.2
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...accentRgb);
    doc.text(
      `${totalPassed} / ${totalCases} Test Cases Passed`,
      contentX + contentW - 5,
      cursorY + 9.2,
      { align: 'right' }
    );

    cursorY += 23;
  }

  // 7. Proctoring & Integrity Telemetry Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...accentRgb);
  doc.text('PROCTORING & INTEGRITY RECORD', contentX, cursorY);
  cursorY += 4.5;

  doc.setFillColor(...cardBgRgb);
  doc.setDrawColor(...borderRgb);
  doc.setLineWidth(0.4);
  doc.roundedRect(contentX, cursorY, contentW, 16, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(...textMainRgb);
  const proctorMsg =
    (attempt.tabSwitchCount ?? 0) === 0
      ? 'Zero proctoring anomalies or unauthorized tab switches recorded during session.'
      : `${attempt.tabSwitchCount} window focus / tab switch event(s) logged during the session.`;
  doc.text(doc.splitTextToSize(proctorMsg, contentW - 52), contentX + 5, cursorY + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...accentRgb);
  doc.text(
    hasSnapshot ? 'Webcam Snapshot Attached' : 'Proctored Session',
    contentX + contentW - 5,
    cursorY + 9.5,
    { align: 'right' }
  );

  cursorY += 24;

  // 8. Attempt Audit Metadata Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...accentRgb);
  doc.text('AUTHENTICITY & AUDIT METADATA', contentX, cursorY);
  cursorY += 4.5;

  doc.setFillColor(...cardBgRgb);
  doc.setDrawColor(...borderRgb);
  doc.setLineWidth(0.4);
  doc.roundedRect(contentX, cursorY, contentW, 28, 2.5, 2.5, 'FD');

  const auditRows = [
    ['Attempt ID:', attempt.id || 'N/A'],
    ['Assessment Code:', attempt.assessmentCode || 'N/A'],
    ['Verification Hash:', verificationHash],
    ['Submission Timestamp:', submittedDate],
  ];

  auditRows.forEach(([label, val], idx) => {
    const ry = cursorY + 6.5 + idx * 5.8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...textSecRgb);
    doc.text(label, contentX + 5, ry);

    doc.setFont('courier', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(...textMainRgb);
    doc.text(String(val), contentX + 46, ry);
  });

  // 9. Footer Bar anchored at bottom of certificate card
  const footerH = 16;
  const footerY = cardY + cardH - footerH;
  doc.setFillColor(...cardBgRgb);
  doc.setDrawColor(...borderRgb);
  doc.setLineWidth(0.35);
  doc.line(cardX + 0.5, footerY, cardX + cardW - 0.5, footerY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...textSecRgb);
  doc.text('Generated by ATTLIC Assessment Platform (attlic.in)', contentX, footerY + 10);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...primaryRgb);
  doc.text(`Verification ID: ${verificationHash}`, cardX + cardW - 10, footerY + 10, {
    align: 'right',
  });

  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

/**
 * Generates and downloads a genuine binary `.pdf` Certificate & Scorecard directly in the browser
 * (works across all desktop/mobile browsers and sandboxed iframes without popups or HTML fallbacks).
 */
export function downloadCandidatePdfCertificate(
  attempt: CandidateAttempt,
  assessment?: Assessment | null,
  options?: { hideScoresForCandidate?: boolean }
): string {
  const safeCandidate = (attempt.candidate.name || 'candidate')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
  const safeCode = (attempt.assessmentCode || 'drive')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
  const filename = `attlic_certificate_${safeCode}_${safeCandidate}.pdf`;

  const pdfBytes = generatePdfCertificateBytes(attempt, assessment, options);

  if (typeof document !== 'undefined') {
    const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  return filename;
}
