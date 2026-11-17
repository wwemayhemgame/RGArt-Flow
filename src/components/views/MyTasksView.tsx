import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckSquare,
  Square,
  Clock,
  AlertTriangle,
  RotateCcw,
  Plus,
  Sparkles,
  ChevronRight,
  ExternalLink,
  Flame,
  CheckCircle2,
  Paperclip,
  ShieldAlert,
  Users,
  UserCheck,
  Search,
  SlidersHorizontal,
  Edit3,
  X,
  Filter,
  Layers,
  Calendar
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import {
  Task,
  TaskStatus,
  Artist,
  Priority,
  normalizeTaskStatus,
  isTaskDoneOrCompleted,
  WORKFLOW_STATUS_LIST,
  AdvancedFilterGroup
} from '../../types';
import { CapacityBar } from '../common/CapacityBar';
import { LogTimeModal } from '../modals/LogTimeModal';
import { BlockerModal } from '../modals/BlockerModal';
import { MissingTaskModal } from '../modals/MissingTaskModal';
import { RevisionModal } from '../modals/RevisionModal';
import { AdvancedSearchModal } from '../common/AdvancedSearchModal';
import { BulkEditModal } from '../common/BulkEditModal';
import { UniversalTaskTable } from '../common/UniversalTaskTable';
import { applyAdvancedFilters } from '../../utils/advancedFilterEngine';
import { getArtistEffectiveWeeklyCapacity, getArtistCommittedHours } from '../../utils/forecastEngine';
import { formatDate, getTodayDateString } from '../../utils/dateUtils';
import { formatDuration } from '../../utils/timeUtils';

interface MyTasksViewProps {
  onSelectTask: (taskId: string, activeFilteredList?: string[]) => void;
  initialFilters?: {
    statusFilter?: string;
    workspaceId?: string;
    projectId?: string;
    sprintId?: string;
  } | null;
}

