import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Download,
  CheckSquare,
  Square,
  Search,
  FolderKanban,
  Zap,
  Clock,
  Calendar,
  ExternalLink,
  Layers,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  X,
  Plus,
  Trash2,
  ShieldAlert,
  Sparkles,
  Tag
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { JiraImportableIssue, DEFAULT_JIRA_PROJECT_KEYS } from '../../types';
import { matchJiraToStudioProject } from '../../utils/jiraProjectMatcher';

interface JiraImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToSettings?: () => void;
}

export const JiraImportModal: React.FC<JiraImportModalProps> = ({
  isOpen,
  onClose,
  onNavigateToSettings
}) => {
  const {
    settings,
    projects,
    sprints,
    tasks,
    searchJiraIssues,
    fetchJiraProjects,
    syncAllJiraTasks,
    importJiraIssuesToBacklog,
    removeAllJiraTasks
  } = useArtOps();

  const [isLoading, setIsLoading] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [issues, setIssues] = useState<JiraImportableIssue[]>([]);
  const [selectedIssueKeys, setSelectedIssueKeys] = useState<Set<string>>(new Set());
  
  // Import Target Options: Default to 'AUTO' for multi-project sync!
  const [targetProjectId, setTargetProjectId] = useState<string>('AUTO');
  const [targetSprintId, setTargetSprintId] = useState<string>('');
  const [jqlQuery, setJqlQuery] = useState<string>('');
  const [projectKeysFilter, setProjectKeysFilter] = useState<string>(
    settings.jiraConfig?.defaultProjectKeys && settings.jiraConfig.defaultProjectKeys !== 'ALL'
      ? settings.jiraConfig.defaultProjectKeys
      : DEFAULT_JIRA_PROJECT_KEYS
  );
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [selectedProjectTab, setSelectedProjectTab] = useState<string>('ALL');
  const [availableJiraProjects, setAvailableJiraProjects] = useState<Array<{ id: string; key: string; name: string }>>([]);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [hideAlreadyImported, setHideAlreadyImported] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);

  const existingJiraTasksCount = tasks.filter(t => t.isJiraImported || t.jiraIssueKey).length;

  const isJiraConfigured = Boolean(
    settings.jiraConfig?.hostUrl &&
    settings.jiraConfig?.email &&
    settings.jiraConfig?.apiToken
  );

  // Auto-fetch issues & accessible Jira projects when modal opens if configured
  useEffect(() => {
    if (isOpen && isJiraConfigured) {
      handleFetchIssues();
      loadAvailableJiraProjects();
    }
  }, [isOpen, isJiraConfigured]);

  const loadAvailableJiraProjects = async () => {
    try {
      const res = await fetchJiraProjects();
      if (res.success && res.projects) {
        setAvailableJiraProjects(res.projects);
      }
    } catch (e) {}
  };

  const handlePurgeExistingJiraTasks = async () => {
    setIsPurging(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const purged = await removeAllJiraTasks();
      setSuccessMessage(`Successfully removed all ${purged} previously imported Jira tasks from Studio.`);
      setShowPurgeConfirm(false);
      // Refresh issues to update selected status
      setTimeout(() => {
        handleFetchIssues();
      }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to remove existing Jira tasks.');
    } finally {
      setIsPurging(false);
    }
  };

  const handleFetchIssues = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await searchJiraIssues({
        projectKeys: projectKeysFilter,
        jqlQuery: jqlQuery.trim() || undefined,
        fetchAllAssignees: false
      });

      if (res.success && res.issues) {
        setIssues(res.issues);
        // Pre-select all issues that are not yet imported
        const existingKeys = new Set(tasks.filter(t => t.jiraIssueKey).map(t => t.jiraIssueKey!.toUpperCase()));
        const newKeys = new Set<string>();
        res.issues.forEach(i => {
          if (!existingKeys.has(i.key.toUpperCase())) {
            newKeys.add(i.key);
          }
        });
        setSelectedIssueKeys(newKeys.size > 0 ? newKeys : new Set(res.issues.map(i => i.key)));
      } else {
        setErrorMessage(res.error || 'Failed to fetch Jira issues.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error communicating with Jira API.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncAllProjects = async () => {
    setIsSyncingAll(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await syncAllJiraTasks();
      if (res.success) {
        setSuccessMessage(res.message);
        setTimeout(() => {
          handleFetchIssues();
        }, 1200);
      } else {
        setErrorMessage(res.message || 'Failed to sync all projects.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error syncing Jira tasks.');
    } finally {
      setIsSyncingAll(false);
    }
  };

  const handleToggleIssue = (key: string) => {
    setSelectedIssueKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIssueKeys.size === filteredIssues.length) {
      setSelectedIssueKeys(new Set());
    } else {
      setSelectedIssueKeys(new Set(filteredIssues.map(i => i.key)));
    }
  };

  const handleExecuteImport = () => {
    if (!targetProjectId) {
      setErrorMessage('Please select a target studio project or choose Auto-Map.');
      return;
    }
    const issuesToImport = issues.filter(i => selectedIssueKeys.has(i.key));
    if (issuesToImport.length === 0) {
      setErrorMessage('Please select at least one Jira issue to import.');
      return;
    }

    try {
      const { importedCount, updatedCount } = importJiraIssuesToBacklog(
        issuesToImport,
        targetProjectId,
        targetSprintId || undefined
      );

      const targetText = targetProjectId === 'AUTO'
        ? 'all matching Studio projects'
        : `"${projects.find(p => p.id === targetProjectId)?.name || 'Project'}"`;

      setSuccessMessage(`Successfully synchronized with Jira: ${importedCount} new tasks created, ${updatedCount} existing tasks refreshed across ${targetText}.`);
      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to import Jira tasks.');
    }
  };

  if (!isOpen) return null;

  // Extract distinct Jira project keys from fetched issues
  const distinctIssueProjectKeys: string[] = Array.from(
    new Set(issues.map(i => i.projectKey || (i.key.includes('-') ? i.key.split('-')[0] : '')).filter(Boolean))
  );

  const existingJiraKeys = new Set(
    tasks.filter(t => t.jiraIssueKey).map(t => t.jiraIssueKey!.toUpperCase())
  );

  // Filter issues by project tab, search filter, and duplicate status
  const filteredIssues = issues.filter(i => {
    const isAlreadyInStudio = existingJiraKeys.has(i.key.toUpperCase());
    if (hideAlreadyImported && isAlreadyInStudio) {
      return false;
    }

    const issueProj = (i.projectKey || (i.key.includes('-') ? i.key.split('-')[0] : '')).toUpperCase();
    if (selectedProjectTab !== 'ALL' && issueProj !== selectedProjectTab.toUpperCase()) {
      return false;
    }
    if (!searchFilter) return true;
    const term = searchFilter.toLowerCase();
    return (
      i.key.toLowerCase().includes(term) ||
      i.summary.toLowerCase().includes(term) ||
      (i.assigneeName && i.assigneeName.toLowerCase().includes(term)) ||
      i.issueType.toLowerCase().includes(term)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
              <FolderKanban className="text-blue-400" size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">Sync & Import Jira Tasks to Backlog</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 font-bold border border-blue-400/30">
                  Lead Proxy Sync
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Import art tickets assigned to you in Jira into RG ArtFlow. Team artists can log work, update estimates & status without Jira accounts.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
          {!isJiraConfigured ? (
            <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl space-y-3 text-center">
              <AlertCircle size={32} className="text-amber-600 mx-auto" />
              <h3 className="text-sm font-bold text-amber-900">Jira Integration Credentials Required</h3>
              <p className="text-xs text-amber-700 max-w-lg mx-auto leading-relaxed">
                To sync tickets from your organization's Jira projects, please enter your Atlassian Host URL, Jira Email, and API Token in Studio Settings.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onNavigateToSettings) onNavigateToSettings();
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>Open Jira Settings & Credentials</span>
                  <ExternalLink size={13} />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Alert notifications */}
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-red-500" />
                  <span className="flex-1">{errorMessage}</span>
                  <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-red-700">
                    <X size={14} />
                  </button>
                </div>
              )}

              {successMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Clean Wipe / Purge Existing Tasks Banner */}
              <div className="p-4 bg-slate-900 text-white rounded-xl shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0 mt-0.5">
                    <Trash2 size={16} className="text-rose-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-100">Clean Slate Sync</h4>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {existingJiraTasksCount} Jira tasks in Studio
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Remove outdated or misallocated Jira tasks before running a fresh, strictly-mapped import.
                    </p>
                  </div>
                </div>

                {!showPurgeConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowPurgeConfirm(true)}
                    className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                  >
                    <Trash2 size={13} />
                    <span>Remove All Existing Jira Tasks</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 shrink-0 bg-rose-950/80 border border-rose-800 p-1.5 rounded-lg">
                    <span className="text-[11px] text-rose-200 font-semibold px-1">Delete {existingJiraTasksCount} tasks?</span>
                    <button
                      type="button"
                      onClick={handlePurgeExistingJiraTasks}
                      disabled={isPurging}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded cursor-pointer"
                    >
                      {isPurging ? 'Deleting...' : 'Yes, Purge'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPurgeConfirm(false)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Sync Directives & Mapping Rules Info Box */}
              <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl text-xs space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-blue-900">
                  <ShieldAlert size={15} className="text-blue-600" />
                  <span>Jira Strict Sync Rules Active</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] text-blue-800">
                  <div className="p-2 bg-white/70 rounded-lg border border-blue-100">
                    <strong className="text-blue-950 block">1. Assignee Scope</strong>
                    Tickets assigned to <code>ranjeet.patil@zapak.com</code> or <code>pramod.jadhav@zapak.com</code>.
                  </div>
                  <div className="p-2 bg-white/70 rounded-lg border border-blue-100">
                    <strong className="text-blue-950 block">2. Strict Project Mapping</strong>
                    WWE Mayhem tickets map to <strong>WWE Mayhem</strong> project.
                  </div>
                  <div className="p-2 bg-white/70 rounded-lg border border-blue-100">
                    <strong className="text-blue-950 block">3. Exclude Done Tasks</strong>
                    Completed, Verified, and Closed tasks are excluded from sync.
                  </div>
                </div>
              </div>

              {/* Step 1: Query & Search Filters */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold text-[11px] flex items-center justify-center">1</span>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Jira Multi-Project Query & Lead Sync
                    </h3>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-[11px] text-slate-500">
                      Connected: <span className="font-semibold text-slate-800">{settings.jiraConfig?.email}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSyncAllProjects}
                      disabled={isSyncingAll}
                      className="px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                      title="Directly synchronize all Jira tickets from all projects into ArtOps"
                    >
                      <Zap size={12} className={isSyncingAll ? 'animate-spin' : ''} />
                      <span>{isSyncingAll ? 'Syncing...' : 'Quick Sync All Projects'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-600">
                        Project Keys
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setProjectKeysFilter(DEFAULT_JIRA_PROJECT_KEYS)}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-bold cursor-pointer underline"
                          title="Filter by all 125 Jira migration project keys"
                        >
                          125 Migration Projects
                        </button>
                        <span className="text-zinc-300">|</span>
                        <button
                          type="button"
                          onClick={() => setProjectKeysFilter('ALL')}
                          className="text-[10px] text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                        >
                          All (ALL)
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={projectKeysFilter}
                      onChange={(e) => setProjectKeysFilter(e.target.value)}
                      placeholder="e.g. WWE, ART, MAYHEM, HRAD (or ALL)"
                      className="w-full text-xs font-medium px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 outline-hidden"
                    />

                    {/* Quick project badges */}
                    {availableJiraProjects.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        <span className="text-[10px] text-slate-400 font-medium">Quick Add:</span>
                        {availableJiraProjects.slice(0, 5).map(jp => (
                          <button
                            key={jp.id || jp.key}
                            type="button"
                            onClick={() => {
                              const current = projectKeysFilter.trim();
                              if (!current || current === 'ALL') {
                                setProjectKeysFilter(jp.key);
                              } else {
                                const parts = current.split(',').map(s => s.trim().toUpperCase());
                                if (!parts.includes(jp.key.toUpperCase())) {
                                  setProjectKeysFilter([...parts, jp.key].join(', '));
                                }
                              }
                            }}
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-700 border border-slate-200 cursor-pointer"
                          >
                            +{jp.key}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Custom JQL (Optional override)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={jqlQuery}
                        onChange={(e) => setJqlQuery(e.target.value)}
                        placeholder="e.g. project in (WWE, ART, MAYHEM, HRAD) ORDER BY updated DESC"
                        className="flex-1 text-xs font-mono px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={handleFetchIssues}
                        disabled={isLoading}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer"
                      >
                        <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
                        <span>{isLoading ? 'Fetching...' : 'Fetch Tickets'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Target Destination in Studio */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 font-bold text-[11px] flex items-center justify-center">2</span>
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Target Studio Destination & Routing
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Target Project <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={targetProjectId}
                      onChange={(e) => setTargetProjectId(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-800 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 outline-hidden cursor-pointer"
                    >
                      <option value="AUTO">✨ Auto-Map to Matching Projects (Multi-Project Sync)</option>
                      <optgroup label="Specific Studio Projects">
                        {projects.map(p => (
                          <option key={p.id} value={p.id}>{p.name} [{p.key}]</option>
                        ))}
                      </optgroup>
                    </select>
                    <p className="text-[10px] text-slate-500 mt-1">
                      {targetProjectId === 'AUTO'
                        ? 'Tickets from WWE, MAYHEM, ART will route to their corresponding studio projects based on Jira project mapping.'
                        : 'All selected tickets will be placed into this single project.'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Schedule into Sprint (Optional)
                    </label>
                    <select
                      value={targetSprintId}
                      onChange={(e) => setTargetSprintId(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-800 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 outline-hidden cursor-pointer"
                    >
                      <option value="">Leave in Backlog (Unscheduled)</option>
                      {sprints
                        .filter(s => s.status?.toUpperCase() !== 'COMPLETED')
                        .map(s => (
                          <option key={s.id} value={s.id}>Sprint #{s.sprintNumber}: {s.name} ({s.status})</option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Step 3: Issue Selection Table with Project Tabs */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                <div className="p-3 bg-slate-100/70 border-b border-slate-200 flex flex-col gap-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
                      >
                        {selectedIssueKeys.size > 0 && selectedIssueKeys.size === filteredIssues.length ? (
                          <CheckSquare size={16} className="text-blue-600" />
                        ) : (
                          <Square size={16} className="text-slate-400" />
                        )}
                        <span>Select All ({selectedIssueKeys.size}/{filteredIssues.length})</span>
                      </button>
                      <span className="text-xs text-slate-400">|</span>
                      <span className="text-xs text-slate-500 font-medium">
                        Total Tickets: <strong className="text-slate-800">{issues.length}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setHideAlreadyImported(prev => !prev)}
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer flex items-center gap-1 ${
                          hideAlreadyImported
                            ? 'bg-blue-50 text-blue-700 border-blue-300'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span>{hideAlreadyImported ? '✓ Showing New Only' : 'Hide Already Imported'}</span>
                      </button>

                      {/* Search input in issue table */}
                      <div className="relative w-full sm:w-56">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={searchFilter}
                          onChange={(e) => setSearchFilter(e.target.value)}
                          placeholder="Filter tickets..."
                          className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg outline-hidden focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Multi-Project Filter Pills */}
                  {distinctIssueProjectKeys.length > 1 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200/60">
                      <span className="text-[11px] font-semibold text-slate-500 mr-1">Filter Project:</span>
                      <button
                        type="button"
                        onClick={() => setSelectedProjectTab('ALL')}
                        className={`text-xs px-2.5 py-1 rounded-full font-bold transition-colors cursor-pointer ${
                          selectedProjectTab === 'ALL'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        All ({issues.length})
                      </button>
                      {distinctIssueProjectKeys.map(pkey => {
                        const count = issues.filter(i => (i.projectKey || (i.key.includes('-') ? i.key.split('-')[0] : '')).toUpperCase() === pkey.toUpperCase()).length;
                        return (
                          <button
                            key={pkey}
                            type="button"
                            onClick={() => setSelectedProjectTab(pkey)}
                            className={`text-xs px-2.5 py-1 rounded-full font-bold transition-colors cursor-pointer ${
                              selectedProjectTab.toUpperCase() === pkey.toUpperCase()
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                            }`}
                          >
                            {pkey} ({count})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Table Content */}
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {isLoading ? (
                    <div className="p-8 text-center text-slate-500 space-y-2">
                      <RefreshCw size={24} className="animate-spin mx-auto text-blue-600" />
                      <p className="text-xs">Fetching assigned art tickets from Jira...</p>
                    </div>
                  ) : filteredIssues.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      {issues.length === 0 ? (
                        <>No issues found. Click <strong>"Fetch Tickets"</strong> or check your Jira projects and filters.</>
                      ) : (
                        <>No issues match the search keyword "{searchFilter}".</>
                      )}
                    </div>
                  ) : (
                    filteredIssues.map(issue => {
                      const isSelected = selectedIssueKeys.has(issue.key);
                      const isAlreadyInStudio = existingJiraKeys.has(issue.key.toUpperCase());

                      return (
                        <div
                          key={issue.id}
                          onClick={() => handleToggleIssue(issue.key)}
                          className={`p-3 flex items-start gap-3 transition-colors cursor-pointer ${
                            isSelected ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="pt-0.5 shrink-0">
                            {isSelected ? (
                              <CheckSquare size={16} className="text-blue-600" />
                            ) : (
                              <Square size={16} className="text-slate-300" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            {(() => {
                              const issueKeyPrefix = issue.projectKey || (issue.key ? issue.key.split('-')[0] : '');
                              const matchRes = matchJiraToStudioProject(
                                issueKeyPrefix,
                                issue.projectName,
                                projects,
                                false,
                                settings.jiraConfig?.projectMappings
                              );
                              const mappedName = matchRes.project?.name || issueKeyPrefix;

                              return (
                                <>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                      {issue.key}
                                    </span>
                                    <span className="text-[11px] font-semibold text-slate-700 bg-blue-50/70 border border-blue-200/80 px-2 py-0.5 rounded">
                                      Studio Project: <strong>{mappedName}</strong>
                                    </span>
                                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                      {issue.issueType}
                                    </span>
                                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                      {issue.status}
                                    </span>
                                    {isAlreadyInStudio && (
                                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                        Already in Studio (Will Update)
                                      </span>
                                    )}
                                  </div>

                                  <p className="text-xs font-semibold text-slate-900 mt-1 line-clamp-1">
                                    {issue.summary}
                                  </p>
                                </>
                              );
                            })()}

                            <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 flex-wrap">
                              <span className="flex items-center gap-1">
                                <Clock size={11} className="text-slate-400" />
                                Est: <strong>{issue.originalEstimateHours || 12}h</strong> ({issue.storyPoints || Math.round((issue.originalEstimateHours || 12) / 2)} SP)
                              </span>
                              {issue.dueDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar size={11} className="text-slate-400" />
                                  Due: {issue.dueDate}
                                </span>
                              )}
                              <span>
                                Assignee in Jira: <strong>{issue.assigneeName || 'Lead Account'}</strong>
                              </span>
                            </div>
                          </div>

                          {issue.url && (
                            <a
                              href={issue.url}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 text-slate-400 hover:text-blue-600 transition-colors shrink-0"
                              title="Open ticket in Jira"
                            >
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500">
            {selectedIssueKeys.size > 0 ? (
              <span><strong>{selectedIssueKeys.size}</strong> tickets selected for import</span>
            ) : (
              <span>Select tickets to import into Backlog</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={selectedIssueKeys.size === 0 || !targetProjectId || isLoading}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Download size={14} />
              <span>Import Selected ({selectedIssueKeys.size}) to Backlog</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
