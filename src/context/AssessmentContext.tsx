/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Assessment & Examination State Management with Organization Isolation
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Assessment, CandidateAttempt, LiveMonitoringSession, Question } from '../types';
import { firestoreService } from '../services/firestoreService';
import { hasDiskApiBackend } from '../services/firebase';
import { evaluateAssessmentAttempt, hasIntactAnswerKey } from '../utils/evaluation';
import { getDefaultCodingConfig } from '../utils/codeExecutionEngine';
import { sanitizeAssessmentForCandidate, sanitizeAttemptForCandidateResponse } from '../utils/securitySanitizer';
import { useAuth } from './AuthContext';

interface AssessmentContextType {
  assessments: Assessment[];
  attempts: CandidateAttempt[];
  loading: boolean;
  refreshData: () => Promise<void>;
  createAssessment: (
    assessment: Omit<Assessment, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'organizationId'>
  ) => Promise<Assessment>;
  createDraftAssessment: (partial?: Partial<Assessment>) => Promise<Assessment>;
  updateAssessment: (assessment: Assessment) => Promise<void>;
  deleteAssessment: (id: string) => Promise<void>;
  publishAssessment: (id: string) => Promise<void>;
  submitCandidateAttempt: (attempt: CandidateAttempt) => Promise<CandidateAttempt>;
  clearCandidateData: (options?: { assessmentId?: string }) => Promise<{ clearedCount: number }>;
  getAssessmentByCode: (code: string) => Promise<Assessment | null>;
  getAssessmentById: (id: string) => Assessment | undefined;
  importFromGoogleFormFormat: (rawContent: string, assessmentMeta: Partial<Assessment>) => Promise<Assessment>;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export const AssessmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentOrg, currentUser } = useAuth();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [attempts, setAttempts] = useState<CandidateAttempt[]>([]);
  const [loading, setLoading] = useState(false);

  // Helper to load/save local backup
  const getLocalAssessments = (): Assessment[] => {
    try {
      const stored = localStorage.getItem('attlic_local_assessments');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const saveLocalAssessments = (items: Assessment[]) => {
    try {
      localStorage.setItem('attlic_local_assessments', JSON.stringify(items));
    } catch {
      // ignore quota errors
    }
  };

  const refreshData = async () => {
    // If user is completely unauthenticated and has no org, clear dashboard state
    if (!currentUser && !currentOrg?.id) {
      setAssessments([]);
      setAttempts([]);
      return;
    }

    try {
      setLoading(true);
      const orgId = currentOrg?.id || '';
      const email = (currentUser?.email || '').trim().toLowerCase();
      const uid = currentUser?.uid || '';

      // 1. Fetch from server disk-backed API with multi-field matching (when running with server.ts)
      let serverAssessments: Assessment[] = [];
      let serverAttempts: CandidateAttempt[] = [];

      if (hasDiskApiBackend()) {
        try {
          const params = new URLSearchParams();
          if (orgId) params.set('organizationId', orgId);
          if (email) params.set('recruiterEmail', email);
          if (uid) params.set('recruiterId', uid);

          const [assessRes, attemptRes] = await Promise.all([
            fetch(`/api/assessments?${params.toString()}`),
            fetch(`/api/attempts?${params.toString()}`),
          ]);
          const assessCt = assessRes.headers.get('content-type') || '';
          const attemptCt = attemptRes.headers.get('content-type') || '';
          if (assessRes.ok && assessCt.includes('application/json')) {
            const data = await assessRes.json();
            if (data.success && Array.isArray(data.assessments)) {
              serverAssessments = data.assessments;
            }
          }
          if (attemptRes.ok && attemptCt.includes('application/json')) {
            const data = await attemptRes.json();
            if (data.success && Array.isArray(data.attempts)) {
              serverAttempts = data.attempts;
            }
          }
        } catch {
          // Fallback to local/cloud stores
        }
      }

      // Match from local storage cache immediately
      const allLocal = getLocalAssessments();
      const localList = allLocal.filter((a) => {
        if (orgId && a.organizationId === orgId) return true;
        if (email && a.recruiterEmail && a.recruiterEmail.toLowerCase() === email) return true;
        if (uid && a.recruiterId === uid) return true;
        return false;
      });

      // Immediately render server + local assessments and attempts so Recruiter Dashboard & Candidates tab load with zero delay
      const initialAssessmentsMap = new Map<string, Assessment>();
      [...serverAssessments, ...localList].forEach((item) => {
        if (item && item.id && !initialAssessmentsMap.has(item.id)) {
          initialAssessmentsMap.set(item.id, item);
        }
      });
      if (initialAssessmentsMap.size > 0) {
        setAssessments(Array.from(initialAssessmentsMap.values()));
      }
      if (serverAttempts.length > 0) {
        setAttempts(serverAttempts);
        setLoading(false);
      }

      // 2. Fetch assessments from Firestore (best effort in background, ignoring pre-reset records)
      const resetEpoch = '2026-11-18T12:46:37.000Z';
      let firestoreAssessments: Assessment[] = [];
      try {
        if (orgId || email) {
          const rawFsAssessments = await firestoreService.getAssessments(orgId, email);
          firestoreAssessments = rawFsAssessments.filter(
            (a) => (a.createdAt || a.updatedAt || '') >= resetEpoch
          );
        }
      } catch {
        // Firestore may be offline or quota-limited
      }

      // Merge and deduplicate assessments by id
      const combinedAssessmentsMap = new Map<string, Assessment>();
      [...serverAssessments, ...localList, ...firestoreAssessments].forEach((item) => {
        if (item && item.id && !combinedAssessmentsMap.has(item.id)) {
          combinedAssessmentsMap.set(item.id, item);
        }
      });

      const mergedAssessments = Array.from(combinedAssessmentsMap.values());

      // Collect all organizationIds and assessmentIds owned by this recruiter so attempts created
      // under any of the recruiter's assessments (including legacy orgIds) are always loaded!
      const allRecruiterOrgIds = Array.from(
        new Set([orgId, ...mergedAssessments.map((a) => a.organizationId)].filter(Boolean))
      );
      const allRecruiterAssessmentIds = Array.from(
        new Set(mergedAssessments.map((a) => a.id).filter(Boolean))
      );

      let firestoreAttempts: CandidateAttempt[] = [];
      try {
        if (allRecruiterOrgIds.length > 0 || allRecruiterAssessmentIds.length > 0) {
          const rawFsAttempts = await firestoreService.getAttempts(
            allRecruiterOrgIds,
            allRecruiterAssessmentIds
          );
          firestoreAttempts = rawFsAttempts.filter(
            (att) => (att.submittedAt || att.startedAt || '') >= resetEpoch
          );
        }
      } catch {
        // Firestore may be offline or quota-limited
      }

      const mergedAttemptsMap = new Map<string, CandidateAttempt>();

      [...serverAttempts, ...firestoreAttempts].forEach((item) => {
        if (item && item.id && !mergedAttemptsMap.has(item.id)) {
          mergedAttemptsMap.set(item.id, item);
        }
      });

      setAssessments(mergedAssessments);
      setAttempts(Array.from(mergedAttemptsMap.values()));

      // Preserve all known assessments in global cache, merging newly fetched items
      const localMap = new Map<string, Assessment>();
      allLocal.forEach((a) => localMap.set(a.id, a));
      mergedAssessments.forEach((a) => localMap.set(a.id, a));
      saveLocalAssessments(Array.from(localMap.values()));
    } catch {
      // Ignore sync error
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch data whenever the active user or organization changes
  useEffect(() => {
    refreshData();
  }, [currentOrg?.id, currentUser?.email, currentUser?.uid]);

  const createAssessment = async (
    data: Omit<Assessment, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'organizationId'>
  ): Promise<Assessment> => {
    const defaultOrgId = currentUser?.email
      ? `org_${currentUser.email.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 32)}`
      : `org_${Date.now()}`;
    const orgId = currentOrg?.id || defaultOrgId;
    const orgName = currentOrg?.name || currentUser?.organizationName || 'Recruitment Drive';

    const newId = `assess_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const newAssessment: Assessment = {
      ...data,
      id: newId,
      organizationId: orgId,
      organizationName: orgName,
      recruiterId: currentUser?.uid || 'recruiter',
      recruiterEmail: (currentUser?.email || '').trim().toLowerCase(),
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Update in-memory state immediately
    const next = [newAssessment, ...assessments.filter((a) => a.id !== newId)];
    setAssessments(next);

    // 2. Save to localStorage cache preserving other records
    const allLocal = getLocalAssessments().filter((a) => a.id !== newId);
    saveLocalAssessments([newAssessment, ...allLocal]);

    // 3. Persist to server disk storage via REST API
    if (hasDiskApiBackend()) {
      try {
        await fetch('/api/assessments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newAssessment),
        });
      } catch {
        // Rely on local storage
      }
    }

    // 4. Best effort write to Firestore
    try {
      await firestoreService.saveAssessment(newAssessment);
    } catch {
      // Offline fallback
    }

    return newAssessment;
  };

  const createDraftAssessment = async (
    partial?: Partial<Assessment>
  ): Promise<Assessment> => {
    const defaultOrgId = currentUser?.email
      ? `org_${currentUser.email.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 32)}`
      : `org_${Date.now()}`;
    const orgId = currentOrg?.id || defaultOrgId;
    const orgName = currentOrg?.name || currentUser?.organizationName || 'Campus Placement Cell';
    const cleanCode = `CAMPUS-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();
    const newId = `assess_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;

    const draft: Assessment = {
      id: newId,
      organizationId: orgId,
      organizationName: orgName,
      companyName: orgName,
      category: partial?.category || 'Campus Placement',
      recruiterId: currentUser?.uid || 'recruiter',
      recruiterEmail: (currentUser?.email || '').trim().toLowerCase(),
      code: partial?.code || cleanCode,
      title: partial?.title || 'Draft Assessment',
      description: partial?.description || 'Online campus recruitment assessment created via ATTLIC.',
      status: 'draft',
      version: 1,
      durationMinutes: partial?.durationMinutes || 45,
      totalMarks: partial?.totalMarks || 10,
      passingMarks: partial?.passingMarks || 4,
      passingPercentage: 40,
      defaultMarks: 4,
      defaultNegativeMarks: 1,
      showImmediateResults: partial?.showImmediateResults ?? true,
      creationSource: partial?.creationSource || 'scratch',
      enableCodingEnvironment: Boolean(partial?.enableCodingEnvironment),
      instructions: partial?.instructions || [
        'Ensure you have a stable network connection before starting.',
        'True Fullscreen Mode is enforced. Exiting fullscreen will trigger an alert.',
        'Tab switching is monitored and recorded.',
        'Submit before the timer expires. Responses are auto-saved.',
      ],
      tags: partial?.tags || ['Campus 2026', 'Engineering'],
      antiCheating: partial?.antiCheating || {
        trackTabSwitches: true,
        maxTabSwitches: 3,
        enableTwoMinuteViolationBlock: true,
        enforceFullscreen: true,
        forceFullscreen: true,
        blockCopyPaste: true,
        webcamMonitoringNotice: false,
      },
      candidateDetailsConfig: partial?.candidateDetailsConfig || {
        collectFullName: true,
        collectEmail: true,
        collectRollNumber: true,
        collectCollege: true,
        collectBranch: true,
        collectGraduationYear: false,
        collectPhone: true,
        collectCgpa: false,
        customFields: [],
      },
      sections: partial?.sections || [
        {
          id: `sec_${Date.now()}_1`,
          title: 'Section 1: General Aptitude',
          description: 'Logical reasoning and quantitative analysis',
          order: 1,
          questions: [
            {
              id: `q_${Date.now()}_1`,
              type: 'single_choice',
              title: 'What is the next number in the series: 2, 6, 12, 20, 30, ?',
              explanation: 'The difference increases by 2 each time: +4, +6, +8, +10, +12. So 30 + 12 = 42.',
              marks: 4,
              negativeMarks: 1,
              difficulty: 'medium',
              isRequired: false,
              options: [
                { id: 'opt_1', text: '36' },
                { id: 'opt_2', text: '40' },
                { id: 'opt_3', text: '42', isCorrect: true },
                { id: 'opt_4', text: '48' },
              ],
              correctOptionIds: ['opt_3'],
            },
          ],
        },
        ...(partial?.enableCodingEnvironment
          ? [
              {
                id: `sec_${Date.now()}_2`,
                title: 'Section 2: Hands-On Coding Challenge',
                description: 'Write, compile, and run code in Python, C, C++, Java, or JavaScript against automated test cases.',
                isCodingSection: true,
                order: 2,
                questions: [
                  {
                    id: `q_${Date.now()}_code_1`,
                    type: 'coding_problem' as const,
                    title: 'Sum of Array Elements: Given an integer N followed by N space-separated integers, compute and print the total sum of all N elements.',
                    explanation: 'Read N and iterate through all N integers using 64-bit integer accumulation to avoid overflow.',
                    marks: 20,
                    negativeMarks: 0,
                    partialMarking: true,
                    difficulty: 'medium' as const,
                    isRequired: true,
                    options: [],
                    correctOptionIds: [],
                    codingConfig: getDefaultCodingConfig(),
                  },
                ],
              },
            ]
          : []),
      ],
      createdAt: now,
      updatedAt: now,
    };

    const totalCalc = draft.sections.reduce((secSum, s) => {
      return secSum + s.questions.reduce((qSum, q) => qSum + (Number(q.marks) || 0), 0);
    }, 0);
    if (totalCalc > 0) {
      draft.totalMarks = totalCalc;
    }

    setAssessments((prev) => [draft, ...prev.filter((a) => a.id !== newId)]);

    const allLocal = getLocalAssessments().filter((a) => a.id !== newId);
    saveLocalAssessments([draft, ...allLocal]);

    if (hasDiskApiBackend()) {
      try {
        await fetch('/api/assessments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draft),
        });
      } catch {}
    }

    try {
      await firestoreService.saveAssessment(draft);
    } catch {}

    return draft;
  };

  const getAssessmentById = (id: string): Assessment | undefined => {
    return assessments.find((a) => a.id === id);
  };

  const updateAssessment = async (assessment: Assessment): Promise<void> => {
    const updated: Assessment = {
      ...assessment,
      version: (assessment.version || 1) + 1,
      updatedAt: new Date().toISOString(),
    };
    setAssessments((prev) =>
      prev.some((a) => a.id === updated.id)
        ? prev.map((a) => (a.id === updated.id ? updated : a))
        : [updated, ...prev]
    );

    const existingLocal = getLocalAssessments();
    const local = existingLocal.some((a) => a.id === updated.id)
      ? existingLocal.map((a) => (a.id === updated.id ? updated : a))
      : [updated, ...existingLocal];
    saveLocalAssessments(local);

    if (hasDiskApiBackend()) {
      try {
        await fetch(`/api/assessments/${encodeURIComponent(updated.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        });
      } catch {
        // Offline fallback
      }
    }

    try {
      await firestoreService.saveAssessment(updated);
    } catch (e) {
      // offline fallback
    }
  };

  const deleteAssessment = async (id: string): Promise<void> => {
    const target = assessments.find((a) => a.id === id);
    const next = assessments.filter((a) => a.id !== id);
    setAssessments(next);

    const local = getLocalAssessments().filter((a) => a.id !== id);
    saveLocalAssessments(local);

    if (hasDiskApiBackend()) {
      try {
        const params = new URLSearchParams();
        if (currentOrg?.id) params.set('organizationId', currentOrg.id);
        if (currentUser?.email) params.set('recruiterEmail', currentUser.email);
        if (currentUser?.uid) params.set('recruiterId', currentUser.uid);

        await fetch(`/api/assessments/${encodeURIComponent(id)}?${params.toString()}`, {
          method: 'DELETE',
        });
      } catch (e) {
        // ignore
      }
    }

    try {
      await firestoreService.deleteAssessment(id, target?.code);
    } catch (e) {
      // ignore
    }
  };

  const publishAssessment = async (id: string): Promise<void> => {
    const target = assessments.find((a) => a.id === id);
    if (!target) return;
    const updated: Assessment = {
      ...target,
      status: target.status === 'published' ? 'draft' : 'published',
      updatedAt: new Date().toISOString(),
    };
    await updateAssessment(updated);
  };

  // Public & Recruiter access to assessment by code (always returns sanitized candidate payload without answer keys)
  const getAssessmentByCode = async (code: string): Promise<Assessment | null> => {
    const raw = (code || '').trim();
    const cleanCode = raw.toUpperCase();
    const strippedCode = cleanCode.replace(/[^A-Z0-9]/g, '');

    const matchesCode = (testCode?: string) => {
      if (!testCode) return false;
      const tc = testCode.trim().toUpperCase();
      if (tc === cleanCode) return true;
      return tc.replace(/[^A-Z0-9]/g, '') === strippedCode;
    };

    // 1. Query server persistent REST API first when running with server.ts (authoritative & sanitized)
    if (hasDiskApiBackend()) {
      try {
        const response = await fetch(`/api/assessments/code/${encodeURIComponent(cleanCode)}`);
        const ct = response.headers.get('content-type') || '';
        if (response.ok && ct.includes('application/json')) {
          const data = await response.json();
          if (data.success && data.assessment) {
            return sanitizeAssessmentForCandidate(data.assessment);
          }
        }
      } catch {
        // Fallback to local/Firestore
      }
    }

    // 2. Check in-memory state (always sanitize before returning to candidate views)
    const foundMem = assessments.find((a) => matchesCode(a.code));
    if (foundMem) return sanitizeAssessmentForCandidate(foundMem);

    // 3. Check local storage cache (always sanitize before returning to candidate views)
    const allLocal = getLocalAssessments();
    const foundStored = allLocal.find((a) => matchesCode(a.code));
    if (foundStored) return sanitizeAssessmentForCandidate(foundStored);

    // 4. Query Firestore directly (reads from sanitized /publicAssessments/{code})
    try {
      const fsItem = await firestoreService.getAssessmentByCode(cleanCode);
      if (fsItem && (fsItem.createdAt || fsItem.updatedAt || '') >= '2026-11-18T12:46:37.000Z') {
        return sanitizeAssessmentForCandidate(fsItem);
      }
    } catch {
      // offline
    }

    return null;
  };

  const submitCandidateAttempt = async (attempt: CandidateAttempt): Promise<CandidateAttempt> => {
    const cleanCode = (attempt.assessmentCode || '').trim().toUpperCase();
    const allLocal = getLocalAssessments();
    const localOrMemFull = [
      ...assessments,
      ...allLocal,
    ].find(
      (a) =>
        (a.id === attempt.assessmentId ||
          (a.code && a.code.trim().toUpperCase() === cleanCode)) &&
        hasIntactAnswerKey(a)
    );

    // 1. Attempt authoritative server-side scoring & submission (when running with server.ts)
    if (hasDiskApiBackend()) {
      try {
        let serverRes = await fetch(`/api/assessments/code/${encodeURIComponent(cleanCode)}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            candidate: attempt.candidate,
            answers: attempt.answers,
            tabSwitchCount: attempt.tabSwitchCount,
            violationLogs: attempt.violationLogs,
            startedAt: attempt.startedAt,
          }),
        });

        // If server returned 404 because the recruiter assessment hasn't been synced to disk yet, sync it and retry!
        if (serverRes.status === 404 && localOrMemFull) {
          try {
            await fetch('/api/assessments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(localOrMemFull),
            });
            serverRes = await fetch(`/api/assessments/code/${encodeURIComponent(cleanCode)}/submit`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                candidate: attempt.candidate,
                answers: attempt.answers,
                tabSwitchCount: attempt.tabSwitchCount,
                violationLogs: attempt.violationLogs,
                startedAt: attempt.startedAt,
              }),
            });
          } catch {
            // Continue to local evaluation fallback
          }
        }

        const ct = serverRes.headers.get('content-type') || '';
        if (serverRes.ok && ct.includes('application/json')) {
          const data = await serverRes.json();
          if (data.success && data.attempt) {
            const evaluatedAttempt: CandidateAttempt = data.attempt;
            try {
              await firestoreService.saveAttempt(evaluatedAttempt);
            } catch {}

            if (currentOrg?.id && evaluatedAttempt.organizationId === currentOrg.id) {
              setAttempts((prev) => [evaluatedAttempt, ...prev.filter((a) => a.id !== evaluatedAttempt.id)]);
            }
            return evaluatedAttempt;
          }
        }
      } catch {
        // Run local evaluation fallback
      }
    }

    // 2. Direct evaluation + Cloud Firestore write (primary path on Vercel / static hosting)
    // CRITICAL: Must evaluate against the UNSANITIZED assessment containing full answer keys!
    let targetAssessment: Assessment | undefined = localOrMemFull;

    if (!targetAssessment || !hasIntactAnswerKey(targetAssessment)) {
      try {
        const fsFull = await firestoreService.getFullAssessmentForEvaluation(
          cleanCode,
          attempt.assessmentId
        );
        if (fsFull) {
          targetAssessment = fsFull;
        }
      } catch {
        // offline
      }
    }

    if (!targetAssessment) {
      targetAssessment =
        assessments.find(
          (a) => a.id === attempt.assessmentId || (a.code && a.code.trim().toUpperCase() === cleanCode)
        ) ||
        allLocal.find(
          (a) => a.id === attempt.assessmentId || (a.code && a.code.trim().toUpperCase() === cleanCode)
        );
    }

    let evalResult = {
      score: 0,
      totalMarks: attempt.totalMarks || 100,
      percentage: 0,
      passed: false,
    };

    if (targetAssessment) {
      evalResult = evaluateAssessmentAttempt(targetAssessment, attempt.answers);
    }

    const evaluatedAttempt: CandidateAttempt = {
      ...attempt,
      organizationId: targetAssessment?.organizationId || attempt.organizationId || currentOrg?.id || '',
      status: 'submitted',
      score: evalResult.score,
      totalMarks: evalResult.totalMarks,
      percentage: evalResult.percentage,
      passed: evalResult.passed,
      submittedAt: new Date().toISOString(),
    };

    if (hasDiskApiBackend()) {
      try {
        await fetch('/api/attempts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(evaluatedAttempt),
        });
      } catch {}
    }

    // Save full attempt to Cloud Firestore for the organization's recruiter
    try {
      await firestoreService.saveAttempt(evaluatedAttempt);
    } catch (e) {
      // offline fallback
    }

    // 3. Update in-memory state if recruiter of this org is logged in
    if (currentOrg?.id && evaluatedAttempt.organizationId === currentOrg.id) {
      setAttempts((prev) => [evaluatedAttempt, ...prev.filter((a) => a.id !== evaluatedAttempt.id)]);
    }

    return sanitizeAttemptForCandidateResponse(
      evaluatedAttempt,
      targetAssessment?.showImmediateResults !== false
    ) as CandidateAttempt;
  };

  const clearCandidateData = async (options?: {
    assessmentId?: string;
  }): Promise<{ clearedCount: number }> => {
    const targetAssessmentId =
      options?.assessmentId && options.assessmentId !== 'all' ? options.assessmentId : undefined;

    const toClear = targetAssessmentId
      ? attempts.filter((a) => a.assessmentId === targetAssessmentId)
      : [...attempts];
    const toKeep = targetAssessmentId
      ? attempts.filter((a) => a.assessmentId !== targetAssessmentId)
      : [];

    const attemptIdsToDelete = toClear.map((a) => a.id).filter(Boolean);

    // 1. Update in-memory state immediately
    setAttempts(toKeep);

    const orgId = currentOrg?.id || '';
    const email = (currentUser?.email || '').trim().toLowerCase();
    const uid = currentUser?.uid || '';

    // 2. Delete from server disk-backed API (when running with server.ts)
    if (hasDiskApiBackend()) {
      try {
        const params = new URLSearchParams();
        if (orgId) params.set('organizationId', orgId);
        if (email) params.set('recruiterEmail', email);
        if (uid) params.set('recruiterId', uid);
        if (targetAssessmentId) params.set('assessmentId', targetAssessmentId);

        await fetch(`/api/attempts?${params.toString()}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ attemptIds: attemptIdsToDelete }),
        });
      } catch {
        // Offline / serverless fallback
      }
    }

    // 3. Delete from Cloud Firestore
    try {
      await firestoreService.clearAttempts(orgId, targetAssessmentId, attemptIdsToDelete);
    } catch {
      // Offline fallback
    }

    return { clearedCount: toClear.length };
  };

  // Google Forms parser & converter
  const importFromGoogleFormFormat = async (
    rawContent: string,
    meta: Partial<Assessment>
  ): Promise<Assessment> => {
    let parsedQuestions: Question[] = [];

    try {
      if (rawContent.trim().startsWith('{') || rawContent.trim().startsWith('[')) {
        const json = JSON.parse(rawContent);
        const list = Array.isArray(json) ? json : json.questions || json.items || [];
        parsedQuestions = list.map((item: any, idx: number) => ({
          id: `q_imp_${Date.now()}_${idx}`,
          type: item.type === 'multiple' ? 'multiple_choice' : 'single_choice',
          title: item.title || item.question || `Question ${idx + 1}`,
          marks: item.marks || 10,
          negativeMarks: item.negativeMarks || 0,
          difficulty: item.difficulty || 'medium',
          options: (item.options || ['Option A', 'Option B', 'Option C', 'Option D']).map(
            (opt: any, oIdx: number) => ({
              id: `opt_${idx}_${oIdx}`,
              text: typeof opt === 'string' ? opt : opt.text || `Option ${oIdx + 1}`,
              isCorrect: oIdx === (item.correctAnswerIndex ?? 0),
            })
          ),
          correctOptionIds: [`opt_${idx}_${item.correctAnswerIndex ?? 0}`],
          explanation: item.explanation || '',
        }));
      } else {
        const blocks = rawContent.split(/\n\s*\n/).filter((b) => b.trim().length > 0);
        parsedQuestions = blocks.map((block, idx) => {
          const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
          const title = lines[0]?.replace(/^\d+[\.\)]\s*/, '') || `Question ${idx + 1}`;
          const rawOptions = lines.slice(1).filter((l) => l.match(/^([a-dA-D][\.\)]|\*|\-|\•)/));
          const options = (rawOptions.length > 0 ? rawOptions : ['Option A', 'Option B', 'Option C', 'Option D']).map(
            (optText, oIdx) => ({
              id: `opt_${idx}_${oIdx}`,
              text: optText.replace(/^([a-dA-D][\.\)]|\*|\-|\•)\s*/, ''),
              isCorrect: oIdx === 0,
            })
          );
          return {
            id: `q_imp_${Date.now()}_${idx}`,
            type: 'single_choice',
            title,
            marks: 10,
            negativeMarks: 2,
            difficulty: 'medium',
            options,
            correctOptionIds: [`opt_${idx}_0`],
          };
        });
      }
    } catch (e) {
      parsedQuestions = [
        {
          id: `q_fallback_${Date.now()}`,
          type: 'single_choice',
          title: 'Sample Question from Form',
          options: [
            { id: 'opt_f1', text: 'Option A (Correct)', isCorrect: true },
            { id: 'opt_f2', text: 'Option B' },
            { id: 'opt_f3', text: 'Option C' },
            { id: 'opt_f4', text: 'Option D' },
          ],
          correctOptionIds: ['opt_f1'],
          marks: 10,
          negativeMarks: 2,
          difficulty: 'medium',
        },
      ];
    }

    const totalMarks = parsedQuestions.reduce((sum, q) => sum + q.marks, 0);

    return await createAssessment({
      code: `FORM-${Math.floor(1000 + Math.random() * 9000)}`,
      title: meta.title || 'Imported Form Assessment',
      description: meta.description || 'Imported examination schema via Google Form / JSON.',
      recruiterId: currentUser?.uid || '',
      recruiterEmail: currentUser?.email || '',
      organizationName: currentOrg?.name || 'Recruitment Drive',
      status: 'draft',
      durationMinutes: meta.durationMinutes || 30,
      totalMarks: totalMarks > 0 ? totalMarks : 50,
      passingMarks: Math.round((totalMarks > 0 ? totalMarks : 50) * 0.6),
      tags: ['Imported', 'Form'],
      instructions: [
        'Complete all questions within the allocated time.',
        'Review answers before final submission.',
      ],
      antiCheating: {
        trackTabSwitches: true,
        maxTabSwitches: 3,
        enforceFullscreen: true,
        forceFullscreen: true,
        blockCopyPaste: true,
        webcamMonitoringNotice: true,
      },
      sections: [
        {
          id: `sec_${Date.now()}`,
          title: 'Section 1: General Evaluation',
          order: 1,
          questions: parsedQuestions,
        },
      ],
    });
  };

  return (
    <AssessmentContext.Provider
      value={{
        assessments,
        attempts,
        loading,
        refreshData,
        createAssessment,
        createDraftAssessment,
        updateAssessment,
        deleteAssessment,
        publishAssessment,
        submitCandidateAttempt,
        clearCandidateData,
        getAssessmentByCode,
        getAssessmentById,
        importFromGoogleFormFormat,
      }}
    >
      {children}
    </AssessmentContext.Provider>
  );
};

export const useAssessments = () => {
  const context = useContext(AssessmentContext);
  if (!context) {
    throw new Error('useAssessments must be used within an AssessmentProvider');
  }
  return context;
};
