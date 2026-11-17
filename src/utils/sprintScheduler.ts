import { Sprint, SprintStatus } from '../types';

/**
 * Standard Weekly Sprint Engine
 * Enforces Monday-Friday weekly sprints with 0 weekend work days.
 * 
 * Schedule Anchor:
 * - Sprint 1: 24 Aug 2026 → 28 Aug 2026 (Completed)
 * - Sprint 2: 31 Aug 2026 → 4 Sept 2026 (Active)
 * - Sprint 3: 7 Sept 2026 → 11 Sept 2026 (Planning / Auto-Active after Sprint 2)
 * - Sprint 4: 14 Sept 2026 → 18 Sept 2026
 * - Sprint 5: 21 Sept 2026 → 25 Sept 2026
 */

const MONTH_SHORT_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

export function formatSprintDateLabel(startIso: string, endIso: string): string {
  if (!startIso || !endIso) return '';
  const [y1, m1, d1] = startIso.split('T')[0].split('-').map(Number);
  const [y2, m2, d2] = endIso.split('T')[0].split('-').map(Number);
  if (!m1 || !d1 || !m2 || !d2) return '';

  const startMonth = MONTH_SHORT_NAMES[m1 - 1] || 'Aug';
  const endMonth = MONTH_SHORT_NAMES[m2 - 1] || 'Sept';

  if (startMonth === endMonth) {
    return `${d1} ${startMonth} – ${d2} ${startMonth}`;
  }
  return `${d1} ${startMonth} – ${d2} ${endMonth}`;
}

