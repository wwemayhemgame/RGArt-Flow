import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  FileText,
  User,
  Calendar,
  Layers,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Info,
  Trash2
} from 'lucide-react';
import { TaskAttachment, Task } from '../../types';
import { TaskStatusBadge, PriorityBadge } from '../common/Badge';

interface MediaLightboxModalProps {
  media: TaskAttachment | null;
  task?: Task | null;
  allMediaList?: Array<{ media: TaskAttachment; task?: Task }>;
  isOpen: boolean;
  onClose: () => void;
  onSelectTask?: (taskId: string) => void;
  onRemoveMedia?: (media: TaskAttachment) => void;
}

export const MediaLightboxModal: React.FC<MediaLightboxModalProps> = ({
  media,
  task,
  allMediaList = [],
  isOpen,
  onClose,
  onSelectTask,
  onRemoveMedia
}) => {
  const [currentMedia, setCurrentMedia] = useState<TaskAttachment | null>(media);
  const [currentTask, setCurrentTask] = useState<Task | null>(task || null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  useEffect(() => {
    setCurrentMedia(media);
    setCurrentTask(task || null);
    setZoomLevel(1);
    setRotation(0);
  }, [media, task]);

  // Handle keyboard events (Escape, Left, Right)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && allMediaList.length > 1) {
        handleNext();
      } else if (e.key === 'ArrowLeft' && allMediaList.length > 1) {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentMedia, allMediaList]);

  if (!isOpen || !currentMedia) return null;

  const currentIndex = allMediaList.findIndex(
    item => item.media.id === currentMedia.id || (item.media.url && item.media.url === currentMedia.url)
  );

  const handleNext = () => {
    if (allMediaList.length <= 1) return;
    const nextIdx = (currentIndex + 1) % allMediaList.length;
    setCurrentMedia(allMediaList[nextIdx].media);
    setCurrentTask(allMediaList[nextIdx].task || null);
    setZoomLevel(1);
    setRotation(0);
  };

  const handlePrev = () => {
    if (allMediaList.length <= 1) return;
    const prevIdx = (currentIndex - 1 + allMediaList.length) % allMediaList.length;
    setCurrentMedia(allMediaList[prevIdx].media);
    setCurrentTask(allMediaList[prevIdx].task || null);
    setZoomLevel(1);
    setRotation(0);
  };

  const isVideo =
    currentMedia.type?.startsWith('video/') ||
    currentMedia.url?.match(/\.(mp4|webm|mov)(\?.*)?$/i) !== null;

  const isImage =
    currentMedia.type?.startsWith('image/') ||
    currentMedia.url?.match(/\.(png|jpg|jpeg|webp|gif|svg)(\?.*)?$/i) !== null ||
    !isVideo;

  const handleDownload = () => {
    if (!currentMedia.url) return;
    const a = document.createElement('a');
    a.href = currentMedia.url;
    a.download = currentMedia.name || 'artwork_asset';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      id="media-lightbox-modal"
      className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col justify-between animate-in fade-in duration-150"
      onClick={onClose}
    >
      {/* Top Header Controls Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="p-4 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-white flex-wrap gap-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
            <Layers size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold truncate max-w-xs sm:max-w-md">{currentMedia.name}</h2>
              {currentMedia.mediaCategory && (
                <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-full">
                  {currentMedia.mediaCategory}
                </span>
              )}
              {currentMedia.size && (
                <span className="text-[11px] font-mono text-slate-400">{currentMedia.size}</span>
              )}
            </div>
            {currentTask && (
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                <span>Task:</span>
                <span className="font-mono font-bold text-white">{currentTask.id}</span>
                <span>&bull;</span>
                <span className="truncate">{currentTask.title}</span>
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Zoom controls for images */}
          {isImage && (
            <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700">
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.25))}
                className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut size={15} />
              </button>
              <span className="text-[11px] font-mono px-2 text-slate-300">{Math.round(zoomLevel * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.25))}
                className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn size={15} />
              </button>
              <button
                type="button"
                onClick={() => setRotation(prev => (prev + 90) % 360)}
                className="p-1.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors cursor-pointer ml-1 border-l border-slate-700 pl-2"
                title="Rotate"
              >
                <RotateCw size={15} />
              </button>
            </div>
          )}

          {currentTask && onSelectTask && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onSelectTask(currentTask.id);
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <span>Inspect Task</span>
              <ArrowRight size={13} />
            </button>
          )}

          {onRemoveMedia && currentMedia && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Are you sure you want to remove media asset "${currentMedia.name}"?`)) {
                  onRemoveMedia(currentMedia);
                  onClose();
                }
              }}
              className="p-2 bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-300 rounded-lg transition-colors cursor-pointer border border-slate-700"
              title="Remove / Delete Media Asset"
            >
              <Trash2 size={16} />
            </button>
          )}

          <button
            type="button"
            onClick={handleDownload}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition-colors cursor-pointer border border-slate-700"
            title="Download Media Asset"
          >
            <Download size={16} />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer border border-slate-700"
            title="Close Lightbox (Esc)"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main Artwork Stage */}
      <div
        className="flex-1 relative flex items-center justify-center p-4 sm:p-8 overflow-hidden select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Previous Button */}
        {allMediaList.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white flex items-center justify-center border border-slate-700 shadow-xl transition-transform hover:scale-110 cursor-pointer"
            title="Previous Asset (Left Arrow)"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        {/* Media Render */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="max-w-full max-h-full flex items-center justify-center transition-transform duration-150"
          style={{
            transform: `scale(${zoomLevel}) rotate(${rotation}deg)`
          }}
        >
          {isVideo && currentMedia.url && currentMedia.url.trim() ? (
            <video
              src={currentMedia.url.trim()}
              controls
              autoPlay
              className="max-h-[75vh] max-w-[85vw] rounded-xl shadow-2xl bg-black"
            />
          ) : isImage && currentMedia.url && currentMedia.url.trim() ? (
            <img
              src={currentMedia.url.trim()}
              alt={currentMedia.name}
              referrerPolicy="no-referrer"
              className="max-h-[75vh] max-w-[85vw] object-contain rounded-xl shadow-2xl border border-slate-800/60 bg-slate-950"
            />
          ) : (
            <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-300">
              <FileText size={48} className="mx-auto text-blue-400 mb-3" />
              <h3 className="text-base font-bold text-white">{currentMedia.name}</h3>
              <p className="text-xs text-slate-400 mt-1 font-mono">{currentMedia.type || 'Generic Document'}</p>
              <button
                type="button"
                onClick={handleDownload}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl"
              >
                Download Document
              </button>
            </div>
          )}
        </div>

        {/* Next Button */}
        {allMediaList.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white flex items-center justify-center border border-slate-700 shadow-xl transition-transform hover:scale-110 cursor-pointer"
            title="Next Asset (Right Arrow)"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      {/* Bottom Metadata & Carousel Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="p-3.5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-white flex-wrap gap-3 text-xs"
      >
        <div className="flex items-center gap-4 text-slate-400">
          {currentMedia.uploadedByName && (
            <span className="flex items-center gap-1.5">
              <User size={13} className="text-slate-400" />
              <span>Uploaded by <strong>{currentMedia.uploadedByName}</strong></span>
            </span>
          )}
          {currentMedia.uploadedAt && (
            <span className="flex items-center gap-1.5 font-mono">
              <Calendar size={13} className="text-slate-400" />
              <span>{currentMedia.uploadedAt}</span>
            </span>
          )}
        </div>

        {allMediaList.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">
              Asset <strong>{currentIndex + 1}</strong> of <strong>{allMediaList.length}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
