import React from 'react';
import { TaskStatus, RequestStatus, Priority, UserRole, ProjectAccessLevel } from '../../types';

interface BadgeProps {
  children?: React.ReactNode;
  variant?: 'default' | 'outline' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  id?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
  id
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs font-medium',
    md: 'px-2.5 py-1 text-xs font-semibold',
    lg: 'px-3 py-1.5 text-sm font-semibold'
  }[size];

  const variantClasses = {
    default: 'bg-slate-100 text-slate-700 border border-slate-200',
    outline: 'bg-transparent text-slate-700 border border-slate-300',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200',
    info: 'bg-blue-50 text-blue-700 border border-blue-200',
    purple: 'bg-indigo-50 text-indigo-700 border border-indigo-200'
  }[variant];

  return (
    <span
      id={id}
      className={`inline-flex items-center gap-1 rounded-md whitespace-nowrap ${sizeClasses} ${variantClasses} ${className}`}
    >
      {children}
    </span>
  );
};

export const TaskStatusBadge: React.FC<{ status: TaskStatus; id?: string; className?: string }> = ({ status, id, className = '' }) => {
  switch (status) {
    case 'To Do':
    case 'BACKLOG':
    case 'SELECTED':
      return <Badge id={id} variant="default" className={`bg-slate-100 text-slate-700 border-slate-300 font-semibold ${className}`}>To Do</Badge>;
    case 'In Progress':
    case 'IN_PROGRESS':
      return <Badge id={id} variant="info" className={`bg-blue-100 text-blue-800 font-semibold border-blue-300 ${className}`}>In Progress</Badge>;
    case 'On Hold':
    case 'BLOCKED':
      return <Badge id={id} variant="warning" className={`bg-amber-100 text-amber-800 font-semibold border-amber-300 ${className}`}>On Hold</Badge>;
    case 'Re-opened':
      return <Badge id={id} variant="purple" className={`bg-purple-100 text-purple-800 font-semibold border-purple-300 ${className}`}>Re-opened</Badge>;
    case 'Submit for Review':
    case 'INTERNAL_REVIEW':
    case 'REQUESTER_REVIEW':
      return <Badge id={id} variant="info" className={`bg-sky-100 text-sky-800 font-semibold border-sky-300 ${className}`}>Submit for Review</Badge>;
    case 'In Iteration':
    case 'REVISION':
      return <Badge id={id} variant="warning" className={`bg-orange-100 text-orange-800 font-semibold border-orange-300 ${className}`}>In Iteration</Badge>;
    case 'Completed':
    case 'DONE':
      return <Badge id={id} variant="success" className={`bg-emerald-100 text-emerald-800 font-semibold border-emerald-300 ${className}`}>Completed</Badge>;
    case 'Cancelled':
      return <Badge id={id} variant="danger" className={`bg-rose-100 text-rose-800 font-semibold border-rose-300 ${className}`}>Cancelled</Badge>;
    default:
      return <Badge id={id} className={className}>{status}</Badge>;
  }
};

export const RequestStatusBadge: React.FC<{ status: RequestStatus; id?: string }> = ({ status, id }) => {
  switch (status) {
    case 'NEW':
      return <Badge id={id} variant="info" className="bg-sky-50 text-sky-700 border-sky-200">New</Badge>;
    case 'TRIAGED':
      return <Badge id={id} variant="purple">Triaged</Badge>;
    case 'QUEUED':
      return <Badge id={id} variant="default">Queued</Badge>;
    case 'ASSIGNED':
      return <Badge id={id} variant="info">Assigned</Badge>;
    case 'IN_PROGRESS':
      return <Badge id={id} variant="info" className="bg-blue-100 text-blue-800 border-blue-300">In Production</Badge>;
    case 'IN_REVIEW':
      return <Badge id={id} variant="warning">In Review</Badge>;
    case 'REVISION':
      return <Badge id={id} variant="warning" className="bg-orange-100 text-orange-800 border-orange-300">Revision</Badge>;
    case 'DELIVERED':
      return <Badge id={id} variant="success" className="bg-emerald-100 text-emerald-800 border-emerald-300">Delivered</Badge>;
    case 'REJECTED':
      return <Badge id={id} variant="danger">Rejected</Badge>;
    default:
      return <Badge id={id}>{status}</Badge>;
  }
};

export const PriorityBadge: React.FC<{ priority: Priority; id?: string }> = ({ priority, id }) => {
  switch (priority) {
    case 'Critical':
      return <Badge id={id} variant="danger" className="font-bold">Critical</Badge>;
    case 'High':
      return <Badge id={id} variant="warning" className="text-amber-800 bg-amber-100">High</Badge>;
    case 'Medium':
      return <Badge id={id} variant="info">Medium</Badge>;
    case 'Low':
      return <Badge id={id} variant="default">Low</Badge>;
    default:
      return <Badge id={id}>{priority}</Badge>;
  }
};

export const RoleBadge: React.FC<{ role: UserRole; id?: string }> = ({ role, id }) => {
  const map: Record<UserRole, { label: string; variant: BadgeProps['variant'] }> = {
    COMPANY_REQUESTER: { label: 'Requester', variant: 'default' },
    ARTIST: { label: 'Artist', variant: 'info' },
    ART_MANAGER: { label: 'Art Manager', variant: 'purple' },
    ART_DIRECTOR: { label: 'Art Director', variant: 'warning' },
    ADMIN: { label: 'Admin', variant: 'danger' },
    REVIEWER_QA: { label: 'Reviewer / QA', variant: 'warning' },
    VIEWER: { label: 'Viewer', variant: 'default' }
  };
  const config = map[role] || { label: role, variant: 'default' };
  return <Badge id={id} variant={config.variant}>{config.label}</Badge>;
};

export const AccessLevelBadge: React.FC<{ level: ProjectAccessLevel | 'Removed'; id?: string }> = ({ level, id }) => {
  const map: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    VIEWER: { label: 'Viewer', variant: 'default' },
    COMMENTER: { label: 'Commenter', variant: 'info' },
    EDITOR: { label: 'Editor', variant: 'purple' },
    MANAGER: { label: 'Manager', variant: 'warning' },
    Removed: { label: 'Removed', variant: 'danger' }
  };
  const config = map[level] || { label: level, variant: 'default' };
  return <Badge id={id} variant={config.variant}>{config.label}</Badge>;
};
