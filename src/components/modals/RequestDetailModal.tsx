import React, { useState } from 'react';
import {
  Calendar,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  UserCheck,
  UserX,
  Send,
  Link as LinkIcon,
  Clock,
  ArrowRight,
  FileText,
  Activity,
  Layers,
  Edit3,
  Trash2,
  Lock,
  ShieldAlert,
  Info
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { CompanyRequest, RequestStatus, TaskStatus } from '../../types';
import { Modal } from '../common/Modal';
import { RequestStatusBadge, PriorityBadge, TaskStatusBadge } from '../common/Badge';
import { Avatar } from '../common/Avatar';
import { formatDate } from '../../utils/dateUtils';
import { RevisionModal } from './RevisionModal';
import { EditRequestModal } from './EditRequestModal';

interface RequestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  request?: CompanyRequest | null;
  requestId?: string | null;
  onNavigateToTask?: (taskId: string) => void;
}

export const RequestDetailModal: React.FC<RequestDetailModalProps> = ({
  isOpen,
  onClose,
  request: propRequest,
  requestId,
  onNavigateToTask
}) => {
  const {
    requests,
    projects,
    artists,
    tasks,
    sprints,
    currentUser,
    updateRequestStatus,
    assignCompanyRequest,
    canAssignArtist,
    updateTask,
    triageAndCreateTaskFromRequest,
    addRequestComment,
    isCompanyRequestOwner,
    isCompanyRequestEditable,
    canEditCompanyRequest,
    canDeleteCompanyRequest,
    deleteCompanyRequest
  } = useArtOps();

  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [selectedArtistId, setSelectedArtistId] = useState('');

  const targetReqId = propRequest?.id || requestId;
  const request = requests.find(r => r.id === targetReqId) || propRequest;
  if (!request) return null;

  const isOwner = isCompanyRequestOwner(request);
  const editStatus = isCompanyRequestEditable(request);
  const canEdit = isOwner && editStatus.editable;
  const canDelete = canDeleteCompanyRequest(request);

  const project = projects.find(p => p.id === request.projectId);
  const linkedTask = request.taskId ? tasks.find(t => t.id === request.taskId) : null;
  const assignedArtistId = linkedTask?.artistId || request.assignedArtistId;
  const assignedArtist = artists.find(a => a.id === assignedArtistId);
  const sprint = linkedTask?.sprintId ? sprints.find(s => s.id === linkedTask.sprintId) : undefined;

  // Calculate task progress
  const totalSub = linkedTask?.subtasks?.length || 0;
  const completedSub = linkedTask?.subtasks?.filter(s => s.completed).length || 0;

  let progressPercent = 0;
  if (linkedTask) {
    if (linkedTask.status === 'DONE') {
      progressPercent = 100;
    } else if (totalSub > 0) {
      const subRatio = Math.round((completedSub / totalSub) * 100);
      if (linkedTask.status === 'IN_PROGRESS') progressPercent = Math.max(30, subRatio);
      else if (linkedTask.status === 'INTERNAL_REVIEW' || linkedTask.status === 'REQUESTER_REVIEW') progressPercent = Math.max(80, subRatio);
      else if (linkedTask.status === 'REVISION') progressPercent = Math.max(65, subRatio);
      else if (linkedTask.status === 'SELECTED') progressPercent = Math.max(15, subRatio);
      else progressPercent = subRatio;
    } else {
      switch (linkedTask.status) {
        case 'BACKLOG': progressPercent = 0; break;
        case 'SELECTED': progressPercent = 15; break;
        case 'IN_PROGRESS': progressPercent = 50; break;
        case 'INTERNAL_REVIEW': progressPercent = 75; break;
        case 'REQUESTER_REVIEW': progressPercent = 85; break;
        case 'REVISION': progressPercent = 65; break;
        case 'BLOCKED': progressPercent = 40; break;
        default: progressPercent = 0;
      }
    }
  }

  const handleStatusChange = (newStatus: RequestStatus) => {
    updateRequestStatus(request.id, newStatus);
  };

  const handleAssignAndTriage = (artistIdToAssign?: string) => {
    const artId = artistIdToAssign || selectedArtistId;
    if (!artId) return;
    assignCompanyRequest(request.id, artId);
    setSelectedArtistId('');
  };

  const handleUnassign = () => {
    assignCompanyRequest(request.id, undefined);
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    addRequestComment(request.id, newComment.trim());
    setNewComment('');
  };

  const handleDeleteRequest = () => {
    deleteCompanyRequest(request.id);
    setIsConfirmDeleteOpen(false);
    onClose();
  };

  const canAssign = canAssignArtist() || currentUser.role === 'ART_MANAGER' || currentUser.role === 'ADMIN' || currentUser.role === 'ART_DIRECTOR';

  return (
    <>
      <Modal
        id="modal-request-detail"
        isOpen={isOpen}
        onClose={onClose}
        title={
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-base font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
              {request.id}
            </span>
            <span className="text-zinc-400">/</span>
            <span className="text-sm font-semibold text-zinc-700">{project?.name || 'Art Request'}</span>
          </div>
        }
        maxWidth="4xl"
        footer={
          <div className="flex items-center justify-between w-full flex-wrap gap-2">
            {/* Left Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Owner Edit / Delete Controls */}
              {isOwner ? (
                <>
                  {canEdit && (
                    <button
                      id="btn-modal-open-edit-request"
                      type="button"
                      onClick={() => setIsEditModalOpen(true)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                    >
                      <Edit3 size={13} />
                      <span>Edit Request</span>
                    </button>
                  )}

                  {canDelete && (
                    <button
                      id="btn-modal-delete-request"
                      type="button"
                      onClick={() => setIsConfirmDeleteOpen(true)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
                    >
                      <Trash2 size={13} className="text-rose-600" />
                      <span>Delete Request</span>
                    </button>
                  )}
                </>
              ) : (
                <div className="text-[11px] text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-md border border-zinc-200 flex items-center gap-1.5">
                  <Lock size={12} className="text-zinc-400" />
                  <span>Read-only: Only requester ({request.requesterName}) can edit or delete</span>
                </div>
              )}

              {request.status === 'IN_REVIEW' && (
                <>
                  <button
                    type="button"
                    onClick={() => updateRequestStatus(request.id, 'DELIVERED')}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 size={14} />
                    <span>Approve & Mark Delivered</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsRevisionOpen(true)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-lg flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <RotateCcw size={14} className="text-amber-600" />
                    <span>Request Revision</span>
                  </button>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg cursor-pointer"
            >
              Close
            </button>
          </div>
        }
      >
        {/* Delete Confirmation Alert in Modal */}
        {isConfirmDeleteOpen && (
          <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>Confirm Deletion of Request {request.id}</span>
            </div>
            <p className="text-xs text-rose-700 leading-relaxed">
              Are you sure you want to delete this company request ("{request.taskTitle}")? This will remove the request and delete any linked unassigned task from the backlog.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmDeleteOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRequest}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer shadow-2xs"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        )}

        {/* Ownership / Lock Notice Banner */}
        {isOwner ? (
          !canEdit ? (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
              <Lock size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Edit Access Locked (In Production)</span>
                <p className="text-amber-800 mt-0.5">{editStatus.reason}</p>
              </div>
            </div>
          ) : (
            <div className="mb-4 p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-blue-600 shrink-0" />
                <span>
                  <strong>Your Request:</strong> You have full edit access before artist assignment or sprint scheduling.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="px-2.5 py-1 bg-white hover:bg-blue-50 border border-blue-300 text-blue-700 rounded font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs shrink-0"
              >
                <Edit3 size={12} />
                <span>Edit Specs</span>
              </button>
            </div>
          )
        ) : (
          <div className="mb-4 p-2.5 bg-zinc-100 border border-zinc-200 rounded-xl flex items-center gap-2 text-xs text-zinc-600">
            <Info size={14} className="text-zinc-500 shrink-0" />
            <span>
              <strong>Access Restriction:</strong> Only the original requester (<strong>{request.requesterName}</strong>) can edit or delete this request.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="md:col-span-2 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <RequestStatusBadge status={request.status} />
                <PriorityBadge priority={request.priority} />
                <span className="text-xs bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded font-medium">
                  {request.artCategory}
                </span>
              </div>
              <h2 className="text-lg font-bold text-zinc-900">{request.taskTitle}</h2>
            </div>

            {/* Comprehensive Production & Task Assignment Card */}
            {request.taskId ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-blue-600" />
                    <span className="text-xs font-bold text-slate-900">
                      Project Task: <span className="font-mono text-blue-700">{request.taskId}</span>
                    </span>
                    {linkedTask && <TaskStatusBadge status={linkedTask.status} />}
                  </div>

                  {onNavigateToTask && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onNavigateToTask(request.taskId!);
                      }}
                      className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <span>Open Task</span>
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>

                {/* Assigned Artist Card Row */}
                <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 text-xs">
                  <div className="flex items-center gap-2.5">
                    {assignedArtist ? (
                      <>
                        <Avatar name={assignedArtist.name} src={assignedArtist.avatar} size="sm" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">{assignedArtist.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 flex items-center gap-0.5">
                              <UserCheck size={9} />
                              Assigned Artist
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500">{assignedArtist.role}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-amber-800">
                        <UserX size={15} className="text-amber-600" />
                        <div>
                          <span className="font-bold block">Unassigned in Backlog</span>
                          <span className="text-[11px] text-amber-700">Needs artist allocation</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {sprint && (
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Sprint</span>
                      <span className="font-bold text-slate-800">{sprint.name}</span>
                    </div>
                  )}
                </div>

                {/* Progress Bar & Subtasks Stats */}
                {linkedTask && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-700 flex items-center gap-1">
                        <Activity size={12} className="text-blue-600" />
                        Task Production Progress: <strong className="text-blue-700">{progressPercent}%</strong>
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        {linkedTask.timeLogged || 0}h logged / {linkedTask.originalEstimate}h estimate
                      </span>
                    </div>

                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          progressPercent === 100
                            ? 'bg-emerald-500'
                            : linkedTask.status === 'BLOCKED'
                            ? 'bg-rose-500'
                            : 'bg-blue-600'
                        } rounded-full transition-all`}
                        style={{ width: `${Math.min(100, progressPercent)}%` }}
                      />
                    </div>

                    {totalSub > 0 && (
                      <span className="text-[11px] text-slate-500 block">
                        {completedSub} of {totalSub} subtasks completed
                      </span>
                    )}
                  </div>
                )}

                {/* Inline Quick Artist Assignment */}
                {canAssign && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                      {assignedArtist ? 'Reassign Artist:' : 'Assign Artist:'}
                    </span>
                    <select
                      id="modal-assign-artist-select"
                      value={selectedArtistId}
                      onChange={(e) => setSelectedArtistId(e.target.value)}
                      className="text-xs bg-white border border-slate-300 text-slate-800 rounded-md px-2 py-1 flex-1 outline-hidden font-medium"
                    >
                      <option value="">Choose artist from team roster...</option>
                      {artists.map(a => (
                        <option key={a.id} value={a.id}>{a.isManagement ? '👔 ' : '🎨 '}{a.name} ({a.role})</option>
                      ))}
                    </select>
                    <button
                      id="modal-assign-artist-btn"
                      type="button"
                      onClick={() => handleAssignAndTriage()}
                      disabled={!selectedArtistId}
                      className="px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md shadow-xs cursor-pointer transition-colors"
                    >
                      Assign
                    </button>
                    {assignedArtist && (
                      <button
                        id="modal-unassign-artist-btn"
                        type="button"
                        onClick={handleUnassign}
                        className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md cursor-pointer transition-colors"
                      >
                        Unassign
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : canAssign ? (
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle size={15} className="text-amber-600" />
                  <span className="text-xs font-semibold text-amber-900">
                    Triage & Assign Artist
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    id="modal-triage-artist-select"
                    value={selectedArtistId}
                    onChange={(e) => setSelectedArtistId(e.target.value)}
                    className="text-xs bg-white border border-amber-300 rounded px-2.5 py-1.5 flex-1 outline-hidden font-medium"
                  >
                    <option value="">Select Artist...</option>
                    {artists.map(a => (
                      <option key={a.id} value={a.id}>{a.isManagement ? '👔 ' : '🎨 '}{a.name} ({a.role})</option>
                    ))}
                  </select>
                  <button
                    id="modal-triage-assign-btn"
                    type="button"
                    onClick={() => handleAssignAndTriage()}
                    disabled={!selectedArtistId}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded shadow-xs cursor-pointer"
                  >
                    Create Task & Assign
                  </button>
                </div>
              </div>
            ) : null}

            {/* Description */}
            <div>
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-1">
                Description & Specifications
              </h3>
              <p className="text-xs text-zinc-700 whitespace-pre-line leading-relaxed bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                {request.taskDescription}
              </p>
            </div>

            {/* Specs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs">
              <div>
                <span className="text-zinc-400 block text-[11px]">Platform:</span>
                <span className="font-semibold text-zinc-800">{request.platform || 'Unspecified'}</span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[11px]">Target Resolution:</span>
                <span className="font-semibold text-zinc-800">{request.targetResolution || 'Standard'}</span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[11px]">Quantity:</span>
                <span className="font-semibold text-zinc-800">{request.quantity || 1}</span>
              </div>
            </div>

            {/* Reference Files */}
            {request.referenceFiles && request.referenceFiles.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-2">
                  Reference Files ({request.referenceFiles.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {request.referenceFiles.map((file, idx) => (
                    <div key={idx} className="p-2.5 bg-white border border-zinc-200 rounded-lg flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-800 truncate">{file.name}</span>
                      <span className="text-[11px] text-zinc-400 shrink-0 ml-2">{file.size}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Stream */}
            <div>
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider mb-1.5">
                Activity & Request Communication ({request.comments?.length || 0})
              </h3>
              
              <div className="space-y-2 mb-3">
                {request.comments?.map((c) => (
                  <div key={c.id} className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-900">{c.userName}</span>
                      <span className="text-[10px] text-zinc-400">{c.createdAt}</span>
                    </div>
                    <p className="text-zinc-700">{c.content}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddComment} className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Leave a message for requester or art manager..."
                  className="flex-1 text-xs bg-white border border-zinc-300 rounded-lg px-3 py-2 focus:border-zinc-900 outline-hidden"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim()}
                  className="px-3 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Send size={13} />
                  <span>Post</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Sidebar: Requester & Forecast Delivery Status */}
          <div className="space-y-4">
            {/* Requester Info */}
            <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2.5 text-xs">
              <h3 className="font-bold text-zinc-900 uppercase tracking-wider text-xs border-b border-zinc-200 pb-2">
                Requester Details
              </h3>
              <div>
                <span className="text-zinc-400 block text-[11px]">Submitted By:</span>
                <span className="font-semibold text-zinc-900">{request.requesterName}</span>
                <span className="text-zinc-500 block text-[11px]">{request.requesterDepartment}</span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[11px]">Submission Date:</span>
                <span className="font-medium text-zinc-700">{formatDate(request.createdAt)}</span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[11px]">Desired Delivery Date:</span>
                <span className="font-bold text-zinc-900">{formatDate(request.desiredDeliveryDate)}</span>
              </div>
            </div>

            {/* Estimated Effort & Forecast Delivery */}
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2.5 text-xs">
              <h3 className="font-bold text-emerald-950 uppercase tracking-wider text-xs border-b border-emerald-200 pb-2 flex items-center gap-1.5">
                <Sparkles size={14} className="text-emerald-600" />
                <span>Delivery Forecast</span>
              </h3>

              <div>
                <span className="text-emerald-700 block text-[11px]">Estimated Effort:</span>
                <span className="font-bold text-emerald-950 text-sm">{request.estimatedHours || 12} hours</span>
              </div>

              <div>
                <span className="text-emerald-700 block text-[11px]">Target Delivery Date:</span>
                <span className="font-bold text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-300 inline-block mt-0.5">
                  {formatDate(request.expectedDeliveryDate || request.desiredDeliveryDate)}
                </span>
              </div>

              {assignedArtist && (
                <div>
                  <span className="text-emerald-700 block text-[11px]">Assigned Artist:</span>
                  <span className="font-bold text-emerald-950">{assignedArtist.name}</span>
                  <span className="text-emerald-600 block text-[11px]">{assignedArtist.role}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <RevisionModal
        isOpen={isRevisionOpen}
        onClose={() => setIsRevisionOpen(false)}
        request={request}
      />

      {/* Edit Request Modal */}
      {isEditModalOpen && (
        <EditRequestModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          request={request}
        />
      )}
    </>
  );
};
