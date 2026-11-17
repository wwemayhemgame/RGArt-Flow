import React, { useState } from 'react';
import { useArtOps } from '../../context/ArtOpsContext';
import { Modal } from '../common/Modal';

interface MissingTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  artistId: string;
}

export const MissingTaskModal: React.FC<MissingTaskModalProps> = ({ isOpen, onClose, artistId }) => {
  const { projects, sprints, submitMissingTask } = useArtOps();

  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [sprintId, setSprintId] = useState(sprints.find(s => s.status === 'Active')?.id || '');
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('Unplanned asset requested during build');
  const [estimatedHours, setEstimatedHours] = useState(4);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !projectId) return;

    submitMissingTask({
      projectId,
      sprintId: sprintId || undefined,
      artistId,
      title: title.trim(),
      reason: reason.trim(),
      originalEstimate: estimatedHours,
      remainingEstimate: estimatedHours
    });

    onClose();
  };

  return (
    <Modal
      id="modal-add-missing-task"
      isOpen={isOpen}
      onClose={onClose}
      title="Add Missing / Unplanned Task"
      subtitle="Log untracked work directly to your daily queue for Art Manager review"
      maxWidth="md"
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
            id="btn-confirm-missing-task"
            type="button"
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg shadow-xs"
          >
            Submit for Approval
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs">
          <p className="font-semibold">Unplanned Work Tracking:</p>
          <p className="text-[11px] text-amber-800 mt-0.5">
            This creates a task immediately in your queue with a <em>"Needs Manager Approval"</em> flag to protect sprint velocity and track emergency ad-hoc requests.
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-800 block mb-1">Target Project *</label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-800 block mb-1">Task Title *</label>
          <input
            id="input-missing-task-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Urgent icon re-export for build test"
            className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Estimated Hours</label>
            <input
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={estimatedHours}
              onChange={(e) => setEstimatedHours(Number(e.target.value))}
              className="w-full text-xs font-bold bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Sprint</label>
            <select
              value={sprintId}
              onChange={(e) => setSprintId(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            >
              {sprints
                .filter(s => s.status?.toUpperCase() !== 'COMPLETED')
                .map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-800 block mb-1">Reason / Context *</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Why was this not in the original sprint backlog? (e.g. Build broke due to missing asset, QA emergency request...)"
            className="w-full text-xs bg-white border border-zinc-300 rounded-lg p-2.5 focus:border-zinc-900 outline-hidden"
            required
          />
        </div>
      </form>
    </Modal>
  );
};
