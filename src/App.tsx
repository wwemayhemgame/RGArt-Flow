import React, { useState, useEffect } from 'react';
import { ArtOpsProvider, useArtOps } from './context/ArtOpsContext';
import { Sidebar, NavTabId } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';

// Views
import { DashboardView } from './components/views/DashboardView';
import { RequestsView } from './components/views/RequestsView';
import { MyTasksView } from './components/views/MyTasksView';
import { BacklogView } from './components/views/BacklogView';
import { SprintsView } from './components/views/SprintsView';
import { KanbanView } from './components/views/KanbanView';
import { CapacityPlanningView } from './components/views/CapacityPlanningView';
import { ArtistsView } from './components/views/ArtistsView';
import { ProjectsView } from './components/views/ProjectsView';
import { CalendarView } from './components/views/CalendarView';
import { ReportsView } from './components/views/ReportsView';
import { DailyTasksReportView } from './components/views/DailyTasksReportView';
import { SprintReportView } from './components/views/SprintReportView';
import { ActivityLogView } from './components/views/ActivityLogView';
import { PeopleView } from './components/views/PeopleView';
import { SettingsView } from './components/views/SettingsView';
import { AdminToolView } from './components/views/AdminToolView';
import { GalleryView } from './components/views/GalleryView';

// Modals
import { CreateRequestModal } from './components/modals/CreateRequestModal';
import { CreateTaskModal } from './components/modals/CreateTaskModal';
import { CreateSprintModal } from './components/modals/CreateSprintModal';
import { CreateProjectModal } from './components/modals/CreateProjectModal';
import { EditProjectModal } from './components/modals/EditProjectModal';
import { TaskDetailModal } from './components/modals/TaskDetailModal';
import { RequestDetailModal } from './components/modals/RequestDetailModal';
import { ManageAccessModal } from './components/modals/ManageAccessModal';
import { AddArtistModal } from './components/modals/AddArtistModal';
import { EditArtistModal } from './components/modals/EditArtistModal';
import { AddPersonModal } from './components/modals/AddPersonModal';
import { AiSprintPlannerModal } from './components/modals/AiSprintPlannerModal';
import { OfficeLoginModal } from './components/auth/OfficeLoginModal';
import { GlobalSearchModal } from './components/search/GlobalSearchModal';
import { EditProfileModal } from './components/modals/EditProfileModal';
import { PermissionDenialModal } from './components/modals/PermissionDenialModal';
import { getRoleProfile } from './utils/rolePermissions';
import { parseTaskShareParams, updateTaskUrlState } from './utils/shareUtils';
import { Artist, Project, User } from './types';

