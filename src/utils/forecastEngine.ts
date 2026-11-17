import { Artist, ArtistLeave, Sprint, Task, ArtCategory, Priority, DeliveryForecastResult } from '../types';
import { addWorkingDays, getTodayDateString, isWorkingDay } from './dateUtils';

export interface AiEffortEstimateResult {
  estimatedHours: number;
  storyPoints: number;
  confidence: 'High' | 'Medium' | 'Tentative';
  historicalSampleCount: number;
  avgHistoricalHours: number | null;
  explanation: string;
  matchedKeywords: string[];
}

const CATEGORY_BENCHMARK_HOURS: Record<ArtCategory, number> = {
  'Marketing Art': 14,
  'Character': 24,
  'Environment': 20,
  '3D Render': 18,
  'UI': 10,
  'Concept Art': 16,
  'Illustration': 16,
  'Icons': 6,
  'Animation': 22,
  'VFX': 16,
  'Social Media': 8,
  'Store Assets': 12,
  'Event Art': 14,
  'Promotional Art': 12,
  'Technical Art': 16,
  'Other': 10
};

/**
 * AI Effort Estimator:
 * Reads previous completed tasks by artists in the workspace, calculates historical averages per category,
 * analyzes task title and description complexity keywords, and factors in asset quantity.
 */
export function calculateAiEstimatedEffort(
  category: ArtCategory,
  title: string,
  description: string,
  quantity: number = 1,
  allTasks: Task[] = [],
  spRatio: number = 2
): AiEffortEstimateResult {
  // 1. Gather historical completed or logged tasks in this category
  const historicalMatchingTasks = allTasks.filter(t => {
    const isCompletedOrLogged = t.status === 'DONE' || (t.timeLogged && t.timeLogged > 0);
    return isCompletedOrLogged && t.taskType === category;
  });

  let baseHours = CATEGORY_BENCHMARK_HOURS[category] || 12;
  let historicalAvg: number | null = null;
  let confidence: 'High' | 'Medium' | 'Tentative' = 'Tentative';

  if (historicalMatchingTasks.length > 0) {
    const totalHours = historicalMatchingTasks.reduce((sum, t) => {
      const actual = (t.timeLogged && t.timeLogged > 0) ? t.timeLogged : t.originalEstimate;
      return sum + actual;
    }, 0);
    historicalAvg = Math.round((totalHours / historicalMatchingTasks.length) * 10) / 10;
    
    // Blend benchmark with historical average based on sample size
    const weight = Math.min(0.85, historicalMatchingTasks.length * 0.2);
    baseHours = Math.round((baseHours * (1 - weight) + historicalAvg * weight) * 10) / 10;
    confidence = historicalMatchingTasks.length >= 3 ? 'High' : 'Medium';
  }

  // 2. Keyword & Complexity NLP Analysis
  const combinedText = `${title} ${description}`.toLowerCase();
  const matchedKeywords: string[] = [];
  let complexityMultiplier = 1.0;

  // High complexity signals
  if (/hero|key art|splash|cover|championship|flagship|featured|cinematic/.test(combinedText)) {
    complexityMultiplier += 0.35;
    matchedKeywords.push('Hero / Key Art (+35%)');
  }
  if (/3d|render|sculpt|high poly|rig|rigging|skinning|texture pack/.test(combinedText)) {
    complexityMultiplier += 0.3;
    matchedKeywords.push('3D / High-Fidelity Asset (+30%)');
  }
  if (/animation|motion|frame by frame|vfx|particles|fx/.test(combinedText)) {
    complexityMultiplier += 0.25;
    matchedKeywords.push('Animation / FX Dynamics (+25%)');
  }
  if (/complete|overhaul|redesign|multi-character|full set|epic/.test(combinedText)) {
    complexityMultiplier += 0.2;
    matchedKeywords.push('Full Scope / Multi-element (+20%)');
  }

  // Low complexity / minor signals
  if (/icon|badge|minor|tweak|resize|crop|export|quick|variation|palette/.test(combinedText)) {
    complexityMultiplier -= 0.3;
    matchedKeywords.push('Lightweight / Variation (-30%)');
  }

  // 3. Asset Quantity Scaling (with bulk discount efficiency curve)
  const qty = Math.max(1, quantity);
  let quantityMultiplier = 1;
  if (qty > 1) {
    // 1 -> 1x, 2 -> 1.7x, 3 -> 2.4x, 4 -> 3.0x, 5 -> 3.6x
    quantityMultiplier = 1 + (qty - 1) * 0.7;
  }

  let finalEstimatedHours = Math.max(2, Math.round(baseHours * complexityMultiplier * quantityMultiplier));
  const storyPoints = Math.max(1, Math.round(finalEstimatedHours / spRatio));

  let explanation = '';
  if (historicalMatchingTasks.length > 0) {
    explanation = `AI calibrated from ${historicalMatchingTasks.length} previous completed ${category} task(s) by artists (avg ${historicalAvg}h).`;
  } else {
    explanation = `AI calibrated using studio benchmark model for ${category} (${baseHours}h baseline).`;
  }

  if (qty > 1) {
    explanation += ` Scaled for ${qty} asset(s).`;
  }

  return {
    estimatedHours: finalEstimatedHours,
    storyPoints,
    confidence,
    historicalSampleCount: historicalMatchingTasks.length,
    avgHistoricalHours: historicalAvg,
    explanation,
    matchedKeywords
  };
}

