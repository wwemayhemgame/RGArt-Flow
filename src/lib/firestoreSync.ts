import { db } from './firebase';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  query,
  limit,
  orderBy,
  where,
  QueryConstraint,
  Unsubscribe
} from 'firebase/firestore';
import {
  recordFirestoreRead,
  recordFirestoreWrite,
  recordFirestoreDelete,
  registerActiveListener
} from './firestoreUsageTracker';
import {
  Task,
  Project,
  Sprint,
  Artist,
  CompanyRequest,
  TimeEntry,
  ActivityLog,
  AccessAuditRecord,
  AppNotification,
  StudioSettings,
  StudioMail,
  User
} from '../types';

// Collection Constants
export const COLLECTIONS = {
  USERS: 'studio_users',
  TASKS: 'studio_tasks',
  PROJECTS: 'studio_projects',
  SPRINTS: 'studio_sprints',
  ARTISTS: 'studio_artists',
  REQUESTS: 'studio_requests',
  TIME_ENTRIES: 'studio_time_entries',
  ACTIVITY_LOGS: 'studio_activity_logs',
  AUDIT_LOGS: 'studio_audit_logs',
  NOTIFICATIONS: 'studio_notifications',
  SETTINGS: 'studio_settings',
  MAILS: 'studio_mails'
} as const;

export interface SubscribeOptions {
  limitCount?: number;
  orderByField?: string;
  orderDirection?: 'asc' | 'desc';
  description?: string;
}

let _isQuotaExceeded = false;
const quotaListeners = new Set<(exceeded: boolean) => void>();

/**
 * In-memory document cache to detect identical writes and skip redundant network calls
 */
const documentCache = new Map<string, any>();

/**
 * Update in-memory document cache
 */
export function setCachedDoc(collectionName: string, id: string, data: any): void {
  documentCache.set(`${collectionName}:${id}`, JSON.parse(JSON.stringify(data)));
}

/**
 * Compare two document representations to check if any functional / substantive fields changed.
 * Ignores ephemeral fields like lastJiraSyncAt or minor timestamp diffs.
 */
export function areSubstantiveFieldsEqual(oldDoc: any, newDoc: any): boolean {
  if (!oldDoc || !newDoc) return false;

  // Filter out ephemeral fields
  const filterEphemeral = (obj: any) => {
    if (!obj || typeof obj !== 'object') return obj;
    const copy = { ...obj };
    delete copy.lastJiraSyncAt;
    delete copy.jiraSyncPending;
    delete copy._localCachedAt;
    return copy;
  };

  const fOld = filterEphemeral(oldDoc);
  const fNew = filterEphemeral(newDoc);

  try {
    return JSON.stringify(fOld) === JSON.stringify(fNew);
  } catch {
    return false;
  }
}

/**
 * Check if an error is a Firestore Free Tier Quota Exceeded error or shared quota limit
 */
export function isFirestoreQuotaError(err: any): boolean {
  if (!err) return false;
  const msg = (
    typeof err === 'string'
      ? err
      : err.message || err.code || err.name || JSON.stringify(err) || ''
  ).toLowerCase();
  return (
    msg.includes('quota') ||
    msg.includes('shared quota') ||
    msg.includes('pay-as-you-go') ||
    msg.includes('free daily read') ||
    msg.includes('resource_exhausted') ||
    msg.includes('resource-exhausted') ||
    msg.includes('quota limits') ||
    msg.includes('restrictions') ||
    msg.includes('billing to remove') ||
    msg.includes('too many requests') ||
    msg.includes('rate limit')
  );
}

/**
 * Update and broadcast global Firestore quota state
 */
export function setFirestoreQuotaExceeded(exceeded: boolean): void {
  if (_isQuotaExceeded !== exceeded) {
    _isQuotaExceeded = exceeded;
    quotaListeners.forEach(cb => {
      try { cb(exceeded); } catch {}
    });
  }
}

/**
 * Get current quota exceeded status
 */
export function isFirestoreQuotaExceeded(): boolean {
  return _isQuotaExceeded;
}

/**
 * Subscribe to quota status changes
 */
export function subscribeToQuotaStatus(callback: (exceeded: boolean) => void): () => void {
  quotaListeners.add(callback);
  callback(_isQuotaExceeded);
  return () => quotaListeners.delete(callback);
}

