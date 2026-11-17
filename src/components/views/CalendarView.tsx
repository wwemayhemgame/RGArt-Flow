import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flag,
  User,
  CalendarDays,
  Plus,
  Sun
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { Task, Sprint, Artist } from '../../types';
import { TaskStatusBadge, PriorityBadge } from '../common/Badge';
import { Avatar } from '../common/Avatar';
import { ManageLeaveModal } from '../modals/ManageLeaveModal';
import { formatDate } from '../../utils/dateUtils';

interface CalendarViewProps {
  onSelectTask: (taskId: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ onSelectTask }) => {
  const { tasks, sprints, artists, projects, canCreateProject } = useArtOps();

  // Current month navigator state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedLeaveArtist, setSelectedLeaveArtist] = useState<Artist | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Map tasks, sprints, and artist leaves by date string YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map: Record<string, { tasks: Task[]; sprints: Sprint[]; leaves: { artist: Artist; reason: string }[] }> = {};

    tasks.forEach(t => {
      if (t.dueDate) {
        if (!map[t.dueDate]) map[t.dueDate] = { tasks: [], sprints: [], leaves: [] };
        map[t.dueDate].tasks.push(t);
      }
    });

    sprints.forEach(s => {
      if (s.endDate) {
        if (!map[s.endDate]) map[s.endDate] = { tasks: [], sprints: [], leaves: [] };
        map[s.endDate].sprints.push(s);
      }
    });

    // Map scheduled leaves
    artists.forEach(art => {
      (art.leaveSchedule || []).forEach(leave => {
        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate || leave.startDate);
        
        for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
          const dStr = dt.toISOString().split('T')[0];
          if (!map[dStr]) map[dStr] = { tasks: [], sprints: [], leaves: [] };
          map[dStr].leaves.push({
            artist: art,
            reason: leave.reason
          });
        }
      });
    });

    return map;
  }, [tasks, sprints, artists]);

  // Calendar cells
  const calendarCells = useMemo(() => {
    const cells = [];
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ day: null, dateStr: '' });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;
      cells.push({ day: d, dateStr });
    }
    return cells;
  }, [year, month, daysInMonth, firstDayIndex]);

  return (
    <div id="calendar-view" className="p-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Studio Art Calendar & Deadlines</h1>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Track asset delivery milestones, artist scheduled leaves, and task due dates.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Quick Schedule Leave Button */}
          <div className="relative">
            <button
              id="btn-calendar-schedule-leave"
              type="button"
              onClick={() => setIsPickerOpen(!isPickerOpen)}
              className="px-3 py-1.5 text-xs font-semibold text-zinc-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <CalendarDays size={14} className="text-amber-700" />
              <span>+ Schedule Artist Leave</span>
            </button>

            {/* Artist Selector Dropdown Popup */}
            {isPickerOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-zinc-200 rounded-xl shadow-lg p-2 z-50 space-y-1">
                <span className="text-[10px] uppercase font-bold text-zinc-400 px-2 py-1 block">
                  Select Artist to Schedule Leave:
                </span>
                <div className="max-h-56 overflow-y-auto space-y-0.5">
                  {artists.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setSelectedLeaveArtist(a);
                        setIsPickerOpen(false);
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-zinc-100 flex items-center gap-2 text-xs transition-colors cursor-pointer"
                    >
                      <Avatar name={a.name} src={a.avatar} size="xs" />
                      <div className="truncate">
                        <span className="font-semibold text-zinc-900 block truncate">{a.name}</span>
                        <span className="text-[10px] text-zinc-500 block truncate">{a.role}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Month Navigation */}
          <div className="flex items-center gap-2 bg-white border border-zinc-200 p-1 rounded-xl shadow-2xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-600 cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold text-zinc-900 px-3 min-w-[140px] text-center">
              {monthNames[month]} {year}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-zinc-100 rounded-lg text-zinc-600 cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-2xs">
        {/* Days of week header */}
        <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-[11px] font-bold text-zinc-400 uppercase tracking-wider text-center py-2.5">
          <div>Sun</div>
          <div>Mon</div>
          <div>Tue</div>
          <div>Wed</div>
          <div>Thu</div>
          <div>Fri</div>
          <div>Sat</div>
        </div>

        {/* Month Cells Grid */}
        <div className="grid grid-cols-7 divide-x divide-y divide-zinc-200 auto-rows-fr">
          {calendarCells.map((cell, idx) => {
            if (!cell.day) {
              return <div key={`empty-${idx}`} className="bg-zinc-50/50 min-h-[110px] p-2" />;
            }

            const events = eventsByDate[cell.dateStr] || { tasks: [], sprints: [], leaves: [] };
            const isToday = new Date().toISOString().split('T')[0] === cell.dateStr;

            return (
              <div
                key={cell.dateStr}
                className={`min-h-[110px] p-2 hover:bg-zinc-50/50 transition-colors flex flex-col justify-between ${
                  isToday ? 'bg-amber-50/20 ring-1 ring-amber-400 inset-0' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-bold ${
                      isToday
                        ? 'w-6 h-6 rounded-full bg-zinc-900 text-white flex items-center justify-center'
                        : 'text-zinc-700'
                    }`}
                  >
                    {cell.day}
                  </span>

                  {events.sprints.length > 0 && (
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 rounded border border-indigo-200 flex items-center gap-0.5">
                      <Flag size={10} />
                      Sprint End
                    </span>
                  )}
                </div>

                {/* Day Leaves & Tasks List */}
                <div className="space-y-1 mt-1.5 overflow-y-auto max-h-24">
                  {/* Artist Leaves on this day */}
                  {events.leaves.map((l, lIdx) => (
                    <div
                      key={`leave-${l.artist?.id || lIdx}-${lIdx}`}
                      onClick={() => l.artist && setSelectedLeaveArtist(l.artist)}
                      className="text-[10px] p-1 rounded font-semibold truncate cursor-pointer bg-amber-100/90 text-amber-900 border border-amber-300 flex items-center gap-1 hover:bg-amber-200 transition-colors"
                      title={`${l.artist?.name || 'Artist'} on leave: ${l.reason}`}
                    >
                      <Sun size={10} className="shrink-0 text-amber-700" />
                      <span className="truncate">{l.artist?.name ? l.artist.name.split(' ')[0] : 'Artist'}: Leave</span>
                    </div>
                  ))}

                  {/* Tasks */}
                  {events.tasks.map(t => {
                    const isDone = t.status === 'DONE';
                    const isBlocked = t.status === 'BLOCKED';

                    return (
                      <div
                        key={t.id}
                        onClick={() => onSelectTask(t.id)}
                        className={`text-[10px] p-1 rounded font-medium truncate cursor-pointer transition-all border ${
                          isDone
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 line-through opacity-70'
                            : isBlocked
                            ? 'bg-rose-50 text-rose-800 border-rose-200 font-bold'
                            : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-200'
                        }`}
                        title={`${t.id}: ${t.title}`}
                      >
                        {t.id}: {t.title}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Manage Leave Modal */}
      <ManageLeaveModal
        isOpen={!!selectedLeaveArtist}
        onClose={() => setSelectedLeaveArtist(null)}
        artist={selectedLeaveArtist}
      />
    </div>
  );
};
