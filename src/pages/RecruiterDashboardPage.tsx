/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ATTLIC - Recruiter Dashboard Master Layout (Dark Theme)
 */

import React, { useState } from 'react';
import { Sidebar } from '../components/dashboard/Sidebar';
import { OverviewView } from '../components/dashboard/OverviewView';
import { MyAssessmentsView } from '../components/dashboard/MyAssessmentsView';
import { CreateAssessmentView } from '../components/dashboard/CreateAssessmentView';
import { ImportGoogleFormView } from '../components/dashboard/ImportGoogleFormView';
import { CandidatesView } from '../components/dashboard/CandidatesView';
import { AnalyticsView } from '../components/dashboard/AnalyticsView';
import { OrganizationView } from '../components/dashboard/OrganizationView';
import { SettingsView } from '../components/dashboard/SettingsView';
import { RecruiterProfileModal } from '../components/dashboard/RecruiterProfileModal';
import { AssessmentEditor } from '../components/editor/AssessmentEditor';
import { DashboardTab } from '../types';
import { useAuth } from '../context/AuthContext';
import { useAssessments } from '../context/AssessmentContext';
import { Terminal, Menu, X, ArrowLeft, Lock, Plus } from 'lucide-react';
import { BrandLogo } from '../components/common/BrandLogo';

interface RecruiterDashboardPageProps {
  onNavigateHome: () => void;
  onOpenCandidatePortal: (code?: string) => void;
  onNavigateLogin?: () => void;
  activeTab?: DashboardTab;
  editingAssessmentId?: string | null;
  onChangeTabAndEditor?: (tab: DashboardTab, editingId?: string | null) => void;
}

const TAB_LABELS: Record<DashboardTab, string> = {
  overview: 'Dashboard',
  assessments: 'My Assessments',
  create: 'Create Assessment',
  import: 'Import Google Form',
  editor: 'Assessment Editor',
  candidates: 'Candidates',
  analytics: 'Results & Analytics',
  organization: 'Organization',
  settings: 'Settings',
};

