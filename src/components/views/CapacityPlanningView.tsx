import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Users,
  Filter,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Edit2,
  CalendarDays
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { Artist } from '../../types';
import { Avatar } from '../common/Avatar';
import { CapacityBar } from '../common/CapacityBar';
import {
  getArtistCommittedHours,
  getArtistEffectiveWeeklyCapacity,
  getArtistSprintCapacity,
  getArtistSprintLeaveDetails
} from '../../utils/forecastEngine';
import { formatDate } from '../../utils/dateUtils';

interface CapacityPlanningViewProps {
  onOpenAiPlanner: () => void;
  onSelectArtist?: (artistId: string) => void;
  onEditArtist?: (artist: Artist) => void;
}

export const CapacityPlanningView: React.FC<CapacityPlanningViewProps> = ({
  onOpenAiPlanner,
  onSelectArtist,
  onEditArtist
}) => {
  const { artists, tasks, sprints, projects, canAccessAiSprintPlanner } = useArtOps();

  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [selectedView, setSelectedView] = useState<'weekly' | 'daily'>('weekly');

  const activeSprint = useMemo(() => {
    return sprints.find(s => s.status === 'Active') || sprints[0] || null;
  }, [sprints]);

  const productionArtists = useMemo(() => {
    return artists.filter(a => {
      if (a.userRole === 'COMPANY_REQUESTER' || a.role === 'COMPANY_REQUESTER') return false;
      const r = (a.role || '').toLowerCase();
      const spec = (a.specialization || '').toLowerCase();
      return !r.includes('requester') && !spec.includes('requester');
    });
  }, [artists]);

  const artistCapacityData = useMemo(() => {
    return productionArtists
      .filter(a => roleFilter === 'ALL' || a.role === roleFilter)
      .map(artist => {
        const weeklyCap = getArtistEffectiveWeeklyCapacity(artist);
        const artistTasks = tasks.filter(t => t.artistId === artist.id && t.status !== 'DONE');
        const committedHours = getArtistCommittedHours(artist.id, tasks);

        // Sprint-specific capacity factoring in leaves
        const sprintCap = activeSprint
          ? getArtistSprintCapacity(artist, activeSprint, artistTasks)
          : {
              grossCapacityHours: weeklyCap * 2,
              leaveHoursDeducted: 0,
              leaveDaysCount: 0,
              overheadHoursDeducted: 0,
              netAvailableHours: weeklyCap * 2,
              committedHours,
              utilization: weeklyCap > 0 ? Math.round((committedHours / (weeklyCap * 2)) * 100) : 0,
              status: 'BALANCED' as const,
              overlappingLeaves: []
            };

        // Simulated next 4 weeks breakdown
        const week1 = committedHours;
        const week2 = Math.max(0, Math.round(committedHours * 0.7));
        const week3 = Math.max(0, Math.round(committedHours * 0.4));
        const week4 = Math.max(0, Math.round(committedHours * 0.2));

        return {
          artist,
          weeklyCap,
          sprintCap,
          committedHours,
          utilization: sprintCap.utilization,
          leaves: artist.leaveSchedule || [],
          weeks: [
            { week: 'Sprint W35 (Aug 24-28)', hours: week1, util: Math.round((week1 / weeklyCap) * 100) },
            { week: 'Sprint W36 (Aug 31-Sep 04)', hours: week2, util: Math.round((week2 / weeklyCap) * 100) },
            { week: 'Sprint W37 (Sep 07-11)', hours: week3, util: Math.round((week3 / weeklyCap) * 100) },
            { week: 'Sprint W38 (Sep 14-18)', hours: week4, util: Math.round((week4 / weeklyCap) * 100) }
          ]
        };
      })
      .sort((a, b) => b.utilization - a.utilization);
  }, [productionArtists, tasks, roleFilter, activeSprint]);

  const totalCap = productionArtists.reduce((acc, a) => acc + getArtistEffectiveWeeklyCapacity(a), 0);
  const totalComm = productionArtists.reduce((acc, a) => acc + getArtistCommittedHours(a.id, tasks), 0);
  const overallUtil = totalCap > 0 ? Math.round((totalComm / totalCap) * 100) : 0;

  const totalSprintNetCap = artistCapacityData.reduce((acc, d) => acc + d.sprintCap.netAvailableHours, 0);
  const totalSprintLeaveDeducted = artistCapacityData.reduce((acc, d) => acc + d.sprintCap.leaveHoursDeducted, 0);
  const artistsOnLeaveCount = artistCapacityData.filter(d => d.sprintCap.leaveHoursDeducted > 0).length;

  const overutilized = artistCapacityData.filter(d => d.utilization > 85);
  const underutilized = artistCapacityData.filter(d => d.utilization < 60);

  // Helper for heatmap cell color
  const getCellColor = (util: number) => {
    if (util === 0) return 'bg-slate-50 text-slate-400 border-slate-200';
    if (util <= 70) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (util <= 85) return 'bg-amber-50 text-amber-800 border-amber-200';
    if (util <= 100) return 'bg-orange-50 text-orange-800 border-orange-200';
    return 'bg-rose-50 text-rose-800 border-rose-300 font-bold';
  };

  return (
    <div id="capacity-planning-view" className="p-8 space-y-6 max-w-7xl mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Studio Capacity & Workload Heatmap</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 font-bold text-slate-700 border border-slate-200">
              20 Artists Monitored
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track workload distribution, spot bottlenecks, and balance commitments across all art disciplines.
          </p>
        </div>

        {canAccessAiSprintPlanner() && (
          <button
            type="button"
            onClick={onOpenAiPlanner}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Sparkles size={14} className="text-amber-300" />
            <span>AI Auto-Balance Workload</span>
          </button>
        )}
      </div>

      {/* Capacity KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] text-slate-400 font-bold uppercase block">Studio Sprint Workload</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-slate-900">{overallUtil}%</span>
            <span className="text-xs text-slate-500 font-medium">({totalComm}h / {totalCap}h wk)</span>
          </div>
          <div className="mt-2">
            <CapacityBar committedHours={totalComm} capacityHours={totalCap} showLabels={false} size="sm" />
          </div>
          <span className="text-[10px] text-slate-400 block mt-1.5">
            {totalSprintNetCap}h Net sprint cap {totalSprintLeaveDeducted > 0 ? `(-${totalSprintLeaveDeducted}h leaves)` : ''}
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] text-slate-400 font-bold uppercase block">Safe Zone (&le;70%)</span>
          <span className="text-2xl font-bold text-emerald-700 mt-1 block">
            {artistCapacityData.filter(d => d.utilization <= 70).length} artists
          </span>
          <p className="text-[11px] text-slate-400 mt-1">Ready for additional tasks</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] text-slate-400 font-bold uppercase block">Scheduled Leaves & Time Off</span>
          <span className="text-2xl font-bold text-amber-600 mt-1 block">
            {artistsOnLeaveCount} on leave
          </span>
          <p className="text-[11px] text-amber-700 mt-1 font-medium">
            -{totalSprintLeaveDeducted}h capacity deducted in sprint
          </p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <span className="text-[11px] text-slate-400 font-bold uppercase block">Over-Capacity (&gt;85%)</span>
          <span className="text-2xl font-bold text-rose-600 mt-1 block">{overutilized.length} artists</span>
          <p className="text-[11px] text-rose-600 mt-1 font-medium">High risk of delivery slip</p>
        </div>
      </div>

      {/* Threshold Legend & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold text-slate-700">Capacity Legend:</span>
          <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            0–70% Green
          </span>
          <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium bg-amber-50 px-2.5 py-0.5 rounded border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            71–85% Yellow
          </span>
          <span className="inline-flex items-center gap-1.5 text-orange-700 font-medium bg-orange-50 px-2.5 py-0.5 rounded border border-orange-200">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            86–100% Orange
          </span>
          <span className="inline-flex items-center gap-1.5 text-rose-700 font-bold bg-rose-50 px-2.5 py-0.5 rounded border border-rose-200">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            &gt;100% Red
          </span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 outline-hidden cursor-pointer"
          >
            <option value="ALL">All Roles ({artists.length})</option>
            <option value="3D Character Artist">3D Character Artist</option>
            <option value="Lead 3D Artist">Lead 3D Artist</option>
            <option value="Senior Concept Artist">Senior Concept Artist</option>
            <option value="Senior UI/UX Artist">Senior UI/UX Artist</option>
            <option value="Senior 2D Animator">Senior 2D Animator</option>
            <option value="VFX Artist">VFX Artist</option>
            <option value="Marketing Art Lead">Marketing Art Lead</option>
            <option value="Senior Marketing Artist">Senior Marketing Artist</option>
            <option value="Technical Artist">Technical Artist</option>
          </select>
        </div>
      </div>

      {/* Heatmap Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3.5 px-4">Artist Profile</th>
                <th className="py-3.5 px-4">Role & Discipline</th>
                <th className="py-3.5 px-4 text-center">Weekly Std</th>
                <th className="py-3.5 px-4 text-center">Sprint Net Cap</th>
                <th className="py-3.5 px-4 text-center">Sprint Load</th>
                <th className="py-3.5 px-4 text-center">W35 (Aug 24-28)</th>
                <th className="py-3.5 px-4 text-center">W36 (Aug 31-Sep 04)</th>
                <th className="py-3.5 px-4 text-center">W37 (Sep 07-11)</th>
                <th className="py-3.5 px-4 text-center">W38 (Sep 14-18)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {artistCapacityData.map(data => (
                <tr key={data.artist.id} className="hover:bg-slate-50/70 transition-colors">
                  {/* Artist */}
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={data.artist.name} src={data.artist.avatar} size="xs" status={data.artist.status} />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 block">{data.artist.name}</span>
                            {data.sprintCap.leaveHoursDeducted > 0 && (
                              <span
                                className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.2 rounded"
                                title={`Leave: ${data.sprintCap.overlappingLeaves.map(l => `${l.startDate} to ${l.endDate} (${l.reason})`).join(', ')}`}
                              >
                                🌴 -{data.sprintCap.leaveHoursDeducted}h
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">{data.artist.specialization}</span>
                        </div>
                      </div>
                      {onEditArtist && (
                        <button
                          type="button"
                          onClick={() => onEditArtist(data.artist)}
                          className="p-1 text-slate-400 hover:text-slate-900 hover:bg-slate-200 rounded transition-colors cursor-pointer"
                          title="Edit Capacity & Working Hours"
                        >
                          <Edit2 size={12} />
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Role */}
                  <td className="py-3 px-4 text-slate-600 font-medium">
                    {data.artist.role}
                  </td>

                  {/* Weekly Capacity */}
                  <td className="py-3 px-4 text-center font-semibold text-slate-700">
                    {data.weeklyCap}h/wk
                  </td>

                  {/* Sprint Net Capacity */}
                  <td className="py-3 px-4 text-center">
                    <span className="font-bold text-slate-900">{data.sprintCap.netAvailableHours}h</span>
                    {data.sprintCap.leaveHoursDeducted > 0 && (
                      <span className="block text-[10px] text-amber-700 font-semibold">
                        (-{data.sprintCap.leaveHoursDeducted}h leave)
                      </span>
                    )}
                  </td>

                  {/* Current Sprint Progress */}
                  <td className="py-3 px-4 text-center">
                    <div className="w-32 mx-auto">
                      <CapacityBar
                        committedHours={data.committedHours}
                        capacityHours={data.sprintCap.netAvailableHours}
                        size="sm"
                      />
                    </div>
                  </td>

                  {/* Heatmap 4-Week Cells */}
                  {data.weeks.map((w, idx) => (
                    <td key={idx} className="py-3 px-3 text-center">
                      <div className={`py-1.5 px-2 rounded-lg border text-xs font-semibold ${getCellColor(w.util)}`}>
                        {w.hours}h ({w.util}%)
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
