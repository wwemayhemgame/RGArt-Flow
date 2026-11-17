import React, { useState, useMemo } from 'react';
import {
  FolderKanban,
  Plus,
  Search,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  Users,
  Calendar,
  Layers,
  Edit2
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { Project, ProjectStatus } from '../../types';
import { Avatar } from '../common/Avatar';
import { formatDate } from '../../utils/dateUtils';

interface ProjectsViewProps {
  onSelectTask: (taskId: string) => void;
  onOpenCreateProject: () => void;
  onEditProject: (project: Project) => void;
  onOpenManageAccess: (projectId: string) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  onSelectTask,
  onOpenCreateProject,
  onEditProject,
  onOpenManageAccess
}) => {
  const {
    projects,
    tasks,
    users,
    canCreateProject
  } = useArtOps();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.key.toLowerCase().includes(q) ||
          p.projectType.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [projects, searchQuery]);

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // Selected Project tasks
  const projectTasks = useMemo(() => {
    if (!selectedProjectId) return [];
    return tasks.filter(t => t.projectId === selectedProjectId);
  }, [tasks, selectedProjectId]);

  return (
    <div id="projects-view" className="p-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Studio Projects & IP Titles</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-100 font-bold text-zinc-700">
              {projects.length} Active Projects
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Projects govern sequential task ID generation (e.g. WWEART-0001), team access RBAC, and milestone deadlines.
          </p>
        </div>

        {canCreateProject() && (
          <button
            id="btn-create-project-header"
            type="button"
            onClick={onOpenCreateProject}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Plus size={15} />
            <span>+ Create Project</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-3 p-3 bg-white border border-zinc-200 rounded-xl">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search size={15} className="text-zinc-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects by name or key (e.g. WWEART)..."
            className="w-full text-xs text-zinc-900 placeholder:text-zinc-400 outline-hidden bg-transparent"
          />
        </div>
      </div>

      {/* Projects Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProjects.map(proj => {
          const projTasks = tasks.filter(t => t.projectId === proj.id);
          const doneCount = projTasks.filter(t => t.status === 'DONE').length;
          const pct = projTasks.length > 0 ? Math.round((doneCount / projTasks.length) * 100) : 0;
          const artManager = users.find(u => u.id === proj.artManagerId);
          const artDirector = users.find(u => u.id === proj.artDirectorId);
          const memberCount = proj.members?.length || 0;

          return (
            <div
              key={proj.id}
              id={`project-card-${proj.id}`}
              className="p-5 bg-white rounded-xl border border-zinc-200 shadow-2xs hover:shadow-sm transition-all space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-lg ${proj.avatarColor || 'bg-indigo-600'} text-white font-bold text-xs flex items-center justify-center shadow-xs`}>
                      {proj.key.substring(0, 3)}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 leading-snug">{proj.name}</h3>
                      <span className="font-mono text-[10px] font-bold text-zinc-600 bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-200">
                        {proj.key}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                      proj.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      proj.status === 'Completed' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      proj.status === 'Paused' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-zinc-100 text-zinc-600 border-zinc-200'
                    }`}>
                      {proj.status}
                    </span>
                    {canCreateProject() && (
                      <button
                        type="button"
                        onClick={() => onEditProject(proj)}
                        className="p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
                        title="Edit Project Details"
                      >
                        <Edit2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-zinc-500 mt-2 line-clamp-2 leading-relaxed">
                  {proj.description || 'Game production and LiveOps art pipeline.'}
                </p>

                {/* Progress Bar */}
                <div className="mt-4 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] text-zinc-500 font-medium">Task Progress</span>
                    <span className="font-bold text-zinc-800">{doneCount}/{projTasks.length} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Manager & Director */}
                <div className="mt-3 pt-3 border-t border-zinc-100 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-zinc-400 block">Art Manager:</span>
                    <span className="font-semibold text-zinc-800">{artManager?.name || 'Assigned'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400 block">Art Director:</span>
                    <span className="font-semibold text-zinc-800">{artDirector?.name || 'Assigned'}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onOpenManageAccess(proj.id)}
                    className="text-zinc-600 hover:text-zinc-900 font-medium flex items-center gap-1 cursor-pointer"
                  >
                    <ShieldCheck size={13} className="text-zinc-400" />
                    <span>Access ({memberCount})</span>
                  </button>

                  {canCreateProject() && (
                    <button
                      type="button"
                      onClick={() => onEditProject(proj)}
                      className="text-zinc-600 hover:text-zinc-900 font-medium flex items-center gap-1 cursor-pointer"
                    >
                      <Edit2 size={12} className="text-zinc-400" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedProjectId(selectedProjectId === proj.id ? null : proj.id)}
                  className="font-semibold text-zinc-900 hover:text-zinc-700 flex items-center gap-1 cursor-pointer"
                >
                  <span>{selectedProjectId === proj.id ? 'Hide Tasks' : 'View Tasks'}</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded Project Tasks Viewer */}
      {selectedProject && (
        <div className="p-5 bg-zinc-50 border border-zinc-200 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-900">
              Tasks in {selectedProject.name} ({projectTasks.length})
            </h3>
            <span className="text-xs text-zinc-400 font-mono">Prefix: {selectedProject.key}-XXXX</span>
          </div>

          <div className="space-y-2 max-h-80 overflow-y-auto">
            {projectTasks.map(t => (
              <div
                key={t.id}
                onClick={() => onSelectTask(t.id)}
                className="p-3 bg-white hover:bg-zinc-100/80 rounded-lg border border-zinc-200 flex items-center justify-between text-xs cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono font-bold text-zinc-900">{t.id}</span>
                  <span className="font-semibold text-zinc-800 truncate">{t.title}</span>
                </div>
                <span className="font-semibold text-zinc-500">{t.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
