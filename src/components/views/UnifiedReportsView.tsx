import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  Clock,
  Download,
  Filter,
  Layers,
  Search,
  SlidersHorizontal,
  TrendingUp,
  Users,
  CheckCircle2,
  FolderKanban,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ExternalLink,
  PieChart as PieChartIcon
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import {
  Task,
  Sprint,
  Artist,
  Project,
  TimeEntry,
  normalizeTaskStatus,
  isTaskDoneOrCompleted,
  WORKFLOW_STATUS_LIST
} from '../../types';
import { formatDate, getTodayDateString } from '../../utils/dateUtils';
import { formatDuration } from '../../utils/timeUtils';
import { UniversalTaskTable } from '../common/UniversalTaskTable';
import { Avatar } from '../common/Avatar';
import { CapacityBar } from '../common/CapacityBar';
import { getSprintOverallMetrics, getArtistSprintCapacity } from '../../utils/forecastEngine';
import { VisualArtistReportView } from '../reports/VisualArtistReportView';

export type ReportTab = 'daily' | 'sprint' | 'artists' | 'projects' | 'export';

interface UnifiedReportsViewProps {
  onSelectTask: (taskId: string, activeFilteredList?: string[]) => void;
  defaultTab?: ReportTab;
}

export const UnifiedReportsView: React.FC<UnifiedReportsViewProps> = ({
  onSelectTask,
  defaultTab = 'daily'
}) => {
  const {
    tasks,
    sprints,
    artists,
    projects,
    users,
    timeEntries,
    currentUser,
    settings
  } = useArtOps();

  const [activeTab, setActiveTab] = useState<ReportTab>(defaultTab);

  // Date Range State for Daily & Time Tracking Report
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | '7days' | '14days' | 'month' | 'custom'>('7days');
  const todayStr = getTodayDateString();
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState(todayStr);

  // Sprint Selector for Sprint-wise Report
  const [selectedSprintId, setSelectedSprintId] = useState<string>(() => {
    const active = sprints.find(s => s.status.toUpperCase() === 'ACTIVE');
    return active ? active.id : sprints[0]?.id || '';
  });

  // Universal Filter States
  const [selectedArtistFilter, setSelectedArtistFilter] = useState<string>('ALL');
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Calculate actual Date Range bounds based on preset
  const { startDateStr, endDateStr } = useMemo(() => {
    const end = todayStr;
    let start = todayStr;

    if (datePreset === 'today') {
      start = todayStr;
    } else if (datePreset === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      start = d.toISOString().split('T')[0];
    } else if (datePreset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      start = d.toISOString().split('T')[0];
    } else if (datePreset === '14days') {
      const d = new Date();
      d.setDate(d.getDate() - 14);
      start = d.toISOString().split('T')[0];
    } else if (datePreset === 'month') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      start = d.toISOString().split('T')[0];
    } else if (datePreset === 'custom') {
      return { startDateStr: customStartDate, endDateStr: customEndDate };
    }

    return { startDateStr: start, endDateStr: end };
  }, [datePreset, customStartDate, customEndDate, todayStr]);

  // Extract all timeEntries within the date range
  const matchedWorklogs = useMemo(() => {
    const logs: Array<{ worklog: TimeEntry; task: Task }> = [];
    (timeEntries || []).forEach(entry => {
      const entryDate = entry.date ? entry.date.split('T')[0] : '';
      if (entryDate >= startDateStr && entryDate <= endDateStr) {
        const t = tasks.find(tsk => tsk.id === entry.taskId);
        if (t) {
          logs.push({ worklog: entry, task: t });
        }
      }
    });
    return logs;
  }, [timeEntries, tasks, startDateStr, endDateStr]);

  // Tasks matching the Daily / Date Range criteria
  const dailyTasks = useMemo(() => {
    // Collect tasks that either have work logged in this range, were updated, or created in this range
    const taskMap = new Map<string, Task>();
    matchedWorklogs.forEach(({ task }) => {
      taskMap.set(task.id, task);
    });

    // Also include tasks active or updated in this window if no worklogs exist
    if (taskMap.size === 0) {
      tasks.forEach(t => {
        const uDate = (t.expectedDelivery || t.createdDate || '').split('T')[0];
        if (uDate >= startDateStr && uDate <= endDateStr) {
          taskMap.set(t.id, t);
        }
      });
    }

    let list = Array.from(taskMap.values());
    if (list.length === 0) list = tasks; // fallback to all tasks

    return list.filter(t => {
      if (selectedArtistFilter !== 'ALL' && t.artistId !== selectedArtistFilter) return false;
      if (selectedProjectFilter !== 'ALL' && t.projectId !== selectedProjectFilter) return false;
      if (selectedStatusFilter !== 'ALL' && normalizeTaskStatus(t.status) !== normalizeTaskStatus(selectedStatusFilter)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchKey = Boolean(t.jiraIssueKey && t.jiraIssueKey.toLowerCase().includes(q));
        const matchId = t.id.toLowerCase().includes(q);
        if (!matchTitle && !matchKey && !matchId) return false;
      }
      return true;
    });
  }, [tasks, matchedWorklogs, startDateStr, endDateStr, selectedArtistFilter, selectedProjectFilter, selectedStatusFilter, searchQuery]);

  // Total Hours Logged in this period
  const totalPeriodLoggedHours = useMemo(() => {
    return matchedWorklogs.reduce((acc, { worklog }) => acc + (worklog.hours || 0), 0);
  }, [matchedWorklogs]);

  // Sprint Report Context & Tasks
  const selectedSprint = useMemo(() => {
    return sprints.find(s => s.id === selectedSprintId) || sprints[0] || null;
  }, [sprints, selectedSprintId]);

  const sprintTasks = useMemo(() => {
    if (!selectedSprint) return [];
    if (selectedSprint.status?.toUpperCase() === 'COMPLETED') {
      return tasks.filter(
        t => t.sprintId === selectedSprint.id || (Array.isArray(t.sprintHistory) && t.sprintHistory.includes(selectedSprint.id))
      );
    }
    return tasks.filter(t => t.sprintId === selectedSprint.id);
  }, [tasks, selectedSprint]);

  const filteredSprintTasks = useMemo(() => {
    return sprintTasks.filter(t => {
      if (selectedArtistFilter !== 'ALL' && t.artistId !== selectedArtistFilter) return false;
      if (selectedProjectFilter !== 'ALL' && t.projectId !== selectedProjectFilter) return false;
      if (selectedStatusFilter !== 'ALL' && normalizeTaskStatus(t.status) !== normalizeTaskStatus(selectedStatusFilter)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchKey = Boolean(t.jiraIssueKey && t.jiraIssueKey.toLowerCase().includes(q));
        const matchId = t.id.toLowerCase().includes(q);
        if (!matchTitle && !matchKey && !matchId) return false;
      }
      return true;
    });
  }, [sprintTasks, selectedArtistFilter, selectedProjectFilter, selectedStatusFilter, searchQuery]);

  // Sprint KPI Metrics
  const sprintMetrics = useMemo(() => {
    if (!selectedSprint) return null;
    return getSprintOverallMetrics(artists, selectedSprint, sprintTasks);
  }, [artists, selectedSprint, sprintTasks]);

  // Artist Workload & Capacity Breakdown
  const artistReportData = useMemo(() => {
    return artists.map(artist => {
      const artistTasks = tasks.filter(t => t.artistId === artist.id && !isTaskDoneOrCompleted(t.status));
      const doneTasks = tasks.filter(t => t.artistId === artist.id && isTaskDoneOrCompleted(t.status));
      const totalRemaining = artistTasks.reduce((acc, t) => acc + (t.remainingEstimate ?? t.originalEstimate ?? 0), 0);
      const totalLogged = tasks.filter(t => t.artistId === artist.id).reduce((acc, t) => acc + (t.timeLogged || 0), 0);
      const weeklyCap = artist.weeklyCapacity || 40;
      const utilization = weeklyCap > 0 ? Math.round((totalRemaining / weeklyCap) * 100) : 0;

      return {
        artist,
        activeTasksCount: artistTasks.length,
        doneTasksCount: doneTasks.length,
        totalRemaining,
        totalLogged,
        weeklyCap,
        utilization
      };
    });
  }, [artists, tasks]);

  // Project Report Data
  const projectReportData = useMemo(() => {
    return projects.map(proj => {
      const projTasks = tasks.filter(t => t.projectId === proj.id);
      const doneCount = projTasks.filter(t => isTaskDoneOrCompleted(t.status)).length;
      const totalSP = projTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
      const completedSP = projTasks.filter(t => isTaskDoneOrCompleted(t.status)).reduce((acc, t) => acc + (t.storyPoints || 0), 0);
      const totalLogged = projTasks.reduce((acc, t) => acc + (t.timeLogged || 0), 0);
      const totalEst = projTasks.reduce((acc, t) => acc + (t.originalEstimate || 0), 0);
      const progressPercent = projTasks.length > 0 ? Math.round((doneCount / projTasks.length) * 100) : 0;

      return {
        project: proj,
        totalTasks: projTasks.length,
        doneCount,
        totalSP,
        completedSP,
        totalLogged,
        totalEst,
        progressPercent
      };
    });
  }, [projects, tasks]);

  // CSV Export Handler
  const handleExportCSV = (reportType: string) => {
    let rows: string[][] = [];
    let filename = `artops-${reportType}-report-${todayStr}.csv`;

    if (reportType === 'daily' || reportType === 'tasks') {
      rows.push(['Task ID', 'Jira Key', 'Title', 'Artist', 'Status', 'Priority', 'Story Points', 'Original Est (h)', 'Time Logged (h)', 'Remaining (h)', 'Project', 'Due Date']);
      const exportList = reportType === 'daily' ? dailyTasks : tasks;
      exportList.forEach(t => {
        const art = artists.find(a => a.id === t.artistId)?.name || 'Unassigned';
        const prj = projects.find(p => p.id === t.projectId)?.name || '';
        rows.push([
          t.id,
          t.jiraIssueKey || '',
          `"${(t.title || '').replace(/"/g, '""')}"`,
          `"${art}"`,
          t.status,
          t.priority,
          String(t.storyPoints || 0),
          String(t.originalEstimate || 0),
          String(t.timeLogged || 0),
          String(t.remainingEstimate ?? t.originalEstimate ?? 0),
          `"${prj}"`,
          t.dueDate || ''
        ]);
      });
    } else if (reportType === 'sprint' && selectedSprint) {
      filename = `artops-${selectedSprint.name.replace(/\s+/g, '-').toLowerCase()}-${todayStr}.csv`;
      rows.push(['Sprint', 'Task ID', 'Jira Key', 'Title', 'Artist', 'Status', 'Story Points', 'Time Logged (h)', 'Remaining (h)', 'Project']);
      filteredSprintTasks.forEach(t => {
        const art = artists.find(a => a.id === t.artistId)?.name || 'Unassigned';
        const prj = projects.find(p => p.id === t.projectId)?.name || '';
        rows.push([
          selectedSprint.name,
          t.id,
          t.jiraIssueKey || '',
          `"${(t.title || '').replace(/"/g, '""')}"`,
          `"${art}"`,
          t.status,
          String(t.storyPoints || 0),
          String(t.timeLogged || 0),
          String(t.remainingEstimate ?? t.originalEstimate ?? 0),
          `"${prj}"`
        ]);
      });
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="unified-reports-view" className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header & Subtitle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Production Analytics & Reports</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 font-bold text-blue-700 border border-blue-200">
              Unified Hub
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Consolidated daily worklogs, sprint velocity analytics, artist capacity utilization, and exportable deliverables.
          </p>
        </div>

        {/* Export Dropdown / Quick Action */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleExportCSV(activeTab === 'sprint' ? 'sprint' : 'daily')}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Download CSV report of currently filtered data"
          >
            <Download size={14} className="text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Primary Report Mode Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-2 overflow-x-auto scrollbar-thin">
        <button
          type="button"
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'daily'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Clock size={14} />
          <span>Daily & Time Tracking</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sprint')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'sprint'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers size={14} />
          <span>Sprint Analytics</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('artists')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'artists'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users size={14} />
          <span>Artist Workload & Capacity</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('projects')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'projects'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FolderKanban size={14} />
          <span>Project Deliverables</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('export')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'export'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <FileSpreadsheet size={14} />
          <span>Data Extraction & Exports</span>
        </button>
      </div>

      {/* TAB 1: DAILY & TIME TRACKING REPORT */}
      {activeTab === 'daily' && (
        <VisualArtistReportView
          mode="daily"
          onSelectTask={onSelectTask}
        />
      )}

      {/* TAB 2: SPRINT-WISE REPORT */}
      {activeTab === 'sprint' && (
        <VisualArtistReportView
          mode="sprint"
          onSelectTask={onSelectTask}
        />
      )}

      {/* TAB 3: ARTIST WORKLOAD & CAPACITY */}
      {activeTab === 'artists' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {artistReportData.map(({ artist, activeTasksCount, doneTasksCount, totalRemaining, totalLogged, weeklyCap, utilization }) => (
              <div key={artist.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar name={artist.name} src={artist.avatar} size="md" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{artist.name}</h3>
                    <p className="text-xs text-slate-500 truncate">{artist.role} • {artist.specialization}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Workload Utilization</span>
                    <span
                      className={`font-bold ${
                        utilization > 100 ? 'text-red-600' : utilization > 80 ? 'text-amber-600' : 'text-emerald-700'
                      }`}
                    >
                      {utilization}%
                    </span>
                  </div>
                  <CapacityBar committedHours={totalRemaining} capacityHours={weeklyCap} />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Open</span>
                    <span className="text-xs font-bold text-slate-900">{activeTasksCount}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Done</span>
                    <span className="text-xs font-bold text-emerald-700">{doneTasksCount}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Logged</span>
                    <span className="text-xs font-bold text-blue-700 font-mono">{formatDuration(totalLogged)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: PROJECT DELIVERABLES */}
      {activeTab === 'projects' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projectReportData.map(({ project, totalTasks, doneCount, totalSP, completedSP, totalLogged, totalEst, progressPercent }) => (
              <div key={project.id} className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">{project.name}</h3>
                    <span className="text-[11px] font-mono text-slate-400 font-bold">{project.key}</span>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {progressPercent}% Done
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Tasks</span>
                    <span className="text-xs font-bold text-slate-900">{doneCount} / {totalTasks}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Story Points</span>
                    <span className="text-xs font-bold text-purple-700">{completedSP} / {totalSP}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-xl">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Effort Logged</span>
                    <span className="text-xs font-bold text-slate-900 font-mono">{formatDuration(totalLogged)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: DATA EXTRACTION & EXPORT */}
      {activeTab === 'export' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6 animate-in fade-in duration-150">
          <div>
            <h2 className="text-base font-black text-slate-900">Export & Extraction Center</h2>
            <p className="text-xs text-slate-500 mt-1">
              Download structured data for management audits, client billing, and spreadsheet reporting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border border-slate-200 rounded-xl space-y-3 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="text-emerald-600" size={20} />
                <h3 className="text-sm font-bold text-slate-900">All Tasks Master CSV</h3>
              </div>
              <p className="text-xs text-slate-500">
                Complete database export containing all tasks, Jira keys, assignees, estimates, and dates.
              </p>
              <button
                type="button"
                onClick={() => handleExportCSV('tasks')}
                className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Export Master CSV
              </button>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl space-y-3 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Clock className="text-blue-600" size={20} />
                <h3 className="text-sm font-bold text-slate-900">Daily Log & Work Time CSV</h3>
              </div>
              <p className="text-xs text-slate-500">
                Detailed worklog report filtered to date range ({formatDate(startDateStr)} — {formatDate(endDateStr)}).
              </p>
              <button
                type="button"
                onClick={() => handleExportCSV('daily')}
                className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Export Worklog CSV
              </button>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl space-y-3 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Layers className="text-purple-600" size={20} />
                <h3 className="text-sm font-bold text-slate-900">Sprint Deliverables CSV</h3>
              </div>
              <p className="text-xs text-slate-500">
                Filtered sprint tasks and velocity numbers for {selectedSprint?.name || 'Active Sprint'}.
              </p>
              <button
                type="button"
                onClick={() => handleExportCSV('sprint')}
                className="w-full px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Export Sprint CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
