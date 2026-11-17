import React, { useState } from 'react';
import {
  FolderKanban,
  Key,
  Mail,
  Server,
  Globe,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Zap,
  HelpCircle,
  Check,
  X,
  Plus,
  Trash2,
  ArrowRight,
  Sparkles,
  Layers,
  Wrench,
  Copy,
  Search,
  Filter
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import {
  JiraIntegrationConfig,
  JiraProjectMapping,
  DEFAULT_JIRA_PROJECT_KEYS,
  JIRA_MIGRATION_PROJECT_KEYS
} from '../../types';

export const JiraSettingsSection: React.FC = () => {
  const {
    settings,
    updateSettings,
    testJiraConnection,
    projects,
    tasks,
    repairJiraTaskProjectMappings,
    updateJiraProjectMappings,
    updateJiraDefaultProjectKeys,
    addAllJiraMigrationProjectKeys,
    removeAllJiraTasks,
    syncAllJiraTasks
  } = useArtOps();

  const existingConfig: Partial<JiraIntegrationConfig> = settings.jiraConfig || {};

  const [hostUrl, setHostUrl] = useState(existingConfig.hostUrl || 'https://reliancegames.atlassian.net');
  const [email, setEmail] = useState(existingConfig.email || 'wwemayhemgame@gmail.com');
  const [apiToken, setApiToken] = useState(existingConfig.apiToken || '');
  const [defaultProjectKeys, setDefaultProjectKeys] = useState(
    existingConfig.defaultProjectKeys && existingConfig.defaultProjectKeys !== 'WWE, ART, MAYHEM'
      ? existingConfig.defaultProjectKeys
      : DEFAULT_JIRA_PROJECT_KEYS
  );
  const [showToken, setShowToken] = useState(false);
  const [autoSyncOnStatusChange, setAutoSyncOnStatusChange] = useState(existingConfig.autoSyncOnStatusChange ?? true);
  const [autoSyncWorklogs, setAutoSyncWorklogs] = useState(existingConfig.autoSyncWorklogs ?? true);
  const [autoPostImagesToJira, setAutoPostImagesToJira] = useState(existingConfig.autoPostImagesToJira ?? true);

  const [copiedKeys, setCopiedKeys] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [showAllChips, setShowAllChips] = useState(false);
  const [hasUnsavedKeys, setHasUnsavedKeys] = useState(false);
  const [isSavingFilter, setIsSavingFilter] = useState(false);

  // Mappings state
  const [mappings, setMappings] = useState<JiraProjectMapping[]>(existingConfig.projectMappings || [
    { jiraProjectKey: 'WWE', studioProjectId: 'proj-wwe', jiraProjectName: 'WWE Mayhem' }
  ]);
  const [newJiraKey, setNewJiraKey] = useState('');
  const [newStudioProjId, setNewStudioProjId] = useState(projects[0]?.id || 'proj-wwe');

  // Action status states
  const [isRealigning, setIsRealigning] = useState(false);
  const [realignResultMsg, setRealignResultMsg] = useState<string | null>(null);
  const [isPurging, setIsPurging] = useState(false);

  // Sync state if settings update from server/cloud
  React.useEffect(() => {
    if (settings.jiraConfig) {
      if (settings.jiraConfig.hostUrl) setHostUrl(settings.jiraConfig.hostUrl);
      if (settings.jiraConfig.email) setEmail(settings.jiraConfig.email);
      if (settings.jiraConfig.apiToken) setApiToken(settings.jiraConfig.apiToken);
      if (settings.jiraConfig.defaultProjectKeys) setDefaultProjectKeys(settings.jiraConfig.defaultProjectKeys);
      if (settings.jiraConfig.autoPostImagesToJira !== undefined) setAutoPostImagesToJira(settings.jiraConfig.autoPostImagesToJira);
      if (settings.jiraConfig.projectMappings) setMappings(settings.jiraConfig.projectMappings);
    }
  }, [settings.jiraConfig]);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    user?: any;
    projects?: any[];
    error?: string;
  } | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const cleanHost = (url: string) => {
    let clean = (url || '').trim();
    if (!clean) return clean;
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `https://${clean}`;
    }
    try {
      const parsed = new URL(clean);
      if (parsed.pathname === '/jira' || parsed.pathname.startsWith('/jira/') || parsed.pathname.startsWith('/browse')) {
        clean = `${parsed.protocol}//${parsed.host}`;
      }
    } catch (e) {}
    return clean.replace(/\/+$/, '');
  };

  const handleTestConnection = async () => {
    const cleanedHost = cleanHost(hostUrl);
    setHostUrl(cleanedHost);

    if (!cleanedHost || !email || !apiToken) {
      setTestResult({ error: 'Please enter Jira Host URL, Email, and API Token before testing.' });
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setSaveSuccessMsg(null);

    const res = await testJiraConnection({
      hostUrl: cleanedHost,
      email: email.trim(),
      apiToken: apiToken.trim(),
      defaultProjectKeys: defaultProjectKeys.trim(),
      autoSyncOnStatusChange,
      autoSyncWorklogs
    });

    setIsTesting(false);
    setTestResult(res);
  };

  const handleAddMapping = () => {
    const trimmedKey = newJiraKey.trim().toUpperCase();
    if (!trimmedKey || !newStudioProjId) return;

    if (mappings.some(m => m.jiraProjectKey.toUpperCase() === trimmedKey)) {
      setRealignResultMsg(`Mapping for Jira key "${trimmedKey}" already exists.`);
      setTimeout(() => setRealignResultMsg(null), 3000);
      return;
    }

    const targetStudioProject = projects.find(p => p.id === newStudioProjId);
    const updated = [
      ...mappings,
      {
        jiraProjectKey: trimmedKey,
        studioProjectId: newStudioProjId,
        jiraProjectName: targetStudioProject ? targetStudioProject.name : undefined
      }
    ];

    setMappings(updated);
    updateJiraProjectMappings(updated);
    setNewJiraKey('');
    setSaveSuccessMsg(`Added project mapping: ${trimmedKey} → ${targetStudioProject?.name || newStudioProjId}`);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  const handleRemoveMapping = (jiraKey: string) => {
    const updated = mappings.filter(m => m.jiraProjectKey.toUpperCase() !== jiraKey.toUpperCase());
    setMappings(updated);
    updateJiraProjectMappings(updated);
  };

  const handleAutoMapAllProjects = () => {
    const autoMapList: JiraProjectMapping[] = [...mappings];

    // Check WWE Mayhem
    const wweStudioProj = projects.find(p => p.id === 'proj-wwe' || p.key.toUpperCase() === 'WWE' || p.name.toLowerCase().includes('wwe'));
    if (wweStudioProj && !autoMapList.some(m => m.jiraProjectKey === 'WWE')) {
      autoMapList.push({ jiraProjectKey: 'WWE', studioProjectId: wweStudioProj.id, jiraProjectName: wweStudioProj.name });
    }

    // Check ART
    const artStudioProj = projects.find(p => p.key.toUpperCase() === 'ART' || p.id === 'proj-art' || p.name.toLowerCase().includes('marketing') || p.name.toLowerCase().includes('production'));
    if (artStudioProj && !autoMapList.some(m => m.jiraProjectKey === 'ART')) {
      autoMapList.push({ jiraProjectKey: 'ART', studioProjectId: artStudioProj.id, jiraProjectName: artStudioProj.name });
    }

    // Check other studio projects
    projects.forEach(proj => {
      const key = proj.key.toUpperCase();
      if (key !== 'HRAD' && !autoMapList.some(m => m.jiraProjectKey === key)) {
        autoMapList.push({ jiraProjectKey: key, studioProjectId: proj.id, jiraProjectName: proj.name });
      }
    });

    // Also map any of the 125 migration project keys that match studio projects
    JIRA_MIGRATION_PROJECT_KEYS.forEach(key => {
      if (!autoMapList.some(m => m.jiraProjectKey === key)) {
        const matchingStudioProj = projects.find(p =>
          p.key.toUpperCase() === key ||
          p.name.toUpperCase().includes(key) ||
          (key.includes('CRIC') && p.name.toLowerCase().includes('cricket')) ||
          (key.includes('WWE') && p.name.toLowerCase().includes('wwe')) ||
          (key.includes('ART') && (p.name.toLowerCase().includes('art') || p.name.toLowerCase().includes('marketing')))
        );
        if (matchingStudioProj) {
          autoMapList.push({
            jiraProjectKey: key,
            studioProjectId: matchingStudioProj.id,
            jiraProjectName: matchingStudioProj.name
          });
        }
      }
    });

    setMappings(autoMapList);
    updateJiraProjectMappings(autoMapList);
    setSaveSuccessMsg(`Auto-mapped ${autoMapList.length} projects successfully.`);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  const handleSaveDefaultProjectKeys = (keysToSave?: string) => {
    const rawKeys = (keysToSave !== undefined ? keysToSave : defaultProjectKeys).trim();
    const finalKeys = rawKeys.length > 0 ? rawKeys : DEFAULT_JIRA_PROJECT_KEYS;
    setDefaultProjectKeys(finalKeys);
    setHasUnsavedKeys(false);
    setIsSavingFilter(true);

    const newConfig: JiraIntegrationConfig = {
      ...(settings.jiraConfig || { hostUrl: '', email: '', apiToken: '' }),
      hostUrl: cleanHost(hostUrl),
      email: email.trim(),
      apiToken: apiToken.trim(),
      defaultProjectKeys: finalKeys,
      projectMappings: mappings,
      autoSyncOnStatusChange,
      autoSyncWorklogs,
      autoPostImagesToJira,
      connectionStatus: testResult?.success ? 'connected' : (existingConfig.connectionStatus || 'disconnected'),
      lastConnectedAt: testResult?.success ? new Date().toISOString() : existingConfig.lastConnectedAt
    };

    updateSettings({ jiraConfig: newConfig });
    setTimeout(() => {
      setIsSavingFilter(false);
      setSaveSuccessMsg('Default Project Keys Filter saved and synced with server.');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    }, 250);
  };

  const handleRestoreAll125MigrationProjects = () => {
    setDefaultProjectKeys(DEFAULT_JIRA_PROJECT_KEYS);
    handleSaveDefaultProjectKeys(DEFAULT_JIRA_PROJECT_KEYS);
  };

  const handleAppendMissingMigrationProjects = () => {
    const currentList = defaultProjectKeys.split(',').map(k => k.trim().toUpperCase()).filter(Boolean);
    const keySet = new Set(currentList);
    let addedCount = 0;
    JIRA_MIGRATION_PROJECT_KEYS.forEach(k => {
      if (!keySet.has(k)) {
        keySet.add(k);
        addedCount++;
      }
    });
    const merged = Array.from(keySet).join(', ');
    setDefaultProjectKeys(merged);
    handleSaveDefaultProjectKeys(merged);
    setSaveSuccessMsg(`Appended ${addedCount} missing project keys to filter and saved.`);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
  };

  const handleCopyKeys = () => {
    navigator.clipboard?.writeText(defaultProjectKeys);
    setCopiedKeys(true);
    setTimeout(() => setCopiedKeys(false), 2000);
  };

  const parsedKeysList = defaultProjectKeys.split(',').map(k => k.trim().toUpperCase()).filter(Boolean);
  const parsedKeysSet = new Set(parsedKeysList);
  const missingMigrationKeys = JIRA_MIGRATION_PROJECT_KEYS.filter(k => !parsedKeysSet.has(k));

  const handleToggleKey = (key: string) => {
    let updatedList: string[];
    if (parsedKeysSet.has(key)) {
      updatedList = parsedKeysList.filter(k => k !== key);
    } else {
      updatedList = [...parsedKeysList, key];
    }
    const updatedStr = updatedList.join(', ');
    setDefaultProjectKeys(updatedStr);
    handleSaveDefaultProjectKeys(updatedStr);
  };

  const handleRealignTasks = async () => {
    setIsRealigning(true);
    setRealignResultMsg(null);
    try {
      const res = await repairJiraTaskProjectMappings();
      setRealignResultMsg(`Realignment completed: ${res.repairedCount} task(s) updated to their exact Studio projects.`);
    } catch (e: any) {
      setRealignResultMsg(`Error during realignment: ${e.message}`);
    } finally {
      setIsRealigning(false);
      setTimeout(() => setRealignResultMsg(null), 5000);
    }
  };

  const handlePurgeAllJiraTasks = async () => {
    if (!window.confirm('Are you sure you want to remove all Jira-imported tasks? You can re-import them with correct project mappings at any time.')) {
      return;
    }
    setIsPurging(true);
    try {
      const count = await removeAllJiraTasks();
      setSaveSuccessMsg(`Purged ${count} Jira tasks. Ready for fresh import.`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } finally {
      setIsPurging(false);
    }
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();

    const cleanedHost = cleanHost(hostUrl);
    setHostUrl(cleanedHost);

    const newConfig: JiraIntegrationConfig = {
      hostUrl: cleanedHost,
      email: email.trim(),
      apiToken: apiToken.trim(),
      defaultProjectKeys: defaultProjectKeys.trim(),
      autoSyncOnStatusChange,
      autoSyncWorklogs,
      autoPostImagesToJira,
      projectMappings: mappings,
      connectionStatus: testResult?.success ? 'connected' : (existingConfig.connectionStatus || 'disconnected'),
      lastConnectedAt: testResult?.success ? new Date().toISOString() : existingConfig.lastConnectedAt
    };

    updateSettings({
      jiraConfig: newConfig
    });

    setSaveSuccessMsg('Jira integration credentials and project mappings saved successfully.');
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  const isConnected = existingConfig.connectionStatus === 'connected';

  // Count Jira tasks and misaligned tasks
  const jiraTasks = tasks.filter(t => t.isJiraImported || t.jiraIssueKey);
  const wweTasksOnHr = jiraTasks.filter(t => {
    const key = t.jiraProjectKey || t.jiraIssueKey?.split('-')[0];
    return key?.toUpperCase() === 'WWE' && (t.projectId === 'proj-hrad' || t.projectId === 'HRAD');
  });

  return (
    <div id="jira-settings-card" className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-6">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
            <FolderKanban size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-zinc-900">Jira Integration & Lead Proxy Sync</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                Single-Seat Proxy
              </span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Synchronize assigned Jira art tickets into Backlog and sync artist work logs / status transitions back to Jira under your lead seat.
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border shrink-0 ${
          isConnected
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : existingConfig.connectionStatus === 'error'
            ? 'bg-red-50 text-red-800 border-red-200'
            : 'bg-zinc-100 text-zinc-600 border-zinc-200'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            isConnected
              ? 'bg-emerald-600 animate-pulse'
              : existingConfig.connectionStatus === 'error'
              ? 'bg-red-500'
              : 'bg-zinc-400'
          }`}></span>
          <span>
            {isConnected
              ? `Connected (${existingConfig.email})`
              : existingConfig.connectionStatus === 'error'
              ? 'Connection Error'
              : 'Not Connected'}
          </span>
        </div>
      </div>

      {/* How it works info banner */}
      <div className="p-3.5 bg-blue-50/70 border border-blue-200/90 rounded-xl space-y-2 text-xs text-blue-900">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="font-bold flex items-center gap-1.5 text-blue-950 text-xs">
            <Zap size={14} className="text-blue-600" />
            <span>App-Level Studio Connection (Shared for All Users & Devices)</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 font-semibold border border-blue-300">
            No per-user login needed
          </span>
        </div>
        <ul className="list-disc list-inside space-y-1 text-[11px] text-blue-800/90 pl-1">
          <li><strong>Studio-Wide Proxy:</strong> You connect once for the whole application. All artists logging time or moving tickets from any browser/mobile device will sync directly to Jira without needing their own Jira credentials.</li>
          <li><strong>Real-time Cloud Sync:</strong> Saved settings automatically replicate via Firestore and the studio server across all sessions.</li>
          <li><strong>Strict Project Mapping:</strong> Jira tickets from projects like <strong>WWE (WWE Mayhem)</strong> automatically route to their dedicated Studio project, never defaulting to HR/Admin.</li>
        </ul>
      </div>

      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {realignResultMsg && (
        <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="text-blue-600" />
          <span>{realignResultMsg}</span>
        </div>
      )}

      {/* Test Connection Results */}
      {testResult && (
        <div className={`p-4 rounded-xl border text-xs space-y-2.5 ${
          testResult.success
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-red-50 border-red-200 text-red-900'
        }`}>
          <div className="flex items-center gap-2 font-bold">
            {testResult.success ? (
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle size={18} className="text-red-600 shrink-0" />
            )}
            <span className="text-sm">
              {testResult.success
                ? `Connection successful! Authenticated as ${testResult.user?.displayName} (${testResult.user?.emailAddress}).`
                : 'Authentication failed (401 Unauthorized)'}
            </span>
          </div>

          {testResult.success && testResult.projects && testResult.projects.length > 0 && (
            <div className="text-xs text-emerald-800 pt-1 space-y-1.5">
              <div>
                Found {testResult.projects.length} accessible projects:{' '}
                <strong className="text-emerald-950">
                  {testResult.projects.map(p => `${p.name} [${p.key}]`).join(', ')}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => {
                  const allKeys = testResult.projects!.map(p => p.key).join(', ');
                  setDefaultProjectKeys(allKeys);
                }}
                className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer"
              >
                Use All Discovered Projects for Sync ({testResult.projects.map(p => p.key).join(', ')})
              </button>
            </div>
          )}

          {testResult.error && (
            <div className="space-y-2">
              <p className="text-[11px] text-red-700 font-mono bg-red-100/60 p-2.5 rounded-lg border border-red-200">
                {testResult.error}
              </p>

              {/* Troubleshooting steps for 401 */}
              <div className="p-3 bg-white/80 rounded-lg border border-red-200 text-slate-800 space-y-1.5 text-[11px]">
                <strong className="text-red-900 block font-bold">Why did Jira return 401 Unauthorized?</strong>
                <ol className="list-decimal list-inside space-y-1 text-slate-700 pl-0.5">
                  <li>
                    <strong>Email mismatch:</strong> The email in the box below must be the <em>exact Atlassian account email</em> you were logged in with when you created the API token on Atlassian. (For example, if you created the token under <code>wwemayhemgame@gmail.com</code> or another account, enter that exact email).
                  </li>
                  <li>
                    <strong>API Token vs Account Password:</strong> You must paste an <em>API token</em> generated at{' '}
                    <a
                      href="https://id.atlassian.com/manage-profile/security/api-tokens"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline font-semibold inline-flex items-center gap-0.5"
                    >
                      <span>id.atlassian.com/manage-profile/security/api-tokens</span>
                      <ExternalLink size={10} />
                    </a>
                    , <strong>not</strong> your regular account login password.
                  </li>
                  <li>
                    <strong>Host URL format:</strong> Ensure the Host URL is formatted as <code>https://reliancegames.atlassian.net</code>.
                  </li>
                </ol>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Configuration Form */}
      <form onSubmit={handleSaveConfig} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Atlassian / Jira Host URL <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="url"
                value={hostUrl}
                onChange={(e) => setHostUrl(e.target.value)}
                onBlur={() => setHostUrl(cleanHost(hostUrl))}
                placeholder="https://reliancegames.atlassian.net"
                required
                className="w-full text-xs font-medium pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg outline-hidden focus:bg-white focus:border-blue-500"
              />
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">e.g. https://your-company.atlassian.net</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Jira Account Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="wwemayhemgame@gmail.com"
                required
                className="w-full text-xs font-medium pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg outline-hidden focus:bg-white focus:border-blue-500"
              />
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">The email address of your Jira Lead seat</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-zinc-700">
                Atlassian API Token <span className="text-red-500">*</span>
              </label>
              <a
                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-blue-600 hover:underline flex items-center gap-1"
              >
                <span>Generate API Token</span>
                <ExternalLink size={10} />
              </a>
            </div>
            <div className="relative">
              <Key size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type={showToken ? 'text' : 'password'}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Paste Atlassian API Token"
                required
                className="w-full text-xs font-mono pl-9 pr-16 py-2 bg-zinc-50 border border-zinc-300 rounded-lg outline-hidden focus:bg-white focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-800 font-semibold cursor-pointer"
              >
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">Tokens are stored securely in local browser state and server proxy.</p>
          </div>

          <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Filter size={15} className="text-blue-600" />
                <label className="text-xs font-bold text-zinc-900">
                  Default Project Keys Filter (Jira Migration Projects)
                </label>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  {parsedKeysList.length} Active
                </span>
                {missingMigrationKeys.length === 0 ? (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <Check size={10} />
                    All 125 Projects Active
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                    ⚠️ {missingMigrationKeys.length} Missing from 125 List
                  </span>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {missingMigrationKeys.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAppendMissingMigrationProjects}
                    className="px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                    title="Append missing keys from the 125 list without removing existing keys"
                  >
                    + Append Missing ({missingMigrationKeys.length})
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleRestoreAll125MigrationProjects}
                  className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                  title="Reset filter to all 125 standard Jira migration project keys"
                >
                  Restore All 125 Projects
                </button>

                <button
                  type="button"
                  onClick={handleCopyKeys}
                  className="px-2.5 py-1 text-[11px] font-semibold text-zinc-700 bg-white hover:bg-zinc-100 border border-zinc-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  title="Copy keys to clipboard"
                >
                  <Copy size={11} />
                  <span>{copiedKeys ? 'Copied!' : 'Copy Keys'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveDefaultProjectKeys()}
                  disabled={isSavingFilter}
                  className="px-3 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 border border-emerald-600 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                >
                  <Check size={11} />
                  <span>{isSavingFilter ? 'Saving...' : 'Save Filter'}</span>
                </button>
              </div>
            </div>

            {/* Keys Textarea */}
            <div>
              <textarea
                value={defaultProjectKeys}
                onChange={(e) => {
                  setDefaultProjectKeys(e.target.value);
                  setHasUnsavedKeys(true);
                }}
                onBlur={() => handleSaveDefaultProjectKeys()}
                rows={3}
                placeholder="Comma-separated project keys (e.g. CRXG, CH, AS, CRICK83...)"
                className="w-full text-xs font-mono font-medium px-3 py-2 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 leading-relaxed resize-y"
              />
              <div className="flex items-center justify-between mt-1 text-[10px] text-zinc-500">
                <span>
                  Auto-saves on blur or when clicking "Save Filter". Persisted to local disk & server storage.
                </span>
                {hasUnsavedKeys && (
                  <span className="text-amber-600 font-bold animate-pulse">
                    ● Unsaved changes in filter
                  </span>
                )}
              </div>
            </div>

            {/* Project Keys Explorer toggle */}
            <div className="pt-2 border-t border-zinc-200/70">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowAllChips(!showAllChips)}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>{showAllChips ? 'Hide Project Keys Cloud' : 'Explore & Toggle 125 Migration Project Keys'}</span>
                  <span className="text-zinc-400">({showAllChips ? '▲' : '▼'})</span>
                </button>

                {showAllChips && (
                  <div className="relative w-48">
                    <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      placeholder="Search 125 keys..."
                      className="w-full text-[10px] pl-6 pr-2 py-1 bg-white border border-zinc-200 rounded-md outline-hidden focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              {showAllChips && (
                <div className="mt-2.5 max-h-48 overflow-y-auto p-2 bg-white rounded-lg border border-zinc-200 flex flex-wrap gap-1">
                  {JIRA_MIGRATION_PROJECT_KEYS
                    .filter(k => !filterSearch.trim() || k.toLowerCase().includes(filterSearch.trim().toLowerCase()))
                    .map(key => {
                      const isActive = parsedKeysSet.has(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleToggleKey(key)}
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                            isActive
                              ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
                              : 'bg-zinc-50 text-zinc-400 border border-dashed border-zinc-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300'
                          }`}
                          title={isActive ? `Remove ${key} from filter` : `Add ${key} to filter`}
                        >
                          <span>{key}</span>
                          {isActive ? <X size={9} /> : <Plus size={9} />}
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sync Behaviors */}
        <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
          <span className="text-xs font-bold text-zinc-800 block">Automatic Synchronization Behaviors</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSyncOnStatusChange}
                onChange={(e) => setAutoSyncOnStatusChange(e.target.checked)}
                className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-zinc-700 font-medium">Sync status transitions (To Do, In Progress, Done)</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSyncWorklogs}
                onChange={(e) => setAutoSyncWorklogs(e.target.checked)}
                className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-zinc-700 font-medium">Auto-push artist work logs to Jira ticket</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoPostImagesToJira}
                onChange={(e) => setAutoPostImagesToJira(e.target.checked)}
                className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-zinc-700 font-medium">Auto-post attached images & media to Jira ticket</span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !hostUrl || !email || !apiToken}
            className="px-4 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 border border-blue-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw size={13} className={isTesting ? 'animate-spin' : ''} />
            <span>{isTesting ? 'Testing Handshake...' : 'Test Connection & List Projects'}</span>
          </button>

          <button
            type="submit"
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            Save Jira Credentials
          </button>
        </div>
      </form>

      {/* Jira ↔ Studio Project Mappings Section */}
      <div className="pt-4 border-t border-zinc-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
              <Layers size={15} className="text-blue-600" />
              <span>Jira ↔ Studio Project Mappings</span>
            </h3>
            <p className="text-[11px] text-zinc-500">
              Configure how Jira project keys map to Studio projects. Prevents misallocations to HR/Admin.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAutoMapAllProjects}
              className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Sparkles size={13} />
              <span>Auto-Detect Mappings</span>
            </button>

            <button
              type="button"
              onClick={handleRealignTasks}
              disabled={isRealigning}
              className="px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Wrench size={13} className={isRealigning ? 'animate-spin' : ''} />
              <span>{isRealigning ? 'Re-aligning Tasks...' : 'Re-align All Existing Tasks'}</span>
            </button>
          </div>
        </div>

        {/* Existing Mappings List */}
        <div className="bg-zinc-50 border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-200">
          <div className="grid grid-cols-12 px-3.5 py-2 text-[11px] font-bold text-zinc-500 bg-zinc-100/70">
            <div className="col-span-4">Jira Project Key / Prefix</div>
            <div className="col-span-1 text-center"></div>
            <div className="col-span-6">Destination Studio Project</div>
            <div className="col-span-1 text-right">Action</div>
          </div>

          {mappings.length === 0 ? (
            <div className="p-4 text-center text-xs text-zinc-400">
              No project mappings configured. Studio will automatically create or match projects by key.
            </div>
          ) : (
            mappings.map((m) => {
              const matchedProj = projects.find(p => p.id === m.studioProjectId);
              return (
                <div key={m.jiraProjectKey} className="grid grid-cols-12 px-3.5 py-2.5 items-center text-xs">
                  <div className="col-span-4 font-mono font-bold text-blue-700 flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                      {m.jiraProjectKey}
                    </span>
                    {m.jiraProjectName && (
                      <span className="text-[11px] font-normal text-zinc-500 hidden sm:inline">
                        ({m.jiraProjectName})
                      </span>
                    )}
                  </div>
                  <div className="col-span-1 text-center text-zinc-400">
                    <ArrowRight size={14} className="mx-auto" />
                  </div>
                  <div className="col-span-6 font-semibold text-zinc-800">
                    {matchedProj ? (
                      <div className="flex items-center gap-1.5">
                        <span>{matchedProj.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 bg-zinc-200 text-zinc-700 rounded">
                          {matchedProj.key}
                        </span>
                      </div>
                    ) : (
                      <span className="text-amber-600 font-normal">Project ID: {m.studioProjectId} (Not found)</span>
                    )}
                  </div>
                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveMapping(m.jiraProjectKey)}
                      className="p-1 text-zinc-400 hover:text-red-600 transition-colors cursor-pointer"
                      title="Remove mapping"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Add New Mapping Form */}
        <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2">
          <span className="text-[11px] font-bold text-zinc-700 block">Add Custom Jira ↔ Studio Mapping</span>
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <div className="w-full sm:w-1/3">
              <input
                type="text"
                list="jira-migration-keys-list"
                value={newJiraKey}
                onChange={(e) => setNewJiraKey(e.target.value.toUpperCase())}
                placeholder="Jira Key (e.g. WWE)"
                className="w-full text-xs font-mono font-bold uppercase px-3 py-1.5 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500"
              />
              <datalist id="jira-migration-keys-list">
                {JIRA_MIGRATION_PROJECT_KEYS.map(key => (
                  <option key={key} value={key} />
                ))}
              </datalist>
            </div>
            <span className="text-zinc-400 hidden sm:inline">→</span>
            <div className="w-full sm:w-1/2">
              <select
                value={newStudioProjId}
                onChange={(e) => setNewStudioProjId(e.target.value)}
                className="w-full text-xs font-semibold px-3 py-1.5 bg-white border border-zinc-300 rounded-lg outline-hidden focus:border-blue-500 cursor-pointer"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} [{p.key}]</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleAddMapping}
              disabled={!newJiraKey.trim()}
              className="w-full sm:w-auto px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer shrink-0"
            >
              <Plus size={13} />
              <span>Add Mapping</span>
            </button>
          </div>
        </div>

        {/* Maintenance / Clean Sync Controls */}
        <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-zinc-800">Clean Re-Import / Reset Jira Tasks</div>
            <div className="text-[11px] text-zinc-500">
              {jiraTasks.length} Jira task(s) currently in Studio. Purging allows a completely fresh synchronization with new project mappings.
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePurgeAllJiraTasks}
              disabled={isPurging || jiraTasks.length === 0}
              className="px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 border border-red-200 rounded-lg transition-colors cursor-pointer"
            >
              {isPurging ? 'Purging Tasks...' : `Purge All Jira Tasks (${jiraTasks.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

