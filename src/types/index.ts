export type UserRole = 'COMPANY_REQUESTER' | 'ARTIST' | 'ART_MANAGER' | 'ART_DIRECTOR' | 'ADMIN' | 'REVIEWER_QA' | 'VIEWER';

export type ProjectAccessLevel = 'VIEWER' | 'COMMENTER' | 'EDITOR' | 'MANAGER';

export type Priority = 'Critical' | 'High' | 'Medium' | 'Low';

export type TaskStatus = 
  | 'To Do'
  | 'In Progress'
  | 'On Hold'
  | 'Re-opened'
  | 'Submit for Review'
  | 'In Iteration'
  | 'Completed'
  | 'Cancelled'
  // Legacy internal tokens for backwards compatibility
  | 'BACKLOG'
  | 'SELECTED'
  | 'IN_PROGRESS'
  | 'INTERNAL_REVIEW'
  | 'REQUESTER_REVIEW'
  | 'REVISION'
  | 'BLOCKED'
  | 'DONE';

export const WORKFLOW_STATUS_LIST: TaskStatus[] = [
  'To Do',
  'In Progress',
  'On Hold',
  'Re-opened',
  'Submit for Review',
  'In Iteration',
  'Completed',
  'Cancelled'
];

export const normalizeTaskStatus = (status?: string): TaskStatus => {
  if (!status) return 'To Do';
  switch (status) {
    case 'To Do':
    case 'BACKLOG':
    case 'SELECTED':
    case 'TODO':
    case 'To do':
      return 'To Do';
    case 'In Progress':
    case 'IN_PROGRESS':
    case 'In progress':
      return 'In Progress';
    case 'On Hold':
    case 'BLOCKED':
    case 'ON_HOLD':
    case 'On hold':
      return 'On Hold';
    case 'Re-opened':
    case 'REOPENED':
    case 'RE_OPENED':
    case 'Reopened':
      return 'Re-opened';
    case 'Submit for Review':
    case 'INTERNAL_REVIEW':
    case 'REQUESTER_REVIEW':
    case 'IN_REVIEW':
    case 'REVIEW':
    case 'In Review':
      return 'Submit for Review';
    case 'In Iteration':
    case 'REVISION':
    case 'ITERATION':
    case 'In iteration':
      return 'In Iteration';
    case 'Completed':
    case 'DONE':
    case 'DONE_VERIFIED':
    case 'VERIFIED':
    case 'DELIVERED':
    case 'Done':
      return 'Completed';
    case 'Cancelled':
    case 'CANCELLED':
    case 'REJECTED':
    case 'CLOSED':
    case 'Canceled':
      return 'Cancelled';
    default:
      return (status as TaskStatus) || 'To Do';
  }
};

export const isTaskDoneOrCompleted = (status?: string): boolean => {
  if (!status) return false;
  const s = normalizeTaskStatus(status);
  return s === 'Completed';
};

export type RequestStatus = 
  | 'NEW'
  | 'TRIAGED'
  | 'QUEUED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'REVISION'
  | 'DELIVERED'
  | 'REJECTED';

export type SprintStatus = 'Planning' | 'Active' | 'Review' | 'Completed';

export type ProjectStatus = 'Active' | 'Paused' | 'Archived' | 'Completed';

export type ProjectType = 'Game' | 'Marketing' | 'LiveOps' | 'Store' | 'Platform' | 'Brand' | 'Social';

export type ArtCategory =
  | 'Marketing Art'
  | 'UI'
  | 'Character'
  | 'Environment'
  | 'Concept Art'
  | 'Illustration'
  | 'Icons'
  | '3D Render'
  | 'Animation'
  | 'VFX'
  | 'Social Media'
  | 'Store Assets'
  | 'Event Art'
  | 'Promotional Art'
  | 'Technical Art'
  | 'Other';

export type ArtistSpecialization =
  | 'Character Artist'
  | 'Environment Artist'
  | 'UI Artist'
  | 'Illustrator'
  | 'Concept Artist'
  | 'Marketing Artist'
  | '3D Artist'
  | '2D Animator'
  | 'VFX Artist'
  | 'Technical Artist'
  | 'Motion Graphics Artist'
  | 'Icon Designer'
  | 'Other';

