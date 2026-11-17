import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import cfg from '../firebase-applet-config.json' with { type: 'json' };

const app = initializeApp(cfg);
const db = getFirestore(app, cfg.firestoreDatabaseId);

const isFinished = (st?: string) => {
  const s = (st || '').toUpperCase().replace(/[\s_-]+/g, '');
  return s === 'COMPLETED' || s === 'DONE' || s === 'RESOLVED' || s === 'CLOSED';
};

async function executeMigration() {
  console.log('🚀 Starting sprint migration & moving pending tasks to active sprint...');

  const nowIso = new Date().toISOString();
  const taskSnap = await getDocs(collection(db, 'studio_tasks'));
  const sprintSnap = await getDocs(collection(db, 'studio_sprints'));

  console.log(`Retrieved ${taskSnap.size} tasks and ${sprintSnap.size} sprint documents.`);

  const activeSprintId = 'sprint-3';
  const activeSprintName = 'Sprint 3 (7 Sept – 11 Sept)';

  // 1. Ensure canonical sprint documents
  const canonicalSprints = [
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
      status: 'Completed',
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
      status: 'Active',
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

  for (const sp of canonicalSprints) {
    await setDoc(doc(db, 'studio_sprints', sp.id), sp, { merge: true });
    console.log(`✓ Set canonical sprint: ${sp.id} -> ${sp.name} (${sp.status})`);
  }

  // 2. Remove obsolete / duplicate timestamped sprint docs
  const obsoleteSprintIds = ['sprint-1787649228112', 'sprint-1787657577868', 'sprint-1787914899578'];
  for (const oldId of obsoleteSprintIds) {
    try {
      await deleteDoc(doc(db, 'studio_sprints', oldId));
      console.log(`✓ Removed duplicate sprint document: ${oldId}`);
    } catch (err) {
      console.warn(`Could not delete sprint ${oldId}:`, err);
    }
  }

  // 3. Process all tasks
  let movedPendingCount = 0;
  let normalizedCompletedCount = 0;

  for (const docSnap of taskSnap.docs) {
    const t = { id: docSnap.id, ...docSnap.data() } as any;
    const currentSprintId = t.sprintId;

    const isSprint1Alias = currentSprintId === 'sprint-1' || currentSprintId === 'sprint-1787649228112' || currentSprintId === 'sprint-1787657577868';
    const isSprint2Alias = currentSprintId === 'sprint-2' || currentSprintId === 'sprint-1787914899578';

    if (isSprint1Alias || isSprint2Alias) {
      const taskIsDone = isFinished(t.status);
      const originCanonicalId = isSprint1Alias ? 'sprint-1' : 'sprint-2';
      const originSprintName = isSprint1Alias ? 'Sprint 1 (24 Aug – 28 Aug)' : 'Sprint 2 (31 Aug – 4 Sept)';

      if (!taskIsDone) {
        // This is a PENDING task in a completed sprint!
        // Move to Active Sprint (Sprint 3) and mark as moved!
        const existingHistory = Array.isArray(t.sprintHistory) ? [...t.sprintHistory] : [];
        if (!existingHistory.includes(originCanonicalId)) existingHistory.unshift(originCanonicalId);
        if (!existingHistory.includes(activeSprintId)) existingHistory.push(activeSprintId);

        const existingMovements = Array.isArray(t.sprintMovements) ? [...t.sprintMovements] : [];
        existingMovements.push({
          fromSprintId: originCanonicalId,
          fromSprintName: originSprintName,
          toSprintId: activeSprintId,
          toSprintName: activeSprintName,
          movedAt: nowIso,
          reason: 'Moved pending task from completed sprint to active sprint'
        });

        const existingTags = Array.isArray(t.tags) ? [...t.tags] : [];
        if (!existingTags.includes('Moved')) existingTags.push('Moved');
        if (!existingTags.includes('Carried Forward')) existingTags.push('Carried Forward');

        const existingComments = Array.isArray(t.comments) ? [...t.comments] : [];
        existingComments.push({
          id: `comment-move-${Date.now()}-${t.id}`,
          userId: 'system',
          userName: 'Sprint Engine',
          userRole: 'ADMIN',
          userAvatar: '',
          content: `Task moved from completed ${originSprintName} into active ${activeSprintName} as a carried-forward pending deliverable. Marked as moved.`,
          createdAt: nowIso
        });

        const updatedTask = {
          ...t,
          sprintId: activeSprintId,
          sprintHistory: existingHistory,
          sprintMovements: existingMovements,
          isMoved: true,
          tags: existingTags,
          comments: existingComments,
          updatedBy: 'system'
        };

        await setDoc(doc(db, 'studio_tasks', t.id), updatedTask, { merge: true });
        console.log(`📦 MOVED PENDING TASK: [${t.id}] "${t.title}" (${t.status}) from ${originSprintName} -> ${activeSprintName}`);
        movedPendingCount++;
      } else {
        // This task is Completed/Done in Sprint 1 or 2
        // Ensure its sprintId is the canonical sprint ID (sprint-1 or sprint-2)
        if (currentSprintId !== originCanonicalId) {
          const updatedTask = {
            ...t,
            sprintId: originCanonicalId,
            updatedBy: 'system'
          };
          await setDoc(doc(db, 'studio_tasks', t.id), updatedTask, { merge: true });
          console.log(`✓ Normalized completed task: [${t.id}] "${t.title}" sprintId -> ${originCanonicalId}`);
          normalizedCompletedCount++;
        }
      }
    }
  }

  console.log('\n=============================================');
  console.log(`🎉 MIGRATION COMPLETE!`);
  console.log(`- Pending tasks moved to active sprint (Sprint 3) & marked moved: ${movedPendingCount}`);
  console.log(`- Completed tasks normalized to canonical sprint IDs: ${normalizedCompletedCount}`);
  console.log('=============================================\n');
}

executeMigration().then(() => process.exit(0)).catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
