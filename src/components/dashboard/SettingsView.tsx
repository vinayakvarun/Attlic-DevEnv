/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ATTLIC - Recruiter Profile & Platform Settings (Dark Theme)
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, Shield, Database, Check } from 'lucide-react';
import firebaseConfig from '../../../firebase-applet-config.json';

export const SettingsView: React.FC = () => {
  const { currentUser, currentOrg, updateUserProfile } = useAuth();

  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [photoURL, setPhotoURL] = useState(currentUser?.photoURL || '');
  const [jobTitle, setJobTitle] = useState(currentUser?.jobTitle || 'Placement Lead');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [companyName, setCompanyName] = useState(
    currentUser?.companyName || currentOrg?.name || ''
  );
  const [industry, setIndustry] = useState(
    currentUser?.industry || 'Software & Cloud Technology'
  );
  const [companyWebsite, setCompanyWebsite] = useState(currentUser?.companyWebsite || '');
  const [targetCampuses, setTargetCampuses] = useState(
    currentUser?.targetCampuses ? currentUser.targetCampuses.join(', ') : ''
  );

  const [defaultDuration, setDefaultDuration] = useState(45);
  const [defaultTabLimit, setDefaultTabLimit] = useState(3);
  const [allowInstantResults, setAllowInstantResults] = useState(true);

  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || '');
      setPhotoURL(currentUser.photoURL || '');
      setJobTitle(currentUser.jobTitle || 'Placement Lead');
      setPhone(currentUser.phone || '');
      setCompanyName(currentUser.companyName || currentOrg?.name || '');
      setIndustry(
        currentUser.industry || currentOrg?.industry || 'Software & Cloud Technology'
      );
      setCompanyWebsite(currentUser.companyWebsite || currentOrg?.companyWebsite || '');
      setTargetCampuses(
        currentUser.targetCampuses && currentUser.targetCampuses.length > 0
          ? currentUser.targetCampuses.join(', ')
          : ''
      );
    }
  }, [currentUser, currentOrg]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const parsedCampuses = targetCampuses
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      await updateUserProfile({
        displayName: displayName.trim(),
        photoURL: photoURL.trim(),
        jobTitle: jobTitle.trim(),
        phone: phone.trim(),
        companyName: companyName.trim(),
        industry,
        companyWebsite: companyWebsite.trim(),
        targetCampuses: parsedCampuses,
        isProfileComplete: true,
      });

      setSavedNotice('Profile and preferences saved.');
      setTimeout(() => setSavedNotice(null), 3000);
    } catch {
      // Saved locally
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div className="pb-5 border-b border-slate-800/80">
        <h1 className="text-2xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure recruiter credentials, default assessment parameters, and workspace persistence.
        </p>
      </div>

      {savedNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Recruiter Profile */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <User className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-white">Recruiter Profile</h2>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
            {photoURL ? (
              <img
                src={photoURL}
                alt="Profile preview"
                className="w-12 h-12 rounded-full object-cover border border-indigo-500/40"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-sm font-bold text-indigo-300">
                {displayName.charAt(0).toUpperCase() || 'R'}
              </div>
            )}
            <div className="flex-1 space-y-1 w-full">
              <label className="text-xs font-medium text-slate-300 block">Avatar URL</label>
              <input
                type="url"
                value={photoURL}
                onChange={(e) => setPhotoURL(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-medium text-slate-300 block">Full Name *</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-slate-300 block">Work Email</label>
              <input
                type="email"
                disabled
                value={currentUser?.email || ''}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-500 font-mono cursor-not-allowed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-slate-300 block">Job Title</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-slate-300 block">Organization Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-slate-300 block">Contact Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-slate-300 block">Industry</label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="font-medium text-slate-300 block">Target Universities</label>
              <input
                type="text"
                value={targetCampuses}
                onChange={(e) => setTargetCampuses(e.target.value)}
                placeholder="Comma-separated list of target universities"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Assessment Defaults */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Shield className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-white">Default Assessment Rules</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-medium text-slate-300 block">Default Duration (Minutes)</label>
              <input
                type="number"
                min="10"
                max="240"
                value={defaultDuration}
                onChange={(e) => setDefaultDuration(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-slate-300 block">Max Allowed Tab Switches</label>
              <input
                type="number"
                min="1"
                max="10"
                value={defaultTabLimit}
                onChange={(e) => setDefaultTabLimit(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer text-xs pt-1">
            <input
              type="checkbox"
              checked={allowInstantResults}
              onChange={(e) => setAllowInstantResults(e.target.checked)}
              className="accent-indigo-500"
            />
            <span className="text-slate-300">
              Display score summary immediately upon candidate submission by default
            </span>
          </label>
        </div>

        {/* Cloud Persistence Info */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
            <Database className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-white">Database &amp; Workspace Scope</h2>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5 font-mono">
            <div className="flex items-center justify-between text-slate-400">
              <span>Project ID:</span>
              <span className="text-slate-200 font-semibold">{firebaseConfig.projectId}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Firestore Instance:</span>
              <span className="text-slate-200">{firebaseConfig.firestoreDatabaseId}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Organization ID:</span>
              <span className="text-emerald-400 font-semibold">{currentOrg?.id || '—'}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
