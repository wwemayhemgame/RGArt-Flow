import React from 'react';
import {
  LayoutDashboard,
  Kanban,
  CheckSquare,
  ListTodo,
  Menu,
  FileText,
  Clock,
  Sparkles,
  ShieldAlert
} from 'lucide-react';
import { NavigationTab } from './Sidebar';
import { useArtOps } from '../../context/ArtOpsContext';

interface MobileBottomNavProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  onOpenMobileMenu: () => void;
  onOpenCreateModal?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  onOpenMobileMenu,
  onOpenCreateModal
}) => {
  const { currentUser, tasks, requests } = useArtOps();

  const isRequester = currentUser?.role === 'COMPANY_REQUESTER';

  // Badges
  const openRequestsCount = isRequester
    ? requests.filter(r => ((currentUser?.id && r.requesterId === currentUser.id) || (currentUser?.name && r.requesterName.toLowerCase() === currentUser.name.toLowerCase())) && r.status !== 'DELIVERED' && r.status !== 'REJECTED').length
    : requests.filter(r => r.status !== 'DELIVERED' && r.status !== 'REJECTED').length;

  const myTasksCount = tasks.filter(t => {
    if (t.status === 'DONE') return false;
    if (currentUser?.artistId && t.artistId === currentUser.artistId) return true;
    if (currentUser?.id && (t.artistId === currentUser.id || t.requesterId === currentUser.id)) return true;
    return false;
  }).length;

  const blockedCount = tasks.filter(t => t.status === 'BLOCKED').length;

  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800/90 px-2 py-1 flex items-center justify-around select-none shadow-[0_-4px_20px_rgba(0,0,0,0.3)] safe-area-bottom"
    >
      {/* 1. Dashboard */}
      <button
        type="button"
        id="mobile-nav-dashboard"
        onClick={() => onTabChange('dashboard')}
        className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-1.5 rounded-xl transition-all cursor-pointer ${
          activeTab === 'dashboard'
            ? 'text-blue-400 font-bold'
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <div className="relative">
          <LayoutDashboard size={20} className={activeTab === 'dashboard' ? 'stroke-[2.5]' : 'stroke-[1.75]'} />
          {activeTab === 'dashboard' && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full" />
          )}
        </div>
        <span className="text-[10px] tracking-tight mt-0.5">Dashboard</span>
      </button>

      {/* 2. Kanban Board (or Requests for requesters) */}
      {!isRequester ? (
        <button
          type="button"
          id="mobile-nav-kanban"
          onClick={() => onTabChange('kanban')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-1.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'kanban'
              ? 'text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Kanban size={20} className={activeTab === 'kanban' ? 'stroke-[2.5]' : 'stroke-[1.75]'} />
            {blockedCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-rose-600 text-white text-[9px] font-extrabold ring-1 ring-slate-900">
                {blockedCount}
              </span>
            )}
            {activeTab === 'kanban' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Kanban</span>
        </button>
      ) : (
        <button
          type="button"
          id="mobile-nav-requests"
          onClick={() => onTabChange('requests')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-1.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'requests'
              ? 'text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <FileText size={20} className={activeTab === 'requests' ? 'stroke-[2.5]' : 'stroke-[1.75]'} />
            {openRequestsCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-blue-500 text-white text-[9px] font-extrabold ring-1 ring-slate-900">
                {openRequestsCount}
              </span>
            )}
            {activeTab === 'requests' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Requests</span>
        </button>
      )}

      {/* 3. My Work / Backlog */}
      {!isRequester ? (
        <button
          type="button"
          id="mobile-nav-my-tasks"
          onClick={() => onTabChange(currentUser?.role === 'ARTIST' ? 'my-tasks' : 'backlog')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-1.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'my-tasks' || activeTab === 'backlog'
              ? 'text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            {currentUser?.role === 'ARTIST' ? (
              <CheckSquare size={20} className={activeTab === 'my-tasks' ? 'stroke-[2.5]' : 'stroke-[1.75]'} />
            ) : (
              <ListTodo size={20} className={activeTab === 'backlog' ? 'stroke-[2.5]' : 'stroke-[1.75]'} />
            )}
            {myTasksCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-emerald-500 text-white text-[9px] font-extrabold ring-1 ring-slate-900">
                {myTasksCount}
              </span>
            )}
            {(activeTab === 'my-tasks' || activeTab === 'backlog') && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">
            {currentUser?.role === 'ARTIST' ? 'My Work' : 'Backlog'}
          </span>
        </button>
      ) : null}

      {/* 4. Requests (for non-requesters) or Gallery */}
      {!isRequester ? (
        <button
          type="button"
          id="mobile-nav-requests-tab"
          onClick={() => onTabChange('requests')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-1.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'requests'
              ? 'text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <FileText size={20} className={activeTab === 'requests' ? 'stroke-[2.5]' : 'stroke-[1.75]'} />
            {openRequestsCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 rounded-full bg-blue-500 text-white text-[9px] font-extrabold ring-1 ring-slate-900">
                {openRequestsCount}
              </span>
            )}
            {activeTab === 'requests' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-blue-400 rounded-full" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-0.5">Requests</span>
        </button>
      ) : null}

      {/* 5. More / All Modules Drawer Opener */}
      <button
        type="button"
        id="mobile-nav-more-menu"
        onClick={onOpenMobileMenu}
        className="flex flex-col items-center justify-center min-w-[56px] min-h-[48px] py-1 px-1.5 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
      >
        <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-200">
          <Menu size={16} />
        </div>
        <span className="text-[10px] tracking-tight mt-0.5 text-slate-300 font-medium">Menu</span>
      </button>
    </nav>
  );
};
