import { UserRole, NavigationTab, TabAccessMode } from '../types';

export type ActionKey =
  | 'CREATE_TASK'
  | 'EDIT_TASK'
  | 'DELETE_TASK'
  | 'ASSIGN_TASK'
  | 'UNASSIGN_TASK'
  | 'CHANGE_STATUS'
  | 'MOVE_TO_BACKLOG'
  | 'MOVE_TO_SPRINT'
  | 'COMPLETE_SPRINT'
  | 'EDIT_SPRINT_DATES'
  | 'BULK_EDIT'
  | 'CHANGE_DUE_DATE'
  | 'LOG_TIME'
  | 'ADD_COMMENT'
  | 'VIEW_HISTORY'
  | 'ADD_ATTACHMENT'
  | 'PUSH_TO_JIRA'
  | 'SYNC_FROM_JIRA'
  | 'CREATE_JIRA_TICKET'
  | 'EDIT_PROJECT'
  | 'CHANGE_PROJECT'
  | 'MANAGE_USERS'
  | 'MANAGE_ROLES'
  | 'MANAGE_TEAM'
  | 'VIEW_REPORTS'
  | 'EXPORT_REPORTS';

export interface ActionDefinition {
  key: ActionKey;
  label: string;
  category: 'Tasks & Workflow' | 'Sprints & Planning' | 'Projects' | 'Jira' | 'People & Administration' | 'Analytics & Reports';
  description: string;
}

export const ALL_ACTIONS: ActionDefinition[] = [
  // Tasks & Workflow
  { key: 'CREATE_TASK', label: 'Create Task', category: 'Tasks & Workflow', description: 'Create new art deliverables and assign tasks' },
  { key: 'EDIT_TASK', label: 'Edit Task', category: 'Tasks & Workflow', description: 'Modify task details, descriptions, and estimates' },
  { key: 'DELETE_TASK', label: 'Delete Task', category: 'Tasks & Workflow', description: 'Permanently remove tasks from the studio backlog' },
  { key: 'ASSIGN_TASK', label: 'Assign Task', category: 'Tasks & Workflow', description: 'Assign tasks to artists and team members' },
  { key: 'UNASSIGN_TASK', label: 'Unassign Task', category: 'Tasks & Workflow', description: 'Remove assigned artists from tasks' },
  { key: 'CHANGE_STATUS', label: 'Change Status', category: 'Tasks & Workflow', description: 'Advance task workflow stages (In Progress, Review, Done)' },
  { key: 'BULK_EDIT', label: 'Bulk Edit', category: 'Tasks & Workflow', description: 'Perform mass updates across multiple selected tasks' },
  { key: 'CHANGE_DUE_DATE', label: 'Change Due Date', category: 'Tasks & Workflow', description: 'Update task deadlines and schedule dates' },
  { key: 'LOG_TIME', label: 'Log Time', category: 'Tasks & Workflow', description: 'Submit daily work hours and timesheet records' },
  { key: 'ADD_COMMENT', label: 'Add Comment', category: 'Tasks & Workflow', description: 'Post comments and feedback on tasks' },
  { key: 'VIEW_HISTORY', label: 'View History', category: 'Tasks & Workflow', description: 'Inspect audit trail and revision logs' },
  { key: 'ADD_ATTACHMENT', label: 'Add Attachment', category: 'Tasks & Workflow', description: 'Upload artwork files, PSDs, and references' },

  // Sprints & Planning
  { key: 'MOVE_TO_BACKLOG', label: 'Move to Backlog', category: 'Sprints & Planning', description: 'Move tasks from sprints into the product backlog' },
  { key: 'MOVE_TO_SPRINT', label: 'Move to Sprint', category: 'Sprints & Planning', description: 'Commit backlog items into active or upcoming sprints' },
  { key: 'COMPLETE_SPRINT', label: 'Complete Sprint', category: 'Sprints & Planning', description: 'Close active sprints and auto carry-forward incomplete tasks' },
  { key: 'EDIT_SPRINT_DATES', label: 'Edit Sprint Dates', category: 'Sprints & Planning', description: 'Configure sprint start and end dates and goals' },

  // Projects
  { key: 'EDIT_PROJECT', label: 'Edit Project', category: 'Projects', description: 'Update project settings, milestones, and metadata' },
  { key: 'CHANGE_PROJECT', label: 'Change Project', category: 'Projects', description: 'Reassign tasks between game studio projects' },

  // Jira
  { key: 'PUSH_TO_JIRA', label: 'Push to Jira', category: 'Jira', description: 'Export local Studio tasks into Jira issues' },
  { key: 'SYNC_FROM_JIRA', label: 'Sync from Jira', category: 'Jira', description: 'Pull updates, comments, and attachments from Jira' },
  { key: 'CREATE_JIRA_TICKET', label: 'Create Jira Ticket', category: 'Jira', description: 'Directly create new linked Jira issues' },

  // People & Administration
  { key: 'MANAGE_USERS', label: 'Manage Users', category: 'People & Administration', description: 'Approve new user accounts and edit user profiles' },
  { key: 'MANAGE_ROLES', label: 'Manage Roles', category: 'People & Administration', description: 'Configure studio roles and granular field permissions' },
  { key: 'MANAGE_TEAM', label: 'Manage Team', category: 'People & Administration', description: 'Assign artist skills, hourly capacity, and leaves' },

  // Analytics & Reports
  { key: 'VIEW_REPORTS', label: 'View Reports', category: 'Analytics & Reports', description: 'Access daily worklogs and sprint velocity reports' },
  { key: 'EXPORT_REPORTS', label: 'Export Reports', category: 'Analytics & Reports', description: 'Download CSV and Excel files of production metrics' }
];

