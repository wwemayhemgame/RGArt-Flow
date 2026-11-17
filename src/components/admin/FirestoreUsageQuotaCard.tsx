import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Zap,
  Layers,
  HardDrive,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Copy,
  Trash2,
  Filter,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Gauge,
  ArrowUpRight,
  Database
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import {
  getDailyStats,
  subscribeToUsageStats,
  getActiveListeners,
  FIRESTORE_QUOTA_LIMITS,
  resetDailyUsageStats,
  FirestoreDailyStats
} from '../../lib/firestoreUsageTracker';
import { COLLECTIONS } from '../../lib/firestoreSync';
import { Task } from '../../types';

export const FirestoreUsageQuotaCard: React.FC = () => {
  const {
    tasks,
    projects,
    sprints,
    users,
    artists,
    requests,
    timeEntries,
    activityLogs,
    accessAuditLogs,
    notifications,
    deleteTask,
    refreshStudioData,
    isQuotaExceeded
  } = useArtOps();

  const [stats, setStats] = useState<FirestoreDailyStats>(getDailyStats());
  const [activeListeners, setActiveListeners] = useState(getActiveListeners());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [dedupSuccessMsg, setDedupSuccessMsg] = useState<string | null>(null);

  // Subscribe to real-time telemetry updates
  useEffect(() => {
    const unsub = subscribeToUsageStats(newStats => {
      setStats(newStats);
      setActiveListeners(getActiveListeners());
    });
    return () => unsub();
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (refreshStudioData) {
        await refreshStudioData();
      }
      setStats(getDailyStats());
      setActiveListeners(getActiveListeners());
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleResetTelemetry = () => {
    if (confirm('Reset local Firestore usage counters for today? Note: This only resets client-side tracker metrics.')) {
      resetDailyUsageStats();
      setStats(getDailyStats());
      setActiveListeners(getActiveListeners());
    }
  };

  // Quota computations
  const readsLimit = FIRESTORE_QUOTA_LIMITS.DAILY_READS;
  const writesLimit = FIRESTORE_QUOTA_LIMITS.DAILY_WRITES;
  const deletesLimit = FIRESTORE_QUOTA_LIMITS.DAILY_DELETES;

  const readsPercent = Math.min(100, Math.round((stats.readsToday / readsLimit) * 100));
  const writesPercent = Math.min(100, Math.round((stats.writesToday / writesLimit) * 100));
  const deletesPercent = Math.min(100, Math.round((stats.deletesToday / deletesLimit) * 100));

  const isApproachingQuota = readsPercent >= 80 || writesPercent >= 80 || isQuotaExceeded;
  const isNearLimit = readsPercent >= 95 || writesPercent >= 95 || isQuotaExceeded;

  // Largest Collections calculation
  const collectionStats = useMemo(() => {
    const list = [
      { name: 'Tasks (studio_tasks)', count: tasks.length, collection: COLLECTIONS.TASKS, estSizeKb: Math.round(tasks.length * 1.8) },
      { name: 'Activity Logs (activity_logs)', count: (activityLogs || []).length, collection: COLLECTIONS.ACTIVITY_LOGS, estSizeKb: Math.round((activityLogs || []).length * 0.9) },
      { name: 'Time Entries (time_entries)', count: (timeEntries || []).length, collection: COLLECTIONS.TIME_ENTRIES, estSizeKb: Math.round((timeEntries || []).length * 0.7) },
      { name: 'Audit Logs (audit_logs)', count: (accessAuditLogs || []).length, collection: COLLECTIONS.AUDIT_LOGS, estSizeKb: Math.round((accessAuditLogs || []).length * 0.8) },
      { name: 'Notifications (notifications)', count: (notifications || []).length, collection: COLLECTIONS.NOTIFICATIONS, estSizeKb: Math.round((notifications || []).length * 0.5) },
      { name: 'Requests (requests)', count: requests.length, collection: COLLECTIONS.REQUESTS, estSizeKb: Math.round(requests.length * 1.2) },
      { name: 'Users (users)', count: users.length, collection: COLLECTIONS.USERS, estSizeKb: Math.round(users.length * 1.0) },
      { name: 'Projects (projects)', count: projects.length, collection: COLLECTIONS.PROJECTS, estSizeKb: Math.round(projects.length * 2.2) },
      { name: 'Sprints (sprints)', count: sprints.length, collection: COLLECTIONS.SPRINTS, estSizeKb: Math.round(sprints.length * 0.6) },
      { name: 'Artists (artists)', count: artists.length, collection: COLLECTIONS.ARTISTS, estSizeKb: Math.round(artists.length * 0.8) }
    ];
    return list.sort((a, b) => b.count - a.count);
  }, [tasks.length, activityLogs.length, timeEntries.length, accessAuditLogs.length, notifications.length, requests.length, users.length, projects.length, sprints.length, artists.length]);

  // Most frequently queried collections
  const queriedCollections = useMemo(() => {
    const map = stats.queriesByCollection || {};
    const readsMap = stats.readsByCollection || {};
    const keys = Array.from(new Set([...Object.keys(map), ...Object.keys(readsMap)]));
    return keys
      .map(k => ({
        name: k,
        queries: map[k] || 0,
        reads: readsMap[k] || 0
      }))
      .sort((a, b) => b.reads - a.reads);
  }, [stats]);

  // Duplicate Tasks & Jira Tickets Detection
  const duplicateGroups = useMemo(() => {
    const jiraMap = new Map<string, Task[]>();
    tasks.forEach(t => {
      if (t.jiraIssueKey) {
        const key = t.jiraIssueKey.trim().toUpperCase();
        const list = jiraMap.get(key) || [];
        list.push(t);
        jiraMap.set(key, list);
      }
    });

    const duplicates: { key: string; tasks: Task[]; reason: string }[] = [];
    jiraMap.forEach((list, key) => {
      if (list.length > 1) {
        duplicates.push({
          key,
          tasks: list,
          reason: `Multiple (${list.length}) studio tasks linked to Jira ticket ${key}`
        });
      }
    });

    // Also check identical titles within same project
    const titleMap = new Map<string, Task[]>();
    tasks.forEach(t => {
      if (!t.jiraIssueKey && t.title) {
        const key = `${t.projectId}___${t.title.trim().toLowerCase()}`;
        const list = titleMap.get(key) || [];
        list.push(t);
        titleMap.set(key, list);
      }
    });

    titleMap.forEach((list, k) => {
      if (list.length > 1) {
        const sample = list[0];
        duplicates.push({
          key: `Title: ${sample.title}`,
          tasks: list,
          reason: `Identical task title repeated ${list.length} times in project ${sample.projectId}`
        });
      }
    });

    return duplicates;
  }, [tasks]);

  const totalDuplicateTasksCount = useMemo(() => {
    return duplicateGroups.reduce((acc, g) => acc + (g.tasks.length - 1), 0);
  }, [duplicateGroups]);

  // Handle removing redundant duplicate tasks (keeps first one, removes subsequent duplicates)
  const handleRemoveDuplicates = async (group: { key: string; tasks: Task[] }) => {
    if (!confirm(`Keep the primary task (${group.tasks[0].id}) and remove ${group.tasks.length - 1} redundant duplicate(s)?`)) {
      return;
    }
    const redundant = group.tasks.slice(1);
    for (const t of redundant) {
      await deleteTask(t.id);
    }
    setDedupSuccessMsg(`Successfully removed ${redundant.length} duplicate task(s) for ${group.key}.`);
    setTimeout(() => setDedupSuccessMsg(null), 4000);
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 90) return 'bg-rose-500';
    if (percent >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getBadgeColor = (percent: number) => {
    if (percent >= 90) return 'bg-rose-100 text-rose-800 border-rose-200';
    if (percent >= 70) return 'bg-amber-100 text-amber-800 border-amber-200';
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  };

  return (
    <div id="firestore-usage-quota-monitor" className="space-y-4">
      {/* Daily Quota Warning Banner */}
      {isApproachingQuota && (
        <div
          id="quota-warning-banner"
          className={`p-4 rounded-2xl border flex items-start gap-3.5 shadow-xs ${
            isNearLimit
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <div
            className={`p-2 rounded-xl mt-0.5 ${
              isNearLimit ? 'bg-rose-200 text-rose-800' : 'bg-amber-200 text-amber-800'
            }`}
          >
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold">
                {isNearLimit
                  ? 'CRITICAL: Firestore Daily Quota Limit Almost Reached'
                  : 'Warning: Approaching Firestore Daily Quota Threshold'}
              </h4>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/80 border border-current">
                {readsPercent}% Reads / {writesPercent}% Writes
              </span>
            </div>
            <p className="text-xs mt-1 leading-relaxed opacity-90">
              Your Google Cloud project is operating on the Firestore Spark Free Tier (50,000 reads/day, 20,000 writes/day).
              Automatic quota guards are currently active: unbounded collection queries have been halted, active sprint scoping is active,
              and compare-before-write caching prevents redundant writes.
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <a
                href="https://console.firebase.google.com"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white shadow-2xs hover:bg-zinc-50 border border-zinc-200 inline-flex items-center gap-1.5 transition-colors"
              >
                <span>Upgrade to Blaze Plan (Pay-as-you-go)</span>
                <ArrowUpRight size={12} />
              </a>
              <button
                type="button"
                onClick={handleManualRefresh}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white/70 hover:bg-white border border-current/20 transition-colors cursor-pointer"
              >
                Recheck Quota Status
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Quota Dashboard Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
              <Gauge size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Firestore Daily Quota & Usage Monitor</h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getBadgeColor(
                    Math.max(readsPercent, writesPercent)
                  )}`}
                >
                  {readsPercent < 80 && writesPercent < 80 ? 'Within Free Spark Quota' : 'High Usage'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time tracking of reads, writes, active snapshot listeners, and Jira sync operations for today.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh usage telemetry"
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleResetTelemetry}
              className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Reset today's local counters"
            >
              Reset Counters
            </button>
          </div>
        </div>

        {/* 4 Top Metric Gauges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Reads Today */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold">Reads Today</span>
              <span className="font-mono text-[11px] font-bold text-slate-700">
                {stats.readsToday.toLocaleString()} / {readsLimit.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full transition-all duration-500 ${getProgressColor(readsPercent)}`}
                style={{ width: `${readsPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px]">
              <span className="text-slate-400">Spark Free Limit</span>
              <span className="font-semibold text-slate-700">{readsPercent}% used</span>
            </div>
          </div>

          {/* Writes Today */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold">Writes Today</span>
              <span className="font-mono text-[11px] font-bold text-slate-700">
                {stats.writesToday.toLocaleString()} / {writesLimit.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full transition-all duration-500 ${getProgressColor(writesPercent)}`}
                style={{ width: `${writesPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px]">
              <span className="text-slate-400">Write-guarded</span>
              <span className="font-semibold text-slate-700">{writesPercent}% used</span>
            </div>
          </div>

          {/* Deletes Today */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span className="font-semibold">Deletes Today</span>
              <span className="font-mono text-[11px] font-bold text-slate-700">
                {stats.deletesToday.toLocaleString()} / {deletesLimit.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mt-2">
              <div
                className={`h-full transition-all duration-500 ${getProgressColor(deletesPercent)}`}
                style={{ width: `${deletesPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px]">
              <span className="text-slate-400">Prune Retention</span>
              <span className="font-semibold text-slate-700">{deletesPercent}% used</span>
            </div>
          </div>

          {/* Jira Sync Writes */}
          <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200/70">
            <div className="flex items-center justify-between text-xs text-blue-700 mb-1">
              <span className="font-semibold">Jira Sync Writes</span>
              <span className="font-mono text-[11px] font-bold text-blue-900">
                {stats.jiraSyncWritesToday.toLocaleString()} writes
              </span>
            </div>
            <div className="mt-2 text-xl font-bold text-blue-950 font-mono">
              {stats.jiraSyncWritesToday}
            </div>
            <div className="mt-1 text-[11px] text-blue-600">
              Unchanged Jira tickets skipped automatically (0 writes)
            </div>
          </div>
        </div>

        {/* Active Realtime Listeners Section */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-indigo-600" />
              <span className="text-xs font-bold text-slate-800">
                Active Realtime Snapshot Listeners ({activeListeners.length})
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-medium">
              Global listeners replaced with targeted sprint & limited listeners
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {activeListeners.length === 0 ? (
              <span className="text-xs text-slate-400 italic">No active listeners registered.</span>
            ) : (
              activeListeners.map((l, idx) => (
                <div
                  key={idx}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs flex items-center gap-1.5 shadow-2xs"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-mono font-bold text-slate-800">{l.collection}</span>
                  {l.description && (
                    <span className="text-[10px] text-slate-500 font-sans border-l border-slate-200 pl-1.5">
                      {l.description}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Duplicate Detection Alert & Manager */}
        <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Copy size={16} className={duplicateGroups.length > 0 ? 'text-amber-600' : 'text-emerald-600'} />
              <div>
                <span className="text-xs font-bold text-zinc-900">
                  Duplicate Task & Jira Ticket Detection
                </span>
                <p className="text-[11px] text-zinc-500">
                  {duplicateGroups.length === 0
                    ? 'No duplicate Jira issue keys or duplicated task records detected across projects.'
                    : `Found ${duplicateGroups.length} duplicate group(s) with ${totalDuplicateTasksCount} redundant task records.`}
                </p>
              </div>
            </div>

            {duplicateGroups.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDuplicateModal(!showDuplicateModal)}
                className="px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <span>{showDuplicateModal ? 'Hide Duplicates' : `Inspect & Clean (${duplicateGroups.length})`}</span>
                {showDuplicateModal ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            )}
          </div>

          {dedupSuccessMsg && (
            <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <CheckCircle2 size={14} />
              <span>{dedupSuccessMsg}</span>
            </div>
          )}

          {/* Expandable Duplicate Inspector */}
          {showDuplicateModal && duplicateGroups.length > 0 && (
            <div className="space-y-2.5 pt-2 border-t border-zinc-200">
              {duplicateGroups.map((group, gIdx) => (
                <div
                  key={gIdx}
                  className="bg-white p-3 rounded-xl border border-zinc-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                        {group.key}
                      </span>
                      <span className="text-xs text-zinc-700 font-medium">{group.reason}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 font-mono">
                      {group.tasks.map((t, idx) => (
                        <span
                          key={t.id}
                          className={`px-1.5 py-0.5 rounded ${
                            idx === 0
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold'
                              : 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          {idx === 0 ? `[Primary] ${t.id}` : t.id}
                        </span>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveDuplicates(group)}
                    className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-center shrink-0"
                  >
                    <Trash2 size={13} />
                    <span>Deduplicate</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Two-Column Breakdown: Largest Collections vs Most Queried Collections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
          {/* Largest Collections */}
          <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Database size={15} className="text-blue-600" />
                <span>Largest Collections (Document Count)</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">Ranked by doc count</span>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {collectionStats.slice(0, 6).map((col, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1.5 px-2 bg-white rounded-lg border border-slate-100 shadow-2xs"
                >
                  <span className="font-medium text-slate-700">{col.name}</span>
                  <div className="flex items-center gap-3 font-mono text-[11px]">
                    <span className="text-slate-400">~{col.estSizeKb} KB</span>
                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      {col.count.toLocaleString()} docs
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Most Frequently Queried Collections */}
          <div className="p-4 bg-slate-50/60 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                <Filter size={15} className="text-indigo-600" />
                <span>Most Frequently Queried Collections</span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">Today&apos;s activity</span>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {queriedCollections.length === 0 ? (
                <div className="text-xs text-slate-400 italic py-3 text-center">
                  No query logs recorded yet today.
                </div>
              ) : (
                queriedCollections.slice(0, 6).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs py-1.5 px-2 bg-white rounded-lg border border-slate-100 shadow-2xs"
                  >
                    <span className="font-mono font-medium text-slate-700">{item.name}</span>
                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      <span className="text-slate-400">{item.queries} queries</span>
                      <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {item.reads} doc reads
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
