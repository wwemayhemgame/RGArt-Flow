import React, { useState, useMemo } from 'react';
import {
  History,
  Search,
  Filter,
  User,
  Clock,
  Layers,
  FileText,
  AlertTriangle,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { formatDate } from '../../utils/dateUtils';

export const ActivityLogView: React.FC = () => {
  const { activityLogs } = useArtOps();
  const [searchQuery, setSearchQuery] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('ALL');

  const filteredLogs = useMemo(() => {
    return activityLogs.filter(log => {
      if (targetTypeFilter !== 'ALL' && log.targetType.toUpperCase() !== targetTypeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          log.userName.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q) ||
          log.targetId.toLowerCase().includes(q) ||
          (log.targetTitle && log.targetTitle.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [activityLogs, targetTypeFilter, searchQuery]);

  return (
    <div id="activity-log-view" className="p-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">Studio Audit & Activity Log</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-zinc-100 font-bold text-zinc-700">
              {activityLogs.length} Events
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Complete traceability for task status transitions, time logs, blocker alerts, and project changes.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white border border-zinc-200 rounded-xl">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <Search size={15} className="text-zinc-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events by user, action, or entity ID..."
            className="w-full text-xs text-zinc-900 placeholder:text-zinc-400 outline-hidden bg-transparent"
          />
        </div>

        <select
          value={targetTypeFilter}
          onChange={(e) => setTargetTypeFilter(e.target.value)}
          className="text-xs font-semibold bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 outline-hidden"
        >
          <option value="ALL">All Entity Types</option>
          <option value="TASK">Tasks</option>
          <option value="REQUEST">Requests</option>
          <option value="SPRINT">Sprints</option>
          <option value="PROJECT">Projects</option>
          <option value="ARTIST">Artists</option>
          <option value="ACCESS">Access & Roles</option>
          <option value="TIME">Time Logs</option>
        </select>
      </div>

      {/* Timeline Stream */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5 shadow-2xs divide-y divide-zinc-100">
        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-xs text-zinc-400">
            No activity log events match your search criteria.
          </div>
        ) : (
          filteredLogs.map(log => (
            <div key={log.id} className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-700 font-bold text-xs flex items-center justify-center shrink-0 border border-zinc-200 mt-0.5">
                  {log.userName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-xs text-zinc-900">{log.userName}</span>
                    <span className="text-[11px] text-zinc-500 font-medium">{log.action}</span>
                    <span className="font-mono text-[11px] font-bold text-zinc-700 bg-zinc-100 px-1.5 py-0.2 rounded border border-zinc-200">
                      {log.targetId}
                    </span>
                    {log.targetTitle && (
                      <span className="text-xs font-medium text-zinc-800">
                        "{log.targetTitle}"
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-600 mt-1 leading-relaxed">{log.details}</p>
                </div>
              </div>

              <span className="text-[11px] text-zinc-400 shrink-0 font-medium">
                {formatDate(log.timestamp)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
