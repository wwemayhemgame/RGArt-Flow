import React, { useState } from 'react';
import {
  Users,
  ShieldCheck,
  Search,
  CheckCircle2,
  Lock,
  UserCheck,
  Plus,
  Clock,
  IdCard,
  Key,
  ShieldAlert,
  Sliders,
  LogIn,
  Eye,
  Play
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { UserRole, User } from '../../types';
import { Avatar } from '../common/Avatar';
import { RoleBadge } from '../common/Badge';
import { UserApprovalManager } from '../auth/UserApprovalManager';
import { EditUserRoleAndAccessModal } from '../modals/EditUserRoleAndAccessModal';
import { RoleTestingSection } from './RoleTestingSection';

interface PeopleViewProps {
  onOpenAddPerson?: () => void;
  onOpenOfficeLogin?: () => void;
}

export const PeopleView: React.FC<PeopleViewProps> = ({ onOpenAddPerson, onOpenOfficeLogin }) => {
  const { users, currentUser, setCurrentUser, projects, canApproveUserLogins, startRolePreview, previewRole, exitRolePreview } = useArtOps();
  const [activeTab, setActiveTab] = useState<'overview' | 'approvals' | 'roles-testing'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRoleUser, setEditingRoleUser] = useState<User | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const isLeader = canApproveUserLogins();
  const pendingCount = users.filter(u => u.status === 'PENDING_APPROVAL').length;

  const q = searchQuery.toLowerCase().trim();
  const filteredUsers = users.filter(
    u =>
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.officeId && u.officeId.toLowerCase().includes(q)) ||
      u.department.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
  );

  return (
    <div id="people-view" className="p-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Studio People & Access Control</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 font-bold text-slate-700">
              {users.length} Studio Accounts
            </span>
            {pendingCount > 0 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-200 flex items-center gap-1 animate-pulse">
                <Clock size={12} />
                {pendingCount} Pending Approvals
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage verified Office IDs, review access requests, configure granular field permissions, and update studio roles.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenOfficeLogin && (
            <button
              id="btn-open-office-login-modal"
              type="button"
              onClick={onOpenOfficeLogin}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <IdCard size={14} className="text-blue-600" />
              <span>Office ID Sign In</span>
            </button>
          )}

          {onOpenAddPerson && (
            <button
              type="button"
              onClick={onOpenAddPerson}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <Plus size={14} />
              <span>Add Member</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tabs: Studio Directory & Roster vs. Approvals & Permissions vs. Role Testing */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 flex-wrap">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Users size={14} />
          <span>Studio Directory & Roster</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('approvals')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'approvals'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck size={14} />
          <span>Office ID Approvals & Field Access Permissions</span>
          {pendingCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-bold">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('roles-testing')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'roles-testing'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Sliders size={14} />
          <span>Role Testing & Permission Preview Matrix</span>
          {previewRole && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-400 text-amber-950 font-black animate-pulse">
              LIVE PREVIEW
            </span>
          )}
        </button>
      </div>

      {activeTab === 'roles-testing' ? (
        /* Role Testing & Permission Sandbox */
        <RoleTestingSection />
      ) : activeTab === 'approvals' ? (
        /* Approval & Granular Permission Management */
        <UserApprovalManager onOpenEditPermissions={u => setEditingRoleUser(u)} />
      ) : (
        /* Studio Directory & Persona Switcher Tab */
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xl">
            <Search size={15} className="text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter by Office ID (e.g. OFF-1001), name, email, department, or role..."
              className="w-full text-xs text-slate-900 placeholder:text-slate-400 outline-hidden bg-transparent"
            />
          </div>

          {/* Role Switcher Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUsers.map(u => {
              const isCurrent = currentUser.id === u.id;
              const isPending = u.status === 'PENDING_APPROVAL';
              const isRejected = u.status === 'REJECTED';
              const userProjects = projects
                .filter(p => p.members?.some(m => m.userId === u.id))
                .map(p => p.name);

              return (
                <div
                  key={u.id}
                  className={`p-4 rounded-xl border shadow-2xs transition-all space-y-3 flex flex-col justify-between ${
                    isCurrent
                      ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900'
                      : isPending
                      ? 'bg-amber-50/50 border-amber-200'
                      : isRejected
                      ? 'bg-rose-50/30 border-rose-200'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={u.name} src={u.avatar} size="md" />
                        <div className="min-w-0">
                          <h3
                            className={`text-sm font-bold leading-tight truncate ${
                              isCurrent ? 'text-white' : 'text-slate-900'
                            }`}
                          >
                            {u.name}
                          </h3>
                          <p className={`text-xs truncate ${isCurrent ? 'text-slate-300' : 'text-slate-500'}`}>
                            {u.email}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-1">
                        {isPending ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                            <Clock size={10} />
                            Pending Review
                          </span>
                        ) : isRejected ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                            Declined
                          </span>
                        ) : (
                          <RoleBadge role={u.role} />
                        )}
                      </div>
                    </div>

                    <div className="mt-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className={isCurrent ? 'text-slate-400' : 'text-slate-500'}>Studio Office ID:</span>
                        <span
                          className={`font-mono font-bold px-1.5 py-0.5 rounded ${
                            isCurrent
                              ? 'bg-slate-800 text-blue-300 border border-slate-700'
                              : 'bg-blue-50 text-blue-700 border border-blue-100'
                          }`}
                        >
                          {u.officeId || 'OFF-1001'}
                        </span>
                      </div>

                      <p className={isCurrent ? 'text-slate-300' : 'text-slate-600'}>
                        Department: <strong>{u.department}</strong>
                      </p>
                      <p className={isCurrent ? 'text-slate-400' : 'text-slate-400'}>
                        Project Access: {userProjects.length > 0 ? userProjects.join(', ') : 'Global Studio Access'}
                      </p>
                      {u.fieldPermissions?.dailyReportAccess === 'VIEW_ONLY' && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                            <Eye size={11} />
                            <span>Daily Report: View-Only</span>
                          </span>
                        </div>
                      )}
                      {u.fieldPermissions?.tabAccess && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <span>Allowed Tabs:</span>
                          <span className="font-semibold text-slate-300">
                            {Object.values(u.fieldPermissions.tabAccess).filter(m => m !== 'NONE').length} / 17
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100/20 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      {isCurrent ? (
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
                          <UserCheck size={14} />
                          <span>Active Logged In User</span>
                        </span>
                      ) : isPending ? (
                        <button
                          type="button"
                          onClick={() => setActiveTab('approvals')}
                          className="w-full py-1.5 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors cursor-pointer text-center flex items-center justify-center gap-1"
                        >
                          <ShieldCheck size={13} />
                          <span>Review & Accept Login</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                          <CheckCircle2 size={13} className="text-emerald-500" />
                          <span>Verified Account</span>
                        </span>
                      )}

                      {!isPending && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => startRolePreview(u.role)}
                            className={`px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 active:scale-95 ${
                              previewRole === u.role
                                ? 'bg-amber-400 text-amber-950 shadow-xs'
                                : isCurrent
                                ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                            title={`Simulate studio experience with ${u.role} permissions`}
                          >
                            <Play size={11} />
                            <span>{previewRole === u.role ? 'Previewing' : 'Test Role'}</span>
                          </button>

                          <button
                            id={`btn-edit-role-${u.id}`}
                            type="button"
                            onClick={() => setEditingRoleUser(u)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 ${
                              isCurrent
                                ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 shadow-xs'
                                : 'bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-900 border border-blue-200 shadow-xs'
                            }`}
                            title="Configure role, project access, and field permissions"
                          >
                            <Sliders size={13} className={isCurrent ? 'text-amber-400' : 'text-blue-600'} />
                            <span>Edit Role & Access</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Success Notification Alert */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-900 text-white px-4 py-3 rounded-xl shadow-xl border border-emerald-700 flex items-center gap-2.5 animate-in slide-in-from-bottom-5">
          <CheckCircle2 size={18} className="text-emerald-300" />
          <span className="text-xs font-bold">{successToast}</span>
        </div>
      )}

      {/* Comprehensive Edit Role & Access Modal */}
      <EditUserRoleAndAccessModal
        isOpen={!!editingRoleUser}
        onClose={() => setEditingRoleUser(null)}
        targetUser={editingRoleUser}
        onSuccess={(msg) => {
          setSuccessToast(msg);
          setTimeout(() => setSuccessToast(null), 3500);
        }}
      />
    </div>
  );
};
