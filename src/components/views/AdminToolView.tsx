import React, { useState } from 'react';
import {
  ShieldAlert,
  Users,
  FolderKanban,
  UserPlus,
  FolderPlus,
  Trash2,
  Edit,
  RotateCcw,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Search,
  Sliders,
  Sparkles,
  Layers,
  FileText,
  UserCheck,
  Shield,
  Activity,
  ArrowRight,
  Database,
  KeyRound
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { User, UserRole, Project, ProjectStatus, ProjectType } from '../../types';
import { RoleBadge, PriorityBadge } from '../common/Badge';
import { Avatar } from '../common/Avatar';
import { formatDate } from '../../utils/dateUtils';
import { getArtistEffectiveWeeklyCapacity } from '../../utils/forecastEngine';
import { DatabaseHealthManager } from '../admin/DatabaseHealthManager';

interface AdminToolViewProps {
  onOpenAddPerson: () => void;
  onOpenCreateProject: () => void;
  onEditArtist: (artistId: string) => void;
  onEditProject: (projectId: string) => void;
  onManageProjectAccess: (projectId: string) => void;
}

export const AdminToolView: React.FC<AdminToolViewProps> = ({
  onOpenAddPerson,
  onOpenCreateProject,
  onEditArtist,
  onEditProject,
  onManageProjectAccess
}) => {
  const {
    currentUser,
    setCurrentUser,
    users,
    deleteUser,
    artists,
    deleteArtist,
    projects,
    deleteProject,
    tasks,
    requests,
    settings,
    updateSettings,
    cleanAllPeopleProjectsTasks,
    loadSampleDemoData,
    exportDatabaseJson,
    importDatabaseJson
  } = useArtOps();

  const [activeTab, setActiveTab] = useState<'people' | 'projects' | 'system' | 'database-health'>('people');
  const [peopleSearch, setPeopleSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [projectSearch, setProjectSearch] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState<string>('ALL');

  const [confirmWipeOpen, setConfirmWipeOpen] = useState(false);
  const [confirmDemoOpen, setConfirmDemoOpen] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Filtered Users
  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.name.toLowerCase().includes(peopleSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(peopleSearch.toLowerCase()) ||
      user.title.toLowerCase().includes(peopleSearch.toLowerCase()) ||
      user.department.toLowerCase().includes(peopleSearch.toLowerCase());

    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Filtered Projects
  const filteredProjects = projects.filter(proj => {
    const matchesSearch =
      proj.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
      proj.key.toLowerCase().includes(projectSearch.toLowerCase()) ||
      (proj.description && proj.description.toLowerCase().includes(projectSearch.toLowerCase()));

    const matchesStatus = projectStatusFilter === 'ALL' || proj.status === projectStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleWipeData = () => {
    cleanAllPeopleProjectsTasks();
    setConfirmWipeOpen(false);
    setActionSuccess('All People, Projects, Tasks, and Sprints have been cleanly wiped.');
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const handleLoadDemo = () => {
    loadSampleDemoData();
    setConfirmDemoOpen(false);
    setActionSuccess('Sample demo roster and projects loaded successfully.');
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const handleDeleteUser = (user: User) => {
    if (confirm(`Are you sure you want to remove ${user.name} from the studio?`)) {
      deleteUser(user.id);
      setActionSuccess(`User ${user.name} removed.`);
      setTimeout(() => setActionSuccess(null), 3000);
    }
  };

  const handleDeleteProject = (proj: Project) => {
    if (confirm(`Are you sure you want to delete project ${proj.name} (${proj.key}) and its tasks?`)) {
      deleteProject(proj.id);
      setActionSuccess(`Project ${proj.name} deleted.`);
      setTimeout(() => setActionSuccess(null), 3000);
    }
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

  return (
    <div id="admin-tool-view" className="p-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-700 rounded-xl border border-amber-500/20">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Studio Admin Tool</h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                Centralized administration hub for managing People, Artists, Projects, Access, and Database State.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenAddPerson}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <UserPlus size={14} />
            <span>+ Add Person</span>
          </button>

          <button
            type="button"
            onClick={onOpenCreateProject}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <FolderPlus size={14} />
            <span>+ Add Project</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmWipeOpen(true)}
            className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
            title="Clean all People, Projects, Tasks and start completely fresh"
          >
            <Trash2 size={14} />
            <span>Clean All Data</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-semibold">Studio Team</span>
            <Users size={16} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-zinc-900">{users.length}</div>
          <p className="text-[11px] text-zinc-400 mt-1">{artists.length} active artists</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-semibold">Projects</span>
            <FolderKanban size={16} className="text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-zinc-900">{projects.length}</div>
          <p className="text-[11px] text-zinc-400 mt-1">
            {projects.filter(p => p.status === 'Active').length} active projects
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-semibold">Production Tasks</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-zinc-900">{tasks.length}</div>
          <p className="text-[11px] text-zinc-400 mt-1">
            {tasks.filter(t => t.status === 'IN_PROGRESS').length} in progress
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-2xs">
          <div className="flex items-center justify-between text-zinc-500 mb-1">
            <span className="text-xs font-semibold">Company Requests</span>
            <FileText size={16} className="text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-zinc-900">{requests.length}</div>
          <p className="text-[11px] text-zinc-400 mt-1">
            {requests.filter(r => r.status === 'NEW').length} new requests
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('people')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'people'
              ? 'bg-zinc-900 text-white shadow-xs'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
          }`}
        >
          <Users size={14} />
          <span>People & Artists Hub ({users.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('projects')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'projects'
              ? 'bg-zinc-900 text-white shadow-xs'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
          }`}
        >
          <FolderKanban size={14} />
          <span>Projects Hub ({projects.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('system')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'system'
              ? 'bg-zinc-900 text-white shadow-xs'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
          }`}
        >
          <Database size={14} />
          <span>Database & Studio Tools</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('database-health')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'database-health'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
          }`}
        >
          <Activity size={14} />
          <span>Database Health & Storage</span>
        </button>
      </div>

      {/* TAB 1: PEOPLE & ARTISTS */}
      {activeTab === 'people' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-2xs">
            <div className="flex items-center gap-2 flex-1 max-w-md bg-zinc-50 px-3 py-2 rounded-xl border border-zinc-200 focus-within:bg-white focus-within:border-zinc-300">
              <Search size={14} className="text-zinc-400" />
              <input
                type="text"
                value={peopleSearch}
                onChange={(e) => setPeopleSearch(e.target.value)}
                placeholder="Search team members by name, email, department, title..."
                className="w-full text-xs text-zinc-900 outline-hidden bg-transparent"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              {['ALL', 'ADMIN', 'ART_DIRECTOR', 'ART_MANAGER', 'ARTIST', 'COMPANY_REQUESTER'].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    roleFilter === r
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {r === 'ALL' ? 'All Roles' : r.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Users Table / Grid */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xs overflow-hidden">
            {filteredUsers.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
                  <Users size={24} />
                </div>
                <h3 className="text-sm font-bold text-zinc-800">No team members match your filter</h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  Click "+ Add Person" to create your first artist, manager, director, or requester.
                </p>
                <button
                  type="button"
                  onClick={onOpenAddPerson}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <UserPlus size={14} />
                  <span>Add First Person</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 text-zinc-500 font-semibold border-b border-zinc-200 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Member / Profile</th>
                      <th className="py-3 px-4">System Role</th>
                      <th className="py-3 px-4">Department & Title</th>
                      <th className="py-3 px-4">Artist Capacity</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-zinc-700">
                    {filteredUsers.map((user) => {
                      const linkedArtist = artists.find(a => (user.id && a.userId === user.id) || (user.artistId && a.id === user.artistId));
                      const isCurrent = currentUser?.id === user.id;

                      return (
                        <tr key={user.id} className="hover:bg-zinc-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <Avatar src={user.avatar} name={user.name} size="sm" />
                              <div>
                                <div className="font-bold text-zinc-900 flex items-center gap-1.5">
                                  <span>{user.name}</span>
                                  {isCurrent && (
                                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-zinc-400">{user.email}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <RoleBadge role={user.role} />
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-medium text-zinc-800">{user.title}</div>
                            <div className="text-[11px] text-zinc-400">{user.department}</div>
                          </td>

                          <td className="py-3 px-4">
                            {linkedArtist ? (
                              <div>
                                <span className="font-bold text-indigo-700">
                                  {linkedArtist.dailyCapacity}h/day ({getArtistEffectiveWeeklyCapacity(linkedArtist)}h prod/wk)
                                </span>
                                <div className="text-[11px] text-zinc-500 truncate max-w-[180px]">
                                  {linkedArtist.role}
                                </div>
                              </div>
                            ) : (
                              <span className="text-zinc-400 italic">Non-artist account</span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {linkedArtist && linkedArtist.id && (
                                <button
                                  type="button"
                                  onClick={() => onEditArtist(linkedArtist.id)}
                                  className="p-1.5 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Artist Skills & Capacity"
                                >
                                  <Edit size={14} />
                                </button>
                              )}

                              {users.length > 1 && !isCurrent && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(user)}
                                  className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Remove user"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PROJECTS HUB */}
      {activeTab === 'projects' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-zinc-200 shadow-2xs">
            <div className="flex items-center gap-2 flex-1 max-w-md bg-zinc-50 px-3 py-2 rounded-xl border border-zinc-200 focus-within:bg-white focus-within:border-zinc-300">
              <Search size={14} className="text-zinc-400" />
              <input
                type="text"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Search projects by name, key, description..."
                className="w-full text-xs text-zinc-900 outline-hidden bg-transparent"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto">
              {['ALL', 'Active', 'Paused', 'Completed', 'Archived'].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setProjectStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    projectStatusFilter === s
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {s === 'ALL' ? 'All Statuses' : s}
                </button>
              ))}
            </div>
          </div>

          {/* Projects Table */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xs overflow-hidden">
            {filteredProjects.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
                  <FolderKanban size={24} />
                </div>
                <h3 className="text-sm font-bold text-zinc-800">No projects found</h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto">
                  Get started by creating your first game title, marketing campaign, or liveops project.
                </p>
                <button
                  type="button"
                  onClick={onOpenCreateProject}
                  className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <FolderPlus size={14} />
                  <span>Create First Project</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 text-zinc-500 font-semibold border-b border-zinc-200 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Project</th>
                      <th className="py-3 px-4">Type & Priority</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Leadership</th>
                      <th className="py-3 px-4">Tasks</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-zinc-700">
                    {filteredProjects.map((proj) => {
                      const projTasks = tasks.filter(t => t.projectId === proj.id);
                      const artManager = users.find(u => u.id === proj.artManagerId);
                      const artDirector = users.find(u => u.id === proj.artDirectorId);

                      return (
                        <tr key={proj.id} className="hover:bg-zinc-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-xl ${proj.avatarColor || 'bg-indigo-600'} text-white font-black text-xs flex items-center justify-center shrink-0 shadow-2xs`}>
                                {proj.key.substring(0, 3)}
                              </div>
                              <div>
                                <div className="font-bold text-zinc-900 flex items-center gap-2">
                                  <span>{proj.name}</span>
                                  <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-600 text-[10px] font-mono font-bold rounded-md">
                                    {proj.key}
                                  </span>
                                </div>
                                <div className="text-[11px] text-zinc-400 line-clamp-1 max-w-[280px]">
                                  {proj.description || 'No description provided.'}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 bg-zinc-100 text-zinc-700 font-semibold text-[11px] rounded-md">
                                {proj.projectType}
                              </span>
                              <PriorityBadge priority={proj.priority} />
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              proj.status === 'Active' ? 'bg-emerald-100 text-emerald-800' :
                              proj.status === 'Paused' ? 'bg-amber-100 text-amber-800' :
                              'bg-zinc-100 text-zinc-600'
                            }`}>
                              {proj.status}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="text-[11px] text-zinc-600">
                              <div><strong className="text-zinc-800">Mgr:</strong> {artManager?.name || 'Unassigned'}</div>
                              <div><strong className="text-zinc-800">Dir:</strong> {artDirector?.name || 'Unassigned'}</div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className="font-bold text-zinc-900">{projTasks.length}</span>
                            <span className="text-zinc-400 text-[11px]"> tasks</span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => onEditProject(proj.id)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                title="Edit Project Settings & Timeline"
                              >
                                <Edit size={12} />
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => onManageProjectAccess(proj.id)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                title="Manage project access members & permissions"
                              >
                                <KeyRound size={12} />
                                <span>Access</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteProject(proj)}
                                className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Project"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SYSTEM TOOLS & DATABASE RESET */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {/* Database Control Center */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-2xs space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-100">
              <Database size={18} className="text-indigo-600" />
              <h2 className="text-sm font-bold text-zinc-900">Studio Database & Persistence Controls</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Wipe / Clean Slate Box */}
              <div className="p-5 bg-rose-50/60 border border-rose-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                  <Trash2 size={16} />
                  <span>Wipe All Data (Clean Slate)</span>
                </div>
                <p className="text-xs text-rose-700 leading-relaxed">
                  Completely wipes all People, Artists, Projects, Tasks, Requests, and Sprints from local storage, setting up a pure, clean studio ready for custom data entry.
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmWipeOpen(true)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  Clean All Data Now
                </button>
              </div>

              {/* Load Sample Demo Box */}
              <div className="p-5 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-zinc-800 font-bold text-sm">
                  <RotateCcw size={16} className="text-zinc-600" />
                  <span>Load Sample Demo Data</span>
                </div>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Optional: Populates demo game titles (WWE Mayhem, Marketing Campaigns, LiveOps Events) and 20 sample artists with configured skill matrices.
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmDemoOpen(true)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-800 bg-white hover:bg-zinc-100 border border-zinc-300 rounded-xl transition-colors cursor-pointer shadow-2xs"
                >
                  Load Sample Roster & Projects
                </button>
              </div>
            </div>

            {/* Export / Backup */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExportJson}
                className="px-4 py-2 text-xs font-semibold text-zinc-800 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Download size={14} />
                <span>Export Full Studio Database (JSON)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DATABASE HEALTH & STORAGE */}
      {activeTab === 'database-health' && (
        <DatabaseHealthManager />
      )}

      {/* Confirmation Modal for Wiping Data */}
      {confirmWipeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 border border-zinc-200 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-zinc-900">Clean All Studio Data?</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                This will purge all People, Artists, Projects, Tasks, Requests, and Sprints. You will be left with a single clean Studio Admin account ready to add your own team members and projects.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmWipeOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleWipeData}
                className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer shadow-xs"
              >
                Yes, Clean Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Loading Demo Data */}
      {confirmDemoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 border border-zinc-200 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
              <RotateCcw size={24} />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-zinc-900">Load Sample Demo Roster?</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                This will load sample demo game projects and artists for exploration. Existing temporary changes will be replaced with the demo seed data.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDemoOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLoadDemo}
                className="px-5 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl cursor-pointer shadow-xs"
              >
                Load Sample Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
