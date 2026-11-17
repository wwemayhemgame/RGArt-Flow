import { Project, JiraImportableIssue, Task, JiraProjectMapping } from '../types';
import { findSimilarProject, isAmdInternalProject } from './projectNameValidator';

export interface ProjectMatchResult {
  project: Project;
  matchedBy: 'EXPLICIT_MAPPING' | 'EXACT_NAME' | 'WWE_MAYHEM_ALIAS' | 'MKT_ALIAS' | 'OPS_ALIAS' | 'EXACT_KEY' | 'PREFIX_KEY' | 'TOKEN_SIMILARITY' | 'AUTO_CREATED';
  isNewProject?: boolean;
}

/**
 * Extracts Jira Project Key from an issue key (e.g. "WWE-38318" -> "WWE")
 */
export function getJiraProjectKeyFromIssueKey(issueKey?: string): string {
  if (!issueKey) return '';
  const trimmed = issueKey.trim().toUpperCase();
  if (trimmed.includes('-')) {
    return trimmed.split('-')[0];
  }
  return trimmed;
}

/**
 * Normalizes text for clean comparison (lowercase, trimmed, removes extra spaces & punctuation)
 */
export function normalizeProjectName(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if the given Jira project name / key refers to the flagship WWE Mayhem project
 */
export function isWweMayhemJiraProject(jiraProjectKey: string = '', jiraProjectName: string = ''): boolean {
  const normName = normalizeProjectName(jiraProjectName);
  const normKey = (jiraProjectKey || '').trim().toUpperCase();

  // Check keys
  const wweKeys = ['WWE', 'WWEM', 'WWM', 'MAYHEM', 'WWEART', 'WM', 'WW'];
  if (wweKeys.includes(normKey)) return true;

  // Check names
  if (
    normName.includes('wwe mayhem') ||
    normName.includes('ww mayhem') ||
    normName.includes('mayhem') ||
    normName.includes('wwe') ||
    normName === 'wwe' ||
    normName === 'mayhem' ||
    normName === 'wwem'
  ) {
    return true;
  }

  return false;
}

/**
 * Check if the given Jira project name / key refers to AMD - Internal (or legacy American Dad alias)
 */
export function isAmdInternalJiraProject(jiraProjectKey: string = '', jiraProjectName: string = ''): boolean {
  const normName = normalizeProjectName(jiraProjectName);
  const normKey = (jiraProjectKey || '').trim().toUpperCase();

  // Check keys
  const amdKeys = ['AMD', 'AD', 'AMDI', 'AMDD', 'AMDINT', 'AMDART'];
  if (amdKeys.includes(normKey)) return true;

  // Check names (including legacy American Dad alias mapping strictly to AMD - Internal)
  if (
    normName.includes('amd internal') ||
    normName.includes('amd - internal') ||
    normName.includes('amd') ||
    normName.includes('american dad') ||
    normName === 'amd' ||
    normName === 'ad'
  ) {
    return true;
  }

  return false;
}

/**
 * Robust, deterministic Jira-to-Studio project matching engine.
 * Ensures imported Jira tickets are assigned to the exact matching Studio project,
 * never silently falling back to an unrelated default (like HR/Admin).
 */
export function matchJiraToStudioProject(
  jiraProjectKey: string = '',
  jiraProjectName: string = '',
  studioProjects: Project[],
  autoCreateMissing: boolean = true,
  explicitMappings?: JiraProjectMapping[]
): ProjectMatchResult {
  const rawKey = (jiraProjectKey || '').trim().toUpperCase();
  const rawName = (jiraProjectName || '').trim();
  const normName = normalizeProjectName(rawName);

  // 1. Check user-configured explicit Jira ↔ Studio project mappings
  if (explicitMappings && explicitMappings.length > 0) {
    const explicit = explicitMappings.find(
      m =>
        (rawKey && m.jiraProjectKey?.trim().toUpperCase() === rawKey) ||
        (rawName && m.jiraProjectName && normalizeProjectName(m.jiraProjectName) === normName)
    );
    if (explicit) {
      const targetProj = studioProjects.find(p => p.id === explicit.studioProjectId);
      if (targetProj) {
        return { project: targetProj, matchedBy: 'EXPLICIT_MAPPING' };
      }
    }
  }

  // 2. Check for WWE Mayhem flagship project match (e.g. WWE-38318, WWE -> WWE Mayhem)
  if (isWweMayhemJiraProject(rawKey, rawName)) {
    const wweStudioProject = studioProjects.find(
      p =>
        p.id === 'proj-wwe' ||
        normalizeProjectName(p.name).includes('wwe mayhem') ||
        normalizeProjectName(p.name) === 'wwe' ||
        p.key.toUpperCase() === 'WWEART' ||
        p.key.toUpperCase() === 'WWE'
    );
    if (wweStudioProject) {
      return { project: wweStudioProject, matchedBy: 'WWE_MAYHEM_ALIAS' };
    }
  }

  // 2b. Check for AMD - Internal project match (including legacy American Dad alias)
  if (isAmdInternalJiraProject(rawKey, rawName)) {
    const amdStudioProject = studioProjects.find(
      p =>
        p.id === 'proj-amd' ||
        normalizeProjectName(p.name).includes('amd internal') ||
        normalizeProjectName(p.name).includes('amd') ||
        p.key.toUpperCase() === 'AMD' ||
        p.key.toUpperCase() === 'AD'
    );
    if (amdStudioProject) {
      return { project: amdStudioProject, matchedBy: 'EXACT_NAME' };
    }
  }

  // 3. Exact Studio Project Name Match (case-insensitive)
  if (rawName) {
    const exactNameMatch = studioProjects.find(
      p => p.name.trim().toLowerCase() === rawName.toLowerCase() || normalizeProjectName(p.name) === normName
    );
    if (exactNameMatch) {
      return { project: exactNameMatch, matchedBy: 'EXACT_NAME' };
    }
  }

  // 4. Exact Key Match (e.g. key "WWE" or "MKTART")
  if (rawKey) {
    const exactKeyMatch = studioProjects.find(p => p.key.trim().toUpperCase() === rawKey);
    if (exactKeyMatch) {
      return { project: exactKeyMatch, matchedBy: 'EXACT_KEY' };
    }
  }

  // 5. Marketing Campaigns match
  if (
    rawKey === 'MKT' ||
    rawKey === 'MKTART' ||
    rawKey === 'UA' ||
    normName.includes('marketing') ||
    normName.includes('user acquisition') ||
    normName.includes('campaign')
  ) {
    const mktProject = studioProjects.find(
      p => p.id === 'proj-mkt' || normalizeProjectName(p.name).includes('marketing')
    );
    if (mktProject) {
      return { project: mktProject, matchedBy: 'MKT_ALIAS' };
    }
  }

  // 6. Live Ops Events match
  if (
    rawKey === 'OPS' ||
    rawKey === 'OPSART' ||
    rawKey === 'LIVEOPS' ||
    normName.includes('live ops') ||
    normName.includes('liveops') ||
    normName.includes('events')
  ) {
    const opsProject = studioProjects.find(
      p => p.id === 'proj-ops' || normalizeProjectName(p.name).includes('live ops') || normalizeProjectName(p.name).includes('liveops')
    );
    if (opsProject) {
      return { project: opsProject, matchedBy: 'OPS_ALIAS' };
    }
  }

  // 7. Token / Substring Similarity Match
  const jiraTokens = normName.split(' ').filter(t => t.length > 2 && !['art', 'the', 'project', 'game', 'team'].includes(t));
  if (jiraTokens.length > 0) {
    for (const proj of studioProjects) {
      const projNorm = normalizeProjectName(proj.name);
      const matchedTokens = jiraTokens.filter(tok => projNorm.includes(tok));
      if (matchedTokens.length >= Math.ceil(jiraTokens.length * 0.6)) {
        return { project: proj, matchedBy: 'TOKEN_SIMILARITY' };
      }
    }
  }

  // 8. Prevent duplicate or similar project creation: if a similar project exists, reuse it
  const effectiveName = rawName || (rawKey ? `Jira ${rawKey}` : 'Jira Project');
  const effectiveKey = rawKey || effectiveName.replace(/[^a-zA-Z]/g, '').substring(0, 6).toUpperCase() || 'JIRA';

  const conflict = findSimilarProject(effectiveName, effectiveKey, studioProjects);
  if (conflict) {
    return { project: conflict.project, matchedBy: 'EXACT_NAME' };
  }

  // If still not matched and autoCreateMissing is true, create a dedicated Studio project
  const newProjectId = `proj-jira-${effectiveKey.toLowerCase()}-${Date.now().toString(36)}`;

  const newProject: Project = {
    id: newProjectId,
    name: effectiveName,
    key: effectiveKey,
    description: `Synchronized from Jira Project [${effectiveName}] (${effectiveKey})`,
    ownerId: 'user-ranjeet',
    artManagerId: 'user-ranjeet',
    artDirectorId: 'user-marcus',
    startDate: new Date().toISOString().split('T')[0],
    targetEndDate: '2027-12-31',
    status: 'Active',
    priority: 'High',
    projectType: 'Game',
    taskCounter: 100,
    avatarColor: 'bg-blue-600',
    members: [
      { userId: 'user-ranjeet', accessLevel: 'MANAGER', assignedAt: new Date().toISOString() }
    ]
  };

  return {
    project: newProject,
    matchedBy: 'AUTO_CREATED',
    isNewProject: true
  };
}

/**
 * Resolves the correct Studio project for a task, correcting any misallocated legacy records.
 */
/**
 * Resolves the configured Jira project for a given Studio Project.
 * Ensures Studio -> Jira Push uses deterministic two-way mapping,
 * avoiding guessing or falling back to wrong default projects (e.g. HR/Admin or hardcoded WWE).
 */
export function resolveJiraProjectForStudioProject(
  studioProjectId: string,
  studioProjects: Project[],
  explicitMappings?: JiraProjectMapping[]
): {
  isMapped: boolean;
  jiraProjectKey?: string;
  jiraProjectName?: string;
  jiraProjectId?: string;
  error?: string;
} {
  const project = studioProjects.find(p => p.id === studioProjectId);

  // 1. Check configured persistent mappings
  if (explicitMappings && explicitMappings.length > 0) {
    const map = explicitMappings.find(
      m => m.studioProjectId === studioProjectId || (project && m.studioProjectName?.toLowerCase() === project.name.toLowerCase())
    );
    if (map && map.jiraProjectKey?.trim()) {
      return {
        isMapped: true,
        jiraProjectKey: map.jiraProjectKey.trim().toUpperCase(),
        jiraProjectName: map.jiraProjectName || project?.name,
        jiraProjectId: map.id || map.jiraProjectKey
      };
    }
  }

  // 2. Fallback check for flagship WWE Mayhem project (explicit alias)
  if (project) {
    const norm = normalizeProjectName(project.name);
    if (project.id === 'proj-wwe' || norm.includes('wwe mayhem') || norm === 'wwe' || project.key.toUpperCase() === 'WWEART' || project.key.toUpperCase() === 'WWE') {
      return {
        isMapped: true,
        jiraProjectKey: 'WWE',
        jiraProjectName: 'WWE Mayhem'
      };
    }

    if (project.id === 'proj-mkt' || norm.includes('marketing')) {
      return {
        isMapped: true,
        jiraProjectKey: 'MKT',
        jiraProjectName: 'Marketing Campaigns'
      };
    }

    if (project.id === 'proj-ops' || norm.includes('live ops') || norm.includes('liveops')) {
      return {
        isMapped: true,
        jiraProjectKey: 'OPS',
        jiraProjectName: 'Live Ops Events'
      };
    }

    if (project.id === 'proj-amd' || norm.includes('amd internal') || norm.includes('amd - internal') || norm.includes('amd') || project.key.toUpperCase() === 'AMD' || project.key.toUpperCase() === 'AD') {
      return {
        isMapped: true,
        jiraProjectKey: 'AMD',
        jiraProjectName: 'AMD - Internal'
      };
    }
  }

  // If no valid mapping is found, do NOT guess or construct blindly
  return {
    isMapped: false,
    error: `Studio project "${project?.name || studioProjectId}" is not mapped to any Jira Project. Please configure Jira Project Mapping in Settings.`
  };
}

/**
 * Resolves the correct Studio project for a task, correcting any misallocated legacy records.
 */
export function resolveStudioProjectForTask(
  task: Task,
  projects: Project[],
  explicitMappings?: JiraProjectMapping[]
): Project | undefined {
  // First check if current projectId points to a valid project
  const currentProject = projects.find(p => p.id === task.projectId);

  // If this is a Jira ticket, verify that the project matches the Jira issue project
  if (task.isJiraImported || task.jiraIssueKey) {
    const jiraKey = task.jiraProjectKey || getJiraProjectKeyFromIssueKey(task.jiraIssueKey);
    const jiraName = task.jiraProjectName;

    // Check if the current project is clearly wrong (e.g. WWE ticket assigned to HRAD or non-WWE project)
    if (isWweMayhemJiraProject(jiraKey, jiraName)) {
      const isCurrentWwe = currentProject && (
        currentProject.id === 'proj-wwe' ||
        normalizeProjectName(currentProject.name).includes('wwe') ||
        currentProject.key.toUpperCase() === 'WWEART' ||
        currentProject.key.toUpperCase() === 'WWE'
      );
      if (!isCurrentWwe) {
        // Find WWE project
        const wweProj = projects.find(
          p => p.id === 'proj-wwe' || normalizeProjectName(p.name).includes('wwe') || p.key.toUpperCase() === 'WWEART'
        );
        if (wweProj) return wweProj;
      }
    }

    // Check for AMD - Internal project
    if (isAmdInternalJiraProject(jiraKey, jiraName)) {
      const isCurrentAmd = currentProject && (
        currentProject.id === 'proj-amd' ||
        normalizeProjectName(currentProject.name).includes('amd') ||
        currentProject.key.toUpperCase() === 'AMD'
      );
      if (!isCurrentAmd) {
        const amdProj = projects.find(
          p => p.id === 'proj-amd' || normalizeProjectName(p.name).includes('amd internal') || p.key.toUpperCase() === 'AMD'
        );
        if (amdProj) return amdProj;
      }
    }

    if (currentProject) return currentProject;

    // If current project not found, match from Jira info
    const match = matchJiraToStudioProject(jiraKey, jiraName, projects, false, explicitMappings);
    return match.project;
  }

  return currentProject;
}
