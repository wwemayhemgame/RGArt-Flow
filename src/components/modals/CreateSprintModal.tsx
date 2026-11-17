import React, { useState } from 'react';
import { useArtOps } from '../../context/ArtOpsContext';
import { SprintStatus } from '../../types';
import { Modal } from '../common/Modal';
import { computeScheduledSprint } from '../../utils/sprintScheduler';
import { Calendar, Sparkles } from 'lucide-react';

interface CreateSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateSprintModal: React.FC<CreateSprintModalProps> = ({ isOpen, onClose }) => {
  const { sprints, createSprint } = useArtOps();

  // Find highest sprint number or calculate next week
  const nextSprintNum = sprints.length > 0 ? Math.max(...sprints.map(s => s.sprintNumber || 0)) + 1 : 1;
  
  // Calculate next weekly window based on existing sprints
  const defaultWeekly = computeScheduledSprint(nextSprintNum);

  const [sprintNumber, setSprintNumber] = useState(nextSprintNum);
  const [name, setName] = useState(defaultWeekly.name);
  const [startDate, setStartDate] = useState(defaultWeekly.startDate);
  const [endDate, setEndDate] = useState(defaultWeekly.endDate);
  const [goal, setGoal] = useState('');
  const [status, setStatus] = useState<SprintStatus>('Planning');

  const applySprintPreset = (num: number) => {
    const scheduled = computeScheduledSprint(num);
    setName(scheduled.name);
    setStartDate(scheduled.startDate);
    setEndDate(scheduled.endDate);
    setSprintNumber(num);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createSprint({
      sprintNumber,
      name: name.trim(),
      startDate,
      endDate,
      goal: goal.trim() || 'Weekly studio production sprint for liveops and feature art deliverables.',
      status
    });

    onClose();
  };

  return (
    <Modal
      id="modal-create-sprint"
      isOpen={isOpen}
      onClose={onClose}
      title="Create Art Production Sprint"
      subtitle="Define production milestone, capacity window, and delivery goals"
      maxWidth="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="btn-confirm-create-sprint"
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer"
          >
            Create Sprint
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Quick Weekly Presets */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-2">
            <Sparkles size={13} className="text-amber-500" />
            <span>Weekly Sprint Presets (Mon – Fri)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applySprintPreset(1)}
              className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 cursor-pointer shadow-2xs"
            >
              Sprint 1: 24 Aug – 28 Aug
            </button>
            <button
              type="button"
              onClick={() => applySprintPreset(2)}
              className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 cursor-pointer shadow-2xs"
            >
              Sprint 2: 31 Aug – 4 Sept
            </button>
            <button
              type="button"
              onClick={() => applySprintPreset(3)}
              className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 cursor-pointer shadow-2xs"
            >
              Sprint 3: 7 Sept – 11 Sept
            </button>
            <button
              type="button"
              onClick={() => applySprintPreset(4)}
              className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 cursor-pointer shadow-2xs"
            >
              Sprint 4: 14 Sept – 18 Sept
            </button>
            <button
              type="button"
              onClick={() => applySprintPreset(5)}
              className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 cursor-pointer shadow-2xs"
            >
              Sprint 5: 21 Sept – 25 Sept
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="col-span-1">
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Sprint #</label>
            <input
              type="number"
              value={sprintNumber}
              onChange={(e) => setSprintNumber(Number(e.target.value))}
              className="w-full text-xs font-mono font-bold bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
              required
            />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Sprint Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as SprintStatus)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden cursor-pointer"
            >
              <option value="Planning">Planning</option>
              <option value="Active">Active</option>
              <option value="Review">Review</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-800 block mb-1">Sprint Name *</label>
          <input
            id="input-sprint-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sprint W35 (Aug 24 - Aug 28, Mon-Fri)"
            className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden font-medium"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Start Date (Monday)</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">End Date (Friday)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-zinc-800 block mb-1">Sprint Goal</label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            placeholder="Primary focus, key deliverables, and critical milestones for the art team..."
            className="w-full text-xs bg-white border border-zinc-300 rounded-lg p-2.5 focus:border-zinc-900 outline-hidden"
          />
        </div>
      </form>
    </Modal>
  );
};