/**
 * Calculates effective daily capacity (hours) for an artist,
 * subtracting non-production allocation and daily meeting overhead if configured.
 * Default standard full-time capacity is 8h/day (40h/week).
 */
export function getArtistEffectiveDailyCapacity(artist: Artist): number {
  if (artist.status === 'Inactive') return 0;
  const baseDaily = artist.dailyCapacity || (artist.weeklyCapacity ? artist.weeklyCapacity / (artist.workingDays?.length || 5) : 8);
  const prodFactor = (artist.productionAllocation !== undefined && artist.productionAllocation !== null)
    ? artist.productionAllocation / 100
    : 1.0;
  const meetingHours = artist.meetingHoursWeekly || 0;
  const dailyMeetings = meetingHours / (artist.workingDays?.length || 5);
  const effective = (baseDaily * prodFactor) - dailyMeetings;
  return Math.max(0, Math.round(effective * 10) / 10);
}

/**
 * Calculates effective weekly capacity (hours) for an artist.
 * Standard full-time artist default is 40h/week (8h/day * 5 days).
 */
export function getArtistEffectiveWeeklyCapacity(artist: Artist): number {
  if (artist.status === 'Inactive') return 0;
  // If artist has standard 40h weekly capacity without meeting overhead or reduced allocation
  if (
    artist.weeklyCapacity &&
    (artist.productionAllocation === 100 || artist.productionAllocation === undefined) &&
    (!artist.meetingHoursWeekly || artist.meetingHoursWeekly === 0)
  ) {
    return artist.weeklyCapacity;
  }
  const daily = getArtistEffectiveDailyCapacity(artist);
  const daysCount = artist.workingDays?.length || 5;
  return Math.round(daily * daysCount * 10) / 10;
}

/**
 * Calculates scheduled leaves and time-off deduction for an artist within a specific sprint date range.
 * Only approved leaves (or legacy leaves with no status) reduce sprint capacity.
 */
