import { Task, StudioSettings, Sprint } from '../types';

export interface ResolvedJiraMetadata {
  parentKey?: string;
  parentSummary?: string;
  parentType?: string;
  parentUrl?: string | null;
  sprintId?: string;
  sprintName?: string;
  sprintNumber?: number;
  fixVersion?: string;
  fixVersions: string[];
}

/**
 * Resolves Jira Parent, Sprint, and Fix Version metadata from a Task with deep fallbacks.
 * Handles Jira Cloud, Jira Server/Data Center formats, Epic Link strings, and inherited parent details.
 */
export function resolveJiraMetadata(
  task: Partial<Task>,
  settings?: StudioSettings,
  sprint?: Sprint
): ResolvedJiraMetadata {
  // ==========================================
  // 1. PARENT RESOLUTION
  // ==========================================
  let parentKey: string | undefined = task.jiraParentKey || (task as any).parentKey || (task as any).parentIssueKey;
  let parentSummary: string | undefined = task.jiraParentSummary || (task as any).parentSummary;
  let parentType: string | undefined = task.jiraParentType || (task as any).parentType;

  // Fallback A: Check task.epic (e.g. "AMDI-17191 Update_94_Game Show Event" or "AMDI-17191")
  if (!parentKey && task.epic) {
    const epicStr = task.epic.trim();
    // Matches "AMDI-17191", "AMDI-17191: Summary", "AMDI-17191 Update_94_Game Show Event", etc.
    const keyMatch = epicStr.match(/^([A-Z0-9]+-\d+)(?:\s*[:–-]?\s*(.*))?$/i);
    if (keyMatch) {
      parentKey = keyMatch[1].toUpperCase();
      if (!parentSummary && keyMatch[2]) {
        parentSummary = keyMatch[2].trim();
      }
      if (!parentType) {
        parentType = 'Epic';
      }
    } else {
      if (!parentSummary) parentSummary = epicStr;
    }
  }

  // Fallback B: Check task.title or task.description for parent key references (e.g. "AMDI-17191")
  if (!parentKey) {
    const textToSearch = `${task.title || ''} ${task.description || ''}`;
    const pMatch = textToSearch.match(/\b([A-Z0-9]+-\d+)\b/);
    if (pMatch && pMatch[1] !== task.jiraIssueKey) {
      parentKey = pMatch[1].toUpperCase();
      if (!parentType) parentType = 'Parent';
    }
  }

  // Parent URL
  const hostUrl = settings?.jiraConfig?.hostUrl;
  let parentUrl: string | null = null;
  if (parentKey) {
    if (hostUrl) {
      parentUrl = `${hostUrl.replace(/\/$/, '')}/browse/${parentKey}`;
    } else if (task.jiraSelfUrl && task.jiraIssueKey) {
      parentUrl = task.jiraSelfUrl.replace(task.jiraIssueKey, parentKey);
    }
  }

  // ==========================================
  // 2. SPRINT RESOLUTION
  // ==========================================
  let sprintId: string | undefined = task.jiraSprintId;
  let sprintName: string | undefined = task.jiraSprintName;
  let sprintNumber: number | undefined = task.jiraSprintNumber;

  // If sprintId is missing, check sprintNumber
  if (!sprintId && sprintNumber) {
    sprintId = String(sprintNumber);
  }

  // Fallback A: Extract sprint number and name from task.jiraSprintName (e.g. "AMD Sprint 17" or "AMD Sprint 17 +4")
  if (sprintName) {
    const numMatch = sprintName.match(/(\d+)/);
    if (numMatch) {
      const parsedNum = parseInt(numMatch[1], 10);
      if (!sprintNumber) sprintNumber = parsedNum;
      if (!sprintId) sprintId = String(parsedNum);
    }
  }

  // Fallback B: Check linked Studio sprint
  if (!sprintId && sprint) {
    if ((sprint as any).jiraSprintId) {
      sprintId = String((sprint as any).jiraSprintId);
    } else if (sprint.sprintNumber) {
      sprintNumber = sprint.sprintNumber;
      sprintId = String(sprint.sprintNumber);
    }
    if (!sprintName && sprint.name) {
      sprintName = sprint.name;
    }
  }

  // Fallback C: Check task.sprintId string format (e.g. "sprint-17")
  if (!sprintId && task.sprintId && typeof task.sprintId === 'string') {
    const sMatch = task.sprintId.match(/(?:sprint[-_]?)(\d+)/i);
    if (sMatch) {
      const parsedNum = parseInt(sMatch[1], 10);
      if (!sprintNumber) sprintNumber = parsedNum;
      sprintId = String(parsedNum);
      if (!sprintName) sprintName = `Sprint ${parsedNum}`;
    }
  }

  // ==========================================
  // 3. FIX VERSION RESOLUTION
  // ==========================================
  const fixVersionsList: string[] = [];
  if (Array.isArray(task.jiraFixVersions)) {
    task.jiraFixVersions.forEach(v => {
      if (v && typeof v === 'string' && v.trim()) fixVersionsList.push(v.trim());
    });
  }

  let fixVersion: string | undefined = task.jiraFixVersion || fixVersionsList[0] || task.fixVersion;

  // Fallback A: Check update numbers (e.g. "94" -> "Update 94")
  if (!fixVersion) {
    const uNo = task.jiraUpdateNo || task.updateNo;
    if (uNo) {
      fixVersion = `Update ${uNo}`;
    }
  }

  // Fallback B: Check parent summary (e.g. "Update_94_Game Show Event" or "Update 94")
  if (!fixVersion && parentSummary) {
    const pMatch = parentSummary.match(/(?:Update|Ver|v)[_ -]?(\d+(?:\.\d+)?)/i);
    if (pMatch) {
      fixVersion = `Update ${pMatch[1]}`;
    }
  }

  // Fallback C: Check task title (e.g. "[Update 94]..." or "[New Event Type]...")
  if (!fixVersion && task.title) {
    const tMatch = task.title.match(/(?:Update|Ver|v)[_ -]?(\d+(?:\.\d+)?)/i);
    if (tMatch) {
      fixVersion = `Update ${tMatch[1]}`;
    }
  }

  // Fallback D: Check task labels
  if (!fixVersion && Array.isArray(task.jiraLabels)) {
    for (const lbl of task.jiraLabels) {
      const lMatch = lbl.match(/(?:Update|U|Ver|v)[_ -]?(\d+(?:\.\d+)?)/i);
      if (lMatch) {
        fixVersion = `Update ${lMatch[1]}`;
        break;
      }
    }
  }

  if (fixVersion && !fixVersionsList.includes(fixVersion)) {
    fixVersionsList.unshift(fixVersion);
  }

  return {
    parentKey,
    parentSummary,
    parentType,
    parentUrl,
    sprintId,
    sprintName,
    sprintNumber,
    fixVersion,
    fixVersions: fixVersionsList
  };
}
