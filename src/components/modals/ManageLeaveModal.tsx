import React, { useState } from 'react';
import { useArtOps } from '../../context/ArtOpsContext';
import { Artist, ArtistLeave, LeaveStatus, LeaveType } from '../../types';
import { Modal } from '../common/Modal';
import { Avatar } from '../common/Avatar';
import { getTodayDateString, formatDate } from '../../utils/dateUtils';
import {
  Calendar,
  CalendarDays,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sun,
  Umbrella,
  Plane,
  Edit2,
  Check,
  X,
  Sparkles,
  Info
} from 'lucide-react';
import { getArtistSprintLeaveDetails, getArtistSprintCapacity } from '../../utils/forecastEngine';

interface ManageLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  artist: Artist | null;
}

const LEAVE_TYPES: LeaveType[] = [
  'Full Day',
  'Half Day',
  'Sick Leave',
  'Casual Leave',
  'Vacation',
  'Public Holiday',
  'Family Emergency',
  'Personal Day Off'
];

const COMMON_REASONS = [
  'Personal Day Off',
  'Annual Vacation',
  'Sick / Medical Recovery',
  'Public Holiday / Festival',
  'Family Emergency / Urgent Personal',
  'Doctor / Hospital Appointment',
  'Training / Workshop',
  'Compensatory Off'
];

