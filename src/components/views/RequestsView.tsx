import React, { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Filter,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  User,
  UserCheck,
  UserX,
  Layers,
  Calendar,
  Activity,
  ArrowRight,
  Edit3,
  Trash2,
  Lock,
  ShieldAlert
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { RequestStatus, Priority, ArtCategory, TaskStatus, CompanyRequest } from '../../types';
import { RequestStatusBadge, PriorityBadge, TaskStatusBadge } from '../common/Badge';
import { Avatar } from '../common/Avatar';
import { formatDate } from '../../utils/dateUtils';
import { EditRequestModal } from '../modals/EditRequestModal';
import { Modal } from '../common/Modal';

interface RequestsViewProps {
  onSelectRequest: (requestId: string) => void;
  onOpenCreateRequest: () => void;
  onNavigateToTask?: (taskId: string) => void;
}

export const RequestsView: React.FC<RequestsViewProps> = ({
  onSelectRequest,
  onOpenCreateRequest,
  onNavigateToTask
}) => {
  const {
    requests,
    projects,
    artists,
    tasks,
    sprints,
    currentUser,
    isCompanyRequestOwner,
    isCompanyRequestEditable,
    canEditCompanyRequest,
    canDeleteCompanyRequest,
    deleteCompanyRequest,
    assignCompanyRequest,
    canAssignArtist
  } = useArtOps();

  const isCompanyRequester = currentUser?.role === 'COMPANY_REQUESTER';
  const canAssign = canAssignArtist() || currentUser?.role === 'ART_MANAGER' || currentUser?.role === 'ADMIN' || currentUser?.role === 'ART_DIRECTOR';

  const [viewScope, setViewScope] = useState<'all' | 'my'>(isCompanyRequester ? 'my' : 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [editingRequest, setEditingRequest] = useState<CompanyRequest | null>(null);
  const [deletingRequest, setDeletingRequest] = useState<CompanyRequest | null>(null);

  // Base requests according to role and selected view scope:
  // Requesters ONLY see their own requested tasks.
  const scopedRequests = useMemo(() => {
    if (!currentUser) return requests;
    if (isCompanyRequester || viewScope === 'my') {
      return requests.filter(r => 
        (currentUser.id && r.requesterId === currentUser.id) ||
        (currentUser.name && r.requesterName.toLowerCase().trim() === currentUser.name.toLowerCase().trim()) ||
        (currentUser.email && r.requesterEmail?.toLowerCase().trim() === currentUser.email.toLowerCase().trim())
      );
    }
    return requests;
  }, [requests, currentUser, isCompanyRequester, viewScope]);

  const filteredRequests = useMemo(() => {
    return scopedRequests.filter(r => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (projectFilter !== 'ALL' && r.projectId !== projectFilter) return false;
      if (priorityFilter !== 'ALL' && r.priority !== priorityFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.id.toLowerCase().includes(q) ||
          r.taskTitle.toLowerCase().includes(q) ||
          r.requesterName.toLowerCase().includes(q) ||
          r.artCategory.toLowerCase().includes(q) ||
          r.taskId?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [scopedRequests, statusFilter, projectFilter, priorityFilter, searchQuery]);

  const stats = useMemo(() => {
    return {
      total: scopedRequests.length,
      new: scopedRequests.filter(r => r.status === 'NEW' || r.status === 'QUEUED').length,
      inProduction: scopedRequests.filter(r => r.status === 'IN_PROGRESS' || r.status === 'ASSIGNED').length,
      inReview: scopedRequests.filter(r => r.status === 'IN_REVIEW' || r.status === 'REVISION').length,
      delivered: scopedRequests.filter(r => r.status === 'DELIVERED').length
    };
  }, [scopedRequests]);

  // Helper to calculate progress percentage and metrics for a linked task
  const getTaskProgress = (taskStatus?: TaskStatus, subtasks?: { completed: boolean }[], timeLogged: number = 0, originalEstimate: number = 12) => {
    if (!taskStatus) {
      return { percent: 0, label: 'Not Converted', color: 'bg-slate-300' };
    }

    if (taskStatus === 'DONE') {
      return { percent: 100, label: '100% Completed', color: 'bg-emerald-500' };
    }

    const totalSub = subtasks?.length || 0;
    const completedSub = subtasks?.filter(s => s.completed).length || 0;

    let percent = 0;
    if (totalSub > 0) {
      const subtaskPercent = Math.round((completedSub / totalSub) * 100);
      if (taskStatus === 'IN_PROGRESS') {
        percent = Math.max(30, subtaskPercent);
      } else if (taskStatus === 'INTERNAL_REVIEW' || taskStatus === 'REQUESTER_REVIEW') {
        percent = Math.max(80, subtaskPercent);
      } else if (taskStatus === 'REVISION') {
        percent = Math.max(65, subtaskPercent);
      } else if (taskStatus === 'SELECTED') {
        percent = Math.max(15, subtaskPercent);
      } else {
        percent = subtaskPercent;
      }
    } else {
      switch (taskStatus) {
        case 'BACKLOG': percent = 0; break;
        case 'SELECTED': percent = 15; break;
        case 'IN_PROGRESS': percent = 50; break;
        case 'INTERNAL_REVIEW': percent = 75; break;
        case 'REQUESTER_REVIEW': percent = 85; break;
        case 'REVISION': percent = 65; break;
        case 'BLOCKED': percent = 40; break;
        default: percent = 0;
      }
    }

    let color = 'bg-blue-600';
    if (percent === 100) color = 'bg-emerald-500';
    else if (taskStatus === 'BLOCKED') color = 'bg-rose-500';
    else if (taskStatus === 'INTERNAL_REVIEW' || taskStatus === 'REQUESTER_REVIEW') color = 'bg-purple-600';
    else if (taskStatus === 'REVISION') color = 'bg-amber-500';
    else if (percent === 0) color = 'bg-slate-300';

    return {
      percent,
      label: `${percent}% Progress`,
      color,
      totalSub,
      completedSub
    };
  };

  return (
    <div id="requests-view" className="p-8 space-y-6 max-w-7xl mx-auto select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {isCompanyRequester ? 'My Company Requests' : 'Company Art Request Portal'}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
              {stats.total} {isCompanyRequester ? 'My Requests' : 'Total Requests'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isCompanyRequester ? (
              <>
                Showing only requests submitted by <strong className="text-slate-800">{currentUser?.name || 'You'}</strong> ({currentUser?.title || currentUser?.department || 'Requester'}). Track your assigned artists, progress, and review deliverables.
              </>
            ) : (
              'Track asset requests, assigned artist workflows, live production progress, and delivery timelines across company teams.'
            )}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {!isCompanyRequester && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewScope('all')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  viewScope === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Studio ({requests.length})
              </button>
              <button
                type="button"
                onClick={() => setViewScope('my')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  viewScope === 'my' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                My Submissions ({requests.filter(r => (currentUser?.id && r.requesterId === currentUser.id) || (currentUser?.name && r.requesterName.toLowerCase() === currentUser.name.toLowerCase())).length})
              </button>
            </div>
          )}

          <button
            id="btn-create-request-header"
            type="button"
            onClick={onOpenCreateRequest}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={15} />
            <span>Submit Art Request</span>
          </button>
        </div>
      </div>

      {/* Stats KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'NEW' ? 'ALL' : 'NEW')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer shadow-xs ${
            statusFilter === 'NEW' ? 'bg-sky-50 border-sky-300 ring-2 ring-sky-400' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-sky-600 block">New Intake / Queued</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">{stats.new}</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer shadow-xs ${
            statusFilter === 'IN_PROGRESS' ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-400' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">In Production</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">{stats.inProduction}</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'IN_REVIEW' ? 'ALL' : 'IN_REVIEW')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer shadow-xs ${
            statusFilter === 'IN_REVIEW' ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 block">In Review / Revision</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">{stats.inReview}</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'DELIVERED' ? 'ALL' : 'DELIVERED')}
          className={`p-4 rounded-xl border text-left transition-all cursor-pointer shadow-xs ${
            statusFilter === 'DELIVERED' ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400' : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">Delivered</span>
          <span className="text-2xl font-bold text-slate-900 mt-1 block">{stats.delivered}</span>
        </button>
      </div>

      {/* Filter Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div className="flex items-center gap-2.5 flex-1 min-w-[240px] px-2">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Request ID, task WWEART-0001, title, requester, or category..."
            className="w-full text-xs text-slate-900 placeholder:text-slate-400 outline-hidden bg-transparent"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 outline-hidden cursor-pointer"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">New</option>
            <option value="QUEUED">Queued</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="REVISION">Revision</option>
            <option value="DELIVERED">Delivered</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {/* Project filter */}
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 outline-hidden cursor-pointer"
          >
            <option value="ALL">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
            ))}
          </select>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 outline-hidden cursor-pointer"
          >
            <option value="ALL">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {filteredRequests.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-xl border border-slate-200 space-y-2">
            <FileText size={32} className="mx-auto text-slate-300" />
            <h3 className="text-sm font-bold text-slate-700">No requests found</h3>
            <p className="text-xs text-slate-400">Try adjusting filters or submit a new company art request.</p>
          </div>
        ) : (
          filteredRequests.map(req => {
            const project = projects.find(p => p.id === req.projectId);
            // Linked Task lookup
            const linkedTask = tasks.find(t => t.id === req.taskId || t.requestId === req.id);
            // Assigned Artist lookup (checks task assignment first, then request record)
            const artistId = linkedTask?.artistId || req.assignedArtistId;
            const artist = artists.find(a => a.id === artistId);
            const sprint = linkedTask?.sprintId ? sprints.find(s => s.id === linkedTask.sprintId) : undefined;

            const progress = getTaskProgress(
              linkedTask?.status,
              linkedTask?.subtasks,
              linkedTask?.timeLogged,
              linkedTask?.originalEstimate || req.estimatedHours || 12
            );

            return (
              <div
                key={req.id}
                id={`request-row-${req.id}`}
                onClick={() => onSelectRequest(req.id)}
                className="p-5 bg-white hover:bg-slate-50/70 rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer space-y-4"
              >
                {/* Header Row: ID, Category, Priority, Project, and Request Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                      {req.id}
                    </span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                      {req.artCategory}
                    </span>
                    <PriorityBadge priority={req.priority} />
                    <span className="text-xs text-slate-500 font-medium">• {project?.name}</span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400 font-medium">Status:</span>
                      <RequestStatusBadge status={req.status} />
                    </div>

                    {/* Owner Action Buttons vs Read-Only indicator */}
                    {isCompanyRequestOwner(req) ? (
                      <div className="flex items-center gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
                        {canEditCompanyRequest(req) ? (
                          <button
                            type="button"
                            onClick={() => setEditingRequest(req)}
                            className="px-2.5 py-1 text-xs text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 flex items-center gap-1 font-bold transition-colors cursor-pointer shadow-2xs"
                            title="Edit Company Request specifications (Available before artist assignment & sprint addition)"
                          >
                            <Edit3 size={12} />
                            <span>Edit Request</span>
                          </button>
                        ) : (
                          <span
                            className="px-2 py-0.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-md flex items-center gap-1 cursor-help"
                            title={isCompanyRequestEditable(req).reason}
                          >
                            <Lock size={11} />
                            <span>Editing Locked</span>
                          </span>
                        )}

                        {canDeleteCompanyRequest(req) && (
                          <button
                            type="button"
                            onClick={() => setDeletingRequest(req)}
                            className="px-2 py-1 text-xs text-rose-600 hover:text-rose-800 bg-white hover:bg-rose-50 rounded-lg border border-rose-200 flex items-center gap-1 font-bold transition-colors cursor-pointer shadow-2xs"
                            title="Delete this company request"
                          >
                            <Trash2 size={12} className="text-rose-500" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <span
                        className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1 ml-1"
                        title={`Restricted: Only original requester (${req.requesterName}) can edit or delete this request.`}
                      >
                        <Lock size={10} className="text-slate-400" />
                        <span>Read-Only</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Title & Description */}
                <div>
                  <h2 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    {req.taskTitle}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {req.taskDescription}
                  </p>
                </div>

                {/* TASK PROGRESS & ARTIST ASSIGNMENT PANEL */}
                <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200/80 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                    {/* 1. Assigned Artist Info */}
                    <div className="flex items-center gap-2.5" onClick={(e) => canAssign && e.stopPropagation()}>
                      {artist ? (
                        <div className="min-w-0 flex items-center gap-2.5 w-full">
                          <Avatar name={artist.name} src={artist.avatar} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {artist.name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 flex items-center gap-0.5">
                                <UserCheck size={9} />
                                Assigned
                              </span>
                            </div>
                            {canAssign ? (
                              <div className="mt-1 flex items-center gap-1.5">
                                <select
                                  id={`reassign-select-${req.id}`}
                                  value={artist.id}
                                  onChange={(e) => {
                                    if (e.target.value === '__UNASSIGN__') {
                                      assignCompanyRequest(req.id, undefined);
                                    } else if (e.target.value) {
                                      assignCompanyRequest(req.id, e.target.value);
                                    }
                                  }}
                                  className="text-[11px] bg-white border border-slate-300 text-slate-700 rounded px-1.5 py-0.5 outline-hidden font-medium cursor-pointer hover:border-slate-400"
                                >
                                  <option value={artist.id}>👤 {artist.name}</option>
                                  <option value="__UNASSIGN__">❌ Unassign Artist</option>
                                  {artists.filter(a => a.id !== artist.id).map(a => (
                                    <option key={a.id} value={a.id}>
                                      {a.isManagement ? '👔 ' : '🎨 '}{a.name} ({a.role})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-500 block truncate">
                                {artist.role}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="w-full">
                          {canAssign ? (
                            <div className="flex flex-col gap-1.5 bg-amber-50/90 p-2 rounded-lg border border-amber-200 w-full">
                              <div className="flex items-center gap-1.5 text-amber-800">
                                <UserX size={13} className="text-amber-600 shrink-0" />
                                <span className="text-xs font-bold">Unassigned</span>
                              </div>
                              <select
                                id={`assign-select-${req.id}`}
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    assignCompanyRequest(req.id, e.target.value);
                                  }
                                }}
                                className="text-[11px] bg-white border border-amber-300 text-slate-800 rounded px-2 py-1 outline-hidden font-medium cursor-pointer hover:border-amber-500"
                              >
                                <option value="">👤 Assign to artist...</option>
                                {artists.map(a => (
                                  <option key={a.id} value={a.id}>
                                    {a.isManagement ? '👔 ' : '🎨 '}{a.name} ({a.role})
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200 w-full">
                              <UserX size={14} className="text-amber-600 shrink-0" />
                              <div className="min-w-0">
                                <span className="text-xs font-bold block">Unassigned in Backlog</span>
                                <span className="text-[10px] text-amber-700 block">Pending artist assignment</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 2. Linked Task ID & Task Status */}
                    <div className="flex items-center gap-2 md:justify-center">
                      {linkedTask ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-400 font-semibold">Task:</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onNavigateToTask) onNavigateToTask(linkedTask.id);
                              }}
                              className="font-mono text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 px-2 py-0.5 rounded border border-blue-200 flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                              title="Open Project Task"
                            >
                              <ExternalLink size={10} />
                              <span>{linkedTask.id}</span>
                            </button>
                            <TaskStatusBadge status={linkedTask.status} />
                          </div>
                          {sprint ? (
                            <span className="text-[10px] text-slate-500 block font-medium">
                              Sprint: <strong className="text-slate-700">{sprint.name}</strong>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 block italic">
                              Unscheduled in Backlog
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">No Task Linked</span>
                      )}
                    </div>

                    {/* 3. Delivery Schedule & Effort */}
                    <div className="text-left md:text-right space-y-0.5 text-xs">
                      <div>
                        <span className="text-slate-400 text-[11px]">Due Date: </span>
                        <span className="font-bold text-slate-800">{formatDate(req.desiredDeliveryDate)}</span>
                      </div>
                      {req.expectedDeliveryDate && (
                        <div className="text-[11px]">
                          <span className="text-slate-400">Forecast: </span>
                          <span className="font-semibold text-emerald-700">{formatDate(req.expectedDeliveryDate)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Task Progress Bar */}
                  {linkedTask && (
                    <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700 flex items-center gap-1">
                            <Activity size={11} className="text-blue-600" />
                            Production Progress:
                          </span>
                          <span className="font-bold text-slate-900">{progress.percent}%</span>
                          {progress.totalSub && progress.totalSub > 0 ? (
                            <span className="text-slate-500">
                              ({progress.completedSub} of {progress.totalSub} subtasks completed)
                            </span>
                          ) : null}
                        </div>

                        <div className="text-slate-500">
                          Time Logged: <strong className="text-slate-800">{linkedTask.timeLogged || 0}h</strong> / {linkedTask.originalEstimate}h
                        </div>
                      </div>

                      {/* Visual Progress Bar Track */}
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${progress.color} rounded-full transition-all duration-300`}
                          style={{ width: `${Math.min(100, progress.percent)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Meta Row */}
                <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    Requested by <strong className="text-slate-600">{req.requesterName}</strong> ({req.requesterDepartment}) on {formatDate(req.createdAt)}
                  </span>
                  <span className="flex items-center gap-1 text-blue-600 font-semibold hover:text-blue-700">
                    <span>View Details & Actions</span>
                    <ChevronRight size={13} />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Request Modal */}
      {editingRequest && (
        <EditRequestModal
          isOpen={!!editingRequest}
          onClose={() => setEditingRequest(null)}
          request={editingRequest}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingRequest && (
        <Modal
          id="modal-confirm-delete-request-view"
          isOpen={!!deletingRequest}
          onClose={() => setDeletingRequest(null)}
          title={
            <div className="flex items-center gap-2 text-rose-700">
              <AlertCircle size={18} />
              <span className="font-bold">Delete Request {deletingRequest.id}</span>
            </div>
          }
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                onClick={() => setDeletingRequest(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteCompanyRequest(deletingRequest.id);
                  setDeletingRequest(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer shadow-xs transition-colors"
              >
                Yes, Delete Request
              </button>
            </div>
          }
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-700 leading-relaxed">
              Are you sure you want to permanently delete company request <strong className="text-slate-900">{deletingRequest.id} ("{deletingRequest.taskTitle}")</strong>?
            </p>
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-[11px] space-y-1">
              <span className="font-bold block">Consequences:</span>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>The request record will be permanently deleted.</li>
                <li>Any unassigned backlog task created from this request will be removed.</li>
              </ul>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