/**
 * Remove any undefined values and strip massive inline Base64 data from an object before writing to Firestore
 */
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') return obj;
  const sanitized: Record<string, any> = Array.isArray(obj) ? [] : {};
  
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !(val instanceof Date)) {
        sanitized[key] = sanitizeForFirestore(val);
      } else if (typeof val === 'string' && val.length > 5000 && (val.includes('data:image/') || val.includes(';base64,'))) {
        // Enforce rule: Never store large base64 images in Firestore documents
        console.warn(`[Firestore Sanitizer] Blocked inline base64 payload on field '${key}' (${val.length} chars). Storing lightweight asset reference instead.`);
        sanitized[key] = '/api/media/placeholder-art.png';
      } else {
        sanitized[key] = val;
      }
    }
  });
  return sanitized as T;
}

/**
 * Real-time collection subscriber with query limiting, error handling, and usage tracking
 */
export function subscribeToCollection<T extends { id: string }>(
  collectionName: string,
  onData: (items: T[]) => void,
  onError?: (err: any) => void,
  options?: SubscribeOptions
): Unsubscribe {
  try {
    if (_isQuotaExceeded) {
      console.info(`[Firestore Sync] Shared quota cooldown active; skipping listener for ${collectionName}`);
      return () => {};
    }

    const colRef = collection(db, collectionName);
    let targetRef: any = colRef;
    if (options?.limitCount) {
      if (options.orderByField) {
        targetRef = query(
          colRef,
          orderBy(options.orderByField, options.orderDirection || 'desc'),
          limit(options.limitCount)
        );
      } else {
        targetRef = query(colRef, limit(options.limitCount));
      }
    }

    const listenerId = `col-${collectionName}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const unregisterUsage = registerActiveListener(
      listenerId,
      collectionName,
      options?.description || `Live subscription (${options?.limitCount ? `limit ${options.limitCount}` : 'all'})`
    );

    let isFirstSnapshot = true;
    const unsub = onSnapshot(
      targetRef,
      (snapshot: any) => {
        const readCount = isFirstSnapshot ? snapshot.size : Math.max(1, snapshot.docChanges().length);
        isFirstSnapshot = false;
        recordFirestoreRead(collectionName, readCount, true);

        const items: T[] = [];
        snapshot.forEach((d: any) => {
          const item = { id: d.id, ...d.data() } as T;
          items.push(item);
          setCachedDoc(collectionName, d.id, item);
        });
        onData(items);
      },
      (err) => {
        if (isFirestoreQuotaError(err)) {
          setFirestoreQuotaExceeded(true);
        }
        console.warn(`Firestore real-time sync warning for ${collectionName}:`, err);
        if (onError) onError(err);
      }
    );

    return () => {
      unregisterUsage();
      unsub();
    };
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      setFirestoreQuotaExceeded(true);
    }
    console.warn(`Failed to attach Firestore listener to ${collectionName}:`, err);
    return () => {};
  }
}

/**
 * Scoped real-time subscriber for active sprint tasks (only listens to tasks in this sprint)
 */
export function subscribeToSprintTasks(
  sprintId: string,
  onData: (tasks: Task[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  if (!sprintId || _isQuotaExceeded) return () => {};

  try {
    const colRef = collection(db, COLLECTIONS.TASKS);
    const q = query(colRef, where('sprintId', '==', sprintId), limit(150));

    const listenerId = `sprint-tasks-${sprintId}`;
    const unregisterUsage = registerActiveListener(
      listenerId,
      COLLECTIONS.TASKS,
      `Active Sprint (${sprintId}) tasks subscription`
    );

    let isFirst = true;
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const readCount = isFirst ? snapshot.size : Math.max(1, snapshot.docChanges().length);
        isFirst = false;
        recordFirestoreRead(COLLECTIONS.TASKS, readCount, true);

        const items: Task[] = [];
        snapshot.forEach((d) => {
          const t = { id: d.id, ...d.data() } as Task;
          items.push(t);
          setCachedDoc(COLLECTIONS.TASKS, d.id, t);
        });
        onData(items);
      },
      (err) => {
        if (isFirestoreQuotaError(err)) setFirestoreQuotaExceeded(true);
        if (onError) onError(err);
      }
    );

    return () => {
      unregisterUsage();
      unsub();
    };
  } catch (err) {
    console.warn('Failed to subscribe to sprint tasks:', err);
    return () => {};
  }
}

/**
 * Real-time single document subscriber with error handling & usage tracking
 */
export function subscribeToDoc<T>(
  collectionName: string,
  docId: string,
  onData: (data: T | null) => void,
  onError?: (err: any) => void
): Unsubscribe {
  try {
    if (_isQuotaExceeded) {
      return () => {};
    }

    const docRef = doc(db, collectionName, docId);
    const listenerId = `doc-${collectionName}-${docId}`;
    const unregisterUsage = registerActiveListener(listenerId, collectionName, `Doc subscription ${docId}`);

    const unsub = onSnapshot(
      docRef,
      (snapshot) => {
        recordFirestoreRead(collectionName, 1, true);
        if (snapshot.exists()) {
          const item = { id: snapshot.id, ...snapshot.data() } as T;
          setCachedDoc(collectionName, snapshot.id, item);
          onData(item);
        } else {
          onData(null);
        }
      },
      (err) => {
        if (isFirestoreQuotaError(err)) {
          setFirestoreQuotaExceeded(true);
        }
        console.warn(`Firestore real-time doc sync warning for ${collectionName}/${docId}:`, err);
        if (onError) onError(err);
      }
    );

    return () => {
      unregisterUsage();
      unsub();
    };
  } catch (err) {
    if (isFirestoreQuotaError(err)) {
      setFirestoreQuotaExceeded(true);
    }
    console.warn(`Failed to attach Firestore listener to ${collectionName}/${docId}:`, err);
    return () => {};
  }
}

// In-flight write debouncing to prevent high-frequency write storms against Firestore
const writeDebounceTimers = new Map<string, any>();

/**
 * Save or update an item in Firestore.
 * CRITICAL OPTIMIZATION: Compares existing cached document with new item.
 * If substantive fields are identical: SKIPS THE WRITE COMPLETELY!
 */
export async function syncSaveDoc<T extends { id: string }>(
  collectionName: string,
  item: T,
  isJiraSync: boolean = false
): Promise<void> {
  if (_isQuotaExceeded) return;

  const key = `${collectionName}:${item.id}`;
  const cached = documentCache.get(key);

  // Check if substantive fields actually changed
  if (cached && areSubstantiveFieldsEqual(cached, item)) {
    // DO NOT WRITE - Unchanged!
    return;
  }

  // Update in-memory cache immediately
  setCachedDoc(collectionName, item.id, item);

  if (writeDebounceTimers.has(key)) {
    clearTimeout(writeDebounceTimers.get(key));
  }

  const timer = setTimeout(async () => {
    writeDebounceTimers.delete(key);
    try {
      const docRef = doc(db, collectionName, item.id);
      await setDoc(docRef, sanitizeForFirestore(item), { merge: true });
      recordFirestoreWrite(collectionName, isJiraSync);
    } catch (err) {
      if (isFirestoreQuotaError(err)) {
        setFirestoreQuotaExceeded(true);
      }
      console.warn(`Firestore save warning on ${collectionName}/${item.id}:`, err);
    }
  }, 150);

  writeDebounceTimers.set(key, timer);
}

/**
 * Save or update studio global settings in Firestore
 */
export async function syncSaveSettingsDoc(settingsData: StudioSettings): Promise<void> {
  if (_isQuotaExceeded) return;
  const key = `${COLLECTIONS.SETTINGS}:app_settings`;
  const cached = documentCache.get(key);
  if (cached && areSubstantiveFieldsEqual(cached, settingsData)) {
    return;
  }
  setCachedDoc(COLLECTIONS.SETTINGS, 'app_settings', settingsData);

  try {
    const docRef = doc(db, COLLECTIONS.SETTINGS, 'app_settings');
    await setDoc(docRef, sanitizeForFirestore({ id: 'app_settings', ...settingsData }), { merge: true });
    recordFirestoreWrite(COLLECTIONS.SETTINGS, false);
  } catch (err) {
    if (isFirestoreQuotaError(err)) setFirestoreQuotaExceeded(true);
    console.warn('Firestore save settings error:', err);
  }
}

/**
 * Update partial fields in Firestore (debounced & guarded)
 */
export async function syncUpdateDoc(
  collectionName: string,
  docId: string,
  updates: Record<string, any>
): Promise<void> {
  if (_isQuotaExceeded) return;

  const key = `${collectionName}:${docId}`;
  const cached = documentCache.get(key);
  if (cached) {
    const candidate = { ...cached, ...updates };
    if (areSubstantiveFieldsEqual(cached, candidate)) {
      // Nothing substantive changed!
      return;
    }
    setCachedDoc(collectionName, docId, candidate);
  }

  const timerKey = `update:${collectionName}:${docId}`;
  if (writeDebounceTimers.has(timerKey)) {
    clearTimeout(writeDebounceTimers.get(timerKey));
  }

  const timer = setTimeout(async () => {
    writeDebounceTimers.delete(timerKey);
    try {
      const docRef = doc(db, collectionName, docId);
      await updateDoc(docRef, sanitizeForFirestore(updates));
      recordFirestoreWrite(collectionName, false);
    } catch (err) {
      if (isFirestoreQuotaError(err)) {
        setFirestoreQuotaExceeded(true);
      }
      console.warn(`Firestore update warning on ${collectionName}/${docId}:`, err);
    }
  }, 150);

  writeDebounceTimers.set(timerKey, timer);
}

/**
 * Delete a document from Firestore
 */
export async function syncDeleteDoc(collectionName: string, docId: string): Promise<void> {
  try {
    const key = `${collectionName}:${docId}`;
    documentCache.delete(key);
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
    recordFirestoreDelete(collectionName, 1);
  } catch (err) {
    console.warn(`Firestore delete error on ${collectionName}/${docId}:`, err);
  }
}

/**
 * Bounded one-time query fetcher with usage tracking & caching
 */
export async function queryCollectionOnce<T extends { id: string }>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
  description: string = 'One-time query'
): Promise<T[]> {
  if (_isQuotaExceeded) return [];

  try {
    const colRef = collection(db, collectionName);
    const q = constraints.length > 0 ? query(colRef, ...constraints) : query(colRef, limit(100));
    const snapshot = await getDocs(q);

    recordFirestoreRead(collectionName, snapshot.size, false);

    const items: T[] = [];
    snapshot.forEach(d => {
      const item = { id: d.id, ...d.data() } as T;
      items.push(item);
      setCachedDoc(collectionName, d.id, item);
    });
    return items;
  } catch (err) {
    if (isFirestoreQuotaError(err)) setFirestoreQuotaExceeded(true);
    console.warn(`Failed one-time query on ${collectionName}:`, err);
    return [];
  }
}

/**
 * Fetch stable configuration collection once (users, projects, sprints, artists)
 */
export async function fetchStableCollectionOnce<T extends { id: string }>(
  collectionName: string,
  limitCount: number = 200
): Promise<T[]> {
  return queryCollectionOnce<T>(collectionName, [limit(limitCount)], `Fetch stable ${collectionName}`);
}

/**
 * Fetch tasks for date range (for Daily Tasks Report) with limit
 */
export async function fetchTasksForDateRange(
  startDate: string,
  endDate: string,
  limitCount: number = 200
): Promise<Task[]> {
  // Query by dueDate or createdAt where possible, limited to bounds
  return queryCollectionOnce<Task>(
    COLLECTIONS.TASKS,
    [
      where('dueDate', '>=', startDate),
      where('dueDate', '<=', endDate),
      limit(limitCount)
    ],
    `Daily Tasks Report query (${startDate} to ${endDate})`
  );
}

/**
 * Fetch tasks for a specific sprint (for Sprint Report) with limit
 */
export async function fetchTasksForSprint(
  sprintId: string,
  limitCount: number = 200
): Promise<Task[]> {
  return queryCollectionOnce<Task>(
    COLLECTIONS.TASKS,
    [
      where('sprintId', '==', sprintId),
      limit(limitCount)
    ],
    `Sprint Report query (${sprintId})`
  );
}

/**
 * Fetch backlog tasks (unscheduled) with limit
 */
export async function fetchBacklogTasks(limitCount: number = 100): Promise<Task[]> {
  return queryCollectionOnce<Task>(
    COLLECTIONS.TASKS,
    [
      where('sprintId', 'in', ['backlog', '', 'unassigned']),
      limit(limitCount)
    ],
    'Backlog tasks query'
  );
}

/**
 * Batch wipe all documents in a collection
 */
export async function wipeFirestoreCollection(collectionName: string): Promise<void> {
  try {
    const colRef = collection(db, collectionName);
    const snap = await getDocs(colRef);
    if (snap.empty) return;

    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    recordFirestoreDelete(collectionName, snap.size);
  } catch (err) {
    console.warn(`Failed to wipe collection ${collectionName}:`, err);
  }
}

/**
 * Wipe all user data in Firestore
 */
export async function wipeAllUsersInFirestore(): Promise<void> {
  await wipeFirestoreCollection(COLLECTIONS.USERS);
}

/**
 * Wipe all data across all collections for a fresh slate
 */
export async function wipeAllStudioDataInFirestore(): Promise<void> {
  await Promise.all([
    wipeFirestoreCollection(COLLECTIONS.USERS),
    wipeFirestoreCollection(COLLECTIONS.TASKS),
    wipeFirestoreCollection(COLLECTIONS.PROJECTS),
    wipeFirestoreCollection(COLLECTIONS.SPRINTS),
    wipeFirestoreCollection(COLLECTIONS.ARTISTS),
    wipeFirestoreCollection(COLLECTIONS.REQUESTS),
    wipeFirestoreCollection(COLLECTIONS.TIME_ENTRIES),
    wipeFirestoreCollection(COLLECTIONS.ACTIVITY_LOGS),
    wipeFirestoreCollection(COLLECTIONS.AUDIT_LOGS),
    wipeFirestoreCollection(COLLECTIONS.NOTIFICATIONS),
    wipeFirestoreCollection(COLLECTIONS.MAILS)
  ]);
}
