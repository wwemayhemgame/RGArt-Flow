import React, { useState } from 'react';
import { useArtOps } from '../../context/ArtOpsContext';
import { Task, BlockerReason } from '../../types';
import { Modal } from '../common/Modal';

interface BlockerModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
}

const BLOCKER_REASONS: BlockerReason[] = [
  'Waiting for reference',
  'Waiting for design approval',
  'Waiting for 3D render',
  'Technical issue',
  'Missing requirement',
  'Other'
];

export const BlockerModal: React.FC<BlockerModalProps> = ({ isOpen, onClose, task }) => {
  const { updateTaskStatus } = useArtOps();

  const [reason, setReason] = useState<BlockerReason>('Waiting for reference');
  const [details, setDetails] = useState('');

  if (!task) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateTaskStatus(task.id, 'BLOCKED', reason, details.trim());
    onClose();
  };

  return (
    <Modal
      id="modal-report-blocker"
      isOpen={isOpen}
      onClose={onClose}
      title={`Report Blocker on ${task.id}`}
      subtitle={task.title}
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
            id="btn-confirm-blocker"
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs"
          >
            Mark as Blocked
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-xs">
          <p className="font-semibold">Blocker Notification:</p>
          <p className="text-[11px] text-rose-800 mt-0.5">
            Marking this task as blocked will immediately alert the Art Manager and Art Director on all dashboards.
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-800 block mb-1">Blocker Reason *</label>
          <select
            id="select-blocker-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value as BlockerReason)}
            className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden font-medium"
          >
            {BLOCKER_REASONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-800 block mb-1">Blocker Details / Context</label>
          <textarea
            id="textarea-blocker-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={3}
            placeholder="Explain what is blocking progress and who can resolve it..."
            className="w-full text-xs bg-white border border-zinc-300 rounded-lg p-2.5 focus:border-zinc-900 outline-hidden"
          />
        </div>
      </form>
    </Modal>
  );
};
