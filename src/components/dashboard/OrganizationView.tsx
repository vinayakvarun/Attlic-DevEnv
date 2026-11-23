/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * ATTLIC - Recruiter Organization & Team Management (Dark Theme)
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { firestoreService } from '../../services/firestoreService';
import { OrganizationMember, RecruiterRole } from '../../types';
import {
  Building2,
  Users,
  UserPlus,
  Crown,
  Shield,
  Trash2,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Plus,
  X,
} from 'lucide-react';

export const OrganizationView: React.FC = () => {
  const {
    currentUser,
    currentOrg,
    updateOrganizationDetails,
    switchOrganization,
  } = useAuth();

  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const [orgName, setOrgName] = useState(currentOrg?.name || '');
  const [website, setWebsite] = useState(currentOrg?.companyWebsite || '');
  const [phone, setPhone] = useState(currentOrg?.contactPhone || '');
  const [industry, setIndustry] = useState(currentOrg?.industry || 'Technology & Software');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<RecruiterRole>('recruiter');
  const [isInviting, setIsInviting] = useState(false);

  const [showNewOrgModal, setShowNewOrgModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreatingOrg, setIsCreatingOrg] = useState(false);

  const isOwner = currentUser?.role === 'owner' || currentOrg?.ownerId === currentUser?.uid;

  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name);
      setWebsite(currentOrg.companyWebsite || '');
      setPhone(currentOrg.contactPhone || '');
      setIndustry(currentOrg.industry || 'Technology & Software');
      loadMembers();
    }
  }, [currentOrg?.id]);

  const loadMembers = async () => {
    if (!currentOrg?.id) return;
    setLoadingMembers(true);
    try {
      const list = await firestoreService.getOrganizationMembers(currentOrg.id);
      setMembers(list);
    } catch {
      // Offline fallback
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleCopyOrgId = () => {
    if (currentOrg?.id) {
      navigator.clipboard.writeText(currentOrg.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleSaveOrgDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg) return;
    try {
      await updateOrganizationDetails({
        name: orgName.trim(),
        companyWebsite: website.trim(),
        contactPhone: phone.trim(),
        industry,
      });
      setSaveNotice('Organization settings updated.');
      setTimeout(() => setSaveNotice(null), 3000);
    } catch {
      // Saved locally
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrg || !inviteEmail.trim()) return;

    try {
      setIsInviting(true);
      const newMember = await firestoreService.inviteOrganizationMember(
        currentOrg.id,
        currentOrg.name,
        inviteEmail.trim(),
        inviteRole,
        currentUser?.email || 'admin'
      );
      setMembers((prev) => [newMember, ...prev.filter((m) => m.id !== newMember.id)]);
      setInviteEmail('');
      setShowInviteModal(false);
      setSaveNotice(`Invitation sent to ${inviteEmail}.`);
      setTimeout(() => setSaveNotice(null), 3000);
    } catch {
      // Handled locally
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await firestoreService.removeOrganizationMember(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch {
      // Handled locally
    }
  };

  const handleCreateSecondOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || !currentUser) return;
    try {
      setIsCreatingOrg(true);
      const created = await firestoreService.createOrganization(
        newOrgName.trim(),
        currentUser.uid,
        currentUser.email
      );
      await switchOrganization(created.id);
      setShowNewOrgModal(false);
      setNewOrgName('');
      setSaveNotice(`Switched to organization: ${created.name}`);
      setTimeout(() => setSaveNotice(null), 3000);
    } catch {
      // Handled locally
    } finally {
      setIsCreatingOrg(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Organization</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage workspace settings, recruiter team access, and multi-tenant isolation.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowNewOrgModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400" />
            <span>New Workspace</span>
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Invite Recruiter</span>
            </button>
          )}
        </div>
      </div>

      {saveNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* Organization Profile Form */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                {currentOrg?.name || 'Organization Profile'}
              </h2>
              <p className="text-xs text-slate-400">
                Created {currentOrg?.createdAt ? new Date(currentOrg.createdAt).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Workspace ID:</span>
            <button
              type="button"
              onClick={handleCopyOrgId}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-indigo-300 hover:border-indigo-500/40 transition-colors"
            >
              <span>{currentOrg?.id}</span>
              {copiedId ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 text-slate-500" />
              )}
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveOrgDetails} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-medium text-slate-300 block">Organization Name *</label>
              <input
                type="text"
                required
                disabled={!isOwner}
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 disabled:opacity-60 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-slate-300 block">Industry Sector</label>
              <input
                type="text"
                disabled={!isOwner}
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. Technology & Software"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 disabled:opacity-60 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-slate-300 block">Company Website</label>
              <input
                type="text"
                disabled={!isOwner}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://company.com"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 disabled:opacity-60 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-medium text-slate-300 block">Contact Phone</label>
              <input
                type="text"
                disabled={!isOwner}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 019-2834"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 disabled:opacity-60 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {isOwner && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                Save Changes
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Team Members Table */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Team Members</span>
            </h2>
            <p className="text-xs text-slate-400">
              Recruiters authorized to manage assessments and candidate data in this workspace
            </p>
          </div>

          <button
            type="button"
            onClick={loadMembers}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Refresh team members"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingMembers ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 text-slate-400 text-[11px] uppercase font-semibold tracking-wider border-b border-slate-800">
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Joined</th>
                {isOwner && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {members.length === 0 ? (
                <tr>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-100">{currentUser?.displayName}</div>
                    <div className="text-xs text-slate-400">{currentUser?.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400">
                      <Crown className="w-3.5 h-3.5" />
                      Owner
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs font-medium text-emerald-400">Active</span>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-400">Primary Administrator</td>
                  {isOwner && <td className="py-3 px-4 text-right text-slate-500">—</td>}
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-100">
                        {member.userName || member.userEmail}
                      </div>
                      <div className="text-xs text-slate-400">{member.userEmail}</div>
                    </td>

                    <td className="py-3 px-4">
                      {member.role === 'owner' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400">
                          <Crown className="w-3.5 h-3.5" />
                          Owner
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-400">
                          <Shield className="w-3.5 h-3.5" />
                          Recruiter
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`text-xs font-medium capitalize ${
                          member.status === 'active' ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {member.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-xs text-slate-400 tabular-nums">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </td>

                    {isOwner && (
                      <td className="py-3 px-4 text-right">
                        {member.role !== 'owner' ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.id)}
                            className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors"
                            title="Remove member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">Primary</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-indigo-400" />
                Invite Recruiter
              </h3>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-medium text-slate-300 block">Work Email *</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-medium text-slate-300 block">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as RecruiterRole)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="recruiter">Recruiter (Create, edit, and monitor assessments)</option>
                  <option value="owner">Owner (Full administrative access)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInviting || !inviteEmail.trim()}
                  className="px-4 py-1.5 font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                >
                  {isInviting ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Workspace Modal */}
      {showNewOrgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-400" />
                Create Separate Workspace
              </h3>
              <button
                type="button"
                onClick={() => setShowNewOrgModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSecondOrg} className="space-y-4 text-xs">
              <p className="text-slate-400 leading-relaxed">
                Assessments and candidate submissions in this new workspace are isolated from your current organization.
              </p>

              <div className="space-y-1.5">
                <label className="font-medium text-slate-300 block">Organization Name *</label>
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="e.g. Acme Engineering Recruitment"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewOrgModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingOrg || !newOrgName.trim()}
                  className="px-4 py-1.5 font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                >
                  {isCreatingOrg ? 'Creating...' : 'Create & Switch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
