import React, { useState } from 'react';
import { User, UserRole, ArtistSpecialization, ArtCategory, ArtistSkill } from '../../types';
import { useArtOps } from '../../context/ArtOpsContext';
import { Modal } from '../common/Modal';
import { SkillStars } from '../common/SkillStars';
import { getTodayDateString } from '../../utils/dateUtils';
import { UserPlus, Shield, Sparkles, CheckCircle2, Paintbrush, Briefcase, Mail } from 'lucide-react';

interface AddPersonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPersonAdded?: (user: User) => void;
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

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80'
];

export const AddPersonModal: React.FC<AddPersonModalProps> = ({ isOpen, onClose, onPersonAdded }) => {
  const { addUser, addArtist, projects, addNotification } = useArtOps();

  // Basic Info
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [officeId, setOfficeId] = useState('');
  const [role, setRole] = useState<UserRole>('ART_MANAGER');
  const [department, setDepartment] = useState('Art Department');
  const [title, setTitle] = useState('Art Operations Manager');
  const [avatar, setAvatar] = useState(PRESET_AVATARS[0]);

  // Artist Specific fields (used if role === 'ARTIST')
  const [artistRole, setArtistRole] = useState<ArtistSpecialization>('Character Artist');
  const [specialization, setSpecialization] = useState('3D Characters & High-Poly Sculpting');
  const [dailyCapacity, setDailyCapacity] = useState(8);
  const [productionAllocation, setProductionAllocation] = useState(85);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [primaryCategory, setPrimaryCategory] = useState<ArtCategory>('Character');
  const [primaryRating, setPrimaryRating] = useState(5);
  const [secondaryCategory, setSecondaryCategory] = useState<ArtCategory>('3D Render');
  const [secondaryRating, setSecondaryRating] = useState(4);
  const [skillsList, setSkillsList] = useState<{ category: ArtCategory; rating: number }[]>([
    { category: 'Character', rating: 5 },
    { category: '3D Render', rating: 4 }
  ]);

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === 'ADMIN') {
      setDepartment('Studio Leadership');
      setTitle('Studio Systems Administrator');
    } else if (newRole === 'ART_DIRECTOR') {
      setDepartment('Art Leadership');
      setTitle('Executive Art Director');
    } else if (newRole === 'ART_MANAGER') {
      setDepartment('Art Department');
      setTitle('Art Operations Manager');
    } else if (newRole === 'ARTIST') {
      setDepartment('Art Department');
      setTitle('Senior Artist / Production Specialist');
    } else if (newRole === 'COMPANY_REQUESTER') {
      setDepartment('Live Operations / Product');
      setTitle('Senior LiveOps Producer / Campaign Lead');
    }
  };

  const handleToggleProject = (projId: string) => {
    if (selectedProjects.includes(projId)) {
      setSelectedProjects(selectedProjects.filter(id => id !== projId));
    } else {
      setSelectedProjects([...selectedProjects, projId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const finalEmail = email.trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@gamestudio.com`;

    const generatedOfficeId = officeId.trim().toUpperCase() || `OFF-${Math.floor(1000 + Math.random() * 9000)}`;

    // 1. Create the User
    const createdUser = addUser({
      name: name.trim(),
      email: finalEmail,
      officeId: generatedOfficeId,
      password: 'password123',
      role,
      avatar,
      department: department.trim() || 'Art Department',
      title: title.trim() || 'Studio Team Member',
      status: 'ACTIVE',
      createdAt: getTodayDateString()
    });

    // 2. If ARTIST, create the linked Artist record
    if (role === 'ARTIST') {
      const artistSkills: ArtistSkill[] = [
        { category: primaryCategory, rating: primaryRating },
        { category: secondaryCategory, rating: secondaryRating }
      ];

      const createdArtist = addArtist({
        userId: createdUser.id,
        name: name.trim(),
        email: finalEmail,
        avatar,
        role: artistRole,
        specialization: specialization.trim() || `${artistRole} Specialist`,
        assignedProjects: selectedProjects.length > 0 ? selectedProjects : projects.map(p => p.id),
        dailyCapacity,
        weeklyCapacity: dailyCapacity * 5,
        workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        productionAllocation,
        meetingHoursWeekly: 4,
        status: 'Active',
        joinDate: getTodayDateString(),
        skills: artistSkills,
        leaveSchedule: []
      });

      // Link artistId to user
      createdUser.artistId = createdArtist.id;
    }

    addNotification(
      createdUser.id,
      'Welcome to RG ArtFlow',
      `Welcome ${name}! Your account has been provisioned with ${role} permissions.`,
      'success'
    );

    if (onPersonAdded) {
      onPersonAdded(createdUser);
    }

    // Reset & close
    setName('');
    setEmail('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Person to Studio"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
            <UserPlus size={14} className="text-indigo-600" />
            <span>Profile & Account Credentials</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Alex Morgan"
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs text-zinc-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Studio Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. alex.morgan@gamestudio.com"
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs text-zinc-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Studio Office ID (e.g. OFF-1055)
              </label>
              <input
                type="text"
                value={officeId}
                onChange={(e) => setOfficeId(e.target.value)}
                placeholder="Auto-generated if blank"
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-mono font-bold text-zinc-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-hidden transition-all uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                System Role & Permissions <span className="text-rose-500">*</span>
              </label>
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                className="w-full px-3 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs font-semibold text-zinc-900 focus:bg-white focus:border-indigo-500 outline-hidden transition-all"
              >
                <option value="ADMIN">Studio Admin (Full Control)</option>
                <option value="ART_DIRECTOR">Art Director (Approvals & Reviews)</option>
                <option value="ART_MANAGER">Art Manager (Ops, Capacity & Sprints)</option>
                <option value="ARTIST">Artist (Tasks & Timesheets)</option>
                <option value="COMPANY_REQUESTER">Company Requester (Submit Requests)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Art Department, LiveOps"
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs text-zinc-900 focus:bg-white focus:border-indigo-500 outline-hidden transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                Job Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Concept Artist"
                className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-300 rounded-xl text-xs text-zinc-900 focus:bg-white focus:border-indigo-500 outline-hidden transition-all"
              />
            </div>
          </div>

          {/* Avatar Preset Selection */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-2">
              Select Avatar
            </label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_AVATARS.map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAvatar(url)}
                  className={`relative rounded-full p-0.5 transition-all cursor-pointer ${
                    avatar === url ? 'ring-2 ring-indigo-600 ring-offset-2 scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {url && url.trim() ? (
                    <img
                      src={url.trim()}
                      alt="avatar option"
                      className="w-8 h-8 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  {avatar === url && (
                    <span className="absolute -bottom-1 -right-1 bg-indigo-600 text-white rounded-full p-0.5 shadow-xs">
                      <CheckCircle2 size={10} />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* If Role is ARTIST -> Show Artist Production & Capacity configuration */}
        {role === 'ARTIST' && (
          <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-4 animate-fadeIn">
            <div className="flex items-center gap-2 border-b border-indigo-100 pb-2">
              <Paintbrush size={16} className="text-indigo-700" />
              <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                Artist Production & Capacity Matrix
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Art Specialization
                </label>
                <select
                  value={artistRole}
                  onChange={(e) => setArtistRole(e.target.value as ArtistSpecialization)}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-semibold text-zinc-900 outline-hidden"
                >
                  <option value="Character Artist">Character Artist</option>
                  <option value="Environment Artist">Environment Artist</option>
                  <option value="UI Artist">UI Artist</option>
                  <option value="Concept Artist">Concept Artist</option>
                  <option value="3D Artist">3D Artist</option>
                  <option value="Marketing Artist">Marketing Artist</option>
                  <option value="Illustrator">Illustrator</option>
                  <option value="2D Animator">2D Animator</option>
                  <option value="3D Animator">3D Animator</option>
                  <option value="VFX Artist">VFX Artist</option>
                  <option value="Technical Artist">Technical Artist</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Specific Expertise Focus
                </label>
                <input
                  type="text"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="e.g. High-Poly Retopology, PBR Texturing"
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs text-zinc-900 outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Daily Working Hours (h/day)
                </label>
                <input
                  type="number"
                  min="2"
                  max="12"
                  value={dailyCapacity}
                  onChange={(e) => setDailyCapacity(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 outline-hidden"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Weekly standard capacity: <strong className="text-zinc-800">{dailyCapacity * 5} hours</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Production Allocation %
                </label>
                <input
                  type="number"
                  min="30"
                  max="100"
                  value={productionAllocation}
                  onChange={(e) => setProductionAllocation(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-xl text-xs font-bold text-zinc-900 outline-hidden"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Effective production hours:{' '}
                  <strong className="text-indigo-700">
                    {Math.round((dailyCapacity * 5 * productionAllocation) / 100)}h/week
                  </strong>
                </p>
              </div>
            </div>

            {/* Assigned Projects */}
            {projects.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1.5">
                  Assign to Projects
                </label>
                <div className="flex flex-wrap gap-2">
                  {projects.map(proj => {
                    const isSelected = selectedProjects.includes(proj.id);
                    return (
                      <button
                        key={proj.id}
                        type="button"
                        onClick={() => handleToggleProject(proj.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-100'
                        }`}
                      >
                        {proj.name} ({proj.key})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Skills & Rating Matrix */}
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-2">
                Core Art Proficiencies (Used by Auto-Assignment Forecast Engine)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-zinc-200">
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1">Primary Skill</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={primaryCategory}
                      onChange={(e) => setPrimaryCategory(e.target.value as ArtCategory)}
                      className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-800 flex-1 outline-hidden"
                    >
                      {ART_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <SkillStars rating={primaryRating} onChange={setPrimaryRating} size={16} />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1">Secondary Skill</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={secondaryCategory}
                      onChange={(e) => setSecondaryCategory(e.target.value as ArtCategory)}
                      className="px-2.5 py-1.5 bg-zinc-50 border border-zinc-200 rounded-lg text-xs font-medium text-zinc-800 flex-1 outline-hidden"
                    >
                      {ART_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <SkillStars rating={secondaryRating} onChange={setSecondaryRating} size={16} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:text-zinc-800 hover:bg-zinc-100 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
          >
            <UserPlus size={14} />
            <span>Add Person to Studio</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
