import React, { useState, useEffect, useMemo } from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { ProjectStatus, Priority, ProjectType } from '../../types';
import { Modal } from '../common/Modal';
import { addWorkingDays } from '../../utils/dateUtils';
import { findSimilarProject } from '../../utils/projectNameValidator';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, users, projects, createProject } = useArtOps();

  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [ownerId, setOwnerId] = useState(currentUser?.id || '');
  const [artManagerId, setArtManagerId] = useState(currentUser?.id || '');
  const [artDirectorId, setArtDirectorId] = useState(() => {
    const dir = users.find(u => u.role === 'ART_DIRECTOR');
    return dir ? dir.id : currentUser?.id || '';
  });

  useEffect(() => {
    if (currentUser?.id) {
      if (!ownerId) setOwnerId(currentUser.id);
      if (!artManagerId) setArtManagerId(currentUser.id);
      if (!artDirectorId) {
        const dir = users.find(u => u.role === 'ART_DIRECTOR');
        setArtDirectorId(dir ? dir.id : currentUser.id);
      }
    }
  }, [currentUser, users]);
  const [projectType, setProjectType] = useState<ProjectType>('Game');
  const [priority, setPriority] = useState<Priority>('High');
  const [status, setStatus] = useState<ProjectStatus>('Active');
  const [startDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [targetEndDate] = useState(() => addWorkingDays(new Date(), 90).toISOString().split('T')[0]);
  const [avatarColor, setAvatarColor] = useState('bg-indigo-600');
  const [error, setError] = useState<string | null>(null);

  // Live conflict detection for similar names or duplicate keys
  const liveConflict = useMemo(() => {
    if (!name.trim() && !key.trim()) return null;
    return findSimilarProject(name, key, projects);
  }, [name, key, projects]);

  const handleKeyChange = (val: string) => {
    const upper = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setKey(upper);
    setError(null);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    setError(null);
    if (!key && val.trim()) {
      // Auto-suggest project key from name
      const words = val.trim().split(/\s+/);
      let suggested = '';
      if (words.length >= 2) {
        suggested = words.map(w => w[0]).join('') + 'ART';
      } else {
        suggested = val.substring(0, 4) + 'ART';
      }
      setKey(suggested.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
    }
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

    // Strict similarity & uniqueness check
    const conflict = findSimilarProject(trimmedName, cleanKey, projects);
    if (conflict) {
      setError(conflict.reason);
      return;
    }

    try {
      createProject({
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
      setError(err.message || 'Failed to create project.');
    }
  };

  return (
    <Modal
      id="modal-create-project"
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Studio Project"
      subtitle="Register project key for automatic sequential task IDs (e.g. WWEART-0001)"
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
            id="btn-confirm-create-project"
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim() || !key.trim() || Boolean(liveConflict)}
            className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs"
          >
            Create Project
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2">
            <ShieldAlert size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {liveConflict && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold text-amber-950">Cannot Create Project: Similar Project Exists</strong>
              <p className="text-amber-800 mt-0.5">{liveConflict.reason}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Project Name *</label>
            <input
              id="input-project-name"
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. WWE Mayhem"
              className="w-full text-xs font-medium bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">
              Project Key * <span className="text-[10px] text-zinc-400 font-normal">(2-8 chars)</span>
            </label>
            <input
              id="input-project-key"
              type="text"
              value={key}
              onChange={(e) => handleKeyChange(e.target.value)}
              placeholder="WWEART"
              maxLength={8}
              className="w-full text-xs font-mono font-bold uppercase bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
              required
            />
          </div>
        </div>

        {key && (
          <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs flex items-center justify-between">
            <span className="text-zinc-600">Generated Task ID Format:</span>
            <span className="font-mono font-bold text-zinc-900 bg-white px-2 py-0.5 rounded border border-zinc-300">
              {key}-0001, {key}-0002...
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Project Type</label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectType)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            >
              <option value="Game">Game Title</option>
              <option value="Marketing">Marketing Campaign</option>
              <option value="LiveOps">Live Operations</option>
              <option value="Store">Store Assets & IAP</option>
              <option value="Social">Social Media</option>
              <option value="Platform">Platform Feature</option>
              <option value="Brand">Brand / IP</option>
            </select>
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

          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            >
              <option value="Active">Active</option>
              <option value="Paused">Paused</option>
              <option value="Completed">Completed</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Art Manager</label>
            <select
              value={artManagerId}
              onChange={(e) => setArtManagerId(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
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
                <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-800 block mb-1">Project Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Art goals, technical pipeline, visual direction..."
            className="w-full text-xs bg-white border border-zinc-300 rounded-lg p-2.5 focus:border-zinc-900 outline-hidden"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-800 block mb-1.5">Avatar Accent Color</label>
          <div className="flex gap-2">
            {AVATAR_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setAvatarColor(c)}
                className={`w-6 h-6 rounded-full ${c} ${avatarColor === c ? 'ring-2 ring-offset-2 ring-zinc-900 scale-110' : 'opacity-80 hover:opacity-100'} transition-all`}
              />
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
};
