import { db } from './firebase';
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { User, FieldAccessPermissions, UserRole, StudioMail, NavigationTab, TabAccessMode, DailyReportAccessLevel } from '../types';
import { isFirestoreQuotaError, setFirestoreQuotaExceeded } from './firestoreSync';

const USERS_COLLECTION = 'studio_users';
const MAILS_COLLECTION = 'studio_mails';
const LOCAL_USERS_KEY = 'artops_studio_users';

/**
 * Retrieve cached users from local storage
 */
export function getCachedUsers(): User[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY) || localStorage.getItem('artops_users') || '[]';
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return [];
}

/**
 * Save users list to local storage
 */
export function saveCachedUsers(users: User[]): void {
  try {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch {}
}

/**
 * Fetch and synchronize studio users from server directory
 */
export async function syncUsersFromServer(): Promise<User[]> {
  try {
    const res = await fetch('/api/studio/users');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.users) && data.users.length > 0) {
        const local = getCachedUsers();
        const mergedMap = new Map<string, User>();
        data.users.forEach((u: User) => {
          const key = (u.email ? u.email.toLowerCase() : u.id) || u.officeId;
          mergedMap.set(key, u);
        });
        local.forEach((u: User) => {
          const key = (u.email ? u.email.toLowerCase() : u.id) || u.officeId;
          if (!mergedMap.has(key)) {
            mergedMap.set(key, u);
          } else {
            mergedMap.set(key, { ...mergedMap.get(key)!, ...u });
          }
        });
        const merged = Array.from(mergedMap.values());
        saveCachedUsers(merged);
        return merged;
      }
    }
  } catch {}
  return getCachedUsers();
}

/**
 * Save or update a single user in local storage & server store
 */
export function saveCachedUser(user: User): void {
  try {
    const existing = getCachedUsers();
    const idx = existing.findIndex(
      u => u.id === user.id || (u.email && user.email && u.email.toLowerCase() === user.email.toLowerCase())
    );
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...user };
    } else {
      existing.push(user);
    }
    saveCachedUsers(existing);

    // Asynchronously synchronize with server studio users store
    fetch('/api/studio/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    }).catch(() => {});
  } catch {}
}

/**
 * Remove a user from local storage cache & server store
 */
export function removeCachedUser(userId: string): void {
  try {
    const existing = getCachedUsers();
    const filtered = existing.filter(u => u.id !== userId);
    saveCachedUsers(filtered);

    fetch(`/api/studio/users/${userId}`, { method: 'DELETE' }).catch(() => {});
  } catch {}
}

/**
 * Remove any undefined values from an object before sending to Firestore
 */
function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  const sanitized = { ...obj };
  Object.keys(sanitized).forEach(key => {
    if (sanitized[key] === undefined) {
      delete sanitized[key];
    }
  });
  return sanitized;
}

// Generate 6-digit security verification code
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * List of known disposable/temporary/fake email domains
 */
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  '10minutemail.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'yopmail.com',
  'sharklasers.com',
  'trashmail.com',
  'dispostable.com',
  'getairmail.com',
  'fakemailgenerator.com',
  'mohmal.com',
  'throwawaymail.com',
  'burnermail.io',
  'crazymailing.com',
  'nada.ltd',
  'getnada.com',
  'inboxkitten.com',
  'tempmailaddress.com',
  'mytemp.email',
  'disposablemail.com',
  'trashmail.net',
  'maildrop.cc'
]);

/**
 * Validates that an email is legitimate, correctly structured, and not a throwaway/fake domain
 */
export function validateCompanyEmail(email: string): { valid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email address is required.' };
  }

  const trimmed = email.trim().toLowerCase();
  
  // RFC 5322 standard regex pattern for email format validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address (e.g. name@zapak.com).' };
  }

  const domain = trimmed.split('@')[1];
  if (!domain || !domain.includes('.')) {
    return { valid: false, error: 'Invalid email domain.' };
  }

  // Check if domain is a known disposable fake email provider
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return {
      valid: false,
      error: 'Disposable and temporary email addresses are not permitted. Please use your official corporate work email.'
    };
  }

  return { valid: true };
}

export const ALL_NAVIGATION_TABS: NavigationTab[] = [
  'dashboard',
  'admin-tool',
  'gallery',
  'requests',
  'my-tasks',
  'backlog',
  'sprints',
  'kanban',
  'capacity',
  'artists',
  'daily-report',
  'sprint-report',
  'projects',
  'calendar',
  'reports',
  'activity',
  'people',
  'settings'
];

export const getPresetTabPermissions = (
  preset: 'ADMIN' | 'LEADER' | 'ARTIST' | 'COMPANY_REQUESTER' | 'DAILY_REPORT_VIEW_ONLY' | 'ALL_VIEW_ONLY'
): Partial<Record<NavigationTab, TabAccessMode>> => {
  switch (preset) {
    case 'ADMIN':
      return {
        dashboard: 'FULL',
        'admin-tool': 'FULL',
        gallery: 'FULL',
        requests: 'FULL',
        'my-tasks': 'FULL',
        backlog: 'FULL',
        sprints: 'FULL',
        kanban: 'FULL',
        capacity: 'FULL',
        artists: 'FULL',
        'daily-report': 'FULL',
        'sprint-report': 'FULL',
        projects: 'FULL',
        calendar: 'FULL',
        reports: 'FULL',
        activity: 'FULL',
        people: 'FULL',
        settings: 'FULL'
      };
    case 'LEADER':
      return {
        dashboard: 'FULL',
        'admin-tool': 'FULL',
        gallery: 'FULL',
        requests: 'FULL',
        'my-tasks': 'FULL',
        backlog: 'FULL',
        sprints: 'FULL',
        kanban: 'FULL',
        capacity: 'FULL',
        artists: 'FULL',
        'daily-report': 'FULL',
        'sprint-report': 'FULL',
        projects: 'FULL',
        calendar: 'FULL',
        reports: 'FULL',
        activity: 'FULL',
        people: 'FULL',
        settings: 'FULL'
      };
    case 'ARTIST':
      return {
        dashboard: 'VIEW',
        'admin-tool': 'NONE',
        gallery: 'VIEW',
        requests: 'VIEW',
        'my-tasks': 'FULL',
        backlog: 'VIEW',
        sprints: 'VIEW',
        kanban: 'FULL',
        capacity: 'NONE',
        artists: 'NONE',
        'daily-report': 'FULL',
        'sprint-report': 'FULL',
        projects: 'NONE',
        calendar: 'VIEW',
        reports: 'NONE',
        activity: 'VIEW',
        people: 'NONE',
        settings: 'NONE'
      };
    case 'COMPANY_REQUESTER':
      return {
        dashboard: 'VIEW',
        'admin-tool': 'NONE',
        gallery: 'VIEW',
        requests: 'FULL',
        'my-tasks': 'NONE',
        backlog: 'NONE',
        sprints: 'NONE',
        kanban: 'NONE',
        capacity: 'NONE',
        artists: 'NONE',
        'daily-report': 'NONE',
        'sprint-report': 'NONE',
        projects: 'NONE',
        calendar: 'NONE',
        reports: 'NONE',
        activity: 'NONE',
        people: 'NONE',
        settings: 'NONE'
      };
    case 'DAILY_REPORT_VIEW_ONLY':
      return {
        dashboard: 'VIEW',
        'admin-tool': 'NONE',
        gallery: 'VIEW',
        requests: 'NONE',
        'my-tasks': 'NONE',
        backlog: 'NONE',
        sprints: 'NONE',
        kanban: 'NONE',
        capacity: 'NONE',
        artists: 'NONE',
        'daily-report': 'VIEW',
        'sprint-report': 'VIEW',
        projects: 'NONE',
        calendar: 'NONE',
        reports: 'NONE',
        activity: 'NONE',
        people: 'NONE',
        settings: 'NONE'
      };
    case 'ALL_VIEW_ONLY':
      return {
        dashboard: 'VIEW',
        'admin-tool': 'NONE',
        gallery: 'VIEW',
        requests: 'VIEW',
        'my-tasks': 'VIEW',
        backlog: 'VIEW',
        sprints: 'VIEW',
        kanban: 'VIEW',
        capacity: 'VIEW',
        artists: 'VIEW',
        'daily-report': 'VIEW',
        'sprint-report': 'VIEW',
        projects: 'VIEW',
        calendar: 'VIEW',
        reports: 'VIEW',
        activity: 'VIEW',
        people: 'NONE',
        settings: 'NONE'
      };
  }
};