export const RecruiterDashboardPage: React.FC<RecruiterDashboardPageProps> = ({
  onNavigateHome,
  onOpenCandidatePortal,
  onNavigateLogin,
  activeTab,
  editingAssessmentId: controlledEditingId,
  onChangeTabAndEditor,
}) => {
  const { currentUser } = useAuth();
  const { createDraftAssessment } = useAssessments();
  const [internalTab, setInternalTab] = useState<DashboardTab>(activeTab || 'overview');
  const [internalEditingId, setInternalEditingId] = useState<string | null>(
    controlledEditingId ?? null
  );
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isScratchSession, setIsScratchSession] = useState(false);

  const currentTab = activeTab ?? internalTab;
  const editingAssessmentId =
    controlledEditingId !== undefined ? controlledEditingId : internalEditingId;

  const setCurrentTab = (nextTab: DashboardTab, nextEditingId?: string | null) => {
    const resolvedEditingId =
      nextEditingId !== undefined
        ? nextEditingId
        : nextTab === 'editor'
        ? editingAssessmentId
        : null;
    setInternalTab(nextTab);
    setInternalEditingId(resolvedEditingId);
    if (onChangeTabAndEditor) {
      onChangeTabAndEditor(nextTab, resolvedEditingId);
    }
  };

  const handleLaunchCode = (code: string) => {
    onOpenCandidatePortal(code);
  };

  const handleEditAssessment = (assessmentId: string) => {
    setIsScratchSession(false);
    setCurrentTab('editor', assessmentId);
  };

  const handleCreateFromScratch = async (enableCodingEnvironment = false) => {
    try {
      setIsScratchSession(true);
      const draft = await createDraftAssessment({
        creationSource: 'scratch',
        enableCodingEnvironment: Boolean(enableCodingEnvironment),
      });
      setCurrentTab('editor', draft.id);
    } catch {
      // Handled gracefully
    }
  };

  const handleDashboardBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else if (currentTab !== 'overview') {
      setCurrentTab('overview', null);
    } else {
      onNavigateHome();
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full bg-slate-900/70 border border-slate-800 rounded-2xl p-8 space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">Recruiter Authentication Required</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sign in to access your organization’s assessments, candidate submissions, and evaluation reports.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onNavigateLogin || onNavigateHome}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={onNavigateHome}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:flex h-full">
        <Sidebar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          onNavigateHome={onNavigateHome}
          onOpenCandidatePortal={() => onOpenCandidatePortal()}
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />
      </div>

      {/* Mobile Drawer Sidebar */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-slate-950/80 backdrop-blur-sm">
          <div className="w-64 bg-slate-950 h-full border-r border-slate-800 flex flex-col">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800">
              <BrandLogo size="sm" showTagline={false} />
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Sidebar
                currentTab={currentTab}
                onSelectTab={(tab) => {
                  setCurrentTab(tab);
                  setMobileSidebarOpen(false);
                }}
                onNavigateHome={() => {
                  onNavigateHome();
                  setMobileSidebarOpen(false);
                }}
                onOpenCandidatePortal={() => {
                  onOpenCandidatePortal();
                  setMobileSidebarOpen(false);
                }}
                onOpenProfile={() => {
                  setMobileSidebarOpen(false);
                  setIsProfileModalOpen(true);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="h-16 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0 gap-4">
          {/* Left: Context & Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden text-slate-400 hover:text-white p-1"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleDashboardBack}
              aria-label="Go back to previous view"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white transition-colors shrink-0"
              title="Go back"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="flex items-center gap-2 text-xs truncate">
              <span className="text-slate-500 hidden sm:inline truncate">
                {currentUser?.organizationName || 'Workspace'}
              </span>
              <span className="text-slate-700 hidden sm:inline">/</span>
              <span className="font-semibold text-slate-100 truncate">
                {TAB_LABELS[currentTab] || currentTab}
              </span>
            </div>
          </div>

          {/* Right: Relevant Page Actions & Recruiter Profile */}
          <div className="flex items-center gap-3 shrink-0">
            {currentTab !== 'editor' && (
              <button
                type="button"
                onClick={() => handleCreateFromScratch(false)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create Assessment</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onOpenCandidatePortal()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 border border-slate-800 text-slate-200 hover:text-white hover:border-indigo-500/40 transition-colors whitespace-nowrap"
              title="Open Candidate Examination Portal"
            >
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Candidate Portal</span>
              <span className="sm:hidden">Portal</span>
            </button>

            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-2 pl-3 border-l border-slate-800 text-xs text-slate-200 hover:text-indigo-300 transition-colors"
              title="Recruiter Account & Profile"
            >
              {currentUser?.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName}
                  className="w-7 h-7 rounded-full object-cover border border-indigo-500/40"
                />
              ) : (
                <span className="w-7 h-7 rounded-full bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 flex items-center justify-center font-bold text-xs">
                  {currentUser?.displayName?.charAt(0).toUpperCase() || 'R'}
                </span>
              )}
              <span className="font-medium hidden lg:inline max-w-[140px] truncate">
                {currentUser?.displayName || 'Recruiter'}
              </span>
            </button>
          </div>
        </header>

        {/* Scrollable Workspace Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-950">
          <div
            key={`${currentTab}-${editingAssessmentId || 'view'}`}
            className="max-w-7xl mx-auto animate-tab-enter"
          >
            {currentTab === 'overview' && (
              <OverviewView
                onNavigateTab={setCurrentTab}
                onSelectAssessment={handleEditAssessment}
                onEditAssessment={handleEditAssessment}
                onCreateFromScratch={handleCreateFromScratch}
                onOpenCandidatePortalWithCode={handleLaunchCode}
              />
            )}

            {currentTab === 'assessments' && (
              <MyAssessmentsView
                onNavigateTab={setCurrentTab}
                onEditAssessment={handleEditAssessment}
                onCreateFromScratch={handleCreateFromScratch}
                onOpenCandidatePortalWithCode={handleLaunchCode}
              />
            )}

            {currentTab === 'create' && (
              <CreateAssessmentView
                onNavigateTab={setCurrentTab}
                onEditAssessment={handleEditAssessment}
                onCreateFromScratch={handleCreateFromScratch}
                onOpenCandidatePortalWithCode={handleLaunchCode}
              />
            )}

            {currentTab === 'editor' && editingAssessmentId && (
              <AssessmentEditor
                assessmentId={editingAssessmentId}
                isScratchSession={isScratchSession}
                onNavigateTab={(tab) => {
                  setCurrentTab(tab, tab === 'editor' ? editingAssessmentId : null);
                }}
                onOpenCandidatePortalWithCode={handleLaunchCode}
              />
            )}

            {currentTab === 'import' && (
              <ImportGoogleFormView
                onNavigateTab={setCurrentTab}
                onEditAssessment={handleEditAssessment}
                onOpenCandidatePortalWithCode={handleLaunchCode}
              />
            )}

            {currentTab === 'candidates' && <CandidatesView />}

            {currentTab === 'analytics' && <AnalyticsView />}

            {currentTab === 'organization' && <OrganizationView />}

            {currentTab === 'settings' && <SettingsView />}
          </div>
        </main>
      </div>

      {/* Recruiter Profile Modal */}
      <RecruiterProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
};
