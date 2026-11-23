/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Recruiter Login (Google OAuth + Email/Password + Password Reset)
 */

import React, { useState } from 'react';
import { Navbar } from '../components/common/Navbar';
import { Footer } from '../components/common/Footer';
import { BrandLogo, AttlicWordmark } from '../components/common/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { NavigationPage } from '../types';
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { WaitingAnimation } from '../components/common/WaitingAnimation';
import {
  FIREBASE_APP_BRAND_NAME,
  getFirebaseConsoleAuthSettingsUrl,
  getFirebaseProjectSettingsUrl,
  getGoogleCloudOAuthConsentUrl,
  getGoogleCloudCredentialsUrl,
} from '../services/firebase';

interface RecruiterLoginPageProps {
  onNavigate: (page: NavigationPage) => void;
}

export const RecruiterLoginPage: React.FC<RecruiterLoginPageProps> = ({ onNavigate }) => {
  const { signInWithGoogle, loginWithEmailPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [unauthorizedDomainHost, setUnauthorizedDomainHost] = useState<string | null>(null);
  const [showBrandGuide, setShowBrandGuide] = useState(false);

  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    try {
      setLoading(true);
      setErrorNotice(null);
      setUnauthorizedDomainHost(null);
      await loginWithEmailPassword(email.trim(), password);
      onNavigate('recruiter_dashboard');
    } catch (err: any) {
      let msg = 'Failed to sign in. Please verify your credentials.';
      if (err.message?.includes('user-not-found') || err.message?.includes('wrong-password') || err.message?.includes('invalid-credential')) {
        msg = 'Invalid email or password. Please check your credentials or create an account.';
      } else if (err.message?.includes('too-many-requests')) {
        msg = 'Access temporarily disabled due to multiple failed login attempts. Please reset your password or try again later.';
      }
      setErrorNotice(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setErrorNotice(null);
      setUnauthorizedDomainHost(null);
      await signInWithGoogle();
      onNavigate('recruiter_dashboard');
    } catch (err: any) {
      const code = err?.code || '';
      const msg = err?.message || '';
      if (
        code === 'auth/unauthorized-domain' ||
        msg.includes('unauthorized-domain') ||
        msg.includes('not yet authorized in Firebase')
      ) {
        const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'attlic.in';
        setUnauthorizedDomainHost(currentHost);
        setErrorNotice(
          `Custom domain "${currentHost}" needs to be added to Firebase Authorized Domains before Google Sign-In can open.`
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setErrorNotice('Google sign-in window was closed before completing. Click below to try again.');
      } else {
        setErrorNotice(
          msg ||
            'Google sign-in popup was closed or restricted. You can log in using Email & Password or register a new recruiter account.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      <Navbar currentPage="recruiter_login" onNavigate={onNavigate} />

      <main className="max-w-md mx-auto px-4 py-16 w-full my-auto">
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-2">
            <BrandLogo size="md" showTagline={true} className="mx-auto justify-center" />
            <h2 className="text-xl font-bold text-white tracking-tight pt-2">
              Sign in to <AttlicWordmark />
            </h2>
            <p className="text-xs text-slate-400">
              Sign in to your <AttlicWordmark /> recruiter console with Google OAuth or work credentials.
            </p>
          </div>

          {errorNotice && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 space-y-2.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorNotice}</span>
              </div>
              {unauthorizedDomainHost && (
                <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800 text-[11px] text-slate-300 space-y-2">
                  <p className="font-semibold text-white">
                    One-time Firebase setup for <code className="text-indigo-300">{unauthorizedDomainHost}</code>:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-400">
                    <li>
                      Open Firebase Console for <strong className="text-slate-200"><AttlicWordmark /></strong>
                    </li>
                    <li>
                      Go to <strong className="text-slate-200">Authentication → Settings → Authorized domains</strong>
                    </li>
                    <li>
                      Click <strong className="text-slate-200">Add domain</strong> and add both{' '}
                      <code className="text-emerald-300">attlic.in</code> and{' '}
                      <code className="text-emerald-300">www.attlic.in</code>
                    </li>
                  </ol>
                  <a
                    href={getFirebaseConsoleAuthSettingsUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 font-semibold transition"
                  >
                    <span>Open Firebase Authorized Domains</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Google Sign In */}
          <div className="space-y-2">
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs transition flex items-center justify-center gap-3 shadow-sm"
            >
              {loading ? (
                <>
                  <WaitingAnimation size="xs" inline />
                  <span>Connecting to <AttlicWordmark />...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue to <AttlicWordmark /> with Google</span>
                </>
              )}
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Or with work email
            </span>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailPasswordLogin} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Work Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="recruiter@company.com"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={() => onNavigate('forgot_password')}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-9 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white transition shadow-sm shadow-indigo-600/30 flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <WaitingAnimation size="xs" inline />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Sign In to <AttlicWordmark /></span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Links */}
          <div className="pt-2 border-t border-slate-800 text-center text-xs text-slate-400 space-y-2">
            <p>
              Don't have a recruiter account?{' '}
              <button
                onClick={() => onNavigate('recruiter_register')}
                className="text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                Register organization
              </button>
            </p>
            <p>
              Candidate looking for test?{' '}
              <button
                onClick={() => onNavigate('candidate_portal')}
                className="text-slate-300 hover:text-white underline"
              >
                Enter Candidate Portal
              </button>
            </p>
          </div>
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
};