export type BlockerReason =
  | 'Waiting for reference'
  | 'Waiting for design approval'
  | 'Waiting for 3D render'
  | 'Technical issue'
  | 'Missing requirement'
  | 'Other';

export type UserStatus = 'PENDING_APPROVAL' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

export type NavigationTab =
  | 'dashboard'
  | 'admin-tool'
  | 'gallery'
  | 'requests'
  | 'my-tasks'
  | 'backlog'
  | 'sprints'
  | 'kanban'
  | 'capacity'
  | 'artists'
  | 'daily-report'
  | 'sprint-report'
  | 'projects'
  | 'calendar'
  | 'reports'
  | 'activity'
  | 'people'
  | 'settings';

export type TabAccessMode = 'NONE' | 'VIEW' | 'EDIT' | 'FULL';
export type DailyReportAccessLevel = 'NONE' | 'VIEW_ONLY' | 'FULL_ACCESS';

export interface FieldAccessPermissions {
  canViewStoryPoints?: boolean;
  canEditStoryPoints?: boolean;
  canViewEstimates?: boolean;
  canEditEstimates?: boolean;
  canLogTime?: boolean;
  canViewHourlyRates?: boolean;
  canAssignArtists?: boolean;
  canApproveRevisions?: boolean;
  canManageSprints?: boolean;
  canCreateProjects?: boolean;
  canAccessAiPlanner?: boolean;
  canViewReports?: boolean;

  // Granular Access Control for all tabs
  tabAccess?: Partial<Record<NavigationTab, TabAccessMode>>;
  dailyReportAccess?: DailyReportAccessLevel;
  canAccessAllTabs?: boolean;
}

