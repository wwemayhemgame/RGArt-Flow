import { Task, Project, Sprint, Artist, AdvancedFilterState, AdvancedFilterRule, AdvancedFilterFieldKey } from '../types';

export interface FilterContext {
  projects: Project[];
  sprints: Sprint[];
  artists: Artist[];
}

export function evaluateFilterRule(task: Task, rule: AdvancedFilterRule, ctx: FilterContext): boolean {
  const { field, operator, value, secondaryValue } = rule;
  const project = ctx.projects.find(p => p.id === task.projectId);
  const sprint = ctx.sprints.find(s => s.id === task.sprintId);
  const artist = ctx.artists.find(a => a.id === task.artistId);

  // Helper for text matching
  const matchText = (actual: string | undefined | null): boolean => {
    const act = (actual || '').trim().toLowerCase();
    const exp = String(value || '').trim().toLowerCase();
    if (!exp && (operator === 'equals' || operator === 'contains')) return true;

    switch (operator) {
      case 'equals':
        return act === exp;
      case 'not_equals':
        return act !== exp;
      case 'contains':
        return act.includes(exp);
      case 'not_contains':
        return !act.includes(exp);
      case 'starts_with':
        return act.startsWith(exp);
      case 'is_set':
        return Boolean(act);
      case 'is_not_set':
        return !act;
      default:
        return true;
    }
  };

  // Helper for number matching
  const matchNumber = (actual: number | undefined | null): boolean => {
    const act = actual ?? 0;
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) return true;

    switch (operator) {
      case 'equals':
        return act === num;
      case 'not_equals':
        return act !== num;
      case 'greater_than':
        return act > num;
      case 'less_than':
        return act < num;
      case 'greater_than_or_equal':
        return act >= num;
      case 'less_than_or_equal':
        return act <= num;
      case 'is_between': {
        const secNum = typeof secondaryValue === 'number' ? secondaryValue : parseFloat(String(secondaryValue));
        if (isNaN(secNum)) return act >= num;
        return act >= Math.min(num, secNum) && act <= Math.max(num, secNum);
      }
      case 'is_set':
        return actual !== undefined && actual !== null;
      case 'is_not_set':
        return actual === undefined || actual === null;
      default:
        return true;
    }
  };

  // Helper for date matching
  const matchDate = (dateStr?: string): boolean => {
    if (!dateStr) return operator === 'is_not_set';
    if (operator === 'is_set') return true;
    if (operator === 'is_not_set') return false;

    const taskDate = new Date(dateStr).getTime();
    if (isNaN(taskDate)) return false;

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (operator === 'last_7_days') {
      return taskDate >= (now - 7 * oneDay) && taskDate <= (now + oneDay);
    }
    if (operator === 'last_30_days') {
      return taskDate >= (now - 30 * oneDay) && taskDate <= (now + oneDay);
    }
    if (operator === 'this_month') {
      const d = new Date(dateStr);
      const cur = new Date();
      return d.getMonth() === cur.getMonth() && d.getFullYear() === cur.getFullYear();
    }

    const expStr = String(value || '').trim();
    if (!expStr) return true;

    switch (operator) {
      case 'equals':
        return dateStr.startsWith(expStr);
      case 'greater_than':
      case 'greater_than_or_equal':
        return dateStr >= expStr;
      case 'less_than':
      case 'less_than_or_equal':
        return dateStr <= expStr;
      default:
        return true;
    }
  };

  switch (field) {
    case 'jiraIssueKey': {
      const keyOrId = task.jiraIssueKey || task.id;
      return matchText(keyOrId) || matchText(task.jiraIssueKey);
    }
    case 'sprintNumber': {
      const spNum = task.jiraSprintNumber ?? sprint?.sprintNumber;
      return matchNumber(spNum);
    }
    case 'sprintName': {
      const spName = task.jiraSprintName || sprint?.name || '';
      return matchText(spName);
    }
    case 'updateNo': {
      const uNo = task.jiraUpdateNo || task.updateNo;
      // Also check title or tags
      if (uNo) {
        if (operator === 'equals' || operator === 'contains') {
          return matchText(uNo);
        }
        return matchNumber(parseFloat(uNo));
      }
      return matchText(task.title);
    }
    case 'jiraProject': {
      const jProj = task.jiraProjectName || task.jiraProjectKey || project?.name || '';
      return matchText(jProj) || matchText(task.jiraProjectKey);
    }
    case 'studioProject': {
      const pId = task.projectId;
      const pName = project?.name || '';
      const exp = String(value || '').trim().toLowerCase();
      if (operator === 'equals') {
        return pId.toLowerCase() === exp || pName.toLowerCase() === exp;
      }
      return matchText(pName) || matchText(pId);
    }
    case 'jiraStatus': {
      const jStat = task.jiraStatusName || task.status;
      return matchText(jStat);
    }
    case 'studioStatus': {
      return matchText(task.status);
    }
    case 'assignee': {
      const artName = artist?.name || task.jiraOriginalAssignee || '';
      const exp = String(value || '').trim().toLowerCase();
      if (operator === 'equals') {
        return (task.artistId && task.artistId.toLowerCase() === exp) || artName.toLowerCase() === exp;
      }
      return matchText(artName) || matchText(task.artistId);
    }
    case 'reporter': {
      const rep = task.jiraReporter || task.requesterId;
      return matchText(rep);
    }
    case 'storyPoints': {
      return matchNumber(task.storyPoints ?? task.jiraStoryPoints);
    }
    case 'priority': {
      return matchText(task.priority);
    }
    case 'issueType': {
      return matchText(task.jiraIssueType || task.taskType);
    }
    case 'labels': {
      const allLabels = [...(task.tags || []), ...(task.jiraLabels || [])];
      const exp = String(value || '').trim().toLowerCase();
      if (operator === 'contains' || operator === 'equals') {
        return allLabels.some(l => l.toLowerCase().includes(exp));
      }
      if (operator === 'not_contains') {
        return !allLabels.some(l => l.toLowerCase().includes(exp));
      }
      return true;
    }
    case 'originalEstimate': {
      return matchNumber(task.originalEstimate);
    }
    case 'timeLogged': {
      return matchNumber(task.timeLogged);
    }
    case 'remainingEstimate': {
      return matchNumber(task.remainingEstimate);
    }
    case 'createdDate': {
      return matchDate(task.createdDate || task.jiraCreatedDate);
    }
    case 'updatedDate': {
      return matchDate(task.lastJiraSyncAt || task.jiraUpdatedDate);
    }
    case 'dueDate': {
      return matchDate(task.dueDate || task.jiraDueDate);
    }
    default:
      return true;
  }
}

export function filterTasksWithAdvancedFilter(
  tasks: Task[],
  filterState: AdvancedFilterState | null | undefined,
  ctx: FilterContext
): Task[] {
  if (!filterState || !filterState.rules || filterState.rules.length === 0) {
    return tasks;
  }

  const { matchMode, rules } = filterState;
  const activeRules = rules.filter(r => r.field && (r.value !== '' || ['is_set', 'is_not_set', 'last_7_days', 'last_30_days', 'this_month'].includes(r.operator)));

  if (activeRules.length === 0) {
    return tasks;
  }

  const safeCtx: FilterContext = ctx || { projects: [], sprints: [], artists: [] };

  return tasks.filter(task => {
    if (matchMode === 'OR') {
      return activeRules.some(rule => evaluateFilterRule(task, rule, safeCtx));
    }
    // AND mode
    return activeRules.every(rule => evaluateFilterRule(task, rule, safeCtx));
  });
}

export function applyAdvancedFilters(
  tasks: Task[],
  filterState: AdvancedFilterState | null | undefined,
  ctx?: FilterContext
): Task[] {
  return filterTasksWithAdvancedFilter(tasks, filterState, ctx || { projects: [], sprints: [], artists: [] });
}

