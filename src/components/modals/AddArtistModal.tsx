import React, { useState } from 'react';
import { useArtOps } from '../../context/ArtOpsContext';
import { ArtistSpecialization, ArtCategory, ArtistSkill } from '../../types';
import { Modal } from '../common/Modal';
import { SkillStars } from '../common/SkillStars';
import { getTodayDateString } from '../../utils/dateUtils';

interface AddArtistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ART_CATEGORIES: ArtCategory[] = [
  'Character',
  'Environment',
  'Concept Art',
  'UI',
  'Marketing Art',
  'Animation',
  'VFX',
  'Technical Art',
  'Illustration',
  '3D Render',
  'Store Assets',
  'Social Media',
  'Icons',
  'Event Art',
  'Promotional Art',
  'Other'
];

export const AddArtistModal: React.FC<AddArtistModalProps> = ({ isOpen, onClose }) => {
  const { addArtist, projects } = useArtOps();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ArtistSpecialization>('Character Artist');
  const [specialization, setSpecialization] = useState('Superstar Models & Retopology');
  const [dailyCapacity, setDailyCapacity] = useState(8);
  const [productionAllocation, setProductionAllocation] = useState(100);
  const [primaryCategory, setPrimaryCategory] = useState<ArtCategory>('Character');
  const [primaryRating, setPrimaryRating] = useState(5);
  const [secondaryCategory, setSecondaryCategory] = useState<ArtCategory>('3D Render');
  const [secondaryRating, setSecondaryRating] = useState(4);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const skills: ArtistSkill[] = [
      { category: primaryCategory, rating: primaryRating },
      { category: secondaryCategory, rating: secondaryRating }
    ];

    addArtist({
      userId: `user-sim-${Date.now()}`,
      name: name.trim(),
      email: email.trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@studio.internal`,
      avatar: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
      role,
      specialization: specialization.trim(),
      assignedProjects: projects.map(p => p.id),
      dailyCapacity,
      weeklyCapacity: dailyCapacity * 5,
      workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      productionAllocation,
      meetingHoursWeekly: 0,
      status: 'Active',
      joinDate: getTodayDateString(),
      skills,
      leaveSchedule: []
    });

    onClose();
  };

  return (
    <Modal
      id="modal-add-artist"
      isOpen={isOpen}
      onClose={onClose}
      title="Add Artist to Studio Roster"
      subtitle="Register artist capacity, production allocation %, and skill profile"
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
            id="btn-confirm-add-artist"
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 rounded-lg shadow-xs"
          >
            Add Artist to Team
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Artist Full Name *</label>
            <input
              id="input-artist-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Leo Fernandez"
              className="w-full text-xs font-medium bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. leo.fernandez@studio.internal"
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Artist Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as ArtistSpecialization)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            >
              <option value="Character Artist">Character Artist</option>
              <option value="Environment Artist">Environment Artist</option>
              <option value="Concept Artist">Concept Artist</option>
              <option value="UI Artist">UI Artist</option>
              <option value="Marketing Artist">Marketing Artist</option>
              <option value="3D Artist">3D Artist</option>
              <option value="2D Animator">2D Animator</option>
              <option value="VFX Artist">VFX Artist</option>
              <option value="Technical Artist">Technical Artist</option>
              <option value="Illustrator">Illustrator</option>
              <option value="Motion Graphics Artist">Motion Graphics Artist</option>
              <option value="Icon Designer">Icon Designer</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Specialization</label>
            <input
              type="text"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              placeholder="e.g. ZBrush, Substance Painter, Rigging"
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            />
          </div>
        </div>

        {/* Capacity & Production Allocation % */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Daily Capacity (Hours)</label>
            <input
              type="number"
              min="4"
              max="10"
              value={dailyCapacity}
              onChange={(e) => setDailyCapacity(Number(e.target.value))}
              className="w-full text-xs font-bold bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            />
            <span className="text-[11px] text-zinc-400 mt-1 block">
              Weekly: {dailyCapacity * 5} hours total
            </span>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">
              Production Allocation %
            </label>
            <input
              type="number"
              min="10"
              max="100"
              value={productionAllocation}
              onChange={(e) => setProductionAllocation(Number(e.target.value))}
              className="w-full text-xs font-bold bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            />
            <span className="text-[11px] text-zinc-500 mt-1 block">
              Effective art capacity: {Math.round((dailyCapacity * 5 * productionAllocation) / 100)}h/week
            </span>
          </div>
        </div>

        {/* Skills Profile */}
        <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg space-y-3">
          <label className="text-xs font-bold text-zinc-900 uppercase tracking-wider block">
            Skills Profile Rating (1-5 Stars)
          </label>

          <div className="flex items-center justify-between">
            <select
              value={primaryCategory}
              onChange={(e) => setPrimaryCategory(e.target.value as ArtCategory)}
              className="text-xs font-semibold bg-white border border-zinc-300 rounded-md px-2 py-1 outline-hidden"
            >
              {ART_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <SkillStars rating={primaryRating} editable onChange={setPrimaryRating} size="md" />
          </div>

          <div className="flex items-center justify-between">
            <select
              value={secondaryCategory}
              onChange={(e) => setSecondaryCategory(e.target.value as ArtCategory)}
              className="text-xs font-semibold bg-white border border-zinc-300 rounded-md px-2 py-1 outline-hidden"
            >
              {ART_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <SkillStars rating={secondaryRating} editable onChange={setSecondaryRating} size="md" />
          </div>
        </div>
      </form>
    </Modal>
  );
};