export interface StudioMail {
  id: string;
  toEmail: string;
  toName: string;
  fromName: string;
  fromEmail: string;
  subject: string;
  body: string;
  previewText?: string;
  type:
    | 'REQUEST_SUBMITTED'
    | 'APPROVAL_CODE'
    | 'REJECTION_NOTICE'
    | 'SECURITY_VERIFICATION'
    | 'SYSTEM_ALERT'
    | 'PASSWORD_RESET'
    | 'TASK_ASSIGNED'
    | 'TASK_STATUS_CHANGED'
    | 'TASK_DELIVERED'
    | 'TASK_REVISION'
    | 'TASK_COMMENT'
    | 'TASK_BLOCKED';
  verificationCode?: string;
  timestamp: string;
  read: boolean;
  userRole?: UserRole;
  metadata?: {
    userId?: string;
    officeId?: string;
    role?: UserRole;
    reason?: string;
    previousEmail?: string;
    newEmail?: string;
    [key: string]: any;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  officeId: string; // Auto-assigned Studio Employee / Office ID e.g. "OFF-1042"
  password?: string; // Stored securely for login authentication
  role: UserRole;
  avatar: string;
  department: string;
  title: string;
  artistId?: string; // Links to Artist record if role is ARTIST
  status: UserStatus; // Approval workflow: PENDING_APPROVAL -> ACTIVE (approved by Manager/Director/Admin)
  approvedBy?: string; // ID of the Approver (Art Manager, Art Director, or Admin)
  approvedByName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  verificationCode?: string; // 6-digit verification security code
  resetCode?: string; // 6-digit password reset security code
  resetCodeExpiresAt?: string;
  isVerified?: boolean; // verified via email code
  createdAt: string;
  fieldPermissions?: Partial<FieldAccessPermissions>;
}

export interface ArtistSkill {
  category: ArtCategory;
  rating: number; // 1 to 5
}

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
export type LeaveType = 'Full Day' | 'Half Day' | 'Sick Leave' | 'Casual Leave' | 'Vacation' | 'Public Holiday' | 'Emergency' | string;

export interface ArtistLeave {
  id: string;
  artistId?: string;
  startDate: string;
  endDate: string;
  leaveType?: LeaveType;
  isHalfDay?: boolean;
  halfDayPeriod?: 'First Half' | 'Second Half';
  hours?: number; // e.g. 8 for full day, 4 for half day, 16 for 2 full days
  duration?: string; // e.g. "1 Day", "0.5 Day (4h)", "2 Days"
  reason: string;
  status: LeaveStatus;
  requestedBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface Artist {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar: string;
  role: ArtistSpecialization | string;
  specialization: string;
  assignedProjects: string[]; // Project IDs
  dailyCapacity: number; // in hours (e.g. 8)
  weeklyCapacity: number; // in hours (e.g. 40)
  workingDays: string[]; // ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  productionAllocation: number; // percentage, e.g., 85
  meetingHoursWeekly: number; // e.g. 4
  status: 'Active' | 'On Leave' | 'Inactive';
  joinDate: string;
  skills: ArtistSkill[];
  leaveSchedule: ArtistLeave[];
  isManagement?: boolean;
  userRole?: UserRole;
}

export interface ProjectMember {
  userId: string;
  accessLevel: ProjectAccessLevel;
  assignedAt: string;
}

export interface Project {
  id: string;
  name: string;
  key: string; // e.g. "WWEART", 2-8 uppercase chars
  description: string;
  ownerId: string;
  artManagerId: string;
  artDirectorId: string;
  startDate: string;
  targetEndDate: string;
  status: ProjectStatus;
  priority: Priority;
  projectType: ProjectType;
  taskCounter: number; // Monotonically increasing counter for task IDs
  avatarColor: string;
  members: ProjectMember[];
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  assigneeId?: string;
  estimatedHours?: number;
}

export interface RevisionRecord {
  id: string;
  revisionNumber: number;
  requestedBy?: string;
  requestedByName?: string;
  date: string;
  comment?: string;
  feedback?: string;
  changesDescription?: string;
  status?: string;
  reviewedBy?: string;
  additionalHours?: number;
}

export interface TaskAttachment {
  id: string;
  name: string;
  fileName?: string;
  size: string;
  fileSize?: string;
  url: string;
  storagePath?: string;
  thumbnailPath?: string;
  type?: string;
  fileType?: string;
  uploadedBy: string;
  uploadedByName?: string;
  uploadedAt: string;
  taskId?: string;
  taskTitle?: string;
  projectId?: string;
  projectName?: string;
  mediaCategory?: 'Image' | 'Video' | 'GIF' | 'Render' | '3D Render' | 'UI' | 'Concept' | 'IMAGE' | 'VIDEO' | string;
  jiraAttachmentId?: string;
  jiraAttachmentUrl?: string;
  syncedToJiraAt?: string;
  syncError?: string;
  source?: 'local' | 'jira' | string;
  jiraAuthor?: string;
  proxyUrl?: string;
}

export interface JiraTicketAttachment {
  id: string;
  filename: string;
  author: string;
  created: string;
  size: number;
  mimeType: string;
  content: string;
  thumbnail?: string;
  proxyUrl: string;
  proxyThumbnailUrl?: string;
}

export type Attachment = TaskAttachment;

export interface TaskComment {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  userAvatar: string;
  content: string;
  createdAt: string;
  parentCommentId?: string;
  mentions?: string[];
  textColor?: string; // Custom formatting text color e.g. '#2563eb'
  attachments?: TaskAttachment[]; // Attached media files in comments
  formatStyles?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    code?: boolean;
    blockquote?: boolean;
  } | string[];
}

export interface TaskDependency {
  dependsOnTaskId?: string; // Task this task waits for
  blocksTaskId?: string; // Task that waits for this task
}

export interface SprintMovementRecord {
  fromSprintId?: string;
  fromSprintName?: string;
  toSprintId: string;
  toSprintName?: string;
  movedAt: string;
  reason?: string;
}

export interface Task {
  id: string; // e.g., "WWEART-0124"
  projectId: string;
  requestId?: string; // e.g., "REQ-2045"
  epic?: string;
  sprintId?: string;
  sprintHistory?: string[]; // Chain of sprints this task has belonged to e.g. ['sprint-1', 'sprint-2']
  sprintMovements?: SprintMovementRecord[]; // Historical movement log for carry forwards
  isMoved?: boolean; // Flag indicating task was moved from a completed sprint
  movedFromSprintId?: string;
  movedFromSprintName?: string;
  taskType: string;
  title: string;
  description: string;
  requesterId: string;
  artistId?: string;
  artManagerId: string;
  priority: Priority;
  storyPoints: number; // 1, 2, 3, 5, 8, 13, 21
  originalEstimate: number; // in hours, NEVER overwritten
  remainingEstimate: number; // in hours, auto or manual
  timeLogged: number; // in hours
  status: TaskStatus;
  createdDate: string;
  startDate?: string;
  dueDate: string;
  expectedDelivery: string;
  actualDelivery?: string;
  subtasks: Subtask[];
  dependencies: TaskDependency[];
  blockerReason?: BlockerReason;
  blockerDetails?: string;
  tags: string[];
  revisionCount: number;
  revisions: RevisionRecord[];
  attachments: TaskAttachment[];
  comments: TaskComment[];
  isMissingTask?: boolean;
  missingTaskStatus?: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  missingTaskReason?: string;
  createdBy: string;
  updatedBy: string;

