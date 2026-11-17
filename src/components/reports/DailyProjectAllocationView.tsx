import React, { useState, useMemo } from 'react';
import { useArtOps } from '../../context/ArtOpsContext';
import {
  calculateDailyProjectAllocations,
  generateAiDailyAllocations,
  getWorkingDaysList
} from '../../utils/dailyAllocationEngine';
import { formatDate } from '../../utils/dateUtils';
import type {
  ArtistDailyProjectAllocation,
  DailyProjectAllocationEntry,
  ManualDailyAllocationOverride,
  Project
} from '../../types';
import {
  Calendar,
  Layers,
  Sparkles,
  Edit3,
  RotateCcw,
  Check,
  AlertTriangle,
  Download,
  Filter,
  Users,
  Search,
  ChevronRight,
  ChevronDown,
  Info,
  Clock,
  Briefcase,
  X,
  Zap
} from 'lucide-react';

interface DailyProjectAllocationViewProps {
  fromDate: string;
  toDate: string;
  selectedArtistFilter: string;
  selectedProjectFilter: string;
  selectedSprintFilter?: string;
  isReadOnly?: boolean;
}

export const DailyProjectAllocationView: React.FC<DailyProjectAllocationViewProps> = ({
  fromDate,
  toDate,
  selectedArtistFilter,
  selectedProjectFilter,
  selectedSprintFilter,
  isReadOnly = false
}) => {
  const {
    artists,
    projects,
    tasks,
    sprints,
    settings,
    manualAllocations,
    updateDailyAllocation,
    resetDailyAllocation,
    bulkUpdateDailyAllocations,
    currentUser
  } = useArtOps();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('grouped');
  const [expandedArtists, setExpandedArtists] = useState<Record<string, boolean>>({});
  const [editingEntry, setEditingEntry] = useState<{
    artistId: string;
    artistName: string;
    date: string;
    allocations: { projectId: string; percentage: number }[];
    reason?: string;
  } | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);

  // Generate working days list
  const workingDays = useMemo(() => {
    return getWorkingDaysList(fromDate, toDate);
  }, [fromDate, toDate]);

  // Compute calculated allocations across artists and dates
  const { rows: calculatedAllocations, activeProjects } = useMemo(() => {
    return calculateDailyProjectAllocations({
      artists,
      projects,
      tasks,
      workingDays,
      manualOverrides: manualAllocations,
      selectedProjectId: selectedProjectFilter,
      selectedArtistId: selectedArtistFilter,
      selectedSprintId: selectedSprintFilter
    });
  }, [
    artists,
    projects,
    tasks,
    workingDays,
    manualAllocations,
    selectedProjectFilter,
    selectedArtistFilter,
    selectedSprintFilter
  ]);

  // Build an artist map for quick role lookup
  const artistMap = useMemo(() => {
    const map = new Map<string, string>();
    artists.forEach(a => {
      map.set(a.id, a.role || a.specialization || 'Artist');
    });
    return map;
  }, [artists]);

  // Filter allocations based on search query
  const filteredAllocations = useMemo(() => {
    if (!searchQuery.trim()) return calculatedAllocations;
    const q = searchQuery.toLowerCase();
    return calculatedAllocations.filter(item => {
      const role = artistMap.get(item.artistId) || '';
      return (
        item.artistName.toLowerCase().includes(q) ||
        role.toLowerCase().includes(q) ||
        item.allocations.some(
          a =>
            a.projectName.toLowerCase().includes(q) ||
            (a.projectKey && a.projectKey.toLowerCase().includes(q))
        ) ||
        (item.leaveType && item.leaveType.toLowerCase().includes(q))
      );
    });
  }, [calculatedAllocations, searchQuery, artistMap]);

  // Group by artist
  const groupedByArtist = useMemo(() => {
    const map = new Map<string, ArtistDailyProjectAllocation[]>();
    filteredAllocations.forEach(item => {
      if (!map.has(item.artistId)) {
        map.set(item.artistId, []);
      }
      map.get(item.artistId)!.push(item);
    });

    return Array.from(map.entries()).map(([artistId, days]) => {
      const workingDaysList = days.filter(d => !d.isLeave || d.isHalfDayLeave);
      const avg =
        workingDaysList.length > 0
          ? Math.round(
              workingDaysList.reduce((acc, d) => acc + d.totalPercentage, 0) /
                workingDaysList.length
            )
          : 0;

      return {
        artistId,
        artistName: days[0]?.artistName || 'Artist',
        artistRole: artistMap.get(artistId) || 'Artist',
        days: days.sort((a, b) => a.date.localeCompare(b.date)),
        averageAllocation: avg
      };
    });
  }, [filteredAllocations, artistMap]);

  // Summary Metrics
  const summaryStats = useMemo(() => {
    const totalSlots = filteredAllocations.length;
    const leaveSlots = filteredAllocations.filter(a => a.isLeave).length;
    const workingSlots = filteredAllocations.filter(a => !a.isLeave || a.isHalfDayLeave);
    const overallocatedSlots = filteredAllocations.filter(a => a.totalPercentage > 100).length;
    const fullyAllocatedSlots = filteredAllocations.filter(
      a => a.totalPercentage >= 85 && a.totalPercentage <= 100
    );
    const underallocatedSlots = workingSlots.filter(
      a => a.totalPercentage < 85 && (!a.isLeave || a.isHalfDayLeave)
    ).length;

    const avgAllocation =
      workingSlots.length > 0
        ? Math.round(
            workingSlots.reduce((acc, a) => acc + a.totalPercentage, 0) / workingSlots.length
          )
        : 0;

    const uniqueArtists = new Set(filteredAllocations.map(a => a.artistId)).size;

    return {
      totalSlots,
      uniqueArtists,
      leaveSlots,
      overallocatedSlots,
      fullyAllocatedSlots: fullyAllocatedSlots.length,
      underallocatedSlots,
      avgAllocation
    };
  }, [filteredAllocations]);

  // Toggle expand for grouped view
  const toggleArtistExpand = (artistId: string) => {
    setExpandedArtists(prev => ({
      ...prev,
      [artistId]: prev[artistId] === undefined ? false : !prev[artistId]
    }));
  };

  // Expand all / Collapse all
  const toggleAllArtists = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    groupedByArtist.forEach(g => {
      next[g.artistId] = expand;
    });
    setExpandedArtists(next);
  };

  // AI Auto-Allocation Trigger
  const handleAiAutoAllocate = async () => {
    setIsAiGenerating(true);
    setAiSuccessMessage(null);
    try {
      await new Promise(r => setTimeout(r, 600));
      const currentSprint = sprints.find(s => s.id === selectedSprintFilter) || null;
      const result = generateAiDailyAllocations({
        artists,
        projects,
        tasks,
        workingDays,
        settings,
        selectedSprint: currentSprint
      });

      const overrides: ManualDailyAllocationOverride[] = result.recommendations.map(rec => ({
        id: `override-${rec.artistId}-${rec.date}`,
        artistId: rec.artistId,
        date: rec.date,
        allocations: rec.allocations.map(a => ({
          projectId: a.projectId,
          percentage: a.percentage
        })),
        reason: rec.rationale,
        updatedBy: 'AI Auto-Balancer',
        updatedAt: new Date().toISOString()
      }));

      bulkUpdateDailyAllocations(overrides);
      setAiSuccessMessage(
        `✨ AI successfully balanced capacity across ${overrides.length} artist-day slots based on sprint deadlines and task workloads.`
      );
      setTimeout(() => setAiSuccessMessage(null), 5000);
    } catch (e: any) {
      console.error('AI Allocation error:', e);
    } finally {
      setIsAiGenerating(false);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      'Artist Name',
      'Role',
      'Date',
      'Day',
      'Leave Status',
      'Total Allocated %',
      ...activeProjects.map(p => `${p.name} (${p.key || p.id.toUpperCase()})`)
    ];

    const rows = filteredAllocations.map(item => {
      const dayDate = new Date(item.date);
      const dayName = isNaN(dayDate.getTime())
        ? item.date
        : dayDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          });

      const projectCols = activeProjects.map(proj => {
        const found = item.allocations.find(a => a.projectId === proj.id);
        return found ? `${found.percentage}%` : '0%';
      });

      const role = artistMap.get(item.artistId) || 'Artist';
      const leaveStatus = item.isLeave
        ? item.isHalfDayLeave
          ? 'Half Day Leave'
          : 'Full Day Leave'
        : 'Available';

      return [
        `"${item.artistName}"`,
        `"${role}"`,
        `"${item.date}"`,
        `"${dayName}"`,
        `"${leaveStatus}"`,
        `"${item.totalPercentage}%"`,
        ...projectCols.map(c => `"${c}"`)
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `artops_daily_project_allocation_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open Edit Override Modal
  const openEditModal = (entry: ArtistDailyProjectAllocation) => {
    if (isReadOnly) return;
    const initialAllocs = activeProjects.map(p => {
      const existing = entry.allocations.find(a => a.projectId === p.id);
      return {
        projectId: p.id,
        percentage: existing ? existing.percentage : 0
      };
    });

    setEditingEntry({
      artistId: entry.artistId,
      artistName: entry.artistName,
      date: entry.date,
      allocations: initialAllocs,
      reason: entry.isManualOverride ? entry.overrideNote || 'Manual adjustment' : ''
    });
  };

  const handleSaveEdit = () => {
    if (!editingEntry) return;
    const nonZeroAllocs = editingEntry.allocations.filter(a => a.percentage > 0);
    updateDailyAllocation(
      editingEntry.artistId,
      editingEntry.date,
      nonZeroAllocs,
      editingEntry.reason || 'Manager manual override'
    );
    setEditingEntry(null);
  };

  return (
    <div className="space-y-6" id="daily-project-allocation-container">
      {/* Header & Controls Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 bg-indigo-950/80 border border-indigo-700/50 text-indigo-400 rounded-lg">
                <Calendar className="w-4 h-4" />
              </span>
              <h2 className="text-lg font-semibold text-white">Daily Project Allocation</h2>
              <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 rounded-full">
                {formatDate(fromDate)} – {formatDate(toDate)}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Day-wise artist capacity distribution across projects. Displays allocated working capacity percentage per project based on active sprint tasks and scheduled leave.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2.5 w-full lg:w-auto">
            {/* View Mode Toggle */}
            <div className="inline-flex rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  viewMode === 'grouped'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Grouped by Artist
              </button>
              <button
                type="button"
                onClick={() => setViewMode('flat')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  viewMode === 'flat'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Flat Table
              </button>
            </div>

            {/* AI Auto-Balance Button */}
            {!isReadOnly && (
              <button
                type="button"
                id="btn-ai-auto-balance"
                onClick={handleAiAutoAllocate}
                disabled={isAiGenerating}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm border border-purple-500/30 transition-all disabled:opacity-50"
                title="Automatically balance project allocations based on task priorities and remaining hours"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isAiGenerating ? 'animate-spin' : ''}`} />
                {isAiGenerating ? 'AI Balancing...' : 'AI Auto-Balance'}
              </button>
            )}

            {/* Export CSV Button */}
            <button
              type="button"
              id="btn-export-allocation-csv"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium rounded-lg border border-slate-700 transition-colors"
              title="Export allocation matrix to CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* AI Success Notification */}
        {aiSuccessMessage && (
          <div className="mt-4 p-3 bg-purple-950/60 border border-purple-800/60 rounded-lg flex items-center justify-between text-xs text-purple-200 animate-fadeIn">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400 shrink-0" />
              <span>{aiSuccessMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setAiSuccessMessage(null)}
              className="text-purple-400 hover:text-purple-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Summary Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mt-4 pt-4 border-t border-slate-800/80">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Artists</div>
            <div className="text-lg font-bold text-white mt-0.5">{summaryStats.uniqueArtists}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Avg Allocation</div>
            <div className="text-lg font-bold text-indigo-400 mt-0.5">{summaryStats.avgAllocation}%</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Optimal (85-100%)</div>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">{summaryStats.fullyAllocatedSlots}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Underallocated</div>
            <div className="text-lg font-bold text-amber-400 mt-0.5">{summaryStats.underallocatedSlots}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Overallocated</div>
            <div
              className={`text-lg font-bold mt-0.5 ${
                summaryStats.overallocatedSlots > 0 ? 'text-rose-400' : 'text-slate-400'
              }`}
            >
              {summaryStats.overallocatedSlots}
            </div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5">
            <div className="text-[11px] text-slate-400 uppercase tracking-wider font-medium">Leave Days</div>
            <div className="text-lg font-bold text-blue-400 mt-0.5">{summaryStats.leaveSlots}</div>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar inside Tab */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search artist, role or project..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {viewMode === 'grouped' && (
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => toggleAllArtists(true)}
              className="text-indigo-400 hover:text-indigo-300 font-medium px-2 py-1 bg-slate-900 border border-slate-800 rounded"
            >
              Expand All
            </button>
            <button
              type="button"
              onClick={() => toggleAllArtists(false)}
              className="text-slate-400 hover:text-slate-300 font-medium px-2 py-1 bg-slate-900 border border-slate-800 rounded"
            >
              Collapse All
            </button>
          </div>
        )}
      </div>

      {/* Main Allocation Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                <th className="py-3 px-4 w-48 sticky left-0 bg-slate-950/95 z-20">Artist Name</th>
                <th className="py-3 px-3 w-32 sticky left-48 bg-slate-950/95 z-20">Day / Date</th>
                <th className="py-3 px-3 w-28 text-center">Total Load</th>
                {activeProjects.map((proj, idx) => (
                  <th key={proj.id} className="py-3 px-3 min-w-[130px] max-w-[180px]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      <span className="truncate" title={proj.name}>
                        {proj.key || `P${idx + 1}`}: {proj.name}
                      </span>
                    </div>
                  </th>
                ))}
                {!isReadOnly && <th className="py-3 px-3 w-20 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {filteredAllocations.length === 0 ? (
                <tr>
                  <td
                    colSpan={activeProjects.length + 4}
                    className="py-12 text-center text-slate-400"
                  >
                    <Users className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="font-medium">No artist allocations found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Try adjusting the date range, artist, or project filters.
                    </p>
                  </td>
                </tr>
              ) : viewMode === 'grouped' ? (
                /* Grouped View */
                groupedByArtist.map(group => {
                  const isExpanded = expandedArtists[group.artistId] ?? true;
                  return (
                    <React.Fragment key={group.artistId}>
                      {/* Artist Group Header Row */}
                      <tr
                        onClick={() => toggleArtistExpand(group.artistId)}
                        className="bg-slate-950/40 hover:bg-slate-800/40 cursor-pointer transition-colors border-t-2 border-slate-800"
                      >
                        <td
                          colSpan={activeProjects.length + (isReadOnly ? 3 : 4)}
                          className="py-2.5 px-4 font-semibold text-white"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-indigo-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                              <span className="text-slate-100">{group.artistName}</span>
                              <span className="text-[11px] font-normal text-slate-400">
                                ({group.artistRole})
                              </span>
                              <span className="text-[10px] px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800/60 rounded-full">
                                {group.days.length} days
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs pr-2">
                              <span className="text-slate-400">
                                Avg Load:{' '}
                                <strong
                                  className={
                                    group.averageAllocation > 100
                                      ? 'text-rose-400'
                                      : group.averageAllocation >= 85
                                      ? 'text-emerald-400'
                                      : 'text-amber-400'
                                  }
                                >
                                  {group.averageAllocation}%
                                </strong>
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Day Rows for this artist */}
                      {isExpanded &&
                        group.days.map((item, rowIdx) => renderAllocationRow(item, rowIdx, true))}
                    </React.Fragment>
                  );
                })
              ) : (
                /* Flat Table View */
                filteredAllocations.map((item, rowIdx) => renderAllocationRow(item, rowIdx, false))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Override Edit Modal */}
      {editingEntry && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden animate-scaleIn">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                <h3 className="font-semibold text-white text-sm">
                  Adjust Daily Project Allocation
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs">
                <div>
                  <div className="text-slate-400">Artist</div>
                  <div className="font-semibold text-white mt-0.5">{editingEntry.artistName}</div>
                </div>
                <div>
                  <div className="text-slate-400">Date</div>
                  <div className="font-semibold text-indigo-400 mt-0.5">
                    {new Date(editingEntry.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Total</div>
                  <div
                    className={`font-bold mt-0.5 ${
                      editingEntry.allocations.reduce((acc, a) => acc + (a.percentage || 0), 0) >
                      100
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {editingEntry.allocations.reduce((acc, a) => acc + (a.percentage || 0), 0)}%
                  </div>
                </div>
              </div>

              {/* Project Percent Inputs */}
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Project Distribution (% of Daily Capacity)
                </div>
                {activeProjects.map(proj => {
                  const curr = editingEntry.allocations.find(a => a.projectId === proj.id) || {
                    projectId: proj.id,
                    percentage: 0
                  };
                  return (
                    <div
                      key={proj.id}
                      className="flex items-center justify-between gap-3 p-2.5 bg-slate-950/40 border border-slate-800/80 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-slate-200 text-xs truncate">
                          {proj.name}
                        </div>
                        <div className="text-[10px] text-slate-500">{proj.key || proj.id}</div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={curr.percentage}
                          onChange={e => {
                            const val = parseInt(e.target.value, 10) || 0;
                            setEditingEntry(prev => {
                              if (!prev) return null;
                              return {
                                ...prev,
                                allocations: prev.allocations.map(a =>
                                  a.projectId === proj.id ? { ...a, percentage: val } : a
                                )
                              };
                            });
                          }}
                          className="w-24 accent-indigo-500 cursor-pointer"
                        />
                        <div className="w-14 relative">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="5"
                            value={curr.percentage}
                            onChange={e => {
                              const val = Math.min(
                                100,
                                Math.max(0, parseInt(e.target.value, 10) || 0)
                              );
                              setEditingEntry(prev => {
                                if (!prev) return null;
                                return {
                                  ...prev,
                                  allocations: prev.allocations.map(a =>
                                    a.projectId === proj.id ? { ...a, percentage: val } : a
                                  )
                                };
                              });
                            }}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white text-right focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <span className="text-xs text-slate-400">%</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Adjustment Reason */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Reason for Adjustment (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Priority crunch for AMD release..."
                  value={editingEntry.reason || ''}
                  onChange={e =>
                    setEditingEntry(prev => (prev ? { ...prev, reason: e.target.value } : null))
                  }
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  resetDailyAllocation(editingEntry.artistId, editingEntry.date);
                  setEditingEntry(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-rose-400 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset to Auto Tasks
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg shadow-sm"
                >
                  Save Allocation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Helper row renderer
  function renderAllocationRow(
    item: ArtistDailyProjectAllocation,
    rowIdx: number,
    isGrouped: boolean
  ) {
    const isFullLeave = item.isLeave && !item.isHalfDayLeave;
    const isOver = item.totalPercentage > 100;
    const isOptimal = item.totalPercentage >= 85 && item.totalPercentage <= 100;
    const isUnder = !isFullLeave && item.totalPercentage < 85;
    const role = artistMap.get(item.artistId) || 'Artist';

    return (
      <tr
        key={`${item.artistId}_${item.date}`}
        className="hover:bg-slate-800/30 transition-colors group"
      >
        {/* Artist Column (Sticky) */}
        <td className="py-2.5 px-4 sticky left-0 bg-slate-900 group-hover:bg-slate-850 z-10">
          {!isGrouped ? (
            <div>
              <div className="font-semibold text-slate-200">{item.artistName}</div>
              <div className="text-[10px] text-slate-400">{role}</div>
            </div>
          ) : (
            <div className="text-slate-400 pl-4 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
              <span>{item.artistName}</span>
            </div>
          )}
        </td>

        {/* Day Column (Sticky) */}
        <td className="py-2.5 px-3 sticky left-48 bg-slate-900 group-hover:bg-slate-850 z-10 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-300">{item.dayLabel || item.date}</span>
            {item.isManualOverride && (
              <span
                className="w-2 h-2 rounded-full bg-amber-400"
                title={`Manually adjusted: ${item.overrideNote || 'Adjusted'}`}
              ></span>
            )}
          </div>
          {isFullLeave ? (
            <span className="text-[10px] text-blue-400 font-normal">Full Day Leave</span>
          ) : item.isHalfDayLeave ? (
            <span className="text-[10px] text-indigo-400 font-normal">Half Day (4h Cap)</span>
          ) : null}
        </td>

        {/* Total Load Column */}
        <td className="py-2.5 px-3 text-center">
          {isFullLeave ? (
            <span className="px-2 py-0.5 text-[10px] font-medium bg-blue-950 text-blue-300 border border-blue-800/60 rounded">
              On Leave
            </span>
          ) : (
            <div className="flex flex-col items-center">
              <span
                className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                  isOver
                    ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                    : isOptimal
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                    : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                }`}
              >
                {item.totalPercentage}%
              </span>
              <div className="w-16 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    isOver ? 'bg-rose-500' : isOptimal ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.min(100, item.totalPercentage)}%` }}
                ></div>
              </div>
            </div>
          )}
        </td>

        {/* Dynamic Project Columns */}
        {activeProjects.map(proj => {
          const alloc = item.allocations.find(a => a.projectId === proj.id);
          const pct = alloc ? alloc.percentage : 0;
          const taskCount = alloc ? alloc.taskCount : 0;

          return (
            <td key={proj.id} className="py-2.5 px-3">
              {pct > 0 ? (
                <div className="flex items-center justify-between gap-2 p-1.5 rounded bg-slate-950/60 border border-slate-800/80">
                  <div className="truncate">
                    <span className="font-semibold text-indigo-300">
                      {proj.key || proj.name.substring(0, 3).toUpperCase()} – {pct}%
                    </span>
                    {taskCount !== undefined && taskCount > 0 && (
                      <div className="text-[10px] text-slate-500">
                        {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <span className="text-slate-700 font-mono text-center block">–</span>
              )}
            </td>
          );
        })}

        {/* Actions Column */}
        {!isReadOnly && (
          <td className="py-2.5 px-3 text-center">
            <div className="flex items-center justify-center gap-1">
              <button
                type="button"
                onClick={() => openEditModal(item)}
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-indigo-400 rounded transition-colors"
                title="Edit project allocation"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              {item.isManualOverride && (
                <button
                  type="button"
                  onClick={() => resetDailyAllocation(item.artistId, item.date)}
                  className="p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded transition-colors"
                  title="Reset to auto-calculated"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </td>
        )}
      </tr>
    );
  }
};
