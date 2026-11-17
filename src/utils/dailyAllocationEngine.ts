import {
  Artist,
  Project,
  Task,
  Sprint,
  ArtistDailyProjectAllocation,
  DailyProjectAllocationEntry,
  ManualDailyAllocationOverride,
  ArtistLeave,
  StudioSettings
} from '../types';
import { formatDate } from './dateUtils';

/**
 * Returns an array of ISO date strings (YYYY-MM-DD) for working days (Mon-Fri) in the given range.
 */
export function getWorkingDaysList(startDateStr: string, endDateStr: string, workDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']): string[] {
  if (!startDateStr || !endDateStr) return [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return [startDateStr];
  }

  const daysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const result: string[] = [];
  const current = new Date(start);

  while (current <= end) {
    const dayName = daysMap[current.getDay()];
    if (workDays.includes(dayName)) {
      result.push(current.toISOString().split('T')[0]);
    }
    current.setDate(current.getDate() + 1);
  }

  return result.length > 0 ? result : [startDateStr];
}

/**
 * Checks if an artist has an approved leave on a given date.
 */
export function getArtistDailyLeave(artist: Artist, dateStr: string): {
  isLeave: boolean;
  isHalfDay: boolean;
  leaveHours: number;
  leaveType?: string;
  leaveReason?: string;
} {
  const leaves = artist.leaveSchedule || [];
  const dailyCap = artist.dailyCapacity || 8;

  const matched = leaves.find(l => {
    const isApproved = l.status === 'Approved' || !l.status;
    if (!isApproved) return false;
    const start = l.startDate.split('T')[0];
    const end = (l.endDate || l.startDate).split('T')[0];
    return dateStr >= start && dateStr <= end;
  });

  if (!matched) {
    return { isLeave: false, isHalfDay: false, leaveHours: 0 };
  }

  const isHalf = matched.isHalfDay || matched.leaveType === 'Half Day' || (matched.hours !== undefined && matched.hours < dailyCap);
  const leaveHours = isHalf ? (matched.hours || dailyCap / 2) : dailyCap;

  return {
    isLeave: true,
    isHalfDay: isHalf,
    leaveHours,
    leaveType: matched.leaveType || (isHalf ? 'Half Day' : 'Full Day'),
    leaveReason: matched.reason || 'Approved Leave'
  };
}

/**
 * Calculates day-wise project allocations for artists across a date range.
 */
