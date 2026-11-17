import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Award,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Download,
  BarChart2,
  Layers,
  Calendar,
  Flame,
  Zap,
  ArrowUpRight,
  ShieldAlert,
  SlidersHorizontal,
  Target,
  Activity,
  CheckCircle,
  HelpCircle,
  Percent,
  CheckSquare
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { useArtOps } from '../../context/ArtOpsContext';
import { Task, Sprint, Artist, Priority } from '../../types';
import { formatDate, getTodayDateString } from '../../utils/dateUtils';
import { formatDuration } from '../../utils/timeUtils';
import { TaskStatusBadge, PriorityBadge } from '../common/Badge';
import { Avatar } from '../common/Avatar';

interface ReportsViewProps {
  onSelectTask?: (taskId: string) => void;
}

type ReportTab = 'BURNDOWN' | 'VELOCITY' | 'EFFORT_VARIANCE';
type BurndownMetric = 'STORY_POINTS' | 'HOURS';

export const ReportsView: React.FC<ReportsViewProps> = ({ onSelectTask }) => {
  const { tasks, requests, artists, sprints, projects, timeEntries } = useArtOps();

  const [activeTab, setActiveTab] = useState<ReportTab>('BURNDOWN');
  const [selectedSprintId, setSelectedSprintId] = useState<string>(() => {
    const active = sprints.find(s => s.status.toUpperCase() === 'ACTIVE');
    return active ? active.id : sprints[0]?.id || '';
  });
  const [burndownMetric, setBurndownMetric] = useState<BurndownMetric>('STORY_POINTS');

  const selectedSprint = useMemo(() => {
    return sprints.find(s => s.id === selectedSprintId) || sprints[0];
  }, [sprints, selectedSprintId]);

  // Tasks in the selected sprint
  const sprintTasks = useMemo(() => {
    if (!selectedSprint) return [];
    return tasks.filter(t => t.sprintId === selectedSprint.id);
  }, [tasks, selectedSprint]);

  // SPRINT BURNDOWN CALCULATION ENGINE
  const burndownData = useMemo(() => {
    if (!selectedSprint) return { chartPoints: [], metrics: null };

    const startDate = new Date(selectedSprint.startDate);
    const endDate = new Date(selectedSprint.endDate);
    const today = new Date(getTodayDateString());

    // Calculate all calendar/working days in the sprint
    const daysList: { dateStr: string; label: string; isPastOrToday: boolean; dayIndex: number }[] = [];
    const curr = new Date(startDate);
    let dayIdx = 0;

    while (curr <= endDate) {
      const iso = curr.toISOString().split('T')[0];
      const isPastOrToday = curr <= today;
      const dayName = curr.toLocaleString('en-US', { weekday: 'short' });
      const monthDay = `${curr.getMonth() + 1}/${curr.getDate()}`;
      
      daysList.push({
        dateStr: iso,
        label: `Day ${dayIdx + 1} (${dayName} ${monthDay})`,
        isPastOrToday,
        dayIndex: dayIdx
      });

      curr.setDate(curr.getDate() + 1);
      dayIdx++;
    }

    const totalDays = Math.max(1, daysList.length);

    // Initial total scope committed to the sprint
    const totalCommittedSP = sprintTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
    const totalCommittedHours = sprintTasks.reduce((acc, t) => acc + (t.originalEstimate || 0), 0);

    const initialScope = burndownMetric === 'STORY_POINTS' ? totalCommittedSP : totalCommittedHours;
    const completedTasks = sprintTasks.filter(t => t.status === 'DONE');
    const totalCompletedSP = completedTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
    const totalCompletedHours = completedTasks.reduce((acc, t) => acc + (t.originalEstimate || 0), 0);

    const currentCompletedScope = burndownMetric === 'STORY_POINTS' ? totalCompletedSP : totalCompletedHours;
    const currentRemainingScope = Math.max(0, initialScope - currentCompletedScope);

    // Build day-by-day burndown points
    let cumulativeDoneSP = 0;
    let cumulativeDoneHours = 0;
    let lastActualRemaining = initialScope;

    const chartPoints = daysList.map((day, idx) => {
      // Linear Ideal Burndown: goes from initialScope at Day 0 to 0 at final day
      const idealBurn = Math.max(0, Math.round((initialScope - (idx * (initialScope / (totalDays - 1 || 1)))) * 10) / 10);

      // Actual completion on this day
      const tasksCompletedOnThisDay = sprintTasks.filter(t => {
        if (t.status !== 'DONE') return false;
        const delivery = t.actualDelivery || t.dueDate;
        return delivery === day.dateStr;
      });

      const doneSPOnDay = tasksCompletedOnThisDay.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
      const doneHoursOnDay = tasksCompletedOnThisDay.reduce((acc, t) => acc + (t.originalEstimate || 0), 0);

      cumulativeDoneSP += doneSPOnDay;
      cumulativeDoneHours += doneHoursOnDay;

      const currentDone = burndownMetric === 'STORY_POINTS' ? cumulativeDoneSP : cumulativeDoneHours;
      const actualRemaining = Math.max(0, initialScope - currentDone);

      // Only plot actual line for days up to today
      let actualPlot: number | null = null;
      if (day.isPastOrToday) {
        actualPlot = actualRemaining;
        lastActualRemaining = actualRemaining;
      }

      // Projected Line from current day to end of sprint based on burn rate
      return {
        dateStr: day.dateStr,
        label: day.label,
        ideal: idealBurn,
        actual: actualPlot,
        scopeBaseline: initialScope,
        isPastOrToday: day.isPastOrToday,
        tasksClosedCount: tasksCompletedOnThisDay.length
      };
    });

    // PM Metrics: Velocity & Forecast
    const pastDaysCount = daysList.filter(d => d.isPastOrToday).length;
    const remainingDaysCount = Math.max(0, totalDays - pastDaysCount);

    const actualBurnPerDay = pastDaysCount > 0 ? (initialScope - currentRemainingScope) / pastDaysCount : 0;
    const requiredBurnPerDay = remainingDaysCount > 0 ? currentRemainingScope / remainingDaysCount : 0;

    // Health Status calculation
    let healthStatus: 'AHEAD' | 'ON_TRACK' | 'AT_RISK' | 'BEHIND' = 'ON_TRACK';
    const currentIdeal = chartPoints.find(p => p.dateStr === getTodayDateString())?.ideal ?? initialScope;

    if (currentRemainingScope < currentIdeal - (initialScope * 0.08)) {
      healthStatus = 'AHEAD';
    } else if (currentRemainingScope > currentIdeal + (initialScope * 0.15)) {
      healthStatus = 'BEHIND';
    } else if (currentRemainingScope > currentIdeal) {
      healthStatus = 'AT_RISK';
    } else {
      healthStatus = 'ON_TRACK';
    }

    // Projected completion days
    const daysToCompleteAtCurrentRate = actualBurnPerDay > 0 ? Math.ceil(currentRemainingScope / actualBurnPerDay) : remainingDaysCount;
    const projectedFinishDateStr = new Date(Date.now() + (daysToCompleteAtCurrentRate * 86400000)).toISOString().split('T')[0];

    return {
      chartPoints,
      metrics: {
        initialScope,
        currentCompletedScope,
        currentRemainingScope,
        completionPercentage: initialScope > 0 ? Math.round((currentCompletedScope / initialScope) * 100) : 0,
        totalCommittedSP,
        totalCompletedSP,
        totalCommittedHours,
        totalCompletedHours,
        actualBurnPerDay: Math.round(actualBurnPerDay * 10) / 10,
        requiredBurnPerDay: Math.round(requiredBurnPerDay * 10) / 10,
        healthStatus,
        totalDays,
        pastDaysCount,
        remainingDaysCount,
        projectedFinishDateStr
      }
    };
  }, [selectedSprint, sprintTasks, burndownMetric]);

  // Sprint Critical Risk Tasks (Overdue, Over-Estimated, Blocked)
  const sprintRiskAnalysis = useMemo(() => {
    const todayStr = getTodayDateString();

    const overdueSprintTasks = sprintTasks.filter(t => {
      if (t.status === 'DONE') return false;
      return t.dueDate && t.dueDate < todayStr;
    });

    const overEstimatedSprintTasks = sprintTasks.filter(t => {
      return (t.timeLogged || 0) > (t.originalEstimate || 0);
    }).map(t => {
      const orig = t.originalEstimate || 1;
      const logged = t.timeLogged || 0;
      const varianceHours = Math.round((logged - orig) * 10) / 10;
      const variancePercent = Math.round((varianceHours / orig) * 100);
      return {
        task: t,
        originalEstimate: orig,
        timeLogged: logged,
        varianceHours,
        variancePercent
      };
    });

    const blockedSprintTasks = sprintTasks.filter(t => t.status === 'BLOCKED');

    return {
      overdueSprintTasks,
      overEstimatedSprintTasks,
      blockedSprintTasks
    };
  }, [sprintTasks]);

  // Artist Contribution in this Sprint
  const artistSprintContributions = useMemo(() => {
    if (!selectedSprint) return [];

    const artistMap: Record<string, {
      artist: Artist;
      assignedTasksCount: number;
      assignedSP: number;
      completedSP: number;
      loggedHoursInSprint: number;
      estimatedHours: number;
      overdueTasksCount: number;
      overEstimatedTasksCount: number;
    }> = {};

    sprintTasks.forEach(task => {
      if (!task.artistId) return;
      const artist = artists.find(a => a.id === task.artistId);
      if (!artist) return;

      if (!artistMap[task.artistId]) {
        artistMap[task.artistId] = {
          artist,
          assignedTasksCount: 0,
          assignedSP: 0,
          completedSP: 0,
          loggedHoursInSprint: 0,
          estimatedHours: 0,
          overdueTasksCount: 0,
          overEstimatedTasksCount: 0
        };
      }

      const rec = artistMap[task.artistId];
      rec.assignedTasksCount += 1;
      rec.assignedSP += (task.storyPoints || 0);
      rec.estimatedHours += (task.originalEstimate || 0);
      rec.loggedHoursInSprint += (task.timeLogged || 0);

      if (task.status === 'DONE') {
        rec.completedSP += (task.storyPoints || 0);
      }

      if (task.status !== 'DONE' && task.dueDate && task.dueDate < getTodayDateString()) {
        rec.overdueTasksCount += 1;
      }

      if ((task.timeLogged || 0) > (task.originalEstimate || 0)) {
        rec.overEstimatedTasksCount += 1;
      }
    });

    return Object.values(artistMap).map(item => ({
      ...item,
      completionRate: item.assignedSP > 0 ? Math.round((item.completedSP / item.assignedSP) * 100) : 0,
      varianceHours: Math.round((item.loggedHoursInSprint - item.estimatedHours) * 10) / 10
    }));
  }, [sprintTasks, artists, selectedSprint]);

  // HISTORICAL VELOCITY & SLA DATA
  const velocityData = useMemo(() => {
    return sprints.map(s => {
      const sTasks = tasks.filter(t => t.sprintId === s.id);
      const plannedSP = sTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
      const completedSP = sTasks.filter(t => t.status === 'DONE').reduce((acc, t) => acc + (t.storyPoints || 0), 0);
      return {
        name: s.name.split(' ')[0] + ' ' + (s.name.split(' ')[1] || ''),
        fullName: s.name,
        planned: plannedSP,
        completed: completedSP
      };
    });
  }, [sprints, tasks]);

  // Revisions by Art Category
  const revisionByCategoryData = useMemo(() => {
    const categories: Record<string, { total: number; revisions: number }> = {};

    tasks.forEach(t => {
      const cat = t.taskType || 'General';
      if (!categories[cat]) categories[cat] = { total: 0, revisions: 0 };
      categories[cat].total += 1;
      if (t.revisionCount && t.revisionCount > 0) {
        categories[cat].revisions += t.revisionCount;
      }
    });

    return Object.entries(categories).map(([name, val]) => ({
      name,
      totalTasks: val.total,
      revisions: val.revisions,
      revisionRate: val.total > 0 ? Math.round((val.revisions / val.total) * 100) : 0
    }));
  }, [tasks]);

  // EFFORT VARIANCE & ESTIMATION ACCURACY DATA
  const effortVarianceData = useMemo(() => {
    const categories: Record<string, { original: number; logged: number; taskCount: number }> = {};

    tasks.forEach(t => {
      const cat = t.taskType || 'General';
      if (!categories[cat]) categories[cat] = { original: 0, logged: 0, taskCount: 0 };
      categories[cat].original += (t.originalEstimate || 0);
      categories[cat].logged += (t.timeLogged || 0);
      categories[cat].taskCount += 1;
    });

    const categoryBreakdown = Object.entries(categories).map(([name, val]) => {
      const varianceHours = Math.round((val.logged - val.original) * 10) / 10;
      const variancePercent = val.original > 0 ? Math.round((varianceHours / val.original) * 100) : 0;
      return {
        category: name,
        estimatedHours: val.original,
        loggedHours: val.logged,
        varianceHours,
        variancePercent,
        taskCount: val.taskCount
      };
    });

    const totalEstimated = tasks.reduce((sum, t) => sum + (t.originalEstimate || 0), 0);
    const totalLogged = tasks.reduce((sum, t) => sum + (t.timeLogged || 0), 0);
    const totalVarianceHours = Math.round((totalLogged - totalEstimated) * 10) / 10;
    const accuracyScore = totalEstimated > 0 ? Math.max(0, 100 - Math.abs(Math.round(((totalLogged - totalEstimated) / totalEstimated) * 100))) : 100;

    const overEstimatedTasksList = tasks
      .filter(t => (t.timeLogged || 0) > (t.originalEstimate || 0))
      .map(t => {
        const orig = t.originalEstimate || 1;
        const logged = t.timeLogged || 0;
        return {
          task: t,
          originalEstimate: orig,
          timeLogged: logged,
          varianceHours: Math.round((logged - orig) * 10) / 10,
          variancePercent: Math.round(((logged - orig) / orig) * 100)
        };
      })
      .sort((a, b) => b.varianceHours - a.varianceHours);

    return {
      categoryBreakdown,
      totalEstimated,
      totalLogged,
      totalVarianceHours,
      accuracyScore,
      overEstimatedTasksList
    };
  }, [tasks]);

  return (
    <div id="reports-view" className="p-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Project Management & Sprint Analytics</h1>
            <span className="text-xs font-bold uppercase tracking-wider bg-slate-900 text-white px-2.5 py-0.5 rounded-full">
              Burndown & Velocity
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Senior PM analytics: Sprint burndown curves, delivery forecasts, overdue task triages, and effort estimation accuracy.
          </p>
        </div>

        {/* Top Report Tab Switcher */}
        <div className="flex items-center bg-zinc-100 p-1 rounded-xl text-xs font-semibold gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('BURNDOWN')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'BURNDOWN'
                ? 'bg-white text-zinc-900 shadow-2xs font-bold'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <TrendingUp size={14} />
            <span>Sprint Burndown</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('VELOCITY')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'VELOCITY'
                ? 'bg-white text-zinc-900 shadow-2xs font-bold'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <BarChart2 size={14} />
            <span>Studio Velocity & SLAs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('EFFORT_VARIANCE')}
            className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'EFFORT_VARIANCE'
                ? 'bg-white text-zinc-900 shadow-2xs font-bold'
                : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            <Clock size={14} />
            <span>Effort Variance</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: SPRINT BURNDOWN REPORT                                            */}
      {/* ========================================================================= */}
      {activeTab === 'BURNDOWN' && (
        <div className="space-y-6">
          {/* Sprint Selector and Metric Switcher Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-zinc-50 border border-zinc-200 rounded-2xl">
            {/* Sprint Switcher Dropdown */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-zinc-700 shrink-0">Select Sprint:</label>
              <select
                value={selectedSprintId}
                onChange={(e) => setSelectedSprintId(e.target.value)}
                className="text-xs font-bold bg-white border border-zinc-300 rounded-xl px-3 py-2 outline-hidden cursor-pointer shadow-2xs text-zinc-900"
              >
                {sprints.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status})
                  </option>
                ))}
              </select>

              {selectedSprint && (
                <span className="text-xs text-zinc-500 hidden md:inline">
                  {formatDate(selectedSprint.startDate)} &rarr; {formatDate(selectedSprint.endDate)}
                </span>
              )}
            </div>

            {/* Metric Toggle: Story Points vs Hours */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-500">Metric:</span>
              <div className="flex items-center bg-white border border-zinc-200 p-0.5 rounded-lg shadow-2xs">
                <button
                  type="button"
                  onClick={() => setBurndownMetric('STORY_POINTS')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    burndownMetric === 'STORY_POINTS'
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Story Points (SP)
                </button>
                <button
                  type="button"
                  onClick={() => setBurndownMetric('HOURS')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    burndownMetric === 'HOURS'
                      ? 'bg-zinc-900 text-white'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Effort Hours (h)
                </button>
              </div>
            </div>
          </div>

          {/* Burndown KPI Summary Strip */}
          {burndownData.metrics && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Burndown Health Card */}
              <div className="p-4 bg-white border border-zinc-200 rounded-xl shadow-2xs">
                <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider block">
                  Burndown Pace Status
                </span>
                <div className="flex items-center gap-2 mt-1.5">
                  {burndownData.metrics.healthStatus === 'AHEAD' && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-200">
                      🟢 Ahead of Schedule
                    </span>
                  )}
                  {burndownData.metrics.healthStatus === 'ON_TRACK' && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-800 bg-blue-100 px-2.5 py-1 rounded-md border border-blue-200">
                      🔵 On Track
                    </span>
                  )}
                  {burndownData.metrics.healthStatus === 'AT_RISK' && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-md border border-amber-200">
                      🟡 At Risk of Spillover
                    </span>
                  )}
                  {burndownData.metrics.healthStatus === 'BEHIND' && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-800 bg-rose-100 px-2.5 py-1 rounded-md border border-rose-200">
                      🔴 Behind Schedule
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1.5">
                  {burndownData.metrics.completionPercentage}% sprint scope delivered
                </p>
              </div>

              {/* Remaining Scope */}
              <div className="p-4 bg-white border border-zinc-200 rounded-xl shadow-2xs">
                <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider block">
                  Remaining Scope
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-zinc-900">
                    {burndownData.metrics.currentRemainingScope} {burndownMetric === 'STORY_POINTS' ? 'SP' : 'h'}
                  </span>
                  <span className="text-xs text-zinc-500 font-medium">
                    / {burndownData.metrics.initialScope} {burndownMetric === 'STORY_POINTS' ? 'SP' : 'h'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  {burndownData.metrics.currentCompletedScope} {burndownMetric === 'STORY_POINTS' ? 'SP' : 'h'} completed
                </p>
              </div>

              {/* Required Burn Rate vs Actual */}
              <div className="p-4 bg-white border border-zinc-200 rounded-xl shadow-2xs">
                <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider block">
                  Required Daily Burn Rate
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-indigo-700">
                    {burndownData.metrics.requiredBurnPerDay} {burndownMetric === 'STORY_POINTS' ? 'SP' : 'h'}/day
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Actual avg burn: <strong>{burndownData.metrics.actualBurnPerDay} {burndownMetric === 'STORY_POINTS' ? 'SP' : 'h'}/day</strong>
                </p>
              </div>

              {/* Delivery Forecast */}
              <div className="p-4 bg-white border border-zinc-200 rounded-xl shadow-2xs">
                <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider block">
                  Sprint Completion Target
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-bold text-zinc-900">
                    {formatDate(selectedSprint?.endDate)}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {burndownData.metrics.remainingDaysCount} sprint days remaining
                </p>
              </div>
            </div>
          )}

          {/* Interactive Sprint Burndown Chart */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                  <Flame size={18} className="text-amber-500" />
                  <span>Sprint Burndown Trajectory</span>
                </h2>
                <p className="text-xs text-zinc-500">
                  Comparing Ideal Burn Line vs Actual Remaining {burndownMetric === 'STORY_POINTS' ? 'Story Points (SP)' : 'Hours (h)'} day-by-day.
                </p>
              </div>

              {/* Chart Legend Summary */}
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 border-b-2 border-dashed border-indigo-400" />
                  <span className="text-zinc-600">Ideal Guideline</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-emerald-500 rounded" />
                  <span className="text-zinc-900 font-bold">Actual Remaining</span>
                </div>
              </div>
            </div>

            <div className="h-80 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={burndownData.chartPoints}
                  margin={{ top: 10, right: 20, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    label={{
                      value: burndownMetric === 'STORY_POINTS' ? 'Remaining SP' : 'Remaining Hours',
                      angle: -90,
                      position: 'insideLeft',
                      style: { textAnchor: 'middle', fill: '#94a3b8', fontSize: 11 }
                    }}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const idealVal = data.ideal;
                        const actualVal = data.actual;
                        return (
                          <div className="bg-zinc-900 text-white p-3 rounded-xl text-xs shadow-xl space-y-1.5 min-w-[200px]">
                            <p className="font-bold text-zinc-100 border-b border-zinc-700 pb-1">{label}</p>
                            <div className="flex justify-between">
                              <span className="text-zinc-400">Ideal Remaining:</span>
                              <span className="font-mono font-bold text-indigo-300">{idealVal} {burndownMetric === 'STORY_POINTS' ? 'SP' : 'h'}</span>
                            </div>
                            {actualVal !== null && actualVal !== undefined ? (
                              <div className="flex justify-between">
                                <span className="text-zinc-400">Actual Remaining:</span>
                                <span className="font-mono font-bold text-emerald-400">{actualVal} {burndownMetric === 'STORY_POINTS' ? 'SP' : 'h'}</span>
                              </div>
                            ) : (
                              <p className="text-[11px] text-zinc-500 italic">Future sprint day (projected)</p>
                            )}
                            {data.tasksClosedCount > 0 && (
                              <p className="text-[11px] text-emerald-300 font-semibold pt-1 border-t border-zinc-800">
                                ✅ {data.tasksClosedCount} tasks delivered on this day
                              </p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ideal"
                    stroke="#818CF8"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 3, fill: '#818CF8' }}
                    name="Ideal Burn"
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#10B981"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }}
                    connectNulls={false}
                    name="Actual Remaining"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Critical Risk Center (Overdue & Overrun tasks blocking burndown) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Overdue Tasks in this Sprint */}
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                    <AlertTriangle size={15} className="text-rose-600" />
                    <span>Overdue Sprint Tasks ({sprintRiskAnalysis.overdueSprintTasks.length})</span>
                  </h3>
                  <p className="text-xs text-zinc-500">Tasks in this sprint past due date impacting velocity</p>
                </div>
              </div>

              {sprintRiskAnalysis.overdueSprintTasks.length === 0 ? (
                <div className="text-center py-6 bg-emerald-50/60 rounded-xl border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  ✅ No overdue tasks in this sprint milestone!
                </div>
              ) : (
                <div className="space-y-2">
                  {sprintRiskAnalysis.overdueSprintTasks.map(t => {
                    const assignedArtist = artists.find(a => a.id === t.artistId);
                    return (
                      <div
                        key={t.id}
                        onClick={() => onSelectTask?.(t.id)}
                        className="p-3 bg-rose-50/40 border border-rose-200 hover:border-rose-400 rounded-xl text-xs space-y-1.5 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-bold text-rose-700">{t.id}</span>
                            <span className="font-bold text-zinc-900 truncate">{t.title}</span>
                          </div>
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200 shrink-0">
                            Due: {formatDate(t.dueDate)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-zinc-500">
                          <span>Assignee: <strong>{assignedArtist?.name || 'Unassigned'}</strong></span>
                          <span className="font-semibold text-blue-600 group-hover:underline">Inspect &rarr;</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Over-Estimated Tasks in this Sprint */}
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                    <Clock size={15} className="text-amber-600" />
                    <span>Effort Overruns / Over-Estimated ({sprintRiskAnalysis.overEstimatedSprintTasks.length})</span>
                  </h3>
                  <p className="text-xs text-zinc-500">Tasks exceeding planned baseline hours</p>
                </div>
              </div>

              {sprintRiskAnalysis.overEstimatedSprintTasks.length === 0 ? (
                <div className="text-center py-6 bg-emerald-50/60 rounded-xl border border-emerald-200 text-emerald-800 text-xs font-semibold">
                  ✅ All sprint tasks are running within estimated effort bounds!
                </div>
              ) : (
                <div className="space-y-2">
                  {sprintRiskAnalysis.overEstimatedSprintTasks.map(({ task, originalEstimate, timeLogged, varianceHours, variancePercent }) => {
                    const assignedArtist = artists.find(a => a.id === task.artistId);
                    return (
                      <div
                        key={task.id}
                        onClick={() => onSelectTask?.(task.id)}
                        className="p-3 bg-amber-50/40 border border-amber-200 hover:border-amber-400 rounded-xl text-xs space-y-1.5 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono font-bold text-amber-800">{task.id}</span>
                            <span className="font-bold text-zinc-900 truncate">{task.title}</span>
                          </div>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                            +{varianceHours}h overrun (+{variancePercent}%)
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-zinc-500">
                          <span>Assignee: <strong>{assignedArtist?.name || 'Unassigned'}</strong> ({formatDuration(timeLogged)} / {formatDuration(originalEstimate)})</span>
                          <span className="font-semibold text-blue-600 group-hover:underline">Inspect &rarr;</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Artist Contribution Breakdown Table for Sprint */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Artist Sprint Workload & Burndown Contribution</h3>
              <p className="text-xs text-zinc-500">
                Individual artist committed story points, logged effort, overdue tasks, and milestone delivery status.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Artist</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Assigned Tasks</th>
                    <th className="py-2.5 px-3">Committed SP</th>
                    <th className="py-2.5 px-3">Completed SP</th>
                    <th className="py-2.5 px-3">Logged Hours</th>
                    <th className="py-2.5 px-3">Effort Variance</th>
                    <th className="py-2.5 px-3">Risks</th>
                    <th className="py-2.5 px-3">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {artistSprintContributions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-zinc-400">
                        No artist assignments found in this sprint.
                      </td>
                    </tr>
                  ) : (
                    artistSprintContributions.map(c => (
                      <tr key={c.artist.id} className="hover:bg-zinc-50/70 transition-colors">
                        <td className="py-3 px-3 font-bold text-zinc-900 flex items-center gap-2">
                          <Avatar
                            name={c.artist.name}
                            src={c.artist.avatar}
                            size="sm"
                          />
                          <span>{c.artist.name}</span>
                        </td>
                        <td className="py-3 px-3 text-zinc-500">{c.artist.role}</td>
                        <td className="py-3 px-3 font-semibold text-zinc-700">{c.assignedTasksCount} tasks</td>
                        <td className="py-3 px-3 font-mono font-bold text-zinc-900">{c.assignedSP} SP</td>
                        <td className="py-3 px-3 font-mono font-bold text-emerald-600">{c.completedSP} SP</td>
                        <td className="py-3 px-3 font-mono text-zinc-700">{c.loggedHoursInSprint}h</td>
                        <td className="py-3 px-3">
                          {c.varianceHours > 0 ? (
                            <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              +{c.varianceHours}h
                            </span>
                          ) : (
                            <span className="text-zinc-400 font-mono">0h</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {c.overdueTasksCount > 0 ? (
                            <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                              ⚠️ {c.overdueTasksCount} Overdue
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-medium">On schedule</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <div className="w-24">
                            <div className="flex justify-between text-[10px] text-zinc-500 font-bold mb-1">
                              <span>{c.completionRate}%</span>
                            </div>
                            <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  c.completionRate === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${c.completionRate}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: STUDIO VELOCITY & HISTORICAL SLAS                                 */}
      {/* ========================================================================= */}
      {activeTab === 'VELOCITY' && (
        <div className="space-y-6">
          {/* Top KPI Cards Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white border border-zinc-200 rounded-xl shadow-2xs">
              <span className="text-[11px] text-zinc-400 font-bold uppercase block">On-Time SLA Rate</span>
              <span className="text-2xl font-bold text-emerald-600">96.2%</span>
              <p className="text-[11px] text-zinc-500 mt-1">Target SLA: &ge;90%</p>
            </div>

            <div className="p-4 bg-white border border-zinc-200 rounded-xl shadow-2xs">
              <span className="text-[11px] text-zinc-400 font-bold uppercase block">Total Hours Logged</span>
              <span className="text-2xl font-bold text-zinc-900">
                {tasks.reduce((sum, t) => sum + (t.timeLogged || 0), 0)}h
              </span>
              <p className="text-[11px] text-zinc-500 mt-1">Across all project sprints</p>
            </div>

            <div className="p-4 bg-white border border-zinc-200 rounded-xl shadow-2xs">
              <span className="text-[11px] text-zinc-400 font-bold uppercase block">Delivered Assets</span>
              <span className="text-2xl font-bold text-indigo-700">
                {tasks.filter(t => t.status === 'DONE').length} tasks
              </span>
              <p className="text-[11px] text-zinc-500 mt-1">Delivered to production</p>
            </div>

            <div className="p-4 bg-white border border-zinc-200 rounded-xl shadow-2xs">
              <span className="text-[11px] text-zinc-400 font-bold uppercase block">Avg Revision Rate</span>
              <span className="text-2xl font-bold text-amber-600">11.8%</span>
              <p className="text-[11px] text-zinc-500 mt-1">Industry standard: &le;18%</p>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sprint Velocity Comparison */}
            <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs space-y-4">
              <div>
                <h2 className="text-sm font-bold text-zinc-900">Sprint Velocity (Planned vs Completed SP)</h2>
                <p className="text-xs text-zinc-500">Story points delivered across sprints</p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={velocityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip />
                    <Bar dataKey="planned" fill="#E2E8F0" radius={[4, 4, 0, 0]} name="Planned SP" />
                    <Bar dataKey="completed" fill="#10B981" radius={[4, 4, 0, 0]} name="Completed SP" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Revision Frequency by Art Category */}
            <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs space-y-4">
              <div>
                <h2 className="text-sm font-bold text-zinc-900">Revision Frequency by Art Discipline</h2>
                <p className="text-xs text-zinc-500">Total revision rounds per asset category</p>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revisionByCategoryData} layout="vertical" margin={{ top: 10, right: 10, left: 30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip />
                    <Bar dataKey="revisions" fill="#F59E0B" radius={[0, 4, 4, 0]} name="Revisions Logged" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: EFFORT VARIANCE & ESTIMATION ACCURACY                             */}
      {/* ========================================================================= */}
      {activeTab === 'EFFORT_VARIANCE' && (
        <div className="space-y-6">
          {/* KPI Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white border border-zinc-200 rounded-xl shadow-2xs">
              <span className="text-[11px] text-zinc-400 font-bold uppercase block">Estimation Accuracy</span>
              <span className="text-2xl font-bold text-emerald-600">{effortVarianceData.accuracyScore}%</span>
              <p className="text-[11px] text-zinc-500 mt-1">Variance tolerance &le; 15%</p>
            </div>

            <div className="p-4 bg-white border border-zinc-200 rounded-xl shadow-2xs">
              <span className="text-[11px] text-zinc-400 font-bold uppercase block">Total Baseline Estimates</span>
              <span className="text-2xl font-bold text-zinc-900">{effortVarianceData.totalEstimated}h</span>
              <p className="text-[11px] text-zinc-500 mt-1">Planned studio effort</p>
            </div>

            <div className="p-4 bg-white border border-zinc-200 rounded-xl shadow-2xs">
              <span className="text-[11px] text-zinc-400 font-bold uppercase block">Total Actual Logged</span>
              <span className="text-2xl font-bold text-zinc-900">{effortVarianceData.totalLogged}h</span>
              <p className="text-[11px] text-zinc-500 mt-1">Actual logged by artists</p>
            </div>

            <div className="p-4 bg-white border border-zinc-200 rounded-xl shadow-2xs">
              <span className="text-[11px] text-zinc-400 font-bold uppercase block">Effort Variance Delta</span>
              <span className={`text-2xl font-bold ${effortVarianceData.totalVarianceHours > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {effortVarianceData.totalVarianceHours > 0 ? `+${effortVarianceData.totalVarianceHours}h` : `${effortVarianceData.totalVarianceHours}h`}
              </span>
              <p className="text-[11px] text-zinc-500 mt-1">Net variance across all tasks</p>
            </div>
          </div>

          {/* Variance by Art Category Bar Chart */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-zinc-900">Effort Variance by Discipline (Estimated vs Logged Hours)</h2>
              <p className="text-xs text-zinc-500">Identify which art disciplines consistently experience effort overruns or under-estimations.</p>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={effortVarianceData.categoryBreakdown} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="category" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip />
                  <Bar dataKey="estimatedHours" fill="#94A3B8" radius={[4, 4, 0, 0]} name="Estimated Baseline (h)" />
                  <Bar dataKey="loggedHours" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Actual Logged (h)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table of Tasks with Highest Effort Overrun */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-zinc-900">Effort Overrun Ranking (Highest Variance Tasks)</h3>
              <p className="text-xs text-zinc-500">Tasks where actual logged hours exceeded original estimation.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Task ID</th>
                    <th className="py-2.5 px-3">Title</th>
                    <th className="py-2.5 px-3">Discipline</th>
                    <th className="py-2.5 px-3">Assignee</th>
                    <th className="py-2.5 px-3">Estimated</th>
                    <th className="py-2.5 px-3">Actual Logged</th>
                    <th className="py-2.5 px-3">Variance Overrun</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {effortVarianceData.overEstimatedTasksList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-zinc-400">
                        No effort overruns recorded across projects.
                      </td>
                    </tr>
                  ) : (
                    effortVarianceData.overEstimatedTasksList.map(({ task, originalEstimate, timeLogged, varianceHours, variancePercent }) => {
                      const assignedArtist = artists.find(a => a.id === task.artistId);
                      return (
                        <tr
                          key={task.id}
                          onClick={() => onSelectTask?.(task.id)}
                          className="hover:bg-amber-50/50 transition-colors cursor-pointer"
                        >
                          <td className="py-3 px-3 font-mono font-bold text-amber-800">{task.id}</td>
                          <td className="py-3 px-3 font-semibold text-zinc-900">{task.title}</td>
                          <td className="py-3 px-3 text-zinc-500">{task.taskType}</td>
                          <td className="py-3 px-3 text-zinc-700">{assignedArtist?.name || 'Unassigned'}</td>
                          <td className="py-3 px-3 font-mono text-zinc-600">{originalEstimate}h</td>
                          <td className="py-3 px-3 font-mono font-bold text-zinc-900">{timeLogged}h</td>
                          <td className="py-3 px-3 font-bold text-amber-800">
                            +{varianceHours}h (+{variancePercent}%)
                          </td>
                          <td className="py-3 px-3">
                            <TaskStatusBadge status={task.status} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
