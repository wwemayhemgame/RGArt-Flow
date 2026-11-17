import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  Calendar,
  Link as LinkIcon,
  AlertCircle,
  Clock,
  CheckCircle2,
  Lock,
  Trash2,
  Info,
  Layers,
  BarChart2
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { ArtCategory, Priority, CompanyRequest } from '../../types';
import { Modal } from '../common/Modal';
import { calculateDeliveryForecast, calculateAiEstimatedEffort } from '../../utils/forecastEngine';
import { formatDate } from '../../utils/dateUtils';

interface EditRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: CompanyRequest | null;
  onSaved?: (updated: CompanyRequest) => void;
  onDeleted?: () => void;
}

const ART_CATEGORIES: ArtCategory[] = [
  'Marketing Art',
  'UI',
  'Character',
  'Environment',
  'Concept Art',
  'Illustration',
  'Icons',
  '3D Render',
  'Animation',
  'VFX',
  'Social Media',
  'Store Assets',
  'Event Art',
  'Promotional Art',
  'Technical Art',
  'Other'
];

export const EditRequestModal: React.FC<EditRequestModalProps> = ({
  isOpen,
  onClose,
  request,
  onSaved,
  onDeleted
}) => {
  const {
    currentUser,
    projects,
    artists,
    tasks,
    sprints,
    settings,
    isCompanyRequestOwner,
    isCompanyRequestEditable,
    updateCompanyRequest,
    deleteCompanyRequest
  } = useArtOps();

  const [projectId, setProjectId] = useState('');
  const [artCategory, setArtCategory] = useState<ArtCategory>('Marketing Art');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [desiredDeliveryDate, setDesiredDeliveryDate] = useState('');
  const [platform, setPlatform] = useState('');
  const [targetResolution, setTargetResolution] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [dependencies, setDependencies] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [referenceLink, setReferenceLink] = useState('');
  const [referenceLinks, setReferenceLinks] = useState<string[]>([]);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Sync state when request changes
  useEffect(() => {
    if (request) {
      setProjectId(request.projectId || projects[0]?.id || '');
      setArtCategory(request.artCategory || 'Marketing Art');
      setTaskTitle(request.taskTitle || '');
      setTaskDescription(request.taskDescription || '');
      setPriority(request.priority || 'Medium');
      setDesiredDeliveryDate(request.desiredDeliveryDate || '');
      setPlatform(request.platform || 'iOS / Android / Web');
      setTargetResolution(request.targetResolution || '3840x2160 (4K)');
      setQuantity(request.quantity || 1);
      setDependencies(request.dependencies || '');
      setAdditionalNotes(request.additionalNotes || '');
      setReferenceLinks(request.referenceLinks || []);
      setSaveSuccessMessage(null);
      setIsConfirmDeleteOpen(false);
    }
  }, [request, projects]);

  const editStatus = useMemo(() => {
    if (!request) return { editable: false, reason: 'No request selected' };
    return isCompanyRequestEditable(request);
  }, [request, isCompanyRequestEditable]);

  const isOwner = useMemo(() => {
    if (!request) return false;
    return isCompanyRequestOwner(request);
  }, [request, isCompanyRequestOwner]);

  // AI-Driven Tentative Estimated Effort calculation
  const aiEffort = useMemo(() => {
    return calculateAiEstimatedEffort(
      artCategory,
      taskTitle,
      taskDescription,
      quantity,
      tasks,
      settings.spToHoursRatio || 2
    );
  }, [artCategory, taskTitle, taskDescription, quantity, tasks, settings.spToHoursRatio]);

  // Live Automatic Delivery Forecast preview
  const liveForecast = useMemo(() => {
    if (!artCategory || !projectId) return null;
    return calculateDeliveryForecast(
      artCategory,
      aiEffort.estimatedHours,
      priority,
      artists,
      tasks,
      projectId
    );
  }, [artCategory, aiEffort.estimatedHours, priority, artists, tasks, projectId]);

  const handleAddLink = () => {
    if (referenceLink.trim()) {
      setReferenceLinks([...referenceLinks, referenceLink.trim()]);
      setReferenceLink('');
    }
  };

  const handleRemoveLink = (idx: number) => {
    setReferenceLinks(referenceLinks.filter((_, i) => i !== idx));
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!request || !taskTitle.trim() || !projectId) return;

    if (!editStatus.editable) {
      return;
    }

    const updates: Partial<CompanyRequest> = {
      projectId,
      artCategory,
      taskTitle: taskTitle.trim(),
      taskDescription: taskDescription.trim(),
      priority,
      desiredDeliveryDate,
      platform,
      targetResolution,
      quantity,
      dependencies: dependencies.trim(),
      additionalNotes: additionalNotes.trim(),
      referenceLinks,
      estimatedHours: aiEffort.estimatedHours,
      expectedDeliveryDate: liveForecast?.expectedDeliveryDate || request.expectedDeliveryDate
    };

    updateCompanyRequest(request.id, updates);
    setSaveSuccessMessage('Request details updated successfully!');
    if (onSaved) {
      onSaved({ ...request, ...updates });
    }
    setTimeout(() => {
      onClose();
    }, 800);
  };

  const handleDelete = () => {
    if (!request) return;
    deleteCompanyRequest(request.id);
    setIsConfirmDeleteOpen(false);
    if (onDeleted) {
      onDeleted();
    }
    onClose();
  };

  if (!request) return null;

  const linkedProject = projects.find(p => p.id === request.projectId);

  return (
    <Modal
      id="modal-edit-request"
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-base font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
            {request.id}
          </span>
          <span className="text-zinc-400">/</span>
          <span className="text-sm font-semibold text-zinc-800">Edit Company Request</span>
        </div>
      }
      subtitle="Only the original requesting person can edit or delete this request prior to artist assignment or sprint scheduling."
      maxWidth="3xl"
      footer={
        <div className="flex items-center justify-between w-full">
          {/* Delete Action (Allowed for Request Owner) */}
          <div>
            {isOwner && (
              <button
                id="btn-edit-request-delete"
                type="button"
                onClick={() => setIsConfirmDeleteOpen(true)}
                className="px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Trash2 size={14} className="text-rose-600" />
                <span>Delete Request</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            {editStatus.editable && (
              <button
                id="btn-save-request-edit"
                type="button"
                onClick={() => handleSave()}
                disabled={!taskTitle.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} />
                <span>Save Changes</span>
              </button>
            )}
          </div>
        </div>
      }
    >
      {/* Confirmation Dialog for Delete */}
      {isConfirmDeleteOpen && (
        <div className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
            <AlertCircle size={17} className="text-rose-600 shrink-0" />
            <span>Are you sure you want to delete this company request?</span>
          </div>
          <p className="text-xs text-rose-700">
            This will permanently remove request <strong>{request.id}</strong> ({request.taskTitle}) and remove any linked unassigned backlog task. This action cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsConfirmDeleteOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-lg cursor-pointer"
            >
              No, Keep Request
            </button>
            <button
              id="btn-confirm-delete-company-request"
              type="button"
              onClick={handleDelete}
              className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer shadow-2xs"
            >
              Yes, Delete Request
            </button>
          </div>
        </div>
      )}

      {/* Success Banner */}
      {saveSuccessMessage && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{saveSuccessMessage}</span>
        </div>
      )}

      {/* Access / Locked Warning */}
      {!editStatus.editable && (
        <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-xs text-amber-900">
          <Lock size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block">Edit Access Restricted</span>
            <p className="text-amber-800 leading-relaxed">{editStatus.reason}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Top Info Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-zinc-50 rounded-lg border border-zinc-200">
          <div>
            <span className="text-[11px] text-zinc-400 font-semibold uppercase">Requester (Owner)</span>
            <p className="text-xs font-semibold text-zinc-800 mt-0.5">{request.requesterName}</p>
            <span className="text-[10px] text-zinc-500">{request.requesterDepartment}</span>
          </div>
          <div>
            <span className="text-[11px] text-zinc-400 font-semibold uppercase">Created On</span>
            <p className="text-xs font-semibold text-zinc-800 mt-0.5">{formatDate(request.createdAt)}</p>
            <span className="text-[10px] text-zinc-500">Status: {request.status}</span>
          </div>
          <div>
            <span className="text-[11px] text-zinc-400 font-semibold uppercase">Linked Task ID</span>
            <p className="text-xs font-mono font-bold text-blue-700 mt-0.5">{request.taskId || 'None'}</p>
            <span className="text-[10px] text-zinc-500">
              {isOwner ? '✓ You are the owner' : 'Read-only access'}
            </span>
          </div>
        </div>

        {/* Project & Category Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Target Project <span className="text-rose-500">*</span>
            </label>
            <select
              value={projectId}
              disabled={!editStatus.editable}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:bg-zinc-100 disabled:cursor-not-allowed"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.key})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Art Category <span className="text-rose-500">*</span>
            </label>
            <select
              value={artCategory}
              disabled={!editStatus.editable}
              onChange={(e) => setArtCategory(e.target.value as ArtCategory)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:bg-zinc-100 disabled:cursor-not-allowed"
            >
              {ART_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1">
            Task / Asset Title <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            disabled={!editStatus.editable}
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="e.g. Summer Promo Character Splash Screen Art"
            className="w-full text-xs bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:bg-zinc-100 disabled:cursor-not-allowed"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1">
            Description & Scope
          </label>
          <textarea
            rows={3}
            disabled={!editStatus.editable}
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            placeholder="Provide specifications, color palette, style references, layout constraints..."
            className="w-full text-xs bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:bg-zinc-100 disabled:cursor-not-allowed"
          />
        </div>

        {/* Priority & Delivery Date Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Priority <span className="text-rose-500">*</span>
            </label>
            <select
              value={priority}
              disabled={!editStatus.editable}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:bg-zinc-100 disabled:cursor-not-allowed"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical (Blocker)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Desired Delivery Date <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="date"
                required
                disabled={!editStatus.editable}
                value={desiredDeliveryDate}
                onChange={(e) => setDesiredDeliveryDate(e.target.value)}
                className="w-full text-xs bg-white border border-zinc-300 rounded-lg pl-9 pr-3 py-2 text-zinc-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:bg-zinc-100 disabled:cursor-not-allowed"
              />
              <Calendar size={14} className="absolute left-3 top-2.5 text-zinc-400" />
            </div>
          </div>
        </div>

        {/* Production Specs */}
        <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 space-y-3">
          <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
            <Layers size={14} className="text-blue-600" />
            Production Specifications
          </span>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 mb-1">Platform</label>
              <input
                type="text"
                disabled={!editStatus.editable}
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full text-xs bg-white border border-zinc-300 rounded px-2.5 py-1.5 text-zinc-800 disabled:bg-zinc-100"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 mb-1">Target Resolution</label>
              <input
                type="text"
                disabled={!editStatus.editable}
                value={targetResolution}
                onChange={(e) => setTargetResolution(e.target.value)}
                className="w-full text-xs bg-white border border-zinc-300 rounded px-2.5 py-1.5 text-zinc-800 disabled:bg-zinc-100"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 mb-1">Quantity</label>
              <input
                type="number"
                min="1"
                max="50"
                disabled={!editStatus.editable}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full text-xs bg-white border border-zinc-300 rounded px-2.5 py-1.5 text-zinc-800 disabled:bg-zinc-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 mb-1">Dependencies</label>
              <input
                type="text"
                disabled={!editStatus.editable}
                value={dependencies}
                onChange={(e) => setDependencies(e.target.value)}
                placeholder="e.g. Requires 3D model base from Tech Art"
                className="w-full text-xs bg-white border border-zinc-300 rounded px-2.5 py-1.5 text-zinc-800 disabled:bg-zinc-100"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-600 mb-1">Additional Notes</label>
              <input
                type="text"
                disabled={!editStatus.editable}
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                placeholder="Any special notes or guidelines..."
                className="w-full text-xs bg-white border border-zinc-300 rounded px-2.5 py-1.5 text-zinc-800 disabled:bg-zinc-100"
              />
            </div>
          </div>
        </div>

        {/* AI Effort & Delivery Forecast Box */}
        {liveForecast && (
          <div className="p-3.5 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <Sparkles size={14} className="text-blue-600" />
                Updated Forecast & Estimated Effort
              </span>
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                ~{aiEffort.estimatedHours}h ({aiEffort.storyPoints} SP)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-white/80 rounded-lg border border-blue-100">
                <span className="text-[11px] text-zinc-500 block">Expected Delivery</span>
                <span className="font-bold text-zinc-900">{formatDate(liveForecast.expectedDeliveryDate)}</span>
              </div>
              <div className="p-2 bg-white/80 rounded-lg border border-blue-100">
                <span className="text-[11px] text-zinc-500 block">Confidence Rating</span>
                <span className="font-bold text-emerald-700">{liveForecast.confidence} Confidence</span>
              </div>
            </div>
          </div>
        )}

        {/* Reference Links */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1">Reference Links</label>
          {editStatus.editable && (
            <div className="flex gap-2 mb-2">
              <input
                type="url"
                value={referenceLink}
                onChange={(e) => setReferenceLink(e.target.value)}
                placeholder="https://figma.com/file/... or https://drive.google.com/..."
                className="flex-1 text-xs bg-white border border-zinc-300 rounded-lg px-3 py-1.5 text-zinc-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddLink}
                className="px-3 py-1.5 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer"
              >
                Add Link
              </button>
            </div>
          )}

          {referenceLinks.length > 0 ? (
            <div className="space-y-1">
              {referenceLinks.map((link, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 bg-zinc-50 rounded-lg border border-zinc-200 text-xs"
                >
                  <div className="flex items-center gap-1.5 truncate max-w-[80%]">
                    <LinkIcon size={13} className="text-zinc-400 shrink-0" />
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline truncate"
                    >
                      {link}
                    </a>
                  </div>
                  {editStatus.editable && (
                    <button
                      type="button"
                      onClick={() => handleRemoveLink(idx)}
                      className="text-rose-600 hover:text-rose-800 text-[11px] font-semibold cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-zinc-400 italic">No reference links added.</p>
          )}
        </div>
      </form>
    </Modal>
  );
};
