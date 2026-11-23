/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Client-side Google OAuth & Profile Sign-In Token Manager
 * Uses Google Identity Services (GIS) + Firebase signInWithCredential so the
 * Google account chooser popup displays "ATTLIC" instead of "*.firebaseapp.com".
 */

import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth } from './firebase';

export const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export const GOOGLE_OAUTH_CLIENT_ID =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_OAUTH_CLIENT_ID) ||
  (firebaseConfig as any).oAuthClientId ||
  '327850521389-mjp9aip6a9mqqt4h4b9v34nnkd69fgtv.apps.googleusercontent.com';

// In-memory token cache (never stored in localStorage or sessionStorage per security guidelines)
let inMemoryAccessToken: string | null = null;
let tokenExpiryTimestamp: number | null = null;

export interface GoogleSignInResult {
  user: User;
  accessToken: string | null;
}

/**
 * Ensures the Google Identity Services script (https://accounts.google.com/gsi/client) is loaded.
 */
function ensureGsiClientLoaded(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Window is not available'));
      return;
    }
    const win = window as any;
    if (win.google?.accounts?.oauth2) {
      resolve(win.google.accounts.oauth2);
      return;
    }

    const existingScript = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existingScript) {
      let checks = 0;
      const timer = setInterval(() => {
        checks += 1;
        if (win.google?.accounts?.oauth2) {
          clearInterval(timer);
          resolve(win.google.accounts.oauth2);
        } else if (checks > 40) {
          clearInterval(timer);
          reject(new Error('Timed out waiting for Google Identity Services'));
        }
      }, 100);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (win.google?.accounts?.oauth2) {
        resolve(win.google.accounts.oauth2);
      } else {
        reject(new Error('Google Identity Services failed to initialize'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script'));
    document.head.appendChild(script);
  });
}

/**
 * Configures a GoogleAuthProvider instance with ATTLIC's profile & email sign-in scopes.
 */
export function createAttlicGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  for (const scope of SCOPES) {
    provider.addScope(scope);
  }
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  return provider;
}

/**
 * Opens the direct Google Identity Services (GIS) popup with ATTLIC's OAuth Client ID
 * so Google's account chooser displays "ATTLIC" (never "gen-lang-client-*.firebaseapp.com"),
 * and signs the user into Firebase Auth via signInWithCredential.
 */
export async function signInWithAttlicGoogle(): Promise<GoogleSignInResult> {
  try {
    const oauth2 = await ensureGsiClientLoaded();

    const tokenResponse: any = await new Promise((resolve, reject) => {
      const tokenClient = oauth2.initTokenClient({
        client_id: GOOGLE_OAUTH_CLIENT_ID,
        scope: ['openid', ...SCOPES].join(' '),
        prompt: 'select_account',
        callback: (resp: any) => {
          if (resp?.error) {
            reject(resp);
            return;
          }
          resolve(resp);
        },
        error_callback: (err: any) => {
          const e: any = new Error(err?.message || 'Google sign-in window was closed.');
          e.code = err?.type === 'popup_closed' ? 'auth/popup-closed-by-user' : 'auth/popup-blocked';
          reject(e);
        },
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    });

    const accessToken: string = tokenResponse.access_token;
    inMemoryAccessToken = accessToken;
    tokenExpiryTimestamp = Date.now() + (Number(tokenResponse.expires_in) || 3500) * 1000;

    // Sign into Firebase Auth using the Google OAuth access token credential
    try {
      const firebaseCredential = GoogleAuthProvider.credential(null, accessToken);
      const userCred = await signInWithCredential(auth, firebaseCredential);
      return {
        user: userCred.user,
        accessToken,
      };
    } catch {
      // Fallback: fetch verified profile directly from Google UserInfo endpoint if Firebase credential exchange is restricted
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!profileRes.ok) {
        throw new Error('Failed to verify Google user profile.');
      }
      const profileData = await profileRes.json();
      const syntheticFirebaseUser = {
        uid: `google_${profileData.sub || Date.now()}`,
        email: profileData.email || '',
        displayName: profileData.name || profileData.email?.split('@')[0] || 'Recruiter',
        photoURL: profileData.picture || null,
        emailVerified: Boolean(profileData.email_verified),
      } as unknown as User;

      return {
        user: syntheticFirebaseUser,
        accessToken,
      };
    }
  } catch (err: any) {
    inMemoryAccessToken = null;
    tokenExpiryTimestamp = null;
    // Only fall back to signInWithPopup if GIS script itself was blocked by an ad-blocker
    if (err?.message?.includes('Google Identity Services')) {
      const provider = createAttlicGoogleProvider();
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      inMemoryAccessToken = credential?.accessToken || null;
      tokenExpiryTimestamp = inMemoryAccessToken ? Date.now() + 3500 * 1000 : null;
      return {
        user: result.user,
        accessToken: inMemoryAccessToken,
      };
    }
    throw err;
  }
}

export function getCachedAccessToken(): string | null {
  if (!inMemoryAccessToken) return null;
  if (tokenExpiryTimestamp && Date.now() > tokenExpiryTimestamp) {
    inMemoryAccessToken = null;
    tokenExpiryTimestamp = null;
    return null;
  }
  return inMemoryAccessToken;
}

export function clearCachedAccessToken(): void {
  inMemoryAccessToken = null;
  tokenExpiryTimestamp = null;
}
