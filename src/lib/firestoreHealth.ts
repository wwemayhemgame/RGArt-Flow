import {
  Task,
  Project,
  Sprint,
  User,
  Artist,
  CompanyRequest,
  TimeEntry,
  ActivityLog,
  AccessAuditRecord,
  AppNotification,
  StudioMail,
  StudioSettings,
  DatabaseHealthReport,
  CollectionStorageStat,
  CleanupCategorySummary,
  CleanupCandidateItem,
  CleanupCandidateType,
  RetentionPolicyConfig
} from '../types';

export const DEFAULT_RETENTION_POLICIES: RetentionPolicyConfig = {
  syncLogsDays: 30, // 30-60 days
  notificationsDays: 90, // 30-90 days
  auditLogsDays: 90, // 90 days
  debugLogsDays: 14, // 7-30 days
  temporaryAiLogsDays: 14, // 7-30 days
  importStagingDays: 7 // 1-7 days
};

export interface DatabaseAuditInput {
  tasks: Task[];
  projects: Project[];
  sprints: Sprint[];
  users: User[];
  artists: Artist[];
  requests: CompanyRequest[];
  timeEntries: TimeEntry[];
  activityLogs: ActivityLog[];
  auditLogs: AccessAuditRecord[];
  notifications: AppNotification[];
  mails: StudioMail[];
  settings: StudioSettings;
  isQuotaExceeded?: boolean;
}

/**
 * Format bytes to readable string (B, KB, MB, GB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Estimate size of an object in bytes when serialized
 */
export function estimateObjectSizeBytes(obj: any): number {
  if (!obj) return 0;
  try {
    const str = JSON.stringify(obj);
    return new Blob([str]).size + 32; // 32 bytes Firestore per-document base overhead
  } catch {
    return 128;
  }
}

/**
 * Check if a document contains inline Base64 data strings (e.g. data:image/... or large base64)
 */
export function checkHasLargeBase64(obj: any): boolean {
  if (!obj) return false;
  try {
    const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return str.includes('data:image/') || str.includes(';base64,') || /"url"\s*:\s*"data:[^"]{1000,}"/.test(str);
  } catch {
    return false;
  }
}

/**
 * Calculate full storage breakdown across all collections
 */
