import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  FileText,
  Users,
  Layers,
  Sparkles,
  Calendar,
  Zap,
  RotateCcw,
  CheckCircle2,
  Filter,
  ExternalLink,
  ChevronRight,
  Search,
  X,
  UserCheck,
  ShieldCheck,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  FolderKanban,
  Flame,
  ArrowRight,
  Building2,
  User,
  TrendingUp,
  BarChart3,
  PieChart,
  Target
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import {
  Task,
  TaskStatus,
  Artist,
  Priority,
  Sprint,
  normalizeTaskStatus,
  isTaskDoneOrCompleted
} from '../../types';
import { TaskStatusBadge, PriorityBadge } from '../common/Badge';
import { Avatar } from '../common/Avatar';
import { CapacityBar } from '../common/CapacityBar';
import { formatDate } from '../../utils/dateUtils';
import { getArtistCommittedHours, getArtistEffectiveWeeklyCapacity } from '../../utils/forecastEngine';

interface DashboardViewProps {
  onSelectTask: (taskId: string) => void;
  onSelectRequest?: (requestId: string) => void;
  onOpenCreateRequest?: () => void;
  onOpenCreateTask?: () => void;
  onOpenAiPlanner?: () => void;
  onNavigateTab: (tab: any, filters?: any) => void;
}

