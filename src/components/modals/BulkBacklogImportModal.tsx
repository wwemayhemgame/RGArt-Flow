import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Download,
  Layers,
  Sparkles,
  RefreshCw,
  FolderKanban,
  UserCheck,
  UserX,
  Clock,
  Calendar,
  Zap,
  HelpCircle,
  FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useArtOps } from '../../context/ArtOpsContext';
import { Project, Sprint, Artist, Priority, Task } from '../../types';
import { PriorityBadge } from '../common/Badge';

interface BulkBacklogImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectId?: string;
  defaultSprintId?: string;
  onSuccess?: (importedCount: number) => void;
}

interface ColumnMapping {
  title: string;
  storyPoints: string;
  dueDate: string;
  originalEstimate: string;
  jiraIssueKey: string;
  priority: string;
  taskType: string;
  description: string;
  assignee: string;
}

interface ParsedRowPreview {
  id: string;
  rawRow: Record<string, any>;
  title: string;
  storyPoints: number;
  dueDate: string;
  originalEstimate: number;
  jiraIssueKey: string;
  priority: Priority;
  taskType: string;
  description: string;
  assigneeName: string;
  matchedArtist?: Artist;
  selected: boolean;
  isValid: boolean;
  validationError?: string;
}

export const BulkBacklogImportModal: React.FC<BulkBacklogImportModalProps> = ({
  isOpen,
  onClose,
  defaultProjectId,
  defaultSprintId,
  onSuccess
}) => {
  const { projects, sprints, artists, currentUser, bulkImportTasksFromSpreadsheet } = useArtOps();

  // Wizard Step: 'upload' | 'map' | 'preview' | 'success'
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'success'>('upload');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [workbookRef, setWorkbookRef] = useState<XLSX.WorkBook | null>(null);

  // Configuration settings
  const [targetProjectId, setTargetProjectId] = useState<string>(() => {
    return defaultProjectId || (projects.length > 0 ? projects[0].id : '');
  });
  const [targetSprintId, setTargetSprintId] = useState<string>(() => defaultSprintId || '');
  const [defaultCategory, setDefaultCategory] = useState<string>('3D Asset');
  const [hoursPerStoryPoint, setHoursPerStoryPoint] = useState<number>(6);

  // Mapping state
  const [mapping, setMapping] = useState<ColumnMapping>({
    title: '',
    storyPoints: '',
    dueDate: '',
    originalEstimate: '',
    jiraIssueKey: '',
    priority: '',
    taskType: '',
    description: '',
    assignee: ''
  });

  // Parsed Items in Preview
  const [previewItems, setPreviewItems] = useState<ParsedRowPreview[]>([]);
  const [importedResult, setImportedResult] = useState<{ importedCount: number; updatedCount: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to normalize and auto-detect columns
  const autoDetectColumns = (headers: string[]): ColumnMapping => {
    const findHeader = (patterns: RegExp[]): string => {
      for (const pattern of patterns) {
        const found = headers.find(h => pattern.test(h.trim()));
        if (found) return found;
      }
      return '';
    };

    return {
      title: findHeader([
        /^summary$/i,
        /^issue summary$/i,
        /^task summary$/i,
        /^task title$/i,
        /^title$/i,
        /^name$/i,
        /^item$/i,
        /^subject$/i
      ]),
      storyPoints: findHeader([
        /^story points$/i,
        /^story point estimate$/i,
        /^custom field \(story points\)$/i,
        /^sp$/i,
        /^points$/i,
        /^storypoint$/i
      ]),
      dueDate: findHeader([
        /^due date$/i,
        /^duedate$/i,
        /^due$/i,
        /^target date$/i,
        /^target end$/i,
        /^delivery date$/i,
        /^deadline$/i,
        /^end date$/i
      ]),
      originalEstimate: findHeader([
        /^original estimate$/i,
        /^original estimate \(hours\)$/i,
        /^estimate$/i,
        /^estimated hours$/i,
        /^estimate \(h\)$/i,
        /^effort$/i,
        /^hours$/i
      ]),
      jiraIssueKey: findHeader([
        /^issue key$/i,
        /^key$/i,
        /^issue id$/i,
        /^jira key$/i,
        /^jira id$/i,
        /^ticket$/i,
        /^ticket id$/i
      ]),
      priority: findHeader([
        /^priority$/i,
        /^issue priority$/i,
        /^severity$/i,
        /^urgency$/i
      ]),
      taskType: findHeader([
        /^issue type$/i,
        /^type$/i,
        /^task type$/i,
        /^art type$/i,
        /^category$/i,
        /^component$/i
      ]),
      description: findHeader([
        /^description$/i,
        /^issue description$/i,
        /^details$/i,
        /^notes$/i,
        /^brief$/i
      ]),
      assignee: findHeader([
        /^assignee$/i,
        /^assigned to$/i,
        /^artist$/i,
        /^assignee name$/i,
        /^owner$/i
      ])
    };
  };

  // Process File buffer
  const processFileData = (buffer: ArrayBuffer, name: string, size: number) => {
    try {
      setParseError(null);
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        setParseError('The uploaded workbook contains no readable sheets.');
        return;
      }

      setWorkbookRef(workbook);
      setSheetNames(workbook.SheetNames);
      const firstSheetName = workbook.SheetNames[0];
      setSelectedSheet(firstSheetName);
      loadSheetData(workbook, firstSheetName);

      setFileName(name);
      setFileSize(`${(size / 1024).toFixed(1)} KB`);
      setStep('map');
    } catch (err: any) {
      console.error('Failed to parse spreadsheet file:', err);
      setParseError(`Failed to parse file: ${err.message || 'Corrupted or unsupported format'}`);
    }
  };

  // Load rows from selected sheet
  const loadSheetData = (workbook: XLSX.WorkBook, sheetName: string) => {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) return;

    const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (jsonData.length < 1) {
      setParseError(`Sheet "${sheetName}" is empty.`);
      return;
    }

    // First row is headers
    const headerRow = (jsonData[0] || []).map((h: any) => String(h || '').trim()).filter(Boolean);
    if (headerRow.length === 0) {
      setParseError('No column headers detected in the first row.');
      return;
    }

    setRawHeaders(headerRow);

    // Convert rows to objects
    const rows: Record<string, any>[] = [];
    for (let i = 1; i < jsonData.length; i++) {
      const rowArr = jsonData[i];
      if (!rowArr || rowArr.length === 0) continue;
      const isBlank = rowArr.every(cell => cell === '' || cell === null || cell === undefined);
      if (isBlank) continue;

      const rowObj: Record<string, any> = {};
      headerRow.forEach((colName, index) => {
        rowObj[colName] = rowArr[index] !== undefined ? rowArr[index] : '';
      });
      rows.push(rowObj);
    }

    setRawRows(rows);

    // Auto-detect columns
    const detected = autoDetectColumns(headerRow);
    setMapping(detected);
  };

  const handleSheetChange = (newSheet: string) => {
    setSelectedSheet(newSheet);
    if (workbookRef) {
      loadSheetData(workbookRef, newSheet);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        processFileData(event.target.result as ArrayBuffer, file.name, file.size);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        processFileData(event.target.result as ArrayBuffer, file.name, file.size);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Helper date normalizer
  const parseNormalizedDate = (value: any): string => {
    if (!value) {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      return d.toISOString().split('T')[0];
    }
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    const str = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  };

  // Helper priority normalizer
  const parseNormalizedPriority = (value: any): Priority => {
    if (!value) return 'Medium';
    const str = String(value).trim().toLowerCase();
    if (str.includes('highest') || str.includes('urgent') || str.includes('blocker') || str.includes('critical') || str.includes('p1')) {
      return 'Critical';
    }
    if (str.includes('high') || str.includes('major') || str.includes('p2')) {
      return 'High';
    }
    if (str.includes('low') || str.includes('minor') || str.includes('trivial') || str.includes('lowest') || str.includes('p4')) {
      return 'Low';
    }
    return 'Medium';
  };

  // Helper artist matcher
  const findMatchingArtist = (nameOrEmail: string): Artist | undefined => {
    if (!nameOrEmail) return undefined;
    const clean = String(nameOrEmail).trim().toLowerCase();
    return artists.find(
      a =>
        (a.name && a.name.toLowerCase() === clean) ||
        (a.email && a.email.toLowerCase() === clean) ||
        (a.name && a.name.toLowerCase().includes(clean)) ||
        (clean.includes(a.name.toLowerCase()))
    );
  };

  // Build Preview List from raw rows and current mapping
  const buildPreview = () => {
    if (!mapping.title) {
      setParseError('Please map the "Summary / Task Title" field before proceeding to preview.');
      return;
    }

    const items: ParsedRowPreview[] = rawRows.map((row, index) => {
      const rawTitle = row[mapping.title];
      const title = String(rawTitle || '').trim();

      // Story points
      let sp = 0;
      if (mapping.storyPoints && row[mapping.storyPoints] !== undefined && row[mapping.storyPoints] !== '') {
        const parsed = parseFloat(String(row[mapping.storyPoints]).replace(/[^\d.]/g, ''));
        if (!isNaN(parsed) && parsed > 0) sp = parsed;
      }

      // Original estimate (hours)
      let estimate = 0;
      if (mapping.originalEstimate && row[mapping.originalEstimate] !== undefined && row[mapping.originalEstimate] !== '') {
        const parsed = parseFloat(String(row[mapping.originalEstimate]).replace(/[^\d.]/g, ''));
        if (!isNaN(parsed) && parsed > 0) estimate = parsed;
      }
      // If estimate not given, derive from story points
      if (estimate === 0 && sp > 0) {
        estimate = Math.round(sp * hoursPerStoryPoint);
      } else if (estimate === 0 && sp === 0) {
        sp = 3;
        estimate = 3 * hoursPerStoryPoint;
      }

      // Due date
      const rawDueDate = mapping.dueDate ? row[mapping.dueDate] : '';
      const dueDate = parseNormalizedDate(rawDueDate);

      // Jira key
      const rawKey = mapping.jiraIssueKey ? String(row[mapping.jiraIssueKey] || '').trim().toUpperCase() : '';

      // Priority
      const rawPriority = mapping.priority ? row[mapping.priority] : '';
      const priority = parseNormalizedPriority(rawPriority);

      // Task type
      const rawType = mapping.taskType ? String(row[mapping.taskType] || '').trim() : '';
      const taskType = rawType || defaultCategory;

      // Description
      const rawDesc = mapping.description ? String(row[mapping.description] || '').trim() : '';

      // Assignee
      const rawAssignee = mapping.assignee ? String(row[mapping.assignee] || '').trim() : '';
      const matchedArtist = findMatchingArtist(rawAssignee);

      const isValid = Boolean(title.length > 0);
      const validationError = !isValid ? 'Summary / Title is required' : undefined;

      return {
        id: `row-${index}-${Date.now()}`,
        rawRow: row,
        title,
        storyPoints: sp,
        dueDate,
        originalEstimate: estimate,
        jiraIssueKey: rawKey,
        priority,
        taskType,
        description: rawDesc,
        assigneeName: rawAssignee,
        matchedArtist,
        selected: isValid,
        isValid,
        validationError
      };
    });

    setPreviewItems(items);
    setStep('preview');
  };

  // Preview Aggregates
  const validSelectedItems = useMemo(() => previewItems.filter(i => i.selected && i.isValid), [previewItems]);
  const totalStoryPoints = useMemo(() => validSelectedItems.reduce((acc, i) => acc + i.storyPoints, 0), [validSelectedItems]);
  const totalHours = useMemo(() => validSelectedItems.reduce((acc, i) => acc + i.originalEstimate, 0), [validSelectedItems]);
  const unassignedCount = useMemo(() => validSelectedItems.filter(i => !i.matchedArtist).length, [validSelectedItems]);

  const toggleSelectItem = (id: string) => {
    setPreviewItems(prev => prev.map(item => (item.id === id ? { ...item, selected: !item.selected } : item)));
  };

  const toggleSelectAll = (select: boolean) => {
    setPreviewItems(prev => prev.map(item => (item.isValid ? { ...item, selected: select } : item)));
  };

  // Perform Final Bulk Import
  const handleExecuteImport = async () => {
    if (validSelectedItems.length === 0) return;
    setIsProcessing(true);

    try {
      const selectedProject = projects.find(p => p.id === targetProjectId) || projects[0];
      if (!selectedProject) {
        setParseError('Please select a valid destination project.');
        setIsProcessing(false);
        return;
      }

      // Convert preview items into Task partials
      const tasksToImport: Partial<Task>[] = validSelectedItems.map(item => {
        const fullTitle = item.jiraIssueKey ? `[${item.jiraIssueKey}] ${item.title}` : item.title;
        return {
          title: fullTitle,
          description: item.description || (item.jiraIssueKey ? `Imported from Jira ticket ${item.jiraIssueKey}` : 'Bulk imported backlog task.'),
          projectId: selectedProject.id,
          sprintId: targetSprintId || undefined,
          storyPoints: item.storyPoints,
          originalEstimate: item.originalEstimate,
          remainingEstimate: item.originalEstimate,
          dueDate: item.dueDate,
          priority: item.priority,
          taskType: item.taskType,
          artistId: item.matchedArtist ? item.matchedArtist.id : undefined,
          jiraIssueKey: item.jiraIssueKey || undefined,
          isJiraImported: Boolean(item.jiraIssueKey),
          jiraSummary: item.title,
          tags: [selectedProject.name, item.taskType, item.jiraIssueKey ? 'Jira' : 'Spreadsheet Import'].filter(Boolean)
        };
      });

      const result = bulkImportTasksFromSpreadsheet(tasksToImport, selectedProject.id, targetSprintId || undefined);
      setImportedResult(result);
      setStep('success');
      if (onSuccess) {
        onSuccess(result.importedCount);
      }
    } catch (err: any) {
      console.error('Error during bulk import execution:', err);
      setParseError(`Bulk import error: ${err.message || 'Failed to persist tasks'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Download Sample CSV Template
  const handleDownloadSampleCsv = () => {
    const sampleHeaders = [
      'Issue key',
      'Summary',
      'Story Points',
      'Due Date',
      'Original Estimate',
      'Priority',
      'Issue Type',
      'Description',
      'Assignee'
    ];
    const sampleRows = [
      [
        'WWE-2401',
        'Undertaker WrestleMania Attire 3D Model',
        '8',
        '2026-09-15',
        '48',
        'High',
        '3D Character',
        'Create high-poly sculpt, retopology, textures, and in-game export for Undertaker legacy arena outfit.',
        'Ranjeet Patil'
      ],
      [
        'WWE-2402',
        'LiveOps SummerSlam Arena VFX & Banner Props',
        '5',
        '2026-09-18',
        '30',
        'Urgent',
        'VFX & Environment',
        'Stage pyro effects, arena apron shaders, and particle bursts.',
        'Digital Artist'
      ],
      [
        'WWE-2403',
        'Loot Crate Opening UI & Reward Flow Animation',
        '3',
        '2026-09-22',
        '18',
        'Medium',
        '2D UI/UX',
        'Card flip motion, shine fx, and claim reward screen assets in 4K resolution.',
        ''
      ],
      [
        'WWE-2404',
        'Title Belt Championship Render & Icon Pack',
        '2',
        '2026-09-25',
        '12',
        'Low',
        'Iconography',
        'High resolution PNG icons and gold metallic shaders for championship titles.',
        ''
      ]
    ];

    const ws = XLSX.utils.aoa_to_sheet([sampleHeaders, ...sampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Jira_Backlog_Export');
    XLSX.writeFile(wb, 'RG_ArtFlow_Jira_Backlog_Sample.csv');
  };

  if (!isOpen) return null;

  return (
    <div
      id="bulk-backlog-import-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">Bulk Import Backlog Tasks (CSV / XLSX / Jira)</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  1-Step Field Mapping
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Upload exported Jira tasks or spreadsheets and map columns (Summary, Story Points, Due Date) to RG ArtFlow tasks.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl transition-colors cursor-pointer"
            title="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => step !== 'upload' && step !== 'success' && setStep('upload')}
              disabled={step === 'upload' || step === 'success'}
              className={`flex items-center gap-1.5 font-bold cursor-pointer transition-colors ${
                step === 'upload'
                  ? 'text-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step === 'upload' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}>1</span>
              <span>Upload Spreadsheet</span>
            </button>

            <span className="text-slate-300">&bull;</span>

            <button
              type="button"
              onClick={() => step === 'preview' && setStep('map')}
              disabled={step === 'upload' || step === 'success'}
              className={`flex items-center gap-1.5 font-bold cursor-pointer transition-colors ${
                step === 'map'
                  ? 'text-blue-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step === 'map' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}>2</span>
              <span>Map Jira Fields</span>
            </button>

            <span className="text-slate-300">&bull;</span>

            <div className={`flex items-center gap-1.5 font-bold ${
              step === 'preview' ? 'text-blue-600' : 'text-slate-400'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                step === 'preview' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
              }`}>3</span>
              <span>Preview & Confirm</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadSampleCsv}
            className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1.5 text-[11px] cursor-pointer hover:underline"
          >
            <Download size={13} />
            <span>Download Sample CSV Template</span>
          </button>
        </div>

        {/* Error Alert Box */}
        {parseError && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{parseError}</span>
            </div>
            <button
              type="button"
              onClick={() => setParseError(null)}
              className="text-rose-600 hover:text-rose-800 p-1 cursor-pointer font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Modal Body Container */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* ========================================================================= */}
          {/* STEP 1: FILE UPLOAD DROPZONE */}
          {/* ========================================================================= */}
          {step === 'upload' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50/70 scale-[0.99]'
                    : 'border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="w-16 h-16 rounded-2xl bg-blue-100/80 text-blue-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <Upload size={28} />
                </div>

                <h3 className="text-base font-bold text-slate-800">
                  Click to select or drag and drop Jira CSV / Excel export
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto">
                  Supports standard Jira CSV exports, Excel (.xlsx, .xls) worksheets with Summary, Story Points, Due Dates, and Estimates.
                </p>

                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs">
                  <span>Supported formats:</span>
                  <span className="font-mono text-blue-600 font-bold">.CSV, .XLSX, .XLS</span>
                </div>
              </div>

              {/* Supported Columns Guide */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" />
                  <span>Smart One-Step Auto-Detection</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Our system automatically maps Jira columns such as <strong>Summary</strong>, <strong>Story Points</strong> (SP), <strong>Due Date</strong>, <strong>Original Estimate</strong>, <strong>Issue Key</strong> (e.g. WWE-1234), and <strong>Priority</strong>. You can review and adjust any field mapping in the next step before importing.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: FIELD MAPPING & IMPORT CONFIGURATION */}
          {/* ========================================================================= */}
          {step === 'map' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* File Info Bar */}
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet size={18} className="text-blue-700 shrink-0" />
                  <div>
                    <span className="font-bold text-slate-900">{fileName}</span>
                    <span className="text-slate-500 ml-2">({fileSize} &bull; {rawRows.length} rows parsed)</span>
                  </div>
                </div>

                {sheetNames.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600 font-medium">Sheet Tab:</span>
                    <select
                      value={selectedSheet}
                      onChange={e => handleSheetChange(e.target.value)}
                      className="px-2 py-1 bg-white border border-blue-300 rounded-lg font-bold text-blue-900 outline-hidden cursor-pointer"
                    >
                      {sheetNames.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Destination & Defaults */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <FolderKanban size={14} className="text-blue-600" />
                  <span>Target Project & Backlog Configuration</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Destination Project <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={targetProjectId}
                      onChange={e => setTargetProjectId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:border-blue-600 outline-hidden"
                    >
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.key})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Sprint Destination
                    </label>
                    <select
                      value={targetSprintId}
                      onChange={e => setTargetSprintId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:border-blue-600 outline-hidden"
                    >
                      <option value="">Unscheduled in Art Backlog</option>
                      {sprints
                        .filter(s => s.status?.toUpperCase() !== 'COMPLETED')
                        .map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Effort Multiplier (Hours per SP)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={40}
                        value={hoursPerStoryPoint}
                        onChange={e => setHoursPerStoryPoint(Math.max(1, parseInt(e.target.value) || 6))}
                        className="w-20 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 text-center focus:border-blue-600 outline-hidden"
                      />
                      <span className="text-xs text-slate-500">hours / Story Point</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 1-Step Column Mapping Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Layers size={14} className="text-blue-600" />
                    <span>Map Spreadsheet Headers to RG ArtFlow Fields</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Fields with detected matches are pre-selected
                  </span>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-4 w-1/3">RG ArtFlow Attribute</th>
                        <th className="py-2.5 px-4 w-1/3">Mapped Spreadsheet Column</th>
                        <th className="py-2.5 px-4 w-1/3">Sample Value (Row 1)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {/* 1. Summary / Title (Required) */}
                      <tr className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-bold text-slate-900 flex items-center gap-1.5">
                          <span>Task Summary / Title</span>
                          <span className="text-rose-500 font-bold">*</span>
                        </td>
                        <td className="py-2.5 px-4">
                          <select
                            value={mapping.title}
                            onChange={e => setMapping(prev => ({ ...prev, title: e.target.value }))}
                            className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-semibold outline-hidden cursor-pointer ${
                              mapping.title ? 'bg-blue-50 border-blue-300 text-blue-950 font-bold' : 'bg-rose-50 border-rose-300 text-rose-900'
                            }`}
                          >
                            <option value="">-- Select Column --</option>
                            {rawHeaders.map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px] truncate max-w-[200px]">
                          {mapping.title && rawRows[0] ? String(rawRows[0][mapping.title] || '') : '-'}
                        </td>
                      </tr>

                      {/* 2. Story Points */}
                      <tr className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-bold text-slate-800">
                          Story Points (SP)
                        </td>
                        <td className="py-2.5 px-4">
                          <select
                            value={mapping.storyPoints}
                            onChange={e => setMapping(prev => ({ ...prev, storyPoints: e.target.value }))}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 outline-hidden cursor-pointer"
                          >
                            <option value="">-- None (Auto-derive from Estimate) --</option>
                            {rawHeaders.map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px] truncate max-w-[200px]">
                          {mapping.storyPoints && rawRows[0] ? String(rawRows[0][mapping.storyPoints] || '') : '-'}
                        </td>
                      </tr>

                      {/* 3. Due Date */}
                      <tr className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-bold text-slate-800">
                          Due Date / Target Delivery
                        </td>
                        <td className="py-2.5 px-4">
                          <select
                            value={mapping.dueDate}
                            onChange={e => setMapping(prev => ({ ...prev, dueDate: e.target.value }))}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 outline-hidden cursor-pointer"
                          >
                            <option value="">-- None (Default +14 days) --</option>
                            {rawHeaders.map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px] truncate max-w-[200px]">
                          {mapping.dueDate && rawRows[0] ? String(rawRows[0][mapping.dueDate] || '') : '-'}
                        </td>
                      </tr>

                      {/* 4. Original Estimate (Hours) */}
                      <tr className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-bold text-slate-800">
                          Original Estimate (Hours)
                        </td>
                        <td className="py-2.5 px-4">
                          <select
                            value={mapping.originalEstimate}
                            onChange={e => setMapping(prev => ({ ...prev, originalEstimate: e.target.value }))}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 outline-hidden cursor-pointer"
                          >
                            <option value="">-- None (Auto-derive from SP) --</option>
                            {rawHeaders.map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px] truncate max-w-[200px]">
                          {mapping.originalEstimate && rawRows[0] ? String(rawRows[0][mapping.originalEstimate] || '') : '-'}
                        </td>
                      </tr>

                      {/* 5. Jira Issue Key */}
                      <tr className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-bold text-slate-800">
                          Jira Issue Key (e.g. WWE-1234)
                        </td>
                        <td className="py-2.5 px-4">
                          <select
                            value={mapping.jiraIssueKey}
                            onChange={e => setMapping(prev => ({ ...prev, jiraIssueKey: e.target.value }))}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 outline-hidden cursor-pointer"
                          >
                            <option value="">-- None --</option>
                            {rawHeaders.map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px] truncate max-w-[200px]">
                          {mapping.jiraIssueKey && rawRows[0] ? String(rawRows[0][mapping.jiraIssueKey] || '') : '-'}
                        </td>
                      </tr>

                      {/* 6. Priority */}
                      <tr className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-bold text-slate-800">
                          Priority (Urgent / High / Medium / Low)
                        </td>
                        <td className="py-2.5 px-4">
                          <select
                            value={mapping.priority}
                            onChange={e => setMapping(prev => ({ ...prev, priority: e.target.value }))}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 outline-hidden cursor-pointer"
                          >
                            <option value="">-- None (Default Medium) --</option>
                            {rawHeaders.map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px] truncate max-w-[200px]">
                          {mapping.priority && rawRows[0] ? String(rawRows[0][mapping.priority] || '') : '-'}
                        </td>
                      </tr>

                      {/* 7. Issue Type / Art Category */}
                      <tr className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-bold text-slate-800">
                          Issue Type / Art Category
                        </td>
                        <td className="py-2.5 px-4">
                          <select
                            value={mapping.taskType}
                            onChange={e => setMapping(prev => ({ ...prev, taskType: e.target.value }))}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 outline-hidden cursor-pointer"
                          >
                            <option value="">-- None (Default 3D Asset) --</option>
                            {rawHeaders.map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px] truncate max-w-[200px]">
                          {mapping.taskType && rawRows[0] ? String(rawRows[0][mapping.taskType] || '') : '-'}
                        </td>
                      </tr>

                      {/* 8. Description */}
                      <tr className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-bold text-slate-800">
                          Description & Details
                        </td>
                        <td className="py-2.5 px-4">
                          <select
                            value={mapping.description}
                            onChange={e => setMapping(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 outline-hidden cursor-pointer"
                          >
                            <option value="">-- None --</option>
                            {rawHeaders.map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px] truncate max-w-[200px]">
                          {mapping.description && rawRows[0] ? String(rawRows[0][mapping.description] || '').substring(0, 30) + '...' : '-'}
                        </td>
                      </tr>

                      {/* 9. Assignee */}
                      <tr className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-bold text-slate-800">
                          Artist Assignee
                        </td>
                        <td className="py-2.5 px-4">
                          <select
                            value={mapping.assignee}
                            onChange={e => setMapping(prev => ({ ...prev, assignee: e.target.value }))}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 outline-hidden cursor-pointer"
                          >
                            <option value="">-- None (Keep in Backlog Unassigned) --</option>
                            {rawHeaders.map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px] truncate max-w-[200px]">
                          {mapping.assignee && rawRows[0] ? String(rawRows[0][mapping.assignee] || '') : '-'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: PREVIEW & CONFIRMATION TABLE */}
          {/* ========================================================================= */}
          {step === 'preview' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Top KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-blue-700 block">Selected to Import</span>
                  <span className="text-xl font-bold text-blue-950 mt-0.5 block">{validSelectedItems.length} Tasks</span>
                </div>

                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-purple-700 block">Total Story Points</span>
                  <span className="text-xl font-bold text-purple-950 mt-0.5 block">{totalStoryPoints} SP</span>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-emerald-700 block">Total Effort</span>
                  <span className="text-xl font-bold text-emerald-950 mt-0.5 block">{totalHours} Hours</span>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="text-[10px] uppercase font-bold text-amber-700 block">Unassigned Tasks</span>
                  <span className="text-xl font-bold text-amber-950 mt-0.5 block">{unassignedCount} Backlog</span>
                </div>
              </div>

              {/* Table Selection Controls */}
              <div className="flex items-center justify-between text-xs px-1">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(true)}
                    className="text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                  >
                    Select All Valid ({previewItems.filter(i => i.isValid).length})
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(false)}
                    className="text-slate-600 hover:text-slate-800 font-medium cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>

                <span className="text-slate-500 font-medium">
                  Showing {previewItems.length} parsed items
                </span>
              </div>

              {/* Data Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[360px] overflow-y-auto shadow-2xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center"></th>
                      <th className="py-2.5 px-3">Jira Key / Task Summary</th>
                      <th className="py-2.5 px-3 text-center">SP</th>
                      <th className="py-2.5 px-3 text-center">Estimate</th>
                      <th className="py-2.5 px-3">Due Date</th>
                      <th className="py-2.5 px-3">Priority</th>
                      <th className="py-2.5 px-3">Assignee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {previewItems.map(item => (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50 transition-colors ${
                          !item.isValid ? 'bg-rose-50/40 text-rose-900 opacity-60' : item.selected ? 'bg-blue-50/20' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            disabled={!item.isValid}
                            onChange={() => toggleSelectItem(item.id)}
                            className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.jiraIssueKey && (
                              <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
                                {item.jiraIssueKey}
                              </span>
                            )}
                            <span className="font-bold text-slate-900">{item.title || 'Untitled Task'}</span>
                          </div>
                          {item.validationError && (
                            <p className="text-[10px] text-rose-600 font-bold mt-0.5">{item.validationError}</p>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                            {item.storyPoints} SP
                          </span>
                        </td>

                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-700">
                          {item.originalEstimate}h
                        </td>

                        <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                          {item.dueDate}
                        </td>

                        <td className="py-2.5 px-3">
                          <PriorityBadge priority={item.priority} />
                        </td>

                        <td className="py-2.5 px-3">
                          {item.matchedArtist ? (
                            <span className="font-bold text-slate-900 flex items-center gap-1 text-[11px]">
                              <UserCheck size={12} className="text-emerald-600" />
                              <span>{item.matchedArtist.name}</span>
                            </span>
                          ) : item.assigneeName ? (
                            <span className="text-slate-500 text-[11px]" title="No matching artist in roster">
                              {item.assigneeName} (Unassigned)
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: SUCCESS CONFIRMATION */}
          {/* ========================================================================= */}
          {step === 'success' && (
            <div className="text-center py-8 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={32} />
              </div>

              <div>
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 uppercase tracking-wider inline-block mb-2">
                  Import Successful
                </span>
                <h3 className="text-xl font-bold text-slate-900">
                  {importedResult?.importedCount || 0} Backlog Tasks Imported!
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                  Tasks have been added to your studio backlog and synchronized in real-time. You can now triage, assign artists, or move them into production sprints.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl max-w-sm mx-auto text-xs text-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Destination Project:</span>
                  <span className="font-bold text-slate-900">
                    {projects.find(p => p.id === targetProjectId)?.name || 'Studio Project'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Total Story Points:</span>
                  <span className="font-bold text-purple-700">{totalStoryPoints} SP</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Total Estimated Effort:</span>
                  <span className="font-bold text-emerald-700">{totalHours} Hours</span>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer transition-colors"
                >
                  View Tasks in Art Backlog
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        {step !== 'success' && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            {step === 'upload' ? (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
            ) : step === 'map' ? (
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ArrowLeft size={13} />
                <span>Back to File Upload</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep('map')}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <ArrowLeft size={13} />
                <span>Back to Column Mapping</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              {step === 'map' && (
                <button
                  type="button"
                  onClick={buildPreview}
                  disabled={!mapping.title}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all"
                >
                  <span>Preview Parsed Tasks</span>
                  <ArrowRight size={14} />
                </button>
              )}

              {step === 'preview' && (
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={isProcessing || validSelectedItems.length === 0}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer transition-all"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Importing Tasks...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Confirm & Import ({validSelectedItems.length}) Tasks</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
