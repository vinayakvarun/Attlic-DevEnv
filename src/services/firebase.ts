/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Firebase & Firestore Service Initialization
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const envAuthDomain =
  typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN
    ? String((import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN).trim()
    : '';

const resolvedFirebaseConfig = {
  ...firebaseConfig,
  ...(envAuthDomain ? { authDomain: envAuthDomain } : {}),
};

const app = !getApps().length ? initializeApp(resolvedFirebaseConfig) : getApp();

/* CRITICAL: The app requires firestoreDatabaseId specified for Enterprise Firestore instances */
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;
export const FIREBASE_APP_BRAND_NAME = 'ATTLIC';

export function getFirebaseConsoleAuthSettingsUrl(): string {
  return `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;
}

export function getFirebaseProjectSettingsUrl(): string {
  return `https://console.firebase.google.com/project/${firebaseConfig.projectId}/settings/general`;
}

export function getGoogleCloudOAuthConsentUrl(): string {
  return `https://console.cloud.google.com/apis/credentials/consent?project=${firebaseConfig.projectId}`;
}

export function getGoogleCloudCredentialsUrl(): string {
  return `https://console.cloud.google.com/apis/credentials?project=${firebaseConfig.projectId}`;
}

/**
 * Determines whether the current runtime has the Express disk-backed API (`server.ts`).
 * Custom production domains on Vercel (e.g. attlic.in, www.attlic.in, *.vercel.app) use Cloud Firestore directly.
 */
export function hasDiskApiBackend(hostname?: string): boolean {
  const host = (hostname ?? (typeof window !== 'undefined' ? window.location.hostname : 'localhost'))
    .trim()
    .toLowerCase();
  if (!host) return true;
  if (
    host === 'attlic.in' ||
    host === 'www.attlic.in' ||
    host.endsWith('.attlic.in') ||
    host.endsWith('.vercel.app') ||
    host.endsWith('.web.app') ||
    host.endsWith('.firebaseapp.com')
  ) {
    return false;
  }
  return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.run.app');
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function isPermissionError(error: unknown): boolean {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code;
  const lower = msg.toLowerCase();
  return (
    code === 'permission-denied' ||
    lower.includes('missing or insufficient permissions') ||
    lower.includes('permission-denied')
  );
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };

  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot per Firebase guidelines
async function testConnection() {
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection check timeout')), 2000)
    );
    await Promise.race([getDocFromServer(doc(db, 'test', 'connection')), timeout]);
  } catch {
    // Silent offline/local mode handling
  }
}

testConnection();

export default app;
