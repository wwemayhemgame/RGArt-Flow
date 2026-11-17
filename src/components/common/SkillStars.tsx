import React from 'react';
import { Star } from 'lucide-react';

interface SkillStarsProps {
  rating: number; // 1 to 5
  max?: number;
  size?: 'sm' | 'md' | 'lg' | number;
  editable?: boolean;
  onChange?: (newRating: number) => void;
  id?: string;
}

export const SkillStars: React.FC<SkillStarsProps> = ({
  rating,
  max = 5,
  size = 'sm',
  editable = false,
  onChange,
  id
}) => {
  const starSize = typeof size === 'number' ? size : size === 'sm' ? 14 : size === 'md' ? 18 : 22;

  return (
    <div id={id} className="inline-flex items-center gap-0.5">
      {Array.from({ length: max }, (_, index) => {
        const starNumber = index + 1;
        const isFilled = starNumber <= rating;

        return (
          <button
            key={index}
            type="button"
            disabled={!editable}
            onClick={() => editable && onChange && onChange(starNumber)}
            className={`${editable ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'} text-amber-400 p-0.5`}
          >
            <Star
              size={starSize}
              className={isFilled ? 'fill-amber-400 text-amber-400' : 'text-slate-300 fill-slate-100'}
            />
          </button>
        );
      })}
    </div>
  );
};
