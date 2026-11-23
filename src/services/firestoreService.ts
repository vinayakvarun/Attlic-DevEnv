/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Cloud Firestore Service Layer with Real Multi-Tenant Organization Isolation
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, isPermissionError, OperationType } from './firebase';
import {
  Assessment,
  CandidateAttempt,
  User,
  Organization,
  OrganizationMember,
  RecruiterRole,
} from '../types';
import { sanitizeAssessmentForCandidate } from '../utils/securitySanitizer';

const DEFAULT_TIMEOUT_MS = 3500;
let quotaExhaustedUntil = 0;

function isQuotaExhaustedError(err: unknown): boolean {
  if (!err) return false;
  const code = String((err as any)?.code || '').toLowerCase();
  const msg = String((err as any)?.message || '').toLowerCase();
  return (
    code.includes('resource-exhausted') ||
    msg.includes('quota limit exceeded') ||
    msg.includes('quota exceeded')
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  if (Date.now() < quotaExhaustedUntil) {
    return Promise.reject(new Error('Firestore read quota temporarily paused'));
  }
  return Promise.race([
    promise.catch((err) => {
      if (isQuotaExhaustedError(err)) {
        quotaExhaustedUntil = Date.now() + 60_000;
      }
      throw err;
    }),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

export const firestoreService = {
  // --- User Profile ---
  async getUserProfile(uid: string): Promise<User | null> {
    if (!uid || Date.now() < quotaExhaustedUntil) return null;
    const path = `users/${uid}`;
    try {
      const docSnap = await withTimeout(getDoc(doc(db, 'users', uid)), 2500);
      if (docSnap.exists()) {
        return docSnap.data() as User;
      }
      return null;
    } catch (error) {
      if (isPermissionError(error)) {
        try {
          handleFirestoreError(error, OperationType.GET, path);
        } catch {
          return null;
        }
      }
      return null;
    }
  },

  async saveUserProfile(user: User): Promise<void> {
    if (!user?.uid) return;
    const path = `users/${user.uid}`;
    try {
      const cleaned = JSON.parse(
        JSON.stringify({
          ...user,
          updatedAt: new Date().toISOString(),
        })
      );
      await withTimeout(setDoc(doc(db, 'users', user.uid), cleaned, { merge: true }), 4000);
    } catch (error) {
      if (isPermissionError(error)) {
        try {
          handleFirestoreError(error, OperationType.WRITE, path);
        } catch {
          // handled
        }
      }
    }
  },

  // --- Organization Management ---
  async getOrganization(orgId: string): Promise<Organization | null> {
    if (!orgId) return null;
    const path = `organizations/${orgId}`;
    try {
      const docSnap = await withTimeout(getDoc(doc(db, 'organizations', orgId)), 4000);
      if (docSnap.exists()) {
        return docSnap.data() as Organization;
      }
      return null;
    } catch (error) {
      if (isPermissionError(error)) {
        try {
          handleFirestoreError(error, OperationType.GET, path);
        } catch {
          return null;
        }
      }
      return null;
    }
  },

  async createOrganization(
    name: string,
    ownerId: string,
    ownerEmail: string,
    additionalDetails?: { companyWebsite?: string; contactPhone?: string; industry?: string }
  ): Promise<Organization> {
    const orgId = `org_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    const now = new Date().toISOString();

    const newOrg: Organization = {
      id: orgId,
      name,
      slug,
      ownerId,
      ownerEmail,
      companyWebsite: additionalDetails?.companyWebsite || '',
      contactPhone: additionalDetails?.contactPhone || '',
      industry: additionalDetails?.industry || 'Technology & Engineering',
      createdAt: now,
      updatedAt: now,
    };

    const path = `organizations/${orgId}`;
    try {
      const cleanedOrg = JSON.parse(JSON.stringify(newOrg));
      await withTimeout(setDoc(doc(db, 'organizations', orgId), cleanedOrg), 4000);

      // Create owner membership record
      const memberId = `${orgId}_${ownerId}`;
      const ownerMember: OrganizationMember = {
        id: memberId,
        organizationId: orgId,
        organizationName: name,
        userId: ownerId,
        userEmail: ownerEmail,
        userName: ownerEmail.split('@')[0],
        role: 'owner',
        status: 'active',
        joinedAt: now,
      };
      const cleanedMember = JSON.parse(JSON.stringify(ownerMember));
      await withTimeout(setDoc(doc(db, 'organizationMembers', memberId), cleanedMember), 4000);
    } catch (error) {
      if (isPermissionError(error)) {
        try {
          handleFirestoreError(error, OperationType.WRITE, path);
        } catch {
          // handled
        }
      }
    }

    return newOrg;
  },

  async updateOrganization(org: Organization): Promise<void> {
    if (!org?.id) return;
    const path = `organizations/${org.id}`;
    try {
      const cleaned = JSON.parse(
        JSON.stringify({
          ...org,
          updatedAt: new Date().toISOString(),
        })
      );
      await withTimeout(setDoc(doc(db, 'organizations', org.id), cleaned, { merge: true }), 4000);
    } catch (error) {
      if (isPermissionError(error)) {
        try {
          handleFirestoreError(error, OperationType.WRITE, path);
        } catch {
          // handled
        }
      }
    }
  },

  // --- Organization Membership & Invites ---
  async getOrganizationMembers(orgId: string): Promise<OrganizationMember[]> {
    if (!orgId) return [];
    const path = 'organizationMembers';
    try {
      const q = query(
        collection(db, 'organizationMembers'),
        where('organizationId', '==', orgId)
      );
      const snapshot = await withTimeout(getDocs(q), 4000);
      return snapshot.docs.map((d) => d.data() as OrganizationMember);
    } catch (error) {
      if (isPermissionError(error)) {
        try {
          handleFirestoreError(error, OperationType.LIST, path);
        } catch {
          return [];
        }
      }
      return [];
    }
  },

  async inviteOrganizationMember(
    orgId: string,
    orgName: string,
    email: string,
    role: RecruiterRole,
    invitedByEmail: string
  ): Promise<OrganizationMember> {
    const now = new Date().toISOString();
    const memberId = `${orgId}_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const newMember: OrganizationMember = {
      id: memberId,
      organizationId: orgId,
      organizationName: orgName,
      userId: `invited_${Date.now()}`,
      userEmail: email.trim().toLowerCase(),
      userName: email.split('@')[0],
      role,
      status: 'invited',
      invitedBy: invitedByEmail,
      joinedAt: now,
    };

    const path = `organizationMembers/${memberId}`;
    try {
      const cleaned = JSON.parse(JSON.stringify(newMember));
      await withTimeout(setDoc(doc(db, 'organizationMembers', memberId), cleaned), 4000);
    } catch (error) {
      if (isPermissionError(error)) {
        try {
          handleFirestoreError(error, OperationType.WRITE, path);
        } catch {
          // handled
        }
      }
    }

    return newMember;
  },

  async removeOrganizationMember(memberId: string): Promise<void> {
    if (!memberId) return;
    const path = `organizationMembers/${memberId}`;
    try {
      await withTimeout(deleteDoc(doc(db, 'organizationMembers', memberId)), 4000);
    } catch (error) {
      if (isPermissionError(error)) {
        try {
          handleFirestoreError(error, OperationType.DELETE, path);
        } catch {
          // handled
        }
      }
    }
  },

  // --- Assessments Isolated by Organization & Recruiter ---
  async getAssessments(organizationId?: string, recruiterEmail?: string): Promise<Assessment[]> {
    const path = 'assessments';
    if (!organizationId && !recruiterEmail) return [];

    try {
      const collRef = collection(db, path);
      const resultsMap = new Map<string, Assessment>();

      if (organizationId) {
        const qOrg = query(collRef, where('organizationId', '==', organizationId));
        const snapOrg = await withTimeout(getDocs(qOrg), 8000);
        snapOrg.docs.forEach((d) => resultsMap.set(d.id, { id: d.id, ...d.data() } as Assessment));
      }

      if (recruiterEmail) {
        const qEmail = query(collRef, where('recruiterEmail', '==', recruiterEmail.trim().toLowerCase()));
        const snapEmail = await withTimeout(getDocs(qEmail), 8000);
        snapEmail.docs.forEach((d) => resultsMap.set(d.id, { id: d.id, ...d.data() } as Assessment));
      }

      return Array.from(resultsMap.values());
    } catch (error) {
      if (isPermissionError(error)) {
        try {
          handleFirestoreError(error, OperationType.LIST, path);
        } catch {
          return [];
        }
      }
      return [];
    }
  },

  // Get single assessment by test code (reads sanitized publicAssessments/{code} first, always strips answer keys)
  async getAssessmentByCode(code: string): Promise<Assessment | null> {
    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!cleanCode) return null;

    // 1. Primary Zero-Trust Lookup: Read from sanitized /publicAssessments/{cleanCode}
    const publicPath = `publicAssessments/${cleanCode}`;
    try {
      const pubSnap = await withTimeout(getDoc(doc(db, 'publicAssessments', cleanCode)), 4000);
      if (pubSnap.exists()) {
        return sanitizeAssessmentForCandidate({ id: pubSnap.data().id || cleanCode, ...pubSnap.data() }) as Assessment;
      }
    } catch {
      // Fallback to authenticated assessment lookup if recruiter is previewing
    }

    const path = 'assessments';
    try {
      const q = query(collection(db, path), where('code', '==', code.trim().toUpperCase()));
      const snapshot = await withTimeout(getDocs(q), 4000);
      if (!snapshot.empty) {
        const firstDoc = snapshot.docs[0];
        return sanitizeAssessmentForCandidate({ id: firstDoc.id, ...firstDoc.data() }) as Assessment;
      }
    } catch (error) {
      if (isPermissionError(error)) {
        try {
          handleFirestoreError(error, OperationType.GET, publicPath);
        } catch {
          return null;
        }
      }
      return null;
    }
    return null;
  },

  // Fetch the full unsanitized assessment (with answer keys & hidden test cases intact) strictly for submission grading
  async getFullAssessmentForEvaluation(
    code: string,
    assessmentId?: string
  ): Promise<Assessment | null> {
    const cleanCode = (code || '').trim().toUpperCase();

    // 1. Direct lookup by assessmentId in /assessments/{assessmentId}
    if (assessmentId && assessmentId.trim()) {
      try {
        const idSnap = await withTimeout(getDoc(doc(db, 'assessments', assessmentId.trim())), 4000);
        if (idSnap.exists()) {
          return { id: idSnap.id, ...idSnap.data() } as Assessment;
        }
      } catch {
        // Continue to query by code
      }
    }

    // 2. Query /assessments where code == cleanCode
    if (!cleanCode) return null;
    try {
      const q = query(collection(db, 'assessments'), where('code', '==', cleanCode));
      const snapshot = await withTimeout(getDocs(q), 4000);
      if (!snapshot.empty) {
        const firstDoc = snapshot.docs[0];
        return { id: firstDoc.id, ...firstDoc.data() } as Assessment;
      }
    } catch {
      return null;
    }
    return null;
  },

  async saveAssessment(assessment: Assessment): Promise<void> {
    if (!assessment?.id) return;
    const path = `assessments/${assessment.id}`;
    try {
      const docRef = doc(db, 'assessments', assessment.id);
      const cleaned = JSON.parse(
        JSON.stringify({
          ...assessment,
          updatedAt: new Date().toISOString(),
        })
      );
      await withTimeout(setDoc(docRef, cleaned, { merge: true }), 4000);

      // Also write sanitized public copy to /publicAssessments/{cleanCode} (Zero-Answer-Key exposure for candidates)
      const cleanCode = (assessment.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      if (cleanCode) {
        const sanitizedPublic = sanitizeAssessmentForCandidate(cleaned);
        if (sanitizedPublic) {
          await withTimeout(setDoc(doc(db, 'publicAssessments', cleanCode), sanitizedPublic, { merge: true }), 4000);
        }
      }
    } catch (error) {
      if (isPermissionError(error)) {
        try {
          handleFirestoreError(error, OperationType.WRITE, path);
        } catch {
          // handled
        }
      }
    }
  },

  async deleteAssessment(assessmentId: string, assessmentCode?: string): Promise<void> {
    if (!assessmentId) return;
    const path = `assessments/${assessmentId}`;
    try {
      await withTimeout(deleteDoc(doc(db, 'assessments', assessmentId)), 4000);
      if (assessmentCode) {
        const cleanCode = assessmentCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
        if (cleanCode) {
          await withTimeout(deleteDoc(doc(db, 'publicAssessments', cleanCode)), 4000).catch(() => {});
        }
      }
    } catch (error) {
      if (isPermissionError(error)) {
        try {
          handleFirestoreError(error, OperationType.DELETE, path);
        } catch {
          // handled
        }
      }
    }
  },

  // --- Candidate Attempts Isolated by Organization & Owned Assessments ---
  async getAttempts(
    organizationId?: string | string[],
    assessmentId?: string | string[]
  ): Promise<CandidateAttempt[]> {
    const path = 'attempts';
    const orgList = Array.isArray(organizationId)
      ? Array.from(new Set(organizationId.filter(Boolean)))
      : organizationId
      ? [organizationId]
      : [];
    const assessList = Array.isArray(assessmentId)
      ? Array.from(new Set(assessmentId.filter(Boolean)))
      : assessmentId
      ? [assessmentId]
      : [];

    if (orgList.length === 0 && assessList.length === 0) return [];

    try {
      const collRef = collection(db, path);
      const attemptsMap = new Map<string, CandidateAttempt>();
      const queryPromises: Promise<any>[] = [];

      for (const orgId of orgList) {
        const q = query(collRef, where('organizationId', '==', orgId));
        queryPromises.push(
          withTimeout(getDocs(q), 15000)
            .then((snap) => {
              snap.docs.forEach((docSnap) => {
                attemptsMap.set(docSnap.id, {
                  id: docSnap.id,
                  ...docSnap.data(),
                } as CandidateAttempt);
              });
            })
            .catch(() => {})
        );
      }

      for (const aId of assessList) {
        const q = query(collRef, where('assessmentId', '==', aId));
        queryPromises.push(
          withTimeout(getDocs(q), 15000)
            .then((snap) => {
              snap.docs.forEach((docSnap) => {
                attemptsMap.set(docSnap.id, {
                  id: docSnap.id,
                  ...docSnap.data(),
                } as CandidateAttempt);
              });
            })
            .catch(() => {})
        );
      }

      await Promise.all(queryPromises);
      return Array.from(attemptsMap.values());
    } catch (error) {
      if (isPermissionError(error)) {
        try {
          handleFirestoreError(error, OperationType.LIST, path);
        } catch {
          return [];
        }
      }
      return [];
    }
  },

  async saveAttempt(attempt: CandidateAttempt): Promise<void> {
    if (!attempt?.id) return;
    const path = `attempts/${attempt.id}`;
    try {
      const docRef = doc(db, 'attempts', attempt.id);
      const cleaned = JSON.parse(JSON.stringify(attempt));
      await withTimeout(setDoc(docRef, cleaned, { merge: true }), 4000);
    } catch (error) {
      if (isPermissionError(error)) {
        try {
          handleFirestoreError(error, OperationType.WRITE, path);
        } catch {
          // handled
        }
      }
    }
  },

  async deleteAttempt(attemptId: string): Promise<void> {
    if (!attemptId) return;
    const path = `attempts/${attemptId}`;
    try {
      await withTimeout(deleteDoc(doc(db, 'attempts', attemptId)), 4000);
    } catch (error) {
      if (isPermissionError(error)) {
        try {
          handleFirestoreError(error, OperationType.DELETE, path);
        } catch {
          // handled
        }
      }
    }
  },

  async clearAttempts(
    organizationId?: string,
    assessmentId?: string,
    explicitAttemptIds?: string[]
  ): Promise<number> {
    const idsToDelete = new Set<string>(explicitAttemptIds || []);

    if (organizationId) {
      try {
        const fetched = await this.getAttempts(
          organizationId,
          assessmentId && assessmentId !== 'all' ? assessmentId : undefined
        );
        fetched.forEach((a) => {
          if (a?.id) idsToDelete.add(a.id);
        });
      } catch {
        // fallback to explicitAttemptIds
      }
    }

    const idList = Array.from(idsToDelete);
    await Promise.all(idList.map((id) => this.deleteAttempt(id)));
    return idList.length;
  },
};
