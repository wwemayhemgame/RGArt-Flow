import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  FileText,
  CheckSquare,
  ListTodo,
  Layers,
  Kanban,
  Users,
  FolderKanban,
  BarChart3,
  CalendarDays,
  TrendingUp,
  History,
  UserCheck,
  Settings,
  Sparkles,
  ShieldAlert,
  PanelLeftClose,
  PanelLeftOpen,
  Images,
  Camera,
  Edit3,
  X
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { Avatar } from '../common/Avatar';
import { RoleBadge } from '../common/Badge';

export type NavigationTab =
  | 'dashboard'
  | 'admin-tool'
  | 'gallery'
  | 'requests'
  | 'my-tasks'
  | 'backlog'
  | 'sprints'
  | 'kanban'
  | 'artists'
  | 'daily-report'
  | 'sprint-report'
  | 'projects'
  | 'capacity'
  | 'calendar'
  | 'reports'
  | 'activity'
  | 'people'
  | 'settings';

export type NavTabId = NavigationTab;

interface SidebarProps {
  currentTab?: NavigationTab;
  activeTab?: NavigationTab;
  onSelectTab?: (tab: NavigationTab) => void;
  onTabChange?: (tab: NavigationTab) => void;
  onOpenAiAssistant?: () => void;
  onOpenEditProfile?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  activeTab,
  onSelectTab,
  onTabChange,
  onOpenAiAssistant,
  onOpenEditProfile,
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const selectedTab = activeTab || currentTab || 'dashboard';
  const handleSelect = (tab: NavigationTab) => {
    if (onTabChange) onTabChange(tab);
    if (onSelectTab) onSelectTab(tab);
    if (onCloseMobile) onCloseMobile();
  };
  const { currentUser, requests, tasks, canAccessAiSprintPlanner, canAccessTab, isTabReadOnly } = useArtOps();

  const isRequester = currentUser?.role === 'COMPANY_REQUESTER';
  const hasAiPlannerAccess = canAccessAiSprintPlanner();

  // Dynamic calculations for sidebar badge counters
  const openRequestsCount = isRequester
    ? requests.filter(r => ((currentUser?.id && r.requesterId === currentUser.id) || (currentUser?.name && r.requesterName.toLowerCase() === currentUser.name.toLowerCase())) && r.status !== 'DELIVERED' && r.status !== 'REJECTED').length
    : requests.filter(r => r.status !== 'DELIVERED' && r.status !== 'REJECTED').length;
  
  const myTasksCount = tasks.filter(t => {
    if (t.status === 'DONE') return false;
    if (currentUser?.artistId && t.artistId === currentUser.artistId) return true;
    if (currentUser?.id && (t.artistId === currentUser.id || t.requesterId === currentUser.id)) return true;
    return false;
  }).length;

  const blockedTasksCount = tasks.filter(t => t.status === 'BLOCKED').length;

  // Media count for Gallery badge
  const mediaCount = tasks.reduce((sum, t) => {
    const taskAttCount = (t.attachments || []).length;
    const commentAttCount = (t.comments || []).reduce((cSum, c) => cSum + (c.attachments?.length || 0), 0);
    return sum + taskAttCount + commentAttCount;
  }, 0);

