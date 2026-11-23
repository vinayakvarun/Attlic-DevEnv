/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Recruiter Registration & Organization Setup
 */

import React, { useState } from 'react';
import { Navbar } from '../components/common/Navbar';
import { Footer } from '../components/common/Footer';
import { BrandLogo, AttlicWordmark } from '../components/common/BrandLogo';
import { useAuth } from '../context/AuthContext';
import { NavigationPage } from '../types';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Lock,
  Mail,
  User,
  Briefcase,
  Eye,
  EyeOff,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { WaitingAnimation } from '../components/common/WaitingAnimation';
import { FIREBASE_APP_BRAND_NAME, getFirebaseConsoleAuthSettingsUrl } from '../services/firebase';

interface RecruiterRegisterPageProps {
  onNavigate: (page: NavigationPage) => void;
}

export const RecruiterRegisterPage: React.FC<RecruiterRegisterPageProps> = ({ onNavigate }) => {
  const { registerWithEmailPassword, signInWithGoogle } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [unauthorizedDomainHost, setUnauthorizedDomainHost] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password || !orgName.trim()) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      setUnauthorizedDomainHost(null);
      await registerWithEmailPassword(
        email.trim(),
        password,
        name.trim(),
        orgName.trim(),
        jobTitle.trim()
      );
      onNavigate('recruiter_dashboard');
    } catch (err: any) {
      let msg = 'Registration failed. Please try again.';
      if (err.message?.includes('email-already-in-use')) {
        msg = 'An account with this email address already exists. Please sign in instead.';
      } else if (err.message?.includes('invalid-email')) {
        msg = 'Please provide a valid work email address.';
      } else if (err.message?.includes('weak-password')) {
        msg = 'Password is too weak. Please use at least 6 characters with mixed symbols/numbers.';
      }
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
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
        setErrorMessage(
          `Custom domain "${currentHost}" needs to be added to Firebase Authorized Domains before Google Sign-In can open.`
        );
      } else if (code === 'auth/popup-closed-by-user') {
        setErrorMessage('Google sign-in window was closed before completing. Click below to try again.');
      } else {
        setErrorMessage(msg || 'Google sign-in was closed or blocked. You can register using email and password below.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      <Navbar currentPage="recruiter_register" onNavigate={onNavigate} />

      <main className="max-w-lg mx-auto px-4 py-16 w-full my-auto">
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-8 space-y-6 shadow-2xl">
          <div className="space-y-2 text-center">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Recruiter & Organization Setup
            </span>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              Create Your Recruiter Account
            </h2>
            <p className="text-xs text-slate-400">
              Start building online assessments, inviting team members, and proctoring campus drives.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200 space-y-2.5">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
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

          {/* Google Sign-Up */}
          <button
            onClick={handleGoogleRegister}
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

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Or with work details
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Your Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Varun Vinayak"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Work Email *</label>
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
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-slate-300">Password (Min. 6 Characters) *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Organization / Company Name *</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Stripe Engineering"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Job Title</label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="Placement Lead"
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
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
                  <span>Setting up Workspace...</span>
                </>
              ) : (
                <>
                  <span>Create <AttlicWordmark /> Recruiter Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <button
              onClick={() => onNavigate('recruiter_login')}
              className="text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              Sign in to console
            </button>
          </div>
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
  );
};
