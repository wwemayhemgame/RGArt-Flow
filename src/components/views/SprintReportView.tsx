import React from 'react';
import { VisualArtistReportView } from '../reports/VisualArtistReportView';

interface SprintReportViewProps {
  onSelectTask?: (taskId: string, activeFilteredList?: string[]) => void;
  onNavigateToTaskList?: (filters: {
    artistId?: string;
    sprintId?: string;
    statusFilter?: string;
    projectId?: string;
  }) => void;
}

export const SprintReportView: React.FC<SprintReportViewProps> = ({
  onSelectTask,
  onNavigateToTaskList
}) => {
  return (
    <VisualArtistReportView
      mode="sprint"
      onSelectTask={onSelectTask}
      onNavigateToTaskList={onNavigateToTaskList}
    />
  );
};

