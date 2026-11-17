import React, { useState, useMemo } from 'react';
import {
  ListTodo,
  Plus,
  Layers,
  ArrowRight,
  Filter,
  Search,
  Sparkles,
  MoveRight,
  FolderKanban,
  FileText,
  UserX,
  UserCheck,
  UserPlus,
  Clock,
  CheckCircle2,
  Zap,
  Download,
  ExternalLink,
  RefreshCw,
  FileSpreadsheet,
  SlidersHorizontal,
  CheckSquare,
  Square,
  Edit3,
  Trash2,
  RotateCcw,
  X
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { Task, Priority, isTaskDoneOrCompleted, BulkEditTaskPayload, TaskStatus } from '../../types';
import { formatDuration } from '../../utils/timeUtils';
import { JiraImportModal } from '../modals/JiraImportModal';
import { BulkBacklogImportModal } from '../modals/BulkBacklogImportModal';
import { AdvancedSearchModal } from '../common/AdvancedSearchModal';
import { BulkEditModal } from '../common/BulkEditModal';
import { ContextualBulkActionBar } from '../common/ContextualBulkActionBar';
import { UniversalTaskTable } from '../common/UniversalTaskTable';
import { Modal } from '../common/Modal';
import { applyAdvancedFilters } from '../../utils/advancedFilterEngine';
import { AdvancedFilterGroup } from '../../types';

interface BacklogViewProps {
  onSelectTask: (taskId: string, activeFilteredList?: string[]) => void;
  onOpenCreateTask: () => void;
  onOpenAiPlanner: () => void;
  onNavigateToRequest?: (requestId: string) => void;
  onNavigateToSettings?: () => void;
}

export const BacklogView: React.FC<BacklogViewProps> = ({
  onSelectTask,
  onOpenCreateTask,
  onOpenAiPlanner,
  onNavigateToRequest,
  onNavigateToSettings
}) => {
  const {
    tasks,
    projects,
    sprints,
    artists,
    updateTask,
    moveTaskToSprint,
    deleteTask,
    currentUser,
    canAccessAiSprintPlanner,
    applyBulkEditTasks,
    bulkUpdateTasks,
    syncTaskToJira
  } = useArtOps();

  const [filterMode, setFilterMode] = useState<'ALL' | 'UNASSIGNED' | 'REQUESTS' | 'JIRA'>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isJiraModalOpen, setIsJiraModalOpen] = useState(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [isAdvancedSearchOpen, setIsAdvancedSearchOpen] = useState(false);
  const [advancedFilterGroup, setAdvancedFilterGroup] = useState<AdvancedFilterGroup | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [backlogAlert, setBacklogAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  const handleClearSelection = () => {
    setSelectedTaskIds(new Set());
  };

  const handleQuickStatusChange = async (status: TaskStatus) => {
    const ids = Array.from(selectedTaskIds);
    if (ids.length === 0) return;
    bulkUpdateTasks(ids, { status });
    setBacklogAlert({
      type: 'success',
      message: `Updated status to "${status}" for ${ids.length} ${ids.length === 1 ? 'task' : 'tasks'}.`
    });
    handleClearSelection();
    setTimeout(() => setBacklogAlert(null), 4000);
  };

  const handleQuickAssignSprint = async (sprintId: string) => {
    const ids = Array.from(selectedTaskIds);
    if (ids.length === 0) return;
    ids.forEach(id => {
      if (sprintId) {
        moveTaskToSprint(id, sprintId);
      }
    });
    const spName = sprintId ? sprints.find(s => s.id === sprintId)?.name || 'Sprint' : 'Backlog';
    setBacklogAlert({
      type: 'success',
      message: `Moved ${ids.length} ${ids.length === 1 ? 'task' : 'tasks'} to ${spName}.`
    });
    handleClearSelection();
    setTimeout(() => setBacklogAlert(null), 4000);
  };

  const handleQuickAssignArtist = async (artistId: string) => {
    const ids = Array.from(selectedTaskIds);
    if (ids.length === 0) return;
    bulkUpdateTasks(ids, { artistId: artistId || undefined });
    const artName = artistId ? artists.find(a => a.id === artistId)?.name || 'Artist' : 'Unassigned';
    setBacklogAlert({
      type: 'success',
      message: `Assigned ${ids.length} ${ids.length === 1 ? 'task' : 'tasks'} to ${artName}.`
    });
    handleClearSelection();
    setTimeout(() => setBacklogAlert(null), 4000);
  };

  const handleConfirmBulkDelete = () => {
    const ids = Array.from(selectedTaskIds);
    if (ids.length === 0) return;
    ids.forEach(id => {
      deleteTask(id);
    });
    setBacklogAlert({
      type: 'success',
      message: `Permanently deleted ${ids.length} ${ids.length === 1 ? 'task' : 'tasks'}.`
    });
    setIsBulkDeleteModalOpen(false);
    handleClearSelection();
    setTimeout(() => setBacklogAlert(null), 4000);
  };

  const handleApplyBulkEdit = async (payload: BulkEditTaskPayload, taskIds: string[]) => {
    await applyBulkEditTasks(payload, taskIds);
    setBacklogAlert({
      type: 'success',
      message: `Successfully bulk updated ${taskIds.length} tasks.`
    });
    setIsBulkEditModalOpen(false);
    handleClearSelection();
    setTimeout(() => setBacklogAlert(null), 4000);
  };

  const handleQuickSyncJira = async () => {
    const ids = Array.from(selectedTaskIds);
    for (const id of ids) {
      await syncTaskToJira(id, 'Bulk Sync');
    }
    setBacklogAlert({
      type: 'success',
      message: `Synchronized ${ids.length} tasks with Jira.`
    });
    setTimeout(() => setBacklogAlert(null), 4000);
  };

  // Filter backlog tasks: tasks that are NOT scheduled in any sprint and not completed
  const allBacklogTasks = useMemo(() => {
    return tasks.filter(t => {
      // 1. If task has a sprint assigned / taken in sprint, it MUST NOT show in Backlog
      const hasSprint = Boolean(
        t.sprintId &&
        t.sprintId.trim() !== '' &&
        t.sprintId !== 'none' &&
        t.sprintId !== 'null' &&
        t.sprintId !== 'undefined'
      );
      if (hasSprint) return false;

      // 2. If task is completed, it is not in Backlog
      if (isTaskDoneOrCompleted(t.status) || t.status === 'Cancelled') return false;

      return true;
    });
  }, [tasks]);

  const unassignedCount = useMemo(() => {
    return allBacklogTasks.filter(t => !t.artistId).length;
  }, [allBacklogTasks]);

  const requestTasksCount = useMemo(() => {
    return allBacklogTasks.filter(t => Boolean(t.requestId)).length;
  }, [allBacklogTasks]);

  const jiraTasksCount = useMemo(() => {
    return allBacklogTasks.filter(t => Boolean(t.isJiraImported || t.jiraIssueKey)).length;
  }, [allBacklogTasks]);

  const filteredTasks = useMemo(() => {
    let result = allBacklogTasks.filter(t => {
      if (filterMode === 'UNASSIGNED' && t.artistId) return false;
      if (filterMode === 'REQUESTS' && !t.requestId) return false;
      if (filterMode === 'JIRA' && !t.isJiraImported && !t.jiraIssueKey) return false;

      if (projectFilter !== 'ALL' && t.projectId !== projectFilter) return false;
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          t.id.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.taskType.toLowerCase().includes(q) ||
          (t.jiraIssueKey && t.jiraIssueKey.toLowerCase().includes(q)) ||
          (t.requestId && t.requestId.toLowerCase().includes(q))
        );
      }
      return true;
    });

    if (advancedFilterGroup && advancedFilterGroup.rules.length > 0) {
      result = applyAdvancedFilters(result, advancedFilterGroup);
    }

    return result;
  }, [allBacklogTasks, filterMode, projectFilter, priorityFilter, searchQuery, advancedFilterGroup]);

  const totalBacklogEstimate = filteredTasks.reduce((acc, t) => acc + (t.remainingEstimate ?? t.originalEstimate ?? 0), 0);
  const totalBacklogSP = filteredTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);

  return (
    <div id="backlog-view" className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Backlog Alert Toast/Banner */}
      {backlogAlert && (
        <div
          className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-semibold animate-in fade-in ${
            backlogAlert.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span>{backlogAlert.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setBacklogAlert(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5 rounded"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Art Backlog & Planning</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 font-bold text-slate-700 border border-slate-200">
              {allBacklogTasks.length} Unscheduled
            </span>
            {unassignedCount > 0 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 font-bold text-amber-700 border border-amber-200 flex items-center gap-1">
                <UserX size={12} />
                {unassignedCount} Unassigned
              </span>
            )}
            {jiraTasksCount > 0 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 font-bold text-blue-700 border border-blue-200 flex items-center gap-1">
                <FolderKanban size={12} />
                {jiraTasksCount} Jira Synced
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Studio requests, Jira tickets, and backlog tasks awaiting sprint scheduling and artist allocation.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Bulk CSV/XLSX Import */}
          <button
            id="btn-bulk-import-backlog"
            type="button"
            onClick={() => setIsBulkImportModalOpen(true)}
            className="px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Upload CSV or Excel spreadsheets"
          >
            <FileSpreadsheet size={14} className="text-emerald-600" />
            <span>CSV/Excel Import</span>
          </button>

          {/* Sync / Import from Jira */}
          <button
            id="btn-sync-jira-backlog"
            type="button"
            onClick={() => setIsJiraModalOpen(true)}
            className="px-3 py-2 text-xs font-bold text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Import or Sync Jira Tickets"
          >
            <RefreshCw size={14} className="text-blue-600" />
            <span>Import Jira</span>
          </button>

          {/* AI Sprint Planner button if authorized */}
          {canAccessAiSprintPlanner() && (
            <button
              id="btn-ai-planner-backlog"
              type="button"
              onClick={onOpenAiPlanner}
              className="px-3.5 py-2 text-xs font-bold text-white bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles size={14} />
              <span>AI Sprint Planner</span>
            </button>
          )}

          {/* Create Task Button */}
          <button
            id="btn-create-task-backlog"
            type="button"
            onClick={onOpenCreateTask}
            className="px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Filtered Backlog</div>
          <div className="text-xl font-black text-slate-900 mt-0.5">{filteredTasks.length}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Story Points</div>
          <div className="text-xl font-black text-purple-700 mt-0.5">{totalBacklogSP} SP</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Remaining Est.</div>
          <div className="text-xl font-black text-slate-900 font-mono mt-0.5">{formatDuration(totalBacklogEstimate)}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Unassigned Tasks</div>
          <div className="text-xl font-black text-amber-600 mt-0.5">{unassignedCount}</div>
        </div>
      </div>

      {/* Filter and Move Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Segment Filter Mode */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 flex-wrap">
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterMode === 'ALL' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              All Backlog ({allBacklogTasks.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('UNASSIGNED')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterMode === 'UNASSIGNED' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              Unassigned ({unassignedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('REQUESTS')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterMode === 'REQUESTS' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              From Requests ({requestTasksCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('JIRA')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterMode === 'JIRA' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
              }`}
            >
              Jira Linked ({jiraTasksCount})
            </button>
          </div>

          {/* Search and Secondary Dropdowns */}
          <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap">
            <div className="relative w-full sm:w-60">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search backlog..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-hidden transition-all text-slate-800"
              />
            </div>

            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2.5 py-1.5 outline-hidden cursor-pointer"
            >
              <option value="ALL">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-2.5 py-1.5 outline-hidden cursor-pointer"
            >
              <option value="ALL">All Priorities</option>
              <option value="Urgent">Urgent</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <button
              type="button"
              onClick={() => setIsAdvancedSearchOpen(true)}
              className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
            >
              <SlidersHorizontal size={13} className="text-slate-500" />
              <span>Advanced</span>
            </button>
          </div>
        </div>

        {/* Selection summary pill & Floating bar reminder */}
        {selectedTaskIds.size > 0 && (
          <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-blue-900 animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0" />
              <span>
                <strong>{selectedTaskIds.size}</strong> {selectedTaskIds.size === 1 ? 'task' : 'tasks'} selected across backlog
              </span>
              <span className="text-slate-400 hidden sm:inline">•</span>
              <span className="text-blue-700 text-[11px] hidden sm:inline">
                Use the floating action bar below to batch-update status, assign to sprint, or delete
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedTaskIds(new Set())}
              className="text-blue-700 hover:text-blue-950 font-bold underline cursor-pointer text-xs shrink-0"
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>

      {/* Universal Task Table */}
      <UniversalTaskTable
        tableKey="backlog-tasks"
        tasks={filteredTasks}
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
        emptyMessage="Backlog is empty"
        emptySubMessage="No unscheduled tasks matching the current filter. Create or import tasks to plan them into upcoming sprints."
        onEmptyAction={onOpenCreateTask}
        emptyActionLabel="Create Backlog Task"
      />

      {/* Modals */}
      {isJiraModalOpen && (
        <JiraImportModal
          isOpen={isJiraModalOpen}
          onClose={() => setIsJiraModalOpen(false)}
        />
      )}

      {isBulkImportModalOpen && (
        <BulkBacklogImportModal
          isOpen={isBulkImportModalOpen}
          onClose={() => setIsBulkImportModalOpen(false)}
        />
      )}

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

      {/* Floating Contextual Bulk Action Bar */}
      {selectedTaskIds.size > 0 && (
        <ContextualBulkActionBar
          selectedCount={selectedTaskIds.size}
          selectedTaskIds={Array.from(selectedTaskIds)}
          tasks={tasks}
          artists={artists}
          projects={projects}
          sprints={sprints}
          onOpenBulkModal={() => setIsBulkEditModalOpen(true)}
          onQuickStatusChange={handleQuickStatusChange}
          onQuickAssignArtist={handleQuickAssignArtist}
          onQuickAssignSprint={handleQuickAssignSprint}
          onQuickSyncJira={handleQuickSyncJira}
          onQuickDelete={() => setIsBulkDeleteModalOpen(true)}
          onClearSelection={handleClearSelection}
        />
      )}

      {/* Bulk Edit Modal */}
      {isBulkEditModalOpen && (
        <BulkEditModal
          isOpen={isBulkEditModalOpen}
          onClose={() => setIsBulkEditModalOpen(false)}
          selectedTasks={tasks.filter(t => selectedTaskIds.has(t.id))}
          projects={projects}
          sprints={sprints}
          artists={artists}
          onApplyBulkEdit={handleApplyBulkEdit}
        />
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <Modal
          isOpen={isBulkDeleteModalOpen}
          onClose={() => setIsBulkDeleteModalOpen(false)}
          title={`Delete ${selectedTaskIds.size} Selected Backlog Tasks`}
          maxWidth="md"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Trash2 size={13} />
                <span>Delete {selectedTaskIds.size} Tasks</span>
              </button>
            </div>
          }
        >
          <div className="space-y-3 text-xs text-slate-600">
            <p>
              Are you sure you want to permanently delete these <strong className="text-slate-900">{selectedTaskIds.size}</strong> selected backlog tasks? This action cannot be undone.
            </p>
            <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50 p-1">
              {tasks
                .filter(t => selectedTaskIds.has(t.id))
                .map(t => (
                  <div key={t.id} className="p-2 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                      <span className="font-mono font-bold text-slate-700 shrink-0">{t.id}</span>
                      <span className="truncate text-slate-800 font-medium">{t.title}</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold uppercase shrink-0 ml-2">
                      {t.status}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
