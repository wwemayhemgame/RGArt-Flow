import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback, ReactNode } from 'react';
import {
  normalizeTaskStatus,
  isTaskDoneOrCompleted,
  WORKFLOW_STATUS_LIST,
  DEFAULT_JIRA_PROJECT_KEYS,
  JIRA_MIGRATION_PROJECT_KEYS
} from '../types';
import type {
  User,
  Artist,
  Project,
  Sprint,
  Task,
  CompanyRequest,
  TimeEntry,
  AccessAuditRecord,
  ActivityLog,
  AppNotification,
  StudioSettings,
  UserRole,
  ProjectAccessLevel,
  TaskStatus,
  SprintStatus,
  RequestStatus,
  SprintMovementRecord,
  Priority,
  ArtCategory,
  BlockerReason,
  RevisionRecord,
  FieldAccessPermissions,
  StudioMail,
  TaskAttachment,
  TaskComment,
  JiraTicketAttachment,
  NavigationTab,
  TabAccessMode,
  DailyReportAccessLevel,
  JiraIntegrationConfig,
  BulkEditTaskPayload,
  JiraProjectMapping,
  ManualDailyAllocationOverride,
  JiraProjectMetadata,
  JiraIssueTypeInfo,
  JiraFixVersionInfo,
  JiraComponentInfo,
  JiraUserMapping
} from '../types';
import {
  matchJiraToStudioProject,
  resolveStudioProjectForTask,
  resolveJiraProjectForStudioProject,
  getJiraProjectKeyFromIssueKey,
  isWweMayhemJiraProject
} from '../utils/jiraProjectMatcher';
import {
  findSimilarProject,
  isAmdInternalProject,
  areProjectNamesSimilar,
  normalizeProjectName
} from '../utils/projectNameValidator';
import {
  resolveJiraAssigneeToStudio,
  reconcileJiraTaskAssignees
} from '../utils/jiraUserMatcher';
import {
  SEED_USERS,
  SEED_ARTISTS,
  SEED_PROJECTS,
  SEED_SPRINTS,
  SEED_TASKS,
  SEED_REQUESTS,
  SEED_TIME_ENTRIES,
  SEED_ACCESS_AUDIT_LOGS,
  SEED_ACTIVITY_LOGS,
  SEED_NOTIFICATIONS,
  SEED_SETTINGS,
  INITIAL_ADMIN_USER,
  DEMO_SEED_USERS,
  DEMO_SEED_ARTISTS,
  DEMO_SEED_PROJECTS,
  DEMO_SEED_SPRINTS
} from '../data/seedData';
import { calculateDeliveryForecast, calculateTaskExpectedDelivery } from '../utils/forecastEngine';
import { getTodayDateString, formatDateTime } from '../utils/dateUtils';
import { formatDuration } from '../utils/timeUtils';
import { normalizeSprintSchedule, computeScheduledSprint, getStandardWeeklySprints } from '../utils/sprintScheduler';

import {
  seedFirestoreUsersIfEmpty,
  registerUserWithOfficeId as firestoreRegisterUser,
  loginWithOfficeId as firestoreLoginUser,
  approveUserLoginRequest as firestoreApproveUser,
  rejectUserLoginRequest as firestoreRejectUser,
  updateUserFieldPermissions as firestoreUpdatePermissions,
  defaultFieldPermissionsForRole,
  fetchStudioMails,
  markStudioMailAsRead as firestoreMarkMailRead,
  sendStudioMail as firestoreSendMail,
  verifyUserWithCode as firestoreVerifyCode,
  resendVerificationCode as firestoreResendCode,
  checkUserStatus as firestoreCheckStatus,
  requestPasswordReset as firestoreRequestPasswordReset,
  resetUserPassword as firestoreResetUserPassword,
  generateVerificationCode,
  sendTaskActivityNotificationMail,
  syncUsersFromServer
} from '../lib/authService';

import {
  subscribeToCollection,
  subscribeToSprintTasks,
  fetchStableCollectionOnce,
  fetchBacklogTasks,
  subscribeToDoc,
  syncSaveDoc,
  syncSaveSettingsDoc,
  syncUpdateDoc,
  syncDeleteDoc,
  wipeAllUsersInFirestore,
  wipeAllStudioDataInFirestore,
  subscribeToQuotaStatus,
  isFirestoreQuotaExceeded,
  setFirestoreQuotaExceeded,
  COLLECTIONS
} from '../lib/firestoreSync';

interface ArtOpsContextType {
  // Quota & offline status
  isQuotaExceeded: boolean;

  // Current user & authentication simulation
  currentUser: User;
  setCurrentUser: (user: User) => void;
  isAuthenticated: boolean;
  logout: () => void;
  switchAdminProfile: (role: 'ADMIN' | 'ART_DIRECTOR' | 'ART_MANAGER') => void;
  users: User[];
  addUser: (data: Omit<User, 'id'>) => User;
  updateUser: (userId: string, updates: Partial<User>) => void;
  deleteUser: (userId: string) => void;

  // Firebase Office ID Authentication & Leadership Approvals
  loginWithOfficeId: (officeId: string, password?: string) => Promise<{ success: boolean; user?: User; status?: string; error?: string }>;
  registerUserWithOfficeId: (data: {
    name: string;
    email: string;
    officeId?: string;
    password?: string;
    role?: UserRole;
    department?: string;
    title?: string;
    avatar?: string;
  }) => Promise<{ success: boolean; user?: User; verificationCode?: string; error?: string }>;
  verifyUserWithCode: (identifier: string, code: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  resendVerificationCode: (identifier: string) => Promise<{ success: boolean; verificationCode?: string; error?: string }>;
  checkUserStatus: (identifier: string) => Promise<{ success: boolean; user?: User; status?: string; error?: string }>;
  requestPasswordReset: (identifier: string) => Promise<{ success: boolean; email?: string; resetCode?: string; error?: string }>;
  resetUserPassword: (identifier: string, resetCode: string, newPassword: string) => Promise<{ success: boolean; user?: User; error?: string }>;
  approveUserLogin: (targetUserId: string, assignedRole?: UserRole, customPerms?: Partial<FieldAccessPermissions>) => Promise<{ success: boolean; verificationCode?: string; error?: string }>;
  rejectUserLogin: (targetUserId: string, reason: string) => Promise<{ success: boolean; verificationCode?: string; error?: string }>;
  updateUserPermissions: (targetUserId: string, permissions: FieldAccessPermissions) => Promise<boolean>;
  updateUserTabPermissions: (targetUserId: string, tabAccess: Partial<Record<NavigationTab, TabAccessMode>>, dailyReportAccess?: DailyReportAccessLevel) => Promise<boolean>;
  grantDailyReportViewAccess: (targetUserId: string) => Promise<boolean>;
  canApproveUserLogins: () => boolean;
  hasFieldAccess: (field: keyof FieldAccessPermissions) => boolean;
  canAccessTab: (tabId: NavigationTab) => boolean;
  getTabAccessMode: (tabId: NavigationTab) => TabAccessMode;
  isTabReadOnly: (tabId: NavigationTab) => boolean;
  wipeAllUsers: () => Promise<void>;
  wipeAllCloudData: () => Promise<void>;

  // Role Preview & Testing Mode (Safe simulation)
  previewRole: UserRole | null;
  startRolePreview: (role: UserRole) => void;
  exitRolePreview: () => void;
  showPermissionDenial: (actionName: string, customReason?: string) => void;
  closeDenialAlert: () => void;
  denialAlert: {
    isOpen: boolean;
    actionName: string;
    roleName: string;
    reason: string;
  } | null;

  // Studio Mail & In-App Verification Inbox
  studioMails: StudioMail[];
  markStudioMailAsRead: (mailId: string) => Promise<void>;
  sendStudioMail: (mail: Omit<StudioMail, 'id' | 'timestamp' | 'read'>) => Promise<StudioMail>;
  refreshStudioMails: () => Promise<void>;
  
  // Core Entities
  artists: Artist[];
  projects: Project[];
  sprints: Sprint[];
  tasks: Task[];
  requests: CompanyRequest[];
  timeEntries: TimeEntry[];
  accessAuditLogs: AccessAuditRecord[];
  activityLogs: ActivityLog[];
  notifications: AppNotification[];
  settings: StudioSettings;

  // RBAC Permission checks
  getUserProjectAccess: (userId: string, projectId: string) => ProjectAccessLevel;
  hasProjectPermission: (projectId: string, minLevel: ProjectAccessLevel) => boolean;
  canEditTask: (task?: Task) => boolean;
  canManageSprint: () => boolean;
  canAccessAiSprintPlanner: () => boolean;
  canCreateProject: () => boolean;
  canAssignArtist: () => boolean;
  canLogTime: (task?: Task) => boolean;

  // Company Requests Permissions & Actions
  isCompanyRequestOwner: (request: CompanyRequest) => boolean;
  canEditCompanyRequest: (request: CompanyRequest) => boolean;
  canDeleteCompanyRequest: (request: CompanyRequest) => boolean;
  isCompanyRequestEditable: (request: CompanyRequest) => { editable: boolean; reason?: string };
  updateCompanyRequest: (requestId: string, updates: Partial<CompanyRequest>) => void;
  deleteCompanyRequest: (requestId: string) => void;

  // Requests API
  createRequest: (data: Omit<CompanyRequest, 'id' | 'createdAt' | 'status' | 'revisions' | 'comments'>) => CompanyRequest;
  updateRequestStatus: (requestId: string, status: RequestStatus) => void;
  assignCompanyRequest: (requestId: string, artistId: string | undefined, sprintId?: string) => void;
  triageAndCreateTaskFromRequest: (
    requestId: string,
    projectId: string,
    artistId: string | undefined,
    sprintId: string | undefined,
    storyPoints: number,
    originalEstimate: number,
    taskType?: string
  ) => Task;

  // Tasks API
  createTask: (data: Partial<Task> & { projectId: string; title: string }) => Task;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  unassignTask: (taskId: string) => void;
  moveTaskToBacklog: (taskId: string) => void;
  updateTaskStatus: (taskId: string, newStatus: TaskStatus, blockerReason?: BlockerReason, blockerDetails?: string) => void;
  deleteTask: (taskId: string) => void;
  logTaskTime: (taskId: string, hours: number, description: string, date?: string, explicitRemainingHours?: number) => void;
  requestTaskRevision: (taskId: string, comment: string, additionalHours: number) => void;
  addSubtask: (taskId: string, title: string, estimatedHours?: number) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  addTaskComment: (
    taskId: string,
    content: string,
    parentCommentId?: string,
    options?: {
      textColor?: string;
      attachments?: TaskAttachment[];
      formatStyles?: {
        bold?: boolean;
        italic?: boolean;
        underline?: boolean;
        code?: boolean;
        blockquote?: boolean;
      } | string[];
    }
  ) => void;
  addTaskAttachment: (
    taskId: string,
    attachment: Omit<TaskAttachment, 'id' | 'uploadedBy' | 'uploadedByName' | 'uploadedAt'> & { id?: string }
  ) => void;
  removeTaskAttachment: (taskId: string, attachmentId: string) => void;
  addRequestComment: (requestId: string, content: string, parentCommentId?: string) => void;
  submitMissingTask: (data: Partial<Task> & { projectId: string; title: string; reason: string }) => Task;
  approveMissingTask: (taskId: string, approve: boolean, sprintId?: string, artistId?: string) => void;
  bulkUpdateTasks: (taskIds: string[], updates: Partial<Task>) => void;

  // Sprints API
  canManageSprints: boolean;
  createSprint: (data: Omit<Sprint, 'id'>) => Sprint;
  updateSprint: (sprintId: string, updates: Partial<Sprint>) => void;
  updateSprintStatus: (sprintId: string, status: SprintStatus) => { success: boolean; message?: string };
  completeSprint: (sprintId: string) => {
    success: boolean;
    message: string;
    carriedForwardCount: number;
    completedCount: number;
    nextSprintId?: string;
    nextSprintName?: string;
  };
  moveCompletedSprintPendingTasksToActiveSprint: () => Promise<{
    success: boolean;
    message: string;
    movedCount: number;
    taskIds: string[];
  }>;
  moveTaskToSprint: (taskId: string, sprintId: string | undefined) => void;

  // Projects API
  createProject: (data: Omit<Project, 'id' | 'taskCounter' | 'members'> & { initialManagerId?: string }) => Project;
  updateProject: (projectId: string, updates: Partial<Project>) => void;
  deleteProject: (projectId: string) => void;
  updateProjectAccess: (userId: string, projectId: string, newAccessLevel: ProjectAccessLevel | 'Removed', notes?: string) => void;

  // Artists API
  addArtist: (data: Omit<Artist, 'id'>) => Artist;
  updateArtist: (artistId: string, updates: Partial<Artist>) => void;
  deleteArtist: (artistId: string) => void;
  toggleArtistStatus: (artistId: string) => void;

  // Daily Project Allocation Overrides API
  manualAllocations: Record<string, ManualDailyAllocationOverride>;
  updateDailyAllocation: (artistId: string, date: string, allocations: { projectId: string; percentage: number }[], reason?: string) => void;
  resetDailyAllocation: (artistId: string, date: string) => void;
  bulkUpdateDailyAllocations: (overrides: ManualDailyAllocationOverride[]) => void;

  // Notifications API
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  addNotification: (userId: string, title: string, message: string, type?: 'info' | 'warning' | 'success' | 'alert', linkType?: any, linkId?: string) => void;

  // Jira Integration & Proxy Sync API
  jiraProjectMetadata: Record<string, JiraProjectMetadata>;
  getJiraMetadataForProject: (studioProjectIdOrKey: string) => JiraProjectMetadata | null;
  refreshJiraProjectMetadata: (projectKey?: string) => Promise<{ success: boolean; metadata?: Record<string, JiraProjectMetadata>; error?: string }>;
  validateTaskForJira: (task: Partial<Task>, targetProjectKey?: string) => {
    isValid: boolean;
    missingFields: string[];
    errors: string[];
    resolvedProjectKey?: string;
    resolvedIssueTypeId?: string;
    resolvedIssueType?: string;
    validIssueTypes: JiraIssueTypeInfo[];
    validFixVersions: JiraFixVersionInfo[];
    validComponents: JiraComponentInfo[];
  };
  getAiJiraFieldSuggestions: (task: Partial<Task> & { projectId: string }) => {
    issueType?: string;
    issueTypeId?: string;
    fixVersion?: string;
    fixVersionId?: string;
    component?: string;
    componentId?: string;
    priority?: Priority;
    confidence: number;
    reason?: string;
  };
  pushTaskToJira: (
    taskId: string,
    targetProjectKey?: string,
    overrideFields?: Partial<Task>
  ) => Promise<{ success: boolean; jiraKey?: string; message?: string; error?: string }>;
  syncTaskFromJira: (
    taskId: string
  ) => Promise<{ success: boolean; message?: string; error?: string }>;
  syncTaskToJira: (
    taskId: string,
    customComment?: string,
    explicitHours?: number,
    options?: {
      syncStatus?: boolean;
      customStatus?: string;
      transitionId?: string;
      remainingEstimateHours?: number;
      worklogDescription?: string;
      worklogDate?: string;
    }
  ) => Promise<{ success: boolean; message?: string; error?: string }>;
  postTaskAttachmentToJira: (
    taskId: string,
    attachmentIdOrObject: string | TaskAttachment,
    customComment?: string
  ) => Promise<{ success: boolean; attachment?: any; message?: string; error?: string }>;
  postTaskCommentToJira: (
    taskId: string,
    commentText: string
  ) => Promise<{ success: boolean; commentId?: string; message?: string; error?: string }>;
  postAllTaskAttachmentsToJira: (
    taskId: string
  ) => Promise<{ success: boolean; uploadedCount: number; message?: string; error?: string }>;
  fetchJiraIssueAttachments: (
    jiraIssueKey: string
  ) => Promise<{ success: boolean; attachments: JiraTicketAttachment[]; error?: string }>;
  importJiraAttachmentToTask: (
    taskId: string,
    jiraAttachment: JiraTicketAttachment
  ) => Promise<{ success: boolean; attachment?: TaskAttachment; error?: string }>;
  importAllJiraAttachmentsToTask: (
    taskId: string,
    jiraAttachments: JiraTicketAttachment[]
  ) => Promise<{ success: boolean; importedCount: number; error?: string }>;
  importJiraIssuesToBacklog: (issues: any[], targetProjectId: string, targetSprintId?: string) => { importedCount: number; updatedCount: number };
  bulkImportTasksFromSpreadsheet: (importedTasks: Partial<Task>[], targetProjectId: string, targetSprintId?: string) => { importedCount: number; updatedCount: number; tasks: Task[] };
  testJiraConnection: (config?: any) => Promise<{ success: boolean; user?: any; projects?: any[]; error?: string }>;
  searchJiraIssues: (options?: { projectKeys?: string; jqlQuery?: string; fetchAllAssignees?: boolean }) => Promise<{ success: boolean; issues?: any[]; total?: number; error?: string }>;
  fetchJiraProjects: (configOverride?: any) => Promise<{ success: boolean; projects?: any[]; error?: string }>;
  syncAllJiraTasks: () => Promise<{ success: boolean; syncedCount: number; message: string }>;
  removeAllJiraTasks: () => Promise<number>;
  repairJiraTaskProjectMappings: () => Promise<{ repairedCount: number; tasks: Task[] }>;
  updateJiraProjectMappings: (mappings: JiraProjectMapping[]) => void;
  updateJiraDefaultProjectKeys: (keys: string) => void;
  addAllJiraMigrationProjectKeys: () => void;
  saveJiraUserMapping: (mapping: JiraUserMapping) => Promise<void>;
  deleteJiraUserMapping: (jiraAccountIdOrEmail: string) => Promise<void>;
  reconcileAllJiraAssignees: () => { reconciledCount: number; updatedTasks: Task[] };
  applyBulkEditTasks: (payload: BulkEditTaskPayload, taskIds: string[]) => Promise<{ updatedCount: number; syncedJiraCount: number }>;

  // System & Reset
  cleanAllPeopleProjectsTasks: () => void;
  loadSampleDemoData: () => void;
  resetToDemoData: () => void;
  clearAllData: () => void;
  exportDatabaseJson: () => string;
  importDatabaseJson: (jsonStr: string) => boolean;
  updateSettings: (newSettings: Partial<StudioSettings>) => void;
  refreshStudioData: () => Promise<void>;
}

const STORAGE_KEY = 'artops_production_v5_clean';

const ArtOpsContext = createContext<ArtOpsContextType | undefined>(undefined);

export const sanitizeUserForStorage = (user: User): User => {
  if (!user) return user;
  const { password, ...safeUser } = user;
  return safeUser as User;
};

export const compactJiraMetadataRecord = (data: Record<string, JiraProjectMetadata>): Record<string, JiraProjectMetadata> => {
  if (!data || typeof data !== 'object') return {};
  const compacted: Record<string, JiraProjectMetadata> = {};
  for (const [k, v] of Object.entries(data)) {
    if (!v) continue;
    compacted[k] = {
      projectKey: v.projectKey,
      projectName: v.projectName,
      defaultIssueTypeId: v.defaultIssueTypeId,
      defaultIssueTypeName: v.defaultIssueTypeName,
      storyPointsFieldId: v.storyPointsFieldId,
      lastRefreshedAt: v.lastRefreshedAt,
      issueTypes: (v.issueTypes || []).slice(0, 30).map(it => ({
        id: String(it.id),
        name: it.name,
        description: it.description?.slice(0, 80),
        subtask: !!it.subtask
      })),
      fixVersions: (v.fixVersions || []).slice(0, 30).map(fv => ({
        id: String(fv.id),
        name: fv.name,
        released: !!fv.released,
        archived: !!fv.archived,
        releaseDate: fv.releaseDate
      })),
      components: (v.components || []).slice(0, 30).map(c => ({
        id: String(c.id),
        name: c.name,
        description: c.description?.slice(0, 80)
      })),
      requiredFields: v.requiredFields,
      allowedFields: v.allowedFields
    };
  }
  return compacted;
};

export const safeLocalStorageSet = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e: any) {
    console.warn(`[ArtOps Storage] QuotaExceeded or Storage Error writing to key: ${key}`, e);
    // If it is Jira metadata, compact it and retry or fall back to sessionStorage
    if (key.includes('jira_project_metadata')) {
      try {
        const parsed = JSON.parse(value);
        const compact = compactJiraMetadataRecord(parsed);
        localStorage.setItem(key, JSON.stringify(compact));
        return;
      } catch (jiraErr) {
        try {
          sessionStorage.setItem(key, value);
          return;
        } catch (sErr) {}
      }
    } else if (key.includes('_tasks')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          const compact = parsed.map((t: any) => ({
            ...t,
            attachments: (t.attachments || []).map((att: any) => ({
              id: att.id,
              name: att.name,
              size: att.size,
              type: att.type,
              url: (att.url && att.url.length > 300) ? '' : att.url
            }))
          }));
          localStorage.setItem(key, JSON.stringify(compact));
          return;
        }
      } catch (compactErr) {
        console.warn('[ArtOps Storage] Compact task fallback storage also skipped:', compactErr);
      }
    } else if (key.includes('_activity_logs') || key.includes('_access_logs')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          localStorage.setItem(key, JSON.stringify(parsed.slice(0, 50)));
          return;
        }
      } catch (logsErr) {}
    }

    try {
      sessionStorage.setItem(key, value);
    } catch (sessionErr) {}
  }
};