export interface RoleProfile {
  id: UserRole;
  name: string;
  badgeColor: string;
  description: string;
  tabAccess: Record<NavigationTab, TabAccessMode>;
  allowedActions: Record<ActionKey, boolean | 'LIMITED'>;
  denialMessages?: Partial<Record<ActionKey, string>>;
}

export const ROLE_PROFILES: Record<string, RoleProfile> = {
  ADMIN: {
    id: 'ADMIN',
    name: 'Admin',
    badgeColor: 'bg-purple-700 text-white',
    description: 'Complete studio ownership. Full read/write access to all modules, roles, Jira sync, and cloud settings.',
    tabAccess: {
      dashboard: 'FULL',
      'admin-tool': 'FULL',
      gallery: 'FULL',
      requests: 'FULL',
      'my-tasks': 'FULL',
      backlog: 'FULL',
      sprints: 'FULL',
      kanban: 'FULL',
      capacity: 'FULL',
      artists: 'FULL',
      'daily-report': 'FULL',
      'sprint-report': 'FULL',
      projects: 'FULL',
      calendar: 'FULL',
      reports: 'FULL',
      activity: 'FULL',
      people: 'FULL',
      settings: 'FULL'
    },
    allowedActions: ALL_ACTIONS.reduce((acc, a) => ({ ...acc, [a.key]: true }), {} as Record<ActionKey, boolean | 'LIMITED'>)
  },

  ART_MANAGER: {
    id: 'ART_MANAGER',
    name: 'Studio Manager',
    badgeColor: 'bg-blue-700 text-white',
    description: 'Manages studio operations, sprint planning, project deadlines, artist capacity, and team assignments.',
    tabAccess: {
      dashboard: 'FULL',
      'admin-tool': 'VIEW',
      gallery: 'FULL',
      requests: 'FULL',
      'my-tasks': 'FULL',
      backlog: 'FULL',
      sprints: 'FULL',
      kanban: 'FULL',
      capacity: 'FULL',
      artists: 'FULL',
      'daily-report': 'FULL',
      'sprint-report': 'FULL',
      projects: 'FULL',
      calendar: 'FULL',
      reports: 'FULL',
      activity: 'FULL',
      people: 'FULL',
      settings: 'FULL'
    },
    allowedActions: {
      CREATE_TASK: true,
      EDIT_TASK: true,
      DELETE_TASK: true,
      ASSIGN_TASK: true,
      UNASSIGN_TASK: true,
      CHANGE_STATUS: true,
      MOVE_TO_BACKLOG: true,
      MOVE_TO_SPRINT: true,
      COMPLETE_SPRINT: true,
      EDIT_SPRINT_DATES: true,
      BULK_EDIT: true,
      CHANGE_DUE_DATE: true,
      LOG_TIME: true,
      ADD_COMMENT: true,
      VIEW_HISTORY: true,
      ADD_ATTACHMENT: true,
      PUSH_TO_JIRA: true,
      SYNC_FROM_JIRA: true,
      CREATE_JIRA_TICKET: true,
      EDIT_PROJECT: true,
      CHANGE_PROJECT: true,
      MANAGE_USERS: 'LIMITED',
      MANAGE_ROLES: false,
      MANAGE_TEAM: true,
      VIEW_REPORTS: true,
      EXPORT_REPORTS: true
    },
    denialMessages: {
      MANAGE_ROLES: 'Studio Managers cannot alter security roles. Contact a Studio Administrator.'
    }
  },

  ART_DIRECTOR: {
    id: 'ART_DIRECTOR',
    name: 'Team Lead',
    badgeColor: 'bg-indigo-700 text-white',
    description: 'Directs artistic vision, conducts QA reviews, approves revisions, plans sprint tasks, and assigns work.',
    tabAccess: {
      dashboard: 'FULL',
      'admin-tool': 'NONE',
      gallery: 'FULL',
      requests: 'FULL',
      'my-tasks': 'FULL',
      backlog: 'FULL',
      sprints: 'FULL',
      kanban: 'FULL',
      capacity: 'FULL',
      artists: 'FULL',
      'daily-report': 'FULL',
      'sprint-report': 'FULL',
      projects: 'FULL',
      calendar: 'FULL',
      reports: 'FULL',
      activity: 'FULL',
      people: 'VIEW',
      settings: 'VIEW'
    },
    allowedActions: {
      CREATE_TASK: true,
      EDIT_TASK: true,
      DELETE_TASK: false,
      ASSIGN_TASK: true,
      UNASSIGN_TASK: true,
      CHANGE_STATUS: true,
      MOVE_TO_BACKLOG: true,
      MOVE_TO_SPRINT: true,
      COMPLETE_SPRINT: true,
      EDIT_SPRINT_DATES: true,
      BULK_EDIT: true,
      CHANGE_DUE_DATE: true,
      LOG_TIME: true,
      ADD_COMMENT: true,
      VIEW_HISTORY: true,
      ADD_ATTACHMENT: true,
      PUSH_TO_JIRA: true,
      SYNC_FROM_JIRA: true,
      CREATE_JIRA_TICKET: true,
      EDIT_PROJECT: 'LIMITED',
      CHANGE_PROJECT: true,
      MANAGE_USERS: false,
      MANAGE_ROLES: false,
      MANAGE_TEAM: 'LIMITED',
      VIEW_REPORTS: true,
      EXPORT_REPORTS: true
    },
    denialMessages: {
      DELETE_TASK: 'Team Leads cannot permanently delete tasks. Move tasks to Backlog or contact a Studio Manager.',
      MANAGE_USERS: 'Team Leads cannot manage user accounts. Contact a Studio Manager or Admin.',
      MANAGE_ROLES: 'Team Leads cannot alter security role definitions.'
    }
  },

  ARTIST: {
    id: 'ARTIST',
    name: 'Artist',
    badgeColor: 'bg-emerald-700 text-white',
    description: 'Hands-on production artist. Works on assigned tasks, logs daily hours, updates status, and adds artwork.',
    tabAccess: {
      dashboard: 'VIEW',
      'admin-tool': 'NONE',
      gallery: 'VIEW',
      requests: 'VIEW',
      'my-tasks': 'FULL',
      backlog: 'VIEW',
      sprints: 'VIEW',
      kanban: 'FULL',
      capacity: 'NONE',
      artists: 'NONE',
      'daily-report': 'FULL',
      'sprint-report': 'FULL',
      projects: 'NONE',
      calendar: 'VIEW',
      reports: 'NONE',
      activity: 'VIEW',
      people: 'NONE',
      settings: 'NONE'
    },
    allowedActions: {
      CREATE_TASK: false,
      EDIT_TASK: 'LIMITED',
      DELETE_TASK: false,
      ASSIGN_TASK: false,
      UNASSIGN_TASK: false,
      CHANGE_STATUS: true,
      MOVE_TO_BACKLOG: false,
      MOVE_TO_SPRINT: false,
      COMPLETE_SPRINT: false,
      EDIT_SPRINT_DATES: false,
      BULK_EDIT: false,
      CHANGE_DUE_DATE: false,
      LOG_TIME: true,
      ADD_COMMENT: true,
      VIEW_HISTORY: true,
      ADD_ATTACHMENT: true,
      PUSH_TO_JIRA: false,
      SYNC_FROM_JIRA: false,
      CREATE_JIRA_TICKET: false,
      EDIT_PROJECT: false,
      CHANGE_PROJECT: false,
      MANAGE_USERS: false,
      MANAGE_ROLES: false,
      MANAGE_TEAM: false,
      VIEW_REPORTS: 'LIMITED',
      EXPORT_REPORTS: false
    },
    denialMessages: {
      COMPLETE_SPRINT: 'Artists cannot complete a sprint. Contact a Studio Manager or Admin.',
      CREATE_TASK: 'Artists cannot create new global tasks directly. Use Missing Task submission or contact your Team Lead.',
      DELETE_TASK: 'Artists cannot delete tasks.',
      ASSIGN_TASK: 'Artists cannot reassign tasks to other team members.',
      MOVE_TO_BACKLOG: 'Artists cannot move sprint tasks back to the product backlog.',
      MOVE_TO_SPRINT: 'Artists cannot commit backlog items into sprints.',
      PUSH_TO_JIRA: 'Artists cannot push tickets directly to Jira.',
      MANAGE_USERS: 'Artists do not have access to People & Access configuration.',
      MANAGE_ROLES: 'Artists cannot manage security roles.'
    }
  },

  REVIEWER_QA: {
    id: 'REVIEWER_QA',
    name: 'Reviewer / QA',
    badgeColor: 'bg-amber-700 text-white',
    description: 'Conducts quality assurance, tests game deliverables, flags iterations, and signs off on completed art.',
    tabAccess: {
      dashboard: 'VIEW',
      'admin-tool': 'NONE',
      gallery: 'FULL',
      requests: 'VIEW',
      'my-tasks': 'FULL',
      backlog: 'VIEW',
      sprints: 'VIEW',
      kanban: 'FULL',
      capacity: 'NONE',
      artists: 'NONE',
      'daily-report': 'FULL',
      'sprint-report': 'FULL',
      projects: 'VIEW',
      calendar: 'VIEW',
      reports: 'VIEW',
      activity: 'VIEW',
      people: 'NONE',
      settings: 'NONE'
    },
    allowedActions: {
      CREATE_TASK: false,
      EDIT_TASK: 'LIMITED',
      DELETE_TASK: false,
      ASSIGN_TASK: false,
      UNASSIGN_TASK: false,
      CHANGE_STATUS: true,
      MOVE_TO_BACKLOG: false,
      MOVE_TO_SPRINT: false,
      COMPLETE_SPRINT: false,
      EDIT_SPRINT_DATES: false,
      BULK_EDIT: false,
      CHANGE_DUE_DATE: false,
      LOG_TIME: true,
      ADD_COMMENT: true,
      VIEW_HISTORY: true,
      ADD_ATTACHMENT: true,
      PUSH_TO_JIRA: false,
      SYNC_FROM_JIRA: true,
      CREATE_JIRA_TICKET: false,
      EDIT_PROJECT: false,
      CHANGE_PROJECT: false,
      MANAGE_USERS: false,
      MANAGE_ROLES: false,
      MANAGE_TEAM: false,
      VIEW_REPORTS: true,
      EXPORT_REPORTS: 'LIMITED'
    },
    denialMessages: {
      COMPLETE_SPRINT: 'Reviewers / QA cannot close or complete sprints.',
      DELETE_TASK: 'QA Reviewers cannot delete tasks.',
      ASSIGN_TASK: 'QA Reviewers cannot assign tasks to artists.'
    }
  },

  COMPANY_REQUESTER: {
    id: 'COMPANY_REQUESTER',
    name: 'Viewer / Requester',
    badgeColor: 'bg-slate-700 text-white',
    description: 'External or company stakeholder. Submits art requests, tracks deliverables, and inspects gallery assets.',
    tabAccess: {
      dashboard: 'VIEW',
      'admin-tool': 'NONE',
      gallery: 'VIEW',
      requests: 'FULL',
      'my-tasks': 'NONE',
      backlog: 'NONE',
      sprints: 'NONE',
      kanban: 'NONE',
      capacity: 'NONE',
      artists: 'NONE',
      'daily-report': 'NONE',
      'sprint-report': 'NONE',
      projects: 'NONE',
      calendar: 'NONE',
      reports: 'NONE',
      activity: 'NONE',
      people: 'NONE',
      settings: 'NONE'
    },
    allowedActions: {
      CREATE_TASK: false,
      EDIT_TASK: false,
      DELETE_TASK: false,
      ASSIGN_TASK: false,
      UNASSIGN_TASK: false,
      CHANGE_STATUS: false,
      MOVE_TO_BACKLOG: false,
      MOVE_TO_SPRINT: false,
      COMPLETE_SPRINT: false,
      EDIT_SPRINT_DATES: false,
      BULK_EDIT: false,
      CHANGE_DUE_DATE: false,
      LOG_TIME: false,
      ADD_COMMENT: true,
      VIEW_HISTORY: 'LIMITED',
      ADD_ATTACHMENT: true,
      PUSH_TO_JIRA: false,
      SYNC_FROM_JIRA: false,
      CREATE_JIRA_TICKET: false,
      EDIT_PROJECT: false,
      CHANGE_PROJECT: false,
      MANAGE_USERS: false,
      MANAGE_ROLES: false,
      MANAGE_TEAM: false,
      VIEW_REPORTS: false,
      EXPORT_REPORTS: false
    },
    denialMessages: {
      CREATE_TASK: 'Requesters submit requests via the Company Requests portal.',
      COMPLETE_SPRINT: 'Viewers/Requesters do not have sprint access.',
      MANAGE_USERS: 'Viewers/Requesters cannot access administrative features.'
    }
  }
};

