import React, { useState, useMemo, useEffect } from 'react';
import { Sparkles, Calendar, Upload, Link as LinkIcon, AlertCircle, Clock, CheckCircle2, Bot, Layers, BarChart2 } from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { ArtCategory, Priority, CompanyRequest } from '../../types';
import { Modal } from '../common/Modal';
import { calculateDeliveryForecast, calculateAiEstimatedEffort } from '../../utils/forecastEngine';
import { formatDate, getTodayDateString, addWorkingDays } from '../../utils/dateUtils';

interface CreateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestCreated?: (request: CompanyRequest) => void;
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

export const CreateRequestModal: React.FC<CreateRequestModalProps> = ({
  isOpen,
  onClose,
  onRequestCreated
}) => {
  const { currentUser, projects, artists, tasks, settings, createRequest } = useArtOps();

  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [artCategory, setArtCategory] = useState<ArtCategory>('Marketing Art');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [desiredDeliveryDate, setDesiredDeliveryDate] = useState(() => {
    const today = new Date();
    return addWorkingDays(today, 5).toISOString().split('T')[0];
  });
  const [platform, setPlatform] = useState('iOS / Android / Web');
  const [targetResolution, setTargetResolution] = useState('3840x2160 (4K)');
  const [quantity, setQuantity] = useState(1);
  const [dependencies, setDependencies] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [referenceLink, setReferenceLink] = useState('');
  const [referenceLinks, setReferenceLinks] = useState<string[]>([]);

  useEffect(() => {
    if (!projectId && projects.length > 0) {
      setProjectId(projects[0].id);
    }
  }, [projects, projectId]);

  // AI-Driven Tentative Estimated Effort based on past tasks completed by artists
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

  // Live Automatic Delivery Forecast preview calculated directly using AI estimated effort
  const liveForecast = useMemo(() => {
    if (!artCategory) return null;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !projectId) return;

    const newReq = createRequest({
      requesterId: currentUser?.id || 'req-user',
      requesterName: currentUser?.name || 'Company Requester',
      requesterDepartment: currentUser?.department || 'Company Operations',
      projectId,
      artCategory,
      taskTitle: taskTitle.trim(),
      taskDescription: taskDescription.trim(),
      priority,
      desiredDeliveryDate,
      referenceFiles: [
        {
          name: 'Project_Brand_Ref.png',
          size: '2.4 MB',
          type: 'image/png',
          url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80'
        }
      ],
      referenceLinks,
      platform,
      targetResolution,
      quantity,
      dependencies: dependencies.trim(),
      additionalNotes: additionalNotes.trim(),
      estimatedHours: aiEffort.estimatedHours
    });

    if (onRequestCreated) {
      onRequestCreated(newReq);
    }
    onClose();
  };

  return (
    <Modal
      id="modal-create-request"
      isOpen={isOpen}
      onClose={onClose}
      title="Submit Company Art Request"
      subtitle="Submitting automatically converts this request into a Project Task in the Backlog (Unassigned) with live delivery forecasting."
      maxWidth="3xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            id="btn-submit-request-form"
            type="button"
            onClick={handleSubmit}
            disabled={!taskTitle.trim() || !projectId || projects.length === 0}
            className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-xs cursor-pointer"
          >
            Submit Request
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Top Info Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-zinc-50 rounded-lg border border-zinc-200">
          <div>
            <span className="text-[11px] text-zinc-400 font-semibold uppercase">Requester</span>
            <p className="text-xs font-semibold text-zinc-800">{currentUser?.name || 'Company Requester'}</p>
            <p className="text-[11px] text-zinc-500">{currentUser?.department || 'Company Operations'}</p>
          </div>
          <div>
            <label className="text-[11px] text-zinc-400 font-semibold uppercase block mb-1">Target Project *</label>
            <select
              id="select-request-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full text-xs font-medium bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden cursor-pointer"
              required
            >
              {projects.length === 0 && (
                <option value="">No projects available (Create a project first)</option>
              )}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.key})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-zinc-400 font-semibold uppercase block mb-1">Art Category *</label>
            <select
              id="select-request-category"
              value={artCategory}
              onChange={(e) => setArtCategory(e.target.value as ArtCategory)}
              className="w-full text-xs font-medium bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden cursor-pointer"
              required
            >
              {ART_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Task Title & Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-800 block">
            Task Title *
          </label>
          <input
            id="input-request-title"
            type="text"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="e.g. SummerSlam 2026 Promotional Hero Banner"
            className="w-full text-xs bg-white border border-zinc-300 rounded-lg px-3 py-2 focus:border-zinc-900 outline-hidden font-medium"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-800 block">
            Task Description & Creative Brief *
          </label>
          <textarea
            id="textarea-request-description"
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
            rows={3}
            placeholder="Describe the desired visual style, superstar roster, background setting, mood, and focal points..."
            className="w-full text-xs bg-white border border-zinc-300 rounded-lg p-3 focus:border-zinc-900 outline-hidden"
            required
          />
        </div>

        {/* Priority & Desired Delivery Date (Removed manual estimated hours input) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Priority Level</label>
            <select
              id="select-request-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden cursor-pointer"
            >
              <option value="Critical">Critical (Immediate SLA)</option>
              <option value="High">High (Next Available Capacity)</option>
              <option value="Medium">Medium (Normal Queue)</option>
              <option value="Low">Low (Backlog / Low Urgency)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Desired Delivery Date</label>
            <input
              id="input-request-desired-date"
              type="date"
              value={desiredDeliveryDate}
              onChange={(e) => setDesiredDeliveryDate(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden cursor-pointer"
            />
          </div>
        </div>

        {/* AI TENTATIVE ESTIMATED EFFORT CARD (Based on artist history) */}
        <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Sparkles size={13} />
              </div>
              <div>
                <span className="text-xs font-bold text-indigo-950 block">
                  AI Tentative Estimated Effort:{' '}
                  <span className="text-indigo-700 text-sm font-extrabold">{aiEffort.estimatedHours} Hours</span>
                  <span className="text-indigo-600 font-medium text-[11px] ml-1.5">
                    ({aiEffort.storyPoints} Story Points)
                  </span>
                </span>
              </div>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                aiEffort.confidence === 'High'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : aiEffort.confidence === 'Medium'
                  ? 'bg-blue-100 text-blue-800 border-blue-300'
                  : 'bg-indigo-100 text-indigo-800 border-indigo-300'
              }`}
            >
              {aiEffort.confidence === 'High'
                ? 'High Historical Confidence'
                : aiEffort.confidence === 'Medium'
                ? 'Historical Model Calibrated'
                : 'Studio Benchmark Baseline'}
            </span>
          </div>

          <p className="text-[11px] text-indigo-900 font-medium">
            {aiEffort.explanation}
          </p>

          {aiEffort.matchedKeywords.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Complexity Signals:</span>
              {aiEffort.matchedKeywords.map((kw, idx) => (
                <span
                  key={idx}
                  className="text-[10px] font-semibold bg-white text-indigo-800 px-2 py-0.5 rounded-md border border-indigo-200 shadow-2xs"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* LIVE DELIVERY FORECAST BANNER */}
        {liveForecast && (
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-1.5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
                <Sparkles size={15} className="text-emerald-600" />
                <span>Live Delivery Forecast & Recommended Artist</span>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-200/70 text-emerald-900 rounded">
                Confidence: {liveForecast.confidence}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-emerald-950 font-medium">
              <div>
                <span className="text-[11px] text-emerald-700 block">Recommended Artist:</span>
                <span className="font-bold text-xs">{liveForecast.recommendedArtistName}</span>
                <span className="text-[10px] text-emerald-600 ml-1">({liveForecast.matchScore}% match)</span>
              </div>
              <div>
                <span className="text-[11px] text-emerald-700 block">Expected Start:</span>
                <span className="font-bold text-xs">{formatDate(liveForecast.expectedStartDate)}</span>
              </div>
              <div>
                <span className="text-[11px] text-emerald-700 block">Expected Delivery:</span>
                <span className="font-bold text-xs text-emerald-900 bg-emerald-100 px-1.5 py-0.5 rounded">
                  {formatDate(liveForecast.expectedDeliveryDate)}
                </span>
              </div>
            </div>

            {liveForecast.bottleneckWarning && (
              <p className="text-[11px] text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200">
                {liveForecast.bottleneckWarning}
              </p>
            )}
          </div>
        )}

        {/* Specifications & Technical Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Target Platform</label>
            <input
              type="text"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              placeholder="e.g. iOS / Android / Web"
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Resolution / Format</label>
            <input
              type="text"
              value={targetResolution}
              onChange={(e) => setTargetResolution(e.target.value)}
              placeholder="e.g. 3840x2160, SVG, Sprite Sheet"
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Asset Quantity</label>
            <input
              type="number"
              min="1"
              max="50"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            />
          </div>
        </div>

        {/* Reference Links */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-800 block">Reference Links</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={referenceLink}
              onChange={(e) => setReferenceLink(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="flex-1 text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            />
            <button
              type="button"
              onClick={handleAddLink}
              className="px-3 py-1.5 text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium rounded-md cursor-pointer"
            >
              Add Link
            </button>
          </div>
          {referenceLinks.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {referenceLinks.map((link, idx) => (
                <span key={idx} className="inline-flex items-center gap-1 text-[11px] bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded border border-zinc-200">
                  <LinkIcon size={12} />
                  <span className="truncate max-w-[200px]">{link}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Dependencies & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Dependencies</label>
            <input
              type="text"
              value={dependencies}
              onChange={(e) => setDependencies(e.target.value)}
              placeholder="e.g. Depends on approved superstar 3D render"
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Additional Notes</label>
            <input
              type="text"
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="e.g. Apple featuring cutoff date"
              className="w-full text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1.5 focus:border-zinc-900 outline-hidden"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
};