export const defaultFieldPermissionsForRole = (role: UserRole): FieldAccessPermissions => {
  switch (role) {
    case 'ADMIN':
    case 'ART_DIRECTOR':
    case 'ART_MANAGER':
      return {
        canViewStoryPoints: true,
        canEditStoryPoints: true,
        canViewEstimates: true,
        canEditEstimates: true,
        canLogTime: true,
        canViewHourlyRates: true,
        canAssignArtists: true,
        canApproveRevisions: true,
        canManageSprints: true,
        canCreateProjects: true,
        canAccessAiPlanner: true,
        canViewReports: true,
        tabAccess: getPresetTabPermissions(role === 'ADMIN' ? 'ADMIN' : 'LEADER'),
        dailyReportAccess: 'FULL_ACCESS',
        canAccessAllTabs: true
      };
    case 'ARTIST':
      return {
        canViewStoryPoints: true,
        canEditStoryPoints: false,
        canViewEstimates: true,
        canEditEstimates: true,
        canLogTime: true,
        canViewHourlyRates: false,
        canAssignArtists: false,
        canApproveRevisions: false,
        canManageSprints: false,
        canCreateProjects: false,
        canAccessAiPlanner: false,
        canViewReports: true,
        tabAccess: getPresetTabPermissions('ARTIST'),
        dailyReportAccess: 'FULL_ACCESS',
        canAccessAllTabs: false
      };
    case 'COMPANY_REQUESTER':
    default:
      return {
        canViewStoryPoints: false,
        canEditStoryPoints: false,
        canViewEstimates: false,
        canEditEstimates: false,
        canLogTime: false,
        canViewHourlyRates: false,
        canAssignArtists: false,
        canApproveRevisions: false,
        canManageSprints: false,
        canCreateProjects: false,
        canAccessAiPlanner: false,
        canViewReports: false,
        tabAccess: getPresetTabPermissions('COMPANY_REQUESTER'),
        dailyReportAccess: 'NONE',
        canAccessAllTabs: false
      };
  }
};

/**
 * Dispatch Studio Mail to inbox (stored in Firestore + Trigger Email collection + Backend Dispatch)
 */
export async function sendStudioMail(mail: Omit<StudioMail, 'id' | 'timestamp' | 'read'>): Promise<StudioMail> {
  const mailId = `mail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const fullMail: StudioMail = {
    ...mail,
    fromName: mail.fromName || 'RG ArtFlow Operations',
    fromEmail: mail.fromEmail || 'wwemayhemgame@gmail.com',
    id: mailId,
    timestamp: new Date().toISOString(),
    read: false
  };

  // 1. Store in Firestore studio_mails collection
  try {
    await setDoc(doc(db, MAILS_COLLECTION, mailId), sanitizeForFirestore(fullMail));
  } catch (err) {
    console.warn('Firestore studio_mails write fallback:', err);
  }

  // 2. Store in Firebase Extension Trigger Email collection (/mail)
  try {
    const triggerMailDoc = doc(db, 'mail', mailId);
    await setDoc(triggerMailDoc, sanitizeForFirestore({
      to: [mail.toEmail],
      from: 'RG ArtFlow <wwemayhemgame@gmail.com>',
      replyTo: 'wwemayhemgame@gmail.com',
      message: {
        subject: mail.subject,
        text: mail.body,
        html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
          <div style="background: #1e3a8a; padding: 18px; border-radius: 8px 8px 0 0; color: white;">
            <h2 style="margin: 0; font-size: 18px;">RG ArtFlow — Studio Access</h2>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #bfdbfe;">From: RG ArtFlow (wwemayhemgame@gmail.com)</p>
          </div>
          <div style="border: 1px solid #e2e8f0; border-top: none; padding: 20px; border-radius: 0 0 8px 8px; background: #ffffff;">
            <pre style="white-space: pre-wrap; font-family: inherit; font-size: 14px; line-height: 1.6; color: #334155;">${mail.body}</pre>
            ${mail.verificationCode ? `
              <div style="margin-top: 24px; padding: 16px; background: #f0f9ff; border: 2px dashed #0284c7; border-radius: 8px; text-align: center;">
                <div style="font-size: 12px; color: #0369a1; font-weight: bold; text-transform: uppercase;">Your 6-Digit Verification Code</div>
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0284c7; font-family: monospace; margin-top: 6px;">${mail.verificationCode}</div>
              </div>
            ` : ''}
          </div>
          <div style="margin-top: 14px; font-size: 11px; color: #94a3b8; text-align: center;">
            Sent by Studio Operations &bull; RG ArtFlow (wwemayhemgame@gmail.com)
          </div>
        </div>`
      },
      metadata: mail.metadata || {},
      createdAt: new Date().toISOString()
    }));
  } catch (err) {
    console.warn('Firebase trigger email collection write:', err);
  }

  // 3. Trigger backend server-side email dispatch
  if (mail.verificationCode) {
    try {
      const endpoint = mail.type === 'PASSWORD_RESET' ? '/api/auth/send-reset-email' : '/api/auth/send-verification-email';
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: mail.toEmail,
          toName: mail.toName,
          verificationCode: mail.verificationCode,
          resetCode: mail.verificationCode,
          officeId: mail.metadata?.officeId || 'OFF-PENDING',
          subject: mail.subject,
          body: mail.body
        })
      }).catch(e => console.warn('Outbound mail API call failed:', e));
    } catch {}
  }

  // 4. Save to localStorage for offline / instant availability
  try {
    const existing = JSON.parse(localStorage.getItem('artops_studio_mails') || '[]');
    localStorage.setItem('artops_studio_mails', JSON.stringify([fullMail, ...existing]));
  } catch (e) {}

  return fullMail;
}

export interface TaskActivityMailParams {
  toEmail: string;
  toName: string;
  actorName: string;
  activityType:
    | 'ASSIGNED'
    | 'STATUS_CHANGED'
    | 'DELIVERED'
    | 'REVISION_REQUESTED'
    | 'COMMENT_ADDED'
    | 'BLOCKED_ALERT'
    | 'REQUEST_CREATED';
  taskId: string;
  taskTitle: string;
  projectName?: string;
  details?: string;
  priority?: string;
  dueDate?: string;
  status?: string;
}

/**
 * Dispatch automated task activity notification email across all channels
 */
