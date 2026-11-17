import React, { useState } from 'react';
import { useArtOps } from '../../context/ArtOpsContext';
import { Task, CompanyRequest } from '../../types';
import { Modal } from '../common/Modal';

interface RevisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null;
  request?: CompanyRequest | null;
}

export const RevisionModal: React.FC<RevisionModalProps> = ({ isOpen, onClose, task, request }) => {
  const { requestTaskRevision, currentUser } = useArtOps();

  const [comment, setComment] = useState('');
  const [additionalHours, setAdditionalHours] = useState(2);

  const targetId = task?.id || request?.taskId || request?.id;
  const targetTitle = task?.title || request?.taskTitle;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    if (task) {
      requestTaskRevision(task.id, comment.trim(), additionalHours);
    } else if (request && request.taskId) {
      requestTaskRevision(request.taskId, comment.trim(), additionalHours);
    }
    onClose();
  };

  return (
    <Modal
      id="modal-request-revision"
      isOpen={isOpen}
      onClose={onClose}
      title={`Request Revision on ${targetId}`}
      subtitle={targetTitle}
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
            id="btn-confirm-revision"
            type="button"
            onClick={handleSubmit}
            disabled={!comment.trim()}
            className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg shadow-xs"
          >
            Submit Revision (+{additionalHours}h)
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-xs">
          <p className="font-semibold">Revision Workflow Impact:</p>
          <p className="text-[11px] text-amber-800 mt-0.5">
            Submitting this revision will transition the task status to <strong>REVISION</strong>, add estimated hours to the remaining capacity, and recalculate delivery dates.
          </p>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-800 block mb-1">
            Revision Feedback / Changes Needed *
          </label>
          <textarea
            id="textarea-revision-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="e.g. Please increase the superstar contrast, fix lighting angle on the belt, and sharpen logo..."
            className="w-full text-xs bg-white border border-zinc-300 rounded-lg p-2.5 focus:border-zinc-900 outline-hidden"
            required
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-800 block mb-1">
            Estimated Additional Time Needed (Hours)
          </label>
          <input
            id="input-revision-hours"
            type="number"
            min="0.5"
            max="40"
            step="0.5"
            value={additionalHours}
            onChange={(e) => setAdditionalHours(Number(e.target.value))}
            className="w-full text-xs font-bold bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            required
          />
        </div>
      </form>
    </Modal>
  );
};
