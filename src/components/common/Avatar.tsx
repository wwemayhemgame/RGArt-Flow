import React from 'react';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'active' | 'leave' | 'inactive' | 'Active' | 'On Leave' | 'Inactive' | string;
  className?: string;
  id?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  status,
  className = '',
  id
}) => {
  const sizeClasses = {
    xs: 'w-5 h-5 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-11 h-11 text-base',
    xl: 'w-14 h-14 text-lg font-semibold'
  }[size];

  const getInitials = (str: string) => {
    if (!str) return '?';
    const parts = str.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return str.substring(0, 2).toUpperCase();
  };

  const normalizedStatus = (() => {
    if (!status) return undefined;
    const lower = status.toLowerCase();
    if (lower.includes('leave')) return 'leave';
    if (lower === 'active') return 'active';
    return 'inactive';
  })();

  const statusColors = {
    active: 'bg-emerald-500',
    leave: 'bg-amber-500',
    inactive: 'bg-slate-400'
  };

  const validSrc = typeof src === 'string' && src.trim().length > 0 ? src.trim() : null;

  return (
    <div id={id} className={`relative inline-flex flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 border border-slate-200 overflow-hidden select-none font-medium ${sizeClasses} ${className}`}>
      {validSrc ? (
        <img
          src={validSrc}
          alt={name}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={(e) => {
            // Fallback to initials on error
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      ) : (
        <span>{getInitials(name)}</span>
      )}

      {normalizedStatus && (
        <span
          className={`absolute bottom-0 right-0 block w-2.5 h-2.5 rounded-full ring-2 ring-white ${statusColors[normalizedStatus]}`}
        />
      )}
    </div>
  );
};
