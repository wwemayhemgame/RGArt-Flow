import { Artist, User, Task, JiraUserMapping } from '../types';

/**
 * Normalizes user display names for reliable matching:
 * - Lowercases and trims
 * - Removes parentheses/brackets and roles e.g. "Ranjeet Patil (Art Lead)" -> "ranjeet patil"
 * - Handles comma reversal e.g. "Patil, Ranjeet" -> "ranjeet patil"
 * - Normalizes multiple spaces
 */
export function normalizeUserName(rawName?: string | null): string {
  if (!rawName) return '';
  let cleaned = rawName
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\{.*?\}/g, '')
    .replace(/<.*?>/g, '')
    .trim();

  // If "Last, First" format, flip to "First Last"
  if (cleaned.includes(',')) {
    const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length === 2) {
      cleaned = `${parts[1]} ${parts[0]}`;
    }
  }

  return cleaned.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Seed default mappings for core studio members (Requirements 357, 358, 359)
 */
export const DEFAULT_STUDIO_USER_MAPPINGS: JiraUserMapping[] = [
  {
    jiraAccountId: 'jira-ranjeet-patil',
    jiraDisplayName: 'Ranjeet Patil',
    jiraEmail: 'ranjeet.patil@zapak.com',
    studioUserId: 'user-ranjeet',
    studioArtistId: 'artist-ranjeet',
    studioUserName: 'Ranjeet Patil',
    status: 'MAPPED',
    lastMappedAt: new Date().toISOString()
  },
  {
    jiraAccountId: 'jira-pramod-jadhav',
    jiraDisplayName: 'Pramod Jadhav',
    jiraEmail: 'pramod.jadhav@zapak.com',
    studioUserId: 'user-pramod',
    studioArtistId: 'artist-pramod',
    studioUserName: 'Pramod Jadhav',
    status: 'MAPPED',
    lastMappedAt: new Date().toISOString()
  }
];

export interface JiraAssigneeInput {
  accountId?: string | null;
  displayName?: string | null;
  email?: string | null;
  name?: string | null;
}

export interface ResolvedJiraAssigneeResult {
  isUnassigned: boolean;
  needsMapping: boolean;
  artistId?: string;
  artist?: Artist;
  userId?: string;
  user?: User;
  displayName: string;
  jiraAssigneeName?: string;
  jiraAssigneeAccountId?: string;
  jiraAssigneeEmail?: string;
}

/**
 * Resolves a Jira assignee to a Studio Artist / User with multi-level fallback:
 * 1. Explicit userMappings list (by accountId, normalized name, email)
 * 2. Exact or token match in `artists` list
 * 3. Match in `users` list and find their linked artist
 * 4. Fallback for well-known studio users (Ranjeet Patil -> artist-ranjeet, Pramod Jadhav -> artist-pramod)
 * 5. If Jira has an assignee but no match -> returns `needsMapping: true` (NEVER silently Unassigned!)
 */
