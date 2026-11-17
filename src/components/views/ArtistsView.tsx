import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Search,
  Filter,
  Star,
  Clock,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  CalendarDays,
  Edit2,
  Sun
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { Artist, ArtistSkill } from '../../types';
import { Avatar } from '../common/Avatar';
import { CapacityBar } from '../common/CapacityBar';
import { SkillStars } from '../common/SkillStars';
import { ManageLeaveModal } from '../modals/ManageLeaveModal';
import {
  getArtistCommittedHours,
  getArtistEffectiveWeeklyCapacity,
  getArtistSprintCapacity
} from '../../utils/forecastEngine';

interface ArtistsViewProps {
  onOpenAddArtist: () => void;
  onEditArtist: (artist: Artist) => void;
  onSelectArtist?: (artistId: string) => void;
}

export const ArtistsView: React.FC<ArtistsViewProps> = ({ onOpenAddArtist, onEditArtist, onSelectArtist }) => {
  const { artists, tasks, sprints, updateArtist, canCreateProject, currentUser } = useArtOps();

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [showAllUsers, setShowAllUsers] = useState<boolean>(true);
  const [leaveModalArtist, setLeaveModalArtist] = useState<Artist | null>(null);

  const activeSprint = useMemo(() => {
    return sprints.find(s => s.status === 'Active') || sprints[0] || null;
  }, [sprints]);

  const handleUpdateSkill = (artistId: string, category: string, newRating: number) => {
    const artist = artists.find(a => a.id === artistId);
    if (!artist) return;

    const newSkills = artist.skills.map(s => s.category === category ? { ...s, rating: newRating } : s);
    updateArtist(artistId, { skills: newSkills });
  };

  const filteredArtists = useMemo(() => {
    return artists.filter(a => {
      if (a.userRole === 'COMPANY_REQUESTER' || a.role === 'COMPANY_REQUESTER') return false;
      const r = (a.role || '').toLowerCase();
      const spec = (a.specialization || '').toLowerCase();
      if (r.includes('requester') || spec.includes('requester')) return false;

      if (roleFilter !== 'ALL' && a.role !== roleFilter) return false;

      // Show all artists in the team/workspace
      if (!showAllUsers) {
        const hasAssignedTasks = tasks.some(t => t.artistId === a.id);
        if (!hasAssignedTasks) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          a.name.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q) ||
          a.specialization.toLowerCase().includes(q) ||
          a.skills.some(s => s.category.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [artists, roleFilter, searchQuery, showAllUsers, tasks]);

  return (
    <div id="artists-view" className="p-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Studio Artists & Skills Matrix</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-100 font-bold text-zinc-700">
              {artists.length} Team Members
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Manage artist skill proficiencies (1–5 stars), weekly capacity allocation %, and active workload.
          </p>
        </div>

        {canCreateProject() && (
          <button
            id="btn-add-artist-header"
            type="button"
            onClick={onOpenAddArtist}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus size={15} />
            <span>+ Add Artist</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-zinc-200 rounded-xl">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search size={15} className="text-zinc-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search artists by name, specialization, or skill category..."
            className="w-full text-xs text-zinc-900 placeholder:text-zinc-400 outline-hidden bg-transparent"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 cursor-pointer bg-zinc-50 hover:bg-zinc-100 px-2.5 py-1.5 rounded-lg border border-zinc-200 transition-colors">
            <input
              type="checkbox"
              checked={showAllUsers}
              onChange={(e) => setShowAllUsers(e.target.checked)}
              className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 h-3.5 w-3.5 cursor-pointer"
            />
            <span>Show All Users (Include 0 Tasks)</span>
          </label>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs font-semibold bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 outline-hidden"
          >
            <option value="ALL">All Roles ({artists.length})</option>
            <option value="Character Artist">Character Artist</option>
            <option value="Environment Artist">Environment Artist</option>
            <option value="Concept Artist">Concept Artist</option>
            <option value="UI Artist">UI Artist</option>
            <option value="Marketing Artist">Marketing Artist</option>
            <option value="3D Artist">3D Artist</option>
            <option value="2D Animator">2D Animator</option>
            <option value="VFX Artist">VFX Artist</option>
            <option value="Technical Artist">Technical Artist</option>
          </select>
        </div>
      </div>

      {/* Artists Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredArtists.map(artist => {
          const committedHours = getArtistCommittedHours(artist.id, tasks);
          const weeklyCap = getArtistEffectiveWeeklyCapacity(artist);
          const artistActiveTasks = tasks.filter(t => t.artistId === artist.id && t.status !== 'DONE');
          const allArtistTasks = tasks.filter(t => t.artistId === artist.id);
          const sprintCap = activeSprint ? getArtistSprintCapacity(artist, activeSprint, artistActiveTasks) : null;
          const effectiveCap = sprintCap ? sprintCap.netAvailableHours : weeklyCap;

          return (
            <div
              key={artist.id}
              id={`artist-card-${artist.id}`}
              className="p-4 bg-white rounded-xl border border-zinc-200 shadow-2xs hover:shadow-sm transition-all space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={artist.name} src={artist.avatar} size="md" status={artist.status} />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-zinc-900">{artist.name}</h3>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {allArtistTasks.length} {allArtistTasks.length === 1 ? 'task' : 'tasks'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">{artist.role}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 bg-zinc-100 text-zinc-600 rounded">
                      {artist.productionAllocation}% Prod
                    </span>
                    {canCreateProject() && (
                      <button
                        type="button"
                        onClick={() => onEditArtist(artist)}
                        className="p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
                        title="Edit Artist Profile & Capacity"
                      >
                        <Edit2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-600 mt-2">
                  <p className="line-clamp-1 flex-1">
                    <strong>Spec:</strong> {artist.specialization}
                  </p>
                  {artist.status !== 'Active' && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ml-1.5 ${
                      artist.status === 'On Leave' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {artist.status}
                    </span>
                  )}
                </div>

                {/* Capacity & Working Schedule Info */}
                <div className="mt-2 text-[11px] text-zinc-500 flex items-center justify-between border-t border-zinc-100 pt-2 font-mono">
                  <span>Schedule: {artist.dailyCapacity || 8}h/day ({artist.weeklyCapacity || 40}h/wk)</span>
                  <span className="font-semibold text-zinc-700">{artist.workingDays?.join(', ') || 'Mon-Fri'}</span>
                </div>

                {/* Leave / Time Off Quick Action Strip */}
                <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-xs flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setLeaveModalArtist(artist)}
                    className="text-[11px] font-semibold text-zinc-700 hover:text-zinc-950 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-md px-2 py-1 flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <CalendarDays size={13} className="text-zinc-500" />
                    <span>Manage Leave</span>
                    <span className="text-[10px] bg-zinc-200 text-zinc-700 font-bold px-1.5 py-0.2 rounded-full">
                      {artist.leaveSchedule?.length || 0}
                    </span>
                  </button>

                  {sprintCap && sprintCap.leaveHoursDeducted > 0 ? (
                    <span className="text-[10px] text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded font-bold" title={`Sprint Leave: ${sprintCap.overlappingLeaves.map(l => l.reason).join(', ')}`}>
                      🌴 {sprintCap.leaveDaysCount}d Leave · {sprintCap.netAvailableHours}h Avail
                    </span>
                  ) : artist.leaveSchedule && artist.leaveSchedule.length > 0 ? (
                    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium truncate max-w-[140px]" title={artist.leaveSchedule[0].reason}>
                      Next: {artist.leaveSchedule[0].startDate}
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                      ✓ Full Availability
                    </span>
                  )}
                </div>

                {/* Capacity Bar & Exact Sprint Formula */}
                <div className="mt-3 bg-zinc-50/70 p-2 rounded-lg border border-zinc-100">
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 font-bold uppercase mb-1">
                    <span>Sprint Load ({artistActiveTasks.length} active)</span>
                    <span className="font-mono text-zinc-800 font-bold">
                      {committedHours}h / {effectiveCap}h avail {sprintCap && sprintCap.leaveHoursDeducted > 0 ? `(-${sprintCap.leaveHoursDeducted}h leave)` : ''}
                    </span>
                  </div>
                  <CapacityBar committedHours={committedHours} capacityHours={effectiveCap} size="sm" />
                </div>
              </div>

              {/* Skills Matrix Stars Strip */}
              <div className="pt-3 border-t border-zinc-100 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-400 font-bold uppercase">
                    Skill Proficiencies (Editable 1–5 ★)
                  </span>
                  {canCreateProject() && (
                    <button
                      type="button"
                      onClick={() => onEditArtist(artist)}
                      className="text-[10px] font-bold text-zinc-600 hover:text-zinc-900 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Edit All</span>
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {artist.skills.map(s => (
                    <div key={s.category} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-700">{s.category}</span>
                      <SkillStars
                        rating={s.rating}
                        editable={canCreateProject()}
                        onChange={(newRating) => handleUpdateSkill(artist.id, s.category, newRating)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Leave Management Modal */}
      <ManageLeaveModal
        isOpen={!!leaveModalArtist}
        onClose={() => setLeaveModalArtist(null)}
        artist={leaveModalArtist}
      />
    </div>
  );
};