export async function sendTaskActivityNotificationMail(params: TaskActivityMailParams): Promise<StudioMail | null> {
  if (!params.toEmail || !params.taskId) return null;

  const mailTypeMap: Record<TaskActivityMailParams['activityType'], StudioMail['type']> = {
    ASSIGNED: 'TASK_ASSIGNED',
    STATUS_CHANGED: 'TASK_STATUS_CHANGED',
    DELIVERED: 'TASK_DELIVERED',
    REVISION_REQUESTED: 'TASK_REVISION',
    COMMENT_ADDED: 'TASK_COMMENT',
    BLOCKED_ALERT: 'TASK_BLOCKED',
    REQUEST_CREATED: 'REQUEST_SUBMITTED'
  };

  const mailType = mailTypeMap[params.activityType] || 'SYSTEM_ALERT';
  const mailId = `mail-task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  let subjectAction = 'Task Update';
  if (params.activityType === 'ASSIGNED') subjectAction = '🎨 New Task Assigned';
  else if (params.activityType === 'STATUS_CHANGED') subjectAction = `⚡ Status: ${params.status || 'Updated'}`;
  else if (params.activityType === 'DELIVERED') subjectAction = '🎉 Art Delivered & Completed';
  else if (params.activityType === 'REVISION_REQUESTED') subjectAction = '✏️ Revision Requested';
  else if (params.activityType === 'COMMENT_ADDED') subjectAction = '💬 New Comment';
  else if (params.activityType === 'BLOCKED_ALERT') subjectAction = '🚨 Task Blocked Alert';
  else if (params.activityType === 'REQUEST_CREATED') subjectAction = '📋 New Company Request';

  const subject = `[${params.taskId}] ${subjectAction} — ${params.taskTitle}`;
  const body = `Hello ${params.toName},\n\nAn update has occurred on task [${params.taskId}] "${params.taskTitle}" in ${params.projectName || 'Studio'}.\nAction by: ${params.actorName}\n${params.status ? `Status: ${params.status}\n` : ''}${params.priority ? `Priority: ${params.priority}\n` : ''}${params.dueDate ? `Due / Delivery: ${params.dueDate}\n` : ''}\nDetails:\n${params.details || 'No additional notes.'}\n\nPlease check the RG ArtFlow dashboard for full assets and details.`;

  const fullMail: StudioMail = {
    id: mailId,
    toEmail: params.toEmail,
    toName: params.toName,
    fromName: 'RG ArtFlow Operations',
    fromEmail: 'wwemayhemgame@gmail.com',
    subject,
    body,
    previewText: `${params.actorName}: ${params.details?.substring(0, 80) || subjectAction}`,
    type: mailType,
    timestamp: now,
    read: false,
    metadata: {
      taskId: params.taskId,
      taskTitle: params.taskTitle,
      projectName: params.projectName,
      activityType: params.activityType,
      status: params.status,
      actorName: params.actorName
    }
  };

  // 1. Save to studio_mails in Firestore
  try {
    const docRef = doc(db, MAILS_COLLECTION, mailId);
    setDoc(docRef, sanitizeForFirestore(fullMail)).catch(e => console.warn('Firestore studio_mails task sync:', e));
  } catch (err) {
    console.warn('Firestore studio_mails task write:', err);
  }

  // 2. Queue in /mail trigger collection for Firebase Trigger Email extension
  try {
    const triggerRef = doc(db, 'mail', mailId);
    setDoc(triggerRef, sanitizeForFirestore({
      to: [params.toEmail],
      from: 'RG ArtFlow <wwemayhemgame@gmail.com>',
      replyTo: 'wwemayhemgame@gmail.com',
      message: {
        subject,
        text: body,
        html: `<div style="font-family: sans-serif; max-width: 580px; margin: 0 auto; background: #1e293b; color: #f8fafc; padding: 20px; border-radius: 10px;">
          <h2 style="color: #38bdf8; margin-top: 0;">${subjectAction}</h2>
          <p>Hello <strong>${params.toName}</strong>,</p>
          <p>An update occurred on <strong>[${params.taskId}] ${params.taskTitle}</strong> in <em>${params.projectName || 'Studio'}</em> by <strong>${params.actorName}</strong>.</p>
          ${params.status ? `<p><strong>Status:</strong> ${params.status}</p>` : ''}
          ${params.details ? `<div style="background: #0f172a; padding: 12px; border-radius: 6px; margin: 12px 0;">${params.details}</div>` : ''}
          <div style="margin-top: 16px; font-size: 11px; color: #94a3b8; text-align: center;">
            Sent by RG ArtFlow &bull; wwemayhemgame@gmail.com
          </div>
        </div>`
      },
      createdAt: now
    })).catch(e => console.warn('Firebase trigger mail queue write:', e));
  } catch (err) {
    console.warn('Firebase mail trigger write error:', err);
  }

  // 3. Trigger backend server-side email dispatch (SMTP / nodemailer)
  try {
    fetch('/api/mail/send-task-activity-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        toEmail: params.toEmail,
        toName: params.toName,
        actorName: params.actorName,
        activityType: params.activityType,
        taskId: params.taskId,
        taskTitle: params.taskTitle,
        projectName: params.projectName,
        details: params.details,
        priority: params.priority,
        dueDate: params.dueDate,
        status: params.status
      })
    }).catch(e => console.warn('Outbound task mail API call failed:', e));
  } catch {}

  // 4. Update localStorage
  try {
    const existing = JSON.parse(localStorage.getItem('artops_studio_mails') || '[]');
    localStorage.setItem('artops_studio_mails', JSON.stringify([fullMail, ...existing]));
  } catch (e) {}

  return fullMail;
}

/**
 * Fetch all studio mails
 */
export async function fetchStudioMails(): Promise<StudioMail[]> {
  try {
    const snap = await getDocs(collection(db, MAILS_COLLECTION));
    if (!snap.empty) {
      const mails: StudioMail[] = [];
      snap.forEach(d => mails.push(d.data() as StudioMail));
      mails.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return mails;
    }
  } catch (err) {
    console.warn('Firestore mail fetch fallback to local storage:', err);
  }

  try {
    const cached = JSON.parse(localStorage.getItem('artops_studio_mails') || '[]');
    return cached;
  } catch {
    return [];
  }
}

/**
 * Mark mail as read
 */
export async function markStudioMailAsRead(mailId: string): Promise<void> {
  try {
    const mailRef = doc(db, MAILS_COLLECTION, mailId);
    await updateDoc(mailRef, { read: true });
  } catch (err) {
    console.warn('Firestore mail update fallback:', err);
  }

  try {
    const cached: StudioMail[] = JSON.parse(localStorage.getItem('artops_studio_mails') || '[]');
    const updated = cached.map(m => (m.id === mailId ? { ...m, read: true } : m));
    localStorage.setItem('artops_studio_mails', JSON.stringify(updated));
  } catch {}
}

/**
 * Sync initial seed users to Firestore if collection is empty
 */
export async function seedFirestoreUsersIfEmpty(seedUsers: User[]): Promise<User[]> {
  try {
    const cached = getCachedUsers();
    if (cached.length === 0) {
      saveCachedUsers(seedUsers);
    }

    const colRef = collection(db, USERS_COLLECTION);
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) {
      const batch = writeBatch(db);
      seedUsers.forEach(u => {
        const userDocRef = doc(db, USERS_COLLECTION, u.id);
        const permissions = u.fieldPermissions || defaultFieldPermissionsForRole(u.role);
        batch.set(userDocRef, sanitizeForFirestore({
          ...u,
          fieldPermissions: permissions
        }));
      });
      await batch.commit();
      saveCachedUsers(seedUsers);
      return seedUsers;
    } else {
      const usersList: User[] = [];
      snapshot.forEach(docSnap => {
        usersList.push(docSnap.data() as User);
      });
      saveCachedUsers(usersList);
      return usersList;
    }
  } catch (err: any) {
    if (isFirestoreQuotaError(err)) {
      setFirestoreQuotaExceeded(true);
    }
    console.warn('Firestore sync fallback to local cache:', err);
    const cached = getCachedUsers();
    return cached.length > 0 ? cached : seedUsers;
  }
}

/**
 * Register a new user with auto-generated Office ID and verification tracking code
 */
export async function registerUserWithOfficeId(userData: {
  name: string;
  email: string;
  officeId?: string;
  password?: string;
  role?: UserRole;
  department?: string;
  title?: string;
  avatar?: string;
  requestedFieldPermissions?: Partial<FieldAccessPermissions>;
}): Promise<{ success: boolean; user?: User; verificationCode?: string; error?: string }> {
  try {
    const normalizedEmail = userData.email.trim().toLowerCase();
    
    // Validate email syntax and anti-fake/disposable check
    const emailValidation = validateCompanyEmail(normalizedEmail);
    if (!emailValidation.valid) {
      return { success: false, error: emailValidation.error || 'Invalid email address provided.' };
    }

    const isAdminAccount = normalizedEmail === 'wwemayhemgame@gmail.com' || normalizedEmail === 'ranjeet.patil@zapak.com';

    // Only designated admin is allowed to hold the ADMIN role
    let assignedRole: UserRole = userData.role || 'ARTIST';
    if (assignedRole === 'ADMIN' && !isAdminAccount) {
      assignedRole = 'ARTIST';
    }
    if (isAdminAccount) {
      assignedRole = 'ADMIN';
    }

    // Check if email already exists in local cache, server store, or Firestore
    let emailExists = false;
    const localUsers = getCachedUsers();
    emailExists = localUsers.some(u => u.email?.toLowerCase() === normalizedEmail);
    if (!emailExists) {
      try {
        const serverUsers = await syncUsersFromServer();
        emailExists = serverUsers.some(u => u.email?.toLowerCase() === normalizedEmail);
      } catch {}
    }
    if (!emailExists) {
      try {
        const qEmail = query(collection(db, USERS_COLLECTION), where('email', '==', normalizedEmail));
        const emailSnap = await getDocs(qEmail);
        emailExists = !emailSnap.empty;
      } catch (e: any) {
        if (isFirestoreQuotaError(e)) setFirestoreQuotaExceeded(true);
      }
    }

    if (emailExists) {
      return { success: false, error: `Email "${normalizedEmail}" is already registered. Please sign in.` };
    }

    // Auto-generate unique Office ID behind the scenes
    let trimmedOfficeId = (userData.officeId || '').trim().toUpperCase();
    if (!trimmedOfficeId) {
      trimmedOfficeId = isAdminAccount ? 'OFF-1001' : `OFF-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const verificationCode = generateVerificationCode();
    const newUserId = isAdminAccount ? 'user-ranjeet' : `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const avatarUrl =
      userData.avatar ||
      (isAdminAccount
        ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
        : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80');

    const defaultPerms = defaultFieldPermissionsForRole(assignedRole);
    const assignedPermissions: FieldAccessPermissions = {
      ...defaultPerms,
      ...(userData.requestedFieldPermissions || {})
    };

    const newUser: User = {
      id: newUserId,
      name: userData.name.trim(),
      email: normalizedEmail,
      officeId: trimmedOfficeId,
      password: userData.password || 'password123',
      role: assignedRole,
      avatar: avatarUrl,
      department: (userData.department || (isAdminAccount ? 'Studio Leadership' : 'Art Department')).trim(),
      title: (userData.title || (isAdminAccount ? 'Studio Administrator & Head of Art' : 'Studio Team Member')).trim(),
      status: isAdminAccount ? 'ACTIVE' : 'PENDING_APPROVAL',
      approvedBy: isAdminAccount ? 'SYSTEM' : undefined,
      approvedByName: isAdminAccount ? 'System Initializer' : undefined,
      approvedAt: isAdminAccount ? new Date().toISOString() : undefined,
      verificationCode,
      isVerified: isAdminAccount,
      createdAt: new Date().toISOString(),
      fieldPermissions: assignedPermissions
    };

    try {
      await setDoc(doc(db, USERS_COLLECTION, newUserId), sanitizeForFirestore(newUser));
    } catch (err: any) {
      if (isFirestoreQuotaError(err)) setFirestoreQuotaExceeded(true);
      console.warn('Could not write new user to Firestore (saving locally):', err);
    }

    saveCachedUser(newUser);

    // 1. Dispatch confirmation email to requester inbox
    await sendStudioMail({
      toEmail: normalizedEmail,
      toName: newUser.name,
      fromName: 'RG ArtFlow Operations',
      fromEmail: 'wwemayhemgame@gmail.com',
      subject: `Studio Access Verification Code: ${verificationCode}`,
      previewText: `Your 6-digit verification code is ${verificationCode}. Please enter it to verify your email.`,
      body: `Hello ${newUser.name},

Thank you for registering your company studio account for RG ArtFlow.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR 6-DIGIT VERIFICATION CODE: ${verificationCode}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Office ID: ${trimmedOfficeId}
Department: ${newUser.department} — ${newUser.title}
Sent By: RG ArtFlow Operations (wwemayhemgame@gmail.com)

Please enter this verification code on the verification screen to verify your email. Once submitted, your request will be reviewed by Studio Leadership for role authorization and full workspace access.`,
      type: 'REQUEST_SUBMITTED',
      verificationCode,
      userRole: assignedRole,
      metadata: {
        userId: newUserId,
        officeId: trimmedOfficeId,
        role: assignedRole
      }
    });

    // 2. Dispatch alert email to Admin Ranjeet Patil
    await sendStudioMail({
      toEmail: 'ranjeet.patil@zapak.com',
      toName: 'Ranjeet Patil (Studio Administrator)',
      fromName: 'RG ArtFlow Operations',
      fromEmail: 'wwemayhemgame@gmail.com',
      subject: `[Action Required] New Studio Access Request: ${newUser.name} (${newUser.department})`,
      previewText: `${newUser.name} submitted an access request requiring your approval.`,
      body: `A new team member has registered a studio account requiring your administrator approval:

• Applicant: ${newUser.name} (${normalizedEmail})
• Department: ${newUser.department} — ${newUser.title}
• Request Verification Code: ${verificationCode}

Please open Studio People & Access Control > Office ID Approvals to review, assign role (Art Director, Art Manager, Artist, or Requester) and field permissions, and activate this user.`,
      type: 'SECURITY_VERIFICATION',
      verificationCode,
      metadata: {
        userId: newUserId,
        officeId: trimmedOfficeId,
        role: assignedRole
      }
    });

    return { success: true, user: newUser, verificationCode };
  } catch (err: any) {
    console.error('Error registering user:', err);
    return { success: false, error: err.message || 'Failed to submit registration.' };
  }
}

/**
 * Authenticate login with Office ID or Corporate Email and Password
 */
export async function loginWithOfficeId(
  identifier: string,
  password?: string
): Promise<{ success: boolean; user?: User; status?: string; error?: string }> {
  const rawInput = identifier.trim();
  const upperInput = rawInput.toUpperCase();
  const lowerInput = rawInput.toLowerCase();

  const isSpecialAdmin =
    lowerInput === 'wwemayhemgame@gmail.com' ||
    lowerInput === 'ranjeet.patil@zapak.com' ||
    upperInput === 'OFF-1001';

  const adminEmail = lowerInput.includes('@') ? lowerInput : 'ranjeet.patil@zapak.com';
  const fallbackAdminUser: User = {
    id: 'user-ranjeet',
    name: 'Ranjeet Patil',
    email: adminEmail,
    officeId: 'OFF-1001',
    password: password || 'password123',
    role: 'ADMIN',
    artistId: 'artist-ranjeet',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    department: 'Studio Leadership',
    title: 'Studio Administrator & Head of Art',
    status: 'ACTIVE',
    approvedBy: 'SYSTEM',
    approvedByName: 'System Setup',
    approvedAt: '2021-03-01T00:00:00Z',
    createdAt: '2021-03-01T00:00:00Z',
    verificationCode: '123456',
    isVerified: true,
    fieldPermissions: {
      canViewStoryPoints: true,
      canEditStoryPoints: true,
      canViewEstimates: true,
      canEditEstimates: true,
      canLogTime: true,
      canViewHourlyRates: true,
      canAssignArtists: true,
      canApproveRevisions: true,
      canManageSprints: true,
      canCreateProjects: true,
      canAccessAiPlanner: true,
      canViewReports: true
    }
  };

  try {
    let userData: User | null = null;

    try {
      const qOffice = query(collection(db, USERS_COLLECTION), where('officeId', '==', upperInput));
      let snap = await getDocs(qOffice);

      if (snap.empty) {
        const qEmail = query(collection(db, USERS_COLLECTION), where('email', '==', lowerInput));
        snap = await getDocs(qEmail);
      }

      if (!snap.empty) {
        userData = snap.docs[0].data() as User;
      }
    } catch (firestoreErr: any) {
      if (isFirestoreQuotaError(firestoreErr)) {
        setFirestoreQuotaExceeded(true);
      }
      console.warn('Firestore user lookup error (falling back to cache/local):', firestoreErr);
    }

    // If not found from Firestore query, search local cache or server directory
    if (!userData) {
      const cached = getCachedUsers();
      let found = cached.find(
        u =>
          (u.email && u.email.toLowerCase() === lowerInput) ||
          (u.officeId && u.officeId.toUpperCase() === upperInput) ||
          u.id === rawInput
      );
      if (!found) {
        try {
          const serverUsers = await syncUsersFromServer();
          found = serverUsers.find(
            u =>
              (u.email && u.email.toLowerCase() === lowerInput) ||
              (u.officeId && u.officeId.toUpperCase() === upperInput) ||
              u.id === rawInput
          );
        } catch {}
      }
      if (found) {
        userData = found;
      }
    }

    // If still not found and is Special Admin
    if (!userData) {
      if (isSpecialAdmin) {
        userData = fallbackAdminUser;
        saveCachedUser(userData);
      } else {
        return {
          success: false,
          error: `No studio account found for "${rawInput}". Please create an account or verify credentials.`
        };
      }
    }

    if (password && userData.password && userData.password !== password) {
      return { success: false, error: 'Incorrect password for this company account.' };
    }

    // Ensure Admin always has direct Admin privileges & correct profile info
    if (
      userData.email.toLowerCase() === 'wwemayhemgame@gmail.com' ||
      userData.email.toLowerCase() === 'ranjeet.patil@zapak.com' ||
      userData.officeId === 'OFF-1001'
    ) {
      const correctName =
        userData.email.toLowerCase() === 'ranjeet.patil@zapak.com' ||
        userData.id === 'user-ranjeet' ||
        userData.officeId === 'OFF-1001'
          ? (userData.name && !userData.name.toLowerCase().includes('vishwas') ? userData.name : 'Ranjeet Patil')
          : userData.name;

      userData = {
        ...userData,
        name: correctName,
        role: userData.role || 'ADMIN',
        status: 'ACTIVE',
        isVerified: true
      };

      try {
        await setDoc(doc(db, USERS_COLLECTION, userData.id || 'user-ranjeet'), sanitizeForFirestore(userData), { merge: true });
      } catch (e: any) {
        if (isFirestoreQuotaError(e)) setFirestoreQuotaExceeded(true);
      }

      saveCachedUser(userData);
      return { success: true, user: userData, status: 'ACTIVE' };
    }

    saveCachedUser(userData);

    // All other users require approval from Admin
    if (userData.status === 'PENDING_APPROVAL') {
      return {
        success: false,
        status: 'PENDING_APPROVAL',
        user: userData,
        error:
          'Your account is pending review. Studio Administrator (wwemayhemgame@gmail.com) must accept and approve your access request before you can enter.'
      };
    }

    if (userData.status === 'REJECTED') {
      return {
        success: false,
        status: 'REJECTED',
        user: userData,
        error: `Your access request was declined. Reason: ${userData.rejectionReason || 'Contact Studio Administrator (wwemayhemgame@gmail.com).'}`
      };
    }

    if (userData.status === 'SUSPENDED') {
      return {
        success: false,
        status: 'SUSPENDED',
        user: userData,
        error: 'Your studio access is currently suspended. Please contact Studio Administrator (wwemayhemgame@gmail.com).'
      };
    }

    return { success: true, user: userData, status: 'ACTIVE' };
  } catch (err: any) {
    console.error('Error logging in with identifier:', err);
    if (isFirestoreQuotaError(err)) {
      setFirestoreQuotaExceeded(true);
    }
    if (isSpecialAdmin) {
      saveCachedUser(fallbackAdminUser);
      return { success: true, user: fallbackAdminUser, status: 'ACTIVE' };
    }

    // Try fallback against cached / server users before returning error
    try {
      const cached = getCachedUsers();
      let fallbackUser = cached.find(
        u =>
          (u.email && u.email.toLowerCase() === lowerInput) ||
          (u.officeId && u.officeId.toUpperCase() === upperInput) ||
          u.id === rawInput
      );
      if (!fallbackUser) {
        const serverUsers = await syncUsersFromServer();
        fallbackUser = serverUsers.find(
          u =>
            (u.email && u.email.toLowerCase() === lowerInput) ||
            (u.officeId && u.officeId.toUpperCase() === upperInput) ||
            u.id === rawInput
        );
      }
      if (fallbackUser) {
        if (password && fallbackUser.password && fallbackUser.password !== password) {
          return { success: false, error: 'Incorrect password for this company account.' };
        }
        if (fallbackUser.status === 'PENDING_APPROVAL') {
          return {
            success: false,
            status: 'PENDING_APPROVAL',
            user: fallbackUser,
            error:
              'Your account is pending review. Studio Administrator (wwemayhemgame@gmail.com) must accept and approve your access request before you can enter.'
          };
        }
        return { success: true, user: fallbackUser, status: fallbackUser.status || 'ACTIVE' };
      }
    } catch {}

    const friendlyError = isFirestoreQuotaError(err)
      ? `Studio cloud database is in shared quota cooldown. High-resilience mode active — no matching account found for "${rawInput}". Please check your credentials or create an account.`
      : (err.message || 'Login verification failed.');
    return { success: false, error: friendlyError };
  }
}

/**
 * Verify account using 6-Digit Email Verification Code
 */
export async function verifyUserWithCode(
  identifier: string,
  code: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const rawInput = identifier.trim().toLowerCase();
    const cleanCode = code.trim();

    let userData: User | null = null;
    try {
      const qEmail = query(collection(db, USERS_COLLECTION), where('email', '==', rawInput));
      let snap = await getDocs(qEmail);

      if (snap.empty) {
        const qOffice = query(collection(db, USERS_COLLECTION), where('officeId', '==', identifier.trim().toUpperCase()));
        snap = await getDocs(qOffice);
      }

      if (!snap.empty) {
        userData = snap.docs[0].data() as User;
      }
    } catch (e: any) {
      if (isFirestoreQuotaError(e)) setFirestoreQuotaExceeded(true);
    }

    if (!userData) {
      const cached = getCachedUsers();
      userData = cached.find(
        u => u.email?.toLowerCase() === rawInput || u.officeId?.toUpperCase() === identifier.trim().toUpperCase()
      ) || null;
      if (!userData) {
        try {
          const serverUsers = await syncUsersFromServer();
          userData = serverUsers.find(
            u => u.email?.toLowerCase() === rawInput || u.officeId?.toUpperCase() === identifier.trim().toUpperCase()
          ) || null;
        } catch {}
      }
    }

    if (!userData) {
      return { success: false, error: `No account found for "${identifier}".` };
    }

    if (!userData.verificationCode || userData.verificationCode !== cleanCode) {
      return { success: false, error: 'Invalid 6-digit verification code. Please check your inbox or request a new code.' };
    }

    if (userData.status === 'REJECTED') {
      return {
        success: false,
        error: `This request was declined. Reason: ${userData.rejectionReason || 'Access denied by leadership.'}`
      };
    }

    const updatedUser: User = {
      ...userData,
      isVerified: true
    };

    try {
      await updateDoc(doc(db, USERS_COLLECTION, userData.id), {
        isVerified: true
      });
    } catch (e: any) {
      if (isFirestoreQuotaError(e)) setFirestoreQuotaExceeded(true);
    }

    saveCachedUser(updatedUser);

    return {
      success: true,
      user: updatedUser
    };
  } catch (err: any) {
    console.error('Error verifying code:', err);
    return { success: false, error: err.message || 'Code verification failed.' };
  }
}

/**
 * Resend 6-Digit Email Verification Code to User's Email
 */
export async function resendVerificationCode(
  identifier: string
): Promise<{ success: boolean; verificationCode?: string; error?: string }> {
  try {
    const rawInput = identifier.trim().toLowerCase();
    let userData: User | null = null;

    try {
      const qEmail = query(collection(db, USERS_COLLECTION), where('email', '==', rawInput));
      let snap = await getDocs(qEmail);

      if (snap.empty) {
        const qOffice = query(collection(db, USERS_COLLECTION), where('officeId', '==', identifier.trim().toUpperCase()));
        snap = await getDocs(qOffice);
      }

      if (!snap.empty) {
        userData = snap.docs[0].data() as User;
      }
    } catch (e: any) {
      if (isFirestoreQuotaError(e)) setFirestoreQuotaExceeded(true);
    }

    if (!userData) {
      const cached = getCachedUsers();
      userData = cached.find(
        u => u.email?.toLowerCase() === rawInput || u.officeId?.toUpperCase() === identifier.trim().toUpperCase()
      ) || null;
    }

    if (!userData) {
      return { success: false, error: `No account found for "${identifier}". Please check your email or create an account.` };
    }

    const newVerificationCode = generateVerificationCode();
    const updatedUser: User = {
      ...userData,
      verificationCode: newVerificationCode
    };

    try {
      await updateDoc(doc(db, USERS_COLLECTION, userData.id), {
        verificationCode: newVerificationCode
      });
    } catch (e: any) {
      if (isFirestoreQuotaError(e)) setFirestoreQuotaExceeded(true);
    }

    saveCachedUser(updatedUser);

    // Send new verification email to user
    await sendStudioMail({
      toEmail: userData.email,
      toName: userData.name,
      fromName: 'RG ArtFlow Operations',
      fromEmail: 'wwemayhemgame@gmail.com',
      subject: `[New Code] Studio Verification Code: ${newVerificationCode}`,
      previewText: `Your new 6-digit verification code is ${newVerificationCode}.`,
      body: `Hello ${userData.name},

You requested a new verification code for your RG ArtFlow studio account registration.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR 6-DIGIT VERIFICATION CODE: ${newVerificationCode}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Office ID: ${userData.officeId || 'OFF-REGISTERED'}
Sent By: RG ArtFlow Operations (wwemayhemgame@gmail.com)

Enter this 6-digit code in the verification screen to confirm your email and forward your access request to Studio Leadership.

If you did not request this code, please ignore this email.`,
      type: 'SECURITY_VERIFICATION',
      verificationCode: newVerificationCode,
      metadata: {
        userId: userData.id,
        officeId: userData.officeId
      }
    });

    return { success: true, verificationCode: newVerificationCode };
  } catch (err: any) {
    console.error('Error resending verification code:', err);
    return { success: false, error: err.message || 'Failed to resend verification code.' };
  }
}

/**
 * Check user approval status in real-time
 */
export async function checkUserStatus(
  identifier: string
): Promise<{ success: boolean; user?: User; status?: string; error?: string }> {
  try {
    const rawInput = identifier.trim().toLowerCase();
    let userData: User | null = null;

    try {
      const qEmail = query(collection(db, USERS_COLLECTION), where('email', '==', rawInput));
      let snap = await getDocs(qEmail);

      if (snap.empty) {
        const qOffice = query(collection(db, USERS_COLLECTION), where('officeId', '==', identifier.trim().toUpperCase()));
        snap = await getDocs(qOffice);
      }

      if (!snap.empty) {
        userData = snap.docs[0].data() as User;
      }
    } catch (e: any) {
      if (isFirestoreQuotaError(e)) setFirestoreQuotaExceeded(true);
    }

    if (!userData) {
      const cached = getCachedUsers();
      userData = cached.find(
        u => u.email?.toLowerCase() === rawInput || u.officeId?.toUpperCase() === identifier.trim().toUpperCase()
      ) || null;
      if (!userData) {
        try {
          const serverUsers = await syncUsersFromServer();
          userData = serverUsers.find(
            u => u.email?.toLowerCase() === rawInput || u.officeId?.toUpperCase() === identifier.trim().toUpperCase()
          ) || null;
        } catch {}
      }
    }

    if (!userData) {
      return { success: false, error: `No account found for "${identifier}".` };
    }

    return { success: true, user: userData, status: userData.status };
  } catch (err: any) {
    console.error('Error checking user status:', err);
    return { success: false, error: err.message || 'Failed to fetch user status.' };
  }
}

/**
 * Accept user login request (Art Manager, Art Director, Admin) with Mail Verification Code
 */
export async function approveUserLoginRequest(
  targetUserId: string,
  approverUser: User,
  customPermissions?: Partial<FieldAccessPermissions>,
  assignedRole?: UserRole
): Promise<{ success: boolean; updatedUser?: User; verificationCode?: string; error?: string }> {
  try {
    const isAuthorized =
      approverUser.role === 'ART_MANAGER' ||
      approverUser.role === 'ART_DIRECTOR' ||
      approverUser.role === 'ADMIN';

    if (!isAuthorized) {
      return {
        success: false,
        error: 'Only Art Managers, Art Directors, and Administrators can accept user logins.'
      };
    }

    let existingData: User | null = null;
    try {
      const userRef = doc(db, USERS_COLLECTION, targetUserId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        existingData = userDoc.data() as User;
      }
    } catch (e: any) {
      if (isFirestoreQuotaError(e)) setFirestoreQuotaExceeded(true);
    }

    if (!existingData) {
      const cached = getCachedUsers();
      existingData = cached.find(u => u.id === targetUserId) || null;
    }

    if (!existingData) {
      return { success: false, error: 'User not found.' };
    }

    const finalRole = assignedRole || existingData.role;
    const basePermissions = defaultFieldPermissionsForRole(finalRole);
    const finalPermissions = {
      ...basePermissions,
      ...(existingData.fieldPermissions || {}),
      ...(customPermissions || {})
    };

    const activationCode = generateVerificationCode();

    const updates: Record<string, any> = {
      status: 'ACTIVE',
      role: finalRole,
      approvedBy: approverUser.id,
      approvedByName: approverUser.name,
      approvedAt: new Date().toISOString(),
      fieldPermissions: finalPermissions,
      verificationCode: activationCode,
      isVerified: true
    };

    try {
      const userRef = doc(db, USERS_COLLECTION, targetUserId);
      await updateDoc(userRef, {
        ...updates,
        rejectionReason: deleteField()
      });
    } catch (e: any) {
      if (isFirestoreQuotaError(e)) setFirestoreQuotaExceeded(true);
    }

    const updatedUserObj: User = {
      ...existingData,
      status: 'ACTIVE',
      role: finalRole,
      approvedBy: approverUser.id,
      approvedByName: approverUser.name,
      approvedAt: updates.approvedAt,
      fieldPermissions: finalPermissions,
      verificationCode: activationCode,
      isVerified: true,
      rejectionReason: undefined
    };

    saveCachedUser(updatedUserObj);

    // Dispatch official Approval Mail with Verification Code to User's Inbox
    await sendStudioMail({
      toEmail: existingData.email,
      toName: existingData.name,
      fromName: `${approverUser.name} (${approverUser.role.replace('_', ' ')})`,
      fromEmail: approverUser.email,
      subject: `🎉 Studio Access Approved! Activation Code: ${activationCode}`,
      previewText: `Welcome to the studio team. Your account has been verified and activated.`,
      body: `Congratulations ${existingData.name},

Your studio access request has been officially APPROVED by ${approverUser.name} (${approverUser.title}).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACCESS CREDENTIALS & PERMISSIONS
• Assigned Role: ${finalRole.replace('_', ' ')}
• Department: ${existingData.department}
• 6-Digit Activation Code: ${activationCode}
• Account Status: ACTIVE & VERIFIED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You can now log in using your work email (${existingData.email}) and password, or use your 6-digit activation code (${activationCode}).

Welcome aboard and happy creating!`,
      type: 'APPROVAL_CODE',
      verificationCode: activationCode,
      userRole: finalRole,
      metadata: {
        userId: targetUserId,
        role: finalRole
      }
    });

    return {
      success: true,
      updatedUser: updatedUserObj,
      verificationCode: activationCode
    };
  } catch (err: any) {
    console.error('Error approving user:', err);
    return { success: false, error: err.message || 'Approval update failed.' };
  }
}

/**
 * Reject user login request with Mail Verification Code
 */
export async function rejectUserLoginRequest(
  targetUserId: string,
  approverUser: User,
  reason: string
): Promise<{ success: boolean; verificationCode?: string; error?: string }> {
  try {
    const isAuthorized =
      approverUser.role === 'ART_MANAGER' ||
      approverUser.role === 'ART_DIRECTOR' ||
      approverUser.role === 'ADMIN';

    if (!isAuthorized) {
      return { success: false, error: 'Unauthorized to reject users.' };
    }

    let existingData: User | null = null;
    try {
      const userRef = doc(db, USERS_COLLECTION, targetUserId);
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        existingData = userDoc.data() as User;
      }
    } catch (e: any) {
      if (isFirestoreQuotaError(e)) setFirestoreQuotaExceeded(true);
    }

    if (!existingData) {
      const cached = getCachedUsers();
      existingData = cached.find(u => u.id === targetUserId) || null;
    }

    if (!existingData) {
      return { success: false, error: 'User not found.' };
    }

    const rejectReferenceCode = generateVerificationCode();
    const finalReason = reason || 'Access criteria not met for studio workspace.';

    try {
      const userRef = doc(db, USERS_COLLECTION, targetUserId);
      await updateDoc(userRef, {
        status: 'REJECTED',
        rejectionReason: finalReason,
        approvedBy: approverUser.id,
        approvedByName: approverUser.name,
        approvedAt: new Date().toISOString(),
        verificationCode: rejectReferenceCode,
        isVerified: false
      });
    } catch (e: any) {
      if (isFirestoreQuotaError(e)) setFirestoreQuotaExceeded(true);
    }

    const updatedUserObj: User = {
      ...existingData,
      status: 'REJECTED',
      rejectionReason: finalReason,
      approvedBy: approverUser.id,
      approvedByName: approverUser.name,
      approvedAt: new Date().toISOString(),
      verificationCode: rejectReferenceCode,
      isVerified: false
    };

    saveCachedUser(updatedUserObj);

    // Dispatch official Rejection Notice with Reference Code to User's Inbox
    await sendStudioMail({
      toEmail: existingData.email,
      toName: existingData.name,
      fromName: `${approverUser.name} (${approverUser.role.replace('_', ' ')})`,
      fromEmail: approverUser.email,
      subject: `Studio Access Request Update — Reference Code: ${rejectReferenceCode}`,
      previewText: `Your access request has been reviewed by leadership.`,
      body: `Hello ${existingData.name},

Thank you for your interest. After review by studio leadership (${approverUser.name}), your studio access request has been declined.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DECISION DETAILS
• Status: DECLINED
• Reason: ${finalReason}
• Appeal Reference Code: ${rejectReferenceCode}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If you believe this decision is in error or your department assignments have changed, please contact Studio Art Operations and provide your Reference Code (${rejectReferenceCode}).`,
      type: 'REJECTION_NOTICE',
      verificationCode: rejectReferenceCode,
      userRole: existingData.role,
      metadata: {
        userId: targetUserId,
        reason: finalReason
      }
    });

    return { success: true, verificationCode: rejectReferenceCode };
  } catch (err: any) {
    console.error('Error rejecting user:', err);
    return { success: false, error: err.message || 'Rejection update failed.' };
  }
}

/**
 * Update user permissions and access fields in Firestore
 */
export async function updateUserFieldPermissions(
  targetUserId: string,
  fieldPermissions: FieldAccessPermissions
): Promise<boolean> {
  try {
    try {
      const userRef = doc(db, USERS_COLLECTION, targetUserId);
      await updateDoc(userRef, {
        fieldPermissions
      });
    } catch (e: any) {
      if (isFirestoreQuotaError(e)) setFirestoreQuotaExceeded(true);
    }

    const cached = getCachedUsers();
    const user = cached.find(u => u.id === targetUserId);
    if (user) {
      saveCachedUser({ ...user, fieldPermissions });
    }
    return true;
  } catch (err) {
    console.error('Error updating user permissions:', err);
    return false;
  }
}

/**
 * Initiate a Password Reset request for an existing user
 * Generates a secure 6-digit Reset OTP and dispatches it from ranjeet.patil@zapak.com
 */
export async function requestPasswordReset(
  identifier: string
): Promise<{ success: boolean; email?: string; resetCode?: string; error?: string }> {
  try {
    const rawInput = identifier.trim().toLowerCase();
    let userData: User | null = null;

    try {
      const qEmail = query(collection(db, USERS_COLLECTION), where('email', '==', rawInput));
      let snap = await getDocs(qEmail);

      if (snap.empty) {
        const qOffice = query(collection(db, USERS_COLLECTION), where('officeId', '==', identifier.trim().toUpperCase()));
        snap = await getDocs(qOffice);
      }

      if (!snap.empty) {
        userData = snap.docs[0].data() as User;
      }
    } catch (e: any) {
      if (isFirestoreQuotaError(e)) setFirestoreQuotaExceeded(true);
    }

    if (!userData) {
      const cached = getCachedUsers();
      userData = cached.find(
        u => u.email?.toLowerCase() === rawInput || u.officeId?.toUpperCase() === identifier.trim().toUpperCase()
      ) || null;
    }

    if (!userData) {
      if (rawInput === 'ranjeet.patil@zapak.com' || rawInput === 'wwemayhemgame@gmail.com' || identifier.trim().toUpperCase() === 'OFF-1001') {
        const adminEmail = rawInput.includes('@') ? rawInput : 'ranjeet.patil@zapak.com';
        userData = {
          id: 'user-ranjeet',
          name: 'Ranjeet Patil',
          email: adminEmail,
          officeId: 'OFF-1001',
          password: 'password123',
          role: 'ADMIN',
          artistId: 'artist-ranjeet',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          department: 'Studio Leadership',
          title: 'Studio Administrator & Head of Art',
          status: 'ACTIVE',
          createdAt: new Date().toISOString()
        };
        saveCachedUser(userData);
      }
    }

    if (!userData) {
      return { success: false, error: `No registered account found for "${identifier}". Please check your email or create a new account.` };
    }

    const resetCode = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes expiration

    try {
      await updateDoc(doc(db, USERS_COLLECTION, userData.id), {
        resetCode,
        resetCodeExpiresAt: expiresAt,
        verificationCode: resetCode
      });
    } catch (e: any) {
      if (isFirestoreQuotaError(e)) setFirestoreQuotaExceeded(true);
    }

    saveCachedUser({
      ...userData,
      resetCode,
      resetCodeExpiresAt: expiresAt,
      verificationCode: resetCode
    });

    // Dispatch Password Reset Email to user's registered inbox
    await sendStudioMail({
      toEmail: userData.email,
      toName: userData.name,
      fromName: 'RG ArtFlow Operations',
      fromEmail: 'wwemayhemgame@gmail.com',
      subject: `[Password Reset] Your 6-Digit Reset Code: ${resetCode}`,
      previewText: `Use reset code ${resetCode} to create a new password for your RG ArtFlow account.`,
      body: `Hello ${userData.name},

A password reset request was initiated for your RG ArtFlow studio account.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR 6-DIGIT PASSWORD RESET CODE: ${resetCode}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Account: ${userData.email}
Office ID: ${userData.officeId || 'OFF-REGISTERED'}
Sent By: RG ArtFlow Operations (wwemayhemgame@gmail.com)
Expires in: 30 minutes

Please enter this 6-digit code on the Password Reset screen and choose your new password.

If you did not request this password reset, please contact Studio Support immediately at wwemayhemgame@gmail.com.`,
      type: 'PASSWORD_RESET',
      verificationCode: resetCode,
      userRole: userData.role,
      metadata: {
        userId: userData.id,
        officeId: userData.officeId,
        action: 'PASSWORD_RESET'
      }
    });

    return { success: true, email: userData.email, resetCode };
  } catch (err: any) {
    console.error('Error requesting password reset:', err);
    return { success: false, error: err.message || 'Failed to initiate password reset.' };
  }
}

/**
 * Reset User Password with 6-Digit Reset Code
 */
export async function resetUserPassword(
  identifier: string,
  resetCode: string,
  newPassword: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const rawInput = identifier.trim().toLowerCase();
    const cleanCode = resetCode.trim();

    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, error: 'Password must be at least 4 characters long.' };
    }

    let userData: User | null = null;
    try {
      const qEmail = query(collection(db, USERS_COLLECTION), where('email', '==', rawInput));
      let snap = await getDocs(qEmail);

      if (snap.empty) {
        const qOffice = query(collection(db, USERS_COLLECTION), where('officeId', '==', identifier.trim().toUpperCase()));
        snap = await getDocs(qOffice);
      }

      if (!snap.empty) {
        userData = snap.docs[0].data() as User;
      }
    } catch (e: any) {
      if (isFirestoreQuotaError(e)) setFirestoreQuotaExceeded(true);
    }

    if (!userData) {
      const cached = getCachedUsers();
      userData = cached.find(
        u => u.email?.toLowerCase() === rawInput || u.officeId?.toUpperCase() === identifier.trim().toUpperCase()
      ) || null;
    }

    if (!userData) {
      return { success: false, error: `Account "${identifier}" not found.` };
    }

    // Validate reset code
    const validCode = userData.resetCode || userData.verificationCode;
    if (!validCode || validCode !== cleanCode) {
      return { success: false, error: 'Invalid 6-digit reset code. Please check your email or request a new code.' };
    }

    // Check expiration if present
    if (userData.resetCodeExpiresAt) {
      const expired = new Date(userData.resetCodeExpiresAt).getTime() < Date.now();
      if (expired) {
        return { success: false, error: 'This reset code has expired. Please request a new password reset code.' };
      }
    }

    // Update password in Firestore
    const updatedUser: User = {
      ...userData,
      password: newPassword.trim(),
      resetCode: undefined,
      resetCodeExpiresAt: undefined,
      isVerified: true
    };

    try {
      await updateDoc(doc(db, USERS_COLLECTION, userData.id), {
        password: newPassword.trim(),
        resetCode: null,
        resetCodeExpiresAt: null,
        isVerified: true
      });
    } catch (e: any) {
      if (isFirestoreQuotaError(e)) setFirestoreQuotaExceeded(true);
    }

    saveCachedUser(updatedUser);

    // Send confirmation email
    await sendStudioMail({
      toEmail: userData.email,
      toName: userData.name,
      fromName: 'RG ArtFlow Operations',
      fromEmail: 'wwemayhemgame@gmail.com',
      subject: `[Confirmed] Password Successfully Reset - RG ArtFlow`,
      previewText: `Your RG ArtFlow studio account password has been updated.`,
      body: `Hello ${userData.name},

Your password for your RG ArtFlow studio account has been successfully reset.

You can now sign in using your work email (${userData.email}) or Office ID (${userData.officeId || 'OFF-REGISTERED'}) and your new password.

If you did not perform this change, please contact Studio Support immediately at wwemayhemgame@gmail.com.

Best regards,
RG ArtFlow Operations & Studio Leadership`,
      type: 'SECURITY_VERIFICATION',
      userRole: userData.role,
      metadata: {
        userId: userData.id,
        officeId: userData.officeId
      }
    });

    return { success: true, user: updatedUser };
  } catch (err: any) {
    console.error('Error resetting user password:', err);
    return { success: false, error: err.message || 'Failed to update password.' };
  }
}

