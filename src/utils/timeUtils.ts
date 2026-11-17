import { toLocalDateString } from './dateUtils';

// RG ArtFlow Time & Work Duration Utilities (Weeks, Days, Hours, Minutes)
// Standard studio working week = 5 days (40 hours), 1 day = 8 hours, 1 hour = 60 minutes.

export const WORK_DAY_HOURS = 8;
export const WORK_WEEK_DAYS = 5;
export const WORK_WEEK_HOURS = WORK_WEEK_DAYS * WORK_DAY_HOURS; // 40 hours
export const HOUR_MINUTES = 60;
export const WORK_DAY_MINUTES = WORK_DAY_HOURS * HOUR_MINUTES; // 480 minutes
export const WORK_WEEK_MINUTES = WORK_WEEK_DAYS * WORK_DAY_MINUTES; // 2400 minutes

export interface ParsedDuration {
  weeks?: number;
  days: number;
  hours: number;
  minutes: number;
  totalHours: number;
  totalMinutes: number;
  formatted: string;
}

/**
 * Parses a flexible duration string containing weeks (w), days (d), hours (h), minutes (m).
 * Examples supported:
 * - "2w 4d 6h 45m" (Jira standard format)
 * - "1d 2h 30m", "1d 4h", "2d", "0.5d"
 * - "4h 15m", "3h", "1.5h"
 * - "45m", "90m"
 * - Plain decimal number: "2.5" -> interpreted as 2.5 hours
 */
export function parseDurationString(input: string | number): ParsedDuration {
  if (typeof input === 'number') {
    return hoursToParsedDuration(input);
  }

  const str = (input || '').trim().toLowerCase();
  if (!str) {
    return { weeks: 0, days: 0, hours: 0, minutes: 0, totalHours: 0, totalMinutes: 0, formatted: '0m' };
  }

  // If simple numeric string e.g. "3.5" or "2"
  if (/^(\d+(\.\d+)?)$/.test(str)) {
    const num = parseFloat(str);
    return hoursToParsedDuration(num);
  }

  let totalMinutes = 0;

  // Regex match weeks (e.g. 2w, 1.5w, 3 weeks)
  const weekMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:w|wk|wks|week|weeks)/);
  if (weekMatch) {
    const weeks = parseFloat(weekMatch[1]);
    totalMinutes += weeks * WORK_WEEK_MINUTES;
  }

  // Regex match days (e.g. 1d, 1.5d, 2 days)
  const dayMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:d|day|days)/);
  if (dayMatch) {
    const days = parseFloat(dayMatch[1]);
    totalMinutes += days * WORK_DAY_MINUTES;
  }

  // Regex match hours (e.g. 2h, 2.5h, 3 hrs, 1 hour)
  const hourMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)/);
  if (hourMatch) {
    const hours = parseFloat(hourMatch[1]);
    totalMinutes += hours * HOUR_MINUTES;
  }

  // Regex match minutes (e.g. 30m, 45 mins, 15 min)
  const minMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)/);
  if (minMatch) {
    const mins = parseFloat(minMatch[1]);
    totalMinutes += mins;
  }

  // If no unit matched but string has numbers, try extracting first number as hours
  if (!weekMatch && !dayMatch && !hourMatch && !minMatch) {
    const fallbackNum = parseFloat(str);
    if (!isNaN(fallbackNum)) {
      return hoursToParsedDuration(fallbackNum);
    }
  }

  totalMinutes = Math.max(0, Math.round(totalMinutes));
  const totalHours = Math.round((totalMinutes / HOUR_MINUTES) * 100) / 100;

  return minutesToParsedDuration(totalMinutes, totalHours);
}

export function hoursToParsedDuration(totalHours: number): ParsedDuration {
  const safeHours = Math.max(0, totalHours);
  const totalMinutes = Math.round(safeHours * HOUR_MINUTES);
  return minutesToParsedDuration(totalMinutes, safeHours);
}

export function minutesToParsedDuration(totalMinutes: number, totalHoursVal?: number): ParsedDuration {
  const totalHours = totalHoursVal !== undefined ? totalHoursVal : Math.round((totalMinutes / HOUR_MINUTES) * 100) / 100;
  
  const weeks = Math.floor(totalMinutes / WORK_WEEK_MINUTES);
  const remainingMinsAfterWeeks = totalMinutes % WORK_WEEK_MINUTES;
  const days = Math.floor(remainingMinsAfterWeeks / WORK_DAY_MINUTES);
  const remainingMinsAfterDays = remainingMinsAfterWeeks % WORK_DAY_MINUTES;
  const hours = Math.floor(remainingMinsAfterDays / HOUR_MINUTES);
  const minutes = remainingMinsAfterDays % HOUR_MINUTES;

  const parts: string[] = [];
  if (weeks > 0) parts.push(`${weeks}w`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);

  const formatted = parts.join(' ');

  return {
    weeks,
    days,
    hours,
    minutes,
    totalHours,
    totalMinutes,
    formatted
  };
}

/**
 * Formats hours into human-readable d, h, m (e.g. 10.5h -> "1d 2h 30m")
 */
export function formatDuration(hours: number): string {
  if (hours === 0 || !hours) return '0m';
  const parsed = hoursToParsedDuration(hours);
  return parsed.formatted;
}

/**
 * Formats duration with both d, h, m and total hours (e.g. "1d 2h 30m (10.5h)")
 */
export function formatDurationWithHours(hours: number): string {
  if (hours === 0 || !hours) return '0h';
  const parsed = hoursToParsedDuration(hours);
  if (parsed.days === 0 && parsed.minutes === 0) {
    return `${parsed.hours}h`;
  }
  return `${parsed.formatted} (${parsed.totalHours}h)`;
}

/**
 * Calculates Weekly Sprint Dates (Monday to Friday)
 */
export function getWeeklySprintDates(baseDate: Date = new Date(), weekOffset: number = 0): {
  startDate: string;
  endDate: string;
  displayRange: string;
  sprintName: string;
} {
  const d = new Date(baseDate);
  // Add week offset
  d.setDate(d.getDate() + (weekOffset * 7));

  // Determine Monday
  const day = d.getDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = day === 0 ? -6 : 1 - day; // Distance to Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  // Friday is Monday + 4 days
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);

  const startIso = toLocalDateString(monday);
  const endIso = toLocalDateString(friday);

  const monthName = monday.toLocaleString('en-US', { month: 'short' });
  const startDay = monday.getDate();
  const endDay = friday.getDate();
  const year = monday.getFullYear();

  const displayRange = `${monthName} ${startDay} - ${endDay}, ${year} (Mon-Fri)`;
  
  // Calculate ISO week number
  const firstDayOfYear = new Date(year, 0, 1);
  const pastDaysOfYear = (monday.getTime() - firstDayOfYear.getTime()) / 86400000;
  const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);

  return {
    startDate: startIso,
    endDate: endIso,
    displayRange,
    sprintName: `Sprint W${weekNum} (${monthName} ${startDay}-${endDay})`
  };
}
