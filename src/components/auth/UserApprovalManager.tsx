import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  AlertCircle,
  Sliders,
  Sparkles,
  Search,
  Key,
  Shield,
  Layers,
  ChevronDown,
  UserX,
  FileCheck,
  Mail,
  Copy,
  Check,
  Inbox,
  ExternalLink,
  Send,
  RefreshCw
} from 'lucide-react';
import { User, UserRole, FieldAccessPermissions } from '../../types';
import { useArtOps } from '../../context/ArtOpsContext';
import { Avatar } from '../common/Avatar';
import { RoleBadge } from '../common/Badge';

interface UserApprovalManagerProps {
  onOpenEditPermissions?: (user: User) => void;
}

export const UserApprovalManager: React.FC<UserApprovalManagerProps> = ({ onOpenEditPermissions }) => {
  const {
    users,
    currentUser,
    approveUserLogin,
    rejectUserLogin,
    updateUser,
    updateUserPermissions,
    canApproveUserLogins
  } = useArtOps();

  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'active' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserForAction, setSelectedUserForAction] = useState<User | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'editPerms' | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [recentActionNotice, setRecentActionNotice] = useState<{
    type: 'approved' | 'rejected' | 'updated';
    userName: string;
    email: string;
    code: string;
  } | null>(null);

  // Email Delivery Diagnostics Modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('ranjeet.patil@zapak.com');
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const [smtpStatus, setSmtpStatus] = useState<{ configured: boolean; smtpHost?: string; adminEmail?: string; sender?: string } | null>(null);

  // Load SMTP Status
  const handleOpenEmailModal = async () => {
    setShowEmailModal(true);
    setTestEmailResult(null);
    try {
      const res = await fetch('/api/auth/smtp-status');
      if (res.ok) {
        const data = await res.json();
        setSmtpStatus(data);
      }
    } catch {
      setSmtpStatus({ configured: false, smtpHost: 'Firebase Cloud Queue' });
    }
  };

  // Trigger test email dispatch
  const handleSendTestEmail = async () => {
    if (!testEmailAddress.trim()) return;
    setIsTestingEmail(true);
    setTestEmailResult(null);
    try {
      const res = await fetch('/api/auth/send-test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetEmail: testEmailAddress.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestEmailResult({ success: true, message: data.message || `Test verification email dispatched to ${testEmailAddress.trim()}.` });
      } else {
        setTestEmailResult({ success: false, error: data.error || 'Failed to dispatch test email.' });
      }
    } catch (err: any) {
      setTestEmailResult({ success: false, error: err.message || 'Network error sending test email.' });
    } finally {
      setIsTestingEmail(false);
    }
  };

  // Helper for role defaults
  const getRolePresetPerms = (role: UserRole): FieldAccessPermissions => {
    switch (role) {
      case 'ADMIN':
      case 'ART_DIRECTOR':
      case 'ART_MANAGER':
        return {
          canViewStoryPoints: true,
          canEditStoryPoints: true,
          canViewEstimates: true,
          canEditEstimates: true,
          canLogTime: true,
          canViewHourlyRates: true,
          canAssignArtists: true,
          canApproveRevisions: true,
          canManageSprints: true,
          canCreateProjects: true,
          canAccessAiPlanner: true,
          canViewReports: true
        };
      case 'ARTIST':
        return {
          canViewStoryPoints: true,
          canEditStoryPoints: false,
          canViewEstimates: true,
          canEditEstimates: true,
          canLogTime: true,
          canViewHourlyRates: false,
          canAssignArtists: false,
          canApproveRevisions: false,
          canManageSprints: false,
          canCreateProjects: false,
          canAccessAiPlanner: false,
          canViewReports: true
        };
      case 'COMPANY_REQUESTER':
        return {
          canViewStoryPoints: false,
          canEditStoryPoints: false,
          canViewEstimates: false,
          canEditEstimates: false,
          canLogTime: false,
          canViewHourlyRates: false,
          canAssignArtists: false,
          canApproveRevisions: false,
          canManageSprints: false,
          canCreateProjects: false,
          canAccessAiPlanner: false,
          canViewReports: false
        };
    }
  };

  // Rejection modal state
  const [rejectionReason, setRejectionReason] = useState('Studio access unconfirmed by Department Leadership.');

  // Approval custom permission state
  const [approvedRole, setApprovedRole] = useState<UserRole>('ARTIST');
  const [customPerms, setCustomPerms] = useState<FieldAccessPermissions>({
    canViewStoryPoints: true,
    canEditStoryPoints: false,
    canViewEstimates: true,
    canEditEstimates: true,
    canLogTime: true,
    canViewHourlyRates: false,
    canAssignArtists: false,
    canApproveRevisions: false,
    canManageSprints: false,
    canCreateProjects: false,
    canAccessAiPlanner: false,
    canViewReports: true
  });

  const isLeader = canApproveUserLogins();

  const pendingUsers = users.filter(u => u.status === 'PENDING_APPROVAL');
  const activeUsers = users.filter(u => u.status === 'ACTIVE' || !u.status);
  const rejectedUsers = users.filter(u => u.status === 'REJECTED');

  const q = searchQuery.toLowerCase().trim();
  const currentList =
    activeSubTab === 'pending'
      ? pendingUsers
      : activeSubTab === 'active'
      ? activeUsers
      : rejectedUsers;

  const filteredUsers = currentList.filter(
    u =>
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.officeId && u.officeId.toLowerCase().includes(q)) ||
      u.department.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
  );

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleOpenApprove = (user: User) => {
    setSelectedUserForAction(user);
    setApprovedRole(user.role);
    setEditTitle(user.title || '');
    setEditDepartment(user.department || '');
    setCustomPerms({
      canViewStoryPoints: user.fieldPermissions?.canViewStoryPoints ?? (user.role !== 'COMPANY_REQUESTER'),
      canEditStoryPoints: user.fieldPermissions?.canEditStoryPoints ?? (user.role === 'ADMIN' || user.role === 'ART_MANAGER' || user.role === 'ART_DIRECTOR'),
      canViewEstimates: user.fieldPermissions?.canViewEstimates ?? (user.role !== 'COMPANY_REQUESTER'),
      canEditEstimates: user.fieldPermissions?.canEditEstimates ?? (user.role !== 'COMPANY_REQUESTER'),
      canLogTime: user.fieldPermissions?.canLogTime ?? (user.role === 'ARTIST' || user.role === 'ART_MANAGER' || user.role === 'ADMIN' || user.role === 'ART_DIRECTOR'),
      canViewHourlyRates: user.fieldPermissions?.canViewHourlyRates ?? (user.role === 'ADMIN' || user.role === 'ART_MANAGER'),
      canAssignArtists: user.fieldPermissions?.canAssignArtists ?? (user.role !== 'COMPANY_REQUESTER'),
      canApproveRevisions: user.fieldPermissions?.canApproveRevisions ?? (user.role === 'ADMIN' || user.role === 'ART_MANAGER' || user.role === 'ART_DIRECTOR'),
      canManageSprints: user.fieldPermissions?.canManageSprints ?? (user.role === 'ADMIN' || user.role === 'ART_MANAGER' || user.role === 'ART_DIRECTOR'),
      canCreateProjects: user.fieldPermissions?.canCreateProjects ?? (user.role === 'ADMIN' || user.role === 'ART_MANAGER' || user.role === 'ART_DIRECTOR'),
      canAccessAiPlanner: user.fieldPermissions?.canAccessAiPlanner ?? (user.role === 'ADMIN' || user.role === 'ART_MANAGER' || user.role === 'ART_DIRECTOR'),
      canViewReports: user.fieldPermissions?.canViewReports ?? (user.role !== 'COMPANY_REQUESTER')
    });
    setActionType('approve');
  };

  const handleConfirmApproval = async () => {
    if (!selectedUserForAction) return;
    const res = await approveUserLogin(selectedUserForAction.id, approvedRole, customPerms);
    if (res.success && res.verificationCode) {
      setRecentActionNotice({
        type: 'approved',
        userName: selectedUserForAction.name,
        email: selectedUserForAction.email,
        code: res.verificationCode
      });
    }
    setActionType(null);
    setSelectedUserForAction(null);
  };

  const handleOpenReject = (user: User) => {
    setSelectedUserForAction(user);
    setRejectionReason('Studio access unconfirmed by Department Lead.');
    setActionType('reject');
  };

  const handleConfirmReject = async () => {
    if (!selectedUserForAction) return;
    const res = await rejectUserLogin(selectedUserForAction.id, rejectionReason);
    if (res.success && res.verificationCode) {
      setRecentActionNotice({
        type: 'rejected',
        userName: selectedUserForAction.name,
        email: selectedUserForAction.email,
        code: res.verificationCode
      });
    }
    setActionType(null);
    setSelectedUserForAction(null);
  };

  const handleOpenEditPermissions = (user: User) => {
    if (onOpenEditPermissions) {
      onOpenEditPermissions(user);
      return;
    }
    setSelectedUserForAction(user);
    setApprovedRole(user.role);
    setEditTitle(user.title || '');
    setEditDepartment(user.department || '');
    setCustomPerms({
      canViewStoryPoints: user.fieldPermissions?.canViewStoryPoints ?? true,
      canEditStoryPoints: user.fieldPermissions?.canEditStoryPoints ?? (user.role === 'ADMIN' || user.role === 'ART_MANAGER' || user.role === 'ART_DIRECTOR'),
      canViewEstimates: user.fieldPermissions?.canViewEstimates ?? true,
      canEditEstimates: user.fieldPermissions?.canEditEstimates ?? true,
      canLogTime: user.fieldPermissions?.canLogTime ?? true,
      canViewHourlyRates: user.fieldPermissions?.canViewHourlyRates ?? (user.role === 'ADMIN' || user.role === 'ART_MANAGER'),
      canAssignArtists: user.fieldPermissions?.canAssignArtists ?? (user.role === 'ADMIN' || user.role === 'ART_MANAGER' || user.role === 'ART_DIRECTOR'),
      canApproveRevisions: user.fieldPermissions?.canApproveRevisions ?? (user.role === 'ADMIN' || user.role === 'ART_MANAGER' || user.role === 'ART_DIRECTOR'),
      canManageSprints: user.fieldPermissions?.canManageSprints ?? (user.role === 'ADMIN' || user.role === 'ART_MANAGER' || user.role === 'ART_DIRECTOR'),
      canCreateProjects: user.fieldPermissions?.canCreateProjects ?? (user.role === 'ADMIN' || user.role === 'ART_MANAGER' || user.role === 'ART_DIRECTOR'),
      canAccessAiPlanner: user.fieldPermissions?.canAccessAiPlanner ?? (user.role === 'ADMIN' || user.role === 'ART_MANAGER' || user.role === 'ART_DIRECTOR'),
      canViewReports: user.fieldPermissions?.canViewReports ?? true
    });
    setActionType('editPerms');
  };

  const handleSaveEditedPermissions = async () => {
    if (!selectedUserForAction) return;
    const updates: Partial<User> = {
      role: approvedRole,
      title: editTitle.trim() || selectedUserForAction.title,
      department: editDepartment.trim() || selectedUserForAction.department,
      fieldPermissions: customPerms
    };
    updateUser(selectedUserForAction.id, updates);
    await updateUserPermissions(selectedUserForAction.id, customPerms);
    setRecentActionNotice({
      type: 'updated',
      userName: selectedUserForAction.name,
      email: selectedUserForAction.email,
      code: `Role updated to ${approvedRole}`
    });
    setActionType(null);
    setSelectedUserForAction(null);
  };

  return (
    <div id="user-approval-manager" className="space-y-6">
      {/* Notice Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Studio Access Approval & Verification Dispatch</span>
              {pendingUsers.length > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold animate-pulse">
                  {pendingUsers.length} Pending Approval
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              When new members request studio access, reviewers can approve or decline requests. Approvals automatically generate and dispatch an encrypted 6-digit email verification code.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 font-bold text-white flex items-center gap-1.5">
            <Avatar name={currentUser.name} src={currentUser.avatar} size="xs" />
            <span>{currentUser.name}</span>
            <RoleBadge role={currentUser.role} />
          </div>
        </div>
      </div>

      {/* Recent Action Dispatch Notice */}
      {recentActionNotice && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-950">
                Official Email & 6-Digit Code Dispatched to {recentActionNotice.userName}!
              </p>
              <p className="text-[11px] text-emerald-800">
                Dispatched to <span className="font-semibold">{recentActionNotice.email}</span>. Verification Code:{' '}
                <strong className="font-mono text-emerald-950 text-xs">{recentActionNotice.code}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopyCode(recentActionNotice.code)}
              className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
            >
              {copiedCode === recentActionNotice.code ? (
                <>
                  <Check size={13} className="text-emerald-700" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('pending')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'pending'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Clock size={14} />
            <span>Pending Approvals</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeSubTab === 'pending'
                  ? 'bg-white/20 text-white'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {pendingUsers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('active')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'active'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <CheckCircle2 size={14} />
            <span>Approved & Active Accounts</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeSubTab === 'active'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {activeUsers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('rejected')}
            className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'rejected'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <XCircle size={14} />
            <span>Declined / Inactive</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeSubTab === 'rejected'
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {rejectedUsers.length}
            </span>
          </button>
        </div>

        {/* Right side controls: Email Delivery Diagnostics & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleOpenEmailModal}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
            title="Configure and test live email delivery from ranjeet.patil@zapak.com"
          >
            <Mail size={14} className="text-blue-600" />
            <span>Email Delivery & SMTP</span>
          </button>

          {/* Search */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl w-full sm:w-64">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search name, email..."
              className="w-full text-xs text-slate-900 placeholder:text-slate-400 outline-hidden bg-transparent"
            />
          </div>
        </div>
      </div>

      {/* User List Grid */}
      {filteredUsers.length === 0 ? (
        <div className="p-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
          <UserCheck size={32} className="text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">
            {activeSubTab === 'pending'
              ? 'No pending studio access requests'
              : 'No accounts matching your filter'}
          </p>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {activeSubTab === 'pending'
              ? 'When new staff request access, their requests will appear here for verification and permission assignment.'
              : 'Try clearing your search query.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredUsers.map(u => {
            const isPending = u.status === 'PENDING_APPROVAL';
            const isRejected = u.status === 'REJECTED';
            const perms = u.fieldPermissions || {};

            return (
              <div
                key={u.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-4 bg-white ${
                  isPending
                    ? 'border-amber-300 ring-2 ring-amber-100 shadow-sm'
                    : isRejected
                    ? 'border-rose-200 bg-rose-50/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={u.name} src={u.avatar} size="md" />
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 truncate leading-tight flex items-center gap-1.5">
                          <span>{u.name}</span>
                        </h4>
                        <p className="text-xs text-slate-500 truncate">{u.email}</p>
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {isPending ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <Clock size={11} />
                          Pending Review
                        </span>
                      ) : isRejected ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
                          <XCircle size={11} />
                          Declined
                        </span>
                      ) : (
                        <RoleBadge role={u.role} />
                      )}
                    </div>
                  </div>

                  {/* Office ID & Verification Code badge */}
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-medium">Studio Office ID:</span>
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        {u.officeId || 'OFF-1001'}
                      </span>
                    </div>

                    {u.verificationCode && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 font-medium">Verification Code:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs">
                            {u.verificationCode}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyCode(u.verificationCode!)}
                            className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                            title="Copy 6-digit code"
                          >
                            {copiedCode === u.verificationCode ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Department:</span>
                      <span className="font-semibold text-slate-800">{u.department}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Title:</span>
                      <span className="font-semibold text-slate-800">{u.title}</span>
                    </div>
                  </div>

                  {/* Field Permissions Summary Chips */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Granted Field Access
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {perms.canViewStoryPoints && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-medium">
                          Story Points
                        </span>
                      )}
                      {perms.canEditEstimates && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-medium">
                          Edit Estimates
                        </span>
                      )}
                      {perms.canLogTime && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded font-medium">
                          Log Time
                        </span>
                      )}
                      {perms.canAssignArtists && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                          Assign Artists
                        </span>
                      )}
                      {perms.canAccessAiPlanner && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded font-medium">
                          AI Sprint Planner
                        </span>
                      )}
                      {perms.canApproveRevisions && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded font-medium">
                          Approve Revisions
                        </span>
                      )}
                      {perms.canManageSprints && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded font-medium">
                          Manage Sprints
                        </span>
                      )}
                    </div>
                  </div>

                  {u.approvedByName && (
                    <p className="text-[10px] text-slate-400">
                      Approved by <strong>{u.approvedByName}</strong>
                    </p>
                  )}
                  {u.rejectionReason && (
                    <p className="text-[10px] text-rose-600 bg-rose-50 p-1.5 rounded">
                      Reason: {u.rejectionReason}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  {isPending ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenApprove(u)}
                        disabled={!isLeader}
                        className="flex-1 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <CheckCircle2 size={14} />
                        <span>Accept & Send Code</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenReject(u)}
                        disabled={!isLeader}
                        className="py-2 px-3 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 rounded-xl border border-rose-200 cursor-pointer transition-colors"
                        title="Decline request & dispatch notification"
                      >
                        <XCircle size={14} />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenEditPermissions(u)}
                      className="w-full py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Sliders size={13} />
                      <span>Edit Field Permissions & Role</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Approve Modal Dialog */}
      {actionType === 'approve' && selectedUserForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
            <div className="bg-emerald-700 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={20} />
                <h3 className="text-sm font-bold text-white">
                  Accept Access Request & Dispatch Verification Code
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="text-white/80 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <Avatar name={selectedUserForAction.name} src={selectedUserForAction.avatar} size="md" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{selectedUserForAction.name}</h4>
                  <p className="text-[11px] text-slate-500">{selectedUserForAction.email}</p>
                  <p className="text-[11px] font-mono text-blue-600 font-bold">
                    Office ID: {selectedUserForAction.officeId}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Mail size={14} className="text-emerald-700" />
                  <span>Automated 6-Digit Email Dispatch</span>
                </p>
                <p className="text-[11px] text-emerald-800">
                  Accepting will generate a secure 6-digit verification code and dispatch an official approval email directly to <strong>{selectedUserForAction.email}</strong>.
                </p>
              </div>

              {/* Confirm / Change Role */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Approved Studio Role</label>
                <select
                  value={approvedRole}
                  onChange={e => {
                    const r = e.target.value as UserRole;
                    setApprovedRole(r);
                    if (r === 'ART_MANAGER' || r === 'ART_DIRECTOR' || r === 'ADMIN') {
                      setCustomPerms({
                        canViewStoryPoints: true,
                        canEditStoryPoints: true,
                        canViewEstimates: true,
                        canEditEstimates: true,
                        canLogTime: true,
                        canViewHourlyRates: true,
                        canAssignArtists: true,
                        canApproveRevisions: true,
                        canManageSprints: true,
                        canCreateProjects: true,
                        canAccessAiPlanner: true,
                        canViewReports: true
                      });
                    } else if (r === 'ARTIST') {
                      setCustomPerms(prev => ({
                        ...prev,
                        canViewStoryPoints: true,
                        canEditStoryPoints: false,
                        canViewEstimates: true,
                        canEditEstimates: true,
                        canLogTime: true,
                        canAccessAiPlanner: false,
                        canManageSprints: false
                      }));
                    } else {
                      setCustomPerms({
                        canViewStoryPoints: false,
                        canEditStoryPoints: false,
                        canViewEstimates: false,
                        canEditEstimates: false,
                        canLogTime: false,
                        canViewHourlyRates: false,
                        canAssignArtists: false,
                        canApproveRevisions: false,
                        canManageSprints: false,
                        canCreateProjects: false,
                        canAccessAiPlanner: false,
                        canViewReports: false
                      });
                    }
                  }}
                  className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 outline-hidden"
                >
                  <option value="ARTIST">Artist</option>
                  <option value="COMPANY_REQUESTER">Company Requester (QA/Dev/Marketing)</option>
                  <option value="ART_MANAGER">Art Manager</option>
                  <option value="ART_DIRECTOR">Art Director</option>
                  <option value="ADMIN">Studio Administrator</option>
                </select>
              </div>

              {/* Granular Field Access Permissions */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Granular Field Access & Feature Controls
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customPerms.canViewStoryPoints}
                      onChange={e => setCustomPerms(p => ({ ...p, canViewStoryPoints: e.target.checked }))}
                      className="rounded text-blue-600"
                    />
                    <span>View Story Points</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customPerms.canEditStoryPoints}
                      onChange={e => setCustomPerms(p => ({ ...p, canEditStoryPoints: e.target.checked }))}
                      className="rounded text-blue-600"
                    />
                    <span>Edit Story Points</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customPerms.canViewEstimates}
                      onChange={e => setCustomPerms(p => ({ ...p, canViewEstimates: e.target.checked }))}
                      className="rounded text-blue-600"
                    />
                    <span>View Hour Estimates</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customPerms.canEditEstimates}
                      onChange={e => setCustomPerms(p => ({ ...p, canEditEstimates: e.target.checked }))}
                      className="rounded text-blue-600"
                    />
                    <span>Edit Hour Estimates</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customPerms.canLogTime}
                      onChange={e => setCustomPerms(p => ({ ...p, canLogTime: e.target.checked }))}
                      className="rounded text-blue-600"
                    />
                    <span>Log Time on Tasks</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customPerms.canAssignArtists}
                      onChange={e => setCustomPerms(p => ({ ...p, canAssignArtists: e.target.checked }))}
                      className="rounded text-blue-600"
                    />
                    <span>Assign Artists</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customPerms.canManageSprints}
                      onChange={e => setCustomPerms(p => ({ ...p, canManageSprints: e.target.checked }))}
                      className="rounded text-blue-600"
                    />
                    <span>Manage Weekly Sprints</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customPerms.canAccessAiPlanner}
                      onChange={e => setCustomPerms(p => ({ ...p, canAccessAiPlanner: e.target.checked }))}
                      className="rounded text-blue-600"
                    />
                    <span className="font-semibold text-purple-700">AI Sprint Planner</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customPerms.canApproveRevisions}
                      onChange={e => setCustomPerms(p => ({ ...p, canApproveRevisions: e.target.checked }))}
                      className="rounded text-blue-600"
                    />
                    <span>Approve Revisions</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customPerms.canViewReports}
                      onChange={e => setCustomPerms(p => ({ ...p, canViewReports: e.target.checked }))}
                      className="rounded text-blue-600"
                    />
                    <span>View Performance Reports</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} />
                <span>Confirm & Dispatch Code</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal Dialog */}
      {actionType === 'reject' && selectedUserForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="bg-rose-600 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserX size={18} />
                <h3 className="text-sm font-bold text-white">Decline Access Request</h3>
              </div>
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="text-white/80 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600">
                Are you sure you want to decline login access for <strong>{selectedUserForAction.name}</strong> ({selectedUserForAction.email})?
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Reason for Rejection</label>
                <textarea
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  rows={3}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 outline-hidden"
                />
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer"
              >
                Decline & Send Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Existing Role & Permissions Dialog */}
      {actionType === 'editPerms' && selectedUserForAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Sliders size={18} className="text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">
                    Edit Role & Access Permissions
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Modifying {selectedUserForAction.name} ({selectedUserForAction.officeId || 'OFF-1001'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActionType(null)}
                className="text-slate-400 hover:text-white text-xs font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              {/* User Identity Header */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <Avatar name={selectedUserForAction.name} src={selectedUserForAction.avatar} size="md" />
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{selectedUserForAction.name}</h4>
                  <p className="text-[11px] text-slate-500 truncate">{selectedUserForAction.email}</p>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  <RoleBadge role={approvedRole} />
                  <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    {selectedUserForAction.officeId || 'OFF-1001'}
                  </span>
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Assigned Studio Role *
                </label>
                <select
                  id="select-user-role"
                  value={approvedRole}
                  onChange={e => {
                    const nextRole = e.target.value as UserRole;
                    setApprovedRole(nextRole);
                    setCustomPerms(getRolePresetPerms(nextRole));
                  }}
                  className="w-full text-xs font-bold bg-white border border-slate-300 rounded-xl px-3 py-2.5 outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                >
                  <option value="ADMIN">Studio Administrator (Full Global Access & RBAC Controls)</option>
                  <option value="ART_DIRECTOR">Art Director (Creative Approvals, Reviews & Sprint Oversight)</option>
                  <option value="ART_MANAGER">Art Manager (Sprint Planning, Capacity & Artist Assignments)</option>
                  <option value="ARTIST">Digital Artist (Task Execution, Subtasks, Time Logging & Revisions)</option>
                  <option value="COMPANY_REQUESTER">Company Requester (Producer/QA/Marketing - Request Portal)</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Selecting a new role automatically suggests standard baseline permissions below, which you can further customize.
                </p>
              </div>

              {/* Job Title & Department */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Job Title / Designation
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    placeholder="e.g. Senior 3D Artist, Art Director"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 outline-hidden focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={editDepartment}
                    onChange={e => setEditDepartment(e.target.value)}
                    placeholder="e.g. Concept Art, UI/UX, 3D Art"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 outline-hidden focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Permission Quick Presets */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Granular Field Access & Feature Controls
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCustomPerms(getRolePresetPerms(approvedRole))}
                      className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded cursor-pointer"
                    >
                      Reset to Role Default
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomPerms(getRolePresetPerms('ADMIN'))}
                      className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded cursor-pointer"
                    >
                      Grant All
                    </button>
                  </div>
                </div>

                {/* Group 1: Tasks & Estimation */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Tasks, Story Points & Time
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customPerms.canViewStoryPoints}
                        onChange={e => setCustomPerms(p => ({ ...p, canViewStoryPoints: e.target.checked }))}
                        className="rounded text-blue-600"
                      />
                      <span>View Story Points</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customPerms.canEditStoryPoints}
                        onChange={e => setCustomPerms(p => ({ ...p, canEditStoryPoints: e.target.checked }))}
                        className="rounded text-blue-600"
                      />
                      <span>Edit Story Points</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customPerms.canViewEstimates}
                        onChange={e => setCustomPerms(p => ({ ...p, canViewEstimates: e.target.checked }))}
                        className="rounded text-blue-600"
                      />
                      <span>View Hour Estimates</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customPerms.canEditEstimates}
                        onChange={e => setCustomPerms(p => ({ ...p, canEditEstimates: e.target.checked }))}
                        className="rounded text-blue-600"
                      />
                      <span>Edit Hour Estimates</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customPerms.canLogTime}
                        onChange={e => setCustomPerms(p => ({ ...p, canLogTime: e.target.checked }))}
                        className="rounded text-blue-600"
                      />
                      <span>Log Time on Tasks</span>
                    </label>
                  </div>
                </div>

                {/* Group 2: Planning & Review Governance */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Planning, Assignments & Reviews
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customPerms.canAssignArtists}
                        onChange={e => setCustomPerms(p => ({ ...p, canAssignArtists: e.target.checked }))}
                        className="rounded text-blue-600"
                      />
                      <span>Assign Artists / Staff</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customPerms.canManageSprints}
                        onChange={e => setCustomPerms(p => ({ ...p, canManageSprints: e.target.checked }))}
                        className="rounded text-blue-600"
                      />
                      <span>Manage Weekly Sprints</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customPerms.canAccessAiPlanner}
                        onChange={e => setCustomPerms(p => ({ ...p, canAccessAiPlanner: e.target.checked }))}
                        className="rounded text-blue-600"
                      />
                      <span className="font-semibold text-purple-700">AI Sprint Planner</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customPerms.canApproveRevisions}
                        onChange={e => setCustomPerms(p => ({ ...p, canApproveRevisions: e.target.checked }))}
                        className="rounded text-blue-600"
                      />
                      <span>Approve Task Revisions</span>
                    </label>
                  </div>
                </div>

                {/* Group 3: Financials & Reports */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Financials, Reports & Projects
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customPerms.canViewHourlyRates}
                        onChange={e => setCustomPerms(p => ({ ...p, canViewHourlyRates: e.target.checked }))}
                        className="rounded text-blue-600"
                      />
                      <span>View Hourly Rates & Costs</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customPerms.canCreateProjects}
                        onChange={e => setCustomPerms(p => ({ ...p, canCreateProjects: e.target.checked }))}
                        className="rounded text-blue-600"
                      />
                      <span>Create New Projects</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={customPerms.canViewReports}
                        onChange={e => setCustomPerms(p => ({ ...p, canViewReports: e.target.checked }))}
                        className="rounded text-blue-600"
                      />
                      <span>View Reports & Analytics</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <p className="text-[11px] text-slate-500">
                Changes persist directly to Firestore database.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActionType(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-save-user-role-perms"
                  type="button"
                  onClick={handleSaveEditedPermissions}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-[0.98] transition-all"
                >
                  <CheckCircle2 size={14} />
                  <span>Save Role & Permissions</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Email Delivery & SMTP Diagnostic Modal                                   */}
      {/* ========================================================================= */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-900 to-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <Mail size={18} className="text-blue-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Email Delivery & Dispatch Settings</h3>
                  <p className="text-[11px] text-blue-200">Sender: Ranjeet Patil (ranjeet.patil@zapak.com)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="p-1 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
              {/* Delivery Channels Info */}
              <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2 text-blue-950">
                <div className="flex items-center gap-2 font-bold text-blue-900 text-xs">
                  <ShieldCheck size={16} className="text-blue-600" />
                  <span>Real Email Dispatch Architecture</span>
                </div>
                <p className="text-[11px] leading-relaxed text-blue-800">
                  Every 6-digit verification code and access alert is dispatched from{' '}
                  <strong className="font-semibold text-blue-950">Ranjeet Patil &lt;ranjeet.patil@zapak.com&gt;</strong>{' '}
                  through two parallel production channels:
                </p>
                <ul className="list-disc pl-5 text-[11px] space-y-1 text-blue-900">
                  <li>
                    <strong>Firebase Trigger Email Queue:</strong> Records to Firestore collection <code className="bg-blue-100 px-1 rounded font-mono">/mail</code> (ready for the Firebase <em>firestore-send-email</em> extension).
                  </li>
                  <li>
                    <strong>Live SMTP Server:</strong> Sends via NodeMailer when SMTP credentials are provided in Environment Settings.
                  </li>
                </ul>
              </div>

              {/* Status Overview */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="font-bold text-slate-900 text-xs flex items-center justify-between">
                  <span>Outbound Mail Server Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    smtpStatus?.configured
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {smtpStatus?.configured ? 'SMTP Active' : 'Firestore Mail Queue Active'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Configured Sender:</span>
                    <span className="font-semibold text-slate-800">ranjeet.patil@zapak.com</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Host Provider:</span>
                    <span className="font-semibold text-slate-800">{smtpStatus?.smtpHost || 'Firebase Cloud Queue'}</span>
                  </div>
                </div>
              </div>

              {/* Live Test Sender */}
              <div className="p-4 border border-slate-200 rounded-xl space-y-3">
                <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                  <Send size={14} className="text-blue-600" />
                  <span>Send a Live Test Verification Email</span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Enter an email address to test and verify outbound code delivery from <code className="bg-slate-100 px-1 rounded">ranjeet.patil@zapak.com</code>.
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={testEmailAddress}
                    onChange={e => setTestEmailAddress(e.target.value)}
                    placeholder="Enter email (e.g. ranjeet.patil@zapak.com)"
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-900 font-medium"
                  />
                  <button
                    type="button"
                    disabled={isTestingEmail || !testEmailAddress.trim()}
                    onClick={handleSendTestEmail}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                  >
                    {isTestingEmail ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send size={13} />
                        <span>Send Test</span>
                      </>
                    )}
                  </button>
                </div>

                {testEmailResult && (
                  <div className={`p-3 rounded-xl text-xs flex items-start gap-2.5 ${
                    testEmailResult.success
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                      : 'bg-rose-50 text-rose-900 border border-rose-200'
                  }`}>
                    {testEmailResult.success ? (
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span className="text-[11px] leading-relaxed">
                      {testEmailResult.message || testEmailResult.error}
                    </span>
                  </div>
                )}
              </div>

              {/* Setup Guidance */}
              <div className="text-[11px] text-slate-500 space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="font-bold text-slate-700">How to configure direct SMTP delivery:</div>
                <p>
                  In the AI Studio Settings / Secrets panel, set:
                </p>
                <div className="font-mono text-[10px] bg-white p-2 rounded border border-slate-200 text-slate-800 space-y-0.5">
                  <div>SMTP_HOST=smtp.gmail.com (or smtp.zapak.com)</div>
                  <div>SMTP_PORT=587</div>
                  <div>SMTP_USER=ranjeet.patil@zapak.com</div>
                  <div>SMTP_PASS=your-app-password</div>
                  <div>ADMIN_EMAIL=ranjeet.patil@zapak.com</div>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
