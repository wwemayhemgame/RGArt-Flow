import React, { useState } from 'react';
import {
  CheckSquare,
  Edit3,
  UserCheck,
  Layers,
  RotateCcw,
  X,
  ChevronDown,
  CheckCircle2,
  FolderKanban,
  Trash2
} from 'lucide-react';
import { Task, TaskStatus, Artist, Project, Sprint, WORKFLOW_STATUS_LIST } from '../../types';

interface ContextualBulkActionBarProps {
  selectedCount: number;
  selectedTaskIds: string[];
  tasks: Task[];
  artists: Artist[];
  projects: Project[];
  sprints: Sprint[];
  onOpenBulkModal: () => void;
  onQuickStatusChange: (status: TaskStatus) => Promise<void> | void;
  onQuickAssignArtist: (artistId: string) => Promise<void> | void;
  onQuickAssignSprint: (sprintId: string) => Promise<void> | void;
  onQuickSyncJira?: () => Promise<void> | void;
  onQuickDelete?: () => void;
  onClearSelection: () => void;
}

export const ContextualBulkActionBar: React.FC<ContextualBulkActionBarProps> = ({
  selectedCount,
  selectedTaskIds,
  tasks,
  artists,
  projects,
  sprints,
  onOpenBulkModal,
  onQuickStatusChange,
  onQuickAssignArtist,
  onQuickAssignSprint,
  onQuickSyncJira,
  onQuickDelete,
  onClearSelection
}) => {
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isArtistDropdownOpen, setIsArtistDropdownOpen] = useState(false);
  const [isSprintDropdownOpen, setIsSprintDropdownOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  if (selectedCount === 0) return null;

  const selectedTasks = tasks.filter(t => selectedTaskIds.includes(t.id));
  const jiraLinkedCount = selectedTasks.filter(t => Boolean(t.jiraIssueKey)).length;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-[95vw]">
      <div className="flex items-center gap-2 bg-slate-900/95 text-white px-3.5 sm:px-4 py-2.5 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md overflow-x-auto max-w-full scrollbar-none">
        {/* Selection Count Pill */}
        <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold shadow-xs">
            {selectedCount}
          </span>
          <span className="text-xs font-semibold text-slate-200 whitespace-nowrap">
            {selectedCount === 1 ? 'task selected' : 'tasks selected'}
          </span>
        </div>

        {/* Primary Action: Full Bulk Edit Modal */}
        <button
          type="button"
          onClick={onOpenBulkModal}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer whitespace-nowrap"
          title="Open Full Bulk Edit Dialog"
        >
          <Edit3 size={13} />
          <span>Bulk Edit</span>
        </button>

        {/* Quick Status Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsStatusDropdownOpen(!isStatusDropdownOpen);
              setIsArtistDropdownOpen(false);
              setIsSprintDropdownOpen(false);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span>Status</span>
            <ChevronDown size={11} className="text-slate-400" />
          </button>

          {isStatusDropdownOpen && (
            <div className="absolute bottom-full mb-2 left-0 w-48 bg-white text-slate-900 border border-slate-200 rounded-xl shadow-xl p-1.5 z-50 animate-in fade-in duration-100 max-h-60 overflow-y-auto">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">Set Status for {selectedCount} tasks</div>
              {WORKFLOW_STATUS_LIST.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    onQuickStatusChange(st);
                    setIsStatusDropdownOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs font-medium hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center justify-between"
                >
                  <span>{st}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Assign Artist Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsArtistDropdownOpen(!isArtistDropdownOpen);
              setIsStatusDropdownOpen(false);
              setIsSprintDropdownOpen(false);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <UserCheck size={13} className="text-sky-400" />
            <span>Assignee</span>
            <ChevronDown size={11} className="text-slate-400" />
          </button>

          {isArtistDropdownOpen && (
            <div className="absolute bottom-full mb-2 left-0 w-56 bg-white text-slate-900 border border-slate-200 rounded-xl shadow-xl p-1.5 z-50 animate-in fade-in duration-100 max-h-64 overflow-y-auto">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">Assign to Artist</div>
              <button
                type="button"
                onClick={() => {
                  onQuickAssignArtist('');
                  setIsArtistDropdownOpen(false);
                }}
                className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
              >
                ⚠️ Unassign (Clear Assignee)
              </button>
              {artists.map((art) => (
                <button
                  key={art.id}
                  type="button"
                  onClick={() => {
                    onQuickAssignArtist(art.id);
                    setIsArtistDropdownOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center gap-2"
                >
                  <span className="font-medium text-slate-800 truncate">{art.name}</span>
                  <span className="text-[10px] text-slate-400 ml-auto shrink-0">({art.role})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick Assign Sprint Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsSprintDropdownOpen(!isSprintDropdownOpen);
              setIsStatusDropdownOpen(false);
              setIsArtistDropdownOpen(false);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Layers size={13} className="text-purple-400" />
            <span>Sprint</span>
            <ChevronDown size={11} className="text-slate-400" />
          </button>

          {isSprintDropdownOpen && (
            <div className="absolute bottom-full mb-2 left-0 w-60 bg-white text-slate-900 border border-slate-200 rounded-xl shadow-xl p-1.5 z-50 animate-in fade-in duration-100 max-h-64 overflow-y-auto">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">Move to Sprint / Backlog</div>
              <button
                type="button"
                onClick={() => {
                  onQuickAssignSprint('');
                  setIsSprintDropdownOpen(false);
                }}
                className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                📁 Move to Backlog (Unscheduled)
              </button>
              {sprints
                .filter(s => s.status?.toUpperCase() !== 'COMPLETED')
                .map((sprint) => (
                  <button
                    key={sprint.id}
                    type="button"
                    onClick={() => {
                      onQuickAssignSprint(sprint.id);
                      setIsSprintDropdownOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center justify-between"
                  >
                    <span className="font-medium text-slate-800 truncate">Sprint #{sprint.sprintNumber}: {sprint.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold ml-1.5 shrink-0">{sprint.status}</span>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Jira Sync Quick Action (if any Jira tasks selected) */}
        {jiraLinkedCount > 0 && onQuickSyncJira && (
          <button
            type="button"
            disabled={isSyncing}
            onClick={async () => {
              setIsSyncing(true);
              await onQuickSyncJira();
              setIsSyncing(false);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-900/60 hover:bg-blue-900 text-blue-200 border border-blue-700/60 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            title={`Sync ${jiraLinkedCount} Jira-linked tickets with Jira`}
          >
            <RotateCcw size={12} className={isSyncing ? 'animate-spin' : ''} />
            <span>Sync Jira ({jiraLinkedCount})</span>
          </button>
        )}

        {/* Quick Delete Action */}
        {onQuickDelete && (
          <button
            type="button"
            onClick={onQuickDelete}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800/80 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            title={`Delete ${selectedCount} selected tasks`}
          >
            <Trash2 size={13} className="text-rose-400" />
            <span>Delete</span>
          </button>
        )}

        {/* Clear Selection (✕) */}
        <button
          type="button"
          onClick={onClearSelection}
          className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer ml-1"
          title="Deselect all"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