  // Jira Integration & Lead Proxy Sync Fields
  isJiraImported?: boolean;
  jiraIssueKey?: string; // e.g. "WWE-1042", "ART-204"
  jiraIssueId?: string;
  jiraProjectKey?: string; // e.g. "WWE", "ART"
  jiraProjectName?: string; // e.g. "WWE Mayhem", "Marketing"
  jiraSelfUrl?: string; // Direct link to Jira issue web page
  jiraSummary?: string;
  jiraOriginalAssignee?: string; // e.g. Lead's Jira account name
  jiraAssigneeEmail?: string;
  jiraReporter?: string;
  jiraReporterEmail?: string;
  jiraStatusName?: string; // Jira native status e.g. "In Progress", "To Do", "Done"
  jiraIssueType?: string; // e.g. "Story", "Bug", "Epic", "Task"
  jiraIssueTypeId?: string; // Exact Jira Issue Type ID e.g. "10001"
  jiraStoryPoints?: number;
  jiraSprintName?: string;
  jiraSprintNumber?: number;
  jiraSprintId?: string;
  jiraParentKey?: string; // e.g. "WWE-1000", "ART-50" (Parent Issue or Epic Key)
  jiraParentId?: string; // Jira Parent internal ID
  jiraParentSummary?: string; // Parent summary / epic name
  jiraParentType?: string; // Parent issue type e.g. "Epic", "Initiative", "Story"
  jiraParentSelfUrl?: string; // Link to Jira parent issue
  fixVersion?: string; // Primary Fix Version e.g. "Update 98"
  fixVersionId?: string; // Jira Fix Version ID
  jiraFixVersion?: string;
  jiraFixVersionId?: string;
  jiraFixVersions?: string[]; // Array of Fix Versions
  component?: string; // Primary Component e.g. "2D Art"
  componentId?: string; // Jira Component ID
  jiraComponent?: string;
  jiraComponentId?: string;
  jiraComponents?: string[]; // Array of Components
  jiraPriority?: string;
  jiraAssigneeAccountId?: string;
  jiraAssigneeNeedsMapping?: boolean;
  jiraReporterAccountId?: string;
  jiraOriginalEstimate?: number;
  jiraRemainingEstimate?: number;
  jiraTimeLogged?: number;
  jiraUpdateNo?: string;
  updateNo?: string;
  jiraLabels?: string[];
  jiraCreatedDate?: string;
  jiraUpdatedDate?: string;
  jiraDueDate?: string;
  lastJiraSyncAt?: string;
  jiraSyncPending?: boolean; // True when local changes (time log, estimate, status) are awaiting sync to Jira
  lastJiraSyncError?: string;
}

export interface ReferenceFile {
  name: string;
  size: string;
  type: string;
  url: string;
}

export interface CompanyRequest {
  id: string; // e.g. "REQ-2045"
  requesterId: string;
  requesterName: string;
  requesterEmail?: string;
  requesterDepartment: string;
  projectId: string;
  artCategory: ArtCategory;
  taskTitle: string;
  taskDescription: string;
  priority: Priority;
  desiredDeliveryDate: string;
  referenceFiles: ReferenceFile[];
  referenceLinks: string[];
  platform: string;
  targetResolution: string;
  quantity: number;
  dependencies: string;
  additionalNotes: string;
  status: RequestStatus;
  createdAt: string;
  assignedArtistId?: string;
  taskId?: string; // e.g. "WWEART-0157"
  sprintId?: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  estimatedHours: number;
  revisions: RevisionRecord[];
  comments: TaskComment[];
}

export interface Sprint {
  id: string;
  projectId?: string;
  sprintNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  goal: string;
  status: SprintStatus;
  capacityHoursTotal?: number;
  committedHoursTotal?: number;
}

export interface TimeEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  projectId: string;
  artistId: string;
  artistName: string;
  date: string;
  hours: number;
  durationFormatted?: string; // e.g. "1d 2h 30m"
  description: string;
  createdAt: string;
  sprintId?: string;
}