export function getArtistSprintLeaveDetails(
  artist: Artist,
  sprint: { startDate: string; endDate: string }
): {
  sprintWorkingDays: number;
  leaveDaysCount: number;
  leaveHoursDeducted: number;
  overlappingLeaves: ArtistLeave[];
  isFullyOnLeave: boolean;
} {
  const dailyCap = artist.dailyCapacity || 8;
  const rawLeaves = artist.leaveSchedule || [];
  
  // Filter for approved leaves only (or legacy leaves where status is undefined)
  const approvedLeaves = rawLeaves.filter(
    l => !l.status || l.status === 'Approved'
  );

  if (!sprint.startDate || !sprint.endDate) {
    return { sprintWorkingDays: 5, leaveDaysCount: 0, leaveHoursDeducted: 0, overlappingLeaves: [], isFullyOnLeave: false };
  }

  const start = new Date(sprint.startDate);
  const end = new Date(sprint.endDate);
  
  let sprintWorkingDays = 0;
  let leaveDaysCount = 0;
  let leaveHoursDeducted = 0;
  const matchedLeaves = new Set<ArtistLeave>();

  let curr = new Date(start);
  while (curr <= end) {
    const dayStr = curr.toISOString().split('T')[0];
    const isWorkDay = isWorkingDay(curr);

    if (isWorkDay) {
      sprintWorkingDays++;
      // Check if this date falls within any approved scheduled leave
      const activeLeave = approvedLeaves.find(l => dayStr >= l.startDate && dayStr <= l.endDate);
      if (activeLeave) {
        matchedLeaves.add(activeLeave);
        if (activeLeave.isHalfDay || activeLeave.leaveType === 'Half Day') {
          leaveDaysCount += 0.5;
          leaveHoursDeducted += activeLeave.hours || (dailyCap / 2);
        } else {
          leaveDaysCount += 1;
          leaveHoursDeducted += activeLeave.hours || dailyCap;
        }
      }
    }
    curr.setDate(curr.getDate() + 1);
  }

  // Fallback if dates were invalid or 0
  if (sprintWorkingDays === 0) sprintWorkingDays = 5;

  leaveHoursDeducted = Math.round(leaveHoursDeducted * 10) / 10;
  const isFullyOnLeave = sprintWorkingDays > 0 && leaveDaysCount >= sprintWorkingDays;

  return {
    sprintWorkingDays,
    leaveDaysCount,
    leaveHoursDeducted,
    overlappingLeaves: Array.from(matchedLeaves),
    isFullyOnLeave
  };
}

/**
 * Calculates exact sprint capacity for an artist, properly accounting for
 * working days, daily capacity, and approved scheduled leaves during the sprint window.
 * Available Capacity = Working Capacity − Approved Leave Hours
 */
export function getArtistSprintCapacity(
  artist: Artist,
  sprint: { startDate: string; endDate: string },
  artistSprintTasks: Task[] = []
): {
  grossCapacityHours: number;
  leaveHoursDeducted: number;
  netAvailableHours: number;
  sprintWorkingDays: number;
  leaveDaysCount: number;
  committedHours: number;
  utilization: number;
  overlappingLeaves: ArtistLeave[];
  isFullyOnLeave: boolean;
} {
  if (artist.status === 'Inactive') {
    return {
      grossCapacityHours: 0,
      leaveHoursDeducted: 0,
      netAvailableHours: 0,
      sprintWorkingDays: 0,
      leaveDaysCount: 0,
      committedHours: 0,
      utilization: 0,
      overlappingLeaves: [],
      isFullyOnLeave: true
    };
  }

  const dailyCap = artist.dailyCapacity || 8;
  const leaveDetails = getArtistSprintLeaveDetails(artist, sprint);

  // Gross working capacity for the sprint window (Working Days in Sprint × Daily Working Hours)
  const grossCapacityHours = Math.round(leaveDetails.sprintWorkingDays * dailyCap * 10) / 10;
  const leaveHoursDeducted = leaveDetails.leaveHoursDeducted;

  // Available Sprint Capacity = Working Capacity − Approved Leave Hours
  const netAvailableHours = Math.max(0, Math.round((grossCapacityHours - leaveHoursDeducted) * 10) / 10);

  const committedHours = artistSprintTasks
    .filter(t => t.status !== 'DONE')
    .reduce((sum, t) => sum + (t.remainingEstimate ?? t.originalEstimate ?? 0), 0);

  const utilization = netAvailableHours > 0
    ? Math.round((committedHours / netAvailableHours) * 100)
    : (committedHours > 0 ? 100 : 0);

  return {
    grossCapacityHours,
    leaveHoursDeducted,
    netAvailableHours,
    sprintWorkingDays: leaveDetails.sprintWorkingDays,
    leaveDaysCount: leaveDetails.leaveDaysCount,
    committedHours,
    utilization,
    overlappingLeaves: leaveDetails.overlappingLeaves,
    isFullyOnLeave: leaveDetails.isFullyOnLeave
  };
}

/**
 * Helper to determine if an artist record belongs to an actual Art Team production resource,
 * strictly excluding external/company Requesters.
 */