export function calculateDailyProjectAllocations({
  artists,
  projects,
  tasks,
  workingDays,
  manualOverrides = {},
  selectedProjectId = 'ALL',
  selectedArtistId = 'ALL',
  selectedSprintId
}: {
  artists: Artist[];
  projects: Project[];
  tasks: Task[];
  workingDays: string[];
  manualOverrides?: Record<string, ManualDailyAllocationOverride>;
  selectedProjectId?: string;
  selectedArtistId?: string;
  selectedSprintId?: string;
}): {
  rows: ArtistDailyProjectAllocation[];
  activeProjects: Project[];
} {
  // Filter artists (strictly Art Team production artists, excluding Requesters)
  const filteredArtists = artists.filter(a => {
    if (selectedArtistId !== 'ALL' && a.id !== selectedArtistId) return false;
    if (a.userRole === 'COMPANY_REQUESTER' || a.role === 'COMPANY_REQUESTER') return false;
    const r = (a.role || '').toLowerCase();
    const spec = (a.specialization || '').toLowerCase();
    if (r.includes('requester') || spec.includes('requester')) return false;
    return a.status !== 'Inactive';
  });

  const projectMap = new Map<string, Project>();
  projects.forEach(p => projectMap.set(p.id, p));

  const allAllocations: ArtistDailyProjectAllocation[] = [];
  const allocatedProjectIds = new Set<string>();

  // Filter tasks in scope
  const validTasks = tasks.filter(t => {
    const isDone = t.status === 'Completed' || t.status === 'DONE' || t.status === 'Cancelled';
    if (selectedSprintId && selectedSprintId !== 'ALL' && t.sprintId && t.sprintId !== selectedSprintId) {
      // Still include if time was logged
      if (isDone) return false;
    }
    return true;
  });

  filteredArtists.forEach(artist => {
    const dailyCap = artist.dailyCapacity || 8;
    const artistTasks = validTasks.filter(t => t.artistId === artist.id && t.status !== 'Cancelled');

    workingDays.forEach(dateStr => {
      const overrideKey = `${artist.id}_${dateStr}`;
      const manual = manualOverrides[overrideKey];
      const leaveInfo = getArtistDailyLeave(artist, dateStr);

      const availableCapacity = Math.max(0, dailyCap - leaveInfo.leaveHours);
      const isFullLeave = leaveInfo.isLeave && !leaveInfo.isHalfDay;

      let projectEntries: DailyProjectAllocationEntry[] = [];
      let totalPercentage = 0;
      let totalAllocatedHours = 0;

      if (isFullLeave) {
        // Full day leave - no project allocations
        projectEntries = [];
        totalPercentage = 0;
        totalAllocatedHours = 0;
      } else if (manual && manual.allocations && manual.allocations.length > 0) {
        // Use manual override
        projectEntries = manual.allocations.map(m => {
          const proj = projectMap.get(m.projectId);
          const pName = proj ? proj.name : m.projectId;
          const pKey = proj ? proj.key : undefined;
          const pct = Math.max(0, m.percentage);
          const hrs = Math.round(((pct / 100) * (availableCapacity || dailyCap)) * 10) / 10;
          allocatedProjectIds.add(m.projectId);

          return {
            projectId: m.projectId,
            projectName: pName,
            projectKey: pKey,
            percentage: pct,
            hours: hrs
          };
        });

        totalPercentage = projectEntries.reduce((sum, e) => sum + e.percentage, 0);
        totalAllocatedHours = Math.round(((totalPercentage / 100) * (availableCapacity || dailyCap)) * 10) / 10;
      } else if (availableCapacity > 0) {
        // Compute from actual assigned tasks for this artist
        // Tasks active on this date or assigned to this artist
        const activeTasks = artistTasks.filter(t => {
          if (t.status === 'Completed' || t.status === 'DONE') {
            // Include if due date is today or time was logged recently
            return t.dueDate === dateStr;
          }
          return true;
        });

        if (activeTasks.length > 0) {
          // Calculate project weight based on remaining estimate and priority
          const projWeights: Record<string, { hours: number; taskCount: number }> = {};
          
          activeTasks.forEach(t => {
            const pId = t.projectId || 'unassigned-project';
            const remHrs = t.remainingEstimate !== undefined ? t.remainingEstimate : (t.originalEstimate || 8);
            
            // Priority multiplier
            let priorityMult = 1.0;
            if (t.priority === 'Critical') priorityMult = 1.6;
            else if (t.priority === 'High') priorityMult = 1.3;
            else if (t.priority === 'Low') priorityMult = 0.8;

            // Due date urgency multiplier if task is due on or near this date
            let urgencyMult = 1.0;
            if (t.dueDate) {
              if (t.dueDate === dateStr) urgencyMult = 1.5;
              else if (t.dueDate < dateStr) urgencyMult = 1.8; // overdue
            }

            const effectiveWeight = Math.max(1, remHrs * priorityMult * urgencyMult);

            if (!projWeights[pId]) {
              projWeights[pId] = { hours: 0, taskCount: 0 };
            }
            projWeights[pId].hours += effectiveWeight;
            projWeights[pId].taskCount += 1;
          });

          const totalWeight = Object.values(projWeights).reduce((sum, w) => sum + w.hours, 0);

          if (totalWeight > 0) {
            // Allocate available capacity hours proportionally
            const entries: DailyProjectAllocationEntry[] = [];
            let allocatedSumPct = 0;

            const projIds = Object.keys(projWeights);
            projIds.forEach((pId, idx) => {
              const weight = projWeights[pId];
              const proj = projectMap.get(pId);
              const pName = proj ? proj.name : (pId === 'unassigned-project' ? 'General Tasks' : pId);
              
              // Raw percentage of available capacity
              let pct = Math.round((weight.hours / totalWeight) * 100);
              
              // On the last item, ensure sum matches 100% cleanly if it was close
              if (idx === projIds.length - 1 && projIds.length > 1) {
                const remainder = 100 - allocatedSumPct;
                if (Math.abs(remainder - pct) <= 5) {
                  pct = remainder;
                }
              }

              allocatedSumPct += pct;
              const hrs = Math.round(((pct / 100) * availableCapacity) * 10) / 10;
              allocatedProjectIds.add(pId);

              entries.push({
                projectId: pId,
                projectName: pName,
                projectKey: proj?.key,
                percentage: pct,
                hours: hrs,
                taskCount: weight.taskCount
              });
            });

            projectEntries = entries.filter(e => e.percentage > 0);
            totalPercentage = projectEntries.reduce((sum, e) => sum + e.percentage, 0);
            totalAllocatedHours = Math.round(((totalPercentage / 100) * availableCapacity) * 10) / 10;
          }
        } else if (artist.assignedProjects && artist.assignedProjects.length > 0) {
          // Fallback to primary assigned project if no explicit tasks
          const pId = artist.assignedProjects[0];
          const proj = projectMap.get(pId);
          allocatedProjectIds.add(pId);
          projectEntries = [
            {
              projectId: pId,
              projectName: proj ? proj.name : pId,
              projectKey: proj?.key,
              percentage: 100,
              hours: availableCapacity,
              taskCount: 0
            }
          ];
          totalPercentage = 100;
          totalAllocatedHours = availableCapacity;
        }
      }

      // Filter by selected project if specific project filter is active
      if (selectedProjectId !== 'ALL') {
        const matchesProj = projectEntries.some(e => e.projectId === selectedProjectId);
        if (!matchesProj && !isFullLeave) {
          // Still create row with 0% for this project if looking at all artists
        }
      }

      // Format date label (e.g. "Aug 31", "Mon, Aug 31")
      const dateObj = new Date(dateStr);
      const dayLabel = formatDate(dateStr);

      allAllocations.push({
        id: `alloc-${artist.id}-${dateStr}`,
        artistId: artist.id,
        artistName: artist.name,
        avatar: artist.avatar,
        date: dateStr,
        dayLabel,
        dailyCapacity: dailyCap,
        leaveHours: leaveInfo.leaveHours,
        isLeave: leaveInfo.isLeave,
        isHalfDayLeave: leaveInfo.isHalfDay,
        leaveType: leaveInfo.leaveType,
        leaveReason: leaveInfo.leaveReason,
        availableCapacity,
        allocations: projectEntries,
        totalPercentage,
        totalAllocatedHours,
        isManualOverride: !!manual,
        overrideNote: manual?.reason,
        updatedBy: manual?.updatedBy,
        updatedAt: manual?.updatedAt
      });
    });
  });

  // Dynamic project columns (projects that have allocations)
  const activeProjects = projects.filter(p => allocatedProjectIds.has(p.id));
  
  // If active projects is empty, show all available projects
  const finalProjects = activeProjects.length > 0 ? activeProjects : projects.slice(0, 5);

  return {
    rows: allAllocations,
    activeProjects: finalProjects
  };
}

