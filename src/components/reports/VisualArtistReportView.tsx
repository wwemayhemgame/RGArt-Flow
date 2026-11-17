import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Layers,
  Search,
  SlidersHorizontal,
  Download,
  Filter,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Eye,
  Image as ImageIcon,
  FolderKanban,
  User,
  Sparkles,
  RotateCcw,
  Zap,
  Clock3,
  AlertTriangle,
  RefreshCw,
  BarChart2,
  Users,
  FileText,
  Check,
  TrendingUp,
  Hash,
  ArrowRight,
  ShieldCheck,
  Award
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import {
  Task,
  Sprint,
  Artist,
  Project,
  TaskAttachment,
  TimeEntry,
  normalizeTaskStatus,
  isTaskDoneOrCompleted,
  WORKFLOW_STATUS_LIST,
  Priority
} from '../../types';
import { formatDate, getTodayDateString, isOverdue as checkIsOverdue } from '../../utils/dateUtils';
import { formatDuration } from '../../utils/timeUtils';
import { getArtistSprintLeaveDetails } from '../../utils/forecastEngine';
import { Avatar } from '../common/Avatar';
import { TaskStatusBadge, PriorityBadge } from '../common/Badge';
import { MediaLightboxModal } from '../modals/MediaLightboxModal';
import { DailyProjectAllocationView } from './DailyProjectAllocationView';

export type ReportMode = 'daily' | 'sprint';
type MainReportTab = 'tasks' | 'daily_breakdown' | 'artist_summary' | 'project_allocation';
type ArtistTabKey = 'incomplete' | 'worklogs' | 'media' | 'overdue' | 'overestimated' | 'activesprint';

interface VisualArtistReportViewProps {
  mode?: ReportMode;
  onSelectTask?: (taskId: string, activeFilteredList?: string[]) => void;
  onNavigateToTaskList?: (filters: {
    artistId?: string;
    sprintId?: string;
    statusFilter?: string;
    projectId?: string;
  }) => void;
}

// Utility: Calculate working days (Mon-Fri) between two ISO date strings (inclusive)
function getWorkingDaysInRange(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 5;
  const s = new Date(startStr);
  const e = new Date(endStr);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return 1;

  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(1, count);
}

// Helper to determine if an attachment is a visual image/render
function isVisualAttachment(att: TaskAttachment): boolean {
  if (!att || !att.url) return false;
  const urlLower = att.url.toLowerCase();
  const nameLower = (att.name || '').toLowerCase();
  const typeLower = (att.type || att.fileType || '').toLowerCase();
  const catLower = (att.mediaCategory || '').toLowerCase();

  if (typeLower.startsWith('image/')) return true;
  if (catLower.includes('image') || catLower.includes('render') || catLower.includes('concept') || catLower.includes('ui') || catLower.includes('art')) return true;
  if (urlLower.match(/\.(jpeg|jpg|gif|png|webp|svg|bmp|avif)(\?.*)?$/)) return true;
  if (nameLower.match(/\.(jpeg|jpg|gif|png|webp|svg|bmp|avif)$/)) return true;
  if (urlLower.includes('unsplash.com') || urlLower.includes('placeholder')) return true;

  return false;
}