export function isArtTeamProductionArtist(artist: Artist): boolean {
  if (!artist) return false;
  if (artist.userRole === 'COMPANY_REQUESTER' || artist.role === 'COMPANY_REQUESTER') return false;
  const r = (artist.role || '').toLowerCase();
  const spec = (artist.specialization || '').toLowerCase();
  if (r.includes('requester') || spec.includes('requester')) return false;
  return true;
}

/**
 * Calculates overall studio sprint capacity metrics factoring in all active artists,
 * gross hours, scheduled leaves & time-off deductions, and sprint task commitments.
 */
export function getSprintOverallMetrics(
  artists: Artist[],
  sprint: { startDate: string; endDate: string },
  sprintTasks: Task[]
): {
  totalGrossCapacity: number;
  totalLeaveDeductionHours: number;
  totalNetAvailableCapacity: number;
  totalCommittedHours: number;
  totalOriginalHours: number;
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  totalSP: number;
  completedSP: number;
  overallUtilization: number;
  artistsOnLeaveCount: number;
} {
  const activeArtists = artists.filter(a => a.status !== 'Inactive' && isArtTeamProductionArtist(a));
  
  let totalGrossCapacity = 0;
  let totalLeaveDeductionHours = 0;
  let totalNetAvailableCapacity = 0;
  let artistsOnLeaveCount = 0;

  activeArtists.forEach(artist => {
    const artistTasks = sprintTasks.filter(t => t.artistId === artist.id);
    const cap = getArtistSprintCapacity(artist, sprint, artistTasks);
    totalGrossCapacity += cap.grossCapacityHours;
    totalLeaveDeductionHours += cap.leaveHoursDeducted;
    totalNetAvailableCapacity += cap.netAvailableHours;
    if (cap.leaveDaysCount > 0) {
      artistsOnLeaveCount++;
    }
  });

  const totalTasks = sprintTasks.length;
  const completedTasks = sprintTasks.filter(t => t.status === 'DONE').length;
  const blockedTasks = sprintTasks.filter(t => t.status === 'BLOCKED').length;
  const totalCommittedHours = sprintTasks
    .filter(t => t.status !== 'DONE')
    .reduce((acc, t) => acc + (t.remainingEstimate ?? t.originalEstimate ?? 0), 0);
  const totalOriginalHours = sprintTasks.reduce((acc, t) => acc + (t.originalEstimate || 0), 0);
  const totalSP = sprintTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
  const completedSP = sprintTasks.filter(t => t.status === 'DONE').reduce((acc, t) => acc + (t.storyPoints || 0), 0);

  const overallUtilization = totalNetAvailableCapacity > 0
    ? Math.round((totalCommittedHours / totalNetAvailableCapacity) * 100)
    : 0;

  return {
    totalGrossCapacity: Math.round(totalGrossCapacity * 10) / 10,
    totalLeaveDeductionHours: Math.round(totalLeaveDeductionHours * 10) / 10,
    totalNetAvailableCapacity: Math.round(totalNetAvailableCapacity * 10) / 10,
    totalCommittedHours: Math.round(totalCommittedHours * 10) / 10,
    totalOriginalHours: Math.round(totalOriginalHours * 10) / 10,
    totalTasks,
    completedTasks,
    blockedTasks,
    totalSP,
    completedSP,
    overallUtilization,
    artistsOnLeaveCount
  };
}

/**
 * Calculates total remaining committed workload (hours) for an artist
 * across all uncompleted tasks.
 */
export function getArtistCommittedHours(artistId: string, tasks: Task[]): number {
  return tasks
    .filter(t => t.artistId === artistId && t.status !== 'DONE')
    .reduce((sum, t) => sum + (t.remainingEstimate ?? 0), 0);
}

/**
 * Calculates artist utilization percentage (0 - 150+%)
 */
export function getArtistUtilization(artist: Artist, tasks: Task[]): number {
  const weeklyCap = getArtistEffectiveWeeklyCapacity(artist);
  if (weeklyCap <= 0) return 0;
  const committed = getArtistCommittedHours(artist.id, tasks);
  return Math.round((committed / weeklyCap) * 100);
}

/**
 * Calculates skill matching score (0 to 100) between an art category and an artist
 */
