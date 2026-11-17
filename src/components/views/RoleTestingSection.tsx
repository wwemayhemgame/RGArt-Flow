import React, { useState } from 'react';
import {
  ShieldCheck,
  Eye,
  Sliders,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  Search,
  Lock,
  ArrowRight,
  Split,
  FileSpreadsheet,
  Check,
  X
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { UserRole, NavigationTab } from '../../types';
import {
  ROLE_PROFILES,
  ALL_ACTIONS,
  ActionKey,
  getRoleProfile,
  getRoleAccessSummary,
  checkActionPermission
} from '../../utils/rolePermissions';

export const RoleTestingSection: React.FC = () => {
  const { previewRole, startRolePreview, exitRolePreview, showPermissionDenial, currentUser } = useArtOps();
  const [selectedRoleForDetail, setSelectedRoleForDetail] = useState<string>('ARTIST');
  const [testActionQuery, setTestActionQuery] = useState<string>('');
  const [simulatedAction, setSimulatedAction] = useState<ActionKey | null>(null);

  // Compare roles state
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareRoleA, setCompareRoleA] = useState<string>('ART_MANAGER');
  const [compareRoleB, setCompareRoleB] = useState<string>('ARTIST');

  const activeProfile = getRoleProfile(selectedRoleForDetail);
  const summary = getRoleAccessSummary(selectedRoleForDetail);

  const availableRoles = Object.values(ROLE_PROFILES);

  const handleSimulateAction = (key: ActionKey) => {
    setSimulatedAction(key);
    const res = checkActionPermission(selectedRoleForDetail, key);
    if (!res.allowed) {
      showPermissionDenial(
        ALL_ACTIONS.find(a => a.key === key)?.label || key,
        res.reason
      );
    }
  };

  const navTabLabels: Record<NavigationTab, string> = {
    dashboard: 'Dashboard',
    'admin-tool': 'Admin Tool',
    gallery: 'Media Gallery',
    requests: 'Company Requests',
    'my-tasks': 'My Work',
    backlog: 'Backlog',
    sprints: 'Sprints',
    kanban: 'Kanban Board',
    capacity: 'Capacity Planning',
    artists: 'Artists & Skills',
    'daily-report': 'Daily Tasks Report',
    'sprint-report': 'Sprint-wise Report',
    projects: 'Projects',
    calendar: 'Calendar',
    reports: 'Reports & SLA',
    activity: 'Activity Log',
    people: 'People & Access',
    settings: 'Settings'
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-xs border border-indigo-500/30">
              Admin Role Sandbox
            </span>
            {previewRole && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/30 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                Active Preview: {getRoleProfile(previewRole).name}
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Role Testing & Permission Preview Matrix
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl mt-1">
            Simulate and test the exact studio experience for any role in safe preview mode without modifying real user accounts. Verify navigation tabs, action access, and permission enforcement.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsCompareOpen(!isCompareOpen)}
            className="px-4 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-400/30 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Split size={14} />
            <span>Compare Two Roles</span>
          </button>

          {previewRole ? (
            <button
              type="button"
              onClick={exitRolePreview}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <XCircle size={14} />
              <span>Exit Role Preview</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => startRolePreview(selectedRoleForDetail as UserRole)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Play size={14} />
              <span>Test Selected Role ({activeProfile.name})</span>
            </button>
          )}
        </div>
      </div>

      {/* Role Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {availableRoles.map(role => {
          const isSelected = selectedRoleForDetail === role.id;
          const isCurrentPreview = previewRole === role.id;
          const roleSummary = getRoleAccessSummary(role.id);

          return (
            <div
              key={role.id}
              onClick={() => setSelectedRoleForDetail(role.id)}
              className={`rounded-2xl p-4 border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-2">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${role.badgeColor}`}>
                    {role.name}
                  </span>
                  {isCurrentPreview && (
                    <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                      LIVE
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3">
                  {role.description}
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Modules:</span>
                  <span className="font-bold text-slate-800">
                    {roleSummary.accessibleModules} / {roleSummary.totalModules}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Actions:</span>
                  <span className="font-bold text-emerald-700">
                    {roleSummary.allowedActions} / {roleSummary.totalActions}
                  </span>
                </div>

                <div className="pt-1">
                  {isCurrentPreview ? (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        exitRolePreview();
                      }}
                      className="w-full py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
                    >
                      Exit Preview
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        startRolePreview(role.id);
                      }}
                      className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Eye size={12} />
                      <span>Test Role</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Side-by-Side Role Comparison Drawer / Modal */}
      {isCompareOpen && (
        <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-700 shadow-xl space-y-4 animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Split size={18} className="text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Side-by-Side Role Comparison</h3>
            </div>
            <button
              onClick={() => setIsCompareOpen(false)}
              className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Close Comparison
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 font-semibold mb-1 block">Select Primary Role (A):</label>
              <select
                value={compareRoleA}
                onChange={e => setCompareRoleA(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
              >
                {availableRoles.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 font-semibold mb-1 block">Select Comparison Role (B):</label>
              <select
                value={compareRoleB}
                onChange={e => setCompareRoleB(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
              >
                {availableRoles.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-800 text-slate-300 font-bold border-b border-slate-700">
                <tr>
                  <th className="p-2.5">Feature / Action</th>
                  <th className="p-2.5">{getRoleProfile(compareRoleA).name}</th>
                  <th className="p-2.5">{getRoleProfile(compareRoleB).name}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {ALL_ACTIONS.map(action => {
                  const permA = checkActionPermission(compareRoleA, action.key);
                  const permB = checkActionPermission(compareRoleB, action.key);

                  return (
                    <tr key={action.key} className="hover:bg-slate-800/40">
                      <td className="p-2.5 font-medium text-slate-300">
                        <div>{action.label}</div>
                        <div className="text-[10px] text-slate-500">{action.category}</div>
                      </td>
                      <td className="p-2.5">
                        {permA.allowed ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                            <Check size={13} /> {permA.isLimited ? 'Limited' : 'Allowed'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-bold text-[11px]">
                            <X size={13} /> Restricted
                          </span>
                        )}
                      </td>
                      <td className="p-2.5">
                        {permB.allowed ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                            <Check size={13} /> {permB.isLimited ? 'Limited' : 'Allowed'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-bold text-[11px]">
                            <X size={13} /> Restricted
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed Access Inspector for Selected Role */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">
                Detailed Access Breakdown: {activeProfile.name}
              </h3>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${activeProfile.badgeColor}`}>
                {activeProfile.name}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Review tab permissions and test action permissions interactively.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => startRolePreview(selectedRoleForDetail as UserRole)}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Play size={13} />
              <span>Preview as {activeProfile.name}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Access Matrix */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            1. Navigation & Module Access
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {(Object.keys(activeProfile.tabAccess) as NavigationTab[]).map(tabKey => {
              const accessMode = activeProfile.tabAccess[tabKey];
              const isFull = accessMode === 'FULL';
              const isView = accessMode === 'VIEW';
              const isNone = accessMode === 'NONE';

              return (
                <div
                  key={tabKey}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                    isFull
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : isView
                      ? 'bg-blue-50/70 border-blue-200 text-blue-950'
                      : 'bg-slate-50 border-slate-200/80 text-slate-400'
                  }`}
                >
                  <span className="text-xs font-semibold truncate">{navTabLabels[tabKey]}</span>
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                      isFull
                        ? 'bg-emerald-600 text-white'
                        : isView
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isFull ? 'FULL' : isView ? 'VIEW' : 'NONE'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Interactive Action-Level Testing */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                2. Action-Level Capabilities & Permission Simulator (26 Actions)
              </h4>
              <p className="text-xs text-slate-500">
                Click any action below to simulate executing it with {activeProfile.name} permissions.
              </p>
            </div>
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search action or capability..."
                value={testActionQuery}
                onChange={e => setTestActionQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[480px] overflow-y-auto p-1">
            {ALL_ACTIONS.filter(
              a =>
                !testActionQuery ||
                a.label.toLowerCase().includes(testActionQuery.toLowerCase()) ||
                a.category.toLowerCase().includes(testActionQuery.toLowerCase()) ||
                a.description.toLowerCase().includes(testActionQuery.toLowerCase())
            ).map(action => {
              const perm = checkActionPermission(selectedRoleForDetail, action.key);

              return (
                <div
                  key={action.key}
                  onClick={() => handleSimulateAction(action.key)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    perm.allowed
                      ? 'bg-white border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/20'
                      : 'bg-slate-50/80 border-slate-200 hover:border-rose-400 hover:bg-rose-50/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <div className="font-bold text-xs text-slate-800">{action.label}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{action.category}</div>
                    </div>
                    {perm.allowed ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1 shrink-0">
                        <Check size={11} /> {perm.isLimited ? 'Limited' : 'Allowed'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 flex items-center gap-1 shrink-0">
                        <Lock size={11} /> Denied
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                    {action.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
