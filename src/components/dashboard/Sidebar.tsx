/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ATTLIC - Recruiter Persistent Sidebar (Dark Theme)
 */

import React from 'react';
import { BrandLogo } from '../common/BrandLogo';
import { DashboardTab } from '../../types';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  FileCheck2,
  PlusCircle,
  FileUp,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ExternalLink,
  Building2,
} from 'lucide-react';

interface SidebarProps {
  currentTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  onNavigateHome: () => void;
  onOpenCandidatePortal: () => void;
  onOpenProfile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  onOpenCandidatePortal,
  onOpenProfile,
}) => {
  const { currentUser, signOut } = useAuth();

  const primaryNav: {
    id: DashboardTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'assessments', label: 'My Assessments', icon: FileCheck2 },
    { id: 'create', label: 'Create Assessment', icon: PlusCircle },
    { id: 'import', label: 'Import Google Form', icon: FileUp },
    { id: 'candidates', label: 'Candidates', icon: Users },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  const workspaceNav: {
    id: DashboardTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: 'organization', label: 'Organization', icon: Building2 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 shrink-0 bg-slate-950 border-r border-slate-800/80 flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 border-b border-slate-800/80 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onSelectTab('overview')}
          title="Go to Dashboard"
          className="cursor-pointer flex items-center gap-2 text-left focus:outline-none"
        >
          <BrandLogo size="sm" showTagline={true} />
        </button>
      </div>

      {/* Organization Context */}
      <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-900/40">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <div className="truncate flex-1">
            <p className="text-xs font-semibold text-slate-100 truncate leading-tight">
              {currentUser?.organizationName || 'Organization Workspace'}
            </p>
            <p className="text-[11px] text-slate-400 truncate">Recruiter Console</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        <div className="space-y-1">
          <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Recruitment
          </div>
          {primaryNav.map((item) => {
            const Icon = item.icon;
            const isActive =
              currentTab === item.id ||
              (item.id === 'assessments' && currentTab === 'editor');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-xl transition-all ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60 font-medium border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-indigo-400' : 'text-slate-500'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-1">
          <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Workspace
          </div>
          {workspaceNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-xs rounded-xl transition-all ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/60 font-medium border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-indigo-400' : 'text-slate-500'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onOpenCandidatePortal}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-900/60 transition-colors mt-1"
          >
            <span className="flex items-center gap-3 truncate">
              <ExternalLink className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="truncate">Candidate Portal</span>
            </span>
          </button>
        </div>
      </nav>

      {/* Recruiter Account Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onOpenProfile}
            title="Edit Recruiter Profile"
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left hover:bg-slate-900/80 p-1.5 rounded-xl transition-colors"
          >
            {currentUser?.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt="Profile"
                className="w-8 h-8 rounded-full border border-indigo-500/40 object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
                {currentUser?.displayName?.charAt(0).toUpperCase() || 'R'}
              </div>
            )}
            <div className="truncate">
              <p className="text-xs font-semibold text-slate-100 truncate">
                {currentUser?.displayName || 'Recruiter'}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {currentUser?.email || 'recruiter@attlic.in'}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={signOut}
            title="Sign Out"
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