export function getArtistSkillMatch(artist: Artist, category: ArtCategory, projectId?: string): number {
  const matchedSkill = artist.skills?.find(s => s.category === category);
  let baseScore = 50; // default base match if same art team
  
  if (matchedSkill) {
    baseScore = matchedSkill.rating * 19; // 5 -> 95%, 4 -> 76%, etc.
  } else {
    // Check if artist role matches category keywords
    const role = artist.role.toLowerCase();
    const cat = category.toLowerCase();
    if (role.includes('ui') && cat.includes('ui')) baseScore = 88;
    else if (role.includes('character') && cat.includes('character')) baseScore = 90;
    else if (role.includes('environment') && cat.includes('environment')) baseScore = 90;
    else if (role.includes('concept') && cat.includes('concept')) baseScore = 88;
    else if (role.includes('3d') && (cat.includes('3d') || cat.includes('render'))) baseScore = 92;
    else if (role.includes('illustrat') && (cat.includes('illustrat') || cat.includes('banner'))) baseScore = 88;
    else if (role.includes('marketing') && (cat.includes('marketing') || cat.includes('promotional') || cat.includes('social') || cat.includes('store'))) baseScore = 94;
    else if (role.includes('animat') && cat.includes('animat')) baseScore = 92;
    else if (role.includes('vfx') && cat.includes('vfx')) baseScore = 94;
  }

  // Bonus if project is assigned
  if (projectId && artist.assignedProjects?.includes(projectId)) {
    baseScore = Math.min(99, baseScore + 6);
  }

  return Math.min(99, Math.max(30, baseScore));
}

/**
 * Main Delivery Forecasting Engine:
 * Evaluates remaining estimate, artist queue, working capacity, leaves, and priorities
 * to output realistic start and delivery dates + recommended artist.
 */
export function calculateDeliveryForecast(
  category: ArtCategory,
  estimateHours: number,
  priority: Priority,
  artists: Artist[],
  tasks: Task[],
  projectId?: string
): DeliveryForecastResult {
  const activeArtists = artists.filter(a => a.status === 'Active' && isArtTeamProductionArtist(a));
  
  if (activeArtists.length === 0) {
    const today = new Date();
    const fallbackDate = addWorkingDays(today, 5).toISOString().split('T')[0];
    return {
      recommendedArtistId: '',
      recommendedArtistName: 'No active artists available',
      matchScore: 0,
      expectedStartDate: today.toISOString().split('T')[0],
      expectedCompletionDate: fallbackDate,
      expectedDeliveryDate: fallbackDate,
      confidence: 'Low',
      alternativeArtists: [],
      bottleneckWarning: 'All artists are inactive or on leave.'
    };
  }

  const artistEvaluations = activeArtists.map(artist => {
    const dailyCap = getArtistEffectiveDailyCapacity(artist);
    const currentQueue = getArtistCommittedHours(artist.id, tasks);
    const skillScore = getArtistSkillMatch(artist, category, projectId);
    
    // Calculate working days until artist can begin
    // For critical tasks, high-priority queue jumping can reduce start buffer
    let queueWorkingDays = Math.ceil(currentQueue / dailyCap);
    if (priority === 'Critical') {
      queueWorkingDays = Math.max(0, Math.floor(queueWorkingDays * 0.3)); // expedited
    } else if (priority === 'High') {
      queueWorkingDays = Math.max(1, Math.floor(queueWorkingDays * 0.7));
    }

    const today = new Date();
    let startDate = addWorkingDays(today, queueWorkingDays);
    
    // Check if artist has leave scheduled during this time
    if (artist.leaveSchedule && artist.leaveSchedule.length > 0) {
      for (const leave of artist.leaveSchedule) {
        const leaveStart = new Date(leave.startDate);
        const leaveEnd = new Date(leave.endDate);
        if (startDate >= leaveStart && startDate <= leaveEnd) {
          // Push start date past leave
          startDate = addWorkingDays(leaveEnd, 1);
        }
      }
    }

    // Days needed to finish task
    const taskWorkingDays = Math.max(1, Math.ceil(estimateHours / dailyCap));
    const completionDate = addWorkingDays(startDate, taskWorkingDays);
    
    // Composite ranking score (Higher = better recommendation)
    // Formula: Skill Score (45%) + Capacity availability (35%) + Earliest finish (20%)
    const queuePenalty = Math.min(40, (currentQueue / (dailyCap * 5)) * 30);
    const compositeScore = Math.round(skillScore * 0.55 + (100 - queuePenalty) * 0.45);

    return {
      artistId: artist.id,
      artistName: artist.name,
      matchScore: compositeScore,
      skillRating: Math.round((skillScore / 100) * 5),
      availableDailyHours: dailyCap,
      currentQueueHours: currentQueue,
      startDate: startDate.toISOString().split('T')[0],
      expectedCompletionDate: completionDate.toISOString().split('T')[0],
      expectedDeliveryDate: completionDate.toISOString().split('T')[0]
    };
  });

  // Sort by composite recommendation score descending
  artistEvaluations.sort((a, b) => {
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    return new Date(a.expectedDeliveryDate).getTime() - new Date(b.expectedDeliveryDate).getTime();
  });

  const best = artistEvaluations[0];
  const alternatives = artistEvaluations.slice(1, 4);

  // Confidence estimation
  let confidence: 'High' | 'Medium' | 'Low' = 'High';
  if (best.currentQueueHours > best.availableDailyHours * 5) {
    confidence = 'Medium';
  }
  if (best.currentQueueHours > best.availableDailyHours * 10 || best.matchScore < 60) {
    confidence = 'Low';
  }

  let bottleneckWarning: string | undefined;
  if (best.currentQueueHours > 35) {
    bottleneckWarning = `${best.artistName} currently has a large queue (${best.currentQueueHours}h committed). Delivery forecast accounts for queued tasks.`;
  }

  return {
    recommendedArtistId: best.artistId,
    recommendedArtistName: best.artistName,
    matchScore: best.matchScore,
    expectedStartDate: best.startDate,
    expectedCompletionDate: best.expectedCompletionDate,
    expectedDeliveryDate: best.expectedDeliveryDate,
    confidence,
    alternativeArtists: alternatives,
    bottleneckWarning
  };
}

