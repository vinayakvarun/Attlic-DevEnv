/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Real Firebase Authentication & Organization Context
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, hasDiskApiBackend } from '../services/firebase';
import {
  signInWithAttlicGoogle,
  createAttlicGoogleProvider,
  clearCachedAccessToken,
} from '../services/googleAuth';
import { firestoreService } from '../services/firestoreService';
import { User, Organization, OrganizationMember, RecruiterRole } from '../types';

interface AuthContextType {
  currentUser: User | null;
  currentOrg: Organization | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  registerWithEmailPassword: (
    email: string,
    pass: string,
    fullName: string,
    organizationName: string,
    jobTitle?: string
  ) => Promise<void>;
  loginWithEmailPassword: (email: string, pass: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInSandboxRecruiter: (orgKey?: 'org_acme' | 'org_global') => Promise<void>;
  updateUserProfile: (updates: Partial<User>) => Promise<void>;
  updateOrganizationDetails: (updates: Partial<Organization>) => Promise<void>;
  switchOrganization: (orgId: string) => Promise<void>;
  reloadUserAndOrg: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const getDeterministicOrgId = (uid?: string, email?: string): string => {
  if (email && email.includes('@')) {
    const cleanEmail = email.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 32);
    return `org_${cleanEmail}`;
  }
  const cleanUid = (uid || 'recruiter').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16);
  return `org_${cleanUid}`;
};

export const BACKEND_RESET_EPOCH_ISO = '2026-11-18T13:30:57.000Z';
const RESET_STORAGE_FLAG = 'attlic_fresh_reset_20261118_v2';
const PENDING_FIREBASE_SIGNOUT_FLAG = 'attlic_pending_firebase_signout';

