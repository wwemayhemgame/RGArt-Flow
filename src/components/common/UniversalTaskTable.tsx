import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  CheckSquare,
  Square,
  Clock,
  AlertTriangle,
  RotateCcw,
  Plus,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ExternalLink,
  Flame,
  CheckCircle2,
  Paperclip,
  ShieldAlert,
  Users,
  UserCheck,
  UserX,
  Search,
  SlidersHorizontal,
  Edit3,
  X,
  Filter,
  Eye,
  ArrowUpRight,
  Layers,
  FolderKanban,
  Calendar,
  Tag,
  Maximize2,
  Trash2,
  RefreshCw,
  MoreHorizontal,
  GitCommit,
  Share2,
  Check,
  ArrowRightLeft
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { copyTaskShareUrl } from '../../utils/shareUtils';
import {
  Task,
  TaskStatus,
  Artist,
  Priority,
  Project,
  Sprint,
  normalizeTaskStatus,
  isTaskDoneOrCompleted,
  WORKFLOW_STATUS_LIST
} from '../../types';
import { TaskStatusBadge, PriorityBadge } from './Badge';
import { Avatar } from './Avatar';
import { formatDate } from '../../utils/dateUtils';
import { formatDuration } from '../../utils/timeUtils';
import { LogTimeModal } from '../modals/LogTimeModal';
import { BlockerModal } from '../modals/BlockerModal';
import { ContextualBulkActionBar } from './ContextualBulkActionBar';
import { BulkEditModal } from './BulkEditModal';
import { Modal } from './Modal';
import { FloatingTableScrollbar } from './FloatingTableScrollbar';
import { resolveJiraMetadata } from '../../utils/jiraMetadataResolver';

export type TaskTableColumnId =
  | 'id'
  | 'title'
  | 'artist'
  | 'reporter'
  | 'priority'
  | 'status'
  | 'jiraParent'
  | 'jiraSprintId'
  | 'jiraFixVersion'
  | 'resolution'
  | 'createdDate'
  | 'updatedDate'
  | 'dueDate'
  | 'fixVersion'
  | 'sprint'
  | 'storyPoints'
  | 'originalEstimate'
  | 'timeLogged'
  | 'remainingEstimate'
  | 'project'
  | 'jiraLink'
  | 'actions';

export interface ColumnDefinition {
  id: TaskTableColumnId;
  label: string;
  minWidth?: string;
  defaultVisible: boolean;
  sortable?: boolean;
  sticky?: boolean;
}

export const ALL_COLUMNS: ColumnDefinition[] = [
  { id: 'id', label: 'Task ID / Key', minWidth: '140px', defaultVisible: true, sortable: true, sticky: true },
  { id: 'title', label: 'Task Title', minWidth: '240px', defaultVisible: true, sortable: true, sticky: true },
  { id: 'artist', label: 'Assignee', minWidth: '150px', defaultVisible: true, sortable: true },
  { id: 'reporter', label: 'Reporter', minWidth: '130px', defaultVisible: false, sortable: true },
  { id: 'priority', label: 'Priority', minWidth: '110px', defaultVisible: true, sortable: true },
  { id: 'status', label: 'Status', minWidth: '150px', defaultVisible: true, sortable: true },
  { id: 'jiraParent', label: 'Jira Parent', minWidth: '170px', defaultVisible: true, sortable: true },
  { id: 'jiraSprintId', label: 'Jira Sprint ID', minWidth: '130px', defaultVisible: true, sortable: true },
  { id: 'jiraFixVersion', label: 'Jira Fix Version', minWidth: '140px', defaultVisible: true, sortable: true },
  { id: 'resolution', label: 'Resolution', minWidth: '110px', defaultVisible: false, sortable: true },
  { id: 'createdDate', label: 'Created Date', minWidth: '120px', defaultVisible: false, sortable: true },
  { id: 'updatedDate', label: 'Updated', minWidth: '110px', defaultVisible: false, sortable: true },
  { id: 'dueDate', label: 'Due Date', minWidth: '120px', defaultVisible: true, sortable: true },
  { id: 'fixVersion', label: 'Fix Version', minWidth: '120px', defaultVisible: false, sortable: true },
  { id: 'sprint', label: 'Sprint', minWidth: '130px', defaultVisible: true, sortable: true },
  { id: 'storyPoints', label: 'Story Points', minWidth: '100px', defaultVisible: true, sortable: true },
  { id: 'originalEstimate', label: 'Original Est.', minWidth: '110px', defaultVisible: true, sortable: true },
  { id: 'timeLogged', label: 'Time Logged', minWidth: '110px', defaultVisible: true, sortable: true },
  { id: 'remainingEstimate', label: 'Remaining', minWidth: '100px', defaultVisible: true, sortable: true },
  { id: 'project', label: 'Project', minWidth: '130px', defaultVisible: true, sortable: true },
  { id: 'jiraLink', label: 'Jira Link', minWidth: '120px', defaultVisible: false, sortable: true },
  { id: 'actions', label: 'Actions', minWidth: '100px', defaultVisible: true, sortable: false }
];

export interface UniversalTaskTableProps {
  tasks: Task[];
  onSelectTask: (taskId: string, currentTaskIdsList?: string[], fullscreen?: boolean) => void;
  tableKey?: string; // For localStorage persistence of visible columns
  showSelection?: boolean;
  selectedTaskIds?: Set<string>;
  onToggleSelectTask?: (taskId: string) => void;
  onSelectAllTasks?: (allIds: string[]) => void;
  onClearSelection?: () => void;
  enableQuickActions?: boolean;
  enableBulkBar?: boolean;
  emptyMessage?: string;
  emptySubMessage?: string;
  onEmptyAction?: () => void;
  emptyActionLabel?: string;
  defaultPageSize?: number;
  enablePagination?: boolean;
}

