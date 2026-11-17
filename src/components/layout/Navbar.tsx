import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Plus,
  Bell,
  Sparkles,
  ChevronDown,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Layers,
  FilePlus2,
  FolderPlus,
  UserPlus,
  ShieldPlus,
  Shield,
  IdCard,
  LogIn,
  LogOut,
  Mail,
  Inbox,
  Palette,
  Briefcase,
  Check,
  Images,
  Camera,
  UserCog,
  Edit3,
  Menu
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { Avatar } from '../common/Avatar';
import { RoleBadge } from '../common/Badge';

interface NavbarProps {
  onOpenSearch: () => void;
  onOpenMobileMenu?: () => void;
  onOpenAiAssistant?: () => void;
  onOpenAiPlanner?: () => void;
  onOpenOfficeLogin?: () => void;
  onOpenGallery?: () => void;
  onOpenEditProfile?: () => void;
  onQuickCreate?: (type: 'request' | 'task' | 'sprint' | 'project' | 'artist' | 'access') => void;
  onOpenCreateRequest?: () => void;
  onOpenCreateTask?: () => void;
  onOpenCreateSprint?: () => void;
  onOpenCreateProject?: () => void;
  onNavigateToTask?: (taskId: string) => void;
  onNavigateToRequest?: (requestId: string) => void;
  onNavigateTab?: (tab: string) => void;
  onNavigateToProject?: (projectId: string) => void;
  onNavigateToArtist?: (artistId: string) => void;
  onNavigateToSprint?: (sprintId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSearch,
  onOpenMobileMenu,
  onOpenAiAssistant,
  onOpenAiPlanner,
  onOpenOfficeLogin,
  onOpenGallery,
  onOpenEditProfile,
  onQuickCreate,
  onOpenCreateRequest,
  onOpenCreateTask,
  onOpenCreateSprint,
  onOpenCreateProject,
  onNavigateToTask,
  onNavigateToRequest,
  onNavigateTab,
  onNavigateToProject,
  onNavigateToArtist,
  onNavigateToSprint
}) => {
  const handleQuickCreate = (type: 'request' | 'task' | 'sprint' | 'project' | 'artist' | 'access') => {
    if (onQuickCreate) {
      onQuickCreate(type);
      return;
    }
    if (type === 'request' && onOpenCreateRequest) onOpenCreateRequest();
    else if (type === 'task' && onOpenCreateTask) onOpenCreateTask();
    else if (type === 'sprint' && onOpenCreateSprint) onOpenCreateSprint();
    else if (type === 'project' && onOpenCreateProject) onOpenCreateProject();
  };
  const {
    currentUser,
    setCurrentUser,
    isAuthenticated,
    logout,
    users,
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    canManageSprint,
    canCreateProject,
    studioMails
  } = useArtOps();

  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUserSwitcherOpen, setIsUserSwitcherOpen] = useState(false);

  const quickCreateRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const userSwitchRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (quickCreateRef.current && !quickCreateRef.current.contains(e.target as Node)) {
        setIsQuickCreateOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (userSwitchRef.current && !userSwitchRef.current.contains(e.target as Node)) {
        setIsUserSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter notifications for current user
  const userNotifications = notifications.filter(
    n => !n.userId || (currentUser?.id && n.userId === currentUser.id) || n.userId === 'all'
  );
  const unreadCount = userNotifications.filter(n => !n.read).length;

  return (
    <header
      id="main-navbar"
      className="h-16 bg-white border-b border-slate-200 px-3 sm:px-6 md:px-8 flex items-center justify-between z-10 shrink-0 select-none gap-2"
    >
      {/* Mobile Hamburger & Brand (Visible on small screens) */}
      <div className="flex items-center gap-2 md:hidden shrink-0">
        {onOpenMobileMenu && (
          <button
            id="btn-open-mobile-menu"
            type="button"
            onClick={onOpenMobileMenu}
            className="p-2 -ml-1 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Open mobile navigation"
          >
            <Menu size={20} />
          </button>
        )}
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
          RG
        </div>
      </div>

      {/* Search Bar & Global Command Palette trigger */}
      <div className="flex items-center gap-2 flex-1 max-w-xl min-w-0">
        <button
          id="btn-global-search-trigger"
          type="button"
          onClick={onOpenSearch}
          className="w-full flex items-center justify-between px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-slate-200 bg-slate-100 text-slate-500 text-xs hover:border-slate-300 hover:bg-slate-100/80 transition-colors shadow-2xs cursor-pointer focus:ring-2 focus:ring-blue-500 outline-hidden"
        >
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <Search size={14} className="text-slate-400 shrink-0" />
            <span className="truncate hidden sm:inline">Search tasks (e.g. WWEART-0124), requests, projects...</span>
            <span className="truncate inline sm:hidden text-[11px]">Search...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 rounded-full shadow-2xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Actions: Quick Create + AI Assistant + Notifications + Role Switcher */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Quick Create Dropdown */}
        <div className="relative" ref={quickCreateRef}>
          <button
            id="btn-quick-create-menu"
            type="button"
            onClick={() => setIsQuickCreateOpen(!isQuickCreateOpen)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer"
          >
            <Plus size={15} />
            <span>Create</span>
            <ChevronDown size={13} className="text-slate-400" />
          </button>

          {isQuickCreateOpen && (
            <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
              <button
                id="btn-create-request-item"
                type="button"
                onClick={() => {
                  setIsQuickCreateOpen(false);
                  handleQuickCreate('request');
                }}
                className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 font-medium cursor-pointer"
              >
                <FilePlus2 size={15} className="text-blue-600" />
                <div>
                  <div className="font-semibold text-slate-900">Create Art Request</div>
                  <div className="text-[11px] text-slate-400">Company art submission</div>
                </div>
              </button>

              {currentUser?.role !== 'COMPANY_REQUESTER' && (
                <button
                  id="btn-create-task-item"
                  type="button"
                  onClick={() => {
                    setIsQuickCreateOpen(false);
                    handleQuickCreate('task');
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 font-medium cursor-pointer"
                >
                  <Plus size={15} className="text-emerald-600" />
                  <div>
                    <div className="font-semibold text-slate-900">Create Project Task</div>
                    <div className="text-[11px] text-slate-400">Generates Project Task ID</div>
                  </div>
                </button>
              )}

              {currentUser?.role !== 'COMPANY_REQUESTER' && canManageSprint() && (
                <button
                  id="btn-create-sprint-item"
                  type="button"
                  onClick={() => {
                    setIsQuickCreateOpen(false);
                    handleQuickCreate('sprint');
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 font-medium cursor-pointer"
                >
                  <Layers size={15} className="text-indigo-600" />
                  <div>
                    <div className="font-semibold text-slate-900">Create Sprint</div>
                    <div className="text-[11px] text-slate-400">New production cycle</div>
                  </div>
                </button>
              )}

              {currentUser?.role !== 'COMPANY_REQUESTER' && canCreateProject() && (
                <button
                  id="btn-create-project-item"
                  type="button"
                  onClick={() => {
                    setIsQuickCreateOpen(false);
                    handleQuickCreate('project');
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 font-medium cursor-pointer"
                >
                  <FolderPlus size={15} className="text-amber-600" />
                  <div>
                    <div className="font-semibold text-slate-900">New Project</div>
                    <div className="text-[11px] text-slate-400">Register project key & team</div>
                  </div>
                </button>
              )}

              {currentUser?.role !== 'COMPANY_REQUESTER' && canCreateProject() && (
                <>
                  <div className="h-px bg-slate-100 my-1" />
                  <button
                    id="btn-add-artist-item"
                    type="button"
                    onClick={() => {
                      setIsQuickCreateOpen(false);
                      handleQuickCreate('artist');
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 font-medium cursor-pointer"
                  >
                    <UserPlus size={14} className="text-slate-500" />
                    <span>Add Artist to Roster</span>
                  </button>

                  <button
                    id="btn-manage-access-item"
                    type="button"
                    onClick={() => {
                      setIsQuickCreateOpen(false);
                      handleQuickCreate('access');
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-slate-700 font-medium cursor-pointer"
                  >
                    <ShieldPlus size={14} className="text-slate-500" />
                    <span>Manage User Access</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Media Gallery Button */}
        {onOpenGallery && (
          <button
            id="btn-nav-gallery-toggle"
            type="button"
            onClick={onOpenGallery}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 text-slate-700 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
            title="Open Media Gallery (Images, Videos, GIFs)"
          >
            <Images size={15} className="text-indigo-600" />
            <span className="hidden md:inline">Gallery</span>
          </button>
        )}

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            id="btn-notifications-toggle"
            type="button"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 mt-1.5 w-84 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-50 animate-in fade-in duration-100">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-slate-900">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsAsRead}
                    className="text-[11px] text-slate-500 hover:text-slate-900 font-medium cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {userNotifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No notifications yet
                  </div>
                ) : (
                  userNotifications.map(n => (
                    <div
                      key={n.id}
                      onClick={() => {
                        markNotificationAsRead(n.id);
                        if (n.linkType === 'task' && n.linkId && onNavigateToTask) {
                          onNavigateToTask(n.linkId);
                          setIsNotificationsOpen(false);
                        } else if (n.linkType === 'request' && n.linkId && onNavigateToRequest) {
                          onNavigateToRequest(n.linkId);
                          setIsNotificationsOpen(false);
                        } else if (n.linkType === 'project' && n.linkId && onNavigateToProject) {
                          onNavigateToProject(n.linkId);
                          setIsNotificationsOpen(false);
                        } else if (n.linkType === 'artist' && n.linkId && onNavigateToArtist) {
                          onNavigateToArtist(n.linkId);
                          setIsNotificationsOpen(false);
                        } else if (n.linkType === 'sprint' && n.linkId && onNavigateToSprint) {
                          onNavigateToSprint(n.linkId);
                          setIsNotificationsOpen(false);
                        } else if (n.linkType === 'tab' && n.targetTab && onNavigateTab) {
                          onNavigateTab(n.targetTab);
                          setIsNotificationsOpen(false);
                        } else if (n.targetTab && onNavigateTab) {
                          onNavigateTab(n.targetTab);
                          setIsNotificationsOpen(false);
                        } else if (n.linkType === 'activity' && onNavigateTab) {
                          onNavigateTab('activity');
                          setIsNotificationsOpen(false);
                        } else if (n.linkType === 'access' && onNavigateTab) {
                          onNavigateTab('people');
                          setIsNotificationsOpen(false);
                        }
                      }}
                      className={`p-3 text-xs hover:bg-slate-50 transition-colors cursor-pointer ${
                        !n.read ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5">
                          {n.type === 'alert' && <AlertTriangle size={14} className="text-rose-500 shrink-0" />}
                          {n.type === 'warning' && <Clock size={14} className="text-amber-500 shrink-0" />}
                          {n.type === 'success' && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
                          {n.type === 'info' && <Info size={14} className="text-blue-500 shrink-0" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 text-xs">{n.title}</p>
                          <p className="text-slate-600 text-[11px] mt-0.5 leading-snug">{n.message}</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">{n.timestamp}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Account & Role Profile Menu */}
        <div className="relative" ref={userSwitchRef}>
          <button
            id="btn-user-switcher-dropdown"
            type="button"
            onClick={() => setIsUserSwitcherOpen(!isUserSwitcherOpen)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer bg-white"
          >
            <Avatar name={currentUser?.name || 'User'} src={currentUser?.avatar} size="xs" />
            <div className="text-left hidden sm:block">
              <p className="text-xs font-semibold text-slate-900 leading-tight">{currentUser?.name || 'User'}</p>
              <span className="text-[10px] text-slate-500 block leading-tight">{currentUser?.title || ''}</span>
            </div>
            <ChevronDown size={13} className="text-slate-400 ml-1" />
          </button>

          {isUserSwitcherOpen && (
            <div className="absolute right-0 mt-1.5 w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl py-2 z-50 text-xs animate-in fade-in duration-100">
              {/* User Header with Clickable Profile & Photo Edit */}
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/90 rounded-t-2xl">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserSwitcherOpen(false);
                      if (onOpenEditProfile) onOpenEditProfile();
                    }}
                    className="flex items-center gap-3 text-left min-w-0 flex-1 hover:opacity-80 transition-opacity cursor-pointer group"
                    title="Click to edit profile & change photo"
                  >
                    <div className="relative shrink-0">
                      <Avatar name={currentUser?.name || 'User'} src={currentUser?.avatar} size="md" />
                      <div className="absolute -bottom-1 -right-1 p-0.5 bg-blue-600 rounded-full text-white shadow-xs">
                        <Camera size={10} />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-bold text-slate-900 truncate leading-tight group-hover:text-blue-600 transition-colors">
                          {currentUser?.name || 'Studio Member'}
                        </p>
                        <Edit3 size={11} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{currentUser?.email || ''}</p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {currentUser?.role && <RoleBadge role={currentUser.role} />}
                        <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700">
                          {currentUser?.officeId || 'OFF-1001'}
                        </span>
                      </div>
                    </div>
                  </button>
                </div>

                {onOpenEditProfile && (
                  <button
                    id="btn-edit-profile-action"
                    type="button"
                    onClick={() => {
                      setIsUserSwitcherOpen(false);
                      onOpenEditProfile();
                    }}
                    className="mt-2.5 w-full py-1.5 px-3 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-blue-700 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                  >
                    <UserCog size={13} />
                    <span>Edit Profile & Change Photo</span>
                  </button>
                )}
              </div>

              {/* Current User Session Status */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">Department:</span>
                  <span className="font-semibold text-slate-800">{currentUser?.department || 'Art Department'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">Studio Office ID:</span>
                  <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 text-[11px]">
                    {currentUser?.officeId || 'OFF-1001'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-[11px]">Status:</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    <span>Active Session</span>
                  </span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-2 bg-white space-y-1.5">
                {onOpenOfficeLogin && (
                  <button
                    id="btn-nav-office-id-login"
                    type="button"
                    onClick={() => {
                      setIsUserSwitcherOpen(false);
                      onOpenOfficeLogin();
                    }}
                    className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <IdCard size={14} className="text-blue-600" />
                    <span>Office ID Credentials</span>
                  </button>
                )}

                <button
                  id="btn-nav-logout"
                  type="button"
                  onClick={() => {
                    setIsUserSwitcherOpen(false);
                    logout();
                    if (onOpenOfficeLogin) onOpenOfficeLogin();
                  }}
                  className="w-full py-1.5 px-3 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
