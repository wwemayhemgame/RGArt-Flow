import React, { useState } from 'react';
import {
  Edit3,
  X,
  Check,
  Clock,
  Layers,
  User,
  AlertCircle,
  Sparkles,
  Zap,
  FolderKanban,
  Calendar,
  Tag,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import type {
  Task,
  TaskStatus,
  Priority,
  Project,
  Sprint,
  Artist,
  BulkEditTaskPayload
} from '../../types';
import { TaskStatusBadge, PriorityBadge } from './Badge';

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTasks: Task[];
  onApplyBulkEdit: (payload: BulkEditTaskPayload, taskIds: string[]) => Promise<void>;
  projects: Project[];
  sprints: Sprint[];
  artists: Artist[];
}

export const BulkEditModal: React.FC<BulkEditModalProps> = ({
  isOpen,
  onClose,
  selectedTasks,
  onApplyBulkEdit,
  projects,
  sprints,
  artists
}) => {
  // Field toggles
  const [updateStatus, setUpdateStatus] = useState(false);
  const [statusVal, setStatusVal] = useState<TaskStatus>('In Progress');

  const [updateProject, setUpdateProject] = useState(false);
  const [projectIdVal, setProjectIdVal] = useState<string>('');

  const [updateAssignee, setUpdateAssignee] = useState(false);
  const [artistIdVal, setArtistIdVal] = useState<string>('');

  const [updatePriority, setUpdatePriority] = useState(false);
  const [priorityVal, setPriorityVal] = useState<Priority>('High');

  const [updateDueDate, setUpdateDueDate] = useState(false);
  const [dueDateVal, setDueDateVal] = useState<string>('');
  const [clearDueDateVal, setClearDueDateVal] = useState(false);

  const [updateSprint, setUpdateSprint] = useState(false);
  const [sprintIdVal, setSprintIdVal] = useState<string>('');

  const [updateStoryPoints, setUpdateStoryPoints] = useState(false);
  const [storyPointsVal, setStoryPointsVal] = useState<number>(3);

  const [updateOriginalEstimate, setUpdateOriginalEstimate] = useState(false);
  const [originalEstimateVal, setOriginalEstimateVal] = useState<number>(8);

  const [updateTimeLogged, setUpdateTimeLogged] = useState(false);
  const [timeLoggedIncrementVal, setTimeLoggedIncrementVal] = useState<number>(1);
  const [worklogDescVal, setWorklogDescVal] = useState<string>('Bulk worklog update from Studio');

  const [showArchivedProjects, setShowArchivedProjects] = useState(false);
  const [pushToJira, setPushToJira] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || selectedTasks.length === 0) return null;

  const jiraImportedCount = selectedTasks.filter(t => t.isJiraImported || t.jiraIssueKey).length;

  const visibleProjects = projects.filter(p => showArchivedProjects || p.status === 'Active');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Build payload
    const payload: BulkEditTaskPayload = {
      pushToJira
    };

    if (updateStatus) payload.status = statusVal;
    if (updateProject) payload.projectId = projectIdVal || undefined;
    if (updateAssignee) payload.artistId = artistIdVal || undefined;
    if (updatePriority) payload.priority = priorityVal;
    if (updateDueDate) {
      if (clearDueDateVal) {
        payload.clearDueDate = true;
      } else if (dueDateVal) {
        payload.dueDate = dueDateVal;
      }
    }
    if (updateSprint) payload.sprintId = sprintIdVal || undefined;
    if (updateStoryPoints) payload.storyPoints = storyPointsVal;
    if (updateOriginalEstimate) payload.originalEstimate = originalEstimateVal;
    if (updateTimeLogged) {
      payload.timeLoggedIncrement = timeLoggedIncrementVal;
      payload.worklogDescription = worklogDescVal;
    }

    const hasAnyFieldSelected =
      updateStatus ||
      updateProject ||
      updateAssignee ||
      updatePriority ||
      updateDueDate ||
      updateSprint ||
      updateStoryPoints ||
      updateOriginalEstimate ||
      updateTimeLogged;

    if (!hasAnyFieldSelected) {
      setErrorMsg('Please select at least one field to update.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onApplyBulkEdit(payload, selectedTasks.map(t => t.id));
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to apply bulk edit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400">
              <Edit3 size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">
                Bulk Edit ({selectedTasks.length} Tasks Selected)
              </h2>
              <p className="text-xs text-zinc-400">
                Update multiple task attributes simultaneously and synchronize with Jira in real-time.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Selected Tasks Preview Bar */}
        <div className="px-6 py-2.5 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
          <div className="flex items-center gap-2 overflow-x-auto py-1 max-w-full">
            <span className="text-[11px] font-bold text-zinc-500 shrink-0">Selected:</span>
            {selectedTasks.slice(0, 4).map(t => (
              <span
                key={t.id}
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-zinc-200 text-zinc-700 shrink-0 shadow-2xs"
              >
                {t.jiraIssueKey || t.id.slice(0, 8)}
              </span>
            ))}
            {selectedTasks.length > 4 && (
              <span className="text-[10px] font-bold text-zinc-500 shrink-0">
                +{selectedTasks.length - 4} more
              </span>
            )}
          </div>

          {jiraImportedCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 shrink-0">
              {jiraImportedCount} Jira Tickets
            </span>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <p className="text-xs text-zinc-500 font-medium">
            Check the box next to any field you wish to modify across all selected tasks.
          </p>

          <div className="space-y-3">
            {/* 1. Status */}
            <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={updateStatus}
                    onChange={(e) => setUpdateStatus(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-zinc-900">Task Status</span>
                </label>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                  Syncs to Jira Status
                </span>
              </div>

              {updateStatus && (
                <div className="pt-2 border-t border-zinc-200/60">
                  <select
                    value={statusVal}
                    onChange={(e) => setStatusVal(e.target.value as TaskStatus)}
                    className="w-full text-xs font-medium py-2 px-3 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500"
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Re-opened">Re-opened</option>
                    <option value="Submit for Review">Submit for Review</option>
                    <option value="In Iteration">In Iteration</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              )}
            </div>

            {/* 2. Studio Project Mapping */}
            <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={updateProject}
                    onChange={(e) => setUpdateProject(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-zinc-900">Studio Project</span>
                </label>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                  Project Association
                </span>
              </div>

              {updateProject && (
                <div className="pt-2 border-t border-zinc-200/60 space-y-2">
                  <select
                    value={projectIdVal}
                    onChange={(e) => setProjectIdVal(e.target.value)}
                    className="w-full text-xs font-medium py-2 px-3 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500"
                  >
                    <option value="">-- Keep or Select Project --</option>
                    {visibleProjects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.key}){p.status !== 'Active' ? ` [${p.status}]` : ''}
                      </option>
                    ))}
                  </select>
                  {projects.some(p => p.status === 'Archived' || p.status === 'Paused') && (
                    <label className="flex items-center gap-1.5 text-[11px] text-zinc-500 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showArchivedProjects}
                        onChange={(e) => setShowArchivedProjects(e.target.checked)}
                        className="w-3.5 h-3.5 rounded border-zinc-300 text-zinc-600"
                      />
                      <span>Show Archived/Paused Projects</span>
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* 3. Assignee / Artist */}
            <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={updateAssignee}
                    onChange={(e) => setUpdateAssignee(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-zinc-900">Assignee / Artist</span>
                </label>
              </div>

              {updateAssignee && (
                <div className="pt-2 border-t border-zinc-200/60">
                  <select
                    value={artistIdVal}
                    onChange={(e) => setArtistIdVal(e.target.value)}
                    className="w-full text-xs font-medium py-2 px-3 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500"
                  >
                    <option value="">-- Unassigned / Clear Assignee --</option>
                    {artists.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* 4. Priority */}
            <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={updatePriority}
                    onChange={(e) => setUpdatePriority(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-zinc-900">Priority</span>
                </label>
              </div>

              {updatePriority && (
                <div className="pt-2 border-t border-zinc-200/60">
                  <select
                    value={priorityVal}
                    onChange={(e) => setPriorityVal(e.target.value as Priority)}
                    className="w-full text-xs font-medium py-2 px-3 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
              )}
            </div>

            {/* 5. Due Date */}
            <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={updateDueDate}
                    onChange={(e) => setUpdateDueDate(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-zinc-900">Due Date / Target Delivery</span>
                </label>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1">
                  <Calendar size={11} />
                  <span>Timeline</span>
                </span>
              </div>

              {updateDueDate && (
                <div className="pt-2 border-t border-zinc-200/60 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      disabled={clearDueDateVal}
                      value={dueDateVal}
                      onChange={(e) => {
                        setDueDateVal(e.target.value);
                        setClearDueDateVal(false);
                      }}
                      className="flex-1 text-xs font-medium py-2 px-3 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500 disabled:bg-zinc-100 disabled:text-zinc-400"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-xs text-rose-700 font-medium cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={clearDueDateVal}
                      onChange={(e) => {
                        setClearDueDateVal(e.target.checked);
                        if (e.target.checked) setDueDateVal('');
                      }}
                      className="w-3.5 h-3.5 rounded border-zinc-300 text-rose-600 focus:ring-rose-500"
                    />
                    <span>Clear Due Date (Remove deadline from selected tasks)</span>
                  </label>
                </div>
              )}
            </div>

            {/* 5. Sprint Allocation */}
            <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={updateSprint}
                    onChange={(e) => setUpdateSprint(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-zinc-900">Sprint Allocation</span>
                </label>
              </div>

              {updateSprint && (
                <div className="pt-2 border-t border-zinc-200/60">
                  <select
                    value={sprintIdVal}
                    onChange={(e) => setSprintIdVal(e.target.value)}
                    className="w-full text-xs font-medium py-2 px-3 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500"
                  >
                    <option value="">-- Move to Backlog (Unscheduled) --</option>
                    {sprints
                      .filter(s => s.status?.toUpperCase() !== 'COMPLETED')
                      .map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.status})
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>

            {/* 6. Story Points & Original Estimate */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Story Points */}
              <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 flex flex-col gap-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={updateStoryPoints}
                    onChange={(e) => setUpdateStoryPoints(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-zinc-900">Story Points</span>
                </label>

                {updateStoryPoints && (
                  <div className="pt-2 border-t border-zinc-200/60">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={storyPointsVal}
                      onChange={(e) => setStoryPointsVal(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-medium py-2 px-3 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* Original Estimate */}
              <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 flex flex-col gap-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={updateOriginalEstimate}
                    onChange={(e) => setUpdateOriginalEstimate(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-zinc-900">Original Est. (Hours)</span>
                </label>

                {updateOriginalEstimate && (
                  <div className="pt-2 border-t border-zinc-200/60">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={originalEstimateVal}
                      onChange={(e) => setOriginalEstimateVal(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-medium py-2 px-3 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* 7. Time Logged / Tracking */}
            <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={updateTimeLogged}
                    onChange={(e) => setUpdateTimeLogged(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-zinc-900">Log Time / Tracking</span>
                </label>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                  Posts Jira Worklog
                </span>
              </div>

              {updateTimeLogged && (
                <div className="pt-2 border-t border-zinc-200/60 space-y-2">
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                      Add Logged Hours to each task:
                    </label>
                    <input
                      type="number"
                      min={0.1}
                      step={0.25}
                      value={timeLoggedIncrementVal}
                      onChange={(e) => setTimeLoggedIncrementVal(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-medium py-2 px-3 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-zinc-600 mb-1">
                      Worklog Note / Description:
                    </label>
                    <input
                      type="text"
                      value={worklogDescVal}
                      onChange={(e) => setWorklogDescVal(e.target.value)}
                      className="w-full text-xs font-medium py-2 px-3 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Jira Push Preference */}
          {jiraImportedCount > 0 && (
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={pushToJira}
                  onChange={(e) => setPushToJira(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-zinc-300 focus:ring-blue-500 cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-blue-900 block">
                    Push changes directly to Jira Cloud
                  </span>
                  <span className="text-[11px] text-blue-700">
                    Automatically syncs status transitions & worklogs to linked Jira tickets.
                  </span>
                </div>
              </label>
            </div>
          )}

          {/* Footer inside form */}
          <div className="pt-3 border-t border-zinc-200 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-zinc-600 hover:text-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs flex items-center gap-2 transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Applying Changes...</span>
                </>
              ) : (
                <>
                  <Check size={14} />
                  <span>Apply Bulk Edit to {selectedTasks.length} Tasks</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
