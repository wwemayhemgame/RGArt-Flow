import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Sliders,
  CheckCircle2,
  Lock,
  Layers,
  FolderGit2,
  Zap,
  Eye,
  Edit3,
  Clock,
  DollarSign,
  Calendar,
  Sparkles,
  Award,
  IdCard,
  User as UserIcon,
  Mail,
  Building,
  Briefcase,
  LayoutDashboard,
  Kanban,
  FileText,
  CheckSquare,
  ListTodo,
  Users,
  FolderKanban,
  BarChart3,
  CalendarDays,
  TrendingUp,
  History,
  Settings,
  ShieldAlert,
  Images,
  UserCheck,
  Share2,
  Check,
  Play
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import {
  User,
  UserRole,
  FieldAccessPermissions,
  ProjectAccessLevel,
  NavigationTab,
  TabAccessMode,
  DailyReportAccessLevel
} from '../../types';
import { ALL_NAVIGATION_TABS, getPresetTabPermissions } from '../../lib/authService';
import { Avatar } from '../common/Avatar';
import { RoleBadge } from '../common/Badge';

interface EditUserRoleAndAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: User | null;
  onSuccess?: (msg: string) => void;
}

const TAB_MODULE_INFO: Record<
  NavigationTab,
  { label: string; group: 'Core' | 'Workflows' | 'Planning' | 'System'; icon: React.ElementType; desc: string }
> = {
  dashboard: { label: 'Dashboard', group: 'Core', icon: LayoutDashboard, desc: 'Overview metrics, urgent tasks, and delivery forecast.' },
  'admin-tool': { label: 'Admin Tool', group: 'System', icon: ShieldAlert, desc: 'Studio administration, cloud resets, and superuser hub.' },
  gallery: { label: 'Media Gallery', group: 'Core', icon: Images, desc: 'Visual asset media viewer and artwork uploads.' },
  requests: { label: 'Company Requests', group: 'Workflows', icon: FileText, desc: 'Art request intake portal and stakeholder tickets.' },
  'my-tasks': { label: 'My Work', group: 'Workflows', icon: CheckSquare, desc: 'Personal assigned tasks and time logging.' },
  backlog: { label: 'Backlog', group: 'Workflows', icon: ListTodo, desc: 'Sprint planning backlog and task queue.' },
  sprints: { label: 'Sprints', group: 'Workflows', icon: Layers, desc: 'Active and upcoming weekly sprint management.' },
  kanban: { label: 'Kanban Board', group: 'Workflows', icon: Kanban, desc: 'Live visual workflow and stage transitions.' },
  capacity: { label: 'Capacity Planning', group: 'Planning', icon: BarChart3, desc: 'Weekly artist bandwidth and load balancing.' },
  artists: { label: 'Artists & Skills', group: 'Planning', icon: Users, desc: 'Roster skills, leaves, and productivity stats.' },
  'daily-report': { label: 'Daily Tasks Report', group: 'Planning', icon: UserCheck, desc: 'Daily artist task logs, hours, and status breakdown.' },
  'sprint-report': { label: 'Sprint-wise Report', group: 'Planning', icon: BarChart3, desc: 'Sprint-wise artist effort, velocity, carry-forward tasks, and status breakdown.' },
  projects: { label: 'Projects', group: 'Planning', icon: FolderKanban, desc: 'Studio game projects, milestones, and deliverables.' },
  calendar: { label: 'Calendar', group: 'Planning', icon: CalendarDays, desc: 'Studio milestones, leave schedule, and deadlines.' },
  reports: { label: 'Reports & SLA', group: 'System', icon: TrendingUp, desc: 'Historical velocity, delivery SLAs, and cost analytics.' },
  activity: { label: 'Activity Log', group: 'System', icon: History, desc: 'Live studio audit trails and event records.' },
  people: { label: 'People & Access', group: 'System', icon: Users, desc: 'User directory, approval workflows, and role settings.' },
  settings: { label: 'Settings', group: 'System', icon: Settings, desc: 'Working hours, Jira integration, and studio preferences.' }
};

