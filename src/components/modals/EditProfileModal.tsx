import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Camera,
  Upload,
  Link,
  Check,
  Building2,
  Mail,
  Shield,
  Briefcase,
  AlertCircle,
  UserCheck,
  CheckCircle2,
  Calendar,
  CalendarDays,
  Plus,
  Trash2,
  Sun,
  Lock,
  Sparkles,
  Award,
  Zap,
  Clock
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Avatar } from '../common/Avatar';
import { RoleBadge } from '../common/Badge';
import { useArtOps } from '../../context/ArtOpsContext';
import { User, Artist, ArtistLeave, LeaveType, LeaveStatus } from '../../types';
import { getTodayDateString, formatDate } from '../../utils/dateUtils';
import { getArtistSprintLeaveDetails, getArtistSprintCapacity } from '../../utils/forecastEngine';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser?: User | null;
}

const AVATAR_PRESETS = [
  {
    label: 'Studio Director',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80'
  },
  {
    label: 'Lead 3D Artist',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80'
  },
  {
    label: 'Concept Designer',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80'
  },
  {
    label: 'Senior Animator',
    url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80'
  },
  {
    label: 'UI/UX Lead',
    url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&auto=format&fit=crop&q=80'
  },
  {
    label: 'Technical Artist',
    url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200&auto=format&fit=crop&q=80'
  },
  {
    label: 'Art Producer',
    url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80'
  },
  {
    label: 'VFX Specialist',
    url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80'
  }
];

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

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  targetUser
}) => {
  const {
    currentUser,
    users,
    updateUser,
    artists,
    updateArtist,
    sprints,
    tasks,
    canCreateProject,
    addNotification
  } = useArtOps();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active target user
  const [effectiveTarget, setEffectiveTarget] = useState<User | null>(targetUser || currentUser);

  useEffect(() => {
    setEffectiveTarget(targetUser || currentUser);
  }, [targetUser, currentUser, isOpen]);

  const userToEdit = effectiveTarget || currentUser;

  // Check Privacy Permission:
  // Is current user authorized to view this profile?
  // Normal artists can ONLY view their own profile. Managers/Admins can view team members.
  const isManagerOrAdmin = canCreateProject();
  const isOwnProfile = !userToEdit || (currentUser && currentUser.id === userToEdit.id);
  const hasAccessPermission = isManagerOrAdmin || isOwnProfile;

  // Active modal section tab
  const [activeSection, setActiveSection] = useState<'profile' | 'leave' | 'capacity'>('profile');

  // Profile Form state
  const [name, setName] = useState(userToEdit?.name || '');
  const [email, setEmail] = useState(userToEdit?.email || '');
  const [department, setDepartment] = useState(userToEdit?.department || 'Art Department');
  const [title, setTitle] = useState(userToEdit?.title || 'Studio Team Member');
  const [avatarUrl, setAvatarUrl] = useState(userToEdit?.avatar || '');
  const [activePhotoTab, setActivePhotoTab] = useState<'presets' | 'upload' | 'url'>('presets');
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Matching Artist Record for Leave & Capacity
  const matchingArtist = useMemo(() => {
    if (!userToEdit) return null;
    return artists.find(
      a => a.id === userToEdit.id ||
      a.name.toLowerCase() === userToEdit.name.toLowerCase() ||
      a.email.toLowerCase() === userToEdit.email.toLowerCase()
    ) || null;
  }, [artists, userToEdit]);

  // Leave Form state
  const todayStr = getTodayDateString();
  const [leaveStartDate, setLeaveStartDate] = useState(todayStr);
  const [leaveEndDate, setLeaveEndDate] = useState(todayStr);
  const [isLeaveRange, setIsLeaveRange] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('Full Day');
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<'First Half' | 'Second Half'>('First Half');
  const [leaveReason, setLeaveReason] = useState('Personal Day Off');
  const [customLeaveReason, setCustomLeaveReason] = useState('');

  useEffect(() => {
    if (isOpen && userToEdit) {
      setName(userToEdit.name || '');
      setEmail(userToEdit.email || '');
      setDepartment(userToEdit.department || 'Art Department');
      setTitle(userToEdit.title || 'Studio Team Member');
      setAvatarUrl(userToEdit.avatar || '');
      setCustomUrlInput(userToEdit.avatar || '');
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [isOpen, userToEdit]);

  const activeSprint = useMemo(() => {
    return sprints.find(s => s.status === 'Active') || sprints[0] || {
      id: 'sprint-2',
      name: 'Sprint 2',
      startDate: '2026-08-31',
      endDate: '2026-09-04',
      status: 'Active'
    };
  }, [sprints]);

  const artistActiveTasks = useMemo(() => {
    if (!matchingArtist) return [];
    return tasks.filter(t => t.artistId === matchingArtist.id && t.status !== 'DONE');
  }, [matchingArtist, tasks]);

  const sprintCap = useMemo(() => {
    if (!matchingArtist) return null;
    return getArtistSprintCapacity(matchingArtist, activeSprint, artistActiveTasks);
  }, [matchingArtist, activeSprint, artistActiveTasks]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Photo size exceeds 5MB limit. Please select a smaller file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      if (result) {
        let avatarLink = result;
        try {
          const uploadRes = await fetch('/api/media/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: file.name,
              fileType: file.type || 'image/jpeg',
              fileData: result,
              uploadedBy: userToEdit?.name || 'Studio Member'
            })
          });
          if (uploadRes.ok) {
            const resJson = await uploadRes.json();
            if (resJson.success && resJson.media?.url) {
              avatarLink = resJson.media.url;
            }
          }
        } catch (err) {
          console.warn('Avatar upload fallback:', err);
        }

        setAvatarUrl(avatarLink);
        setSuccessMessage('Photo uploaded! Click "Save Profile" to apply.');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCustomUrl = () => {
    if (customUrlInput.trim()) {
      setAvatarUrl(customUrlInput.trim());
      setSuccessMessage('Custom photo link applied!');
      setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!name.trim()) {
      setErrorMessage('Full name is required.');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setErrorMessage('Company email is required.');
      return;
    }

    const existingUser = users.find(
      u => u.id !== userToEdit.id && u.email.toLowerCase() === normalizedEmail
    );
    if (existingUser) {
      setErrorMessage(`Email "${normalizedEmail}" is already used by ${existingUser.name}.`);
      return;
    }

    setIsSaving(true);
    try {
      updateUser(userToEdit.id, {
        name: name.trim(),
        email: normalizedEmail,
        department: department.trim(),
        title: title.trim(),
        avatar: avatarUrl
      });

      // Also update linked artist record if present
      if (matchingArtist) {
        updateArtist(matchingArtist.id, {
          name: name.trim(),
          email: normalizedEmail,
          avatar: avatarUrl,
          role: title.trim() || matchingArtist.role
        });
      }

      addNotification(
        userToEdit.id,
        'Profile Updated',
        `Your studio profile details have been successfully updated.`,
        'success',
        'system'
      );

      setIsSaving(false);
      setSuccessMessage('Profile changes saved successfully!');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update profile.');
      setIsSaving(false);
    }
  };

  const handleAddLeave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchingArtist) {
      setErrorMessage('No artist record linked to this profile for leave management.');
      return;
    }

    if (!leaveStartDate) {
      setErrorMessage('Please select a leave start date.');
      return;
    }

    const finalEndDate = (isLeaveRange && !isHalfDay) ? (leaveEndDate || leaveStartDate) : leaveStartDate;
    if (finalEndDate < leaveStartDate) {
      setErrorMessage('End date cannot be earlier than start date.');
      return;
    }

    const currentLeaves = matchingArtist.leaveSchedule || [];
    const finalReason = customLeaveReason.trim() || leaveReason || 'Personal Leave';
    const dailyHours = matchingArtist.dailyCapacity || 8;
    const hours = isHalfDay ? dailyHours / 2 : (dailyHours * (isLeaveRange ? Math.max(1, (new Date(finalEndDate).getTime() - new Date(leaveStartDate).getTime()) / (1000 * 3600 * 24) + 1) : 1));
    const durationLabel = isHalfDay ? `0.5 Day (${hours}h)` : `${isLeaveRange ? 'Multiple Days' : '1 Day'} (${hours}h)`;

    // Auto-approve if manager or standard artist request
    const status: LeaveStatus = isManagerOrAdmin ? 'Approved' : 'Approved';

    const newLeave: ArtistLeave = {
      id: `leave-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      artistId: matchingArtist.id,
      startDate: leaveStartDate,
      endDate: finalEndDate,
      leaveType: isHalfDay ? 'Half Day' : leaveType,
      isHalfDay,
      halfDayPeriod: isHalfDay ? halfDayPeriod : undefined,
      hours,
      duration: durationLabel,
      reason: finalReason,
      status,
      requestedBy: currentUser?.name || userToEdit?.name || 'Artist',
      approvedBy: isManagerOrAdmin ? currentUser?.name : 'Auto-Approved',
      approvedAt: new Date().toISOString(),
      createdAt: todayStr
    };

    const updatedLeaves = [...currentLeaves, newLeave].sort((a, b) => 
      a.startDate.localeCompare(b.startDate)
    );

    const isTodayInLeave = todayStr >= leaveStartDate && todayStr <= finalEndDate;
    const updatedStatus = isTodayInLeave ? 'On Leave' : matchingArtist.status;

    updateArtist(matchingArtist.id, {
      leaveSchedule: updatedLeaves,
      status: updatedStatus
    });

    setSuccessMessage(`Leave of ${durationLabel} recorded for ${leaveStartDate === finalEndDate ? formatDate(leaveStartDate) : `${formatDate(leaveStartDate)} to ${formatDate(finalEndDate)}`}. Sprint capacity automatically deducted.`);
    setCustomLeaveReason('');
    setIsHalfDay(false);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  const handleRemoveLeave = (leaveId: string) => {
    if (!matchingArtist) return;
    const updatedLeaves = (matchingArtist.leaveSchedule || []).filter(l => l.id !== leaveId);

    const hasActiveLeaveToday = updatedLeaves.some(l => 
      (l.status === 'Approved' || !l.status) && todayStr >= l.startDate && todayStr <= l.endDate
    );
    const updatedStatus = matchingArtist.status === 'On Leave' && !hasActiveLeaveToday ? 'Active' : matchingArtist.status;

    updateArtist(matchingArtist.id, {
      leaveSchedule: updatedLeaves,
      status: updatedStatus
    });

    setSuccessMessage('Leave record removed. Capacity restored.');
    setTimeout(() => setSuccessMessage(null), 2500);
  };

  if (!userToEdit) return null;

  // PRIVACY RESTRICTION VIEW FOR NON-MANAGERS VIEWING ANOTHER ARTIST
  if (!hasAccessPermission) {
    return (
      <Modal
        id="modal-privacy-restricted"
        isOpen={isOpen}
        onClose={onClose}
        title="Private Artist Profile"
        subtitle="Access Restricted"
        maxWidth="md"
      >
        <div className="p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <Lock size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            Private Profile Information
          </h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            In accordance with studio privacy policy, individual artist personal profile information is private. You can only view and manage your own profile.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => setEffectiveTarget(currentUser)}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer"
            >
              Open My Profile
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  const artistLeaves = matchingArtist?.leaveSchedule || [];

  return (
    <Modal
      id="modal-edit-profile"
      isOpen={isOpen}
      onClose={onClose}
      title={isOwnProfile ? "My Studio Profile & Availability" : `Artist Profile: ${userToEdit.name}`}
      subtitle={`Office ID: ${userToEdit.officeId || 'OFF-1001'} • ${userToEdit.department || 'Art Department'}`}
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Error / Success Notifications */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Profile Identity Header Banner */}
        <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <Avatar name={name || userToEdit.name} src={avatarUrl} size="lg" status={matchingArtist?.status} />
              <div className="absolute -bottom-1 -right-1 p-1 bg-blue-600 text-white rounded-full ring-2 ring-slate-900">
                <Camera size={12} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">{name || userToEdit.name}</h3>
                <RoleBadge role={userToEdit.role} />
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {userToEdit.officeId || 'OFF-1001'} • {email || userToEdit.email}
              </p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              {matchingArtist ? 'Daily / Weekly Cap' : 'System Role'}
            </span>
            <span className="text-xs font-semibold text-blue-300 font-mono">
              {matchingArtist ? `${matchingArtist.dailyCapacity || 8}h/day • ${matchingArtist.weeklyCapacity || 40}h/wk` : userToEdit.title}
            </span>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveSection('profile')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'profile'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <UserCheck size={14} />
            <span>Personal Details & Photo</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('leave')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSection === 'leave'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CalendarDays size={14} />
            <span>Leave & Availability ({artistLeaves.length})</span>
          </button>

          {sprintCap && (
            <button
              type="button"
              onClick={() => setActiveSection('capacity')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSection === 'capacity'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Zap size={14} />
              <span>Sprint Capacity ({sprintCap.netAvailableHours}h Avail)</span>
            </button>
          )}
        </div>

        {/* TAB 1: PERSONAL PROFILE & PHOTO */}
        {activeSection === 'profile' && (
          <form onSubmit={handleSubmitProfile} className="space-y-5">
            {/* Photo Customization */}
            <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Camera size={14} className="text-blue-600" />
                  <span>Avatar & Photo Customization</span>
                </label>
                <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-[11px] font-semibold text-slate-600">
                  <button
                    type="button"
                    onClick={() => setActivePhotoTab('presets')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      activePhotoTab === 'presets' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                    }`}
                  >
                    Presets
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePhotoTab('upload')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      activePhotoTab === 'upload' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                    }`}
                  >
                    Upload File
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePhotoTab('url')}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      activePhotoTab === 'url' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                    }`}
                  >
                    Image URL
                  </button>
                </div>
              </div>

              {activePhotoTab === 'presets' && (
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-1">
                  {AVATAR_PRESETS.map((p, idx) => {
                    const isSelected = avatarUrl === p.url;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setAvatarUrl(p.url)}
                        className={`group relative rounded-xl overflow-hidden aspect-square border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 ring-2 ring-blue-500/30 scale-105 shadow-xs'
                            : 'border-slate-200 hover:border-slate-400 opacity-80 hover:opacity-100'
                        }`}
                        title={p.label}
                      >
                        {p.url && p.url.trim() ? (
                          <img src={p.url.trim()} alt={p.label} className="w-full h-full object-cover" />
                        ) : null}
                        {isSelected && (
                          <div className="absolute inset-0 bg-blue-600/30 flex items-center justify-center">
                            <Check size={14} className="text-white drop-shadow-md stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {activePhotoTab === 'upload' && (
                <div className="pt-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-white hover:bg-blue-50/30 p-6 rounded-xl text-center cursor-pointer transition-colors"
                  >
                    <Upload size={24} className="mx-auto text-slate-400 mb-1.5" />
                    <p className="text-xs font-bold text-slate-700">Click to browse and upload avatar photo</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Supports PNG, JPG, WebP up to 5MB</p>
                  </div>
                </div>
              )}

              {activePhotoTab === 'url' && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="relative flex-1">
                    <Link size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input
                      type="url"
                      value={customUrlInput}
                      onChange={(e) => setCustomUrlInput(e.target.value)}
                      placeholder="https://images.unsplash.com/photo-..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyCustomUrl}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>

            {/* Personal Details Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Full Name *</label>
                <div className="relative">
                  <UserCheck size={15} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Company Email *</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Studio Department</label>
                <div className="relative">
                  <Building2 size={15} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Role / Specialization</label>
                <div className="relative">
                  <Briefcase size={15} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={isSaving || !name.trim() || !email.trim()}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs cursor-pointer transition-all flex items-center gap-1.5"
              >
                <Check size={14} className="stroke-[2.5]" />
                <span>Save Profile Changes</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: LEAVE & AVAILABILITY */}
        {activeSection === 'leave' && (
          <div className="space-y-4">
            {/* Live Sprint Capacity Formula Card */}
            {sprintCap && (
              <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-blue-950">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-blue-600" />
                    <span>Sprint Capacity & Leave Deduction Formula</span>
                  </div>
                  <span className="font-mono">{activeSprint.name} ({activeSprint.startDate} to {activeSprint.endDate})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
                  <div className="p-2 bg-white rounded-xl border border-blue-100">
                    <span className="text-[10px] text-slate-400 font-bold block">Gross Capacity</span>
                    <span className="font-bold text-slate-900">{sprintCap.grossCapacityHours}h</span>
                    <span className="text-[10px] text-slate-500 block">{sprintCap.sprintWorkingDays} working days</span>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-amber-200 bg-amber-50/50">
                    <span className="text-[10px] text-amber-800 font-bold block">Approved Leave</span>
                    <span className="font-bold text-amber-900">-{sprintCap.leaveHoursDeducted}h</span>
                    <span className="text-[10px] text-amber-700 block">{sprintCap.leaveDaysCount} days leave</span>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-emerald-200 bg-emerald-50/50">
                    <span className="text-[10px] text-emerald-800 font-bold block">Available Capacity</span>
                    <span className="font-bold text-emerald-900 text-sm">{sprintCap.netAvailableHours}h</span>
                    <span className="text-[10px] text-emerald-700 block">Gross − Leave</span>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-blue-100">
                    <span className="text-[10px] text-slate-400 font-bold block">Active Tasks Load</span>
                    <span className="font-bold text-slate-900">{sprintCap.committedHours}h</span>
                    <span className="text-[10px] text-slate-500 block">{sprintCap.utilization}% capacity</span>
                  </div>
                </div>
              </div>
            )}

            {/* Leave Request Form */}
            <form onSubmit={handleAddLeave} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Plus size={14} className="text-blue-600" />
                  <span>Request / Record Time Off</span>
                </span>
                {!isHalfDay && (
                  <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-[11px] font-semibold text-slate-600">
                    <button
                      type="button"
                      onClick={() => { setIsLeaveRange(false); setLeaveEndDate(leaveStartDate); }}
                      className={`px-2 py-0.5 rounded-md cursor-pointer ${!isLeaveRange ? 'bg-white text-slate-900 shadow-2xs font-bold' : ''}`}
                    >
                      Single Day
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsLeaveRange(true)}
                      className={`px-2 py-0.5 rounded-md cursor-pointer ${isLeaveRange ? 'bg-white text-slate-900 shadow-2xs font-bold' : ''}`}
                    >
                      Date Range
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isLeaveRange && !isHalfDay ? 'Start Date *' : 'Leave Date *'}
                  </label>
                  <input
                    type="date"
                    value={leaveStartDate}
                    onChange={(e) => {
                      setLeaveStartDate(e.target.value);
                      if (!isLeaveRange || isHalfDay) setLeaveEndDate(e.target.value);
                    }}
                    className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-xl p-2"
                    required
                  />
                </div>

                {isLeaveRange && !isHalfDay && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">End Date *</label>
                    <input
                      type="date"
                      value={leaveEndDate}
                      min={leaveStartDate}
                      onChange={(e) => setLeaveEndDate(e.target.value)}
                      className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-xl p-2"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Half Day Checkbox */}
              <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs">
                <label className="flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isHalfDay}
                    onChange={(e) => {
                      setIsHalfDay(e.target.checked);
                      if (e.target.checked) {
                        setIsLeaveRange(false);
                        setLeaveEndDate(leaveStartDate);
                        setLeaveType('Half Day');
                      } else {
                        setLeaveType('Full Day');
                      }
                    }}
                    className="rounded border-slate-300 text-blue-600 h-4 w-4"
                  />
                  <span>Half Day Leave (4h deduction)</span>
                </label>

                {isHalfDay && (
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="halfDayChoiceProfile"
                        checked={halfDayPeriod === 'First Half'}
                        onChange={() => setHalfDayPeriod('First Half')}
                        className="text-blue-600"
                      />
                      <span>First Half (09:00 - 13:00)</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="halfDayChoiceProfile"
                        checked={halfDayPeriod === 'Second Half'}
                        onChange={() => setHalfDayPeriod('Second Half')}
                        className="text-blue-600"
                      />
                      <span>Second Half (14:00 - 18:00)</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Leave Category</label>
                  <select
                    value={isHalfDay ? 'Half Day' : leaveType}
                    onChange={(e) => {
                      const val = e.target.value as LeaveType;
                      setLeaveType(val);
                      if (val === 'Half Day') {
                        setIsHalfDay(true);
                        setIsLeaveRange(false);
                      } else {
                        setIsHalfDay(false);
                      }
                    }}
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2"
                  >
                    {LEAVE_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Notes</label>
                  <input
                    type="text"
                    value={customLeaveReason}
                    onChange={(e) => setCustomLeaveReason(e.target.value)}
                    placeholder="e.g. Taking Friday off for family event"
                    className="w-full text-xs bg-white border border-slate-300 rounded-xl p-2"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
              >
                <Plus size={14} />
                <span>Submit Leave & Update Sprint Capacity</span>
              </button>
            </form>

            {/* Leave History List */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                Leave Records & History ({artistLeaves.length})
              </span>

              {artistLeaves.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center">
                  <Sun size={20} className="mx-auto text-amber-500 mb-1" />
                  <p className="text-xs font-medium text-slate-600">No scheduled leaves registered.</p>
                  <p className="text-[11px] text-slate-400">You have full working availability for the sprint.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {artistLeaves.map(leave => {
                    const isSingle = leave.startDate === leave.endDate;
                    const isApproved = leave.status === 'Approved' || !leave.status;

                    return (
                      <div
                        key={leave.id}
                        className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
                            <Calendar size={13} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold font-mono text-slate-900">
                                {isSingle ? formatDate(leave.startDate) : `${formatDate(leave.startDate)} → ${formatDate(leave.endDate)}`}
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-800 rounded">
                                {leave.isHalfDay ? `0.5 Day (${leave.hours || 4}h)` : `${leave.hours ? `${leave.hours}h` : '1 Day (8h)'}`}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isApproved ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {leave.status || 'Approved'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {leave.leaveType || 'Leave'}: {leave.reason || 'Personal Day Off'}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveLeave(leave.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Cancel / Delete Leave"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CAPACITY & ACTIVE WORKLOAD */}
        {activeSection === 'capacity' && matchingArtist && sprintCap && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Zap size={14} className="text-blue-600" />
                <span>Working Schedule & Skill Matrix</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block">Daily Capacity</span>
                  <span className="font-bold text-slate-900 text-sm">{matchingArtist.dailyCapacity || 8}h</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block">Weekly Capacity</span>
                  <span className="font-bold text-slate-900 text-sm">{matchingArtist.weeklyCapacity || 40}h</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block">Working Days</span>
                  <span className="font-bold text-slate-900 text-xs">{matchingArtist.workingDays?.join(', ') || 'Mon-Fri'}</span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold block">Production Alloc</span>
                  <span className="font-bold text-slate-900 text-sm">{matchingArtist.productionAllocation}%</span>
                </div>
              </div>
            </div>

            {/* Active Sprint Tasks List */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                Active Sprint Deliverables ({artistActiveTasks.length})
              </span>
              {artistActiveTasks.length === 0 ? (
                <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center">
                  <CheckCircle2 size={20} className="mx-auto text-emerald-500 mb-1" />
                  <p className="text-xs font-medium text-slate-600">No active tasks in current sprint.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {artistActiveTasks.map(t => (
                    <div
                      key={t.id}
                      className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{t.title}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded font-mono">
                            {t.jiraIssueKey || t.id}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Status: {t.status} • Estimate: {t.originalEstimate || 0}h • Logged: {t.timeLogged || 0}h
                        </p>
                      </div>
                      <span className="text-xs font-bold text-blue-700 font-mono">
                        {t.storyPoints || 0} SP
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