function ensureFreshLocalStorageOnce() {
  if (typeof window === 'undefined') return;
  try {
    if (localStorage.getItem(RESET_STORAGE_FLAG) !== BACKEND_RESET_EPOCH_ISO) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('attlic_') && k !== RESET_STORAGE_FLAG) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      clearCachedAccessToken();
      localStorage.setItem(RESET_STORAGE_FLAG, BACKEND_RESET_EPOCH_ISO);
      localStorage.setItem(PENDING_FIREBASE_SIGNOUT_FLAG, 'true');
    }
  } catch {}
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  ensureFreshLocalStorageOnce();
  const explicitLoginInProgressRef = useRef<boolean>(false);

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('attlic_recruiter_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.user) return parsed.user;
      }
    } catch {}
    return null;
  });

  const [currentOrg, setCurrentOrg] = useState<Organization | null>(() => {
    try {
      const stored = localStorage.getItem('attlic_recruiter_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.org) return parsed.org;
      }
    } catch {}
    return null;
  });

  const [loading, setLoading] = useState<boolean>(false);

  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  // Sync user profile and organization with persistent stability across logouts
  const syncUserAndOrganization = async (fbUser: FirebaseUser) => {
    const userEmail = (fbUser.email || '').trim().toLowerCase();
    const cleanKey = userEmail ? userEmail.replace(/[^a-z0-9]/g, '_') : fbUser.uid.slice(0, 16);

    // 1. Check localStorage cache first for previously saved profile & org
    let cachedProfile: User | null = null;
    let cachedOrg: Organization | null = null;

    try {
      const storedByEmail = localStorage.getItem(`attlic_recruiter_session_${cleanKey}`);
      if (storedByEmail) {
        const parsed = JSON.parse(storedByEmail);
        if (parsed.user) cachedProfile = parsed.user;
        if (parsed.org) cachedOrg = parsed.org;
      }
      if (!cachedOrg) {
        const cachedOrgStr = localStorage.getItem(`attlic_cached_org_${cleanKey}`);
        if (cachedOrgStr) {
          const parsed = JSON.parse(cachedOrgStr);
          if (parsed.id) cachedOrg = parsed;
        }
      }
    } catch {}

    // 2. Check server disk-backed API for saved profile & organization (only when Express backend is present)
    let serverProfile: User | null = null;
    let serverOrg: Organization | null = null;
    if (hasDiskApiBackend()) {
      try {
        const [profRes, orgRes] = await Promise.all([
          fetch(`/api/profiles?uid=${encodeURIComponent(fbUser.uid)}&email=${encodeURIComponent(userEmail)}`),
          fetch(`/api/organizations?ownerId=${encodeURIComponent(fbUser.uid)}&ownerEmail=${encodeURIComponent(userEmail)}`),
        ]);
        if (profRes.ok && (profRes.headers.get('content-type') || '').includes('application/json')) {
          const data = await profRes.json();
          if (data.success && data.profile) serverProfile = data.profile;
        }
        if (orgRes.ok && (orgRes.headers.get('content-type') || '').includes('application/json')) {
          const data = await orgRes.json();
          if (data.success && data.organization) serverOrg = data.organization;
        }
      } catch {}
    }

    let stableOrgId =
      serverProfile?.organizationId ||
      cachedProfile?.organizationId ||
      serverOrg?.id ||
      cachedOrg?.id ||
      null;
    let stableOrgName =
      serverProfile?.companyName ||
      serverProfile?.organizationName ||
      cachedProfile?.companyName ||
      cachedProfile?.organizationName ||
      serverOrg?.name ||
      cachedOrg?.name ||
      null;

    // 3. Check server assessments if org ID is still unknown
    if (!stableOrgId && userEmail && hasDiskApiBackend()) {
      try {
        const checkRes = await fetch(`/api/assessments?recruiterEmail=${encodeURIComponent(userEmail)}`);
        if (checkRes.ok && (checkRes.headers.get('content-type') || '').includes('application/json')) {
          const checkData = await checkRes.json();
          if (checkData.success && Array.isArray(checkData.assessments) && checkData.assessments.length > 0) {
            const match = checkData.assessments[0];
            if (match.organizationId) stableOrgId = match.organizationId;
            if (match.organizationName) stableOrgName = match.organizationName;
          }
        }
      } catch {}
    }

    if (!stableOrgId) {
      stableOrgId = getDeterministicOrgId(fbUser.uid, userEmail);
    }
    if (!stableOrgName) {
      stableOrgName = `${fbUser.displayName || userEmail.split('@')[0] || 'My'}'s Recruitment Drive`;
    }

    try {
      const fsProfile = await firestoreService.getUserProfile(fbUser.uid);

      // Sort available profile sources by updatedAt ascending so the newest wins when spreading
      const sources = [fsProfile, cachedProfile, serverProfile].filter(Boolean) as User[];
      sources.sort((a, b) => {
        const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return tA - tB;
      });

      let profile: User | null =
        sources.length > 0 ? sources.reduce((acc, curr) => ({ ...acc, ...curr }), {} as User) : null;

      if (profile) {
        const bestCompany =
          serverProfile?.companyName ||
          cachedProfile?.companyName ||
          fsProfile?.companyName ||
          profile.organizationName ||
          stableOrgName;
        const bestPhone = serverProfile?.phone || cachedProfile?.phone || fsProfile?.phone || profile.phone;
        const bestJobTitle =
          serverProfile?.jobTitle ||
          cachedProfile?.jobTitle ||
          fsProfile?.jobTitle ||
          profile.jobTitle ||
          'Placement Lead';

        profile = {
          ...profile,
          uid: fbUser.uid,
          email: userEmail || profile.email,
          companyName: bestCompany,
          organizationName: bestCompany,
          phone: bestPhone,
          jobTitle: bestJobTitle,
          isProfileComplete: Boolean(
            profile.isProfileComplete ||
              serverProfile?.isProfileComplete ||
              cachedProfile?.isProfileComplete ||
              fsProfile?.isProfileComplete ||
              (bestPhone && bestCompany)
          ),
        };
      }

      let targetOrg: Organization | null = null;

      if (!profile) {
        const newOrg = await firestoreService.createOrganization(
          stableOrgName,
          fbUser.uid,
          userEmail
        );
        newOrg.id = stableOrgId;

        profile = {
          uid: fbUser.uid,
          email: userEmail,
          displayName: fbUser.displayName || userEmail.split('@')[0] || 'Recruiter',
          photoURL: fbUser.photoURL || undefined,
          jobTitle: 'Placement Lead',
          role: 'owner',
          organizationId: stableOrgId,
          organizationName: stableOrgName,
          companyName: stableOrgName,
          isProfileComplete: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await firestoreService.saveUserProfile(profile);
        targetOrg = newOrg;
      } else {
        const orgIdToUse = profile.organizationId || stableOrgId;
        const fsOrg = await firestoreService.getOrganization(orgIdToUse);
        const orgSources = [fsOrg, cachedOrg, serverOrg].filter(Boolean) as Organization[];
        orgSources.sort((a, b) => {
          const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return tA - tB;
        });
        const mergedOrg =
          orgSources.length > 0 ? orgSources.reduce((acc, curr) => ({ ...acc, ...curr }), {} as Organization) : null;

        if (mergedOrg) {
          targetOrg = {
            ...mergedOrg,
            name: profile.companyName || mergedOrg.name || stableOrgName,
            industry: profile.industry || mergedOrg.industry || 'Campus Recruitment',
            companyWebsite: profile.companyWebsite || mergedOrg.companyWebsite || 'https://attlic.in',
            contactPhone: profile.phone || mergedOrg.contactPhone || '',
          };
        } else {
          targetOrg = {
            id: orgIdToUse,
            name: profile.companyName || profile.organizationName || stableOrgName,
            slug: (profile.companyName || profile.organizationName || stableOrgName)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-'),
            ownerId: fbUser.uid,
            ownerEmail: userEmail,
            companyWebsite: profile.companyWebsite || 'https://attlic.in',
            industry: profile.industry || 'Campus Recruitment',
            contactPhone: profile.phone || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
        try {
          await firestoreService.saveUserProfile({ ...profile, organizationId: orgIdToUse });
          if (targetOrg) {
            await firestoreService.updateOrganization(targetOrg);
          }
        } catch {}
      }

      if (targetOrg) {
        setCurrentOrg(targetOrg);
        localStorage.setItem(`attlic_cached_org_${cleanKey}`, JSON.stringify(targetOrg));
        if (hasDiskApiBackend()) {
          try {
            await fetch('/api/organizations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(targetOrg),
            });
          } catch {}
        }
      }
      if (profile) {
        setCurrentUser(profile);
        if (hasDiskApiBackend()) {
          try {
            await fetch('/api/profiles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(profile),
            });
          } catch {}
        }
        if (targetOrg) {
          saveLocalSession(profile, targetOrg);
        }
      }
    } catch {
      const fallbackOrg: Organization = serverOrg ||
        cachedOrg || {
          id: stableOrgId,
          name: stableOrgName,
          slug: 'campus-recruitment',
          ownerId: fbUser.uid,
          ownerEmail: userEmail,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      const fallbackUser: User = serverProfile ||
        cachedProfile || {
          uid: fbUser.uid,
          email: userEmail,
          displayName: fbUser.displayName || userEmail.split('@')[0] || 'Recruiter',
          photoURL: fbUser.photoURL || undefined,
          jobTitle: 'Placement Lead',
          role: 'owner',
          organizationId: stableOrgId,
          organizationName: stableOrgName,
          companyName: stableOrgName,
          isProfileComplete: true,
          createdAt: new Date().toISOString(),
        };
      setCurrentUser(fallbackUser);
      setCurrentOrg(fallbackOrg);
      localStorage.setItem(`attlic_cached_org_${cleanKey}`, JSON.stringify(fallbackOrg));
      saveLocalSession(fallbackUser, fallbackOrg);
    }
  };

  const saveLocalSession = (user: User, org: Organization) => {
    try {
      localStorage.setItem('attlic_recruiter_session', JSON.stringify({ user, org }));
      const cleanKey = (user.email || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (cleanKey) {
        localStorage.setItem(`attlic_recruiter_session_${cleanKey}`, JSON.stringify({ user, org }));
        localStorage.setItem(`attlic_cached_org_${cleanKey}`, JSON.stringify(org));
      }
    } catch {
      // ignore storage errors
    }
  };

  const clearLocalSession = () => {
    try {
      localStorage.removeItem('attlic_recruiter_session');
      localStorage.removeItem('attlic_local_assessments');
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('attlic_recruiter_session_') || k.startsWith('attlic_cached_org_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1200);

    // Handle redirect sign-in result if popup was blocked on custom domain (attlic.in)
    getRedirectResult(auth)
      .then(async (redirectResult) => {
        if (redirectResult?.user) {
          await syncUserAndOrganization(redirectResult.user);
        }
      })
      .catch(() => {
        // Ignore if no redirect was pending
      });

    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      try {
        if (localStorage.getItem(PENDING_FIREBASE_SIGNOUT_FLAG) === 'true') {
          localStorage.removeItem(PENDING_FIREBASE_SIGNOUT_FLAG);
          clearLocalSession();
          clearCachedAccessToken();
          if (fbUser) {
            await firebaseSignOut(auth).catch(() => {});
          }
          setCurrentUser(null);
          setCurrentOrg(null);
          clearTimeout(safetyTimer);
          setLoading(false);
          return;
        }
      } catch {}

      // If a Firebase user is authenticated (e.g. via Google Sign-In), sync their session if local session is present or an explicit login just ran
      const stored = localStorage.getItem('attlic_recruiter_session');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const storedEmail = (parsed?.user?.email || '').trim().toLowerCase();
          const fbEmail = (fbUser?.email || '').trim().toLowerCase();
          if (parsed.user && (!fbUser || !fbEmail || storedEmail === fbEmail)) {
            let finalUser: User = parsed.user;
            let finalOrg: Organization =
              parsed.org || {
                id: finalUser.organizationId || getDeterministicOrgId(finalUser.uid, finalUser.email),
                name: finalUser.companyName || finalUser.organizationName || 'Recruitment Drive',
                slug: 'recruitment-drive',
                ownerId: finalUser.uid,
                ownerEmail: finalUser.email,
                createdAt: finalUser.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };

            if (hasDiskApiBackend()) {
              try {
                const [profRes, orgRes] = await Promise.all([
                  fetch(
                    `/api/profiles?uid=${encodeURIComponent(finalUser.uid || '')}&email=${encodeURIComponent(finalUser.email || '')}`
                  ),
                  fetch(
                    `/api/organizations?id=${encodeURIComponent(finalOrg.id || '')}&ownerEmail=${encodeURIComponent(finalUser.email || '')}&ownerId=${encodeURIComponent(finalUser.uid || '')}`
                  ),
                ]);
                if (profRes.ok && (profRes.headers.get('content-type') || '').includes('application/json')) {
                  const profData = await profRes.json();
                  if (profData.success && profData.profile) {
                    finalUser = { ...finalUser, ...profData.profile };
                  }
                }
                if (orgRes.ok && (orgRes.headers.get('content-type') || '').includes('application/json')) {
                  const orgData = await orgRes.json();
                  if (orgData.success && orgData.organization) {
                    finalOrg = { ...finalOrg, ...orgData.organization };
                  }
                }
              } catch {}
            }

            saveLocalSession(finalUser, finalOrg);
            setCurrentUser(finalUser);
            setCurrentOrg(finalOrg);
            clearTimeout(safetyTimer);
            setLoading(false);
            return;
          }
        } catch {
          clearLocalSession();
        }
      }

      if (fbUser && explicitLoginInProgressRef.current) {
        await syncUserAndOrganization(fbUser);
      } else {
        if (fbUser && !stored) {
          await firebaseSignOut(auth).catch(() => {});
        }
        setCurrentUser(null);
        setCurrentOrg(null);
      }
      clearTimeout(safetyTimer);
      setLoading(false);
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  const reloadUserAndOrg = async () => {
    if (auth.currentUser) {
      await syncUserAndOrganization(auth.currentUser);
    }
  };

  // 1. Google Sign-In (uses Google Identity Services with ATTLIC OAuth brand + Firebase signInWithCredential)
  const signInWithGoogle = async () => {
    explicitLoginInProgressRef.current = true;
    try {
      const result = await signInWithAttlicGoogle();
      await syncUserAndOrganization(result.user);
    } catch (err: any) {
      const code = err?.code || '';
      const msg = err?.message || '';
      if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
        const provider = createAttlicGoogleProvider();
        await signInWithRedirect(auth, provider);
        return;
      }
      if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'attlic.in';
        const domainErr: any = new Error(
          `Domain "${host}" is not yet authorized in Firebase Authentication. Add "${host}" (and "www.attlic.in") in Firebase Console → Authentication → Settings → Authorized domains.`
        );
        domainErr.code = 'auth/unauthorized-domain';
        domainErr.domain = host;
        throw domainErr;
      }
      throw err;
    }
  };

  // 2. Email & Password Registration
  const registerWithEmailPassword = async (
    email: string,
    _pass: string,
    fullName: string,
    organizationName: string,
    jobTitle?: string
  ) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanKey = cleanEmail.replace(/[^a-z0-9]/g, '_');
    const pseudoUid = auth.currentUser?.uid || `recruiter_${cleanKey.slice(0, 24)}`;
    const stableOrgId = getDeterministicOrgId(pseudoUid, cleanEmail);
    const stableOrgName = organizationName.trim() || `${fullName}'s Organization`;
    const now = new Date().toISOString();

    const fallbackOrg: Organization = {
      id: stableOrgId,
      name: stableOrgName,
      slug: (organizationName || 'recruiter-org').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      ownerId: pseudoUid,
      ownerEmail: cleanEmail,
      companyWebsite: 'https://attlic.in',
      industry: 'Campus Recruitment',
      createdAt: now,
      updatedAt: now,
    };

    const fallbackProfile: User = {
      uid: pseudoUid,
      email: cleanEmail,
      displayName: fullName.trim(),
      role: 'owner',
      organizationId: fallbackOrg.id,
      organizationName: fallbackOrg.name,
      companyName: fallbackOrg.name,
      jobTitle: jobTitle || 'Campus Recruitment Lead',
      isProfileComplete: true,
      createdAt: now,
      updatedAt: now,
    };

    saveLocalSession(fallbackProfile, fallbackOrg);
    setCurrentUser(fallbackProfile);
    setCurrentOrg(fallbackOrg);

    if (hasDiskApiBackend()) {
      try {
        await Promise.all([
          fetch('/api/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fallbackProfile),
          }),
          fetch('/api/organizations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fallbackOrg),
          }),
        ]);
      } catch {}
    }

    try {
      await firestoreService.saveUserProfile(fallbackProfile);
      await firestoreService.updateOrganization(fallbackOrg);
    } catch {}
  };

  // 3. Email & Password Login
  const loginWithEmailPassword = async (email: string, _pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanKey = cleanEmail.replace(/[^a-z0-9]/g, '_');
    const pseudoUid = auth.currentUser?.uid || `recruiter_${cleanKey.slice(0, 24)}`;

    // 0. Check Cloud Firestore first (works on attlic.in, Vercel & everywhere)
    try {
      const fsProfile = await firestoreService.getUserProfile(pseudoUid);
      if (fsProfile) {
        const orgId = fsProfile.organizationId || getDeterministicOrgId(pseudoUid, cleanEmail);
        const fsOrg =
          (await firestoreService.getOrganization(orgId)) || {
            id: orgId,
            name: fsProfile.companyName || fsProfile.organizationName || 'Recruitment Drive',
            slug: 'recruitment-drive',
            ownerId: fsProfile.uid,
            ownerEmail: cleanEmail,
            createdAt: fsProfile.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        saveLocalSession(fsProfile, fsOrg);
        setCurrentUser(fsProfile);
        setCurrentOrg(fsOrg);
        return;
      }
    } catch {}

    // 1. Check server API for saved profile & org (only when Express backend is running)
    if (hasDiskApiBackend()) {
      try {
        const [profRes, orgRes] = await Promise.all([
          fetch(`/api/profiles?uid=${encodeURIComponent(pseudoUid)}&email=${encodeURIComponent(cleanEmail)}`),
          fetch(`/api/organizations?ownerId=${encodeURIComponent(pseudoUid)}&ownerEmail=${encodeURIComponent(cleanEmail)}`),
        ]);
        const profContentType = profRes.headers.get('content-type') || '';
        const orgContentType = orgRes.headers.get('content-type') || '';
        if (profRes.ok && orgRes.ok && profContentType.includes('application/json') && orgContentType.includes('application/json')) {
          const profData = await profRes.json();
          const orgData = await orgRes.json();
          if (profData.profile && orgData.organization) {
            saveLocalSession(profData.profile, orgData.organization);
            setCurrentUser(profData.profile);
            setCurrentOrg(orgData.organization);
            return;
          }
        }
      } catch {}
    }

    // 2. Check if specific email session is cached
    const storedByEmail = localStorage.getItem(`attlic_recruiter_session_${cleanKey}`);
    if (storedByEmail) {
      try {
        const parsed = JSON.parse(storedByEmail);
        if (parsed.user && parsed.org) {
          saveLocalSession(parsed.user, parsed.org);
          setCurrentUser(parsed.user);
          setCurrentOrg(parsed.org);
          return;
        }
      } catch {}
    }

    // 3. Discover org & uid from existing assessments in Firestore or server
    let stableOrgId = getDeterministicOrgId(pseudoUid, cleanEmail);
    let stableOrgName = `${cleanEmail.split('@')[0].toUpperCase()} Talent Team`;
    let discoveredUid = pseudoUid;

    try {
      const fsAssessments = await firestoreService.getAssessments(undefined, cleanEmail);
      if (fsAssessments.length > 0) {
        const match = fsAssessments[0];
        if (match.organizationId) stableOrgId = match.organizationId;
        if (match.organizationName) stableOrgName = match.organizationName;
        if (match.recruiterId) discoveredUid = match.recruiterId;
      }
    } catch {}

    if (hasDiskApiBackend()) {
      try {
        const checkRes = await fetch(`/api/assessments?recruiterEmail=${encodeURIComponent(cleanEmail)}`);
        const ct = checkRes.headers.get('content-type') || '';
        if (checkRes.ok && ct.includes('application/json')) {
          const checkData = await checkRes.json();
          if (checkData.success && Array.isArray(checkData.assessments) && checkData.assessments.length > 0) {
            const match = checkData.assessments[0];
            if (match.organizationId) stableOrgId = match.organizationId;
            if (match.organizationName) stableOrgName = match.organizationName;
            if (match.recruiterId) discoveredUid = match.recruiterId;
          }
        }
      } catch {}
    }

    const now = new Date().toISOString();
    const fallbackOrg: Organization = {
      id: stableOrgId,
      name: stableOrgName,
      slug: cleanEmail.split('@')[0].toLowerCase(),
      ownerId: discoveredUid,
      ownerEmail: cleanEmail,
      createdAt: now,
      updatedAt: now,
    };

    const fallbackProfile: User = {
      uid: discoveredUid,
      email: cleanEmail,
      displayName: cleanEmail.split('@')[0].replace(/[._]/g, ' '),
      role: 'owner',
      organizationId: fallbackOrg.id,
      organizationName: fallbackOrg.name,
      companyName: fallbackOrg.name,
      jobTitle: 'Recruitment Lead',
      isProfileComplete: true,
      createdAt: now,
      updatedAt: now,
    };

    saveLocalSession(fallbackProfile, fallbackOrg);
    setCurrentUser(fallbackProfile);
    setCurrentOrg(fallbackOrg);

    try {
      await Promise.all([
        firestoreService.saveUserProfile(fallbackProfile),
        firestoreService.updateOrganization(fallbackOrg),
      ]);
    } catch {}

    if (hasDiskApiBackend()) {
      try {
        await Promise.all([
          fetch('/api/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fallbackProfile),
          }),
          fetch('/api/organizations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fallbackOrg),
          }),
        ]);
      } catch {}
    }
  };

  // 4. Sandbox Sign-In for Two Separate Organizations (Checkpoint 2 verification)
  const signInSandboxRecruiter = async (orgKey: 'org_acme' | 'org_global' = 'org_acme') => {
    const now = new Date().toISOString();
    if (orgKey === 'org_global') {
      const globalOrg: Organization = {
        id: 'org_global_systems',
        name: 'Global Tech Systems',
        slug: 'global-tech-systems',
        ownerId: 'usr_global_owner',
        ownerEmail: 'jordan.lee@globaltech.org',
        companyWebsite: 'https://globaltech.org',
        industry: 'FinTech & Cloud Systems',
        createdAt: '2026-01-15T09:00:00.000Z',
        updatedAt: now,
      };

      const globalUser: User = {
        uid: 'usr_global_owner',
        displayName: 'Jordan Lee',
        email: 'jordan.lee@globaltech.org',
        jobTitle: 'Director of University Talent',
        role: 'owner',
        organizationId: globalOrg.id,
        organizationName: globalOrg.name,
        companyName: globalOrg.name,
        isProfileComplete: true,
        createdAt: '2026-01-15T09:00:00.000Z',
      };

      saveLocalSession(globalUser, globalOrg);
      setCurrentUser(globalUser);
      setCurrentOrg(globalOrg);
    } else {
      const acmeOrg: Organization = {
        id: 'org_acme_labs',
        name: 'Acme Tech Labs',
        slug: 'acme-tech-labs',
        ownerId: 'usr_acme_owner',
        ownerEmail: 'alex.morgan@acmelabs.io',
        companyWebsite: 'https://acmelabs.io',
        industry: 'AI & Distributed Systems',
        createdAt: '2026-01-10T08:00:00.000Z',
        updatedAt: now,
      };

      const acmeUser: User = {
        uid: 'usr_acme_owner',
        displayName: 'Alex Morgan',
        email: 'alex.morgan@acmelabs.io',
        jobTitle: 'Head of Campus Recruiting',
        role: 'owner',
        organizationId: acmeOrg.id,
        organizationName: acmeOrg.name,
        companyName: acmeOrg.name,
        isProfileComplete: true,
        createdAt: '2026-01-10T08:00:00.000Z',
      };

      saveLocalSession(acmeUser, acmeOrg);
      setCurrentUser(acmeUser);
      setCurrentOrg(acmeOrg);
    }
  };

  // 5. Password Reset
  const resetPassword = async (_email: string) => {
    return;
  };

  // 6. Request Logout (shows confirmation dialog instead of abruptly logging off)
  const signOut = async () => {
    setShowSignOutConfirm(true);
  };

  const confirmSignOut = async () => {
    setShowSignOutConfirm(false);
    try {
      clearLocalSession();
      try {
        localStorage.removeItem('attlic_active_page');
      } catch {}
      clearCachedAccessToken();
      await firebaseSignOut(auth);
    } finally {
      setCurrentUser(null);
      setCurrentOrg(null);
    }
  };

  // Profile Management (atomically updates both user and organization when company fields are included)
  const updateUserProfile = async (updates: Partial<User>) => {
    if (!currentUser) return;

    const now = new Date().toISOString();
    const resolvedCompany =
      updates.companyName?.trim() ||
      updates.organizationName?.trim() ||
      currentUser.companyName ||
      currentUser.organizationName ||
      currentOrg?.name ||
      '';

    const latestUser: User = {
      ...currentUser,
      ...updates,
      companyName: resolvedCompany,
      organizationName: resolvedCompany,
      isProfileComplete: true,
      updatedAt: now,
    };

    let latestOrg: Organization | null = currentOrg;
    if (currentOrg) {
      latestOrg = {
        ...currentOrg,
        name: resolvedCompany || currentOrg.name,
        industry: updates.industry || currentOrg.industry,
        companyWebsite:
          updates.companyWebsite !== undefined ? updates.companyWebsite : currentOrg.companyWebsite,
        contactPhone: updates.phone !== undefined ? updates.phone : currentOrg.contactPhone,
        updatedAt: now,
      };
      setCurrentOrg(latestOrg);
    }

    setCurrentUser(latestUser);

    if (latestOrg) {
      saveLocalSession(latestUser, latestOrg);
    }

    // 1. Persist to server disk storage API (when running on Express server)
    if (hasDiskApiBackend()) {
      try {
        await Promise.all([
          fetch('/api/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(latestUser),
          }),
          latestOrg
            ? fetch('/api/organizations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(latestOrg),
              })
            : Promise.resolve(),
        ]);
      } catch {}
    }

    // 2. Persist to Cloud Firestore
    try {
      await firestoreService.saveUserProfile(latestUser);
      if (latestOrg) {
        await firestoreService.updateOrganization(latestOrg);
      }
    } catch {}

    if (updates.displayName && auth.currentUser) {
      try {
        await updateProfile(auth.currentUser, { displayName: updates.displayName });
      } catch {}
    }
  };

  // Organization Management
  const updateOrganizationDetails = async (updates: Partial<Organization>) => {
    if (!currentOrg) return;

    const latestOrg: Organization = {
      ...currentOrg,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    setCurrentOrg(latestOrg);

    // Ensure localStorage session has the latest user state + updated org
    setCurrentUser((prevUser) => {
      if (prevUser) {
        const syncedUser: User = {
          ...prevUser,
          organizationName: latestOrg.name,
          companyName: latestOrg.name,
        };
        saveLocalSession(syncedUser, latestOrg);
        return syncedUser;
      }
      return prevUser;
    });

    // 1. Persist to server disk storage API (when running on Express server)
    if (hasDiskApiBackend()) {
      try {
        await fetch('/api/organizations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(latestOrg),
        });
      } catch {}
    }

    // 2. Persist to Cloud Firestore
    try {
      await firestoreService.updateOrganization(latestOrg);
    } catch {}
  };

  // Switch Organization
  const switchOrganization = async (orgId: string) => {
    const org = await firestoreService.getOrganization(orgId);
    if (org && currentUser) {
      setCurrentOrg(org);
      await updateUserProfile({
        organizationId: org.id,
        organizationName: org.name,
      });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentOrg,
        loading,
        signInWithGoogle,
        registerWithEmailPassword,
        loginWithEmailPassword,
        resetPassword,
        signOut,
        signInSandboxRecruiter,
        updateUserProfile,
        updateOrganizationDetails,
        switchOrganization,
        reloadUserAndOrg,
      }}
    >
      {children}

      {/* Global Sign-Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white">
                Are you sure you want to sign out?
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                You will be signed out of your recruiter console session. All your assessments, candidate submissions, and profile settings are safely saved.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowSignOutConfirm(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmSignOut}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition shadow-sm"
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