export function computeScheduledSprint(sprintNumber: number): {
  id: string;
  sprintNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  displayRange: string;
} {
  // Base is Monday Aug 24, 2026: Year 2026, Month 7 (0-indexed August), Day 24
  // Using pure UTC timestamps ensures 0 timezone offset bugs in any local environment
  const baseUtc = Date.UTC(2026, 7, 24);
  const weekOffsetMs = (sprintNumber - 1) * 7 * 86400000;
  const startUtc = new Date(baseUtc + weekOffsetMs);
  const endUtc = new Date(baseUtc + weekOffsetMs + 4 * 86400000); // Monday + 4 days = Friday

  const startYear = startUtc.getUTCFullYear();
  const startMonth = startUtc.getUTCMonth() + 1;
  const startDay = startUtc.getUTCDate();

  const endYear = endUtc.getUTCFullYear();
  const endMonth = endUtc.getUTCMonth() + 1;
  const endDay = endUtc.getUTCDate();

  const startIso = `${startYear}-${String(startMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
  const endIso = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
  const dateRangeStr = formatSprintDateLabel(startIso, endIso);

  return {
    id: `sprint-${sprintNumber}`,
    sprintNumber,
    name: `Sprint ${sprintNumber} (${dateRangeStr})`,
    startDate: startIso,
    endDate: endIso,
    displayRange: `${dateRangeStr} (Mon–Fri)`
  };
}

/**
 * Ensures standard initial weekly sprint list exists and has correct Monday-to-Friday schedules.
 */
export function getStandardWeeklySprints(): Sprint[] {
  return [
    {
      id: 'sprint-1',
      sprintNumber: 1,
      name: 'Sprint 1 (24 Aug – 28 Aug)',
      startDate: '2026-08-24',
      endDate: '2026-08-28',
      goal: 'Deliver core SummerSlam UI elements, Roman Reigns 3D polish, and App Store banners.',
      status: 'Completed',
      capacityHoursTotal: 680,
      committedHoursTotal: 44
    },
    {
      id: 'sprint-2',
      sprintNumber: 2,
      name: 'Sprint 2 (31 Aug – 4 Sept)',
      startDate: '2026-08-31',
      endDate: '2026-09-04',
      goal: 'Weekly sprint planning for upcoming liveops releases and store promotions.',
      status: 'Active',
      capacityHoursTotal: 680,
      committedHoursTotal: 44
    },
    {
      id: 'sprint-3',
      sprintNumber: 3,
      name: 'Sprint 3 (7 Sept – 11 Sept)',
      startDate: '2026-09-07',
      endDate: '2026-09-11',
      goal: 'Weekly art sprint focused on tournament graphics and seasonal refresh.',
      status: 'Planning',
      capacityHoursTotal: 680,
      committedHoursTotal: 0
    },
    {
      id: 'sprint-4',
      sprintNumber: 4,
      name: 'Sprint 4 (14 Sept – 18 Sept)',
      startDate: '2026-09-14',
      endDate: '2026-09-18',
      goal: 'Weekly art sprint for character skins, UI assets, and promotional banners.',
      status: 'Planning',
      capacityHoursTotal: 680,
      committedHoursTotal: 0
    }
  ];
}

/**
 * Normalizes sprint dates across existing sprints to guarantee Sprint 1 is 24 Aug - 28 Aug,
 * Sprint 2 is 31 Aug - 4 Sept, Sprint 3 is 7 Sept - 11 Sept, and handles automatic activation transitions.
 */
export function normalizeSprintSchedule(existingSprints: Sprint[]): {
  sprints: Sprint[];
  hasChanges: boolean;
} {
  if (!existingSprints || existingSprints.length === 0) {
    return { sprints: getStandardWeeklySprints(), hasChanges: true };
  }

  let hasChanges = false;
  const standardList = getStandardWeeklySprints();
  const sprintMap = new Map<number, Sprint>();

  existingSprints.forEach(s => {
    // Determine numerical sprint index
    let num = s.sprintNumber;
    if (!num) {
      const match = s.name.match(/(?:Sprint|W)\s*#?(\d+)/i) || s.id.match(/(?:sprint|w)-?(\d+)/i);
      if (match) num = parseInt(match[1], 10);
      else num = 2;
    }
    // Remap old W35 -> Sprint 1, W36 -> Sprint 2, W37 -> Sprint 3
    if (num === 35) num = 1;
    if (num === 36) num = 2;
    if (num === 37) num = 3;
    if (num === 38) num = 4;

    sprintMap.set(num, { ...s, sprintNumber: num });
  });

  // Ensure minimum baseline sprints (1 to 4) exist
  for (let num = 1; num <= 4; num++) {
    if (!sprintMap.has(num)) {
      const std = standardList.find(s => s.sprintNumber === num);
      if (std) {
        sprintMap.set(num, std);
        hasChanges = true;
      }
    }
  }

  // Check and align dates for all sprints
  const updatedSprints: Sprint[] = Array.from(sprintMap.values()).map(s => {
    const scheduled = computeScheduledSprint(s.sprintNumber);
    let updated = { ...s };

    // Standardize IDs for sprint 1, 2, 3, 4
    if (s.id === 'sprint-w35' || s.id === 'sprint-35') {
      updated.id = 'sprint-1';
      hasChanges = true;
    } else if (s.id === 'sprint-w36' || s.id === 'sprint-36') {
      updated.id = 'sprint-2';
      hasChanges = true;
    } else if (s.id === 'sprint-w37' || s.id === 'sprint-37') {
      updated.id = 'sprint-3';
      hasChanges = true;
    }

    if (updated.startDate !== scheduled.startDate || updated.endDate !== scheduled.endDate) {
      updated.startDate = scheduled.startDate;
      updated.endDate = scheduled.endDate;
      hasChanges = true;
    }

    // Ensure sprint name is cleanly formatted with correct dates
    if (updated.name !== scheduled.name) {
      updated.name = scheduled.name;
      hasChanges = true;
    }

    return updated;
  });

  // Sort by sprint number
  updatedSprints.sort((a, b) => a.sprintNumber - b.sprintNumber);

  // Enforce single active sprint & correct historical sprint statuses
  // Sprint 1 (24 Aug – 28 Aug) is completed in standard history
  const sprint1 = updatedSprints.find(s => s.sprintNumber === 1);
  if (sprint1 && sprint1.status === 'Active') {
    sprint1.status = 'Completed';
    hasChanges = true;
  }

  // Count active sprints; ensure only the highest completed + 1 (or current active) is Active
  const activeSprints = updatedSprints.filter(s => s.status === 'Active');
  if (activeSprints.length > 1) {
    // Keep the earliest unfinished sprint as Active, set subsequent ones to Planning
    let firstActiveSeen = false;
    for (const s of updatedSprints) {
      if (s.status === 'Active') {
        if (!firstActiveSeen) {
          firstActiveSeen = true;
        } else {
          s.status = 'Planning';
          hasChanges = true;
        }
      }
    }
  }

  // Check automatic progression:
  // If Sprint 2 is Completed and Sprint 3 is still Planning, automatically activate Sprint 3
  const sprint2 = updatedSprints.find(s => s.sprintNumber === 2);
  const sprint3 = updatedSprints.find(s => s.sprintNumber === 3);

  if (sprint2 && sprint2.status === 'Completed' && sprint3 && sprint3.status === 'Planning') {
    sprint3.status = 'Active';
    hasChanges = true;
  }

  // Ensure there is at least one active sprint if any are in progress
  const hasActive = updatedSprints.some(s => s.status === 'Active');
  if (!hasActive && sprint2 && sprint2.status !== 'Completed') {
    sprint2.status = 'Active';
    hasChanges = true;
  }

  return { sprints: updatedSprints, hasChanges };
}

