import React, { useEffect } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full' | string;
  id?: string;
  closeOnClickOutside?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  headerActions?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth,
  size,
  id,
  closeOnClickOutside = false,
  isFullscreen = false,
  onToggleFullscreen,
  headerActions
}) => {
  // Close on ESC key only if enabled or user explicitly presses Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const targetWidth = (maxWidth || size || '2xl') as 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
    full: 'max-w-full'
  }[targetWidth] || 'max-w-2xl';

  return (
    <div
      id={id ? `${id}-backdrop` : undefined}
      className={`fixed inset-0 z-50 ${
        isFullscreen
          ? 'overflow-hidden bg-slate-950 flex flex-col p-0 m-0 w-screen h-screen'
          : 'overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6'
      } animate-in fade-in duration-150`}
      onClick={(e) => {
        if (closeOnClickOutside && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        id={id}
        className={`bg-white w-full ${
          isFullscreen
            ? 'h-screen max-h-screen rounded-none border-none shadow-none flex flex-col my-0'
            : `${maxWidthClass} rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto`
        }`}
      >
        {/* Modal Header */}
        <div className={`px-6 py-3.5 border-b border-slate-200 flex items-center justify-between shrink-0 ${
          isFullscreen ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-50/75'
        }`}>
          <div className="flex-1 min-w-0 mr-3">
            <h2 className={`text-base sm:text-lg font-semibold leading-snug truncate ${
              isFullscreen ? 'text-white' : 'text-slate-900'
            }`}>
              {title}
            </h2>
            {subtitle && (
              <p className={`text-xs mt-0.5 ${isFullscreen ? 'text-slate-300' : 'text-slate-500'}`}>
                {subtitle}
              </p>
            )}
          </div>

          {/* Action buttons on the right */}
          <div className="flex items-center gap-2 shrink-0">
            {headerActions}

            {onToggleFullscreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isFullscreen
                    ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                    : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                }`}
                title={isFullscreen ? 'Exit Full Screen' : 'Open in Full Screen'}
                aria-label={isFullscreen ? 'Exit Full Screen' : 'Open in Full Screen'}
              >
                {isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isFullscreen
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
              title="Close (Esc)"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className={`overflow-y-auto grow space-y-4 text-slate-800 text-sm scrollbar-thin ${
          isFullscreen ? 'p-6 sm:p-8 bg-slate-50' : 'p-6'
        }`}>
          {children}
        </div>

        {/* Modal Footer */}
        {footer && (
          <div className={`px-6 py-3.5 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0 ${
            isFullscreen ? 'bg-white border-slate-200' : 'bg-slate-50/80'
          }`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

