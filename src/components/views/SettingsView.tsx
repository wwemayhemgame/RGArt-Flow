import React, { useState, useEffect } from 'react';
import {
  Settings,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Database,
  ShieldAlert,
  Cloud,
  Trash2,
  Users,
  Mail,
  Server,
  Key,
  Send,
  RefreshCw,
  Eye,
  EyeOff,
  ShieldCheck,
  Zap,
  FolderKanban,
  UserX,
  Search,
  Check,
  Sparkles
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { JiraSettingsSection } from './JiraSettingsSection';
import { Avatar } from '../common/Avatar';
import { FirestoreUsageQuotaCard } from '../admin/FirestoreUsageQuotaCard';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    artists,
    currentUser,
    exportDatabaseJson,
    cleanAllPeopleProjectsTasks,
    loadSampleDemoData,
    wipeAllUsers,
    wipeAllCloudData
  } = useArtOps();

  const [spRatio, setSpRatio] = useState<number>(settings.spToHoursRatio || 2);
  const [productionAllocation, setProductionAllocation] = useState<number>(settings.defaultProductionAllocation || 100);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [aiSettingsSaved, setAiSettingsSaved] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [isWiping, setIsWiping] = useState(false);

  // AI Task Distribution Excluded Users State
  const [excludedArtistIds, setExcludedArtistIds] = useState<string[]>(() => settings.aiExcludedArtistIds || []);
  const [artistSearchQuery, setArtistSearchQuery] = useState('');

  // Sync settings when external changes arrive
  useEffect(() => {
    if (settings.aiExcludedArtistIds) {
      setExcludedArtistIds(settings.aiExcludedArtistIds);
    }
  }, [settings.aiExcludedArtistIds]);

  const toggleExcludedArtist = (artistId: string) => {
    setExcludedArtistIds(prev => {
      if (prev.includes(artistId)) {
        return prev.filter(id => id !== artistId);
      } else {
        return [...prev, artistId];
      }
    });
  };

  const handleSaveAiDistributionSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    updateSettings({
      aiExcludedArtistIds: excludedArtistIds
    });
    setAiSettingsSaved(true);
    setTimeout(() => setAiSettingsSaved(false), 2500);
  };

  // SMTP Configuration State
  const [smtpPreset, setSmtpPreset] = useState<'icewarp' | 'gmail' | 'custom'>('icewarp');
  const [smtpHost, setSmtpHost] = useState('reliancegames.icewarpcloud.in');
  const [smtpPort, setSmtpPort] = useState(465);
  const [smtpUser, setSmtpUser] = useState('ranjeet.patil@zapak.com');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpSecure, setSmtpSecure] = useState(true);
  const [smtpFromName, setSmtpFromName] = useState('RG ArtFlow Studio Security');
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [testTargetEmail, setTestTargetEmail] = useState('ranjeet.patil@zapak.com');

  // SMTP Testing and Status
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpTestingMsg, setSmtpTestingMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [serverSmtpStatus, setServerSmtpStatus] = useState<any>(null);

  // Fetch live SMTP status on load
  const fetchSmtpStatus = async () => {
    try {
      const res = await fetch('/api/auth/smtp-status');
      if (res.ok) {
        const data = await res.json();
        setServerSmtpStatus(data);
        if (data.activeUser && !smtpUser) {
          setSmtpUser(data.activeUser);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch SMTP status:', err);
    }
  };

  useEffect(() => {
    fetchSmtpStatus();
  }, []);

  const handleApplyPreset = (preset: 'icewarp' | 'gmail' | 'custom') => {
    setSmtpPreset(preset);
    if (preset === 'icewarp') {
      setSmtpHost('reliancegames.icewarpcloud.in');
      setSmtpPort(465);
      setSmtpSecure(true);
      if (!smtpUser || smtpUser.includes('gmail')) {
        setSmtpUser('ranjeet.patil@zapak.com');
        setTestTargetEmail('ranjeet.patil@zapak.com');
      }
    } else if (preset === 'gmail') {
      setSmtpHost('smtp.gmail.com');
      setSmtpPort(587);
      setSmtpSecure(false);
    }
  };

  const handleSaveSmtpConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smtpHost || !smtpUser || !smtpPass) {
      setSmtpTestingMsg({ type: 'error', text: 'Please fill in SMTP Host, Username/Email, and Password.' });
      return;
    }
    try {
      setSmtpLoading(true);
      setSmtpTestingMsg(null);

      const res = await fetch('/api/auth/save-smtp-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost,
          port: smtpPort,
          user: smtpUser,
          pass: smtpPass,
          secure: smtpSecure,
          fromName: smtpFromName
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.verifyStatus === 'verified_ready') {
          setSmtpTestingMsg({ type: 'success', text: `SMTP Server (${smtpHost}:${smtpPort}) verified and activated successfully! All password reset codes will now be sent via ${smtpUser}.` });
        } else {
          setSmtpTestingMsg({ type: 'info', text: `SMTP settings saved. Handshake note: ${data.verifyError || 'Verify credentials if deliveries fail.'}` });
        }
        await fetchSmtpStatus();
      } else {
        setSmtpTestingMsg({ type: 'error', text: data.error || 'Failed to save SMTP configuration.' });
      }
    } catch (err: any) {
      setSmtpTestingMsg({ type: 'error', text: err.message || 'Connection error saving SMTP configuration.' });
    } finally {
      setSmtpLoading(false);
    }
  };

  const handleTestSmtpHandshake = async (sendProbeEmail: boolean = false) => {
    try {
      setSmtpLoading(true);
      setSmtpTestingMsg(null);

      const res = await fetch('/api/auth/test-smtp-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost,
          port: smtpPort,
          user: smtpUser,
          pass: smtpPass,
          secure: smtpSecure,
          testTargetEmail: sendProbeEmail ? testTargetEmail : undefined
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (sendProbeEmail && data.emailSent) {
          setSmtpTestingMsg({ type: 'success', text: `Test email successfully dispatched to ${testTargetEmail}! Please check inbox or spam folder.` });
        } else {
          setSmtpTestingMsg({ type: 'success', text: `Connection handshake verified with ${data.host}:${data.port} as ${data.user}!` });
        }
      } else {
        setSmtpTestingMsg({ type: 'error', text: `Connection Test Failed: ${data.error || 'Check hostname, port, and credentials.'}` });
      }
    } catch (err: any) {
      setSmtpTestingMsg({ type: 'error', text: `Test error: ${err.message}` });
    } finally {
      setSmtpLoading(false);
    }
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      spToHoursRatio: spRatio,
      defaultProductionAllocation: productionAllocation
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleExportJson = () => {
    const jsonStr = exportDatabaseJson();
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(jsonStr)}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `rg_artflow_studio_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleWipeAllCloudData = async () => {
    if (confirm('Are you sure you want to wipe all studio data from Firebase Cloud and local storage? This removes all tasks, projects, sprints, requests, and time logs across all connected devices.')) {
      try {
        setIsWiping(true);
        await wipeAllCloudData();
        setNoticeMessage('All cloud database records (Tasks, Projects, Sprints, History) have been completely wiped.');
      } catch (err) {
        console.error('Error wiping data:', err);
        setNoticeMessage('Data wiped from local storage.');
      } finally {
        setIsWiping(false);
        setTimeout(() => setNoticeMessage(null), 5000);
      }
    }
  };

  const handleWipeAllUsers = async () => {
    if (confirm('Are you sure you want to remove all registered users from Firebase? Once removed, the first user to register on any device will become the Studio Administrator.')) {
      try {
        setIsWiping(true);
        await wipeAllUsers();
        setNoticeMessage('All users removed from Firebase. The first new user who registers will be Studio Admin.');
      } catch (err) {
        console.error('Error removing users:', err);
        setNoticeMessage('User collection reset.');
      } finally {
        setIsWiping(false);
        setTimeout(() => setNoticeMessage(null), 5000);
      }
    }
  };

  const handleLoadDemo = () => {
    if (confirm('Load sample demo projects and artist roster?')) {
      loadSampleDemoData();
      setNoticeMessage('Sample demo roster and projects loaded successfully.');
      setTimeout(() => setNoticeMessage(null), 4000);
    }
  };

  return (
    <div id="settings-view" className="p-6 space-y-6 max-w-4xl mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Studio Operations & Mail Configuration</h1>
            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-semibold flex items-center gap-1 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              Firebase Cloud Connected
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Configure custom SMTP mail server (Reliance Games IceWarp / Zapak), estimation ratios, capacity %, and Firebase cloud synchronization.
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>Studio preferences saved successfully.</span>
        </div>
      )}

      {noticeMessage && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{noticeMessage}</span>
        </div>
      )}

      {/* Jira Integration & Proxy Gateway */}
      <JiraSettingsSection />

      {/* SMTP & Mail Server Configuration Card */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
              <Mail size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900">Outbound Mail Server & Sender Configuration (SMTP)</h2>
              <p className="text-[11px] text-zinc-500">
                Configure your IceWarp (Zapak / Reliance Games) or corporate mail server to dispatch verification and password reset codes.
              </p>
            </div>
          </div>

          {serverSmtpStatus && (
            <div className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${
              serverSmtpStatus.configured && serverSmtpStatus.verifyStatus === 'verified_ready'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : serverSmtpStatus.configured
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-zinc-100 text-zinc-600 border-zinc-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                serverSmtpStatus.configured && serverSmtpStatus.verifyStatus === 'verified_ready'
                  ? 'bg-emerald-600 animate-pulse'
                  : serverSmtpStatus.configured
                  ? 'bg-amber-500'
                  : 'bg-zinc-400'
              }`}></span>
              <span>
                {serverSmtpStatus.configured
                  ? `Active: ${serverSmtpStatus.sender || serverSmtpStatus.smtpUser}`
                  : 'No Outbound SMTP Configured'}
              </span>
            </div>
          )}
        </div>

        {/* Preset Selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-zinc-700">Quick Configuration Preset</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => handleApplyPreset('icewarp')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                smtpPreset === 'icewarp'
                  ? 'border-purple-600 bg-purple-50/70 text-purple-950 ring-2 ring-purple-600/20'
                  : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <Zap size={14} className="text-purple-600" />
                  <span>Reliance / Zapak IceWarp</span>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-200/60 font-semibold text-purple-800">Port 465 SSL</span>
              </div>
              <p className="text-[11px] text-zinc-500">reliancegames.icewarpcloud.in</p>
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset('gmail')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                smtpPreset === 'gmail'
                  ? 'border-blue-600 bg-blue-50/70 text-blue-950 ring-2 ring-blue-600/20'
                  : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <Mail size={14} className="text-blue-600" />
                  <span>Google Workspace / Gmail</span>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-200/60 font-semibold text-blue-800">Port 587 TLS</span>
              </div>
              <p className="text-[11px] text-zinc-500">smtp.gmail.com</p>
            </button>

            <button
              type="button"
              onClick={() => handleApplyPreset('custom')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                smtpPreset === 'custom'
                  ? 'border-zinc-800 bg-zinc-100 text-zinc-900 ring-2 ring-zinc-800/20'
                  : 'border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <Server size={14} className="text-zinc-600" />
                  <span>Custom Corporate Host</span>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 font-semibold text-zinc-700">Manual</span>
              </div>
              <p className="text-[11px] text-zinc-500">Custom host and port</p>
            </button>
          </div>
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleSaveSmtpConfig} className="space-y-4 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                SMTP Server Host <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={smtpHost}
                  onChange={e => setSmtpHost(e.target.value)}
                  placeholder="reliancegames.icewarpcloud.in"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:bg-white focus:border-purple-600 outline-hidden font-mono"
                  required
                />
                <Server size={14} className="absolute left-3 top-2.5 text-zinc-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Port & Security <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={smtpPort}
                  onChange={e => {
                    const p = Number(e.target.value);
                    setSmtpPort(p);
                    if (p === 465) setSmtpSecure(true);
                    if (p === 587) setSmtpSecure(false);
                  }}
                  className="w-20 px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:bg-white focus:border-purple-600 outline-hidden font-mono"
                  required
                />
                <label className="flex items-center gap-1.5 text-xs text-zinc-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smtpSecure}
                    onChange={e => setSmtpSecure(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>SSL/TLS</span>
                </label>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Sender Email / Username <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={smtpUser}
                  onChange={e => setSmtpUser(e.target.value)}
                  placeholder="ranjeet.patil@zapak.com"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:bg-white focus:border-purple-600 outline-hidden"
                  required
                />
                <Mail size={14} className="absolute left-3 top-2.5 text-zinc-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Password / App Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showSmtpPass ? 'text' : 'password'}
                  value={smtpPass}
                  onChange={e => setSmtpPass(e.target.value)}
                  placeholder="Enter your account or app password"
                  className="w-full pl-9 pr-10 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:bg-white focus:border-purple-600 outline-hidden"
                  required
                />
                <Key size={14} className="absolute left-3 top-2.5 text-zinc-400" />
                <button
                  type="button"
                  onClick={() => setShowSmtpPass(p => !p)}
                  className="absolute right-3 top-2 text-zinc-400 hover:text-zinc-600 p-0.5 cursor-pointer"
                >
                  {showSmtpPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Sender Display Name
              </label>
              <input
                type="text"
                value={smtpFromName}
                onChange={e => setSmtpFromName(e.target.value)}
                placeholder="RG ArtFlow Studio Security"
                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:bg-white focus:border-purple-600 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Test Target Email Address
              </label>
              <input
                type="email"
                value={testTargetEmail}
                onChange={e => setTestTargetEmail(e.target.value)}
                placeholder="ranjeet.patil@zapak.com"
                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg text-zinc-900 focus:bg-white focus:border-purple-600 outline-hidden"
              />
            </div>
          </div>

          {smtpTestingMsg && (
            <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
              smtpTestingMsg.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : smtpTestingMsg.type === 'error'
                ? 'bg-rose-50 border border-rose-200 text-rose-800'
                : 'bg-blue-50 border border-blue-200 text-blue-800'
            }`}>
              {smtpTestingMsg.type === 'success' ? (
                <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
              ) : smtpTestingMsg.type === 'error' ? (
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-600" />
              ) : (
                <ShieldCheck size={16} className="shrink-0 mt-0.5 text-blue-600" />
              )}
              <span className="leading-relaxed">{smtpTestingMsg.text}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-zinc-100">
            <button
              type="submit"
              disabled={smtpLoading}
              className="px-4 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {smtpLoading ? <RefreshCw size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
              <span>Save & Activate Mail Configuration</span>
            </button>

            <button
              type="button"
              disabled={smtpLoading || !smtpHost || !smtpUser}
              onClick={() => handleTestSmtpHandshake(false)}
              className="px-3.5 py-2 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Server size={13} />
              <span>Test Handshake Connection</span>
            </button>

            <button
              type="button"
              disabled={smtpLoading || !smtpHost || !smtpUser || !testTargetEmail}
              onClick={() => handleTestSmtpHandshake(true)}
              className="px-3.5 py-2 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Send size={13} />
              <span>Send Test Email to {testTargetEmail || 'Target'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Cloud Persistence & Multi-device Status */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Cloud size={18} className="text-blue-600" />
            <h2 className="text-sm font-bold text-zinc-900">Firebase Cloud Synchronization & Multi-Device Access</h2>
          </div>
          <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
            Real-Time Listeners Active
          </span>
        </div>

        <p className="text-xs text-zinc-600 leading-relaxed">
          All studio members, projects, tasks, comments, time tracking entries, and activity history are continuously synchronized with Firebase Cloud Firestore. You can sign in from different browsers, phones, or computers with your verified Office ID or Google account and get instant live access to all studio state.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Users size={14} className="text-slate-600" />
              <span>User & Admin Provisioning</span>
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              When starting fresh with no existing accounts, the <strong>first user</strong> who registers automatically becomes the <strong>Studio Administrator</strong> with full approval and project control privileges.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1.5">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <Database size={14} className="text-slate-600" />
              <span>Cross-Device Live Updates</span>
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Any task status changes, comments, time logging, or sprint assignments update in real-time across all connected client tabs and devices without needing a page refresh.
            </p>
          </div>
        </div>
      </div>

      {/* AI Task Distribution — Excluded Users Section */}
      <div id="ai-task-distribution-settings" className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-zinc-900">AI Task Distribution — Excluded Users</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                  {excludedArtistIds.length} Excluded
                </span>
              </div>
              <p className="text-[11px] text-zinc-500">
                Control which users the AI is allowed to assign tasks to during automatic sprint distribution.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {excludedArtistIds.length > 0 && (
              <button
                type="button"
                onClick={() => setExcludedArtistIds([])}
                className="px-2.5 py-1 text-xs text-zinc-600 hover:text-zinc-900 font-medium cursor-pointer"
              >
                Clear Exclusions
              </button>
            )}
            <button
              type="button"
              id="btn-save-ai-distribution"
              onClick={() => handleSaveAiDistributionSettings()}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Check size={14} />
              <span>Save AI Exclusions</span>
            </button>
          </div>
        </div>

        {aiSettingsSaved && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span>AI Task Distribution settings saved successfully. Excluded users will never receive automatic task assignments.</span>
          </div>
        )}

        {/* Informational Callout */}
        <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs space-y-1 text-amber-900">
          <p className="font-semibold flex items-center gap-1.5">
            <UserX size={14} className="text-amber-700" />
            <span>AI Task Distribution Rules:</span>
          </p>
          <ul className="text-[11px] text-amber-800 space-y-0.5 list-disc pl-4">
            <li><strong>AI must never automatically assign a task</strong> to an excluded user, even if their current workload is low.</li>
            <li><strong>Eligible Pool Formula:</strong> <code className="font-mono bg-amber-100/80 px-1 rounded">Eligible Users = All Available Users − Excluded Users</code></li>
            <li>If all eligible users are unavailable or at capacity, tasks will remain unassigned and flagged as <strong>Needs Assignment</strong>.</li>
            <li><strong>Manual Assignment:</strong> Admins and Project Managers can still manually assign any task to excluded users.</li>
          </ul>
        </div>

        {/* User Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search artists or users to exclude..."
            value={artistSearchQuery}
            onChange={e => setArtistSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-xl text-zinc-900 focus:bg-white focus:border-amber-600 outline-hidden"
          />
          <Search size={14} className="absolute left-3 top-2.5 text-zinc-400" />
        </div>

        {/* Artist Multi-Select List */}
        <div className="border border-zinc-200 rounded-xl overflow-hidden divide-y divide-zinc-100 max-h-72 overflow-y-auto scrollbar-thin">
          {artists
            .filter(a => 
              a.name.toLowerCase().includes(artistSearchQuery.toLowerCase()) ||
              a.role.toLowerCase().includes(artistSearchQuery.toLowerCase()) ||
              (a.email && a.email.toLowerCase().includes(artistSearchQuery.toLowerCase()))
            )
            .map(artist => {
              const isExcluded = excludedArtistIds.includes(artist.id);
              return (
                <div
                  key={artist.id}
                  onClick={() => toggleExcludedArtist(artist.id)}
                  className={`p-3 flex items-center justify-between transition-colors cursor-pointer select-none ${
                    isExcluded ? 'bg-amber-50/60 hover:bg-amber-50' : 'bg-white hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isExcluded}
                      onChange={() => {}} // Handled by container onClick
                      className="w-4 h-4 rounded border-zinc-300 text-amber-600 focus:ring-amber-500 cursor-pointer pointer-events-none"
                    />
                    <Avatar name={artist.name} src={artist.avatar} size="sm" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${isExcluded ? 'text-amber-950 font-bold' : 'text-zinc-900'}`}>
                          {artist.name}
                        </span>
                        {isExcluded && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 font-semibold border border-amber-300">
                            Excluded from AI
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 truncate">
                        {artist.role} • {artist.email || 'No email'} • {artist.weeklyCapacity || 40}h cap
                      </p>
                    </div>
                  </div>

                  <span className={`text-xs font-medium ${isExcluded ? 'text-amber-700' : 'text-zinc-400'}`}>
                    {isExcluded ? 'Excluded' : 'Eligible for AI'}
                  </span>
                </div>
              );
            })}

          {artists.length === 0 && (
            <div className="p-4 text-center text-xs text-zinc-500">
              No artists registered in the studio roster.
            </div>
          )}
        </div>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSavePreferences} className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
          <Sliders size={16} className="text-zinc-700" />
          <h2 className="text-sm font-bold text-zinc-900">Sprint & Capacity Parameters</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Story Point to Hours Ratio (SP = Hours)
            </label>
            <input
              type="number"
              min="1"
              max="16"
              value={spRatio}
              onChange={(e) => setSpRatio(Number(e.target.value))}
              className="w-full text-xs font-bold bg-zinc-50 border border-zinc-300 rounded-lg p-2.5 outline-hidden"
            />
            <p className="text-[11px] text-zinc-400 mt-1">1 Story Point = {spRatio} production hours</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Default Production Allocation %
            </label>
            <input
              type="number"
              min="20"
              max="100"
              value={productionAllocation}
              onChange={(e) => setProductionAllocation(Number(e.target.value))}
              className="w-full text-xs font-bold bg-zinc-50 border border-zinc-300 rounded-lg p-2.5 outline-hidden"
            />
            <p className="text-[11px] text-zinc-400 mt-1">Default time dedicated to pure art creation</p>
          </div>
        </div>

        <button
          type="submit"
          className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg shadow-xs cursor-pointer"
        >
          Save Studio Preferences
        </button>
      </form>

      {/* Firestore Usage & Daily Quota Monitor */}
      <FirestoreUsageQuotaCard />

      {/* Database & Cloud State Management */}
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
          <Database size={16} className="text-zinc-700" />
          <h2 className="text-sm font-bold text-zinc-900">Database Management & Reset Tools</h2>
        </div>

        <p className="text-xs text-zinc-600 leading-relaxed">
          Use the actions below to reset studio collections, wipe users to register a new administrator, or download backup JSON files.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            disabled={isWiping}
            onClick={handleWipeAllCloudData}
            className="px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCcw size={14} />
            <span>Wipe All Cloud Data (Tasks, Projects, History)</span>
          </button>

          <button
            type="button"
            disabled={isWiping}
            onClick={handleWipeAllUsers}
            className="px-3.5 py-2 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Trash2 size={14} />
            <span>Remove All Users (Reset for New Admin)</span>
          </button>

          <button
            type="button"
            onClick={handleLoadDemo}
            className="px-3.5 py-2 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Load Sample Demo Data</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="px-3.5 py-2 text-xs font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Download size={14} />
            <span>Export Database (JSON)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