export function auditDatabaseStorage(input: DatabaseAuditInput): DatabaseHealthReport {
  const {
    tasks,
    projects,
    sprints,
    users,
    artists,
    requests,
    timeEntries,
    activityLogs,
    auditLogs,
    notifications,
    mails,
    settings,
    isQuotaExceeded
  } = input;

  const collections: CollectionStorageStat[] = [];

  const addStat = (
    name: string,
    items: any[],
    policy: 'PERMANENT' | 'RETENTION_MANAGED' | 'DISPOSABLE_STAGING'
  ) => {
    let totalBytes = 0;
    let oversized = 0;
    let hasBase64 = false;

    items.forEach(item => {
      const sz = estimateObjectSizeBytes(item);
      totalBytes += sz;
      if (sz > 60 * 1024) oversized++; // > 60KB
      if (!hasBase64 && checkHasLargeBase64(item)) hasBase64 = true;
    });

    collections.push({
      collectionName: name,
      documentCount: items.length,
      estimatedSizeBytes: totalBytes,
      estimatedSizeFormatted: formatBytes(totalBytes),
      averageDocSizeBytes: items.length > 0 ? Math.round(totalBytes / items.length) : 0,
      oversizedDocCount: oversized,
      hasLargeBase64: hasBase64,
      retentionPolicy: policy
    });
  };

  addStat('Tasks (studio_tasks)', tasks, 'PERMANENT');
  addStat('Projects (studio_projects)', projects, 'PERMANENT');
  addStat('Sprints (studio_sprints)', sprints, 'PERMANENT');
  addStat('Users & Auth (studio_users)', users, 'PERMANENT');
  addStat('Artists Roster (studio_artists)', artists, 'PERMANENT');
  addStat('Company Requests (studio_requests)', requests, 'PERMANENT');
  addStat('Time Entries & WorkLogs (studio_time_entries)', timeEntries, 'PERMANENT');
  addStat('Activity & Sync Logs (studio_activity_logs)', activityLogs, 'RETENTION_MANAGED');
  addStat('Audit Logs & Security (studio_audit_logs)', auditLogs, 'RETENTION_MANAGED');
  addStat('Notifications (studio_notifications)', notifications, 'RETENTION_MANAGED');
  addStat('Studio Mails (studio_mails)', mails, 'DISPOSABLE_STAGING');
  addStat('Studio Settings (studio_settings)', [settings], 'PERMANENT');

  const totalSizeBytes = collections.reduce((acc, c) => acc + c.estimatedSizeBytes, 0);
  const totalDocs = collections.reduce((acc, c) => acc + c.documentCount, 0);

  // Firestore single-field and composite index overhead typically represents 45-65% of stored field data
  const estimatedIndexSizeBytes = Math.round(totalSizeBytes * 0.52);

  const recommendations: string[] = [];
  if (isQuotaExceeded) {
    recommendations.push('Firestore shared quota limit has been flagged. Use the targeted cleanup tool to remove expired logs and duplicate records.');
  }

  const tasksStat = collections.find(c => c.collectionName.startsWith('Tasks'));
  if (tasksStat && tasksStat.hasLargeBase64) {
    recommendations.push('Tasks contain raw inline Base64 media. Upload assets to Cloud Storage and save lightweight URLs to prevent bloated documents.');
  }

  const logsStat = collections.find(c => c.collectionName.startsWith('Activity'));
  if (logsStat && logsStat.documentCount > 50) {
    recommendations.push(`Activity and Jira sync logs have ${logsStat.documentCount} records. Applying the 30-day retention policy will free space.`);
  }

  const notifStat = collections.find(c => c.collectionName.startsWith('Notifications'));
  if (notifStat && notifStat.documentCount > 30) {
    recommendations.push(`Notifications collection has ${notifStat.documentCount} items. Clean notifications older than 90 days.`);
  }

  return {
    timestamp: new Date().toISOString(),
    totalEstimatedSizeBytes: totalSizeBytes + estimatedIndexSizeBytes,
    totalEstimatedSizeFormatted: formatBytes(totalSizeBytes + estimatedIndexSizeBytes),
    totalDocumentCount: totalDocs,
    estimatedIndexSizeBytes,
    estimatedIndexSizeFormatted: formatBytes(estimatedIndexSizeBytes),
    collections,
    quotaStatus: isQuotaExceeded ? 'QUOTA_EXCEEDED' : totalSizeBytes > 50 * 1024 * 1024 ? 'ELEVATED' : 'NORMAL',
    cacheStorageEstimate: formatBytes(Math.min(totalSizeBytes, 40 * 1024 * 1024)),
    recommendations
  };
}

/**
 * Detect cleanup candidate records based on retention policies and integrity rules
 */
