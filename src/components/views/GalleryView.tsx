import React, { useState, useMemo, useEffect } from 'react';
import {
  Images,
  Image as ImageIcon,
  Film,
  Sparkles,
  Search,
  Filter,
  Eye,
  Download,
  ExternalLink,
  Upload,
  FolderKanban,
  CheckCircle2,
  Calendar,
  User as UserIcon,
  Tag,
  Maximize2,
  X,
  ChevronLeft,
  ChevronRight,
  Layers,
  FileText,
  Copy,
  Check,
  Play,
  Trash2
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { TaskAttachment, Project, Task } from '../../types';
import { Avatar } from '../common/Avatar';
import { Badge } from '../common/Badge';

interface GalleryViewProps {
  onSelectTask: (taskId: string) => void;
  onOpenUploadMedia?: () => void;
}

type MediaTypeFilter = 'ALL' | 'IMAGE' | 'VIDEO' | 'GIF' | 'CONCEPT' | 'RENDER' | 'UI';

export const GalleryView: React.FC<GalleryViewProps> = ({
  onSelectTask,
  onOpenUploadMedia
}) => {
  const { tasks, projects, currentUser, addTaskAttachment, removeTaskAttachment } = useArtOps();

  // Filters state
  const [selectedProjectId, setSelectedProjectId] = useState<string>('ALL');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<MediaTypeFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'OLDEST' | 'NAME'>('NEWEST');

  // Lightbox Modal State
  const [activeLightboxMedia, setActiveLightboxMedia] = useState<TaskAttachment | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Quick Direct Upload Modal
  const [isQuickUploadOpen, setIsQuickUploadOpen] = useState(false);
  const [uploadProjectId, setUploadProjectId] = useState(projects[0]?.id || '');
  const [uploadTaskId, setUploadTaskId] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileUrl, setUploadFileUrl] = useState('');
  const [uploadCategory, setUploadCategory] = useState<'Image' | 'Video' | 'GIF' | 'Render' | 'UI' | 'Concept'>('Image');

  useEffect(() => {
    if (!uploadProjectId && projects.length > 0) {
      setUploadProjectId(projects[0].id);
    }
  }, [projects, uploadProjectId]);

  // Aggregate ALL media attachments across all tasks and comments
  const allMediaItems: TaskAttachment[] = useMemo(() => {
    const items: TaskAttachment[] = [];
    const seenUrls = new Set<string>();

    tasks.forEach(task => {
      const project = projects.find(p => p.id === task.projectId);
      const projectName = project?.name || task.projectId;

      // 1. Collect from task.attachments
      (task.attachments || []).forEach(att => {
        if (!seenUrls.has(att.url)) {
          seenUrls.add(att.url);
          items.push({
            ...att,
            taskId: task.id,
            taskTitle: task.title,
            projectId: task.projectId,
            projectName: projectName
          });
        }
      });

      // 2. Collect from task.comments[].attachments
      (task.comments || []).forEach(comment => {
        (comment.attachments || []).forEach(att => {
          if (!seenUrls.has(att.url)) {
            seenUrls.add(att.url);
            items.push({
              ...att,
              taskId: task.id,
              taskTitle: task.title,
              projectId: task.projectId,
              projectName: projectName,
              uploadedBy: att.uploadedBy || comment.userId,
              uploadedByName: att.uploadedByName || comment.userName,
              uploadedAt: att.uploadedAt || comment.createdAt
            });
          }
        });
      });
    });

    return items;
  }, [tasks, projects]);

  // Helper to identify media category from filename or url or type
  const getMediaCategory = (item: TaskAttachment): 'IMAGE' | 'VIDEO' | 'GIF' | 'OTHER' => {
    const lowerName = (item.name || '').toLowerCase();
    const lowerUrl = (item.url || '').toLowerCase();
    const lowerType = (item.type || '').toLowerCase();

    if (
      lowerName.endsWith('.mp4') ||
      lowerName.endsWith('.webm') ||
      lowerName.endsWith('.mov') ||
      lowerUrl.includes('.mp4') ||
      lowerUrl.includes('.webm') ||
      lowerType.includes('video')
    ) {
      return 'VIDEO';
    }
    if (
      lowerName.endsWith('.gif') ||
      lowerUrl.includes('.gif') ||
      lowerType.includes('gif') ||
      item.mediaCategory === 'GIF'
    ) {
      return 'GIF';
    }
    return 'IMAGE';
  };

  // Filtered items
  const filteredMediaItems = useMemo(() => {
    return allMediaItems.filter(item => {
      // Project filter
      if (selectedProjectId !== 'ALL' && item.projectId !== selectedProjectId) {
        return false;
      }

      // Media Type filter
      const category = getMediaCategory(item);
      if (mediaTypeFilter === 'IMAGE' && category !== 'IMAGE') return false;
      if (mediaTypeFilter === 'VIDEO' && category !== 'VIDEO') return false;
      if (mediaTypeFilter === 'GIF' && category !== 'GIF') return false;
      if (mediaTypeFilter === 'CONCEPT' && item.mediaCategory !== 'Concept') return false;
      if (mediaTypeFilter === 'RENDER' && item.mediaCategory !== 'Render') return false;
      if (mediaTypeFilter === 'UI' && item.mediaCategory !== 'UI') return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (item.name || '').toLowerCase().includes(q);
        const matchesTask = (item.taskId || '').toLowerCase().includes(q) || (item.taskTitle || '').toLowerCase().includes(q);
        const matchesProject = (item.projectName || '').toLowerCase().includes(q);
        const matchesUploader = (item.uploadedByName || '').toLowerCase().includes(q);
        if (!matchesName && !matchesTask && !matchesProject && !matchesUploader) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'NAME') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'OLDEST') {
        return (a.uploadedAt || '').localeCompare(b.uploadedAt || '');
      }
      // NEWEST
      return (b.uploadedAt || '').localeCompare(a.uploadedAt || '');
    });
  }, [allMediaItems, selectedProjectId, mediaTypeFilter, searchQuery, sortBy]);

  // Group media project-wise
  const projectGroupedMedia = useMemo(() => {
    const groups: {
      project: Project | null;
      projectId: string;
      projectName: string;
      items: TaskAttachment[];
    }[] = [];

    // Filter projects based on selectedProjectId
    const targetProjects = selectedProjectId === 'ALL'
      ? projects
      : projects.filter(p => p.id === selectedProjectId);

    targetProjects.forEach(proj => {
      const projItems = filteredMediaItems.filter(m => m.projectId === proj.id);
      if (projItems.length > 0 || selectedProjectId !== 'ALL') {
        groups.push({
          project: proj,
          projectId: proj.id,
          projectName: proj.name,
          items: projItems
        });
      }
    });

    // Also check for media with unassigned/other projects
    const otherItems = filteredMediaItems.filter(
      m => !targetProjects.some(p => p.id === m.projectId)
    );
    if (otherItems.length > 0 && selectedProjectId === 'ALL') {
      groups.push({
        project: null,
        projectId: 'other',
        projectName: 'General Studio Media',
        items: otherItems
      });
    }

    return groups;
  }, [filteredMediaItems, projects, selectedProjectId]);

  // Total counts for stats
  const totalCount = allMediaItems.length;
  const imageCount = allMediaItems.filter(m => getMediaCategory(m) === 'IMAGE').length;
  const videoCount = allMediaItems.filter(m => getMediaCategory(m) === 'VIDEO').length;
  const gifCount = allMediaItems.filter(m => getMediaCategory(m) === 'GIF').length;

  const handleCopyMediaLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleQuickUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFileUrl.trim() || !uploadTaskId) {
      alert('Please select a target task and provide an image/media URL.');
      return;
    }

    addTaskAttachment(uploadTaskId, {
      name: uploadFileName.trim() || 'Uploaded Studio Asset',
      url: uploadFileUrl.trim(),
      type: uploadCategory === 'Video' ? 'video/mp4' : 'image/jpeg',
      size: '2.4 MB',
      mediaCategory: uploadCategory
    });

    setIsQuickUploadOpen(false);
    setUploadFileName('');
    setUploadFileUrl('');
  };

  // Navigation within Lightbox
  const handleNextLightbox = () => {
    if (!activeLightboxMedia) return;
    const currentIndex = filteredMediaItems.findIndex(m => m.url === activeLightboxMedia.url);
    if (currentIndex < filteredMediaItems.length - 1) {
      setActiveLightboxMedia(filteredMediaItems[currentIndex + 1]);
    } else {
      setActiveLightboxMedia(filteredMediaItems[0]); // Loop
    }
  };

  const handlePrevLightbox = () => {
    if (!activeLightboxMedia) return;
    const currentIndex = filteredMediaItems.findIndex(m => m.url === activeLightboxMedia.url);
    if (currentIndex > 0) {
      setActiveLightboxMedia(filteredMediaItems[currentIndex - 1]);
    } else {
      setActiveLightboxMedia(filteredMediaItems[filteredMediaItems.length - 1]); // Loop
    }
  };

  return (
    <div id="view-media-gallery" className="p-6 max-w-7xl mx-auto space-y-6">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <Images size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Studio Media Gallery</h1>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200/60 rounded-full text-xs font-bold">
                {filteredMediaItems.length} Assets
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Single-glance visual hub across all project concept art, 3D renders, UI assets, GIFs, and comment attachments.
            </p>
          </div>
        </div>

        {/* Quick Action Button */}
        <div className="flex items-center gap-2">
          <button
            id="btn-gallery-quick-upload"
            type="button"
            onClick={() => setIsQuickUploadOpen(true)}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
          >
            <Upload size={14} className="stroke-[2.5]" />
            <span>Upload Media Asset</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Counters Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Images size={18} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Media</span>
            <span className="text-lg font-bold text-slate-900">{totalCount}</span>
          </div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ImageIcon size={18} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Images & Art</span>
            <span className="text-lg font-bold text-slate-900">{imageCount}</span>
          </div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Sparkles size={18} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Animated GIFs</span>
            <span className="text-lg font-bold text-slate-900">{gifCount}</span>
          </div>
        </div>

        <div className="p-3.5 bg-white border border-slate-200/80 rounded-xl flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Film size={18} />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Video Captures</span>
            <span className="text-lg font-bold text-slate-900">{videoCount}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Simple Project Selection Dropdown */}
          <div className="flex items-center gap-2">
            <label htmlFor="gallery-project-select" className="text-xs font-bold text-slate-700 flex items-center gap-1.5 shrink-0">
              <FolderKanban size={15} className="text-blue-600" />
              <span>Project:</span>
            </label>
            <div className="relative flex-1 sm:w-64">
              <select
                id="gallery-project-select"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full text-xs font-semibold bg-slate-50 hover:bg-slate-100/80 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors cursor-pointer"
              >
                <option value="ALL">📁 All Projects ({allMediaItems.length} media assets)</option>
                {projects.map(p => {
                  const count = allMediaItems.filter(m => m.projectId === p.id).length;
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} ({count} {count === 1 ? 'asset' : 'assets'})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 md:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="gallery-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search file, task, or uploader..."
              className="w-full pl-8.5 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white text-slate-900"
            />
          </div>
        </div>

        {/* Media Type Filters & Sorting Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Type:</span>
            {[
              { id: 'ALL', label: 'All Formats' },
              { id: 'IMAGE', label: 'Images (PNG/JPG)' },
              { id: 'GIF', label: 'GIFs & Animations' },
              { id: 'VIDEO', label: 'Videos (MP4)' },
              { id: 'CONCEPT', label: 'Concept Art' },
              { id: 'RENDER', label: '3D Renders' },
              { id: 'UI', label: 'UI & Icons' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMediaTypeFilter(tab.id as MediaTypeFilter)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  mediaTypeFilter === tab.id
                    ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-hidden"
            >
              <option value="NEWEST">Newest Uploaded</option>
              <option value="OLDEST">Oldest Uploaded</option>
              <option value="NAME">Asset Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Project-Wise Media Grid Section */}
      {projectGroupedMedia.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
            <Images size={32} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">No media assets found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Upload an image or attach media in any task comments section, and it will immediately appear here project-wise!
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsQuickUploadOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            <Upload size={14} />
            <span>Upload First Media Asset</span>
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {projectGroupedMedia.map(group => {
            return (
              <section key={group.projectId} id={`project-gallery-${group.projectId}`} className="space-y-3.5">
                {/* Project Section Header */}
                <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${group.project?.avatarColor || 'bg-slate-800'} text-white font-bold text-xs flex items-center justify-center shadow-xs`}>
                      {group.project?.key?.substring(0, 3) || 'ART'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-900">{group.projectName}</h2>
                        {group.project?.key && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded font-semibold">
                            {group.project.key}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">{group.project?.description || 'Project visual asset repository'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                      {group.items.length} {group.items.length === 1 ? 'asset' : 'assets'}
                    </span>
                  </div>
                </div>

                {/* Media Cards Grid */}
                {group.items.length === 0 ? (
                  <div className="p-6 bg-slate-50/60 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    No matching media files for this project with current filter.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {group.items.map((item, idx) => {
                      const category = getMediaCategory(item);
                      const isVideo = category === 'VIDEO';
                      const isGif = category === 'GIF';

                      return (
                        <div
                          key={item.id || idx}
                          id={`media-card-${item.id || idx}`}
                          className="group bg-white rounded-2xl border border-slate-200/80 hover:border-blue-400 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col"
                        >
                          {/* Thumbnail Stage */}
                          <div
                            onClick={() => setActiveLightboxMedia(item)}
                            className="relative aspect-16/10 bg-slate-900 overflow-hidden cursor-pointer flex items-center justify-center group-hover:brightness-105"
                          >
                            {(() => {
                              const itemMediaUrl = typeof item.url === 'string' && item.url.trim().length > 0 ? item.url.trim() : null;
                              if (!itemMediaUrl) {
                                return (
                                  <div className="flex flex-col items-center justify-center p-4 text-slate-500">
                                    <ImageIcon size={28} className="mb-1 opacity-60" />
                                    <span className="text-[10px] font-medium text-slate-400">No Preview</span>
                                  </div>
                                );
                              }
                              if (isVideo) {
                                return (
                                  <div className="w-full h-full relative flex items-center justify-center bg-slate-950">
                                    <video
                                      src={itemMediaUrl}
                                      className="w-full h-full object-cover opacity-80"
                                      muted
                                      preload="metadata"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors">
                                      <div className="w-10 h-10 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                        <Play size={18} className="fill-slate-900 ml-0.5" />
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <img
                                  src={itemMediaUrl}
                                  alt={item.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    // Fallback placeholder on broken URL
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              );
                            })()}

                            {/* Badge top left: Format indicator */}
                            <div className="absolute top-2 left-2 flex items-center gap-1">
                              {isGif && (
                                <span className="px-1.5 py-0.5 bg-purple-600 text-white rounded text-[10px] font-black tracking-wider shadow-sm uppercase">
                                  GIF
                                </span>
                              )}
                              {isVideo && (
                                <span className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[10px] font-black tracking-wider shadow-sm uppercase flex items-center gap-1">
                                  <Film size={10} />
                                  <span>VIDEO</span>
                                </span>
                              )}
                              {!isGif && !isVideo && (
                                <span className="px-1.5 py-0.5 bg-black/70 backdrop-blur-xs text-white rounded text-[10px] font-bold shadow-sm uppercase">
                                  {item.mediaCategory || 'IMAGE'}
                                </span>
                              )}
                            </div>

                            {/* Hover Quick Action Buttons */}
                            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {item.taskId && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm(`Are you sure you want to remove media asset "${item.name}"?`)) {
                                      removeTaskAttachment(item.taskId!, item.id);
                                    }
                                  }}
                                  className="p-1.5 bg-black/70 hover:bg-rose-600 text-white rounded-lg backdrop-blur-xs shadow-md transition-colors cursor-pointer"
                                  title="Remove Media Attachment"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveLightboxMedia(item);
                                }}
                                className="p-1.5 bg-black/70 hover:bg-black text-white rounded-lg backdrop-blur-xs shadow-md transition-colors cursor-pointer"
                                title="Expand preview"
                              >
                                <Maximize2 size={13} />
                              </button>
                            </div>

                            {/* Bottom bar inside thumbnail: size badge */}
                            <div className="absolute bottom-2 right-2">
                              <span className="text-[10px] bg-black/70 backdrop-blur-xs text-slate-200 px-1.5 py-0.5 rounded font-mono">
                                {item.size || '1.2 MB'}
                              </span>
                            </div>
                          </div>

                          {/* Card Content Footer */}
                          <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2.5">
                            <div>
                              {/* Asset Title */}
                              <h3
                                onClick={() => setActiveLightboxMedia(item)}
                                className="text-xs font-bold text-slate-900 truncate hover:text-blue-600 cursor-pointer"
                                title={item.name}
                              >
                                {item.name || 'Studio Art Asset'}
                              </h3>

                              {/* Task Association Link */}
                              {item.taskId && (
                                <button
                                  type="button"
                                  onClick={() => onSelectTask(item.taskId!)}
                                  className="mt-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 text-left truncate max-w-full cursor-pointer"
                                  title={`View Task ${item.taskId}`}
                                >
                                  <FileText size={11} className="shrink-0" />
                                  <span className="font-mono">{item.taskId}:</span>
                                  <span className="truncate">{item.taskTitle}</span>
                                </button>
                              )}
                            </div>

                            {/* Uploader & Date Metadata */}
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Avatar name={item.uploadedByName || 'Artist'} size="xs" />
                                <span className="truncate font-medium">{item.uploadedByName || 'Studio Artist'}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                                {item.uploadedAt?.split(' ')[0] || 'Recent'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Lightbox Fullscreen Modal */}
      {activeLightboxMedia && (
        <div
          id="gallery-lightbox-modal"
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col justify-between animate-in fade-in duration-200"
          onClick={() => setActiveLightboxMedia(null)}
        >
          {/* Lightbox Header Bar */}
          <div
            className="h-16 px-6 bg-black/40 border-b border-white/10 flex items-center justify-between text-white shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-white/10 rounded-lg text-blue-400">
                <Images size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white truncate">{activeLightboxMedia.name}</h3>
                <p className="text-xs text-slate-400 flex items-center gap-2">
                  <span>{activeLightboxMedia.projectName || 'Studio Project'}</span>
                  <span>•</span>
                  <span>{activeLightboxMedia.size || 'High Resolution'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeLightboxMedia.taskId && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to remove media asset "${activeLightboxMedia.name}"?`)) {
                      removeTaskAttachment(activeLightboxMedia.taskId!, activeLightboxMedia.id);
                      setActiveLightboxMedia(null);
                    }
                  }}
                  className="px-3 py-1.5 bg-rose-900/60 hover:bg-rose-700 text-rose-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors border border-rose-700/50"
                  title="Remove Media Asset"
                >
                  <Trash2 size={14} />
                  <span>Remove</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleCopyMediaLink(activeLightboxMedia.url)}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Copy direct asset link"
              >
                {copiedUrl ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedUrl ? 'Copied Link!' : 'Copy Link'}</span>
              </button>

              <a
                href={activeLightboxMedia.url}
                target="_blank"
                rel="noreferrer"
                download={activeLightboxMedia.name}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Download size={14} />
                <span>Download</span>
              </a>

              <button
                type="button"
                onClick={() => setActiveLightboxMedia(null)}
                className="p-2 text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg cursor-pointer transition-colors ml-2"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Lightbox Center Media Canvas */}
          <div
            className="flex-1 relative flex items-center justify-center p-4 min-h-0 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Nav Arrow */}
            <button
              type="button"
              onClick={handlePrevLightbox}
              className="absolute left-6 z-10 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 backdrop-blur-md cursor-pointer transition-all hover:scale-110"
              title="Previous media"
            >
              <ChevronLeft size={24} />
            </button>

            {/* Right Nav Arrow */}
            <button
              type="button"
              onClick={handleNextLightbox}
              className="absolute right-6 z-10 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 backdrop-blur-md cursor-pointer transition-all hover:scale-110"
              title="Next media"
            >
              <ChevronRight size={24} />
            </button>

            {/* Main Stage Media Render */}
            <div className="max-w-5xl max-h-full flex items-center justify-center">
              {(() => {
                const lightboxMediaUrl = typeof activeLightboxMedia.url === 'string' && activeLightboxMedia.url.trim().length > 0
                  ? activeLightboxMedia.url.trim()
                  : null;

                if (!lightboxMediaUrl) {
                  return (
                    <div className="p-12 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-300">
                      <ImageIcon size={48} className="mx-auto text-slate-500 mb-3" />
                      <h3 className="text-base font-bold text-white">{activeLightboxMedia.name}</h3>
                      <p className="text-xs text-slate-400 mt-1">No media preview available</p>
                    </div>
                  );
                }

                if (getMediaCategory(activeLightboxMedia) === 'VIDEO') {
                  return (
                    <video
                      src={lightboxMediaUrl}
                      controls
                      autoPlay
                      className="max-h-[75vh] max-w-full rounded-xl shadow-2xl border border-white/10 object-contain"
                    />
                  );
                }

                return (
                  <img
                    src={lightboxMediaUrl}
                    alt={activeLightboxMedia.name}
                    className="max-h-[75vh] max-w-full rounded-xl shadow-2xl border border-white/10 object-contain"
                    referrerPolicy="no-referrer"
                  />
                );
              })()}
            </div>
          </div>

          {/* Lightbox Bottom Metadata Bar */}
          <div
            className="h-16 px-6 bg-black/40 border-t border-white/10 flex items-center justify-between text-xs text-slate-400 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Avatar name={activeLightboxMedia.uploadedByName || 'User'} size="sm" />
                <div>
                  <span className="text-white font-semibold block">{activeLightboxMedia.uploadedByName || 'Studio Member'}</span>
                  <span className="text-[11px] text-slate-400">Uploaded {activeLightboxMedia.uploadedAt}</span>
                </div>
              </div>
            </div>

            {activeLightboxMedia.taskId && (
              <button
                type="button"
                onClick={() => {
                  const taskId = activeLightboxMedia.taskId!;
                  setActiveLightboxMedia(null);
                  onSelectTask(taskId);
                }}
                className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-blue-300 hover:text-blue-200 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <FileText size={14} />
                <span>Open Task {activeLightboxMedia.taskId}</span>
                <ExternalLink size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick Upload Modal */}
      {isQuickUploadOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload size={18} className="text-blue-400" />
                <h3 className="text-sm font-bold">Upload Media to Gallery</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickUploadOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickUploadSubmit} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Project *</label>
                <select
                  value={uploadProjectId}
                  onChange={(e) => {
                    setUploadProjectId(e.target.value);
                    const projTasks = tasks.filter(t => t.projectId === e.target.value);
                    if (projTasks.length > 0 && projTasks[0]?.id) {
                      setUploadTaskId(projTasks[0].id);
                    } else {
                      setUploadTaskId('');
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-blue-500"
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Attach to Task *</label>
                <select
                  value={uploadTaskId}
                  onChange={(e) => setUploadTaskId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select a Task --</option>
                  {tasks.filter(t => t.projectId === uploadProjectId).map(t => (
                    <option key={t.id} value={t.id}>{t.id} - {t.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Asset Name *</label>
                <input
                  type="text"
                  required
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                  placeholder="e.g. Hero_Character_Render_V3.png"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Media URL *</label>
                <input
                  type="url"
                  required
                  value={uploadFileUrl}
                  onChange={(e) => setUploadFileUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... or media file link"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Media Category</label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-slate-900"
                >
                  <option value="Image">Concept Image / Illustration</option>
                  <option value="Render">3D Model / Sculpt Render</option>
                  <option value="UI">UI Screen / Icon / Badge</option>
                  <option value="GIF">Animated VFX / GIF Loop</option>
                  <option value="Video">Gameplay Video Clip</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuickUploadOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                >
                  Save to Gallery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