export const ManageLeaveModal: React.FC<ManageLeaveModalProps> = ({
  isOpen,
  onClose,
  artist
}) => {
  const { updateArtist, currentUser, sprints, tasks, canCreateProject } = useArtOps();

  const todayStr = getTodayDateString();
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [isRange, setIsRange] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('Full Day');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<'First Half' | 'Second Half'>('First Half');
  const [reason, setReason] = useState('Personal Day Off');
  const [customReason, setCustomReason] = useState('');
  const [status, setStatus] = useState<LeaveStatus>('Approved');
  
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editStatus, setEditStatus] = useState<LeaveStatus>('Approved');

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!artist) return null;

  const currentLeaves = artist.leaveSchedule || [];
  const activeSprint = sprints.find(s => s.status === 'Active') || sprints[0] || {
    id: 'sprint-2',
    name: 'Sprint 2',
    startDate: '2026-08-31',
    endDate: '2026-09-04',
    status: 'Active'
  };

  const artistActiveTasks = tasks.filter(t => t.artistId === artist.id && t.status !== 'DONE');
  const sprintCap = getArtistSprintCapacity(artist, activeSprint, artistActiveTasks);

  const handleSetQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const iso = d.toISOString().split('T')[0];
    setStartDate(iso);
    setEndDate(iso);
    setIsRange(false);
  };

  const handleSetNextDayOfWeek = (targetDayOfWeek: number) => {
    const d = new Date();
    const currentDay = d.getDay();
    let daysToAdd = (targetDayOfWeek - currentDay + 7) % 7;
    if (daysToAdd === 0) daysToAdd = 7;
    d.setDate(d.getDate() + daysToAdd);
    const iso = d.toISOString().split('T')[0];
    setStartDate(iso);
    setEndDate(iso);
    setIsRange(false);
  };

  const handleAddLeave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!startDate) {
      setErrorMsg('Please select a start date.');
      return;
    }

    const finalEndDate = (isRange && !isHalfDay) ? (endDate || startDate) : startDate;

    if (finalEndDate < startDate) {
      setErrorMsg('End date cannot be earlier than start date.');
      return;
    }

    const finalReason = customReason.trim() || reason || 'Scheduled Leave';
    const dailyHours = artist.dailyCapacity || 8;
    const hours = isHalfDay ? dailyHours / 2 : (dailyHours * (isRange ? Math.max(1, (new Date(finalEndDate).getTime() - new Date(startDate).getTime()) / (1000 * 3600 * 24) + 1) : 1));
    const durationLabel = isHalfDay ? `0.5 Day (${hours}h)` : `${isRange ? 'Multiple Days' : '1 Day'} (${hours}h)`;

    const newLeave: ArtistLeave = {
      id: `leave-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      artistId: artist.id,
      startDate,
      endDate: finalEndDate,
      leaveType: isHalfDay ? 'Half Day' : leaveType,
      isHalfDay,
      halfDayPeriod: isHalfDay ? halfDayPeriod : undefined,
      hours,
      duration: durationLabel,
      reason: finalReason,
      status,
      requestedBy: currentUser?.name || 'Manager',
      approvedBy: status === 'Approved' ? (currentUser?.name || 'Manager') : undefined,
      approvedAt: status === 'Approved' ? new Date().toISOString() : undefined,
      createdAt: todayStr
    };

    const updatedLeaves = [...currentLeaves, newLeave].sort((a, b) => 
      a.startDate.localeCompare(b.startDate)
    );

    // If today is within this approved leave period, auto-switch status to 'On Leave'
    const isTodayInLeave = status === 'Approved' && todayStr >= startDate && todayStr <= finalEndDate;
    const updatedStatus = isTodayInLeave ? 'On Leave' : artist.status;

    updateArtist(artist.id, {
      leaveSchedule: updatedLeaves,
      status: updatedStatus
    });

    setSuccessMsg(`Leave recorded (${durationLabel}) for ${startDate === finalEndDate ? formatDate(startDate) : `${formatDate(startDate)} to ${formatDate(finalEndDate)}`}. Capacity automatically updated.`);
    setCustomReason('');
    setIsHalfDay(false);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  const handleUpdateLeaveStatus = (leaveId: string, newStatus: LeaveStatus) => {
    const updatedLeaves = currentLeaves.map(l => {
      if (l.id === leaveId) {
        return {
          ...l,
          status: newStatus,
          approvedBy: newStatus === 'Approved' ? (currentUser?.name || 'Manager') : l.approvedBy,
          approvedAt: newStatus === 'Approved' ? new Date().toISOString() : l.approvedAt
        };
      }
      return l;
    });

    // Check if artist is currently on approved leave today
    const hasActiveLeaveToday = updatedLeaves.some(l => 
      l.status === 'Approved' && todayStr >= l.startDate && todayStr <= l.endDate
    );
    const updatedStatus = hasActiveLeaveToday ? 'On Leave' : (artist.status === 'On Leave' ? 'Active' : artist.status);

    updateArtist(artist.id, {
      leaveSchedule: updatedLeaves,
      status: updatedStatus
    });

    setSuccessMsg(`Leave status changed to ${newStatus}. Capacity recalculated.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleStartEdit = (leave: ArtistLeave) => {
    setEditingLeaveId(leave.id);
    setEditStartDate(leave.startDate);
    setEditEndDate(leave.endDate);
    setEditStatus(leave.status || 'Approved');
  };

  const handleSaveEdit = (leaveId: string) => {
    if (!editStartDate) return;
    const finalEnd = editEndDate >= editStartDate ? editEndDate : editStartDate;

    const updatedLeaves = currentLeaves.map(l => {
      if (l.id === leaveId) {
        return {
          ...l,
          startDate: editStartDate,
          endDate: finalEnd,
          status: editStatus
        };
      }
      return l;
    }).sort((a, b) => a.startDate.localeCompare(b.startDate));

    const hasActiveLeaveToday = updatedLeaves.some(l => 
      l.status === 'Approved' && todayStr >= l.startDate && todayStr <= l.endDate
    );
    const updatedStatus = hasActiveLeaveToday ? 'On Leave' : (artist.status === 'On Leave' ? 'Active' : artist.status);

    updateArtist(artist.id, {
      leaveSchedule: updatedLeaves,
      status: updatedStatus
    });

    setEditingLeaveId(null);
    setSuccessMsg('Leave dates and status updated successfully.');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleRemoveLeave = (leaveId: string) => {
    const updatedLeaves = currentLeaves.filter(l => l.id !== leaveId);
    
    // Check if artist is still currently on leave
    const hasActiveLeaveToday = updatedLeaves.some(l => 
      l.status === 'Approved' && todayStr >= l.startDate && todayStr <= l.endDate
    );
    const updatedStatus = artist.status === 'On Leave' && !hasActiveLeaveToday ? 'Active' : artist.status;

    updateArtist(artist.id, {
      leaveSchedule: updatedLeaves,
      status: updatedStatus
    });

    setSuccessMsg('Leave entry deleted. Capacity restored.');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  return (
    <Modal
      id="modal-manage-leave"
      isOpen={isOpen}
      onClose={onClose}
      title={`Leave & Capacity Management: ${artist.name}`}
      subtitle={`Admin & Manager controls for time off, approvals, date corrections, and automatic sprint capacity deductions`}
      maxWidth="2xl"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg shadow-xs cursor-pointer"
        >
          Done
        </button>
      }
    >
      <div className="space-y-5">
        {/* Artist Header Profile Banner & Live Capacity Calculation */}
        <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={artist.name} src={artist.avatar} size="md" status={artist.status} />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-zinc-900">{artist.name}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    artist.status === 'On Leave' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {artist.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 font-medium font-mono">
                  {artist.role} • {artist.dailyCapacity || 8}h/day • {artist.weeklyCapacity || 40}h/wk ({artist.workingDays?.join(', ') || 'Mon-Fri'})
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">Leave Records</span>
              <span className="text-xs font-bold text-zinc-800 font-mono">{currentLeaves.length} registered</span>
            </div>
          </div>

          {/* Real-time Sprint 2 Capacity Calculation Formula */}
          <div className="pt-2.5 border-t border-zinc-200/70 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
            <div className="p-2 bg-white rounded-xl border border-zinc-200">
              <span className="text-[10px] text-zinc-400 font-bold block uppercase">Sprint Gross</span>
              <span className="font-bold text-zinc-900">{sprintCap.grossCapacityHours}h</span>
              <span className="text-[10px] text-zinc-400 block">{sprintCap.sprintWorkingDays} working days</span>
            </div>

            <div className="p-2 bg-white rounded-xl border border-amber-200 bg-amber-50/40">
              <span className="text-[10px] text-amber-800 font-bold block uppercase">Approved Leave</span>
              <span className="font-bold text-amber-900">-{sprintCap.leaveHoursDeducted}h</span>
              <span className="text-[10px] text-amber-700 block">{sprintCap.leaveDaysCount} days leave</span>
            </div>

            <div className="p-2 bg-white rounded-xl border border-blue-200 bg-blue-50/40">
              <span className="text-[10px] text-blue-700 font-bold block uppercase">Available Cap</span>
              <span className="font-bold text-blue-900 text-sm">{sprintCap.netAvailableHours}h</span>
              <span className="text-[10px] text-blue-600 block">Gross − Leave</span>
            </div>

            <div className="p-2 bg-white rounded-xl border border-zinc-200">
              <span className="text-[10px] text-zinc-400 font-bold block uppercase">Committed Load</span>
              <span className="font-bold text-zinc-900">{sprintCap.committedHours}h</span>
              <span className="text-[10px] text-zinc-500 block">{sprintCap.utilization}% util</span>
            </div>
          </div>
        </div>

        {/* Success / Error Banners */}
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Add Leave Form Section */}
        <form onSubmit={handleAddLeave} className="p-4 bg-white border border-zinc-200 rounded-2xl space-y-4 shadow-2xs">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-900">
              <Calendar size={15} className="text-zinc-700" />
              <span>Record / Request Leave</span>
            </div>

            {/* Toggle Single vs Range */}
            {!isHalfDay && (
              <div className="flex items-center bg-zinc-100 p-0.5 rounded-lg text-[11px] font-semibold text-zinc-600">
                <button
                  type="button"
                  onClick={() => { setIsRange(false); setEndDate(startDate); }}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    !isRange ? 'bg-white text-zinc-900 shadow-2xs font-bold' : 'hover:text-zinc-900'
                  }`}
                >
                  Single Day
                </button>
                <button
                  type="button"
                  onClick={() => setIsRange(true)}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    isRange ? 'bg-white text-zinc-900 shadow-2xs font-bold' : 'hover:text-zinc-900'
                  }`}
                >
                  Date Range
                </button>
              </div>
            )}
          </div>

          {/* Quick Presets */}
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 block mb-1.5">Quick Date Presets:</label>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => handleSetQuickDate(0)}
                className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md font-medium transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => handleSetQuickDate(1)}
                className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md font-medium transition-colors cursor-pointer"
              >
                Tomorrow
              </button>
              <button
                type="button"
                onClick={() => handleSetNextDayOfWeek(1)}
                className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md font-medium transition-colors cursor-pointer"
              >
                Next Mon
              </button>
              <button
                type="button"
                onClick={() => handleSetNextDayOfWeek(2)}
                className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md font-medium transition-colors cursor-pointer"
              >
                Next Tue
              </button>
              <button
                type="button"
                onClick={() => handleSetNextDayOfWeek(3)}
                className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md font-medium transition-colors cursor-pointer"
              >
                Next Wed
              </button>
              <button
                type="button"
                onClick={() => handleSetNextDayOfWeek(4)}
                className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md font-medium transition-colors cursor-pointer"
              >
                Next Thu
              </button>
              <button
                type="button"
                onClick={() => handleSetNextDayOfWeek(5)}
                className="px-2 py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-md font-medium transition-colors cursor-pointer"
              >
                Next Fri
              </button>
            </div>
          </div>

          {/* Date Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-800 block mb-1">
                {isRange && !isHalfDay ? 'Leave Start Date *' : 'Leave Date *'}
              </label>
              <input
                id="input-leave-start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!isRange || isHalfDay) setEndDate(e.target.value);
                }}
                className="w-full text-xs font-semibold bg-white border border-zinc-300 rounded-lg p-2 focus:border-zinc-900 outline-hidden"
                required
              />
            </div>

            {isRange && !isHalfDay && (
              <div>
                <label className="text-xs font-semibold text-zinc-800 block mb-1">
                  Leave End Date *
                </label>
                <input
                  id="input-leave-end-date"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs font-semibold bg-white border border-zinc-300 rounded-lg p-2 focus:border-zinc-900 outline-hidden"
                  required
                />
              </div>
            )}
          </div>

          {/* Half Day Option */}
          <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-zinc-800 cursor-pointer">
              <input
                type="checkbox"
                checked={isHalfDay}
                onChange={(e) => {
                  setIsHalfDay(e.target.checked);
                  if (e.target.checked) {
                    setIsRange(false);
                    setEndDate(startDate);
                    setLeaveType('Half Day');
                  } else {
                    setLeaveType('Full Day');
                  }
                }}
                className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 h-4 w-4"
              />
              <span>Half Day Leave (4 Working Hours Deduction)</span>
            </label>

            {isHalfDay && (
              <div className="flex items-center gap-4 pl-6 pt-1 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="halfDayChoice"
                    checked={halfDayPeriod === 'First Half'}
                    onChange={() => setHalfDayPeriod('First Half')}
                    className="text-zinc-900 focus:ring-zinc-900"
                  />
                  <span>First Half (09:00 - 13:00)</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="halfDayChoice"
                    checked={halfDayPeriod === 'Second Half'}
                    onChange={() => setHalfDayPeriod('Second Half')}
                    className="text-zinc-900 focus:ring-zinc-900"
                  />
                  <span>Second Half (14:00 - 18:00)</span>
                </label>
              </div>
            )}
          </div>

          {/* Leave Type & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-800 block mb-1">Leave Type</label>
              <select
                value={isHalfDay ? 'Half Day' : leaveType}
                onChange={(e) => {
                  const val = e.target.value as LeaveType;
                  setLeaveType(val);
                  if (val === 'Half Day') {
                    setIsHalfDay(true);
                    setIsRange(false);
                  } else {
                    setIsHalfDay(false);
                  }
                }}
                className="w-full text-xs bg-white border border-zinc-300 rounded-lg p-2 focus:border-zinc-900 outline-hidden"
              >
                {LEAVE_TYPES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-800 block mb-1">Approval Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as LeaveStatus)}
                className="w-full text-xs bg-white border border-zinc-300 rounded-lg p-2 focus:border-zinc-900 outline-hidden font-semibold"
              >
                <option value="Approved">Approved (Immediately reduces capacity)</option>
                <option value="Pending">Pending Approval</option>
                <option value="Rejected">Rejected</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Reason Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-800 block mb-1">Reason / Category</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full text-xs bg-white border border-zinc-300 rounded-lg p-2 focus:border-zinc-900 outline-hidden"
              >
                {COMMON_REASONS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-800 block mb-1">Custom Note / Description</label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="e.g. Taking Tuesday off for doctor appointment"
                className="w-full text-xs bg-white border border-zinc-300 rounded-lg p-2 focus:border-zinc-900 outline-hidden"
              />
            </div>
          </div>

          <button
            id="btn-add-leave-submit"
            type="submit"
            className="w-full py-2.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus size={14} />
            <span>Record Leave & Deduct Sprint Capacity</span>
          </button>
        </form>

        {/* Existing Leaves List & Management Table */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
              <CalendarDays size={14} className="text-zinc-600" />
              <span>Leave Records & History ({currentLeaves.length})</span>
            </h4>
          </div>

          {currentLeaves.length === 0 ? (
            <div className="p-6 bg-zinc-50 border border-dashed border-zinc-200 rounded-xl text-center">
              <Sun size={24} className="mx-auto text-amber-500/70 mb-1" />
              <p className="text-xs font-medium text-zinc-600">No scheduled leaves registered for {artist.name}.</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">Artist has full 40h standard working capacity for the sprint.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {currentLeaves.map(leave => {
                const isSingle = leave.startDate === leave.endDate;
                const isCurrent = (leave.status === 'Approved' || !leave.status) && todayStr >= leave.startDate && todayStr <= leave.endDate;
                const isUpcoming = leave.startDate > todayStr;
                const isEditing = editingLeaveId === leave.id;
                const currentStatus: LeaveStatus = leave.status || 'Approved';

                return (
                  <div
                    key={leave.id}
                    className={`p-3.5 rounded-xl border flex flex-col gap-2 text-xs transition-all ${
                      currentStatus === 'Approved'
                        ? isCurrent
                          ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                          : 'bg-white border-zinc-200'
                        : currentStatus === 'Pending'
                        ? 'bg-blue-50/50 border-blue-200'
                        : 'bg-zinc-50 border-zinc-200 opacity-60'
                    }`}
                  >
                    {isEditing ? (
                      /* Inline Date & Status Editing Mode */
                      <div className="space-y-2.5 p-2 bg-zinc-100/80 rounded-lg">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-zinc-600 block">Start Date</label>
                            <input
                              type="date"
                              value={editStartDate}
                              onChange={(e) => setEditStartDate(e.target.value)}
                              className="w-full text-xs p-1.5 bg-white border border-zinc-300 rounded font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-zinc-600 block">End Date</label>
                            <input
                              type="date"
                              value={editEndDate}
                              min={editStartDate}
                              onChange={(e) => setEditEndDate(e.target.value)}
                              className="w-full text-xs p-1.5 bg-white border border-zinc-300 rounded font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-zinc-600 block">Status</label>
                            <select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value as LeaveStatus)}
                              className="w-full text-xs p-1.5 bg-white border border-zinc-300 rounded font-semibold"
                            >
                              <option value="Approved">Approved</option>
                              <option value="Pending">Pending</option>
                              <option value="Rejected">Rejected</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingLeaveId(null)}
                            className="px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-900 bg-white border border-zinc-200 rounded cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(leave.id)}
                            className="px-3 py-1 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 rounded cursor-pointer flex items-center gap-1"
                          >
                            <Check size={12} />
                            <span>Save Changes</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Standard Row View */
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <div className={`p-2 rounded-lg shrink-0 ${isCurrent ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-700'}`}>
                            <Calendar size={14} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold font-mono text-zinc-900">
                                {isSingle ? formatDate(leave.startDate) : `${formatDate(leave.startDate)} → ${formatDate(leave.endDate)}`}
                              </span>

                              {/* Duration / Hours Badge */}
                              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-zinc-100 text-zinc-800 rounded border border-zinc-200">
                                {leave.isHalfDay ? `0.5 Day (${leave.hours || 4}h) · ${leave.halfDayPeriod || 'Half Day'}` : `${leave.hours ? `${leave.hours}h` : '1 Day (8h)'}`}
                              </span>

                              {/* Status Badge */}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                currentStatus === 'Approved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : currentStatus === 'Pending'
                                  ? 'bg-blue-100 text-blue-800'
                                  : currentStatus === 'Rejected'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-zinc-200 text-zinc-700'
                              }`}>
                                {currentStatus}
                              </span>

                              {isCurrent && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded">
                                  Active Today
                                </span>
                              )}
                            </div>

                            <p className="text-[11px] text-zinc-600 mt-0.5 font-medium">
                              <span className="font-semibold text-zinc-800">{leave.leaveType || 'Leave'}:</span> {leave.reason || 'Personal Day Off'}
                            </p>
                          </div>
                        </div>

                        {/* Actions Strip */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Approval Switchers for Managers */}
                          {currentStatus !== 'Approved' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateLeaveStatus(leave.id, 'Approved')}
                              className="px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-md transition-colors cursor-pointer"
                              title="Approve Leave"
                            >
                              Approve
                            </button>
                          )}

                          {currentStatus === 'Approved' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateLeaveStatus(leave.id, 'Cancelled')}
                              className="px-2 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-100 border border-zinc-200 rounded-md transition-colors cursor-pointer"
                              title="Cancel Leave"
                            >
                              Cancel
                            </button>
                          )}

                          {currentStatus === 'Pending' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateLeaveStatus(leave.id, 'Rejected')}
                              className="px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-md transition-colors cursor-pointer"
                              title="Reject Leave"
                            >
                              Reject
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleStartEdit(leave)}
                            className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Dates / Status"
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveLeave(leave.id)}
                            className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Leave Entry"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