export const UniversalTaskTable: React.FC<UniversalTaskTableProps> = ({
  tasks,
  onSelectTask,
  tableKey = 'default-task-table',
  showSelection = true,
  selectedTaskIds: propSelectedTaskIds,
  onToggleSelectTask: propOnToggleSelect,
  onSelectAllTasks: propOnSelectAll,
  onClearSelection: propOnClearSelection,
  enableQuickActions = true,
  enableBulkBar = true,
  emptyMessage = 'No tasks found',
  emptySubMessage = 'Try adjusting your filters or search query',
  onEmptyAction,
  emptyActionLabel,
  defaultPageSize = 25,
  enablePagination = true
}) => {
  const {
    artists,
    projects,
    sprints,
    users,
    currentUser,
    updateTaskStatus,
    updateTask,
    moveTaskToSprint,
    moveTaskToBacklog,
    unassignTask,
    deleteTask,
    applyBulkEditTasks,
    bulkUpdateTasks,
    syncTaskToJira,
    settings,
    hasFieldAccess,
    showPermissionDenial
  } = useArtOps();

  // Local selection state if not controlled externally
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());
  const selectedTaskIds = propSelectedTaskIds || internalSelectedIds;

  const handleToggleSelect = (taskId: string) => {
    if (propOnToggleSelect) {
      propOnToggleSelect(taskId);
    } else {
      setInternalSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(taskId)) next.delete(taskId);
        else next.add(taskId);
        return next;
      });
    }
  };

  const handleSelectAll = () => {
    const allIds = tasks.map(t => t.id);
    if (propOnSelectAll) {
      propOnSelectAll(allIds);
    } else {
      setInternalSelectedIds(new Set(allIds));
    }
  };

  const handleClearSelection = () => {
    if (propOnClearSelection) {
      propOnClearSelection();
    } else {
      setInternalSelectedIds(new Set());
    }
  };

  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);

  // Column Visibility State with localStorage caching
  const storageKey = `rg_artflow_cols_${tableKey}`;
  const [visibleColumns, setVisibleColumns] = useState<Record<TaskTableColumnId, boolean>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        ALL_COLUMNS.forEach(col => {
          if (parsed[col.id] === undefined) {
            parsed[col.id] = col.defaultVisible;
          }
        });
        return parsed;
      }
    } catch {
      // ignore
    }
    const defaults: Record<string, boolean> = {};
    ALL_COLUMNS.forEach(col => {
      defaults[col.id] = col.defaultVisible;
    });
    return defaults as Record<TaskTableColumnId, boolean>;
  });

  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);

  const toggleColumn = (colId: TaskTableColumnId) => {
    // Keep 'id' and 'title' always visible
    if (colId === 'id' || colId === 'title') return;
    setVisibleColumns(prev => {
      const updated = { ...prev, [colId]: !prev[colId] };
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const resetDefaultColumns = () => {
    const defaults: Record<string, boolean> = {};
    ALL_COLUMNS.forEach(col => {
      defaults[col.id] = col.defaultVisible;
    });
    setVisibleColumns(defaults as Record<TaskTableColumnId, boolean>);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
  };

  // Sorting State
  const [sortColumn, setSortColumn] = useState<TaskTableColumnId>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (colId: TaskTableColumnId) => {
    if (sortColumn === colId) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(colId);
      setSortDirection('asc');
    }
  };

  // Active sorted tasks
  const sortedTasks = useMemo(() => {
    const list = [...tasks];
    list.sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortColumn) {
        case 'id':
          valA = a.jiraIssueKey || a.id;
          valB = b.jiraIssueKey || b.id;
          break;
        case 'title':
          valA = (a.title || '').toLowerCase();
          valB = (b.title || '').toLowerCase();
          break;
        case 'artist': {
          const artA = artists.find(art => art.id === a.artistId)?.name || 'zzz';
          const artB = artists.find(art => art.id === b.artistId)?.name || 'zzz';
          valA = artA.toLowerCase();
          valB = artB.toLowerCase();
          break;
        }
        case 'reporter': {
          const repA = users.find(u => u.id === a.requesterId || u.id === a.createdBy)?.name || 'zzz';
          const repB = users.find(u => u.id === b.requesterId || u.id === b.createdBy)?.name || 'zzz';
          valA = repA.toLowerCase();
          valB = repB.toLowerCase();
          break;
        }
        case 'priority': {
          const pOrder: Record<Priority, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
          valA = pOrder[a.priority] || 0;
          valB = pOrder[b.priority] || 0;
          break;
        }
        case 'status':
          valA = normalizeTaskStatus(a.status);
          valB = normalizeTaskStatus(b.status);
          break;
        case 'jiraParent':
          valA = (a.jiraParentKey || a.jiraParentSummary || a.epic || '').toLowerCase();
          valB = (b.jiraParentKey || b.jiraParentSummary || b.epic || '').toLowerCase();
          break;
        case 'jiraSprintId':
          valA = a.jiraSprintId || (a.jiraSprintNumber ? String(a.jiraSprintNumber) : '') || '';
          valB = b.jiraSprintId || (b.jiraSprintNumber ? String(b.jiraSprintNumber) : '') || '';
          break;
        case 'jiraFixVersion':
        case 'fixVersion':
          valA = (a.jiraFixVersion || (a.jiraFixVersions && a.jiraFixVersions.join(', ')) || a.fixVersion || (a.jiraUpdateNo ? `Update ${a.jiraUpdateNo}` : '') || '').toLowerCase();
          valB = (b.jiraFixVersion || (b.jiraFixVersions && b.jiraFixVersions.join(', ')) || b.fixVersion || (b.jiraUpdateNo ? `Update ${b.jiraUpdateNo}` : '') || '').toLowerCase();
          break;
        case 'dueDate':
          valA = a.dueDate || '9999-99-99';
          valB = b.dueDate || '9999-99-99';
          break;
        case 'createdDate':
          valA = a.createdDate || '';
          valB = b.createdDate || '';
          break;
        case 'updatedDate':
          valA = a.expectedDelivery || a.createdDate || '';
          valB = b.expectedDelivery || b.createdDate || '';
          break;
        case 'storyPoints':
          valA = a.storyPoints || 0;
          valB = b.storyPoints || 0;
          break;
        case 'originalEstimate':
          valA = a.originalEstimate || 0;
          valB = b.originalEstimate || 0;
          break;
        case 'timeLogged':
          valA = a.timeLogged || 0;
          valB = b.timeLogged || 0;
          break;
        case 'remainingEstimate':
          valA = a.remainingEstimate ?? a.originalEstimate ?? 0;
          valB = b.remainingEstimate ?? b.originalEstimate ?? 0;
          break;
        case 'project': {
          const prjA = projects.find(p => p.id === a.projectId)?.name || '';
          const prjB = projects.find(p => p.id === b.projectId)?.name || '';
          valA = prjA.toLowerCase();
          valB = prjB.toLowerCase();
          break;
        }
        case 'sprint': {
          const spA = sprints.find(s => s.id === a.sprintId)?.name || 'Backlog';
          const spB = sprints.find(s => s.id === b.sprintId)?.name || 'Backlog';
          valA = spA.toLowerCase();
          valB = spB.toLowerCase();
          break;
        }
        default:
          valA = a.id;
          valB = b.id;
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [tasks, sortColumn, sortDirection, artists, projects, sprints, users]);

  // List of task IDs in current view for previous / next navigation
  const currentTaskIdsList = useMemo(() => sortedTasks.map(t => t.id), [sortedTasks]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(defaultPageSize);

  // Total pages
  const totalPages = useMemo(() => {
    if (!enablePagination || pageSize === -1) return 1;
    return Math.max(1, Math.ceil(sortedTasks.length / pageSize));
  }, [sortedTasks.length, pageSize, enablePagination]);

  // Bounds adjustment
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  // Reset to page 1 on sort change or task list change
  useEffect(() => {
    setCurrentPage(1);
  }, [sortColumn, sortDirection, tasks.length]);

  // Paginated slice
  const paginatedTasks = useMemo(() => {
    if (!enablePagination || pageSize === -1) return sortedTasks;
    const startIndex = (currentPage - 1) * pageSize;
    return sortedTasks.slice(startIndex, startIndex + pageSize);
  }, [sortedTasks, currentPage, pageSize, enablePagination]);

  // Modals for quick actions
  const [logTimeTaskId, setLogTimeTaskId] = useState<string | null>(null);
  const [blockerTaskId, setBlockerTaskId] = useState<string | null>(null);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  // Horizontal Scrolling References & State
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);
  const [hasTableOverflow, setHasTableOverflow] = useState(false);
  const [tableScrollWidth, setTableScrollWidth] = useState(0);
  const [tableClientWidth, setTableClientWidth] = useState(0);
  const [tableScrollLeft, setTableScrollLeft] = useState(0);

  // Measure table horizontal overflow & synchronize top scroll
  useEffect(() => {
    const el = tableContainerRef.current;
    if (!el) return;

    const measure = () => {
      const overflow = el.scrollWidth > el.clientWidth + 6;
      setHasTableOverflow(overflow);
      setTableScrollWidth(el.scrollWidth);
      setTableClientWidth(el.clientWidth);
      setTableScrollLeft(el.scrollLeft);
    };

    measure();

    const handleScroll = () => {
      setTableScrollLeft(el.scrollLeft);
      if (topScrollRef.current && !isSyncingScroll.current) {
        isSyncingScroll.current = true;
        topScrollRef.current.scrollLeft = el.scrollLeft;
        requestAnimationFrame(() => {
          isSyncingScroll.current = false;
        });
      }
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', measure);
    const ro = new ResizeObserver(measure);
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', measure);
      ro.disconnect();
    };
  }, [paginatedTasks, visibleColumns]);

  const handleTopScroll = () => {
    const top = topScrollRef.current;
    const table = tableContainerRef.current;
    if (!top || !table) return;

    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    table.scrollLeft = top.scrollLeft;
    setTableScrollLeft(top.scrollLeft);
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  const handleScrollTableBy = (amount: number) => {
    const table = tableContainerRef.current;
    if (!table) return;
    table.scrollBy({ left: amount, behavior: 'smooth' });
  };

  // Active Dropdown menus
  const [activeDropdownTaskId, setActiveDropdownTaskId] = useState<string | null>(null);
  const [activeStatusDropdownId, setActiveStatusDropdownId] = useState<string | null>(null);
  const [activeArtistDropdownId, setActiveArtistDropdownId] = useState<string | null>(null);
  const [activeSprintDropdownId, setActiveSprintDropdownId] = useState<string | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.task-table-dropdown-container')) {
        setActiveDropdownTaskId(null);
        setActiveStatusDropdownId(null);
        setActiveArtistDropdownId(null);
        setActiveSprintDropdownId(null);
        setIsColumnPickerOpen(false);
      }
    };
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

  const allVisibleSelected = sortedTasks.length > 0 && sortedTasks.every(t => selectedTaskIds.has(t.id));
  const someVisibleSelected = sortedTasks.some(t => selectedTaskIds.has(t.id)) && !allVisibleSelected;

  return (
    <div className="flex flex-col w-full bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Table Top Controls: Counts & Column Picker */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/80 border-b border-slate-200/80 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">
            {sortedTasks.length} {sortedTasks.length === 1 ? 'task' : 'tasks'}
          </span>
          {selectedTaskIds.size > 0 && (
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
              {selectedTaskIds.size} selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 relative task-table-dropdown-container">
          {/* Quick Horizontal Scroll Buttons */}
          {hasTableOverflow && (
            <div className="flex items-center gap-1 bg-slate-100/90 p-0.5 rounded-lg border border-slate-200/90 text-xs">
              <span className="text-[10px] text-slate-500 font-semibold px-1 hidden sm:inline">
                Scroll:
              </span>
              <button
                type="button"
                onClick={() => handleScrollTableBy(-280)}
                disabled={tableScrollLeft <= 2}
                className="px-1.5 py-1 rounded bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-200 text-slate-700 cursor-pointer flex items-center gap-0.5 text-[11px] font-semibold transition-colors shadow-2xs"
                title="Scroll columns left"
              >
                <ChevronLeft size={13} />
                <span className="hidden md:inline">Left</span>
              </button>
              <button
                type="button"
                onClick={() => handleScrollTableBy(280)}
                disabled={tableScrollLeft >= tableScrollWidth - tableClientWidth - 5}
                className="px-1.5 py-1 rounded bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed border border-slate-200 text-slate-700 cursor-pointer flex items-center gap-0.5 text-[11px] font-semibold transition-colors shadow-2xs"
                title="Scroll columns right"
              >
                <span className="hidden md:inline">Right</span>
                <ChevronRight size={13} />
              </button>
            </div>
          )}

          {/* Column Customizer Button */}
          <button
            type="button"
            onClick={() => setIsColumnPickerOpen(prev => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            title="Configure Visible Columns"
          >
            <SlidersHorizontal size={13} className="text-slate-500" />
            <span>Columns</span>
            <ChevronDown size={12} className="text-slate-400" />
          </button>

          {/* Column Picker Popover */}
          {isColumnPickerOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-3 z-50 animate-in fade-in duration-150 max-h-96 overflow-y-auto">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800">Customize Columns</span>
                <button
                  type="button"
                  onClick={resetDefaultColumns}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  Reset Defaults
                </button>
              </div>
              <div className="space-y-1">
                {ALL_COLUMNS.map(col => {
                  const isLocked = col.id === 'id' || col.id === 'title';
                  const isChecked = visibleColumns[col.id] !== false;
                  return (
                    <label
                      key={col.id}
                      className={`flex items-center justify-between px-2 py-1.5 text-xs rounded-lg transition-colors select-none ${
                        isLocked ? 'text-slate-400 bg-slate-50 cursor-not-allowed' : 'hover:bg-slate-100 text-slate-700 cursor-pointer'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          disabled={isLocked}
                          checked={isChecked}
                          onChange={() => toggleColumn(col.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className={isLocked ? 'font-medium' : 'font-normal'}>{col.label}</span>
                      </span>
                      {isLocked && <span className="text-[10px] text-slate-400 font-mono">Sticky</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top Synchronized Horizontal Scrollbar */}
      {hasTableOverflow && (
        <div
          ref={topScrollRef}
          onScroll={handleTopScroll}
          className="w-full overflow-x-auto scrollbar-thin bg-slate-100/80 border-b border-slate-200 py-0.5 cursor-ew-resize select-none"
          title="Top horizontal scrollbar - drag or scroll horizontally"
        >
          <div style={{ width: `${tableScrollWidth}px`, height: '6px' }} />
        </div>
      )}

      {/* Main Table Scroll Container */}
      <div ref={tableContainerRef} className="w-full overflow-x-auto scrollbar-thin">
        <table className="w-full text-left border-collapse text-xs">
          {/* Table Header */}
          <thead>
            <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 select-none">
              {showSelection && (
                <th className="py-2.5 px-3 w-10 text-center sticky left-0 bg-slate-100 z-20">
                  <button
                    type="button"
                    onClick={() => {
                      if (allVisibleSelected) {
                        handleClearSelection();
                      } else {
                        handleSelectAll();
                      }
                    }}
                    className="flex items-center justify-center p-0.5 rounded text-slate-600 hover:text-slate-900 cursor-pointer"
                    title={allVisibleSelected ? 'Deselect all' : 'Select all'}
                  >
                    {allVisibleSelected ? (
                      <CheckSquare size={15} className="text-blue-600" />
                    ) : someVisibleSelected ? (
                      <div className="w-3.5 h-3.5 rounded bg-blue-600 flex items-center justify-center text-white font-black text-[10px]">
                        -
                      </div>
                    ) : (
                      <Square size={15} className="text-slate-400" />
                    )}
                  </button>
                </th>
              )}

              {ALL_COLUMNS.filter(c => visibleColumns[c.id] !== false).map((col, idx) => {
                const isStickyId = col.id === 'id';
                const isStickyTitle = col.id === 'title';
                const stickyClass = isStickyId
                  ? `sticky ${showSelection ? 'left-10' : 'left-0'} bg-slate-100 z-20 shadow-xs border-r border-slate-200/60`
                  : isStickyTitle
                  ? `sticky ${showSelection ? 'left-48' : 'left-36'} bg-slate-100 z-20 shadow-xs border-r border-slate-200/60`
                  : '';

                return (
                  <th
                    key={col.id}
                    style={{ minWidth: col.minWidth }}
                    onClick={() => col.sortable && handleSort(col.id)}
                    className={`py-2.5 px-3 text-slate-700 font-bold whitespace-nowrap ${
                      col.sortable ? 'cursor-pointer hover:bg-slate-200/80 transition-colors' : ''
                    } ${stickyClass}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.label}</span>
                      {col.sortable && (
                        <span className="text-slate-400">
                          {sortColumn === col.id ? (
                            sortDirection === 'asc' ? (
                              <ChevronUp size={13} className="text-blue-600 font-black" />
                            ) : (
                              <ChevronDown size={13} className="text-blue-600 font-black" />
                            )
                          ) : (
                            <ChevronsUpDown size={12} className="opacity-40" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {sortedTasks.length === 0 ? (
              <tr>
                <td
                  colSpan={ALL_COLUMNS.filter(c => visibleColumns[c.id] !== false).length + (showSelection ? 1 : 0)}
                  className="py-16 text-center"
                >
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto p-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                      <Search size={24} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 mb-1">{emptyMessage}</h3>
                    <p className="text-xs text-slate-500 mb-4">{emptySubMessage}</p>
                    {onEmptyAction && emptyActionLabel && (
                      <button
                        type="button"
                        onClick={onEmptyAction}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                      >
                        {emptyActionLabel}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              paginatedTasks.map(task => {
                const isSelected = selectedTaskIds.has(task.id);
                const artist = artists.find(a => a.id === task.artistId);
                const project = projects.find(p => p.id === task.projectId);
                const sprint = sprints.find(s => s.id === task.sprintId);
                const reporter = users.find(u => u.id === task.requesterId || u.id === task.createdBy);
                const isDone = isTaskDoneOrCompleted(task.status);
                const isOverdue =
                  Boolean(task.dueDate) &&
                  task.dueDate < new Date().toISOString().split('T')[0] &&
                  !isDone;
                const hasCarryForward = Array.isArray(task.sprintHistory) && task.sprintHistory.length > 1;
                const isJira = Boolean(task.isJiraImported || task.jiraIssueKey);

                // Jira ticket information extraction with deep fallback resolution
                const jiraMeta = resolveJiraMetadata(task, settings, sprint);
                const parentKey = jiraMeta.parentKey;
                const parentSummary = jiraMeta.parentSummary;
                const parentType = jiraMeta.parentType;
                const parentUrl = jiraMeta.parentUrl;
                const resolvedSprintId = jiraMeta.sprintId;
                const sprintNameHint = jiraMeta.sprintName;
                const resolvedFixVersion = jiraMeta.fixVersion;

                return (
                  <tr
                    key={task.id}
                    className={`group hover:bg-blue-50/40 transition-colors ${
                      isSelected ? 'bg-blue-50/70 font-medium' : ''
                    }`}
                  >
                    {/* Checkbox Column */}
                    {showSelection && (
                      <td className="py-2.5 px-3 text-center sticky left-0 bg-white group-hover:bg-blue-50/40 z-10">
                        <button
                          type="button"
                          onClick={() => handleToggleSelect(task.id)}
                          className="flex items-center justify-center p-0.5 rounded text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare size={15} className="text-blue-600" />
                          ) : (
                            <Square size={15} className="text-slate-300 group-hover:text-slate-400" />
                          )}
                        </button>
                      </td>
                    )}

                    {/* Task ID Column (Sticky) */}
                    {visibleColumns.id !== false && (
                      <td
                        className={`py-2.5 px-3 sticky ${
                          showSelection ? 'left-10' : 'left-0'
                        } bg-white group-hover:bg-blue-50/40 z-10 border-r border-slate-100 shadow-2xs whitespace-nowrap`}
                      >
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => onSelectTask(task.id, currentTaskIdsList)}
                            className="font-mono font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer flex items-center gap-1"
                            title="Open Task Details"
                          >
                            <span>{task.jiraIssueKey || task.id}</span>
                          </button>

                          {/* Jira badge if linked */}
                          {task.jiraIssueKey && (
                            <span
                              className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200/80 px-1.5 py-0.2 rounded"
                              title={`Jira Key: ${task.jiraIssueKey}`}
                            >
                              Jira
                            </span>
                          )}

                          {/* Carry Forward Indicator Badge (Req 141) */}
                          {hasCarryForward && (
                            <span
                              className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded inline-flex items-center gap-0.5"
                              title={`Carried forward across multiple sprints: ${task.sprintHistory?.join(' → ')}`}
                            >
                              ↗ CF
                            </span>
                          )}
                        </div>
                      </td>
                    )}

                    {/* Task Title Column (Sticky) */}
                    {visibleColumns.title !== false && (
                      <td
                        className={`py-2.5 px-3 sticky ${
                          showSelection ? 'left-48' : 'left-36'
                        } bg-white group-hover:bg-blue-50/40 z-10 border-r border-slate-100 shadow-2xs`}
                      >
                        <div className="flex flex-col min-w-[200px] max-w-sm">
                          <button
                            type="button"
                            onClick={() => onSelectTask(task.id, currentTaskIdsList)}
                            className="text-left font-semibold text-slate-900 hover:text-blue-700 transition-colors line-clamp-2 cursor-pointer"
                          >
                            {task.title}
                          </button>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {task.taskType && (
                              <span className="text-[10px] text-slate-500 font-medium">{task.taskType}</span>
                            )}
                            {task.revisionCount && task.revisionCount > 0 ? (
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                Rev #{task.revisionCount}
                              </span>
                            ) : null}
                            {task.isMissingTask && (
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                                Missing Task
                              </span>
                            )}
                            {(task.isMoved || task.tags?.includes('Moved') || task.tags?.includes('Carried Forward')) && (
                              <span
                                className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 inline-flex items-center gap-1"
                                title={task.movedFromSprintName ? `Moved from ${task.movedFromSprintName}` : 'Carried forward from previous sprint'}
                              >
                                <ArrowRightLeft size={10} />
                                <span>Moved</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    )}

                    {/* Assignee Column */}
                    {visibleColumns.artist !== false && (
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {enableQuickActions ? (
                          <div className="relative task-table-dropdown-container">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!hasFieldAccess('canAssignArtists')) {
                                  showPermissionDenial('Assign Artist to Task', 'Your role does not have permission to assign or reassign artists.');
                                  return;
                                }
                                setActiveArtistDropdownId(activeArtistDropdownId === task.id ? null : task.id);
                                setActiveStatusDropdownId(null);
                                setActiveSprintDropdownId(null);
                              }}
                              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 text-left transition-colors cursor-pointer group/art"
                            >
                              {artist ? (
                                <>
                                  <Avatar name={artist.name} src={artist.avatar} size="xs" />
                                  <span className="font-medium text-slate-800 truncate max-w-[100px]">
                                    {artist.name}
                                  </span>
                                </>
                              ) : task.jiraOriginalAssignee ? (
                                <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1" title={`Jira Lead: ${task.jiraOriginalAssignee}`}>
                                  <Users size={11} className="text-blue-600" />
                                  <span className="truncate max-w-[90px]">{task.jiraOriginalAssignee}</span>
                                </span>
                              ) : (
                                <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                                  <UserX size={11} />
                                  <span>Unassigned</span>
                                </span>
                              )}
                              <ChevronDown size={11} className="text-slate-400 opacity-0 group-hover/art:opacity-100" />
                            </button>

                            {/* Quick Assign Artist Dropdown */}
                            {activeArtistDropdownId === task.id && (
                              <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-50 animate-in fade-in duration-100 max-h-60 overflow-y-auto">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                                  Assign Artist
                                </div>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    unassignTask(task.id);
                                    setActiveArtistDropdownId(null);
                                    if (task.jiraIssueKey) {
                                      try {
                                        await syncTaskToJira(task.id);
                                      } catch {
                                        // non-blocking
                                      }
                                    }
                                  }}
                                  className="w-full text-left px-2 py-1.5 text-xs text-amber-700 hover:bg-amber-50 rounded-lg font-semibold flex items-center gap-1.5 cursor-pointer"
                                >
                                  <UserX size={12} />
                                  <span>Unassign</span>
                                </button>
                                {artists.map(art => (
                                  <button
                                    key={art.id}
                                    type="button"
                                    onClick={async () => {
                                      updateTask(task.id, { artistId: art.id });
                                      setActiveArtistDropdownId(null);
                                      if (task.jiraIssueKey) {
                                        try {
                                          await syncTaskToJira(task.id);
                                        } catch {
                                          // non-blocking
                                        }
                                      }
                                    }}
                                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-slate-100 rounded-lg flex items-center gap-2 cursor-pointer"
                                  >
                                    <Avatar name={art.name} src={art.avatar} size="xs" />
                                    <span className="font-medium text-slate-800 truncate">{art.name}</span>
                                    {art.id === task.artistId && (
                                      <CheckCircle2 size={12} className="text-blue-600 ml-auto" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {artist ? (
                              <>
                                <Avatar name={artist.name} src={artist.avatar} size="xs" />
                                <span className="font-medium text-slate-800">{artist.name}</span>
                              </>
                            ) : task.jiraOriginalAssignee ? (
                              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1" title={`Jira Lead: ${task.jiraOriginalAssignee}`}>
                                <Users size={11} className="text-blue-600" />
                                <span>{task.jiraOriginalAssignee}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Unassigned</span>
                            )}
                          </div>
                        )}
                      </td>
                    )}

                    {/* Reporter Column */}
                    {visibleColumns.reporter !== false && (
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                        {reporter ? (
                          <div className="flex items-center gap-1.5">
                            <Avatar name={reporter.name} src={reporter.avatar} size="xs" />
                            <span>{reporter.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    )}

                    {/* Priority Column */}
                    {visibleColumns.priority !== false && (
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <PriorityBadge priority={task.priority} />
                      </td>
                    )}

                    {/* Status Column (Real Studio Workflow Status Dropdown) */}
                    {visibleColumns.status !== false && (
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {enableQuickActions ? (
                          <div className="relative task-table-dropdown-container">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveStatusDropdownId(activeStatusDropdownId === task.id ? null : task.id);
                                setActiveArtistDropdownId(null);
                                setActiveSprintDropdownId(null);
                              }}
                              className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer group/st"
                            >
                              <TaskStatusBadge status={task.status} />
                              <ChevronDown size={11} className="text-slate-400 opacity-0 group-hover/st:opacity-100" />
                            </button>

                            {/* Status Change Dropdown */}
                            {activeStatusDropdownId === task.id && (
                              <div className="absolute left-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-50 animate-in fade-in duration-100 max-h-64 overflow-y-auto">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                                  Update Status
                                </div>
                                {WORKFLOW_STATUS_LIST.map(st => (
                                  <button
                                    key={st}
                                    type="button"
                                    onClick={() => {
                                      if (st === 'On Hold' || (st as string) === 'BLOCKED') {
                                        setBlockerTaskId(task.id);
                                      } else {
                                        updateTaskStatus(task.id, st);
                                      }
                                      setActiveStatusDropdownId(null);
                                    }}
                                    className="w-full text-left px-2.5 py-1.5 text-xs font-medium hover:bg-slate-100 rounded-lg flex items-center justify-between cursor-pointer"
                                  >
                                    <span>{st}</span>
                                    {normalizeTaskStatus(task.status) === normalizeTaskStatus(st) && (
                                      <CheckCircle2 size={12} className="text-blue-600" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <TaskStatusBadge status={task.status} />
                        )}
                      </td>
                    )}

                    {/* Jira Parent Column */}
                    {visibleColumns.jiraParent !== false && (
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {parentKey ? (
                          <div className="flex flex-col gap-0.5 max-w-[210px]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {parentUrl ? (
                                <a
                                  href={parentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 hover:text-purple-900 px-1.5 py-0.5 rounded border border-purple-200 transition-colors cursor-pointer"
                                  title={`Open Jira Parent ${parentKey} in new tab`}
                                >
                                  <GitCommit size={11} className="text-purple-600 shrink-0" />
                                  <span>{parentKey}</span>
                                  <ExternalLink size={9} className="text-purple-400 shrink-0" />
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                  <GitCommit size={11} className="text-purple-600 shrink-0" />
                                  <span>{parentKey}</span>
                                </span>
                              )}
                              {parentType && (
                                <span className="text-[10px] font-semibold text-purple-700 bg-purple-100/70 px-1.5 py-0.2 rounded border border-purple-200/80">
                                  {parentType}
                                </span>
                              )}
                            </div>
                            {parentSummary && (
                              <span className="text-[11px] text-slate-600 truncate font-normal" title={parentSummary}>
                                {parentSummary}
                              </span>
                            )}
                          </div>
                        ) : parentSummary ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 truncate max-w-[180px]" title={`Parent: ${parentSummary}`}>
                            <GitCommit size={11} className="text-slate-500 shrink-0" />
                            <span className="truncate">{parentSummary}</span>
                          </span>
                        ) : isJira ? (
                          <span className="text-slate-400 italic text-[11px]">No Parent</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    )}

                    {/* Jira Sprint ID Column */}
                    {visibleColumns.jiraSprintId !== false && (
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {resolvedSprintId ? (
                          <span
                            className="inline-flex items-center gap-1 font-mono text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200"
                            title={`Jira Sprint ID: ${resolvedSprintId}${sprintNameHint ? ` (${sprintNameHint})` : ''}`}
                          >
                            <Layers size={11} className="text-indigo-500 shrink-0" />
                            <span>#{resolvedSprintId}</span>
                          </span>
                        ) : isJira ? (
                          <span className="text-slate-400 italic text-[11px]">No Sprint</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    )}

                    {/* Jira Fix Version Column */}
                    {visibleColumns.jiraFixVersion !== false && (
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {resolvedFixVersion ? (
                          <span
                            className="inline-flex items-center gap-1 font-mono text-[11px] font-bold bg-amber-50 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200"
                            title={`Fix Version: ${resolvedFixVersion}`}
                          >
                            <Tag size={11} className="text-amber-600 shrink-0" />
                            <span className="truncate max-w-[150px]">{resolvedFixVersion}</span>
                          </span>
                        ) : isJira ? (
                          <span className="text-slate-400 italic text-[11px]">Unscheduled</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    )}

                    {/* Resolution Column */}
                    {visibleColumns.resolution !== false && (
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                        {isDone ? (
                          <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Completed
                          </span>
                        ) : (
                          <span className="text-slate-400">Unresolved</span>
                        )}
                      </td>
                    )}

                    {/* Created Date Column */}
                    {visibleColumns.createdDate !== false && (
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {task.createdDate ? formatDate(task.createdDate) : '—'}
                      </td>
                    )}

                    {/* Updated Date Column */}
                    {visibleColumns.updatedDate !== false && (
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                        {task.expectedDelivery ? formatDate(task.expectedDelivery) : (task.createdDate ? formatDate(task.createdDate) : '—')}
                      </td>
                    )}

                    {/* Due Date Column */}
                    {visibleColumns.dueDate !== false && (
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`font-mono text-[11px] ${
                            isOverdue
                              ? 'text-red-700 font-bold bg-red-50 px-1.5 py-0.5 rounded border border-red-200'
                              : 'text-slate-600'
                          }`}
                        >
                          {task.dueDate ? formatDate(task.dueDate) : '—'}
                        </span>
                      </td>
                    )}

                    {/* Fix Version Column */}
                    {visibleColumns.fixVersion !== false && (
                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                        {resolvedFixVersion ? (
                          <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-700 font-semibold">
                            {resolvedFixVersion}
                          </span>
                        ) : task.jiraIssueKey ? (
                          <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {task.jiraIssueKey}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    )}

                    {/* Sprint Column */}
                    {visibleColumns.sprint !== false && (
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {enableQuickActions ? (
                          <div className="relative task-table-dropdown-container">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!hasFieldAccess('canManageSprints')) {
                                  showPermissionDenial('Move Task to Sprint / Backlog', 'Your role does not have permission to plan or manage sprint contents.');
                                  return;
                                }
                                setActiveSprintDropdownId(activeSprintDropdownId === task.id ? null : task.id);
                                setActiveStatusDropdownId(null);
                                setActiveArtistDropdownId(null);
                              }}
                              className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-100 text-left transition-colors cursor-pointer group/sp"
                            >
                              {sprint ? (
                                <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[11px]">
                                  {sprint.name}
                                </span>
                              ) : (
                                <span className="font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                                  Backlog
                                </span>
                              )}
                              <ChevronDown size={11} className="text-slate-400 opacity-0 group-hover/sp:opacity-100" />
                            </button>

                            {/* Sprint Move Dropdown */}
                            {activeSprintDropdownId === task.id && (
                              <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-50 animate-in fade-in duration-100 max-h-64 overflow-y-auto">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                                  Move to Sprint / Backlog
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    moveTaskToBacklog(task.id);
                                    setActiveSprintDropdownId(null);
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg font-semibold flex items-center justify-between cursor-pointer"
                                >
                                  <span>📁 Move to Backlog</span>
                                  {!task.sprintId && <CheckCircle2 size={12} className="text-blue-600" />}
                                </button>
                                {sprints
                                  .filter(sp => sp.status?.toUpperCase() !== 'COMPLETED' || sp.id === task.sprintId)
                                  .map(sp => (
                                    <button
                                      key={sp.id}
                                      type="button"
                                      onClick={() => {
                                        moveTaskToSprint(task.id, sp.id);
                                        setActiveSprintDropdownId(null);
                                      }}
                                      className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-slate-100 rounded-lg flex items-center justify-between cursor-pointer"
                                    >
                                      <span className="font-medium text-slate-800 truncate">
                                        {sp.name} <span className="text-[10px] text-slate-400">({sp.status})</span>
                                      </span>
                                      {task.sprintId === sp.id && (
                                        <CheckCircle2 size={12} className="text-blue-600 shrink-0" />
                                      )}
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span>{sprint ? sprint.name : 'Backlog'}</span>
                        )}
                      </td>
                    )}

                    {/* Story Points Column */}
                    {visibleColumns.storyPoints !== false && (
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 text-[11px]">
                          {task.storyPoints || 0} SP
                        </span>
                      </td>
                    )}

                    {/* Original Estimate Column */}
                    {visibleColumns.originalEstimate !== false && (
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-600">
                        {formatDuration(task.originalEstimate || 0)}
                      </td>
                    )}

                    {/* Time Logged Column */}
                    {visibleColumns.timeLogged !== false && (
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono">
                        <span
                          className={`font-semibold ${
                            (task.timeLogged || 0) > (task.originalEstimate || 0)
                              ? 'text-red-600 font-bold'
                              : 'text-slate-800'
                          }`}
                        >
                          {formatDuration(task.timeLogged || 0)}
                        </span>
                      </td>
                    )}

                    {/* Remaining Estimate Column */}
                    {visibleColumns.remainingEstimate !== false && (
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-600">
                        {formatDuration(task.remainingEstimate ?? task.originalEstimate ?? 0)}
                      </td>
                    )}

                    {/* Project Column */}
                    {visibleColumns.project !== false && (
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {project ? (
                          <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                            {project.name}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    )}

                    {/* Jira Link Column */}
                    {visibleColumns.jiraLink !== false && (
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {task.jiraIssueKey ? (
                          <a
                            href={
                              task.jiraSelfUrl ||
                              (settings?.jiraConfig?.hostUrl
                                ? `${settings.jiraConfig.hostUrl.replace(/\/$/, '')}/browse/${task.jiraIssueKey}`
                                : '#')
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:text-blue-800 font-mono font-bold text-[11px] inline-flex items-center gap-1"
                          >
                            <span>{task.jiraIssueKey}</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                    )}

                    {/* Actions Column */}
                    {visibleColumns.actions !== false && (
                      <td className="py-2.5 px-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (!hasFieldAccess('canLogTime')) {
                                showPermissionDenial('Log Work Time', 'Your role does not have permission to log work time on tasks.');
                                return;
                              }
                              setLogTimeTaskId(task.id);
                            }}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Log Work Time"
                          >
                            <Clock size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectTask(task.id, currentTaskIdsList)}
                            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Inspect Details"
                          >
                            <Eye size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onSelectTask(task.id, currentTaskIdsList, true)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Open in Full Screen Focus Mode"
                          >
                            <Maximize2 size={13} />
                          </button>
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
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              copiedTaskId === task.id
                                ? 'text-emerald-600 bg-emerald-50'
                                : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                            }`}
                            title={copiedTaskId === task.id ? 'Task share link copied!' : 'Copy full-screen share link'}
                          >
                            {copiedTaskId === task.id ? <Check size={13} className="text-emerald-600" /> : <Share2 size={13} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setTaskToDelete(task)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Task"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Responsive Pagination Bar */}
      {enablePagination && sortedTasks.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 bg-white border border-t-0 border-slate-200 rounded-b-xl text-xs text-slate-600 shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Showing <span className="font-bold text-slate-900">{pageSize === -1 ? 1 : Math.min((currentPage - 1) * pageSize + 1, sortedTasks.length)}</span> to{' '}
              <span className="font-bold text-slate-900">{pageSize === -1 ? sortedTasks.length : Math.min(currentPage * pageSize, sortedTasks.length)}</span> of{' '}
              <span className="font-bold text-slate-900">{sortedTasks.length}</span> tasks
            </span>
            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
              <span className="text-slate-400">Page size:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={-1}>All ({sortedTasks.length})</option>
              </select>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="First Page"
              >
                <ChevronsLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Previous Page"
              >
                <ChevronLeft size={14} />
              </button>

              <div className="flex items-center gap-1.5 px-2">
                <span className="font-medium text-slate-600">Page</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => {
                    const p = parseInt(e.target.value, 10);
                    if (!isNaN(p) && p >= 1 && p <= totalPages) setCurrentPage(p);
                  }}
                  className="w-12 text-center py-1 px-1 border border-slate-200 rounded-md font-bold text-slate-900 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-xs"
                />
                <span className="text-slate-400">of <span className="font-bold text-slate-700">{totalPages}</span></span>
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Next Page"
              >
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                title="Last Page"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating Contextual Bulk Action Bar */}
      {enableBulkBar && selectedTaskIds.size > 0 && (
        <ContextualBulkActionBar
          selectedCount={selectedTaskIds.size}
          selectedTaskIds={Array.from(selectedTaskIds)}
          tasks={tasks}
          artists={artists}
          projects={projects}
          sprints={sprints}
          onOpenBulkModal={() => setIsBulkEditModalOpen(true)}
          onQuickStatusChange={async (st) => {
            bulkUpdateTasks(Array.from(selectedTaskIds), { status: st });
            handleClearSelection();
          }}
          onQuickAssignArtist={async (artId) => {
            bulkUpdateTasks(Array.from(selectedTaskIds), { artistId: artId || undefined });
            handleClearSelection();
          }}
          onQuickAssignSprint={async (spId) => {
            Array.from(selectedTaskIds).forEach(id => {
              if (!spId) moveTaskToBacklog(id);
              else moveTaskToSprint(id, spId);
            });
            handleClearSelection();
          }}
          onQuickSyncJira={async () => {
            for (const id of Array.from(selectedTaskIds)) {
              await syncTaskToJira(id, 'Bulk Sync');
            }
            handleClearSelection();
          }}
          onQuickDelete={() => setIsBulkDeleteModalOpen(true)}
          onClearSelection={handleClearSelection}
        />
      )}

      {/* Log Time Modal */}
      {logTimeTaskId && (
        <LogTimeModal
          isOpen={!!logTimeTaskId}
          onClose={() => setLogTimeTaskId(null)}
          task={tasks.find(t => t.id === logTimeTaskId) || null}
        />
      )}

      {/* Blocker Modal */}
      {blockerTaskId && (
        <BlockerModal
          isOpen={!!blockerTaskId}
          onClose={() => setBlockerTaskId(null)}
          task={tasks.find(t => t.id === blockerTaskId) || null}
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
          onApplyBulkEdit={async (updates, ids) => {
            await applyBulkEditTasks(updates, ids);
            setIsBulkEditModalOpen(false);
            handleClearSelection();
          }}
        />
      )}

      {/* Single Task Delete Confirmation Modal */}
      {taskToDelete && (
        <Modal
          isOpen={!!taskToDelete}
          onClose={() => setTaskToDelete(null)}
          title={`Delete Task: ${taskToDelete.id}`}
          maxWidth="sm"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteTask(taskToDelete.id);
                  setTaskToDelete(null);
                }}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Trash2 size={13} />
                <span>Confirm Delete</span>
              </button>
            </div>
          }
        >
          <div className="space-y-2 text-xs text-slate-600">
            <p>
              Are you sure you want to permanently delete task <strong className="text-slate-900">{taskToDelete.id}</strong>?
            </p>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 truncate">
              {taskToDelete.title}
            </div>
            <p className="text-rose-600 text-[11px] font-medium">
              ⚠️ This action cannot be undone and will permanently remove this task from your workspace.
            </p>
          </div>
        </Modal>
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
                onClick={() => {
                  Array.from(selectedTaskIds).forEach(id => {
                    deleteTask(id);
                  });
                  handleClearSelection();
                  setIsBulkDeleteModalOpen(false);
                }}
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
              Are you sure you want to permanently delete these <strong className="text-slate-900">{selectedTaskIds.size}</strong> selected tasks?
            </p>
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50 p-1">
              {tasks
                .filter(t => selectedTaskIds.has(t.id))
                .map(t => (
                  <div key={t.id} className="p-2 flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-slate-700 mr-2">{t.id}</span>
                    <span className="truncate flex-1 text-slate-800">{t.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold ml-2 shrink-0">
                      {t.status}
                    </span>
                  </div>
                ))}
            </div>
            <p className="text-rose-600 text-[11px] font-semibold">
              ⚠️ This action cannot be undone. All selected tasks will be permanently removed.
            </p>
          </div>
        </Modal>
      )}

      {/* Floating Bottom Horizontal Scrollbar docked to viewport bottom */}
      <FloatingTableScrollbar
        containerRef={tableContainerRef}
        tableKey={tableKey}
      />
    </div>
  );
};
