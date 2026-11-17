import React, { useState, useEffect } from 'react';
import { Clock, Check, Calendar, FileText, AlertCircle, Sparkles, RefreshCw, Layers } from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { Task } from '../../types';
import { Modal } from '../common/Modal';
import { getTodayDateString } from '../../utils/dateUtils';
import {
  parseDurationString,
  formatDuration,
  WORK_DAY_HOURS,
  WORK_WEEK_MINUTES,
  hoursToParsedDuration
} from '../../utils/timeUtils';

interface LogTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
}

export const LogTimeModal: React.FC<LogTimeModalProps> = ({ isOpen, onClose, task }) => {
  const { logTaskTime, currentUser, settings } = useArtOps();

  const [inputMode, setInputMode] = useState<'text' | 'stepper'>('text');
  const [durationText, setDurationText] = useState('2h');
  const [days, setDays] = useState(0);
  const [hours, setHours] = useState(2);
  const [minutes, setMinutes] = useState(0);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => getTodayDateString());
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Jira-like Estimate Adjustment Options
  const [adjustOption, setAdjustOption] = useState<'auto' | 'leave' | 'set' | 'reduce'>('auto');
  const [customRemainingText, setCustomRemainingText] = useState('');

  // Initialize and reset fields when modal opens
  useEffect(() => {
    if (isOpen && task) {
      setDurationText('2h');
      setDays(0);
      setHours(2);
      setMinutes(0);
      setDescription('');
      setDate(getTodayDateString());
      setValidationError(null);
      setAdjustOption('auto');
      const rem = task.remainingEstimate ?? task.originalEstimate;
      setCustomRemainingText(formatDuration(Math.max(0, rem - 2)));
    }
  }, [task, isOpen]);

  if (!task) return null;

  // Compute calculated duration from current active inputs
  const parsed = inputMode === 'text'
    ? parseDurationString(durationText)
    : hoursToParsedDuration(days * WORK_DAY_HOURS + hours + minutes / 60);

  const calculatedHours = parsed.totalHours;
  const currentLogged = task.timeLogged || 0;
  const currentRemaining = task.remainingEstimate ?? task.originalEstimate;

  // Determine final remaining hours based on adjust option
  let finalRemainingHours = Math.max(0, Math.round((currentRemaining - calculatedHours) * 10) / 10);
  if (adjustOption === 'leave') {
    finalRemainingHours = currentRemaining;
  } else if (adjustOption === 'set') {
    const customParsed = parseDurationString(customRemainingText);
    finalRemainingHours = Math.max(0, customParsed.totalHours);
  }

  // Synchronized mode switching
  const handleSwitchMode = (mode: 'text' | 'stepper') => {
    if (mode === 'text') {
      const currentParsed = hoursToParsedDuration(days * WORK_DAY_HOURS + hours + minutes / 60);
      setDurationText(currentParsed.formatted);
    } else {
      const currentParsed = parseDurationString(durationText);
      setDays(currentParsed.days);
      setHours(currentParsed.hours);
      setMinutes(currentParsed.minutes);
    }
    setInputMode(mode);
  };

  // Preset time selections (including weeks, days, hours, mins)
  const PRESETS = [
    { label: '15m', text: '15m' },
    { label: '30m', text: '30m' },
    { label: '1h', text: '1h' },
    { label: '2h', text: '2h' },
    { label: '4h (0.5d)', text: '4h' },
    { label: '1d (8h)', text: '1d' },
    { label: '1d 4h (12h)', text: '1d 4h' },
    { label: '2d (16h)', text: '2d' },
    { label: '1w (40h)', text: '1w' }
  ];

  const applyPreset = (presetText: string) => {
    setDurationText(presetText);
    const p = parseDurationString(presetText);
    setDays(p.days);
    setHours(p.hours);
    setMinutes(p.minutes);
    setValidationError(null);
  };

  const handleStepperChange = (newDays: number, newHours: number, newMins: number) => {
    const totalMinutes = Math.max(0, newDays * WORK_DAY_HOURS * 60 + newHours * 60 + newMins);
    const p = hoursToParsedDuration(totalMinutes / 60);
    setDays(p.days);
    setHours(p.hours);
    setMinutes(p.minutes);
    setDurationText(p.formatted);
    setValidationError(null);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (calculatedHours <= 0) {
      setValidationError('Please enter a duration greater than 0 minutes.');
      return;
    }

    const effectiveDesc = description.trim() || `Daily progress log (+${parsed.formatted})`;
    logTaskTime(task.id, calculatedHours, effectiveDesc, date, finalRemainingHours);
    onClose();
  };

  return (
    <Modal
      id="modal-log-time"
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <Clock size={16} />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-900">Log Work: {task.id}</span>
            {task.jiraIssueKey && (
              <span className="px-2 py-0.5 text-[11px] font-mono font-bold bg-blue-600 text-white rounded">
                Jira: {task.jiraIssueKey}
              </span>
            )}
          </div>
        </div>
      }
      subtitle={task.title}
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full flex-wrap gap-2">
          <div className="text-xs text-zinc-500 flex items-center gap-1.5">
            <span className="font-semibold text-zinc-700">Studio & Jira standard:</span> 1w = 5d (40h), 1d = 8h
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-log-time"
              type="button"
              onClick={() => handleSubmit()}
              disabled={calculatedHours <= 0}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check size={14} />
              <span>Log {parsed.formatted} ({calculatedHours}h)</span>
            </button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Jira Sync Banner if linked */}
        {task.jiraIssueKey && (
          <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs flex items-center justify-between text-blue-900">
            <div className="flex items-center gap-2">
              <RefreshCw size={14} className="text-blue-600 shrink-0" />
              <span>
                Worklog will automatically synchronize to Jira ticket <strong>{task.jiraIssueKey}</strong> under Lead account with artist attribution (<strong>{currentUser?.name}</strong>).
              </span>
            </div>
          </div>
        )}

        {/* Live Calculation Preview Banner */}
        <div className="grid grid-cols-3 gap-2 p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-center text-xs">
          <div className="p-2 bg-white rounded-lg border border-zinc-100 shadow-2xs">
            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">Logged So Far</span>
            <span className="font-bold text-zinc-900 text-sm block mt-0.5">
              {formatDuration(currentLogged)}
            </span>
            <span className="text-[10px] text-zinc-500">({currentLogged}h total)</span>
          </div>
          <div className="p-2 bg-blue-50/70 rounded-lg border border-blue-200 shadow-2xs">
            <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider block">Logging Now</span>
            <span className="font-bold text-blue-700 text-sm block mt-0.5">
              +{parsed.formatted}
            </span>
            <span className="text-[10px] text-blue-600 font-medium">({calculatedHours}h)</span>
          </div>
          <div className="p-2 bg-emerald-50/70 rounded-lg border border-emerald-200 shadow-2xs">
            <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider block">Remaining Est.</span>
            <span className="font-bold text-emerald-700 text-sm block mt-0.5">
              {formatDuration(finalRemainingHours)}
            </span>
            <span className="text-[10px] text-emerald-600 font-medium">({finalRemainingHours}h)</span>
          </div>
        </div>

        {/* Input Mode Selector */}
        <div className="flex items-center justify-between border-b border-zinc-200 pb-2">
          <span className="text-xs font-bold text-zinc-800">Time Spent (Weeks, Days, Hours, Minutes)</span>
          <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-lg text-[11px] font-medium">
            <button
              type="button"
              onClick={() => handleSwitchMode('text')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                inputMode === 'text' ? 'bg-white text-zinc-900 shadow-2xs font-semibold' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Smart Text (e.g. 1w 2d 4h)
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('stepper')}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                inputMode === 'stepper' ? 'bg-white text-zinc-900 shadow-2xs font-semibold' : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Unit Stepper (d / h / m)
            </button>
          </div>
        </div>

        {/* Text Input Mode */}
        {inputMode === 'text' ? (
          <div className="space-y-2">
            <div className="relative">
              <input
                id="input-log-time-flexible"
                type="text"
                value={durationText}
                onChange={(e) => {
                  setDurationText(e.target.value);
                  const p = parseDurationString(e.target.value);
                  setDays(p.days);
                  setHours(p.hours);
                  setMinutes(p.minutes);
                  if (p.totalHours > 0) setValidationError(null);
                }}
                placeholder="e.g. 1w, 1d 4h 30m, 45m, 2h 15m, 0.5d, 2.5h"
                className="w-full text-sm font-semibold bg-white border border-zinc-300 rounded-lg px-3 py-2.5 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-hidden tracking-wide"
              />
              <div className="absolute right-3 top-2.5 text-xs text-blue-600 font-mono font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                = {calculatedHours}h ({parsed.formatted})
              </div>
            </div>
            <p className="text-[11px] text-zinc-500">
              Supported units: <span className="font-semibold text-zinc-700">w</span> (weeks = 40h), <span className="font-semibold text-zinc-700">d</span> (days = 8h), <span className="font-semibold text-zinc-700">h</span> (hours), <span className="font-semibold text-zinc-700">m</span> (minutes). Examples: <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">1w 2d</code>, <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">1d 4h</code>, <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">30m</code>.
            </p>
          </div>
        ) : (
          /* Unit Stepper Mode */
          <div className="grid grid-cols-3 gap-3">
            {/* Days Stepper */}
            <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-center">
              <label className="text-[11px] font-bold text-zinc-600 uppercase block mb-1.5">Days (1d = 8h)</label>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStepperChange(Math.max(0, days - 1), hours, minutes)}
                  className="w-7 h-7 rounded bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-700 font-bold cursor-pointer transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  value={days}
                  onChange={(e) => handleStepperChange(Math.max(0, parseInt(e.target.value) || 0), hours, minutes)}
                  className="w-12 text-center font-bold text-base text-zinc-900 bg-white border border-zinc-200 rounded py-0.5 outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => handleStepperChange(days + 1, hours, minutes)}
                  className="w-7 h-7 rounded bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-700 font-bold cursor-pointer transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Hours Stepper */}
            <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-center">
              <label className="text-[11px] font-bold text-zinc-600 uppercase block mb-1.5">Hours (h)</label>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStepperChange(days, Math.max(0, hours - 1), minutes)}
                  className="w-7 h-7 rounded bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-700 font-bold cursor-pointer transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  value={hours}
                  onChange={(e) => handleStepperChange(days, Math.max(0, parseInt(e.target.value) || 0), minutes)}
                  className="w-12 text-center font-bold text-base text-zinc-900 bg-white border border-zinc-200 rounded py-0.5 outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => handleStepperChange(days, hours + 1, minutes)}
                  className="w-7 h-7 rounded bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-700 font-bold cursor-pointer transition-colors"
                >
                  +
                </button>
              </div>
            </div>

            {/* Minutes Stepper */}
            <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-center">
              <label className="text-[11px] font-bold text-zinc-600 uppercase block mb-1.5">Minutes (m)</label>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStepperChange(days, hours, Math.max(0, minutes - 15))}
                  className="w-7 h-7 rounded bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-700 font-bold cursor-pointer transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  min="0"
                  step="15"
                  value={minutes}
                  onChange={(e) => handleStepperChange(days, hours, Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-12 text-center font-bold text-base text-zinc-900 bg-white border border-zinc-200 rounded py-0.5 outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => handleStepperChange(days, hours, minutes + 15)}
                  className="w-7 h-7 rounded bg-white border border-zinc-300 hover:bg-zinc-100 text-zinc-700 font-bold cursor-pointer transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Increment Preset Chips */}
        <div>
          <span className="text-[11px] text-zinc-400 font-semibold block mb-1.5 uppercase tracking-wider">Quick Presets</span>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.text)}
                className="px-2.5 py-1 text-xs bg-zinc-100 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-zinc-800 rounded-md border border-zinc-200 font-medium transition-colors cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Jira-Style Remaining Estimate Adjustment */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
          <label className="font-bold text-slate-800 uppercase tracking-wider block text-[11px]">
            Remaining Estimate (Jira Adjustment)
          </label>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="adjustEstimate"
                checked={adjustOption === 'auto'}
                onChange={() => setAdjustOption('auto')}
                className="text-blue-600"
              />
              <span>
                Automatically adjust remaining estimate to <strong className="text-emerald-700">{formatDuration(Math.max(0, currentRemaining - calculatedHours))}</strong>
              </span>
            </label>

            <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="adjustEstimate"
                checked={adjustOption === 'leave'}
                onChange={() => setAdjustOption('leave')}
                className="text-blue-600"
              />
              <span>
                Leave estimate unchanged at <strong className="text-slate-900">{formatDuration(currentRemaining)}</strong>
              </span>
            </label>

            <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="adjustEstimate"
                checked={adjustOption === 'set'}
                onChange={() => setAdjustOption('set')}
                className="text-blue-600"
              />
              <span>Set to specific remaining:</span>
              {adjustOption === 'set' && (
                <input
                  type="text"
                  value={customRemainingText}
                  onChange={(e) => setCustomRemainingText(e.target.value)}
                  placeholder="e.g. 4h, 1d 2h"
                  className="w-28 text-xs font-semibold bg-white border border-blue-300 rounded px-2 py-0.5 focus:border-blue-600 outline-hidden"
                />
              )}
            </label>
          </div>
        </div>

        {/* Validation Alert if 0 duration */}
        {validationError && (
          <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Date and Description */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <label className="text-xs font-semibold text-zinc-800 block mb-1">Work Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full text-xs bg-white border border-zinc-300 rounded-lg px-2.5 py-2 focus:border-blue-600 outline-hidden"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-zinc-800 block mb-1">
              Work Log Description <span className="text-zinc-400 font-normal">(Optional)</span>
            </label>
            <input
              id="input-log-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Sculpted high-poly character mesh, baked maps..."
              className="w-full text-xs bg-white border border-zinc-300 rounded-lg px-3 py-2 focus:border-blue-600 outline-hidden"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
};