export function resolveJiraAssigneeToStudio(
  jiraAssignee: JiraAssigneeInput | undefined | null,
  artists: Artist[],
  users: User[],
  userMappings: JiraUserMapping[] = []
): ResolvedJiraAssigneeResult {
  const accountId = jiraAssignee?.accountId || jiraAssignee?.name || undefined;
  const rawDisplayName = jiraAssignee?.displayName || jiraAssignee?.name || undefined;
  const rawEmail = jiraAssignee?.email || undefined;

  // Genuine Jira unassigned ticket
  if (!rawDisplayName && !accountId && !rawEmail) {
    return {
      isUnassigned: true,
      needsMapping: false,
      displayName: 'Unassigned'
    };
  }

  const normJiraName = normalizeUserName(rawDisplayName);
  const normEmail = (rawEmail || '').trim().toLowerCase();

  // If Jira explicitly says "Unassigned"
  if (normJiraName === 'unassigned' || normJiraName === 'none' || normJiraName === '') {
    return {
      isUnassigned: true,
      needsMapping: false,
      displayName: 'Unassigned'
    };
  }

  // Combine stored user mappings with defaults
  const allMappings: JiraUserMapping[] = [...userMappings];
  for (const def of DEFAULT_STUDIO_USER_MAPPINGS) {
    if (!allMappings.some(m => m.jiraDisplayName.toLowerCase() === def.jiraDisplayName.toLowerCase())) {
      allMappings.push(def);
    }
  }

  // Step 1: Check explicit user mappings by Account ID
  if (accountId) {
    const mapByAcc = allMappings.find(
      m => m.jiraAccountId === accountId && m.status === 'MAPPED'
    );
    if (mapByAcc) {
      const art = artists.find(a => a.id === mapByAcc.studioArtistId);
      const usr = users.find(u => u.id === mapByAcc.studioUserId);
      if (art || usr) {
        return {
          isUnassigned: false,
          needsMapping: false,
          artistId: art?.id || mapByAcc.studioArtistId,
          artist: art,
          userId: usr?.id || mapByAcc.studioUserId,
          user: usr,
          displayName: art?.name || usr?.name || mapByAcc.studioUserName || rawDisplayName!,
          jiraAssigneeName: rawDisplayName,
          jiraAssigneeAccountId: accountId,
          jiraAssigneeEmail: rawEmail || undefined
        };
      }
    }
  }

  // Step 2: Check explicit user mappings by normalized name
  if (normJiraName) {
    const mapByName = allMappings.find(
      m => normalizeUserName(m.jiraDisplayName) === normJiraName && m.status === 'MAPPED'
    );
    if (mapByName) {
      const art = artists.find(a => a.id === mapByName.studioArtistId);
      const usr = users.find(u => u.id === mapByName.studioUserId);
      return {
        isUnassigned: false,
        needsMapping: false,
        artistId: art?.id || mapByName.studioArtistId,
        artist: art,
        userId: usr?.id || mapByName.studioUserId,
        user: usr,
        displayName: art?.name || usr?.name || mapByName.studioUserName || rawDisplayName!,
        jiraAssigneeName: rawDisplayName,
        jiraAssigneeAccountId: accountId,
        jiraAssigneeEmail: rawEmail || undefined
      };
    }
  }

  // Step 3: Check explicit user mappings by email
  if (normEmail) {
    const mapByEmail = allMappings.find(
      m => m.jiraEmail && m.jiraEmail.toLowerCase() === normEmail && m.status === 'MAPPED'
    );
    if (mapByEmail) {
      const art = artists.find(a => a.id === mapByEmail.studioArtistId);
      const usr = users.find(u => u.id === mapByEmail.studioUserId);
      return {
        isUnassigned: false,
        needsMapping: false,
        artistId: art?.id || mapByEmail.studioArtistId,
        artist: art,
        userId: usr?.id || mapByEmail.studioUserId,
        user: usr,
        displayName: art?.name || usr?.name || mapByEmail.studioUserName || rawDisplayName!,
        jiraAssigneeName: rawDisplayName,
        jiraAssigneeAccountId: accountId,
        jiraAssigneeEmail: rawEmail || undefined
      };
    }
  }

  // Step 4: Search direct match in `artists` list
  for (const art of artists) {
    const normArtName = normalizeUserName(art.name);
    const normArtEmail = (art.email || '').trim().toLowerCase();

    // Exact name match
    if (normArtName && normArtName === normJiraName) {
      return {
        isUnassigned: false,
        needsMapping: false,
        artistId: art.id,
        artist: art,
        displayName: art.name,
        jiraAssigneeName: rawDisplayName,
        jiraAssigneeAccountId: accountId,
        jiraAssigneeEmail: rawEmail || undefined
      };
    }

    // Email match
    if (normEmail && normArtEmail && normArtEmail === normEmail) {
      return {
        isUnassigned: false,
        needsMapping: false,
        artistId: art.id,
        artist: art,
        displayName: art.name,
        jiraAssigneeName: rawDisplayName,
        jiraAssigneeAccountId: accountId,
        jiraAssigneeEmail: rawEmail || undefined
      };
    }

    // Token matching (e.g. "Ranjeet Patil" matches "Ranjeet Patil")
    if (normJiraName && normArtName) {
      const jiraTokens = normJiraName.split(' ').filter(t => t.length > 2);
      const artTokens = normArtName.split(' ').filter(t => t.length > 2);
      if (jiraTokens.length >= 2 && artTokens.length >= 2) {
        const matchesAll = jiraTokens.every(jt => artTokens.includes(jt));
        if (matchesAll) {
          return {
            isUnassigned: false,
            needsMapping: false,
            artistId: art.id,
            artist: art,
            displayName: art.name,
            jiraAssigneeName: rawDisplayName,
            jiraAssigneeAccountId: accountId,
            jiraAssigneeEmail: rawEmail || undefined
          };
        }
      }
    }
  }

  // Step 5: Search direct match in `users` list
  for (const usr of users) {
    const normUsrName = normalizeUserName(usr.name);
    const normUsrEmail = (usr.email || '').trim().toLowerCase();

    if ((normUsrName && normUsrName === normJiraName) || (normEmail && normUsrEmail && normUsrEmail === normEmail)) {
      const linkedArtist = artists.find(a => a.id === usr.artistId || a.userId === usr.id || normalizeUserName(a.name) === normUsrName);
      return {
        isUnassigned: false,
        needsMapping: false,
        artistId: linkedArtist?.id || usr.artistId,
        artist: linkedArtist,
        userId: usr.id,
        user: usr,
        displayName: usr.name,
        jiraAssigneeName: rawDisplayName,
        jiraAssigneeAccountId: accountId,
        jiraAssigneeEmail: rawEmail || undefined
      };
    }
  }

  // Step 6: Targeted Seed Recognition (Requirements 357 & 359)
  // "Ranjeet Patil" -> artist-ranjeet
  if (normJiraName.includes('ranjeet') && normJiraName.includes('patil')) {
    const ranjeetArt = artists.find(a => a.id === 'artist-ranjeet' || normalizeUserName(a.name).includes('ranjeet'));
    const ranjeetUser = users.find(u => u.id === 'user-ranjeet');
    return {
      isUnassigned: false,
      needsMapping: false,
      artistId: ranjeetArt?.id || 'artist-ranjeet',
      artist: ranjeetArt,
      userId: ranjeetUser?.id || 'user-ranjeet',
      user: ranjeetUser,
      displayName: ranjeetArt?.name || ranjeetUser?.name || 'Ranjeet Patil',
      jiraAssigneeName: rawDisplayName,
      jiraAssigneeAccountId: accountId,
      jiraAssigneeEmail: rawEmail || undefined
    };
  }

  // "Pramod Jadhav" -> artist-pramod
  if (normJiraName.includes('pramod') && normJiraName.includes('jadhav')) {
    const pramodArt = artists.find(a => a.id === 'artist-pramod' || normalizeUserName(a.name).includes('pramod'));
    const pramodUser = users.find(u => u.id === 'user-pramod');
    return {
      isUnassigned: false,
      needsMapping: false,
      artistId: pramodArt?.id || 'artist-pramod',
      artist: pramodArt,
      userId: pramodUser?.id || 'user-pramod',
      user: pramodUser,
      displayName: pramodArt?.name || pramodUser?.name || 'Pramod Jadhav',
      jiraAssigneeName: rawDisplayName,
      jiraAssigneeAccountId: accountId,
      jiraAssigneeEmail: rawEmail || undefined
    };
  }

  // Step 7: Requirement 360: DO NOT SILENTLY CONVERT TO UNASSIGNED!
  // Jira has an assignee, but no Studio user could be matched.
  return {
    isUnassigned: false,
    needsMapping: true,
    displayName: rawDisplayName || 'Jira Assignee Mapping Required',
    jiraAssigneeName: rawDisplayName,
    jiraAssigneeAccountId: accountId,
    jiraAssigneeEmail: rawEmail || undefined
  };
}

