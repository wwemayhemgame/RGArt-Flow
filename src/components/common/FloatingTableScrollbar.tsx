import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  MoveHorizontal,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';

interface FloatingTableScrollbarProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  tableKey?: string;
}

export const FloatingTableScrollbar: React.FC<FloatingTableScrollbarProps> = ({
  containerRef,
  tableKey
}) => {
  const [hasOverflow, setHasOverflow] = useState(false);
  const [isBottomOffscreen, setIsBottomOffscreen] = useState(false);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [clientWidth, setClientWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [containerRect, setContainerRect] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  const floatingTrackRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);

  const updateMeasurements = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const overflow = el.scrollWidth > el.clientWidth + 6;
    const currentScrollWidth = el.scrollWidth;
    const currentClientWidth = el.clientWidth;
    const currentScrollLeft = el.scrollLeft;

    // Table is at least partially visible vertically in viewport
    const isTableInView = rect.top < window.innerHeight - 40 && rect.bottom > 80;
    // Bottom of table container is below viewport bottom, meaning the native horizontal scrollbar is hidden offscreen
    const isBelowViewport = rect.bottom > window.innerHeight;

    setHasOverflow(overflow);
    setIsBottomOffscreen(isTableInView && isBelowViewport);
    setScrollWidth(currentScrollWidth);
    setClientWidth(currentClientWidth);
    setScrollLeft(currentScrollLeft);
    setContainerRect({
      left: Math.max(0, rect.left),
      width: Math.min(window.innerWidth - Math.max(0, rect.left), rect.width)
    });

    if (floatingTrackRef.current && !isSyncingScroll.current) {
      floatingTrackRef.current.scrollLeft = currentScrollLeft;
    }
  }, [containerRef]);

  // Listen to window scroll & resize, and table container scroll & mutations
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    updateMeasurements();

    const handleScroll = () => {
      updateMeasurements();
    };

    const handleTableScroll = () => {
      if (!el) return;
      setScrollLeft(el.scrollLeft);
      if (floatingTrackRef.current && !isSyncingScroll.current) {
        isSyncingScroll.current = true;
        floatingTrackRef.current.scrollLeft = el.scrollLeft;
        requestAnimationFrame(() => {
          isSyncingScroll.current = false;
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    el.addEventListener('scroll', handleTableScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      updateMeasurements();
    });
    resizeObserver.observe(el);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      el.removeEventListener('scroll', handleTableScroll);
      resizeObserver.disconnect();
    };
  }, [containerRef, updateMeasurements]);

  // Floating track scroll handler
  const handleFloatingScroll = () => {
    const track = floatingTrackRef.current;
    const el = containerRef.current;
    if (!track || !el) return;

    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;

    el.scrollLeft = track.scrollLeft;
    setScrollLeft(track.scrollLeft);

    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  const handleScrollBy = (amount: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  const handleScrollTo = (left: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ left, behavior: 'smooth' });
  };

  if (!hasOverflow || !isBottomOffscreen) return null;

  const canScrollLeft = scrollLeft > 5;
  const canScrollRight = scrollLeft < scrollWidth - clientWidth - 5;
  const scrollPercentage = scrollWidth > clientWidth
    ? Math.round((scrollLeft / (scrollWidth - clientWidth)) * 100)
    : 0;

  return (
    <div
      id={`floating-scrollbar-${tableKey || 'table'}`}
      className="fixed bottom-0 z-30 bg-slate-900/95 text-white backdrop-blur-md border-t border-slate-700/80 shadow-2xl px-3 py-2 flex items-center gap-2 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2"
      style={{
        left: `${containerRect.left}px`,
        width: `${containerRect.width}px`
      }}
    >
      {/* Scroll Jump to Start */}
      <button
        type="button"
        onClick={() => handleScrollTo(0)}
        disabled={!canScrollLeft}
        className="p-1 rounded-lg hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
        title="Scroll to beginning"
      >
        <ChevronsLeft size={16} />
      </button>

      {/* Step Left */}
      <button
        type="button"
        onClick={() => handleScrollBy(-280)}
        disabled={!canScrollLeft}
        className="p-1 rounded-lg hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
        title="Scroll left (280px)"
      >
        <ChevronLeft size={16} />
      </button>

      {/* Synchronized Scrollbar Track */}
      <div
        ref={floatingTrackRef}
        onScroll={handleFloatingScroll}
        className="flex-1 overflow-x-auto floating-scrollbar py-1 cursor-ew-resize select-none"
        title="Drag or scroll horizontally"
      >
        <div style={{ width: `${scrollWidth}px`, height: '6px' }} />
      </div>

      {/* Step Right */}
      <button
        type="button"
        onClick={() => handleScrollBy(280)}
        disabled={!canScrollRight}
        className="p-1 rounded-lg hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
        title="Scroll right (280px)"
      >
        <ChevronRight size={16} />
      </button>

      {/* Scroll Jump to End */}
      <button
        type="button"
        onClick={() => handleScrollTo(scrollWidth)}
        disabled={!canScrollRight}
        className="p-1 rounded-lg hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
        title="Scroll to end"
      >
        <ChevronsRight size={16} />
      </button>

      {/* Scroll Progress & Jump Indicator */}
      <div className="flex items-center gap-1.5 text-[11px] text-slate-300 shrink-0 font-medium pl-2 border-l border-slate-700">
        <MoveHorizontal size={13} className="text-blue-400" />
        <span className="hidden md:inline font-mono text-[10px] text-slate-400">
          {scrollPercentage}%
        </span>
        <div className="hidden sm:flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleScrollTo(0)}
            className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            Start
          </button>
          <button
            type="button"
            onClick={() => handleScrollTo(scrollWidth / 2 - clientWidth / 2)}
            className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            Middle
          </button>
          <button
            type="button"
            onClick={() => handleScrollTo(scrollWidth)}
            className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
          >
            End
          </button>
        </div>
      </div>
    </div>
  );
};