const AppContent: React.FC = () => {
  const {
    tasks,
    requests,
    artists,
    projects,
    users,
    currentUser,
    canAccessAiSprintPlanner,
    isAuthenticated,
    canAccessTab,
    previewRole,
    exitRolePreview,
    denialAlert,
    closeDenialAlert
  } = useArtOps();

  // Navigation State
  const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Modals Open State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isOfficeLoginOpen, setIsOfficeLoginOpen] = useState(false);
  const [isCreateRequestOpen, setIsCreateRequestOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isCreateSprintOpen, setIsCreateSprintOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isAddArtistOpen, setIsAddArtistOpen] = useState(false);
  const [isAddPersonOpen, setIsAddPersonOpen] = useState(false);
  const [isAiPlannerOpen, setIsAiPlannerOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editingUserProfile, setEditingUserProfile] = useState<User | undefined>(undefined);
  const [myTasksFilterParams, setMyTasksFilterParams] = useState<{
    statusFilter?: string;
    workspaceId?: string;
    projectId?: string;
    sprintId?: string;
  } | null>(null);

  const handleNavigateTab = (tab: NavTabId, filters?: any) => {
    if (filters) {
      setMyTasksFilterParams(filters);
    }
    setActiveTab(tab);
  };

  // Helper to open edit profile modal for a given user or current user
  const handleOpenEditProfile = (userToEdit?: User) => {
    setEditingUserProfile(userToEdit || currentUser);
    setIsEditProfileOpen(true);
  };

  // Ensure login modal is open if user is not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setIsOfficeLoginOpen(true);
    }
  }, [isAuthenticated]);

  // Ensure active tab is allowed for current user/role when switching users or permissions
  useEffect(() => {
    if (!canAccessTab(activeTab)) {
      // Find the first accessible tab
      const allTabs: NavTabId[] = [
        'daily-report',
        'sprint-report',
        'dashboard',
        'my-tasks',
        'requests',
        'gallery',
        'kanban',
        'backlog',
        'sprints',
        'calendar',
        'activity',
        'projects',
        'capacity',
        'artists',
        'reports',
        'people',
        'settings',
        'admin-tool'
      ];
      const firstAllowed = allTabs.find(tab => canAccessTab(tab));
      if (firstAllowed && firstAllowed !== activeTab) {
        setActiveTab(firstAllowed);
      }
    }
  }, [currentUser?.id, currentUser?.role, activeTab, canAccessTab]);

  // Auto-close AI Planner if user role switches to Artist or Requester
  useEffect(() => {
    if (!canAccessAiSprintPlanner() && isAiPlannerOpen) {
      setIsAiPlannerOpen(false);
    }
  }, [currentUser.role, isAiPlannerOpen, canAccessAiSprintPlanner]);

  // Edit states
  const [editingArtist, setEditingArtist] = useState<Artist | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const handleOpenAiPlanner = () => {
    if (canAccessAiSprintPlanner()) {
      setIsAiPlannerOpen(true);
    }
  };

  // Inspected Item IDs & Shared URL State
  const [inspectTaskId, setInspectTaskId] = useState<string | null>(null);
  const [taskFullscreen, setTaskFullscreen] = useState(false);
  const [activeFilteredTaskIds, setActiveFilteredTaskIds] = useState<string[] | undefined>(undefined);
  const [inspectRequestId, setInspectRequestId] = useState<string | null>(null);
  const [inspectProjectIdForAccess, setInspectProjectIdForAccess] = useState<string | null>(null);

  // Initialize deep-linked task and fullscreen view from URL (?taskId=...&fullscreen=true)
  useEffect(() => {
    const { taskId, isFullscreen } = parseTaskShareParams();
    if (taskId) {
      setInspectTaskId(taskId);
      setTaskFullscreen(isFullscreen);
    }
  }, []);

  // Sync state on browser history navigation (back / forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const { taskId, isFullscreen } = parseTaskShareParams();
      setInspectTaskId(taskId);
      setTaskFullscreen(isFullscreen);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSelectTask = (taskId: string, activeList?: string[], fullscreen: boolean = false) => {
    setInspectTaskId(taskId);
    setTaskFullscreen(fullscreen);
    updateTaskUrlState(taskId, fullscreen);
    if (activeList && activeList.length > 0) {
      setActiveFilteredTaskIds(activeList);
    }
  };

  const handleCloseTaskDetail = () => {
    setInspectTaskId(null);
    setTaskFullscreen(false);
    updateTaskUrlState(null, false);
  };

  // Selected Task & Request objects (supports resolution by ID or Jira Issue Key)
  const selectedTask = inspectTaskId
    ? tasks.find(t => t.id === inspectTaskId || (t.jiraIssueKey && t.jiraIssueKey.toUpperCase() === inspectTaskId.toUpperCase())) || null
    : null;
  const selectedRequest = inspectRequestId ? requests.find(r => r.id === inspectRequestId) || null : null;

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K opens search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Strict Security Gate: If user is not authenticated, do not render studio workspace or data
  if (!isAuthenticated) {
    return (
      <div id="rg-artflow-auth-gateway" className="flex h-screen w-screen items-center justify-center bg-slate-950">
        <OfficeLoginModal
          isOpen={true}
          onLoginSuccess={() => {
            setIsOfficeLoginOpen(false);
          }}
        />
      </div>
    );
  }

  return (
    <div id="rg-artflow-app-root" className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Persistent Desktop Sidebar & Mobile Slide-Out Drawer */}
      <Sidebar
        activeTab={activeTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onTabChange={(tab) => {
          setActiveTab(tab);
        }}
        onOpenAiAssistant={handleOpenAiPlanner}
        onOpenEditProfile={() => handleOpenEditProfile()}
      />

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-50 relative">
        {/* Role Preview Banner */}
        {previewRole && (
          <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 text-white px-4 py-2 shadow-md flex items-center justify-between z-40 sticky top-0 shrink-0 border-b border-amber-400">
            <div className="flex items-center gap-2.5">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 text-white text-xs font-bold ring-2 ring-white/30 shrink-0">
                👁
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-xs tracking-wide">Viewing Studio As:</span>
                <span className="px-2 py-0.5 rounded-full bg-white text-amber-950 font-black text-xs shadow-2xs uppercase tracking-wider">
                  {getRoleProfile(previewRole).name}
                </span>
                <span className="text-[11px] text-amber-100 hidden sm:inline">
                  (Safe simulation mode • Real account permissions remain unchanged)
                </span>
              </div>
            </div>
            <button
              onClick={exitRolePreview}
              className="px-3 py-1 bg-white hover:bg-amber-50 text-amber-950 font-bold text-xs rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95"
            >
              Exit Preview
            </button>
          </div>
        )}

        {/* Top Navbar */}
        <Navbar
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenOfficeLogin={() => setIsOfficeLoginOpen(true)}
          onOpenGallery={() => setActiveTab('gallery')}
          onOpenEditProfile={() => handleOpenEditProfile()}
          onOpenCreateRequest={() => setIsCreateRequestOpen(true)}
          onOpenCreateTask={() => setIsCreateTaskOpen(true)}
          onOpenCreateSprint={() => setIsCreateSprintOpen(true)}
          onOpenCreateProject={() => setIsCreateProjectOpen(true)}
          onOpenAiPlanner={handleOpenAiPlanner}
          onNavigateToTask={(taskId) => {
            setInspectTaskId(taskId);
            // Also switch to corresponding view if relevant
            const task = tasks.find(t => t.id === taskId);
            if (task && currentUser.role === 'ARTIST' && task.artistId === currentUser.artistId) {
              setActiveTab('my-tasks');
            } else if (task && task.status === 'BACKLOG') {
              setActiveTab('backlog');
            } else {
              setActiveTab('kanban');
            }
          }}
          onNavigateToRequest={(requestId) => {
            setInspectRequestId(requestId);
            setActiveTab('requests');
          }}
          onNavigateTab={(tab) => {
            setActiveTab(tab as NavTabId);
          }}
          onNavigateToProject={(projectId) => {
            setActiveTab('projects');
          }}
          onNavigateToArtist={(artistId) => {
            const artist = artists.find(a => a.id === artistId);
            if (artist) {
              setEditingArtist(artist);
            }
            setActiveTab('artists');
          }}
          onNavigateToSprint={(sprintId) => {
            setActiveTab('sprints');
          }}
        />

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/70 scrollbar-thin pb-20 md:pb-0">
          {activeTab === 'dashboard' && (
            <DashboardView
              onSelectTask={(id) => setInspectTaskId(id)}
              onSelectRequest={(id) => setInspectRequestId(id)}
              onOpenCreateRequest={() => setIsCreateRequestOpen(true)}
              onOpenCreateTask={() => setIsCreateTaskOpen(true)}
              onOpenAiPlanner={handleOpenAiPlanner}
              onNavigateTab={handleNavigateTab}
            />
          )}

          {activeTab === 'gallery' && (
            <GalleryView
              onSelectTask={(id) => setInspectTaskId(id)}
            />
          )}

          {activeTab === 'admin-tool' && (
            <AdminToolView
              onOpenAddPerson={() => setIsAddPersonOpen(true)}
              onOpenCreateProject={() => setIsCreateProjectOpen(true)}
              onEditArtist={(artistId) => {
                const art = artists.find(a => a.id === artistId);
                if (art) setEditingArtist(art);
              }}
              onEditProject={(projectId) => {
                const proj = projects.find(p => p.id === projectId);
                if (proj) setEditingProject(proj);
              }}
              onManageProjectAccess={(projectId) => setInspectProjectIdForAccess(projectId)}
            />
          )}

          {activeTab === 'requests' && (
            <RequestsView
              onSelectRequest={(id) => setInspectRequestId(id)}
              onOpenCreateRequest={() => setIsCreateRequestOpen(true)}
              onNavigateToTask={handleSelectTask}
            />
          )}

          {activeTab === 'my-tasks' && (
            <MyTasksView
              onSelectTask={handleSelectTask}
              initialFilters={myTasksFilterParams}
            />
          )}

          {activeTab === 'backlog' && (
            <BacklogView
              onSelectTask={handleSelectTask}
              onOpenCreateTask={() => setIsCreateTaskOpen(true)}
              onOpenAiPlanner={handleOpenAiPlanner}
              onNavigateToRequest={(requestId) => setInspectRequestId(requestId)}
              onNavigateToSettings={() => setActiveTab('settings')}
            />
          )}

          {activeTab === 'sprints' && (
            <SprintsView
              onSelectTask={handleSelectTask}
              onOpenCreateSprint={() => setIsCreateSprintOpen(true)}
              onOpenCreateTask={() => setIsCreateTaskOpen(true)}
              onOpenAiPlanner={handleOpenAiPlanner}
            />
          )}

          {activeTab === 'kanban' && (
            <KanbanView
              onSelectTask={handleSelectTask}
              onOpenCreateTask={() => setIsCreateTaskOpen(true)}
            />
          )}

          {activeTab === 'capacity' && (
            <CapacityPlanningView
              onOpenAiPlanner={handleOpenAiPlanner}
              onEditArtist={(artist) => setEditingArtist(artist)}
            />
          )}

          {activeTab === 'artists' && (
            <ArtistsView
              onOpenAddArtist={() => setIsAddArtistOpen(true)}
              onEditArtist={(artist) => setEditingArtist(artist)}
            />
          )}

          {activeTab === 'daily-report' && (
            <DailyTasksReportView
              onSelectTask={handleSelectTask}
              onNavigateToTaskList={(filters) => handleNavigateTab('my-tasks', filters)}
            />
          )}

          {activeTab === 'sprint-report' && (
            <SprintReportView
              onSelectTask={handleSelectTask}
              onNavigateToTaskList={(filters) => handleNavigateTab('my-tasks', filters)}
            />
          )}

          {activeTab === 'projects' && (
            <ProjectsView
              onSelectTask={handleSelectTask}
              onOpenCreateProject={() => setIsCreateProjectOpen(true)}
              onEditProject={(project) => setEditingProject(project)}
              onOpenManageAccess={(projectId) => setInspectProjectIdForAccess(projectId)}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarView
              onSelectTask={handleSelectTask}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              onSelectTask={handleSelectTask}
            />
          )}

          {activeTab === 'activity' && (
            <ActivityLogView />
          )}

          {activeTab === 'people' && (
            <PeopleView
              onOpenAddPerson={() => setIsAddPersonOpen(true)}
              onOpenOfficeLogin={() => setIsOfficeLoginOpen(true)}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView />
          )}
        </main>

        {/* Mobile Persistent Bottom Navigation Bar */}
        <MobileBottomNav
          activeTab={activeTab}
          onTabChange={(tab) => setActiveTab(tab)}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          onOpenCreateModal={() => setIsCreateRequestOpen(true)}
        />
      </div>

      {/* Modals Suite */}
      <OfficeLoginModal
        isOpen={isOfficeLoginOpen}
        onClose={() => setIsOfficeLoginOpen(false)}
      />
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectTask={(id) => {
          setInspectTaskId(id);
          setIsSearchOpen(false);
        }}
        onSelectRequest={(id) => {
          setInspectRequestId(id);
          setIsSearchOpen(false);
        }}
        onSelectProject={(id) => {
          setActiveTab('projects');
          setIsSearchOpen(false);
        }}
        onSelectArtist={(id) => {
          setActiveTab('artists');
          setIsSearchOpen(false);
        }}
      />

      <CreateRequestModal
        isOpen={isCreateRequestOpen}
        onClose={() => setIsCreateRequestOpen(false)}
      />

      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
      />

      <CreateSprintModal
        isOpen={isCreateSprintOpen}
        onClose={() => setIsCreateSprintOpen(false)}
      />

      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
      />

      <AddArtistModal
        isOpen={isAddArtistOpen}
        onClose={() => setIsAddArtistOpen(false)}
      />

      <AddPersonModal
        isOpen={isAddPersonOpen}
        onClose={() => setIsAddPersonOpen(false)}
      />

      <EditArtistModal
        isOpen={!!editingArtist}
        onClose={() => setEditingArtist(null)}
        artist={editingArtist}
      />

      <EditProjectModal
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        project={editingProject}
      />

      <AiSprintPlannerModal
        isOpen={isAiPlannerOpen}
        onClose={() => setIsAiPlannerOpen(false)}
        onNavigateToTask={(id) => setInspectTaskId(id)}
      />

      <TaskDetailModal
        isOpen={!!inspectTaskId}
        onClose={handleCloseTaskDetail}
        task={selectedTask}
        taskId={inspectTaskId}
        initialFullscreen={taskFullscreen}
        activeTaskIds={activeFilteredTaskIds}
        onNavigateTask={(id) => {
          setInspectTaskId(id);
          updateTaskUrlState(id, taskFullscreen);
        }}
        onOpenEditProfile={(user) => handleOpenEditProfile(user)}
      />

      <RequestDetailModal
        isOpen={!!selectedRequest}
        onClose={() => setInspectRequestId(null)}
        request={selectedRequest}
        onNavigateToTask={(taskId) => setInspectTaskId(taskId)}
      />

      {inspectProjectIdForAccess && (
        <ManageAccessModal
          isOpen={!!inspectProjectIdForAccess}
          onClose={() => setInspectProjectIdForAccess(null)}
          projectId={inspectProjectIdForAccess}
        />
      )}

      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => {
          setIsEditProfileOpen(false);
          setEditingUserProfile(undefined);
        }}
        targetUser={editingUserProfile}
      />

      {denialAlert && (
        <PermissionDenialModal
          isOpen={denialAlert.isOpen}
          onClose={closeDenialAlert}
          actionName={denialAlert.actionName}
          roleName={denialAlert.roleName}
          reason={denialAlert.reason}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <ArtOpsProvider>
      <AppContent />
    </ArtOpsProvider>
  );
}
