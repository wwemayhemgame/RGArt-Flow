import { Project } from '../types';

/**
 * Normalizes project name for clean comparison:
 * Lowercases, replaces punctuation (hyphens, underscores, dots, slashes) with spaces,
 * removes non-alphanumeric characters, collapses multiple whitespace, and trims.
 */
export function normalizeProjectName(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[_\-./\\#@!$%^&*()+=[\]{}|;:'",<>?]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips all spaces from normalized name (e.g. "amdinternal")
 */
export function stripSpaces(text: string): string {
  return normalizeProjectName(text).replace(/\s+/g, '');
}

/**
 * Computes Levenshtein edit distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Checks if a project name or key corresponds to AMD - Internal (or legacy aliases)
 */
export function isAmdInternalProject(projectOrName: string | { id?: string; name?: string; key?: string }): boolean {
  if (!projectOrName) return false;

  let id = '';
  let name = '';
  let key = '';

  if (typeof projectOrName === 'string') {
    name = projectOrName;
  } else {
    id = projectOrName.id || '';
    name = projectOrName.name || '';
    key = projectOrName.key || '';
  }

  if (id === 'proj-amd' || id === 'proj-ad' || id === 'proj-americandad') {
    return true;
  }

  const normKey = key.trim().toUpperCase();
  if (normKey === 'AMD' || normKey === 'AMDI' || normKey === 'AD' || normKey === 'AMDINT' || normKey === 'AMDART') {
    return true;
  }

  const norm = normalizeProjectName(name);
  const stripped = stripSpaces(name);

  if (
    norm === 'amd internal' ||
    norm === 'amd' ||
    norm === 'american dad' ||
    norm === 'amd game' ||
    stripped === 'amdinternal' ||
    (norm.includes('amd') && norm.includes('internal')) ||
    norm.startsWith('amd internal') ||
    norm.startsWith('american dad')
  ) {
    return true;
  }

  return false;
}

const GENERIC_PROJECT_WORDS = new Set([
  'art',
  'arts',
  'asset',
  'assets',
  'game',
  'games',
  'project',
  'projects',
  'studio',
  'studios',
  'team',
  'teams',
  'pipeline',
  'internal',
  'the'
]);

/**
 * Determines if two project names are identical, duplicate, or confusingly similar.
 * Examples that return true:
 * - "AMD - Internal" vs "AMD - Internal "
 * - "AMD - Internal" vs "AMD-Internal"
 * - "AMD - Internal" vs "amd internal"
 * - "AMD - Internal" vs "AMD Internal"
 * - "WWE Mayhem" vs "WWE Mayhem Game"
 * - "WWE Mayhem" vs "WWE-Mayhem"
 */
export function areProjectNamesSimilar(nameA: string, nameB: string): boolean {
  if (!nameA || !nameB) return false;

  const rawA = nameA.trim().toLowerCase();
  const rawB = nameB.trim().toLowerCase();
  if (rawA === rawB) return true;

  // Check AMD - Internal specifically
  if (isAmdInternalProject(nameA) && isAmdInternalProject(nameB)) {
    return true;
  }

  const normA = normalizeProjectName(nameA);
  const normB = normalizeProjectName(nameB);
  if (normA === normB) return true;

  const stripA = stripSpaces(nameA);
  const stripB = stripSpaces(nameB);
  if (stripA === stripB) return true;

  // Filter out generic noise words to compare core semantic tokens
  const tokensA = normA.split(' ').filter(t => t.length > 1 && !GENERIC_PROJECT_WORDS.has(t));
  const tokensB = normB.split(' ').filter(t => t.length > 1 && !GENERIC_PROJECT_WORDS.has(t));

  if (tokensA.length > 0 && tokensB.length > 0) {
    const stemA = tokensA.join(' ');
    const stemB = tokensB.join(' ');
    if (stemA === stemB) return true;

    // One stem contains the other completely and difference is just generic words
    if ((normA.includes(normB) || normB.includes(normA)) && Math.abs(normA.length - normB.length) <= 10) {
      const remainingWords = (normA.length > normB.length ? normA : normB)
        .split(' ')
        .filter(w => !tokensA.includes(w) && !tokensB.includes(w));
      if (remainingWords.every(w => GENERIC_PROJECT_WORDS.has(w))) {
        return true;
      }
    }
  }

  // Fuzzy Levenshtein match for small typos (distance <= 2 for strings with length >= 6)
  const minLen = Math.min(normA.length, normB.length);
  const maxLen = Math.max(normA.length, normB.length);
  if (minLen >= 6 && maxLen - minLen <= 2) {
    const dist = levenshteinDistance(normA, normB);
    if (dist <= 2) {
      const similarity = 1 - dist / maxLen;
      if (similarity >= 0.8) {
        return true;
      }
    }
  }

  return false;
}

export interface ProjectConflictResult {
  project: Project;
  conflictType: 'SIMILAR_NAME' | 'DUPLICATE_KEY' | 'AMD_INTERNAL_DUPLICATE';
  reason: string;
}

/**
 * Searches for an existing project with a similar name, duplicate key, or AMD collision.
 */
export function findSimilarProject(
  name: string,
  key: string,
  existingProjects: Project[],
  excludeProjectId?: string
): ProjectConflictResult | null {
  const cleanName = (name || '').trim();
  const cleanKey = (key || '').trim().toUpperCase();

  const candidates = existingProjects.filter(p => !excludeProjectId || p.id !== excludeProjectId);

  for (const p of candidates) {
    // 1. Key collision
    if (cleanKey && p.key.trim().toUpperCase() === cleanKey) {
      return {
        project: p,
        conflictType: 'DUPLICATE_KEY',
        reason: `Project key "${cleanKey}" is already in use by project "${p.name}".`
      };
    }

    // 2. AMD - Internal collision
    if (isAmdInternalProject({ name: cleanName, key: cleanKey }) && isAmdInternalProject(p)) {
      return {
        project: p,
        conflictType: 'AMD_INTERNAL_DUPLICATE',
        reason: `A single canonical "AMD - Internal" project already exists (Key: ${p.key}). Duplicate AMD projects are not allowed.`
      };
    }

    // 3. Name similarity collision
    if (cleanName && areProjectNamesSimilar(p.name, cleanName)) {
      return {
        project: p,
        conflictType: 'SIMILAR_NAME',
        reason: `A project with a similar name already exists: "${p.name}" (Key: ${p.key}). Duplicate or similar project names are not allowed.`
      };
    }
  }

  return null;
}
