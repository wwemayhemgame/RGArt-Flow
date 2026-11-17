import React from 'react';
import {
  Image as ImageIcon,
  Film,
  FileText,
  Eye,
  Maximize2,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { TaskAttachment, Task } from '../../types';

interface TaskMediaPreviewRowProps {
  task: Task;
  onPreviewMedia?: (media: TaskAttachment, task: Task) => void;
  maxThumbnails?: number;
  compact?: boolean;
}

export const TaskMediaPreviewRow: React.FC<TaskMediaPreviewRowProps> = ({
  task,
  onPreviewMedia,
  maxThumbnails = 6,
  compact = false
}) => {
  // Aggregate media attachments from task attachments and comments
  const directAttachments: TaskAttachment[] = task.attachments || [];
  const commentAttachments: TaskAttachment[] = (task.comments || []).flatMap(c => c.attachments || []);

  const allAttachments: TaskAttachment[] = [
    ...directAttachments,
    ...commentAttachments
  ].filter((item, index, self) => index === self.findIndex(t => t.id === item.id || (t.url && t.url === item.url)));

  if (allAttachments.length === 0) {
    return null;
  }

  const isImageOrVideo = (att: TaskAttachment) => {
    const type = (att.type || att.fileType || '').toLowerCase();
    const url = (att.url || '').toLowerCase();
    const name = (att.name || '').toLowerCase();
    return (
      type.startsWith('image/') ||
      type.startsWith('video/') ||
      url.match(/\.(png|jpg|jpeg|webp|gif|svg|mp4|webm|mov)(\?.*)?$/i) !== null ||
      name.match(/\.(png|jpg|jpeg|webp|gif|svg|mp4|webm|mov)$/i) !== null ||
      att.mediaCategory === '3D Render' ||
      att.mediaCategory === 'Render' ||
      att.mediaCategory === 'Concept' ||
      att.mediaCategory === 'UI' ||
      att.mediaCategory === 'Image' ||
      att.mediaCategory === 'IMAGE'
    );
  };

  const isVideo = (att: TaskAttachment) => {
    const type = (att.type || att.fileType || '').toLowerCase();
    const url = (att.url || '').toLowerCase();
    const name = (att.name || '').toLowerCase();
    return (
      type.startsWith('video/') ||
      url.match(/\.(mp4|webm|mov)(\?.*)?$/i) !== null ||
      name.match(/\.(mp4|webm|mov)$/i) !== null ||
      att.mediaCategory === 'Video' ||
      att.mediaCategory === 'VIDEO'
    );
  };

  const getMediaCategoryBadge = (category?: string, attName?: string) => {
    if (category) {
      if (category.toLowerCase().includes('3d') || category.toLowerCase().includes('render')) {
        return 'bg-purple-100 text-purple-800 border-purple-200';
      }
      if (category.toLowerCase().includes('concept')) {
        return 'bg-amber-100 text-amber-900 border-amber-200';
      }
      if (category.toLowerCase().includes('ui')) {
        return 'bg-blue-100 text-blue-800 border-blue-200';
      }
      return 'bg-slate-100 text-slate-800 border-slate-200';
    }
    const lower = (attName || '').toLowerCase();
    if (lower.includes('render') || lower.includes('highpoly') || lower.includes('3d')) {
      return 'bg-purple-100 text-purple-800 border-purple-200';
    }
    if (lower.includes('concept') || lower.includes('lighting') || lower.includes('moodboard')) {
      return 'bg-amber-100 text-amber-900 border-amber-200';
    }
    if (lower.includes('ui') || lower.includes('icon') || lower.includes('hud')) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const displayedAttachments = allAttachments.slice(0, maxThumbnails);
  const remainingCount = allAttachments.length - maxThumbnails;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
          <ImageIcon size={12} className="text-blue-600" />
          <span>Attached Media & Artwork ({allAttachments.length})</span>
        </div>
        <span className="text-[10px] text-slate-400 font-medium">Click thumbnail to inspect full preview</span>
      </div>

      <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
        {displayedAttachments.map((att, idx) => {
          const isMedia = isImageOrVideo(att);
          const isVid = isVideo(att);
          const categoryBadgeClass = getMediaCategoryBadge(att.mediaCategory, att.name);

          return (
            <div
              key={att.id || idx}
              onClick={(e) => {
                e.stopPropagation();
                if (onPreviewMedia) {
                  onPreviewMedia(att, task);
                } else if (att.url) {
                  window.open(att.url, '_blank', 'noreferrer');
                }
              }}
              className="group/thumb relative shrink-0 w-28 sm:w-32 bg-slate-900/5 hover:bg-slate-900/10 border border-slate-200 rounded-xl overflow-hidden cursor-pointer shadow-2xs hover:shadow-md transition-all hover:scale-[1.02]"
              title={`View ${att.name} (${att.size || 'Image'})`}
            >
              {/* Thumbnail Container */}
              <div className="relative h-18 sm:h-20 w-full bg-slate-950/20 flex items-center justify-center overflow-hidden">
                {isMedia && att.url && att.url.trim() ? (
                  <img
                    src={att.url.trim()}
                    alt={att.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-2 text-slate-400">
                    <FileText size={20} className="mb-1 text-slate-500" />
                    <span className="text-[9px] font-bold uppercase truncate max-w-full text-center">
                      {att.type?.split('/')[1] || 'FILE'}
                    </span>
                  </div>
                )}

                {/* Video Play Overlay */}
                {isVid && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-xs">
                      <Film size={12} />
                    </div>
                  </div>
                )}

                {/* Hover Quick Zoom Icon */}
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-1 text-white">
                  <Maximize2 size={15} />
                  <span className="text-[10px] font-bold">Preview</span>
                </div>

                {/* Category Pill Tag */}
                {att.mediaCategory && (
                  <span
                    className={`absolute top-1 left-1 text-[8.5px] font-bold px-1.5 py-0.2 rounded border shadow-2xs ${categoryBadgeClass}`}
                  >
                    {att.mediaCategory}
                  </span>
                )}
              </div>

              {/* Title & Metadata Strip */}
              <div className="p-1.5 bg-white border-t border-slate-100">
                <p className="text-[10px] font-semibold text-slate-800 truncate" title={att.name}>
                  {att.name}
                </p>
                <div className="flex items-center justify-between text-[9px] text-slate-400 mt-0.5 font-mono">
                  <span>{att.size || 'Attachment'}</span>
                  {att.uploadedByName && (
                    <span className="truncate max-w-[50px] font-sans" title={`By ${att.uploadedByName}`}>
                      {att.uploadedByName.split(' ')[0]}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Overflow Pill */}
        {remainingCount > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onPreviewMedia && displayedAttachments[0]) {
                onPreviewMedia(displayedAttachments[0], task);
              }
            }}
            className="shrink-0 w-20 h-24 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-blue-600 transition-all cursor-pointer p-2"
          >
            <span className="text-xs font-bold">+{remainingCount}</span>
            <span className="text-[9px] font-medium text-center">more files</span>
          </button>
        )}
      </div>
    </div>
  );
};