export interface ArtistDailyReport {
  artistId: string;
  artistName: string;
  avatar: string;
  role: string;
  date: string;
  tasksCompletedCount: number;
  tasksCompleted: Task[];
  tasksWorkedOn: {
    task: Task;
    timeSpentHours: number;
    timeSpentFormatted: string;
    entries: TimeEntry[];
  }[];
  totalTimeSpentHours: number;
  totalTimeSpentFormatted: string;
  dailyCapacityHours: number;
  utilizationPercentage: number;
  // Overdue & Effort Overrun tracking
  overdueTasks: Task[];
  overdueCount: number;
  overEstimatedTasks: {
    task: Task;
    originalEstimate: number;
    timeLogged: number;
    varianceHours: number;
    variancePercent: number;
  }[];
  overEstimatedCount: number;
  blockedTasks: Task[];
  inProgressTasks: Task[];
  activeAssignedCount: number;
  incompleteTasks: Task[];
  incompleteCount: number;
  totalMediaCount: number;
}

export interface AccessAuditRecord {
  id: string;
  changedBy: string;
  changedByName: string;
  userId: string;
  userName: string;
  projectId: string;
  projectName: string;
  previousAccess: ProjectAccessLevel | 'None';
  newAccess: ProjectAccessLevel | 'Removed';
  timestamp: string;
  notes?: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  targetType: 'Task' | 'Request' | 'Sprint' | 'Project' | 'Artist' | 'Access' | 'Time';
  targetId: string;
  targetTitle?: string;
  details: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'alert';
  timestamp: string;
  read: boolean;
  linkType?: 'task' | 'request' | 'sprint' | 'project' | 'artist' | 'tab' | 'access' | 'report' | 'activity';
  linkId?: string;
  targetTab?: string;
}

export interface JiraProjectMapping {
  id?: string;
  jiraProjectKey: string; // e.g. "WWE", "ART", "MAYHEM"
  jiraProjectName?: string; // e.g. "WWE Mayhem"
  studioProjectId: string; // e.g. "proj-wwe"
  studioProjectName?: string;
  studioProjectKey?: string;
  autoCreated?: boolean;
}

export interface JiraIssueTypeInfo {
  id: string; // e.g. "10001"
  name: string; // e.g. "Story", "Bug", "Epic", "Task"
  description?: string;
  subtask?: boolean;
  iconUrl?: string;
  requiredFields?: string[]; // e.g. ['summary', 'issuetype', 'project']
  allowedFields?: string[]; // e.g. ['summary', 'description', 'issuetype', 'priority', 'duedate', 'labels', 'fixVersions', 'components']
  storyPointsFieldId?: string; // e.g. "customfield_10016" or undefined if not on screen
}

export interface JiraFixVersionInfo {
  id: string; // e.g. "10201"
  name: string; // e.g. "Update 98", "Update 99"
  description?: string;
  archived?: boolean;
  released?: boolean;
  releaseDate?: string;
}

export interface JiraComponentInfo {
  id: string; // e.g. "10101"
  name: string; // e.g. "2D Art", "2D Animation", "3D", "Audio", "Game Design", "Production", "Marketing"
  description?: string;
  lead?: { name?: string; email?: string };
}