export function detectCleanupCandidates(
  input: DatabaseAuditInput,
  customRetention?: RetentionPolicyConfig
): CleanupCategorySummary[] {
  const {
    tasks,
    projects,
    activityLogs,
    auditLogs,
    notifications,
    timeEntries
  } = input;

  const retention = customRetention || input.settings.retentionPolicies || DEFAULT_RETENTION_POLICIES;
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const projectIdsSet = new Set(projects.map(p => p.id));
  const taskIdsSet = new Set(tasks.map(t => t.id));

  const summaries: CleanupCategorySummary[] = [];

  // 1. Expired Jira Sync Logs & Activity Logs (> retention.syncLogsDays, default 30d)
  const syncLogsCutoff = now - retention.syncLogsDays * DAY_MS;
  const expiredLogs: CleanupCandidateItem[] = [];
  activityLogs.forEach(log => {
    const logTime = new Date(log.timestamp).getTime();
    if (logTime < syncLogsCutoff) {
      const sz = estimateObjectSizeBytes(log);
      expiredLogs.push({
        id: log.id,
        collection: 'studio_activity_logs',
        title: log.action || 'Activity Log Record',
        category: 'JIRA_SYNC_LOGS_EXPIRED',
        estimatedSizeBytes: sz,
        estimatedSizeFormatted: formatBytes(sz),
        createdAt: log.timestamp,
        reason: `Exceeds ${retention.syncLogsDays}-day retention policy (${Math.round((now - logTime) / DAY_MS)} days old)`,
        previewSummary: `${log.userName || 'System'}: ${log.details || log.action}`,
        safeToClean: true,
        requiresExportFirst: false,
        dataRef: log
      });
    }
  });

  summaries.push({
    category: 'JIRA_SYNC_LOGS_EXPIRED',
    label: `Jira Sync & Activity Logs (> ${retention.syncLogsDays} days)`,
    description: `Operational event records and background sync logs older than ${retention.syncLogsDays} days. Safe to prune.`,
    count: expiredLogs.length,
    estimatedSizeBytes: expiredLogs.reduce((a, b) => a + b.estimatedSizeBytes, 0),
    estimatedSizeFormatted: formatBytes(expiredLogs.reduce((a, b) => a + b.estimatedSizeBytes, 0)),
    safetyLevel: 'SAFE',
    items: expiredLogs
  });

  // 2. Expired Notifications (> retention.notificationsDays, default 90d)
  const notifCutoff = now - retention.notificationsDays * DAY_MS;
  const expiredNotifs: CleanupCandidateItem[] = [];
  notifications.forEach(notif => {
    const notifTime = new Date(notif.timestamp).getTime();
    if (notifTime < notifCutoff) {
      const sz = estimateObjectSizeBytes(notif);
      expiredNotifs.push({
        id: notif.id,
        collection: 'studio_notifications',
        title: notif.title || 'App Notification',
        category: 'NOTIFICATIONS_EXPIRED',
        estimatedSizeBytes: sz,
        estimatedSizeFormatted: formatBytes(sz),
        createdAt: notif.timestamp,
        reason: `Exceeds ${retention.notificationsDays}-day retention policy (${Math.round((now - notifTime) / DAY_MS)} days old)`,
        previewSummary: notif.message,
        safeToClean: true,
        requiresExportFirst: false,
        dataRef: notif
      });
    }
  });

  summaries.push({
    category: 'NOTIFICATIONS_EXPIRED',
    label: `Notifications (> ${retention.notificationsDays} days)`,
    description: `Historical read/unread bell notifications older than ${retention.notificationsDays} days. Safe to prune.`,
    count: expiredNotifs.length,
    estimatedSizeBytes: expiredNotifs.reduce((a, b) => a + b.estimatedSizeBytes, 0),
    estimatedSizeFormatted: formatBytes(expiredNotifs.reduce((a, b) => a + b.estimatedSizeBytes, 0)),
    safetyLevel: 'SAFE',
    items: expiredNotifs
  });

  // 3. Expired Audit Logs (> retention.auditLogsDays, default 90d)
  const auditCutoff = now - retention.auditLogsDays * DAY_MS;
  const expiredAudit: CleanupCandidateItem[] = [];
  auditLogs.forEach(aud => {
    const audTime = new Date(aud.timestamp).getTime();
    if (audTime < auditCutoff) {
      const sz = estimateObjectSizeBytes(aud);
      expiredAudit.push({
        id: aud.id,
        collection: 'studio_audit_logs',
        title: `Audit: ${aud.projectName || 'Security Log'}`,
        category: 'AUDIT_LOGS_EXPIRED',
        estimatedSizeBytes: sz,
        estimatedSizeFormatted: formatBytes(sz),
        createdAt: aud.timestamp,
        reason: `Exceeds ${retention.auditLogsDays}-day retention policy (${Math.round((now - audTime) / DAY_MS)} days old)`,
        previewSummary: `${aud.changedByName} modified ${aud.userName} on ${aud.projectName} (${aud.previousAccess} -> ${aud.newAccess})`,
        safeToClean: true,
        requiresExportFirst: true,
        dataRef: aud
      });
    }
  });

  summaries.push({
    category: 'AUDIT_LOGS_EXPIRED',
    label: `Access Audit Logs (> ${retention.auditLogsDays} days)`,
    description: `Login and access verification logs older than ${retention.auditLogsDays} days. Archive backup recommended before deletion.`,
    count: expiredAudit.length,
    estimatedSizeBytes: expiredAudit.reduce((a, b) => a + b.estimatedSizeBytes, 0),
    estimatedSizeFormatted: formatBytes(expiredAudit.reduce((a, b) => a + b.estimatedSizeBytes, 0)),
    safetyLevel: 'RECOMMENDED',
    items: expiredAudit
  });

  // 4. Duplicate Jira Records (multiple tasks linked to the same Jira issue key or ID)
  const jiraMap = new Map<string, Task[]>();
  tasks.forEach(t => {
    if (t.jiraIssueKey) {
      const key = t.jiraIssueKey.trim().toUpperCase();
      const existing = jiraMap.get(key) || [];
      existing.push(t);
      jiraMap.set(key, existing);
    }
  });

  const duplicateTasks: CleanupCandidateItem[] = [];
  jiraMap.forEach((tasksList, key) => {
    if (tasksList.length > 1) {
      // Sort so the newest / most up-to-date remains, older ones are marked for cleanup
      tasksList.sort((a, b) => {
        const timeA = new Date(a.expectedDelivery || a.createdDate || '').getTime();
        const timeB = new Date(b.expectedDelivery || b.createdDate || '').getTime();
        return timeB - timeA;
      });

      // Skip index 0 (primary active task), flag 1..N
      for (let i = 1; i < tasksList.length; i++) {
        const dup = tasksList[i];
        const sz = estimateObjectSizeBytes(dup);
        duplicateTasks.push({
          id: dup.id,
          collection: 'studio_tasks',
          title: `[${dup.id}] ${dup.title}`,
          category: 'DUPLICATE_JIRA_TASKS',
          estimatedSizeBytes: sz,
          estimatedSizeFormatted: formatBytes(sz),
          createdAt: dup.createdDate,
          reason: `Duplicate Jira Issue Key ${key} (Canonical active task is ${tasksList[0].id})`,
          previewSummary: `Linked to Jira ${key}. Status: ${dup.status}. Duplicate instance.`,
          safeToClean: false,
          requiresExportFirst: true,
          dataRef: dup
        });
      }
    }
  });

  summaries.push({
    category: 'DUPLICATE_JIRA_TASKS',
    label: 'Duplicate Jira Issue Records',
    description: 'Multiple Studio task documents linked to the identical Jira Issue Key. Keeps canonical newest version.',
    count: duplicateTasks.length,
    estimatedSizeBytes: duplicateTasks.reduce((a, b) => a + b.estimatedSizeBytes, 0),
    estimatedSizeFormatted: formatBytes(duplicateTasks.reduce((a, b) => a + b.estimatedSizeBytes, 0)),
    safetyLevel: 'REVIEW_REQUIRED',
    items: duplicateTasks
  });

  // 5. Orphan Tasks (projectId does not exist in projects list)
  const orphanTasks: CleanupCandidateItem[] = [];
  tasks.forEach(t => {
    if (t.projectId && !projectIdsSet.has(t.projectId)) {
      const sz = estimateObjectSizeBytes(t);
      orphanTasks.push({
        id: t.id,
        collection: 'studio_tasks',
        title: `[${t.id}] ${t.title}`,
        category: 'ORPHAN_TASKS',
        estimatedSizeBytes: sz,
        estimatedSizeFormatted: formatBytes(sz),
        createdAt: t.createdDate,
        reason: `Referenced project ID '${t.projectId}' no longer exists in studio projects`,
        previewSummary: `Task belongs to deleted project ID: ${t.projectId}.`,
        safeToClean: false,
        requiresExportFirst: true,
        dataRef: t
      });
    }
  });

  summaries.push({
    category: 'ORPHAN_TASKS',
    label: 'Orphan Tasks (Project Deleted)',
    description: 'Tasks referencing project IDs that were deleted or no longer exist in the system.',
    count: orphanTasks.length,
    estimatedSizeBytes: orphanTasks.reduce((a, b) => a + b.estimatedSizeBytes, 0),
    estimatedSizeFormatted: formatBytes(orphanTasks.reduce((a, b) => a + b.estimatedSizeBytes, 0)),
    safetyLevel: 'REVIEW_REQUIRED',
    items: orphanTasks
  });

  // 6. Orphan Comments & Sub-elements (comments or work logs pointing to deleted tasks)
  const orphanWorklogs: CleanupCandidateItem[] = [];
  timeEntries.forEach(entry => {
    if (entry.taskId && !taskIdsSet.has(entry.taskId)) {
      const sz = estimateObjectSizeBytes(entry);
      orphanWorklogs.push({
        id: entry.id,
        collection: 'studio_time_entries',
        title: `WorkLog: ${entry.taskTitle || entry.taskId}`,
        category: 'ORPHAN_COMMENTS',
        estimatedSizeBytes: sz,
        estimatedSizeFormatted: formatBytes(sz),
        createdAt: entry.date,
        reason: `Referenced task ID '${entry.taskId}' has been deleted`,
        previewSummary: `${entry.artistName} logged ${entry.hours}h on nonexistent task ${entry.taskId}`,
        safeToClean: true,
        requiresExportFirst: false,
        dataRef: entry
      });
    }
  });

  summaries.push({
    category: 'ORPHAN_COMMENTS',
    label: 'Orphan WorkLogs / Time Entries',
    description: 'Time entries referencing tasks that have already been purged from the studio.',
    count: orphanWorklogs.length,
    estimatedSizeBytes: orphanWorklogs.reduce((a, b) => a + b.estimatedSizeBytes, 0),
    estimatedSizeFormatted: formatBytes(orphanWorklogs.reduce((a, b) => a + b.estimatedSizeBytes, 0)),
    safetyLevel: 'RECOMMENDED',
    items: orphanWorklogs
  });

  // 7. Completed / Excluded Jira Imports (Done, Completed, Verified, or wrong projects like American Dad)
  const excludedJiraTasks: CleanupCandidateItem[] = [];
  const EXCLUDED_STATUSES = new Set(['DONE', 'COMPLETED', 'VERIFIED', 'RESOLVED', 'CLOSED', 'APPROVED']);
  tasks.forEach(t => {
    if (t.isJiraImported || t.jiraIssueKey) {
      const statusUpper = (t.jiraStatusName || t.status || '').toUpperCase();
      const projNameUpper = (t.jiraProjectName || t.jiraProjectKey || '').toUpperCase();
      const isExcludedStatus = EXCLUDED_STATUSES.has(statusUpper);
      const isExcludedProject = projNameUpper.includes('AMERICAN DAD') || projNameUpper.includes('AD_') || projNameUpper === 'AD';

      if (isExcludedStatus || isExcludedProject) {
        const sz = estimateObjectSizeBytes(t);
        excludedJiraTasks.push({
          id: t.id,
          collection: 'studio_tasks',
          title: `[${t.jiraIssueKey || t.id}] ${t.title}`,
          category: 'COMPLETED_EXCLUDED_JIRA_IMPORTS',
          estimatedSizeBytes: sz,
          estimatedSizeFormatted: formatBytes(sz),
          createdAt: t.createdDate,
          reason: isExcludedProject
            ? `Excluded external project (${t.jiraProjectName || t.jiraProjectKey})`
            : `Completed/Verified Jira status (${t.jiraStatusName || t.status})`,
          previewSummary: `Jira ${t.jiraIssueKey}. Status: ${t.jiraStatusName || t.status}. Project: ${t.jiraProjectName || t.jiraProjectKey}`,
          safeToClean: false,
          requiresExportFirst: true,
          dataRef: t
        });
      }
    }
  });

  summaries.push({
    category: 'COMPLETED_EXCLUDED_JIRA_IMPORTS',
    label: 'Completed / Excluded Jira Imports',
    description: 'Imported Jira tickets that are already Completed, Verified, Approved, or belong to excluded project categories.',
    count: excludedJiraTasks.length,
    estimatedSizeBytes: excludedJiraTasks.reduce((a, b) => a + b.estimatedSizeBytes, 0),
    estimatedSizeFormatted: formatBytes(excludedJiraTasks.reduce((a, b) => a + b.estimatedSizeBytes, 0)),
    safetyLevel: 'REVIEW_REQUIRED',
    items: excludedJiraTasks
  });

  // 8. Base64 Bloated Tasks (tasks containing inline base64 image strings)
  const base64Tasks: CleanupCandidateItem[] = [];
  tasks.forEach(t => {
    if (checkHasLargeBase64(t)) {
      const sz = estimateObjectSizeBytes(t);
      base64Tasks.push({
        id: t.id,
        collection: 'studio_tasks',
        title: `[${t.id}] ${t.title}`,
        category: 'BASE64_BLOATED_RECORDS',
        estimatedSizeBytes: sz,
        estimatedSizeFormatted: formatBytes(sz),
        createdAt: t.createdDate,
        reason: 'Contains inline Base64 data URLs in attachments or description',
        previewSummary: `Total document size: ${formatBytes(sz)}. Bloated with Base64 media.`,
        safeToClean: true,
        requiresExportFirst: false,
        dataRef: t
      });
    }
  });

  summaries.push({
    category: 'BASE64_BLOATED_RECORDS',
    label: 'Base64 Bloated Documents',
    description: 'Documents carrying inline base64 image strings instead of lightweight cloud storage URLs.',
    count: base64Tasks.length,
    estimatedSizeBytes: base64Tasks.reduce((a, b) => a + b.estimatedSizeBytes, 0),
    estimatedSizeFormatted: formatBytes(base64Tasks.reduce((a, b) => a + b.estimatedSizeBytes, 0)),
    safetyLevel: 'SAFE',
    items: base64Tasks
  });

  return summaries;
}

