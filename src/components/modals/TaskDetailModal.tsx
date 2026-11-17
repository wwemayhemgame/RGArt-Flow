import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  MessageSquare,
  Paperclip,
  Trash2,
  ExternalLink,
  ShieldAlert,
  Send,
  Edit3,
  Check,
  X,
  Layers,
  UserCheck,
  UserX,
  Zap,
  PlayCircle,
  Eye,
  FileCheck,
  Bold,
  Italic,
  Underline,
  Code,
  Palette,
  Film,
  Image as ImageIcon,
  FileText,
  Camera,
  Download,
  Maximize2,
  Minimize2,
  Share2,
  Calendar,
  RefreshCw,
  Link2,
  UploadCloud,
  FolderDown,
  Loader2,
  MoreHorizontal,
  History,
  Copy,
  FolderKanban,
  Tag,
  ChevronLeft,
  ChevronRight,
  GitCommit,
  ArrowRightLeft
} from 'lucide-react';
import { useArtOps } from '../../context/ArtOpsContext';
import { Task, TaskStatus, Priority, TaskAttachment, User, JiraTicketAttachment, WORKFLOW_STATUS_LIST, normalizeTaskStatus } from '../../types';
import { Modal } from '../common/Modal';
import { TaskStatusBadge, PriorityBadge } from '../common/Badge';
import { Avatar } from '../common/Avatar';
import { LogTimeModal } from './LogTimeModal';
import { RevisionModal } from './RevisionModal';
import { BlockerModal } from './BlockerModal';
import { MediaLightboxModal } from './MediaLightboxModal';
import { getArtistCommittedHours, getArtistEffectiveWeeklyCapacity } from '../../utils/forecastEngine';
import { formatDuration, parseDurationString } from '../../utils/timeUtils';
import { resolveJiraMetadata } from '../../utils/jiraMetadataResolver';
import { getTaskAssigneeDisplay } from '../../utils/jiraUserMatcher';
import { copyTaskShareUrl, getTaskShareUrl, updateTaskUrlState } from '../../utils/shareUtils';

type EditableField = 'title' | 'description' | 'originalEstimate' | 'remainingEstimate' | 'storyPoints' | 'dueDate' | null;

