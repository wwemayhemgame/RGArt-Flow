import React, { useState } from 'react';
import {
  Filter,
  Plus,
  Trash2,
  X,
  Sparkles,
  Search,
  RotateCcw,
  Check,
  Calendar,
  Layers,
  Clock,
  Zap,
  HelpCircle,
  Tag
} from 'lucide-react';
import type {
  AdvancedFilterState,
  AdvancedFilterRule,
  AdvancedFilterFieldKey,
  AdvancedFilterOperator,
  Project,
  Sprint,
  Artist
} from '../../types';

interface AdvancedSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  filterState: AdvancedFilterState;
  onApplyFilter: (state: AdvancedFilterState) => void;
  onResetFilter: () => void;
  projects: Project[];
  sprints: Sprint[];
  artists: Artist[];
}

export const SEARCHABLE_FIELDS_CONFIG: {
  key: AdvancedFilterFieldKey;
  label: string;
  category: 'Jira' | 'Studio' | 'Shared';
  type: 'text' | 'number' | 'date' | 'select';
  options?: { value: string; label: string }[];
}[] = [
  { key: 'jiraIssueKey', label: 'Jira Ticket / Issue Key', category: 'Jira', type: 'text' },
  { key: 'sprintNumber', label: 'Sprint Number', category: 'Shared', type: 'number' },
  { key: 'sprintName', label: 'Sprint Name', category: 'Shared', type: 'text' },
  { key: 'updateNo', label: 'Update No.', category: 'Shared', type: 'text' },
  { key: 'jiraProject', label: 'Jira Project', category: 'Jira', type: 'text' },
  { key: 'studioProject', label: 'Studio Project', category: 'Studio', type: 'select' },
  { key: 'jiraStatus', label: 'Jira Status', category: 'Jira', type: 'select', options: [
    { value: 'To Do', label: 'To Do' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'On Hold', label: 'On Hold' },
    { value: 'Re-opened', label: 'Re-opened' },
    { value: 'Submit for Review', label: 'Submit for Review' },
    { value: 'In Iteration', label: 'In Iteration' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Cancelled', label: 'Cancelled' }
  ]},
  { key: 'studioStatus', label: 'Studio Status', category: 'Studio', type: 'select', options: [
    { value: 'To Do', label: 'To Do' },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'On Hold', label: 'On Hold' },
    { value: 'Re-opened', label: 'Re-opened' },
    { value: 'Submit for Review', label: 'Submit for Review' },
    { value: 'In Iteration', label: 'In Iteration' },
    { value: 'Completed', label: 'Completed' },
    { value: 'Cancelled', label: 'Cancelled' }
  ]},
  { key: 'assignee', label: 'Assignee / Artist', category: 'Shared', type: 'select' },
  { key: 'reporter', label: 'Reporter', category: 'Shared', type: 'text' },
  { key: 'storyPoints', label: 'Story Points', category: 'Shared', type: 'number' },
  { key: 'priority', label: 'Priority', category: 'Shared', type: 'select', options: [
    { value: 'Critical', label: 'Critical' },
    { value: 'High', label: 'High' },
    { value: 'Medium', label: 'Medium' },
    { value: 'Low', label: 'Low' }
  ]},
  { key: 'issueType', label: 'Issue Type', category: 'Shared', type: 'text' },
  { key: 'labels', label: 'Labels / Tags', category: 'Shared', type: 'text' },
  { key: 'originalEstimate', label: 'Original Estimate (hrs)', category: 'Shared', type: 'number' },
  { key: 'timeLogged', label: 'Time Logged / Tracking (hrs)', category: 'Shared', type: 'number' },
  { key: 'remainingEstimate', label: 'Remaining Estimate (hrs)', category: 'Shared', type: 'number' },
  { key: 'createdDate', label: 'Created Date', category: 'Shared', type: 'date' },
  { key: 'updatedDate', label: 'Updated Date', category: 'Shared', type: 'date' },
  { key: 'dueDate', label: 'Due Date', category: 'Shared', type: 'date' }
];

