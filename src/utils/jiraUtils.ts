// Helper utilities for Jira REST API authentication and proxy syncing

export interface JiraApiCredentials {
  hostUrl: string;
  email: string;
  apiToken: string;
}

export function cleanJiraHostUrl(url: string): string {
  let clean = (url || '').trim();
  if (!clean) return '';
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }
  return clean.replace(/\/+$/, '');
}

export function getJiraAuthHeader(email: string, apiToken: string): string {
  const token = Buffer.from(`${email.trim()}:${apiToken.trim()}`).toString('base64');
  return `Basic ${token}`;
}

export function formatHoursToJiraDuration(hours: number): string {
  if (!hours || hours <= 0) return '1m';
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}