/**
 * Universal Assignee Display Helper (Requirement 361)
 * Used across TaskDetailModal, UniversalTaskTable, Kanban, Reports, etc.
 * Guarantees consistent assignee representation everywhere.
 */
export function getTaskAssigneeDisplay(
  task: Task,
  artists: Artist[],
  users: User[] = [],
  userMappings: JiraUserMapping[] = []
): {
  displayName: string;
  artist?: Artist;
  user?: User;
  isUnassigned: boolean;
  needsMapping: boolean;
  jiraAssigneeName?: string;
  avatar?: string;
} {
  // 1. If artistId is explicitly assigned and found in artists
  if (task.artistId) {
    const matchedArtist = artists.find(a => a.id === task.artistId);
    if (matchedArtist) {
      return {
        displayName: matchedArtist.name,
        artist: matchedArtist,
        isUnassigned: false,
        needsMapping: false,
        avatar: matchedArtist.avatar
      };
    }
  }

  // 2. If task has Jira assignee information
  if (task.jiraOriginalAssignee || task.jiraAssigneeAccountId || task.jiraAssigneeEmail) {
    const resolution = resolveJiraAssigneeToStudio(
      {
        displayName: task.jiraOriginalAssignee,
        accountId: task.jiraAssigneeAccountId,
        email: task.jiraAssigneeEmail
      },
      artists,
      users,
      userMappings
    );

    if (!resolution.isUnassigned) {
      if (resolution.artist) {
        return {
          displayName: resolution.artist.name,
          artist: resolution.artist,
          user: resolution.user,
          isUnassigned: false,
          needsMapping: false,
          avatar: resolution.artist.avatar
        };
      }

      if (resolution.needsMapping) {
        return {
          displayName: resolution.displayName,
          isUnassigned: false,
          needsMapping: true,
          jiraAssigneeName: resolution.jiraAssigneeName,
          avatar: undefined
        };
      }

      return {
        displayName: resolution.displayName,
        isUnassigned: false,
        needsMapping: false,
        avatar: undefined
      };
    }
  }

  // 3. Truly unassigned
  return {
    displayName: 'Unassigned',
    isUnassigned: true,
    needsMapping: false,
    avatar: undefined
  };
}