export const ArtOpsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load or initialize state with clean empty slate
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_users`);
    if (saved) {
      try {
        const list: User[] = JSON.parse(saved);
        if (list && list.length > 0) {
          return list.map(u => sanitizeUserForStorage(u));
        }
      } catch (e) {}
    }
    return [sanitizeUserForStorage(INITIAL_ADMIN_USER)];
  });

  const [artists, setArtists] = useState<Artist[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_artists`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  // Strict session policy: Every launch requires a fresh login popup. No persistent auto-login on launch.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  const [currentUser, setCurrentUser] = useState<User>(() => {
    return sanitizeUserForStorage(INITIAL_ADMIN_USER);
  });

  // Wipe leftover auth session tokens on app startup to guarantee a clean login popup on every launch
  useEffect(() => {
    try {
      localStorage.removeItem(`${STORAGE_KEY}_auth_state`);
      localStorage.removeItem(`${STORAGE_KEY}_current_user`);
      sessionStorage.clear();
    } catch (e) {}
  }, []);

  const logout = () => {
    setIsAuthenticated(false);
    setCurrentUser(sanitizeUserForStorage(INITIAL_ADMIN_USER));
    try {
      localStorage.removeItem(`${STORAGE_KEY}_auth_state`);
      localStorage.removeItem(`${STORAGE_KEY}_current_user`);
      sessionStorage.clear();
    } catch (e) {}
  };

  const switchAdminProfile = (role: 'ADMIN' | 'ART_DIRECTOR' | 'ART_MANAGER') => {
    const userEmail = (currentUser.email || '').toLowerCase();
    const isAdmin = userEmail === 'wwemayhemgame@gmail.com' || userEmail === 'ranjeet.patil@zapak.com' || currentUser.role === 'ADMIN';
    if (!isAdmin) return;
    const titleMap: Record<string, string> = {
      ADMIN: 'Studio Administrator & Head of Art',
      ART_DIRECTOR: 'Lead Art Director',
      ART_MANAGER: 'Executive Art Operations Manager'
    };
    const updatedUser: User = {
      ...currentUser,
      role,
      title: titleMap[role] || currentUser.title,
      fieldPermissions: defaultFieldPermissionsForRole(role)
    };
    setCurrentUser(updatedUser);
    setUsers(prev => prev.map(u => (u.id === updatedUser.id ? updatedUser : u)));
    safeLocalStorageSet(`${STORAGE_KEY}_current_user`, JSON.stringify(sanitizeUserForStorage(updatedUser)));
    logActivity('Profile Switch', 'Access', currentUser.id, `${currentUser.name || 'Admin'} switched active role profile to ${role}.`);
  };

  // Role Preview Mode (Safe simulation without modifying actual database permissions)
  const [previewRole, setPreviewRole] = useState<UserRole | null>(() => {
    try {
      const saved = sessionStorage.getItem(`${STORAGE_KEY}_preview_role`);
      return (saved as UserRole) || null;
    } catch {
      return null;
    }
  });

  const [denialAlert, setDenialAlert] = useState<{
    isOpen: boolean;
    actionName: string;
    roleName: string;
    reason: string;
  } | null>(null);

  const startRolePreview = (role: UserRole) => {
    setPreviewRole(role);
    try {
      sessionStorage.setItem(`${STORAGE_KEY}_preview_role`, role);
    } catch {}
    logActivity('Role Preview', 'Access', currentUser.id, `Admin ${currentUser.name} entered safe Role Preview Mode as ${role}.`);
  };

  const exitRolePreview = () => {
    setPreviewRole(null);
    try {
      sessionStorage.removeItem(`${STORAGE_KEY}_preview_role`);
    } catch {}
    logActivity('Exit Role Preview', 'Access', currentUser.id, `Admin ${currentUser.name} exited Role Preview Mode.`);
  };

  const showPermissionDenial = (actionName: string, customReason?: string) => {
    const effectiveR = previewRole || currentUser.role;
    const roleName = effectiveR === 'ADMIN' ? 'Admin'
      : effectiveR === 'ART_MANAGER' ? 'Studio Manager'
      : effectiveR === 'ART_DIRECTOR' ? 'Team Lead'
      : effectiveR === 'ARTIST' ? 'Artist'
      : effectiveR === 'COMPANY_REQUESTER' ? 'Viewer / Requester'
      : effectiveR;
    const reason = customReason || `${roleName}s do not have permission to execute "${actionName}". Contact a Studio Manager or Admin.`;
    setDenialAlert({
      isOpen: true,
      actionName,
      roleName,
      reason
    });
  };

  const closeDenialAlert = () => {
    setDenialAlert(null);
  };

  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_projects`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [sprints, setSprints] = useState<Sprint[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_sprints`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          const { sprints: normalized } = normalizeSprintSchedule(parsed);
          return normalized;
        }
      } catch (e) {}
    }
    return getStandardWeeklySprints();
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_tasks`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [requests, setRequests] = useState<CompanyRequest[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_requests`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_time`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [accessAuditLogs, setAccessAuditLogs] = useState<AccessAuditRecord[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_access_logs`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_activity_logs`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_notifications`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return [];
  });

  const [settings, setSettings] = useState<StudioSettings>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_settings`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return SEED_SETTINGS;
  });

  const [manualAllocations, setManualAllocations] = useState<Record<string, ManualDailyAllocationOverride>>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_manual_allocations`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(() => isFirestoreQuotaExceeded());

  const [studioMails, setStudioMails] = useState<StudioMail[]>(() => {
    const saved = localStorage.getItem('artops_studio_mails');
    return saved ? JSON.parse(saved) : [];
  });

  // Default client Jira Project metadata cache
  const DEFAULT_CLIENT_JIRA_METADATA: Record<string, JiraProjectMetadata> = {
    WWE: {
      projectKey: 'WWE',
      projectName: 'WWE Champions & Mayhem Art',
      issueTypes: [
        { id: '10001', name: 'Story', description: 'User stories and core deliverables', subtask: false, iconUrl: '' },
        { id: '10002', name: 'Task', description: 'Standard production task', subtask: false, iconUrl: '' },
        { id: '10003', name: 'Bug', description: 'Visual defect or bug', subtask: false, iconUrl: '' },
        { id: '10004', name: 'Epic', description: 'High-level milestone package', subtask: false, iconUrl: '' },
        { id: '10005', name: 'Character 3D', description: '3D wrestler models, sculpts, texturing', subtask: false, iconUrl: '' },
        { id: '10006', name: 'Animation', description: 'Movesets, entrances, VFX animations', subtask: false, iconUrl: '' },
        { id: '10007', name: 'UI Asset', description: 'HUD, banners, icons, store art', subtask: false, iconUrl: '' },
        { id: '10008', name: 'Concept Art', description: 'Costumes, arenas, key art', subtask: false, iconUrl: '' }
      ],
      defaultIssueTypeId: '10001',
      defaultIssueTypeName: 'Story',
      fixVersions: [
        { id: '20001', name: 'v2.4.0', released: false, archived: false, releaseDate: '2026-03-31' },
        { id: '20002', name: 'v2.5.0', released: false, archived: false, releaseDate: '2026-04-30' },
        { id: '20003', name: 'v2.6.0-SummerSlam', released: false, archived: false, releaseDate: '2026-06-30' },
        { id: '20004', name: 'v2.3.0', released: true, archived: false, releaseDate: '2026-02-15' }
      ],
      components: [
        { id: '30001', name: '3D Characters', description: 'Wrestler character models & gear' },
        { id: '30002', name: 'Rigging & Animation', description: 'Skeletons, skinning, motion' },
        { id: '30003', name: 'UI & Icons', description: 'In-game UI, renders, portraits' },
        { id: '30004', name: 'Arenas & Environments', description: 'Rings, crowds, lighting' },
        { id: '30005', name: 'VFX & Particles', description: 'Special moves, pyro, sparks' },
        { id: '30006', name: 'Marketing & Banners', description: 'App Store assets, event promos' }
      ]
    },
    M13: {
      projectKey: 'M13',
      projectName: 'Mafia Wars 2026 Production',
      issueTypes: [
        { id: '10001', name: 'Story', description: 'Feature narrative & gameplay', subtask: false, iconUrl: '' },
        { id: '10002', name: 'Task', description: 'Production asset task', subtask: false, iconUrl: '' },
        { id: '10003', name: 'Bug', description: 'Visual bug or art glitch', subtask: false, iconUrl: '' },
        { id: '10004', name: 'Epic', description: 'Feature epic', subtask: false, iconUrl: '' },
        { id: '10009', name: 'Environment Art', description: 'City blocks, interiors, props', subtask: false, iconUrl: '' },
        { id: '10010', name: 'Vehicle 3D', description: 'Cars, trucks, getaway vehicles', subtask: false, iconUrl: '' }
      ],
      defaultIssueTypeId: '10001',
      defaultIssueTypeName: 'Story',
      fixVersions: [
        { id: '20010', name: 'Sprint 24 Release', released: false, archived: false },
        { id: '20011', name: 'Sprint 25 Release', released: false, archived: false },
        { id: '20012', name: 'Milestone Beta 2', released: false, archived: false }
      ],
      components: [
        { id: '30010', name: 'Vehicles', description: 'Vehicle modeling and tuning' },
        { id: '30011', name: 'Environment Props', description: 'Props and street assets' },
        { id: '30012', name: 'Characters & Outfits', description: 'Mobsters, bosses, gear' },
        { id: '30013', name: 'Weapons', description: 'Guns, melee, animations' }
      ]
    },
    ART: {
      projectKey: 'ART',
      projectName: 'Global Art Operations',
      issueTypes: [
        { id: '10001', name: 'Story', description: 'Art Request Story', subtask: false, iconUrl: '' },
        { id: '10002', name: 'Task', description: 'Art Task', subtask: false, iconUrl: '' },
        { id: '10003', name: 'Bug', description: 'Art Fix', subtask: false, iconUrl: '' }
      ],
      defaultIssueTypeId: '10002',
      defaultIssueTypeName: 'Task',
      fixVersions: [
        { id: '20020', name: 'Q1-2026-ArtDrop', released: false, archived: false },
        { id: '20021', name: 'Q2-2026-ArtDrop', released: false, archived: false }
      ],
      components: [
        { id: '30020', name: '2D Concept', description: 'Concept art & sketches' },
        { id: '30021', name: '3D High Poly', description: 'ZBrush sculpts & retopology' },
        { id: '30022', name: 'Texture & Shading', description: 'Substance materials' }
      ]
    }
  };

  const [jiraProjectMetadata, setJiraProjectMetadata] = useState<Record<string, JiraProjectMetadata>>(() => {
    const saved = localStorage.getItem('artops_jira_project_metadata');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_CLIENT_JIRA_METADATA, ...parsed };
      } catch (e) {}
    }
    return DEFAULT_CLIENT_JIRA_METADATA;
  });

  // Background fetch Jira project metadata for all mapped projects
  useEffect(() => {
    const fetchMetadata = async () => {
      const config = settings.jiraConfig;
      const keysToFetch = new Set<string>(['WWE', 'M13', 'ART']);
      
      if (config?.projectMappings && Array.isArray(config.projectMappings)) {
        config.projectMappings.forEach(m => {
          if (m.jiraProjectKey) keysToFetch.add(m.jiraProjectKey.trim().toUpperCase());
        });
      }

      try {
        const res = await fetch('/api/jira/project-meta-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hostUrl: config?.hostUrl,
            email: config?.email,
            apiToken: config?.apiToken,
            projectKeys: Array.from(keysToFetch)
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.metadata) {
            setJiraProjectMetadata(prev => {
              const merged = { ...prev, ...data.metadata };
              safeLocalStorageSet('artops_jira_project_metadata', JSON.stringify(compactJiraMetadataRecord(merged)));
              return merged;
            });
          }
        }
      } catch (e) {
        // use fallback cache
      }
    };

    fetchMetadata();
  }, [settings.jiraConfig?.hostUrl, settings.jiraConfig?.projectMappings]);

  const refreshStudioMails = async () => {
    try {
      const mails = await fetchStudioMails();
      if (mails && mails.length > 0) {
        setStudioMails(mails);
      }
    } catch (e) {
      console.warn('Failed to refresh studio mails:', e);
    }
  };

  // Real-time bidirectional synchronization with Cloud Firestore
  useEffect(() => {
    // 1. Quota status listener (always active)
    const unsubQuota = subscribeToQuotaStatus((exceeded) => {
      setIsQuotaExceeded(exceeded);
    });

    // 2. App-Wide Global Studio Settings listener (syncs Jira integration and system configs across all devices & users)
    const unsubSettings = subscribeToDoc<StudioSettings>(COLLECTIONS.SETTINGS, 'app_settings', (cloudSettings) => {
      if (cloudSettings) {
        setSettings(prev => {
          const merged: StudioSettings = {
            ...prev,
            ...cloudSettings,
            jiraConfig: cloudSettings.jiraConfig
              ? {
                  ...(prev.jiraConfig || { hostUrl: '', email: '', apiToken: '' }),
                  ...cloudSettings.jiraConfig
                } as JiraIntegrationConfig
              : prev.jiraConfig
          };
          safeLocalStorageSet(`${STORAGE_KEY}_settings`, JSON.stringify(merged));
          return merged;
        });
      }
    });

    // Initial sync with Server-level App Jira Configuration
    fetch('/api/jira/config')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.config) {
          const cfg = data.config as Partial<JiraIntegrationConfig>;
          setSettings(prev => {
            const currentJira = prev.jiraConfig || { hostUrl: '', email: '', apiToken: '' };
            let effectiveKeys = cfg.defaultProjectKeys || currentJira.defaultProjectKeys || DEFAULT_JIRA_PROJECT_KEYS;
            if (!effectiveKeys || effectiveKeys === 'WWE, ART, MAYHEM' || effectiveKeys.trim().length === 0) {
              effectiveKeys = DEFAULT_JIRA_PROJECT_KEYS;
            }
            const mergedJira: JiraIntegrationConfig = {
              ...currentJira,
              hostUrl: cfg.hostUrl || currentJira.hostUrl || 'https://reliancegames.atlassian.net',
              email: cfg.email || currentJira.email || 'ranjeet.patil@zapak.com',
              apiToken: cfg.apiToken || currentJira.apiToken || '',
              defaultProjectKeys: effectiveKeys,
              projectMappings: cfg.projectMappings || currentJira.projectMappings,
              autoSyncOnStatusChange: cfg.autoSyncOnStatusChange ?? currentJira.autoSyncOnStatusChange ?? true,
              autoSyncWorklogs: cfg.autoSyncWorklogs ?? currentJira.autoSyncWorklogs ?? true,
              autoPostImagesToJira: cfg.autoPostImagesToJira ?? currentJira.autoPostImagesToJira ?? true,
              connectionStatus: cfg.connectionStatus || currentJira.connectionStatus || 'connected',
              lastConnectedAt: cfg.lastConnectedAt || currentJira.lastConnectedAt
            };
            const updated = { ...prev, jiraConfig: mergedJira };
            safeLocalStorageSet(`${STORAGE_KEY}_settings`, JSON.stringify(updated));
            return updated;
          });
        }
      })
      .catch(e => console.warn('Could not load server-level Jira config:', e));

    // Synchronize users from server directory (resilient store)
    syncUsersFromServer()
      .then(serverUsers => {
        if (serverUsers && serverUsers.length > 0) {
          setUsers(serverUsers);
        }
      })
      .catch(() => {});

    // Canonical task merger to maintain single source of truth across all views
    // Subscriptions and queries merge into this canonical store without duplicate objects
    let unsubTasks = () => {};
    let unsubRequests = () => {};
    let unsubTime = () => {};
    let unsubLogs = () => {};
    let unsubAudit = () => {};
    let unsubNotifs = () => {};
    let unsubMails = () => {};

    if (isAuthenticated) {
      // 1. Stable Configuration Collections: Fetch ONCE to eliminate continuous Firestore reads
      // Cached in localStorage with bounded size
      fetchStableCollectionOnce<User>(COLLECTIONS.USERS, 200)
        .then(items => {
          if (items && items.length > 0) {
            const sanitized = items.map(u => {
              if (
                (u.email?.toLowerCase() === 'ranjeet.patil@zapak.com' || u.id === 'user-ranjeet' || u.officeId === 'OFF-1001') &&
                (!u.name || u.name.toLowerCase().includes('vishwas'))
              ) {
                return { ...u, name: 'Ranjeet Patil' };
              }
              return u;
            });
            setUsers(sanitized);
            safeLocalStorageSet(`${STORAGE_KEY}_users`, JSON.stringify(sanitized));
          }
        })
        .catch(() => {});

      fetchStableCollectionOnce<Project>(COLLECTIONS.PROJECTS, 100)
        .then(items => {
          if (items && items.length > 0) {
            setProjects(items);
            safeLocalStorageSet(`${STORAGE_KEY}_projects`, JSON.stringify(items));
          }
        })
        .catch(() => {});

      fetchStableCollectionOnce<Sprint>(COLLECTIONS.SPRINTS, 100)
        .then(items => {
          if (items && items.length > 0) {
            const { sprints: normalized } = normalizeSprintSchedule(items);
            setSprints(normalized);
            safeLocalStorageSet(`${STORAGE_KEY}_sprints`, JSON.stringify(normalized));
          }
        })
        .catch(() => {});

      fetchStableCollectionOnce<Artist>(COLLECTIONS.ARTISTS, 100)
        .then(items => {
          if (items && items.length > 0) {
            setArtists(items);
            safeLocalStorageSet(`${STORAGE_KEY}_artists`, JSON.stringify(items));
          }
        })
        .catch(() => {});

      // 2. Tasks Scoped Realtime: Listen ONLY to the active sprint to dramatically cut reads
      const currentSprints = sprints.length > 0 ? sprints : getStandardWeeklySprints();
      const activeSp = currentSprints.find(s => s.status?.toUpperCase() === 'ACTIVE') || currentSprints[0];
      const activeSprintId = activeSp ? activeSp.id : 'sprint-1';

      unsubTasks = subscribeToSprintTasks(activeSprintId, (items) => {
        const normalizedTasks = items.map(t => {
          let updatedSprintId = t.sprintId;
          if (t.sprintId === 'sprint-w35' || t.sprintId === 'sprint-35') {
            updatedSprintId = 'sprint-1';
          } else if (t.sprintId === 'sprint-w36' || t.sprintId === 'sprint-36') {
            updatedSprintId = 'sprint-2';
          } else if (t.sprintId === 'sprint-w37' || t.sprintId === 'sprint-37') {
            updatedSprintId = 'sprint-3';
          } else if (t.sprintId === 'sprint-w38' || t.sprintId === 'sprint-38') {
            updatedSprintId = 'sprint-4';
          }
          return updatedSprintId !== t.sprintId ? { ...t, sprintId: updatedSprintId } : t;
        });
        setTasks(prev => {
          const map = new Map<string, Task>();
          prev.forEach(t => map.set(t.id, t));
          normalizedTasks.forEach(t => map.set(t.id, t));
          const merged = Array.from(map.values());
          safeLocalStorageSet(`${STORAGE_KEY}_tasks`, JSON.stringify(merged));
          return merged;
        });
      });

      // 3. Backlog tasks: fetch once with limit to avoid full collection download
      fetchBacklogTasks(100)
        .then(backlogItems => {
          if (backlogItems && backlogItems.length > 0) {
            setTasks(prev => {
              const map = new Map<string, Task>();
              prev.forEach(t => map.set(t.id, t));
              backlogItems.forEach(t => {
                if (!map.has(t.id)) map.set(t.id, t);
              });
              const merged = Array.from(map.values());
              safeLocalStorageSet(`${STORAGE_KEY}_tasks`, JSON.stringify(merged));
              return merged;
            });
          }
        })
        .catch(() => {});

      // 4. Requests collection listener (bounded to 40)
      unsubRequests = subscribeToCollection<CompanyRequest>(
        COLLECTIONS.REQUESTS,
        (items) => {
          setRequests(items);
          safeLocalStorageSet(`${STORAGE_KEY}_requests`, JSON.stringify(items));
        },
        undefined,
        { limitCount: 40, description: 'Recent requests' }
      );

      // 5. Time entries collection listener (limit to 50 entries to save quota)
      unsubTime = subscribeToCollection<TimeEntry>(
        COLLECTIONS.TIME_ENTRIES,
        (items) => {
          setTimeEntries(items);
          safeLocalStorageSet(`${STORAGE_KEY}_time`, JSON.stringify(items));
        },
        undefined,
        { limitCount: 50, description: 'Recent time entries' }
      );

      // 6. Activity logs collection listener (limit to 30 most recent)
      unsubLogs = subscribeToCollection<ActivityLog>(
        COLLECTIONS.ACTIVITY_LOGS,
        (items) => {
          items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setActivityLogs(items);
          safeLocalStorageSet(`${STORAGE_KEY}_activity_logs`, JSON.stringify(items));
        },
        undefined,
        { limitCount: 30, orderByField: 'timestamp', orderDirection: 'desc', description: 'Recent activity logs' }
      );

      // 7. Access audit logs listener (limit to 30 most recent)
      unsubAudit = subscribeToCollection<AccessAuditRecord>(
        COLLECTIONS.AUDIT_LOGS,
        (items) => {
          items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setAccessAuditLogs(items);
          safeLocalStorageSet(`${STORAGE_KEY}_access_logs`, JSON.stringify(items));
        },
        undefined,
        { limitCount: 30, orderByField: 'timestamp', orderDirection: 'desc', description: 'Recent audit logs' }
      );

      // 8. Notifications listener (limit to 25 most recent)
      unsubNotifs = subscribeToCollection<AppNotification>(
        COLLECTIONS.NOTIFICATIONS,
        (items) => {
          items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setNotifications(items);
          safeLocalStorageSet(`${STORAGE_KEY}_notifications`, JSON.stringify(items));
        },
        undefined,
        { limitCount: 25, orderByField: 'timestamp', orderDirection: 'desc', description: 'Recent notifications' }
      );

      // 9. Studio Mails listener (limit to 25 most recent)
      unsubMails = subscribeToCollection<StudioMail>(
        COLLECTIONS.MAILS,
        (items) => {
          items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setStudioMails(items);
          safeLocalStorageSet('artops_studio_mails', JSON.stringify(items));
        },
        undefined,
        { limitCount: 25, orderByField: 'timestamp', orderDirection: 'desc', description: 'Recent mails' }
      );
    }

    return () => {
      unsubQuota();
      unsubSettings();
      unsubTasks();
      unsubRequests();
      unsubTime();
      unsubLogs();
      unsubAudit();
      unsubNotifs();
      unsubMails();
    };
  }, [isAuthenticated]);

  // Automatic Sprint Schedule Normalization (in-memory & local cache only; avoids continuous Firestore rewrite loops)
  useEffect(() => {
    const { sprints: normalized, hasChanges } = normalizeSprintSchedule(sprints);
    if (hasChanges) {
      setSprints(normalized);
      safeLocalStorageSet(`${STORAGE_KEY}_sprints`, JSON.stringify(normalized));
    }
  }, [sprints.length]);

  // Automatic Jira Project Mapping Re-alignment (guarded to run once on initial load to prevent infinite write loops)
  const hasAutoRepairedJiraRef = useRef(false);
  useEffect(() => {
    if (hasAutoRepairedJiraRef.current) return;
    if (tasks.length === 0 || projects.length === 0) return;

    // Check if any Jira tasks have mismatched project associations
    const misaligned = tasks.some(t => {
      if (!t.isJiraImported && !t.jiraIssueKey) return false;
      const targetProj = resolveStudioProjectForTask(t, projects, settings.jiraConfig?.projectMappings);
      if (targetProj && (t.projectId !== targetProj.id || (targetProj.name && t.jiraProjectName !== targetProj.name))) {
        return true;
      }
      return false;
    });

    if (misaligned) {
      hasAutoRepairedJiraRef.current = true;
      repairJiraTaskProjectMappings();
    }
  }, [tasks.length, projects.length]);

  // Automatic Jira Assignee Reconciliation (Requirements 357-360, 362-365)
  const hasAutoReconciledAssigneesRef = useRef(false);
  useEffect(() => {
    if (hasAutoReconciledAssigneesRef.current) return;
    if (tasks.length === 0 || artists.length === 0) return;

    const needsReconciliation = tasks.some(t => {
      if (!t.isJiraImported && !t.jiraIssueKey) return false;
      if (t.jiraOriginalAssignee || t.jiraAssigneeEmail || t.jiraAssigneeAccountId) {
        if (!t.artistId) return true;
        const resolution = resolveJiraAssigneeToStudio(
          {
            displayName: t.jiraOriginalAssignee,
            accountId: t.jiraAssigneeAccountId,
            email: t.jiraAssigneeEmail
          },
          artists,
          users,
          settings.jiraConfig?.userMappings || []
        );
        if (resolution.artistId && t.artistId !== resolution.artistId) {
          return true;
        }
      }
      return false;
    });

    if (needsReconciliation) {
      hasAutoReconciledAssigneesRef.current = true;
      reconcileAllJiraAssignees();
    }
  }, [tasks.length, artists.length, users.length]);

  const refreshStudioData = async (): Promise<void> => {
    try {
      const [u, p, s, a, b] = await Promise.all([
        fetchStableCollectionOnce<User>(COLLECTIONS.USERS, 200),
        fetchStableCollectionOnce<Project>(COLLECTIONS.PROJECTS, 100),
        fetchStableCollectionOnce<Sprint>(COLLECTIONS.SPRINTS, 100),
        fetchStableCollectionOnce<Artist>(COLLECTIONS.ARTISTS, 100),
        fetchBacklogTasks(100)
      ]);
      if (u && u.length > 0) {
        setUsers(u);
        safeLocalStorageSet(`${STORAGE_KEY}_users`, JSON.stringify(u));
      }
      if (p && p.length > 0) {
        setProjects(p);
        safeLocalStorageSet(`${STORAGE_KEY}_projects`, JSON.stringify(p));
      }
      if (s && s.length > 0) {
        const { sprints: normalized } = normalizeSprintSchedule(s);
        setSprints(normalized);
        safeLocalStorageSet(`${STORAGE_KEY}_sprints`, JSON.stringify(normalized));
      }
      if (a && a.length > 0) {
        setArtists(a);
        safeLocalStorageSet(`${STORAGE_KEY}_artists`, JSON.stringify(a));
      }
      if (b && b.length > 0) {
        setTasks(prev => {
          const map = new Map<string, Task>();
          prev.forEach(t => map.set(t.id, t));
          b.forEach(t => {
            if (!map.has(t.id)) map.set(t.id, t);
          });
          const merged = Array.from(map.values());
          safeLocalStorageSet(`${STORAGE_KEY}_tasks`, JSON.stringify(merged));
          return merged;
        });
      }
    } catch (err) {
      console.warn('Manual refresh studio data error:', err);
    }
  };

  const wipeAllUsers = async () => {
    try {
      await wipeAllUsersInFirestore();
    } catch (e) {
      console.warn('Wipe all users warning:', e);
    }
    setUsers([]);
    localStorage.removeItem(`${STORAGE_KEY}_users`);
    localStorage.removeItem(`${STORAGE_KEY}_current_user`);
  };

  const wipeAllCloudData = async () => {
    try {
      await wipeAllStudioDataInFirestore();
    } catch (e) {
      console.warn('Wipe all cloud data warning:', e);
    }
    setUsers([]);
    setArtists([]);
    setProjects([]);
    setSprints([]);
    setTasks([]);
    setRequests([]);
    setTimeEntries([]);
    setAccessAuditLogs([]);
    setActivityLogs([]);
    setNotifications([]);
    setStudioMails([]);
    localStorage.clear();
  };

  // Automatic Migration & Deduplication:
  // 1. Remove duplicate "AMD - Internal" projects and move all tickets, requests, sprints, and time entries to the single canonical AMD - Internal project (id: 'proj-amd')
  // 2. Remove any other duplicate/similar projects in the database
  const hasRunAmdDeduplicationRef = useRef(false);
  useEffect(() => {
    if (hasRunAmdDeduplicationRef.current) return;
    if (projects.length === 0) return;
    hasRunAmdDeduplicationRef.current = true;

    // Identify all projects that refer to AMD - Internal (or legacy American Dad)
    const amdProjects = projects.filter(p => isAmdInternalProject(p) || p.name.trim().toLowerCase() === 'amd - internal');

    let canonicalAmd = projects.find(p => p.id === 'proj-amd');
    if (!canonicalAmd && amdProjects.length > 0) {
      canonicalAmd = amdProjects[0];
    }

    if (!canonicalAmd) {
      canonicalAmd = {
        id: 'proj-amd',
        name: 'AMD - Internal',
        key: 'AMD',
        description: 'Internal art assets, character pipelines, LiveOps features, and UI development for AMD game pipeline.',
        ownerId: 'user-ranjeet',
        artManagerId: 'user-ranjeet',
        artDirectorId: 'user-marcus',
        startDate: '2026-01-01',
        targetEndDate: '2027-12-31',
        status: 'Active',
        priority: 'High',
        projectType: 'Game',
        taskCounter: 100,
        avatarColor: 'bg-amber-600',
        members: [
          { userId: 'user-ranjeet', accessLevel: 'MANAGER', assignedAt: '2026-01-01' },
          { userId: 'user-marcus', accessLevel: 'MANAGER', assignedAt: '2026-01-01' },
          { userId: 'user-rahul', accessLevel: 'EDITOR', assignedAt: '2026-01-05' },
          { userId: 'user-jessica', accessLevel: 'EDITOR', assignedAt: '2026-01-05' }
        ]
      };
    } else if (canonicalAmd.name !== 'AMD - Internal' || canonicalAmd.key !== 'AMD' || canonicalAmd.id !== 'proj-amd') {
      canonicalAmd = {
        ...canonicalAmd,
        id: 'proj-amd',
        name: 'AMD - Internal',
        key: 'AMD'
      };
    }

    // Collect all duplicate AMD project IDs that actually exist in projects or legacy IDs
    const duplicateAmdIds = new Set<string>();
    amdProjects.forEach(p => {
      if (p.id !== 'proj-amd') {
        duplicateAmdIds.add(p.id);
      }
    });
    if (projects.some(p => p.id === 'proj-ad')) duplicateAmdIds.add('proj-ad');
    if (projects.some(p => p.id === 'proj-americandad')) duplicateAmdIds.add('proj-americandad');

    // General duplicate removal: check if multiple projects share the exact same normalized name or key
    const seenNames = new Set<string>();
    const seenKeys = new Set<string>();
    seenNames.add(normalizeProjectName('AMD - Internal'));
    seenKeys.add('AMD');

    const duplicateOtherIds = new Set<string>();
    const cleanedProjects: Project[] = [canonicalAmd];

    for (const proj of projects) {
      if (duplicateAmdIds.has(proj.id) || proj.id === 'proj-amd' || proj.id === canonicalAmd.id) {
        continue;
      }
      const norm = normalizeProjectName(proj.name);
      const k = proj.key.trim().toUpperCase();

      if (seenNames.has(norm) || seenKeys.has(k)) {
        duplicateOtherIds.add(proj.id);
      } else {
        seenNames.add(norm);
        seenKeys.add(k);
        cleanedProjects.push(proj);
      }
    }

    const needsProjectUpdate =
      duplicateAmdIds.size > 0 ||
      duplicateOtherIds.size > 0 ||
      projects.length !== cleanedProjects.length ||
      !projects.some(p => p.id === 'proj-amd' && p.name === 'AMD - Internal' && p.key === 'AMD');

    if (needsProjectUpdate) {
      // Permanently remove duplicates from Firestore
      duplicateAmdIds.forEach(dupId => {
        if (dupId !== 'proj-amd') {
          syncDeleteDoc(COLLECTIONS.PROJECTS, dupId);
        }
      });
      duplicateOtherIds.forEach(dupId => {
        syncDeleteDoc(COLLECTIONS.PROJECTS, dupId);
      });

      // Save canonical AMD project
      syncSaveDoc(COLLECTIONS.PROJECTS, canonicalAmd);

      setProjects(cleanedProjects);
      safeLocalStorageSet(`${STORAGE_KEY}_projects`, JSON.stringify(cleanedProjects));
    }

    // Migrate ALL tasks pointing to any duplicate AMD project ID, or with AMD/American Dad names/keys
    const hasAmdTasksToMigrate = tasks.some(t =>
      duplicateAmdIds.has(t.projectId) ||
      (t.projectId !== 'proj-amd' && (
        t.projectId === 'proj-ad' ||
        t.projectId === 'proj-americandad' ||
        (t.jiraProjectName && (t.jiraProjectName.toLowerCase().includes('amd') || t.jiraProjectName.toLowerCase().includes('american dad'))) ||
        (t.jiraProjectKey && (t.jiraProjectKey.toUpperCase() === 'AMD' || t.jiraProjectKey.toUpperCase() === 'AD' || t.jiraProjectKey.toUpperCase() === 'AMDI'))
      ))
    );

    if (hasAmdTasksToMigrate) {
      setTasks(prev => prev.map(t => {
        const isMatch = duplicateAmdIds.has(t.projectId) ||
          (t.projectId !== 'proj-amd' && (
            t.projectId === 'proj-ad' ||
            t.projectId === 'proj-americandad' ||
            (t.jiraProjectName && (t.jiraProjectName.toLowerCase().includes('amd') || t.jiraProjectName.toLowerCase().includes('american dad'))) ||
            (t.jiraProjectKey && (t.jiraProjectKey.toUpperCase() === 'AMD' || t.jiraProjectKey.toUpperCase() === 'AD' || t.jiraProjectKey.toUpperCase() === 'AMDI'))
          ));
        if (isMatch) {
          const updatedTask: Task = {
            ...t,
            projectId: 'proj-amd',
            jiraProjectName: t.jiraProjectName ? 'AMD - Internal' : undefined
          };
          syncSaveDoc(COLLECTIONS.TASKS, updatedTask);
          return updatedTask;
        }
        return t;
      }));
    }

    // Migrate all requests pointing to duplicate AMD projects
    const hasAmdRequestsToMigrate = requests.some(r => duplicateAmdIds.has(r.projectId) || r.projectId === 'proj-ad' || r.projectId === 'proj-americandad');
    if (hasAmdRequestsToMigrate) {
      setRequests(prev => prev.map(r => {
        if (duplicateAmdIds.has(r.projectId) || r.projectId === 'proj-ad' || r.projectId === 'proj-americandad') {
          const updatedReq = { ...r, projectId: 'proj-amd' };
          syncSaveDoc(COLLECTIONS.REQUESTS, updatedReq);
          return updatedReq;
        }
        return r;
      }));
    }

    // Migrate all sprints pointing to duplicate AMD projects
    const hasAmdSprintsToMigrate = sprints.some(s => duplicateAmdIds.has(s.projectId) || s.projectId === 'proj-ad' || s.projectId === 'proj-americandad');
    if (hasAmdSprintsToMigrate) {
      setSprints(prev => prev.map(s => {
        if (duplicateAmdIds.has(s.projectId) || s.projectId === 'proj-ad' || s.projectId === 'proj-americandad') {
          const updatedSprint = { ...s, projectId: 'proj-amd' };
          syncSaveDoc(COLLECTIONS.SPRINTS, updatedSprint);
          return updatedSprint;
        }
        return s;
      }));
    }

    // Migrate all time entries pointing to duplicate AMD projects
    const hasAmdTimeEntriesToMigrate = timeEntries.some(te => duplicateAmdIds.has(te.projectId) || te.projectId === 'proj-ad' || te.projectId === 'proj-americandad');
    if (hasAmdTimeEntriesToMigrate) {
      setTimeEntries(prev => prev.map(te => {
        if (duplicateAmdIds.has(te.projectId) || te.projectId === 'proj-ad' || te.projectId === 'proj-americandad') {
          const updatedTe = { ...te, projectId: 'proj-amd' };
          syncSaveDoc(COLLECTIONS.TIME_ENTRIES, updatedTe);
          return updatedTe;
        }
        return te;
      }));
    }
  }, [projects.length, tasks.length, requests.length, sprints.length, timeEntries.length]);

  // Synthesize and merge all active Studio Users into artists list so everyone on the team can be assigned tasks!
  // Strictly excludes Requesters (who are requirements submitters, not production art resources)
  const mergedArtists = useMemo<Artist[]>(() => {
    // Start with existing artists that are NOT Requesters
    const list = artists.filter(a => {
      if (a.userRole === 'COMPANY_REQUESTER' || a.role === 'COMPANY_REQUESTER') return false;
      const r = (a.role || '').toLowerCase();
      const spec = (a.specialization || '').toLowerCase();
      return !r.includes('requester') && !spec.includes('requester');
    });

    for (const u of users) {
      if (u.status === 'REJECTED' || u.role === 'COMPANY_REQUESTER') continue;
      const matchIndex = list.findIndex(
        a => a.id === u.id || a.userId === u.id || (u.artistId && a.id === u.artistId) || (a.email && u.email && a.email.toLowerCase() === u.email.toLowerCase())
      );
      if (matchIndex >= 0) {
        list[matchIndex] = {
          ...list[matchIndex],
          name: u.name || list[matchIndex].name,
          email: u.email || list[matchIndex].email,
          avatar: u.avatar || list[matchIndex].avatar,
          userId: u.id,
          userRole: u.role,
          isManagement: u.role === 'ADMIN' || u.role === 'ART_DIRECTOR' || u.role === 'ART_MANAGER'
        };
      } else {
        list.push({
          id: u.id,
          userId: u.id,
          name: u.name,
          email: u.email,
          avatar: u.avatar,
          role: u.title || (u.role === 'ADMIN' ? 'Head of Art / Studio Admin' : u.role === 'ART_DIRECTOR' ? 'Art Director' : u.role === 'ART_MANAGER' ? 'Art Manager' : 'Digital Artist'),
          specialization: u.department || 'Production Art',
          assignedProjects: [],
          dailyCapacity: 8,
          weeklyCapacity: 40,
          workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
          productionAllocation: 100,
          meetingHoursWeekly: 0,
          status: 'Active',
          joinDate: u.createdAt || '2024-01-01',
          skills: [
            { category: 'Marketing Art', rating: 4 },
            { category: 'Character', rating: 4 },
            { category: 'UI', rating: 4 }
          ],
          leaveSchedule: [],
          isManagement: u.role === 'ADMIN' || u.role === 'ART_DIRECTOR' || u.role === 'ART_MANAGER',
          userRole: u.role
        });
      }
    }
    return list;
  }, [artists, users]);

  const markStudioMailAsRead = async (mailId: string) => {
    await firestoreMarkMailRead(mailId);
    setStudioMails(prev => prev.map(m => m.id === mailId ? { ...m, read: true } : m));
  };

  const sendStudioMail = async (mail: Omit<StudioMail, 'id' | 'timestamp' | 'read'>): Promise<StudioMail> => {
    const dispatched = await firestoreSendMail(mail);
    setStudioMails(prev => [dispatched, ...prev.filter(m => m.id !== dispatched.id)]);
    return dispatched;
  };

  const verifyUserWithCode = async (
    identifier: string,
    code: string
  ): Promise<{ success: boolean; user?: User; error?: string }> => {
    const res = await firestoreVerifyCode(identifier, code);
    if (res.success && res.user) {
      const verifiedUser = res.user;
      setUsers(prev => prev.map(u => u.id === verifiedUser.id ? verifiedUser : u));
      if (verifiedUser.status === 'ACTIVE') {
        const safeUser = sanitizeUserForStorage(verifiedUser);
        setCurrentUser(safeUser);
        setIsAuthenticated(true);
        safeLocalStorageSet(`${STORAGE_KEY}_auth_state`, 'true');
        safeLocalStorageSet(`${STORAGE_KEY}_current_user`, JSON.stringify(safeUser));
      }
      logActivity('Code Verified', 'Access', verifiedUser.id, `User ${verifiedUser.name} verified security code ${code}.`);
      return res;
    }
    return res;
  };

  const resendVerificationCode = async (
    identifier: string
  ): Promise<{ success: boolean; verificationCode?: string; error?: string }> => {
    const res = await firestoreResendCode(identifier);
    if (res.success && res.verificationCode) {
      refreshStudioMails();
      logActivity('Code Resent', 'Access', identifier, `Verification code resent for ${identifier}.`);
    }
    return res;
  };

  const checkUserStatus = async (
    identifier: string
  ): Promise<{ success: boolean; user?: User; status?: string; error?: string }> => {
    const res = await firestoreCheckStatus(identifier);
    if (res.success && res.user) {
      setUsers(prev => prev.map(u => u.id === res.user!.id ? res.user! : u));
    }
    return res;
  };

  const requestPasswordReset = async (
    identifier: string
  ): Promise<{ success: boolean; email?: string; resetCode?: string; error?: string }> => {
    const res = await firestoreRequestPasswordReset(identifier);
    if (res.success) {
      refreshStudioMails();
      logActivity('Password Reset Requested', 'Access', identifier, `Password reset requested for ${identifier}.`);
    }
    return res;
  };

  const resetUserPassword = async (
    identifier: string,
    resetCode: string,
    newPassword: string
  ): Promise<{ success: boolean; user?: User; error?: string }> => {
    const res = await firestoreResetUserPassword(identifier, resetCode, newPassword);
    if (res.success && res.user) {
      const updatedUser = res.user;
      setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
      refreshStudioMails();
      logActivity('Password Reset Success', 'Access', updatedUser.id, `Password was successfully changed for ${updatedUser.name}.`);
    }
    return res;
  };

  // Check if current user has granular field access
  const hasFieldAccess = (field: keyof FieldAccessPermissions): boolean => {
    const effectiveRole = previewRole || currentUser.role;
    if (effectiveRole === 'ADMIN' || effectiveRole === 'ART_DIRECTOR' || effectiveRole === 'ART_MANAGER') {
      return true;
    }
    if (!previewRole && currentUser.fieldPermissions && currentUser.fieldPermissions[field] !== undefined) {
      return Boolean(currentUser.fieldPermissions[field]);
    }
    const defaults = defaultFieldPermissionsForRole(effectiveRole);
    return Boolean(defaults[field]);
  };

  // Granular Tab-by-Tab Access Controls
  const getTabAccessMode = useCallback((tabId: NavigationTab): TabAccessMode => {
    const effectiveRole = previewRole || currentUser.role;
    if (effectiveRole === 'ADMIN') {
      return 'FULL';
    }

    // 1. Direct explicit tab override in user fieldPermissions (only if not in preview role)
    if (!previewRole && currentUser.fieldPermissions?.tabAccess && currentUser.fieldPermissions.tabAccess[tabId] !== undefined) {
      const explicitMode = currentUser.fieldPermissions.tabAccess[tabId];
      if (explicitMode) return explicitMode;
    }

    // 2. Specific daily report mode flag
    if (!previewRole && (tabId === 'daily-report' || tabId === 'sprint-report') && currentUser.fieldPermissions?.dailyReportAccess) {
      if (currentUser.fieldPermissions.dailyReportAccess === 'VIEW_ONLY') return 'VIEW';
      if (currentUser.fieldPermissions.dailyReportAccess === 'FULL_ACCESS') return 'FULL';
      if (currentUser.fieldPermissions.dailyReportAccess === 'NONE') return 'NONE';
    }

    // 3. Fallback to default tab preset for role
    const roleDefaults = defaultFieldPermissionsForRole(effectiveRole);
    if (roleDefaults.tabAccess && roleDefaults.tabAccess[tabId] !== undefined) {
      return roleDefaults.tabAccess[tabId] || 'NONE';
    }

    // 4. Default fallback by role
    if (effectiveRole === 'ART_DIRECTOR' || effectiveRole === 'ART_MANAGER') {
      return 'FULL';
    }
    if (effectiveRole === 'ARTIST') {
      const artistFullTabs: NavigationTab[] = ['my-tasks', 'kanban', 'daily-report', 'sprint-report'];
      const artistViewTabs: NavigationTab[] = ['dashboard', 'gallery', 'requests', 'backlog', 'sprints', 'calendar', 'activity'];
      if (artistFullTabs.includes(tabId)) return 'FULL';
      if (artistViewTabs.includes(tabId)) return 'VIEW';
      return 'NONE';
    }
    if (effectiveRole === 'COMPANY_REQUESTER' || effectiveRole === 'VIEWER') {
      if (tabId === 'requests') return 'FULL';
      if (tabId === 'dashboard' || tabId === 'gallery') return 'VIEW';
      return 'NONE';
    }

    return 'NONE';
  }, [previewRole, currentUser.role, currentUser.fieldPermissions]);

  const canAccessTab = useCallback((tabId: NavigationTab): boolean => {
    const mode = getTabAccessMode(tabId);
    return mode !== 'NONE';
  }, [getTabAccessMode]);

  const isTabReadOnly = useCallback((tabId: NavigationTab): boolean => {
    const mode = getTabAccessMode(tabId);
    return mode === 'VIEW';
  }, [getTabAccessMode]);

  const canApproveUserLogins = (): boolean => {
    const effectiveRole = previewRole || currentUser.role;
    return effectiveRole === 'ADMIN' || effectiveRole === 'ART_DIRECTOR' || effectiveRole === 'ART_MANAGER';
  };

  const loginWithOfficeId = async (
    officeId: string,
    password?: string
  ): Promise<{ success: boolean; user?: User; status?: string; error?: string }> => {
    const rawInput = officeId.trim();
    if (!rawInput) {
      return { success: false, error: 'Please enter your Company Email or Office ID.' };
    }
    
    // First try Firestore
    const res = await firestoreLoginUser(rawInput, password);
    if (res.success && res.user) {
      const safeUser = sanitizeUserForStorage(res.user);
      setCurrentUser(safeUser);
      setIsAuthenticated(true);
      safeLocalStorageSet(`${STORAGE_KEY}_auth_state`, 'true');
      safeLocalStorageSet(`${STORAGE_KEY}_current_user`, JSON.stringify(safeUser));
      // Ensure user is present in local users state
      setUsers(prev => {
        const exists = prev.find(u => u.id === safeUser.id);
        if (exists) {
          return prev.map(u => u.id === safeUser.id ? safeUser : u);
        }
        return [...prev, safeUser];
      });
      logActivity('Signed In', 'Access', safeUser.id, `User ${safeUser.name} signed in (${safeUser.email || safeUser.officeId}).`);
      return { ...res, user: safeUser };
    }

    // Fallback: check local users state
    const normalizedInput = rawInput.toLowerCase();
    const upperInput = rawInput.toUpperCase();
    const localMatch = users.find(
      u =>
        (u.email && u.email.toLowerCase() === normalizedInput) ||
        (u.officeId && u.officeId.toUpperCase() === upperInput) ||
        u.id === rawInput
    );
    if (localMatch) {
      if (password && localMatch.password && localMatch.password !== password) {
        return { success: false, error: 'Incorrect password for this company account.' };
      }
      if (localMatch.status === 'PENDING_APPROVAL') {
        return {
          success: false,
          status: 'PENDING_APPROVAL',
          user: localMatch,
          error: 'Your account is pending review. Studio Administrator (wwemayhemgame@gmail.com) must accept and approve your access request before you can enter.'
        };
      }
      if (localMatch.status === 'REJECTED') {
        return {
          success: false,
          status: 'REJECTED',
          user: localMatch,
          error: `Your access request was declined. Reason: ${localMatch.rejectionReason || 'Contact Studio Administrator.'}`
        };
      }
      const safeLocal = sanitizeUserForStorage(localMatch);
      setCurrentUser(safeLocal);
      setIsAuthenticated(true);
      safeLocalStorageSet(`${STORAGE_KEY}_auth_state`, 'true');
      safeLocalStorageSet(`${STORAGE_KEY}_current_user`, JSON.stringify(safeLocal));
      logActivity('Signed In', 'Access', safeLocal.id, `User ${safeLocal.name} signed in with ${safeLocal.email}.`);
      return { success: true, user: safeLocal, status: 'ACTIVE' };
    }

    return {
      success: false,
      error: res.error || `No studio account found for "${rawInput}".`
    };
  };

  const registerUserWithOfficeId = async (data: {
    name: string;
    email: string;
    officeId?: string;
    password?: string;
    role?: UserRole;
    department?: string;
    title?: string;
    avatar?: string;
  }): Promise<{ success: boolean; user?: User; verificationCode?: string; error?: string }> => {
    const res = await firestoreRegisterUser(data);
    if (res.success && res.user) {
      setUsers(prev => [...prev, res.user!]);
      refreshStudioMails();
      
      // Notify all managers & admins
      const managers = users.filter(u => u.role === 'ART_MANAGER' || u.role === 'ART_DIRECTOR' || u.role === 'ADMIN');
      managers.forEach(m => {
        addNotification(
          m.id,
          'New Studio Access Request',
          `${res.user!.name} (${res.user!.department} - ${res.user!.title}) submitted an access request (Code: ${res.verificationCode}). Review in People & Access tab.`,
          'info',
          'access'
        );
      });

      logActivity('Requested Access', 'Access', res.user.id, `User ${res.user.name} submitted access request (Tracking Code: ${res.verificationCode}).`);
      return res;
    }

    // Local fallback creation
    const generatedOfficeId = (data.officeId || '').trim().toUpperCase() || `OFF-${Math.floor(1000 + Math.random() * 9000)}`;
    const verificationCode = generateVerificationCode();
    const newUserId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const fallbackUser: User = {
      id: newUserId,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      officeId: generatedOfficeId,
      password: data.password || 'password123',
      role: data.role || 'ARTIST',
      department: (data.department || 'Art Department').trim(),
      title: (data.title || 'Studio Team Member').trim(),
      avatar: data.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      status: 'PENDING_APPROVAL',
      verificationCode,
      isVerified: false,
      createdAt: new Date().toISOString(),
      fieldPermissions: defaultFieldPermissionsForRole(data.role || 'ARTIST')
    };

    setUsers(prev => [...prev, fallbackUser]);

    // Send local confirmation mail
    await sendStudioMail({
      toEmail: fallbackUser.email,
      toName: fallbackUser.name,
      fromName: 'Studio Access Operations',
      fromEmail: 'access-control@gamestudio.internal',
      subject: `Studio Access Request Received — Code: ${verificationCode}`,
      body: `Hello ${fallbackUser.name},\n\nYour access request has been received. Your tracking verification code is ${verificationCode}.`,
      type: 'REQUEST_SUBMITTED',
      verificationCode
    });

    logActivity('Requested Access', 'Access', fallbackUser.id, `User ${fallbackUser.name} submitted access request (Code: ${verificationCode}).`);
    return { success: true, user: fallbackUser, verificationCode };
  };

  const approveUserLogin = async (
    targetUserId: string,
    assignedRole?: UserRole,
    customPerms?: Partial<FieldAccessPermissions>
  ): Promise<{ success: boolean; verificationCode?: string; error?: string }> => {
    if (!canApproveUserLogins()) {
      return { success: false, error: 'Only Art Managers, Art Directors, and Admins can accept user logins.' };
    }

    const res = await firestoreApproveUser(targetUserId, currentUser, customPerms, assignedRole);
    const activationCode = res.verificationCode || generateVerificationCode();
    
    // Update local state
    setUsers(prev => prev.map(u => {
      if (u.id === targetUserId) {
        const finalRole = assignedRole || u.role;
        const basePerms = defaultFieldPermissionsForRole(finalRole);
        return {
          ...u,
          status: 'ACTIVE',
          role: finalRole,
          approvedBy: currentUser.id,
          approvedByName: currentUser.name,
          approvedAt: new Date().toISOString(),
          verificationCode: activationCode,
          isVerified: true,
          fieldPermissions: {
            ...basePerms,
            ...(u.fieldPermissions || {}),
            ...(customPerms || {})
          },
          rejectionReason: undefined
        };
      }
      return u;
    }));

    refreshStudioMails();

    const target = users.find(u => u.id === targetUserId);
    if (target) {
      addNotification(
        target.id,
        'Account Approved & Code Dispatched!',
        `Your access request has been approved by ${currentUser.name}. 6-digit Activation Code: ${activationCode}.`,
        'success'
      );
    }

    logActivity('Approved Login', 'Access', targetUserId, `Leadership approved access request for ${target?.name || targetUserId} (${assignedRole || target?.role}). Activation Code: ${activationCode}`);
    return { success: true, verificationCode: activationCode };
  };

  const rejectUserLogin = async (
    targetUserId: string,
    reason: string
  ): Promise<{ success: boolean; verificationCode?: string; error?: string }> => {
    if (!canApproveUserLogins()) {
      return { success: false, error: 'Unauthorized to decline users.' };
    }

    const res = await firestoreRejectUser(targetUserId, currentUser, reason);
    const rejectCode = res.verificationCode || generateVerificationCode();
    
    setUsers(prev => prev.map(u => {
      if (u.id === targetUserId) {
        return {
          ...u,
          status: 'REJECTED',
          rejectionReason: reason,
          approvedBy: currentUser.id,
          approvedByName: currentUser.name,
          approvedAt: new Date().toISOString(),
          verificationCode: rejectCode,
          isVerified: false
        };
      }
      return u;
    }));

    refreshStudioMails();

    const target = users.find(u => u.id === targetUserId);
    logActivity('Rejected Login', 'Access', targetUserId, `Leadership declined login for ${target?.name || targetUserId}. Reason: ${reason} (Ref Code: ${rejectCode})`);
    return { success: true, verificationCode: rejectCode };
  };

  const updateUserPermissions = async (
    targetUserId: string,
    permissions: FieldAccessPermissions
  ): Promise<boolean> => {
    await firestoreUpdatePermissions(targetUserId, permissions);
    setUsers(prev => prev.map(u => {
      if (u.id === targetUserId) {
        return { ...u, fieldPermissions: permissions };
      }
      return u;
    }));
    if (currentUser.id === targetUserId) {
      setCurrentUser(prev => ({ ...prev, fieldPermissions: permissions }));
    }
    logActivity('Updated Permissions', 'Access', targetUserId, `Updated granular field permissions for ${targetUserId}.`);
    return true;
  };

  const updateUserTabPermissions = async (
    targetUserId: string,
    tabAccess: Partial<Record<NavigationTab, TabAccessMode>>,
    dailyReportAccess?: DailyReportAccessLevel
  ): Promise<boolean> => {
    const target = users.find(u => u.id === targetUserId);
    if (!target) return false;

    const basePerms = target.fieldPermissions || defaultFieldPermissionsForRole(target.role);
    const updatedPerms: FieldAccessPermissions = {
      ...basePerms,
      tabAccess,
      dailyReportAccess: dailyReportAccess !== undefined ? dailyReportAccess : basePerms.dailyReportAccess
    };

    return updateUserPermissions(targetUserId, updatedPerms);
  };

  const grantDailyReportViewAccess = async (targetUserId: string): Promise<boolean> => {
    const target = users.find(u => u.id === targetUserId);
    if (!target) return false;

    const basePerms = target.fieldPermissions || defaultFieldPermissionsForRole(target.role);
    const currentTabAccess = basePerms.tabAccess || {};
    const newTabAccess: Partial<Record<NavigationTab, TabAccessMode>> = {
      ...currentTabAccess,
      'daily-report': 'VIEW',
      dashboard: currentTabAccess.dashboard && currentTabAccess.dashboard !== 'NONE' ? currentTabAccess.dashboard : 'VIEW'
    };

    const newFieldPerms: FieldAccessPermissions = {
      ...basePerms,
      tabAccess: newTabAccess,
      dailyReportAccess: 'VIEW_ONLY'
    };

    const success = await updateUserPermissions(targetUserId, newFieldPerms);

    if (success) {
      try {
        await sendStudioMail({
          toEmail: target.email,
          toName: target.name,
          fromName: currentUser.name,
          fromEmail: currentUser.email,
          subject: 'Access Granted: Daily Tasks Report (View-Only)',
          body: `Hello ${target.name},\n\nYou have been granted View-Only access to the Daily Tasks Report by ${currentUser.name} (${currentUser.role}). You can now inspect real-time artist logs, sprint progress, and task metrics.\n\nOffice ID: ${target.officeId || 'Studio Member'}\nStudio Hub: RG ArtFlow`,
          previewText: `${currentUser.name} shared View-Only access to Daily Tasks Report with you.`,
          type: 'SYSTEM_ALERT'
        });
      } catch (err) {
        console.warn('Could not dispatch mail notification:', err);
      }

      addNotification(
        target.id,
        'Daily Report Access Granted',
        `Granted View-Only access for Daily Tasks Report to ${target.name} (${target.officeId || target.email}).`,
        'success',
        'system'
      );
    }

    return success;
  };

  useEffect(() => {
    safeLocalStorageSet(`${STORAGE_KEY}_artists`, JSON.stringify(artists));
  }, [artists]);

  useEffect(() => {
    safeLocalStorageSet(`${STORAGE_KEY}_projects`, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    safeLocalStorageSet(`${STORAGE_KEY}_sprints`, JSON.stringify(sprints));
  }, [sprints]);

  useEffect(() => {
    safeLocalStorageSet(`${STORAGE_KEY}_tasks`, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    safeLocalStorageSet(`${STORAGE_KEY}_requests`, JSON.stringify(requests));
  }, [requests]);

  useEffect(() => {
    safeLocalStorageSet(`${STORAGE_KEY}_time`, JSON.stringify(timeEntries));
  }, [timeEntries]);

  useEffect(() => {
    safeLocalStorageSet(`${STORAGE_KEY}_access_logs`, JSON.stringify(accessAuditLogs));
  }, [accessAuditLogs]);

  useEffect(() => {
    safeLocalStorageSet(`${STORAGE_KEY}_activity_logs`, JSON.stringify(activityLogs));
  }, [activityLogs]);

  useEffect(() => {
    safeLocalStorageSet(`${STORAGE_KEY}_notifications`, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    safeLocalStorageSet(`${STORAGE_KEY}_settings`, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    safeLocalStorageSet(`${STORAGE_KEY}_manual_allocations`, JSON.stringify(manualAllocations));
  }, [manualAllocations]);

  // Helper to log activities
  const logActivity = (
    action: string,
    targetType: 'Task' | 'Request' | 'Sprint' | 'Project' | 'Artist' | 'Access' | 'Time',
    targetId: string,
    details: string,
    targetTitle?: string
  ) => {
    const newLog: ActivityLog = {
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: formatDateTime(new Date().toISOString()),
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action,
      targetType,
      targetId,
      targetTitle,
      details
    };
    setActivityLogs(prev => [newLog, ...prev]);
    syncSaveDoc(COLLECTIONS.ACTIVITY_LOGS, newLog);
  };

  // Helper to push notifications
  const addNotification = (
    userId: string,
    title: string,
    message: string,
    type: 'info' | 'warning' | 'success' | 'alert' = 'info',
    linkType?: any,
    linkId?: string
  ) => {
    const newNotif: AppNotification = {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId,
      title,
      message,
      type,
      timestamp: formatDateTime(new Date().toISOString()),
      read: false,
      linkType,
      linkId
    };
    setNotifications(prev => [newNotif, ...prev]);
    syncSaveDoc(COLLECTIONS.NOTIFICATIONS, newNotif);
  };

  // RBAC permissions
  const getUserProjectAccess = (userId: string, projectId: string): ProjectAccessLevel => {
    if (!userId || !projectId) return 'VIEWER';
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return 'VIEWER';
    if (targetUser.role === 'ADMIN' || targetUser.role === 'ART_DIRECTOR' || targetUser.role === 'ART_MANAGER') {
      return 'MANAGER';
    }
    const project = projects.find(p => p.id === projectId);
    if (!project || !project.members) return 'VIEWER';
    const member = project.members.find(m => m.userId === userId);
    return member?.accessLevel || 'VIEWER';
  };

  const hasProjectPermission = (projectId: string, minLevel: ProjectAccessLevel): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN' || currentUser.role === 'ART_DIRECTOR' || currentUser.role === 'ART_MANAGER') {
      return true;
    }
    const access = getUserProjectAccess(currentUser.id, projectId);
    const levels: Record<ProjectAccessLevel, number> = {
      VIEWER: 1,
      COMMENTER: 2,
      EDITOR: 3,
      MANAGER: 4
    };
    return (levels[access] || 0) >= (levels[minLevel] || 0);
  };

  const canEditTask = (task?: Task): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN' || currentUser.role === 'ART_DIRECTOR' || currentUser.role === 'ART_MANAGER') {
      return true;
    }
    // Artists have permission to assign tasks, edit estimates, story points, and update task status
    if (currentUser.role === 'ARTIST') {
      return true;
    }
    if (task) {
      return hasProjectPermission(task.projectId, 'EDITOR');
    }
    return false;
  };

  const canManageSprint = useCallback((): boolean => {
    if (!currentUser) return false;
    return currentUser.role === 'ADMIN' || currentUser.role === 'ART_DIRECTOR' || currentUser.role === 'ART_MANAGER';
  }, [currentUser?.role]);

  const canAccessAiSprintPlanner = useCallback((): boolean => {
    if (!currentUser) return false;
    // Strictly restrict AI Weekly Sprint Planner access: Artists and Requesters do not have access
    return currentUser.role === 'ADMIN' || currentUser.role === 'ART_DIRECTOR' || currentUser.role === 'ART_MANAGER';
  }, [currentUser?.role]);

  const canCreateProject = useCallback((): boolean => {
    if (!currentUser) return false;
    return currentUser.role === 'ADMIN' || currentUser.role === 'ART_DIRECTOR' || currentUser.role === 'ART_MANAGER';
  }, [currentUser?.role]);

  const canAssignArtist = useCallback((): boolean => {
    if (!currentUser) return false;
    // Both Art Managers/Admins and Artists can assign tasks
    return currentUser.role === 'ADMIN' || currentUser.role === 'ART_DIRECTOR' || currentUser.role === 'ART_MANAGER' || currentUser.role === 'ARTIST';
  }, [currentUser?.role]);

  const canLogTime = (task?: Task): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN' || currentUser.role === 'ART_DIRECTOR' || currentUser.role === 'ART_MANAGER' || currentUser.role === 'ARTIST') {
      return true;
    }
    if (task) {
      return hasProjectPermission(task.projectId, 'EDITOR');
    }
    return false;
  };

  // Company Requests Permissions
  const isCompanyRequestOwner = (request: CompanyRequest): boolean => {
    if (!request || !currentUser) return false;
    return (
      (currentUser.id && request.requesterId === currentUser.id) ||
      (currentUser.name && request.requesterName.toLowerCase().trim() === currentUser.name.toLowerCase().trim()) ||
      Boolean(currentUser.email && request.requesterEmail?.toLowerCase().trim() === currentUser.email.toLowerCase().trim())
    );
  };

  const isCompanyRequestEditable = (request: CompanyRequest): { editable: boolean; reason?: string } => {
    if (!request) return { editable: false, reason: 'Request not found' };

    // Rule 1: Only the requesting person can edit or delete
    if (!isCompanyRequestOwner(request)) {
      return {
        editable: false,
        reason: `Access restricted. Only the requester (${request.requesterName}) has permission to edit or delete this company request.`
      };
    }

    // Rule 2: He can edit task before assigning or adding in the Sprint.
    const linkedTask = request.taskId ? tasks.find(t => t.id === request.taskId) : null;
    const assignedArtistId = request.assignedArtistId || linkedTask?.artistId;
    const isAssigned = Boolean(assignedArtistId);
    const assignedArtist = isAssigned ? artists.find(a => a.id === assignedArtistId) : null;
    const sprintId = request.sprintId || linkedTask?.sprintId;
    const sprint = sprintId ? sprints.find(s => s.id === sprintId) : null;
    const isInSprint = Boolean(sprintId);
    const isStarted = linkedTask ? linkedTask.status !== 'BACKLOG' && linkedTask.status !== 'SELECTED' : false;

    if (isAssigned || isInSprint || isStarted) {
      let cause = '';
      if (isAssigned && assignedArtist) {
        cause = `assigned to artist ${assignedArtist.name}`;
      } else if (isAssigned) {
        cause = 'assigned to an artist';
      } else if (isInSprint && sprint) {
        cause = `scheduled into Sprint "${sprint.name}"`;
      } else if (isInSprint) {
        cause = 'scheduled into a sprint';
      } else {
        cause = 'currently in production';
      }

      return {
        editable: false,
        reason: `Editing is locked because this request has been ${cause}. You can still delete or cancel this request if no longer needed.`
      };
    }

    return { editable: true };
  };

  const canEditCompanyRequest = (request: CompanyRequest): boolean => {
    return isCompanyRequestEditable(request).editable;
  };

  const canDeleteCompanyRequest = (request: CompanyRequest): boolean => {
    return isCompanyRequestOwner(request);
  };

  // Create Company Request (Automatically converts to an unassigned Project Backlog Task)
  const createRequest = (data: Omit<CompanyRequest, 'id' | 'createdAt' | 'status' | 'revisions' | 'comments'>): CompanyRequest => {
    // 1. Generate sequential REQ-XXXX
    const maxReqNum = requests.reduce((max, r) => {
      const match = r.id.match(/^REQ-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        return num > max ? num : max;
      }
      return max;
    }, 2000);

    const newReqId = `REQ-${maxReqNum + 1}`;
    
    // 2. Identify target Project
    const targetProject = projects.find(p => p.id === data.projectId) || projects[0];
    if (!targetProject) {
      throw new Error('No project found to assign request.');
    }

    // 3. Generate Project Task ID (e.g. WWEART-0001)
    const nextCounter = (targetProject.taskCounter || 0) + 1;
    const paddedCounter = String(nextCounter).padStart(4, '0');
    const taskId = `${targetProject.key}-${paddedCounter}`;

    // Update project counter
    setProjects(prev => prev.map(p => p.id === targetProject.id ? { ...p, taskCounter: nextCounter } : p));

    // 4. Calculate estimated delivery forecast
    const forecast = calculateDeliveryForecast(
      data.artCategory,
      data.estimatedHours || 12,
      data.priority,
      artists,
      tasks,
      targetProject.id
    );

    const today = getTodayDateString();
    const originalEstimate = data.estimatedHours || 12;
    const storyPoints = Math.max(1, Math.round(originalEstimate / (settings.spToHoursRatio || 2)));

    // 5. Automatically create the Project Task in BACKLOG (Unassigned)
    const newTask: Task = {
      id: taskId,
      projectId: targetProject.id,
      requestId: newReqId,
      sprintId: undefined, // Unscheduled in backlog
      taskType: data.artCategory,
      title: data.taskTitle,
      description: [
        data.taskDescription || '',
        data.platform ? `Platform: ${data.platform}` : '',
        data.targetResolution ? `Target Resolution: ${data.targetResolution}` : '',
        data.quantity ? `Quantity: ${data.quantity}` : '',
        data.dependencies ? `Dependencies: ${data.dependencies}` : '',
        data.additionalNotes ? `Additional Notes: ${data.additionalNotes}` : ''
      ].filter(Boolean).join('\n\n'),
      requesterId: data.requesterId || currentUser.id,
      artistId: undefined, // Unassigned
      artManagerId: targetProject.artManagerId || currentUser.id,
      priority: data.priority,
      storyPoints,
      originalEstimate,
      remainingEstimate: originalEstimate,
      timeLogged: 0,
      status: 'BACKLOG', // In Backlog
      createdDate: today,
      dueDate: data.desiredDeliveryDate,
      expectedDelivery: forecast.expectedDeliveryDate || data.desiredDeliveryDate,
      subtasks: [
        { id: `sub-${Date.now()}-1`, title: 'Reference review & requirements validation', completed: false, estimatedHours: Math.round(originalEstimate * 0.25) },
        { id: `sub-${Date.now()}-2`, title: 'Asset production pass', completed: false, estimatedHours: Math.round(originalEstimate * 0.5) },
        { id: `sub-${Date.now()}-3`, title: 'Final polish, export & review package', completed: false, estimatedHours: Math.round(originalEstimate * 0.25) }
      ],
      dependencies: [],
      tags: [targetProject.name, data.artCategory, data.priority, 'Company Request'],
      revisionCount: 0,
      revisions: [],
      attachments: (data.referenceFiles || []).map(rf => ({
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        name: rf.name,
        size: rf.size,
        url: rf.url,
        type: rf.type,
        uploadedBy: data.requesterId || currentUser.id,
        uploadedByName: data.requesterName || currentUser.name,
        uploadedAt: formatDateTime(new Date().toISOString())
      })),
      comments: [],
      createdBy: currentUser.id,
      updatedBy: currentUser.id
    };

    // 6. Create the linked CompanyRequest
    const newRequest: CompanyRequest = {
      ...data,
      id: newReqId,
      projectId: targetProject.id,
      taskId: taskId,
      status: 'QUEUED',
      createdAt: formatDateTime(new Date().toISOString()),
      expectedDeliveryDate: forecast.expectedDeliveryDate,
      revisions: [],
      comments: []
    };

    // Persist both
    setTasks(prev => [newTask, ...prev]);
    setRequests(prev => [newRequest, ...prev]);

    syncSaveDoc(COLLECTIONS.TASKS, newTask);
    syncSaveDoc(COLLECTIONS.REQUESTS, newRequest);
    syncSaveDoc(COLLECTIONS.PROJECTS, { ...targetProject, taskCounter: nextCounter });

    logActivity(
      'Converted Request to Backlog Task',
      'Task',
      taskId,
      `${currentUser.name} submitted company request ${newReqId}: "${data.taskTitle}", automatically converted to unassigned Task ${taskId} in ${targetProject.name} Backlog.`,
      data.taskTitle
    );

    // Notify Art Manager & Art Director
    users.filter(u => u.role === 'ART_MANAGER' || u.role === 'ART_DIRECTOR' || u.role === 'ADMIN').forEach(mgr => {
      addNotification(
        mgr.id,
        'New Request Converted to Backlog',
        `Request ${newReqId} was automatically converted to unassigned Task ${taskId} in ${targetProject.name} Backlog.`,
        'info',
        'task',
        taskId
      );
    });

    // Notify Requester
    addNotification(
      currentUser.id,
      'Request Queued as Project Task',
      `Your request ${newReqId} was converted to Task ${taskId} in ${targetProject.name}. Expected delivery: ${newRequest.expectedDeliveryDate}.`,
      'success',
      'request',
      newReqId
    );

    // Auto-Send Confirmation Email to Requester
    const requesterUser = users.find(u => u.id === currentUser.id || u.email === data.requesterEmail);
    const requesterEmail = data.requesterEmail || requesterUser?.email;
    if (requesterEmail) {
      sendTaskActivityNotificationMail({
        toEmail: requesterEmail,
        toName: data.requesterName || requesterUser?.name || 'Requester',
        actorName: currentUser.name,
        activityType: 'REQUEST_CREATED',
        taskId: newReqId,
        taskTitle: data.taskTitle,
        projectName: targetProject.name,
        details: `Your request was received and queued as project task ${taskId}.\nCategory: ${data.artCategory}\nPriority: ${data.priority}\nExpected Delivery: ${newRequest.expectedDeliveryDate}`,
        priority: data.priority,
        dueDate: data.desiredDeliveryDate,
        status: 'QUEUED'
      });
    }

    return newRequest;
  };

  const updateRequestStatus = (requestId: string, status: RequestStatus) => {
    setRequests(prev => prev.map(r => {
      if (r.id === requestId) {
        const updated = {
          ...r,
          status,
          actualDeliveryDate: status === 'DELIVERED' ? getTodayDateString() : r.actualDeliveryDate
        };
        syncSaveDoc(COLLECTIONS.REQUESTS, updated);
        return updated;
      }
      return r;
    }));
    logActivity('Updated Request Status', 'Request', requestId, `Request ${requestId} status changed to ${status}.`);
  };

  const updateCompanyRequest = (requestId: string, updates: Partial<CompanyRequest>) => {
    const target = requests.find(r => r.id === requestId);
    if (!target) return;

    // Recalculate forecast if delivery date or category or priority changes
    let newExpectedDeliveryDate = updates.expectedDeliveryDate || target.expectedDeliveryDate;
    if (updates.artCategory || updates.estimatedHours || updates.priority || updates.projectId) {
      const forecast = calculateDeliveryForecast(
        updates.artCategory || target.artCategory,
        updates.estimatedHours || target.estimatedHours || 12,
        updates.priority || target.priority,
        artists,
        tasks,
        updates.projectId || target.projectId
      );
      if (forecast?.expectedDeliveryDate) {
        newExpectedDeliveryDate = forecast.expectedDeliveryDate;
      }
    }

    const updatedRequest: CompanyRequest = {
      ...target,
      ...updates,
      expectedDeliveryDate: newExpectedDeliveryDate
    };

    setRequests(prev => prev.map(r => r.id === requestId ? updatedRequest : r));
    syncSaveDoc(COLLECTIONS.REQUESTS, updatedRequest);

    // Also update linked Task if exists
    if (target.taskId) {
      const linkedTask = tasks.find(t => t.id === target.taskId);
      if (linkedTask) {
        const updatedTaskFields: Partial<Task> = {};
        if (updates.taskTitle) updatedTaskFields.title = updates.taskTitle;
        if (
          updates.taskDescription !== undefined ||
          updates.platform !== undefined ||
          updates.targetResolution !== undefined ||
          updates.quantity !== undefined ||
          updates.dependencies !== undefined ||
          updates.additionalNotes !== undefined
        ) {
          const desc = updates.taskDescription !== undefined ? updates.taskDescription : (target.taskDescription || '');
          const plat = updates.platform !== undefined ? updates.platform : target.platform;
          const res = updates.targetResolution !== undefined ? updates.targetResolution : target.targetResolution;
          const qty = updates.quantity !== undefined ? updates.quantity : target.quantity;
          const dep = updates.dependencies !== undefined ? updates.dependencies : target.dependencies;
          const notes = updates.additionalNotes !== undefined ? updates.additionalNotes : target.additionalNotes;

          updatedTaskFields.description = [
            desc,
            plat ? `Platform: ${plat}` : '',
            res ? `Target Resolution: ${res}` : '',
            qty ? `Quantity: ${qty}` : '',
            dep ? `Dependencies: ${dep}` : '',
            notes ? `Additional Notes: ${notes}` : ''
          ].filter(Boolean).join('\n\n');
        }
        if (updates.priority) updatedTaskFields.priority = updates.priority;
        if (updates.artCategory) updatedTaskFields.taskType = updates.artCategory;
        if (updates.desiredDeliveryDate) updatedTaskFields.dueDate = updates.desiredDeliveryDate;
        if (updates.estimatedHours) {
          updatedTaskFields.originalEstimate = updates.estimatedHours;
          if (!linkedTask.timeLogged || linkedTask.timeLogged === 0) {
            updatedTaskFields.remainingEstimate = updates.estimatedHours;
          }
        }
        if (updates.projectId && updates.projectId !== linkedTask.projectId) {
          updatedTaskFields.projectId = updates.projectId;
        }

        const finalUpdatedTask = { ...linkedTask, ...updatedTaskFields, expectedDelivery: newExpectedDeliveryDate || linkedTask.expectedDelivery };
        setTasks(prev => prev.map(t => t.id === target.taskId ? finalUpdatedTask : t));
        syncSaveDoc(COLLECTIONS.TASKS, finalUpdatedTask);
      }
    }

    logActivity(
      'Updated Company Request',
      'Request',
      requestId,
      `${currentUser.name} updated request ${requestId}: "${updatedRequest.taskTitle}".`,
      updatedRequest.taskTitle
    );
  };

  const deleteCompanyRequest = (requestId: string) => {
    const target = requests.find(r => r.id === requestId);
    if (!target) return;

    // If linked task exists, delete it as well
    if (target.taskId) {
      setTasks(prev => prev.filter(t => t.id !== target.taskId && t.requestId !== requestId));
      syncDeleteDoc(COLLECTIONS.TASKS, target.taskId);
    }

    setRequests(prev => prev.filter(r => r.id !== requestId));
    syncDeleteDoc(COLLECTIONS.REQUESTS, requestId);

    logActivity(
      'Deleted Company Request',
      'Request',
      requestId,
      `${currentUser.name} deleted company request ${requestId} ("${target.taskTitle}").`
    );

    addNotification(
      currentUser.id,
      'Request Deleted',
      `Company Request ${requestId} has been deleted.`,
      'info',
      'request'
    );
  };

  // Triage Request & Generate Project-specific Task ID
  const triageAndCreateTaskFromRequest = (
    requestId: string,
    projectId: string,
    artistId: string | undefined,
    sprintId: string | undefined,
    storyPoints: number,
    originalEstimate: number,
    taskType?: string
  ): Task => {
    const project = projects.find(p => p.id === projectId);
    if (!project) throw new Error(`Project ${projectId} not found.`);

    const request = requests.find(r => r.id === requestId);
    if (!request) throw new Error(`Request ${requestId} not found.`);

    // Generate project-specific Task ID: e.g. WWEART-0158
    const nextCounter = (project.taskCounter || 0) + 1;
    const paddedCounter = String(nextCounter).padStart(4, '0');
    const taskId = `${project.key}-${paddedCounter}`;

    // Update project's task counter
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, taskCounter: nextCounter } : p));

    // Calculate expected delivery
    const artist = artists.find(a => a.id === artistId);
    const today = getTodayDateString();
    
    const newTask: Task = {
      id: taskId,
      projectId,
      requestId,
      sprintId,
      taskType: taskType || request.artCategory,
      title: request.taskTitle,
      description: request.taskDescription,
      requesterId: request.requesterId,
      artistId,
      artManagerId: currentUser.id,
      priority: request.priority,
      storyPoints: storyPoints || 3,
      originalEstimate: originalEstimate || 12,
      remainingEstimate: originalEstimate || 12,
      timeLogged: 0,
      status: sprintId ? 'SELECTED' : 'BACKLOG',
      createdDate: today,
      dueDate: request.desiredDeliveryDate,
      expectedDelivery: request.expectedDeliveryDate || today,
      subtasks: [
        { id: `sub-${Date.now()}-1`, title: 'Reference gathering & composition', completed: false, estimatedHours: Math.round(originalEstimate * 0.25) },
        { id: `sub-${Date.now()}-2`, title: 'Production pass', completed: false, estimatedHours: Math.round(originalEstimate * 0.5) },
        { id: `sub-${Date.now()}-3`, title: 'Final polish & asset exports', completed: false, estimatedHours: Math.round(originalEstimate * 0.25) }
      ],
      dependencies: [],
      tags: [project.name, request.artCategory, request.priority],
      revisionCount: 0,
      revisions: [],
      attachments: request.referenceFiles.map(rf => ({
        id: `att-${Date.now()}-${Math.random()}`,
        name: rf.name,
        size: rf.size,
        url: rf.url,
        type: rf.type,
        uploadedBy: request.requesterId,
        uploadedByName: request.requesterName,
        uploadedAt: request.createdAt
      })),
      comments: [],
      createdBy: currentUser.id,
      updatedBy: currentUser.id
    };

    // Calculate expected delivery based on artist
    if (artist) {
      newTask.expectedDelivery = calculateTaskExpectedDelivery(newTask, artist, tasks);
    }

    setTasks(prev => [newTask, ...prev]);
    syncSaveDoc(COLLECTIONS.TASKS, newTask);
    syncSaveDoc(COLLECTIONS.PROJECTS, { ...project, taskCounter: nextCounter });

    // Update the request with linked Task ID, Artist, Sprint, and Status
    setRequests(prev => prev.map(r => {
      if (r.id === requestId) {
        const updated = {
          ...r,
          taskId: newTask.id,
          assignedArtistId: artistId,
          sprintId,
          status: (artistId ? 'ASSIGNED' : 'QUEUED') as RequestStatus,
          expectedDeliveryDate: newTask.expectedDelivery
        };
        syncSaveDoc(COLLECTIONS.REQUESTS, updated);
        return updated;
      }
      return r;
    }));

    logActivity(
      'Triaged Request into Task',
      'Task',
      taskId,
      `Request ${requestId} approved into Task ${taskId} on project ${project.name} (${project.key}) assigned to ${artist?.name || 'Unassigned'}.`,
      newTask.title
    );

    // Notify requester
    addNotification(
      request.requesterId,
      'Request Approved & Scheduled',
      `Your request ${requestId} has been approved as Task ${taskId}. Expected delivery: ${newTask.expectedDelivery}`,
      'success',
      'task',
      taskId
    );

    // Auto-Send Email to Requester
    const triageRequester = users.find(u => u.id === request.requesterId || u.email === request.requesterEmail);
    const triageReqEmail = request.requesterEmail || triageRequester?.email;
    if (triageReqEmail) {
      sendTaskActivityNotificationMail({
        toEmail: triageReqEmail,
        toName: request.requesterName || triageRequester?.name || 'Requester',
        actorName: currentUser.name,
        activityType: 'STATUS_CHANGED',
        taskId: newTask.id,
        taskTitle: newTask.title,
        projectName: project.name,
        details: `Your request ${requestId} was approved and converted to project task ${taskId}.\nAssigned Artist: ${artist?.name || 'Studio Pool'}\nExpected Delivery: ${newTask.expectedDelivery}`,
        priority: newTask.priority,
        dueDate: newTask.dueDate,
        status: newTask.status
      });
    }

    // Notify artist if assigned
    if (artist) {
      addNotification(
        artist.userId,
        'New Task Assigned',
        `You have been assigned ${taskId}: ${newTask.title}`,
        'info',
        'task',
        taskId
      );

      const artistUser = users.find(u => u.id === artist.userId || u.artistId === artist.id || u.email === artist.email);
      const artistEmail = artist.email || artistUser?.email;
      if (artistEmail) {
        sendTaskActivityNotificationMail({
          toEmail: artistEmail,
          toName: artist.name,
          actorName: currentUser.name,
          activityType: 'ASSIGNED',
          taskId: newTask.id,
          taskTitle: newTask.title,
          projectName: project.name,
          details: `Task assigned to you. Original estimate: ${newTask.originalEstimate}h. Expected delivery: ${newTask.expectedDelivery}.`,
          priority: newTask.priority,
          dueDate: newTask.dueDate,
          status: newTask.status
        });
      }
    }

    return newTask;
  };

  // Dedicated unified handler for assigning or reassigning a Company Request
  const assignCompanyRequest = (requestId: string, artistId: string | undefined, sprintId?: string) => {
    const request = requests.find(r => r.id === requestId);
    if (!request) {
      console.warn(`[ArtOps] Request ${requestId} not found for assignment`);
      return;
    }

    const targetArtist = artistId ? artists.find(a => a.id === artistId) : undefined;

    // Check if linked task already exists
    const linkedTask = tasks.find(t => (request.taskId && t.id === request.taskId) || t.requestId === requestId);

    if (linkedTask) {
      const updatedStatus: TaskStatus = artistId
        ? (linkedTask.status === 'BACKLOG' || linkedTask.status === 'BLOCKED' ? 'To Do' : linkedTask.status)
        : linkedTask.status;

      let expectedDel = linkedTask.expectedDelivery;
      if (targetArtist) {
        expectedDel = calculateTaskExpectedDelivery({ ...linkedTask, artistId }, targetArtist, tasks);
      }

      const updatedTask: Task = {
        ...linkedTask,
        artistId: artistId || undefined,
        sprintId: sprintId !== undefined ? (sprintId || undefined) : linkedTask.sprintId,
        status: updatedStatus,
        expectedDelivery: expectedDel,
        updatedBy: currentUser.id
      };

      setTasks(prev => prev.map(t => t.id === linkedTask.id ? updatedTask : t));
      syncSaveDoc(COLLECTIONS.TASKS, updatedTask);

      // Update the request
      let reqStatus: RequestStatus = request.status;
      if (artistId) {
        reqStatus = (reqStatus === 'NEW' || reqStatus === 'QUEUED') ? 'ASSIGNED' : reqStatus;
      } else {
        reqStatus = (reqStatus === 'ASSIGNED') ? 'QUEUED' : reqStatus;
      }

      const updatedReq: CompanyRequest = {
        ...request,
        taskId: linkedTask.id,
        assignedArtistId: artistId || undefined,
        sprintId: sprintId !== undefined ? (sprintId || undefined) : request.sprintId,
        status: reqStatus,
        expectedDeliveryDate: expectedDel || request.expectedDeliveryDate
      };
      setRequests(prev => prev.map(r => r.id === requestId ? updatedReq : r));
      syncSaveDoc(COLLECTIONS.REQUESTS, updatedReq);

      if (targetArtist) {
        logActivity(
          'Assigned Request',
          'Request',
          requestId,
          `${currentUser.name} assigned request ${requestId} (Task: ${linkedTask.id}) to ${targetArtist.name}.`,
          request.taskTitle
        );
        addNotification(
          targetArtist.userId,
          'Task Assigned from Request',
          `You have been assigned ${linkedTask.id}: ${request.taskTitle}`,
          'info',
          'task',
          linkedTask.id
        );
      } else {
        logActivity(
          'Unassigned Request',
          'Request',
          requestId,
          `${currentUser.name} unassigned request ${requestId} (Task: ${linkedTask.id}).`,
          request.taskTitle
        );
      }
    } else {
      // No linked task exists yet - triage and create it now!
      triageAndCreateTaskFromRequest(
        requestId,
        request.projectId,
        artistId,
        sprintId,
        3,
        request.estimatedHours || 12,
        request.artCategory
      );
    }
  };

  // Create Task
  const createTask = (data: Partial<Task> & { projectId: string; title: string }): Task => {
    const project = projects.find(p => p.id === data.projectId);
    if (!project) throw new Error(`Project ${data.projectId} not found.`);

    const nextCounter = (project.taskCounter || 0) + 1;
    const paddedCounter = String(nextCounter).padStart(4, '0');
    const taskId = `${project.key}-${paddedCounter}`;

    setProjects(prev => prev.map(p => p.id === data.projectId ? { ...p, taskCounter: nextCounter } : p));

    const today = getTodayDateString();
    const originalEstimate = data.originalEstimate || 12;

    const newTask: Task = {
      id: taskId,
      projectId: data.projectId,
      sprintId: data.sprintId,
      requestId: data.requestId,
      taskType: data.taskType || 'Production Art',
      title: data.title,
      description: data.description || '',
      requesterId: data.requesterId || currentUser.id,
      artistId: data.artistId,
      artManagerId: data.artManagerId || currentUser.id,
      priority: data.priority || 'Medium',
      storyPoints: data.storyPoints || 3,
      originalEstimate,
      remainingEstimate: data.remainingEstimate ?? originalEstimate,
      timeLogged: 0,
      status: data.status || (data.sprintId ? 'SELECTED' : 'BACKLOG'),
      createdDate: today,
      dueDate: data.dueDate || today,
      expectedDelivery: data.expectedDelivery || data.dueDate || today,
      subtasks: data.subtasks || [],
      dependencies: data.dependencies || [],
      tags: data.tags || [project.name],
      revisionCount: 0,
      revisions: [],
      attachments: data.attachments || [],
      comments: [],
      createdBy: currentUser.id,
      updatedBy: currentUser.id
    };

    const artist = artists.find(a => a.id === data.artistId);
    if (artist) {
      newTask.expectedDelivery = calculateTaskExpectedDelivery(newTask, artist, tasks);
    }

    setTasks(prev => [newTask, ...prev]);
    syncSaveDoc(COLLECTIONS.TASKS, newTask);
    syncSaveDoc(COLLECTIONS.PROJECTS, { ...project, taskCounter: nextCounter });

    logActivity('Created Task', 'Task', taskId, `Created task ${taskId}: "${newTask.title}" on project ${project.name}.`, newTask.title);

    if (artist) {
      addNotification(artist.userId, 'New Task Assigned', `You were assigned task ${taskId}: ${newTask.title}`, 'info', 'task', taskId);

      const artistUser = users.find(u => u.id === artist.userId || u.artistId === artist.id || u.email === artist.email);
      const artistEmail = artist.email || artistUser?.email;
      if (artistEmail) {
        sendTaskActivityNotificationMail({
          toEmail: artistEmail,
          toName: artist.name,
          actorName: currentUser.name,
          activityType: 'ASSIGNED',
          taskId: newTask.id,
          taskTitle: newTask.title,
          projectName: project.name,
          details: `Task created and assigned to you with estimate ${newTask.originalEstimate}h. Due date: ${newTask.dueDate}.`,
          priority: newTask.priority,
          dueDate: newTask.dueDate,
          status: newTask.status
        });
      }
    }

    return newTask;
  };

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    let affectedTask: Task | undefined;
    const oldTask = tasks.find(t => t.id === taskId);
    const oldArtist = oldTask?.artistId ? artists.find(a => a.id === oldTask.artistId) : null;
    const oldSprint = oldTask?.sprintId ? sprints.find(s => s.id === oldTask.sprintId) : null;

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const nextSprintId = updates.sprintId !== undefined ? (updates.sprintId || undefined) : t.sprintId;
        const nextArtistId = updates.artistId !== undefined ? (updates.artistId || undefined) : t.artistId;
        let nextStatus = updates.status !== undefined ? updates.status : t.status;

        // If assigned to a sprint and status was BACKLOG, move to SELECTED
        if (nextSprintId && nextStatus === 'BACKLOG') {
          nextStatus = 'SELECTED';
        }
        // If removed from sprint and status was SELECTED, move back to BACKLOG
        if (!nextSprintId && (nextStatus === 'SELECTED' || updates.sprintId === '' || updates.sprintId === null)) {
          nextStatus = 'BACKLOG';
        }

        const updated: Task = {
          ...t,
          ...updates,
          artistId: nextArtistId,
          sprintId: nextSprintId,
          status: nextStatus,
          updatedBy: currentUser.id
        };
        
        // Recalculate expected delivery if estimates or artist changes
        if (updates.remainingEstimate !== undefined || updates.originalEstimate !== undefined || updates.artistId !== undefined) {
          const artist = artists.find(a => a.id === updated.artistId);
          if (artist) {
            updated.expectedDelivery = calculateTaskExpectedDelivery(updated, artist, prev);
          }
        }
        affectedTask = updated;
        syncSaveDoc(COLLECTIONS.TASKS, updated);
        return updated;
      }
      return t;
    }));

    // If connected to a company request, update the linked request state & assignment & estimatedHours
    const linkedRequest = requests.find(r => r.taskId === taskId || (affectedTask?.requestId && r.id === affectedTask.requestId));
    if (linkedRequest) {
      const taskReqId = linkedRequest.id;
      const assignedArtId = affectedTask ? affectedTask.artistId : updates.artistId;
      const assignedSprintId = affectedTask ? affectedTask.sprintId : updates.sprintId;
      const expectedDel = affectedTask?.expectedDelivery;
      const estHours = affectedTask?.originalEstimate || updates.originalEstimate;

      setRequests(prev => prev.map(r => {
        if (r.id === taskReqId || r.taskId === taskId) {
          let updatedStatus = r.status;
          if (assignedArtId && (r.status === 'NEW' || r.status === 'QUEUED')) {
            updatedStatus = 'ASSIGNED';
          } else if (!assignedArtId && r.status === 'ASSIGNED') {
            updatedStatus = 'QUEUED';
          }

          const updatedReq = {
            ...r,
            taskId: taskId,
            assignedArtistId: assignedArtId,
            sprintId: assignedSprintId,
            status: updatedStatus,
            estimatedHours: estHours || r.estimatedHours,
            expectedDeliveryDate: expectedDel || r.expectedDeliveryDate
          };
          syncSaveDoc(COLLECTIONS.REQUESTS, updatedReq);
          return updatedReq;
        }
        return r;
      }));
    }

    // Detailed Activity Logging
    if (oldTask?.artistId && (updates.artistId === undefined || updates.artistId === '' || updates.artistId === null) && updates.artistId !== oldTask.artistId) {
      logActivity('Unassigned Task', 'Task', taskId, `${currentUser.name} unassigned task from ${oldArtist?.name || 'Artist'}.`, affectedTask?.title);
    } else if (updates.artistId && updates.artistId !== oldTask?.artistId) {
      const newArtist = artists.find(a => a.id === updates.artistId);
      logActivity('Assigned Task', 'Task', taskId, `${currentUser.name} assigned task ${taskId} to ${newArtist?.name || 'Artist'}.`, affectedTask?.title);
    }

    if (oldTask?.sprintId && (updates.sprintId === undefined || updates.sprintId === '' || updates.sprintId === null) && updates.sprintId !== oldTask.sprintId) {
      logActivity('Moved to Backlog', 'Task', taskId, `${currentUser.name} moved task ${taskId} to Backlog.`, affectedTask?.title);
    } else if (updates.sprintId && updates.sprintId !== oldTask?.sprintId) {
      const newSprint = sprints.find(s => s.id === updates.sprintId);
      logActivity('Moved Task to Sprint', 'Task', taskId, `${currentUser.name} assigned task ${taskId} to ${newSprint?.name || 'Sprint'}.`, affectedTask?.title);
    } else if (!updates.artistId && !updates.sprintId) {
      logActivity('Updated Task', 'Task', taskId, `Updated task ${taskId} details.`, affectedTask?.title);
    }

    // Notify assigned artist if task details/estimates changed by someone else
    if (affectedTask?.artistId) {
      const artist = artists.find(a => a.id === affectedTask.artistId);
      if (artist && artist.userId !== currentUser.id) {
        addNotification(
          artist.userId,
          'Task Details Updated',
          `${currentUser.name} updated task ${taskId}: ${affectedTask.title}`,
          'info',
          'task',
          taskId
        );
      }
    }
  };

  const unassignTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const prevArtist = artists.find(a => a.id === task.artistId);

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const updated: Task = {
          ...t,
          artistId: undefined,
          updatedBy: currentUser.id
        };
        syncSaveDoc(COLLECTIONS.TASKS, updated);
        return updated;
      }
      return t;
    }));

    const linkedReq = requests.find(r => r.taskId === taskId || (task.requestId && r.id === task.requestId));
    if (linkedReq) {
      setRequests(prev => prev.map(r => {
        if (r.id === linkedReq.id || r.taskId === taskId) {
          const updatedReq = {
            ...r,
            assignedArtistId: undefined,
            status: 'QUEUED' as RequestStatus
          };
          syncSaveDoc(COLLECTIONS.REQUESTS, updatedReq);
          return updatedReq;
        }
        return r;
      }));
    }

    const logMsg = `${currentUser.name} unassigned task from ${prevArtist?.name || 'Artist'}.`;
    logActivity('Unassigned Task', 'Task', taskId, logMsg, task.title);

    if (task.jiraIssueKey && settings.jiraConfig?.autoSyncOnStatusChange !== false) {
      syncTaskToJira(taskId, logMsg).catch(err => console.warn('Jira unassign sync warning:', err));
    }
  };

  const moveTaskToBacklog = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const prevSprint = sprints.find(s => s.id === task.sprintId);
    const nowFormatted = formatDateTime(new Date().toISOString());

    const historyComment: TaskComment = {
      id: `comment-backlog-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      userAvatar: currentUser.avatar,
      content: `Moved task from ${prevSprint ? prevSprint.name : 'Sprint'} to Backlog.`,
      createdAt: nowFormatted
    };

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const updated: Task = {
          ...t,
          sprintId: undefined,
          status: 'To Do',
          comments: [...(t.comments || []), historyComment],
          updatedBy: currentUser.id
        };
        syncSaveDoc(COLLECTIONS.TASKS, updated);
        return updated;
      }
      return t;
    }));

    if (task.requestId) {
      setRequests(prev => prev.map(r => {
        if (r.id === task.requestId) {
          const updatedReq = {
            ...r,
            sprintId: undefined
          };
          syncSaveDoc(COLLECTIONS.REQUESTS, updatedReq);
          return updatedReq;
        }
        return r;
      }));
    }

    const logMsg = `${currentUser.name} moved task ${taskId} (${task.title}) to Backlog.`;
    logActivity('Moved to Backlog', 'Task', taskId, logMsg, task.title);

    if (task.jiraIssueKey && settings.jiraConfig?.autoSyncOnStatusChange !== false) {
      syncTaskToJira(taskId, logMsg).catch(err => console.warn('Jira backlog move sync warning:', err));
    }
  };

  const updateTaskStatus = (taskId: string, newStatus: TaskStatus, blockerReason?: BlockerReason, blockerDetails?: string) => {
    let affectedTask: Task | undefined;
    const normalizedStatus = normalizeTaskStatus(newStatus);
    const nowFormatted = formatDateTime(new Date().toISOString());

    const historyComment: TaskComment = {
      id: `comment-status-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      userAvatar: currentUser.avatar,
      content: `Status changed to ${normalizedStatus}${blockerReason ? ` (Reason: ${blockerReason})` : ''}.`,
      createdAt: nowFormatted
    };

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const today = getTodayDateString();
        const isDone = isTaskDoneOrCompleted(normalizedStatus);

        const updated: Task = {
          ...t,
          status: normalizedStatus,
          blockerReason: normalizedStatus === 'On Hold' || (normalizedStatus as string) === 'BLOCKED' ? blockerReason : undefined,
          blockerDetails: normalizedStatus === 'On Hold' || (normalizedStatus as string) === 'BLOCKED' ? blockerDetails : undefined,
          actualDelivery: isDone ? (t.actualDelivery || today) : t.actualDelivery,
          remainingEstimate: isDone ? 0 : t.remainingEstimate,
          comments: [...(t.comments || []), historyComment],
          updatedBy: currentUser.id
        };
        affectedTask = updated;
        syncSaveDoc(COLLECTIONS.TASKS, updated);
        return updated;
      }
      return t;
    }));

    // If connected to a company request, update the request status automatically
    if (affectedTask?.requestId) {
      const reqStatusMap: Partial<Record<TaskStatus, RequestStatus>> = {
        BACKLOG: 'QUEUED',
        SELECTED: 'ASSIGNED',
        IN_PROGRESS: 'IN_PROGRESS',
        INTERNAL_REVIEW: 'IN_REVIEW',
        REQUESTER_REVIEW: 'IN_REVIEW',
        REVISION: 'REVISION',
        BLOCKED: 'IN_PROGRESS',
        DONE: 'DELIVERED'
      };
      const reqStatus = reqStatusMap[newStatus];
      if (reqStatus) {
        setRequests(prev => prev.map(r => {
          if (r.id === affectedTask?.requestId) {
            const updatedReq = {
              ...r,
              status: reqStatus,
              actualDeliveryDate: newStatus === 'DONE' ? getTodayDateString() : r.actualDeliveryDate
            };
            syncSaveDoc(COLLECTIONS.REQUESTS, updatedReq);
            return updatedReq;
          }
          return r;
        }));
      }
    }

    logActivity(
      'Changed Task Status',
      'Task',
      taskId,
      `${currentUser.name} changed ${taskId} status to ${newStatus}${newStatus === 'BLOCKED' ? ` (${blockerReason})` : ''}.`,
      affectedTask?.title
    );

    // If marked blocked, alert Art Manager
    if (newStatus === 'BLOCKED') {
      users.filter(u => u.role === 'ART_MANAGER' || u.role === 'ART_DIRECTOR' || u.role === 'ADMIN').forEach(mgr => {
        addNotification(
          mgr.id,
          'Task Blocked Alert',
          `${taskId} (${affectedTask?.title}) marked BLOCKED by ${currentUser.name}: ${blockerReason}`,
          'alert',
          'task',
          taskId
        );

        if (mgr.email) {
          sendTaskActivityNotificationMail({
            toEmail: mgr.email,
            toName: mgr.name,
            actorName: currentUser.name,
            activityType: 'BLOCKED_ALERT',
            taskId,
            taskTitle: affectedTask?.title || 'Blocked Task',
            projectName: projects.find(p => p.id === affectedTask?.projectId)?.name,
            details: `Task blocked by ${currentUser.name}.\nReason: ${blockerReason || 'Unspecified'}\nDetails: ${blockerDetails || 'No details provided.'}`,
            priority: affectedTask?.priority,
            status: 'BLOCKED'
          });
        }
      });
    }

    // If marked DONE, notify requester
    if (newStatus === 'DONE' && affectedTask?.requesterId) {
      addNotification(
        affectedTask.requesterId,
        'Art Delivered!',
        `Your task ${taskId} (${affectedTask.title}) has been completed and delivered.`,
        'success',
        'task',
        taskId
      );

      const requesterUser = users.find(u => u.id === affectedTask.requesterId);
      if (requesterUser?.email) {
        sendTaskActivityNotificationMail({
          toEmail: requesterUser.email,
          toName: requesterUser.name,
          actorName: currentUser.name,
          activityType: 'DELIVERED',
          taskId,
          taskTitle: affectedTask.title,
          projectName: projects.find(p => p.id === affectedTask.projectId)?.name,
          details: `Your art task ${taskId} has been completed and marked Delivered. You can now download and review the final production assets.`,
          priority: affectedTask.priority,
          status: 'DELIVERED'
        });
      }
    } else if (affectedTask?.requesterId && affectedTask.requesterId !== currentUser.id) {
      addNotification(
        affectedTask.requesterId,
        'Task Status Changed',
        `Task ${taskId} ("${affectedTask.title}") is now ${newStatus.replace('_', ' ')}.`,
        'info',
        'task',
        taskId
      );

      const requesterUser = users.find(u => u.id === affectedTask.requesterId);
      if (requesterUser?.email) {
        sendTaskActivityNotificationMail({
          toEmail: requesterUser.email,
          toName: requesterUser.name,
          actorName: currentUser.name,
          activityType: 'STATUS_CHANGED',
          taskId,
          taskTitle: affectedTask.title,
          projectName: projects.find(p => p.id === affectedTask.projectId)?.name,
          details: `Task status transitioned to ${newStatus.replace('_', ' ')}.`,
          priority: affectedTask.priority,
          status: newStatus
        });
      }
    }

    // If status changed by manager, notify artist
    if (affectedTask?.artistId) {
      const artist = artists.find(a => a.id === affectedTask.artistId);
      if (artist && artist.userId !== currentUser.id && newStatus !== 'DONE') {
        addNotification(
          artist.userId,
          'Task Status Updated',
          `${currentUser.name} moved ${taskId} to ${newStatus.replace('_', ' ')}.`,
          'info',
          'task',
          taskId
        );

        const artistUser = users.find(u => u.id === artist.userId || u.artistId === artist.id || u.email === artist.email);
        const artistEmail = artist.email || artistUser?.email;
        if (artistEmail) {
          sendTaskActivityNotificationMail({
            toEmail: artistEmail,
            toName: artist.name,
            actorName: currentUser.name,
            activityType: 'STATUS_CHANGED',
            taskId,
            taskTitle: affectedTask.title,
            projectName: projects.find(p => p.id === affectedTask.projectId)?.name,
            details: `Task was moved to ${newStatus.replace('_', ' ')} by ${currentUser.name}.`,
            priority: affectedTask.priority,
            status: newStatus
          });
        }
      }
    }

    // Auto-sync to Jira if this task is linked to Jira (by jiraIssueKey)
    if (affectedTask?.jiraIssueKey && settings.jiraConfig?.autoSyncOnStatusChange !== false) {
      const assignedArtist = affectedTask.artistId ? artists.find(a => a.id === affectedTask.artistId) : null;
      const artistName = assignedArtist?.name || currentUser.name || 'Studio Member';
      const statusMap: Record<string, string> = {
        'To Do': 'To Do',
        'In Progress': 'In Progress',
        'On Hold': 'On Hold',
        'Re-opened': 'Re-opened',
        'Submit for Review': 'Submit for Review',
        'In Iteration': 'In Iteration',
        'Completed': 'Completed',
        'Cancelled': 'Cancelled',
        BACKLOG: 'To Do',
        SELECTED: 'To Do',
        IN_PROGRESS: 'In Progress',
        INTERNAL_REVIEW: 'Submit for Review',
        REQUESTER_REVIEW: 'Submit for Review',
        REVISION: 'Re-opened',
        BLOCKED: 'On Hold',
        DONE: 'Completed'
      };
      const targetJiraStatus = statusMap[newStatus] || 'In Progress';
      syncTaskToJira(
        taskId,
        `${artistName} updated task status to "${newStatus.replace('_', ' ')}" in RG ArtFlow Studio.`,
        undefined,
        { syncStatus: true, customStatus: targetJiraStatus }
      ).catch(err => {
        console.warn('Background Jira sync warning:', err);
      });
    }
  };

  const deleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    syncDeleteDoc(COLLECTIONS.TASKS, taskId);
    logActivity('Deleted Task', 'Task', taskId, `Deleted task ${taskId}.`);
  };

  // Time Tracking Engine
  const logTaskTime = (
    taskId: string,
    hours: number,
    description: string,
    date?: string,
    explicitRemainingHours?: number
  ) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const artist = (task.artistId ? artists.find(a => a.id === task.artistId) : null)
      || (currentUser?.artistId ? artists.find(a => a.id === currentUser.artistId) : null)
      || artists.find(a => currentUser?.id && a.userId === currentUser.id)
      || artists[0]
      || null;

    const logDate = date || getTodayDateString();
    const effectiveArtistId = artist?.id || task.artistId || currentUser?.artistId || currentUser?.id || 'artist-general';
    const effectiveArtistName = artist?.name || currentUser?.name || 'Studio Member';

    const newTimeEntry: TimeEntry = {
      id: `time-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      taskId,
      taskTitle: task.title,
      projectId: task.projectId,
      artistId: effectiveArtistId,
      artistName: effectiveArtistName,
      date: logDate,
      hours,
      durationFormatted: formatDuration(hours),
      description: description || `Work logged (+${formatDuration(hours)})`,
      createdAt: formatDateTime(new Date().toISOString())
    };

    setTimeEntries(prev => [newTimeEntry, ...prev]);
    syncSaveDoc(COLLECTIONS.TIME_ENTRIES, newTimeEntry);

    // Recalculate remaining estimate or set explicit remaining hours
    let finalRemainingHours = 0;
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const newLogged = (t.timeLogged || 0) + hours;
        const calcRemaining = Math.max(0, Math.round(((t.remainingEstimate ?? t.originalEstimate) - hours) * 10) / 10);
        finalRemainingHours = explicitRemainingHours !== undefined ? Math.max(0, explicitRemainingHours) : calcRemaining;
        const updated: Task = {
          ...t,
          timeLogged: newLogged,
          remainingEstimate: finalRemainingHours,
          updatedBy: currentUser?.id || 'system'
        };
        // Re-forecast delivery
        if (artist) {
          updated.expectedDelivery = calculateTaskExpectedDelivery(updated, artist, prev);
        }
        syncSaveDoc(COLLECTIONS.TASKS, updated);
        return updated;
      }
      return t;
    }));

    logActivity(
      'Logged Time',
      'Time',
      taskId,
      `${currentUser?.name || 'User'} logged ${formatDuration(hours)} (${hours}h) on ${taskId}. Remaining estimate: ${formatDuration(finalRemainingHours)}.`,
      task.title
    );

    // Auto-sync work log and remaining estimate to Jira if task is linked to Jira
    if (task.jiraIssueKey && settings.jiraConfig?.autoSyncWorklogs !== false) {
      syncTaskToJira(
        taskId,
        `${effectiveArtistName} logged ${formatDuration(hours)} (${hours}h): "${description || 'Daily progress log'}"`,
        hours,
        {
          syncStatus: false,
          remainingEstimateHours: finalRemainingHours,
          worklogDescription: description || `Work logged by ${effectiveArtistName}`,
          worklogDate: logDate
        }
      ).catch(err => {
        console.warn('Background Jira work log sync warning:', err);
      });
    }
  };

  // Revision Request
  const requestTaskRevision = (taskId: string, comment: string, additionalHours: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newRevision: RevisionRecord = {
      id: `rev-${Date.now()}`,
      revisionNumber: (task.revisionCount || 0) + 1,
      requestedBy: currentUser.id,
      requestedByName: currentUser.name,
      date: getTodayDateString(),
      comment,
      additionalHours
    };

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const newRemaining = (t.remainingEstimate || 0) + additionalHours;
        const artist = artists.find(a => a.id === t.artistId);
        const updated: Task = {
          ...t,
          status: 'REVISION',
          revisionCount: (t.revisionCount || 0) + 1,
          revisions: [...(t.revisions || []), newRevision],
          remainingEstimate: newRemaining,
          updatedBy: currentUser.id
        };
        if (artist) {
          updated.expectedDelivery = calculateTaskExpectedDelivery(updated, artist, prev);
        }
        syncSaveDoc(COLLECTIONS.TASKS, updated);
        return updated;
      }
      return t;
    }));

    // If linked request, update request
    if (task.requestId) {
      setRequests(prev => prev.map(r => {
        if (r.id === task.requestId) {
          const updated = {
            ...r,
            status: 'REVISION' as RequestStatus,
            revisions: [...(r.revisions || []), newRevision]
          };
          syncSaveDoc(COLLECTIONS.REQUESTS, updated);
          return updated;
        }
        return r;
      }));
    }

    logActivity(
      'Requested Revision',
      'Task',
      taskId,
      `${currentUser.name} requested Revision #${newRevision.revisionNumber} on ${taskId} (+${additionalHours}h). Comment: "${comment}"`,
      task.title
    );

    // Notify artist
    if (task.artistId) {
      const artist = artists.find(a => a.id === task.artistId);
      if (artist) {
        addNotification(
          artist.userId,
          'Revision Requested',
          `Revision requested on ${taskId}: ${comment} (+${additionalHours}h)`,
          'warning',
          'task',
          taskId
        );

        const artistUser = users.find(u => u.id === artist.userId || u.artistId === artist.id || u.email === artist.email);
        const artistEmail = artist.email || artistUser?.email;
        if (artistEmail) {
          sendTaskActivityNotificationMail({
            toEmail: artistEmail,
            toName: artist.name,
            actorName: currentUser.name,
            activityType: 'REVISION_REQUESTED',
            taskId,
            taskTitle: task.title,
            projectName: projects.find(p => p.id === task.projectId)?.name,
            details: `Revision #${newRevision.revisionNumber} requested by ${currentUser.name}.\nFeedback: "${comment}"\nAdditional hours allocated: +${additionalHours}h`,
            priority: task.priority,
            status: 'REVISION'
          });
        }
      }
    }

    // Auto-sync Change / Revision Request to Jira if ticket is linked to Jira
    if (task.isJiraImported && task.jiraIssueKey) {
      syncTaskToJira(
        taskId,
        `[RG ArtFlow Studio - Revision / Change Request #${newRevision.revisionNumber}] Requested by ${currentUser.name}:\n"${comment}"\n(+${additionalHours}h added to remaining estimate).`
      ).catch(err => {
        console.warn('Background Jira revision sync warning:', err);
      });
    }
  };

  // Subtasks
  const addSubtask = (taskId: string, title: string, estimatedHours?: number) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const sub = {
          id: `sub-${Date.now()}-${Math.random()}`,
          title,
          completed: false,
          estimatedHours: estimatedHours || 2
        };
        const updated = {
          ...t,
          subtasks: [...(t.subtasks || []), sub],
          updatedBy: currentUser.id
        };
        syncSaveDoc(COLLECTIONS.TASKS, updated);
        return updated;
      }
      return t;
    }));
  };

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const updatedSubs = (t.subtasks || []).map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s);
        const updated = { ...t, subtasks: updatedSubs, updatedBy: currentUser.id };
        syncSaveDoc(COLLECTIONS.TASKS, updated);
        return updated;
      }
      return t;
    }));
  };

  const deleteSubtask = (taskId: string, subtaskId: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const updated = {
          ...t,
          subtasks: (t.subtasks || []).filter(s => s.id !== subtaskId),
          updatedBy: currentUser.id
        };
        syncSaveDoc(COLLECTIONS.TASKS, updated);
        return updated;
      }
      return t;
    }));
  };

  // Comments & Attachments
  const addTaskComment = (
    taskId: string,
    content: string,
    parentCommentId?: string,
    options?: {
      textColor?: string;
      attachments?: TaskAttachment[];
      formatStyles?: {
        bold?: boolean;
        italic?: boolean;
        underline?: boolean;
        code?: boolean;
        blockquote?: boolean;
      } | string[];
    }
  ) => {
    const task = tasks.find(t => t.id === taskId);
    const project = task ? projects.find(p => p.id === task.projectId) : undefined;
    const nowFormatted = formatDateTime(new Date().toISOString());

    // Prepare normalized attachments
    const preparedAttachments: TaskAttachment[] = (options?.attachments || []).map(att => ({
      ...att,
      id: att.id || `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      taskId: taskId,
      taskTitle: task?.title || '',
      projectId: task?.projectId || '',
      projectName: project?.name || '',
      uploadedBy: att.uploadedBy || currentUser.id,
      uploadedByName: att.uploadedByName || currentUser.name,
      uploadedAt: att.uploadedAt || nowFormatted
    }));

    const comment: TaskComment = {
      id: `com-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      userAvatar: currentUser.avatar,
      content,
      createdAt: nowFormatted,
      parentCommentId,
      textColor: options?.textColor,
      attachments: preparedAttachments.length > 0 ? preparedAttachments : undefined,
      formatStyles: options?.formatStyles
    };

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        // Also sync attachments to task.attachments for quick project/task indexing
        const existingAttachments = t.attachments || [];
        const newAttachmentsToAdd = preparedAttachments.filter(
          pa => !existingAttachments.some(ea => ea.url === pa.url || ea.id === pa.id)
        );

        const updated = {
          ...t,
          comments: [...(t.comments || []), comment],
          attachments: [...existingAttachments, ...newAttachmentsToAdd],
          updatedBy: currentUser.id
        };
        syncSaveDoc(COLLECTIONS.TASKS, updated);
        return updated;
      }
      return t;
    }));

    logActivity('Added Comment', 'Task', taskId, `${currentUser.name} commented on ${taskId}.`, task?.title);

    // Auto-push comment to Jira if task is linked to Jira ticket
    if (task?.jiraIssueKey) {
      postTaskCommentToJira(taskId, content).catch(err => {
        console.warn('Auto Jira comment sync note:', err);
      });
    }

    // Notify assigned artist if someone else commented
    if (task?.artistId) {
      const artist = artists.find(a => a.id === task.artistId);
      if (artist && artist.userId !== currentUser.id) {
        addNotification(
          artist.userId,
          'New Comment on Task',
          `${currentUser.name} commented on ${taskId}: "${content.substring(0, 60)}${content.length > 60 ? '...' : ''}"`,
          'info',
          'task',
          taskId
        );

        const artistUser = users.find(u => u.id === artist.userId || u.artistId === artist.id || u.email === artist.email);
        const artistEmail = artist.email || artistUser?.email;
        if (artistEmail) {
          sendTaskActivityNotificationMail({
            toEmail: artistEmail,
            toName: artist.name,
            actorName: currentUser.name,
            activityType: 'COMMENT_ADDED',
            taskId,
            taskTitle: task.title,
            projectName: project?.name,
            details: `${currentUser.name} commented:\n"${content}"`,
            priority: task.priority,
            status: task.status
          });
        }
      }
    }

    // Notify requester if someone else commented
    if (task?.requesterId && task.requesterId !== currentUser.id) {
      addNotification(
        task.requesterId,
        'New Comment on Task',
        `${currentUser.name} commented on ${taskId}: "${content.substring(0, 60)}${content.length > 60 ? '...' : ''}"`,
        'info',
        'task',
        taskId
      );
    }
  };

  const addTaskAttachment = (
    taskId: string,
    attachment: Omit<TaskAttachment, 'id' | 'uploadedBy' | 'uploadedByName' | 'uploadedAt'> & { id?: string }
  ) => {
    const task = tasks.find(t => t.id === taskId);
    const project = task ? projects.find(p => p.id === task.projectId) : undefined;
    const nowFormatted = formatDateTime(new Date().toISOString());

    const newAttachment: TaskAttachment = {
      ...attachment,
      id: attachment.id || `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      taskId: taskId,
      taskTitle: task?.title || '',
      projectId: task?.projectId || '',
      projectName: project?.name || '',
      uploadedBy: currentUser.id,
      uploadedByName: currentUser.name,
      uploadedAt: nowFormatted
    };

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const updated = {
          ...t,
          attachments: [...(t.attachments || []), newAttachment],
          updatedBy: currentUser.id
        };
        syncSaveDoc(COLLECTIONS.TASKS, updated);
        return updated;
      }
      return t;
    }));

    logActivity('Added Attachment', 'Task', taskId, `${currentUser.name} attached "${newAttachment.name}" to ${taskId}.`, task?.title);

    // Auto-post image attachment to Jira ticket if linked
    if (task?.jiraIssueKey && settings.jiraConfig?.autoPostImagesToJira !== false) {
      setTimeout(() => {
        postTaskAttachmentToJira(taskId, newAttachment).catch(err => {
          console.warn('Auto Jira attachment upload error:', err);
        });
      }, 150);
    }
  };

  const removeTaskAttachment = (taskId: string, attachmentId: string) => {
    const task = tasks.find(t => t.id === taskId);
    let removedName = 'media asset';

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const targetAtt = (t.attachments || []).find(a => a.id === attachmentId);
        if (targetAtt) removedName = targetAtt.name;

        const updatedAttachments = (t.attachments || []).filter(a => a.id !== attachmentId);
        const updatedComments = (t.comments || []).map(c => {
          if (c.attachments && c.attachments.some(a => a.id === attachmentId)) {
            return {
              ...c,
              attachments: c.attachments.filter(a => a.id !== attachmentId)
            };
          }
          return c;
        });

        const updated = {
          ...t,
          attachments: updatedAttachments,
          comments: updatedComments,
          updatedBy: currentUser.id
        };
        syncSaveDoc(COLLECTIONS.TASKS, updated);
        return updated;
      }
      return t;
    }));

    logActivity('Removed Attachment', 'Task', taskId, `${currentUser.name} removed attachment "${removedName}" from ${taskId}.`, task?.title);
  };

  const addRequestComment = (requestId: string, content: string, parentCommentId?: string) => {
    const comment = {
      id: `com-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      userAvatar: currentUser.avatar,
      content,
      createdAt: formatDateTime(new Date().toISOString()),
      parentCommentId
    };

    setRequests(prev => prev.map(r => {
      if (r.id === requestId) {
        const updated = {
          ...r,
          comments: [...(r.comments || []), comment]
        };
        syncSaveDoc(COLLECTIONS.REQUESTS, updated);
        return updated;
      }
      return r;
    }));

    const request = requests.find(r => r.id === requestId);
    logActivity('Added Comment', 'Request', requestId, `${currentUser.name} commented on request ${requestId}.`, request?.taskTitle);

    // Notify requester if someone else commented
    if (request?.requesterId && request.requesterId !== currentUser.id) {
      addNotification(
        request.requesterId,
        'New Comment on Company Request',
        `${currentUser.name} replied on ${requestId}: "${content.substring(0, 60)}${content.length > 60 ? '...' : ''}"`,
        'info',
        'request',
        requestId
      );
    }

    // If assigned to an artist, notify artist
    if (request?.assignedArtistId) {
      const artist = artists.find(a => a.id === request.assignedArtistId);
      if (artist && artist.userId !== currentUser.id) {
        addNotification(
          artist.userId,
          'New Comment on Assigned Request',
          `${currentUser.name} commented on ${requestId}: "${content.substring(0, 60)}${content.length > 60 ? '...' : ''}"`,
          'info',
          'request',
          requestId
        );
      }
    }
  };

  // Missing Task (Artist creation)
  const submitMissingTask = (data: Partial<Task> & { projectId: string; title: string; reason: string }): Task => {
    const project = projects.find(p => p.id === data.projectId);
    if (!project) throw new Error(`Project ${data.projectId} not found.`);

    const nextCounter = (project.taskCounter || 0) + 1;
    const paddedCounter = String(nextCounter).padStart(4, '0');
    const taskId = `${project.key}-${paddedCounter}`;

    setProjects(prev => prev.map(p => p.id === data.projectId ? { ...p, taskCounter: nextCounter } : p));

    const today = getTodayDateString();
    const newTask: Task = {
      id: taskId,
      projectId: data.projectId,
      sprintId: data.sprintId,
      taskType: data.taskType || 'Missing Production Task',
      title: data.title,
      description: data.description || '',
      requesterId: currentUser.id,
      artistId: data.artistId || currentUser.artistId,
      artManagerId: project.artManagerId,
      priority: data.priority || 'Medium',
      storyPoints: data.storyPoints || 3,
      originalEstimate: data.originalEstimate || 8,
      remainingEstimate: data.originalEstimate || 8,
      timeLogged: 0,
      status: 'BACKLOG',
      createdDate: today,
      dueDate: data.dueDate || today,
      expectedDelivery: today,
      subtasks: [],
      dependencies: [],
      tags: ['Missing Task', 'Needs Approval'],
      revisionCount: 0,
      revisions: [],
      attachments: [],
      comments: [],
      isMissingTask: true,
      missingTaskStatus: 'PENDING_APPROVAL',
      missingTaskReason: data.reason,
      createdBy: currentUser.id,
      updatedBy: currentUser.id
    };

    setTasks(prev => [newTask, ...prev]);
    syncSaveDoc(COLLECTIONS.TASKS, newTask);
    syncSaveDoc(COLLECTIONS.PROJECTS, { ...project, taskCounter: nextCounter });

    logActivity(
      'Submitted Missing Task',
      'Task',
      taskId,
      `${currentUser.name} submitted missing task ${taskId} (Needs Approval): "${newTask.title}". Reason: ${data.reason}`,
      newTask.title
    );

    // Notify Art Manager
    users.filter(u => u.role === 'ART_MANAGER' || u.role === 'ART_DIRECTOR').forEach(mgr => {
      addNotification(
        mgr.id,
        'Missing Task Needs Approval',
        `${currentUser.name} created missing task ${taskId}: ${newTask.title}`,
        'warning',
        'task',
        taskId
      );
    });

    return newTask;
  };

  const approveMissingTask = (taskId: string, approve: boolean, sprintId?: string, artistId?: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const updated: Task = {
          ...t,
          missingTaskStatus: approve ? 'APPROVED' : 'REJECTED',
          status: approve ? (sprintId ? 'SELECTED' : 'BACKLOG') : 'BACKLOG',
          sprintId: approve ? (sprintId || t.sprintId) : undefined,
          artistId: approve ? (artistId || t.artistId) : t.artistId,
          tags: t.tags.filter(tag => tag !== 'Needs Approval'),
          updatedBy: currentUser.id
        };
        syncSaveDoc(COLLECTIONS.TASKS, updated);
        return updated;
      }
      return t;
    }));

    const task = tasks.find(t => t.id === taskId);
    logActivity(
      approve ? 'Approved Missing Task' : 'Rejected Missing Task',
      'Task',
      taskId,
      `${currentUser.name} ${approve ? 'approved' : 'rejected'} missing task ${taskId}.`,
      task?.title
    );

    if (task?.requesterId && task.requesterId !== currentUser.id) {
      addNotification(
        task.requesterId,
        approve ? 'Missing Task Approved' : 'Missing Task Rejected',
        `Your missing task submission ${taskId} ("${task.title}") was ${approve ? 'approved and scheduled' : 'rejected'}.`,
        approve ? 'success' : 'warning',
        'task',
        taskId
      );
    }
  };

  // Bulk Task operations
  const bulkUpdateTasks = (taskIds: string[], updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => {
      if (taskIds.includes(t.id)) {
        const updated = { ...t, ...updates, updatedBy: currentUser.id };
        syncSaveDoc(COLLECTIONS.TASKS, updated);
        return updated;
      }
      return t;
    }));
    logActivity('Bulk Updated Tasks', 'Task', taskIds.join(', '), `Bulk updated ${taskIds.length} tasks.`);
  };

  // Sprints
  const createSprint = (data: Omit<Sprint, 'id'>): Sprint => {
    const newId = `sprint-${Date.now()}`;
    const newSprint: Sprint = {
      ...data,
      id: newId
    };
    setSprints(prev => [...prev, newSprint]);
    syncSaveDoc(COLLECTIONS.SPRINTS, newSprint);
    logActivity('Created Sprint', 'Sprint', newId, `Created ${data.name}.`);
    return newSprint;
  };

  const updateSprint = (sprintId: string, updates: Partial<Sprint>) => {
    setSprints(prev => prev.map(s => {
      if (s.id === sprintId) {
        const updated = { ...s, ...updates };
        syncSaveDoc(COLLECTIONS.SPRINTS, updated);
        return updated;
      }
      return s;
    }));
    logActivity('Updated Sprint', 'Sprint', sprintId, `Updated sprint ${sprintId}.`);
  };

  const canManageSprints = Boolean(
    (previewRole || currentUser.role) === 'ADMIN' ||
    (previewRole || currentUser.role) === 'ART_DIRECTOR' ||
    (previewRole || currentUser.role) === 'ART_MANAGER' ||
    (!previewRole && (currentUser as any)?.fieldPermissions?.canManageSprints)
  );

  const completeSprint = (sprintId: string): {
    success: boolean;
    message: string;
    carriedForwardCount: number;
    completedCount: number;
    nextSprintId?: string;
    nextSprintName?: string;
  } => {
    if (!canManageSprints) {
      return {
        success: false,
        message: 'Permission denied: Only Admins or Sprint Managers can complete a sprint.',
        carriedForwardCount: 0,
        completedCount: 0
      };
    }

    const currentSprint = sprints.find(s => s.id === sprintId);
    if (!currentSprint) {
      return {
        success: false,
        message: 'Sprint not found.',
        carriedForwardCount: 0,
        completedCount: 0
      };
    }

    // Determine next sprint
    const nextSprintNumber = (currentSprint.sprintNumber || 2) + 1;
    let nextSprint = sprints.find(s => s.sprintNumber === nextSprintNumber);
    let nextSprintCreated = false;

    if (!nextSprint) {
      const scheduled = computeScheduledSprint(nextSprintNumber);
      nextSprint = {
        id: `sprint-${nextSprintNumber}`,
        sprintNumber: nextSprintNumber,
        name: scheduled.name,
        startDate: scheduled.startDate,
        endDate: scheduled.endDate,
        goal: `Weekly art production sprint ${nextSprintNumber} for liveops and store deliverables.`,
        status: 'Active',
        capacityHoursTotal: 680,
        committedHoursTotal: 0
      };
      nextSprintCreated = true;
    }

    const targetNextSprint = nextSprint;

    // Helper to identify finished vs unfinished tasks
    const isFinished = (status: string) => {
      const norm = (status || '').toUpperCase().replace(/[\s_-]+/g, '');
      return norm === 'COMPLETED' || norm === 'DONE' || norm === 'RESOLVED' || norm === 'CLOSED';
    };

    // Find all tasks in the current sprint
    const sprintTasks = tasks.filter(t => t.sprintId === sprintId);
    const completedTasks = sprintTasks.filter(t => isFinished(t.status));
    const incompleteTasks = sprintTasks.filter(t => !isFinished(t.status));

    const nowIso = new Date().toISOString();

    // 1. Move incomplete tasks to next sprint with full history preserved
    setTasks(prev => prev.map(t => {
      if (t.sprintId === sprintId && !isFinished(t.status)) {
        const existingHistory = Array.isArray(t.sprintHistory) && t.sprintHistory.length > 0
          ? [...t.sprintHistory]
          : [sprintId];
        if (!existingHistory.includes(sprintId)) existingHistory.push(sprintId);
        if (!existingHistory.includes(targetNextSprint.id)) existingHistory.push(targetNextSprint.id);

        const carryForwardComment: TaskComment = {
          id: `comment-cf-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          userId: 'system',
          userName: 'Sprint Engine',
          userRole: 'ADMIN',
          userAvatar: '',
          content: `Task carried forward from ${currentSprint.name} → ${targetNextSprint.name} because it was incomplete when ${currentSprint.name} was completed. Marked as moved.`,
          createdAt: nowIso
        };

        const existingMovements = Array.isArray(t.sprintMovements) ? [...t.sprintMovements] : [];
        existingMovements.push({
          fromSprintId: sprintId,
          fromSprintName: currentSprint.name,
          toSprintId: targetNextSprint.id,
          toSprintName: targetNextSprint.name,
          movedAt: nowIso,
          reason: 'Task carried forward from completed sprint'
        });

        const existingTags = Array.isArray(t.tags) ? [...t.tags] : [];
        if (!existingTags.includes('Moved')) existingTags.push('Moved');
        if (!existingTags.includes('Carried Forward')) existingTags.push('Carried Forward');

        const updated: Task = {
          ...t,
          sprintId: targetNextSprint.id,
          sprintHistory: existingHistory,
          sprintMovements: existingMovements,
          isMoved: true,
          movedFromSprintId: sprintId,
          movedFromSprintName: currentSprint.name,
          tags: existingTags,
          comments: [...(t.comments || []), carryForwardComment],
          updatedBy: currentUser.id
        };
        syncSaveDoc(COLLECTIONS.TASKS, updated);
        return updated;
      }
      return t;
    }));

    // 2. Mark current sprint Completed, activate next sprint, enforce 1 active sprint rule
    setSprints(prev => {
      let list = prev.map(s => {
        if (s.id === sprintId) {
          const updated: Sprint = { ...s, status: 'Completed' };
          syncSaveDoc(COLLECTIONS.SPRINTS, updated);
          return updated;
        }
        if (s.id === targetNextSprint.id) {
          const updated: Sprint = { ...s, status: 'Active' };
          syncSaveDoc(COLLECTIONS.SPRINTS, updated);
          return updated;
        }
        // If any other sprint was active, set it to Planning
        if (s.status === 'Active' && s.id !== sprintId && s.id !== targetNextSprint.id) {
          const updated: Sprint = { ...s, status: 'Planning' };
          syncSaveDoc(COLLECTIONS.SPRINTS, updated);
          return updated;
        }
        return s;
      });

      if (nextSprintCreated && !list.some(s => s.id === targetNextSprint.id)) {
        const activeNext: Sprint = { ...targetNextSprint, status: 'Active' };
        syncSaveDoc(COLLECTIONS.SPRINTS, activeNext);
        list.push(activeNext);
      }

      list.sort((a, b) => (a.sprintNumber || 0) - (b.sprintNumber || 0));
      return list;
    });

    logActivity(
      'Completed Sprint',
      'Sprint',
      sprintId,
      `Completed ${currentSprint.name}. ${completedTasks.length} tasks completed, ${incompleteTasks.length} incomplete tasks carried forward to ${targetNextSprint.name}.`
    );

    return {
      success: true,
      message: `${currentSprint.name} completed successfully. ${incompleteTasks.length} incomplete tasks moved to ${targetNextSprint.name}.`,
      carriedForwardCount: incompleteTasks.length,
      completedCount: completedTasks.length,
      nextSprintId: targetNextSprint.id,
      nextSprintName: targetNextSprint.name
    };
  };

  /**
   * Identifies all pending (incomplete) tasks remaining in completed sprints,
   * moves them to the active sprint, and marks them as moved.
   */
  const moveCompletedSprintPendingTasksToActiveSprint = async (): Promise<{
    success: boolean;
    message: string;
    movedCount: number;
    taskIds: string[];
  }> => {
    const isFinished = (status?: string) => {
      const norm = (status || '').toUpperCase().replace(/[\s_-]+/g, '');
      return norm === 'COMPLETED' || norm === 'DONE' || norm === 'RESOLVED' || norm === 'CLOSED';
    };

    const activeSprint = sprints.find(s => (s.status || '').toUpperCase() === 'ACTIVE') || sprints.find(s => s.sprintNumber === 3) || sprints[0];
    if (!activeSprint) {
      return {
        success: false,
        message: 'No active sprint found to receive pending tasks.',
        movedCount: 0,
        taskIds: []
      };
    }

    const completedSprints = sprints.filter(s => (s.status || '').toUpperCase() === 'COMPLETED');
    const completedSprintIds = new Set(completedSprints.map(s => s.id));
    if (completedSprints.some(s => s.sprintNumber === 1 || s.id === 'sprint-1')) {
      completedSprintIds.add('sprint-1');
      completedSprintIds.add('sprint-1787649228112');
      completedSprintIds.add('sprint-1787657577868');
    }
    if (completedSprints.some(s => s.sprintNumber === 2 || s.id === 'sprint-2')) {
      completedSprintIds.add('sprint-2');
      completedSprintIds.add('sprint-1787914899578');
    }

    const pendingTasks = tasks.filter(t => t.sprintId && completedSprintIds.has(t.sprintId) && !isFinished(t.status));
    if (pendingTasks.length === 0) {
      return {
        success: true,
        message: 'No pending tasks found in completed sprints. All completed sprint tasks are done.',
        movedCount: 0,
        taskIds: []
      };
    }

    const nowIso = new Date().toISOString();
    const movedIds: string[] = [];

    setTasks(prev => prev.map(t => {
      if (t.sprintId && completedSprintIds.has(t.sprintId) && !isFinished(t.status)) {
        movedIds.push(t.id);
        const originSprint = sprints.find(s => s.id === t.sprintId);
        const originName = originSprint ? originSprint.name : (t.sprintId.includes('1') ? 'Sprint 1 (24 Aug – 28 Aug)' : 'Sprint 2 (31 Aug – 4 Sept)');
        const originCanonicalId = originSprint?.sprintNumber === 1 || t.sprintId.includes('1') ? 'sprint-1' : 'sprint-2';

        const existingHistory = Array.isArray(t.sprintHistory) && t.sprintHistory.length > 0 ? [...t.sprintHistory] : [];
        if (!existingHistory.includes(originCanonicalId)) existingHistory.unshift(originCanonicalId);
        if (!existingHistory.includes(activeSprint.id)) existingHistory.push(activeSprint.id);

        const existingMovements = Array.isArray(t.sprintMovements) ? [...t.sprintMovements] : [];
        existingMovements.push({
          fromSprintId: originCanonicalId,
          fromSprintName: originName,
          toSprintId: activeSprint.id,
          toSprintName: activeSprint.name,
          movedAt: nowIso,
          reason: 'Moved pending task from completed sprint to active sprint'
        });

        const existingTags = Array.isArray(t.tags) ? [...t.tags] : [];
        if (!existingTags.includes('Moved')) existingTags.push('Moved');
        if (!existingTags.includes('Carried Forward')) existingTags.push('Carried Forward');

        const moveComment: TaskComment = {
          id: `comment-move-${Date.now()}-${t.id}`,
          userId: currentUser?.id || 'system',
          userName: currentUser?.name || 'Sprint Engine',
          userRole: currentUser?.role || 'ADMIN',
          userAvatar: currentUser?.avatar || '',
          content: `Task moved from completed sprint (${originName}) to active sprint (${activeSprint.name}) as a carried-forward pending deliverable. Marked as moved.`,
          createdAt: nowIso
        };

        const updated: Task = {
          ...t,
          sprintId: activeSprint.id,
          sprintHistory: existingHistory,
          sprintMovements: existingMovements,
          isMoved: true,
          movedFromSprintId: originCanonicalId,
          movedFromSprintName: originName,
          tags: existingTags,
          comments: [...(t.comments || []), moveComment],
          updatedBy: currentUser?.id || 'system'
        };

        syncSaveDoc(COLLECTIONS.TASKS, updated);
        return updated;
      }
      return t;
    }));

    logActivity(
      'Moved Completed Sprint Tasks',
      'Sprint',
      activeSprint.id,
      `Moved ${movedIds.length} pending tasks from completed sprints to ${activeSprint.name}. Marked as moved.`
    );

    return {
      success: true,
      message: `Successfully moved ${movedIds.length} pending tasks to ${activeSprint.name} and marked them as moved.`,
      movedCount: movedIds.length,
      taskIds: movedIds
    };
  };

  const updateSprintStatus = (sprintId: string, status: SprintStatus): { success: boolean; message?: string } => {
    if (!canManageSprints) {
      return { success: false, message: 'Permission denied: Only Admins or Sprint Managers can change sprint status.' };
    }

    const currentSprint = sprints.find(s => s.id === sprintId);
    if (!currentSprint) return { success: false, message: 'Sprint not found.' };

    if (status === 'Completed') {
      const res = completeSprint(sprintId);
      return { success: res.success, message: res.message };
    }

    if (status === 'Active') {
      // Check if another sprint is currently active
      const currentlyActive = sprints.find(s => s.status === 'Active' && s.id !== sprintId);
      if (currentlyActive) {
        return {
          success: false,
          message: `${currentlyActive.name} is currently Active. Please complete ${currentlyActive.name} before starting ${currentSprint.name}.`
        };
      }
    }

    updateSprint(sprintId, { status });
    return { success: true };
  };

  const moveTaskToSprint = (taskId: string, sprintId: string | undefined) => {
    const targetSprintId = sprintId && sprintId.trim() && sprintId !== 'none' && sprintId !== 'null' ? sprintId.trim() : undefined;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const prevSprint = sprints.find(s => s.id === task.sprintId);
    const targetSprint = targetSprintId ? sprints.find(s => s.id === targetSprintId) : null;
    const nowFormatted = formatDateTime(new Date().toISOString());

    if (!targetSprintId) {
      moveTaskToBacklog(taskId);
      return;
    }

    const prevName = prevSprint ? prevSprint.name : 'Backlog';
    const nextName = targetSprint ? targetSprint.name : `Sprint ${targetSprintId}`;

    const historyComment: TaskComment = {
      id: `comment-sprint-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      userAvatar: currentUser.avatar,
      content: `Moved from ${prevName} → ${nextName}.`,
      createdAt: nowFormatted
    };

    const existingHistory = Array.isArray(task.sprintHistory) ? [...task.sprintHistory] : [];
    if (task.sprintId && !existingHistory.includes(task.sprintId)) {
      existingHistory.push(task.sprintId);
    }
    if (!existingHistory.includes(targetSprintId)) {
      existingHistory.push(targetSprintId);
    }

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        const updated: Task = {
          ...t,
          sprintId: targetSprintId,
          sprintHistory: existingHistory,
          status: isTaskDoneOrCompleted(t.status) ? t.status : (t.status === 'BACKLOG' ? 'To Do' : t.status),
          comments: [...(t.comments || []), historyComment],
          updatedBy: currentUser.id
        };
        syncSaveDoc(COLLECTIONS.TASKS, updated);
        return updated;
      }
      return t;
    }));

    if (task.requestId) {
      setRequests(prev => prev.map(r => {
        if (r.id === task.requestId) {
          const updatedReq = {
            ...r,
            sprintId: targetSprintId
          };
          syncSaveDoc(COLLECTIONS.REQUESTS, updatedReq);
          return updatedReq;
        }
        return r;
      }));
    }

    logActivity('Moved Task to Sprint', 'Task', taskId, `Moved ${taskId} from ${prevName} to ${nextName}.`, task.title);

    if (task.jiraIssueKey && settings.jiraConfig?.autoSyncOnStatusChange !== false) {
      syncTaskToJira(taskId, `Assigned to ${nextName}`).catch(err => console.warn('Jira sprint move sync warning:', err));
    }

    // Notify assigned artist if task assigned
    if (task.artistId) {
      const artist = artists.find(a => a.id === task.artistId);
      if (artist && artist.userId !== currentUser.id) {
        addNotification(
          artist.userId,
          'Task Sprint Updated',
          `${currentUser.name} moved ${taskId} to ${nextName}.`,
          'info',
          'task',
          taskId
        );
      }
    }
  };

  // Projects
  const createProject = (data: Omit<Project, 'id' | 'taskCounter' | 'members'> & { initialManagerId?: string }): Project => {
    // Validate project key format
    const keyUpper = data.key.toUpperCase().trim();
    if (!/^[A-Z0-9]{2,8}$/.test(keyUpper)) {
      throw new Error('Project Key must be 2 to 8 uppercase alphanumeric characters without spaces.');
    }

    // Strictly disallow creating projects with identical or similar names or duplicate keys
    const conflict = findSimilarProject(data.name, keyUpper, projects);
    if (conflict) {
      throw new Error(conflict.reason);
    }

    const newId = `proj-${Date.now()}`;
    const newProject: Project = {
      ...data,
      id: newId,
      key: keyUpper,
      taskCounter: 0,
      members: [
        { userId: currentUser.id, accessLevel: 'MANAGER', assignedAt: getTodayDateString() },
        ...(data.initialManagerId && data.initialManagerId !== currentUser.id
          ? [{ userId: data.initialManagerId, accessLevel: 'MANAGER' as ProjectAccessLevel, assignedAt: getTodayDateString() }]
          : [])
      ]
    };

    setProjects(prev => [...prev, newProject]);
    syncSaveDoc(COLLECTIONS.PROJECTS, newProject);
    logActivity('Created Project', 'Project', newId, `Created new project "${newProject.name}" [${newProject.key}].`, newProject.name);
    return newProject;
  };

  const updateProject = (projectId: string, updates: Partial<Project>) => {
    // If name or key is being updated, validate against similar names and duplicate keys
    if (updates.name !== undefined || updates.key !== undefined) {
      const currentProj = projects.find(p => p.id === projectId);
      const testName = updates.name !== undefined ? updates.name : (currentProj?.name || '');
      const testKey = updates.key !== undefined ? updates.key : (currentProj?.key || '');
      const conflict = findSimilarProject(testName, testKey, projects, projectId);
      if (conflict) {
        throw new Error(conflict.reason);
      }
    }

    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        // Prevent changing key if project has tasks
        if (updates.key && updates.key !== p.key) {
          const hasTasks = tasks.some(t => t.projectId === projectId);
          if (hasTasks) {
            throw new Error('Cannot change Project Key once tasks have been created.');
          }
        }
        const updated = { ...p, ...updates };
        syncSaveDoc(COLLECTIONS.PROJECTS, updated);
        return updated;
      }
      return p;
    }));
    logActivity('Updated Project', 'Project', projectId, `Updated project ${projectId}.`);
  };

  const updateProjectAccess = (
    userId: string,
    projectId: string,
    newAccessLevel: ProjectAccessLevel | 'Removed',
    notes?: string
  ) => {
    const project = projects.find(p => p.id === projectId);
    const targetUser = users.find(u => u.id === userId);
    if (!project || !targetUser) return;

    const currentMember = project.members.find(m => m.userId === userId);
    const prevAccess = currentMember?.accessLevel || 'None';

    setProjects(prev => prev.map(p => {
      if (p.id === projectId) {
        let updatedMembers = p.members.filter(m => m.userId !== userId);
        if (newAccessLevel !== 'Removed') {
          updatedMembers.push({
            userId,
            accessLevel: newAccessLevel,
            assignedAt: getTodayDateString()
          });
        }
        const updated = { ...p, members: updatedMembers };
        syncSaveDoc(COLLECTIONS.PROJECTS, updated);
        return updated;
      }
      return p;
    }));

    // Record immutable audit entry
    const auditRecord: AccessAuditRecord = {
      id: `audit-${Date.now()}`,
      changedBy: currentUser.id,
      changedByName: `${currentUser.name} (${currentUser.role})`,
      userId,
      userName: targetUser.name,
      projectId,
      projectName: project.name,
      previousAccess: prevAccess,
      newAccess: newAccessLevel,
      timestamp: formatDateTime(new Date().toISOString()),
      notes: notes || `Changed permissions on ${project.name}`
    };

    setAccessAuditLogs(prev => [auditRecord, ...prev]);
    syncSaveDoc(COLLECTIONS.AUDIT_LOGS, auditRecord);

    logActivity(
      'Updated Project Access',
      'Access',
      userId,
      `${currentUser.name} changed ${targetUser.name}'s access on ${project.name} from ${prevAccess} to ${newAccessLevel}.`
    );

    addNotification(
      userId,
      'Project Permissions Updated',
      `Your access on ${project.name} was changed to ${newAccessLevel} by ${currentUser.name}.`,
      'info',
      'project',
      projectId
    );
  };

  // Projects
  const deleteProject = (projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
    setTasks(prev => prev.filter(t => t.projectId !== projectId));
    syncDeleteDoc(COLLECTIONS.PROJECTS, projectId);
    logActivity('Deleted Project', 'Project', projectId, `Deleted project ${projectId}.`);
  };

  // Artists
  const addArtist = (data: Omit<Artist, 'id'>): Artist => {
    const newId = `artist-${String(artists.length + 1).padStart(2, '0')}`;
    const newArtist: Artist = {
      ...data,
      id: newId
    };
    setArtists(prev => [...prev, newArtist]);
    syncSaveDoc(COLLECTIONS.ARTISTS, newArtist);
    logActivity('Added Artist', 'Artist', newId, `Added artist ${newArtist.name} (${newArtist.role}).`);
    return newArtist;
  };

  const updateArtist = (artistId: string, updates: Partial<Artist>) => {
    setArtists(prev => prev.map(a => {
      if (a.id === artistId) {
        const updated = { ...a, ...updates };
        syncSaveDoc(COLLECTIONS.ARTISTS, updated);
        return updated;
      }
      return a;
    }));
    logActivity('Updated Artist', 'Artist', artistId, `Updated artist profile ${artistId}.`);
  };

  const deleteArtist = (artistId: string) => {
    setArtists(prev => prev.filter(a => a.id !== artistId));
    syncDeleteDoc(COLLECTIONS.ARTISTS, artistId);
    
    // Unassign tasks assigned to this artist
    setTasks(prev => prev.map(t => {
      if (t.artistId === artistId) {
        const updated = { ...t, artistId: undefined };
        syncSaveDoc(COLLECTIONS.TASKS, updated);
        return updated;
      }
      return t;
    }));

    logActivity('Deleted Artist', 'Artist', artistId, `Removed artist ${artistId}.`);
  };

  const toggleArtistStatus = (artistId: string) => {
    setArtists(prev => prev.map(a => {
      if (a.id === artistId) {
        const nextStatus: 'Active' | 'Inactive' = a.status === 'Active' ? 'Inactive' : 'Active';
        const updated: Artist = { ...a, status: nextStatus };
        syncSaveDoc(COLLECTIONS.ARTISTS, updated);
        return updated;
      }
      return a;
    }));
  };

  // Daily Project Allocation Manual Overrides
  const updateDailyAllocation = (
    artistId: string,
    date: string,
    allocations: { projectId: string; percentage: number }[],
    reason?: string
  ) => {
    const key = `${artistId}_${date}`;
    const artist = artists.find(a => a.id === artistId);
    const newOverride: ManualDailyAllocationOverride = {
      id: `override-${artistId}-${date}`,
      artistId,
      date,
      allocations,
      reason,
      updatedBy: currentUser.name || 'Manager',
      updatedAt: new Date().toISOString()
    };

    setManualAllocations(prev => ({
      ...prev,
      [key]: newOverride
    }));

    logActivity(
      'Daily Allocation Adjustment',
      'Artist',
      artistId,
      `Adjusted manual project allocation for ${artist?.name || 'Artist'} on ${date} (${allocations.map(a => `${a.percentage}%`).join(', ')}).`,
      artist?.name
    );
  };

  const resetDailyAllocation = (artistId: string, date: string) => {
    const key = `${artistId}_${date}`;
    const artist = artists.find(a => a.id === artistId);
    setManualAllocations(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    logActivity(
      'Reset Daily Allocation',
      'Artist',
      artistId,
      `Reset daily project allocation to auto-calculated tasks for ${artist?.name || 'Artist'} on ${date}.`,
      artist?.name
    );
  };

  const bulkUpdateDailyAllocations = (overrides: ManualDailyAllocationOverride[]) => {
    setManualAllocations(prev => {
      const next = { ...prev };
      overrides.forEach(o => {
        next[`${o.artistId}_${o.date}`] = o;
      });
      return next;
    });

    logActivity(
      'AI Daily Allocation Applied',
      'Sprint',
      'bulk-ai',
      `Applied AI-suggested project allocations for ${overrides.length} day-artist slots.`
    );
  };

  // Users & Studio Team Management
  const addUser = (data: Omit<User, 'id'>): User => {
    const newId = `user-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
    const newUser: User = {
      ...data,
      id: newId
    };
    setUsers(prev => [...prev, newUser]);
    syncSaveDoc(COLLECTIONS.USERS, newUser);
    logActivity('Added User', 'Access', newId, `Added studio team member ${newUser.name} (${newUser.role}).`);
    return newUser;
  };

  const updateUser = (userId: string, updates: Partial<User>) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const updated = { ...u, ...updates };
        syncSaveDoc(COLLECTIONS.USERS, updated);
        return updated;
      }
      return u;
    }));

    // If user is linked to an artist, update artist profile in sync
    setArtists(prev => prev.map(a => {
      if (a.userId === userId || a.email.toLowerCase() === (updates.email?.toLowerCase() || '')) {
        const updatedArtist = {
          ...a,
          name: updates.name || a.name,
          avatar: updates.avatar || a.avatar,
          email: updates.email || a.email,
          role: updates.title || a.role
        };
        syncSaveDoc(COLLECTIONS.ARTISTS, updatedArtist);
        return updatedArtist;
      }
      return a;
    }));

    if (currentUser.id === userId) {
      setCurrentUser(prev => ({ ...prev, ...updates }));
    }
    logActivity('Updated User', 'Access', userId, `Updated team member profile ${userId}.`);
  };

  const deleteUser = (userId: string) => {
    if (users.length <= 1) {
      alert('Cannot delete the last remaining studio administrator.');
      return;
    }
    setUsers(prev => prev.filter(u => u.id !== userId));
    setArtists(prev => prev.filter(a => a.userId !== userId));
    syncDeleteDoc(COLLECTIONS.USERS, userId);
    if (currentUser.id === userId) {
      const remaining = users.find(u => u.id !== userId) || INITIAL_ADMIN_USER;
      setCurrentUser(remaining);
    }
    logActivity('Deleted User', 'Access', userId, `Removed studio member ${userId}.`);
  };

  // Notifications
  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => {
      if (n.id === id) {
        const updated = { ...n, read: true };
        syncSaveDoc(COLLECTIONS.NOTIFICATIONS, updated);
        return updated;
      }
      return n;
    }));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => {
      const updated = { ...n, read: true };
      syncSaveDoc(COLLECTIONS.NOTIFICATIONS, updated);
      return updated;
    }));
  };

  // Reset & Persistence helpers
  const cleanAllPeopleProjectsTasks = () => {
    wipeAllCloudData();
  };

  const loadSampleDemoData = () => {
    localStorage.clear();
    setUsers(DEMO_SEED_USERS);
    setCurrentUser(DEMO_SEED_USERS[0]);
    setArtists(DEMO_SEED_ARTISTS);
    setProjects(DEMO_SEED_PROJECTS);
    setSprints(DEMO_SEED_SPRINTS);
    setTasks([]);
    setRequests([]);
    setTimeEntries([]);
    setAccessAuditLogs([]);
    setActivityLogs([]);
    setNotifications([]);
  };

  const resetToDemoData = () => {
    cleanAllPeopleProjectsTasks();
  };

  const clearAllData = () => {
    setTasks([]);
    setRequests([]);
    setTimeEntries([]);
    setAccessAuditLogs([]);
    setActivityLogs([]);
    setNotifications([]);
  };

  const exportDatabaseJson = (): string => {
    const db = {
      users,
      artists,
      projects,
      sprints,
      tasks,
      requests,
      timeEntries,
      accessAuditLogs,
      activityLogs,
      notifications,
      settings,
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(db, null, 2);
  };

  const importDatabaseJson = (jsonStr: string): boolean => {
    try {
      const db = JSON.parse(jsonStr);
      if (db.users) setUsers(db.users);
      if (db.artists) setArtists(db.artists);
      if (db.projects) setProjects(db.projects);
      if (db.sprints) setSprints(db.sprints);
      if (db.tasks) setTasks(db.tasks);
      if (db.requests) setRequests(db.requests);
      if (db.timeEntries) setTimeEntries(db.timeEntries);
      if (db.accessAuditLogs) setAccessAuditLogs(db.accessAuditLogs);
      if (db.activityLogs) setActivityLogs(db.activityLogs);
      if (db.notifications) setNotifications(db.notifications);
      if (db.settings) setSettings(db.settings);
      return true;
    } catch {
      return false;
    }
  };

  const updateSettings = (newSettings: Partial<StudioSettings>) => {
    setSettings(prev => {
      const updated: StudioSettings = { ...prev, ...newSettings };
      safeLocalStorageSet(`${STORAGE_KEY}_settings`, JSON.stringify(updated));
      syncSaveSettingsDoc(updated);

      // If Jira config was updated, persist to server app-level configuration
      if (newSettings.jiraConfig) {
        fetch('/api/jira/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newSettings.jiraConfig)
        }).catch(err => console.warn('Failed to sync Jira config to server:', err));
      }

      return updated;
    });
  };

  // ==========================================
  // JIRA INTEGRATION & PROXY SYNC ENGINE (STUDIO APP-WIDE GATEWAY)
  // ==========================================

  const testJiraConnection = async (configOverride?: any): Promise<{ success: boolean; user?: any; projects?: any[]; error?: string }> => {
    const config = configOverride || settings.jiraConfig;

    try {
      const res = await fetch('/api/jira/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostUrl: config?.hostUrl,
          email: config?.email,
          apiToken: config?.apiToken
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        updateSettings({
          jiraConfig: {
            ...(config || {}),
            connectionStatus: 'connected',
            lastConnectedAt: new Date().toISOString(),
            lastConnectionError: undefined
          }
        });
        return { success: true, user: data.user, projects: data.projects };
      } else {
        const errorMsg = data.error || 'Failed to authenticate with Jira API.';
        updateSettings({
          jiraConfig: {
            ...(config || {}),
            connectionStatus: 'error',
            lastConnectionError: errorMsg
          }
        });
        return { success: false, error: errorMsg };
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Network error connecting to Jira proxy.';
      return { success: false, error: errorMsg };
    }
  };

  const searchJiraIssues = async (options?: { projectKeys?: string; jqlQuery?: string; fetchAllAssignees?: boolean }): Promise<{ success: boolean; issues?: any[]; total?: number; error?: string }> => {
    const config = settings.jiraConfig;

    try {
      const res = await fetch('/api/jira/search-issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostUrl: config?.hostUrl,
          email: config?.email,
          apiToken: config?.apiToken,
          projectKeys: options?.projectKeys || config?.defaultProjectKeys,
          jqlQuery: options?.jqlQuery,
          fetchAllAssignees: options?.fetchAllAssignees ?? true,
          maxResults: 100
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true, issues: data.issues, total: data.total };
      } else {
        return { success: false, error: data.error || 'Failed to fetch Jira issues.' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Error communicating with Jira API.' };
    }
  };

  const fetchJiraProjects = async (configOverride?: any): Promise<{ success: boolean; projects?: any[]; error?: string }> => {
    const configToUse = { ...settings.jiraConfig, ...configOverride };
    if (!configToUse.hostUrl || !configToUse.email || !configToUse.apiToken) {
      return { success: false, error: 'Jira credentials not configured.' };
    }
    try {
      const res = await fetch('/api/jira/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configToUse)
      });
      const data = await res.json();
      return data;
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to fetch Jira projects.' };
    }
  };

  const removeAllJiraTasks = async (): Promise<number> => {
    const jiraTasks = tasks.filter(t => t.isJiraImported || t.jiraIssueKey);
    const count = jiraTasks.length;

    for (const t of jiraTasks) {
      syncDeleteDoc(COLLECTIONS.TASKS, t.id);
    }

    setTasks(prev => prev.filter(t => !t.isJiraImported && !t.jiraIssueKey));

    logActivity(
      'Purged Existing Jira Tasks',
      'Task',
      'ALL',
      `Removed ${count} previously imported Jira tasks from Studio to enable a fresh, clean synchronization.`
    );

    return count;
  };

  const repairJiraTaskProjectMappings = async (): Promise<{ repairedCount: number; tasks: Task[] }> => {
    let repairedCount = 0;
    const updatedTasksList: Task[] = [];

    const newTasks = tasks.map(t => {
      if (!t.isJiraImported && !t.jiraIssueKey) return t;
      const targetProj = resolveStudioProjectForTask(t, projects, settings.jiraConfig?.projectMappings);
      if (targetProj && (t.projectId !== targetProj.id || (targetProj.name && t.jiraProjectName !== targetProj.name))) {
        const repaired: Task = {
          ...t,
          projectId: targetProj.id,
          jiraProjectName: targetProj.name,
          jiraProjectKey: targetProj.key
        };
        syncSaveDoc(COLLECTIONS.TASKS, repaired);
        repairedCount++;
        updatedTasksList.push(repaired);
        return repaired;
      }
      return t;
    });

    if (repairedCount > 0) {
      setTasks(newTasks);
      logActivity(
        'Repaired Jira Project Mappings',
        'Task',
        'ALL',
        `Reassigned ${repairedCount} Jira task(s) to their exact corresponding Studio projects.`
      );
    }

    return { repairedCount, tasks: newTasks };
  };

  const updateJiraProjectMappings = (mappings: JiraProjectMapping[]) => {
    const updatedConfig: JiraIntegrationConfig = {
      ...(settings.jiraConfig || { hostUrl: '', email: '', apiToken: '' }),
      projectMappings: mappings,
      defaultProjectKeys: settings.jiraConfig?.defaultProjectKeys || DEFAULT_JIRA_PROJECT_KEYS
    };
    updateSettings({ jiraConfig: updatedConfig });
  };

  const updateJiraDefaultProjectKeys = (keys: string) => {
    const cleanKeys = keys.trim() || DEFAULT_JIRA_PROJECT_KEYS;
    const updatedConfig: JiraIntegrationConfig = {
      ...(settings.jiraConfig || { hostUrl: '', email: '', apiToken: '' }),
      defaultProjectKeys: cleanKeys
    };
    updateSettings({ jiraConfig: updatedConfig });
  };

  const addAllJiraMigrationProjectKeys = () => {
    const currentKeysStr = settings.jiraConfig?.defaultProjectKeys || '';
    const currentList = currentKeysStr.split(',').map(k => k.trim().toUpperCase()).filter(Boolean);
    const set = new Set(currentList);
    JIRA_MIGRATION_PROJECT_KEYS.forEach(k => set.add(k));
    const mergedStr = Array.from(set).join(', ');
    updateJiraDefaultProjectKeys(mergedStr);
  };

  const saveJiraUserMapping = async (mapping: JiraUserMapping) => {
    const currentMappings = settings.jiraConfig?.userMappings || [];
    const index = currentMappings.findIndex(
      m => (mapping.jiraAccountId && m.jiraAccountId === mapping.jiraAccountId) ||
           (mapping.jiraEmail && m.jiraEmail?.toLowerCase() === mapping.jiraEmail.toLowerCase()) ||
           (mapping.jiraDisplayName && m.jiraDisplayName?.toLowerCase() === mapping.jiraDisplayName.toLowerCase())
    );

    let updatedMappings: JiraUserMapping[];
    if (index >= 0) {
      updatedMappings = [...currentMappings];
      updatedMappings[index] = { ...updatedMappings[index], ...mapping, lastMappedAt: new Date().toISOString() };
    } else {
      updatedMappings = [...currentMappings, { ...mapping, lastMappedAt: new Date().toISOString() }];
    }

    const updatedConfig: JiraIntegrationConfig = {
      ...(settings.jiraConfig || { hostUrl: '', email: '', apiToken: '' }),
      userMappings: updatedMappings
    };

    updateSettings({ jiraConfig: updatedConfig });

    // Auto-reconcile tasks with new mapping
    const result = reconcileJiraTaskAssignees(tasks, artists, users, updatedMappings);
    if (result.correctedCount > 0) {
      setTasks(prev => prev.map(t => {
        const found = result.updatedTasks.find(u => u.id === t.id);
        return found || t;
      }));
      result.updatedTasks.forEach(t => {
        syncSaveDoc(COLLECTIONS.TASKS, t);
      });
    }
  };

  const deleteJiraUserMapping = async (jiraAccountIdOrEmail: string) => {
    const currentMappings = settings.jiraConfig?.userMappings || [];
    const updatedMappings = currentMappings.filter(
      m => m.jiraAccountId !== jiraAccountIdOrEmail &&
           m.jiraEmail?.toLowerCase() !== jiraAccountIdOrEmail.toLowerCase() &&
           m.jiraDisplayName?.toLowerCase() !== jiraAccountIdOrEmail.toLowerCase()
    );

    const updatedConfig: JiraIntegrationConfig = {
      ...(settings.jiraConfig || { hostUrl: '', email: '', apiToken: '' }),
      userMappings: updatedMappings
    };

    updateSettings({ jiraConfig: updatedConfig });
  };

  const reconcileAllJiraAssignees = (): { reconciledCount: number; updatedTasks: Task[] } => {
    const result = reconcileJiraTaskAssignees(
      tasks,
      artists,
      users,
      settings.jiraConfig?.userMappings || []
    );

    if (result.correctedCount > 0) {
      setTasks(prev => prev.map(t => {
        const found = result.updatedTasks.find(u => u.id === t.id);
        return found || t;
      }));

      result.updatedTasks.forEach(t => {
        syncSaveDoc(COLLECTIONS.TASKS, t);
      });

      logActivity(
        'Reconciled Jira Assignees',
        'Task',
        'MULTI',
        `Reconciled ${result.correctedCount} Jira tasks with studio artists/users.`
      );
    }

    return { reconciledCount: result.correctedCount, updatedTasks: result.updatedTasks };
  };

  const applyBulkEditTasks = async (
    payload: BulkEditTaskPayload,
    taskIds: string[]
  ): Promise<{ updatedCount: number; syncedJiraCount: number }> => {
    if (!taskIds || taskIds.length === 0) return { updatedCount: 0, syncedJiraCount: 0 };

    const targetTasks = tasks.filter(t => taskIds.includes(t.id));
    let syncedJiraCount = 0;
    const nowIso = new Date().toISOString();

    const updatedTasksList: Task[] = [];

    for (const original of targetTasks) {
      const updated: Task = { ...original };

      if (payload.status !== undefined) {
        updated.status = payload.status;
        updated.jiraStatusName = payload.status;
      }
      if (payload.projectId !== undefined) {
        updated.projectId = payload.projectId;
        const newProj = projects.find(p => p.id === payload.projectId);
        if (newProj) {
          updated.jiraProjectName = newProj.name;
        }
      }
      if (payload.artistId !== undefined) {
        updated.artistId = payload.artistId || undefined;
      }
      if (payload.priority !== undefined) {
        updated.priority = payload.priority;
      }
      if (payload.sprintId !== undefined) {
        updated.sprintId = payload.sprintId || undefined;
        if (payload.sprintId) {
          const spr = sprints.find(s => s.id === payload.sprintId);
          if (spr) {
            updated.jiraSprintName = spr.name;
            updated.jiraSprintNumber = spr.sprintNumber;
          }
        }
      }
      if (payload.storyPoints !== undefined) {
        updated.storyPoints = payload.storyPoints;
        updated.jiraStoryPoints = payload.storyPoints;
      }
      if (payload.originalEstimate !== undefined) {
        updated.originalEstimate = payload.originalEstimate;
      }
      if (payload.clearDueDate) {
        updated.dueDate = '';
      } else if (payload.dueDate !== undefined) {
        updated.dueDate = payload.dueDate;
        updated.expectedDelivery = payload.dueDate;
        updated.jiraDueDate = payload.dueDate;
      }
      if (payload.timeLoggedIncrement && payload.timeLoggedIncrement > 0) {
        updated.timeLogged = (updated.timeLogged || 0) + payload.timeLoggedIncrement;
        if (updated.remainingEstimate !== undefined) {
          updated.remainingEstimate = Math.max(0, updated.remainingEstimate - payload.timeLoggedIncrement);
        }
      }

      updated.updatedBy = currentUser.id;
      updated.lastJiraSyncAt = nowIso;

      updatedTasksList.push(updated);
      syncSaveDoc(COLLECTIONS.TASKS, updated);

      if (payload.pushToJira && (updated.isJiraImported || updated.jiraIssueKey)) {
        try {
          if (payload.timeLoggedIncrement && payload.timeLoggedIncrement > 0) {
            await syncTaskToJira(updated.id, payload.worklogDescription || 'Bulk time log from Studio', payload.timeLoggedIncrement, {
              syncStatus: Boolean(payload.status),
              customStatus: payload.status ? String(payload.status) : undefined,
              remainingEstimateHours: updated.remainingEstimate
            });
            syncedJiraCount++;
          } else if (payload.status) {
            await syncTaskToJira(updated.id, undefined, undefined, {
              syncStatus: true,
              customStatus: String(payload.status)
            });
            syncedJiraCount++;
          }
        } catch (jiraErr) {
          console.warn(`Bulk Jira sync failed for task ${updated.id}:`, jiraErr);
        }
      }
    }

    setTasks(prev => prev.map(t => {
      const found = updatedTasksList.find(u => u.id === t.id);
      return found || t;
    }));

    logActivity(
      'Bulk Edited Tasks',
      'Task',
      payload.projectId || 'MULTI',
      `Bulk updated ${targetTasks.length} tasks (${syncedJiraCount} pushed to Jira).`
    );

    return { updatedCount: targetTasks.length, syncedJiraCount };
  };

  const importJiraIssuesToBacklog = (jiraIssues: any[], targetProjectId: string, targetSprintId?: string): { importedCount: number; updatedCount: number } => {
    let importedCount = 0;
    let updatedCount = 0;
    const today = getTodayDateString();

    const isCompletedStatus = (statusName?: string, statusCategory?: string) => {
      const s = (statusName || '').toLowerCase().trim();
      const c = (statusCategory || '').toLowerCase().trim();
      return (
        c === 'done' ||
        s === 'done' ||
        s === 'completed' ||
        s === 'verified' ||
        s === 'resolved' ||
        s === 'closed' ||
        s === 'approved' ||
        s === 'cancelled'
      );
    };

    // Filter issues by assignee: only Ranjeet's tasks
    // Also exclude completed / verified issues according to sync exclusion rules
    const relevantIssues = (jiraIssues || []).filter(jIssue => {
      if (isCompletedStatus(jIssue.status, jIssue.statusCategory)) return false;
      return true;
    });

    const existingMap = new Map<string, Task>();
    tasks.forEach(t => {
      if (t.jiraIssueKey) {
        existingMap.set(t.jiraIssueKey.toUpperCase(), t);
      }
      if (t.jiraIssueId) {
        existingMap.set(String(t.jiraIssueId), t);
      }
    });

    const tasksToInsert: Task[] = [];
    const tasksToUpdate: Task[] = [];
    const updatedProjectsMap = new Map<string, number>();
    let currentProjectsList = [...projects];

    relevantIssues.forEach(jIssue => {
      const upperKey = jIssue.key ? jIssue.key.toUpperCase() : '';
      const issueIdStr = jIssue.id ? String(jIssue.id) : '';
      const existing = (upperKey ? existingMap.get(upperKey) : undefined) || (issueIdStr ? existingMap.get(issueIdStr) : undefined);

      // Determine target project using strict Jira-to-Studio project matching
      const issueJiraKey = jIssue.projectKey || (jIssue.key ? getJiraProjectKeyFromIssueKey(jIssue.key) : '');
      const issueJiraName = jIssue.projectName || '';

      let effectiveProject: Project | undefined = undefined;
      if (targetProjectId && targetProjectId !== 'AUTO' && targetProjectId !== 'MULTI_PROJECT') {
        effectiveProject = currentProjectsList.find(p => p.id === targetProjectId);
      }

      if (!effectiveProject) {
        const matchResult = matchJiraToStudioProject(
          issueJiraKey,
          issueJiraName,
          currentProjectsList,
          true,
          settings.jiraConfig?.projectMappings
        );
        effectiveProject = matchResult.project;

        if (matchResult.isNewProject && !currentProjectsList.some(p => p.id === effectiveProject!.id)) {
          currentProjectsList = [...currentProjectsList, effectiveProject];
          setProjects(prev => {
            if (prev.some(p => p.id === effectiveProject!.id)) return prev;
            return [...prev, effectiveProject!];
          });
          syncSaveDoc(COLLECTIONS.PROJECTS, effectiveProject);
        }
      }

      if (!effectiveProject) {
        throw new Error('No studio projects available to assign Jira tasks.');
      }

      // Map Jira native status to Studio Status
      const rawStatus = (jIssue.status || '').trim();
      let studioStatus: TaskStatus = 'To Do';
      const lowerStatus = rawStatus.toLowerCase();

      if (lowerStatus === 'in progress' || lowerStatus === 'in development' || lowerStatus === 'in iteration') {
        studioStatus = 'In Progress';
      } else if (lowerStatus === 'on hold' || lowerStatus === 'blocked' || lowerStatus === 'paused') {
        studioStatus = 'On Hold';
      } else if (lowerStatus === 're-opened' || lowerStatus === 'reopened') {
        studioStatus = 'Re-opened';
      } else if (lowerStatus === 'revision') {
        studioStatus = 'In Iteration';
      } else if (lowerStatus === 'submit for review' || lowerStatus === 'in review' || lowerStatus === 'review') {
        studioStatus = 'Submit for Review';
      } else if (lowerStatus === 'done' || lowerStatus === 'completed' || lowerStatus === 'verified' || lowerStatus === 'resolved') {
        studioStatus = 'Completed';
      } else {
        studioStatus = targetSprintId ? 'To Do' : 'To Do';
      }

      const originalEstimate = jIssue.originalEstimateHours || (jIssue.storyPoints ? jIssue.storyPoints * 2 : 8);
      const remainingEstimate = jIssue.remainingEstimateHours !== undefined ? jIssue.remainingEstimateHours : originalEstimate;
      const timeSpentHours = jIssue.timeSpentHours || 0;
      const storyPoints = jIssue.storyPoints || Math.max(1, Math.round(originalEstimate / 2));

      // Correlate Sprint
      let effectiveSprintId = targetSprintId || undefined;
      const jSprintId = jIssue.sprintId ? String(jIssue.sprintId) : undefined;
      const jSprintNum = jIssue.sprintNumber;
      const jSprintName = jIssue.sprintName;

      let matchedSprint: Sprint | undefined = undefined;
      if (jSprintId) {
        matchedSprint = sprints.find(s => s.id === jSprintId || (s as any).jiraSprintId === jSprintId);
      }
      if (!matchedSprint && jSprintNum) {
        matchedSprint = sprints.find(s => s.sprintNumber === jSprintNum);
      }
      if (!matchedSprint && jSprintName) {
        const sLower = jSprintName.toLowerCase();
        matchedSprint = sprints.find(s => s.name.toLowerCase() === sLower || s.name.toLowerCase().includes(sLower));
      }
      if (matchedSprint) {
        effectiveSprintId = matchedSprint.id;
      }

      // Correlate Assignee (Requirements 357-360, 362-365)
      const assigneeResolution = resolveJiraAssigneeToStudio(
        {
          displayName: jIssue.assigneeName,
          accountId: jIssue.assigneeAccountId,
          email: jIssue.assigneeEmail
        },
        artists,
        users,
        settings.jiraConfig?.userMappings || []
      );
      const mappedArtistId = assigneeResolution.artistId || undefined;
      const needsUserMapping = assigneeResolution.needsMapping;

      const jPriority = (jIssue.priority === 'High' || jIssue.priority === 'Highest')
        ? 'High'
        : (jIssue.priority === 'Low' || jIssue.priority === 'Lowest')
        ? 'Low'
        : jIssue.priority === 'Critical'
        ? 'Critical'
        : 'Medium';

      if (existing) {
        // Compute changes for sync audit
        const changes: string[] = [];
        if (existing.status !== studioStatus) changes.push(`Status changed ${existing.status} → ${studioStatus}`);
        if (existing.sprintId !== effectiveSprintId && effectiveSprintId !== undefined) {
          const oldSp = sprints.find(s => s.id === existing.sprintId)?.name || 'Backlog';
          const newSp = matchedSprint?.name || 'Backlog';
          changes.push(`Sprint changed ${oldSp} → ${newSp}`);
        }
        if (mappedArtistId && existing.artistId !== mappedArtistId) {
          const oldArtist = artists.find(a => a.id === existing.artistId)?.name || 'Unassigned';
          const newArtist = artists.find(a => a.id === mappedArtistId)?.name || 'Artist';
          changes.push(`Assignee changed ${oldArtist} → ${newArtist}`);
        }
        if (existing.timeLogged !== timeSpentHours) changes.push(`Time Logged changed ${existing.timeLogged || 0}h → ${timeSpentHours}h`);
        if (existing.storyPoints !== storyPoints) changes.push(`Story Points changed ${existing.storyPoints || 0} → ${storyPoints}`);
        if (existing.dueDate !== jIssue.dueDate && jIssue.dueDate) changes.push(`Due Date changed ${existing.dueDate} → ${jIssue.dueDate}`);

        // Firestore Quota Optimization: If ticket has not changed in Jira, skip writing to Firestore!
        if (
          changes.length === 0 &&
          (!jIssue.updatedDate || existing.jiraUpdatedDate === jIssue.updatedDate) &&
          existing.status === studioStatus
        ) {
          return;
        }

        const nowIso = new Date().toISOString();
        const updatedRevisions = [...(existing.revisions || [])];
        if (changes.length > 0) {
          updatedRevisions.push({
            id: `rev-jira-sync-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
            revisionNumber: (existing.revisionCount || 0) + 1,
            feedback: `Jira Batch Sync (${jIssue.key}):\n${changes.map(c => `• ${c} (Source: Jira)`).join('\n')}`,
            changesDescription: changes.join('; '),
            status: studioStatus,
            date: nowIso,
            reviewedBy: 'Jira Sync Engine'
          });
        }

        // Prevent duplicates by refreshing the already imported task in place
        const updated: Task = {
          ...existing,
          projectId: effectiveProject.id,
          title: jIssue.summary || existing.title,
          description: jIssue.description || existing.description,
          storyPoints: storyPoints,
          originalEstimate: originalEstimate,
          remainingEstimate: remainingEstimate,
          timeLogged: timeSpentHours,
          status: studioStatus,
          artistId: mappedArtistId !== undefined ? mappedArtistId : existing.artistId,
          sprintId: effectiveSprintId !== undefined ? effectiveSprintId : existing.sprintId,
          dueDate: jIssue.dueDate || existing.dueDate,
          expectedDelivery: jIssue.dueDate || existing.expectedDelivery,
          priority: (jIssue.priority ? jPriority : existing.priority) as Priority,
          jiraSummary: jIssue.summary,
          jiraProjectName: effectiveProject.name,
          jiraProjectKey: jIssue.projectKey || effectiveProject.key,
          jiraStatusName: jIssue.status,
          jiraIssueType: jIssue.issueType,
          jiraPriority: jIssue.priority || existing.jiraPriority || 'Medium',
          jiraStoryPoints: storyPoints,
          jiraOriginalAssignee: jIssue.assigneeName || existing.jiraOriginalAssignee,
          jiraAssigneeEmail: jIssue.assigneeEmail || existing.jiraAssigneeEmail,
          jiraAssigneeAccountId: jIssue.assigneeAccountId || existing.jiraAssigneeAccountId,
          jiraAssigneeNeedsMapping: needsUserMapping,
          jiraReporter: jIssue.reporterName || existing.jiraReporter,
          jiraReporterEmail: jIssue.reporterEmail || existing.jiraReporterEmail,
          jiraReporterAccountId: jIssue.reporterAccountId || existing.jiraReporterAccountId,
          jiraOriginalEstimate: originalEstimate,
          jiraRemainingEstimate: remainingEstimate,
          jiraTimeLogged: timeSpentHours,
          jiraComponent: jIssue.component || (jIssue.components && jIssue.components[0]) || existing.jiraComponent,
          jiraComponents: jIssue.components || existing.jiraComponents,
          jiraSprintId: jSprintId || existing.jiraSprintId,
          jiraSprintName: jIssue.sprintName || existing.jiraSprintName,
          jiraSprintNumber: jIssue.sprintNumber || existing.jiraSprintNumber,
          jiraUpdateNo: jIssue.updateNo || existing.jiraUpdateNo,
          updateNo: jIssue.updateNo || existing.updateNo,
          jiraLabels: jIssue.labels || existing.jiraLabels,
          jiraFixVersion: (jIssue.fixVersions && jIssue.fixVersions[0]) || jIssue.fixVersion || existing.jiraFixVersion || existing.fixVersion,
          fixVersion: (jIssue.fixVersions && jIssue.fixVersions[0]) || jIssue.fixVersion || existing.fixVersion,
          jiraFixVersions: jIssue.fixVersions || existing.jiraFixVersions,
          jiraParentKey: jIssue.parentKey || existing.jiraParentKey,
          jiraParentSummary: jIssue.parentSummary || existing.jiraParentSummary,
          jiraParentId: jIssue.parentId || existing.jiraParentId,
          jiraParentType: jIssue.parentType || existing.jiraParentType,
          jiraCreatedDate: jIssue.createdDate || existing.jiraCreatedDate,
          jiraUpdatedDate: jIssue.updatedDate || existing.jiraUpdatedDate,
          jiraDueDate: jIssue.dueDate || existing.jiraDueDate,
          jiraSelfUrl: jIssue.url || existing.jiraSelfUrl,
          lastJiraSyncAt: nowIso,
          jiraSyncPending: false,
          revisions: updatedRevisions,
          revisionCount: (existing.revisionCount || 0) + (changes.length > 0 ? 1 : 0),
          updatedBy: currentUser.id
        };
        tasksToUpdate.push(updated);
        syncSaveDoc(COLLECTIONS.TASKS, updated, true);
        updatedCount++;
      } else {
        if (tasksToInsert.some(t => t.jiraIssueKey && t.jiraIssueKey.toUpperCase() === upperKey)) {
          return;
        }

        const currentCounter = (effectiveProject.taskCounter || 0) + (updatedProjectsMap.get(effectiveProject.id) || 0) + 1;
        updatedProjectsMap.set(effectiveProject.id, (updatedProjectsMap.get(effectiveProject.id) || 0) + 1);

        const taskId = `${effectiveProject.key}-${String(currentCounter).padStart(4, '0')}`;

        const newTask: Task = {
          id: taskId,
          projectId: effectiveProject.id,
          sprintId: effectiveSprintId,
          artistId: mappedArtistId,
          taskType: jIssue.issueType || 'Jira Art Ticket',
          title: `[${jIssue.key}] ${jIssue.summary}`,
          description: jIssue.description || `Imported from Jira ticket ${jIssue.key}`,
          requesterId: currentUser.id,
          artManagerId: effectiveProject.artManagerId || currentUser.id,
          priority: jPriority as Priority,
          storyPoints,
          originalEstimate,
          remainingEstimate,
          timeLogged: timeSpentHours,
          status: studioStatus,
          createdDate: jIssue.createdDate || today,
          dueDate: jIssue.dueDate || today,
          expectedDelivery: jIssue.dueDate || today,
          subtasks: [],
          dependencies: [],
          tags: [
            effectiveProject.name,
            'Jira',
            jIssue.projectKey,
            jIssue.sprintName,
            jIssue.updateNo ? `Update-${jIssue.updateNo}` : ''
          ].filter(Boolean) as string[],
          revisionCount: 0,
          revisions: [],
          attachments: [],
          comments: [
            {
              id: `com-jira-import-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
              userId: currentUser.id,
              userName: 'Jira Sync Gateway',
              userRole: currentUser.role,
              userAvatar: currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
              content: `Ticket imported from Jira (${jIssue.key}) mapped to project [${effectiveProject.name}]. Assignee: ${jIssue.assigneeName || 'Unassigned'}. Status: ${jIssue.status}.`,
              createdAt: formatDateTime(new Date().toISOString())
            }
          ],
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
          isJiraImported: true,
          jiraIssueKey: jIssue.key,
          jiraIssueId: jIssue.id,
          jiraProjectKey: issueJiraKey || effectiveProject.key,
          jiraProjectName: effectiveProject.name,
          jiraSelfUrl: jIssue.url,
          jiraSummary: jIssue.summary,
          jiraOriginalAssignee: jIssue.assigneeName,
          jiraAssigneeEmail: jIssue.assigneeEmail,
          jiraAssigneeAccountId: jIssue.assigneeAccountId,
          jiraAssigneeNeedsMapping: needsUserMapping,
          jiraReporter: jIssue.reporterName,
          jiraReporterEmail: jIssue.reporterEmail,
          jiraReporterAccountId: jIssue.reporterAccountId,
          jiraPriority: jIssue.priority || 'Medium',
          jiraOriginalEstimate: originalEstimate,
          jiraRemainingEstimate: remainingEstimate,
          jiraTimeLogged: timeSpentHours,
          jiraComponent: jIssue.component || (jIssue.components && jIssue.components[0]),
          jiraComponents: jIssue.components,
          jiraStatusName: jIssue.status,
          jiraIssueType: jIssue.issueType,
          jiraStoryPoints: storyPoints,
          jiraSprintId: jSprintId,
          jiraSprintName: jIssue.sprintName,
          jiraSprintNumber: jIssue.sprintNumber,
          jiraUpdateNo: jIssue.updateNo,
          updateNo: jIssue.updateNo,
          jiraLabels: jIssue.labels,
          jiraFixVersion: (jIssue.fixVersions && jIssue.fixVersions[0]) || jIssue.fixVersion,
          fixVersion: (jIssue.fixVersions && jIssue.fixVersions[0]) || jIssue.fixVersion,
          jiraFixVersions: jIssue.fixVersions,
          jiraParentKey: jIssue.parentKey,
          jiraParentSummary: jIssue.parentSummary,
          jiraParentId: jIssue.parentId,
          jiraParentType: jIssue.parentType,
          jiraCreatedDate: jIssue.createdDate,
          jiraUpdatedDate: jIssue.updatedDate,
          jiraDueDate: jIssue.dueDate,
          lastJiraSyncAt: new Date().toISOString(),
          jiraSyncPending: false
        };

        tasksToInsert.push(newTask);
        syncSaveDoc(COLLECTIONS.TASKS, newTask, true);
        importedCount++;
      }
    });

    // Update project taskCounters
    updatedProjectsMap.forEach((addedCount, projId) => {
      const proj = currentProjectsList.find(p => p.id === projId);
      if (proj) {
        const nextCounter = (proj.taskCounter || 0) + addedCount;
        setProjects(prev => prev.map(p => p.id === projId ? { ...p, taskCounter: nextCounter } : p));
        syncSaveDoc(COLLECTIONS.PROJECTS, { ...proj, taskCounter: nextCounter }, true);
      }
    });

    setTasks(prev => {
      let nextList = prev.map(t => {
        const up = tasksToUpdate.find(u => u.id === t.id);
        return up || t;
      });
      return [...tasksToInsert, ...nextList];
    });

    logActivity(
      'Imported Jira Tickets',
      'Task',
      targetProjectId || 'MULTI',
      `Synchronized ${importedCount} new tickets and refreshed ${updatedCount} existing tickets. Project mappings verified.`
    );

    return { importedCount, updatedCount };
  };

  const syncAllJiraTasks = async (): Promise<{ success: boolean; syncedCount: number; message: string }> => {
    try {
      const defaultKeys = settings.jiraConfig?.defaultProjectKeys || 'ALL';
      const searchRes = await searchJiraIssues({ projectKeys: defaultKeys, fetchAllAssignees: true });
      if (searchRes.success && searchRes.issues && searchRes.issues.length > 0) {
        const res = importJiraIssuesToBacklog(searchRes.issues, 'AUTO');
        return {
          success: true,
          syncedCount: res.importedCount + res.updatedCount,
          message: `Successfully synchronized ${res.importedCount} new tasks and refreshed ${res.updatedCount} existing tasks across all projects.`
        };
      } else if (searchRes.success) {
        return { success: true, syncedCount: 0, message: 'All projects are currently up to date with Jira.' };
      } else {
        return { success: false, syncedCount: 0, message: searchRes.error || 'Failed to sync with Jira.' };
      }
    } catch (err: any) {
      return { success: false, syncedCount: 0, message: err.message || 'Error executing multi-project Jira sync.' };
    }
  };

  const bulkImportTasksFromSpreadsheet = (
    importedTasks: Partial<Task>[],
    targetProjectId: string,
    targetSprintId?: string
  ): { importedCount: number; updatedCount: number; tasks: Task[] } => {
    const targetProject = projects.find(p => p.id === targetProjectId);
    if (!targetProject) throw new Error('Target studio project not found for bulk import.');

    let importedCount = 0;
    let updatedCount = 0;
    const today = getTodayDateString();

    const existingMap = new Map<string, Task>();
    tasks.forEach(t => {
      if (t.jiraIssueKey) {
        existingMap.set(t.jiraIssueKey.toUpperCase(), t);
      }
    });

    const tasksToInsert: Task[] = [];
    const tasksToUpdate: Task[] = [];

    importedTasks.forEach((item, index) => {
      const upperKey = item.jiraIssueKey ? item.jiraIssueKey.trim().toUpperCase() : '';
      const existing = upperKey ? existingMap.get(upperKey) : undefined;

      if (existing) {
        const updated: Task = {
          ...existing,
          title: item.title || existing.title,
          description: item.description || existing.description,
          storyPoints: item.storyPoints !== undefined ? item.storyPoints : existing.storyPoints,
          originalEstimate: item.originalEstimate !== undefined ? item.originalEstimate : existing.originalEstimate,
          remainingEstimate: item.remainingEstimate !== undefined ? item.remainingEstimate : existing.remainingEstimate,
          dueDate: item.dueDate || existing.dueDate,
          priority: item.priority || existing.priority,
          taskType: item.taskType || existing.taskType,
          artistId: item.artistId !== undefined ? item.artistId : existing.artistId,
          jiraSummary: item.jiraSummary || existing.jiraSummary,
          updatedBy: currentUser.id
        };
        tasksToUpdate.push(updated);
        syncSaveDoc(COLLECTIONS.TASKS, updated);
        updatedCount++;
      } else {
        const nextIdNumber = (targetProject.taskCounter || 0) + tasksToInsert.length + 1;
        const taskId = `${targetProject.key}-${String(nextIdNumber).padStart(4, '0')}`;
        const storyPoints = item.storyPoints || 3;
        const originalEstimate = item.originalEstimate || (storyPoints * 6);

        const newTask: Task = {
          id: taskId,
          projectId: targetProjectId,
          sprintId: targetSprintId || item.sprintId || undefined,
          requestId: item.requestId,
          taskType: item.taskType || 'Production Art',
          title: item.title || `Imported Task ${taskId}`,
          description: item.description || 'Bulk imported task from CSV / XLSX.',
          requesterId: currentUser.id,
          artManagerId: targetProject.artManagerId || currentUser.id,
          artistId: item.artistId,
          priority: item.priority || 'Medium',
          storyPoints,
          originalEstimate,
          remainingEstimate: item.remainingEstimate !== undefined ? item.remainingEstimate : originalEstimate,
          timeLogged: 0,
          status: (targetSprintId || item.sprintId) ? 'SELECTED' : (item.status || 'BACKLOG'),
          createdDate: item.createdDate || today,
          dueDate: item.dueDate || today,
          expectedDelivery: item.expectedDelivery || item.dueDate || today,
          subtasks: item.subtasks || [
            { id: `sub-${Date.now()}-${index}-1`, title: 'Asset preparation pass', completed: false, estimatedHours: Math.round(originalEstimate * 0.3) },
            { id: `sub-${Date.now()}-${index}-2`, title: 'Production & texturing', completed: false, estimatedHours: Math.round(originalEstimate * 0.5) },
            { id: `sub-${Date.now()}-${index}-3`, title: 'Final review & export packaging', completed: false, estimatedHours: Math.round(originalEstimate * 0.2) }
          ],
          dependencies: item.dependencies || [],
          tags: item.tags || [targetProject.name, item.taskType || 'Production Art', 'Bulk Import'],
          revisionCount: 0,
          revisions: [],
          attachments: item.attachments || [],
          comments: [],
          createdBy: currentUser.id,
          updatedBy: currentUser.id,
          isJiraImported: item.isJiraImported || Boolean(item.jiraIssueKey),
          jiraIssueKey: item.jiraIssueKey,
          jiraSummary: item.jiraSummary
        };

        const artist = artists.find(a => a.id === item.artistId);
        if (artist) {
          newTask.expectedDelivery = calculateTaskExpectedDelivery(newTask, artist, tasks);
        }

        tasksToInsert.push(newTask);
        syncSaveDoc(COLLECTIONS.TASKS, newTask);
        importedCount++;
      }
    });

    if (tasksToInsert.length > 0) {
      const nextCounter = (targetProject.taskCounter || 0) + tasksToInsert.length;
      setProjects(prev => prev.map(p => p.id === targetProjectId ? { ...p, taskCounter: nextCounter } : p));
      syncSaveDoc(COLLECTIONS.PROJECTS, { ...targetProject, taskCounter: nextCounter });
    }

    setTasks(prev => {
      let nextList = prev.map(t => {
        const up = tasksToUpdate.find(u => u.id === t.id);
        return up || t;
      });
      return [...tasksToInsert, ...nextList];
    });

    logActivity(
      'Bulk Imported Tasks',
      'Task',
      targetProjectId,
      `Imported ${importedCount} items and updated ${updatedCount} items from spreadsheet into project ${targetProject.name}.`
    );

    addNotification(
      currentUser.id,
      'Bulk Import Complete',
      `Successfully imported ${importedCount} backlog tasks into ${targetProject.name}.`,
      'success',
      'task'
    );

    return { importedCount, updatedCount, tasks: [...tasksToInsert, ...tasksToUpdate] };
  };

  const getJiraMetadataForProject = (studioProjectIdOrKey: string): JiraProjectMetadata | null => {
    if (!studioProjectIdOrKey) return null;
    const config = settings.jiraConfig;

    // Check if directly a Jira key
    const directKey = studioProjectIdOrKey.trim().toUpperCase();
    if (jiraProjectMetadata[directKey]) {
      return jiraProjectMetadata[directKey];
    }
    if (DEFAULT_CLIENT_JIRA_METADATA[directKey]) {
      return DEFAULT_CLIENT_JIRA_METADATA[directKey];
    }

    // Resolve via Studio project
    const mappingRes = resolveJiraProjectForStudioProject(studioProjectIdOrKey, projects, config?.projectMappings);
    if (mappingRes.isMapped && mappingRes.jiraProjectKey) {
      const jKey = mappingRes.jiraProjectKey.toUpperCase();
      return jiraProjectMetadata[jKey] || DEFAULT_CLIENT_JIRA_METADATA[jKey] || {
        projectKey: jKey,
        projectName: mappingRes.jiraProjectName || jKey,
        issueTypes: [
          { id: '10001', name: 'Story', description: 'Story deliverable', subtask: false, iconUrl: '' },
          { id: '10002', name: 'Task', description: 'Standard task', subtask: false, iconUrl: '' },
          { id: '10003', name: 'Bug', description: 'Defect or bug', subtask: false, iconUrl: '' }
        ],
        defaultIssueTypeId: '10001',
        defaultIssueTypeName: 'Story',
        fixVersions: [],
        components: []
      };
    }

    return null;
  };

  const refreshJiraProjectMetadata = async (projectKey?: string): Promise<{ success: boolean; metadata?: Record<string, JiraProjectMetadata>; error?: string }> => {
    const config = settings.jiraConfig;
    const keysToFetch = projectKey ? [projectKey.trim().toUpperCase()] : ['WWE', 'M13', 'ART'];

    try {
      const res = await fetch('/api/jira/project-meta-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostUrl: config?.hostUrl,
          email: config?.email,
          apiToken: config?.apiToken,
          projectKeys: keysToFetch
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.metadata) {
          setJiraProjectMetadata(prev => {
            const merged = { ...prev, ...data.metadata };
            safeLocalStorageSet('artops_jira_project_metadata', JSON.stringify(compactJiraMetadataRecord(merged)));
            return merged;
          });
          return { success: true, metadata: data.metadata };
        }
      }
      return { success: false, error: 'Failed to refresh Jira metadata from server.' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Connection error refreshing Jira metadata.' };
    }
  };

  const validateTaskForJira = (task: Partial<Task>, targetProjectKey?: string) => {
    const missingFields: string[] = [];
    const errors: string[] = [];

    const config = settings.jiraConfig;
    const studioProject = projects.find(p => p.id === task.projectId);

    // Resolve project
    let resolvedProjectKey = targetProjectKey?.trim().toUpperCase();
    if (!resolvedProjectKey) {
      if (task.jiraProjectKey) {
        resolvedProjectKey = task.jiraProjectKey.trim().toUpperCase();
      } else if (task.projectId) {
        const mappingRes = resolveJiraProjectForStudioProject(task.projectId, projects, config?.projectMappings);
        if (mappingRes.isMapped && mappingRes.jiraProjectKey) {
          resolvedProjectKey = mappingRes.jiraProjectKey.toUpperCase();
        }
      }
    }

    if (!resolvedProjectKey) {
      missingFields.push('Jira Project Mapping');
      errors.push(`Studio project "${studioProject?.name || task.projectId || 'Unassigned'}" is not mapped to a Jira Project.`);
    }

    if (!task.title || !task.title.trim()) {
      missingFields.push('Summary / Title');
      errors.push('Task title/summary is required.');
    }

    const metadata = resolvedProjectKey ? getJiraMetadataForProject(resolvedProjectKey) : null;
    const validIssueTypes = metadata?.issueTypes || [
      { id: '10001', name: 'Story', description: 'Story', subtask: false, iconUrl: '' },
      { id: '10002', name: 'Task', description: 'Task', subtask: false, iconUrl: '' },
      { id: '10003', name: 'Bug', description: 'Bug', subtask: false, iconUrl: '' }
    ];
    const validFixVersions = metadata?.fixVersions || [];
    const validComponents = metadata?.components || [];

    // Resolve issue type
    let resolvedIssueTypeId: string | undefined;
    let resolvedIssueType: string | undefined;

    if (task.jiraIssueTypeId) {
      const match = validIssueTypes.find(it => String(it.id) === String(task.jiraIssueTypeId));
      if (match) {
        resolvedIssueTypeId = String(match.id);
        resolvedIssueType = match.name;
      }
    }

    if (!resolvedIssueTypeId && (task.jiraIssueType || task.taskType)) {
      const targetName = (task.jiraIssueType || task.taskType || '').toLowerCase();
      const match = validIssueTypes.find(it => 
        it.name.toLowerCase() === targetName ||
        (targetName.includes('bug') && it.name.toLowerCase().includes('bug')) ||
        (targetName.includes('story') && it.name.toLowerCase().includes('story')) ||
        (targetName.includes('task') && it.name.toLowerCase().includes('task'))
      );
      if (match) {
        resolvedIssueTypeId = String(match.id);
        resolvedIssueType = match.name;
      }
    }

    if (!resolvedIssueTypeId) {
      resolvedIssueTypeId = metadata?.defaultIssueTypeId || (validIssueTypes[0] ? String(validIssueTypes[0].id) : '10001');
      resolvedIssueType = metadata?.defaultIssueTypeName || (validIssueTypes[0] ? validIssueTypes[0].name : 'Story');
    }

    return {
      isValid: missingFields.length === 0 && errors.length === 0,
      missingFields,
      errors,
      resolvedProjectKey,
      resolvedIssueTypeId,
      resolvedIssueType,
      validIssueTypes,
      validFixVersions,
      validComponents
    };
  };

  const getAiJiraFieldSuggestions = (task: Partial<Task> & { projectId: string }) => {
    const metadata = getJiraMetadataForProject(task.projectId);
    const validIssueTypes = metadata?.issueTypes || [];
    const validFixVersions = metadata?.fixVersions || [];
    const validComponents = metadata?.components || [];

    const text = `${task.title || ''} ${task.description || ''} ${(task.tags || []).join(' ')} ${task.taskType || ''}`.toLowerCase();

    // 1. Issue Type selection based on content
    let chosenIssueType = validIssueTypes[0];
    if (text.includes('bug') || text.includes('glitch') || text.includes('fix') || text.includes('defect') || text.includes('broken')) {
      const bugType = validIssueTypes.find(it => it.name.toLowerCase().includes('bug'));
      if (bugType) chosenIssueType = bugType;
    } else if (text.includes('character') || text.includes('wrestler') || text.includes('sculpt') || text.includes('3d model')) {
      const charType = validIssueTypes.find(it => it.name.toLowerCase().includes('character'));
      if (charType) chosenIssueType = charType;
    } else if (text.includes('anim') || text.includes('rig') || text.includes('motion') || text.includes('entrance') || text.includes('moveset')) {
      const animType = validIssueTypes.find(it => it.name.toLowerCase().includes('anim'));
      if (animType) chosenIssueType = animType;
    } else if (text.includes('ui') || text.includes('icon') || text.includes('hud') || text.includes('render') || text.includes('portrait')) {
      const uiType = validIssueTypes.find(it => it.name.toLowerCase().includes('ui'));
      if (uiType) chosenIssueType = uiType;
    } else if (text.includes('concept') || text.includes('sketch') || text.includes('mood') || text.includes('key art')) {
      const conceptType = validIssueTypes.find(it => it.name.toLowerCase().includes('concept'));
      if (conceptType) chosenIssueType = conceptType;
    } else if (text.includes('vehicle') || text.includes('car')) {
      const vehType = validIssueTypes.find(it => it.name.toLowerCase().includes('vehicle'));
      if (vehType) chosenIssueType = vehType;
    } else if (text.includes('env') || text.includes('arena') || text.includes('props') || text.includes('stage')) {
      const envType = validIssueTypes.find(it => it.name.toLowerCase().includes('env'));
      if (envType) chosenIssueType = envType;
    }

    // 2. Fix Version selection
    const activeVersions = validFixVersions.filter(v => !v.released && !v.archived);
    const chosenVersion = activeVersions[0] || validFixVersions[0];

    // 3. Component selection based on keywords
    let chosenComponent = validComponents[0];
    for (const comp of validComponents) {
      const compNameLower = comp.name.toLowerCase();
      const compDescLower = (comp.description || '').toLowerCase();
      if (
        text.includes(compNameLower) ||
        (compNameLower.includes('character') && (text.includes('character') || text.includes('wrestler') || text.includes('sculpt'))) ||
        (compNameLower.includes('anim') && (text.includes('anim') || text.includes('rig') || text.includes('motion'))) ||
        (compNameLower.includes('ui') && (text.includes('ui') || text.includes('icon') || text.includes('badge') || text.includes('banner'))) ||
        (compNameLower.includes('arena') && (text.includes('arena') || text.includes('ring') || text.includes('stadium'))) ||
        (compNameLower.includes('vehicle') && (text.includes('vehicle') || text.includes('car'))) ||
        (compNameLower.includes('vfx') && (text.includes('vfx') || text.includes('particle') || text.includes('spark') || text.includes('fx')))
      ) {
        chosenComponent = comp;
        break;
      }
    }

    // 4. Priority suggestion
    let priority: Priority = 'Medium';
    if (text.includes('blocker') || text.includes('urgent') || text.includes('critical') || text.includes('launch blocker') || text.includes('p0')) {
      priority = 'Critical';
    } else if (text.includes('important') || text.includes('high priority') || text.includes('p1')) {
      priority = 'High';
    } else if (text.includes('minor') || text.includes('polish') || text.includes('p3')) {
      priority = 'Low';
    }

    return {
      issueType: chosenIssueType?.name,
      issueTypeId: chosenIssueType?.id,
      fixVersion: chosenVersion?.name,
      fixVersionId: chosenVersion?.id,
      component: chosenComponent?.name,
      componentId: chosenComponent?.id,
      priority,
      confidence: 0.94,
      reason: `Matched with Jira Project ${metadata?.projectKey || 'Config'} live issue types & components schema.`
    };
  };

  const pushTaskToJira = async (
    taskId: string,
    targetProjectKey?: string,
    overrideFields?: Partial<Task>
  ): Promise<{ success: boolean; jiraKey?: string; message?: string; error?: string }> => {
    const rawTask = tasks.find(t => t.id === taskId);
    if (!rawTask) return { success: false, error: 'Task not found.' };

    const task: Task = { ...rawTask, ...(overrideFields || {}) };
    const config = settings.jiraConfig;
    const project = projects.find(p => p.id === task.projectId);

    // Validate using Jira project validator
    const validation = validateTaskForJira(task, targetProjectKey);
    if (!validation.isValid && validation.errors.length > 0) {
      return {
        success: false,
        error: validation.errors.join(' ')
      };
    }

    const resolvedKey = validation.resolvedProjectKey!;
    const assignedArtist = task.artistId ? artists.find(a => a.id === task.artistId) : null;
    const effectiveArtistName = assignedArtist?.name || currentUser.name || 'Studio Artist';

    // Format Fix Versions & Components with fallback resolution for required project fields (e.g. WWE)
    const metadata = getJiraMetadataForProject(resolvedKey);
    let resolvedFixVersionId = task.jiraFixVersionId;
    let resolvedFixVersionName = task.jiraFixVersion;
    if (!resolvedFixVersionId && !resolvedFixVersionName && metadata?.fixVersions && metadata.fixVersions.length > 0) {
      const activeVer = metadata.fixVersions.find(v => !v.released && !v.archived) || metadata.fixVersions[0];
      if (activeVer) {
        resolvedFixVersionId = String(activeVer.id);
        resolvedFixVersionName = activeVer.name;
      }
    }

    let resolvedComponentId = task.jiraComponentId;
    let resolvedComponentName = task.jiraComponent;
    if (!resolvedComponentId && !resolvedComponentName && metadata?.components && metadata.components.length > 0) {
      const activeComp = metadata.components.find(c => {
        const cName = c.name.toLowerCase();
        const tType = (task.taskType || '').toLowerCase();
        if (tType.includes('2d') || tType.includes('concept')) return cName.includes('2d') || cName.includes('art') || cName.includes('concept');
        if (tType.includes('3d')) return cName.includes('3d') || cName.includes('character') || cName.includes('environment');
        if (tType.includes('ui')) return cName.includes('ui') || cName.includes('icon');
        return cName.includes('art') || cName.includes('general');
      }) || metadata.components[0];
      if (activeComp) {
        resolvedComponentId = String(activeComp.id);
        resolvedComponentName = activeComp.name;
      }
    }

    const fixVersionsPayload = task.jiraFixVersions || (resolvedFixVersionName ? [resolvedFixVersionName] : []);
    const componentsPayload = task.jiraComponents || (resolvedComponentName ? [resolvedComponentName] : []);

    try {
      const res = await fetch('/api/jira/create-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostUrl: config?.hostUrl,
          email: config?.email,
          apiToken: config?.apiToken,
          projectKey: resolvedKey,
          summary: task.title,
          description: task.description || `Studio Task: ${task.title}\nAssigned Artist: ${effectiveArtistName}\nStudio Task ID: ${task.id}`,
          issueType: validation.resolvedIssueType || 'Task',
          issueTypeId: validation.resolvedIssueTypeId || task.jiraIssueTypeId,
          fixVersion: resolvedFixVersionName,
          fixVersionId: resolvedFixVersionId,
          fixVersions: fixVersionsPayload,
          component: resolvedComponentName,
          componentId: resolvedComponentId,
          components: componentsPayload,
          priority: task.priority || 'Medium',
          dueDate: task.dueDate || task.expectedDelivery,
          originalEstimateHours: task.originalEstimate || 8,
          storyPoints: task.storyPoints,
          artistName: effectiveArtistName,
          labels: ['rg-artflow', `studio-${task.projectId}`]
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.key) {
        const createdKey = data.key;
        const createdId = data.id ? String(data.id) : undefined;
        const targetProjName = project?.name || `Jira Project ${resolvedKey}`;

        setTasks(prev => prev.map(t => {
          if (t.id === taskId) {
            const updated: Task = {
              ...t,
              ...(overrideFields || {}),
              jiraIssueKey: createdKey,
              jiraIssueId: createdId,
              jiraProjectKey: resolvedKey,
              jiraProjectName: targetProjName,
              jiraIssueType: validation.resolvedIssueType || t.jiraIssueType || 'Task',
              jiraIssueTypeId: validation.resolvedIssueTypeId || t.jiraIssueTypeId,
              jiraFixVersion: task.jiraFixVersion || t.jiraFixVersion,
              jiraComponent: task.jiraComponent || t.jiraComponent,
              isJiraImported: true,
              lastJiraSyncAt: new Date().toISOString(),
              jiraSyncPending: false,
              lastJiraSyncError: undefined
            };
            syncSaveDoc(COLLECTIONS.TASKS, updated);
            return updated;
          }
          return t;
        }));

        logActivity(
          'Pushed Task to Jira',
          'Task',
          taskId,
          `Created and linked new Jira ticket ${createdKey} (Type: ${validation.resolvedIssueType || 'Task'}, Fix Version: ${task.jiraFixVersion || 'None'}) in project ${resolvedKey}.`,
          task.title
        );

        return {
          success: true,
          jiraKey: createdKey,
          message: `Successfully created and linked Jira ticket ${createdKey} in project ${resolvedKey}!`
        };
      } else {
        return {
          success: false,
          error: data.error || `Failed to create issue in Jira project ${resolvedKey}. Please check project permissions and mapping.`
        };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection error pushing task to Jira.' };
    }
  };

  const syncTaskFromJira = async (
    taskId: string
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return { success: false, error: 'Task not found.' };
    if (!task.jiraIssueKey) return { success: false, error: 'Task does not have a linked Jira Issue Key.' };

    const config = settings.jiraConfig;

    try {
      const res = await fetch('/api/jira/get-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostUrl: config?.hostUrl,
          email: config?.email,
          apiToken: config?.apiToken,
          jiraIssueKey: task.jiraIssueKey
        })
      });

      const data = await res.json();
      if (res.ok && data.success && data.issue) {
        const jIssue = data.issue;
        const nowIso = new Date().toISOString();
        const changes: string[] = [];

        // 1. Map status with unmapped handling
        const rawStatus = (jIssue.status || '').trim();
        const lowerStatus = rawStatus.toLowerCase();
        let studioStatus: TaskStatus = task.status;
        let isUnmappedStatus = false;

        if (lowerStatus === 'in progress' || lowerStatus === 'in development' || lowerStatus === 'in iteration') {
          studioStatus = 'In Progress';
        } else if (lowerStatus === 'on hold' || lowerStatus === 'blocked' || lowerStatus === 'paused') {
          studioStatus = 'On Hold';
        } else if (lowerStatus === 're-opened' || lowerStatus === 'reopened') {
          studioStatus = 'Re-opened';
        } else if (lowerStatus === 'revision') {
          studioStatus = 'In Iteration';
        } else if (lowerStatus === 'submit for review' || lowerStatus === 'in review' || lowerStatus === 'review') {
          studioStatus = 'Submit for Review';
        } else if (lowerStatus === 'done' || lowerStatus === 'completed' || lowerStatus === 'verified' || lowerStatus === 'resolved') {
          studioStatus = 'Completed';
        } else if (lowerStatus === 'to do' || lowerStatus === 'open' || lowerStatus === 'backlog') {
          studioStatus = 'To Do';
        } else if (rawStatus) {
          isUnmappedStatus = true;
          changes.push(`Jira Sync Warning: Unmapped Jira Status "${rawStatus}"`);
        }

        if (task.status !== studioStatus) {
          changes.push(`Status changed ${task.status} → ${studioStatus}`);
        }

        // 2. Sprint correlation: Primary ID, Sprint Number, Name, Dates
        let targetSprintId = task.sprintId;
        const jSprintId = jIssue.sprintId ? String(jIssue.sprintId) : undefined;
        const jSprintNum = jIssue.sprintNumber;
        const jSprintName = jIssue.sprintName;

        let matchedSprint: Sprint | undefined = undefined;
        if (jSprintId) {
          matchedSprint = sprints.find(s => s.id === jSprintId || (s as any).jiraSprintId === jSprintId);
        }
        if (!matchedSprint && jSprintNum) {
          matchedSprint = sprints.find(s => s.sprintNumber === jSprintNum);
        }
        if (!matchedSprint && jSprintName) {
          const sLower = jSprintName.toLowerCase();
          matchedSprint = sprints.find(s => s.name.toLowerCase() === sLower || s.name.toLowerCase().includes(sLower));
        }

        if (matchedSprint) {
          targetSprintId = matchedSprint.id;
        } else if (jSprintName || jSprintNum) {
          changes.push(`Jira Sync Warning: Unmapped Sprint "${jSprintName || jSprintNum}"`);
        }

        if (task.sprintId !== targetSprintId) {
          const oldSpName = sprints.find(s => s.id === task.sprintId)?.name || 'Backlog';
          const newSpName = matchedSprint?.name || 'Backlog';
          changes.push(`Sprint changed ${oldSpName} → ${newSpName}`);
        }

        // 3. Assignee correlation (Requirements 357-360, 362-365)
        let assignedArtistId = task.artistId;
        const assigneeRes = resolveJiraAssigneeToStudio(
          {
            displayName: jIssue.assigneeName,
            accountId: jIssue.assigneeAccountId,
            email: jIssue.assigneeEmail
          },
          artists,
          users,
          settings.jiraConfig?.userMappings || []
        );

        if (assigneeRes.artistId) {
          if (task.artistId !== assigneeRes.artistId) {
            const oldArtistName = artists.find(a => a.id === task.artistId)?.name || 'Unassigned';
            const newArtistName = artists.find(a => a.id === assigneeRes.artistId)?.name || 'Artist';
            changes.push(`Assignee changed ${oldArtistName} → ${newArtistName}`);
            assignedArtistId = assigneeRes.artistId;
          }
        }

        // 4. Time tracking & estimates
        const newTimeSpent = jIssue.timeSpentHours ?? task.timeLogged;
        if (task.timeLogged !== newTimeSpent) {
          changes.push(`Time Logged changed ${task.timeLogged || 0}h → ${newTimeSpent || 0}h`);
        }

        const newOrigEst = jIssue.originalEstimateHours ?? task.originalEstimate;
        if (task.originalEstimate !== newOrigEst) {
          changes.push(`Original Estimate changed ${task.originalEstimate || 0}h → ${newOrigEst || 0}h`);
        }

        const newRemEst = jIssue.remainingEstimateHours ?? task.remainingEstimate;
        if (task.remainingEstimate !== newRemEst) {
          changes.push(`Remaining Estimate changed ${task.remainingEstimate || 0}h → ${newRemEst || 0}h`);
        }

        // 5. Story Points
        const newSP = jIssue.storyPoints ?? task.storyPoints;
        if (task.storyPoints !== newSP && newSP !== undefined) {
          changes.push(`Story Points changed ${task.storyPoints || 0} → ${newSP}`);
        }

        // 6. Due Date
        const newDueDate = jIssue.dueDate || task.dueDate;
        if (task.dueDate !== newDueDate && jIssue.dueDate) {
          changes.push(`Due Date changed ${task.dueDate || 'None'} → ${newDueDate}`);
        }

        // 7. Priority
        const jPriority = (jIssue.priority === 'High' || jIssue.priority === 'Highest')
          ? 'High'
          : (jIssue.priority === 'Low' || jIssue.priority === 'Lowest')
          ? 'Low'
          : jIssue.priority === 'Critical'
          ? 'Critical'
          : 'Medium';
        if (task.priority !== jPriority && jIssue.priority) {
          changes.push(`Priority changed ${task.priority} → ${jPriority}`);
        }

        // Build audit revisions
        const newRevisions = [...(task.revisions || [])];
        if (changes.length > 0) {
          newRevisions.push({
            id: `rev-jira-sync-${Date.now()}`,
            revisionNumber: (task.revisionCount || 0) + 1,
            feedback: `Jira Sync (${task.jiraIssueKey}):\n${changes.map(c => `• ${c} (Source: Jira)`).join('\n')}`,
            changesDescription: changes.join('; '),
            status: studioStatus,
            date: nowIso,
            reviewedBy: 'Jira Sync Engine'
          });
        }

        setTasks(prev => prev.map(t => {
          if (t.id === taskId) {
            const updated: Task = {
              ...t,
              title: jIssue.summary || t.title,
              description: jIssue.description || t.description,
              status: studioStatus,
              jiraStatusName: jIssue.status,
              artistId: assignedArtistId,
              sprintId: targetSprintId,
              jiraSprintId: jSprintId || t.jiraSprintId,
              jiraSprintName: jSprintName || t.jiraSprintName,
              jiraSprintNumber: jSprintNum || t.jiraSprintNumber,
              jiraIssueType: jIssue.issueType || t.jiraIssueType,
              jiraPriority: jIssue.priority || t.jiraPriority || 'Medium',
              jiraOriginalAssignee: jIssue.assigneeName || t.jiraOriginalAssignee,
              jiraAssigneeEmail: jIssue.assigneeEmail || t.jiraAssigneeEmail,
              jiraAssigneeAccountId: jIssue.assigneeAccountId || t.jiraAssigneeAccountId,
              jiraAssigneeNeedsMapping: assigneeRes.needsMapping,
              jiraReporter: jIssue.reporterName || t.jiraReporter,
              jiraReporterEmail: jIssue.reporterEmail || t.jiraReporterEmail,
              jiraReporterAccountId: jIssue.reporterAccountId || t.jiraReporterAccountId,
              jiraLabels: jIssue.labels || t.jiraLabels,
              jiraFixVersion: (jIssue.fixVersions && jIssue.fixVersions[0]) || jIssue.fixVersion || t.jiraFixVersion || t.fixVersion,
              fixVersion: (jIssue.fixVersions && jIssue.fixVersions[0]) || jIssue.fixVersion || t.fixVersion,
              jiraFixVersions: jIssue.fixVersions || t.jiraFixVersions,
              jiraParentKey: jIssue.parentKey || t.jiraParentKey,
              jiraParentSummary: jIssue.parentSummary || t.jiraParentSummary,
              jiraParentId: jIssue.parentId || t.jiraParentId,
              jiraParentType: jIssue.parentType || t.jiraParentType,
              jiraComponent: jIssue.component || (jIssue.components && jIssue.components[0]) || t.jiraComponent,
              jiraComponents: jIssue.components || t.jiraComponents,
              jiraOriginalEstimate: newOrigEst,
              jiraRemainingEstimate: newRemEst,
              jiraTimeLogged: newTimeSpent,
              jiraIssueId: jIssue.id || t.jiraIssueId,
              jiraSelfUrl: jIssue.url || t.jiraSelfUrl,
              jiraUpdateNo: jIssue.updateNo || t.jiraUpdateNo,
              updateNo: jIssue.updateNo || t.updateNo,
              storyPoints: newSP,
              originalEstimate: newOrigEst,
              remainingEstimate: newRemEst,
              timeLogged: newTimeSpent,
              dueDate: newDueDate,
              expectedDelivery: newDueDate || t.expectedDelivery,
              priority: (jIssue.priority ? jPriority : t.priority) as Priority,
              lastJiraSyncAt: nowIso,
              jiraSyncPending: false,
              lastJiraSyncError: isUnmappedStatus ? `Jira Sync Warning: Unmapped Status "${rawStatus}"` : undefined,
              revisions: newRevisions,
              revisionCount: (t.revisionCount || 0) + (changes.length > 0 ? 1 : 0)
            };
            syncSaveDoc(COLLECTIONS.TASKS, updated);
            return updated;
          }
          return t;
        }));

        const auditSummary = changes.length > 0 ? ` Changes: ${changes.join(', ')}.` : ' No fields changed.';
        logActivity(
          'Synced from Jira',
          'Task',
          taskId,
          `Synchronized ${task.jiraIssueKey} from Jira (Status: ${jIssue.status}, Sprint: ${jSprintName || 'None'}).${auditSummary}`,
          task.title
        );

        return {
          success: true,
          message: `Successfully synchronized ${task.jiraIssueKey} with Jira!${changes.length > 0 ? ` Updated: ${changes.join(', ')}.` : ' All values were up to date.'}`
        };
      } else {
        return { success: false, error: data.error || 'Failed to pull Jira issue.' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection error syncing from Jira.' };
    }
  };

  const syncTaskToJira = async (
    taskId: string,
    customComment?: string,
    explicitHours?: number,
    options?: {
      syncStatus?: boolean;
      customStatus?: string;
      transitionId?: string;
      remainingEstimateHours?: number;
      worklogDescription?: string;
      worklogDate?: string;
    }
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return { success: false, error: 'Task not found.' };

    if (!task.jiraIssueKey) {
      return { success: false, error: 'This task does not have a Jira Issue Key. Only Jira-linked tickets can be synced back.' };
    }

    const config = settings.jiraConfig;

    // Determine artist attribution
    const assignedArtist = task.artistId ? artists.find(a => a.id === task.artistId) : null;
    const effectiveArtistName = assignedArtist?.name || currentUser.name || 'Studio Artist';

    // Map internal status to standard Jira statuses
    const statusMap: Record<string, string> = {
      'To Do': 'To Do',
      'In Progress': 'In Progress',
      'On Hold': 'On Hold',
      'Re-opened': 'Re-opened',
      'Submit for Review': 'Submit for Review',
      'In Iteration': 'In Iteration',
      'Completed': 'Completed',
      'Cancelled': 'Cancelled',
      BACKLOG: 'To Do',
      SELECTED: 'To Do',
      IN_PROGRESS: 'In Progress',
      INTERNAL_REVIEW: 'Submit for Review',
      REQUESTER_REVIEW: 'Submit for Review',
      REVISION: 'Re-opened',
      BLOCKED: 'On Hold',
      DONE: 'Completed'
    };
    
    // Only send statusName when status sync is desired
    const shouldSyncStatus = options?.syncStatus ?? (explicitHours === undefined);
    const targetJiraStatus = options?.customStatus || (shouldSyncStatus ? statusMap[task.status] : undefined);

    try {
      const res = await fetch('/api/jira/sync-task-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostUrl: config?.hostUrl,
          email: config?.email,
          apiToken: config?.apiToken,
          jiraIssueKey: task.jiraIssueKey,
          artistName: effectiveArtistName,
          assigneeName: assignedArtist?.name || task.jiraOriginalAssignee || undefined,
          assigneeEmail: assignedArtist?.email || task.jiraAssigneeEmail || undefined,
          assigneeAccountId: task.jiraAssigneeAccountId || undefined,
          hoursLogged: explicitHours,
          remainingEstimateHours: options?.remainingEstimateHours,
          worklogDescription: options?.worklogDescription || (explicitHours ? `Work logged by ${effectiveArtistName}` : undefined),
          worklogDate: options?.worklogDate || getTodayDateString(),
          storyPoints: task.storyPoints,
          dueDate: task.dueDate,
          priority: task.priority,
          issueTypeId: task.jiraIssueTypeId,
          issueType: task.jiraIssueType,
          fixVersion: task.jiraFixVersion,
          fixVersionId: task.jiraFixVersionId,
          component: task.jiraComponent,
          componentId: task.jiraComponentId,
          statusName: targetJiraStatus,
          transitionId: options?.transitionId,
          customComment,
          syncOptions: {
            addComment: true,
            storyPointsFieldId: config?.customStoryPointsFieldId || 'customfield_10016'
          }
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const nowIso = new Date().toISOString();
        const finalJiraStatus = data.results?.currentJiraStatus || targetJiraStatus || task.jiraStatusName;

        setTasks(prev => prev.map(t => {
          if (t.id === taskId) {
            const updated: Task = {
              ...t,
              lastJiraSyncAt: nowIso,
              jiraSyncPending: false,
              lastJiraSyncError: undefined,
              jiraStatusName: finalJiraStatus || t.jiraStatusName
            };
            syncSaveDoc(COLLECTIONS.TASKS, updated);
            return updated;
          }
          return t;
        }));

        logActivity(
          'Synced to Jira',
          'Task',
          taskId,
          `Successfully pushed updates for ${task.jiraIssueKey} to Jira (${finalJiraStatus || 'Updated'}) with artist attribution [${effectiveArtistName}].`,
          task.title
        );

        return {
          success: true,
          message: `Successfully synchronized ${task.jiraIssueKey} with Jira! Updated status to "${finalJiraStatus || targetJiraStatus}" with artist attribution for ${effectiveArtistName}.`
        };
      } else {
        const err = data.error || 'Jira synchronization failed.';
        setTasks(prev => prev.map(t => {
          if (t.id === taskId) {
            const updated: Task = {
              ...t,
              lastJiraSyncError: err,
              jiraSyncPending: true
            };
            syncSaveDoc(COLLECTIONS.TASKS, updated);
            return updated;
          }
          return t;
        }));
        return { success: false, error: err };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection error syncing with Jira.' };
    }
  };

  const postTaskAttachmentToJira = async (
    taskId: string,
    attachmentIdOrObject: string | TaskAttachment,
    customComment?: string
  ): Promise<{ success: boolean; attachment?: any; message?: string; error?: string }> => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return { success: false, error: 'Task not found.' };
    if (!task.jiraIssueKey) return { success: false, error: 'This task does not have a Jira Issue Key.' };

    const attachment = typeof attachmentIdOrObject === 'string'
      ? (task.attachments || []).find(a => a.id === attachmentIdOrObject)
      : attachmentIdOrObject;

    if (!attachment || !attachment.url) {
      return { success: false, error: 'Attachment file content or URL is missing.' };
    }

    const assignedArtist = task.artistId ? artists.find(a => a.id === task.artistId) : null;
    const effectiveArtistName = assignedArtist?.name || currentUser.name || 'Studio Artist';
    const config = settings.jiraConfig;

    try {
      const res = await fetch('/api/jira/upload-attachment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostUrl: config?.hostUrl,
          email: config?.email,
          apiToken: config?.apiToken,
          jiraIssueKey: task.jiraIssueKey,
          fileName: attachment.name,
          fileDataUrl: attachment.url,
          mimeType: attachment.type || attachment.fileType,
          artistName: effectiveArtistName,
          addComment: true,
          comment: customComment
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const nowIso = new Date().toISOString();
        const jiraAttId = data.attachment?.id ? String(data.attachment.id) : undefined;
        const jiraAttUrl = data.attachment?.content || data.attachment?.self;

        setTasks(prev => prev.map(t => {
          if (t.id === taskId) {
            const updatedAttachments = (t.attachments || []).map(a => {
              if (a.id === attachment.id || a.name === attachment.name) {
                return {
                  ...a,
                  jiraAttachmentId: jiraAttId,
                  jiraAttachmentUrl: jiraAttUrl,
                  syncedToJiraAt: nowIso,
                  syncError: undefined
                };
              }
              return a;
            });

            const updated: Task = {
              ...t,
              attachments: updatedAttachments,
              lastJiraSyncAt: nowIso,
              updatedBy: currentUser.id
            };
            syncSaveDoc(COLLECTIONS.TASKS, updated);
            return updated;
          }
          return t;
        }));

        logActivity(
          'Uploaded Media to Jira',
          'Task',
          taskId,
          `Posted attachment "${attachment.name}" to Jira ticket ${task.jiraIssueKey} [${effectiveArtistName}].`,
          task.title
        );

        return {
          success: true,
          attachment: data.attachment,
          message: `Successfully uploaded "${attachment.name}" to Jira ticket ${task.jiraIssueKey}!`
        };
      } else {
        const err = data.error || 'Jira attachment upload failed.';
        setTasks(prev => prev.map(t => {
          if (t.id === taskId) {
            const updatedAttachments = (t.attachments || []).map(a => {
              if (a.id === attachment.id) {
                return { ...a, syncError: err };
              }
              return a;
            });
            const updated = { ...t, attachments: updatedAttachments };
            syncSaveDoc(COLLECTIONS.TASKS, updated);
            return updated;
          }
          return t;
        }));
        return { success: false, error: err };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Connection error uploading attachment to Jira.' };
    }
  };

  const postAllTaskAttachmentsToJira = async (
    taskId: string
  ): Promise<{ success: boolean; uploadedCount: number; message?: string; error?: string }> => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return { success: false, uploadedCount: 0, error: 'Task not found.' };
    if (!task.jiraIssueKey) return { success: false, uploadedCount: 0, error: 'Task is not linked to Jira.' };

    const unsyncedAttachments = (task.attachments || []).filter(a => a.url);
    if (unsyncedAttachments.length === 0) {
      return { success: true, uploadedCount: 0, message: 'No attachments found to upload.' };
    }

    let successCount = 0;
    const errors: string[] = [];

    for (const att of unsyncedAttachments) {
      const res = await postTaskAttachmentToJira(taskId, att);
      if (res.success) {
        successCount++;
      } else if (res.error) {
        errors.push(`${att.name}: ${res.error}`);
      }
    }

    if (successCount > 0) {
      return {
        success: true,
        uploadedCount: successCount,
        message: `Successfully posted ${successCount} image/media file(s) to Jira ticket ${task.jiraIssueKey}.`
      };
    } else {
      return {
        success: false,
        uploadedCount: 0,
        error: errors.length > 0 ? errors.join('; ') : 'Failed to post attachments to Jira.'
      };
    }
  };

  const fetchJiraIssueAttachments = async (
    jiraIssueKey: string
  ): Promise<{ success: boolean; attachments: JiraTicketAttachment[]; error?: string }> => {
    const config = settings.jiraConfig;
    try {
      const res = await fetch('/api/jira/issue-attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostUrl: config?.hostUrl,
          email: config?.email,
          apiToken: config?.apiToken,
          jiraIssueKey
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true, attachments: data.attachments || [] };
      }
      return { success: false, attachments: [], error: data.error || 'Failed to fetch Jira attachments.' };
    } catch (err: any) {
      return { success: false, attachments: [], error: err.message || 'Error fetching Jira attachments.' };
    }
  };

  const importJiraAttachmentToTask = async (
    taskId: string,
    jiraAttachment: JiraTicketAttachment
  ): Promise<{ success: boolean; attachment?: TaskAttachment; error?: string }> => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return { success: false, error: 'Task not found.' };

    const config = settings.jiraConfig;

    // Store lightweight proxy URL directly without bloating Firestore with Base64 payloads
    const proxyUrl = jiraAttachment.proxyUrl || `/api/jira/attachment-proxy?id=${jiraAttachment.id}&url=${encodeURIComponent(jiraAttachment.content || '')}`;
    const fileUrl = proxyUrl;

    const humanSize = (jiraAttachment.size / 1024 < 1024)
      ? `${(jiraAttachment.size / 1024).toFixed(1)} KB`
      : `${(jiraAttachment.size / (1024 * 1024)).toFixed(1)} MB`;

    const importedAttachment: TaskAttachment = {
      id: `jira_att_${jiraAttachment.id}_${Date.now()}`,
      name: jiraAttachment.filename,
      size: humanSize,
      url: fileUrl,
      type: jiraAttachment.mimeType,
      fileType: jiraAttachment.mimeType,
      uploadedBy: currentUser.id,
      uploadedByName: jiraAttachment.author || 'Jira',
      uploadedAt: new Date(jiraAttachment.created || Date.now()).toLocaleDateString(),
      taskId: task.id,
      taskTitle: task.title,
      projectId: task.projectId,
      mediaCategory: jiraAttachment.mimeType?.startsWith('image/') ? 'Image' : 'Other',
      jiraAttachmentId: String(jiraAttachment.id),
      jiraAttachmentUrl: jiraAttachment.content,
      syncedToJiraAt: jiraAttachment.created || new Date().toISOString(),
      source: 'jira',
      jiraAuthor: jiraAttachment.author,
      proxyUrl: jiraAttachment.proxyUrl
    };

    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        // Prevent duplicate imports with same jiraAttachmentId
        const filtered = (t.attachments || []).filter(a => a.jiraAttachmentId !== String(jiraAttachment.id));
        const updated: Task = {
          ...t,
          attachments: [importedAttachment, ...filtered],
          updatedBy: currentUser.id
        };
        syncSaveDoc(COLLECTIONS.TASKS, updated);
        return updated;
      }
      return t;
    }));

    logActivity(
      'Imported Jira Media',
      'Task',
      taskId,
      `Imported "${jiraAttachment.filename}" from Jira ticket ${task.jiraIssueKey} into task assets.`,
      task.title
    );

    return { success: true, attachment: importedAttachment };
  };

  const postTaskCommentToJira = async (
    taskId: string,
    commentText: string
  ): Promise<{ success: boolean; commentId?: string; message?: string; error?: string }> => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return { success: false, error: 'Task not found.' };
    if (!task.jiraIssueKey) return { success: false, error: 'Task does not have a linked Jira Issue Key.' };
    if (!commentText || !commentText.trim()) return { success: false, error: 'Comment text cannot be empty.' };

    const assignedArtist = task.artistId ? artists.find(a => a.id === task.artistId) : null;
    const authorName = currentUser.name || assignedArtist?.name || 'Studio Member';
    const config = settings.jiraConfig;

    try {
      const res = await fetch('/api/jira/add-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostUrl: config?.hostUrl,
          email: config?.email,
          apiToken: config?.apiToken,
          jiraIssueKey: task.jiraIssueKey,
          comment: commentText.trim(),
          authorName
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        logActivity(
          'Pushed Comment to Jira',
          'Task',
          taskId,
          `Posted comment to Jira ticket ${task.jiraIssueKey}: "${commentText.trim().substring(0, 50)}..."`,
          task.title
        );
        return {
          success: true,
          commentId: data.commentId,
          message: `Successfully posted comment to ${task.jiraIssueKey} in Jira!`
        };
      }
      return { success: false, error: data.error || 'Failed to post comment to Jira.' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Error posting comment to Jira.' };
    }
  };

  const importAllJiraAttachmentsToTask = async (
    taskId: string,
    jiraAttachments: JiraTicketAttachment[]
  ): Promise<{ success: boolean; importedCount: number; error?: string }> => {
    if (!jiraAttachments || jiraAttachments.length === 0) {
      return { success: true, importedCount: 0 };
    }

    let count = 0;
    for (const att of jiraAttachments) {
      const res = await importJiraAttachmentToTask(taskId, att);
      if (res.success) count++;
    }

    return { success: true, importedCount: count };
  };

  const contextValue = useMemo(() => ({
    isQuotaExceeded,
    currentUser,
    setCurrentUser,
    isAuthenticated,
    logout,
    switchAdminProfile,
    users,
    addUser,
    updateUser,
    deleteUser,
    loginWithOfficeId,
    registerUserWithOfficeId,
    verifyUserWithCode,
    resendVerificationCode,
    checkUserStatus,
    requestPasswordReset,
    resetUserPassword,
    approveUserLogin,
    rejectUserLogin,
    updateUserPermissions,
    updateUserTabPermissions,
    grantDailyReportViewAccess,
    canApproveUserLogins,
    hasFieldAccess,
    canAccessTab,
    getTabAccessMode,
    isTabReadOnly,
    studioMails,
    markStudioMailAsRead,
    sendStudioMail,
    refreshStudioMails,
    artists: mergedArtists,
    projects,
    sprints,
    tasks,
    requests,
    timeEntries,
    accessAuditLogs,
    activityLogs,
    notifications,
    settings,
    getUserProjectAccess,
    hasProjectPermission,
    canEditTask,
    canManageSprint,
    canAccessAiSprintPlanner,
    canCreateProject,
    canAssignArtist,
    canLogTime,
    isCompanyRequestOwner,
    canEditCompanyRequest,
    canDeleteCompanyRequest,
    isCompanyRequestEditable,
    updateCompanyRequest,
    deleteCompanyRequest,
    createRequest,
    updateRequestStatus,
    assignCompanyRequest,
    triageAndCreateTaskFromRequest,
    createTask,
    updateTask,
    unassignTask,
    moveTaskToBacklog,
    updateTaskStatus,
    deleteTask,
    logTaskTime,
    requestTaskRevision,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    addTaskComment,
    addTaskAttachment,
    removeTaskAttachment,
    addRequestComment,
    submitMissingTask,
    approveMissingTask,
    bulkUpdateTasks,
    canManageSprints,
    createSprint,
    updateSprint,
    updateSprintStatus,
    completeSprint,
    moveCompletedSprintPendingTasksToActiveSprint,
    moveTaskToSprint,
    createProject,
    updateProject,
    deleteProject,
    updateProjectAccess,
    addArtist,
    updateArtist,
    deleteArtist,
    toggleArtistStatus,
    manualAllocations,
    updateDailyAllocation,
    resetDailyAllocation,
    bulkUpdateDailyAllocations,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    addNotification,
    cleanAllPeopleProjectsTasks,
    loadSampleDemoData,
    resetToDemoData,
    clearAllData,
    wipeAllUsers,
    wipeAllCloudData,
    exportDatabaseJson,
    importDatabaseJson,
    updateSettings,
    refreshStudioData,
    jiraProjectMetadata,
    getJiraMetadataForProject,
    refreshJiraProjectMetadata,
    validateTaskForJira,
    getAiJiraFieldSuggestions,
    pushTaskToJira,
    syncTaskFromJira,
    syncTaskToJira,
    postTaskAttachmentToJira,
    postTaskCommentToJira,
    postAllTaskAttachmentsToJira,
    fetchJiraIssueAttachments,
    importJiraAttachmentToTask,
    importAllJiraAttachmentsToTask,
    importJiraIssuesToBacklog,
    bulkImportTasksFromSpreadsheet,
    testJiraConnection,
    searchJiraIssues,
    fetchJiraProjects,
    syncAllJiraTasks,
    removeAllJiraTasks,
    repairJiraTaskProjectMappings,
    updateJiraProjectMappings,
    updateJiraDefaultProjectKeys,
    addAllJiraMigrationProjectKeys,
    saveJiraUserMapping,
    deleteJiraUserMapping,
    reconcileAllJiraAssignees,
    applyBulkEditTasks,
    previewRole,
    startRolePreview,
    exitRolePreview,
    showPermissionDenial,
    closeDenialAlert,
    denialAlert
  }), [
    isQuotaExceeded,
    currentUser,
    previewRole,
    denialAlert,
    isAuthenticated,
    users,
    artists,
    projects,
    sprints,
    tasks,
    requests,
    timeEntries,
    accessAuditLogs,
    activityLogs,
    notifications,
    settings,
    studioMails,
    manualAllocations
  ]);

  return (
    <ArtOpsContext.Provider value={contextValue}>
      {children}
    </ArtOpsContext.Provider>
  );
};

export const useArtOps = (): ArtOpsContextType => {
  const context = useContext(ArtOpsContext);
  if (!context) {
    throw new Error('useArtOps must be used within an ArtOpsProvider');
  }
  return context;
};
