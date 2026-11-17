// RG ArtFlow Date & Working Calendar Utilities

export const STUDIO_HOLIDAYS = [
  { date: '2026-09-07', name: 'Labor Day' },
  { date: '2026-10-12', name: 'Columbus / Indigenous Day' },
  { date: '2026-11-26', name: 'Thanksgiving Day' },
  { date: '2026-11-27', name: 'Studio Wellness Day' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-01-01', name: 'New Year Day' },
];

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

export function isHoliday(dateStr: string): boolean {
  return STUDIO_HOLIDAYS.some(h => h.date === dateStr);
}

export function isWorkingDay(date: Date): boolean {
  if (isWeekend(date)) return false;
  const iso = date.toISOString().split('T')[0];
  if (isHoliday(iso)) return false;
  return true;
}

export function addWorkingDays(startDate: Date, workingDaysToAdd: number): Date {
  const result = new Date(startDate);
  let daysAdded = 0;
  
  while (daysAdded < workingDaysToAdd) {
    result.setDate(result.getDate() + 1);
    if (isWorkingDay(result)) {
      daysAdded++;
    }
  }
  
  return result;
}

export function getWorkingDaysDifference(startDate: Date, endDate: Date): number {
  if (startDate > endDate) return 0;
  let current = new Date(startDate);
  let count = 0;
  while (current <= endDate) {
    if (isWorkingDay(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

// Parse date safely without timezone offset issues for YYYY-MM-DD
function parseLocalDate(dateString: string): Date {
  const trimmed = dateString.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateString);
}

export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return '—';
  try {
    const trimmed = String(dateString).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      const [y, m, d] = trimmed.split('T')[0].split(' ')[0].split('-').map(Number);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
      const monthStr = months[m - 1] || '';
      return `${monthStr} ${d}`;
    }
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString?: string | null): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return dateString;
  }
}

export function formatTimeAgo(dateString?: string | null): string {
  if (!dateString) return '—';
  try {
    const d = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    
    if (diffSec < 60) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return formatDate(dateString);
  } catch {
    return dateString;
  }
}

export function getTodayDateString(): string {
  return toLocalDateString(new Date());
}

export function isOverdue(dueDateString?: string | null, status?: string): boolean {
  if (!dueDateString || status === 'DONE' || status === 'DELIVERED') return false;
  const due = parseLocalDate(dueDateString);
  due.setHours(23, 59, 59, 999);
  const today = new Date();
  return due < today;
}

export function isDueToday(dueDateString?: string | null): boolean {
  if (!dueDateString) return false;
  const todayStr = getTodayDateString();
  return dueDateString.startsWith(todayStr);
}

export function getDaysRemaining(dueDateString?: string | null): number {
  if (!dueDateString) return 0;
  const due = parseLocalDate(dueDateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = due.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
