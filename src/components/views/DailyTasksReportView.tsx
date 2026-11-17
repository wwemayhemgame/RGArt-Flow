import React from 'react';
import { VisualArtistReportView } from '../reports/VisualArtistReportView';

interface DailyTasksReportViewProps {
  onSelectTask?: (taskId: string, activeFilteredList?: string[]) => void;
  onNavigateToTaskList?: (filters: {
    artistId?: string;
    sprintId?: string;
    statusFilter?: string;
    projectId?: string;
  }) => void;
}

export const DailyTasksReportView: React.FC<DailyTasksReportViewProps> = ({
  onSelectTask,
  onNavigateToTaskList
}) => {
  return (
    <VisualArtistReportView
      mode="daily"
      onSelectTask={onSelectTask}
      onNavigateToTaskList={onNavigateToTaskList}
    />
  );
};