export interface JiraProjectMetadata {
  projectId?: string;
  projectKey: string; // e.g. "WWE"
  projectName: string; // e.g. "WWE Mayhem"
  issueTypes: JiraIssueTypeInfo[];
  fixVersions: JiraFixVersionInfo[];
  components: JiraComponentInfo[];
  priorities?: { id: string; name: string }[];
  defaultIssueTypeId?: string;
  defaultIssueTypeName?: string;
  requiredFields?: Record<string, string[]>; // issueTypeId -> required field keys
  allowedFields?: Record<string, string[]>; // issueTypeId -> allowed screen field keys
  storyPointsFieldId?: string; // detected Story Points custom field ID if enabled on project
  lastRefreshedAt?: string;
}

export interface JiraUserMapping {
  jiraAccountId: string; // Jira accountId or username e.g. "712020:..."
  jiraDisplayName: string; // e.g. "Ranjeet Patil"
  jiraEmail?: string; // e.g. "ranjeet.patil@zapak.com"
  studioUserId?: string; // e.g. "user-ranjeet"
  studioArtistId?: string; // e.g. "artist-ranjeet"
  studioUserName?: string; // e.g. "Ranjeet Patil"
  status: 'MAPPED' | 'NEEDS_MAPPING';
  lastMappedAt?: string;
}

export const JIRA_MIGRATION_PROJECT_KEYS: string[] = [
  'CRXG', 'CH', 'AS', 'CRICK83', 'AMTT', 'AMDI', 'APT', 'AQS', 'AT', 'B10HTML',
  'BSR', 'BAR', 'BWHTML', 'CNL', 'CG', 'CGQS', 'CIDR', 'CT', 'CTP', 'CCL',
  'CB', 'DQS', 'DT', 'SS2GA', 'D2QN', 'DRON', 'D4', 'D4QB', 'DRN5', 'DSS',
  'DRNU', 'DYS', 'EI', 'EMO', 'EXD', 'FS', 'GI', 'GPK', 'GPKQ', 'GJ',
  'GP', 'HBKJ', 'ITBL', 'ITB', 'ITBC', 'IQ', 'KAN', 'KD', 'KBPM', 'KSS',
  'LOB', 'LKV2', 'LKJR', 'RADHA', 'RAM', 'LS', 'NLS2', 'LIT', 'LSC', 'LS2',
  'LSHTML', 'LSL', 'LSS', 'LST', 'LKDHHTML', 'LT', 'LUDO', 'MLW', 'MC', 'ARTMKT',
  'MTG', 'MTQ', 'MT', 'MM', 'NLO', 'NTK', 'NSHTML5', 'PR2', 'PIB', 'SDKS',
  'SDKTS', 'PQ', 'PL', 'PLQ', 'PB', 'PUSS', 'QTD', 'QT', 'RD', 'RWAR',
  'RP', 'RS', 'WB', 'WRB', 'RCMC', 'RN21', 'RUNKRIS', 'RQS', 'RH', 'SSP',
  'SDKTAS', 'SERVER', 'SIMB', 'RTRO', 'T20NEW', 'TCRIC', 'CS2D', 'TTT', 'UAC', 'UFZ',
  'URF', 'UZFQA', 'WCPL', 'WCCF', 'CUP16', 'WRB2', 'RSWRB', 'WQN', 'QA', 'RSWRB2',
  'WWE', 'WWEN', 'WQS', 'WQT', 'WQ'
];

export const DEFAULT_JIRA_PROJECT_KEYS = JIRA_MIGRATION_PROJECT_KEYS.join(', ');

