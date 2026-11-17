import React, { useState, useMemo } from 'react';
import {
  Kanban as KanbanIcon,
  Plus,
  Filter,
  Search,
  AlertTriangle,
  RotateCcw,
  Clock,
  Sparkles,
  Users,
  ChevronRight,
  CheckSquare,
  Square,
  Trash2,
  X,
  CheckCircle2,
  Layers,
  Edit3,
  Share2,
  Check,
  ArrowRightLeft
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { Task, TaskStatus, Priority, normalizeTaskStatus, BulkEditTaskPayload } from '../../types';
import { TaskStatusBadge, PriorityBadge } from '../common/Badge';
import { Avatar } from '../common/Avatar';
import { ContextualBulkActionBar } from '../common/ContextualBulkActionBar';
import { BulkEditModal } from '../common/BulkEditModal';
import { Modal } from '../common/Modal';
import { copyTaskShareUrl } from '../../utils/shareUtils';

interface KanbanViewProps {
  onSelectTask: (taskId: string) => void;
  onOpenCreateTask: () => void;
}

interface ColumnDef {
  id: TaskStatus;
  title: string;
  colorClass: string;
  badgeBg: string;
}

const COLUMNS: ColumnDef[] = [
  { id: 'To Do', title: 'To Do', colorClass: 'border-slate-300', badgeBg: 'bg-slate-100 text-slate-700' },
  { id: 'In Progress', title: 'In Progress', colorClass: 'border-blue-400', badgeBg: 'bg-blue-100 text-blue-800' },
  { id: 'On Hold', title: 'On Hold', colorClass: 'border-amber-400', badgeBg: 'bg-amber-100 text-amber-800' },
  { id: 'Re-opened', title: 'Re-opened', colorClass: 'border-purple-400', badgeBg: 'bg-purple-100 text-purple-800' },
  { id: 'Submit for Review', title: 'Submit for Review', colorClass: 'border-sky-300', badgeBg: 'bg-sky-100 text-sky-800' },
  { id: 'In Iteration', title: 'In Iteration', colorClass: 'border-orange-400', badgeBg: 'bg-orange-100 text-orange-800' },
  { id: 'Completed', title: 'Completed', colorClass: 'border-emerald-400', badgeBg: 'bg-emerald-100 text-emerald-800' },
  { id: 'Cancelled', title: 'Cancelled', colorClass: 'border-rose-400', badgeBg: 'bg-rose-100 text-rose-800' }
];

export const KanbanView: React.FC<KanbanViewProps> = ({ onSelectTask, onOpenCreateTask }) => {
  const {
    tasks,
    projects,
    artists,
    sprints,
    updateTaskStatus,
    updateTask,
    moveTaskToSprint,
    moveTaskToBacklog,
    bulkUpdateTasks,
    deleteTask,
    applyBulkEditTasks,
    syncTaskToJira
  } = useArtOps();

  const [selectedMobileColumn, setSelectedMobileColumn] = useState<string>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [sprintFilter, setSprintFilter] = useState<string>('ALL');
  const [artistFilter, setArtistFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Multi-selection state
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [kanbanAlert, setKanbanAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (projectFilter !== 'ALL' && t.projectId !== projectFilter) return false;
      if (sprintFilter !== 'ALL' && t.sprintId !== sprintFilter) return false;
      if (artistFilter !== 'ALL' && t.artistId !== artistFilter) return false;
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
      return true;
    });
  }, [tasks, projectFilter, sprintFilter, artistFilter, priorityFilter]);

  // Multi-selection toggles
  const handleToggleSelectTask = (taskId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    const allIds = filteredTasks.map(t => t.id);
    setSelectedTaskIds(new Set(allIds));
  };

  const handleClearSelection = () => {
    setSelectedTaskIds(new Set());
  };

  const handleToggleColumnSelection = (columnTasks: Task[]) => {
    const colTaskIds = columnTasks.map(t => t.id);
    if (colTaskIds.length === 0) return;
    const allSelected = colTaskIds.every(id => selectedTaskIds.has(id));
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        colTaskIds.forEach(id => next.delete(id));
      } else {
        colTaskIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Batch actions
  const handleQuickStatusChange = async (status: TaskStatus) => {
    const ids = Array.from(selectedTaskIds);
    if (ids.length === 0) return;
    bulkUpdateTasks(ids, { status });
    setKanbanAlert({
      type: 'success',
      message: `Updated status to "${status}" for ${ids.length} ${ids.length === 1 ? 'task' : 'tasks'}.`
    });
    handleClearSelection();
    setTimeout(() => setKanbanAlert(null), 4000);
  };

  const handleQuickAssignSprint = async (sprintId: string) => {
    const ids = Array.from(selectedTaskIds);
    if (ids.length === 0) return;
    ids.forEach(id => {
      if (!sprintId) {
        moveTaskToBacklog(id);
      } else {
        moveTaskToSprint(id, sprintId);
      }
    });
    const spName = sprintId ? sprints.find(s => s.id === sprintId)?.name || 'Sprint' : 'Backlog';
    setKanbanAlert({
      type: 'success',
      message: `Moved ${ids.length} ${ids.length === 1 ? 'task' : 'tasks'} to ${spName}.`
    });
    handleClearSelection();
    setTimeout(() => setKanbanAlert(null), 4000);
  };

  const handleQuickAssignArtist = async (artistId: string) => {
    const ids = Array.from(selectedTaskIds);
    if (ids.length === 0) return;
    bulkUpdateTasks(ids, { artistId: artistId || undefined });
    const artName = artistId ? artists.find(a => a.id === artistId)?.name || 'Artist' : 'Unassigned';
    setKanbanAlert({
      type: 'success',
      message: `Assigned ${ids.length} ${ids.length === 1 ? 'task' : 'tasks'} to ${artName}.`
    });
    handleClearSelection();
    setTimeout(() => setKanbanAlert(null), 4000);
  };

  const handleConfirmBulkDelete = () => {
    const ids = Array.from(selectedTaskIds);
    if (ids.length === 0) return;
    ids.forEach(id => {
      deleteTask(id);
    });
    setKanbanAlert({
      type: 'success',
      message: `Permanently deleted ${ids.length} ${ids.length === 1 ? 'task' : 'tasks'}.`
    });
    setIsBulkDeleteModalOpen(false);
    handleClearSelection();
    setTimeout(() => setKanbanAlert(null), 4000);
  };

  const handleApplyBulkEdit = async (payload: BulkEditTaskPayload, taskIds: string[]) => {
    await applyBulkEditTasks(payload, taskIds);
    setKanbanAlert({
      type: 'success',
      message: `Successfully bulk updated ${taskIds.length} tasks.`
    });
    setIsBulkEditModalOpen(false);
    handleClearSelection();
    setTimeout(() => setKanbanAlert(null), 4000);
  };

  const handleQuickSyncJira = async () => {
    const ids = Array.from(selectedTaskIds);
    for (const id of ids) {
      await syncTaskToJira(id, 'Bulk Sync');
    }
    setKanbanAlert({
      type: 'success',
      message: `Synced ${ids.length} Jira tasks.`
    });
    handleClearSelection();
    setTimeout(() => setKanbanAlert(null), 4000);
  };

  // Quick move to next status on mobile
  const handleQuickAdvanceStatus = (e: React.MouseEvent, taskId: string, currentStatus: TaskStatus) => {
    e.stopPropagation();
    const statusOrder: TaskStatus[] = [
      'To Do',
      'In Progress',
      'Submit for Review',
      'In Iteration',
      'Completed'
    ];
    const normalized = normalizeTaskStatus(currentStatus);
    const currentIndex = statusOrder.indexOf(normalized);
    if (currentIndex >= 0 && currentIndex < statusOrder.length - 1) {
      const nextStatus = statusOrder[currentIndex + 1];
      updateTaskStatus(taskId, nextStatus);
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId) {
      updateTaskStatus(taskId, targetStatus);
    }
    setDraggedTaskId(null);
  };

  return (
    <div id="kanban-view" className="p-3.5 sm:p-6 md:p-8 space-y-4 sm:space-y-6 select-none h-full flex flex-col max-w-[1600px] mx-auto">
      {/* Alert Notification Toast */}
      {kanbanAlert && (
        <div
          className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs font-semibold animate-in fade-in duration-150 ${
            kanbanAlert.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 shadow-xs'
              : 'bg-rose-50 text-rose-800 border-rose-200 shadow-xs'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span>{kanbanAlert.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setKanbanAlert(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5 rounded"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4 sm:pb-6 shrink-0">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">Studio Kanban Board</h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 font-bold text-slate-700 border border-slate-200">
              {filteredTasks.length}
            </span>
            {selectedTaskIds.size > 0 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold border border-blue-200 animate-in fade-in">
                {selectedTaskIds.size} selected
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            Track and advance visual tasks across studio production pipelines. Multi-select cards to batch update, assign, or delete.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedTaskIds.size > 0 && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Clear selection"
            >
              <X size={14} />
              <span>Clear ({selectedTaskIds.size})</span>
            </button>
          )}

          <button
            id="btn-create-task-kanban"
            type="button"
            onClick={onOpenCreateTask}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus size={15} />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 sm:p-3 bg-white border border-slate-200 rounded-xl shadow-xs shrink-0">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold w-full sm:w-auto">
          {/* Project Filter */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 outline-hidden cursor-pointer text-xs flex-1 sm:flex-none"
          >
            <option value="ALL">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
            ))}
          </select>

          {/* Sprint Filter */}
          <select
            value={sprintFilter}
            onChange={(e) => setSprintFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 outline-hidden cursor-pointer text-xs flex-1 sm:flex-none"
          >
            <option value="ALL">All Sprints</option>
            {sprints.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Artist Filter */}
          <select
            value={artistFilter}
            onChange={(e) => setArtistFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 outline-hidden cursor-pointer text-xs flex-1 sm:flex-none"
          >
            <option value="ALL">All Artists</option>
            {artists.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 outline-hidden cursor-pointer text-xs flex-1 sm:flex-none"
          >
            <option value="ALL">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        {/* Selection Status & Select All Button */}
        <div className="flex items-center gap-2">
          {selectedTaskIds.size > 0 ? (
            <div className="flex items-center gap-2 bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-1 rounded-lg text-xs font-bold animate-in fade-in">
              <CheckSquare size={13} className="text-blue-600" />
              <span>{selectedTaskIds.size} of {filteredTasks.length} selected</span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-blue-600 hover:text-blue-900 text-[11px] underline cursor-pointer ml-1"
              >
                Deselect all
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              disabled={filteredTasks.length === 0}
              className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
              title={`Select all ${filteredTasks.length} visible tasks`}
            >
              <CheckSquare size={13} className="text-slate-400" />
              <span>Select All ({filteredTasks.length})</span>
            </button>
          )}

          <span className="text-[11px] text-slate-400 hidden xl:inline">
            Tip: Click checkbox or Shift+Click cards to select
          </span>
        </div>
      </div>

      {/* Mobile Column Quick Pill Selector */}
      <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none shrink-0">
        <button
          type="button"
          onClick={() => setSelectedMobileColumn('ALL')}
          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
            selectedMobileColumn === 'ALL'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          All Stages ({filteredTasks.length})
        </button>
        {COLUMNS.map(col => {
          const count = filteredTasks.filter(t => normalizeTaskStatus(t.status) === col.id).length;

          return (
            <button
              key={col.id}
              type="button"
              onClick={() => setSelectedMobileColumn(col.id)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 cursor-pointer transition-colors ${
                selectedMobileColumn === col.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{col.title}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                selectedMobileColumn === col.id ? 'bg-slate-700 text-white' : col.badgeBg
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kanban Columns Strip */}
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 flex-1 items-start min-h-[500px] scrollbar-thin">
        {COLUMNS.filter(col => selectedMobileColumn === 'ALL' || col.id === selectedMobileColumn).map(col => {
          const colTasks = filteredTasks.filter(t => normalizeTaskStatus(t.status) === col.id);
          const colHours = colTasks.reduce((acc, t) => acc + (t.remainingEstimate ?? t.originalEstimate), 0);
          const allColSelected = colTasks.length > 0 && colTasks.every(t => selectedTaskIds.has(t.id));
          const someColSelected = colTasks.some(t => selectedTaskIds.has(t.id)) && !allColSelected;

          return (
            <div
              key={col.id}
              id={`kanban-column-${col.id}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
              className="w-[85vw] sm:w-72 shrink-0 bg-slate-100/70 rounded-xl border border-slate-200/80 flex flex-col max-h-full overflow-hidden shadow-2xs"
            >
              {/* Column Header with Column Select Button */}
              <div className="p-2.5 sm:p-3 border-b border-slate-200 flex items-center justify-between bg-white/80">
                <div className="flex items-center gap-2">
                  {colTasks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleToggleColumnSelection(colTasks)}
                      className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer transition-colors"
                      title={allColSelected ? `Deselect all in ${col.title}` : `Select all in ${col.title}`}
                    >
                      {allColSelected ? (
                        <CheckSquare size={14} className="text-blue-600" />
                      ) : someColSelected ? (
                        <div className="w-3.5 h-3.5 rounded bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold leading-none">
                          -
                        </div>
                      ) : (
                        <Square size={14} className="text-slate-300 hover:text-slate-500" />
                      )}
                    </button>
                  )}
                  <span className="font-bold text-xs text-slate-900">{col.title}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${col.badgeBg}`}>
                    {colTasks.length}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">{colHours}h</span>
              </div>

              {/* Column Cards Stream */}
              <div className="p-2 space-y-2.5 overflow-y-auto flex-1 min-h-[200px] scrollbar-thin">
                {colTasks.length === 0 ? (
                  <div className="py-8 text-center text-[11px] text-slate-400 border border-dashed border-slate-300 rounded-lg">
                    No tasks in {col.title}
                  </div>
                ) : (
                  colTasks.map(task => {
                    const proj = projects.find(p => p.id === task.projectId);
                    const artist = artists.find(a => a.id === task.artistId);
                    const isBlocked = task.status === 'BLOCKED';
                    const isRevision = task.status === 'REVISION';
                    const canAdvance = task.status !== 'DONE';
                    const isSelected = selectedTaskIds.has(task.id);

                    return (
                      <div
                        key={task.id}
                        id={`kanban-card-${task.id}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onClick={(e) => {
                          if (e.shiftKey || e.ctrlKey || e.metaKey) {
                            handleToggleSelectTask(task.id, e);
                          } else {
                            onSelectTask(task.id);
                          }
                        }}
                        className={`p-3 sm:p-3.5 bg-white rounded-xl border shadow-2xs hover:shadow-md transition-all cursor-pointer space-y-2.5 group relative ${
                          isSelected
                            ? 'ring-2 ring-blue-500 border-blue-400 bg-blue-50/40 shadow-sm'
                            : isBlocked
                            ? 'border-rose-300 bg-rose-50/40'
                            : isRevision
                            ? 'border-amber-300 bg-amber-50/40'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {/* Checkbox for selection */}
                            <button
                              type="button"
                              onClick={(e) => handleToggleSelectTask(task.id, e)}
                              className={`p-0.5 rounded transition-all cursor-pointer shrink-0 ${
                                isSelected
                                  ? 'text-blue-600'
                                  : 'text-slate-300 hover:text-slate-600 opacity-60 group-hover:opacity-100'
                              }`}
                              title={isSelected ? 'Deselect task' : 'Select task'}
                            >
                              {isSelected ? (
                                <CheckSquare size={15} className="text-blue-600" />
                              ) : (
                                <Square size={15} />
                              )}
                            </button>

                            <span className="font-mono text-[11px] font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 truncate">
                              {task.id}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Copy Fullscreen Task Share Link */}
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                const success = await copyTaskShareUrl(task.id, true);
                                if (success) {
                                  setCopiedTaskId(task.id);
                                  setTimeout(() => setCopiedTaskId(null), 2000);
                                }
                              }}
                              className={`p-1 rounded transition-all cursor-pointer ${
                                copiedTaskId === task.id
                                  ? 'text-emerald-600 bg-emerald-50 opacity-100'
                                  : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100'
                              }`}
                              title={copiedTaskId === task.id ? 'Task share link copied!' : 'Copy full-screen share link'}
                            >
                              {copiedTaskId === task.id ? <Check size={12} className="text-emerald-600" /> : <Share2 size={12} />}
                            </button>

                            <PriorityBadge priority={task.priority} />
                            {canAdvance && (
                              <button
                                type="button"
                                onClick={(e) => handleQuickAdvanceStatus(e, task.id, task.status)}
                                title="Advance to next stage"
                                className="p-1 rounded bg-slate-100 hover:bg-blue-100 hover:text-blue-700 text-slate-500 transition-colors cursor-pointer"
                              >
                                <ChevronRight size={12} />
                              </button>
                            )}
                          </div>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 leading-snug line-clamp-2">
                          {task.title}
                        </h4>

                        {isBlocked && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-700 bg-rose-100/80 p-1.5 rounded-lg border border-rose-200">
                            <AlertTriangle size={12} className="shrink-0" />
                            <span className="truncate">{task.blockerReason}</span>
                          </div>
                        )}

                        {isRevision && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-800 bg-amber-100/80 p-1.5 rounded-lg border border-amber-200">
                            <RotateCcw size={12} className="shrink-0" />
                            <span>Round {task.revisionCount || 1} Revision</span>
                          </div>
                        )}

                        {(task.isMoved || task.tags?.includes('Moved') || task.tags?.includes('Carried Forward')) && (
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-800 bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                            <ArrowRightLeft size={12} className="shrink-0" />
                            <span className="truncate">
                              {task.movedFromSprintName ? `Moved from ${task.movedFromSprintName}` : 'Moved to Active Sprint'}
                            </span>
                          </div>
                        )}

                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded text-[10px]">
                              {task.storyPoints || 1} SP
                            </span>
                            <span className="font-semibold text-slate-600 text-[10px]">
                              {task.remainingEstimate ?? task.originalEstimate}h
                            </span>
                          </div>

                          {artist ? (
                            <div className="flex items-center gap-1.5">
                              <Avatar name={artist.name} src={artist.avatar} size="xs" />
                              <span className="text-slate-700 font-medium text-[10px] truncate max-w-[70px]">
                                {artist.name.split(' ')[0]}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Unassigned</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

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
          title={`Delete ${selectedTaskIds.size} Selected Tasks`}
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
              Are you sure you want to permanently delete these <strong className="text-slate-900">{selectedTaskIds.size}</strong> selected tasks from the board?
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
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold ml-2 shrink-0">
                      {t.status}
                    </span>
                  </div>
                ))}
            </div>
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 font-semibold text-xs flex items-center gap-2">
              <AlertTriangle size={14} className="text-rose-600 shrink-0" />
              <span>This action is permanent and cannot be undone. Selected tasks will be permanently removed from Firestore.</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