export const AdvancedSearchModal: React.FC<AdvancedSearchModalProps> = ({
  isOpen,
  onClose,
  filterState,
  onApplyFilter,
  onResetFilter,
  projects,
  sprints,
  artists
}) => {
  const [matchMode, setMatchMode] = useState<'AND' | 'OR'>(filterState?.matchMode || 'AND');
  const [rules, setRules] = useState<AdvancedFilterRule[]>(() => {
    if (filterState?.rules && filterState.rules.length > 0) {
      return [...filterState.rules];
    }
    return [
      {
        id: `rule-${Date.now()}`,
        field: 'jiraProject',
        operator: 'contains',
        value: ''
      }
    ];
  });

  if (!isOpen) return null;

  const handleAddRule = () => {
    setRules(prev => [
      ...prev,
      {
        id: `rule-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        field: 'sprintNumber',
        operator: 'equals',
        value: ''
      }
    ]);
  };

  const handleRemoveRule = (id: string) => {
    setRules(prev => {
      const next = prev.filter(r => r.id !== id);
      if (next.length === 0) {
        return [
          {
            id: `rule-${Date.now()}`,
            field: 'studioProject',
            operator: 'equals',
            value: ''
          }
        ];
      }
      return next;
    });
  };

  const handleUpdateRule = (id: string, updates: Partial<AdvancedFilterRule>) => {
    setRules(prev =>
      prev.map(r => {
        if (r.id === id) {
          const updated = { ...r, ...updates };
          // When field changes, reset operator to default
          if (updates.field && updates.field !== r.field) {
            const fieldCfg = SEARCHABLE_FIELDS_CONFIG.find(f => f.key === updates.field);
            if (fieldCfg?.type === 'number') {
              updated.operator = 'equals';
              updated.value = '';
            } else if (fieldCfg?.type === 'date') {
              updated.operator = 'last_7_days';
              updated.value = '';
            } else if (fieldCfg?.type === 'select') {
              updated.operator = 'equals';
              updated.value = '';
            } else {
              updated.operator = 'contains';
              updated.value = '';
            }
          }
          return updated;
        }
        return r;
      })
    );
  };

  const handleApply = () => {
    onApplyFilter({
      matchMode,
      rules: rules.filter(r => r.value !== '' || ['is_set', 'is_not_set', 'last_7_days', 'last_30_days', 'this_month'].includes(r.operator))
    });
    onClose();
  };

  const handleReset = () => {
    onResetFilter();
    setRules([
      {
        id: `rule-${Date.now()}`,
        field: 'studioProject',
        operator: 'equals',
        value: ''
      }
    ]);
    onClose();
  };

  // Quick preset templates
  const applyPreset = (presetRules: Omit<AdvancedFilterRule, 'id'>[], mode: 'AND' | 'OR' = 'AND') => {
    setMatchMode(mode);
    setRules(
      presetRules.map((r, idx) => ({
        ...r,
        id: `preset-${Date.now()}-${idx}`
      }))
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-zinc-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Filter size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Advanced Ticket Search & Filters</h2>
              <p className="text-xs text-zinc-400">
                Filter tasks using all Jira & Studio fields including Sprint No., Update No., Project, and Status.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Presets Bar */}
        <div className="px-6 py-2.5 bg-zinc-50 border-b border-zinc-200 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-zinc-500 flex items-center gap-1">
            <Sparkles size={12} className="text-blue-500" />
            Quick Filters:
          </span>
          <button
            type="button"
            onClick={() => applyPreset([
              { field: 'jiraProject', operator: 'contains', value: 'Mayhem' }
            ])}
            className="text-[11px] px-2.5 py-1 rounded-md bg-white hover:bg-blue-50 text-zinc-700 hover:text-blue-700 font-medium border border-zinc-200 shadow-2xs transition-colors cursor-pointer"
          >
            WWE Mayhem Tasks
          </button>
          <button
            type="button"
            onClick={() => applyPreset([
              { field: 'jiraProject', operator: 'contains', value: 'Mayhem' },
              { field: 'studioStatus', operator: 'equals', value: 'In Progress' }
            ], 'AND')}
            className="text-[11px] px-2.5 py-1 rounded-md bg-white hover:bg-blue-50 text-zinc-700 hover:text-blue-700 font-medium border border-zinc-200 shadow-2xs transition-colors cursor-pointer"
          >
            WWE Mayhem + In Progress
          </button>
          <button
            type="button"
            onClick={() => applyPreset([
              { field: 'sprintNumber', operator: 'equals', value: 25 }
            ])}
            className="text-[11px] px-2.5 py-1 rounded-md bg-white hover:bg-blue-50 text-zinc-700 hover:text-blue-700 font-medium border border-zinc-200 shadow-2xs transition-colors cursor-pointer"
          >
            Sprint 25
          </button>
          <button
            type="button"
            onClick={() => applyPreset([
              { field: 'updatedDate', operator: 'last_7_days', value: '' }
            ])}
            className="text-[11px] px-2.5 py-1 rounded-md bg-white hover:bg-blue-50 text-zinc-700 hover:text-blue-700 font-medium border border-zinc-200 shadow-2xs transition-colors cursor-pointer"
          >
            Updated Last 7 Days
          </button>
          <button
            type="button"
            onClick={() => applyPreset([
              { field: 'storyPoints', operator: 'greater_than', value: 5 }
            ])}
            className="text-[11px] px-2.5 py-1 rounded-md bg-white hover:bg-blue-50 text-zinc-700 hover:text-blue-700 font-medium border border-zinc-200 shadow-2xs transition-colors cursor-pointer"
          >
            Story Points &gt; 5
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Match Mode Toggle */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-700">Combine conditions using:</span>
              <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100 p-0.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setMatchMode('AND')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    matchMode === 'AND'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  AND (All must match)
                </button>
                <button
                  type="button"
                  onClick={() => setMatchMode('OR')}
                  className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                    matchMode === 'OR'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  OR (Any can match)
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddRule}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
            >
              <Plus size={14} />
              <span>Add Condition</span>
            </button>
          </div>

          {/* Rules List */}
          <div className="space-y-3">
            {rules.map((rule, index) => {
              const currentFieldCfg = SEARCHABLE_FIELDS_CONFIG.find(f => f.key === rule.field) || SEARCHABLE_FIELDS_CONFIG[0];
              const fieldType = currentFieldCfg.type;

              return (
                <div
                  key={rule.id}
                  className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 transition-all"
                >
                  {/* Condition Index / Badge */}
                  <span className="text-[11px] font-bold text-zinc-400 w-6 shrink-0 text-center">
                    #{index + 1}
                  </span>

                  {/* 1. Field Dropdown */}
                  <div className="w-full sm:w-56 shrink-0">
                    <select
                      value={rule.field}
                      onChange={(e) => handleUpdateRule(rule.id, { field: e.target.value as AdvancedFilterFieldKey })}
                      className="w-full text-xs font-semibold py-2 px-2.5 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      <optgroup label="Jira Synchronized Fields">
                        {SEARCHABLE_FIELDS_CONFIG.filter(f => f.category === 'Jira').map(f => (
                          <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Studio & Shared Fields">
                        {SEARCHABLE_FIELDS_CONFIG.filter(f => f.category !== 'Jira').map(f => (
                          <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  {/* 2. Operator Dropdown */}
                  <div className="w-full sm:w-44 shrink-0">
                    <select
                      value={rule.operator}
                      onChange={(e) => handleUpdateRule(rule.id, { operator: e.target.value as AdvancedFilterOperator })}
                      className="w-full text-xs font-medium py-2 px-2.5 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      {fieldType === 'number' ? (
                        <>
                          <option value="equals">Equals (=)</option>
                          <option value="not_equals">Not Equals (!=)</option>
                          <option value="greater_than">Greater Than (&gt;)</option>
                          <option value="greater_than_or_equal">Greater or Equal (&gt;=)</option>
                          <option value="less_than">Less Than (&lt;)</option>
                          <option value="less_than_or_equal">Less or Equal (&lt;=)</option>
                          <option value="is_between">Is Between</option>
                          <option value="is_set">Is Set (Not Empty)</option>
                          <option value="is_not_set">Is Empty</option>
                        </>
                      ) : fieldType === 'date' ? (
                        <>
                          <option value="last_7_days">In Last 7 Days</option>
                          <option value="last_30_days">In Last 30 Days</option>
                          <option value="this_month">This Month</option>
                          <option value="equals">Exact Date (=)</option>
                          <option value="greater_than_or_equal">On or After (&gt;=)</option>
                          <option value="less_than_or_equal">On or Before (&lt;=)</option>
                          <option value="is_set">Date Is Set</option>
                          <option value="is_not_set">No Date (Empty)</option>
                        </>
                      ) : (
                        <>
                          <option value="contains">Contains</option>
                          <option value="equals">Equals</option>
                          <option value="not_equals">Does Not Equal</option>
                          <option value="starts_with">Starts With</option>
                          <option value="not_contains">Does Not Contain</option>
                          <option value="is_set">Is Set (Not Empty)</option>
                          <option value="is_not_set">Is Empty</option>
                        </>
                      )}
                    </select>
                  </div>

                  {/* 3. Value Input Control */}
                  {!['is_set', 'is_not_set', 'last_7_days', 'last_30_days', 'this_month'].includes(rule.operator) && (
                    <div className="flex-1 flex items-center gap-2">
                      {rule.field === 'studioProject' ? (
                        <select
                          value={String(rule.value || '')}
                          onChange={(e) => handleUpdateRule(rule.id, { value: e.target.value })}
                          className="w-full text-xs py-2 px-2.5 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500"
                        >
                          <option value="">-- Select Studio Project --</option>
                          {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
                          ))}
                        </select>
                      ) : rule.field === 'assignee' ? (
                        <select
                          value={String(rule.value || '')}
                          onChange={(e) => handleUpdateRule(rule.id, { value: e.target.value })}
                          className="w-full text-xs py-2 px-2.5 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500"
                        >
                          <option value="">-- Select Assignee / Artist --</option>
                          {artists.map(a => (
                            <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                          ))}
                        </select>
                      ) : currentFieldCfg.options ? (
                        <select
                          value={String(rule.value || '')}
                          onChange={(e) => handleUpdateRule(rule.id, { value: e.target.value })}
                          className="w-full text-xs py-2 px-2.5 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500"
                        >
                          <option value="">-- Select Option --</option>
                          {currentFieldCfg.options.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : fieldType === 'number' ? (
                        <div className="flex items-center gap-2 w-full">
                          <input
                            type="number"
                            value={rule.value ?? ''}
                            onChange={(e) => handleUpdateRule(rule.id, { value: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                            placeholder="Value..."
                            className="w-full text-xs py-2 px-2.5 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500"
                          />
                          {rule.operator === 'is_between' && (
                            <>
                              <span className="text-xs text-zinc-500 font-bold">and</span>
                              <input
                                type="number"
                                value={rule.secondaryValue ?? ''}
                                onChange={(e) => handleUpdateRule(rule.id, { secondaryValue: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                placeholder="Max..."
                                className="w-full text-xs py-2 px-2.5 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500"
                              />
                            </>
                          )}
                        </div>
                      ) : fieldType === 'date' ? (
                        <input
                          type="date"
                          value={String(rule.value || '')}
                          onChange={(e) => handleUpdateRule(rule.id, { value: e.target.value })}
                          className="w-full text-xs py-2 px-2.5 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500"
                        />
                      ) : (
                        <input
                          type="text"
                          value={String(rule.value || '')}
                          onChange={(e) => handleUpdateRule(rule.id, { value: e.target.value })}
                          placeholder={`Enter ${currentFieldCfg.label.toLowerCase()}...`}
                          className="w-full text-xs py-2 px-2.5 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500"
                        />
                      )}
                    </div>
                  )}

                  {/* 4. Delete Rule Button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveRule(rule.id)}
                    title="Remove rule"
                    className="p-2 text-zinc-400 hover:text-red-600 rounded-lg hover:bg-zinc-200/50 transition-colors shrink-0 cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-xs font-bold text-zinc-600 hover:text-zinc-900 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Reset All Filters</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-zinc-600 hover:text-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Check size={14} />
              <span>Apply Filters</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ActiveFilterChipsBar: React.FC<{
  filterState: AdvancedFilterState | null | undefined;
  onRemoveRule: (ruleId: string) => void;
  onClearAll: () => void;
  onOpenAdvancedSearch: () => void;
}> = ({ filterState, onRemoveRule, onClearAll, onOpenAdvancedSearch }) => {
  if (!filterState || !filterState.rules || filterState.rules.length === 0) {
    return null;
  }

  const activeRules = filterState.rules.filter(
    r => r.value !== '' || ['is_set', 'is_not_set', 'last_7_days', 'last_30_days', 'this_month'].includes(r.operator)
  );

  if (activeRules.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 py-2 px-3 bg-blue-50/70 border border-blue-200/80 rounded-xl mb-3">
      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 shrink-0">
        <Filter size={13} className="text-blue-600" />
        <span>Active Filters ({activeRules.length}):</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-200/60 text-blue-800 uppercase font-mono">
          {filterState.matchMode}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {activeRules.map(rule => {
          const cfg = SEARCHABLE_FIELDS_CONFIG.find(f => f.key === rule.field);
          const fieldLabel = cfg?.label || rule.field;

          let displayVal = String(rule.value);
          if (rule.operator === 'last_7_days') displayVal = 'Last 7 Days';
          else if (rule.operator === 'last_30_days') displayVal = 'Last 30 Days';
          else if (rule.operator === 'this_month') displayVal = 'This Month';
          else if (rule.operator === 'is_set') displayVal = 'Is Set';
          else if (rule.operator === 'is_not_set') displayVal = 'Is Empty';
          else if (rule.operator === 'is_between') displayVal = `${rule.value} - ${rule.secondaryValue}`;

          const opSymbol =
            rule.operator === 'equals' ? '=' :
            rule.operator === 'not_equals' ? '!=' :
            rule.operator === 'greater_than' ? '>' :
            rule.operator === 'greater_than_or_equal' ? '>=' :
            rule.operator === 'less_than' ? '<' :
            rule.operator === 'less_than_or_equal' ? '<=' :
            rule.operator === 'contains' ? 'contains' :
            rule.operator === 'starts_with' ? 'starts with' : '';

          return (
            <span
              key={rule.id}
              className="inline-flex items-center gap-1 text-[11px] bg-white text-blue-950 px-2 py-0.5 rounded-md border border-blue-200 font-medium shadow-2xs"
            >
              <strong className="text-blue-700">{fieldLabel}</strong>
              {opSymbol && <span className="text-zinc-400 text-[10px]">{opSymbol}</span>}
              <span className="font-semibold text-zinc-900">{displayVal}</span>
              <button
                type="button"
                onClick={() => onRemoveRule(rule.id)}
                className="text-zinc-400 hover:text-red-600 rounded-sm hover:bg-zinc-100 ml-1 p-0.5 cursor-pointer"
                title="Remove filter"
              >
                <X size={11} />
              </button>
            </span>
          );
        })}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenAdvancedSearch}
          className="text-xs text-blue-700 hover:text-blue-800 font-bold hover:underline cursor-pointer"
        >
          Edit Rules
        </button>
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs text-zinc-500 hover:text-red-600 font-medium hover:underline cursor-pointer"
        >
          Clear All
        </button>
      </div>
    </div>
  );
};
