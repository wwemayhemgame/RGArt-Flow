import React, { useState, useMemo } from 'react';
import {
  Layers,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  Play,
  Check,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  ListTodo,
  ArrowLeft,
  ArrowRight,
  Filter,
  Search,
  Users,
  User,
  UserCheck,
  X,
  RotateCcw,
  SlidersHorizontal,
  Target,
  CheckSquare,
  Square,
  Edit3,
  History,
  ShieldAlert,
  ArrowRightLeft
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { Sprint, Task, SprintStatus, TaskStatus, AdvancedFilterGroup, WORKFLOW_STATUS_LIST, normalizeTaskStatus } from '../../types';
import { TaskStatusBadge, PriorityBadge } from '../common/Badge';
import { Avatar } from '../common/Avatar';
import { CapacityBar } from '../common/CapacityBar';
import { formatDate } from '../../utils/dateUtils';
import { Modal } from '../common/Modal';
import {
  getArtistEffectiveWeeklyCapacity,
  getArtistSprintCapacity,
  getArtistSprintLeaveDetails,
  getSprintOverallMetrics
} from '../../utils/forecastEngine';
import { formatDuration } from '../../utils/timeUtils';
import { AdvancedSearchModal } from '../common/AdvancedSearchModal';
import { BulkEditModal } from '../common/BulkEditModal';
import { ContextualBulkActionBar } from '../common/ContextualBulkActionBar';
import { UniversalTaskTable } from '../common/UniversalTaskTable';
import { applyAdvancedFilters } from '../../utils/advancedFilterEngine';
import { SprintMultiStatusFilter } from '../common/SprintMultiStatusFilter';

interface SprintsViewProps {
  onSelectTask: (taskId: string, activeFilteredList?: string[]) => void;
  onOpenCreateSprint: () => void;
  onOpenCreateTask: () => void;
  onOpenAiPlanner: () => void;
}

export const SprintsView: React.FC<SprintsViewProps> = ({
  onSelectTask,
  onOpenCreateSprint,
  onOpenCreateTask,
  onOpenAiPlanner
}) => {
  const {
    sprints,
    tasks,
    artists,
    projects,
    updateSprintStatus,
    completeSprint,
    moveCompletedSprintPendingTasksToActiveSprint,
    canManageSprints,
    moveTaskToSprint,
    applyBulkEditTasks,
    syncTaskToJira,
    canManageSprint,
    canAccessAiSprintPlanner,
    currentUser
  } = useArtOps();

  const [selectedSprintId, setSelectedSprintId] = useState<string>(() => {
    const active = sprints.find(s => s.status.toUpperCase() === 'ACTIVE');
    return active ? active.id : sprints[0]?.id || '';
  });

  // Filter States
  const [selectedArtistFilter, setSelectedArtistFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  // Advanced Search & Bulk Edit State
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [advancedFilterGroup, setAdvancedFilterGroup] = useState<AdvancedFilterGroup | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Sprint Management Modals & Alerts
  const [isCompleteSprintModalOpen, setIsCompleteSprintModalOpen] = useState(false);
  const [activeSprintConflict, setActiveSprintConflict] = useState<{ activeSprint: Sprint; targetSprint: Sprint } | null>(null);
  const [sprintActionAlert, setSprintActionAlert] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const selectedSprint = useMemo(() => {
    return sprints.find(s => s.id === selectedSprintId) || sprints[0] || null;
  }, [sprints, selectedSprintId]);

  // Tasks assigned to currently selected sprint
  const sprintTasks = useMemo(() => {
    if (!selectedSprint) return [];
    return tasks.filter(t => t.sprintId === selectedSprint.id);
  }, [tasks, selectedSprint]);

  // Helper for completed check
  const isTaskFinished = (st: string) => {
    const s = (st || '').toUpperCase().replace(/[\s_-]+/g, '');
    return s === 'COMPLETED' || s === 'DONE' || s === 'RESOLVED' || s === 'CLOSED';
  };

  const completedSprintTasks = useMemo(() => {
    return sprintTasks.filter(t => isTaskFinished(t.status));
  }, [sprintTasks]);

  const incompleteSprintTasks = useMemo(() => {
    return sprintTasks.filter(t => !isTaskFinished(t.status));
  }, [sprintTasks]);

  // Determine next sprint name for carry forward preview
  const nextSprintPreviewName = useMemo(() => {
    if (!selectedSprint) return 'Next Sprint';
    const nextNum = (selectedSprint.sprintNumber || 2) + 1;
    const existingNext = sprints.find(s => s.sprintNumber === nextNum);
    return existingNext?.name || `Sprint ${nextNum}`;
  }, [selectedSprint, sprints]);

  // Find Current User's matching artist profile
  const myArtistRecord = useMemo(() => {
    if (!currentUser) return null;
    return (
      artists.find(
        a =>
          (currentUser.artistId && a.id === currentUser.artistId) ||
          (currentUser.id && a.userId === currentUser.id) ||
          (currentUser.id && a.id === currentUser.id) ||
          (currentUser.email && a.email?.toLowerCase() === currentUser.email.toLowerCase())
      ) || null
    );
  }, [artists, currentUser]);

  const myAssigneeId = myArtistRecord?.id || currentUser?.artistId || currentUser?.id;

  // Artist breakdown in this sprint
  const artistsInSprint = useMemo(() => {
    const map = new Map<string, { artist: (typeof artists)[0]; taskCount: number; totalHours: number; totalSP: number }>();
    
    sprintTasks.forEach(task => {
      if (task.artistId) {
        const art = artists.find(a => a.id === task.artistId);
        if (art) {
          const current = map.get(art.id) || { artist: art, taskCount: 0, totalHours: 0, totalSP: 0 };
          current.taskCount += 1;
          current.totalHours += (task.remainingEstimate ?? task.originalEstimate ?? 0);
          current.totalSP += (task.storyPoints || 0);
          map.set(art.id, current);
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => b.taskCount - a.taskCount);
  }, [sprintTasks, artists]);

  const unassignedSprintTasksCount = useMemo(() => {
    return sprintTasks.filter(t => !t.artistId).length;
  }, [sprintTasks]);

  const mySprintTasksCount = useMemo(() => {
    if (!myAssigneeId) return 0;
    return sprintTasks.filter(t => t.artistId === myAssigneeId || t.artistId === currentUser?.id || t.artistId === currentUser?.artistId).length;
  }, [sprintTasks, myAssigneeId, currentUser]);

  // Status breakdown counts in sprint
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'ALL': sprintTasks.length,
      'To Do': 0,
      'In Progress': 0,
      'On Hold': 0,
      'Re-opened': 0,
      'Submit for Review': 0,
      'In Iteration': 0,
      'Completed': 0,
      'Cancelled': 0,
      'CARRIED_FORWARD': 0
    };
    sprintTasks.forEach(t => {
      const norm = normalizeTaskStatus(t.status);
      if (counts[norm] !== undefined) {
        counts[norm]++;
      } else {
        counts[norm] = (counts[norm] || 0) + 1;
      }
      if (t.sprintHistory && t.sprintHistory.length > 1) {
        counts['CARRIED_FORWARD']++;
      }
    });
    return counts;
  }, [sprintTasks]);

  // Filtered tasks based on selected artist, search query, status, and advanced filters
  const filteredSprintTasks = useMemo(() => {
    let result = sprintTasks.filter(task => {
      // 1. Artist filter
      if (selectedArtistFilter === 'UNASSIGNED') {
        if (task.artistId) return false;
      } else if (selectedArtistFilter === 'ME') {
        const isMine =
          (myAssigneeId && task.artistId === myAssigneeId) ||
          (currentUser?.id && task.artistId === currentUser.id) ||
          (currentUser?.artistId && task.artistId === currentUser.artistId);
        if (!isMine) return false;
      } else if (selectedArtistFilter !== 'ALL') {
        if (task.artistId !== selectedArtistFilter) return false;
      }

      // 2. Multi-Status filter
      if (selectedStatuses.length > 0) {
        const matchesStatus = selectedStatuses.some(st => {
          if (st === 'CARRIED_FORWARD') {
            return Boolean(task.sprintHistory && task.sprintHistory.length > 1);
          }
          return normalizeTaskStatus(task.status) === normalizeTaskStatus(st);
        });
        if (!matchesStatus) return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const artist = artists.find(a => a.id === task.artistId);
        const project = projects.find(p => p.id === task.projectId);
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchId = task.id.toLowerCase().includes(q);
        const matchJira = Boolean(task.jiraIssueKey && task.jiraIssueKey.toLowerCase().includes(q));
        const matchArtist = artist?.name.toLowerCase().includes(q);
        const matchProject = project?.name.toLowerCase().includes(q);
        const matchType = task.taskType?.toLowerCase().includes(q);
        if (!matchTitle && !matchId && !matchJira && !matchArtist && !matchProject && !matchType) {
          return false;
        }
      }

      return true;
    });

    if (advancedFilterGroup && advancedFilterGroup.rules.length > 0) {
      result = applyAdvancedFilters(result, advancedFilterGroup);
    }

    return result;
  }, [sprintTasks, selectedArtistFilter, selectedStatuses, searchQuery, artists, projects, myAssigneeId, currentUser, advancedFilterGroup]);

  // Selected Artist details for display banner
  const selectedArtistObject = useMemo(() => {
    if (selectedArtistFilter === 'ME' && myArtistRecord) return myArtistRecord;
    if (selectedArtistFilter !== 'ALL' && selectedArtistFilter !== 'UNASSIGNED' && selectedArtistFilter !== 'ME') {
      return artists.find(a => a.id === selectedArtistFilter) || null;
    }
    return null;
  }, [selectedArtistFilter, myArtistRecord, artists]);

  // Selected Artist sprint capacity & leave breakdown
  const selectedArtistSprintCap = useMemo(() => {
    if (!selectedArtistObject || !selectedSprint) return null;
    const artistTasks = sprintTasks.filter(t => t.artistId === selectedArtistObject.id);
    return getArtistSprintCapacity(selectedArtistObject, selectedSprint, artistTasks);
  }, [selectedArtistObject, selectedSprint, sprintTasks]);

  // Sprint Metrics & Capacity Calculations factoring in scheduled leaves & time-off
  const sprintMetrics = useMemo(() => {
    if (!selectedSprint) {
      const totalTasks = sprintTasks.length;
      const completedTasks = sprintTasks.filter(t => t.status === 'DONE' || t.status === 'Completed').length;
      const blockedTasks = sprintTasks.filter(t => t.status === 'BLOCKED' || t.status === 'On Hold').length;
      const totalCommittedHours = sprintTasks.reduce((acc, t) => acc + (t.remainingEstimate ?? t.originalEstimate ?? 0), 0);
      const totalOriginalHours = sprintTasks.reduce((acc, t) => acc + (t.originalEstimate || 0), 0);
      const totalSP = sprintTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
      const completedSP = sprintTasks.filter(t => t.status === 'DONE' || t.status === 'Completed').reduce((acc, t) => acc + (t.storyPoints || 0), 0);
      return {
        totalTasks,
        completedTasks,
        blockedTasks,
        totalCommittedHours,
        totalOriginalHours,
        totalSP,
        completedSP,
        totalGrossCapacity: 0,
        totalLeaveDeductionHours: 0,
        totalNetAvailableCapacity: 0,
        overallUtilization: 0,
        artistsOnLeaveCount: 0
      };
    }

    return getSprintOverallMetrics(artists, selectedSprint, sprintTasks);
  }, [artists, selectedSprint, sprintTasks]);

  // Handle Start Sprint
  const handleStartSprint = (sprintId: string) => {
    const target = sprints.find(s => s.id === sprintId);
    if (!target) return;

    const currentActive = sprints.find(s => s.status.toUpperCase() === 'ACTIVE' && s.id !== sprintId);
    if (currentActive) {
      setActiveSprintConflict({ activeSprint: currentActive, targetSprint: target });
      return;
    }

    updateSprintStatus(sprintId, 'Active');
    setSprintActionAlert({ type: 'success', message: `Sprint "${target.name}" is now Active!` });
    setTimeout(() => setSprintActionAlert(null), 4000);
  };

  const handleConfirmSwitchActiveSprint = () => {
    if (!activeSprintConflict) return;
    const { activeSprint, targetSprint } = activeSprintConflict;
    updateSprintStatus(activeSprint.id, 'Completed');
    updateSprintStatus(targetSprint.id, 'Active');
    setActiveSprintConflict(null);
    setSprintActionAlert({
      type: 'success',
      message: `Completed "${activeSprint.name}" and Activated "${targetSprint.name}".`
    });
    setTimeout(() => setSprintActionAlert(null), 5000);
  };

  const handleExecuteCompleteSprint = async () => {
    if (!selectedSprint) return;
    setIsCompleteSprintModalOpen(false);
    const res = await completeSprint(selectedSprint.id);
    if (res.success) {
      setSprintActionAlert({ type: 'success', message: res.message });
      if (res.nextSprintId) {
        setSelectedSprintId(res.nextSprintId);
      }
      setTimeout(() => setSprintActionAlert(null), 5000);
    } else {
      setSprintActionAlert({ type: 'error', message: res.message || 'Failed to complete sprint.' });
      setTimeout(() => setSprintActionAlert(null), 5000);
    }
  };

  // Pending (incomplete) tasks remaining in completed sprints
  const completedSprintPendingTasks = useMemo(() => {
    const completedSprintIds = new Set(
      sprints.filter(s => s.status.toUpperCase() === 'COMPLETED').map(s => s.id)
    );
    return tasks.filter(t => t.sprintId && completedSprintIds.has(t.sprintId) && !isTaskFinished(t.status));
  }, [sprints, tasks]);

  const [isMovingPendingTasks, setIsMovingPendingTasks] = useState(false);
  const handleMoveCompletedSprintPendingTasks = async () => {
    setIsMovingPendingTasks(true);
    try {
      const res = await moveCompletedSprintPendingTasksToActiveSprint();
      if (res.success) {
        setSprintActionAlert({ type: 'success', message: res.message });
        const active = sprints.find(s => s.status.toUpperCase() === 'ACTIVE');
        if (active) setSelectedSprintId(active.id);
        setTimeout(() => setSprintActionAlert(null), 5000);
      } else {
        setSprintActionAlert({ type: 'error', message: res.message });
        setTimeout(() => setSprintActionAlert(null), 5000);
      }
    } finally {
      setIsMovingPendingTasks(false);
    }
  };

  const hasActiveFilters =
    selectedArtistFilter !== 'ALL' ||
    selectedStatuses.length > 0 ||
    searchQuery.trim() !== '' ||
    (advancedFilterGroup !== null && advancedFilterGroup.rules.length > 0);

  const handleResetFilters = () => {
    setSelectedArtistFilter('ALL');
    setSelectedStatuses([]);
    setSearchQuery('');
    setAdvancedFilterGroup(null);
  };

  return (
    <div id="sprints-view" className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Art Production Sprints</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 font-bold text-slate-700 border border-slate-200">
              {sprints.length} Sprints Configured
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Sprint milestone planning, committed story point velocity, artist capacity leaves, and carry-forward tracking.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canAccessAiSprintPlanner() && (
            <button
              type="button"
              onClick={onOpenAiPlanner}
              className="px-3.5 py-2 text-xs font-bold text-white bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles size={14} />
              <span>AI Sprint Planner</span>
            </button>
          )}

          {canManageSprint() && (
            <button
              id="btn-create-sprint-header"
              type="button"
              onClick={onOpenCreateSprint}
              className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Plus size={14} />
              <span>New Sprint</span>
            </button>
          )}
        </div>
      </div>

      {/* Sprints Selector Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {sprints.map(s => {
          const isSelected = s.id === selectedSprintId;
          const statusUpper = s.status.toUpperCase();
          const statusBg =
            statusUpper === 'ACTIVE'
              ? 'bg-emerald-600 text-white'
              : statusUpper === 'COMPLETED'
              ? 'bg-slate-500 text-white'
              : 'bg-indigo-600 text-white';

          return (
            <button
              key={s.id}
              id={`sprint-tab-${s.id}`}
              type="button"
              onClick={() => {
                setSelectedSprintId(s.id);
                setSelectedTaskIds(new Set());
              }}
              className={`px-4 py-2.5 rounded-xl border text-left shrink-0 transition-all flex items-center gap-3 cursor-pointer ${
                isSelected
                  ? 'bg-white border-blue-600 shadow-xs ring-2 ring-blue-500/20'
                  : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs text-slate-900">
                    {s.sprintNumber ? `Sprint ${s.sprintNumber}` : s.name.replace(/[:(].*$/, '').trim()}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${statusBg}`}>
                    {s.status}
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block mt-0.5 font-mono">
                  {formatDate(s.startDate)} — {formatDate(s.endDate)}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Action Alert Banner */}
      {sprintActionAlert && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs font-semibold animate-in fade-in duration-150 ${
            sprintActionAlert.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : sprintActionAlert.type === 'error'
              ? 'bg-red-50 border-red-300 text-red-900'
              : 'bg-blue-50 border-blue-300 text-blue-900'
          }`}
        >
          <span>{sprintActionAlert.message}</span>
          <button
            type="button"
            onClick={() => setSprintActionAlert(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Pending Tasks in Completed Sprints Notice Banner */}
      {completedSprintPendingTasks.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0 mt-0.5">
              <ArrowRightLeft size={18} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-950">
                {completedSprintPendingTasks.length} Pending {completedSprintPendingTasks.length === 1 ? 'Task' : 'Tasks'} in Completed Sprints
              </h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Tasks in completed sprints that weren't finished can be carried forward into the active sprint ({sprints.find(s => s.status.toUpperCase() === 'ACTIVE')?.name || 'Active Sprint'}) and marked as moved.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isMovingPendingTasks}
            onClick={handleMoveCompletedSprintPendingTasks}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shrink-0 transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ArrowRightLeft size={13} />
            <span>{isMovingPendingTasks ? 'Moving Tasks...' : 'Move to Active Sprint'}</span>
          </button>
        </div>
      )}

      {/* Selected Sprint Header Card & Metric Strip */}
      {selectedSprint && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-black text-slate-900">
                  {selectedSprint.sprintNumber ? `Sprint ${selectedSprint.sprintNumber}` : selectedSprint.name.replace(/[:(].*$/, '').trim()}
                </h2>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                    selectedSprint.status.toUpperCase() === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : selectedSprint.status.toUpperCase() === 'COMPLETED'
                      ? 'bg-slate-100 text-slate-700 border border-slate-200'
                      : 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                  }`}
                >
                  {selectedSprint.status}
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {formatDate(selectedSprint.startDate)} — {formatDate(selectedSprint.endDate)}
                </span>
              </div>
              {selectedSprint.goal && (
                <p className="text-xs text-slate-600 mt-1 italic">🎯 Goal: {selectedSprint.goal}</p>
              )}
            </div>

            {/* Sprint Lifecycle Controls */}
            {canManageSprint() && (
              <div className="flex items-center gap-2 flex-wrap">
                {completedSprintPendingTasks.length > 0 && (
                  <button
                    type="button"
                    disabled={isMovingPendingTasks}
                    onClick={handleMoveCompletedSprintPendingTasks}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    title="Move pending tasks from completed sprints into active sprint and mark as moved"
                  >
                    <ArrowRightLeft size={13} />
                    <span>{isMovingPendingTasks ? 'Moving...' : `Move Pending (${completedSprintPendingTasks.length})`}</span>
                  </button>
                )}

                {selectedSprint.status.toUpperCase() === 'PLANNING' && (
                  <button
                    type="button"
                    onClick={() => handleStartSprint(selectedSprint.id)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Play size={13} fill="currentColor" />
                    <span>Start Sprint</span>
                  </button>
                )}

                {selectedSprint.status.toUpperCase() === 'ACTIVE' && (
                  <button
                    type="button"
                    onClick={() => setIsCompleteSprintModalOpen(true)}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 size={14} />
                    <span>Complete Sprint</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onOpenCreateTask}
                  className="px-3 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Add Task</span>
                </button>
              </div>
            )}
          </div>

          {/* Sprint KPI Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-400 font-bold uppercase block">Velocity / Story Points</span>
              <span className="text-lg font-bold text-purple-700 block">
                {sprintMetrics.completedSP} / {sprintMetrics.totalSP} SP
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {sprintMetrics.totalTasks} total tasks
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-400 font-bold uppercase block">Tasks Progress</span>
              <span className="text-lg font-bold text-slate-900 block">
                {sprintMetrics.completedTasks} / {sprintMetrics.totalTasks} Done
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {sprintMetrics.blockedTasks > 0 ? `${sprintMetrics.blockedTasks} on hold/blocked` : '0 blocked tasks'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-400 font-bold uppercase block">Committed Effort</span>
              <span className="text-lg font-bold text-slate-900 block font-mono">
                {sprintMetrics.totalCommittedHours}h / {sprintMetrics.totalNetAvailableCapacity}h Net
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5 truncate">
                {sprintMetrics.totalGrossCapacity}h Gross {sprintMetrics.totalLeaveDeductionHours > 0 ? `• -${sprintMetrics.totalLeaveDeductionHours}h Leaves` : ''}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[11px] text-slate-400 font-bold uppercase block">Studio Sprint Load</span>
              <span
                className={`text-lg font-bold block ${
                  sprintMetrics.overallUtilization > 100
                    ? 'text-red-600'
                    : sprintMetrics.overallUtilization > 85
                    ? 'text-amber-600'
                    : 'text-emerald-700'
                }`}
              >
                {sprintMetrics.overallUtilization}% Capacity
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {sprintMetrics.artistsOnLeaveCount > 0
                  ? `⚠️ ${sprintMetrics.artistsOnLeaveCount} on scheduled leave`
                  : 'Full studio capacity active'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* FILTER CONTROLS BAR & ARTIST SELECTOR */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Task input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="input-sprint-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sprint tasks by title, key, artist, project..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-hidden font-medium text-slate-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Advanced Search Button */}
            <button
              type="button"
              onClick={() => setIsAdvancedSearchOpen(true)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs ${
                advancedFilterGroup && advancedFilterGroup.rules.length > 0
                  ? 'bg-blue-50 border-blue-300 text-blue-800 font-bold'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title="Open Advanced Multi-Field Filter Engine"
            >
              <SlidersHorizontal size={13} className={advancedFilterGroup && advancedFilterGroup.rules.length > 0 ? 'text-blue-600' : 'text-slate-500'} />
              <span>Advanced</span>
              {advancedFilterGroup && advancedFilterGroup.rules.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">
                  {advancedFilterGroup.rules.length}
                </span>
              )}
            </button>

            {/* Primary Artist Filter Dropdown */}
            <select
              id="select-sprint-artist"
              value={selectedArtistFilter}
              onChange={(e) => setSelectedArtistFilter(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-hidden cursor-pointer"
            >
              <option value="ALL">All Artists ({sprintTasks.length})</option>
              {currentUser && mySprintTasksCount > 0 && (
                <option value="ME">⭐ My Tasks ({mySprintTasksCount})</option>
              )}
              <option value="UNASSIGNED">⚠️ Unassigned ({unassignedSprintTasksCount})</option>
              
              <optgroup label="Artists in this Sprint">
                {artistsInSprint.map(({ artist, taskCount, totalHours }) => (
                  <option key={artist.id} value={artist.id}>
                    {artist.name} ({taskCount} tasks • {totalHours}h)
                  </option>
                ))}
              </optgroup>
            </select>

            {/* Multi-Status Filter Dropdown */}
            <SprintMultiStatusFilter
              selectedStatuses={selectedStatuses}
              onChange={setSelectedStatuses}
              statusCounts={statusCounts}
              totalTasksCount={sprintTasks.length}
              filteredTasksCount={filteredSprintTasks.length}
            />

            {/* Reset Filter Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                title="Reset all filters"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Multi-Status Filter Badges */}
        {selectedStatuses.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-xs">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Filter size={12} className="text-blue-600" />
              <span>Filtering by Status:</span>
            </span>
            {selectedStatuses.map(st => (
              <span
                key={st}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs"
              >
                <span>{st === 'CARRIED_FORWARD' ? 'Carried Forward' : st}</span>
                <span className="text-[10px] text-blue-600 font-mono">({statusCounts[st] || 0})</span>
                <button
                  type="button"
                  onClick={() => setSelectedStatuses(selectedStatuses.filter(s => s !== st))}
                  className="hover:bg-blue-200/80 p-0.5 rounded-full transition-colors cursor-pointer text-blue-700 hover:text-blue-900 ml-0.5"
                  title={`Remove ${st} filter`}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setSelectedStatuses([])}
              className="text-xs text-slate-500 hover:text-slate-800 underline ml-1 cursor-pointer font-medium"
            >
              Clear status filter
            </button>
          </div>
        )}

        {/* Selected Artist Capacity / Focus Banner */}
        {selectedArtistObject && (
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex flex-col gap-3 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Avatar name={selectedArtistObject.name} src={selectedArtistObject.avatar} size="sm" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{selectedArtistObject.name}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      {selectedArtistObject.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{selectedArtistObject.specialization}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Sprint Load</span>
                  <span
                    className={`font-bold text-sm ${
                      (selectedArtistSprintCap?.utilization ?? 0) > 100
                        ? 'text-red-600'
                        : (selectedArtistSprintCap?.utilization ?? 0) > 85
                        ? 'text-amber-600'
                        : 'text-emerald-700'
                    }`}
                  >
                    {selectedArtistSprintCap?.utilization ?? 0}%
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedArtistFilter('ALL')}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 cursor-pointer ml-1"
                  title="Clear artist focus"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {selectedArtistSprintCap && selectedArtistSprintCap.leaveHoursDeducted > 0 && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 px-3 py-2 rounded-lg flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold">📅 Scheduled Time Off in this Sprint:</span>
                  <span>
                    {selectedArtistSprintCap.overlappingLeaves.map(l => `${formatDate(l.startDate)}${l.startDate !== l.endDate ? ` → ${formatDate(l.endDate)}` : ''} (${l.reason})`).join(', ')}
                  </span>
                </div>
                <span className="font-semibold text-[11px] shrink-0 bg-amber-200/80 px-2 py-0.5 rounded">
                  -{selectedArtistSprintCap.leaveHoursDeducted}h capacity deducted
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Universal Multi-Column Task Table */}
      <UniversalTaskTable
        tableKey={`sprint-${selectedSprint?.id || 'tasks'}`}
        tasks={filteredSprintTasks}
        onSelectTask={onSelectTask}
        selectedTaskIds={selectedTaskIds}
        onToggleSelectTask={(id) => {
          setSelectedTaskIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        }}
        onSelectAllTasks={(allIds) => setSelectedTaskIds(new Set(allIds))}
        onClearSelection={() => setSelectedTaskIds(new Set())}
        emptyMessage="No tasks found in this sprint"
        emptySubMessage="Add backlog tasks to this sprint or adjust your filter parameters."
        onEmptyAction={onOpenCreateTask}
        emptyActionLabel="Add Task to Sprint"
      />

      {/* Complete Sprint Modal */}
      {isCompleteSprintModalOpen && selectedSprint && (
        <Modal
          isOpen={isCompleteSprintModalOpen}
          onClose={() => setIsCompleteSprintModalOpen(false)}
          title={`Complete Sprint: ${selectedSprint.name}`}
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between font-bold text-blue-900">
                <span>Completed Tasks</span>
                <span className="text-emerald-700 font-mono text-sm">{completedSprintTasks.length} Done</span>
              </div>
              <div className="flex items-center justify-between font-bold text-blue-900">
                <span>Open / Incomplete Tasks</span>
                <span className="text-amber-700 font-mono text-sm">{incompleteSprintTasks.length} Incomplete</span>
              </div>
            </div>

            {incompleteSprintTasks.length > 0 ? (
              <div className="space-y-2">
                <p className="text-slate-600 font-medium">
                  The {incompleteSprintTasks.length} incomplete tasks will be automatically carried forward into{' '}
                  <strong className="text-slate-900 font-bold">{nextSprintPreviewName}</strong> with full history preserved.
                </p>
                <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 p-2 bg-slate-50">
                  {incompleteSprintTasks.map(t => (
                    <div key={t.id} className="py-1.5 px-2 flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-800 truncate max-w-[240px]">{t.title}</span>
                      <TaskStatusBadge status={t.status} />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-emerald-700 font-bold">
                🎉 All tasks in this sprint are complete! Great job team!
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsCompleteSprintModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteCompleteSprint}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Confirm & Complete Sprint
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Active Sprint Conflict Modal */}
      {activeSprintConflict && (
        <Modal
          isOpen={!!activeSprintConflict}
          onClose={() => setActiveSprintConflict(null)}
          title="Active Sprint Conflict"
          size="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2">
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-1">Sprint in Progress</span>
                <span>
                  Sprint <strong>"{activeSprintConflict.activeSprint.name}"</strong> is currently Active. Starting{' '}
                  <strong>"{activeSprintConflict.targetSprint.name}"</strong> will mark the previous sprint as Completed and
                  carry over open tasks.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveSprintConflict(null)}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSwitchActiveSprint}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors cursor-pointer"
              >
                Complete Current & Start New Sprint
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Advanced Search Modal */}
      {isAdvancedSearchOpen && (
        <AdvancedSearchModal
          isOpen={isAdvancedSearchOpen}
          onClose={() => setIsAdvancedSearchOpen(false)}
          filterState={advancedFilterGroup || { matchMode: 'AND', rules: [] }}
          onApplyFilter={(state) => {
            setAdvancedFilterGroup(state);
            setIsAdvancedSearchOpen(false);
          }}
          onResetFilter={() => {
            setAdvancedFilterGroup(null);
            setIsAdvancedSearchOpen(false);
          }}
          projects={projects}
          artists={artists}
          sprints={sprints}
        />
      )}
    </div>
  );
};