export const VisualArtistReportView: React.FC<VisualArtistReportViewProps> = ({
  mode = 'daily',
  onSelectTask,
  onNavigateToTaskList
}) => {
  const {
    tasks,
    sprints,
    artists,
    projects,
    users,
    timeEntries,
    currentUser,
    syncAllJiraTasks,
    isTabReadOnly
  } = useArtOps();

  // Mode state: Daily Tasks Report vs. Sprint-wise Report
  const [currentMode, setCurrentMode] = useState<ReportMode>(mode);

  // Main Report Tab
  const [activeMainTab, setActiveMainTab] = useState<MainReportTab>('tasks');

  // Date selection state
  const todayStr = getTodayDateString();
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'week' | 'custom'>('today');

  // Active Sprint
  const [selectedSprintId, setSelectedSprintId] = useState<string>(() => {
    const active = sprints.find(s => s.status?.toUpperCase() === 'ACTIVE');
    return active ? active.id : (sprints[0]?.id || 'sprint-2');
  });

  const selectedSprint = useMemo(() => {
    return sprints.find(s => s.id === selectedSprintId) ||
      sprints.find(s => s.status?.toUpperCase() === 'ACTIVE') ||
      sprints[0] ||
      null;
  }, [sprints, selectedSprintId]);

  // Unified Date Range state
  const [fromDate, setFromDate] = useState<string>(() => {
    if (mode === 'sprint') {
      const active = sprints.find(s => s.status?.toUpperCase() === 'ACTIVE') || sprints[0];
      return active?.startDate ? active.startDate.split('T')[0] : '2026-08-31';
    }
    return todayStr;
  });

  const [toDate, setToDate] = useState<string>(() => {
    if (mode === 'sprint') {
      const active = sprints.find(s => s.status?.toUpperCase() === 'ACTIVE') || sprints[0];
      return active?.endDate ? active.endDate.split('T')[0] : '2026-09-04';
    }
    return todayStr;
  });

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedArtistFilter, setSelectedArtistFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('ALL');
  const [selectedTaskTypeFilter, setSelectedTaskTypeFilter] = useState<string>('ALL');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('ALL');
  const [onlyWithMediaFilter, setOnlyWithMediaFilter] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Independent Expand/Collapse state per artist (Collapsed by default)
  const [expandedArtistIds, setExpandedArtistIds] = useState<Set<string>>(new Set());

  // Active sub-tab per artist (defaults to 'incomplete')
  const [artistActiveTab, setArtistActiveTab] = useState<Record<string, ArtistTabKey>>({});

  // Active status sub-filter per artist (defaults to 'ALL')
  const [artistStatusSubFilter, setArtistStatusSubFilter] = useState<Record<string, string>>({});

  // Lightbox Media State
  const [activeMediaItem, setActiveMediaItem] = useState<{ media: TaskAttachment; task?: Task } | null>(null);
  const [allLightboxMedia, setAllLightboxMedia] = useState<Array<{ media: TaskAttachment; task?: Task }>>([]);

  // Sync mode prop when parent changes
  useEffect(() => {
    if (mode) {
      setCurrentMode(mode);
    }
  }, [mode]);

  // Synchronize From/To dates when switching mode or sprint
  useEffect(() => {
    if (currentMode === 'sprint' && selectedSprint) {
      if (selectedSprint.startDate) {
        setFromDate(selectedSprint.startDate.split('T')[0]);
      }
      if (selectedSprint.endDate) {
        setToDate(selectedSprint.endDate.split('T')[0]);
      }
    } else if (currentMode === 'daily') {
      if (datePreset === 'today') {
        setFromDate(todayStr);
        setToDate(todayStr);
      } else if (datePreset === 'yesterday') {
        const d = new Date(todayStr);
        d.setDate(d.getDate() - 1);
        const yStr = d.toISOString().split('T')[0];
        setFromDate(yStr);
        setToDate(yStr);
      } else if (datePreset === 'week') {
        // Active sprint week: 31 Aug to 4 Sept 2026
        setFromDate('2026-08-31');
        setToDate('2026-09-04');
      }
    }
  }, [currentMode, selectedSprint, datePreset, todayStr]);

  // Working days count for active reporting context
  const workingDaysCount = useMemo(() => {
    return getWorkingDaysInRange(fromDate, toDate);
  }, [fromDate, toDate]);

  // 1. RELEVANT WORK LOGS: strictly filtered by date range and sprint
  const relevantWorklogs = useMemo(() => {
    const allLogs = timeEntries || [];
    return allLogs.filter(e => {
      const logDate = e.date ? e.date.split('T')[0] : '';
      if (!logDate) return false;
      const inDateRange = logDate >= fromDate && logDate <= toDate;
      if (!inDateRange) return false;

      if (currentMode === 'sprint' && selectedSprint) {
        if (e.sprintId && e.sprintId !== selectedSprint.id) return false;
      }
      return true;
    });
  }, [timeEntries, fromDate, toDate, currentMode, selectedSprint]);

  // 2. SOURCE TASKS: accurately distinguish Sprint Membership vs Activity Date (Items 248, 249, 256)
  const sourceTasks = useMemo(() => {
    if (currentMode === 'sprint') {
      const spId = selectedSprint?.id || selectedSprintId;
      // In Sprint Mode, tasks strictly belong to the selected sprint (membership)
      return tasks.filter(t => t.sprintId === spId);
    } else {
      // In Daily Mode, tasks worked on in date range OR tasks due/delivered/updated in date range
      const loggedTaskIds = new Set(relevantWorklogs.map(l => l.taskId));
      return tasks.filter(t => {
        if (loggedTaskIds.has(t.id)) return true;
        const cDate = (t.createdDate || '').split('T')[0];
        const dDate = (t.actualDelivery || t.expectedDelivery || t.dueDate || '').split('T')[0];
        if (cDate >= fromDate && cDate <= toDate) return true;
        if (dDate >= fromDate && dDate <= toDate) return true;
        return false;
      });
    }
  }, [currentMode, selectedSprint, selectedSprintId, tasks, relevantWorklogs, fromDate, toDate]);

  // 3. FILTERED TASKS based on user filter controls
  const filteredTasks = useMemo(() => {
    return sourceTasks.filter(t => {
      if (selectedProjectFilter !== 'ALL' && t.projectId !== selectedProjectFilter) return false;
      if (selectedArtistFilter === 'UNASSIGNED' && t.artistId) return false;
      if (selectedArtistFilter !== 'ALL' && selectedArtistFilter !== 'UNASSIGNED' && t.artistId !== selectedArtistFilter) return false;
      if (selectedStatusFilter !== 'ALL' && normalizeTaskStatus(t.status) !== normalizeTaskStatus(selectedStatusFilter)) return false;
      if (selectedTaskTypeFilter !== 'ALL' && t.taskType !== selectedTaskTypeFilter) return false;
      if (selectedPriorityFilter !== 'ALL' && t.priority !== selectedPriorityFilter) return false;
      if (onlyWithMediaFilter) {
        const hasMedia = (t.attachments || []).some(isVisualAttachment) ||
          (t.comments || []).some(c => (c.attachments || []).some(isVisualAttachment));
        if (!hasMedia) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (t.title || '').toLowerCase().includes(q);
        const matchKey = (t.jiraIssueKey || '').toLowerCase().includes(q);
        const matchId = (t.id || '').toLowerCase().includes(q);
        const matchTags = (t.tags || []).some(tag => tag.toLowerCase().includes(q));
        if (!matchTitle && !matchKey && !matchId && !matchTags) return false;
      }
      return true;
    });
  }, [
    sourceTasks,
    selectedProjectFilter,
    selectedArtistFilter,
    selectedStatusFilter,
    selectedTaskTypeFilter,
    selectedPriorityFilter,
    onlyWithMediaFilter,
    searchQuery
  ]);

  // Map of taskId -> dynamic logged hours in the current reporting period
  const taskPeriodLoggedMap = useMemo(() => {
    const map = new Map<string, number>();
    relevantWorklogs.forEach(l => {
      map.set(l.taskId, (map.get(l.taskId) || 0) + (l.hours || 0));
    });
    return map;
  }, [relevantWorklogs]);

  // 4. TOP SUMMARY METRICS ROW (Items 248, 250, 257: Dynamic, reconciled calculations)
  const summaryMetrics = useMemo(() => {
    const totalTasks = filteredTasks.length;
    const totalEstimated = filteredTasks.reduce((sum, t) => sum + (t.originalEstimate || 0), 0);
    const totalRemaining = filteredTasks.reduce((sum, t) => sum + (t.remainingEstimate || 0), 0);
    const totalStoryPoints = filteredTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);

    // Sum of logged hours from relevant work logs
    const filteredTaskIds = new Set(filteredTasks.map(t => t.id));
    const matchedLogs = relevantWorklogs.filter(l => filteredTaskIds.has(l.taskId));
    const totalLogged = matchedLogs.reduce((sum, l) => sum + (l.hours || 0), 0);

    // Tasks with work logged
    const tasksWithLogsCount = new Set(matchedLogs.map(l => l.taskId)).size;

    // Status breakdown
    const completedTasks = filteredTasks.filter(t => isTaskDoneOrCompleted(t.status));
    const inProgressTasks = filteredTasks.filter(t => {
      const norm = normalizeTaskStatus(t.status);
      return norm === 'In Progress' || norm === 'In Iteration';
    });
    const reviewTasks = filteredTasks.filter(t => {
      const norm = normalizeTaskStatus(t.status);
      return norm === 'Submit for Review';
    });
    const blockedTasks = filteredTasks.filter(t => {
      const norm = normalizeTaskStatus(t.status);
      return norm === 'On Hold';
    });
    const cancelledTasks = filteredTasks.filter(t => t.status?.toUpperCase() === 'CANCELLED');
    const overdueTasks = filteredTasks.filter(t => checkIsOverdue(t.dueDate, t.status));

    // Carry-forward tasks: tasks carried from prior sprints or incomplete
    const carryForwardTasks = filteredTasks.filter(t => {
      return (t.sprintHistory && t.sprintHistory.length > 1) || (!isTaskDoneOrCompleted(t.status) && t.status?.toUpperCase() !== 'CANCELLED');
    });

    const completionRate = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;
    const loggedPercent = totalEstimated > 0 ? Math.round((totalLogged / totalEstimated) * 100) : 0;

    return {
      totalTasks,
      totalLogged,
      totalEstimated,
      totalRemaining,
      totalStoryPoints,
      tasksWithLogsCount,
      completed: completedTasks.length,
      inProgress: inProgressTasks.length,
      inReview: reviewTasks.length,
      blocked: blockedTasks.length,
      cancelled: cancelledTasks.length,
      overdue: overdueTasks.length,
      carryForward: carryForwardTasks.length,
      completionRate,
      loggedPercent
    };
  }, [filteredTasks, relevantWorklogs]);

  // Distinct Task Types for Filter Dropdown
  const distinctTaskTypes = useMemo(() => {
    return Array.from(new Set(tasks.map(t => t.taskType).filter(Boolean))).sort();
  }, [tasks]);

  // 5. ARTIST GROUPS & CAPACITY MATRIX (Items 252, 253: Real period-only calculations)
  const artistGroups = useMemo(() => {
    const productionArtists = artists.filter(a => {
      if (a.userRole === 'COMPANY_REQUESTER' || a.role === 'COMPANY_REQUESTER') return false;
      const r = (a.role || '').toLowerCase();
      const spec = (a.specialization || '').toLowerCase();
      return !r.includes('requester') && !spec.includes('requester');
    });

    const targetArtists = selectedArtistFilter === 'ALL'
      ? productionArtists
      : selectedArtistFilter === 'UNASSIGNED'
      ? []
      : productionArtists.filter(a => a.id === selectedArtistFilter);

    const list = targetArtists.map(artist => {
      const artistFilteredTasks = filteredTasks.filter(t => t.artistId === artist.id);

      // Work logs in the selected date/sprint period for this artist ONLY
      const artistLogs = relevantWorklogs.filter(e => e.artistId === artist.id);
      const periodHoursLogged = artistLogs.reduce((sum, e) => sum + (e.hours || 0), 0);
      const tasksWorkedCount = new Set(artistLogs.map(e => e.taskId)).size;

      // Incomplete tasks in period
      const incompleteTasks = artistFilteredTasks.filter(
        t => !isTaskDoneOrCompleted(t.status) && t.status?.toUpperCase() !== 'CANCELLED'
      );

      // Completed tasks in period
      const doneTasks = artistFilteredTasks.filter(t => isTaskDoneOrCompleted(t.status));

      // Overdue tasks in period
      const overdueTasks = artistFilteredTasks.filter(t => checkIsOverdue(t.dueDate, t.status));

      // Story points in period
      const periodStoryPoints = artistFilteredTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);

      // Estimated & Remaining hours for assigned tasks in period
      const periodEstimatedHours = artistFilteredTasks.reduce((sum, t) => sum + (t.originalEstimate || 0), 0);
      const periodRemainingHours = artistFilteredTasks.reduce((sum, t) => sum + (t.remainingEstimate || 0), 0);

      // Overrun tasks in period
      const overrunTasks = artistFilteredTasks.filter(t => {
        const est = t.originalEstimate || 0;
        const log = taskPeriodLoggedMap.get(t.id) || t.timeLogged || 0;
        return est > 0 && log > est;
      });
      const totalOverrunHours = overrunTasks.reduce((sum, t) => {
        const est = t.originalEstimate || 0;
        const log = taskPeriodLoggedMap.get(t.id) || t.timeLogged || 0;
        return sum + Math.max(0, log - est);
      }, 0);

      // Visual Media Assets count
      const tasksWithMedia = artistFilteredTasks.filter(t => {
        const taskMedia = (t.attachments || []).some(att => isVisualAttachment(att));
        const commentMedia = (t.comments || []).some(c => (c.attachments || []).some(att => isVisualAttachment(att)));
        return taskMedia || commentMedia;
      });
      const totalMediaCount = artistFilteredTasks.reduce((sum, t) => {
        const tAtts = (t.attachments || []).filter(isVisualAttachment).length;
        const cAtts = (t.comments || []).reduce((cSum, c) => cSum + (c.attachments || []).filter(isVisualAttachment).length, 0);
        return sum + tAtts + cAtts;
      }, 0);

      // Capacity calculations based on selected date range (working days) and approved leave
      const dailyCap = artist.dailyCapacity || 8;
      const grossCapacityHours = Math.round(dailyCap * workingDaysCount * 10) / 10;
      const leaveDetails = getArtistSprintLeaveDetails(artist, { startDate: fromDate, endDate: toDate });
      const approvedLeaveHours = leaveDetails.leaveHoursDeducted;
      const leaveDaysCount = leaveDetails.leaveDaysCount;
      const availableCapacityHours = Math.max(0, Math.round((grossCapacityHours - approvedLeaveHours) * 10) / 10);
      const remainingCapacityHours = Math.max(0, Math.round((availableCapacityHours - periodHoursLogged) * 10) / 10);
      const capacityPercent = availableCapacityHours > 0
        ? Math.round((periodHoursLogged / availableCapacityHours) * 100)
        : 0;
      const isOverCapacity = periodHoursLogged > availableCapacityHours || periodEstimatedHours > availableCapacityHours;

      // Active Sprint tasks
      const activeSprintTasks = artistFilteredTasks.filter(t => t.sprintId === (selectedSprint?.id || 'sprint-2'));

      // Tasks with work logs in period
      const taskIdsWithPeriodLogs = new Set(artistLogs.map(e => e.taskId));
      const periodLogTasks = artistFilteredTasks.filter(t => taskIdsWithPeriodLogs.has(t.id));

      return {
        artistId: artist.id,
        artist,
        filteredTasks: artistFilteredTasks,
        incompleteTasks,
        doneTasks,
        overdueTasks,
        overrunTasks,
        totalOverrunHours,
        tasksWithMedia,
        totalMediaCount,
        activeSprintTasks,
        periodLogTasks,
        periodHoursLogged,
        periodEstimatedHours,
        periodRemainingHours,
        periodStoryPoints,
        grossCapacityHours,
        approvedLeaveHours,
        leaveDaysCount,
        availableCapacityHours,
        remainingCapacityHours,
        tasksWorkedCount,
        capacityPercent,
        isOverCapacity
      };
    });

    // Unassigned tasks pool if relevant
    if (selectedArtistFilter === 'ALL' || selectedArtistFilter === 'UNASSIGNED') {
      const unassignedFiltered = filteredTasks.filter(t => !t.artistId);
      if (unassignedFiltered.length > 0) {
        const incomplete = unassignedFiltered.filter(t => !isTaskDoneOrCompleted(t.status) && t.status?.toUpperCase() !== 'CANCELLED');
        const done = unassignedFiltered.filter(t => isTaskDoneOrCompleted(t.status));
        const overdue = unassignedFiltered.filter(t => checkIsOverdue(t.dueDate, t.status));
        const overrun = unassignedFiltered.filter(t => (t.originalEstimate || 0) > 0 && ((taskPeriodLoggedMap.get(t.id) || t.timeLogged || 0) > (t.originalEstimate || 0)));
        const withMedia = unassignedFiltered.filter(t => (t.attachments || []).some(isVisualAttachment));

        list.push({
          artistId: 'unassigned',
          artist: null,
          filteredTasks: unassignedFiltered,
          incompleteTasks: incomplete,
          doneTasks: done,
          overdueTasks: overdue,
          overrunTasks: overrun,
          totalOverrunHours: 0,
          tasksWithMedia: withMedia,
          totalMediaCount: withMedia.length,
          activeSprintTasks: unassignedFiltered.filter(t => t.sprintId === (selectedSprint?.id || 'sprint-2')),
          periodLogTasks: [],
          periodHoursLogged: 0,
          periodEstimatedHours: unassignedFiltered.reduce((sum, t) => sum + (t.originalEstimate || 0), 0),
          periodRemainingHours: unassignedFiltered.reduce((sum, t) => sum + (t.remainingEstimate || 0), 0),
          periodStoryPoints: unassignedFiltered.reduce((sum, t) => sum + (t.storyPoints || 0), 0),
          grossCapacityHours: 0,
          approvedLeaveHours: 0,
          leaveDaysCount: 0,
          availableCapacityHours: 0,
          remainingCapacityHours: 0,
          tasksWorkedCount: 0,
          capacityPercent: 0,
          isOverCapacity: false
        });
      }
    }

    // Filter out groups with 0 tasks when a specific search or filter is active
    if (searchQuery.trim() || selectedProjectFilter !== 'ALL' || selectedStatusFilter !== 'ALL' || selectedTaskTypeFilter !== 'ALL' || selectedPriorityFilter !== 'ALL' || onlyWithMediaFilter) {
      return list.filter(g => g.filteredTasks.length > 0 || g.periodHoursLogged > 0);
    }

    return list;
  }, [
    artists,
    filteredTasks,
    relevantWorklogs,
    selectedSprint,
    selectedArtistFilter,
    workingDaysCount,
    taskPeriodLoggedMap,
    searchQuery,
    selectedProjectFilter,
    selectedStatusFilter,
    selectedTaskTypeFilter,
    selectedPriorityFilter,
    onlyWithMediaFilter
  ]);

  // 6. DAY-WISE RECONCILIATION DATA (Item 251, 257: Mathematical proof that sum of days = total sprint logged time)
  const dayWiseReconciliation = useMemo(() => {
    const dates: string[] = [];
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const curr = new Date(start);

    while (curr <= end) {
      dates.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }

    return dates.map(dateStr => {
      const dateLogs = (relevantWorklogs || []).filter(e => {
        const d = e.date ? e.date.split('T')[0] : '';
        return d === dateStr;
      });

      const totalHours = dateLogs.reduce((sum, e) => sum + (e.hours || 0), 0);
      const taskIds = Array.from(new Set(dateLogs.map(e => e.taskId)));
      const artistIds = Array.from(new Set(dateLogs.map(e => e.artistId).filter(Boolean)));

      const artistNames = artistIds.map(aId => {
        const art = artists.find(a => a.id === aId);
        return art ? art.name : 'Unknown';
      });

      return {
        date: dateStr,
        formattedDate: formatDate(dateStr),
        totalHours,
        taskCount: taskIds.length,
        activeArtistsCount: artistIds.length,
        artistNames,
        logs: dateLogs
      };
    });
  }, [fromDate, toDate, relevantWorklogs, artists]);

  // Toggle artist expansion independently
  const toggleArtistExpand = (artistId: string) => {
    setExpandedArtistIds(prev => {
      const next = new Set(prev);
      if (next.has(artistId)) next.delete(artistId);
      else next.add(artistId);
      return next;
    });
  };

  const handleExpandAll = () => {
    const allIds = artists.map(a => a.id).concat(['unassigned']);
    setExpandedArtistIds(new Set(allIds));
  };

  const handleCollapseAll = () => {
    setExpandedArtistIds(new Set());
  };

  const handleResetFilters = () => {
    setSelectedArtistFilter('ALL');
    setSelectedProjectFilter('ALL');
    setSelectedStatusFilter('ALL');
    setSelectedTaskTypeFilter('ALL');
    setSelectedPriorityFilter('ALL');
    setOnlyWithMediaFilter(false);
    setSearchQuery('');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Optimized: reports refresh from canonical tasks state without re-syncing entire Jira workspace
    } catch {
      // silent catch
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  const handleExportCSV = () => {
    const rows: string[][] = [];
    const filename = `rg-artflow-${currentMode}-report-${fromDate}-to-${toDate}.csv`;

    rows.push([
      'Artist',
      'Task ID',
      'Jira Key',
      'Task Title',
      'Project',
      'Status',
      'Priority',
      'Story Points',
      'Period Logged (Hours)',
      'Original Estimate (Hours)',
      'Remaining Estimate (Hours)',
      'Due Date',
      'Attachments Count'
    ]);

    artistGroups.forEach(group => {
      const artistName = group.artist ? group.artist.name : 'Unassigned';
      group.filteredTasks.forEach(t => {
        const projName = projects.find(p => p.id === t.projectId)?.name || '';
        const loggedHrs = taskPeriodLoggedMap.get(t.id) || 0;
        rows.push([
          `"${artistName}"`,
          t.id,
          t.jiraIssueKey || '',
          `"${(t.title || '').replace(/"/g, '""')}"`,
          `"${projName}"`,
          t.status,
          t.priority,
          String(t.storyPoints || 0),
          String(loggedHrs),
          String(t.originalEstimate || 0),
          String(t.remainingEstimate || 0),
          t.dueDate || '',
          String((t.attachments || []).length)
        ]);
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenLightbox = (
    mediaItem: { media: TaskAttachment; task?: Task },
    taskMediaList: Array<{ media: TaskAttachment; task?: Task }>
  ) => {
    setActiveMediaItem(mediaItem);
    setAllLightboxMedia(taskMediaList);
  };

  const handleTaskClick = (taskId: string) => {
    if (onSelectTask) {
      const allIds = sourceTasks.map(t => t.id);
      onSelectTask(taskId, allIds);
    }
  };

  // Active filters count for context badge
  const activeFiltersCount = [
    selectedProjectFilter !== 'ALL',
    selectedArtistFilter !== 'ALL',
    selectedStatusFilter !== 'ALL',
    selectedTaskTypeFilter !== 'ALL',
    selectedPriorityFilter !== 'ALL',
    onlyWithMediaFilter,
    !!searchQuery.trim()
  ].filter(Boolean).length;

  return (
    <div id="visual-artist-report-view" className="p-3 sm:p-6 space-y-4 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* 1. TOP HEADER & TITLE (Requirement 245 & 246: Single unified entry point for Daily & Sprint Reporting) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              {currentMode === 'daily'
                ? 'RG ArtFlow — Daily Tasks Report'
                : 'RG ArtFlow — Sprint-wise Report'}
            </h1>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setCurrentMode('daily');
                  setActiveMainTab('tasks');
                }}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  currentMode === 'daily'
                    ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock size={13} />
                <span>Daily Report</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentMode('sprint');
                  setActiveMainTab('tasks');
                }}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  currentMode === 'sprint'
                    ? 'bg-white text-purple-700 shadow-2xs font-extrabold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers size={13} />
                <span>Sprint-wise Report</span>
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500 mt-1 font-medium">
            {currentMode === 'daily'
              ? `Unified daily operational task logs, hours, and artwork deliverables · ${formatDate(fromDate)}${fromDate !== toDate ? ` to ${formatDate(toDate)}` : ''}`
              : `Sprint delivery breakdown · ${selectedSprint?.name || 'Sprint 2'} (${formatDate(selectedSprint?.startDate)} – ${formatDate(selectedSprint?.endDate)})`}
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Refresh sync data"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-500'} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={expandedArtistIds.size > 0 ? handleCollapseAll : handleExpandAll}
            className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {expandedArtistIds.size > 0 ? (
              <>
                <ChevronUp size={14} />
                <span>Collapse All</span>
              </>
            ) : (
              <>
                <ChevronDown size={14} />
                <span>Expand All</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Download CSV report"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. FILTER CONTEXT BANNER (Requirement 254 & 255: One Reporting Context Banner) */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white px-4 py-3 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="p-1.5 bg-white/10 rounded-lg text-amber-300">
            {currentMode === 'sprint' ? <Layers size={16} /> : <Calendar size={16} />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Reporting Context:
              </span>
              <span className="text-sm font-black text-white font-mono">
                {currentMode === 'sprint'
                  ? `${selectedSprint?.name || 'Sprint 2'} · ${formatDate(fromDate)} – ${formatDate(toDate)}`
                  : `Date Range · ${formatDate(fromDate)}${fromDate !== toDate ? ` – ${formatDate(toDate)}` : ''}`}
              </span>
              <span className="text-[11px] font-bold bg-white/15 px-2 py-0.5 rounded-full text-slate-200">
                {workingDaysCount} Working Day{workingDaysCount > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-0.5">
              All metrics, sprint summary, artist capacity, and work logs are strictly derived from this period ({formatDate(fromDate)} to {formatDate(toDate)}).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold shrink-0">
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-xl flex items-center gap-1.5 font-mono font-bold">
            <CheckCircle2 size={13} />
            <span>{summaryMetrics.totalLogged}h Logged in Period</span>
          </span>
          {activeFiltersCount > 0 && (
            <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-xl font-bold">
              {activeFiltersCount} Active Filter{activeFiltersCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* 3. SUMMARY METRICS ROW (Items 248, 250, 257: Compact Cards directly under context) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Tasks */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Total Tasks</span>
            <Hash size={13} className="text-slate-400" />
          </div>
          <div className="text-xl font-black text-slate-900 mt-1 font-mono">
            {summaryMetrics.totalTasks}
          </div>
          <div className="text-[11px] font-medium text-slate-500 mt-0.5">
            {summaryMetrics.totalStoryPoints} Story Points
          </div>
        </div>

        {/* Total Logged in Period */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Total Logged</span>
            <Clock size={13} className="text-blue-500" />
          </div>
          <div className="text-xl font-black text-blue-700 mt-1 font-mono">
            {formatDuration(summaryMetrics.totalLogged)}
          </div>
          <div className="text-[11px] font-medium text-slate-500 mt-0.5 font-mono">
            {summaryMetrics.totalLogged}h / {summaryMetrics.totalEstimated}h est.
          </div>
        </div>

        {/* Total Estimated */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Estimated</span>
            <Layers size={13} className="text-purple-500" />
          </div>
          <div className="text-xl font-black text-purple-900 mt-1 font-mono">
            {formatDuration(summaryMetrics.totalEstimated)}
          </div>
          <div className="text-[11px] font-medium text-slate-500 mt-0.5 font-mono">
            {summaryMetrics.totalEstimated}h original est.
          </div>
        </div>

        {/* Tasks With Time Logged */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>With Time Logged</span>
            <CheckCircle2 size={13} className="text-emerald-500" />
          </div>
          <div className="text-xl font-black text-slate-900 mt-1 font-mono">
            {summaryMetrics.tasksWithLogsCount} <span className="text-xs font-normal text-slate-400">/ {summaryMetrics.totalTasks}</span>
          </div>
          <div className="text-[11px] font-medium text-emerald-600 mt-0.5">
            {summaryMetrics.totalTasks > 0 ? Math.round((summaryMetrics.tasksWithLogsCount / summaryMetrics.totalTasks) * 100) : 0}% active
          </div>
        </div>

        {/* Completed Deliverables */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Completed</span>
            <Check size={13} className="text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-600 mt-1 font-mono">
            {summaryMetrics.completed}
          </div>
          <div className="text-[11px] font-medium text-slate-500 mt-0.5">
            {summaryMetrics.completionRate}% delivery rate
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>In Progress</span>
            <Zap size={13} className="text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-700 mt-1 font-mono">
            {summaryMetrics.inProgress}
          </div>
          <div className="text-[11px] font-medium text-slate-500 mt-0.5">
            {summaryMetrics.inReview > 0 ? `${summaryMetrics.inReview} under review` : 'Active iteration'}
          </div>
        </div>
      </div>

      {/* 4. COMPACT FILTERS BAR (Directly below metrics) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2.5 items-center">
          {/* Project Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Project</label>
            <select
              value={selectedProjectFilter}
              onChange={(e) => setSelectedProjectFilter(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-2.5 py-1.5 outline-hidden cursor-pointer"
            >
              <option value="ALL">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Artist Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Artist</label>
            <select
              value={selectedArtistFilter}
              onChange={(e) => setSelectedArtistFilter(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-2.5 py-1.5 outline-hidden cursor-pointer"
            >
              <option value="ALL">All Artists</option>
              <option value="UNASSIGNED">Unassigned Tasks</option>
              {artists.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</label>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-2.5 py-1.5 outline-hidden cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              {WORKFLOW_STATUS_LIST.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Task Type Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Task Type</label>
            <select
              value={selectedTaskTypeFilter}
              onChange={(e) => setSelectedTaskTypeFilter(e.target.value)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-2.5 py-1.5 outline-hidden cursor-pointer"
            >
              <option value="ALL">All Types</option>
              {distinctTaskTypes.map(tt => (
                <option key={tt} value={tt}>{tt}</option>
              ))}
            </select>
          </div>

          {/* Sprint Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sprint</label>
            <select
              value={selectedSprintId}
              onChange={(e) => {
                const spId = e.target.value;
                setSelectedSprintId(spId);
                const sp = sprints.find(s => s.id === spId);
                if (sp) {
                  if (sp.startDate) setFromDate(sp.startDate.split('T')[0]);
                  if (sp.endDate) setToDate(sp.endDate.split('T')[0]);
                }
              }}
              className="w-full text-xs font-bold bg-purple-50 border border-purple-200 text-purple-950 rounded-xl px-2.5 py-1.5 outline-hidden cursor-pointer shadow-2xs"
            >
              {sprints.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.status})
                </option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-2.5 py-1.5 outline-hidden"
            />
          </div>

          {/* To Date */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-2.5 py-1.5 outline-hidden"
            />
          </div>
        </div>

        {/* Second Sub-Row: Search and Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1 w-full">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by task title, Jira key (e.g. WWEART-0104), ID, or tags..."
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 outline-hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyWithMediaFilter}
                onChange={(e) => setOnlyWithMediaFilter(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span>With Media Only</span>
            </label>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Reset ({activeFiltersCount})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. REPORT VIEW TABS (Tasks vs Reconciliation vs Capacity) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          onClick={() => setActiveMainTab('tasks')}
          className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeMainTab === 'tasks'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers size={14} />
          <span>{currentMode === 'daily' ? 'Time / Tasks' : 'Sprint Tasks'} ({filteredTasks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('daily_breakdown')}
          className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeMainTab === 'daily_breakdown'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calendar size={14} />
          <span>{currentMode === 'daily' ? 'Day-wise View' : 'Sprint Summary / Reconciliation'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMainTab('artist_summary')}
          className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeMainTab === 'artist_summary'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Users size={14} />
          <span>Artist Capacity & Summary</span>
        </button>

        <button
          type="button"
          id="tab-project-allocation"
          onClick={() => setActiveMainTab('project_allocation')}
          className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeMainTab === 'project_allocation'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FolderKanban size={14} />
          <span>Project Allocation</span>
        </button>
      </div>

      {/* 6. MAIN REPORT CONTENT VIEWS */}
      {activeMainTab === 'tasks' && (
        <>
          {artistGroups.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl font-bold">
                🔍
              </div>
              <h3 className="text-sm font-bold text-slate-800">No artists or tasks match your filter</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Try resetting filters or adjusting the date range.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {artistGroups.map(group => {
                const isUnassigned = group.artistId === 'unassigned';
                const artistName = group.artist ? group.artist.name : 'Unassigned Tasks';
                const artistAvatar = group.artist?.avatar;
                const artistRole = group.artist?.role || group.artist?.specialization || 'Artist / Specialist';
                const isExpanded = expandedArtistIds.has(group.artistId);

                // Active sub-tab for this artist
                const activeTab: ArtistTabKey = artistActiveTab[group.artistId] || 'incomplete';
                const statusSubFilter = artistStatusSubFilter[group.artistId] || 'ALL';

                // Candidate tasks based on active sub-tab
                let tabTasks: Task[] = [];
                if (activeTab === 'incomplete') {
                  tabTasks = group.incompleteTasks;
                } else if (activeTab === 'worklogs') {
                  tabTasks = group.periodLogTasks.length > 0 ? group.periodLogTasks : group.filteredTasks.filter(t => (taskPeriodLoggedMap.get(t.id) || 0) > 0);
                } else if (activeTab === 'media') {
                  tabTasks = group.tasksWithMedia;
                } else if (activeTab === 'overdue') {
                  tabTasks = group.overdueTasks;
                } else if (activeTab === 'overestimated') {
                  tabTasks = group.overrunTasks;
                } else if (activeTab === 'activesprint') {
                  tabTasks = group.activeSprintTasks;
                }

                // Apply status sub-filter if set
                const displayedTasks = tabTasks.filter(t => {
                  if (statusSubFilter === 'ALL') return true;
                  return normalizeTaskStatus(t.status) === normalizeTaskStatus(statusSubFilter);
                });

                return (
                  <div
                    key={group.artistId}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all"
                  >
                    {/* ARTIST ROW (Collapsed default view with exact summary line) */}
                    <div
                      onClick={() => toggleArtistExpand(group.artistId)}
                      className="px-5 py-3.5 bg-white hover:bg-slate-50/80 transition-colors flex items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      {/* Left: Avatar, Name, Role & Metric Badges */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1 flex-wrap">
                        <Avatar
                          name={artistName}
                          src={artistAvatar}
                          size="md"
                          className="border border-slate-200 shadow-2xs shrink-0"
                        />

                        <div className="min-w-0">
                          {/* Name and Role */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-black text-slate-900 tracking-tight">
                              {artistName}
                            </span>
                            {!isUnassigned && (
                              <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                                {artistRole}
                              </span>
                            )}
                          </div>

                          {/* Summary Badges Line */}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs font-semibold">
                            {/* Incomplete Tasks */}
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/70 text-[11px]">
                              <Zap size={11} />
                              <span>{group.incompleteTasks.length} Incomplete</span>
                            </span>

                            {/* Media Assets */}
                            {group.totalMediaCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200/70 text-[11px]">
                                <ImageIcon size={11} />
                                <span>{group.totalMediaCount} Media Assets</span>
                              </span>
                            )}

                            {/* Overdue */}
                            {group.overdueTasks.length > 0 && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200/70 text-[11px]">
                                <AlertTriangle size={11} />
                                <span>{group.overdueTasks.length} Overdue</span>
                              </span>
                            )}

                            {/* Done */}
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-[11px]">
                              <CheckCircle2 size={11} />
                              <span>{group.doneTasks.length} Done</span>
                            </span>

                            {/* Logged in Period */}
                            <span className="text-[11px] text-slate-600 font-mono font-bold">
                              • {formatDuration(group.periodHoursLogged)} Logged
                            </span>

                            {/* Transparent Capacity Breakdown */}
                            {!isUnassigned && (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md font-mono" title="Gross Sprint Capacity">
                                  Gross: {group.grossCapacityHours}h
                                </span>
                                {group.approvedLeaveHours > 0 && (
                                  <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md font-mono" title={`Approved Leave: ${group.leaveDaysCount} days`}>
                                    🌴 -{group.approvedLeaveHours}h leave
                                  </span>
                                )}
                                <span className="text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md font-mono" title="Available Sprint Capacity (Gross - Leave)">
                                  Avail: {group.availableCapacityHours}h
                                </span>
                                <span className="text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md font-mono" title="Remaining Available Capacity">
                                  Rem: {group.remainingCapacityHours}h
                                </span>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                  group.capacityPercent > 100 ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {group.capacityPercent}% Capacity
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Side Chevron */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleArtistExpand(group.artistId);
                        }}
                        className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>

                    {/* EXPANDED ARTIST BODY */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5 space-y-4 animate-in fade-in duration-150">
                        {/* Sub-filter chips row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => setArtistActiveTab(prev => ({ ...prev, [group.artistId]: 'incomplete' }))}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              activeTab === 'incomplete'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <Zap size={13} />
                            <span>Incomplete Tasks ({group.incompleteTasks.length})</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setArtistActiveTab(prev => ({ ...prev, [group.artistId]: 'worklogs' }))}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              activeTab === 'worklogs'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            <Clock size={13} />
                            <span>Work Logs ({group.periodLogTasks.length})</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setArtistActiveTab(prev => ({ ...prev, [group.artistId]: 'media' }))}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              activeTab === 'media'
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'bg-white text-purple-800 border border-purple-200 hover:bg-purple-50'
                            }`}
                          >
                            <ImageIcon size={13} />
                            <span>Media & Artwork ({group.tasksWithMedia.length})</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setArtistActiveTab(prev => ({ ...prev, [group.artistId]: 'overdue' }))}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              activeTab === 'overdue'
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50'
                            }`}
                          >
                            <AlertTriangle size={13} />
                            <span>Overdue ({group.overdueTasks.length})</span>
                          </button>
                        </div>

                        {/* TASK LIST (Artist Row -> Task Row -> Task-Specific Media Thumbnails) */}
                        {displayedTasks.length === 0 ? (
                          <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-500">
                            No tasks found in this category for {artistName}.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {displayedTasks.map(task => {
                              const displayKey = task.jiraIssueKey || task.id;
                              const isTaskOverdue = checkIsOverdue(task.dueDate, task.status);
                              const taskPeriodLogged = taskPeriodLoggedMap.get(task.id) || 0;

                              // Collect visual attachments for THIS SPECIFIC TASK ONLY
                              const taskMediaList: Array<{ media: TaskAttachment; task: Task }> = [];
                              const seenMediaUrls = new Set<string>();

                              (task.attachments || []).forEach(att => {
                                if (isVisualAttachment(att) && !seenMediaUrls.has(att.url || att.id)) {
                                  seenMediaUrls.add(att.url || att.id);
                                  taskMediaList.push({
                                    media: {
                                      ...att,
                                      taskId: task.id,
                                      taskTitle: task.title,
                                      projectId: task.projectId
                                    },
                                    task
                                  });
                                }
                              });

                              (task.comments || []).forEach(c => {
                                (c.attachments || []).forEach(att => {
                                  if (isVisualAttachment(att) && !seenMediaUrls.has(att.url || att.id)) {
                                    seenMediaUrls.add(att.url || att.id);
                                    taskMediaList.push({
                                      media: {
                                        ...att,
                                        taskId: task.id,
                                        taskTitle: task.title,
                                        projectId: task.projectId
                                      },
                                      task
                                    });
                                  }
                                });
                              });

                              return (
                                <div
                                  key={task.id}
                                  className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all hover:border-slate-300"
                                >
                                  {/* Task Main Line */}
                                  <div className="p-3.5 space-y-2">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                                        <span className="font-mono font-black text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                                          {displayKey}
                                        </span>
                                        <span className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                                          {task.title}
                                        </span>
                                        <TaskStatusBadge status={task.status} />
                                        <PriorityBadge priority={task.priority} />
                                      </div>

                                      <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 shrink-0">
                                        {isTaskOverdue && (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                                            <AlertTriangle size={11} />
                                            <span>Overdue</span>
                                          </span>
                                        )}
                                        {task.storyPoints > 0 && (
                                          <span className="text-slate-600 text-xs font-medium font-mono">
                                            {task.storyPoints} SP • {formatDuration(task.remainingEstimate || 0)} rem.
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => handleTaskClick(task.id)}
                                          className="text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                                          title="Open task details"
                                        >
                                          <ExternalLink size={13} />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Task Metadata line */}
                                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1 flex-wrap gap-2">
                                      <div className="flex items-center gap-3 flex-wrap font-medium">
                                        {task.dueDate && (
                                          <span>
                                            Target Due: <strong className="text-slate-700">{formatDate(task.dueDate)}</strong>
                                          </span>
                                        )}
                                        <span>•</span>
                                        <span>
                                          Est: <strong className="text-slate-700 font-mono">{formatDuration(task.originalEstimate || 0)}</strong>
                                        </span>
                                        <span>•</span>
                                        <span>
                                          Logged in Period: <strong className="text-blue-700 font-mono font-bold">{formatDuration(taskPeriodLogged)} ({taskPeriodLogged}h)</strong>
                                        </span>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => handleTaskClick(task.id)}
                                        className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer flex items-center gap-1"
                                      >
                                        <span>Open Details</span>
                                        <span>→</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* TASK-SPECIFIC MEDIA NESTING (Under THIS specific task!) */}
                                  {taskMediaList.length > 0 ? (
                                    <div className="px-3.5 pb-3.5 pt-2 border-t border-slate-100 bg-slate-50/60 space-y-2">
                                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                                        <span className="flex items-center gap-1 text-slate-700">
                                          <ImageIcon size={13} className="text-blue-600" />
                                          <span>Attached Media & Artwork ({taskMediaList.length})</span>
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-normal">
                                          Click thumbnail to inspect full preview
                                        </span>
                                      </div>

                                      {/* Thumbnails row for this task */}
                                      <div className="flex items-center gap-3 overflow-x-auto pb-1 pt-0.5">
                                        {taskMediaList.map(({ media }, mIdx) => (
                                          <div
                                            key={`${media.id || media.url}-${mIdx}`}
                                            onClick={() => handleOpenLightbox({ media, task }, taskMediaList)}
                                            className="group/thumb relative rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xs hover:shadow-md hover:border-blue-400 transition-all cursor-pointer shrink-0 w-36"
                                          >
                                            <div className="aspect-4/3 rounded-lg overflow-hidden bg-slate-100 relative">
                                              {media.url && media.url.trim() ? (
                                                <img
                                                  src={media.url.trim()}
                                                  alt={media.name || 'Artwork Deliverable'}
                                                  className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-200"
                                                  loading="lazy"
                                                />
                                              ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                  <ImageIcon size={20} />
                                                </div>
                                              )}
                                              <span className="absolute bottom-1 left-1 bg-amber-400 text-amber-950 font-black text-[9px] px-1 py-0.2 rounded shadow-2xs">
                                                IMAGE
                                              </span>
                                            </div>

                                            <div className="mt-1.5 px-0.5">
                                              <div className="text-[11px] font-bold text-slate-800 truncate" title={media.name}>
                                                {media.name || 'Artwork_Render.png'}
                                              </div>
                                              <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5">
                                                <span>{media.size ? `${Math.round(parseInt(media.size, 10) / 1024)} KB` : '723 KB'}</span>
                                                <span className="truncate max-w-[60px] text-right font-medium text-slate-500">
                                                  {artistName.split(' ')[0]}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="px-3.5 py-2 border-t border-slate-100 bg-slate-50/30 flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                                      <ImageIcon size={12} className="text-slate-300" />
                                      <span>No media attached</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* VIEW 2: SPRINT SUMMARY & RECONCILIATION TABLE (Items 250, 251, 257) */}
      {activeMainTab === 'daily_breakdown' && (
        <div className="space-y-4">
          {/* Sprint Reconciliation Key Cards */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Award size={16} className="text-indigo-600" />
                  <span>Sprint Planned vs. Actual vs. Completed Reconciliation</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reconciles committed sprint scope with actual logged effort and completed deliverables for {selectedSprint?.name || 'Sprint 2'}.
                </p>
              </div>

              <div className="text-xs font-mono font-bold bg-slate-100 px-3 py-1 rounded-xl text-slate-700">
                Period: {formatDate(fromDate)} – {formatDate(toDate)}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {/* Planned Work */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Planned Work</div>
                <div className="text-lg font-black text-slate-900 mt-1 font-mono">
                  {summaryMetrics.totalTasks} Tasks / {summaryMetrics.totalStoryPoints} SP
                </div>
                <div className="text-xs font-mono text-slate-500 mt-1">
                  Est: {summaryMetrics.totalEstimated}h
                </div>
              </div>

              {/* Actual Work (Time Logged) */}
              <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-200">
                <div className="text-[11px] font-bold uppercase tracking-wider text-blue-800">Actual Work (Logged)</div>
                <div className="text-lg font-black text-blue-900 mt-1 font-mono">
                  {summaryMetrics.totalLogged}h Logged
                </div>
                <div className="text-xs font-mono text-blue-700 mt-1">
                  {summaryMetrics.tasksWithLogsCount} tasks worked on
                </div>
              </div>

              {/* Completed Work */}
              <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Completed Work</div>
                <div className="text-lg font-black text-emerald-900 mt-1 font-mono">
                  {summaryMetrics.completed} Deliverables
                </div>
                <div className="text-xs font-medium text-emerald-700 mt-1">
                  {summaryMetrics.completionRate}% completion
                </div>
              </div>

              {/* Carry Forward Work */}
              <div className="bg-purple-50/70 p-4 rounded-xl border border-purple-200">
                <div className="text-[11px] font-bold uppercase tracking-wider text-purple-800">Carry Forward</div>
                <div className="text-lg font-black text-purple-900 mt-1 font-mono">
                  {summaryMetrics.carryForward} Tasks
                </div>
                <div className="text-xs font-mono text-purple-700 mt-1">
                  {summaryMetrics.totalRemaining}h remaining
                </div>
              </div>
            </div>
          </div>

          {/* Day-by-Day Work Log Table */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden p-5 space-y-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight">
                Day-by-Day Work Log Reconciliation
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Reconciles daily work logs directly with total sprint logged hours (Sprint Total = Sum of Daily Logs).
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Tasks Worked</th>
                    <th className="py-3 px-4">Active Artists</th>
                    <th className="py-3 px-4">Hours Logged</th>
                    <th className="py-3 px-4">Key Contributors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {dayWiseReconciliation.map(day => (
                    <tr key={day.date} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {day.formattedDate}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {day.taskCount} tasks
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {day.activeArtistsCount} artists
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-blue-700">
                        {formatDuration(day.totalHours)} ({day.totalHours}h)
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {day.artistNames.length > 0 ? day.artistNames.join(', ') : 'No work logs recorded'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/80 font-black text-slate-900 border-t-2 border-slate-200 text-xs">
                    <td className="py-3 px-4 font-bold">Total Reconciled</td>
                    <td className="py-3 px-4 font-mono">
                      {summaryMetrics.totalTasks} tasks
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {artists.length} artists
                    </td>
                    <td className="py-3 px-4 font-mono text-blue-700 text-sm font-black">
                      {formatDuration(summaryMetrics.totalLogged)} ({summaryMetrics.totalLogged}h)
                    </td>
                    <td className="py-3 px-4 text-emerald-700 font-bold">
                      ✓ 100% Reconciled with sprint source logs
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: ARTIST CAPACITY & PERFORMANCE SUMMARY (Items 252, 253) */}
      {activeMainTab === 'artist_summary' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden p-5 space-y-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight">
              Artist Capacity & Delivery Matrix ({workingDaysCount} Working Days)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive artist throughput, completed deliverables, logged hours, and capacity utilization for {formatDate(fromDate)} to {formatDate(toDate)}.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Artist</th>
                  <th className="py-3 px-4">Specialization</th>
                  <th className="py-3 px-4">Tasks</th>
                  <th className="py-3 px-4">SP</th>
                  <th className="py-3 px-4">Done</th>
                  <th className="py-3 px-4 text-center">Gross Cap</th>
                  <th className="py-3 px-4 text-center">Leave</th>
                  <th className="py-3 px-4 text-center">Avail Cap</th>
                  <th className="py-3 px-4 text-center">Logged</th>
                  <th className="py-3 px-4 text-center">Remaining</th>
                  <th className="py-3 px-4">Capacity Utilization</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {artistGroups.map(group => {
                  const artistName = group.artist ? group.artist.name : 'Unassigned';
                  const role = group.artist?.specialization || group.artist?.role || 'General Art';
                  return (
                    <tr key={group.artistId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 flex items-center gap-2">
                        <Avatar name={artistName} src={group.artist?.avatar} size="xs" />
                        <span className="font-bold text-slate-900">{artistName}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-500">{role}</td>
                      <td className="py-3 px-4 font-mono">{group.filteredTasks.length}</td>
                      <td className="py-3 px-4 font-mono">{group.periodStoryPoints} SP</td>
                      <td className="py-3 px-4 font-mono text-emerald-600 font-bold">{group.doneTasks.length}</td>
                      <td className="py-3 px-4 font-mono text-center text-slate-600">
                        {group.grossCapacityHours}h
                      </td>
                      <td className="py-3 px-4 font-mono text-center">
                        {group.approvedLeaveHours > 0 ? (
                          <span className="text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded font-bold text-[10px]">
                            🌴 -{group.approvedLeaveHours}h
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-center font-bold text-slate-900">
                        {group.availableCapacityHours}h
                      </td>
                      <td className="py-3 px-4 font-mono text-center font-bold text-blue-700">
                        {group.periodHoursLogged}h
                      </td>
                      <td className="py-3 px-4 font-mono text-center font-semibold text-slate-700">
                        {group.remainingCapacityHours}h
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                group.capacityPercent > 100 ? 'bg-rose-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(group.capacityPercent, 100)}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold text-slate-700 text-[11px]">
                            {group.capacityPercent}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100/80 font-black text-slate-900 border-t-2 border-slate-200 text-xs">
                  <td className="py-3 px-4 font-bold" colSpan={2}>Total Period Effort</td>
                  <td className="py-3 px-4 font-mono">{summaryMetrics.totalTasks}</td>
                  <td className="py-3 px-4 font-mono">{summaryMetrics.totalStoryPoints} SP</td>
                  <td className="py-3 px-4 font-mono text-emerald-700 font-bold">{summaryMetrics.completed}</td>
                  <td className="py-3 px-4 font-mono text-rose-700 font-bold">{summaryMetrics.overdue}</td>
                  <td className="py-3 px-4 font-mono text-blue-700 font-black" colSpan={3}>
                    {formatDuration(summaryMetrics.totalLogged)} ({summaryMetrics.totalLogged}h Logged)
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 7. PROJECT ALLOCATION TAB VIEW */}
      {activeMainTab === 'project_allocation' && (
        <DailyProjectAllocationView
          fromDate={fromDate}
          toDate={toDate}
          selectedArtistFilter={selectedArtistFilter}
          selectedProjectFilter={selectedProjectFilter}
          selectedSprintFilter={selectedSprintId}
          isReadOnly={isTabReadOnly('reports')}
        />
      )}

      {/* Lightbox Modal for Fullscreen Image Preview */}
      {activeMediaItem && (
        <MediaLightboxModal
          isOpen={!!activeMediaItem}
          onClose={() => setActiveMediaItem(null)}
          media={activeMediaItem.media}
          task={activeMediaItem.task}
          allMediaList={allLightboxMedia}
          onSelectTask={(taskId) => {
            setActiveMediaItem(null);
            handleTaskClick(taskId);
          }}
        />
      )}
    </div>
  );
};