export interface JiraIntegrationConfig {
  enabled?: boolean;
  hostUrl: string; // e.g. "https://reliancegames.atlassian.net"
  email: string; // Lead's Jira email e.g. "wwemayhemgame@gmail.com"
  apiToken: string; // Atlassian API token
  defaultProjectKeys?: string; // Comma-separated e.g. "WWE, ART, MAYHEM"
  projectMappings?: JiraProjectMapping[]; // Persistent Jira ↔ Studio project mappings
  userMappings?: JiraUserMapping[]; // Persistent Jira ↔ Studio user mappings (Requirements 357-360)
  importAssigneeAccountIds?: string[]; // Selected Jira accountIds/names for import filtering (Requirements 362-365)
  teamImportConfigs?: Record<string, { importAssigneeAccountIds: string[] }>;
  projectMetadata?: Record<string, JiraProjectMetadata>; // Cached project metadata keyed by uppercase Jira project key
  autoSyncOnTimeLog?: boolean; // When an artist logs time, automatically sync worklog to Jira
  autoSyncWorklogs?: boolean; // Same alias
  autoSyncOnStatusChange?: boolean; // When an artist changes status, automatically sync transition to Jira
  autoPostImagesToJira?: boolean; // Automatically upload attached images/media directly to the linked Jira ticket
  appendArtistAttributionComment?: boolean; // Post comment: "[RG ArtFlow Sync - Artist Name] ..."
  customStoryPointsFieldId?: string; // e.g. "customfield_10016"
  lastConnectedAt?: string;
  connectionStatus?: 'connected' | 'disconnected' | 'error';
  lastConnectionError?: string;
}

export interface JiraImportableIssue {
  id: string;
  key: string;
  summary: string;
  description?: string;
  issueType: string;
  issueTypeId?: string;
  fixVersion?: string;
  fixVersions?: string[];
  component?: string;
  components?: string[];
  status: string;
  statusCategory?: string;
  priority: string;
  assigneeName?: string;
  assigneeEmail?: string;
  assigneeAccountId?: string;
  assigneeNeedsMapping?: boolean;
  reporterName?: string;
  reporterEmail?: string;
  reporterAccountId?: string;
  storyPoints?: number;
  originalEstimateHours?: number;
  remainingEstimateHours?: number;
  timeSpentHours?: number;
  sprintName?: string;
  sprintNumber?: number;
  sprintId?: string;
  parentKey?: string;
  parentSummary?: string;
  parentId?: string;
  parentType?: string;
  updateNo?: string;
  labels?: string[];
  dueDate?: string;
  createdDate?: string;
  updatedDate?: string;
  projectKey: string;
  projectName?: string;
  url?: string;
}

export type AdvancedFilterFieldKey =
  | 'jiraIssueKey'
  | 'sprintNumber'
  | 'sprintName'
  | 'updateNo'
  | 'jiraProject'
  | 'studioProject'
  | 'jiraStatus'
  | 'studioStatus'
  | 'assignee'
  | 'reporter'
  | 'storyPoints'
  | 'priority'
  | 'issueType'
  | 'labels'
  | 'originalEstimate'
  | 'timeLogged'
  | 'remainingEstimate'
  | 'createdDate'
  | 'updatedDate'
  | 'dueDate';

export type AdvancedFilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'is_between'
  | 'is_set'
  | 'is_not_set'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month';

export interface AdvancedFilterRule {
  id: string;
  field: AdvancedFilterFieldKey;
  operator: AdvancedFilterOperator;
  value: string | number | string[];
  secondaryValue?: string | number;
}

export interface AdvancedFilterState {
  matchMode: 'AND' | 'OR';
  rules: AdvancedFilterRule[];
}

export type AdvancedFilterGroup = AdvancedFilterState;

export interface BulkEditTaskPayload {
  status?: TaskStatus;
  projectId?: string;
  storyPoints?: number;
  originalEstimate?: number;
  timeLogged?: number;
  timeLoggedIncrement?: number;
  artistId?: string;
  priority?: Priority;
  sprintId?: string;
  dueDate?: string;
  clearDueDate?: boolean;
  worklogDescription?: string;
  pushToJira?: boolean;
}

export interface RetentionPolicyConfig {
  syncLogsDays: number; // default 30 (range 30-60)
  notificationsDays: number; // default 90 (range 30-90)
  auditLogsDays: number; // default 90
  debugLogsDays: number; // default 14 (range 7-30)
  temporaryAiLogsDays: number; // default 14 (range 7-30)
  importStagingDays: number; // default 7 (range 1-7)
}

export interface CollectionStorageStat {
  collectionName: string;
  documentCount: number;
  estimatedSizeBytes: number;
  estimatedSizeFormatted: string;
  averageDocSizeBytes: number;
  oversizedDocCount: number;
  hasLargeBase64: boolean;
  retentionPolicy: 'PERMANENT' | 'RETENTION_MANAGED' | 'DISPOSABLE_STAGING';
}

