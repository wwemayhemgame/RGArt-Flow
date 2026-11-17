import React from 'react';

interface CapacityBarProps {
  committedHours: number;
  capacityHours: number;
  showLabels?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  id?: string;
}

export const CapacityBar: React.FC<CapacityBarProps> = ({
  committedHours,
  capacityHours,
  showLabels = true,
  size = 'md',
  className = '',
  id
}) => {
  const percentage = capacityHours > 0 ? Math.round((committedHours / capacityHours) * 100) : 0;

  // Capacity Color Palette from Requirements
  // Green: 0–70%
  // Yellow: 71–85%
  // Orange: 86–100%
  // Red: Over 100%
  const getColorClasses = (pct: number) => {
    if (pct <= 70) {
      return {
        bg: 'bg-emerald-500',
        text: 'text-emerald-700',
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      };
    } else if (pct <= 85) {
      return {
        bg: 'bg-amber-500',
        text: 'text-amber-700',
        badgeBg: 'bg-amber-50 text-amber-700 border-amber-200'
      };
    } else if (pct <= 100) {
      return {
        bg: 'bg-orange-500',
        text: 'text-orange-700',
        badgeBg: 'bg-orange-50 text-orange-700 border-orange-200'
      };
    } else {
      return {
        bg: 'bg-rose-500',
        text: 'text-rose-700 font-bold',
        badgeBg: 'bg-rose-50 text-rose-700 border-rose-200'
      };
    }
  };

  const colors = getColorClasses(percentage);

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3'
  }[size];

  const clampedWidth = Math.min(100, percentage);

  return (
    <div id={id} className={`w-full ${className}`}>
      {showLabels && (
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-medium text-slate-600">
            {committedHours}h / {capacityHours}h
          </span>
          <span className={`text-xs px-2 py-0.5 rounded font-medium border ${colors.badgeBg}`}>
            {percentage}%
          </span>
        </div>
      )}
      
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200 ${heightClasses}`}>
        <div
          className={`${colors.bg} h-full transition-all duration-300 rounded-full`}
          style={{ width: `${clampedWidth}%` }}
        />
      </div>
      {percentage > 100 && (
        <p className="text-[11px] text-rose-600 font-medium mt-0.5">
          +{committedHours - capacityHours}h over capacity
        </p>
      )}
    </div>
  );
};