/**
 * AI-Assisted Project Allocation Generator.
 * Suggests optimal daily project allocation percentages based on sprint workload,
 * task priorities, deadlines, artist skills, and leave.
 */
export function generateAiDailyAllocations({
  artists,
  projects,
  tasks,
  workingDays,
  settings,
  selectedSprint
}: {
  artists: Artist[];
  projects: Project[];
  tasks: Task[];
  workingDays: string[];
  settings?: StudioSettings;
  selectedSprint?: Sprint | null;
}): {
  recommendations: Array<{
    artistId: string;
    artistName: string;
    date: string;
    dayLabel: string;
    allocations: { projectId: string; projectName: string; percentage: number; hours: number }[];
    rationale: string;
  }>;
  skippedExcludedArtists: string[];
} {
  const excludedIds = new Set(settings?.aiExcludedArtistIds || []);
  const projectMap = new Map<string, Project>();
  projects.forEach(p => projectMap.set(p.id, p));

  const recommendations: Array<{
    artistId: string;
    artistName: string;
    date: string;
    dayLabel: string;
    allocations: { projectId: string; projectName: string; percentage: number; hours: number }[];
    rationale: string;
  }> = [];

  const skippedExcludedArtists: string[] = [];

  artists.forEach(artist => {
    if (artist.userRole === 'COMPANY_REQUESTER' || artist.role === 'COMPANY_REQUESTER') {
      skippedExcludedArtists.push(artist.name);
      return;
    }
    const r = (artist.role || '').toLowerCase();
    const spec = (artist.specialization || '').toLowerCase();
    if (r.includes('requester') || spec.includes('requester')) {
      skippedExcludedArtists.push(artist.name);
      return;
    }

    if (excludedIds.has(artist.id)) {
      skippedExcludedArtists.push(artist.name);
      return; // Skip AI auto-allocation for excluded users
    }

    const dailyCap = artist.dailyCapacity || 8;
    const artistTasks = tasks.filter(t => t.artistId === artist.id && t.status !== 'Completed' && t.status !== 'Cancelled');

    workingDays.forEach(dateStr => {
      const leaveInfo = getArtistDailyLeave(artist, dateStr);
      if (leaveInfo.isLeave && !leaveInfo.isHalfDay) {
        // Full day leave - no allocation suggested
        return;
      }

      const availableCap = Math.max(0, dailyCap - leaveInfo.leaveHours);
      if (availableCap <= 0) return;

      // Group active tasks by project
      const projTaskWeights: Record<string, { weight: number; count: number; criticalCount: number }> = {};

      artistTasks.forEach(t => {
        const pId = t.projectId || projects[0]?.id || 'default';
        const rem = t.remainingEstimate !== undefined ? t.remainingEstimate : (t.originalEstimate || 6);

        let prio = 1.0;
        if (t.priority === 'Critical') prio = 1.8;
        else if (t.priority === 'High') prio = 1.4;
        else if (t.priority === 'Medium') prio = 1.0;
        else prio = 0.7;

        let dueBoost = 1.0;
        if (t.dueDate) {
          if (t.dueDate <= dateStr) dueBoost = 1.6;
          else if (t.dueDate <= workingDays[workingDays.length - 1]) dueBoost = 1.2;
        }

        const score = rem * prio * dueBoost;

        if (!projTaskWeights[pId]) {
          projTaskWeights[pId] = { weight: 0, count: 0, criticalCount: 0 };
        }
        projTaskWeights[pId].weight += score;
        projTaskWeights[pId].count += 1;
        if (t.priority === 'Critical' || t.priority === 'High') {
          projTaskWeights[pId].criticalCount += 1;
        }
      });

      const totalWeight = Object.values(projTaskWeights).reduce((sum, w) => sum + w.weight, 0);

      if (totalWeight > 0) {
        const pIds = Object.keys(projTaskWeights);
        let sumPct = 0;
        const allocs: { projectId: string; projectName: string; percentage: number; hours: number }[] = [];

        pIds.forEach((pId, idx) => {
          const w = projTaskWeights[pId];
          const proj = projectMap.get(pId);
          const pName = proj ? proj.name : pId;

          let pct = Math.round((w.weight / totalWeight) * 100);
          if (idx === pIds.length - 1 && pIds.length > 1) {
            pct = Math.max(5, 100 - sumPct);
          }
          sumPct += pct;

          const hrs = Math.round(((pct / 100) * availableCap) * 10) / 10;
          allocs.push({
            projectId: pId,
            projectName: pName,
            percentage: pct,
            hours: hrs
          });
        });

        const topProj = allocs[0]?.projectName || 'Primary project';
        const rationale = leaveInfo.isHalfDay
          ? `Half-day leave (${leaveInfo.leaveHours}h). Prioritized ${topProj} (${allocs[0]?.percentage}%) for critical deliverables.`
          : `Optimized for ${artistTasks.length} active sprint deliverables. Weighted towards high-priority deadlines in ${topProj}.`;

        recommendations.push({
          artistId: artist.id,
          artistName: artist.name,
          date: dateStr,
          dayLabel: formatDate(dateStr),
          allocations: allocs,
          rationale
        });
      }
    });
  });

  return {
    recommendations,
    skippedExcludedArtists
  };
}
