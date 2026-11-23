/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * attlic - Browser History & URL Routing State Manager
 * Ensures Chrome/Browser Back & Forward buttons navigate smoothly between pages,
 * dashboard tabs, assessment editor views, and candidate portal steps on Vercel.
 */

import type { DashboardTab, NavigationPage } from '../types/index.ts';

export interface AppRouteState {
  page: NavigationPage;
  dashboardTab?: DashboardTab;
  editingAssessmentId?: string | null;
  candidateCode?: string;
  candidateStep?: 'code' | 'register';
}

const VALID_PAGES: NavigationPage[] = [
  'landing',
  'recruiter_login',
  'recruiter_register',
  'forgot_password',
  'candidate_portal',
  'candidate_test',
  'about',
  'privacy',
  'terms',
  'recruiter_dashboard',
];

const VALID_TABS: DashboardTab[] = [
  'overview',
  'assessments',
  'create',
  'editor',
  'import',
  'candidates',
  'analytics',
  'organization',
  'settings',
];

const PAGE_TO_PATH: Record<NavigationPage, string> = {
  landing: '/',
  recruiter_login: '/login',
  recruiter_register: '/register',
  forgot_password: '/forgot-password',
  candidate_portal: '/candidate',
  candidate_test: '/candidate',
  about: '/about',
  privacy: '/privacy',
  terms: '/terms',
  recruiter_dashboard: '/dashboard',
};

const PATH_TO_PAGE: Record<string, NavigationPage> = {
  '/': 'landing',
  '/login': 'recruiter_login',
  '/recruiter-login': 'recruiter_login',
  '/register': 'recruiter_register',
  '/recruiter-register': 'recruiter_register',
  '/forgot-password': 'forgot_password',
  '/candidate': 'candidate_portal',
  '/candidate-portal': 'candidate_portal',
  '/about': 'about',
  '/privacy': 'privacy',
  '/terms': 'terms',
  '/dashboard': 'recruiter_dashboard',
};

export function isValidNavigationPage(value: unknown): value is NavigationPage {
  return typeof value === 'string' && VALID_PAGES.includes(value as NavigationPage);
}

export function isValidDashboardTab(value: unknown): value is DashboardTab {
  return typeof value === 'string' && VALID_TABS.includes(value as DashboardTab);
}

/**
 * Builds a clean, shareable URL path + query string for a given application route state.
 */
export function buildUrlFromRouteState(state: AppRouteState): string {
  const { page, dashboardTab, editingAssessmentId, candidateCode, candidateStep } = state;

  if (page === 'recruiter_dashboard') {
    const tab = dashboardTab && isValidDashboardTab(dashboardTab) ? dashboardTab : 'overview';
    const basePath = tab === 'overview' ? '/dashboard' : `/dashboard/${tab}`;
    if (tab === 'editor' && editingAssessmentId) {
      return `${basePath}?id=${encodeURIComponent(editingAssessmentId)}`;
    }
    return basePath;
  }

  if (page === 'candidate_portal' || page === 'candidate_test') {
    const cleanCode = (candidateCode || '').trim().toUpperCase();
    if (cleanCode && candidateStep === 'register') {
      return `/candidate?code=${encodeURIComponent(cleanCode)}`;
    }
    return '/candidate';
  }

  return PAGE_TO_PATH[page] || '/';
}

/**
 * Parses a browser pathname + search string (and optional history.state) into an AppRouteState.
 */
export function parseRouteStateFromLocation(
  pathname: string,
  search: string = '',
  historyState?: Partial<AppRouteState> | null,
  fallbackSavedPage?: NavigationPage | null
): AppRouteState {
  // 1. If history.state already has a valid page, trust it first
  if (historyState && isValidNavigationPage(historyState.page)) {
    return {
      page: historyState.page,
      dashboardTab: isValidDashboardTab(historyState.dashboardTab) ? historyState.dashboardTab : 'overview',
      editingAssessmentId: historyState.editingAssessmentId ?? null,
      candidateCode: historyState.candidateCode || '',
      candidateStep: historyState.candidateStep || (historyState.candidateCode ? 'register' : 'code'),
    };
  }

  const normalizedPath = (pathname || '/').replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(search || '');

  // 2. Check /dashboard and /dashboard/:tab routes
  if (normalizedPath === '/dashboard' || normalizedPath.startsWith('/dashboard/')) {
    const segment = normalizedPath.slice('/dashboard/'.length).trim().toLowerCase();
    const tab: DashboardTab = isValidDashboardTab(segment) ? segment : 'overview';
    const editId = params.get('id') || null;
    return {
      page: 'recruiter_dashboard',
      dashboardTab: tab === 'editor' && !editId ? 'overview' : tab,
      editingAssessmentId: editId,
      candidateCode: '',
      candidateStep: 'code',
    };
  }

  // 3. Check /candidate routes
  if (normalizedPath === '/candidate' || normalizedPath === '/candidate-portal') {
    const codeParam = (params.get('code') || '').trim().toUpperCase();
    return {
      page: 'candidate_portal',
      dashboardTab: 'overview',
      editingAssessmentId: null,
      candidateCode: codeParam,
      candidateStep: codeParam ? 'register' : 'code',
    };
  }

  // 4. Direct path match
  const matchedPage = PATH_TO_PAGE[normalizedPath];
  if (matchedPage && matchedPage !== 'landing') {
    return {
      page: matchedPage,
      dashboardTab: 'overview',
      editingAssessmentId: null,
      candidateCode: '',
      candidateStep: 'code',
    };
  }

  // 5. If on root '/', check if there is a valid saved page from localStorage
  if (normalizedPath === '/' && fallbackSavedPage && isValidNavigationPage(fallbackSavedPage)) {
    return {
      page: fallbackSavedPage,
      dashboardTab: 'overview',
      editingAssessmentId: null,
      candidateCode: '',
      candidateStep: 'code',
    };
  }

  return {
    page: 'landing',
    dashboardTab: 'overview',
    editingAssessmentId: null,
    candidateCode: '',
    candidateStep: 'code',
  };
}

/**
 * Compares two route states to avoid pushing duplicate consecutive history entries.
 */
export function isSameRouteState(a: AppRouteState, b: AppRouteState): boolean {
  if (a.page !== b.page) return false;
  if (a.page === 'recruiter_dashboard') {
    return (
      (a.dashboardTab || 'overview') === (b.dashboardTab || 'overview') &&
      (a.editingAssessmentId || null) === (b.editingAssessmentId || null)
    );
  }
  if (a.page === 'candidate_portal') {
    return (
      (a.candidateStep || 'code') === (b.candidateStep || 'code') &&
      (a.candidateCode || '').toUpperCase() === (b.candidateCode || '').toUpperCase()
    );
  }
  return true;
}