type StandardStatusCategory = 'TODO' | 'IN_PROGRESS' | 'ON_HOLD' | 'REVIEW' | 'ITERATION' | 'COMPLETED';

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectTask,
  onSelectRequest,
  onOpenCreateRequest,
  onOpenCreateTask,
  onOpenAiPlanner,
  onNavigateTab
}) => {
  const {
    currentUser,
    tasks,
    requests,
    artists,
    projects,
    sprints,
    canAccessAiSprintPlanner,
    settings
  } = useArtOps();

  // Match Logged-In User to Artist Profile
  const loggedInArtist = useMemo(() => {
    if (!currentUser) return null;
    return (
      artists.find(a => a.id === currentUser.id) ||
      (currentUser.artistId ? artists.find(a => a.id === currentUser.artistId) : null) ||
      (currentUser.email
        ? artists.find(a => a.email && a.email.toLowerCase() === currentUser.email.toLowerCase())
        : null) ||
      (currentUser.name
        ? artists.find(a => a.name.toLowerCase() === currentUser.name.toLowerCase())
        : null) ||
      null
    );
  }, [artists, currentUser]);

  // Is current user Admin, Art Director, or Manager?
  const isManagerOrAdmin = useMemo(() => {
    if (!currentUser) return false;
    const role = (currentUser.role || '').toUpperCase();
    return (
      role === 'ADMIN' ||
      role === 'ART_MANAGER' ||
      role === 'ART_DIRECTOR' ||
      role === 'LEAD' ||
      loggedInArtist?.isManagement === true ||
      loggedInArtist?.userRole === 'ADMIN' ||
      loggedInArtist?.userRole === 'ART_MANAGER'
    );
  }, [currentUser, loggedInArtist]);

  // View Mode: Company Dashboard vs My Dashboard
  const [dashboardMode, setDashboardMode] = useState<'company' | 'my'>(() =>
    isManagerOrAdmin ? 'company' : 'my'
  );

  // Active Sprint
  const activeSprint = useMemo(() => {
    return sprints.find(s => s.status === 'Active') || sprints[0] || null;
  }, [sprints]);

  // Helper to categorize task status
  const getStatusCategory = (task: Task): StandardStatusCategory => {
    const raw = (task.status || '').toUpperCase().replace(/\s+/g, '_');
    if (
      raw === 'DONE' ||
      raw === 'COMPLETED' ||
      raw === 'RESOLVED' ||
      raw === 'CLOSED' ||
      isTaskDoneOrCompleted(task.status)
    ) {
      return 'COMPLETED';
    }
    if (
      raw === 'SUBMIT_FOR_REVIEW' ||
      raw === 'SUBMIT_FOR_REV' ||
      raw === 'INTERNAL_REVIEW' ||
      raw === 'REQUESTER_REVIEW' ||
      raw === 'IN_REVIEW' ||
      raw === 'REVIEW'
    ) {
      return 'REVIEW';
    }
    if (
      raw === 'IN_ITERATION' ||
      raw === 'ITERATION' ||
      raw === 'REVISION' ||
      raw === 'CHANGES_REQUESTED'
    ) {
      return 'ITERATION';
    }
    if (
      raw === 'ON_HOLD' ||
      raw === 'HOLD' ||
      raw === 'BLOCKED' ||
      raw === 'PAUSED'
    ) {
      return 'ON_HOLD';
    }
    if (raw === 'IN_PROGRESS' || raw === 'PROGRESS') {
      return 'IN_PROGRESS';
    }
    return 'TODO';
  };

  // Grouping helper for a list of tasks
  const computeStatusBreakdown = (taskList: Task[]) => {
    const breakdown = {
      TODO: [] as Task[],
      IN_PROGRESS: [] as Task[],
      ON_HOLD: [] as Task[],
      REVIEW: [] as Task[],
      ITERATION: [] as Task[],
      COMPLETED: [] as Task[]
    };

    taskList.forEach(t => {
      const cat = getStatusCategory(t);
      breakdown[cat].push(t);
    });

    return breakdown;
  };

  // 1. ALL Studio Tasks (Company Scope)
  const allTasksBreakdown = useMemo(() => computeStatusBreakdown(tasks), [tasks]);
  const activeStudioTasks = useMemo(() => tasks.filter(t => !isTaskDoneOrCompleted(t.status)), [tasks]);
  const completedStudioTasks = useMemo(() => tasks.filter(t => isTaskDoneOrCompleted(t.status)), [tasks]);

  // 2. User's Assigned Tasks (My Scope)
  const myTasks = useMemo(() => {
    if (!currentUser) return [];
    const targetArtistId = loggedInArtist?.id || currentUser.artistId || currentUser.id;
    return tasks.filter(t => t.artistId === targetArtistId || t.artistId === currentUser.id);
  }, [tasks, currentUser, loggedInArtist]);

  const myTasksBreakdown = useMemo(() => computeStatusBreakdown(myTasks), [myTasks]);
  const activeMyTasks = useMemo(() => myTasks.filter(t => !isTaskDoneOrCompleted(t.status)), [myTasks]);
  const completedMyTasks = useMemo(() => myTasks.filter(t => isTaskDoneOrCompleted(t.status)), [myTasks]);

  // 3. Active Sprint Tasks (Sprint Scope)
  const activeSprintTasks = useMemo(() => {
    if (!activeSprint) return [];
    return tasks.filter(t => t.sprintId === activeSprint.id);
  }, [tasks, activeSprint]);

  const activeSprintBreakdown = useMemo(() => computeStatusBreakdown(activeSprintTasks), [activeSprintTasks]);
  const activeSprintDoneCount = activeSprintBreakdown.COMPLETED.length;
  const activeSprintTotalCount = activeSprintTasks.length;
  const sprintProgressPercent = activeSprintTotalCount > 0 ? Math.round((activeSprintDoneCount / activeSprintTotalCount) * 100) : 0;

  // Sprint Total Capacity vs Total Committed Load
  const sprintCapacityStats = useMemo(() => {
    const totalCommitted = activeSprintTasks.reduce((sum, t) => sum + (t.remainingEstimate ?? t.originalEstimate ?? 0), 0);
    const totalWeeklyCap = artists.reduce((sum, a) => sum + getArtistEffectiveWeeklyCapacity(a), 0);
    return {
      totalCommitted,
      totalWeeklyCap,
      utilizationPercent: totalWeeklyCap > 0 ? Math.round((totalCommitted / totalWeeklyCap) * 100) : 0
    };
  }, [activeSprintTasks, artists]);

  // Unassigned Tasks
  const unassignedTasks = useMemo(() => tasks.filter(t => !t.artistId && !isTaskDoneOrCompleted(t.status)), [tasks]);

  // Requirement 60 Navigation Handler: Directly opens Task List view with filters (no popup)
  const handleDrilldownNavigate = (filters: {
    statusFilter?: string;
    workspaceId?: string;
    sprintId?: string;
    projectId?: string;
  }) => {
    onNavigateTab('my-tasks', filters);
  };

  return (
    <div id="dashboard-view" className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto select-none">
      {/* 1. Header with Dashboard Mode Toggle (Requirement 55) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/80 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-zinc-900 tracking-tight">
              {dashboardMode === 'company' ? 'Company Operations Dashboard' : 'My Dashboard'}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 font-semibold border border-zinc-200">
              {currentUser?.name || 'Current User'}
            </span>
            {isManagerOrAdmin && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                Management Mode
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {dashboardMode === 'company'
              ? 'Overall studio operations, sprint workload, project distribution, and artist capacity. Click any metric to view full task list.'
              : 'Your personal workload, active sprint deliverables, and assigned tickets. Click any metric to filter tasks.'}
          </p>
        </div>

        {/* Dashboard Switcher Segmented Control */}
        <div className="flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200 shrink-0">
          <button
            type="button"
            id="tab-company-dashboard"
            onClick={() => setDashboardMode('company')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              dashboardMode === 'company'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Building2 size={14} className={dashboardMode === 'company' ? 'text-blue-600' : 'text-zinc-400'} />
            <span>Company Dashboard</span>
          </button>

          <button
            type="button"
            id="tab-my-dashboard"
            onClick={() => setDashboardMode('my')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              dashboardMode === 'my'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <User size={14} className={dashboardMode === 'my' ? 'text-blue-600' : 'text-zinc-400'} />
            <span>My Dashboard</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COMPANY DASHBOARD VIEW (Requirement 55) */}
      {/* ========================================================================= */}
      {dashboardMode === 'company' && (
        <div className="space-y-6">
          {/* A. Studio Operations KPI Ribbon (Clickable -> Opens full Task List) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 size={14} className="text-zinc-500" />
                <span>Studio Operations Overview</span>
              </h2>
              <span className="text-[11px] text-zinc-400">Click any card to open filtered Task List</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
              {/* Total Active */}
              <button
                type="button"
                onClick={() => handleDrilldownNavigate({ workspaceId: 'ALL', statusFilter: 'ALL' })}
                className="p-3.5 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="text-[11px] font-semibold text-zinc-500 group-hover:text-zinc-900">Total Active</div>
                <div className="text-xl font-bold text-zinc-900 mt-1">{activeStudioTasks.length}</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">Across all artists</div>
              </button>

              {/* Pending / To Do */}
              <button
                type="button"
                onClick={() => handleDrilldownNavigate({ workspaceId: 'ALL', statusFilter: 'BACKLOG' })}
                className="p-3.5 rounded-xl bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-200 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="text-[11px] font-semibold text-zinc-600 group-hover:text-zinc-900">Pending / To Do</div>
                <div className="text-xl font-bold text-zinc-800 mt-1">{allTasksBreakdown.TODO.length}</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">Ready for pickup</div>
              </button>

              {/* In Progress */}
              <button
                type="button"
                onClick={() => handleDrilldownNavigate({ workspaceId: 'ALL', statusFilter: 'IN_PROGRESS' })}
                className="p-3.5 rounded-xl bg-blue-50/60 hover:bg-blue-50 border border-blue-200/80 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="text-[11px] font-semibold text-blue-700 group-hover:text-blue-900">In Progress</div>
                <div className="text-xl font-bold text-blue-800 mt-1">{allTasksBreakdown.IN_PROGRESS.length}</div>
                <div className="text-[10px] text-blue-600/70 mt-0.5">Active production</div>
              </button>

              {/* In Review */}
              <button
                type="button"
                onClick={() => handleDrilldownNavigate({ workspaceId: 'ALL', statusFilter: 'INTERNAL_REVIEW' })}
                className="p-3.5 rounded-xl bg-indigo-50/60 hover:bg-indigo-50 border border-indigo-200/80 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="text-[11px] font-semibold text-indigo-700 group-hover:text-indigo-900">In Review</div>
                <div className="text-xl font-bold text-indigo-800 mt-1">{allTasksBreakdown.REVIEW.length}</div>
                <div className="text-[10px] text-indigo-600/70 mt-0.5">Approval pipeline</div>
              </button>

              {/* In Iteration */}
              <button
                type="button"
                onClick={() => handleDrilldownNavigate({ workspaceId: 'ALL', statusFilter: 'REVISION' })}
                className="p-3.5 rounded-xl bg-purple-50/60 hover:bg-purple-50 border border-purple-200/80 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="text-[11px] font-semibold text-purple-700 group-hover:text-purple-900">In Iteration</div>
                <div className="text-xl font-bold text-purple-800 mt-1">{allTasksBreakdown.ITERATION.length}</div>
                <div className="text-[10px] text-purple-600/70 mt-0.5">Revision cycle</div>
              </button>

              {/* Blocked / On Hold */}
              <button
                type="button"
                onClick={() => handleDrilldownNavigate({ workspaceId: 'ALL', statusFilter: 'BLOCKED' })}
                className="p-3.5 rounded-xl bg-amber-50/60 hover:bg-amber-50 border border-amber-200/80 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="text-[11px] font-semibold text-amber-700 group-hover:text-amber-900">On Hold</div>
                <div className="text-xl font-bold text-amber-800 mt-1">{allTasksBreakdown.ON_HOLD.length}</div>
                <div className="text-[10px] text-amber-600/70 mt-0.5">Needs unblocking</div>
              </button>

              {/* Completed */}
              <button
                type="button"
                onClick={() => handleDrilldownNavigate({ workspaceId: 'ALL', statusFilter: 'DONE' })}
                className="p-3.5 rounded-xl bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-200/80 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="text-[11px] font-semibold text-emerald-700 group-hover:text-emerald-900">Completed</div>
                <div className="text-xl font-bold text-emerald-800 mt-1">{completedStudioTasks.length}</div>
                <div className="text-[10px] text-emerald-600/70 mt-0.5">Archived / Shipped</div>
              </button>
            </div>
          </div>

          {/* B. Active Sprint Workload & Progress Panel */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                  <Zap size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-zinc-900">Active Sprint Operations: {activeSprint?.name || 'Sprint 1'}</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {activeSprint?.status || 'Active'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {activeSprint ? `${formatDate(activeSprint.startDate)} – ${formatDate(activeSprint.endDate)}` : 'Current active sprint'} • Total Committed: {sprintCapacityStats.totalCommitted}h / Capacity: {sprintCapacityStats.totalWeeklyCap}h ({sprintCapacityStats.utilizationPercent}%)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {canAccessAiSprintPlanner() && (
                  <button
                    type="button"
                    onClick={onOpenAiPlanner}
                    className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Sparkles size={13} />
                    <span>AI Sprint Optimizer</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onNavigateTab('sprints', { sprintId: activeSprint?.id })}
                  className="px-3 py-1.5 text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>Sprint Board</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>

            {/* Sprint Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-zinc-700">Sprint Completion Progress</span>
                <span className="text-emerald-700">{sprintProgressPercent}% ({activeSprintDoneCount} / {activeSprintTotalCount} tasks done)</span>
              </div>
              <div className="w-full h-3 rounded-full bg-zinc-100 overflow-hidden flex">
                <div style={{ width: `${sprintProgressPercent}%` }} className="bg-emerald-500 h-full transition-all duration-500" />
                <div style={{ width: `${activeSprintTotalCount > 0 ? (activeSprintBreakdown.IN_PROGRESS.length / activeSprintTotalCount) * 100 : 0}%` }} className="bg-blue-500 h-full transition-all duration-500" />
                <div style={{ width: `${activeSprintTotalCount > 0 ? (activeSprintBreakdown.REVIEW.length / activeSprintTotalCount) * 100 : 0}%` }} className="bg-indigo-500 h-full transition-all duration-500" />
                <div style={{ width: `${activeSprintTotalCount > 0 ? (activeSprintBreakdown.ITERATION.length / activeSprintTotalCount) * 100 : 0}%` }} className="bg-purple-500 h-full transition-all duration-500" />
              </div>
            </div>

            {/* Sprint Status Breakdown Grid (Clickable) */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleDrilldownNavigate({ sprintId: activeSprint?.id, statusFilter: 'BACKLOG', workspaceId: 'ALL' })}
                className="p-2.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-left transition-colors cursor-pointer"
              >
                <span className="text-[11px] font-medium text-zinc-500">To Do</span>
                <div className="text-base font-bold text-zinc-800 mt-0.5">{activeSprintBreakdown.TODO.length}</div>
              </button>

              <button
                type="button"
                onClick={() => handleDrilldownNavigate({ sprintId: activeSprint?.id, statusFilter: 'IN_PROGRESS', workspaceId: 'ALL' })}
                className="p-2.5 rounded-lg bg-blue-50/60 hover:bg-blue-50 border border-blue-200 text-left transition-colors cursor-pointer"
              >
                <span className="text-[11px] font-medium text-blue-700">In Progress</span>
                <div className="text-base font-bold text-blue-800 mt-0.5">{activeSprintBreakdown.IN_PROGRESS.length}</div>
              </button>

              <button
                type="button"
                onClick={() => handleDrilldownNavigate({ sprintId: activeSprint?.id, statusFilter: 'INTERNAL_REVIEW', workspaceId: 'ALL' })}
                className="p-2.5 rounded-lg bg-indigo-50/60 hover:bg-indigo-50 border border-indigo-200 text-left transition-colors cursor-pointer"
              >
                <span className="text-[11px] font-medium text-indigo-700">In Review</span>
                <div className="text-base font-bold text-indigo-800 mt-0.5">{activeSprintBreakdown.REVIEW.length}</div>
              </button>

              <button
                type="button"
                onClick={() => handleDrilldownNavigate({ sprintId: activeSprint?.id, statusFilter: 'REVISION', workspaceId: 'ALL' })}
                className="p-2.5 rounded-lg bg-purple-50/60 hover:bg-purple-50 border border-purple-200 text-left transition-colors cursor-pointer"
              >
                <span className="text-[11px] font-medium text-purple-700">In Iteration</span>
                <div className="text-base font-bold text-purple-800 mt-0.5">{activeSprintBreakdown.ITERATION.length}</div>
              </button>

              <button
                type="button"
                onClick={() => handleDrilldownNavigate({ sprintId: activeSprint?.id, statusFilter: 'DONE', workspaceId: 'ALL' })}
                className="p-2.5 rounded-lg bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-200 text-left transition-colors cursor-pointer"
              >
                <span className="text-[11px] font-medium text-emerald-700">Completed</span>
                <div className="text-base font-bold text-emerald-800 mt-0.5">{activeSprintBreakdown.COMPLETED.length}</div>
              </button>
            </div>
          </div>

          {/* C. Tasks by Project & Tasks by Artist Side-by-Side (Requirement 55) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Tasks by Project (Project Workload) */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <FolderKanban size={16} className="text-blue-600" />
                  <h3 className="text-sm font-bold text-zinc-900">Tasks by Project</h3>
                </div>
                <span className="text-xs text-zinc-400 font-semibold">{projects.length} Active Projects</span>
              </div>

              <div className="divide-y divide-zinc-100">
                {projects.map(p => {
                  const pTasks = tasks.filter(t => t.projectId === p.id);
                  const pActive = pTasks.filter(t => !isTaskDoneOrCompleted(t.status));
                  const pDone = pTasks.filter(t => isTaskDoneOrCompleted(t.status));
                  const pProgress = pTasks.length > 0 ? Math.round((pDone.length / pTasks.length) * 100) : 0;
                  const pEstHours = pTasks.reduce((sum, t) => sum + (t.remainingEstimate ?? t.originalEstimate ?? 0), 0);

                  return (
                    <div
                      key={p.id}
                      onClick={() => handleDrilldownNavigate({ projectId: p.id, workspaceId: 'ALL', statusFilter: 'ALL' })}
                      className="py-3 hover:bg-zinc-50/80 px-2 rounded-xl transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            {p.key}
                          </span>
                          <span className="text-xs font-bold text-zinc-900 group-hover:text-blue-700 transition-colors">
                            {p.name}
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-zinc-700">
                          <span className="font-bold text-zinc-900">{pActive.length}</span> active • <span className="text-zinc-500">{pDone.length} done</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full bg-zinc-100 overflow-hidden">
                          <div style={{ width: `${pProgress}%` }} className="h-full bg-blue-600 rounded-full" />
                        </div>
                        <span className="text-[11px] font-bold text-zinc-500 shrink-0 w-10 text-right">
                          {pProgress}%
                        </span>
                        <span className="text-[11px] text-zinc-400 shrink-0 font-mono">
                          {pEstHours}h
                        </span>
                      </div>
                    </div>
                  );
                })}

                {projects.length === 0 && (
                  <div className="p-4 text-center text-xs text-zinc-400">
                    No active projects configured.
                  </div>
                )}
              </div>
            </div>

            {/* 2. Tasks & Workload by Artist (Team Workload) */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-purple-600" />
                  <h3 className="text-sm font-bold text-zinc-900">Tasks & Workload by Artist</h3>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab('artists')}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <span>Team Workflow</span>
                  <ArrowRight size={12} />
                </button>
              </div>

              <div className="divide-y divide-zinc-100 max-h-[380px] overflow-y-auto pr-1">
                {artists.map(artist => {
                  const artistTasks = tasks.filter(t => t.artistId === artist.id && !isTaskDoneOrCompleted(t.status));
                  const committedHours = getArtistCommittedHours(artist.id, tasks);
                  const weeklyCap = getArtistEffectiveWeeklyCapacity(artist);

                  return (
                    <div
                      key={artist.id}
                      onClick={() => handleDrilldownNavigate({ workspaceId: artist.id, statusFilter: 'ALL' })}
                      className="py-3 hover:bg-zinc-50/80 px-2 rounded-xl transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={artist.name} src={artist.avatar} size="sm" status={artist.status} />
                          <div>
                            <div className="text-xs font-bold text-zinc-900 group-hover:text-blue-700 transition-colors">
                              {artist.name}
                            </div>
                            <div className="text-[11px] text-zinc-500">{artist.role}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                            {artistTasks.length} {artistTasks.length === 1 ? 'task' : 'tasks'}
                          </span>
                        </div>
                      </div>

                      <CapacityBar committedHours={committedHours} capacityHours={weeklyCap} size="sm" showLabels />
                    </div>
                  );
                })}

                {/* Unassigned Pool Row */}
                {unassignedTasks.length > 0 && (
                  <div
                    onClick={() => handleDrilldownNavigate({ workspaceId: 'UNASSIGNED', statusFilter: 'ALL' })}
                    className="py-3 hover:bg-amber-50/60 px-2 rounded-xl transition-colors cursor-pointer group border-t border-amber-100 bg-amber-50/30"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={15} className="text-amber-600" />
                        <span className="text-xs font-bold text-amber-900">Unassigned Backlog Pool</span>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-900">
                        {unassignedTasks.length} Tasks Unassigned
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MY DASHBOARD / USER DASHBOARD VIEW (Requirement 55) */}
      {/* ========================================================================= */}
      {dashboardMode === 'my' && (
        <div className="space-y-6">
          {/* A. User Quick KPI Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <Target size={14} className="text-zinc-500" />
                <span>My Active Deliverables</span>
              </h2>
              <span className="text-[11px] text-zinc-400">Click any card to open full Task List</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* My Total Active */}
              <button
                type="button"
                onClick={() => handleDrilldownNavigate({ workspaceId: 'ME', statusFilter: 'ALL' })}
                className="p-3.5 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="text-[11px] font-semibold text-zinc-500 group-hover:text-zinc-900">My Active Tasks</div>
                <div className="text-xl font-bold text-zinc-900 mt-1">{activeMyTasks.length}</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">Assigned to you</div>
              </button>

              {/* My To Do */}
              <button
                type="button"
                onClick={() => handleDrilldownNavigate({ workspaceId: 'ME', statusFilter: 'BACKLOG' })}
                className="p-3.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="text-[11px] font-semibold text-zinc-600 group-hover:text-zinc-900">To Do</div>
                <div className="text-xl font-bold text-zinc-800 mt-1">{myTasksBreakdown.TODO.length}</div>
                <div className="text-[10px] text-zinc-400 mt-0.5">Ready to start</div>
              </button>

              {/* My In Progress */}
              <button
                type="button"
                onClick={() => handleDrilldownNavigate({ workspaceId: 'ME', statusFilter: 'IN_PROGRESS' })}
                className="p-3.5 rounded-xl bg-blue-50/60 hover:bg-blue-50 border border-blue-200/80 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="text-[11px] font-semibold text-blue-700 group-hover:text-blue-900">In Progress</div>
                <div className="text-xl font-bold text-blue-800 mt-1">{myTasksBreakdown.IN_PROGRESS.length}</div>
                <div className="text-[10px] text-blue-600/70 mt-0.5">Actively working</div>
              </button>

              {/* My In Review */}
              <button
                type="button"
                onClick={() => handleDrilldownNavigate({ workspaceId: 'ME', statusFilter: 'INTERNAL_REVIEW' })}
                className="p-3.5 rounded-xl bg-indigo-50/60 hover:bg-indigo-50 border border-indigo-200/80 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="text-[11px] font-semibold text-indigo-700 group-hover:text-indigo-900">In Review</div>
                <div className="text-xl font-bold text-indigo-800 mt-1">{myTasksBreakdown.REVIEW.length}</div>
                <div className="text-[10px] text-indigo-600/70 mt-0.5">Awaiting lead feedback</div>
              </button>

              {/* My In Iteration */}
              <button
                type="button"
                onClick={() => handleDrilldownNavigate({ workspaceId: 'ME', statusFilter: 'REVISION' })}
                className="p-3.5 rounded-xl bg-purple-50/60 hover:bg-purple-50 border border-purple-200/80 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="text-[11px] font-semibold text-purple-700 group-hover:text-purple-900">In Iteration</div>
                <div className="text-xl font-bold text-purple-800 mt-1">{myTasksBreakdown.ITERATION.length}</div>
                <div className="text-[10px] text-purple-600/70 mt-0.5">Refinements needed</div>
              </button>

              {/* My Completed */}
              <button
                type="button"
                onClick={() => handleDrilldownNavigate({ workspaceId: 'ME', statusFilter: 'DONE' })}
                className="p-3.5 rounded-xl bg-emerald-50/60 hover:bg-emerald-50 border border-emerald-200/80 text-left transition-all cursor-pointer group shadow-2xs"
              >
                <div className="text-[11px] font-semibold text-emerald-700 group-hover:text-emerald-900">Completed</div>
                <div className="text-xl font-bold text-emerald-800 mt-1">{completedMyTasks.length}</div>
                <div className="text-[10px] text-emerald-600/70 mt-0.5">Signed off</div>
              </button>
            </div>
          </div>

          {/* B. My Active Sprint & Personal Workspace Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* My Task Status Summary Card */}
            <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                  <h3 className="text-sm font-bold text-zinc-900">My Task Status Breakdown</h3>
                  <button
                    type="button"
                    onClick={() => onNavigateTab('my-tasks', { workspaceId: 'ME' })}
                    className="text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
                  >
                    Open Workspace
                  </button>
                </div>

                <div className="divide-y divide-zinc-100 mt-2 text-xs">
                  <div
                    onClick={() => handleDrilldownNavigate({ workspaceId: 'ME', statusFilter: 'BACKLOG' })}
                    className="py-2.5 flex justify-between items-center hover:bg-zinc-50 px-2 rounded-lg cursor-pointer group"
                  >
                    <span className="font-medium text-zinc-600 group-hover:text-zinc-900">To Do</span>
                    <span className="font-bold text-zinc-900 underline-offset-2 group-hover:underline">{myTasksBreakdown.TODO.length}</span>
                  </div>

                  <div
                    onClick={() => handleDrilldownNavigate({ workspaceId: 'ME', statusFilter: 'IN_PROGRESS' })}
                    className="py-2.5 flex justify-between items-center hover:bg-blue-50/50 px-2 rounded-lg cursor-pointer group"
                  >
                    <span className="font-medium text-blue-700 group-hover:text-blue-900">In Progress</span>
                    <span className="font-bold text-blue-700 underline-offset-2 group-hover:underline">{myTasksBreakdown.IN_PROGRESS.length}</span>
                  </div>

                  <div
                    onClick={() => handleDrilldownNavigate({ workspaceId: 'ME', statusFilter: 'BLOCKED' })}
                    className="py-2.5 flex justify-between items-center hover:bg-amber-50/50 px-2 rounded-lg cursor-pointer group"
                  >
                    <span className="font-medium text-amber-700 group-hover:text-amber-900">On Hold / Blocked</span>
                    <span className="font-bold text-amber-700 underline-offset-2 group-hover:underline">{myTasksBreakdown.ON_HOLD.length}</span>
                  </div>

                  <div
                    onClick={() => handleDrilldownNavigate({ workspaceId: 'ME', statusFilter: 'INTERNAL_REVIEW' })}
                    className="py-2.5 flex justify-between items-center hover:bg-indigo-50/50 px-2 rounded-lg cursor-pointer group"
                  >
                    <span className="font-medium text-indigo-700 group-hover:text-indigo-900">Submit for Review</span>
                    <span className="font-bold text-indigo-700 underline-offset-2 group-hover:underline">{myTasksBreakdown.REVIEW.length}</span>
                  </div>

                  <div
                    onClick={() => handleDrilldownNavigate({ workspaceId: 'ME', statusFilter: 'REVISION' })}
                    className="py-2.5 flex justify-between items-center hover:bg-purple-50/50 px-2 rounded-lg cursor-pointer group"
                  >
                    <span className="font-medium text-purple-700 group-hover:text-purple-900">In Iteration</span>
                    <span className="font-bold text-purple-700 underline-offset-2 group-hover:underline">{myTasksBreakdown.ITERATION.length}</span>
                  </div>

                  <div
                    onClick={() => handleDrilldownNavigate({ workspaceId: 'ME', statusFilter: 'DONE' })}
                    className="py-2.5 flex justify-between items-center hover:bg-emerald-50/50 px-2 rounded-lg cursor-pointer group"
                  >
                    <span className="font-medium text-emerald-700 group-hover:text-emerald-900">Completed</span>
                    <span className="font-bold text-emerald-700 underline-offset-2 group-hover:underline">{completedMyTasks.length}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => onNavigateTab('my-tasks', { workspaceId: 'ME', statusFilter: 'ALL' })}
                  className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span>View All My Tasks ({myTasks.length})</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>

            {/* My Active High Priority Queue */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-zinc-200 p-5 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <Flame size={16} className="text-rose-500" />
                  <h3 className="text-sm font-bold text-zinc-900">My Priority Queue</h3>
                </div>
                <span className="text-xs text-zinc-400 font-semibold">{activeMyTasks.length} active tasks</span>
              </div>

              <div className="divide-y divide-zinc-100 max-h-[300px] overflow-y-auto">
                {activeMyTasks.slice(0, 6).map(task => {
                  const project = projects.find(p => p.id === task.projectId);
                  return (
                    <div
                      key={task.id}
                      onClick={() => onSelectTask(task.id)}
                      className="py-3 hover:bg-zinc-50 px-2 rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        {task.jiraIssueKey ? (
                          <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
                            {task.jiraIssueKey}
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] text-zinc-400 shrink-0">
                            {task.id.slice(0, 6)}
                          </span>
                        )}
                        <div className="truncate">
                          <div className="text-xs font-bold text-zinc-900 group-hover:text-blue-700 transition-colors truncate">
                            {task.title}
                          </div>
                          <div className="text-[11px] text-zinc-500">{project?.name || 'Project'} • {task.taskType}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <TaskStatusBadge status={task.status} />
                        <PriorityBadge priority={task.priority} />
                        <span className="text-xs font-mono font-bold text-zinc-600">
                          {task.remainingEstimate ?? task.originalEstimate ?? 0}h
                        </span>
                      </div>
                    </div>
                  );
                })}

                {activeMyTasks.length === 0 && (
                  <div className="p-8 text-center text-xs text-zinc-400">
                    No active tasks currently assigned to your queue.
                  </div>
                )}
              </div>

              {activeMyTasks.length > 6 && (
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => onNavigateTab('my-tasks', { workspaceId: 'ME' })}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    + {activeMyTasks.length - 6} more active tasks in your list
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
