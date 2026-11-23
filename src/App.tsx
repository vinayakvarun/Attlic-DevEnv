/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Assess. Evaluate. Select.
 * Master App Router & Browser History State Container
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AssessmentProvider } from './context/AssessmentContext';
import { DashboardTab, NavigationPage } from './types';
import { LandingPage } from './pages/LandingPage';
import { RecruiterLoginPage } from './pages/RecruiterLoginPage';
import { RecruiterRegisterPage } from './pages/RecruiterRegisterPage';
import { RecruiterDashboardPage } from './pages/RecruiterDashboardPage';
import { CandidatePortalPage } from './pages/CandidatePortalPage';
import { AboutPage } from './pages/AboutPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { WaitingAnimation } from './components/common/WaitingAnimation';
import {
  AppRouteState,
  buildUrlFromRouteState,
  isSameRouteState,
  isValidNavigationPage,
  parseRouteStateFromLocation,
} from './utils/navigationHistory';
import { clearGlobalThemeOverrides } from './utils/appearanceDefaults';

const getInitialRouteState = (): AppRouteState => {
  if (typeof window === 'undefined') {
    return {
      page: 'landing',
      dashboardTab: 'overview',
      editingAssessmentId: null,
      candidateCode: '',
      candidateStep: 'code',
    };
  }

  let savedPage: NavigationPage | null = null;
  try {
    const rawSaved = localStorage.getItem('attlic_active_page');
    if (isValidNavigationPage(rawSaved)) {
      savedPage = rawSaved;
    }
  } catch {}

  return parseRouteStateFromLocation(
    window.location.pathname,
    window.location.search,
    window.history.state,
    savedPage
  );
};

