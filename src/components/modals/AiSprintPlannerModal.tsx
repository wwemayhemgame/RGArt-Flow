import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  BrainCircuit,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Send,
  Zap,
  Calendar,
  UserCheck,
  ShieldCheck,
  Check,
  ChevronRight,
  Sliders,
  Layers,
  Clock,
  ShieldAlert,
  UserX
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { Modal } from '../common/Modal';
import { Avatar } from '../common/Avatar';
import { getArtistCommittedHours, getArtistEffectiveWeeklyCapacity, getArtistSkillMatch, getArtistSprintCapacity } from '../../utils/forecastEngine';
import { formatDuration, formatDurationWithHours, getWeeklySprintDates } from '../../utils/timeUtils';
import { Task, Artist, Sprint } from '../../types';

interface AiSprintPlannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToTask?: (taskId: string) => void;
}

interface PlannedAssignment {
  taskId: string;
  recommendedArtistId: string;
  recommendedArtistName: string;
  matchScore: number;
  matchReason: string;
  estimatedHours: number;
  projectedArtistWorkloadPercent: number;
}

interface ArtistCapacityInfo {
  effectiveCap: number;
  currentHours: number;
  plannedHours: number;
  totalHours: number;
  utilPercent: number;
}

export const AiSprintPlannerModal: React.FC<AiSprintPlannerModalProps> = ({
  isOpen,
  onClose,
  onNavigateToTask
}) => {
  const { tasks, artists, projects, sprints, settings, updateTask, moveTaskToSprint, currentUser, canAccessAiSprintPlanner } = useArtOps();

  const hasAccess = canAccessAiSprintPlanner();

  // Excluded users from settings
  const excludedArtistIds = useMemo(() => settings.aiExcludedArtistIds || [], [settings.aiExcludedArtistIds]);

  // Active weekly sprints
  const [selectedSprintId, setSelectedSprintId] = useState<string>(() => {
    const active = sprints.find(s => s.status === 'Active') || sprints[0];
    return active ? active.id : '';
  });

  const selectedSprint = useMemo(() => {
    return sprints.find(s => s.id === selectedSprintId) || sprints[0] || null;
  }, [sprints, selectedSprintId]);

  const [activeTab, setActiveTab] = useState<'distribution' | 'chat'>('distribution');
  const [isGenerating, setIsGenerating] = useState(false);
  const [plannedAssignments, setPlannedAssignments] = useState<Record<string, string>>({});
  const [aiRationale, setAiRationale] = useState<Record<string, { matchScore: number; reason: string }>>({});
  const [appliedCount, setAppliedCount] = useState(0);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; time: string }>>([
    {
      role: 'assistant',
      text: "Hello! I am your AI Operations & Weekly Sprint Planner. I optimize task distribution across your artists for weekly Monday-to-Friday sprints (40h standard artist capacity), balancing skill matrices and preventing delivery bottlenecks. Click 'AI Auto-Distribute Tasks' to run the intelligent allocation!",
      time: 'Just now'
    }
  ]);

  // Tasks eligible for sprint planning (backlog or currently in this sprint)
  const candidateTasks = useMemo(() => {
    return tasks.filter(t => t.status !== 'DONE' && (!t.sprintId || t.sprintId === selectedSprintId));
  }, [tasks, selectedSprintId]);

  const unassignedCandidateTasks = useMemo(() => {
    return candidateTasks.filter(t => !t.artistId || !plannedAssignments[t.id]);
  }, [candidateTasks, plannedAssignments]);

  // Compute artist weekly capacities (Monday - Friday 5 working days = 40h standard)
  const artistCapacityMap = useMemo<Record<string, ArtistCapacityInfo>>(() => {
    const map: Record<string, ArtistCapacityInfo> = {};

    artists.forEach(artist => {
      const sprintCap = selectedSprint ? getArtistSprintCapacity(artist, selectedSprint) : null;
      const effectiveCap = sprintCap ? sprintCap.netAvailableHours : getArtistEffectiveWeeklyCapacity(artist); // Leave-adjusted available capacity
      const currentHours = tasks
        .filter(t => t.artistId === artist.id && t.status !== 'DONE' && t.sprintId === selectedSprintId)
        .reduce((sum, t) => sum + (t.remainingEstimate ?? t.originalEstimate ?? 8), 0);

      // Add newly planned hours in this session
      const newlyAssignedTaskIds = Object.keys(plannedAssignments).filter(tId => plannedAssignments[tId] === artist.id);
      const newlyAssignedHours = newlyAssignedTaskIds.reduce((sum, tId) => {
        const taskObj = tasks.find(t => t.id === tId);
        // Only count if task wasn't already assigned to this artist
        if (taskObj && taskObj.artistId !== artist.id) {
          return sum + (taskObj.remainingEstimate ?? taskObj.originalEstimate ?? 8);
        }
        return sum;
      }, 0);

      const totalHours = currentHours + newlyAssignedHours;
      const utilPercent = effectiveCap > 0 ? Math.round((totalHours / effectiveCap) * 100) : 0;

      map[artist.id] = {
        effectiveCap,
        currentHours,
        plannedHours: newlyAssignedHours,
        totalHours,
        utilPercent
      };
    });

    return map;
  }, [artists, tasks, selectedSprintId, plannedAssignments]);

  // Studio Summary Stats
  const studioSummary = useMemo(() => {
    const caps = Object.values(artistCapacityMap) as ArtistCapacityInfo[];
    const totalWeeklyCap = caps.reduce((sum, a) => sum + a.effectiveCap, 0);
    const totalCommitted = caps.reduce((sum, a) => sum + a.totalHours, 0);
    const overallUtil = totalWeeklyCap > 0 ? Math.round((totalCommitted / totalWeeklyCap) * 100) : 0;
    const overutilized = caps.filter(a => a.utilPercent > 85).length;
    const balanced = caps.filter(a => a.utilPercent >= 50 && a.utilPercent <= 85).length;

    return { totalWeeklyCap, totalCommitted, overallUtil, overutilized, balanced };
  }, [artistCapacityMap]);

  // Filter production artists vs management/directors
  const isManagementArtist = (a: Artist) => {
    const roleLower = (a.role || '').toLowerCase();
    return (
      a.isManagement === true ||
      a.userRole === 'ART_MANAGER' ||
      a.userRole === 'ART_DIRECTOR' ||
      a.userRole === 'ADMIN' ||
      roleLower.includes('manager') ||
      roleLower.includes('director') ||
      roleLower.includes('administrator') ||
      roleLower.includes('admin')
    );
  };

  const productionArtists = useMemo(() => artists.filter(a => !isManagementArtist(a)), [artists]);
  const managementArtists = useMemo(() => artists.filter(a => isManagementArtist(a)), [artists]);
  const eligibleArtists = useMemo(() => productionArtists.filter(a => !excludedArtistIds.includes(a.id)), [productionArtists, excludedArtistIds]);
  const excludedArtistsList = useMemo(() => artists.filter(a => excludedArtistIds.includes(a.id)), [artists, excludedArtistIds]);

  // AI Auto-Distribution Trigger (Excludes Management, Directors & Excluded Users)
  const handleRunAiDistribution = async () => {
    setIsGenerating(true);
    const tasksToPlan = candidateTasks.filter(t => !t.artistId || t.status === 'BACKLOG' || t.status === 'SELECTED');
    const targetArtists = eligibleArtists;

    if (targetArtists.length === 0) {
      const newPlanned: Record<string, string> = { ...plannedAssignments };
      const newRationale: Record<string, { matchScore: number; reason: string }> = { ...aiRationale };
      tasksToPlan.forEach(t => {
        newRationale[t.id] = {
          matchScore: 0,
          reason: 'Needs Assignment: No eligible production artists in AI distribution pool (all artists are excluded or in management).'
        };
      });
      setAiRationale(newRationale);
      setAiSummary('No eligible production artists available for AI task distribution (all users are marked as Excluded or Management). Tasks flagged as Needs Assignment for manual allocation.');
      setIsGenerating(false);
      return;
    }

    try {
      const response = await fetch('/api/ai/sprint-planner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sprint: selectedSprint,
          tasks: tasksToPlan.length > 0 ? tasksToPlan : candidateTasks,
          excludedArtistIds,
          artists: targetArtists.map(a => ({
            ...a,
            committedHours: artistCapacityMap[a.id]?.currentHours || 0
          }))
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newPlanned: Record<string, string> = { ...plannedAssignments };
        const newRationale: Record<string, { matchScore: number; reason: string }> = { ...aiRationale };

        if (Array.isArray(data.recommendations)) {
          data.recommendations.forEach((rec: PlannedAssignment) => {
            // Verify never assigning to an excluded artist
            if (!excludedArtistIds.includes(rec.recommendedArtistId)) {
              newPlanned[rec.taskId] = rec.recommendedArtistId;
              newRationale[rec.taskId] = {
                matchScore: rec.matchScore,
                reason: rec.matchReason
              };
            } else {
              newRationale[rec.taskId] = {
                matchScore: 0,
                reason: 'Needs Assignment: Bypassed assignment because recommended user is marked as Excluded.'
              };
            }
          });
        }

        setPlannedAssignments(newPlanned);
        setAiRationale(newRationale);
        setAiSummary(data.summary || `AI task allocation complete across ${targetArtists.length} eligible production artists (excluded users and management bypassed).`);
      } else {
        throw new Error('Server returned non-200');
      }
    } catch (err) {
      console.warn('API error, executing client-side distribution algorithm:', err);

      // Deterministic Client-side Fallback (Excludes Management, Directors & Excluded Users)
      const newPlanned: Record<string, string> = { ...plannedAssignments };
      const newRationale: Record<string, { matchScore: number; reason: string }> = { ...aiRationale };
      const simulatedLoads: Record<string, number> = {};

      targetArtists.forEach(a => {
        simulatedLoads[a.id] = artistCapacityMap[a.id]?.currentHours || 0;
      });

      tasksToPlan.forEach(task => {
        const taskHours = task.remainingEstimate ?? task.originalEstimate ?? 8;
        // Find best eligible production artist with skill match and available capacity
        const scored = targetArtists.map(a => {
          const matchScore = getArtistSkillMatch(a, task.taskType as any, task.projectId);
          const sprintCap = selectedSprint ? getArtistSprintCapacity(a, selectedSprint) : null;
          const effectiveCap = sprintCap ? sprintCap.netAvailableHours : getArtistEffectiveWeeklyCapacity(a);
          const load = simulatedLoads[a.id] || 0;
          const projectedUtil = effectiveCap > 0 ? ((load + taskHours) / effectiveCap) * 100 : 100;
          
          let score = matchScore;
          if (projectedUtil > 100) score -= 50;
          else if (projectedUtil <= 85) score += 15;

          return { artist: a, score, projectedUtil };
        }).sort((a, b) => b.score - a.score);

        const best = scored[0];
        // If best is severely overloaded (> 120%) and all eligible are full, flag as Needs Assignment
        if (best && best.projectedUtil <= 120) {
          newPlanned[task.id] = best.artist.id;
          newRationale[task.id] = {
            matchScore: Math.min(99, Math.max(70, Math.round(best.score))),
            reason: `Matches ${best.artist.role} skill matrix. Workload balanced for sprint (excluded users & management bypassed).`
          };
          simulatedLoads[best.artist.id] = (simulatedLoads[best.artist.id] || 0) + taskHours;
        } else {
          newRationale[task.id] = {
            matchScore: 0,
            reason: 'Needs Assignment: All eligible artists are at maximum capacity. Excluded artists were bypassed.'
          };
        }
      });

      setPlannedAssignments(newPlanned);
      setAiRationale(newRationale);
      setAiSummary(`Auto-distributed ${tasksToPlan.length} tasks across ${targetArtists.length} eligible production artists (${excludedArtistIds.length} excluded users bypassed).`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Reassign single task
  const handleAssignTask = (taskId: string, artistId: string) => {
    setPlannedAssignments(prev => ({ ...prev, [taskId]: artistId }));
  };

  // Apply all planned assignments into actual database state
  const handleApplyAll = () => {
    let count = 0;
    (Object.entries(plannedAssignments) as [string, string][]).forEach(([taskId, artistId]) => {
      updateTask(taskId, {
        artistId: artistId || undefined,
        sprintId: selectedSprintId || undefined,
        status: 'SELECTED'
      });
      count++;
    });

    setAppliedCount(count);
    setPlannedAssignments({});
    setAiRationale({});
  };

  // Chat message handling
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput.trim();
    const newMsg = {
      role: 'user' as const,
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          studioStats: {
            sprint: selectedSprint?.name,
            totalWeeklyCap: studioSummary.totalWeeklyCap,
            totalCommitted: studioSummary.totalCommitted,
            utilization: studioSummary.overallUtil,
            artistsCount: artists.length,
            tasksCount: candidateTasks.length
          }
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            text: data.reply || "Weekly sprint planning is healthy. Monday to Friday capacity is balanced.",
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else {
        throw new Error('Chat failed');
      }
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: `Weekly sprints run strictly Monday to Friday (5 working days, 40h standard capacity per artist). Total studio utilization is currently at ${studioSummary.overallUtil}% (${studioSummary.totalCommitted}h / ${studioSummary.totalWeeklyCap}h).`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const hasPendingAllocations = Object.keys(plannedAssignments).length > 0;

  if (!isOpen) return null;

  if (!hasAccess) {
    return (
      <Modal
        id="modal-ai-sprint-planner-restricted"
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
              <ShieldAlert size={18} />
            </div>
            <div>
              <span className="font-bold text-zinc-900 text-base">Access Restricted</span>
            </div>
          </div>
        }
        subtitle="AI Weekly Sprint Planner permission requirement"
        maxWidth="md"
        footer={
          <div className="flex justify-end w-full">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="p-4 space-y-3 text-sm text-zinc-600">
          <p>
            The <strong>AI Weekly Sprint Planner</strong> is restricted to Art Managers, Art Directors, and Administrators to manage studio resource planning and balance capacity.
          </p>
          <p className="text-xs text-zinc-500 bg-zinc-50 p-3 rounded-lg border border-zinc-200">
            Artists and Company Requesters do not have access to run automated AI sprint distributions or model balancing.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      id="modal-ai-sprint-planner"
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-white shadow-xs">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-900 text-base">AI Weekly Sprint Planner</span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-200">
                Mon - Fri (Weekly)
              </span>
            </div>
          </div>
        </div>
      }
      subtitle="AI-powered automatic task distribution matching artist specialization, skill ratings, and weekly 40h capacity."
      maxWidth="5xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-xs">
            {appliedCount > 0 && (
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1">
                <Check size={14} /> {appliedCount} tasks successfully distributed to artists!
              </span>
            )}
            {hasPendingAllocations && (
              <span className="text-amber-800 font-semibold bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                {Object.keys(plannedAssignments).length} pending allocations ready to commit
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              Close
            </button>
            {hasPendingAllocations && (
              <button
                type="button"
                onClick={handleApplyAll}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 size={14} />
                <span>Apply Distribution to Sprint ({Object.keys(plannedAssignments).length})</span>
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Sprint Selection & AI Action Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-900 text-white rounded-xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-amber-400">
              <Calendar size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Target Weekly Sprint:</label>
                <select
                  value={selectedSprintId}
                  onChange={(e) => setSelectedSprintId(e.target.value)}
                  className="text-xs font-bold bg-slate-800 border border-slate-700 text-white rounded-md px-2 py-1 outline-hidden cursor-pointer"
                >
                  {sprints
                    .filter(s => s.status?.toUpperCase() !== 'COMPLETED')
                    .map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.status})
                      </option>
                    ))}
                </select>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Weekly cycle: <span className="text-slate-200 font-semibold">{selectedSprint?.startDate || 'Monday'} to {selectedSprint?.endDate || 'Friday'}</span> (5 working days &bull; 40h standard capacity)
              </p>
              <div className="space-y-1 mt-1">
                <div className="flex items-center gap-1.5 text-[11px] text-amber-300/90 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                  <Sparkles size={12} className="text-amber-400 shrink-0" />
                  <span>AI Auto-Distribute assigns strictly to <strong>Production Artists</strong> (Art Managers & Directors excluded).</span>
                </div>
                {excludedArtistsList.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-rose-300 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-800/40">
                    <UserX size={12} className="text-rose-400 shrink-0" />
                    <span>Admin Exclusion Active: <strong>{excludedArtistsList.map(a => a.name).join(', ')}</strong> ({excludedArtistsList.length}) excluded from AI distribution.</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-ai-auto-distribute"
              type="button"
              onClick={handleRunAiDistribution}
              disabled={isGenerating}
              className="px-4 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 rounded-lg shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Analyzing Skills & Distributing...</span>
                </>
              ) : (
                <>
                  <Zap size={14} />
                  <span>AI Auto-Distribute Tasks</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Studio Capacity Health Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-xs">
          <div>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Studio Utilization</span>
            <span className="text-base font-bold text-zinc-900">{studioSummary.overallUtil}%</span>
            <span className="text-[10px] text-zinc-500 block">
              {studioSummary.totalCommitted}h / {studioSummary.totalWeeklyCap}h cap
            </span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Weekly Sprints</span>
            <span className="text-base font-bold text-zinc-900">5 Days</span>
            <span className="text-[10px] text-zinc-500 block">Monday to Friday</span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Artists in Safe Zone</span>
            <span className="text-base font-bold text-emerald-600">{studioSummary.balanced} / {artists.length}</span>
            <span className="text-[10px] text-zinc-500 block">&le;85% weekly load</span>
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Tasks for Planning</span>
            <span className="text-base font-bold text-amber-600">{candidateTasks.length} tasks</span>
            <span className="text-[10px] text-zinc-500 block">{unassignedCandidateTasks.length} unassigned</span>
          </div>
        </div>

        {aiSummary && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start gap-2">
            <Sparkles size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-blue-950">AI Distribution Insights</span>
              <span>{aiSummary}</span>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-zinc-200 gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('distribution')}
            className={`pb-2 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'distribution'
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-400 hover:text-zinc-700'
            }`}
          >
            <Layers size={14} />
            <span>Weekly Sprint Distribution ({candidateTasks.length} Tasks)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`pb-2 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'chat'
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-400 hover:text-zinc-700'
            }`}
          >
            <BrainCircuit size={14} />
            <span>Operations Copilot Chat</span>
          </button>
        </div>

        {/* TAB 1: DISTRIBUTION BOARD */}
        {activeTab === 'distribution' && (
          <div className="space-y-4">
            {candidateTasks.length === 0 ? (
              <div className="text-center py-12 bg-white border border-zinc-200 rounded-xl p-6">
                <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400 mb-3">
                  <Layers size={24} />
                </div>
                <h3 className="text-sm font-bold text-zinc-900">No tasks in current sprint or backlog</h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto mt-1">
                  Create new tasks in the Backlog or Requests view, then return here to auto-distribute them across artists for the weekly sprint.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left Column: Tasks List & Allocations */}
                <div className="lg:col-span-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                      Tasks to Distribute ({candidateTasks.length})
                    </h3>
                    <span className="text-[11px] text-zinc-500">
                      Auto-matched by skill matrix & weekly headroom
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                    {candidateTasks.map(task => {
                      const assignedArtistId = plannedAssignments[task.id] || task.artistId;
                      const assignedArtist = artists.find(a => a.id === assignedArtistId);
                      const rationale = aiRationale[task.id];
                      const estHours = task.remainingEstimate ?? task.originalEstimate ?? 8;

                      return (
                        <div
                          key={task.id}
                          className={`p-3 rounded-xl border transition-all ${
                            assignedArtist
                              ? 'bg-white border-zinc-200 shadow-2xs hover:border-zinc-300'
                              : 'bg-amber-50/40 border-amber-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-zinc-900">{task.id}</span>
                                <span className="text-[10px] font-semibold bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded">
                                  {task.taskType}
                                </span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  task.priority === 'Critical' ? 'bg-rose-100 text-rose-800' :
                                  task.priority === 'High' ? 'bg-amber-100 text-amber-800' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {task.priority}
                                </span>
                                <span className="text-[11px] text-zinc-500 font-medium">
                                  {formatDurationWithHours(estHours)}
                                </span>
                              </div>
                              <h4 className="text-xs font-semibold text-zinc-900 mt-1 truncate">{task.title}</h4>
                            </div>

                            {/* Artist Assignment Dropdown */}
                            <div className="shrink-0 flex items-center gap-1.5">
                              <select
                                value={assignedArtistId || ''}
                                onChange={(e) => handleAssignTask(task.id, e.target.value)}
                                className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 border outline-hidden cursor-pointer ${
                                  assignedArtist
                                    ? 'bg-zinc-50 border-zinc-300 text-zinc-900'
                                    : 'bg-amber-100 border-amber-300 text-amber-950 font-bold'
                                }`}
                              >
                                <option value="">-- Unassigned --</option>
                                <optgroup label="🎨 Production Artists (AI Auto-Distributed)">
                                  {productionArtists.map(a => (
                                    <option key={a.id} value={a.id}>
                                      {a.name} ({a.role} • {artistCapacityMap[a.id]?.utilPercent || 0}% load)
                                    </option>
                                  ))}
                                </optgroup>
                                {managementArtists.length > 0 && (
                                  <optgroup label="👔 Management & Directors (Manual Assignment Only)">
                                    {managementArtists.map(a => (
                                      <option key={a.id} value={a.id}>
                                        {a.name} ({a.role} • Manual)
                                      </option>
                                    ))}
                                  </optgroup>
                                )}
                              </select>
                            </div>
                          </div>

                          {/* AI Rationale Strip */}
                          {rationale && (
                            <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-1.5 text-zinc-600">
                                <Sparkles size={12} className="text-amber-500 shrink-0" />
                                <span className="italic">{rationale.reason}</span>
                              </div>
                              <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0 ml-2">
                                {rationale.matchScore}% match
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right Column: Artist Capacity & Workload Balance (Mon-Fri) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-wider">
                      Artist Weekly Load (Mon-Fri)
                    </h3>
                    <span className="text-[11px] text-zinc-500">40h Max Cap</span>
                  </div>

                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {/* Production Artists */}
                    <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1 pt-1">
                      Production Artists ({productionArtists.length})
                    </div>
                    {productionArtists.map(artist => {
                      const stats = artistCapacityMap[artist.id] || {
                        effectiveCap: 34,
                        totalHours: 0,
                        utilPercent: 0
                      };
                      const isOver = stats.utilPercent > 85;

                      return (
                        <div
                          key={artist.id}
                          className="p-2.5 bg-white border border-zinc-200 rounded-xl shadow-2xs text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar
                                src={artist.avatar}
                                name={artist.name}
                                size="xs"
                                className="shrink-0"
                              />
                              <div className="min-w-0">
                                <span className="font-bold text-zinc-900 truncate block text-[11px]">{artist.name}</span>
                                <span className="text-[10px] text-zinc-400 truncate block">{artist.role}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`font-bold text-xs ${isOver ? 'text-rose-600' : 'text-zinc-900'}`}>
                                {stats.totalHours}h / {stats.effectiveCap}h
                              </span>
                              <span className="text-[10px] text-zinc-400 block">{stats.utilPercent}% load</span>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isOver
                                  ? 'bg-rose-500'
                                  : stats.utilPercent > 60
                                  ? 'bg-emerald-500'
                                  : 'bg-blue-500'
                              }`}
                              style={{ width: `${Math.min(100, stats.utilPercent)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}

                    {/* Management & Leadership */}
                    {managementArtists.length > 0 && (
                      <>
                        <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider px-1 pt-3">
                          Management & Directors ({managementArtists.length})
                        </div>
                        {managementArtists.map(artist => {
                          const stats = artistCapacityMap[artist.id] || {
                            effectiveCap: 12,
                            totalHours: 0,
                            utilPercent: 0
                          };

                          return (
                            <div
                              key={artist.id}
                              className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Avatar
                                    src={artist.avatar}
                                    name={artist.name}
                                    size="xs"
                                    className="shrink-0"
                                  />
                                  <div className="min-w-0">
                                    <span className="font-bold text-slate-900 truncate block text-[11px] flex items-center gap-1">
                                      <span>👔</span> {artist.name}
                                    </span>
                                    <span className="text-[10px] text-slate-500 truncate block">{artist.role}</span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                                    Manual Assign
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: COPILOT CHAT */}
        {activeTab === 'chat' && (
          <div className="space-y-3">
            <div className="h-64 overflow-y-auto space-y-3 p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2.5 max-w-[85%] ${
                    m.role === 'user' ? 'ml-auto flex-row-reverse' : ''
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                      m.role === 'user'
                        ? 'bg-zinc-900 text-white'
                        : 'bg-gradient-to-tr from-amber-500 to-amber-300 text-white'
                    }`}
                  >
                    {m.role === 'user' ? 'U' : <Sparkles size={14} />}
                  </div>
                  <div>
                    <div
                      className={`p-3 rounded-xl text-xs ${
                        m.role === 'user'
                          ? 'bg-zinc-900 text-white rounded-tr-none'
                          : 'bg-white border border-zinc-200 text-zinc-800 rounded-tl-none shadow-2xs'
                      }`}
                    >
                      {m.text}
                    </div>
                    <span className="text-[10px] text-zinc-400 mt-0.5 block px-1">{m.time}</span>
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div className="flex gap-2 items-center text-xs text-zinc-500 italic p-2">
                  <Sparkles size={14} className="animate-spin text-amber-500" />
                  <span>Thinking...</span>
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about weekly sprint capacity, workload rebalancing, artist availability..."
                className="flex-1 text-xs bg-white border border-zinc-300 rounded-lg px-3 py-2 focus:border-zinc-900 outline-hidden"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isChatLoading}
                className="px-4 py-2 text-xs font-bold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Send size={14} />
                <span>Send</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </Modal>
  );
};