  const navItems: {
    id: NavigationTab;
    label: string;
    icon: React.ElementType;
    badge?: number | string;
    badgeColor?: string;
    roles?: string[];
  }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'admin-tool', label: 'Admin Tool', icon: ShieldAlert, badge: 'Studio Hub', badgeColor: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' },
    { id: 'gallery', label: 'Media Gallery', icon: Images, badge: mediaCount > 0 ? mediaCount : undefined, badgeColor: 'bg-indigo-500/30 text-indigo-200 border border-indigo-500/40' },
    { id: 'requests', label: isRequester ? 'My Requests' : 'Company Requests', icon: FileText, badge: openRequestsCount > 0 ? openRequestsCount : undefined, badgeColor: 'bg-blue-100 text-blue-700' },
    { id: 'my-tasks', label: 'My Work', icon: CheckSquare, badge: myTasksCount > 0 ? myTasksCount : undefined, badgeColor: 'bg-emerald-100 text-emerald-700' },
    { id: 'backlog', label: 'Backlog', icon: ListTodo },
    { id: 'sprints', label: 'Sprints', icon: Layers },
    { id: 'kanban', label: 'Kanban Board', icon: Kanban },
    { id: 'capacity', label: 'Capacity Planning', icon: BarChart3 },
    { id: 'artists', label: 'Artists & Skills', icon: Users },
    { id: 'daily-report', label: currentUser.role === 'ARTIST' ? 'My Daily Report' : 'Daily Tasks Report', icon: UserCheck },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'reports', label: 'Reports & SLA', icon: TrendingUp },
    { id: 'activity', label: 'Activity Log', icon: History },
    { id: 'people', label: 'People & Access', icon: UserCheck },
    { id: 'settings', label: 'Settings', icon: Settings }
  ];

  // Filter navigation items dynamically based on granular tab access permissions & role rules
  const visibleNavItems = navItems.filter(item => canAccessTab(item.id));

  // ESC key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileOpen && onCloseMobile) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  const renderNavContent = (isMobile: boolean = false) => (
    <>
      {/* AI Assistant Quick Launcher (Restricted: Art Managers, Directors, Admins only) */}
      {hasAiPlannerAccess && (
        !isCollapsed || isMobile ? (
          <div className="p-3 border-b border-slate-800 bg-slate-900/50 shrink-0">
            <button
              id={isMobile ? "btn-ai-ops-assistant-mobile" : "btn-ai-ops-assistant"}
              type="button"
              onClick={() => {
                if (onOpenAiAssistant) onOpenAiAssistant();
                if (isMobile && onCloseMobile) onCloseMobile();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-900/50 to-indigo-900/50 hover:from-blue-900/70 hover:to-indigo-900/70 border border-blue-700/40 text-white text-xs font-medium shadow-xs transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400 group-hover:rotate-12 transition-transform" />
                <span className="font-semibold text-slate-100">AI Ops Assistant</span>
              </div>
              <span className="text-[10px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/40 px-2 py-0.5 rounded-md">Ask AI</span>
            </button>
          </div>
        ) : (
          <div className="p-2 border-b border-slate-800 flex justify-center shrink-0">
            <button
              id="btn-ai-ops-assistant-collapsed"
              type="button"
              onClick={onOpenAiAssistant}
              title="AI Ops Assistant"
              className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700 text-amber-400 flex items-center justify-center transition-colors cursor-pointer group shadow-xs"
            >
              <Sparkles size={16} className="group-hover:rotate-12 transition-transform" />
            </button>
          </div>
        )
      )}

      {/* Navigation Links */}
      <div className={`flex-1 overflow-y-auto ${isCollapsed && !isMobile ? 'px-1.5 py-3 space-y-1.5' : 'px-3 py-3 space-y-1'} scrollbar-thin`}>
        {(!isCollapsed || isMobile) && (
          <div className="px-2 pb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {currentUser.role === 'COMPANY_REQUESTER' ? 'Requester Navigation' : 'All Modules'}
            </span>
            {currentUser.role === 'COMPANY_REQUESTER' && (
              <span className="text-[9px] font-semibold text-blue-400 bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-800/60">
                Portal Mode
              </span>
            )}
          </div>
        )}

        {visibleNavItems.map(item => {
          const Icon = item.icon;
          const isActive = selectedTab === item.id;

          if (isCollapsed && !isMobile) {
            return (
              <button
                key={item.id}
                id={`nav-tab-${item.id}`}
                type="button"
                onClick={() => handleSelect(item.id)}
                title={`${item.label}${item.badge ? ` (${item.badge})` : ''}`}
                className={`relative w-full h-10 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold shadow-xs ring-1 ring-blue-500'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400'} />
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center ring-2 ring-slate-900">
                    {typeof item.badge === 'number' && item.badge > 99 ? '99+' : item.badge === 'Studio Hub' ? '•' : item.badge}
                  </span>
                )}
              </button>
            );
          }

          return (
            <button
              key={item.id}
              id={`nav-tab-${item.id}${isMobile ? '-mobile' : ''}`}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`w-full flex items-center justify-between ${isMobile ? 'px-3.5 py-3 min-h-[44px]' : 'px-3 py-2'} rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-blue-600/20 border border-blue-500/40 text-blue-200 font-semibold shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-1.5 h-1.5 rounded-full transition-colors ${isActive ? 'bg-blue-400' : 'bg-transparent'}`} />
                <Icon size={17} className={isActive ? 'text-blue-400' : 'text-slate-400'} />
                <span className={isActive ? 'text-white font-semibold' : 'text-slate-300'}>{item.label}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {isTabReadOnly(item.id) && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    View
                  </span>
                )}
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-blue-500 text-white' : item.badgeColor || 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
            </button>
          );
        })}

        {/* Live Bottleneck / Blocked Banner if any tasks are blocked */}
        {blockedTasksCount > 0 && (
          <div className={`${isCollapsed && !isMobile ? 'mt-2 pt-2' : 'mt-4 pt-3'} border-t border-slate-800 px-1`}>
            {isCollapsed && !isMobile ? (
              <button
                type="button"
                onClick={() => handleSelect('kanban')}
                title={`${blockedTasksCount} Blocked Tasks on Kanban`}
                className="w-full h-10 rounded-lg bg-rose-950/50 border border-rose-800/60 text-rose-300 flex items-center justify-center hover:bg-rose-950/80 transition-colors cursor-pointer"
              >
                <ShieldAlert size={17} className="text-rose-400" />
              </button>
            ) : (
              <div
                onClick={() => handleSelect('kanban')}
                className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 cursor-pointer hover:bg-rose-950/70 transition-colors"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-rose-200">
                  <ShieldAlert size={15} className="text-rose-400 shrink-0" />
                  <span>{blockedTasksCount} Blocked Tasks</span>
                </div>
                <p className="text-[11px] text-rose-400 mt-0.5">Tap to inspect on Kanban</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Footer Profile */}
      <div className={`${isCollapsed && !isMobile ? 'p-2' : 'p-3'} border-t border-slate-800 bg-slate-900/90 shrink-0`}>
        {isCollapsed && !isMobile ? (
          <button
            type="button"
            onClick={onOpenEditProfile}
            className="w-full flex justify-center p-1 rounded-lg hover:bg-slate-800/80 transition-colors cursor-pointer group"
            title={`${currentUser.name} (${currentUser.role}) — Click to edit profile`}
          >
            <div className="relative">
              <Avatar
                name={currentUser.name}
                src={currentUser.avatar}
                size="sm"
              />
              <div className="absolute -bottom-1 -right-1 p-0.5 bg-blue-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={9} />
              </div>
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (onOpenEditProfile) onOpenEditProfile();
              if (isMobile && onCloseMobile) onCloseMobile();
            }}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-800/80 transition-colors cursor-pointer text-left group border border-slate-800"
            title="Click to edit your profile and change photo"
          >
            <div className="relative shrink-0">
              <Avatar
                name={currentUser.name}
                src={currentUser.avatar}
                size="sm"
              />
              <div className="absolute -bottom-1 -right-1 p-0.5 bg-blue-600 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-xs">
                <Camera size={9} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-semibold text-white truncate group-hover:text-blue-300 transition-colors">{currentUser.name}</p>
                <Edit3 size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <RoleBadge role={currentUser.role} />
              </div>
            </div>
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar */}
      <aside
        id="main-sidebar"
        className={`hidden md:flex ${
          isCollapsed ? 'w-16' : 'w-64'
        } h-screen bg-slate-900 border-r border-slate-800 flex-col shrink-0 select-none z-20 transition-all duration-200`}
      >
        {/* Brand Header */}
        <div className={`h-16 ${isCollapsed ? 'px-2' : 'px-4'} flex items-center justify-between border-b border-slate-800 shrink-0`}>
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base tracking-wider shadow-sm shrink-0">
                RG
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-base tracking-tight text-white">RG ArtFlow</span>
                  <span className="text-[9px] font-semibold tracking-wider uppercase px-1 py-0.2 bg-slate-800 text-slate-400 border border-slate-700/50 rounded">v2.4</span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium truncate">Art Operations System</p>
              </div>
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm tracking-wider shadow-sm" title="RG ArtFlow v2.4">
                RG
              </div>
            </div>
          )}

          {/* Toggle Collapse Button in Header */}
          {onToggleCollapse && (
            <button
              id="btn-toggle-sidebar"
              type="button"
              onClick={onToggleCollapse}
              title={isCollapsed ? "Expand sidebar (Full Navigation)" : "Collapse sidebar (Icon Only)"}
              className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer ${isCollapsed ? 'hidden' : 'block'}`}
            >
              <PanelLeftClose size={17} />
            </button>
          )}
        </div>

        {/* When collapsed, show expand button at top */}
        {isCollapsed && onToggleCollapse && (
          <div className="p-2 border-b border-slate-800 flex justify-center bg-slate-900/60 shrink-0">
            <button
              id="btn-expand-sidebar"
              type="button"
              onClick={onToggleCollapse}
              title="Expand sidebar"
              className="w-10 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            >
              <PanelLeftOpen size={17} />
            </button>
          </div>
        )}

        {renderNavContent(false)}
      </aside>

      {/* 2. Mobile Slide-Over Drawer */}
      {isMobileOpen && (
        <div id="mobile-sidebar-drawer" className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-150">
          {/* Touch Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Drawer Sheet */}
          <div className="relative w-[300px] max-w-[85vw] h-full bg-slate-900 border-r border-slate-800 flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            {/* Header with Close X */}
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800 shrink-0 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base tracking-wider shadow-sm">
                  RG
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-base tracking-tight text-white">RG ArtFlow</span>
                    <span className="text-[9px] font-semibold uppercase px-1 py-0.2 bg-slate-800 text-slate-400 border border-slate-700/50 rounded">v2.4</span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Art Operations System</p>
                </div>
              </div>

              <button
                id="btn-close-mobile-drawer"
                type="button"
                onClick={onCloseMobile}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Close navigation menu"
              >
                <X size={20} />
              </button>
            </div>

            {renderNavContent(true)}
          </div>
        </div>
      )}
    </>
  );
};