/**
 * Controlled reconciliation for existing Jira-linked tasks (Requirement 372)
 * For every task where Jira Assignee = valid user but Studio Assignee = Unassigned,
 * automatically corrects Studio Assignee after successful mapping and records revision history.
 */
export function reconcileJiraTaskAssignees(
  tasks: Task[],
  artists: Artist[],
  users: User[] = [],
  userMappings: JiraUserMapping[] = []
): {
  updatedTasks: Task[];
  correctedCount: number;
  correctedTaskKeys: string[];
} {
  let correctedCount = 0;
  const correctedTaskKeys: string[] = [];

  const updatedTasks = tasks.map(task => {
    // Only reconcile Jira-linked tasks
    if (!task.isJiraImported && !task.jiraIssueKey) {
      return task;
    }

    // Check if task needs correction (missing artistId or flagged as needsMapping)
    const currentArtist = artists.find(a => a.id === task.artistId);
    const needsCorrection = !currentArtist && (task.jiraOriginalAssignee || task.jiraAssigneeAccountId);

    if (!needsCorrection) {
      return task;
    }

    const resolution = resolveJiraAssigneeToStudio(
      {
        displayName: task.jiraOriginalAssignee,
        accountId: task.jiraAssigneeAccountId,
        email: task.jiraAssigneeEmail
      },
      artists,
      users,
      userMappings
    );

    if (resolution.artistId && resolution.artist) {
      correctedCount++;
      correctedTaskKeys.push(task.jiraIssueKey || task.id);

      const oldAssigneeName = 'Unassigned';
      const newAssigneeName = resolution.artist.name;

      const nowIso = new Date().toISOString();
      const updatedRevisions = [...(task.revisions || [])];
      updatedRevisions.push({
        id: `rev-reconcile-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        revisionNumber: (task.revisionCount || 0) + 1,
        feedback: `Jira Sync: Assignee corrected: ${oldAssigneeName} → ${newAssigneeName}`,
        changesDescription: `Assignee corrected: ${oldAssigneeName} → ${newAssigneeName}`,
        status: task.status,
        date: nowIso,
        reviewedBy: 'Jira User Matcher'
      });

      return {
        ...task,
        artistId: resolution.artistId,
        jiraAssigneeNeedsMapping: false,
        revisions: updatedRevisions,
        revisionCount: (task.revisionCount || 0) + 1
      };
    }

    return task;
  });

  return { updatedTasks, correctedCount, correctedTaskKeys };
}

/**
 * Checks if a Jira issue's assignee matches the selected import filter (Requirements 362, 364, 369)
 * Uses Jira Account ID / User ID / Display Name to prevent name collision.
 */
export function isAssigneeSelectedForImport(
  issueAssignee: {
    accountId?: string | null;
    displayName?: string | null;
    email?: string | null;
    name?: string | null;
  } | undefined,
  selectedAssigneeKeys?: string[]
): boolean {
  // If no filter is specified, all issues are eligible
  if (!selectedAssigneeKeys || selectedAssigneeKeys.length === 0 || selectedAssigneeKeys.includes('ALL')) {
    return true;
  }

  // If issue is unassigned
  if (!issueAssignee || (!issueAssignee.displayName && !issueAssignee.accountId && !issueAssignee.name)) {
    return selectedAssigneeKeys.includes('UNASSIGNED');
  }

  const accId = issueAssignee.accountId || issueAssignee.name || '';
  const normName = normalizeUserName(issueAssignee.displayName || issueAssignee.name);
  const email = (issueAssignee.email || '').toLowerCase().trim();

  return selectedAssigneeKeys.some(selected => {
    const selNorm = normalizeUserName(selected);
    return (
      (accId && selected === accId) ||
      (email && selected.toLowerCase() === email) ||
      (normName && (normName === selNorm || normName.includes(selNorm) || selNorm.includes(normName)))
    );
  });
}