/**
 * Calculates delivery date for an already assigned task
 */
export function calculateTaskExpectedDelivery(
  task: Task,
  artist: Artist | undefined,
  allArtistTasks: Task[]
): string {
  if (task.status === 'DONE' && task.actualDelivery) {
    return task.actualDelivery;
  }
  if (!artist || artist.status !== 'Active') {
    return task.dueDate || getTodayDateString();
  }

  const dailyCap = getArtistEffectiveDailyCapacity(artist);
  const remainingHours = task.remainingEstimate ?? task.originalEstimate ?? 8;
  
  // Find other active tasks assigned to this artist that are in progress or earlier in queue
  const otherTasks = allArtistTasks
    .filter(t => t.id !== task.id && t.artistId === artist.id && t.status !== 'DONE')
    .sort((a, b) => {
      // Prioritize IN_PROGRESS tasks first, then Critical, then High
      if (a.status === 'IN_PROGRESS' && b.status !== 'IN_PROGRESS') return -1;
      if (b.status === 'IN_PROGRESS' && a.status !== 'IN_PROGRESS') return 1;
      const prioOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      return (prioOrder[a.priority] ?? 2) - (prioOrder[b.priority] ?? 2);
    });

  // If this task is in progress, it's at the front of queue
  let priorQueueHours = 0;
  if (task.status !== 'IN_PROGRESS') {
    for (const t of otherTasks) {
      if (t.status === 'IN_PROGRESS') {
        priorQueueHours += (t.remainingEstimate ?? 0);
      } else if (task.priority === 'Low' && (t.priority === 'High' || t.priority === 'Critical')) {
        priorQueueHours += (t.remainingEstimate ?? 0);
      }
    }
  }

  const startWorkingDays = Math.ceil(priorQueueHours / dailyCap);
  const taskDays = Math.max(1, Math.ceil(remainingHours / dailyCap));
  
  const today = new Date();
  const finishDate = addWorkingDays(today, startWorkingDays + taskDays);
  return finishDate.toISOString().split('T')[0];
}