export interface DatabaseHealthReport {
  timestamp: string;
  totalEstimatedSizeBytes: number;
  totalEstimatedSizeFormatted: string;
  totalDocumentCount: number;
  estimatedIndexSizeBytes: number;
  estimatedIndexSizeFormatted: string;
  collections: CollectionStorageStat[];
  quotaStatus: 'NORMAL' | 'ELEVATED' | 'QUOTA_EXCEEDED';
  cacheStorageEstimate: string;
  recommendations: string[];
}

export type CleanupCandidateType =
  | 'JIRA_SYNC_LOGS_EXPIRED'
  | 'NOTIFICATIONS_EXPIRED'
  | 'AUDIT_LOGS_EXPIRED'
  | 'DUPLICATE_JIRA_TASKS'
  | 'ORPHAN_TASKS'
  | 'ORPHAN_COMMENTS'
  | 'ORPHAN_MEDIA_METADATA'
  | 'ORPHAN_STORAGE_FILES'
  | 'COMPLETED_EXCLUDED_JIRA_IMPORTS'
  | 'BASE64_BLOATED_RECORDS';

export interface CleanupCandidateItem {
  id: string;
  collection: string;
  title: string;
  category: CleanupCandidateType;
  estimatedSizeBytes: number;
  estimatedSizeFormatted: string;
  createdAt?: string;
  reason: string;
  previewSummary: string;
  safeToClean: boolean;
  requiresExportFirst: boolean;
  dataRef?: any;
}

export interface CleanupCategorySummary {
  category: CleanupCandidateType;
  label: string;
  description: string;
  count: number;
  estimatedSizeBytes: number;
  estimatedSizeFormatted: string;
  safetyLevel: 'SAFE' | 'RECOMMENDED' | 'REVIEW_REQUIRED';
  items: CleanupCandidateItem[];
}

export interface StudioSettings {
  spToHoursRatio: number; // default 2
  defaultProductionAllocation: number; // default 85%
  workDays: string[];
  holidays: { date: string; name: string }[];
  jiraConfig?: JiraIntegrationConfig;
  aiExcludedArtistIds?: string[]; // Artists/Users excluded from AI automatic task distribution
  retentionPolicies?: RetentionPolicyConfig;
}

export interface DeliveryForecastResult {
  recommendedArtistId: string;
  recommendedArtistName: string;
  matchScore: number;
  expectedStartDate: string;
  expectedCompletionDate: string;
  expectedDeliveryDate: string;
  confidence: 'High' | 'Medium' | 'Low';
  alternativeArtists: {
    artistId: string;
    artistName: string;
    matchScore: number;
    expectedDeliveryDate: string;
    availableDailyHours: number;
    currentQueueHours: number;
    skillRating: number;
  }[];
  bottleneckWarning?: string;
}

export interface DailyProjectAllocationEntry {
  projectId: string;
  projectName: string;
  projectKey?: string;
  percentage: number; // e.g. 80 for 80%
  hours?: number; // e.g. 6.4h
  taskCount?: number;
}

export interface ArtistDailyProjectAllocation {
  id: string; // e.g. `alloc-${artistId}-${date}`
  artistId: string;
  artistName: string;
  avatar?: string;
  date: string; // YYYY-MM-DD
  dayLabel: string; // e.g. "Aug 31", "Mon, Aug 31"
  dailyCapacity: number; // e.g. 8h
  leaveHours: number; // e.g. 0, 4, 8
  isLeave: boolean;
  isHalfDayLeave?: boolean;
  leaveType?: string;
  leaveReason?: string;
  availableCapacity: number; // dailyCapacity - leaveHours (e.g. 8h, 4h, 0h)
  allocations: DailyProjectAllocationEntry[];
  totalPercentage: number; // Sum of project allocation %
  totalAllocatedHours: number;
  isManualOverride?: boolean;
  overrideNote?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface ManualDailyAllocationOverride {
  id: string;
  artistId: string;
  date: string;
  allocations: {
    projectId: string;
    percentage: number;
  }[];
  updatedBy?: string;
  updatedAt?: string;
  reason?: string;
}

