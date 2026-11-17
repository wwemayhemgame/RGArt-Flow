/**
 * Task Share Link & Deep Linking Utilities
 * Provides shareable URLs for studio tasks with optional full-screen immersive view.
 */

export interface ParsedTaskShareParams {
  taskId: string | null;
  isFullscreen: boolean;
}

/**
 * Generate a complete, sharable URL for a specific task.
 * @param taskId The ID or Jira key of the task
 * @param fullscreen Whether the task should open in full-screen focus mode (defaults to true)
 */
export function getTaskShareUrl(taskId: string, fullscreen: boolean = true): string {
  if (typeof window === 'undefined') return '';
  
  const url = new URL(window.location.href);
  // Clear any previous task-related params
  url.searchParams.delete('task');
  url.searchParams.delete('mode');
  
  url.searchParams.set('taskId', taskId);
  if (fullscreen) {
    url.searchParams.set('fullscreen', 'true');
  } else {
    url.searchParams.delete('fullscreen');
  }
  
  return url.toString();
}

/**
 * Copy the task's share link directly to clipboard.
 * Supports modern Clipboard API and fallback textarea execCommand.
 */
export async function copyTaskShareUrl(taskId: string, fullscreen: boolean = true): Promise<boolean> {
  const url = getTaskShareUrl(taskId, fullscreen);
  if (!url) return false;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    // Fall back to legacy execCommand
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = url;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Failed to copy task link to clipboard:', err);
    return false;
  }
}

/**
 * Parse current browser URL for task deep-linking and fullscreen query parameters.
 */
export function parseTaskShareParams(): ParsedTaskShareParams {
  if (typeof window === 'undefined') {
    return { taskId: null, isFullscreen: false };
  }

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#\/?/, ''));

  const taskId = searchParams.get('taskId') || searchParams.get('task') || hashParams.get('taskId') || hashParams.get('task');
  const fullscreenParam = searchParams.get('fullscreen') || searchParams.get('mode') || hashParams.get('fullscreen');
  
  const isFullscreen = fullscreenParam === 'true' || fullscreenParam === 'fullscreen' || fullscreenParam === '1';

  return {
    taskId: taskId ? taskId.trim() : null,
    isFullscreen
  };
}

/**
 * Update browser URL state without reloading the page.
 */
export function updateTaskUrlState(taskId: string | null, fullscreen: boolean = false): void {
  if (typeof window === 'undefined') return;

  try {
    const url = new URL(window.location.href);
    if (taskId) {
      url.searchParams.set('taskId', taskId);
      if (fullscreen) {
        url.searchParams.set('fullscreen', 'true');
      } else {
        url.searchParams.delete('fullscreen');
      }
    } else {
      url.searchParams.delete('taskId');
      url.searchParams.delete('task');
      url.searchParams.delete('fullscreen');
      url.searchParams.delete('mode');
    }
    window.history.replaceState({}, '', url.toString());
  } catch (err) {
    console.warn('Unable to update history state:', err);
  }
}