export const EditUserRoleAndAccessModal: React.FC<EditUserRoleAndAccessModalProps> = ({
  isOpen,
  onClose,
  targetUser,
  onSuccess
}) => {
  const {
    projects,
    currentUser,
    updateUser,
    updateUserPermissions,
    updateProjectAccess,
    startRolePreview
  } = useArtOps();

  const [role, setRole] = useState<UserRole>('ARTIST');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [officeId, setOfficeId] = useState('');
  const [assignedProjectIds, setAssignedProjectIds] = useState<string[]>([]);
  const [projectAccessLevels, setProjectAccessLevels] = useState<Record<string, ProjectAccessLevel>>({});
  const [isGlobalAccess, setIsGlobalAccess] = useState(true);

  // Field permissions
  const [permissions, setPermissions] = useState<FieldAccessPermissions>({
    canViewStoryPoints: true,
    canEditStoryPoints: false,
    canViewEstimates: true,
    canEditEstimates: true,
    canLogTime: true,
    canViewHourlyRates: false,
    canAssignArtists: false,
    canApproveRevisions: false,
    canManageSprints: false,
    canCreateProjects: false,
    canAccessAiPlanner: false,
    canViewReports: true,
    tabAccess: getPresetTabPermissions('ARTIST'),
    dailyReportAccess: 'FULL_ACCESS'
  });

  const [tabAccessMap, setTabAccessMap] = useState<Partial<Record<NavigationTab, TabAccessMode>>>({});
  const [dailyReportAccess, setDailyReportAccess] = useState<DailyReportAccessLevel>('FULL_ACCESS');

  const [activeSubTab, setActiveSubTab] = useState<'role' | 'tab-access' | 'projects' | 'permissions'>('role');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Helper for preset permissions based on role
  const getRolePresetPerms = (targetRole: UserRole): FieldAccessPermissions => {
    const tabPreset = getPresetTabPermissions(targetRole === 'ADMIN' ? 'ADMIN' : targetRole === 'ART_DIRECTOR' || targetRole === 'ART_MANAGER' ? 'LEADER' : targetRole === 'ARTIST' ? 'ARTIST' : 'COMPANY_REQUESTER');
    switch (targetRole) {
      case 'ADMIN':
        return {
          canViewStoryPoints: true,
          canEditStoryPoints: true,
          canViewEstimates: true,
          canEditEstimates: true,
          canLogTime: true,
          canViewHourlyRates: true,
          canAssignArtists: true,
          canApproveRevisions: true,
          canManageSprints: true,
          canCreateProjects: true,
          canAccessAiPlanner: true,
          canViewReports: true,
          tabAccess: tabPreset,
          dailyReportAccess: 'FULL_ACCESS',
          canAccessAllTabs: true
        };
      case 'ART_DIRECTOR':
      case 'ART_MANAGER':
        return {
          canViewStoryPoints: true,
          canEditStoryPoints: true,
          canViewEstimates: true,
          canEditEstimates: true,
          canLogTime: true,
          canViewHourlyRates: true,
          canAssignArtists: true,
          canApproveRevisions: true,
          canManageSprints: true,
          canCreateProjects: true,
          canAccessAiPlanner: true,
          canViewReports: true,
          tabAccess: tabPreset,
          dailyReportAccess: 'FULL_ACCESS',
          canAccessAllTabs: true
        };
      case 'ARTIST':
        return {
          canViewStoryPoints: true,
          canEditStoryPoints: false,
          canViewEstimates: true,
          canEditEstimates: true,
          canLogTime: true,
          canViewHourlyRates: false,
          canAssignArtists: false,
          canApproveRevisions: false,
          canManageSprints: false,
          canCreateProjects: false,
          canAccessAiPlanner: false,
          canViewReports: true,
          tabAccess: tabPreset,
          dailyReportAccess: 'FULL_ACCESS',
          canAccessAllTabs: false
        };
      case 'COMPANY_REQUESTER':
      default:
        return {
          canViewStoryPoints: false,
          canEditStoryPoints: false,
          canViewEstimates: false,
          canEditEstimates: false,
          canLogTime: false,
          canViewHourlyRates: false,
          canAssignArtists: false,
          canApproveRevisions: false,
          canManageSprints: false,
          canCreateProjects: false,
          canAccessAiPlanner: false,
          canViewReports: false,
          tabAccess: tabPreset,
          dailyReportAccess: 'NONE',
          canAccessAllTabs: false
        };
    }
  };

  useEffect(() => {
    if (targetUser) {
      setRole(targetUser.role);
      setName(targetUser.name || '');
      setEmail(targetUser.email || '');
      setTitle(targetUser.title || '');
      setDepartment(targetUser.department || 'Production Art');
      setOfficeId(targetUser.officeId || 'OFF-1001');

      // Initialize tab permissions
      const initialTabAccess: Partial<Record<NavigationTab, TabAccessMode>> =
        targetUser.fieldPermissions?.tabAccess ||
        getPresetTabPermissions(
          targetUser.role === 'ADMIN'
            ? 'ADMIN'
            : targetUser.role === 'ART_DIRECTOR' || targetUser.role === 'ART_MANAGER'
            ? 'LEADER'
            : targetUser.role === 'ARTIST'
            ? 'ARTIST'
            : 'COMPANY_REQUESTER'
        );

      const initialDailyReportAccess: DailyReportAccessLevel =
        targetUser.fieldPermissions?.dailyReportAccess ||
        (targetUser.role === 'COMPANY_REQUESTER' ? 'NONE' : 'FULL_ACCESS');

      setTabAccessMap(initialTabAccess);
      setDailyReportAccess(initialDailyReportAccess);

      const initialPerms: FieldAccessPermissions = {
        canViewStoryPoints: targetUser.fieldPermissions?.canViewStoryPoints ?? (targetUser.role !== 'COMPANY_REQUESTER'),
        canEditStoryPoints: targetUser.fieldPermissions?.canEditStoryPoints ?? (targetUser.role === 'ADMIN' || targetUser.role === 'ART_MANAGER' || targetUser.role === 'ART_DIRECTOR'),
        canViewEstimates: targetUser.fieldPermissions?.canViewEstimates ?? (targetUser.role !== 'COMPANY_REQUESTER'),
        canEditEstimates: targetUser.fieldPermissions?.canEditEstimates ?? (targetUser.role !== 'COMPANY_REQUESTER'),
        canLogTime: targetUser.fieldPermissions?.canLogTime ?? (targetUser.role === 'ARTIST' || targetUser.role === 'ART_MANAGER' || targetUser.role === 'ADMIN' || targetUser.role === 'ART_DIRECTOR'),
        canViewHourlyRates: targetUser.fieldPermissions?.canViewHourlyRates ?? (targetUser.role === 'ADMIN' || targetUser.role === 'ART_MANAGER'),
        canAssignArtists: targetUser.fieldPermissions?.canAssignArtists ?? (targetUser.role !== 'COMPANY_REQUESTER' && targetUser.role !== 'ARTIST'),
        canApproveRevisions: targetUser.fieldPermissions?.canApproveRevisions ?? (targetUser.role === 'ADMIN' || targetUser.role === 'ART_MANAGER' || targetUser.role === 'ART_DIRECTOR'),
        canManageSprints: targetUser.fieldPermissions?.canManageSprints ?? (targetUser.role === 'ADMIN' || targetUser.role === 'ART_MANAGER' || targetUser.role === 'ART_DIRECTOR'),
        canCreateProjects: targetUser.fieldPermissions?.canCreateProjects ?? (targetUser.role === 'ADMIN' || targetUser.role === 'ART_MANAGER' || targetUser.role === 'ART_DIRECTOR'),
        canAccessAiPlanner: targetUser.fieldPermissions?.canAccessAiPlanner ?? (targetUser.role === 'ADMIN' || targetUser.role === 'ART_MANAGER' || targetUser.role === 'ART_DIRECTOR'),
        canViewReports: targetUser.fieldPermissions?.canViewReports ?? (targetUser.role !== 'COMPANY_REQUESTER'),
        tabAccess: initialTabAccess,
        dailyReportAccess: initialDailyReportAccess
      };
      setPermissions(initialPerms);

      // Find user project memberships
      const userProjects = projects.filter(p => p.members?.some(m => m.userId === targetUser.id));
      const accessMap: Record<string, ProjectAccessLevel> = {};
      const projIds: string[] = [];

      projects.forEach(p => {
        const mem = p.members?.find(m => m.userId === targetUser.id);
        if (mem) {
          projIds.push(p.id);
          accessMap[p.id] = mem.accessLevel;
        } else {
          accessMap[p.id] = targetUser.role === 'ADMIN' ? 'MANAGER' : targetUser.role === 'ARTIST' ? 'EDITOR' : 'VIEWER';
        }
      });

      setAssignedProjectIds(projIds);
      setProjectAccessLevels(accessMap);
      setIsGlobalAccess(projIds.length === 0 || projIds.length === projects.length || targetUser.role === 'ADMIN');
      setSaveSuccess(false);
    }
  }, [targetUser, projects]);

  if (!isOpen || !targetUser) return null;

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    const roleDefaults = getRolePresetPerms(newRole);
    setPermissions(roleDefaults);
    if (roleDefaults.tabAccess) {
      setTabAccessMap(roleDefaults.tabAccess);
    }
    if (roleDefaults.dailyReportAccess) {
      setDailyReportAccess(roleDefaults.dailyReportAccess);
    }
  };

  const handleApplyPreset = (preset: 'ADMIN' | 'LEADER' | 'ARTIST' | 'COMPANY_REQUESTER' | 'DAILY_REPORT_VIEW_ONLY' | 'ALL_VIEW_ONLY') => {
    const presetMap = getPresetTabPermissions(preset);
    setTabAccessMap(presetMap);
    if (preset === 'DAILY_REPORT_VIEW_ONLY') {
      setDailyReportAccess('VIEW_ONLY');
    } else if (preset === 'ADMIN' || preset === 'LEADER' || preset === 'ARTIST') {
      setDailyReportAccess('FULL_ACCESS');
    } else {
      setDailyReportAccess('NONE');
    }
  };

  const handleSetTabAccess = (tabId: NavigationTab, mode: TabAccessMode) => {
    setTabAccessMap(prev => ({
      ...prev,
      [tabId]: mode
    }));
    if (tabId === 'daily-report') {
      if (mode === 'VIEW') setDailyReportAccess('VIEW_ONLY');
      else if (mode === 'FULL' || mode === 'EDIT') setDailyReportAccess('FULL_ACCESS');
      else setDailyReportAccess('NONE');
    }
  };

  const handleSetDailyReportAccess = (level: DailyReportAccessLevel) => {
    setDailyReportAccess(level);
    const mappedMode: TabAccessMode = level === 'VIEW_ONLY' ? 'VIEW' : level === 'FULL_ACCESS' ? 'FULL' : 'NONE';
    setTabAccessMap(prev => ({
      ...prev,
      'daily-report': mappedMode
    }));
  };

  const toggleProject = (projectId: string) => {
    setAssignedProjectIds(prev =>
      prev.includes(projectId) ? prev.filter(id => id !== projectId) : [...prev, projectId]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const finalPermissions: FieldAccessPermissions = {
        ...permissions,
        tabAccess: tabAccessMap,
        dailyReportAccess
      };

      const updates: Partial<User> = {
        name: name.trim() || targetUser.name,
        email: email.trim() || targetUser.email,
        role,
        title: title.trim() || targetUser.title,
        department: department.trim() || targetUser.department,
        officeId: officeId.trim() || targetUser.officeId,
        fieldPermissions: finalPermissions
      };

      // 1. Update user in state & Firestore
      updateUser(targetUser.id, updates);
      await updateUserPermissions(targetUser.id, finalPermissions);

      // 2. Update project memberships
      for (const p of projects) {
        const isSelected = isGlobalAccess || assignedProjectIds.includes(p.id);
        const desiredLevel = projectAccessLevels[p.id] || (role === 'ADMIN' ? 'MANAGER' : 'EDITOR');

        if (isSelected) {
          updateProjectAccess(targetUser.id, p.id, desiredLevel, `Role update to ${role}`);
        } else {
          updateProjectAccess(targetUser.id, p.id, 'Removed', `Project scope adjusted`);
        }
      }

      setSaveSuccess(true);
      if (onSuccess) {
        onSuccess(`Role and tab access permissions saved for ${name || targetUser.name}`);
      }
      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error('Error saving role & access:', err);
      setIsSaving(false);
    }
  };

  return (
    <div
      id="modal-edit-role-and-access"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Sliders size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white leading-tight">Edit Role, Tabs & Access Control</h2>
              <p className="text-xs text-slate-300">
                Configure studio role, tab visibility, view-only modes, and Firestore permissions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer text-sm"
          >
            ✕
          </button>
        </div>

        {/* User Summary Banner */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={targetUser.name} src={targetUser.avatar} size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-900 truncate">{targetUser.name}</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                  {targetUser.officeId || 'OFF-1001'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">{targetUser.email}</p>
            </div>
          </div>
          <RoleBadge role={role} />
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-6 bg-white gap-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('role')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all ${
              activeSubTab === 'role'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <UserIcon size={14} />
            <span>Role & Identity</span>
          </button>

          <button
            type="button"
            id="tab-btn-access-control"
            onClick={() => setActiveSubTab('tab-access')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all ${
              activeSubTab === 'tab-access'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Sliders size={14} className="text-amber-500" />
            <span>Tab Access Control</span>
            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded-full">
              All 17 Tabs
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('projects')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all ${
              activeSubTab === 'projects'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FolderGit2 size={14} />
            <span>Project Access</span>
            <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded-full text-slate-600 font-bold">
              {isGlobalAccess ? 'All' : assignedProjectIds.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('permissions')}
            className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-all ${
              activeSubTab === 'permissions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ShieldCheck size={14} />
            <span>Field & Feature Access</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: Role & Identity */}
          {activeSubTab === 'role' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Studio Role Radio Cards */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  Studio Role & Access Tier *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    {
                      id: 'ADMIN',
                      name: 'Studio Administrator',
                      badge: 'ADMIN',
                      desc: 'Full studio administration, user approvals, RBAC, project creations, and system settings.'
                    },
                    {
                      id: 'ART_DIRECTOR',
                      name: 'Art Director',
                      badge: 'DIRECTOR',
                      desc: 'Creative oversight, aesthetic reviews, milestone sign-offs, and sprint approvals.'
                    },
                    {
                      id: 'ART_MANAGER',
                      name: 'Art Manager',
                      badge: 'MANAGER',
                      desc: 'Production scheduling, task assignments, capacity planning, and velocity tracking.'
                    },
                    {
                      id: 'ARTIST',
                      name: 'Digital Artist',
                      badge: 'ARTIST',
                      desc: 'Task execution, subtasks, work time logging, asset uploads, and revision workflows.'
                    },
                    {
                      id: 'COMPANY_REQUESTER',
                      name: 'Company Requester',
                      badge: 'REQUESTER',
                      desc: 'Submit new art tickets, monitor delivery milestones, review assets, and request revisions.'
                    }
                  ].map(r => (
                    <label
                      key={r.id}
                      className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
                        role === r.id
                          ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="studio_role"
                            checked={role === r.id}
                            onChange={() => handleRoleChange(r.id as UserRole)}
                            className="text-blue-600 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-900">{r.name}</span>
                        </div>
                        <RoleBadge role={r.id as UserRole} />
                      </div>
                      <p className="text-[11px] text-slate-500 leading-normal pl-5">{r.desc}</p>
                    </label>
                  ))}
                </div>
              </div>

              {/* Editable Profile Fields */}
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Employee Identity & Department
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Full Name *
                    </label>
                    <div className="relative">
                      <UserIcon size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Employee Full Name"
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:bg-white focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Official Work Email *
                    </label>
                    <div className="relative">
                      <Mail size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="corporate.email@company.com"
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:bg-white focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Studio Office ID *
                    </label>
                    <div className="relative">
                      <IdCard size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={officeId}
                        onChange={e => setOfficeId(e.target.value.toUpperCase())}
                        placeholder="OFF-1001"
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg font-mono font-bold text-blue-700 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Designation / Title
                    </label>
                    <div className="relative">
                      <Briefcase size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="e.g. Senior 3D Environment Lead"
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:bg-white focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Studio Department
                    </label>
                    <div className="relative">
                      <Building size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={department}
                        onChange={e => setDepartment(e.target.value)}
                        placeholder="e.g. Production Art, Concept & Character, UI/UX"
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:bg-white focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TAB ACCESS CONTROL (All 17 Tabs + View-Only Modes) */}
          {activeSubTab === 'tab-access' && (
            <div className="space-y-5 animate-in fade-in">
              {/* Presets Bar */}
              <div className="p-3.5 bg-slate-900 text-white rounded-xl space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sliders size={15} className="text-amber-400" />
                    <span className="text-xs font-bold text-white">Quick Tab Access Presets</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Click to apply template to all tabs</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('ADMIN')}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>🌟 Full Studio Access (All 17)</span>
                  </button>
                  <button
                    type="button"
                    id="preset-btn-daily-report-view-only"
                    onClick={() => handleApplyPreset('DAILY_REPORT_VIEW_ONLY')}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer flex items-center gap-1 shadow-xs font-extrabold"
                  >
                    <Eye size={12} />
                    <span>👁️ Daily Report (View-Only)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('ARTIST')}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                  >
                    <span>🎨 Production Artist</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('COMPANY_REQUESTER')}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                  >
                    <span>💼 Requester Portal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('ALL_VIEW_ONLY')}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                  >
                    <span>👓 All Modules View-Only</span>
                  </button>
                </div>
              </div>

              {/* Special Focus: Daily Tasks Report Permission Card */}
              <div className="p-4 rounded-xl bg-amber-50/80 border-2 border-amber-400/80 space-y-3 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                      <UserCheck size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900">Daily Tasks Report Access Mode</h4>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                          Special Access
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600">
                        Share view-only access so stakeholders or leads can inspect daily artist work without modifying entries.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                    <button
                      type="button"
                      id="opt-daily-report-view-only"
                      onClick={() => handleSetDailyReportAccess('VIEW_ONLY')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        dailyReportAccess === 'VIEW_ONLY' || tabAccessMap['daily-report'] === 'VIEW'
                          ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-400 font-extrabold'
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <Eye size={13} />
                      <span>View-Only Access</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetDailyReportAccess('FULL_ACCESS')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        (dailyReportAccess === 'FULL_ACCESS' && tabAccessMap['daily-report'] !== 'VIEW' && tabAccessMap['daily-report'] !== 'NONE')
                          ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400'
                          : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <CheckCircle2 size={13} />
                      <span>Full Access</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSetDailyReportAccess('NONE')}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        dailyReportAccess === 'NONE' || tabAccessMap['daily-report'] === 'NONE'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-white text-slate-500 border border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      Hidden
                    </button>
                  </div>
                </div>

                <div className="text-[11px] text-amber-950 bg-amber-100/70 p-2.5 rounded-lg border border-amber-200">
                  {dailyReportAccess === 'VIEW_ONLY' || tabAccessMap['daily-report'] === 'VIEW' ? (
                    <span className="flex items-center gap-1.5 font-semibold text-amber-900">
                      <Eye size={14} className="text-amber-700 shrink-0" />
                      View-Only mode active: User can inspect all artist daily logs, hours, and status breakdown without permission to edit or log hours.
                    </span>
                  ) : dailyReportAccess === 'FULL_ACCESS' ? (
                    <span className="flex items-center gap-1.5 font-semibold text-blue-900">
                      <CheckCircle2 size={14} className="text-blue-700 shrink-0" />
                      Full interactive access active: User can view reports, submit daily time logs, and update status.
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-rose-800 font-medium">
                      <Lock size={14} className="shrink-0" />
                      The Daily Tasks Report tab is hidden from this user's sidebar and navigation.
                    </span>
                  )}
                </div>
              </div>

              {/* All 17 Tabs Granular Matrix */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-blue-600" />
                    <span>Granular Tab Visibility & Permission Matrix (All 17 Tabs)</span>
                  </h4>
                  <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-600" /> Full
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500" /> View Only
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-slate-300" /> Hidden
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {ALL_NAVIGATION_TABS.map(tabId => {
                    const info = TAB_MODULE_INFO[tabId];
                    const Icon = info.icon;
                    const currentMode: TabAccessMode = tabAccessMap[tabId] || 'NONE';

                    return (
                      <div
                        key={tabId}
                        className={`p-2.5 sm:p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all ${
                          currentMode === 'FULL' || currentMode === 'EDIT'
                            ? 'bg-blue-50/30 border-blue-200'
                            : currentMode === 'VIEW'
                            ? 'bg-amber-50/40 border-amber-300 shadow-2xs'
                            : 'bg-slate-50/50 border-slate-200 opacity-80'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              currentMode === 'FULL' || currentMode === 'EDIT'
                                ? 'bg-blue-100 text-blue-700'
                                : currentMode === 'VIEW'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            <Icon size={16} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{info.label}</span>
                              <span className="text-[9px] font-semibold text-slate-400 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                                {info.group}
                              </span>
                              {tabId === 'daily-report' && currentMode === 'VIEW' && (
                                <span className="text-[9px] font-bold text-amber-800 bg-amber-200 px-1.5 py-0.2 rounded">
                                  View-Only Mode
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 truncate">{info.desc}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs self-end sm:self-auto">
                          <button
                            type="button"
                            id={`btn-tab-full-${tabId}`}
                            onClick={() => handleSetTabAccess(tabId, 'FULL')}
                            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                              currentMode === 'FULL' || currentMode === 'EDIT'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                          >
                            Full
                          </button>
                          <button
                            type="button"
                            id={`btn-tab-view-${tabId}`}
                            onClick={() => handleSetTabAccess(tabId, 'VIEW')}
                            className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                              currentMode === 'VIEW'
                                ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                          >
                            <Eye size={10} />
                            <span>View Only</span>
                          </button>
                          <button
                            type="button"
                            id={`btn-tab-none-${tabId}`}
                            onClick={() => handleSetTabAccess(tabId, 'NONE')}
                            className={`px-2 py-1 rounded text-[11px] font-medium transition-all cursor-pointer ${
                              currentMode === 'NONE'
                                ? 'bg-slate-700 text-white shadow-xs'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            Hidden
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Project Access */}
          {activeSubTab === 'projects' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-blue-950">Global Studio Project Access</h4>
                  <p className="text-[11px] text-blue-700">
                    When enabled, member has access to all active and upcoming studio game projects.
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isGlobalAccess}
                    onChange={e => setIsGlobalAccess(e.target.checked)}
                    className="rounded text-blue-600 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-blue-900">Grant All Projects</span>
                </label>
              </div>

              {!isGlobalAccess && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Select Assigned Projects & Scope:
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {projects.map(p => {
                      const isAssigned = assignedProjectIds.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                            isAssigned ? 'bg-white border-blue-300 shadow-2xs' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <label className="flex items-center gap-3 cursor-pointer min-w-0">
                            <input
                              type="checkbox"
                              checked={isAssigned}
                              onChange={() => toggleProject(p.id)}
                              className="rounded text-blue-600 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-900 truncate block">{p.name}</span>
                              <span className="text-[10px] text-slate-500">{p.projectType || 'Studio Project'}</span>
                            </div>
                          </label>

                          {isAssigned && (
                            <select
                              value={projectAccessLevels[p.id] || 'EDITOR'}
                              onChange={e =>
                                setProjectAccessLevels(prev => ({
                                  ...prev,
                                  [p.id]: e.target.value as ProjectAccessLevel
                                }))
                              }
                              className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-semibold"
                            >
                              <option value="VIEWER">Viewer (Read Only)</option>
                              <option value="EDITOR">Editor (Task Submitter)</option>
                              <option value="MANAGER">Manager (Sprint & Approver)</option>
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Field & Feature Access */}
          {activeSubTab === 'permissions' && (
            <div className="space-y-4 animate-in fade-in">
              {/* Group 1: Estimates & Story Points */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={12} className="text-blue-600" />
                  <span>Estimates, Story Points & Time</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canViewStoryPoints}
                      onChange={e => setPermissions(p => ({ ...p, canViewStoryPoints: e.target.checked }))}
                      className="rounded text-blue-600 cursor-pointer"
                    />
                    <span>View Story Points & Complexity</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canEditStoryPoints}
                      onChange={e => setPermissions(p => ({ ...p, canEditStoryPoints: e.target.checked }))}
                      className="rounded text-blue-600 cursor-pointer"
                    />
                    <span>Edit / Estimate Story Points</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canViewEstimates}
                      onChange={e => setPermissions(p => ({ ...p, canViewEstimates: e.target.checked }))}
                      className="rounded text-blue-600 cursor-pointer"
                    />
                    <span>View Estimated Task Hours</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canEditEstimates}
                      onChange={e => setPermissions(p => ({ ...p, canEditEstimates: e.target.checked }))}
                      className="rounded text-blue-600 cursor-pointer"
                    />
                    <span>Edit Estimated Task Hours</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={permissions.canLogTime}
                      onChange={e => setPermissions(p => ({ ...p, canLogTime: e.target.checked }))}
                      className="rounded text-blue-600 cursor-pointer"
                    />
                    <span>Log Daily Work Time & Timesheet Records</span>
                  </label>
                </div>
              </div>

              {/* Group 2: Planning & Reviews */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={12} className="text-purple-600" />
                  <span>Planning, Assignments & Reviews</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canAssignArtists}
                      onChange={e => setPermissions(p => ({ ...p, canAssignArtists: e.target.checked }))}
                      className="rounded text-blue-600 cursor-pointer"
                    />
                    <span>Assign Artists / Reassign Tasks</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canManageSprints}
                      onChange={e => setPermissions(p => ({ ...p, canManageSprints: e.target.checked }))}
                      className="rounded text-blue-600 cursor-pointer"
                    />
                    <span>Manage Weekly Sprints</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canAccessAiPlanner}
                      onChange={e => setPermissions(p => ({ ...p, canAccessAiPlanner: e.target.checked }))}
                      className="rounded text-purple-600 cursor-pointer"
                    />
                    <span className="font-semibold text-purple-700 flex items-center gap-1">
                      <Sparkles size={11} />
                      <span>AI Sprint Planner Access</span>
                    </span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canApproveRevisions}
                      onChange={e => setPermissions(p => ({ ...p, canApproveRevisions: e.target.checked }))}
                      className="rounded text-blue-600 cursor-pointer"
                    />
                    <span>Approve Task Revisions & Sign-offs</span>
                  </label>
                </div>
              </div>

              {/* Group 3: Financials & Reports */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign size={12} className="text-emerald-600" />
                  <span>Financials, Projects & Reports</span>
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canViewHourlyRates}
                      onChange={e => setPermissions(p => ({ ...p, canViewHourlyRates: e.target.checked }))}
                      className="rounded text-blue-600 cursor-pointer"
                    />
                    <span>View Hourly Rates & Costs</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canCreateProjects}
                      onChange={e => setPermissions(p => ({ ...p, canCreateProjects: e.target.checked }))}
                      className="rounded text-blue-600 cursor-pointer"
                    />
                    <span>Create New Projects</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.canViewReports}
                      onChange={e => setPermissions(p => ({ ...p, canViewReports: e.target.checked }))}
                      className="rounded text-blue-600 cursor-pointer"
                    />
                    <span>View Studio Reports & Velocity</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <p className="text-[11px] text-slate-500">
            Changes persist directly into Firestore database in real-time.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                startRolePreview(role);
                onClose();
              }}
              className="px-3.5 py-2 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              title={`Preview studio in safe simulation mode as ${role}`}
            >
              <Play size={13} />
              <span>Test Role ({role})</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-save-role-and-access"
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.98] rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
            >
              {saveSuccess ? (
                <>
                  <CheckCircle2 size={14} className="text-emerald-300" />
                  <span>Saved!</span>
                </>
              ) : isSaving ? (
                <>
                  <Clock size={14} className="animate-spin" />
                  <span>Saving to Firestore...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} />
                  <span>Save Role & Access</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
