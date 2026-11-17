/**
 * Centralized Firestore Usage Tracker & Quota Monitor
 * Tracks daily reads, writes, deletes, active realtime listeners,
 * Jira sync writes, and query frequency to prevent quota exhaustion.
 */

export interface ActiveListenerInfo {
  id: string;
  collection: string;
  description: string;
  startedAt: string;
}

export interface FirestoreDailyStats {
  date: string; // YYYY-MM-DD
  readsToday: number;
  writesToday: number;
  deletesToday: number;
  jiraSyncWritesToday: number;
  readsByCollection: Record<string, number>;
  writesByCollection: Record<string, number>;
  deletesByCollection: Record<string, number>;
  queriesByCollection: Record<string, number>;
}

// Spark Plan Free Daily Quota Limits
export const FIRESTORE_QUOTA_LIMITS = {
  DAILY_READS: 50000,
  DAILY_WRITES: 20000,
  DAILY_DELETES: 20000,
  WARNING_THRESHOLD_PERCENT: 80, // Warn at 80%
  DANGER_THRESHOLD_PERCENT: 95   // Danger at 95%
} as const;

const STORAGE_KEY_USAGE_PREFIX = 'artops_firestore_usage_';
const activeListenersMap = new Map<string, ActiveListenerInfo>();
const usageSubscribers = new Set<(stats: FirestoreDailyStats) => void>();

function getTodayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Load today's usage stats from localStorage
 */
export function getDailyStats(): FirestoreDailyStats {
  const today = getTodayString();
  const raw = localStorage.getItem(`${STORAGE_KEY_USAGE_PREFIX}${today}`);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      // fallback
    }
  }

  const initial: FirestoreDailyStats = {
    date: today,
    readsToday: 0,
    writesToday: 0,
    deletesToday: 0,
    jiraSyncWritesToday: 0,
    readsByCollection: {},
    writesByCollection: {},
    deletesByCollection: {},
    queriesByCollection: {}
  };
  return initial;
}

/**
 * Persist stats to localStorage and notify subscribers
 */
function saveStats(stats: FirestoreDailyStats): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_USAGE_PREFIX}${stats.date}`, JSON.stringify(stats));
  } catch (e) {
    console.warn('[Firestore Usage Tracker] Could not persist daily stats:', e);
  }

  usageSubscribers.forEach(cb => {
    try { cb(stats); } catch {}
  });
}

/**
 * Record document reads (single or batch)
 */
export function recordFirestoreRead(collectionName: string, count: number = 1, isRealtime: boolean = false): void {
  if (count <= 0) return;
  const stats = getDailyStats();
  stats.readsToday += count;
  stats.readsByCollection[collectionName] = (stats.readsByCollection[collectionName] || 0) + count;
  stats.queriesByCollection[collectionName] = (stats.queriesByCollection[collectionName] || 0) + 1;
  saveStats(stats);

  if (stats.readsToday >= FIRESTORE_QUOTA_LIMITS.DAILY_READS * (FIRESTORE_QUOTA_LIMITS.WARNING_THRESHOLD_PERCENT / 100)) {
    console.warn(`[Firestore Quota Warning] Approaching daily read limit: ${stats.readsToday} / ${FIRESTORE_QUOTA_LIMITS.DAILY_READS}`);
  }
}

/**
 * Record document write
 */
export function recordFirestoreWrite(collectionName: string, isJiraSync: boolean = false): void {
  const stats = getDailyStats();
  stats.writesToday += 1;
  stats.writesByCollection[collectionName] = (stats.writesByCollection[collectionName] || 0) + 1;
  if (isJiraSync) {
    stats.jiraSyncWritesToday += 1;
  }
  saveStats(stats);

  if (stats.writesToday >= FIRESTORE_QUOTA_LIMITS.DAILY_WRITES * (FIRESTORE_QUOTA_LIMITS.WARNING_THRESHOLD_PERCENT / 100)) {
    console.warn(`[Firestore Quota Warning] Approaching daily write limit: ${stats.writesToday} / ${FIRESTORE_QUOTA_LIMITS.DAILY_WRITES}`);
  }
}

/**
 * Record document deletes
 */
export function recordFirestoreDelete(collectionName: string, count: number = 1): void {
  if (count <= 0) return;
  const stats = getDailyStats();
  stats.deletesToday += count;
  stats.deletesByCollection[collectionName] = (stats.deletesByCollection[collectionName] || 0) + count;
  saveStats(stats);
}

/**
 * Record query execution
 */
export function recordFirestoreQuery(collectionName: string): void {
  const stats = getDailyStats();
  stats.queriesByCollection[collectionName] = (stats.queriesByCollection[collectionName] || 0) + 1;
  saveStats(stats);
}

/**
 * Register an active realtime snapshot listener
 */
export function registerActiveListener(id: string, collectionName: string, description: string): () => void {
  const info: ActiveListenerInfo = {
    id,
    collection: collectionName,
    description,
    startedAt: new Date().toISOString()
  };
  activeListenersMap.set(id, info);

  return () => {
    activeListenersMap.delete(id);
  };
}

/**
 * Get all currently active realtime listeners
 */
export function getActiveListeners(): ActiveListenerInfo[] {
  return Array.from(activeListenersMap.values());
}

/**
 * Subscribe to usage updates
 */
export function subscribeToUsageStats(callback: (stats: FirestoreDailyStats) => void): () => void {
  usageSubscribers.add(callback);
  callback(getDailyStats());
  return () => usageSubscribers.delete(callback);
}

/**
 * Reset today's stats (for testing or manual counter reset)
 */
export function resetDailyUsageStats(): void {
  const today = getTodayString();
  const resetStats: FirestoreDailyStats = {
    date: today,
    readsToday: 0,
    writesToday: 0,
    deletesToday: 0,
    jiraSyncWritesToday: 0,
    readsByCollection: {},
    writesByCollection: {},
    deletesByCollection: {},
    queriesByCollection: {}
  };
  saveStats(resetStats);
}