export const getRoleProfile = (role: UserRole | string): RoleProfile => {
  if (ROLE_PROFILES[role]) {
    return ROLE_PROFILES[role];
  }
  // Fallback for custom or viewer roles
  if (role === 'VIEWER') {
    return ROLE_PROFILES['COMPANY_REQUESTER'];
  }
  return {
    id: role as UserRole,
    name: role.replace(/_/g, ' '),
    badgeColor: 'bg-slate-700 text-white',
    description: `Custom studio role (${role}).`,
    tabAccess: ROLE_PROFILES.ARTIST.tabAccess,
    allowedActions: ROLE_PROFILES.ARTIST.allowedActions
  };
};

export const getRoleAccessSummary = (role: UserRole | string) => {
  const profile = getRoleProfile(role);
  const totalModules = Object.keys(profile.tabAccess).length;
  const accessibleModules = Object.values(profile.tabAccess).filter(m => m !== 'NONE').length;

  const totalActions = ALL_ACTIONS.length;
  const allowedActions = Object.values(profile.allowedActions).filter(v => v === true || v === 'LIMITED').length;

  const allowedList: string[] = [];
  const restrictedList: string[] = [];

  // Group key modules and actions
  if (profile.tabAccess['my-tasks'] !== 'NONE') allowedList.push('My Work');
  if (profile.tabAccess.backlog !== 'NONE') allowedList.push('Backlog');
  if (profile.tabAccess.sprints !== 'NONE') allowedList.push('Sprints');
  if (profile.allowedActions.ADD_COMMENT) allowedList.push('Comments');
  if (profile.allowedActions.VIEW_HISTORY) allowedList.push('History');
  if (profile.allowedActions.LOG_TIME) allowedList.push('Time Tracking');
  if (profile.allowedActions.ADD_ATTACHMENT) allowedList.push('Attachments');
  if (profile.allowedActions.PUSH_TO_JIRA) allowedList.push('Jira Integration');
  if (profile.allowedActions.VIEW_REPORTS) allowedList.push('Reports');

  if (profile.tabAccess.people === 'NONE') restrictedList.push('People & Access');
  if (!profile.allowedActions.MANAGE_ROLES) restrictedList.push('Role Management');
  if (!profile.allowedActions.COMPLETE_SPRINT) restrictedList.push('Sprint Completion');
  if (!profile.allowedActions.EDIT_PROJECT) restrictedList.push('Project Management');
  if (!profile.allowedActions.PUSH_TO_JIRA) restrictedList.push('Jira Configuration');
  if (!profile.allowedActions.DELETE_TASK) restrictedList.push('Task Deletion');

  return {
    profile,
    totalModules,
    accessibleModules,
    totalActions,
    allowedActions,
    allowedList,
    restrictedList
  };
};

export const checkActionPermission = (
  role: UserRole | string,
  actionKey: ActionKey
): { allowed: boolean; isLimited?: boolean; reason?: string } => {
  const profile = getRoleProfile(role);
  const val = profile.allowedActions[actionKey];

  if (val === true) {
    return { allowed: true };
  }
  if (val === 'LIMITED') {
    return { allowed: true, isLimited: true, reason: 'Limited capability assigned for this role.' };
  }

  const reason = profile.denialMessages?.[actionKey] || `${profile.name}s do not have permission to perform this action. Contact a Studio Manager or Admin.`;
  return { allowed: false, reason };
};