export const MyTasksView: React.FC<MyTasksViewProps> = ({ onSelectTask, initialFilters }) => {
  const {
    currentUser,
    tasks,
    projects,
    artists,
    sprints,
    logTaskTime,
    updateTaskStatus,
    applyBulkEditTasks,
    syncTaskToJira
  } = useArtOps();

  // Selected workspace selector: 'ME' (default: current logged-in user), 'ALL' (all tasks across studio), 'UNASSIGNED', or a specific artist ID
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(() => initialFilters?.workspaceId || 'ME');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(() => initialFilters?.statusFilter || 'ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>(() => initialFilters?.projectId || 'ALL');
  const [sprintFilter, setSprintFilter] = useState<string>(() => initialFilters?.sprintId || 'ALL');

  // Sync when initialFilters prop changes
  useEffect(() => {
    if (initialFilters) {
      if (initialFilters.workspaceId !== undefined) {
        setSelectedWorkspaceId(initialFilters.workspaceId);
      }
      if (initialFilters.statusFilter !== undefined) {
        setStatusFilter(initialFilters.statusFilter);
      }
      if (initialFilters.projectId !== undefined) {
        setProjectFilter(initialFilters.projectId);
      }
      if (initialFilters.sprintId !== undefined) {
        setSprintFilter(initialFilters.sprintId);
      }
    }
  }, [initialFilters]);

  // Reset all filters function
  const handleClearAllFilters = () => {
    setSelectedWorkspaceId('ME');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
    setProjectFilter('ALL');
    setSprintFilter('ALL');
    setSearchQuery('');
    setAdvancedFilterGroup(null);
  };

  // Advanced Search & Bulk Edit State
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [isMissingTaskOpen, setIsMissingTaskOpen] = useState(false);
  const [advancedFilterGroup, setAdvancedFilterGroup] = useState<AdvancedFilterGroup | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Accurately match logged-in user's artist profile
  const loggedInArtist = useMemo<Artist | null>(() => {
    if (!currentUser) return null;
    if (currentUser.artistId) {
      const match = artists.find(a => a.id === currentUser.artistId);
      if (match) return match;
    }
    const byUserId = artists.find(a => currentUser.id && a.userId === currentUser.id);
    if (byUserId) return byUserId;

    if (currentUser.email) {
      const byEmail = artists.find(a => a.email && a.email.toLowerCase() === currentUser.email.toLowerCase());
      if (byEmail) return byEmail;
    }

    if (currentUser.name) {
      const byName = artists.find(a => a.name && a.name.toLowerCase() === currentUser.name.toLowerCase());
      if (byName) return byName;
    }

    return null;
  }, [currentUser, artists]);

  // Determine active profile for capacity bar
  const activeProfile = useMemo(() => {
    if (selectedWorkspaceId !== 'ME') {
      const targetArtist = artists.find(a => a.id === selectedWorkspaceId);
      if (targetArtist) return targetArtist;
    }
    if (loggedInArtist) return loggedInArtist;

    return {
      id: currentUser?.id || 'current-user',
      name: currentUser?.name || 'Studio Member',
      role: currentUser?.title || currentUser?.role || 'Team Member',
      specialization: currentUser?.department || 'Production Art & Operations',
      dailyCapacity: 8,
      weeklyCapacity: 40,
      productionAllocationPercent: 100
    } as Partial<Artist> & { name: string; role: string; specialization: string; dailyCapacity: number; weeklyCapacity: number; productionAllocationPercent: number };
  }, [selectedWorkspaceId, artists, loggedInArtist, currentUser]);

  // Scoped tasks for the selected workspace
  const myTasks = useMemo(() => {
    if (selectedWorkspaceId === 'ALL') {
      return tasks;
    }
    if (selectedWorkspaceId === 'UNASSIGNED') {
      return tasks.filter(t => !t.artistId);
    }
    if (selectedWorkspaceId !== 'ME') {
      return tasks.filter(t => t.artistId === selectedWorkspaceId);
    }

    // When viewing 'ME'
    const targetArtistId = loggedInArtist?.id || currentUser?.artistId;
    const targetUserId = currentUser?.id;

    return tasks.filter(t => {
      if (targetArtistId && t.artistId === targetArtistId) return true;
      if (targetUserId && (t.artistId === targetUserId || t.requesterId === targetUserId)) return true;
      return false;
    });
  }, [tasks, selectedWorkspaceId, loggedInArtist, currentUser]);

  // Apply basic and advanced search filters
  const filteredMyTasks = useMemo(() => {
    let result = myTasks.filter(t => {
      if (statusFilter !== 'ALL') {
        const normFilter = statusFilter.toUpperCase().replace(/\s+/g, '_');
        const normTaskStatus = (t.status || '').toUpperCase().replace(/\s+/g, '_');
        if (normFilter === 'DONE' || normFilter === 'COMPLETED') {
          if (!isTaskDoneOrCompleted(t.status)) return false;
        } else if (normFilter === 'BLOCKED' || normFilter === 'ON_HOLD' || normFilter === 'HOLD') {
          if (normTaskStatus !== 'BLOCKED' && normTaskStatus !== 'ON_HOLD' && normTaskStatus !== 'HOLD') return false;
        } else if (normFilter === 'INTERNAL_REVIEW' || normFilter === 'REVIEW' || normFilter === 'SUBMIT_FOR_REVIEW') {
          if (normTaskStatus !== 'INTERNAL_REVIEW' && normTaskStatus !== 'REQUESTER_REVIEW' && normTaskStatus !== 'SUBMIT_FOR_REVIEW' && normTaskStatus !== 'IN_REVIEW') return false;
        } else if (normFilter === 'REVISION' || normFilter === 'IN_ITERATION' || normFilter === 'ITERATION') {
          if (normTaskStatus !== 'REVISION' && normTaskStatus !== 'IN_ITERATION' && normTaskStatus !== 'ITERATION') return false;
        } else if (normFilter === 'BACKLOG' || normFilter === 'TODO' || normFilter === 'TO_DO') {
          if (normTaskStatus !== 'BACKLOG' && normTaskStatus !== 'TODO' && normTaskStatus !== 'TO_DO') return false;
        } else if (t.status !== statusFilter && normTaskStatus !== normFilter) {
          return false;
        }
      }
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
      if (projectFilter !== 'ALL' && t.projectId !== projectFilter) return false;
      if (sprintFilter !== 'ALL') {
        if (sprintFilter === 'NONE' || sprintFilter === 'BACKLOG') {
          if (t.sprintId) return false;
        } else if (t.sprintId !== sprintFilter) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchId = t.id.toLowerCase().includes(q);
        const matchJira = Boolean(t.jiraIssueKey && t.jiraIssueKey.toLowerCase().includes(q));
        const matchType = t.taskType.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchId && !matchJira && !matchType && !matchDesc) return false;
      }
      return true;
    });

    if (advancedFilterGroup && advancedFilterGroup.rules.length > 0) {
      result = applyAdvancedFilters(result, advancedFilterGroup);
    }

    return result;
  }, [myTasks, statusFilter, priorityFilter, projectFilter, sprintFilter, searchQuery, advancedFilterGroup]);

  // Weekly capacity calculations
  const weeklyEffectiveCapacity = useMemo(() => {
    if (!activeProfile) return 40;
    return getArtistEffectiveWeeklyCapacity(activeProfile as Artist);
  }, [activeProfile]);

  const committedHours = useMemo(() => {
    if (!activeProfile?.id) return 0;
    return getArtistCommittedHours(activeProfile.id, tasks);
  }, [activeProfile, tasks]);

  const isFilterActive = statusFilter !== 'ALL' || priorityFilter !== 'ALL' || projectFilter !== 'ALL' || sprintFilter !== 'ALL' || searchQuery.trim().length > 0 || (advancedFilterGroup && advancedFilterGroup.rules.length > 0);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Workspace Scope Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">My Work & Studio Tasks</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
              {filteredMyTasks.length} {filteredMyTasks.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete production task view with full Jira metadata, sorting, column customization, and real-time studio workflow tracking.
          </p>
        </div>

        {/* Workspace Selector Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setSelectedWorkspaceId('ME')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedWorkspaceId === 'ME' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              My Tasks
            </button>
            <button
              type="button"
              onClick={() => setSelectedWorkspaceId('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedWorkspaceId === 'ALL' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              All Studio Tasks
            </button>
            <button
              type="button"
              onClick={() => setSelectedWorkspaceId('UNASSIGNED')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                selectedWorkspaceId === 'UNASSIGNED' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              Unassigned
            </button>
          </div>

          {/* Artist Workspace Dropdown */}
          <select
            value={selectedWorkspaceId.startsWith('art-') ? selectedWorkspaceId : ''}
            onChange={(e) => {
              if (e.target.value) setSelectedWorkspaceId(e.target.value);
            }}
            className="text-xs font-semibold bg-white border border-slate-200 text-slate-700 rounded-xl px-3 py-2 outline-hidden shadow-2xs cursor-pointer hover:border-slate-300"
          >
            <option value="">By Artist...</option>
            {artists.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.role})
              </option>
            ))}
          </select>

          {/* Missing Task Submission */}
          <button
            type="button"
            onClick={() => setIsMissingTaskOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Log Missing Task / Scope"
          >
            <Plus size={14} />
            <span>Missing Task</span>
          </button>
        </div>
      </div>

      {/* Artist Workload & Capacity Banner (when scoped to an artist or ME) */}
      {selectedWorkspaceId !== 'ALL' && selectedWorkspaceId !== 'UNASSIGNED' && activeProfile && (
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
              {activeProfile.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">{activeProfile.name}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">{activeProfile.role}</span>
              </div>
              <p className="text-xs text-slate-500">{activeProfile.specialization || 'Production Art'}</p>
            </div>
          </div>

          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-400">Committed Hours</span>
              <span className="text-sm font-bold text-slate-900 font-mono">{formatDuration(committedHours)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-slate-400">Weekly Capacity</span>
              <span className="text-sm font-bold text-slate-900 font-mono">{weeklyEffectiveCapacity}h</span>
            </div>
            <div className="w-48">
              <CapacityBar committedHours={committedHours} capacityHours={weeklyEffectiveCapacity} />
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Text Search Input */}
          <div className="relative w-full lg:w-80">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by title, key, type, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden transition-all text-slate-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap">
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
              <span>Advanced Search</span>
              {advancedFilterGroup && advancedFilterGroup.rules.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">
                  {advancedFilterGroup.rules.length}
                </span>
              )}
            </button>

            {/* Sprint Filter */}
            <select
              value={sprintFilter}
              onChange={(e) => setSprintFilter(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2.5 py-2 outline-hidden cursor-pointer"
            >
              <option value="ALL">All Sprints</option>
              <option value="BACKLOG">Backlog / No Sprint</option>
              {sprints.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
              ))}
            </select>

            {/* Project Filter */}
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2.5 py-2 outline-hidden cursor-pointer"
            >
              <option value="ALL">All Projects ({projects.length})</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2.5 py-2 outline-hidden cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              {WORKFLOW_STATUS_LIST.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2.5 py-2 outline-hidden cursor-pointer"
            >
              <option value="ALL">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            {/* Clear Filters Button */}
            {isFilterActive && (
              <button
                type="button"
                onClick={handleClearAllFilters}
                className="px-2.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer flex items-center gap-1"
                title="Reset All Filters"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Advanced Filter Chips */}
        {advancedFilterGroup && advancedFilterGroup.rules.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold text-blue-800 mr-1">Active Filter Logic ({advancedFilterGroup.matchMode}):</span>
            {advancedFilterGroup.rules.map((rule, idx) => (
              <span
                key={rule.id || idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-[11px] font-medium text-blue-900"
              >
                <span className="font-bold">{rule.field}</span>
                <span className="text-blue-600 text-[10px]">{rule.operator}</span>
                <span className="font-mono bg-white px-1 py-0.5 rounded border border-blue-100 text-slate-800">
                  {String(rule.value)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const nextRules = advancedFilterGroup.rules.filter((_, i) => i !== idx);
                    if (nextRules.length === 0) setAdvancedFilterGroup(null);
                    else setAdvancedFilterGroup({ ...advancedFilterGroup, rules: nextRules });
                  }}
                  className="text-blue-400 hover:text-blue-700 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Universal Multi-Column Task Table */}
      <UniversalTaskTable
        tableKey="my-tasks"
        tasks={filteredMyTasks}
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
        emptyMessage="No tasks found for the current filters"
        emptySubMessage="Try clearing your filters or changing the workspace scope"
        onEmptyAction={isFilterActive ? handleClearAllFilters : undefined}
        emptyActionLabel={isFilterActive ? 'Clear All Filters' : undefined}
      />

      {/* Advanced Search Filter Modal */}
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

      {/* Missing Task Creation Modal */}
      {isMissingTaskOpen && loggedInArtist && (
        <MissingTaskModal
          isOpen={isMissingTaskOpen}
          onClose={() => setIsMissingTaskOpen(false)}
          artistId={loggedInArtist.id}
        />
      )}
    </div>
  );
};
