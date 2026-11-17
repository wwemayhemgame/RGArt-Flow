import React, { useState, useRef, useEffect } from 'react';
import {
  Check,
  ChevronDown,
  X,
  RotateCcw,
  CheckSquare,
  Square,
  History,
  Layers,
  Sparkles
} from 'lucide-react';
import { WORKFLOW_STATUS_LIST, TaskStatus, normalizeTaskStatus } from '../../types';

interface SprintMultiStatusFilterProps {
  selectedStatuses: string[];
  onChange: (statuses: string[]) => void;
  statusCounts: Record<string, number>;
  totalTasksCount: number;
  filteredTasksCount: number;
}

// Color dot helper for each workflow status
const getStatusDotColor = (status: string) => {
  switch (status) {
    case 'To Do':
      return 'bg-slate-400';
    case 'In Progress':
      return 'bg-blue-500';
    case 'On Hold':
      return 'bg-amber-500';
    case 'Re-opened':
      return 'bg-purple-500';
    case 'Submit for Review':
      return 'bg-sky-500';
    case 'In Iteration':
      return 'bg-orange-500';
    case 'Completed':
      return 'bg-emerald-500';
    case 'Cancelled':
      return 'bg-rose-500';
    case 'CARRIED_FORWARD':
      return 'bg-indigo-500';
    default:
      return 'bg-slate-400';
  }
};

