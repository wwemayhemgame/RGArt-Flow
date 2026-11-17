import React, { useState, useEffect } from 'react';
import { useArtOps } from '../../context/ArtOpsContext';
import { Project, ProjectStatus, Priority, ProjectType } from '../../types';
import { Modal } from '../common/Modal';
import { Lock, AlertCircle, Info } from 'lucide-react';

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
}

const AVATAR_COLORS = [
  'bg-rose-600',
  'bg-blue-600',
  'bg-amber-600',
  'bg-emerald-600',
  'bg-violet-600',
  'bg-cyan-600',
  'bg-pink-600',
  'bg-indigo-600',
  'bg-teal-600',
  'bg-zinc-700'
];

export const EditProjectModal: React.FC<EditProjectModalProps> = ({ isOpen, onClose, project }) => {
  const { users, tasks, projects, updateProject } = useArtOps();

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState('');
  const [artManagerId, setArtManagerId] = useState('');
  const [artDirectorId, setArtDirectorId] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>('Game');
  const [priority, setPriority] = useState<Priority>('High');
  const [status, setStatus] = useState<ProjectStatus>('Active');
  const [startDate, setStartDate] = useState('');
  const [targetEndDate, setTargetEndDate] = useState('');
  const [avatarColor, setAvatarColor] = useState('bg-indigo-600');
  const [error, setError] = useState<string | null>(null);

  const hasTasks = project ? tasks.some(t => t.projectId === project.id) : false;

  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setKey(project.key || '');
      setDescription(project.description || '');
      setOwnerId(project.ownerId || users[0]?.id || '');
      setArtManagerId(project.artManagerId || users[0]?.id || '');
      setArtDirectorId(project.artDirectorId || users[0]?.id || '');
      setProjectType(project.projectType || 'Game');
      setPriority(project.priority || 'High');
      setStatus(project.status || 'Active');
      setStartDate(project.startDate || new Date().toISOString().split('T')[0]);
      setTargetEndDate(project.targetEndDate || new Date().toISOString().split('T')[0]);
      setAvatarColor(project.avatarColor || 'bg-indigo-600');
      setError(null);
    }
  }, [project, isOpen]);

  if (!project) return null;

  const handleKeyChange = (val: string) => {
    if (hasTasks) return;
    const upper = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setKey(upper);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const cleanKey = key.trim().toUpperCase();

    if (!trimmedName) {
      setError('Project name is required.');
      return;
    }

    if (cleanKey.length < 2 || cleanKey.length > 8) {
      setError('Project key must be between 2 and 8 uppercase alphanumeric characters.');
      return;
    }

    if (projects.some(p => p.id !== project.id && p.key.toUpperCase() === cleanKey)) {
      setError('Project key already exists in another project. Please choose another unique key.');
      return;
    }

    try {
      updateProject(project.id, {
        name: trimmedName,
        key: cleanKey,
        description: description.trim(),
        ownerId,
        artManagerId,
        artDirectorId,
        startDate,
        targetEndDate,
        status,
        priority,
        projectType,
        avatarColor
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update project.');
    }
  };

  return (
    <Modal
      id="modal-edit-project"
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Project: ${project.name}`}
      subtitle={`Configure metadata, managers, timeline, and status for project ${project.key}`}
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
            id="btn-save-project"
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || !key.trim()}
            className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 rounded-lg shadow-xs"
          >
            Save Project Changes
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Project Name *</label>
            <input
              id="input-edit-project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. WWE Mayhem"
              className="w-full text-xs font-medium bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-zinc-800">Project Key *</label>
              {hasTasks && (
                <span className="text-[10px] text-amber-700 flex items-center gap-0.5 font-bold">
                  <Lock size={10} /> Locked
                </span>
              )}
            </div>
            <input
              id="input-edit-project-key"
              type="text"
              value={key}
              onChange={(e) => handleKeyChange(e.target.value)}
              disabled={hasTasks}
              placeholder="e.g. WWEART"
              className={`w-full font-mono text-xs font-bold uppercase rounded-md px-2.5 py-1.5 outline-hidden ${
                hasTasks
                  ? 'bg-zinc-100 border border-zinc-200 text-zinc-500 cursor-not-allowed'
                  : 'bg-white border border-zinc-300 text-zinc-900 focus:border-zinc-900'
              }`}
              required
            />
          </div>
        </div>

        {hasTasks && (
          <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-lg flex items-start gap-2 text-[11px] text-amber-800">
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>
              Project Key <strong>{project.key}</strong> is locked because active tasks (e.g. {project.key}-0001) are linked to it.
            </span>
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-zinc-800 block mb-1">Project Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Outline IP title, art scope, and target game platforms..."
            className="w-full text-xs bg-white border border-zinc-300 rounded-md p-2.5 focus:border-zinc-900 outline-hidden resize-none"
          />
        </div>

        {/* Status, Priority, Type */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="w-full text-xs font-semibold bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            >
              <option value="Active">Active</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full text-xs font-semibold bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            >
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Project Type</label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectType)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            >
              <option value="Game">Game Title</option>
              <option value="Marketing">Marketing Campaign</option>
              <option value="LiveOps">LiveOps Season</option>
              <option value="R&D">R&D / Prototype</option>
              <option value="Platform">Platform Tech</option>
            </select>
          </div>
        </div>

        {/* Leads: Art Manager & Art Director */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Art Manager</label>
            <select
              value={artManagerId}
              onChange={(e) => setArtManagerId(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Art Director</label>
            <select
              value={artDirectorId}
              onChange={(e) => setArtDirectorId(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Timeline Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Production Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 outline-hidden"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Target Milestone / End Date</label>
            <input
              type="date"
              value={targetEndDate}
              onChange={(e) => setTargetEndDate(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 outline-hidden"
            />
          </div>
        </div>

        {/* Avatar Color Theme */}
        <div>
          <label className="text-xs font-semibold text-zinc-800 block mb-1.5">Project Color Badge</label>
          <div className="flex items-center gap-2 flex-wrap">
            {AVATAR_COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => setAvatarColor(color)}
                className={`w-7 h-7 rounded-lg ${color} transition-all cursor-pointer ${
                  avatarColor === color ? 'ring-2 ring-offset-2 ring-zinc-900 scale-110' : 'opacity-80 hover:opacity-100'
                }`}
              />
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
};