/**
 * Clean inline base64 strings from a task, converting them to clean placeholders / lightweight references
 */
export function sanitizeTaskBase64Payload(task: Task): { task: Task; bytesSaved: number } {
  const originalSize = estimateObjectSizeBytes(task);
  const cloned: Task = JSON.parse(JSON.stringify(task));

  if (Array.isArray(cloned.attachments)) {
    cloned.attachments = cloned.attachments.map(att => {
      if (att.url && (att.url.startsWith('data:image/') || att.url.length > 5000)) {
        return {
          ...att,
          url: '/api/media/placeholder-art.png',
          storagePath: att.storagePath || `/tasks/${cloned.id}/${att.name}`,
          thumbnailPath: att.thumbnailPath || `/tasks/${cloned.id}/thumb_${att.name}`
        };
      }
      return att;
    });
  }

  if (Array.isArray(cloned.comments)) {
    cloned.comments = cloned.comments.map(c => {
      if (Array.isArray(c.attachments)) {
        c.attachments = c.attachments.map(att => {
          if (att.url && (att.url.startsWith('data:image/') || att.url.length > 5000)) {
            return {
              ...att,
              url: '/api/media/placeholder-art.png'
            };
          }
          return att;
        });
      }
      return c;
    });
  }

  const newSize = estimateObjectSizeBytes(cloned);
  return {
    task: cloned,
    bytesSaved: Math.max(0, originalSize - newSize)
  };
}

/**
 * Trigger immediate browser download of full studio database snapshot JSON
 */
export function exportFirestoreBackupJson(data: DatabaseAuditInput, authorEmail: string): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `rg_artflow_firestore_backup_${timestamp}.json`;

  const backupPayload = {
    metadata: {
      appName: 'Reliance Games ArtFlow Studio',
      exportDate: new Date().toISOString(),
      author: authorEmail,
      version: '2.4.0',
      documentCounts: {
        tasks: data.tasks.length,
        projects: data.projects.length,
        sprints: data.sprints.length,
        users: data.users.length,
        artists: data.artists.length,
        requests: data.requests.length,
        timeEntries: data.timeEntries.length,
        activityLogs: data.activityLogs.length,
        auditLogs: data.auditLogs.length,
        notifications: data.notifications.length,
        mails: data.mails.length
      }
    },
    database: {
      tasks: data.tasks,
      projects: data.projects,
      sprints: data.sprints,
      users: data.users,
      artists: data.artists,
      requests: data.requests,
      timeEntries: data.timeEntries,
      activityLogs: data.activityLogs,
      auditLogs: data.auditLogs,
      notifications: data.notifications,
      mails: data.mails,
      settings: data.settings
    }
  };

  const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