const getStatusBadgeBg = (status: string) => {
  switch (status) {
    case 'To Do':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'In Progress':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'On Hold':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'Re-opened':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'Submit for Review':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'In Iteration':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'Completed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Cancelled':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'CARRIED_FORWARD':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

export const SprintMultiStatusFilter: React.FC<SprintMultiStatusFilterProps> = ({
  selectedStatuses,
  onChange,
  statusCounts,
  totalTasksCount,
  filteredTasksCount
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handlePointerDown);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const isAllSelected = selectedStatuses.length === 0;

  // Toggle a single status
  const handleToggleStatus = (st: string) => {
    if (isAllSelected) {
      // If currently all statuses are shown, clicking one selects ONLY that status
      onChange([st]);
      return;
    }

    if (selectedStatuses.includes(st)) {
      const next = selectedStatuses.filter(s => s !== st);
      // If none left, reverts to all
      onChange(next);
    } else {
      onChange([...selectedStatuses, st]);
    }
  };

  // Select only this single status (isolate)
  const handleSelectOnly = (st: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([st]);
  };

  // Quick preset: Select all
  const handleSelectAll = () => {
    onChange([]);
  };

  // Quick preset: Clear
  const handleClear = () => {
    onChange([]);
  };

  // Quick preset: In Flight / Active
  const handleSelectActiveWork = () => {
    onChange(['In Progress', 'Submit for Review', 'In Iteration']);
  };

  // Quick preset: Completed
  const handleSelectCompleted = () => {
    onChange(['Completed']);
  };

  // Quick preset: Carried forward
  const handleSelectCarriedForward = () => {
    onChange(['CARRIED_FORWARD']);
  };

  // Compute trigger button label text
  const getTriggerLabel = () => {
    if (isAllSelected) {
      return `All Statuses (${totalTasksCount})`;
    }
    if (selectedStatuses.length === 1) {
      const single = selectedStatuses[0];
      const label = single === 'CARRIED_FORWARD' ? 'Carried Forward' : single;
      const count = statusCounts[single] || 0;
      return `${label} (${count})`;
    }
    return `${selectedStatuses.length} Statuses (${filteredTasksCount})`;
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef} id="sprint-status-multi-filter">
      {/* Filter Trigger Button */}
      <div className="inline-flex items-center">
        <button
          type="button"
          id="btn-sprint-status-filter"
          onClick={() => setIsOpen(!isOpen)}
          className={`text-xs font-semibold rounded-xl px-3 py-2 border flex items-center gap-2 transition-all cursor-pointer shadow-2xs ${
            !isAllSelected
              ? 'bg-blue-50/90 text-blue-900 border-blue-300 ring-2 ring-blue-500/20 font-bold'
              : 'text-slate-700 bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
          }`}
          aria-haspopup="true"
          aria-expanded={isOpen}
          title="Filter sprint tasks by one or multiple statuses"
        >
          {/* Status Indicator Dot or Counter Badge */}
          {!isAllSelected && selectedStatuses.length === 1 && (
            <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusDotColor(selectedStatuses[0])}`} />
          )}

          {!isAllSelected && selectedStatuses.length > 1 && (
            <span className="w-4 h-4 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
              {selectedStatuses.length}
            </span>
          )}

          <span className="truncate max-w-[170px]">{getTriggerLabel()}</span>

          <ChevronDown
            size={13}
            className={`transition-transform duration-150 text-slate-400 shrink-0 ${isOpen ? 'rotate-180 text-blue-600' : ''}`}
          />
        </button>

        {/* Quick Clear Button beside trigger if filtered */}
        {!isAllSelected && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="ml-1 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Reset status filter to All"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Multi-Status Dropdown Popover */}
      {isOpen && (
        <div
          id="sprint-status-dropdown-menu"
          className="absolute right-0 top-full mt-1.5 w-72 sm:w-80 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="p-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 block">Filter by Status</span>
              <span className="text-[11px] text-slate-500 font-medium">
                {isAllSelected
                  ? `All ${totalTasksCount} sprint tasks visible`
                  : `${selectedStatuses.length} selected • ${filteredTasksCount} matching`}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {!isAllSelected && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-2 py-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={handleSelectAll}
                className="px-2 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100/70 rounded-lg transition-colors cursor-pointer"
              >
                Select All
              </button>
            </div>
          </div>

          {/* Quick Presets Row */}
          <div className="px-3 py-2 bg-slate-50/50 border-b border-slate-100 flex items-center gap-1 flex-wrap text-[10px]">
            <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px] mr-1">Quick:</span>
            <button
              type="button"
              onClick={handleSelectActiveWork}
              className="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-700 font-medium text-slate-600 transition-colors cursor-pointer shadow-2xs"
            >
              In Flight (3)
            </button>
            <button
              type="button"
              onClick={handleSelectCompleted}
              className="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 font-medium text-slate-600 transition-colors cursor-pointer shadow-2xs"
            >
              Done ({statusCounts['Completed'] || 0})
            </button>
            {statusCounts['CARRIED_FORWARD'] > 0 && (
              <button
                type="button"
                onClick={handleSelectCarriedForward}
                className="px-2 py-0.5 rounded-md bg-white border border-slate-200 hover:border-indigo-300 hover:text-indigo-700 font-medium text-slate-600 transition-colors cursor-pointer shadow-2xs"
              >
                Carried ({statusCounts['CARRIED_FORWARD']})
              </button>
            )}
          </div>

          {/* Status List with Checkboxes */}
          <div className="p-1.5 max-h-72 overflow-y-auto space-y-0.5 divide-y divide-slate-50">
            {/* "All Statuses" Option */}
            <div
              onClick={handleSelectAll}
              className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                isAllSelected ? 'bg-blue-50/70 text-blue-900 font-bold' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                    isAllSelected
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-slate-300 bg-white group-hover:border-slate-400'
                  }`}
                >
                  {isAllSelected && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="font-semibold">All Statuses</span>
              </div>
              <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {totalTasksCount}
              </span>
            </div>

            {/* Individual Workflow Statuses */}
            <div className="pt-1 space-y-0.5">
              {WORKFLOW_STATUS_LIST.map((st) => {
                const count = statusCounts[st] || 0;
                const isChecked = !isAllSelected && selectedStatuses.includes(st);

                return (
                  <div
                    key={st}
                    onClick={() => handleToggleStatus(st)}
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-blue-50/60 text-blue-900 font-semibold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Checkbox */}
                      <span
                        className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 bg-white group-hover:border-slate-400'
                        }`}
                      >
                        {isChecked && <Check size={11} strokeWidth={3} />}
                      </span>

                      {/* Status Dot */}
                      <span className={`w-2 h-2 rounded-full shrink-0 ${getStatusDotColor(st)}`} />

                      {/* Status Label */}
                      <span className="truncate">{st}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Hover "Only" button */}
                      <button
                        type="button"
                        onClick={(e) => handleSelectOnly(st, e)}
                        className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-blue-600 hover:underline px-1.5 py-0.5 rounded transition-opacity cursor-pointer"
                        title={`Show only ${st}`}
                      >
                        Only
                      </button>

                      {/* Count Badge */}
                      <span
                        className={`text-[11px] font-mono px-1.5 py-0.2 rounded-full ${
                          count > 0 ? 'bg-slate-100 text-slate-700 font-semibold' : 'text-slate-300 font-normal'
                        }`}
                      >
                        {count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Carried Forward Option */}
            {statusCounts['CARRIED_FORWARD'] > 0 && (
              <div className="pt-1">
                <div
                  onClick={() => handleToggleStatus('CARRIED_FORWARD')}
                  className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-colors ${
                    !isAllSelected && selectedStatuses.includes('CARRIED_FORWARD')
                      ? 'bg-indigo-50/60 text-indigo-900 font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                        !isAllSelected && selectedStatuses.includes('CARRIED_FORWARD')
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'border-slate-300 bg-white group-hover:border-slate-400'
                      }`}
                    >
                      {!isAllSelected && selectedStatuses.includes('CARRIED_FORWARD') && (
                        <Check size={11} strokeWidth={3} />
                      )}
                    </span>

                    <span className="w-2 h-2 rounded-full shrink-0 bg-indigo-500" />
                    <span className="truncate">Carried Forward</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleSelectOnly('CARRIED_FORWARD', e)}
                      className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-indigo-600 hover:underline px-1.5 py-0.5 rounded transition-opacity cursor-pointer"
                      title="Show only Carried Forward"
                    >
                      Only
                    </button>
                    <span className="text-[11px] font-mono font-semibold px-1.5 py-0.2 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                      {statusCounts['CARRIED_FORWARD']}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-mono text-[11px]">
              {filteredTasksCount} / {totalTasksCount} tasks
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
