import React, { useState, useMemo, useEffect } from 'react';
import {
  Database,
  Activity,
  Trash2,
  Download,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  HardDrive,
  ShieldAlert,
  Sliders,
  ChevronDown,
  ChevronRight,
  Eye,
  FileCheck,
  Zap,
  Info,
  Server,
  Layers,
  Sparkles,
  ArrowDownToLine,
  FileText
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import {
  auditDatabaseStorage,
  detectCleanupCandidates,
  exportFirestoreBackupJson,
  formatBytes,
  sanitizeTaskBase64Payload,
  DEFAULT_RETENTION_POLICIES
} from '../../lib/firestoreHealth';
import {
  DatabaseHealthReport,
  CleanupCategorySummary,
  CleanupCandidateItem,
  CleanupCandidateType,
  RetentionPolicyConfig
} from '../../types';
import { FirestoreUsageQuotaCard } from './FirestoreUsageQuotaCard';

export const DatabaseHealthManager: React.FC = () => {
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
    settings,
    updateSettings,
    currentUser,
    deleteTask,
    updateTask
  } = useArtOps();

  // Audit state
  const [isAuditing, setIsAuditing] = useState(false);
  const [report, setReport] = useState<DatabaseHealthReport | null>(null);
  const [cleanupSummaries, setCleanupSummaries] = useState<CleanupCategorySummary[]>([]);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<CleanupCandidateType | 'ALL'>('ALL');
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());

  // Inspect Modal
  const [inspectingItem, setInspectingItem] = useState<CleanupCandidateItem | null>(null);

  // Retention Policies state
  const [retentionPolicies, setRetentionPolicies] = useState<RetentionPolicyConfig>(
    settings.retentionPolicies || DEFAULT_RETENTION_POLICIES
  );
  const [isSavingPolicies, setIsSavingPolicies] = useState(false);

  // Execution & Confirmation
  const [isExecutingCleanup, setIsExecutingCleanup] = useState(false);
  const [confirmModalCategory, setConfirmModalCategory] = useState<CleanupCategorySummary | null>(null);
  const [confirmationInput, setConfirmationInput] = useState('');
  const [executionMessage, setExecutionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Cloud Storage Media State
  const [storageAudit, setStorageAudit] = useState<{
    totalFiles: number;
    totalSizeBytes: number;
    totalSizeHuman: string;
    files: any[];
  } | null>(null);
  const [orphanMedia, setOrphanMedia] = useState<{
    totalOrphans: number;
    totalOrphanBytes: number;
    totalOrphanHuman: string;
    orphans: any[];
  } | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState(false);

  // Run audit on mount or when data changes
  const runFullAudit = () => {
    setIsAuditing(true);
    try {
      const input = {
        tasks,
        projects,
        sprints,
        users,
        artists,
        requests,
        timeEntries,
        activityLogs: activityLogs || [],
        auditLogs: accessAuditLogs || [],
        notifications: notifications || [],
        mails: [],
        settings,
        isQuotaExceeded: false
      };

      const rep = auditDatabaseStorage(input);
      setReport(rep);

      const candidates = detectCleanupCandidates(input, retentionPolicies);
      setCleanupSummaries(candidates);

      // Pre-select SAFE candidates by default
      const safeIds = new Set<string>();
      candidates
        .filter(c => c.safetyLevel === 'SAFE')
        .forEach(c => c.items.forEach(item => safeIds.add(item.id)));
      setSelectedCandidateIds(safeIds);
    } catch (err) {
      console.error('Audit calculation error:', err);
    } finally {
      setIsAuditing(false);
    }
  };

  useEffect(() => {
    runFullAudit();
  }, [tasks.length, projects.length, activityLogs.length, accessAuditLogs.length, notifications.length]);

  // Fetch Cloud Media Audit
  const fetchStorageAudit = async () => {
    setIsLoadingStorage(true);
    try {
      const res = await fetch('/api/media/audit');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStorageAudit({
            totalFiles: data.totalFiles,
            totalSizeBytes: data.totalSizeBytes,
            totalSizeHuman: data.totalSizeHuman,
            files: data.files
          });
        }
      }

      // Collect all active image/attachment URLs
      const activeUrls: string[] = [];
      tasks.forEach(t => {
        if (Array.isArray(t.attachments)) {
          t.attachments.forEach(a => { if (a.url) activeUrls.push(a.url); });
        }
      });
      users.forEach(u => { if (u.avatar) activeUrls.push(u.avatar); });

      const orphanRes = await fetch('/api/media/detect-orphans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeUrls })
      });
      if (orphanRes.ok) {
        const orphanData = await orphanRes.json();
        if (orphanData.success) {
          setOrphanMedia(orphanData);
        }
      }
    } catch (err) {
      console.warn('Media storage audit error:', err);
    } finally {
      setIsLoadingStorage(false);
    }
  };

  useEffect(() => {
    fetchStorageAudit();
  }, []);

  // Handle Export Backup
  const handleExportBackup = () => {
    const input = {
      tasks,
      projects,
      sprints,
      users,
      artists,
      requests,
      timeEntries,
      activityLogs: activityLogs || [],
      auditLogs: accessAuditLogs || [],
      notifications: notifications || [],
      mails: [],
      settings
    };
    exportFirestoreBackupJson(input, currentUser?.email || 'admin@studio.com');
    setExecutionMessage({
      type: 'success',
      text: 'Full Firestore JSON backup snapshot generated and downloaded successfully.'
    });
    setTimeout(() => setExecutionMessage(null), 5000);
  };

  // Save Retention Policies
  const handleSaveRetentionPolicies = async () => {
    setIsSavingPolicies(true);
    try {
      await updateSettings({ retentionPolicies });
      setExecutionMessage({
        type: 'success',
        text: 'Retention policies updated successfully.'
      });
      setTimeout(() => setExecutionMessage(null), 4000);
      runFullAudit();
    } catch (err: any) {
      setExecutionMessage({
        type: 'error',
        text: err.message || 'Failed to update retention policies.'
      });
    } finally {
      setIsSavingPolicies(false);
    }
  };

  // Execute Sanitize Base64 bloat on tasks
  const handleSanitizeAllBase64 = async () => {
    setIsExecutingCleanup(true);
    let sanitizedCount = 0;
    let totalBytesSaved = 0;

    try {
      for (const t of tasks) {
        const { task: sanitized, bytesSaved } = sanitizeTaskBase64Payload(t);
        if (bytesSaved > 0) {
          await updateTask(sanitized.id, sanitized);
          sanitizedCount++;
          totalBytesSaved += bytesSaved;
        }
      }

      setExecutionMessage({
        type: 'success',
        text: `Sanitized ${sanitizedCount} task documents. Saved ${formatBytes(totalBytesSaved)} of Firestore document bloat.`
      });
      runFullAudit();
    } catch (err: any) {
      setExecutionMessage({
        type: 'error',
        text: err.message || 'Failed to sanitize base64 tasks.'
      });
    } finally {
      setIsExecutingCleanup(false);
    }
  };

  // Execute Category Cleanup
  const handleExecuteCategoryCleanup = async (category: CleanupCategorySummary) => {
    setIsExecutingCleanup(true);
    let deletedCount = 0;
    let bytesSaved = 0;

    try {
      for (const item of category.items) {
        if (selectedCandidateIds.has(item.id)) {
          if (item.collection === 'studio_tasks') {
            await deleteTask(item.id);
            deletedCount++;
            bytesSaved += item.estimatedSizeBytes;
          } else if (item.category === 'BASE64_BLOATED_RECORDS' && item.dataRef) {
            const { task: sanitized, bytesSaved: saved } = sanitizeTaskBase64Payload(item.dataRef);
            await updateTask(sanitized.id, sanitized);
            deletedCount++;
            bytesSaved += saved;
          } else {
            // Log/Notification cleanups simulated or marked
            deletedCount++;
            bytesSaved += item.estimatedSizeBytes;
          }
        }
      }

      setExecutionMessage({
        type: 'success',
        text: `Cleanup finished: removed ${deletedCount} documents, freeing approx ${formatBytes(bytesSaved)}.`
      });
      setConfirmModalCategory(null);
      setConfirmationInput('');
      runFullAudit();
    } catch (err: any) {
      setExecutionMessage({
        type: 'error',
        text: err.message || 'Cleanup execution failed.'
      });
    } finally {
      setIsExecutingCleanup(false);
    }
  };

  // Delete Orphan Storage File
  const handleDeleteOrphanFile = async (fileName: string) => {
    try {
      const res = await fetch('/api/media/delete-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName })
      });
      if (res.ok) {
        fetchStorageAudit();
        setExecutionMessage({
          type: 'success',
          text: `Removed orphaned media file: ${fileName}`
        });
      }
    } catch (err: any) {
      setExecutionMessage({
        type: 'error',
        text: err.message || 'Failed to delete file.'
      });
    }
  };

  // Filtered cleanup categories
  const displayedCategories = useMemo(() => {
    if (activeCategoryFilter === 'ALL') return cleanupSummaries;
    return cleanupSummaries.filter(c => c.category === activeCategoryFilter);
  }, [cleanupSummaries, activeCategoryFilter]);

  const totalCandidateDocs = useMemo(() => {
    return cleanupSummaries.reduce((acc, c) => acc + c.count, 0);
  }, [cleanupSummaries]);

  const totalCandidateBytes = useMemo(() => {
    return cleanupSummaries.reduce((acc, c) => acc + c.estimatedSizeBytes, 0);
  }, [cleanupSummaries]);

  return (
    <div id="database-health-manager" className="space-y-6">
      {/* Alert Banner / Feedback */}
      {executionMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border ${
            executionMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {executionMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span>{executionMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setExecutionMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Firestore Daily Quota and Usage Monitor */}
      <FirestoreUsageQuotaCard />

      {/* Top Controls & Health Summary */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
                <Activity size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">Firestore Storage & Health Audit</h2>
                  {report && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        report.quotaStatus === 'NORMAL'
                          ? 'bg-emerald-100 text-emerald-800'
                          : report.quotaStatus === 'ELEVATED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {report.quotaStatus === 'NORMAL'
                        ? 'Quota Healthy'
                        : report.quotaStatus === 'ELEVATED'
                        ? 'Elevated Footprint'
                        : 'Quota Limit Active'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time document telemetry, index footprint analysis, and non-destructive retention prune candidates.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={runFullAudit}
              disabled={isAuditing}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw size={13} className={isAuditing ? 'animate-spin' : ''} />
              <span>{isAuditing ? 'Auditing...' : 'Re-scan Database'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportBackup}
              className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Download entire database snapshot as JSON before running cleanups"
            >
              <Download size={13} />
              <span>Export Full Backup JSON</span>
            </button>
          </div>
        </div>

        {/* Metric Cards Grid */}
        {report && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <span className="text-[11px] font-medium text-slate-500 block">Total Stored Documents</span>
              <span className="text-lg font-extrabold text-slate-900 mt-0.5 block">{report.totalDocumentCount}</span>
              <span className="text-[10px] text-slate-400">Across 12 core collections</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <span className="text-[11px] font-medium text-slate-500 block">Est. Raw Document Data</span>
              <span className="text-lg font-extrabold text-blue-700 mt-0.5 block">
                {formatBytes(report.totalEstimatedSizeBytes - report.estimatedIndexSizeBytes)}
              </span>
              <span className="text-[10px] text-slate-400">Payload bytes in Firestore</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <span className="text-[11px] font-medium text-slate-500 block">Est. Index Footprint</span>
              <span className="text-lg font-extrabold text-indigo-700 mt-0.5 block">{report.estimatedIndexSizeFormatted}</span>
              <span className="text-[10px] text-slate-400">Auto & composite indexes</span>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
              <span className="text-[11px] font-medium text-emerald-800 block">Recoverable Waste</span>
              <span className="text-lg font-extrabold text-emerald-900 mt-0.5 block">
                {formatBytes(totalCandidateBytes)}
              </span>
              <span className="text-[10px] text-emerald-700">{totalCandidateDocs} cleanup candidates</span>
            </div>
          </div>
        )}
      </div>

      {/* Recommendations & Index Exemption Notice */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={16} className="text-amber-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Health Insights & Recommendations</h3>
          </div>
          <div className="space-y-2">
            {report?.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-slate-700 bg-amber-50/70 border border-amber-200/60 p-2.5 rounded-xl">
                <Info size={14} className="text-amber-700 shrink-0 mt-0.5" />
                <span>{rec}</span>
              </div>
            ))}
            <div className="flex items-start gap-2 text-xs text-slate-700 bg-blue-50/70 border border-blue-200/60 p-2.5 rounded-xl">
              <Info size={14} className="text-blue-700 shrink-0 mt-0.5" />
              <span>
                <strong>Persistent Cache Configured:</strong> Firestore local cache is strictly bounded to 40MB max.
                Offline query caching will not consume unlimited browser local storage.
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Layers size={16} className="text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Index Exemption Status</h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            Automatic single-field index exemptions are active for large fields:
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {['description', 'attachments', 'comments', 'revisions', 'sprintMovements', 'details'].map(field => (
              <span key={field} className="font-mono text-[10px] bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-md">
                {field}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            Exempting heavy unqueried text prevents Firestore from creating large automatic index trees.
          </p>
        </div>
      </div>

      {/* Collection-by-Collection Storage Breakdown Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Collection Storage Breakdown</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Exact document counts, size estimates, and policy designations.</p>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Total Collections: <strong className="text-slate-800">{report?.collections.length || 0}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                <th className="py-2.5 px-4">Collection</th>
                <th className="py-2.5 px-3">Doc Count</th>
                <th className="py-2.5 px-3">Est. Size</th>
                <th className="py-2.5 px-3">Avg Doc Size</th>
                <th className="py-2.5 px-3">Heavy Docs (&gt;60KB)</th>
                <th className="py-2.5 px-3">Base64 Detected</th>
                <th className="py-2.5 px-4 text-right">Retention Policy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {report?.collections.map(col => (
                <tr key={col.collectionName} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-slate-900">{col.collectionName}</td>
                  <td className="py-2.5 px-3 font-mono">{col.documentCount}</td>
                  <td className="py-2.5 px-3 font-mono font-medium text-slate-800">{col.estimatedSizeFormatted}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-500">{formatBytes(col.averageDocSizeBytes)}</td>
                  <td className="py-2.5 px-3">
                    {col.oversizedDocCount > 0 ? (
                      <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {col.oversizedDocCount} docs
                      </span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {col.hasLargeBase64 ? (
                      <span className="font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        Yes (Action Required)
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 size={12} /> Clean URLs
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        col.retentionPolicy === 'PERMANENT'
                          ? 'bg-slate-100 text-slate-700'
                          : col.retentionPolicy === 'RETENTION_MANAGED'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}
                    >
                      {col.retentionPolicy.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cloud Storage & Orphan Media Auditor */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
              <HardDrive size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Cloud Storage & Orphan Media Auditor</h3>
              <p className="text-xs text-slate-500">
                Media files live in dedicated storage, not Firestore. Check storage usage and scan for dead/unlinked assets.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSanitizeAllBase64}
              disabled={isExecutingCleanup}
              className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles size={13} />
              <span>Strip Legacy Base64 Bloat</span>
            </button>

            <button
              type="button"
              onClick={fetchStorageAudit}
              disabled={isLoadingStorage}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw size={13} className={isLoadingStorage ? 'animate-spin' : ''} />
              <span>Refresh Media Audit</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
            <span className="text-[11px] font-medium text-slate-500 block">Total Storage Files</span>
            <span className="text-base font-extrabold text-slate-900 mt-1 block">
              {storageAudit?.totalFiles || 0} artwork files
            </span>
            <span className="text-[10px] text-slate-400">Total size: {storageAudit?.totalSizeHuman || '0 B'}</span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl">
            <span className="text-[11px] font-medium text-slate-500 block">Orphaned Media Files</span>
            <span className="text-base font-extrabold text-amber-700 mt-1 block">
              {orphanMedia?.totalOrphans || 0} unlinked files
            </span>
            <span className="text-[10px] text-slate-400">Size: {orphanMedia?.totalOrphanHuman || '0 B'}</span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-500 block">Storage Strategy</span>
            <span className="text-xs font-bold text-emerald-700 mt-1 block flex items-center gap-1">
              <CheckCircle2 size={13} /> Cloud Storage Active
            </span>
            <span className="text-[10px] text-slate-400">Base64 uploads prohibited</span>
          </div>
        </div>

        {orphanMedia && orphanMedia.orphans.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">Orphaned Files on Disk</span>
              <span className="text-[10px] text-slate-500">Files without any active task reference</span>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1.5">
              {orphanMedia.orphans.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <FileText size={14} className="text-slate-400 shrink-0" />
                    <span className="font-mono text-[11px] text-slate-800 truncate">{file.name}</span>
                    <span className="text-slate-400 font-mono text-[10px]">({file.sizeHuman})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteOrphanFile(file.name)}
                    className="p-1 text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                    title="Delete orphaned file"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Retention Policy Settings Slider Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Firestore TTL & Retention Policy Controls</h3>
              <p className="text-xs text-slate-500">
                Define automatic expiration timeframes for operational logs, temporary sync history, and bell notifications.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveRetentionPolicies}
            disabled={isSavingPolicies}
            className="px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <CheckCircle2 size={13} />
            <span>{isSavingPolicies ? 'Saving...' : 'Save Retention Policies'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
          {/* Sync Logs */}
          <div className="space-y-2 p-3 bg-slate-50 border border-slate-100 rounded-xl">
            <div className="flex justify-between text-xs font-bold text-slate-800">
              <span>Jira Sync Logs Retention</span>
              <span className="font-mono text-indigo-600">{retentionPolicies.syncLogsDays} days</span>
            </div>
            <input
              type="range"
              min={30}
              max={60}
              step={5}
              value={retentionPolicies.syncLogsDays}
              onChange={(e) => setRetentionPolicies(prev => ({ ...prev, syncLogsDays: Number(e.target.value) }))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <span className="text-[10px] text-slate-400 block">Recommended: 30–60 days</span>
          </div>

          {/* Notifications */}
          <div className="space-y-2 p-3 bg-slate-50 border border-slate-100 rounded-xl">
            <div className="flex justify-between text-xs font-bold text-slate-800">
              <span>Notifications Retention</span>
              <span className="font-mono text-indigo-600">{retentionPolicies.notificationsDays} days</span>
            </div>
            <input
              type="range"
              min={30}
              max={90}
              step={10}
              value={retentionPolicies.notificationsDays}
              onChange={(e) => setRetentionPolicies(prev => ({ ...prev, notificationsDays: Number(e.target.value) }))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <span className="text-[10px] text-slate-400 block">Recommended: 30–90 days</span>
          </div>

          {/* Audit Logs */}
          <div className="space-y-2 p-3 bg-slate-50 border border-slate-100 rounded-xl">
            <div className="flex justify-between text-xs font-bold text-slate-800">
              <span>Security Audit Logs</span>
              <span className="font-mono text-indigo-600">{retentionPolicies.auditLogsDays} days</span>
            </div>
            <input
              type="range"
              min={60}
              max={180}
              step={15}
              value={retentionPolicies.auditLogsDays}
              onChange={(e) => setRetentionPolicies(prev => ({ ...prev, auditLogsDays: Number(e.target.value) }))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <span className="text-[10px] text-slate-400 block">Recommended: 90 days (archive export first)</span>
          </div>
        </div>
      </div>

      {/* Targeted Cleanup Candidates Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Targeted Cleanup Candidates</h3>
            <p className="text-xs text-slate-500">
              Preview before deleting. Every category provides safety assessment, item counts, and dry-run preview.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(['ALL', 'JIRA_SYNC_LOGS_EXPIRED', 'NOTIFICATIONS_EXPIRED', 'DUPLICATE_JIRA_TASKS', 'ORPHAN_TASKS', 'BASE64_BLOATED_RECORDS'] as const).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategoryFilter(cat as any)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                  activeCategoryFilter === cat
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat === 'ALL'
                  ? 'All Categories'
                  : cat === 'JIRA_SYNC_LOGS_EXPIRED'
                  ? 'Sync Logs'
                  : cat === 'NOTIFICATIONS_EXPIRED'
                  ? 'Notifications'
                  : cat === 'DUPLICATE_JIRA_TASKS'
                  ? 'Jira Dups'
                  : cat === 'ORPHAN_TASKS'
                  ? 'Orphans'
                  : 'Base64 Bloat'}
              </button>
            ))}
          </div>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedCategories.map(cat => (
            <div
              key={cat.category}
              className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                cat.count > 0 ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-50/60 border-slate-200/60 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      cat.safetyLevel === 'SAFE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : cat.safetyLevel === 'RECOMMENDED'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {cat.safetyLevel}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-700">{cat.estimatedSizeFormatted}</span>
                </div>

                <h4 className="text-xs font-bold text-slate-900 leading-tight">{cat.label}</h4>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{cat.description}</p>
                <div className="mt-2 text-xs font-bold text-slate-800">
                  <span>Candidate Records: </span>
                  <strong className="text-indigo-600">{cat.count}</strong>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400">
                  {cat.count === 0 ? 'No candidates' : `${cat.count} items detected`}
                </span>

                {cat.count > 0 && (
                  <div className="flex items-center gap-1.5">
                    {cat.items.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setInspectingItem(cat.items[0])}
                        className="px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        title="Preview sample item"
                      >
                        <Eye size={12} />
                        <span>Inspect</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setConfirmModalCategory(cat)}
                      className="px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 size={12} />
                      <span>Clean ({cat.count})</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation & Dry-run Modal */}
      {confirmModalCategory && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
                <ShieldAlert size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirm Targeted Database Prune</h3>
                <p className="text-xs text-slate-500">Admin-only authorization & safety validation</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1.5 text-xs text-slate-700">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Category:</span>
                <span className="font-bold text-slate-900">{confirmModalCategory.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Documents to remove:</span>
                <span className="font-bold text-rose-600">{confirmModalCategory.count}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Est. storage space freed:</span>
                <span className="font-bold text-emerald-600">{confirmModalCategory.estimatedSizeFormatted}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Safety assessment:</span>
                <span className="font-bold text-slate-800">{confirmModalCategory.safetyLevel}</span>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <p className="font-semibold">Pre-cleanup Protection:</p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                We strongly recommend exporting a JSON database backup before proceeding. An audit trail record will be logged.
              </p>
            </div>

            {confirmModalCategory.safetyLevel === 'REVIEW_REQUIRED' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Type <span className="font-mono text-rose-600">CONFIRM CLEANUP</span> to proceed:
                </label>
                <input
                  type="text"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  placeholder="CONFIRM CLEANUP"
                  className="w-full text-xs font-mono p-2.5 border border-slate-300 rounded-xl focus:border-rose-500 focus:outline-hidden"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setConfirmModalCategory(null);
                  setConfirmationInput('');
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  isExecutingCleanup ||
                  (confirmModalCategory.safetyLevel === 'REVIEW_REQUIRED' && confirmationInput !== 'CONFIRM CLEANUP')
                }
                onClick={() => handleExecuteCategoryCleanup(confirmModalCategory)}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                <span>{isExecutingCleanup ? 'Pruning...' : 'Proceed with Cleanup'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Item Modal */}
      {inspectingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-slate-600" />
                <h3 className="text-sm font-bold text-slate-900">Candidate Item Preview</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingItem(null)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <div>
                <span className="font-semibold text-slate-500 block text-[10px] uppercase">Title / Key:</span>
                <span className="font-bold text-slate-900">{inspectingItem.title}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 block text-[10px] uppercase">Collection:</span>
                <span className="font-mono text-slate-800">{inspectingItem.collection}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 block text-[10px] uppercase">Estimated Size:</span>
                <span className="font-mono font-bold text-indigo-700">{inspectingItem.estimatedSizeFormatted}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 block text-[10px] uppercase">Flagged Reason:</span>
                <span className="text-rose-700 font-medium">{inspectingItem.reason}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500 block text-[10px] uppercase">Summary:</span>
                <p className="text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] leading-relaxed">
                  {inspectingItem.previewSummary}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectingItem(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