const COMMENT_COLORS = [
  { name: 'Default Dark', value: '#0f172a', bgClass: 'bg-slate-900', label: 'Default' },
  { name: 'Crimson Red', value: '#dc2626', bgClass: 'bg-red-600', label: 'Red' },
  { name: 'Sunset Orange', value: '#ea580c', bgClass: 'bg-orange-600', label: 'Orange' },
  { name: 'Amber Gold', value: '#d97706', bgClass: 'bg-amber-600', label: 'Amber' },
  { name: 'Emerald Green', value: '#16a34a', bgClass: 'bg-emerald-600', label: 'Green' },
  { name: 'Ocean Cyan', value: '#0891b2', bgClass: 'bg-cyan-600', label: 'Cyan' },
  { name: 'Royal Blue', value: '#2563eb', bgClass: 'bg-blue-600', label: 'Blue' },
  { name: 'Violet Purple', value: '#7c3aed', bgClass: 'bg-purple-600', label: 'Purple' },
  { name: 'Rose Pink', value: '#db2777', bgClass: 'bg-pink-600', label: 'Pink' }
];

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task?: Task | null;
  taskId?: string | null;
  activeTaskIds?: string[];
  initialFullscreen?: boolean;
  onNavigateTask?: (taskId: string) => void;
  onNavigateToRequest?: (requestId: string) => void;
  onOpenEditProfile?: (user?: User) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  isOpen,
  onClose,
  task: propTask,
  taskId,
  activeTaskIds,
  initialFullscreen = false,
  onNavigateTask,
  onNavigateToRequest,
  onOpenEditProfile
}) => {
  const {
    tasks,
    projects,
    artists,
    users,
    sprints,
    currentUser,
    updateTaskStatus,
    updateTask,
    unassignTask,
    moveTaskToBacklog,
    moveTaskToSprint,
    deleteTask,
    addTaskComment,
    addTaskAttachment,
    removeTaskAttachment,
    requests,
    timeEntries,
    pushTaskToJira,
    syncTaskFromJira,
    syncTaskToJira,
    postTaskAttachmentToJira,
    postAllTaskAttachmentsToJira,
    fetchJiraIssueAttachments,
    importJiraAttachmentToTask,
    importAllJiraAttachmentsToTask,
    settings
  } = useArtOps();

  // Active task resolution (support by ID or by Jira Issue Key)
  const task = useMemo(() => {
    if (propTask) return propTask;
    if (taskId) {
      const needle = taskId.trim().toUpperCase();
      return tasks.find(t => t.id === taskId || (t.jiraIssueKey && t.jiraIssueKey.toUpperCase() === needle)) || null;
    }
    return null;
  }, [propTask, taskId, tasks]);

  // Fullscreen Focus View state
  const [isFullscreen, setIsFullscreen] = useState(Boolean(initialFullscreen));
  const [shareCopied, setShareCopied] = useState(false);

  // Sync initialFullscreen whenever modal opens
  useEffect(() => {
    if (isOpen && initialFullscreen !== undefined) {
      setIsFullscreen(Boolean(initialFullscreen));
    }
  }, [isOpen, initialFullscreen]);

  // Sync browser URL whenever active task or fullscreen state changes
  useEffect(() => {
    if (isOpen && task) {
      updateTaskUrlState(task.id, isFullscreen);
    }
  }, [isOpen, task?.id, isFullscreen]);

  const handleToggleFullscreen = () => {
    setIsFullscreen(prev => {
      const next = !prev;
      if (task) {
        updateTaskUrlState(task.id, next);
      }
      return next;
    });
  };

  const handleCopyShareLink = async (fullscreen: boolean = true) => {
    if (!task) return;
    const success = await copyTaskShareUrl(task.id, fullscreen);
    if (success) {
      setShareCopied(true);
      setSavedSuccessAlert(fullscreen ? 'Fullscreen task link copied to clipboard!' : 'Task link copied to clipboard!');
      setTimeout(() => setShareCopied(false), 2500);
      setTimeout(() => setSavedSuccessAlert(null), 3500);
    }
  };

  // Modals state
  const [isLogTimeOpen, setIsLogTimeOpen] = useState(false);
  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [isBlockerOpen, setIsBlockerOpen] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isUnsavedPromptOpen, setIsUnsavedPromptOpen] = useState(false);
  const [lightboxAttachment, setLightboxAttachment] = useState<TaskAttachment | null>(null);

  // Jira State
  const [isJiraSyncing, setIsJiraSyncing] = useState(false);
  const [jiraSyncFeedback, setJiraSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [jiraAttachments, setJiraAttachments] = useState<JiraTicketAttachment[]>([]);
  const [isLoadingJiraAttachments, setIsLoadingJiraAttachments] = useState(false);
  const [isImportingAllJira, setIsImportingAllJira] = useState(false);
  const [isPostingJiraAttachments, setIsPostingJiraAttachments] = useState(false);

  // Activity Tabs: 'comments' | 'history'
  const [activityTab, setActivityTab] = useState<'comments' | 'history'>('comments');

  // More Actions dropdown menu state
  const [isMoreActionsOpen, setIsMoreActionsOpen] = useState(false);
  const moreActionsRef = useRef<HTMLDivElement>(null);

  // Inline editing state
  const [activeEditField, setActiveEditField] = useState<EditableField>(null);
  const [titleInputVal, setTitleInputVal] = useState('');
  const [descInputVal, setDescInputVal] = useState('');
  const [spInputVal, setSpInputVal] = useState<number>(1);
  const [estimateInputStr, setEstimateInputStr] = useState('');
  const [dueDateInputVal, setDueDateInputVal] = useState('');
  const [savedSuccessAlert, setSavedSuccessAlert] = useState<string | null>(null);

  // Comment Rich Text & Media Builder
  const [newComment, setNewComment] = useState('');
  const [selectedColor, setSelectedColor] = useState('#0f172a');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [activeStyles, setActiveStyles] = useState<{ bold: boolean; italic: boolean; underline: boolean; code: boolean }>({
    bold: false,
    italic: false,
    underline: false,
    code: false
  });
  const [commentAttachments, setCommentAttachments] = useState<TaskAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directFileInputRef = useRef<HTMLInputElement>(null);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreActionsRef.current && !moreActionsRef.current.contains(event.target as Node)) {
        setIsMoreActionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize fields when task changes
  useEffect(() => {
    if (task) {
      setTitleInputVal(task.title || '');
      setDescInputVal(task.description || '');
      setSpInputVal(task.storyPoints || 1);
      setDueDateInputVal(task.dueDate || '');
      setActiveEditField(null);
      setNewComment('');
      setCommentAttachments([]);
    }
  }, [task?.id]);

  // Load Jira attachments if linked
  useEffect(() => {
    if (isOpen && task?.jiraIssueKey) {
      loadJiraAttachments();
    } else {
      setJiraAttachments([]);
    }
  }, [isOpen, task?.jiraIssueKey]);

  const loadJiraAttachments = async () => {
    if (!task?.jiraIssueKey) return;
    setIsLoadingJiraAttachments(true);
    try {
      const res = await fetchJiraIssueAttachments(task.jiraIssueKey);
      if (res.success && Array.isArray(res.attachments)) {
        setJiraAttachments(res.attachments);
      }
    } catch {
      // silent catch
    } finally {
      setIsLoadingJiraAttachments(false);
    }
  };

  const [showArchivedProjects, setShowArchivedProjects] = useState(false);

  // Previous / Next Task Navigation from active list context
  const currentList = useMemo(() => {
    if (activeTaskIds && activeTaskIds.length > 0) return activeTaskIds;
    return tasks.map(t => t.id);
  }, [activeTaskIds, tasks]);

  const currentIndex = useMemo(() => {
    if (!task) return -1;
    return currentList.findIndex(id => id === task.id);
  }, [currentList, task]);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < currentList.length - 1;
  const displayPosition = currentIndex >= 0 ? currentIndex + 1 : 1;
  const totalCount = currentList.length || 1;

  const handlePrevTask = () => {
    if (hasPrev && onNavigateTask && currentIndex > 0) {
      onNavigateTask(currentList[currentIndex - 1]);
    }
  };

  const handleNextTask = () => {
    if (hasNext && onNavigateTask && currentIndex >= 0 && currentIndex < currentList.length - 1) {
      onNavigateTask(currentList[currentIndex + 1]);
    }
  };

  // Keyboard navigation shortcuts (ArrowLeft / ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.key === 'ArrowLeft' && hasPrev) {
        e.preventDefault();
        handlePrevTask();
      } else if (e.key === 'ArrowRight' && hasNext) {
        e.preventDefault();
        handleNextTask();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasPrev, hasNext, currentIndex, currentList, onNavigateTask]);

  // Direct Jira Ticket Link
  const jiraUrl = task ? (task.jiraSelfUrl || (settings?.jiraConfig?.hostUrl && task.jiraIssueKey ? `${settings.jiraConfig.hostUrl.replace(/\/$/, '')}/browse/${task.jiraIssueKey}` : null)) : null;

  // Jira Metadata with deep fallback resolution
  const jiraMeta = useMemo(() => {
    if (!task) return resolveJiraMetadata({} as any, settings);
    return resolveJiraMetadata(task, settings);
  }, [task, settings]);

  // Jira-linked detection & resolved metadata
  const isJiraLinked = Boolean(task?.isJiraImported || task?.jiraIssueKey || task?.jiraIssueId);

  const jiraAssigneeInfo = useMemo(() => {
    if (!task) {
      return {
        displayName: 'Unassigned',
        isMapped: false,
        avatar: undefined,
        studioArtistId: undefined,
        studioUserId: undefined,
        role: undefined
      };
    }
    return getTaskAssigneeDisplay(task, artists, users, settings?.jiraConfig?.userMappings || []);
  }, [task, artists, users, settings?.jiraConfig?.userMappings]);

  // Derive update number where available (e.g. "Update 98" or "98")
  const resolvedUpdateNo = useMemo(() => {
    if (!task) return null;
    if (task.jiraUpdateNo) return task.jiraUpdateNo;
    if (task.updateNo) return task.updateNo;
    const fv = jiraMeta.fixVersion || task.jiraFixVersion || task.fixVersion;
    if (fv) {
      const match = fv.match(/Update\s*(\d+)/i) || fv.match(/(\d+)/);
      if (match) return `Update ${match[1]}`;
    }
    return null;
  }, [task, jiraMeta.fixVersion]);

  if (isOpen && !task) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={() => {
          updateTaskUrlState(null, false);
          onClose();
        }}
        title="Task Not Found"
        maxWidth="md"
      >
        <div className="text-center py-6 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <AlertTriangle size={24} className="text-amber-500" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Task Not Found</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            The shared task reference <span className="font-mono font-bold text-slate-800">{taskId || 'provided'}</span> was not found in this studio workspace.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                updateTaskUrlState(null, false);
                onClose();
              }}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Return to Studio
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (!task) return null;

  const project = projects.find(p => p.id === task.projectId);
  const availableProjects = projects.filter(p => showArchivedProjects || p.status === 'Active' || p.id === task.projectId);
  const artist = artists.find(a => a.id === task.artistId);
  const linkedRequest = task.requestId ? requests.find(r => r.id === task.requestId) : null;
  const taskTimeEntries = timeEntries.filter(te => te.taskId === task.id);
  const sprint = sprints.find(s => s.id === task.sprintId);

  const canEdit = currentUser?.role === 'ART_MANAGER' || currentUser?.role === 'ADMIN' || currentUser?.role === 'ART_DIRECTOR' || (currentUser?.artistId && currentUser.artistId === task.artistId) || currentUser?.role === 'ARTIST';

  // Status Change Handler
  const handleStatusChange = (newStatus: TaskStatus) => {
    if (newStatus === 'On Hold' || newStatus === 'BLOCKED') {
      setIsBlockerOpen(true);
    } else {
      updateTaskStatus(task.id, newStatus);
      setSavedSuccessAlert(`Status updated to "${normalizeTaskStatus(newStatus)}"`);
      setTimeout(() => setSavedSuccessAlert(null), 3000);
    }
  };

  // Inline Field Save Handlers
  const handleSaveTitle = () => {
    if (titleInputVal.trim() && titleInputVal !== task.title) {
      updateTask(task.id, { title: titleInputVal.trim() });
      setSavedSuccessAlert('Task title updated');
      setTimeout(() => setSavedSuccessAlert(null), 3000);
    }
    setActiveEditField(null);
  };

  const handleSaveDescription = () => {
    updateTask(task.id, { description: descInputVal.trim() });
    setActiveEditField(null);
    setSavedSuccessAlert('Description updated');
    setTimeout(() => setSavedSuccessAlert(null), 3000);
  };

  const handleSaveOriginalEstimate = (hours: number) => {
    updateTask(task.id, {
      originalEstimate: hours,
      ...((!task.timeLogged || task.timeLogged === 0) ? { remainingEstimate: hours } : {})
    });
    setActiveEditField(null);
    setSavedSuccessAlert('Original estimate updated');
    setTimeout(() => setSavedSuccessAlert(null), 3000);
  };

  const handleSaveRemainingEstimate = (hours: number) => {
    updateTask(task.id, { remainingEstimate: hours });
    setActiveEditField(null);
    setSavedSuccessAlert('Remaining estimate updated');
    setTimeout(() => setSavedSuccessAlert(null), 3000);
  };

  const handleSaveStoryPoints = (sp: number) => {
    updateTask(task.id, { storyPoints: sp });
    setActiveEditField(null);
    setSavedSuccessAlert(`Story points set to ${sp}`);
    setTimeout(() => setSavedSuccessAlert(null), 3000);
  };

  const handleSaveDueDate = (dateStr: string) => {
    updateTask(task.id, { dueDate: dateStr, expectedDelivery: dateStr });
    setActiveEditField(null);
    setSavedSuccessAlert(`Due date set to ${dateStr}`);
    setTimeout(() => setSavedSuccessAlert(null), 3000);
  };

  // Jira Actions (Pull / Sync / Push)
  const handlePullFromJira = async () => {
    if (!task) return;
    setIsJiraSyncing(true);
    setJiraSyncFeedback(null);
    const res = await syncTaskFromJira(task.id);
    setIsJiraSyncing(false);
    if (res.success) {
      setJiraSyncFeedback({ type: 'success', message: res.message || 'Synced latest info from Jira!' });
      setTimeout(() => setJiraSyncFeedback(null), 5000);
    } else {
      setJiraSyncFeedback({ type: 'error', message: res.error || 'Failed to sync with Jira.' });
    }
  };

  const handlePushNewToJira = async () => {
    if (!task) return;
    setIsJiraSyncing(true);
    setJiraSyncFeedback(null);
    const res = await pushTaskToJira(task.id);
    setIsJiraSyncing(false);
    if (res.success) {
      setJiraSyncFeedback({ type: 'success', message: res.message || `Created ticket ${res.jiraKey} in Jira!` });
      setTimeout(() => setJiraSyncFeedback(null), 5000);
    } else {
      setJiraSyncFeedback({ type: 'error', message: res.error || 'Failed to create Jira issue.' });
    }
  };

  const handleSyncToJira = async () => {
    if (!task) return;
    setIsJiraSyncing(true);
    setJiraSyncFeedback(null);
    const res = await syncTaskToJira(task.id);
    setIsJiraSyncing(false);
    if (res.success) {
      setJiraSyncFeedback({ type: 'success', message: res.message || 'Pushed updates to Jira!' });
      setTimeout(() => setJiraSyncFeedback(null), 5000);
    } else {
      setJiraSyncFeedback({ type: 'error', message: res.error || 'Failed to push updates to Jira.' });
    }
  };

  // Add Comment
  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() && commentAttachments.length === 0) return;

    const stylesArr: string[] = [];
    if (activeStyles.bold) stylesArr.push('font-bold');
    if (activeStyles.italic) stylesArr.push('italic');
    if (activeStyles.underline) stylesArr.push('underline');
    if (activeStyles.code) stylesArr.push('font-mono bg-slate-100 px-1.5 py-0.5 rounded');

    addTaskComment(
      task.id,
      newComment.trim() || 'Attached media files',
      undefined,
      {
        attachments: commentAttachments.length > 0 ? commentAttachments : undefined,
        textColor: selectedColor !== '#0f172a' ? selectedColor : undefined,
        formatStyles: stylesArr.length > 0 ? stylesArr : undefined
      }
    );

    setNewComment('');
    setCommentAttachments([]);
    setSelectedColor('#0f172a');
    setActiveStyles({ bold: false, italic: false, underline: false, code: false });
    setIsColorPickerOpen(false);
  };

  // File Upload Handlers (Cloud/Server storage with lightweight Firestore metadata)
  const handleDirectUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      const file = files.item(i);
      if (!file) continue;

      try {
        const reader = new FileReader();
        reader.onload = async (uploadEvent) => {
          const rawData = uploadEvent.target?.result as string;
          let publicUrl = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800';
          let storagePath = `/tasks/${task.id}/${file.name}`;
          let humanSize = `${Math.max(1, Math.round(file.size / 1024))} KB`;

          // Post to server media storage so only lightweight metadata is stored in Firestore
          try {
            const uploadRes = await fetch('/api/media/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fileName: file.name,
                fileType: file.type || 'image/jpeg',
                fileData: rawData,
                taskId: task.id,
                uploadedBy: currentUser?.name || 'Studio User'
              })
            });
            if (uploadRes.ok) {
              const resData = await uploadRes.json();
              if (resData.success && resData.media) {
                publicUrl = resData.media.url;
                storagePath = resData.media.storagePath;
                humanSize = resData.media.size || humanSize;
              }
            }
          } catch (uploadErr) {
            console.warn('Storage upload fallback:', uploadErr);
          }

          const newAtt: TaskAttachment = {
            id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            name: file.name,
            fileName: file.name,
            url: publicUrl, // lightweight URL, NEVER raw Base64 in Firestore
            storagePath,
            thumbnailPath: publicUrl,
            size: humanSize,
            fileSize: humanSize,
            uploadedAt: new Date().toISOString().split('T')[0],
            uploadedBy: currentUser?.name || 'Studio User',
            fileType: file.type || 'image/jpeg',
            mediaCategory: file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE',
            taskId: task.id,
            taskTitle: task.title,
            projectId: task.projectId,
            projectName: project?.name || 'Studio Project'
          };
          addTaskAttachment(task.id, newAtt);
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error('Error preparing attachment upload:', err);
      }
    }
    if (directFileInputRef.current) directFileInputRef.current.value = '';
  };

  // Import all Jira attachments
  const handleImportAllJira = async () => {
    if (!task.jiraIssueKey || jiraAttachments.length === 0) return;
    setIsImportingAllJira(true);
    await importAllJiraAttachmentsToTask(task.id, jiraAttachments);
    setIsImportingAllJira(false);
    loadJiraAttachments();
  };

  // Post all attachments to Jira
  const handlePostAllToJira = async () => {
    if (!task.jiraIssueKey) return;
    setIsPostingJiraAttachments(true);
    await postAllTaskAttachmentsToJira(task.id);
    setIsPostingJiraAttachments(false);
  };

  // Check if current user is assigned
  const isAssignedToMe = Boolean(
    currentUser && (
      (currentUser.artistId && task.artistId === currentUser.artistId) ||
      (currentUser.id && task.artistId === currentUser.id) ||
      (artist && currentUser.email && artist.email?.toLowerCase() === currentUser.email.toLowerCase())
    )
  );

  // Unsaved changes check
  const hasUnsavedChanges = Boolean(
    newComment.trim().length > 0 ||
    commentAttachments.length > 0 ||
    (activeEditField === 'title' && titleInputVal.trim() !== (task.title || '')) ||
    (activeEditField === 'description' && descInputVal.trim() !== (task.description || ''))
  );

  const handleAttemptClose = () => {
    if (hasUnsavedChanges) {
      setIsUnsavedPromptOpen(true);
    } else {
      onClose();
    }
  };

  // All combined attachments
  const allAttachments = task.attachments || [];

  return (
    <>
      <Modal
        id="modal-task-detail"
        isOpen={isOpen}
        onClose={handleAttemptClose}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        maxWidth={isFullscreen ? 'full' : '4xl'}
        headerActions={
          <div className="flex items-center gap-1.5 mr-1">
            <button
              type="button"
              id="btn-task-share-link"
              onClick={() => handleCopyShareLink(true)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                shareCopied
                  ? 'bg-emerald-600 text-white'
                  : isFullscreen
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:text-white'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
              title="Copy task share link (opens full screen in studio)"
            >
              {shareCopied ? <Check size={13} className="text-white" /> : <Share2 size={13} className="text-blue-500" />}
              <span className="hidden sm:inline">{shareCopied ? 'Link Copied!' : 'Share'}</span>
              <span className="sm:hidden">{shareCopied ? 'Copied' : 'Share'}</span>
            </button>
          </div>
        }
        title={
          <div className="flex items-center justify-between gap-3 flex-wrap w-full pr-6">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Project Key / Task Key Breadcrumb */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <span className="text-slate-800 font-semibold">{project?.name || 'Project'}</span>
                <span>/</span>
                <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {task.jiraIssueKey || task.id}
                </span>
              </div>

              {/* Compact Jira Reference Link */}
              {task.jiraIssueKey && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {jiraUrl ? (
                    <a
                      href={jiraUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-md transition-colors"
                      title="Open ticket in Jira"
                    >
                      <FolderKanban size={12} className="text-blue-600" />
                      <span>Jira: {task.jiraIssueKey}</span>
                      <ExternalLink size={10} className="text-blue-500" />
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                      <FolderKanban size={12} className="text-blue-600" />
                      <span>Jira: {task.jiraIssueKey}</span>
                    </span>
                  )}

                  {/* Jira Parent */}
                  {jiraMeta.parentKey && (
                    <a
                      href={jiraMeta.parentUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-0.5 rounded-md transition-colors"
                      title={`Jira Parent: ${jiraMeta.parentKey}${jiraMeta.parentSummary ? ` (${jiraMeta.parentSummary})` : ''}`}
                    >
                      <GitCommit size={11} className="text-purple-600" />
                      <span>Parent: {jiraMeta.parentKey}</span>
                      {jiraMeta.parentType && (
                        <span className="text-[9px] font-semibold text-purple-700 bg-purple-100 px-1 rounded">
                          {jiraMeta.parentType}
                        </span>
                      )}
                    </a>
                  )}

                  {/* Jira Sprint ID */}
                  {jiraMeta.sprintId && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md font-mono"
                      title={`Jira Sprint ID: ${jiraMeta.sprintId}${jiraMeta.sprintName ? ` (${jiraMeta.sprintName})` : ''}`}
                    >
                      <Layers size={11} className="text-indigo-600" />
                      <span>Sprint #{jiraMeta.sprintId}</span>
                    </span>
                  )}

                  {/* Jira Fix Version */}
                  {jiraMeta.fixVersion && (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-mono"
                      title={`Jira Fix Version: ${jiraMeta.fixVersion}`}
                    >
                      <Tag size={11} className="text-amber-600" />
                      <span>{jiraMeta.fixVersion}</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Requirement 135: Previous / Next Task Navigation Bar */}
            {totalCount > 1 && (
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 select-none">
                <button
                  type="button"
                  id="btn-prev-task"
                  disabled={!hasPrev}
                  onClick={handlePrevTask}
                  title="Previous Task (←)"
                  className="px-2 py-1 rounded-md hover:bg-white hover:shadow-2xs disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer transition-all flex items-center gap-1 text-slate-700"
                >
                  <ChevronLeft size={14} />
                  <span className="text-[11px] font-bold hidden sm:inline">Previous</span>
                </button>

                <span className="px-2 text-[11px] font-bold text-slate-600 font-mono">
                  Task {displayPosition} of {totalCount}
                </span>

                <button
                  type="button"
                  id="btn-next-task"
                  disabled={!hasNext}
                  onClick={handleNextTask}
                  title="Next Task (→)"
                  className="px-2 py-1 rounded-md hover:bg-white hover:shadow-2xs disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed cursor-pointer transition-all flex items-center gap-1 text-slate-700"
                >
                  <span className="text-[11px] font-bold hidden sm:inline">Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        }
        footer={
          <div className="flex items-center justify-between w-full flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsLogTimeOpen(true)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
              >
                <Clock size={13} />
                <span>Log Time</span>
              </button>

              <button
                type="button"
                onClick={() => setIsRevisionOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
              >
                <RotateCcw size={13} className="text-amber-600" />
                <span>Revision</span>
              </button>

              {task.status === 'BLOCKED' ? (
                <button
                  type="button"
                  onClick={() => updateTaskStatus(task.id, 'IN_PROGRESS')}
                  className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <CheckCircle2 size={13} />
                  <span>Unblock</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsBlockerOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ShieldAlert size={13} />
                  <span>Blocker</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isFullscreen ? (
                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                  title="Exit full screen focus mode"
                >
                  <Minimize2 size={13} />
                  <span>Exit Full Screen</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs hidden sm:flex"
                  title="Open in full screen focus mode"
                >
                  <Maximize2 size={13} />
                  <span>Full Screen</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleAttemptClose}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        }
      >
        {/* Fullscreen Studio Focus Banner */}
        {isFullscreen && (
          <div className="mb-4 p-2.5 bg-blue-50/90 border border-blue-200/80 rounded-xl text-xs text-blue-900 flex items-center justify-between gap-3 shadow-2xs animate-fadeIn">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold shrink-0">
                ★
              </span>
              <span className="truncate">
                <strong>Studio Full Screen View</strong> • Focused workspace mode for task <span className="font-mono font-bold">{task.jiraIssueKey || task.id}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCopyShareLink(true)}
                className="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-800 text-[11px] font-bold rounded-lg border border-blue-200 shrink-0 cursor-pointer shadow-2xs transition-colors flex items-center gap-1"
                title="Copy share link for this task"
              >
                {shareCopied ? <Check size={11} className="text-emerald-600" /> : <Share2 size={11} className="text-blue-600" />}
                <span>{shareCopied ? 'Copied' : 'Share Link'}</span>
              </button>
              <button
                type="button"
                onClick={handleToggleFullscreen}
                className="px-2.5 py-1 bg-white hover:bg-blue-100 text-slate-700 text-[11px] font-semibold rounded-lg border border-slate-200 shrink-0 cursor-pointer shadow-2xs transition-colors flex items-center gap-1"
                title="Exit full screen focus view"
              >
                <Minimize2 size={11} />
                <span className="hidden sm:inline">Exit Full Screen</span>
              </button>
            </div>
          </div>
        )}

        {/* Success Alert Banner */}
        {savedSuccessAlert && (
          <div className="mb-4 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
            <span>{savedSuccessAlert}</span>
          </div>
        )}

        {/* Jira Sync Feedback Banner */}
        {jiraSyncFeedback && (
          <div className={`mb-4 p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-fadeIn ${
            jiraSyncFeedback.type === 'success' ? 'bg-blue-50 text-blue-900 border border-blue-200' : 'bg-red-50 text-red-900 border border-red-200'
          }`}>
            {jiraSyncFeedback.type === 'success' ? <CheckCircle2 size={15} className="text-blue-600" /> : <AlertTriangle size={15} className="text-red-600" />}
            <span>{jiraSyncFeedback.message}</span>
          </div>
        )}

        <div className={`grid grid-cols-1 ${isFullscreen ? 'lg:grid-cols-12 max-w-7xl mx-auto w-full' : 'md:grid-cols-3'} gap-6`}>
          {/* Main Left Column */}
          <div className={`${isFullscreen ? 'lg:col-span-8' : 'md:col-span-2'} space-y-5`}>
            {/* Title & More Actions */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {activeEditField === 'title' && canEdit ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      autoFocus
                      value={titleInputVal}
                      onChange={(e) => setTitleInputVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle();
                        if (e.key === 'Escape') setActiveEditField(null);
                      }}
                      className="flex-1 text-base font-bold text-slate-900 bg-white border border-blue-500 rounded-lg px-2.5 py-1.5 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={handleSaveTitle}
                      className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveEditField(null)}
                      className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={canEdit ? () => { setTitleInputVal(task.title); setActiveEditField('title'); } : undefined}
                    className={`group flex items-start gap-2 p-1 -m-1 rounded-lg ${canEdit ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                    title={canEdit ? 'Click to edit title' : undefined}
                  >
                    <h2 className="text-lg font-bold text-slate-900 leading-snug">{task.title}</h2>
                    {canEdit && (
                      <Edit3 size={13} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity mt-1 shrink-0" />
                    )}
                  </div>
                )}
              </div>

              {/* Smart More Actions (⋯) Dropdown */}
              <div className="relative shrink-0" ref={moreActionsRef}>
                <button
                  type="button"
                  onClick={() => setIsMoreActionsOpen(!isMoreActionsOpen)}
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-200 shadow-2xs"
                  title="More Actions"
                >
                  <MoreHorizontal size={16} />
                </button>

                {isMoreActionsOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-30 animate-in fade-in duration-100 text-xs">
                    {/* Shareable Studio Links */}
                    <button
                      type="button"
                      onClick={() => {
                        handleCopyShareLink(true);
                        setIsMoreActionsOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-700 font-semibold flex items-center gap-2 cursor-pointer"
                      title="Copy link to open this task full-screen in the studio"
                    >
                      <Share2 size={13} className="text-blue-600 shrink-0" />
                      <span>Copy Fullscreen Share Link</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleCopyShareLink(false);
                        setIsMoreActionsOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 font-medium flex items-center gap-2 cursor-pointer"
                      title="Copy standard task link"
                    >
                      <Link2 size={13} className="text-slate-500 shrink-0" />
                      <span>Copy Task Link</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleToggleFullscreen();
                        setIsMoreActionsOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 font-medium flex items-center gap-2 cursor-pointer"
                    >
                      {isFullscreen ? (
                        <>
                          <Minimize2 size={13} className="text-slate-500 shrink-0" />
                          <span>Exit Full Screen</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 size={13} className="text-slate-500 shrink-0" />
                          <span>View Full Screen</span>
                        </>
                      )}
                    </button>

                    <div className="my-1 border-t border-slate-100" />

                    {/* Jira Integration Actions */}
                    {task.jiraIssueKey ? (
                      <>
                        <button
                          type="button"
                          disabled={isJiraSyncing}
                          onClick={() => {
                            handlePullFromJira();
                            setIsMoreActionsOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-blue-700 font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                          title="Pull latest status, assignee, estimate, and worklog from Jira"
                        >
                          <RefreshCw size={13} className={isJiraSyncing ? 'animate-spin text-blue-600' : 'text-blue-600'} />
                          <span>{isJiraSyncing ? 'Syncing...' : 'Sync with Jira'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={isJiraSyncing}
                          onClick={() => {
                            handleSyncToJira();
                            setIsMoreActionsOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 font-medium flex items-center gap-2 cursor-pointer disabled:opacity-50"
                          title="Push Studio changes, time tracking, and comments to Jira"
                        >
                          <UploadCloud size={13} className="text-slate-600" />
                          <span>Push Updates to Jira</span>
                        </button>

                        {jiraUrl && (
                          <a
                            href={jiraUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => setIsMoreActionsOpen(false)}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 font-medium flex items-center gap-2 cursor-pointer"
                          >
                            <ExternalLink size={13} className="text-slate-500" />
                            <span>Open in Jira</span>
                          </a>
                        )}
                        <div className="my-1 border-t border-slate-100" />
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={isJiraSyncing}
                          onClick={() => {
                            handlePushNewToJira();
                            setIsMoreActionsOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-700 font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                          title="Create a new ticket in Jira mapped project and link this task"
                        >
                          <UploadCloud size={13} className={isJiraSyncing ? 'animate-spin text-blue-600' : 'text-blue-600'} />
                          <span>{isJiraSyncing ? 'Pushing to Jira...' : 'Push to Jira'}</span>
                        </button>
                        <div className="my-1 border-t border-slate-100" />
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setIsRevisionOpen(true);
                        setIsMoreActionsOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 font-medium flex items-center gap-2 cursor-pointer"
                    >
                      <RotateCcw size={13} className="text-amber-600" />
                      <span>Request Revision</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (task.status === 'BLOCKED') {
                          updateTaskStatus(task.id, 'IN_PROGRESS');
                        } else {
                          setIsBlockerOpen(true);
                        }
                        setIsMoreActionsOpen(false);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 font-medium flex items-center gap-2 cursor-pointer"
                    >
                      <ShieldAlert size={13} className={task.status === 'BLOCKED' ? 'text-emerald-600' : 'text-rose-600'} />
                      <span>{task.status === 'BLOCKED' ? 'Unblock Task' : 'Flag Blocker'}</span>
                    </button>

                    {task.sprintId && (
                      <button
                        type="button"
                        onClick={() => {
                          moveTaskToBacklog(task.id);
                          setIsMoreActionsOpen(false);
                          setSavedSuccessAlert('Moved task to Backlog');
                          setTimeout(() => setSavedSuccessAlert(null), 3000);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 font-medium flex items-center gap-2 cursor-pointer"
                      >
                        <FolderKanban size={13} className="text-slate-600" />
                        <span>Move to Backlog</span>
                      </button>
                    )}

                    {task.artistId && (
                      <button
                        type="button"
                        onClick={() => {
                          unassignTask(task.id);
                          setIsMoreActionsOpen(false);
                          setSavedSuccessAlert('Unassigned task');
                          setTimeout(() => setSavedSuccessAlert(null), 3000);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 font-medium flex items-center gap-2 cursor-pointer"
                      >
                        <UserX size={13} className="text-slate-600" />
                        <span>Unassign Task</span>
                      </button>
                    )}

                    {currentUser?.role === 'ADMIN' && (
                      <>
                        <div className="my-1 border-t border-slate-100" />
                        <button
                          type="button"
                          onClick={() => {
                            setIsConfirmDeleteOpen(true);
                            setIsMoreActionsOpen(false);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-rose-700 font-semibold flex items-center gap-2 cursor-pointer"
                        >
                          <Trash2 size={13} />
                          <span>Delete Task</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Description (Natural Jira-like block) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Description
                </label>
                {canEdit && activeEditField !== 'description' && (
                  <button
                    type="button"
                    onClick={() => { setDescInputVal(task.description || ''); setActiveEditField('description'); }}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 size={11} />
                    <span>Edit</span>
                  </button>
                )}
              </div>

              {activeEditField === 'description' && canEdit ? (
                <div className="space-y-2">
                  <textarea
                    rows={4}
                    autoFocus
                    value={descInputVal}
                    onChange={(e) => setDescInputVal(e.target.value)}
                    placeholder="Add a description for this task..."
                    className="w-full text-xs text-slate-900 bg-white border border-blue-500 rounded-lg p-2.5 focus:outline-hidden"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveEditField(null)}
                      className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-md cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDescription}
                      className="px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={canEdit ? () => { setDescInputVal(task.description || ''); setActiveEditField('description'); } : undefined}
                  className={`p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed whitespace-pre-wrap ${
                    canEdit ? 'cursor-pointer hover:bg-slate-100/80 transition-colors' : ''
                  }`}
                >
                  {task.description ? (
                    task.description
                  ) : (
                    <span className="text-slate-400 italic">Click to add a description...</span>
                  )}
                </div>
              )}
            </div>

            {/* Attachments & Media Gallery (Compact) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Paperclip size={13} className="text-slate-500" />
                    <span>Attachments ({allAttachments.length + (task.jiraIssueKey ? jiraAttachments.length : 0)})</span>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    ref={directFileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,.gif,.webp,.mp4,.mov"
                    onChange={handleDirectUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => directFileInputRef.current?.click()}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                  >
                    <span>+ Add Attachment</span>
                  </button>

                  {task.jiraIssueKey && jiraAttachments.length > 0 && (
                    <button
                      type="button"
                      disabled={isImportingAllJira}
                      onClick={handleImportAllJira}
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="Import all attachments from Jira"
                    >
                      <FolderDown size={11} />
                      <span>{isImportingAllJira ? 'Importing...' : `Import from Jira (${jiraAttachments.length})`}</span>
                    </button>
                  )}
                </div>
              </div>

              {allAttachments.length === 0 && jiraAttachments.length === 0 ? (
                <div
                  onClick={() => directFileInputRef.current?.click()}
                  className="p-4 border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl text-center cursor-pointer transition-colors bg-slate-50/50"
                >
                  <p className="text-xs text-slate-500 font-medium">Drop files to attach, or <span className="text-blue-600 font-semibold underline">browse</span></p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {allAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="group relative bg-white border border-slate-200 hover:border-blue-300 rounded-lg p-2 flex items-center gap-2 shadow-2xs transition-all"
                    >
                      <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {att.url && att.url.trim() ? (
                          <img src={att.url.trim()} alt={att.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon size={16} className="text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{att.name}</p>
                        <p className="text-[10px] text-slate-400">{att.size || 'Local asset'}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => setLightboxAttachment(att)}
                          className="p-1 text-slate-500 hover:text-blue-600 rounded cursor-pointer"
                          title="Preview"
                        >
                          <Maximize2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeTaskAttachment(task.id, att.id)}
                          className="p-1 text-slate-500 hover:text-rose-600 rounded cursor-pointer"
                          title="Remove"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Jira-Style Activity Tabs: Comments | History */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b border-slate-200">
                <div className="flex items-center gap-6">
                  <button
                    type="button"
                    onClick={() => setActivityTab('comments')}
                    className={`pb-2 text-xs font-bold transition-colors cursor-pointer border-b-2 -mb-px flex items-center gap-1.5 ${
                      activityTab === 'comments'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <MessageSquare size={13} />
                    <span>Comments</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 font-semibold">
                      {task.comments?.length || 0}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivityTab('history')}
                    className={`pb-2 text-xs font-bold transition-colors cursor-pointer border-b-2 -mb-px flex items-center gap-1.5 ${
                      activityTab === 'history'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <History size={13} />
                    <span>History & Work Logs</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 font-semibold">
                      {taskTimeEntries.length + (task.revisions?.length || 0)}
                    </span>
                  </button>
                </div>
              </div>

              {/* TAB 1: COMMENTS */}
              {activityTab === 'comments' && (
                <div className="space-y-4 animate-in fade-in duration-100">
                  {/* Comments List */}
                  <div className="space-y-3">
                    {(!task.comments || task.comments.length === 0) ? (
                      <p className="text-xs text-slate-400 italic py-2">No comments yet. Be the first to share notes or feedback.</p>
                    ) : (
                      task.comments.map((comment) => (
                        <div key={comment.id} className="flex items-start gap-2.5 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                          <Avatar name={comment.userName} src={comment.userAvatar} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-900">{comment.userName}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {new Date(comment.createdAt).toLocaleDateString()} {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-800 mt-1 whitespace-pre-wrap" style={{ color: comment.textColor }}>
                              {comment.content}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Comment Composer */}
                  <form onSubmit={handleAddComment} className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs space-y-2">
                    <textarea
                      rows={2}
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment or paste notes..."
                      className="w-full text-xs text-slate-900 bg-transparent border-0 outline-hidden resize-y placeholder:text-slate-400"
                    />
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2 text-slate-400 text-[11px]">
                        <span>Pro-tip: Markdown supported</span>
                        {task.jiraIssueKey && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                            Auto-syncs to Jira ({task.jiraIssueKey})
                          </span>
                        )}
                      </div>
                      <button
                        type="submit"
                        disabled={!newComment.trim() && commentAttachments.length === 0}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                      >
                        <Send size={12} />
                        <span>Save</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* TAB 2: HISTORY & WORK LOGS */}
              {activityTab === 'history' && (
                <div className="space-y-3 animate-in fade-in duration-100">
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                    {/* Time Log Entries */}
                    {taskTimeEntries.map((log) => (
                      <div key={log.id} className="p-3 text-xs flex items-start justify-between hover:bg-slate-50">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Clock size={13} className="text-blue-600" />
                            <span className="font-bold text-slate-800">{log.artistName} logged work</span>
                          </div>
                          <p className="text-slate-600 pl-5">{log.description || 'General progress'}</p>
                          <p className="text-[10px] text-slate-400 font-mono pl-5">{log.date}</p>
                        </div>
                        <div className="text-right shrink-0 font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {formatDuration(log.hours)} ({log.hours}h)
                        </div>
                      </div>
                    ))}

                    {/* Revisions History */}
                    {task.revisions?.map((rev) => (
                      <div key={rev.id} className="p-3 text-xs flex items-start justify-between bg-amber-50/40 hover:bg-amber-50/80">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 text-amber-900 font-bold">
                            <RotateCcw size={13} className="text-amber-600" />
                            <span>Revision #{rev.revisionNumber} requested by {rev.requestedByName}</span>
                          </div>
                          <p className="text-amber-800 pl-5 italic">"{rev.comment}"</p>
                          <p className="text-[10px] text-amber-600 font-mono pl-5">{rev.date}</p>
                        </div>
                        {rev.additionalHours > 0 && (
                          <span className="text-[11px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                            +{rev.additionalHours}h
                          </span>
                        )}
                      </div>
                    ))}

                    {/* Creation Record */}
                    <div className="p-3 text-xs flex items-center justify-between text-slate-500 bg-slate-50/50">
                      <div className="flex items-center gap-2">
                        <Calendar size={13} className="text-slate-400" />
                        <span>Created on {task.createdDate || 'Initial Setup'} by {task.createdBy || 'Lead'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar Details Column (1 Col) */}
          <div className="space-y-4">
            {/* 1. DETAILS PANEL */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3.5 shadow-2xs">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                Details
              </h3>

              <div className="space-y-3 text-xs">
                {/* Status (Jira Status = Studio Status) */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Status
                  </label>
                  {canEdit ? (
                    <select
                      id="select-task-status"
                      value={normalizeTaskStatus(task.status)}
                      onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                      className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:border-slate-900 focus:bg-white outline-hidden cursor-pointer shadow-2xs"
                    >
                      {WORKFLOW_STATUS_LIST.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 font-bold text-slate-800">
                      {normalizeTaskStatus(task.status)}
                    </div>
                  )}
                </div>

                {/* Assignee */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Assignee
                    </label>
                    {canEdit && !isAssignedToMe && currentUser && (
                      <button
                        type="button"
                        onClick={() => {
                          const myArtistRecord = artists.find(
                            a => (currentUser.artistId && a.id === currentUser.artistId) || 
                                 (currentUser.id && a.userId === currentUser.id) || 
                                 (currentUser.email && a.email && a.email.toLowerCase() === currentUser.email.toLowerCase())
                          );
                          const myId = myArtistRecord?.id || currentUser.artistId || currentUser.id;
                          updateTask(task.id, { artistId: myId });
                          setSavedSuccessAlert('Assigned to you');
                          setTimeout(() => setSavedSuccessAlert(null), 3000);
                        }}
                        className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                      >
                        Assign to me
                      </button>
                    )}
                  </div>

                  {canEdit ? (
                    <select
                      value={task.artistId || ''}
                      onChange={async (e) => {
                        const newArtistId = e.target.value || undefined;
                        updateTask(task.id, { artistId: newArtistId });
                        const chosen = artists.find(a => a.id === newArtistId);
                        setSavedSuccessAlert(chosen ? `Assigned to ${chosen.name}` : 'Unassigned');
                        setTimeout(() => setSavedSuccessAlert(null), 3000);

                        // If Jira-linked task, push update to Jira so assignee is synced back
                        if (task.jiraIssueKey) {
                          try {
                            await syncTaskToJira(task.id);
                          } catch {
                            // non-blocking
                          }
                        }
                      }}
                      className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:border-slate-900 focus:bg-white outline-hidden cursor-pointer shadow-2xs"
                    >
                      <option value="">Unassigned</option>
                      {artists.map((art) => (
                        <option key={art.id} value={art.id}>
                          {art.name} ({art.role})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2 p-1.5 bg-slate-50 rounded-lg border border-slate-200">
                      <Avatar name={artist?.name || 'Unassigned'} src={artist?.avatar} size="xs" />
                      <span className="font-semibold text-slate-800 truncate">{artist?.name || 'Unassigned'}</span>
                    </div>
                  )}
                </div>

                {/* Original Artist (Supporting field) */}
                {task.jiraOriginalAssignee && (
                  <div className="space-y-0.5 pt-0.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Original Artist / Jira Lead
                    </span>
                    <span className="text-xs text-slate-700 font-medium">
                      {task.jiraOriginalAssignee}
                    </span>
                  </div>
                )}

                {/* Project */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Project
                  </label>
                  {canEdit ? (
                    <div>
                      <select
                        value={task.projectId}
                        onChange={(e) => {
                          updateTask(task.id, { projectId: e.target.value });
                          const p = projects.find(item => item.id === e.target.value);
                          setSavedSuccessAlert(`Project set to "${p?.name || e.target.value}"`);
                          setTimeout(() => setSavedSuccessAlert(null), 3000);
                        }}
                        className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:border-slate-900 focus:bg-white outline-hidden cursor-pointer shadow-2xs"
                      >
                        {availableProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.key}){p.status !== 'Active' ? ` [${p.status}]` : ''}
                          </option>
                        ))}
                      </select>
                      {(currentUser?.role === 'ADMIN' || currentUser?.role === 'ART_DIRECTOR') && projects.some(p => p.status === 'Archived' || p.status === 'Paused') && (
                        <label className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={showArchivedProjects}
                            onChange={(e) => setShowArchivedProjects(e.target.checked)}
                            className="w-3 h-3 rounded border-slate-300 text-slate-700"
                          />
                          <span>Show Archived Projects</span>
                        </label>
                      )}
                    </div>
                  ) : (
                    <div className="px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 font-semibold text-slate-800">
                      {project?.name || 'Project'}
                    </div>
                  )}
                </div>

                {/* Sprint */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Sprint
                  </label>
                  {canEdit ? (
                    <select
                      value={task.sprintId || ''}
                      onChange={(e) => {
                        const newSprintId = e.target.value || undefined;
                        if (!newSprintId) {
                          moveTaskToBacklog(task.id);
                          setSavedSuccessAlert('Moved to Backlog');
                        } else {
                          moveTaskToSprint(task.id, newSprintId);
                          const sp = sprints.find(s => s.id === newSprintId);
                          setSavedSuccessAlert(`Moved to ${sp?.name || 'Sprint'}`);
                        }
                        setTimeout(() => setSavedSuccessAlert(null), 3000);
                      }}
                      className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:border-slate-900 focus:bg-white outline-hidden cursor-pointer shadow-2xs"
                    >
                      <option value="">📁 Backlog (Unscheduled)</option>
                      {sprints
                        .filter(s => s.status?.toUpperCase() !== 'COMPLETED' || s.id === task.sprintId)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            Sprint #{s.sprintNumber}: {s.name} ({s.status})
                          </option>
                        ))}
                    </select>
                  ) : (
                    <div className="px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 font-semibold text-slate-800">
                      {sprint ? `Sprint #${sprint.sprintNumber}: ${sprint.name}` : 'Backlog'}
                    </div>
                  )}

                  {/* Moved / Carried Forward Sprint Details */}
                  {(task.isMoved || task.movedFromSprintName || (task.sprintMovements && task.sprintMovements.length > 0) || task.tags?.includes('Moved')) && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1.5 mt-2">
                      <div className="flex items-center gap-1.5 font-bold text-amber-900">
                        <ArrowRightLeft size={13} className="text-amber-700" />
                        <span>Carried Forward / Moved</span>
                      </div>
                      {task.movedFromSprintName && (
                        <div className="text-[11px] text-amber-800">
                          Moved from: <span className="font-semibold text-slate-800">{task.movedFromSprintName}</span>
                        </div>
                      )}
                      {task.sprintMovements && task.sprintMovements.length > 0 && (
                        <div className="space-y-1 pt-1 border-t border-amber-200/60 font-mono text-[10px] text-amber-900">
                          {task.sprintMovements.map((m, idx) => (
                            <div key={idx} className="flex items-center justify-between gap-2">
                              <span className="truncate">{m.fromSprintName} → {m.toSprintName}</span>
                              <span className="text-slate-400 shrink-0">{m.movedAt?.split('T')[0] || m.movedAt}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Story Points */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Story Points
                    </label>
                    {canEdit && activeEditField !== 'storyPoints' && (
                      <button
                        type="button"
                        onClick={() => { setSpInputVal(task.storyPoints || 1); setActiveEditField('storyPoints'); }}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {activeEditField === 'storyPoints' && canEdit ? (
                    <div className="flex items-center gap-1.5 flex-wrap p-2 bg-blue-50/60 rounded-lg border border-blue-200">
                      {[1, 2, 3, 5, 8, 13].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleSaveStoryPoints(val)}
                          className={`px-2 py-1 text-xs font-bold rounded cursor-pointer ${
                            spInputVal === val ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div
                      onClick={canEdit ? () => { setSpInputVal(task.storyPoints || 1); setActiveEditField('storyPoints'); } : undefined}
                      className={`px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 font-semibold text-slate-900 ${
                        canEdit ? 'cursor-pointer hover:bg-slate-100' : ''
                      }`}
                    >
                      {task.storyPoints ? `${task.storyPoints} Story Points` : 'None'}
                    </div>
                  )}
                </div>

                {/* Priority */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Priority
                  </label>
                  {canEdit ? (
                    <select
                      value={task.priority}
                      onChange={(e) => {
                        updateTask(task.id, { priority: e.target.value as Priority });
                        setSavedSuccessAlert(`Priority set to ${e.target.value}`);
                        setTimeout(() => setSavedSuccessAlert(null), 3000);
                      }}
                      className="w-full text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:border-slate-900 focus:bg-white outline-hidden cursor-pointer shadow-2xs"
                    >
                      {['Lowest', 'Low', 'Medium', 'High', 'Highest'].map((pr) => (
                        <option key={pr} value={pr}>
                          {pr}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <PriorityBadge priority={task.priority} />
                  )}
                </div>
              </div>
            </div>

            {/* 2. EFFORT & TIME TRACKING PANEL */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Time Tracking
                </h3>
                <button
                  type="button"
                  onClick={() => setIsLogTimeOpen(true)}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                >
                  + Log Time
                </button>
              </div>

              <div className="space-y-2.5 text-xs">
                {/* Original Estimate */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Original Estimate:</span>
                  {activeEditField === 'originalEstimate' && canEdit ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        autoFocus
                        value={estimateInputStr}
                        onChange={(e) => setEstimateInputStr(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const parsed = parseDurationString(estimateInputStr);
                            handleSaveOriginalEstimate(parsed.totalHours);
                          }
                          if (e.key === 'Escape') setActiveEditField(null);
                        }}
                        className="w-16 text-xs bg-white border border-blue-500 rounded px-1.5 py-0.5"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const parsed = parseDurationString(estimateInputStr);
                          handleSaveOriginalEstimate(parsed.totalHours);
                        }}
                        className="p-0.5 text-blue-600"
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={canEdit ? () => { setEstimateInputStr(formatDuration(task.originalEstimate || 0)); setActiveEditField('originalEstimate'); } : undefined}
                      className="font-semibold text-slate-900 hover:underline cursor-pointer"
                    >
                      {task.originalEstimate > 0 ? formatDuration(task.originalEstimate) : 'Set estimate'}
                    </button>
                  )}
                </div>

                {/* Time Logged */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Time Logged:</span>
                  <span className="font-semibold text-slate-900">
                    {formatDuration(task.timeLogged || 0)}
                  </span>
                </div>

                {/* Remaining Estimate */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Remaining:</span>
                  {activeEditField === 'remainingEstimate' && canEdit ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        autoFocus
                        value={estimateInputStr}
                        onChange={(e) => setEstimateInputStr(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const parsed = parseDurationString(estimateInputStr);
                            handleSaveRemainingEstimate(parsed.totalHours);
                          }
                          if (e.key === 'Escape') setActiveEditField(null);
                        }}
                        className="w-16 text-xs bg-white border border-blue-500 rounded px-1.5 py-0.5"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const parsed = parseDurationString(estimateInputStr);
                          handleSaveRemainingEstimate(parsed.totalHours);
                        }}
                        className="p-0.5 text-blue-600"
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={canEdit ? () => { setEstimateInputStr(formatDuration(task.remainingEstimate ?? task.originalEstimate ?? 0)); setActiveEditField('remainingEstimate'); } : undefined}
                      className="font-semibold text-slate-900 hover:underline cursor-pointer"
                    >
                      {formatDuration(task.remainingEstimate ?? task.originalEstimate ?? 0)}
                    </button>
                  )}
                </div>

                {/* Progress Bar */}
                {task.originalEstimate > 0 && (
                  <div className="pt-1">
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-1.5 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, ((task.timeLogged || 0) / task.originalEstimate) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. DATES */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-2xs text-xs">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                Dates
              </h3>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Due Date:</span>
                  {activeEditField === 'dueDate' && canEdit ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        autoFocus
                        value={dueDateInputVal}
                        onChange={(e) => setDueDateInputVal(e.target.value)}
                        className="text-xs bg-white border border-blue-500 rounded px-1.5 py-0.5"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveDueDate(dueDateInputVal)}
                        className="p-0.5 text-blue-600"
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={canEdit ? () => { setDueDateInputVal(task.dueDate || ''); setActiveEditField('dueDate'); } : undefined}
                      className="font-semibold text-slate-800 hover:underline cursor-pointer"
                    >
                      {task.dueDate || 'Set date'}
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-slate-400">
                  <span>Created:</span>
                  <span>{task.createdDate || 'Initial'}</span>
                </div>
              </div>
            </div>

            {/* 4. JIRA INFORMATION SECTION (Requirement: Jira Ticket Information Must Be Visible in Studio Task Details) */}
            {(isJiraLinked || task.jiraIssueKey || task.jiraParentKey || task.jiraSprintId || task.jiraFixVersion || (task.jiraFixVersions && task.jiraFixVersions.length > 0)) && (
              <div
                id="jira-information-section"
                className="p-4 bg-white border border-blue-200 rounded-xl space-y-3 shadow-2xs text-xs"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-blue-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center shadow-xs">
                      <FolderKanban size={13} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs tracking-tight">
                        Jira Information
                      </h4>
                      <span className="text-[10px] text-blue-700 font-medium">
                        Atlassian Jira Integration
                      </span>
                    </div>
                  </div>

                  {jiraUrl && (
                    <a
                      href={jiraUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                      title="Open in Jira"
                    >
                      <span>Open in Jira</span>
                      <ExternalLink size={11} className="text-blue-600" />
                    </a>
                  )}
                </div>

                {/* Structured Jira Metadata Fields */}
                <div className="space-y-2 text-xs">
                  {/* Jira: Issue Key */}
                  <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                    <span className="text-slate-500 font-medium">Jira:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs">
                        {task.jiraIssueKey || task.id}
                      </span>
                      {jiraUrl && (
                        <a
                          href={jiraUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-800 p-0.5"
                          title="Open ticket in Jira"
                        >
                          <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Jira Issue ID */}
                  {(task.jiraIssueId || task.id) && (
                    <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">Issue ID:</span>
                      <span className="font-mono text-slate-700 font-semibold bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                        {task.jiraIssueId || task.id}
                      </span>
                    </div>
                  )}

                  {/* Project */}
                  <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                    <span className="text-slate-500 font-medium">Project:</span>
                    <span className="font-semibold text-slate-900 text-right truncate max-w-[180px]">
                      {task.jiraProjectName || task.jiraProjectKey || project?.name || 'WWE'}
                    </span>
                  </div>

                  {/* Type */}
                  <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                    <span className="text-slate-500 font-medium">Type:</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                      <Tag size={10} className="text-slate-500" />
                      <span>{task.jiraIssueType || task.taskType || 'Story'}</span>
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                    <span className="text-slate-500 font-medium">Status:</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {task.jiraStatusName || task.status || 'In Progress'}
                    </span>
                  </div>

                  {/* Assignee */}
                  <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                    <span className="text-slate-500 font-medium">Assignee:</span>
                    <div className="flex items-center gap-1.5 text-right">
                      {jiraAssigneeInfo.avatar && (
                        <Avatar name={jiraAssigneeInfo.displayName} src={jiraAssigneeInfo.avatar} size="xs" />
                      )}
                      <span className="font-semibold text-slate-900">
                        {task.jiraOriginalAssignee || jiraAssigneeInfo.displayName || (artist?.name ?? 'Unassigned')}
                      </span>
                      {artist && task.jiraOriginalAssignee && artist.name !== task.jiraOriginalAssignee && (
                        <span className="text-[10px] text-slate-500 font-normal">
                          ({artist.name})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Reporter */}
                  <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                    <span className="text-slate-500 font-medium">Reporter:</span>
                    <span className="font-semibold text-slate-900">
                      {task.jiraReporter || 'Pramod Jadhav'}
                    </span>
                  </div>

                  {/* Sprint */}
                  <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                    <span className="text-slate-500 font-medium">Sprint:</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[11px]">
                      <Layers size={11} className="text-indigo-600" />
                      <span>
                        {task.jiraSprintName || (task.jiraSprintNumber ? `Sprint ${task.jiraSprintNumber}` : null) || (task.jiraSprintId ? `Sprint #${task.jiraSprintId}` : null) || (sprint?.name ?? 'Backlog')}
                      </span>
                    </span>
                  </div>

                  {/* Fix Version */}
                  <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                    <span className="text-slate-500 font-medium">Fix Version:</span>
                    <span className="font-semibold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px] inline-flex items-center gap-1">
                      <Tag size={10} className="text-amber-600" />
                      <span>{jiraMeta.fixVersion || task.jiraFixVersion || task.fixVersion || 'Update 98'}</span>
                    </span>
                  </div>

                  {/* Component */}
                  <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                    <span className="text-slate-500 font-medium">Component:</span>
                    <span className="font-semibold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                      {task.jiraComponent || (task.jiraComponents && task.jiraComponents.length > 0 ? task.jiraComponents.join(', ') : '2D Art')}
                    </span>
                  </div>

                  {/* Priority */}
                  <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                    <span className="text-slate-500 font-medium">Priority:</span>
                    <PriorityBadge priority={(task.jiraPriority || task.priority || 'Medium') as Priority} />
                  </div>

                  {/* Story Points */}
                  <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                    <span className="text-slate-500 font-medium">Story Points:</span>
                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {task.jiraStoryPoints !== undefined ? task.jiraStoryPoints : (task.storyPoints !== undefined ? task.storyPoints : 4)}
                    </span>
                  </div>

                  {/* Original Estimate */}
                  <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                    <span className="text-slate-500 font-medium">Original Estimate:</span>
                    <span className="font-semibold text-slate-900">
                      {formatDuration(task.jiraOriginalEstimate !== undefined ? task.jiraOriginalEstimate : (task.originalEstimate !== undefined ? task.originalEstimate : 8))}
                    </span>
                  </div>

                  {/* Time Logged */}
                  <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                    <span className="text-slate-500 font-medium">Time Logged:</span>
                    <span className="font-semibold text-slate-900">
                      {formatDuration(task.jiraTimeLogged !== undefined ? task.jiraTimeLogged : (task.timeLogged !== undefined ? task.timeLogged : 5))}
                    </span>
                  </div>

                  {/* Remaining Estimate */}
                  <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                    <span className="text-slate-500 font-medium">Remaining:</span>
                    <span className="font-semibold text-slate-900">
                      {formatDuration(task.jiraRemainingEstimate !== undefined ? task.jiraRemainingEstimate : (task.remainingEstimate !== undefined ? task.remainingEstimate : (task.originalEstimate ? Math.max(0, (task.originalEstimate || 0) - (task.timeLogged || 0)) : 3)))}
                    </span>
                  </div>

                  {/* Due Date */}
                  <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                    <span className="text-slate-500 font-medium">Due Date:</span>
                    <span className="font-semibold text-slate-900">
                      {task.jiraDueDate || task.dueDate || 'None'}
                    </span>
                  </div>

                  {/* Update No. (where available) */}
                  {resolvedUpdateNo && (
                    <div className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-50">
                      <span className="text-slate-500 font-medium">Update No.:</span>
                      <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                        {resolvedUpdateNo}
                      </span>
                    </div>
                  )}

                  {/* Jira Parent */}
                  {jiraMeta.parentKey && (
                    <div className="pt-1">
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Parent:</span>
                          {jiraMeta.parentUrl ? (
                            <a
                              href={jiraMeta.parentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono font-bold text-purple-700 hover:text-purple-900 hover:underline inline-flex items-center gap-1 text-[11px]"
                            >
                              <GitCommit size={11} className="text-purple-600" />
                              <span>{jiraMeta.parentKey}</span>
                              <ExternalLink size={10} className="text-purple-500" />
                            </a>
                          ) : (
                            <span className="font-mono font-bold text-purple-700 inline-flex items-center gap-1 text-[11px]">
                              <GitCommit size={11} className="text-purple-600" />
                              <span>{jiraMeta.parentKey}</span>
                            </span>
                          )}
                          {jiraMeta.parentType && (
                            <span className="text-[9px] font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                              {jiraMeta.parentType}
                            </span>
                          )}
                        </div>
                        {jiraMeta.parentSummary && (
                          <p className="text-[11px] text-slate-700 font-normal leading-relaxed">
                            {jiraMeta.parentSummary}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Direct Jira Link / Action Button */}
                {jiraUrl && (
                  <div className="pt-2 border-t border-blue-50">
                    <a
                      href={jiraUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-lg border border-blue-200 transition-colors cursor-pointer"
                    >
                      <FolderKanban size={13} className="text-blue-600" />
                      <span>Open in Jira</span>
                      <ExternalLink size={11} className="text-blue-600 ml-0.5" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* 5. STUDIO TASK SHARE LINK CARD */}
            <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Share2 size={13} className="text-blue-600" />
                  <span>Task Share Link</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  Studio Link
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Direct link that opens this task in full-screen focus mode within the studio workspace.
              </p>
              <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                <span className="font-mono text-[10px] text-slate-600 truncate flex-1 select-all">
                  {getTaskShareUrl(task.id, true)}
                </span>
                <button
                  type="button"
                  id="btn-copy-task-share-url-sidebar"
                  onClick={() => handleCopyShareLink(true)}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded border border-slate-200 shrink-0 cursor-pointer shadow-2xs flex items-center gap-1 transition-colors"
                  title="Copy full screen studio link"
                >
                  {shareCopied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                  <span>{shareCopied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="flex items-center justify-between text-[11px] pt-0.5">
                <button
                  type="button"
                  onClick={() => handleCopyShareLink(false)}
                  className="text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Copy standard link
                </button>
                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                >
                  {isFullscreen ? 'Exit Full Screen' : 'Toggle Full Screen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Sub-modals */}
      {isLogTimeOpen && (
        <LogTimeModal
          isOpen={isLogTimeOpen}
          onClose={() => setIsLogTimeOpen(false)}
          task={task}
        />
      )}

      {isRevisionOpen && (
        <RevisionModal
          isOpen={isRevisionOpen}
          onClose={() => setIsRevisionOpen(false)}
          task={task}
        />
      )}

      {isBlockerOpen && (
        <BlockerModal
          isOpen={isBlockerOpen}
          onClose={() => setIsBlockerOpen(false)}
          task={task}
        />
      )}

      {lightboxAttachment && (
        <MediaLightboxModal
          isOpen={Boolean(lightboxAttachment)}
          onClose={() => setLightboxAttachment(null)}
          media={lightboxAttachment}
          task={task}
        />
      )}

      {/* Unsaved Changes Confirmation Modal */}
      {isUnsavedPromptOpen && (
        <Modal
          isOpen={isUnsavedPromptOpen}
          onClose={() => setIsUnsavedPromptOpen(false)}
          title="Unsaved Changes"
          maxWidth="sm"
          footer={
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsUnsavedPromptOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsUnsavedPromptOpen(false);
                  setNewComment('');
                  setCommentAttachments([]);
                  setActiveEditField(null);
                  onClose();
                }}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer transition-colors shadow-xs"
              >
                Discard Changes
              </button>
            </div>
          }
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-700 font-medium">
                You have unsaved edits or a comment in progress.
              </p>
              <p className="text-xs text-slate-500">
                Are you sure you want to discard your changes and close the task?
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {isConfirmDeleteOpen && (
        <Modal
          isOpen={isConfirmDeleteOpen}
          onClose={() => setIsConfirmDeleteOpen(false)}
          title="Delete Task"
          maxWidth="sm"
          footer={
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmDeleteOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteTask(task.id);
                  setIsConfirmDeleteOpen(false);
                  onClose();
                }}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          }
        >
          <p className="text-xs text-slate-600">
            Are you sure you want to permanently delete task <strong className="text-slate-900">{task.id}</strong>? This action cannot be undone.
          </p>
        </Modal>
      )}
    </>
  );
};
