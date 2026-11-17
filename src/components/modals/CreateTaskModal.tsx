import React, { useState, useMemo, useEffect } from 'react';
import { useArtOps } from '../../context/ArtOpsContext';
import { Priority, Task } from '../../types';
import { Modal } from '../common/Modal';
import { addWorkingDays } from '../../utils/dateUtils';
import { getArtistSkillMatch, getArtistEffectiveWeeklyCapacity, getArtistCommittedHours } from '../../utils/forecastEngine';
import { formatDuration, parseDurationString } from '../../utils/timeUtils';
import { Zap } from 'lucide-react';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectId?: string;
  defaultSprintId?: string;
  onTaskCreated?: (task: Task) => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  defaultProjectId,
  defaultSprintId,
  onTaskCreated
}) => {
  const { currentUser, projects, sprints, artists, tasks, settings, createTask, getJiraMetadataForProject } = useArtOps();

  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'ART_DIRECTOR';
  const [showArchivedProjects, setShowArchivedProjects] = useState(false);

  const availableProjects = useMemo(() => {
    return projects.filter(p => showArchivedProjects || p.status === 'Active' || p.id === defaultProjectId);
  }, [projects, showArchivedProjects, defaultProjectId]);

  const [projectId, setProjectId] = useState(() => {
    if (defaultProjectId) return defaultProjectId;
    const firstActive = projects.find(p => p.status === 'Active');
    return firstActive?.id || projects[0]?.id || '';
  });

  const [sprintId, setSprintId] = useState(defaultSprintId || sprints.find(s => s.status === 'Active')?.id || '');
  const [taskType, setTaskType] = useState('Production Art');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [artistId, setArtistId] = useState('');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [storyPoints, setStoryPoints] = useState(3);
  const [estimateStr, setEstimateStr] = useState('6h');
  const [dueDate, setDueDate] = useState(() => {
    return addWorkingDays(new Date(), 5).toISOString().split('T')[0];
  });
  const [tagsInput, setTagsInput] = useState('');

  // Jira-specific fields
  const [jiraIssueTypeId, setJiraIssueTypeId] = useState('');
  const [jiraFixVersionId, setJiraFixVersionId] = useState('');
  const [jiraComponentId, setJiraComponentId] = useState('');

  useEffect(() => {
    if (!projectId && availableProjects.length > 0) {
      setProjectId(availableProjects[0].id);
    }
  }, [availableProjects, projectId]);

  const selectedProject = availableProjects.find(p => p.id === projectId) || projects.find(p => p.id === projectId) || projects[0];

  // Resolve mapped Jira Project Key & metadata
  const mappedJiraKey = useMemo(() => {
    if (!selectedProject) return 'WWE';
    const config = settings.jiraConfig;
    const direct = config?.projectMappings?.find(m => m.studioProjectId === selectedProject.id);
    if (direct?.jiraProjectKey) return direct.jiraProjectKey.toUpperCase();
    const key = selectedProject.key?.toUpperCase() || '';
    if (key.includes('WWE')) return 'WWE';
    if (key.includes('M13') || key.includes('MAF')) return 'M13';
    return 'WWE';
  }, [selectedProject, settings.jiraConfig]);

  const jiraMetadata = useMemo(() => {
    return getJiraMetadataForProject(mappedJiraKey);
  }, [getJiraMetadataForProject, mappedJiraKey]);

  // Set default issue type, fix version, and component when project / metadata changes
  useEffect(() => {
    if (jiraMetadata) {
      if (jiraMetadata.defaultIssueTypeId && !jiraIssueTypeId) {
        setJiraIssueTypeId(jiraMetadata.defaultIssueTypeId);
      }
      if (!jiraFixVersionId && jiraMetadata.fixVersions && jiraMetadata.fixVersions.length > 0) {
        const activeVer = jiraMetadata.fixVersions.find(v => !v.released && !v.archived) || jiraMetadata.fixVersions[0];
        if (activeVer) setJiraFixVersionId(String(activeVer.id));
      }
      if (!jiraComponentId && jiraMetadata.components && jiraMetadata.components.length > 0) {
        const matchingComp = jiraMetadata.components.find(c => {
          const cName = c.name.toLowerCase();
          if (taskType.includes('2D') || taskType.includes('Concept')) return cName.includes('2d') || cName.includes('art') || cName.includes('concept');
          if (taskType.includes('3D')) return cName.includes('3d') || cName.includes('character') || cName.includes('environment');
          if (taskType.includes('UI')) return cName.includes('ui') || cName.includes('icon');
          if (taskType.includes('Animation')) return cName.includes('anim');
          if (taskType.includes('VFX')) return cName.includes('vfx');
          return cName.includes('art') || cName.includes('general');
        }) || jiraMetadata.components[0];
        if (matchingComp) setJiraComponentId(String(matchingComp.id));
      }
    }
  }, [jiraMetadata, taskType]);

  // Auto-calculate expected Task ID preview
  const previewTaskId = useMemo(() => {
    if (!selectedProject) return '???-0001';
    const nextNum = (selectedProject.taskCounter || 0) + 1;
    return `${selectedProject.key}-${String(nextNum).padStart(4, '0')}`;
  }, [selectedProject]);

  // Story point change syncs estimate (1 SP = ratio hours)
  const handleStoryPointsChange = (sp: number) => {
    setStoryPoints(sp);
    const calculatedHours = sp * (settings.spToHoursRatio || 2);
    setEstimateStr(formatDuration(calculatedHours));
  };

  // Artist recommendations ranking
  const rankedArtists = useMemo(() => {
    return artists.map(artist => {
      const matchScore = getArtistSkillMatch(artist, taskType as any, projectId);
      const committed = getArtistCommittedHours(artist.id, tasks);
      const cap = getArtistEffectiveWeeklyCapacity(artist);
      const util = cap > 0 ? Math.round((committed / cap) * 100) : 0;
      return {
        ...artist,
        matchScore,
        committed,
        util
      };
    }).sort((a, b) => b.matchScore - a.matchScore);
  }, [artists, taskType, projectId, tasks]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !projectId) return;

    const tags = tagsInput
      ? tagsInput.split(',').map(t => t.trim()).filter(Boolean)
      : [selectedProject?.name || 'General', taskType];

    const parsedEstimate = parseDurationString(estimateStr);
    const finalHours = Math.max(0.5, parsedEstimate.totalHours || 6);

    const selectedIssueType = jiraMetadata?.issueTypes.find(it => String(it.id) === String(jiraIssueTypeId));
    let selectedFixVersion = jiraMetadata?.fixVersions.find(v => String(v.id) === String(jiraFixVersionId));
    let selectedComponent = jiraMetadata?.components.find(c => String(c.id) === String(jiraComponentId));

    if (!selectedFixVersion && jiraMetadata?.fixVersions && jiraMetadata.fixVersions.length > 0) {
      selectedFixVersion = jiraMetadata.fixVersions.find(v => !v.released && !v.archived) || jiraMetadata.fixVersions[0];
    }
    if (!selectedComponent && jiraMetadata?.components && jiraMetadata.components.length > 0) {
      selectedComponent = jiraMetadata.components[0];
    }

    const newTask = createTask({
      projectId,
      sprintId: sprintId || undefined,
      taskType,
      title: title.trim(),
      description: description.trim(),
      artistId: artistId || undefined,
      priority,
      storyPoints,
      originalEstimate: finalHours,
      remainingEstimate: finalHours,
      dueDate,
      tags,
      jiraProjectKey: mappedJiraKey,
      jiraIssueType: selectedIssueType?.name || jiraMetadata?.defaultIssueTypeName || 'Task',
      jiraIssueTypeId: selectedIssueType?.id || jiraMetadata?.defaultIssueTypeId,
      jiraFixVersion: selectedFixVersion?.name,
      jiraFixVersionId: selectedFixVersion?.id,
      jiraComponent: selectedComponent?.name,
      jiraComponentId: selectedComponent?.id
    });

    if (onTaskCreated) {
      onTaskCreated(newTask);
    }
    onClose();
  };

  return (
    <Modal
      id="modal-create-task"
      isOpen={isOpen}
      onClose={onClose}
      title="Create Project-Specific Art Task"
      subtitle={`New task will be assigned ID: ${previewTaskId}`}
      maxWidth="2xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            id="btn-confirm-create-task"
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim() || !projectId || projects.length === 0}
            className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 rounded-lg shadow-xs"
          >
            Create Task ({previewTaskId})
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Project & Task ID Badge */}
        <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-200">
          <div>
            <label className="text-[11px] text-zinc-400 font-bold uppercase block">Target Project *</label>
            <select
              id="select-task-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="text-xs font-semibold text-zinc-900 bg-transparent border-0 outline-hidden cursor-pointer"
            >
              {availableProjects.length === 0 && (
                <option value="">No active projects available</option>
              )}
              {availableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.key}){p.status !== 'Active' ? ` [${p.status}]` : ''}
                </option>
              ))}
            </select>
            {isAdmin && projects.some(p => p.status === 'Archived' || p.status === 'Paused') && (
              <label className="flex items-center gap-1 mt-1 text-[10px] text-zinc-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showArchivedProjects}
                  onChange={(e) => setShowArchivedProjects(e.target.checked)}
                  className="w-3 h-3 rounded border-zinc-300 text-zinc-600"
                />
                <span>Show Archived Projects</span>
              </label>
            )}
          </div>
          <div className="text-right">
            <span className="text-[10px] text-zinc-400 font-bold uppercase block">Generated Task ID</span>
            <span className="font-mono text-xs font-bold text-zinc-900 bg-white px-2 py-0.5 rounded border border-zinc-300">
              {previewTaskId}
            </span>
          </div>
        </div>

        {/* Task Title */}
        <div>
          <label className="text-xs font-semibold text-zinc-800 block mb-1">Task Title *</label>
          <input
            id="input-task-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. SummerSlam 2026 Champion Character Mesh"
            className="w-full text-xs font-medium bg-white border border-zinc-300 rounded-lg px-3 py-2 focus:border-zinc-900 outline-hidden"
            required
          />
        </div>

        {/* Task Type & Sprint */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Task Type</label>
            <select
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            >
              <option value="Character 3D">Character 3D</option>
              <option value="Key Art Banner">Key Art Banner</option>
              <option value="UI Mockup">UI Mockup / Flow</option>
              <option value="Concept Art">Concept Art</option>
              <option value="Environment 3D">Environment 3D</option>
              <option value="Spine 2D Animation">Spine 2D Animation</option>
              <option value="VFX Sequence">VFX Sequence</option>
              <option value="Store Assets">Store Icons / Bundles</option>
              <option value="Marketing Art">Marketing / Social Creative</option>
              <option value="Technical Art">Technical Art / Shaders</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Sprint Destination</label>
            <select
              value={sprintId}
              onChange={(e) => setSprintId(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            >
              <option value="">Art Backlog (No Sprint)</option>
              {sprints
                .filter(s => s.status?.toUpperCase() !== 'COMPLETED')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.status})
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Artist Assignment with Skill/Workload Info */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold text-zinc-800 block">Assign Artist / Owner</label>
            {currentUser && (
              <button
                type="button"
                onClick={() => {
                  const myMatch = artists.find(
                    a =>
                      (currentUser.artistId && a.id === currentUser.artistId) ||
                      (currentUser.id && a.userId === currentUser.id) ||
                      (currentUser.id && a.id === currentUser.id) ||
                      (a.email && currentUser.email && a.email.toLowerCase() === currentUser.email.toLowerCase())
                  );
                  setArtistId(myMatch?.id || currentUser.artistId || currentUser.id || '');
                }}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors cursor-pointer border border-blue-200"
              >
                <Zap size={12} className="text-amber-500 fill-amber-500" />
                <span>Assign to Myself ({currentUser.name?.split(' ')[0] || 'Me'})</span>
              </button>
            )}
          </div>
          <select
            id="select-task-artist"
            value={artistId}
            onChange={(e) => setArtistId(e.target.value)}
            className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
          >
            <option value="">Unassigned (Queue for Planning)</option>
            {/* Priority current user option */}
            {currentUser && (
              <option value={artists.find(a => (currentUser.artistId && a.id === currentUser.artistId) || (currentUser.id && a.userId === currentUser.id) || (currentUser.id && a.id === currentUser.id) || (a.email && currentUser.email && a.email.toLowerCase() === currentUser.email.toLowerCase()))?.id || currentUser.id}>
                ⭐ {currentUser.name} (Me) — {currentUser.role}
              </option>
            )}
            {rankedArtists.filter(a => (!currentUser?.id || (a.userId !== currentUser.id && a.id !== currentUser.id)) && (!currentUser?.artistId || a.id !== currentUser.artistId)).map((a) => (
              <option key={a.id} value={a.id}>
                {a.isManagement ? '👔 ' : '🎨 '}{a.name} — {a.role} ({a.matchScore}% skill match, {a.util}% workload)
              </option>
            ))}
          </select>
        </div>

        {/* Story Points & Original Estimate & Priority */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Story Points</label>
            <select
              value={storyPoints}
              onChange={(e) => handleStoryPointsChange(Number(e.target.value))}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            >
              <option value={1}>1 SP (2 hours)</option>
              <option value={2}>2 SP (4 hours)</option>
              <option value={3}>3 SP (6 hours)</option>
              <option value={5}>5 SP (10 hours)</option>
              <option value={8}>8 SP (16 hours)</option>
              <option value={13}>13 SP (26 hours)</option>
              <option value={21}>21 SP (42 hours)</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-zinc-800">
                Original Estimate (m, h, d)
              </label>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">
                {parseDurationString(estimateStr).formatted} ({parseDurationString(estimateStr).totalHours}h)
              </span>
            </div>
            <input
              type="text"
              value={estimateStr}
              onChange={(e) => setEstimateStr(e.target.value)}
              placeholder="e.g. 1d 4h, 30m, 6h"
              className="w-full text-xs font-semibold bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            />
            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              {['30m', '2h', '4h', '1d', '2d', '3d'].map((pill) => (
                <button
                  key={pill}
                  type="button"
                  onClick={() => setEstimateStr(pill)}
                  className="px-1.5 py-0.5 text-[9px] font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded transition-colors cursor-pointer"
                >
                  {pill}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            >
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>

        {/* Jira Integration Mapping & Metadata */}
        <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200/70 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              Jira Sync Target: Project [{mappedJiraKey}]
            </span>
            <span className="text-[10px] text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded font-medium">
              {jiraMetadata?.projectName || 'Jira Cloud Project'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            <div>
              <label className="text-[11px] font-semibold text-blue-900 block mb-0.5">Jira Issue Type</label>
              <select
                value={jiraIssueTypeId}
                onChange={(e) => setJiraIssueTypeId(e.target.value)}
                className="w-full text-xs bg-white border border-blue-200 rounded-md px-2 py-1.5 focus:border-blue-600 outline-hidden font-medium text-zinc-800"
              >
                {jiraMetadata?.issueTypes.map(it => (
                  <option key={it.id} value={it.id}>
                    {it.name}{it.subtask ? ' (Subtask)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-blue-900 block mb-0.5">Fix Version / Release</label>
              <select
                value={jiraFixVersionId}
                onChange={(e) => setJiraFixVersionId(e.target.value)}
                className="w-full text-xs bg-white border border-blue-200 rounded-md px-2 py-1.5 focus:border-blue-600 outline-hidden font-medium text-zinc-800"
              >
                <option value="">None (Unassigned)</option>
                {jiraMetadata?.fixVersions.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name}{v.released ? ' (Released)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-blue-900 block mb-0.5">Component / Discipline</label>
              <select
                value={jiraComponentId}
                onChange={(e) => setJiraComponentId(e.target.value)}
                className="w-full text-xs bg-white border border-blue-200 rounded-md px-2 py-1.5 focus:border-blue-600 outline-hidden font-medium text-zinc-800"
              >
                <option value="">None (General)</option>
                {jiraMetadata?.components.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Due Date & Tags */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Tags (Comma-separated)</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. Hero, 3D, High Priority"
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs font-semibold text-zinc-800 block mb-1">Description / Spec</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Art requirements, poly count limits, texture map sizes, reference links..."
            className="w-full text-xs bg-white border border-zinc-300 rounded-lg p-2.5 focus:border-zinc-900 outline-hidden"
          />
        </div>
      </form>
    </Modal>
  );
};