const AppContent: React.FC = () => {
  const { currentUser, loading } = useAuth();
  const [routeState, setRouteState] = useState<AppRouteState>(getInitialRouteState);
  const routeStateRef = useRef<AppRouteState>(routeState);
  routeStateRef.current = routeState;

  useEffect(() => {
    clearGlobalThemeOverrides();
  }, []);

  // Dynamically update document.title and canonical link for SEO across public pages
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const titleMap: Record<NavigationPage, string> = {
      landing: 'ATTLIC | Assess. Evaluate. Select.',
      candidate_portal: 'Candidate Test Hall | ATTLIC Campus Assessments',
      candidate_test: 'Active Examination | ATTLIC',
      recruiter_login: 'Recruiter Login | ATTLIC Assessment Console',
      recruiter_register: 'Register Organization | ATTLIC Campus Recruitment',
      recruiter_dashboard: 'Recruiter Console | ATTLIC',
      forgot_password: 'Reset Password | ATTLIC',
      about: 'About ATTLIC | Campus Placement & Technical Assessment Platform',
      privacy: 'Privacy & Data Security | ATTLIC',
      terms: 'Candidate Conduct & Exam Policy | ATTLIC',
    };
    document.title = titleMap[routeState.page] || 'ATTLIC | Assess. Evaluate. Select.';

    const canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonicalEl && typeof window !== 'undefined') {
      const pathAndQuery = buildUrlFromRouteState(routeState);
      canonicalEl.href = `https://attlic.in${pathAndQuery === '/' ? '/' : pathAndQuery}`;
    }
  }, [routeState]);

  const persistActivePage = (page: NavigationPage) => {
    try {
      localStorage.setItem('attlic_active_page', page);
    } catch {}
  };

  // Seed initial browser history stack on mount and listen to Chrome Back/Forward (popstate)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initial = routeStateRef.current;
    const currentHistoryState = window.history.state;

    // If history.state is empty on first load/refresh, seed a root landing entry beneath non-landing pages
    // so pressing Chrome's Back button returns to the previous in-app screen instead of exiting Vercel
    if (!currentHistoryState || !isValidNavigationPage(currentHistoryState.page)) {
      const landingBase: AppRouteState = {
        page: 'landing',
        dashboardTab: 'overview',
        editingAssessmentId: null,
        candidateCode: '',
        candidateStep: 'code',
      };

      if (initial.page === 'landing') {
        window.history.replaceState(landingBase, '', '/');
      } else {
        // 1. Seed Landing at root of history stack
        window.history.replaceState(landingBase, '', '/');

        // 2. If deep-linking into a sub-tab of the dashboard, push /dashboard overview first
        if (
          initial.page === 'recruiter_dashboard' &&
          initial.dashboardTab &&
          initial.dashboardTab !== 'overview'
        ) {
          const dashboardOverview: AppRouteState = {
            page: 'recruiter_dashboard',
            dashboardTab: 'overview',
            editingAssessmentId: null,
            candidateCode: '',
            candidateStep: 'code',
          };
          window.history.pushState(dashboardOverview, '', buildUrlFromRouteState(dashboardOverview));
        }

        // 3. If deep-linking into Candidate Registration with a code, push /candidate code-entry step first
        if (initial.page === 'candidate_portal' && initial.candidateStep === 'register' && initial.candidateCode) {
          const candidateCodeStep: AppRouteState = {
            page: 'candidate_portal',
            dashboardTab: 'overview',
            editingAssessmentId: null,
            candidateCode: '',
            candidateStep: 'code',
          };
          window.history.pushState(candidateCodeStep, '', buildUrlFromRouteState(candidateCodeStep));
        }

        // 4. Push the active initial route
        window.history.pushState(initial, '', buildUrlFromRouteState(initial));
      }
    }

    const handlePopState = (event: PopStateEvent) => {
      const poppedState = parseRouteStateFromLocation(
        window.location.pathname,
        window.location.search,
        event.state,
        null
      );
      routeStateRef.current = poppedState;
      setRouteState(poppedState);
      persistActivePage(poppedState.page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigateWithHistory = useCallback(
    (updates: Partial<AppRouteState>, options?: { replace?: boolean }) => {
      const prev = routeStateRef.current;
      const next: AppRouteState = {
        ...prev,
        ...updates,
      };

      if (!options?.replace && isSameRouteState(prev, next)) {
        return;
      }

      routeStateRef.current = next;
      setRouteState(next);
      persistActivePage(next.page);

      if (typeof window !== 'undefined') {
        const targetUrl = buildUrlFromRouteState(next);
        if (options?.replace) {
          window.history.replaceState(next, '', targetUrl);
        } else {
          window.history.pushState(next, '', targetUrl);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    []
  );

  // Guard recruiter_dashboard if unauthenticated
  useEffect(() => {
    if (!loading && !currentUser && routeState.page === 'recruiter_dashboard') {
      try {
        if (localStorage.getItem('attlic_recruiter_session')) {
          return;
        }
      } catch {}
      navigateWithHistory(
        {
          page: 'landing',
          dashboardTab: 'overview',
          editingAssessmentId: null,
        },
        { replace: true }
      );
    }
  }, [loading, currentUser, routeState.page, navigateWithHistory]);

  const handleNavigate = useCallback(
    (page: NavigationPage) => {
      if (page === 'candidate_portal') {
        navigateWithHistory({
          page: 'candidate_portal',
          candidateCode: '',
          candidateStep: 'code',
        });
      } else if (page === 'recruiter_dashboard') {
        navigateWithHistory({
          page: 'recruiter_dashboard',
          dashboardTab: routeStateRef.current.dashboardTab || 'overview',
        });
      } else {
        navigateWithHistory({ page });
      }
    },
    [navigateWithHistory]
  );

  const handleLaunchTest = useCallback(
    (code: string) => {
      const cleanCode = code.trim().toUpperCase();
      // First push candidate code step if not already in candidate_portal, then register step
      if (routeStateRef.current.page !== 'candidate_portal' && typeof window !== 'undefined') {
        const codeStepState: AppRouteState = {
          ...routeStateRef.current,
          page: 'candidate_portal',
          candidateCode: '',
          candidateStep: 'code',
        };
        window.history.pushState(codeStepState, '', buildUrlFromRouteState(codeStepState));
      }
      navigateWithHistory({
        page: 'candidate_portal',
        candidateCode: cleanCode,
        candidateStep: cleanCode ? 'register' : 'code',
      });
    },
    [navigateWithHistory]
  );

  const handleOpenCandidatePortal = useCallback(
    (code?: string) => {
      if (code && code.trim()) {
        handleLaunchTest(code);
      } else {
        navigateWithHistory({
          page: 'candidate_portal',
          candidateCode: '',
          candidateStep: 'code',
        });
      }
    },
    [handleLaunchTest, navigateWithHistory]
  );

  const handleDashboardTabChange = useCallback(
    (tab: DashboardTab, editingId?: string | null) => {
      navigateWithHistory({
        page: 'recruiter_dashboard',
        dashboardTab: tab,
        editingAssessmentId: editingId ?? null,
      });
    },
    [navigateWithHistory]
  );

  const handleCandidateStepChange = useCallback(
    (step: 'code' | 'register', code: string) => {
      navigateWithHistory({
        page: 'candidate_portal',
        candidateStep: step,
        candidateCode: step === 'register' ? code.trim().toUpperCase() : '',
      });
    },
    [navigateWithHistory]
  );

  const currentPage = routeState.page;
  const [navSweepKey, setNavSweepKey] = useState(0);

  useEffect(() => {
    setNavSweepKey((prev) => prev + 1);
    if (typeof window !== 'undefined') {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        window.scrollTo(0, 0);
      }
    }
  }, [routeState.page, routeState.dashboardTab, routeState.candidateStep]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
        <WaitingAnimation
          size="lg"
          label="Initializing ATTLIC Workspace..."
          sublabel="Syncing real-time assessments and authentication state"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 antialiased selection:bg-indigo-500 selection:text-white relative overflow-x-hidden">
      {/* Top Route & View Transition Progress Sweep Bar */}
      <div
        key={`sweep-${navSweepKey}`}
        className="fixed top-0 left-0 right-0 h-0.5 z-50 bg-gradient-to-r from-[#FFB37B] via-white to-[#F08A43] shadow-[0_0_12px_#FFB37B] pointer-events-none animate-nav-sweep"
        aria-hidden="true"
      />

      <div
        key={currentPage}
        className="animate-page-enter min-h-screen flex flex-col"
      >
        {currentPage === 'landing' && (
          <LandingPage
            onNavigate={handleNavigate}
            onLaunchTestWithCode={handleLaunchTest}
          />
        )}

        {currentPage === 'recruiter_login' && (
          <RecruiterLoginPage onNavigate={handleNavigate} />
        )}

        {currentPage === 'recruiter_register' && (
          <RecruiterRegisterPage onNavigate={handleNavigate} />
        )}

        {currentPage === 'forgot_password' && (
          <ForgotPasswordPage onNavigate={handleNavigate} />
        )}

        {currentPage === 'recruiter_dashboard' && (
          <RecruiterDashboardPage
            onNavigateHome={() => handleNavigate('landing')}
            onOpenCandidatePortal={handleOpenCandidatePortal}
            onNavigateLogin={() => handleNavigate('recruiter_login')}
            activeTab={routeState.dashboardTab || 'overview'}
            editingAssessmentId={routeState.editingAssessmentId ?? null}
            onChangeTabAndEditor={handleDashboardTabChange}
          />
        )}

        {currentPage === 'candidate_portal' && (
          <CandidatePortalPage
            initialCode={routeState.candidateStep === 'register' ? routeState.candidateCode || '' : ''}
            initialStep={routeState.candidateStep || 'code'}
            onNavigate={handleNavigate}
            onRouteStepChange={handleCandidateStepChange}
          />
        )}

        {currentPage === 'about' && (
          <AboutPage onNavigate={handleNavigate} />
        )}

        {currentPage === 'privacy' && (
          <PrivacyPage onNavigate={handleNavigate} />
        )}

        {currentPage === 'terms' && (
          <TermsPage onNavigate={handleNavigate} />
        )}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AssessmentProvider>
        <AppContent />
      </AssessmentProvider>
    </AuthProvider>
  );
}

