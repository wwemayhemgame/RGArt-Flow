import React, { useState, useEffect } from 'react';
import { useArtOps } from '../../context/ArtOpsContext';
import { Artist, ArtistSpecialization, ArtCategory, ArtistSkill, ArtistLeave } from '../../types';
import { Modal } from '../common/Modal';
import { SkillStars } from '../common/SkillStars';
import { getTodayDateString, formatDate } from '../../utils/dateUtils';
import {
  Trash2,
  Plus,
  AlertCircle,
  Shield,
  Calendar,
  CalendarDays,
  Sun,
  CheckCircle2
} from 'lucide-react';

interface EditArtistModalProps {
  isOpen: boolean;
  onClose: () => void;
  artist: Artist | null;
}

const ALL_ROLES: ArtistSpecialization[] = [
  'Character Artist',
  'Environment Artist',
  'Concept Artist',
  'UI Artist',
  'Marketing Artist',
  '3D Artist',
  '2D Animator',
  'VFX Artist',
  'Technical Artist',
  'Illustrator',
  'Motion Graphics Artist',
  'Icon Designer'
];

const ALL_CATEGORIES: ArtCategory[] = [
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

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80'
];

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const EditArtistModal: React.FC<EditArtistModalProps> = ({ isOpen, onClose, artist }) => {
  const { updateArtist, deleteArtist, projects, canCreateProject } = useArtOps();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState('');
  const [role, setRole] = useState<ArtistSpecialization | string>('Character Artist');
  const [specialization, setSpecialization] = useState('');
  const [status, setStatus] = useState<'Active' | 'On Leave' | 'Inactive'>('Active');
  const [dailyCapacity, setDailyCapacity] = useState(8);
  const [productionAllocation, setProductionAllocation] = useState(100);
  const [meetingHoursWeekly, setMeetingHoursWeekly] = useState(0);
  const [workingDays, setWorkingDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [assignedProjects, setAssignedProjects] = useState<string[]>([]);
  const [skills, setSkills] = useState<ArtistSkill[]>([]);
  const [leaveSchedule, setLeaveSchedule] = useState<ArtistLeave[]>([]);

  // Leave addition inputs
  const todayStr = getTodayDateString();
  const [leaveStartDate, setLeaveStartDate] = useState(todayStr);
  const [leaveEndDate, setLeaveEndDate] = useState(todayStr);
  const [isLeaveRange, setIsLeaveRange] = useState(false);
  const [leaveReason, setLeaveReason] = useState('Personal Day Off');
  const [customLeaveReason, setCustomLeaveReason] = useState('');
  const [isAddingLeave, setIsAddingLeave] = useState(false);
  
  // New skill addition state
  const [newSkillCategory, setNewSkillCategory] = useState<ArtCategory>('Character');
  const [newSkillRating, setNewSkillRating] = useState(4);
  const [isAddingSkill, setIsAddingSkill] = useState(false);

  useEffect(() => {
    if (artist) {
      setName(artist.name || '');
      setEmail(artist.email || '');
      setAvatar(artist.avatar || AVATAR_PRESETS[0]);
      setRole(artist.role || 'Character Artist');
      setSpecialization(artist.specialization || '');
      setStatus(artist.status || 'Active');
      setDailyCapacity(artist.dailyCapacity ?? 8);
      setProductionAllocation(artist.productionAllocation ?? 100);
      setMeetingHoursWeekly(artist.meetingHoursWeekly ?? 0);
      setWorkingDays(artist.workingDays && artist.workingDays.length > 0 ? artist.workingDays : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
      setAssignedProjects(artist.assignedProjects || []);
      setSkills(artist.skills ? [...artist.skills] : []);
      setLeaveSchedule(artist.leaveSchedule ? [...artist.leaveSchedule] : []);
      setIsAddingSkill(false);
      setIsAddingLeave(false);
    }
  }, [artist, isOpen]);

  if (!artist) return null;

  const weeklyCapacity = dailyCapacity * workingDays.length;
  const effectiveCapacity = Math.round((weeklyCapacity * (productionAllocation / 100)) * 10) / 10;

  const toggleDay = (day: string) => {
    if (workingDays.includes(day)) {
      if (workingDays.length > 1) {
        setWorkingDays(workingDays.filter(d => d !== day));
      }
    } else {
      setWorkingDays([...workingDays, day]);
    }
  };

  const toggleProject = (projectId: string) => {
    if (assignedProjects.includes(projectId)) {
      setAssignedProjects(assignedProjects.filter(id => id !== projectId));
    } else {
      setAssignedProjects([...assignedProjects, projectId]);
    }
  };

  const handleUpdateSkillRating = (category: string, newRating: number) => {
    setSkills(prev => prev.map(s => s.category === category ? { ...s, rating: newRating } : s));
  };

  const handleRemoveSkill = (category: string) => {
    setSkills(prev => prev.filter(s => s.category !== category));
  };

  const handleAddSkill = () => {
    if (skills.some(s => s.category === newSkillCategory)) {
      // Update existing
      handleUpdateSkillRating(newSkillCategory, newSkillRating);
    } else {
      setSkills([...skills, { category: newSkillCategory, rating: newSkillRating }]);
    }
    setIsAddingSkill(false);
  };

  const handleSetLeaveQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const iso = d.toISOString().split('T')[0];
    setLeaveStartDate(iso);
    setLeaveEndDate(iso);
    setIsLeaveRange(false);
  };

  const handleSetLeaveNextDayOfWeek = (targetDayOfWeek: number) => {
    const d = new Date();
    const currentDay = d.getDay();
    let daysToAdd = (targetDayOfWeek - currentDay + 7) % 7;
    if (daysToAdd === 0) daysToAdd = 7;
    d.setDate(d.getDate() + daysToAdd);
    const iso = d.toISOString().split('T')[0];
    setLeaveStartDate(iso);
    setLeaveEndDate(iso);
    setIsLeaveRange(false);
  };

  const handleAddLeaveEntry = () => {
    if (!leaveStartDate) return;
    const finalEnd = isLeaveRange ? (leaveEndDate || leaveStartDate) : leaveStartDate;
    const finalReason = customLeaveReason.trim() || leaveReason || 'Scheduled Leave';

    const newEntry: ArtistLeave = {
      id: `leave-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      startDate: leaveStartDate,
      endDate: finalEnd,
      reason: finalReason,
      status: 'Approved',
      createdAt: todayStr
    };

    const updated = [...leaveSchedule, newEntry].sort((a, b) => a.startDate.localeCompare(b.startDate));
    setLeaveSchedule(updated);
    setCustomLeaveReason('');
    setIsAddingLeave(false);

    // If leave includes today, switch status to 'On Leave'
    if (todayStr >= leaveStartDate && todayStr <= finalEnd) {
      setStatus('On Leave');
    }
  };

  const handleRemoveLeaveEntry = (leaveId: string) => {
    const updated = leaveSchedule.filter(l => l.id !== leaveId);
    setLeaveSchedule(updated);

    const hasLeaveToday = updated.some(l => todayStr >= l.startDate && todayStr <= l.endDate);
    if (status === 'On Leave' && !hasLeaveToday) {
      setStatus('Active');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    updateArtist(artist.id, {
      name: name.trim(),
      email: email.trim(),
      avatar: avatar.trim(),
      role,
      specialization: specialization.trim(),
      status,
      dailyCapacity,
      weeklyCapacity,
      workingDays,
      productionAllocation,
      meetingHoursWeekly,
      assignedProjects,
      skills,
      leaveSchedule
    });

    onClose();
  };

  return (
    <Modal
      id="modal-edit-artist"
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Artist: ${artist.name}`}
      subtitle={`Configure capacity parameters, role, projects, and skills for ID ${artist.id}`}
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div>
            {canCreateProject && (
              <>
                {confirmDelete ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-red-600 font-semibold">Confirm delete?</span>
                    <button
                      type="button"
                      onClick={() => {
                        deleteArtist(artist.id);
                        onClose();
                      }}
                      className="px-2.5 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors shadow-2xs"
                    >
                      Yes, Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-md"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Delete Artist</span>
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-save-artist"
              type="button"
              onClick={handleSubmit}
              disabled={!name.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer"
            >
              Save Artist Changes
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {/* Name and Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Artist Name *</label>
            <input
              id="input-edit-artist-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Leo Fernandez"
              className="w-full text-xs font-medium bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. leo.fernandez@studio.internal"
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            />
          </div>
        </div>

        {/* Role, Specialization and Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as ArtistSpecialization)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            >
              {ALL_ROLES.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Specialization</label>
            <input
              type="text"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              placeholder="e.g. Superstar 3D Models & Retopology"
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'Active' | 'On Leave' | 'Inactive')}
              className="w-full text-xs font-semibold bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            >
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Avatar Preset Selector */}
        <div>
          <label className="text-xs font-semibold text-zinc-800 block mb-1.5">Avatar Image</label>
          <div className="flex items-center gap-2 flex-wrap">
            {AVATAR_PRESETS.map((pUrl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setAvatar(pUrl)}
                className={`w-9 h-9 rounded-full overflow-hidden border-2 transition-all cursor-pointer ${
                  avatar === pUrl ? 'border-zinc-900 ring-2 ring-zinc-900 scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                {pUrl && pUrl.trim() ? (
                  <img src={pUrl.trim()} alt={`Avatar preset ${idx + 1}`} className="w-full h-full object-cover" />
                ) : null}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder="Or paste custom image URL..."
            className="w-full text-[11px] bg-zinc-50 border border-zinc-200 rounded-md px-2 py-1 mt-2 focus:border-zinc-900 outline-hidden font-mono"
          />
        </div>

        {/* Capacity & Production Allocation */}
        <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-900">Capacity & Working Hours</span>
            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
              Effective: {effectiveCapacity}h / week ({weeklyCapacity}h gross @ {productionAllocation}%)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-zinc-700 block mb-1">
                Daily Work Hours
              </label>
              <input
                type="number"
                min="1"
                max="12"
                step="0.5"
                value={dailyCapacity}
                onChange={(e) => setDailyCapacity(parseFloat(e.target.value) || 8)}
                className="w-full text-xs font-bold bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 outline-hidden"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-700 block mb-1">
                Production Allocation %
              </label>
              <input
                type="number"
                min="10"
                max="100"
                step="5"
                value={productionAllocation}
                onChange={(e) => setProductionAllocation(parseInt(e.target.value) || 85)}
                className="w-full text-xs font-bold bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 outline-hidden"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-zinc-700 block mb-1">
                Weekly Meeting Hours
              </label>
              <input
                type="number"
                min="0"
                max="20"
                step="0.5"
                value={meetingHoursWeekly}
                onChange={(e) => setMeetingHoursWeekly(parseFloat(e.target.value) || 4)}
                className="w-full text-xs font-bold bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 outline-hidden"
              />
            </div>
          </div>

          {/* Working Days */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-700 block mb-1">
              Active Working Days ({workingDays.length} days/week)
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {DAYS_OF_WEEK.map(day => {
                const isSelected = workingDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-100'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Assigned Projects */}
        <div>
          <label className="text-xs font-semibold text-zinc-800 block mb-1.5">
            Assigned Projects ({assignedProjects.length} selected)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {projects.map(proj => {
              const isAssigned = assignedProjects.includes(proj.id);
              return (
                <button
                  key={proj.id}
                  type="button"
                  onClick={() => toggleProject(proj.id)}
                  className={`p-2 rounded-lg border text-left text-xs transition-all flex items-center justify-between cursor-pointer ${
                    isAssigned
                      ? 'bg-zinc-900 text-white border-zinc-900 font-semibold'
                      : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  <span className="truncate">{proj.name}</span>
                  <span className="text-[10px] font-mono opacity-80 shrink-0 ml-1">{proj.key}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scheduled Leaves & Availability Date Selection */}
        <div className="pt-3 border-t border-zinc-200 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5">
                <CalendarDays size={14} className="text-zinc-700" />
                <h4 className="text-xs font-bold text-zinc-900">Scheduled Leaves & Time Off</h4>
              </div>
              <p className="text-[11px] text-zinc-500">Pick specific dates or date ranges for artist leave & absence.</p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddingLeave(!isAddingLeave)}
              className="px-2.5 py-1 text-xs font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus size={13} />
              <span>{isAddingLeave ? 'Cancel' : 'Add Leave Dates'}</span>
            </button>
          </div>

          {/* Add Leave Date Form */}
          {isAddingLeave && (
            <div className="p-3 bg-zinc-50 border border-zinc-300 rounded-xl space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-800">New Leave Schedule</span>
                <div className="flex items-center bg-zinc-200/80 p-0.5 rounded-lg text-[11px] font-semibold text-zinc-600">
                  <button
                    type="button"
                    onClick={() => { setIsLeaveRange(false); setLeaveEndDate(leaveStartDate); }}
                    className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                      !isLeaveRange ? 'bg-white text-zinc-900 shadow-2xs font-bold' : 'hover:text-zinc-900'
                    }`}
                  >
                    Single Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLeaveRange(true)}
                    className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                      isLeaveRange ? 'bg-white text-zinc-900 shadow-2xs font-bold' : 'hover:text-zinc-900'
                    }`}
                  >
                    Date Range
                  </button>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleSetLeaveQuickDate(0)}
                  className="px-2 py-0.5 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 rounded-md font-medium"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handleSetLeaveQuickDate(1)}
                  className="px-2 py-0.5 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 rounded-md font-medium"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => handleSetLeaveNextDayOfWeek(1)}
                  className="px-2 py-0.5 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 rounded-md font-medium"
                >
                  Next Mon
                </button>
                <button
                  type="button"
                  onClick={() => handleSetLeaveNextDayOfWeek(2)}
                  className="px-2 py-0.5 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 rounded-md font-medium"
                >
                  Next Tue
                </button>
                <button
                  type="button"
                  onClick={() => handleSetLeaveNextDayOfWeek(3)}
                  className="px-2 py-0.5 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 rounded-md font-medium"
                >
                  Next Wed
                </button>
                <button
                  type="button"
                  onClick={() => handleSetLeaveNextDayOfWeek(4)}
                  className="px-2 py-0.5 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 rounded-md font-medium"
                >
                  Next Thu
                </button>
                <button
                  type="button"
                  onClick={() => handleSetLeaveNextDayOfWeek(5)}
                  className="px-2 py-0.5 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 rounded-md font-medium"
                >
                  Next Fri
                </button>
              </div>

              {/* Date Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-700 block mb-1">
                    {isLeaveRange ? 'Start Date' : 'Leave Date'}
                  </label>
                  <input
                    type="date"
                    value={leaveStartDate}
                    onChange={(e) => {
                      setLeaveStartDate(e.target.value);
                      if (!isLeaveRange) setLeaveEndDate(e.target.value);
                    }}
                    className="w-full text-xs font-semibold bg-white border border-zinc-300 rounded-md p-1.5 outline-hidden"
                  />
                </div>

                {isLeaveRange && (
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-700 block mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={leaveEndDate}
                      min={leaveStartDate}
                      onChange={(e) => setLeaveEndDate(e.target.value)}
                      className="w-full text-xs font-semibold bg-white border border-zinc-300 rounded-md p-1.5 outline-hidden"
                    />
                  </div>
                )}
              </div>

              {/* Reason */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-zinc-700 block mb-1">Reason</label>
                  <select
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    className="w-full text-xs bg-white border border-zinc-300 rounded-md p-1.5 outline-hidden"
                  >
                    <option value="Annual Vacation">Annual Vacation</option>
                    <option value="Personal Day Off">Personal Day Off</option>
                    <option value="Sick / Medical Leave">Sick / Medical Leave</option>
                    <option value="Public Holiday / Comp Off">Public Holiday / Comp Off</option>
                    <option value="Training / Conference">Training / Conference</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-zinc-700 block mb-1">Note (Optional)</label>
                  <input
                    type="text"
                    value={customLeaveReason}
                    onChange={(e) => setCustomLeaveReason(e.target.value)}
                    placeholder="e.g. Taking next Tuesday off"
                    className="w-full text-xs bg-white border border-zinc-300 rounded-md p-1.5 outline-hidden"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingLeave(false)}
                  className="px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddLeaveEntry}
                  className="px-3 py-1 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded-md shadow-xs cursor-pointer"
                >
                  Confirm Leave Date
                </button>
              </div>
            </div>
          )}

          {/* Leaves List */}
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {leaveSchedule.length === 0 ? (
              <p className="text-xs text-zinc-400 italic py-1">No scheduled leaves registered for this artist.</p>
            ) : (
              leaveSchedule.map(leave => {
                const isSingle = leave.startDate === leave.endDate;
                const isCurrent = todayStr >= leave.startDate && todayStr <= leave.endDate;

                return (
                  <div
                    key={leave.id}
                    className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                      isCurrent ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-white border-zinc-200 text-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar size={13} className={isCurrent ? 'text-amber-700' : 'text-zinc-500'} />
                      <span className="font-bold font-mono">
                        {isSingle ? formatDate(leave.startDate) : `${formatDate(leave.startDate)} → ${formatDate(leave.endDate)}`}
                      </span>
                      <span className="text-[11px] text-zinc-500 truncate max-w-[180px]">
                        ({leave.reason})
                      </span>
                      {isCurrent && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded">
                          Current
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveLeaveEntry(leave.id)}
                      className="p-1 text-zinc-400 hover:text-rose-600 transition-colors"
                      title="Remove leave"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Skills Matrix */}
        <div className="pt-2 border-t border-zinc-200">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="text-xs font-bold text-zinc-900">Skill Proficiencies Matrix</h4>
              <p className="text-[11px] text-zinc-500">Rate artist capabilities (1 to 5 stars) for automated AI task matching.</p>
            </div>

            <button
              type="button"
              onClick={() => setIsAddingSkill(!isAddingSkill)}
              className="px-2.5 py-1 text-xs font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus size={13} />
              <span>Add Skill</span>
            </button>
          </div>

          {/* Add Skill Row */}
          {isAddingSkill && (
            <div className="p-3 bg-zinc-100/70 border border-zinc-300 rounded-lg mb-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <select
                  value={newSkillCategory}
                  onChange={(e) => setNewSkillCategory(e.target.value as ArtCategory)}
                  className="text-xs bg-white border border-zinc-300 rounded-md px-2 py-1 outline-hidden"
                >
                  {ALL_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <SkillStars rating={newSkillRating} editable onChange={setNewSkillRating} />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingSkill(false)}
                  className="px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddSkill}
                  className="px-3 py-1 text-xs font-bold text-white bg-zinc-900 rounded-md hover:bg-zinc-800"
                >
                  Confirm
                </button>
              </div>
            </div>
          )}

          {/* Skills List */}
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {skills.length === 0 ? (
              <p className="text-xs text-zinc-400 italic py-2">No skills registered yet.</p>
            ) : (
              skills.map(s => (
                <div
                  key={s.category}
                  className="p-2 bg-white border border-zinc-200 rounded-lg flex items-center justify-between text-xs"
                >
                  <span className="font-semibold text-zinc-800">{s.category}</span>
                  <div className="flex items-center gap-3">
                    <SkillStars
                      rating={s.rating}
                      editable
                      onChange={(newR) => handleUpdateSkillRating(s.category, newR)}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(s.category)}
                      className="text-zinc-400 hover:text-rose-600 p-1 transition-colors"
                      title="Remove skill"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
};
