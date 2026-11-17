import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, CheckSquare, Users, FolderKanban, ArrowRight, X } from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { TaskStatusBadge, PriorityBadge, RequestStatusBadge } from '../common/Badge';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTask: (taskId: string) => void;
  onSelectRequest: (requestId: string) => void;
  onSelectProject?: (projectId: string) => void;
  onSelectArtist?: (artistId: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectTask,
  onSelectRequest,
  onSelectProject,
  onSelectArtist
}) => {
  const { tasks, requests, projects, artists } = useArtOps();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Handle ESC or global keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.trim().toLowerCase();

  // Search Results
  const matchedTasks = q
    ? tasks.filter(
        t =>
          t.id.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.tags?.some(tag => tag.toLowerCase().includes(q)) ||
          t.taskType.toLowerCase().includes(q)
      ).slice(0, 5)
    : tasks.slice(0, 3);

  const matchedRequests = q
    ? requests.filter(
        r =>
          r.id.toLowerCase().includes(q) ||
          r.taskTitle.toLowerCase().includes(q) ||
          r.requesterName.toLowerCase().includes(q) ||
          r.artCategory.toLowerCase().includes(q) ||
          r.taskId?.toLowerCase().includes(q)
      ).slice(0, 4)
    : requests.slice(0, 3);

  const matchedProjects = q
    ? projects.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.key.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      ).slice(0, 3)
    : projects.slice(0, 2);

  const matchedArtists = q
    ? artists.filter(
        a =>
          a.name.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q) ||
          a.specialization.toLowerCase().includes(q)
      ).slice(0, 3)
    : [];

  return (
    <div
      id="global-search-modal-backdrop"
      className="fixed inset-0 z-50 overflow-y-auto bg-zinc-900/40 backdrop-blur-xs flex items-start justify-center pt-16 sm:pt-24 p-4 animate-in fade-in duration-100"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="global-search-modal"
        className="bg-white w-full max-w-2xl rounded-xl border border-zinc-200 shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Search Input */}
        <div className="px-4 py-3.5 border-b border-zinc-100 flex items-center gap-3">
          <Search size={18} className="text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            id="input-global-search"
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search tasks (e.g. WWEART-0124), requests (e.g. REQ-2001), projects, artists..."
            className="w-full text-sm text-zinc-900 placeholder:text-zinc-400 outline-hidden bg-transparent"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-zinc-400 hover:text-zinc-600 p-1 rounded hover:bg-zinc-100"
            >
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center text-[10px] text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-zinc-50">
          {/* Tasks Section */}
          {matchedTasks.length > 0 && (
            <div className="py-2">
              <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                <span>Tasks</span>
                <span className="text-[10px] font-normal text-zinc-400">Jump to task</span>
              </div>
              <div className="space-y-0.5">
                {matchedTasks.map((task) => (
                  <button
                    key={task.id}
                    id={`search-result-task-${task.id}`}
                    type="button"
                    onClick={() => {
                      onSelectTask(task.id);
                      onClose();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-50 flex items-center justify-between group transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded bg-zinc-100 flex items-center justify-center text-zinc-500 shrink-0">
                        <CheckSquare size={13} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-zinc-900">{task.id}</span>
                          <span className="text-xs text-zinc-700 font-medium truncate">{task.title}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate">
                          {task.taskType} • {task.remainingEstimate}h remaining • Due {task.dueDate}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <TaskStatusBadge status={task.status} />
                      <ArrowRight size={13} className="text-zinc-300 group-hover:text-zinc-600 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Company Requests Section */}
          {matchedRequests.length > 0 && (
            <div className="py-2">
              <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                <span>Company Requests</span>
                <span className="text-[10px] font-normal text-zinc-400">Company Portal</span>
              </div>
              <div className="space-y-0.5">
                {matchedRequests.map((req) => (
                  <button
                    key={req.id}
                    id={`search-result-request-${req.id}`}
                    type="button"
                    onClick={() => {
                      onSelectRequest(req.id);
                      onClose();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-50 flex items-center justify-between group transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                        <FileText size={13} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-blue-700">{req.id}</span>
                          <span className="text-xs text-zinc-800 font-medium truncate">{req.taskTitle}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate">
                          From {req.requesterName} ({req.requesterDepartment}) • Category: {req.artCategory}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <RequestStatusBadge status={req.status} />
                      <ArrowRight size={13} className="text-zinc-300 group-hover:text-zinc-600 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Projects Section */}
          {matchedProjects.length > 0 && (
            <div className="py-2">
              <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Projects
              </div>
              <div className="space-y-0.5">
                {matchedProjects.map((proj) => (
                  <button
                    key={proj.id}
                    id={`search-result-project-${proj.id}`}
                    type="button"
                    onClick={() => {
                      if (onSelectProject) onSelectProject(proj.id);
                      onClose();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-50 flex items-center justify-between group transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded bg-amber-50 flex items-center justify-center text-amber-700 shrink-0 font-bold text-[10px]">
                        {proj.key.substring(0, 3)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-900">{proj.name}</span>
                          <span className="font-mono text-[10px] text-zinc-400 bg-zinc-100 px-1 rounded">{proj.key}</span>
                        </div>
                        <p className="text-[11px] text-zinc-400 truncate">{proj.description}</p>
                      </div>
                    </div>
                    <ArrowRight size={13} className="text-zinc-300 group-hover:text-zinc-600 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Artists Section */}
          {matchedArtists.length > 0 && (
            <div className="py-2">
              <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Artists
              </div>
              <div className="space-y-0.5">
                {matchedArtists.map((artist) => (
                  <button
                    key={artist.id}
                    id={`search-result-artist-${artist.id}`}
                    type="button"
                    onClick={() => {
                      if (onSelectArtist) onSelectArtist(artist.id);
                      onClose();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-50 flex items-center justify-between group transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-700 shrink-0 font-bold text-[10px]">
                        {artist.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold text-zinc-900">{artist.name}</span>
                        <p className="text-[11px] text-zinc-400 truncate">{artist.role} • {artist.specialization}</p>
                      </div>
                    </div>
                    <ArrowRight size={13} className="text-zinc-300 group-hover:text-zinc-600 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedTasks.length === 0 && matchedRequests.length === 0 && matchedProjects.length === 0 && (
            <div className="py-12 text-center text-xs text-zinc-400">
              No matching tasks, requests, or projects found for "{query}"
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 border-t border-zinc-100 bg-zinc-50/70 text-[11px] text-zinc-400 flex items-center justify-between">
          <span>Search Project Task IDs (e.g. WWEART-0124), Requests (REQ-2001), keywords</span>
          <span>Press ESC to dismiss</span>
        </div>
      </div>
    </div>
  );
};
